"""Demo farm for Giai đoạn 3 — the mock-up household from the brief.

    Nông hộ: Nguyễn Văn Cường — xã Hòa Bình, huyện Thanh Trì, Hà Nội
    Lô đất : PUC-001-HB, 300 m² cà chua MV1

Rows are keyed by fixed ids so re-running the seeder updates rather than
duplicates, and the phone that logs in as this account syncs the same
records every time. Figures are the ones in the brief; prices match the
catalogue (Urê Cà Mau 680.000₫/50 kg, DAP 1.100.000₫/50 kg).
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.models.farm import Plot
from app.models.ledger import Expense, Income, WarehouseIn
from app.models.user import User, UserRole

VN_TZ = timezone(timedelta(hours=7))

DEMO_USERNAME = "nguyenvancuong"
DEMO_PASSWORD = "matkhau123"
DEMO_USER_ID = "demo-user-cuong"
DEMO_PLOT_ID = "demo-plot-puc-001-hb"


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
        user = User(id=DEMO_USER_ID, username=DEMO_USERNAME)
        db.add(user)
    user.email = "cuong@agrilog.local"
    user.password_hash = hash_password(DEMO_PASSWORD)
    user.full_name = "Nguyễn Văn Cường"
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
        name="Ruộng cà chua nhà ông Cường",
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
        updated_at=ms("2026-08-20"),
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
    for row_id, kind, description, amount, day in [
        ("demo-expense-labor", "labor", "Công bón phân (3 công)", 300_000.0, "2026-09-05"),
        ("demo-expense-utilities", "utilities", "Điện nước", 120_000.0, "2026-09-10"),
    ]:
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
            owner_id=owner,
            updated_by=owner,
            created_at=ms(day),
            updated_at=ms(day),
        )

    print(f"  demo farm ({DEMO_USERNAME}): {created} rows added, rest refreshed")
