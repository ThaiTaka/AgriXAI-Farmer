# -*- coding: utf-8 -*-
"""Build the static Open Sans TTFs that the mobile app bundles.

React Native resolves fonts by family name + weight and does not handle
variable fonts reliably on Android, so we cut five static instances out of the
Open Sans variable font (one per weight used by the design system).

The app must never fetch fonts at runtime (design rule 3.3) - these files ship
inside the APK.

Prerequisites:  pip install fonttools brotli
Usage:          python shared/design/build-mobile-fonts.py [path/to/OpenSans[wdth,wght].ttf]
                (downloads the variable font from google/fonts if not given)
"""

import sys
import urllib.request
from pathlib import Path

from fontTools import ttLib
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "mobile" / "src" / "assets" / "fonts"
VAR_URL = "https://github.com/google/fonts/raw/main/ofl/opensans/OpenSans%5Bwdth,wght%5D.ttf"

WEIGHTS = {
    400: "Regular",
    500: "Medium",
    600: "SemiBold",
    700: "Bold",
    800: "ExtraBold",
}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if len(sys.argv) > 1:
        src = Path(sys.argv[1])
    else:
        src = OUT_DIR / "_OpenSans-Variable.ttf"
        if not src.exists():
            print(f"Downloading {VAR_URL}")
            urllib.request.urlretrieve(VAR_URL, src)

    for weight, name in WEIGHTS.items():
        font = ttLib.TTFont(src)
        instantiateVariableFont(font, {"wght": weight, "wdth": 100}, inplace=True, updateFontNames=True)

        family = "Open Sans"
        full = f"{family} {name}" if name != "Regular" else family
        ps = f"OpenSans-{name}"
        # nameID 1/2 = family/subfamily (legacy), 4 = full name, 6 = PostScript,
        # 16/17 = typographic family/subfamily. React Native on Android matches on
        # the legacy family name, so every weight must advertise the same family
        # with a distinct PostScript name.
        for record in font["name"].names:
            nid = record.nameID
            if nid == 1:
                record.string = family
            elif nid == 2:
                record.string = "Regular"
            elif nid == 4:
                record.string = full
            elif nid == 6:
                record.string = ps
            elif nid == 16:
                record.string = family
            elif nid == 17:
                record.string = name

        out = OUT_DIR / f"OpenSans-{name}.ttf"
        font.save(out)
        print(f"  {out.relative_to(ROOT)}  ({out.stat().st_size // 1024} KB, wght={weight})")

    tmp = OUT_DIR / "_OpenSans-Variable.ttf"
    if tmp.exists():
        tmp.unlink()
    print("Done.")


if __name__ == "__main__":
    main()
