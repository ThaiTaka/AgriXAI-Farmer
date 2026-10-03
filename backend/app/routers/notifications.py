"""Notifications — messages for the farmers' phones.

    GET    /notifications            admin: every one, with how many farms read it
                                     farmer: their own and every broadcast
    POST   /notifications            admin — send (to every farm, or one)
    PATCH  /notifications/{id}       admin — correct the wording
    DELETE /notifications/{id}       admin — take it back (gone from phones on their next sync)

Phones do not call these: notifications reach them through /sync, and the
farmer's "đã xem" marks travel back the same way (notification_reads). The
server also writes its own — weather warnings and price changes — see
app/services/notification_service.py.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.notification import Notification, NotificationKind
from app.models.user import User, UserRole
from app.schemas.notification import NotificationCreate, NotificationOut, NotificationUpdate
from app.services import notification_service as notices
from app.services.auth_service import current_admin, current_user
from app.services.sync_service import now_ms

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _out(
    row: Notification,
    *,
    read: bool,
    names: dict[str, str],
    read_count: int | None = None,
    audience_size: int | None = None,
) -> NotificationOut:
    return NotificationOut(
        id=row.id,
        owner_id=row.owner_id,
        audience_label=names.get(row.owner_id, row.owner_id) if row.owner_id else notices.EVERY_FARM,
        kind=row.kind,
        level=row.level,
        title=row.title,
        body=row.body,
        link=row.link,
        source_name=row.source_name,
        source_url=row.source_url,
        expires_at=row.expires_at,
        created_by=row.created_by,
        updated_by=row.updated_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
        read=read,
        read_count=read_count,
        audience_size=audience_size,
    )


def _names(db: Session, rows: list[Notification]) -> dict[str, str]:
    ids = {r.owner_id for r in rows if r.owner_id}
    if not ids:
        return {}
    return {u.id: u.full_name or u.username for u in db.scalars(select(User).where(User.id.in_(ids)))}


def _get(db: Session, notification_id: str) -> Notification:
    row = db.get(Notification, notification_id)
    if row is None or row.is_deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy thông báo")
    return row


def _admin_out(db: Session, admin: User, rows: list[Notification]) -> list[NotificationOut]:
    names = _names(db, rows)
    counts = notices.read_counts(db, [r.id for r in rows])
    farms = notices.farm_count(db)
    seen = notices.read_by(db, admin, rows)
    return [
        _out(
            r,
            read=r.id in seen,
            names=names,
            read_count=counts.get(r.id, 0),
            audience_size=1 if r.owner_id else farms,
        )
        for r in rows
    ]


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    kind: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user.role is UserRole.ADMIN:
        stmt = select(Notification).where(Notification.is_deleted.is_(False))
    else:
        stmt = notices.visible_to(user)
    if kind:
        stmt = stmt.where(Notification.kind == kind)
    rows = list(db.scalars(stmt.order_by(Notification.created_at.desc()).limit(limit)))
    if user.role is UserRole.ADMIN:
        return _admin_out(db, user, rows)
    seen = notices.read_by(db, user, rows)
    return [_out(r, read=r.id in seen, names={}) for r in rows]


@router.post("", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
def send_notification(body: NotificationCreate, admin: User = Depends(current_admin), db: Session = Depends(get_db)):
    if body.owner_id is not None:
        farm = db.get(User, body.owner_id)
        if farm is None or farm.is_deleted or not farm.is_active:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Không tìm thấy tài khoản nhận thông báo")
    row = notices.create(
        db,
        title=body.title,
        body=body.body.strip(),
        kind=NotificationKind.ANNOUNCEMENT,
        level=body.level,
        owner_id=body.owner_id,
        link=body.link or None,
        source_name=body.source_name or None,
        source_url=body.source_url,
        expires_at=body.expires_at,
        author_id=admin.id,
    )
    db.commit()
    db.refresh(row)
    return _admin_out(db, admin, [row])[0]


@router.patch("/{notification_id}", response_model=NotificationOut)
def update_notification(
    notification_id: str,
    body: NotificationUpdate,
    admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    row = _get(db, notification_id)
    data = body.model_dump(exclude_unset=True)
    if "title" in data:
        if not (data["title"] or "").strip():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Tiêu đề không được để trống")
        data["title"] = data["title"].strip()
    for key in ("title", "body", "level", "link", "source_name", "source_url", "expires_at"):
        if key in data:
            setattr(row, key, data[key])
    row.updated_by = admin.id
    db.commit()
    db.refresh(row)
    return _admin_out(db, admin, [row])[0]


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(notification_id: str, admin: User = Depends(current_admin), db: Session = Depends(get_db)) -> None:
    row = _get(db, notification_id)
    row.is_deleted = True
    row.deleted_at = now_ms()
    row.updated_by = admin.id
    db.commit()
