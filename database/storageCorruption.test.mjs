/*
 * تست «خرابی فایل داده» در انبار محتوا (فاز ۱۶ پیشنهادی — بندهای ۵ و ۶).
 *
 * مسئلهٔ اثبات‌شده: `readJson` هر خطایی را می‌بلعید و `fallback` (یعنی `[]`)
 * برمی‌گرداند. پیامدش یک مسیر **از دست‌رفتن خاموش داده** بود: یک فایل JSON
 * خراب به‌صورت «مجموعهٔ خالی» خوانده می‌شد و اولین نوشتن، `[]` را روی فایل
 * خراب می‌نشست — خرابی موقت تبدیل به نابودی دائمی می‌شد، بدون هیچ خطایی.
 *
 * این فایل سه چیز را اثبات می‌کند:
 *   ۱) ساختاری: گارد `assertNotCorrupt` در ابتدای `writeJsonAtomic` هست.
 *   ۲) رفتاری: خواندن فایل خراب **بلند** اعلام می‌شود و در `storageCorruptionReport`
 *      دیده می‌شود (دیگر خاموش نیست).
 *   ۳) امنیت داده: نوشتن روی فایل خراب پرتاب می‌کند (`STORAGE_CORRUPT`) و
 *      بایت‌های فایل خراب دست‌نخورده می‌مانند؛ پس دادهٔ جدید روی دادهٔ خراب
 *      بازنویسی نمی‌شود.
 *
 * هر تستی که روی دادهٔ واقعی می‌نویسد، در `finally` بایت‌های اصلی را برمی‌گرداند.
 * اجرا: `node --test database/storageCorruption.test.mjs`
 */

import { strict as assert } from 'node:assert';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(HERE, 'contentStore.js');
const BANNERS_FILE = resolve(HERE, 'content', 'banners.json');

const store = await import('./contentStore.js');

const PROBE = [{ id: 'banner-probe-corrupt', title: 'probe', active: false }];

/* ── ۱) ساختاری ─────────────────────────────────────────────────────────── */

const source = readFileSync(SOURCE_FILE, 'utf8');
const atomicBody = source.match(/function writeJsonAtomic\(file, value\) \{[\s\S]*?\n\}/)?.[0] ?? '';
const readBody = source.match(/function readJson\(path, fallback\) \{[\s\S]*?\n\}/)?.[0] ?? '';

test('ساختاری: نوشتن پیش از هر کاری خرابی فایل را می‌سنجد', () => {
  assert.match(atomicBody, /assertNotCorrupt\(file\)/, 'گارد خرابی از ابتدای writeJsonAtomic حذف شده');
  assert.ok(
    atomicBody.indexOf('assertNotCorrupt(file)') < atomicBody.indexOf('writeFileSync(tmp,'),
    'گارد باید پیش از نوشتن فایل موقت اجرا شود',
  );
});

test('ساختاری: خواندن دیگر خطای JSON را بی‌صدا نمی‌بلعد', () => {
  assert.doesNotMatch(readBody, /catch\s*\{[\s\S]*?return fallback;[\s\S]*?\}/, 'الگوی بلعیدن خطا برگشته است');
  assert.match(readBody, /noteCorruption\(/, 'اعلام خرابی از مسیر خواندن حذف شده');
  assert.match(source, /STORAGE_CORRUPT/, 'کد خطای STORAGE_CORRUPT تعریف نشده');
  assert.match(source, /export function storageCorruptionReport\(\)/, 'گزارش خرابی export نشده');
});

/* ── ۲) رفتاری: اعلام بلند ──────────────────────────────────────────────── */

test('رفتاری: خواندن فایل خراب، خطا را اعلام می‌کند و در گزارش دیده می‌شود', () => {
  const original = readFileSync(BANNERS_FILE);
  const captured = [];
  const originalError = console.error;
  console.error = (...args) => captured.push(args.join(' '));

  try {
    writeFileSync(BANNERS_FILE, '{"broken": ', 'utf8');

    const value = store.readCollection('banners');
    assert.deepEqual(value, [], 'در حالت پیش‌فرض باید degraded (خالی) بماند، نه پرتاب');

    const report = store.storageCorruptionReport();
    assert.ok(report.corrupt >= 1, 'خرابی در گزارش ثبت نشد');
    assert.ok(report.files.includes(BANNERS_FILE), 'مسیر فایل خراب در گزارش نیست');
    assert.ok(captured.some((line) => line.includes('[contentStore]')), 'هیچ هشداری لاگ نشد (خرابی خاموش است)');
  } finally {
    console.error = originalError;
    writeFileSync(BANNERS_FILE, original);
    rmSync(`${BANNERS_FILE}.tmp`, { recursive: true, force: true });
  }
});

/* ── ۳) امنیت داده: خرابی موقت دائمی نمی‌شود ────────────────────────────── */

test('امنیت داده: نوشتن روی فایل خراب پرتاب می‌کند و بایت‌های خراب دست‌نخورده می‌مانند', () => {
  const original = readFileSync(BANNERS_FILE);
  const corruptBytes = '{"broken": ';
  const originalError = console.error;
  console.error = () => {};

  try {
    writeFileSync(BANNERS_FILE, corruptBytes, 'utf8');

    assert.throws(
      () => store.writeCollection('banners', PROBE),
      (error) => error?.code === 'STORAGE_CORRUPT',
      'نوشتن روی فایل خراب باید با STORAGE_CORRUPT رد شود',
    );

    assert.equal(readFileSync(BANNERS_FILE, 'utf8'), corruptBytes, 'فایل خراب بازنویسی شد (دادهٔ جدید روی خرابی نشست)');
    assert.equal(store.readCollection('banners').length, 0, 'خواندن باید خالی بماند تا تعمیر دستی');
  } finally {
    console.error = originalError;
    writeFileSync(BANNERS_FILE, original);
    rmSync(`${BANNERS_FILE}.tmp`, { recursive: true, force: true });
  }
});

test('امنیت داده: پس از تعمیر دستی فایل، نوشتن دوباره کار می‌کند', () => {
  const original = readFileSync(BANNERS_FILE);
  const originalError = console.error;
  console.error = () => {};

  try {
    writeFileSync(BANNERS_FILE, '{"broken": ', 'utf8');
    assert.throws(() => store.writeCollection('banners', PROBE), (error) => error?.code === 'STORAGE_CORRUPT');

    /* تعمیر دستی: فایل با JSON معتبر جایگزین می‌شود */
    writeFileSync(BANNERS_FILE, '[]', 'utf8');
    store.writeCollection('banners', PROBE);
    assert.equal(store.readCollection('banners')[0]?.id, 'banner-probe-corrupt');
  } finally {
    console.error = originalError;
    writeFileSync(BANNERS_FILE, original);
    rmSync(`${BANNERS_FILE}.tmp`, { recursive: true, force: true });
  }
});

test('حالت throw: با TAPESH_STORAGE_CORRUPT_MODE=throw خواندن fail-closed می‌شود', () => {
  const original = readFileSync(BANNERS_FILE);
  const originalError = console.error;
  console.error = () => {};

  try {
    writeFileSync(BANNERS_FILE, 'not json at all', 'utf8');
    process.env.TAPESH_STORAGE_CORRUPT_MODE = 'throw';

    assert.throws(
      () => store.readCollection('banners'),
      (error) => error?.code === 'STORAGE_CORRUPT',
      'در حالت throw باید خواندن پرتاب کند',
    );
  } finally {
    delete process.env.TAPESH_STORAGE_CORRUPT_MODE;
    console.error = originalError;
    writeFileSync(BANNERS_FILE, original);
    rmSync(`${BANNERS_FILE}.tmp`, { recursive: true, force: true });
  }
});
