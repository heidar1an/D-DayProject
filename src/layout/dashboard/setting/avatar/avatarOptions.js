/*
 * کاتالوگ آواتارهای تصویری تپش.
 *
 * آواتارها تصویرهای آمادهٔ WebP در `images/avatars/` هستند (۰۱ تا ۳۵). کاربر در پاپ‌آپ
 * «آواتار من» یکی را انتخاب می‌کند و فقط **شناسهٔ** آن ذخیره می‌شود (`profile.avatar = '07'`).
 * ذخیرهٔ شناسه دو فایده دارد: حجم پروفایل ناچیز می‌ماند و آدرس فایل‌ها بعد از هر بیلد
 * (که hash عوض می‌شود) نمی‌شکند؛ آدرس واقعی همیشه از `avatarSrc` گرفته می‌شود.
 */

const modules = import.meta.glob('../../../../../images/avatars/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

/* تعداد اسلات‌های کاتالوگ — فایل‌های غایب خودکار حذف می‌شوند */
const AVATAR_SLOTS = 35;

const SRC_BY_ID = Object.entries(modules).reduce((acc, [path, src]) => {
  const id = path.match(/(\d+)\.webp$/)?.[1];
  if (id) acc[id] = src;
  return acc;
}, {});

/* شناسه‌ها دو رقمی‌اند: 01 تا 35 */
export const AVATAR_IDS = Array.from({ length: AVATAR_SLOTS }, (_, index) =>
  String(index + 1).padStart(2, '0'),
).filter((id) => SRC_BY_ID[id]);

export const AVATAR_IMAGES = AVATAR_IDS.map((id) => ({ id, src: SRC_BY_ID[id] }));

/* آواتار پیش‌فرض (جانشین جاهایی که همیشه باید تصویر نشان دهند، مثل ردیف‌های لیگ) */
export const DEFAULT_AVATAR = AVATAR_IDS[0] ?? null;

export function isValidAvatar(id) {
  return typeof id === 'string' && Boolean(SRC_BY_ID[id]);
}

/* مقدار ذخیره‌شده → آدرس تصویر؛ نامعتبر → null تا خود کامپوننت جانشین بگذارد */
export function avatarSrc(value) {
  if (!value) return null;
  if (isValidAvatar(value)) return SRC_BY_ID[value];
  /* سازگاری با مقادیر قدیمی: اگر آدرس کامل تصویر ذخیره شده بود، همان برگردد */
  if (/^(https?:|data:|blob:|\/)/.test(value)) return value;
  return null;
}

export function fallbackAvatarSrc() {
  return DEFAULT_AVATAR ? SRC_BY_ID[DEFAULT_AVATAR] : null;
}
