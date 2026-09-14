"""Monthly / quarterly income-expense report as an A4 PDF.

Layout follows the Giai đoạn 4 brief: header (farm, address, period, date),
summary (thu, chi, lãi/lỗ), income lines, expense lines, notes derived from
the data, footer. Text and numbers only, no images.

Open Sans (bundled for the phone in mobile/src/assets/fonts) is embedded so
Vietnamese diacritics and the đồng sign render everywhere — Helvetica, the
PDF core font, cannot show "Nguyễn" or "₫".

The same layout is produced on the phone from HTML
(mobile/src/domain/reportPdf.ts); `report_notes()` here and `reportNotes()`
there implement the identical rules so both documents say the same thing.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from fpdf import FPDF

from app.core.config import REPO_ROOT
from app.services import ledger_service as ledger

FONT_DIR = REPO_ROOT / "mobile" / "src" / "assets" / "fonts"
FONT_REGULAR = FONT_DIR / "OpenSans-Regular.ttf"
FONT_BOLD = FONT_DIR / "OpenSans-Bold.ttf"

SUPPORT_EMAIL = "support@agrilog.vn"
APP_NAME = "AgriLog v2"


def vnd(value: float) -> str:
    return f"{int(round(value)):,}".replace(",", ".") + "₫"


def signed_vnd(value: float) -> str:
    return ("+" if value >= 0 else "−") + vnd(abs(value))


def day_label(occurred_at: int) -> str:
    return datetime.fromtimestamp(occurred_at / 1000, tz=ledger.VN_TZ).strftime("%d/%m")


@dataclass
class ReportNotes:
    fertilizer_lines: list[tuple[str, float]]
    fertilizer_total: float
    stock_kg: float
    stock_value: float
    stock_kinds: int
    avg_monthly_fertilizer: float | None
    months_sampled: int

    def as_lines(self) -> list[str]:
        lines: list[str] = []
        if self.fertilizer_lines:
            parts = " + ".join(vnd(v) for _, v in self.fertilizer_lines)
            lines.append(f"Chi phí phân bón: {parts} = {vnd(self.fertilizer_total)}")
        else:
            lines.append("Chi phí phân bón: không có khoản chi phân bón trong kỳ")
        if self.stock_kinds > 0:
            lines.append(
                f"Còn dư phân bón: {self.stock_kg:g} kg ({self.stock_kinds} loại, ≈ {vnd(self.stock_value)} theo giá nhập bình quân)"
            )
        else:
            lines.append("Còn dư phân bón: kho trống")
        if self.avg_monthly_fertilizer is not None and self.avg_monthly_fertilizer > 0:
            lines.append(
                f"Khuyến nghị: chi phân bón trung bình {vnd(self.avg_monthly_fertilizer)}/tháng "
                f"(tính trên {self.months_sampled} tháng gần nhất) — nên giữ dự phòng khoảng "
                f"{vnd(self.avg_monthly_fertilizer)} mỗi tháng"
            )
        else:
            lines.append("Khuyến nghị: chưa đủ lịch sử chi phân bón để gợi ý mức dự phòng")
        return lines


def report_notes(
    report: ledger.FinancialReport,
    stock_lines: list[ledger.StockLine],
    all_expenses: list,
    period: ledger.Period,
) -> ReportNotes:
    """Notes are computed from the ledger, never typed in: the fertiliser
    costs of the period, what is left in the shed, and a buffer suggestion
    equal to the average fertiliser spend over the three months ending with
    the period."""
    fert = [(r.description, r.amount) for r in report.expenses if r.kind == "fertilizer"]
    in_stock = [l for l in stock_lines if l.stock_kg > 0]

    # Three calendar months ending with the report's last month.
    last_month = period.month if period.month is not None else (period.quarter or 1) * 3
    window_end = datetime(period.year, last_month, 1, tzinfo=ledger.VN_TZ)
    window_end = (window_end + timedelta(days=32)).replace(day=1)
    window_start = window_end
    for _ in range(3):
        window_start = (window_start - timedelta(days=1)).replace(day=1)
    lo, hi = int(window_start.timestamp() * 1000), int(window_end.timestamp() * 1000)

    window_total = sum(r.amount for r in all_expenses if r.kind == "fertilizer" and lo <= r.occurred_at < hi)
    months_with_data = len(
        {
            datetime.fromtimestamp(r.occurred_at / 1000, tz=ledger.VN_TZ).strftime("%Y-%m")
            for r in all_expenses
            if r.kind == "fertilizer" and lo <= r.occurred_at < hi
        }
    )

    return ReportNotes(
        fertilizer_lines=fert,
        fertilizer_total=sum(v for _, v in fert),
        stock_kg=sum(l.stock_kg for l in in_stock),
        stock_value=sum(l.stock_value for l in in_stock),
        stock_kinds=len(in_stock),
        avg_monthly_fertilizer=(window_total / 3) if months_with_data else None,
        months_sampled=3,
    )


class _Report(FPDF):
    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(20, 20, 20)
        self.set_auto_page_break(auto=True, margin=20)
        self.add_font("OpenSans", "", str(FONT_REGULAR))
        self.add_font("OpenSans", "B", str(FONT_BOLD))

    def rule(self) -> None:
        self.set_draw_color(229, 231, 235)
        self.set_line_width(0.3)
        y = self.get_y()
        self.line(20, y, 190, y)
        self.ln(3)

    def heading(self, text: str) -> None:
        self.ln(3)
        self.set_font("OpenSans", "B", 12)
        self.set_text_color(17, 24, 39)
        self.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")
        self.rule()

    def row(self, left: str, right: str, bold: bool = False, muted: bool = False) -> None:
        self.set_font("OpenSans", "B" if bold else "", 10)
        self.set_text_color(107, 114, 128) if muted else self.set_text_color(17, 24, 39)
        self.cell(120, 6.5, left)
        self.cell(50, 6.5, right, align="R", new_x="LMARGIN", new_y="NEXT")

    def line_item(self, day: str, description: str, amount: float) -> None:
        self.set_font("OpenSans", "", 10)
        self.set_text_color(17, 24, 39)
        self.cell(16, 6.5, day)
        self.cell(104, 6.5, _clip(description, 60))
        self.cell(50, 6.5, vnd(amount), align="R", new_x="LMARGIN", new_y="NEXT")


def _clip(value: str, width: int) -> str:
    return value if len(value) <= width else value[: width - 1] + "…"


def build_pdf(
    *,
    farmer_name: str,
    address: str | None,
    report: ledger.FinancialReport,
    notes: ReportNotes,
    generated_at: datetime,
) -> bytes:
    pdf = _Report()
    pdf.add_page()

    pdf.set_font("OpenSans", "B", 16)
    pdf.set_text_color(46, 111, 64)
    pdf.cell(0, 10, "BÁO CÁO THU – CHI NÔNG HỘ", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("OpenSans", "", 10)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(0, 6, f"Nông hộ: {farmer_name}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Địa chỉ: {address or 'Chưa cập nhật'}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(
        0,
        6,
        f"Kỳ: {report.period}  |  Ngày xuất: {generated_at.strftime('%d/%m/%Y')}",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.rule()

    pdf.heading("TÓM TẮT")
    pdf.row("Thu", vnd(report.total_income))
    pdf.row("Chi", vnd(report.total_expense))
    verdict = "LÃI" if report.profit >= 0 else "LỖ"
    pdf.row(f"Lãi/Lỗ  [{verdict}]", signed_vnd(report.profit), bold=True)

    pdf.heading("CHI TIẾT THU")
    if report.incomes:
        for row in report.incomes:
            pdf.line_item(day_label(row.occurred_at), row.description, row.amount)
        pdf.row("Tổng thu", vnd(report.total_income), bold=True)
    else:
        pdf.row("Không có khoản thu trong kỳ", "", muted=True)

    pdf.heading("CHI TIẾT CHI")
    if report.expenses:
        for row in report.expenses:
            pdf.line_item(day_label(row.occurred_at), row.description, row.amount)
        pdf.row("Tổng chi", vnd(report.total_expense), bold=True)
    else:
        pdf.row("Không có khoản chi trong kỳ", "", muted=True)

    pdf.heading("GHI CHÚ")
    pdf.set_font("OpenSans", "", 10)
    pdf.set_text_color(17, 24, 39)
    for line in notes.as_lines():
        pdf.multi_cell(0, 6, f"• {line}", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(6)
    pdf.rule()
    pdf.set_font("OpenSans", "", 9)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(0, 6, f"Được tạo bởi: {APP_NAME}  |  Hỗ trợ: {SUPPORT_EMAIL}", align="C", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())
