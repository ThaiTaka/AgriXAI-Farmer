"""Demo data — các nông hộ ở Đà Lạt và vùng phụ cận (tỉnh Lâm Đồng).

Địa danh theo đơn vị hành chính cấp xã có hiệu lực từ 01/07/2025 (Nghị quyết
1671/NQ-UBTVQH15 của Ủy ban Thường vụ Quốc hội): các phường "… - Đà Lạt" và các
xã Lạc Dương, Đơn Dương, Đức Trọng, Tân Hội, Nam Ban Lâm Hà. Họ tên, số điện
thoại, số liệu thu - chi là DỮ LIỆU MINH HỌA, không phải người thật và không
phải kết quả khảo sát.

Hai tầng dữ liệu:

* Lõi (`seed_demo_farm`, chạy ở mọi lần `python -m app.seed`, kể cả trong bộ test):
    - Lê Thành Thái — Trại Mát, phường Xuân Trường - Đà Lạt. Lô PUC-2608-XT01
      (300 m² cà chua MV1, có kho + thu - chi + bốn vụ trồng) và PUC-2609-XT02
      (250 m² dưa leo Hunter 1.0, lô mới chưa ghi gì).
    - Trần Quốc Hưng (dưa leo) và Vũ Đức Thịnh (ớt) — hai hộ để kiểm thử cô lập
      dữ liệu giữa các nông hộ.
* Mở rộng (`seed_extended`, chỉ khi chạy `python -m app.seed`): thêm các hộ khác
  của Đà Lạt, Lạc Dương, Đức Trọng, Đơn Dương, Lâm Hà để trang quản trị có đủ
  dữ liệu (phân trang, lọc, tài khoản đã khoá, tài khoản chưa có lô), kèm nhật ký
  lỗi và lịch sử giá phân bón do admin nhập.

Mọi hàng đều có id cố định nên chạy lại là cập nhật chứ không nhân đôi, và điện
thoại đăng nhập tài khoản này đồng bộ về đúng các bản ghi đó.
"""

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.models.farm import CareGuide, CropCycle, CropVariety, Plot
from app.models.fertilizer import FertilizerPrice
from app.models.ledger import Expense, Income, TaskHistory, TaskNote, WarehouseIn, WarehouseOut
from app.models.ops import ErrorLog
from app.models.user import User, UserRole
from app.services import static_data

VN_TZ = timezone(timedelta(hours=7))

DEMO_USERNAME = "lethanhthai"
DEMO_PASSWORD = "matkhau123"
DEMO_USER_ID = "demo-user-thai"
DEMO_PLOT_ID = "demo-plot-puc-001-hb"
# Lô thứ hai: mới lập, chưa có phiếu nào — trạng thái bình thường của một lô
# vừa xuống giống, và là chỗ để thử các màn hình khi số liệu còn rỗng.
DEMO_PLOT2_ID = "demo-plot-puc-004-hb"

# Địa chỉ của hộ chính. Các phường dùng tên sau sắp xếp: "Trại Mát" trước đây
# thuộc Phường 11, nay nằm trong phường Xuân Trường - Đà Lạt.
REGION_TRAI_MAT = "Trại Mát, phường Xuân Trường - Đà Lạt, Lâm Đồng"

# Hộ demo từng mang tên khác. Trên một máy đã seed, đổi tên tại chỗ thay vì
# lập tài khoản thứ hai — nếu không thì lô đất, kho và thu-chi chuyển sang chủ
# mới mà tài khoản cũ vẫn nằm lại, rỗng, và admin vẫn nhìn thấy.
LEGACY_USERNAMES = ("nguyenvancuong",)

# Máy đã đồng bộ chỉ kéo về bản ghi có updated_at MỚI HƠN lần pull gần nhất.
# Đổi nội dung một dòng seed mà để nguyên mốc thời gian cũ thì thay đổi đó
# nằm lại trên máy chủ mãi mãi — điện thoại vẫn hiện tên cũ. Nên mỗi lần sửa
# nội dung hộ demo, đóng dấu lại ngày sửa ở đây.
DEMO_REVISION = "2026-11-03"

CROP_NAMES = {
    "tomato": "Cà chua",
    "cucumber": "Dưa leo",
    "chili": "Ớt",
    "cabbage": "Bắp cải",
    "carrot": "Cà rốt",
    "coffee": "Cà phê",
    "corn": "Ngô",
    "rice": "Lúa",
    "water_spinach": "Rau muống",
}


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


def _set_user(db, user_id: str, username: str, *, full_name: str, phone: str, region: str, active: bool = True):
    """Lập hoặc cập nhật một nông hộ. Tìm theo id trước để đổi tên đăng nhập tại chỗ."""
    user = db.get(User, user_id) or db.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(id=user_id, username=username)
        db.add(user)
    user.username = username
    user.email = f"{username}@agrilog.local"
    user.password_hash = hash_password(DEMO_PASSWORD)
    user.full_name = full_name
    user.role = UserRole.FARMER
    user.region = region
    user.phone = phone
    user.is_active = active
    db.flush()
    return user


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
    user.region = REGION_TRAI_MAT
    user.phone = "0918342706"
    user.is_active = True
    db.flush()

    owner = user.id
    created = 0

    created += _upsert(
        db,
        Plot,
        DEMO_PLOT_ID,
        code="PUC-2608-XT01",
        name="Ruộng cà chua Trại Mát",
        region=REGION_TRAI_MAT,
        area=300.0,
        area_unit="m2",
        crop_type="tomato",
        crop_name="Cà chua",
        variety_id="seed_ca_chua_mv1",
        variety_name="MV1",
        planted_at=ms("2026-08-20"),
        status="active",
        notes="Đất xám pha mùn, trồng trong nhà màng, tưới nhỏ giọt.",
        owner_id=owner,
        updated_by=owner,
        created_at=ms("2026-08-20"),
        updated_at=ms(DEMO_REVISION),
    )

    created += _upsert(
        db,
        Plot,
        DEMO_PLOT2_ID,
        code="PUC-2609-XT02",
        name="Vườn dưa leo giàn lưới Trại Mát",
        region=REGION_TRAI_MAT,
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

    # Nhập kho 10/09/2026 — two purchases, each with its linked "Phân bón" expense.
    purchases = [
        ("demo-in-ure", "ure_ca_mau", "Urê Cà Mau", "dam", 50, 680_000, "Đại lý vật tư nông nghiệp Trại Mát"),
        ("demo-in-dap", "dap_han_quoc", "DAP Hàn Quốc (nhập khẩu)", "lan", 50, 1_100_000, "Đại lý vật tư nông nghiệp Trại Mát"),
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
        description="Bán cà chua MV1 50kg",
        amount=1_500_000.0,
        occurred_at=ms("2026-09-01"),
        note="Bán cho vựa rau ở chợ Đà Lạt",
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
        # Tháng 11: để màn hình chính và báo cáo tháng hiện tại không trống.
        ("demo-expense-nov-power", "utilities", "Điện nước tháng 10", 140_000.0, "2026-11-01", None),
        ("demo-expense-nov-labor", "labor", "Công tỉa nhánh, buộc giàn (2 công)", 200_000.0, "2026-11-02", (2.0, 1.0, "day", 100_000.0)),
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
            task_id="demo-task-bon-thuc-1" if row_id == "demo-expense-labor" else None,
            workers=workers,
            quantity=quantity,
            unit=unit,
            unit_price=unit_price,
            owner_id=owner,
            updated_by=owner,
            created_at=ms(day),
            updated_at=ms(DEMO_REVISION),
        )

    created += _upsert(
        db,
        Income,
        "demo-income-nov",
        kind="product",
        description="Bán cà chua MV1 70kg",
        amount=2_100_000.0,
        occurred_at=ms("2026-11-01"),
        note="Bán cho vựa rau ở chợ Đà Lạt",
        plot_id=DEMO_PLOT_ID,
        checked=False,
        owner_id=owner,
        updated_by=owner,
        created_at=ms("2026-11-01"),
        updated_at=ms(DEMO_REVISION),
    )

    created += seed_demo_tasks(db, owner)
    created += seed_demo_cycles(db, owner)

    print(f"  demo farm ({DEMO_USERNAME}): {created} rows added, rest refreshed")
    seed_neighbour_farms(db)
    seed_demo_guides(db)


# Two care guides for tomato so the demo shows the embedded video. The video
# ids were checked against YouTube's oEmbed endpoint on 2026-09-24 (title and
# channel below are what it returned). The steps are NOT written here: they are
# read from the sourced tomato protocol (shared/data/care_protocols.json) at
# seed time, so a guide never says more than the protocol's source does.
DEMO_GUIDES = [
    {
        "id": "demo-guide-ca-chua-ra-hoa",
        "stage_code": "flowering",
        "title": "Cà chua ra hoa: làm giàn, tỉa lá gốc, bón thúc đợt 2",
        # "Kỹ thuật trồng cà chua công nghệ cao trong nhà màng" — Báo Nông nghiệp và Môi trường
        "youtube_id": "M1fqC6tuXLI",
        "video_credit": "Video: Báo Nông nghiệp và Môi trường",
        "tasks": ("flowering", ["lam_gian", "tia_la_goc", "bon_thuc_2", "kiem_tra_benh"]),
        "sort_order": 2,
    },
    {
        "id": "demo-guide-u-phan-bon-lot",
        "stage_code": "seedling",
        "title": "Bón lót phân hữu cơ trước khi trồng cà chua",
        # "Kỹ thuật ủ phân hữu cơ bón cho cây trồng | VTC16" — KÊNH VTC16
        "youtube_id": "nGqGU7yYO-c",
        "video_credit": "Video: Kênh VTC16",
        "tasks": ("seedling", ["bon_lot", "tuoi_giu_am", "bon_thuc_1"]),
        "sort_order": 1,
    },
]


def _guide_steps(protocol: dict, stage_code: str, keys: list[str]) -> list[dict]:
    stage = {s["stage_code"]: s for s in protocol["stages"]}.get(stage_code)
    if stage is None:
        return []
    tasks = {t["key"]: t for t in stage["tasks"]}
    return [{"title": tasks[k]["title"], "body": tasks[k]["detail"], "image_id": None} for k in keys if k in tasks]


def _protocol(crop_type: str, protocol_id: str | None = None) -> dict | None:
    return next(
        (
            p
            for p in static_data.load("care_protocols")["protocols"]
            if p["crop_type"] == crop_type and (protocol_id is None or p["id"] == protocol_id)
        ),
        None,
    )


def seed_demo_guides(db) -> None:
    protocol = _protocol("tomato")
    if protocol is None:
        print("  care guides: no tomato protocol, skipped")
        return
    stages = {s["stage_code"]: s for s in protocol["stages"]}
    source = protocol["source"]
    created = 0
    for spec in DEMO_GUIDES:
        stage_code, keys = spec["tasks"]
        stage = stages.get(stage_code)
        if stage is None:
            continue
        steps = _guide_steps(protocol, stage_code, keys)
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


# Hai việc ở giai đoạn đầu mà hộ chính đã làm, kèm ghi chú "làm thế nào" của chính họ —
# dữ liệu cho màn hình Lịch sử công việc / Ghi chú / Tiền công (V2.1). Cố ý chọn
# giai đoạn cây con: số việc đang chờ ở giai đoạn hiện tại không đổi.
DEMO_TASKS = [
    # (id, key, ngày xong, ghi chú, ngày ghi chú)
    (
        "demo-task-bon-lot",
        "bon_lot",
        "2026-08-19",
        "Rải phân hữu cơ đã ủ khoảng 2 kg mỗi mét vuông rồi xới trộn đều trước khi lên luống. Tưới đẫm một lần.",
        "2026-08-19",
    ),
    (
        "demo-task-bon-thuc-1",
        "bon_thuc_1",
        "2026-09-05",
        "Thuê 3 người bón quanh gốc cách 10 cm, mỗi gốc một nắm nhỏ NPK rồi tưới nhẹ ngay. Làm xong trong một buổi sáng.",
        "2026-09-05",
    ),
]


def seed_demo_tasks(db, owner: str) -> int:
    protocol = _protocol("tomato")
    if protocol is None:
        return 0
    seedling = next((st for st in protocol["stages"] if st["stage_code"] == "seedling"), None)
    if seedling is None:
        return 0
    titles = {t["key"]: t["title"] for t in seedling["tasks"]}
    created = 0
    for row_id, key, done_day, note, note_day in DEMO_TASKS:
        if key not in titles:
            continue
        created += _upsert(
            db,
            TaskHistory,
            row_id,
            protocol_id=protocol["id"],
            stage_code="seedling",
            task_key=key,
            task_title=titles[key],
            crop_type="tomato",
            plot_id=DEMO_PLOT_ID,
            done=True,
            done_at=ms(done_day),
            remind_at=None,
            note=None,
            owner_id=owner,
            updated_by=owner,
            created_at=ms(done_day),
            updated_at=ms(DEMO_REVISION),
        )
        created += _upsert(
            db,
            TaskNote,
            f"{row_id}-note",
            task_id=row_id,
            plot_id=DEMO_PLOT_ID,
            note_text=note,
            media_json=None,
            occurred_at=ms(note_day, 11),
            owner_id=owner,
            updated_by=owner,
            created_at=ms(note_day, 11),
            updated_at=ms(DEMO_REVISION),
        )
    return created


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


# ---------------------------------------------------------------------------
# Household spec -> rows. One function writes any household, so the two kiểm
# thử neighbours and the extended roster go through the same code path.
# ---------------------------------------------------------------------------

# Phiếu nhập: (id, mã phân, tên, nhóm, kg, tổng tiền, ngày, ghi chú, chỉ số lô)
# Phiếu xuất: (id, mã phân, tên, nhóm, kg, đơn giá FIFO, ngày, ghi chú, chỉ số lô)
# Khoản thu : (id, loại, mô tả, số tiền, ngày, ghi chú, đã đối chiếu, chỉ số lô)
# Khoản chi : (id, loại, mô tả, số tiền, ngày, ghi chú, chỉ số lô, (người, số lượng, đơn vị, đơn giá) | None)
# Vụ trồng  : (id, tên, cây, giống id, giống, mùa, bắt đầu, kết thúc, sản lượng kg, diện tích m², chỉ số lô)
def _seed_household(db, spec: dict) -> int:
    user = _set_user(
        db,
        spec["user_id"],
        spec["username"],
        full_name=spec["full_name"],
        phone=spec["phone"],
        region=spec["region"],
        active=spec.get("active", True),
    )
    owner = user.id
    created = 0
    plot_ids: list[str] = []
    revision = ms(DEMO_REVISION)

    for p in spec.get("plots", []):
        planted = ms(p["planted"])
        plot_ids.append(p["id"])
        created += _upsert(
            db,
            Plot,
            p["id"],
            code=p["code"],
            name=p["name"],
            region=spec["region"],
            area=float(p["area"]),
            area_unit="m2",
            crop_type=p["crop"],
            crop_name=CROP_NAMES[p["crop"]],
            variety_id=p.get("variety_id"),
            variety_name=p.get("variety_name"),
            planted_at=planted,
            status=p.get("status", "active"),
            notes=p.get("notes"),
            owner_id=owner,
            updated_by=owner,
            created_at=planted,
            updated_at=max(planted, revision) if spec.get("legacy") else planted,
        )

    def plot_of(index: int | None) -> str | None:
        return plot_ids[index] if index is not None and index < len(plot_ids) else None

    for row_id, fid, name, category, kg, total, day, note, idx in spec.get("purchases", []):
        stamp = revision if spec.get("legacy") else ms(day)
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
            price=float(total),
            unit_price=total / kg,
            occurred_at=ms(day),
            note=note,
            plot_id=plot_of(idx),
            expense_id=f"{row_id}-expense",
            owner_id=owner,
            updated_by=owner,
            created_at=ms(day),
            updated_at=stamp,
        )
        created += _upsert(
            db,
            Expense,
            f"{row_id}-expense",
            kind="fertilizer",
            description=f"Mua {name} {kg:g} kg",
            amount=float(total),
            occurred_at=ms(day),
            note=note,
            plot_id=plot_of(idx),
            checked=False,
            warehouse_in_id=row_id,
            owner_id=owner,
            updated_by=owner,
            created_at=ms(day),
            updated_at=stamp,
        )

    for row_id, fid, name, category, kg, unit_price, day, note, idx in spec.get("issues", []):
        created += _upsert(
            db,
            WarehouseOut,
            row_id,
            fertilizer_id=fid,
            fertilizer_name=name,
            category=category,
            quantity_kg=float(kg),
            unit_price=float(unit_price),
            total_cost=float(kg) * float(unit_price),
            occurred_at=ms(day),
            note=note,
            plot_id=plot_of(idx),
            plan_id=None,
            owner_id=owner,
            updated_by=owner,
            created_at=ms(day),
            updated_at=ms(day),
        )

    for row_id, kind, desc, amount, day, note, checked, idx in spec.get("incomes", []):
        created += _upsert(
            db,
            Income,
            row_id,
            kind=kind,
            description=desc,
            amount=float(amount),
            occurred_at=ms(day),
            note=note,
            plot_id=plot_of(idx),
            checked=checked,
            owner_id=owner,
            updated_by=owner,
            created_at=ms(day),
            updated_at=revision if spec.get("legacy") else ms(day),
        )

    for row_id, kind, desc, amount, day, note, idx, labor in spec.get("expenses", []):
        workers, quantity, unit, unit_price = labor or (None, None, None, None)
        created += _upsert(
            db,
            Expense,
            row_id,
            kind=kind,
            description=desc,
            amount=float(amount),
            occurred_at=ms(day),
            note=note,
            plot_id=plot_of(idx),
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
            updated_at=revision if spec.get("legacy") else ms(day),
        )

    for row_id, name, crop, variety_id, variety_name, season, start, end, yield_kg, area_m2, idx in spec.get("cycles", []):
        created += _upsert(
            db,
            CropCycle,
            row_id,
            plot_id=plot_of(idx),
            name=name,
            crop_type=crop,
            crop_name=CROP_NAMES[crop],
            variety_id=variety_id,
            variety_name=variety_name,
            stage="finished",
            season=season,
            started_at=ms(start),
            ended_at=ms(end),
            area_m2=float(area_m2),
            yield_kg=float(yield_kg),
            notes=None,
            media_json=None,
            owner_id=owner,
            updated_by=owner,
            created_at=ms(end),
            updated_at=ms(end),
        )
    return created


# Hai hộ láng giềng của hộ chính, giữ cho bộ kiểm thử cô lập dữ liệu (Giai đoạn 4):
# số liệu tiền giữ nguyên so với bản cũ, chỉ đổi người, địa danh và nơi mua bán.
NEIGHBOURS = [
    {
        "legacy": True,
        "user_id": "demo-user-anh",
        "username": "tranquochung",
        "full_name": "Trần Quốc Hưng",
        "phone": "0987215463",
        "region": "Đa Thiện, phường Lâm Viên - Đà Lạt, Lâm Đồng",
        "plots": [
            {
                "id": "demo-plot-puc-002-hb",
                "code": "PUC-2609-LV01",
                "name": "Ruộng dưa leo Đa Thiện",
                "area": 500.0,
                "crop": "cucumber",
                "variety_id": "seed_cucumber_hunter_1",
                "variety_name": "Hunter 1.0",
                "planted": "2026-09-01",
                "notes": "Đất đen pha cát, làm giàn tre, tưới phun.",
            }
        ],
        "purchases": [
            ("demo-in-anh-npk", "npk_16_16_8_ca_mau", "NPK 16-16-8 Cà Mau", "npk", 50, 700_000, "2026-09-02", "Đại lý vật tư nông nghiệp Đa Thiện", 0)
        ],
        "incomes": [
            ("demo-income-anh", "product", "Bán dưa leo 120 kg", 1_440_000.0, "2026-09-08", "Bán cho thương lái chợ Đà Lạt", False, 0)
        ],
        "expenses": [("demo-expense-anh", "labor", "Công làm giàn (2 công)", 400_000.0, "2026-09-03", None, 0, None)],
    },
    {
        "legacy": True,
        "user_id": "demo-user-hai",
        "username": "vuducthinh",
        "full_name": "Vũ Đức Thịnh",
        "phone": "0903478215",
        "region": "Đạ Sar, xã Lạc Dương, Lâm Đồng",
        "plots": [
            {
                "id": "demo-plot-puc-003-hb",
                "code": "PUC-2608-LD01",
                "name": "Vườn ớt chỉ thiên Đạ Sar",
                "area": 360.0,
                "crop": "chili",
                "variety_id": "seed_chili_vifon686",
                "variety_name": "VIFON686 (chỉ thiên lai F1)",
                "planted": "2026-08-10",
                "notes": "Đất dốc nhẹ, phủ bạt, tưới nhỏ giọt.",
            }
        ],
        "purchases": [
            ("demo-in-hai-kali", "kali_bot_ca_mau", "Kali bột (MOP) Cà Mau", "kali", 25, 275_000, "2026-09-02", "Đại lý vật tư nông nghiệp Lạc Dương", 0)
        ],
        "incomes": [
            ("demo-income-hai", "product", "Bán ớt chỉ thiên 40 kg", 2_000_000.0, "2026-09-12", "Bán cho thương lái thu mua tại vườn", False, 0)
        ],
        "expenses": [("demo-expense-hai", "utilities", "Tiền điện bơm nước", 90_000.0, "2026-09-06", None, 0, None)],
    },
]


def seed_neighbour_farms(db) -> None:
    for spec in NEIGHBOURS:
        created = _seed_household(db, spec)
        print(f"  demo farm ({spec['username']}): {created} rows added, rest refreshed")


# ---------------------------------------------------------------------------
# Tầng mở rộng — chỉ chạy từ `python -m app.seed`.
# ---------------------------------------------------------------------------

EXTENDED_HOUSEHOLDS = [
    {
        "user_id": "demo-user-mai",
        "username": "nguyenthimai",
        "full_name": "Nguyễn Thị Mai",
        "phone": "0905821439",
        "region": "Thái Phiên, phường Lâm Viên - Đà Lạt, Lâm Đồng",
        "plots": [
            {
                "id": "demo-plot-mai-1",
                "code": "PUC-2608-LV02",
                "name": "Ruộng bắp cải Thái Phiên",
                "area": 800.0,
                "crop": "cabbage",
                "variety_id": "seed_cabbage_nasaca",
                "variety_name": "NASACA (lai F1)",
                "planted": "2026-08-12",
                "status": "harvested",
                "notes": "Đã thu hoạch cuối tháng 10, để đất nghỉ trước vụ Đông.",
            }
        ],
        "purchases": [
            ("demo-in-mai-npk", "npk_20_20_15_binh_dien", "NPK 20-20-15 TE Bình Điền", "npk", 50, 935_000, "2026-08-10", "Đại lý vật tư nông nghiệp Thái Phiên", 0)
        ],
        "issues": [
            ("demo-out-mai-npk", "npk_20_20_15_binh_dien", "NPK 20-20-15 TE Bình Điền", "npk", 30, 18_700, "2026-09-06", "Bón thúc đợt 1", 0)
        ],
        "incomes": [
            ("demo-income-mai-1", "product", "Bán bắp cải 900 kg", 4_500_000, "2026-10-25", "Bán cho vựa rau Thái Phiên", True, 0),
            ("demo-income-mai-2", "product", "Bán bắp cải loại 2 – 250 kg", 750_000, "2026-10-27", "Bán lẻ tại chợ Đà Lạt", False, 0),
        ],
        "expenses": [
            ("demo-expense-mai-seed", "seed", "Mua cây giống bắp cải 8.000 cây", 1_200_000, "2026-08-11", "Vườn ươm Thái Phiên", 0, None),
            ("demo-expense-mai-labor", "labor", "Công thu hoạch bắp cải (5 công)", 1_250_000, "2026-10-25", None, 0, (5.0, 1.0, "day", 250_000.0)),
            ("demo-expense-mai-power", "utilities", "Tiền điện bơm nước tháng 10", 160_000, "2026-10-31", None, 0, None),
            ("demo-expense-mai-nov", "other", "Thuê xe chở bắp cải ra chợ", 300_000, "2026-11-02", None, 0, None),
        ],
        "cycles": [
            ("demo-cycle-mai-xuan-2026", "Vụ Xuân 2026 — Bắp cải", "cabbage", "seed_cabbage_nasaca", "NASACA (lai F1)", "spring", "2026-02-10", "2026-05-20", 2_400, 800, 0)
        ],
    },
    {
        "user_id": "demo-user-tam",
        "username": "hoangvantam",
        "full_name": "Hoàng Văn Tâm",
        "phone": "0983117524",
        "region": "Xuân Thọ, phường Xuân Trường - Đà Lạt, Lâm Đồng",
        "plots": [
            {
                "id": "demo-plot-tam-1",
                "code": "PUC-2601-XT03",
                "name": "Vườn cà phê Catimor Xuân Thọ",
                "area": 5000.0,
                "crop": "coffee",
                "variety_id": "seed_coffee_arabica_catimor",
                "variety_name": "Catimor",
                "planted": "2018-06-10",
                "notes": "Cà phê chè trồng 2018, che bóng bằng cây bơ, tưới phun mưa.",
            }
        ],
        "purchases": [
            ("demo-in-tam-npk", "npk_18_8_18_ca_mau", "NPK 18-8-18 Cà Mau", "npk", 200, 2_940_000, "2026-10-05", "Đại lý vật tư nông nghiệp Xuân Thọ", 0),
            ("demo-in-tam-kali", "kali_bot_ca_mau", "Kali bột (MOP) Cà Mau", "kali", 100, 1_100_000, "2026-10-05", "Đại lý vật tư nông nghiệp Xuân Thọ", 0),
        ],
        "issues": [
            ("demo-out-tam-npk", "npk_18_8_18_ca_mau", "NPK 18-8-18 Cà Mau", "npk", 120, 14_700, "2026-10-12", "Bón đợt cuối mùa mưa", 0)
        ],
        "incomes": [
            ("demo-income-tam-1", "product", "Bán cà phê quả tươi 1.200 kg", 12_000_000, "2026-11-02", "Bán cho cơ sở sơ chế ở Xuân Thọ", False, 0)
        ],
        "expenses": [
            ("demo-expense-tam-labor", "labor", "Công hái cà phê (6 công)", 1_620_000, "2026-11-02", None, 0, (6.0, 1.0, "day", 270_000.0)),
            ("demo-expense-tam-power", "utilities", "Tiền điện tưới tháng 10", 420_000, "2026-10-30", None, 0, None),
        ],
    },
    {
        "user_id": "demo-user-huong",
        "username": "dangthihuong",
        "full_name": "Đặng Thị Hương",
        "phone": "0971560238",
        "region": "Tà Nung, phường Cam Ly - Đà Lạt, Lâm Đồng",
        "plots": [
            {
                "id": "demo-plot-huong-1",
                "code": "PUC-2607-CL01",
                "name": "Ruộng cà rốt Tà Nung",
                "area": 600.0,
                "crop": "carrot",
                "variety_id": "seed_carrot_phudi_1_0",
                "variety_name": "PHUDI 1.0",
                "planted": "2026-07-20",
                "status": "harvested",
                "notes": "Đất đỏ bazan tơi xốp, luống cao.",
            }
        ],
        "purchases": [
            ("demo-in-huong-npk", "npk_16_16_8_dau_trau", "NPK 16-16-8 Đầu Trâu (Bình Điền)", "npk", 50, 800_000, "2026-07-18", "Đại lý vật tư nông nghiệp Tà Nung", 0)
        ],
        "issues": [
            ("demo-out-huong-npk", "npk_16_16_8_dau_trau", "NPK 16-16-8 Đầu Trâu (Bình Điền)", "npk", 25, 16_000, "2026-08-25", "Bón thúc đợt 2", 0)
        ],
        "incomes": [
            ("demo-income-huong-1", "product", "Bán cà rốt 700 kg", 6_300_000, "2026-10-30", "Bán cho vựa rau Cam Ly", True, 0)
        ],
        "expenses": [
            ("demo-expense-huong-labor", "labor", "Công nhổ và rửa cà rốt (4 công)", 1_000_000, "2026-10-29", None, 0, (4.0, 1.0, "day", 250_000.0)),
            ("demo-expense-huong-nov", "utilities", "Tiền điện tháng 10", 190_000, "2026-11-01", None, 0, None),
        ],
        "cycles": [
            ("demo-cycle-huong-dong-2025", "Vụ Đông 2025 — Cà rốt", "carrot", "seed_carrot_phudi_1_0", "PHUDI 1.0", "winter", "2025-11-05", "2026-02-15", 1_380, 600, 0)
        ],
    },
    {
        "user_id": "demo-user-ha",
        "username": "ngothithuha",
        "full_name": "Ngô Thị Thu Hà",
        "phone": "0902745681",
        "region": "Phú Hội, xã Đức Trọng, Lâm Đồng",
        "plots": [
            {
                "id": "demo-plot-ha-1",
                "code": "PUC-2607-DT01",
                "name": "Nhà màng cà chua bi Phú Hội",
                "area": 400.0,
                "crop": "tomato",
                "variety_id": "seed_ca_chua_bi_do",
                "variety_name": "Cà chua bi đỏ",
                "planted": "2026-07-15",
                "notes": "Nhà màng, giàn dây, tưới nhỏ giọt có bộ châm phân.",
            }
        ],
        "purchases": [
            ("demo-in-ha-ure", "ure_phu_my", "Urê Phú Mỹ", "dam", 25, 317_500, "2026-07-14", "Đại lý vật tư nông nghiệp Phú Hội", 0),
            ("demo-in-ha-kali", "kali_bot_phu_my", "Kali bột (MOP) Phú Mỹ", "kali", 25, 267_500, "2026-07-14", "Đại lý vật tư nông nghiệp Phú Hội", 0),
        ],
        "incomes": [
            ("demo-income-ha-1", "product", "Bán cà chua bi đỏ 220 kg", 4_840_000, "2026-10-20", "Bán cho siêu thị rau sạch Đức Trọng", True, 0),
            ("demo-income-ha-2", "product", "Bán cà chua bi đỏ 180 kg", 3_780_000, "2026-11-01", "Bán cho siêu thị rau sạch Đức Trọng", False, 0),
        ],
        "expenses": [
            ("demo-expense-ha-labor", "labor", "Công tỉa nhánh, buộc giàn (3 công)", 750_000, "2026-09-10", None, 0, (3.0, 1.0, "day", 250_000.0)),
            ("demo-expense-ha-pick", "labor", "Công hái cà chua bi (2 người × 3 giờ)", 270_000, "2026-11-01", None, 0, (2.0, 3.0, "hour", 45_000.0)),
        ],
        "cycles": [
            ("demo-cycle-ha-xuan-2026", "Vụ Xuân 2026 — Cà chua bi đỏ", "tomato", "seed_ca_chua_bi_do", "Cà chua bi đỏ", "spring", "2026-01-20", "2026-05-30", 1_300, 400, 0)
        ],
    },
    {
        "user_id": "demo-user-loc",
        "username": "buivanloc",
        "full_name": "Bùi Văn Lộc",
        "phone": "0978213904",
        "region": "Đạ Ròn, xã Đơn Dương, Lâm Đồng",
        "plots": [
            {
                "id": "demo-plot-loc-1",
                "code": "PUC-2608-DD01",
                "name": "Ruộng ngô nếp Đạ Ròn",
                "area": 1000.0,
                "crop": "corn",
                "variety_id": "seed_corn_hn88",
                "variety_name": "HN88 (nếp lai F1)",
                "planted": "2026-08-05",
                "status": "harvested",
                "notes": "Đất thịt pha cát ven suối, tưới rãnh.",
            }
        ],
        "purchases": [
            ("demo-in-loc-ure", "ure_ca_mau", "Urê Cà Mau", "dam", 50, 650_000, "2026-08-03", "Đại lý vật tư nông nghiệp Đạ Ròn", 0)
        ],
        "incomes": [
            ("demo-income-loc-1", "product", "Bán ngô nếp tươi 700 kg", 4_900_000, "2026-10-22", "Bán cho thương lái thu mua tại ruộng", True, 0),
            ("demo-income-loc-2", "product", "Bán ngô nếp tươi 260 kg", 1_820_000, "2026-11-02", "Bán cho thương lái thu mua tại ruộng", False, 0)
        ],
        "expenses": [
            ("demo-expense-loc-labor", "labor", "Công bẻ bắp (4 công)", 1_000_000, "2026-10-21", None, 0, (4.0, 1.0, "day", 250_000.0)),
            ("demo-expense-loc-nov", "other", "Mua bao tải và dây buộc", 140_000, "2026-11-02", None, 0, None),
        ],
    },
    {
        "user_id": "demo-user-duc",
        "username": "trinhvanduc",
        "full_name": "Trịnh Văn Đức",
        "phone": "0966358172",
        "region": "Nam Ban, xã Nam Ban Lâm Hà, Lâm Đồng",
        "plots": [
            {
                "id": "demo-plot-duc-1",
                "code": "PUC-2603-NB01",
                "name": "Vườn cà phê vối TR4 Nam Ban",
                "area": 8000.0,
                "crop": "coffee",
                "variety_id": "seed_coffee_robusta_tr4",
                "variety_name": "TR4",
                "planted": "2015-05-20",
                "notes": "Cà phê vối ghép, tưới bằng giếng khoan.",
            }
        ],
        "purchases": [
            ("demo-in-duc-npk", "npk_16_16_8_ca_mau", "NPK 16-16-8 Cà Mau", "npk", 100, 1_410_000, "2026-10-12", "Đại lý vật tư nông nghiệp Nam Ban", 0),
            ("demo-in-duc-kali", "kali_bot_ca_mau", "Kali bột (MOP) Cà Mau", "kali", 50, 550_000, "2026-10-12", "Đại lý vật tư nông nghiệp Nam Ban", 0),
        ],
        "incomes": [
            ("demo-income-duc-1", "product", "Bán cà phê nhân 500 kg", 50_000_000, "2026-11-01", "Bán cho đại lý thu mua Nam Ban", False, 0)
        ],
        "expenses": [
            ("demo-expense-duc-labor", "labor", "Công hái cà phê (10 công)", 2_500_000, "2026-11-01", None, 0, (10.0, 1.0, "day", 250_000.0)),
            ("demo-expense-duc-power", "utilities", "Tiền điện tưới tháng 10", 780_000, "2026-10-31", None, 0, None),
        ],
    },
    {
        "user_id": "demo-user-yen",
        "username": "lamthiyen",
        "full_name": "Lâm Thị Yến",
        "phone": "0935460827",
        "region": "Tân Hội, xã Tân Hội, Lâm Đồng",
        "plots": [
            {
                "id": "demo-plot-yen-1",
                "code": "PUC-2608-TH01",
                "name": "Vườn ớt sừng Tân Hội",
                "area": 700.0,
                "crop": "chili",
                "variety_id": "seed_chili_sung_vang_hoang_long",
                "variety_name": "Sừng vàng Hoàng Long (lai F1)",
                "planted": "2026-08-18",
                "notes": "Phủ bạt đen, tưới nhỏ giọt.",
            }
        ],
        "purchases": [
            ("demo-in-yen-npk", "npk_18_8_18_ca_mau", "NPK 18-8-18 Cà Mau", "npk", 50, 735_000, "2026-08-16", "Đại lý vật tư nông nghiệp Tân Hội", 0)
        ],
        "incomes": [
            ("demo-income-yen-1", "product", "Bán ớt sừng 150 kg", 2_700_000, "2026-10-30", "Bán cho thương lái chợ đầu mối", False, 0),
            ("demo-income-yen-2", "product", "Bán ớt sừng 110 kg", 2_090_000, "2026-11-02", "Bán cho thương lái chợ đầu mối", False, 0),
        ],
        "expenses": [
            ("demo-expense-yen-labor", "labor", "Công hái ớt (4 công)", 1_000_000, "2026-10-30", None, 0, (4.0, 1.0, "day", 250_000.0)),
            ("demo-expense-yen-nov", "labor", "Công hái ớt (3 công)", 750_000, "2026-11-02", None, 0, (3.0, 1.0, "day", 250_000.0)),
        ],
    },
    {
        "user_id": "demo-user-lan",
        "username": "phamthilan",
        "full_name": "Phạm Thị Lan",
        "phone": "0392618745",
        "region": "Lát, phường Lang Biang - Đà Lạt, Lâm Đồng",
        "plots": [
            {
                "id": "demo-plot-lan-1",
                "code": "PUC-2609-LB01",
                "name": "Vườn dưa leo Nhật Lát",
                "area": 450.0,
                "crop": "cucumber",
                "variety_id": "seed_cucumber_nhat_lai_f1",
                "variety_name": "Dưa leo Nhật lai F1 (trái 30–35 cm)",
                "planted": "2026-09-25",
                "notes": "Giàn chữ A, tưới nhỏ giọt.",
            }
        ],
        "purchases": [
            ("demo-in-lan-npk", "npk_16_16_8_phu_my", "NPK 16-16-8 Phú Mỹ", "npk", 50, 700_000, "2026-09-23", "Đại lý vật tư nông nghiệp Lát", 0)
        ],
        "incomes": [
            ("demo-income-lan-1", "product", "Bán dưa leo Nhật 95 kg", 1_710_000, "2026-11-02", "Bán cho cửa hàng rau sạch phường Lang Biang", False, 0)
        ],
        "expenses": [
            ("demo-expense-lan-labor", "labor", "Công làm giàn chữ A (3 công)", 750_000, "2026-09-26", None, 0, (3.0, 1.0, "day", 250_000.0)),
        ],
    },
    {
        # Đã bị khoá: để trang Tài khoản có đủ cả hai trạng thái.
        "user_id": "demo-user-quan",
        "username": "vominhquan",
        "full_name": "Võ Minh Quân",
        "phone": "0369724551",
        "region": "Đạ Nhim, xã Lạc Dương, Lâm Đồng",
        "active": False,
        "plots": [
            {
                "id": "demo-plot-quan-1",
                "code": "PUC-2606-LD02",
                "name": "Ruộng bắp cải Đạ Nhim",
                "area": 900.0,
                "crop": "cabbage",
                "variety_id": "seed_cabbage_valentine",
                "variety_name": "Valentine (trái tim F1)",
                "planted": "2026-06-10",
                "status": "fallow",
                "notes": "Đang bỏ hoang vụ này; tài khoản bị khoá do trùng thông tin với một tài khoản khác.",
            }
        ],
    },
    # Tài khoản mới tạo, chưa được giao lô: trang Lô đất có việc để làm.
    # Tài khoản này cũng là `settings.seed_farmer_username` mà bộ test dùng nên
    # được lập ở seed.py, không ở đây.
]


def _admin_id(db) -> str | None:
    from app.core.config import settings

    admin = db.scalar(select(User).where(User.username == settings.seed_admin_username))
    return admin.id if admin else None


# Lịch sử giá phân bón do admin nhập: (mã phân, giá đ/kg, ngày hiệu lực).
# Giá nằm trong khoảng khảo sát của shared/data/fertilizer_recommendations.json
# (đợt 06–07/09/2026); đây là DỮ LIỆU MINH HỌA cho trang lịch sử giá, không phải
# bảng giá thị trường.
PRICE_HISTORY = [
    ("ure_ca_mau", 12_800, "2026-08-15"),
    ("ure_ca_mau", 13_000, "2026-09-07"),
    ("ure_ca_mau", 13_400, "2026-10-15"),
    ("dap_han_quoc", 21_900, "2026-09-07"),
    ("dap_han_quoc", 22_300, "2026-10-15"),
    ("kali_bot_ca_mau", 11_000, "2026-09-07"),
    ("kali_bot_ca_mau", 11_300, "2026-10-15"),
    ("npk_16_16_8_ca_mau", 14_100, "2026-09-07"),
    ("npk_16_16_8_ca_mau", 14_300, "2026-10-15"),
    ("npk_20_20_15_binh_dien", 18_700, "2026-09-07"),
]

# Nhật ký lỗi mà điện thoại tải lên: (id, hộ, màn hình, thông điệp, ngày giờ, đã bấm "Báo lỗi").
# Chỉ gồm các lỗi có thật trong luồng của ứng dụng: mất mạng khi đồng bộ, không
# có camera, tải tệp quá thời hạn.
ERROR_LOGS = [
    ("demo-log-01", "demo-user-anh", "Đồng bộ dữ liệu", "Network request failed", "2026-10-02", 9, False, None),
    ("demo-log-02", "demo-user-mai", "Ghi chú công việc · chụp ảnh", "Máy không có camera dùng được.", "2026-10-09", 15, True, None),
    ("demo-log-03", "demo-user-tam", "Đồng bộ dữ liệu", "Network request failed", "2026-10-14", 6, False, None),
    ("demo-log-04", "demo-user-huong", "Tải ảnh ghi chú lên máy chủ", "Quá thời gian chờ khi tải tệp (timeout 60 giây)", "2026-10-21", 17, False, None),
    ("demo-log-05", "demo-user-duc", "Đồng bộ dữ liệu", "Network request failed", "2026-10-28", 7, False, None),
    ("demo-log-06", "demo-user-thai", "Báo cáo thu – chi · xuất PDF", "Không có dữ liệu tháng này", "2026-11-01", 20, True, None),
]


def seed_extended(db) -> None:
    created = 0
    for spec in EXTENDED_HOUSEHOLDS:
        created += _seed_household(db, spec)
    print(f"  extended households: {len(EXTENDED_HOUSEHOLDS)} hộ, {created} rows added, rest refreshed")

    seed_extra_guides(db)
    seed_variety_proposals(db)
    seed_price_history(db)
    seed_error_logs(db)


# Giống do nông hộ đề xuất trong ứng dụng: (id, loại cây, loại con, tên, mô tả, người gửi,
# đã duyệt chưa, ngày gửi). Ba giống đang chờ để trang "Duyệt giống cây" có việc để làm.
PROPOSED_VARIETIES = [
    ("demo-variety-ha-bi-hong", "tomato", "tomato_cherry", "Cà chua bi hồng Đà Lạt", "Trái nhỏ, vỏ hồng, vị ngọt; mua hạt ở vườn ươm trong xã.", "demo-user-ha", False, "2026-10-28"),
    ("demo-variety-huong-baby", "carrot", "carrot_cu_dai", "Cà rốt baby F1", "Củ nhỏ dài 10–12 cm, ăn nguyên củ.", "demo-user-huong", False, "2026-11-01"),
    ("demo-variety-mai-tim", "cabbage", "cabbage_tron", "Bắp cải tím", "Lá màu tím, trồng thử 200 m² ở vụ này.", "demo-user-mai", False, "2026-11-02"),
    ("demo-variety-lan-mekong", "cucumber", "cucumber_japanese", "Dưa leo Nhật chịu nóng", "Giống đã được duyệt từ vụ trước.", "demo-user-lan", True, "2026-09-12"),
]


def seed_variety_proposals(db) -> None:
    crops = {c["id"]: c for c in static_data.load("crop_varieties")["crop_types"]}
    added = 0
    for row_id, crop_type, category_id, name, description, user_id, approved, day in PROPOSED_VARIETIES:
        crop = crops.get(crop_type)
        category = next((c for c in (crop or {}).get("categories", []) if c["category_id"] == category_id), None)
        if crop is None or category is None or db.get(User, user_id) is None:
            continue
        added += _upsert(
            db,
            CropVariety,
            row_id,
            seed_key=None,
            name=name,
            crop_type=crop_type,
            crop_name=crop["name"],
            category_id=category_id,
            category_name=category["category_name"],
            description=description,
            usage=None,
            growing_note=None,
            badge=None,
            is_seed=False,
            approved=approved,
            source="user",
            created_by=user_id,
            created_at=ms(day),
            updated_at=ms(day),
        )
    print(f"  proposed varieties: {added} added")


def seed_extra_guides(db) -> None:
    """Một bản nháp và một hướng dẫn không video, để trang quản trị có đủ trạng thái."""
    protocol = _protocol("cucumber", "cucumber_laichau_2025")
    if protocol is None:
        return
    source = protocol["source"]
    created = _upsert(
        db,
        CareGuide,
        "demo-guide-dua-leo-lam-gian",
        crop_type="cucumber",
        stage_code="vegetative",
        title="Dưa leo: làm giàn và bón thúc đợt 1",
        summary="Cây leo giàn (10–15 ngày sau gieo).",
        youtube_id=None,
        steps_json=json.dumps(_guide_steps(protocol, "vegetative", ["bon_thuc_1", "lam_gian"]), ensure_ascii=False),
        images_json=json.dumps([]),
        source_name=f"Các bước: {source['publisher']} — {source['title']}",
        source_url=source["url"],
        published=False,
        sort_order=3,
        created_by=None,
        updated_by=None,
        created_at=ms(DEMO_REVISION),
        updated_at=ms(DEMO_REVISION),
    )
    print(f"  extra care guides: {int(created)} added (bản nháp)")


def seed_price_history(db) -> None:
    admin_id = _admin_id(db)
    added = 0
    for fertilizer_id, price, day in PRICE_HISTORY:
        existing = db.scalar(
            select(FertilizerPrice).where(
                FertilizerPrice.fertilizer_id == fertilizer_id,
                FertilizerPrice.effective_from == ms(day),
            )
        )
        if existing is None:
            db.add(
                FertilizerPrice(
                    fertilizer_id=fertilizer_id,
                    price_per_kg=float(price),
                    effective_from=ms(day),
                    updated_by=admin_id,
                    created_at=ms(day),
                )
            )
            added += 1
    print(f"  fertilizer price history: {added} added")


def seed_error_logs(db) -> None:
    added = 0
    for row_id, user_id, action, message, day, hour, reported, stack in ERROR_LOGS:
        if db.get(User, user_id) is None or db.get(ErrorLog, row_id) is not None:
            continue
        stamp = ms(day, hour)
        db.add(
            ErrorLog(
                id=row_id,
                user_id=user_id,
                action=action,
                message=message,
                stack=stack,
                app_version="0.1.0",
                platform="android 13",
                occurred_at=stamp,
                reported=reported,
                created_at=stamp + 60_000,
                updated_at=stamp + 60_000,
            )
        )
        added += 1
    print(f"  error logs: {added} added")
