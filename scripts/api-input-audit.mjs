#!/usr/bin/env node
/*
 * ممیزی ورودی API — PHASE 5، بخش ۴۶.
 *
 * پرسش: برای هر Route **نوشتن**، ورودی Client کجا اعتبارسنجی می‌شود؟
 *
 * سه لایه ممکن است:
 *   ۱) در خودِ هندلر (`adminApi.js`)   → رد صریح / محدودسازی / گارد نوع
 *   ۲) در لایهٔ ذخیره‌سازی (delegate)   → هندلر تابعی از `contentStore.js` و…
 *      را صدا می‌زند و آن تابع ورودی را می‌سنجد
 *   ۳) هیچ‌کجا                          → ⚠ نیازمند بازبینی
 *
 * ⚠️ این ابزار **ایستا** است: کد را می‌خواند، اجرا نمی‌کند. پس «سیگنال دارد»
 * یعنی «شاهد اعتبارسنجی دیده شد»، نه «ثابت شده درست است». برای اثبات رفتار
 * واقعی باید تست داشت (`database/adminApi.test.mjs` + `dataIntegrity.test.mjs`).
 *
 * خروجی: جدول متنی + JSON در `.workbuddy-ai/audits/api-input-audit.json`.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/* پارسرهای مشترک — با `scripts/api-contract.mjs` یک نسخه دارند. */
import { matchBracket, bodyBraceIndex, functionBody } from './lib/js-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = resolve(ROOT, 'database/adminApi.js');
const source = readFileSync(SOURCE_PATH, 'utf8');

/* ─────────────────── ابزار متن ─────────────────── */

/*
 * `matchBracket` / `bodyBraceIndex` / `functionBody` به `scripts/lib/js-source.mjs`
 * منتقل شدند تا این ابزار و `api-contract.mjs` **یک** پارسر داشته باشند.
 * درسِ گران: باگِ `bodyBraceIndex` (گرفتن آکولاد پارامتر تخریبی به‌جای بدنه)
 * یک بار کل نتیجهٔ این ممیزی را غلط کرد و «۱۴ حفرهٔ» ناموجود ساخت.
 */

/* ─────────────────── نگاشت تابع → ماژول ─────────────────── */

const importBlocks = [...source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*'([^']+)'/g)];
const functionModule = new Map();
for (const block of importBlocks) {
  const modulePath = block[2];
  if (!modulePath.startsWith('./') && !modulePath.startsWith('../')) continue;
  for (const raw of block[1].split(',')) {
    const name = raw.trim().split(/\s+as\s+/)[0].trim();
    if (name) functionModule.set(name, modulePath);
  }
}

const moduleCache = new Map();
function moduleSource(modulePath) {
  if (moduleCache.has(modulePath)) return moduleCache.get(modulePath);
  const path = resolve(dirname(SOURCE_PATH), modulePath);
  const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
  moduleCache.set(modulePath, text);
  return text;
}

/* ─────────────────── استخراج ROUTES ─────────────────── */

const routesStart = source.indexOf('const ROUTES = [');
const bodyStart = source.indexOf('[', routesStart);
const bodyEnd = matchBracket(source, bodyStart);
const routesBody = source.slice(bodyStart + 1, bodyEnd);

const routes = [];
let cursor = 0;
while (cursor < routesBody.length) {
  const open = routesBody.indexOf('\n  [', cursor);
  if (open === -1) break;
  const entryStart = open + 3;
  const entryEnd = matchBracket(routesBody, entryStart);
  if (entryEnd === -1) break;

  const entry = routesBody.slice(entryStart + 1, entryEnd);
  const method = entry.match(/^\s*'([A-Z]+)'/)?.[1] ?? '?';
  const patternHit = /,\s*'([^']+)'/.exec(entry);
  const pattern = patternHit?.[1] ?? '?';

  /* مجوز: سومین عضو — بعد از الگو جست‌وجو می‌شود تا الگو دوباره خوانده نشود. */
  const afterPattern = patternHit ? entry.slice(patternHit.index + patternHit[0].length) : '';
  const permissionHit = /^\s*,\s*(null|'[^']*')/.exec(afterPattern);
  const permissionRaw = permissionHit?.[1] ?? '?';
  const permission = permissionRaw === 'null' ? null : permissionRaw.replace(/'/g, '');

  const handlerStart = entry.indexOf('=>');
  const handler = handlerStart === -1 ? entry : entry.slice(handlerStart);

  routes.push({ method, pattern, permission, handler });
  cursor = entryEnd + 1;
}

/* ─────────────────── سیگنال‌های اعتبارسنجی ─────────────────── */

const SIGNALS = [
  /*
   * ⚠️ درسِ گرفته‌شده: نسخهٔ اول این سیگنال فقط `VALIDATION_ERROR` را در
   * **بدنهٔ فراخوانی** می‌دید. در این کدبیس آن رشته در **امضای** کمک‌تابع
   * `fail(message, code = 'VALIDATION_ERROR')` است، پس همهٔ گاردهای دست‌نویس
   * (`fail('...')`) «دیده‌نشده» می‌ماندند و ۱۴ مسیر سالم به‌غلط ⚠ می‌گرفتند.
   *
   * ⚠️ اما الگوی سادهٔ `fail(` هم غلط است: `adminApi.js` خودش
   * `fail(code, message)` دارد و `fail('NOT_FOUND', '...')` **پاسخ خطاست،
   * نه اعتبارسنجی ورودی**. پس فقط این دو شکل سیگنال‌اند:
   *   ۱) تک‌آرگومانی `fail('متن')` — سبک `mediaStore.js` که کد پیش‌فرض
   *      `VALIDATION_ERROR` دارد.
   *   ۲) کد خطای صریحِ اعتبارسنجی در هر جای بدنه.
   */
  { id: 'reject', label: 'رد صریح', test: (h) => /VALIDATION_ERROR|PAYLOAD_TOO_LARGE|UNSUPPORTED_MEDIA_TYPE|assertValid\s*\(|\b(fail|reject|invalid|badRequest)\s*\(\s*['"`][^'"`]*['"`]\s*\)/.test(h) },
  { id: 'schema', label: 'لایهٔ Schema', test: (h) => /validateRecord|assertValid|validateEntity|toErrorFields/.test(h) },
  { id: 'allowlist', label: 'فهرست مجاز', test: (h) => /\.includes\(|ALLOWED_|_STATUSES|_KINDS|_TYPES|_ROLES|_PLATFORMS|_METRICS|_EXTENSIONS/.test(h) },
  { id: 'numeric', label: 'گارد عددی', test: (h) => /Number\.isFinite|Number\.isInteger|Number\.isNaN|Number\(|parseInt|parseFloat/.test(h) },
  /* `.slice(0, max)` هم یک گارد طول است — رایج‌ترین شکل محدودسازی در این کدبیس */
  { id: 'length', label: 'گارد طول', test: (h) => /\.length\s*[<>]=?|MAX_[A-Z_]+|Math\.min|Math\.max|\.slice\(\s*\d/.test(h) },
  /* کمک‌تابع‌های محلی `trim/clamp/clean` هم پاک‌سازی‌اند، نه فقط متد `.trim()` */
  { id: 'sanitize', label: 'پاک‌سازی', test: (h) => /sanitize|normalize[A-Z]|escape|\.trim\(\)|\b(trim|clamp|clean)\s*\(/.test(h) },
  /* `bool()/num()` هم تبدیل نوع کل‌به‌جزء (total) هستند */
  { id: 'coerce', label: 'تبدیل نوع', test: (h) => /String\(|Boolean\(|Array\.isArray|Object\.keys|\b(bool|num|int)\s*\(/.test(h) },
];

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const signalsOf = (text) => SIGNALS.filter((signal) => signal.test(text)).map((signal) => signal.id);

/** نام توابع ماژول‌های ذخیره‌سازی که هندلر صدا می‌زند. */
function delegatedCalls(handler) {
  const names = new Set();
  for (const [name, modulePath] of functionModule) {
    if (!/Store\.js$/.test(modulePath)) continue;
    if (!name || name.length < 4) continue;
    if (new RegExp(`\\b${name}\\s*\\(`).test(handler)) names.add(name);
  }
  return [...names];
}

/**
 * سیگنال‌های یک تابع ذخیره‌سازی، **با تعقیب کمک‌تابع‌های محلی همان ماژول**.
 *
 * چرا لازم است: `createArticle` خودش هیچ سیگنالی ندارد و کار را به
 * `articlePayload` می‌سپارد. نگاه تک‌لایه، «بدون اعتبارسنجی» گزارش می‌کرد
 * که نادرست بود. عمق ۳ برای این کدبیس کافی است.
 */
function storeSignalsFor(moduleText, entryName, depth = 3) {
  const found = new Set();
  const visited = new Set();
  const queue = [{ name: entryName, depth }];

  while (queue.length) {
    const { name, depth: level } = queue.shift();
    if (level < 0 || visited.has(name)) continue;
    visited.add(name);

    const body = functionBody(moduleText, name);
    if (!body) continue;
    for (const signal of signalsOf(body)) found.add(signal);

    if (level === 0) continue;
    for (const call of body.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(/g)) {
      const callee = call[1];
      if (visited.has(callee)) continue;
      if (!functionBody(moduleText, callee)) continue;
      queue.push({ name: callee, depth: level - 1 });
    }
  }

  return [...found];
}

const report = routes.map((route) => {
  const handlerSignals = signalsOf(route.handler);
  const delegated = delegatedCalls(route.handler);

  const storeSignals = new Set();
  const storeValidated = [];
  for (const name of delegated) {
    const text = moduleSource(functionModule.get(name));
    const found = storeSignalsFor(text, name);
    if (found.length) storeValidated.push({ fn: name, signals: found });
    for (const signal of found) storeSignals.add(signal);
  }

  const allSignals = [...new Set([...handlerSignals, ...storeSignals])];
  const write = WRITE_METHODS.has(route.method);
  /* بدنهٔ درخواست خوانده می‌شود؟ اگر نه، چیزی برای اعتبارسنجی نیست و مرز
     امنیتی همان مجوز (RBAC) است. */
  const readsBody = /ctx\.body/.test(route.handler);
  /*
   * POST روی مسیر پیش‌نمایش، «نوشتن» نیست — فقط محاسبه است و چیزی ذخیره
   * نمی‌شود. اگر آن را در دستهٔ نوشتن بشماریم، دو مسیر سالم کاذب ⚠ می‌گیرند.
   */
  const preview = write && /\/preview$/.test(route.pattern);

  const layer = !write ? '—'
    : preview ? 'preview'
      : handlerSignals.length ? 'handler'
        : storeSignals.size ? 'store'
          : readsBody ? 'none' : 'rbac';

  return {
    method: route.method,
    pattern: route.pattern,
    permission: route.permission,
    write,
    preview,
    readsBody,
    layer,
    handlerSignals,
    storeValidated,
    signals: allSignals,
    needsReview: write && !preview && readsBody && allSignals.length === 0,
  };
});

/* ─────────────────── خودآزمون استخراج ─────────────────── */

/*
 * چرا لازم است: باگِ `functionBody` (گرفتن آکولادِ پارامترِ تخریبی به‌جای
 * بدنهٔ تابع) یک بار کل نتیجهٔ این ممیزی را غلط کرد و «۱۴ حفره» ساخت که
 * وجود نداشت. این خودآزمون همان کلاس باگ را می‌گیرد.
 */
function selfTest() {
  const failures = [];

  const probe = 'export function sample(id, { text, admin = null } = {}) {\n  if (!text) fail(\'متن لازم است\');\n  return 1;\n}\n';
  const body = functionBody(probe, 'sample');
  if (!body.includes('fail(')) failures.push('functionBody پارامتر تخریبی را بدنه گرفت');
  if (body.includes('admin = null')) failures.push('functionBody آکولاد پارامتر را بدنه گرفت');

  const flat = 'function plain(a, b) { return a + b; }\n';
  if (!functionBody(flat, 'plain').includes('return a + b')) failures.push('functionBody تابع ساده را نیافت');

  const arrow = 'export const pick = (row) => ({ id: row.id });\n';
  if (functionBody(arrow, 'pick') !== '') failures.push('functionBody برای arrow بدون بلوک بدنه ساخت');

  const sig = (h) => SIGNALS.find((s) => s.id === 'reject').test(h);
  if (!sig("fail('متن پاسخ الزامی است');")) failures.push('سیگنال reject تک‌آرگومانی را نگرفت');
  if (sig("fail('NOT_FOUND', 'پیدا نشد');")) failures.push('سیگنال reject پاسخ NOT_FOUND را اعتبارسنجی شمرد');

  return failures;
}

const selfTestFailures = selfTest();
if (process.argv.includes('--selftest')) {
  if (selfTestFailures.length) {
    for (const line of selfTestFailures) console.log(`  ✗ ${line}`);
    process.exit(1);
  }
  console.log('  ✓ خودآزمون استخراج و سیگنال‌ها سبز');
  process.exit(0);
}
if (selfTestFailures.length) {
  console.error('  ⚠ خودآزمون ممیزی شکست خورد — نتیجهٔ زیر قابل اعتماد نیست:');
  for (const line of selfTestFailures) console.error(`    ✗ ${line}`);
  process.exitCode = 1;
}

/* ─────────────────── خروجی ─────────────────── */

if (process.argv.includes('--json')) {
  /*
   * ⚠️ باگِ کشف‌شده در فاز ۷: `console.log` روی **pipe** ناهمگام است و
   * `process.exit()` بی‌درنگ اجرا می‌شود؛ چون اندازهٔ بافر pipe در سیستم‌عامل
   * ۶۴KB است، خروجی JSON این ابزار (≈۶۵KB) هنگام pipe **بریده** می‌شد
   * (`Expected double-quoted property name at position 65466`) و
   * `JSON.parse` شکست می‌خورد — بی‌صدا و بدون کد خطای غیرصفر.
   * راه‌حل: نوشتن همگام روی fd ۱ (`writeFileSync`) پیش از خروج.
   */
  writeFileSync(1, `${JSON.stringify({ generatedAt: new Date().toISOString(), total: report.length, routes: report }, null, 2)}\n`);
  process.exit(0);
}

const pad = (value, width) => {
  const text = String(value ?? '—');
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
};

const writes = report.filter((route) => route.write);
const risky = report.filter((route) => route.needsReview);
const byLayer = (name) => writes.filter((route) => route.layer === name).length;

console.log('');
console.log('── ممیزی ورودی API (بند ۴۶) ──');
console.log(`  مسیر کل                        : ${report.length}`);
console.log(`  مسیر نوشتن                      : ${writes.length}`);
console.log(`    پیش‌نمایش بدون ذخیره (POST)      : ${byLayer('preview')}`);
console.log(`    بدنهٔ درخواست ندارد (مرز=RBAC)  : ${byLayer('rbac')}`);
console.log(`    اعتبارسنجی در هندلر             : ${byLayer('handler')}`);
console.log(`    اعتبارسنجی در لایهٔ ذخیره        : ${byLayer('store')}`);
console.log(`    بدون شاهد اعتبارسنجی            : ${byLayer('none')}  ⚠`);
console.log('');
console.log(`  ${pad('متد', 7)}${pad('مسیر', 50)}${pad('مجوز', 24)}${pad('لایه', 9)}سیگنال‌ها`);
console.log(`  ${'─'.repeat(118)}`);

for (const route of report) {
  if (!route.write) continue;
  const mark = route.needsReview ? ' ⚠' : '';
  console.log(`  ${pad(route.method, 7)}${pad(route.pattern, 50)}${pad(route.permission, 24)}${pad(route.layer, 9)}${route.signals.join(', ') || '—'}${mark}`);
}

console.log('');
console.log('── توزیع سیگنال‌ها (روی مسیرهای نوشتن) ──');
for (const signal of SIGNALS) {
  const count = writes.filter((route) => route.signals.includes(signal.id)).length;
  console.log(`  ${pad(signal.label, 24)} ${count}`);
}

if (risky.length) {
  console.log('');
  console.log('── نیازمند بازبینی ──');
  for (const route of risky) console.log(`  ${route.method} ${route.pattern}  (مجوز: ${route.permission ?? '—'})`);
}

mkdirSync(resolve(ROOT, '.workbuddy-ai/audits'), { recursive: true });
const out = resolve(ROOT, '.workbuddy-ai/audits/api-input-audit.json');
writeFileSync(out, `${JSON.stringify({ generatedAt: new Date().toISOString(), total: report.length, routes: report }, null, 2)}\n`, 'utf8');
console.log('');
console.log(`  JSON: .workbuddy-ai/audits/api-input-audit.json`);
console.log('');
