"""Photo and video files.

    POST   /media          upload (multipart: file, id?, public?)
    POST   /media/token    short-lived token for <img>/<video>/WebView URLs
    GET    /media/{id}     the file — header auth, ?t=<media token>, or none if public
    DELETE /media/{id}     owner or admin

The phone uploads in the background once it is online; the synced row already
names the media id, so nothing waits on this endpoint.
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from jwt import PyJWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import MEDIA_SCOPE, create_media_token, decode_access_token
from app.models.ops import MediaFile
from app.models.user import User, UserRole
from app.schemas.media import MediaOut, MediaTokenOut
from app.services import media_service
from app.services.auth_service import bearer_scheme, current_user

router = APIRouter(prefix="/media", tags=["media"])

NOT_FOUND = "Không tìm thấy ảnh/video"


def media_out(row: MediaFile) -> MediaOut:
    return MediaOut(
        id=row.id,
        kind=row.kind,
        content_type=row.content_type,
        size_bytes=row.size_bytes,
        is_public=row.is_public,
        url=f"/media/{row.id}",
        created_at=row.created_at,
    )


@router.post("", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
def upload_media(
    response: Response,
    file: UploadFile = File(...),
    id: str | None = Form(default=None, description="Mã do điện thoại đặt; gửi lại cùng mã là an toàn"),
    public: bool = Form(default=False, description="Ảnh công khai (hướng dẫn chăm sóc) — chỉ quản trị viên"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> MediaOut:
    """Stores one photo or video. A repeat with the same `id` returns 200 and
    the file already stored, so a phone can retry after a dropped response."""
    if public and user.role is not UserRole.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Chỉ quản trị viên được đăng ảnh công khai")
    row, created = media_service.store_upload(db, user, file, id, public)
    if not created:
        response.status_code = status.HTTP_200_OK
    return media_out(row)


@router.post("/token", response_model=MediaTokenOut)
def media_token(user: User = Depends(current_user)) -> MediaTokenOut:
    """A token for `?t=` on media URLs. It opens /media only — never the API."""
    token, expires_at = create_media_token(user.id)
    return MediaTokenOut(token=token, expires_at=expires_at)


def _viewer(
    db: Session, credentials: HTTPAuthorizationCredentials | None, media_token: str | None
) -> User | None:
    """Who is asking: from the Authorization header (a login token) or from
    `?t=` (a media token). Neither = anonymous, which still sees public files.
    A token that was sent but is bad gets a 401 so the client knows to renew
    it, rather than a 404 it would take for a deleted file."""
    token, scope = None, None
    if credentials is not None:
        token = credentials.credentials
    elif media_token:
        token, scope = media_token, MEDIA_SCOPE
    if token is None:
        return None
    try:
        payload = decode_access_token(token)
    except PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token xem ảnh đã hết hạn") from exc
    if payload.get("scope") != scope:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token không dùng được ở đây")
    user = db.get(User, payload.get("sub"))
    if user is None or user.is_deleted or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tài khoản không còn hiệu lực")
    return user


@router.get("/{media_id}", response_class=FileResponse)
def get_media(
    media_id: str,
    t: str | None = Query(default=None, description="Token từ POST /media/token"),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> FileResponse:
    row = db.get(MediaFile, media_id)
    # Someone else's private file is a 404, not a 403: the id of another
    # farm's photo is not something to confirm.
    if row is None or row.is_deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    viewer = None if row.is_public else _viewer(db, credentials, t)
    if not media_service.can_view(row, viewer):
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    path = media_service.file_path(row)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    # FileResponse answers Range requests, which a <video> needs to seek.
    return FileResponse(
        path,
        media_type=row.content_type,
        headers={
            "Cache-Control": "public, max-age=86400" if row.is_public else "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(media_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> None:
    row = db.get(MediaFile, media_id)
    if row is None or row.is_deleted or not (user.role is UserRole.ADMIN or row.owner_id == user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    media_service.delete_file(db, row)
