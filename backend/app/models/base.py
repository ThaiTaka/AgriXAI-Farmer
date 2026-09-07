"""Shared column mixins.

`created_at` / `updated_at` are epoch milliseconds (integers) rather than SQL
timestamps because WatermelonDB's sync protocol compares millisecond integers.
Keeping one representation on both sides removes a whole class of timezone and
rounding bugs in the two-way sync (Muc 9).
"""

import time

from sqlalchemy import BigInteger, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column


def now_ms() -> int:
    return int(time.time() * 1000)


class TimestampMixin:
    created_at: Mapped[int] = mapped_column(BigInteger, default=now_ms, nullable=False)
    updated_at: Mapped[int] = mapped_column(
        BigInteger, default=now_ms, onupdate=now_ms, nullable=False, index=True
    )


class SyncMixin(TimestampMixin):
    """Columns every table involved in the mobile <-> server sync needs.

    `id` is the WatermelonDB record id (a client-generated string), so a record
    created offline keeps the same identity after it reaches the server.
    `deleted_at` implements soft delete: pullChanges must be able to report
    deletions, which a hard DELETE cannot express.
    """

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    deleted_at: Mapped[int | None] = mapped_column(BigInteger, default=None, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
