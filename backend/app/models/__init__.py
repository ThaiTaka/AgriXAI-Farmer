"""SQLAlchemy models.

Import every model here so `Base.metadata` is complete before create_all().

The composite indexes at the bottom belong to the whole sync layer rather than
to any one table, so they are declared here, once, next to the query they serve.
"""

from sqlalchemy import Index

from app.models.farm import (
    CareGuide,
    ChangeLog,
    CropCycle,
    CropVariety,
    GrowthStage,
    Plot,
    PlotStatus,
    Season,
)
from app.models.fertilizer import FertilizerPrice
from app.models.ledger import (
    Expense,
    ExpenseKind,
    Income,
    IncomeKind,
    LaborUnit,
    Plan,
    StockUnit,
    TaskHistory,
    TaskNote,
    WarehouseIn,
    WarehouseOut,
)
from app.models.ops import ErrorLog, MediaFile
from app.models.user import User, UserRole

__all__ = [
    "User",
    "UserRole",
    "Plot",
    "PlotStatus",
    "CropVariety",
    "CropCycle",
    "GrowthStage",
    "ChangeLog",
    "Plan",
    "WarehouseIn",
    "WarehouseOut",
    "Income",
    "IncomeKind",
    "Expense",
    "ExpenseKind",
    "StockUnit",
    "TaskHistory",
    "TaskNote",
    "LaborUnit",
    "CareGuide",
    "Season",
    "ErrorLog",
    "MediaFile",
    "FertilizerPrice",
]



# --------------------------- sync pull indexes ----------------------------
# Every pull runs the same query per table:
#
#     SELECT * FROM <table> WHERE owner_id = :me AND updated_at > :last_pulled_at
#
# The single-column indexes the models already declare make the server scan one
# farmer's whole history on every sync. These composite indexes turn that into a
# range scan over the few rows changed since the last pull — the difference
# between a sync that stays flat and one that slows down as a farm accumulates
# records. `add_missing_indexes` (app/core/schema_upgrade.py) creates them on a
# database that predates this change.
SYNC_PULL_INDEXES = (
    Index("ix_plots_owner_updated", Plot.owner_id, Plot.updated_at),
    Index("ix_crop_cycles_owner_updated", CropCycle.owner_id, CropCycle.updated_at),
    Index("ix_plans_owner_updated", Plan.owner_id, Plan.updated_at),
    Index("ix_warehouse_in_owner_updated", WarehouseIn.owner_id, WarehouseIn.updated_at),
    Index("ix_warehouse_out_owner_updated", WarehouseOut.owner_id, WarehouseOut.updated_at),
    Index("ix_income_owner_updated", Income.owner_id, Income.updated_at),
    Index("ix_expense_owner_updated", Expense.owner_id, Expense.updated_at),
    Index("ix_tasks_history_owner_updated", TaskHistory.owner_id, TaskHistory.updated_at),
    Index("ix_task_notes_owner_updated", TaskNote.owner_id, TaskNote.updated_at),
    # change_logs is scoped by its author rather than by an owner column.
    Index("ix_change_logs_author_updated", ChangeLog.changed_by, ChangeLog.updated_at),
    # Reports and the dashboard filter one farm by business date, not by sync time.
    Index("ix_income_owner_occurred", Income.owner_id, Income.occurred_at),
    Index("ix_expense_owner_occurred", Expense.owner_id, Expense.occurred_at),
    Index("ix_warehouse_in_owner_occurred", WarehouseIn.owner_id, WarehouseIn.occurred_at),
    Index("ix_warehouse_out_owner_occurred", WarehouseOut.owner_id, WarehouseOut.occurred_at),
)
