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

import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
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

/* ──────────────────────────── متریک درون-حافظه ──────────────────────────── */

/*
 * حافظه محدود است: تعداد کلیدهای مسیر و تعداد خطاهای نگه‌داشته‌شده سقف دارند،
 * پس ترافیک اسکنری (مسیرهای یکتا و بی‌شمار) نمی‌تواند سرور را از حافظه ببرد.
 */
export function createMetrics({ maxPaths = 200, maxRecentErrors = 50, now = () => Date.now() } = {}) {
  const startedAt = now();
  const byStatusClass = { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
  const byMethod = new Map();
  const byPath = new Map();
  const recentErrors = [];

  let total = 0;
  let durationSum = 0;
  let durationMax = 0;
  let droppedPathKeys = 0;

  function record(entry = {}) {
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

    if (status >= 400) {
      const error = { t: new Date(now()).toISOString(), method, path, status };
      if (entry.errorCode) error.errorCode = String(entry.errorCode);
      recentErrors.push(error);
      if (recentErrors.length > maxRecentErrors) {
        recentErrors.splice(0, recentErrors.length - maxRecentErrors);
      }
    }
  }

  function snapshot() {
    return {
      startedAt: new Date(startedAt).toISOString(),
      uptimeSeconds: Math.max(0, Math.round((now() - startedAt) / 1000)),
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
    total = 0;
    durationSum = 0;
    durationMax = 0;
    droppedPathKeys = 0;
  }

  return { record, snapshot, reset };
}

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
 */
export function checkReadiness({ distDir, dataDir } = {}) {
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
