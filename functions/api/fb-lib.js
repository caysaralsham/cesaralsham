// مكتبة «صور فيسبوك»: صور وفيديوهات صفحة قيصر الشام محفوظة بمخزن SOCIAL_KV، بدون تكرار
// قراءة فقط من فيسبوك (ما في نشر ولا حذف). بتتحدّث لحالها كل أسبوع:
//   POST /api/fb-lib?cron=1   ← من GitHub Actions كل أسبوع (بدون حساب؛ ما بيعمل شي إذا آخر تحديث أقل من 6 أيام)
//   GET  /api/fb-lib          ← المكتبة (لازم حسابك)
//   GET  /api/fb-lib?sync=1   ← تحديث فوري من صفحة «صور فيسبوك» (لازم حسابك)
import { verifyUser, gget, ids } from './meta-photos.js';

const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const KEY = 'fblib', BUDGET = 38, WEEK = 6 * 864e5;

async function load(env) { try { return JSON.parse(await env.SOCIAL_KV.get(KEY) || 'null') || null; } catch (e) { return null; } }
const emptyLib = () => ({ photos: [], videos: [], syncedAt: 0, back: { p: '', v: '', pDone: false, vDone: false }, log: [] });

const mapP = p => { const im = (p.images || []).slice().sort((a, b) => b.width - a.width); const big = im.find(x => x.width <= 2048) || im[im.length - 1] || {};
  return { id: p.id, at: p.created_time, src: big.source || '', w: big.width || 0, h: big.height || 0, link: p.link || '', text: String(p.name || '').slice(0, 300) }; };
const mapV = x => ({ id: x.id, at: x.created_time, title: String(x.title || ''), text: String(x.description || '').slice(0, 1000), len: x.length || 0, src: x.source || '', thumb: x.picture || '', link: x.permalink_url ? 'https://www.facebook.com' + x.permalink_url : '' });
const P_PATH = (pg, after) => `${pg}/photos?type=uploaded&fields=id,created_time,images,link,name&limit=100${after ? '&after=' + encodeURIComponent(after) : ''}`;
const V_PATH = (pg, after) => `${pg}/videos?fields=id,created_time,title,description,length,source,permalink_url,picture&limit=50${after ? '&after=' + encodeURIComponent(after) : ''}`;
const nextOf = d => d.paging && d.paging.next && d.paging.cursors ? d.paging.cursors.after : '';

async function sync(env) {
  const token = env.META_PAGE_TOKEN_PERM || env.META_PAGE_TOKEN;
  if (!token) throw new Error('no-token');
  const lib = (await load(env)) || emptyLib();
  lib.back = lib.back || { p: '', v: '', pDone: false, vDone: false };
  let calls = 0; const I = await ids(token, env); calls += 2;
  const added = { photos: 0, videos: 0 };
  for (const kind of ['photos', 'videos']) {
    const list = lib[kind], have = new Set(list.map(x => x.id)), map = kind === 'photos' ? mapP : mapV, path = kind === 'photos' ? P_PATH : V_PATH;
    const fresh = [];
    // 1) الجديد من فوق لحد ما نوصل لشي عنا
    let after = '', stop = false;
    while (!stop && calls < BUDGET) {
      const d = await gget(path(I.pageId, after), I.token); calls++;
      const rows = (d.data || []).map(map).filter(x => x.src);
      for (const r of rows) { if (have.has(r.id)) { stop = true; const old = list.find(x => x.id === r.id); if (old) old.src = r.src; continue; } have.add(r.id); r.add = lib.syncedAt ? Date.now() : 0; fresh.push(r); }
      after = nextOf(d); if (!after) { stop = true; if (kind === 'photos') lib.back.pDone = true; else lib.back.vDone = true; }
    }
    list.unshift(...fresh); added[kind] = fresh.length;
    { const bk0 = kind === 'photos' ? 'p' : 'v'; if (!stop && after && !lib.back[bk0]) lib.back[bk0] = after; } // الميزانية خلصت بنص أول سحب: منكمّل من هون المرة الجاية
    // 2) أول مرة: نكمّل القديم على دفعات (كل تحديث بيكمّل من وين وقف)
    const bk = kind === 'photos' ? 'p' : 'v', dk = kind === 'photos' ? 'pDone' : 'vDone';
    if (!lib.back[dk] && list.length) {
      let cur = lib.back[bk] || '';
      while (calls < BUDGET) {
        if (!cur) { // نبلّش من آخر شي عنا: منمشي من فوق لحد ما نتعدّاه
          const d = await gget(path(I.pageId, ''), I.token); calls++; cur = nextOf(d); if (!cur) { lib.back[dk] = true; break; }
        }
        const d = await gget(path(I.pageId, cur), I.token); calls++;
        const rows = (d.data || []).map(map).filter(x => x.src && !have.has(x.id));
        rows.forEach(r => have.add(r.id)); list.push(...rows); added[kind] += rows.length;
        cur = nextOf(d); if (!cur) { lib.back[dk] = true; break; }
      }
      lib.back[bk] = cur;
    }
    list.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
  lib.syncedAt = Date.now();
  lib.log = [{ at: lib.syncedAt, ...added }, ...(lib.log || [])].slice(0, 30);
  await env.SOCIAL_KV.put(KEY, JSON.stringify(lib));
  return { lib, added };
}

export async function onRequest({ request, env }) {
  if (!env.SOCIAL_KV) return json({ ok: false, error: 'no-kv' });
  const u = new URL(request.url);
  try {
    if (request.method === 'POST' && u.searchParams.get('cron')) {
      const lib = await load(env);
      if (lib && Date.now() - (lib.syncedAt || 0) < WEEK) return json({ ok: true, skipped: true, syncedAt: lib.syncedAt });
      const { added } = await sync(env);
      return json({ ok: true, added });
    }
    if (request.method !== 'GET') return json({ ok: false, error: 'method' }, 405);
    if (!(await verifyUser(request, env))) return json({ ok: false, error: 'login' }, 401);
    if (u.searchParams.get('sync')) { const { lib, added } = await sync(env); return json({ ok: true, added, lib }); }
    return json({ ok: true, lib: (await load(env)) || emptyLib() });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }); }
}
