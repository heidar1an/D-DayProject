/*
 * تولید robots.txt و sitemap.xml در dist/ — فاز ۲۲.
 *
 * چرا از `contentStore` نمی‌خواند: `readCollection` روی نبودِ فایل، seed
 * می‌سازد. یک ابزار تولید نقشهٔ سایت هرگز نباید داده بنویسد. پس فایل‌های JSON را
 * **فقط می‌خواند** و در نبودشان، با فهرست خالی ادامه می‌دهد.
 *
 * اجرا:  node scripts/generate-sitemap.mjs [--out=dist]
 */

import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_SITE_URL } from '../database/seo.js';
import { generateSeoFiles } from '../database/seoFiles.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT = resolve(ROOT, outArg ? outArg.split('=')[1] : 'dist');

const result = generateSeoFiles({ rootDir: ROOT, outDir: OUT });

console.log(`✓ robots.txt و sitemap.xml در ${relative(ROOT, result.outputDir) || '.'} نوشته شد`);
console.log(`  دامنهٔ مبنا : ${result.siteUrl}`);
console.log(`  URL در نقشه : ${result.entryCount} (مقالات منتشرشده: ${result.articleCount})`);
if (result.siteUrl === DEFAULT_SITE_URL) {
  console.log('  ⚠️ PUBLIC_SITE_URL تنظیم نشده — دامنهٔ پیش‌فرض توسعه استفاده شد.');
}
