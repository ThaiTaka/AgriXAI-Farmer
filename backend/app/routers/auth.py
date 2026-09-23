"""Login and profile endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, PasswordChange, UserOut, UserUpdate
from app.services.auth_service import authenticate, current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)) -> LoginResponse:
    """Exchanges username (or email) + password for a bearer token.

    Five wrong passwords in a minute from the same caller for the same account
    and the door closes for a minute (429). Only wrong passwords count, so a
    farmer who signs in normally never meets the limiter.
    """
    key = rate_limit.login_key(request, body.username)
    rate_limit.enforce(key)
    try:
        user = authenticate(db, body.username, body.password)
    except HTTPException as exc:
        # A locked account (403) is not a guess; only a wrong password counts.
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            rate_limit.record_failure(key)
        raise

    rate_limit.reset(key)
    token = create_access_token(subject=user.id, extra={"role": user.role.value})
    return LoginResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def read_me(user: User = Depends(current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(
    body: UserUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: PasswordChange,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> None:
    """Đổi mật khẩu — bất kỳ người dùng nào cũng gọi được (farmer lẫn admin).

    Quy tắc bảo mật:
    - Phải xác nhận mật khẩu hiện tại trước khi đặt mật khẩu mới.
    - Không cho phép đặt lại mật khẩu cũ (new == current).
    - Trả 204 No Content khi thành công (không tiết lộ thông tin thừa).
    - Trả 400 nếu mật khẩu hiện tại sai hoặc mật khẩu mới trùng cũ.
    """
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không đúng",
        )
    if verify_password(body.new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới không được trùng mật khẩu hiện tại",
        )
    user.password_hash = hash_password(body.new_password)
    db.commit()

