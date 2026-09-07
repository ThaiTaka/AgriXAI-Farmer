"""Shared response bodies."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    database: str
    model_status: str
    static_data: dict[str, bool]
