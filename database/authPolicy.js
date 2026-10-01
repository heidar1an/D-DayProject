/*
 * سیاست هویت کاربران سایت — تنها منبع حقیقت.
 *
 * این فایل عمداً «خالص» است: هیچ importای از `node:*` ندارد. به همین دلیل هم
 * `usersStore.js` (سرور) و هم `src/services/userStorage.js` (کلاینت) می‌توانند
 * همان قواعد را بخوانند و «حداقل طول رمز» دو جای مختلف سخت‌کد نشود.
 *
 * ⚠️ اعتبارسنجی سمت کلاینت فقط UX است. مرجع امنیت همیشه سرور است؛
 * `usersApi.js` پیش از هر نوشتن، همین توابع را روی ورودی خام صدا می‌زند.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/* شمارهٔ موبایل ایران پس از تبدیل ارقام فارسی/عربی به لاتین: ۱۱ رقم با ۰۹ */
export const PHONE_PATTERN = /^09\d{9}$/;
/* شمارهٔ ثابت با کد شهر هم پذیرفته می‌شود (۰۹ + ۱۰ رقم ⇒ ۱۱؛ ثابت ⇒ ۱۰ تا ۱۳) */
export const LANDLINE_PATTERN = /^0\d{9,12}$/;

/* رمزهای پرتکرار — کوچک نگه داشته شده؛ هدف «بدیهی‌ترین‌ها» است نه دیکشنری کامل */
const WEAK_PASSWORDS = new Set([
  'password', 'passw0rd', 'password1', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', '11111111', '00000000', 'abcd1234', 'iloveyou',
  'tapesh123', 'admin123', 'letmein1', 'welcome1', 'football', 'monkey123',
]);

function asString(value) {
  return typeof value === 'string' ? value : '';
}

/*
 * نتیجه همیشه شکل ثابت دارد: `{ ok, code, message }`.
 * `code` برای تصمیم‌گیری ماشینی است و `message` فارسی برای UI.
 */
function reject(code, message) {
  return { ok: false, code, message };
}

const ACCEPTED = { ok: true, code: 'OK', message: '' };

export function validatePassword(password) {
  const value = asString(password);

  if (!value) return reject('PASSWORD_REQUIRED', 'رمز عبور را وارد کنید.');
  /* فاصله تنها یک رمز «خالی» است، نه یک رمز ضعیف */
  if (!value.trim()) return reject('PASSWORD_REQUIRED', 'رمز عبور نمی‌تواند فقط فاصله باشد.');

  /* نویسه‌های کنترلی و خط جدید نشانهٔ ورودی malformed هستند */
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return reject('PASSWORD_MALFORMED', 'رمز عبور نویسهٔ غیرمجاز دارد.');
  }

  if (value.length > PASSWORD_MAX_LENGTH) {
    return reject('PASSWORD_TOO_LONG', `رمز عبور نباید بیش از ${PASSWORD_MAX_LENGTH} نویسه باشد.`);
  }

  /*
   * طول با NFKC سنجیده می‌شود: «۱۲۳۴» فارسی یا نیم‌فاصله نباید طول واقعی را
   * کمتر از آنچه هست نشان دهد.
   */
  const normalized = value.normalize('NFKC');
  if (normalized.trim().length < PASSWORD_MIN_LENGTH) {
    return reject('PASSWORD_TOO_SHORT', `رمز عبور باید حداقل ${PASSWORD_MIN_LENGTH} نویسه باشد.`);
  }

  const compact = normalized.replace(/\s+/g, '');
  if (/^\d+$/.test(compact)) {
    return reject('PASSWORD_TOO_WEAK', 'رمز عبور نباید فقط عدد باشد.');
  }
  if (compact.length > 1 && new Set(compact).size === 1) {
    return reject('PASSWORD_TOO_WEAK', 'رمز عبور نباید تکرار یک نویسه باشد.');
  }
  if (WEAK_PASSWORDS.has(normalized.toLowerCase())) {
    return reject('PASSWORD_TOO_WEAK', 'این رمز عبور بسیار پرتکرار است؛ رمز دیگری انتخاب کنید.');
  }

  return ACCEPTED;
}

export function validatePhone(phone) {
  const value = asString(phone).trim();

  if (!value) return reject('PHONE_REQUIRED', 'شماره تلفن را وارد کنید.');
  if (!/^\d+$/.test(value)) return reject('PHONE_MALFORMED', 'شماره تلفن باید فقط رقم باشد.');
  if (!PHONE_PATTERN.test(value) && !LANDLINE_PATTERN.test(value)) {
    return reject('PHONE_MALFORMED', 'شماره تلفن معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹).');
  }

  return ACCEPTED;
}

/* متن راهنمای زیر فیلد رمز در فرم ثبت‌نام — از همان ثابت‌ها ساخته می‌شود */
export function describePasswordPolicy() {
  return `رمز عبور حداقل ${PASSWORD_MIN_LENGTH} نویسه باشد و فقط عدد نباشد.`;
}
