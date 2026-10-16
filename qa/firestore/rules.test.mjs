// اختبارات صلاحيات Firestore على المحاكي فقط (مشروع وهمي demo-*، لا اتصال بالمشروع الحقيقي إطلاقاً).
// تختبر القواعد الحالية (firestore.rules) والنسخة المقترحة (firestore.proposed.rules).
// التشغيل: npm run test:rules  (يحتاج Java 21)
import { test, describe, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, increment, deleteField } from 'firebase/firestore';

const OWNER = 'dzrssSkOkqSFAcLpO1JkUROQU0D2';
const DAY = '2026-10-16';
const here = f => new URL(f, import.meta.url);

const VERSIONS = {
  'القواعد الحالية': 'firestore.rules',
  'القواعد المقترحة': 'firestore.proposed.rules',
};

// ثغرات معروفة في القواعد الحالية فقط — تُصلح في النسخة المقترحة
const KNOWN_GAPS_IN_CURRENT = new Set(['wipe-countries', 'huge-countries', 'fake-date']);

for (const [label, file] of Object.entries(VERSIONS)) {
  describe(label, () => {
    let env;
    const owner = () => env.authenticatedContext(OWNER).firestore();
    const stranger = () => env.authenticatedContext('someone-else').firestore();
    const visitor = () => env.unauthenticatedContext().firestore();
    const seed = (path, data) => env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), path), data));
    const gap = (id, name, fn) => test(name, { todo: file === 'firestore.rules' && KNOWN_GAPS_IN_CURRENT.has(id) ? 'ثغرة معروفة في القواعد الحالية' : false }, fn);

    before(async () => {
      env = await initializeTestEnvironment({
        projectId: 'demo-qa-' + file.replace(/\W/g, ''),
        firestore: { rules: readFileSync(here(file), 'utf8') },
      });
    });
    after(() => env.cleanup());

    describe('محتوى الموقع cesar_website', () => {
      test('الزائر يقرأ', async () => {
        await seed('cesar_website/main', { items: [] });
        await assertSucceeds(getDoc(doc(visitor(), 'cesar_website/main')));
      });
      test('الزائر لا يكتب', () => assertFails(setDoc(doc(visitor(), 'cesar_website/main'), { x: 1 })));
      test('مستخدم آخر مسجل لا يكتب', () => assertFails(setDoc(doc(stranger(), 'cesar_website/main'), { x: 1 })));
      test('المالك يكتب', () => assertSucceeds(setDoc(doc(owner(), 'cesar_website/main'), { x: 1 })));
    });

    for (const col of ['miracos_accounting', 'cesar_accounting_sales', 'cesar_accounting_expenses']) {
      describe(`الحسابات ${col}`, () => {
        test('الزائر لا يقرأ ولا يكتب', async () => {
          await seed(`${col}/main`, { total: 1000 });
          await assertFails(getDoc(doc(visitor(), `${col}/main`)));
          await assertFails(setDoc(doc(visitor(), `${col}/main`), { total: 0 }));
        });
        test('مستخدم آخر مسجل لا يقرأ ولا يكتب', async () => {
          await assertFails(getDoc(doc(stranger(), `${col}/main`)));
          await assertFails(setDoc(doc(stranger(), `${col}/main`), { total: 0 }));
        });
        test('المالك يقرأ ويكتب', async () => {
          await assertSucceeds(getDoc(doc(owner(), `${col}/main`)));
          await assertSucceeds(setDoc(doc(owner(), `${col}/main`), { total: 2000 }));
        });
      });
    }

    describe('أي مجموعة غير مذكورة مرفوضة', () => {
      test('site_requests', () => assertFails(setDoc(doc(visitor(), 'site_requests/x'), { a: 1 })));
      test('مجموعة عشوائية', () => assertFails(getDoc(doc(owner(), 'random/x'))));
    });

    describe('عدّاد الزيارات cesar_stats', () => {
      const path = `cesar_stats/${DAY}`;
      test('الزائر لا يقرأ الإحصائيات', () => assertFails(getDoc(doc(visitor(), path))));
      test('المالك يقرأ', () => assertSucceeds(getDoc(doc(owner(), path))));
      test('أول زيارة باليوم تُنشئ العداد', () => assertSucceeds(setDoc(doc(visitor(), path), { date: DAY, count: 1 })));
      test('زيادة 1 مسموحة', () => assertSucceeds(updateDoc(doc(visitor(), path), { count: increment(1) })));
      test('زيادة دولة واحدة بـ1 مسموحة', () => assertSucceeds(updateDoc(doc(visitor(), path), { 'countries.DZ': increment(1) })));
      test('زيادة 2 مرفوضة', () => assertFails(updateDoc(doc(visitor(), path), { count: increment(2) })));
      test('إنقاص العداد مرفوض', async () => {
        await seed(path, { date: DAY, count: 50, countries: { DZ: 40, FR: 10 } });
        await assertFails(updateDoc(doc(visitor(), path), { count: 0 }));
      });
      test('حقل إضافي مرفوض', () => assertFails(updateDoc(doc(visitor(), path), { hacked: true })));
      test('الحذف مرفوض', () => assertFails(deleteDoc(doc(visitor(), path))));
      test('اسم مستند غير تاريخ مرفوض', () => assertFails(setDoc(doc(visitor(), 'cesar_stats/abc'), { count: 1 })));
      test('إنشاء بعدد كبير مرفوض', () => assertFails(setDoc(doc(visitor(), 'cesar_stats/2026-10-17'), { count: 500 })));

      gap('wipe-countries', 'مسح إحصائيات الدول مرفوض', async () => {
        await seed(path, { date: DAY, count: 50, countries: { DZ: 40, FR: 10 } });
        await assertFails(updateDoc(doc(visitor(), path), { countries: deleteField() }));
      });
      gap('huge-countries', 'حشو آلاف المفاتيح مرفوض', async () => {
        const junk = Object.fromEntries(Array.from({ length: 500 }, (_, i) => ['K' + i, 99999]));
        await assertFails(updateDoc(doc(visitor(), path), { countries: junk }));
      });
      gap('fake-date', 'حقل التاريخ يجب أن يطابق اسم المستند', () =>
        assertFails(setDoc(doc(visitor(), 'cesar_stats/2026-10-18'), { date: 'كلام', count: 1 })));
    });
  });
}
