// يجيب صورة من تخزين فايربيز تبعنا ويرجّعها من نفس الموقع (حتى لوحة الموقع تقدر تعدّل عليها بالمتصفح)
// محصور بصور مشروعنا بس — مش بروكسي مفتوح
const ALLOW=/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/basel-7b29b\.(firebasestorage\.app|appspot\.com)\/o\/gallery%2F[^?]+\?alt=media(&token=[A-Za-z0-9-]+)?$/;
export async function onRequest({request}){
  const u=new URL(request.url).searchParams.get('u')||'';
  if(!ALLOW.test(u))return new Response('not allowed',{status:400});
  const r=await fetch(u);
  if(!r.ok)return new Response('not found',{status:r.status});
  return new Response(r.body,{headers:{'content-type':r.headers.get('content-type')||'image/jpeg','cache-control':'no-store','x-robots-tag':'noindex'}});
}
