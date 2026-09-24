"""V2.1 — lịch sử trồng trọt, gợi ý cây theo năng suất, chi phí của lô.

Lịch sử trồng trọt chính là bảng `crop_cycles` mà tab "Vụ trồng" trên điện
thoại ghi qua /sync — không có bảng thứ hai. Năng suất tính trên diện tích
*lúc trồng*, để đo lại lô sau này không làm đổi năng suất năm ngoái.
"""

from datetime import datetime

import pytest

from app.services import cultivation as cult
from v21_support import admin, assign_plot, client, make_farmer, push


def ms(day: str) -> int:
    return int(datetime.fromisoformat(f"{day}T08:00:00+07:00").timestamp() * 1000)


@pytest.fixture(scope="module")
def hoa():
    return make_farmer("v21_cult_hoa")


@pytest.fixture(scope="module")
def binh():
    return make_farmer("v21_cult_binh")


def add_cycle(headers, plot_id, name, crop_type, start, end=None, yield_kg=None, **extra):
    return client.post(
        f"/plots/{plot_id}/cultivation-history",
        headers=headers,
        json={"name": name, "crop_type": crop_type, "started_at": ms(start),
              "ended_at": ms(end) if end else None, "yield_kg": yield_kg, **extra},
    )


# ----------------------------- pure arithmetic -----------------------------


def test_season_follows_the_sowing_month_in_vietnam_time():
    assert cult.season_of(ms("2025-01-01")) == "spring"
    assert cult.season_of(ms("2025-03-31")) == "spring"
    assert cult.season_of(ms("2025-04-01")) == "summer"
    assert cult.season_of(ms("2025-09-30")) == "autumn"
    assert cult.season_of(ms("2025-12-31")) == "winter"
    # 00:30 on 1 April in Hà Nội is still 31 March in UTC — Vietnam time wins.
    assert cult.season_of(int(datetime.fromisoformat("2025-04-01T00:30:00+07:00").timestamp() * 1000)) == "summer"


def test_productivity_is_kg_per_thousand_square_metres():
    assert cult.productivity(1380, 300) == 4600.0
    assert cult.productivity(80, 1000) == 80.0
    assert cult.productivity(None, 300) is None
    assert cult.productivity(100, 0) is None
    assert cult.productivity(0, 300) is None


def test_vietnamese_number_format():
    assert cult.vn_number(4600) == "4.600"
    assert cult.vn_number(82.5) == "82,5"
    assert cult.vn_number(1234567.0) == "1.234.567"


def test_area_units_convert_to_square_metres():
    assert cult.area_in_m2(2, "sao_bac") == 720
    assert cult.area_in_m2(0.5, "ha") == 5000
    assert cult.area_in_m2(300, "m2") == 300


# ------------------------------- the endpoints ------------------------------


def test_record_a_past_season_after_the_fact(hoa):
    plot = assign_plot(hoa, area=1000)
    res = add_cycle(hoa, plot, "Vụ Xuân 2025 — Cà rốt", "carrot", "2025-02-10", "2025-05-20", 80)
    assert res.status_code == 201, res.text
    body = res.json()
    # Defaults the farmer did not have to type.
    assert body["season"] == "spring" and body["season_label"] == "Vụ Xuân 2025"
    assert body["area_m2"] == 1000
    assert body["stage"] == "finished"
    assert body["crop_name"] == "Cà rốt"
    # The prompt's example: 80 kg on 1.000 m².
    assert body["productivity"] == 80.0

    listed = client.get(f"/plots/{plot}/cultivation-history", headers=hoa).json()
    assert [c["id"] for c in listed] == [body["id"]]


def test_area_defaults_to_the_plot_area_in_square_metres(hoa):
    plot = assign_plot(hoa, area=0.5, unit="ha")
    body = add_cycle(hoa, plot, "Vụ Hè", "corn", "2025-05-01", "2025-08-01", 2500).json()
    assert body["area_m2"] == 5000
    assert body["productivity"] == 500.0


def test_only_one_crop_grows_at_a_time(hoa):
    plot = assign_plot(hoa)
    assert add_cycle(hoa, plot, "Vụ đang trồng", "tomato", "2026-08-01").status_code == 201
    second = add_cycle(hoa, plot, "Vụ nữa", "tomato", "2026-08-15")
    assert second.status_code == 409
    # A finished past season can still be written down alongside it.
    assert add_cycle(hoa, plot, "Vụ cũ", "tomato", "2025-02-01", "2025-05-01", 900).status_code == 201


def test_end_a_cycle_and_reject_impossible_dates(hoa):
    plot = assign_plot(hoa, area=500)
    cycle = add_cycle(hoa, plot, "Vụ Thu", "cabbage", "2026-08-01").json()
    bad = client.patch(f"/cultivation-history/{cycle['id']}", headers=hoa, json={"ended_at": ms("2026-07-01")})
    assert bad.status_code == 422
    done = client.patch(
        f"/cultivation-history/{cycle['id']}", headers=hoa, json={"ended_at": ms("2026-11-01"), "yield_kg": 1750}
    ).json()
    assert done["stage"] == "finished"
    assert done["productivity"] == 3500.0
    assert add_cycle(hoa, plot, "Vụ Đông", "cabbage", "2026-11-05", None, None, season="winter").status_code == 201
    assert add_cycle(hoa, plot, "Sai ngày", "cabbage", "2026-11-05", "2026-10-01").status_code == 422


def test_a_farm_never_reaches_another_farms_history(hoa, binh):
    plot = assign_plot(hoa)
    cycle = add_cycle(hoa, plot, "Vụ riêng", "tomato", "2025-02-01", "2025-05-01", 1000).json()
    assert client.get(f"/plots/{plot}/cultivation-history", headers=binh).status_code == 404
    assert client.patch(f"/cultivation-history/{cycle['id']}", headers=binh, json={"name": "x"}).status_code == 404
    assert client.delete(f"/cultivation-history/{cycle['id']}", headers=binh).status_code == 404
    assert client.get(f"/plots/{plot}/recommend-crops", headers=binh).status_code == 404
    # An admin may read and correct any farm; the row stays the farm's.
    assert client.get(f"/plots/{plot}/cultivation-history", headers=admin()).status_code == 200


def test_delete_hides_the_season(hoa):
    plot = assign_plot(hoa)
    cycle = add_cycle(hoa, plot, "Nhập nhầm", "tomato", "2025-02-01", "2025-05-01", 10).json()
    assert client.delete(f"/cultivation-history/{cycle['id']}", headers=hoa).status_code == 204
    assert client.get(f"/plots/{plot}/cultivation-history", headers=hoa).json() == []


def test_a_season_written_on_the_phone_is_the_same_record(hoa):
    """The phone writes crop_cycles through /sync; REST reads the same rows."""
    plot = assign_plot(hoa, area=300)
    stamp = ms("2026-06-05")
    push(hoa, {"crop_cycles": {"created": [{
        "id": "v21-phone-cycle", "plot_id": plot, "name": "Vụ Xuân 2026", "crop_type": "tomato",
        "crop_name": "Cà chua", "variety_id": None, "variety_name": None, "stage": "finished",
        "season": "spring", "started_at": ms("2026-02-03"), "ended_at": stamp, "area_m2": 300,
        "yield_kg": 1230, "notes": None, "media_json": None, "owner_id": "x", "updated_by": "device",
        "created_at": stamp, "updated_at": stamp,
    }], "updated": [], "deleted": []}})
    listed = client.get(f"/plots/{plot}/cultivation-history", headers=hoa).json()
    assert listed[0]["id"] == "v21-phone-cycle"
    assert listed[0]["productivity"] == 4100.0


# ------------------------------ recommendation ------------------------------


def test_recommend_ranks_crops_by_average_productivity(hoa):
    """The prompt's case: carrot 80, potato 90 → potato first."""
    plot = assign_plot(hoa, area=1000)
    add_cycle(hoa, plot, "Xuân 2024 — Cà rốt", "carrot", "2024-02-01", "2024-05-01", 80)
    add_cycle(hoa, plot, "Xuân 2025 — Khoai tây", "potato", "2025-02-01", "2025-05-01", 90, crop_name="Khoai tây")
    add_cycle(hoa, plot, "Đông 2025 — Bắp cải", "cabbage", "2025-10-01", "2026-01-10", 3000)

    spring = client.get(f"/plots/{plot}/recommend-crops", params={"season": "spring"}, headers=hoa).json()
    assert [s["crop_type"] for s in spring] == ["potato", "carrot"]
    top = spring[0]
    assert top["crop_name"] == "Khoai tây"
    assert top["basis"] == "same_season"
    assert top["avg_productivity"] == 90.0
    assert top["reason"].startswith("Năng suất tốt nhất trên lô này trong vụ xuân: 90 kg/1.000 m²")
    assert top["history"][0]["year"] == 2025

    # The cabbage winter never counts towards a spring suggestion...
    assert "cabbage" not in [s["crop_type"] for s in spring]
    # ...and with no summer on record, every season is used and it says so.
    summer = client.get(f"/plots/{plot}/recommend-crops", params={"season": "summer"}, headers=hoa).json()
    assert summer[0]["crop_type"] == "cabbage"
    assert {s["basis"] for s in summer} == {"all_seasons"}
    assert summer[0]["reason"].startswith("Lô chưa có vụ hè nào ghi sản lượng")


def test_recommend_averages_repeat_seasons_and_skips_unusable_ones(hoa):
    plot = assign_plot(hoa, area=300)
    add_cycle(hoa, plot, "Xuân 2025 — Cà chua", "tomato", "2025-02-05", "2025-05-25", 1380)
    add_cycle(hoa, plot, "Xuân 2026 — Cà chua", "tomato", "2026-02-03", "2026-06-05", 1230)
    add_cycle(hoa, plot, "Xuân 2024 — Dưa leo (quên cân)", "cucumber", "2024-02-01", "2024-04-01", None)
    body = client.get(f"/plots/{plot}/recommend-crops", params={"season": "spring"}, headers=hoa).json()
    assert len(body) == 1
    tomato = body[0]
    assert tomato["cycles"] == 2
    assert tomato["avg_productivity"] == 4350.0
    assert tomato["best_productivity"] == 4600.0
    assert tomato["best_cycle_name"] == "Xuân 2025 — Cà chua"


def test_recommend_is_empty_without_harvests(hoa):
    plot = assign_plot(hoa)
    assert client.get(f"/plots/{plot}/recommend-crops", headers=hoa).json() == []


def test_demo_farm_suggests_tomato_for_spring():
    """The demo household's history, as seeded for the presentation."""
    from v21_support import login

    thai = login("lethanhthai", "matkhau123")
    body = client.get(
        "/plots/demo-plot-puc-001-hb/recommend-crops", params={"season": "spring"}, headers=thai
    ).json()
    assert body[0]["crop_type"] == "tomato"
    assert body[0]["avg_productivity"] == 4350.0


# -------------------------------- plot costs --------------------------------


def test_cost_summary_is_seed_plus_fertiliser_plus_labour(hoa):
    plot = assign_plot(hoa)

    def expense(**row):
        res = client.post("/expense", headers=hoa, json={"occurred_at": ms("2026-09-05"), "plot_id": plot, **row})
        assert res.status_code == 201, res.text

    expense(kind="seed", description="Hạt giống cà chua", amount=250_000)
    expense(kind="labor", description="Công làm đất", amount=300_000)
    expense(kind="utilities", description="Điện bơm", amount=50_000)
    # Fertiliser spread straight away, never in the shed: counts.
    expense(kind="fertilizer", description="Phân chuồng", amount=100_000)
    # A shed purchase counts only when it is issued onto the plot (below).
    stock = client.post("/warehouse/in", headers=hoa, json={
        "fertilizer_id": "ure_ca_mau", "fertilizer_name": "Urê Cà Mau", "quantity": 50, "unit": "kg",
        "price": 680_000, "occurred_at": ms("2026-09-01"), "plot_id": plot, "record_expense": True,
    })
    assert stock.status_code == 201, stock.text
    issue = client.post("/warehouse/out", headers=hoa, json={
        "fertilizer_id": "ure_ca_mau", "fertilizer_name": "Urê Cà Mau", "quantity_kg": 10,
        "occurred_at": ms("2026-09-06"), "plot_id": plot,
    })
    assert issue.status_code == 201, issue.text

    costs = client.get(f"/plots/{plot}/cost-summary", headers=hoa).json()
    assert costs["seed"] == 250_000
    assert costs["labor"] == 300_000
    assert costs["fertilizer"] == 100_000 + 136_000  # 10 kg × 13.600₫ FIFO
    assert costs["other"] == 50_000
    assert costs["total"] == 250_000 + 300_000 + 236_000 + 50_000

    before = client.get(
        f"/plots/{plot}/cost-summary", params={"end": ms("2026-09-04")}, headers=hoa
    ).json()
    assert before["total"] == 0
