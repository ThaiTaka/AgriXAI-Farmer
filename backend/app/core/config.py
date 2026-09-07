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

    # SQLite for local development; swap to PostgreSQL by changing this one value.
    database_url: str = f"sqlite:///{BACKEND_DIR / 'agrilog.db'}"

    secret_key: str = "dev-only-insecure-key-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    upload_dir: Path = BACKEND_DIR / "uploads"

    # Empty => DummyPredictor. Set to a checkpoint path to use a real model.
    model_checkpoint: str = ""

    seed_admin_username: str = "admin"
    seed_admin_password: str = "admin123"
    seed_farmer_username: str = "quanghoc"
    seed_farmer_password: str = "matkhau123"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def model_status(self) -> str:
        return "real" if self.model_checkpoint else "dummy"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
