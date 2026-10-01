/*
 * موتور اعتبارسنجی Schema.
 *
 * سه پرسش جدا که این فایل پاسخ می‌دهد (بند ۳۴):
 *   • Schema Validation  — «این مقدار چه شکلی دارد؟»   → همین فایل
 *   • Domain Validation  — «این عملیات منطقاً مجاز است؟» → `relations.js` + توابع دامنه
 *   • Integrity          — «بین Entityها یکپارچه است؟»  → `scripts/data-integrity.mjs`
 *
 * ── حالت‌های اعتبارسنجی (mode) ──────────────────────────────────────────────
 *   stored  رکوردی که از دیسک خوانده شده — سازگار با گذشته، سخت‌گیر نیست روی
 *           فیلدهای ناشناخته (WARN نه ERROR) تا دادهٔ موجود بی‌دلیل «خراب»
 *           اعلام نشود.
 *   create  ورودی ساخت رکورد — سخت‌گیر: فیلد ناشناخته ERROR، فیلد محافظت‌شده
 *           ERROR، فیلد الزامی باید باشد، Default درج می‌شود.
 *   update  ورودی ویرایش جزئی — فقط فیلدهای ارسالی بررسی می‌شوند، فیلد
 *           تغییرناپذیر ERROR، Default دوباره اعمال نمی‌شود.
 *   public  خروجی عمومی — فقط برای بررسی نشت فیلد راز به کار می‌رود.
 *
 * ── شکل خروجی ──────────────────────────────────────────────────────────────
 *   { ok, errors: [{field, code, message}], warnings: [...] }
 *
 * و `toErrorFields(result)` همان نگاشت `{ title: 'required' }` را می‌سازد که
 * قرارداد موجود `adminApi.fail(code, message, fields)` انتظار دارد (بند ۵۴).
 * قرارداد موجود **تغییر نمی‌کند**؛ این لایه فقط پُرکنندهٔ همان `fields` است.
 */

import { isPlainObject } from './fields.js';

const EMPTY = { ok: true, errors: [], warnings: [] };

/* ─────────────────────────────── سیاست فیلد ناشناخته ─────────────────────────────── */

/**
 * فیلدهای سیستم که هرگز نباید از Client پذیرفته شوند (بند ۳۰ و ۳۲).
 * این فهرست در سطح موتور است تا همهٔ دامنه‌ها یکسان رفتار کنند.
 */
export const SYSTEM_PROTECTED_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
  'publishedAt', 'deletedAt', 'lastLoginAt', 'lastSentAt', 'seededAt',
  'passwordHash', 'password', 'token', 'botToken', 'apiToken', 'oauthSecret',
  'sessionToken', 'csrfToken', 'secret', 'isSuperAdmin', 'permissions', 'role',
  'score', 'rank', 'reward', 'stats', 'metrics', 'views', 'likes',
]);

/**
 * دامنه‌هایی که سیاستشان «رد فیلد ناشناخته» است، نه «حذف».
 * دلیل: این‌ها ورودی‌های امنیت‌محور یا شمارنده‌های اعتباری‌اند؛ پذیرش بی‌سروصدای
 * یک کلید اضافه می‌تواند به ارتقای اختیار یا دستکاری آمار منتهی شود.
 */
export const STRICT_UNKNOWN_FIELD_ENTITIES = new Set([
  'admin', 'user', 'session', 'examAttempt', 'examReport', 'testBankAnswer',
  'testBankHeartReward', 'mediaAccount', 'publishChannel', 'publishingSecret', 'settings',
]);

/* ─────────────────────────────── ابزار ─────────────────────────────── */

function makeContext({ collections = null, path = [], recurse = null, refExists = null } = {}) {
  return {
    collections,
    path,
    recurse,
    refExists: refExists ?? (collections ? makeRefLookup(collections) : null),
  };
}

/** جست‌وجوی ارجاع در مجموعه‌های در دسترس. `collections` نگاشت نام → آرایه. */
function makeRefLookup(collections) {
  const index = new Map();
  return (entity, value, field = 'id') => {
    if (!index.has(entity)) {
      const rows = collections?.[entity];
      index.set(entity, Array.isArray(rows) ? new Set(rows.map((row) => row?.[field]).filter(Boolean)) : null);
    }
    const set = index.get(entity);
    if (!set) return true; /* مجموعه در دسترس نیست → ارجاع تأییدنشده، خطا نمی‌دهیم */
    return set.has(value);
  };
}

/* ─────────────────────────── اعتبارسنجی یک فیلد ─────────────────────────── */

function checkField(field, value, context) {
  if (value === null) {
    return field.nullable ? null : { code: 'null', message: 'مقدار null مجاز نیست.' };
  }
  if (value === undefined) return null;
  return field.check(value, context) ?? null;
}

/** اعتبارسنجی بازگشتی برای آبجکت‌ها. */
function recurseInto(schema, value, path, context) {
  const errors = [];
  const fields = schema.fields ?? {};
  const allowUnknown = schema.allowUnknown === true;

  for (const [key, field] of Object.entries(fields)) {
    const present = Object.hasOwn(value, key);
    if (!present) {
      if (field.required) errors.push({ field: [...path, key].join('.'), code: 'required', message: 'فیلد الزامی است.' });
      continue;
    }
    const fieldErrors = collectField(field, value[key], [...path, key], context);
    errors.push(...fieldErrors);
  }

  if (!allowUnknown) {
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(fields, key)) {
        errors.push({ field: [...path, key].join('.'), code: 'unknown_field', message: 'فیلد ناشناخته.' });
      }
    }
  }
  return errors.length ? errors : null;
}

/** اعتبارسنجی یک مقدار با در نظر گرفتن آرایه و آبجکت تودرتو. */
function collectField(field, value, path, context) {
  const errors = [];
  const nestedContext = { ...context, path, recurse: (nestedSchema, nestedValue, nestedPath) => {
    if (nestedSchema.kind === 'object') return recurseInto(nestedSchema, nestedValue, nestedPath, context);
    return null;
  } };

  if (field.kind === 'array') {
    if (value !== null && value !== undefined && !Array.isArray(value)) {
      return [{ field: path.join('.'), code: 'type', message: 'باید آرایه باشد.' }];
    }
    if (Array.isArray(value)) {
      const own = field.check(value, nestedContext);
      if (own) errors.push({ field: path.join('.'), code: own.code, message: own.message });
      else if (field.item) {
        value.forEach((member, index) => {
          const memberErrors = collectField(field.item, member, [...path, String(index)], context);
          errors.push(...memberErrors);
        });
      }
    }
    return errors;
  }

  if (field.kind === 'object') {
    if (value !== null && value !== undefined && !isPlainObject(value)) {
      return [{ field: path.join('.'), code: 'type', message: 'باید آبجکت باشد.' }];
    }
    if (isPlainObject(value)) {
      const nested = recurseInto(field, value, path, context);
      if (nested) errors.push(...nested);
    }
    return errors;
  }

  /* ── اتحاد تفکیک‌شده (بلوک محتوا، گزینه‌های سؤال) ── */
  if (field.kind === 'discriminated') {
    if (!isPlainObject(value)) {
      return [{ field: path.join('.'), code: 'type', message: 'باید آبجکت باشد.' }];
    }
    const tag = value[field.discriminator];
    if (typeof tag !== 'string' || !tag) {
      return [{ field: [...path, field.discriminator].join('.'), code: 'required', message: 'کلید تفکیک‌کننده الزامی است.' }];
    }
    const variant = field.variants?.[tag];
    if (!variant) {
      const entry = { field: path.join('.'), code: 'unknown_variant', message: `نوع «${tag}» ناشناخته است.` };
      return field.variantsUnknownIsError ? [entry] : [];
    }
    const variantErrors = [];
    for (const key of variant.requiredKeys ?? []) {
      if (!Object.hasOwn(value, key)) {
        variantErrors.push({ field: [...path, key].join('.'), code: 'required', message: `فیلد الزامی نوع «${tag}».` });
      }
    }
    for (const key of variant.arrayKeys ?? []) {
      if (Object.hasOwn(value, key) && !Array.isArray(value[key])) {
        variantErrors.push({ field: [...path, key].join('.'), code: 'type', message: 'باید آرایه باشد.' });
      }
    }
    return variantErrors;
  }

  const own = checkField(field, value, nestedContext);
  if (own) errors.push({ field: path.join('.'), code: own.code, message: own.message });
  return errors;
}

/* ─────────────────────────── ورودی عمومی ─────────────────────────── */

/**
 * اعتبارسنجی یک رکورد.
 *
 * @param {object} schema توصیف‌گر Entity: `{ name, fields, allowUnknown?, transitions?, unique? }`
 * @param {object} record رکورد یا ورودی
 * @param {{mode?: 'stored'|'create'|'update'|'public', collections?: object,
 *          previous?: object, checkUnique?: boolean}} options
 *
 * ⚠️ `checkUnique` پیش‌فرض **خاموش** است. دلیل: بررسی یکتایی به فهرست کامل
 * مجموعه نیاز دارد و رکورد در حال بررسی هم عضوی از همان فهرست است؛ اگر
 * مقایسه با مرجع انجام نشود، هر رکورد با خودش «تکراری» اعلام می‌شود.
 * بررسی یکتایی دادهٔ ذخیره‌شده کار اختصاصی اسکنر است
 * (`scripts/data-integrity.mjs`، بخش «قیدهای یکتایی») که فهرست را یک‌جا
 * می‌بیند. برای ورودی‌های تازه (`create`/`update`) می‌توان آن را روشن کرد.
 */
export function validateRecord(schema, record, { mode = 'stored', collections = null, previous = null, checkUnique = false } = {}) {
  if (!isPlainObject(record)) {
    return { ok: false, errors: [{ field: '', code: 'type', message: 'رکورد باید آبجکت باشد.' }], warnings: [] };
  }

  const errors = [];
  const warnings = [];
  const strictUnknown = mode === 'create' || STRICT_UNKNOWN_FIELD_ENTITIES.has(schema.name);
  const context = makeContext({ collections });

  for (const [key, field] of Object.entries(schema.fields ?? {})) {
    const present = Object.hasOwn(record, key);

    if (!present) {
      if (mode === 'create') {
        if (field.required) errors.push({ field: key, code: 'required', message: 'فیلد الزامی است.' });
        continue;
      }
      if (mode === 'stored' && field.required) {
        errors.push({ field: key, code: 'required', message: 'فیلد الزامی است.' });
      }
      continue;
    }

    const value = record[key];

    /* ── فیلد محافظت‌شده در ورودی Client ── */
    if ((mode === 'create' || mode === 'update') && field.protected) {
      errors.push({ field: key, code: 'protected_field', message: 'این فیلد فقط توسط سرور مقدار می‌گیرد.' });
      continue;
    }

    /* ── فیلد تغییرناپذیر در ویرایش ── */
    if (mode === 'update' && field.immutable && previous && Object.hasOwn(previous, key) && previous[key] !== value) {
      errors.push({ field: key, code: 'immutable', message: 'این فیلد پس از ساخت تغییرناپذیر است.' });
      continue;
    }

    errors.push(...collectField(field, value, [key], context));
  }

  /* ── فیلدهای ناشناخته ── */
  for (const key of Object.keys(record)) {
    if (Object.hasOwn(schema.fields ?? {}, key)) continue;
    if (SYSTEM_PROTECTED_FIELDS.has(key)) {
      errors.push({ field: key, code: 'unknown_field', message: 'فیلد ناشناخته یا محافظت‌شده.' });
      continue;
    }
    const entry = { field: key, code: 'unknown_field', message: 'فیلد در Schema این Entity تعریف نشده.' };
    if (strictUnknown) errors.push(entry);
    else warnings.push(entry);
  }

  /* ── یکتایی (اختیاری — به‌طور پیش‌فرض خاموش؛ اسکنر مرجع است) ── */
  if (checkUnique && collections && Array.isArray(schema.unique)) {
    for (const constraint of schema.unique) {
      const violation = checkUnique(schema, constraint, record, collections);
      if (violation) errors.push(violation);
    }
  }

  /* ── گذار وضعیت ── */
  if (mode === 'update' && previous && schema.transitions) {
    const violation = checkTransition(schema, previous, record);
    if (violation) errors.push(violation);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/* ─────────────────────────── یکتایی ─────────────────────────── */

/**
 * بررسی قید یکتایی.
 * @param {{fields: string[], scope?: string, caseInsensitive?: boolean, ignoreEmpty?: boolean}} constraint
 */
export function checkUnique(schema, constraint, record, collections) {
  const rows = collections?.[schema.collection ?? schema.name];
  if (!Array.isArray(rows)) return null;

  const keys = constraint.fields.map((f) => {
    const value = record?.[f];
    return constraint.caseInsensitive && typeof value === 'string' ? value.toLowerCase() : value;
  });

  if (constraint.ignoreEmpty !== false && keys.some((v) => v === undefined || v === null || v === '')) return null;

  for (const row of rows) {
    if (row === record) continue;
    if (constraint.scope && row?.[constraint.scope] !== record?.[constraint.scope]) continue;
    if (schema.identityField && row?.[schema.identityField] !== undefined
      && row[schema.identityField] === record[schema.identityField]) continue;

    const rowKeys = constraint.fields.map((f) => {
      const value = row?.[f];
      return constraint.caseInsensitive && typeof value === 'string' ? value.toLowerCase() : value;
    });
    if (rowKeys.every((value, index) => value === keys[index])) {
      return {
        field: constraint.fields.join('+'),
        code: 'duplicate',
        message: `مقدار تکراری برای قید یکتای ${constraint.fields.join(' + ')}.`,
      };
    }
  }
  return null;
}

/* ─────────────────────────── گذار وضعیت ─────────────────────────── */

/** @param {{field:string, machine:string}} transitions */
function checkTransition(schema, previous, patch) {
  const { field, machine } = schema.transitions;
  if (!Object.hasOwn(patch, field)) return null;
  const from = previous?.[field];
  const to = patch[field];
  if (from === undefined || to === undefined || from === to) return null;

  const tables = schema.transitionTables ?? {};
  const table = tables[machine];
  if (!table) return null;
  const allowed = table[from];
  if (!Array.isArray(allowed) || !allowed.includes(to)) {
    return { field, code: 'invalid_transition', message: `گذار از «${from}» به «${to}» مجاز نیست.` };
  }
  return null;
}

/* ─────────────────────────── نگاشت به قرارداد API ─────────────────────────── */

/**
 * `errors` را به نگاشت `{ field: code }` تبدیل می‌کند — همان چیزی که
 * `adminApi.fail('VALIDATION_ERROR', message, fields)` می‌پذیرد.
 * اگر چند خطا روی یک فیلد باشد، اولین کد برنده است (پایدار و قطعی).
 */
export function toErrorFields(result) {
  const fields = {};
  for (const entry of result?.errors ?? []) {
    if (!entry?.field) continue;
    if (!Object.hasOwn(fields, entry.field)) fields[entry.field] = entry.code;
  }
  return fields;
}

/** خلاصهٔ یک‌خطی فارسی برای پیام خطا. */
export function summarize(result) {
  const first = result?.errors?.[0];
  if (!first) return '';
  return first.field ? `${first.field}: ${first.message}` : first.message;
}

/**
 * اعتبارسنجی و پرتاب خطا با قرارداد موجود پروژه.
 * سرور می‌تواند مستقیم این را صدا بزند تا مسیر خطا یکدست بماند.
 * `checkUnique` اینجا پیش‌فرض **روشن** است چون ورودی همیشه تازه است.
 */
export function assertValid(schema, record, options = {}) {
  const result = validateRecord(schema, record, { checkUnique: true, ...options });
  if (result.ok) return result;
  const error = new Error(summarize(result) || 'دادهٔ ورودی معتبر نیست.');
  error.code = 'VALIDATION_ERROR';
  error.fields = toErrorFields(result);
  throw error;
}

/* ─────────────────────────── سریال‌سازی ─────────────────────────── */

/**
 * حذف فیلدهای راز از یک رکورد (بند ۵۶).
 * این تابع در مسیر خروجی صدا زده می‌شود؛ `secret: true` روی توصیف‌گر یعنی
 * «هرگز از سرور بیرون نمی‌رود»، مستقل از اینکه کدام endpoint داده را می‌فرستد.
 */
export function stripSecrets(schema, record) {
  if (!isPlainObject(record)) return record;
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    const field = schema.fields?.[key];
    if (field?.secret) continue;
    out[key] = value;
  }
  return out;
}

/** فهرست نام فیلدهای راز یک Schema — برای تست نشت. */
export function secretFieldNames(schema) {
  return Object.entries(schema.fields ?? {})
    .filter(([, field]) => field?.secret)
    .map(([key]) => key);
}

/** فهرست نام فیلدهای محافظت‌شده (سرورساخته). */
export function protectedFieldNames(schema) {
  return Object.entries(schema.fields ?? {})
    .filter(([, field]) => field?.protected)
    .map(([key]) => key);
}

/** پر کردن Defaultها روی یک ورودی ساخت (بدون تغییر ورودی اصلی). */
export function applyDefaults(schema, input) {
  const out = { ...input };
  for (const [key, field] of Object.entries(schema.fields ?? {})) {
    if (Object.hasOwn(out, key)) continue;
    if (field.default === undefined) continue;
    out[key] = typeof field.default === 'function' ? field.default() : field.default;
  }
  return out;
}

export { EMPTY, makeContext };
