// اختبارات دقة مرسم ديكور: كل أنواع الرسم، كل الخانات، القياسات بالسنتيمتر، والمساحات
const { test, expect } = require('@playwright/test');
const { openOffline } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const { errors } = await openOffline(page, '/studio-q7m4/');
  expect(errors).toEqual([]);
});

test('كل أنواع الرسم تُرسم بدون خطأ بكل قيم الخانات (الأصغر، الأكبر، الوسط، كل الخيارات)', async ({ page }) => {
  const problems = await page.evaluate(() => {
    const out = [];
    const flatC = k => SCHEMAS[k].controls.flatMap(c => (c.type === 'group' ? c.items : [c]));
    for (const k of Object.keys(SCHEMAS)) {
      const tries = [[null, null]];
      for (const c of flatC(k)) {
        if (c.type === 'seg') c.options.forEach(o => tries.push([c.id, o[0]]));
        if (c.type === 'range' || c.type === 'counter') {
          const vals = [c.min, c.max, Math.round(((c.min ?? 0) + (c.max ?? 0)) / 2)].filter(v => v !== undefined);
          vals.forEach(v => tries.push([c.id, v]));
        }
      }
      for (const [id, v] of tries) {
        const st = defaults(k);
        if (id) st[id] = v;
        if (k === 'fountain') applyAuto(st);
        let r;
        try { r = SCHEMAS[k].draw(st); } catch (e) { out.push(`${k}.${id}=${v}: ${e.message}`); continue; }
        if (!r || !r.svg) out.push(`${k}.${id}=${v}: لا رسمة`);
        else if (/NaN|undefined|Infinity/.test(r.svg)) out.push(`${k}.${id}=${v}: قيمة غير صالحة في الرسمة`);
        else if (r.stats.some(s => /NaN|undefined|Infinity/.test(s.join(' ')))) out.push(`${k}.${id}=${v}: قيمة غير صالحة في النتائج`);
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test('كل القياسات المكتوبة على الرسمة بالسنتيمتر (لا متر)', async ({ page }) => {
  const meters = await page.evaluate(() => {
    const out = [];
    for (const k of Object.keys(SCHEMAS)) {
      tab = k; buildPanel(); render();
      for (const t of document.querySelectorAll('#draw text, #insets text'))
        if (/\d\s*م(?![²³.؀-ۿ])/.test(t.textContent)) out.push(`${k}: ${t.textContent}`);
    }
    return out;
  });
  expect(meters).toEqual([]);
});

test('القياس المكتوب على الرسمة يطابق القياس المُدخل', async ({ page }) => {
  const cases = [['door', 'dw', 200, '200 سم'], ['window', 'ow', 137, '137 سم'], ['table', 'L', 150, '150 سم'], ['jurn', 'L', 63, '63']];
  for (const [k, id, v, label] of cases) {
    const texts = await page.evaluate(([k, id, v]) => {
      tab = k; state[k] = defaults(k); state[k][id] = v; buildPanel(); render();
      return [...document.querySelectorAll('#draw text')].map(t => t.textContent);
    }, [k, id, v]);
    expect(texts.some(t => t.includes(label)), `${k}: ${label}`).toBe(true);
  }
});

test('المساحات في النتائج = الطول × العرض', async ({ page }) => {
  const bad = await page.evaluate(() => {
    const out = []; let n = 0;
    const flatC = k => SCHEMAS[k].controls.flatMap(c => (c.type === 'group' ? c.items : [c]));
    for (const k of Object.keys(SCHEMAS)) {
      const variants = [defaults(k)];
      for (const c of flatC(k).filter(c => c.type === 'range')) for (const v of [c.min, c.max]) { const st = defaults(k); st[c.id] = v; variants.push(st); }
      for (const st of variants) {
        if (k === 'fountain') applyAuto(st);
        let r; try { r = SCHEMAS[k].draw(st); } catch (e) { continue; }
        for (const [name, val] of r.stats) {
          const s = String(val).replace(/<[^>]+>/g, '');
          if (/بعد طرح/.test(s)) continue;
          for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)\s*سم\s*=\s*(\d+(?:\.\d+)?)\s*م²/g)) {
            n++;
            const exp = (+m[1]) * (+m[2]) / 10000;
            if (Math.abs(exp - +m[3]) > 0.006) out.push(`${k} «${name}»: ${m[0]} (المتوقع ${exp.toFixed(2)})`);
          }
        }
      }
    }
    return { out: [...new Set(out)], n };
  });
  expect(bad.n).toBeGreaterThan(20);
  expect(bad.out).toEqual([]);
});

test('العرض الثلاثي يفتح لكل أنواع الرسم، وصورة المجسّم تتولّد', async ({ page }) => {
  test.setTimeout(240_000);
  const hasGL = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  test.skip(!hasGL, 'المتصفح هنا بدون WebGL');
  const types = await page.evaluate(() => Object.keys(SCHEMAS));
  const problems = [];
  for (const k of types) {
    const r = await page.evaluate(async k => {
      tab = k; buildPanel(); render();
      const m = await import('./view3d.js?v=2');
      try {
        const o = await m.open3D();
        const img = await m.snapshot(800, 600);
        m.close3D();
        return { shapes: o.shapes, img: img ? img.width : 0 };
      } catch (e) { m.close3D(); return { err: e.message }; }
    }, k);
    if (k === 'calc' && r.shapes === 0) continue; // الحاسبة فاضية افتراضياً
    if (r.err || !(r.shapes > 0) || !(r.img > 0)) problems.push(`${k}: ${JSON.stringify(r)}`);
  }
  expect(problems).toEqual([]);
});

test('زر «ثلاثي الأبعاد» موجود بجانب «حفظ صورة»', async ({ page }) => {
  await expect(page.locator('#v3dBtn')).toBeVisible();
});

test('العرض الثلاثي يأخذ الواجهة فقط ويتجاهل المسقط المرسوم فوقها', async ({ page }) => {
  const kept = await page.evaluate(async () => {
    const T = await import('./vendor/three-bundle.min.js?v=186');
    const m = await import('./view3d.js?v=2');
    const box = (x0, y0, x1, y1) => { const s = new T.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0); return s; };
    const front = box(-25, -30, 25, 0);     // واجهة الجرن واقفة على الأرض
    const plan = box(-25, -120, 25, -80);   // المسقط مرسوم فوقها ومنفصل عنها
    const keep = m.mainViewOnly([front, plan], 120, 8);
    return [keep.has(front), keep.has(plan)];
  });
  expect(kept).toEqual([true, false]);
});

test.describe('مكتبة الموديلات', () => {
  test('المكتبة تفتح وفيها كل أعمال الموقع مقسّمة، والصور روابطها الأصلية', async ({ page }) => {
    await page.click('#libBtn');
    await expect(page.locator('#lib .card').first()).toBeVisible();
    const r = await page.evaluate(async () => {
      const d = await (await fetch('./models.json')).json();
      return { total: d.total, cards: document.querySelectorAll('#lib .card').length, secSum: d.sections.reduce((a, s) => a + s.count, 0),
        imgs: d.models.every(m => /^(https:\/\/firebasestorage\.googleapis\.com\/|data:image\/)/.test(m.img)), ids: new Set(d.models.map(m => m.id)).size };
    });
    expect(r.total).toBeGreaterThan(100);
    expect(r.cards).toBe(r.total);
    expect(r.secSum).toBe(r.total);
    expect(r.ids).toBe(r.total);
    expect(r.imgs).toBe(true);
    // البطاقات لازم تبين بحجمها حتى لو الصورة لسه ما تحمّلت (كانت تنضغط لخط رفيع)
    const h = await page.locator('#lib .card').first().evaluate(e => e.getBoundingClientRect().height);
    expect(h).toBeGreaterThan(150);
  });

  test('موديل الدرابزين يطلع مجسّم ثلاثي حقيقي، والقياسات بتغيّره، والإدراج بيعبّي تبويب الدرابزين', async ({ page }) => {
    await page.click('#libBtn');
    await page.click('#lib .card[data-id=mslmvej7anbksj]');
    await expect(page.locator('#libV3 canvas')).toBeVisible();
    const notLatn = await page.$$eval('#libPrm input[type=number]', els => els.filter(e => e.getAttribute('lang') !== 'en').length);
    expect(notLatn).toBe(0);
    const count = () => page.evaluate(async () => {
      const m = await import('./library.js?v=2');
      const g = m.TEMPLATES.balustrade.build({ L: 150, H: 90, n: +document.querySelector('#libPrm input[data-k=n]').value, bw: 16, railH: 11, railW: 22, baseH: 7 }, 'italian');
      let meshes = 0, tris = 0; g.traverse(o => { if (o.isMesh) { meshes++; tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; } });
      return { meshes, tris };
    });
    const a = await count();
    expect(a.meshes).toBe(5 * 3 + 2);
    expect(a.tris).toBeGreaterThan(5000);
    await page.fill('#libPrm input[data-k=n]', '8');
    expect((await count()).meshes).toBe(8 * 3 + 2);
    await page.click('#libPrm button[data-m=black]');
    await page.click('#libInsert');
    await expect(page.locator('#lib')).toBeHidden();
    const st = await page.evaluate(() => ({ tab, s: state.balus, svg: document.querySelectorAll('svg').length }));
    expect(st.tab).toBe('balus');
    expect(st.s).toMatchObject({ L: 150, H: 90, bw: 16, hrH: 11, brH: 7, mat: 'black', fill: 'bal' });
    const r = await page.evaluate(() => drawBalus(state.balus).stats.flat().join(' '));
    expect(r).toMatch(/\b8\b/);
  });

  test('الموديل بلا قالب يعرض صورته فقط مع توضيح، بدون مجسّم مزيّف', async ({ page }) => {
    await page.click('#libBtn');
    const id = await page.evaluate(async () => (await (await fetch('./models.json')).json()).models.find(m => !m.template).id);
    await page.click(`#lib .card[data-id="${id}"]`);
    await expect(page.locator('#libMsg')).toContainText('ما إله قالب');
  });
});
