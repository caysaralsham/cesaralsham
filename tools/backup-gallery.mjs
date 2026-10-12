// نسخة احتياطية أسبوعية لصور وفيديوهات معرض الموقع (من Firebase Storage) — بتنحفظ بفرع منفصل «gallery-backup»
// بينزّل بس الملفات الجديدة (اللي مش موجودة بالنسخة)، وبيحفظ كمان قائمة الأعمال (العناوين والأقسام) بملف data.json
// الاستعمال: node tools/backup-gallery.mjs <مجلد فرع النسخة>
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(process.argv[2] || 'gallery-backup');
const PROJECT = 'basel-7b29b', COL = 'cesar_website';
const BUCKET = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/basel-7b29b\.(?:firebasestorage\.app|appspot\.com)\/o\/([^?]+)\?alt=media/;
const MAX = 95e6; // حد GitHub للملف الواحد 100MB

function val(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)]));
  return null;
}
async function loadDocs() {
  const key = (fs.readFileSync(path.join(ROOT, 'works.html'), 'utf8').match(/apiKey:\s*"([^"]+)"/) || [])[1];
  const docs = {}; let token = '';
  do {
    const u = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${COL}?pageSize=50${key ? '&key=' + key : ''}${token ? '&pageToken=' + token : ''}`;
    const r = await fetch(u); if (!r.ok) throw new Error('Firestore ' + r.status + ' ' + await r.text());
    const j = await r.json();
    for (const d of j.documents || []) docs[d.name.split('/').pop()] = Object.fromEntries(Object.entries(d.fields || {}).map(([k, x]) => [k, val(x)]));
    token = j.nextPageToken || '';
  } while (token);
  return docs;
}
// كل رابط ملف من مخزن فايربيز موجود بأي مكان بالبيانات (صور الأعمال، الفيديوهات، صور الإعدادات)
function collectUrls(o, out = new Map()) {
  if (typeof o === 'string') { const m = BUCKET.exec(o); if (m) { const p = decodeURIComponent(m[1]); if (!p.startsWith('backups/') && !out.has(p)) out.set(p, o); } }
  else if (Array.isArray(o)) o.forEach(x => collectUrls(x, out));
  else if (o && typeof o === 'object') Object.values(o).forEach(x => collectUrls(x, out));
  return out;
}
const safe = p => p.split('/').map(s => s.replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^\.+/, '_')).join('/');

async function get(url, tries = 3) {
  for (let t = 1; ; t++) {
    try { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
    catch (e) { if (t >= tries) throw e; await new Promise(z => setTimeout(z, 2000 * t)); }
  }
}

const docs = await loadDocs();
const urls = collectUrls(docs);
fs.mkdirSync(path.join(OUT, 'files'), { recursive: true });
let added = 0, have = 0, missing = 0, big = 0, failed = 0;
const list = [...urls], index = {};
async function worker() {
  while (list.length) {
    const [p, u] = list.shift(); const rel = path.join('files', safe(p)), dst = path.join(OUT, rel);
    if (fs.existsSync(dst)) { have++; index[p] = rel; continue; }
    try {
      const b = await get(u);
      if (!b) { missing++; console.log('مش موجود بالمخزن:', p); continue; }
      if (b.length > MAX) { big++; console.log('أكبر من 95MB، ما انحفظ:', p); continue; }
      fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, b); added++; index[p] = rel;
    } catch (e) { failed++; console.log('فشل:', p, e.message); }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const sorted = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify(sorted(docs), null, 1));
fs.writeFileSync(path.join(OUT, 'files-index.json'), JSON.stringify(sorted(index), null, 1));
fs.writeFileSync(path.join(OUT, 'README.md'),
`# نسخة احتياطية لمعرض الموقع

- \`files/\` — كل صور وفيديوهات المعرض متل ما هي بمخزن Firebase (نفس المسارات).
- \`data.json\` — بيانات الموقع من Firestore (الأعمال، العناوين، الأقسام، الإعدادات).
- \`files-index.json\` — كل ملف بالمخزن ووين انحفظ هون.

بتتحدّث تلقائياً كل أسبوع (الملفات الجديدة بس). لتنزيلها كلها: Code ← Download ZIP وانت على فرع gallery-backup.
`);
console.log(`المجموع ${urls.size} — جديد ${added}، موجود من قبل ${have}، مش موجود بالمخزن ${missing}، كبير ${big}، فشل ${failed}`);
if (failed && !added && !have) process.exit(1);
