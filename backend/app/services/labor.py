"""Hired labour — the one place its cost is worked out.

    theo giờ / theo ngày :  số người × số giờ (ngày) mỗi người × đơn giá
    khoán                :  một khoản trọn gói cho cả việc

Rounded to whole đồng, because that is what changes hands. The phone has the
twin of this function (mobile/src/domain/labor.ts); tests pin both to the
same figures.
"""

from app.models.ledger import LaborUnit


def labor_amount(unit: str, workers: float | None, quantity: float | None, unit_price: float) -> float:
    if unit == LaborUnit.LUMP.value:
        return float(round(unit_price))
    if not workers or not quantity:
        raise ValueError("Cần số người và số giờ/ngày")
    return float(round(workers * quantity * unit_price))


UNIT_VI = {
    LaborUnit.HOUR.value: "giờ",
    LaborUnit.DAY.value: "ngày",
    LaborUnit.LUMP.value: "khoán",
}
