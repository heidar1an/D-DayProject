/*
 * Schemaهای دامنهٔ «پلتفرم» — هویت، نشست، تنظیمات و داده‌های عملیاتی پنل.
 *
 * هر Schema شکل زیر را دارد:
 *   name          نام Entity (یکتا در کل رجیستری)
 *   collection    نام مجموعه در `database/content/*.json` (اگر متفاوت باشد)
 *   storage       'array' | 'keyed-object' | 'singleton'
 *   identityField فیلد کلید اصلی
 *   fields        نگاشت نام فیلد → توصیف‌گر
 *   unique        فهرست قیدهای یکتایی
 *   transitions   ماشین وضعیت (اختیاری)
 *   file          مسیر فایل داده
 */

import {
  arr, bool, count, describe, enumOf, epoch, id, json, mapOf, num, obj, optional, ref,
  required, secret, serverOnly, slug, str, strArray, timestamp,
} from '../fields.js';
import {
  ACTIVITY_ACTION_PATTERN, ACTIVITY_ENTITY_TYPES, ADMIN_ROLES, ALERT_CHANNELS,
  ALERT_COMPARATORS, ALERT_METRICS, ALERT_SEVERITIES, ANALYTICS_EVENT_TYPES,
  FEEDBACK_SOURCES, FEEDBACK_STATUSES, NOTE_KINDS, SYSTEM_ACTOR_ID,
  USER_MOTIVATIONS, USER_REFERRAL_SOURCES,
} from '../enums.js';

const CREATED_AT = describe(serverOnly(timestamp()), 'زمان ساخت رکورد — ISO 8601');
const UPDATED_AT = describe(serverOnly(timestamp()), 'زمان آخرین ویرایش — ISO 8601');

/*
 * سازنده/ویرایش‌کننده — همان قراردادی که `content.js` و `media.js` دارند.
 *
 * ⚠️ `serverOnly` یعنی از Client پذیرفته **نمی‌شود**. این فیلدها را سرور از
 * `actor.id` می‌نویسد؛ اگر از بدنهٔ درخواست پذیرفته شوند، هر مدیری می‌تواند
 * رد پای خودش را جعل کند. (قاعدهٔ RBAC و مدل داده اینجا هم‌جهت‌اند.)
 *
 * ⚠️ `required` نیست: مدیر کلِ seed (ساختهٔ `seedAdmins()`) این فیلد را ندارد
 * و «نبودِ سازنده در رکوردهای تاریخی» یک واقعیت است، نه نقض قرارداد.
 */
const CREATED_BY = describe(serverOnly(str({ max: 80 })), 'سازنده — «seed» یا شناسهٔ مدیر');
const UPDATED_BY = describe(serverOnly(str({ max: 80 })), 'آخرین ویرایش‌کننده — «seed» یا شناسهٔ مدیر');

/** مُهر زمانی epoch که `null` هم می‌پذیرد (readAt). */
const NULLABLE_EPOCH = { ...epoch(), nullable: true };

/* ─────────────────────────────── مدیر پنل ─────────────────────────────── */

export const adminSchema = {
  name: 'admin',
  collection: 'admins',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/admins.json',
  description: 'حساب مدیر پنل. رمز هرگز از سرور بیرون نمی‌رود.',
  fields: {
    id: required(id({ prefix: 'adm' })),
    username: describe(required(str({ min: 2, max: 64, allowEmpty: false })), 'نام کاربری ورود — یکتا'),
    name: describe(required(str({ min: 1, max: 120, allowEmpty: false })), 'نام نمایشی'),
    email: str({ max: 190 }),
    /* هش رمز: `scrypt$salt$hash` یا (legacy) ۶۴ نویسهٔ hex.
       `secret` یعنی در هیچ خروجی‌ای نمی‌آید؛ `protected` یعنی از Client پذیرفته نمی‌شود. */
    passwordHash: describe(secret(required(str({ min: 16, max: 512, allowEmpty: false }))), 'هش رمز — هرگز در خروجی'),
    role: describe(required(enumOf(ADMIN_ROLES, { name: 'ADMIN_ROLES' })), 'نقش پنل'),
    isActive: required(bool()),
    mustChangePassword: bool(),
    lastLoginAt: timestamp({ nullable: true }),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    /* ⚠️ شکافِ رفع‌شده در فاز ۶: `createAdmin()` می‌نویسد
       `createdBy: actor?.id ?? 'system'` و `updateAdmin()` می‌نویسد
       `updatedBy: actor?.id ?? 'system'` — ولی Schema هیچ‌کدام را اعلام نکرده
       بود. چون `admin` در `STRICT_UNKNOWN_FIELD_ENTITIES` است، این دو
       `unknown_field` **خطا** می‌دادند (نه هشدار). نقص نهفته بود: فقط وقتی
       فعال می‌شد که مدیری از پنل ساخته یا ویرایش شود. */
    createdBy: CREATED_BY,
    updatedBy: UPDATED_BY,
  },
  unique: [{ fields: ['username'], caseInsensitive: true }],
};

/* ─────────────────────────────── کاربر سایت ─────────────────────────────── */

const userProfileSchema = obj({
  firstName: str({ max: 80 }),
  lastName: str({ max: 80 }),
  username: str({ max: 64 }),
  university: str({ max: 160 }),
  term: str({ max: 16 }),
  motivations: arr(enumOf(USER_MOTIVATIONS, { name: 'USER_MOTIVATIONS' }), { max: 12, unique: true }),
  referralSources: arr(enumOf(USER_REFERRAL_SOURCES, { name: 'USER_REFERRAL_SOURCES' }), { max: 12, unique: true }),
});

export const userSchema = {
  name: 'user',
  collection: 'users',
  /* ⚠️ فایل آرایهٔ خام نیست؛ پوشش `{ users: [...] }` دارد (usersStore.readUsers). */
  storage: 'keyed-array',
  arrayKey: 'users',
  identityField: 'id',
  file: 'database/users.json',
  description: 'حساب کاربر سایت. پروفایل جدا از هویت و اعتبارنامه نگه داشته می‌شود.',
  fields: {
    id: required(id({ prefix: null, max: 64 })),
    /*
     * شمارهٔ تماس — شکل متعارف (ارقام لاتین).
     *
     * ⚠️ `allowEmpty` عمداً روشن است: حسابِ فقط-گوگلی شماره ندارد و
     * `saveGoogleUser` مقدار `''` می‌گذارد (`usersStore.js` → `nextUser.phone`).
     * سیاست «شمارهٔ الزامی و معتبر» متعلق به **ورودی ثبت‌نام** است، نه به شکل
     * رکورد ذخیره‌شده؛ آن سیاست در `database/authPolicy.js` است و اینجا
     * تکرار نمی‌شود (بند ۳۴ — یک قاعده، یک جا).
     * قید یکتایی هم مقدار خالی را نادیده می‌گیرد (`ignoreEmpty` پیش‌فرض).
     */
    phone: describe(required(str({ max: 20, allowEmpty: true })), 'شمارهٔ تماس — برای حساب گوگلی خالی'),
    /*
     * هش رمز: `scrypt$salt$hash` یا (legacy) ۶۴ نویسهٔ hex.
     * `null` یعنی «حساب گوگلی بدون رمز» — شاهد: `usersStore.saveGoogleUser`
     * (`passwordHash: existing?.passwordHash ?? null`) و تست گوگل که حساب
     * بدون رمز می‌سازد. `secret` یعنی در هیچ خروجی‌ای نمی‌آید.
     */
    passwordHash: describe(
      secret({ ...str({ min: 16, max: 512 }), nullable: true }),
      'هش رمز — برای حساب گوگلی null؛ هرگز در خروجی',
    ),
    /*
     * هویت گوگل — شاهد: `usersStore.saveGoogleUser` + `googleAuth.test.mjs`.
     *   • `googleId` شناسهٔ پایدار حساب است و `publicUser` آن را از هر پاسخ
     *     عمومی حذف می‌کند ⇒ `secret` علامت خورده (هم‌مرز با `passwordHash`).
     *   • `email` برخلاف آن عمومی می‌ماند (تست گوگل: ایمیل در پاسخ امن می‌آید).
     *   • `emailVerified` مبنای اتصال به حساب موجود است؛ ایمیلِ تأییدنشده
     *     هرگز حساب دیگری را تصاحب نمی‌کند.
     */
    googleId: describe(secret(optional(str({ max: 128 }))), 'شناسهٔ پایدار حساب گوگل — هرگز در خروجی'),
    email: describe(optional(str({ max: 320 })), 'ایمیل — عمومی'),
    emailVerified: describe(optional(bool()), 'ایمیلِ تأییدشدهٔ گوگل — مبنای اتصال حساب'),
    passwordUpdatedAt: describe(optional(timestamp({ nullable: true })), 'زمان آخرین تغییر رمز'),
    profile: userProfileSchema,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  unique: [{ fields: ['phone'] }],
};

/* ─────────────────────────────── نشست کاربر ─────────────────────────────── */

/**
 * نشست کاربر — به‌صورت نگاشت `token → session` ذخیره می‌شود، نه آرایه.
 * توکن **کلید** است و در خود رکورد نمی‌آید؛ پس نشتی ندارد.
 */
export const sessionSchema = {
  name: 'session',
  collection: 'users.sessions',
  storage: 'keyed-object',
  /* کلید فایل، توکن نشست است (`{ sessions: { <token>: {...} } }`). توکن
     **درون رکورد نمی‌آید** — کلید است، نه فیلد؛ پس نه نشت می‌کند و نه
     به‌عنوان «فیلد ناشناخته» گزارش می‌شود. */
  objectKey: 'sessions',
  keyIsIdentity: true,
  keyField: null,
  identityField: null,
  file: 'database/users.sessions.json',
  description: 'نشست فعال کاربر سایت. کلید = توکن نشست (خودِ رکورد توکن ندارد).',
  fields: {
    userId: describe(required(str({ min: 1, max: 64, allowEmpty: false })), 'شناسهٔ کاربر — یا مصنوعی برای مهمان'),
    anonymous: describe(required(bool()), 'نشست مهمان است؟'),
    /* ⚠️ استثنای دوم پروژه در مُهر زمانی: `userSessions.js` از `Date.now()`
       استفاده می‌کند، پس این سه فیلد epoch میلی‌ثانیه‌اند نه ISO.
       (استثنای اول: `feedback.createdAt`.) */
    createdAt: describe(required(epoch()), 'epoch میلی‌ثانیه (نه ISO) — استثنای مستندشده'),
    expiresAt: describe(required(epoch()), 'epoch میلی‌ثانیه (نه ISO)'),
    ttlMs: describe(count(), 'عمر نشست به میلی‌ثانیه'),
    lastSeenAt: describe(epoch({ nullable: true }), 'epoch میلی‌ثانیه'),
    ip: str({ max: 60 }),
    userAgent: str({ max: 400 }),
  },
};

/* ─────────────────────────────── تنظیمات سایت ─────────────────────────────── */

const settingsSeoSchema = obj({
  defaultTitle: str({ max: 200 }),
  defaultDescription: str({ max: 400 }),
  canonicalBase: str({ max: 300 }),
  robots: str({ max: 100 }),
  ogImage: str({ max: 400 }),
});

export const settingsSchema = {
  name: 'settings',
  collection: 'settings',
  storage: 'singleton',
  identityField: null,
  file: 'database/content/settings.json',
  description: 'تنظیمات سایت — یک رکورد یکتا، تقسیم‌شده به بخش‌های منطقی.',
  fields: {
    siteName: required(str({ max: 120, allowEmpty: false })),
    siteDescription: str({ max: 400 }),
    logo: str({ max: 400 }),
    favicon: str({ max: 400 }),
    email: str({ max: 190 }),
    phone: str({ max: 40 }),
    address: str({ max: 400 }),
    social: obj({
      instagram: str({ max: 300 }), telegram: str({ max: 300 }), linkedin: str({ max: 300 }),
      x: str({ max: 300 }), youtube: str({ max: 300 }),
    }),
    seo: settingsSeoSchema,
    integrations: obj({ googleAnalyticsId: str({ max: 40 }) }),
    /* بخش امنیتی — نوشتنش مجوز اختصاصی `settings.security.manage` می‌خواهد */
    media: obj({
      maxUploadMb: num({ min: 1, max: 512, int: true }),
      allowedMimeTypes: strArray({ max: 60 }),
      maxVideoUploadMb: num({ min: 1, max: 4096, int: true }),
    }),
    security: obj({
      sessionHours: num({ min: 1, max: 720, int: true }),
      maxLoginAttempts: num({ min: 1, max: 100, int: true }),
      lockMinutes: num({ min: 1, max: 1440, int: true }),
    }),
  },
};

/* ─────────────────────────────── لاگ فعالیت ─────────────────────────────── */

export const activitySchema = {
  name: 'activity',
  collection: 'activity',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/activity.json',
  description: 'لاگ فعالیت پنل — فقط افزودنی. ارجاع به مدیر «نرم» است (تاریخی، نه زنده).',
  fields: {
    id: required(id({ prefix: 'log' })),
    /* ارجاع نرم: مدیر ممکن است بعداً حذف شود و لاگ تاریخی باید بماند. */
    userId: describe(
      ref('admins', { soft: true, sentinels: [SYSTEM_ACTOR_ID] }),
      `شناسهٔ عامل — یا «${SYSTEM_ACTOR_ID}» برای عملیات سیستمی`,
    ),
    userName: str({ max: 120 }),
    action: describe(required(str({ max: 80, pattern: ACTIVITY_ACTION_PATTERN, allowEmpty: false })), 'الگوی domain.verb'),
    entityType: describe(required(enumOf(ACTIVITY_ENTITY_TYPES, { name: 'ACTIVITY_ENTITY_TYPES' })), 'نوع Entity'),
    entityId: describe(str({ max: 80, nullable: true }), 'شناسهٔ موجودیت — می‌تواند null یا خالی باشد'),
    entityLabel: str({ max: 160 }),
    metadata: json({ maxKeys: 40 }),
    ip: str({ max: 60 }),
    userAgent: str({ max: 200 }),
    createdAt: CREATED_AT,
  },
};

/* ─────────────────────────────── یادداشت پنل ─────────────────────────────── */

export const noteSchema = {
  name: 'note',
  collection: 'notes',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/notes.json',
  description: 'یادداشت پنل — متنی، چک‌لیست، پرسش‌وپاسخ یا جدول.',
  fields: {
    id: required(id({ prefix: 'note' })),
    authorId: describe(required(ref('admins', { nullable: false })), 'نویسنده — باید مدیر موجود باشد'),
    authorName: str({ max: 120 }),
    title: str({ max: 200 }),
    kind: describe(required(enumOf(NOTE_KINDS, { name: 'NOTE_KINDS' })), 'نوع یادداشت'),
    body: str({ max: 20000, trim: false }),
    items: arr(json(), { max: 200 }),
    pinned: bool(),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
};

/* ─────────────────────────────── هشدار تحلیل ─────────────────────────────── */

export const alertSchema = {
  name: 'alert',
  collection: 'alerts',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/alerts.json',
  description: 'هشدار آستانه‌ای مرکز تحلیل.',
  fields: {
    id: required(id({ prefix: 'al' })),
    name: describe(required(str({ min: 1, max: 160, allowEmpty: false })), 'عنوان هشدار'),
    metric: describe(required(enumOf(ALERT_METRICS, { name: 'ALERT_METRICS' })), 'سنجهٔ پایش‌شده'),
    comparator: describe(required(enumOf(ALERT_COMPARATORS, { name: 'ALERT_COMPARATORS' })), 'نوع مقایسه'),
    threshold: required(num({ min: 0, max: 1e12 })),
    severity: describe(required(enumOf(ALERT_SEVERITIES, { name: 'ALERT_SEVERITIES' })), 'شدت'),
    enabled: bool(),
    channel: describe(enumOf(ALERT_CHANNELS, { name: 'ALERT_CHANNELS' }), 'کانال اطلاع‌رسانی'),
    windowHours: num({ min: 1, max: 720, int: true }),
    isDefault: describe(bool(), 'هشدار پیش‌فرض سیستم (غیرقابل حذف در UI)'),
    createdAt: CREATED_AT,
    createdBy: str({ max: 80 }),
    lastTriggeredAt: timestamp({ nullable: true }),
  },
};

/* ─────────────────────────────── بنر سایت ─────────────────────────────── */

export const bannerSchema = {
  name: 'banner',
  collection: 'banners',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/banners.json',
  description: 'بنر صفحهٔ اصلی.',
  fields: {
    id: required(id({ prefix: 'bn' })),
    title: str({ max: 200 }),
    subtitle: str({ max: 400 }),
    image: str({ max: 400 }),
    buttonText: str({ max: 80 }),
    buttonUrl: str({ max: 400 }),
    isActive: bool(),
    sortOrder: num({ min: 0, max: 100000, int: true }),
    startDate: describe(timestamp({ dateOnly: true, nullable: true }), 'بازهٔ نمایش — شروع (خالی = بی‌حد)'),
    endDate: describe(timestamp({ dateOnly: true, nullable: true }), 'بازهٔ نمایش — پایان (خالی = بی‌حد)'),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  /* قانون بین‌فیلدی: پایان نباید پیش از شروع باشد */
  crossField: ['bannerDateRange'],
};

/* ─────────────────────────────── فایل رسانه ─────────────────────────────── */

export const mediaAssetSchema = {
  name: 'mediaAsset',
  collection: 'media',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/media.json',
  description: 'فایل بارگذاری‌شده در کتابخانهٔ رسانه.',
  fields: {
    id: describe(required(id({ prefix: 'md', max: 80 })), 'شناسهٔ فایل — پیشوند md'),
    filename: describe(required(str({ min: 1, max: 300, allowEmpty: false })), 'نام فایل روی دیسک'),
    originalName: str({ max: 300 }),
    mimeType: describe(required(str({ min: 3, max: 120, allowEmpty: false })), 'نوع MIME — باید در allow-list تنظیمات باشد'),
    size: describe(count({ max: 512 * 1024 * 1024 }), 'حجم بایت'),
    url: describe(required(str({ min: 1, max: 600, allowEmpty: false })), 'مسیر عمومی سرو'),
    altText: str({ max: 300 }),
    uploadedBy: ref('admins', { soft: true }),
    uploadedByName: str({ max: 120 }),
    createdAt: CREATED_AT,
  },
};

/* ─────────────────────────────── رخداد سایت ─────────────────────────────── */

/**
 * ⚠️ یافتهٔ فاز ۵: مجموعهٔ `events` در `COLLECTIONS` اعلام شده و فایلش ساخته
 * می‌شود، ولی **هیچ نویسنده و خواننده‌ای در کد ندارد** (نه در `database/**`،
 * نه در `src/**`). Schema فقط برای کامل‌بودن پوشش ثبت شده و شکل آن از سایر
 * رویدادهای تحلیلی پروژه استنباط شده؛ چون دادهٔ واقعی وجود ندارد، فیلدها
 * همه اختیاری‌اند و اعتبارسنجی روی این Entity باید `NOT APPLICABLE` بماند.
 */
/*
 * ⚠️ **بازنویسی‌شده در فاز ۶ از روی کد واقعی.**
 *
 * نسخهٔ قبلی این Schema **داستان** بود، نه مدل: چهار فیلد `id, type, payload,
 * createdAt` اعلام می‌کرد که **دو تای آخر در هیچ رکورد واقعی وجود ندارند**، و
 * ۱۶ فیلد واقعی را نمی‌شناخت. خودش هم با `unverifiedShape: true` اعتراف کرده
 * بود: «شکل از دادهٔ واقعی تأیید نشده».
 *
 * چرا در اسکن دادهٔ موجود دیده نمی‌شد: `events.json` خالی است (`[]`) تا وقتی
 * beacon مرورگر یا خود سرور رویدادی ثبت کند. نقص **نهفته** بود و فقط با یک
 * `recordEvents()` واقعی فعال می‌شد — همان الگوی `admin.createdBy`.
 *
 * **مرجع این Schema:** `analyticsStore.js` → `normalizeEvent()` (۱۸ فیلد).
 * `ts` عمداً `epoch()` است نه `timestamp()`: رویدادها epoch میلی‌ثانیه ذخیره
 * می‌کنند (مثل `feedback.createdAt`) — استثنای مستندشدهٔ پروژه.
 */
export const eventSchema = {
  name: 'event',
  collection: 'events',
  storage: 'array',
  identityField: 'id',
  file: 'database/content/events.json',
  description: 'رویداد تحلیلی سایت — از `analyticsStore.normalizeEvent()`.',
  fields: {
    /* `normalizeEvent` شناسهٔ ورودی را تا ۶۰ نویسه می‌پذیرد و وگرنه
       `ev-<base36>-<random>` می‌سازد. پس پیشوند `ev` تضمینی نیست و قالب
       سخت‌گیرانه اعمال نمی‌شود. */
    id: required(str({ min: 1, max: 60, allowEmpty: false })),
    type: describe(required(enumOf(ANALYTICS_EVENT_TYPES, { name: 'ANALYTICS_EVENT_TYPES' })),
      'نوع رویداد — مقدار ناشناخته در normalizeEvent به page_view برمی‌گردد'),
    ts: describe(required(epoch()), 'epoch میلی‌ثانیه (نه ISO) — مبنای فیلتر پنجرهٔ ۱۸۰ روزه'),
    sessionId: describe(str({ max: 60 }), 'نشست — پیش‌فرض «anon»'),
    userId: { ...str({ max: 80 }), nullable: true },
    path: str({ max: 300 }),
    title: str({ max: 160 }),
    referrer: str({ max: 300 }),
    source: describe(str({ max: 40 }), 'منبع ورود — از classifySource()'),
    medium: str({ max: 40 }),
    campaign: str({ max: 80 }),
    device: str({ max: 20 }),
    browser: str({ max: 40 }),
    os: str({ max: 20 }),
    locale: str({ max: 20 }),
    value: { ...num(), nullable: true },
    metric: { ...str({ max: 30 }), nullable: true },
    meta: json(),
  },
};

/* ─────────────────────────────── بازخورد کاربران ─────────────────────────────── */

/**
 * بازخورد و پاسخ‌هایش در یک فایل با دو آرایهٔ مجزا زندگی می‌کنند
 * (`{ items: [], replies: [] }`) — دو Entity در یک فایل.
 */
export const feedbackSchema = {
  name: 'feedback',
  collection: 'feedback',
  storage: 'keyed-array',
  arrayKey: 'items',
  identityField: 'id',
  file: 'database/content/feedback.json',
  description: 'بازخورد/گزارش کاربر. تنها مُهر زمانی epoch در پروژه.',
  fields: {
    id: required(id({ prefix: 'fb', max: 40 })),
    source: describe(enumOf(FEEDBACK_SOURCES, { name: 'FEEDBACK_SOURCES' }), 'منبع بازخورد'),
    subject: str({ max: 200 }),
    category: str({ max: 64 }),
    message: describe(required(str({ min: 1, max: 4000, allowEmpty: false })), 'متن پیام'),
    userId: { ...str({ max: 64 }), nullable: true },
    userLabel: { ...str({ max: 120 }), nullable: true },
    meta: { ...json({ maxKeys: 30 }), nullable: true },
    /* ⚠️ استثنای مستندشده: این مجموعه epoch میلی‌ثانیه است، نه ISO 8601 */
    createdAt: describe(required(epoch()), 'epoch میلی‌ثانیه (نه ISO) — استثنای مستندشدهٔ پروژه'),
    status: describe(required(enumOf(FEEDBACK_STATUSES, { name: 'FEEDBACK_STATUSES' })), 'وضعیت رسیدگی'),
    readAt: NULLABLE_EPOCH,
    adminId: str({ max: 80 }),
    adminName: str({ max: 120 }),
  },
};

export const feedbackReplySchema = {
  name: 'feedbackReply',
  collection: 'feedback',
  storage: 'keyed-array',
  arrayKey: 'replies',
  identityField: 'id',
  file: 'database/content/feedback.json',
  description: 'پاسخ مدیر به یک بازخورد.',
  fields: {
    id: required(id({ prefix: 'rp', max: 40 })),
    targetId: describe(required(ref('feedback', { nullable: false })), 'بازخورد والد — الزامی'),
    userId: { ...str({ max: 64 }), nullable: true },
    subject: str({ max: 200 }),
    source: str({ max: 40 }),
    text: describe(required(str({ min: 1, max: 2000, allowEmpty: false })), 'متن پاسخ'),
    adminId: ref('admins', { soft: true }),
    adminName: str({ max: 120 }),
    createdAt: required(epoch()),
    readAt: NULLABLE_EPOCH,
  },
};

/* ─────────────────────────────── نگاشت مسیر فایل ─────────────────────────────── */

export const PLATFORM_SCHEMAS = [
  adminSchema, userSchema, sessionSchema, settingsSchema, activitySchema,
  noteSchema, alertSchema, bannerSchema, mediaAssetSchema, eventSchema,
  feedbackSchema, feedbackReplySchema,
];

export { CREATED_AT, UPDATED_AT, slug, secret, serverOnly };
