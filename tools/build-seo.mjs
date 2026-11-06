// يبني صفحات ثابتة لكل قسم من أعمالنا + يحدّث works.html و index.html و sitemap.xml
// بيشتغل كل يوم من GitHub Actions، وبيقرأ الأعمال من Firestore (قراءة عامة).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = 'https://cesar-alcham.com';
const PROJECT = 'basel-7b29b';
const COL = 'cesar_website';
const PHONE = '0541737888', WA = '213541737888';
const MOCK = process.env.SEO_MOCK; // ملف تجربة محلي بدل Firestore

const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wr = (f, s) => { const p = path.join(ROOT, f); fs.mkdirSync(path.dirname(p), {recursive:true}); if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== s) { fs.writeFileSync(p, s); console.log('wrote', f); } };
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ---------- Firestore ----------
function val(v){
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)]));
  return null;
}
async function loadDocs(){
  if (MOCK) return JSON.parse(fs.readFileSync(MOCK, 'utf8'));
  const key = (rd('works.html').match(/apiKey:\s*"([^"]+)"/) || [])[1];
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

// ---------- helpers ----------
const TR = {'ا':'a','أ':'a','إ':'i','آ':'a','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh','د':'d','ذ':'dh','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','ة':'a','و':'w','ي':'y','ى':'a','ئ':'e','ؤ':'o','ء':''};
const WORDS = [['شمين','cheminee'],['مدفأ','cheminee'],['جرن','vasque'],['جرون','vasque'],['مغسل','lavabo'],['نافور','fontaine'],['نوافير','fontaine'],['شلال','cascade'],['واجه','facade'],['تابلو','tableau'],['عمود','colonne'],['أعمد','colonne'],['سبال','sabala'],['درج','escalier'],['نافذ','fenetre'],['شباك','fenetre'],['مدخل','entree'],['باب','porte'],['كورنيش','corniche'],['حمام','hammam'],['أرض','sol'],['حائط','mural'],['حيط','mural'],['نحت','sculpture'],['منحوت','sculpte'],['رخام','marbre'],['حجر','pierre'],['طاول','table'],['مطبخ','cuisine'],['موزاييك','mosaique']];
function slugify(name){
  const [ar, fr] = String(name).split('|').map(x => x.trim());
  let base = fr || '';
  if (!base && ar) { const hits = []; for (const w of ar.split(/\s+/)) { const m = WORDS.find(([k]) => w.includes(k)); if (m && !hits.includes(m[1])) hits.push(m[1]); } base = hits.join('-'); }
  base = base || ar || 'works';
  base = base.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  base = [...base].map(c => TR[c] ?? c).join('');
  base = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return base || 'works';
}
const splitName = c => { const [ar, fr] = String(c).replace(/\*\*/g, '').split('|').map(x => x.trim()); return {ar: ar || String(c).replace(/\*\*/g, '').trim(), fr: fr || ''}; };

// صور مخزّنة كـ data: بتتحول لملفات حقيقية، لـ Google وللسرعة
function imgUrl(it){
  const s = String(it.img || '');
  if (/^https?:\/\//.test(s)) return s;
  const m = s.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (!m) return '';
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const h = crypto.createHash('sha1').update(m[2]).digest('hex').slice(0, 16);
  const rel = `img/works/${h}.${ext}`, p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, Buffer.from(m[2], 'base64')); console.log('wrote', rel); }
  return '/' + rel;
}
const abs = u => u.startsWith('/') ? SITE + u : u;
const waPrice = (name, link) => `https://wa.me/${WA}?text=${encodeURIComponent('السلام عليكم، أريد معرفة سعر هذا العمل: ' + name + '\n' + link)}`;
const altOf = (it, cat) => it.aiAltAr ? `${it.aiAltAr} - قيصر الشام للحجر والرخام` : `${(it.title && splitName(it.title).ar) || splitName(cat).ar} - قيصر الشام للحجر والرخام${splitName(cat).fr ? ' - ' + splitName(cat).fr : ''}`;

function inject(html, name, content){
  const a = `<!--SEO:${name}-->`, b = `<!--/SEO:${name}-->`;
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < 0) throw new Error('marker missing ' + name);
  return html.slice(0, i + a.length) + content + html.slice(j);
}

// الصفحة العربية بتعرض الجزء العربي بس من وصف الواجهة (نفس arOnly بـ js/home-app.js)
const arOnly = t => typeof t === 'string' ? t.trim().split(/\s+(?=[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ ,\-]{15,})/)[0].trim() : t;

// ---------- page template ----------
function catPage(cat, slug, list, cats, slugs, settings){
  const {ar, fr} = splitName(cat);
  const title = `${ar} في الجزائر | قيصر الشام`; // قصير (أقل من 60 حرف) حتى ما يقصّه غوغل
  const desc = `${ar} حسب الطلب من قيصر الشام للحجر والرخام: تصميم وتصنيع وتركيب لجميع ولايات الجزائر. اطلب السعر: 0541737888`;
  const imgs = list.map(it => ({it, src: imgUrl(it)})).filter(x => x.src);
  const ogImg = imgs[0] ? abs(imgs[0].src) : SITE + '/img/site/og-card.jpg';
  const social = ['facebook','instagram','tiktok','youtube'].map(k => settings[k]).filter(Boolean);
  const schema = [{
    '@context':'https://schema.org','@type':'CollectionPage',name:title,description:desc,url:`${SITE}/${slug}`,inLanguage:'ar',
    isPartOf:{'@type':'WebSite',name:'قيصر الشام للحجر والرخام',url:SITE},
    about:{'@type':'HomeAndConstructionBusiness',name:'قيصر الشام للحجر والرخام',telephone:'+213541737888',url:SITE,sameAs:social},
    image: imgs.slice(0, 20).map(x => ({'@type':'ImageObject',contentUrl:abs(x.src),name:x.it.title || ar}))
  },{
    '@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
      {'@type':'ListItem',position:1,name:'الرئيسية',item:SITE + '/'},
      {'@type':'ListItem',position:2,name:'أعمالنا',item:SITE + '/works'},
      {'@type':'ListItem',position:3,name:ar,item:`${SITE}/${slug}`}]
  }];
  const others = cats.filter(c => c !== cat).map(c => `<a href="/${slugs[c]}">${esc(splitName(c).ar)}</a>`).join('');
  const cards = imgs.map(({it, src}) => `
      <figure class="card"><a href="${esc(src)}" class="lb"><img src="${esc(src)}" loading="lazy" decoding="async" width="600" height="450" alt="${esc(altOf(it, cat))}"></a>
        <figcaption><b>${esc((it.title && splitName(it.title).ar) || ar)}</b>${[it.size, it.color, it.type].filter(Boolean).length ? `<span>${esc([it.size, it.color, it.type].filter(Boolean).join(' · '))}</span>` : ''}<a class="pb" href="${esc(waPrice((it.title && splitName(it.title).ar) || ar, abs(src)))}" target="_blank" rel="nofollow noopener">💬 اطلب السعر</a></figcaption></figure>`).join('');
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/${slug}">
<link rel="alternate" hreflang="ar" href="${SITE}/${slug}"><link rel="alternate" hreflang="fr" href="${SITE}/fr/${slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/${slug}">
<meta property="og:image" content="${esc(ogImg)}">
<meta property="og:locale" content="ar_DZ">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"><link rel="icon" type="image/png" sizes="48x48" href="/img/site/fav-48.png"><link rel="icon" type="image/png" sizes="96x96" href="/img/site/fav-96.png"><link rel="icon" type="image/png" sizes="192x192" href="/img/site/fav-192.png">
<link rel="shortcut icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap"></noscript>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
:root{--ink:#3B2414;--gold:#9A6A3A;--gold-deep:#6E4524;--line:#E6D6BC;--dim:#666;--bg2:#F5ECDD}
*{box-sizing:border-box}body{margin:0;font-family:'Cairo',Tahoma,sans-serif;color:#2E1C10;background:#fff;line-height:1.7}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block}
header{background:#3B2414;position:sticky;top:0;z-index:50}
.hi{max-width:1200px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.brand b{color:var(--gold);font-size:21px;font-weight:900;display:block;line-height:1.2}.brand span{color:#ddd;font-size:12px}
nav{display:flex;gap:18px;flex-wrap:wrap;align-items:center}nav a{color:#fff;font-weight:700;font-size:14px}nav a:hover,nav a.on{color:#D9B98C}nav .lang{border:1.5px solid #D9B98C;border-radius:9px;padding:1px 12px;color:#D9B98C}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px}
.crumbs{font-size:12.5px;color:var(--dim);padding:18px 0 0}.crumbs a{color:var(--gold-deep)}
h1{font-size:clamp(24px,4vw,36px);font-weight:900;margin:8px 0 6px}h1 small{display:block;font-size:.5em;color:var(--gold-deep);font-weight:700}
.intro{color:#333;max-width:860px;font-size:15px}
.cta{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 26px}.cta a{padding:11px 20px;border-radius:12px;font-weight:800;font-size:14px}
.cta .wa{background:#16774A;color:#fff}.cta .ph{border:1.5px solid var(--gold);color:var(--gold-deep)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.card{margin:0;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(59,36,20,.06)}
.card img{width:100%;aspect-ratio:4/3;object-fit:cover}.card figcaption{padding:10px 14px;font-size:13.5px}.card figcaption span{display:block;color:var(--dim);font-size:12px}.card figcaption b{display:block}
.others{margin:34px 0;padding:18px;background:var(--bg2);border-radius:16px}.others h2{font-size:17px;margin:0 0 10px}
.others div{display:flex;flex-wrap:wrap;gap:8px}.others a{border:1.5px solid var(--line);background:#fff;padding:7px 14px;border-radius:10px;font-weight:700;font-size:13px}.others a:hover{border-color:var(--gold)}
footer{background:#2A190D;color:#C9B08F;text-align:center;padding:24px;font-size:12.5px;margin-top:30px}footer b{color:var(--gold)}
.lbx{position:fixed;inset:0;background:rgba(20,17,13,.92);display:none;flex-direction:column;gap:14px;align-items:center;justify-content:center;z-index:99;padding:20px}.lbx.on{display:flex}.lbx img{max-height:82vh;border-radius:8px}
.pb{display:inline-flex;margin-top:8px;background:#16774A;color:#fff;font-weight:800;font-size:13px;padding:7px 14px;border-radius:10px}.pb:hover{background:#18744A}.lbx .pb{font-size:15px;padding:10px 20px}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<header><div class="hi">
  <a class="brand" href="/" style="display:flex;align-items:center;gap:10px"><img src="/img/site/243fa7c39e4b.jpg" alt="قيصر الشام" width="46" height="46" style="border-radius:6px"><span><b>قيصر الشام</b><span>للحجر والرخام · الجزائر</span></span></a>
  <nav><a href="/">الرئيسية</a><a href="/works" class="on">أعمالنا</a><a href="/taghlif-wajihat-hajar">تغليف الواجهات</a><a href="/videos">معرض الفيديو</a><a href="/#contact">تواصل معنا</a><a href="tel:${PHONE}" dir="ltr">0541.73.78.88</a><a href="/fr/${slug}" hreflang="fr" lang="fr" class="lang" title="Version française">FR</a></nav>
</div></header>
<main class="wrap">
  <div class="crumbs"><a href="/">الرئيسية</a> › <a href="/works">أعمالنا</a> › ${esc(ar)}</div>
  <h1>${esc(ar)}</h1>
  <p class="intro">في قيصر الشام للحجر والرخام نصمّم ${esc(ar)} من الحجر والرخام الطبيعي ونصنعها ونركّبها حسب المقاس والتصميم الذي يناسب منزلك أو مشروعك. نعرض هنا مجموعة من أعمالنا المنجزة في هذا القسم (${imgs.length} صورة). مقرّنا في دالي إبراهيم بالجزائر العاصمة، ونخدم جميع الولايات.</p>
  <div class="cta"><a class="wa" href="https://wa.me/${WA}?text=${encodeURIComponent('السلام عليكم، أودّ الاستفسار عن ' + ar)}" rel="nofollow">اطلب عرض سعر على واتساب</a><a class="ph" href="tel:${PHONE}">اتصل: 0541.73.78.88</a></div>
  <section class="grid">${cards || '<p>ستُضاف الصور قريبًا.</p>'}
  </section>
  <section class="others"><h2>أقسام أخرى من أعمالنا</h2><div><a href="/works">جميع الأعمال</a>${others}</div></section>
</main>
<footer><b>قيصر الشام للحجر والرخام</b> — دالي إبراهيم، الجزائر — 0541.73.78.88</footer>
<div class="lbx" id="lbx"><img alt=""><a class="pb" target="_blank" rel="nofollow noopener" href="#">💬 اطلب السعر على واتساب</a></div>
<script>document.querySelectorAll('a.lb').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const l=document.getElementById('lbx');l.querySelector('img').src=a.href;const p=a.closest('figure').querySelector('.pb');l.querySelector('.pb').href=p?p.href:'#';l.classList.add('on')}));document.getElementById('lbx').addEventListener('click',e=>{if(!e.target.closest('.pb'))e.currentTarget.classList.remove('on')});</script>
<script src="/js/my-back.js" defer></script><script src="/js/wa-count.js" defer></script>
</body>
</html>
`;
}

// ---------- main ----------
const docs = await loadDocs();
const settings = (docs.main && docs.main.settings) || {};
let items = [];
for (const [id, d] of Object.entries(docs)) if (id.startsWith('items_')) items = items.concat(d.items || []);
{ const hid = new Set(((docs.site_hidden && docs.site_hidden.items) || []).map(x => x && x.id)); items = items.filter(it => !hid.has(it.id)); } // الصور المكررة المخفية
items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
const byCat = new Map();
for (const it of items) { const c = String(it.category || '').trim(); if (!c) continue; if (!byCat.has(c)) byCat.set(c, []); byCat.get(c).push(it); }
const sortCat = arr => arr.slice().sort((a, b) => (b.cover ? 1 : 0) - (a.cover ? 1 : 0) || ((a.order ?? 1e9) - (b.order ?? 1e9)) || ((b.createdAt || 0) - (a.createdAt || 0)));
for (const [c, l] of byCat) byCat.set(c, sortCat(l));
const cats = [...byCat.keys()].sort((a, b) => a.localeCompare(b, 'ar'));

// روابط ثابتة: الاسم بيضل نفسه حتى لو تغيّر ترتيب الأقسام
const slugFile = 'tools/seo-slugs.json';
const saved = fs.existsSync(path.join(ROOT, slugFile)) ? JSON.parse(rd(slugFile)) : {};
const slugs = {}, used = new Set(Object.values(saved));
for (const c of cats) {
  if (saved[c]) { slugs[c] = saved[c]; continue; }
  let s = 'a3mal-' + slugify(c), n = 2; while (used.has(s)) s = 'a3mal-' + slugify(c) + '-' + n++;
  slugs[c] = s; used.add(s);
}
wr(slugFile, JSON.stringify({...saved, ...slugs}, null, 1) + '\n');

// صفحة لكل قسم
const live = new Set();
for (const c of cats) { wr(slugs[c] + '.html', catPage(c, slugs[c], byCat.get(c), cats, slugs, settings)); live.add(slugs[c] + '.html'); }
// صفحات أقسام انحذفت: بتتحول لتحويل على أعمالنا
for (const s of Object.values(saved)) if (!live.has(s + '.html') && fs.existsSync(path.join(ROOT, s + '.html')))
  wr(s + '.html', `<!DOCTYPE html><html lang="ar"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><link rel="canonical" href="${SITE}/works"><meta http-equiv="refresh" content="0; url=/works"><title>أعمالنا</title></head><body><a href="/works">أعمالنا</a></body></html>\n`);

// أيقونات التواصل في الهيدر والفوتر مكتوبة مسبقاً بنفس شكل الكود (js/home-app.js)
// حتى ما يتغير ارتفاع الهيدر لحظة التحميل (Cumulative Layout Shift)
function putSocial(h) {
  const m = rd('js/home-app.js').match(/const SOCIAL_SVG = (\{[\s\S]*?\n\});/);
  let SVG = null; try { SVG = m ? (new Function('return ' + m[1]))() : null; } catch (e) { SVG = null; }
  if (!SVG) return h;
  const links = [
    [settings.whatsapp ? `https://wa.me/${String(settings.whatsapp).replace(/[^0-9]/g, '')}` : '', 'whatsapp', 'واتساب'],
    [settings.facebook, 'facebook', 'فيسبوك'], [settings.instagram, 'instagram', 'انستغرام'],
    [settings.tiktok, 'tiktok', 'تيك توك'], [settings.youtube, 'youtube', 'يوتيوب']
  ].filter(l => l[0]);
  const icons = links.map(([u, k, l]) => `<a href="${esc(u)}" target="_blank" title="${l}">${SVG[k]}</a>`).join('');
  for (const id of ['headerSocial', 'footerSocial'])
    h = h.replace(new RegExp('(<div class="social-icons" id="' + id + '"[^>]*>)[\\s\\S]*?(</div>)'), (x, a, b) => a + icons + b);
  return h;
}

// works.html: صور ثابتة (Google بيشوفها قبل ما تشتغل الصفحة) وروابط الأقسام
// نفس شكل البطاقات والأزرار اللي بيرسمها كود الصفحة بالضبط، حتى ما تنط الصفحة لحظة التحميل (CLS)
const waAsk = name => 'https://wa.me/' + WA + '?text=' + encodeURIComponent('السلام عليكم، أريد معرفة سعر هذا العمل: ' + name);
const shortC = c => String(c).replace(/\*\*/g, '').split('|')[0].trim();
const allCard = (c, i) => { const it = byCat.get(c)[0], src = imgUrl(it); if (!src) return ''; const s = shortC(c);
  return `<div class="card" data-go="${esc(c)}"><a href="/${slugs[c]}" style="display:contents"><div class="img-wrap"><img src="${esc(src)}" ${i < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} alt="${esc(altOf(it, c))}"></div></a><div class="body"><div class="title">${esc(s)}</div><div class="meta">${byCat.get(c).length} صورة — اضغط لعرضها جميعًا</div><a class="price-btn" data-pi="${i}" href="${esc(waAsk(s))}" target="_blank" rel="noopener">💬 اطلب السعر</a></div></div>`; };
let w = rd('works.html');
w = inject(w, 'GALLERY', cats.map(allCard).join(''));
w = inject(w, 'CATS', cats.map(c => `<li><a href="/${slugs[c]}">${esc(splitName(c).ar)}</a> <span>(${byCat.get(c).length})</span></li>`).join(''));
w = w.replace(/(<div class="filters" id="filters">)[\s\S]*?(<\/div>)/, (x, a, b) => a + `<button class="filter-btn active" data-cat="all">الكل<span class="n">(${items.length})</span></button>` + cats.map(c => `<button class="filter-btn " data-cat="${esc(c)}" title="${esc(c)}">${esc(String(c).split('|')[0].trim())}<span class="n">(${byCat.get(c).length})</span></button>`).join('') + b);
w = putSocial(w);
wr('works.html', w);

// videos.html: الفيديوهات ثابتة بالصفحة
let videos = [];
for (const [id, d] of Object.entries(docs)) if (id.startsWith('videos_')) videos = videos.concat(d.items || []);
videos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
let v = rd('videos.html');
// بطاقة فيديو: صورة مصغّرة + زر مشاهدة (الفيديو بيفتح بنافذة: js/vplayer.js) — نفس vCard بـ videos.html
const vCardHtml = (x, t, meta, watch, price, cls = '') => `<div class="card vcard${cls}"><button type="button" class="vthumb" data-vsrc="${esc(x.url)}" data-vtitle="${esc(t)}"${x.poster ? ` data-vposter="${esc(x.poster)}"` : ''} aria-label="${esc(watch.replace(/^▶\s*/, '') + ': ' + t)}"><video src="${esc(x.url)}#t=0.5" preload="none" muted playsinline${x.poster ? ` poster="${esc(x.poster)}"` : ' data-lazy'} title="${esc(t)}"></video><span class="vplay" aria-hidden="true"></span></button><div class="body b"><div class="title" title="${esc(t)}">${esc(t)}</div><div class="meta">${esc(meta)}</div><div class="vact"><button type="button" class="vwatch" data-vsrc="${esc(x.url)}" data-vtitle="${esc(t)}"${x.poster ? ` data-vposter="${esc(x.poster)}"` : ''}>${watch}</button>${price}</div></div></div>`;
const vNameAr = x => (x.title && splitName(x.title).ar) || splitName(x.category || '').ar || 'فيديو من أعمالنا';
v = inject(v, 'VIDEOS', videos.filter(x => /^https?:\/\//.test(x.url || '')).slice(0, 8).map(x => vCardHtml(x, vNameAr(x), splitName(x.category || '').ar, '▶ مشاهدة الفيديو', `<button type="button" class="price-btn" data-vp="${esc(vNameAr(x))}">💬 اطلب السعر</button>`)).join('') || '<div class="empty-state">جاري تحميل الفيديوهات...</div>');
const vSchema = videos.filter(x => x.poster && /^https?:\/\//.test(x.url || '')).slice(0, 60).map(x => ({'@type':'VideoObject', name: (x.title && splitName(x.title).ar) || splitName(x.category || '').ar || 'فيديو من أعمال قيصر الشام', description: `${(x.title && splitName(x.title).ar) || splitName(x.category || '').ar || 'فيديو'} — من أعمال قيصر الشام للحجر والرخام، الجزائر`, thumbnailUrl: x.poster, contentUrl: x.url, uploadDate: new Date(x.createdAt || Date.now()).toISOString()}));
v = inject(v, 'VSCHEMA', vSchema.length ? `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':vSchema})}</script>` : '');
{ const vc = [...new Set(videos.map(x => String(x.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
  const n = c => videos.filter(x => String(x.category || '').trim() === c).length;
  v = v.replace(/(<div class="filters" id="filters">)[\s\S]*?(<\/div>)/, (x, a, b) => a + (vc.length ? `<button class="filter-btn active" data-cat="all">الكل<span class="n">(${videos.length})</span></button>` + vc.map(c => `<button class="filter-btn " data-cat="${esc(c)}" title="${esc(c)}">${esc(c.split('|')[0].trim())}<span class="n">(${n(c)})</span></button>`).join('') : '') + b); }
v = putSocial(v);
wr('videos.html', v);

// index.html: صورتين من كل قسم ثابتين
let h = rd('index.html');
const faq = ((docs.site_faq && docs.site_faq.items) || []).filter(x => x && x.q && x.a);
if (faq.length) {
  h = inject(h, 'FAQ', faq.map(x => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a).replace(/\n/g, '<br>')}</p></details>`).join('\n  '));
  h = inject(h, 'FAQSCHEMA', `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(x => ({'@type':'Question',name:x.q,acceptedAnswer:{'@type':'Answer',text:x.a}}))}).replace(/</g,'\\u003c')}</script>`);
}
// «أحدث أعمالنا»: آخر 6 أعمال حقيقية (نفس ترتيب js/home-app.js) — والضغط بيفتح صفحة القسم بصوره
const shortT = t => String(t || '').replace(/\*\*/g, '').split('|')[0].trim();
const latest6 = items.filter(it => String(it.category || '').trim() && imgUrl(it)).slice(0, 6);
h = inject(h, 'SHOWCASE', latest6.map(it => { const c = String(it.category || '').trim(), src = imgUrl(it), t = shortT(it.title) || splitName(c).ar;
  return `<a href="/${slugs[c]}" class="sc-item"><img src="${esc(src)}" loading="lazy" decoding="async" width="600" height="450" alt="${esc(altOf(it, c))}"><span><b>${esc(t)}</b>${t !== splitName(c).ar ? `<small>${esc(splitName(c).ar)}</small>` : ''}</span></a>`; }).join(''));
// نص الواجهة نفسه الموجود في الإعدادات: حتى ما يعيد الكود كتابته بعد تحميل Firebase
// (إعادة الكتابة كانت تؤخر "ظهور المحتوى الرئيسي" في قياس Google)
const setHeroText = (html, id, txt) => (typeof txt === 'string' && txt.trim())
  ? html.replace(new RegExp('(<(?:span|p|h1)[^>]*\\sid="' + id + '"[^>]*>)[^<]*(</)'), (m, a, b) => a + esc(txt) + b)
  : html;
h = setHeroText(h, 'heroTitleMain', settings.heroTitleMain);
h = setHeroText(h, 'heroTitleAccent', settings.heroTitleAccent);
h = setHeroText(h, 'heroSubtitle', arOnly(settings.heroSubtitle));
h = putSocial(h);
h = inject(h, 'CATLINKS', cats.map(c => `<a href="/${slugs[c]}">${esc(splitName(c).ar)}</a>`).join(''));
wr('index.html', h);

// ================= النسخة الفرنسية /fr =================
const REVIEW_URL = 'https://www.google.com/maps?cid=9304963512715322872';
const frOf = c => splitName(c).fr || (slugs[c] ? (t => t.charAt(0).toUpperCase() + t.slice(1))(slugs[c].replace(/^a3mal-/, '').replace(/-/g, ' ')) : splitName(c).ar);
const frTitle = (it, c) => (it.title && splitName(it.title).fr) || frOf(c);
const waFr = t => `https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
const reviews = ((docs.site_reviews && docs.site_reviews.items) || []).filter(r => r && r.text);
// أيقونات التواصل (نفس رسوم js/home-app.js) — للهيدر الفرنسي
function socialIcons(lang){
  const m = rd('js/home-app.js').match(/const SOCIAL_SVG = (\{[\s\S]*?\n\});/);
  let SVG = null; try { SVG = m ? (new Function('return ' + m[1]))() : null; } catch (e) { SVG = null; }
  if (!SVG) return '';
  const L = lang === 'fr' ? {whatsapp:'WhatsApp', facebook:'Facebook', instagram:'Instagram', tiktok:'TikTok', youtube:'YouTube'} : {whatsapp:'واتساب', facebook:'فيسبوك', instagram:'انستغرام', tiktok:'تيك توك', youtube:'يوتيوب'};
  return [[settings.whatsapp ? `https://wa.me/${String(settings.whatsapp).replace(/[^0-9]/g, '')}` : `https://wa.me/${WA}`, 'whatsapp'], [settings.facebook, 'facebook'], [settings.instagram, 'instagram'], [settings.tiktok, 'tiktok'], [settings.youtube, 'youtube']]
    .filter(l => l[0] && SVG[l[1]]).map(([u, k]) => `<a href="${esc(u)}" target="_blank" rel="noopener" title="${L[k]}" aria-label="${L[k]}">${SVG[k]}</a>`).join('');
}
const PHONE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>';
const MARBLE_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' preserveAspectRatio='none'%3E%3Cfilter id='m' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='turbulence' baseFrequency='.0022 .0065' numOctaves='5' seed='11'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .38 0 0 0 0 .27 -2.4 0 0 0 1'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='gamma' amplitude='1' exponent='7'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23m)' opacity='.42'/%3E%3C/svg%3E")`;
function frLayout({title, desc, path: pth, arPath, og, body, schema, motion, videos: withVideos}){
  const on = test => test ? ' class="on" aria-current="page"' : '';
  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${pth}">
<link rel="alternate" hreflang="fr" href="${SITE}${pth}"><link rel="alternate" hreflang="ar" href="${SITE}${arPath}"><link rel="alternate" hreflang="x-default" href="${SITE}${arPath}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${pth}"><meta property="og:image" content="${esc(og || SITE + '/img/site/og-card.jpg')}"><meta property="og:locale" content="fr_DZ">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"><link rel="icon" type="image/png" sizes="192x192" href="/img/site/fav-192.png"><link rel="apple-touch-icon" sizes="180x180" href="/img/site/fav-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap"></noscript>
${schema ? `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>` : ''}
<style>
:root{--ink:#3B2414;--gold:#9A6A3A;--gold-deep:#6E4524;--bronze:#B8864E;--bronze-lt:#D9B98C;--line:#E6D6BC;--dim:#6F5642;--bg2:#F5ECDD;--hh:96px}
*{box-sizing:border-box}html{scroll-padding-top:calc(var(--hh) + 8px)}body{margin:0;font-family:'Cairo',system-ui,Arial,sans-serif;color:#2E1C10;background:#FBF6EE;line-height:1.7;text-align:left;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block}h1,h2,h3{line-height:1.3}p{line-height:1.85}
[lang="ar"]{font-family:'Cairo',Tahoma,sans-serif}
header{background:rgba(59,36,20,.98);position:sticky;top:0;z-index:50;transition:background .3s,box-shadow .3s}
header.scrolled{background:rgba(59,36,20,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 4px 24px rgba(0,0,0,.25)}
.hi{max-width:1280px;margin:0 auto;padding:0 24px;min-height:96px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:20px;transition:min-height .3s}
header.scrolled .hi{min-height:70px}
.brand{display:flex;align-items:center;gap:12px}.brand img{width:56px;height:56px;border-radius:10px;object-fit:contain;transition:width .3s,height .3s}header.scrolled .brand img{width:44px;height:44px}
.brand b{color:var(--bronze-lt);font-size:21px;font-weight:900;display:block;line-height:1.2;white-space:nowrap}.brand span span{color:#E6D6BC;font-size:12px;white-space:nowrap}
nav{display:flex;gap:24px;align-items:center;justify-content:center}
nav a{position:relative;color:#fff;font-weight:700;font-size:15px;padding:6px 0 8px;white-space:nowrap;transition:color .25s}
nav a::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:2px;background:var(--bronze-lt);transform:scaleX(0);transition:transform .25s}
nav a:hover,nav a.on{color:var(--bronze-lt)}nav a:hover::after,nav a.on::after{transform:scaleX(1)}
nav .lang{border:1.5px solid var(--bronze-lt);border-radius:9px;padding:2px 12px;color:var(--bronze-lt)}nav .lang::after{display:none}nav .lang:hover{background:var(--bronze-lt);color:var(--ink)}
.hx{display:flex;align-items:center;gap:12px}
.hph{display:inline-flex;align-items:center;gap:6px;color:#fff;font-weight:700;font-size:14px;border:1px solid rgba(217,185,140,.45);border-radius:999px;padding:6px 14px;white-space:nowrap}.hph:hover{border-color:var(--bronze-lt);background:rgba(217,185,140,.12)}.hph svg{width:15px;height:15px;color:var(--bronze-lt)}
.social-icons{display:flex;gap:8px}.social-icons a{width:34px;height:34px;border-radius:50%;border:1.5px solid var(--gold);display:flex;align-items:center;justify-content:center;color:var(--bronze-lt);transition:.25s}.social-icons a svg{width:17px;height:17px}.social-icons a:hover{background:var(--gold);color:#fff}
.burger{display:none;width:42px;height:42px;border:1.5px solid rgba(217,185,140,.5);border-radius:10px;background:none;color:#fff;font-size:20px;cursor:pointer}
@media(max-width:1180px){nav{gap:16px}nav a{font-size:14px}.social-icons{display:none}}
@media(max-width:860px){.hi{grid-template-columns:1fr auto;gap:10px;padding:10px 18px;min-height:0}header.scrolled .hi{min-height:0}.burger{display:block}
 nav{grid-column:1/-1;display:none;flex-direction:column;align-items:stretch;gap:0;background:#4A2E1A;border-radius:14px;padding:6px 14px;margin-bottom:8px}nav.open{display:flex}
 nav a{padding:12px 4px;border-bottom:1px solid rgba(217,185,140,.15);font-size:15.5px}nav a:last-child{border-bottom:0}nav a::after{display:none}nav .lang{align-self:flex-start;margin:10px 0 6px;padding:6px 16px}
 .hx{grid-column:1/-1;justify-content:space-between;flex-wrap:wrap;padding-bottom:6px}.social-icons{display:flex}.brand img{width:46px;height:46px}.brand b{font-size:18px}}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px}
.crumbs{font-size:12.5px;color:var(--dim);padding:18px 0 0}.crumbs a{color:var(--gold-deep)}
h1{font-size:clamp(24px,4vw,38px);font-weight:900;margin:8px 0 6px;color:var(--ink)}h2{color:var(--ink)}
.intro{color:#4A2E1A;max-width:880px;font-size:15.5px}
.cta{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 26px}.cta a,.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:11px 20px;border-radius:12px;font-weight:800;font-size:14px;border:0;cursor:pointer;font-family:inherit;transition:.25s}
.wa{background:#16774A;color:#fff}.ph,.cta a.ph{border:1.5px solid var(--gold);color:var(--gold-deep);background:rgba(255,255,255,.75)}.ph:hover,.cta a.ph:hover{background:var(--gold);color:#fff}
.btn-gold{background:var(--gold);color:#fff}.btn-gold:hover{background:var(--gold-deep)}.btn-dark{background:#3B2414;color:#fff}.btn-dark:hover{background:#2A190D}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.card{margin:0;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(59,36,20,.06);transition:transform .3s,box-shadow .3s}
a.card:hover{transform:translateY(-4px);box-shadow:0 18px 36px rgba(59,36,20,.1)}
.card img{width:100%;aspect-ratio:4/3;object-fit:cover}.card figcaption,.card .b{padding:10px 14px;font-size:14px}.card figcaption span{display:block;color:var(--dim);font-size:12px}.card figcaption b{display:block}
.pb{display:inline-flex;margin-top:8px;background:#16774A;color:#fff;font-weight:800;font-size:13px;padding:7px 14px;border-radius:10px}
.sec{margin:44px 0}.sec h2{font-size:clamp(22px,3vw,30px);font-weight:900;margin:0 0 14px;text-align:center}
.faq details{border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:10px 0;background:#fff}.faq summary{cursor:pointer;font-weight:800}
.others{margin:34px 0;padding:18px;background:var(--bg2);border-radius:16px}.others div{display:flex;flex-wrap:wrap;gap:8px}.others a{border:1.5px solid var(--line);background:#fff;padding:7px 14px;border-radius:10px;font-weight:700;font-size:13px}
footer{background:#2A190D;color:#C9B08F;text-align:center;padding:24px;font-size:12.5px;margin-top:30px}footer b{color:var(--bronze-lt)}
.lbx{position:fixed;inset:0;background:rgba(20,17,13,.92);display:none;flex-direction:column;gap:14px;align-items:center;justify-content:center;z-index:99;padding:20px}.lbx.on{display:flex}.lbx img{max-height:82vh;border-radius:8px}
.hidden{display:none !important}
/* accueil */
.hero{margin:0 -20px;border-radius:0 0 28px 28px;padding:80px 24px 60px;text-align:center;background-color:#FBF8F3;background-image:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.9),transparent 60%),${MARBLE_BG},linear-gradient(160deg,#fff 0%,#F7F1E8 55%,#F3EADD 100%);background-size:auto,cover,auto;background-repeat:no-repeat}
.hero-inner{max-width:860px;margin:0 auto}
.hero-badge{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.85);border:1px solid var(--line);border-radius:999px;padding:6px 8px 6px 16px;font-size:13px;font-weight:700;color:var(--gold-deep);box-shadow:0 4px 14px rgba(59,36,20,.06);margin-bottom:22px}
.hero-badge svg{border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.18);flex-shrink:0;order:2}
.hero h1{font-size:clamp(30px,5vw,54px);line-height:1.2;margin:0 0 18px}
.hero-accent{color:#8A5A2E;background:linear-gradient(100deg,#6E4524 0%,#B8864E 50%,#6E4524 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero .intro{font-size:clamp(15.5px,1.6vw,18px);color:#5A4535;max-width:660px;margin:0 auto 30px}
.hero .cta{justify-content:center;margin:0}.hero .cta a{min-width:230px;padding:14px 26px;font-size:15px}
@keyframes heroUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.hero-inner>*{animation:heroUp .7s cubic-bezier(.2,.7,.2,1) backwards}.hero-inner>:nth-child(2){animation-delay:.08s}.hero-inner>:nth-child(3){animation-delay:.16s}.hero-inner>:nth-child(4){animation-delay:.24s}
@media(prefers-reduced-motion:reduce){.hero-inner>*{animation:none}}
.features{display:grid;grid-template-columns:repeat(5,1fr);gap:20px;margin:-6px 0 0;padding-top:40px}
.fcard{display:flex;flex-direction:column;align-items:center;text-align:center;height:100%;padding:28px 16px 24px;background:linear-gradient(180deg,#fff,#FFFCF8);border:1px solid #EFE3D0;border-radius:18px;box-shadow:0 10px 30px rgba(59,36,20,.06);position:relative;overflow:hidden;transition:transform .35s,box-shadow .35s,border-color .35s}
.fcard::before{content:"";position:absolute;top:0;left:22%;right:22%;height:3px;border-radius:0 0 3px 3px;background:linear-gradient(90deg,transparent,var(--bronze),transparent);opacity:.55;transition:.35s}
.fcard:hover{transform:translateY(-5px);box-shadow:0 18px 36px rgba(59,36,20,.1);border-color:var(--bronze-lt)}.fcard:hover::before{left:10%;right:10%;opacity:1}
.fcard i{width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:14px;background:linear-gradient(145deg,#F6EBDB,#EBD9BE);box-shadow:inset 0 0 0 1px rgba(154,106,58,.18);transition:.35s}
.fcard i svg{width:28px;height:28px;stroke:#9A6A3A;transition:.35s}.fcard:hover i{background:linear-gradient(145deg,#B8864E,#8A5A2E)}.fcard:hover i svg{stroke:#fff}
.fcard h3{font-size:16px;font-weight:800;margin:0 0 6px;color:var(--ink)}.fcard p{font-size:13.5px;color:var(--dim);margin:0;line-height:1.6}
@media(max-width:1100px){.features{grid-template-columns:repeat(3,1fr)}}@media(max-width:620px){.features{grid-template-columns:repeat(2,1fr);gap:12px}.fcard:last-child{grid-column:1/-1}.fcard{padding:20px 10px}}
.lead{text-align:center;color:var(--dim);margin:-6px auto 22px}
.works6{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.wk{position:relative;display:block;aspect-ratio:4/3;border-radius:16px;overflow:hidden;box-shadow:0 10px 26px rgba(59,36,20,.1);background:var(--bg2);isolation:isolate}
.wk img{width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.2,.7,.2,1)}.wk:hover img{transform:scale(1.06)}
.wk span{position:absolute;inset:auto 0 0 0;padding:40px 16px 14px;color:#fff;background:linear-gradient(transparent,rgba(30,18,10,.82));display:flex;flex-direction:column}
.wk b{font-weight:800;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wk small{color:var(--bronze-lt);font-weight:600;font-size:12.5px}
.wk::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 0 rgba(217,185,140,0);transition:box-shadow .35s;pointer-events:none}.wk:hover::after{box-shadow:inset 0 0 0 3px rgba(217,185,140,.85)}
.cats{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:22px 0 16px}.cats a{border:1.5px solid var(--line);background:#fff;border-radius:10px;padding:6px 12px;font-weight:700;font-size:13px}.cats a:hover{border-color:var(--gold)}
.acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
@media(max-width:820px){.works6{grid-template-columns:repeat(2,1fr);gap:12px}}@media(max-width:520px){.wk span{padding:26px 10px 10px}.wk b{font-size:13px}.wk small{font-size:11.5px}.hero{padding:52px 18px 44px}.hero .cta a{width:100%;min-width:0}}
.rv-sum{display:flex;width:max-content;max-width:100%;margin:0 auto;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center;background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 8px 8px 20px;box-shadow:0 10px 30px rgba(59,36,20,.06)}
.rv-sum b{font-size:22px;font-weight:900}.rv-stars{color:#D9A23A;letter-spacing:2px}.rv-sum .src{color:var(--dim);font-size:14px;font-weight:600}.rv-sum a{background:#16774A;color:#fff;padding:8px 16px;border-radius:999px;font-weight:800;font-size:14px;white-space:nowrap}
.rv{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px;margin-top:22px}
.rv-card{background:#fff;border:1px solid #EFE3D0;border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:10px;box-shadow:0 8px 22px rgba(59,36,20,.05);transition:.3s}.rv-card:hover{transform:translateY(-3px);box-shadow:0 16px 32px rgba(59,36,20,.09)}
.rv-head{display:flex;align-items:center;gap:10px;min-width:0}.rv-av{width:40px;height:40px;border-radius:50%;flex-shrink:0;object-fit:cover;background:linear-gradient(145deg,#B8864E,#6E4524);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}
.rv-head b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;cursor:pointer}.rv-head b.open{white-space:normal}
.rv-card p{margin:0;font-size:14.5px;line-height:1.85;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}.rv-card p.open{display:block}
.rv-foot{grid-column:1/-1;text-align:center;font-size:12.5px;color:var(--gold-deep)}
@media(max-width:520px){.rv-sum{border-radius:18px;padding:12px}}
/* vidéos */
.vthumb{position:relative;display:block;width:100%;aspect-ratio:16/9;padding:0;border:0;background:#1b120b;cursor:pointer;overflow:hidden}
.vthumb video{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;background:#1b120b;transition:transform .5s}
.vthumb::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(20,12,6,.55));pointer-events:none}
.vcard:hover .vthumb video{transform:scale(1.04)}
.vplay{position:absolute;inset:0;margin:auto;width:62px;height:62px;border-radius:50%;background:rgba(154,106,58,.92);box-shadow:0 8px 24px rgba(0,0,0,.35),0 0 0 6px rgba(255,255,255,.18);z-index:1;transition:transform .25s,background .25s}
.vplay::before{content:"";position:absolute;top:50%;left:54%;transform:translate(-50%,-50%);border-style:solid;border-width:11px 0 11px 18px;border-color:transparent transparent transparent #fff}
.vcard:hover .vplay{transform:scale(1.08);background:#6E4524}
.vcard .title{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vcard .meta{color:var(--dim);font-size:12.5px}
.vact{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.vact .pb{margin-top:0}
.vwatch{display:inline-flex;align-items:center;gap:6px;background:#3B2414;color:#fff;font:inherit;font-weight:800;font-size:13px;padding:7px 14px;border-radius:10px;border:0;cursor:pointer}.vwatch:hover{background:#6E4524}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.grid{grid-template-columns:1fr}}
</style>
${motion ? '<script src="/js/motion.js" defer></script>' : ''}
${withVideos ? '<script src="/js/vplayer.js" defer></script>' : ''}
</head>
<body>
<header><div class="hi">
  <a class="brand" href="/fr/"><img src="/img/site/243fa7c39e4b.jpg" alt="Cesar Al Cham — marbre et pierre naturelle" width="56" height="56"><span><b>Cesar Al Cham</b><span>Marbre et pierre naturelle · Algérie</span></span></a>
  <button class="burger" id="burgerBtn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="frNav">☰</button>
  <nav id="frNav"><a href="/fr/"${on(pth==='/fr/')}>Accueil</a><a href="/fr/works"${on(pth.startsWith('/fr/works')||pth.startsWith('/fr/a3mal'))}>Nos réalisations</a><a href="/fr/videos"${on(pth==='/fr/videos')}>Vidéos</a><a href="/fr/#avis">Avis</a><a href="/fr/#contact">Contact</a><a class="lang" href="${arPath}" hreflang="ar" lang="ar" dir="rtl" title="النسخة العربية">العربية</a></nav>
  <div class="hx"><a class="hph" href="tel:${PHONE}">${PHONE_SVG}<span dir="ltr">0541 73 78 88</span></a><div class="social-icons">${socialIcons('fr')}</div></div>
</div></header>
<main class="wrap">${body}</main>
<footer><b>Cesar Al Cham — Marbre et Pierre</b> — 36, Route Nationale, Dely Ibrahim, Alger — <span dir="ltr">0541 73 78 88</span></footer>
<div class="lbx" id="lbx"><img alt=""><a class="pb" target="_blank" rel="nofollow noopener" href="#">💬 Demander le prix sur WhatsApp</a></div>
<script>document.querySelectorAll('a.lb').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const l=document.getElementById('lbx');l.querySelector('img').src=a.href;const p=a.closest('figure').querySelector('.pb');l.querySelector('.pb').href=p?p.href:'#';l.classList.add('on')}));document.getElementById('lbx').addEventListener('click',e=>{if(!e.target.closest('.pb'))e.currentTarget.classList.remove('on')});
const mb=document.getElementById('more');if(mb)mb.onclick=()=>{const h=[...document.querySelectorAll('.hidden')].slice(0,8);h.forEach(x=>x.classList.remove('hidden'));if(window.__vpScan)__vpScan();if(!document.querySelector('.hidden'))mb.remove()};
(function(){const h=document.querySelector('header'),b=document.getElementById('burgerBtn'),n=document.getElementById('frNav');const hh=()=>document.documentElement.style.setProperty('--hh',h.offsetHeight+'px');
addEventListener('scroll',()=>{if(scrollY>80)h.classList.add('scrolled');else if(scrollY<20)h.classList.remove('scrolled')},{passive:true});addEventListener('resize',hh,{passive:true});hh();
b.addEventListener('click',()=>{const o=n.classList.toggle('open');b.setAttribute('aria-expanded',o);hh()});n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{n.classList.remove('open');b.setAttribute('aria-expanded','false')}));
document.addEventListener('click',e=>{const x=e.target.closest&&e.target.closest('.rv-card p,.rv-head b');if(x)x.classList.toggle('open')});})();</script>
<script src="/js/my-back.js" defer></script><script src="/js/wa-count.js" defer></script>
</body>
</html>
`;
}
const frSlug = c => slugs[c];
fs.mkdirSync(path.join(ROOT, 'fr'), {recursive: true});
const rvCardFr = (name, stars, text, photo) => { const n = Math.max(1, Math.min(5, Math.round(+stars || 5)));
  return `<div class="rv-card"><div class="rv-head">${photo ? `<img class="rv-av" src="${esc(photo)}" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer">` : `<span class="rv-av" aria-hidden="true">${esc(String(name || '').trim()[0] || '★')}</span>`}<b dir="auto" title="${esc(name)}">${esc(name)}</b></div><span class="rv-stars" aria-label="${n} sur 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span><p dir="auto">${esc(text)}</p></div>`; };
const reviewsHtml = () => `<section class="sec" id="avis"><h2>Avis de nos clients</h2>
  <div class="rv-sum"><b id="gRating">5,0</b><span class="rv-stars" aria-hidden="true">★★★★★</span><span class="src">sur Google<span id="gCount"></span></span><a href="${REVIEW_URL}" target="_blank" rel="noopener">Laissez-nous un avis</a></div>
  <div class="rv" id="reviewsList">${reviews.filter(r => !r.hidden && r.approved !== false).map(r => rvCardFr(r.name || '', r.stars, r.text, r.photo || '')).join('')}</div>
  <script>(function(){fetch('/api/google-reviews').then(r=>r.ok?r.json():null).then(d=>{if(!d||!d.ok||!d.reviews||!d.reviews.length)return;
  const e=t=>String(t||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  if(d.rating)document.getElementById('gRating').textContent=(+d.rating).toFixed(1).replace('.',',');if(d.count)document.getElementById('gCount').textContent=' ('+d.count+' avis)';
  document.getElementById('reviewsList').innerHTML=d.reviews.map(r=>{const n=Math.max(1,Math.min(5,Math.round(+r.stars||5)));return '<div class="rv-card"><div class="rv-head">'+(r.photo?'<img class="rv-av" src="'+e(r.photo)+'" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer">':'<span class="rv-av" aria-hidden="true">'+e((String(r.name||'').trim()[0])||'★')+'</span>')+'<b dir="auto" title="'+e(r.name)+'">'+e(r.name)+'</b></div><span class="rv-stars" aria-label="'+n+' sur 5">'+'★'.repeat(n)+'☆'.repeat(5-n)+'</span><p dir="auto">'+e(r.text)+'</p></div>'}).join('')
  +'<div class="rv-foot">Avis publiés sur <a href="'+e(d.url||'${REVIEW_URL}')+'" target="_blank" rel="noopener" style="font-weight:700">Google</a></div>';}).catch(()=>{})})();</script></section>`;
// fr/<slug>
for (const c of cats) {
  const list = byCat.get(c), fr = frOf(c), slug = slugs[c];
  const imgs = list.map(it => ({it, src: imgUrl(it)})).filter(x => x.src);
  const cards = imgs.map(({it, src}) => `<figure class="card"><a href="${esc(src)}" class="lb"><img src="${esc(src)}" loading="lazy" alt="${esc((it.aiAltFr || frTitle(it, c)) + ' - Cesar Al Cham, marbre Algérie')}"></a><figcaption><b>${esc(frTitle(it, c))}</b>${[it.size].filter(Boolean).length ? `<span>${esc(it.size)}</span>` : ''}<a class="pb" target="_blank" rel="nofollow noopener" href="${esc(waFr('Bonjour, je voudrais connaître le prix de ce travail : ' + frTitle(it, c) + '\n' + abs(src)))}">💬 Demander le prix</a></figcaption></figure>`).join('');
  const others = cats.filter(x => x !== c).map(x => `<a href="/fr/${slugs[x]}">${esc(frOf(x))}</a>`).join('');
  wr(`fr/${slug}.html`, frLayout({title: `${fr} en Algérie | Cesar Al Cham`, desc: `${fr} sur mesure : conception, fabrication et pose par Cesar Al Cham, Dely Ibrahim (Alger). Devis gratuit : 0541 73 78 88.`, path: `/fr/${slug}`, arPath: `/${slug}`, og: imgs[0] ? abs(imgs[0].src) : '',
    body: `<div class="crumbs"><a href="/fr/">Accueil</a> › <a href="/fr/works">Nos réalisations</a> › ${esc(fr)}</div><h1>${esc(fr)}</h1>
    <p class="intro">Chez Cesar Al Cham, nous concevons, fabriquons et posons ${esc(fr.toLowerCase())} en marbre et pierre naturelle, sur mesure, partout en Algérie. Voici une sélection de nos réalisations.</p>
    <div class="cta"><a class="wa" href="${esc(waFr('Bonjour, je souhaite un devis pour : ' + fr))}" rel="nofollow">Demander un devis sur WhatsApp</a><a class="ph" href="tel:${PHONE}">Appeler : 0541 73 78 88</a></div>
    <section class="grid">${cards || '<p>Photos bientôt disponibles.</p>'}</section>
    <section class="others"><h2 style="font-size:17px;margin:0 0 10px">Autres catégories</h2><div><a href="/fr/works">Toutes nos réalisations</a>${others}</div></section>`}));
  live.add(`fr/${slug}.html`);
}
// fr/works
wr('fr/works.html', frLayout({title: 'Nos réalisations en marbre et pierre - Cesar Al Cham, Algérie', desc: 'Cheminées, fontaines, vasques, façades en pierre, tableaux de sol et colonnes en marbre : découvrez les réalisations de Cesar Al Cham en Algérie.', path: '/fr/works', arPath: '/works',
  body: `<h1 style="margin-top:22px">Nos réalisations</h1><p class="intro">Choisissez une catégorie pour voir toutes les photos.</p>
  <section class="grid">${cats.map(c => { const it = byCat.get(c)[0], src = imgUrl(it); return src ? `<a class="card" href="/fr/${slugs[c]}"><img src="${esc(src)}" loading="lazy" alt="${esc('Réalisation Cesar Al Cham : ' + frOf(c))}"><div class="b"><b>${esc(frOf(c))}</b><div style="color:var(--dim);font-size:12px">${byCat.get(c).length} photos</div></div></a>` : ''; }).join('')}</section>`}));
live.add('fr/works.html');
// fr/videos
const vids = videos.filter(x => /^https?:\/\//.test(x.url || ''));
wr('fr/videos.html', frLayout({videos: true, title: 'Vidéos de nos réalisations - Cesar Al Cham', desc: 'Vidéos des travaux en marbre et pierre naturelle réalisés par Cesar Al Cham en Algérie.', path: '/fr/videos', arPath: '/videos',
  body: `<h1 style="margin-top:22px">Vidéos de nos réalisations</h1><p class="intro">Touchez une vidéo pour la regarder sans quitter la page.</p><section class="grid">${vids.map((x, i) => { const t = (x.title && splitName(x.title).fr) || frOf(x.category || '') || 'Vidéo'; return vCardHtml(x, t, x.category ? frOf(x.category) : '', '▶ Regarder la vidéo', `<a class="pb" target="_blank" rel="nofollow noopener" href="${esc(waFr('Bonjour, je voudrais connaître le prix de ce travail : ' + t))}">💬 Demander le prix</a>`, i >= 8 ? ' hidden' : ''); }).join('')}</section>${vids.length > 8 ? '<p style="text-align:center"><button id="more" class="btn ph" type="button">Voir plus de vidéos</button></p>' : ''}`}));
live.add('fr/videos.html');
// fr/index
const FAQ_FR = [['Où êtes-vous situés et quelles régions couvrez-vous ?','Notre atelier se trouve à Dely Ibrahim (Alger). Nous réalisons la conception, la fabrication et la pose dans toutes les wilayas d\'Algérie.'],['Quels travaux réalisez-vous en marbre et en pierre ?','Cheminées en marbre, vasques et bassins de hammam, fontaines, façades en pierre, tableaux de sol et muraux, colonnes, balustrades, encadrements de portes et fenêtres, et décoration de mosquées.'],['Travaillez-vous sur mesure ?','Oui, chaque pièce est conçue et fabriquée selon vos dimensions et le design choisi. Nous vous présentons un dessin avec les mesures avant la fabrication.'],['Quels types de marbre proposez-vous ?','Marbre et pierre naturelle en plusieurs couleurs : blanc italien (Carrare), beige égyptien, teintes foncées, ainsi que des pierres naturelles pour façades.'],['Comment obtenir un devis ?','Envoyez-nous sur WhatsApp au 0541 73 78 88 des photos du lieu et les mesures approximatives : nous vous répondons rapidement avec un devis.']];
const FEAT_FR = [
  ['<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>', 'Nous venons à vous', 'Service dans toute l\'Algérie'],
  ['<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>', 'Service client', 'Toujours à votre écoute'],
  ['<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/>', 'Pose professionnelle', 'Une équipe très expérimentée'],
  ['<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>', 'Designs uniques', 'Modernes et classiques'],
  ['<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><path d="M2 9h20"/>', 'Haute qualité', 'Les meilleurs marbres et pierres']];
const feats = FEAT_FR.map(([d, h3, p]) => `<div class="fcard"><i><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg></i><h3>${esc(h3)}</h3><p>${esc(p)}</p></div>`).join('');
const show = latest6.map(it => { const c = String(it.category || '').trim(), src = imgUrl(it), t = frTitle(it, c);
  return `<a class="wk" href="/fr/${slugs[c]}"><img src="${esc(src)}" loading="lazy" decoding="async" width="600" height="450" alt="${esc((it.aiAltFr || t) + ' - Cesar Al Cham')}"><span><b>${esc(t)}</b>${t !== frOf(c) ? `<small>${esc(frOf(c))}</small>` : ''}</span></a>`; }).join('');
const FLAG = '<svg width="30" height="20" viewBox="0 0 30 20" aria-hidden="true"><rect width="15" height="20" fill="#006233"/><rect x="15" width="15" height="20" fill="#fff"/><circle cx="15" cy="10" r="4.6" fill="#d21034"/><circle cx="16.6" cy="10" r="3.8" fill="#fff"/><path d="M17.2 7.2l.6 1.8h1.9l-1.5 1.1.6 1.8-1.6-1.1-1.5 1.1.6-1.8-1.6-1.1h1.9z" fill="#d21034"/></svg>';
wr('fr/index.html', frLayout({motion: true, title: 'Cesar Al Cham | Marbre et pierre naturelle - Algérie', desc: 'Cesar Al Cham, Dely Ibrahim (Alger) : conception, sculpture et pose de marbre et pierre naturelle — cheminées, fontaines, vasques, façades, colonnes. Devis gratuit au 0541 73 78 88.', path: '/fr/', arPath: '/',
  schema: [{'@context':'https://schema.org','@type':'HomeAndConstructionBusiness',name:'Cesar Al Cham — Marbre et Pierre',url:SITE + '/fr/',telephone:'+213541737888',image:SITE + '/img/site/og-card.jpg',address:{'@type':'PostalAddress',streetAddress:'36, Route Nationale',addressLocality:'Dely Ibrahim',addressRegion:'Alger',addressCountry:'DZ'},aggregateRating:{'@type':'AggregateRating',ratingValue:'5.0',reviewCount:'8'}},{'@context':'https://schema.org','@type':'FAQPage',mainEntity:FAQ_FR.map(([q,a]) => ({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}],
  body: `<section class="hero" id="home"><div class="hero-inner"><div class="hero-badge">${FLAG}<span>Fabrication algérienne · Dely Ibrahim</span></div><h1><span class="hero-accent" id="heroTitleAccent">Marbre et pierre naturelle</span> d'exception</h1><p class="intro">Conception, sculpture et pose de marbre et de pierre naturelle avec savoir-faire — depuis Dely Ibrahim (Alger), partout en Algérie, pour des projets élégants et haut de gamme.</p>
  <div class="cta"><a class="btn-gold" href="${esc(waFr('Bonjour, je souhaite un devis de Cesar Al Cham.'))}" rel="nofollow">Contactez-nous et demandez un devis</a><a class="ph" href="#works">Découvrir nos réalisations</a></div></div></section>
  <section class="features" aria-label="Nos points forts">${feats}</section>
  <section class="sec" id="works"><h2>Nos dernières réalisations</h2><p class="lead">Photos réelles de nos projets en marbre et pierre naturelle</p><div class="works6">${show}</div>
  <div class="cats">${cats.map(c => `<a href="/fr/${slugs[c]}">${esc(frOf(c))}</a>`).join('')}</div>
  <div class="acts"><a class="btn btn-gold" href="/fr/works">Voir toutes nos réalisations</a><a class="btn btn-dark" href="/fr/videos">▶ Vidéos</a></div></section>
  ${reviewsHtml()}
  <section class="sec faq"><h2>Questions fréquentes</h2>${FAQ_FR.map(([q,a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>
  <section class="sec" id="contact"><h2>Contact</h2><p style="text-align:center">📞 <a href="tel:${PHONE}" dir="ltr"><b>0541 73 78 88</b></a> · WhatsApp : <a href="https://wa.me/${WA}" style="color:#16774A;font-weight:800">écrivez-nous</a><br>📍 36, Route Nationale, Dely Ibrahim, Alger — <a href="https://www.google.com/maps?cid=9304963512715322872" target="_blank" rel="noopener" style="color:var(--gold-deep);text-decoration:underline">voir sur Google Maps ↗</a></p></section>`}));
live.add('fr/index.html');

// sitemap مع الصور
const today = new Date().toISOString().slice(0, 10);
const day = t => t ? new Date(t).toISOString().slice(0, 10) : today;
const lastOf = list => day(Math.max(0, ...list.map(it => it.createdAt || 0)) || 0);
const urlE = (loc, lm, pr, imgs = []) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lm}</lastmod>\n    <priority>${pr}</priority>\n${imgs.slice(0, 50).map(x => `    <image:image><image:loc>${esc(abs(x.src))}</image:loc><image:title>${esc(x.title)}</image:title></image:image>\n`).join('')}  </url>`;
const imgsOf = (list, c) => list.map(it => ({src: imgUrl(it), title: altOf(it, c)})).filter(x => x.src);
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[urlE(SITE + '/', lastOf(items), '1.0'), urlE(SITE + '/works', lastOf(items), '0.9', items.slice(0, 50).map(it => ({src: imgUrl(it), title: altOf(it, String(it.category || '').trim())})).filter(x => x.src)), urlE(SITE + '/videos', today, '0.7'), urlE(SITE + '/taghlif-wajihat-hajar', '2026-10-31', '0.9'),
  ...cats.map(c => urlE(`${SITE}/${slugs[c]}`, lastOf(byCat.get(c)), '0.8', imgsOf(byCat.get(c), c))),
  urlE(SITE + '/fr/', lastOf(items), '0.9'), urlE(SITE + '/fr/works', lastOf(items), '0.8'), urlE(SITE + '/fr/videos', today, '0.6'),
  ...cats.map(c => urlE(`${SITE}/fr/${slugs[c]}`, lastOf(byCat.get(c)), '0.7', imgsOf(byCat.get(c), c)))].join('\n')}
</urlset>
`;
// ما منغيّر التاريخ إذا ما في شي جديد
const old = fs.existsSync(path.join(ROOT, 'sitemap.xml')) ? rd('sitemap.xml') : '';
const strip = s => s.replace(/<lastmod>[^<]*<\/lastmod>/g, '');
if (strip(old) !== strip(sm)) wr('sitemap.xml', sm);
console.log('categories:', cats.length, 'items:', items.length, 'videos:', videos.length);
