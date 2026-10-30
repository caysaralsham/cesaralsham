// قراءة فقط: صور صفحة فيسبوك «قيصر الشام» (للأداة الخاصة «صور فيسبوك» بأدواتي)
// ما في هون أي حذف أو تعديل أو نشر. المفتاح بيضل مخفي بـ Cloudflare، والطلب لازم يكون من حسابك (Firebase).
//  GET ?after=<cursor>   → قائمة الصور (100 بالمرة) مع رابط أكبر نسخة
//  GET ?img=<رابط fbcdn> → الصورة نفسها من نفس موقعنا (حتى المتصفح يقدر يحط عليها الباركود)
const G = 'https://graph.facebook.com/v21.0';
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// ---- التحقق أن الطلب من حسابك (نفس طريقة ai-title.js) ----
const FB_PROJECT = 'basel-7b29b';
let _jwks = null, _jwksAt = 0;
const _b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function _keys(force) {
  if (!force && _jwks && Date.now() - _jwksAt < 3600e3) return _jwks;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('jwks');
  _jwks = (await r.json()).keys || []; _jwksAt = Date.now(); return _jwks;
}
async function verifyUser(request, env) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  if (!m) return null;
  try {
    const [h, p, s] = m[1].trim().split('.');
    const td = new TextDecoder(), hd = JSON.parse(td.decode(_b64u(h))), pl = JSON.parse(td.decode(_b64u(p)));
    if (hd.alg !== 'RS256' || !hd.kid) return null;
    let k = (await _keys()).find(x => x.kid === hd.kid);
    if (!k) k = (await _keys(true)).find(x => x.kid === hd.kid);
    if (!k) return null;
    const key = await crypto.subtle.importKey('jwk', { kty: k.kty, n: k.n, e: k.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, _b64u(s), new TextEncoder().encode(h + '.' + p));
    const now = Date.now() / 1000;
    if (!ok || pl.aud !== FB_PROJECT || pl.iss !== 'https://securetoken.google.com/' + FB_PROJECT) return null;
    if (!(pl.exp > now) || !(pl.iat < now + 300) || !pl.sub) return null;
    let owners = String(env.OWNER_UIDS || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!owners.length) owners = ['dzrssSkOkqSFAcLpO1JkUROQU0D2', 'b9mGtbtfmqRWtW3WDcqL7iBKrig1']; // نفس أصحاب الحساب في قواعد Firebase
    if (!owners.length || !owners.includes(pl.sub)) return null;
    return pl.sub;
  } catch (e) { return null; }
}

async function gget(path, token) {
  const r = await fetch(`${G}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`);
  const d = await r.json().catch(() => ({}));
  if (d.error) throw new Error(d.error.message || 'graph');
  return d;
}
async function gpost(path, params, token) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const r = await fetch(`${G}/${path}`, { method: 'POST', body });
  const d = await r.json().catch(() => ({}));
  if (d.error) throw new Error(d.error.error_user_msg || d.error.message || 'graph');
  return d;
}
const PAGE_ID = '112512051459689'; // قيصر الشام للحجر والرخام 2
// المفتاح المحفوظ قد يكون مفتاح صفحة أو مفتاح مستخدم؛ في الحالة الثانية نأخذ منه مفتاح الصفحة
async function ids(token, env) {
  let acc = null;
  try { acc = await gget('me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100', token); } catch (e) {}
  const p = acc && (acc.data || []).find(x => x.id === (env.META_PAGE_ID || PAGE_ID));
  if (p) return { kind: 'user', token: p.access_token, pageId: p.id, pageName: p.name, igId: env.IG_USER_ID || p.instagram_business_account?.id, igUser: p.instagram_business_account?.username };
  const me = await gget('me?fields=id,name', token);
  const pg = await gget(`${me.id}?fields=instagram_business_account{id,username}`, token);
  return { kind: 'page', token, pageId: me.id, pageName: me.name, igId: env.IG_USER_ID || pg.instagram_business_account?.id, igUser: pg.instagram_business_account?.username };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));


const FBCDN = /^https:\/\/[a-z0-9.-]+\.(fbcdn\.net|cdninstagram\.com)\//i;

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return json({ ok: false, error: 'get-only' }, 405);
  if (!(await verifyUser(request, env))) return json({ ok: false, error: 'login' }, 401);
  const u = new URL(request.url);
  const img = u.searchParams.get('img');
  if (img) {
    if (!FBCDN.test(img)) return json({ ok: false, error: 'not-allowed' }, 400);
    const r = await fetch(img);
    if (!r.ok) return json({ ok: false, error: 'img-' + r.status }, 404);
    return new Response(r.body, { headers: { 'content-type': r.headers.get('content-type') || 'image/jpeg', 'cache-control': 'private, max-age=3600' } });
  }
  const token = env.META_PAGE_TOKEN_PERM || env.META_PAGE_TOKEN;
  if (!token) return json({ ok: false, error: 'no-token' });
  try {
    const I = await ids(token, env);
    const after = u.searchParams.get('after');
    const d = await gget(`${I.pageId}/photos?type=uploaded&fields=id,created_time,images,link,name&limit=100${after ? '&after=' + encodeURIComponent(after) : ''}`, I.token);
    const photos = (d.data || []).map(p => {
      const im = (p.images || []).slice().sort((a, b) => b.width - a.width);
      const big = im.find(x => x.width <= 2048) || im[im.length - 1] || {};
      return { id: p.id, at: p.created_time, src: big.source || '', w: big.width || 0, h: big.height || 0, link: p.link || '', text: String(p.name || '').slice(0, 300) };
    }).filter(p => p.src);
    const next = d.paging && d.paging.next && d.paging.cursors ? d.paging.cursors.after : null;
    return json({ ok: true, photos, next });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }); }
}
