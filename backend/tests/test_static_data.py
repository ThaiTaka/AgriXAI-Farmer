"""Integrity of the offline catalogues in shared/data.

The crop catalogue and the care protocols carry a hard rule: nothing in them
may be invented. Every variety and every protocol therefore has to cite the
page it was taken from, the structure the mobile screens rely on must be
complete, and a crop category is either covered by a sourced protocol or
explicitly declared as having no data — never silently missing.
"""

import importlib.util
import re
from pathlib import Path

import pytest

from app.services import static_data

ID_RE = re.compile(r"^[a-z0-9_]+$")
SHARED_DATA = Path(__file__).resolve().parents[2] / "shared" / "data"
CROP_IMAGES = Path(__file__).resolve().parents[2] / "mobile" / "src" / "assets" / "crops"
# Units a protocol may quote an amount in. m³ is how Lâm Đồng's procedures
# measure manure (QĐ 1972/QĐ-UBND); converting it to tonnes would need a bulk
# density the source does not give, so the app keeps the source's unit.
ITEM_UNITS = ("kg", "tấn", "m³")
FREE_LICENCE = re.compile(r"^(CC0|CC BY(-SA)? [0-9.]+( us)?|Public domain)$", re.I)

FERTILIZER_CATEGORIES = {"dam", "lan", "kali", "npk", "huu_co", "vi_sinh", "khac"}
TASK_TYPES = {"fertilize", "water", "cultivate", "scout", "spray", "harvest"}


def _load_builder():
    spec = importlib.util.spec_from_file_location("build_care_protocols", SHARED_DATA / "build_care_protocols.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _catalogue_categories() -> dict[str, set[str]]:
    out: dict[str, set[str]] = {}
    for crop in static_data.load("crop_varieties")["crop_types"]:
        out[crop["id"]] = {c["category_id"] for c in crop["categories"]}
    return out


# ------------------------------ crop catalogue ------------------------------


def test_crop_catalogue_is_three_levels_deep_and_sourced():
    catalogue = static_data.load("crop_varieties")
    crop_types = catalogue["crop_types"]
    assert len(crop_types) >= 4, "tối thiểu: hoa cúc, hoa hồng, cà chua, cà phê"

    seen_variety_ids: set[str] = set()
    seen_crop_ids: set[str] = set()
    for crop in crop_types:
        assert ID_RE.match(crop["id"]), crop["id"]
        assert crop["id"] not in seen_crop_ids
        seen_crop_ids.add(crop["id"])
        assert crop["name"] and crop["icon"] and crop["categories"]

        for category in crop["categories"]:
            assert ID_RE.match(category["category_id"]), category["category_id"]
            assert category["category_name"] and category["description"]
            assert category["varieties"], f"{category['category_id']} không có giống nào"

            for variety in category["varieties"]:
                assert ID_RE.match(variety["id"]), variety["id"]
                assert variety["id"] not in seen_variety_ids, f"trùng id {variety['id']}"
                seen_variety_ids.add(variety["id"])
                for key in ("name", "description", "usage", "growing_note"):
                    assert variety.get(key), f"{variety['id']} thiếu {key}"
                assert variety["source"].startswith("http"), f"{variety['id']} không có nguồn"
                assert variety.get("badge") in (None, "popular", "new", "premium")


def test_catalogue_holds_lam_dong_crops_only():
    """The catalogue was narrowed on 02/10/2026 to crops an official Lâm Đồng
    source shows being grown there (QĐ 1972/QĐ-UBND, QĐ 704 & 729/QĐ-SNN, Địa
    chí Đà Lạt, Báo Lâm Đồng). Adding a crop is fine — but it has to be a
    deliberate change here, with a source, not a silent addition.

    03/10/2026: + 11 Đà Lạt crops that each have their own procedure in QĐ
    1972/QĐ-UBND (hoa salem, lan hồ điệp, lan vũ nữ, bó xôi, đậu Hà Lan, củ dền,
    tỏi tây, cần tây, su su, bơ, hồng ăn trái)."""
    crops = {c["id"] for c in static_data.load("crop_varieties")["crop_types"]}
    assert crops == {
        "chrysanthemum", "rose", "carnation", "gerbera", "lily", "gladiolus", "lisianthus",
        "tomato", "chili", "cucumber", "cabbage", "napa_cabbage", "cauliflower", "lettuce", "water_spinach",
        "carrot", "potato", "strawberry", "rice", "corn",
        "artichoke", "coffee", "tea",
        "limonium", "phalaenopsis", "oncidium",
        "spinach", "garden_pea", "beetroot", "leek", "celery", "chayote",
        "avocado", "persimmon",
    }


def test_the_eight_required_crops_are_in_the_catalogue():
    """Đồ án bắt buộc tám loài cây (xem mobile/__tests__/cropIdentity.test.ts);
    lọc theo Lâm Đồng không được làm rơi loài nào — cả tám đều trồng ở tỉnh."""
    names = {c["name"] for c in static_data.load("crop_varieties")["crop_types"]}
    assert {"Cà chua", "Ớt", "Dưa leo", "Cà rốt", "Rau muống", "Bắp cải", "Lúa", "Ngô"} <= names


def test_every_crop_has_a_credited_freely_licensed_photo():
    """The variety picker shows a photo of the crop. Each one is bundled in the
    app (works offline) and must carry author, licence and the Commons page, or
    the app would be using someone's picture without the credit it requires."""
    for crop in static_data.load("crop_varieties")["crop_types"]:
        image = crop.get("image")
        assert image, f"{crop['id']} chưa có ảnh"
        assert image["author"] and image["source_url"].startswith("https://commons.wikimedia.org/"), crop["id"]
        assert FREE_LICENCE.match(image["license"]), f"{crop['id']}: giấy phép {image['license']}"
        assert (CROP_IMAGES / image["file"]).is_file(), f"thiếu tệp ảnh {image['file']}"


# ------------------------------ care protocols ------------------------------


def test_care_protocols_json_is_the_merge_of_the_seed_files():
    """care_protocols.json is generated; a hand edit that is not in a seed
    file would be a number without a source."""
    builder = _load_builder()
    assert builder.build() == static_data.load("care_protocols"), (
        "shared/data/care_protocols.json lệch với các file seed — chạy build_care_protocols.py"
    )


def test_every_care_protocol_is_sourced_and_well_formed():
    data = static_data.load("care_protocols")
    categories = _catalogue_categories()
    products = {p["id"] for p in static_data.load("fertilizer_recommendations")["products"]}
    seen_ids: set[str] = set()

    assert len(data["protocols"]) >= 7
    for protocol in data["protocols"]:
        pid = protocol["id"]
        assert ID_RE.match(pid) and pid not in seen_ids, pid
        seen_ids.add(pid)
        assert protocol["crop_type"] in categories, pid

        source = protocol["source"]
        assert source["url"].startswith("http"), f"{pid} không có URL nguồn"
        assert source["publisher"] and source["title"] and source["collected_at"], pid
        assert protocol["disclaimer"], f"{pid} phải có dòng cảnh báo tham khảo"
        assert protocol["stage_model"] in ("growth", "calendar"), pid
        assert protocol["basis"] in ("commercial", "nutrient"), pid
        assert protocol["reference_area"]["m2"] > 0, pid

        if protocol["category_ids"] is not None:
            assert protocol["category_ids"], pid
            for cat in protocol["category_ids"]:
                assert cat in categories[protocol["crop_type"]], f"{pid}: loại con {cat} không có trong danh mục"

        assert protocol["scenarios"], f"{pid} không có phương án"
        item_keys_per_scenario: list[set[str]] = []
        for scenario in protocol["scenarios"]:
            assert ID_RE.match(scenario["id"]) and scenario["name"], pid
            keys: set[str] = set()
            for item in scenario["items"]:
                assert ID_RE.match(item["key"]) and item["key"] not in keys, f"{pid}/{scenario['id']}: {item}"
                keys.add(item["key"])
                assert item["name"] and item["unit"] in ITEM_UNITS, item
                assert item["fertilizer_category"] in FERTILIZER_CATEGORIES, item
                assert 0 <= item["min"] <= item["max"], item
                assert item["price_product_id"] is None or item["price_product_id"] in products, (
                    f"{pid}: {item['price_product_id']} không có trong danh mục phân bón"
                )
                if protocol["basis"] == "nutrient" and "nutrient" in item:
                    factors = data["$meta"]["conversion"][protocol["crop_type"]]["factors"]
                    assert item["nutrient"] in factors, item
            item_keys_per_scenario.append(keys)

        all_keys = set().union(*item_keys_per_scenario)
        for app in protocol["base_application"]["applications"]:
            assert app["item_key"] in all_keys, f"{pid}: bón lót tham chiếu {app['item_key']}"

        assert len(protocol["stages"]) == 4, f"{pid} phải có đúng 4 giai đoạn"
        stage_codes: set[str] = set()
        for stage in protocol["stages"]:
            assert stage["stage_code"] not in stage_codes, pid
            stage_codes.add(stage["stage_code"])
            assert stage["stage_name_vi"] and stage["timing"], pid
            assert stage["tasks"], f"{pid}/{stage['stage_code']} không có công việc"
            for app in stage["applications"]:
                assert app["item_key"] in all_keys, f"{pid}/{stage['stage_code']}: {app}"
                assert 0 < app["pct"] <= 100
            for task in stage["tasks"]:
                assert ID_RE.match(task["key"]) and task["title"] and task["detail"], task
                assert task["type"] in TASK_TYPES, task
            if protocol["stage_model"] == "growth":
                assert stage["growth_stages"], f"{pid}/{stage['stage_code']} thiếu ánh xạ giai đoạn cây"
                assert set(stage["growth_stages"]) <= set(data["$meta"]["stage_codes"])
            else:
                assert stage["months"], f"{pid}/{stage['stage_code']} thiếu tháng"


def test_every_crop_category_is_covered_or_declared_unavailable():
    """No silent gaps: for each (crop, category) exactly one of the two holds."""
    data = static_data.load("care_protocols")
    categories = _catalogue_categories()
    unavailable = {(u["crop_type"], u["category_id"]) for u in data["unavailable"]}

    for entry in data["unavailable"]:
        assert entry["reason"] and entry["suggested_sources"], entry
        assert all(s["url"].startswith("http") for s in entry["suggested_sources"]), entry
        assert entry["category_id"] in categories[entry["crop_type"]], entry

    for crop, cats in categories.items():
        for cat in cats:
            covered = any(
                p["crop_type"] == crop and (p["category_ids"] is None or cat in p["category_ids"])
                for p in data["protocols"]
            )
            declared = (crop, cat) in unavailable
            assert covered != declared, f"{crop}/{cat}: phải hoặc có quy trình, hoặc khai báo 'Chưa có dữ liệu' (không cả hai, không thiếu)"


def test_the_declared_gaps_are_exactly_the_ones_we_know_about():
    """Khoảng trống phải được liệt kê ra, không được âm thầm mọc thêm.

    Chè Đài Loan có quy trình (QĐ 1972/QĐ-UBND) nhưng bón theo lứa hái chứ
    không theo tháng hay giai đoạn sinh trưởng, nên ứng dụng chưa mô tả được và
    khai báo rõ ở đây thay vì ép số liệu vào một lịch không đúng. Rau muống có
    trồng ở Lâm Đồng nhưng bộ 120 quy trình của tỉnh không có quy trình cho nó.
    Lan hồ điệp và lan vũ nữ có quy trình nhưng bón theo nồng độ pha và theo
    chậu (g/10 lít nước), không theo diện tích — công cụ tính theo ha, sào không
    áp dụng được.
    """
    data = static_data.load("care_protocols")
    assert {u["category_id"] for u in data["unavailable"]} == {
        "tea_taiwan",
        "water_spinach_la_tre",
        "phalaenopsis_large",
        "phalaenopsis_medium",
        "phalaenopsis_mini",
        "oncidium_cut",
    }


def test_crops_without_a_protocol_still_carry_sourced_varieties():
    """Một cây chưa có quy trình vẫn phải chọn được giống — nếu không, thêm
    nó vào danh mục chỉ tạo ra một ngõ cụt cho bà con."""
    data = static_data.load("care_protocols")
    with_protocol = {p["crop_type"] for p in data["protocols"]}
    for crop in static_data.load("crop_varieties")["crop_types"]:
        if crop["id"] in with_protocol:
            continue
        varieties = [v for cat in crop["categories"] for v in cat["varieties"]]
        assert varieties, f"{crop['id']} không có quy trình mà cũng không có giống nào"
        for variety in varieties:
            assert variety["source"].startswith("http"), f"{variety['id']} không có nguồn"


def test_tomato_scenario_scales_linearly_with_area():
    """F1 reference: cà chua trồng trên đất (QĐ 1972/QĐ-UBND) — urê 522 kg/ha,
    phân chuồng 40 tấn/ha — on a 300 m² plot."""
    data = static_data.load("care_protocols")
    tomato = next(p for p in data["protocols"] if p["id"] == "tomato_lamdong_2025")
    scenario = next(s for s in tomato["scenarios"] if s["id"] == "tren_dat")
    factor = 300 / tomato["reference_area"]["m2"]
    ure = next(i for i in scenario["items"] if i["key"] == "ure")
    assert ure["min"] * factor == pytest.approx(15.66)
    manure = next(i for i in scenario["items"] if i["key"] == "phan_chuong")
    assert manure["unit"] == "tấn" and manure["min"] * factor == pytest.approx(1.2)


def test_round_percentages_add_up_to_the_season():
    """Base + stage applications never hand out more than the season's amount
    of any fertiliser, and a table the source splits completely sums to 100."""
    for protocol in static_data.load("care_protocols")["protocols"]:
        totals: dict[str, float] = {}
        for app in protocol["base_application"]["applications"]:
            totals[app["item_key"]] = totals.get(app["item_key"], 0) + app["pct"]
        for stage in protocol["stages"]:
            for app in stage["applications"]:
                totals[app["item_key"]] = totals.get(app["item_key"], 0) + app["pct"]
        for key, total in totals.items():
            assert total <= 100.0001, f"{protocol['id']}: {key} bón {total}% > 100%"
    chrysanthemum = next(p for p in static_data.load("care_protocols")["protocols"] if p["id"] == "chrysanthemum_lamdong_2025")
    for key in ("ure", "super_lan", "kcl"):
        share = sum(a["pct"] for a in chrysanthemum["base_application"]["applications"] if a["item_key"] == key)
        share += sum(a["pct"] for s in chrysanthemum["stages"] for a in s["applications"] if a["item_key"] == key)
        assert share == pytest.approx(100), key


def test_care_protocols_use_catalogue_crop_ids():
    crops = {c["id"] for c in static_data.load("crop_varieties")["crop_types"]}
    for protocol in static_data.load("care_protocols")["protocols"]:
        assert protocol["crop_type"] in crops, protocol["crop_type"]


# -------------------------------- fertilisers -------------------------------


def test_fertilizer_groups_without_prices_are_declared_not_faked():
    data = static_data.load("fertilizer_recommendations")
    priced = {p["category"] for p in data["products"]}
    declared_missing = {c["code"] for c in data["categories_without_price_data"]}
    for category in data["categories"]:
        code = category["code"]
        assert (code in priced) != (code in declared_missing), (
            f"nhóm {code} phải hoặc có giá, hoặc được khai báo là chưa có giá"
        )


def test_budget_tiers_match_the_price_per_kg_bands():
    """F3: tier = price/kg band from the data file, never a fixed amount in code."""
    data = static_data.load("fertilizer_recommendations")
    tiers = data["budget_tiers"]
    assert [t["code"] for t in tiers] == ["binh_dan", "trung_binh", "cao_cap"]
    binh_dan, trung_binh = tiers[0]["max_price_per_kg"], tiers[1]["max_price_per_kg"]
    for product in data["products"]:
        avg = product["price_per_kg_avg"]
        expected = "binh_dan" if avg <= binh_dan else "trung_binh" if avg <= trung_binh else "cao_cap"
        assert product["budget_tier"] == expected, f"{product['id']}: {avg}đ/kg phải là {expected}"
        assert product["price_per_kg_min"] == round(product["price_min"] / product["pack_size_kg"])


def test_dalat_crops_added_on_03_10_2026_copy_their_procedures():
    """Spot-check of the crops added on 03/10/2026 against QĐ 1972/QĐ-UBND —
    the season totals each procedure states, kg/ha."""
    protocols = {p["id"]: p for p in static_data.load("care_protocols")["protocols"]}

    def amount(pid: str, key: str, scenario: int = 0) -> tuple[float, float]:
        item = next(i for i in protocols[pid]["scenarios"][scenario]["items"] if i["key"] == key)
        return item["min"], item["max"]

    assert amount("limonium_lamdong_2025", "ure") == (240, 240)  # IV.9: 240 urê + 750 super lân + 183 KCl
    assert amount("limonium_lamdong_2025", "kcl") == (183, 183)
    assert amount("spinach_lamdong_2025", "ure") == (152, 152)  # III.3: 152 urê + 688 super lân + 167 KCl
    assert amount("spinach_lamdong_2025", "npk_15_15_15", scenario=1) == (467, 467)
    assert amount("garden_pea_lamdong_2025", "npk_15_5_20") == (750, 750)  # III.18
    assert amount("beetroot_lamdong_2025", "super_lan") == (400, 400)  # III.30: 180 urê + 400 super lân + 150 KCl
    assert amount("leek_lamdong_2025", "kcl") == (200, 200)  # III.28: 195 urê + 242 super lân + 200 KCl
    assert amount("celery_lamdong_2025", "ure") == (350, 350)  # III.10: 350 urê + 600 super lân + 300 KCl
    assert amount("chayote_fruit_lamdong_2025", "ure") == (390, 390)  # III.24, lấy quả
    assert amount("chayote_shoot_lamdong_2025", "ure") == (434, 434)  # III.24, lấy đọt
    assert amount("avocado_kd_lamdong_2025", "super_lan") == (1511, 1511)  # I.1, kinh doanh
    assert amount("persimmon_kd_lamdong_2025", "kcl") == (500, 500)  # I.6, năm thứ 5 trở đi

    # Su su: two procedures in one document — the farmer picks lấy quả or lấy đọt.
    assert {p["id"] for p in protocols.values() if p["crop_type"] == "chayote"} == {
        "chayote_fruit_lamdong_2025",
        "chayote_shoot_lamdong_2025",
    }
    # Hồng kinh doanh: lần 1 tháng 11–12, lần 2 tháng 2–3, lần 3 tháng 4–5.
    months = {s["stage_code"]: s["months"] for s in protocols["persimmon_kd_lamdong_2025"]["stages"]}
    assert months["lan_1"] == [11, 12] and months["lan_2"] == [2, 3] and months["lan_3"] == [4, 5]


def test_a_month_belongs_to_one_stage_at_most():
    """The phone shows the stage of the current month; two stages claiming the
    same month would hide one of them."""
    for protocol in static_data.load("care_protocols")["protocols"]:
        if protocol["stage_model"] != "calendar":
            continue
        seen: dict[int, str] = {}
        for stage in protocol["stages"]:
            for month in stage["months"]:
                assert 1 <= month <= 12, protocol["id"]
                assert month not in seen, f"{protocol['id']}: tháng {month} thuộc cả {seen[month]} và {stage['stage_code']}"
                seen[month] = stage["stage_code"]
