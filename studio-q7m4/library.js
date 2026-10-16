// مكتبة موديلات المرسم: كل أعمال الموقع مصنّفة، ولكل موديل له قالب هندسي مجسّم ثلاثي حقيقي قابل للتعديل.
// الصور الأصلية تُعرض من روابطها كما هي (لا نسخ ولا تعديل). البيانات من models.json (يبنيه tools/build-models.mjs).
// القوالب الهندسية في TEMPLATES بالأسفل: كل قالب = خانات (بالسنتيمتر) + دالة تبني المجسّم + ربط بخانات المرسم.
import * as THREE from './vendor/three-bundle.min.js?v=186';

const VER = 1;
let data = null, ui = {}, r3 = null;

// ---------- ألوان الرخام الثلاثة (نفس ألوان المرسم) ----------
function matsOf() {
  return (typeof MATS !== 'undefined' && MATS) || {
    beigeL: { name: 'بيج', c: '#E9DCC1', d: '#D3C29F', v: '#B89A6C' },
    black: { name: 'بني غامق', c: '#2C2627', d: '#161213', v: '#C8A77E' },
    italian: { name: 'رمادي', c: '#EFEFED', d: '#D5D6D7', v: '#7D8490' },
  };
}
const texCache = new Map();
function marbleTexture(key) {
  if (texCache.has(key)) return texCache.get(key);
  const m = matsOf()[key] || matsOf().beigeL;
  const S = 1024, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, m.c); g.addColorStop(0.5, m.d); g.addColorStop(1, m.c);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  // بقع ناعمة + عروق متعرّجة (عشوائية ثابتة حتى يطلع نفس الرخام كل مرة)
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) { x.fillStyle = m.d; x.globalAlpha = 0.05 + rnd() * 0.08; x.beginPath(); x.arc(rnd() * S, rnd() * S, 8 + rnd() * 60, 0, 7); x.fill(); }
  x.strokeStyle = m.v; x.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    let px = rnd() * S, py = rnd() * S, a = rnd() * 6.28;
    x.globalAlpha = 0.25 + rnd() * 0.45; x.lineWidth = 0.8 + rnd() * 2.6;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 40; k++) { a += (rnd() - 0.5) * 0.7; px += Math.cos(a) * 18; py += Math.sin(a) * 18; x.lineTo(px, py); }
    x.stroke();
  }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
function marbleMat(key, rep = 1) {
  const t = marbleTexture(key).clone();
  t.needsUpdate = true; t.repeat.set(rep, rep);
  return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.28, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2 });
}

// ---------- أدوات هندسية ----------
// خراطة من بروفايل: نقاط [ارتفاع 0..1، نصف قطر 0..1] تتنعّم بمنحنى وتدور 360°
function lathe(profile, height, radius, segs = 64) {
  const pts = profile.map(([y, r]) => new THREE.Vector2(r * radius, y * height));
  const curve = new THREE.SplineCurve(pts);
  const smooth = curve.getPoints(profile.length * 8).map(p => new THREE.Vector2(Math.max(0.01, p.x), p.y));
  return new THREE.LatheGeometry(smooth, segs);
}
// مقطع مستطيل بزوايا مدوّرة من فوق، ممدود بطول L على محور x
function railGeometry(L, w, h, r) {
  const s = new THREE.Shape();
  r = Math.min(r, w / 2 - 0.1, h - 0.1);
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - r);
  s.quadraticCurveTo(w / 2, h, w / 2 - r, h); s.lineTo(-w / 2 + r, h);
  s.quadraticCurveTo(-w / 2, h, -w / 2, h - r); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 10 });
  g.rotateY(Math.PI / 2); g.translate(-L / 2, 0, 0);
  return g;
}

// ---------- القوالب ----------
const TEMPLATES = {
  balustrade: {
    name: 'درابزين مخروط',
    fields: [
      ['L', 'الطول', 60, 600, 150],
      ['H', 'الارتفاع الكلي', 60, 130, 90],
      ['n', 'عدد البلسترات', 2, 40, 5],
      ['bw', 'عرض البلستر', 8, 25, 16],
      ['railH', 'سماكة المسكة', 6, 20, 11],
      ['railW', 'عرض المسكة', 12, 35, 22],
      ['baseH', 'ارتفاع القاعدة', 4, 20, 7],
    ],
    // بروفايل البلستر مأخوذ من صورة «موديل 04»: راس مربع، جرس، حلقتين، رقبة، بطن واسع تحت، رقبة، حلقة، قاعدة مربعة
    profile: [
      [0.00, 0.78], [0.025, 0.78], [0.04, 0.66], [0.06, 0.74], [0.08, 0.70], [0.10, 0.52], [0.13, 0.46],
      [0.19, 0.70], [0.27, 0.92], [0.34, 0.95], [0.41, 0.86], [0.49, 0.66], [0.57, 0.50], [0.63, 0.42],
      [0.66, 0.44], [0.68, 0.58], [0.70, 0.58], [0.72, 0.44], [0.75, 0.40], [0.79, 0.54], [0.82, 0.62],
      [0.85, 0.58], [0.89, 0.72], [0.93, 0.86], [0.96, 0.92], [1.00, 0.92],
    ],
    build(p, mat) {
      const g = new THREE.Group();
      const M = marbleMat(mat, 1), Mlong = marbleMat(mat, 3);
      const blk = p.bw, blkH = p.bw * 0.7;                       // مكعب الراس والقاعدة بعرض البلستر
      const hb = p.H - p.railH - p.baseH;                          // ارتفاع البلستر الكامل
      const turn = Math.max(10, hb - 2 * blkH);                    // الجزء المخروط بين المكعبين
      const step = p.L / p.n;
      const turned = lathe(this.profile, turn, blk / 2);
      for (let i = 0; i < p.n; i++) {
        const x = -p.L / 2 + step * (i + 0.5);
        const bot = new THREE.Mesh(new THREE.BoxGeometry(blk, blkH, blk), M); bot.position.set(x, p.baseH + blkH / 2, 0);
        const body = new THREE.Mesh(turned, M); body.position.set(x, p.baseH + blkH, 0);
        const top = new THREE.Mesh(new THREE.BoxGeometry(blk, blkH, blk), M); top.position.set(x, p.baseH + blkH + turn + blkH / 2, 0);
        g.add(bot, body, top);
      }
      const base = new THREE.Mesh(railGeometry(p.L + 6, p.railW + 2, p.baseH, 1.5), Mlong);
      const rail = new THREE.Mesh(railGeometry(p.L + 6, p.railW, p.railH, Math.min(5, p.railH * 0.45)), Mlong);
      rail.position.y = p.H - p.railH;
      g.add(base, rail);
      return g;
    },
    // إدراج في المرسم: تبويب «درابزين» بنفس القياسات
    toStudio(p, mat) {
      // المرسم بيحط عامود بكل طرف: نخلّي فترة واحدة بين عامودين، والمسافة تطلع نفس عدد البلسترات
      const pw = 15, sp = Math.min(40, Math.max(6, Math.floor(((p.L - pw) / p.n) * 2) / 2));
      return { tab: 'balus', set: { run: 'straight', fill: 'bal', bal: 'vase2', L: p.L, H: p.H, bw: Math.min(25, p.bw), sp, pw, ph: p.H + 5, pe: Math.min(500, Math.max(60, p.L)), cap: 'flat', hrH: Math.min(25, p.railH), brH: Math.min(25, p.baseH), mat, mat2: mat } };
    },
  },
};
// قياسات وخامة كل موديل كما في صورته (للموديلات التي لها قالب)
const PRESETS = {
  mslmvej7anbksj: { mat: 'italian', p: { L: 150, H: 90, n: 5, bw: 16, railH: 11, railW: 22, baseH: 7 } },
  mslmwczmsf4l01: { mat: 'black', p: { L: 180, H: 95, n: 7, bw: 13, railH: 10, railW: 18, baseH: 8 } },
  mslmu7ouwrycmi: { mat: 'beigeL', p: { L: 240, H: 95, n: 9, bw: 14, railH: 12, railW: 24, baseH: 10 } },
};

// ---------- واجهة المكتبة ----------
function css() {
  if (document.getElementById('lib-css')) return;
  const st = document.createElement('style'); st.id = 'lib-css';
  st.textContent = `
  #lib{position:fixed;inset:0;z-index:26;background:#F5ECDD;display:none;flex-direction:column;font-family:Cairo,Tahoma,sans-serif;direction:rtl}
  #lib.on{display:flex}
  #lib .lbar{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;background:#3B2414;color:#F5ECDD;flex-wrap:wrap}
  #lib .lbar b{font-size:16px} #lib button{font:inherit;font-weight:800;border:0;border-radius:10px;padding:8px 12px;cursor:pointer;background:#F5ECDD;color:#3B2414}
  #lib button.gold{background:#B88A2A;color:#fff} #lib button.on{background:#B88A2A;color:#fff}
  #lib .secs{display:flex;gap:6px;overflow-x:auto;padding:10px 12px;border-bottom:1px solid #E3D3B5;flex:none}
  #lib .secs button{white-space:nowrap;background:#fff;border:1px solid #E3D3B5;font-weight:700}
  #lib .secs button.on{background:#3B2414;color:#fff}
  #lib input[type=search]{font:inherit;border:1px solid #E3D3B5;border-radius:10px;padding:8px 10px;min-width:180px}
  #lib .grid{flex:1;overflow:auto;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;align-content:start;direction:ltr}
  #lib .grid>*{direction:rtl}
  #lib .card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12);cursor:pointer;display:flex;flex-direction:column;text-align:right;padding:0;border:2px solid transparent}
  #lib .card:hover{border-color:#B88A2A}
  #lib .card img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#EFE6D6;display:block}
  #lib .card .t{padding:8px 10px;font-size:12.5px;font-weight:700;color:#3B2414;line-height:1.5}
  #lib .card .b{margin:0 10px 10px;font-size:11.5px;font-weight:800;border-radius:6px;padding:2px 8px;align-self:flex-start}
  #lib .b.ok{background:#E2F2E8;color:#1F7A47} #lib .b.wait{background:#F3EBDD;color:#8A6D3B}
  #lib .det{flex:1;display:none;min-height:0;direction:ltr}
  #lib .det.on{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) 280px}
  #lib .det>*{direction:rtl;min-height:0}
  #lib .ph{padding:12px;display:flex;flex-direction:column;gap:6px;overflow:auto}
  #lib .ph img{width:100%;border-radius:10px;background:#EFE6D6}
  #lib .ph small{color:#6B5A44}
  #lib .v3{position:relative;background:linear-gradient(#F7F1E6,#E8DCC6)} #lib .v3 canvas{width:100%;height:100%;display:block;touch-action:none}
  #lib .v3 .msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;color:#6B5A44;font-weight:700}
  #lib .prm{padding:12px;overflow:auto;background:#FBF6EE;border-right:1px solid #E3D3B5;display:flex;flex-direction:column;gap:10px}
  #lib .prm label{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#3B2414}
  #lib .prm input{width:90px;font:inherit;padding:6px 8px;border:1px solid #E3D3B5;border-radius:8px;text-align:center}
  #lib .mats{display:flex;gap:6px;flex-wrap:wrap}
  @media (max-width:900px){#lib .det.on{grid-template-columns:1fr;grid-auto-rows:auto 60vh auto;overflow:auto}}`;
  document.head.appendChild(st);
}

function buildUI() {
  if (ui.wrap) return;
  css();
  const w = document.createElement('div'); w.id = 'lib';
  w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'مكتبة الموديلات');
  w.innerHTML = `<div class="lbar"><b id="libTitle">📚 مكتبة الموديلات</b>
      <input type="search" id="libQ" placeholder="ابحث باسم الموديل…">
      <div style="display:flex;gap:6px"><button type="button" id="libBack" style="display:none">→ رجوع للمكتبة</button><button type="button" id="libClose">✕ رجوع للرسم</button></div></div>
    <div class="secs" id="libSecs"></div>
    <div class="grid" id="libGrid"></div>
    <div class="det" id="libDet">
      <div class="ph"><b>الصورة الأصلية من الموقع</b><img id="libImg" alt=""><small id="libCap"></small></div>
      <div class="v3" id="libV3"><div class="msg" id="libMsg"></div></div>
      <div class="prm" id="libPrm"></div>
    </div>`;
  document.body.appendChild(w);
  ui = { wrap: w, secs: w.querySelector('#libSecs'), grid: w.querySelector('#libGrid'), det: w.querySelector('#libDet'), q: w.querySelector('#libQ'), back: w.querySelector('#libBack') };
  w.querySelector('#libClose').onclick = closeLibrary;
  ui.back.onclick = showGrid;
  ui.q.oninput = () => renderGrid();
}

let curSec = 'all';
function renderSecs() {
  const all = [{ key: 'all', name: 'الكل', count: data.total }, ...data.sections];
  ui.secs.innerHTML = all.map(s => `<button type="button" data-k="${s.key}" class="${s.key === curSec ? 'on' : ''}">${s.name} (${s.count})</button>`).join('');
  ui.secs.onclick = e => { const b = e.target.closest('button'); if (!b) return; curSec = b.dataset.k; renderSecs(); renderGrid(); };
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderGrid() {
  const q = ui.q.value.trim();
  const list = data.models.filter(m => (curSec === 'all' || m.section === curSec) && (!q || m.title.includes(q)));
  ui.grid.innerHTML = list.map(m => `<button type="button" class="card" data-id="${m.id}"><img loading="lazy" src="${esc(m.img)}" alt="${esc(m.title)}"><span class="t">${esc(m.title)}</span>
    <span class="b ${m.template ? 'ok' : 'wait'}">${m.template ? '🧊 مجسّم جاهز' : 'بانتظار قالب'}</span></button>`).join('') || '<p style="padding:20px">ما في نتائج.</p>';
  ui.grid.onclick = e => { const c = e.target.closest('.card'); if (c) openModel(c.dataset.id); };
}
function showGrid() {
  ui.det.classList.remove('on'); ui.grid.style.display = ''; ui.secs.style.display = ''; ui.q.style.display = ''; ui.back.style.display = 'none';
  stop3D();
}

// ---------- عارض المجسّم ----------
function init3D(host) {
  if (r3 && r3.host === host) return r3;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
  r3 = { host, renderer, scene, camera, controls, raf: 0, model: null, dirty: true };
  controls.addEventListener('change', () => { r3.dirty = true; });
  const loop = () => { r3.raf = requestAnimationFrame(loop); controls.update(); if (r3.dirty) { size(); renderer.render(scene, camera); r3.dirty = false; } };
  r3.loop = loop;
  return r3;
}
function size() {
  const c = r3.renderer.domElement, w = r3.host.clientWidth, h = r3.host.clientHeight;
  if (!w || !h) return;
  if (c.width !== Math.round(w * r3.renderer.getPixelRatio())) { r3.renderer.setSize(w, h, false); r3.camera.aspect = w / h; r3.camera.updateProjectionMatrix(); }
}
function stop3D() { if (r3 && r3.raf) { cancelAnimationFrame(r3.raf); r3.raf = 0; } }

function showModel(tpl, p, mat, refit) {
  const { scene, camera, controls } = r3;
  if (r3.model) { scene.remove(r3.model); r3.model.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  scene.children.filter(o => o.isLight || o.userData.ground).forEach(o => scene.remove(o));
  const model = tpl.build(p, mat);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(model); r3.model = model;
  const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const S = Math.max(s.x, s.y, s.z);
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x8a7a66, 0.6));
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.4);
  sun.position.set(c.x - S, c.y + S * 1.4, S * 1.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: S * 6 });
  sun.shadow.bias = -0.0004; scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S * 8, S * 8), new THREE.ShadowMaterial({ opacity: 0.25 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.userData.ground = true; scene.add(ground);
  if (refit) {
    const d = S / Math.tan(THREE.MathUtils.degToRad(17.5)) * 0.75;
    camera.position.set(c.x + d * 0.45, c.y + d * 0.3, c.z + d * 0.85);
    controls.target.copy(c); controls.minDistance = S * 0.4; controls.maxDistance = S * 6; controls.update();
  }
  r3.dirty = true;
}

function openModel(id) {
  const m = data.models.find(x => x.id === id); if (!m) return;
  ui.grid.style.display = 'none'; ui.secs.style.display = 'none'; ui.q.style.display = 'none'; ui.back.style.display = '';
  ui.det.classList.add('on');
  ui.wrap.querySelector('#libImg').src = m.img; ui.wrap.querySelector('#libImg').alt = m.title;
  ui.wrap.querySelector('#libCap').textContent = m.title + (m.color ? ' — ' + m.color : '');
  const prm = ui.wrap.querySelector('#libPrm'), msg = ui.wrap.querySelector('#libMsg'), host = ui.wrap.querySelector('#libV3');
  const tpl = m.template && TEMPLATES[m.template];
  if (!tpl) {
    stop3D(); if (r3) r3.renderer.domElement.style.display = 'none';
    msg.style.display = 'flex';
    msg.textContent = 'هذا الموديل ما إله قالب مجسّم بعد. الصورة محفوظة بالمكتبة، والقالب يضاف بالمرحلة القادمة.';
    prm.innerHTML = '';
    return;
  }
  msg.style.display = 'none';
  init3D(host); r3.renderer.domElement.style.display = '';
  const pre = PRESETS[m.id] || { mat: 'beigeL', p: {} };
  const p = Object.fromEntries(tpl.fields.map(([k, , , , d]) => [k, pre.p[k] ?? d]));
  let mat = pre.mat;
  const MT = matsOf();
  prm.innerHTML = `<b>${tpl.name} — القياسات بالسنتيمتر</b>` +
    tpl.fields.map(([k, label, mn, mx]) => `<label>${label}<input type="number" lang="en" inputmode="decimal" data-k="${k}" min="${mn}" max="${mx}" value="${p[k]}"></label>`).join('') +
    `<b>الرخام</b><div class="mats">${['beigeL', 'black', 'italian'].map(k => `<button type="button" data-m="${k}" class="${k === mat ? 'on' : ''}">${MT[k] ? MT[k].name : k}</button>`).join('')}</div>
    <button type="button" class="gold" id="libInsert">➕ أدرج في مشروع جديد</button>
    <small style="color:#6B5A44">الإدراج يفتح تبويب «${tpl.toStudio(p, mat).tab === 'balus' ? 'درابزين' : ''}» بالمرسم بنفس القياسات والرخام، والصورة الأصلية ما بتتغيّر.</small>`;
  prm.oninput = e => {
    const i = e.target.closest('input[data-k]'); if (!i) return;
    const f = tpl.fields.find(x => x[0] === i.dataset.k), v = Number(i.value);
    if (!Number.isFinite(v)) return;
    p[i.dataset.k] = Math.min(f[3], Math.max(f[2], v));
    showModel(tpl, p, mat, false);
  };
  prm.onclick = e => {
    const b = e.target.closest('button[data-m]');
    if (b) { mat = b.dataset.m; prm.querySelectorAll('button[data-m]').forEach(x => x.classList.toggle('on', x === b)); showModel(tpl, p, mat, false); return; }
    if (e.target.id === 'libInsert') insert(tpl, p, mat, m);
  };
  requestAnimationFrame(() => { size(); showModel(tpl, p, mat, true); if (!r3.raf) r3.loop(); });
}

function insert(tpl, p, mat, m) {
  const t = tpl.toStudio(p, mat);
  if (typeof state === 'undefined' || typeof defaults !== 'function') return;
  state[t.tab] = Object.assign(defaults(t.tab), t.set);
  tab = t.tab;                      // المتغيّرات العامة للمرسم
  if (typeof cust !== 'undefined') cust = { name: '', phone: '', addr: '' };
  buildPanel(); render();
  if (typeof updTitle === 'function') updTitle();
  if (typeof toast === 'function') toast('انضاف «' + m.title.split('—')[0].trim() + '» لمشروع جديد');
  closeLibrary();
}

// ---------- الدوال العامة ----------
export async function openLibrary() {
  buildUI();
  ui.wrap.classList.add('on');
  if (!data) {
    ui.grid.innerHTML = '<p style="padding:20px">عم تتحمّل المكتبة…</p>';
    data = await fetch('./models.json?v=' + VER).then(r => r.json());
  }
  renderSecs(); renderGrid(); showGrid();
  return { total: data.total, sections: data.sections.length, withTemplate: data.models.filter(m => m.template).length };
}
export function closeLibrary() { if (ui.wrap) ui.wrap.classList.remove('on'); stop3D(); }
export function openModelById(id) { return openModel(id); }
export { TEMPLATES, PRESETS };
