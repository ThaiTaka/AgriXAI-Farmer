"""Notifications an admin sends to the farmers' phones."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.care_guide import clean_source_url

Level = Literal["info", "warning", "danger"]


class NotificationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(default="", max_length=2000)
    level: Level = "info"
    # None = every farm. Fixed once sent (see app/models/notification.py).
    owner_id: str | None = Field(default=None, max_length=64)
    link: str | None = Field(default=None, max_length=120)
    source_name: str | None = Field(default=None, max_length=160)
    source_url: str | None = Field(default=None, max_length=500)
    expires_at: int | None = Field(default=None, gt=0)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Tiêu đề không được để trống")
        return value

    @field_validator("source_url")
    @classmethod
    def _source(cls, value: str | None) -> str | None:
        return clean_source_url(value)


class NotificationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    body: str | None = Field(default=None, max_length=2000)
    level: Level | None = None
    link: str | None = Field(default=None, max_length=120)
    source_name: str | None = Field(default=None, max_length=160)
    source_url: str | None = Field(default=None, max_length=500)
    expires_at: int | None = Field(default=None, gt=0)

    @field_validator("source_url")
    @classmethod
    def _source(cls, value: str | None) -> str | None:
        return clean_source_url(value)


class NotificationOut(BaseModel):
    id: str
    owner_id: str | None
    # "Mọi nông hộ" or the farm's name — so the list reads without a lookup.
    audience_label: str
    kind: str
    level: str
    title: str
    body: str
    link: str | None
    source_name: str | None
    source_url: str | None
    expires_at: int | None
    created_by: str | None
    updated_by: str | None
    created_at: int
    updated_at: int
    # For the caller: has *this* account opened it?
    read: bool
    # Admins only: how many of the farms it was meant for have opened it.
    read_count: int | None = None
    audience_size: int | None = None
