// يبني مكتبة موديلات المرسم (studio-q7m4/models.json) من أعمال الموقع.
// قراءة فقط: لا يعدّل الصور ولا قاعدة البيانات. كل موديل يحمل رابط صورته الأصلية كما هو.
// الاستعمال:
//   node tools/build-models.mjs                    ← يقرأ أعمال الموقع من Firestore مباشرة
//   node tools/build-models.mjs --from data.json   ← من ملف نسخة المعرض الاحتياطية (فرع gallery-backup)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'studio-q7m4', 'models.json');

// قسم الموقع ← قسم مكتبة المرسم
const SECTIONS = [
  [/أعمدة|درابزين|Colonnes/i, 'columns', 'الأعمدة والدرابزين'],
  [/شمينه|Chemin/i, 'fireplaces', 'الشمائن'],
  [/واجهات|Façades/i, 'facades', 'الواجهات'],
  [/نوافير|Fontaines/i, 'fountains', 'النوافير'],
  [/سبالات|شلالات|Sabils|Cascades/i, 'sabils', 'السبالات والشلالات'],
  [/Lavabo|مغاسل/i, 'lavabos', 'المغاسل'],
  [/جرون|bassin/i, 'basins', 'الجرون'],
  [/حوائط|منحوت|sculpt/i, 'carvings', 'الزخارف والنقوش'],
  [/تابلوهات|Tableaux/i, 'tablos', 'التابلوهات'],
  [/نوافذ|Fenêtres/i, 'windows', 'النوافذ والمداخل'],
  [/مساجد|mosqu/i, 'arches', 'الأقواس والمحاريب'],
  [/طاولات|Tables/i, 'tables', 'الطاولات'],
  [/حمامات|Salles de bains/i, 'baths', 'الحمامات'],
];

// القوالب الهندسية الجاهزة (تزيد مرحلة بمرحلة)
function templateFor(it) {
  const t = `${it.title || ''} ${it.aiAltAr || ''}`;
  if (/درابزين/.test(t) && /مخر[وّ]?ط|مخرّط|برامق/.test(t)) return 'balustrade';
  return null;
}

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

async function loadLive() {
  const key = (fs.readFileSync(path.join(ROOT, 'works.html'), 'utf8').match(/apiKey:\s*"([^"]+)"/) || [])[1];
  const docs = {};
  let token = '';
  do {
    const u = `https://firestore.googleapis.com/v1/projects/basel-7b29b/databases/(default)/documents/cesar_website?pageSize=50&key=${key}${token ? '&pageToken=' + token : ''}`;
    const r = await fetch(u);
    if (!r.ok) throw new Error('Firestore ' + r.status);
    const j = await r.json();
    for (const d of j.documents || []) docs[d.name.split('/').pop()] = Object.fromEntries(Object.entries(d.fields || {}).map(([k, x]) => [k, val(x)]));
    token = j.nextPageToken || '';
  } while (token);
  return docs;
}

const fromIdx = process.argv.indexOf('--from');
const docs = fromIdx > 0 ? JSON.parse(fs.readFileSync(process.argv[fromIdx + 1], 'utf8')) : await loadLive();

let items = [];
for (const [id, d] of Object.entries(docs)) if (id.startsWith('items_')) items = items.concat(d.items || []);
items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

const models = [];
for (const it of items) {
  if (!it.img || !it.id) continue;
  const cat = String(it.category || '');
  const sec = SECTIONS.find(([rx]) => rx.test(cat));
  models.push({
    id: it.id,
    title: String(it.title || '').split('|')[0].trim(),
    siteCategory: cat,
    section: sec ? sec[1] : 'other',
    img: it.img,                 // الصورة الأصلية كما هي، بدون نسخ أو تعديل
    color: it.aiColorAr || it.color || '',
    stone: it.aiStoneAr || '',
    template: templateFor(it),   // null = بانتظار قالب
  });
}

const sections = [...SECTIONS.map(([, k, name]) => ({ key: k, name })), { key: 'other', name: 'أخرى' }]
  .map(s => ({ ...s, count: models.filter(m => m.section === s.key).length }))
  .filter(s => s.count);

fs.writeFileSync(OUT, JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), total: models.length, sections, models }, null, 1) + '\n');
console.log(`models.json: ${models.length} موديل، ${sections.length} قسم، ${models.filter(m => m.template).length} بقالب جاهز`);
