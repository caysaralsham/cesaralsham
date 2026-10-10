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

// ---------- page template ----------
function catPage(cat, slug, list, cats, slugs, settings){
  const {ar, fr} = splitName(cat);
  const title = `${ar}${fr ? ' | ' + fr : ''} - قيصر الشام للحجر والرخام، الجزائر`;
  const desc = `${ar}${fr ? ' (' + fr + ')' : ''} — صور من أعمال قيصر الشام للحجر والرخام: تصميم وتصنيع وتركيب بالرخام والحجر الطبيعي، من دالي إبراهيم إلى جميع ولايات الجزائر. اطلب عرض سعر على الرقم 0541737888.`;
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
      <figure class="card"><a href="${esc(src)}" class="lb"><img src="${esc(src)}" loading="lazy" alt="${esc(altOf(it, cat))}"></a>
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
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
:root{--ink:#3B2414;--gold:#9A6A3A;--gold-deep:#6E4524;--line:#E6D6BC;--dim:#666;--bg2:#F5ECDD}
*{box-sizing:border-box}body{margin:0;font-family:'Cairo',Tahoma,sans-serif;color:#2E1C10;background:#fff;line-height:1.7}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block}
header{background:#3B2414;position:sticky;top:0;z-index:50}
.hi{max-width:1200px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.brand b{color:var(--gold);font-size:21px;font-weight:900;display:block;line-height:1.2}.brand span{color:#ddd;font-size:12px}
nav{display:flex;gap:18px;flex-wrap:wrap}nav a{color:#fff;font-weight:700;font-size:14px}nav a:hover,nav a.on{color:var(--gold)}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px}
.crumbs{font-size:12.5px;color:var(--dim);padding:18px 0 0}.crumbs a{color:var(--gold-deep)}
h1{font-size:clamp(24px,4vw,36px);font-weight:900;margin:8px 0 6px}h1 small{display:block;font-size:.5em;color:var(--gold-deep);font-weight:700}
.intro{color:#333;max-width:860px;font-size:15px}
.cta{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 26px}.cta a{padding:11px 20px;border-radius:12px;font-weight:800;font-size:14px}
.cta .wa{background:#1F8F55;color:#fff}.cta .ph{border:1.5px solid var(--gold);color:var(--gold-deep)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.card{margin:0;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(59,36,20,.06)}
.card img{width:100%;aspect-ratio:4/3;object-fit:cover}.card figcaption{padding:10px 14px;font-size:13.5px}.card figcaption span{display:block;color:var(--dim);font-size:12px}.card figcaption b{display:block}
.others{margin:34px 0;padding:18px;background:var(--bg2);border-radius:16px}.others h2{font-size:17px;margin:0 0 10px}
.others div{display:flex;flex-wrap:wrap;gap:8px}.others a{border:1.5px solid var(--line);background:#fff;padding:7px 14px;border-radius:10px;font-weight:700;font-size:13px}.others a:hover{border-color:var(--gold)}
footer{background:#2A190D;color:#C9B08F;text-align:center;padding:24px;font-size:12.5px;margin-top:30px}footer b{color:var(--gold)}
.lbx{position:fixed;inset:0;background:rgba(20,17,13,.92);display:none;flex-direction:column;gap:14px;align-items:center;justify-content:center;z-index:99;padding:20px}.lbx.on{display:flex}.lbx img{max-height:82vh;border-radius:8px}
.pb{display:inline-flex;margin-top:8px;background:#1F8F55;color:#fff;font-weight:800;font-size:13px;padding:7px 14px;border-radius:10px}.pb:hover{background:#18744A}.lbx .pb{font-size:15px;padding:10px 20px}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<header><div class="hi">
  <a class="brand" href="/" style="display:flex;align-items:center;gap:10px"><img src="/img/site/243fa7c39e4b.jpg" alt="قيصر الشام" width="46" height="46" style="border-radius:6px"><span><b>قيصر الشام</b><span>للحجر والرخام · الجزائر</span></span></a>
  <nav><a href="/">الرئيسية</a><a href="/works" class="on">أعمالنا</a><a href="/videos">معرض الفيديو</a><a href="/#contact">تواصل معنا</a><a href="tel:${PHONE}" dir="ltr">0541.73.78.88</a><a href="/fr/${slug}" hreflang="fr" style="border:1.5px solid #D9B98C;border-radius:8px;padding:0 10px">FR</a></nav>
</div></header>
<main class="wrap">
  <div class="crumbs"><a href="/">الرئيسية</a> › <a href="/works">أعمالنا</a> › ${esc(ar)}</div>
  <h1>${esc(ar)}${fr ? `<small lang="fr">${esc(fr)}</small>` : ''}</h1>
  <p class="intro">في قيصر الشام للحجر والرخام نصمّم ${esc(ar)} من الحجر والرخام الطبيعي ونصنعها ونركّبها حسب المقاس والتصميم الذي يناسب منزلك أو مشروعك. نعرض هنا مجموعة من أعمالنا المنجزة في هذا القسم (${imgs.length} صورة). مقرّنا في دالي إبراهيم بالجزائر العاصمة، ونخدم جميع الولايات.</p>
  ${fr ? `<p class="intro" lang="fr" dir="ltr" style="text-align:left">${esc(fr)} : conception, fabrication et pose sur mesure en marbre et pierre naturelle par Cesar Al Cham, à Dely Ibrahim (Alger), partout en Algérie. Devis gratuit au 0541 73 78 88.</p>` : ''}
  <div class="cta"><a class="wa" href="https://wa.me/${WA}?text=${encodeURIComponent('السلام عليكم، أودّ الاستفسار عن ' + ar)}" rel="nofollow">اطلب عرض سعر على واتساب</a><a class="ph" href="tel:${PHONE}">اتصل: 0541.73.78.88</a></div>
  <section class="grid">${cards || '<p>ستُضاف الصور قريبًا.</p>'}
  </section>
  <section class="others"><h2>أقسام أخرى من أعمالنا</h2><div><a href="/works">جميع الأعمال</a>${others}</div></section>
</main>
<footer><b>قيصر الشام للحجر والرخام</b> — دالي إبراهيم، الجزائر — 0541.73.78.88</footer>
<div class="lbx" id="lbx"><img alt=""><a class="pb" target="_blank" rel="nofollow noopener" href="#">💬 اطلب السعر على واتساب</a></div>
<script>document.querySelectorAll('a.lb').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const l=document.getElementById('lbx');l.querySelector('img').src=a.href;const p=a.closest('figure').querySelector('.pb');l.querySelector('.pb').href=p?p.href:'#';l.classList.add('on')}));document.getElementById('lbx').addEventListener('click',e=>{if(!e.target.closest('.pb'))e.currentTarget.classList.remove('on')});</script>
</body>
</html>
`;
}

// ---------- main ----------
const docs = await loadDocs();
const settings = (docs.main && docs.main.settings) || {};
let items = [];
for (const [id, d] of Object.entries(docs)) if (id.startsWith('items_')) items = items.concat(d.items || []);
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

// works.html: صور ثابتة (Google بيشوفها قبل ما تشتغل الصفحة) وروابط الأقسام
const card = (it, c) => { const src = imgUrl(it); return src ? `<div class="card"><div class="img-wrap"><img src="${esc(src)}" loading="lazy" alt="${esc(altOf(it, c))}"></div><div class="body"><div class="title">${esc((it.title && splitName(it.title).ar) || splitName(c).ar)}</div><div class="meta">${esc(splitName(c).ar)}</div></div></div>` : ''; };
let w = rd('works.html');
w = inject(w, 'GALLERY', cats.map(c => card(byCat.get(c)[0], c).replace('<div class="card">', `<div class="card"><a href="/${slugs[c]}" style="display:contents">`).replace(/<\/div><\/div>$/, '</div></a></div>')).join(''));
w = inject(w, 'CATS', cats.map(c => `<li><a href="/${slugs[c]}">${esc(splitName(c).ar)}</a> <span>(${byCat.get(c).length})</span></li>`).join(''));
wr('works.html', w);

// videos.html: الفيديوهات ثابتة بالصفحة
let videos = [];
for (const [id, d] of Object.entries(docs)) if (id.startsWith('videos_')) videos = videos.concat(d.items || []);
videos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
let v = rd('videos.html');
v = inject(v, 'VIDEOS', videos.filter(x => /^https?:\/\//.test(x.url || '')).slice(0, 8).map(x => `<div class="card" style="cursor:default;"><div class="img-wrap" style="aspect-ratio:16/9; background:#000;"><video src="${esc(x.url)}" controls preload="none"${x.poster ? ` poster="${esc(x.poster)}"` : ''} style="width:100%; height:100%; object-fit:contain; background:#000;" title="${esc((x.title && splitName(x.title).ar) || splitName(x.category || '').ar || 'فيديو من أعمالنا')}"></video></div><div class="body"><div class="title">${esc((x.title && splitName(x.title).ar) || splitName(x.category || '').ar || 'فيديو من أعمالنا')}</div><div class="meta">${esc(splitName(x.category || '').ar)}</div></div></div>`).join('') || '<div class="empty-state">جاري تحميل الفيديوهات...</div>');
const vSchema = videos.filter(x => x.poster && /^https?:\/\//.test(x.url || '')).slice(0, 60).map(x => ({'@type':'VideoObject', name: (x.title && splitName(x.title).ar) || splitName(x.category || '').ar || 'فيديو من أعمال قيصر الشام', description: `${(x.title && splitName(x.title).ar) || splitName(x.category || '').ar || 'فيديو'} — من أعمال قيصر الشام للحجر والرخام، الجزائر`, thumbnailUrl: x.poster, contentUrl: x.url, uploadDate: new Date(x.createdAt || Date.now()).toISOString()}));
v = inject(v, 'VSCHEMA', vSchema.length ? `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':vSchema})}</script>` : '');
wr('videos.html', v);

// index.html: صورتين من كل قسم ثابتين
let h = rd('index.html');
const faq = ((docs.site_faq && docs.site_faq.items) || []).filter(x => x && x.q && x.a);
if (faq.length) {
  h = inject(h, 'FAQ', faq.map(x => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a).replace(/\n/g, '<br>')}</p></details>`).join('\n  '));
  h = inject(h, 'FAQSCHEMA', `<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(x => ({'@type':'Question',name:x.q,acceptedAnswer:{'@type':'Answer',text:x.a}}))}).replace(/</g,'\\u003c')}</script>`);
}
h = inject(h, 'SHOWCASE', cats.slice(0, 8).flatMap(c => byCat.get(c).slice(0, 1).map(it => ({it, c}))).map(({it, c}) => { const src = imgUrl(it); return src ? `<a href="/${slugs[c]}" class="sc-item"><img src="${esc(src)}" loading="lazy" alt="${esc(altOf(it, c))}"><span>${esc(splitName(c).ar)}</span></a>` : ''; }).join(''));
h = inject(h, 'CATLINKS', cats.map(c => `<a href="/${slugs[c]}">${esc(splitName(c).ar)}</a>`).join(''));
wr('index.html', h);

// ================= النسخة الفرنسية /fr =================
const REVIEW_URL = 'https://maps.app.goo.gl/g6wBPVBsZmQipM2j6';
const frOf = c => splitName(c).fr || (slugs[c] ? (t => t.charAt(0).toUpperCase() + t.slice(1))(slugs[c].replace(/^a3mal-/, '').replace(/-/g, ' ')) : splitName(c).ar);
const frTitle = (it, c) => (it.title && splitName(it.title).fr) || frOf(c);
const waFr = t => `https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
const reviews = ((docs.site_reviews && docs.site_reviews.items) || []).filter(r => r && r.text);
function frLayout({title, desc, path: pth, arPath, og, body, schema}){
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
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap" rel="stylesheet">
${schema ? `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>` : ''}
<style>
:root{--ink:#3B2414;--gold:#9A6A3A;--gold-deep:#6E4524;--line:#E6D6BC;--dim:#7A5C40;--bg2:#F5ECDD}
*{box-sizing:border-box}body{margin:0;font-family:'Cairo',Tahoma,sans-serif;color:#2E1C10;background:#FBF6EE;line-height:1.7}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block}
header{background:#3B2414;position:sticky;top:0;z-index:50}
.hi{max-width:1200px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.brand b{color:#D9B98C;font-size:20px;font-weight:900;display:block;line-height:1.2}.brand span{color:#E6D6BC;font-size:12px}
nav{display:flex;gap:16px;flex-wrap:wrap;align-items:center}nav a{color:#fff;font-weight:700;font-size:14px}nav a:hover,nav a.on{color:#D9B98C}nav .lang{border:1.5px solid #D9B98C;border-radius:8px;padding:1px 10px;color:#D9B98C}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px}
.crumbs{font-size:12.5px;color:var(--dim);padding:18px 0 0}.crumbs a{color:var(--gold-deep)}
h1{font-size:clamp(24px,4vw,38px);font-weight:900;margin:8px 0 6px;color:var(--ink)}h2{color:var(--ink)}
.intro{color:#4A2E1A;max-width:880px;font-size:15.5px}
.cta{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 26px}.cta a,.btn{display:inline-flex;align-items:center;gap:6px;padding:11px 20px;border-radius:12px;font-weight:800;font-size:14px;border:0;cursor:pointer;font-family:inherit}
.wa{background:#1F8F55;color:#fff}.ph{border:1.5px solid var(--gold);color:var(--gold-deep)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.card{margin:0;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(59,36,20,.06)}
.card img{width:100%;aspect-ratio:4/3;object-fit:cover}.card figcaption,.card .b{padding:10px 14px;font-size:14px}.card figcaption span{display:block;color:var(--dim);font-size:12px}.card figcaption b{display:block}
.pb{display:inline-flex;margin-top:8px;background:#1F8F55;color:#fff;font-weight:800;font-size:13px;padding:7px 14px;border-radius:10px}
.sec{margin:34px 0}.sec h2{font-size:24px;margin:0 0 14px}
.faq details{border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:10px 0;background:#fff}.faq summary{cursor:pointer;font-weight:800}
.rv{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}.rv div{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px}.rv b{display:block}.st{color:#E0A100;letter-spacing:2px}
.others{margin:34px 0;padding:18px;background:var(--bg2);border-radius:16px}.others div{display:flex;flex-wrap:wrap;gap:8px}.others a{border:1.5px solid var(--line);background:#fff;padding:7px 14px;border-radius:10px;font-weight:700;font-size:13px}
footer{background:#2A190D;color:#C9B08F;text-align:center;padding:24px;font-size:12.5px;margin-top:30px}footer b{color:#D9B98C}
.lbx{position:fixed;inset:0;background:rgba(20,17,13,.92);display:none;flex-direction:column;gap:14px;align-items:center;justify-content:center;z-index:99;padding:20px}.lbx.on{display:flex}.lbx img{max-height:82vh;border-radius:8px}
.hidden{display:none}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<header><div class="hi">
  <a class="brand" href="/fr/" style="display:flex;align-items:center;gap:10px"><img src="/img/site/fav-96.png" alt="Cesar Al Cham" width="46" height="46" style="border-radius:6px;background:#fff"><span><b>Cesar Al Cham</b><span>Marbre et pierre naturelle · Algérie</span></span></a>
  <nav><a href="/fr/"${pth==='/fr/'?' class="on"':''}>Accueil</a><a href="/fr/works"${pth.startsWith('/fr/works')||pth.startsWith('/fr/a3mal')?' class="on"':''}>Nos réalisations</a><a href="/fr/videos"${pth==='/fr/videos'?' class="on"':''}>Vidéos</a><a href="/fr/#contact">Contact</a><a href="tel:${PHONE}" dir="ltr">0541 73 78 88</a><a class="lang" href="${arPath}" hreflang="ar">العربية</a></nav>
</div></header>
<main class="wrap">${body}</main>
<footer><b>Cesar Al Cham — Marbre et Pierre</b> — 36, Route Nationale, Dely Ibrahim, Alger — 0541 73 78 88</footer>
<div class="lbx" id="lbx"><img alt=""><a class="pb" target="_blank" rel="nofollow noopener" href="#">💬 Demander le prix sur WhatsApp</a></div>
<script>document.querySelectorAll('a.lb').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const l=document.getElementById('lbx');l.querySelector('img').src=a.href;const p=a.closest('figure').querySelector('.pb');l.querySelector('.pb').href=p?p.href:'#';l.classList.add('on')}));document.getElementById('lbx').addEventListener('click',e=>{if(!e.target.closest('.pb'))e.currentTarget.classList.remove('on')});
const mb=document.getElementById('more');if(mb)mb.onclick=()=>{const h=[...document.querySelectorAll('.hidden')].slice(0,8);h.forEach(x=>x.classList.remove('hidden'));if(!document.querySelector('.hidden'))mb.remove()};</script>
</body>
</html>
`;
}
const frSlug = c => slugs[c];
fs.mkdirSync(path.join(ROOT, 'fr'), {recursive: true});
const reviewsHtml = (lang) => `<section class="sec" id="avis"><h2>${lang==='fr'?'Avis de nos clients':'آراء زبائننا'}</h2>
  <p>⭐ 4,3 / 5 — Google · <a class="pb" style="display:inline-flex" href="${REVIEW_URL}" target="_blank" rel="noopener">${lang==='fr'?'Laissez-nous un avis sur Google':'قيّمنا على غوغل'}</a></p>
  ${reviews.length ? `<div class="rv">${reviews.map(r => `<div><span class="st">${'★'.repeat(Math.max(1, Math.min(5, +r.stars || 5)))}</span><p style="margin:6px 0">${esc(r.text)}</p><b>${esc(r.name || '')}</b></div>`).join('')}</div>` : ''}</section>`;
// fr/<slug>
for (const c of cats) {
  const list = byCat.get(c), fr = frOf(c), slug = slugs[c];
  const imgs = list.map(it => ({it, src: imgUrl(it)})).filter(x => x.src);
  const cards = imgs.map(({it, src}) => `<figure class="card"><a href="${esc(src)}" class="lb"><img src="${esc(src)}" loading="lazy" alt="${esc((it.aiAltFr || frTitle(it, c)) + ' - Cesar Al Cham, marbre Algérie')}"></a><figcaption><b>${esc(frTitle(it, c))}</b>${[it.size].filter(Boolean).length ? `<span>${esc(it.size)}</span>` : ''}<a class="pb" target="_blank" rel="nofollow noopener" href="${esc(waFr('Bonjour, je voudrais connaître le prix de ce travail : ' + frTitle(it, c) + '\n' + abs(src)))}">💬 Demander le prix</a></figcaption></figure>`).join('');
  const others = cats.filter(x => x !== c).map(x => `<a href="/fr/${slugs[x]}">${esc(frOf(x))}</a>`).join('');
  wr(`fr/${slug}.html`, frLayout({title: `${fr} - Cesar Al Cham, marbre et pierre naturelle en Algérie`, desc: `${fr} : conception, fabrication et pose sur mesure en marbre et pierre naturelle par Cesar Al Cham, Dely Ibrahim (Alger). Devis gratuit au 0541 73 78 88.`, path: `/fr/${slug}`, arPath: `/${slug}`, og: imgs[0] ? abs(imgs[0].src) : '',
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
  <section class="grid">${cats.map(c => { const it = byCat.get(c)[0], src = imgUrl(it); return src ? `<a class="card" href="/fr/${slugs[c]}"><img src="${esc(src)}" loading="lazy" alt="${esc(frOf(c))}"><div class="b"><b>${esc(frOf(c))}</b><div style="color:var(--dim);font-size:12px">${byCat.get(c).length} photos</div></div></a>` : ''; }).join('')}</section>`}));
live.add('fr/works.html');
// fr/videos
const vids = videos.filter(x => /^https?:\/\//.test(x.url || ''));
wr('fr/videos.html', frLayout({title: 'Vidéos de nos réalisations - Cesar Al Cham', desc: 'Vidéos des travaux en marbre et pierre naturelle réalisés par Cesar Al Cham en Algérie.', path: '/fr/videos', arPath: '/videos',
  body: `<h1 style="margin-top:22px">Vidéos</h1><section class="grid">${vids.map((x, i) => { const t = (x.title && splitName(x.title).fr) || frOf(x.category || '') || 'Vidéo'; return `<div class="card${i >= 8 ? ' hidden' : ''}"><video src="${esc(x.url)}" controls preload="none"${x.poster ? ` poster="${esc(x.poster)}"` : ''} style="width:100%;aspect-ratio:16/9;background:#000"></video><div class="b"><b>${esc(t)}</b><br><a class="pb" target="_blank" rel="nofollow noopener" href="${esc(waFr('Bonjour, je voudrais connaître le prix de ce travail : ' + t))}">💬 Demander le prix</a></div></div>`; }).join('')}</section>${vids.length > 8 ? '<p style="text-align:center"><button id="more" class="btn ph" type="button">Voir plus de vidéos</button></p>' : ''}`}));
live.add('fr/videos.html');
// fr/index
const FAQ_FR = [['Où êtes-vous situés et quelles régions couvrez-vous ?','Notre atelier se trouve à Dely Ibrahim (Alger). Nous réalisons la conception, la fabrication et la pose dans toutes les wilayas d\'Algérie.'],['Quels travaux réalisez-vous en marbre et en pierre ?','Cheminées en marbre, vasques et bassins de hammam, fontaines, façades en pierre, tableaux de sol et muraux, colonnes, balustrades, encadrements de portes et fenêtres, et décoration de mosquées.'],['Travaillez-vous sur mesure ?','Oui, chaque pièce est conçue et fabriquée selon vos dimensions et le design choisi. Nous vous présentons un dessin avec les mesures avant la fabrication.'],['Quels types de marbre proposez-vous ?','Marbre et pierre naturelle en plusieurs couleurs : blanc italien (Carrare), beige égyptien, teintes foncées, ainsi que des pierres naturelles pour façades.'],['Comment obtenir un devis ?','Envoyez-nous sur WhatsApp au 0541 73 78 88 des photos du lieu et les mesures approximatives : nous vous répondons rapidement avec un devis.']];
const show = cats.slice(0, 8).map(c => { const it = byCat.get(c)[0], src = imgUrl(it); return src ? `<a class="card" href="/fr/${slugs[c]}"><img src="${esc(src)}" loading="lazy" alt="${esc(frOf(c))}"><div class="b"><b>${esc(frOf(c))}</b></div></a>` : ''; }).join('');
wr('fr/index.html', frLayout({title: 'Cesar Al Cham | Marbre et pierre naturelle - Algérie', desc: 'Cesar Al Cham, Dely Ibrahim (Alger) : conception, sculpture et pose de marbre et pierre naturelle — cheminées, fontaines, vasques, façades, colonnes. Devis gratuit au 0541 73 78 88.', path: '/fr/', arPath: '/',
  schema: [{'@context':'https://schema.org','@type':'HomeAndConstructionBusiness',name:'Cesar Al Cham — Marbre et Pierre',url:SITE + '/fr/',telephone:'+213541737888',image:SITE + '/img/site/og-card.jpg',address:{'@type':'PostalAddress',streetAddress:'36, Route Nationale',addressLocality:'Dely Ibrahim',addressRegion:'Alger',addressCountry:'DZ'},aggregateRating:{'@type':'AggregateRating',ratingValue:'4.3',reviewCount:'6'}},{'@context':'https://schema.org','@type':'FAQPage',mainEntity:FAQ_FR.map(([q,a]) => ({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}],
  body: `<section style="text-align:center;padding:40px 0 10px"><h1>Marbre et pierre naturelle d'exception</h1><p class="intro" style="margin:0 auto">Conception, sculpture et pose de marbre et de pierre naturelle avec savoir-faire — depuis Dely Ibrahim (Alger), partout en Algérie, pour des projets élégants et haut de gamme.</p>
  <div class="cta" style="justify-content:center"><a class="wa" href="${esc(waFr('Bonjour, je souhaite un devis de Cesar Al Cham.'))}" rel="nofollow">Demander un devis sur WhatsApp</a><a class="ph" href="/fr/works">Voir nos réalisations</a></div></section>
  <section class="sec"><h2>Nos réalisations</h2><div class="grid">${show}</div><p style="text-align:center;margin-top:16px"><a class="btn ph" href="/fr/works">Toutes nos réalisations</a></p></section>
  ${reviewsHtml('fr')}
  <section class="sec faq"><h2>Questions fréquentes</h2>${FAQ_FR.map(([q,a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>
  <section class="sec" id="contact"><h2>Contact</h2><p>📞 <a href="tel:${PHONE}" dir="ltr"><b>0541 73 78 88</b></a> · WhatsApp : <a href="https://wa.me/${WA}" style="color:#1F8F55;font-weight:800">écrivez-nous</a><br>📍 36, Route Nationale, Dely Ibrahim, Alger — <a href="https://www.google.com/maps?cid=9304963512715322872" target="_blank" style="color:var(--gold-deep)">voir sur Google Maps ↗</a></p></section>`}));
live.add('fr/index.html');

// sitemap مع الصور
const today = new Date().toISOString().slice(0, 10);
const day = t => t ? new Date(t).toISOString().slice(0, 10) : today;
const lastOf = list => day(Math.max(0, ...list.map(it => it.createdAt || 0)) || 0);
const urlE = (loc, lm, pr, imgs = []) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lm}</lastmod>\n    <priority>${pr}</priority>\n${imgs.slice(0, 50).map(x => `    <image:image><image:loc>${esc(abs(x.src))}</image:loc><image:title>${esc(x.title)}</image:title></image:image>\n`).join('')}  </url>`;
const imgsOf = (list, c) => list.map(it => ({src: imgUrl(it), title: altOf(it, c)})).filter(x => x.src);
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[urlE(SITE + '/', lastOf(items), '1.0'), urlE(SITE + '/works', lastOf(items), '0.9', items.slice(0, 50).map(it => ({src: imgUrl(it), title: altOf(it, String(it.category || '').trim())})).filter(x => x.src)), urlE(SITE + '/videos', today, '0.7'),
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
