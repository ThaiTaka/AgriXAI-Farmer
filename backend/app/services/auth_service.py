"""Authentication helpers shared by the auth router and future admin routers."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token, verify_password
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)

INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Tên đăng nhập hoặc mật khẩu không đúng",
)


def authenticate(db: Session, username: str, password: str) -> User:
    # The login form has one field: match it against either identifier so a
    # farmer can type whichever they remember.
    user = db.scalar(
        select(User).where(
            or_(User.username == username, User.email == username),
            User.is_deleted.is_(False),
        )
    )
    if user is None or not verify_password(password, user.password_hash):
        raise INVALID_CREDENTIALS
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị khoá. Liên hệ quản trị viên.",
        )
    return user


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thiếu token xác thực",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(credentials.credentials)
    except PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = db.get(User, payload.get("sub"))
    if user is None or user.is_deleted or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Tài khoản không còn hiệu lực"
        )
    return user


def current_admin(user: User = Depends(current_user)) -> User:
    if user.role is not UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ quản trị viên mới truy cập được"
        )
    return user
