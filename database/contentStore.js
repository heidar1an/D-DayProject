/*
 * انبار محتوای تپش (CMS) — لایهٔ دادهٔ پنل مدیریت.
 *
 * این فایل دقیقاً ادامهٔ همان الگوی موجود پروژه است (`database/usersStore.js`):
 * فایل JSON روی دیسک + توابع دامنهٔ خالص. با مهاجرت به یک Backend واقعی، فقط بدنهٔ
 * همین توابع به کوئری دیتابیس تبدیل می‌شود و امضاها دست‌نخورده می‌مانند.
 *
 * مجموعه‌ها: admins | articles | categories | pages | media | banners | activity | notes |
 *            events | alerts | publishChannels | publishLog
 * سند تکی: settings
 *
 * توکن ربات‌های انتشار در این پوشه ذخیره **نمی‌شود**؛ جای آن
 * `database/publishing.secrets.json` است (خارج از محتوای سایت، با مجوز ۰۶۰۰).
 *
 * امنیت پیاده‌شده در این لایه:
 *   - رمز مدیر با scrypt + salt تصادفی ذخیره می‌شود (هرگز plain text).
 *   - مقایسهٔ رمز با timingSafeEqual انجام می‌شود (ضد timing attack).
 *   - HTML محتوا قبل از ذخیره سمت سرور پاک‌سازی می‌شود (ضد XSS ذخیره‌شده).
 *   - هر عملیات مهم در activity ثبت می‌شود، بدون دادهٔ حساس.
 *   - نام فایل آپلودی هرگز از ورودی کاربر ساخته نمی‌شود (ضد path traversal).
 *
 * این ماژول هیچ وابستگی بیرونی ندارد تا سرور بتواند بدون نصب چیزی اجرا شود.
 */

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildExcerpt, htmlToText, sanitizeHtml } from './sanitizeHtml.js';
import { assertAdminCredentialUsable } from './adminCredentialPolicy.js';
/*
 * سه ماژول دادهٔ خالص پروژه که seed، «انتخاب از بانک تست» و تبدیل متن را تغذیه می‌کنند.
 * هیچ‌کدام وابستگی بیرونی ندارند (فقط دادهٔ ثابت و توابع خالص‌اند)، پس شرط «سرور بدون
 * نصب چیزی اجرا شود» دست‌نخورده می‌ماند.
 */
import { MICRO_COURSE_SOURCES, MICRO_SUBJECT_OPTIONS } from '../src/data/micro/registry.js';
import { blocksToHtml } from '../src/data/micro/blocksToHtml.js';
import {
  DIFFICULTIES as TEST_BANK_DIFFICULTIES,
  QUESTION_TYPES as TEST_BANK_TYPES,
  SUBJECTS as TEST_BANK_SUBJECTS,
  TRACKS as TEST_BANK_TRACKS,
} from '../src/services/testBank/mockData.js';
/* بانک کامل (با کلید پاسخ) — فایل سرورمحور. از mockData نمی‌آید چون آن ماژول
   در Bundle مرورگر می‌رود و کلید پاسخ نباید آنجا باشد (PHASE 2). */
import { TEST_BANK_SEED_QUESTIONS as TEST_BANK_QUESTIONS } from './testBankSeed.mjs';
import { CARD_IMAGE_MIME_EXTENSIONS, TAPESH_CARDS, TAPESH_DECKS } from '../src/services/flashcards/mockData.js';
import { REFERENCE_CATALOG, REFERENCE_CONTENTS, referenceBlocksToHtml } from '../src/services/references/referenceCatalog.js';
/* کاتالوگ خالص دوره‌های بین‌الملل — دادهٔ ثابت بدون تصویر (نود نمی‌تواند تصویر import کند) */
import {
  INTL_COURSE_CATALOG,
  INTL_DEFAULT_MAX_VIDEO_MB,
  INTL_PROVIDER_CATALOG,
  INTL_SUBTITLE_LANGS,
  INTL_UPLOAD_EXTENSION_MIME,
  INTL_UPLOAD_MIME_EXTENSIONS,
} from '../src/services/international/intlCatalog.js';
import { difficultyFromPercent } from '../src/services/testBank/questionMeta.js';
import {
  ARTICLE_AUTHORS, ARTICLE_CATALOG, articleBlocksToHtml,
} from '../src/services/articles/articleCatalog.js';
/* درسنامهٔ جامع دست‌نویس (آناتومی) — دادهٔ خالص بدون React، مثل کاتالوگ مراجع */
import anatomyCourse from '../src/data/learning/anatomyCourse.js';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const contentDir = resolve(databaseDir, 'content');
const uploadsDir = resolve(databaseDir, '..', 'public', 'uploads');
/* ویدیو و زیرنویس دوره‌های بین‌الملل زیرپوشهٔ جدا می‌گیرند تا کتابخانهٔ تصویر
   (که فقط تصویر و PDF می‌پذیرد) با فایل‌های سنگین شلوغ نشود. */
const intlUploadsDir = resolve(uploadsDir, 'intl');

export const UPLOADS_URL_PREFIX = '/uploads';
export const INTL_UPLOADS_URL_PREFIX = '/uploads/intl';
export { sanitizeHtml };

/* ─────────────────────────── نقش‌ها و دسترسی‌ها ─────────────────────────── */

export const PERMISSIONS = [
  'articles.create', 'articles.read', 'articles.update', 'articles.delete', 'articles.publish',
  /* `categories.read` از قبل در نقش «نویسنده» استفاده می‌شد ولی در این فهرست
     نبود؛ نتیجه‌اش این بود که `super-admin` (که همهٔ این فهرست را می‌گیرد) از
     نویسنده کم‌دسترسی‌تر می‌شد. اکنون اعلام‌شده تا فهرست، مرجع کامل باشد. */
  'categories.create', 'categories.read', 'categories.update', 'categories.delete',
  'pages.create', 'pages.read', 'pages.update', 'pages.delete',
  /* کتابخانهٔ فلش‌کارت تپش — ساخت/ویرایش دک و کارت، انتشار در کتابخانهٔ عمومی */
  'flashcards.create', 'flashcards.read', 'flashcards.update', 'flashcards.delete', 'flashcards.publish',
  'testbank.create', 'testbank.read', 'testbank.update', 'testbank.delete', 'testbank.publish',
  /* میکرو درسنامه — ویرایش ساختار درس، ایستگاه‌های تست و انتشار برای کاربران */
  'micro.create', 'micro.read', 'micro.update', 'micro.delete', 'micro.publish',
  /* مراجع تپش — افزودن/حذف مرجع و بخش، ویرایش متن و انتشار در لایهٔ رفرنس */
  'references.create', 'references.read', 'references.update', 'references.delete', 'references.publish',
  /* درسنامه جامع — کنترل متن‌ها و تست‌های لایهٔ یادگیری جامع، درس به درس و واحد به واحد */
  'comprehensive.read', 'comprehensive.update', 'comprehensive.publish',
  /*
   * دوره‌های بین‌الملل — دوره‌ها و منابع (دانشگاه‌ها/نهادها) در لایهٔ
   * `intl-courses`. `intl.upload` جداست چون بارگذاری ویدیو و زیرنویس حجم و
   * فضای دیسک می‌خورد و نباید لازمهٔ ویرایش متن باشد.
   */
  'intl.read', 'intl.create', 'intl.update', 'intl.delete', 'intl.publish', 'intl.upload',
  'media.upload', 'media.read', 'media.delete',
  'banners.create', 'banners.update', 'banners.delete',
  /*
   * مدیران پنل.
   *
   * `users.superadmin.manage` عمداً از `users.create`/`users.update` جدا است:
   * داشتن مجوز «ساخت کاربر» نباید به‌صورت ضمنی یعنی «ساخت مدیر کل». هر عملیاتی
   * که سطح اعتماد یک حساب را به `super-admin` می‌برد یا از آن پایین می‌آورد —
   * و همچنین دست‌زدن به حسابِ یک مدیر کل (از جمله عوض‌کردن رمزش) — این مجوز را
   * می‌خواهد.
   */
  'users.create', 'users.read', 'users.update', 'users.delete', 'users.superadmin.manage',
  'settings.read', 'settings.update',
  /*
   * تنظیمات امنیتی و سقف‌های بارگذاری — جدا از `settings.update` عمومی.
   * `security.sessionHours` / `maxLoginAttempts` / `lockMinutes` و سقف حجم فایل،
   * خودِ مکانیزم‌های حفاظتی‌اند؛ کسی که فقط تنظیمات سایت را می‌نویسد نباید
   * بتواند قفلِ تلاش ورود را باز کند یا پنجرهٔ نشست را بی‌نهایت کند.
   */
  'settings.security.manage',
  'logs.read',
  /* بازخورد و گزارش‌های کاربران — دیدن گزارش هر منبع و مدیریت وضعیت/حذف */
  'feedback.read', 'feedback.manage',
  'notes.create', 'notes.read', 'notes.update', 'notes.delete',
  /* انتشار در کانال‌ها — مدیریت کانال و توکن جدا از حق ارسال است */
  'publishing.read', 'publishing.send', 'publishing.channels.manage',
  /*
   * مرکز رسانه و فضای مجازی — شش مجوز مستقل (ورود به مرکز با `media.read` است
   * که بالاتر، همراه کتابخانهٔ رسانه، اعلام شده).
   * تفکیک عمدی است: کسی که محتوا می‌نویسد با کسی که تأیید می‌کند و کسی که
   * توکن اپلیکیشن‌ها را می‌بیند یکی نیست.
   */
  'media.content.manage',    /* ساخت/ویرایش/حذف محتوا و کمپین */
  'media.content.review',    /* تأیید یا درخواست اصلاح در گردش کار */
  'media.content.publish',   /* زمان‌بندی، انتشار و تلاش دوباره */
  'media.platforms.manage',  /* پلتفرم، اکانت و کلید API */
  'media.team.manage',       /* اعضای تیم رسانه */
  'media.ops.manage',        /* اینباکس، هشتگ/موضوع، UTM و اعلان‌ها */
  'media.audit.read',        /* گزارش رویدادهای مرکز رسانه */
  /* مرکز تحلیل — تفکیک‌شده تا دادهٔ حساس به هر نقشی داده نشود */
  'analytics.read',
  'analytics.users.read',
  'analytics.seo.read',
  'analytics.revenue.read',
  'analytics.security.read',
  'analytics.alerts.manage',
  'analytics.export',
];

/*
 * سنجه‌های حساس مرکز تحلیل: بخش‌های مالی، امنیتی و دادهٔ شخصی کاربران.
 * نقش `admin` این‌ها را ندارد و فقط مدیر کل می‌بیند.
 */
export const SENSITIVE_ANALYTICS = ['analytics.users.read', 'analytics.revenue.read', 'analytics.security.read', 'analytics.alerts.manage'];

/*
 * مجوزهایی که نقش `admin` نباید داشته باشد، حتی با اینکه در `PERMISSIONS` هست.
 *
 * قاعدهٔ بنیادین: داشتن دسترسی به یک قابلیت، به‌صورت ضمنی یعنی داشتن دسترسی به
 * قابلیت حساس‌ترِ دیگر نیست. این فهرست جاهایی است که آن قاعده می‌شکست.
 */
export const ADMIN_DENIED_PERMISSIONS = [
  /* حذف کاربر پنل — از قبل هم بسته بود */
  'users.delete',
  /* ارتقا/تنزل «مدیر کل» — وگرنه `users.create` یعنی ساخت مدیر کل */
  'users.superadmin.manage',
  /* تنظیمات امنیتی — وگرنه `settings.update` یعنی بازکردن قفل ورود */
  'settings.security.manage',
];

export const ROLES = {
  'super-admin': {
    id: 'super-admin',
    label: 'مدیر کل',
    description: 'دسترسی کامل به همهٔ بخش‌ها، از جمله تحلیل مالی و امنیتی',
    permissions: ['*'],
  },
  admin: {
    id: 'admin',
    label: 'مدیر',
    description: 'مدیریت محتوا و کاربران + تحلیل عمومی؛ بدون دادهٔ مالی، امنیتی و بدون ارتقا به مدیر کل',
    permissions: PERMISSIONS.filter(
      (permission) => !ADMIN_DENIED_PERMISSIONS.includes(permission) && !SENSITIVE_ANALYTICS.includes(permission),
    ),
  },
  editor: {
    id: 'editor',
    label: 'نویسنده',
    description: 'ایجاد و ویرایش مقاله + تحلیل محتوا و آموزش؛ بدون دادهٔ کاربران، مالی و امنیتی',
    permissions: [
      'articles.create', 'articles.read', 'articles.update', 'articles.publish',
      'categories.create', 'categories.read',
      'pages.read', 'pages.update',
      'flashcards.read', 'flashcards.create', 'flashcards.update', 'flashcards.publish',
      'testbank.read', 'testbank.create', 'testbank.update', 'testbank.publish',
      'micro.read', 'micro.create', 'micro.update', 'micro.publish',
      'references.read', 'references.create', 'references.update', 'references.publish',
      'comprehensive.read', 'comprehensive.update', 'comprehensive.publish',
      'intl.read', 'intl.create', 'intl.update', 'intl.publish', 'intl.upload',
      'media.upload', 'media.read', 'media.delete',
      'notes.create', 'notes.read', 'notes.update', 'notes.delete',
      'publishing.read', 'publishing.send',
      /* مرکز رسانه: می‌نویسد و منتشر می‌کند، ولی تأیید و کلید API دستش نیست.
         `media.read` اینجا تکرار نمی‌شود — بالاتر، همراه کتابخانهٔ رسانه، آمده. */
      'media.content.manage', 'media.content.publish', 'media.ops.manage',
      'analytics.read',
    ],
  },
};

export function roleLabel(roleId) {
  return ROLES[roleId]?.label ?? roleId ?? '';
}

export function rolePermissions(roleId) {
  const role = ROLES[roleId];
  if (!role) return [];
  return role.permissions.includes('*') ? [...PERMISSIONS] : [...role.permissions];
}

export function hasPermission(admin, permission) {
  if (!admin || !permission) return false;
  const permissions = rolePermissions(admin.role);
  return permissions.includes(permission);
}

/* ───────────────────────────── ذخیره‌سازی پایه ───────────────────────────── */

const COLLECTIONS = [
  'admins', 'articles', 'categories', 'pages', 'media', 'banners', 'activity', 'notes',
  'events', 'alerts', 'publishChannels', 'publishLog',
  /* کتابخانهٔ فلش‌کارت تپش — دک‌های رسمی که از پنل ساخته/منتشر می‌شوند؛
     کارت‌ها داخل رکورد دک می‌مانند (دک و کارت یک موجودیت مدیریتی‌اند). */
  'flashcardDecks',
  'testBankQuestions',
  'testBankAnswers',
  'testBankHeartRewards',
  /* میکرو درسنامه — هر رکورد یک درسنامهٔ کامل است: مبحث‌ها، واحدهای یادگیری،
     صفحه‌ها، بلوک‌های محتوا، ایستگاه‌های تست و مفاهیم. مثل فلش‌کارت، کل درسنامه
     یک موجودیت مدیریتی است و در یک رکورد می‌ماند تا انتشار اتمیک باشد. */
  'microCourses',
  /*
   * مراجع تپش — هر رکورد یک مرجع کامل است (فراداده + بخش‌های قابل ویرایش).
   * مثل فلش‌کارت و میکرو، کل مرجع یک موجودیت مدیریتی است تا انتشار اتمیک باشد.
   */
  'references',
  /*
   * درسنامه جامع — هر رکورد یک درس کامل است: مبحث‌ها، واحدها و متن و تستِ هر
   * واحد (فعال‌سازی، میکرودرس‌ها، تصویرسازی، تمرین و تست نقشه). کل درس یک
   * موجودیت مدیریتی است تا ویرایش و انتشار اتمیک بماند — همان قرارداد مراجع.
   */
  'comprehensiveCourses',
  /*
   * دوره‌های بین‌الملل — دو مجموعهٔ مستقل:
   *   intlProviders = منابع (دانشگاه/رسانه/نشریه) با معرفی، لوگو و ترتیب نوار
   *   intlCourses   = دوره‌ها با فراداده + بخش‌ها و ویدیو و زیرنویس هر بخش
   * جدا نگه داشته شده‌اند چون یک منبع چند دوره دارد و ویرایش نام دانشگاه باید
   * همهٔ کارت‌هایش را هم عوض کند. مثل بقیه، هر دوره یک موجودیت کامل است تا
   * افزودن/حذف بخش و انتشار، یک عملیات اتمیک بماند.
   */
  'intlProviders',
  'intlCourses',
  /*
   * مرکز رسانه و فضای مجازی — ۱۲ مجموعهٔ مستقل.
   * هر مجموعه یک Entity از مدل داده است؛ افزودن پلتفرم یا نوع محتوای تازه
   * نیازی به مجموعهٔ جدید ندارد (در `mediaStore.js` سطر اضافه می‌شود).
   */
  'mediaPlatforms',   /* پلتفرم ثبت‌شده: اینستاگرام، تلگرام، ایتا، بله … */
  'mediaAccounts',    /* اکانت/کانال زیر هر پلتفرم (سلسله‌مراتبی) */
  'mediaContents',    /* محتوای رسانه‌ای + تاریخچهٔ گردش کار */
  'mediaCampaigns',   /* کمپین‌ها */
  'mediaTeam',        /* اعضای تیم رسانه */
  'mediaTags',        /* هشتگ و موضوع (kind: hashtag | topic) */
  'mediaMetrics',     /* عکس لحظه‌ای سنجه‌ها به تفکیک روز و اکانت */
  'mediaInbox',       /* پیام‌ها و تعاملات */
  'mediaMentions',    /* رصد نام و کلیدواژه */
  'mediaNotifications', /* اعلان‌های داخلی */
  'mediaUtm',         /* لینک‌های UTM ساخته‌شده */
  'mediaMeta',        /* فرادادهٔ خود مرکز: نسخهٔ seed، وضعیت دادهٔ نمونه */
  /*
   * لاگ Audit مرکز رسانه مجموعهٔ جدا ندارد: رویدادها در همان `activity` ثبت
   * می‌شوند (با entityTypeهایی مثل `media-content`) و بخش «گزارش رویدادها» فقط
   * همان‌ها را فیلتر می‌کند. یک منبع حقیقت، دو نما — نه دو لاگ موازی.
   */
];

const files = {
  settings: resolve(contentDir, 'settings.json'),
  ...Object.fromEntries(COLLECTIONS.map((name) => [name, resolve(contentDir, `${name}.json`)])),
};

/** نگاشت معکوس «مسیر فایل → نام مجموعه» — ناظر مسیر نوشتن به آن نیاز دارد. */
const collectionOfFile = new Map(
  Object.entries(files).map(([name, path]) => [path, name]),
);

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

/*
 * ساخت فایل در صورت نبودن.
 *
 * ⚠️ `fallback` می‌تواند یک **thunk** باشد و `ensureStore` همهٔ seedها را همین‌طور
 * پاس می‌دهد. دلیلش یک باگ کارایی اندازه‌گیری‌شده است: پیش از این
 * `ensureFile(files.admins, seedAdmins())` نوشته می‌شد و آرگومان **همیشه** ارزیابی
 * می‌شد — یعنی `scryptSync` داخل `seedAdmins` (~۴۰ms) و ساخت همهٔ seedهای بزرگ،
 * در **هر** `readCollection`/`writeCollection`/`readSettings` تکرار می‌شد، حتی وقتی
 * فایل از قبل موجود بود و نتیجه دور ریخته می‌شد. با thunk، مسیر داغ (فایل موجود)
 * هیچ seedی نمی‌سازد.
 */
function ensureFile(path, fallback) {
  ensureDir(dirname(path));
  if (existsSync(path)) return;
  const value = typeof fallback === 'function' ? fallback() : fallback;
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
}

/* ───────────────── تشخیص «خرابی» از «نبودن» ─────────────────
 * پیش از این `readJson` هر خطایی را می‌بلعید و `fallback` (یعنی `[]`) برمی‌گرداند.
 * پیامدش یک مسیر از دست‌رفتن دادهٔ خاموش بود: فایل JSON خراب (نیم‌نوشته، خالی،
 * دست‌کاری‌شده) به‌صورت «مجموعهٔ خالی» خوانده می‌شد و اولین `writeCollection`
 * آن را با `[]` **بازنویسی** می‌کرد — یعنی خرابی موقت به نابودی دائمی تبدیل می‌شد.
 *
 * رفتار تازه:
 *   • خواندن: خرابی **بلند اعلام** می‌شود (یک‌بار در هر فایل) و در حالت پیش‌فرض
 *     `fallback` برمی‌گردد تا سرویس degraded بماند؛ با `TAPESH_STORAGE_CORRUPT_MODE=throw`
 *     به‌جای degraded، fail-closed می‌شود.
 *   • نوشتن: روی فایل خراب **هرگز** نوشته نمی‌شود (`STORAGE_CORRUPT` پرتاب می‌شود).
 *     این گارد قابل خاموش‌کردن نیست؛ تنها راه ادامه، تعمیر دستی فایل است.
 */
const corruptFiles = new Set();

function corruptMode() {
  return String(process.env.TAPESH_STORAGE_CORRUPT_MODE ?? '').trim().toLowerCase();
}

function parseFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    return { ok: false, error };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, error };
  }
}

function noteCorruption(path, error) {
  if (corruptFiles.has(path)) return;
  corruptFiles.add(path);
  console.error(
    '[contentStore] فایل دادهٔ خراب (JSON نامعتبر) — نوشتن روی آن تا تعمیر دستی متوقف است:',
    path,
    '—',
    error?.message ?? 'خطای ناشناخته',
  );
}

/** گزارش خرابی‌های دیده‌شده در این پروسه (برای تست و پایش). */
export function storageCorruptionReport() {
  return { corrupt: corruptFiles.size, files: [...corruptFiles] };
}

function corruptError() {
  return Object.assign(new Error('فایل دادهٔ این مجموعه JSON معتبر نیست'), { code: 'STORAGE_CORRUPT' });
}

/** نوشتن روی فایل خراب ممنوع است؛ وگرنه خرابی موقت دائمی می‌شود. */
function assertNotCorrupt(file) {
  if (!existsSync(file)) return;
  const result = parseFile(file);
  if (result.ok) return;
  noteCorruption(file, result.error);
  throw corruptError();
}

function readJson(path, fallback) {
  ensureFile(path, fallback);
  const result = parseFile(path);
  if (result.ok) return result.value ?? fallback;
  noteCorruption(path, result.error);
  if (corruptMode() === 'throw') throw corruptError();
  return fallback;
}

/*
 * تنها دروازهٔ نوشتن روی دیسک در این ماژول.
 *
 * ⚠️ **همهٔ** نوشتن‌ها از اینجا می‌گذرند — چه مسیر CRUD
 * (`writeCollection` / `writeSettings`) و چه توابع یک‌بارهٔ همگام‌سازی
 * (`syncArticles` · `syncReferences` · `syncFlashcardDecks` ·
 * `syncMicroCourses` · `syncIntlCatalog`). پس ناظر **فقط یک نقطهٔ تزریق**
 * دارد و پوشش کامل است، بدون گزارش تکراری.
 */
/*
 * نوشتن اتمیک: `tmp` → `rename`.
 *
 * همان الگویی که `usersStore` · `examStore` · `userSessions` · `feedbackStore`
 * از قبل دارند؛ `contentStore` تنها انبار محتوایی بود که فایل را **در جای خود**
 * بازنویسی می‌کرد. با `rename`، خواننده هرگز نسخهٔ نیم‌نوشته نمی‌بیند و اگر
 * پروسه وسط نوشتن بمیرد یا دیسک پر شود، نسخهٔ سالم قبلی سر جایش می‌ماند.
 *
 * قالب خروجی عوض نمی‌شود (`JSON.stringify(value, null, 2)`، بدون newline پایانی)
 * و مجوز فایل‌های `database/content/*.json` همیشه `0644` است، پس `rename` آن را
 * تغییر نمی‌دهد. `rename` روی همان فایل‌سیستم ⇒ همان دایرکتوری ⇒ اتمیک.
 */
function writeJsonAtomic(file, value) {
  assertNotCorrupt(file);
  ensureDir(dirname(file));
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  renameSync(tmp, file);
  corruptFiles.delete(file);
}

function writeJson(path, value) {
  ensureFile(path, Array.isArray(value) ? [] : {});
  writeJsonAtomic(path, value);
  observeWrite(collectionOfFile.get(path) ?? null, value);
}

/* ───────────────────── ناظر مسیر نوشتن (فاز ۶ — مرحلهٔ ۸) ─────────────────────
 *
 * نقطهٔ تزریق **یکی** است: `writeJson` (تنها دروازهٔ نوشتن روی دیسک). پس هر
 * چیزی که در `database/content/` نوشته می‌شود — از مسیر CRUD پنل و از توابع
 * یک‌بارهٔ همگام‌سازی — سنجیده می‌شود. پوشش: ۳۳ مجموعهٔ `COLLECTIONS` + `settings`.
 *
 * ⚠️ ناظر **دروازه نیست**:
 *   - استثنا پرتاب نمی‌کند      → خروجی تابع تغییر نمی‌کند
 *   - داده را تغییر نمی‌دهد      → `value` همان ارجاع قبلی می‌ماند
 *   - نوشتن را رد نمی‌کند        → رفتار endpointها ذره‌ای عوض نمی‌شود
 * تبدیل آن به دروازه (رد کردن نوشتن نامعتبر) یک تصمیم محصولی است و تا تأیید
 * صریح کاربر انجام نمی‌شود.
 *
 * ⚠️ پیش‌فرض **خاموش** است: با خاموش بودن، ماژول مدل حتی یک بار هم بارگذاری
 * نمی‌شود. روشن‌کردن: `TAPESH_MODEL_OBSERVE=1` (و برای لاگ: `TAPESH_MODEL_OBSERVE_LOG=1`).
 *
 * ⚠️ بارگذاری **تنبل و همگام** است، نه `import` ثابت و نه `import()` دینامیک:
 *   • `import` ثابت ~۱٫۵ ثانیه به هر بارگذاری این ماژول اضافه می‌کند، حتی وقتی
 *     کسی ناظر را نخواسته (اندازه‌گیری‌شده: models ۱۵۳۷ms، contentStore ۳۵۸۸ms).
 *   • `import()` دینامیک نوشتنِ اولِ بعد از روشن‌شدن را از دست می‌دهد.
 * اگر نسخهٔ نود `require(esm)` را پشتیبانی نکند، ناظر **بی‌صدا خاموش** می‌ماند
 * و نوشتن دست‌نخورده کار می‌کند — شکست نمی‌دهد.
 */
let writeObserver;
let writeObserverResolved = false;

function observeWrite(collection, container) {
  if (process.env.TAPESH_MODEL_OBSERVE !== '1') return;
  /* فایل ناشناخته (بیرون از `files`) — چیزی برای تطبیق Schema نیست. */
  if (!collection) return;

  if (!writeObserverResolved) {
    writeObserverResolved = true;
    try {
      writeObserver = createRequire(import.meta.url)('./models/observe.js').observeWrite;
    } catch {
      writeObserver = null;
    }
  }
  if (!writeObserver) return;

  try {
    writeObserver(collection, container);
  } catch {
    /* شکست ناظر هرگز نباید نوشتن را بشکند. */
  }
}

/* ─────────────────────────────── seed اولیه ─────────────────────────────── */

const SEED_CATEGORIES = [
  { id: 'basic-sciences', label: 'علوم پایه', accent: 'blue' },
  { id: 'physiology', label: 'فیزیولوژی', accent: 'lavender' },
  { id: 'anatomy', label: 'آناتومی', accent: 'purple' },
  { id: 'biochemistry', label: 'بیوشیمی', accent: 'sky' },
  { id: 'microbiology', label: 'میکروب‌شناسی', accent: 'green' },
  { id: 'immunology', label: 'ایمنی‌شناسی', accent: 'mint' },
  { id: 'pharmacology', label: 'داروشناسی', accent: 'copper' },
  { id: 'study-skills', label: 'مهارت‌های مطالعه', accent: 'sage' },
  { id: 'olympiad', label: 'المپیاد', accent: 'gold' },
  { id: 'lifestyle', label: 'سبک زندگی دانشجویی', accent: 'mint' },
];

/*
 * لایه‌های تپش — رجیستری ثابت صفحاتِ بخش «صفحات» پنل.
 *
 * هر لایه یک قابلیت واقعی محصول است (فلش کارت، بانک تست، …) و رکورد متناظرش
 * محتوای معرفی + سئو + وضعیت انتشار همان لایه را نگه می‌دارد. «گروه» فقط
 * دسته‌بندی نمایشی در پنل است و «مسیر» لینک عمیق همان لایه در سایت؛ لایه‌های
 * تبلیغاتی مسیر مستقل ندارند و فقط از طریق پنل مدیریت می‌شوند.
 */
const PAGE_GROUPS = ['learning', 'assessment', 'knowledge', 'marketing'];

const SEED_PAGES = [
  /* یادگیری و آموزش */
  { title: 'فلش کارت', slug: 'flashcards', group: 'learning', icon: 'flashcard', route: '#dashboard?s=flashcards', description: 'مرور فعال با کارت‌های دو رو، دسته‌بندی درس‌ها و تکرار فاصله‌دار' },
  { title: 'درسنامه جامع', slug: 'comprehensive-lesson', group: 'learning', icon: 'book-open', route: '#dashboard?l=course-comprehensive', description: 'دروس جامع علوم پایه با فصل‌بندی کامل، درسنامه و تمرین' },
  { title: 'میکرو درسنامه', slug: 'micro-lesson', group: 'learning', icon: 'micro-lesson', route: '#dashboard?l=course-micro', description: 'درسنامه‌های کوتاه و موردی برای مرور سریع بین کلاس‌ها' },
  { title: 'مسیر سبز', slug: 'green-path', group: 'learning', icon: 'green-path', route: '#dashboard?l=green-path', description: 'برنامهٔ مطالعهٔ هوشمند و نقشهٔ راه شخصی‌سازی‌شدهٔ هر کاربر' },
  { title: 'رفرنس', slug: 'reference', group: 'learning', icon: 'reference', route: '#dashboard?l=course-reference', description: 'کتابخانهٔ منابع و مراجع درسی به تفکیک درس و فصل' },
  { title: 'دوره‌های بین‌الملل', slug: 'international-courses', group: 'learning', icon: 'globe', route: '#dashboard?l=intl-courses', description: 'دوره‌های ویژهٔ آمادگی آزمون‌های بین‌المللی علوم پزشکی' },

  /* ارزیابی، آزمون و رقابت */
  { title: 'بانک تست', slug: 'test-bank', group: 'assessment', icon: 'test-bank', route: '#dashboard?l=test-bank', description: 'بانک سؤالات طبقه‌بندی‌شده با فیلتر موضوعی و تحلیل عملکرد' },
  { title: 'آزمون‌های هماهنگ', slug: 'coordinated-exams', group: 'assessment', icon: 'exam-sheet', route: '#dashboard?l=coordinated-exams', description: 'آزمون‌های هماهنگ کشوری با محیط آزمون واقعی و کارنامه' },
  { title: 'آزمون‌های بین‌الملل', slug: 'international-exams', group: 'assessment', icon: 'globe-exam', route: '#dashboard?l=intl-exams', description: 'آزمون‌های بین‌المللی با استاندارد برگزاری و تحلیل نتیجه' },
  { title: 'لیگ تپش', slug: 'tapesh-league', group: 'assessment', icon: 'trophy', route: '#dashboard?s=league', description: 'رقابت دوره‌ای کاربران با جدول امتیازات و جوایز فصلی' },

  /* دانش و محتوا */
  { title: 'شبکه دانش', slug: 'knowledge-network', group: 'knowledge', icon: 'knowledge-graph', route: '#dashboard?l=knowledge', description: 'نقشهٔ گراف ارتباط مفاهیم درسی برای دیدن تصویر کلان' },
  { title: 'ویکی تپش', slug: 'tapesh-wiki', group: 'knowledge', icon: 'wiki', route: '#dashboard?l=wiki', description: 'دانش‌نامهٔ تخصصی علوم پزشکی که با مشارکت کاربران کامل می‌شود' },
  { title: 'مقالات تپش', slug: 'tapesh-articles', group: 'knowledge', icon: 'article', route: '#articles', description: 'مقالات آموزشی، تحلیل آزمون‌ها و اخبار علمی' },

  /* تبلیغات و اطلاع‌رسانی */
  { title: 'پاپ‌آپ‌ها', slug: 'popups', group: 'marketing', icon: 'popup', route: '', description: 'پیام‌های بازشو و اطلاع‌رسانی‌های درون‌سایتی' },
  { title: 'برگه‌های تبلیغاتی', slug: 'flyers', group: 'marketing', icon: 'flyer', route: '', description: 'برگه‌های معرفی و تبلیغاتی تپش برای چاپ و اشتراک‌گذاری' },
];

export const DEFAULT_SETTINGS = {
  siteName: 'تپش',
  siteDescription: 'پلتفرم یادگیری پزشکی و آمادگی برای آزمون‌های علوم پزشکی',
  logo: '',
  favicon: '',
  email: '',
  phone: '',
  address: '',
  social: { instagram: '', telegram: '', linkedin: '', x: '', youtube: '' },
  seo: {
    defaultTitle: 'تپش | یادگیری پزشکی ساده‌تر',
    defaultDescription: 'تپش؛ پلتفرم یادگیری پزشکی و آمادگی برای آزمون‌های علوم پزشکی',
    canonicalBase: '',
    robots: 'index,follow',
    ogImage: '',
  },
  integrations: { googleAnalyticsId: '' },
  media: {
    maxUploadMb: 4,
    /* تصویرهای کارت تصویری از فهرست مشترک می‌آیند؛ PDF فقط برای پیوست‌های کتابخانهٔ رسانه */
    allowedMimeTypes: [...Object.keys(CARD_IMAGE_MIME_EXTENSIONS), 'application/pdf'],
    /* سقف جدا برای ویدیو و زیرنویس دوره‌های بین‌الملل — مسیر بارگذاری‌شان جداست
       (`/api/admin/intl-courses/upload`) چون بدنه‌شان JSON/base64 نیست. */
    maxVideoUploadMb: INTL_DEFAULT_MAX_VIDEO_MB,
  },
  security: { sessionHours: 12, maxLoginAttempts: 8, lockMinutes: 10 },
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/* ────────────────────────────── رمز عبور مدیر ────────────────────────────── */

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'hex');
  const derived = scryptSync(String(password), salt, expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function seedAdmins() {
  /*
   * هرگز رمز واقعی در سورس هارد‌کد نمی‌شود؛ مقدار اولیه از env می‌آید.
   *
   * فاز ۹ (fail-closed): پیش از این `process.env.TAPESH_ADMIN_PASSWORD || '0135'`
   * بود، یعنی استقرار بدون `.env` با رمز شناخته‌شدهٔ `0135` بالا می‌آمد. حالا
   * تصمیم در `adminCredentialPolicy` گرفته می‌شود: در production بدون رمز صریح
   * (یا با رمز ضعیف) **خطا پرتاب می‌شود** و هیچ seedی نوشته نمی‌شود.
   */
  const decision = assertAdminCredentialUsable();
  const username = process.env.TAPESH_ADMIN_USERNAME || '0135';

  return [
    {
      id: makeId('adm'),
      username,
      name: process.env.TAPESH_ADMIN_NAME || 'مدیر تپش',
      email: process.env.TAPESH_ADMIN_EMAIL || '',
      passwordHash: hashPassword(decision.password),
      role: 'super-admin',
      isActive: true,
      mustChangePassword: decision.mustChangePassword,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: null,
    },
  ];
}

function seedArticles() {
  const created = nowIso();

  const demo = [
    {
      title: 'چگونه با تپش برای علوم پایه آماده شویم؟',
      slug: 'tapesh-basic-sciences-roadmap',
      excerpt:
        'یک مسیر عملی برای آمادگی آزمون علوم پایه: از انتخاب منبع و برنامهٔ هفتگی تا جمع‌بندی و آزمون شبیه‌ساز.',
      category: 'basic-sciences',
      tags: ['علوم پایه', 'برنامه‌ریزی', 'جمع‌بندی'],
      authorName: 'تیم محتوای تپش',
      body: `
<p>آمادگی برای علوم پایه بیشتر از آنکه به «چند ساعت مطالعه» وابسته باشد، به <strong>ترتیب درست مطالعه</strong> وابسته است.</p>
<h2>۱. ترتیب دروس را عوض کن</h2>
<p>شروع با دروسی که پایهٔ بقیه هستند، بار ذهنی نیمهٔ دوم مسیر را کم می‌کند.</p>
<ul><li>فیزیولوژی همراه با آناتومی</li><li>بیوشیمی قبل از میکروب‌شناسی</li><li>داروشناسی بعد از فیزیولوژی</li></ul>
<blockquote>هر درس را تا وقتی که می‌توانی با یک جمله توضیحش بدهی، تمام‌شده حساب نکن.</blockquote>
<h2>۲. هفتهٔ جمع‌بندی</h2>
<p>هر سه هفته، یک هفته را فقط به مرور و تست بده. این کار منحنی فراموشی را صاف می‌کند.</p>
`,
    },
    {
      title: 'چرا هنگام استرس قلب سریع‌تر می‌زند؟',
      slug: 'cms-stress-heart-rate',
      excerpt:
        'واکنش قلبی به استرس نه نشانهٔ ضعف است و نه تصادفی؛ یک سازوکار دقیق بقاست که در چند ثانیه فعال می‌شود.',
      category: 'physiology',
      tags: ['فیزیولوژی', 'قلب', 'استرس'],
      authorName: 'دکتر نگار صادقی',
      body: `
<p>قبل از آزمون که می‌ایستی، قلبت بی‌دلیل تند می‌زند. این واکنش دقیقاً همان چیزی است که بدن برای «جنگ یا گریز» طراحی کرده است.</p>
<h2>مسیر سیگنال</h2>
<ol><li>هیپوتالاموس، سیستم سمپاتیک را فعال می‌کند.</li><li>آدرنالین از مدولای آدرنال ترشح می‌شود.</li><li>گره سینوسی‌دهلیزی سرعت شلیک را بالا می‌برد.</li></ol>
<p>نتیجه: افزایش برون‌ده قلبی و رساندن سریع‌تر اکسیژن به عضلات.</p>
`,
    },
  ];

  return demo.map((item, index) => ({
    id: makeId('art'),
    title: item.title,
    slug: item.slug,
    excerpt: item.excerpt,
    contentHtml: sanitizeHtml(item.body.trim()),
    cover: '',
    coverAlt: '',
    category: item.category,
    tags: item.tags,
    authorName: item.authorName,
    status: 'published',
    featured: index === 0,
    recommended: true,
    readingTime: 6,
    views: 0,
    likes: 0,
    seo: { title: '', description: '', canonical: '', ogImage: '', robots: 'index,follow' },
    publishedAt: created,
    createdAt: created,
    updatedAt: created,
    createdBy: 'seed',
    updatedBy: 'seed',
  }));
}

/*
 * مقالات ثابتِ بخش «مقالات تپش» یک‌بار به رکورد پنل تبدیل می‌شوند.
 *
 * چرا: تا پیش از این، فهرست مقالات پنل فقط سه رکورد آزمایشی بود و دوازده مقاله‌ای که
 * کاربران در `#articles` می‌خوانند اصلاً در پنل دیده نمی‌شدند — یعنی «همهٔ مقالات بخش
 * مقالات تپش» در دسترس مدیر نبود. این تابع هر مقالهٔ کاتالوگ را که رکوردی با همان
 * `slug` ندارد یک‌بار می‌سازد و **هیچ رکورد موجودی را بازنویسی نمی‌کند**.
 *
 * دو محافظ، دقیقاً مثل `syncFlashcardDecks`/`syncMicroCourses`/`syncReferences`:
 * گارد یک‌باردرعمر پروسه، و `writeJson` مستقیم به‌جای `writeCollection` تا حلقهٔ
 * `ensureStore` ساخته نشود.
 *
 * دو نکتهٔ عمدی:
 *   • `contentHtml` خالی می‌ماند. متن بلوکیِ کاتالوگ همان چیزی است که کاربران امروز
 *     می‌خوانند (با هایلایت و یادداشت‌گذاری روی متن)، پس تا وقتی مدیر متن را در پنل
 *     ویرایش نکند هیچ چیزی برای کاربر عوض نمی‌شود. به‌محض اولین ویرایش، `contentHtml`
 *     نوشته می‌شود و خواننده همان را رندر می‌کند.
 *   • `figure` کلید تصویر ثابت است و فقط از همین‌جا می‌آید. خوانندهٔ سایت اگر `cover`
 *     خالی باشد از همان کلید استفاده می‌کند، پس تا وقتی مدیر کاور تازه بارگذاری
 *     نکرده مقاله ظاهر قبلی‌اش را نگه می‌دارد.
 */
let articlesSynced = false;

function syncArticles() {
  if (articlesSynced) return;
  articlesSynced = true;

  const stored = readJson(files.articles, []);
  if (!Array.isArray(stored)) return;

  const known = new Set(stored.map((article) => article?.slug).filter(Boolean));
  const created = nowIso();

  const added = ARTICLE_CATALOG.filter((article) => !known.has(article.slug)).map((article) => ({
    id: makeId('art'),
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt ?? '',
    contentHtml: '',
    content: article.content ?? [],
    cover: '',
    coverAlt: article.coverAlt ?? '',
    figure: article.figure ?? null,
    category: article.category,
    tags: article.tags ?? [],
    authorName: ARTICLE_AUTHORS[article.author]?.name ?? 'تیم محتوای تپش',
    status: 'published',
    featured: Boolean(article.featured),
    recommended: Boolean(article.recommended),
    readingTime: Number(article.readingTime) || 1,
    views: Number(article.views) || 0,
    likes: Number(article.likes) || 0,
    seo: { title: '', description: '', canonical: '', ogImage: '', robots: 'index,follow' },
    origin: 'tapesh',
    publishedAt: article.publishedAt ?? created,
    createdAt: article.publishedAt ?? created,
    updatedAt: article.updatedAt ?? created,
    createdBy: 'seed',
    updatedBy: 'seed',
  }));

  if (added.length) writeJson(files.articles, [...added, ...stored]);
}

function seedPages() {
  const created = nowIso();
  return SEED_PAGES.map((page, index) => ({
    id: `pg-layer-${String(index + 1).padStart(2, '0')}`,
    title: page.title,
    slug: page.slug,
    group: page.group,
    icon: page.icon,
    route: page.route,
    description: page.description,
    contentHtml: '<p>این لایه هنوز محتوای معرفی ندارد.</p>',
    status: 'draft',
    cover: '',
    seo: { title: '', description: '', canonical: '', ogImage: '', robots: 'index,follow' },
    publishedAt: null,
    createdAt: created,
    updatedAt: created,
    createdBy: 'seed',
    updatedBy: 'seed',
  }));
}

function seedBanners() {
  const created = nowIso();
  return [
    {
      id: makeId('bn'),
      title: 'یادگیری پزشکی، ساده‌تر از هر زمان دیگری',
      subtitle: 'دروس پزشکی، آمادگی علوم پایه و جمع‌بندی هوشمند در یک پلتفرم.',
      image: '',
      buttonText: 'از الان شروع کنید',
      buttonUrl: '#products',
      isActive: true,
      sortOrder: 1,
      startDate: '',
      endDate: '',
      createdAt: created,
      updatedAt: created,
    },
  ];
}

function ensureStore() {
  ensureDir(contentDir);
  ensureDir(uploadsDir);

  ensureFile(files.admins, seedAdmins);
  ensureFile(files.articles, seedArticles);
  /* دوازده مقالهٔ ثابتِ بخش «مقالات تپش» که کاربران می‌خوانند، اینجا رکورد پنل می‌شوند */
  syncArticles();
  ensureFile(files.categories, SEED_CATEGORIES);
  ensureFile(files.pages, seedPages);
  ensureFile(files.flashcardDecks, seedFlashcardDecks);
  ensureFile(files.testBankQuestions, () => TEST_BANK_QUESTIONS.map((question) => ({
    ...question, status: 'published', difficulty: 'medium',
    stats: { solves: 0, correctPercent: 0, optionPercents: question.options.map(() => 0), avgTimeSec: 0, difficultyIndex: 0 },
  })));
  ensureFile(files.testBankAnswers, []);
  ensureFile(files.testBankHeartRewards, []);
  /* مجموعه‌های ثابت تپش که هنوز رکورد پنل ندارند، اینجا به رکورد تبدیل می‌شوند */
  syncFlashcardDecks();
  ensureFile(files.microCourses, seedMicroCourses);
  /* پروژه‌های موجود فقط فیزیولوژی را داشتند؛ درس‌های غایب رجیستری اینجا اضافه می‌شوند */
  syncMicroCourses();
  /* مراجع کاتالوگ ثابت تپش یک‌بار به رکورد پنل تبدیل می‌شوند */
  ensureFile(files.references, seedReferences);
  /* رکوردهای دور اول بدون مبحث، اینجا به مدل تازه (بخش → مبحث) مهاجرت می‌کنند */
  syncReferences();
  /* درسنامهٔ جامع دست‌نویس (آناتومی) یک‌بار به رکورد پنل تبدیل می‌شود */
  ensureFile(files.comprehensiveCourses, seedComprehensiveCourses);
  /* منابع و دوره‌های بین‌الملل — دورهٔ ثابتِ غایب اینجا رکورد می‌گیرد */
  ensureFile(files.intlProviders, seedIntlProviders);
  ensureFile(files.intlCourses, seedIntlCourses);
  syncIntlCatalog();
  ensureFile(files.media, []);
  ensureFile(files.banners, seedBanners);
  ensureFile(files.activity, []);
  ensureFile(files.notes, []);
  ensureFile(files.publishChannels, []);
  ensureFile(files.publishLog, []);
  ensureFile(files.settings, DEFAULT_SETTINGS);
}

/* ─────────────────────────────── دسترسی عمومی ─────────────────────────────── */

export function readCollection(name) {
  if (!COLLECTIONS.includes(name)) throw new Error('unknown-collection');
  ensureStore();
  const value = readJson(files[name], []);
  return Array.isArray(value) ? value : [];
}

export function writeCollection(name, items) {
  if (!COLLECTIONS.includes(name)) throw new Error('unknown-collection');
  ensureStore();
  writeJson(files[name], items);
  return items;
}

export function readSettings() {
  ensureStore();
  const stored = readJson(files.settings, DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    social: { ...DEFAULT_SETTINGS.social, ...(stored?.social ?? {}) },
    seo: { ...DEFAULT_SETTINGS.seo, ...(stored?.seo ?? {}) },
    integrations: { ...DEFAULT_SETTINGS.integrations, ...(stored?.integrations ?? {}) },
    media: { ...DEFAULT_SETTINGS.media, ...(stored?.media ?? {}) },
    security: { ...DEFAULT_SETTINGS.security, ...(stored?.security ?? {}) },
  };
}

export function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  writeJson(files.settings, next);
  return next;
}

/* ─────────────────────────────── ابزار عمومی ─────────────────────────────── */

/* نرمال‌سازی برای جست‌وجوی فارسی: ی/ك عربی، نیم‌فاصله و اعداد */
export function normalizeSearch(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f]/g, ' ')
    .toLowerCase()
    .trim();
}

export function paginate(items, { page = 1, perPage = 10 } = {}) {
  const size = Math.min(Math.max(Number(perPage) || 10, 1), 100);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(Number(page) || 1, 1), pages);
  const start = (current - 1) * size;

  return { items: items.slice(start, start + size), total, page: current, perPage: size, pages };
}

export function slugify(value) {
  const base = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  return base || `item-${randomUUID().slice(0, 6)}`;
}

export function ensureUniqueSlug(collection, slug, excludeId = null) {
  const items = readCollection(collection);
  const base = slugify(slug);
  let candidate = base;
  let counter = 2;

  while (items.some((item) => item.slug === candidate && item.id !== excludeId)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

export function publicAdmin(admin) {
  if (!admin) return null;
  const { passwordHash, ...safe } = admin;
  return { ...safe, roleLabel: roleLabel(admin.role), permissions: rolePermissions(admin.role) };
}

/* ──────────────────────────── احراز هویت و نشست ──────────────────────────── */

/*
 * نشست‌ها در حافظهٔ پروسه نگه داشته می‌شوند؛ برای یک پنل مدیریت تک‌سروری کافی است
 * و با مهاجرت به Backend واقعی به جدول sessions منتقل می‌شود.
 */
const sessions = new Map();
const loginAttempts = new Map();

/*
 * هش ساختگی برای یکسان‌کردن زمان پاسخ ورود.
 *
 * بدون این: حساب ناموجود یا غیرفعال بدون اجرای `scrypt` برمی‌گردد ولی حساب
 * موجود با رمز اشتباه یک `scrypt` کامل هزینه می‌دهد. اختلاف چند ده میلی‌ثانیه‌ای
 * قابل اندازه‌گیری است و attacker با زمان‌سنجی می‌فهمد کدام نام کاربری وجود دارد.
 * تنبل ساخته می‌شود تا هزینهٔ راه‌اندازی سرور را بالا نبرد.
 */
let timingDecoyHash = '';
function timingDecoyHashValue() {
  if (!timingDecoyHash) timingDecoyHash = hashPassword(randomBytes(16).toString('hex'));
  return timingDecoyHash;
}

export function findAdminByUsername(username) {
  const target = normalizeSearch(username);
  return readCollection('admins').find((admin) => normalizeSearch(admin.username) === target) ?? null;
}

export function authenticate({ username, password }) {
  const settings = readSettings();
  const key = normalizeSearch(username);
  const attempt = loginAttempts.get(key) ?? { count: 0, lockedUntil: 0 };

  if (attempt.lockedUntil > Date.now()) {
    const seconds = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
    return { error: 'locked', retryAfter: seconds };
  }

  const admin = findAdminByUsername(username);
  const usable = Boolean(admin && admin.isActive);

  /*
   * مسیر «حساب ناموجود/غیرفعال» هم یک `scrypt` کامل اجرا می‌کند (روی هش ساختگی)
   * تا زمان پاسخ با مسیر «رمز اشتباه» یکی باشد. نتیجه همیشه false است.
   */
  const passwordMatches = verifyPassword(password, usable ? admin.passwordHash : timingDecoyHashValue());

  /* پیام خطای یکسان برای کاربر ناموجود و رمز اشتباه — جلوگیری از user enumeration */
  if (!usable || !passwordMatches) {
    const count = attempt.count + 1;
    const limit = Number(settings.security?.maxLoginAttempts) || 8;
    loginAttempts.set(key, {
      count,
      lockedUntil: count >= limit ? Date.now() + (Number(settings.security?.lockMinutes) || 10) * 60_000 : 0,
    });
    return { error: 'invalid-credentials' };
  }

  loginAttempts.delete(key);

  const admins = readCollection('admins');
  const index = admins.findIndex((item) => item.id === admin.id);
  admins[index] = { ...admin, lastLoginAt: nowIso(), updatedAt: nowIso() };
  writeCollection('admins', admins);

  return { admin: admins[index] };
}

export function createSession(adminId, { userAgent = '', ip = '' } = {}) {
  const settings = readSettings();
  const hours = Number(settings.security?.sessionHours) || 12;
  const token = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(24).toString('hex');

  sessions.set(token, {
    adminId,
    csrfToken,
    userAgent: String(userAgent).slice(0, 300),
    ip: String(ip).slice(0, 60),
    expiresAt: Date.now() + hours * 3_600_000,
  });

  return { token, csrfToken, expiresAt: new Date(Date.now() + hours * 3_600_000).toISOString() };
}

export function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  /* تمدید لغزان تا کاربر فعال بیرون انداخته نشود */
  const settings = readSettings();
  const hours = Number(settings.security?.sessionHours) || 12;
  session.expiresAt = Date.now() + hours * 3_600_000;

  const admin = readCollection('admins').find((item) => item.id === session.adminId) ?? null;
  if (!admin || !admin.isActive) {
    sessions.delete(token);
    return null;
  }

  return { session, admin };
}

export function destroySession(token) {
  if (token) sessions.delete(token);
}

/*
 * باطل‌کردن همهٔ نشست‌های یک مدیر — برای رویدادهای امنیتی.
 *
 * چرا لازم است، در حالی که `getSession` هر بار رکورد تازهٔ مدیر را می‌خواند:
 * خواندن تازه فقط نقش/فعال‌بودن را بلافاصله اعمال می‌کند، ولی **توکن نشست** را
 * باطل نمی‌کند. اگر رمز عوض شود یا حساب حذف شود، توکن دزدیده‌شده تا پایان TTL
 * (پیش‌فرض ۱۲ ساعت) زنده می‌ماند. این تابع آن پنجره را می‌بندد.
 *
 * `keepToken` برای وقتی است که خودِ مدیر رمز خودش را عوض می‌کند و نمی‌خواهیم
 * از پنل بیرون بیفتد؛ فقط نشست‌های *دیگر* همان حساب باطل می‌شوند.
 */
export function destroySessionsForAdmin(adminId, { keepToken = '' } = {}) {
  if (!adminId) return 0;
  let removed = 0;
  sessions.forEach((session, token) => {
    if (session.adminId !== adminId) return;
    if (keepToken && token === keepToken) return;
    sessions.delete(token);
    removed += 1;
  });
  return removed;
}

export function clearExpiredSessions() {
  const now = Date.now();
  sessions.forEach((session, token) => {
    if (session.expiresAt < now) sessions.delete(token);
  });
}

/* وضعیت واقعی نشست‌ها — برای بخش «سلامت سیستم» مرکز تحلیل */
export function sessionStats() {
  clearExpiredSessions();
  const now = Date.now();
  const active = [...sessions.values()].filter((session) => session.expiresAt > now);

  return {
    active: active.length,
    /* ۹۰٪ پنجرهٔ ۱۲ ساعته — نزدیک به انقضا */
    expiringSoon: active.filter((session) => session.expiresAt - now < 0.1 * 12 * 3_600_000).length,
    oldest: active.length ? new Date(Math.min(...active.map((session) => session.expiresAt))).toISOString() : null,
  };
}

/* ────────────────────────────── گزارش رویدادها ────────────────────────────── */

const ACTIVITY_LIMIT = 500;

export function logActivity({
  admin = null,
  action,
  entityType,
  entityId = '',
  entityLabel = '',
  metadata = {},
  ip = '',
  userAgent = '',
}) {
  const entries = readCollection('activity');

  entries.unshift({
    id: makeId('log'),
    userId: admin?.id ?? 'system',
    userName: admin?.name || admin?.username || 'سیستم',
    action,
    entityType,
    entityId,
    entityLabel: String(entityLabel).slice(0, 160),
    metadata,
    ip: String(ip).slice(0, 60),
    userAgent: String(userAgent).slice(0, 200),
    createdAt: nowIso(),
  });

  writeCollection('activity', entries.slice(0, ACTIVITY_LIMIT));
}

/* ─────────────────────────────── مقالات ─────────────────────────────── */

export const ARTICLE_STATUSES = ['draft', 'published', 'archived'];

export function listArticles({
  search = '', status = 'all', category = 'all', page = 1, perPage = 10, sort = 'newest',
} = {}) {
  const query = normalizeSearch(search);

  const filtered = readCollection('articles').filter((article) => {
    if (status !== 'all' && article.status !== status) return false;
    if (category !== 'all' && article.category !== category) return false;
    if (!query) return true;
    return [article.title, article.slug, article.excerpt, article.authorName, article.category]
      .some((field) => normalizeSearch(field).includes(query));
  });

  const sorters = {
    newest: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
    oldest: (a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)),
    title: (a, b) => String(a.title).localeCompare(String(b.title), 'fa'),
    views: (a, b) => (b.views ?? 0) - (a.views ?? 0),
  };

  filtered.sort(sorters[sort] ?? sorters.newest);

  return paginate(filtered, { page, perPage });
}

export function getArticle(id) {
  return readCollection('articles').find((article) => article.id === id) ?? null;
}

function articlePayload(input, existing = null) {
  const title = String(input.title ?? '').trim();
  if (!title) throw Object.assign(new Error('عنوان مقاله الزامی است'), { code: 'VALIDATION_ERROR' });

  const contentHtml = sanitizeHtml(input.contentHtml ?? '');
  const excerpt = String(input.excerpt ?? '').trim() || buildExcerpt(contentHtml, 180);
  const category = String(input.category ?? '').trim();
  if (!category) throw Object.assign(new Error('دسته‌بندی الزامی است'), { code: 'VALIDATION_ERROR' });

  const status = ARTICLE_STATUSES.includes(input.status) ? input.status : 'draft';
  const wasPublished = existing?.status === 'published';

  return {
    title,
    slug: ensureUniqueSlug('articles', input.slug || title, existing?.id ?? null),
    excerpt: excerpt.slice(0, 400),
    contentHtml,
    cover: String(input.cover ?? ''),
    coverAlt: String(input.coverAlt ?? ''),
    category,
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 20) : [],
    authorName: String(input.authorName ?? '').trim() || 'تیم محتوای تپش',
    status,
    featured: Boolean(input.featured),
    recommended: Boolean(input.recommended),
    /*
     * منبع و تصویر ثابت فقط از رکورد قبلی ارث می‌رسند و از بدنهٔ درخواست خوانده
     * نمی‌شوند: `origin` می‌گوید مقاله از کاتالوگ ثابت تپش آمده یا ساختهٔ پنل است،
     * و `figure` کلید تصویر ثابت است که تا وقتی `cover` خالی باشد به کار می‌آید.
     */
    origin: existing?.origin === 'tapesh' ? 'tapesh' : 'panel',
    figure: existing?.figure ?? null,
    readingTime: Math.max(1, Math.round(String(contentHtml).replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length / 200)),
    seo: {
      title: String(input.seo?.title ?? '').slice(0, 70),
      description: String(input.seo?.description ?? '').slice(0, 180),
      canonical: String(input.seo?.canonical ?? '').slice(0, 300),
      ogImage: String(input.seo?.ogImage ?? '').slice(0, 300),
      robots: String(input.seo?.robots ?? 'index,follow').slice(0, 40),
    },
    publishedAt: status === 'published' ? (existing?.publishedAt || nowIso()) : (wasPublished ? existing.publishedAt : null),
  };
}

export function createArticle(input, admin) {
  const articles = readCollection('articles');
  const created = nowIso();

  const article = {
    id: makeId('art'),
    ...articlePayload(input),
    views: 0,
    likes: 0,
    createdAt: created,
    updatedAt: created,
    createdBy: admin?.id ?? 'system',
    updatedBy: admin?.id ?? 'system',
  };

  articles.unshift(article);
  writeCollection('articles', articles);
  return article;
}

export function updateArticle(id, input, admin) {
  const articles = readCollection('articles');
  const index = articles.findIndex((article) => article.id === id);
  if (index === -1) return null;

  const updated = {
    ...articles[index],
    ...articlePayload(input, articles[index]),
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
  };

  articles[index] = updated;
  writeCollection('articles', articles);
  return updated;
}

export function setArticleStatus(id, status, admin) {
  if (!ARTICLE_STATUSES.includes(status)) {
    throw Object.assign(new Error('وضعیت نامعتبر است'), { code: 'VALIDATION_ERROR' });
  }

  const articles = readCollection('articles');
  const index = articles.findIndex((article) => article.id === id);
  if (index === -1) return null;

  const current = articles[index];
  const updated = {
    ...current,
    status,
    publishedAt: status === 'published' ? (current.publishedAt || nowIso()) : current.publishedAt,
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
  };

  articles[index] = updated;
  writeCollection('articles', articles);
  return updated;
}

export function deleteArticle(id) {
  const articles = readCollection('articles');
  const target = articles.find((article) => article.id === id);
  if (!target) return null;

  writeCollection('articles', articles.filter((article) => article.id !== id));
  return target;
}

/* ─────────────────────────────── دسته‌بندی‌ها ─────────────────────────────── */

const ACCENTS = ['blue', 'lavender', 'purple', 'sky', 'green', 'mint', 'copper', 'sage', 'gold'];

export function listCategories() {
  const articles = readCollection('articles');
  return readCollection('categories').map((category) => ({
    ...category,
    count: articles.filter((article) => article.category === category.id).length,
  }));
}

export function saveCategory(input, id = null) {
  const label = String(input.label ?? '').trim();
  if (!label) throw Object.assign(new Error('نام دسته‌بندی الزامی است'), { code: 'VALIDATION_ERROR' });

  const categories = readCollection('categories');
  const accent = ACCENTS.includes(input.accent) ? input.accent : 'blue';

  if (id) {
    const index = categories.findIndex((category) => category.id === id);
    if (index === -1) return null;
    categories[index] = { ...categories[index], label, accent };
    writeCollection('categories', categories);
    return categories[index];
  }

  const category = { id: ensureUniqueSlug('categories', input.slug || label), label, accent };
  categories.push(category);
  writeCollection('categories', categories);
  return category;
}

export function deleteCategory(id) {
  const used = readCollection('articles').filter((article) => article.category === id).length;
  if (used > 0) {
    throw Object.assign(new Error(`این دسته‌بندی روی ${used} مقاله استفاده شده است`), { code: 'CONFLICT' });
  }

  const categories = readCollection('categories');
  const target = categories.find((category) => category.id === id);
  if (!target) return null;

  writeCollection('categories', categories.filter((category) => category.id !== id));
  return target;
}

/* ──────────────────────────────── صفحات ──────────────────────────────── */

export function listPages({ search = '', status = 'all', page = 1, perPage = 10 } = {}) {
  const query = normalizeSearch(search);
  const filtered = readCollection('pages').filter((page_) => {
    if (status !== 'all' && page_.status !== status) return false;
    if (!query) return true;
    return [page_.title, page_.slug].some((field) => normalizeSearch(field).includes(query));
  });

  filtered.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return paginate(filtered, { page, perPage });
}

export function getPage(id) {
  return readCollection('pages').find((page_) => page_.id === id) ?? null;
}

export function getPageBySlug(slug) {
  return readCollection('pages').find((page_) => page_.slug === slug && page_.status === 'published') ?? null;
}

function pagePayload(input, existing = null) {
  const title = String(input.title ?? '').trim();
  if (!title) throw Object.assign(new Error('عنوان صفحه الزامی است'), { code: 'VALIDATION_ERROR' });

  const status = ARTICLE_STATUSES.includes(input.status) ? input.status : 'draft';

  return {
    title,
    slug: ensureUniqueSlug('pages', input.slug || title, existing?.id ?? null),
    /* فرادادهٔ لایه — فقط از seed مقداردهی می‌شود و در ویرایش حفظ می‌شود */
    group: PAGE_GROUPS.includes(input.group) ? input.group : (existing?.group ?? 'learning'),
    icon: String(input.icon ?? existing?.icon ?? '').slice(0, 40),
    route: String(input.route ?? existing?.route ?? '').slice(0, 300),
    description: String(input.description ?? '').slice(0, 300),
    contentHtml: sanitizeHtml(input.contentHtml ?? ''),
    cover: String(input.cover ?? ''),
    status,
    seo: {
      title: String(input.seo?.title ?? '').slice(0, 70),
      description: String(input.seo?.description ?? '').slice(0, 180),
      canonical: String(input.seo?.canonical ?? '').slice(0, 300),
      ogImage: String(input.seo?.ogImage ?? '').slice(0, 300),
      robots: String(input.seo?.robots ?? 'index,follow').slice(0, 40),
    },
    publishedAt: status === 'published' ? (existing?.publishedAt || nowIso()) : (existing?.publishedAt ?? null),
  };
}

export function createPage(input, admin) {
  const pages = readCollection('pages');
  const created = nowIso();

  const page_ = {
    id: makeId('pg'),
    ...pagePayload(input),
    createdAt: created,
    updatedAt: created,
    createdBy: admin?.id ?? 'system',
    updatedBy: admin?.id ?? 'system',
  };

  pages.unshift(page_);
  writeCollection('pages', pages);
  return page_;
}

export function updatePage(id, input, admin) {
  const pages = readCollection('pages');
  const index = pages.findIndex((page_) => page_.id === id);
  if (index === -1) return null;

  const updated = {
    ...pages[index],
    ...pagePayload(input, pages[index]),
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
  };

  pages[index] = updated;
  writeCollection('pages', pages);
  return updated;
}

export function deletePage(id) {
  const pages = readCollection('pages');
  const target = pages.find((page_) => page_.id === id);
  if (!target) return null;

  writeCollection('pages', pages.filter((page_) => page_.id !== id));
  return target;
}

/* ─────────────────────────────── مراجع تپش ─────────────────────────────── */

/*
 * شکل داده:
 *   مرجع { title, latin, edition, authors, subject, accent, pages, glyph, status, sections[] }
 *   بخش  { id, title, topics[] }
 *   مبحث { id, title, content }  — `content` متن غنی است و با `sanitizeHtml` پاک می‌شود
 *
 * مثل میکرو درسنامه، هر بخش چند «مبحث» دارد و متنِ واقعی روی مبحث‌هاست. سه مرجعِ
 * کاتالوگ ثابت (`src/services/references/referenceCatalog.js`) هنگام نخستین اجرا به
 * رکورد تبدیل می‌شوند و هر فصلِ شناخته‌شدهٔ کتاب یک بخش و هر بخشِ نوشته‌شدهٔ آن فصل یک
 * مبحث با متن آماده می‌سازد. مثل فلش‌کارت و میکرو، کل مرجع یک رکورد است تا
 * افزودن/حذف مبحث و انتشار، یک عملیات اتمیک باشد.
 */

const REFERENCE_GLYPHS = ['bone', 'cell', 'heart'];

function referenceTopicPayload(input, index = 0) {
  const title = String(input?.title ?? '').trim().slice(0, 160);

  return {
    id: String(input?.id ?? '').trim().slice(0, 60) || makeId('rtop'),
    title: title || `مبحث ${index + 1}`,
    content: sanitizeHtml(String(input?.content ?? '')),
  };
}

function referenceSectionPayload(input, index = 0) {
  const title = String(input?.title ?? '').trim().slice(0, 160);

  return {
    id: String(input?.id ?? '').trim().slice(0, 60) || makeId('rsec'),
    title: title || `بخش ${index + 1}`,
    topics: (Array.isArray(input?.topics) ? input.topics : []).map(referenceTopicPayload),
  };
}

function referencePayload(input, existing = null) {
  const title = String(input?.title ?? '').trim().slice(0, 160);
  if (!title) throw Object.assign(new Error('عنوان مرجع الزامی است'), { code: 'VALIDATION_ERROR' });

  const status = ARTICLE_STATUSES.includes(input?.status) ? input.status : 'draft';

  return {
    title,
    latin: String(input?.latin ?? '').trim().slice(0, 160),
    edition: String(input?.edition ?? '').trim().slice(0, 80),
    authors: String(input?.authors ?? '').trim().slice(0, 160),
    subject: String(input?.subject ?? '').trim().slice(0, 80),
    accent: /^#[0-9a-fA-F]{3,8}$/.test(String(input?.accent ?? '')) ? String(input.accent) : '#5b8cc7',
    pages: Math.min(100_000, Math.max(0, Math.round(Number(input?.pages) || 0))),
    glyph: REFERENCE_GLYPHS.includes(input?.glyph) ? input.glyph : 'bone',
    sections: (Array.isArray(input?.sections) ? input.sections : []).map(referenceSectionPayload),
    status,
    /* منبع مرجع فقط از رکورد قبلی ارث می‌رسد؛ از بدنهٔ درخواست خوانده نمی‌شود */
    origin: existing?.origin === 'tapesh' ? 'tapesh' : 'panel',
    publishedAt: status === 'published' ? (existing?.publishedAt || nowIso()) : (existing?.publishedAt ?? null),
  };
}

/* سه مرجعِ ثابت کاتالوگ — هر فصل یک بخش و هر بخشِ نوشته‌شدهٔ فصل، یک مبحث با متن آماده */
function seedReferences() {
  const created = nowIso();

  return REFERENCE_CATALOG.map((reference) => ({
    id: reference.id,
    title: reference.title,
    latin: reference.latin ?? '',
    edition: reference.edition ?? '',
    authors: reference.authors ?? '',
    subject: reference.subject ?? '',
    accent: reference.accent ?? '#5b8cc7',
    pages: Number(reference.pages) || 0,
    glyph: REFERENCE_GLYPHS.includes(reference.glyph) ? reference.glyph : 'bone',
    sections: (reference.chapters ?? []).map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      topics: (REFERENCE_CONTENTS[chapter.id]?.sections ?? []).map((section) => ({
        id: section.id,
        title: section.title,
        content: referenceBlocksToHtml(section.blocks),
      })),
    })),
    status: 'published',
    origin: 'tapesh',
    createdAt: created,
    updatedAt: created,
    createdBy: 'seed',
    updatedBy: 'seed',
    publishedAt: created,
  }));
}

/*
 * مبحث‌ها، لایهٔ تازهٔ مدل مراجع‌اند: رکوردهایی که پیش از این مدل بدون `topics`
 * ساخته شده‌اند (دور اول لایه) اینجا backfill می‌شوند — برای بخش‌هایی که شناسه‌شان
 * با فصلِ کاتالوگ یکی است، مبحث‌ها با متنِ همان فصل ساخته می‌شوند و برای بقیه
 * فقط آرایهٔ خالی می‌گیرند. فیلد کهنهٔ `content` بخش هم حذف می‌شود چون متن حالا
 * روی مبحث‌هاست. یک‌بار در عمر پروسه و با `writeJson` مستقیم — همان دو محافظ
 * `syncFlashcardDecks`/`syncMicroCourses`.
 */
let referencesSynced = false;

function syncReferences() {
  if (referencesSynced) return;
  referencesSynced = true;

  const stored = readJson(files.references, []);
  if (!Array.isArray(stored)) return;

  let changed = false;
  const migrated = stored.map((reference) => {
    if (!reference || !Array.isArray(reference.sections)) return reference;

    let touched = false;
    const sections = reference.sections.map((section) => {
      if (!section || Array.isArray(section.topics)) return section;
      touched = true;

      const catalog = REFERENCE_CONTENTS[section.id]?.sections ?? [];
      const topics = catalog.length
        ? catalog.map((item) => ({
          id: item.id,
          title: item.title,
          content: referenceBlocksToHtml(item.blocks),
        }))
        : [];

      return { id: section.id, title: section.title, topics };
    });

    if (!touched) return reference;
    changed = true;
    return { ...reference, sections };
  });

  if (changed) writeJson(files.references, migrated);
}

export function listReferences({ search = '', status = 'all', page = 1, perPage = 20 } = {}) {
  const query = normalizeSearch(search);
  const filtered = readCollection('references').filter((reference) => {
    if (status !== 'all' && reference.status !== status) return false;
    if (!query) return true;
    return [reference.title, reference.latin, reference.subject].some((field) => normalizeSearch(field).includes(query));
  });

  filtered.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return paginate(filtered, { page, perPage });
}

export function getReference(id) {
  return readCollection('references').find((reference) => reference.id === id) ?? null;
}

export function createReference(input, admin) {
  const references = readCollection('references');
  const created = nowIso();

  const reference = {
    id: makeId('ref'),
    ...referencePayload(input),
    createdAt: created,
    updatedAt: created,
    createdBy: admin?.id ?? 'system',
    updatedBy: admin?.id ?? 'system',
  };

  references.unshift(reference);
  writeCollection('references', references);
  return reference;
}

export function updateReference(id, input, admin) {
  const references = readCollection('references');
  const index = references.findIndex((reference) => reference.id === id);
  if (index === -1) return null;

  const updated = {
    ...references[index],
    ...referencePayload(input, references[index]),
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
  };

  references[index] = updated;
  writeCollection('references', references);
  return updated;
}

export function deleteReference(id) {
  const references = readCollection('references');
  const target = references.find((reference) => reference.id === id);
  if (!target) return null;

  writeCollection('references', references.filter((reference) => reference.id !== id));
  return target;
}

/*
 * قرارداد عمومی مراجع — فقط منتشرشده‌ها، با همان کلیدهایی که لایهٔ رفرنس
 * کاربران می‌خواند (`referencesApi.js` این‌ها را جلوی کاتالوگ ثابت می‌گذارد).
 */
export function publishedReferences() {
  return readCollection('references')
    .filter((reference) => reference.status === 'published')
    .map((reference) => ({
      id: reference.id,
      title: reference.title,
      latin: reference.latin,
      edition: reference.edition,
      authors: reference.authors,
      subject: reference.subject,
      accent: reference.accent,
      pages: reference.pages,
      glyph: reference.glyph,
      sections: reference.sections.map((section) => ({
        id: section.id,
        title: section.title,
        topics: (section.topics ?? []).map((topic) => ({
          id: topic.id,
          title: topic.title,
          content: topic.content,
        })),
      })),
    }));
}

/* ─────────────────────── دوره‌های بین‌الملل (لایهٔ داخل پنل) ───────────────────────
 *
 * دو مجموعهٔ جدا:
 *   intlProviders — منابع: نام فارسی/لاتین، کشور، سال بنیان، معرفی، حوزه‌ها، لوگو،
 *                   ترتیب فهرست (`sortOrder`) و ترتیب نوار متحرک (`marqueeOrder`؛
 *                   صفر = در نوار نیاید). منابعی که دوره‌ای در تپش ندارند هم رکورد
 *                   دارند تا فقط در نوار دیده شوند.
 *   intlCourses   — دوره‌ها: فراداده + بخش‌ها؛ هر بخش یک ویدیو و چند زیرنویس دارد.
 *
 * ناشر فقط با `providerId` به منبع وصل می‌شود، پس نام و لوگوی دانشگاه یک منبع
 * حقیقت دارد و ویرایشش همهٔ کارت‌های آن دانشگاه را هم عوض می‌کند.
 *
 * تصویر و لوگو دو جا می‌توانند بیایند: `image`/`logo` (فایل آپلودی پنل) یا
 * `imageKey`/`logoKey` (دارایی باندل‌شدهٔ خود پروژه). سرور نمی‌تواند تصویر
 * باندل کند، پس seed فقط کلید می‌گذارد و حل آدرس سمت مرورگر است (`intlAssets.js`).
 *
 * مثل مراجع و میکرو، کل دوره یک موجودیت کامل است: ویرایش یک PUT کامل می‌فرستد
 * و افزودن/حذف بخش و انتشار، اتمیک می‌ماند.
 */

const INTL_STATUSES = ['draft', 'published', 'archived'];

const intlText = (value, max) => String(value ?? '').trim().slice(0, max);
const intlHex = (value, fallback) => (/^#[0-9a-fA-F]{3,8}$/.test(String(value ?? '')) ? String(value) : fallback);
const intlCount = (value, max = 100_000) => Math.min(max, Math.max(0, Math.round(Number(value) || 0)));
/* اعداد عنوان‌های پیش‌فرض فارسی می‌مانند (قرارداد UI تپش) */
const intlFaNumber = (value) => String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

function intlSubtitlePayload(input) {
  const url = intlText(input?.url, 400);
  if (!url) return null;

  const lang = intlText(input?.lang, 12) || 'fa';
  const known = INTL_SUBTITLE_LANGS.find((item) => item.id === lang);

  return {
    lang,
    label: intlText(input?.label, 40) || known?.label || lang,
    url,
  };
}

function intlSectionPayload(input, index = 0) {
  const subtitles = (Array.isArray(input?.subtitles) ? input.subtitles : [])
    .map(intlSubtitlePayload)
    .filter(Boolean)
    /* هر زبان یک‌بار — زیرنویس تکراری همان زبان بی‌معناست */
    .filter((item, position, list) => list.findIndex((other) => other.lang === item.lang) === position);

  return {
    id: intlText(input?.id, 60) || makeId('isec'),
    title: intlText(input?.title, 200) || `ویدیو ${intlFaNumber(index + 1)}`,
    time: intlText(input?.time, 20),
    desc: intlText(input?.desc, 1200),
    videoUrl: intlText(input?.videoUrl, 400),
    videoMime: intlText(input?.videoMime, 80),
    subtitles,
  };
}

function intlCoursePayload(input, existing = null) {
  const title = intlText(input?.title, 160);
  if (!title) throw Object.assign(new Error('عنوان دوره الزامی است'), { code: 'VALIDATION_ERROR' });

  const status = INTL_STATUSES.includes(input?.status) ? input.status : 'draft';
  const category = intlText(input?.category, 40) || 'medicine';

  return {
    title,
    providerId: intlText(input?.providerId, 60),
    category,
    categoryLabel: intlText(input?.categoryLabel, 80),
    level: intlText(input?.level, 40) || 'مقدماتی',
    duration: intlCount(input?.duration, 1000),
    totalDuration: intlText(input?.totalDuration, 20),
    progress: intlCount(input?.progress, 100),
    accent: intlHex(input?.accent, '#5b8cc7'),
    accentSoft: intlHex(input?.accentSoft, '#1d314a'),
    badge: intlText(input?.badge, 40),
    description: intlText(input?.description, 600),
    tags: (Array.isArray(input?.tags) ? input.tags : [])
      .map((tag) => intlText(tag, 40))
      .filter(Boolean)
      .slice(0, 8),
    image: intlText(input?.image, 400),
    imageKey: intlText(input?.imageKey, 60),
    sortOrder: intlCount(input?.sortOrder, 10_000),
    sections: (Array.isArray(input?.sections) ? input.sections : []).map(intlSectionPayload),
    status,
    /* منبع رکورد فقط از رکورد قبلی ارث می‌رسد؛ از بدنهٔ درخواست خوانده نمی‌شود */
    origin: existing?.origin === 'tapesh' ? 'tapesh' : 'panel',
    publishedAt: status === 'published' ? (existing?.publishedAt || nowIso()) : (existing?.publishedAt ?? null),
  };
}

function intlProviderPayload(input, existing = null) {
  const name = intlText(input?.name, 160);
  if (!name) throw Object.assign(new Error('نام منبع الزامی است'), { code: 'VALIDATION_ERROR' });

  const status = INTL_STATUSES.includes(input?.status) ? input.status : 'draft';

  return {
    name,
    nameEn: intlText(input?.nameEn, 160),
    kind: intlText(input?.kind, 40) || 'university',
    country: intlText(input?.country, 80),
    founded: intlText(input?.founded, 20),
    description: intlText(input?.description, 800),
    focus: (Array.isArray(input?.focus) ? input.focus : [])
      .map((item) => intlText(item, 60))
      .filter(Boolean)
      .slice(0, 6),
    logo: intlText(input?.logo, 400),
    logoKey: intlText(input?.logoKey, 60),
    sortOrder: intlCount(input?.sortOrder, 10_000),
    marqueeOrder: intlCount(input?.marqueeOrder, 10_000),
    status,
    origin: existing?.origin === 'tapesh' ? 'tapesh' : 'panel',
    publishedAt: status === 'published' ? (existing?.publishedAt || nowIso()) : (existing?.publishedAt ?? null),
  };
}

/* منابع ثابت کاتالوگ — یک‌بار به رکورد پنل تبدیل می‌شوند (منتشرشده) */
function seedIntlProviders() {
  const created = nowIso();

  return INTL_PROVIDER_CATALOG.map((provider) => ({
    id: provider.id,
    ...intlProviderPayload({ ...provider, status: 'published' }),
    origin: 'tapesh',
    createdAt: created,
    updatedAt: created,
    createdBy: 'seed',
    updatedBy: 'seed',
    publishedAt: created,
  }));
}

/* دوره‌های ثابت کاتالوگ — با بخش‌هایشان؛ ویدیو و زیرنویس خالی می‌ماند */
function seedIntlCourses() {
  const created = nowIso();

  return INTL_COURSE_CATALOG.map((course) => ({
    id: course.id,
    ...intlCoursePayload({ ...course, status: 'published' }),
    origin: 'tapesh',
    createdAt: created,
    updatedAt: created,
    createdBy: 'seed',
    updatedBy: 'seed',
    publishedAt: created,
  }));
}

/*
 * همگام‌سازی افزایشی — همان دو محافظ `syncFlashcardDecks`/`syncMicroCourses`:
 * یک‌بار در عمر پروسه و با `writeJson` مستقیم (نه `writeCollection`، که داخل
 * `ensureStore` حلقهٔ بی‌پایان می‌سازد). فقط رکوردهای **غایب** را اضافه می‌کند؛
 * رکورد موجود — حتی اگر ادمین پاکش کرده باشد — بازنویسی نمی‌شود.
 */
let intlSynced = false;

function syncIntlCatalog() {
  if (intlSynced) return;
  intlSynced = true;

  const providers = readJson(files.intlProviders, []);
  if (Array.isArray(providers)) {
    const known = new Set(providers.map((provider) => provider?.id));
    const missing = seedIntlProviders().filter((provider) => !known.has(provider.id));
    if (missing.length) writeJson(files.intlProviders, [...providers, ...missing]);
  }

  const courses = readJson(files.intlCourses, []);
  if (Array.isArray(courses)) {
    const known = new Set(courses.map((course) => course?.id));
    const missing = seedIntlCourses().filter((course) => !known.has(course.id));
    if (missing.length) writeJson(files.intlCourses, [...courses, ...missing]);
  }
}

const intlBySort = (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);

export function listIntlCourses({ search = '', status = 'all', providerId = 'all', page = 1, perPage = 50 } = {}) {
  const query = normalizeSearch(search);
  const filtered = readCollection('intlCourses').filter((course) => {
    if (status !== 'all' && course.status !== status) return false;
    if (providerId !== 'all' && course.providerId !== providerId) return false;
    if (!query) return true;
    return [course.title, course.categoryLabel, course.description, ...(course.tags ?? [])]
      .some((field) => normalizeSearch(field).includes(query));
  });

  filtered.sort(intlBySort);
  return paginate(filtered, { page, perPage });
}

export function getIntlCourse(id) {
  return readCollection('intlCourses').find((course) => course.id === id) ?? null;
}

export function createIntlCourse(input, admin) {
  const courses = readCollection('intlCourses');
  const created = nowIso();

  const course = {
    id: makeId('intl'),
    ...intlCoursePayload(input),
    createdAt: created,
    updatedAt: created,
    createdBy: admin?.id ?? 'system',
    updatedBy: admin?.id ?? 'system',
  };

  courses.push(course);
  writeCollection('intlCourses', courses);
  return course;
}

export function updateIntlCourse(id, input, admin) {
  const courses = readCollection('intlCourses');
  const index = courses.findIndex((course) => course.id === id);
  if (index === -1) return null;

  const updated = {
    ...courses[index],
    ...intlCoursePayload(input, courses[index]),
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
  };

  courses[index] = updated;
  writeCollection('intlCourses', courses);
  return updated;
}

export function deleteIntlCourse(id) {
  const courses = readCollection('intlCourses');
  const target = courses.find((course) => course.id === id);
  if (!target) return null;

  writeCollection('intlCourses', courses.filter((course) => course.id !== id));
  return target;
}

export function listIntlProviders({ search = '', status = 'all' } = {}) {
  const query = normalizeSearch(search);
  const filtered = readCollection('intlProviders').filter((provider) => {
    if (status !== 'all' && provider.status !== status) return false;
    if (!query) return true;
    return [provider.name, provider.nameEn, provider.country].some((field) => normalizeSearch(field).includes(query));
  });

  filtered.sort(intlBySort);
  return { items: filtered, total: filtered.length };
}

export function getIntlProvider(id) {
  return readCollection('intlProviders').find((provider) => provider.id === id) ?? null;
}

export function createIntlProvider(input, admin) {
  const providers = readCollection('intlProviders');
  const created = nowIso();

  const provider = {
    id: makeId('intlp'),
    ...intlProviderPayload(input),
    createdAt: created,
    updatedAt: created,
    createdBy: admin?.id ?? 'system',
    updatedBy: admin?.id ?? 'system',
  };

  providers.push(provider);
  writeCollection('intlProviders', providers);
  return provider;
}

export function updateIntlProvider(id, input, admin) {
  const providers = readCollection('intlProviders');
  const index = providers.findIndex((provider) => provider.id === id);
  if (index === -1) return null;

  const updated = {
    ...providers[index],
    ...intlProviderPayload(input, providers[index]),
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
  };

  providers[index] = updated;
  writeCollection('intlProviders', providers);
  return updated;
}

/*
 * حذف منبع — اگر دوره‌ای به آن وصل باشد رد می‌شود.
 * حذف خاموش منبع، کارت‌های آن دوره‌ها را بی‌ناشر می‌کرد و کاربر فقط یک کارت
 * بی‌نام می‌دید؛ پس اجازه نمی‌دهیم و شمارش دوره‌ها را در خطا برمی‌گردانیم.
 */
export function deleteIntlProvider(id) {
  const providers = readCollection('intlProviders');
  const target = providers.find((provider) => provider.id === id);
  if (!target) return null;

  const used = readCollection('intlCourses').filter((course) => course.providerId === id).length;
  if (used > 0) {
    throw Object.assign(new Error(`این منبع ${used} دوره دارد؛ اول دوره‌ها را به منبع دیگری وصل کنید`), {
      code: 'VALIDATION_ERROR',
    });
  }

  writeCollection('intlProviders', providers.filter((provider) => provider.id !== id));
  return target;
}

/*
 * قرارداد عمومی — فقط منتشرشده‌ها، با همان کلیدهایی که `intlCoursesService`
 * سمت مرورگر می‌خواند. اتصال ناشر به دوره سمت کلاینت انجام می‌شود تا
 * کاتالوگ ثابت و نسخهٔ پنل از یک مسیر رد شوند.
 */
export function publishedIntlCatalog() {
  const providers = readCollection('intlProviders')
    .filter((provider) => provider.status === 'published')
    .sort(intlBySort)
    .map((provider) => ({
      id: provider.id,
      name: provider.name,
      nameEn: provider.nameEn,
      kind: provider.kind,
      country: provider.country,
      founded: provider.founded,
      description: provider.description,
      focus: provider.focus ?? [],
      logo: provider.logo,
      logoKey: provider.logoKey,
      sortOrder: provider.sortOrder,
      marqueeOrder: provider.marqueeOrder,
    }));

  const courses = readCollection('intlCourses')
    .filter((course) => course.status === 'published')
    .sort(intlBySort)
    .map((course) => ({
      id: course.id,
      title: course.title,
      providerId: course.providerId,
      category: course.category,
      categoryLabel: course.categoryLabel,
      level: course.level,
      duration: course.duration,
      totalDuration: course.totalDuration,
      progress: course.progress,
      accent: course.accent,
      accentSoft: course.accentSoft,
      badge: course.badge,
      description: course.description,
      tags: course.tags ?? [],
      image: course.image,
      imageKey: course.imageKey,
      sortOrder: course.sortOrder,
      sections: (course.sections ?? []).map((section) => ({
        id: section.id,
        title: section.title,
        time: section.time,
        desc: section.desc,
        videoUrl: section.videoUrl,
        videoMime: section.videoMime,
        subtitles: section.subtitles ?? [],
      })),
    }));

  return { courses, providers };
}

/*
 * بارگذاری دودویی ویدیو/زیرنویس.
 *
 * چرا مسیر جدا و چرا جریانی: بدنهٔ این درخواست JSON نیست، فایل خام است.
 * اگر مثل آپلود تصویر base64 می‌کردیم، یک ویدیوی ۲۰۰ مگابایتی هم در حافظهٔ
 * مرورگر و هم در حافظهٔ سرور چند برابر می‌شد و از سقف `MAX_BODY_BYTES`
 * می‌گذشت. اینجا بایت‌ها همان‌طور که می‌رسند روی دیسک نوشته می‌شوند و اگر از
 * سقف بگذرند، فایل نیمه‌کاره پاک می‌شود.
 */
/*
 * SRT → WebVTT.
 *
 * چرا لازم است: عنصر `<track>` مرورگر **فقط WebVTT** را می‌خواند و برای `.srt`
 * بی‌صدا هیچ زیرنویسی نشان نمی‌دهد — نه خطایی در کنسول، نه چیزی روی ویدیو.
 * پس همان لحظهٔ بارگذاری تبدیل می‌شود تا مدیر لازم نباشد فایلش را دستی عوض کند.
 */
function srtToVtt(text) {
  const body = String(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    /* اگر فایل از قبل VTT بود، سرصفحهٔ قدیمی برداشته می‌شود تا دوباره بیاید */
    .replace(/^WEBVTT[^\n]*\n+/, '')
    /* شمارهٔ ترتیب بلوک‌ها در WebVTT لازم نیست */
    .replace(/^\d+\n(?=\d{1,2}:\d{2})/gm, '')
    /* `,` به `.` و میلی‌ثانیه به سه رقم (قرارداد WebVTT) */
    .replace(/(\d{1,2}:\d{2}(?::\d{2})?),(\d{1,3})/g, (_, stamp, ms) => `${stamp}.${ms.padEnd(3, '0')}`);

  return `WEBVTT\n\n${body.trim()}\n`;
}

export function saveIntlUpload({ originalName, extension, mimeType, stream, maxBytes }) {
  /*
   * پسوند را فراخوان می‌دهد (از نام فایل اصلی) چون نوع اعلامی مرورگر برای
   * زیرنویس قابل اتکا نیست. اگر نداد، از نوع MIME می‌سازیم.
   */
  const resolvedExtension = extension || INTL_UPLOAD_MIME_EXTENSIONS[mimeType];
  if (!resolvedExtension) {
    throw Object.assign(new Error('نوع فایل مجاز نیست؛ ویدیو (mp4/webm/mov) یا زیرنویس (vtt/srt) بفرستید'), {
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  }
  const resolvedMime = mimeType || INTL_UPLOAD_EXTENSION_MIME[resolvedExtension] || '';

  /* نام فایل هرگز از ورودی کاربر ساخته نمی‌شود — ضد path traversal */
  const filename = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${resolvedExtension}`;
  const target = resolve(intlUploadsDir, filename);
  ensureDir(intlUploadsDir);

  return new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(target);
    let size = 0;
    let failed = false;

    const abort = (error) => {
      if (failed) return;
      failed = true;
      output.destroy();
      try { unlinkSync(target); } catch { /* فایل نیمه‌کاره‌ای نبود */ }
      stream.destroy?.();
      rejectPromise(error);
    };

    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        abort(Object.assign(new Error(`حجم فایل بیش از ${Math.round(maxBytes / (1024 * 1024))} مگابایت است`), {
          code: 'PAYLOAD_TOO_LARGE',
        }));
      }
    });

    stream.on('error', () => abort(Object.assign(new Error('دریافت فایل ناتمام ماند'), { code: 'VALIDATION_ERROR' })));
    output.on('error', () => abort(Object.assign(new Error('نوشتن فایل ناموفق بود'), { code: 'INTERNAL_ERROR' })));

    output.on('finish', () => {
      if (failed) return;
      if (!size) {
        try { unlinkSync(target); } catch { /* چیزی نوشته نشده بود */ }
        rejectPromise(Object.assign(new Error('فایل خالی است'), { code: 'VALIDATION_ERROR' }));
        return;
      }

      /* زیرنویس srt همان‌جا به vtt تبدیل می‌شود (پخش‌کننده فقط WebVTT می‌فهمد) */
      let storedName = filename;
      let storedMime = resolvedMime;
      if (resolvedExtension === 'srt') {
        try {
          const vtt = srtToVtt(readFileSync(target, 'utf8'));
          storedName = `${filename.slice(0, -'.srt'.length)}.vtt`;
          writeFileSync(resolve(intlUploadsDir, storedName), vtt, 'utf8');
          unlinkSync(target);
          storedMime = 'text/vtt';
        } catch {
          /* تبدیل نشد — همان srt می‌ماند */
          storedName = filename;
          storedMime = resolvedMime;
        }
      }

      resolvePromise({
        filename: storedName,
        originalName: String(originalName ?? filename).replace(/[\\/]/g, '').slice(0, 160),
        mimeType: storedMime,
        size,
        url: `${INTL_UPLOADS_URL_PREFIX}/${storedName}`,
        createdAt: nowIso(),
      });
    });

    stream.pipe(output);
  });
}

/* ─────────────────────── درسنامه جامع علوم پایه ───────────────────────
 *
 * درسنامهٔ جامعِ دست‌نویس (`src/data/learning/anatomyCourse.js`) هنگام نخستین
 * اجرا به رکورد پنل تبدیل می‌شود: هر درس یک رکورد کامل — مبحث‌ها (modules)،
 * واحدهای هر مبحث (unitsByModule) و متن و تستِ هر واحد (learning). مثل مراجع
 * و میکرو، ویرایش یک PUT کامل می‌فرستد و انتشار اتمیک می‌ماند.
 */

const COMPREHENSIVE_MODULE_STATUSES = ['fresh', 'learning', 'completed', 'locked'];

const clampCount = (value, max = 100_000) => Math.min(max, Math.max(0, Math.round(Number(value) || 0)));

function comprehensiveOption(option, index) {
  return {
    id: String(option?.id ?? '').trim().slice(0, 60) || `opt-${index + 1}`,
    label: String(option?.label ?? '').slice(0, 400),
  };
}

function comprehensiveQuestion(question, index, prefix) {
  const options = (Array.isArray(question?.options) ? question.options : []).map(comprehensiveOption);
  const answer = String(question?.answer ?? '').trim();

  return {
    /* شناسهٔ سؤالِ بی‌شناسه از جایگاهش ساخته می‌شود، نه تصادفی: هر ذخیرهٔ پنل
       نباید شناسه‌ها را عوض کند، وگرنه پیشرفت کاربر روی همان سؤال گم می‌شود و
       به‌نظر می‌رسد ویرایش‌های پنل «اثر نکرده». */
    id: String(question?.id ?? '').trim().slice(0, 80) || `${prefix}-${index + 1}`,
    type: 'mcq',
    question: String(question?.question ?? '').slice(0, 1200),
    options,
    /* گزینهٔ درست باید به یکی از گزینه‌ها بخورد؛ وگرنه نخستین گزینه */
    answer: options.some((option) => option.id === answer) ? answer : (options[0]?.id ?? ''),
    explanation: String(question?.explanation ?? '').slice(0, 2000),
    ...(question?.misconception !== undefined
      ? { misconception: String(question.misconception ?? '').slice(0, 1200) } : {}),
    ...(question?.conceptId ? { conceptId: String(question.conceptId).slice(0, 80) } : {}),
    ...(question?.difficulty ? { difficulty: String(question.difficulty).slice(0, 30) } : {}),
    ...(Array.isArray(question?.tags)
      ? { tags: question.tags.slice(0, 10).map((tag) => String(tag).slice(0, 40)) } : {}),
  };
}

function comprehensiveMicroLesson(lesson, index, unitId) {
  const text = (value) => String(value ?? '').slice(0, 4000);

  return {
    id: String(lesson?.id ?? '').trim().slice(0, 80) || `${unitId}-lesson-${index + 1}`,
    title: String(lesson?.title ?? '').trim().slice(0, 200) || `میکرودرس ${index + 1}`,
    objective: text(lesson?.objective),
    simple: text(lesson?.simple),
    scientific: text(lesson?.scientific),
    highlight: text(lesson?.highlight),
    example: text(lesson?.example),
    connection: text(lesson?.connection),
    concepts: (Array.isArray(lesson?.concepts) ? lesson.concepts : [])
      .slice(0, 10).map((concept) => String(concept).slice(0, 120)),
    ...(Array.isArray(lesson?.facts)
      ? { facts: lesson.facts.slice(0, 12).map((row) => row.map((cell) => String(cell ?? '').slice(0, 200))) } : {}),
  };
}

function comprehensiveStructure(structure, index, unitId) {
  return {
    id: String(structure?.id ?? '').trim().slice(0, 60) || `${unitId}-st-${index + 1}`,
    label: String(structure?.label ?? '').trim().slice(0, 160) || `ساختار ${index + 1}`,
    x: Math.min(100, Math.max(0, Math.round(Number(structure?.x) || 0))),
    y: Math.min(100, Math.max(0, Math.round(Number(structure?.y) || 0))),
    detail: String(structure?.detail ?? '').slice(0, 600),
  };
}

/* مسیرهای مبحث واحد — همان شکل میکرو (`[['قلب','دریچه']]`) */
const comprehensiveTopicPaths = (value, max = 12) => (Array.isArray(value) ? value : [])
  .map((path) => (Array.isArray(path) ? path : String(path ?? '').split('›')))
  .map((parts) => parts.map((part) => String(part ?? '').trim().slice(0, 60)).filter(Boolean))
  .filter((parts) => parts.length)
  .slice(0, max);

/*
 * «تست‌های این بخش» هر واحد: انتخاب دستی از بانک تست (`pinnedQuestionIds`) و/یا
 * فیلتر درس و مسیر مبحث. بدون هیچ‌کدام، بخش تست واحد خالی می‌ماند و لایه روی
 * تست‌های دست‌نویس خودِ واحد برمی‌گردد.
 */
function comprehensiveTestBank(input) {
  return {
    subjectId: String(input?.subjectId ?? '').trim().slice(0, 60),
    topicPaths: comprehensiveTopicPaths(input?.topicPaths),
    pinnedQuestionIds: (Array.isArray(input?.pinnedQuestionIds) ? input.pinnedQuestionIds : [])
      .slice(0, 60)
      .map((questionId) => String(questionId ?? '').trim().slice(0, 60))
      .filter(Boolean),
  };
}

/* پاپ‌آپ تبریک واحد — عنوان، پیام و تصویر (آدرس کتابخانهٔ رسانه) */
function comprehensiveCelebration(input) {
  return {
    title: String(input?.title ?? '').slice(0, 160),
    message: String(input?.message ?? '').slice(0, 400),
    image: String(input?.image ?? '').slice(0, 600),
  };
}

function comprehensiveUnitPayload(unit, index, moduleId) {
  /* شناسهٔ پایدار از مبحث + جایگاه؛ شناسهٔ تصادفی در هر ذخیره عوض می‌شد و
     پیشرفت/تیک مراحل کاربر را روی واحد تازه می‌نشاند. */
  const id = String(unit?.id ?? '').trim().slice(0, 80) || `${moduleId}-unit-${index + 1}`;
  const learning = unit?.learning ?? {};
  const activate = learning.activate ?? {};
  const visualize = learning.visualize ?? {};

  return {
    id,
    moduleId,
    order: Number(unit?.order) || index + 1,
    title: String(unit?.title ?? '').trim().slice(0, 200) || `واحد ${index + 1}`,
    description: String(unit?.description ?? '').slice(0, 800),
    estimatedTime: clampCount(unit?.estimatedTime, 600),
    sectionCount: clampCount(unit?.sectionCount, 200),
    tests: clampCount(unit?.tests),
    objectives: (Array.isArray(unit?.objectives) ? unit.objectives : [])
      .slice(0, 12).map((item) => String(item).slice(0, 400)),
    prerequisites: (Array.isArray(unit?.prerequisites) ? unit.prerequisites : [])
      .slice(0, 12).map((item) => String(item).slice(0, 160)),
    status: COMPREHENSIVE_MODULE_STATUSES.includes(unit?.status) ? unit.status : 'fresh',
    progress: Math.min(100, Math.max(0, Math.round(Number(unit?.progress) || 0))),
    mastery: Math.min(100, Math.max(0, Math.round(Number(unit?.mastery) || 0))),
    lastActivity: String(unit?.lastActivity ?? '').slice(0, 80),
    steps: Array.isArray(unit?.steps) ? unit.steps.slice(0, 8) : ['activate', 'learn', 'visualize', 'practice', 'test'],
    testBank: comprehensiveTestBank(unit?.testBank),
    celebration: comprehensiveCelebration(unit?.celebration),
    learning: {
      activate: {
        tests: (Array.isArray(activate.tests) ? activate.tests : [])
          .map((question, questionIndex) => comprehensiveQuestion(question, questionIndex, `${id}-warmup`)),
      },
      microLessons: (Array.isArray(learning.microLessons) ? learning.microLessons : [])
        .slice(0, 12).map((lesson, lessonIndex) => comprehensiveMicroLesson(lesson, lessonIndex, id)),
      visualize: {
        title: String(visualize.title ?? '').slice(0, 200),
        instruction: String(visualize.instruction ?? '').slice(0, 600),
        structures: (Array.isArray(visualize.structures) ? visualize.structures : [])
          .slice(0, 20).map((structure, structureIndex) => comprehensiveStructure(structure, structureIndex, id)),
        layers: (Array.isArray(visualize.layers) ? visualize.layers : [])
          .slice(0, 8).map((layer, layerIndex) => ({
            id: String(layer?.id ?? '').trim().slice(0, 60) || `layer-${layerIndex + 1}`,
            label: String(layer?.label ?? '').trim().slice(0, 160) || `لایه ${layerIndex + 1}`,
          })),
      },
      practice: (Array.isArray(learning.practice) ? learning.practice : [])
        .slice(0, 20).map((question, questionIndex) => comprehensiveQuestion(question, questionIndex, `${id}-mcq`)),
      ...(learning.labelQuiz
        ? {
          labelQuiz: {
            id: String(learning.labelQuiz.id ?? '').trim().slice(0, 80) || `${id}-label-quiz`,
            prompt: String(learning.labelQuiz.prompt ?? '').slice(0, 600),
            answer: String(learning.labelQuiz.answer ?? '').slice(0, 80),
            ...(learning.labelQuiz.conceptId
              ? { conceptId: String(learning.labelQuiz.conceptId).slice(0, 80) } : {}),
            explanation: String(learning.labelQuiz.explanation ?? '').slice(0, 1200),
          },
        } : {}),
    },
  };
}

function comprehensiveModulePayload(module_, index) {
  return {
    id: String(module_?.id ?? '').trim().slice(0, 80) || makeId('cmod'),
    order: Number(module_?.order) || index + 1,
    title: String(module_?.title ?? '').trim().slice(0, 200) || `مبحث ${index + 1}`,
    description: String(module_?.description ?? '').slice(0, 800),
    unitCount: clampCount(module_?.unitCount, 200),
    tests: clampCount(module_?.tests),
    progress: Math.min(100, Math.max(0, Math.round(Number(module_?.progress) || 0))),
    status: COMPREHENSIVE_MODULE_STATUSES.includes(module_?.status) ? module_.status : 'fresh',
    lastActivity: String(module_?.lastActivity ?? '').slice(0, 80),
    ...(module_?.available ? { available: true } : {}),
    ...(module_?.locked ? { locked: true } : {}),
  };
}

function comprehensiveCoursePayload(input, existing = null) {
  const title = String(input?.title ?? '').trim().slice(0, 160);
  if (!title) throw Object.assign(new Error('عنوان درسنامه الزامی است'), { code: 'VALIDATION_ERROR' });

  const status = ARTICLE_STATUSES.includes(input?.status) ? input.status : 'draft';
  const modules = (Array.isArray(input?.modules) ? input.modules : []).map(comprehensiveModulePayload);
  const rawUnits = input?.unitsByModule && typeof input.unitsByModule === 'object' ? input.unitsByModule : {};

  const unitsByModule = {};
  for (const module_ of modules) {
    const units = (Array.isArray(rawUnits[module_.id]) ? rawUnits[module_.id] : [])
      .map((unit, index) => comprehensiveUnitPayload(unit, index, module_.id));
    unitsByModule[module_.id] = units;
    /* شمارندهٔ واحدِ مبحث همیشه از دادهٔ واقعی می‌آید، نه از عدد دستی */
    module_.unitCount = units.length;
  }

  return {
    title,
    subtitle: String(input?.subtitle ?? '').slice(0, 300),
    description: String(input?.description ?? '').slice(0, 800),
    modules,
    unitsByModule,
    status,
    origin: existing?.origin === 'tapesh' ? 'tapesh' : 'panel',
    publishedAt: status === 'published' ? (existing?.publishedAt || nowIso()) : (existing?.publishedAt ?? null),
  };
}

function seedComprehensiveCourses() {
  const created = nowIso();

  return [{
    id: anatomyCourse.id,
    title: anatomyCourse.title,
    subtitle: anatomyCourse.subtitle ?? '',
    description: anatomyCourse.description ?? '',
    modules: (anatomyCourse.modules ?? []).map((module_, index) => comprehensiveModulePayload(module_, index)),
    unitsByModule: Object.fromEntries(Object.entries(anatomyCourse.unitsByModule ?? {}).map(([moduleId, units]) => [
      moduleId,
      (units ?? []).map((unit, index) => comprehensiveUnitPayload(unit, index, moduleId)),
    ])),
    status: 'published',
    origin: 'tapesh',
    createdAt: created,
    updatedAt: created,
    createdBy: 'seed',
    updatedBy: 'seed',
    publishedAt: created,
  }];
}

export function listComprehensiveCourses({ search = '', status = 'all', page = 1, perPage = 20 } = {}) {
  const query = normalizeSearch(search);
  const filtered = readCollection('comprehensiveCourses').filter((course) => {
    if (status !== 'all' && course.status !== status) return false;
    if (!query) return true;
    return [course.title, course.subtitle].some((field) => normalizeSearch(field).includes(query));
  });

  filtered.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return paginate(filtered, { page, perPage });
}

export function getComprehensiveCourse(id) {
  return readCollection('comprehensiveCourses').find((course) => course.id === id) ?? null;
}

export function updateComprehensiveCourse(id, input, admin) {
  const courses = readCollection('comprehensiveCourses');
  const index = courses.findIndex((course) => course.id === id);
  if (index === -1) return null;

  const updated = {
    ...courses[index],
    ...comprehensiveCoursePayload(input, courses[index]),
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
  };

  courses[index] = updated;
  writeCollection('comprehensiveCourses', courses);
  return updated;
}

/*
 * قرارداد عمومی درسنامه جامع — فقط منتشرشده‌ها، با همان کلیدهایی که
 * `ContentService` لایهٔ یادگیری از آن می‌خواند (id، title، subtitle،
 * modules، unitsByModule). فرادادهٔ پنل به کاربران درز نمی‌کند.
 *
 * «تست‌های این بخش» هر واحد همین‌جا از بانک تست حل می‌شود تا لایهٔ یادگیری
 * بدون هیچ درخواست دیگری سؤال‌های همان بخش را داشته باشد: اول سؤال‌های
 * سنجاق‌شده، بعد فیلتر درس/مسیر مبحث. خروجی با شکل سؤال چهارگزینه‌ای لایه
 * یکی است (options با id).
 *
 * PHASE 2 — این مسیر هم عمومی است، پس **کلید پاسخ و تحلیل اینجا نمی‌آید**.
 * پیش‌تر فیلد کلید (id گزینهٔ درست) و متن تحلیل همراه سؤال می‌رفت؛ یعنی همان
 * نشتِ مسیر بانک تست از در دیگری. اکنون `id` همان شناسهٔ سؤال بانک است و کلاینت
 * درستی پاسخ را از `/api/users/test-bank/answers` می‌گیرد (بازگشایی کنترل‌شده).
 */
function comprehensiveBankQuestion(question) {
  const options = (Array.isArray(question?.options) ? question.options : [])
    .map((label, index) => ({ id: `opt-${index + 1}`, label: String(label ?? '').slice(0, 400) }));

  return {
    id: String(question?.id ?? ''),
    type: 'mcq',
    question: String(question?.stem ?? '').slice(0, 1200),
    options,
    ...(question?.difficulty ? { difficulty: String(question.difficulty).slice(0, 30) } : {}),
    ...(Array.isArray(question?.topicPath)
      ? { topicPath: question.topicPath.slice(0, 6).map((part) => String(part).slice(0, 80)) } : {}),
  };
}

function comprehensiveUnitQuestions(testBank, bank) {
  const pinned = testBank?.pinnedQuestionIds ?? [];
  const picked = pinned.map((questionId) => bank.find((question) => question.id === questionId)).filter(Boolean);
  if (picked.length) return picked.map(comprehensiveBankQuestion);

  const subjectId = testBank?.subjectId ?? '';
  const paths = (testBank?.topicPaths ?? []).map((path) => path.join(' › '));
  if (!subjectId && !paths.length) return [];

  return bank
    .filter((question) => (!subjectId || question.subject === subjectId)
      && (!paths.length || paths.some((path) => question.topicPath.join(' › ').includes(path))))
    .slice(0, 30)
    .map(comprehensiveBankQuestion);
}

export function publishedComprehensiveCourses() {
  const bank = publishedTestBankQuestionsInternal();

  return readCollection('comprehensiveCourses')
    .filter((course) => course.status === 'published')
    .map((course) => ({
      id: course.id,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      modules: course.modules,
      unitsByModule: Object.fromEntries(
        Object.entries(course.unitsByModule ?? {}).map(([moduleId, units]) => [
          moduleId,
          (units ?? []).map((unit) => ({
            ...unit,
            testBank: {
              subjectId: unit.testBank?.subjectId ?? '',
              topicPaths: unit.testBank?.topicPaths ?? [],
              pinnedQuestionIds: unit.testBank?.pinnedQuestionIds ?? [],
              questions: comprehensiveUnitQuestions(unit.testBank, bank),
            },
            celebration: {
              title: unit.celebration?.title ?? '',
              message: unit.celebration?.message ?? '',
              image: unit.celebration?.image ?? '',
            },
          })),
        ]),
      ),
    }));
}

/* ─────────────────────── کتابخانهٔ فلش‌کارت تپش ─────────────────────── */

/*
 * شکل داده با قرارداد فلش‌کارت سمت کاربر (mockData) یکی است:
 *   دک   { title, description, subjectId, level, cover, shortTitle, anatomy, previewImage, status, cards[] }
 *   کارت { type: basic|cloze|mcq|image-locate, front, back, hint, tags[], image{url,alt,points[]}, options[], explanation }
 * دک تصویری (`anatomy: true`) کارت‌های image-locate دارد که روی تصویر نقطه مشخص می‌کنند.
 *
 * `origin` می‌گوید دک از کجا آمده: `tapesh` = مجموعهٔ ثابتِ داخل کد که با
 * `syncFlashcardDecks()` به رکورد تبدیل شده، `panel` = ساختهٔ خودِ پنل. این فیلد
 * فقط برای نمایش/گزارش است و در قرارداد عمومی کاربران نمی‌رود.
 */

const FLASHCARD_CARD_TYPES = ['basic', 'cloze', 'mcq', 'image-locate'];

/*
 * فیلدهای کارت‌های ثابت که ویرایشگر پنل نمایش نمی‌دهد (منبع کارت و زبان).
 *
 * `flashcardCardPayload` فقط فیلدهای فرم را می‌نویسد؛ اگر این‌ها را همراه نبرد،
 * نخستین ویرایشِ یک کارتِ ثابت در پنل، «منبع» کارت را بی‌صدا پاک می‌کرد و
 * چیپ منبع در رابط کاربران ناپدید می‌شد.
 */
function carriedCardFields(input) {
  const carried = {};
  const source = input?.source;

  if (source && typeof source === 'object') {
    carried.source = {
      sourceType: String(source.sourceType ?? '').slice(0, 20),
      sourceId: String(source.sourceId ?? '').slice(0, 60),
      title: String(source.title ?? '').slice(0, 160),
      url: source.url ? String(source.url).slice(0, 300) : null,
    };
  }

  if (input?.language) carried.language = String(input.language).slice(0, 8);

  return carried;
}

function sanitizeCardPoints(points) {
  if (!Array.isArray(points)) return [];
  return points
    .map((point) => ({
      x: Math.min(100, Math.max(0, Number(point?.x) || 0)),
      y: Math.min(100, Math.max(0, Number(point?.y) || 0)),
    }))
    .slice(0, 4);
}

function flashcardCardPayload(input) {
  const type = FLASHCARD_CARD_TYPES.includes(input?.type) ? input.type : 'basic';
  const front = String(input?.front ?? '').trim().slice(0, 2000);
  const back = String(input?.back ?? '').trim().slice(0, 4000);

  const card = {
    id: input?.id ? String(input.id).slice(0, 40) : makeId('fcc'),
    type,
    front,
    back,
    hint: String(input?.hint ?? '').slice(0, 300),
    tags: Array.isArray(input?.tags)
      ? input.tags.map((tag) => String(tag).trim().slice(0, 40)).filter(Boolean).slice(0, 12)
      : [],
    subjectId: String(input?.subjectId ?? 'general').slice(0, 40),
    topicId: String(input?.topicId ?? '').slice(0, 60),
    explanation: String(input?.explanation ?? '').slice(0, 2000),
    status: 'active',
    ...carriedCardFields(input),
  };

  if (type === 'image-locate') {
    card.image = {
      url: String(input?.image?.url ?? '').slice(0, 300),
      alt: String(input?.image?.alt ?? '').slice(0, 200),
      points: sanitizeCardPoints(input?.image?.points),
    };
  }

  if (type === 'mcq') {
    card.options = (Array.isArray(input?.options) ? input.options : [])
      .map((option) => ({ text: String(option?.text ?? '').slice(0, 400), correct: Boolean(option?.correct) }))
      .filter((option) => option.text)
      .slice(0, 6);
  }

  return card;
}

function flashcardDeckPayload(input, existing = null) {
  const title = String(input?.title ?? '').trim();
  if (!title) throw Object.assign(new Error('عنوان مجموعه الزامی است'), { code: 'VALIDATION_ERROR' });

  const cards = (Array.isArray(input?.cards) ? input.cards : (existing?.cards ?? []))
    .map(flashcardCardPayload)
    .filter((card) => card.front || card.type === 'mcq');

  return {
    title,
    description: String(input?.description ?? '').slice(0, 500),
    shortTitle: String(input?.shortTitle ?? '').slice(0, 60),
    subjectId: String(input?.subjectId ?? 'general').slice(0, 40),
    level: String(input?.level ?? '').slice(0, 60),
    cover: /^#[0-9a-fA-F]{3,8}$/.test(String(input?.cover ?? '')) ? String(input.cover) : '#937fcd',
    anatomy: Boolean(input?.anatomy),
    previewImage: String(input?.previewImage ?? '').slice(0, 300),
    status: ARTICLE_STATUSES.includes(input?.status) ? input.status : 'draft',
    /* منبع دک فقط از رکورد قبلی ارث می‌رسد؛ از بدنهٔ درخواست خوانده نمی‌شود */
    origin: existing?.origin === 'tapesh' ? 'tapesh' : 'panel',
    cards,
  };
}

export function listFlashcardDecks({ search = '', status = 'all', kind = 'all', page = 1, perPage = 10 } = {}) {
  const query = normalizeSearch(search);
  const filtered = readCollection('flashcardDecks').filter((deck) => {
    if (status !== 'all' && deck.status !== status) return false;
    if (kind === 'anatomy' && !deck.anatomy) return false;
    if (kind === 'normal' && deck.anatomy) return false;
    if (!query) return true;
    return [deck.title, deck.description].some((field) => normalizeSearch(field).includes(query));
  });

  filtered.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  return paginate(filtered, { page, perPage });
}

export function getFlashcardDeck(id) {
  return readCollection('flashcardDecks').find((deck) => deck.id === id) ?? null;
}

export function createFlashcardDeck(input, admin) {
  const decks = readCollection('flashcardDecks');
  const created = nowIso();

  const deck = {
    id: makeId('fcd'),
    ...flashcardDeckPayload(input),
    createdAt: created,
    updatedAt: created,
    createdBy: admin?.id ?? 'system',
    updatedBy: admin?.id ?? 'system',
  };

  decks.unshift(deck);
  writeCollection('flashcardDecks', decks);
  return deck;
}

export function updateFlashcardDeck(id, input, admin) {
  const decks = readCollection('flashcardDecks');
  const index = decks.findIndex((deck) => deck.id === id);
  if (index === -1) return null;

  const updated = {
    ...decks[index],
    ...flashcardDeckPayload(input, decks[index]),
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
  };

  decks[index] = updated;
  writeCollection('flashcardDecks', decks);
  return updated;
}

export function deleteFlashcardDeck(id) {
  const decks = readCollection('flashcardDecks');
  const target = decks.find((deck) => deck.id === id);
  if (!target) return null;

  writeCollection('flashcardDecks', decks.filter((deck) => deck.id !== id));
  return target;
}

/*
 * کتابخانهٔ عمومی — دک‌های منتشرشده به شکل قرارداد فلش‌کارت سمت کاربر
 * (type: 'tapesh' / byTapesh: true) تا بدون تبدیل در سرویس مصرف شوند.
 */
export function publishedFlashcardDecks() {
  return readCollection('flashcardDecks')
    .filter((deck) => deck.status === 'published')
    .map((deck) => ({
      id: deck.id,
      userId: null,
      title: deck.title,
      shortTitle: deck.shortTitle || undefined,
      description: deck.description,
      type: 'tapesh',
      visibility: 'public',
      subjectId: deck.subjectId,
      level: deck.level || undefined,
      cover: deck.cover,
      byTapesh: true,
      anatomy: Boolean(deck.anatomy),
      previewImage: deck.previewImage || undefined,
      cardCount: deck.cards.length,
      updatedAt: deck.updatedAt,
      cards: deck.cards.map((card) => ({ ...card, deckId: deck.id })),
    }));
}

function seedFlashcardDecks() {
  const created = nowIso();
  const base = {
    status: 'published', origin: 'panel', createdAt: created, updatedAt: created,
    createdBy: 'seed', updatedBy: 'seed',
  };

  return [
    {
      ...base,
      id: 'fcd-visual-heart',
      title: 'آناتومی تصویری — قلب (پنل)',
      shortTitle: 'قلب',
      description: 'نمونهٔ مجموعهٔ تصویری ساخته‌شده از پنل مدیریت؛ ساختارهای قلب روی تصویر.',
      subjectId: 'anatomy',
      level: 'علوم پایه',
      cover: '#e26d6d',
      anatomy: true,
      previewImage: '/anatomy/heart.svg',
      cards: [
        {
          id: 'fcc-vh-1', type: 'image-locate',
          front: 'ساختار مشخص‌شده با نقطهٔ سرخ روی تصویر قلب کدام است؟',
          back: 'دهلیز راست — گیرندهٔ خون وریدی اجوف فوقانی و تحتانی.',
          image: { url: '/anatomy/heart.svg', alt: 'نمای قدامی قلب', points: [{ x: 33, y: 39 }] },
          tags: ['آناتومی', 'تصویری'], subjectId: 'anatomy', status: 'active',
        },
        {
          id: 'fcc-vh-2', type: 'image-locate',
          front: 'ساختار مشخص‌شده با نقطهٔ سرخ روی تصویر قلب کدام است؟',
          back: 'بطن چپ — پمپ اصلی گردش سیستمیک با جدارهٔ ضخیم‌تر.',
          image: { url: '/anatomy/heart.svg', alt: 'نمای قدامی قلب', points: [{ x: 65, y: 66 }] },
          tags: ['آناتومی', 'تصویری'], subjectId: 'anatomy', status: 'active',
        },
      ],
    },
    {
      ...base,
      id: 'fcd-normal-physio',
      title: 'فیزیولوژی تنفس (پنل)',
      description: 'نمونهٔ مجموعهٔ متنی ساخته‌شده از پنل مدیریت؛ مبانی تنفس و مکانیک آن.',
      subjectId: 'physiology',
      level: 'علوم پایه',
      cover: '#5b8cc7',
      anatomy: false,
      previewImage: '',
      cards: [
        {
          id: 'fcc-np-1', type: 'basic',
          front: 'عضلهٔ اصلی دم آرام چیست و عصب آن کدام است؟',
          back: 'دیافراگم — عصب فرنیک (C3-C5).',
          tags: ['فیزیولوژی', 'تنفس'], subjectId: 'physiology', status: 'active',
        },
        {
          id: 'fcc-np-2', type: 'cloze',
          front: 'سرفیس‌اکتیو توسط سلول‌های {{c1::نوع دوم آلوئولی}} ترشح می‌شود و {{c2::کشش سطحی}} را کاهش می‌دهد.',
          back: 'کاهش کشش سطحی از اتلاپسی آلوئول‌ها جلوگیری می‌کند (نقش سورفکتانت).',
          tags: ['تنفس', 'سورفکتانت'], subjectId: 'physiology', status: 'active',
        },
      ],
    },
  ];
}

/*
 * ── مجموعه‌های ثابت تپش → رکورد پنل (همگام‌سازی افزایشی) ──
 *
 * ده مجموعهٔ رسمی تپش در `src/services/flashcards/mockData.js` داخل کد زندگی
 * می‌کنند و کتابخانهٔ کاربران از همان‌جا می‌خواند. تا وقتی رکوردی در پنل نداشتند،
 * در فهرست پنل دیده نمی‌شدند و کارت‌هایشان هم ویرایش‌پذیر نبود — یعنی «همهٔ
 * مجموعه‌های کتابخانهٔ تپش» در پنل نبود.
 *
 * `syncFlashcardDecks()` هر مجموعهٔ ثابتِ بدون رکورد را به‌صورت رکورد کامل و
 * `status: published` (چون همین حالا در کتابخانهٔ کاربران زنده است) اضافه می‌کند و
 * **هیچ رکورد موجودی را بازنویسی نمی‌کند** ⇒ ویرایش‌های ادمین و وضعیت انتشارش
 * محفوظ می‌ماند. تنها استثنا یک backfill تک‌فیلدی است: رکوردهای قدیمی‌ترِ بدون
 * `origin` فقط همان فیلد را می‌گیرند. دو محافظ، دقیقاً مثل `syncMicroCourses`:
 *   • `flashcardSynced` — یک‌بار در عمر هر پروسه (`ensureStore` روی هر read/write
 *     صدا زده می‌شود و این تابع نباید هر بار فایل را باز کند).
 *   • `writeJson` مستقیم، نه `writeCollection` — وگرنه از داخل `ensureStore` به
 *     `ensureStore` برمی‌گردیم و حلقهٔ بی‌پایان می‌شود.
 *
 * کارت‌ها همان `id` ثابت را نگه می‌دارند تا وضعیت مرور کاربر (که به `cardId`
 * گره خورده) با ساخته‌شدن رکورد از صفر شروع نشود.
 *
 * ⚠️ پیامد شناخته‌شده: حذف یک مجموعهٔ `origin: 'tapesh'` از پنل، در شروع بعدی
 * سرور دوباره ساخته می‌شود (همان رفتار میکرو درسنامه). برای «برداشتن از کتابخانهٔ
 * کاربران» وضعیت «بایگانی» را بگذار، نه حذف.
 */
let flashcardSynced = false;

function flashcardRecordFromFixed(deck, created) {
  return {
    id: deck.id,
    title: deck.title,
    description: deck.description ?? '',
    shortTitle: deck.shortTitle ?? '',
    subjectId: deck.subjectId ?? 'general',
    level: deck.level ?? '',
    cover: /^#[0-9a-fA-F]{3,8}$/.test(String(deck.cover ?? '')) ? deck.cover : '#937fcd',
    anatomy: Boolean(deck.anatomy),
    previewImage: deck.previewImage ?? '',
    status: 'published',
    origin: 'tapesh',
    cards: TAPESH_CARDS.filter((card) => card.deckId === deck.id).map(flashcardCardPayload),
    createdAt: created,
    updatedAt: deck.updatedAt ?? created,
    createdBy: 'seed',
    updatedBy: 'seed',
  };
}

function syncFlashcardDecks() {
  if (flashcardSynced) return;
  flashcardSynced = true;

  const stored = readJson(files.flashcardDecks, []);
  if (!Array.isArray(stored)) return;

  const known = new Set(stored.map((deck) => deck.id));
  const created = nowIso();
  const missing = TAPESH_DECKS
    .filter((deck) => deck?.id && !known.has(deck.id))
    .map((deck) => flashcardRecordFromFixed(deck, created));

  /* رکوردهای قدیمی‌ترِ بدون `origin` (دو نمونهٔ seed) فقط همین یک فیلد را می‌گیرند */
  let changed = false;
  const backfilled = stored.map((deck) => {
    if (deck.origin) return deck;
    changed = true;
    return { ...deck, origin: 'panel' };
  });

  if (!missing.length && !changed) return;
  /* ته فایل اضافه می‌شوند تا ترتیب کتابخانهٔ کاربران (که همان ترتیب فایل است) عوض نشود */
  writeJson(files.flashcardDecks, [...backfilled, ...missing]);
}

/* ──────────────────────────── میکرو درسنامه ──────────────────────────── */

/*
 * میکرو درسنامه — همان قرارداد دادهٔ `src/data/micro/physiologyCourse.js`، فقط
 * حالا ویرایش‌پذیر از پنل.
 *
 * سلسله‌مراتب: درسنامه → مبحث (کارت درس) → واحد یادگیری → صفحه (بلوک‌ها + مفاهیم)
 *              → ایستگاه تست (checkpoint)
 *
 * چرا کل درسنامه در یک رکورد می‌ماند؟ چون انتشار اتمیک است: کاربر یا نسخهٔ کامل
 * یک درسنامه را می‌بیند یا هیچ. اگر مبحث‌ها رکورد جدا بودند، نصفه‌منتشرشده‌شدن
 * ممکن می‌شد و خوانندهٔ میکرو (که کل course را یک‌جا می‌خواند) ناسازگار می‌شد.
 *
 * «ایستگاه تست» دو راه تغذیه دارد و هر دو در همین رکورد نگه داشته می‌شوند:
 *   ۱) انتخاب از بانک تست → `pinnedQuestionIds` + فیلتر `unit.testBank`
 *   ۲) بارگذاری تست دستی  → `questions[]` روی خود checkpoint
 * اگر `questions[]` پر باشد، موتور تست همان‌ها را بر فیلتر بانک ترجیح می‌دهد.
 */

const MICRO_STATUSES = ['draft', 'published', 'archived'];
const MICRO_DIFFICULTIES = ['easy', 'medium', 'hard', 'very_hard'];

/* انواع بلوک محتوای یک صفحه — عیناً همان قرارداد موتور خواننده */
const MICRO_BLOCK_TYPES = [
  'heading', 'intro', 'text', 'keyPoint', 'definition', 'example', 'comparison',
  'table', 'warning', 'clinical', 'crossCourse', 'figure', 'flashcards',
  'quickQuestion', 'summary',
];

const MICRO_ANSWER_KEYS = ['0', '1', '2', '3'];

const microText = (value, max) => String(value ?? '').trim().slice(0, max);

const microList = (value, max, itemMax) => (Array.isArray(value) ? value : [])
  .map((item) => microText(item, itemMax))
  .filter(Boolean)
  .slice(0, max);

const microInt = (value, fallback, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
};

const microHex = (value, fallback) => (
  /^#[0-9a-fA-F]{3,8}$/.test(String(value ?? '')) ? String(value) : fallback
);

/* شناسهٔ امن: فقط حروف/عدد/خط تیره — چون شناسه در URL و در گره‌های شبکهٔ دانش می‌رود */
const microId = (value, fallback) => {
  const clean = String(value ?? '').trim().replace(/[^\w-]/g, '-').replace(/-+/g, '-').slice(0, 60);
  return clean || fallback;
};

/* «مسیر مبحث» در بانک تست آرایه‌ای است؛ در فرم با «›» نوشته می‌شود */
const microTopicPath = (value) => (Array.isArray(value) ? value : String(value ?? '').split('›'))
  .map((part) => microText(part, 60))
  .filter(Boolean)
  .slice(0, 4);

const microTopicPaths = (value, max = 12) => (Array.isArray(value) ? value : [])
  .map(microTopicPath)
  .filter((path) => path.length > 0)
  .slice(0, max);

/* سقف متن غنی یک صفحه — یک صفحهٔ درسنامه هرگز نباید به اندازهٔ یک کتاب شود */
const MICRO_CONTENT_MAX = 60000;

/*
 * متن غنی صفحه. ورودی از ویرایشگر متن می‌آید، پس همان پاک‌ساز مشترک پروژه
 * (`database/sanitizeHtml.js`) رویش اجرا می‌شود — نه فقط در کلاینت.
 * اگر از سقف رد شد، در مرز آخرین تگ بریده می‌شود تا HTML نیمه‌کاره ذخیره نشود.
 */
const microHtml = (value) => {
  const clean = sanitizeHtml(String(value ?? ''));
  if (clean.length <= MICRO_CONTENT_MAX) return clean;
  const cut = clean.slice(0, MICRO_CONTENT_MAX);
  return cut.slice(0, cut.lastIndexOf('>') + 1);
};

function microBlockPayload(input) {
  const type = MICRO_BLOCK_TYPES.includes(input?.type) ? input.type : 'text';
  const block = { type };

  if (type === 'table') {
    block.title = microText(input?.title, 160);
    block.head = microList(input?.head, 6, 60);
    block.rows = (Array.isArray(input?.rows) ? input.rows : [])
      .map((row) => microList(row, 6, 120))
      .filter((row) => row.length)
      .slice(0, 20);
    return block;
  }

  if (type === 'comparison') {
    block.title = microText(input?.title, 160);
    block.left = {
      label: microText(input?.left?.label, 80),
      items: microList(input?.left?.items, 8, 200),
    };
    block.right = {
      label: microText(input?.right?.label, 80),
      items: microList(input?.right?.items, 8, 200),
    };
    return block;
  }

  if (type === 'figure') {
    block.title = microText(input?.title, 160);
    block.caption = microText(input?.caption, 300);
    block.diagram = microId(input?.diagram, 'pressure-timeline');
    return block;
  }

  if (type === 'flashcards') {
    block.title = microText(input?.title, 160);
    block.cards = (Array.isArray(input?.cards) ? input.cards : [])
      .map((card) => ({ front: microText(card?.front, 300), back: microText(card?.back, 600) }))
      .filter((card) => card.front || card.back)
      .slice(0, 20);
    return block;
  }

  if (type === 'quickQuestion') {
    block.question = microText(input?.question, 400);
    block.answer = microText(input?.answer, 1200);
    return block;
  }

  if (type === 'summary' || type === 'crossCourse') {
    if (type === 'crossCourse') block.title = microText(input?.title, 160);
    block.items = microList(input?.items, 12, 300);
    return block;
  }

  if (type === 'definition') {
    block.term = microText(input?.term, 120);
    block.english = microText(input?.english, 160);
    block.text = microText(input?.text, 3000);
    return block;
  }

  if (type === 'example' || type === 'clinical') {
    block.title = microText(input?.title, 160);
    block.text = microText(input?.text, 3000);
    return block;
  }

  /* heading | intro | text | keyPoint | warning — همه فقط متن دارند */
  block.text = microText(input?.text, 6000);
  if (type === 'text' && input?.depth === 'extended') block.depth = 'extended';
  return block;
}

/* سؤال دستیِ ایستگاه تست — همان شکل رکورد بانک تست، بدون آمار جامعه */
function microQuestionPayload(input, fallbackId) {
  const options = microList(input?.options, 6, 400);
  const stem = microText(input?.stem, 2000);
  if (!stem || options.length < 2) return null;

  const correctAnswer = String(microInt(input?.correctAnswer, 0, 0, options.length - 1));

  return {
    id: microId(input?.id, fallbackId),
    stem,
    options,
    correctAnswer: MICRO_ANSWER_KEYS.includes(correctAnswer) ? Number(correctAnswer) : 0,
    difficulty: MICRO_DIFFICULTIES.includes(input?.difficulty) ? input.difficulty : 'medium',
    topicPath: microTopicPath(input?.topicPath),
    conceptIds: microList(input?.conceptIds, 8, 60),
    tags: microList(input?.tags, 6, 40),
    explanation: microText(input?.explanation, 2000),
    source: 'manual',
  };
}

function microCheckpointPayload(input, index) {
  const questions = (Array.isArray(input?.questions) ? input.questions : [])
    .map((question, questionIndex) => microQuestionPayload(question, `q${index + 1}-${questionIndex + 1}`))
    .filter(Boolean)
    .slice(0, 30);

  return {
    id: microId(input?.id, `cp${index + 1}`),
    afterPage: microId(input?.afterPage, ''),
    questionCount: microInt(input?.questionCount, 3, 1, 20),
    required: Boolean(input?.required),
    scopePages: microList(input?.scopePages, 40, 60),
    /* انتخاب از بانک تست: یا شناسهٔ سؤال‌های سنجاق‌شده، یا فقط فیلتر واحد */
    pinnedQuestionIds: microList(input?.pinnedQuestionIds, 60, 60),
    questions,
  };
}

function microPagePayload(input, index) {
  const blocks = (Array.isArray(input?.blocks) ? input.blocks : []).map(microBlockPayload).slice(0, 40);

  /*
   * متن غنی صفحه، منبع اصلی نمایش است. اگر ادمین متنی ننوشته باشد، یک‌بار از
   * بلوک‌های قدیمی مشتق می‌شود تا صفحه‌های موجود در ویرایشگر متنی خالی به چشم نیایند.
   * بلوک‌ها دست‌نخورده می‌مانند (آرشیو) و متن نوشته‌شدهٔ ادمین همیشه بر مشتق‌شده
   * اولویت دارد؛ پس ذخیرهٔ بعدی، ویرایش ادمین را بازنویسی نمی‌کند.
   */
  const content = microHtml(input?.content) || blocksToHtml(blocks);

  return {
    id: microId(input?.id, `p${index + 1}`),
    order: microInt(input?.order, index + 1, 1, 999),
    title: microText(input?.title, 200),
    learningObjective: microText(input?.learningObjective, 1200),
    estimatedTime: microInt(input?.estimatedTime, 4, 1, 180),
    difficulty: MICRO_DIFFICULTIES.includes(input?.difficulty) ? input.difficulty : 'medium',
    importance: microInt(input?.importance, 3, 1, 5),
    examFrequency: ['low', 'medium', 'high'].includes(input?.examFrequency) ? input.examFrequency : 'medium',
    keywords: microList(input?.keywords, 12, 40),
    concepts: microList(input?.concepts, 20, 60),
    content,
    blocks,
  };
}

function microConceptPayload(input, index) {
  return {
    id: microId(input?.id, `concept-${index + 1}`),
    title: microText(input?.title, 160),
    english: microText(input?.english, 160),
    importance: microInt(input?.importance, 3, 1, 5),
    examFrequency: ['low', 'medium', 'high'].includes(input?.examFrequency) ? input.examFrequency : 'medium',
    crossCourse: (Array.isArray(input?.crossCourse) ? input.crossCourse : [])
      .map((item) => ({
        courseId: microId(item?.courseId, ''),
        courseTitle: microText(item?.courseTitle, 120),
        topic: microText(item?.topic, 160),
      }))
      .filter((item) => item.courseTitle)
      .slice(0, 8),
  };
}

function microUnitPayload(input, index) {
  const pages = (Array.isArray(input?.pages) ? input.pages : [])
    .map(microPagePayload)
    .slice(0, 60)
    .sort((a, b) => a.order - b.order)
    .map((page, pageIndex) => ({ ...page, order: pageIndex + 1 }));

  const checkpoints = (Array.isArray(input?.checkpoints) ? input.checkpoints : [])
    .map(microCheckpointPayload)
    .slice(0, 30);

  return {
    id: microId(input?.id, `unit-${index + 1}`),
    title: microText(input?.title, 200),
    learningObjective: microText(input?.learningObjective, 1500),
    estimatedTime: microInt(input?.estimatedTime, 30, 1, 600),
    difficulty: MICRO_DIFFICULTIES.includes(input?.difficulty) ? input.difficulty : 'medium',
    checkpointInterval: microInt(input?.checkpointInterval, 4, 1, 30),
    testBank: {
      subjectId: microId(input?.testBank?.subjectId, ''),
      topicPaths: microTopicPaths(input?.testBank?.topicPaths),
      relatedTopicPaths: microTopicPaths(input?.testBank?.relatedTopicPaths),
    },
    finalAssessment: { questionCount: microInt(input?.finalAssessment?.questionCount, 10, 1, 60) },
    concepts: (Array.isArray(input?.concepts) ? input.concepts : []).map(microConceptPayload).slice(0, 40),
    pages,
    checkpoints,
  };
}

function microTopicPayload(input, index) {
  return {
    id: microId(input?.id, `topic-${index + 1}`),
    title: microText(input?.title, 200),
    description: microText(input?.description, 500),
    accent: microHex(input?.accent, '#ab8e7c'),
    published: Boolean(input?.published),
    units: (Array.isArray(input?.units) ? input.units : []).map(microUnitPayload).slice(0, 20),
  };
}

function microCoursePayload(input, existing = null) {
  const title = microText(input?.title, 160);
  if (!title) throw Object.assign(new Error('عنوان درسنامه الزامی است'), { code: 'VALIDATION_ERROR' });

  const topics = (Array.isArray(input?.topics) ? input.topics : (existing?.topics ?? []))
    .map(microTopicPayload)
    .filter((topic) => topic.title)
    .slice(0, 40);

  return {
    subjectId: microId(input?.subjectId, 'general'),
    title,
    englishTitle: microText(input?.englishTitle, 160),
    kicker: microText(input?.kicker, 160),
    description: microText(input?.description, 1000),
    accent: microHex(input?.accent, '#ab8e7c'),
    estimatedTime: microInt(input?.estimatedTime, 40, 1, 2000),
    difficulty: MICRO_DIFFICULTIES.includes(input?.difficulty) ? input.difficulty : 'medium',
    checkpointInterval: microInt(input?.checkpointInterval, 4, 1, 30),
    status: MICRO_STATUSES.includes(input?.status) ? input.status : 'draft',
    topics,
  };
}

/* شمارنده‌های یک درسنامه — هم برای فهرست پنل، هم برای نوار آمار داخل لایه */
export function microCourseCounts(course) {
  const topics = course?.topics ?? [];
  const units = topics.flatMap((topic) => topic.units ?? []);
  const pages = units.flatMap((unit) => unit.pages ?? []);
  const checkpoints = units.flatMap((unit) => unit.checkpoints ?? []);
  return {
    topics: topics.length,
    publishedTopics: topics.filter((topic) => topic.published).length,
    units: units.length,
    pages: pages.length,
    blocks: pages.reduce((total, page) => total + (page.blocks?.length ?? 0), 0),
    /* صفحه‌هایی که متن غنی دارند — از زمان مهاجرت به ویرایشگر متنی، معیار «صفحهٔ پرشده» */
    richPages: pages.filter((page) => htmlToText(page.content).length > 0).length,
    checkpoints: checkpoints.length,
    manualQuestions: checkpoints.reduce((total, checkpoint) => total + (checkpoint.questions?.length ?? 0), 0),
    pinnedQuestions: checkpoints.reduce((total, checkpoint) => total + (checkpoint.pinnedQuestionIds?.length ?? 0), 0),
    concepts: units.reduce((total, unit) => total + (unit.concepts?.length ?? 0), 0),
  };
}

export function listMicroCourses({ search = '', status = 'all', page = 1, perPage = 20 } = {}) {
  const query = normalizeSearch(search);
  const filtered = readCollection('microCourses').filter((course) => {
    if (status !== 'all' && course.status !== status) return false;
    if (!query) return true;
    return [course.title, course.englishTitle, course.description]
      .some((field) => normalizeSearch(field).includes(query));
  });

  filtered.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  const result = paginate(filtered, { page, perPage });

  return {
    ...result,
    items: result.items.map((course) => ({
      id: course.id,
      subjectId: course.subjectId,
      title: course.title,
      englishTitle: course.englishTitle,
      description: course.description,
      accent: course.accent,
      status: course.status,
      counts: microCourseCounts(course),
      publishedAt: course.publishedAt ?? null,
      updatedAt: course.updatedAt,
    })),
  };
}

export function getMicroCourse(id) {
  return readCollection('microCourses').find((course) => course.id === id) ?? null;
}

/*
 * فهرست درس‌های رجیستری برای فرم «درسنامهٔ تازه» در پنل.
 * از سرور می‌آید (نه import مستقیم در پنل) تا باندل پنل ۱۶ فایل درس را با خودش نکشد.
 */
export function microSubjectCatalog() {
  return MICRO_SUBJECT_OPTIONS.map((subject) => ({ ...subject }));
}

export function createMicroCourse(input, admin) {
  const courses = readCollection('microCourses');
  const created = nowIso();

  /*
   * اگر درس از رجیستری انتخاب شده باشد و ادمین مبحثی نفرستاده باشد، ساختار همان درس
   * کپی می‌شود تا «درسنامهٔ تازه» از یک الگوی واقعی شروع شود، نه از یک صفحهٔ خالی.
   * این همان چیزی است که کاربر خواست: الگو و الگوریتم فیزیولوژی برای بقیهٔ درس‌ها هم باشد.
   */
  const subjectId = String(input?.subjectId ?? '').trim();
  const source = MICRO_COURSE_SOURCES.find((entry) => entry.courseId === subjectId)?.course ?? null;
  const payload = source && !(input?.topics ?? []).length
    ? { ...source, ...input, topics: source.topics }
    : input;

  const course = {
    id: makeId('mcr'),
    ...microCoursePayload(payload),
    publishedAt: null,
    createdAt: created,
    updatedAt: created,
    createdBy: admin?.id ?? 'system',
    updatedBy: admin?.id ?? 'system',
  };

  courses.unshift(course);
  writeCollection('microCourses', courses);
  return course;
}

export function updateMicroCourse(id, input, admin) {
  const courses = readCollection('microCourses');
  const index = courses.findIndex((course) => course.id === id);
  if (index === -1) return null;

  const updated = {
    ...courses[index],
    ...microCoursePayload(input, courses[index]),
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
  };

  courses[index] = updated;
  writeCollection('microCourses', courses);
  return updated;
}

/*
 * انتشار/لغو انتشار. «انتشار» یعنی همین درسنامه از مسیر عمومی
 * `/api/public/micro/library` به همهٔ کاربران تپش تحویل داده می‌شود؛ «لغو» یعنی
 * از همان مسیر برداشته می‌شود ولی رکورد و محتوا دست‌نخورده می‌ماند.
 */
export function setMicroCourseStatus(id, status, admin) {
  if (!MICRO_STATUSES.includes(status)) {
    throw Object.assign(new Error('وضعیت نامعتبر'), { code: 'VALIDATION_ERROR' });
  }

  const courses = readCollection('microCourses');
  const index = courses.findIndex((course) => course.id === id);
  if (index === -1) return null;

  courses[index] = {
    ...courses[index],
    status,
    publishedAt: status === 'published' ? nowIso() : null,
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
  };

  writeCollection('microCourses', courses);
  return courses[index];
}

export function deleteMicroCourse(id) {
  const courses = readCollection('microCourses');
  const target = courses.find((course) => course.id === id);
  if (!target) return null;

  writeCollection('microCourses', courses.filter((course) => course.id !== id));
  return target;
}

/*
 * تحویل عمومی — فقط درسنامه‌های منتشرشده و فقط با شکل قرارداد موتور میکرو
 * (همان فیلدهایی که `src/data/micro/physiologyCourse.js` دارد). فرادادهٔ مدیریتی
 * (status، createdBy، …) بیرون می‌ماند تا کلاینت کاربر چیزی از پنل نبیند.
 */
export function publishedMicroCourses() {
  return readCollection('microCourses')
    .filter((course) => course.status === 'published')
    .map((course) => ({
      id: course.id,
      subjectId: course.subjectId,
      title: course.title,
      englishTitle: course.englishTitle,
      kicker: course.kicker,
      description: course.description,
      accent: course.accent,
      estimatedTime: course.estimatedTime,
      difficulty: course.difficulty,
      checkpointInterval: course.checkpointInterval,
      source: 'tapesh',
      updatedAt: course.updatedAt,
      publishedAt: course.publishedAt,
      topics: course.topics,
    }));
}

/*
 * «انتخاب از بانک تست» — جست‌وجو روی بانک تست علوم پایه تپش.
 * این تابع تنها نقطهٔ خواندن بانک از سمت سرور است؛ وقتی بانک به Backend منتقل
 * شود، فقط بدنهٔ همین تابع به کوئری تبدیل می‌شود.
 */
const TEST_BANK_STATUSES = ['draft', 'published', 'archived'];

/*
 * ── مرز سریال‌سازی سؤال (PHASE 2) — «سؤال عمومی ≠ سؤال درونی» ──
 *
 * پیش از این یک تابع (`publicTestBankQuestion`) هم پنل مدیریت و هم endpoint عمومی
 * را تغذیه می‌کرد و کل رکورد را spread می‌کرد؛ نتیجه: `GET /api/public/test-bank/questions`
 * تمام بانک منتشرشده را **با کلید پاسخ و تحلیل** تحویل می‌داد.
 *
 * اکنون سه شکل صریح وجود دارد و هیچ‌کدام جای دیگری را نمی‌گیرد:
 *
 *   • `testBankQuestionForAdmin`      — رکورد کامل، فقط برای مسیرهای ادمین (فرم ویرایش
 *                                        به `correctAnswer` نیاز دارد).
 *   • `publicTestBankQuestion`        — **فهرست سفید**. هرچه در فهرست نیست بیرون نمی‌رود،
 *                                        پس افزودن فیلد تازه به رکورد خودکار عمومی نمی‌شود.
 *   • `testBankQuestionInternal`      — کلید پاسخ، فقط برای تصحیح سمت سرور.
 *
 * سه فیلدی که پیش‌تر از مسیر عمومی نشت می‌کردند:
 *   correctAnswer          → کلید پاسخ
 *   explanation            → تحلیل؛ متنش («گزینهٔ B صحیح است زیرا…») خودش کلید را لو می‌دهد
 *   stats.optionPercents   → توزیع گزینه‌ها؛ گزینهٔ پرتکرار عملاً کلید است
 */
const PUBLIC_TEST_BANK_FIELDS = [
  'id', 'subject', 'track', 'source', 'type', 'difficulty', 'year', 'examMonth',
  'topicPath', 'tags', 'conceptIds', 'stem', 'figure', 'options', 'createdAt', 'updatedAt',
];

/* آمار عمومی = محبوبیت + سختی. بدون توزیع گزینه‌ها و شاخص کلید. */
function publicTestBankStats(stats) {
  if (!stats || typeof stats !== 'object') return { solves: 0, correctPercent: 0, avgTimeSec: 0 };
  return {
    solves: Number(stats.solves) || 0,
    correctPercent: Number(stats.correctPercent) || 0,
    avgTimeSec: Number(stats.avgTimeSec) || 0,
  };
}

export function publicTestBankQuestion(question) {
  if (!question) return null;
  const shaped = {};
  for (const field of PUBLIC_TEST_BANK_FIELDS) {
    if (question[field] !== undefined) shaped[field] = question[field];
  }
  shaped.source = question.source === 'comprehensive' ? 'official' : question.source;
  shaped.difficulty = question.stats?.solves > 0
    ? difficultyFromPercent(question.stats.correctPercent)
    : question.difficulty;
  shaped.stats = publicTestBankStats(question.stats);
  return shaped;
}

/* شکل پنل مدیریت — همان رکورد کامل (فرم ویرایش کلید پاسخ را لازم دارد) */
function testBankQuestionForAdmin({ examDay, ...question }) {
  return {
    ...question,
    source: question.source === 'comprehensive' ? 'official' : question.source,
    difficulty: question.stats?.solves > 0 ? difficultyFromPercent(question.stats.correctPercent) : question.difficulty,
  };
}

/* فقط سرور — برای تصحیح. هرگز serialize به کلاینت نمی‌شود. */
function testBankQuestionInternal(question) {
  return testBankQuestionForAdmin(question);
}

export function publishedTestBankQuestions() {
  return readCollection('testBankQuestions')
    .filter((question) => question.status === 'published')
    .map(({ status, createdBy, updatedBy, ...question }) => publicTestBankQuestion(question));
}

/* بانک منتشرشده **با** کلید — مصرف‌کننده‌ها: تصحیح سروری و مسیرهای ادمین */
function publishedTestBankQuestionsInternal() {
  return readCollection('testBankQuestions')
    .filter((question) => question.status === 'published')
    .map(({ status, createdBy, updatedBy, ...question }) => testBankQuestionInternal(question));
}

/* نگاشت id → سؤال درونی منتشرشده؛ پایهٔ تصحیح و بازگشایی کنترل‌شده */
function publishedTestBankIndex() {
  const index = new Map();
  for (const question of publishedTestBankQuestionsInternal()) index.set(question.id, question);
  return index;
}

export function testBankRevision() {
  ensureStore();
  const file = statSync(files.testBankQuestions);
  return `${file.mtimeMs}:${file.size}`;
}

export function listTestBankQuestions({ search = '', subject = 'all', track = 'all', status = 'all', page = 1, perPage = 20 } = {}) {
  const query = normalizeSearch(search);
  const scoped = readCollection('testBankQuestions').filter((question) =>
    (status === 'all' || question.status === status)
    && (track === 'all' || question.track === track)
    && (!query || normalizeSearch(`${question.stem} ${question.id} ${question.topicPath.join(' ')}`).includes(query)));
  return {
    ...paginate(scoped.filter((question) => subject === 'all' || question.subject === subject).map(testBankQuestionForAdmin), { page, perPage }),
    subjects: TEST_BANK_SUBJECTS.map(({ id, name }) => ({ id, name, count: scoped.filter((question) => question.subject === id).length })),
  };
}

export function getTestBankQuestion(id) {
  const question = readCollection('testBankQuestions').find((item) => item.id === id);
  return question ? testBankQuestionForAdmin(question) : null;
}

/*
 * ── ثبت پاسخ + تصحیح + پاداش (PHASE 2) ──
 *
 * قاعدهٔ مرز اعتماد:
 *     کلاینت می‌گوید:    «گزینهٔ ۲ را انتخاب کردم»
 *     سرور تعیین می‌کند:  «گزینهٔ ۲ درست است»
 *     سرور تصمیم می‌گیرد: «پاداش = ۱ قلب»
 *
 * سه سخت‌گیری نسبت به نسخهٔ پیشین:
 *
 *   ۱. **ضد mass-assignment.** `isCorrect`، `reward`، `score`، `hearts` یا هر فیلد
 *      نتیجه‌ای در بدنهٔ کلاینت خوانده نمی‌شود؛ فقط `questionId`/`selected`/`timeSpent`/
 *      `answeredAt` و از میان این‌ها فقط دو مورد اول در تصمیم اثر دارند.
 *
 *   ۲. **کلید پاداش از ساعت سرور می‌آید.** پیش‌تر `attemptKey` از `answeredAt`
 *      کلاینت ساخته می‌شد؛ یعنی مهاجم با تغییر آن می‌توانست برای یک پاسخ درست،
 *      کلید تازه بسازد. اکنون کلید = `questionId:<شمارهٔ روز سرور>` ⇒ Replay همان
 *      پاسخ در همان روز هیچ پاداشی تولید نمی‌کند، مستقل از ورودی کلاینت.
 *
 *   ۳. **بازگشایی کنترل‌شده.** `correctAnswer` و `explanation` فقط برای همان سؤالی
 *      برمی‌گردد که در همین درخواست پاسخ گرفته — نه کل بانک. (کلید هرگز در payload
 *      سؤال نمی‌آید؛ فقط پس از پاسخ.)
 *
 * پاداش به «رویداد واقعی قابل شناسایی» گره خورده: (کاربر، سؤال، روز سرور). پس
 * تعداد قلب قابل کسب از یک سؤال در روز حداکثر یکی است.
 */
const TEST_BANK_MAX_ANSWERS = 1000;
const HEART_REWARD_WINDOW_MS = 24 * 60 * 60 * 1000;

export function recordTestBankAnswers(userId, answers) {
  const list = Array.isArray(answers) ? answers.slice(0, TEST_BANK_MAX_ANSWERS) : [];
  const votes = readCollection('testBankAnswers');
  const questions = readCollection('testBankQuestions');
  const rewards = readCollection('testBankHeartRewards');
  const byId = new Map(questions.map((question) => [question.id, question]));
  const awardedQuestionIds = [];
  const results = [];
  const changed = new Set();
  const now = Date.now();
  const rewardBucket = Math.floor(now / HEART_REWARD_WINDOW_MS);

  for (const entry of list) {
    const questionId = typeof entry?.questionId === 'string' ? entry.questionId : '';
    const question = byId.get(questionId);
    if (!question || question.status !== 'published' || !Array.isArray(question.options)) continue;

    /*
     * اعتبارسنجی سخت‌گیرانه: فقط عدد صحیح در بازهٔ گزینه‌ها.
     * `Number()` تنها کافی نیست — `Number([0])` و `Number('')` هم عدد می‌دهند و
     * آرایه/رشته/شیء از در اعتبارسنجی رد می‌شدند (PHASE 2، سنجهٔ ۱۶).
     */
    const selected = entry?.selected;
    if (typeof selected !== 'number' || !Number.isInteger(selected)
      || selected < 0 || selected >= question.options.length) continue;

    const correct = selected === question.correctAnswer;

    /* بازگشایی کنترل‌شده — فقط پس از پاسخ، فقط برای همین سؤال */
    results.push({
      questionId: question.id,
      selected,
      correct,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? null,
    });

    const index = votes.findIndex((vote) => vote.userId === userId && vote.questionId === question.id);
    const vote = {
      userId, questionId: question.id, selected,
      timeSpent: Math.min(3600, Math.max(0, Number(entry.timeSpent) || 0)),
      answeredAt: Math.min(now, Math.max(0, Number(entry.answeredAt) || 0)),
    };
    if (index === -1) votes.push(vote);
    else if ((votes[index].answeredAt ?? 0) <= vote.answeredAt) votes[index] = vote;
    else continue;
    changed.add(question.id);

    if (correct) {
      const attemptKey = `${question.id}:${rewardBucket}`;
      if (!rewards.some((reward) => reward.userId === userId && reward.attemptKey === attemptKey)) {
        rewards.push({ userId, questionId: question.id, attemptKey, awardedAt: now });
        awardedQuestionIds.push(question.id);
      }
    }
  }

  if (!changed.size) return { awardedQuestionIds, results };
  for (const question of questions) if (changed.has(question.id)) refreshTestBankStats(question, votes);
  writeCollection('testBankAnswers', votes);
  writeCollection('testBankQuestions', questions);
  if (awardedQuestionIds.length) writeCollection('testBankHeartRewards', rewards);

  /*
   * توزیع گزینه‌ها هم بخشی از بازگشایی است: گزینهٔ پرتکرار عملاً کلید را لو
   * می‌دهد، پس در payload سؤال نمی‌آید و فقط همراه پاسخ برمی‌گردد.
   */
  return {
    awardedQuestionIds,
    results: results.map((entry) => ({
      ...entry,
      optionPercents: byId.get(entry.questionId)?.stats?.optionPercents ?? null,
    })),
  };
}

/*
 * ── تصحیح authoritative یک تلاش آزمونک (PHASE 2) ──
 *
 * پیش از این، نمره در کلاینت از `question.correctAnswer` ساخته می‌شد. اکنون کلید
 * در کلاینت نیست، پس نمره باید اینجا ساخته شود: سرور با کلید خودش تصحیح می‌کند و
 * همان شکل `result` را برمی‌گرداند که UI از قبل می‌شناخت.
 *
 * نکتهٔ صداقتی (در گزارش مستند شده): `questionIds` را کلاینت می‌فرستد، پس می‌تواند
 * سؤالی را از بدنه حذف کند. اثرش فقط روی کارنامهٔ تمرینی خودِ کاربر است (هیچ رتبه،
 * گواهی یا قلب دیگری به آن گره نخورده — پاداش مسیر مستقل و سرورمحور دارد).
 * برای آزمون‌های رسمی، همان معماری سختِ `examStore.js` برجاست که سؤال‌ها را
 * سرور فریز می‌کند.
 */
const TEST_BANK_MAX_GRADE_QUESTIONS = 500;

export function gradeTestBankAttempt({ questionIds, answers, negativeMarking } = {}) {
  const index = publishedTestBankIndex();
  const ids = (Array.isArray(questionIds) ? questionIds : [])
    .filter((id) => typeof id === 'string' && index.has(id))
    .slice(0, TEST_BANK_MAX_GRADE_QUESTIONS);

  const negative = Math.min(1, Math.max(-1, Number(negativeMarking) || 0));
  const answerMap = answers && typeof answers === 'object' ? answers : {};

  let correct = 0;
  let wrong = 0;
  let timeSum = 0;
  let answered = 0;
  const wrongIds = [];
  const unansweredIds = [];

  for (const id of ids) {
    const question = index.get(id);
    const raw = answerMap[id];
    /* فقط عدد صحیح؛ آرایه/رشته/شیء نامعتبر است (همان سخت‌گیری مسیر ثبت پاسخ) */
    const selected = typeof raw?.selected === 'number' && Number.isInteger(raw.selected) ? raw.selected : null;
    const valid = selected !== null && selected >= 0 && selected < question.options.length;

    if (!valid) {
      unansweredIds.push(id);
      continue;
    }

    answered += 1;
    timeSum += Math.min(3600, Math.max(0, Number(raw?.timeSpent) || 0));
    if (selected === question.correctAnswer) correct += 1;
    else {
      wrong += 1;
      wrongIds.push(id);
    }
  }

  const total = ids.length;
  const score = Math.max(0, correct + wrong * negative);
  const percentage = Math.max(0, Math.min(100, Math.round((score / Math.max(total, 1)) * 1000) / 10));

  return {
    total,
    answered,
    correct,
    wrong,
    unanswered: total - answered,
    score: Math.round(score * 100) / 100,
    maxScore: total,
    negativeMarking: negative,
    percentage,
    avgTimeSec: answered ? Math.round(timeSum / answered) : 0,
    wrongIds,
    unansweredIds,
  };
}

export function getUserHeartRewards(userId) {
  return readCollection('testBankHeartRewards')
    .filter((reward) => reward.userId === userId)
    .map((reward) => ({ awardedAt: reward.awardedAt }));
}

export function transferGuestTestBankProgress(guestId, userId) {
  if (!guestId || guestId === userId) return;
  const rewards = readCollection('testBankHeartRewards');
  if (rewards.some((reward) => reward.userId === guestId)) {
    writeCollection('testBankHeartRewards', rewards.map((reward) =>
      reward.userId === guestId ? { ...reward, userId } : reward));
  }
  const votes = readCollection('testBankAnswers');
  if (!votes.some((vote) => vote.userId === guestId)) return;
  const merged = votes.filter((vote) => vote.userId !== guestId);
  const changed = new Set();
  for (const vote of votes.filter((item) => item.userId === guestId)) {
    changed.add(vote.questionId);
    const index = merged.findIndex((item) => item.userId === userId && item.questionId === vote.questionId);
    if (index === -1) merged.push({ ...vote, userId });
    else if ((merged[index].answeredAt ?? 0) < (vote.answeredAt ?? 0)) merged[index] = { ...vote, userId };
  }
  writeCollection('testBankAnswers', merged);
  const questions = readCollection('testBankQuestions');
  for (const question of questions) if (changed.has(question.id)) refreshTestBankStats(question, merged);
  writeCollection('testBankQuestions', questions);
}

function refreshTestBankStats(question, votes) {
  const responses = votes.filter((vote) => vote.questionId === question.id && vote.selected < question.options.length);
  if (!responses.length) return;
  const solves = responses.length;
  const correctPercent = Math.round(responses.filter((vote) => vote.selected === question.correctAnswer).length / solves * 100);
  question.stats = {
    ...question.stats, solves, correctPercent,
    optionPercents: question.options.map((_, index) => Math.round(responses.filter((vote) => vote.selected === index).length / solves * 100)),
    avgTimeSec: Math.round(responses.reduce((sum, vote) => sum + vote.timeSpent, 0) / solves),
    difficultyIndex: correctPercent / 100,
  };
  question.difficulty = difficultyFromPercent(correctPercent);
}

function testBankQuestionPayload(input, existing) {
  const options = Array.isArray(input?.options) ? input.options.map((value) => String(value ?? '').trim().slice(0, 2000)) : [];
  const correctAnswer = Number(input?.correctAnswer);
  if (!TEST_BANK_SUBJECTS.some((item) => item.id === input?.subject)
    || !TEST_BANK_TRACKS[input?.track] || !['official', 'tapesh'].includes(input?.source)
    || !String(input?.stem ?? '').trim() || options.length < 2 || options.some((value) => !value)
    || !Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
    throw Object.assign(new Error('مشخصات سؤال، گزینه‌ها یا پاسخ صحیح معتبر نیست'), { code: 'VALIDATION_ERROR' });
  }
  const explanation = input?.explanation ?? {};
  const figure = String(input.figure ?? '');
  if (figure && !['cardiac-ap', 'o2-curve', 'enzyme-kinetics'].includes(figure) && !/^\/uploads\/[\w.-]+\.(?:png|jpe?g|webp|gif|avif|svg)$/.test(figure)) {
    throw Object.assign(new Error('شکل سؤال معتبر نیست'), { code: 'VALIDATION_ERROR' });
  }
  return {
    subject: input.subject, track: input.track, source: input.source,
    type: existing?.type ?? 'single',
    difficulty: existing?.stats?.solves > 0 ? difficultyFromPercent(existing.stats.correctPercent) : (existing?.difficulty ?? 'medium'),
    year: Number.isInteger(Number(input.year)) && Number(input.year) >= 1300 && Number(input.year) <= 1600 ? Number(input.year) : null,
    examMonth: Number.isInteger(Number(input.examMonth)) && Number(input.examMonth) >= 1 && Number(input.examMonth) <= 12 && Number(input.year) >= 1300 ? Number(input.examMonth) : null,
    topicPath: (Array.isArray(input.topicPath) ? input.topicPath : []).map((part) => String(part ?? '').trim().slice(0, 120)).filter(Boolean).slice(0, 5),
    tags: (Array.isArray(input.tags) ? input.tags : []).map((tag) => String(tag ?? '').trim().slice(0, 60)).filter(Boolean).slice(0, 20),
    conceptIds: (Array.isArray(input.conceptIds) ? input.conceptIds : []).map((id) => String(id ?? '').trim().slice(0, 100)).filter(Boolean).slice(0, 30),
    stem: String(input.stem).trim().slice(0, 10000),
    figure: figure || null,
    options, correctAnswer,
    explanation: {
      summary: String(explanation.summary ?? '').trim().slice(0, 10000),
      deep: String(explanation.deep ?? '').trim().slice(0, 20000),
      keyPoint: String(explanation.keyPoint ?? '').trim().slice(0, 10000),
      trap: String(explanation.trap ?? '').trim().slice(0, 10000),
      whyWrong: options.map((_, index) => index).filter((index) => index !== correctAnswer)
        .map((index) => ({ index, text: String(explanation.whyWrong?.find((item) => Number(item.index) === index)?.text ?? '').trim().slice(0, 10000) }))
        .filter((item) => item.text),
    },
    stats: existing?.stats ?? { solves: 0, correctPercent: 0, optionPercents: options.map(() => 0), avgTimeSec: 0, difficultyIndex: 0 },
    status: TEST_BANK_STATUSES.includes(input.status) ? input.status : 'draft',
  };
}

export function createTestBankQuestion(input, admin) {
  const questions = readCollection('testBankQuestions');
  const now = nowIso();
  const question = { id: makeId('tbq'), ...testBankQuestionPayload(input), createdAt: now, updatedAt: now, createdBy: admin?.id, updatedBy: admin?.id };
  questions.unshift(question);
  writeCollection('testBankQuestions', questions);
  return question;
}

export function updateTestBankQuestion(id, input, admin) {
  const questions = readCollection('testBankQuestions');
  const index = questions.findIndex((question) => question.id === id);
  if (index === -1) return null;
  const { examDay, ...previous } = questions[index];
  const question = { ...previous, ...testBankQuestionPayload(input, questions[index]), updatedAt: nowIso(), updatedBy: admin?.id };
  const changedAnswer = question.correctAnswer !== questions[index].correctAnswer
    || JSON.stringify(question.options) !== JSON.stringify(questions[index].options);
  if (changedAnswer) {
    question.stats = { solves: 0, correctPercent: 0, optionPercents: question.options.map(() => 0), avgTimeSec: 0, difficultyIndex: 0 };
    question.difficulty = 'medium';
    writeCollection('testBankAnswers', readCollection('testBankAnswers').filter((vote) => vote.questionId !== id));
  } else refreshTestBankStats(question, readCollection('testBankAnswers'));
  questions[index] = question;
  writeCollection('testBankQuestions', questions);
  return question;
}

export function deleteTestBankQuestion(id) {
  const questions = readCollection('testBankQuestions');
  const question = questions.find((item) => item.id === id);
  if (question) writeCollection('testBankQuestions', questions.filter((item) => item.id !== id));
  return question ?? null;
}

export function searchTestBankQuestions({
  search = '', subjectId = '', topicPath = '', difficulty = 'all', limit = 40,
} = {}) {
  const query = normalizeSearch(search);
  const path = microText(topicPath, 120);
  const size = microInt(limit, 40, 1, 100);

  const matched = publishedTestBankQuestionsInternal().filter((question) => {
    if (subjectId && question.subject !== subjectId) return false;
    if (difficulty !== 'all' && question.difficulty !== difficulty) return false;
    if (path && !question.topicPath.join(' › ').includes(path)) return false;
    if (!query) return true;
    return normalizeSearch(question.stem).includes(query)
      || normalizeSearch(question.topicPath.join(' › ')).includes(query);
  });

  return {
    total: matched.length,
    items: matched.slice(0, size).map((question) => ({
      id: question.id,
      subject: question.subject,
      subjectTitle: TEST_BANK_SUBJECTS.find((subject) => subject.id === question.subject)?.name ?? question.subject,
      topicPath: question.topicPath,
      difficulty: question.difficulty,
      difficultyLabel: TEST_BANK_DIFFICULTIES[question.difficulty]?.label ?? question.difficulty,
      type: question.type,
      year: question.year,
      tags: question.tags ?? [],
      stem: question.stem,
      options: question.options,
      correctAnswer: question.correctAnswer,
      conceptIds: question.conceptIds ?? [],
    })),
    subjects: TEST_BANK_SUBJECTS.map((subject) => ({ id: subject.id, name: subject.name })),
    difficulties: Object.entries(TEST_BANK_DIFFICULTIES)
      .map(([id, meta]) => ({ id, label: meta?.label ?? id })),
  };
}

/*
 * یک رکورد درسنامه از یک درسِ رجیستری می‌سازد. تنها جایی که «درسِ کد» به «رکورد پنل»
 * تبدیل می‌شود؛ هم seed اولیه و هم همگام‌سازی از همین تابع رد می‌شوند تا شکل داده
 * یک‌نسخه بماند.
 */
function microCourseFromSource(courseId, source, created) {
  const course = microCoursePayload({ ...source, status: 'draft' });

  return {
    id: `mcr-${courseId}`,
    ...course,
    publishedAt: null,
    createdAt: created,
    updatedAt: created,
    createdBy: 'seed',
    updatedBy: 'seed',
  };
}

/*
 * seed اولیه — هر ۱۶ درسِ رجیستری (`src/data/micro/registry.js`) با وضعیت `draft`.
 * چرا draft؟ چون انتشار باید یک تصمیم صریح ادمین باشد، نه عارضهٔ جانبی seed.
 *
 * نتیجه memo می‌شود: `ensureStore` این تابع را به‌عنوان آرگومان `ensureFile` صدا
 * می‌زند و آرگومان پیش از فراخوانی ساخته می‌شود؛ بدون memo، هر read/write کل
 * رجیستری را دوباره نرمال می‌کرد.
 */
let microSeedCache = null;

function seedMicroCourses() {
  if (microSeedCache) return microSeedCache;

  const created = nowIso();
  microSeedCache = MICRO_COURSE_SOURCES
    .map(({ courseId, course }) => microCourseFromSource(courseId, course, created));

  return microSeedCache;
}

/*
 * همگام‌سازی افزایشی: هر درسِ رجیستری که در فایل `microCourses.json` رکورد ندارد،
 * به‌صورت draft اضافه می‌شود. این تابع هیچ رکورد موجودی را دست نمی‌زند، پس ویرایش‌های
 * ادمین (و وضعیت انتشار) محفوظ می‌ماند. لازم است چون `ensureFile` فقط وقتی فایل
 * نباشد seed می‌کند و پروژه‌های موجود با یک درس seed شده بودند.
 *
 * دو محافظ دارد:
 *   • `microSynced` — یک‌بار در عمر هر پروسه اجرا می‌شود (ensureStore روی هر
 *     read/write صدا زده می‌شود و این تابع نباید هر بار فایل را باز کند).
 *   • `writeJson` مستقیم، نه `writeCollection` — وگرنه از داخل ensureStore به
 *     ensureStore برمی‌گردیم و حلقهٔ بی‌پایان می‌شود.
 */
let microSynced = false;

/*
 * رکوردهای ذخیره‌شده پیش از مهاجرت به ویرایشگر متنی، فیلد `content` ندارند.
 * این تابع فقط همان فیلد را از بلوک‌های موجود پر می‌کند و به هیچ فیلد دیگری دست
 * نمی‌زند؛ اگر چیزی برای تغییر نبود `null` برمی‌گرداند تا نوشتن بی‌دلیل فایل رخ ندهد.
 */
function backfillMicroContent(course) {
  let changed = false;

  const topics = (course.topics ?? []).map((topic) => ({
    ...topic,
    units: (topic.units ?? []).map((unit) => ({
      ...unit,
      pages: (unit.pages ?? []).map((page) => {
        if (microHtml(page.content)) return page;
        const derived = blocksToHtml(page.blocks ?? []);
        if (!derived) return page;
        changed = true;
        return { ...page, content: derived };
      }),
    })),
  }));

  return changed ? { ...course, topics } : null;
}

function syncMicroCourses() {
  if (microSynced) return;
  microSynced = true;

  const stored = readJson(files.microCourses, []);
  if (!Array.isArray(stored)) return;

  const known = new Set(stored.map((course) => course.id));
  const created = nowIso();
  const missing = MICRO_COURSE_SOURCES
    .filter(({ courseId }) => !known.has(`mcr-${courseId}`))
    .map(({ courseId, course }) => microCourseFromSource(courseId, course, created));

  let changed = false;
  const backfilled = stored.map((course) => {
    const next = backfillMicroContent(course);
    if (next) changed = true;
    return next ?? course;
  });

  if (!missing.length && !changed) return;
  writeJson(files.microCourses, [...backfilled, ...missing]);
}

/* ─────────────────────────────── بنرها ─────────────────────────────── */

export function listBanners() {
  return [...readCollection('banners')].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function bannerPayload(input, existing = null) {
  const title = String(input.title ?? '').trim();
  if (!title) throw Object.assign(new Error('عنوان بنر الزامی است'), { code: 'VALIDATION_ERROR' });

  return {
    title,
    subtitle: String(input.subtitle ?? '').slice(0, 300),
    image: String(input.image ?? ''),
    buttonText: String(input.buttonText ?? '').slice(0, 60),
    buttonUrl: String(input.buttonUrl ?? '').slice(0, 300),
    isActive: input.isActive !== false,
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : (existing?.sortOrder ?? 1),
    startDate: String(input.startDate ?? '').slice(0, 30),
    endDate: String(input.endDate ?? '').slice(0, 30),
  };
}

export function createBanner(input) {
  const banners = readCollection('banners');
  const created = nowIso();
  const banner = { id: makeId('bn'), ...bannerPayload(input), createdAt: created, updatedAt: created };

  banners.push(banner);
  writeCollection('banners', banners);
  return banner;
}

export function updateBanner(id, input) {
  const banners = readCollection('banners');
  const index = banners.findIndex((banner) => banner.id === id);
  if (index === -1) return null;

  banners[index] = { ...banners[index], ...bannerPayload(input, banners[index]), updatedAt: nowIso() };
  writeCollection('banners', banners);
  return banners[index];
}

export function deleteBanner(id) {
  const banners = readCollection('banners');
  const target = banners.find((banner) => banner.id === id);
  if (!target) return null;

  writeCollection('banners', banners.filter((banner) => banner.id !== id));
  return target;
}

/* ──────────────────────────── یادداشت‌های پنل ────────────────────────────
 * دفترچهٔ شخصی هر مدیر: نکته‌ها و برنامه‌ها در دو حالت «متنی» و «چک‌لیست».
 * یادداشت‌ها به نویسنده‌شان گره خورده‌اند (`authorId`) و هیچ‌کس یادداشت دیگری را
 * نمی‌بیند؛ پس همهٔ توابع، شناسهٔ مدیر جاری را می‌گیرند.
 */

export const NOTE_KINDS = ['text', 'checklist'];

const NOTE_MAX_BODY = 20_000;
const NOTE_MAX_ITEMS = 200;

export function listNotes({ adminId, search = '', kind = 'all', sort = 'updated' } = {}) {
  const query = normalizeSearch(search);
  const mine = readCollection('notes').filter((note) => note.authorId === adminId);

  const filtered = mine.filter((note) => {
    if (kind !== 'all' && note.kind !== kind) return false;
    if (!query) return true;
    return [note.title, note.body, ...(note.items ?? []).map((item) => item.text)]
      .some((field) => normalizeSearch(field).includes(query));
  });

  const sorters = {
    updated: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
    created: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    title: (a, b) => String(a.title).localeCompare(String(b.title), 'fa'),
  };

  /* گلچین‌شده‌ها همیشه جلوتر از بقیه می‌آیند */
  filtered.sort((a, b) => (
    a.pinned === b.pinned ? 0 : (a.pinned ? -1 : 1)
  ) || (sorters[sort] ?? sorters.updated)(a, b));

  const items = mine.flatMap((note) => note.items ?? []);

  return {
    notes: filtered,
    stats: {
      total: mine.length,
      checklists: mine.filter((note) => note.kind === 'checklist').length,
      pinned: mine.filter((note) => note.pinned).length,
      doneItems: items.filter((item) => item.done).length,
      totalItems: items.length,
    },
  };
}

export function getNote(id, adminId) {
  return readCollection('notes').find((note) => note.id === id && note.authorId === adminId) ?? null;
}

function notePayload(input, existing = null) {
  const kind = NOTE_KINDS.includes(input.kind) ? input.kind : (existing?.kind ?? 'text');
  const title = String(input.title ?? '').trim().slice(0, 140);

  const body = kind === 'text' ? String(input.body ?? '').trim().slice(0, NOTE_MAX_BODY) : '';
  const items = kind === 'checklist'
    ? (Array.isArray(input.items) ? input.items : [])
        .map((item) => ({
          id: item.id || makeId('itm'),
          text: String(item.text ?? '').trim().slice(0, 300),
          done: Boolean(item.done),
        }))
        .filter((item) => item.text)
        .slice(0, NOTE_MAX_ITEMS)
    : [];

  if (!title && !body && items.length === 0) {
    throw Object.assign(new Error('یادداشت خالی است؛ عنوان یا متن بنویسید'), { code: 'VALIDATION_ERROR' });
  }

  return { title, kind, body, items, pinned: Boolean(input.pinned) };
}

export function createNote(input, admin) {
  const notes = readCollection('notes');
  const created = nowIso();

  const note = {
    id: makeId('note'),
    authorId: admin?.id ?? 'system',
    authorName: admin?.name || admin?.username || 'سیستم',
    ...notePayload(input),
    createdAt: created,
    updatedAt: created,
  };

  notes.unshift(note);
  writeCollection('notes', notes);
  return note;
}

export function updateNote(id, input, admin) {
  const adminId = admin?.id ?? 'system';
  const notes = readCollection('notes');
  const index = notes.findIndex((note) => note.id === id && note.authorId === adminId);
  if (index === -1) return null;

  notes[index] = {
    ...notes[index],
    ...notePayload({ ...notes[index], ...input }, notes[index]),
    updatedAt: nowIso(),
  };

  writeCollection('notes', notes);
  return notes[index];
}

export function deleteNote(id, admin) {
  const adminId = admin?.id ?? 'system';
  const notes = readCollection('notes');
  const target = notes.find((note) => note.id === id && note.authorId === adminId);
  if (!target) return null;

  writeCollection('notes', notes.filter((note) => note.id !== id));
  return target;
}

export function setNotePinned(id, pinned, admin) {
  const adminId = admin?.id ?? 'system';
  const notes = readCollection('notes');
  const index = notes.findIndex((note) => note.id === id && note.authorId === adminId);
  if (index === -1) return null;

  notes[index] = { ...notes[index], pinned: Boolean(pinned), updatedAt: nowIso() };
  writeCollection('notes', notes);
  return notes[index];
}

/* تیک‌زدن یک آیتم چک‌لیست ویرایش محسوب نمی‌شود، پس `updatedAt` را بالا نمی‌برد */
export function toggleNoteItem(id, itemId, admin) {
  const adminId = admin?.id ?? 'system';
  const notes = readCollection('notes');
  const index = notes.findIndex((note) => note.id === id && note.authorId === adminId);
  if (index === -1) return null;

  const note = notes[index];
  if (!(note.items ?? []).some((item) => item.id === itemId)) return null;

  notes[index] = {
    ...note,
    items: note.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
  };

  writeCollection('notes', notes);
  return notes[index];
}

/* ──────────────────────────────── رسانه ──────────────────────────────── */

/* تصویرها از فهرست مشترک کارت تصویری می‌آیند (`mockData.js`) تا پنل و داشبورد
   و سرور یک فهرست داشته باشند؛ PDF فقط در کتابخانهٔ رسانه مجاز است، نه کارت. */
const MIME_EXTENSIONS = {
  ...CARD_IMAGE_MIME_EXTENSIONS,
  'application/pdf': 'pdf',
};

export function listMedia({ search = '', type = 'all', page = 1, perPage = 24 } = {}) {
  const query = normalizeSearch(search);

  const filtered = readCollection('media').filter((item) => {
    if (type !== 'all' && !String(item.mimeType).startsWith(type)) return false;
    if (!query) return true;
    return [item.originalName, item.altText, item.filename].some((field) => normalizeSearch(field).includes(query));
  });

  filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return paginate(filtered, { page, perPage });
}

export function createMedia({ originalName, mimeType, base64, altText = '', admin = null }) {
  const settings = readSettings();
  const allowed = settings.media?.allowedMimeTypes ?? Object.keys(MIME_EXTENSIONS);

  if (!allowed.includes(mimeType)) {
    throw Object.assign(new Error('نوع فایل مجاز نیست'), { code: 'UNSUPPORTED_MEDIA_TYPE' });
  }

  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) throw Object.assign(new Error('پسوند فایل ناشناخته است'), { code: 'UNSUPPORTED_MEDIA_TYPE' });

  const buffer = Buffer.from(String(base64 ?? '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  const maxBytes = (Number(settings.media?.maxUploadMb) || 4) * 1024 * 1024;

  if (!buffer.length) throw Object.assign(new Error('فایل خالی است'), { code: 'VALIDATION_ERROR' });
  if (buffer.length > maxBytes) {
    throw Object.assign(new Error(`حجم فایل بیش از ${settings.media?.maxUploadMb ?? 4} مگابایت است`), { code: 'PAYLOAD_TOO_LARGE' });
  }

  /* نام فایل هرگز از ورودی کاربر ساخته نمی‌شود — ضد path traversal */
  const filename = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${extension}`;
  ensureDir(uploadsDir);
  writeFileSync(resolve(uploadsDir, filename), buffer);

  const media = {
    id: makeId('md'),
    filename,
    originalName: String(originalName ?? filename).replace(/[\\/]/g, '').slice(0, 160),
    mimeType,
    size: buffer.length,
    url: `${UPLOADS_URL_PREFIX}/${filename}`,
    altText: String(altText ?? '').slice(0, 200),
    createdAt: nowIso(),
    uploadedBy: admin?.id ?? 'system',
    uploadedByName: admin?.name || admin?.username || '',
  };

  const items = readCollection('media');
  items.unshift(media);
  writeCollection('media', items);
  return media;
}

export function updateMedia(id, { altText }) {
  const items = readCollection('media');
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  items[index] = { ...items[index], altText: String(altText ?? '').slice(0, 200) };
  writeCollection('media', items);
  return items[index];
}

export function deleteMedia(id) {
  const items = readCollection('media');
  const target = items.find((item) => item.id === id);
  if (!target) return null;

  writeCollection('media', items.filter((item) => item.id !== id));

  try {
    const path = resolve(uploadsDir, target.filename);
    /* فقط داخل پوشهٔ uploads حذف شود */
    if (path.startsWith(uploadsDir) && existsSync(path)) unlinkSync(path);
  } catch {
    /* فایل از قبل نبوده — رکورد حذف شده است */
  }

  return target;
}

/* ─────────────────────────────── مدیران ─────────────────────────────── */

export function listAdmins({ search = '', role = 'all', page = 1, perPage = 10 } = {}) {
  const query = normalizeSearch(search);

  const filtered = readCollection('admins').filter((admin) => {
    if (role !== 'all' && admin.role !== role) return false;
    if (!query) return true;
    return [admin.username, admin.name, admin.email].some((field) => normalizeSearch(field).includes(query));
  });

  filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const result = paginate(filtered, { page, perPage });
  return { ...result, items: result.items.map(publicAdmin) };
}

/*
 * ── قاعدهٔ ارتقا/تنزل نقش ──
 *
 * «نقش» یعنی سطح اعتماد. هیچ مسیر CRUD کاربری نباید به‌صورت ضمنی سطح اعتماد را
 * عوض کند. این گارد سه جا صدا زده می‌شود: ساخت کاربر، ویرایش کاربر، حذف کاربر.
 *
 * تصمیم همیشه server-side است؛ Client فقط `role` را پیشنهاد می‌دهد و اگر مجوزش
 * را نداشته باشد، همان پیشنهاد رد می‌شود. فیلد `permissions` از Client هرگز خوانده
 * نمی‌شود — مجوزها فقط از `ROLES` می‌آیند.
 */
function assertCanTouchSuperAdmin(actor, message) {
  if (hasPermission(actor, 'users.superadmin.manage')) return;
  throw Object.assign(new Error(message), { code: 'FORBIDDEN' });
}

export function createAdmin(input, actor = null) {
  const username = String(input.username ?? '').trim();
  const password = String(input.password ?? '');

  if (username.length < 3) throw Object.assign(new Error('نام کاربری حداقل ۳ کاراکتر باشد'), { code: 'VALIDATION_ERROR' });
  if (password.length < 4) throw Object.assign(new Error('رمز عبور حداقل ۴ کاراکتر باشد'), { code: 'VALIDATION_ERROR' });
  if (findAdminByUsername(username)) throw Object.assign(new Error('این نام کاربری قبلاً ثبت شده است'), { code: 'CONFLICT' });
  if (!ROLES[input.role]) throw Object.assign(new Error('نقش نامعتبر است'), { code: 'VALIDATION_ERROR' });

  /* ساخت «مدیر کل» مجوز صریح می‌خواهد — `users.create` کافی نیست */
  if (input.role === 'super-admin') {
    assertCanTouchSuperAdmin(actor, 'ساخت «مدیر کل» مجوز جداگانه می‌خواهد');
  }

  const admins = readCollection('admins');
  const created = nowIso();

  const admin = {
    id: makeId('adm'),
    username,
    name: String(input.name ?? '').trim() || username,
    email: String(input.email ?? '').trim().slice(0, 160),
    passwordHash: hashPassword(password),
    role: input.role,
    isActive: input.isActive !== false,
    mustChangePassword: Boolean(input.mustChangePassword),
    createdAt: created,
    updatedAt: created,
    lastLoginAt: null,
    createdBy: actor?.id ?? 'system',
  };

  admins.push(admin);
  writeCollection('admins', admins);
  return publicAdmin(admin);
}

export function updateAdmin(id, input, actor = null) {
  const admins = readCollection('admins');
  const index = admins.findIndex((admin) => admin.id === id);
  if (index === -1) return null;

  const current = admins[index];
  const previousRole = current.role;
  const wasActive = current.isActive !== false;
  const nextRole = input.role ?? current.role;
  const isSelf = Boolean(actor?.id) && actor.id === current.id;

  if (input.role && !ROLES[input.role]) {
    throw Object.assign(new Error('نقش نامعتبر است'), { code: 'VALIDATION_ERROR' });
  }

  /*
   * خودارتقایی بسته است — برای همه، از جمله مدیر کل.
   * دلیل: نقش یعنی سطح اعتماد؛ کسی که سطح اعتماد خودش را بالا می‌برد، کنترل
   * بیرونی را دور می‌زند. تغییر نقش خود باید توسط مدیر دیگری انجام شود.
   */
  if (isSelf && nextRole !== previousRole) {
    throw Object.assign(new Error('نقش حساب خودتان را از این مسیر نمی‌توانید تغییر دهید'), { code: 'FORBIDDEN' });
  }

  /*
   * هر دست‌کاری روی یک «مدیر کل» — یا تبدیل کسی به «مدیر کل» — مجوز صریح
   * می‌خواهد. این شامل عوض‌کردن رمز عبور مدیر کل هم می‌شود؛ وگرنه یک مدیر
   * معمولی می‌توانست رمز مدیر کل را عوض کند و به‌جای او وارد شود.
   */
  const touchesSuperAdmin = previousRole === 'super-admin' || nextRole === 'super-admin';
  if (touchesSuperAdmin) {
    assertCanTouchSuperAdmin(actor, 'دست‌زدن به حساب «مدیر کل» مجوز جداگانه می‌خواهد');
  }

  /* آخرین مدیر کل فعال نباید غیرفعال یا تنزل داده شود */
  const losingSuperAdmin =
    previousRole === 'super-admin' &&
    (nextRole !== 'super-admin' || input.isActive === false);

  if (losingSuperAdmin) {
    const activeSuperAdmins = admins.filter(
      (admin) => admin.role === 'super-admin' && admin.isActive && admin.id !== id,
    ).length;
    if (activeSuperAdmins === 0) {
      throw Object.assign(new Error('حداقل یک مدیر کل فعال باید باقی بماند'), { code: 'CONFLICT' });
    }
  }

  const passwordChanged = Boolean(input.password);
  if (passwordChanged) {
    if (String(input.password).length < 4) {
      throw Object.assign(new Error('رمز عبور حداقل ۴ کاراکتر باشد'), { code: 'VALIDATION_ERROR' });
    }
    current.passwordHash = hashPassword(input.password);
    current.mustChangePassword = false;
  }

  admins[index] = {
    ...current,
    name: String(input.name ?? current.name).trim() || current.name,
    email: String(input.email ?? current.email).trim().slice(0, 160),
    role: nextRole,
    isActive: input.isActive ?? current.isActive,
    updatedAt: nowIso(),
    updatedBy: actor?.id ?? 'system',
  };

  writeCollection('admins', admins);

  /*
   * رویدادهای امنیتی، نشست‌های بازِ همان حساب را می‌بندند:
   * رمز عوض شده ⇒ هر نشست دیگری احتمالاً مالِ دارندهٔ رمز قدیمی است.
   * نقش عوض شده ⇒ مجوز قبلی نباید تا پایان TTL زنده بماند.
   * حساب غیرفعال شده ⇒ همان لحظه قطع شود، نه در درخواست بعدی.
   */
  const revokedSessions = (passwordChanged || nextRole !== previousRole || (wasActive && admins[index].isActive === false))
    ? destroySessionsForAdmin(id)
    : 0;

  return { ...publicAdmin(admins[index]), revokedSessions };
}

export function changeOwnPassword(id, { currentPassword, nextPassword, keepToken = '' } = {}) {
  const admins = readCollection('admins');
  const index = admins.findIndex((admin) => admin.id === id);
  if (index === -1) return { error: 'not-found' };

  if (!verifyPassword(currentPassword, admins[index].passwordHash)) {
    return { error: 'invalid-credentials' };
  }

  if (String(nextPassword ?? '').length < 4) {
    return { error: 'weak-password' };
  }

  admins[index] = {
    ...admins[index],
    passwordHash: hashPassword(nextPassword),
    mustChangePassword: false,
    updatedAt: nowIso(),
  };

  writeCollection('admins', admins);

  /*
   * اگر رمز به‌خاطر لو رفتن عوض شده، نشست مهاجم نباید زنده بماند. نشست فعلی
   * حفظ می‌شود تا خودِ مدیر بی‌دلیل بیرون نیفتد.
   */
  const revokedSessions = destroySessionsForAdmin(id, { keepToken });

  return { admin: publicAdmin(admins[index]), revokedSessions };
}

export function deleteAdmin(id, actor = null) {
  const actorId = actor?.id ?? null;

  if (actorId && id === actorId) {
    throw Object.assign(new Error('حساب خودتان را نمی‌توانید حذف کنید'), { code: 'CONFLICT' });
  }

  const admins = readCollection('admins');
  const target = admins.find((admin) => admin.id === id);
  if (!target) return null;

  /* حذف «مدیر کل» مجوز صریح می‌خواهد */
  if (target.role === 'super-admin') {
    assertCanTouchSuperAdmin(actor, 'حذف «مدیر کل» مجوز جداگانه می‌خواهد');
  }

  /*
   * invariant: دست‌کم یک مدیر کلِ **فعال** باید بماند.
   * شمارش فقط مدیرهای کل فعال را می‌شمارد؛ اگر تنها مدیر کل باقی‌مانده غیرفعال
   * باشد، حذف مدیر کل فعال یعنی سیستم بدون حساب مدیریتی می‌ماند.
   */
  const remainingActiveSuperAdmins = admins.filter(
    (admin) => admin.role === 'super-admin' && admin.isActive && admin.id !== id,
  ).length;

  if (target.role === 'super-admin' && target.isActive && remainingActiveSuperAdmins === 0) {
    throw Object.assign(new Error('حداقل یک مدیر کل فعال باید باقی بماند'), { code: 'CONFLICT' });
  }

  writeCollection('admins', admins.filter((admin) => admin.id !== id));

  /* نشست‌های حساب حذف‌شده همان لحظه باطل می‌شوند */
  const revokedSessions = destroySessionsForAdmin(id);

  return { ...publicAdmin(target), revokedSessions };
}

/* ─────────────────────────────── گزارش‌ها ─────────────────────────────── */

export function listActivity({ search = '', action = 'all', page = 1, perPage = 15 } = {}) {
  const query = normalizeSearch(search);

  const filtered = readCollection('activity').filter((entry) => {
    if (action !== 'all' && entry.action !== action) return false;
    if (!query) return true;
    return [entry.userName, entry.entityLabel, entry.entityType, entry.action]
      .some((field) => normalizeSearch(field).includes(query));
  });

  return paginate(filtered, { page, perPage });
}

export function activityActions() {
  const actions = new Set(readCollection('activity').map((entry) => entry.action));
  return [...actions].sort();
}

/* ───────────────────────────── آمار داشبورد ───────────────────────────── */

export function dashboardStats() {
  const articles = readCollection('articles');
  const pages = readCollection('pages');
  const admins = readCollection('admins');
  const media = readCollection('media');
  const banners = readCollection('banners');
  const activity = readCollection('activity');

  const byStatus = ARTICLE_STATUSES.reduce((accumulator, status) => {
    accumulator[status] = articles.filter((article) => article.status === status).length;
    return accumulator;
  }, {});

  const topArticles = [...articles]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5)
    .map((article) => ({ id: article.id, title: article.title, views: article.views ?? 0, status: article.status }));

  /* نمودار ۱۴ روز اخیر بر اساس فعالیت */
  const days = [];
  for (let index = 13; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10);
    days.push({
      date,
      count: activity.filter((entry) => String(entry.createdAt).startsWith(date)).length,
    });
  }

  return {
    totals: {
      articles: articles.length,
      pages: pages.length,
      admins: admins.length,
      media: media.length,
      banners: banners.length,
      published: byStatus.published ?? 0,
      drafts: byStatus.draft ?? 0,
      archived: byStatus.archived ?? 0,
    },
    byStatus,
    topArticles,
    activitySeries: days,
    recentActivity: activity.slice(0, 8),
  };
}

/* ───────────────────────── API عمومی سایت ───────────────────────── */

export function publishedArticles({ limit = 50 } = {}) {
  return readCollection('articles')
    .filter((article) => article.status === 'published')
    .sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')))
    .slice(0, limit);
}

export function publishedBanners() {
  const today = new Date().toISOString().slice(0, 10);

  return listBanners().filter((banner) => {
    if (!banner.isActive) return false;
    if (banner.startDate && banner.startDate > today) return false;
    if (banner.endDate && banner.endDate < today) return false;
    return true;
  });
}

export function publicSettings() {
  const settings = readSettings();
  /* هیچ کلید حساسی به کلاینت نمی‌رود؛ این تابع فقط دادهٔ قابل نمایش برمی‌گرداند */
  return {
    siteName: settings.siteName,
    siteDescription: settings.siteDescription,
    logo: settings.logo,
    favicon: settings.favicon,
    email: settings.email,
    phone: settings.phone,
    address: settings.address,
    social: settings.social,
    seo: settings.seo,
    googleAnalyticsId: settings.integrations?.googleAnalyticsId ?? '',
  };
}

export { ensureStore, contentDir, uploadsDir };
