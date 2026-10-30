const CACHE='mirsam-v127';
// النت الضعيف: الصفحة كانت تستنى رد النت للآخر (دقيقة أو أكتر) قبل ما ترجع للنسخة المحفوظة.
// هلق: إذا النت ما رد خلال 3 ثواني بتفتح النسخة المحفوظة فوراً، والنسخة الجديدة بتنحفظ بالخلفية للمرة الجاية.
const NAV_TIMEOUT=3000;
function netOrCache(req,cacheKey){const net=fetch(req,{cache:'no-store'}).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(cacheKey,cp))}return r});
  return caches.match(cacheKey).then(hit=>{if(!hit)return net;return Promise.race([net.catch(()=>hit),new Promise(res=>setTimeout(()=>res(hit),NAV_TIMEOUT))])})}
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(/^\/(api\/|img-proxy|a3mal-)/.test(new URL(e.request.url).pathname))return; // صور وصفحات الموقع والذكاء: من النت دايماً
  if(/manifest\.webmanifest/.test(e.request.url)){e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));return}
  if(e.request.mode==='navigate'&&/[?&]render=1/.test(e.request.url)){e.respondWith(caches.match('./index.html').then(hit=>{const net=fetch(e.request,{cache:'no-store'}).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp));return r}).catch(()=>hit);return hit||net}));return}
  if(e.request.mode==='navigate'){e.respondWith(netOrCache(e.request,'./index.html'));return}
  e.respondWith(caches.open(CACHE).then(async c=>{
    const hit=await c.match(e.request);
    const net=fetch(e.request).then(r=>{if(r&&(r.ok||r.type==='opaque'))c.put(e.request,r.clone());return r}).catch(()=>hit);
    return hit||net;
  }));
});
