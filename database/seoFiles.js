/*
 * نوشتن artifactهای SEO برای build و اجرای دستی.
 *
 * این تابع فقط فایل مقالات را می‌خواند؛ عمداً از contentStore استفاده نمی‌کند،
 * چون خواندن آن ممکن است seedهای زمان‌اجرا بسازد.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSitemap, publicEntries, publishedArticles, robotsTxt, siteUrlFromEnv } from './seo.js';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readJsonIfPresent(rootDir, relativePath) {
  const file = resolve(rootDir, relativePath);
  if (!existsSync(file)) return null;

  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    console.warn(`⚠️ ${relativePath} خوانده نشد (JSON نامعتبر) — از فهرست عمومی صرف‌نظر شد.`);
    return null;
  }
}

/**
 * تولید robots.txt و sitemap.xml در مسیر خروجی.
 * @returns {{ outputDir: string, siteUrl: string, articleCount: number, entryCount: number }}
 */
export function generateSeoFiles({
  rootDir = DEFAULT_ROOT,
  outDir = resolve(rootDir, 'dist'),
  siteUrl = siteUrlFromEnv(),
} = {}) {
  const root = resolve(rootDir);
  const outputDir = resolve(outDir);
  const articles = publishedArticles(readJsonIfPresent(root, 'database/content/articles.json'));
  const entries = publicEntries({ siteUrl, articles });

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'robots.txt'), robotsTxt({ siteUrl }), 'utf8');
  writeFileSync(join(outputDir, 'sitemap.xml'), buildSitemap({ siteUrl, entries }), 'utf8');

  return {
    outputDir,
    siteUrl,
    articleCount: articles.length,
    entryCount: entries.length,
  };
}
