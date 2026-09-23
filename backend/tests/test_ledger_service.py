"""Stock and finance arithmetic (app/services/ledger_service.py).

The numbers here are the mock-up farm from the Giai đoạn 3 brief — Nguyễn Văn
Thái, PUC-001-HB — so the same figures can be checked on the phone.
"""

from datetime import datetime

import pytest

from app.services import ledger_service as ledger


def ms(day: str) -> int:
    return int(datetime.fromisoformat(f"{day}T08:00:00+07:00").timestamp() * 1000)


# 2026-09-10: Urê Cà Mau 50 kg for 680.000₫  -> 13.600₫/kg
# 2026-09-12: Urê Cà Mau 50 kg for 700.000₫  -> 14.000₫/kg (a second, dearer lot)
INS = [
    ledger.InRow("ure_ca_mau", 50, 13_600, ms("2026-09-10"), 1),
    ledger.InRow("ure_ca_mau", 50, 14_000, ms("2026-09-12"), 2),
    ledger.InRow("dap_han_quoc", 50, 22_000, ms("2026-09-10"), 3),
]


def test_to_kg_handles_tonnes_and_rejects_unknown_units():
    assert ledger.to_kg(1.5, "tan") == 1500
    assert ledger.to_kg(20, "kg") == 20
    with pytest.raises(ValueError):
        ledger.to_kg(1, "bao")


def test_fifo_takes_the_oldest_lot_first():
    result = ledger.fifo_cost(INS, [], "ure_ca_mau", 30, ms("2026-09-15"))
    assert result.unit_price == 13_600
    assert result.total_cost == 30 * 13_600
    assert result.shortfall_kg == 0


def test_fifo_spans_lots_with_a_weighted_price():
    # 50 kg from lot 1 (13.600) + 10 kg from lot 2 (14.000) = 60 kg
    result = ledger.fifo_cost(INS, [], "ure_ca_mau", 60, ms("2026-09-15"))
    assert result.total_cost == 50 * 13_600 + 10 * 14_000
    assert result.unit_price == pytest.approx((50 * 13_600 + 10 * 14_000) / 60)


def test_fifo_replays_earlier_issues_before_pricing_a_new_one():
    outs = [ledger.OutRow("ure_ca_mau", 40, ms("2026-09-13"), 1)]
    # Lot 1 has 10 kg left; 20 kg = 10 @ 13.600 + 10 @ 14.000
    result = ledger.fifo_cost(INS, outs, "ure_ca_mau", 20, ms("2026-09-15"))
    assert result.total_cost == 10 * 13_600 + 10 * 14_000
    assert result.unit_price == 13_800


def test_fifo_ignores_purchases_dated_after_the_issue():
    result = ledger.fifo_cost(INS, [], "ure_ca_mau", 60, ms("2026-09-11"))
    # Only the 10/09 lot exists on 11/09 -> 50 kg available, 10 kg short.
    assert result.consumed_kg == 50
    assert result.shortfall_kg == 10
    assert result.unit_price == 13_600


def test_fifo_of_an_unknown_fertiliser_is_a_full_shortfall():
    result = ledger.fifo_cost(INS, [], "kali_bot_ca_mau", 5, ms("2026-09-15"))
    assert result.consumed_kg == 0
    assert result.shortfall_kg == 5
    assert result.unit_price == 0


class _Row:
    def __init__(self, **kw):
        self.__dict__.update(kw)


def test_stock_summary_formula():
    ins = [
        _Row(fertilizer_id="ure_ca_mau", fertilizer_name="Urê Cà Mau", category="dam", quantity_kg=50, unit_price=13_600, occurred_at=ms("2026-09-10")),
        _Row(fertilizer_id="ure_ca_mau", fertilizer_name="Urê Cà Mau", category="dam", quantity_kg=50, unit_price=14_000, occurred_at=ms("2026-09-12")),
        _Row(fertilizer_id="dap_han_quoc", fertilizer_name="DAP Hàn Quốc (nhập khẩu)", category="lan", quantity_kg=50, unit_price=22_000, occurred_at=ms("2026-09-10")),
    ]
    outs = [
        _Row(fertilizer_id="ure_ca_mau", fertilizer_name="Urê Cà Mau", category="dam", quantity_kg=30, total_cost=30 * 13_600),
    ]
    lines = {l.fertilizer_id: l for l in ledger.stock_summary(ins, outs)}

    ure = lines["ure_ca_mau"]
    assert ure.in_kg == 100 and ure.out_kg == 30
    assert ure.stock_kg == 70  # Tồn = Σ nhập − Σ xuất
    assert ure.avg_price == (50 * 13_600 + 50 * 14_000) / 100  # = 13.800
    assert ure.stock_value == 70 * 13_800  # Tổng tiền = tồn × giá TB
    assert ure.latest_unit_price == 14_000

    dap = lines["dap_han_quoc"]
    assert dap.stock_kg == 50 and dap.avg_price == 22_000 and dap.stock_value == 1_100_000


def test_period_bounds_are_vietnam_local_months_and_quarters():
    start, end = ledger.Period(2026, month=9).bounds_ms()
    assert ledger.in_period(ms("2026-09-01"), ledger.Period(2026, month=9))
    assert not ledger.in_period(ms("2026-08-31"), ledger.Period(2026, month=9))
    assert not ledger.in_period(ms("2026-10-01"), ledger.Period(2026, month=9))
    assert start < end

    q3 = ledger.Period(2026, quarter=3)
    assert ledger.in_period(ms("2026-07-01"), q3)
    assert ledger.in_period(ms("2026-09-30"), q3)
    assert not ledger.in_period(ms("2026-10-01"), q3)
    assert ledger.Period(2026, quarter=4).bounds_ms()[1] == ledger.Period(2027, month=1).bounds_ms()[0]
    assert ledger.Period(2026, month=12).bounds_ms()[1] == ledger.Period(2027, month=1).bounds_ms()[0]


def _mock_farm():
    incomes = [
        _Row(kind="product", description="Bán cà chua MV1 50kg", amount=1_500_000, occurred_at=ms("2026-09-01"), note="Bán cho cửa hàng Kim Hạnh", checked=True),
    ]
    expenses = [
        _Row(kind="labor", description="Công bón phân (3 công)", amount=300_000, occurred_at=ms("2026-09-05"), note=None, checked=False),
        _Row(kind="utilities", description="Điện nước", amount=120_000, occurred_at=ms("2026-09-10"), note=None, checked=False),
        _Row(kind="fertilizer", description="Mua Urê Cà Mau 50 kg", amount=680_000, occurred_at=ms("2026-09-10"), note="Mua ở sfarm Hà Nội", checked=False),
        _Row(kind="fertilizer", description="Mua DAP 50 kg", amount=1_100_000, occurred_at=ms("2026-09-10"), note="East-West hạt giống", checked=False),
        _Row(kind="other", description="Ngoài kỳ", amount=999, occurred_at=ms("2026-08-30"), note=None, checked=False),
    ]
    return incomes, expenses


def test_financial_report_totals_and_profit():
    incomes, expenses = _mock_farm()
    report = ledger.financial_report(incomes, expenses, ledger.Period(2026, month=9))

    assert report.total_income == 1_500_000
    assert report.total_expense == 300_000 + 120_000 + 680_000 + 1_100_000
    assert report.profit == 1_500_000 - 2_200_000  # lỗ 700.000₫
    assert report.expense_by_kind == {"labor": 300_000, "utilities": 120_000, "fertilizer": 1_780_000}
    assert [d["date"] for d in report.daily] == ["2026-09-01", "2026-09-05", "2026-09-10"]
    assert report.daily[2] == {"date": "2026-09-10", "income": 0.0, "expense": 1_900_000}
    assert len(report.expenses) == 4, "khoản chi tháng 8 phải nằm ngoài báo cáo tháng 9"


def test_financial_csv_layout():
    incomes, expenses = _mock_farm()
    report = ledger.financial_report(incomes, expenses, ledger.Period(2026, month=9))
    lines = ledger.financial_csv(report).splitlines()

    # One cell holding the label; the comma inside it is what forces the quotes.
    assert lines[0] == '"Tháng 9, Năm 2026"'
    assert lines[1] == "Thu,1.500.000₫,Chi,2.200.000₫,Lãi lỗ,-700.000₫"
    assert lines[3].startswith("Loại,Ngày,Nhóm,Mô tả,Số tiền")
    assert "Thu,2026-09-01,Sản phẩm,Bán cà chua MV1 50kg,1.500.000₫,Bán cho cửa hàng Kim Hạnh,x" in lines
    assert lines[-1].startswith("Tổng,")
    assert lines[-1].endswith("Lãi lỗ -700.000₫")


def test_stock_csv_has_totals_row():
    ins = [_Row(fertilizer_id="ure_ca_mau", fertilizer_name="Urê Cà Mau", category="dam", quantity_kg=50, unit_price=13_600, occurred_at=ms("2026-09-10"))]
    csv_text = ledger.stock_csv(ledger.stock_summary(ins, []))
    lines = csv_text.splitlines()
    assert lines[0].startswith("Phân bón,Nhập (kg),Xuất (kg),Tồn (kg)")
    assert lines[1] == "Urê Cà Mau,50,0,50,13.600₫,680.000₫"
    assert lines[-1] == "Tổng,,,50,,680.000₫"
