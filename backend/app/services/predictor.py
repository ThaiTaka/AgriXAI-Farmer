"""Disease predictor.

`DummyPredictor` stands in until a trained checkpoint exists. Swap it by setting
`MODEL_CHECKPOINT` in the environment — `get_predictor()` picks the real one up
without any caller changing.

The dummy is **deterministic on the image bytes**, not random. Two things depend
on that:

  * a photo queued while offline is uploaded later, possibly after a retry, and
    must not produce a different disease on the second attempt;
  * a demo is reproducible — the same test photo always gives the same answer.

Confidences land in a believable 0.30–0.85 band. A dummy that always answered
"99.7%" would teach whoever sees the demo to trust the number, which is the
opposite of what an unfinished model should do.
"""

import hashlib
from abc import ABC, abstractmethod
from typing import Any

from app.core.config import settings
from app.services import static_data


class Prediction(dict):
    """{"disease_key": str, "confidence": float}"""


class Predictor(ABC):
    name: str

    @abstractmethod
    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        """Returns {"predictions": [...top 3...], "heatmap": None | {...}}."""


class DummyPredictor(Predictor):
    name = "dummy-v1"

    # Confidence band for the top-1 answer.
    TOP1_MIN = 0.45
    TOP1_MAX = 0.85

    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        keys = [d["key"] for d in static_data.diseases()]
        digest = hashlib.sha256(image_bytes).digest()

        # Deterministic shuffle: order the catalogue by a hash of (digest, key).
        ranked = sorted(
            keys,
            key=lambda key: hashlib.sha256(digest + key.encode()).hexdigest(),
        )
        top3 = ranked[:3]

        # Spread the three confidences out of the same digest so they differ per
        # image but stay stable for one image.
        span = self.TOP1_MAX - self.TOP1_MIN
        top1 = self.TOP1_MIN + (digest[0] / 255) * span
        # The runners-up share what is left, never overtaking the winner.
        remainder = 1.0 - top1
        second = remainder * (0.45 + (digest[1] / 255) * 0.35)
        third = (remainder - second) * (0.4 + (digest[2] / 255) * 0.4)

        confidences = [round(top1, 4), round(second, 4), round(third, 4)]

        return {
            "predictions": [
                {"disease_key": key, "confidence": confidence}
                for key, confidence in zip(top3, confidences)
            ],
            # Never invent a heatmap. A made-up overlay would point a farmer at a
            # part of the leaf for no reason; the UI hides the layer when this is
            # null (see the Giai đoạn 2 brief).
            "heatmap": None,
            "model_version": self.name,
        }


class CheckpointPredictor(Predictor):
    """Placeholder for the real model. Not reachable until a checkpoint exists."""

    def __init__(self, checkpoint: str) -> None:
        self.name = f"checkpoint:{checkpoint}"
        self.checkpoint = checkpoint

    def predict(self, image_bytes: bytes) -> dict[str, Any]:  # pragma: no cover
        raise NotImplementedError(
            "MODEL_CHECKPOINT is set but no inference code is wired up yet. "
            "Implement CheckpointPredictor.predict or clear MODEL_CHECKPOINT."
        )


_predictor: Predictor | None = None


def get_predictor() -> Predictor:
    global _predictor
    if _predictor is None:
        _predictor = (
            CheckpointPredictor(settings.model_checkpoint)
            if settings.model_checkpoint
            else DummyPredictor()
        )
    return _predictor
