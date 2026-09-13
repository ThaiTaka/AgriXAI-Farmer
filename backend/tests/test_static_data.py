"""Integrity of the offline catalogues in shared/data.

The crop catalogue carries a hard rule: nothing in it may be invented. Every
variety therefore has to cite the page it was taken from, and the structure the
mobile picker relies on (crop type -> category -> variety) must be complete.
"""

import re

from app.services import static_data

ID_RE = re.compile(r"^[a-z0-9_]+$")


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


def test_care_protocols_use_catalogue_crop_ids():
    crops = {c["id"] for c in static_data.load("crop_varieties")["crop_types"]}
    for protocol in static_data.load("care_protocols")["protocols"]:
        assert protocol["crop_type"] in crops, protocol["crop_type"]


def test_fertilizer_groups_without_prices_are_declared_not_faked():
    data = static_data.load("fertilizer_recommendations")
    priced = {p["category"] for p in data["products"]}
    declared_missing = {c["code"] for c in data["categories_without_price_data"]}
    for category in data["categories"]:
        code = category["code"]
        assert (code in priced) != (code in declared_missing), (
            f"nhóm {code} phải hoặc có giá, hoặc được khai báo là chưa có giá"
        )
