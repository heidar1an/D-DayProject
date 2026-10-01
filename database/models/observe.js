/*
 * ناظر مسیر نوشتن — اعتبارسنجی روی مرز ذخیره‌سازی.
 *
 * ── جای این ماژول در معماری (بند ۶۲ — مرحلهٔ ۸) ──────────────────────────────
 *   مسیر خواندن → `scripts/data-integrity.mjs`   (اسکنر — همیشه فعال)
 *   مسیر نوشتن → همین ماژول                      (ناظر — اختیاری، پیش‌فرض خاموش)
 *
 * ── چرا «ناظر» و نه «دروازه» ────────────────────────────────────────────────
 * این ماژول **هیچ نوشتنی را رد نمی‌کند، استثنا پرتاب نمی‌کند و داده را تغییر
 * نمی‌دهد.** فقط گزارش می‌دهد.
 *
 * دلیل صریح: صورت‌مسئلهٔ این فاز گفته «رفتار عمومی endpointها را بدون ضرورت
 * تغییر نده». تبدیل این ناظر به دروازه (رد کردن نوشتن نامعتبر با
 * `VALIDATION_ERROR`) یک **تصمیم محصولی** است، نه یک بازآرایی فنی — چون
 * می‌تواند رفتار زندهٔ پنل را عوض کند. پس تا تأیید صریح کاربر، این ماژول
 * فقط می‌بیند و می‌گوید؛ جلوی چیزی را نمی‌گیرد.
 *
 * ── مرز دقیق مسئولیت (بند ۳۴) ───────────────────────────────────────────────
 * اینجا **شکل** سنجیده می‌شود، نه **ارجاع**:
 *   • Schema/شکل هر رکورد در لحظهٔ ذخیره            ✅ این ماژول
 *   • یکتایی و هویت روی همان مجموعهٔ در حال نوشتن    ✅ این ماژول
 *   • ارجاع‌های بین‌مجموعه‌ای (orphan)                 ❌ اسکنر — چون ناظر
 *     مجموعه‌های دیگر را در حافظه ندارد و `collections: null` عمداً یعنی
 *     «ارجاع تأییدنشده، خطا نده» (خط ۷۵ در `validator.js`).
 *     پس نبودِ ارجاع در گزارش این ماژول **دیده نمی‌شود** — نه اینکه تأیید شود.
 *
 * ── چرا پیش‌فرض خاموش است ───────────────────────────────────────────────────
 * اعتبارسنجی ۱۵۰۰ رکورد روی هر نوشتن هزینهٔ CPU دارد. در حالت خاموش، ناظر
 * حتی بارگذاری هم نمی‌شود. با `TAPESH_MODEL_OBSERVE=1` روشن می‌شود.
 */

import { MODELS_BY_COLLECTION, validateEntity } from './index.js';
import { domainNormalizersFor, normalizeRecord } from './normalizers.js';
import {
  checkStorageShape, findIdentityIssues, findUniqueViolations, recordsFromContainer,
} from './integrity.js';

/** نام متغیر محیطیِ روشن‌کننده. */
export const OBSERVE_ENV = 'TAPESH_MODEL_OBSERVE';

/** آیا ناظر روشن است؟ (خروجی صریح — تا در تست هم قابل استفاده باشد) */
export function observeEnabled(env = process.env) {
  return env?.[OBSERVE_ENV] === '1';
}

/* ─────────────────────── بازرسی یک نوشتن (بدون عارضهٔ جانبی) ─────────────────────── */

/**
 * یک ظرفِ در حال نوشتن را می‌سنجد و گزارش می‌دهد.
 *
 * ⚠️ کاملاً بدون عارضهٔ جانبی: نه می‌نویسد، نه تغییر می‌دهد، نه پرتاب می‌کند.
 * روی ورودی ناهم‌شکل (رشته، `null`، آرایه در جای نگاشت) هم پرتاب نمی‌کند؛
 * «صفر رکورد» و یک `storage_shape_mismatch` گزارش می‌دهد.
 *
 * @param {string} collection نام مجموعه — همان کلید `MODELS_BY_COLLECTION`
 * @param {unknown} container ظرفی که قرار است ذخیره شود (آرایه یا آبجکت)
 * @param {{mode?: 'stored'|'create'|'update'|'public', maxViolations?: number,
 *          normalize?: boolean}} [options]
 * @returns {{
 *   collection: string, known: boolean, entities: string[],
 *   shape: {entity: string, code: string, message: string}[],
 *   total: number, checked: number, normalizedFields: string[],
 *   recordViolations: object[], collectionIssues: object[],
 *   byCode: Record<string, number>, byEntity: Record<string, number>,
 *   truncated: boolean,
 * }}
 */
export function inspectWrite(collection, container, {
  mode = 'stored', maxViolations = 40, normalize = true,
} = {}) {
  const schemas = MODELS_BY_COLLECTION[collection] ?? [];

  const report = {
    collection,
    known: schemas.length > 0,
    entities: schemas.map((schema) => schema.name),
    shape: [],
    total: 0,
    checked: 0,
    normalizedFields: [],
    recordViolations: [],
    collectionIssues: [],
    byCode: {},
    byEntity: {},
    truncated: false,
  };

  /* مجموعه‌ای که Schema ندارد (مثلاً `settings` که singleton و بی‌نام است):
     سکوت می‌کنیم. «نبودِ Schema» خطای داده نیست؛ شکافِ پوشش است و در
     `schemaCoverage()` گزارش می‌شود، نه اینجا. */
  if (!schemas.length) return report;

  for (const schema of schemas) {
    /* ۱) شکل ظرف — گاردِ «حذف بی‌صدای کل مجموعه» */
    const shape = checkStorageShape(schema, container);
    if (shape) {
      report.shape.push({ entity: schema.name, code: shape.code, message: shape.message });
      report.collectionIssues.push({
        entity: schema.name, code: shape.code, message: shape.message, scope: 'shape',
      });
      bump(report.byCode, shape.code);
      continue;
    }

    /* ۲) استخراج رکوردها — منطق مشترک با اسکنر (`recordsFromContainer`) */
    const { records } = recordsFromContainer(schema, container);
    report.total += records.length;

    /* ۳) یکتایی و هویت روی همین مجموعه */
    const identity = findIdentityIssues(schema, records);
    for (const index of identity.missing) {
      report.collectionIssues.push({
        entity: schema.name,
        code: 'missing_identity',
        message: `رکورد #${index} فیلد هویت «${schema.identityField}» را ندارد.`,
        scope: 'identity',
      });
      bump(report.byCode, 'missing_identity');
    }
    for (const duplicate of identity.duplicates) {
      report.collectionIssues.push({
        entity: schema.name,
        code: 'duplicate_identity',
        message: `شناسهٔ «${duplicate.value}» در ${duplicate.count} رکورد تکرار شده.`,
        scope: 'identity',
      });
      bump(report.byCode, 'duplicate_identity');
    }
    for (const violation of findUniqueViolations(schema, records)) {
      report.collectionIssues.push({
        entity: schema.name,
        code: 'duplicate_unique',
        message: `قید یکتای (${violation.constraint.join(' + ')}) نقض شده: «${violation.key.replace(/\u0000/g, ' + ')}» در ${violation.count} رکورد.`,
        scope: 'unique',
      });
      bump(report.byCode, 'duplicate_unique');
    }

    /* ۴) شکل هر رکورد — با خط لولهٔ **normalize → validate** (بند ۱۷).
       ⚠️ ترتیب مهم است: `normalizers.js` صریح می‌گوید «normalize → validate →
       persist» و نه «validate raw → normalize later». اعتبارسنجی دادهٔ خام
       روی مقادیری مثل `startDate: ''` هفت خطای کاذب می‌سازد که خودِ نرمال‌سازی
       پروژه حلشان می‌کند. اسکنر هم دقیقاً همین ترتیب را دارد.

       `collections` عمداً پاس داده **نمی‌شود** ⇒ بررسی ارجاع انجام نمی‌شود
       و «ارجاع تأییدنشده» به‌جای خطای کاذب، نادیده می‌ماند. */
    records.forEach((record, index) => {
      report.checked += 1;

      let subject = record;
      if (normalize) {
        const normalized = normalizeRecord(schema, record, {
          domainNormalizers: domainNormalizersFor(schema),
        });
        subject = normalized.record;
        for (const field of normalized.changed) report.normalizedFields.push(`${schema.name}.${field}`);
      }

      const result = validateEntity(schema.name, subject, { mode });
      const label = schema.identityField ? subject?.[schema.identityField] : `#${index}`;

      for (const entry of [...result.errors, ...result.warnings]) {
        if (report.recordViolations.length >= maxViolations) { report.truncated = true; break; }
        report.recordViolations.push({
          entity: schema.name,
          index,
          id: label ?? `#${index}`,
          severity: result.errors.includes(entry) ? 'error' : 'warn',
          code: entry.code,
          field: entry.field,
          message: entry.message,
        });
        bump(report.byCode, entry.code);
        bump(report.byEntity, schema.name);
      }
    });
  }

  return report;
}

function bump(target, key) {
  target[key] = (target[key] ?? 0) + 1;
}

/* ─────────────────────── خلاصهٔ خوانا ─────────────────────── */

/** یک خط خوانا برای لاگ. مجموعهٔ سالم ⇒ `null`. */
export function summarizeWriteReport(report) {
  if (!report || !report.known) return null;
  const bad = report.recordViolations.length + report.collectionIssues.length;
  if (bad === 0) return null;
  const codes = Object.entries(report.byCode)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `${code}×${count}`)
    .join(' · ');
  return `[model-observe] ${report.collection}: ${bad} مورد (${report.checked} رکورد سنجیده شد) — ${codes}`;
}

/**
 * جزئیات خوانا — یک خط برای هر `entity.field:code` یکتا.
 *
 * چرا لازم است: خط خلاصه فقط **کد** را می‌گوید. برای «ممیزی شکاف Schema» چیزی
 * که لازم است **نام فیلد** است — همان چیزی که باید به Schema اضافه شود.
 * مثال واقعی: `admin.createdBy:unknown_field` که با همین خروجی پیدا شد.
 *
 * ⚠️ خروجی بر اساس `entity.field:code` **یکتا** می‌شود و سقف دارد؛ وگرنه یک
 * مجموعهٔ ۵۰۰ رکوردی با یک ایراد تکراری، لاگ را غیرقابل‌خواندن می‌کند.
 *
 * @param {object} report
 * @param {{limit?: number}} [options]
 * @returns {string[]}
 */
export function describeWriteReport(report, { limit = 8 } = {}) {
  if (!report?.known) return [];

  const seen = new Set();
  const lines = [];

  const push = (key, line) => {
    if (seen.has(key) || lines.length >= limit) return;
    seen.add(key);
    lines.push(`[model-observe] ${report.collection} → ${line}`);
  };

  for (const issue of report.collectionIssues) {
    push(`${issue.entity}:${issue.code}`, `${issue.entity}:${issue.code} — ${issue.message}`);
  }
  for (const violation of report.recordViolations) {
    push(
      `${violation.entity}.${violation.field}:${violation.code}`,
      `${violation.entity}.${violation.field}:${violation.code} [${violation.severity}] — ${violation.message}`,
    );
  }

  return lines;
}

/* ─────────────────────── حلقهٔ اخیر (برای تست و عیب‌یابی) ─────────────────────── */

const MAX_BUFFERED = 50;
const buffer = [];

/**
 * بازرسی + ثبت در حلقهٔ اخیر + گزارش به `stderr` اگر `TAPESH_MODEL_OBSERVE_LOG=1`.
 * هرگز پرتاب نمی‌کند: ناظر نباید نوشتن را بشکند.
 */
export function observeWrite(collection, container, options = {}) {
  let report = null;
  try {
    report = inspectWrite(collection, container, options);
  } catch (error) {
    /* شکست خودِ ناظر هرگز نباید به نوشتن آسیب بزند. */
    report = {
      collection,
      known: false,
      entities: [],
      shape: [],
      total: 0,
      checked: 0,
      recordViolations: [],
      collectionIssues: [],
      byCode: {},
      byEntity: {},
      truncated: false,
      observerError: String(error?.message ?? error),
    };
  }

  buffer.push(report);
  if (buffer.length > MAX_BUFFERED) buffer.splice(0, buffer.length - MAX_BUFFERED);

  if (process.env.TAPESH_MODEL_OBSERVE_LOG === '1') {
    const line = summarizeWriteReport(report);
    if (line) {
      process.stderr.write(`${line}\n`);
      /* جزئیات — برای «ممیزی شکاف Schema» نام فیلد لازم است، نه فقط کد. */
      for (const detail of describeWriteReport(report)) process.stderr.write(`${detail}\n`);
    }
  }

  return report;
}

/** حلقهٔ اخیر را برمی‌گرداند و **خالی می‌کند**. */
export function takeWriteReports() {
  return buffer.splice(0, buffer.length);
}

/** حلقهٔ اخیر را بدون خالی‌کردن برمی‌گرداند. */
export function peekWriteReports() {
  return [...buffer];
}

/** حلقه را خالی می‌کند — برای شروع تازه در تست. */
export function resetWriteReports() {
  buffer.length = 0;
}
