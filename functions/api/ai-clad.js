// تغليف واجهة بالذكاء الاصطناعي (مرسم ديكور) — بيمرّر الطلب لـ Gemini Image ويرجّع الجواب متل ما هو
// المفتاح محفوظ مشفّر بـ Cloudflare (GEMINI_API_KEY) وما بيطلع للمتصفح.
// السيرفر ما بيفك ولا بيركّب الصور (حتى ما يتجاوز حد المعالجة) — المتصفح بيجهّز الطلب كامل.
// الحماية: من موقعنا بس + موديلات صور محددة + حجم محدود + حد الصرف الشهري بحساب Gemini.
const MODELS = ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];
const OK_HOST = /^(cesar-alcham\.com|www\.cesar-alcham\.com|([a-z0-9-]+\.)?cesaralsham\.pages\.dev|localhost|127\.0\.0\.1)$/;
const MAX = 18e6;
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function hostOf(u) { try { return new URL(u).hostname; } catch (e) { return ''; } }

export async function onRequest({ request, env, waitUntil }) {
  const key = env.GEMINI_API_KEY;
  if (request.method === 'GET') {
    const u = new URL(request.url);
    if (u.searchParams.get('selftest') !== 'clad7' || !key) return json({ ok: !!key, models: MODELS });
    // فحص لمرة وحدة: أي موديل صور بيرجّع صورة فعلاً (النتيجة بتنحفظ يوم كامل حتى ما ينصرف رصيد)
    const ck = new Request('https://cache.local/ai-clad-selftest-v4'); const hit = await caches.default.match(ck); if (hit) return hit;
    const keep = o => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
    const run = async () => {
      const out = {};
      for (const m of ['gemini-3.1-flash-image', 'gemini-3-pro-image']) {
        const t0 = Date.now(); let info;
        try {
          const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'A small photorealistic square swatch of beige natural stone wall cladding.' }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1' } } }) });
          info = g.status + ' ms=' + (Date.now() - t0);
          if (g.ok) { let n = 0; const rd = g.body.getReader(); for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.byteLength; } info += ' bytes=' + n; }
          else { const t = await g.text(); info += ' ' + t.slice(0, 220).replace(/\s+/g, ' '); }
        } catch (e) { info = 'err ' + e.message; }
        out[m] = info; await caches.default.put(ck, keep({ ok: true, out }));
      }
    };
    const lk = new Request('https://cache.local/ai-clad-selftest-v4-lock');
    if (await caches.default.match(lk)) return json({ ok: true, running: true });
    await caches.default.put(lk, new Response('1', { headers: { 'cache-control': 'public, max-age=300' } }));
    waitUntil(run());
    return json({ ok: true, started: true });
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
