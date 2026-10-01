/*
 * اعتبارسنجی SEO — فاز ۲۲.
 *
 * چه می‌سنجد (و چرا هر کدام):
 *   ۱. `robots.txt` در dist باشد و `Sitemap:` به دامنهٔ درست اشاره کند.
 *   ۲. `sitemap.xml` معتبر باشد، URL تکراری نداشته باشد و **هیچ URL خصوصی**
 *      (`#admin` / `#dashboard` / `/api/`) داخلش نباشد — نقشهٔ سایت با آدرس
 *      پنل، خزنده را به ناحیهٔ ممنوع می‌فرستد.
 *   ۳. همهٔ URLها هم‌دامنه با `PUBLIC_SITE_URL` باشند (نه `localhost` در
 *      production).
 *   ۴. متای پایهٔ صفحهٔ ریشه کامل باشد: canonical، og:title/description/image/url،
 *      twitter:card، JSON-LD، title و description.
 *
 * اجرا:  node scripts/seo-validate.mjs [--json]
 * کد خروج: ۰ سبز · ۱ یافته · ۲ خطا
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_SITE_URL, injectBaselineMeta, isPrivateHash, siteUrlFromEnv, validateSeoHtml } from '../database/seo.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const siteUrl = siteUrlFromEnv();
const problems = [];
const notes = [];

const robotsPath = resolve(ROOT, 'dist/robots.txt');
const sitemapPath = resolve(ROOT, 'dist/sitemap.xml');
const indexHtmlPath = resolve(ROOT, 'dist/index.html');

/* ── ۱. robots.txt ── */
if (!existsSync(robotsPath)) {
  problems.push('dist/robots.txt نیست — `npm run seo:generate` را اجرا کن');
} else {
  const robots = readFileSync(robotsPath, 'utf8');
  if (!/^Sitemap:\s*\S+\/sitemap\.xml\s*$/m.test(robots)) problems.push('robots.txt خط Sitemap ندارد');
  if (!/^Disallow:\s*\/api\/\s*$/m.test(robots)) problems.push('robots.txt مسیر /api/ را نمی‌بندد');
  if (!robots.includes(`${siteUrl}/sitemap.xml`)) problems.push(`robots.txt به دامنهٔ دیگری اشاره می‌کند (انتظار: ${siteUrl})`);
}

/* ── ۲ و ۳. sitemap.xml ── */
if (!existsSync(sitemapPath)) {
  problems.push('dist/sitemap.xml نیست — `npm run seo:generate` را اجرا کن');
} else {
  const sitemap = readFileSync(sitemapPath, 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((hit) => hit[1]);

  if (!sitemap.startsWith('<?xml')) problems.push('sitemap.xml سرآغاز XML ندارد');
  if (!sitemap.includes('<urlset')) problems.push('sitemap.xml عنصر urlset ندارد');
  if (locs.length === 0) problems.push('sitemap.xml هیچ URL ندارد');

  const duplicates = locs.filter((loc, index) => locs.indexOf(loc) !== index);
  if (duplicates.length) problems.push(`URL تکراری در sitemap: ${[...new Set(duplicates)].join(', ')}`);

  const privateLocs = locs.filter((loc) => isPrivateHash(loc) || loc.includes('/api/'));
  if (privateLocs.length) problems.push(`URL خصوصی در sitemap: ${privateLocs.join(', ')}`);

  const foreign = locs.filter((loc) => !loc.startsWith(siteUrl));
  if (foreign.length) problems.push(`URL با دامنهٔ ناهمخوان در sitemap: ${foreign.slice(0, 3).join(', ')}`);

  notes.push(`URL در نقشهٔ سایت: ${locs.length}`);
}

/* ── ۴. متای صفحهٔ ریشه ── */
if (!existsSync(indexHtmlPath)) {
  problems.push('dist/index.html نیست — build را اجرا کن');
} else {
  /* همان تزریقی که سرور در زمان سرو انجام می‌دهد — پس اینجا هم سنجیده می‌شود */
  const served = injectBaselineMeta(readFileSync(indexHtmlPath, 'utf8'), { siteUrl });
  for (const problem of validateSeoHtml(served)) problems.push(`index.html: ${problem}`);

  if (/name="robots"\s+content="[^"]*index/i.test(served) && !/#admin/.test(served)) {
    /* متای noindex روی صفحهٔ ریشه فقط وقتی درست است که برای ناحیهٔ خصوصی تزریق شده باشد */
    notes.push('متای robots روی HTML سروشده دیده شد (فقط برای ناحیهٔ خصوصی باید باشد)');
  }
}

if (siteUrl === DEFAULT_SITE_URL) {
  notes.push(`PUBLIC_SITE_URL تنظیم نشده — دامنهٔ پیش‌فرض توسعه (${DEFAULT_SITE_URL}) استفاده شد`);
}

const ok = problems.length === 0;

if (asJson) {
  process.stdout.write(`${JSON.stringify({ ok, siteUrl, problems, notes }, null, 2)}\n`);
  process.exit(ok ? 0 : 1);
}

console.log('══ اعتبارسنجی SEO — تپش ══');
console.log(`  دامنهٔ مبنا: ${siteUrl}`);
for (const note of notes) console.log(`  · ${note}`);
console.log('');
if (ok) console.log('  ✓ robots.txt، sitemap.xml و متای پایه سالم‌اند');
for (const problem of problems) console.log(`  ✗ ${problem}`);
console.log('');
console.log(ok ? 'نتیجه: سبز' : `نتیجه: ${problems.length} یافته`);

process.exit(ok ? 0 : 1);
