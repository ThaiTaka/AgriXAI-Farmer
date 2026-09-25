"""What happened on a care task: notes with photos/videos, and hired labour.

A task is a `tasks_history` row — one care task of a protocol on one plot.
The phone writes notes (`task_notes`) and labour (`expense` rows of kind
"labor" carrying `task_id`) through /sync; these endpoints give web-admin and
integrations the same records over plain HTTP.

    GET    /tasks-history/{task_id}/notes
    POST   /tasks-history/{task_id}/notes
    POST   /tasks-history/{task_id}/notes/{note_id}/upload-media
    DELETE /task-notes/{note_id}
    GET    /tasks-history/{task_id}/labor-costs
    POST   /tasks-history/{task_id}/labor-costs
    PATCH  /labor-costs/{cost_id}
    DELETE /labor-costs/{cost_id}
"""

import json
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ledger import Expense, ExpenseKind, LaborUnit, TaskHistory, TaskNote
from app.models.ops import MediaFile
from app.models.user import User, UserRole
from app.schemas.cultivation import MediaRef
from app.schemas.task_records import (
    LaborCostCreate,
    LaborCostOut,
    LaborCostUpdate,
    TaskNoteCreate,
    TaskNoteOut,
)
from app.services import media_service
from app.services.auth_service import current_user
from app.services.labor import labor_amount
from app.services.sync_service import now_ms

router = APIRouter(tags=["care-protocols"])


def _mine(user: User, owner_id: str) -> bool:
    return user.role is UserRole.ADMIN or owner_id == user.id


def _task(db: Session, user: User, task_id: str) -> TaskHistory:
    task = db.get(TaskHistory, task_id)
    if task is None or task.is_deleted or not _mine(user, task.owner_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy công việc")
    return task


def note_out(note: TaskNote) -> TaskNoteOut:
    refs = media_service.with_urls(media_service.parse_refs(note.media_json))
    return TaskNoteOut(
        id=note.id,
        task_id=note.task_id,
        plot_id=note.plot_id,
        note_text=note.note_text,
        media=[MediaRef(**ref) for ref in refs],
        occurred_at=note.occurred_at,
        owner_id=note.owner_id,
        updated_by=note.updated_by,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


# ---------------------------------- notes ----------------------------------


@router.get("/tasks-history/{task_id}/notes", response_model=list[TaskNoteOut])
def list_notes(task_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    task = _task(db, user, task_id)
    stmt = select(TaskNote).where(TaskNote.task_id == task.id, TaskNote.is_deleted.is_(False))
    return [note_out(n) for n in db.scalars(stmt.order_by(TaskNote.occurred_at.desc()))]


@router.post("/tasks-history/{task_id}/notes", response_model=TaskNoteOut, status_code=status.HTTP_201_CREATED)
def create_note(
    task_id: str, body: TaskNoteCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    """A note on how the task was done. Photos/videos go up first through
    POST /media (or afterwards through .../upload-media) and are named here."""
    task = _task(db, user, task_id)
    if not body.note_text.strip() and not body.media_ids:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Ghi chú cần có chữ hoặc ít nhất một ảnh/video")
    refs = []
    for media_id in body.media_ids:
        media = db.get(MediaFile, media_id)
        if media is None or media.is_deleted or media.owner_id != task.owner_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Chưa có ảnh/video {media_id} trên máy chủ")
        refs.append(media_service.ref_for(media))
    note = TaskNote(
        id=body.id or str(uuid.uuid4()),
        task_id=task.id,
        plot_id=task.plot_id,
        note_text=body.note_text.strip(),
        media_json=json.dumps(refs, ensure_ascii=False) if refs else None,
        occurred_at=body.occurred_at or now_ms(),
        owner_id=task.owner_id,
        updated_by=user.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note_out(note)


@router.post("/tasks-history/{task_id}/notes/{note_id}/upload-media", response_model=TaskNoteOut)
def upload_note_media(
    task_id: str,
    note_id: str,
    file: UploadFile = File(...),
    id: str | None = Form(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Uploads one photo/video and attaches it to the note in one call."""
    task = _task(db, user, task_id)
    note = db.get(TaskNote, note_id)
    if note is None or note.is_deleted or note.task_id != task.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy ghi chú")
    owner = db.get(User, task.owner_id)
    media, _ = media_service.store_upload(db, owner, file, id)
    note.media_json = media_service.append_ref(note.media_json, media)
    note.updated_by = user.id
    db.commit()
    db.refresh(note)
    return note_out(note)


@router.delete("/task-notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    note = db.get(TaskNote, note_id)
    if note is None or note.is_deleted or not _mine(user, note.owner_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy ghi chú")
    note.is_deleted = True
    note.deleted_at = now_ms()
    note.updated_by = user.id
    db.commit()


# ------------------------------- labour costs -------------------------------


def _labor(db: Session, user: User, cost_id: str) -> Expense:
    row = db.get(Expense, cost_id)
    if (
        row is None
        or row.is_deleted
        or row.kind != ExpenseKind.LABOR.value
        or not _mine(user, row.owner_id)
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy khoản tiền công")
    return row


@router.get("/tasks-history/{task_id}/labor-costs", response_model=list[LaborCostOut])
def list_labor_costs(task_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    task = _task(db, user, task_id)
    stmt = select(Expense).where(
        Expense.task_id == task.id,
        Expense.kind == ExpenseKind.LABOR.value,
        Expense.owner_id == task.owner_id,
        Expense.is_deleted.is_(False),
    )
    return list(db.scalars(stmt.order_by(Expense.occurred_at.desc())))


@router.post(
    "/tasks-history/{task_id}/labor-costs", response_model=LaborCostOut, status_code=status.HTTP_201_CREATED
)
def create_labor_cost(
    task_id: str, body: LaborCostCreate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Expense:
    """Books hired work for the task as an expense of kind "labor", so it shows
    up in Thu – Chi, the monthly report and the plot's cost summary."""
    task = _task(db, user, task_id)
    lump = body.unit is LaborUnit.LUMP
    row = Expense(
        id=body.id or str(uuid.uuid4()),
        kind=ExpenseKind.LABOR.value,
        description=body.description.strip(),
        amount=labor_amount(body.unit.value, body.workers, body.quantity, body.unit_price),
        occurred_at=body.occurred_at or now_ms(),
        note=body.note,
        plot_id=task.plot_id,
        checked=False,
        task_id=task.id,
        workers=None if lump else body.workers,
        quantity=None if lump else body.quantity,
        unit=body.unit.value,
        unit_price=body.unit_price,
        owner_id=task.owner_id,
        updated_by=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/labor-costs/{cost_id}", response_model=LaborCostOut)
def update_labor_cost(
    cost_id: str, body: LaborCostUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> Expense:
    row = _labor(db, user, cost_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("unit") is not None:
        data["unit"] = data["unit"].value
    for key, value in data.items():
        setattr(row, key, value)
    unit = row.unit or LaborUnit.LUMP.value
    if unit == LaborUnit.LUMP.value:
        row.workers = None
        row.quantity = None
    try:
        row.amount = labor_amount(unit, row.workers, row.quantity, row.unit_price or row.amount)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    row.updated_by = user.id
    db.commit()
    db.refresh(row)
    return row


@router.delete("/labor-costs/{cost_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_labor_cost(cost_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    row = _labor(db, user, cost_id)
    row.is_deleted = True
    row.deleted_at = now_ms()
    row.updated_by = user.id
    db.commit()
