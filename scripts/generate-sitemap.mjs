/*
 * تولید robots.txt و sitemap.xml در dist/ — فاز ۲۲.
 *
 * چرا از `contentStore` نمی‌خواند: `readCollection` روی نبودِ فایل، seed
 * می‌سازد. یک ابزار تولید نقشهٔ سایت هرگز نباید داده بنویسد. پس فایل‌های JSON را
 * **فقط می‌خواند** و در نبودشان، با فهرست خالی ادامه می‌دهد.
 *
 * اجرا:  node scripts/generate-sitemap.mjs [--out=dist]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSitemap, publicEntries, publishedArticles, robotsTxt, siteUrlFromEnv } from '../database/seo.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT = resolve(ROOT, outArg ? outArg.split('=')[1] : 'dist');
const siteUrl = siteUrlFromEnv();

function readJsonIfPresent(relative) {
  const file = resolve(ROOT, relative);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    console.warn(`⚠️ ${relative} خوانده نشد (JSON نامعتبر) — از فهرست عمومی صرف‌نظر شد.`);
    return null;
  }
}

const articles = publishedArticles(readJsonIfPresent('database/content/articles.json'));
const entries = publicEntries({ siteUrl, articles });

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'robots.txt'), robotsTxt({ siteUrl }), 'utf8');
writeFileSync(join(OUT, 'sitemap.xml'), buildSitemap({ siteUrl, entries }), 'utf8');

console.log(`✓ robots.txt و sitemap.xml در ${OUT.replace(`${ROOT}/`, '')} نوشته شد`);
console.log(`  دامنهٔ مبنا : ${siteUrl}`);
console.log(`  URL در نقشه : ${entries.length} (مقالات منتشرشده: ${articles.length})`);
if (siteUrl === 'http://localhost:4173') {
  console.log('  ⚠️ PUBLIC_SITE_URL تنظیم نشده — دامنهٔ پیش‌فرض توسعه استفاده شد.');
}
