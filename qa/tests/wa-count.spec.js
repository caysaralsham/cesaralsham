const { test, expect } = require('@playwright/test');
// عدّاد طلب السعر: كبسة على واتساب بالموقع = طلب واحد لـ Firestore (REST) فيه زيادة 1 واسم العمل، بلا أي بيانات شخصية
test('كبسة واتساب بصفحة قسم بتبعت +1 مع اسم القسم، والكبسة المزدوجة بتنعد وحدة، والزائر بينعد مرة باليوم', async ({ page }) => {
  const sent = [];
  await page.route(/firestore\.googleapis\.com\/v1\/.*:commit/, async r => { sent.push(JSON.parse(r.request().postData())); await r.fulfill({ status: 200, body: '{}' }); });
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href) && !/firestore\.googleapis/.test(u.href), r => r.abort());
  await page.goto('/a3mal-fontaines-en-marbre');
  await page.evaluate(() => { const a = document.createElement('a'); a.href = 'https://wa.me/213541737888?text=' + encodeURIComponent('السلام عليكم، أريد معرفة سعر هذا العمل: نافورة ثلاث صحون'); a.id = 'w'; a.textContent = 'x'; a.target = '_blank'; document.body.appendChild(a);
    a.addEventListener('click', e => e.preventDefault()); a.click(); a.click(); });
  await expect.poll(() => sent.length).toBe(1);
  const w = sent[0].writes[0];
  expect(w.update.name).toMatch(/cesar_price_clicks\/\d{4}-\d{2}-\d{2}$/);
  expect(w.updateTransforms.map(t => t.fieldPath)).toEqual(['count', 'uniq', 'cats.`نافورة ثلاث صحون`']);
  expect(w.updateTransforms[1].increment.integerValue).toBe('1');
  expect(JSON.stringify(sent)).not.toMatch(/0550|541737888/); // ما في رقم الزائر ولا رقمنا
  await page.waitForTimeout(1600);
  await page.click('#w');
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1].writes[0].updateTransforms[1].increment.integerValue).toBe('0'); // نفس الزائر بنفس اليوم
});
test('الأدوات الخاصة ما بتنعد', async ({ page }) => {
  const sent = [];
  await page.route(/firestore\.googleapis\.com/, r => { sent.push(1); r.fulfill({ status: 200, body: '{}' }); });
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href) && !/firestore\.googleapis/.test(u.href), r => r.abort());
  await page.goto('/my/');
  expect(await page.evaluate(() => typeof window.__waHit)).toBe('undefined');
});
