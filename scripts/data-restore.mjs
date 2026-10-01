#!/usr/bin/env node
/*
 * بازگردانی دادهٔ پروژه — `npm run data:restore -- --archive=<path.tar.gz> [--apply]`
 *
 * چه می‌کند:
 *   ۱) آرشیو را در یک دایرکتوری موقت باز می‌کند (به دادهٔ واقعی دست نمی‌زند)
 *   ۲) هر فایل را با SHA-256 مانیفست `SHA256SUMS-*.txt` **تأیید** می‌کند
 *   ۳) در حالت پیش‌فرض فقط گزارش می‌دهد (dry-run)
 *   ۴) با `--apply` نخست از فایل‌های فعلی عکس امنیتی می‌گیرد، بعد جایگزین می‌کند
 *
 * چرا پیش‌فرض dry-run: بازگردانی یک عملیات مخرب است. تأیید یک‌باره برای
 * «بازنویسی همهٔ فایل‌های دادهٔ پروژه» کافی نیست؛ باید اول دید چه چیزی عوض می‌شود.
 *
 * چرا پیش از apply عکس امنیتی: اگر آرشیو از پروژهٔ دیگری یا از زمانی خیلی
 * قدیم باشد، بازگردانی همان لحظه دادهٔ فعلی را از بین می‌برد. عکس امنیتی
 * «برگشت از برگشت» را ممکن می‌کند.
 *
 * گزینه‌ها:
 *   --archive=PATH   آرشیو `.tar.gz` (اجباری)
 *   --manifest=PATH  مانیفست چک‌سام (پیش‌فرض: کنار آرشیو، هم‌برچسب)
 *   --root=DIR       مقصد بازگردانی (پیش‌فرض: ریشهٔ پروژه) — برای تست
 *   --apply          واقعاً بنویس (پیش‌فرض: فقط گزارش)
 *   --no-safety      عکس امنیتی پیش از apply گرفته نشود (پیشنهاد نمی‌شود)
 *
 * کد خروج: ۰ موفق · ۱ خطای استفاده · ۲ شکست یکپارچگی · ۳ شکست در نوشتن
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const valueOf = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const ARCHIVE = valueOf('archive', '');
const TARGET_ROOT = resolve(valueOf('root', ROOT));
const APPLY = flag('apply');
const SAFETY = !flag('no-safety');

if (!ARCHIVE) {
  console.error('استفاده: node scripts/data-restore.mjs --archive=<path.tar.gz> [--manifest=PATH] [--root=DIR] [--apply]');
  process.exit(1);
}
if (!existsSync(ARCHIVE)) {
  console.error(`آرشیو پیدا نشد: ${ARCHIVE}`);
  process.exit(1);
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const stamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

/* ─────────────────────────── مانیفست ─────────────────────────── */

function findManifest() {
  const explicit = valueOf('manifest', '');
  if (explicit) return resolve(explicit);

  const dir = dirname(resolve(ARCHIVE));
  const base = resolve(ARCHIVE).slice(dir.length + 1).replace(/\.tar\.gz$/, '');
  const candidates = readdirSync(dir).filter((name) => name.startsWith('SHA256SUMS-') && name.endsWith('.txt'));
  const exact = candidates.find((name) => name === `SHA256SUMS-${base}.txt`);
  return exact ? join(dir, exact) : (candidates.length === 1 ? join(dir, candidates[0]) : '');
}

const MANIFEST = findManifest();
if (!MANIFEST || !existsSync(MANIFEST)) {
  console.error('مانیفست چک‌سام پیدا نشد. با --manifest=PATH مشخصش کن.');
  process.exit(1);
}

/* هر خط: `<sha256>  <relative/path>` */
const entries = readFileSync(MANIFEST, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^([0-9a-f]{64})\s+(.+)$/i);
    return match ? { sha: match[1].toLowerCase(), rel: match[2] } : null;
  })
  .filter(Boolean);

if (entries.length === 0) {
  console.error('مانیفست هیچ چک‌سام معتبری ندارد.');
  process.exit(1);
}

/* گارد مسیر: مانیفست نباید بتواند بیرون از ریشه بنویسد. */
for (const entry of entries) {
  if (isAbsolute(entry.rel) || entry.rel.split(/[/\\]/).includes('..')) {
    console.error(`مسیر غیرمجاز در مانیفست: ${entry.rel}`);
    process.exit(2);
  }
}

/* ─────────────────────────── باز کردن آرشیو ─────────────────────────── */

const workDir = mkdtempSync(join(tmpdir(), 'tapesh-restore-'));

try {
  execFileSync('tar', ['-xzf', resolve(ARCHIVE), '-C', workDir], { stdio: 'pipe' });
} catch (error) {
  console.error('باز کردن آرشیو شکست خورد:', error?.message ?? '');
  rmSync(workDir, { recursive: true, force: true });
  process.exit(2);
}

/* ─────────────────────────── تأیید یکپارچگی ─────────────────────────── */

const verified = [];
const failures = [];

for (const entry of entries) {
  const source = join(workDir, entry.rel);
  if (!existsSync(source)) {
    failures.push({ rel: entry.rel, reason: 'در آرشیو نیست' });
    continue;
  }
  const actual = sha256(readFileSync(source));
  if (actual !== entry.sha) {
    failures.push({ rel: entry.rel, reason: 'چک‌سام نمی‌خواند' });
    continue;
  }
  verified.push({ ...entry, source });
}

console.log('');
console.log('── بازگردانی داده — تپش ──');
console.log(`  آرشیو   : ${relative(process.cwd(), resolve(ARCHIVE))}`);
console.log(`  مانیفست : ${relative(process.cwd(), MANIFEST)}`);
console.log(`  مقصد    : ${TARGET_ROOT}`);
console.log(`  حالت    : ${APPLY ? 'اعمال (--apply)' : 'آزمایشی (dry-run)'}`);
console.log(`  تأییدشده: ${verified.length}/${entries.length}`);

if (failures.length > 0) {
  console.log('');
  console.log(`  ✗ ${failures.length} فایل تأیید نشد — بازگردانی متوقف شد و هیچ فایلی نوشته نشد:`);
  for (const row of failures.slice(0, 20)) console.log(`      • ${row.rel} — ${row.reason}`);
  rmSync(workDir, { recursive: true, force: true });
  process.exit(2);
}

/* ─────────────────────────── تفاوت با وضعیت فعلی ─────────────────────────── */

const changed = [];
const same = [];
for (const item of verified) {
  const target = join(TARGET_ROOT, item.rel);
  if (!existsSync(target)) changed.push({ ...item, state: 'تازه' });
  else if (sha256(readFileSync(target)) === item.sha) same.push(item);
  else changed.push({ ...item, state: 'تغییرکرده' });
}

console.log(`  یکسان با فعلی: ${same.length}`);
console.log(`  تفاوت        : ${changed.length}`);
for (const row of changed.slice(0, 30)) console.log(`      • ${row.rel}  (${row.state})`);
if (changed.length > 30) console.log(`      … و ${changed.length - 30} فایل دیگر`);

if (!APPLY) {
  console.log('');
  console.log('  ⓘ برای اعمال: همان فرمان را با --apply تکرار کن.');
  console.log('');
  rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
}

/* ─────────────────────────── عکس امنیتی و اعمال ─────────────────────────── */

let safetyDir = '';
if (SAFETY && changed.length > 0) {
  safetyDir = resolve(ROOT, '.workbuddy-ai', 'backups', `pre-restore-${stamp()}`);
  for (const item of changed) {
    const target = join(TARGET_ROOT, item.rel);
    if (!existsSync(target)) continue;
    const dest = join(safetyDir, item.rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(target, dest);
  }
  console.log('');
  console.log(`  عکس امنیتی: ${relative(process.cwd(), safetyDir)}`);
}

let written = 0;
try {
  for (const item of verified) {
    const target = join(TARGET_ROOT, item.rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(item.source, target);
    written += 1;
  }
} catch (error) {
  console.error('نوشتن شکست خورد:', error?.message ?? '');
  rmSync(workDir, { recursive: true, force: true });
  process.exit(3);
}

rmSync(workDir, { recursive: true, force: true });

console.log(`  نوشته‌شده: ${written} فایل`);
console.log('');
console.log('  ⓘ گام بعدی:  npm run data:check');
console.log('');

/* خروجی ماشین‌خوان برای تست */
if (process.env.TAPESH_RESTORE_JSON === '1') {
  writeFileSync(1, `${JSON.stringify({ verified: verified.length, changed: changed.length, written, safetyDir }, null, 2)}\n`);
}
