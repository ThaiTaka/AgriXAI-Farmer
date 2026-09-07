"""Diagnosis inference and history.

`POST /diagnoses` deliberately does **not** write a `diagnoses` row.

It stores the photo and returns predictions; the mobile app owns the record and
it reaches the server through the normal sync push. Keeping one writer per record
is what stops the "server wants client to create a record that already exists"
class of bug we hit with the variety catalogue in Giai đoạn 1 — the server would
create the row under the same client id and then try to send it back as new.
"""

import logging
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.farm import Diagnosis, Plot
from app.models.user import User, UserRole
from app.schemas.diagnosis import DiagnosisOut, PredictResponse
from app.services import static_data
from app.services.auth_service import current_user
from app.services.predictor import get_predictor
from app.services.sync_service import now_ms

logger = logging.getLogger("agrilog.diagnoses")

router = APIRouter(prefix="/diagnoses", tags=["diagnoses"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # matches the "giới hạn 10 MB mỗi ảnh" note in the design
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
EXTENSIONS = {"image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@router.post("", response_model=PredictResponse)
async def create_diagnosis(
    image: UploadFile = File(...),
    plot_id: str | None = Form(default=None),
    client_id: str | None = Form(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PredictResponse:
    """Runs the model on an uploaded leaf photo."""
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Chỉ nhận ảnh JPEG, PNG hoặc WebP.",
        )

    payload = await image.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Ảnh rỗng.")
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ảnh vượt quá 10 MB. Chụp lại với chất lượng thấp hơn.",
        )

    if plot_id:
        plot = db.get(Plot, plot_id)
        if plot is None or plot.is_deleted:
            # The phone may hold a plot the server has not received yet, so a
            # missing plot is not an error — the diagnosis still runs.
            logger.debug("plot %s not on server yet", plot_id)
        elif user.role is not UserRole.ADMIN and plot.owner_id != user.id:
            raise HTTPException(status_code=404, detail="Không tìm thấy lô đất")

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{client_id or uuid.uuid4()}{EXTENSIONS[image.content_type]}"
    (settings.upload_dir / stored_name).write_bytes(payload)

    result = get_predictor().predict(payload)

    logger.debug(
        "predict user=%s plot=%s bytes=%d top1=%s",
        user.username,
        plot_id,
        len(payload),
        result["predictions"][0]["disease_key"],
    )

    return PredictResponse(
        predictions=result["predictions"],
        heatmap=result["heatmap"],
        model_version=result["model_version"],
        image_path=stored_name,
        analysed_at=now_ms(),
    )


@router.get("", response_model=list[DiagnosisOut])
def list_diagnoses(
    plot_id: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[Diagnosis]:
    stmt = select(Diagnosis).where(Diagnosis.is_deleted.is_(False))
    if user.role is not UserRole.ADMIN:
        stmt = stmt.where(Diagnosis.owner_id == user.id)
    if plot_id:
        stmt = stmt.where(Diagnosis.plot_id == plot_id)
    return list(db.scalars(stmt.order_by(Diagnosis.diagnosed_at.desc()).limit(limit)))


@router.get("/image/{name}")
def get_image(name: str, _: User = Depends(current_user)) -> FileResponse:
    # Resolve inside the upload directory so a crafted name cannot walk out of it.
    path = (settings.upload_dir / Path(name).name).resolve()
    if not path.is_file() or settings.upload_dir.resolve() not in path.parents:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
    return FileResponse(path)


@router.get("/{diagnosis_id}", response_model=DiagnosisOut)
def get_diagnosis(
    diagnosis_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Diagnosis:
    return _owned(db, user, diagnosis_id)


@router.delete("/{diagnosis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diagnosis(
    diagnosis_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    row = _owned(db, user, diagnosis_id)
    # Soft delete: pullChanges has to be able to tell other devices it is gone.
    row.is_deleted = True
    row.deleted_at = now_ms()
    row.updated_by = user.id
    db.commit()


def _owned(db: Session, user: User, diagnosis_id: str) -> Diagnosis:
    row = db.get(Diagnosis, diagnosis_id)
    if row is None or row.is_deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy chẩn đoán")
    if user.role is not UserRole.ADMIN and row.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy chẩn đoán")
    return row


# ---------------------------------------------------------------------------
# Disease catalogue — served from shared/data so mobile, web-admin and the API
# all read the same 10 entries.
# ---------------------------------------------------------------------------

diseases_router = APIRouter(prefix="/diseases", tags=["diseases"])


@diseases_router.get("")
def list_diseases() -> list[dict[str, Any]]:
    return static_data.diseases()


@diseases_router.get("/{key}")
def get_disease(key: str) -> dict[str, Any]:
    disease = static_data.disease_by_key(key)
    if disease is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy bệnh")
    return disease
