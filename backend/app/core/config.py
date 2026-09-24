"""Application settings, loaded from environment / .env file."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent
SHARED_DATA_DIR = REPO_ROOT / "shared" / "data"


class Settings(BaseSettings):
    """Every value is overridable through the environment — nothing is hard-coded."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AgriLog v2 API"
    app_version: str = "0.1.0"
    debug: bool = True

    # "development" | "staging" | "production". Production refuses to start on
    # the dev secret key — see app/main.py::_guard_production.
    environment: str = "development"
    log_level: str = "INFO"

    # SQLite for local development; swap to PostgreSQL by changing this one value.
    database_url: str = f"sqlite:///{BACKEND_DIR / 'agrilog.db'}"

    # Connection pool (PostgreSQL only — SQLite ignores these).
    # 100 concurrent farmers do not need 100 connections: each request holds one
    # for a few milliseconds, so pool_size + max_overflow = 30 is ample and stays
    # well under the default PostgreSQL limit of 100.
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    # Recycle before a cloud provider's idle-connection cut (usually 5-10 min).
    db_pool_recycle: int = 280

    secret_key: str = "dev-only-insecure-key-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Anything slower than this is logged as a slow request (ms).
    slow_request_ms: int = 1000

    # Brute-force guard on POST /auth/login. Only *failed* attempts count, so a
    # phone that logs in normally is never throttled. 0 disables the limiter.
    login_max_failures: int = 5
    login_failure_window_seconds: int = 60
    login_lockout_seconds: int = 60

    # Photos and videos farmers attach to task notes and harvests, plus the
    # images of care guides. On a container this MUST be a mounted volume —
    # see docs/BACKEND_DEPLOYMENT.md — or every upload vanishes on redeploy.
    media_dir: str = str(BACKEND_DIR / "media")
    media_max_image_mb: int = 10
    # A one-minute phone clip at 720p is 60-100 MB; anything longer is not a
    # field note but a film, and would stall a 3G upload for an hour anyway.
    media_max_video_mb: int = 100
    # Lifetime of the query-string token that lets <img>/<video>/WebView load a
    # private file (they cannot send an Authorization header). Kept short
    # because a URL ends up in history and proxy logs.
    media_token_minutes: int = 360

    seed_admin_username: str = "admin"
    seed_admin_password: str = "admin123"
    seed_farmer_username: str = "thaitaka"
    seed_farmer_password: str = "matkhau123"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgres")

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in {"production", "prod"}



@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
