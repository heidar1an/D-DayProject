/*
 * تست نوشتن اتمیک انبار محتوا (فاز ۱۱ پیشنهادی — بند ۶).
 *
 * مسئلهٔ اثبات‌شده: `contentStore.writeJson` — تنها دروازهٔ نوشتن روی دیسک برای
 * ۳۳ مجموعهٔ محتوا + `settings` — فایل را **در جای خود** بازنویسی می‌کرد
 * (`writeFileSync(path, …)`)، در حالی که چهار انبار دیگر پروژه
 * (`usersStore` · `examStore` · `userSessions` · `feedbackStore`) از قبل
 * `tmp → rename` دارند. نتیجهٔ آن باگ: مرگ پروسه یا پر شدن دیسک وسط نوشتن
 * ⇒ فایل JSON نیم‌نوشته/بریده روی دیسک می‌ماند و `readJson` بی‌صدا به fallback
 * برمی‌گردد (از دست رفتن داده، بدون هیچ خطایی).
 *
 * این فایل سه چیز را اثبات می‌کند:
 *   ۱) ساختاری: مسیر نوشتن واقعاً `tmp → rename` است و `writeJson` خودش
 *      دیگر `writeFileSync` روی مسیر مقصد صدا نمی‌زند.
 *   ۲) رفتاری: قالب خروجی و مجوز فایل عوض نشده؛ فایل با `rename` جایگزین
 *      می‌شود (inode عوض می‌شود) نه بازنویسی درجا؛ هیچ `*.tmp` باقی نمی‌ماند.
 *   ۳) تزریق خطا: وقتی نوشتن شکست می‌خورد، نسخهٔ سالم قبلی **بیت‌به‌بیت**
 *      دست‌نخورده می‌ماند (این همان چیزی است که در حالت درجا برقرار نبود).
 *
 * هر تستی که روی دادهٔ واقعی می‌نویسد، در `finally` بایت‌های اصلی را برمی‌گرداند.
 * اجرا: `node --test database/contentStoreAtomicWrite.test.mjs`
 */

import { strict as assert } from 'node:assert';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(HERE, 'contentStore.js');
const CONTENT_DIR = resolve(HERE, 'content');
const BANNERS_FILE = resolve(CONTENT_DIR, 'banners.json');
const BANNERS_TMP = `${BANNERS_FILE}.tmp`;
const SETTINGS_FILE = resolve(CONTENT_DIR, 'settings.json');
const SETTINGS_TMP = `${SETTINGS_FILE}.tmp`;

const store = await import('./contentStore.js');

const PROBE = [{ id: 'banner-probe-atomic', title: 'probe', active: false }];
const SENTINEL = [{ id: 'banner-sentinel', title: 'sentinel', active: true }];

/* ── ۱) اثبات ساختاری: مسیر نوشتن `tmp → rename` است ─────────────────────── */

const source = readFileSync(SOURCE_FILE, 'utf8');
const atomicBody = source.match(/function writeJsonAtomic\(file, value\) \{[\s\S]*?\n\}/)?.[0] ?? '';
const writeBody = source.match(/function writeJson\(path, value\) \{[\s\S]*?\n\}/)?.[0] ?? '';

test('ساختاری: تابع نوشتن اتمیک وجود دارد و بدنه‌اش خوانده شد', () => {
  assert.ok(atomicBody.length > 0, 'writeJsonAtomic پیدا نشد');
  assert.ok(writeBody.length > 0, 'writeJson پیدا نشد');
});

test('ساختاری: `writeJsonAtomic` روی فایل موقت می‌نویسد و با `rename` جایگزین می‌کند', () => {
  assert.match(atomicBody, /const tmp = `\$\{file\}\.tmp`/, 'نام فایل موقت عوض شده');
  assert.match(atomicBody, /writeFileSync\(tmp,/, 'نوشتن باید روی فایل موقت باشد نه مقصد');
  assert.match(atomicBody, /renameSync\(tmp, file\)/, 'جایگزینی اتمیک با rename حذف شده');
});

test('ساختاری: `writeJson` دیگر مستقیم روی مسیر مقصد نمی‌نویسد', () => {
  assert.match(writeBody, /writeJsonAtomic\(path, value\)/, 'writeJson باید از مسیر اتمیک رد شود');
  assert.doesNotMatch(writeBody, /writeFileSync\(/, 'نوشتن درجای مقصد باید حذف شده باشد');
  assert.match(writeBody, /observeWrite\(/, 'ناظر مسیر نوشتن باید سر جایش بماند');
});

test('ساختاری: سایر انبارهای پروژه همان الگو را دارند (هم‌خوانی، نه استثنا)', () => {
  for (const file of ['usersStore.js', 'examStore.js', 'userSessions.js', 'feedbackStore.js']) {
    const text = readFileSync(resolve(HERE, file), 'utf8');
    assert.match(text, /renameSync\(tmp,/, `${file} باید نوشتن اتمیک داشته باشد`);
  }
});

/* ── ۲) رفتاری: قالب، مجوز، inode و پاکیزگی ─────────────────────────────── */

test('رفتاری: نوشتن مجموعه — قالب بیت‌به‌بیت، inode تازه، بدون `*.tmp` باقی‌مانده', () => {
  const original = readFileSync(BANNERS_FILE);
  try {
    const before = statSync(BANNERS_FILE);
    store.writeCollection('banners', PROBE);

    const raw = readFileSync(BANNERS_FILE, 'utf8');
    assert.equal(raw, JSON.stringify(PROBE, null, 2), 'قالب خروجی JSON عوض شده');
    assert.equal(store.readCollection('banners').length, PROBE.length, 'رفت‌وبرگشت خواندن/نوشتن شکست');

    const after = statSync(BANNERS_FILE);
    /* `tmp` پیش از حذف مقصد ساخته می‌شود، پس inode مقصد نمی‌تواند بازاستفاده شود
       ⇒ تغییر inode مدرک قطعی «جایگزینی با rename» است، نه بازنویسی درجا. */
    assert.notEqual(after.ino, before.ino, 'فایل درجا بازنویسی شده (rename انجام نشده)');
    assert.equal(after.mode & 0o777, 0o644, 'مجوز فایل محتوا عوض شده');
    assert.equal(existsSync(BANNERS_TMP), false, 'فایل موقت باقی مانده است');
  } finally {
    writeFileSync(BANNERS_FILE, original);
    rmSync(BANNERS_TMP, { recursive: true, force: true });
  }
});

test('رفتاری: نوشتن تنظیمات هم از همان مسیر اتمیک رد می‌شود', () => {
  const original = readFileSync(SETTINGS_FILE);
  try {
    const before = statSync(SETTINGS_FILE);
    const next = store.writeSettings({});
    assert.equal(readFileSync(SETTINGS_FILE, 'utf8'), JSON.stringify(next, null, 2));
    assert.notEqual(statSync(SETTINGS_FILE).ino, before.ino, 'settings.json درجا بازنویسی شده');
    assert.equal(existsSync(SETTINGS_TMP), false, 'فایل موقت settings باقی مانده است');
  } finally {
    writeFileSync(SETTINGS_FILE, original);
    rmSync(SETTINGS_TMP, { recursive: true, force: true });
  }
});

/* ── ۳) تزریق خطا: شکست نوشتن نباید داده را خراب کند ────────────────────── */

test('تزریق خطا: شکست وسط نوشتن — نسخهٔ سالم قبلی بیت‌به‌بیت دست‌نخورده می‌ماند', () => {
  const original = readFileSync(BANNERS_FILE);
  try {
    store.writeCollection('banners', SENTINEL);
    const safe = readFileSync(BANNERS_FILE, 'utf8');
    assert.equal(safe, JSON.stringify(SENTINEL, null, 2));

    /* شبیه‌سازی شکست فیزیکی نوشتن: مسیر فایل موقت را با یک دایرکتوری اشغال
       می‌کنیم ⇒ `writeFileSync(tmp)` با EISDIR شکست می‌خورد، درست همان‌جایی که
       در حالت درجا، خودِ فایل مقصد نصفه بازنویسی می‌شد. */
    mkdirSync(BANNERS_TMP, { recursive: true });
    assert.throws(() => store.writeCollection('banners', PROBE), /EISDIR|illegal operation|directory/i);

    assert.equal(readFileSync(BANNERS_FILE, 'utf8'), safe, 'شکست نوشتن، داده را خراب کرد');
    assert.equal(store.readCollection('banners')[0]?.id, 'banner-sentinel', 'خواننده نسخهٔ نیم‌نوشته دید');
  } finally {
    rmSync(BANNERS_TMP, { recursive: true, force: true });
    writeFileSync(BANNERS_FILE, original);
  }
});

test('تزریق خطا: پس از شکست، فایل موقت باقی‌مانده مسیر نوشتن بعدی را نمی‌بندد', () => {
  const original = readFileSync(BANNERS_FILE);
  try {
    store.writeCollection('banners', SENTINEL);
    assert.equal(existsSync(BANNERS_TMP), false);

    store.writeCollection('banners', PROBE);
    assert.equal(readFileSync(BANNERS_FILE, 'utf8'), JSON.stringify(PROBE, null, 2));
    assert.equal(existsSync(BANNERS_TMP), false);
  } finally {
    writeFileSync(BANNERS_FILE, original);
    rmSync(BANNERS_TMP, { recursive: true, force: true });
  }
});

/* ── ۴) امنیت داده: محتوای غیر-JSON نباید باعث نوشتن شود ────────────────── */

test('امنیت داده: مقدار غیرقابل‌سریال‌سازی، فایل را دست نمی‌زند', () => {
  const original = readFileSync(BANNERS_FILE);
  try {
    store.writeCollection('banners', SENTINEL);
    const safe = readFileSync(BANNERS_FILE, 'utf8');

    const circular = [];
    circular.push(circular);
    assert.throws(() => store.writeCollection('banners', circular));

    assert.equal(readFileSync(BANNERS_FILE, 'utf8'), safe, 'شکست سریال‌سازی داده را خراب کرد');
  } finally {
    writeFileSync(BANNERS_FILE, original);
    rmSync(BANNERS_TMP, { recursive: true, force: true });
  }
});
