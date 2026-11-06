// قراءة فقط: بيانات حسابات «قيصر الشام» العامة على فيسبوك وإنستغرام لقسم «تابعونا» بالصفحة الرئيسية
// من Meta Graph API الرسمي. المفتاح بيضل مخفي بـ Cloudflare (META_PAGE_TOKEN_PERM) وما بيطلع للمتصفح أبداً.
// ما في هون أي نشر أو تعديل أو حذف. النتيجة بتنحفظ بالكاش ساعة (طلب واحد لـ Meta بالساعة تقريباً).
const G = 'https://graph.facebook.com/v21.0';
const PAGE_ID = '112512051459689'; // قيصر الشام للحجر والرخام 2 (نفس صفحة facebook.com/baselalakash)
const TTL = 3600;
const json = (o, st = 200, cache = 0) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache ? `public, max-age=${cache}` : 'no-store' } });
const clean = s => String(s || '').replace(/access_token=[^&\s"]+/gi, 'access_token=***').slice(0, 200);

async function gget(path, token) {
  const r = await fetch(`${G}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`);
  const d = await r.json().catch(() => ({}));
  if (d.error) throw new Error(clean(d.error.message || 'graph'));
  return d;
}
// المفتاح المحفوظ قد يكون مفتاح صفحة أو مفتاح مستخدم؛ في الحالة الثانية نأخذ منه مفتاح الصفحة
async function ids(token, env) {
  const want = env.META_PAGE_ID || PAGE_ID;
  let acc = null;
  try { acc = await gget('me/accounts?fields=id,access_token,instagram_business_account{id}&limit=100', token); } catch (e) {}
  const p = acc && (acc.data || []).find(x => x.id === want);
  if (p) return { token: p.access_token, pageId: p.id, igId: env.IG_USER_ID || p.instagram_business_account?.id };
  const pg = await gget(`${want}?fields=id,instagram_business_account{id}`, token);
  return { token, pageId: pg.id, igId: env.IG_USER_ID || pg.instagram_business_account?.id };
}
const short = (s, n = 140) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

async function facebook(t) {
  const p = await gget(`${t.pageId}?fields=name,username,link,about,fan_count,followers_count,picture.type(large){url}`, t.token);
  let posts = [];
  try {
    const d = await gget(`${t.pageId}/posts?fields=permalink_url,full_picture,message,created_time,status_type&limit=24`, t.token);
    posts = (d.data || []).filter(x => x.full_picture && x.permalink_url).slice(0, 6).map(x => ({
      url: x.permalink_url, img: x.full_picture, text: short(x.message), time: x.created_time || '',
      video: /video/i.test(x.status_type || ''),
    }));
  } catch (e) { posts = []; }
  return { name: p.name || '', username: p.username || '', about: short(p.about, 220), followers: p.followers_count || p.fan_count || 0, picture: p.picture?.data?.url || '', posts };
}
async function instagram(t) {
  if (!t.igId) throw new Error('no-ig');
  const p = await gget(`${t.igId}?fields=username,name,biography,profile_picture_url,followers_count,media_count`, t.token);
  const d = await gget(`${t.igId}/media?fields=permalink,media_type,media_url,thumbnail_url,caption,timestamp&limit=12`, t.token);
  const posts = (d.data || []).map(x => ({
    url: x.permalink, img: x.media_type === 'VIDEO' ? (x.thumbnail_url || '') : (x.media_url || x.thumbnail_url || ''),
    text: short(x.caption), time: x.timestamp || '', video: x.media_type === 'VIDEO',
  })).filter(x => x.img && x.url).slice(0, 6);
  return { username: p.username || '', name: p.name || '', bio: short(p.biography, 220), followers: p.followers_count || 0, count: p.media_count || 0, picture: p.profile_picture_url || '', posts };
}

export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== 'GET') return json({ ok: false, error: 'method' }, 405);
  const token = env.META_PAGE_TOKEN_PERM || env.META_PAGE_TOKEN;
  if (!token) return json({ ok: false, error: 'no-key' }, 503);
  const cache = caches.default, ck = new Request(new URL('/api/social-feed?v=1', request.url).toString());
  const hit = await cache.match(ck); if (hit) return hit;
  let t;
  try { t = await ids(token, env); } catch (e) { return json({ ok: false, error: 'ids', detail: clean(e.message) }, 502); }
  const [fb, ig] = await Promise.allSettled([facebook(t), instagram(t)]);
  const out = {
    ok: fb.status === 'fulfilled' || ig.status === 'fulfilled',
    fb: fb.status === 'fulfilled' ? fb.value : null,
    ig: ig.status === 'fulfilled' ? ig.value : null,
    errors: { fb: fb.status === 'rejected' ? clean(fb.reason?.message) : '', ig: ig.status === 'rejected' ? clean(ig.reason?.message) : '' },
  };
  // ما بنخزّن نتيجة ناقصة لساعة كاملة: إذا وحدة فشلت بنخزّنها 5 دقايق بس
  const res = json(out, out.ok ? 200 : 502, out.fb && out.ig ? TTL : (out.ok ? 300 : 0));
  if (out.ok) waitUntil(cache.put(ck, res.clone()));
  return res;
}
