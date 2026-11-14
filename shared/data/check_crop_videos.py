"""Check that every "video cách trồng" in `crop_varieties.json` still plays.

    python shared/data/check_crop_videos.py

YouTube videos can be taken down, made private or have embedding turned off by
their uploader at any time — the catalogue cannot know. This asks YouTube's
public oEmbed endpoint about each video, the same check used when the videos
were chosen:

    200  the video exists and may be played inside the app
    401  the uploader turned embedding off  -> the app can only open YouTube
    404  removed or private                 -> pick another video

It also reports a title or channel name that no longer matches the catalogue
(an uploader renamed it), since the app shows both as the video's credit.
Needs a network connection, so it is not part of the test suite; exit status
is 1 when any video needs attention.
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
OEMBED = "https://www.youtube.com/oembed?format=json&url="


def videos(catalogue: dict):
    """(where, video) for the crop-level videos and the category overrides."""
    for crop in catalogue["crop_types"]:
        if crop.get("video"):
            yield crop["name"], crop["video"]
        for category in crop["categories"]:
            if category.get("video"):
                yield f"{crop['name']} › {category['category_name']}", category["video"]


def oembed(youtube_id: str) -> tuple[int, dict | None]:
    url = OEMBED + urllib.parse.quote(f"https://www.youtube.com/watch?v={youtube_id}", safe="")
    request = urllib.request.Request(url, headers={"User-Agent": "AgriLog crop-video check"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, None


def squash(value: str) -> str:
    return " ".join(value.split())


def main() -> int:
    catalogue = json.loads((HERE / "crop_varieties.json").read_text(encoding="utf-8"))
    problems = 0
    for where, video in videos(catalogue):
        status, info = oembed(video["youtube_id"])
        if status != 200 or info is None:
            reason = {401: "chủ kênh đã tắt phát nhúng", 404: "video đã bị gỡ hoặc để riêng tư"}.get(status, f"HTTP {status}")
            print(f"LỖI   {where}: {video['youtube_id']} — {reason}")
            problems += 1
            continue
        drift = []
        if squash(info.get("title", "")) != video["title"]:
            drift.append(f"tiêu đề nay là “{squash(info.get('title', ''))}”")
        if squash(info.get("author_name", "")) != video["channel"]:
            drift.append(f"tên kênh nay là “{squash(info.get('author_name', ''))}”")
        if drift:
            print(f"ĐỔI   {where}: {video['youtube_id']} — " + "; ".join(drift))
            problems += 1
        else:
            print(f"OK    {where}: {video['youtube_id']}")
    print(f"\n{problems} video cần xem lại." if problems else "\nMọi video đều còn xem được trong ứng dụng.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
