const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const SRC = 'd:/AgriXAI Farmer/AgriXAI Farmer v4 - Standalone (1).html';
const OUT = process.argv[2];
const html = fs.readFileSync(SRC, 'utf8');
function block(type) {
  const open = '<script type="__bundler/' + type + '">';
  const i = html.indexOf(open);
  if (i < 0) return null;
  const j = html.indexOf('</script>', i + open.length);
  return html.slice(i + open.length, j).trim();
}
const manifest = JSON.parse(block('manifest'));
const template = JSON.parse(block('template'));
fs.writeFileSync(path.join(OUT, '_template.html'), template);
const report = [];
for (const [uuid, entry] of Object.entries(manifest)) {
  let bytes = Buffer.from(entry.data, 'base64');
  if (entry.compressed) { try { bytes = zlib.gunzipSync(bytes); } catch(e) { report.push(uuid+' gunzip FAIL '+e.message); } }
  const mime = entry.mime || 'application/octet-stream';
  let ext = 'bin';
  if (/javascript/.test(mime)) ext='js';
  else if (/css/.test(mime)) ext='css';
  else if (/html/.test(mime)) ext='html';
  else if (/json/.test(mime)) ext='json';
  else if (/webp/.test(mime)) ext='webp';
  else if (/png/.test(mime)) ext='png';
  else if (/woff2/.test(mime)) ext='woff2';
  else if (/svg/.test(mime)) ext='svg';
  report.push(`${uuid}  ${mime}  compressed=${entry.compressed}  bytes=${bytes.length}  -> ${ext}`);
  if (['js','css','html','json','svg'].includes(ext)) fs.writeFileSync(path.join(OUT, uuid + '.' + ext), bytes);
}
fs.writeFileSync(path.join(OUT, '_report.txt'), report.join('\n'));
console.log(report.join('\n'));
