// عرض ثلاثي الأبعاد لمرسم ديكور — يعمل مع كل أنواع الرسم.
// الفكرة: كل شكل بالرسمة يتحول لقطعة رخام مجسّمة بسماكة حقيقية (بالسنتيمتر)، ووجهها يحمل نفس الرسمة
// بكل تفاصيلها وعروقها، مع إضاءة وظلال ولمعة. القياسات تبقى نفس قياسات الرسمة تماماً (1 وحدة = 1 سم).
import * as THREE from './vendor/three-bundle.min.js?v=186';

const ui = {};
let renderer, scene, camera, controls, root, needs = true, raf = 0, fitInfo = null;

function css() {
  if (document.getElementById('v3d-css')) return;
  const st = document.createElement('style');
  st.id = 'v3d-css';
  st.textContent = `
  #v3d{position:fixed;inset:0;z-index:25;background:linear-gradient(#F7F1E6,#E8DCC6);display:none;flex-direction:column}
  #v3d.on{display:flex}
  #v3d .v3bar{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;background:#3B2414;color:#F5ECDD;font-family:Cairo,Tahoma,sans-serif;direction:rtl}
  #v3d .v3bar b{font-size:16px}
  #v3d .v3bar .g{display:flex;gap:6px;flex-wrap:wrap}
  #v3d .v3bar button{font:inherit;font-weight:800;border:0;border-radius:10px;padding:8px 12px;cursor:pointer;background:#F5ECDD;color:#3B2414}
  #v3d .v3bar button.gold{background:#B88A2A;color:#fff}
  #v3d canvas{flex:1;display:block;width:100%;min-height:0;touch-action:none;cursor:grab}
  #v3d .v3hint{position:absolute;bottom:12px;left:0;right:0;text-align:center;font:600 13px Cairo,Tahoma,sans-serif;color:#6B5A44;pointer-events:none;direction:rtl}
  #v3d .v3load{position:absolute;inset:56px 0 0;display:flex;align-items:center;justify-content:center;font:700 16px Cairo,Tahoma,sans-serif;color:#6B5A44;direction:rtl}`;
  document.head.appendChild(st);
}

function buildUI() {
  if (ui.wrap) return;
  css();
  const w = document.createElement('div');
  w.id = 'v3d';
  w.setAttribute('role', 'dialog');
  w.setAttribute('aria-label', 'عرض ثلاثي الأبعاد');
  w.innerHTML = `<div class="v3bar"><b id="v3title">عرض ثلاثي الأبعاد</b><div class="g">
      <button type="button" id="v3front">من قدّام</button>
      <button type="button" id="v3angle">بزاوية</button>
      <button type="button" class="gold" id="v3save">حفظ صورة</button>
      <button type="button" id="v3close">✕ رجوع للرسم</button></div></div>
    <div class="v3load" id="v3load">عم يجهّز المجسّم…</div>
    <div class="v3hint">حرّك بإصبعك أو بالماوس للدوران، وكبّر بإصبعين أو بعجلة الماوس</div>`;
  document.body.appendChild(w);
  ui.wrap = w;
  ui.load = w.querySelector('#v3load');
  w.querySelector('#v3close').onclick = close3D;
  w.querySelector('#v3front').onclick = () => view(0, 4);
  w.querySelector('#v3angle').onclick = () => view(28, 14);
  // الحفظ يمر من نفس نافذة اسم الزبون، والصورة تطلع بالمجسّم بدل الرسم المسطّح
  w.querySelector('#v3save').onclick = () => document.getElementById('saveBtn').click();
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && w.classList.contains('on') && !document.querySelector('.modal.on')) close3D(); });
}

function initThree() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // ألوان الرخام كما هي بالرسمة (بدون تفتيح زائد)
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  ui.wrap.insertBefore(renderer.domElement, ui.load);

  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  camera = new THREE.PerspectiveCamera(32, 1, 1, 100000);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minAzimuthAngle = -THREE.MathUtils.degToRad(75);
  controls.maxAzimuthAngle = THREE.MathUtils.degToRad(75);
  controls.minPolarAngle = THREE.MathUtils.degToRad(25);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(96);
  controls.addEventListener('change', () => { needs = true; });

  const resize = () => {
    if (!ui.wrap.classList.contains('on')) return;
    const c = renderer.domElement, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needs = true;
  };
  window.addEventListener('resize', resize);
  ui.resize = resize;
}

// ---------- تحويل الرسمة لمجسّم ----------
function cleanSVG() {
  const svg = document.getElementById('draw');
  const vb = svg.viewBox.baseVal;
  const cl = svg.cloneNode(true);
  cl.querySelectorAll('.dim, text').forEach(n => n.remove());
  cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return { cl, vb: { x: vb.x, y: vb.y, w: vb.width, h: vb.height } };
}

function rasterize(cl, vb, maxPx) {
  const k = maxPx / Math.max(vb.w, vb.h);
  const W = Math.max(64, Math.round(vb.w * k)), H = Math.max(64, Math.round(vb.h * k));
  const c2 = cl.cloneNode(true);
  c2.setAttribute('width', W);
  c2.setAttribute('height', H);
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c2));
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const x = cv.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, W, H);
      res({ cv, x, W, H });
    };
    img.onerror = rej;
    img.src = src;
  });
}

function shapeArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  return Math.abs(a / 2);
}

async function buildModel() {
  const { cl, vb } = cleanSVG();
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const tex = await rasterize(cl, vb, small ? 1536 : 2048);

  const texture = new THREE.CanvasTexture(tex.cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const data = new THREE.SVGLoader().parse(new XMLSerializer().serializeToString(cl));
  const shapes = [];
  for (const p of data.paths) {
    const st = p.userData && p.userData.style;
    if (!st || !st.fill || st.fill === 'none' || st.fill === 'transparent') continue;
    if ((st.fillOpacity ?? 1) * (st.opacity ?? 1) < 0.15) continue;
    const node = p.userData.node;
    if (node && (node.tagName === 'circle' || node.tagName === 'ellipse')) {
      const n = node, num = a => parseFloat(n.getAttribute(a)) || 0;
      const rx = n.tagName === 'circle' ? num('r') : num('rx'), ry = n.tagName === 'circle' ? num('r') : num('ry');
      const m = n.transform && n.transform.baseVal && n.transform.baseVal.consolidate();
      if (!m && rx > 0 && ry > 0) { shapes.push({ round: true, cx: num('cx'), cy: num('cy'), rx, ry }); continue; }
    }
    const list = THREE.SVGLoader.createShapes ? THREE.SVGLoader.createShapes(p) : p.toShapes(true);
    for (const s of list) shapes.push(s);
  }

  const S = Math.max(vb.w, vb.h);
  const N = Math.max(1, shapes.length);
  const base = S * 0.035;           // سماكة أول طبقة
  const step = (S * 0.06) / N;      // كل شكل مرسوم فوق غيره يبرز أكثر قليلاً
  const bevel = N < 400 ? Math.min(0.6, S * 0.0025) : 0;
  const segs = N < 200 ? 10 : 6;

  const front = new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.32, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.25 });
  const sideMats = new Map();
  const pick = (x, y) => {
    const px = Math.min(tex.W - 1, Math.max(0, Math.round((x - vb.x) / vb.w * tex.W)));
    const py = Math.min(tex.H - 1, Math.max(0, Math.round((y - vb.y) / vb.h * tex.H)));
    return tex.x.getImageData(px, py, 1, 1).data;
  };
  const sideFor = (pts, cx, cy) => {
    const samples = [];
    const n = Math.min(12, pts.length);
    for (let k = 0; k < n; k++) {
      const q = pts[Math.floor(k * pts.length / n)];
      for (const t of [0.12, 0.25]) {
        const d = pick(q.x + (cx - q.x) * t, q.y + (cy - q.y) * t);
        if (d[3] > 20) samples.push(d);
      }
    }
    // خطوط الرسم السوداء ما بتمثّل لون الحجر: نتجاهل الغامق جداً إلا إذا كل العيّنات غامقة
    const lum = d => d[0] * 0.3 + d[1] * 0.59 + d[2] * 0.11;
    if (samples.some(d => lum(d) > 70)) for (let k = samples.length - 1; k >= 0; k--) if (lum(samples[k]) <= 70) samples.splice(k, 1);
    samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
    const d = samples.length ? samples[Math.floor(samples.length / 2)] : [233, 226, 214, 255];
    const key = (d[0] >> 3) + ',' + (d[1] >> 3) + ',' + (d[2] >> 3);
    if (!sideMats.has(key)) {
      const col = d[3] > 20 ? new THREE.Color(`rgb(${d[0]},${d[1]},${d[2]})`) : new THREE.Color('#E9E2D6');
      col.multiplyScalar(0.92);
      sideMats.set(key, new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.45, metalness: 0, clearcoat: 0.3 }));
    }
    return sideMats.get(key);
  };

  // وجه القطعة يأخذ نفس مكانه من الرسمة (الإحداثيات بالسنتيمتر)
  const uvGen = {
    generateTopUV(g, v, a, b, c) {
      const uv = i => new THREE.Vector2((v[i * 3] - vb.x) / vb.w, 1 - ((-v[i * 3 + 1]) - vb.y) / vb.h);
      return [uv(a), uv(b), uv(c)];
    },
    generateSideWallUV(g, v, a, b, c, d) {
      return [new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1), new THREE.Vector2(0, 1)];
    },
  };

  // بعض الرسمات فيها أكثر من منظر (مسقط من فوق + واجهة). المجسّم يُبنى من الواجهة فقط:
  // نجمع الأشكال المتلاصقة بمجموعات، ونبقي المجموعات الواقفة على الأرض.
  // الحمام مرسوم كمخطط مفروش (الأرض والحيطان حواليها)، فنبقيه كاملاً
  const curTab = typeof tab !== 'undefined' ? tab : '';
  const keep = curTab === 'bath' ? new Set(shapes) : mainViewOnly(shapes, S, segs);

  const group = new THREE.Group();
  let i = 0;
  for (const s of shapes) {
    if (!keep.has(s)) { i++; continue; }
    if (s.round) {
      // كرة/بيضاوي: نصف القطر بالعمق = أصغر نصف قطر، وموضوعة فوق طبقتها
      const depth = base + step * i, rz = Math.min(s.rx, s.ry);
      const geo = new THREE.SphereGeometry(1, 48, 32);
      geo.scale(s.rx, s.ry, rz);
      const uv = geo.attributes.uv, pos = geo.attributes.position;
      for (let k = 0; k < uv.count; k++) {
        const x = s.cx + pos.getX(k), y = s.cy - pos.getY(k);
        uv.setXY(k, (x - vb.x) / vb.w, 1 - (y - vb.y) / vb.h);
      }
      const mesh = new THREE.Mesh(geo, front);
      mesh.position.set(s.cx, -s.cy, depth * 0.5);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      i++;
      continue;
    }
    const ex = s.extractPoints(segs);
    if (ex.shape.length < 3 || shapeArea(ex.shape) < S * S * 1e-6) { i++; continue; }
    const flip = pts => pts.map(q => new THREE.Vector2(q.x, -q.y));
    const sh = new THREE.Shape(flip(ex.shape));
    for (const h of ex.holes) sh.holes.push(new THREE.Path(flip(h)));
    const depth = base + step * i;
    const geo = new THREE.ExtrudeGeometry(sh, {
      depth, curveSegments: segs, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, UVGenerator: uvGen,
    });
    let cx = 0, cy = 0;
    for (const q of ex.shape) { cx += q.x; cy += q.y; }
    cx /= ex.shape.length; cy /= ex.shape.length;
    const mesh = new THREE.Mesh(geo, [front, sideFor(ex.shape, cx, cy)]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    i++;
  }
  return { group, vb, S };
}


function bboxOf(s, segs) {
  if (s.round) return [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry];
  const pts = s.extractPoints(segs).shape;
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const q of pts) { a = Math.min(a, q.x); b = Math.min(b, q.y); c = Math.max(c, q.x); d = Math.max(d, q.y); }
  return [a, b, c, d];
}

// يرجّع الأشكال التي تنتمي للمنظر الأمامي الواقف على الأرض (أو كل الأشكال إذا ما في أرض)
export function mainViewOnly(shapes, S, segs) {
  const n = shapes.length, tol = S * 0.03;
  const bb = shapes.map(s => bboxOf(s, segs));
  const par = shapes.map((_, k) => k);
  const find = k => (par[k] === k ? k : (par[k] = find(par[k])));
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const A = bb[a], B = bb[b];
    if (A[0] - tol <= B[2] && B[0] - tol <= A[2] && A[1] - tol <= B[3] && B[1] - tol <= A[3]) par[find(a)] = find(b);
  }
  const groups = new Map();
  shapes.forEach((s, k) => { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(k); });
  const onGround = ks => ks.some(k => Math.abs(bb[k][3]) <= tol);
  const grounded = [...groups.values()].filter(onGround);
  const chosen = grounded.length ? grounded : [...groups.values()];
  return new Set(chosen.flat().map(k => shapes[k]));
}

function lightsAndGround(vb, S, grounded) {
  const hemi = new THREE.HemisphereLight(0xfff8ee, 0x8a7a66, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
  const cx = vb.x + vb.w / 2, cy = -(vb.y + vb.h / 2);
  sun.position.set(cx - S * 0.6, cy + S * 1.1, S * 1.4);
  sun.target.position.set(cx, cy, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S; sc.near = 1; sc.far = S * 5;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = S * 0.0008;
  scene.add(sun, sun.target);

  const catcher = new THREE.ShadowMaterial({ opacity: 0.22 });
  if (grounded) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(S * 6, S * 6), catcher);
    g.rotation.x = -Math.PI / 2;
    g.position.set(cx, 0, 0);
    g.receiveShadow = true;
    scene.add(g);
  } else {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(S * 6, S * 6), catcher);
    wall.position.set(cx, cy, -0.5);
    wall.receiveShadow = true;
    scene.add(wall);
  }
}

function view(azDeg, elDeg) {
  if (!fitInfo) return;
  const { center, dist } = fitInfo;
  const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(elDeg);
  camera.position.set(center.x + dist * Math.sin(az) * Math.cos(el), center.y + dist * Math.sin(el), center.z + dist * Math.cos(az) * Math.cos(el));
  controls.target.copy(center);
  controls.update();
  needs = true;
}

function loop() {
  raf = requestAnimationFrame(loop);
  controls.update();
  if (needs) { renderer.render(scene, camera); needs = false; }
}

export async function open3D() {
  buildUI();
  ui.wrap.classList.add('on');
  ui.load.style.display = 'flex';
  ui.load.textContent = 'عم يجهّز المجسّم…';
  try {
    initThree();
    ui.resize();
    if (root) { scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    scene.clear();
    const t = document.querySelector('#tabs [aria-selected="true"]');
    ui.wrap.querySelector('#v3title').textContent = 'عرض ثلاثي الأبعاد' + (t ? ' — ' + t.textContent : '');
    const { group, vb, S } = await buildModel();
    root = group;
    scene.add(group);
    const grounded = vb.y + vb.h > 0 && vb.y < 0 && !(window.lastR && window.lastR.noGround);
    lightsAndGround(vb, S, grounded);
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const dist = (Math.max(size.x, size.y) / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25 + size.z;
    fitInfo = { center, dist };
    camera.near = Math.max(0.5, dist / 200);
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    controls.minDistance = dist * 0.35;
    controls.maxDistance = dist * 3;
    view(28, 14);
    if (!group.children.length) { ui.load.textContent = 'ما في قطع بالرسمة لنعرضها بالثلاثي — ضيف قطعة أولاً.'; window.view3dActive = false; return { shapes: 0 }; }
    ui.load.style.display = 'none';
    window.view3dActive = true;
    if (!raf) loop();
    return { shapes: group.children.length };
  } catch (e) {
    console.error(e);
    ui.load.textContent = 'ما قدرنا نفتح العرض الثلاثي على هالجهاز: ' + e.message;
    throw e;
  }
}

export function close3D() {
  if (ui.wrap) ui.wrap.classList.remove('on');
  window.view3dActive = false;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
}

// صورة من المجسّم بالحجم المطلوب (تستعملها «حفظ صورة» بدل الرسم المسطّح وقت يكون العرض الثلاثي مفتوح)
export async function snapshot(w, h) {
  if (!renderer || !window.view3dActive) return null;
  const k = Math.min(1, 2400 / Math.max(w, h));
  const W = Math.round(w * k), H = Math.round(h * k);
  const old = new THREE.Vector2();
  renderer.getSize(old);
  const oldPR = renderer.getPixelRatio(), oldAsp = camera.aspect;
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  renderer.setPixelRatio(oldPR);
  renderer.setSize(old.x, old.y, false);
  camera.aspect = oldAsp;
  camera.updateProjectionMatrix();
  needs = true;
  return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}
