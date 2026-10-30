const { test, expect } = require('@playwright/test');
// Firebase وهمي: الصفحة الرئيسية بتقرا أعمال وهمية (بلا أي اتصال حقيقي)
const STUB = `(function(){const now=Date.now();
 const docs=[{id:'main',data:()=>({settings:{}})},{id:'items_0',data:()=>({items:[
   {id:'old1',category:'نوافير رخام',img:'/favicon.ico',title:'نافورة قديمة',createdAt:now-90*864e5,cover:true},
   {id:'new1',category:'نوافير رخام',img:'/favicon.ico',title:'نافورة جديدة',createdAt:now-1*864e5},
   {id:'new2',category:'قسم جديد تماماً',img:'/favicon.ico',title:'شمينة',createdAt:now-2*864e5}]})}];
 const snap={forEach:f=>docs.forEach(f),docs};
 const col={get:()=>Promise.resolve(snap),onSnapshot:f=>f(snap),doc:()=>({get:()=>Promise.resolve({exists:false,data:()=>({})}),set:()=>Promise.resolve(),onSnapshot:()=>{}})};
 const fs=()=>({collection:()=>col,terminate:()=>Promise.resolve(),enablePersistence:()=>Promise.resolve()});fs.FieldValue={delete:()=>0,increment:()=>0,arrayUnion:()=>0};
 const auth=()=>({setPersistence:()=>Promise.resolve(),onAuthStateChanged:f=>setTimeout(()=>f(null)),currentUser:null,signOut:()=>Promise.resolve()});auth.Auth={Persistence:{LOCAL:1}};
 window.firebase={initializeApp:()=>({}),firestore:fs,auth,storage:()=>({ref:()=>({})}),app:()=>({options:{}})};})();`;
test('عمل جديد بيبين فوراً بالرئيسية: بـ«أحدث الإضافات» تحت قسمه، والقسم الجديد بروابط الأقسام', async ({ page }) => {
  await page.route(/gstatic\.com\/firebasejs\/.*firebase-app-compat\.js/, r => r.fulfill({ contentType: 'application/javascript', body: STUB }));
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href) && !/firebase-app-compat/.test(u.href), r => r.abort());
  await page.goto('/'); 
  await expect(page.locator('#homeLatest .sc-item')).toHaveCount(2, { timeout: 15000 });
  const latest = await page.locator('#homeLatest .sc-item').evaluateAll(a => a.map(x => [x.querySelector('span').textContent.trim(), decodeURIComponent(x.getAttribute('href'))]));
  expect(latest).toEqual([['نوافير رخام', '/works?category=نوافير رخام'], ['قسم جديد تماماً', '/works?category=قسم جديد تماماً']]);
  expect(await page.locator('.sc-cats a', { hasText: 'قسم جديد تماماً' }).count()).toBe(1);
  // القديمة (أكتر من 30 يوم) ما بتبين بأحدث الإضافات، والغلاف المختار للقسم ما تغيّر
  expect(latest.length).toBe(2);
  expect(await page.locator('#homeShowcase .sc-item img[alt^="نافورة قديمة"]').count()).toBe(1);
});
