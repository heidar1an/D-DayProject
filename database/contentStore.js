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

import { buildExcerpt, sanitizeHtml } from './sanitizeHtml.js';

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

const SEED_PAGES = [
  { title: 'درباره تپش', slug: 'about' },
  { title: 'تماس با ما', slug: 'contact' },
  { title: 'سوالات متداول', slug: 'faq' },
  { title: 'حریم خصوصی', slug: 'privacy' },
  { title: 'قوانین و مقررات', slug: 'terms' },
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
  return SEED_PAGES.map((page) => ({
    id: makeId('pg'),
    title: page.title,
    slug: page.slug,
    contentHtml: '<p>این صفحه هنوز محتوایی ندارد.</p>',
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
