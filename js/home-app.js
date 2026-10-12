const localDate = (d=new Date()) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); // تاريخ الجزائر وليس غرينتش
// كود الصفحة الرئيسية (Firebase، المعرض، لوحة الإعدادات...)
// يُحمَّل بعد اكتمال ظهور الصفحة عبر المحمِّل الموجود في آخر index.html
const firebaseConfig = {
  apiKey: "AIzaSyDi1Pn7guMnyc0CetV8Z9IUC-k0gtav2_8",
  authDomain: "basel-7b29b.firebaseapp.com",
  projectId: "basel-7b29b",
  storageBucket: "basel-7b29b.firebasestorage.app",
  messagingSenderId: "1025769465563",
  appId: "1:1025769465563:web:53b5c9949dbb26364d8efe"
};
firebase.initializeApp(firebaseConfig);
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
let authReady = false;
let authReadyResolvers = [];
firebase.auth().onAuthStateChanged(()=>{
  authReady = true;
  authReadyResolvers.forEach(r=>r());
  authReadyResolvers = [];
});
function waitForAuthReady(){
  if(authReady) return Promise.resolve();
  return new Promise(res => authReadyResolvers.push(res));
}
const db = firebase.firestore();

// عدّاد زيارات بسيط: كل ما حدا يفتح الصفحة، بنزيد عدّاد يوم اليوم بـ Firestore
(function trackVisit(){
  // العدّاد بيُرسل بطلب HTTP عادي (REST) بدل اتصال Firestore المفتوح،
  // حتى ما يضل اتصال معلّق يسبب أخطاء ERR_TIMED_OUT في PageSpeed.
  const today = localDate(); // YYYY-MM-DD بتوقيت الجهاز
  const ROOT = 'projects/' + firebaseConfig.projectId + '/databases/(default)/documents';
  const URL = 'https://firestore.googleapis.com/v1/' + ROOT + ':commit?key=' + firebaseConfig.apiKey;
  const inc = firebase.firestore.FieldValue.increment;
  function viaSdk(data){ // احتياط: إذا فشل الطلب العادي نرجع للطريقة القديمة
    return db.collection('cesar_stats').doc(today).set(data, {merge:true}).catch(()=>{});
  }
  function send(fieldPath, sdkData){
    const body = {writes:[{
      update: {name: ROOT + '/cesar_stats/' + today, fields: {date: {stringValue: today}}},
      updateMask: {fieldPaths: ['date']},
      updateTransforms: [{fieldPath: fieldPath, increment: {integerValue: '1'}}]
    }]};
    return fetch(URL, {method:'POST', keepalive:true, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)})
      .then(r => { if(!r.ok) return viaSdk(sdkData); })
      .catch(() => viaSdk(sdkData));
  }
  const pCount = send('count', {date: today, count: inc(1)});

  // تحديد الدولة من عنوان IP (خدمة مجانية بدون مفتاح API) — بحد أقصى 5 ثواني
  const ctl = ('AbortController' in window) ? new AbortController() : null;
  if(ctl) setTimeout(()=>ctl.abort(), 5000);
  const pGeo = fetch('https://ipwho.is/', ctl ? {signal: ctl.signal} : undefined)
    .then(r => r.json())
    .then(geo => {
      let code = (geo && geo.country_code) ? String(geo.country_code).toUpperCase() : 'XX';
      if(!/^[A-Z]{2}$/.test(code)) code = 'XX';
      return send('countries.' + code, {date: today, countries: {[code]: inc(1)}});
    })
    .catch(()=>{ /* صامت إذا الخدمة ما ردّت أو تجاوزنا الحد المجاني */ });
  window.__visitDone = Promise.all([pCount, pGeo]);
})();
const storage = firebase.storage();
const FS_COLLECTION = 'cesar_website';
const FS_DOC = 'main';
// الصور تتخزن بمستندات منفصلة (items_0, items_1...) بدل مستند واحد كبير،
// لأن Firestore بيرفض أي مستند أكبر من 1 ميجابايت — هيك نتجنب هالحد
// حتى لو صار عندنا مئات الصور بدقة عالية.
const LOGO_SRC = "/img/site/243fa7c39e4b.jpg";
const CHUNK_PREFIX = 'items_';
const VCHUNK_PREFIX = 'videos_';
const CHUNK_MAX_BYTES = 850000;
let chunkCache = {};
let chunkOf = {};
let videos = [];

const DEFAULT_ITEMS = [
  {id:'seed1', title:'مدفأة رخام كارارا', size:'2.10 × 1.20 م', color:'أبيض', type:'رخام كارارا', price:'', img:'/img/site/77c326af3e6f.jpg'},
  {id:'seed2', title:'مغسلة رخام', size:'1.80 × 0.60 م', color:'رمادي مموج', type:'رخام', price:'', img:'/img/site/6020303a9a12.jpg'},
  {id:'seed3', title:'أرضية موزاييك دائري', size:'قطر 1.20 م', color:'بيج وأسود', type:'رخام مقطّع', price:'', img:'/img/site/86867476d217.jpg'},
  {id:'seed4', title:'عمود منحوت — ريشة', size:'3.00 م ارتفاع', color:'بيج', type:'حجر طبيعي', price:'', img:'/img/site/133257570835.jpg'},
  {id:'seed5', title:'حائط منحوت زخرفي', size:'2.40 × 1.80 م', color:'بيج فاتح', type:'حجر منحوت', price:'', img:'/img/site/ea4bf2bd4987.jpg'}
];
const DEFAULT_SETTINGS = {
  facebook:'', instagram:'', tiktok:'', whatsapp:'213541737888', domainExpiry:'',
  heroTitleMain:'أرقى أنواع',
  heroTitleAccent:'الحجر والرخام',
  heroSubtitle:'تصاميم ونحت وتركيب الرخام والحجر الطبيعي بخبرة عالية — من دالي إبراهيم، الجزائر، لمشاريع فاخرة بتفاصيل مميزة. Conception, sculpture et pose de marbre et pierre naturelle avec expertise — à Dely Ibrahim, Alger, pour des projets élégants et haut de gamme.',
  aboutTitle:'من نحن',
  aboutText:'قيصر الشام للحجر والرخام — شركة جزائرية متخصصة في تصميم ونحت وتركيب الحجر والرخام بأعلى معايير الجودة، من المداخن والمغاسل إلى الأعمدة والحوائط المنحوتة. نجمع بين الحرفية التقليدية والدقة الحديثة لنقدم قطعاً تدوم.',
  contactTagline:'لأي استفسار أو طلب عرض سعر، نحن في خدمتكم دائمًا'
};

let items = [];
let settings = {...DEFAULT_SETTINGS};
const SETTINGS_CACHE_KEY = 'cesar_settings_cache_v1';
let fbReady = false;

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2600);
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

const SOCIAL_SVG = {
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.14h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.22-8.24 8.22zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.24-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.23.24-.85.83-.85 2.03 0 1.19.87 2.34.99 2.51.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.13 8.44 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99C18.34 21.13 22 16.99 22 12z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 2h-3.2v13.6a2.9 2.9 0 1 1-2.06-2.78V9.6a6.1 6.1 0 1 0 5.26 6.05V8.32a7.6 7.6 0 0 0 4.5 1.46V6.6a4.4 4.4 0 0 1-4.5-4.6z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.5V8.5L15.8 12l-6.2 3.5z"/></svg>'
};
function renderSocialIcons(){
  const links = [
    {url: settings.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/[^0-9]/g,'')}` : '', icon:SOCIAL_SVG.whatsapp, label:'واتساب'},
    {url: settings.facebook, icon:SOCIAL_SVG.facebook, label:'فيسبوك'},
    {url: settings.instagram, icon:SOCIAL_SVG.instagram, label:'انستغرام'},
    {url: settings.tiktok, icon:SOCIAL_SVG.tiktok, label:'تيك توك'},
    {url: settings.youtube, icon:SOCIAL_SVG.youtube, label:'يوتيوب'}
  ].filter(l => l.url);
  const html = links.map(l => `<a href="${l.url}" target="_blank" title="${l.label}">${l.icon}</a>`).join('');
  document.getElementById('headerSocial').innerHTML = html;
  document.getElementById('footerSocial').innerHTML = html;
  document.getElementById('contactWhatsapp').href = `https://wa.me/${(settings.whatsapp||'213541737888').replace(/[^0-9]/g,'')}`;
  renderBusinessSchema();
}

function renderBusinessSchema(){
  const sameAs = [settings.facebook, settings.instagram, settings.tiktok, settings.youtube].filter(Boolean);
  const schema = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "name": "قيصر الشام للحجر والرخام",
    "alternateName": "Cesar Al Cham Marbre et Pierre",
    "description": "شركة جزائرية متخصصة في تصميم ونحت وتركيب الحجر والرخام - Entreprise algérienne spécialisée dans le marbre et la pierre naturelle.",
    "telephone": "+213541737888",
  "image": "https://cesar-alcham.com/img/site/og-card.jpg",
    "address": { "@type": "PostalAddress", "streetAddress": "36 Route Nationale", "addressLocality": "دالي إبراهيم", "postalCode": "16320", "addressCountry": "DZ" },
    "areaServed": "DZ",
    "hasMap": "https://www.google.com/maps?cid=9304963512715322872",
    "url": "https://cesar-alcham.com"
  };
  if(sameAs.length) schema.sameAs = sameAs;
  document.getElementById('businessSchema').textContent = JSON.stringify(schema);
}

let activeCategory = 'all';

function renderCategoryFilters(){
  const cats = [...new Set(items.map(it => (it.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));

  const newOpt = '<option value="__new__">➕ قسم جديد...</option>';
  const catOpts = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  ['upCategorySelect','editCategorySelect'].forEach(id=>{
    const sel = document.getElementById(id);
    if(sel){ const cur = sel.value; sel.innerHTML = newOpt + catOpts; if(cats.includes(cur)) sel.value = cur; }
  });

  // تعبئة قائمة الأقسام المنسدلة تحت "أعمالنا" بالقائمة العلوية — بتوديك لصفحة أعمالنا الكاملة مفلترة
  const nd = document.getElementById('navCategoryDropdown');
  if(nd){
    if(cats.length){
      nd.innerHTML = `<a href="/works" style="display:block; padding:8px 12px; color:#E6D6BC; font-size:14px; border-radius:6px;">كل الأقسام</a>` +
        cats.map(c => `<a href="/works?category=${encodeURIComponent(c)}" style="display:block; padding:8px 12px; color:#E6D6BC; font-size:14px; border-radius:6px;">${c}</a>`).join('');
    } else {
      nd.innerHTML = '';
    }
  }

  renderCategoryManager(cats);
}

function renderCategoryManager(cats){
  const wrap = document.getElementById('categoryManager');
  if(!wrap) return;
  if(!cats.length){
    wrap.innerHTML = '<div style="font-size:12px; color:var(--text-dim);">لا توجد أقسام بعد.</div>';
    return;
  }
  wrap.innerHTML = cats.map(c => {
    const count = items.filter(it => (it.category||'').trim() === c).length;
    return `<div style="display:flex; align-items:center; gap:8px; padding:8px 10px; background:var(--cream-2); border-radius:8px; margin-bottom:6px;">
      <div style="flex:1; font-size:13px;">${c} <span style="color:var(--text-dim); font-size:11.5px;">(${count} صورة)</span></div>
      <button type="button" class="btn-ghost btn-sm" onclick="renameCategory('${c.replace(/'/g,"\\'")}')" title="تعديل الاسم">✎</button>
      <button type="button" class="btn-ghost btn-sm" onclick="deleteCategory('${c.replace(/'/g,"\\'")}')" title="حذف القسم">🗑</button>
    </div>`;
  }).join('');
}

async function renameCategory(oldName){
  const newName = prompt('اكتب الاسم الجديد للقسم:', oldName);
  if(newName === null) return;
  const trimmed = newName.trim();
  if(!trimmed){ toast('الاسم ما ينفع يكون فاضي'); return; }
  if(trimmed === oldName) return;
  items = items.map(it => (it.category||'').trim() === oldName ? {...it, category: trimmed} : it);
  await chunkAndWriteItems(items);
  renderCategoryFilters();
  renderAdminList();
  toast('تم تعديل اسم القسم');
}

async function deleteCategory(name){
  const count = items.filter(it => (it.category||'').trim() === name).length;
  if(!confirm(`حذف قسم "${name}"؟ (${count} صورة) — الصور رح تضل موجودة بس بدون قسم، لازم تعطيها قسم جديد لاحقًا.`)) return;
  items = items.map(it => (it.category||'').trim() === name ? {...it, category: ''} : it);
  await chunkAndWriteItems(items);
  renderCategoryFilters();
  renderAdminList();
  toast('تم حذف القسم');
}

async function askAboutItem(id){
  const it = items.find(x => x.id === id);
  if(!it) return;
  const waText = `مرحباً، أنا مهتم بـ "${it.title || 'هذه القطعة'}" التي شاهدتها في موقعكم — هل يمكنني معرفة السعر والتفاصيل؟`;

  // على الهاتف: نحاول نفتح قائمة مشاركة حقيقية فيها الصورة + النص مع بعض
  if(navigator.canShare){
    try{
      const res = await fetch(it.img);
      const blob = await res.blob();
      const file = new File([blob], (it.title || 'قطعة') + '.jpg', {type: blob.type || 'image/jpeg'});
      if(navigator.canShare({files:[file]})){
        await navigator.share({ files:[file], text: waText, title: it.title || 'قيصر الشام' });
        return;
      }
    }catch(e){ console.error(e); }
  }
  // بديل (كمبيوتر أو لو المشاركة مش مدعومة): واتساب بالنص + رابط الصورة
  const waTextWithLink = waText + `\n${it.img}`;
  window.open(`https://wa.me/${(settings.whatsapp||'213541737888').replace(/[^0-9]/g,'')}?text=${encodeURIComponent(waTextWithLink)}`, '_blank');
}

function openLightbox(imgUrl){
  document.getElementById('lightboxImg').src = imgUrl;
  document.getElementById('lightboxOverlay').style.display = 'flex';
}
function closeLightbox(){
  document.getElementById('lightboxOverlay').style.display = 'none';
}
document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightboxOverlay').addEventListener('click', (e)=>{
  if(e.target.id === 'lightboxOverlay') closeLightbox();
});

window.addEventListener('scroll', ()=>{
  const h = document.querySelector('header');
  if(window.scrollY > 12) h.classList.add('scrolled');
  else h.classList.remove('scrolled');
}, {passive:true});

if('IntersectionObserver' in window){
  const revealObserver = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {threshold:0.12});
  document.querySelectorAll('.reveal, .feature-card').forEach(el=> revealObserver.observe(el));

  // تحديد الرابط الفعّال في القائمة العلوية حسب القسم الظاهر توا بالشاشة
  const navLinksBySection = {};
  document.querySelectorAll('#navRow nav a[href^="#"]').forEach(a=>{
    navLinksBySection[a.getAttribute('href').slice(1)] = a;
  });
  const spySections = Object.keys(navLinksBySection).map(id=> document.getElementById(id)).filter(Boolean);
  if(spySections.length){
    const spyObserver = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          Object.values(navLinksBySection).forEach(a=> a.classList.remove('active'));
          const link = navLinksBySection[entry.target.id];
          if(link) link.classList.add('active');
        }
      });
    }, {rootMargin:'-40% 0px -55% 0px', threshold:0});
    spySections.forEach(sec=> spyObserver.observe(sec));
  }
}

const burgerBtn = document.getElementById('burgerBtn');
const navRow = document.getElementById('navRow');
burgerBtn.addEventListener('click', ()=>{
  navRow.classList.toggle('open');
});
navRow.querySelectorAll('nav a[href^="#"]').forEach(a=>{
  a.addEventListener('click', (e)=>{
    e.preventDefault();
    navRow.classList.remove('open');
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
  });
});
document.querySelectorAll('a.btn[href^="#"]').forEach(a=>{
  a.addEventListener('click', (e)=>{
    e.preventDefault();
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
  });
});

function renderAdminList(){
  const wrap = document.getElementById('adminList');
  if(!items.length){ wrap.innerHTML = '<div style="font-size:12.5px; color:var(--text-dim);">لا توجد صور بعد.</div>'; return; }
  wrap.innerHTML = items.map(it => `
    <div class="admin-item">
      <img src="${it.img}">
      <div class="info"><b>${it.title || '(بدون عنوان)'}</b>${it.size||''} ${it.color? '· '+it.color:''}</div>
      <button onclick="openEditItem('${it.id}')" title="تعديل">✏️</button>
      <button onclick="deleteItem('${it.id}')" title="حذف">🗑</button>
    </div>
  `).join('');
}

async function saveSettings(fields){
  // نحفظ بس الحقول المحدّدة (مش الإعدادات كاملة)، حتى لو التحميل الأولي ما خلص لسا،
  // ما ينمسح أي قسم تاني بالغلط.
  if(typeof fields !== 'object' || fields === null) fields = settings;
  const update = {};
  Object.keys(fields).forEach(k => { update['settings.' + k] = fields[k]; });
  await db.collection(FS_COLLECTION).doc(FS_DOC).set(update, {merge:true});
}

function byteLen(obj){ return JSON.stringify(obj).length; }

async function chunkAndWriteItems(itemsArray){
  const chunks = [];
  let current = [], currentSize = 0;
  itemsArray.forEach(it=>{
    const size = byteLen(it);
    if(current.length && currentSize + size > CHUNK_MAX_BYTES){
      chunks.push(current); current = []; currentSize = 0;
    }
    current.push(it); currentSize += size;
  });
  if(current.length) chunks.push(current);
  for(let i=0;i<chunks.length;i++){
    await db.collection(FS_COLLECTION).doc(CHUNK_PREFIX+i).set({items: chunks[i]});
  }
}

async function saveNewItem(item){
  if(!fbReady) return;
  try{
    const ids = Object.keys(chunkCache).sort((a,b)=>
      parseInt(a.slice(CHUNK_PREFIX.length)) - parseInt(b.slice(CHUNK_PREFIX.length)));
    let targetId = ids.length ? ids[ids.length-1] : CHUNK_PREFIX+'0';
    let targetItems = chunkCache[targetId] ? [...chunkCache[targetId]] : [];
    const currentSize = targetItems.reduce((s,it)=>s+byteLen(it), 0);
    if(targetItems.length && currentSize + byteLen(item) > CHUNK_MAX_BYTES){
      const nextIndex = ids.length ? parseInt(targetId.slice(CHUNK_PREFIX.length)) + 1 : 0;
      targetId = CHUNK_PREFIX + nextIndex;
      targetItems = [];
    }
    targetItems.push(item);
    await db.collection(FS_COLLECTION).doc(targetId).set({items: targetItems});
  }catch(e){ console.error(e); toast('تعذر حفظ الصورة على السحابة'); }
}

async function removeItemCloud(id){
  if(!fbReady) return;
  const chunkId = chunkOf[id];
  if(!chunkId) return;
  const remaining = (chunkCache[chunkId]||[]).filter(it=>it.id !== id);
  try{
    if(remaining.length){
      await db.collection(FS_COLLECTION).doc(chunkId).set({items: remaining});
    } else {
      await db.collection(FS_COLLECTION).doc(chunkId).delete();
    }
  }catch(e){ console.error(e); toast('تعذر الحذف من السحابة'); }
}

async function updateItemInCloud(updatedItem){
  if(!fbReady) return;
  const chunkId = chunkOf[updatedItem.id];
  if(!chunkId) return;
  const updated = (chunkCache[chunkId]||[]).map(it => it.id === updatedItem.id ? updatedItem : it);
  try{
    await db.collection(FS_COLLECTION).doc(chunkId).set({items: updated});
  }catch(e){ console.error(e); toast('تعذر حفظ التعديل'); }
}

let editingItemId = null;

function setupCategorySelect(selectId, inputId, initialCategory){
  const sel = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  if(initialCategory && [...sel.options].some(o=>o.value===initialCategory)){
    sel.value = initialCategory;
    input.value = initialCategory;
    input.style.display = 'none';
  } else {
    sel.value = '__new__';
    input.value = initialCategory || '';
    input.style.display = '';
  }
}
document.getElementById('upCategorySelect').addEventListener('change', ()=>{
  const sel = document.getElementById('upCategorySelect');
  const input = document.getElementById('upCategory');
  if(sel.value === '__new__'){ input.value=''; input.style.display=''; input.focus(); }
  else { input.value = sel.value; input.style.display = 'none'; }
});
document.getElementById('editCategorySelect').addEventListener('change', ()=>{
  const sel = document.getElementById('editCategorySelect');
  const input = document.getElementById('editCategory');
  if(sel.value === '__new__'){ input.value=''; input.style.display=''; input.focus(); }
  else { input.value = sel.value; input.style.display = 'none'; }
});

function openEditItem(id){
  const it = items.find(x => x.id === id);
  if(!it) return;
  editingItemId = id;
  document.getElementById('editItemPreview').src = it.img;
  document.getElementById('editTitle').value = it.title || '';
  setupCategorySelect('editCategorySelect', 'editCategory', it.category || '');
  document.getElementById('editSize').value = it.size || '';
  document.getElementById('editColor').value = it.color || '';
  document.getElementById('editType').value = it.type || '';
  document.getElementById('editPrice').value = it.price || '';
  document.getElementById('editItemOverlay').classList.add('show');
}
document.getElementById('btnSaveEditItem').addEventListener('click', async ()=>{
  const it = items.find(x => x.id === editingItemId);
  if(!it) return;
  const chosenCategory = document.getElementById('editCategory').value.trim();
  if(!chosenCategory){ toast('يرجى اختيار أو كتابة القسم قبل الحفظ (مثال: شمينة، حمام...)'); return; }
  const updated = {
    ...it,
    title: document.getElementById('editTitle').value.trim(),
    category: chosenCategory,
    size: document.getElementById('editSize').value.trim(),
    color: document.getElementById('editColor').value.trim(),
    type: document.getElementById('editType').value.trim(),
    price: document.getElementById('editPrice').value.trim(),
  };
  items = items.map(x => x.id === editingItemId ? updated : x);
  renderAdminList();
  renderHomeShowcase();
  document.getElementById('editItemOverlay').classList.remove('show');
  await updateItemInCloud(updated);
  toast('تم حفظ التعديلات');
});

document.getElementById('btnAddWatermark').addEventListener('click', ()=>{
  if(!editingItemId) return;
  document.getElementById('watermarkFileInput').value = '';
  document.getElementById('watermarkFileInput').click();
});

document.getElementById('watermarkFileInput').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const it = items.find(x => x.id === editingItemId);
  if(!it) return;
  const btn = document.getElementById('btnAddWatermark');
  const originalLabel = btn.textContent;
  btn.textContent = 'جارٍ الإضافة...';
  btn.disabled = true;
  try{
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((res, rej)=>{
      img.onload = res;
      img.onerror = () => rej(new Error('تعذر فتح الصورة المختارة'));
      img.src = objectUrl;
    });
    const maxW = 1800;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(objectUrl);
    await drawWatermark(ctx, w, h);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
    const storageRef = storage.ref('gallery/' + it.id + '.jpg');
    await storageRef.put(blob, { contentType: 'image/jpeg' });
    const imgUrl = await storageRef.getDownloadURL();
    const updated = { ...it, img: imgUrl };
    items = items.map(x => x.id === it.id ? updated : x);
    renderAdminList();
    renderHomeShowcase();
    document.getElementById('editItemPreview').src = imgUrl;
    await updateItemInCloud(updated);
    toast('تمت إضافة الشعار على الصورة');
  }catch(e){
    console.error(e);
    toast('تعذّرت إضافة الشعار على هذه الصورة');
  }finally{
    btn.textContent = originalLabel;
    btn.disabled = false;
  }
});

// الزوار: قراءة واحدة ثم إغلاق اتصال Firestore (بدون اتصال مفتوح يسبب أخطاء ويبطئ الهاتف)
// لوحة الإعدادات (?panel=settings): مزامنة مباشرة كما كانت
const SYNC_LIVE = new URLSearchParams(location.search).get('panel') === 'settings';
function startSync(){
  const col = db.collection(FS_COLLECTION);
  if(SYNC_LIVE){ col.onSnapshot(handleSnap, (err)=>{ console.error(err); }); return; }
  col.get().then(handleSnap).catch((err)=>{ console.warn(err); })
    .finally(()=>{
      Promise.resolve(window.__visitDone).catch(()=>{})
        .finally(()=>{ db.terminate().catch(()=>{}); });
    });
}
async function handleSnap(snap){
  {
    let mainDoc = null;
    const itemChunks = {};
    const videoChunks = {};
    snap.forEach(doc=>{
      if(doc.id === FS_DOC) mainDoc = doc.data();
      else if(doc.id === 'site_faq') renderFaq(doc.data().items);
      else if(doc.id === 'site_reviews') renderReviews(doc.data().items);
      else if(doc.id.startsWith(VCHUNK_PREFIX)) videoChunks[doc.id] = doc.data().items || [];
      else if(doc.id.startsWith(CHUNK_PREFIX)) itemChunks[doc.id] = doc.data().items || [];
    });

    settings = {...DEFAULT_SETTINGS, ...((mainDoc && mainDoc.settings) || {})};
    try{ localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings)); }catch(e){}

    // ترحيل تلقائي: لو لسا في بيانات قديمة (كل الصور بمستند واحد)، ننقلها
    // للنظام الموزّع الجديد مرة وحدة بس.
    if(SYNC_LIVE && Object.keys(itemChunks).length === 0 && mainDoc && Array.isArray(mainDoc.items) && mainDoc.items.length){
      const now = Date.now();
      const legacy = mainDoc.items.map((it,i)=>({...it, createdAt: it.createdAt || (now - i)}));
      await chunkAndWriteItems(legacy);
      await db.collection(FS_COLLECTION).doc(FS_DOC).update({items: firebase.firestore.FieldValue.delete()});
      return; // بتنعاد المزامنة تلقائيًا بعد الكتابة
    }

    if(SYNC_LIVE && !mainDoc && Object.keys(itemChunks).length === 0){
      const now = Date.now();
      const seeded = DEFAULT_ITEMS.map((it,i)=>({...it, createdAt: now - i}));
      await db.collection(FS_COLLECTION).doc(FS_DOC).set({settings: DEFAULT_SETTINGS});
      await chunkAndWriteItems(seeded);
      return;
    }

    chunkCache = itemChunks;
    chunkOf = {};
    let combined = [];
    Object.keys(itemChunks).forEach(cid=>{
      itemChunks[cid].forEach(it=>{ chunkOf[it.id] = cid; combined.push(it); });
    });
    combined.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
    items = combined;

    let combinedVideos = [];
    Object.keys(videoChunks).forEach(cid=>{
      videoChunks[cid].forEach(v=> combinedVideos.push(v));
    });
    combinedVideos.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
    videos = combinedVideos;

    renderCategoryFilters();
    renderAdminList();
    renderSocialIcons();
    renderHeroSection();
    renderAboutSection();
    renderHomeShowcase();
    renderVideoShowcase();
    reScrollToHashIfNeeded();
  }
}

// الأسئلة الشائعة من لوحة التحكم (مستند site_faq)
function renderFaq(list){
  if(!Array.isArray(list)||!list.length) return;
  const e=t=>String(t||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const sec=document.getElementById('faq'); if(!sec) return;
  sec.querySelectorAll('details').forEach(d=>d.remove());
  sec.insertAdjacentHTML('beforeend', list.filter(x=>x&&x.q&&x.a).map(x=>`<details><summary>${e(x.q)}</summary><p>${e(x.a).replace(/\n/g,'<br>')}</p></details>`).join(''));
}
// آراء غوغل الحقيقية (من /api/google-reviews) — إذا ما اشتغلت بتضل الآراء المكتوبة باليد
let googleReviewsOn=false;
(function(){fetch('/api/google-reviews').then(r=>r.ok?r.json():null).then(d=>{if(!d||!d.ok||!d.reviews||!d.reviews.length)return;googleReviewsOn=true;
  const e=t=>String(t||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  if(d.rating){const g=document.getElementById('gRating');if(g)g.textContent=(+d.rating).toFixed(1)}
  if(d.count){const c=document.getElementById('gCount');if(c)c.textContent=' ('+d.count+' تقييم)'}
  const w=document.getElementById('reviewsList');if(!w)return;
  w.innerHTML=d.reviews.map(r=>`<div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:6px"><div style="display:flex;align-items:center;gap:8px">${r.photo?`<img src="${e(r.photo)}" alt="" width="34" height="34" loading="lazy" referrerpolicy="no-referrer" style="border-radius:50%">`:''}<div><b dir="auto">${e(r.name)}</b><div style="font-size:12px;color:var(--gold-deep)">${e(r.when)}</div></div></div><div style="color:#E0A100;letter-spacing:2px">${'★'.repeat(Math.max(1,Math.min(5,Math.round(+r.stars||5))))}</div><p dir="auto" style="margin:0;line-height:1.7">${e(r.text.length>320?r.text.slice(0,317)+'…':r.text)}</p></div>`).join('')
    +`<div style="grid-column:1/-1;text-align:center;font-size:12.5px;color:var(--gold-deep)">الآراء من <a href="${e(d.url||'https://maps.app.goo.gl/g6wBPVBsZmQipM2j6')}" target="_blank" rel="noopener" style="color:inherit;font-weight:700">غوغل</a></div>`;
}).catch(()=>{})})();
function renderReviews(list){
  if(googleReviewsOn) return;
  const w=document.getElementById('reviewsList'); if(!w||!Array.isArray(list)) return;
  const e=t=>String(t||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  w.innerHTML=list.filter(r=>r&&r.text).map(r=>`<div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px"><div style="color:#E0A100;letter-spacing:2px">${'★'.repeat(Math.max(1,Math.min(5,+r.stars||5)))}</div><p style="margin:6px 0">${e(r.text)}</p><b>${e(r.name)}</b></div>`).join('');
}
let didInitialHashScroll = false;
function reScrollToHashIfNeeded(){
  if(didInitialHashScroll) return;
  const hash = location.hash.slice(1);
  if(!hash) return;
  const target = document.getElementById(hash);
  if(!target) return;
  didInitialHashScroll = true;
  setTimeout(()=> target.scrollIntoView({behavior:'smooth', block:'start'}), 50);
  // نشيل #contact من الرابط بعد النزول، ليرجع الرابط نظيف
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
}

// نغيّر النص فقط إذا اختلف فعلاً: إعادة كتابة نفس النص تجعل Google يعتبر
// أن المحتوى الرئيسي ظهر متأخراً (بعد تحميل Firebase) فتنخفض نتيجة السرعة
function setTextIfChanged(id, txt){
  const el = document.getElementById(id);
  if(el && el.textContent !== txt) el.textContent = txt;
}
function renderHeroSection(){
  setTextIfChanged('heroTitleMain', settings.heroTitleMain || DEFAULT_SETTINGS.heroTitleMain);
  setTextIfChanged('heroTitleAccent', settings.heroTitleAccent || DEFAULT_SETTINGS.heroTitleAccent);
  setTextIfChanged('heroSubtitle', settings.heroSubtitle || DEFAULT_SETTINGS.heroSubtitle);
}

const sortCat=arr=>arr.slice().sort((a,b)=>(b.cover?1:0)-(a.cover?1:0)||((a.order??1e9)-(b.order??1e9))||((b.createdAt||0)-(a.createdAt||0)));
function renderHomeShowcase(){
  const wrap = document.getElementById('homeShowcase');
  if(!wrap || !items.length) return;
  const per = new Map();
  for(const it of sortCat(items)){
    const cat = (it.category||'').trim(); if(!cat) continue;
    if(!per.has(cat)){ if(per.size>=8) continue; per.set(cat, []); }
    if(per.get(cat).length < 1) per.get(cat).push(it);
  }
  const short = c => c.split('|')[0].trim();
  wrap.innerHTML = [...per.entries()].flatMap(([cat, list]) => list.map(it => `
    <a class="sc-item" href="/works?category=${encodeURIComponent(cat)}">
      <img src="${it.img}" loading="lazy" alt="${(it.aiAltAr||it.title||short(cat))} - قيصر الشام">
      <span>${short(cat)}</span>
    </a>`)).join('');
  if(window.__motionShowcase) window.__motionShowcase();
}

function renderVideoShowcase(){
  const section = document.getElementById('videosSection');
  const wrap = document.getElementById('videoShowcase');
  const title = document.getElementById('videosSectionTitle');
  if(!wrap || !section) return;
  if(!videos.length){ wrap.innerHTML = ''; if(title) title.style.display = 'none'; return; }
  if(title) title.style.display = '';

  const grouped = new Map(); // اسم القسم -> قائمة فيديوهات
  videos.forEach(v=>{
    const cat = (v.category||'').trim() || 'فيديوهات عامة';
    if(!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat).push(v);
  });

  const videoCard = (v)=>`
    <div style="border-radius:10px; overflow:hidden; box-shadow:var(--shadow); aspect-ratio:16/9; background:#000;">
      <video src="${v.url}" controls preload="metadata" style="width:100%; height:100%; object-fit:contain; background:#000; display:block;"></video>
      ${v.title ? `<div style="padding:8px 10px; font-size:13px; color:var(--ink); background:#fff;">${v.title}</div>` : ''}
    </div>`;

  wrap.innerHTML = [...grouped.entries()].map(([cat, vids])=>`
    <div style="grid-column:1/-1; margin-top:18px; font-size:16px; font-weight:700; color:var(--gold-deep); border-bottom:1px solid var(--line); padding-bottom:8px;">${cat}</div>
    ${vids.map(videoCard).join('')}
  `).join('');
}

function renderAboutSection(){
  document.getElementById('aboutTitle').textContent = settings.aboutTitle || DEFAULT_SETTINGS.aboutTitle;
  document.getElementById('aboutText').textContent = settings.aboutText || DEFAULT_SETTINGS.aboutText;
  document.getElementById('contactTagline').textContent = settings.contactTagline || DEFAULT_SETTINGS.contactTagline;
  const img = document.getElementById('aboutImg');
  if(settings.aboutImg){
    img.src = settings.aboutImg;
    img.parentElement.style.display = '';
  } else {
    img.parentElement.style.display = 'none';
  }
}

// القراءة مفتوحة للجميع حسب قواعد Firestore، فما في داعي لتسجيل دخول anonymous
// حتى تظهر المعرض للزوار. التسجيل الحقيقي (Email/Password) بيصير بس لما
// الأدمن يفتح لوحة الإدارة.
fbReady = true;

// عرض فوري من آخر نسخة محفوظة بالمتصفح (لو موجودة) قبل ما نستنى Firestore،
// هذا يمنع "الومضة" (النص/الأيقونات الفارغة تتغير فجأة) عند أي زيارة بعد الأولى.
try{
  const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
  if(cached){
    settings = {...DEFAULT_SETTINGS, ...JSON.parse(cached)};
    renderSocialIcons();
    renderHeroSection();
    renderAboutSection();
  }
}catch(e){}

startSync();

// ---------- overlay open/close ----------
document.querySelectorAll('[data-close]').forEach(btn=>{
  btn.addEventListener('click', ()=> document.getElementById(btn.dataset.close).classList.remove('show'));
});
document.querySelectorAll('.overlay').forEach(ov=>{
  ov.addEventListener('click', (e)=>{ if(e.target === ov) ov.classList.remove('show'); });
});

document.getElementById('adminFab').addEventListener('click', async ()=>{
  await waitForAuthReady();
  if(firebase.auth().currentUser){
    window.location.href = 'admin-works.html';
  } else {
    document.getElementById('loginErr').style.display = 'none';
    document.getElementById('loginOverlay').classList.add('show');
  }
});
document.getElementById('btnDoLogin').addEventListener('click', ()=>{
  const email = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  document.getElementById('loginErr').style.display = 'none';
  firebase.auth().signInWithEmailAndPassword(email, pass).then(()=>{
    document.getElementById('loginOverlay').classList.remove('show');
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    if(new URLSearchParams(location.search).get('panel') === 'settings') openAdmin();
    else window.location.href = 'admin-works.html';
  }).catch(err=>{
    console.error(err);
    document.getElementById('loginErr').style.display = 'block';
  });
});
// دخول مباشر للإعدادات العامة (النصوص، الشعار، النسخة الاحتياطية...) عبر index.html?panel=settings
(async function autoOpenSettingsPanel(){
  if(new URLSearchParams(location.search).get('panel') !== 'settings') return;
  await waitForAuthReady();
  if(firebase.auth().currentUser) openAdmin();
  else {
    document.getElementById('loginErr').style.display = 'none';
    document.getElementById('loginOverlay').classList.add('show');
  }
})();
function renderDomainCountdown(){
  const el = document.getElementById('domainCountdown');
  if(!settings.domainExpiry){ el.textContent = 'لم يُحدَّد تاريخ بعد.'; return; }
  const target = new Date(settings.domainExpiry + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const days = Math.round((target - today) / 86400000);
  if(days > 30) el.innerHTML = `متبقي <b style="color:var(--gold-deep);">${days}</b> يوم على تجديد الدومين.`;
  else if(days > 0) el.innerHTML = `⚠️ متبقي <b style="color:var(--danger);">${days}</b> يوم بس على تجديد الدومين — راجع Namecheap.`;
  else if(days === 0) el.innerHTML = `⚠️ <b style="color:var(--danger);">الدومين ينتهي اليوم!</b>`;
  else el.innerHTML = `⛔ <b style="color:var(--danger);">الدومين متأخر عن التجديد بـ ${Math.abs(days)} يوم!</b>`;
}

function renderAdminStats(){
  const wrap = document.getElementById('adminStats');
  if(!wrap) return;
  const totalWorks = items.length;
  const cats = new Set(items.map(it => (it.category||'').trim()).filter(Boolean));
  const last = items[0]; // items مرتبة الأحدث أولًا
  const lastLabel = last ? (last.title || last.category || 'صورة بدون عنوان') : '—';
  const card = (lbl, val) => `<div style="background:var(--cream-2); border-radius:10px; padding:12px; text-align:center;">
    <div style="font-size:11px; color:var(--text-dim); margin-bottom:4px;">${lbl}</div>
    <div style="font-size:16px; font-weight:800; color:var(--ink);">${val}</div>
  </div>`;
  wrap.innerHTML = card('إجمالي الأعمال', totalWorks) + card('عدد الأقسام', cats.size) + card('آخر صورة مضافة', lastLabel)
    + card('زيارات اليوم', '...') + card('زيارات هذا الشهر', '...');
  renderVisitStats();
}

async function renderVisitStats(){
  const wrap = document.getElementById('adminStats');
  if(!wrap) return;
  try{
    const today = new Date();
    const todayStr = localDate(today);
    const monthPrefix = todayStr.slice(0,7); // YYYY-MM

    const todayDoc = await db.collection('cesar_stats').doc(todayStr).get();
    const todayCount = todayDoc.exists ? (todayDoc.data().count || 0) : 0;

    const monthSnap = await db.collection('cesar_stats')
      .where(firebase.firestore.FieldPath.documentId(), '>=', monthPrefix + '-01')
      .where(firebase.firestore.FieldPath.documentId(), '<=', monthPrefix + '-31')
      .get();
    let monthCount = 0;
    const countryTotals = {};
    monthSnap.forEach(doc => {
      const d = doc.data();
      monthCount += (d.count || 0);
      if(d.countries){
        Object.entries(d.countries).forEach(([code, n])=>{
          countryTotals[code] = (countryTotals[code] || 0) + n;
        });
      }
    });

    const cards = wrap.querySelectorAll('div > div:last-child');
    // آخر بطاقتين هني "زيارات اليوم" و"زيارات هذا الشهر"
    if(cards.length >= 2){
      cards[cards.length-2].textContent = todayCount;
      cards[cards.length-1].textContent = monthCount;
    }

    const countriesWrap = document.getElementById('adminCountries');
    if(countriesWrap){
      const sorted = Object.entries(countryTotals).sort((a,b)=> b[1]-a[1]).slice(0,6);
      countriesWrap.textContent = sorted.length
        ? 'أكثر الدول زيارة هالشهر: ' + sorted.map(([code,n])=> `${code} (${n})`).join(' · ')
        : '';
    }
  }catch(e){
    console.error(e);
    const cards = wrap.querySelectorAll('div > div:last-child');
    if(cards.length >= 2){
      cards[cards.length-2].textContent = '—';
      cards[cards.length-1].textContent = '—';
    }
  }
}

function openAdmin(){
  const user = firebase.auth().currentUser;
  document.getElementById('currentAdminEmail').textContent = user ? user.email : '—';
  renderAdminStats();
  document.getElementById('setHeroTitleMain').value = settings.heroTitleMain || '';
  document.getElementById('setHeroTitleAccent').value = settings.heroTitleAccent || '';
  document.getElementById('setHeroSubtitle').value = settings.heroSubtitle || '';
  document.getElementById('setWhatsapp').value = settings.whatsapp || '';
  document.getElementById('setAboutTitle').value = settings.aboutTitle || '';
  document.getElementById('setAboutText').value = settings.aboutText || '';
  document.getElementById('setAboutImgFile').value = '';
  if(settings.aboutImg){
    document.getElementById('aboutImgPreview').src = settings.aboutImg;
    document.getElementById('aboutImgPreviewWrap').style.display = '';
  } else {
    document.getElementById('aboutImgPreviewWrap').style.display = 'none';
  }
  document.getElementById('setContactTagline').value = settings.contactTagline || '';
  document.getElementById('setFacebook').value = settings.facebook || '';
  document.getElementById('setInstagram').value = settings.instagram || '';
  document.getElementById('setTiktok').value = settings.tiktok || '';
  document.getElementById('setYoutube').value = settings.youtube || '';
  document.getElementById('setDomainExpiry').value = settings.domainExpiry || '';
  renderDomainCountdown();
  document.getElementById('adminOverlay').classList.add('show');
}
document.getElementById('btnLogout').addEventListener('click', ()=>{
  firebase.auth().signOut();
  document.getElementById('adminOverlay').classList.remove('show');
});

document.getElementById('btnExportBackup').addEventListener('click', ()=>{
  const backup = {
    type: 'qaysar-alsham-backup',
    exportedAt: new Date().toISOString(),
    settings: settings,
    items: items
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = localDate();
  a.href = url;
  a.download = `qaysar-alsham-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('تم تنزيل النسخة الاحتياطية');
});

document.getElementById('btnImportBackup').addEventListener('click', ()=>{
  document.getElementById('importBackupFile').value = '';
  document.getElementById('importBackupFile').click();
});

document.getElementById('importBackupFile').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const backup = JSON.parse(text);
    if(!backup || !Array.isArray(backup.items) || typeof backup.settings !== 'object'){
      toast('هذا الملف مش نسخة احتياطية صالحة');
      return;
    }
    if(!confirm('استرجاع هالنسخة رح يستبدل كل البيانات الحالية (الصور والإعدادات). متأكد بدك تكمل؟')) return;
    const snap = await db.collection(FS_COLLECTION).get();
    const oldChunkIds = [];
    snap.forEach(doc => { if(doc.id.startsWith(CHUNK_PREFIX)) oldChunkIds.push(doc.id); });
    for(const cid of oldChunkIds){ await db.collection(FS_COLLECTION).doc(cid).delete(); }
    await chunkAndWriteItems(backup.items);
    await db.collection(FS_COLLECTION).doc(FS_DOC).set({settings: backup.settings});
    toast('تم استرجاع النسخة الاحتياطية بنجاح');
  }catch(err){
    console.error(err);
    toast('تعذّر قراءة أو استرجاع هذا الملف');
  }
});

document.getElementById('btnSaveSocial').addEventListener('click', async ()=>{
  settings.whatsapp = document.getElementById('setWhatsapp').value.trim();
  settings.facebook = document.getElementById('setFacebook').value.trim();
  settings.instagram = document.getElementById('setInstagram').value.trim();
  settings.tiktok = document.getElementById('setTiktok').value.trim();
  settings.youtube = document.getElementById('setYoutube').value.trim();
  await saveSettings({whatsapp: settings.whatsapp, facebook: settings.facebook, instagram: settings.instagram, tiktok: settings.tiktok, youtube: settings.youtube});
  renderSocialIcons();
  toast('تم حفظ روابط التواصل الاجتماعي');
});

document.getElementById('btnSaveHero').addEventListener('click', async ()=>{
  settings.heroTitleMain = document.getElementById('setHeroTitleMain').value.trim() || DEFAULT_SETTINGS.heroTitleMain;
  settings.heroTitleAccent = document.getElementById('setHeroTitleAccent').value.trim() || DEFAULT_SETTINGS.heroTitleAccent;
  settings.heroSubtitle = document.getElementById('setHeroSubtitle').value.trim() || DEFAULT_SETTINGS.heroSubtitle;
  await saveSettings({heroTitleMain: settings.heroTitleMain, heroTitleAccent: settings.heroTitleAccent, heroSubtitle: settings.heroSubtitle});
  renderHeroSection();
  toast('تم حفظ عنوان الصفحة الرئيسية');
});

document.getElementById('btnSaveAbout').addEventListener('click', async ()=>{
  settings.aboutTitle = document.getElementById('setAboutTitle').value.trim() || DEFAULT_SETTINGS.aboutTitle;
  settings.aboutText = document.getElementById('setAboutText').value.trim() || DEFAULT_SETTINGS.aboutText;
  settings.contactTagline = document.getElementById('setContactTagline').value.trim() || DEFAULT_SETTINGS.contactTagline;

  const file = document.getElementById('setAboutImgFile').files[0];
  if(file){
    try{
      toast('جاري رفع صورة القسم...');
      const storageRef = storage.ref('site/about.jpg');
      await storageRef.put(file, { contentType: file.type || 'image/jpeg' });
      settings.aboutImg = await storageRef.getDownloadURL();
    }catch(e){
      console.error(e);
      toast('تعذر رفع صورة القسم');
    }
  }

  const aboutFields = {aboutTitle: settings.aboutTitle, aboutText: settings.aboutText, contactTagline: settings.contactTagline};
  if(settings.aboutImg) aboutFields.aboutImg = settings.aboutImg;
  await saveSettings(aboutFields);
  renderAboutSection();
  toast('تم حفظ قسم "من نحن"');
});

document.getElementById('btnSaveDomain').addEventListener('click', async ()=>{
  settings.domainExpiry = document.getElementById('setDomainExpiry').value;
  await saveSettings({domainExpiry: settings.domainExpiry});
  renderDomainCountdown();
  toast('تم حفظ تاريخ انتهاء الدومين');
});

// ---------- upload + rotate preview + watermark ----------
let loadedImage = null;
let rotation = 0; // 0, 90, 180, 270

function drawPreview(){
  if(!loadedImage) return;
  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const swapped = (rotation === 90 || rotation === 270);
  const w = loadedImage.width, h = loadedImage.height;
  canvas.width = swapped ? h : w;
  canvas.height = swapped ? w : h;
  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.rotate(rotation * Math.PI/180);
  ctx.drawImage(loadedImage, -w/2, -h/2, w, h);
  ctx.restore();
}

document.getElementById('upFile').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const image = new Image();
    image.onload = ()=>{
      loadedImage = image;
      rotation = 0;
      document.getElementById('previewWrap').style.display = 'block';
      drawPreview();
    };
    image.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});
document.getElementById('btnRotateLeft').addEventListener('click', ()=>{
  rotation = (rotation - 90 + 360) % 360;
  drawPreview();
});
document.getElementById('btnRotateRight').addEventListener('click', ()=>{
  rotation = (rotation + 90) % 360;
  drawPreview();
});

function getLogoImage(){
  if(window._logoImgCache) return Promise.resolve(window._logoImgCache);
  if(window._logoImgPromise) return window._logoImgPromise;
  const img = new Image();
  img.src = LOGO_SRC;
  window._logoImgPromise = (img.decode ? img.decode() : new Promise((res, rej)=>{
    img.onload = res; img.onerror = rej;
  }))
    .then(()=>{ window._logoImgCache = img; return img; })
    .catch((e)=>{ console.error('logo failed to load/decode', e); window._logoImgCache = img; return img; });
  return window._logoImgPromise;
}
getLogoImage();

function computeBoxOrigin(canvasW, canvasH, boxW, boxH, position, margin) {
  let x, y;
  switch (position) {
    case 'top-left': x = margin; y = margin; break;
    case 'top-right': x = canvasW - boxW - margin; y = margin; break;
    case 'bottom-left': x = margin; y = canvasH - boxH - margin; break;
    case 'center': x = (canvasW - boxW) / 2; y = (canvasH - boxH) / 2; break;
    case 'bottom-right':
    default: x = canvasW - boxW - margin; y = canvasH - boxH - margin; break;
  }
  return { x, y };
}

function drawLogoWithInfo(ctx, canvasW, canvasH, logoImg, sizePercent, position, margin, opacity, phone, address) {
  const logoTargetW = canvasW * (sizePercent / 100);
  const scale = logoTargetW / logoImg.naturalWidth;
  const logoTargetH = logoImg.naturalHeight * scale;

  const rawLines = [];
  // تحت اللوغو: العنوان، وتحته الهاتف
  if (address && address.trim()) rawLines.push({ text: address.trim(), bold: false });
  if (phone && phone.trim()) rawLines.push({ text: phone.trim(), bold: true });

  const baseFontSize = Math.max(13, Math.round(canvasW * 0.015));
  const lineGap = Math.round(baseFontSize * 0.35);
  const padY = Math.round(baseFontSize * 0.55);
  const padX = Math.round(baseFontSize * 0.9);

  // شريط النص بنفس عرض اللوغو بالضبط (مظهر موحّد ومرتّب، بدل عرضين مختلفين فوق بعض)
  const blockW = logoTargetW;
  const maxTextW = Math.max(20, blockW - padX * 2);

  // تصغير الخط تلقائياً لو النص أطول من عرض اللوغو، بدل ما يطفح أو يتقطع
  function fitFontSize(text, bold) {
    let fs = baseFontSize;
    ctx.font = `${bold ? 'bold ' : ''}${fs}px Tahoma, Arial, sans-serif`;
    while (ctx.measureText(text).width > maxTextW && fs > 9) {
      fs -= 1;
      ctx.font = `${bold ? 'bold ' : ''}${fs}px Tahoma, Arial, sans-serif`;
    }
    return fs;
  }

  const lines = rawLines.map(l => ({ ...l, fontSize: fitFontSize(l.text, l.bold) }));
  const textBlockH = lines.length
    ? lines.reduce((sum, l) => sum + l.fontSize + lineGap, 0) - lineGap + padY * 2
    : 0;

  const gapBetween = lines.length ? Math.round(baseFontSize * 0.5) : 0;
  const blockH = logoTargetH + gapBetween + textBlockH;

  const origin = computeBoxOrigin(canvasW, canvasH, blockW, blockH, position, margin);

  // ظل ناعم خلف اللوغو نفسه، يخليه يبين "ملصق" باحتراف فوق الصورة بدل ما يبدو مسطّح
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = Math.max(6, baseFontSize * 0.7);
  ctx.shadowOffsetY = Math.max(2, baseFontSize * 0.15);
  ctx.drawImage(logoImg, origin.x, origin.y, logoTargetW, logoTargetH);
  ctx.restore();

  if (lines.length) {
    const boxX = origin.x;
    const boxY = origin.y + logoTargetH + gapBetween;
    const radius = Math.max(6, baseFontSize * 0.4);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = Math.max(5, baseFontSize * 0.5);
    ctx.shadowOffsetY = 2;

    // خلفية داكنة دافئة متدرّجة (بدل الأسود الفاحم المسطّح) تنسجم مع لون اللوغو الذهبي
    const grad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + textBlockH);
    grad.addColorStop(0, 'rgba(24,17,10,0.82)');
    grad.addColorStop(1, 'rgba(8,6,4,0.90)');
    ctx.fillStyle = grad;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, blockW, textBlockH, radius);
      ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, blockW, textBlockH);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = opacity;
    // خط ذهبي رفيع أعلى الشريط يربطه بصرياً بلون اللوغو
    ctx.strokeStyle = 'rgba(212,175,55,0.85)';
    ctx.lineWidth = Math.max(1, baseFontSize * 0.06);
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY + ctx.lineWidth / 2);
    ctx.lineTo(boxX + blockW - radius, boxY + ctx.lineWidth / 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    const centerX = boxX + blockW / 2;
    let ty = boxY + padY;
    lines.forEach(l => {
      ctx.font = `${l.bold ? 'bold ' : ''}${l.fontSize}px Tahoma, Arial, sans-serif`;
      ctx.fillText(l.text, centerX, ty);
      ty += l.fontSize + lineGap;
    });
    ctx.restore();
  }
}

// نفس لوغو الموقع ولوحة الموقع: اللوغو تحت يمين (12%)، وتحته العنوان، وتحته الهاتف
let wmLogoP=null;
function getWmLogo(){ if(!wmLogoP) wmLogoP=new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src='/img/site/logo-wm.png';}); return wmLogoP; }
async function drawWatermark(ctx, w, h){
  const logo = await getWmLogo();
  if(!logo) return;
  drawLogoWithInfo(ctx, w, h, logo, 12, 'bottom-right', Math.round(w*0.0125), 0.9, '0541737888', 'الجزائر - دالي ابراهيم');
}

document.getElementById('btnUpload').addEventListener('click', async ()=>{
  if(!loadedImage){ toast('يرجى اختيار صورة'); return; }
  const chosenCategory = document.getElementById('upCategory').value.trim();
  if(!chosenCategory){ toast('يرجى اختيار أو كتابة القسم قبل الرفع (مثال: شمينة، حمام...)'); return; }

  const swapped = (rotation === 90 || rotation === 270);
  const srcW = loadedImage.width, srcH = loadedImage.height;
  const rotW = swapped ? srcH : srcW;
  const rotH = swapped ? srcW : srcH;

  const maxW = 1800;
  const scale = Math.min(1, maxW / rotW);
  const w = Math.round(rotW * scale);
  const h = Math.round(rotH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(w/2, h/2);
  ctx.rotate(rotation * Math.PI/180);
  ctx.scale(scale, scale);
  ctx.drawImage(loadedImage, -srcW/2, -srcH/2, srcW, srcH);
  ctx.restore();

  // watermark: logo + text
  await drawWatermark(ctx, w, h);

  const itemId = uid();
  const uploadBtn = document.getElementById('btnUpload');
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'جاري الرفع...';

  canvas.toBlob(async (blob)=>{
    try{
      const storageRef = storage.ref('gallery/' + itemId + '.jpg');
      await storageRef.put(blob, { contentType: 'image/jpeg' });
      const imgUrl = await storageRef.getDownloadURL();

      const newItem = {
        id: itemId,
        createdAt: Date.now(),
        title: document.getElementById('upTitle').value.trim(),
        category: document.getElementById('upCategory').value.trim(),
        size: document.getElementById('upSize').value.trim(),
        color: document.getElementById('upColor').value.trim(),
        type: document.getElementById('upType').value.trim(),
        price: document.getElementById('upPrice').value.trim(),
        img: imgUrl
      };
      items.unshift(newItem);
      renderAdminList();
      await saveNewItem(newItem);
      toast('تم رفع الصورة بنجاح');
      document.getElementById('upFile').value = '';
      document.getElementById('previewWrap').style.display = 'none';
      loadedImage = null; rotation = 0;
      document.getElementById('upTitle').value = '';
      document.getElementById('upCategory').value = '';
      document.getElementById('upCategory').style.display = '';
      document.getElementById('upCategorySelect').value = '__new__';
      document.getElementById('upSize').value = '';
      document.getElementById('upColor').value = '';
      document.getElementById('upType').value = '';
      document.getElementById('upPrice').value = '';
    }catch(e){
      console.error(e);
      toast('تعذر رفع الصورة — حاول من جديد');
    }finally{
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'رفع الصورة';
    }
  }, 'image/jpeg', 0.85);
});

async function deleteItem(id){
  if(!confirm('حذف هذه الصورة؟')) return;
  items = items.filter(it => it.id !== id);
  renderAdminList();
  await removeItemCloud(id);
  try{ await storage.ref('gallery/' + id + '.jpg').delete(); }
  catch(e){ /* الصورة ممكن تكون قديمة (مخزنة بالطريقة القديمة) أو محذوفة أصلاً */ }
  toast('تم الحذف');
}

// نموذج طلب عرض السعر: بيفتح واتساب برسالة جاهزة
(function(){
  const f=document.getElementById('quoteForm'); if(!f) return;
  f.addEventListener('submit',async e=>{
    e.preventDefault(); const d=Object.fromEntries(new FormData(f).entries());
    const lines=['السلام عليكم، أرغب في الحصول على عرض سعر من قيصر الشام للحجر والرخام:','الاسم: '+d.name,'الهاتف: '+d.phone,'نوع العمل: '+d.type];
    if(d.place) lines.push('المنطقة: '+d.place); if(d.size) lines.push('القياسات: '+d.size); if(d.msg) lines.push('التفاصيل: '+d.msg);
    lines.push('(سأرسل صور المكان في هذه المحادثة)');
    window.open('https://wa.me/213541737888?text='+encodeURIComponent(lines.join('\n')),'_blank');
  });
})();
