/*
 * سیاست رمز مدیر پیش‌فرض — فاز ۹ (fail-closed).
 *
 * مشکل ثبت‌شده در ممیزی: در `contentStore.seedAdmins` مقدار
 * `process.env.TAPESH_ADMIN_PASSWORD || '0135'` بود. یعنی هر استقراری که `.env`
 * نداشت، با نام کاربری `0135` و رمز `0135` بالا می‌آمد — یک credential
 * **شناخته‌شده** روی اینترنت. `mustChangePassword` هم فقط یک پرچم در داده بود و
 * سرور آن را در مسیر ورود اعمال نمی‌کرد.
 *
 * قاعدهٔ تازه:
 *   • production + نبودِ `TAPESH_ADMIN_PASSWORD` ⇒ **راه‌اندازی متوقف می‌شود**
 *     (خطای صریح، بدون seed، بدون credential پیش‌فرض).
 *   • production + رمز کوتاه/در فهرست رمزهای ضعیف ⇒ همان خطا.
 *   • development ⇒ seed محلی مجاز است، ولی **پرچم‌دار**: `mustChangePassword`
 *     و هشدار یک‌خطی در لاگ.
 *
 * این ماژول **خالص** است (هیچ I/O ندارد) تا هم در seed و هم در تست قابل استفاده
 * باشد و رفتارش قابل‌اثبات بماند.
 */

/** رمزهایی که در production هرگز پذیرفته نمی‌شوند (شامل خودِ fallback قدیمی). */
export const FORBIDDEN_PRODUCTION_PASSWORDS = Object.freeze([
  '0135',
  'admin',
  'admin123',
  'password',
  'changeme',
  'tapesh',
  'tapesh123',
]);

export const MIN_PRODUCTION_PASSWORD_LENGTH = 12;

/** محیط تولید است؟ (فقط `NODE_ENV`، بدون حدس از مسیر یا میزبان) */
export function isProduction(env = process.env) {
  return String(env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

/**
 * تصمیم دربارهٔ credential مدیر.
 *
 * @param {object} env متغیرهای محیطی (پیش‌فرض `process.env`)
 * @returns {{action: 'seed'|'refuse', password: string|null, mustChangePassword: boolean, reason: string}}
 */
export function resolveAdminCredential(env = process.env) {
  const raw = env.TAPESH_ADMIN_PASSWORD;
  const password = typeof raw === 'string' ? raw.trim() : '';
  const production = isProduction(env);

  if (!password) {
    if (production) {
      return {
        action: 'refuse',
        password: null,
        mustChangePassword: true,
        reason:
          'TAPESH_ADMIN_PASSWORD در production تنظیم نشده است. مقدار پیش‌فرض وجود ندارد؛ ' +
          'پیش از راه‌اندازی یک رمز قوی در محیط بگذارید.',
      };
    }
    /* dev: seed محلی مجاز، ولی پرچم‌دار */
    return {
      action: 'seed',
      password: '0135',
      mustChangePassword: true,
      reason: 'محیط توسعه: رمز محلی موقت. برای production باید TAPESH_ADMIN_PASSWORD تنظیم شود.',
    };
  }

  if (production) {
    if (password.length < MIN_PRODUCTION_PASSWORD_LENGTH) {
      return {
        action: 'refuse',
        password: null,
        mustChangePassword: true,
        reason: `TAPESH_ADMIN_PASSWORD در production کوتاه‌تر از ${MIN_PRODUCTION_PASSWORD_LENGTH} کاراکتر است.`,
      };
    }
    if (FORBIDDEN_PRODUCTION_PASSWORDS.includes(password.toLowerCase())) {
      return {
        action: 'refuse',
        password: null,
        mustChangePassword: true,
        reason: 'TAPESH_ADMIN_PASSWORD در production یکی از رمزهای شناخته‌شدهٔ ضعیف است.',
      };
    }
  }

  return { action: 'seed', password, mustChangePassword: false, reason: 'رمز از محیط خوانده شد.' };
}

/**
 * گارد راه‌اندازی: در production بدون credential معتبر، خطا **پرتاب** می‌کند.
 * ویژگی `code` روی خطا برابر `ADMIN_CREDENTIAL_REQUIRED` است — کد داخلیِ
 * راه‌اندازی، نه کد خطای API (پس در مدل مرکزی خطای API ثبت نمی‌شود).
 */
export function assertAdminCredentialUsable(env = process.env) {
  const decision = resolveAdminCredential(env);
  if (decision.action === 'refuse') {
    const error = new Error(decision.reason);
    error.code = 'ADMIN_CREDENTIAL_REQUIRED';
    throw error;
  }
  return decision;
}
