/*
 * هویت کاربر در مرورگر.
 *
 * ⚠️ قاعدهٔ اصلی این فایل:
 *
 *     localStorage ≠ authentication
 *
 * `tapesh:current-user` فقط یک **کش نمایشی** است (پیش‌پرکردن پروفایل، تلمتری،
 * نام نمایشی). هیچ تصمیمی دربارهٔ «وارد بودن» از آن گرفته نمی‌شود. منبع حقیقت
 * همیشه سشن سرور است و تنها راه فهمیدنش `fetchCurrentUser()` (endpoint
 * `GET /api/users/me`) است.
 *
 * پیش‌تر اگر API جواب نمی‌داد، `loginUser`/`saveUserRecord` از `tapesh:users`
 * داخل localStorage یک «کاربر محلی» می‌ساختند و کاربر را وارد می‌کردند —
 * یعنی هر کسی با دست‌کاری localStorage یک حساب جعلی داشت. آن مسیر کامل حذف شد:
 * خرابی شبکه یا خطای سرور هرگز به ورود تبدیل نمی‌شود.
 */

import { PASSWORD_MIN_LENGTH, describePasswordPolicy, validatePassword } from '../../database/authPolicy.js';

const SESSION_KEY = 'tapesh:current-user';
const API_BASE = '/api/users';
const GOOGLE_BASE = '/api/auth/google';

export { PASSWORD_MIN_LENGTH, describePasswordPolicy };

export class AuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'AuthError';
    this.code = code;
  }
}

export function normalizeDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .trim();
}

/* ────────────────────────── کش پروفایل (غیرحساس) ────────────────────────── */

export function getStoredUser() {
  if (typeof window === 'undefined') return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function storeUser(user) {
  if (typeof window === 'undefined' || !user) return user;

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

export function clearStoredUser() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(SESSION_KEY);
}

export function getDisplayName(user) {
  if (!user) return '';

  const { firstName, lastName, username } = user.profile ?? {};
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return fullName || username || user.phone || '';
}

/* ─────────────────────────── ورودی معتبر (UX) ─────────────────────────── */

/*
 * اعتبارسنجی سمت کلاینت **فقط** برای UX است؛ همان توابع سرور اینجا صدا زده
 * می‌شوند تا پیام‌ها یکی باشد. سرور مستقل و مرجع است.
 */
export function validatePasswordInput(password) {
  return validatePassword(password);
}

/* پیام فارسی برای هر کد خطای احراز هویت — UI روی `code` تصمیم می‌گیرد */
const AUTH_ERROR_MESSAGES = {
  USER_ALREADY_EXISTS: 'این شماره قبلاً ثبت شده است؛ وارد شوید یا رمز را بازیابی کنید.',
  INVALID_CREDENTIALS: 'شماره تلفن یا رمز عبور نادرست است.',
  RATE_LIMITED: 'تلاش‌های بیش از حد؛ کمی بعد دوباره امتحان کنید.',
  SERVER_UNAVAILABLE: 'ارتباط با سرور برقرار نشد؛ اتصال خود را بررسی کنید.',
  NETWORK_ERROR: 'ارتباط با سرور برقرار نشد؛ اتصال خود را بررسی کنید.',
  UNAUTHENTICATED: 'برای این کار باید وارد حساب کاربری شوید.',
  PASSWORD_REQUIRED: 'رمز عبور را وارد کنید.',
  PASSWORD_TOO_SHORT: `رمز عبور باید حداقل ${PASSWORD_MIN_LENGTH} نویسه باشد.`,
  PASSWORD_TOO_LONG: 'رمز عبور بیش از حد بلند است.',
  PASSWORD_TOO_WEAK: 'رمز عبور ضعیف است؛ ترکیب بهتری انتخاب کنید.',
  PASSWORD_MALFORMED: 'رمز عبور نویسهٔ غیرمجاز دارد.',
  PHONE_REQUIRED: 'شماره تلفن را وارد کنید.',
  PHONE_MALFORMED: 'شماره تلفن معتبر نیست.',
  BAD_REQUEST: 'اطلاعات ارسالی معتبر نیست.',
  UNSUPPORTED_MEDIA_TYPE: 'قالب درخواست پشتیبانی نمی‌شود.',
  FORBIDDEN: 'درخواست مجاز نیست.',
};

export function authErrorMessage(error) {
  if (!error) return AUTH_ERROR_MESSAGES.SERVER_UNAVAILABLE;
  return AUTH_ERROR_MESSAGES[error.code] ?? AUTH_ERROR_MESSAGES.SERVER_UNAVAILABLE;
}

/* ─────────────────────────────── سرور ─────────────────────────────── */

async function readError(response) {
  try {
    const data = await response.json();
    return new AuthError(String(data?.error ?? 'SERVER_UNAVAILABLE'), data?.message);
  } catch {
    return new AuthError('SERVER_UNAVAILABLE');
  }
}

/*
 * تنها منبع «وارد هستم یا نه». سه حالت صریح:
 *
 *   { status: 'authenticated',   user }
 *   { status: 'unauthenticated', user: null }
 *   { status: 'unavailable',     user: null }
 *
 * «در دسترس نبودن سرور» با «وارد نشدن» یکی گرفته نمی‌شود، ولی هیچ‌کدام ورود
 * نمی‌سازند.
 */
export async function fetchCurrentUser() {
  try {
    const response = await fetch(`${API_BASE}/me`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (response.status === 401) return { status: 'unauthenticated', user: null };
    if (!response.ok) return { status: 'unavailable', user: null };

    const data = await response.json();
    if (!data?.user || data.authenticated !== true) {
      return { status: 'unauthenticated', user: null };
    }

    return { status: 'authenticated', user: storeUser(data.user) };
  } catch {
    return { status: 'unavailable', user: null };
  }
}

/*
 * ثبت‌نام — CREATE ONLY. خطا پرتاب می‌شود (`AuthError` با `code`) و هیچ
 * fallback محلی‌ای وجود ندارد: اگر سرور نسازد، حسابی ساخته نشده است.
 */
export async function registerUser({ phone, password, profile }) {
  const normalizedPhone = normalizeDigits(phone);

  let response;
  try {
    response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone, password, profile }),
    });
  } catch {
    throw new AuthError('NETWORK_ERROR');
  }

  if (!response.ok) throw await readError(response);

  const data = await response.json();
  if (!data?.user) throw new AuthError('SERVER_UNAVAILABLE');

  return storeUser(data.user);
}

/*
 * ورود. خروجی:
 *   کاربر            → ورود موفق (فقط با پاسخ ۲۰۰ سرور)
 *   `null`           → اعتبارنامه غلط (۴۰۱) — کاربر وارد نمی‌شود
 *   پرتاب AuthError  → سرور در دسترس نیست / خطای سرور / Rate Limit
 *
 * هیچ مسیری از localStorage کاربر نمی‌سازد.
 */
export async function loginUser({ phone, password }) {
  const normalizedPhone = normalizeDigits(phone);

  let response;
  try {
    response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone, password }),
    });
  } catch {
    throw new AuthError('NETWORK_ERROR');
  }

  if (response.status === 401) return null;
  if (!response.ok) throw await readError(response);

  const data = await response.json();
  if (!data?.user) throw new AuthError('SERVER_UNAVAILABLE');

  return storeUser(data.user);
}

/*
 * ویرایش پروفایل — سشن‌محور. شمارهٔ تلفن به سرور نمی‌رود چون کلید هویت نیست.
 * خروجی `null` یعنی ذخیره نشد (شبکه/سرور)؛ کش محلی دست‌نخورده می‌ماند.
 */
export async function saveProfile({ profile }) {
  try {
    const response = await fetch(`${API_BASE}/me`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.user ? storeUser(data.user) : null;
  } catch {
    return null;
  }
}

/* ─────────────────────────────── گوگل ─────────────────────────────── */

/*
 * جریان کامل سمت سرور است (`database/googleAuth.js`) و اینجا فقط سه کار انجام
 * می‌شود: پرسیدن وضعیت پیکربندی، فرستادن مرورگر به گوگل، و گرفتن «دست‌دادن»
 * برگشتی. هیچ‌جا رمزی از گوگل دیده نمی‌شود و هیچ ورود ساختگی‌ای انجام نمی‌شود:
 * اگر سرور پیکربندی نشده باشد، همین را برمی‌گردانیم و UI صریح می‌گوید.
 */

/*
 * `configured` تنها وقتی true است که سرور واقعاً `GOOGLE_CLIENT_ID/SECRET`
 * داشته باشد. `reachable` جدا نگه داشته می‌شود: «سرور جواب نداد» با «سرور
 * گفت پیکربندی نشده‌ام» دو چیز متفاوت‌اند و پیام UI باید فرقشان را بگوید.
 */
export async function getGoogleAuthStatus() {
  try {
    const response = await fetch(`${GOOGLE_BASE}/status`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return { reachable: false, configured: false, redirectUri: '' };

    const data = await response.json();

    return {
      reachable: true,
      configured: data?.configured === true,
      redirectUri: String(data?.redirectUri ?? ''),
    };
  } catch {
    return { reachable: false, configured: false, redirectUri: '' };
  }
}

/* ناوبری کامل صفحه؛ برگشت گوگل با ۳۰۲ به `/?google=…` می‌آید */
export function startGoogleAuth() {
  if (typeof window === 'undefined') return;
  window.location.assign(`${GOOGLE_BASE}/start`);
}

/* نشانهٔ بازگشت از گوگل در آدرس؛ `null` یعنی این بار اصلاً از گوگل برنگشتیم */
export function readGoogleReturn() {
  if (typeof window === 'undefined') return null;

  const value = new URLSearchParams(window.location.search).get('google');
  return value || null;
}

/* پاک‌کردن نشانه از آدرس تا رفرش، جریان را دوباره اجرا نکند (hash دست‌نخورده می‌ماند) */
export function clearGoogleReturn() {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  params.delete('google');

  const query = params.toString();
  const { pathname, hash } = window.location;

  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${query ? `?${query}` : ''}${hash}`,
  );
}

/*
 * گرفتن کاربرِ «دست‌دادن». کوکی HttpOnly یک‌بارمصرف است و سرور همان‌جا پاکش
 * می‌کند، پس فراخوانی دوم `null` می‌دهد — نه خطا.
 */
export async function consumeGoogleHandoff() {
  try {
    const response = await fetch(`${GOOGLE_BASE}/handoff`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.user) return null;

    return storeUser(data.user);
  } catch {
    return null;
  }
}
