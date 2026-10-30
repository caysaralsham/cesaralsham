import assert from 'node:assert/strict';
const store=new Map();
globalThis.caches={default:{put:async(k,r)=>{store.set(k.url,{body:await r.text(),h:[...r.headers]})},match:async k=>{const x=store.get(k.url);return x?new Response(x.body,{headers:x.h}):undefined}}};
globalThis.HTMLRewriter=class{on(){return this}transform(r){return r}};
let mode='ok',calls=0;
globalThis.fetch=async(url,opt)=>{calls++;
  if(mode==='ok')return new Response('<html><body>APP</body></html>',{status:200,headers:{'content-type':'text/html','x-frame-options':'DENY'}});
  if(mode==='hangThenOk'&&calls===1)return new Promise((_,rej)=>opt.signal.addEventListener('abort',()=>rej(new Error('abort'))));
  if(mode==='hangThenOk')return new Response('<html><body>LATE</body></html>',{status:200,headers:{'content-type':'text/html'}});
  if(mode==='down')throw new Error('network');
  if(mode==='502')return new Response('bad',{status:502});
};
// التشغيل: node qa/tools/test-proxy.mjs  (بيجرّب دالتي المعرض والمعمل بشبكة وهمية)
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const which=process.argv[2]||'maarad';const tmp=path.join(os.tmpdir(),'proxy-'+which+'.mjs');fs.copyFileSync(new URL('../../functions/my/'+which+'/[[path]].js',import.meta.url),tmp);
const {onRequest}=await import(tmp);
const req=(p='',acc='text/html')=>({request:new Request('https://cesar-alcham.com/my/'+which+'/'+p,{headers:{Accept:acc}}),params:{path:p?p.split('/'):[]},waitUntil:x=>x});
// 1) طبيعي
let r=await onRequest(req()); assert.equal(r.status,200); assert.match(await r.text(),/APP/); assert.equal(r.headers.get('x-frame-options'),null); console.log('1 ok: normal 200, copy saved');
// 2) github.io واقع: بنخدم آخر نسخة
mode='down'; calls=0; r=await onRequest(req()); assert.equal(r.status,200); assert.equal(r.headers.get('X-Served-From'),'edge-copy'); assert.match(await r.text(),/APP/); assert.equal(calls,2); console.log('2 ok: upstream down -> edge copy, 2 attempts');
// 3) واقع وما في نسخة: صفحة عربية مع إعادة المحاولة (مش خطأ Cloudflare)
r=await onRequest(req('other.html')); assert.equal(r.status,503); const t=await r.text(); assert.match(t,/إعادة المحاولة/); assert.doesNotMatch(t,/Error|stack|github\.io\/[^m]/); console.log('3 ok: no copy -> friendly 503 page');
// 4) ملف مش HTML وما في نسخة: 503 فاضي
r=await onRequest(req('x.js','*/*')); assert.equal(r.status,503); console.log('4 ok: non-html 503');
// 5) 502 من github: بنعتبره فشل ومنخدم النسخة
mode='502'; r=await onRequest(req()); assert.equal(r.status,200); assert.equal(r.headers.get('X-Served-From'),'edge-copy'); console.log('5 ok: 5xx -> edge copy');
// 6) أول محاولة علّقت: بعد 8 ثواني محاولة تانية بتنجح
mode='hangThenOk'; calls=0; const t0=Date.now(); r=await onRequest(req()); const dt=Date.now()-t0; assert.match(await r.text(),/LATE/); assert.ok(dt<9500&&dt>=7900); console.log('6 ok: hang -> retried after',dt,'ms');
