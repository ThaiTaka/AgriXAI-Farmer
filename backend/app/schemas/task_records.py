"""Task notes (text + photos/videos) and the labour hired for a task."""

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.ledger import LaborUnit
from app.schemas.cultivation import MediaRef


class TaskNoteCreate(BaseModel):
    id: str | None = Field(default=None, max_length=64)
    note_text: str = Field(default="", max_length=4000)
    occurred_at: int | None = None
    # Media already uploaded through POST /media, by id.
    media_ids: list[str] = Field(default_factory=list, max_length=20)


class TaskNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    plot_id: str | None
    note_text: str
    media: list[MediaRef]
    occurred_at: int
    owner_id: str
    updated_by: str | None
    created_at: int
    updated_at: int


class LaborCostCreate(BaseModel):
    """Hired work for one task.

    By the hour or day: `workers` × `quantity` × `unit_price`. Khoán (a lump
    sum for the whole job): `unit_price` is the sum and the other two are not
    used. The total is always computed here, never taken from the client.
    """

    id: str | None = Field(default=None, max_length=64)
    description: str = Field(min_length=1, max_length=200)
    unit: LaborUnit = LaborUnit.HOUR
    workers: float | None = Field(default=None, gt=0, le=1000)
    quantity: float | None = Field(default=None, gt=0, le=10000)
    unit_price: float = Field(gt=0, le=1_000_000_000)
    occurred_at: int | None = None
    note: str | None = None

    @model_validator(mode="after")
    def _breakdown(self):
        if self.unit is not LaborUnit.LUMP and (self.workers is None or self.quantity is None):
            raise ValueError("Thuê theo giờ/ngày cần số người và số giờ/ngày mỗi người")
        return self


class LaborCostUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=200)
    unit: LaborUnit | None = None
    workers: float | None = Field(default=None, gt=0, le=1000)
    quantity: float | None = Field(default=None, gt=0, le=10000)
    unit_price: float | None = Field(default=None, gt=0, le=1_000_000_000)
    occurred_at: int | None = None
    note: str | None = None


class LaborCostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str | None
    plot_id: str | None
    description: str
    unit: str | None
    workers: float | None
    quantity: float | None
    unit_price: float | None
    amount: float
    occurred_at: int
    note: str | None
    owner_id: str
    updated_by: str | None
    created_at: int
    updated_at: int
