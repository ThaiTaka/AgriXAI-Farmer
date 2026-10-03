"""Quản lý giá phân bón — chỉ admin mới được ghi, mọi người đọc được.

Thiết kế bất biến (append-only):
- Mỗi lần cập nhật giá → INSERT dòng mới với effective_from mới.
- Không bao giờ UPDATE hay DELETE dòng giá cũ.
- "Giá hiện tại" = dòng mới nhất (MAX effective_from) theo từng fertilizer_id.
- Lịch sử đầy đủ phục vụ phân tích chi phí nông hộ theo thời gian.

Bảng fertilizer_prices KHÔNG tham gia /sync: điện thoại có sẵn giá khảo sát
trong JSON tĩnh (shared/data/fertilizer_recommendations.json) và, sau mỗi lần
đồng bộ thành công, tải GET /fertilizer-prices/latest để phủ giá quản trị viên
nhập lên trên (lưu lại để dùng khi mất mạng).

Mỗi giá mới còn sinh một thông báo cho mọi nông hộ; nhiều giá nhập liền nhau
được gộp vào một thông báo (app/services/notification_service.py).
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.fertilizer import FertilizerPrice
from app.models.user import User
from app.services import notification_service as notices
from app.services import static_data
from app.services.auth_service import current_admin, current_user
from app.services.sync_service import now_ms

router = APIRouter(prefix="/fertilizer-prices", tags=["fertilizer-prices"])


# ─── Schema ─────────────────────────────────────────────────────────────────


class FertilizerPriceIn(BaseModel):
    """Body yêu cầu khi admin nhập giá mới."""

    fertilizer_id: str = Field(min_length=1, max_length=64)
    price_per_kg: float = Field(gt=0, description="Giá VNĐ/kg, phải dương")
    effective_from: int = Field(gt=0, description="Thời điểm hiệu lực (epoch ms, phải dương)")


class FertilizerPriceOut(BaseModel):
    """Trả về: giá hiện hành kèm tên phân bón từ danh mục JSON."""

    id: int
    fertilizer_id: str
    fertilizer_name: str          # Lấy từ JSON catalogue; fallback = fertilizer_id
    group: str | None             # Nhóm phân bón (N, P, K, hỗn hợp, ...)
    price_per_kg: float
    effective_from: int
    updated_by: str | None
    created_at: int
    # From the sourced catalogue, so a price can be read against the survey
    # it replaces (None for an id the catalogue does not know).
    group_name: str | None = None
    npk_ratio: str | None = None
    pack: str | None = None
    survey_min: float | None = None
    survey_max: float | None = None
    survey_avg: float | None = None
    survey_source: str | None = None
    survey_date: str | None = None


# ─── Helpers ────────────────────────────────────────────────────────────────


def _catalogue_map() -> dict[str, dict[str, Any]]:
    """fertilizer_id -> {name, category, price_per_kg_avg, ...} từ JSON tĩnh.

    Each product also carries "_group_name", the name of its category.
    """
    try:
        data = static_data.load("fertilizer_recommendations")
        items: list[dict] = data.get("products", []) if isinstance(data, dict) else data
        groups = {c["code"]: c["name"] for c in data.get("categories", [])} if isinstance(data, dict) else {}
        return {item["id"]: {**item, "_group_name": groups.get(item.get("category"))} for item in items if "id" in item}
    except Exception:
        return {}


def _catalogue_fields(info: dict[str, Any]) -> dict[str, Any]:
    """The survey figures of one catalogue product, for FertilizerPriceOut."""
    return {
        "group_name": info.get("_group_name"),
        "npk_ratio": info.get("npk_ratio"),
        "pack": info.get("unit"),
        "survey_min": info.get("price_per_kg_min"),
        "survey_max": info.get("price_per_kg_max"),
        "survey_avg": info.get("price_per_kg_avg"),
        "survey_source": info.get("source"),
        "survey_date": info.get("updated_at"),
    }


def _enrich(row: FertilizerPrice, cat: dict[str, dict]) -> FertilizerPriceOut:
    info = cat.get(row.fertilizer_id, {})
    return FertilizerPriceOut(
        id=row.id,
        fertilizer_id=row.fertilizer_id,
        fertilizer_name=info.get("name", row.fertilizer_id),
        group=info.get("category"),          # JSON dùng "category" (dam, lan, kali, npk, ...)
        price_per_kg=row.price_per_kg,
        effective_from=row.effective_from,
        updated_by=row.updated_by,
        created_at=row.created_at,
        **_catalogue_fields(info),
    )


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.post("", response_model=FertilizerPriceOut, status_code=status.HTTP_201_CREATED)
def create_price(
    body: FertilizerPriceIn,
    admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
) -> FertilizerPriceOut:
    """Admin nhập giá mới cho một loại phân bón.

    Luôn INSERT dòng mới — không UPDATE dòng cũ.
    Sau khi tạo, giá mới này trở thành "giá hiện hành" nếu
    effective_from của nó lớn hơn tất cả các dòng trước.
    """
    # Validate: fertilizer_id phải có trong danh mục JSON
    cat = _catalogue_map()
    if cat and body.fertilizer_id not in cat:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Mã phân bón '{body.fertilizer_id}' không có trong danh mục",
        )

    previous = db.scalars(
        select(FertilizerPrice)
        .where(FertilizerPrice.fertilizer_id == body.fertilizer_id)
        .order_by(FertilizerPrice.effective_from.desc(), FertilizerPrice.id.desc())
        .limit(1)
    ).first()
    row = FertilizerPrice(
        fertilizer_id=body.fertilizer_id,
        price_per_kg=body.price_per_kg,
        effective_from=body.effective_from,
        updated_by=admin.id,
    )
    db.add(row)
    # Same transaction: a price is never saved without notice, nor announced
    # without being saved.
    notices.price_changed(
        db,
        admin,
        fertilizer_id=body.fertilizer_id,
        name=cat.get(body.fertilizer_id, {}).get("name", body.fertilizer_id),
        new_price=body.price_per_kg,
        old_price=previous.price_per_kg if previous else None,
        effective_from=body.effective_from,
    )
    db.commit()
    db.refresh(row)
    return _enrich(row, cat)


@router.get("/latest", response_model=list[FertilizerPriceOut])
def get_latest_prices(
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[FertilizerPriceOut]:
    """Trả về giá hiện hành (mới nhất theo effective_from) của mỗi loại phân bón.

    Danh sách đủ để web-admin hiển thị bảng giá theo nhóm, và để điện thoại
    phủ giá quản trị viên nhập lên giá khảo sát.
    Các fertilizer_id chưa có giá trong DB thì dùng giá từ JSON catalogue.
    Giá nhập trước cho một ngày sau chưa phải giá hiện hành: nó chỉ có trong
    /history cho tới ngày đó.
    """
    cat = _catalogue_map()

    # Fetch all rows ordered by newest first, then deduplicate in Python.
    # SQLite không hỗ trợ DISTINCT ON nên ta group trong Python — đơn giản và đủ nhanh.
    all_rows = list(
        db.scalars(
            select(FertilizerPrice)
            .where(FertilizerPrice.effective_from <= now_ms())
            .order_by(FertilizerPrice.effective_from.desc(), FertilizerPrice.id.desc())
        )
    )

    # Lấy dòng mới nhất cho mỗi fertilizer_id
    seen: set[str] = set()
    latest: list[FertilizerPrice] = []
    for row in all_rows:
        if row.fertilizer_id not in seen:
            seen.add(row.fertilizer_id)
            latest.append(row)

    result = [_enrich(r, cat) for r in latest]

    # Bổ sung các loại phân chưa có giá trong DB (dùng giá từ JSON nếu có)
    db_ids = {r.fertilizer_id for r in latest}
    for fid, info in cat.items():
        if fid in db_ids:
            continue
        # JSON có price_per_kg_avg (VNĐ/kg trung bình thị trường)
        json_price = info.get("price_per_kg_avg") or info.get("price_per_kg")
        if json_price:
            result.append(
                FertilizerPriceOut(
                    id=-1,  # Sentinel: giá từ JSON, chưa có trong DB
                    fertilizer_id=fid,
                    fertilizer_name=info.get("name", fid),
                    group=info.get("category"),
                    price_per_kg=float(json_price),
                    effective_from=0,
                    updated_by=None,
                    created_at=0,
                    **_catalogue_fields(info),
                )
            )

    # Sắp xếp: nhóm → tên
    result.sort(key=lambda r: (r.group or "z", r.fertilizer_name))
    return result


@router.get("/history/{fertilizer_id}", response_model=list[FertilizerPriceOut])
def get_price_history(
    fertilizer_id: str,
    _: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[FertilizerPriceOut]:
    """Lịch sử toàn bộ giá của một loại phân bón, mới nhất trước."""
    cat = _catalogue_map()
    rows = list(
        db.scalars(
            select(FertilizerPrice)
            .where(FertilizerPrice.fertilizer_id == fertilizer_id)
            .order_by(FertilizerPrice.effective_from.desc())
        )
    )
    return [_enrich(r, cat) for r in rows]
