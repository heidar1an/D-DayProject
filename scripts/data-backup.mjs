#!/usr/bin/env node
/*
 * پشتیبان‌گیری از دادهٔ پروژه — `npm run data:backup`
 *
 * چه می‌کند:
 *   ۱) فهرست همهٔ فایل‌های داده را از لایهٔ Schema می‌گیرد (منبع حقیقت)
 *   ۲) از هر فایل SHA-256 می‌گیرد و `SHA256SUMS-<label>.txt` می‌سازد
 *   ۳) یک `tar.gz` زمان‌دار در `.workbuddy-ai/backups/` می‌سازد
 *
 * چرا از Schema و نه از `ls`: اگر فایل داده‌ای در Schema نباشد، پشتیبان هم
 * نمی‌گیرد و کسی نمی‌فهمد. Schema تنها فهرستِ قابل‌اعتماد است.
 *
 * گزینه‌ها:
 *   --label=NAME   برچسب پشتیبان (پیش‌فرض: data)
 *   --out=DIR      مسیر مقصد (پیش‌فرض: .workbuddy-ai/backups)
 *   --list         فقط فهرست فایل‌ها و حجم، بدون ساخت آرشیو
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS } from '../database/models/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const LABEL = valueOf('label', 'data');
const OUT_DIR = resolve(ROOT, valueOf('out', '.workbuddy-ai/backups'));
const LIST_ONLY = args.includes('--list');

/* ─────────────────────────── فهرست فایل‌ها ─────────────────────────── */

/** همهٔ فایل‌های داده، یکتا، بر اساس Schema. */
function datasetFiles() {
  const files = new Set();
  for (const schema of MODELS) {
    if (schema.file) files.add(schema.file);
  }
  return [...files].sort();
}

/** مُهر زمانی محلی `YYYYMMDD-HHMMSS`. */
function stamp(date = new Date()) {
  const pad = (n, size = 2) => String(n).padStart(size, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

/* ─────────────────────────── اجرا ─────────────────────────── */

const files = datasetFiles();
const present = [];
const absent = [];

for (const file of files) {
  const path = resolve(ROOT, file);
  if (existsSync(path)) present.push({ file, path, size: statSync(path).size });
  else absent.push(file);
}

console.log('');
console.log('── پشتیبان‌گیری از داده — تپش ──');
console.log(`  فایل دادهٔ اعلام‌شده در Schema : ${files.length}`);
console.log(`  موجود                        : ${present.length}`);
if (absent.length) console.log(`  ناموجود                      : ${absent.length}  (${absent.join(', ')})`);
console.log(`  حجم کل                       : ${(present.reduce((sum, item) => sum + item.size, 0) / 1024).toFixed(1)} KB`);

if (LIST_ONLY) {
  console.log('');
  for (const item of present) console.log(`  ${(item.size / 1024).toFixed(1).padStart(8)} KB  ${item.file}`);
  console.log('');
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });

const label = `${LABEL}-${stamp()}`;
const archive = resolve(OUT_DIR, `${label}.tar.gz`);
const manifest = resolve(OUT_DIR, `SHA256SUMS-${label}.txt`);

const lines = [];
for (const item of present) lines.push(`${sha256(item.path)}  ${item.file}`);
writeFileSync(manifest, `${lines.join('\n')}\n`, 'utf8');

execFileSync('tar', ['-czf', archive, ...present.map((item) => relative(ROOT, item.path))], {
  cwd: ROOT,
  stdio: 'pipe',
});

console.log('');
console.log(`  آرشیو   : ${relative(ROOT, archive)}`);
console.log(`  مانیفست : ${relative(ROOT, manifest)}  (${lines.length} چک‌سام)`);
console.log(`  حجم     : ${(statSync(archive).size / 1024).toFixed(1)} KB`);
console.log('');
console.log('  ⓘ بازگردانی: tar -xzf <آرشیو> -C .  و بعد  npm run data:check');
console.log('');
