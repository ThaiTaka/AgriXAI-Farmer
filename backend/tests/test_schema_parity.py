"""The mobile SQLite schema and the server tables must describe the same rows.

The sync protocol copies column names verbatim in both directions, so a column
that exists on one side and not the other silently drops data. This test reads
mobile/src/db/schema.ts directly rather than a duplicated list, so it cannot go
stale.
"""

import re
from pathlib import Path

import pytest

from app.services.sync_service import SYNC_MODELS

SCHEMA_TS = Path(__file__).resolve().parents[2] / "mobile" / "src" / "db" / "schema.ts"

# Columns each side owns that the other legitimately does not have.
SERVER_ONLY = {"deleted_at", "is_deleted"}
MOBILE_ONLY: set[str] = set()


def parse_mobile_schema() -> dict[str, set[str]]:
    source = SCHEMA_TS.read_text(encoding="utf-8")
    tables: dict[str, set[str]] = {}
    for block in re.finditer(
        r"tableSchema\(\{\s*name:\s*'([a-z_]+)',\s*columns:\s*\[(.*?)\],\s*\}\)",
        source,
        re.DOTALL,
    ):
        name = block.group(1)
        columns = set(re.findall(r"\{name:\s*'([a-z_0-9]+)'", block.group(2)))
        # WatermelonDB always provides `id` implicitly.
        columns.add("id")
        tables[name] = columns
    return tables


MOBILE_TABLES = parse_mobile_schema()


def test_mobile_schema_parsed():
    assert MOBILE_TABLES, f"could not parse {SCHEMA_TS}"
    assert set(MOBILE_TABLES) == set(SYNC_MODELS), (
        f"tables differ: mobile={sorted(MOBILE_TABLES)} server={sorted(SYNC_MODELS)}"
    )


@pytest.mark.parametrize("table", sorted(SYNC_MODELS))
def test_columns_match(table: str):
    model, _ = SYNC_MODELS[table]
    server = {c.name for c in model.__table__.columns} - SERVER_ONLY
    mobile = MOBILE_TABLES[table] - MOBILE_ONLY

    missing_on_server = mobile - server
    missing_on_mobile = server - mobile

    assert not missing_on_server, f"{table}: mobile has columns the server lacks: {sorted(missing_on_server)}"
    assert not missing_on_mobile, f"{table}: server has columns mobile lacks: {sorted(missing_on_mobile)}"
