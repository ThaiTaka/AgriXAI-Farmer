"""The study behind ADR 0014: which offline recogniser hears a farmer best.

    pip install vosk sherpa-onnx piper-tts soundfile numpy edge-tts miniaudio
    python scripts/asr_compare.py                       # every engine below
    python scripts/asr_compare.py zf-70k --fixture      # + __tests__/fixtures/zipformer_ledger.json

Inputs go in scripts/.asr-compare/ (not in git, ~600 MB):
  models/sherpa-onnx-zipformer-vi-int8-2025-04-20/   github.com/k2-fsa/sherpa-onnx/releases (asr-models)
  models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09/
  piper/vi_VN-{vais1000-medium,25hours_single-low,vivos-x_low}.onnx(.json)   huggingface.co/rhasspy/piper-voices
  fleurs/dev.tsv, fleurs/dev.tar.gz                   huggingface.co/datasets/google/fleurs (data/vi_vn)
  vosk-model-small-vn-0.4/                            alphacephei.com/vosk/models (the model the app used before)
and the grammar the app gave it, scripts/vosk_vocabulary.json. edge-tts
sends the 24 sentences below to Microsoft's speech service to be read aloud.

Sets
  domain-clean : 24 ledger sentences x 10 voices (edge-tts x2, piper vais1000,
                 25hours, vivos x6 speakers)
  domain-noisy : same audio + market babble (3 FLEURS clips) at 10 dB SNR + light reverb
  fleurs       : FLEURS vi_vn dev, real human read speech (sentences w/o digits)

Engines
  vosk-small-grammar : what the app shipped before ADR 0014 (vosk-model-small-vn-0.4 + vosk_vocabulary.json)
  vosk-small-open    : same model, open vocabulary
  zf-30m             : sherpa-onnx zipformer vi 30M int8 (hynt, 6000 h, CC BY-NC-ND)
  zf-70k             : sherpa-onnx zipformer vi int8 2025-04-20 (zzasdf, 70k h, Apache-2.0)
"""

import asyncio
import json
import random
import re
import sys
import tarfile
import time
import unicodedata
import wave
from pathlib import Path

import miniaudio
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
REPO_MOBILE = Path(__file__).resolve().parents[1]
HERE = REPO_MOBILE / "scripts" / ".asr-compare"
CACHE = HERE / "audio"

DOMAIN = [
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
    "Mua một chai thuốc trừ sâu một trăm hai mươi lăm nghìn",
    "Xuất kho mười ký phân đạm cho lô số hai",
    "Đổ xăng máy bơm năm mươi nghìn",
    "Bán tám mươi bó cẩm chướng được hai triệu tư",
    "Mua hai mươi bao phân gà mỗi bao bốn mươi lăm nghìn",
    "Trả tiền nước tưới tháng này một trăm tám mươi nghìn",
    "Hôm kia mua ba cuộn màng phủ một triệu hai",
    "Thu được bốn triệu năm trăm nghìn tiền bán hoa hồng",
    "Bón ba bao phân trùn quế cho vườn dâu tây",
    "Chi hai trăm nghìn tiền chở hoa ra chợ Đà Lạt",
    "Rải năm mươi ký vôi cho ruộng bắp cải",
    "Bán một tấn khoai tây được mười tám triệu",
    "Mua bốn bao kali Phú Mỹ hai triệu không trăm tám mươi nghìn",
    "Trả công cắt hoa hai người bốn trăm nghìn",
]

EDGE_VOICES = ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"]
PIPER_SINGLE = ["vi_VN-vais1000-medium", "vi_VN-25hours_single-low"]
VIVOS_SPEAKERS = [0, 9, 22, 30, 40, 55]


def norm(text: str) -> list[str]:
    t = unicodedata.normalize("NFC", text).lower()
    t = re.sub(r"[^\w\s]", " ", t)
    t = re.sub(r"\bu rê\b", "urê", t)
    t = re.sub(r"\bka li\b", "kali", t)
    t = re.sub(r"\b(super|xúp pe|súp pe|su pe)\b", "supe", t)
    t = re.sub(r"\bký\b|\bkí\b", "ký", t)
    t = re.sub(r"\bngàn\b", "nghìn", t)
    return t.split()


def wer(ref: list[str], hyp: list[str]) -> tuple[int, int]:
    d = list(range(len(hyp) + 1))
    for i in range(1, len(ref) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(hyp) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (ref[i - 1] != hyp[j - 1]))
            prev = cur
    return d[len(hyp)], len(ref)


def load16k(path: Path) -> np.ndarray:
    a = miniaudio.decode_file(str(path), output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1, sample_rate=16000)
    return np.asarray(a.samples, dtype=np.float32)


async def edge(text: str, voice: str, path: Path) -> None:
    if path.exists():
        return
    import edge_tts

    await edge_tts.Communicate(text, voice).save(str(path))


def piper_synth(voice, text: str, path: Path, speaker: int | None) -> None:
    if path.exists():
        return
    from piper import SynthesisConfig

    with wave.open(str(path), "wb") as w:
        voice.synthesize_wav(text, w, syn_config=SynthesisConfig(speaker_id=speaker))


def build_domain() -> list[tuple[str, str, Path]]:
    CACHE.mkdir(parents=True, exist_ok=True)
    items = []
    for v, voice in enumerate(EDGE_VOICES):
        for p, phrase in enumerate(DOMAIN):
            path = CACHE / f"edge{v}_p{p}.mp3"
            asyncio.run(edge(phrase, voice, path))
            items.append((f"edge{v}", phrase, path))
    from piper import PiperVoice

    for name in PIPER_SINGLE:
        voice = PiperVoice.load(str(HERE / "piper" / f"{name}.onnx"))
        for p, phrase in enumerate(DOMAIN):
            path = CACHE / f"{name}_p{p}.wav"
            piper_synth(voice, phrase, path, None)
            items.append((name, phrase, path))
    voice = PiperVoice.load(str(HERE / "piper" / "vi_VN-vivos-x_low.onnx"))
    for s in VIVOS_SPEAKERS:
        for p, phrase in enumerate(DOMAIN):
            path = CACHE / f"vivos{s}_p{p}.wav"
            piper_synth(voice, phrase, path, s)
            items.append((f"vivos{s}", phrase, path))
    return items


def build_fleurs(limit: int = 150) -> list[tuple[str, str, np.ndarray]]:
    out_dir = HERE / "fleurs" / "dev"
    if not out_dir.exists():
        with tarfile.open(HERE / "fleurs" / "dev.tar.gz") as tar:
            tar.extractall(HERE / "fleurs", filter="data")
    rows = []
    seen = set()
    for line in (HERE / "fleurs" / "dev.tsv").read_text(encoding="utf-8").splitlines():
        cols = line.split("\t")
        fname, raw = cols[1], cols[2]
        if re.search(r"\d", raw) or cols[0] in seen:
            continue
        seen.add(cols[0])
        rows.append(("fleurs", raw, load16k(out_dir / fname)))
        if len(rows) >= limit:
            break
    return rows


def add_noise(clean: np.ndarray, babble_pool: list[np.ndarray], rng: random.Random) -> np.ndarray:
    n = len(clean)
    babble = np.zeros(n, dtype=np.float32)
    for _ in range(3):
        src = babble_pool[rng.randrange(len(babble_pool))]
        if len(src) < n:
            src = np.tile(src, n // len(src) + 1)
        off = rng.randrange(max(1, len(src) - n))
        babble += src[off : off + n]
    p_s = np.mean(clean**2) + 1e-9
    p_n = np.mean(babble**2) + 1e-9
    babble *= np.sqrt(p_s / (p_n * 10 ** (10 / 10)))
    # light room reverb
    ir_len = int(0.25 * 16000)
    t = np.arange(ir_len) / 16000
    ir = np.random.default_rng(rng.randrange(1 << 30)).standard_normal(ir_len).astype(np.float32) * np.exp(-t / 0.05)
    ir[0] = 1.0
    ir /= np.sqrt(np.sum(ir**2))
    wet = np.convolve(clean, ir)[:n].astype(np.float32)
    mix = 0.7 * clean + 0.3 * wet + babble
    return (mix / max(1.0, np.max(np.abs(mix)) / 0.95)).astype(np.float32)


class Vosk:
    def __init__(self, grammar: bool):
        import vosk

        vosk.SetLogLevel(-1)
        self.model = vosk.Model(str(HERE / "vosk-model-small-vn-0.4"))
        self.grammar = None
        if grammar:
            vocab = json.loads((REPO_MOBILE / "scripts" / "vosk_vocabulary.json").read_text(encoding="utf-8"))
            self.grammar = json.dumps(vocab["words"] + vocab["phrases"] + ["[unk]"], ensure_ascii=False)

    def __call__(self, audio: np.ndarray) -> str:
        import vosk

        rec = vosk.KaldiRecognizer(self.model, 16000, self.grammar) if self.grammar else vosk.KaldiRecognizer(self.model, 16000)
        pcm = (np.clip(np.concatenate([audio, np.zeros(9600, np.float32)]), -1, 1) * 32767).astype("<i2").tobytes()
        texts = []
        for i in range(0, len(pcm), 8000):
            if rec.AcceptWaveform(pcm[i : i + 8000]):
                texts.append(json.loads(rec.Result())["text"])
        texts.append(json.loads(rec.FinalResult())["text"])
        return " ".join(t for t in texts if t).replace("[unk]", "").strip()


class Zipformer:
    def __init__(self, folder: str, enc: str, dec: str, join: str, method: str = "greedy_search", hotwords: str = ""):
        import sherpa_onnx

        d = HERE / "models" / folder
        kw = {}
        if hotwords:
            kw = dict(hotwords_file=hotwords, hotwords_score=1.5, modeling_unit="bpe", bpe_vocab=str(d / "bpe.vocab"))
        self.rec = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=str(d / enc),
            decoder=str(d / dec),
            joiner=str(d / join),
            tokens=str(d / "tokens.txt"),
            num_threads=4,
            decoding_method=method,
            **kw,
        )

    def __call__(self, audio: np.ndarray) -> str:
        s = self.rec.create_stream()
        s.accept_waveform(16000, np.concatenate([np.zeros(1600, np.float32), audio, np.zeros(4800, np.float32)]))
        self.rec.decode_stream(s)
        return s.result.text


def main() -> None:
    which = [a for a in sys.argv[1:] if not a.startswith("--")] or ["vosk-small-grammar", "vosk-small-open", "zf-30m", "zf-70k"]
    domain = build_domain()
    fleurs = build_fleurs()
    rng = random.Random(7)
    pool = [a for _, _, a in fleurs]
    domain_clean = [(spk, ref, load16k(path)) for spk, ref, path in domain]
    domain_noisy = [(spk, ref, add_noise(a, pool, rng)) for spk, ref, a in domain_clean]
    sets = {"domain-clean": domain_clean, "domain-noisy": domain_noisy, "fleurs": fleurs}
    engines = {
        "vosk-small-grammar": lambda: Vosk(True),
        "vosk-small-open": lambda: Vosk(False),
        "zf-30m": lambda: Zipformer("sherpa-onnx-zipformer-vi-30M-int8-2026-02-09", "encoder.int8.onnx", "decoder.onnx", "joiner.int8.onnx"),
        "zf-70k": lambda: Zipformer(
            "sherpa-onnx-zipformer-vi-int8-2025-04-20",
            "encoder-epoch-12-avg-8.int8.onnx",
            "decoder-epoch-12-avg-8.onnx",
            "joiner-epoch-12-avg-8.int8.onnx",
        ),
        "zf-70k-beam": lambda: Zipformer(
            "sherpa-onnx-zipformer-vi-int8-2025-04-20",
            "encoder-epoch-12-avg-8.int8.onnx",
            "decoder-epoch-12-avg-8.onnx",
            "joiner-epoch-12-avg-8.int8.onnx",
            method="modified_beam_search",
        ),
    }
    results = {}
    for name in which:
        eng = engines[name]()
        results[name] = {}
        for set_name, items in sets.items():
            if name == "vosk-small-grammar" and set_name == "fleurs":
                continue
            errs = words = exact = 0
            t0 = time.time()
            audio_s = 0.0
            hyps = []
            for spk, ref, audio in items:
                hyp = eng(audio)
                audio_s += len(audio) / 16000
                e, n = wer(norm(ref), norm(hyp))
                errs += e
                words += n
                exact += e == 0
                hyps.append({"spk": spk, "ref": ref, "hyp": hyp, "err": e})
            dt = time.time() - t0
            results[name][set_name] = {"wer": errs / words, "exact": exact, "n": len(items), "rtf": dt / audio_s, "hyps": hyps}
            print(f"{name:20s} {set_name:13s} WER {100 * errs / words:5.1f}%  exact {exact:3d}/{len(items)}  RTF {dt / audio_s:.3f}", flush=True)
    out = HERE / "asr_results.json"
    old = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}
    old.update(results)
    out.write_text(json.dumps(old, ensure_ascii=False, indent=1), encoding="utf-8")
    if "--fixture" in sys.argv and "zf-70k" in results:
        write_fixture(results["zf-70k"])


NATURAL = {"edge0": "edge-tts vi-VN-HoaiMyNeural", "edge1": "edge-tts vi-VN-NamMinhNeural", "vi_VN-vais1000-medium": "piper vi_VN-vais1000-medium"}


def write_fixture(zf: dict) -> None:
    """What the shipped model heard, for the parser tests (natural voices only:
    the two low-quality Piper voices are hard to understand for any engine)."""
    pairs = [
        {"said": h["ref"], "heard": h["hyp"], "voice": NATURAL[h["spk"]], "audio": cond}
        for cond, key in (("clean", "domain-clean"), ("noisy", "domain-noisy"))
        for h in zf[key]["hyps"]
        if h["spk"] in NATURAL
    ]
    out = {
        "$comment": "Câu sổ ruộng do giọng tổng hợp đọc (edge-tts, Piper vais1000), và đúng chữ mô hình Zipformer tiếng Việt (sherpa-onnx-zipformer-vi-int8-2025-04-20, giải mã greedy) nghe ra — audio sạch, và audio trộn tiếng chợ 10 dB + vang. Sinh bằng scripts/asr_compare.py ngày 2026-10-07 (ADR 0014). Dùng để kiểm bộ đọc câu với chữ thật của mô hình, không phải câu gõ tay.",
        "pairs": pairs,
    }
    path = REPO_MOBILE / "__tests__" / "fixtures" / "zipformer_ledger.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
