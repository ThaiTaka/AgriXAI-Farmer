"""SQLAlchemy models.

Import every model here so `Base.metadata` is complete before create_all().
"""

from app.models.farm import (
    ChangeLog,
    CropCycle,
    CropVariety,
    Diagnosis,
    GrowthStage,
    Plot,
    PlotStatus,
    Severity,
)
from app.models.user import User, UserRole

__all__ = [
    "User",
    "UserRole",
    "Plot",
    "PlotStatus",
    "CropVariety",
    "Diagnosis",
    "Severity",
    "CropCycle",
    "GrowthStage",
    "ChangeLog",
]
