"""Request / response bodies for plans, the warehouse and income/expense."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.ledger import ExpenseKind, IncomeKind, StockUnit


class _Synced(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    updated_by: str | None
    created_at: int
    updated_at: int


# ------------------------------- plans ---------------------------------


class PlanItem(BaseModel):
    key: str
    name: str
    fertilizer_category: str | None = None
    unit: str = "kg"
    min: float = Field(ge=0)
    max: float = Field(ge=0)
    price_product_id: str | None = None
    price_per_kg: float | None = None
    cost_min: float | None = None
    cost_max: float | None = None


class PlanCreate(BaseModel):
    id: str | None = Field(default=None, max_length=64)
    plot_id: str | None = Field(default=None, max_length=64)
    crop_type: str = Field(max_length=48)
    crop_name: str | None = Field(default=None, max_length=64)
    category_id: str | None = Field(default=None, max_length=64)
    variety_id: str | None = Field(default=None, max_length=64)
    variety_name: str | None = Field(default=None, max_length=128)
    protocol_id: str = Field(max_length=64)
    scenario_id: str = Field(max_length=64)
    scenario_name: str = Field(max_length=160)
    area_input: float = Field(gt=0)
    area_unit: str = Field(max_length=16)
    area_m2: float = Field(gt=0)
    items: list[PlanItem] = Field(min_length=1)
    cost_min: float | None = None
    cost_max: float | None = None
    note: str | None = None


class PlanUpdate(BaseModel):
    plot_id: str | None = Field(default=None, max_length=64)
    crop_type: str | None = Field(default=None, max_length=48)
    crop_name: str | None = Field(default=None, max_length=64)
    category_id: str | None = Field(default=None, max_length=64)
    variety_id: str | None = Field(default=None, max_length=64)
    variety_name: str | None = Field(default=None, max_length=128)
    protocol_id: str | None = Field(default=None, max_length=64)
    scenario_id: str | None = Field(default=None, max_length=64)
    scenario_name: str | None = Field(default=None, max_length=160)
    area_input: float | None = Field(default=None, gt=0)
    area_unit: str | None = Field(default=None, max_length=16)
    area_m2: float | None = Field(default=None, gt=0)
    items: list[PlanItem] | None = Field(default=None, min_length=1)
    cost_min: float | None = None
    cost_max: float | None = None
    note: str | None = None


class PlanOut(_Synced):
    plot_id: str | None
    crop_type: str
    crop_name: str | None
    category_id: str | None
    variety_id: str | None
    variety_name: str | None
    protocol_id: str
    scenario_id: str
    scenario_name: str
    area_input: float
    area_unit: str
    area_m2: float
    items_json: str
    cost_min: float | None
    cost_max: float | None
    note: str | None


# ----------------------------- warehouse -------------------------------


class WarehouseInCreate(BaseModel):
    id: str | None = Field(default=None, max_length=64)
    fertilizer_id: str = Field(max_length=64)
    fertilizer_name: str = Field(min_length=1, max_length=128)
    category: str | None = Field(default=None, max_length=32)
    quantity: float = Field(gt=0)
    unit: StockUnit = StockUnit.KG
    price: float = Field(ge=0, description="Tổng tiền của lô nhập (đồng)")
    occurred_at: int
    note: str | None = None
    plot_id: str | None = Field(default=None, max_length=64)
    # A purchase is a cost. On by default so the ledger and the stock agree.
    record_expense: bool = True


class WarehouseInOut(_Synced):
    fertilizer_id: str
    fertilizer_name: str
    category: str | None
    quantity: float
    unit: str
    quantity_kg: float
    price: float
    unit_price: float
    occurred_at: int
    note: str | None
    plot_id: str | None
    expense_id: str | None


class WarehouseInUpdate(BaseModel):
    fertilizer_id: str | None = Field(default=None, max_length=64)
    fertilizer_name: str | None = Field(default=None, min_length=1, max_length=128)
    category: str | None = Field(default=None, max_length=32)
    quantity: float | None = Field(default=None, gt=0)
    unit: StockUnit | None = None
    price: float | None = Field(default=None, ge=0, description="Tổng tiền của lô nhập (đồng)")
    occurred_at: int | None = None
    note: str | None = None
    plot_id: str | None = Field(default=None, max_length=64)


class WarehouseOutCreate(BaseModel):
    id: str | None = Field(default=None, max_length=64)
    fertilizer_id: str = Field(max_length=64)
    fertilizer_name: str = Field(min_length=1, max_length=128)
    category: str | None = Field(default=None, max_length=32)
    quantity_kg: float = Field(gt=0)
    occurred_at: int
    note: str | None = None
    plot_id: str | None = Field(default=None, max_length=64)
    plan_id: str | None = Field(default=None, max_length=64)


class WarehouseOutOut(_Synced):
    fertilizer_id: str
    fertilizer_name: str
    category: str | None
    quantity_kg: float
    unit_price: float
    total_cost: float
    occurred_at: int
    note: str | None
    plot_id: str | None
    plan_id: str | None


class WarehouseOutUpdate(BaseModel):
    fertilizer_id: str | None = Field(default=None, max_length=64)
    fertilizer_name: str | None = Field(default=None, min_length=1, max_length=128)
    category: str | None = Field(default=None, max_length=32)
    quantity_kg: float | None = Field(default=None, gt=0)
    unit_price: float | None = Field(default=None, ge=0)
    occurred_at: int | None = None
    note: str | None = None
    plot_id: str | None = Field(default=None, max_length=64)
    plan_id: str | None = Field(default=None, max_length=64)


class StockLineOut(BaseModel):
    fertilizer_id: str
    fertilizer_name: str
    category: str | None
    in_kg: float
    out_kg: float
    stock_kg: float
    avg_price: float
    stock_value: float
    latest_unit_price: float | None


class StockSummaryOut(BaseModel):
    lines: list[StockLineOut]
    total_stock_kg: float
    total_value: float


class StockCheckOut(BaseModel):
    fertilizer_id: str
    stock_kg: float
    needed_kg: float
    remaining_kg: float
    shortfall_kg: float
    enough: bool
    latest_unit_price: float | None
    fifo_unit_price: float


# ------------------------------ finance --------------------------------


class IncomeCreate(BaseModel):
    id: str | None = Field(default=None, max_length=64)
    kind: IncomeKind = IncomeKind.PRODUCT
    description: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    occurred_at: int
    note: str | None = None
    plot_id: str | None = Field(default=None, max_length=64)
    checked: bool = False


class IncomeOut(_Synced):
    kind: str
    description: str
    amount: float
    occurred_at: int
    note: str | None
    plot_id: str | None
    checked: bool


class IncomeUpdate(BaseModel):
    kind: IncomeKind | None = None
    description: str | None = Field(default=None, min_length=1, max_length=200)
    amount: float | None = Field(default=None, gt=0)
    occurred_at: int | None = None
    note: str | None = None
    plot_id: str | None = Field(default=None, max_length=64)
    checked: bool | None = None


class ExpenseCreate(BaseModel):
    id: str | None = Field(default=None, max_length=64)
    kind: ExpenseKind = ExpenseKind.OTHER
    description: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    occurred_at: int
    note: str | None = None
    plot_id: str | None = Field(default=None, max_length=64)
    checked: bool = False
    warehouse_in_id: str | None = Field(default=None, max_length=64)


class ExpenseOut(_Synced):
    kind: str
    description: str
    amount: float
    occurred_at: int
    note: str | None
    plot_id: str | None
    checked: bool
    warehouse_in_id: str | None


class ExpenseUpdate(BaseModel):
    kind: ExpenseKind | None = None
    description: str | None = Field(default=None, min_length=1, max_length=200)
    amount: float | None = Field(default=None, gt=0)
    occurred_at: int | None = None
    note: str | None = None
    plot_id: str | None = Field(default=None, max_length=64)
    checked: bool | None = None


class CheckedUpdate(BaseModel):
    checked: bool


class DailyPoint(BaseModel):
    date: str
    income: float
    expense: float


class FinancialReportOut(BaseModel):
    period: str
    total_income: float
    total_expense: float
    profit: float
    income_by_kind: dict[str, float]
    expense_by_kind: dict[str, float]
    daily: list[DailyPoint]
    incomes: list[IncomeOut]
    expenses: list[ExpenseOut]
