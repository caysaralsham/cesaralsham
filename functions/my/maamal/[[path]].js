// يعرض برنامج «maamal» (المستضاف على github.io) من نفس موقعنا cesar-alcham.com/my/maamal/
// هيك بيفتح من «أدواتي» كصفحة عادية بلا شريط المتصفح، والطباعة بتضل طبيعية (بلا iframe)
//
// سبب «الصفحة البيضا / تعذر الوصول»: كنا نطلب الصفحة من github.io بلا مهلة وبلا معالجة خطأ —
// إذا github.io تأخر، المتصفح بيضل يستنى بصفحة بيضا لحد ما يقول «تعذر الوصول»، وإذا الطلب فشل
// كان الكود يوقع (خطأ Cloudflare). وبعد ثواني بتنجح لأن github.io رد. الحل:
//  1) مهلة 8 ثواني لكل محاولة + محاولة تانية وحدة
//  2) آخر نسخة ناجحة من كل ملف بتنحفظ بذاكرة Cloudflare؛ إذا github.io ما رد بنخدم هي
//  3) إذا ما في ولا نسخة: صفحة عربية واضحة فيها «إعادة المحاولة» (بلا تفاصيل تقنية)
const UP='https://caysaralsham.github.io/miracos-factory/';
const DROP=['x-frame-options','content-security-policy','set-cookie','x-github-request-id','via','x-served-by','x-cache','x-cache-hits','x-timer','x-fastly-request-id','age','expires'];
async function fetchUp(url,accept){
  for(let i=0;i<2;i++){
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),8000);
    try{const r=await fetch(url,{headers:{'Accept':accept},redirect:'follow',signal:ctl.signal});
      if(r.status<500)return r}catch(e){}finally{clearTimeout(t)}
  }
  return null;
}
const errPage=()=>new Response('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>تعذّر فتح البرنامج</title></head>'+
  '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5ECDD;color:#3B2414;font-family:Cairo,Tahoma,sans-serif;text-align:center;padding:20px;box-sizing:border-box">'+
  '<div><div style="font-size:42px">📶</div><h1 style="font-size:20px;margin:8px 0">البرنامج تأخر بالفتح</h1><p style="margin:0 0 16px">النت ضعيف أو الخادم ما ردّ هلق. بياناتك ما تأثرت.</p>'+
  '<button onclick="location.reload()" style="font:inherit;font-weight:700;padding:10px 22px;border-radius:10px;border:0;background:#9A6A3A;color:#fff;cursor:pointer">إعادة المحاولة</button> '+
  '<a href="'+UP+'" style="display:inline-block;margin-top:10px;font-weight:700;color:#9A6A3A">افتح البرنامج مباشرة</a></div>'+
  '<script>window.addEventListener("online",function(){location.reload()})<\/script></body></html>',
  {status:503,headers:{'content-type':'text/html; charset=utf-8','Cache-Control':'no-store','Retry-After':'5','X-Robots-Tag':'noindex, nofollow'}});
export async function onRequest({request,params,waitUntil}){
  const u=new URL(request.url),rest=[].concat(params.path||[]).join('/');
  if(!rest&&!u.pathname.endsWith('/'))return Response.redirect(u.origin+u.pathname+'/'+u.search,301);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const accept=request.headers.get('Accept')||'*/*',wantsHtml=accept.includes('text/html');
  const cache=(typeof caches!=='undefined'&&caches.default)||null,key=new Request(UP+rest+u.search,{method:'GET'});
  let r=await fetchUp(UP+rest+u.search,accept),stale=false;
  if(r&&r.ok&&cache){const c=new Response(r.clone().body,r);c.headers.set('Cache-Control','public, max-age=2592000');c.headers.delete('set-cookie');
    const p=cache.put(key,c).catch(()=>{});if(waitUntil)waitUntil(p)}
  if(!r&&cache){try{r=await cache.match(key)}catch(e){r=null}stale=!!r}
  if(!r)return wantsHtml?errPage():new Response('',{status:503,headers:{'Cache-Control':'no-store','Retry-After':'5'}});
  const h=new Headers(r.headers);DROP.forEach(k=>h.delete(k));
  h.set('Cache-Control','no-cache');h.set('X-Robots-Tag','noindex, nofollow');if(stale)h.set('X-Served-From','edge-copy');
  if((h.get('content-type')||'').includes('text/html'))h.delete('content-length');
  const res=new Response(request.method==='HEAD'?null:r.body,{status:r.status,headers:h});
  // زر «↩ أدواتي» الصغير (بيبين بس إذا فايت من أدواتي)
  if(request.method==='GET'&&(h.get('content-type')||'').includes('text/html'))
    return new HTMLRewriter().on('body',{element(el){el.append('<script src="/js/my-back.js" defer></script>',{html:true})}}).transform(res);
  return res;
}
