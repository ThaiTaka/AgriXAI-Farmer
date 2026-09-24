"""Rounding that matches the phone.

Python's round() rounds halves to even (round(0.5) == 0, round(2.5) == 2);
JavaScript's Math.round rounds them up. The phone and the server compute the
same money and productivity figures independently, so both use this one rule:
half up, as a farmer rounds by hand.
"""

import math


def half_up(value: float, digits: int = 0) -> float:
    """Same as JavaScript `Math.round(value * 10**digits) / 10**digits`."""
    scale = 10**digits
    return math.floor(value * scale + 0.5) / scale
