"""Chuyển dữ liệu từ file SQLite phát triển sang PostgreSQL production.

    python -m scripts.migrate_sqlite_to_postgres \
        --source sqlite:///./agrilog.db \
        --target postgresql+psycopg://agrilog:...@localhost:5432/agrilog

Cách làm: đọc từng bảng theo đúng thứ tự khoá ngoại mà SQLAlchemy đã biết
(`Base.metadata.sorted_tables`), ghi sang đích theo lô. Không đụng tới SQL thô
nên kiểu dữ liệu do chính SQLAlchemy chuyển đổi — đây là chỗ `INTEGER` 0/1 của
SQLite trở thành `boolean` thật của PostgreSQL thay vì lỗi kiểu lúc chạy.

An toàn:
  * Mặc định **không ghi đè**: nếu bảng đích đã có dữ liệu, script dừng và báo,
    trừ khi có `--truncate` (xoá sạch đích trước khi chép).
  * Chạy thử với `--dry-run` để chỉ đếm số dòng.
  * Mỗi bảng là một giao dịch: lỗi ở bảng nào thì bảng đó quay lui nguyên vẹn.

Sau khi chép xong, script tự kiểm tra lại số dòng hai bên và in bảng đối chiếu.
Chạy khi API đã tắt — dữ liệu ghi thêm trong lúc chép sẽ không được mang sang.
"""

import argparse
import sys
from pathlib import Path

from sqlalchemy import create_engine, func, insert, inspect, select, text
from sqlalchemy.exc import OperationalError


# Bảng điều khiển Windows mặc định dùng cp1252, không in được tiếng Việt.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: F401,E402 — fills Base.metadata
from app.core.database import Base  # noqa: E402
from app.core.schema_upgrade import add_missing_indexes  # noqa: E402

BATCH = 500


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", required=True, help="DATABASE_URL nguồn (SQLite)")
    parser.add_argument("--target", required=True, help="DATABASE_URL đích (PostgreSQL)")
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Xoá sạch bảng đích trước khi chép (mặc định: dừng nếu đích có dữ liệu)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Chỉ đếm, không ghi gì")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = create_engine(args.source)
    target = create_engine(args.target)

    for label, engine in (("nguồn", source), ("đích", target)):
        if not _reachable(label, engine):
            return 1

    if not args.dry_run:
        Base.metadata.create_all(bind=target)
        add_missing_indexes(target)

    report: list[tuple[str, int, int]] = []
    # Ở chế độ thử, đích có thể còn trống trơn (chưa chạy create_all), nên phải
    # hỏi xem bảng có tồn tại không trước khi đếm.
    target_tables = set(inspect(target).get_table_names())

    for table in Base.metadata.sorted_tables:
        with source.connect() as src:
            rows = [dict(r) for r in src.execute(select(table)).mappings()]

        with target.begin() as dst:
            if table.name in target_tables:
                existing = dst.execute(select(func.count()).select_from(table)).scalar_one()
            else:
                existing = 0

            if existing and not args.truncate:
                print(
                    f"DỪNG: bảng '{table.name}' ở đích đã có {existing} dòng.\n"
                    "Dùng --truncate nếu thật sự muốn thay thế toàn bộ."
                )
                return 1

            if args.dry_run:
                report.append((table.name, len(rows), existing))
                continue

            if existing and args.truncate:
                dst.execute(table.delete())

            for start in range(0, len(rows), BATCH):
                chunk = rows[start : start + BATCH]
                if chunk:
                    dst.execute(insert(table), chunk)

        report.append((table.name, len(rows), _count(target, table)))

    _print_report(report, dry_run=args.dry_run)
    mismatched = [name for name, src_n, dst_n in report if not args.dry_run and src_n != dst_n]
    if mismatched:
        print("\nKHÔNG KHỚP số dòng ở: " + ", ".join(mismatched))
        return 1

    print("\nXong. Đổi DATABASE_URL sang PostgreSQL rồi khởi động lại API.")
    return 0


def _reachable(label: str, engine) -> bool:
    """Kết nối thử trước khi làm gì. Một dòng nói rõ chuyện gì xảy ra tốt hơn
    một stack trace dài của SQLAlchemy — nhất là với lỗi hay gặp nhất: cơ sở dữ
    liệu đích chưa được tạo."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except OperationalError as exc:
        reason = str(exc.orig).strip().splitlines()[-1] if exc.orig else str(exc)
        print(f"Không kết nối được cơ sở dữ liệu {label}: {reason}")
        if "does not exist" in reason:
            print('  Tạo trước bằng:  psql -c "CREATE DATABASE <ten>;"')
        return False


def _count(engine, table) -> int:
    with engine.connect() as conn:
        return conn.execute(select(func.count()).select_from(table)).scalar_one()


def _print_report(report: list[tuple[str, int, int]], *, dry_run: bool) -> None:
    header = "nguồn -> đích (thử)" if dry_run else "nguồn -> đích"
    print(f"\n{'bảng':<24}{header}")
    print("-" * 52)
    for name, src_n, dst_n in report:
        mark = " " if dry_run or src_n == dst_n else " !"
        print(f"{name:<24}{src_n:>6} -> {dst_n:<6}{mark}")


if __name__ == "__main__":
    raise SystemExit(main())
