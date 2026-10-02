/*
 * رجیستری Enumهای دامنه — «تنها منبع حقیقت» لایهٔ Schema.
 *
 * ── چرا اینجا تکرار شده و چرا امن است ────────────────────────────────────────
 * چند Enum پروژه از قبل در ماژول‌های دیگر زندگی می‌کنند (`mediaStore.js`،
 * `contentStore.js`، `testBank/mockData.js`، `notes/mockData.js`،
 * `intlCatalog.js`، `analyticsStore.js`، `publishingStore.js`). آن ماژول‌ها
 * سنگین‌اند (تا ۱۹۱ کیلوبایت) و import کردنشان در مسیر داغ اعتبارسنجی، هم کند
 * است و هم خطر import چرخه‌ای می‌سازد (این فایل را همان storeها هم می‌خوانند).
 *
 * پس اینجا Enumها به‌صورت **آرایهٔ خالص** اعلام می‌شوند و یک تست انطباق
 * (`database/dataIntegrity.test.mjs` → بخش «Enum Conformance») تضمین می‌کند که
 * مقادیر این فایل با جدول‌های اصلی پروژه مو‌به‌مو یکی است. اگر روزی کسی
 * `CONTENT_STATUSES` را در `mediaStore.js` عوض کند و اینجا را نه، تست شکست
 * می‌خورد — یعنی واگرایی بی‌صدا غیرممکن است.
 *
 * هر Enum شکل `{ id, label, tone? }` یا آرایهٔ رشته‌ای خالص دارد؛ تابع
 * `values()` همیشه آرایهٔ رشته‌ای `id`ها را می‌دهد.
 */

/* ─────────────────────────── نقش‌های پنل ─────────────────────────── */

/** مرجع: `contentStore.js` → `ROLES` */
export const ADMIN_ROLES = ['super-admin', 'admin', 'editor'];

/* ─────────────────────────── چرخهٔ انتشار محتوا ─────────────────────────── */

/** مرجع: `contentStore.js` → `ARTICLE_STATUSES` (و `INTL_STATUSES` همریخت) */
export const CONTENT_LIFECYCLE = ['draft', 'published', 'archived'];

/** گذارهای مجاز چرخهٔ انتشار. مرجع رفتار: `setArticleStatus` / `setMicroStatus` / `setIntlStatus` */
export const CONTENT_LIFECYCLE_TRANSITIONS = {
  draft: ['published', 'archived'],
  published: ['draft', 'archived'],
  archived: ['draft', 'published'],
};

/** گروه‌های لایهٔ «صفحات» پنل. مرجع: `contentStore.js` → `PAGE_GROUPS` */
export const PAGE_GROUPS = ['learning', 'assessment', 'knowledge', 'marketing'];

/* ─────────────────────────── مرکز رسانه ─────────────────────────── */
/* همهٔ این‌ها مرجعشان `mediaStore.js` است (جدول‌های صادرشدهٔ همان فایل). */

/** `mediaStore.js` → `CONTENT_STATUSES` */
export const MEDIA_CONTENT_STATUSES = [
  'draft', 'review', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled', 'archived',
];

/** `mediaStore.js` → `CONTENT_TRANSITIONS` (ماشین وضعیت گردش تأیید) */
export const MEDIA_CONTENT_TRANSITIONS = {
  draft: ['review', 'scheduled', 'cancelled', 'archived'],
  review: ['approved', 'draft', 'cancelled'],
  approved: ['scheduled', 'draft', 'cancelled'],
  scheduled: ['published', 'publishing', 'draft', 'cancelled', 'failed'],
  publishing: ['published', 'failed'],
  published: ['archived'],
  failed: ['scheduled', 'draft', 'cancelled'],
  cancelled: ['draft', 'archived'],
  archived: ['draft'],
};

/** `mediaStore.js` → `CONTENT_TYPES` */
export const MEDIA_CONTENT_TYPES = [
  'post', 'story', 'reel', 'short', 'video', 'article', 'thread', 'tweet',
  'telegram-post', 'announcement', 'poll', 'quiz', 'carousel', 'infographic',
  'podcast', 'live',
];

/** `mediaStore.js` → `ACCOUNT_KINDS` */
export const MEDIA_ACCOUNT_KINDS = ['channel', 'page', 'profile', 'group', 'site', 'show', 'list'];

/** `mediaStore.js` → `MEDIA_ROLES` */
export const MEDIA_TEAM_ROLES = [
  'admin', 'media-manager', 'content-manager', 'writer', 'designer',
  'video-editor', 'social-manager', 'reviewer', 'analyst',
];

/** `mediaStore.js` → `CAMPAIGN_STATUSES` */
export const MEDIA_CAMPAIGN_STATUSES = ['planned', 'active', 'paused', 'finished', 'archived'];

/** `mediaStore.js` → `INBOX_STATUSES` */
export const MEDIA_INBOX_STATUSES = ['unread', 'read', 'pending', 'answered', 'ignored', 'important'];

/** `mediaStore.js` → `INBOX_KINDS` */
export const MEDIA_INBOX_KINDS = ['comment', 'dm', 'message', 'mention'];

/** `mediaStore.js` → `NOTIFICATION_LEVELS` */
export const MEDIA_NOTIFICATION_LEVELS = ['info', 'success', 'warn', 'critical'];

/**
 * انواع اعلان مرکز رسانه.
 * در `mediaStore.js` جدول صادرشده‌ای ندارد؛ مقادیر از `notify()` و دادهٔ واقعی
 * استخراج شده‌اند. اگر مقدار تازه‌ای اضافه شد، اینجا هم باید بیاید.
 */
export const MEDIA_NOTIFICATION_KINDS = [
  'publish-dry-run', 'campaign-ended', 'content-publish-failed', 'content-review-pending',
];

/** `mediaStore.js` → `TAG_KINDS` */
export const MEDIA_TAG_KINDS = ['hashtag', 'topic'];

/** `mediaStore.js` → `ASSET_KINDS` */
export const MEDIA_ASSET_KINDS = [
  'image', 'video', 'audio', 'thumbnail', 'logo', 'poster', 'infographic', 'gif', 'document',
];

/** `mediaStore.js` → `UTM_MEDIUMS` */
export const MEDIA_UTM_MEDIUMS = ['social', 'social-paid', 'email', 'referral', 'qr'];

/** `mediaStore.js` → `MEDIA_ENTITY_TYPES` */
export const MEDIA_ENTITY_TYPES = [
  'media-platform', 'media-account', 'media-content', 'media-campaign', 'media-team',
  'media-asset', 'media-tag', 'media-utm', 'media-inbox', 'media-mention', 'media-notification',
];

/** `mediaStore.js` → `MEDIA_MENTION_SENTIMENTS` (شکل داده: positive/neutral/negative) */
export const MEDIA_MENTION_SENTIMENTS = ['positive', 'neutral', 'negative'];

/** شناسهٔ پلتفرم‌های ثبت‌شده — با `mediaPlatforms.json` یکی است */
export const MEDIA_PLATFORMS = ['instagram', 'telegram', 'eitaa', 'bale'];

/* ─────────────────────────── انتشار ─────────────────────────── */

/** `publishingStore.js` → `PUBLISH_STATUSES` */
export const PUBLISH_LOG_STATUSES = ['sent', 'failed', 'dry-run'];

/** کدهای خطای انتشار — از `adminApi.js` `STATUS_BY_CODE` + `publishers/*.js` */
export const PUBLISH_ERROR_CODES = [
  'PUBLISH_NO_TOKEN', 'PUBLISH_UNAUTHORIZED', 'PUBLISH_FORBIDDEN',
  'PUBLISH_UNREACHABLE', 'PUBLISH_TIMEOUT', 'PUBLISH_FAILED',
];

/** منبع توکن هنگام ارسال — `channel` یعنی از رکورد کانال، `none` یعنی نبود */
export const PUBLISH_TOKEN_SOURCES = ['channel', 'none'];

/* ─────────────────────────── بانک تست ─────────────────────────── */

/** `testBank/mockData.js` → `DIFFICULTIES` */
export const TEST_BANK_DIFFICULTIES = ['easy', 'medium', 'hard', 'very_hard'];

/** `testBank/mockData.js` → `QUESTION_TYPES` */
export const TEST_BANK_TYPES = [
  'single', 'concept', 'memorization', 'calculation', 'clinical', 'image', 'combined',
];

/** `testBank/mockData.js` → `SOURCES` */
export const TEST_BANK_SOURCES = ['official', 'comprehensive', 'tapesh'];

/** `testBank/mockData.js` → `TRACKS` */
export const TEST_BANK_TRACKS = ['medicine', 'dentistry'];

/** مرجع: `contentStore.js` → `ARTICLE_STATUSES` (وضعیت انتشار سؤال) */
export const TEST_BANK_STATUSES = CONTENT_LIFECYCLE;

/* ─────────────────────────── آزمون‌های هماهنگ ─────────────────────────── */

/** `examStore.js` — انواع آزمون از دادهٔ واقعی `exams.json` */
export const EXAM_TYPES = ['national', 'subject', 'quiz', 'mock', 'comprehensive'];

/** `examStore.js` — سطح دشواری آزمون */
export const EXAM_DIFFICULTIES = ['easy', 'medium', 'hard'];

/** `examStore.js` — سطح دشواری سؤال آزمون */
export const EXAM_QUESTION_DIFFICULTIES = ['easy', 'medium', 'hard'];

/* ─────────────────────────── بین‌الملل ─────────────────────────── */

/** `intlCatalog.js` → `INTL_PROVIDER_KINDS` */
export const INTL_PROVIDER_KINDS = ['university', 'media', 'journal', 'organization'];

/** `intlCatalog.js` → `INTL_LEVELS` */
export const INTL_LEVELS = ['مقدماتی', 'متوسط', 'پیشرفته'];

/** `intlCatalog.js` → `INTL_COURSE_CATEGORIES` */
export const INTL_COURSE_CATEGORIES = ['medicine', 'science', 'skills', 'media'];

/** `intlCatalog.js` → `INTL_SUBTITLE_LANGS` */
export const INTL_SUBTITLE_LANGS = ['fa', 'en', 'de', 'fr', 'es', 'tr', 'ru', 'zh'];

/** `contentStore.js` → `INTL_STATUSES` */
export const INTL_STATUSES = CONTENT_LIFECYCLE;

/* ─────────────────────────── یادداشت‌ها ─────────────────────────── */

/** `notes/mockData.js` → `NOTE_KINDS` */
export const NOTE_KINDS = ['text', 'checklist', 'qa', 'table'];

/** `notes/mockData.js` → `SOURCE_TYPES` */
export const NOTE_SOURCE_TYPES = ['lesson', 'question', 'article', 'wiki', 'book', 'other'];

/* ─────────────────────────── هشدارهای تحلیل ─────────────────────────── */

/** `analyticsStore.js` → `ALERT_METRICS` */
export const ALERT_METRICS = [
  'page_views', 'signups', 'test_submits', 'error_rate', 'failed_logins',
  'server_latency', 'lcp', 'memory', 'disk', 'revenue', 'seo_position',
];

/** `analyticsStore.js` → مقادیر مجاز `comparator` */
export const ALERT_COMPARATORS = ['above', 'below', 'drop', 'rise'];

/** `analyticsStore.js` → مقادیر مجاز `severity` */
export const ALERT_SEVERITIES = ['critical', 'high', 'medium', 'low'];

/** کانال اعلان هشدار — `panel` تنها کانال پیاده‌شده است */
export const ALERT_CHANNELS = ['panel'];

/* ─────────────────────────── بازخورد کاربران ─────────────────────────── */

/** `feedbackStore.js` → تنها دو وضعیت وجود دارد */
export const FEEDBACK_STATUSES = ['open', 'resolved'];

/** منابع بازخورد — از دادهٔ واقعی `feedback.json` */
export const FEEDBACK_SOURCES = ['support', 'exam', 'app'];

/* ─────────────────────────── فعالیت پنل ─────────────────────────── */

/**
 * نوع Entity در لاگ فعالیت.
 * با `MEDIA_ENTITY_TYPES` هم‌پوشانی دارد ولی کامل‌تر است (دامنه‌های پنل).
 * مرجع: `logActivity()` در `contentStore.js` + دادهٔ واقعی `activity.json`.
 */
export const ACTIVITY_ENTITY_TYPES = [
  'admin', 'article', 'category', 'page', 'media', 'banner', 'note', 'alert',
  'channel', 'publish', 'analytics', 'feedback', 'settings', 'session',
  'flashcard-deck', 'test-bank', 'micro-course', 'reference', 'comprehensive-course',
  'intl-course', 'intl-media',
  ...MEDIA_ENTITY_TYPES,
];

/**
 * `action` در لاگ فعالیت یک Enum بسته نیست — الگوی `domain.verb` است و هر
 * قابلیت تازه می‌تواند فعل تازه بسازد. به‌جای Enum، **الگو** اعتبارسنجی می‌شود.
 */
export const ACTIVITY_ACTION_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

/** شناسهٔ مصنوعی «سیستم» در لاگ فعالیت — کاربر واقعی نیست */
export const SYSTEM_ACTOR_ID = 'system';

/* ─────────────────────────── کاربر سایت ─────────────────────────── */

/*
 * ⚠️ منبع حقیقت این دو Enum، **فرم ثبت‌نام مرحلهٔ دوم** است، نه فهرست دستی:
 * `src/layout/SecondaryRegistrationLayout.jsx` → `motivationOptions` / `referralOptions`.
 *
 * چرا اصلاح شد (یافتهٔ واقعی `data:check`): فهرست قبلی از یک نسخهٔ قدیمیِ UI نوشته
 * شده بود و با گزینه‌های واقعی فرم هم‌خوان نبود. نتیجه‌اش یک نقص خاموش بود:
 * کاربر می‌توانست گزینه‌ای را در فرم انتخاب کند که **مدل داده آن را رد می‌کرد**
 * (`enum` در `data:check`) — یعنی ذخیرهٔ پروفایل کاربر با دادهٔ نامعتبر.
 * مقادیر واقعیِ موجود در `database/users.json` شاهدِ همین ناهم‌خوانی بودند:
 * `experience`/`learning` در motivations و `rubika`/`internet` در referralSources.
 *
 * قاعدهٔ نگه‌داشت: هر گزینهٔ تازه در فرم باید **همان‌جا** اینجا هم بیاید.
 */
export const USER_MOTIVATIONS = [
  'learning', 'income', 'no-goal', 'friends',
  'helping-people', 'personal-interest', 'family-job', 'experience',
];

/** `SecondaryRegistrationLayout.jsx` → `referralOptions` مقادیر واقعی */
export const USER_REFERRAL_SOURCES = [
  'telegram', 'internet', 'friends', 'university',
  'bale', 'instagram', 'rubika', 'artificial-intelligence',
];

/* ─────────────────────────── شکل Enum ─────────────────────────── */

/**
 * Enum را به آرایهٔ رشته‌ای `id` تبدیل می‌کند.
 * هم آرایهٔ رشته‌ای خالص و هم جدول `{ id, label }` را می‌پذیرد تا تعریف Enum
 * در این فایل یکدست بماند.
 */
export function values(definition) {
  if (!Array.isArray(definition)) return [];
  return definition.map((item) => (typeof item === 'string' ? item : item?.id)).filter((id) => typeof id === 'string');
}

/**
 * `analyticsStore.js` → `EVENT_TYPES`.
 *
 * ⚠️ **ترتیب مهم است:** این آرایه آینهٔ `Set` اصلی است و تست انطباق برابری
 * ترتیبی را می‌سنجد. `normalizeEvent()` هر مقدار ناشناخته را به `page_view`
 * برمی‌گرداند، پس مقدار ذخیره‌شده همیشه عضوی از همین فهرست است.
 *
 * ⚠️ **باید پیش از `ENUM_REGISTRY` تعریف شود** — رجیستری به آن ارجاع می‌دهد و
 * `const` در ناحیهٔ مردهٔ زمانی است؛ تعریفِ بعد از رجیستری یعنی
 * «Cannot access before initialization» در لحظهٔ بارگذاری ماژول.
 */
export const ANALYTICS_EVENT_TYPES = [
  'page_view', 'session_start', 'signup', 'login', 'logout',
  'article_read', 'lesson_view', 'wiki_view', 'test_start', 'test_submit',
  'flashcard_review', 'feature_use', 'search', 'cwv', 'js_error', 'api_error', 'purchase',
];

/** تنها Enumهای بسته‌ای که اعتبارسنجی می‌کند — یک نگاشت نام → آرایه. */
export const ENUM_REGISTRY = Object.freeze({
  ADMIN_ROLES,
  CONTENT_LIFECYCLE,
  PAGE_GROUPS,
  MEDIA_CONTENT_STATUSES,
  MEDIA_CONTENT_TYPES,
  MEDIA_ACCOUNT_KINDS,
  MEDIA_TEAM_ROLES,
  MEDIA_CAMPAIGN_STATUSES,
  MEDIA_INBOX_STATUSES,
  MEDIA_INBOX_KINDS,
  MEDIA_NOTIFICATION_LEVELS,
  MEDIA_NOTIFICATION_KINDS,
  MEDIA_TAG_KINDS,
  MEDIA_ASSET_KINDS,
  MEDIA_UTM_MEDIUMS,
  MEDIA_MENTION_SENTIMENTS,
  MEDIA_PLATFORMS,
  PUBLISH_LOG_STATUSES,
  PUBLISH_ERROR_CODES,
  PUBLISH_TOKEN_SOURCES,
  TEST_BANK_DIFFICULTIES,
  TEST_BANK_TYPES,
  TEST_BANK_SOURCES,
  TEST_BANK_TRACKS,
  TEST_BANK_STATUSES,
  EXAM_TYPES,
  EXAM_DIFFICULTIES,
  EXAM_QUESTION_DIFFICULTIES,
  INTL_PROVIDER_KINDS,
  INTL_LEVELS,
  INTL_COURSE_CATEGORIES,
  INTL_SUBTITLE_LANGS,
  INTL_STATUSES,
  NOTE_KINDS,
  NOTE_SOURCE_TYPES,
  ALERT_METRICS,
  ALERT_COMPARATORS,
  ALERT_SEVERITIES,
  ALERT_CHANNELS,
  FEEDBACK_STATUSES,
  FEEDBACK_SOURCES,
  ACTIVITY_ENTITY_TYPES,
  USER_MOTIVATIONS,
  USER_REFERRAL_SOURCES,
  ANALYTICS_EVENT_TYPES,
});

/** ماشین‌های وضعیت — نگاشت نام → جدول گذارهای مجاز. */
export const TRANSITION_REGISTRY = Object.freeze({
  CONTENT_LIFECYCLE: CONTENT_LIFECYCLE_TRANSITIONS,
  MEDIA_CONTENT: MEDIA_CONTENT_TRANSITIONS,
});

/** گذار مجاز است؟ اگر وضعیت مبدأ ناشناخته باشد، محافظه‌کارانه `false`. */
export function canTransition(machineName, from, to) {
  const machine = TRANSITION_REGISTRY[machineName];
  if (!machine) return false;
  if (from === to) return true;
  const allowed = machine[from];
  return Array.isArray(allowed) && allowed.includes(to);
}
