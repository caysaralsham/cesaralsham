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
