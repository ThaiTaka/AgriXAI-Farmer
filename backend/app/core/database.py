"""SQLAlchemy engine, session factory and declarative base.

One `DATABASE_URL` switches the whole backend between the SQLite file used in
development and the PostgreSQL instance used in production (Giai đoạn 5,
phương án A). Everything dialect-specific is confined to this module:

* **PostgreSQL** gets a real connection pool. 100 farmers syncing at once do
  not need 100 connections — each request holds one for a few milliseconds —
  so `pool_size + max_overflow` (30 by default) is sized for burst, not for
  headcount, and stays far below PostgreSQL's own limit of 100.
* **SQLite** gets WAL journalling and a busy timeout. Without them a second
  writer fails instantly with "database is locked"; with them readers never
  block writers and a writer waits its turn. This keeps local load tests and
  demo runs honest instead of erroring under the lightest concurrency.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")

if _is_sqlite:
    # check_same_thread is a SQLite-only knob; PostgreSQL rejects it.
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False, "timeout": 30},
        echo=False,
    )
else:
    engine = create_engine(
        settings.database_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        # Drops connections a cloud provider has silently closed, instead of
        # handing a dead one to a request.
        pool_pre_ping=True,
        pool_recycle=settings.db_pool_recycle,
        echo=False,
    )


if _is_sqlite:

    # Bound to *this* engine rather than to the Engine class: scripts create
    # their own engines in the same process (the SQLite -> PostgreSQL migration
    # holds both at once), and a class-wide hook would fire PRAGMA statements at
    # PostgreSQL, which rejects them outright.
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, connection_record) -> None:  # pragma: no cover - driver hook
        """WAL + busy timeout, applied to SQLite connections only."""
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
