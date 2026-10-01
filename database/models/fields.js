/*
 * انواع پایه (Field Primitives) — واژگان مشترک همهٔ Schemaها.
 *
 * هر Field یک توصیف‌گر (descriptor) ساده است، نه کلاس. قرارداد توصیف‌گر:
 *
 *   kind        نوع پایه: string | number | boolean | enum | array | object |
 *               ref | timestamp | epoch | json | union | discriminated | any
 *   required    نبودِ فیلد خطاست (field absent ≠ field = null ≠ field = "")
 *   nullable    مقدار `null` مجاز است
 *   default     مقداری که در نبود فیلد باید درج شود (فقط در mode=create)
 *   immutable   پس از ساخت نباید تغییر کند
 *   protected   از Client پذیرفته نمی‌شود (فقط سرور مقدار می‌دهد)
 *   secret      در سریال‌سازی عمومی هرگز نباید بیرون بیاید
 *   description توضیح فارسی برای گزارش و مستندات
 *
 * تابع `check(value, ctx)` خطا را برمی‌گرداند (`{ code, message }`) یا `null`.
 * تابع `normalize(value)` مقدار را پیش از اعتبارسنجی به شکل متعارف می‌برد.
 *
 * ⚠️ اصل: `normalize` هرگز داده را «تعمیر» نمی‌کند. `"abc"` برای یک فیلد عددی
 * همچنان نامعتبر می‌ماند؛ تبدیل بی‌صدا به `0` ممنوع است (بند ۵۳).
 *
 * ⚠️ نکتهٔ پیاده‌سازی: اعتبارسنجی اعضای آرایه و کلیدهای آبجکت **اینجا** انجام
 * نمی‌شود؛ کار `validator.js` است. اگر `arr()` هم بازگشتی اعتبارسنجی می‌کرد،
 * هر عضو دو بار سنجیده می‌شد و خطاهای تکراری تولید می‌کرد.
 */

const ISO_8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

/** خطای استاندارد لایهٔ اعتبارسنجی. */
function error(code, message) {
  return { code, message };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/* ─────────────────────────────── پایه ─────────────────────────────── */

function base(descriptor) {
  return {
    required: false,
    nullable: false,
    immutable: false,
    protected: false,
    secret: false,
    default: undefined,
    description: '',
    normalize: (value) => value,
    check: () => null,
    ...descriptor,
  };
}

/* ─────────────────────────────── رشته ─────────────────────────────── */

/**
 * رشته.
 * @param {{min?:number,max?:number,pattern?:RegExp,enumValues?:string[],trim?:boolean,
 *          allowEmpty?:boolean,nullable?:boolean}} options
 */
export function str({
  min = 0, max = 4000, pattern = null, enumValues = null,
  trim = true, allowEmpty = true, nullable = false,
} = {}) {
  return base({
    kind: 'string',
    nullable,
    normalize: (value) => (typeof value === 'string' && trim ? value.trim() : value),
    check: (value) => {
      if (typeof value !== 'string') return error('type', 'باید رشته باشد.');
      if (!allowEmpty && value.length === 0) return error('empty', 'نباید خالی باشد.');
      if (value.length < min) return error('min', `حداقل ${min} نویسه لازم است.`);
      if (value.length > max) return error('max', `حداکثر ${max} نویسه مجاز است.`);
      if (pattern && !pattern.test(value)) return error('pattern', 'قالب مقدار درست نیست.');
      if (enumValues && !enumValues.includes(value)) return error('enum', `مقدار «${value}» در فهرست مجاز نیست.`);
      return null;
    },
  });
}

/** رشتهٔ شناسه — بدون فاصله، الگوی `prefix-rest`. */
export function id({ prefix = null, max = 80, nullable = false } = {}) {
  const escaped = prefix ? prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
  const pattern = escaped
    ? new RegExp(`^${escaped}-[A-Za-z0-9_-]+$`)
    : /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
  return base({
    kind: 'string',
    nullable,
    description: 'شناسهٔ یکتا و تغییرناپذیر',
    immutable: true,
    protected: true,
    normalize: (value) => (typeof value === 'string' ? value.trim() : value),
    check: (value) => {
      if (typeof value !== 'string') return error('type', 'شناسه باید رشته باشد.');
      if (!value) return error('empty', 'شناسه نباید خالی باشد.');
      if (value.length > max) return error('max', `شناسه نباید بیش از ${max} نویسه باشد.`);
      if (!pattern.test(value)) return error('pattern', 'قالب شناسه درست نیست.');
      return null;
    },
  });
}

/**
 * شناسه با چند پیشوند مجاز — پروژه در یک مجموعه دو پیشوند دارد
 * (مثلاً دک‌های فلش‌کارت هم `fcd-` و هم `deck-`).
 */
export function idAnyOf(prefixes, { max = 80, nullable = false } = {}) {
  const alternatives = prefixes
    .map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const pattern = new RegExp(`^(?:${alternatives})-[A-Za-z0-9_-]+$`);
  return base({
    kind: 'string',
    nullable,
    description: `شناسهٔ یکتا با یکی از پیشوندهای ${prefixes.join(' | ')}`,
    immutable: true,
    protected: true,
    normalize: (value) => (typeof value === 'string' ? value.trim() : value),
    check: (value) => {
      if (typeof value !== 'string') return error('type', 'شناسه باید رشته باشد.');
      if (!value) return error('empty', 'شناسه نباید خالی باشد.');
      if (value.length > max) return error('max', `شناسه نباید بیش از ${max} نویسه باشد.`);
      if (!pattern.test(value)) return error('pattern', 'قالب شناسه درست نیست.');
      return null;
    },
  });
}

/**
 * Slug — شناسهٔ خوانا در URL.
 * حروف فارسی مجاز است (پروژه Slugهای فارسی دارد) ولی فاصله و اسلش نه.
 */
export function slug({ max = 160, min = 1, nullable = false } = {}) {
  return base({
    kind: 'string',
    nullable,
    description: 'شناسهٔ خوانا؛ یکتا در مجموعه',
    normalize: (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, '-') : value),
    check: (value) => {
      if (typeof value !== 'string') return error('type', 'slug باید رشته باشد.');
      if (value.length < min) return error('min', `slug حداقل ${min} نویسه لازم دارد.`);
      if (value.length > max) return error('max', `slug حداکثر ${max} نویسه است.`);
      if (/\s/.test(value)) return error('pattern', 'slug نباید فاصله داشته باشد.');
      if (value.includes('/') || value.includes('\\')) return error('pattern', 'slug نباید اسلش داشته باشد.');
      return null;
    },
  });
}

/** رنگ hex — پروژه برای لهجه‌های محتوا از hex استفاده می‌کند، نه نام. */
export function hexColor({ nullable = true } = {}) {
  return base({
    kind: 'string',
    nullable,
    description: 'رنگ hex مثل #5b8cc7 — رشتهٔ خالی یعنی «تعیین نشده»',
    normalize: (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    },
    check: (value) => {
      if (typeof value !== 'string') return error('type', 'رنگ باید رشته باشد.');
      if (value === '') return error('empty', 'رنگ نمی‌تواند رشتهٔ خالی باشد.');
      if (!HEX_COLOR.test(value)) return error('pattern', 'رنگ باید قالب hex داشته باشد.');
      return null;
    },
  });
}

/* ─────────────────────────────── عدد ─────────────────────────────── */

/**
 * عدد.
 * @param {{min?:number,max?:number,int?:boolean,nullable?:boolean}} options
 */
export function num({ min = -Infinity, max = Infinity, int = false, nullable = false } = {}) {
  return base({
    kind: 'number',
    nullable,
    normalize: (value) => (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value),
    check: (value) => {
      if (typeof value !== 'number') return error('type', 'باید عدد باشد.');
      if (!Number.isFinite(value)) return error('not_finite', 'عدد باید متناهی باشد (NaN و Infinity مجاز نیستند).');
      if (int && !Number.isInteger(value)) return error('integer', 'باید عدد صحیح باشد.');
      if (value < min) return error('min', `کمترین مقدار مجاز ${min} است.`);
      if (value > max) return error('max', `بیشترین مقدار مجاز ${max} است.`);
      return null;
    },
  });
}

/** درصد — بازهٔ بستهٔ ۰..۱۰۰. */
export function percent({ nullable = false } = {}) {
  return num({ min: 0, max: 100, nullable });
}

/** شمارنده — عدد صحیح نامنفی. */
export function count({ max = Number.MAX_SAFE_INTEGER, nullable = false } = {}) {
  return num({ min: 0, max, int: true, nullable });
}

/* ─────────────────────────────── بولی ─────────────────────────────── */

export function bool({ nullable = false } = {}) {
  return base({
    kind: 'boolean',
    nullable,
    check: (value) => (typeof value === 'boolean' ? null : error('type', 'باید بولی باشد.')),
  });
}

/* ─────────────────────────────── Enum ─────────────────────────────── */

/**
 * Enum بسته. `name` تنها برای پیام خطای خواناست.
 * @param {readonly string[]} allowed
 */
export function enumOf(allowed, { name = '', nullable = false } = {}) {
  const set = new Set(allowed);
  return base({
    kind: 'enum',
    nullable,
    description: name ? `Enum «${name}»` : 'Enum',
    check: (value) => {
      if (typeof value !== 'string') return error('type', 'مقدار Enum باید رشته باشد.');
      if (!set.has(value)) return error('enum', `مقدار «${value}» در فهرست مجاز ${name ? `«${name}»` : ''} نیست.`);
      return null;
    },
  });
}

/* ─────────────────────────── زمان ─────────────────────────── */

/**
 * مُهر زمانی ISO 8601.
 * پروژه در همه‌جای محتوا ISO می‌نویسد؛ تنها استثنای واقعی `feedback.createdAt`
 * است که epoch میلی‌ثانیه است و جداگانه با `epoch()` مدل شده.
 */
export function timestamp({ dateOnly = false, nullable = false } = {}) {
  return base({
    kind: 'timestamp',
    nullable,
    description: dateOnly ? 'تاریخ ISO (YYYY-MM-DD)' : 'مُهر زمانی ISO 8601',
    /* رشتهٔ خالی در دادهٔ واقعی یعنی «تعیین نشده» → null */
    normalize: (value) => (typeof value === 'string' && value.trim() === '' ? null : (typeof value === 'string' ? value.trim() : value)),
    check: (value) => {
      if (typeof value !== 'string') return error('type', 'مُهر زمانی باید رشتهٔ ISO باشد.');
      if (dateOnly ? !DATE_ONLY.test(value) : !ISO_8601.test(value)) return error('format', 'قالب ISO 8601 درست نیست.');
      if (Number.isNaN(Date.parse(value))) return error('format', 'تاریخ قابل تجزیه نیست.');
      return null;
    },
  });
}

/** مُهر زمانی به‌صورت epoch میلی‌ثانیه (عدد صحیح نامنفی). */
export function epoch({ nullable = false } = {}) {
  return base({
    kind: 'epoch',
    nullable,
    description: 'مُهر زمانی epoch میلی‌ثانیه',
    check: (value) => {
      if (typeof value !== 'number') return error('type', 'مُهر زمانی epoch باید عدد باشد.');
      if (!Number.isFinite(value)) return error('not_finite', 'مقدار باید متناهی باشد.');
      if (!Number.isInteger(value)) return error('integer', 'باید عدد صحیح باشد.');
      if (value < 0) return error('min', 'مُهر زمانی نمی‌تواند منفی باشد.');
      return null;
    },
  });
}

/* ─────────────────────────── آرایه ─────────────────────────── */

/**
 * آرایه.
 *
 * اعتبارسنجی اعضا کار `validator.js` است (`collectField` روی `item` می‌چرخد)؛
 * این تابع فقط «آرایه‌بودن»، طول و یکتایی را می‌سنجد.
 *
 * @param {object} item توصیف‌گر اعضای آرایه
 * @param {{min?:number,max?:number,unique?:boolean,uniqueBy?:string,nullable?:boolean}} options
 */
export function arr(item, { min = 0, max = 200, unique = false, uniqueBy = null, nullable = false } = {}) {
  return base({
    kind: 'array',
    nullable,
    item,
    description: 'آرایه',
    check: (value) => {
      if (!Array.isArray(value)) return error('type', 'باید آرایه باشد.');
      if (value.length < min) return error('min', `حداقل ${min} عضو لازم است.`);
      if (value.length > max) return error('max', `حداکثر ${max} عضو مجاز است.`);
      if (unique || uniqueBy) {
        const seen = new Set();
        for (const member of value) {
          const key = uniqueBy ? member?.[uniqueBy] : member;
          if (key === undefined || key === null) continue;
          if (seen.has(key)) return error('duplicate', `عضو تکراری «${key}» در آرایه مجاز نیست.`);
          seen.add(key);
        }
      }
      return null;
    },
  });
}

/** آرایهٔ رشته‌ای ساده (تگ، برچسب، شناسهٔ مرتبط). */
export function strArray({ max = 60, itemMax = 120, unique = true, min = 0, nullable = false } = {}) {
  return arr(str({ max: itemMax, allowEmpty: false }), { max, unique, min, nullable });
}

/* ─────────────────────────── آبجکت ─────────────────────────── */

/**
 * آبجکت با شکل مشخص.
 *
 * ⚠️ `fields` و `allowUnknown` **باید** روی توصیف‌گر بمانند؛ وگرنه موتور
 * اعتبارسنجی شکل آبجکت را نمی‌بیند و همهٔ کلیدها را «ناشناخته» می‌داند.
 *
 * @param {Record<string, object>} shape
 * @param {{allowUnknown?:boolean,nullable?:boolean}} options
 */
export function obj(shape, { allowUnknown = false, nullable = false } = {}) {
  return base({
    kind: 'object',
    nullable,
    fields: shape,
    allowUnknown,
    description: 'آبجکت ساخت‌یافته',
    check: (value) => (isPlainObject(value) ? null : error('type', 'باید آبجکت باشد.')),
  });
}

/** آبجکت آزاد (metadata) — کلیدها باز، ولی نوع آبجکت و سقف اندازه الزامی. */
export function json({ maxKeys = 60, nullable = false } = {}) {
  return base({
    kind: 'json',
    nullable,
    description: 'آبجکت با کلیدهای باز',
    check: (value) => {
      if (!isPlainObject(value)) return error('type', 'باید آبجکت باشد.');
      if (Object.keys(value).length > maxKeys) return error('max', `حداکثر ${maxKeys} کلید مجاز است.`);
      return null;
    },
  });
}

/** نگاشت آزاد `کلید → مقدار` — مثل `unitsByModule` یا `answers`. */
export function mapOf(valueDescriptor = null, { maxKeys = 100000, nullable = false } = {}) {
  return base({
    kind: 'object',
    nullable,
    fields: {},
    allowUnknown: true,
    item: valueDescriptor,
    description: 'نگاشت آزاد کلید → مقدار',
    check: (value) => {
      if (!isPlainObject(value)) return error('type', 'باید نگاشت آبجکت باشد.');
      if (Object.keys(value).length > maxKeys) return error('max', `حداکثر ${maxKeys} کلید مجاز است.`);
      return null;
    },
  });
}

/* ─────────────────────────── ارجاع (Relation) ─────────────────────────── */

/**
 * ارجاع به Entity دیگر.
 *
 * @param {string} entity نام مجموعهٔ والد (مثلاً 'categories')
 * @param {{nullable?:boolean, soft?:boolean, sentinels?:string[], field?:string}} options
 *   - `soft`: ارجاع نرم است؛ نبودِ والد فقط WARN می‌دهد نه ERROR (لاگ تاریخی).
 *   - `sentinels`: مقادیر ویژه‌ای که «بدون ارجاع» معنا می‌دهند (مثل `system`).
 *   - `field`: نام فیلد کلید در والد (پیش‌فرض `id`).
 */
export function ref(entity, { nullable = true, soft = false, sentinels = [], field = 'id' } = {}) {
  return base({
    kind: 'ref',
    nullable,
    description: `ارجاع به ${entity}.${field}`,
    meta: { entity, soft, sentinels, field },
    check: (value, ctx) => {
      if (typeof value !== 'string' || value === '') return error('type', 'ارجاع باید شناسهٔ رشته‌ای باشد.');
      if (sentinels.includes(value)) return null;
      if (!ctx?.refExists) return null;
      if (!ctx.refExists(entity, value, field)) return error('not_found', `${entity} با شناسهٔ «${value}» پیدا نشد.`);
      return null;
    },
  });
}

/* ─────────────────────────── اتحاد ─────────────────────────── */

/** مقدار می‌تواند یکی از چند نوع باشد. */
export function union(variants, { nullable = false } = {}) {
  return base({
    kind: 'union',
    nullable,
    variants,
    description: 'یکی از چند نوع',
    check: (value) => {
      for (const variant of variants) {
        if (!variant.check(value, {})) return null;
      }
      return error('type', 'مقدار با هیچ‌یک از انواع مجاز نمی‌خواند.');
    },
  });
}

/* ─────────────────────────── کمکی‌های توصیف‌گر ─────────────────────────── */

/** توصیف‌گر را تغییرناپذیر علامت می‌زند. */
export function immutable(descriptor) {
  return { ...descriptor, immutable: true };
}

/** توصیف‌گر را «فقط سرور» علامت می‌زند — از ورودی Client پذیرفته نمی‌شود. */
export function serverOnly(descriptor) {
  return { ...descriptor, protected: true };
}

/** توصیف‌گر را «راز» علامت می‌زند — در خروجی عمومی هرگز نمی‌آید. */
export function secret(descriptor) {
  return { ...descriptor, secret: true, protected: true };
}

/** فیلد اختیاری. */
export function optional(descriptor) {
  return { ...descriptor, required: false };
}

/** فیلد الزامی. */
export function required(descriptor) {
  return { ...descriptor, required: true };
}

/** مقدار پیش‌فرض. */
export function withDefault(descriptor, value) {
  return { ...descriptor, default: value };
}

/** توضیح انسانی. */
export function describe(descriptor, description) {
  return { ...descriptor, description };
}

/** مقدار `null` مجاز. */
export function nullable(descriptor) {
  return { ...descriptor, nullable: true };
}

/**
 * تابع نرمال‌سازی تازه روی توصیف‌گر سوار می‌کند (بعد از نرمال‌سازی خودِ نوع).
 *
 * ⚠️ مرز بند ۵۳: این فقط تبدیل **بازنمایی** است (ارقام فارسی → لاتین، فاصلهٔ
 * اضافی). تبدیل مقدار نامعتبر به مقدار ساختگی («abc» → 0) تعمیر است و ممنوع.
 */
export function normalized(descriptor, fn) {
  const base = typeof descriptor.normalize === 'function' ? descriptor.normalize : (value) => value;
  return { ...descriptor, normalize: (value) => fn(base(value)) };
}

export { ISO_8601, DATE_ONLY, HEX_COLOR, isPlainObject };
