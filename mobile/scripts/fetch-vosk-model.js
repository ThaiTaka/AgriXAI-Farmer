#!/usr/bin/env node
/* eslint-env node */
/**
 * Downloads the offline Vietnamese speech model into mobile/assets/model-vn.
 *
 *     node scripts/fetch-vosk-model.js          # runs on `npm install` (postinstall)
 *
 * Model: vosk-model-small-vn-0.4 — 32 MB, Apache-2.0, WER 15.70 on the VIVOS
 * test set (https://alphacephei.com/vosk/models). react-native-vosk copies any
 * `model-*` folder under mobile/assets into the APK, so the app recognises
 * speech with no network at all once installed.
 *
 * The model is not committed to git (32 MB of binaries); this script is the
 * one place that fetches it. It does nothing when the model is already there,
 * and it never fails the install — without the model the app still runs and
 * the voice button says the model is missing.
 *
 * No dependencies: the zip is read with Node's own zlib.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const zlib = require('zlib');

const MODEL_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-vn-0.4.zip';
const ZIP_ROOT = 'vosk-model-small-vn-0.4/';
const TARGET = path.join(__dirname, '..', 'assets', 'model-vn');
// A file every Vosk model has; its presence means a previous run completed.
const MARKER = path.join(TARGET, 'am', 'final.mdl');

function download(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, {headers: {'User-Agent': 'agrilog-setup'}}, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          resolve(download(new URL(res.headers.location, url).toString(), redirects - 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

/** Minimal zip reader: central directory → stored or deflated entries. */
function* zipEntries(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('not a zip file');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('bad central directory');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressedSize);
    if (name.endsWith('/')) continue;
    if (method === 0) yield {name, data: raw};
    else if (method === 8) yield {name, data: zlib.inflateRawSync(raw)};
    else throw new Error(`unsupported zip method ${method} for ${name}`);
  }
}

async function main() {
  if (fs.existsSync(MARKER)) {
    console.log('[vosk] model-vn already present');
    return;
  }
  console.log(`[vosk] downloading ${MODEL_URL} (32 MB)…`);
  const zip = await download(MODEL_URL);
  const staging = `${TARGET}.partial`;
  fs.rmSync(staging, {recursive: true, force: true});
  let files = 0;
  for (const {name, data} of zipEntries(zip)) {
    if (!name.startsWith(ZIP_ROOT)) continue;
    const relative = name.slice(ZIP_ROOT.length);
    if (!relative || relative.includes('..')) continue;
    const out = path.join(staging, relative);
    fs.mkdirSync(path.dirname(out), {recursive: true});
    fs.writeFileSync(out, data);
    files += 1;
  }
  fs.rmSync(TARGET, {recursive: true, force: true});
  try {
    fs.renameSync(staging, TARGET);
  } catch {
    // Windows refuses to rename a folder a file watcher (Metro, an antivirus)
    // has just opened; copying then deleting works where renaming does not.
    fs.cpSync(staging, TARGET, {recursive: true});
    fs.rmSync(staging, {recursive: true, force: true});
  }
  console.log(`[vosk] model-vn ready (${files} files)`);
}

main().catch(error => {
  // Never fail `npm install` over the model: the app runs without it and says so.
  console.warn(`[vosk] could not fetch the speech model: ${error.message}`);
  console.warn('[vosk] run `node scripts/fetch-vosk-model.js` again when online.');
});
