/*
 * گارد SSRF برای «آدرس پایهٔ» سرویس‌های انتشار.
 *
 * ── چرا لازم است ──
 * آدرس پایهٔ هر آداپتور از متغیر محیطی خوانده می‌شود
 * (`BALE_API_BASE` · `EITAA_API_BASE` · `TELEGRAM_API_BASE`) با پیش‌فرض ثابت.
 * اگر کسی این متغیر را به یک میزبان داخلی، loopback یا نقطهٔ متادیتای ابری
 * تغییر بدهد، توکن ربات در **مسیر URL** به همان مقصد فرستاده می‌شود — یعنی
 * هم SSRF و هم نشت توکن. پیش از این هیچ اعتبارسنجی protocol/میزبان وجود نداشت.
 *
 * ── قواعد ──
 *   ۱) فقط `http:` و `https:`.
 *   ۲) اعتبارنامهٔ درون URL ممنوع (`https://user:pass@host`) — توکن نباید دو جا برود.
 *   ۳) میزبان خصوصی/loopback/link-local/متادیتا ممنوع.
 *   ۴) معادل‌های عددی IPv4 (`2130706433` · `0x7f000001` · `0177.0.0.1`) هم گرفته
 *      می‌شوند، چون `new URL` آن‌ها را نرمال نمی‌کند و از فیلتر رشته‌ای ساده رد می‌شوند.
 *
 * ── استثنا ──
 * در توسعهٔ محلی می‌توان عمداً با `TAPESH_PUBLISH_ALLOW_PRIVATE_BASE=1` اجازه داد
 * (مثلاً برای یک mock server روی `127.0.0.1`). پیش‌فرض **fail-closed** است.
 *
 * این ماژول خالص است: نه I/O دارد، نه به storeها وابسته است.
 */

export const ALLOW_PRIVATE_BASE_ENV = 'TAPESH_PUBLISH_ALLOW_PRIVATE_BASE';
export const INSECURE_BASE_CODE = 'PUBLISH_INSECURE_BASE';

/** آیا استثنای توسعهٔ محلی فعال است؟ */
export function privateBaseAllowed() {
  const raw = String(process.env[ALLOW_PRIVATE_BASE_ENV] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** تبدیل میزبان به چهار اکتت، با پشتیبانی از شکل‌های عددی غیراستاندارد. */
function ipv4Parts(host) {
  const text = String(host ?? '').trim().toLowerCase();
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    const value = Number(text);
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) return null;
    return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  }
  if (/^0x[0-9a-f]+$/.test(text)) {
    const value = Number.parseInt(text.slice(2), 16);
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) return null;
    return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  }

  const pieces = text.split('.');
  if (pieces.length !== 4) return null;

  const parts = [];
  for (const piece of pieces) {
    let value;
    if (/^0x[0-9a-f]+$/.test(piece)) value = Number.parseInt(piece.slice(2), 16);
    else if (/^0[0-7]+$/.test(piece)) value = Number.parseInt(piece.slice(1), 8);
    else if (/^\d+$/.test(piece)) value = Number(piece);
    else return null;
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    parts.push(value);
  }
  return parts;
}

/* محدوده‌های IPv4 که هرگز مقصد یک سرویس انتشار واقعی نیستند. */
const PRIVATE_V4 = [
  [[0, 0, 0, 0], 8],        // «این شبکه» + 0.0.0.0
  [[10, 0, 0, 0], 8],       // خصوصی
  [[100, 64, 0, 0], 10],    // CGNAT
  [[127, 0, 0, 0], 8],      // loopback
  [[169, 254, 0, 0], 16],   // link-local + متادیتای ابری (169.254.169.254)
  [[172, 16, 0, 0], 12],    // خصوصی
  [[192, 0, 0, 0], 24],     // IETF protocol assignments
  [[192, 168, 0, 0], 16],   // خصوصی
  [[198, 18, 0, 0], 15],    // بنچمارک
  [[224, 0, 0, 0], 4],      // multicast
  [[240, 0, 0, 0], 4],      // reserved
];

const asInt = (parts) => (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);

function inV4Range(parts, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (asInt(parts) & mask) === (asInt(base) & mask);
}

function isPrivateV4(parts) {
  return PRIVATE_V4.some(([base, bits]) => inV4Range(parts, base, bits));
}

/* نام‌های میزبانی که همیشه محلی/داخلی‌اند. */
const LOCAL_NAMES = ['localhost', 'metadata.google.internal', 'metadata.goog'];
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

function isLocalName(host) {
  if (LOCAL_NAMES.includes(host)) return true;
  return LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function isPrivateV6(host) {
  const text = String(host ?? '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!text.includes(':')) return false;
  if (text === '::1' || text === '::') return true;
  /* fc00::/7 (unique-local) و fe80::/10 (link-local) */
  if (/^f[cd][0-9a-f]{0,2}:/.test(text)) return true;
  if (/^fe[89ab][0-9a-f]?:/.test(text)) return true;

  /* IPv4 نگاشت‌شده: ::ffff:127.0.0.1 یا ::ffff:7f00:1 */
  const mappedDotted = text.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedDotted) {
    const parts = ipv4Parts(mappedDotted[1]);
    return parts ? isPrivateV4(parts) : true;
  }
  const mappedHex = text.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = Number.parseInt(mappedHex[1], 16);
    const lo = Number.parseInt(mappedHex[2], 16);
    return isPrivateV4([(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255]);
  }
  return false;
}

/** آیا این میزبان مقصد داخلی/خصوصی است؟ (خالص، قابل تست) */
export function isBlockedHost(host) {
  const text = String(host ?? '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!text) return true;
  if (text.includes(':')) return isPrivateV6(text);
  if (isLocalName(text)) return true;
  const parts = ipv4Parts(text);
  if (parts) return isPrivateV4(parts);
  return false;
}

function guardError(message, extra) {
  return Object.assign(new Error(message), { code: INSECURE_BASE_CODE, ...extra });
}

/**
 * اعتبارسنجی و نرمال‌سازی آدرس پایهٔ یک سرویس بیرونی.
 * در صورت نامعتبر بودن **پرتاب** می‌کند (fail-closed) و آدرس نرمال‌شده
 * (بدون اسلش انتهایی) را برمی‌گرداند.
 */
export function assertSafeApiBase(rawBase, { envName = 'API_BASE', platform = '' } = {}) {
  const subject = platform ? `آدرس پایهٔ «${platform}»` : 'آدرس پایهٔ سرویس';
  const base = String(rawBase ?? '').trim().replace(/\/+$/, '');

  if (!base) {
    throw guardError(`${subject} تنظیم نشده است (${envName})`, { envName });
  }

  let url;
  try {
    url = new URL(base);
  } catch {
    throw guardError(`${subject} معتبر نیست (${envName})`, { envName });
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw guardError(`${subject} باید http یا https باشد (${envName})`, { envName });
  }

  if (url.username || url.password) {
    throw guardError(`${subject} نباید اعتبارنامهٔ درون URL داشته باشد (${envName})`, { envName });
  }

  const host = url.hostname;
  if (!host || (isBlockedHost(host) && !privateBaseAllowed())) {
    throw guardError(
      `${subject} به میزبان داخلی/خصوصی اشاره می‌کند و مجاز نیست (${envName})؛ برای توسعهٔ محلی ${ALLOW_PRIVATE_BASE_ENV}=1`,
      { envName, host },
    );
  }

  return base;
}
