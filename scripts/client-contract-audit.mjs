#!/usr/bin/env node
/*
 * ممیزی سازگاری Client ↔ API — فاز ۷، بخش ۲۳.
 *
 * پرسش: سرویس‌های کلاینت کدام مسیرها را **واقعاً** صدا می‌زنند، کدام را فقط
 * در کامنت/README **توصیف** می‌کنند، و کدام مسیر توصیف‌شده در سرور **وجود ندارد**؟
 *
 * سه دستهٔ خروجی:
 *   • `used`         → تماس شبکهٔ واقعی (`fetch('/api/…')`) که مسیرش در موجودی هست
 *   • `documented`   → مسیر فقط در متن/کامنت آمده و در سرور وجود ندارد
 *   • `brokenCall`   → تماس شبکهٔ واقعی به مسیری که در سرور وجود ندارد  ← ⚠ خطا
 *
 * ⚠️ ایستا است. «تماس واقعی» یعنی الگوی `fetch('…/api/…')` دیده شد؛ نه اینکه
 * در اجرا اثبات شده باشد.
 *
 * استفاده: `node scripts/client-contract-audit.mjs [--json] [--selftest]`
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_PATH = resolve(ROOT, 'docs/api/api-contract.json');

/* ─────────────────── موجودی مسیرهای سرور ─────────────────── */

if (!existsSync(CONTRACT_PATH)) {
  console.error('  ✗ docs/api/api-contract.json نیست — اول `node scripts/api-contract.mjs` را اجرا کن.');
  process.exit(2);
}
const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
const serverRoutes = contract.routes.map((route) => route.path);

/* ─────────────────── استخراج مسیرهای کلاینت ─────────────────── */

function collectFiles(directory, extensions = ['.js', '.jsx']) {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(path, extensions));
    else if (extensions.some((extension) => entry.name.endsWith(extension))) out.push(path);
  }
  return out;
}

/**
 * نرمال‌سازی یک مسیر برای مقایسه.
 *
 * ⚠️ دو حالت `${…}` که باید **جدا** رفتار شوند (باگِ واقعیِ نسخهٔ اول):
 *   `/api/attempts/${id}/answers`  → قطعهٔ مسیر است ⇒ `/:p`
 *   `/api/public/feedback/replies${query}` → رشتهٔ query است ⇒ باید **حذف** شود
 * اگر هر دو یکسان رفتار شوند، دومی به `/replies:p` تبدیل می‌شود و کاذب
 * «تماس به مسیر ناموجود» گزارش می‌شود.
 */
function normalizePath(raw) {
  return raw
    .replace(/[`'"]+$/, '')
    .replace(/\/\$\{[^}]*\}/g, '/:p')   /* placeholder به‌عنوان قطعهٔ مسیر */
    .replace(/\$\{[^}]*\}/g, '')        /* placeholder چسبیده = query */
    .replace(/[?&].*$/, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\*+/g, ':p')
    .replace(/:[A-Za-z0-9_]+/g, ':p')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '');
}

const ROUTE_RE = /\/api\/[A-Za-z0-9/_:.${}*-]*/g;
const FETCH_RE = /fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/g;

const files = collectFiles(resolve(ROOT, 'src'));
const used = new Map();      /* path → Set(file) */
const documented = new Map(); /* path → Set(file) */

for (const file of files) {
  const relative = file.slice(ROOT.length + 1);
  const source = readFileSync(file, 'utf8');

  const called = new Set();
  for (const hit of source.matchAll(FETCH_RE)) {
    for (const token of hit[1].matchAll(ROUTE_RE)) called.add(normalizePath(token[0]));
  }
  for (const token of source.matchAll(ROUTE_RE)) {
    const path = normalizePath(token[0]);
    if (!path || path === '/api') continue;
    const bucket = called.has(path) ? used : documented;
    if (!bucket.has(path)) bucket.set(path, new Set());
    bucket.get(path).add(relative);
  }
}

const matchesServer = (path) => serverRoutes.some((route) => normalizePath(route) === path);

const report = {
  generatedAt: new Date().toISOString(),
  scannedFiles: files.length,
  serverRoutes: serverRoutes.length,
  used: [...used.keys()].sort().map((path) => ({ path, files: [...used.get(path)], implemented: matchesServer(path) })),
  documented: [...documented.keys()].sort().map((path) => ({ path, files: [...documented.get(path)] })),
};

report.brokenCalls = report.used.filter((entry) => !entry.implemented);
report.documentedNotImplemented = report.documented.filter((entry) => !matchesServer(entry.path));

/* ─────────────────── خودآزمون ─────────────────── */

function selfTest() {
  const failures = [];
  const cases = [
    ['/api/attempts/${id}/answers', '/api/attempts/:p/answers'],
    ['/api/admin/flashcards*', '/api/admin/flashcards:p'],
    ["/api/users/me'", '/api/users/me'],
    ['/api/public/feedback/replies?userId=1', '/api/public/feedback/replies'],
    /* ⚠ قفل باگ واقعی: placeholder چسبیده رشتهٔ query است، نه قطعهٔ مسیر */
    ['/api/public/feedback/replies${query}', '/api/public/feedback/replies'],
    ['/api/exams/:slug', '/api/exams/:p'],
  ];
  for (const [input, expected] of cases) {
    if (normalizePath(input) !== expected) failures.push(`normalizePath('${input}') → '${normalizePath(input)}' ≠ '${expected}'`);
  }
  if (normalizePath('/api/') !== '/api') failures.push('normalizePath ریشه را نرمال نکرد');
  return failures;
}

const selfTestFailures = selfTest();
if (process.argv.includes('--selftest')) {
  if (selfTestFailures.length) {
    for (const line of selfTestFailures) console.log(`  ✗ ${line}`);
    process.exit(1);
  }
  console.log('  ✓ خودآزمون نرمال‌سازی مسیر سبز');
  process.exit(0);
}

if (process.argv.includes('--json')) {
  writeFileSync(1, `${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.brokenCalls.length ? 1 : 0);
}

/* ─────────────────── خروجی ─────────────────── */

const pad = (value, width) => {
  const text = String(value ?? '—');
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
};

console.log('');
console.log('── سازگاری Client ↔ API (بند ۲۳) ──');
console.log(`  فایل‌های اسکن‌شده        : ${report.scannedFiles}`);
console.log(`  مسیر سرور               : ${report.serverRoutes}`);
console.log(`  مسیر با تماس واقعی       : ${report.used.length}  (پیاده‌شده: ${report.used.filter((e) => e.implemented).length})`);
console.log(`  مسیر فقط توصیف‌شده       : ${report.documented.length}  (بدون مسیر سرور: ${report.documentedNotImplemented.length})`);

if (report.brokenCalls.length) {
  console.log('');
  console.log('  ⚠ تماس واقعی به مسیر ناموجود:');
  for (const entry of report.brokenCalls) console.log(`    ${pad(entry.path, 46)}${entry.files.join(', ')}`);
}

console.log('');
console.log('  ── مسیرهای با تماس واقعی ──');
for (const entry of report.used) {
  console.log(`  ${entry.implemented ? '✓' : '✗'} ${pad(entry.path, 46)}${entry.files[0]}${entry.files.length > 1 ? ` +${entry.files.length - 1}` : ''}`);
}

console.log('');
console.log(`  ── DOCUMENTED BUT NOT IMPLEMENTED (${report.documentedNotImplemented.length}) ──`);
for (const entry of report.documentedNotImplemented.slice(0, 60)) {
  console.log(`  · ${pad(entry.path, 52)}${entry.files[0]}`);
}
if (report.documentedNotImplemented.length > 60) {
  console.log(`  … و ${report.documentedNotImplemented.length - 60} مورد دیگر (JSON را ببین)`);
}

mkdirSync(resolve(ROOT, 'docs/api'), { recursive: true });
const out = resolve(ROOT, 'docs/api/client-contract-audit.json');
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log('');
console.log('  JSON: docs/api/client-contract-audit.json');
console.log(`  وضعیت: ${report.brokenCalls.length ? `✗ ${report.brokenCalls.length} تماس شکسته` : '✓ هیچ تماس شکسته‌ای نیست'}`);
console.log('');
process.exitCode = report.brokenCalls.length ? 1 : 0;
