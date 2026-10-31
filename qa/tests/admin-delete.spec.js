const { test, expect } = require('@playwright/test');
test('لوحة الأعمال: حذف صورة بيشيلها من كل المقاطع، وإذا فشل ما بيمسح ملفها وبترجع تبيّن', async ({ page }) => {
  const errs=[]; page.on('pageerror',e=>{ if(!/firebase|fetch|net::/i.test(e.message)) errs.push(e.message); });
  await page.addInitScript(()=>{ const P = new Proxy(function(){}, { get:(t,k)=> k==='then'?undefined:(k===Symbol.toPrimitive?()=>'' :P), apply:()=>P });
    const deleg = name => new Proxy({}, { get:(t,k)=> window[name] ? (typeof window[name][k]==='function' ? window[name][k].bind(window[name]) : window[name][k]) : P });
    window.firebase = new Proxy(function(){}, { get:(t,k)=> k==='firestore' ? Object.assign(()=>deleg('__db'), {FieldValue:P}) : k==='storage' ? ()=>deleg('__st') : k==='then'?undefined:P, apply:()=>P }); });
  await page.route(u => !/^http:\/\/(127\.0\.0\.1|localhost)/.test(u.href), r => r.abort());
  await page.goto('/admin-works.html'); await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const store = { items_0:{items:[{id:'x',title:'a',category:'c'},{id:'y',title:'b',category:'c'}]}, items_1:{items:[{id:'x',title:'a',category:'c'},{id:'z',title:'d',category:'c'}]}, videos_0:{items:[{id:'x',title:'vid'}]}, settings:{a:1} };
    let fail=false; const storageDeletes=[];
    const ref = id => ({ id, set: async v=>{ if(fail) throw new Error('offline'); store[id]=JSON.parse(JSON.stringify(v)); }, delete: async ()=>{ if(fail) throw new Error('offline'); delete store[id]; } });
    window.__db = { collection: ()=>({ doc: ref, get: async ()=>{ if(fail) throw new Error('offline'); return { docs: Object.keys(store).map(k=>({id:k, data:()=>JSON.parse(JSON.stringify(store[k]))})) }; } }),
      runTransaction: async fn => fn({ get: async r=>({exists: !!store[r.id], data:()=>JSON.parse(JSON.stringify(store[r.id]))}), set:(r,v)=>{store[r.id]=JSON.parse(JSON.stringify(v))}, delete:r=>{delete store[r.id]} }) };
    window.__st = { ref: p=>({ delete: async()=>storageDeletes.push(p) }), refFromURL: u=>({ delete: async()=>storageDeletes.push(u) }) };
    fbReady = true; window.confirm = ()=>true;
    items = [{id:'x',title:'a',category:'c',img:'/og-image.jpg'},{id:'y',title:'b',category:'c',img:'/og-image.jpg'},{id:'z',title:'d',category:'c',img:'/og-image.jpg'}];
    renderItemsTable();
    await deleteItem('x');
    const afterOk = JSON.parse(JSON.stringify(store));
    fail = true; const sd0 = storageDeletes.length;
    await deleteItem('y');
    return { afterOk, storageAfterOk: storageDeletes.slice(0,sd0), storageAfterFail: storageDeletes.length - sd0, itemsAfterFail: items.map(i=>i.id).sort() };
  });
  console.log(JSON.stringify(r));
  expect(errs).toEqual([]);
  expect(r.afterOk.items_0.items.map(i=>i.id)).toEqual(['y']);
  expect(r.afterOk.items_1.items.map(i=>i.id)).toEqual(['z']);
  expect(r.afterOk.videos_0.items.map(i=>i.id)).toEqual(['x']);   // الفيديوهات ما انلمست
  expect(r.storageAfterOk).toEqual(['gallery/x.jpg']);
  expect(r.storageAfterFail).toBe(0);                              // فشل الحذف = ما منمسح ملف الصورة
  expect(r.itemsAfterFail).toEqual(['y','z']);                     // ورجعت تبيّن
});
