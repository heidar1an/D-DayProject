/*
 * مرز v1 — تنها جایی در فرانت‌اند که با `/api/v1/*` (Laravel) حرف می‌زند.
 *
 * چرا یک ماژول جدا: تا وقتی هر دو بک‌اند روی یک دامنه سرو می‌شوند، «v1 پاسخ داد»
 * و «v1 روی این سرور نیست» باید **یک‌جا** تفکیک شوند. سرور Node فعلی هر مسیر
 * ناشناختهٔ `/api/v1/*` را به SPA fallback می‌فرستد ⇒ **۲۰۰ با HTML**. اگر آن را
 * پاسخ معتبر بگیریم، کاربرِ واردشده بی‌صدا داده‌های خالی می‌بیند.
 *
 * پس هر پاسخ فقط وقتی معتبر است که:
 *   ۱. `content-type` شامل `application/json` باشد،
 *   ۲. بدنه JSON پارس شود،
 *   ۳. شکل envelope فاز ۱ را داشته باشد (`data`/`error` + `requestId`).
 * در غیر این صورت `reason: 'not_v1'` برمی‌گردد و مصرف‌کننده به مسیر قدیمی برمی‌گردد.
 *
 * CSRF: کوکی non-HttpOnly `tapesh_csrf` + هدر `X-CSRF-Token` (double-submit).
 * Idempotency: هدر `Idempotency-Key` — سرور retry را بازپخش می‌کند، نه دوباره اجرا.
 */

export const V1_BASE = '/api/v1';

/* دلیل‌های شکست — مصرف‌کننده بر اساس همین‌ها تصمیم می‌گیرد، نه بر اساس متن پیام. */
export const V1_REASON = {
  /* v1 روی این سرور سرو نمی‌شود (یا پاسخ، envelope ما نیست) ⇒ fallback مجاز است. */
  NOT_V1: 'not_v1',
  /* شبکه/قطع اتصال ⇒ fallback مجاز است ولی «v1 نبود» نیست. */
  NETWORK: 'network',
  /* سرور پاسخ envelope معتبر داد ولی با خطا ⇒ **fallback مجاز نیست**، خطا را نشان بده. */
  API: 'api',
};

const CSRF_COOKIE = 'tapesh_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const IDEMPOTENCY_HEADER = 'Idempotency-Key';

function readCookie(name) {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));

  return match ? decodeURIComponent(match[1]) : null;
}

/* توکن CSRF نشست جاری. نبودش یعنی سشن نداریم؛ درخواست نوشتن بی‌توکن ۴۱۹ می‌گیرد. */
export const csrfToken = () => readCookie(CSRF_COOKIE);

/* envelope فاز ۱: `{ data, meta?, requestId }` یا `{ error: { code, message, fields }, requestId }`. */
function isV1Envelope(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (typeof payload.requestId !== 'string' || payload.requestId === '') return false;

  return 'data' in payload || 'error' in payload;
}

/**
 * یک درخواست v1.
 *
 * خروجی موفق: `{ ok: true, status, data, meta, requestId }`
 * خروجی ناموفق: `{ ok: false, status, reason, code?, message?, fields?, requestId? }`
 */
export async function v1Request(path, { method = 'GET', body, idempotencyKey, signal } = {}) {
  const headers = { Accept: 'application/json' };

  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (method !== 'GET' && method !== 'HEAD') {
    const token = csrfToken();
    if (token) headers[CSRF_HEADER] = token;
  }

  if (idempotencyKey) headers[IDEMPOTENCY_HEADER] = idempotencyKey;

  let response;

  try {
    response = await fetch(`${V1_BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, reason: V1_REASON.NETWORK };
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { ok: false, status: response.status, reason: V1_REASON.NOT_V1 };
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, status: response.status, reason: V1_REASON.NOT_V1 };
  }

  if (!isV1Envelope(payload)) {
    return { ok: false, status: response.status, reason: V1_REASON.NOT_V1 };
  }

  if (!response.ok) {
    const error = payload.error ?? {};

    return {
      ok: false,
      status: response.status,
      reason: V1_REASON.API,
      code: error.code ?? null,
      message: error.message ?? null,
      fields: error.fields ?? {},
      requestId: payload.requestId,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: payload.data ?? null,
    meta: payload.meta ?? null,
    requestId: payload.requestId,
  };
}

/* آیا v1 روی این سرور واقعاً سرو می‌شود؟ فقط برای تصمیم‌گیری یک‌بار در استارتاپ. */
export async function v1IsServing() {
  const result = await v1Request('/healthz');

  return result.ok === true;
}

/*
 * کلید idempotency برای mutationهای کاربر.
 *
 * `crypto.randomUUID` در همهٔ مرورگرهای هدف موجود است؛ fallback فقط برای محیط
 * بدون `crypto` (تست/SSR) است و نباید به‌عنوان منبع امنیت استفاده شود.
 */
export function newRequestKey(prefix = 'req') {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

  return `${prefix}:${uuid}`;
}
