// نشر مباشر على صفحة فيسبوك وحساب إنستغرام (Graph API الرسمي من Meta)
// المفتاح (Page access token) محفوظ مشفّر في Cloudflare باسم META_PAGE_TOKEN — لا يُكتب في أي ملف ولا يصل للمتصفح.
// لا يقبل إلا طلبات صاحب الحساب (Firebase ID token + OWNER_UIDS)، ولا يقبل إلا ملفات من مخزن الموقع.
// لا يوجد هنا أي حذف أو تعديل لمنشورات قديمة: إنشاء منشور جديد فقط.
const G = 'https://graph.facebook.com/v21.0';
const ALLOW = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/basel-7b29b\.(firebasestorage\.app|appspot\.com)\/o\/gallery%2F[^?]+\?alt=media(&token=[A-Za-z0-9-]+)?$/;
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

async function publishIG(igId, token, items, caption) {
  // صورة واحدة، أو فيديو (ريلز)، أو عدة صور (كاروسيل حتى 10)
  const mk = async (it, child) => {
    const p = it.type === 'video' ? { media_type: child ? 'VIDEO' : 'REELS', video_url: it.url } : { image_url: it.url };
    if (child) p.is_carousel_item = 'true'; else p.caption = caption;
    return (await gpost(`${igId}/media`, p, token)).id;
  };
  const wait = async id => { for (let i = 0; i < 40; i++) { const s = await gget(`${id}?fields=status_code`, token); if (s.status_code === 'FINISHED') return; if (s.status_code === 'ERROR') throw new Error('IG media processing failed'); await sleep(3000); } throw new Error('IG timeout'); };
  let cid;
  if (items.length === 1) { cid = await mk(items[0], false); if (items[0].type === 'video') await wait(cid); }
  else {
    const kids = []; for (const it of items.slice(0, 10)) { const k = await mk(it, true); if (it.type === 'video') await wait(k); kids.push(k); }
    cid = (await gpost(`${igId}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption }, token)).id;
    await wait(cid);
  }
  const r = await gpost(`${igId}/media_publish`, { creation_id: cid }, token);
  let link = ''; try { link = (await gget(`${r.id}?fields=permalink`, token)).permalink || ''; } catch (e) {}
  return { id: r.id, link };
}

async function publishFB(pageId, token, items, caption) {
  if (items.length === 1 && items[0].type === 'video') {
    const r = await gpost(`${pageId}/videos`, { file_url: items[0].url, description: caption }, token);
    return { id: r.id, link: `https://www.facebook.com/${r.id}` };
  }
  if (items.length === 1) {
    const r = await gpost(`${pageId}/photos`, { url: items[0].url, caption }, token);
    return { id: r.post_id || r.id, link: `https://www.facebook.com/${r.post_id || r.id}` };
  }
  // عدة صور: ترفع غير منشورة ثم منشور واحد يجمعها
  const media = [];
  for (const it of items.filter(x => x.type !== 'video').slice(0, 10)) media.push({ media_fbid: (await gpost(`${pageId}/photos`, { url: it.url, published: 'false' }, token)).id });
  const p = { message: caption }; media.forEach((m, i) => p[`attached_media[${i}]`] = JSON.stringify(m));
  const r = await gpost(`${pageId}/feed`, p, token);
  return { id: r.id, link: `https://www.facebook.com/${r.id}` };
}

export async function onRequest({ request, env }) {
  if (!(await verifyUser(request, env))) return json({ ok: false, error: 'login' }, 401);
  const token = env.META_PAGE_TOKEN_PERM || env.META_PAGE_TOKEN;
  if (!token) return json({ ok: false, error: 'no-token' });
  if (request.method === 'GET') { // فحص الربط
    try {
      const I = await ids(token, env); let exp = null;
      try { const d = await gget('debug_token?input_token=' + encodeURIComponent(token), token); exp = d.data ? d.data.expires_at : null; } catch (e) {}
      return json({ ok: true, kind: I.kind, pageId: I.pageId, pageName: I.pageName, igUser: I.igUser, expiresAt: exp });
    } catch (e) { return json({ ok: false, error: String(e.message || e) }); }
  }
  if (request.method !== 'POST') return json({ ok: false, error: 'post-only' }, 405);
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad-json' }, 400); }
  const items = (Array.isArray(b.items) ? b.items : []).filter(x => x && ALLOW.test(String(x.url)) && /^(image|video)$/.test(x.type));
  if (!items.length) return json({ ok: false, error: 'no-media' }, 400);
  const pf = Array.isArray(b.platforms) ? b.platforms : [];
  const out = {};
  let I; try { I = await ids(token, env); } catch (e) { return json({ ok: false, error: String(e.message || e) }); }
  if (pf.includes('ig')) { try { if (!I.igId) throw new Error('حساب إنستغرام غير مربوط بالصفحة'); out.ig = { ok: true, ...(await publishIG(I.igId, I.token, items, String(b.captionIg || '').slice(0, 2200))) }; } catch (e) { out.ig = { ok: false, error: String(e.message || e) }; } }
  if (pf.includes('fb')) { try { out.fb = { ok: true, ...(await publishFB(I.pageId, I.token, items, String(b.captionFb || '').slice(0, 60000))) }; } catch (e) { out.fb = { ok: false, error: String(e.message || e) }; } }
  return json({ ok: true, out });
}
