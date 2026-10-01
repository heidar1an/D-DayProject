/*
 * Schemaهای دامنهٔ «محتوا» — مقاله، دسته، صفحه، مرجع، میکرو، جامع، فلش‌کارت، بین‌الملل.
 *
 * ── مرز عمق اعتبارسنجی (تصمیم صریح) ─────────────────────────────────────────
 * سه سطح عمق داریم و هر سطح جای خودش را دارد:
 *
 *   ۱) عمیق (leaf-level): مقاله (`content` blocks)، تنظیمات، گزینه‌های سؤال.
 *      این‌ها ورودی مستقیم کاربر و بلوک‌های نمایشی‌اند؛ یک `type` ناشناخته
 *      می‌تواند به XSS یا رندر شکسته منتهی شود. پس تک‌تک فیلدها چک می‌شوند.
 *
 *   ۲) ساختاری (shape-level): درونِ درسنامهٔ میکرو و درسنامهٔ جامع
 *      (`topics[].units[].pages[].blocks[]`). این درخت‌ها ۸۵۰ کیلوبایت دادهٔ
 *      نویسندگی‌اند و بیش از ۴۰ نوع بلوک تودرتو دارند. اعتبارسنجی اینجا
 *      **شکل** را تضمین می‌کند (کلیدهای الزامی، نوع آرایه/آبجکت، شناسه‌های
 *      یکتا در دامنهٔ خودشان) و نه تک‌تک برگ‌ها.
 *
 *   ۳) تأییدنشده: `event` (بدون مصرف‌کننده).
 *
 * دلیل انتخاب سطح ۲ برای درسنامه‌ها: بند ۵۹ («بیش از حد abstraction نساز») و
 * بند ۶۰ (بازآرایی گسترده نکن). اگر فردا نویسنده‌ها بلوک تازه‌ای خواستند،
 * این لایه نباید سد راهشان شود؛ ولی *شکل* درخت باید سالم بماند.
 */

import {
  arr, bool, count, describe, enumOf, hexColor, id, idAnyOf, json, mapOf, num, obj,
  percent, ref, required, serverOnly, slug, str, strArray, timestamp,
} from '../fields.js';
import {
  CONTENT_LIFECYCLE, CONTENT_LIFECYCLE_TRANSITIONS, INTL_COURSE_CATEGORIES,
  INTL_LEVELS, INTL_PROVIDER_KINDS, INTL_STATUSES, PAGE_GROUPS, TEST_BANK_DIFFICULTIES,
} from '../enums.js';

/* ─────────────────────────── Enumهای محلی دامنه ─────────────────────────── */

/** مرجع: `contentStore.js` → `ACCENTS` (پالت لهجهٔ رنگی دسته‌ها) */
export const ACCENTS = ['blue', 'lavender', 'purple', 'sky', 'green', 'mint', 'copper', 'sage', 'gold'];

/** مرجع: `contentStore.js` → `REFERENCE_GLYPHS` */
export const REFERENCE_GLYPHS = ['bone', 'cell', 'heart'];

/** انواع بلوک محتوای مقاله — از دادهٔ واقعی `articles.json` (بند ۴۵) */
export const ARTICLE_BLOCK_TYPES = ['p', 'h2', 'list', 'olist', 'quote', 'callout', 'table', 'question', 'divider'];

/**
 * انواع بلوک صفحهٔ درسنامهٔ میکرو — از دادهٔ واقعی `microCourses.json`.
 * ⚠️ این فهرست **بسته نیست**: نویسنده‌ها بلوک تازه اضافه می‌کنند. پس به‌جای
 * رد کردن نوع ناشناخته، آن را WARN می‌کنیم و بدنهٔ بلوک را دست‌نخورده نگه
 * می‌داریم (بند ۴۵: «نوع ناشناخته نباید بدون تصمیم وارد داده شود» — تصمیم
 * ما «پذیرش با هشدار و ثبت در گزارش» است، نه حذف).
 */
export const MICRO_BLOCK_TYPES = [
  'intro', 'text', 'definition', 'table', 'keyPoint', 'figure', 'summary',
  'comparison', 'clinical', 'quickQuestion', 'warning', 'example', 'flashcards', 'crossCourse',
];

/** وضعیت دشواری مشترک محتوا — از دادهٔ واقعی */
export const CONTENT_DIFFICULTIES = TEST_BANK_DIFFICULTIES;

/** دامنهٔ «اهمیت» و «بسامد در آزمون» در درسنامه‌ها */
export const IMPORTANCE_LEVELS = [1, 2, 3, 4, 5];
export const EXAM_FREQUENCIES = ['low', 'medium', 'high', 'very_high'];

/* ─────────────────────────── اجزای مشترک ─────────────────────────── */

const seoSchema = obj({
  title: str({ max: 200 }),
  description: str({ max: 400 }),
  canonical: str({ max: 400 }),
  ogImage: str({ max: 400 }),
  robots: str({ max: 100 }),
});

const CREATED_AT = describe(serverOnly(timestamp()), 'زمان ساخت');
const UPDATED_AT = describe(serverOnly(timestamp()), 'زمان آخرین ویرایش');
const PUBLISHED_AT = describe(
  serverOnly({ ...timestamp(), nullable: true }),
  'زمان انتشار — فقط وقتی status=published معنا دارد',
);
const CREATED_BY = describe(serverOnly(str({ max: 80 })), 'سازنده — «seed» یا شناسهٔ مدیر');
const UPDATED_BY = describe(serverOnly(str({ max: 80 })), 'آخرین ویرایش‌کننده');

/* ─────────────────────────── بلوک محتوای مقاله ─────────────────────────── */

/**
 * بلوک محتوای مقاله — اتحاد تفکیک‌شده بر اساس `type`.
 * هر بلوک باید `type` معتبر داشته باشد و کلیدهای الزامی همان نوع را.
 */
export const articleBlockSchema = {
  kind: 'discriminated',
  description: 'بلوک محتوای مقاله',
  discriminator: 'type',
  /* ⚠️ `ARTICLE_BLOCK_TYPES` فهرست **بسته** است: نویسندهٔ مقاله فقط از این
     نوع‌ها استفاده می‌کند. پس نوع ناشناخته باید ERROR باشد، نه سکوت.
     (برخلاف بلوک درسنامهٔ میکرو که فهرستش باز است و WARN می‌دهد.) */
  variantsUnknownIsError: true,
  variants: {
    p: { requiredKeys: ['text'] },
    h2: { requiredKeys: ['text'] },
    list: { requiredKeys: ['items'], arrayKeys: ['items'] },
    olist: { requiredKeys: ['items'], arrayKeys: ['items'] },
    quote: { requiredKeys: ['text'] },
    callout: { requiredKeys: ['text'] },
    table: { requiredKeys: ['head', 'rows'], arrayKeys: ['head', 'rows'] },
    question: { requiredKeys: ['question', 'answer'] },
    divider: { requiredKeys: [] },
  },
};

/* ─────────────────────────── دسته‌بندی ─────────────────────────── */

export const categorySchema = {
  name: 'category',
  collection: 'categories',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/categories.json',
  description: 'دسته‌بندی مقاله. شناسهٔ آن دستی و معنادار است (مثل `physiology`).',
  fields: {
    id: required(id({ prefix: null })),
    label: describe(required(str({ min: 1, max: 120, allowEmpty: false })), 'عنوان نمایشی'),
    accent: describe(enumOf(ACCENTS, { name: 'ACCENTS' }), 'لهجهٔ رنگی'),
  },
};

/* ─────────────────────────── مقاله ─────────────────────────── */

export const articleSchema = {
  name: 'article',
  collection: 'articles',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/articles.json',
  description: 'مقالهٔ سایت. وضعیت فقط از چرخهٔ draft/published/archived.',
  fields: {
    id: required(id({ prefix: 'art' })),
    title: describe(required(str({ min: 1, max: 300, allowEmpty: false })), 'عنوان مقاله'),
    slug: describe(required(slug()), 'شناسهٔ URL — یکتا'),
    excerpt: str({ max: 600 }),
    contentHtml: describe(str({ max: 400000, trim: false }), 'HTML پاک‌شده — از sanitizeHtml می‌گذرد'),
    content: arr(articleBlockSchema, { max: 400 }),
    cover: str({ max: 400 }),
    coverAlt: str({ max: 300 }),
    /* `figure` کلید تصویر ثابت کاتالوگ است (مثل `anatomy`) و از پنل نمی‌آید */
    figure: { ...str({ max: 60 }), nullable: true },
    category: describe(required(ref('categories', { nullable: false })), 'دسته — الزامی و باید موجود باشد'),
    tags: strArray({ max: 20 }),
    authorName: str({ max: 120 }),
    status: describe(required(enumOf(CONTENT_LIFECYCLE, { name: 'CONTENT_LIFECYCLE' })), 'وضعیت انتشار'),
    featured: bool(),
    recommended: bool(),
    readingTime: describe(num({ min: 1, max: 600, int: true }), 'زمان مطالعه (دقیقه) — حداقل ۱'),
    views: count(),
    likes: count(),
    seo: seoSchema,
    origin: describe(enumOf(['tapesh', 'panel'], { name: 'ORIGIN' }), 'منشأ رکورد: کاتالوگ ثابت یا پنل'),
    publishedAt: PUBLISHED_AT,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: CREATED_BY,
    updatedBy: UPDATED_BY,
  },
  unique: [{ fields: ['slug'] }],
  transitions: { field: 'status', machine: 'CONTENT_LIFECYCLE' },
  transitionTables: { CONTENT_LIFECYCLE: CONTENT_LIFECYCLE_TRANSITIONS },
  crossField: ['publishedAtRequiresPublished'],
};

/* ─────────────────────────── صفحه ─────────────────────────── */

export const pageSchema = {
  name: 'page',
  collection: 'pages',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/pages.json',
  description: 'صفحهٔ معرفی لایه‌های تپش. گروه فقط از چهار مقدار مجاز است.',
  fields: {
    id: required(id({ prefix: 'pg' })),
    title: required(str({ min: 1, max: 200, allowEmpty: false })),
    slug: describe(required(slug()), 'شناسهٔ URL — یکتا'),
    group: describe(required(enumOf(PAGE_GROUPS, { name: 'PAGE_GROUPS' })), 'گروه نمایشی در پنل'),
    icon: str({ max: 60 }),
    route: describe(str({ max: 300 }), 'مسیر عمیق لایه؛ لایه‌های تبلیغاتی خالی دارند'),
    description: str({ max: 600 }),
    contentHtml: str({ max: 400000, trim: false }),
    status: required(enumOf(CONTENT_LIFECYCLE, { name: 'CONTENT_LIFECYCLE' })),
    cover: str({ max: 400 }),
    seo: seoSchema,
    publishedAt: PUBLISHED_AT,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: CREATED_BY,
    updatedBy: UPDATED_BY,
  },
  unique: [{ fields: ['slug'] }],
  transitions: { field: 'status', machine: 'CONTENT_LIFECYCLE' },
  transitionTables: { CONTENT_LIFECYCLE: CONTENT_LIFECYCLE_TRANSITIONS },
  crossField: ['publishedAtRequiresPublished'],
};

/* ─────────────────────────── مرجع ─────────────────────────── */

const referenceTopicSchema = obj({
  id: required(str({ min: 1, max: 120, allowEmpty: false })),
  title: required(str({ min: 1, max: 300, allowEmpty: false })),
  page: str({ max: 40 }),
  summary: str({ max: 2000 }),
  contentHtml: str({ max: 200000, trim: false }),
  blocks: arr(json(), { max: 200 }),
  concepts: arr(json(), { max: 100 }),
}, { allowUnknown: true });

const referenceSectionSchema = obj({
  id: required(str({ min: 1, max: 120, allowEmpty: false })),
  title: required(str({ min: 1, max: 300, allowEmpty: false })),
  topics: arr(referenceTopicSchema, { max: 200, uniqueBy: 'id' }),
}, { allowUnknown: true });

export const referenceSchema = {
  name: 'reference',
  collection: 'references',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/references.json',
  description: 'مرجع درسی — کل مرجع یک موجودیت مدیریتی است تا انتشار اتمیک بماند.',
  fields: {
    id: required(id({ prefix: null })),
    title: required(str({ min: 1, max: 200, allowEmpty: false })),
    latin: str({ max: 300 }),
    edition: str({ max: 80 }),
    authors: str({ max: 300 }),
    subject: str({ max: 120 }),
    /* ⚠️ رنگ مرجع hex است، نه نام لهجه — برخلاف دسته‌بندی مقاله */
    accent: describe(hexColor(), 'رنگ لهجه — hex (مثل #5b8cc7)'),
    pages: describe(num({ min: 1, max: 100000, int: true }), 'تعداد صفحه'),
    glyph: enumOf(REFERENCE_GLYPHS, { name: 'REFERENCE_GLYPHS' }),
    sections: arr(referenceSectionSchema, { max: 100, uniqueBy: 'id' }),
    status: required(enumOf(CONTENT_LIFECYCLE, { name: 'CONTENT_LIFECYCLE' })),
    origin: enumOf(['tapesh', 'panel'], { name: 'ORIGIN' }),
    publishedAt: PUBLISHED_AT,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: CREATED_BY,
    updatedBy: UPDATED_BY,
  },
  transitions: { field: 'status', machine: 'CONTENT_LIFECYCLE' },
  transitionTables: { CONTENT_LIFECYCLE: CONTENT_LIFECYCLE_TRANSITIONS },
};

/* ─────────────────────────── فلش‌کارت ─────────────────────────── */

/** شناسهٔ موضوع فلش‌کارت — رجیستری جدا از بانک تست. مرجع: `flashcards/mockData.js` → `SUBJECTS` */
export const FLASHCARD_SUBJECTS = [
  'physiology', 'anatomy', 'biochemistry', 'pharmacology',
  'microbiology', 'immunology', 'pathology', 'general',
];

/**
 * انواع کارت فلش‌کارت — از دادهٔ واقعی `flashcardDecks.json` استخراج شده.
 * ⚠️ این فهرست **بسته نیست**: سازندهٔ کارت در داشبورد می‌تواند نوع تازه بسازد.
 * پس مقدار ناشناخته در گزارش «هشدار» می‌شود، نه خطای سخت.
 */
export const FLASHCARD_CARD_TYPES = ['basic', 'cloze', 'mcq', 'image-locate', 'image-label'];

/** وضعیت کارت — تنها یک مقدار در دادهٔ واقعی دیده شده */
export const FLASHCARD_CARD_STATUSES = ['active', 'archived', 'draft'];

const cardImageSchema = obj({
  url: str({ max: 400 }),
  alt: str({ max: 300 }),
  points: arr(obj({ x: num(), y: num(), label: str({ max: 120 }) }, { allowUnknown: true }), { max: 40 }),
}, { allowUnknown: true });

const flashcardCardSchema = obj({
  id: required(str({ min: 1, max: 80, allowEmpty: false })),
  type: describe(enumOf(FLASHCARD_CARD_TYPES, { name: 'FLASHCARD_CARD_TYPES' }), 'نوع کارت'),
  front: str({ max: 2000, trim: false }),
  back: str({ max: 4000, trim: false }),
  hint: str({ max: 600 }),
  tags: strArray({ max: 20 }),
  subjectId: enumOf(FLASHCARD_SUBJECTS, { name: 'FLASHCARD_SUBJECTS' }),
  topicId: str({ max: 120 }),
  explanation: str({ max: 2000 }),
  status: describe(enumOf(FLASHCARD_CARD_STATUSES, { name: 'FLASHCARD_CARD_STATUSES' }), 'وضعیت کارت'),
  image: { ...cardImageSchema, nullable: true },
}, { allowUnknown: true });

export const flashcardDeckSchema = {
  name: 'flashcardDeck',
  collection: 'flashcardDecks',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/flashcardDecks.json',
  description: 'دک فلش‌کارت. دک و کارت یک موجودیت مدیریتی‌اند (انتشار اتمیک).',
  fields: {
    /* دو پیشوند در دادهٔ واقعی هست: `fcd-` (پنل) و `deck-` (کاتالوگ ثابت) */
    id: describe(required(idAnyOf(['fcd', 'deck'])), 'شناسهٔ دک'),
    title: required(str({ min: 1, max: 200, allowEmpty: false })),
    shortTitle: str({ max: 80 }),
    description: str({ max: 1000 }),
    /* ⚠️ شناسهٔ موضوع اینجا از رجیستری فلش‌کارت می‌آید، نه بانک تست.
       دو رجیستری موازی‌اند و `pharmacology`/`general` فقط در همین یکی هست. */
    subjectId: describe(
      enumOf(FLASHCARD_SUBJECTS, { name: 'FLASHCARD_SUBJECTS' }),
      'موضوع — رجیستری فلش‌کارت (نه بانک تست)',
    ),
    level: str({ max: 60 }),
    cover: str({ max: 120 }),
    anatomy: describe(bool(), 'پرچم دک آناتومی — در لایهٔ سه‌بعدی استفاده می‌شود'),
    previewImage: str({ max: 400 }),
    status: required(enumOf(CONTENT_LIFECYCLE, { name: 'CONTENT_LIFECYCLE' })),
    origin: enumOf(['tapesh', 'panel'], { name: 'ORIGIN' }),
    cards: arr(flashcardCardSchema, { max: 500, uniqueBy: 'id' }),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: CREATED_BY,
    updatedBy: UPDATED_BY,
  },
  transitions: { field: 'status', machine: 'CONTENT_LIFECYCLE' },
  transitionTables: { CONTENT_LIFECYCLE: CONTENT_LIFECYCLE_TRANSITIONS },
};

/* ─────────────────────────── میکرو درسنامه ─────────────────────────── */

/** شناسهٔ موضوع میکرو — مرجع: `src/data/micro/registry.js` → `MICRO_SUBJECT_OPTIONS` */
export const MICRO_SUBJECTS = [
  'physiology', 'anatomy', 'biochemistry', 'embryology', 'english', 'entomology',
  'genetics', 'histology', 'hygiene', 'immunology', 'microbiology', 'mycology',
  'parasitology', 'pathology', 'pharmacology', 'virology',
];

const microConceptSchema = obj({
  id: required(str({ min: 1, max: 120, allowEmpty: false })),
  title: required(str({ min: 1, max: 300, allowEmpty: false })),
  english: str({ max: 300 }),
  importance: num({ min: 1, max: 5, int: true }),
  examFrequency: enumOf(EXAM_FREQUENCIES, { name: 'EXAM_FREQUENCIES' }),
  crossCourse: arr(json(), { max: 30 }),
}, { allowUnknown: true });

const microPageSchema = obj({
  id: required(str({ min: 1, max: 120, allowEmpty: false })),
  order: num({ min: 0, max: 10000, int: true }),
  title: required(str({ min: 1, max: 300, allowEmpty: false })),
  learningObjective: str({ max: 2000 }),
  estimatedTime: num({ min: 0, max: 100000 }),
  difficulty: enumOf(CONTENT_DIFFICULTIES, { name: 'CONTENT_DIFFICULTIES' }),
  importance: num({ min: 1, max: 5, int: true }),
  examFrequency: enumOf(EXAM_FREQUENCIES, { name: 'EXAM_FREQUENCIES' }),
  keywords: strArray({ max: 60 }),
  concepts: arr(str({ max: 120 }), { max: 60, unique: true }),
  /* ⚠️ `content` یک رشتهٔ HTML است، نه آرایه — `blocks` ساختار تفکیک‌شده است */
  content: describe(str({ max: 400000, trim: false }), 'HTML صفحه — رشتهٔ یکپارچه'),
  blocks: arr(json(), { max: 300 }),
}, { allowUnknown: true });

/*
 * ایستگاه تست درون واحد.
 * ⚠️ `afterPage` و `scopePages` **شناسهٔ صفحه**اند (`p04`)، نه شمارهٔ ترتیبی.
 * این‌ها ارجاع درون‌سندی‌اند: به `pages[].id` همان واحد اشاره می‌کنند و
 * یکپارچگیشان با بررسی عمیق `microCheckpointPageRefs` سنجیده می‌شود.
 */
const microCheckpointSchema = obj({
  id: required(str({ min: 1, max: 120, allowEmpty: false })),
  afterPage: describe(str({ max: 120 }), 'شناسهٔ صفحه‌ای که ایستگاه بعدش می‌آید'),
  questionCount: num({ min: 0, max: 200, int: true }),
  required: bool(),
  scopePages: describe(arr(str({ max: 120 }), { max: 200, unique: true }), 'شناسهٔ صفحه‌های در دامنه'),
  pinnedQuestionIds: arr(str({ max: 120 }), { max: 200, unique: true }),
  questions: arr(json(), { max: 200 }),
}, { allowUnknown: true });

const microUnitSchema = obj({
  id: required(str({ min: 1, max: 120, allowEmpty: false })),
  title: required(str({ min: 1, max: 300, allowEmpty: false })),
  learningObjective: str({ max: 2000 }),
  estimatedTime: num({ min: 0, max: 100000 }),
  difficulty: enumOf(CONTENT_DIFFICULTIES, { name: 'CONTENT_DIFFICULTIES' }),
  checkpointInterval: num({ min: 1, max: 100, int: true }),
  testBank: json(),
  finalAssessment: json(),
  concepts: arr(microConceptSchema, { max: 200, uniqueBy: 'id' }),
  pages: arr(microPageSchema, { max: 200, uniqueBy: 'id' }),
  checkpoints: arr(microCheckpointSchema, { max: 100, uniqueBy: 'id' }),
}, { allowUnknown: true });

const microTopicSchema = obj({
  id: required(str({ min: 1, max: 120, allowEmpty: false })),
  title: required(str({ min: 1, max: 300, allowEmpty: false })),
  description: str({ max: 2000 }),
  accent: str({ max: 40 }),
  published: bool(),
  units: arr(microUnitSchema, { max: 100, uniqueBy: 'id' }),
}, { allowUnknown: true });

export const microCourseSchema = {
  name: 'microCourse',
  collection: 'microCourses',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/microCourses.json',
  description: 'میکرو درسنامه — کل درسنامه یک رکورد است (مبحث → واحد → صفحه → بلوک).',
  fields: {
    id: required(id({ prefix: 'mcr' })),
    subjectId: describe(required(enumOf(MICRO_SUBJECTS, { name: 'MICRO_SUBJECTS' })), 'موضوع — رجیستری میکرو'),
    title: required(str({ min: 1, max: 300, allowEmpty: false })),
    englishTitle: str({ max: 300 }),
    kicker: str({ max: 200 }),
    description: str({ max: 4000 }),
    accent: describe(hexColor(), 'رنگ لهجه — hex'),
    estimatedTime: describe(num({ min: 0, max: 100000 }), 'زمان تخمینی (دقیقه)'),
    difficulty: enumOf(CONTENT_DIFFICULTIES, { name: 'CONTENT_DIFFICULTIES' }),
    checkpointInterval: num({ min: 1, max: 100, int: true }),
    status: required(enumOf(['draft', 'published', 'archived'], { name: 'CONTENT_LIFECYCLE' })),
    topics: arr(microTopicSchema, { max: 100, uniqueBy: 'id' }),
    publishedAt: PUBLISHED_AT,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: CREATED_BY,
    updatedBy: UPDATED_BY,
  },
  transitions: { field: 'status', machine: 'CONTENT_LIFECYCLE' },
  transitionTables: { CONTENT_LIFECYCLE: CONTENT_LIFECYCLE_TRANSITIONS },
  crossField: ['publishedAtRequiresPublished'],
  deepCheck: 'microCheckpointPageRefs',
};

/* ─────────────────────────── درسنامهٔ جامع ─────────────────────────── */

/** وضعیت ماژول در درسنامهٔ جامع — از دادهٔ واقعی (enum مستندنشدهٔ پروژه) */
export const COMPREHENSIVE_MODULE_STATUSES = ['fresh', 'learning', 'completed'];

const comprehensiveModuleSchema = obj({
  id: required(str({ min: 1, max: 120, allowEmpty: false })),
  order: num({ min: 0, max: 10000, int: true }),
  title: required(str({ min: 1, max: 300, allowEmpty: false })),
  description: str({ max: 2000 }),
  unitCount: count({ max: 10000 }),
  tests: count({ max: 1000000 }),
  progress: percent(),
  status: enumOf(COMPREHENSIVE_MODULE_STATUSES, { name: 'COMPREHENSIVE_MODULE_STATUSES' }),
  lastActivity: str({ max: 200 }),
  available: bool(),
}, { allowUnknown: true });

const comprehensiveUnitSchema = obj({
  id: required(str({ min: 1, max: 120, allowEmpty: false })),
  moduleId: str({ max: 120 }),
  order: num({ min: 0, max: 10000, int: true }),
  title: required(str({ min: 1, max: 300, allowEmpty: false })),
  description: str({ max: 2000 }),
  estimatedTime: num({ min: 0, max: 100000 }),
  sectionCount: count({ max: 10000 }),
  tests: count({ max: 1000000 }),
  objectives: strArray({ max: 40 }),
  prerequisites: strArray({ max: 40 }),
  status: str({ max: 40 }),
  progress: percent(),
  mastery: percent(),
  lastActivity: str({ max: 200 }),
  steps: arr(json(), { max: 100 }),
  /* هر unit در فاز ۲ قرارداد `testBank` و `celebration` گرفت */
  testBank: json(),
  celebration: json(),
  learning: json(),
}, { allowUnknown: true });

export const comprehensiveCourseSchema = {
  name: 'comprehensiveCourse',
  collection: 'comprehensiveCourses',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/comprehensiveCourses.json',
  description: 'درسنامهٔ جامع — درس، ماژول‌ها و واحدها. `unitsByModule` نگاشت moduleId → واحدها.',
  fields: {
    id: required(id({ prefix: null })),
    title: required(str({ min: 1, max: 300, allowEmpty: false })),
    subtitle: str({ max: 400 }),
    description: str({ max: 4000 }),
    modules: arr(comprehensiveModuleSchema, { max: 100, uniqueBy: 'id' }),
    unitsByModule: describe(mapOf(null), 'نگاشت moduleId → واحدها (کلیدها آزاد)'),
    status: required(enumOf(CONTENT_LIFECYCLE, { name: 'CONTENT_LIFECYCLE' })),
    origin: enumOf(['tapesh', 'panel'], { name: 'ORIGIN' }),
    publishedAt: PUBLISHED_AT,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: CREATED_BY,
    updatedBy: UPDATED_BY,
  },
  transitions: { field: 'status', machine: 'CONTENT_LIFECYCLE' },
  transitionTables: { CONTENT_LIFECYCLE: CONTENT_LIFECYCLE_TRANSITIONS },
  /** اعتبارسنجی عمیق `unitsByModule` جداگانه انجام می‌شود (نگاشت آزاد) */
  deepCheck: 'comprehensiveUnitsByModule',
};

/* ─────────────────────────── بین‌الملل — منبع ─────────────────────────── */

export const intlProviderSchema = {
  name: 'intlProvider',
  collection: 'intlProviders',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/intlProviders.json',
  description: 'منبع/دانشگاه دوره‌های بین‌الملل. حذفش باید با دوره‌های وابسته هماهنگ شود.',
  fields: {
    id: required(id({ prefix: null })),
    name: required(str({ min: 1, max: 200, allowEmpty: false })),
    nameEn: str({ max: 200 }),
    kind: describe(required(enumOf(INTL_PROVIDER_KINDS, { name: 'INTL_PROVIDER_KINDS' })), 'نوع منبع'),
    country: str({ max: 120 }),
    founded: describe(str({ max: 40 }), 'سال تأسیس — رشته است، نه عدد (دادهٔ نمایشی)'),
    description: str({ max: 4000 }),
    focus: strArray({ max: 20 }),
    logo: str({ max: 400 }),
    logoKey: str({ max: 120 }),
    sortOrder: num({ min: 0, max: 10000, int: true }),
    marqueeOrder: num({ min: 0, max: 10000, int: true }),
    status: required(enumOf(INTL_STATUSES, { name: 'INTL_STATUSES' })),
    origin: enumOf(['tapesh', 'panel'], { name: 'ORIGIN' }),
    publishedAt: PUBLISHED_AT,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: CREATED_BY,
    updatedBy: UPDATED_BY,
  },
  unique: [{ fields: ['logoKey'], ignoreEmpty: true }],
  transitions: { field: 'status', machine: 'CONTENT_LIFECYCLE' },
  transitionTables: { CONTENT_LIFECYCLE: CONTENT_LIFECYCLE_TRANSITIONS },
};

/* ─────────────────────────── بین‌الملل — دوره ─────────────────────────── */

const intlSubtitleSchema = obj({
  lang: describe(enumOf(['fa', 'en', 'de', 'fr', 'es', 'tr', 'ru', 'zh'], { name: 'INTL_SUBTITLE_LANGS' }), 'زبان زیرنویس'),
  url: str({ max: 600 }),
  label: str({ max: 120 }),
}, { allowUnknown: true });

const intlSectionSchema = obj({
  id: required(str({ min: 1, max: 120, allowEmpty: false })),
  title: required(str({ min: 1, max: 300, allowEmpty: false })),
  time: str({ max: 40 }),
  desc: str({ max: 2000 }),
  videoUrl: str({ max: 600 }),
  videoMime: str({ max: 120 }),
  subtitles: arr(intlSubtitleSchema, { max: 20 }),
}, { allowUnknown: true });

export const intlCourseSchema = {
  name: 'intlCourse',
  collection: 'intlCourses',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/intlCourses.json',
  description: 'دورهٔ بین‌الملل. هر دوره به یک منبع موجود ارجاع می‌دهد.',
  fields: {
    id: required(id({ prefix: null })),
    title: required(str({ min: 1, max: 300, allowEmpty: false })),
    providerId: describe(required(ref('intlProviders', { nullable: false })), 'منبع — الزامی و باید موجود باشد'),
    category: enumOf(INTL_COURSE_CATEGORIES, { name: 'INTL_COURSE_CATEGORIES' }),
    categoryLabel: str({ max: 120 }),
    level: describe(enumOf(INTL_LEVELS, { name: 'INTL_LEVELS' }), 'سطح — مقدار فارسی'),
    badge: str({ max: 60 }),
    duration: describe(num({ min: 0, max: 10000 }), 'مدت (ساعت)'),
    totalDuration: describe(str({ max: 40 }), 'مدت نمایشی با ارقام فارسی — مثل «۰۸:۴۲:۰۰»'),
    progress: percent(),
    accent: describe(hexColor(), 'رنگ لهجه — hex'),
    accentSoft: describe(hexColor(), 'رنگ لهجهٔ ملایم — hex'),
    description: str({ max: 4000 }),
    tags: strArray({ max: 20 }),
    image: str({ max: 600 }),
    imageKey: str({ max: 120 }),
    sortOrder: num({ min: 0, max: 10000, int: true }),
    sections: arr(intlSectionSchema, { max: 200, uniqueBy: 'id' }),
    status: required(enumOf(INTL_STATUSES, { name: 'INTL_STATUSES' })),
    origin: enumOf(['tapesh', 'panel'], { name: 'ORIGIN' }),
    publishedAt: PUBLISHED_AT,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    createdBy: CREATED_BY,
    updatedBy: UPDATED_BY,
  },
  transitions: { field: 'status', machine: 'CONTENT_LIFECYCLE' },
  transitionTables: { CONTENT_LIFECYCLE: CONTENT_LIFECYCLE_TRANSITIONS },
  crossField: ['publishedAtRequiresPublished'],
};

/* ─────────────────────────── صادرات دامنه ─────────────────────────── */

export const CONTENT_SCHEMAS = [
  categorySchema, articleSchema, pageSchema, referenceSchema,
  flashcardDeckSchema, microCourseSchema, comprehensiveCourseSchema,
  intlProviderSchema, intlCourseSchema,
];
