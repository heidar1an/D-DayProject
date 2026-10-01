/*
 * صف نوشتن و قفل فایل — فاز ۳ (بازنگری واقعی Race Condition).
 *
 * ⚠️ مسئله‌ای که این ماژول حل می‌کند و مسئله‌ای که حل نمی‌کند:
 *
 *   • `tmp → rename` فقط **اتمی بودن فایل** را تأمین می‌کند: خواننده هرگز
 *     نسخهٔ نیم‌نوشته نمی‌بیند. این با lost update فرق دارد.
 *   • lost update وقتی رخ می‌دهد که دو نویسنده `read → modify → write` را
 *     **درهم‌بافته** اجرا کنند: هر دو یک نسخه را می‌خوانند، هر دو می‌نویسند و
 *     تغییر یکی بی‌صدا پاک می‌شود.
 *
 * وضعیت واقعی این پروژه (سنجیده‌شده، نه فرض‌شده):
 *   • همهٔ تغییرهای JSON در `contentStore` **همگام**‌اند و هیچ `await`ی بین
 *     خواندن و نوشتن نیست ⇒ داخل **یک پروسه** درهم‌بافتگی ممکن نیست.
 *   • ولی چند **پروسه** روی یک دیسک (pm2 cluster، دو کانتینر، یک ابزار
 *     نگهداری که کنار سرور اجرا می‌شود) می‌توانند هم‌زمان بنویسند ⇒ آن‌جا
 *     lost update **واقعاً ممکن است**.
 *
 * پس سه سازوکار، هر سه بدون وابستگی بیرونی:
 *   ۱. `withFileLock` — صف FIFO درون-پروسه برای توالی‌های async.
 *   ۲. `withAdvisoryLock` — قفل بین‌پروسه‌ای با ساخت **دایرکتوری خالی** (اتمیک
 *      روی POSIX) و تشخیص قفل کهنه. دایرکتوری خالی عمداً: آزادسازی‌اش یک
 *      `rmdir` تنهاست، نه حذف بازگشتی — روی فایل‌سیستم‌های سندباکس‌شده که حذف
 *      انبوه را رد می‌کنند هم قابل‌اعتماد می‌ماند.
 *   ۳. `mutateJsonFile` — `read → modify → write` اتمیک داخل هر دو قفل، با
 *      بررسی نسخهٔ فایل (mtime+size) برای تشخیص نوشتن بیرونی.
 *
 * مسیر مهاجرت مستند: همان امضا برای Redis/DB قابل نگاشت است؛ تنها
 * `withAdvisoryLock` و `mutateJsonFile` باید عوض شوند، نه فراخوان‌ها.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/* ───────────────────── صف درون-پروسه (FIFO) ───────────────────── */

/** @type {Map<string, Promise<unknown>>} */
const chains = new Map();
const stats = { queued: 0, completed: 0, advisoryAcquired: 0, advisoryTimeout: 0, staleLocksBroken: 0 };

/**
 * اجرای `fn` به‌صورت انحصاری برای یک فایل، در **همین پروسه**.
 * FIFO است: ترتیب درخواست‌ها حفظ می‌شود.
 */
export function withFileLock(file, fn) {
  const key = resolve(file);
  const previous = chains.get(key) ?? Promise.resolve();
  stats.queued += 1;

  const run = previous.then(
    () => fn(),
    () => fn(),
  );

  /* زنجیره هرگز reject نمی‌شود؛ وگرنه یک خطا، صف را برای همیشه می‌بندد. */
  const guarded = run.then(
    (value) => {
      stats.completed += 1;
      return value;
    },
    (error) => {
      stats.completed += 1;
      throw error;
    },
  );

  chains.set(
    key,
    guarded.then(
      () => undefined,
      () => undefined,
    ),
  );

  return guarded;
}

/* ───────────────────── قفل بین-پروسه‌ای ───────────────────── */

const LOCK_STALE_MS = 8_000;
const DEFAULT_TIMEOUT_MS = 20_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lockDirFor(file) {
  return `${resolve(file)}.lock`;
}

/** تشخیص «قفل موجود است» — هم کد خطا و هم متن (شیم‌های fs پیام را بازنویسی می‌کنند). */
function isLockExistsError(error) {
  if (!error) return false;
  if (error.code === 'EEXIST') return true;
  return /EEXIST|already exists/i.test(String(error.message ?? ''));
}

/** آزادسازی قفل: یک `rmdir` خالی، با پشتیبان «بهترین‌تلاش». */
function releaseLock(lockDir) {
  try {
    rmdirSync(lockDir);
    return;
  } catch {
    /* شاید چیزی داخلش مانده یا rmdir پشتیبانی نشد */
  }
  try {
    rmSync(lockDir, { recursive: true, force: true });
  } catch {
    /* قفل کهنه، خودش در نوبت بعد پاک می‌شود */
  }
}

function tryBreakStaleLock(lockDir) {
  try {
    const age = Date.now() - statSync(lockDir).mtimeMs;
    if (age > LOCK_STALE_MS) {
      releaseLock(lockDir);
      stats.staleLocksBroken += 1;
      return true;
    }
  } catch {
    /* قفل همین لحظه آزاد شد */
  }
  return false;
}

/**
 * قفل انحصاری بین‌پروسه‌ای روی یک فایل JSON.
 * در صورت نرسیدن به قفل، خطایی با ویژگی `code` برابر `LOCK_TIMEOUT` پرتاب
 * می‌شود — کد داخلی انبار، نه کد خطای API.
 */
export async function withAdvisoryLock(file, fn, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const lockDir = lockDirFor(file);
  const started = Date.now();
  let held = false;

  while (!held) {
    try {
      mkdirSync(lockDir);
      held = true;
      stats.advisoryAcquired += 1;
    } catch (error) {
      if (!isLockExistsError(error)) throw error;
      if (tryBreakStaleLock(lockDir)) continue;
      if (Date.now() - started > timeoutMs) {
        stats.advisoryTimeout += 1;
        const timeout = new Error(`قفل فایل در ${timeoutMs}ms آزاد نشد: ${file}`);
        timeout.code = 'LOCK_TIMEOUT';
        throw timeout;
      }
      await sleep(10 + Math.floor(Math.random() * 15));
    }
  }

  try {
    return await fn();
  } finally {
    releaseLock(lockDir);
  }
}

/* ───────────────────── نوشتن با بررسی نسخه ───────────────────── */

/** اثر انگشت فایل: `mtimeMs:size` — برای تشخیص نوشتن بیرونی. */
export function fileRevision(file) {
  try {
    const stat = statSync(file);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return 'absent';
  }
}

function writeAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  renameSync(tmp, file);
}

/**
 * `read → modify → write` اتمیک روی یک فایل JSON.
 *
 * @param {string} file مسیر فایل
 * @param {(current: any, context: {revision: string, file: string}) => any} mutator
 *        مقدار بازگشتی همان چیزی است که نوشته می‌شود. اگر `undefined` برگرداند،
 *        نوشتن انجام نمی‌شود (mutator فقط-خواندن).
 * @param {{fallback?: any, timeoutMs?: number, crossProcess?: boolean}} options
 */
export async function mutateJsonFile(file, mutator, { fallback = [], timeoutMs = DEFAULT_TIMEOUT_MS, crossProcess = true } = {}) {
  const target = resolve(file);

  return withFileLock(target, async () => {
    const run = async () => {
      const revision = fileRevision(target);
      let current = fallback;
      if (existsSync(target)) current = JSON.parse(readFileSync(target, 'utf8'));

      const next = await mutator(current, { revision, file: target });
      if (next === undefined) return current;

      /*
       * بررسی نسخه: اگر فایل بین خواندن و نوشتن **بیرون از این قفل** عوض شده
       * باشد، نوشتن ما تغییر آن را بی‌صدا پاک می‌کند. در آن حالت شکست می‌دهیم
       * (fail-closed) نه اینکه overwrite کنیم.
       */
      const now = fileRevision(target);
      if (now !== revision) {
        const error = new Error(`فایل بین خواندن و نوشتن تغییر کرد (lost update): ${target}`);
        error.code = 'LOST_UPDATE_DETECTED';
        throw error;
      }

      writeAtomic(target, next);
      return next;
    };

    return crossProcess ? withAdvisoryLock(target, run, { timeoutMs }) : run();
  });
}

/** آمار — برای پایش و تست. */
export function writeQueueStats() {
  return { ...stats, trackedFiles: chains.size };
}

/** فقط برای تست: صفر کردن شمارنده‌ها. */
export function resetWriteQueueStats() {
  for (const key of Object.keys(stats)) stats[key] = 0;
}
