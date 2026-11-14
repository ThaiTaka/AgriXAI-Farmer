"""How well the phone's speech model hears ledger sentences — run on a computer.

    pip install sherpa-onnx numpy miniaudio edge-tts
    node scripts/fetch-speech-model.js         # the model the app ships
    python scripts/asr_check.py                # synthesise + decode
    python scripts/asr_check.py --pause 0.7    # a breath before the price

Each phrase is spoken by two Vietnamese neural voices (edge-tts — this step
needs the internet and sends only the sample phrases below), decoded to
16 kHz mono and run through sherpa-onnx with exactly the files the app packs
(android/app/src/main/assets/asr-vi) and the same settings as
OfflineSpeechModule.kt (greedy search, 0.3 s of silence after the speech).
What the app's parser makes of the result is covered by
__tests__/voiceEntry.test.ts, with real outputs of this model in
__tests__/fixtures/zipformer_ledger.json.

The comparison with the Vosk model this replaced (ADR 0014) was made with
scripts/asr_compare.py. Synthetic voices are cleaner than a farmer in a
greenhouse; treat the result as a lower bound on the errors, and add a real
recording when one is available (a 16 kHz mono WAV named in SAMPLES).
"""

import argparse
import asyncio
import re
import sys
import unicodedata
import wave
from pathlib import Path

import miniaudio
import numpy as np
import sherpa_onnx

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "android" / "app" / "src" / "main" / "assets" / "asr-vi"
CACHE = ROOT / "scripts" / ".asr-samples"

PHRASES = [
    "Bán năm mươi bó hoa cúc được một triệu rưỡi",
    "Mua hai bao urê Cà Mau một triệu ba trăm sáu mươi nghìn",
    "Bón hai mươi ký kali cho lô hoa hồng",
    "Trả tiền công ba người sáu trăm nghìn",
    "Hôm qua đóng tiền điện hai trăm tư nghìn",
    "Bán hai trăm cành hồng mỗi cành ba nghìn",
    "Bón mười lăm ký supe lân lô số một",
    "Mua cây giống hoa cúc hai triệu",
    "Thuê ba người làm cỏ sáu trăm nghìn",
    "Hôm nay bán ba tạ cà chua giá mười hai nghìn một ký",
]
VOICES = ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"]
# Real recordings: (16 kHz mono WAV under scripts/.asr-samples, what was said).
SAMPLES: list[tuple[str, str]] = []


def words(text: str) -> list[str]:
    return re.sub(r"[^\w\s]", " ", unicodedata.normalize("NFC", text).lower()).split()


def errors(ref: list[str], hyp: list[str]) -> int:
    d = list(range(len(hyp) + 1))
    for i in range(1, len(ref) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(hyp) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (ref[i - 1] != hyp[j - 1]))
            prev = cur
    return d[len(hyp)]


async def synthesise(text: str, voice: str, path: Path) -> None:
    if path.exists():
        return
    import edge_tts  # only needed when the cache is empty

    await edge_tts.Communicate(text, voice).save(str(path))


def load(path: Path) -> np.ndarray:
    if path.suffix == ".wav":
        with wave.open(str(path)) as w:
            assert w.getframerate() == 16000 and w.getnchannels() == 1, f"{path.name}: needs 16 kHz mono"
            return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
    audio = miniaudio.decode_file(str(path), output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1, sample_rate=16000)
    return np.asarray(audio.samples, dtype=np.float32)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pause", type=float, default=0.0, help="seconds of silence inserted before the last two words")
    args = parser.parse_args()
    if not (MODEL / "encoder.onnx").exists():
        sys.exit("android/app/src/main/assets/asr-vi is missing — run `node scripts/fetch-speech-model.js` first")
    CACHE.mkdir(exist_ok=True)
    recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=str(MODEL / "encoder.onnx"),
        decoder=str(MODEL / "decoder.onnx"),
        joiner=str(MODEL / "joiner.onnx"),
        tokens=str(MODEL / "tokens.txt"),
        num_threads=2,
        decoding_method="greedy_search",
    )

    def heard(audio: np.ndarray) -> str:
        stream = recognizer.create_stream()
        stream.accept_waveform(16000, np.concatenate([audio, np.zeros(4800, np.float32)]))
        recognizer.decode_stream(stream)
        return stream.result.text

    items = []
    for v, voice in enumerate(VOICES):
        for p, phrase in enumerate(PHRASES):
            if args.pause:
                head, tail = phrase.rsplit(" ", 2)[0], " ".join(phrase.split()[-2:])
                parts = []
                for k, text in enumerate((head, tail)):
                    path = CACHE / f"z{p}_{v}_{k}.mp3"
                    asyncio.run(synthesise(text, voice, path))
                    parts.append(load(path))
                audio = np.concatenate([parts[0], np.zeros(int(16000 * args.pause), np.float32), parts[1]])
            else:
                path = CACHE / f"z{p}_{v}.mp3"
                asyncio.run(synthesise(phrase, voice, path))
                audio = load(path)
            items.append((phrase, audio))
    items += [(said, load(CACHE / name)) for name, said in SAMPLES]

    exact = wrong = total = 0
    for phrase, audio in items:
        text = heard(audio)
        e = errors(words(phrase), words(text))
        exact += e == 0
        wrong += e
        total += len(words(phrase))
        print(f"{'✓' if e == 0 else '·'} {phrase}\n    → {text.lower()}")
    print(f"{exact}/{len(items)} heard word for word; {100 * wrong / total:.1f}% of the words wrong")


main()
