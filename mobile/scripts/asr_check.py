"""How well the offline model hears ledger sentences — run on a computer.

    pip install vosk miniaudio edge-tts
    python scripts/asr_check.py                  # synthesise + decode
    python scripts/asr_check.py --no-grammar     # same, open vocabulary

Each phrase is spoken by two Vietnamese neural voices (edge-tts — this step
needs the internet and sends only the sample phrases below), decoded to
16 kHz mono with 0.6 s of trailing silence (a farmer pausing), and run
through Vosk with the model the app ships (assets/model-vn) and the app's
grammar (src/voice/vocabulary.json). It prints what was heard and what the
app's parser would make of it is covered by __tests__/voiceEntry.test.ts.

Synthetic voices are cleaner than a farmer in a greenhouse; treat the result
as a lower bound on the errors, and add a real recording here when one is
available (put a 16 kHz mono WAV next to the phrase and name it in SAMPLES).
"""

import asyncio
import json
import sys
from pathlib import Path

import miniaudio
import vosk

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "assets" / "model-vn"
CACHE = ROOT / "scripts" / ".asr-samples"

PHRASES = [
    "Bán năm mươi bó hoa cúc được một triệu rưỡi",
    "Mua hai bao urê Cà Mau một triệu ba trăm sáu mươi nghìn",
    "Bón hai mươi ký kali cho lô hoa hồng",
    "Trả tiền công ba người sáu trăm nghìn",
    "Hôm qua đóng tiền điện hai trăm tư nghìn",
    "Bán hai trăm cành hồng mỗi cành ba nghìn",
    "Bón mười lăm ký super lân lô số một",
    "Mua cây giống hoa cúc hai triệu",
]
VOICES = ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"]


async def synthesise(text: str, voice: str, path: Path) -> None:
    if path.exists():
        return
    import edge_tts  # only needed when the cache is empty

    await edge_tts.Communicate(text, voice).save(str(path))


def decode(model: vosk.Model, mp3: Path, grammar: str | None) -> str:
    audio = miniaudio.decode_file(str(mp3), output_format=miniaudio.SampleFormat.SIGNED16, nchannels=1, sample_rate=16000)
    pcm = audio.samples.tobytes() + b"\x00\x00" * 9600
    rec = vosk.KaldiRecognizer(model, 16000, grammar) if grammar else vosk.KaldiRecognizer(model, 16000)
    for i in range(0, len(pcm), 8000):
        rec.AcceptWaveform(pcm[i : i + 8000])
    return json.loads(rec.FinalResult())["text"]


async def main() -> None:
    if not MODEL.exists():
        sys.exit("assets/model-vn is missing — run `node scripts/fetch-vosk-model.js` first")
    CACHE.mkdir(exist_ok=True)
    vocab = json.loads((ROOT / "src" / "voice" / "vocabulary.json").read_text(encoding="utf-8"))
    grammar = None if "--no-grammar" in sys.argv else json.dumps(vocab["words"] + vocab["phrases"] + ["[unk]"], ensure_ascii=False)
    vosk.SetLogLevel(-1)
    model = vosk.Model(str(MODEL))
    exact = total = 0
    for v, voice in enumerate(VOICES):
        for p, phrase in enumerate(PHRASES):
            mp3 = CACHE / f"p{p}_{v}.mp3"
            await synthesise(phrase, voice, mp3)
            heard = decode(model, mp3, grammar)
            total += 1
            exact += heard == phrase.lower()
            print(f"{'✓' if heard == phrase.lower() else '·'} {phrase}\n    → {heard}")
    print(f"{exact}/{total} heard word for word ({'domain grammar' if grammar else 'open vocabulary'})")


asyncio.run(main())
