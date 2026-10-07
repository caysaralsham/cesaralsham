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
const splitName = c => { const [ar, fr] = String(c).split('|').map(x => x.trim()); return {ar: ar || c, fr: fr || ''}; };

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
const altOf = (it, cat) => `${it.title || splitName(cat).ar} - قيصر الشام للحجر والرخام${splitName(cat).fr ? ' - ' + splitName(cat).fr : ''}`;

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
  const ogImg = imgs[0] ? abs(imgs[0].src) : SITE + '/og-image.jpg';
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
        <figcaption><b>${esc(it.title || ar)}</b>${[it.size, it.color, it.type].filter(Boolean).length ? `<span>${esc([it.size, it.color, it.type].filter(Boolean).join(' · '))}</span>` : ''}<a class="pb" href="${esc(waPrice(it.title || ar, abs(src)))}" target="_blank" rel="nofollow noopener">💬 اطلب السعر</a></figcaption></figure>`).join('');
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/${slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/${slug}">
<meta property="og:image" content="${esc(ogImg)}">
<meta property="og:locale" content="ar_DZ">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="shortcut icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
:root{--ink:#111;--gold:#B88A2A;--gold-deep:#8F6A1F;--line:#ECE8E0;--dim:#666;--bg2:#FAF9F7}
*{box-sizing:border-box}body{margin:0;font-family:'Cairo',Tahoma,sans-serif;color:#1A1A1A;background:#fff;line-height:1.7}
a{color:inherit;text-decoration:none}img{max-width:100%;display:block}
header{background:#111;position:sticky;top:0;z-index:50}
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
.card{margin:0;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(17,17,17,.06)}
.card img{width:100%;aspect-ratio:4/3;object-fit:cover}.card figcaption{padding:10px 14px;font-size:13.5px}.card figcaption span{display:block;color:var(--dim);font-size:12px}
.others{margin:34px 0;padding:18px;background:var(--bg2);border-radius:16px}.others h2{font-size:17px;margin:0 0 10px}
.others div{display:flex;flex-wrap:wrap;gap:8px}.others a{border:1.5px solid var(--line);background:#fff;padding:7px 14px;border-radius:10px;font-weight:700;font-size:13px}.others a:hover{border-color:var(--gold)}
footer{background:#0c0c0c;color:#8a8270;text-align:center;padding:24px;font-size:12.5px;margin-top:30px}footer b{color:var(--gold)}
.lbx{position:fixed;inset:0;background:rgba(20,17,13,.92);display:none;flex-direction:column;gap:14px;align-items:center;justify-content:center;z-index:99;padding:20px}.lbx.on{display:flex}.lbx img{max-height:82vh;border-radius:8px}
.pb{display:inline-flex;margin-top:8px;background:#1F8F55;color:#fff;font-weight:800;font-size:13px;padding:7px 14px;border-radius:10px}.pb:hover{background:#18744A}.lbx .pb{font-size:15px;padding:10px 20px}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<header><div class="hi">
  <a class="brand" href="/" style="display:flex;align-items:center;gap:10px"><img src="/img/site/243fa7c39e4b.jpg" alt="قيصر الشام" width="46" height="46" style="border-radius:6px"><span><b>قيصر الشام</b><span>للحجر والرخام · الجزائر</span></span></a>
  <nav><a href="/">الرئيسية</a><a href="/works" class="on">أعمالنا</a><a href="/videos">معرض الفيديو</a><a href="/#contact">تواصل معنا</a><a href="tel:${PHONE}" dir="ltr">0541.73.78.88</a></nav>
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
const card = (it, c) => { const src = imgUrl(it); return src ? `<div class="card"><div class="img-wrap"><img src="${esc(src)}" loading="lazy" alt="${esc(altOf(it, c))}"></div><div class="body"><div class="title">${esc(it.title || splitName(c).ar)}</div><div class="meta">${esc(splitName(c).ar)}</div></div></div>` : ''; };
let w = rd('works.html');
w = inject(w, 'GALLERY', cats.map(c => card(byCat.get(c)[0], c).replace('<div class="card">', `<div class="card"><a href="/${slugs[c]}" style="display:contents">`).replace(/<\/div><\/div>$/, '</div></a></div>')).join(''));
w = inject(w, 'CATS', cats.map(c => `<li><a href="/${slugs[c]}">${esc(splitName(c).ar)}</a> <span>(${byCat.get(c).length})</span></li>`).join(''));
wr('works.html', w);

// videos.html: الفيديوهات ثابتة بالصفحة
let videos = [];
for (const [id, d] of Object.entries(docs)) if (id.startsWith('videos_')) videos = videos.concat(d.items || []);
videos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
let v = rd('videos.html');
v = inject(v, 'VIDEOS', videos.filter(x => /^https?:\/\//.test(x.url || '')).slice(0, 8).map(x => `<div class="card" style="cursor:default;"><div class="img-wrap" style="aspect-ratio:16/9; background:#000;"><video src="${esc(x.url)}" controls preload="none"${x.poster ? ` poster="${esc(x.poster)}"` : ''} style="width:100%; height:100%; object-fit:contain; background:#000;" title="${esc(x.title || splitName(x.category || '').ar || 'فيديو من أعمالنا')}"></video></div><div class="body"><div class="title">${esc(x.title || splitName(x.category || '').ar || 'فيديو من أعمالنا')}</div><div class="meta">${esc(splitName(x.category || '').ar)}</div></div></div>`).join('') || '<div class="empty-state">جاري تحميل الفيديوهات...</div>');
const vSchema = videos.filter(x => x.poster && /^https?:\/\//.test(x.url || '')).slice(0, 60).map(x => ({'@type':'VideoObject', name: x.title || splitName(x.category || '').ar || 'فيديو من أعمال قيصر الشام', description: `${x.title || splitName(x.category || '').ar || 'فيديو'} — من أعمال قيصر الشام للحجر والرخام، الجزائر`, thumbnailUrl: x.poster, contentUrl: x.url, uploadDate: new Date(x.createdAt || Date.now()).toISOString()}));
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

// sitemap مع الصور
const today = new Date().toISOString().slice(0, 10);
const day = t => t ? new Date(t).toISOString().slice(0, 10) : today;
const lastOf = list => day(Math.max(0, ...list.map(it => it.createdAt || 0)) || 0);
const urlE = (loc, lm, pr, imgs = []) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lm}</lastmod>\n    <priority>${pr}</priority>\n${imgs.slice(0, 50).map(x => `    <image:image><image:loc>${esc(abs(x.src))}</image:loc><image:title>${esc(x.title)}</image:title></image:image>\n`).join('')}  </url>`;
const imgsOf = (list, c) => list.map(it => ({src: imgUrl(it), title: altOf(it, c)})).filter(x => x.src);
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[urlE(SITE + '/', lastOf(items), '1.0'), urlE(SITE + '/works', lastOf(items), '0.9', items.slice(0, 50).map(it => ({src: imgUrl(it), title: altOf(it, String(it.category || '').trim())})).filter(x => x.src)), urlE(SITE + '/videos', today, '0.7'),
  ...cats.map(c => urlE(`${SITE}/${slugs[c]}`, lastOf(byCat.get(c)), '0.8', imgsOf(byCat.get(c), c)))].join('\n')}
</urlset>
`;
// ما منغيّر التاريخ إذا ما في شي جديد
const old = fs.existsSync(path.join(ROOT, 'sitemap.xml')) ? rd('sitemap.xml') : '';
const strip = s => s.replace(/<lastmod>[^<]*<\/lastmod>/g, '');
if (strip(old) !== strip(sm)) wr('sitemap.xml', sm);
console.log('categories:', cats.length, 'items:', items.length, 'videos:', videos.length);
