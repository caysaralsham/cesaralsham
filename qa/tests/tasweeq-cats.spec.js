const { test, expect } = require('@playwright/test');
// أداة المنشورات: نفس أقسام مرسم ديكور (وأقسام الموقع)، وكل قسم بيولّد منشور بلا أخطاء، وشريط الأقسام بيعدّ وبيصفّي
test('المنشورات: أقسام المرسم موجودة وكلها بتولّد نص، والتعرّف التلقائي على النوع صحيح', async ({ page }) => {
  const errs = []; page.on('pageerror', e => { if (!/firebase|Failed to fetch|NetworkError/i.test(e.message)) errs.push(e.message); });
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href), r => r.abort());
  await page.goto('/my/tasweeq/');
  const r = await page.evaluate(() => {
    const need = ['نافورة', 'جرن', 'واجهات', 'مداخل', 'نوافذ', 'شمينة', 'أرضيات', 'حائط', 'لوحات', 'حمامات', 'كورنيش'];
    const names = [...document.querySelectorAll('#cat option')].map(o => o.textContent);
    const missing = need.filter(n => !names.some(t => t.includes(n)));
    const bad = [];
    for (const k of Object.keys(CATS)) { const o = { cat: k, stone: '', detail: '', place: CATS[k].factory ? 'factory' : 'showroom', wilaya: '', lang: 'arfr', style: 1, seed: 'x' };
      try { const out = build(o); const txt = JSON.stringify(out); if (!txt || /undefined|NaN/.test(txt)) bad.push(k); } catch (e) { bad.push(k + ':' + e.message); } }
    const det = { 'كادر نافذة رخام للفيلا': 'fenetre', 'حمام تركي كامل بالرخام': 'bain', 'كورنيش للسقف': 'corniche', 'لوحة رخام باسم العائلة': 'tablo', 'تابلو حائط منحوت': 'mur', 'مدخل فيلا بالحجر': 'entree', 'جرن حمام رخام': 'bassin', 'نافورة حديقة': 'fontaine' };
    const wrong = Object.entries(det).filter(([t, k]) => detectCat(t) !== k).map(([t, k]) => t + '→' + detectCat(t) + ' (المتوقع ' + k + ')');
    return { missing, bad, wrong, first: names.slice(0, 3) };
  });
  expect(r.missing).toEqual([]); expect(r.bad).toEqual([]); expect(r.wrong).toEqual([]);
  expect(r.first[0]).toContain('نافورة'); // ترتيب المرسم أولاً
  expect(errs).toEqual([]);
});
test('المنشورات: شريط الأقسام بيبيّن عدد كل قسم، والكبس عليه بيعرض منشوراته بس', async ({ page }) => {
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href), r => r.abort());
  await page.goto('/my/tasweeq/');
  const r = await page.evaluate(() => {
    for (const [i, c] of ['bain', 'bain', 'fontaine'].entries()) POSTS['k' + i] = { key: 'k' + i, pf: 'fb', status: 'new', cat: c, type: 'post', url: 'https://facebook.com/x' + i, date: '2026-10-0' + (i + 1), original: 'نص ' + i, proposed: 'نص ' + i, history: [] };
    renderList();
    const chip = [...document.querySelectorAll('#catChips [data-cc="bain"]')][0];
    const label = chip.textContent; chip.click();
    return { label, filter: document.getElementById('fCat').value, shown: filtered().map(p => p.cat) };
  });
  expect(r.label).toContain('(2)');
  expect(r.filter).toBe('bain');
  expect(r.shown).toEqual(['bain', 'bain']);
});
