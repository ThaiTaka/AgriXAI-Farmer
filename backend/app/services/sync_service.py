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

A push that loses a race is not silent: the response lists every rejected row
together with the server's current copy, so the phone can ask the farmer
"giữ bản của tôi hay lấy bản mới?" instead of quietly diverging (Giai đoạn 4).

Permissions: a push is a write path like any other, so the rules that guard the
REST endpoints are repeated here — otherwise a phone could sync around them:

  * a farmer cannot create a plot (land is assigned by management — see
    POST /plots);
  * no client can set the admin-controlled fields on a crop variety;
  * care guides are written by admins only, in any direction;
  * a row can only be changed or deleted by whoever owns it. Until V2.1 an
    update or delete was applied to any id the phone named, so one farm could
    overwrite or delete another's plot just by knowing its id — and the demo
    ids are guessable. Admins keep the right to correct any farm's rows.

A rejected row comes back in `rejected_rows` with a reason; nothing is dropped
in silence.

A push is one transaction. A batch that fails half-way leaves the database
exactly as it was, so a phone that lost signal mid-push can resend the same
batch without wondering which half arrived.
"""

import logging
import time
from functools import lru_cache
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.farm import CareGuide, ChangeLog, CropCycle, CropVariety, Plot
from app.models.ledger import Expense, Income, Plan, TaskHistory, TaskNote, WarehouseIn, WarehouseOut
from app.models.user import User, UserRole

logger = logging.getLogger("agrilog.sync")

# Advertised to the client in the X-Conflict-Resolution response header.
CONFLICT_STRATEGY = "last-write-wins-logged"

# Table name -> (model, owner column). The owner column is what scopes a table
# to one account, both when pulling (only your rows come down) and when pushing
# (the server, never the client, decides whose row it is).
#
# `None` means genuinely shared: crop_varieties is a catalogue every farm reads,
# which is the whole point of letting one farmer's variety help the next.
#
# change_logs is scoped by `changed_by` rather than `owner_id` — it has no owner
# column, the author *is* the owner. Treating it as shared, as this map did
# until Giai đoạn 5, sent every farm's audit trail ("Nguyễn Văn Anh sửa diện
# tích 800 -> 1200") to every other farmer's phone, and made each sync payload
# grow with the whole system's history instead of one farm's.
SYNC_MODELS: dict[str, tuple[type, str | None]] = {
    "plots": (Plot, "owner_id"),
    "crop_varieties": (CropVariety, None),
    "crop_cycles": (CropCycle, "owner_id"),
    "change_logs": (ChangeLog, "changed_by"),
    # Giai đoạn 3 ledgers — every row belongs to the farmer who wrote it.
    "plans": (Plan, "owner_id"),
    "warehouse_in": (WarehouseIn, "owner_id"),
    "warehouse_out": (WarehouseOut, "owner_id"),
    "income": (Income, "owner_id"),
    "expense": (Expense, "owner_id"),
    "tasks_history": (TaskHistory, "owner_id"),
    # V2.1 — notes and photos of how a task was done, per farm.
    "task_notes": (TaskNote, "owner_id"),
    # V2.1 — admin-written how-tos every farm reads (see _ADMIN_ONLY_WRITE).
    "care_guides": (CareGuide, None),
}

# Columns the client owns. `id`, `created_at` and `updated_at` are handled
# separately; everything else is copied straight across.
_SKIP_ON_WRITE = frozenset({"id", "created_at", "updated_at", "deleted_at", "is_deleted"})

# Fields on crop_varieties that only an admin may set (via PATCH /crop-varieties/{id}/approve).
# A malicious phone client must not be able to self-approve its own variety submission
# by embedding approved=true in a /sync push payload — we strip these silently so
# the rest of the variety data still syncs normally.
_CROP_VARIETY_READONLY = frozenset({"approved", "is_seed", "source"})

# Tables only an administrator may add rows to. A farmer still edits and deletes
# the rows they own — they simply cannot conjure new land into existence.
# Mirrors POST /plots in app/routers/plots.py; without this the phone could sync
# around that rule.
_ADMIN_ONLY_CREATE = {"plots"}

# Tables a non-admin may not touch at all through /sync — they read them, an
# admin writes them in web-admin. Mirrors the admin-only REST endpoints.
_ADMIN_ONLY_WRITE = {"care_guides"}

_REJECT_MESSAGES = {
    "admin_only_create": "Lo dat do quan tri vien tao va giao, ung dung khong tu them duoc.",
    "admin_only_write": "Chỉ quản trị viên được sửa nội dung này.",
    "not_owner": "Bản ghi này không thuộc tài khoản của bạn.",
}


class SyncPayloadError(ValueError):
    """The batch could not be applied (malformed row, or a value the column
    cannot hold). Nothing was written — the client may fix it and resend."""


def now_ms() -> int:
    return int(time.time() * 1000)


# A model's column list never changes at runtime, but a first sync serialises
# thousands of rows — rebuilding the list per row made the loop spend more time
# walking SQLAlchemy metadata than reading data. Cached once per model instead.
@lru_cache(maxsize=None)
def _columns(model: type) -> tuple[str, ...]:
    return tuple(c.name for c in model.__table__.columns)


@lru_cache(maxsize=None)
def _readable_columns(model: type) -> tuple[str, ...]:
    """What goes out to the phone: soft-delete bookkeeping stays server-side."""
    return tuple(name for name in _columns(model) if name not in {"deleted_at", "is_deleted"})


@lru_cache(maxsize=None)
def _writable_columns(model: type) -> frozenset[str]:
    """What a client may write: every column minus the ones the server owns."""
    extra_skip = _CROP_VARIETY_READONLY if model is CropVariety else frozenset()
    return frozenset(_columns(model)) - _SKIP_ON_WRITE - extra_skip


def _serialise(row: Any, model: type) -> dict[str, Any]:
    """Row -> the flat dict shape WatermelonDB expects."""
    return {name: getattr(row, name) for name in _readable_columns(model)}


def pull_changes(db: Session, user: User, last_pulled_at: int | None) -> dict[str, Any]:
    timestamp = now_ms()
    changes: dict[str, dict[str, list]] = {}

    for table, (model, owner_column) in SYNC_MODELS.items():
        stmt = select(model)
        if owner_column:
            stmt = stmt.where(getattr(model, owner_column) == user.id)

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
    """Applies a batch of client changes.

    Returns per-table counters plus `conflict_rows`: the rows the server kept
    its own version of, each with that version attached.
    """
    applied: dict[str, Any] = {
        "created": 0,
        "updated": 0,
        "deleted": 0,
        "conflicts": 0,
        "rejected": 0,
    }
    conflict_rows: list[dict[str, Any]] = []
    rejected_rows: list[dict[str, Any]] = []
    stamp = now_ms()
    is_admin = user.role is UserRole.ADMIN

    def reject(table: str, record_id: str, reason: str) -> None:
        applied["rejected"] += 1
        rejected_rows.append(_rejected(table, record_id, user, reason))

    for table, (model, owner_column) in SYNC_MODELS.items():
        create_refusal = _create_refusal(table, is_admin)
        table_changes = changes.get(table) or {}

        for raw in table_changes.get("created", []) or []:
            record_id = raw.get("id")
            if not record_id:
                continue
            existing = db.get(model, record_id)
            if existing is not None:
                # The client thinks it created this row but the server already
                # has it — a retry after a dropped response. Treat it as an
                # update so the retry is idempotent rather than a 500. Same
                # ownership rule as any update: a "create" naming someone
                # else's id must not become a way to overwrite their row.
                refusal = _modify_refusal(table, existing, owner_column, user, is_admin)
                if refusal:
                    reject(table, record_id, refusal)
                elif _apply_if_newer(existing, raw, model, stamp, owner_column):
                    applied["updated"] += 1
                else:
                    applied["conflicts"] += 1
                    conflict_rows.append(_conflict(table, existing, model, user))
                continue
            if create_refusal:
                reject(table, record_id, create_refusal)
                continue
            db.add(_build(model, raw, user, owner_column, stamp))
            applied["created"] += 1

        for raw in table_changes.get("updated", []) or []:
            record_id = raw.get("id")
            if not record_id:
                continue
            existing = db.get(model, record_id)
            if existing is None:
                # An update to a row the server has never seen is a create: the
                # phone made it offline and the create leg of the batch was
                # lost. Same permission rule applies.
                if create_refusal:
                    reject(table, record_id, create_refusal)
                    continue
                db.add(_build(model, raw, user, owner_column, stamp))
                applied["created"] += 1
                continue
            refusal = _modify_refusal(table, existing, owner_column, user, is_admin)
            if refusal:
                reject(table, record_id, refusal)
            elif _apply_if_newer(existing, raw, model, stamp, owner_column):
                applied["updated"] += 1
            else:
                applied["conflicts"] += 1
                conflict_rows.append(_conflict(table, existing, model, user))

        for record_id in table_changes.get("deleted", []) or []:
            existing = db.get(model, record_id)
            if existing is None or existing.is_deleted:
                continue
            refusal = _modify_refusal(table, existing, owner_column, user, is_admin)
            if refusal:
                reject(table, record_id, refusal)
                continue
            existing.is_deleted = True
            existing.deleted_at = stamp
            existing.updated_at = stamp
            applied["deleted"] += 1

    try:
        db.commit()
    except SQLAlchemyError as exc:
        # All-or-nothing: a half-applied batch is worse than a failed one,
        # because the phone would have no way to tell which half landed.
        db.rollback()
        logger.warning("push failed user=%s error=%s", user.username, exc.__class__.__name__)
        raise SyncPayloadError("Không ghi được dữ liệu đồng bộ") from exc

    applied["conflict_rows"] = conflict_rows
    applied["rejected_rows"] = rejected_rows
    return applied


def _conflict(table: str, existing: Any, model: type, user: User) -> dict[str, Any]:
    # Every conflict means an edit a farmer made did not land, so it is logged
    # at WARNING — this is the line to grep when someone reports
    # "tôi sửa rồi mà nó không đổi".
    logger.warning(
        "sync conflict table=%s id=%s user=%s server_updated_at=%s strategy=%s",
        table,
        existing.id,
        user.username,
        existing.updated_at,
        CONFLICT_STRATEGY,
    )
    return {
        "table": table,
        "id": existing.id,
        "server_updated_at": existing.updated_at,
        "server_updated_by": getattr(existing, "updated_by", None),
        "server": _serialise(existing, model),
    }


def _create_refusal(table: str, is_admin: bool) -> str | None:
    """Why this caller may not add rows to `table`, or None if they may."""
    if is_admin:
        return None
    if table in _ADMIN_ONLY_WRITE:
        return "admin_only_write"
    if table in _ADMIN_ONLY_CREATE:
        return "admin_only_create"
    return None


def _modify_refusal(
    table: str, existing: Any, owner_column: str | None, user: User, is_admin: bool
) -> str | None:
    """Why this caller may not change or delete `existing`, or None if they may.

    Owned tables: only the owner. The shared variety catalogue: only the farmer
    who proposed the variety (seeded ones have no author, so no farmer can edit
    them). Admins may correct anything.
    """
    if is_admin:
        return None
    if table in _ADMIN_ONLY_WRITE:
        return "admin_only_write"
    author = getattr(existing, owner_column) if owner_column else getattr(existing, "created_by", None)
    return None if author == user.id else "not_owner"


def _rejected(table: str, record_id: str, user: User, reason: str) -> dict[str, Any]:
    logger.warning(
        "sync rejected table=%s id=%s user=%s reason=%s",
        table,
        record_id,
        user.username,
        reason,
    )
    return {
        "table": table,
        "id": record_id,
        "reason": reason,
        "message": _REJECT_MESSAGES[reason],
    }


def _build(model: type, raw: dict, user: User, owner_column: str | None, stamp: int):
    writable = _writable_columns(model)
    values = {key: value for key, value in raw.items() if key in writable}
    values["id"] = raw["id"]
    values["created_at"] = raw.get("created_at") or stamp
    values["updated_at"] = raw.get("updated_at") or stamp
    if owner_column:
        # Never trust a client-supplied owner: a phone must not be able to file
        # records under someone else's account.
        values[owner_column] = user.id
    try:
        return model(**values)
    except TypeError as exc:  # a payload shape the model cannot take
        raise SyncPayloadError(f"Ban ghi {raw.get('id')} khong hop le") from exc


def _apply_if_newer(
    existing: Any, raw: dict, model: type, stamp: int, owner_column: str | None = None
) -> bool:
    """Last-write-wins. Returns False when the server copy is newer (conflict)."""
    incoming_updated = raw.get("updated_at") or stamp
    if existing.updated_at is not None and existing.updated_at > incoming_updated:
        return False

    # Anything outside this set belongs to the server: ids, timestamps, and the
    # admin-controlled fields on crop_varieties. Silently ignored rather than
    # rejected, so the rest of the row still syncs.
    writable = _writable_columns(model)
    for key, value in raw.items():
        if key not in writable:
            continue
        if owner_column and key == owner_column:
            continue  # authorship is the server's to decide, not the client's
        setattr(existing, key, value)
    existing.updated_at = max(incoming_updated, stamp)
    return True
