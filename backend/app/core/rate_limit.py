"""Brute-force guard for the login endpoint.

Only *failed* logins count. A phone that signs in normally — even a hundred
times a day while the farmer reinstalls the app — is never throttled; someone
guessing passwords gets five tries a minute and then a locked door.

The counters live in this process's memory on purpose:

* there is no Redis in this deployment, and adding one for a single counter
  would be a service to run, monitor and pay for;
* the window is 60 seconds, so nothing here is worth persisting;
* the cost of a lost counter is one extra guess after a restart.

With more than one uvicorn worker each worker keeps its own tally, so the
effective limit is `login_max_failures × workers`. That is documented in
docs/BACKEND_DEPLOYMENT.md together with the fix (rate limiting at the reverse
proxy) for the day the API runs on several workers.
"""

import threading
import time
from collections import deque

from fastapi import HTTPException, Request, status

from app.core.config import settings

# key -> timestamps (seconds) of recent failures, oldest first.
_failures: dict[str, deque[float]] = {}
_lock = threading.Lock()

# A dictionary that only ever grows is a slow memory leak. Housekeeping is
# cheap and runs at most once a minute.
_MAX_KEYS = 10_000
_last_sweep = 0.0


def login_key(request: Request, username: str) -> str:
    """One counter per (caller, account being guessed).

    Keyed on both so that one farmer fat-fingering their password on the shared
    village wifi cannot lock out the neighbour on the same IP.
    """
    client = request.client.host if request.client else "unknown"
    return f"{client}|{username.strip().lower()}"


def enforce(key: str) -> None:
    """Raises 429 when `key` has used up its attempts. Call before checking the
    password, so a locked-out caller cannot keep the guessing loop going."""
    if settings.login_max_failures <= 0:  # limiter disabled (tests, local dev)
        return

    now = time.time()
    with _lock:
        _sweep(now)
        recent = _recent(key, now)
        if len(recent) < settings.login_max_failures:
            return
        retry_after = int(max(1, settings.login_lockout_seconds - (now - recent[0])))

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.",
        headers={"Retry-After": str(retry_after)},
    )


def record_failure(key: str) -> None:
    if settings.login_max_failures <= 0:
        return
    now = time.time()
    with _lock:
        _recent(key, now).append(now)


def reset(key: str) -> None:
    """A correct password clears the tally — the account is clearly not under a
    successful guessing attack by the person who just proved they own it."""
    with _lock:
        _failures.pop(key, None)


def clear_all() -> None:
    """Test helper: forget every counter."""
    with _lock:
        _failures.clear()


def _recent(key: str, now: float) -> deque[float]:
    """The failures for `key` inside the window, pruned in place."""
    window = settings.login_failure_window_seconds
    attempts = _failures.setdefault(key, deque())
    while attempts and now - attempts[0] > window:
        attempts.popleft()
    return attempts


def _sweep(now: float) -> None:
    """Drops keys whose window has fully expired. Caller holds the lock."""
    global _last_sweep
    if now - _last_sweep < 60 and len(_failures) < _MAX_KEYS:
        return
    _last_sweep = now
    window = settings.login_failure_window_seconds
    for key in [k for k, v in _failures.items() if not v or now - v[-1] > window]:
        del _failures[key]
