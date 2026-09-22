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
    assert len(crop_types) >= 4, "cà chua, cà phê, dưa leo, ớt là tối thiểu"

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


def test_tomato_keeps_the_original_eight_varieties():
    """Plots already linked to a tomato variety must keep working after the
    restructure, so the eight original ids from crop_varieties_seed.json stay."""
    catalogue = static_data.load("crop_varieties")
    tomato = next(c for c in catalogue["crop_types"] if c["id"] == "tomato")
    ids = {v["id"] for cat in tomato["categories"] for v in cat["varieties"]}
    assert ids == {
        "ca_chua_bi_do",
        "ca_chua_bi_vang",
        "ca_chua_bi_lun",
        "ca_chua_bi_socola",
        "ca_chua_tim",
        "ca_chua_bach_tuoc_leo_gian",
        "ca_chua_trai_cay_nova",
        "ca_chua_mv1",
    }


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
                assert item["name"] and item["unit"] in ("kg", "tấn"), item
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

    Cà phê mít / cà phê excelsa và ớt kiểng: có giống trong danh mục nhưng
    không có quy trình chính thức. Năm cây thêm ngày 23/09/2026 (cà rốt, rau
    muống, bắp cải, ngô, lúa) cũng vậy — giống đều có nguồn, định mức bón thì
    chưa, nên mọi loại con của chúng đều nằm ở đây thay vì được bịa ra.
    """
    data = static_data.load("care_protocols")
    assert {u["category_id"] for u in data["unavailable"]} == {
        "coffee_liberica",
        "coffee_excelsa",
        "chili_ornamental",
        "carrot_cu_dai",
        "water_spinach_la_tre",
        "cabbage_tron",
        "cabbage_trai_tim",
        "corn_nep",
        "rice_thuan",
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
    """F1 reference: MV1 on 300 m², scenario 2 — urê 75–85 kg/ha -> 2,25–2,55 kg."""
    data = static_data.load("care_protocols")
    tomato = next(p for p in data["protocols"] if p["id"] == "tomato_default")
    scenario = next(s for s in tomato["scenarios"] if s["id"] == "scenario_50_phan_chuong")
    ure = next(i for i in scenario["items"] if i["key"] == "ure")
    factor = 300 / tomato["reference_area"]["m2"]
    assert ure["min"] * factor == pytest.approx(2.25)
    assert ure["max"] * factor == pytest.approx(2.55)
    manure = next(i for i in scenario["items"] if i["key"] == "phan_chuong")
    assert manure["unit"] == "tấn" and manure["min"] * factor == pytest.approx(0.18)


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
