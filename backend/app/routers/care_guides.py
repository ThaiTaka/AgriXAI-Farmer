"""Care guides — a crop how-to with an embedded YouTube video and illustrated
steps, written by admins in web-admin and read on every phone.

    GET    /care-guides?crop_type=             published ones (admins: drafts too)
    GET    /care-guides/{id}
    GET    /crops/{crop_type}/care-guides
    POST   /care-guides                        admin
    PATCH  /care-guides/{id}                   admin
    DELETE /care-guides/{id}                   admin
    POST   /care-guides/{id}/upload-image      admin — public image, added to the strip

Phones do not call these: guides reach them through /sync like the variety
catalogue, so a guide read once stays readable in the field without signal
(the video itself still needs a connection).
"""

import json
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.farm import CareGuide
from app.models.ops import MediaFile
from app.models.user import User, UserRole
from app.schemas.care_guide import CareGuideCreate, CareGuideOut, CareGuideUpdate, GuideStep
from app.services import media_service
from app.services.auth_service import current_admin, current_user
from app.services.sync_service import now_ms

router = APIRouter(tags=["care-guides"])

CROP_SLUG = re.compile(r"^[a-z0-9_]{1,48}$")


def _load_list(raw: str | None) -> list:
    try:
        value = json.loads(raw) if raw else []
    except (TypeError, ValueError):
        return []
    return value if isinstance(value, list) else []


def guide_out(guide: CareGuide) -> CareGuideOut:
    steps = []
    for step in _load_list(guide.steps_json):
        if isinstance(step, dict) and step.get("title"):
            steps.append(GuideStep(title=step["title"], body=step.get("body") or "", image_id=step.get("image_id")))
    return CareGuideOut(
        id=guide.id,
        crop_type=guide.crop_type,
        stage_code=guide.stage_code,
        title=guide.title,
        summary=guide.summary,
        youtube_id=guide.youtube_id,
        steps=steps,
        image_ids=[i for i in _load_list(guide.images_json) if isinstance(i, str)],
        source_name=guide.source_name,
        source_url=guide.source_url,
        published=guide.published,
        sort_order=guide.sort_order,
        created_by=guide.created_by,
        updated_by=guide.updated_by,
        created_at=guide.created_at,
        updated_at=guide.updated_at,
    )


def _visible(user: User):
    stmt = select(CareGuide).where(CareGuide.is_deleted.is_(False))
    if user.role is not UserRole.ADMIN:
        stmt = stmt.where(CareGuide.published.is_(True))
    return stmt.order_by(CareGuide.crop_type, CareGuide.sort_order, CareGuide.title)


def _guide(db: Session, user: User, guide_id: str) -> CareGuide:
    guide = db.get(CareGuide, guide_id)
    if guide is None or guide.is_deleted or (not guide.published and user.role is not UserRole.ADMIN):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy hướng dẫn")
    return guide


def _check_crop(crop_type: str) -> None:
    if not CROP_SLUG.match(crop_type):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Mã cây trồng không hợp lệ")


def _check_images(db: Session, ids: list[str]) -> None:
    """Every picture a guide shows must be a public upload — a private one
    would load for the admin who wrote the guide and nobody else."""
    for media_id in ids:
        media = db.get(MediaFile, media_id)
        if media is None or media.is_deleted or media.kind != "image" or not media.is_public:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Ảnh {media_id} chưa được tải lên dạng công khai")


def _step_image_ids(steps: list[GuideStep]) -> list[str]:
    return [s.image_id for s in steps if s.image_id]


@router.get("/care-guides", response_model=list[CareGuideOut])
def list_guides(
    crop_type: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    stmt = _visible(user)
    if crop_type:
        stmt = stmt.where(CareGuide.crop_type == crop_type)
    return [guide_out(g) for g in db.scalars(stmt)]


@router.get("/crops/{crop_type}/care-guides", response_model=list[CareGuideOut])
def guides_for_crop(crop_type: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [guide_out(g) for g in db.scalars(_visible(user).where(CareGuide.crop_type == crop_type))]


@router.get("/care-guides/{guide_id}", response_model=CareGuideOut)
def get_guide(guide_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return guide_out(_guide(db, user, guide_id))


@router.post("/care-guides", response_model=CareGuideOut, status_code=status.HTTP_201_CREATED)
def create_guide(body: CareGuideCreate, admin: User = Depends(current_admin), db: Session = Depends(get_db)):
    _check_crop(body.crop_type)
    _check_images(db, body.image_ids + _step_image_ids(body.steps))
    guide = CareGuide(
        id=body.id or str(uuid.uuid4()),
        crop_type=body.crop_type,
        stage_code=body.stage_code or None,
        title=body.title.strip(),
        summary=body.summary,
        youtube_id=body.youtube,
        steps_json=json.dumps([s.model_dump() for s in body.steps], ensure_ascii=False),
        images_json=json.dumps(body.image_ids),
        source_name=body.source_name,
        source_url=body.source_url,
        published=body.published,
        sort_order=body.sort_order,
        created_by=admin.id,
        updated_by=admin.id,
    )
    db.add(guide)
    db.commit()
    db.refresh(guide)
    return guide_out(guide)


@router.patch("/care-guides/{guide_id}", response_model=CareGuideOut)
def update_guide(
    guide_id: str, body: CareGuideUpdate, admin: User = Depends(current_admin), db: Session = Depends(get_db)
):
    guide = _guide(db, admin, guide_id)
    data = body.model_dump(exclude_unset=True)
    if "crop_type" in data:
        _check_crop(data["crop_type"])
    if body.steps is not None:
        _check_images(db, _step_image_ids(body.steps))
        guide.steps_json = json.dumps([s.model_dump() for s in body.steps], ensure_ascii=False)
    if body.image_ids is not None:
        _check_images(db, body.image_ids)
        guide.images_json = json.dumps(body.image_ids)
    if "youtube" in data:
        guide.youtube_id = data["youtube"]
    for key in ("crop_type", "stage_code", "title", "summary", "source_name", "source_url", "published", "sort_order"):
        if key in data:
            setattr(guide, key, data[key])
    guide.updated_by = admin.id
    db.commit()
    db.refresh(guide)
    return guide_out(guide)


@router.delete("/care-guides/{guide_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guide(guide_id: str, admin: User = Depends(current_admin), db: Session = Depends(get_db)) -> None:
    guide = _guide(db, admin, guide_id)
    guide.is_deleted = True
    guide.deleted_at = now_ms()
    guide.updated_by = admin.id
    db.commit()


@router.post("/care-guides/{guide_id}/upload-image", response_model=CareGuideOut)
def upload_guide_image(
    guide_id: str,
    file: UploadFile = File(...),
    admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    guide = _guide(db, admin, guide_id)
    media, _ = media_service.store_upload(db, admin, file, public=True)
    if media.kind != "image":
        media_service.delete_file(db, media)
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Hướng dẫn chỉ nhận ảnh ở đây")
    ids = [i for i in _load_list(guide.images_json) if isinstance(i, str)]
    guide.images_json = json.dumps([*ids, media.id])
    guide.updated_by = admin.id
    db.commit()
    db.refresh(guide)
    return guide_out(guide)
