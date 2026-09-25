"""AgriLog v2 API entrypoint."""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine
from app.core.schema_upgrade import upgrade
from app.routers import (
    auth,
    care_guides,
    cultivation,
    fertilizer_prices,
    health,
    ledger,
    media,
    ops,
    plots,
    sync,
    task_records,
)

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
)
logger = logging.getLogger("agrilog")

DEV_SECRET_KEY = "dev-only-insecure-key-change-me"

TAGS_METADATA = [
    {"name": "auth", "description": "Đăng nhập, hồ sơ, đổi mật khẩu."},
    {"name": "sync", "description": "Đồng bộ hai chiều với WatermelonDB trên điện thoại."},
    {"name": "plots", "description": "Lô đất. Quản trị viên tạo và giao; nông hộ xem và sửa lô của mình."},
    {"name": "crop-varieties", "description": "Danh mục giống cây — nông hộ đề xuất, quản trị viên duyệt."},
    {"name": "plans", "description": "Kế hoạch bón phân đã lưu (F1)."},
    {"name": "warehouse", "description": "Kho phân bón: nhập, xuất, tồn, đối chiếu."},
    {"name": "finance", "description": "Thu, chi và báo cáo (JSON, CSV, PDF)."},
    {"name": "care-protocols", "description": "Quy trình chăm sóc, lịch sử công việc, ghi chú kèm ảnh/video và tiền công."},
    {"name": "cultivation", "description": "Lịch sử trồng trọt của lô, gợi ý cây theo năng suất, chi phí của lô."},
    {"name": "care-guides", "description": "Hướng dẫn chăm sóc có video YouTube nhúng và ảnh từng bước — quản trị viên soạn."},
    {"name": "media", "description": "Ảnh và video: tải lên, xem, xoá."},
    {"name": "dashboard", "description": "Số liệu tổng hợp cho màn hình chính."},
    {"name": "ops", "description": "Nhật ký lỗi từ điện thoại và quản lý tài khoản."},
    {"name": "health", "description": "Kiểm tra tình trạng dịch vụ và kết nối cơ sở dữ liệu."},
]


def guard_production() -> None:
    """Refuses to start a production process that is not actually safe.

    Every one of these is a mistake that is silent until it is expensive: the
    demo secret key signs tokens anyone can forge, and a SQLite file on a
    container's disk disappears with the container. Failing at start-up turns
    each into a deploy that does not happen.
    """
    if not settings.is_production:
        return

    problems: list[str] = []
    if settings.secret_key == DEV_SECRET_KEY:
        problems.append(
            "SECRET_KEY vẫn là khoá dev. Sinh khoá mới: "
            'python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
    if settings.database_url.startswith("sqlite"):
        problems.append("DATABASE_URL vẫn trỏ vào SQLite — production phải dùng PostgreSQL.")
    if settings.debug:
        problems.append("DEBUG=true trong production.")

    if problems:
        raise RuntimeError(
            "Không thể khởi động ở chế độ production:\n  - " + "\n  - ".join(problems)
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    guard_production()
    # create_all + additive column/index upgrades keep a freshly cloned repo
    # (and a dev database from an earlier version) runnable with a single
    # command. See app/core/schema_upgrade.py.
    added = upgrade(engine)
    if added:
        logger.info("schema upgraded: added %s", ", ".join(added))
    logger.info(
        "started env=%s database=%s", settings.environment, engine.url.render_as_string(hide_password=True)
    )
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "API cho ứng dụng nông hộ AgriLog v2 (mobile) và trang quản trị (web-admin).\n\n"
        "**Xác thực:** đăng nhập ở `POST /auth/login`, rồi gửi `Authorization: Bearer <token>` "
        "cho mọi endpoint khác.\n\n"
        "**Đồng bộ:** `GET /sync` kéo thay đổi, `POST /sync` đẩy thay đổi. "
        "Xung đột giải quyết theo *last write wins* dựa trên `updated_at`, và mọi bản ghi "
        "bị giữ lại đều trả về trong `conflicts` kèm bản của máy chủ."
    ),
    openapi_tags=TAGS_METADATA,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # The web dashboard reads the PDF file name from this header.
    expose_headers=["Content-Disposition", "X-Response-Time-Ms", "X-Conflict-Resolution"],
)


@app.middleware("http")
async def track_response_time(request: Request, call_next):
    """Times every request and names the slow ones.

    The acceptance target is under a second at 100 concurrent farmers, so the
    log has to be able to answer "which endpoint was it?" — a number in a
    header the load test reads, and a WARNING line for anything over the
    threshold so a slow query shows up without a profiler.
    """
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started) * 1000
    response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.1f}"

    if elapsed_ms > settings.slow_request_ms:
        logger.warning(
            "slow request %s %s %.0fms status=%s",
            request.method,
            request.url.path,
            elapsed_ms,
            response.status_code,
        )
    return response


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(plots.plots_router)
app.include_router(plots.varieties_router)
app.include_router(sync.router)
app.include_router(ledger.plans_router)
app.include_router(ledger.warehouse_router)
app.include_router(ledger.income_router)
app.include_router(ledger.expense_router)
app.include_router(ledger.reports_router)
app.include_router(ledger.protocols_router)
app.include_router(ledger.tasks_router)
app.include_router(ops.logs_router)
app.include_router(ops.dashboard_router)
app.include_router(ops.reports_pdf_router)
app.include_router(ops.users_router)
app.include_router(fertilizer_prices.router)
app.include_router(cultivation.router)
app.include_router(task_records.router)
app.include_router(care_guides.router)
app.include_router(media.router)


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"app": settings.app_name, "version": settings.app_version, "docs": "/docs"}
