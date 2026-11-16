const { test, expect } = require('@playwright/test');
// ألبوم العمل: عدة صور لنفس القطعة = بطاقة وحدة بالموقع، بتتقلّب صورها. كله ببيانات وهمية (بلا أي اتصال حقيقي).
const ITEMS = `[
   {id:'f0',category:'واجهات منازل حجر',img:'/img/ads/2026-11-pret/pret-01.jpg',title:'واجهة فيلا',createdAt:now-5e6,grp:'G1',gi:0},
   {id:'f1',category:'واجهات منازل حجر',img:'/img/ads/2026-11-pret/pret-02.jpg',title:'واجهة فيلا',createdAt:now-5e6+1,grp:'G1',gi:1},
   {id:'f2',category:'واجهات منازل حجر',img:'/img/ads/2026-11-pret/pret-03.jpg',title:'واجهة فيلا',createdAt:now-1e3,grp:'G1',gi:2},
   {id:'s1',category:'واجهات منازل حجر',img:'/img/ads/2026-11-pret/pret-04.jpg',title:'واجهة منفردة',createdAt:now-9e6},
   {id:'a0',category:'شمينه رخام',img:'/img/ads/2026-11-pret/pret-05.jpg',title:'شمينه كلاسيك',createdAt:now-8e6},
   {id:'a1',category:'شمينه رخام',img:'/img/ads/2026-11-pret/pret-06.jpg',title:'زاوية ثانية',createdAt:now-2e6,grp:'a0'}]`;
const STUB = `(function(){const now=Date.now();
 const docs=[{id:'main',exists:true,data:()=>({settings:{}})},{id:'items_0',exists:true,data:()=>({items:${ITEMS}})}];
 const snap={forEach:f=>docs.forEach(f),docs};
 const col={get:()=>Promise.resolve(snap),onSnapshot:f=>f(snap),doc:()=>({get:()=>Promise.resolve({exists:false,data:()=>({})}),set:()=>Promise.resolve(),onSnapshot:()=>{}})};
 const fs=()=>({collection:()=>col,terminate:()=>Promise.resolve(),enablePersistence:()=>Promise.resolve()});fs.FieldValue={delete:()=>0,increment:()=>0,arrayUnion:()=>0};
 const auth=()=>({setPersistence:()=>Promise.resolve(),onAuthStateChanged:f=>setTimeout(()=>f(null)),currentUser:null,signOut:()=>Promise.resolve()});auth.Auth={Persistence:{LOCAL:1}};
 window.firebase={initializeApp:()=>({}),firestore:fs,auth,storage:()=>({ref:()=>({})}),app:()=>({options:{}})};})();`;
async function stubbed(page, url) {
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/gstatic\.com\/firebasejs\/.*firebase-app-compat\.js/, r => r.fulfill({ contentType: 'application/javascript', body: STUB }));
  await page.route(/gstatic\.com\/firebasejs\/.*firebase-(firestore|auth|storage)-compat\.js/, r => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href) && !/firebasejs/.test(u.href), r => r.abort());
  await page.goto(url);
  return errs;
}

test('أعمالنا: صور نفس العمل بطاقة وحدة بعدد صورها، والعارض بيقلّب بالأسهم والكيبورد وبيتسكّر', async ({ page }) => {
  const errs = await stubbed(page, '/works?category=' + encodeURIComponent('واجهات منازل حجر'));
  await expect(page.locator('#galleryGrid .card')).toHaveCount(2, { timeout: 15000 });   // 3 صور ألبوم + صورة منفردة = بطاقتين
  const alb = page.locator('#galleryGrid .card.alb');
  await expect(alb).toHaveCount(1);
  await expect(alb.locator('.alb-badge')).toHaveText('3 صور');
  expect(await alb.locator('img').getAttribute('src')).toContain('pret-01');            // الغلاف = أول صورة بالترتيب
  await alb.locator('.img-wrap').click();
  const ov = page.locator('#albumOverlay.on');
  await expect(ov.locator('.alb-n')).toHaveText('1 / 3');
  await expect(ov.locator('.alb-th button')).toHaveCount(3);
  await ov.locator('.alb-nav.alb-l').click();                                           // بالعربي: السهم اليسار = التالي
  await expect(ov.locator('.alb-n')).toHaveText('2 / 3');
  expect(await ov.locator('.alb-stage img').getAttribute('src')).toContain('pret-02');
  await page.keyboard.press('ArrowLeft');
  await expect(ov.locator('.alb-n')).toHaveText('3 / 3');
  await page.keyboard.press('ArrowLeft');                                               // بيلفّ لأول صورة
  await expect(ov.locator('.alb-n')).toHaveText('1 / 3');
  await ov.locator('.alb-th button').nth(2).click();
  expect(await ov.locator('.alb-stage img').getAttribute('src')).toContain('pret-03');
  expect(decodeURIComponent(await ov.locator('.alb-price').getAttribute('href'))).toContain('واجهة فيلا');
  await page.keyboard.press('Escape');
  await expect(page.locator('#albumOverlay.on')).toHaveCount(0);
  // الصورة المنفردة: بتفتح بلا أسهم ولا عدّاد
  await page.locator('#galleryGrid .card:not(.alb) .img-wrap').click();
  await expect(page.locator('#albumOverlay.on.alb-one')).toHaveCount(1);
  await expect(page.locator('#albumOverlay .alb-nav').first()).toBeHidden();
  expect(errs).toEqual([]);
});

test('أعمالنا: صور انضافت لعمل موجود (grp = رقم صورته) بتنضم لبطاقته بعد صورته الأصلية', async ({ page }) => {
  await stubbed(page, '/works?category=' + encodeURIComponent('شمينه رخام'));
  const card = page.locator('#galleryGrid .card');
  await expect(card).toHaveCount(1, { timeout: 15000 });
  await expect(card.locator('.alb-badge')).toHaveText('صورتان');
  expect(await card.locator('img').getAttribute('src')).toContain('pret-05');           // الصورة الأصلية بتضل الغلاف
  await expect(card.locator('.title')).toHaveText('شمينه كلاسيك');
});

test('الرئيسية «أحدث أعمالنا»: العمل بعدة صور بيبين مرة وحدة وبصورة غلافه', async ({ page }) => {
  await stubbed(page, '/');
  await expect(page.locator('#homeShowcase .sc-item')).toHaveCount(3, { timeout: 15000 });
  const shown = await page.locator('#homeShowcase .sc-item').evaluateAll(a => a.map(x => [x.querySelector('b').textContent.trim(), x.querySelector('img').getAttribute('src').split('/').pop()]));
  expect(shown).toEqual([['واجهة فيلا', 'pret-01.jpg'], ['شمينه كلاسيك', 'pret-05.jpg'], ['واجهة منفردة', 'pret-04.jpg']]);
});

// لوحة الموقع: ضمّ، غلاف، ترتيب، فكّ — على مخزن وهمي
test('لوحة الموقع: ضمّ صور كعمل واحد، تغيير الغلاف، تحريك العمل كله، وفكّه', async ({ page }) => {
  const errs = []; page.on('pageerror', e => { if (!/firebase|fetch|net::/i.test(e.message)) errs.push(e.message); });
  await page.addInitScript(() => { const P = new Proxy(function () { }, { get: (t, k) => k === 'then' ? undefined : (k === Symbol.toPrimitive ? () => '' : P), apply: () => P });
    const deleg = name => new Proxy({}, { get: (t, k) => window[name] ? (typeof window[name][k] === 'function' ? window[name][k].bind(window[name]) : window[name][k]) : P });
    window.firebase = new Proxy(function () { }, { get: (t, k) => k === 'firestore' ? Object.assign(() => deleg('__db'), { FieldValue: P }) : k === 'storage' ? () => deleg('__st') : k === 'then' ? undefined : P, apply: () => P }); });
  await page.route(u => !/^http:\/\/(127\.0\.0\.1|localhost)/.test(u.href), r => r.abort());
  await page.goto('/admin-works.html'); await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const mk = (id, t, c, at) => ({ id, title: t, category: c, img: '/og-image.jpg', createdAt: at });
    const all = [mk('a', 'واجهة 1', 'واجهات', 50), mk('b', 'واجهة 2', 'واجهات', 40), mk('c', 'واجهة 3', 'واجهات', 30), mk('d', 'واجهة 4', 'واجهات', 20), mk('e', 'شمينه', 'شمينه', 10)];
    const store = { items_0: { items: JSON.parse(JSON.stringify(all)) } };
    const ref = id => ({ id, set: async v => { store[id] = JSON.parse(JSON.stringify(v)); }, delete: async () => { delete store[id]; } });
    window.__db = { collection: () => ({ doc: ref, get: async () => ({ docs: Object.keys(store).map(k => ({ id: k, data: () => JSON.parse(JSON.stringify(store[k])) })) }) }) };
    fbReady = true; items = JSON.parse(JSON.stringify(all)); chunkCache = { items_0: items.slice() }; chunkOf = {}; items.forEach(x => chunkOf[x.id] = 'items_0');
    const sync = () => { chunkCache = { items_0: store.items_0.items.slice() }; };
    const cloud = () => store.items_0.items.map(x => [x.id, x.grp || '', x.gi ?? '', x.order ?? ''].join(':'));
    renderItemsTable();
    const out = {};
    // أقسام مختلفة: ممنوع
    selected.add('a'); selected.add('e'); await joinSelected(); out.mixed = cloud().some(s => /:a:|:e:/.test(s)) || items.some(x => x.grp);
    selected.clear();
    // ضمّ b و d (a هي الأولى بالعرض، بس مش محددة): العمل بياخد رقم b
    selected.add('b'); selected.add('d'); await joinSelected(); sync();
    out.join = cloud();
    out.cards = groupWorks(sortCat(items.filter(x => x.category === 'واجهات'))).map(e => e.pics.map(x => x.id).join('+'));
    out.tags = [...document.querySelectorAll('#itemsTableWrap .acard.in-alb .alb-tag')].map(t => t.textContent.trim());
    // d بتصير الغلاف
    await setAlbumCover('d'); sync();
    out.cover = groupWorks(sortCat(items.filter(x => x.category === 'واجهات'))).map(e => e.pics.map(x => x.id).join('+'));
    // تحريك العمل (b+d) لقدّام: بيتحرك بكل صوره
    await moveItem('b', -1); sync();
    out.moved = groupWorks(sortCat(items.filter(x => x.category === 'واجهات'))).map(e => e.pics.map(x => x.id).join('+'));
    // إضافة c للعمل نفسه
    selected.add('d'); selected.add('c'); await joinSelected(); sync();
    out.join3 = groupWorks(sortCat(items.filter(x => x.category === 'واجهات'))).map(e => e.pics.map(x => x.id).join('+'));
    // فكّ b (رقم العمل هو رقمها): الباقي بيضلوا مع بعض برقم جديد، وb بترجع لحالها
    await ungroupItems(['b']); sync();
    out.split = groupWorks(sortCat(items.filter(x => x.category === 'واجهات'))).map(e => e.pics.map(x => x.id).join('+')).sort();
    out.bClean = !('grp' in store.items_0.items.find(x => x.id === 'b'));
    out.count = store.items_0.items.length;
    return out;
  });
  expect(errs).toEqual([]);
  expect(r.mixed).toBe(false);
  expect(r.cards).toEqual(['a', 'b+d', 'c']);
  expect(r.tags).toEqual(['🖼 غلاف عمل · صورتان', '🗂 2 من 2']);
  expect(r.cover).toEqual(['a', 'd+b', 'c']);
  expect(r.moved).toEqual(['d+b', 'a', 'c']);
  expect(r.join3).toEqual(['d+b+c', 'a']);
  expect(r.split).toEqual(['a', 'b', 'd+c']);
  expect(r.bClean).toBe(true);
  expect(r.count).toBe(5);                                                              // ما انحذف ولا انضاف شي
});

// المنشورات: منشور بعدة صور بينضاف للموقع عملاً واحداً، أو بينضم لعمل موجود
test('المنشورات: عدة صور = عمل واحد على الموقع، وخيار الإضافة إلى عمل موجود', async ({ page }) => {
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href), r => r.abort());
  await page.goto('/my/nashr/'); await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const added = []; siteAdd = async (p, objs) => { added.push(objs); };
    SITE_ITEMS = [{ id: 'old1', category: 'شمينه رخام | Cheminées', title: 'شمينه كلاسيك', createdAt: 5 }];
    $('cat').innerHTML = '<option value="شمينه رخام | Cheminées">شمينه</option>'; $('cat').value = 'شمينه رخام | Cheminées';
    files = [{ url: 'blob:a' }, { url: 'blob:b' }, { url: 'blob:c' }]; renderWork();
    const note = $('workNote').textContent, opts = [...$('siteWork').options].map(o => o.textContent);
    const prep = { media: [{ url: 'https://x/1.jpg' }, { url: 'https://x/2.jpg' }, { url: 'https://x/3.jpg' }], wm: true };
    const o1 = await publishSite('P1', prep);
    $('siteWork').value = 'old1'; renderWork();
    const note2 = $('workNote').textContent;
    const o2 = await publishSite('P2', { media: [{ url: 'https://x/4.jpg' }], wm: false });
    return { note, note2, opts, a1: added[0].map(x => [x.id, x.grp, x.gi]), a2: added[1].map(x => [x.id, x.grp, x.gi === undefined, x.title]), m1: o1.msg, m2: o2.msg };
  });
  expect(r.opts[0]).toBe('عمل جديد'); expect(r.opts[1]).toContain('إضافة إلى: شمينه كلاسيك');
  expect(r.note).toContain('3 صور = عمل واحد');
  expect(r.a1).toEqual([['P1', 'P1', 0], ['P1-1', 'P1', 1], ['P1-2', 'P1', 2]]);
  expect(r.m1).toContain('3 صور كعمل واحد');
  expect(r.note2).toContain('تنضمّ إلى صور هذا العمل');
  expect(r.a2).toEqual([['P2', 'old1', true, 'شمينه كلاسيك']]);                          // بتاخد رقم العمل الموجود وعنوانه، بلا تعديل القديم
  expect(r.m2).toContain('أُضيفت إلى عمل موجود');
});

// صياغة النص داخل المنشورات: تعديل النص المقترح بيمشي على كل المنصات، والنسخة المعدّلة هي اللي بتنضاف للمنشور
test('المنشورات: تعديل النص المقترح يُطبَّق على كل المنصات، و«اعتمد» يضيف النسخة المعدّلة', async ({ page }) => {
  const errs = []; page.on('pageerror', e => { if (!/firebase|Failed to fetch|NetworkError/i.test(e.message)) errs.push(e.message); });
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href), r => r.abort());
  await page.goto('/my/nashr/'); await page.waitForTimeout(600);
  await page.evaluate(() => { const f = document.getElementById('siyPopF'); f.src = '/my/tasweeq/?embed=1&pick=1&kind=image'; });
  const fr = page.frameLocator('#siyPopF'); const frame = () => page.frames().find(f => /\/my\/tasweeq\//.test(f.url()));
  await expect.poll(() => !!frame()).toBe(true);
  await frame().waitForFunction(() => typeof gen === 'function' && document.querySelector('#cat option'));
  const before = await frame().evaluate(() => { gen(); const v = pf => document.querySelector('.out[data-pf="' + pf + '"] .tx').value;
    return { fbTop: !!document.querySelector('#mainBox .out[data-pf="fb"]'), fbCount: document.querySelectorAll('.out[data-pf="fb"]').length, ig: v('ig'), resetHidden: document.getElementById('mainReset').hidden }; });
  expect(before.fbTop).toBe(true); expect(before.fbCount).toBe(1); expect(before.resetHidden).toBe(true);
  // تعديل النص الرئيسي
  const EDIT = 'نافورة رخام مصنوعة حسب الطلب لفيلا في الشراقة';
  const after = await frame().evaluate(EDIT => { const m = document.querySelector('.out[data-pf="fb"] .tx'); m.value = EDIT + '\n' + m.value + ' #a1 #a2 #a3 #a4 #a5 #a6'; m.dispatchEvent(new Event('input', { bubbles: true }));
    const v = pf => document.querySelector('.out[data-pf="' + pf + '"] .tx').value;
    return { ig: v('ig'), pin: v('pin'), tt: v('tt'), yt: v('yt'), igTags: (v('ig').match(/#[^\s#]+/g) || []).length, state: document.getElementById('mainState').textContent, resetHidden: document.getElementById('mainReset').hidden }; }, EDIT);
  expect(after.ig).toContain(EDIT); expect(after.igTags).toBeLessThanOrEqual(5);
  expect(after.pin).toContain(EDIT); expect(after.pin.length).toBeLessThanOrEqual(500);
  expect(after.tt.split('\n')[0]).toBe(EDIT);
  expect(after.yt).toContain(EDIT); expect(after.yt).toContain('🔗');
  expect(after.state).toContain('تعديلك مطبَّق'); expect(after.resetHidden).toBe(false);
  // تخصيص إنستغرام وحدها: ما بتتغيّر بعدها مع النص الرئيسي
  const own = await frame().evaluate(() => { const ig = document.querySelector('.out[data-pf="ig"] .tx'); ig.value = 'نص خاص بإنستغرام'; ig.dispatchEvent(new Event('input', { bubbles: true }));
    const m = document.querySelector('.out[data-pf="fb"] .tx'); m.value = 'سطر جديد\n' + m.value; m.dispatchEvent(new Event('input', { bubbles: true }));
    return { ig: ig.value, follow: !!document.querySelector('.out[data-pf="ig"] .follow'), pin: document.querySelector('.out[data-pf="pin"] .tx').value }; });
  expect(own.ig).toBe('نص خاص بإنستغرام'); expect(own.follow).toBe(true); expect(own.pin).toContain('سطر جديد');
  // «اعتمد»: النسخة المعدّلة بتنضاف للمنشور
  await frame().evaluate(() => document.getElementById('useAll').click());
  await expect.poll(() => page.evaluate(() => document.getElementById('text').value)).toContain('سطر جديد\n' + EDIT);
  const got = await page.evaluate(() => ({ ig: custom.ig, tk: custom.tk, pin: custom.pin }));
  expect(got.ig).toBe('نص خاص بإنستغرام'); expect(got.tk.split('\n')[0]).toBe('سطر جديد'); expect(got.pin).toContain(EDIT);
  // «رجوع للنص المقترح» بيرجّع كل شي
  const back = await frame().evaluate(() => { document.getElementById('mainReset').click(); return { ig: document.querySelector('.out[data-pf="ig"] .tx').value, hidden: document.getElementById('mainReset').hidden }; });
  expect(back.ig).toBe(before.ig); expect(back.hidden).toBe(true);
  expect(errs).toEqual([]);
});

test('المنشورات: بعد مسودة تيك توك بيظهر النص مع زر نسخه وإرساله للهاتف', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href), r => r.abort());
  await page.goto('/my/nashr/'); await page.waitForTimeout(600);
  expect(await page.evaluate(() => document.getElementById('tkAfter').hidden)).toBe(true);
  const T = 'نافورة رخام\nFontaine en marbre\n#marbre';
  await page.evaluate(T => { document.getElementById('login').style.display = 'none'; const a = document.getElementById('tkAfter'); let x = a; while (x && x !== document.body) { x.hidden = false; if (getComputedStyle(x).display === 'none') x.style.display = 'block'; x = x.parentElement; } tkAfterShow(T); }, T);
  await expect(page.locator('#tkAfterTx')).toHaveValue(T);
  expect(decodeURIComponent(await page.locator('#tkAfterWa').getAttribute('href'))).toBe('https://wa.me/?text=' + T);
  await page.evaluate(() => document.getElementById('tkAfterCopy').click());
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(T);
});
