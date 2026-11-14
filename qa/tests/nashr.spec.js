const { test, expect } = require('@playwright/test');
// أداة النشر: نص تيك توك الجاهز، ومشاركة الفيديو إلى واتساب مع الموسيقى المختارة. الشبكة مقطوعة: لا نشر ولا رفع.
const open = async page => {
  const errs = []; page.on('pageerror', e => { if (!/firebase|Failed to fetch|NetworkError/i.test(e.message)) errs.push(e.message); });
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href), r => r.abort());
  await page.goto('/my/nashr/');
  await page.evaluate(() => { document.getElementById('app').style.display = 'block'; document.getElementById('login').style.display = 'none'; });
  return errs;
};

test('نص تيك توك: يُجهَّز من النص الرئيسي بلا رابط wa.me، ويُنسخ', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errs = await open(page);
  await page.fill('#text', 'نافورة رخام أبيض للحديقة ⛲\n✔️ قياس حسب الطلب\nFontaine en marbre blanc sur mesure\nhttps://wa.me/213541737888\n📍 دالي إبراهيم\n#نافورة #fontaine');
  await page.click('#tkMake');
  const t = await page.inputValue('#tkText');
  expect(t.split('\n')[0]).toBe('نافورة رخام أبيض للحديقة ⛲');
  expect(t).toContain('Fontaine en marbre blanc sur mesure');
  expect(t).toContain('0541737888');
  expect(t).toContain('https://cesar-alcham.com');
  expect(t).toContain('#fontaine');
  expect(t).not.toMatch(/wa\.me|المعرض|[٠-٩]/);
  expect(await page.evaluate(() => custom.tk)).toBe(t);
  await page.click('#tkCopy');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(t);
  expect(errs).toEqual([]);
});

test('نص تيك توك: منشور الماكينات يأخذ رقم البليدة', async ({ page }) => {
  await open(page);
  await page.fill('#text', 'ماكينة موزاييك للبيع\n📞 0554974470\n📍 البليدة');
  await page.click('#tkMake');
  const t = await page.inputValue('#tkText');
  expect(t).toContain('0554974470'); expect(t).toContain('Blida'); expect(t).not.toContain('0541737888');
});

test('واتساب: الفيديو يُشارك مع الموسيقى المختارة، وبدونها يُشارك الأصلي', async ({ page }) => {
  const errs = await open(page);
  const r = await page.evaluate(async () => {
    document.querySelector('#tabs [data-t=video]').click();
    const f = new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' });
    files = [{ f, hash: 'h1', url: '' }];
    const shared = [], mixed = [];
    window.mixMusic = async (file, key) => { mixed.push(key); return new File([new Uint8Array(20)], file.name.replace(/\.[^.]+$/, '') + '-music.mp4', { type: 'video/mp4' }); };
    navigator.canShare = () => true; navigator.share = async d => { shared.push(d.files[0].name); };
    await document.getElementById('waShare').onclick();
    music = MUS[0].k;
    await document.getElementById('waShare').onclick();
    await document.getElementById('waShare').onclick(); // نفس الملف: لا يُعاد الدمج
    return { shared, mixed, key: MUS[0].k };
  });
  expect(r.shared).toEqual(['clip.mp4', 'clip-music.mp4', 'clip-music.mp4']);
  expect(r.mixed).toEqual([r.key]);
  expect(errs).toEqual([]);
});
