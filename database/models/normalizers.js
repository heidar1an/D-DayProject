/*
 * نرمال‌سازی — مرحلهٔ پیش از اعتبارسنجی.
 *
 * اصل (بند ۱۷):  normalize → validate → persist
 * نه:            validate raw → normalize later
 *
 * ⚠️ مرز مهم (بند ۵۳): نرمال‌سازی ≠ تعمیر.
 *   نرمال‌سازی  = تبدیل بازنمایی‌های معتبر به شکل متعارف
 *                 («۰۹۱۲…» فارسی → «0912…» لاتین)
 *   تعمیر       = تغییر مقدار نامعتبر به یک مقدار «قابل قبول» ساختگی
 *                 («abc» → 0) — این کار ممنوع است و باید INVALID گزارش شود.
 *
 * پس `normalizePhone('abc')` هم `''` برمی‌گرداند، ولی این «معتبر شدن» نیست؛
 * اعتبارسنجی بعدی همان ورودی خام را رد می‌کند چون خروجی نرمال‌سازی خالی است
 * و فیلد الزامی است.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** ارقام فارسی/عربی را به لاتین تبدیل می‌کند و فاصله‌های اضافی را می‌گیرد. */
export function normalizeDigits(value) {
  if (typeof value !== 'string') return value;
  let out = '';
  for (const char of value) {
    const persian = PERSIAN_DIGITS.indexOf(char);
    if (persian !== -1) { out += String(persian); continue; }
    const arabic = ARABIC_DIGITS.indexOf(char);
    if (arabic !== -1) { out += String(arabic); continue; }
    out += char;
  }
  return out;
}

/** نویسه‌های کنترلی، نیم‌فاصله و فاصله‌های تکراری را یکدست می‌کند. */
export function normalizeWhitespace(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/**
 * شمارهٔ تماس — شکل متعارف.
 *
 * ترتیب تبدیل (عیناً همان کاری که `authPolicy.js` سمت سرور می‌کند تا دو
 * رفتار موازی ساخته نشود):
 *   1) ارقام فارسی/عربی → لاتین
 *   2) حذف فاصله، خط تیره، پرانتز و نیم‌فاصله
 *   3) `+98` و `0098` → `0`
 *
 * ⚠️ این تابع هیچ فرمت تازه‌ای را اجباری نمی‌کند؛ فقط بازنمایی‌ها را یکی می‌کند.
 * اعتبارسنجی قالب کار `authPolicy.validatePhone` است، نه اینجا.
 */
export function normalizePhone(value) {
  if (typeof value !== 'string') return value;
  let out = normalizeDigits(value)
    .replace(/[\s\u200c\u00a0()\-._]/g, '');
  if (out.startsWith('+98')) out = `0${out.slice(3)}`;
  else if (out.startsWith('0098')) out = `0${out.slice(4)}`;
  else if (out.startsWith('98') && out.length === 12) out = `0${out.slice(2)}`;
  return out;
}

/**
 * ایمیل — شکل متعارف: حذف فاصله، `lowercase` فقط روی دامنه.
 * بخش محلی (قبل از @) حساس به بزرگی/کوچکی است و دست‌نخورده می‌ماند.
 */
export function normalizeEmail(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return trimmed;
  return `${trimmed.slice(0, at)}@${trimmed.slice(at + 1).toLowerCase()}`;
}

/**
 * Slug — شکل متعارف.
 * فاصله → خط تیره، حذف نویسه‌های کنترلی، ادغام خط تیره‌های تکراری.
 * حروف فارسی دست‌نخورده می‌مانند چون پروژه Slug فارسی دارد.
 */
export function normalizeSlug(value) {
  if (typeof value !== 'string') return value;
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\u200c\u00a0]/g, '-')
    .replace(/[\s/\\]+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06ff-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** برچسب/هشتگ — حذف `#` و `@` ابتدایی و فاصله‌های اضافی. */
export function normalizeTag(value) {
  if (typeof value !== 'string') return value;
  return normalizeWhitespace(value).replace(/^[#@]+/, '').trim();
}

/** عبارت جست‌وجو — همان کاری که `contentStore.normalizeSearch` می‌کند. */
export function normalizeSearchTerm(value) {
  if (typeof value !== 'string') return value;
  return normalizeDigits(value)
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u00a0]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** نام کاربری — حذف فاصله، lowercase (نام کاربری پنل با عدد شروع می‌شود). */
export function normalizeUsername(value) {
  if (typeof value !== 'string') return value;
  return normalizeDigits(value).trim().toLowerCase();
}

/**
 * شناسه — `trim` و تبدیل ارقام فارسی به لاتین.
 * ⚠️ تغییرناپذیری شناسه در لایهٔ Domain تضمین می‌شود، نه اینجا؛ این تابع فقط
 * بازنمایی یکسان می‌سازد تا مقایسهٔ کلیدها اشتباه نشود.
 */
export function normalizeId(value) {
  if (typeof value !== 'string') return value;
  return normalizeDigits(value).trim();
}

/* ─────────────────── مقایسهٔ ساختاری ─────────────────── */

/**
 * برابری ساختاری برای مقادیر JSON-ish.
 *
 * چرا لازم است: نرمال‌سازی یک آرایه/آبجکت تازه می‌سازد، پس `!==` همیشه
 * «تغییر» گزارش می‌کند — حتی وقتی محتوا یکی است. هر شمارش و diffی که بر
 * `!==` بنا شود، عدد دروغ می‌دهد.
 */
export function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => sameValue(item, b[index]));
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
}

/* ─────────────────── نرمال‌سازی رشته‌های تکراری ─────────────────── */

/** آرایهٔ رشته‌ای: trim، حذف خالی‌ها، یکتاسازی با حفظ ترتیب. */
export function normalizeStringArray(value) {
  if (!Array.isArray(value)) return value;
  const seen = new Set();
  const out = [];
  let identical = true;

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== 'string') {
      if (identical && out.length === index) out.push(item);
      else identical = false;
      continue;
    }
    const trimmed = normalizeWhitespace(item);
    if (!trimmed) { identical = false; continue; }
    if (seen.has(trimmed)) { identical = false; continue; }
    seen.add(trimmed);
    if (trimmed !== item) identical = false;
    out.push(trimmed);
  }

  /* ⚠️ اگر خروجی عیناً برابر ورودی باشد، **همان ارجاع** برگردانده می‌شود.
     وگرنه هر آرایهٔ سالم هم «تغییرکرده» شمرده می‌شود و شمارش نرمال‌سازی
     و diff تعمیر را باد می‌کند. */
  return identical && out.length === value.length ? value : out;
}

/* ─────────────────── اعمال نرمال‌سازی روی یک رکورد ─────────────────── */

/**
 * نرمال‌سازهای دامنه‌ای — قواعدی که از خودِ توصیف‌گر فیلد استخراج نمی‌شوند و
 * به معنی کسب‌وکار فیلد بستگی دارند.
 *
 * ⚠️ **یک منبع حقیقت.** هم اسکنر یکپارچگی (`scripts/data-integrity.mjs`) و هم
 * ناظر مسیر نوشتن (`models/observe.js`) از همین تابع می‌گیرند. اگر این قواعد
 * در دو جا کپی می‌شد، دو روایت متفاوت از «رکورد سالم» ساخته می‌شد و همان
 * «دو منبع حقیقت»ی می‌شد که بند ۴۸ ممنوع کرده.
 *
 * قاعدهٔ فعلی: شمارهٔ تماس مدیر/کاربر فقط فاصله‌هایش گرفته می‌شود. قالب کامل
 * شماره کارِ `authPolicy.validatePhone` است، نه اینجا.
 *
 * @param {{name?: string}} schema
 * @returns {Record<string, (value: unknown) => unknown>}
 */
export function domainNormalizersFor(schema) {
  if (schema?.name === 'user' || schema?.name === 'admin') {
    return { phone: (value) => String(value ?? '').replace(/\s/g, '') };
  }
  return {};
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * فرود بازگشتی به داخل آبجکت/آرایهٔ آبجکت.
 *
 * چرا لازم است: بدون این، `profile.term = "۸"` هرگز نرمال نمی‌شود چون
 * `profile` یک آبجکت تودرتوست. نرمال‌سازی فقط سطح اول، نرمال‌سازی نیست.
 *
 * ⚠️ فرود فقط جایی انجام می‌شود که Schema شکل را **اعلان کرده باشد**:
 *   - `object` با `fields` غیرخالی ⇒ فرود روی همان فیلدها
 *   - `object` با `allowUnknown` و `item` (نگاشت آزاد) ⇒ فرود روی مقادیر
 *   - `array` با `item.kind === 'object'` ⇒ فرود روی هر عضو
 * `json()` (کلیدهای بازِ بدون Schema) **فرود نمی‌کند** — محتوایش قرارداد آزاد دارد.
 *
 * @returns {{value: unknown, changed: string[]}} مسیرهای برگ‌تغییریافته.
 */
function normalizeNested(field, value, options, path) {
  if (value === null || value === undefined) return { value, changed: [] };

  if (Array.isArray(value) && field?.item?.kind === 'object') {
    const changed = [];
    const next = value.map((element, index) => {
      const result = normalizeNested(field.item, element, options, `${path}[${index}]`);
      changed.push(...result.changed);
      return result.value;
    });
    return { value: next, changed };
  }

  if (isPlainObject(value)) {
    if (field?.fields && Object.keys(field.fields).length > 0) {
      const result = normalizeFields(field.fields, value, options, `${path}.`);
      return { value: result.record, changed: result.changed };
    }
    if (field?.allowUnknown === true && field?.item) {
      const changed = [];
      const next = {};
      for (const [key, element] of Object.entries(value)) {
        const result = normalizeNested(field.item, element, options, `${path}.${key}`);
        changed.push(...result.changed);
        next[key] = result.value;
      }
      return { value: next, changed };
    }
  }

  return { value, changed: [] };
}

/**
 * نرمال‌سازی یک سطح از فیلدها (بازگشتی برای سطوح تودرتو).
 *
 * @returns {{record: object, changed: string[]}}
 */
function normalizeFields(fields, source, options, prefix) {
  const out = { ...source };
  const changed = [];

  for (const [key, field] of Object.entries(fields ?? {})) {
    if (!Object.hasOwn(source, key)) continue;
    const before = source[key];
    if (before === null || before === undefined) continue;

    const path = `${prefix}${key}`;
    const domainFn = options.domainNormalizers?.[key];
    let after = domainFn ? domainFn(before) : before;

    /* نرمال‌سازی آرایه‌ای پیش‌فرض فقط وقتی اعمال می‌شود که تابع دامنه‌ای نبود —
       وگرنه تابع دامنه‌ای مرجع است و دوباره‌کاری معنا ندارد. */
    if (Array.isArray(after) && !domainFn) after = normalizeStringArray(after);
    if (typeof field?.normalize === 'function') after = field.normalize(after);

    /* فقط **برگ** شمرده می‌شود؛ تغییر یک فیلد تودرتو نباید مسیر والد را هم بشمارد. */
    if (!sameValue(after, before)) changed.push(path);

    const nested = normalizeNested(field, after, options, path);
    if (nested.changed.length > 0 || !sameValue(nested.value, after)) {
      out[key] = nested.value;
      changed.push(...nested.changed);
    } else if (!sameValue(after, before)) {
      out[key] = after;
    }
  }

  return { record: out, changed };
}

/**
 * نرمال‌سازی یک رکورد بر اساس Schema.
 *
 * نرمال‌سازی هر فیلد از توصیف‌گر خودش (`field.normalize`) می‌آید و برای
 * فیلدهای شناخته‌شدهٔ دامنه، تابع تخصصی همان فیلد روی آن سوار می‌شود.
 * فیلدهای ناشناخته **دست‌نخورده** می‌مانند تا policy «unknown field» در لایهٔ
 * اعتبارسنجی تصمیم بگیرد (حذف بی‌صدا ممنوع است).
 *
 * `changed` مسیرهای **برگ** تغییر‌یافته را برمی‌گرداند (مثل `profile.term`).
 * مقایسه ساختاری است، پس آرایه/آبجکتِ سالم «تغییر» شمرده نمی‌شود.
 *
 * @param {{fields: Record<string, object>}} schema
 * @param {object} record
 * @param {{domainNormalizers?: Record<string, (v:unknown)=>unknown>}} [options]
 * @returns {{record: object, changed: string[]}}
 */
export function normalizeRecord(schema, record, { domainNormalizers = {} } = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { record, changed: [] };
  }
  return normalizeFields(schema.fields ?? {}, record, { domainNormalizers }, '');
}
