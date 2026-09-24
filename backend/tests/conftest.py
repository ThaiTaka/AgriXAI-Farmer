"""Test fixtures.

Tests get their own SQLite file. Sharing the development database meant pytest
rows ("Sửa bởi máy B", created_at=1000) turned up in the running app — confusing
at best, and it made test runs depend on whatever state the app had left behind.

Set `TEST_DATABASE_URL` to run the same suite against PostgreSQL:

    TEST_DATABASE_URL=postgresql+psycopg://agrilog:agrilog@127.0.0.1:5443/agrilog pytest

That database is **wiped** at the start of the run, exactly as the SQLite file
is — point it at a throwaway database, never at anything with data in it.
"""

import os
import tempfile
from pathlib import Path

TEST_DB = Path(tempfile.gettempdir()) / "agrilog_test.db"

# Must be set before app.core.config is imported anywhere.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{TEST_DB}"
os.environ.setdefault("SECRET_KEY", "test-only-key")
# Uploads land in a throwaway folder, never in backend/media next to real photos.
os.environ["MEDIA_DIR"] = str(Path(tempfile.gettempdir()) / "agrilog_test_media")


def _reset_database() -> None:
    """Starts every run from an empty schema, whichever engine is in use."""
    url = os.environ["DATABASE_URL"]
    if url.startswith("sqlite"):
        if TEST_DB.exists():
            TEST_DB.unlink()
        return

    # PostgreSQL: drop the schema rather than the file. `CASCADE` also removes
    # the indexes and constraints, so the next create_all starts from nothing.
    from sqlalchemy import create_engine, text

    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    engine.dispose()


_reset_database()
