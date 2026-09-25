"""Password hashing (bcrypt) and JWT access tokens."""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import settings


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # Malformed hash in the database — treat as a failed login, never a 500.
        return False


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


# A media token rides in a URL (?t=...) because <img>, <video> and a WebView
# cannot send an Authorization header. URLs leak — into history, proxy logs,
# a screenshot — so this token is short-lived and scoped: it opens /media and
# nothing else. `current_user` refuses any token that carries a scope.
MEDIA_SCOPE = "media"


def create_media_token(subject: str) -> tuple[str, int]:
    """Returns (token, expires_at epoch ms)."""
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=settings.media_token_minutes)
    payload = {"sub": subject, "iat": now, "exp": expires, "scope": MEDIA_SCOPE}
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token, int(expires.timestamp() * 1000)
