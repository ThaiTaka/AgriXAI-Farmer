"""Reader for the offline JSON catalogues in `shared/data/`.

These files are the single source of truth for content the mobile app must be
able to show with no network at all: the fertiliser catalogue, care protocols
and crop varieties. The backend serves the same files so mobile and web-admin
never drift apart.

Files are cached in memory after the first read and reloaded automatically when
their mtime changes, so editing a JSON file during development takes effect
without restarting uvicorn.
"""

import json
from pathlib import Path
from typing import Any

from app.core.config import SHARED_DATA_DIR

FILES: dict[str, str] = {
    "fertilizer_recommendations": "fertilizer_recommendations.json",
    "care_protocols": "care_protocols.json",
    "crop_varieties": "crop_varieties.json",
}

_cache: dict[str, tuple[float, Any]] = {}


def path_for(key: str) -> Path:
    if key not in FILES:
        raise KeyError(f"Unknown static data set: {key}")
    return SHARED_DATA_DIR / FILES[key]


def load(key: str) -> Any:
    path = path_for(key)
    mtime = path.stat().st_mtime
    cached = _cache.get(key)
    if cached is None or cached[0] != mtime:
        with path.open(encoding="utf-8") as fh:
            _cache[key] = (mtime, json.load(fh))
    return _cache[key][1]


def availability() -> dict[str, bool]:
    """Which catalogues are present on disk — surfaced by GET /health."""
    return {key: path_for(key).is_file() for key in FILES}
