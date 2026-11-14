const { test, expect } = require('@playwright/test');
// Firebase وهمي: الصفحة الرئيسية بتقرا أعمال وهمية (بلا أي اتصال حقيقي)
const STUB = `(function(){const now=Date.now();
 const docs=[{id:'main',data:()=>({settings:{}})},{id:'items_0',data:()=>({items:[
   {id:'old1',category:'نوافير رخام',img:'/favicon.ico',title:'نافورة قديمة',createdAt:now-90*864e5,cover:true},
   {id:'new1',category:'نوافير رخام',img:'/favicon-32x32.png',title:'نافورة جديدة',createdAt:now-1*864e5},
   {id:'dup1',category:'نوافير رخام',img:'/favicon-32x32.png?v=2',title:'نافورة مكررة',createdAt:now-3*864e5},
   {id:'new2',category:'قسم جديد تماماً',img:'/og-image.jpg',title:'شمينة',createdAt:now-2*864e5}]})}];
 const snap={forEach:f=>docs.forEach(f),docs};
 const col={get:()=>Promise.resolve(snap),onSnapshot:f=>f(snap),doc:()=>({get:()=>Promise.resolve({exists:false,data:()=>({})}),set:()=>Promise.resolve(),onSnapshot:()=>{}})};
 const fs=()=>({collection:()=>col,terminate:()=>Promise.resolve(),enablePersistence:()=>Promise.resolve()});fs.FieldValue={delete:()=>0,increment:()=>0,arrayUnion:()=>0};
 const auth=()=>({setPersistence:()=>Promise.resolve(),onAuthStateChanged:f=>setTimeout(()=>f(null)),currentUser:null,signOut:()=>Promise.resolve()});auth.Auth={Persistence:{LOCAL:1}};
 window.firebase={initializeApp:()=>({}),firestore:fs,auth,storage:()=>({ref:()=>({})}),app:()=>({options:{}})};})();`;
test('«أحدث أعمالنا»: آخر الأعمال الحقيقية أولاً (حد أقصى 6)، والقسم الجديد بروابط الأقسام', async ({ page }) => {
  await page.route(/gstatic\.com\/firebasejs\/.*firebase-app-compat\.js/, r => r.fulfill({ contentType: 'application/javascript', body: STUB }));
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href) && !/firebase-app-compat/.test(u.href), r => r.abort());
  await page.goto('/');
  await expect(page.locator('#homeShowcase .sc-item')).toHaveCount(3, { timeout: 15000 });
  const shown = await page.locator('#homeShowcase .sc-item').evaluateAll(a => a.map(x => [x.querySelector('b').textContent.trim(), decodeURIComponent(x.getAttribute('href'))]));
  // الأحدث أولاً، والضغط بيفتح معرض صور القسم — ونفس الصورة المحفوظة مرتين (dup1) بتبين مرة وحدة بس
  expect(shown).toEqual([['نافورة جديدة', '/works?category=نوافير رخام'], ['شمينة', '/works?category=قسم جديد تماماً'], ['نافورة قديمة', '/works?category=نوافير رخام']]);
  expect(await page.locator('.sc-cats a', { hasText: 'قسم جديد تماماً' }).count()).toBe(1);
  // «أحدث الإضافات» اندمجت بـ«أحدث أعمالنا»
  expect(await page.locator('#homeLatest').count()).toBe(0);
});

test('الصفحة العربية: الوصف بالعربي بس، وزر «اكتشف أعمالنا» بينزل لقسم الأعمال بدون ما يغطيه الهيدر', async ({ page }) => {
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href), r => r.abort());
  await page.goto('/');
  expect(await page.textContent('#heroSubtitle')).not.toMatch(/[A-Za-z]{4}/);
  await page.click('.hero-cta a[href="#works"]');
  await page.waitForTimeout(1200);
  const [top, hh] = await page.evaluate(() => [document.getElementById('works').getBoundingClientRect().top, document.querySelector('header').offsetHeight]);
  expect(top).toBeGreaterThanOrEqual(hh - 2);
});

// Firebase وهمي فيه فيديو واحد (رابط وهمي — بيتلغى أي طلب لبرا الجهاز)
const VSTUB = STUB.replace("{id:'main',data:()=>({settings:{}})}", "{id:'main',data:()=>({settings:{}})},{id:'videos_0',data:()=>({items:[{id:'v1',url:'https://example.invalid/v1.mp4',poster:'/favicon.ico',title:'فيديو تجربة',category:'نوافير رخام',createdAt:now}]})}");
test('معرض الفيديو: ما في تحميل فيديو قبل الضغط، والفيديو بيفتح بنافذة وبيتسكّر', async ({ page }) => {
  const mp4 = [];
  page.on('request', r => { if (/\.mp4/.test(r.url())) mp4.push(r.url()); });
  await page.route(/gstatic\.com\/firebasejs\/.*firebase-app-compat\.js/, r => r.fulfill({ contentType: 'application/javascript', body: VSTUB }));
  await page.route(/gstatic\.com\/firebasejs\/.*firebase-firestore-compat\.js/, r => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href) && !/firebasejs/.test(u.href), r => r.abort());
  await page.goto('/videos');
  await expect(page.locator('.vcard')).toHaveCount(1, { timeout: 15000 });
  await page.waitForTimeout(500);
  expect(mp4.length).toBe(0);
  await page.locator('.vcard .vwatch').click();
  await expect(page.locator('.vp-ov.on video')).toHaveAttribute('src', 'https://example.invalid/v1.mp4');
  await page.keyboard.press('Escape');
  await expect(page.locator('.vp-ov.on')).toHaveCount(0);
});
