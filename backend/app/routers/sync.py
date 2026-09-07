"""WatermelonDB sync endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.services.auth_service import current_user
from app.services.sync_service import pull_changes, push_changes

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
    result = pull_changes(db, user, last_pulled_at)
    counts = {
        table: {kind: len(rows) for kind, rows in table_changes.items()}
        for table, table_changes in result["changes"].items()
    }
    logger.debug(
        "pull user=%s last_pulled_at=%s schema=%s counts=%s",
        user.username,
        last_pulled_at,
        schema_version,
        counts,
    )
    return result


@router.post("")
def push(
    changes: dict[str, dict[str, list]] = Body(...),
    last_pulled_at: int | None = Query(default=None, alias="last_pulled_at"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    applied = push_changes(db, user, changes)
    logger.debug("push user=%s last_pulled_at=%s applied=%s", user.username, last_pulled_at, applied)
    return {"ok": True, "applied": applied}
