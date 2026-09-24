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
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildExcerpt, htmlToText, sanitizeHtml } from './sanitizeHtml.js';
/*
 * سه ماژول دادهٔ خالص پروژه که seed، «انتخاب از بانک تست» و تبدیل متن را تغذیه می‌کنند.
 * هیچ‌کدام وابستگی بیرونی ندارند (فقط دادهٔ ثابت و توابع خالص‌اند)، پس شرط «سرور بدون
 * نصب چیزی اجرا شود» دست‌نخورده می‌ماند.
 */
import { MICRO_COURSE_SOURCES, MICRO_SUBJECT_OPTIONS } from '../src/data/micro/registry.js';
import { blocksToHtml } from '../src/data/micro/blocksToHtml.js';
import {
  DIFFICULTIES as TEST_BANK_DIFFICULTIES,
  QUESTIONS as TEST_BANK_QUESTIONS,
  SUBJECTS as TEST_BANK_SUBJECTS,
} from '../src/services/testBank/mockData.js';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const contentDir = resolve(databaseDir, 'content');
const uploadsDir = resolve(databaseDir, '..', 'public', 'uploads');

export const UPLOADS_URL_PREFIX = '/uploads';
export { sanitizeHtml };

/* ─────────────────────────── نقش‌ها و دسترسی‌ها ─────────────────────────── */

export const PERMISSIONS = [
  'articles.create', 'articles.read', 'articles.update', 'articles.delete', 'articles.publish',
  'categories.create', 'categories.update', 'categories.delete',
  'pages.create', 'pages.read', 'pages.update', 'pages.delete',
  /* کتابخانهٔ فلش‌کارت تپش — ساخت/ویرایش دک و کارت، انتشار در کتابخانهٔ عمومی */
  'flashcards.create', 'flashcards.read', 'flashcards.update', 'flashcards.delete', 'flashcards.publish',
  /* میکرو درسنامه — ویرایش ساختار درس، ایستگاه‌های تست و انتشار برای کاربران */
  'micro.create', 'micro.read', 'micro.update', 'micro.delete', 'micro.publish',
  'media.upload', 'media.read', 'media.delete',
  'banners.create', 'banners.update', 'banners.delete',
  'users.create', 'users.read', 'users.update', 'users.delete',
  'settings.read', 'settings.update',
  'logs.read',
  'notes.create', 'notes.read', 'notes.update', 'notes.delete',
  /* انتشار در کانال‌ها — مدیریت کانال و توکن جدا از حق ارسال است */
  'publishing.read', 'publishing.send', 'publishing.channels.manage',
  /*
   * مرکز رسانه و فضای مجازی — هفت مجوز مستقل.
   * تفکیک عمدی است: کسی که محتوا می‌نویسد با کسی که تأیید می‌کند و کسی که
   * توکن اپلیکیشن‌ها را می‌بیند یکی نیست.
   */
  'media.read',              /* ورود به مرکز، داشبورد، تحلیل، کتابخانه و گزارش */
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
    description: 'مدیریت محتوا و کاربران + تحلیل عمومی؛ بدون دادهٔ مالی و امنیتی',
    permissions: PERMISSIONS.filter(
      (permission) => permission !== 'users.delete' && !SENSITIVE_ANALYTICS.includes(permission),
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
      'micro.read', 'micro.create', 'micro.update', 'micro.publish',
      'media.upload', 'media.read', 'media.delete',
      'notes.create', 'notes.read', 'notes.update', 'notes.delete',
      'publishing.read', 'publishing.send',
      /* مرکز رسانه: می‌نویسد و منتشر می‌کند، ولی تأیید و کلید API دستش نیست */
      'media.read', 'media.content.manage', 'media.content.publish', 'media.ops.manage',
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
  /* میکرو درسنامه — هر رکورد یک درسنامهٔ کامل است: مبحث‌ها، واحدهای یادگیری،
     صفحه‌ها، بلوک‌های محتوا، ایستگاه‌های تست و مفاهیم. مثل فلش‌کارت، کل درسنامه
     یک موجودیت مدیریتی است و در یک رکورد می‌ماند تا انتشار اتمیک باشد. */
  'microCourses',
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

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function ensureFile(path, fallback) {
  ensureDir(dirname(path));
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify(fallback, null, 2), 'utf8');
  }
}

function readJson(path, fallback) {
  ensureFile(path, fallback);
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  ensureFile(path, Array.isArray(value) ? [] : {});
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
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
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf'],
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
  /* هرگز رمز واقعی در سورس هارد‌کد نمی‌شود؛ مقدار اولیه از env می‌آید. */
  const username = process.env.TAPESH_ADMIN_USERNAME || '0135';
  const password = process.env.TAPESH_ADMIN_PASSWORD || '0135';

  return [
    {
      id: makeId('adm'),
      username,
      name: process.env.TAPESH_ADMIN_NAME || 'مدیر تپش',
      email: process.env.TAPESH_ADMIN_EMAIL || '',
      passwordHash: hashPassword(password),
      role: 'super-admin',
      isActive: true,
      mustChangePassword: !process.env.TAPESH_ADMIN_PASSWORD,
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

  ensureFile(files.admins, seedAdmins());
  ensureFile(files.articles, seedArticles());
  ensureFile(files.categories, SEED_CATEGORIES);
  ensureFile(files.pages, seedPages());
  ensureFile(files.flashcardDecks, seedFlashcardDecks());
  ensureFile(files.microCourses, seedMicroCourses());
  /* پروژه‌های موجود فقط فیزیولوژی را داشتند؛ درس‌های غایب رجیستری اینجا اضافه می‌شوند */
  syncMicroCourses();
  ensureFile(files.media, []);
  ensureFile(files.banners, seedBanners());
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

  /* پیام خطای یکسان برای کاربر ناموجود و رمز اشتباه — جلوگیری از user enumeration */
  if (!admin || !admin.isActive || !verifyPassword(password, admin.passwordHash)) {
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

/* ─────────────────────── کتابخانهٔ فلش‌کارت تپش ─────────────────────── */

/*
 * شکل داده با قرارداد فلش‌کارت سمت کاربر (mockData) یکی است:
 *   دک   { title, description, subjectId, level, cover, shortTitle, anatomy, previewImage, status, cards[] }
 *   کارت { type: basic|cloze|mcq|image-locate, front, back, hint, tags[], image{url,alt,points[]}, options[], explanation }
 * دک تصویری (`anatomy: true`) کارت‌های image-locate دارد که روی تصویر نقطه مشخص می‌کنند.
 */

const FLASHCARD_CARD_TYPES = ['basic', 'cloze', 'mcq', 'image-locate'];

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
  const base = { status: 'published', createdAt: created, updatedAt: created, createdBy: 'seed', updatedBy: 'seed' };

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
export function searchTestBankQuestions({
  search = '', subjectId = '', topicPath = '', difficulty = 'all', limit = 40,
} = {}) {
  const query = normalizeSearch(search);
  const path = microText(topicPath, 120);
  const size = microInt(limit, 40, 1, 100);

  const matched = TEST_BANK_QUESTIONS.filter((question) => {
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

const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
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

export function createAdmin(input, actor = null) {
  const username = String(input.username ?? '').trim();
  const password = String(input.password ?? '');

  if (username.length < 3) throw Object.assign(new Error('نام کاربری حداقل ۳ کاراکتر باشد'), { code: 'VALIDATION_ERROR' });
  if (password.length < 4) throw Object.assign(new Error('رمز عبور حداقل ۴ کاراکتر باشد'), { code: 'VALIDATION_ERROR' });
  if (findAdminByUsername(username)) throw Object.assign(new Error('این نام کاربری قبلاً ثبت شده است'), { code: 'CONFLICT' });
  if (!ROLES[input.role]) throw Object.assign(new Error('نقش نامعتبر است'), { code: 'VALIDATION_ERROR' });

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

  if (input.role && !ROLES[input.role]) {
    throw Object.assign(new Error('نقش نامعتبر است'), { code: 'VALIDATION_ERROR' });
  }

  /* آخرین مدیر کل فعال نباید غیرفعال یا تنزل داده شود */
  const losingSuperAdmin =
    current.role === 'super-admin' &&
    ((input.role && input.role !== 'super-admin') || input.isActive === false);

  if (losingSuperAdmin) {
    const activeSuperAdmins = admins.filter(
      (admin) => admin.role === 'super-admin' && admin.isActive && admin.id !== id,
    ).length;
    if (activeSuperAdmins === 0) {
      throw Object.assign(new Error('حداقل یک مدیر کل فعال باید باقی بماند'), { code: 'CONFLICT' });
    }
  }

  if (input.password) {
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
    role: input.role ?? current.role,
    isActive: input.isActive ?? current.isActive,
    updatedAt: nowIso(),
    updatedBy: actor?.id ?? 'system',
  };

  writeCollection('admins', admins);
  return publicAdmin(admins[index]);
}

export function changeOwnPassword(id, { currentPassword, nextPassword }) {
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
  return { admin: publicAdmin(admins[index]) };
}

export function deleteAdmin(id, actorId) {
  if (id === actorId) {
    throw Object.assign(new Error('حساب خودتان را نمی‌توانید حذف کنید'), { code: 'CONFLICT' });
  }

  const admins = readCollection('admins');
  const target = admins.find((admin) => admin.id === id);
  if (!target) return null;

  const remainingSuperAdmins = admins.filter(
    (admin) => admin.role === 'super-admin' && admin.id !== id,
  ).length;

  if (target.role === 'super-admin' && remainingSuperAdmins === 0) {
    throw Object.assign(new Error('حداقل یک مدیر کل باید باقی بماند'), { code: 'CONFLICT' });
  }

  writeCollection('admins', admins.filter((admin) => admin.id !== id));
  return publicAdmin(target);
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
