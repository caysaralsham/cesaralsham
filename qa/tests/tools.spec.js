// اختبارات الأدوات الخاصة: لوحة التحكم، الإعدادات، أدواتي، أداة اللوغو، المرسم، واجهتا ميراكوس
const { test, expect } = require('@playwright/test');
const { openOffline, scrollbarOnRight, horizontalOverflow } = require('./helpers');

const TOOLS = {
  'لوحة تحكم الأعمال': '/admin-works.html',
  'الإعدادات العامة': '/links/admin-settings.html',
  'أدواتي': '/my/',
  'أداة اللوغو': '/my/logo/',
  'مرسم ديكور': '/studio-q7m4/',
};

for (const [name, url] of Object.entries(TOOLS)) {
  test.describe(name, () => {
    test('تفتح بدون أخطاء وغير مفهرسة في غوغل', async ({ page }) => {
      const { res, errors } = await openOffline(page, url);
      expect(res.status()).toBe(200);
      expect(errors, 'أخطاء JavaScript غير متوقعة').toEqual([]);
      const robots = await page.$eval('meta[name="robots"]', e => e.content).catch(() => '');
      expect(robots, 'الأدوات الخاصة يجب ألا تظهر في نتائج البحث').toMatch(/noindex/i);
    });

    test.describe('على الكمبيوتر', () => {
      test.use({ viewport: { width: 1366, height: 800 } });
      test('شريط التمرير على اليمين', async ({ page }) => {
        await openOffline(page, url);
        expect(await scrollbarOnRight(page)).toBe(true);
      });
    });

    test.describe('على الجوال', () => {
      test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      test('لا يوجد تمرير أفقي', async ({ page }) => {
        await openOffline(page, url);
        expect(await horizontalOverflow(page)).toEqual([]);
      });
    });
  });
}

test('أدواتي: كل الروابط تشير لصفحات موجودة', async ({ page, request }) => {
  await openOffline(page, '/my/');
  const links = await page.$$eval('a[href^="/"]', as => [...new Set(as.map(a => a.getAttribute('href')))]);
  expect(links.length).toBeGreaterThan(4);
  for (const href of links) {
    const r = await request.get(href);
    expect(r.status(), `الرابط ${href}`).toBe(200);
  }
});

test('واجهتا المعرض والمعمل تفتحان برنامجي ميراكوس الصحيحين', async ({ page }) => {
  await openOffline(page, '/my/maarad/');
  expect(await page.getAttribute('iframe', 'src')).toBe('https://caysaralsham.github.io/miracos-accounting/');
  await openOffline(page, '/my/maamal/');
  expect(await page.getAttribute('iframe', 'src')).toBe('https://caysaralsham.github.io/miracos-factory/');
});

test.describe('مرسم ديكور', () => {
  test('حفظ الصورة يرفض بدون اسم الزبون', async ({ page }) => {
    await openOffline(page, '/studio-q7m4/');
    await page.click('#saveBtn');
    await expect(page.locator('#cGo')).toBeVisible();
    await page.fill('#cName', '');
    await page.click('#cGo');
    await expect(page.locator('#cErr')).toContainText('اسم الزبون');
  });

  test('الطباعة PDF بحجم A4 تعمل', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'PDF متاح في Chromium فقط');
    await openOffline(page, '/studio-q7m4/');
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    expect(pdf.length).toBeGreaterThan(5_000);
  });
});

test.describe('الأرقام لاتينية دائماً (0-9)', () => {
  for (const url of [...Object.values(TOOLS), '/']) {
    test(`حماية الأرقام مفعّلة: ${url}`, async ({ page }) => {
      await openOffline(page, url);
      expect(await page.locator('script#latin-digits').count()).toBe(1);
      const hasIndic = await page.evaluate(() => /[٠-٩]/.test(document.body.innerText));
      expect(hasIndic, 'لا أرقام عربية ظاهرة في الصفحة').toBe(false);
      // خانات الأرقام: لغتها إنكليزية حتى ما يعرضها المتصفح العربي بـ ٠١٢
      const notLatn = await page.$$eval('input[type=number],input[type=date]', els => els.filter(e => e.getAttribute('lang') !== 'en').length);
      expect(notLatn).toBe(0);
    });
  }

  test('المرسم: هاتف الزبون بالأرقام العربية يتحول إلى 0-9', async ({ page }) => {
    await openOffline(page, '/studio-q7m4/');
    await page.click('#saveBtn');
    await expect(page.locator('#cName')).toBeFocused(); // النافذة تضع المؤشر على الاسم أولاً
    await page.locator('#cPhone').click();
    await expect(page.locator('#cPhone')).toBeFocused();
    await page.keyboard.type('٠٥٥٠١٢٣٤٥٦');
    await expect(page.locator('#cPhone')).toHaveValue('0550123456');
  });
});

test('أداة اللوغو: قص إنستغرام بدقة الصورة الأصلية', async ({ page }) => {
  await openOffline(page, '/my/logo/');
  const r = await page.evaluate(() => ({
    p45: cropRect(4032, 3024, 0.8, 'center'), sq: cropRect(3024, 4032, 1, 'a'),
    land: cropRect(2000, 2000, 1.91, 'b'), none: cropRect(4032, 3024, 0, 'center'),
  }));
  expect(r.p45).toEqual({ x: 806, y: 0, w: 2419, h: 3024 });
  expect(r.sq).toEqual({ x: 0, y: 0, w: 3024, h: 3024 });
  expect(r.land).toEqual({ x: 0, y: 953, w: 2000, h: 1047 });
  expect(r.none).toEqual({ x: 0, y: 0, w: 4032, h: 3024 });
});
