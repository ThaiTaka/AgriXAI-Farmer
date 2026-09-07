"""Request / response bodies for diagnoses."""

from pydantic import BaseModel, ConfigDict, Field


class PredictionOut(BaseModel):
    disease_key: str
    confidence: float = Field(ge=0.0, le=1.0)


class HeatmapRegion(BaseModel):
    """One highlighted ellipse, in normalised 0..1 image coordinates.

    Normalised so the app can draw the overlay at whatever size it renders the
    photo, without knowing the resolution the model saw.
    """

    cx: float = Field(ge=0.0, le=1.0)
    cy: float = Field(ge=0.0, le=1.0)
    rx: float = Field(gt=0.0, le=1.0)
    ry: float = Field(gt=0.0, le=1.0)
    weight: float = Field(default=1.0, ge=0.0, le=1.0)


class Heatmap(BaseModel):
    regions: list[HeatmapRegion]
    """Share of the leaf the model flagged, 0..1 — shown as "Vùng nghi ngờ"."""
    affected_ratio: float | None = Field(default=None, ge=0.0, le=1.0)


class PredictResponse(BaseModel):
    """Top-3 predictions, best first.

    No database row is created — see the note at the top of routers/diagnoses.py.
    """

    predictions: list[PredictionOut]
    heatmap: Heatmap | None = None
    model_version: str
    image_path: str
    analysed_at: int


class DiagnosisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    plot_id: str
    disease_key: str
    disease_name: str
    severity: str
    confidence: float
    affected_ratio: float | None
    image_path: str | None
    model_version: str | None
    explanation: str | None
    top3_json: str | None
    heatmap_json: str | None
    queued: bool
    diagnosed_at: int
    owner_id: str
    created_at: int
    updated_at: int
