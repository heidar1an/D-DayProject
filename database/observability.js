/*
 * مشاهده‌پذیری درخواست — لاگ دسترسی، متریک درون-حافظه و سلامت/آمادگی.
 *
 * چرا این فایل وجود دارد (شکاف ممیزی، MASTER-AUDIT-2026-09-29.md:413, :1920-1923):
 *   • درخواست‌های خواندن (GET) هیچ‌جا لاگ نمی‌شدند؛ فقط خطاها به stderr می‌رفتند.
 *   • متریک درخواست در حافظه بود و هیچ راه خواندنی نداشت.
 *   • health/readiness وجود نداشت، پس «بالا بودن» سرور از «آماده بودن» تفکیک نمی‌شد.
 *
 * قواعد محرمانگی که این ماژول **عمداً** رعایت می‌کند:
 *   • query string هرگز لاگ نمی‌شود. مسیر ورود/ثبت‌نام و بازیابی رمز، شمارهٔ تلفن
 *     و توکن را در query می‌برد؛ همان رشته است که نباید روی دیسک بیفتد.
 *   • IP، User-Agent، Cookie، هدرها و بدنهٔ درخواست لاگ نمی‌شوند (PII).
 *   • قطعه‌های مسیر که شکل شمارهٔ تلفن، ایمیل یا توکن بلند دارند پیش از لاگ
 *     حذف می‌شوند. جهت خطا **بیش‌حذفی** است، نه کم‌حذفی.
 *   • `/metrics` بدون توکن محیطی وجود ندارد (۴۰۴، نه ۴۰۳) تا مسیر لو نرود.
 *
 * این فایل خالص و بدون وابستگی بیرونی است تا هم سرور و هم تست همان را مصرف کنند.
 */

import { accessSync, appendFileSync, constants, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';

import { MODELS } from './models/index.js';

export const REDACTED = '[redacted]';

/* سقف طول مسیر لاگ‌شده — جلوی پر شدن لاگ با مسیر جعلی بلند را می‌گیرد */
const MAX_PATH_CHARS = 200;

const EMAIL_PATTERN = /[^\s/@]+@[^\s/@]+\.[^\s/@]+/g;
/* حداقل ۸ رقم پشت‌سرهم = شکل شمارهٔ تلفن؛ شمارهٔ رکوردهای داخلی کوتاه‌تر است */
const PHONE_PATTERN = /(?:^|\/)\+?\d[\d\-\s]{6,}\d(?=\/|$)/g;
/* توکن/کلید بلند در مسیر (۳۲ نویسهٔ base64url به بالا) */
const LONG_TOKEN_PATTERN = /(?:^|\/)[A-Za-z0-9_-]{32,}(?=\/|$)/g;

const STATUS_CLASSES = ['1xx', '2xx', '3xx', '4xx', '5xx'];

function statusClassOf(status) {
  const value = Number(status);
  const label = `${Math.floor(value / 100)}xx`;
  return STATUS_CLASSES.includes(label) ? label : 'other';
}

/*
 * مسیر امن برای لاگ. ورودی «pathname» است، نه URL کامل — و همین یکی از
 * تضمین‌های اصلی است: query هرگز وارد این تابع نمی‌شود.
 */
export function safePathname(pathname) {
  const raw = String(pathname ?? '/');
  const withoutQuery = raw.split('?')[0].split('#')[0];

  const redacted = withoutQuery
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(PHONE_PATTERN, (match) => (match.startsWith('/') ? `/${REDACTED}` : REDACTED))
    .replace(LONG_TOKEN_PATTERN, (match) => (match.startsWith('/') ? `/${REDACTED}` : REDACTED));

  return redacted.slice(0, MAX_PATH_CHARS);
}

/* ───────────────────────────── لاگ دسترسی ───────────────────────────── */

/*
 * یک خط JSON در هر درخواست. فیلدها عمداً کم‌اند: هر چیزی که اینجا نیست،
 * روی دیسک هم نمی‌افتد.
 */
export function accessLogLine(entry = {}) {
  const line = {
    kind: 'http',
    t: new Date(entry.time ?? Date.now()).toISOString(),
    reqId: String(entry.requestId ?? ''),
    method: String(entry.method ?? 'GET').toUpperCase(),
    path: safePathname(entry.path),
    status: Number(entry.status) || 0,
    ms: Math.max(0, Math.round(Number(entry.durationMs) || 0)),
  };

  if (entry.errorCode) line.errorCode = String(entry.errorCode);

  return JSON.stringify(line);
}

export function accessLogEnabled(env = process.env) {
  const value = String(env.TAPESH_ACCESS_LOG ?? '1').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(value);
}

/* ──────────────────────── لاگ پایدار + چرخش ──────────────────────── */

/*
 * چرا: پیش از این لاگ دسترسی فقط به `stdout` می‌رفت. با ری‌استارت کانتینر،
 * چرخش بیرونی که پیکربندی نشده باشد، یا بافر systemd، **شاهد حادثه** از دست
 * می‌رفت و «مدرک پایدار» وجود نداشت.
 *
 * قرارداد:
 *   • خاموش به‌صورت پیش‌فرض — تا `TAPESH_LOG_FILE` تنظیم نشود، هیچ نوشتن دیسکی
 *     اضافه نمی‌شود و رفتار فعلی دست‌نخورده می‌ماند.
 *   • `TAPESH_LOG_MAX_BYTES` (پیش‌فرض ۱۰ مگابایت) و `TAPESH_LOG_KEEP`
 *     (پیش‌فرض ۵ نسخه) سقف حجم و تعداد نسخه‌های چرخش‌خورده را می‌دهند.
 *   • خطی که نوشته می‌شود **همان** خطی است که `accessLogLine` ساخته؛ پس همان
 *     قواعد حذف PII (بدون query، بدون IP/UA، بدون بدنه) روی دیسک هم برقرار است.
 *   • خطای نوشتن هرگز درخواست را نمی‌شکند: `false` برمی‌گردد.
 */
export function logFileTarget(env = process.env) {
  const file = String(env.TAPESH_LOG_FILE ?? '').trim();
  if (!file) return null;

  return {
    file: resolve(file),
    maxBytes: Number(env.TAPESH_LOG_MAX_BYTES) || 10 * 1024 * 1024,
    keep: Math.max(1, Number(env.TAPESH_LOG_KEEP) || 5),
  };
}

/* چرخش: قدیمی‌ترین نسخه حذف، بقیه یک شماره جلو، و فایل جاری به `.1` می‌رود */
function rotateLog(target) {
  const oldest = `${target.file}.${target.keep}`;
  if (existsSync(oldest)) rmSync(oldest, { force: true });

  for (let index = target.keep - 1; index >= 1; index -= 1) {
    const from = `${target.file}.${index}`;
    if (existsSync(from)) renameSync(from, `${target.file}.${index + 1}`);
  }

  renameSync(target.file, `${target.file}.1`);
}

export function appendLogLine(line, env = process.env) {
  const target = logFileTarget(env);
  if (!target) return false;

  try {
    mkdirSync(dirname(target.file), { recursive: true });
    if (existsSync(target.file) && statSync(target.file).size >= target.maxBytes) rotateLog(target);
    appendFileSync(target.file, `${line}\n`, { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

/* ──────────────────────────── متریک درون-حافظه ──────────────────────────── */

/*
 * حافظه محدود است: تعداد کلیدهای مسیر و تعداد خطاهای نگه‌داشته‌شده سقف دارند،
 * پس ترافیک اسکنری (مسیرهای یکتا و بی‌شمار) نمی‌تواند سرور را از حافظه ببرد.
 */
export function createMetrics({
  maxPaths = 200,
  maxRecentErrors = 50,
  maxWindowRequests = 5_000,
  windowMs = 5 * 60_000,
  now = () => Date.now(),
} = {}) {
  const startedAt = now();
  const byStatusClass = { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
  const byMethod = new Map();
  const byPath = new Map();
  const recentErrors = [];
  /* فقط method/path/status/time؛ هرگز IP، User-Agent، cookie یا body نمی‌گیرد. */
  const windowRequests = [];

  let total = 0;
  let durationSum = 0;
  let durationMax = 0;
  let droppedPathKeys = 0;
  let latestWindowDropAt = 0;

  function pruneWindow(at) {
    const cutoff = at - windowMs;
    while (windowRequests.length && windowRequests[0].ts < cutoff) windowRequests.shift();
    if (latestWindowDropAt && latestWindowDropAt < cutoff) latestWindowDropAt = 0;
  }

  function record(entry = {}) {
    const timestamp = now();
    pruneWindow(timestamp);

    const status = Number(entry.status) || 0;
    const method = String(entry.method ?? 'GET').toUpperCase();
    const path = safePathname(entry.path);
    const ms = Math.max(0, Number(entry.durationMs) || 0);

    total += 1;
    byStatusClass[statusClassOf(status)] += 1;
    byMethod.set(method, (byMethod.get(method) ?? 0) + 1);

    if (byPath.has(path)) {
      byPath.get(path).count += 1;
    } else if (byPath.size < maxPaths) {
      byPath.set(path, { count: 1 });
    } else {
      droppedPathKeys += 1;
    }

    durationSum += ms;
    if (ms > durationMax) durationMax = ms;

    if (windowRequests.length >= maxWindowRequests) {
      const dropped = windowRequests.shift();
      latestWindowDropAt = dropped?.ts ?? timestamp;
    }
    windowRequests.push({ ts: timestamp, method, path, status, ms });

    if (status >= 400) {
      const error = { t: new Date(timestamp).toISOString(), method, path, status };
      if (entry.errorCode) error.errorCode = String(entry.errorCode);
      recentErrors.push(error);
      if (recentErrors.length > maxRecentErrors) {
        recentErrors.splice(0, recentErrors.length - maxRecentErrors);
      }
    }
  }

  function snapshot() {
    const snapshotAt = now();
    pruneWindow(snapshotAt);
    const windowStatus = { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
    const windowPaths = new Map();
    let authFailures = 0;
    let authRateLimited = 0;

    for (const item of windowRequests) {
      windowStatus[statusClassOf(item.status)] += 1;
      const pathEntry = windowPaths.get(item.path) ?? { count: 0, errors: 0 };
      pathEntry.count += 1;
      if (item.status >= 400) pathEntry.errors += 1;
      windowPaths.set(item.path, pathEntry);

      const authPath = item.path === '/api/users/login' || item.path === '/api/admin/auth/login';
      if (authPath && item.status === 401) authFailures += 1;
      if (authPath && item.status === 429) authRateLimited += 1;
    }

    const windowStart = Math.max(startedAt, snapshotAt - windowMs);
    const windowErrors = windowRequests.filter((item) => item.status >= 400);
    const latestWindowErrors = windowErrors.slice(-20).reverse().map((item) => ({
      t: new Date(item.ts).toISOString(),
      method: item.method,
      path: item.path,
      status: item.status,
    }));

    return {
      startedAt: new Date(startedAt).toISOString(),
      uptimeSeconds: Math.max(0, Math.round((snapshotAt - startedAt) / 1000)),
      requests: {
        total,
        errors: byStatusClass['4xx'] + byStatusClass['5xx'],
        byStatusClass: { ...byStatusClass },
        byMethod: Object.fromEntries([...byMethod.entries()].sort(([a], [b]) => (a < b ? -1 : 1))),
      },
      latencyMs: {
        avg: total ? Math.round((durationSum / total) * 100) / 100 : 0,
        max: Math.round(durationMax),
      },
      topPaths: [...byPath.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20)
        .map(([path, entry]) => ({ path, count: entry.count })),
      droppedPathKeys,
      recentErrors: recentErrors.slice(),
      window: {
        durationMs: windowMs,
        observedMs: Math.max(0, snapshotAt - windowStart),
        from: new Date(windowStart).toISOString(),
        to: new Date(snapshotAt).toISOString(),
        total: windowRequests.length,
        errors: windowStatus['4xx'] + windowStatus['5xx'],
        byStatusClass: windowStatus,
        authFailures,
        authRateLimited,
        complete: !latestWindowDropAt || latestWindowDropAt < snapshotAt - windowMs,
        topPaths: [...windowPaths.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
          .map(([path, entry]) => ({ path, count: entry.count, errors: entry.errors })),
        recentErrors: latestWindowErrors,
      },
    };
  }

  function reset() {
    byStatusClass['1xx'] = 0;
    byStatusClass['2xx'] = 0;
    byStatusClass['3xx'] = 0;
    byStatusClass['4xx'] = 0;
    byStatusClass['5xx'] = 0;
    byStatusClass.other = 0;
    byMethod.clear();
    byPath.clear();
    recentErrors.length = 0;
    windowRequests.length = 0;
    total = 0;
    durationSum = 0;
    durationMax = 0;
    droppedPathKeys = 0;
    latestWindowDropAt = 0;
  }

  return { record, snapshot, reset };
}

/* یک سنجهٔ مشترک برای سرور Node و API پنل؛ فقط در حافظهٔ همین پروسه. */
export const runtimeMetrics = createMetrics();

/* ─────────────────────────── توکن متریک (write-only) ─────────────────────────── */

export function metricsTokenFromEnv(env = process.env) {
  return String(env.TAPESH_METRICS_TOKEN ?? '').trim();
}

/*
 * مقایسهٔ ثابت‌زمان. نابرابری طول زودتر برمی‌گردد (استاندارد است و مقدار را لو
 * نمی‌دهد)؛ بقیه بیت‌به‌بیت مقایسه می‌شود تا زمان پاسخ، طول توکن درست را لو ندهد.
 */
export function isMetricsAuthorized(header, token) {
  const expected = String(token ?? '');
  if (!expected) return false;

  const raw = String(header ?? '');
  const prefix = 'Bearer ';
  if (!raw.startsWith(prefix)) return false;

  const provided = Buffer.from(raw.slice(prefix.length), 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  if (provided.length !== wanted.length) return false;

  return timingSafeEqual(provided, wanted);
}

export function newRequestId() {
  return randomUUID();
}

/* ───────────────────────────── سلامت / آمادگی ───────────────────────────── */

/*
 * تفاوت liveness و readiness:
 *   • liveness (`/healthz`) = پروسه زنده است. به دیسک و داده کاری ندارد.
 *   • readiness (`/readyz`) = این پروسه می‌تواند سرویس بدهد. اینجا دیسک و مدل
 *     داده سنجیده می‌شوند. اگر آماده نبود، ۵۰۳ برمی‌گردد تا لودبالانسر ترافیک
 *     را نفرستد.
 *
 * نوشتن روی دیسک انجام نمی‌شود؛ فقط دسترسی (`access`) سنجیده می‌شود تا خودِ
 * health check باعث تغییر وضعیت نشود.
 *
 * `uploadsDir` اختیاری است: اگر داده شود، مسیر نوشتن آپلودها هم سنجیده می‌شود.
 * چرا لازم است: `public/uploads` دومین مسیر نوشتنی پروداکشن است؛ اگر فقط
 * `database/` سنجیده شود، پاد می‌تواند «آماده» اعلام شود در حالی که هر آپلود
 * کاربر با خطای دسترسی می‌شکند. اگر داده نشود، گزارش دقیقاً همان سه سنجهٔ
 * قبلی می‌ماند (بدون تغییر رفتار برای مصرف‌کننده‌های موجود).
 */
export function checkReadiness({ distDir, dataDir, uploadsDir } = {}) {
  const checks = [];

  if (dataDir) {
    let ok = false;
    try {
      accessSync(dataDir, constants.R_OK | constants.W_OK);
      ok = true;
    } catch {
      ok = false;
    }
    checks.push({ name: 'data-writable', ok, detail: 'database/' });
  }

  if (uploadsDir) {
    let ok = false;
    try {
      accessSync(uploadsDir, constants.R_OK | constants.W_OK);
      ok = true;
    } catch {
      ok = false;
    }
    checks.push({ name: 'uploads-writable', ok, detail: 'public/uploads/' });
  }

  if (distDir) {
    const indexFile = resolve(distDir, 'index.html');
    let ok = false;
    try {
      ok = existsSync(indexFile) && statSync(indexFile).isFile();
    } catch {
      ok = false;
    }
    checks.push({ name: 'build-artifact', ok, detail: 'dist/index.html' });
  }

  checks.push({ name: 'model-registry', ok: MODELS.length > 0, detail: `${MODELS.length} مدل` });

  return { ready: checks.every((check) => check.ok), checks };
}

/* ─────────────────────────── ردیابی خطا (آمادهٔ اتصال) ───────────────────────────
 *
 * چرا: هیچ لایهٔ ردیابی خطای بیرونی (Sentry/Rollbar) در پروژه نبود و بدون آن،
 * «شاهد پایدار حادثه» فقط همان لاگ دسترسی است — که خطای داخل تابع را نمی‌بیند.
 *
 * قرارداد:
 *   • **بدون DSN، هیچ کاری نمی‌کند.** `capture` مقدار `false` برمی‌گرداند و
 *     هیچ درخواست شبکه‌ای زده نمی‌شود. پس افزودن این لایه رفتار فعلی را عوض
 *     نمی‌کند و «وصل بودن» را هم ادعا نمی‌کند.
 *   • حمل‌ونقل تزریق‌پذیر است (`transport`)، پس تست می‌تواند بدون شبکه آن را
 *     بسنجد. پیش‌فرض `fetch` خودِ نود است.
 *   • پیش از ارسال، **همان قواعد حذف PII** اعمال می‌شود: پیام، پشته و کلیدهای
 *     زمینه پاک‌سازی می‌شوند. کلیدهای حساس (token/password/secret/cookie/auth)
 *     هرگز فرستاده نمی‌شوند.
 *   • هر خطای خودِ گزارش‌دهی بی‌صدا بلعیده می‌شود: ردیابی خطا نباید خودش خطا
 *     بسازد.
 *
 * وضعیت: IMPLEMENTED — بدون DSN واقعی، «اتصال» تأیید نشده است (UNVERIFIED-EXTERNAL).
 */

const SENSITIVE_KEY_PATTERN = /(token|secret|password|passwd|cookie|authorization|auth|dsn|key|credential)/i;
const MAX_FIELD_CHARS = 500;

export function errorTrackerFromEnv(env = process.env) {
  const dsn = String(env.TAPESH_ERROR_DSN ?? env.SENTRY_DSN ?? '').trim();
  if (!dsn) return null;
  return {
    dsn,
    environment: String(env.TAPESH_ENV ?? env.NODE_ENV ?? 'development'),
    release: String(env.TAPESH_RELEASE ?? ''),
  };
}

/* شکل‌های PII در «متن آزاد» (پیام خطا، پشته) — جدا از الگوهای مسیر بالاست */
const FREE_PHONE_CANDIDATE = /(?<![0-9A-Za-z_])\+?\d[\d\-\s]{6,}\d(?![0-9A-Za-z_])/g;
const FREE_LONG_TOKEN = /(?<![A-Za-z0-9_\-])[A-Za-z0-9_\-]{32,}(?![A-Za-z0-9_\-])/g;

/*
 * پاک‌سازی یک رشتهٔ آزاد (پیام خطا یا پشته) از شکل‌های PII.
 * جهت خطا «بیش‌حذفی» است، ولی یک استثنای عمدی: تاریخ/زمان (مثل `2026-10-02`)
 * نباید قربانی شود، چون در عیب‌یابی ارزش دارد و شمارهٔ تلفن نیست. پس رشتهٔ
 * رقمی تنها وقتی «تلفن» شمرده می‌شود که دست‌کم ۹ رقم داشته باشد.
 */
export function redactText(value) {
  const raw = String(value ?? '');
  if (!raw) return '';
  return raw
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(FREE_PHONE_CANDIDATE, (match) => (match.replace(/\D/g, '').length >= 9 ? REDACTED : match))
    .replace(FREE_LONG_TOKEN, REDACTED)
    .slice(0, MAX_FIELD_CHARS);
}

/*
 * پاک‌سازی سطحی و بی‌بازگشتِ زمینه. عمداً فقط یک سطح پایین می‌رود: عمق بیشتر
 * یعنی احتمال فرستادن ناخواستهٔ دادهٔ حساس. هر کلید حساس ⇒ حذف کامل.
 */
export function redactContext(context) {
  if (!context || typeof context !== 'object') return {};
  const safe = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') safe[key] = redactText(value);
    else if (typeof value === 'number' || typeof value === 'boolean') safe[key] = value;
    else safe[key] = REDACTED;
  }
  return safe;
}

export function createErrorReporter({ env = process.env, transport = null } = {}) {
  const config = errorTrackerFromEnv(env);
  const send = transport ?? (typeof fetch === 'function' ? fetch : null);

  async function capture(error, context = {}) {
    if (!config || !send) return false;
    try {
      const payload = {
        dsn: config.dsn,
        environment: config.environment,
        release: config.release || undefined,
        error: {
          name: String(error?.name ?? 'Error'),
          message: redactText(error?.message ?? error),
          stack: redactText(error?.stack ?? ''),
        },
        context: redactContext(context),
        at: new Date().toISOString(),
      };
      await send(config.dsn, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
      });
      return true;
    } catch {
      return false;
    }
  }

  return { enabled: Boolean(config), capture };
}

/* نمونهٔ مشترک سرور؛ بدون DSN یک no-op است. */
export const errorReporter = createErrorReporter();

export function captureError(error, context = {}) {
  return errorReporter.capture(error, context);
}
