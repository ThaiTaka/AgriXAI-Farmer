"""Cultivation history (crop cycles), crop suggestions and plot costs."""

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.farm import GrowthStage, Season


class MediaRef(BaseModel):
    id: str
    kind: str
    mime: str | None = None
    uploaded: bool = False
    url: str | None = None


class CultivationCreate(BaseModel):
    """A crop on the plot — either the one growing now (no `ended_at`) or a
    past season the farmer is writing down after the fact."""

    id: str | None = Field(default=None, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    crop_type: str = Field(min_length=1, max_length=48)
    crop_name: str | None = Field(default=None, max_length=64)
    variety_id: str | None = Field(default=None, max_length=64)
    variety_name: str | None = Field(default=None, max_length=128)
    season: Season | None = None
    started_at: int
    ended_at: int | None = None
    # Defaults to the plot's current area when left out.
    area_m2: float | None = Field(default=None, gt=0)
    yield_kg: float | None = Field(default=None, ge=0)
    notes: str | None = None

    @model_validator(mode="after")
    def _dates(self):
        if self.ended_at is not None and self.ended_at < self.started_at:
            raise ValueError("Ngày kết thúc không được trước ngày xuống giống")
        return self


class CultivationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    crop_type: str | None = Field(default=None, min_length=1, max_length=48)
    crop_name: str | None = Field(default=None, max_length=64)
    variety_id: str | None = Field(default=None, max_length=64)
    variety_name: str | None = Field(default=None, max_length=128)
    stage: GrowthStage | None = None
    season: Season | None = None
    started_at: int | None = None
    ended_at: int | None = None
    area_m2: float | None = Field(default=None, gt=0)
    yield_kg: float | None = Field(default=None, ge=0)
    notes: str | None = None


class CultivationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    plot_id: str
    name: str
    crop_type: str
    crop_name: str | None
    variety_id: str | None
    variety_name: str | None
    stage: str
    season: str
    season_label: str
    started_at: int
    ended_at: int | None
    area_m2: float | None
    yield_kg: float | None
    # kg per 1.000 m²; null until the cycle has both a yield and an area.
    productivity: float | None
    notes: str | None
    media: list[MediaRef]
    owner_id: str
    updated_by: str | None
    created_at: int
    updated_at: int


class SuggestionPoint(BaseModel):
    cycle_id: str
    name: str
    season: str
    year: int
    productivity: float


class CropSuggestionOut(BaseModel):
    crop_type: str
    crop_name: str
    avg_productivity: float
    best_productivity: float
    best_cycle_name: str
    cycles: int
    basis: str
    reason: str
    history: list[SuggestionPoint]


class PlotCostsOut(BaseModel):
    plot_id: str
    start: int | None
    end: int | None
    seed: float
    fertilizer: float
    labor: float
    other: float
    total: float
