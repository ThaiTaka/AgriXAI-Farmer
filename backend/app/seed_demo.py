"""Demo farm for Giai đoạn 3 — the mock-up household from the brief.

    Nông hộ: Lê Thành Thái — làng hoa Vạn Thành, Đà Lạt, Lâm Đồng
    Lô đất : PUC-001-VT, 300 m² hoa cúc Makoto trong nhà màng (có kho và thu-chi)
             PUC-004-VT, 250 m² hoa hồng đỏ Ý (lô mới, chưa ghi gì)
    + hai hộ láng giềng cho Giai đoạn 4: Nguyễn Văn Anh (PUC-002-VT, cẩm chướng)
      và Nguyễn Văn Hải (PUC-003-VT, ớt ngọt). Cùng mật khẩu demo.

Crops and varieties are picked from the Lâm Đồng catalogue
(shared/data/crop_varieties.json); cúc, hồng and cẩm chướng are the flowers
Vạn Thành is known for.

Rows are keyed by fixed ids so re-running the seeder updates rather than
duplicates, and the phone that logs in as this account syncs the same
records every time. Figures are the ones in the brief; prices match the
catalogue (Urê Cà Mau 680.000₫/50 kg, DAP 1.100.000₫/50 kg).
"""

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.models.farm import CareGuide, CropCycle, Plot
from app.models.ledger import Expense, Income, WarehouseIn
from app.models.user import User, UserRole
from app.services import static_data

VN_TZ = timezone(timedelta(hours=7))

DEMO_USERNAME = "lethanhthai"
DEMO_PASSWORD = "matkhau123"
DEMO_USER_ID = "demo-user-thai"
# Ids are internal keys and stay as first seeded (the "-hb" suffix predates the
# move to Vạn Thành): a phone that already synced must see the same rows
# change, not a second set of plots appear beside the old ones.
DEMO_PLOT_ID = "demo-plot-puc-001-hb"
# Lô thứ hai: mới lập, chưa có phiếu nào — trạng thái bình thường của một lô
# vừa xuống giống, và là chỗ để thử các màn hình khi số liệu còn rỗng.
DEMO_PLOT2_ID = "demo-plot-puc-004-hb"

# Hộ demo từng mang tên khác. Trên một máy đã seed, đổi tên tại chỗ thay vì
# lập tài khoản thứ hai — nếu không thì lô đất, kho và thu-chi chuyển sang chủ
# mới mà tài khoản cũ vẫn nằm lại, rỗng, và admin vẫn nhìn thấy.
LEGACY_USERNAMES = ("nguyenvancuong",)

# Máy đã đồng bộ chỉ kéo về bản ghi có updated_at MỚI HƠN lần pull gần nhất.
# Đổi nội dung một dòng seed mà để nguyên mốc thời gian cũ thì thay đổi đó
# nằm lại trên máy chủ mãi mãi — điện thoại vẫn hiện tên cũ. Nên mỗi lần sửa
# nội dung hộ demo, đóng dấu lại ngày sửa ở đây.
DEMO_REVISION = "2026-10-02"

# Every demo household sits in the same flower village.
DEMO_REGION = "Làng hoa Vạn Thành, Đà Lạt, Lâm Đồng"
DEMO_SUPPLIER = "Đại lý vật tư nông nghiệp Vạn Thành"


def ms(day: str, hour: int = 8) -> int:
    return int(datetime.fromisoformat(f"{day}T{hour:02d}:00:00").replace(tzinfo=VN_TZ).timestamp() * 1000)


def _upsert(db, model, row_id: str, **values):
    row = db.get(model, row_id)
    created = row is None
    if created:
        row = model(id=row_id)
        db.add(row)
    for key, value in values.items():
        setattr(row, key, value)
    row.is_deleted = False
    row.deleted_at = None
    return created


def seed_demo_farm(db) -> None:
    user = db.scalar(select(User).where(User.username == DEMO_USERNAME))
    if user is None:
        user = db.scalar(select(User).where(User.username.in_(LEGACY_USERNAMES)))
        if user is not None:
            user.username = DEMO_USERNAME
    if user is None:
        user = User(id=DEMO_USER_ID, username=DEMO_USERNAME)
        db.add(user)
    user.email = "thai@agrilog.local"
    user.password_hash = hash_password(DEMO_PASSWORD)
    user.full_name = "Lê Thành Thái"
    user.role = UserRole.FARMER
    user.region = DEMO_REGION
    user.phone = "0912000123"
    user.is_active = True
    db.flush()

    owner = user.id
    created = 0

    created += _upsert(
        db,
        Plot,
        DEMO_PLOT_ID,
        code="PUC-001-VT",
        name="Nhà màng hoa cúc nhà ông Lê Thành Thái",
        region=DEMO_REGION,
        area=300.0,
        area_unit="m2",
        crop_type="chrysanthemum",
        crop_name="Hoa cúc",
        variety_id="seed_cuc_makoto",
        variety_name="Makoto",
        planted_at=ms("2026-08-20"),
        status="active",
        notes="Trồng trong nhà màng, tưới phun.",
        owner_id=owner,
        updated_by=owner,
        created_at=ms("2026-08-20"),
        updated_at=ms(DEMO_REVISION),
    )

    created += _upsert(
        db,
        Plot,
        DEMO_PLOT2_ID,
        code="PUC-004-VT",
        name="Vườn hoa hồng nhà ông Lê Thành Thái",
        region=DEMO_REGION,
        area=250.0,
        area_unit="m2",
        crop_type="rose",
        crop_name="Hoa hồng",
        variety_id="seed_hong_do_y",
        variety_name="Hồng đỏ Ý",
        planted_at=ms("2026-09-15"),
        status="active",
        notes="Trồng trong nhà màng, tưới nhỏ giọt.",
        owner_id=owner,
        updated_by=owner,
        created_at=ms("2026-09-15"),
        updated_at=ms(DEMO_REVISION),
    )

    # Nhập kho 10/09/2026 — the two purchases in the brief, each with its
    # linked "Phân bón" expense.
    purchases = [
        ("demo-in-ure", "ure_ca_mau", "Urê Cà Mau", "dam", 50, 680_000, f"Mua ở {DEMO_SUPPLIER}"),
        ("demo-in-dap", "dap_han_quoc", "DAP Hàn Quốc (nhập khẩu)", "lan", 50, 1_100_000, "East-West hạt giống"),
    ]
    for row_id, fid, name, category, kg, price, note in purchases:
        expense_id = f"{row_id}-expense"
        created += _upsert(
            db,
            WarehouseIn,
            row_id,
            fertilizer_id=fid,
            fertilizer_name=name,
            category=category,
            quantity=float(kg),
            unit="kg",
            quantity_kg=float(kg),
            price=float(price),
            unit_price=price / kg,
            occurred_at=ms("2026-09-10"),
            note=note,
            plot_id=DEMO_PLOT_ID,
            expense_id=expense_id,
            owner_id=owner,
            updated_by=owner,
            created_at=ms("2026-09-10"),
            updated_at=ms(DEMO_REVISION),
        )
        created += _upsert(
            db,
            Expense,
            expense_id,
            kind="fertilizer",
            description=f"Mua {name} {kg} kg",
            amount=float(price),
            occurred_at=ms("2026-09-10"),
            note=note,
            plot_id=DEMO_PLOT_ID,
            checked=False,
            warehouse_in_id=row_id,
            owner_id=owner,
            updated_by=owner,
            created_at=ms("2026-09-10"),
            updated_at=ms(DEMO_REVISION),
        )

    created += _upsert(
        db,
        Income,
        "demo-income-1",
        kind="product",
        description="Bán hoa cúc cắt cành",
        amount=1_500_000.0,
        occurred_at=ms("2026-09-01"),
        note="Bán cho cửa hàng Kim Hạnh",
        plot_id=DEMO_PLOT_ID,
        checked=True,
        owner_id=owner,
        updated_by=owner,
        created_at=ms("2026-09-01"),
        updated_at=ms(DEMO_REVISION),
    )
    # "3 công" = 3 người × 1 ngày × 100.000₫ — the V2.1 labour breakdown of the
    # same 300.000₫ the brief lists, so every report total stays as it was.
    for row_id, kind, description, amount, day, labor in [
        ("demo-expense-labor", "labor", "Công bón phân (3 công)", 300_000.0, "2026-09-05", (3.0, 1.0, "day", 100_000.0)),
        ("demo-expense-utilities", "utilities", "Điện nước", 120_000.0, "2026-09-10", None),
    ]:
        workers, quantity, unit, unit_price = labor or (None, None, None, None)
        created += _upsert(
            db,
            Expense,
            row_id,
            kind=kind,
            description=description,
            amount=amount,
            occurred_at=ms(day),
            note=None,
            plot_id=DEMO_PLOT_ID,
            checked=False,
            warehouse_in_id=None,
            task_id=None,
            workers=workers,
            quantity=quantity,
            unit=unit,
            unit_price=unit_price,
            owner_id=owner,
            updated_by=owner,
            created_at=ms(day),
            updated_at=ms(DEMO_REVISION) if labor else ms(day),
        )

    created += seed_demo_cycles(db, owner)

    print(f"  demo farm ({DEMO_USERNAME}): {created} rows added, rest refreshed")
    seed_neighbour_farms(db)
    seed_demo_guides(db)


# Two care guides for tomato so the demo shows the embedded video. The video
# ids were checked against YouTube's oEmbed endpoint on 2026-09-24 (title and
# channel below are what it returned). The steps are NOT written here: they are
# read from the sourced tomato protocol (shared/data/care_protocols.json) at
# seed time, so a guide never says more than the protocol's source does.
DEMO_GUIDE_PROTOCOL = "tomato_lamdong_2025"
DEMO_GUIDES = [
    {
        "id": "demo-guide-ca-chua-ra-hoa",
        "stage_code": "vegetative",
        "title": "Cà chua: bón thúc lần 2, vun luống, làm giàn",
        # "Kỹ thuật trồng cà chua công nghệ cao trong nhà màng" — Báo Nông nghiệp và Môi trường
        "youtube_id": "M1fqC6tuXLI",
        "video_credit": "Video: Báo Nông nghiệp và Môi trường",
        "tasks": ("vegetative", ["cachua_bon_thuc_2", "cachua_vun", "cachua_lam_gian"]),
        "with_base": False,
        "sort_order": 2,
    },
    {
        "id": "demo-guide-u-phan-bon-lot",
        "stage_code": "seedling",
        "title": "Cà chua: bón lót phân chuồng hoai, chăm sóc hồi xanh",
        # "Kỹ thuật ủ phân hữu cơ bón cho cây trồng | VTC16" — KÊNH VTC16
        "youtube_id": "nGqGU7yYO-c",
        "video_credit": "Video: Kênh VTC16",
        "tasks": ("seedling", ["cc_tuoi_hoi_xanh", "cachua_xoi", "cachua_bon_thuc_1"]),
        # The protocol's basal dressing goes first: it is what the video is about.
        "with_base": True,
        "sort_order": 1,
    },
]


def seed_demo_guides(db) -> None:
    protocol = next(
        (p for p in static_data.load("care_protocols")["protocols"] if p["id"] == DEMO_GUIDE_PROTOCOL), None
    )
    if protocol is None:
        print(f"  care guides: protocol {DEMO_GUIDE_PROTOCOL} missing, skipped")
        return
    stages = {s["stage_code"]: s for s in protocol["stages"]}
    source = protocol["source"]
    created = 0
    for spec in DEMO_GUIDES:
        stage_code, keys = spec["tasks"]
        stage = stages.get(stage_code)
        if stage is None:
            continue
        tasks = {t["key"]: t for t in stage["tasks"]}
        steps = [
            {"title": tasks[k]["title"], "body": tasks[k]["detail"], "image_id": None} for k in keys if k in tasks
        ]
        if spec["with_base"]:
            area = protocol["reference_area"]
            base = protocol["base_application"]["timing"]
            steps.insert(
                0,
                {
                    "title": "Bón lót trước khi trồng",
                    "body": f"{base} Lượng tính cho {area['value']:g} {area['unit']}.",
                    "image_id": None,
                },
            )
        created += _upsert(
            db,
            CareGuide,
            spec["id"],
            crop_type="tomato",
            stage_code=spec["stage_code"],
            title=spec["title"],
            summary=f"{stage['stage_name_vi']} — {stage['timing']}.",
            youtube_id=spec["youtube_id"],
            steps_json=json.dumps(steps, ensure_ascii=False),
            images_json=json.dumps([]),
            source_name=f"Các bước: {source['publisher']} — {source['title']}. {spec['video_credit']}",
            source_url=source["url"],
            published=True,
            sort_order=spec["sort_order"],
            created_by=None,
            updated_by=None,
            created_at=ms(DEMO_REVISION),
            updated_at=ms(DEMO_REVISION),
        )
    print(f"  care guides: {created} added, rest refreshed")


# Past seasons on the demo plot (300 m²) before it went over to chrysanthemum,
# so the cultivation history and the crop suggestion have something real to
# show: tomato did best in spring twice, cabbage is the winter crop, carrot the
# weakest. Yields are demo figures within the ordinary range for these crops
# (28–46 t/ha), not data. No open cycle: the plot's current crop is tracked by
# its planted_at, and an open cycle would override that stage on the care tab.
DEMO_CYCLES = [
    ("demo-cycle-2024-dong", "Vụ Đông 2024 — Bắp cải", "cabbage", "Bắp cải", "winter", "2024-10-10", "2025-01-15", 1_050.0),
    ("demo-cycle-2025-xuan", "Vụ Xuân 2025 — Cà chua NT1", "tomato", "Cà chua", "spring", "2025-02-05", "2025-05-25", 1_380.0),
    ("demo-cycle-2025-thu", "Vụ Thu 2025 — Cà rốt", "carrot", "Cà rốt", "autumn", "2025-08-01", "2025-11-05", 840.0),
    ("demo-cycle-2026-xuan", "Vụ Xuân 2026 — Cà chua NT1", "tomato", "Cà chua", "spring", "2026-02-03", "2026-06-05", 1_230.0),
]


def seed_demo_cycles(db, owner: str) -> int:
    created = 0
    for row_id, name, crop_type, crop_name, season, start, end, yield_kg in DEMO_CYCLES:
        created += _upsert(
            db,
            CropCycle,
            row_id,
            plot_id=DEMO_PLOT_ID,
            name=name,
            crop_type=crop_type,
            crop_name=crop_name,
            variety_id="seed_ca_chua_nt1" if crop_type == "tomato" else None,
            variety_name="NT1" if crop_type == "tomato" else None,
            stage="finished",
            season=season,
            started_at=ms(start),
            ended_at=ms(end),
            area_m2=300.0,
            yield_kg=yield_kg,
            notes=None,
            media_json=None,
            owner_id=owner,
            updated_by=owner,
            created_at=ms(end),
            # Stamped with the revision, not the harvest date: a phone that
            # synced before V2.1 only pulls rows changed after its last pull.
            updated_at=ms(DEMO_REVISION),
        )
    return created


# Two more households in the same village for the multi-user tests of Giai
# đoạn 4 — each with its own plot code and a small ledger so isolation and
# per-farm dashboards have something to show.
NEIGHBOURS = [
    {
        "username": "nguyenvananh",
        "user_id": "demo-user-anh",
        "full_name": "Nguyễn Văn Anh",
        "phone": "0912000124",
        "plot_id": "demo-plot-puc-002-hb",
        "code": "PUC-002-VT",
        "plot_name": "Nhà kính cẩm chướng nhà anh Anh",
        "area": 500.0,
        "crop_type": "carnation",
        "crop_name": "Hoa cẩm chướng",
        "variety_id": "seed_cc_tundra",
        "variety_name": "Tundra",
        "planted_at": "2026-09-01",
        "purchase": ("demo-in-anh-npk", "npk_16_16_8_ca_mau", "NPK 16-16-8 Cà Mau", "npk", 50, 700_000, DEMO_SUPPLIER),
        "income": ("demo-income-anh", "Bán hoa cẩm chướng", 1_440_000.0, "2026-09-08", "Chợ đầu mối nông sản Đà Lạt"),
        "expense": ("demo-expense-anh", "labor", "Công giăng lưới đỡ cây (2 công)", 400_000.0, "2026-09-03"),
    },
    {
        "username": "nguyenvanhai",
        "user_id": "demo-user-hai",
        "full_name": "Nguyễn Văn Hải",
        "phone": "0912000125",
        "plot_id": "demo-plot-puc-003-hb",
        "code": "PUC-003-VT",
        "plot_name": "Nhà màng ớt ngọt nhà ông Hải",
        "area": 360.0,
        "crop_type": "chili",
        "crop_name": "Ớt ngọt",
        "variety_id": "seed_chili_bachata_rz",
        "variety_name": "Bachata RZ F1",
        "planted_at": "2026-08-10",
        "purchase": ("demo-in-hai-kali", "kali_bot_ca_mau", "Kali bột (MOP) Cà Mau", "kali", 25, 275_000, DEMO_SUPPLIER),
        "income": ("demo-income-hai", "Bán ớt ngọt 40 kg", 2_000_000.0, "2026-09-12", "Bán buôn chợ Đà Lạt"),
        "expense": ("demo-expense-hai", "utilities", "Tiền điện bơm nước", 90_000.0, "2026-09-06"),
    },
]


def seed_neighbour_farms(db) -> None:
    for spec in NEIGHBOURS:
        user = db.scalar(select(User).where(User.username == spec["username"]))
        if user is None:
            user = User(id=spec["user_id"], username=spec["username"])
            db.add(user)
        user.email = f"{spec['username']}@agrilog.local"
        user.password_hash = hash_password(DEMO_PASSWORD)
        user.full_name = spec["full_name"]
        user.role = UserRole.FARMER
        user.region = DEMO_REGION
        user.phone = spec["phone"]
        user.is_active = True
        db.flush()
        owner = user.id
        planted = ms(spec["planted_at"])
        created = 0

        created += _upsert(
            db,
            Plot,
            spec["plot_id"],
            code=spec["code"],
            name=spec["plot_name"],
            region=user.region,
            area=spec["area"],
            area_unit="m2",
            crop_type=spec["crop_type"],
            crop_name=spec["crop_name"],
            variety_id=spec["variety_id"],
            variety_name=spec["variety_name"],
            planted_at=planted,
            status="active",
            notes=None,
            owner_id=owner,
            updated_by=owner,
            created_at=planted,
            updated_at=ms(DEMO_REVISION),
        )

        row_id, fid, name, category, kg, price, note = spec["purchase"]
        created += _upsert(
            db,
            WarehouseIn,
            row_id,
            fertilizer_id=fid,
            fertilizer_name=name,
            category=category,
            quantity=float(kg),
            unit="kg",
            quantity_kg=float(kg),
            price=float(price),
            unit_price=price / kg,
            occurred_at=ms("2026-09-02"),
            note=note,
            plot_id=spec["plot_id"],
            expense_id=f"{row_id}-expense",
            owner_id=owner,
            updated_by=owner,
            created_at=ms("2026-09-02"),
            updated_at=ms(DEMO_REVISION),
        )
        created += _upsert(
            db,
            Expense,
            f"{row_id}-expense",
            kind="fertilizer",
            description=f"Mua {name} {kg} kg",
            amount=float(price),
            occurred_at=ms("2026-09-02"),
            note=note,
            plot_id=spec["plot_id"],
            checked=False,
            warehouse_in_id=row_id,
            owner_id=owner,
            updated_by=owner,
            created_at=ms("2026-09-02"),
            updated_at=ms(DEMO_REVISION),
        )

        inc_id, desc, amount, day, inc_note = spec["income"]
        created += _upsert(
            db,
            Income,
            inc_id,
            kind="product",
            description=desc,
            amount=amount,
            occurred_at=ms(day),
            note=inc_note,
            plot_id=spec["plot_id"],
            checked=False,
            owner_id=owner,
            updated_by=owner,
            created_at=ms(day),
            updated_at=ms(DEMO_REVISION),
        )
        exp_id, kind, desc, amount, day = spec["expense"]
        created += _upsert(
            db,
            Expense,
            exp_id,
            kind=kind,
            description=desc,
            amount=amount,
            occurred_at=ms(day),
            note=None,
            plot_id=spec["plot_id"],
            checked=False,
            warehouse_in_id=None,
            owner_id=owner,
            updated_by=owner,
            created_at=ms(day),
            updated_at=ms(DEMO_REVISION),
        )
        print(f"  demo farm ({spec['username']}): {created} rows added, rest refreshed")
