// آراء غوغل الحقيقية لصفحة «قيصر الشام» — من Places API (New)
// المفتاح محفوظ مشفّر بـ Cloudflare (GOOGLE_PLACES_KEY) وما بيطلع للمتصفح أبداً.
// النتيجة بتنحفظ بالكاش 12 ساعة (يعني تقريباً طلبين لغوغل باليوم — حتى ما يصير في تكلفة).
const QUERY = 'قيصر الشام للحجر والرخام دالي ابراهيم الجزائر';
const TTL = 12 * 3600;
const json = (o, st = 200, cache = 0) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache ? `public, max-age=${cache}` : 'no-store', 'access-control-allow-origin': '*' } });

export async function onRequest({ request, env, waitUntil }) {
  const key = env.GOOGLE_PLACES_KEY;
  if (!key) return json({ ok: false, error: 'no-key' }, 503);
  const cache = caches.default, ck = new Request(new URL('/api/google-reviews?v=1', request.url).toString());
  const hit = await cache.match(ck); if (hit) return hit;
  try {
    let placeId = env.GOOGLE_PLACE_ID || '';
    if (!placeId) {
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName' }, body: JSON.stringify({ textQuery: QUERY, languageCode: 'ar', regionCode: 'DZ' }) });
      const d = await r.json(); if (!r.ok) return json({ ok: false, error: 'search', detail: d.error && d.error.message }, 502);
      placeId = d.places && d.places[0] && d.places[0].id; if (!placeId) return json({ ok: false, error: 'not-found' }, 404);
    }
    const r = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=ar`, { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'displayName,rating,userRatingCount,googleMapsUri,reviews' } });
    const p = await r.json(); if (!r.ok) return json({ ok: false, error: 'details', detail: p.error && p.error.message }, 502);
    const reviews = (p.reviews || []).map(v => ({
      name: (v.authorAttribution && v.authorAttribution.displayName) || '',
      photo: (v.authorAttribution && v.authorAttribution.photoUri) || '',
      stars: v.rating || 5,
      text: (v.originalText && v.originalText.text) || (v.text && v.text.text) || '',
      when: v.relativePublishTimeDescription || '',
    })).filter(v => v.text);
    const res = json({ ok: true, placeId, name: p.displayName && p.displayName.text, rating: p.rating, count: p.userRatingCount, url: p.googleMapsUri, reviews }, 200, TTL);
    waitUntil(cache.put(ck, res.clone()));
    return res;
  } catch (e) { return json({ ok: false, error: 'fail', detail: String(e) }, 500); }
}
