"""Hired labour — the one place its cost is worked out.

    theo giờ / theo ngày :  số người × số giờ (ngày) mỗi người × đơn giá
    khoán                :  một khoản trọn gói cho cả việc

Rounded to whole đồng, half up, because that is what changes hands. The
phone has the twin of this function (mobile/src/domain/labor.ts); tests pin
both to the same figures — including the half-đồng case, where Python's own
round() (half to even) and JavaScript's Math.round (half up) disagree.
"""

from app.models.ledger import LaborUnit
from app.services.rounding import half_up


def labor_amount(unit: str, workers: float | None, quantity: float | None, unit_price: float) -> float:
    if unit == LaborUnit.LUMP.value:
        return half_up(unit_price)
    if not workers or not quantity:
        raise ValueError("Cần số người và số giờ/ngày")
    return half_up(workers * quantity * unit_price)

