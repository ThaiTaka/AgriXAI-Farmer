"""The care round a plot is in, by days since planting (ADR 0009).

The cases live in shared/test-fixtures/stage_for_day.json and are run by the
mobile suite too (mobile/__tests__/stageForDay.test.ts), so the phone and the
web dashboard cannot drift apart on which tasks are pending.
"""

import json
from pathlib import Path

import pytest

from app.services import dashboard_service, static_data

CASES = json.loads(
    (Path(__file__).resolve().parents[2] / "shared" / "test-fixtures" / "stage_for_day.json").read_text(encoding="utf-8")
)["cases"]


def _protocol(pid: str) -> dict:
    return next(p for p in static_data.load("care_protocols")["protocols"] if p["id"] == pid)


@pytest.mark.parametrize("case", CASES, ids=lambda c: f"{c['protocol']}@{c['day']}")
def test_stage_for_day_matches_the_shared_cases(case):
    stage = dashboard_service.stage_for_day(_protocol(case["protocol"]), case["day"])
    assert stage is not None and stage["stage_code"] == case["stage"]


def test_dated_rounds_come_from_the_procedure():
    """Every dated growth protocol starts at day 0 and its dated rounds never
    go backwards — a later round starting earlier would hide the one before."""
    for protocol in static_data.load("care_protocols")["protocols"]:
        if protocol["stage_model"] != "growth":
            continue
        days = [s.get("start_day") for s in protocol["stages"]]
        dated = [d for d in days if d is not None]
        if not dated:
            continue
        assert days[0] == 0, protocol["id"]
        assert dated == sorted(dated), f"{protocol['id']}: {days}"


def test_current_stage_uses_the_planting_date():
    day = 86_400_000
    tomato = _protocol("tomato_lamdong_2025")
    planted = 1_790_000_000_000
    assert dashboard_service.current_stage(tomato, planted, planted + 26 * day)["stage_code"] == "vegetative"
    assert dashboard_service.current_stage(tomato, None, planted) is None
