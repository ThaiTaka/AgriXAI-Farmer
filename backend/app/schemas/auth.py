"""Request / response bodies for the auth endpoints."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str | None = None
    full_name: str
    phone: str | None = None
    region: str | None = None
    role: UserRole
    is_active: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    region: str | None = Field(default=None, max_length=128)


class UserCreate(BaseModel):
    """Admin tạo tài khoản nông hộ mới — password được hash phía backend."""

    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    region: str | None = Field(default=None, max_length=128)
    role: UserRole = UserRole.FARMER


class UserStatusUpdate(BaseModel):
    """Admin khoá hoặc mở khoá tài khoản nông hộ."""

    is_active: bool


class PasswordChange(BaseModel):
    """Đổi mật khẩu — người dùng phải xác nhận mật khẩu cũ trước."""

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=6, max_length=128)
