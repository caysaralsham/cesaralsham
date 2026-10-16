// اختبارات صلاحيات Firebase Storage على المحاكي فقط (مشروع وهمي، لا اتصال بالتخزين الحقيقي).
import { test, describe, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const OWNER = 'dzrssSkOkqSFAcLpO1JkUROQU0D2';
const MB = 1024 * 1024;
const bytes = n => new Uint8Array(n);

describe('قواعد Storage الحالية', () => {
  let env;
  const owner = () => env.authenticatedContext(OWNER).storage();
  const stranger = () => env.authenticatedContext('someone-else').storage();
  const visitor = () => env.unauthenticatedContext().storage();
  const put = (st, path, size, type) => st.ref(path).put(bytes(size), { contentType: type });
  const seed = (path, type = 'image/jpeg') =>
    env.withSecurityRulesDisabled(ctx => ctx.storage().ref(path).put(bytes(10), { contentType: type }));

  before(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-qa-storage',
      storage: { rules: readFileSync(new URL('storage.rules', import.meta.url), 'utf8') },
    });
  });
  after(() => env.cleanup());

  describe('صور الموقع site/', () => {
    test('الزائر يشاهد', async () => {
      await seed('site/a.jpg');
      await assertSucceeds(visitor().ref('site/a.jpg').getMetadata());
    });
    test('الزائر لا يرفع', () => assertFails(put(visitor(), 'site/x.jpg', 10, 'image/jpeg')));
    test('مستخدم آخر لا يرفع', () => assertFails(put(stranger(), 'site/x.jpg', 10, 'image/jpeg')));
    test('الزائر لا يحذف', () => assertFails(visitor().ref('site/a.jpg').delete()));
    test('المالك يرفع صورة', () => assertSucceeds(put(owner(), 'site/b.jpg', 1000, 'image/jpeg')));
    test('المالك لا يرفع ملفاً غير صورة', () => assertFails(put(owner(), 'site/c.html', 100, 'text/html')));
    test('المالك لا يرفع صورة أكبر من 15 ميغا', () => assertFails(put(owner(), 'site/big.jpg', 16 * MB, 'image/jpeg')));
    test('المالك يحذف', () => assertSucceeds(owner().ref('site/b.jpg').delete()));
  });

  describe('المعرض gallery/', () => {
    test('الزائر يشاهد', async () => {
      await seed('gallery/v.mp4', 'video/mp4');
      await assertSucceeds(visitor().ref('gallery/v.mp4').getMetadata());
    });
    test('الزائر لا يرفع', () => assertFails(put(visitor(), 'gallery/x.jpg', 10, 'image/jpeg')));
    test('المالك يرفع فيديو', () => assertSucceeds(put(owner(), 'gallery/w.mp4', 1000, 'video/mp4')));
    test('المالك لا يرفع ملف برنامج', () => assertFails(put(owner(), 'gallery/x.js', 100, 'application/javascript')));
  });

  describe('النسخ الاحتياطية backups/', () => {
    test('الزائر لا يقرأ', async () => {
      await seed('backups/b1.json', 'application/json');
      await assertFails(visitor().ref('backups/b1.json').getMetadata());
    });
    test('مستخدم آخر لا يقرأ', () => assertFails(stranger().ref('backups/b1.json').getMetadata()));
    test('المالك يقرأ', () => assertSucceeds(owner().ref('backups/b1.json').getMetadata()));
    test('المالك يضيف نسخة جديدة', () => assertSucceeds(put(owner(), 'backups/b2.json', 1000, 'application/json')));
    test('لا أحد يستبدل نسخة موجودة (حتى المالك)', () => assertFails(put(owner(), 'backups/b1.json', 10, 'application/json')));
    test('لا أحد يحذف نسخة (حتى المالك)', () => assertFails(owner().ref('backups/b1.json').delete()));
    test('الزائر لا يرفع', () => assertFails(put(visitor(), 'backups/x.json', 10, 'application/json')));
  });

  describe('أي مسار آخر مرفوض', () => {
    test('رفع خارج المجلدات الثلاثة', () => assertFails(put(owner(), 'other/x.jpg', 10, 'image/jpeg')));
    test('قراءة خارج المجلدات الثلاثة', async () => {
      await seed('other/y.jpg');
      await assertFails(visitor().ref('other/y.jpg').getMetadata());
    });
  });
});
