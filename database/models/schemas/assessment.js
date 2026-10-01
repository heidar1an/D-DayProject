/*
 * Schemaهای دامنهٔ «ارزیابی» — بانک تست، آزمون هماهنگ، تلاش و کارنامه.
 *
 * ⚠️ این فایل **فقط از منظر یکپارچگی داده** نوشته شده (بند ۳۷). هیچ قاعدهٔ
 * امنیتی فاز ۲ (کلید پاسخ، افشای عمومی، ترتیب سؤال، rate limit) اینجا بازنویسی
 * نمی‌شود؛ فقط شکل و ارتباط داده اعتبارسنجی می‌شود. توابع `examStore.js` و
 * `examApi.js` دست‌نخورده می‌مانند.
 */

import {
  arr, bool, count, describe, enumOf, epoch, id, json, num, obj, percent,
  ref, required, serverOnly, slug, str, strArray, timestamp,
} from '../fields.js';
import {
  EXAM_DIFFICULTIES, EXAM_QUESTION_DIFFICULTIES, EXAM_TYPES,
  TEST_BANK_DIFFICULTIES, TEST_BANK_SOURCES, TEST_BANK_STATUSES, TEST_BANK_TRACKS, TEST_BANK_TYPES,
} from '../enums.js';

/** مُهر زمانی epoch که `null` هم می‌پذیرد. */
const NULLABLE_EPOCH = { ...epoch(), nullable: true };

/* ─────────────────────────── Enumهای دامنه ─────────────────────────── */

/**
 * موضوع سؤال بانک تست — مرجع: `testBank/mockData.js` → `SUBJECTS`.
 * ⚠️ توجه: `esl` (انگلیسی) در این رجیستری هست ولی در رجیستری میکرو `english`
 * است. دو رجیستری موازی‌اند و Schema هرکدام فقط رجیستری خودش را می‌پذیرد.
 */
export const TEST_BANK_SUBJECTS = [
  'physiology', 'anatomy', 'biochemistry', 'microbiology', 'immunology', 'pathology',
  'virology', 'mycology', 'parasitology', 'genetics', 'histology', 'esl',
];

/** وضعیت تلاش آزمون — از `examStore.js` (`in_progress` / `submitted`) */
export const ATTEMPT_STATUSES = ['in_progress', 'submitted', 'expired', 'abandoned'];

/** دلیل پایان تلاش — از `examStore.js` */
export const ATTEMPT_REASONS = ['user', 'time', 'auto'];

/** نوع گزارش تخلف/مشکل آزمون — از `examApi.js` */
export const EXAM_REPORT_KINDS = ['question-issue', 'technical', 'proctor', 'other'];

/* ─────────────────────────── بانک تست ─────────────────────────── */

/*
 * توضیح تشریحی سؤال.
 * ⚠️ `whyWrong` آرایه‌ای از «چرا هر گزینه غلط است» است، نه رشته —
 * همان چیزی که دادهٔ واقعی نشان می‌دهد.
 */
const testBankWhyWrongSchema = obj({
  index: describe(required(num({ min: 0, max: 20, int: true })), 'اندیس گزینهٔ غلط'),
  text: describe(required(str({ min: 1, max: 2000, allowEmpty: false })), 'دلیل غلط‌بودن'),
}, { allowUnknown: true });

const testBankExplanationSchema = obj({
  summary: str({ max: 4000 }),
  deep: str({ max: 12000 }),
  keyPoint: str({ max: 2000 }),
  trap: str({ max: 2000 }),
  whyWrong: arr(testBankWhyWrongSchema, { max: 10 }),
});

const testBankStatsSchema = obj({
  solves: count({ max: 100000000 }),
  correctPercent: percent(),
  optionPercents: arr(percent(), { max: 10 }),
  avgTimeSec: num({ min: 0, max: 100000 }),
  difficultyIndex: num({ min: -10, max: 10 }),
});

export const testBankQuestionSchema = {
  name: 'testBankQuestion',
  collection: 'testBankQuestions',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/testBankQuestions.json',
  description: 'سؤال بانک تست — شامل کلید پاسخ. هرگز نباید در باندل عمومی برود.',
  fields: {
    id: required(id({ prefix: 'tb' })),
    subject: describe(required(enumOf(TEST_BANK_SUBJECTS, { name: 'TEST_BANK_SUBJECTS' })), 'موضوع'),
    topicPath: describe(arr(str({ max: 200, allowEmpty: false }), { min: 1, max: 6 }), 'مسیر مبحث — حداقل یک گام'),
    conceptIds: strArray({ max: 20 }),
    type: describe(required(enumOf(TEST_BANK_TYPES, { name: 'TEST_BANK_TYPES' })), 'نوع سؤال'),
    difficulty: describe(required(enumOf(TEST_BANK_DIFFICULTIES, { name: 'TEST_BANK_DIFFICULTIES' })), 'سطح دشواری'),
    /* کلید پاسخ — فیلد محافظت‌شده: از Client پذیرفته نمی‌شود و در خروجی عمومی نیست */
    correctAnswer: describe(
      { ...num({ min: 0, max: 20, int: true }), protected: true, secret: true },
      'اندیس گزینهٔ درست — محرمانه',
    ),
    options: describe(arr(str({ max: 2000, allowEmpty: false }), { min: 2, max: 10 }), 'گزینه‌ها'),
    explanation: describe(testBankExplanationSchema, 'توضیح تشریحی — محرمانه در خروجی عمومی'),
    source: enumOf(TEST_BANK_SOURCES, { name: 'TEST_BANK_SOURCES' }),
    year: describe(num({ min: 1300, max: 1500, int: true }), 'سال شمسی آزمون'),
    examMonth: num({ min: 1, max: 12, int: true }),
    track: enumOf(TEST_BANK_TRACKS, { name: 'TEST_BANK_TRACKS' }),
    status: required(enumOf(TEST_BANK_STATUSES, { name: 'TEST_BANK_STATUSES' })),
    stats: testBankStatsSchema,
    tags: strArray({ max: 20 }),
    figure: { ...str({ max: 60 }), nullable: true },
    stem: describe(required(str({ min: 1, max: 8000, allowEmpty: false })), 'صورت سؤال'),
    createdAt: serverOnly(timestamp()),
    updatedAt: serverOnly(timestamp()),
    updatedBy: serverOnly(str({ max: 80 })),
  },
  unique: [{ fields: ['id'] }],
  /* قواعد بین‌فیلدی: کلید پاسخ باید اندیس معتبری باشد و درصدها به تعداد گزینه‌ها */
  crossField: ['correctAnswerWithinOptions', 'optionPercentsLength'],
};

/* ─────────────────────────── پاسخ کاربر به سؤال ─────────────────────────── */

/**
 * پاسخ کاربر. **شناسهٔ مستقل ندارد** — کلید طبیعی `(userId, questionId)` است.
 * پس یکتایی ترکیبی است، نه یکتایی `id` (بند ۲۸).
 */
export const testBankAnswerSchema = {
  name: 'testBankAnswer',
  collection: 'testBankAnswers',
  storage: 'array',
  identityField: null,
  file: 'database/content/testBankAnswers.json',
  description: 'پاسخ ثبت‌شدهٔ کاربر به یک سؤال بانک تست — کلید ترکیبی (userId, questionId).',
  fields: {
    userId: describe(required(str({ min: 1, max: 80, allowEmpty: false })), 'شناسهٔ کاربر — یا `guest-…`'),
    questionId: describe(required(ref('testBankQuestions', { nullable: false })), 'سؤال — باید موجود باشد'),
    selected: describe(required(num({ min: 0, max: 20, int: true })), 'اندیس گزینهٔ انتخاب‌شده'),
    timeSpent: describe(count({ max: 86400 }), 'زمان صرف‌شده (ثانیه)'),
    answeredAt: describe(required(epoch()), 'epoch میلی‌ثانیه — قرارداد این مجموعه'),
  },
  unique: [{ fields: ['userId', 'questionId'] }],
};

/* ─────────────────────────── پاداش قلب ─────────────────────────── */

/**
 * پاداش قلب برای یک تلاش. کلید طبیعی `(userId, attemptKey)` است.
 * `attemptKey` خودش `questionId:answeredAt` است — یعنی یکتایی «هر تلاش یک پاداش».
 */
export const testBankHeartRewardSchema = {
  name: 'testBankHeartReward',
  collection: 'testBankHeartRewards',
  storage: 'array',
  identityField: null,
  file: 'database/content/testBankHeartRewards.json',
  description: 'پاداش قلب — یکتایی روی (userId, attemptKey) تا یک تلاش دو بار پاداش نگیرد.',
  fields: {
    userId: required(str({ min: 1, max: 80, allowEmpty: false })),
    questionId: describe(required(ref('testBankQuestions', { nullable: false })), 'سؤال — باید موجود باشد'),
    attemptKey: describe(
      required(str({ min: 3, max: 160, pattern: /^.+:\d+$/, allowEmpty: false })),
      'کلید تلاش به‌شکل questionId:answeredAt',
    ),
    awardedAt: required(epoch()),
  },
  unique: [{ fields: ['userId', 'attemptKey'] }],
};

/* ─────────────────────────── آزمون هماهنگ ─────────────────────────── */

const examRulesSchema = obj({
  negativeMarking: num({ min: -10, max: 0 }),
  allowBackNavigation: bool(),
  allowAnswerChange: bool(),
  attemptLimit: num({ min: 1, max: 100, int: true }),
  /* مقادیر واقعی: exam_end | per_attempt */
  deadlineMode: enumOf(['exam_end', 'per_attempt', 'submit_window'], { name: 'DEADLINE_MODE' }),
  allowMarking: bool(),
});

const examBudgetItemSchema = obj({
  topic: required(str({ min: 1, max: 200, allowEmpty: false })),
  count: count({ max: 10000 }),
  sections: strArray({ max: 40 }),
});

export const examSchema = {
  name: 'exam',
  collection: 'exams',
  storage: 'keyed-array',
  arrayKey: 'exams',
  identityField: 'id',
  file: 'database/content/exams.json',
  description: 'آزمون هماهنگ. `registrations` دادهٔ داخلی است و به کلاینت نمی‌رود.',
  fields: {
    id: required(id({ prefix: 'exam' })),
    slug: describe(required(slug()), 'شناسهٔ URL — یکتا'),
    title: required(str({ min: 1, max: 300, allowEmpty: false })),
    shortName: str({ max: 120 }),
    type: describe(required(enumOf(EXAM_TYPES, { name: 'EXAM_TYPES' })), 'نوع آزمون'),
    organizer: str({ max: 200 }),
    description: str({ max: 6000 }),
    subject: str({ max: 200 }),
    topics: strArray({ max: 40 }),
    budget: arr(examBudgetItemSchema, { max: 40 }),
    difficulty: enumOf(EXAM_DIFFICULTIES, { name: 'EXAM_DIFFICULTIES' }),
    audience: str({ max: 300 }),
    level: str({ max: 120 }),
    duration: describe(num({ min: 1, max: 1440, int: true }), 'مدت (دقیقه)'),
    questionCount: describe(count({ max: 10000 }), 'شمار سؤال اعلامی — باید با سؤال‌های واقعی بخواند'),
    startTime: describe(required(epoch()), 'شروع — epoch'),
    endTime: describe(required(epoch()), 'پایان — epoch'),
    registrationOpenAt: epoch(),
    registrationDeadline: epoch(),
    resultReleaseAt: epoch(),
    participantsCount: count({ max: 100000000 }),
    universities: strArray({ max: 200 }),
    accent: str({ max: 40 }),
    glyph: str({ max: 60 }),
    featured: bool(),
    lateRegistration: bool(),
    graceSeconds: describe(num({ min: 0, max: 3600, int: true }), 'پنجرهٔ مهلت پس از پایان'),
    currentVersion: describe(num({ min: 1, max: 1000, int: true }), 'نسخهٔ سؤال‌ها — تغییرش سؤال‌ها را عوض می‌کند'),
    seedSource: describe(str({ max: 40 }), 'منشأ seed (مثل `demo`)'),
    alwaysAvailable: describe(bool(), 'آزمونک همیشه‌در‌دسترس — بدون بازهٔ زمانی'),
    cancelled: describe(bool(), 'پرچم لغو — در `examPhase` استفاده می‌شود'),
    archived: describe(bool(), 'پرچم آرشیو — در `examPhase` استفاده می‌شود'),
    rules: examRulesSchema,
    /* ── دادهٔ داخلی: نگاشت userId → زمان ثبت‌نام ──
       در `examSummaryFor` صریحاً از خروجی حذف می‌شود (`void registrations`). */
    registrations: describe(
      { ...obj({}, { allowUnknown: true }), secret: true, nullable: true },
      'فهرست ثبت‌نامی — داخلی، هرگز به کلاینت نمی‌رود',
    ),
  },
  unique: [{ fields: ['slug'] }],
  crossField: ['examTimeRange', 'questionCountMatchesBank'],
};

/* ─────────────────────────── سؤال آزمون ─────────────────────────── */

export const examQuestionSchema = {
  name: 'examQuestion',
  collection: 'examQuestions',
  storage: 'keyed-array',
  arrayKey: 'questions',
  identityField: 'id',
  file: 'database/content/examQuestions.json',
  description: 'سؤال آزمون هماهنگ — با کلید پاسخ. باید به آزمون موجود وصل باشد.',
  fields: {
    id: describe(required(id({ prefix: 'q' })), 'شناسهٔ سؤال آزمون — پیشوند q'),
    examId: describe(required(ref('exams', { nullable: false })), 'آزمون والد — الزامی'),
    subject: describe(str({ max: 120 }), 'موضوع — متن فارسی آزاد (نه Enum)'),
    topic: str({ max: 200 }),
    difficulty: enumOf(EXAM_QUESTION_DIFFICULTIES, { name: 'EXAM_QUESTION_DIFFICULTIES' }),
    stem: describe(required(str({ min: 1, max: 8000, allowEmpty: false })), 'صورت سؤال'),
    options: arr(str({ max: 2000, allowEmpty: false }), { min: 2, max: 10 }),
    correctAnswer: describe(
      { ...num({ min: 0, max: 20, int: true }), protected: true, secret: true },
      'اندیس گزینهٔ درست — محرمانه',
    ),
    /* ⚠️ برخلاف بانک تست، توضیح اینجا **رشتهٔ ساده** است، نه آبجکت ساخت‌یافته */
    explanation: str({ max: 8000, trim: false }),
    keyPoint: str({ max: 2000 }),
    related: obj({ lesson: str({ max: 300 }), wiki: str({ max: 300 }) }),
  },
  crossField: ['correctAnswerWithinOptions'],
};

/* ─────────────────────────── تلاش آزمون ─────────────────────────── */

const attemptAnswerSchema = obj({
  selected: num({ min: 0, max: 20, int: true }),
  timeSpent: count({ max: 86400 }),
  answeredAt: epoch(),
  changes: count({ max: 10000 }),
});

export const examAttemptSchema = {
  name: 'examAttempt',
  collection: 'examAttempts',
  storage: 'keyed-array',
  arrayKey: 'attempts',
  identityField: 'id',
  file: 'database/content/examAttempts.json',
  description: 'تلاش کاربر در یک آزمون — پاسخ‌ها داخل رکورد می‌مانند.',
  fields: {
    id: required(id({ prefix: 'att' })),
    userId: describe(required(str({ min: 1, max: 80, allowEmpty: false })), 'شناسهٔ کاربر (یا سشن ناشناس)'),
    examId: describe(required(ref('exams', { nullable: false })), 'آزمون — الزامی'),
    examSlug: str({ max: 200 }),
    examVersion: num({ min: 1, max: 1000, int: true }),
    startedAt: required(epoch()),
    endsAt: epoch(),
    submittedAt: NULLABLE_EPOCH,
    status: describe(required(enumOf(ATTEMPT_STATUSES, { name: 'ATTEMPT_STATUSES' })), 'وضعیت تلاش'),
    reason: enumOf(ATTEMPT_REASONS, { name: 'ATTEMPT_REASONS' }),
    questionIds: arr(str({ max: 120 }), { max: 500, unique: true }),
    answers: obj({}, { allowUnknown: true }),
    marked: arr(str({ max: 120 }), { max: 500, unique: true }),
    demo: describe(bool(), 'تلاش نمونهٔ seed — کارنامهٔ نمایشی'),
    result: describe(json(), 'کارنامهٔ محاسبه‌شده — سرورساخته'),
  },
  unique: [{ fields: ['id'] }],
};

/* ─────────────────────────── کارنامه و گزارش ─────────────────────────── */

export const examReportSchema = {
  name: 'examReport',
  collection: 'examReports',
  storage: 'keyed-array',
  arrayKey: 'reports',
  identityField: 'id',
  file: 'database/content/examReports.json',
  description: 'گزارش مشکل سؤال/آزمون از سوی کاربر.',
  fields: {
    id: required(id({ prefix: 'rep' })),
    examId: ref('exams', { nullable: false }),
    questionId: ref('examQuestions'),
    userId: str({ max: 80 }),
    kind: enumOf(EXAM_REPORT_KINDS, { name: 'EXAM_REPORT_KINDS' }),
    reason: describe(str({ min: 1, max: 2000, allowEmpty: false }), 'دلیل گزارش — الزامی در API'),
    createdAt: epoch(),
    status: enumOf(['open', 'reviewed', 'resolved'], { name: 'EXAM_REPORT_STATUS' }),
  },
};

/**
 * لاگ زنجیرهٔ هش آزمون — `{ seq, head, events[] }`.
 * هر رویداد به رویداد قبلی زنجیر می‌شود؛ یکپارچگی اینجا **ترتیب و پیوستگی**
 * است، نه شکل رویداد. محتوای رویدادها در `examStore.js` ساخته می‌شود و
 * دست‌نخورده می‌ماند.
 */
export const examAuditSchema = {
  name: 'examAudit',
  collection: 'examAudit',
  storage: 'singleton',
  identityField: null,
  file: 'database/content/examAudit.json',
  description: 'زنجیرهٔ هش audit آزمون — فقط پیوستنی.',
  fields: {
    seq: describe(required(count({ max: 100000000 })), 'شمارهٔ ترتیبی رویداد آخر'),
    head: describe(required(str({ min: 64, max: 64, pattern: /^[0-9a-f]{64}$/, allowEmpty: false })), 'هش سر زنجیره'),
    events: arr(json(), { max: 100000 }),
  },
  deepCheck: 'examAuditChain',
};

/* ─────────────────────────── صادرات دامنه ─────────────────────────── */

export const ASSESSMENT_SCHEMAS = [
  testBankQuestionSchema, testBankAnswerSchema, testBankHeartRewardSchema,
  examSchema, examQuestionSchema, examAttemptSchema, examReportSchema, examAuditSchema,
];
