/*
 * بودجهٔ باندل و دارایی‌ها — اندازه‌گیری از artifact واقعی `dist/`.
 *
 * چرا وجود دارد: ممیزی فاز ۲۳.۴ خواستار «Baseline واقعی: build size · JS bundle ·
 * CSS bundle · route-level chunks · image sizes · 3D models» بود و در گزارش قبلی
 * همهٔ این‌ها `UNVERIFIED` ماندند چون `vite build` در آن نشست اجرا نشد. این ابزار
 * به build نیازی ندارد: از `dist/` موجود می‌خواند، پس baseline واقعی می‌دهد.
 *
 * حالت‌ها:
 *   node scripts/bundle-budget.mjs            گزارش (خروجی همیشه ۰)
 *   node scripts/bundle-budget.mjs --check    نقض بودجه ⇒ کد خروج ۱
 *   node scripts/bundle-budget.mjs --json     خروجی ماشین‌خوان
 *
 * اگر `dist/` نباشد (مثلاً در CI پیش از گام build) **صریحاً skip می‌کند** و کد ۰
 * می‌دهد — ولی پیام skip چاپ می‌شود تا «سبز کاذب» ساخته نشود.
 */

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIST = join(ROOT, 'dist');

const ARGS = new Set(process.argv.slice(2));
const AS_JSON = ARGS.has('--json');
const CHECK = ARGS.has('--check');

const MB = 1024 * 1024;
const KB = 1024;

/*
 * سقف‌ها با ~۱۰٪ حاشیه روی مقادیر اندازه‌گیری‌شدهٔ ۲۰۲۶-۱۰-۰۱ بسته شده‌اند.
 * عددِ خام `dist` عمداً بزرگ است چون مدل‌های سه‌بعدی و ویدیو **دارایی محتوا**
 * هستند نه کد؛ سقف آن‌ها فقط جلوی رشد بی‌برنامه را می‌گیرد.
 */
const BUDGETS = [
  { key: 'js.total', label: 'JS کل', max: 6.3 * MB, actual: (m) => m.byExt['.js'] ?? 0 },
  { key: 'css.total', label: 'CSS کل', max: 1.05 * MB, actual: (m) => m.byExt['.css'] ?? 0 },
  { key: 'js.largest', label: 'بزرگ‌ترین chunk JS', max: 2000 * KB, actual: (m) => m.largest('.js') },
  { key: 'css.largest', label: 'بزرگ‌ترین chunk CSS', max: 800 * KB, actual: (m) => m.largest('.css') },
  { key: 'glb.total', label: 'مدل‌های سه‌بعدی (.glb)', max: 115 * MB, actual: (m) => m.byExt['.glb'] ?? 0 },
  { key: 'mp4.total', label: 'ویدیو (.mp4)', max: 45 * MB, actual: (m) => m.byExt['.mp4'] ?? 0 },
  { key: 'img.total', label: 'تصاویر (.png+.webp+.jpg)', max: 52 * MB, actual: (m) => (m.byExt['.png'] ?? 0) + (m.byExt['.webp'] ?? 0) + (m.byExt['.jpg'] ?? 0) },
  { key: 'dist.total', label: 'کل dist', max: 215 * MB, actual: (m) => m.total },
];

function fmt(bytes) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
  return `${(bytes / KB).toFixed(0)} KB`;
}

function measure() {
  const rows = [];
  let total = 0;

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const size = statSync(full).size;
        rows.push({ path: relative(ROOT, full).split('\\').join('/'), ext: extname(entry.name).toLowerCase(), size });
        total += size;
      }
    }
  };
  walk(DIST);

  const byExt = {};
  for (const row of rows) byExt[row.ext] = (byExt[row.ext] ?? 0) + row.size;

  const largestOf = (ext) => rows.filter((r) => r.ext === ext).reduce((max, r) => Math.max(max, r.size), 0);
  const topOf = (ext, n) => rows.filter((r) => r.ext === ext).sort((a, b) => b.size - a.size).slice(0, n);

  return {
    total,
    files: rows.length,
    byExt,
    chunks: { js: topOf('.js', 10), css: topOf('.css', 10) },
    largest: largestOf,
    biggest: rows.sort((a, b) => b.size - a.size).slice(0, 5),
  };
}

if (!statSync(DIST, { throwIfNoEntry: false })) {
  const message = `⊘ skip — \`dist/\` وجود ندارد (گام build اجرا نشده). بودجه سنجیده نشد.`;
  if (AS_JSON) writeFileSync(1, `${JSON.stringify({ skipped: true, reason: 'dist-missing' }, null, 2)}\n`);
  else console.log(message);
  process.exit(0);
}

const metrics = measure();

const rows = BUDGETS.map((budget) => {
  const value = budget.actual(metrics);
  return { ...budget, value, ok: value <= budget.max, ratio: budget.max ? value / budget.max : 0 };
});

const violations = rows.filter((row) => !row.ok);

if (AS_JSON) {
  writeFileSync(1, `${JSON.stringify({
    skipped: false,
    total: metrics.total,
    files: metrics.files,
    byExt: metrics.byExt,
    chunks: metrics.chunks,
    biggest: metrics.biggest,
    budgets: rows.map(({ key, label, max, value, ok }) => ({ key, label, max, value, ok })),
    violations: violations.map((v) => v.key),
  }, null, 2)}\n`);
  process.exit(CHECK && violations.length ? 1 : 0);
}

console.log('══ بودجهٔ باندل و دارایی‌ها — تپش ══\n');
console.log(`dist: ${fmt(metrics.total)} در ${metrics.files} فایل\n`);

console.log('── به تفکیک پسوند ──');
Object.entries(metrics.byExt)
  .sort((a, b) => b[1] - a[1])
  .forEach(([ext, size]) => console.log(`  ${(ext || '(بی‌پسوند)').padEnd(8)} ${fmt(size).padStart(10)}`));

console.log('\n── بزرگ‌ترین chunkهای JS ──');
metrics.chunks.js.slice(0, 6).forEach((c) => console.log(`  ${fmt(c.size).padStart(9)}  ${c.path}`));
console.log('\n── بزرگ‌ترین chunkهای CSS ──');
metrics.chunks.css.slice(0, 4).forEach((c) => console.log(`  ${fmt(c.size).padStart(9)}  ${c.path}`));

console.log('\n── بودجه ──');
for (const row of rows) {
  const pct = (row.ratio * 100).toFixed(0).padStart(3);
  console.log(`  ${row.ok ? '✓' : '✗'} ${row.label.padEnd(26)} ${fmt(row.value).padStart(10)} / ${fmt(row.max).padStart(10)}  (${pct}%)`);
}

if (violations.length) {
  console.log(`\n✗ ${violations.length} نقض بودجه: ${violations.map((v) => v.key).join(', ')}`);
} else {
  console.log('\n✓ هیچ نقض بودجه‌ای نیست.');
}
console.log('\nنکته: بزرگ‌ترین chunk JS همان `mockData` است (`src/services/wiki/mockData.js`) که طبق');
console.log('ممیزی فاز ۲۰ بک‌اند ندارد؛ کاهشش کارکردی است نه آرایشی.');

process.exit(CHECK && violations.length ? 1 : 0);
