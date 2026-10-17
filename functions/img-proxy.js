// يجيب صورة أو فيديو من تخزين فايربيز تبعنا ويرجّعهم من نفس الموقع (حتى لوحة الموقع تقدر تعدّل عليهم بالمتصفح، وتاخد غلاف من الفيديو)
// محصور بملفات مشروعنا بس — مش بروكسي مفتوح
const ALLOW=/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/basel-7b29b\.(firebasestorage\.app|appspot\.com)\/o\/gallery%2F[^?]+\?alt=media(&token=[A-Za-z0-9-]+)?$/;
export async function onRequest({request}){
  const u=new URL(request.url).searchParams.get('u')||'';
  if(!ALLOW.test(u))return new Response('not allowed',{status:400});
  // الفيديو بيطلب أجزاء (Range) حتى يقدر ينط لثانية معيّنة بدون ما ينزل كلّه
  const range=request.headers.get('range');
  const r=await fetch(u,range?{headers:{range}}:undefined);
  if(!r.ok)return new Response('not found',{status:r.status});
  const h={'content-type':r.headers.get('content-type')||'image/jpeg','cache-control':'no-store','x-robots-tag':'noindex'};
  for(const k of ['content-length','content-range','accept-ranges'])if(r.headers.get(k))h[k]=r.headers.get(k);
  return new Response(r.body,{status:r.status,headers:h});
}
