/*
 * پل اعتبارسنجی ورودی API ↔ Schemaهای فاز ۶ — فاز ۷.
 *
 * قرارداد فاز ۶ (`database/models/`) تا امروز فقط در اسکنر و تست مصرف می‌شد؛
 * هیچ مسیر نوشتنی آن را به‌عنوان **دروازه** صدا نمی‌زد (بدهی ثبت‌شده: ۰ از
 * ۱۱۷ مسیر). این ماژول همان دروازه را در دسترس مرز API می‌گذارد، **بدون**
 * تغییر قرارداد خطای موجود: خطای پرتاب‌شده همان
 * `{ code: 'VALIDATION_ERROR', fields }` است که `fail()` انتظار دارد.
 */

import { getModel, validateEntity, validateRecord, toErrorFields, summarize } from '../models/index.js';

/** نگاشت نام مسیر/دامنه → نام Entity در رجیستری مدل. */
export const ENTITY_BY_ROUTE_DOMAIN = Object.freeze({
  articles: 'article',
  categories: 'category',
  banners: 'banner',
  pages: 'page',
  references: 'reference',
  flashcards: 'flashcardDeck',
  'micro-courses': 'microCourse',
  'comprehensive-courses': 'comprehensiveCourse',
  'intl-providers': 'intlProvider',
  'intl-courses': 'intlCourse',
  'test-bank': 'testBankQuestion',
  notes: 'note',
  admins: 'admin',
  users: 'user',
  /* ⚠ `media` عمداً نگاشت نشده: مسیرهای پنل روی ۱۱ Entity مختلف رسانه
     (`mediaAccount`/`mediaContent`/`mediaAsset`/…) کار می‌کنند و نگاشت
     یک‌به‌یک از نام دامنه قابل‌اثبات نیست ⇒ UNKNOWN (بند ۵). */
});

/**
 * اعتبارسنجی ورودی یک Entity با Schema فاز ۶.
 *
 * @param {string} entityName نام Entity در `database/models`
 * @param {object} body بدنهٔ درخواست (پس از parse)
 * @param {{mode?: 'create'|'update'|'patch'|'stored', collections?: object, previous?: object}} options
 * @returns {{ok: boolean, errors: object[], warnings: object[], fields: object}}
 */
export function validateInput(entityName, body, { mode = 'create', collections = null, previous = null } = {}) {
  const schema = getModel(entityName);
  if (!schema) {
    return {
      ok: false,
      errors: [{ field: '', code: 'unknown_entity', message: `Entity «${entityName}» شناخته‌شده نیست.` }],
      warnings: [],
      fields: {},
    };
  }

  /* `patch` = زیرمجموعهٔ اختیاری؛ در مدل معادل `update` بدون الزام فیلدها است. */
  const result = validateEntity(entityName, body, { mode: mode === 'patch' ? 'update' : mode, collections, previous });
  return { ...result, fields: toErrorFields(result) };
}

/**
 * همان `validateInput` ولی خطا **پرتاب** می‌کند — سازگار با `fail()` موجود.
 * @throws {Error & {code: 'VALIDATION_ERROR', fields: object}}
 */
export function assertInputValid(entityName, body, options = {}) {
  const result = validateInput(entityName, body, options);
  if (result.ok) return result;

  const error = new Error(summarize(result) || 'دادهٔ ورودی معتبر نیست.');
  error.code = 'VALIDATION_ERROR';
  error.fields = result.fields;
  throw error;
}

/** اعتبارسنجی مستقیم با یک Schema (برای مسیرهایی که نام Entity ندارند). */
export function validateWithSchema(schema, body, options = {}) {
  const result = validateRecord(schema, body, options);
  return { ...result, fields: toErrorFields(result) };
}
