"""Notifications for the farmers' phones, and which ones each farmer has seen.

A notification is written by an admin in web-admin, or by the server itself:
a weather warning (app/services/weather.py) or a fertiliser price change
(app/routers/fertilizer_prices.py). It reaches the phone through /sync like a
care guide, so the inbox still opens in a field without signal, and the phone
raises a system notification for each new one it pulls.

`owner_id` NULL means every farm (the village shares one weather forecast and
one price list); set, it is for that farm only. Only admins and the server
write notifications — a phone just reads them.

`notification_reads` is the farmer's side: one row per notification they have
opened, written on the phone and synced like any farm record, so the badge is
right on a second phone and web-admin can show how many farms a message has
actually reached.
"""

from sqlalchemy import BigInteger, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import SyncMixin


class NotificationKind:
    ANNOUNCEMENT = "announcement"
    WEATHER = "weather"
    PRICE = "price"

    ALL = (ANNOUNCEMENT, WEATHER, PRICE)


class NotificationLevel:
    INFO = "info"
    WARNING = "warning"
    DANGER = "danger"

    ALL = (INFO, WARNING, DANGER)


class Notification(Base, SyncMixin):
    __tablename__ = "notifications"

    # NULL = every farm. Fixed at creation: moving a message to another farm
    # would leave it on the first farm's phone, which never learns it moved.
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True, default=None)
    kind: Mapped[str] = mapped_column(String(24), nullable=False, default=NotificationKind.ANNOUNCEMENT)
    level: Mapped[str] = mapped_column(String(16), nullable=False, default=NotificationLevel.INFO)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Where tapping it leads in the app: "weather", "prices", "care_guide:<id>".
    link: Mapped[str | None] = mapped_column(String(120), default=None)
    source_name: Mapped[str | None] = mapped_column(String(160), default=None)
    source_url: Mapped[str | None] = mapped_column(String(500), default=None)
    # After this the message is history — a rain warning for a day gone by.
    expires_at: Mapped[int | None] = mapped_column(BigInteger, default=None)
    created_by: Mapped[str | None] = mapped_column(String(64), default=None)
    updated_by: Mapped[str | None] = mapped_column(String(64), default=None)


class NotificationRead(Base, SyncMixin):
    __tablename__ = "notification_reads"

    notification_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    # When the farmer opened it. A message edited after this shows as new again.
    read_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
