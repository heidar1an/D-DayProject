/*
 * دروازهٔ قرارداد ورودی — فاز ۴.
 *
 * مسئله‌ای که حل می‌کند: لایهٔ `apiContract/input.js` ساخته شده بود ولی هیچ
 * مسیر نوشتنی آن را صدا نمی‌زد (بدهی ثبت‌شده: ۲ از ۱۱۷). یعنی اعتبارسنجی فقط
 * «وجود داشت»، نه «اجرا می‌شد».
 *
 * این ماژول **تک نقطهٔ اجرا** است: در مرکز دیسپچ پنل، بعد از خواندن بدنه و
 * **پیش از** منطق کسب‌وکار. سه رفتار:
 *
 *   ۱. مسیری که در رجیستری نیست ⇒ خطا. این fail-closed است: مسیر نوشتن تازه
 *      بدون قرارداد، حتی اجرا هم نمی‌شود (و دروازهٔ CI هم قبل‌تر می‌گیرد).
 *   ۲. بدنهٔ غیر‌شیء (آرایه، رشته، null) ⇒ خطا با همان قرارداد خطای موجود.
 *   ۳. قرارداد `entity` ⇒ اعتبارسنجی با Schema مدل؛ قرارداد `object` ⇒ فقط
 *      ساختار؛ قرارداد `none` ⇒ هیچ (آپلود جریانی/عملیات بدون payload).
 *
 * ⚠️ قرارداد خطا **عوض نمی‌شود**: همان `{ code: 'VALIDATION_ERROR', fields }`
 * که `fail()` و `sendError` انتظار دارند. هیچ کد خطای تازه‌ای اضافه نمی‌شود تا
 * مدل مرکزی (`errorModel.js`) دست‌نخورده بماند.
 */

import { ROUTE_CONTRACTS } from './routeContracts.js';
import { assertInputValid } from './input.js';

/** قرارداد یک مسیر؛ `null` یعنی ثبت‌نشده. */
export function contractFor(method, pattern) {
  return ROUTE_CONTRACTS[`${method} ${pattern}`] ?? null;
}

/** شیء سادهٔ JSON (نه آرایه، نه null، نه رشته). */
export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validationError(message, fields = {}) {
  const error = new Error(message);
  error.code = 'VALIDATION_ERROR';
  error.fields = fields;
  return error;
}

/**
 * اجرای قرارداد ورودی یک مسیر نوشتن.
 *
 * @param {string} method متد HTTP
 * @param {string} pattern الگوی مسیر همان‌طور که در جدول ROUTES است
 * @param {unknown} body بدنهٔ parse‌شده
 * @param {{collections?: object|null, previous?: object|null}} options
 * @returns {{enforced: boolean, kind?: string, entity?: string}}
 * @throws {Error & {code: 'VALIDATION_ERROR', fields: object}}
 */
export function enforceInputContract(method, pattern, body, { collections = null, previous = null } = {}) {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return { enforced: false };

  const contract = contractFor(method, pattern);
  if (!contract) {
    /* fail-closed: نه «رد کن و ادامه بده»، نه «بی‌صدا بگذر». */
    throw validationError(`این مسیر قرارداد ورودی ثبت‌شده ندارد: ${method} ${pattern}`, { body: 'contract_missing' });
  }

  if (contract.kind === 'none') return { enforced: false, kind: 'none' };

  if (!isPlainObject(body)) {
    throw validationError('بدنهٔ درخواست باید یک شیء JSON باشد.', { body: 'invalid_type' });
  }

  if (contract.kind === 'object') return { enforced: true, kind: 'object' };

  assertInputValid(contract.entity, body, { mode: contract.mode, collections, previous });
  return { enforced: true, kind: 'entity', entity: contract.entity };
}
