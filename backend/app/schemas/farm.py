"""Request / response bodies for plots and crop varieties."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.farm import PlotStatus


class PlotBase(BaseModel):
    code: str = Field(max_length=32)
    name: str = Field(min_length=1, max_length=128)
    region: str | None = Field(default=None, max_length=160)
    area: float = Field(default=0.0, ge=0)
    area_unit: str = Field(default="m2", max_length=8)
    crop_type: str = Field(default="ca_chua", max_length=48)
    variety_id: str | None = Field(default=None, max_length=64)
    variety_name: str | None = Field(default=None, max_length=128)
    planted_at: int | None = None
    status: PlotStatus = PlotStatus.ACTIVE
    notes: str | None = None


class PlotCreate(PlotBase):
    """`id` is optional: the mobile app supplies the id it already generated
    offline so the record keeps one identity across devices."""

    id: str | None = Field(default=None, max_length=64)


class PlotUpdate(BaseModel):
    code: str | None = Field(default=None, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=128)
    region: str | None = Field(default=None, max_length=160)
    area: float | None = Field(default=None, ge=0)
    area_unit: str | None = Field(default=None, max_length=8)
    crop_type: str | None = Field(default=None, max_length=48)
    variety_id: str | None = Field(default=None, max_length=64)
    variety_name: str | None = Field(default=None, max_length=128)
    planted_at: int | None = None
    status: PlotStatus | None = None
    notes: str | None = None


class PlotOut(PlotBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    updated_by: str | None
    created_at: int
    updated_at: int


class CropVarietyBase(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    crop_type: str = Field(max_length=48)
    crop_name: str = Field(max_length=64)
    fruit: str | None = None
    usage: str | None = None
    note: str | None = None


class CropVarietyCreate(CropVarietyBase):
    id: str | None = Field(default=None, max_length=64)


class CropVarietyOut(CropVarietyBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    seed_key: str | None
    is_seed: bool
    approved: bool
    source: str
    created_by: str | None
    created_at: int
    updated_at: int
