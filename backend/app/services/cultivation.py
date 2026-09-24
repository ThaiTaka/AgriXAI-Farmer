"""Cultivation history arithmetic: seasons, productivity, crop suggestions and
what a plot cost.

Twin of mobile/src/domain/cultivation.ts — the phone computes the same things
offline, and tests on both sides pin them to the same figures.

    năng suất (kg / 1.000 m²) = sản lượng kg ÷ diện tích m² lúc trồng × 1.000

The suggestion is deliberately plain: rank the crops this plot has actually
grown by their average productivity, preferring harvests from the same season.
It never invents a crop the farmer has not grown and never claims agronomic
facts (rotation, companion planting) the app has no sourced data for.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from app.models.farm import Season

VN_TZ = timezone(timedelta(hours=7))

SEASON_VI = {
    Season.SPRING.value: "Xuân",
    Season.SUMMER.value: "Hè",
    Season.AUTUMN.value: "Thu",
    Season.WINTER.value: "Đông",
}
_SEASON_BY_QUARTER = (Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER)


def season_of(started_at_ms: int) -> str:
    """Default season from the sowing month (Vietnam time): Xuân 1–3, Hè 4–6,
    Thu 7–9, Đông 10–12."""
    month = datetime.fromtimestamp(started_at_ms / 1000, VN_TZ).month
    return _SEASON_BY_QUARTER[(month - 1) // 3].value


def year_of(ms: int) -> int:
    return datetime.fromtimestamp(ms / 1000, VN_TZ).year


# Same table as mobile/src/domain/areaUnits.ts (sources cited there).
AREA_UNIT_M2 = {"m2": 1, "sao_bac": 360, "sao_trung": 500, "cong_nam": 1000, "mau_bac": 3600, "ha": 10_000}


def area_in_m2(area: float, unit: str) -> float:
    return area * AREA_UNIT_M2.get(unit, 1)


def productivity(yield_kg: float | None, area_m2: float | None) -> float | None:
    """kg per 1.000 m², or None when either figure is missing."""
    if not yield_kg or not area_m2 or yield_kg <= 0 or area_m2 <= 0:
        return None
    return round(yield_kg / area_m2 * 1000, 1)


def cycle_season(cycle: Any) -> str:
    return cycle.season or season_of(cycle.started_at)


def season_label(season: str, year: int | None = None) -> str:
    name = f"Vụ {SEASON_VI.get(season, season)}"
    return f"{name} {year}" if year else name


def vn_number(value: float) -> str:
    """4500.0 → "4.500", 82.5 → "82,5" — how the farmer writes it."""
    rounded = round(value, 1)
    whole = int(rounded)
    text = f"{whole:,}".replace(",", ".")
    decimal = round(abs(rounded - whole) * 10)
    return f"{text},{decimal}" if decimal else text


@dataclass
class CropSuggestion:
    crop_type: str
    crop_name: str
    avg_productivity: float
    best_productivity: float
    best_cycle_name: str
    cycles: int
    basis: str  # "same_season" | "all_seasons"
    reason: str
    history: list[dict[str, Any]] = field(default_factory=list)


def recommend(cycles: Iterable[Any], season: str | None, crop_names: dict[str, str] | None = None) -> list[CropSuggestion]:
    """Crops ranked by the average productivity they reached on this plot.

    Only finished cycles with both a yield and an area count. When `season` is
    given, harvests of that season are used if there are any; otherwise every
    season is, and `basis` says so — the farmer should know the figure did not
    come from the season they asked about.
    """
    usable = [
        c
        for c in cycles
        if c.ended_at and productivity(c.yield_kg, c.area_m2) is not None
    ]
    pool = usable
    basis = "all_seasons"
    if season:
        in_season = [c for c in usable if cycle_season(c) == season]
        if in_season:
            pool, basis = in_season, "same_season"

    groups: dict[str, list[Any]] = defaultdict(list)
    for c in pool:
        groups[c.crop_type].append(c)

    names = crop_names or {}
    out: list[CropSuggestion] = []
    for crop_type, rows in groups.items():
        rows.sort(key=lambda c: c.started_at)
        values = [productivity(c.yield_kg, c.area_m2) for c in rows]
        avg = round(sum(values) / len(values), 1)
        best_index = max(range(len(rows)), key=lambda i: values[i])
        best = rows[best_index]
        name = next((c.crop_name for c in rows if c.crop_name), None) or names.get(crop_type, crop_type)
        out.append(
            CropSuggestion(
                crop_type=crop_type,
                crop_name=name,
                avg_productivity=avg,
                best_productivity=values[best_index],
                best_cycle_name=best.name,
                cycles=len(rows),
                basis=basis,
                reason="",
                history=[
                    {
                        "cycle_id": c.id,
                        "name": c.name,
                        "season": cycle_season(c),
                        "year": year_of(c.started_at),
                        "productivity": v,
                    }
                    for c, v in zip(rows, values)
                ],
            )
        )

    latest = {s.crop_type: max(h["year"] for h in s.history) for s in out}
    out.sort(key=lambda s: (-s.avg_productivity, -s.cycles, -latest[s.crop_type]))
    for rank, s in enumerate(out):
        s.reason = _reason(s, season, rank)
    return out


def _reason(s: CropSuggestion, season: str | None, rank: int) -> str:
    where = f" trong {season_label(season).lower()}" if s.basis == "same_season" and season else ""
    lead = "Năng suất tốt nhất trên lô này" if rank == 0 else "Năng suất trung bình"
    text = (
        f"{lead}{where}: {vn_number(s.avg_productivity)} kg/1.000 m² qua {s.cycles} vụ"
        f" (cao nhất {vn_number(s.best_productivity)} — {s.best_cycle_name})."
    )
    if s.basis == "all_seasons" and season:
        text = f"Lô chưa có {season_label(season).lower()} nào ghi sản lượng, nên tính trên mọi mùa. " + text
    return text


# ------------------------------ plot costs ------------------------------

COST_BUCKETS = ("seed", "fertilizer", "labor", "other")


def plot_costs(
    expenses: Iterable[Any],
    warehouse_outs: Iterable[Any],
    plot_id: str,
    start: int | None = None,
    end: int | None = None,
) -> dict[str, float]:
    """Giống + Phân + Nhân công (+ khác) spent on one plot, optionally in a window.

    Fertiliser is counted when it goes onto the plot (a stock issue at its FIFO
    cost), not when it was bought: a 50 kg bag bought for the shed is not a
    cost of the plot until some of it is spread there. A fertiliser expense
    booked by a stock purchase (`warehouse_in_id` set) is therefore skipped —
    counting it too would charge the same bag twice. Fertiliser bought and
    spread straight away, entered as a plain expense, does count.
    """

    def inside(ms: int) -> bool:
        return (start is None or ms >= start) and (end is None or ms <= end)

    totals = dict.fromkeys(COST_BUCKETS, 0.0)
    for row in expenses:
        if row.plot_id != plot_id or not inside(row.occurred_at):
            continue
        if row.kind == "fertilizer" and row.warehouse_in_id:
            continue
        bucket = row.kind if row.kind in ("seed", "fertilizer", "labor") else "other"
        totals[bucket] += row.amount
    for row in warehouse_outs:
        if row.plot_id == plot_id and inside(row.occurred_at):
            totals["fertilizer"] += row.total_cost
    totals = {k: float(round(v)) for k, v in totals.items()}
    totals["total"] = float(sum(totals.values()))
    return totals
