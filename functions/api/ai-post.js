// اقتراح نص منشور من الصورة نفسها (Gemini) — لأداة «المنشورات» بأدواتي
// بيشوف الصورة (صغيرة ~640 بكسل من متصفحك) وبيرجّع: نوع العمل (من أقسام الصياغة) + اللون/الحجر + تفصيلة + سطور عربية + جملة فرنسية.
// الهاتف والموقع والهاشتاغات بتنضاف من قوالب الصياغة بالمتصفح (مش من الذكاء الاصطناعي) حتى تبقى دايماً صحيحة.
// لازم يكون الطلب من حسابك. المفتاح GEMINI_API_KEY محفوظ بـ Cloudflare وما بيطلع للمتصفح.
const MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
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

function b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }



const SCHEMA = { type: 'OBJECT', properties: {
  cat: { type: 'STRING' }, stoneAr: { type: 'STRING' }, detailAr: { type: 'STRING' },
  ar: { type: 'ARRAY', items: { type: 'STRING' } }, fr: { type: 'STRING' }, siteTitle: { type: 'STRING' }, ok: { type: 'BOOLEAN' } },
  required: ['cat', 'stoneAr', 'detailAr', 'ar', 'fr', 'siteTitle', 'ok'] };

export async function onRequest(ctx) {
  // أي خطأ غير متوقع بيرجع كـ JSON واضح بدل صفحة 502 من Cloudflare
  try { return await handle(ctx); }
  catch (e) { return json({ ok: false, error: 'server: ' + String((e && e.message) || e).slice(0, 120) }, 500); }
}

async function handle({ request, env }) {
  if (request.method !== 'POST') return json({ ok: false, error: 'post-only' }, 405);
  if (!(await verifyUser(request, env))) return json({ ok: false, error: 'login' }, 401);
  const key = env.GEMINI_API_KEY; if (!key) return json({ ok: false, error: 'no-key' }, 503);
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad-json' }, 400); }
  const imgs = (Array.isArray(b.images) ? b.images : []).map(x => String(x || '').replace(/^data:image\/\w+;base64,/, '')).filter(Boolean).slice(0, 4);
  if (!imgs.length || imgs.some(x => x.length > 400000)) return json({ ok: false, error: 'bad-image' }, 400);
  const cats = (Array.isArray(b.cats) ? b.cats : []).slice(0, 40).map(c => ({ k: String(c.k || '').slice(0, 30), ar: String(c.ar || '').slice(0, 60), fr: String(c.fr || '').slice(0, 60) })).filter(c => c.k);
  if (!cats.length) return json({ ok: false, error: 'no-cats' }, 400);
  const hint = String(b.hint || '').slice(0, 300), kind = b.kind === 'video' ? 'فيديو (هذه لقطة منه)' : 'صور';
  const prompt = `أنت كاتب تسويق لشركة «قيصر الشام للحجر والرخام» بالجزائر (دالي إبراهيم). المنشور ${kind}.
انظر إلى الصورة وصف الشغل الظاهر فيها بدقة، بلا اختراع.
- cat: اختر مفتاح نوع العمل (k) من هذه القائمة بالضبط:
${cats.filter(c => c.k !== 'machine').map(c => c.k + ' = ' + c.ar + ' / ' + c.fr).join('\n')}
  إذا ما في نوع مناسب اكتب general.
- stoneAr: اللون أو نوع الحجر بكلمتين أو ثلاث (مثال: رخام أبيض كرارا، حجر بيج). فاضي إذا مش واضح.
- detailAr: تفصيلة مميزة بـ 2 لـ 6 كلمات (مثال: بزخارف نباتية منحوتة). فاضي إذا ما في.
- ar: من سطرين إلى ثلاثة أسطر بالعربية الفصحى البسيطة: الأول جملة تشدّ الانتباه مع إيموجي واحد، والباقي يصف القطعة الظاهرة وفائدتها للزبون.
- fr: جملة أو جملتان بالفرنسية القوية الطبيعية (أغلب الجزائريين بيقروا فرنسي) تصف نفس القطعة.
- siteTitle: عنوان قصير بالفصحى لموقع الشركة (3 لـ 7 كلمات).
- ok: false إذا الصورة مش شغل رخام أو حجر.
ممنوع: ذكر البليدة أو المعمل أو أي مكان غير دالي إبراهيم، وكلمة «المعرض»، أي رقم هاتف أو رابط أو هاشتاغ (بتنضاف لحالها)، وكلمة «يدوي» (النحت عندنا CNC)، والمبالغة الكاذبة.${hint ? '\nملاحظة صاحب الشغل: ' + hint : ''}`;
  const parts = [{ text: prompt }];
  imgs.forEach(d => parts.push({ inline_data: { mime_type: 'image/jpeg', data: d } }));
  const req = { contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: Math.min(1, Math.max(0.2, Number(b.temp) || 0.7)) } };
  // نجرب كل موديل: إذا واحد مش موجود أو مضغوط/معطّل (5xx) أو علّق، منروح للي بعده بدل ما نوقف
  const list = env.GEMINI_MODEL ? [env.GEMINI_MODEL, ...MODELS.filter(x => x !== env.GEMINI_MODEL)] : MODELS;
  let last = 'no-model', rate = false;
  for (const m of list) {
    let g, d;
    try {
      g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(req), signal: AbortSignal.timeout(30000) });
      d = await g.json().catch(() => ({}));
    } catch (e) { last = 'gemini-timeout'; continue; }
    if (g.status === 404) continue;
    if (g.status === 402) return json({ ok: false, error: 'credits' }, 402);   // رصيد Gemini المدفوع مسبقاً خلص
    if (g.status === 429) { rate = true; last = 'rate'; continue; }
    if (!g.ok) { last = 'gemini-' + g.status + (d && d.error && d.error.message ? ': ' + String(d.error.message).slice(0, 100) : ''); continue; }
    try {
      const o = JSON.parse(d.candidates[0].content.parts.map(p => p.text || '').join(''));
      const clean = s => String(s || '').replace(/https?:\/\/\S+|#[^\s#]+|\+?\d[\d\s]{7,}\d/g, '').replace(/المعرض/g, 'محلّنا').replace(/[^.!؟\n]*(البليدة|Blida|المعمل|معملنا|atelier)[^.!؟\n]*[.!؟]?/gi, '').replace(/\s*يدوي(ة)?/g, '').replace(/[ \t]{2,}/g, ' ').trim();
      const cat = cats.some(c => c.k === o.cat) ? o.cat : 'general';
      return json({ ok: true, cat, stoneAr: clean(o.stoneAr).slice(0, 60), detailAr: clean(o.detailAr).slice(0, 80), ar: (o.ar || []).map(clean).filter(Boolean).slice(0, 3), fr: clean(o.fr).slice(0, 400), siteTitle: clean(o.siteTitle).slice(0, 100), fits: o.ok !== false, model: m });
    } catch (e) { last = 'parse'; continue; }
  }
  return json({ ok: false, error: rate ? 'rate' : last }, rate ? 429 : 502);
}
