// اختبارات صفحات الموقع العامة (عربي + فرنسي + صفحات الأعمال + صفحة الباركود/الروابط)
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');
const { openOffline, horizontalOverflow } = require('./helpers');

const ROOT = path.join(__dirname, '..', '..');
const a3mal = dir => fs.readdirSync(path.join(ROOT, dir)).filter(f => /^a3mal-.*\.html$/.test(f)).map(f => (dir === '.' ? '/' : `/${dir}/`) + f);

const PAGES = [
  '/', '/works.html', '/videos.html',
  '/fr/', '/fr/works.html', '/fr/videos.html',
  '/links/',
  ...a3mal('.'), ...a3mal('fr'),
];

for (const url of PAGES) {
  test(`الصفحة تفتح بدون أخطاء: ${url}`, async ({ page }) => {
    const { res, errors } = await openOffline(page, url);
    expect(res.status()).toBe(200);
    expect(errors, 'أخطاء JavaScript غير متوقعة').toEqual([]);
    await expect(page).toHaveTitle(/\S/);
    expect(await page.getAttribute('html', 'lang')).toMatch(/^(ar|fr)/);
    const robots = await page.$eval('meta[name="robots"]', e => e.content).catch(() => '');
    if (!/noindex/i.test(robots)) {
      const desc = await page.$eval('meta[name="description"]', e => e.content).catch(() => '');
      expect(desc && desc.trim().length, 'وصف الصفحة لمحركات البحث').toBeGreaterThan(20);
    }
  });
}

test.describe('على الجوال', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  const MOBILE = ['/', '/works.html', '/videos.html', '/fr/', '/links/', '/a3mal-fontaines-en-marbre.html'];
  for (const w of [360, 414]) test(`لا يوجد تمرير أفقي بعرض ${w}: /`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 800 });
    await openOffline(page, '/');
    expect(await horizontalOverflow(page)).toEqual([]);
  });
  for (const url of MOBILE) {
    test(`لا يوجد تمرير أفقي: ${url}`, async ({ page }) => {
      await openOffline(page, url);
      expect(await horizontalOverflow(page)).toEqual([]);
    });
  }
});

for (const url of ['/', '/works.html', '/links/']) {
  test(`إمكانية الوصول (بدون مشاكل حرجة): ${url}`, async ({ page }) => {
    await openOffline(page, url);
    const r = await new AxeBuilder({ page }).analyze();
    const critical = r.violations.filter(v => v.impact === 'critical').map(v => `${v.id}: ${v.nodes.length}`);
    expect(critical).toEqual([]);
  });
}
