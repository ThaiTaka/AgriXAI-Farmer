"""Stock and money arithmetic for the warehouse and finance endpoints.

The same rules are implemented in TypeScript for the phone
(mobile/src/domain/warehouse.ts, mobile/src/domain/finance.ts) because the
farmer works offline; this module is the server-side reference the tests of
both sides are checked against:

    stock          = Σ(in) − Σ(out)                       [kg]
    average price  = Σ(in_kg × unit_price) / Σ(in_kg)     [đ/kg]
    stock value    = stock × average price                [đ]
    issue cost     = FIFO — the oldest purchase lots are consumed first

FIFO is chosen over average cost for issues because that is how a sack of
fertiliser actually leaves a shed: the one bought first is the one at the
front. It also means a price spike on the latest purchase does not silently
re-price fertiliser bought months earlier.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Iterable

# Vietnam has a single time zone; reports are grouped in it, not in UTC.
VN_TZ = timezone(timedelta(hours=7))

TAN_TO_KG = 1000.0


def to_kg(quantity: float, unit: str) -> float:
    if unit == "tan":
        return quantity * TAN_TO_KG
    if unit == "kg":
        return quantity
    raise ValueError(f"Đơn vị không hỗ trợ: {unit}")


@dataclass
class Lot:
    unit_price: float
    remaining_kg: float


@dataclass
class InRow:
    fertilizer_id: str
    quantity_kg: float
    unit_price: float
    occurred_at: int
    created_at: int = 0


@dataclass
class OutRow:
    fertilizer_id: str
    quantity_kg: float
    occurred_at: int
    created_at: int = 0


@dataclass
class FifoResult:
    unit_price: float
    total_cost: float
    consumed_kg: float
    shortfall_kg: float


def fifo_cost(
    ins: Iterable[InRow],
    outs: Iterable[OutRow],
    fertilizer_id: str,
    quantity_kg: float,
    occurred_at: int,
) -> FifoResult:
    """Cost of issuing `quantity_kg` of one fertiliser at `occurred_at`.

    Every earlier issue is replayed first so the lots it already consumed are
    not counted twice. Rows dated after the issue are ignored: a purchase
    booked for next week cannot feed today's application.
    """
    lots = [
        Lot(row.unit_price, row.quantity_kg)
        for row in sorted(
            (r for r in ins if r.fertilizer_id == fertilizer_id and r.occurred_at <= occurred_at),
            key=lambda r: (r.occurred_at, r.created_at),
        )
    ]
    earlier_outs = sorted(
        (r for r in outs if r.fertilizer_id == fertilizer_id and r.occurred_at <= occurred_at),
        key=lambda r: (r.occurred_at, r.created_at),
    )
    for prior in earlier_outs:
        _consume(lots, prior.quantity_kg)

    consumed_kg, cost = _consume(lots, quantity_kg)
    shortfall = max(0.0, quantity_kg - consumed_kg)
    unit_price = cost / consumed_kg if consumed_kg > 0 else 0.0
    return FifoResult(unit_price=unit_price, total_cost=cost, consumed_kg=consumed_kg, shortfall_kg=shortfall)


def _consume(lots: list[Lot], quantity_kg: float) -> tuple[float, float]:
    """Takes `quantity_kg` from the front of the queue. Returns (kg taken, cost)."""
    need = quantity_kg
    cost = 0.0
    taken = 0.0
    for lot in lots:
        if need <= 0:
            break
        if lot.remaining_kg <= 0:
            continue
        take = min(lot.remaining_kg, need)
        lot.remaining_kg -= take
        need -= take
        taken += take
        cost += take * lot.unit_price
    return taken, cost


@dataclass
class StockLine:
    fertilizer_id: str
    fertilizer_name: str
    category: str | None
    in_kg: float = 0.0
    out_kg: float = 0.0
    in_value: float = 0.0
    out_value: float = 0.0
    latest_unit_price: float | None = None
    latest_at: int | None = None

    @property
    def stock_kg(self) -> float:
        return round(self.in_kg - self.out_kg, 3)

    @property
    def avg_price(self) -> float:
        return self.in_value / self.in_kg if self.in_kg > 0 else 0.0

    @property
    def stock_value(self) -> float:
        return self.stock_kg * self.avg_price


def stock_summary(ins: Iterable, outs: Iterable) -> list[StockLine]:
    """Per-fertiliser totals. `ins`/`outs` are ORM rows or anything with the
    same attribute names."""
    lines: dict[str, StockLine] = {}

    for row in ins:
        line = lines.setdefault(
            row.fertilizer_id,
            StockLine(row.fertilizer_id, row.fertilizer_name, getattr(row, "category", None)),
        )
        line.in_kg += row.quantity_kg
        line.in_value += row.quantity_kg * row.unit_price
        if line.latest_at is None or row.occurred_at >= line.latest_at:
            line.latest_at = row.occurred_at
            line.latest_unit_price = row.unit_price

    for row in outs:
        line = lines.setdefault(
            row.fertilizer_id,
            StockLine(row.fertilizer_id, row.fertilizer_name, getattr(row, "category", None)),
        )
        line.out_kg += row.quantity_kg
        line.out_value += row.total_cost

    return sorted(lines.values(), key=lambda l: l.fertilizer_name)


@dataclass
class Period:
    year: int
    month: int | None = None
    quarter: int | None = None

    def bounds_ms(self) -> tuple[int, int]:
        if self.month is not None:
            start = datetime(self.year, self.month, 1, tzinfo=VN_TZ)
            end = datetime(self.year + (self.month // 12), self.month % 12 + 1, 1, tzinfo=VN_TZ)
        elif self.quarter is not None:
            first = (self.quarter - 1) * 3 + 1
            start = datetime(self.year, first, 1, tzinfo=VN_TZ)
            end_month = first + 3
            end = datetime(self.year + (end_month > 12), end_month - 12 if end_month > 12 else end_month, 1, tzinfo=VN_TZ)
        else:
            start = datetime(self.year, 1, 1, tzinfo=VN_TZ)
            end = datetime(self.year + 1, 1, 1, tzinfo=VN_TZ)
        return int(start.timestamp() * 1000), int(end.timestamp() * 1000)

    def label(self) -> str:
        if self.month is not None:
            return f"Tháng {self.month}, Năm {self.year}"
        if self.quarter is not None:
            return f"Quý {self.quarter}, Năm {self.year}"
        return f"Năm {self.year}"


def in_period(occurred_at: int, period: Period) -> bool:
    start, end = period.bounds_ms()
    return start <= occurred_at < end


def day_key(occurred_at: int) -> str:
    return datetime.fromtimestamp(occurred_at / 1000, tz=VN_TZ).strftime("%Y-%m-%d")


@dataclass
class FinancialReport:
    period: str
    total_income: float = 0.0
    total_expense: float = 0.0
    expense_by_kind: dict[str, float] = field(default_factory=dict)
    income_by_kind: dict[str, float] = field(default_factory=dict)
    daily: list[dict] = field(default_factory=list)
    incomes: list = field(default_factory=list)
    expenses: list = field(default_factory=list)

    @property
    def profit(self) -> float:
        return self.total_income - self.total_expense


def financial_report(incomes: Iterable, expenses: Iterable, period: Period) -> FinancialReport:
    report = FinancialReport(period=period.label())
    days: dict[str, dict[str, float]] = {}

    for row in incomes:
        if not in_period(row.occurred_at, period):
            continue
        report.incomes.append(row)
        report.total_income += row.amount
        report.income_by_kind[row.kind] = report.income_by_kind.get(row.kind, 0.0) + row.amount
        day = days.setdefault(day_key(row.occurred_at), {"income": 0.0, "expense": 0.0})
        day["income"] += row.amount

    for row in expenses:
        if not in_period(row.occurred_at, period):
            continue
        report.expenses.append(row)
        report.total_expense += row.amount
        report.expense_by_kind[row.kind] = report.expense_by_kind.get(row.kind, 0.0) + row.amount
        day = days.setdefault(day_key(row.occurred_at), {"income": 0.0, "expense": 0.0})
        day["expense"] += row.amount

    report.daily = [{"date": key, **days[key]} for key in sorted(days)]
    report.incomes.sort(key=lambda r: r.occurred_at)
    report.expenses.sort(key=lambda r: r.occurred_at)
    return report


INCOME_KIND_VI = {"product": "Sản phẩm", "service": "Dịch vụ", "other": "Khác"}
EXPENSE_KIND_VI = {
    "fertilizer": "Phân bón",
    "labor": "Công nhân",
    "utilities": "Điện nước",
    "other": "Khác",
}


def _vnd(value: float) -> str:
    return f"{int(round(value)):,}".replace(",", ".") + "₫"


def financial_csv(report: FinancialReport) -> str:
    """Layout required by the spec:

        line 1  : period
        line 2  : "Thu", total, "Chi", total, "Lãi lỗ", profit
        details : one row per entry
        last    : totals
    """
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow([report.period])
    writer.writerow(["Thu", _vnd(report.total_income), "Chi", _vnd(report.total_expense), "Lãi lỗ", _vnd(report.profit)])
    writer.writerow([])
    writer.writerow(["Loại", "Ngày", "Nhóm", "Mô tả", "Số tiền", "Ghi chú", "Đã kiểm tra"])
    for row in report.incomes:
        writer.writerow(
            ["Thu", day_key(row.occurred_at), INCOME_KIND_VI.get(row.kind, row.kind), row.description, _vnd(row.amount), row.note or "", "x" if row.checked else ""]
        )
    for row in report.expenses:
        writer.writerow(
            ["Chi", day_key(row.occurred_at), EXPENSE_KIND_VI.get(row.kind, row.kind), row.description, _vnd(row.amount), row.note or "", "x" if row.checked else ""]
        )
    writer.writerow([])
    writer.writerow(["Tổng", "", "", "", f"Thu {_vnd(report.total_income)}", f"Chi {_vnd(report.total_expense)}", f"Lãi lỗ {_vnd(report.profit)}"])
    return buf.getvalue()


def stock_csv(lines: list[StockLine]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["Phân bón", "Nhập (kg)", "Xuất (kg)", "Tồn (kg)", "Giá trung bình (đ/kg)", "Tổng tiền tồn"])
    for line in lines:
        writer.writerow(
            [line.fertilizer_name, f"{line.in_kg:g}", f"{line.out_kg:g}", f"{line.stock_kg:g}", _vnd(line.avg_price), _vnd(line.stock_value)]
        )
    total_value = sum(l.stock_value for l in lines)
    writer.writerow(["Tổng", "", "", f"{sum(l.stock_kg for l in lines):g}", "", _vnd(total_value)])
    return buf.getvalue()
