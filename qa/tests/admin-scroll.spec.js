const { test, expect } = require('@playwright/test');
test('لوحة الأعمال: حذف صورة ما بيطلّع الصفحة لفوق', async ({ page }) => {
  await page.route(u => !/^http:\/\/(127\.0\.0\.1|localhost)/.test(u.href), r => r.abort());
  await page.addInitScript(()=>{ const P = new Proxy(function(){}, { get:(t,k)=> k==='then'?undefined:(k===Symbol.toPrimitive?()=>'' :P), apply:()=>P }); window.firebase = P; });
  await page.setViewportSize({ width: 1200, height: 700 });
  await page.goto('/admin-works.html'); await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    document.querySelectorAll('[id*="login" i]').forEach(e=>e.style.display='none');
    document.body.style.minHeight='4000px';
    items = Array.from({length:60},(_,i)=>({id:'i'+i, img:'data:image/gif;base64,R0lGODlhAQABAAAAACw=', title:'صورة '+i, category: i<30?'نوافير':'مداخن'}));
    openCats.add('img:نوافير');
    renderItemsTable();
    await new Promise(r=>setTimeout(r,300));
    window.scrollTo(0, 1500); await new Promise(r=>setTimeout(r,200));
    const before = window.scrollY;
    window.confirm = ()=>true;
    deleteItem('i20');
    await new Promise(r=>setTimeout(r,600));
    return {before, after: window.scrollY, left: items.length};
  });
  console.log(JSON.stringify(r));
  expect(r.left).toBe(59);
  expect(Math.abs(r.after - r.before)).toBeLessThan(5);
});
