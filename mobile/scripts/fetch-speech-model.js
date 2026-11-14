#!/usr/bin/env node
/* eslint-env node */
/**
 * Downloads the offline Vietnamese speech recogniser into the Android build.
 *
 *     node scripts/fetch-speech-model.js        # runs on `npm install` (postinstall)
 *
 *   android/app/src/main/assets/asr-vi/   the model, packed into the APK
 *     encoder.onnx, decoder.onnx, joiner.onnx, tokens.txt
 *         sherpa-onnx Zipformer transducer for Vietnamese, int8, 2025-04-20 —
 *         trained on ~70.000 h of Vietnamese (huggingface.co/zzasdf/
 *         viet_iter3_pseudo_label), Apache-2.0. ~75 MB.
 *     silero_vad.onnx
 *         Silero voice-activity detector (MIT), tells speech from silence.
 *   android/app/libs/sherpa-onnx-static-link-onnxruntime-<v>.aar
 *         sherpa-onnx for Android (Apache-2.0): the recogniser's native code
 *         and its Kotlin API, onnxruntime linked in.
 *
 * None of these are committed to git (binaries, 115 MB in all); this script is
 * the one place that fetches them, and it checks every file against the
 * SHA-256 pinned below, so a changed or corrupted download is refused rather
 * than shipped. It does nothing for files already in place. It never fails
 * `npm install`: without the model the app still runs and the voice screen says
 * the model is missing; without the .aar the Android build stops and says to
 * run this script.
 *
 * Measured against the Vosk model it replaces in ADR 0014 (scripts/asr_check.py).
 */

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODEL_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'asr-vi');
const LIBS_DIR = path.join(ROOT, 'android', 'app', 'libs');

const SHERPA_VERSION = '1.13.8';
const MODEL_URL = 'https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-vi-int8-2025-04-20/resolve/main';

const FILES = [
  {
    target: path.join(MODEL_DIR, 'encoder.onnx'),
    url: `${MODEL_URL}/encoder-epoch-12-avg-8.int8.onnx`,
    sha256: 'b3abdef7a660fea7faf5e076b3c7613b0fc98406707103784d018189bb522124',
  },
  {
    target: path.join(MODEL_DIR, 'decoder.onnx'),
    url: `${MODEL_URL}/decoder-epoch-12-avg-8.onnx`,
    sha256: 'd1d27cca84c824a8acf5ce6edf0f2c0880cfe295d2e69b95134de1707e1d9998',
  },
  {
    target: path.join(MODEL_DIR, 'joiner.onnx'),
    url: `${MODEL_URL}/joiner-epoch-12-avg-8.int8.onnx`,
    sha256: '38ec49e1c18e4feb0cad4de13e25c83a866cf56f4a66f22e8ff579d591a69a46',
  },
  {
    target: path.join(MODEL_DIR, 'tokens.txt'),
    url: `${MODEL_URL}/tokens.txt`,
    sha256: 'f536d03c2e95ebd2930cf0abec88e823bd17d3c1933da7ae6a82db3b80605e15',
  },
  {
    target: path.join(MODEL_DIR, 'silero_vad.onnx'),
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx',
    sha256: '9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6',
  },
  {
    target: path.join(LIBS_DIR, `sherpa-onnx-static-link-onnxruntime-${SHERPA_VERSION}.aar`),
    url: `https://github.com/k2-fsa/sherpa-onnx/releases/download/v${SHERPA_VERSION}/sherpa-onnx-static-link-onnxruntime-${SHERPA_VERSION}.aar`,
    sha256: 'b22c3fc1b6a45666d28892bb2f7694beeb77a8362d7ebd77c1a5431ec9435471',
  },
];

function sha256Of(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

/** Streams `url` into `file`, following redirects (Hugging Face and GitHub both redirect to a CDN). */
function download(url, file, redirects = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, {headers: {'User-Agent': 'agrilog-setup'}}, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          resolve(download(new URL(res.headers.location, url).toString(), file, redirects - 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const out = fs.createWriteStream(file);
        res.pipe(out);
        out.on('finish', () => out.close(resolve));
        out.on('error', reject);
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function fetchOne({target, url, sha256}) {
  const name = path.relative(ROOT, target);
  if (fs.existsSync(target) && (await sha256Of(target)) === sha256) return false;
  fs.mkdirSync(path.dirname(target), {recursive: true});
  const partial = `${target}.partial`;
  console.log(`[speech] downloading ${name}…`);
  await download(url, partial);
  const got = await sha256Of(partial);
  if (got !== sha256) {
    fs.rmSync(partial, {force: true});
    throw new Error(`${name}: SHA-256 ${got} is not the pinned ${sha256} — refusing the file`);
  }
  fs.renameSync(partial, target);
  return true;
}

async function main() {
  let fetched = 0;
  for (const file of FILES) {
    if (await fetchOne(file)) fetched += 1;
  }
  console.log(fetched ? `[speech] ${fetched} file(s) downloaded and verified` : '[speech] speech model already present');
}

main().catch(error => {
  // Never fail `npm install` over the model: the app runs without it and says so.
  console.warn(`[speech] could not fetch the speech model: ${error.message}`);
  console.warn('[speech] run `node scripts/fetch-speech-model.js` again when online.');
});
