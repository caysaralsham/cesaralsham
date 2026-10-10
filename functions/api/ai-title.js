// وصف ذكي لصورة من أعمالنا بـ Gemini — بيشوف الصورة وبيرجّع اللون + نوع الحجر + وصف قصير (عربي وفرنسي)
// المفتاح محفوظ مشفّر بـ Cloudflare (GEMINI_API_KEY) وما بيطلع للمتصفح.
// محصور بصور معرضنا بس، وكل صورة بتنحلّل مرة وحدة (النتيجة بتنحفظ بالكاش) — حتى ما حدا يقدر يصرف الرصيد.
const ALLOW = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/basel-7b29b\.(firebasestorage\.app|appspot\.com)\/o\/gallery%2F[^?]+\?alt=media(&token=[A-Za-z0-9-]+)?$/;
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const json = (o, st = 200, cache = 0) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache ? `public, max-age=${cache}` : 'no-store' } });

function b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    colorAr: { type: 'STRING' }, colorFr: { type: 'STRING' },
    stoneAr: { type: 'STRING' }, stoneFr: { type: 'STRING' },
    descAr: { type: 'STRING' }, descFr: { type: 'STRING' },
    altAr: { type: 'STRING' }, altFr: { type: 'STRING' },
    kindOk: { type: 'BOOLEAN' },
  },
  required: ['colorAr', 'colorFr', 'stoneAr', 'stoneFr', 'descAr', 'descFr', 'altAr', 'altFr', 'kindOk'],
};

function prompt(cat) {
  return `أنت خبير بالرخام والحجر الطبيعي، وعم تكتب لموقع شركة «قيصر الشام للحجر والرخام» بالجزائر.
الصورة من قسم: «${cat || 'غير محدد'}».
حلّل الشغل الظاهر بالصورة (تجاهل اللوغو والكتابة تحت يمين) ورجّع JSON:
- colorAr / colorFr: لون الحجر الأساسي بكلمة أو كلمتين (مثال: بيج / beige، أبيض كرارا / blanc de Carrare، بني / marron، رمادي / gris، أسود / noir، كريمي / crème، أبيض وأسود / blanc et noir).
- stoneAr / stoneFr: نوع المادة إذا واضح (رخام / marbre، حجر / pierre، ترافرتين / travertin، غرانيت / granit). إذا مش واضح اكتب رخام / marbre.
- descAr: وصف قصير جداً (2 لـ 5 كلمات) بيميّز هالقطعة عن غيرها من نفس القسم، بلا إعادة اسم القسم ولا اللون. أمثلة: «بزخارف نباتية منحوتة»، «بأعمدة كورنثية»، «بثلاث طبقات وأسود»، «بقوس ونحت هندسي»، «مع درابزين مخرّط».
- descFr: نفس الوصف بالفرنسي الطبيعي (مثال: «aux motifs floraux sculptés»، «à colonnes corinthiennes»).
- altAr / altFr: جملة وحدة (10 لـ 18 كلمة) بتوصف الصورة لمحركات البحث، طبيعية ومش حشو.
- kindOk: true إذا الصورة فعلاً بتناسب القسم، false إذا لا.
لا تخترع شي مش ظاهر. عربي فصيح بسيط.`;
}

export async function onRequest({ request, env, waitUntil }) {
  if (request.method !== 'POST') return json({ ok: false, error: 'post-only' }, 405);
  const key = env.GEMINI_API_KEY;
  if (!key) return json({ ok: false, error: 'no-key' }, 503);
  let body; try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'bad-json' }, 400); }
  const img = String(body.img || ''), cat = String(body.cat || '').slice(0, 200);
  if (!ALLOW.test(img)) return json({ ok: false, error: 'not-allowed' }, 400);

  const cache = caches.default, ck = new Request('https://cache.local/ai-title/v1?u=' + encodeURIComponent(img) + '&c=' + encodeURIComponent(cat));
  const hit = await cache.match(ck); if (hit) return hit;

  const r = await fetch(img); if (!r.ok) return json({ ok: false, error: 'img-' + r.status }, 404);
  const buf = await r.arrayBuffer(); if (buf.byteLength > 15e6) return json({ ok: false, error: 'too-big' }, 413);
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const req = { contents: [{ parts: [{ text: prompt(cat) }, { inline_data: { mime_type: mime, data: b64(buf) } }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3 } };

  let last = '';
  for (const m of (env.GEMINI_MODEL ? [env.GEMINI_MODEL] : MODELS)) {
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(req) });
    const d = await g.json().catch(() => ({}));
    if (g.status === 404) { last = 'model ' + m; continue; }
    if (g.status === 429) return json({ ok: false, error: 'rate', detail: d.error && d.error.message }, 429);
    if (!g.ok) return json({ ok: false, error: 'gemini-' + g.status, detail: d.error && d.error.message }, 502);
    try {
      const t = d.candidates[0].content.parts.map(p => p.text || '').join('');
      const o = JSON.parse(t), cl = s => String(s || '').replace(/[|«»"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
      const out = { ok: true, model: m }; for (const k of Object.keys(SCHEMA.properties)) out[k] = k === 'kindOk' ? o[k] !== false : cl(o[k]);
      const res = json(out, 200, 365 * 86400);
      waitUntil(cache.put(ck, res.clone()));
      return res;
    } catch (e) { return json({ ok: false, error: 'parse' }, 502); }
  }
  return json({ ok: false, error: 'no-model', detail: last }, 502);
}
