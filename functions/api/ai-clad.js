// تغليف واجهة بالذكاء الاصطناعي (مرسم ديكور) — بيمرّر الطلب لـ Gemini Image ويرجّع الجواب متل ما هو
// المفتاح محفوظ مشفّر بـ Cloudflare (GEMINI_API_KEY) وما بيطلع للمتصفح.
// السيرفر ما بيفك ولا بيركّب الصور (حتى ما يتجاوز حد المعالجة) — المتصفح بيجهّز الطلب كامل.
// الحماية: لازم تكون مسجّل دخول بحسابك + من موقعنا بس + موديلات صور محددة + حجم محدود + حد الصرف الشهري بحساب Gemini.
const MODELS = ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];
const OK_HOST = /^(cesar-alcham\.com|www\.cesar-alcham\.com|([a-z0-9-]+\.)?cesaralsham\.pages\.dev|localhost|127\.0\.0\.1)$/;
const MAX = 18e6;
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// ---- التحقق إن الطلب من حسابك (Firebase ID token) — بدون هاد ما حدا بيقدر يصرف من رصيد Gemini ----
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
    const owners = String(env.OWNER_UIDS || '').split(',').map(x => x.trim()).filter(Boolean);
    if (owners.length && !owners.includes(pl.sub)) return null;
    return pl.sub;
  } catch (e) { return null; }
}

function hostOf(u) { try { return new URL(u).hostname; } catch (e) { return ''; } }

export async function onRequest({ request, env }) {
  const key = env.GEMINI_API_KEY;
  if (request.method === 'GET') return json({ ok: !!key });
  if (request.method !== 'POST') return json({ ok: false, error: 'post-only' }, 405);
  if (!key) return json({ ok: false, error: 'no-key' }, 503);
  const src = request.headers.get('origin') || request.headers.get('referer') || '';
  if (!OK_HOST.test(hostOf(src))) return json({ ok: false, error: 'forbidden' }, 403);
  if (!(await verifyUser(request, env))) return json({ ok: false, error: 'login' }, 401);
  if (+(request.headers.get('content-length') || 0) > MAX) return json({ ok: false, error: 'too-big' }, 413);
  const m = new URL(request.url).searchParams.get('m') || MODELS[0];
  if (!MODELS.includes(m)) return json({ ok: false, error: 'bad-model' }, 400);
  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ ok: false, error: 'empty' }, 400);
  if (body.byteLength > MAX) return json({ ok: false, error: 'too-big' }, 413);
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body,
  });
  return new Response(g.body, { status: g.status, headers: { 'content-type': g.headers.get('content-type') || 'application/json', 'cache-control': 'no-store', 'x-model': m } });
}
