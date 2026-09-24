"""Uploaded photos and videos."""

from pydantic import BaseModel, ConfigDict


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    content_type: str
    size_bytes: int
    is_public: bool
    url: str
    created_at: int


class MediaTokenOut(BaseModel):
    token: str
    expires_at: int
