// ربط ونشر: YouTube و Pinterest و TikTok (الواجهات الرسمية + OAuth)
// المفاتيح السرية بـ Cloudflare فقط (متغيرات البيئة)، ومفاتيح الوصول بعد الربط بـ Cloudflare KV (SOCIAL_KV) — ما بتوصل للمتصفح أبداً.
// المسارات:
//   GET  /api/oauth/status                 → حالة الربط (صاحب الحساب فقط)
//   POST /api/oauth/connect/{pf}           → رابط صفحة الموافقة الرسمية للمنصة
//   GET  /api/oauth/{pf}?code=&state=      → رجوع المنصة بعد الموافقة (Redirect URI)
//   GET  /api/oauth/boards                 → لوحات Pinterest
//   POST /api/oauth/publish/{pf}           → نشر (فيديو يوتيوب، دبوس Pinterest، فيديو تيك توك)
// ما في أي حذف أو تعديل لمنشورات قديمة.

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


const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const SITE = 'https://cesar-alcham.com';
const ALLOW = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/basel-7b29b\.(firebasestorage\.app|appspot\.com)\/o\/gallery%2F[^?]+\?alt=media(&token=[A-Za-z0-9-]+)?$/;
const clean = s => String(s || '').replace(/(access_token|refresh_token|client_secret)=[^&\s"]+/gi, '$1=***').slice(0, 300);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const redirect = pf => `${SITE}/api/oauth/${pf}`;

// ---------- إعدادات كل منصة ----------
const PF = {
  youtube: {
    name: 'YouTube',
    id: env => env.YT_CLIENT_ID || '1025769465563-j75ajpa6aht9b23ln633i5o39uv6ddn9.apps.googleusercontent.com',
    secret: env => env.YT_CLIENT_SECRET,
    auth: (env, state) => 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: PF.youtube.id(env), redirect_uri: redirect('youtube'), response_type: 'code', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly', state }),
    token: async (env, params) => {
      const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: PF.youtube.id(env), client_secret: PF.youtube.secret(env), ...params }) });
      const d = await r.json().catch(() => ({})); if (!r.ok || !d.access_token) throw new Error('YouTube token: ' + clean(d.error_description || d.error || r.status)); return d;
    },
    who: async tok => { const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { authorization: 'Bearer ' + tok } }); const d = await r.json(); const c = (d.items || [])[0]; return c ? { name: c.snippet.title, id: c.id } : { name: '' }; },
  },
  pinterest: {
    name: 'Pinterest',
    id: env => env.PINTEREST_APP_ID,
    secret: env => env.PINTEREST_APP_SECRET,
    api: env => env.PINTEREST_API || 'https://api.pinterest.com',
    auth: (env, state) => 'https://www.pinterest.com/oauth/?' + new URLSearchParams({ client_id: PF.pinterest.id(env), redirect_uri: redirect('pinterest'), response_type: 'code', scope: 'boards:read,pins:read,pins:write,user_accounts:read', state }),
    token: async (env, params) => {
      const r = await fetch(PF.pinterest.api(env) + '/v5/oauth/token', { method: 'POST', headers: { authorization: 'Basic ' + btoa(PF.pinterest.id(env) + ':' + PF.pinterest.secret(env)), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
      const d = await r.json().catch(() => ({})); if (!r.ok || !d.access_token) throw new Error('Pinterest token: ' + clean(d.message || r.status)); return d;
    },
    who: async (tok, env) => { const r = await fetch(PF.pinterest.api(env) + '/v5/user_account', { headers: { authorization: 'Bearer ' + tok } }); const d = await r.json(); return { name: d.username || '' }; },
  },
  tiktok: {
    name: 'TikTok',
    id: env => env.TIKTOK_CLIENT_KEY,
    secret: env => env.TIKTOK_CLIENT_SECRET,
    auth: (env, state) => 'https://www.tiktok.com/v2/auth/authorize/?' + new URLSearchParams({ client_key: PF.tiktok.id(env), redirect_uri: redirect('tiktok'), response_type: 'code', scope: 'user.info.basic,video.publish,video.upload', state }),
    token: async (env, params) => {
      const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: PF.tiktok.id(env), client_secret: PF.tiktok.secret(env), ...params }) });
      const d = await r.json().catch(() => ({})); if (!r.ok || !d.access_token) throw new Error('TikTok token: ' + clean(d.error_description || d.error || r.status)); return d;
    },
    who: async tok => { const r = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,username', { headers: { authorization: 'Bearer ' + tok } }); const d = await r.json(); const u = (d.data || {}).user || {}; return { name: u.username || u.display_name || '' }; },
  },
};
const configured = (env, pf) => !!(env.SOCIAL_KV && PF[pf].id(env) && PF[pf].secret(env));

// ---------- مفاتيح الوصول (KV) ----------
async function saveTok(env, pf, d, extra = {}) {
  const old = JSON.parse(await env.SOCIAL_KV.get('tok:' + pf) || '{}');
  const t = { ...old, ...extra, access: d.access_token, refresh: d.refresh_token || old.refresh, exp: Date.now() + (Number(d.expires_in || 3600) - 120) * 1000, at: Date.now() };
  await env.SOCIAL_KV.put('tok:' + pf, JSON.stringify(t)); return t;
}
async function getTok(env, pf) {
  const t = JSON.parse(await env.SOCIAL_KV.get('tok:' + pf) || 'null');
  if (!t) throw new Error(PF[pf].name + ' غير مربوط');
  if (t.exp > Date.now()) return t;
  if (!t.refresh) throw new Error(PF[pf].name + ': انتهت صلاحية الربط — اربطه من جديد');
  const d = await PF[pf].token(env, { grant_type: 'refresh_token', refresh_token: t.refresh });
  return saveTok(env, pf, d);
}

// ---------- ملف المصدر ----------
async function source(url) {
  if (!ALLOW.test(String(url))) throw new Error('رابط ملف غير مسموح');
  const r = await fetch(url); if (!r.ok) throw new Error('تعذر قراءة الملف (' + r.status + ')');
  const len = Number(r.headers.get('content-length') || 0); if (!len) throw new Error('حجم الملف غير معروف');
  return { r, len, type: r.headers.get('content-type') || 'application/octet-stream' };
}
const fixed = (r, len) => { const { readable, writable } = new FixedLengthStream(len); r.body.pipeTo(writable); return readable; };

// ---------- YouTube ----------
async function pubYouTube(env, b) {
  const t = await getTok(env, 'youtube');
  const v = (b.items || []).find(x => x.type === 'video'); if (!v) throw new Error('يوتيوب يقبل الفيديو فقط');
  const src = await source(v.url);
  const meta = { snippet: { title: String(b.title || 'قيصر الشام للحجر والرخام').slice(0, 100), description: String(b.text || '').slice(0, 5000), categoryId: '26', defaultLanguage: 'ar' }, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false } };
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { method: 'POST', headers: { authorization: 'Bearer ' + t.access, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': src.type.startsWith('video/') ? src.type : 'video/mp4', 'x-upload-content-length': String(src.len) }, body: JSON.stringify(meta) });
  if (!init.ok) throw new Error('YouTube: ' + clean((await init.text()).slice(0, 300)));
  const loc = init.headers.get('location');
  const up = await fetch(loc, { method: 'PUT', headers: { 'content-length': String(src.len), 'content-type': src.type.startsWith('video/') ? src.type : 'video/mp4' }, body: fixed(src.r, src.len) });
  const d = await up.json().catch(() => ({})); if (!up.ok || !d.id) throw new Error('YouTube: ' + clean(JSON.stringify(d.error || d).slice(0, 300)));
  let note = '';
  if (d.status && d.status.privacyStatus !== 'public') note = 'يوتيوب رفعه «' + d.status.privacyStatus + '» (خاص) لأن المشروع لم يُراجَع بعد من Google';
  if (b.cover && ALLOW.test(b.cover)) { try { const c = await source(b.cover); const tr = await fetch('https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=' + d.id, { method: 'POST', headers: { authorization: 'Bearer ' + t.access, 'content-type': 'image/jpeg', 'content-length': String(c.len) }, body: fixed(c.r, c.len) }); if (!tr.ok) note += (note ? ' — ' : '') + 'لم تُقبل صورة الغلاف (يوتيوب يشترط توثيق القناة للأغلفة المخصصة)'; } catch (e) {} }
  return { id: d.id, link: 'https://youtu.be/' + d.id, privacy: d.status && d.status.privacyStatus, note };
}

// ---------- Pinterest ----------
async function pinApi(env, t, path, opt = {}) {
  const r = await fetch(PF.pinterest.api(env) + path, { ...opt, headers: { authorization: 'Bearer ' + t.access, 'content-type': 'application/json', ...(opt.headers || {}) } });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error('Pinterest: ' + clean(d.message || r.status)); return d;
}
async function pubPinterest(env, b) {
  const t = await getTok(env, 'pinterest');
  const board = String(b.board || t.board || ''); if (!board) throw new Error('اختر لوحة Pinterest');
  const items = (b.items || []).filter(x => ALLOW.test(String(x.url)));
  const text = String(b.text || ''), title = String(b.title || text.split('\n')[0] || 'قيصر الشام للحجر والرخام').slice(0, 100);
  const pin = { board_id: board, title, description: text.slice(0, 500), link: String(b.link || SITE), alt_text: title.slice(0, 500) };
  if (items[0] && items[0].type === 'video') {
    const m = await pinApi(env, t, '/v5/media', { method: 'POST', body: JSON.stringify({ media_type: 'video' }) });
    const src = await source(items[0].url); if (src.len > 95e6) throw new Error('الفيديو أكبر من 95 ميغا — Pinterest عبر هذه الأداة');
    const fd = new FormData(); for (const [k, v] of Object.entries(m.upload_parameters || {})) fd.append(k, v);
    fd.append('file', new Blob([await src.r.arrayBuffer()], { type: src.type }), 'video.mp4');
    const up = await fetch(m.upload_url, { method: 'POST', body: fd }); if (!up.ok && up.status !== 204) throw new Error('Pinterest: تعذر رفع الفيديو (' + up.status + ')');
    let st = ''; for (let i = 0; i < 40; i++) { await sleep(3000); st = (await pinApi(env, t, '/v5/media/' + m.media_id)).status; if (st === 'succeeded') break; if (st === 'failed') throw new Error('Pinterest: فشلت معالجة الفيديو'); }
    if (st !== 'succeeded') throw new Error('Pinterest: الفيديو ما زال قيد المعالجة — جرّب لاحقاً');
    pin.media_source = { source_type: 'video_id', media_id: m.media_id, cover_image_url: ALLOW.test(String(b.cover || '')) ? b.cover : undefined };
  } else if (items.length > 1) pin.media_source = { source_type: 'multiple_image_urls', items: items.slice(0, 5).map(x => ({ url: x.url })) };
  else if (items.length) pin.media_source = { source_type: 'image_url', url: items[0].url };
  else throw new Error('لا توجد صورة');
  const d = await pinApi(env, t, '/v5/pins', { method: 'POST', body: JSON.stringify(pin) });
  return { id: d.id, link: 'https://www.pinterest.com/pin/' + d.id + '/' };
}

// ---------- TikTok ----------
async function tkApi(t, path, body) {
  const r = await fetch('https://open.tiktokapis.com' + path, { method: 'POST', headers: { authorization: 'Bearer ' + t.access, 'content-type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({})); if (!r.ok || (d.error && d.error.code && d.error.code !== 'ok')) throw new Error('TikTok: ' + clean((d.error && (d.error.message || d.error.code)) || r.status)); return d.data || {};
}
async function pubTikTok(env, b) {
  const t = await getTok(env, 'tiktok');
  const v = (b.items || []).find(x => x.type === 'video'); if (!v) throw new Error('تيك توك: فيديو فقط');
  const ci = await tkApi(t, '/v2/post/publish/creator_info/query/');
  const opts = ci.privacy_level_options || []; const privacy = opts.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : (opts[0] || 'SELF_ONLY');
  const head = await fetch(v.url, { method: 'HEAD' }); const size = Number(head.headers.get('content-length') || 0); if (!size) throw new Error('حجم الفيديو غير معروف');
  const CH = 10 * 1024 * 1024; const single = size <= 64 * 1024 * 1024; const chunk = single ? size : CH; const count = single ? 1 : Math.floor(size / CH);
  const init = await tkApi(t, '/v2/post/publish/video/init/', { post_info: { title: String(b.text || b.title || '').slice(0, 2200), privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false, video_cover_timestamp_ms: 1000 }, source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunk, total_chunk_count: count } });
  for (let i = 0; i < count; i++) {
    const a = i * chunk, z = i === count - 1 ? size - 1 : a + chunk - 1, n = z - a + 1;
    const part = await fetch(v.url, { headers: { range: `bytes=${a}-${z}` } }); if (!part.ok) throw new Error('تعذر قراءة جزء الفيديو');
    const up = await fetch(init.upload_url, { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-length': String(n), 'content-range': `bytes ${a}-${z}/${size}` }, body: fixed(part, n) });
    if (!up.ok && up.status !== 206 && up.status !== 201) throw new Error('TikTok: تعذر رفع الفيديو (' + up.status + ')');
  }
  let s = {}; for (let i = 0; i < 40; i++) { await sleep(4000); s = await tkApi(t, '/v2/post/publish/status/fetch/', { publish_id: init.publish_id }); if (s.status === 'PUBLISH_COMPLETE' || s.status === 'FAILED') break; }
  if (s.status === 'FAILED') throw new Error('TikTok: ' + clean(s.fail_reason || 'فشل النشر'));
  const id = (s.publicaly_available_post_id || [])[0]; const user = ci.creator_username || 'cesaralcham';
  const note = privacy !== 'PUBLIC_TO_EVERYONE' ? 'نُشر خاصاً (' + privacy + ') لأن تطبيق تيك توك لم يجتز المراجعة بعد' : (s.status !== 'PUBLISH_COMPLETE' ? 'قيد المعالجة في تيك توك' : '');
  return { id: id || init.publish_id, link: id ? `https://www.tiktok.com/@${user}/video/${id}` : `https://www.tiktok.com/@${user}`, privacy, note };
}

// ---------- الموجّه ----------
const page = (msg, ok) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Tahoma,sans-serif;background:#F5ECDD;color:#3B2414;text-align:center;padding:40px 16px" dir="rtl"><h2>${ok ? '✓' : '⚠️'} ${msg}</h2><p><a href="/my/nashr/" style="color:#9A6A3A;font-weight:700">الرجوع إلى المنشورات</a></p><script>setTimeout(()=>location.href='/my/nashr/?connected=1',${ok ? 1500 : 60000})</script>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequest({ request, env, params }) {
  const parts = [].concat(params.path || []); const [a, b] = parts; const url = new URL(request.url);
  // رجوع المنصة بعد الموافقة
  if (PF[a] && !b && request.method === 'GET') {
    if (!env.SOCIAL_KV) return page('مخزن المفاتيح (SOCIAL_KV) غير مفعّل في Cloudflare', false);
    const err = url.searchParams.get('error'); if (err) return page('لم تتم الموافقة: ' + clean(url.searchParams.get('error_description') || err), false);
    const state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
    const ok = state && await env.SOCIAL_KV.get('st:' + a + ':' + state); if (!ok || !code) return page('انتهت صلاحية طلب الربط — حاول من جديد', false);
    await env.SOCIAL_KV.delete('st:' + a + ':' + state);
    try {
      const d = await PF[a].token(env, { grant_type: 'authorization_code', code, redirect_uri: redirect(a) });
      let who = {}; try { who = await PF[a].who(d.access_token, env); } catch (e) {}
      await saveTok(env, a, d, { name: who.name || '' });
      return page('تم ربط ' + PF[a].name + (who.name ? ' — ' + who.name : ''), true);
    } catch (e) { return page(clean(e.message), false); }
  }
  if (!(await verifyUser(request, env))) return json({ ok: false, error: 'login' }, 401);
  try {
    if (a === 'status') {
      const out = {}; for (const k of Object.keys(PF)) { const c = configured(env, k); let t = null; if (c) t = JSON.parse(await env.SOCIAL_KV.get('tok:' + k) || 'null'); out[k] = { configured: c, connected: !!(t && (t.refresh || t.exp > Date.now())), name: t ? t.name || '' : '', board: t ? t.board || '' : '', missing: c ? [] : [!env.SOCIAL_KV && 'SOCIAL_KV', !PF[k].id(env) && 'ID', !PF[k].secret(env) && 'SECRET'].filter(Boolean) }; }
      return json({ ok: true, ...out });
    }
    if (a === 'connect' && PF[b] && request.method === 'POST') {
      if (!configured(env, b)) return json({ ok: false, error: PF[b].name + ' غير مُعدّ بعد في Cloudflare' });
      const state = crypto.randomUUID(); await env.SOCIAL_KV.put('st:' + b + ':' + state, '1', { expirationTtl: 900 });
      return json({ ok: true, url: PF[b].auth(env, state) });
    }
    if (a === 'boards') {
      const t = await getTok(env, 'pinterest'); const d = await pinApi(env, t, '/v5/boards?page_size=100');
      return json({ ok: true, boards: (d.items || []).map(x => ({ id: x.id, name: x.name })), board: t.board || '' });
    }
    if (a === 'board' && request.method === 'POST') { const bd = await request.json(); const t = JSON.parse(await env.SOCIAL_KV.get('tok:pinterest') || '{}'); t.board = String(bd.board || ''); await env.SOCIAL_KV.put('tok:pinterest', JSON.stringify(t)); return json({ ok: true }); }
    if (a === 'publish' && PF[b] && request.method === 'POST') {
      if (!configured(env, b)) return json({ ok: false, error: PF[b].name + ' غير مُعدّ بعد في Cloudflare' });
      const body = await request.json();
      const r = b === 'youtube' ? await pubYouTube(env, body) : b === 'pinterest' ? await pubPinterest(env, body) : await pubTikTok(env, body);
      return json({ ok: true, ...r });
    }
    return json({ ok: false, error: 'not-found' }, 404);
  } catch (e) { return json({ ok: false, error: clean(e.message || e) }); }
}
