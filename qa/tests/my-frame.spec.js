const { test, expect } = require('@playwright/test');
// «أدواتي» → المعرض/المعمل: شاشة تحميل، وإذا البرنامج ما فتح خلال 15 ثانية: رسالة مفهومة + إعادة المحاولة (بدل الصفحة البيضا)
for (const [path, url] of [['/my/maarad/', 'https://caysaralsham.github.io/miracos-accounting/'], ['/my/maamal/', 'https://caysaralsham.github.io/miracos-factory/']]) {
  test(`${path}: البرنامج فتح → شاشة التحميل بتختفي`, async ({ page }) => {
    await page.route(u => u.href.startsWith(url), r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><body>app<script>parent.postMessage({type:'miracos-ready'},'*')</script></body>` }));
    await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href) && !u.href.startsWith(url), r => r.abort());
    await page.goto(path);
    await expect(page.locator('#ld')).toBeHidden({ timeout: 10000 });
  });
  test(`${path}: البرنامج ما ردّ → «تأخر بالفتح» مع إعادة المحاولة وفتح مباشر، وإعادة المحاولة بتنجح`, async ({ page }) => {
    let answer = false;
    await page.clock.install();
    await page.route(u => u.href.startsWith(url), r => answer ? r.fulfill({ contentType: 'text/html', body: `<script>parent.postMessage({type:'miracos-ready'},'*')</script>` }) : r.abort());
    await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href) && !u.href.startsWith(url), r => r.abort());
    await page.goto(path);
    await expect(page.locator('#ld')).toContainText('جاري فتح');
    await page.clock.fastForward(16000);
    await expect(page.locator('#ld')).toContainText('البرنامج تأخر بالفتح');
    await expect(page.locator('#ld a')).toHaveAttribute('href', url);
    answer = true;
    await page.click('#rt');
    await expect(page.locator('#ld')).toBeHidden({ timeout: 10000 });
  });
}
