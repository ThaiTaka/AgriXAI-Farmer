"""Chặn dò mật khẩu ở `POST /auth/login`.

Mật khẩu của nông hộ thường ngắn và dễ đoán. Không có giới hạn thì một script
thử vài nghìn mật khẩu mỗi phút là chuyện bình thường; có giới hạn thì kẻ dò
chỉ còn 5 lần/phút — chậm tới mức vô nghĩa.

Điều kiện quan trọng không kém: **chỉ lần sai mới bị đếm**. Điện thoại của nông
hộ đăng nhập lại sau mỗi lần cài app, sau mỗi lần token hết hạn; nếu lần đúng
cũng bị đếm thì chính người dùng thật sẽ là người bị khoá.
"""

import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.core.config import settings
from app.main import app
from app.seed import run as run_seed

run_seed()
client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_counters():
    """Mỗi test bắt đầu với bộ đếm trắng, và không để lại dấu cho test sau."""
    rate_limit.clear_all()
    yield
    rate_limit.clear_all()


def wrong_password(username: str = settings.seed_farmer_username):
    return client.post("/auth/login", json={"username": username, "password": "sai-mat-khau"})


def right_password(username: str = settings.seed_farmer_username):
    return client.post(
        "/auth/login",
        json={"username": username, "password": settings.seed_farmer_password},
    )


def test_five_wrong_passwords_then_the_door_closes():
    for attempt in range(settings.login_max_failures):
        assert wrong_password().status_code == 401, f"lần thứ {attempt + 1} phải là 401"

    blocked = wrong_password()
    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"].isdigit()


def test_a_locked_out_caller_cannot_slip_through_with_the_right_password():
    """Khoá là khoá: đoán trúng ở lần thứ sáu cũng không được vào.

    Nếu mật khẩu đúng vẫn qua được thì giới hạn chẳng chặn được gì — kẻ dò chỉ
    cần thử tiếp là xong."""
    for _ in range(settings.login_max_failures):
        wrong_password()

    assert right_password().status_code == 429


def test_signing_in_correctly_is_never_throttled():
    for _ in range(settings.login_max_failures * 3):
        assert right_password().status_code == 200


def test_a_correct_password_clears_the_tally():
    for _ in range(settings.login_max_failures - 1):
        wrong_password()

    assert right_password().status_code == 200

    # Bộ đếm đã về 0, nên vẫn còn đủ số lần cho người gõ nhầm tiếp.
    for _ in range(settings.login_max_failures):
        assert wrong_password().status_code == 401


def test_one_account_being_guessed_does_not_lock_out_another():
    """Cả xóm dùng chung một mạng wifi. Người bị khoá phải là tài khoản đang bị
    dò, không phải người hàng xóm đăng nhập cùng lúc từ cùng địa chỉ IP."""
    for _ in range(settings.login_max_failures + 1):
        wrong_password(settings.seed_admin_username)

    assert wrong_password(settings.seed_admin_username).status_code == 429
    assert right_password().status_code == 200
