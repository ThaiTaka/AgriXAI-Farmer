"""Bảng lịch sử giá phân bón do admin nhập.

Quy tắc nghiệp vụ quan trọng:
- Mỗi lần admin cập nhật giá → INSERT dòng mới, KHÔNG UPDATE/DELETE dòng cũ.
- Điều này giữ toàn bộ lịch sử giá để phân tích chi phí theo thời gian.
- Giá hiện tại của một loại phân = dòng có effective_from lớn nhất.
- Bảng này KHÔNG tham gia /sync với mobile (chỉ đọc-ghi từ backend/web-admin).
"""

import time

from sqlalchemy import BigInteger, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _now_ms() -> int:
    return int(time.time() * 1000)


class FertilizerPrice(Base):
    """Một mốc giá của một loại phân bón tại một thời điểm."""

    __tablename__ = "fertilizer_prices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Mã phân bón tương ứng với fertilizer_id trong shared/data/fertilizer_recommendations.json
    fertilizer_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Giá VNĐ/kg — luôn dương
    price_per_kg: Mapped[float] = mapped_column(Float, nullable=False)

    # Thời điểm giá này có hiệu lực (epoch ms) — thường là ngày admin nhập
    effective_from: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)

    # ID admin đã nhập giá này — chuỗi UUID theo pattern toàn dự án
    updated_by: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Thời điểm record này được tạo trong DB (≥ effective_from)
    created_at: Mapped[int] = mapped_column(BigInteger, default=_now_ms, nullable=False)
