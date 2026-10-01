/*
 * رجیستری DTO و گارد خروجی عمومی — فاز ۷.
 *
 * ── قاعدهٔ حاکم ────────────────────────────────────────────────────────────
 * هر فهرست فیلد این فایل **از رفتار واقعی** استخراج شده، نه از حدس. شاهد هر
 * DTO در کامنت همان ورودی ثبت شده (فایل:خط یا نام تابع فروشگاه). تست
 * `database/apiContract.test.mjs` این فهرست‌ها را با خروجی زندهٔ فروشگاه
 * مقایسه می‌کند؛ اگر رفتار عوض شود و DTO به‌روز نشود، **تست می‌شکند**.
 *
 * ── چرا allowlist و نه spread ─────────────────────────────────────────────
 * `{ ...record }` هر فیلد تازهٔ رکورد را بی‌سؤال به Client می‌فرستد. با
 * allowlist، افزودن فیلد به مدل به‌تنهایی آن را عمومی نمی‌کند.
 *
 * ⚠️ این ماژول **جایگزین** نگاشت‌های موجود فروشگاه (`publicTestBankQuestion`,
 * `publicUser`, …) نیست و آن‌ها را دور نمی‌زند؛ لایهٔ دوم دفاعی (tripwire) است
 * که نشت را در مرز HTTP می‌گیرد.
 */

/* ─────────────────────────── فیلدهای ممنوع مطلق ─────────────────────────── */

/*
 * کلیدهایی که در **هیچ** پاسخ عمومی مجاز نیستند. شاهد:
 *   • passwordHash / googleId → `usersStore.publicUser` (usersStore.js:167)
 *   • token/csrfToken/secret/credentials/apiKey → نشست و اعتبارنامهٔ کانال‌ها
 *
 * ⚠️ درسِ گران‌به‌دست‌آمده: `explanation` و `correctAnswer` **ممنوع مطلق
 * نیستند**. `explanation` در درسنامهٔ جامع، متن تشریحیِ آموزشی است و مشروع
 * است (`GET /api/public/comprehensive/library` واقعاً `learning.practice[].explanation`
 * دارد). ممنوع‌بودن آن‌ها **وابسته به DTO** است، نه سراسری. نسخهٔ اول این گارد
 * `explanation` را سراسری ممنوع کرده بود و مسیر جامع را ۵۰۰ می‌کرد؛ تست
 * موجود پروژه (`testBankSecurity.test.mjs` سنجهٔ ۶) آن را گرفت.
 */
export const HARD_FORBIDDEN_KEYS = Object.freeze([
  'passwordHash', 'password', 'googleId',
  'token', 'csrfToken', 'sessionToken', 'secret', 'secrets', 'credentials',
  'accessToken', 'refreshToken', 'apiKey', 'clientSecret',
]);

/** ممنوعیت‌های افزوده که فقط در بافت یک DTO خاص معنا دارند. */
export const DTO_FORBIDDEN_EXTRA = Object.freeze({
  /* کلید پاسخ و تشریح فقط در بافت سؤال بانک تست ممنوع است */
  'GET /api/public/test-bank/questions': ['correctAnswer', 'answerKey', 'explanation'],
  'GET /api/public/test-bank/revision': ['correctAnswer', 'answerKey', 'explanation'],
});

/** فهرست ممنوعِ مؤثر برای یک DTO. */
export function forbiddenFor(dtoName) {
  return [...HARD_FORBIDDEN_KEYS, ...(DTO_FORBIDDEN_EXTRA[dtoName] ?? [])];
}

/* ─────────────────────────── رجیستری DTO عمومی ─────────────────────────── */

/**
 * `fields` = مجموعهٔ دقیق کلیدهای خروجی واقعی (نمونهٔ اول).
 * `restricted` = زیرشکل‌هایی که فقط بخشی از آن‌ها مجاز است.
 */
export const PUBLIC_DTOS = Object.freeze({
  'GET /api/public/articles': {
    entity: 'article',
    source: 'contentStore.publishedArticles()',
    evidence: 'contentStore.js:3236 + نمونهٔ زندهٔ ۱۵ رکورد',
    fields: ['id', 'title', 'slug', 'excerpt', 'contentHtml', 'cover', 'coverAlt', 'category', 'tags',
      'authorName', 'status', 'featured', 'recommended', 'readingTime', 'seo', 'publishedAt', 'views',
      'likes', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
    /* ⚠ finding: فرادادهٔ حسابرسی (`createdBy`/`updatedBy`) در خروجی عمومی است.
       عمداً حذف نشد — breaking بدون inventory مصرف‌کننده ممنوع (بند ۱۹). */
    notes: ['audit-metadata-public: createdBy/updatedBy'],
  },
  'GET /api/public/banners': {
    entity: 'banner',
    source: 'contentStore.publishedBanners()',
    evidence: 'contentStore.js + نمونهٔ زندهٔ ۱ رکورد',
    fields: ['id', 'title', 'subtitle', 'image', 'buttonText', 'buttonUrl', 'isActive', 'sortOrder',
      'startDate', 'endDate', 'createdAt', 'updatedAt'],
  },
  'GET /api/public/settings': {
    entity: 'settings',
    source: 'contentStore.publicSettings()',
    evidence: 'contentStore.js + نمونهٔ زنده',
    fields: ['siteName', 'siteDescription', 'logo', 'favicon', 'email', 'phone', 'address', 'social',
      'seo', 'googleAnalyticsId'],
  },
  'GET /api/public/flashcards/library': {
    entity: 'flashcardDeck',
    source: 'contentStore.publishedFlashcardDecks()',
    evidence: 'contentStore.js + نمونهٔ زندهٔ ۱۱ رکورد',
    fields: ['id', 'userId', 'title', 'shortTitle', 'description', 'type', 'visibility', 'subjectId',
      'level', 'cover', 'byTapesh', 'anatomy', 'previewImage', 'cardCount', 'updatedAt', 'cards'],
    /* ⚠ finding: `userId` (شناسهٔ مالک) در کتابخانهٔ عمومی برگردانده می‌شود. */
    notes: ['owner-identifier-public: userId'],
  },
  'GET /api/public/micro/library': {
    entity: 'microCourse',
    source: 'contentStore.publishedMicroCourses()',
    evidence: 'contentStore.js + نمونهٔ زندهٔ ۱ رکورد',
    fields: ['id', 'subjectId', 'title', 'englishTitle', 'kicker', 'description', 'accent',
      'estimatedTime', 'difficulty', 'checkpointInterval', 'source', 'updatedAt', 'publishedAt', 'topics'],
  },
  'GET /api/public/references/library': {
    entity: 'reference',
    source: 'contentStore.publishedReferences()',
    evidence: 'contentStore.js + نمونهٔ زندهٔ ۳ رکورد',
    fields: ['id', 'title', 'latin', 'edition', 'authors', 'subject', 'accent', 'pages', 'glyph', 'sections'],
  },
  'GET /api/public/comprehensive/library': {
    entity: 'comprehensiveCourse',
    source: 'contentStore.publishedComprehensiveCourses()',
    evidence: 'contentStore.js + نمونهٔ زندهٔ ۱ رکورد',
    fields: ['id', 'title', 'subtitle', 'description', 'modules', 'unitsByModule'],
  },
  'GET /api/public/test-bank/questions': {
    entity: 'testBankQuestion',
    source: 'contentStore.publishedTestBankQuestions()',
    evidence: 'contentStore.js:3193 (PUBLIC_TEST_BANK_FIELDS) + نمونهٔ زندهٔ ۵۹ رکورد',
    fields: ['id', 'subject', 'track', 'source', 'type', 'difficulty', 'year', 'examMonth', 'topicPath',
      'tags', 'conceptIds', 'stem', 'figure', 'options', 'createdAt', 'updatedAt', 'stats'],
    restricted: {
      /* آمار عمومی عمداً مجاز است ولی فقط سه شاخص — بدون توزیع گزینه‌ها (contentStore.js:3199) */
      stats: ['solves', 'correctPercent', 'avgTimeSec'],
    },
    notes: ['non-disclosure: correctAnswer/explanation در خروجی نیست (VERIFIED)'],
  },
  'GET /api/public/intl-courses/library': {
    entity: 'intlCourse',
    source: 'contentStore.publishedIntlCatalog()',
    evidence: 'contentStore.js + نمونهٔ زنده',
    fields: ['courses', 'providers'],
    /* خروجی، پوششِ دو مجموعه است نه یک رکورد ⇒ نشت در عمق اسکن می‌شود */
    wrapper: true,
  },
  'GET /api/public/test-bank/revision': {
    entity: null,
    source: 'contentStore.testBankRevision()',
    evidence: 'contentStore.js:3256 + adminApi.js:2555',
    fields: ['revision'],
    notes: ['پوشش اسکالر — امضای تغییر بانک برای cache-busting کلاینت'],
  },
  'GET /api/public/pages/:slug': {
    entity: 'page',
    source: 'contentStore.getPage(slug)',
    evidence: 'adminApi.js:2559',
    fields: null, /* در زمان اجرا از رکورد واقعی استخراج می‌شود (بدون نمونهٔ ثابت) */
  },
});

/* ─────────────────────────── DTOهای هویت ─────────────────────────── */

/** `usersStore.publicUser` — فیلدهای حذف‌شده شاهد: usersStore.js:167. */
export const USER_PUBLIC_DTO = Object.freeze({
  entity: 'user',
  source: 'usersStore.publicUser()',
  evidence: 'usersStore.js:164-169',
  forbidden: ['passwordHash', 'googleId'],
});

/** `contentStore.publicAdmin` — `passwordHash` حذف و `permissions` محاسبه می‌شود. */
export const ADMIN_PUBLIC_DTO = Object.freeze({
  entity: 'admin',
  source: 'contentStore.publicAdmin()',
  evidence: 'contentStore.js:805-809',
  forbidden: ['passwordHash'],
  computed: ['roleLabel', 'permissions'],
});

/* ─────────────────────────── اسکن نشت ─────────────────────────── */

const MAX_DEPTH = 8;

/**
 * جست‌وجوی بازگشتی کلیدهای ممنوع در یک ساختار.
 * @returns {{path: string, key: string}[]} مسیرها — `path` با نقطه جدا شده است.
 */
export function findSensitiveLeaks(value, { forbidden = HARD_FORBIDDEN_KEYS, depth = 0, path = '' } = {}) {
  const found = [];
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return found;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...findSensitiveLeaks(item, { forbidden, depth: depth + 1, path: `${path}[${index}]` }));
    });
    return found;
  }

  for (const [key, child] of Object.entries(value)) {
    const here = path ? `${path}.${key}` : key;
    if (forbidden.includes(key)) found.push({ path: here, key });
    found.push(...findSensitiveLeaks(child, { forbidden, depth: depth + 1, path: here }));
  }
  return found;
}

/**
 * بررسی انطباق یک مقدار با DTO (کلیدهای اضافی/غایب).
 * @returns {{extra: string[], missing: string[]}}
 */
export function diffAgainstDto(dtoName, sample) {
  const dto = PUBLIC_DTOS[dtoName];
  if (!dto || !dto.fields) return { extra: [], missing: [], unknown: true };

  const actual = Object.keys(sample ?? {});
  const extra = actual.filter((key) => !dto.fields.includes(key));
  const missing = dto.fields.filter((key) => !actual.includes(key));
  return { extra, missing, unknown: false };
}

/** برش یک رکورد به فیلدهای مجاز DTO (بدون تغییر ورودی). */
export function projectPublic(dtoName, record) {
  const dto = PUBLIC_DTOS[dtoName];
  if (!dto?.fields || !record || typeof record !== 'object') return record;
  const out = {};
  for (const field of dto.fields) {
    if (record[field] !== undefined) out[field] = record[field];
  }
  return out;
}

/**
 * گارد خروجی عمومی — در مرز HTTP صدا زده می‌شود.
 *
 * فقط کلیدهای **ممنوع مطلق** را می‌گیرد؛ پس روی دادهٔ سالم هیچ اثری ندارد و
 * تنها زمانی پرتاب می‌کند که واقعاً نشتی رخ داده باشد (tripwire، بند ۱۸).
 * @throws {Error & {code: string}} با کد `INTERNAL_ERROR` تا پاسخ ۵۰۰ شود.
 */
export function guardPublicOutput(dtoName, data) {
  const leaks = findSensitiveLeaks(data, { forbidden: forbiddenFor(dtoName) });
  if (!leaks.length) return data;

  const error = new Error(
    `نشت فیلد حساس در خروجی عمومی (${dtoName}): ${leaks.map((l) => l.path).join(', ')}`,
  );
  error.code = 'INTERNAL_ERROR';
  error.leaks = leaks;
  throw error;
}
