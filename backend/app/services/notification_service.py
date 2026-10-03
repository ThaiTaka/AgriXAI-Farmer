"""Writing notifications — by an admin, or by the server on its own.

The server writes two kinds itself:

  * weather warnings, with an id derived from the day and the level
    ("weather-2026-10-05-mua-to"), so refreshing the forecast every half hour
    raises each warning once instead of once per refresh;
  * price changes. An admin updating a price list enters one product at a
    time; one notice per product would bury the farmer's inbox, so changes
    made within PRICE_DIGEST_WINDOW_MS of each other by the same admin are
    folded into a single notice, which is edited rather than repeated (the
    phone shows it as new again, since it changed after it was read).
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationKind, NotificationLevel, NotificationRead
from app.models.user import User, UserRole
from app.services.sync_service import now_ms

logger = logging.getLogger("agrilog.notifications")

PRICE_DIGEST_WINDOW_MS = 30 * 60 * 1000
VN_TZ = timezone(timedelta(hours=7))

EVERY_FARM = "Mọi nông hộ"


def visible_to(user: User):
    """The notifications `user` receives: their own plus every broadcast."""
    return select(Notification).where(
        Notification.is_deleted.is_(False),
        (Notification.owner_id == user.id) | Notification.owner_id.is_(None),
    )


def create(
    db: Session,
    *,
    title: str,
    body: str = "",
    kind: str = NotificationKind.ANNOUNCEMENT,
    level: str = NotificationLevel.INFO,
    owner_id: str | None = None,
    link: str | None = None,
    source_name: str | None = None,
    source_url: str | None = None,
    expires_at: int | None = None,
    author_id: str | None = None,
    notification_id: str | None = None,
) -> Notification:
    row = Notification(
        id=notification_id or str(uuid.uuid4()),
        owner_id=owner_id,
        kind=kind,
        level=level,
        title=title,
        body=body,
        link=link,
        source_name=source_name,
        source_url=source_url,
        expires_at=expires_at,
        created_by=author_id,
        updated_by=author_id,
    )
    db.add(row)
    return row


def ensure(db: Session, notification_id: str, **fields) -> Notification | None:
    """Creates the notification once; a second call with the same id is a no-op.

    Returns the new row, or None when it already existed (alive or retracted —
    an admin who deleted a warning does not want it back on the next refresh).
    """
    if db.get(Notification, notification_id) is not None:
        return None
    row = create(db, notification_id=notification_id, **fields)
    try:
        db.commit()
    except IntegrityError:
        # Another worker raised the same warning a moment earlier.
        db.rollback()
        return None
    return row


def price_changed(
    db: Session,
    admin: User,
    *,
    fertilizer_id: str,
    name: str,
    new_price: float,
    old_price: float | None,
    effective_from: int,
) -> Notification:
    """Records a price change in the admin's open price digest (or opens one).

    Does not commit: it rides in the same transaction as the price row, so a
    price is never announced without being saved, nor saved without notice.
    """
    line = _price_line(name, new_price, old_price, effective_from)
    since = now_ms() - PRICE_DIGEST_WINDOW_MS
    digest = db.scalars(
        select(Notification)
        .where(
            Notification.kind == NotificationKind.PRICE,
            Notification.created_by == admin.id,
            Notification.is_deleted.is_(False),
            Notification.owner_id.is_(None),
            Notification.created_at >= since,
        )
        .order_by(Notification.created_at.desc())
        .limit(1)
    ).first()

    if digest is None:
        return create(
            db,
            kind=NotificationKind.PRICE,
            title=f"Giá {name} mới cập nhật",
            body=line,
            link=f"prices:{fertilizer_id}",
            source_name="Bảng giá do quản trị viên cập nhật",
            author_id=admin.id,
        )

    lines = [existing for existing in digest.body.split("\n") if existing and not existing.startswith(f"{name}:")]
    lines.append(line)
    digest.body = "\n".join(lines)
    digest.title = f"Giá {len(lines)} loại phân bón mới cập nhật" if len(lines) > 1 else f"Giá {name} mới cập nhật"
    digest.link = "prices" if len(lines) > 1 else f"prices:{fertilizer_id}"
    digest.updated_by = admin.id
    return digest


def _price_line(name: str, new_price: float, old_price: float | None, effective_from: int) -> str:
    line = f"{name}: {_vnd(new_price)}/kg"
    if old_price is not None and round(old_price) != round(new_price):
        trend = "tăng" if new_price > old_price else "giảm"
        line += f" ({trend} từ {_vnd(old_price)})"
    if effective_from > now_ms() + 3_600_000:
        # A price entered ahead of time: say when it starts to apply.
        when = datetime.fromtimestamp(effective_from / 1000, VN_TZ)
        line += f", áp dụng từ {when.day:02d}/{when.month:02d}"
    return line


def _vnd(value: float) -> str:
    return f"{round(value):,}".replace(",", ".") + " đ"


def farm_count(db: Session) -> int:
    """How many farms a broadcast reaches: active farmer accounts."""
    return db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == UserRole.FARMER, User.is_active.is_(True), User.is_deleted.is_(False))
    ) or 0


def read_counts(db: Session, ids: list[str]) -> dict[str, int]:
    """Distinct accounts that opened each notification."""
    if not ids:
        return {}
    rows = db.execute(
        select(NotificationRead.notification_id, func.count(func.distinct(NotificationRead.owner_id)))
        .where(NotificationRead.notification_id.in_(ids), NotificationRead.is_deleted.is_(False))
        .group_by(NotificationRead.notification_id)
    )
    return {notification_id: count for notification_id, count in rows}


def read_by(db: Session, user: User, rows: list[Notification]) -> set[str]:
    """The ones `user` has opened since they last changed.

    A notice edited after it was read (a price digest that gained a line)
    counts as unread again — the phone applies the same rule.
    """
    if not rows:
        return set()
    last_read = dict(
        db.execute(
            select(NotificationRead.notification_id, func.max(NotificationRead.read_at))
            .where(
                NotificationRead.owner_id == user.id,
                NotificationRead.notification_id.in_([r.id for r in rows]),
                NotificationRead.is_deleted.is_(False),
            )
            .group_by(NotificationRead.notification_id)
        ).all()
    )
    return {r.id for r in rows if r.id in last_read and last_read[r.id] >= r.updated_at}
