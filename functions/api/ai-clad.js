// تغليف واجهة بالذكاء الاصطناعي (مرسم ديكور) — بيمرّر الطلب لـ Gemini Image ويرجّع الجواب متل ما هو
// المفتاح محفوظ مشفّر بـ Cloudflare (GEMINI_API_KEY) وما بيطلع للمتصفح.
// السيرفر ما بيفك ولا بيركّب الصور (حتى ما يتجاوز حد المعالجة) — المتصفح بيجهّز الطلب كامل.
// الحماية: من موقعنا بس + موديلات صور محددة + حجم محدود + حد الصرف الشهري بحساب Gemini.
const MODELS = ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];
const OK_HOST = /^(cesar-alcham\.com|www\.cesar-alcham\.com|([a-z0-9-]+\.)?cesaralsham\.pages\.dev|localhost|127\.0\.0\.1)$/;
const MAX = 18e6;
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function hostOf(u) { try { return new URL(u).hostname; } catch (e) { return ''; } }

export async function onRequest({ request, env }) {
  const key = env.GEMINI_API_KEY;
  if (request.method === 'GET') {
    const u = new URL(request.url);
    if (u.searchParams.get('selftest') !== 'clad7' || !key) return json({ ok: !!key, models: MODELS });
    // فحص لمرة وحدة: أي موديل صور بيرجّع صورة فعلاً (النتيجة بتنحفظ يوم كامل حتى ما ينصرف رصيد)
    const ck = new Request('https://cache.local/ai-clad-selftest-v1'); const hit = await caches.default.match(ck); if (hit) return hit;
    const out = {};
    for (const m of MODELS) {
      const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'A small photorealistic square swatch of beige natural stone wall cladding.' }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }) });
      const t = await g.text(); let info = g.status + '';
      if (g.ok) { const n = (t.match(/"(inlineData|inline_data)"/g) || []).length; info += ' images=' + n; out[m] = info; if (n) break; }
      else { try { info += ' ' + JSON.parse(t).error.message.slice(0, 120); } catch (e) {} out[m] = info; }
    }
    const res = json({ ok: true, out }); res.headers.set('cache-control', 'public, max-age=86400');
    await caches.default.put(ck, res.clone()); return res;
  }
  if (request.method !== 'POST') return json({ ok: false, error: 'post-only' }, 405);
  if (!key) return json({ ok: false, error: 'no-key' }, 503);
  const src = request.headers.get('origin') || request.headers.get('referer') || '';
  if (!OK_HOST.test(hostOf(src))) return json({ ok: false, error: 'forbidden' }, 403);
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
