/*
 * قواعد یکپارچگی داده — تابع‌های **خالص** روی رکوردهای در حافظه.
 *
 * چرا جدا از اسکنر: این قواعد باید هم در `scripts/data-integrity.mjs` و هم در
 * تست (`database/dataIntegrity.test.mjs`) قابل فراخوانی باشند. اگر داخل اسکنر
 * می‌ماندند، تست مجبور بود همان منطق را **کپی** کند و آن‌وقت تست چیزی را
 * اثبات نمی‌کرد جز هم‌خوانی دو نسخه از یک کد.
 *
 * ⚠️ هیچ‌کدام از این تابع‌ها داده را تغییر نمی‌دهند و چیزی نمی‌نویسند.
 *
 * تفکیک مسئولیت (بند ۳۴):
 *   Schema Validation → `validator.js`        «این مقدار چه شکلی دارد؟»
 *   Integrity         → همین فایل            «بین Entityها یکپارچه است؟»
 */

/* ─────────────────────────── هویت رکورد ─────────────────────────── */

/**
 * نبودِ شناسه و شناسهٔ تکراری در یک مجموعه.
 *
 * @param {{name:string, identityField?:string}} schema
 * @param {object[]} records
 * @returns {{missing: number[], duplicates: {value:string, count:number}[]}}
 */
export function findIdentityIssues(schema, records) {
  const missing = [];
  const duplicates = [];
  if (!schema?.identityField) return { missing, duplicates };

  const counts = new Map();
  records.forEach((record, index) => {
    const value = record?.[schema.identityField];
    if (value === undefined || value === null || value === '') {
      missing.push(index);
      return;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  for (const [value, count] of counts) {
    if (count > 1) duplicates.push({ value, count });
  }
  return { missing, duplicates };
}

/* ─────────────────────────── قیدهای یکتایی ─────────────────────────── */

/** کلید مقایسهٔ یک قید برای یک رکورد؛ `null` یعنی «خالی — نادیده بگیر». */
export function uniqueKeyOf(constraint, record) {
  const parts = (constraint?.fields ?? []).map((field) => {
    const value = record?.[field];
    return constraint?.caseInsensitive && typeof value === 'string' ? value.toLowerCase() : value;
  });
  if (constraint?.ignoreEmpty !== false && parts.some((v) => v === undefined || v === null || v === '')) {
    return null;
  }
  return parts;
}

/**
 * نقض قیدهای یکتایی (ساده و ترکیبی) روی یک مجموعه.
 *
 * ⚠️ این تابع **فهرست کامل** را می‌بیند، پس «تکرار با خودش» رخ نمی‌دهد.
 * بررسی یکتایی در `validator.checkUnique` برای ورودی تازه است و آنجا مقایسه
 * با مرجع (`row === record`) لازم است؛ اینجا لازم نیست.
 *
 * @returns {{constraint: string[], key: string, count: number}[]}
 */
export function findUniqueViolations(schema, records) {
  const violations = [];

  for (const constraint of schema?.unique ?? []) {
    const seen = new Map();
    for (const record of records) {
      const parts = uniqueKeyOf(constraint, record);
      if (parts === null) continue;
      const key = parts.join('\u0000');
      if (!seen.has(key)) seen.set(key, 0);
      seen.set(key, seen.get(key) + 1);
    }
    for (const [key, count] of seen) {
      if (count > 1) violations.push({ constraint: constraint.fields, key, count });
    }
  }

  return violations;
}

/* ─────────────────────────── ارجاع‌ها ─────────────────────────── */

/**
 * یتیم‌های یک ارتباط: مقدار فیلد فرزند که در والد پیدا نمی‌شود.
 *
 * @param {{child:string, field:string, parent:string, parentField?:string,
 *          array?:boolean, required?:boolean, sentinels?:string[]}} relation
 * @param {object[]} childRows
 * @param {Set<string>} parentIds
 * @returns {{missing: string[], nulls: number}}
 */
export function findRelationOrphans(relation, childRows, parentIds) {
  const sentinels = new Set(relation?.sentinels ?? []);
  const parentField = relation?.parentField ?? 'id';
  const missing = [];
  let nulls = 0;

  const examine = (row, value) => {
    if (value === null || value === undefined || value === '') {
      nulls += 1;
      if (relation?.required) missing.push(`${row?.id ?? '?'} → null`);
      return;
    }
    if (sentinels.has(value)) return;
    if (!parentIds.has(value)) missing.push(`${row?.id ?? '?'} → ${value}`);
  };

  for (const row of childRows) {
    const value = row?.[relation?.field];
    if (relation?.array) {
      for (const item of Array.isArray(value) ? value : []) examine(row, item);
    } else {
      examine(row, value);
    }
  }

  void parentField;
  return { missing, nulls };
}

/* ─────────────────────────── شکل ذخیره‌سازی ─────────────────────────── */

/**
 * گاردِ شکل ذخیره‌سازی.
 *
 * ⚠️ خطرِ خاموش: اگر شکل اعلامی Schema با شکل واقعی فایل نخواند، خواننده
 * **صفر رکورد** برمی‌گرداند و کل مجموعه بی‌صدا از اسکن بیرون می‌افتد — بدون
 * هیچ خطایی. این همان «حذف بی‌صدای داده» است که بند ۵۳ ممنوع کرده.
 *
 * ⚠️ «مجموعهٔ خالیِ درست‌شکل» خطا نیست: `{"attempts": []}` یک دیتاست خالیِ
 * سالم است. معیار، **وجود و نوعِ ظرف** است نه تعداد رکورد.
 *
 * @returns {{code:string,message:string}|null}
 */
export function checkStorageShape(schema, container) {
  if (container === null || container === undefined) return null;

  const declared = schema?.storage ?? 'array';
  const isObject = typeof container === 'object' && !Array.isArray(container);
  const objectIsEmpty = isObject && Object.keys(container).length === 0;

  if (declared === 'array') {
    if (Array.isArray(container) || objectIsEmpty) return null;
  } else if (declared === 'keyed-array') {
    if (Array.isArray(container?.[schema.arrayKey]) || objectIsEmpty) return null;
  } else if (declared === 'keyed-object') {
    const source = schema.objectKey ? container?.[schema.objectKey] : container;
    const sourceIsMap = Boolean(source) && typeof source === 'object' && !Array.isArray(source);
    if (sourceIsMap || objectIsEmpty) return null;
  } else if (isObject) {
    /* singleton */
    return null;
  }

  const hint = declared === 'keyed-array' && schema.arrayKey
    ? ` (کلید انتظاری: «${schema.arrayKey}»)`
    : declared === 'keyed-object' && schema.objectKey
      ? ` (کلید انتظاری: «${schema.objectKey}»)`
      : '';
  const actual = Array.isArray(container)
    ? 'array'
    : `object ${JSON.stringify(Object.keys(container).slice(0, 6))}`;

  return {
    code: 'storage_shape_mismatch',
    message: `شکل واقعی فایل با شکل اعلامی Schema نمی‌خواند: اعلام‌شده «${declared}»${hint}`
      + ` ولی فایل «${actual}» است — کل مجموعه از اسکن بیرون می‌افتد.`,
  };
}

/**
 * استخراج رکوردها از یک ظرف با شکل اعلامی Schema.
 *
 * چرا این تابع جدا و **خالص** است: این منطق در سه جای مختلف لازم می‌شود
 * (اسکنر یکپارچگی، اسکنر تعمیر، و ناظر مسیر نوشتن). اگر در هر کدام کپی شود،
 * سه نسخه از یک قاعده ساخته می‌شود و همان چیزی می‌شود که خودِ این فاز
 * (بند ۴۸ — حذف منابع تکراری) می‌خواهد از بین ببرد.
 *
 * ⚠️ در `keyed-object` **کلید به رکورد تزریق نمی‌شود** — کلید است، نه فیلد.
 * تزریقش باعث «فیلد ناشناخته» و «نشت راز» کاذب می‌شود. کلیدها جدا برمی‌گردند.
 *
 * ⚠️ ظرفِ ناهم‌شکل (`null`، رشته، آرایه در جای نگاشت) به «صفر رکورد» تبدیل
 * می‌شود و **استثنا پرتاب نمی‌کند**؛ تشخیص ناهم‌شکلی کارِ `checkStorageShape`
 * است. این تابع فقط می‌خواند.
 *
 * @param {{storage?:string, arrayKey?:string, objectKey?:string}} schema
 * @param {unknown} container
 * @returns {{records: object[], keys: string[]}}
 */
export function recordsFromContainer(schema, container) {
  const declared = schema?.storage ?? 'array';

  if (declared === 'array') {
    return { records: Array.isArray(container) ? container : [], keys: [] };
  }

  if (declared === 'keyed-array') {
    const rows = container?.[schema.arrayKey];
    return { records: Array.isArray(rows) ? rows : [], keys: [] };
  }

  if (declared === 'keyed-object') {
    const raw = schema.objectKey ? container?.[schema.objectKey] : container;
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const entries = Object.entries(source);
    return { records: entries.map(([, value]) => value ?? {}), keys: entries.map(([key]) => key) };
  }

  /* singleton */
  return {
    records: container && typeof container === 'object' && !Array.isArray(container) ? [container] : [],
    keys: [],
  };
}

/* ─────────────────────────── نشت راز ─────────────────────────── */

/** نام‌هایی که اگر در مجموعه‌ای باشند و `secret` علامت نخورده باشند، نشت‌اند. */
export const KNOWN_SECRET_NAMES = Object.freeze([
  'passwordHash', 'token', 'botToken', 'apiToken', 'oauthSecret',
  'sessionToken', 'csrfToken', 'appSecret',
]);

/**
 * نشت فیلد راز در سطح **مدل**: مجموعه‌ای فیلد رازی دارد که Schema خودش
 * راز علامتش نکرده. این با «راز در پاسخ API» فرق دارد؛ آن یکی کار RBAC است.
 *
 * @param {object[]} schemas
 * @param {Record<string, object[]>} collections
 * @param {(schema: object) => string[]} secretNamesOf
 * @returns {string[]} فهرست `entity.field`
 */
export function findSecretLeaks(schemas, collections, secretNamesOf) {
  const findings = [];

  for (const schema of schemas) {
    if (schema.sensitiveFile) continue;
    const declared = new Set(secretNamesOf(schema));
    const rows = collections?.[schema.collection ?? schema.name] ?? [];

    const keys = new Set();
    for (const row of rows) {
      if (row && typeof row === 'object') for (const key of Object.keys(row)) keys.add(key);
    }

    for (const key of keys) {
      if (!KNOWN_SECRET_NAMES.includes(key)) continue;
      if (declared.has(key)) continue;
      findings.push(`${schema.name}.${key}`);
    }
  }

  return findings;
}

/* ─────────────────────────── کلید ذخیره‌سازی ─────────────────────────── */

/**
 * در ذخیره‌سازی نگاشتی، **کلید** خودش هویت رکورد است. پس قالب کلید هم باید
 * اعتبارسنجی شود — کاری که اعتبارسنجی فیلدها نمی‌تواند بکند.
 * (مثال: توکن نشست کاربر باید ۶۴ نویسهٔ hex باشد.)
 *
 * @returns {string[]} کلیدهای نامعتبر
 */
export function findStorageKeyIssues(schema, keys) {
  if (!schema?.keyIsIdentity || schema.storage !== 'keyed-object') return [];
  const pattern = schema.keyPattern ?? /^[0-9a-f]{64}$/;
  return keys.filter((key) => !pattern.test(key));
}
