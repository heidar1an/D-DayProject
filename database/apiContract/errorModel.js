/*
 * مدل خطای متمرکز API — فاز ۷.
 *
 * ── چرا این فایل وجود دارد ────────────────────────────────────────────────
 * پیش از این، سه فهرست نگاشت خطا در سه فایل جدا بود:
 *   • `adminApi.js`  → `STATUS_BY_CODE`
 *   • `examApi.js`   → `STATUS_BY_CODE` + `BUSINESS_ERRORS`
 *   • `usersApi.js`  → `STATUS_BY_ERROR`
 * هیچ‌کدام مرجع مشترک نداشتند؛ پس امکان «یک کد، دو وضعیت» یا افزودن کد تازه
 * با وضعیت دلخواه وجود داشت. این فایل **مرجع یگانه** است.
 *
 * ── اصل سازگاری ───────────────────────────────────────────────────────────
 * مقادیر وضعیت اینجا **عیناً** همان مقادیر سه فهرست قبلی‌اند. هر سه فایل
 * اکنون از همین‌جا import می‌کنند، پس رفتارشان بیت‌به‌بیت تغییر نکرده است.
 * (`ERROR_SPECS` فقط فرادادهٔ افزوده است: retryable / expose / level.)
 *
 * ── پوشش‌های پاسخ ─────────────────────────────────────────────────────────
 * envelopeها واقعاً متفاوت‌اند و **یکسان‌سازی نشده‌اند** (شکستن قرارداد
 * بدون migration ممنوع است — بند ۱۹). اختلاف صریحاً ثبت شده تا پنل و کلاینت
 * بدون تغییر بمانند:
 *   admin  → { success:false, error:{ code, message, fields? } }
 *   exam   → { success:false, error:{ code, reason?, message } }
 *   google → { success:false, error:{ code, message } }
 *   users  → { error: code, message? }          ← ⚠ ناهمگون (finding فاز ۷)
 */

/* ─────────────────────────── فرادادهٔ هر کد ─────────────────────────── */

/**
 * `retryable`  → آیا کلاینت می‌تواند بعداً همان درخواست را تکرار کند؟
 * `expose`     → آیا پیام می‌تواند به Client برود؟ (`false` ⇒ پیام ثابت عمومی)
 * `level`      → سطح ثبت در کنسول سرور.
 */
const SPEC = (status, { retryable = false, expose = true, level = 'warn' } = {}) => ({
  status, retryable, expose, level,
});

export const ERROR_SPECS = Object.freeze({
  /* ── درخواست بدشکل / اعتبارسنجی ── */
  BAD_REQUEST: SPEC(400),
  VALIDATION_ERROR: SPEC(400),
  UNSUPPORTED_MEDIA_TYPE: SPEC(415),
  PAYLOAD_TOO_LARGE: SPEC(413, { retryable: false }),
  METHOD_NOT_ALLOWED: SPEC(405),

  /* ── هویت و مجوز ── */
  UNAUTHENTICATED: SPEC(401),
  INVALID_CREDENTIALS: SPEC(401),
  FORBIDDEN: SPEC(403),

  /* ── سیاست ورود کاربر سایت (usersApi) ── */
  PHONE_REQUIRED: SPEC(400),
  PHONE_MALFORMED: SPEC(400),
  PASSWORD_REQUIRED: SPEC(400),
  PASSWORD_MALFORMED: SPEC(400),
  PASSWORD_TOO_SHORT: SPEC(400),
  PASSWORD_TOO_LONG: SPEC(400),
  PASSWORD_TOO_WEAK: SPEC(400),

  /* ── وضعیت منبع ── */
  NOT_FOUND: SPEC(404),
  USER_NOT_FOUND: SPEC(404),
  USER_ALREADY_EXISTS: SPEC(409),
  CONFLICT: SPEC(409),
  RATE_LIMITED: SPEC(429, { retryable: true }),

  /* ── انتشار در کانال‌های بیرونی — خطای سرویس خارجی، نه درخواست کاربر ── */
  PUBLISH_NO_TOKEN: SPEC(409),
  PUBLISH_UNAUTHORIZED: SPEC(502, { retryable: true }),
  PUBLISH_FORBIDDEN: SPEC(502, { retryable: true }),
  PUBLISH_UNREACHABLE: SPEC(502, { retryable: true }),
  PUBLISH_TIMEOUT: SPEC(504, { retryable: true }),
  PUBLISH_FAILED: SPEC(502, { retryable: true }),

  /* ── سرور ── */
  INTERNAL_ERROR: SPEC(500, { expose: false, level: 'error' }),

  /*
   * خرابی فایل دادهٔ ذخیره‌شده (JSON نامعتبر). خطای سرور است نه درخواست کاربر،
   * پس `expose:false` — مسیر فایل و جزئیات پارسر نباید به Client برود.
   * منبع: گارد `assertNotCorrupt` در `contentStore.js` (فاز ۱۶ — بند ۶).
   */
  STORAGE_CORRUPT: SPEC(500, { expose: false, level: 'error' }),
});

/**
 * پیام عمومی **پیش‌فرض** برای کدهایی که پیام اختصاصی ندارند.
 *
 * ⚠️ فقط `INTERNAL_ERROR` پیام فراخوان را بازنویسی می‌کند (چون
 * `expose:false` است). کدهای دیگر مثل `NOT_FOUND` پیام‌های متفاوتی در
 * جای‌های مختلف دارند («صفحه پیدا نشد»، «آزمون پیدا نشد») و **نباید**
 * با یک پیام ثابت جایگزین شوند — این یک تغییر رفتار است، نه بهبود.
 */
export const PUBLIC_MESSAGES = Object.freeze({
  INTERNAL_ERROR: 'خطای غیرمنتظره در سرور',
});

/* ─────────────────────────── نگاشت‌های سازگار (عیناً قبلی) ─────────────────────────── */

const mapOf = (codes) => Object.freeze(Object.fromEntries(codes.map((code) => [code, ERROR_SPECS[code].status])));

/** `adminApi.STATUS_BY_CODE` — بدون تغییر مقدار. */
export const ADMIN_STATUS_BY_CODE = mapOf([
  'VALIDATION_ERROR', 'INVALID_CREDENTIALS', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
  'UNSUPPORTED_MEDIA_TYPE', 'PAYLOAD_TOO_LARGE', 'RATE_LIMITED',
  'PUBLISH_NO_TOKEN', 'PUBLISH_UNAUTHORIZED', 'PUBLISH_FORBIDDEN', 'PUBLISH_UNREACHABLE',
  'PUBLISH_TIMEOUT', 'PUBLISH_FAILED', 'INTERNAL_ERROR',
]);

/** `examApi.STATUS_BY_CODE` — بدون تغییر مقدار. */
export const EXAM_STATUS_BY_CODE = mapOf([
  'VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
  'PAYLOAD_TOO_LARGE', 'RATE_LIMITED', 'INTERNAL_ERROR',
]);

/** `usersApi.STATUS_BY_ERROR` — بدون تغییر مقدار. */
export const USER_STATUS_BY_ERROR = mapOf([
  'PHONE_REQUIRED', 'PHONE_MALFORMED', 'PASSWORD_REQUIRED', 'PASSWORD_MALFORMED', 'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG', 'PASSWORD_TOO_WEAK', 'USER_ALREADY_EXISTS', 'USER_NOT_FOUND', 'UNAUTHENTICATED',
  'INVALID_CREDENTIALS', 'FORBIDDEN', 'UNSUPPORTED_MEDIA_TYPE', 'PAYLOAD_TOO_LARGE', 'RATE_LIMITED',
  'BAD_REQUEST',
]);

/* ─────────────────────────── API ─────────────────────────── */

/** وضعیت HTTP یک کد خطا. کد ناشناخته ⇒ `fallback` (پیش‌فرض ۵۰۰). */
export function statusFor(code, fallback = 500) {
  return ERROR_SPECS[code]?.status ?? fallback;
}

/** آیا کد خطا در مدل ثبت شده است؟ */
export function isKnownError(code) {
  return Object.hasOwn(ERROR_SPECS, code);
}

/**
 * پیام قابل‌نمایش برای Client.
 * کدهایی با `expose: false` هرگز پیام داخلی را بیرون نمی‌دهند؛ بقیه پیام
 * خودِ فراخوان را دست‌نخورده نگه می‌دارند (سازگاری کامل با رفتار فعلی).
 */
export function publicMessage(code, message) {
  if (ERROR_SPECS[code]?.expose === false) {
    return PUBLIC_MESSAGES[code] ?? 'خطای غیرمنتظره در سرور';
  }
  /* بدون پیام ⇒ رشتهٔ خالی، تا پوشش‌هایی مثل `users` کلید `message` نسازند. */
  return message || PUBLIC_MESSAGES[code] || '';
}

/* ─────────────────────────── پوشش پاسخ ─────────────────────────── */

/**
 * چهار پوشش واقعی خطا در پروژه. `fields` فقط در پوشش admin پشتیبانی می‌شود
 * (همان‌جا که `fail(code, message, fields)` آن را می‌سازد).
 */
export const ENVELOPES = Object.freeze({
  admin: (code, message, extra = {}) => ({
    success: false,
    error: { code, message, ...(extra.fields ? { fields: extra.fields } : {}) },
  }),
  exam: (code, message, extra = {}) => ({
    success: false,
    error: { code, ...(extra.reason ? { reason: extra.reason } : {}), message },
  }),
  google: (code, message) => ({ success: false, error: { code, message } }),
  /* ⚠ usersApi شکل متفاوتی دارد: کلید خطا در ریشه است، نه داخل `error`. */
  users: (code, message) => ({ error: code, ...(message ? { message } : {}) }),
});

/**
 * ساخت بدنهٔ خطا بر اساس پوشش یک لایه.
 * @param {'admin'|'exam'|'google'|'users'} envelope
 */
export function buildError(envelope, code, message, extra = {}) {
  const shape = ENVELOPES[envelope];
  if (!shape) throw new Error(`پوشش خطای ناشناخته: ${envelope}`);
  return shape(code, publicMessage(code, message), extra);
}

/** فرادادهٔ کامل یک کد — برای تست و مستندسازی. */
export function errorSpec(code) {
  return ERROR_SPECS[code] ?? null;
}
