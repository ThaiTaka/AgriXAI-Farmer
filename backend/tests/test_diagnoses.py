"""Diagnosis inference endpoint and the disease catalogue it advises from."""

import io
import struct
import zlib

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.seed import run as run_seed
from app.services.predictor import DummyPredictor
from app.services import static_data

run_seed()
client = TestClient(app)


def png_bytes(seed: int) -> bytes:
    """A tiny valid 1×1 PNG whose bytes differ per `seed`."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = bytes([0, seed % 256, (seed * 7) % 256, (seed * 13) % 256])
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


@pytest.fixture(scope="module")
def token() -> str:
    res = client.post(
        "/auth/login",
        json={
            "username": settings.seed_farmer_username,
            "password": settings.seed_farmer_password,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def post_image(token: str, payload: bytes, name: str = "leaf.png", mime: str = "image/png"):
    return client.post(
        "/diagnoses",
        headers=auth(token),
        files={"image": (name, io.BytesIO(payload), mime)},
        data={"plot_id": "plot-1", "client_id": "client-1"},
    )


def test_predict_returns_top_three(token: str):
    res = post_image(token, png_bytes(1))
    assert res.status_code == 200, res.text
    body = res.json()

    assert len(body["predictions"]) == 3
    keys = [p["disease_key"] for p in body["predictions"]]
    assert len(set(keys)) == 3, "the three predictions must be different diseases"

    known = {d["key"] for d in static_data.diseases()}
    assert set(keys) <= known


def test_confidences_are_believable_and_ordered(token: str):
    """A dummy that answers 99.7% teaches people to trust a number that means
    nothing. Top-1 stays inside 0.30–0.85 and the runners-up rank below it."""
    body = post_image(token, png_bytes(2)).json()
    values = [p["confidence"] for p in body["predictions"]]

    assert values == sorted(values, reverse=True)
    assert 0.30 <= values[0] <= 0.85, values
    assert sum(values) <= 1.0 + 1e-6, values
    assert all(v > 0 for v in values)


def test_same_photo_gives_the_same_answer(token: str):
    """A queued photo is uploaded later, possibly after a retry. It must not come
    back as a different disease the second time."""
    payload = png_bytes(3)
    first = post_image(token, payload).json()
    second = post_image(token, payload).json()
    assert first["predictions"] == second["predictions"]


def test_different_photos_give_different_answers(token: str):
    a = post_image(token, png_bytes(4)).json()["predictions"][0]
    b = post_image(token, png_bytes(99)).json()["predictions"][0]
    assert (a["disease_key"], a["confidence"]) != (b["disease_key"], b["confidence"])


def test_heatmap_is_null_never_invented(token: str):
    """The dummy model has no localisation. Drawing a made-up overlay would point
    a farmer at a random part of the leaf, so it returns null instead."""
    body = post_image(token, png_bytes(5)).json()
    assert body["heatmap"] is None


def test_rejects_non_image(token: str):
    res = client.post(
        "/diagnoses",
        headers=auth(token),
        files={"image": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
        data={"plot_id": "plot-1"},
    )
    assert res.status_code == 415


def test_requires_authentication():
    res = client.post(
        "/diagnoses",
        files={"image": ("leaf.png", io.BytesIO(png_bytes(6)), "image/png")},
    )
    assert res.status_code == 401


def test_predict_creates_no_database_row(token: str):
    """POST /diagnoses is inference only.

    The mobile app owns the record and pushes it through sync; if the server also
    created it, the next pull would try to send the same id back as a new record
    and WatermelonDB would refuse the batch.
    """
    before = client.get("/diagnoses", headers=auth(token)).json()
    post_image(token, png_bytes(7))
    after = client.get("/diagnoses", headers=auth(token)).json()
    assert len(before) == len(after) == 0


# ---------------------------------------------------------------------------
# The four cases the Giai đoạn 2 brief calls out by name.
# ---------------------------------------------------------------------------


def test_every_disease_has_a_severity():
    for disease in static_data.diseases():
        assert disease["severity"] in {"none", "mild", "moderate", "severe"}, disease["key"]


@pytest.mark.parametrize("key", ["mosaic_virus", "healthy"])
def test_no_products_for_virus_and_healthy(key: str):
    """Nothing to buy — and the app must say so rather than pad the screen."""
    disease = static_data.disease_by_key(key)
    assert disease is not None
    assert disease["products"] == []
    assert disease["no_product_text"], f"{key} needs text explaining why there is no product"


def test_yellow_leaf_curl_lists_vector_treatment_with_a_note():
    """The drugs listed kill the whitefly that carries the virus, not the virus.
    Without the note a farmer would read three names and expect a cure."""
    disease = static_data.disease_by_key("yellow_leaf_curl_virus")
    assert disease is not None
    assert disease["products"], "the vector treatments must still be listed"
    note = disease["product_note"]
    assert note and "bọ phấn" in note.lower()


def test_spider_mites_is_a_pest_not_a_fungus():
    """Drives the red warning that fungicide will not work."""
    disease = static_data.disease_by_key("spider_mites")
    assert disease is not None
    assert disease["type"] == "pest"
    assert disease["severity"] == "moderate"


def test_disease_endpoints(token: str):
    listing = client.get("/diseases")
    assert listing.status_code == 200
    assert len(listing.json()) == 10

    one = client.get("/diseases/late_blight")
    assert one.status_code == 200
    assert one.json()["name"] == "Mốc sương muộn"

    assert client.get("/diseases/khong_co_that").status_code == 404


def test_dummy_predictor_is_deterministic_without_http():
    predictor = DummyPredictor()
    payload = png_bytes(11)
    assert predictor.predict(payload) == predictor.predict(payload)
