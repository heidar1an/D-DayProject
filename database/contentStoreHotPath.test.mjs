/*
 * تست مسیر داغ انبار محتوا (فاز ۱۴ پیشنهادی — بند ۳ و ۵).
 *
 * مسئلهٔ اثبات‌شده و اندازه‌گیری‌شده: `ensureStore()` روی **هر** `readCollection` /
 * `writeCollection` / `readSettings` اجرا می‌شود و seedها را به‌صورت آرگومانِ
 * ارزیابی‌شده پاس می‌داد:
 *
 *     ensureFile(files.admins, seedAdmins());   // ← همیشه اجرا می‌شد
 *
 * یعنی `hashPassword` ⇒ `scryptSync` (~۴۰ms، اندازه‌گیری‌شده روی همین مک) و ساخت
 * همهٔ seedهای بزرگ، در هر خواندنِ سادهٔ محتوا تکرار می‌شد و نتیجه‌اش **دور ریخته
 * می‌شد** (چون فایل از قبل موجود بود و `ensureFile` هیچ کاری نمی‌کرد).
 *
 * سنجهٔ «سربارهٔ خواندن» = زمان `readCollection` منهای هزینهٔ خام
 * `readFileSync + JSON.parse` همان فایل. سرباره هزینهٔ **منطق برنامه** است و به
 * سرعت سیستم فایل وابسته نیست (برخلاف عدد خام، که در محیط‌های سندباکس‌شده
 * باد می‌کند).
 *
 * این فایل سه چیز را قفل می‌کند:
 *   ۱) ساختاری: هیچ فراخوانی seed به‌صورت eager باقی نمانده باشد.
 *   ۲) رفتاری: سربارهٔ مسیر داغ زیر سقف باشد (پیش از اصلاح ~۴۱ms بود).
 *   ۳) رفتاری: وقتی فایل **واقعاً غایب** است، مسیر thunk همان seed را می‌سازد
 *      (اصلاح نباید مسیر ساخت اولیه را بشکند).
 *
 * اجرا: `node --test database/contentStoreHotPath.test.mjs`
 */

import { strict as assert } from 'node:assert';
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SOURCE_FILE = resolve(HERE, 'contentStore.js');
const BANNERS_FILE = resolve(HERE, 'content', 'banners.json');

/* سقف سرباره: مسیر داغ باید ~۰٫۵ms باشد؛ ۲۰ms هم ۲ برابر زیر رگرسیون ~۴۱ms است
   و هم روی ماشین کند ۴۰ برابر حاشیه دارد. */
const OVERHEAD_CEILING_MS = 20;
const RUNS = 9;

const store = await import('./contentStore.js');

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/* ── ۱) اثبات ساختاری ────────────────────────────────────────────────────── */

const source = readFileSync(SOURCE_FILE, 'utf8');
const ensureStoreBody = source.match(/function ensureStore\(\) \{[\s\S]*?\n\}/)?.[0] ?? '';
const ensureFileBody = source.match(/function ensureFile\(path, fallback\) \{[\s\S]*?\n\}/)?.[0] ?? '';

test('ساختاری: بدنهٔ `ensureStore` و `ensureFile` استخراج شد', () => {
  assert.ok(ensureStoreBody.length > 0, 'ensureStore پیدا نشد');
  assert.ok(ensureFileBody.length > 0, 'ensureFile پیدا نشد');
});

test('ساختاری: هیچ seedی به‌صورت eager پاس داده نمی‌شود', () => {
  /* الگوی ممنوع: `ensureFile(files.x, seedY())` یا `ensureFile(files.x, NAME.map(...))` */
  const eager = [...ensureStoreBody.matchAll(/ensureFile\(files\.\w+,\s*([^\n]+)\)/g)]
    .map((match) => match[1].trim())
    .filter((arg) => !arg.startsWith('() =>') && (arg.includes('()') || arg.includes('.map(')));
  assert.deepEqual(eager, [], `این seedها eager ارزیابی می‌شوند: ${eager.join(' | ')}`);
});

test('ساختاری: `ensureFile` از thunk پشتیبانی می‌کند و مسیر داغ زودتر برمی‌گردد', () => {
  assert.match(ensureFileBody, /typeof fallback === 'function'/, 'پشتیبانی thunk حذف شده');
  const guardIndex = ensureFileBody.indexOf('existsSync(path)');
  const buildIndex = ensureFileBody.indexOf('fallback()');
  assert.ok(guardIndex >= 0 && buildIndex > guardIndex, 'ساخت seed باید بعد از گارد وجود فایل باشد');
});

/* ── ۲) اثبات رفتاری: سربارهٔ مسیر داغ ───────────────────────────────────── */

test('رفتاری: سربارهٔ `readCollection` زیر سقف است (بدون ساخت seed در هر خواندن)', () => {
  store.readCollection('banners'); /* گرم‌کردن */

  const overheads = [];
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = performance.now();
    store.readCollection('banners');
    const withStore = performance.now() - t0;

    const t1 = performance.now();
    JSON.parse(readFileSync(BANNERS_FILE, 'utf8'));
    const raw = performance.now() - t1;

    overheads.push(withStore - raw);
  }

  const overhead = median(overheads);
  assert.ok(
    overhead < OVERHEAD_CEILING_MS,
    `سربارهٔ خواندن ${overhead.toFixed(2)}ms است (سقف ${OVERHEAD_CEILING_MS}ms) — احتمالاً seedها دوباره eager شده‌اند`,
  );
});

test('رفتاری: سربارهٔ `readSettings` هم زیر سقف است', () => {
  store.readSettings();
  const overheads = [];
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = performance.now();
    store.readSettings();
    const withStore = performance.now() - t0;
    const t1 = performance.now();
    JSON.parse(readFileSync(resolve(HERE, 'content', 'settings.json'), 'utf8'));
    overheads.push(withStore - (performance.now() - t1));
  }
  assert.ok(median(overheads) < OVERHEAD_CEILING_MS, `سربارهٔ readSettings: ${median(overheads).toFixed(2)}ms`);
});

/* ── ۳) مسیر ساخت اولیه باید سالم بماند ─────────────────────────────────── */

test('رفتاری: وقتی فایل غایب است، thunk همان seed را می‌سازد', () => {
  const original = readFileSync(BANNERS_FILE);
  const safety = join(tmpdir(), `tapesh-banners-safety-${process.pid}.json`);
  copyFileSync(BANNERS_FILE, safety);
  const parked = `${BANNERS_FILE}.parked`;

  try {
    renameSync(BANNERS_FILE, parked);
    assert.equal(existsSync(BANNERS_FILE), false);

    const recreated = store.readCollection('banners');
    assert.ok(existsSync(BANNERS_FILE), 'فایل غایب بازساخته نشد');
    assert.ok(Array.isArray(recreated), 'محتوای بازساخته آرایه نیست');
    assert.ok(recreated.length > 0, 'seed خالی ساخته شد');
  } finally {
    writeFileSync(BANNERS_FILE, original);
    if (existsSync(parked)) {
      /* فایل پارک‌شده نسخهٔ اصلی است؛ فقط پاکش می‌کنیم */
      renameSync(parked, join(tmpdir(), `tapesh-banners-parked-${process.pid}.json`));
    }
  }
});
