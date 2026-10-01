/*
 * رجیستری مدل داده — نقطهٔ ورود واحد لایهٔ Schema.
 *
 * مصرف‌کننده‌ها:
 *   • `scripts/data-integrity.mjs`  → اسکنر یکپارچگی (`npm run data:check`)
 *   • `database/dataIntegrity.test.mjs` → تست‌های الزامی (بند ۶۲)
 *   • سرور (در صورت نیاز) برای اعتبارسنجی ورودی پیش از نوشتن
 *
 * ── تفکیک Schema Validation از Domain Validation (بند ۳۴) ──────────────────
 *   Schema  → «این مقدار چه شکلی دارد؟»   (`validator.js`)
 *   Domain  → «این مقدار منطقاً مجاز است؟» (`CROSS_FIELD_CHECKS` + `DEEP_CHECKS`)
 * این دو در خروجی جداگانه گزارش می‌شوند تا معلوم باشد کدام لایه شکسته است.
 */

import { PLATFORM_SCHEMAS } from './schemas/platform.js';
import { CONTENT_SCHEMAS } from './schemas/content.js';
import { MEDIA_SCHEMAS } from './schemas/media.js';
import { ASSESSMENT_SCHEMAS } from './schemas/assessment.js';
import { PUBLISHING_SCHEMAS } from './schemas/publishing.js';
import { validateRecord, secretFieldNames, protectedFieldNames } from './validator.js';
import { RELATIONS, POLYMORPHIC_RELATIONS } from './relations.js';

export * from './enums.js';
export * from './fields.js';
export {
  validateRecord, toErrorFields, summarize, assertValid, stripSecrets,
  secretFieldNames, protectedFieldNames, applyDefaults, checkUnique,
  SYSTEM_PROTECTED_FIELDS, STRICT_UNKNOWN_FIELD_ENTITIES,
} from './validator.js';
export {
  normalizeDigits, normalizeWhitespace, normalizePhone, normalizeEmail, normalizeSlug,
  normalizeTag, normalizeSearchTerm, normalizeUsername, normalizeId, normalizeStringArray,
  normalizeRecord, domainNormalizersFor, sameValue,
} from './normalizers.js';
export * from './relations.js';
export {
  findIdentityIssues, findUniqueViolations, uniqueKeyOf, findRelationOrphans,
  checkStorageShape, recordsFromContainer, findSecretLeaks, findStorageKeyIssues,
  KNOWN_SECRET_NAMES,
} from './integrity.js';

/* ⚠️ `./observe.js` عمداً اینجا re-export **نمی‌شود**.
   آن ماژول خودش `index.js` را import می‌کند؛ اگر index هم آن را import کند
   یک حلقهٔ ESM ساخته می‌شود که ترتیب مقداردهی را شکننده می‌کند. مصرف‌کننده
   باید مستقیم `import ... from './models/observe.js'` بزند. */

/* ── دسترسی مستقیم به Schemaها و ثابت‌های هر دامنه ──
   برای مصرف‌کننده‌ای که یک Entity خاص را می‌خواهد (تست، اعتبارسنجی ورودی سرور)
   یا به بلوک محتوا/فهرست مجاز یک دامنه نیاز دارد. */
export { PLATFORM_SCHEMAS } from './schemas/platform.js';
export {
  CONTENT_SCHEMAS, ACCENTS, REFERENCE_GLYPHS, ARTICLE_BLOCK_TYPES, MICRO_BLOCK_TYPES,
  FLASHCARD_SUBJECTS, FLASHCARD_CARD_TYPES, FLASHCARD_CARD_STATUSES, MICRO_SUBJECTS,
  COMPREHENSIVE_MODULE_STATUSES, CONTENT_DIFFICULTIES, IMPORTANCE_LEVELS,
  EXAM_FREQUENCIES, articleBlockSchema,
  categorySchema, articleSchema, pageSchema, referenceSchema, flashcardDeckSchema,
  microCourseSchema, comprehensiveCourseSchema, intlProviderSchema, intlCourseSchema,
} from './schemas/content.js';
export { MEDIA_SCHEMAS, METRIC_FIELDS } from './schemas/media.js';
export {
  ASSESSMENT_SCHEMAS, TEST_BANK_SUBJECTS, ATTEMPT_STATUSES, ATTEMPT_REASONS, EXAM_REPORT_KINDS,
} from './schemas/assessment.js';
export { PUBLISHING_SCHEMAS } from './schemas/publishing.js';

/* ─────────────────────────── رجیستری ─────────────────────────── */

/** همهٔ Schemaها — ترتیب: پلتفرم، محتوا، رسانه، ارزیابی، انتشار. */
export const MODELS = Object.freeze([
  ...PLATFORM_SCHEMAS,
  ...CONTENT_SCHEMAS,
  ...MEDIA_SCHEMAS,
  ...ASSESSMENT_SCHEMAS,
  ...PUBLISHING_SCHEMAS,
]);

/** نگاشت نام Entity → Schema. */
export const MODEL_BY_NAME = Object.freeze(
  Object.fromEntries(MODELS.map((schema) => [schema.name, schema])),
);

/**
 * نگاشت نام مجموعهٔ JSON → Schema.
 * چند Entity می‌توانند یک فایل را شریک باشند (`feedback` و `feedbackReply`)،
 * پس مقدار این نگاشت همیشه یک Schema تنها نیست.
 */
export const MODELS_BY_COLLECTION = Object.freeze(
  MODELS.reduce((accumulator, schema) => {
    const key = schema.collection;
    if (!key) return accumulator;
    accumulator[key] = [...(accumulator[key] ?? []), schema];
    return accumulator;
  }, {}),
);

/** نگاشت نام مجموعهٔ JSON → فایل داده. */
export const COLLECTION_FILES = Object.freeze(
  MODELS.reduce((accumulator, schema) => {
    if (schema.collection && schema.file && !accumulator[schema.collection]) {
      accumulator[schema.collection] = schema.file;
    }
    return accumulator;
  }, {}),
);

export function getModel(name) {
  return MODEL_BY_NAME[name] ?? null;
}

/* ─────────────────────────── قواعد بین‌فیلدی ─────────────────────────── */

/**
 * هر بررسی: `(record, ctx) => ({ code, message, field? } | null)`.
 * `ctx` شامل `collections` (برای قواعدی که به مجموعهٔ دیگر نگاه می‌کنند) است.
 */
export const CROSS_FIELD_CHECKS = {
  /** `publishedAt` فقط وقتی معنا دارد که `status === 'published'`. */
  publishedAtRequiresPublished: (record) => {
    const status = record.status;
    const publishedAt = record.publishedAt;
    if (status === 'published' && !publishedAt) {
      return { field: 'publishedAt', code: 'missing_published_at', message: 'رکورد منتشرشده باید publishedAt داشته باشد.' };
    }
    if (status && status !== 'published' && publishedAt) {
      return { field: 'publishedAt', code: 'unexpected_published_at', message: 'publishedAt روی رکورد منتشرنشده نباید مقدار داشته باشد.' };
    }
    return null;
  },

  /** بازهٔ تاریخ بنر: پایان نباید پیش از شروع باشد. */
  bannerDateRange: (record) => {
    if (!record.startDate || !record.endDate) return null;
    if (Date.parse(record.endDate) < Date.parse(record.startDate)) {
      return { field: 'endDate', code: 'invalid_range', message: 'تاریخ پایان نباید پیش از شروع باشد.' };
    }
    return null;
  },

  /** بازهٔ تاریخ کمپین رسانه. */
  mediaCampaignDateRange: (record) => {
    if (!record.startAt || !record.endAt) return null;
    if (Date.parse(record.endAt) < Date.parse(record.startAt)) {
      return { field: 'endAt', code: 'invalid_range', message: 'پایان کمپین نباید پیش از شروع باشد.' };
    }
    return null;
  },

  /** کلید پاسخ باید اندیس یک گزینهٔ موجود باشد. */
  correctAnswerWithinOptions: (record) => {
    const answer = record.correctAnswer;
    const options = record.options;
    if (answer === undefined || !Array.isArray(options)) return null;
    if (answer < 0 || answer >= options.length) {
      return {
        field: 'correctAnswer',
        code: 'out_of_range',
        message: `اندیس پاسخ (${answer}) بیرون از بازهٔ گزینه‌ها (۰..${options.length - 1}) است.`,
      };
    }
    return null;
  },

  /** تعداد درصدهای هر گزینه باید با تعداد گزینه‌ها بخواند. */
  optionPercentsLength: (record) => {
    const percents = record.stats?.optionPercents;
    const options = record.options;
    if (!Array.isArray(percents) || !Array.isArray(options)) return null;
    if (percents.length && percents.length !== options.length) {
      return {
        field: 'stats.optionPercents',
        code: 'length_mismatch',
        message: `تعداد درصدها (${percents.length}) با تعداد گزینه‌ها (${options.length}) نمی‌خواند.`,
      };
    }
    return null;
  },

  /** بازهٔ زمانی آزمون: پایان باید بعد از شروع باشد. */
  examTimeRange: (record) => {
    if (!Number.isFinite(record.startTime) || !Number.isFinite(record.endTime)) return null;
    if (record.endTime <= record.startTime) {
      return { field: 'endTime', code: 'invalid_range', message: 'پایان آزمون باید بعد از شروع باشد.' };
    }
    return null;
  },

  /**
   * `questionCount` اعلامی باید با سؤال‌های واقعی همان آزمون بخواند.
   * ⚠️ این یک قاعدهٔ **همگامی شمارندهٔ denormalized** است، نه خطای سخت.
   */
  questionCountMatchesBank: (record, ctx) => {
    const questions = ctx?.collections?.examQuestions;
    if (!Array.isArray(questions)) return null;
    const actual = questions.filter((question) => question?.examId === record.id).length;
    const declared = record.questionCount;
    if (!Number.isFinite(declared)) return null;
    if (declared !== actual) {
      return {
        field: 'questionCount',
        code: 'counter_drift',
        message: `شمار سؤال اعلامی (${declared}) با سؤال‌های واقعی (${actual}) نمی‌خواند.`,
        severity: 'warn',
      };
    }
    return null;
  },

  /** محتوای منتشرشده باید publishedAt داشته باشد. */
  mediaContentPublishedAt: (record) => {
    if (record.status === 'published' && !record.publishedAt) {
      return { field: 'publishedAt', code: 'missing_published_at', message: 'محتوای منتشرشده باید publishedAt داشته باشد.' };
    }
    return null;
  },

  /** محتوای زمان‌بندی‌شده باید scheduledAt داشته باشد. */
  mediaContentScheduledAt: (record) => {
    if (record.status === 'scheduled' && !record.scheduledAt) {
      return { field: 'scheduledAt', code: 'missing_scheduled_at', message: 'محتوای زمان‌بندی‌شده باید scheduledAt داشته باشد.' };
    }
    return null;
  },

  /** وضعیت آخرین ارسال کانال باید یکی از وضعیت‌های شناخته‌شده باشد. */
  publishChannelLastStatus: (record) => {
    if (record.lastStatus && !['sent', 'failed', 'dry-run'].includes(record.lastStatus)) {
      return { field: 'lastStatus', code: 'enum', message: `وضعیت آخرین ارسال «${record.lastStatus}» شناخته‌شده نیست.` };
    }
    return null;
  },
};

/* ─────────────────────────── بررسی‌های عمیق ─────────────────────────── */

/**
 * بررسی‌های ساختاری که با زبان توصیف‌گر ساده بیان نمی‌شوند.
 * هر کدام آرایه‌ای از خطاها برمی‌گرداند.
 */
export const DEEP_CHECKS = {
  /**
   * `unitsByModule` یک نگاشت آزاد `moduleId → unit[]` است.
   * قواعد: هر کلید باید ماژول موجود باشد؛ هر واحد `id` یکتا داشته باشد؛
   * ماژول‌های بدون واحد **مجازند** (دادهٔ واقعی ۱۶ ماژول خالی دارد).
   */
  comprehensiveUnitsByModule: (record) => {
    const problems = [];
    const modules = Array.isArray(record.modules) ? record.modules : [];
    const moduleIds = new Set(modules.map((module) => module?.id).filter(Boolean));
    const map = record.unitsByModule;

    if (map === undefined || map === null) return problems;
    if (typeof map !== 'object' || Array.isArray(map)) {
      return [{ field: 'unitsByModule', code: 'type', message: 'باید نگاشت آبجکت باشد.' }];
    }

    const seenUnitIds = new Map();
    for (const [moduleId, units] of Object.entries(map)) {
      if (!moduleIds.has(moduleId)) {
        problems.push({ field: `unitsByModule.${moduleId}`, code: 'orphan_module', message: `ماژول «${moduleId}» در فهرست modules نیست.` });
      }
      if (!Array.isArray(units)) {
        problems.push({ field: `unitsByModule.${moduleId}`, code: 'type', message: 'مقدار باید آرایهٔ واحدها باشد.' });
        continue;
      }
      for (const unit of units) {
        if (!unit || typeof unit !== 'object') {
          problems.push({ field: `unitsByModule.${moduleId}`, code: 'type', message: 'واحد باید آبجکت باشد.' });
          continue;
        }
        if (!unit.id) {
          problems.push({ field: `unitsByModule.${moduleId}`, code: 'required', message: 'واحد باید شناسه داشته باشد.' });
          continue;
        }
        if (seenUnitIds.has(unit.id)) {
          problems.push({ field: `unitsByModule.${moduleId}.${unit.id}`, code: 'duplicate', message: `شناسهٔ واحد «${unit.id}» در جای دیگری هم آمده.` });
        }
        seenUnitIds.set(unit.id, moduleId);
        if (unit.moduleId && unit.moduleId !== moduleId) {
          problems.push({
            field: `unitsByModule.${moduleId}.${unit.id}.moduleId`,
            code: 'mismatch',
            message: `unit.moduleId («${unit.moduleId}») با کلید نگاشت («${moduleId}») نمی‌خواند.`,
          });
        }
      }
    }

    /* شمارش ماژول باید با واحدهای واقعی همان ماژول بخواند */
    for (const module of modules) {
      const actual = Array.isArray(map[module?.id]) ? map[module.id].length : 0;
      if (Number.isFinite(module?.unitCount) && module.unitCount !== actual) {
        problems.push({
          field: `modules.${module.id}.unitCount`,
          code: 'counter_drift',
          message: `unitCount اعلامی (${module.unitCount}) با واحدهای واقعی (${actual}) نمی‌خواند.`,
          severity: 'warn',
        });
      }
    }
    return problems;
  },

  /**
   * ارجاع درون‌سندی ایستگاه‌های تست میکرو به صفحه‌های همان واحد.
   * `afterPage` و هر عضو `scopePages` باید شناسهٔ یک صفحهٔ موجود در
   * **همان واحد** باشد — نه واحد دیگر، نه صفحهٔ ناموجود.
   */
  microCheckpointPageRefs: (record) => {
    const problems = [];
    const topics = Array.isArray(record.topics) ? record.topics : [];
    for (const topic of topics) {
      for (const unit of topic?.units ?? []) {
        const pageIds = new Set((unit?.pages ?? []).map((page) => page?.id).filter(Boolean));
        if (!pageIds.size) continue;
        for (const checkpoint of unit?.checkpoints ?? []) {
          const where = `topics.${topic?.id}.units.${unit?.id}.checkpoints.${checkpoint?.id}`;
          if (checkpoint?.afterPage && !pageIds.has(checkpoint.afterPage)) {
            problems.push({
              field: `${where}.afterPage`,
              code: 'orphan_page_ref',
              message: `صفحهٔ «${checkpoint.afterPage}» در واحد «${unit?.id}» وجود ندارد.`,
            });
          }
          for (const pageId of checkpoint?.scopePages ?? []) {
            if (!pageIds.has(pageId)) {
              problems.push({
                field: `${where}.scopePages`,
                code: 'orphan_page_ref',
                message: `صفحهٔ «${pageId}» در دامنهٔ ایستگاه هست ولی در واحد «${unit?.id}» وجود ندارد.`,
              });
            }
          }
        }
      }
    }
    return problems;
  },

  /** زنجیرهٔ هش audit آزمون: `seq` باید با تعداد رویدادها بخواند. */
  examAuditChain: (record) => {
    const problems = [];
    const events = Array.isArray(record.events) ? record.events : [];
    if (Number.isFinite(record.seq) && record.seq !== events.length) {
      problems.push({
        field: 'seq',
        code: 'counter_drift',
        message: `seq (${record.seq}) با تعداد رویدادها (${events.length}) نمی‌خواند.`,
        severity: 'warn',
      });
    }
    if (typeof record.head === 'string' && !/^[0-9a-f]{64}$/.test(record.head)) {
      problems.push({ field: 'head', code: 'format', message: 'هش سر زنجیره باید ۶۴ نویسهٔ hex باشد.' });
    }
    return problems;
  },

  /** فایل راز انتشار: `tokens` باید نگاشت رشته→رشته باشد و مقدارش خالی نباشد. */
  publishingSecretsShape: (record) => {
    const problems = [];
    if (record.tokens === undefined || record.tokens === null) return problems;
    if (typeof record.tokens !== 'object' || Array.isArray(record.tokens)) {
      return [{ field: 'tokens', code: 'type', message: 'باید نگاشت channelId → توکن باشد.' }];
    }
    for (const [channelId, token] of Object.entries(record.tokens)) {
      if (typeof token !== 'string' || !token.trim()) {
        problems.push({ field: `tokens.${channelId}`, code: 'empty', message: 'توکن ثبت‌شده خالی است.' });
      }
    }
    return problems;
  },
};

/* ─────────────────────────── اجرای کامل یک Entity ─────────────────────────── */

/**
 * اعتبارسنجی کامل یک رکورد: Schema + قواعد بین‌فیلدی + بررسی عمیق.
 * @returns {{ok: boolean, errors: object[], warnings: object[], schemaOk: boolean, domainOk: boolean}}
 */
export function validateEntity(name, record, { mode = 'stored', collections = null, previous = null } = {}) {
  const schema = getModel(name);
  if (!schema) {
    return { ok: false, errors: [{ field: '', code: 'unknown_entity', message: `Entity «${name}» شناخته‌شده نیست.` }], warnings: [], schemaOk: false, domainOk: false };
  }

  const result = validateRecord(schema, record, { mode, collections, previous });
  const errors = [];
  const warnings = [...result.warnings];

  /* ── تنزل «ارجاع نرم» از خطا به هشدار ──
     ارجاع نرم یعنی «نبودِ والد یک واقعیت تاریخی است، نه شکست یکپارچگی»
     (لاگ فعالیت، نام مدیر کپی‌شده در کانال). مسیر فیلد می‌تواند تودرتو باشد
     (`tagIds.0`)؛ پس فقط بخش اول مسیر برای یافتن توصیف‌گر استفاده می‌شود. */
  for (const entry of result.errors) {
    const rootKey = String(entry.field ?? '').split('.')[0];
    const field = schema.fields?.[rootKey];
    if (entry.code === 'not_found' && field?.meta?.soft === true) {
      warnings.push({ ...entry, code: 'soft_not_found', message: `${entry.message} (ارجاع نرم — تاریخی)` });
      continue;
    }
    errors.push(entry);
  }

  /* ── قواعد بین‌فیلدی ── */
  for (const checkName of schema.crossField ?? []) {
    const check = CROSS_FIELD_CHECKS[checkName];
    if (!check) continue;
    const violation = check(record, { collections });
    if (!violation) continue;
    const entry = { field: violation.field ?? checkName, code: violation.code, message: violation.message };
    if (violation.severity === 'warn') warnings.push(entry);
    else errors.push(entry);
  }

  /* ── بررسی عمیق ── */
  if (schema.deepCheck && DEEP_CHECKS[schema.deepCheck]) {
    for (const problem of DEEP_CHECKS[schema.deepCheck](record, { collections })) {
      const entry = { field: problem.field ?? schema.deepCheck, code: problem.code, message: problem.message };
      if (problem.severity === 'warn') warnings.push(entry);
      else errors.push(entry);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    schemaOk: result.errors.length === 0,
    domainOk: errors.length === result.errors.length,
  };
}

/* ─────────────────────────── آمار پوشش (بند ۵۷) ─────────────────────────── */

/** آمار واقعی پوشش Schema — ورودی گزارش نهایی. */
export function schemaCoverage() {
  const withUnique = MODELS.filter((schema) => Array.isArray(schema.unique) && schema.unique.length);
  const withTransitions = MODELS.filter((schema) => schema.transitions);
  const withCrossField = MODELS.filter((schema) => Array.isArray(schema.crossField) && schema.crossField.length);
  const withDeepCheck = MODELS.filter((schema) => schema.deepCheck);
  const secrets = MODELS.flatMap((schema) => secretFieldNames(schema).map((field) => `${schema.name}.${field}`));
  const protectedFields = MODELS.flatMap((schema) => protectedFieldNames(schema).map((field) => `${schema.name}.${field}`));

  return {
    entities: MODELS.length,
    uniqueConstraints: withUnique.reduce((total, schema) => total + schema.unique.length, 0),
    entitiesWithTransitions: withTransitions.length,
    crossFieldRules: withCrossField.reduce((total, schema) => total + schema.crossField.length, 0),
    deepChecks: withDeepCheck.length,
    relations: RELATIONS.length,
    polymorphicRelations: POLYMORPHIC_RELATIONS.length,
    secretFields: secrets,
    protectedFields,
    files: [...new Set(MODELS.map((schema) => schema.file).filter(Boolean))].length,
  };
}
