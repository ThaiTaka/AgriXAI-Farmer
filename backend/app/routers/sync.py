"""WatermelonDB sync endpoints."""

import json
import logging
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.services.auth_service import current_user
from app.services.sync_service import (
    CONFLICT_STRATEGY,
    SyncPayloadError,
    pull_changes,
    push_changes,
)

logger = logging.getLogger("agrilog.sync")

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("")
def pull(
    last_pulled_at: int | None = Query(default=None, alias="last_pulled_at"),
    schema_version: int | None = Query(default=None, alias="schema_version"),
    migration: str | None = Query(default=None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        migration_info = json.loads(migration) if migration else None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Tham số migration không phải JSON") from exc
    if migration_info is not None and not isinstance(migration_info, dict):
        raise HTTPException(status_code=422, detail="Tham số migration không hợp lệ")
    result = pull_changes(db, user, last_pulled_at, migration_info)
    counts = {
        table: {kind: len(rows) for kind, rows in table_changes.items()}
        for table, table_changes in result["changes"].items()
    }
    logger.debug(
        "pull user=%s last_pulled_at=%s schema=%s migration=%s counts=%s",
        user.username,
        last_pulled_at,
        schema_version,
        migration_info,
        counts,
    )
    return result


@router.post("")
def push(
    response: Response,
    changes: dict[str, dict[str, list]] = Body(...),
    last_pulled_at: int | None = Query(default=None, alias="last_pulled_at"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Applies a batch of client changes as one transaction.

    A batch either lands whole or not at all (422 + nothing written), so a phone
    that lost signal half-way through can resend exactly what it sent before.
    """
    try:
        applied = push_changes(db, user, changes)
    except SyncPayloadError as exc:
        # 422, not 500: the batch is the client's to fix, and nothing was
        # written, so resending a corrected batch is safe.
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    conflicts = applied.pop("conflict_rows", [])
    rejected = applied.pop("rejected_rows", [])

    # Makes the strategy visible to anyone reading a response or a proxy log,
    # rather than buried in a service docstring.
    response.headers["X-Conflict-Resolution"] = CONFLICT_STRATEGY

    if conflicts or rejected:
        logger.warning(
            "push user=%s conflicts=%d rejected=%d applied=%s",
            user.username,
            len(conflicts),
            len(rejected),
            applied,
        )
    else:
        logger.debug(
            "push user=%s last_pulled_at=%s applied=%s", user.username, last_pulled_at, applied
        )

    # `conflicts` carries the server copy of every row the server kept, so the
    # phone can offer "giữ bản của tôi / lấy bản mới" instead of diverging
    # silently. `rejected` carries rows the server refused outright (today:
    # a farmer trying to create a plot) with a reason the app can show.
    return {"ok": True, "applied": applied, "conflicts": conflicts, "rejected": rejected}
