"""AgriLog v2 API entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine
from app.core.schema_upgrade import upgrade
from app.routers import auth, health, ledger, ops, plots, sync


@asynccontextmanager
async def lifespan(_: FastAPI):
    # create_all + additive column upgrades keep a freshly cloned repo (and a
    # dev database from an earlier version) runnable with a single command.
    # See app/core/schema_upgrade.py.
    upgrade(engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="API cho ứng dụng nông hộ AgriLog v2 (mobile) và trang quản trị (web-admin).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # The web dashboard reads the PDF file name from this header.
    expose_headers=["Content-Disposition"],
)

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


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"app": settings.app_name, "version": settings.app_version, "docs": "/docs"}
