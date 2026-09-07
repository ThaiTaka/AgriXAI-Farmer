"""Test fixtures.

Tests get their own SQLite file. Sharing the development database meant pytest
rows ("Sửa bởi máy B", created_at=1000) turned up in the running app — confusing
at best, and it made test runs depend on whatever state the app had left behind.
"""

import os
import tempfile
from pathlib import Path

TEST_DB = Path(tempfile.gettempdir()) / "agrilog_test.db"

# Must be set before app.core.config is imported anywhere.
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ.setdefault("SECRET_KEY", "test-only-key")

if TEST_DB.exists():
    TEST_DB.unlink()
