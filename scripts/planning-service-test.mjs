/*
 * planning-service-test — سنجش متنی سرویس ماژول «برنامه‌ریزی و مدیریت».
 *
 * چرا این فایل وجود دارد:
 *   ماژول برنامه‌ریزی به مخازن واقعی پروژه وصل است (`/api/admin/users` و
 *   فضای‌نام‌های مجوز) و دو رفتار حساس دارد که با چشم غیرمسلح دیده نمی‌شوند:
 *     ۱) شمارندهٔ اعلان‌های خوانده‌نشده — اعلان‌های «عقب‌افتاده» خودکار ساخته
 *        می‌شوند و ذخیره نمی‌شوند؛ اگر «خواندن» آن‌ها ثبت نشود، نشان قرمز
 *        برای همیشه روی عدد می‌ماند.
 *     ۲) ارقام مالی — سود ناخالص و خالص از همین تراکنش‌ها محاسبه می‌شوند و
 *        حالت پرداخت فقط «بانکی» و «مستقیم» است.
 *   `npm run build` ممنوع است و jsdom نصب نیست، پس سرویس با esbuild باندل
 *   می‌شود و در Node با شیم حداقلی `window.localStorage` اجرا می‌شود.
 *
 * چه چیزی سنجیده **نمی‌شود** (صادقانه): رابط کاربری، چیدمان و CSS.
 *
 * خروجی موقت در `node_modules/.cache/tapesh-planning/` می‌نشیند تا در مخزن نماند.
 * اجرا: node scripts/planning-service-test.mjs   (یا npm run planning:test)
 *
 * ⚠️ محتوای `HARNESS` **یک رشتهٔ واحد** است. پس هر بک‌تیک یا «${» داخل آن، رشته را
 * از هم می‌پاشد؛ در آن بازه فقط کوتیشن تک‌کوتیشنی و به‌هم‌چسباندن با + بنویس.
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, 'node_modules/.cache/tapesh-planning');
const BUNDLE = path.join(CACHE, 'service.mjs');
const RUNNER = path.join(CACHE, 'run.mjs');

mkdirSync(CACHE, { recursive: true });

/* ── نقطهٔ ورود: فقط لایهٔ سرویس، بدون هیچ کامپوننتی ── */
const ENTRY = path.join(CACHE, 'entry.js');
writeFileSync(ENTRY, [
  "import * as service from '" + path.join(ROOT, 'src/services/planning/planningService.js') + "';",
  "import * as sources from '" + path.join(ROOT, 'src/services/planning/planningSources.js') + "';",
  "import * as jalali from '" + path.join(ROOT, 'src/services/planning/jalali.js') + "';",
  'export { service, sources, jalali };',
].join('\n'));

await build({
  entryPoints: [ENTRY],
  outfile: BUNDLE,
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  logLevel: 'warning',
  /* `productsService` زنجیره‌ای به `dashboardRoute.jsx` می‌رسد، پس React بیرون می‌ماند */
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  /* دارایی‌های تصویری/CSS در این آزمون بی‌اثرند و نباید حل شوند */
  loader: {
    '.css': 'empty',
    '.png': 'empty',
    '.webp': 'empty',
    '.jpg': 'empty',
    '.jpeg': 'empty',
    '.svg': 'empty',
    '.glb': 'empty',
    '.woff2': 'empty',
  },
});

/* ══════════════════════════════════════════════════════════════
 * سنجه‌ها — شیم حداقلی پیش از import، بعد زنجیرهٔ رفتارها
 * ══════════════════════════════════════════════════════════════ */
const HARNESS = String.raw`
const bag = new Map();
const ls = {
  getItem: (k) => (bag.has(k) ? bag.get(k) : null),
  setItem: (k, v) => { bag.set(k, String(v)); },
  removeItem: (k) => { bag.delete(k); },
};
globalThis.window = { localStorage: ls, setTimeout: (fn, ms) => setTimeout(fn, ms) };
globalThis.localStorage = ls;

const mod = await import('BUNDLE_URL');
const planning = mod.service.planning;
const jalali = mod.jalali;

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass += 1; } else { fail += 1; }
  const tail = ok ? '' : '  ← انتظار: ' + JSON.stringify(expected);
  console.log((ok ? 'OK   ' : 'FAIL ') + name + ' → ' + JSON.stringify(actual) + tail);
}

mod.service.setViewer({ id: 'test', name: 'آزمون', level: 'director', unitId: 'u-platform', role: 'مدیر کل' });

/* ۱) ساختار واقعی جای دادهٔ نمونه را گرفته است */
const units = await planning.org.units();
const projects = await planning.org.projects();
check('واحدها از ردهٔ واقعی محصولات پروژه', units.length, mod.sources.unitsFromProducts().length);
check('پروژه‌ها از فهرست رسمی محصولات پروژه', projects.length, mod.sources.projectsFromProducts().length);
check('هیچ واحد/پروژه‌ای بدون منبع نیست', units.length > 0 && projects.length > 0, true);
check('تسک پیش‌فرض وجود ندارد', (await planning.tasks.list()).total, 0);
check('رویداد پیش‌فرض وجود ندارد', (await planning.calendar.list({})).length, 0);
check('ابلاغ پیش‌فرض وجود ندارد', (await planning.assignments.list({})).length, 0);
check('یادآوری پیش‌فرض وجود ندارد', (await planning.reminders.list()).length, 0);
check('تراکنش پیش‌فرض وجود ندارد', (await planning.finance.transactions({})).length, 0);
check('SOP پیش‌فرض وجود ندارد', (await planning.sop.list()).length, 0);
check('اعلان خوانده‌نشده در آغاز', await planning.reminders.unreadCount(), 0);

/* ۲) باگ شمارندهٔ اعلان — اعلان‌های خودکار باید خوانده‌شدنی باشند */
const yesterday = jalali.isoDate(new Date(Date.now() - 86400000));
for (const title of ['عقب‌افتادهٔ الف', 'عقب‌افتادهٔ ب', 'عقب‌افتادهٔ ج']) {
  await planning.tasks.create({ title: title, ownerId: 'test', dueDate: yesterday, status: 'issued' });
}
check('شمارنده پس از سه تسک عقب‌افتاده', await planning.reminders.unreadCount(), 3);
const auto = (await planning.reminders.notifications()).filter((n) => n.auto);
check('اعلان خودکار از تسک‌ها ساخته شد', auto.length, 3);
await planning.reminders.markAllRead();
check('شمارنده پس از «خواندن همه» صفر می‌شود', await planning.reminders.unreadCount(), 0);
check('همهٔ اعلان‌ها خوانده علامت خوردند', (await planning.reminders.notifications()).every((n) => n.read), true);
await planning.tasks.create({ title: 'عقب‌افتادهٔ تازه', ownerId: 'test', dueDate: yesterday, status: 'issued' });
check('شمارنده با یک تسک عقب‌افتادهٔ تازه', await planning.reminders.unreadCount(), 1);
const single = (await planning.reminders.notifications()).find((n) => n.auto && !n.read);
await planning.reminders.markRead(single.id);
check('شمارنده پس از خواندن تک‌مورد صفر می‌شود', await planning.reminders.unreadCount(), 0);

/* ۳) مالی — ثبت دستی هزینه/درآمد و حالت پرداخت دوگانه */
const today = jalali.isoDate(new Date());
const expense = await planning.finance.create({ title: 'خرید فضای ابرابی', kind: 'direct-cost', amount: 500000, date: today, payment: 'bank' });
check('کد تراکنش خودکار ساخته شد', expense.code, 'FIN-1001');
check('حالت پرداخت بانکی ثبت شد', expense.payment, 'bank');
await planning.finance.create({ title: 'شهریهٔ دوره', kind: 'income', amount: 3000000, date: today, payment: 'direct' });
await planning.finance.create({ title: 'اجارهٔ سرور', kind: 'indirect-cost', amount: 400000, date: today, payment: 'bank' });

const s = await planning.finance.summary({});
check('پول ورودی', s.inflow, 3000000);
check('هزینهٔ مستقیم', s.directCost, 500000);
check('هزینهٔ غیرمستقیم', s.indirectCost, 400000);
check('مجموع هزینه‌ها', s.expenses, 900000);
check('سود ناخالص = درآمد − هزینهٔ مستقیم', s.grossProfit, 2500000);
check('سود خالص = درآمد − همهٔ هزینه‌ها', s.netProfit, 2100000);
check('تفکیک پرداخت بانکی', s.payments.total.bank, 900000);
check('تفکیک پرداخت مستقیم', s.payments.total.direct, 3000000);
check('فیلتر حالت پرداخت بانکی', (await planning.finance.transactions({ payment: 'bank' })).length, 2);

let rejected = false;
try {
  await planning.finance.create({ title: 'نامعتبر', kind: 'direct-cost', amount: 1000, date: today, payment: 'cash' });
} catch (error) { rejected = Boolean(error.fields && error.fields.payment); }
check('حالت پرداخت سوم پذیرفته نمی‌شود', rejected, true);

await planning.finance.update(expense.id, { amount: 600000 });
check('ویرایش مبلغ در شاخص‌ها اثر می‌گذارد', (await planning.finance.summary({})).expenses, 1000000);
await planning.finance.remove(expense.id);
check('حذف تراکنش در شاخص‌ها اثر می‌گذارد', (await planning.finance.summary({})).expenses, 400000);

/* ۴) پاک‌کردن داده — محتوا می‌رود، ساختار می‌ماند */
await planning.settings.clear();
check('پس از پاک‌سازی: تسک‌ها', (await planning.tasks.list()).total, 0);
check('پس از پاک‌سازی: تراکنش‌ها', (await planning.finance.transactions({})).length, 0);
check('پس از پاک‌سازی: واحدها باقی مانده‌اند', (await planning.org.units()).length, units.length);
check('پس از پاک‌سازی: شمارنده صفر', await planning.reminders.unreadCount(), 0);

console.log('');
console.log(pass + ' موفق · ' + fail + ' ناموفق');
process.exit(fail ? 1 : 0);
`;

writeFileSync(RUNNER, HARNESS.replace('BUNDLE_URL', pathToFileURL(BUNDLE).href));

const result = spawnSync(process.execPath, [RUNNER], { stdio: 'inherit' });
rmSync(ENTRY, { force: true });
process.exit(result.status ?? 1);
