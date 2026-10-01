/*
 * اجرای مهاجرت‌های دادهٔ نسخه‌دار — فاز ۱۲.
 *
 * پیش‌فرض **dry-run** است. برای نوشتن واقعی باید `--apply` بدهی. این عمدی است:
 * مهاجرت دادهٔ کاربر است و اجرای ناخواسته‌اش جبران‌پذیر نیست.
 *
 * استفاده:
 *   node scripts/data-migrate.mjs                 # فقط گزارش (بدون نوشتن)
 *   node scripts/data-migrate.mjs --apply         # اجرا با پشتیبان
 *   node scripts/data-migrate.mjs --only=0001
 *   node scripts/data-migrate.mjs --json
 *
 * کد خروج: ۰ بدون شکست · ۱ شکست · ۲ خطای اجرا
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runMigrations } from '../database/migrations/runner.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const apply = argv.includes('--apply');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',').filter(Boolean) : null;

const report = await runMigrations({ root: ROOT, apply, only });

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.ok ? 0 : 1);
}

console.log(`══ مهاجرت داده — تپش (${apply ? 'اجرا' : 'dry-run'}) ══`);

for (const row of report.migrations) {
  console.log(`\n▸ ${row.migration}  ${row.description ?? ''}  [${row.status}]`);
  for (const store of row.stores ?? []) {
    const mark = store.status === 'applied' ? '✓' : store.status === 'would-change' ? '~' : store.status === 'no-change' ? '·' : '✗';
    console.log(`   ${mark} ${store.store.padEnd(22)} ${store.status}${store.backup ? `  پشتیبان: ${store.backup}` : ''}${store.detail ? `  (${store.detail})` : ''}`);
  }
}

console.log('');
console.log(`تغییر لازم: ${report.pendingChanges}   شکست: ${report.failures}`);
console.log(
  apply
    ? 'نتیجه: اجرا شد. برای صحت داده بعدش `npm run data:check` را اجرا کن.'
    : 'حالت dry-run: هیچ فایلی نوشته نشد. برای اجرا `--apply` بده.',
);

process.exit(report.ok ? 0 : 1);
