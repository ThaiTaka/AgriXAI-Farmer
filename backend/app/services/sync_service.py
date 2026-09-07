"""Two-way sync between the mobile SQLite database and the server.

Implements the WatermelonDB sync protocol (Mục 9):

    pull  GET  /sync?last_pulled_at=<ms>
          -> {"changes": {table: {created, updated, deleted}}, "timestamp": <ms>}
    push  POST /sync?last_pulled_at=<ms>
          <- {table: {created, updated, deleted}}

Conflict strategy: **last write wins, compared on `updated_at`**.

Chosen because every row here has exactly one natural author — the farmer who
owns the plot. Two devices editing the same plot within the same sync window is
rare, and when it happens the later edit is the one the farmer made last and
therefore meant. Field-level merging would be more clever but also unpredictable
for the user ("I set the area to 1200 and it shows 800 with my new name"), and
the audit trail in `change_logs` already preserves what the losing side wrote,
so nothing is actually lost.

Deletes always win over concurrent updates: an undeleted row reappearing on the
farmer's phone is more confusing than a deletion they can redo.
"""

import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.farm import ChangeLog, CropCycle, CropVariety, Diagnosis, Plot
from app.models.user import User

# Table name -> (model, is_owned). Owned tables are filtered to the caller;
# crop_varieties is a shared catalogue so every farmer sees every variety.
SYNC_MODELS: dict[str, tuple[type, bool]] = {
    "plots": (Plot, True),
    "crop_varieties": (CropVariety, False),
    "diagnoses": (Diagnosis, True),
    "crop_cycles": (CropCycle, True),
    "change_logs": (ChangeLog, False),
}

# Columns the client owns. `id`, `created_at` and `updated_at` are handled
# separately; everything else is copied straight across.
_SKIP_ON_WRITE = {"id", "created_at", "updated_at", "deleted_at", "is_deleted"}


def now_ms() -> int:
    return int(time.time() * 1000)


def _columns(model: type) -> list[str]:
    return [c.name for c in model.__table__.columns]


def _serialise(row: Any, model: type) -> dict[str, Any]:
    """Row -> the flat dict shape WatermelonDB expects."""
    out: dict[str, Any] = {}
    for name in _columns(model):
        if name in {"deleted_at", "is_deleted"}:
            continue
        out[name] = getattr(row, name)
    return out


def pull_changes(db: Session, user: User, last_pulled_at: int | None) -> dict[str, Any]:
    timestamp = now_ms()
    changes: dict[str, dict[str, list]] = {}

    for table, (model, owned) in SYNC_MODELS.items():
        stmt = select(model)
        if owned:
            stmt = stmt.where(model.owner_id == user.id)

        created: list[dict] = []
        updated: list[dict] = []
        deleted: list[str] = []

        if last_pulled_at is None:
            # First sync: everything alive, all as "created".
            for row in db.scalars(stmt.where(model.is_deleted.is_(False))):
                created.append(_serialise(row, model))
        else:
            for row in db.scalars(stmt.where(model.updated_at > last_pulled_at)):
                if row.is_deleted:
                    deleted.append(row.id)
                elif row.created_at > last_pulled_at:
                    created.append(_serialise(row, model))
                else:
                    updated.append(_serialise(row, model))

        changes[table] = {"created": created, "updated": updated, "deleted": deleted}

    return {"changes": changes, "timestamp": timestamp}


def push_changes(
    db: Session,
    user: User,
    changes: dict[str, dict[str, list]],
) -> dict[str, Any]:
    """Applies a batch of client changes. Returns per-table counters for the log."""
    applied = {"created": 0, "updated": 0, "deleted": 0, "conflicts": 0}
    stamp = now_ms()

    for table, (model, owned) in SYNC_MODELS.items():
        table_changes = changes.get(table) or {}

        for raw in table_changes.get("created", []) or []:
            record_id = raw.get("id")
            if not record_id:
                continue
            existing = db.get(model, record_id)
            if existing is not None:
                # The client thinks it created this row but the server already
                # has it — a retry after a dropped response. Treat it as an
                # update so the retry is idempotent rather than a 500.
                if _apply_if_newer(existing, raw, model, stamp):
                    applied["updated"] += 1
                else:
                    applied["conflicts"] += 1
                continue
            db.add(_build(model, raw, user, owned, stamp))
            applied["created"] += 1

        for raw in table_changes.get("updated", []) or []:
            record_id = raw.get("id")
            if not record_id:
                continue
            existing = db.get(model, record_id)
            if existing is None:
                db.add(_build(model, raw, user, owned, stamp))
                applied["created"] += 1
                continue
            if _apply_if_newer(existing, raw, model, stamp):
                applied["updated"] += 1
            else:
                applied["conflicts"] += 1

        for record_id in table_changes.get("deleted", []) or []:
            existing = db.get(model, record_id)
            if existing is None or existing.is_deleted:
                continue
            existing.is_deleted = True
            existing.deleted_at = stamp
            existing.updated_at = stamp
            applied["deleted"] += 1

    db.commit()
    return applied


def _build(model: type, raw: dict, user: User, owned: bool, stamp: int):
    values = {
        key: value
        for key, value in raw.items()
        if key in set(_columns(model)) and key not in _SKIP_ON_WRITE
    }
    values["id"] = raw["id"]
    values["created_at"] = raw.get("created_at") or stamp
    values["updated_at"] = raw.get("updated_at") or stamp
    if owned:
        # Never trust a client-supplied owner: a phone must not be able to file
        # records under someone else's account.
        values["owner_id"] = user.id
    return model(**values)


def _apply_if_newer(existing: Any, raw: dict, model: type, stamp: int) -> bool:
    """Last-write-wins. Returns False when the server copy is newer (conflict)."""
    incoming_updated = raw.get("updated_at") or stamp
    if existing.updated_at is not None and existing.updated_at > incoming_updated:
        return False

    for key, value in raw.items():
        if key in _SKIP_ON_WRITE or key not in set(_columns(model)):
            continue
        if key == "owner_id":
            continue
        setattr(existing, key, value)
    existing.updated_at = max(incoming_updated, stamp)
    return True
