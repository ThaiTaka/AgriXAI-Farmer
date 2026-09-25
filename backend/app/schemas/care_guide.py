"""Care guides: a crop how-to with an embedded video and illustrated steps."""

import re
from urllib.parse import parse_qs, urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def youtube_id_of(value: str | None) -> str | None:
    """Accepts a bare id or any usual YouTube link and returns the 11-char id.

    Admins paste whatever the browser shows — watch?v=, youtu.be/, /shorts/,
    /embed/ — and the phone needs only the id to build the embed URL.
    """
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if YOUTUBE_ID.match(value):
        return value
    url = urlparse(value if "://" in value else f"https://{value}")
    host = (url.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    candidate: str | None = None
    if host == "youtu.be":
        candidate = url.path.lstrip("/").split("/")[0]
    elif host in {"youtube.com", "youtube-nocookie.com"}:
        if url.path == "/watch":
            candidate = (parse_qs(url.query).get("v") or [None])[0]
        else:
            parts = [p for p in url.path.split("/") if p]
            if len(parts) >= 2 and parts[0] in {"embed", "shorts", "live", "v"}:
                candidate = parts[1]
    if candidate and YOUTUBE_ID.match(candidate):
        return candidate
    raise ValueError("Không nhận ra đường dẫn YouTube")


def clean_source_url(value: str | None) -> str | None:
    if value and not re.match(r"^https?://", value.strip(), re.I):
        raise ValueError("Nguồn phải là đường dẫn http(s)")
    return value.strip() if value else None


class GuideStep(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(default="", max_length=4000)
    image_id: str | None = Field(default=None, max_length=64)


class CareGuideBase(BaseModel):
    crop_type: str = Field(min_length=1, max_length=48)
    stage_code: str | None = Field(default=None, max_length=48)
    title: str = Field(min_length=1, max_length=160)
    summary: str | None = Field(default=None, max_length=4000)
    youtube: str | None = Field(default=None, description="Mã hoặc đường dẫn YouTube")
    steps: list[GuideStep] = Field(default_factory=list, max_length=30)
    image_ids: list[str] = Field(default_factory=list, max_length=30)
    source_name: str | None = Field(default=None, max_length=160)
    source_url: str | None = Field(default=None, max_length=500)
    published: bool = False
    sort_order: int = 0

    @field_validator("youtube")
    @classmethod
    def _youtube(cls, value: str | None) -> str | None:
        return youtube_id_of(value)

    @field_validator("source_url")
    @classmethod
    def _source_url(cls, value: str | None) -> str | None:
        return clean_source_url(value)


class CareGuideCreate(CareGuideBase):
    id: str | None = Field(default=None, max_length=64)


class CareGuideUpdate(BaseModel):
    crop_type: str | None = Field(default=None, min_length=1, max_length=48)
    stage_code: str | None = Field(default=None, max_length=48)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    summary: str | None = Field(default=None, max_length=4000)
    youtube: str | None = None
    steps: list[GuideStep] | None = Field(default=None, max_length=30)
    image_ids: list[str] | None = Field(default=None, max_length=30)
    source_name: str | None = Field(default=None, max_length=160)
    source_url: str | None = Field(default=None, max_length=500)
    published: bool | None = None
    sort_order: int | None = None

    @field_validator("youtube")
    @classmethod
    def _youtube(cls, value: str | None) -> str | None:
        return youtube_id_of(value)

    @field_validator("source_url")
    @classmethod
    def _source_url(cls, value: str | None) -> str | None:
        return clean_source_url(value)


class CareGuideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    crop_type: str
    stage_code: str | None
    title: str
    summary: str | None
    youtube_id: str | None
    steps: list[GuideStep]
    image_ids: list[str]
    source_name: str | None
    source_url: str | None
    published: bool
    sort_order: int
    created_by: str | None
    updated_by: str | None
    created_at: int
    updated_at: int
