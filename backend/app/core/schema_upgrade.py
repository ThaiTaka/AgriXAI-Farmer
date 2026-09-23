"""Additive schema upgrades for a database created by an earlier version.

`Base.metadata.create_all` only creates tables that do not exist yet — it never
adds a column to one that does. Until Alembic is wired in, this module closes
that gap for the dev SQLite file and any early PostgreSQL: every column a model
declares but the live table lacks is added with `ALTER TABLE ... ADD COLUMN`.

Only additive changes are made here. Columns a model no longer declares (e.g.
`crop_varieties.fruit` from schema v3) are left in place: they are harmless
and dropping them is a job for a reviewed Alembic migration, not app start-up.

Data fixes that accompany a schema step live in `apply_data_fixes` so both the
API (lifespan) and the seeder (`python -m app.seed`) run the same code.
"""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.schema import CreateIndex

import app.models  # noqa: F401 — importing the package fills Base.metadata
from app.core.database import Base

logger = logging.getLogger("agrilog.schema")


def add_missing_columns(engine: Engine) -> list[str]:
    """Adds every model column missing from its live table. Returns what it added."""
    inspector = inspect(engine)
    added: list[str] = []

    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            live = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in live:
                    continue
                ddl = column.type.compile(dialect=engine.dialect)
                nullable = "" if column.nullable else " NOT NULL"
                default = ""
                if column.default is not None and column.default.is_scalar:
                    default = f" DEFAULT {_literal(column.default.arg, engine)}"
                conn.execute(
                    text(f'ALTER TABLE {table.name} ADD COLUMN "{column.name}" {ddl}{nullable}{default}')
                )
                added.append(f"{table.name}.{column.name}")

    return added


def add_missing_indexes(engine: Engine) -> list[str]:
    """Creates every index the models declare but the live table lacks.

    `create_all` skips a table that already exists, and with it any index added
    to that table later — so a database created before the composite sync
    indexes (app/models/__init__.py) would never get them. Runs on both SQLite
    and PostgreSQL; `IF NOT EXISTS` keeps it a no-op on the second start-up.
    """
    inspector = inspect(engine)
    created: list[str] = []

    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue  # create_all just made it, indexes included
            live = {ix["name"] for ix in inspector.get_indexes(table.name)}
            for index in table.indexes:
                if index.name in live:
                    continue
                conn.execute(CreateIndex(index, if_not_exists=True))
                created.append(index.name)

    if created:
        logger.info("created %d missing index(es): %s", len(created), ", ".join(created))
    return created


def apply_data_fixes(engine: Engine) -> None:
    """One-off data moves that go with a schema step. Idempotent."""
    with engine.begin() as conn:
        # v4: crop ids moved from Vietnamese slugs to catalogue ids. The phone
        # applies the same rename in its own migration, so both sides agree.
        conn.execute(text("UPDATE plots SET crop_type = 'tomato' WHERE crop_type = 'ca_chua'"))
        conn.execute(
            text("UPDATE plots SET crop_name = 'Cà chua' WHERE crop_type = 'tomato' AND crop_name IS NULL")
        )
        conn.execute(text("UPDATE crop_cycles SET crop_type = 'tomato' WHERE crop_type = 'ca_chua'"))
        conn.execute(
            text("UPDATE crop_varieties SET crop_type = 'tomato' WHERE crop_type = 'ca_chua'")
        )
        # A variety a farmer typed in before v4 kept its text in the old columns.
        live = {c["name"] for c in inspect(engine).get_columns("crop_varieties")}
        if "fruit" in live:
            conn.execute(
                text(
                    "UPDATE crop_varieties SET description = fruit "
                    "WHERE description IS NULL AND fruit IS NOT NULL"
                )
            )
        if "note" in live:
            conn.execute(
                text(
                    "UPDATE crop_varieties SET growing_note = note "
                    "WHERE growing_note IS NULL AND note IS NOT NULL"
                )
            )


def upgrade(engine: Engine) -> list[str]:
    Base.metadata.create_all(bind=engine)
    added = add_missing_columns(engine)
    add_missing_indexes(engine)
    apply_data_fixes(engine)
    return added


def _literal(value: object, engine: Engine) -> str:
    if isinstance(value, bool):
        # SQLite stores booleans as 0/1 and has no TRUE keyword before 3.23;
        # PostgreSQL rejects `DEFAULT 1` on a boolean column outright.
        if engine.dialect.name == "sqlite":
            return "1" if value else "0"
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"
