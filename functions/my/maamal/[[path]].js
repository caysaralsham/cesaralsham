// يعرض برنامج «maamal» (المستضاف على github.io) من نفس موقعنا cesar-alcham.com/my/maamal/
// هيك بيفتح من «أدواتي» كصفحة عادية بلا شريط المتصفح، والطباعة بتضل طبيعية (بلا iframe)
const UP='https://caysaralsham.github.io/miracos-factory/';
export async function onRequest({request,params}){
  const u=new URL(request.url),rest=[].concat(params.path||[]).join('/');
  if(!rest&&!u.pathname.endsWith('/'))return Response.redirect(u.origin+u.pathname+'/'+u.search,301);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const r=await fetch(UP+rest+u.search,{headers:{'Accept':request.headers.get('Accept')||'*/*'},redirect:'follow'});
  const h=new Headers(r.headers);
  ['x-frame-options','content-security-policy','set-cookie','x-github-request-id','via','x-served-by','x-cache','x-cache-hits','x-timer','x-fastly-request-id','age','expires'].forEach(k=>h.delete(k));
  h.set('Cache-Control','no-cache');h.set('X-Robots-Tag','noindex, nofollow');
  return new Response(request.method==='HEAD'?null:r.body,{status:r.status,headers:h});
}
