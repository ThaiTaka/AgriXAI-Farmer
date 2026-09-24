"""Demo farm for Giai đoạn 3 — the mock-up household from the brief.

    Nông hộ: Lê Thành Thái — xã Hòa Bình, huyện Thanh Trì, Hà Nội
    Lô đất : PUC-001-HB, 300 m² cà chua MV1 (có kho và thu-chi)
             PUC-004-HB, 250 m² dưa leo Hunter 1.0 (lô mới, chưa ghi gì)
    + hai hộ láng giềng cho Giai đoạn 4: Nguyễn Văn Anh (PUC-002-HB, dưa leo)
      và Nguyễn Văn Hải (PUC-003-HB, ớt). Cùng mật khẩu demo.

Rows are keyed by fixed ids so re-running the seeder updates rather than
duplicates, and the phone that logs in as this account syncs the same
records every time. Figures are the ones in the brief; prices match the
catalogue (Urê Cà Mau 680.000₫/50 kg, DAP 1.100.000₫/50 kg).
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.models.farm import CropCycle, Plot
from app.models.ledger import Expense, Income, WarehouseIn
from app.models.user import User, UserRole

VN_TZ = timezone(timedelta(hours=7))

DEMO_USERNAME = "lethanhthai"
DEMO_PASSWORD = "matkhau123"
DEMO_USER_ID = "demo-user-thai"
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
DEMO_REVISION = "2026-09-24"


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
    user.region = "Xã Hòa Bình, Huyện Thanh Trì, Hà Nội"
    user.phone = "0912000123"
    user.is_active = True
    db.flush()

    owner = user.id
    created = 0

    created += _upsert(
        db,
        Plot,
        DEMO_PLOT_ID,
        code="PUC-001-HB",
        name="Ruộng cà chua nhà ông Lê Thành Thái",
        region="Xã Hòa Bình, Huyện Thanh Trì, Hà Nội",
        area=300.0,
        area_unit="m2",
        crop_type="tomato",
        crop_name="Cà chua",
        variety_id="seed_ca_chua_mv1",
        variety_name="MV1",
        planted_at=ms("2026-08-20"),
        status="active",
        notes="Đất thịt nhẹ ven sông, tưới rãnh.",
        owner_id=owner,
        updated_by=owner,
        created_at=ms("2026-08-20"),
        updated_at=ms(DEMO_REVISION),
    )

    created += _upsert(
        db,
        Plot,
        DEMO_PLOT2_ID,
        code="PUC-004-HB",
        name="Vườn dưa leo nhà ông Lê Thành Thái",
        region="Xã Hòa Bình, Huyện Thanh Trì, Hà Nội",
        area=250.0,
        area_unit="m2",
        crop_type="cucumber",
        crop_name="Dưa leo",
        variety_id="seed_cucumber_hunter_1",
        variety_name="Hunter 1.0",
        planted_at=ms("2026-09-15"),
        status="active",
        notes="Làm giàn lưới, tưới nhỏ giọt.",
        owner_id=owner,
        updated_by=owner,
        created_at=ms("2026-09-15"),
        updated_at=ms(DEMO_REVISION),
    )

    # Nhập kho 10/09/2026 — the two purchases in the brief, each with its
    # linked "Phân bón" expense.
    purchases = [
        ("demo-in-ure", "ure_ca_mau", "Urê Cà Mau", "dam", 50, 680_000, "Mua ở sfarm Hà Nội"),
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
            updated_at=ms("2026-09-10"),
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
            updated_at=ms("2026-09-10"),
        )

    created += _upsert(
        db,
        Income,
        "demo-income-1",
        kind="product",
        description="Bán cà chua MV1 50kg",
        amount=1_500_000.0,
        occurred_at=ms("2026-09-01"),
        note="Bán cho cửa hàng Kim Hạnh",
        plot_id=DEMO_PLOT_ID,
        checked=True,
        owner_id=owner,
        updated_by=owner,
        created_at=ms("2026-09-01"),
        updated_at=ms("2026-09-01"),
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


# Past seasons on the demo tomato plot (300 m²), so the cultivation history and
# the crop suggestion have something real to show: tomato did best in spring
# twice, cabbage is the winter crop, carrot the weakest. Yields are demo
# figures within the ordinary range for these crops (28–46 t/ha), not data.
# No open cycle: the plot's current tomato is tracked by its planted_at, and an
# open cycle would override that stage on the care tab.
DEMO_CYCLES = [
    ("demo-cycle-2024-dong", "Vụ Đông 2024 — Bắp cải", "cabbage", "Bắp cải", "winter", "2024-10-10", "2025-01-15", 1_050.0),
    ("demo-cycle-2025-xuan", "Vụ Xuân 2025 — Cà chua MV1", "tomato", "Cà chua", "spring", "2025-02-05", "2025-05-25", 1_380.0),
    ("demo-cycle-2025-thu", "Vụ Thu 2025 — Cà rốt", "carrot", "Cà rốt", "autumn", "2025-08-01", "2025-11-05", 840.0),
    ("demo-cycle-2026-xuan", "Vụ Xuân 2026 — Cà chua MV1", "tomato", "Cà chua", "spring", "2026-02-03", "2026-06-05", 1_230.0),
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
            variety_id="seed_ca_chua_mv1" if crop_type == "tomato" else None,
            variety_name="MV1" if crop_type == "tomato" else None,
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


# Two more households in the same commune for the multi-user tests of Giai
# đoạn 4 — each with its own plot code and a small ledger so isolation and
# per-farm dashboards have something to show.
NEIGHBOURS = [
    {
        "username": "nguyenvananh",
        "user_id": "demo-user-anh",
        "full_name": "Nguyễn Văn Anh",
        "phone": "0912000124",
        "plot_id": "demo-plot-puc-002-hb",
        "code": "PUC-002-HB",
        "plot_name": "Ruộng dưa leo nhà anh Anh",
        "area": 500.0,
        "crop_type": "cucumber",
        "crop_name": "Dưa leo",
        "variety_id": "seed_cucumber_hunter_1",
        "variety_name": "Hunter 1.0",
        "planted_at": "2026-09-01",
        "purchase": ("demo-in-anh-npk", "npk_16_16_8_ca_mau", "NPK 16-16-8 Cà Mau", "npk", 50, 700_000, "Đại lý Thanh Trì"),
        "income": ("demo-income-anh", "Bán dưa leo 120 kg", 1_440_000.0, "2026-09-08", "Chợ đầu mối Văn Điển"),
        "expense": ("demo-expense-anh", "labor", "Công làm giàn (2 công)", 400_000.0, "2026-09-03"),
    },
    {
        "username": "nguyenvanhai",
        "user_id": "demo-user-hai",
        "full_name": "Nguyễn Văn Hải",
        "phone": "0912000125",
        "plot_id": "demo-plot-puc-003-hb",
        "code": "PUC-003-HB",
        "plot_name": "Vườn ớt nhà ông Hải",
        "area": 360.0,
        "crop_type": "chili",
        "crop_name": "Ớt",
        "variety_id": "seed_chili_vifon686",
        "variety_name": "VIFON686 (chỉ thiên lai F1)",
        "planted_at": "2026-08-10",
        "purchase": ("demo-in-hai-kali", "kali_bot_ca_mau", "Kali bột (MOP) Cà Mau", "kali", 25, 275_000, "Đại lý Thanh Trì"),
        "income": ("demo-income-hai", "Bán ớt chỉ thiên 40 kg", 2_000_000.0, "2026-09-12", "Bán buôn chợ Hà Đông"),
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
        user.region = "Xã Hòa Bình, Huyện Thanh Trì, Hà Nội"
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
            updated_at=planted,
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
            updated_at=ms("2026-09-02"),
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
            updated_at=ms("2026-09-02"),
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
            updated_at=ms(day),
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
            updated_at=ms(day),
        )
        print(f"  demo farm ({spec['username']}): {created} rows added, rest refreshed")
