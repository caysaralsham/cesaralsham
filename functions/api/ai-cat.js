// تصنيف صورة من صور فيسبوك حسب أقسام الموقع (Gemini) — للأداة الخاصة «صور فيسبوك» بأدواتي
// الصورة بتوصل صغيرة (حوالي 512 بكسل) من متصفحك حتى يكون الاستهلاك قليل. لازم يكون الطلب من حسابك.
const MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
const json = (o, st = 200, cache = 0) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache ? `public, max-age=${cache}` : 'no-store' } });

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

function b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }


export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ ok: false, error: 'post-only' }, 405);
  if (!(await verifyUser(request, env))) return json({ ok: false, error: 'login' }, 401);
  const key = env.GEMINI_API_KEY; if (!key) return json({ ok: false, error: 'no-key' }, 503);
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad-json' }, 400); }
  const imgs = (Array.isArray(b.images) ? b.images : [b.image]).map(x => String(x || '').replace(/^data:image\/\w+;base64,/, '')).filter(Boolean).slice(0, 10);
  if (!imgs.length || imgs.some(x => x.length > 400000)) return json({ ok: false, error: 'bad-image' }, 400);
  const cats = (Array.isArray(b.cats) ? b.cats : []).map(c => String(c).slice(0, 120)).slice(0, 30);
  if (!cats.length) return json({ ok: false, error: 'no-cats' }, 400);
  const prompt = `أنت خبير بالرخام والحجر الطبيعي لشركة «قيصر الشام للحجر والرخام».
رح توصلك ${imgs.length} صور مرقّمة من 1 لـ ${imgs.length} بالترتيب. صنّف كل صورة في قسم واحد من هالأقسام بالضبط (انسخ الاسم حرفياً):
${cats.map((c, i) => (i + 1) + ') ' + c).join('\n')}
إذا الصورة مش شغل رخام أو حجر (إعلان مكتوب، صورة شخص، شعار، لقطة شاشة، آلة...) أو ما بتناسب ولا قسم، رجّع cat فاضي.
تجاهل اللوغو والكتابة على الصور. رجّع مصفوفة فيها لكل صورة: n (رقمها) و cat.`;
  const parts = [{ text: prompt }];
  imgs.forEach((d, i) => { parts.push({ text: 'صورة ' + (i + 1) + ':' }); parts.push({ inline_data: { mime_type: 'image/jpeg', data: d } }); });
  const req = { contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'ARRAY', items: { type: 'OBJECT', properties: { n: { type: 'INTEGER' }, cat: { type: 'STRING' } }, required: ['n', 'cat'] } }, temperature: 0 } };
  for (const m of (env.GEMINI_MODEL ? [env.GEMINI_MODEL] : MODELS)) {
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(req) });
    const d = await g.json().catch(() => ({}));
    if (g.status === 404) continue;
    if (g.status === 429) return json({ ok: false, error: 'rate' }, 429);
    if (!g.ok) return json({ ok: false, error: 'gemini-' + g.status }, 502);
    try { const t = d.candidates[0].content.parts.map(p => p.text || '').join(''); const arr = JSON.parse(t); const out = imgs.map(() => '');
      for (const x of arr) { const i = (x.n | 0) - 1, c = String(x.cat || '').trim(); if (i >= 0 && i < out.length && cats.includes(c)) out[i] = c; }
      return json({ ok: true, cats: out, cat: out[0] }); } catch (e) { return json({ ok: false, error: 'parse' }, 502); }
  }
  return json({ ok: false, error: 'no-model' }, 502);
}
