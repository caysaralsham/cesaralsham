// فحوصات أمان ثابتة على ملفات المستودع (لا تفتح متصفحاً ولا تتصل بالإنترنت)
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SKIP = new Set(['.git', 'node_modules', 'qa', 'img', 'videos']);
const TEXT = /\.(html?|js|mjs|json|ya?ml|txt|md|css|vcf|webmanifest)$|^_headers$/i;

function files(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (TEXT.test(e.name)) out.push(p);
  }
  return out;
}
const ALL = files();
const rel = p => path.relative(ROOT, p);

test('لا توجد أسرار مكشوفة في الملفات', () => {
  const patterns = {
    'مفتاح خاص (private key)': /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    'حساب خدمة Firebase/Google': /"private_key"\s*:/,
    'رمز GitHub': /\bgh[pousr]_[A-Za-z0-9]{30,}/,
    'مفتاح OpenAI/Anthropic': /\bsk-(ant-)?[A-Za-z0-9_-]{20,}/,
    'مفتاح AWS': /\bAKIA[0-9A-Z]{16}\b/,
  };
  const hits = [];
  for (const f of ALL) {
    const t = fs.readFileSync(f, 'utf8');
    for (const [name, rx] of Object.entries(patterns)) if (rx.test(t)) hits.push(`${name} في ${rel(f)}`);
  }
  expect(hits).toEqual([]);
});

test('مفتاح Google الوحيد في الصفحات هو مفتاح Firebase العام', () => {
  // مفتاح Firebase للويب ليس سراً لكنه يجب أن يكون الوحيد؛ مفاتيح Gemini وPlaces تبقى في Cloudflare فقط
  const keys = new Set();
  for (const f of ALL) for (const m of fs.readFileSync(f, 'utf8').matchAll(/AIza[0-9A-Za-z_-]{35}/g)) keys.add(m[0]);
  expect(keys.size).toBeLessThanOrEqual(1);
});

test('دوال الذكاء الاصطناعي في الخادم تتحقق من هوية المالك قبل استخدام المفتاح', () => {
  const dir = path.join(ROOT, 'functions');
  if (!fs.existsSync(dir)) test.skip();
  const offenders = [];
  for (const f of files(dir)) {
    const t = fs.readFileSync(f, 'utf8');
    if (/env\.GEMINI_API_KEY/.test(t) && !/verifyUser\s*\(/.test(t)) offenders.push(rel(f));
  }
  expect(offenders).toEqual([]);
});

test('ترويسات الأمان موجودة في _headers', () => {
  const p = path.join(ROOT, '_headers');
  if (!fs.existsSync(p)) test.skip();
  const h = fs.readFileSync(p, 'utf8');
  expect(h).toMatch(/Strict-Transport-Security/);
  expect(h).toMatch(/X-Content-Type-Options:\s*nosniff/);
  expect(h).toMatch(/frame-ancestors/);
});

test.describe('الفهرسة في غوغل', () => {
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

  test('خريطة الموقع: كل الروابط نهائية (https، بدون www، بدون .html) وكلها موجودة', () => {
    const locs = [...read('sitemap.xml').matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    expect(locs.length).toBeGreaterThan(10);
    const bad = [];
    for (const u of locs) {
      if (!u.startsWith('https://cesar-alcham.com/')) bad.push(`ليس النطاق النهائي: ${u}`);
      if (/\.html($|\?)|\/index$/.test(u)) bad.push(`رابط يُعاد توجيهه: ${u}`);
      const p = u.replace('https://cesar-alcham.com/', '');
      const file = p === '' || p.endsWith('/') ? p + 'index.html' : p + '.html';
      if (!fs.existsSync(path.join(ROOT, file))) bad.push(`صفحة غير موجودة: ${u}`);
    }
    expect(bad).toEqual([]);
  });

  test('الرابط الأساسي (canonical) لكل صفحة عامة نهائي وبدون .html', () => {
    const pages = ['index.html', 'works.html', 'videos.html', 'fr/index.html', 'fr/works.html', 'fr/videos.html',
      ...fs.readdirSync(ROOT).filter(f => /^a3mal-.*\.html$/.test(f))];
    const bad = [];
    for (const f of pages) {
      const c = (read(f).match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
      if (!c || !c.startsWith('https://cesar-alcham.com/') || /\.html$/.test(c)) bad.push(`${f}: ${c}`);
    }
    expect(bad).toEqual([]);
  });

  test('robots.txt لا يحجب صفحات عليها noindex (حتى لا تظهر «مفهرسة رغم حظرها»)', () => {
    expect(read('robots.txt')).not.toMatch(/^Disallow:\s*\/\S/m);
  });

  test('الأدوات الخاصة مخفية بترويسة X-Robots-Tag', () => {
    const h = read('_headers');
    for (const p of ['/my/*', '/studio-q7m4/*', '/admin-works*', '/links/admin-settings*']) {
      expect(h).toMatch(new RegExp(p.replace(/[*/]/g, '\\$&') + '\\s*\\n\\s*X-Robots-Tag: noindex'));
    }
  });
});
