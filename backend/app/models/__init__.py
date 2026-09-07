"""SQLAlchemy models.

Import every model here so `Base.metadata` is complete before create_all().
"""

from app.models.user import User, UserRole

__all__ = ["User", "UserRole"]
