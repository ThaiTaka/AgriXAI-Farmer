"""Merge the per-crop care-protocol seed files into `care_protocols.json`.

    python shared/data/build_care_protocols.py

Each `care_protocol_<crop>_seed.json` is the hand-collected source of truth for
one crop (protocols + the categories that have NO official protocol yet). This
script only concatenates them, so the merged file the apps read never carries a
number the seed files do not. `backend/tests/test_static_data.py` rebuilds the
merge in memory and fails if the checked-in file has drifted from the seeds.
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

SEED_FILES = [
    # Hoa — làng hoa Vạn Thành và Đà Lạt. Nguồn: QĐ 1972/QĐ-UBND ngày 04/11/2025
    # của UBND tỉnh Lâm Đồng (120 quy trình kỹ thuật trồng, chăm sóc cây trồng).
    "care_protocol_chrysanthemum_seed.json",
    "care_protocol_rose_seed.json",
    "care_protocol_carnation_seed.json",
    "care_protocol_gerbera_seed.json",
    "care_protocol_lily_seed.json",
    "care_protocol_gladiolus_seed.json",
    "care_protocol_lisianthus_seed.json",
    "care_protocol_limonium_seed.json",
    # Lan hồ điệp, lan vũ nữ: quy trình của tỉnh bón theo nồng độ pha và theo
    # chậu, không theo diện tích — file chỉ khai báo khoảng trống.
    "care_protocol_phalaenopsis_seed.json",
    "care_protocol_oncidium_seed.json",
    # Rau, củ, quả — cùng nguồn QĐ 1972/QĐ-UBND.
    "care_protocol_tomato_seed.json",
    "care_protocol_pepper_seed.json",
    "care_protocol_cucumber_seed.json",
    "care_protocol_cabbage_seed.json",
    "care_protocol_napa_cabbage_seed.json",
    "care_protocol_cauliflower_seed.json",
    "care_protocol_lettuce_seed.json",
    # Rau muống: QĐ 1972 không có quy trình — file chỉ khai báo khoảng trống.
    "care_protocol_water_spinach_seed.json",
    "care_protocol_carrot_seed.json",
    "care_protocol_potato_seed.json",
    "care_protocol_strawberry_seed.json",
    "care_protocol_spinach_seed.json",
    "care_protocol_garden_pea_seed.json",
    "care_protocol_beetroot_seed.json",
    "care_protocol_leek_seed.json",
    "care_protocol_celery_seed.json",
    "care_protocol_chayote_seed.json",
    # Cây lương thực — cùng nguồn QĐ 1972/QĐ-UBND.
    "care_protocol_rice_seed.json",
    "care_protocol_corn_seed.json",
    # Đặc sản và cây lâu năm.
    "care_protocol_artichoke_seed.json",
    "care_protocol_coffee_seed.json",
    "care_protocol_tea_seed.json",
    "care_protocol_avocado_seed.json",
    "care_protocol_persimmon_seed.json",
]

STAGE_CODES = ["seedling", "vegetative", "flowering", "fruiting", "harvesting"]


def build() -> dict:
    protocols: list[dict] = []
    unavailable: list[dict] = []
    sources: list[str] = []
    conversion: dict[str, dict] = {}

    for name in SEED_FILES:
        with (HERE / name).open(encoding="utf-8") as fh:
            seed = json.load(fh)
        meta = seed["$meta"]
        crop_type = meta["crop_type"]

        for protocol in seed["protocols"]:
            if protocol["crop_type"] != crop_type:
                raise ValueError(f"{name}: protocol {protocol['id']} has crop_type {protocol['crop_type']}")
            protocols.append(protocol)

        for entry in seed.get("unavailable", []):
            unavailable.append({"crop_type": crop_type, "crop_name": meta["crop_name"], **entry})

        for url in meta.get("sources", []):
            if url not in sources:
                sources.append(url)

        if "conversion" in meta:
            conversion[crop_type] = meta["conversion"]

    return {
        "$meta": {
            "description": (
                "Quy trình chăm sóc và bón phân theo giai đoạn cây — dùng cho F1 (tính lượng phân), "
                "F5–F6 (quy trình chăm sóc) và tab 'Chăm sóc' của lô đất. File này được SINH RA từ các "
                "care_protocol_*_seed.json bằng build_care_protocols.py; không sửa tay."
            ),
            "format_version": 2,
            "derived_from": SEED_FILES,
            "generated_by": "shared/data/build_care_protocols.py",
            "stage_codes": STAGE_CODES,
            "data_policy": (
                "Không bịa dữ liệu. Mọi số liệu chép đúng nguồn ghi trong từng protocol; loại cây / loại con "
                "chưa có quy trình chính thức được liệt kê ở 'unavailable' để UI hiển thị 'Chưa có dữ liệu' "
                "kèm nguồn tham khảo."
            ),
            "note": (
                "Công việc gợi ý CHỈ điền sẵn form — nông dân phải bấm xác nhận trước khi lưu. "
                "Không tự động ghi nhật ký."
            ),
            "conversion": conversion,
            "sources": sources,
        },
        "protocols": protocols,
        "unavailable": unavailable,
    }


def main() -> int:
    merged = build()
    out = HERE / "care_protocols.json"
    text = json.dumps(merged, ensure_ascii=False, indent=2) + "\n"
    if "--check" in sys.argv:
        current = out.read_text(encoding="utf-8") if out.exists() else ""
        if current != text:
            print("care_protocols.json is out of date — run build_care_protocols.py")
            return 1
        print("care_protocols.json is up to date")
        return 0
    # Explicit "\n": on Windows write_text would otherwise turn every line
    # ending into CRLF and the merged file would differ from the seeds' style.
    out.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {out} ({len(merged['protocols'])} protocols, {len(merged['unavailable'])} unavailable)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
