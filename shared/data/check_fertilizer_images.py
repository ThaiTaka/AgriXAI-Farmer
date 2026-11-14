"""Check that every fertiliser photo in `fertilizer_recommendations.json` is still where it came from.

    python shared/data/check_fertilizer_images.py

Each product's photo was taken from the official site of the company named in
the product (`image.source_url` is the product page, `image.image_url` the
picture on it). Companies redesign bags and move pages, so this asks both again:

    page  must answer 200       -> otherwise the credit link in the app is dead
    image must answer 200 image -> otherwise the bundled copy may be an old bag

It reports what changed; it does not replace any photo. Needs a network
connection, so it is not part of the test suite; exit status is 1 when any
photo needs attention.
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
# Some of these sites refuse requests that do not look like a browser.
HEADERS = {"User-Agent": "Mozilla/5.0 (AgriLog fertiliser-photo check)"}


def quoted(url: str) -> str:
    """The URL with any Vietnamese letters in its path percent-encoded."""
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit(parts._replace(path=urllib.parse.quote(parts.path, safe="/%()")))


def fetch(url: str) -> tuple[int, str]:
    request = urllib.request.Request(quoted(url), headers=HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            return response.status, response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as error:
        return error.code, ""
    except urllib.error.URLError as error:
        return 0, str(error.reason)


def main() -> int:
    catalogue = json.loads((HERE / "fertilizer_recommendations.json").read_text(encoding="utf-8"))
    problems = 0
    for product in catalogue["products"]:
        image = product.get("image")
        if not image:
            continue
        page, _ = fetch(image["source_url"])
        status, kind = fetch(image["image_url"])
        if page != 200:
            problems += 1
            print(f"{product['name']}: trang sản phẩm trả {page} — {image['source_url']}")
        if status != 200 or not kind.startswith("image/"):
            problems += 1
            print(f"{product['name']}: ảnh gốc trả {status} {kind} — {image['image_url']}")
    gaps = [gap["product_id"] for gap in catalogue["$meta"].get("image_gaps", [])]
    print(f"Đã kiểm {sum(1 for p in catalogue['products'] if p.get('image'))} ảnh; chưa có ảnh: {', '.join(gaps) or 'không'}.")
    if problems:
        print(f"{problems} chỗ cần xem lại.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
