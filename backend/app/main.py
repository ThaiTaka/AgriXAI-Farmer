"""AgriLog v2 API entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import auth, diagnoses, health, plots, sync


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Alembic owns schema migrations from Giai doan 1 onwards; create_all keeps
    # a freshly cloned repo runnable with a single command today.
    Base.metadata.create_all(bind=engine)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
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
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(plots.plots_router)
app.include_router(plots.varieties_router)
app.include_router(diagnoses.router)
app.include_router(diagnoses.diseases_router)
app.include_router(sync.router)


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"app": settings.app_name, "version": settings.app_version, "docs": "/docs"}
