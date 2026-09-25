"""Photos and videos: where the bytes live and who may see them.

The rows that sync (task notes, crop cycles, care guides) never carry bytes —
a phone on 3G must be able to sync a day's work in one small request. They
carry *media refs*, a JSON list stored in a text column:

    [{"id": "b1f0…", "kind": "image", "mime": "image/jpeg", "uploaded": true}]

The phone picks `id` when the picture is taken and keeps the file under that
name until POST /media has it, then flips `uploaded`. A retried upload with
the same id is answered with the row already stored, so a dropped response
never makes a duplicate.

The file type is decided by the first bytes of the upload, never by the
filename or the Content-Type the client sends: a renamed .exe must not be
served back as image/jpeg to someone else's browser.
"""

import json
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ops import MediaFile
from app.models.user import User, UserRole

MEDIA_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
_CHUNK = 1024 * 1024

# ISO-BMFF brands (bytes 8-12 after "ftyp") that are still pictures, not film.
# HEIC is refused rather than stored: only Safari can show it, so an admin on
# Chrome would see a broken image. The phone asks the picker for JPEG.
_STILL_BRANDS = {b"heic", b"heix", b"hevc", b"heim", b"heis", b"hevm", b"hevs", b"mif1", b"msf1", b"avif"}


@dataclass(frozen=True)
class Sniffed:
    kind: str  # "image" | "video"
    content_type: str
    ext: str


def sniff(head: bytes) -> Sniffed | None:
    """What the file is, judged from its first bytes. None = not accepted."""
    if head.startswith(b"\xff\xd8\xff"):
        return Sniffed("image", "image/jpeg", "jpg")
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return Sniffed("image", "image/png", "png")
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return Sniffed("image", "image/webp", "webp")
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return Sniffed("video", "video/webm", "webm")
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in _STILL_BRANDS:
            return None
        if brand == b"qt  ":
            return Sniffed("video", "video/quicktime", "mov")
        if brand.startswith(b"3g"):
            return Sniffed("video", "video/3gpp", "3gp")
        return Sniffed("video", "video/mp4", "mp4")
    return None


def media_root() -> Path:
    return Path(settings.media_dir)


def limit_bytes(kind: str) -> int:
    mb = settings.media_max_video_mb if kind == "video" else settings.media_max_image_mb
    return mb * 1024 * 1024


def store_upload(
    db: Session,
    owner: User,
    upload: UploadFile,
    media_id: str | None = None,
    public: bool = False,
) -> tuple[MediaFile, bool]:
    """Writes the upload to disk and indexes it. Returns (row, created).

    Raises 409 when `media_id` is taken by another account, 415 for a type we
    do not serve, 413 past the size limit. Nothing is left on disk on failure.
    """
    if media_id is not None and not MEDIA_ID.match(media_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Mã ảnh/video không hợp lệ")
    media_id = media_id or uuid.uuid4().hex

    existing = db.get(MediaFile, media_id)
    if existing is not None:
        if existing.owner_id != owner.id or existing.is_deleted:
            raise HTTPException(status.HTTP_409_CONFLICT, "Mã ảnh/video đã được dùng")
        return existing, False  # a retry: the first attempt already landed

    head = upload.file.read(64)
    kind = sniff(head)
    if kind is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Chỉ nhận ảnh JPEG/PNG/WebP hoặc video MP4/MOV/3GP/WebM",
        )

    relative = f"{owner.id}/{media_id}.{kind.ext}"
    target = media_root() / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    limit = limit_bytes(kind.kind)
    size = 0
    try:
        with partial.open("wb") as out:
            chunk = head
            while chunk:
                size += len(chunk)
                if size > limit:
                    raise HTTPException(
                        status.HTTP_413_CONTENT_TOO_LARGE,
                        f"Tệp quá lớn (tối đa {limit // (1024 * 1024)} MB cho "
                        f"{'video' if kind.kind == 'video' else 'ảnh'})",
                    )
                out.write(chunk)
                chunk = upload.file.read(_CHUNK)
        os.replace(partial, target)
    finally:
        partial.unlink(missing_ok=True)

    row = MediaFile(
        id=media_id,
        owner_id=owner.id,
        kind=kind.kind,
        content_type=kind.content_type,
        size_bytes=size,
        original_name=(upload.filename or None) and upload.filename[:200],
        path=relative,
        is_public=public,
    )
    db.add(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        target.unlink(missing_ok=True)
        raise
    db.refresh(row)
    return row, True


def can_view(row: MediaFile, user: User | None) -> bool:
    if row.is_deleted:
        return False
    if row.is_public:
        return True
    if user is None:
        return False
    return user.role is UserRole.ADMIN or row.owner_id == user.id


def file_path(row: MediaFile) -> Path:
    return media_root() / row.path


def delete_file(db: Session, row: MediaFile) -> None:
    row.is_deleted = True
    file_path(row).unlink(missing_ok=True)
    db.commit()


# ------------------------------ media refs -------------------------------


def parse_refs(raw: str | None) -> list[dict[str, Any]]:
    """The media list of a synced row. A malformed value reads as empty —
    one bad row must not take a whole screen down."""
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(value, list):
        return []
    return [ref for ref in value if isinstance(ref, dict) and isinstance(ref.get("id"), str)]


def ref_for(row: MediaFile) -> dict[str, Any]:
    return {"id": row.id, "kind": row.kind, "mime": row.content_type, "uploaded": True}


def append_ref(raw: str | None, row: MediaFile) -> str:
    refs = [ref for ref in parse_refs(raw) if ref["id"] != row.id]
    refs.append(ref_for(row))
    return json.dumps(refs, ensure_ascii=False)


def with_urls(refs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Refs as REST returns them: plus the path to fetch each one from."""
    return [{**ref, "url": f"/media/{ref['id']}"} for ref in refs]
