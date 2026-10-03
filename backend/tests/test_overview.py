"""V2.2 — trang tổng quan của web-admin: mọi nông hộ cùng lúc."""

from v21_support import admin, client, make_farmer


def test_the_admin_sees_every_farm_at_once():
    res = client.get("/dashboard/overview", headers=admin())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["farms_total"] >= 3  # the demo households
    assert len(body["months"]) == 6
    last = body["months"][-1]
    assert (last["year"], last["month"]) == (body["year"], body["month"])
    # Totals are the farms' own figures added up — nothing computed twice.
    assert body["month_income"] == sum(f["month_income"] for f in body["farms"])
    assert body["stock_value"] == sum(f["stock_value"] for f in body["farms"])
    assert body["plots"] >= sum(c["plots"] for c in body["crops"])
    assert body["crops"] == sorted(body["crops"], key=lambda c: c["area_m2"], reverse=True)
    names = {c["crop_name"] for c in body["crops"]}
    assert names & {"Hoa cúc", "Hoa hồng"}, names


def test_farmers_cannot_read_the_overview():
    farmer = make_farmer("v22_overview_farmer")
    assert client.get("/dashboard/overview", headers=farmer).status_code == 403
