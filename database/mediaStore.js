/*
 * انبار مرکز رسانه و فضای مجازی تپش.
 *
 * همان الگوی `contentStore.js` و `publishingStore.js`: فایل JSON روی دیسک +
 * توابع دامنهٔ خالص. با مهاجرت به Backend واقعی، فقط بدنهٔ همین توابع عوض
 * می‌شود — نه UI، نه مسیرها.
 *
 * ─── مدل داده ─────────────────────────────────────────────────────────
 *
 *   Platform  → کدام فضاهای مجازی تپش فعال است (اینستاگرام، تلگرام، ایتا …)
 *   Account   → اکانت/کانال زیر هر پلتفرم (سلسله‌مراتبی: یک پلتفرم، چند اکانت)
 *   Content   → محتوای رسانه‌ای + وضعیت + زمان‌بندی + گردش تأیید + سنجه
 *   Campaign  → کمپین و اهدافش
 *   TeamMember→ عضو تیم رسانه و محدودهٔ دسترسی‌اش
 *   Tag       → هشتگ و موضوع (kind)
 *   Metric    → عکس لحظه‌ای روزانهٔ سنجه‌ها به تفکیک اکانت
 *   InboxItem → پیام و تعامل
 *   Mention   → رصد نام و کلیدواژه
 *   Notification → اعلان داخلی
 *   UTMLink   → لینک ردیابی + نتیجهٔ واقعی‌اش
 *
 * ─── سه قاعدهٔ ثابت ───────────────────────────────────────────────────
 *
 *   ۱) **توکن و کلید اپ هرگز از سرور بیرون نمی‌رود.** در
 *      `database/media.secrets.json` با مجوز ۰۶۰۰ ذخیره می‌شوند؛ API فقط
 *      `hasToken` / `hasAppKeys` و یک راهنمای ماسک‌شده می‌دهد.
 *   ۲) **بدون توکن، هیچ درخواستی به بیرون نمی‌رود.** محتوا در حالت آزمایشی
 *      ثبت می‌شود و همان درخواستی که می‌رفت در تاریخچهٔ محتوا می‌ماند.
 *   ۳) **هیچ عدد ساختگی.** سنجه فقط از `mediaMetrics` (رکورد واقعی) یا از API
 *      پلتفرم می‌آید. جای خالی `null` می‌ماند، نه صفر.
 */

import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCollection, writeCollection, logActivity } from './contentStore.js';
import {
  PLATFORM_CATALOG,
  catalogById,
  hasAdapter,
  isKnownPlatform,
  platformMetrics,
  planPlatform,
  previewPlatformRequest,
  sendPlatform,
  summarizePlatform,
  verifyPlatform,
} from './publishers/index.js';
import { publish as publishToChannels, loadPublishMedia } from './publishingStore.js';
import {
  MEDIA_RANGES,
  buildOverview,
  compareToPeers,
  contentStats,
  contentTypeBreakdown,
  engagementRate,
  rankContents,
  resolveRange,
  tagPerformance,
  totalsByAccount,
} from './mediaInsights.js';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const secretsFile = resolve(databaseDir, 'media.secrets.json');

/* ─────────────────────────── ثابت‌های دامنه ─────────────────────────── */

/*
 * وضعیت‌های محتوا. `tone` تعیین می‌کند نشان در UI چه رنگی باشد — این جدول
 * تنها منبع حقیقت است، پس افزودن وضعیت تازه فقط یک سطر است.
 */
export const CONTENT_STATUSES = [
  { id: 'draft', label: 'پیش‌نویس', tone: 'neutral' },
  { id: 'review', label: 'در انتظار بررسی', tone: 'warn' },
  { id: 'approved', label: 'تأیید شده', tone: 'ok' },
  { id: 'scheduled', label: 'زمان‌بندی شده', tone: 'blue' },
  { id: 'publishing', label: 'در حال انتشار', tone: 'blue' },
  { id: 'published', label: 'منتشر شده', tone: 'ok' },
  { id: 'failed', label: 'انتشار ناموفق', tone: 'danger' },
  { id: 'cancelled', label: 'لغو شده', tone: 'muted' },
  { id: 'archived', label: 'آرشیو شده', tone: 'muted' },
];

/*
 * گردش کار تأیید. گذارهای مجاز همین‌جاست؛ هر تغییر وضعیت از این جدول رد
 * می‌شود تا نشود محتوایی را از «پیش‌نویس» یک‌راست به «منتشر شده» برد.
 */
export const CONTENT_TRANSITIONS = {
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

export const CONTENT_TYPES = [
  { id: 'post', label: 'پست', family: 'image' },
  { id: 'story', label: 'استوری', family: 'image' },
  { id: 'reel', label: 'ریلز', family: 'video' },
  { id: 'short', label: 'شورت', family: 'video' },
  { id: 'video', label: 'ویدئو', family: 'video' },
  { id: 'article', label: 'مقاله', family: 'text' },
  { id: 'thread', label: 'ترد', family: 'text' },
  { id: 'tweet', label: 'توییت', family: 'text' },
  { id: 'telegram-post', label: 'پست تلگرامی', family: 'text' },
  { id: 'announcement', label: 'اطلاعیه', family: 'text' },
  { id: 'poll', label: 'نظرسنجی', family: 'interactive' },
  { id: 'quiz', label: 'کوییز', family: 'interactive' },
  { id: 'carousel', label: 'کاروسل', family: 'image' },
  { id: 'infographic', label: 'اینفوگرافیک', family: 'image' },
  { id: 'podcast', label: 'پادکست', family: 'audio' },
  { id: 'live', label: 'زنده', family: 'video' },
];

export const ACCOUNT_KINDS = [
  { id: 'channel', label: 'کانال' },
  { id: 'page', label: 'صفحه' },
  { id: 'profile', label: 'پروفایل' },
  { id: 'group', label: 'گروه' },
  { id: 'site', label: 'سایت' },
  { id: 'show', label: 'برنامه' },
  { id: 'list', label: 'فهرست' },
];

/*
 * نقش‌های تیم رسانه و محدودهٔ کاری‌شان.
 * `scope` می‌گوید این نقش در مرکز رسانه چه کاری می‌تواند بکند؛ اگر عضو به یک
 * حساب مدیریتی وصل باشد (`adminId`)، دسترسی مؤثر از نقش آن حساب می‌آید و
 * همین محدوده فقط برای نمایش و تخصیص کار استفاده می‌شود.
 */
export const MEDIA_ROLES = [
  { id: 'admin', label: 'مدیر رسانه', scope: ['*'] },
  { id: 'media-manager', label: 'سرپرست رسانه', scope: ['media.read', 'media.content.manage', 'media.content.review', 'media.content.publish', 'media.team.manage', 'media.ops.manage'] },
  { id: 'content-manager', label: 'مدیر محتوا', scope: ['media.read', 'media.content.manage', 'media.content.review', 'media.content.publish'] },
  { id: 'writer', label: 'نویسنده', scope: ['media.read', 'media.content.manage'] },
  { id: 'designer', label: 'طراح گرافیک', scope: ['media.read', 'media.content.manage'] },
  { id: 'video-editor', label: 'تدوینگر ویدئو', scope: ['media.read', 'media.content.manage'] },
  { id: 'social-manager', label: 'مدیر شبکه‌های اجتماعی', scope: ['media.read', 'media.content.manage', 'media.content.publish', 'media.ops.manage'] },
  { id: 'reviewer', label: 'بازبین', scope: ['media.read', 'media.content.review'] },
  { id: 'analyst', label: 'تحلیلگر رسانه', scope: ['media.read', 'media.audit.read'] },
];

export const CAMPAIGN_STATUSES = [
  { id: 'planned', label: 'برنامه‌ریزی‌شده', tone: 'neutral' },
  { id: 'active', label: 'در حال اجرا', tone: 'ok' },
  { id: 'paused', label: 'متوقف', tone: 'warn' },
  { id: 'finished', label: 'پایان‌یافته', tone: 'muted' },
  { id: 'archived', label: 'آرشیو', tone: 'muted' },
];

export const INBOX_STATUSES = [
  { id: 'unread', label: 'خوانده‌نشده', tone: 'warn' },
  { id: 'read', label: 'خوانده‌شده', tone: 'neutral' },
  { id: 'pending', label: 'در انتظار پاسخ', tone: 'blue' },
  { id: 'answered', label: 'پاسخ داده‌شده', tone: 'ok' },
  { id: 'ignored', label: 'نادیده‌گرفته', tone: 'muted' },
  { id: 'important', label: 'مهم', tone: 'danger' },
];

export const INBOX_KINDS = [
  { id: 'comment', label: 'کامنت' },
  { id: 'dm', label: 'پیام مستقیم' },
  { id: 'message', label: 'پیام کانال' },
  { id: 'mention', label: 'منشن' },
];

export const NOTIFICATION_LEVELS = [
  { id: 'info', label: 'اطلاع', tone: 'neutral' },
  { id: 'success', label: 'موفق', tone: 'ok' },
  { id: 'warn', label: 'هشدار', tone: 'warn' },
  { id: 'critical', label: 'بحرانی', tone: 'danger' },
];

export const TAG_KINDS = [
  { id: 'hashtag', label: 'هشتگ' },
  { id: 'topic', label: 'موضوع' },
];

export const ASSET_KINDS = [
  { id: 'image', label: 'تصویر' },
  { id: 'video', label: 'ویدئو' },
  { id: 'audio', label: 'صدا' },
  { id: 'thumbnail', label: 'بندانگشتی' },
  { id: 'logo', label: 'لوگو' },
  { id: 'poster', label: 'پوستر' },
  { id: 'infographic', label: 'اینفوگرافیک' },
  { id: 'gif', label: 'گیف' },
  { id: 'document', label: 'سند' },
];

export const UTM_MEDIUMS = [
  { id: 'social', label: 'شبکهٔ اجتماعی' },
  { id: 'social-paid', label: 'تبلیغات شبکه‌ای' },
  { id: 'email', label: 'ایمیل' },
  { id: 'referral', label: 'ارجاع' },
  { id: 'qr', label: 'کیوآر' },
];

export const MEDIA_ENTITY_TYPES = [
  'media-platform', 'media-account', 'media-content', 'media-campaign',
  'media-team', 'media-asset', 'media-tag', 'media-utm', 'media-inbox',
  'media-mention', 'media-notification',
];

/* ───────────────────────────── ابزار پایه ───────────────────────────── */

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function fail(message, code = 'VALIDATION_ERROR') {
  throw Object.assign(new Error(message), { code });
}

function trim(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function bool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function num(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* ─────────────────── توکن و کلید اپ (فایل جدا، ۰۶۰۰) ─────────────────── */

function readSecrets() {
  if (!existsSync(secretsFile)) return { version: 1, accounts: {} };
  try {
    const parsed = JSON.parse(readFileSync(secretsFile, 'utf8'));
    return { version: 1, accounts: parsed?.accounts ?? {} };
  } catch {
    return { version: 1, accounts: {} };
  }
}

function writeSecrets(secrets) {
  /*
   * نوشتن اتمیک (tmp → rename) — فاز ۶ (آمادگی چند‌پروسه‌ای). توضیح کامل در
   * `publishingStore.writeSecrets`؛ همان ریسک اینجا هم بود: مرگ پروسه در میانهٔ
   * نوشتن ⇒ فایل نیمه‌نوشته ⇒ `readSecrets` بی‌صدا همهٔ credentialها را از دست می‌داد.
   */
  const tmp = `${secretsFile}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(secrets, null, 2), 'utf8');
  try {
    chmodSync(tmp, 0o600);
  } catch {
    /* روی برخی فایل‌سیستم‌ها chmod معنا ندارد؛ ذخیره انجام شده است */
  }
  renameSync(tmp, secretsFile);
}

function storedCredentials(accountId) {
  const entry = readSecrets().accounts?.[accountId] ?? {};
  return {
    token: String(entry.token ?? '').trim(),
    appId: String(entry.appId ?? '').trim(),
    appSecret: String(entry.appSecret ?? '').trim(),
  };
}

function maskHint(secret) {
  if (!secret) return '';
  return `••••${secret.slice(-4)}`;
}

/*
 * اعتبار مؤثر یک اکانت: اول اعتبار خود اکانت، بعد متغیر محیطی پلتفرم.
 * اگر اکانت به یک کانال انتشار وصل باشد، توکن از همان کانال می‌آید — یعنی
 * «کانال بله که از قبل ثبت شده» بدون ثبت دوبارهٔ توکن کار می‌کند.
 */
function resolveAccountCredentials(account) {
  const own = storedCredentials(account.id);
  if (own.token) return { ...own, source: 'account' };

  const platform = catalogById(account.platform);
  const fromEnv = platform?.tokenEnv ? String(process.env[platform.tokenEnv] ?? '').trim() : '';
  if (fromEnv) return { token: fromEnv, appId: own.appId, appSecret: own.appSecret, source: 'env' };

  if (account.publishChannelId) {
    const channel = readCollection('publishChannels').find((row) => row.id === account.publishChannelId);
    if (channel) {
      const { token } = channelTokenState(channel.id);
      if (token) return { token, appId: own.appId, appSecret: own.appSecret, source: 'channel' };
    }
  }

  return { token: '', appId: own.appId, appSecret: own.appSecret, source: 'none' };
}

/*
 * توکن یک کانال انتشار از فایل جداگانهٔ انتشار خوانده می‌شود. این تابع عمداً
 * خودش فایل را می‌خواند تا `publishingStore` وابسته به مرکز رسانه نشود
 * (جهت وابستگی یک‌طرفه بماند).
 */
function channelTokenState(channelId) {
  const file = resolve(databaseDir, 'publishing.secrets.json');
  if (!existsSync(file)) return { token: '' };
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return { token: String(parsed?.tokens?.[channelId] ?? '').trim() };
  } catch {
    return { token: '' };
  }
}

/* ─────────────────────────── ثبت رویداد رسانه ─────────────────────────── */

/*
 * همهٔ رویدادهای مرکز رسانه در همان مجموعهٔ `activity` پروژه ثبت می‌شوند
 * (با entityTypeهایی مثل `media-content`) و بخش «گزارش رویدادها» فقط همان‌ها
 * را فیلتر می‌کند. یک منبع حقیقت، دو نما — نه دو لاگ موازی که واگرا شوند.
 */
function mediaAudit(admin, { action, entityType, entityId = null, entityLabel = '', detail = null }) {
  return logActivity({
    admin,
    action,
    entityType,
    entityId,
    entityLabel,
    metadata: detail ?? undefined,
  });
}

/* ───────────────────────────── پلتفرم‌ها ───────────────────────────── */

function platformRecord(platformId) {
  return readCollection('mediaPlatforms').find((row) => row.id === platformId) ?? null;
}

/*
 * نمای پلتفرم = توصیف کاتالوگ + تنظیمات مدیر + آمار واقعی.
 * اگر پلتفرمی هنوز تنظیم نشده باشد، مقادیر پیش‌فرض کاتالوگ استفاده می‌شود تا
 * کاربر بتواند همان‌جا فعالش کند.
 */
export function listPlatforms() {
  const records = readCollection('mediaPlatforms');
  const accounts = readCollection('mediaAccounts');
  const metrics = readCollection('mediaMetrics');
  const contents = readCollection('mediaContents');

  return PLATFORM_CATALOG.map((catalog) => {
    const record = records.find((row) => row.id === catalog.id) ?? null;
    const platformAccounts = accounts.filter((account) => account.platform === catalog.id);
    const accountIds = platformAccounts.map((account) => account.id);
    const platformMetricsRows = metrics.filter((row) => accountIds.includes(row.accountId));

    /* دنبال‌کننده: آخرین عکس هر اکانت، نه جمع بازه */
    const latestByAccount = new Map();
    platformMetricsRows.forEach((row) => {
      const current = latestByAccount.get(row.accountId);
      if (!current || String(row.date) > String(current.date)) latestByAccount.set(row.accountId, row);
    });

    const followers = [...latestByAccount.values()].reduce((total, row) => total + (Number(row.followers) || 0), 0);
    const hasFollowers = [...latestByAccount.values()].some((row) => Number.isFinite(row.followers));

    const connectedAccounts = platformAccounts.filter((account) => resolveAccountCredentials(account).token).length;

    return {
      id: catalog.id,
      label: record?.label ?? catalog.label,
      family: catalog.family,
      accent: catalog.accent,
      adapter: catalog.adapter,
      capabilities: catalog.capabilities,
      metrics: catalog.metrics,
      contentTypes: catalog.contentTypes,
      kinds: catalog.kinds,
      /* تنظیمات مدیر */
      isActive: record ? record.isActive !== false : false,
      description: record?.description ?? '',
      logo: record?.logo ?? '',
      managerId: record?.managerId ?? null,
      startedAt: record?.startedAt ?? null,
      notes: record?.notes ?? '',
      configured: Boolean(record),
      /* وضعیت اتصال API */
      apiStatus: !catalog.adapter ? 'manual' : connectedAccounts > 0 ? 'connected' : 'not-connected',
      /* آمار واقعی */
      accountCount: platformAccounts.length,
      activeAccountCount: platformAccounts.filter((account) => account.isActive !== false).length,
      connectedAccounts,
      followers: hasFollowers ? followers : null,
      contentCount: contents.filter((content) => content.platform === catalog.id).length,
      publishedCount: contents.filter((content) => content.platform === catalog.id && content.status === 'published').length,
      updatedAt: record?.updatedAt ?? null,
    };
  });
}

export function savePlatform(input, admin = null) {
  const platformId = trim(input.platform ?? input.id, 40);
  if (!isKnownPlatform(platformId)) fail('پلتفرم شناخته‌شده نیست');

  const catalog = catalogById(platformId);
  const records = readCollection('mediaPlatforms');
  const index = records.findIndex((row) => row.id === platformId);
  const created = nowIso();

  const payload = {
    id: platformId,
    label: trim(input.label, 60) || catalog.label,
    isActive: bool(input.isActive, true),
    description: trim(input.description, 400),
    logo: trim(input.logo, 300),
    managerId: input.managerId ? trim(input.managerId, 60) : null,
    startedAt: input.startedAt ? String(input.startedAt).slice(0, 10) : null,
    notes: trim(input.notes, 600),
    updatedAt: created,
  };

  if (index === -1) {
    records.push({ ...payload, createdAt: created, createdBy: admin?.id ?? 'system', createdByName: admin?.name || admin?.username || '' });
  } else {
    records[index] = { ...records[index], ...payload };
  }

  writeCollection('mediaPlatforms', records);
  return listPlatforms().find((row) => row.id === platformId);
}

export function deletePlatform(platformId, admin = null) {
  const records = readCollection('mediaPlatforms');
  const target = records.find((row) => row.id === platformId);
  if (!target) return null;

  const accounts = readCollection('mediaAccounts').filter((row) => row.platform === platformId);
  if (accounts.length) fail('اول اکانت‌های این پلتفرم را حذف یا منتقل کنید', 'CONFLICT');

  writeCollection('mediaPlatforms', records.filter((row) => row.id !== platformId));
  return target;
}

/* ────────────────────────── اکانت‌ها و کانال‌ها ────────────────────────── */

/* نمای عمومی اکانت — بدون توکن، فقط وضعیت اعتبار */
export function publicAccount(account) {
  const credentials = resolveAccountCredentials(account);
  const catalog = catalogById(account.platform);

  return {
    id: account.id,
    platform: account.platform,
    platformLabel: catalog?.label ?? account.platform,
    platformFamily: catalog?.family ?? 'social',
    name: account.name,
    handle: account.handle ?? '',
    url: account.url ?? '',
    externalId: account.externalId ?? '',
    internalId: account.internalId ?? '',
    kind: account.kind ?? 'channel',
    isActive: account.isActive !== false,
    avatar: account.avatar ?? '',
    description: account.description ?? '',
    managerId: account.managerId ?? null,
    memberIds: account.memberIds ?? [],
    startedAt: account.startedAt ?? null,
    lastActivityAt: account.lastActivityAt ?? null,
    audience: account.audience ?? { followers: null, following: null, posts: null },
    metrics: account.metrics ?? null,
    /* وضعیت اعتبار — نه خود اعتبار */
    hasToken: Boolean(credentials.token),
    hasAppKeys: Boolean(credentials.appId && credentials.appSecret),
    tokenSource: credentials.source,
    tokenHint: maskHint(credentials.token),
    appIdHint: maskHint(credentials.appId),
    tokenEnv: catalog?.tokenEnv ?? '',
    needsAppKeys: catalog?.apiKind === 'graph',
    adapter: Boolean(hasAdapter(account.platform)),
    capabilities: catalog?.capabilities ?? {},
    publishChannelId: account.publishChannelId ?? null,
    lastSyncAt: account.lastSyncAt ?? null,
    lastSyncStatus: account.lastSyncStatus ?? null,
    lastSyncMessage: account.lastSyncMessage ?? '',
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    createdByName: account.createdByName ?? '',
  };
}

export function listAccounts({ platform = 'all', search = '', kind = 'all', active = 'all' } = {}) {
  const needle = String(search ?? '').trim().toLowerCase();

  return readCollection('mediaAccounts')
    .filter((account) => {
      if (platform !== 'all' && account.platform !== platform) return false;
      if (kind !== 'all' && account.kind !== kind) return false;
      if (active === 'active' && account.isActive === false) return false;
      if (active === 'inactive' && account.isActive !== false) return false;
      if (needle && !`${account.name} ${account.handle} ${account.externalId} ${account.internalId}`.toLowerCase().includes(needle)) return false;
      return true;
    })
    .map(publicAccount)
    .sort((a, b) => `${a.platformLabel} ${a.name}`.localeCompare(`${b.platformLabel} ${b.name}`));
}

export function getAccount(id) {
  return readCollection('mediaAccounts').find((row) => row.id === id) ?? null;
}

function accountPayload(input, existing = null) {
  const platform = trim(input.platform ?? existing?.platform, 40);
  if (!isKnownPlatform(platform)) fail('پلتفرم انتخاب‌شده شناخته‌شده نیست');

  const name = trim(input.name ?? '', 80);
  if (!name) fail('نام اکانت الزامی است');

  return {
    platform,
    name,
    handle: trim(input.handle, 80),
    url: trim(input.url, 400),
    externalId: trim(input.externalId, 160),
    internalId: trim(input.internalId, 80),
    kind: ACCOUNT_KINDS.some((row) => row.id === input.kind) ? input.kind : 'channel',
    isActive: bool(input.isActive, true),
    avatar: trim(input.avatar, 400),
    description: trim(input.description, 600),
    managerId: input.managerId ? trim(input.managerId, 60) : null,
    memberIds: Array.isArray(input.memberIds) ? input.memberIds.map((id) => String(id)).slice(0, 30) : [],
    startedAt: input.startedAt ? String(input.startedAt).slice(0, 10) : null,
    publishChannelId: input.publishChannelId ? trim(input.publishChannelId, 60) : null,
    audience: {
      followers: num(input.audience?.followers),
      following: num(input.audience?.following),
      posts: num(input.audience?.posts),
    },
    metrics: input.metrics && typeof input.metrics === 'object' ? {
      views: num(input.metrics.views),
      reach: num(input.metrics.reach),
      impressions: num(input.metrics.impressions),
      engagement: num(input.metrics.engagement),
      clicks: num(input.metrics.clicks),
    } : (existing?.metrics ?? null),
  };
}

export function createAccount(input, admin = null) {
  const accounts = readCollection('mediaAccounts');
  const created = nowIso();

  const account = {
    id: makeId('acc'),
    ...accountPayload(input),
    lastActivityAt: null,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncMessage: '',
    createdAt: created,
    updatedAt: created,
    createdBy: admin?.id ?? 'system',
    createdByName: admin?.name || admin?.username || '',
  };

  accounts.push(account);
  writeCollection('mediaAccounts', accounts);
  return publicAccount(account);
}

export function updateAccount(id, input, admin = null) {
  const accounts = readCollection('mediaAccounts');
  const index = accounts.findIndex((row) => row.id === id);
  if (index === -1) return null;

  accounts[index] = {
    ...accounts[index],
    ...accountPayload({ ...accounts[index], ...input }, accounts[index]),
    updatedAt: nowIso(),
    updatedByName: admin?.name || admin?.username || '',
  };

  writeCollection('mediaAccounts', accounts);
  return publicAccount(accounts[index]);
}

export function deleteAccount(id) {
  const accounts = readCollection('mediaAccounts');
  const target = accounts.find((row) => row.id === id);
  if (!target) return null;

  const contents = readCollection('mediaContents').filter((row) => row.accountId === id);
  if (contents.length) fail('این اکانت محتوا دارد؛ اول محتواها را منتقل یا حذف کنید', 'CONFLICT');

  writeCollection('mediaAccounts', accounts.filter((row) => row.id !== id));

  /* اعتبار اکانت حذف‌شده هم باید برود؛ وگرنه در فایل بی‌صاحب می‌ماند */
  const secrets = readSecrets();
  if (secrets.accounts?.[id]) {
    delete secrets.accounts[id];
    writeSecrets(secrets);
  }

  return publicAccount(target);
}

/*
 * ثبت اعتبار اکانت. توکن/کلید خالی = پاک‌کردن مقدار قبلی.
 * خروجی هرگز خودِ مقدار را ندارد.
 */
export function setAccountCredentials(id, { token, appId, appSecret } = {}) {
  const account = getAccount(id);
  if (!account) return null;

  const secrets = readSecrets();
  secrets.accounts = secrets.accounts ?? {};

  const current = secrets.accounts[id] ?? {};
  const next = {
    token: token === undefined ? String(current.token ?? '') : trim(token, 400),
    appId: appId === undefined ? String(current.appId ?? '') : trim(appId, 200),
    appSecret: appSecret === undefined ? String(current.appSecret ?? '') : trim(appSecret, 300),
  };

  if (next.token || next.appId || next.appSecret) secrets.accounts[id] = next;
  else delete secrets.accounts[id];

  writeSecrets(secrets);

  const publicRow = publicAccount(account);
  return {
    id,
    hasToken: publicRow.hasToken,
    hasAppKeys: publicRow.hasAppKeys,
    tokenHint: publicRow.tokenHint,
    appIdHint: publicRow.appIdHint,
    tokenSource: publicRow.tokenSource,
  };
}

/* تست اعتبار اکانت ذخیره‌شده — با اعتبار مؤثرش، بدون ارسال چیزی */
export async function testAccountConnection(id) {
  const account = getAccount(id);
  if (!account) return null;

  const credentials = resolveAccountCredentials(account);

  if (!credentials.token) {
    return {
      ok: false,
      complete: false,
      status: 'no-token',
      tokenSource: credentials.source,
      checks: [{ id: 'token', label: 'توکن', ok: false, message: 'برای این اکانت توکنی ثبت نشده است' }],
    };
  }

  const result = await verifyPlatform({
    platform: account.platform,
    token: credentials.token,
    target: account.externalId,
    appId: credentials.appId,
  });

  return { ...result, status: result.complete ? 'ok' : 'failed', tokenSource: credentials.source };
}

/* تست اعتبار پیش از ذخیره — توکن از بدنهٔ فرم می‌آید، نه از اکانت */
export async function testAccountDraft({ platform, token, externalId, appId } = {}) {
  const result = await verifyPlatform({ platform, token, target: externalId, appId });
  return { ...result, status: result.complete ? 'ok' : 'failed' };
}

/*
 * همگام‌سازی سنجهٔ یک اکانت.
 * قاعدهٔ صادقانه: فقط چیزی که پلتفرم واقعاً بدهد ذخیره می‌شود. اگر آداپتور
 * نداشته باشد یا API عددی ندهد، `unsupported` برمی‌گردد و عددی نوشته نمی‌شود.
 */
export async function syncAccount(id, { admin = null } = {}) {
  const account = getAccount(id);
  if (!account) return null;

  const credentials = resolveAccountCredentials(account);
  const accounts = readCollection('mediaAccounts');
  const index = accounts.findIndex((row) => row.id === id);
  const stamp = nowIso();

  const write = (patch) => {
    accounts[index] = { ...accounts[index], ...patch, updatedAt: stamp };
    writeCollection('mediaAccounts', accounts);
  };

  if (!hasAdapter(account.platform)) {
    write({ lastSyncAt: stamp, lastSyncStatus: 'manual', lastSyncMessage: 'این پلتفرم آداپتور ندارد؛ داده دستی ثبت می‌شود' });
    return { id, status: 'manual', metrics: null, syncedAt: stamp, message: 'این پلتفرم آداپتور API ندارد؛ اعداد را دستی ثبت کنید' };
  }

  if (!credentials.token) {
    write({ lastSyncAt: stamp, lastSyncStatus: 'no-token', lastSyncMessage: 'توکن ثبت نشده است' });
    return { id, status: 'no-token', metrics: null, syncedAt: stamp, message: 'توکن ثبت نشده است' };
  }

  const metrics = await platformMetrics({ platform: account.platform, token: credentials.token, target: account.externalId });

  if (!metrics) {
    write({ lastSyncAt: stamp, lastSyncStatus: 'unsupported', lastSyncMessage: 'API این پلتفرم سنجه برنمی‌گرداند' });
    return { id, status: 'unsupported', metrics: null, syncedAt: stamp, message: 'API این پلتفرم سنجه برنمی‌گرداند' };
  }

  /* سنجهٔ خوانده‌شده در همان روز، رکورد روزانه را به‌روز می‌کند (upsert) */
  saveMetrics({
    date: dayKey(new Date()),
    platform: account.platform,
    accountId: account.id,
    source: 'api',
    ...metrics,
  });

  write({
    lastSyncAt: stamp,
    lastSyncStatus: 'ok',
    lastSyncMessage: '',
    lastActivityAt: stamp,
    audience: {
      followers: Number.isFinite(metrics.followers) ? metrics.followers : accounts[index].audience?.followers ?? null,
      following: Number.isFinite(metrics.following) ? metrics.following : accounts[index].audience?.following ?? null,
      posts: Number.isFinite(metrics.posts) ? metrics.posts : accounts[index].audience?.posts ?? null,
    },
  });

  return { id, status: 'ok', metrics, syncedAt: stamp, message: '' };
}

export async function syncAllAccounts({ platform = 'all', admin = null } = {}) {
  const accounts = readCollection('mediaAccounts').filter((account) => (
    platform === 'all' || account.platform === platform
  ));

  const results = [];
  for (const account of accounts) {
    results.push(await syncAccount(account.id, { admin }));
  }

  return {
    results,
    synced: results.filter((row) => row.status === 'ok').length,
    manual: results.filter((row) => row.status === 'manual').length,
    noToken: results.filter((row) => row.status === 'no-token').length,
    unsupported: results.filter((row) => row.status === 'unsupported').length,
  };
}

/*
 * وارد کردن کانال‌های انتشار موجود به‌عنوان اکانت رسانه.
 * این همان «ادغام بخشی که از قبل طراحی شده» است: کانال بله‌ای که توکنش ثبت
 * شده، بدون ثبت دوبارهٔ توکن به‌عنوان اکانت مرکز رسانه شناخته می‌شود و
 * `publishChannelId` به آن وصل می‌ماند.
 */
export function importPublishChannels(admin = null) {
  const channels = readCollection('publishChannels');
  const accounts = readCollection('mediaAccounts');
  const stamp = nowIso();
  const created = [];

  channels.forEach((channel) => {
    const exists = accounts.some((account) => account.publishChannelId === channel.id
      || (account.platform === channel.platform && account.externalId === channel.chatId));
    if (exists) return;

    const account = {
      id: makeId('acc'),
      platform: channel.platform,
      name: channel.name,
      handle: channel.chatId.startsWith('@') ? channel.chatId : '',
      url: '',
      externalId: channel.chatId,
      internalId: '',
      kind: 'channel',
      isActive: channel.isActive !== false,
      avatar: '',
      description: channel.note ?? '',
      managerId: null,
      memberIds: [],
      startedAt: null,
      publishChannelId: channel.id,
      audience: { followers: null, following: null, posts: null },
      metrics: null,
      lastActivityAt: null,
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncMessage: '',
      createdAt: stamp,
      updatedAt: stamp,
      createdBy: admin?.id ?? 'system',
      createdByName: 'ورود از کانال‌های انتشار',
    };

    accounts.push(account);
    created.push(account);
  });

  if (created.length) writeCollection('mediaAccounts', accounts);

  return { created: created.length, accounts: created.map(publicAccount) };
}

/* ─────────────────────────────── محتوا ─────────────────────────────── */

function publicContent(content, context = {}) {
  const account = context.accounts?.find((row) => row.id === content.accountId) ?? null;
  const campaign = context.campaigns?.find((row) => row.id === content.campaignId) ?? null;
  const author = context.team?.find((row) => row.id === content.authorId) ?? null;
  const reviewer = context.team?.find((row) => row.id === content.reviewerId) ?? null;
  const catalog = catalogById(content.platform);

  return {
    id: content.id,
    title: content.title,
    caption: content.caption ?? '',
    contentType: content.contentType ?? 'post',
    platform: content.platform,
    platformLabel: catalog?.label ?? content.platform,
    accountId: content.accountId ?? null,
    accountName: account?.name ?? '',
    campaignId: content.campaignId ?? null,
    campaignName: campaign?.name ?? '',
    tagIds: content.tagIds ?? [],
    hashtags: content.hashtags ?? [],
    mentions: content.mentions ?? [],
    links: content.links ?? [],
    cta: content.cta ?? '',
    assets: content.assets ?? [],
    thumbnail: content.thumbnail ?? '',
    status: content.status,
    scheduledAt: content.scheduledAt ?? null,
    publishedAt: content.publishedAt ?? null,
    timezone: content.timezone ?? 'Asia/Tehran',
    authorId: content.authorId ?? null,
    authorName: author?.name ?? content.authorName ?? '',
    reviewerId: content.reviewerId ?? null,
    reviewerName: reviewer?.name ?? '',
    utmId: content.utmId ?? null,
    metrics: content.metrics ?? null,
    engagementRate: engagementRate(content.metrics),
    publishResult: content.publishResult ?? null,
    rejection: content.rejection ?? null,
    history: content.history ?? [],
    notes: content.notes ?? '',
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
    createdByName: content.createdByName ?? '',
  };
}

function mediaContext() {
  return {
    accounts: readCollection('mediaAccounts'),
    campaigns: readCollection('mediaCampaigns'),
    team: readCollection('mediaTeam'),
  };
}

export function listContents({
  search = '', status = 'all', platform = 'all', accountId = 'all', campaignId = 'all',
  contentType = 'all', authorId = 'all', from = null, to = null, sort = 'newest',
  page = 1, perPage = 20,
} = {}) {
  const needle = String(search ?? '').trim().toLowerCase();
  const context = mediaContext();

  const rows = readCollection('mediaContents')
    .filter((content) => {
      if (status !== 'all' && content.status !== status) return false;
      if (platform !== 'all' && content.platform !== platform) return false;
      if (accountId !== 'all' && content.accountId !== accountId) return false;
      if (campaignId !== 'all' && content.campaignId !== campaignId) return false;
      if (contentType !== 'all' && content.contentType !== contentType) return false;
      if (authorId !== 'all' && content.authorId !== authorId) return false;

      if (from || to) {
        const stamp = content.scheduledAt ?? content.publishedAt ?? content.createdAt;
        const time = new Date(stamp).getTime();
        if (from && time < new Date(from).getTime()) return false;
        if (to && time > new Date(to).getTime()) return false;
      }

      if (needle) {
        const haystack = `${content.title} ${content.caption} ${(content.hashtags ?? []).join(' ')}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    })
    .map((content) => publicContent(content, context));

  const sorters = {
    newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    oldest: (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)),
    schedule: (a, b) => String(a.scheduledAt ?? '9999').localeCompare(String(b.scheduledAt ?? '9999')),
    published: (a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')),
    engagement: (a, b) => (b.metrics?.engagement ?? -1) - (a.metrics?.engagement ?? -1),
    reach: (a, b) => (b.metrics?.reach ?? -1) - (a.metrics?.reach ?? -1),
    title: (a, b) => a.title.localeCompare(b.title),
  };

  rows.sort(sorters[sort] ?? sorters.newest);

  const size = Math.min(Math.max(Number(perPage) || 20, 1), 200);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(Number(page) || 1, 1), pages);
  const start = (current - 1) * size;

  return { items: rows.slice(start, start + size), total: rows.length, page: current, perPage: size, pages };
}

export function getContent(id) {
  const content = readCollection('mediaContents').find((row) => row.id === id);
  if (!content) return null;
  return publicContent(content, mediaContext());
}

/* محتوای خام برای عملیات داخلی (با history کامل) */
function rawContent(id) {
  return readCollection('mediaContents').find((row) => row.id === id) ?? null;
}

/* محتوای یک روز مشخص — برای تقویم محتوایی */
export function contentCalendar({ from, to } = {}) {
  const context = mediaContext();
  const rows = readCollection('mediaContents').filter((content) => {
    const stamp = content.scheduledAt ?? content.publishedAt;
    if (!stamp) return false;
    const time = new Date(stamp).getTime();
    if (from && time < new Date(from).getTime()) return false;
    if (to && time > new Date(to).getTime()) return false;
    return true;
  });

  return {
    items: rows.map((content) => publicContent(content, context)),
    range: { from: from ?? null, to: to ?? null },
  };
}

function contentPayload(input, existing = null) {
  const title = trim(input.title ?? existing?.title, 160);
  if (!title) fail('عنوان داخلی محتوا الزامی است');

  const platform = trim(input.platform ?? existing?.platform, 40);
  if (!isKnownPlatform(platform)) fail('پلتفرم محتوا را انتخاب کنید');

  const contentType = CONTENT_TYPES.some((row) => row.id === input.contentType)
    ? input.contentType
    : (existing?.contentType ?? 'post');

  const scheduledAt = input.scheduledAt !== undefined
    ? (input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null)
    : (existing?.scheduledAt ?? null);

  if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) fail('تاریخ انتشار معتبر نیست');

  return {
    title,
    caption: trim(input.caption ?? existing?.caption, 8000),
    contentType,
    platform,
    accountId: input.accountId !== undefined ? (input.accountId || null) : (existing?.accountId ?? null),
    campaignId: input.campaignId !== undefined ? (input.campaignId || null) : (existing?.campaignId ?? null),
    tagIds: Array.isArray(input.tagIds) ? input.tagIds.map((id) => String(id)).slice(0, 20) : (existing?.tagIds ?? []),
    hashtags: Array.isArray(input.hashtags)
      ? input.hashtags.map((tag) => trim(tag, 60).replace(/^#/, '')).filter(Boolean).slice(0, 30)
      : (existing?.hashtags ?? []),
    mentions: Array.isArray(input.mentions) ? input.mentions.map((item) => trim(item, 60)).filter(Boolean).slice(0, 30) : (existing?.mentions ?? []),
    links: Array.isArray(input.links) ? input.links.map((item) => trim(item, 500)).filter(Boolean).slice(0, 10) : (existing?.links ?? []),
    cta: trim(input.cta ?? existing?.cta, 200),
    assets: Array.isArray(input.assets) ? input.assets.map((asset) => ({
      mediaId: asset.mediaId ? String(asset.mediaId) : null,
      url: trim(asset.url, 400),
      filename: trim(asset.filename, 200),
      mimeType: trim(asset.mimeType, 120),
      kind: trim(asset.kind, 40) || 'image',
    })).slice(0, 20) : (existing?.assets ?? []),
    thumbnail: trim(input.thumbnail ?? existing?.thumbnail, 400),
    scheduledAt,
    timezone: trim(input.timezone ?? existing?.timezone, 60) || 'Asia/Tehran',
    authorId: input.authorId !== undefined ? (input.authorId || null) : (existing?.authorId ?? null),
    reviewerId: input.reviewerId !== undefined ? (input.reviewerId || null) : (existing?.reviewerId ?? null),
    utmId: input.utmId !== undefined ? (input.utmId || null) : (existing?.utmId ?? null),
    notes: trim(input.notes ?? existing?.notes, 2000),
  };
}

export function createContent(input, admin = null) {
  const contents = readCollection('mediaContents');
  const created = nowIso();

  const content = {
    id: makeId('cnt'),
    ...contentPayload(input),
    status: CONTENT_STATUSES.some((row) => row.id === input.status) ? input.status : 'draft',
    publishedAt: null,
    metrics: null,
    publishResult: null,
    rejection: null,
    history: [{
      at: created,
      byId: admin?.id ?? 'system',
      byName: admin?.name || admin?.username || '',
      from: null,
      to: input.status ?? 'draft',
      action: 'created',
      note: '',
    }],
    createdAt: created,
    updatedAt: created,
    createdBy: admin?.id ?? 'system',
    createdByName: admin?.name || admin?.username || '',
  };

  contents.push(content);
  writeCollection('mediaContents', contents);

  rebuildTagUsage();
  return publicContent(content, mediaContext());
}

export function updateContent(id, input, admin = null) {
  const contents = readCollection('mediaContents');
  const index = contents.findIndex((row) => row.id === id);
  if (index === -1) return null;

  contents[index] = {
    ...contents[index],
    ...contentPayload({ ...contents[index], ...input }, contents[index]),
    updatedAt: nowIso(),
  };

  writeCollection('mediaContents', contents);
  rebuildTagUsage();
  return publicContent(contents[index], mediaContext());
}

export function deleteContent(id, admin = null) {
  const contents = readCollection('mediaContents');
  const target = contents.find((row) => row.id === id);
  if (!target) return null;

  writeCollection('mediaContents', contents.filter((row) => row.id !== id));
  rebuildTagUsage();
  return publicContent(target, mediaContext());
}

/*
 * تغییر وضعیت با اعتبارسنجی گذار.
 * اگر گذار مجاز نباشد، خطای روشن می‌دهد — نه اینکه بی‌صدا رد شود.
 */
export function setContentStatus(id, nextStatus, { admin = null, note = '', force = false } = {}) {
  const contents = readCollection('mediaContents');
  const index = contents.findIndex((row) => row.id === id);
  if (index === -1) return null;

  const content = contents[index];
  if (!CONTENT_STATUSES.some((row) => row.id === nextStatus)) fail('وضعیت نامعتبر است');

  const allowed = CONTENT_TRANSITIONS[content.status] ?? [];
  if (!force && content.status !== nextStatus && !allowed.includes(nextStatus)) {
    const fromLabel = CONTENT_STATUSES.find((row) => row.id === content.status)?.label ?? content.status;
    const toLabel = CONTENT_STATUSES.find((row) => row.id === nextStatus)?.label ?? nextStatus;
    fail(`گذار از «${fromLabel}» به «${toLabel}» مجاز نیست`, 'CONFLICT');
  }

  const stamp = nowIso();
  const entry = {
    at: stamp,
    byId: admin?.id ?? 'system',
    byName: admin?.name || admin?.username || '',
    from: content.status,
    to: nextStatus,
    action: 'status-changed',
    note: trim(note, 400),
  };

  contents[index] = {
    ...content,
    status: nextStatus,
    publishedAt: nextStatus === 'published' ? (content.publishedAt ?? stamp) : content.publishedAt,
    /* با خروج از وضعیت ناموفق، خطای قبلی پاک می‌شود تا گمراه نکند */
    publishResult: nextStatus === 'failed' ? content.publishResult : null,
    rejection: nextStatus === 'approved' ? null : content.rejection,
    updatedAt: stamp,
    history: [...(content.history ?? []), entry].slice(-60),
  };

  writeCollection('mediaContents', contents);
  return publicContent(contents[index], mediaContext());
}

/* درخواست بررسی — گذار صریح draft → review با ثبت مسئول بازبینی */
export function submitContentForReview(id, { admin = null, reviewerId = null, note = '' } = {}) {
  const contents = readCollection('mediaContents');
  const index = contents.findIndex((row) => row.id === id);
  if (index === -1) return null;

  contents[index] = {
    ...contents[index],
    reviewerId: reviewerId ?? contents[index].reviewerId ?? null,
    updatedAt: nowIso(),
  };
  writeCollection('mediaContents', contents);

  return setContentStatus(id, 'review', { admin, note: note || 'ارسال برای بررسی' });
}

/*
 * درخواست اصلاح. دلیل، توضیح و زمان — همان چیزی که خواسته شد.
 * وضعیت به «پیشنویس» برمی‌گردد تا نویسنده بتواند اصلاح کند.
 */
export function requestContentRevision(id, { admin = null, reason = '', comment = '' } = {}) {
  const contents = readCollection('mediaContents');
  const index = contents.findIndex((row) => row.id === id);
  if (index === -1) return null;

  if (!trim(reason, 200)) fail('دلیل درخواست اصلاح الزامی است');

  const stamp = nowIso();
  const rejection = {
    reason: trim(reason, 200),
    comment: trim(comment, 1000),
    at: stamp,
    byId: admin?.id ?? 'system',
    byName: admin?.name || admin?.username || '',
  };

  contents[index] = {
    ...contents[index],
    rejection,
    updatedAt: stamp,
    history: [...(contents[index].history ?? []), {
      at: stamp,
      byId: rejection.byId,
      byName: rejection.byName,
      from: contents[index].status,
      to: 'draft',
      action: 'revision-requested',
      note: `${rejection.reason}${rejection.comment ? ` — ${rejection.comment}` : ''}`,
    }].slice(-60),
  };
  writeCollection('mediaContents', contents);

  return setContentStatus(id, 'draft', { admin, note: `درخواست اصلاح: ${rejection.reason}`, force: true });
}

/* تأیید محتوا */
export function approveContent(id, { admin = null, note = '' } = {}) {
  return setContentStatus(id, 'approved', { admin, note: note || 'تأیید شد' });
}

/* زمان‌بندی: وضعیت و زمان انتشار با هم ست می‌شوند */
export function scheduleContent(id, { admin = null, scheduledAt, note = '' } = {}) {
  if (!scheduledAt) fail('برای زمان‌بندی، تاریخ و ساعت لازم است');
  const stamp = new Date(scheduledAt);
  if (Number.isNaN(stamp.getTime())) fail('تاریخ زمان‌بندی معتبر نیست');

  const contents = readCollection('mediaContents');
  const index = contents.findIndex((row) => row.id === id);
  if (index === -1) return null;

  contents[index] = { ...contents[index], scheduledAt: stamp.toISOString(), updatedAt: nowIso() };
  writeCollection('mediaContents', contents);

  return setContentStatus(id, 'scheduled', { admin, note: note || 'زمان‌بندی شد', force: true });
}

/* ─────────────────────── موتور انتشار محتوا ─────────────────────── */

/*
 * انتشار یک محتوا.
 *
 * دو مسیر، بسته به اینکه اکانت چه چیزی دارد:
 *   الف) اکانت به یک کانال انتشار وصل است → همان مسیر آزموده‌شدهٔ `publish`
 *        صدا زده می‌شود (توکن، حالت آزمایشی، لاگ). یعنی کانال بله‌ای که قبلاً
 *        ثبت شده، بدون هیچ تنظیم دوباره‌ای از اینجا هم منتشر می‌کند.
 *   ب) اکانت اعتبار خودش را دارد → آداپتور پلتفرم مستقیم صدا زده می‌شود.
 *
 * قاعدهٔ ثابت هر دو مسیر: **بدون توکن هیچ درخواستی به بیرون نمی‌رود.** به‌جایش
 * «آزمایشی» ثبت می‌شود و همان درخواستی که می‌رفت در تاریخچهٔ محتوا می‌ماند.
 */
export async function publishContent(id, { admin = null, forceDryRun = false } = {}) {
  const content = rawContent(id);
  if (!content) return null;

  const account = content.accountId ? getAccount(content.accountId) : null;
  const catalog = catalogById(content.platform);
  const stamp = nowIso();

  if (!catalog?.adapter) {
    fail(`برای «${catalog?.label ?? content.platform}» آداپتور انتشار وجود ندارد؛ این پلتفرم دستی مدیریت می‌شود`, 'CONFLICT');
  }

  if (!account) fail('برای انتشار، ابتدا اکانت مقصد را انتخاب کنید');
  if (!account.externalId && !account.publishChannelId) {
    fail('شناسهٔ مقصد این اکانت خالی است؛ برای انتشار لازم است');
  }

  const credentials = resolveAccountCredentials(account);
  const media = (content.assets ?? []).find((asset) => asset.url) ?? null;
  const mediaFile = media ? loadPublishMedia({ url: media.url, filename: media.filename, mimeType: media.mimeType }) : null;

  const text = buildContentText(content);

  const mark = (patch, historyNote) => {
    const contents = readCollection('mediaContents');
    const index = contents.findIndex((row) => row.id === id);
    if (index === -1) return null;

    contents[index] = {
      ...contents[index],
      ...patch,
      updatedAt: stamp,
      history: [...(contents[index].history ?? []), {
        at: stamp,
        byId: admin?.id ?? 'system',
        byName: admin?.name || admin?.username || '',
        from: contents[index].status,
        to: patch.status ?? contents[index].status,
        action: 'publish-attempt',
        note: historyNote,
      }].slice(-60),
    };

    writeCollection('mediaContents', contents);
    return publicContent(contents[index], mediaContext());
  };

  /* ── مسیر الف: کانال انتشار ── */
  if (account.publishChannelId) {
    const result = await publishToChannels({
      channelIds: [account.publishChannelId],
      content: { text, media: media ? { url: media.url, filename: media.filename, mimeType: media.mimeType } : null, source: { type: 'media-center', id: content.id, title: content.title } },
      admin,
      forceDryRun,
    });

    const row = result.results[0];

    if (row.status === 'sent') {
      return {
        status: 'sent',
        result: row,
        content: mark({ status: 'published', publishedAt: stamp, publishResult: { status: 'sent', via: 'channel', messages: row.messages, at: stamp } }, 'منتشر شد'),
      };
    }

    if (row.status === 'dry-run') {
      pushNotification({
        kind: 'publish-dry-run',
        level: 'warn',
        title: 'انتشار آزمایشی ثبت شد',
        body: `«${content.title}» بدون توکن ارسال نشد؛ همان درخواستی که می‌رفت ثبت شد.`,
        entityType: 'media-content',
        entityId: content.id,
      });
      return {
        status: 'dry-run',
        result: row,
        content: mark({ status: 'scheduled', publishResult: { status: 'dry-run', via: 'channel', request: row.request, reason: row.reason, at: stamp } }, `آزمایشی: ${row.reason}`),
      };
    }

    pushNotification({
      kind: 'publish-failed',
      level: 'critical',
      title: 'انتشار محتوا ناموفق بود',
      body: `«${content.title}» — ${row.error}`,
      entityType: 'media-content',
      entityId: content.id,
    });
    return {
      status: 'failed',
      result: row,
      content: mark({ status: 'failed', publishResult: { status: 'failed', via: 'channel', error: row.error, request: row.request, at: stamp } }, `ناموفق: ${row.error}`),
    };
  }

  /* ── مسیر ب: اعتبار خود اکانت ── */
  if (forceDryRun || !credentials.token) {
    const request = previewPlatformRequest({
      platform: content.platform,
      text,
      media: mediaFile,
      target: account.externalId,
      options: {},
    });

    const reason = forceDryRun ? 'اجرای آزمایشی اجباری' : 'توکن این اکانت ثبت نشده است';

    pushNotification({
      kind: 'publish-dry-run',
      level: 'warn',
      title: 'انتشار آزمایشی ثبت شد',
      body: `«${content.title}» — ${reason}`,
      entityType: 'media-content',
      entityId: content.id,
    });

    return {
      status: 'dry-run',
      result: { request, reason },
      content: mark({ status: 'scheduled', publishResult: { status: 'dry-run', via: 'account', request, reason, at: stamp } }, `آزمایشی: ${reason}`),
    };
  }

  const request = summarizePlatform({
    platform: content.platform,
    steps: planPlatform({ platform: content.platform, text, media: mediaFile }),
    target: account.externalId,
  });

  try {
    const sent = await sendPlatform({
      platform: content.platform,
      token: credentials.token,
      target: account.externalId,
      text,
      media: mediaFile,
      options: {},
    });

    return {
      status: 'sent',
      result: sent,
      content: mark({
        status: 'published',
        publishedAt: stamp,
        publishResult: { status: 'sent', via: 'account', messages: sent.messages, request, at: stamp },
      }, 'منتشر شد'),
    };
  } catch (error) {
    const message = error?.message || 'انتشار ناموفق بود';

    pushNotification({
      kind: 'publish-failed',
      level: 'critical',
      title: 'انتشار محتوا ناموفق بود',
      body: `«${content.title}» — ${message}`,
      entityType: 'media-content',
      entityId: content.id,
    });

    return {
      status: 'failed',
      result: { error: message, code: error?.code ?? 'PUBLISH_FAILED', request },
      content: mark({
        status: 'failed',
        publishResult: { status: 'failed', via: 'account', error: message, errorCode: error?.code ?? 'PUBLISH_FAILED', request, at: stamp },
      }, `ناموفق: ${message}`),
    };
  }
}

/* تلاش دوباره: وضعیت را به scheduled برمی‌گرداند و بلافاصله منتشر می‌کند */
export async function retryContent(id, { admin = null } = {}) {
  const content = rawContent(id);
  if (!content) return null;
  if (content.status !== 'failed') fail('فقط محتوای ناموفق قابل تلاش دوباره است', 'CONFLICT');

  const restored = setContentStatus(id, 'scheduled', { admin, note: 'آمادهٔ تلاش دوباره', force: true });
  if (!restored) return null;

  return publishContent(id, { admin });
}

/*
 * متن نهایی ارسال: کپشن + CTA + لینک‌ها + هشتگ‌ها.
 * همین یک تابع هم پیش‌نمایش را می‌سازد و هم ارسال را — پس آنچه می‌بینی همان
 * چیزی است که فرستاده می‌شود.
 */
export function buildContentText(content) {
  const parts = [String(content.caption ?? '').trim()];

  if (content.cta) parts.push(String(content.cta).trim());
  (content.links ?? []).forEach((link) => parts.push(link));
  if (content.hashtags?.length) parts.push(content.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' '));

  return parts.filter(Boolean).join('\n\n').slice(0, 4000);
}

/* پیش‌نمایش دقیق محتوا — بدون هیچ درخواست شبکه‌ای */
export function previewContent(input = {}) {
  const content = input.id ? rawContent(input.id) : null;
  const draft = content ? { ...content, ...input } : input;

  const platform = trim(draft.platform, 40) || 'bale';
  const text = buildContentText(draft);
  const asset = (draft.assets ?? []).find((row) => row.url) ?? null;

  /*
   * فایل پیوست از روی دیسک خوانده می‌شود (همان کاری که لحظهٔ ارسال انجام می‌شود).
   * اگر فایل نباشد یا آدرسش بیرونی باشد، پیش‌نمایش نباید بترکد؛ همان خطایی که
   * ارسال را متوقف می‌کند اینجا هم گزارش می‌شود تا کاربر پیش از زدن دکمه بداند.
   */
  let mediaFile = null;
  let mediaError = null;
  if (asset) {
    try {
      mediaFile = loadPublishMedia({ url: asset.url, filename: asset.filename, mimeType: asset.mimeType });
    } catch (error) {
      mediaError = error?.message || 'فایل پیوست خوانده نشد';
    }
  }

  const steps = planPlatform({ platform, text, media: mediaFile });

  const account = draft.accountId ? getAccount(draft.accountId) : null;

  return {
    platform,
    platformLabel: catalogById(platform)?.label ?? platform,
    text,
    title: draft.title ?? '',
    caption: draft.caption ?? '',
    hashtags: draft.hashtags ?? [],
    cta: draft.cta ?? '',
    links: draft.links ?? [],
    media: asset,
    mediaError,
    account: account ? { id: account.id, name: account.name, handle: account.handle } : null,
    target: account?.externalId ?? account?.publishChannelId ?? '',
    steps: steps.map((step) => ({
      method: step.method,
      label: step.label,
      text: step.text ?? step.caption ?? '',
      hasMedia: Boolean(step.media),
      warning: step.warning ?? null,
    })),
    /** آنچه واقعاً فرستاده می‌شود — بدون تکرار متن در دو جا */
    captionUsed: steps.length === 1 ? text : '',
  };
}

/* محتواهایی که وقت انتشارشان رسیده — موتور زمان‌بند */
export function dueContents(at = new Date()) {
  const time = at.getTime();
  return readCollection('mediaContents')
    .filter((content) => content.status === 'scheduled' && content.scheduledAt && new Date(content.scheduledAt).getTime() <= time)
    .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
}

/*
 * اجرای صف انتشار. عمداً دستی است (از دکمهٔ پنل) نه Cron: هیچ انتشار
 * خودکاری بدون اطلاع مدیر انجام نمی‌شود، ولی ساختارش آماده است تا یک زمان‌بند
 * بیرونی همین تابع را صدا بزند.
 */
export async function runSchedule({ admin = null, limit = 10 } = {}) {
  const due = dueContents().slice(0, limit);
  const results = [];

  for (const content of due) {
    results.push({ id: content.id, title: content.title, ...(await publishContent(content.id, { admin })) });
  }

  return {
    results,
    processed: results.length,
    sent: results.filter((row) => row.status === 'sent').length,
    dryRun: results.filter((row) => row.status === 'dry-run').length,
    failed: results.filter((row) => row.status === 'failed').length,
    pending: dueContents().length,
  };
}

/* صف انتشار: زمان‌بندی‌شده‌ها + ناموفق‌ها + در حال انتشار */
export function publishQueue() {
  const context = mediaContext();
  const rows = readCollection('mediaContents')
    .filter((content) => ['scheduled', 'publishing', 'failed'].includes(content.status))
    .map((content) => publicContent(content, context))
    .sort((a, b) => String(a.scheduledAt ?? '').localeCompare(String(b.scheduledAt ?? '')));

  const now = Date.now();

  return {
    items: rows,
    due: rows.filter((row) => row.status === 'scheduled' && row.scheduledAt && new Date(row.scheduledAt).getTime() <= now).length,
    scheduled: rows.filter((row) => row.status === 'scheduled').length,
    failed: rows.filter((row) => row.status === 'failed').length,
    publishing: rows.filter((row) => row.status === 'publishing').length,
  };
}

/* ─────────────────────────────── کمپین‌ها ─────────────────────────────── */

function campaignMetrics(campaignId, contents) {
  const related = contents.filter((content) => content.campaignId === campaignId && content.status === 'published');

  const collect = (key) => {
    const values = related.map((content) => content.metrics?.[key]).filter(Number.isFinite);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };

  const spend = null; /* هزینهٔ واقعی ثبت نشده — عدد ساختگی ساخته نمی‌شود */

  return {
    contentCount: contents.filter((content) => content.campaignId === campaignId).length,
    publishedCount: related.length,
    reach: collect('reach'),
    impressions: collect('impressions'),
    engagement: collect('engagement'),
    clicks: collect('clicks'),
    conversions: collect('conversions'),
    spend,
    /* هزینه به ازای نتیجه فقط وقتی معنا دارد که هم بودجه و هم نتیجه باشد */
    costPerResult: null,
    engagementRate: (() => {
      const reach = collect('reach');
      const engagement = collect('engagement');
      return Number.isFinite(reach) && reach > 0 && Number.isFinite(engagement) ? (engagement / reach) * 100 : null;
    })(),
  };
}

export function listCampaigns({ search = '', status = 'all', platform = 'all' } = {}) {
  const needle = String(search ?? '').trim().toLowerCase();
  const contents = readCollection('mediaContents');
  const team = readCollection('mediaTeam');

  return readCollection('mediaCampaigns')
    .filter((campaign) => {
      if (status !== 'all' && campaign.status !== status) return false;
      if (platform !== 'all' && !(campaign.platformIds ?? []).includes(platform)) return false;
      if (needle && !`${campaign.name} ${campaign.description} ${campaign.goal}`.toLowerCase().includes(needle)) return false;
      return true;
    })
    .map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description ?? '',
      goal: campaign.goal ?? '',
      status: campaign.status,
      startAt: campaign.startAt ?? null,
      endAt: campaign.endAt ?? null,
      budget: campaign.budget ?? null,
      ownerId: campaign.ownerId ?? null,
      ownerName: team.find((row) => row.id === campaign.ownerId)?.name ?? '',
      platformIds: campaign.platformIds ?? [],
      tagIds: campaign.tagIds ?? [],
      utmId: campaign.utmId ?? null,
      metrics: campaignMetrics(campaign.id, contents),
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getCampaign(id) {
  const campaign = listCampaigns().find((row) => row.id === id);
  if (!campaign) return null;

  const context = mediaContext();
  const contents = readCollection('mediaContents')
    .filter((content) => content.campaignId === id)
    .map((content) => publicContent(content, context));

  const ranks = rankContents(contents);

  return {
    ...campaign,
    contents,
    contentStats: contentStats(contents),
    best: ranks.best,
    worst: ranks.worst,
    contentTypeBreakdown: contentTypeBreakdown(contents),
  };
}

export function saveCampaign(input, admin = null) {
  const name = trim(input.name, 120);
  if (!name) fail('نام کمپین الزامی است');

  const campaigns = readCollection('mediaCampaigns');
  const id = input.id ? String(input.id) : null;
  const index = id ? campaigns.findIndex((row) => row.id === id) : -1;
  const stamp = nowIso();

  const payload = {
    name,
    description: trim(input.description, 1000),
    goal: trim(input.goal, 300),
    status: CAMPAIGN_STATUSES.some((row) => row.id === input.status) ? input.status : 'planned',
    startAt: input.startAt ? String(input.startAt).slice(0, 10) : null,
    endAt: input.endAt ? String(input.endAt).slice(0, 10) : null,
    budget: num(input.budget),
    ownerId: input.ownerId ? trim(input.ownerId, 60) : null,
    platformIds: Array.isArray(input.platformIds) ? input.platformIds.map((item) => String(item)).filter(isKnownPlatform).slice(0, 20) : [],
    tagIds: Array.isArray(input.tagIds) ? input.tagIds.map((item) => String(item)).slice(0, 20) : [],
    utmId: input.utmId ? trim(input.utmId, 60) : null,
    updatedAt: stamp,
  };

  if (payload.startAt && payload.endAt && payload.endAt < payload.startAt) fail('تاریخ پایان نمی‌تواند قبل از شروع باشد');

  if (index === -1) {
    campaigns.push({ id: makeId('cmp'), ...payload, createdAt: stamp, createdBy: admin?.id ?? 'system', createdByName: admin?.name || admin?.username || '' });
  } else {
    campaigns[index] = { ...campaigns[index], ...payload };
  }

  writeCollection('mediaCampaigns', campaigns);
  return getCampaign(index === -1 ? campaigns[campaigns.length - 1].id : id);
}

export function deleteCampaign(id) {
  const campaigns = readCollection('mediaCampaigns');
  const target = campaigns.find((row) => row.id === id);
  if (!target) return null;

  const contents = readCollection('mediaContents');
  const linked = contents.filter((content) => content.campaignId === id);
  if (linked.length) {
    /* محتوا حذف نمی‌شود؛ فقط از کمپین جدا می‌شود تا داده از دست نرود */
    writeCollection('mediaContents', contents.map((content) => (
      content.campaignId === id ? { ...content, campaignId: null } : content
    )));
  }

  writeCollection('mediaCampaigns', campaigns.filter((row) => row.id !== id));
  return { deleted: id, detachedContents: linked.length };
}

/* ────────────────────────────── تیم رسانه ────────────────────────────── */

function teamMetrics(memberId, contents) {
  const authored = contents.filter((content) => content.authorId === memberId);

  return {
    contentCount: authored.length,
    publishedCount: authored.filter((content) => content.status === 'published').length,
    pendingReview: authored.filter((content) => ['review', 'approved'].includes(content.status)).length,
    draftCount: authored.filter((content) => content.status === 'draft').length,
    failedCount: authored.filter((content) => content.status === 'failed').length,
  };
}

export function listTeam({ search = '', role = 'all', active = 'all' } = {}) {
  const needle = String(search ?? '').trim().toLowerCase();
  const contents = readCollection('mediaContents');
  const admins = readCollection('admins');

  return readCollection('mediaTeam')
    .filter((member) => {
      if (role !== 'all' && member.role !== role) return false;
      if (active === 'active' && member.isActive === false) return false;
      if (active === 'inactive' && member.isActive !== false) return false;
      if (needle && !`${member.name} ${member.responsibility}`.toLowerCase().includes(needle)) return false;
      return true;
    })
    .map((member) => {
      const roleRow = MEDIA_ROLES.find((row) => row.id === member.role);
      const linkedAdmin = member.adminId ? admins.find((row) => row.id === member.adminId) ?? null : null;

      return {
        id: member.id,
        name: member.name,
        avatar: member.avatar ?? '',
        role: member.role,
        roleLabel: roleRow?.label ?? member.role,
        scope: roleRow?.scope ?? [],
        responsibility: member.responsibility ?? '',
        platformIds: member.platformIds ?? [],
        campaignIds: member.campaignIds ?? [],
        email: member.email ?? '',
        phone: member.phone ?? '',
        adminId: member.adminId ?? null,
        /* دسترسی مؤثر: اگر به حساب مدیریتی وصل باشد، از نقش آن حساب */
        linkedAdminName: linkedAdmin ? (linkedAdmin.name || linkedAdmin.username) : '',
        linkedAdminRole: linkedAdmin?.role ?? null,
        isActive: member.isActive !== false,
        metrics: teamMetrics(member.id, contents),
        createdAt: member.createdAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function saveTeamMember(input, admin = null) {
  const name = trim(input.name, 80);
  if (!name) fail('نام عضو تیم الزامی است');

  const members = readCollection('mediaTeam');
  const id = input.id ? String(input.id) : null;
  const index = id ? members.findIndex((row) => row.id === id) : -1;
  const stamp = nowIso();

  const payload = {
    name,
    avatar: trim(input.avatar, 400),
    role: MEDIA_ROLES.some((row) => row.id === input.role) ? input.role : 'writer',
    responsibility: trim(input.responsibility, 400),
    platformIds: Array.isArray(input.platformIds) ? input.platformIds.map((item) => String(item)).filter(isKnownPlatform).slice(0, 20) : [],
    campaignIds: Array.isArray(input.campaignIds) ? input.campaignIds.map((item) => String(item)).slice(0, 30) : [],
    email: trim(input.email, 160),
    phone: trim(input.phone, 40),
    adminId: input.adminId ? trim(input.adminId, 60) : null,
    isActive: bool(input.isActive, true),
    updatedAt: stamp,
  };

  if (index === -1) {
    members.push({ id: makeId('tm'), ...payload, createdAt: stamp, createdBy: admin?.id ?? 'system' });
  } else {
    members[index] = { ...members[index], ...payload };
  }

  writeCollection('mediaTeam', members);
  const saved = index === -1 ? members[members.length - 1].id : id;
  return listTeam().find((row) => row.id === saved) ?? null;
}

export function deleteTeamMember(id) {
  const members = readCollection('mediaTeam');
  const target = members.find((row) => row.id === id);
  if (!target) return null;

  const contents = readCollection('mediaContents');
  const authored = contents.filter((content) => content.authorId === id);
  if (authored.length) fail(`این عضو ${authored.length} محتوا دارد؛ اول مسئول آن‌ها را عوض کنید`, 'CONFLICT');

  writeCollection('mediaTeam', members.filter((row) => row.id !== id));
  return { deleted: id };
}

/* ─────────────────────────── هشتگ‌ها و موضوع‌ها ─────────────────────────── */

function slugify(value) {
  return String(value ?? '')
    .trim()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .toLowerCase()
    .slice(0, 60);
}

export function listTags({ kind = 'all', search = '' } = {}) {
  const needle = String(search ?? '').trim().toLowerCase();
  const contents = readCollection('mediaContents');

  const rows = readCollection('mediaTags')
    .filter((tag) => {
      if (kind !== 'all' && tag.kind !== kind) return false;
      if (needle && !`${tag.label} ${tag.slug}`.toLowerCase().includes(needle)) return false;
      return true;
    });

  return tagPerformance(rows, contents);
}

export function saveTag(input, admin = null) {
  const kind = TAG_KINDS.some((row) => row.id === input.kind) ? input.kind : 'hashtag';
  const label = trim(input.label, 80);
  if (!label) fail('عنوان هشتگ یا موضوع الزامی است');

  const slug = slugify(input.slug || label);
  if (!slug) fail('عنوان نامعتبر است');

  const tags = readCollection('mediaTags');
  const id = input.id ? String(input.id) : null;
  const index = id ? tags.findIndex((row) => row.id === id) : -1;

  const duplicate = tags.find((tag) => tag.slug === slug && tag.kind === kind && tag.id !== id);
  if (duplicate) fail('این مورد قبلاً ثبت شده است', 'CONFLICT');

  const payload = {
    kind,
    label,
    slug,
    color: trim(input.color, 20),
    description: trim(input.description, 400),
  };

  if (index === -1) tags.push({ id: makeId('tag'), ...payload, createdAt: nowIso() });
  else tags[index] = { ...tags[index], ...payload };

  writeCollection('mediaTags', tags);
  const saved = index === -1 ? tags[tags.length - 1].id : id;
  return listTags().find((row) => row.id === saved) ?? null;
}

export function deleteTag(id) {
  const tags = readCollection('mediaTags');
  const target = tags.find((row) => row.id === id);
  if (!target) return null;

  /* از محتواها جدا می‌شود تا ارجاع مرده نماند */
  const contents = readCollection('mediaContents');
  writeCollection('mediaContents', contents.map((content) => (
    (content.tagIds ?? []).includes(id)
      ? { ...content, tagIds: content.tagIds.filter((tagId) => tagId !== id) }
      : content
  )));

  writeCollection('mediaTags', tags.filter((row) => row.id !== id));
  return { deleted: id };
}

/* تعداد استفادهٔ هشتگ‌ها از روی محتواها بازمحاسبه می‌شود تا کهنه نشود */
export function rebuildTagUsage() {
  const contents = readCollection('mediaContents');
  const tags = readCollection('mediaTags');

  const counters = new Map();
  contents.forEach((content) => {
    (content.tagIds ?? []).forEach((id) => counters.set(id, (counters.get(id) ?? 0) + 1));
  });

  const next = tags.map((tag) => ({ ...tag, usageCount: counters.get(tag.id) ?? 0 }));
  writeCollection('mediaTags', next);
  return next.length;
}

/* ─────────────────────────────── سنجه‌ها ─────────────────────────────── */

/*
 * ثبت/به‌روزرسانی عکس لحظه‌ای یک روز.
 * کلید یکتایی `accountId + date` است، پس همگام‌سازی چندبارهٔ یک روز رکورد
 * تکراری نمی‌سازد.
 */
export function saveMetrics(input) {
  const date = String(input.date ?? dayKey(new Date())).slice(0, 10);
  const accountId = trim(input.accountId, 60);
  if (!accountId) fail('اکانت سنجه را انتخاب کنید');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('تاریخ سنجه معتبر نیست');

  const account = getAccount(accountId);
  if (!account) fail('اکانت پیدا نشد', 'NOT_FOUND');

  const metrics = readCollection('mediaMetrics');
  const index = metrics.findIndex((row) => row.accountId === accountId && row.date === date);

  const payload = {
    date,
    accountId,
    platform: account.platform,
    source: trim(input.source, 20) || 'manual',
    followers: num(input.followers),
    following: num(input.following),
    posts: num(input.posts),
    views: num(input.views),
    reach: num(input.reach),
    impressions: num(input.impressions),
    likes: num(input.likes),
    comments: num(input.comments),
    shares: num(input.shares),
    saves: num(input.saves),
    clicks: num(input.clicks),
    engagement: num(input.engagement),
    websiteClicks: num(input.websiteClicks),
    signups: num(input.signups),
    purchases: num(input.purchases),
    updatedAt: nowIso(),
  };

  if (index === -1) metrics.push({ id: makeId('mtr'), ...payload, createdAt: nowIso() });
  else metrics[index] = { ...metrics[index], ...payload };

  writeCollection('mediaMetrics', metrics);
  return { date, accountId, platform: account.platform, ...payload };
}

export function listMetrics({ accountId = 'all', platform = 'all', from = null, to = null, limit = 400 } = {}) {
  return readCollection('mediaMetrics')
    .filter((row) => {
      if (accountId !== 'all' && row.accountId !== accountId) return false;
      if (platform !== 'all' && row.platform !== platform) return false;
      if (from && row.date < String(from).slice(0, 10)) return false;
      if (to && row.date > String(to).slice(0, 10)) return false;
      return true;
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, Math.min(Math.max(Number(limit) || 400, 1), 2000));
}

export function deleteMetrics(id) {
  const metrics = readCollection('mediaMetrics');
  const target = metrics.find((row) => row.id === id);
  if (!target) return null;

  writeCollection('mediaMetrics', metrics.filter((row) => row.id !== id));
  return { deleted: id };
}

/* ─────────────────────────────── اینباکس ─────────────────────────────── */

export function listInbox({
  platform = 'all', accountId = 'all', status = 'all', kind = 'all', assignedToId = 'all',
  search = '', page = 1, perPage = 20,
} = {}) {
  const needle = String(search ?? '').trim().toLowerCase();
  const accounts = readCollection('mediaAccounts');
  const team = readCollection('mediaTeam');

  const rows = readCollection('mediaInbox')
    .filter((item) => {
      if (platform !== 'all' && item.platform !== platform) return false;
      if (accountId !== 'all' && item.accountId !== accountId) return false;
      if (status !== 'all' && item.status !== status) return false;
      if (kind !== 'all' && item.kind !== kind) return false;
      if (assignedToId !== 'all' && item.assignedToId !== assignedToId) return false;
      if (needle && !`${item.text} ${item.authorName} ${item.authorHandle}`.toLowerCase().includes(needle)) return false;
      return true;
    })
    .map((item) => ({
      id: item.id,
      platform: item.platform,
      platformLabel: catalogById(item.platform)?.label ?? item.platform,
      accountId: item.accountId ?? null,
      accountName: accounts.find((row) => row.id === item.accountId)?.name ?? '',
      kind: item.kind,
      authorName: item.authorName ?? '',
      authorHandle: item.authorHandle ?? '',
      authorAvatar: item.authorAvatar ?? '',
      text: item.text,
      url: item.url ?? '',
      at: item.at,
      status: item.status,
      assignedToId: item.assignedToId ?? null,
      assignedToName: team.find((row) => row.id === item.assignedToId)?.name ?? '',
      tags: item.tags ?? [],
      replies: item.replies ?? [],
      contentId: item.contentId ?? null,
    }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const counts = {
    total: rows.length,
    unread: rows.filter((row) => row.status === 'unread').length,
    pending: rows.filter((row) => row.status === 'pending').length,
    important: rows.filter((row) => row.status === 'important').length,
  };

  const size = Math.min(Math.max(Number(perPage) || 20, 1), 100);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(Number(page) || 1, 1), pages);
  const start = (current - 1) * size;

  return { items: rows.slice(start, start + size), counts, total: rows.length, page: current, perPage: size, pages };
}

export function saveInboxItem(input, admin = null) {
  const text = trim(input.text, 4000);
  if (!text) fail('متن پیام الزامی است');

  const items = readCollection('mediaInbox');
  const id = input.id ? String(input.id) : null;
  const index = id ? items.findIndex((row) => row.id === id) : -1;

  const payload = {
    platform: isKnownPlatform(input.platform) ? input.platform : 'instagram',
    accountId: input.accountId ? trim(input.accountId, 60) : null,
    kind: INBOX_KINDS.some((row) => row.id === input.kind) ? input.kind : 'comment',
    authorName: trim(input.authorName, 80),
    authorHandle: trim(input.authorHandle, 80),
    authorAvatar: trim(input.authorAvatar, 400),
    text,
    url: trim(input.url, 500),
    at: input.at ? new Date(input.at).toISOString() : nowIso(),
    status: INBOX_STATUSES.some((row) => row.id === input.status) ? input.status : 'unread',
    assignedToId: input.assignedToId ? trim(input.assignedToId, 60) : null,
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => trim(tag, 40)).filter(Boolean).slice(0, 10) : [],
    contentId: input.contentId ? trim(input.contentId, 60) : null,
  };

  if (index === -1) items.push({ id: makeId('inb'), ...payload, replies: [], createdAt: nowIso() });
  else items[index] = { ...items[index], ...payload };

  writeCollection('mediaInbox', items);
  return listInbox({ perPage: 1 }).items[0] ?? null;
}

export function setInboxStatus(id, status, admin = null) {
  if (!INBOX_STATUSES.some((row) => row.id === status)) fail('وضعیت نامعتبر است');

  const items = readCollection('mediaInbox');
  const index = items.findIndex((row) => row.id === id);
  if (index === -1) return null;

  items[index] = { ...items[index], status, updatedAt: nowIso() };
  writeCollection('mediaInbox', items);
  return { id, status };
}

export function assignInboxItem(id, assignedToId, admin = null) {
  const items = readCollection('mediaInbox');
  const index = items.findIndex((row) => row.id === id);
  if (index === -1) return null;

  const team = readCollection('mediaTeam');
  if (assignedToId && !team.some((row) => row.id === assignedToId)) fail('عضو تیم پیدا نشد', 'NOT_FOUND');

  items[index] = {
    ...items[index],
    assignedToId: assignedToId || null,
    status: items[index].status === 'unread' ? 'read' : items[index].status,
    updatedAt: nowIso(),
  };
  writeCollection('mediaInbox', items);
  return { id, assignedToId: items[index].assignedToId };
}

export function replyInboxItem(id, { text, admin = null } = {}) {
  const body = trim(text, 2000);
  if (!body) fail('متن پاسخ الزامی است');

  const items = readCollection('mediaInbox');
  const index = items.findIndex((row) => row.id === id);
  if (index === -1) return null;

  items[index] = {
    ...items[index],
    replies: [...(items[index].replies ?? []), {
      at: nowIso(),
      byId: admin?.id ?? 'system',
      byName: admin?.name || admin?.username || '',
      text: body,
    }],
    status: 'answered',
    updatedAt: nowIso(),
  };

  writeCollection('mediaInbox', items);
  return { id, replies: items[index].replies, status: 'answered' };
}

export function deleteInboxItem(id) {
  const items = readCollection('mediaInbox');
  const target = items.find((row) => row.id === id);
  if (!target) return null;

  writeCollection('mediaInbox', items.filter((row) => row.id !== id));
  return { deleted: id };
}

/* ─────────────────────────── رصد نام و کلیدواژه ─────────────────────────── */

export function listMentions({ platform = 'all', keyword = 'all', sentiment = 'all', handled = 'all', search = '' } = {}) {
  const needle = String(search ?? '').trim().toLowerCase();

  return readCollection('mediaMentions')
    .filter((mention) => {
      if (platform !== 'all' && mention.platform !== platform) return false;
      if (keyword !== 'all' && mention.keywordId !== keyword) return false;
      if (sentiment !== 'all' && mention.sentiment !== sentiment) return false;
      if (handled === 'handled' && !mention.handled) return false;
      if (handled === 'open' && mention.handled) return false;
      if (needle && !`${mention.text} ${mention.authorName}`.toLowerCase().includes(needle)) return false;
      return true;
    })
    .map((mention) => ({
      ...mention,
      platformLabel: catalogById(mention.platform)?.label ?? mention.platform,
    }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function saveMention(input, admin = null) {
  const text = trim(input.text, 4000);
  if (!text) fail('متن منشن الزامی است');

  const mentions = readCollection('mediaMentions');
  const id = input.id ? String(input.id) : null;
  const index = id ? mentions.findIndex((row) => row.id === id) : -1;

  const payload = {
    platform: isKnownPlatform(input.platform) ? input.platform : 'instagram',
    keywordId: input.keywordId ? trim(input.keywordId, 60) : null,
    keywordLabel: trim(input.keywordLabel, 80),
    authorName: trim(input.authorName, 80),
    authorHandle: trim(input.authorHandle, 80),
    text,
    url: trim(input.url, 500),
    at: input.at ? new Date(input.at).toISOString() : nowIso(),
    /* احساس فقط از دادهٔ واقعی می‌آید؛ اگر ثبت نشده باشد null می‌ماند */
    sentiment: ['positive', 'neutral', 'negative'].includes(input.sentiment) ? input.sentiment : null,
    reach: num(input.reach),
    handled: bool(input.handled, false),
  };

  if (index === -1) mentions.push({ id: makeId('mnt'), ...payload, createdAt: nowIso() });
  else mentions[index] = { ...mentions[index], ...payload };

  writeCollection('mediaMentions', mentions);
  return listMentions().find((row) => row.id === (index === -1 ? mentions[mentions.length - 1].id : id)) ?? null;
}

export function deleteMention(id) {
  const mentions = readCollection('mediaMentions');
  const target = mentions.find((row) => row.id === id);
  if (!target) return null;

  writeCollection('mediaMentions', mentions.filter((row) => row.id !== id));
  return { deleted: id };
}

/* خلاصهٔ رصد: چند منشن، به تفکیک پلتفرم و احساس */
export function listeningSummary() {
  const mentions = readCollection('mediaMentions');
  const tags = readCollection('mediaTags').filter((tag) => tag.kind === 'topic');
  const team = readCollection('mediaTeam');

  const byPlatform = new Map();
  mentions.forEach((mention) => {
    const bucket = byPlatform.get(mention.platform) ?? { platform: mention.platform, count: 0, positive: 0, neutral: 0, negative: 0, unknown: 0, reach: 0, hasReach: false };
    bucket.count += 1;
    if (mention.sentiment === 'positive') bucket.positive += 1;
    else if (mention.sentiment === 'neutral') bucket.neutral += 1;
    else if (mention.sentiment === 'negative') bucket.negative += 1;
    else bucket.unknown += 1;
    if (Number.isFinite(mention.reach)) { bucket.reach += mention.reach; bucket.hasReach = true; }
    byPlatform.set(mention.platform, bucket);
  });

  return {
    total: mentions.length,
    open: mentions.filter((mention) => !mention.handled).length,
    byPlatform: [...byPlatform.values()].map((bucket) => ({
      ...bucket,
      platformLabel: catalogById(bucket.platform)?.label ?? bucket.platform,
      reach: bucket.hasReach ? bucket.reach : null,
    })),
    /* کلیدواژه‌های تحت رصد = موضوع‌های تعریف‌شده */
    keywords: tags.map((tag) => ({
      id: tag.id,
      label: tag.label,
      count: mentions.filter((mention) => mention.keywordId === tag.id).length,
    })),
    monitoredPlatforms: [...new Set(mentions.map((mention) => mention.platform))],
    lastAt: mentions[0]?.at ?? null,
    teamCount: team.length,
  };
}

/* ─────────────────────────────── اعلان‌ها ─────────────────────────────── */

export function pushNotification({ kind, level = 'info', title, body = '', entityType = null, entityId = null, link = null }) {
  const notifications = readCollection('mediaNotifications');

  /* اعلان تکراری برای همان رکورد ساخته نمی‌شود؛ فقط تازه می‌شود */
  const existing = notifications.find((row) => row.kind === kind && row.entityId === entityId && !row.isArchived);
  const stamp = nowIso();

  if (existing) {
    Object.assign(existing, { at: stamp, body, isRead: false, level });
    writeCollection('mediaNotifications', notifications);
    return existing;
  }

  const notification = {
    id: makeId('ntf'),
    kind,
    level: NOTIFICATION_LEVELS.some((row) => row.id === level) ? level : 'info',
    title: trim(title, 160),
    body: trim(body, 600),
    entityType,
    entityId,
    link,
    isRead: false,
    isArchived: false,
    at: stamp,
  };

  notifications.unshift(notification);
  writeCollection('mediaNotifications', notifications.slice(0, 300));
  return notification;
}

export function listNotifications({ status = 'all', level = 'all' } = {}) {
  const rows = readCollection('mediaNotifications').filter((row) => {
    if (status === 'unread' && row.isRead) return false;
    if (status === 'read' && !row.isRead) return false;
    if (status === 'archived' && !row.isArchived) return false;
    if (status !== 'archived' && row.isArchived) return false;
    if (level !== 'all' && row.level !== level) return false;
    return true;
  });

  const all = readCollection('mediaNotifications');

  return {
    items: rows.sort((a, b) => String(b.at).localeCompare(String(a.at))),
    unread: all.filter((row) => !row.isRead && !row.isArchived).length,
    archived: all.filter((row) => row.isArchived).length,
    critical: all.filter((row) => row.level === 'critical' && !row.isArchived).length,
  };
}

export function setNotificationState(id, { isRead, isArchived } = {}) {
  const notifications = readCollection('mediaNotifications');
  const index = notifications.findIndex((row) => row.id === id);
  if (index === -1) return null;

  if (isRead !== undefined) notifications[index].isRead = bool(isRead);
  if (isArchived !== undefined) notifications[index].isArchived = bool(isArchived);

  writeCollection('mediaNotifications', notifications);
  return notifications[index];
}

export function markAllNotificationsRead() {
  const notifications = readCollection('mediaNotifications');
  const next = notifications.map((row) => ({ ...row, isRead: true }));
  writeCollection('mediaNotifications', next);
  return { updated: next.length };
}

/*
 * بررسیهای دوره‌ای که اعلان می‌سازند.
 * هر بررسی فقط چیزی را می‌گوید که واقعاً در داده هست — اعلان تزئینی ساخته
 * نمی‌شود.
 */
export function refreshNotifications() {
  const contents = readCollection('mediaContents');
  const accounts = readCollection('mediaAccounts');
  const campaigns = readCollection('mediaCampaigns');
  const created = [];

  /* محتواهای در انتظار بررسی */
  const pending = contents.filter((content) => content.status === 'review');
  if (pending.length) {
    created.push(pushNotification({
      kind: 'content-review-pending',
      level: 'warn',
      title: `${pending.length} محتوا در انتظار تأیید است`,
      body: pending.slice(0, 3).map((content) => content.title).join('، '),
      entityType: 'media-content',
      entityId: 'review-queue',
    }));
  }

  /* محتواهای ناموفق */
  const failed = contents.filter((content) => content.status === 'failed');
  if (failed.length) {
    created.push(pushNotification({
      kind: 'content-publish-failed',
      level: 'critical',
      title: `${failed.length} محتوا در انتشار ناموفق بود`,
      body: failed.slice(0, 3).map((content) => content.title).join('، '),
      entityType: 'media-content',
      entityId: 'failed-queue',
    }));
  }

  /* زمان‌بندی نزدیک (تا ۲۴ ساعت آینده) */
  const soon = dueContents(new Date(Date.now() + 24 * 60 * 60 * 1000))
    .filter((content) => new Date(content.scheduledAt).getTime() > Date.now());
  if (soon.length) {
    created.push(pushNotification({
      kind: 'content-scheduled-soon',
      level: 'info',
      title: `${soon.length} محتوا تا ۲۴ ساعت آینده منتشر می‌شود`,
      body: soon.slice(0, 3).map((content) => content.title).join('، '),
      entityType: 'media-content',
      entityId: 'schedule-soon',
    }));
  }

  /* کمپین‌های پایان‌یافته */
  const today = dayKey(new Date());
  const finished = campaigns.filter((campaign) => campaign.status === 'active' && campaign.endAt && campaign.endAt < today);
  finished.forEach((campaign) => {
    created.push(pushNotification({
      kind: 'campaign-ended',
      level: 'info',
      title: `کمپین «${campaign.name}» به پایان رسید`,
      body: 'وضعیت کمپین را به «پایان‌یافته» تغییر دهید یا تمدید کنید.',
      entityType: 'media-campaign',
      entityId: campaign.id,
    }));
  });

  /* اکانت‌هایی که داده‌شان تازه نیست */
  const staleLimit = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stale = accounts.filter((account) => (
    hasAdapter(account.platform)
    && resolveAccountCredentials(account).token
    && (!account.lastSyncAt || new Date(account.lastSyncAt).getTime() < staleLimit)
  ));

  if (stale.length) {
    created.push(pushNotification({
      kind: 'account-sync-stale',
      level: 'warn',
      title: `دادهٔ ${stale.length} اکانت به‌روز نیست`,
      body: stale.slice(0, 3).map((account) => account.name).join('، '),
      entityType: 'media-account',
      entityId: 'stale-sync',
    }));
  }

  return { created: created.length, notifications: created };
}

/* ────────────────────────────── لینک UTM ────────────────────────────── */

/*
 * ساخت آدرس نهایی. پارامترها استاندارد UTMاند و ترتیب ثابت است تا لینک‌ها
 * یکدست بمانند و در تحلیل قابل گروه‌بندی باشند.
 */
export function buildUtmUrl({ baseUrl, source, medium, campaign, content, term }) {
  const base = trim(baseUrl, 400);
  if (!base) fail('آدرس مقصد الزامی است');

  let url;
  try {
    url = new URL(base);
  } catch {
    fail('آدرس مقصد معتبر نیست');
  }

  const params = {
    utm_source: trim(source, 80),
    utm_medium: trim(medium, 80),
    utm_campaign: trim(campaign, 120),
    utm_content: trim(content, 120),
    utm_term: trim(term, 120),
  };

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return url.toString();
}

export function listUtm({ campaignId = 'all', platform = 'all' } = {}) {
  const campaigns = readCollection('mediaCampaigns');

  return readCollection('mediaUtm')
    .filter((link) => {
      if (campaignId !== 'all' && link.campaignId !== campaignId) return false;
      if (platform !== 'all' && link.source !== platform) return false;
      return true;
    })
    .map((link) => ({
      ...link,
      campaignName: campaigns.find((row) => row.id === link.campaignId)?.name ?? '',
      visitRate: Number.isFinite(link.visits) && Number.isFinite(link.clicks) && link.clicks > 0
        ? (link.visits / link.clicks) * 100
        : null,
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function saveUtm(input, admin = null) {
  const links = readCollection('mediaUtm');
  const id = input.id ? String(input.id) : null;
  const index = id ? links.findIndex((row) => row.id === id) : -1;

  const url = buildUtmUrl(input);

  const payload = {
    label: trim(input.label, 120),
    baseUrl: trim(input.baseUrl, 400),
    url,
    source: trim(input.source, 80),
    medium: trim(input.medium, 80),
    campaign: trim(input.campaign, 120),
    content: trim(input.content, 120),
    term: trim(input.term, 120),
    campaignId: input.campaignId ? trim(input.campaignId, 60) : null,
    contentId: input.contentId ? trim(input.contentId, 60) : null,
    /* نتیجهٔ واقعی — دستی یا از سنجهٔ اکانت؛ هرگز حدس زده نمی‌شود */
    clicks: num(input.clicks),
    visits: num(input.visits),
    signups: num(input.signups),
    purchases: num(input.purchases),
    updatedAt: nowIso(),
  };

  if (index === -1) links.push({ id: makeId('utm'), ...payload, createdAt: nowIso(), createdByName: admin?.name || admin?.username || '' });
  else links[index] = { ...links[index], ...payload };

  writeCollection('mediaUtm', links);
  return listUtm().find((row) => row.id === (index === -1 ? links[links.length - 1].id : id)) ?? null;
}

export function deleteUtm(id) {
  const links = readCollection('mediaUtm');
  const target = links.find((row) => row.id === id);
  if (!target) return null;

  writeCollection('mediaUtm', links.filter((row) => row.id !== id));
  return { deleted: id };
}

/* ─────────────────────────── کتابخانهٔ رسانه ─────────────────────────── */

/*
 * کتابخانهٔ رسانه روی همان مجموعهٔ `media` پروژه کار می‌کند (همان پوشهٔ
 * uploads) ولی فرادادهٔ غنی‌تری نگه می‌دارد: پوشه، برچسب، دسته، آرشیو و
 * شمارش استفاده. یک انبار فایل، دو نما — نه دو کتابخانهٔ موازی.
 */
export function listAssets({ search = '', kind = 'all', folder = 'all', archived = 'all', sort = 'newest', page = 1, perPage = 24 } = {}) {
  const needle = String(search ?? '').trim().toLowerCase();
  const contents = readCollection('mediaContents');

  const rows = readCollection('media').map((item) => {
    const usedIn = contents.filter((content) => (content.assets ?? []).some((asset) => asset.mediaId === item.id || (asset.url && asset.url === item.url)));

    return {
      id: item.id,
      url: item.url,
      filename: item.filename,
      originalName: item.originalName,
      mimeType: item.mimeType,
      size: item.size,
      width: item.width ?? null,
      height: item.height ?? null,
      duration: item.duration ?? null,
      kind: item.assetKind ?? (String(item.mimeType ?? '').startsWith('video/') ? 'video'
        : String(item.mimeType ?? '').startsWith('audio/') ? 'audio'
          : String(item.mimeType ?? '').includes('pdf') ? 'document' : 'image'),
      folder: item.folder ?? 'عمومی',
      tags: item.tags ?? [],
      altText: item.altText ?? '',
      isArchived: item.isArchived === true,
      uploaderId: item.uploadedBy ?? null,
      uploaderName: item.uploadedByName ?? '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt ?? item.createdAt,
      lastUsedAt: usedIn.length ? usedIn.map((content) => content.updatedAt ?? content.createdAt).sort().pop() : (item.lastUsedAt ?? null),
      usageCount: usedIn.length,
      usedIn: usedIn.slice(0, 12).map((content) => ({ id: content.id, title: content.title, status: content.status })),
    };
  }).filter((asset) => {
    if (kind !== 'all' && asset.kind !== kind) return false;
    if (folder !== 'all' && asset.folder !== folder) return false;
    if (archived === 'active' && asset.isArchived) return false;
    if (archived === 'archived' && !asset.isArchived) return false;
    if (needle && !`${asset.originalName} ${asset.filename} ${asset.altText} ${asset.tags.join(' ')}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  const sorters = {
    newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    oldest: (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)),
    largest: (a, b) => (b.size ?? 0) - (a.size ?? 0),
    name: (a, b) => String(a.originalName).localeCompare(String(b.originalName)),
    used: (a, b) => b.usageCount - a.usageCount,
    recentUse: (a, b) => String(b.lastUsedAt ?? '').localeCompare(String(a.lastUsedAt ?? '')),
  };

  rows.sort(sorters[sort] ?? sorters.newest);

  const folders = [...new Set(readCollection('media').map((item) => item.folder ?? 'عمومی'))].sort();
  const byKind = {};
  rows.forEach((asset) => { byKind[asset.kind] = (byKind[asset.kind] ?? 0) + 1; });

  const size = Math.min(Math.max(Number(perPage) || 24, 1), 120);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(Number(page) || 1, 1), pages);
  const start = (current - 1) * size;

  return {
    items: rows.slice(start, start + size),
    folders,
    byKind,
    total: rows.length,
    page: current,
    perPage: size,
    pages,
    totalBytes: rows.reduce((total, asset) => total + (Number(asset.size) || 0), 0),
  };
}

/* ویرایش فرادادهٔ یک فایل — فایل فیزیکی دست‌نخورده می‌ماند */
export function updateAsset(id, input, admin = null) {
  const items = readCollection('media');
  const index = items.findIndex((row) => row.id === id);
  if (index === -1) return null;

  const patch = {};
  if (input.originalName !== undefined) patch.originalName = trim(input.originalName, 200);
  if (input.altText !== undefined) patch.altText = trim(input.altText, 400);
  if (input.folder !== undefined) patch.folder = trim(input.folder, 80) || 'عمومی';
  if (input.tags !== undefined) patch.tags = Array.isArray(input.tags) ? input.tags.map((tag) => trim(tag, 40)).filter(Boolean).slice(0, 20) : [];
  if (input.assetKind !== undefined && ASSET_KINDS.some((row) => row.id === input.assetKind)) patch.assetKind = input.assetKind;
  if (input.isArchived !== undefined) patch.isArchived = bool(input.isArchived);

  items[index] = { ...items[index], ...patch, updatedAt: nowIso(), updatedByName: admin?.name || admin?.username || '' };
  writeCollection('media', items);

  return { id, ...items[index] };
}

export function archiveAsset(id, isArchived, admin = null) {
  return updateAsset(id, { isArchived }, admin);
}

/*
 * پاک‌کردن فایل از کتابخانهٔ رسانه. اگر فایل در محتوایی استفاده شده باشد،
 * حذف رد می‌شود تا ارجاع مرده نماند. حذف واقعی فایل فیزیکی از پوشهٔ uploads
 * با همان تابع آزموده‌شدهٔ CMS انجام می‌شود — یک مسیر، نه دو تا.
 */
export function deleteAsset(id, { force = false } = {}) {
  const items = readCollection('media');
  const target = items.find((row) => row.id === id);
  if (!target) return null;

  const contents = readCollection('mediaContents');
  const usedIn = contents.filter((content) => (content.assets ?? []).some((asset) => asset.mediaId === id || asset.url === target.url));

  if (usedIn.length && !force) {
    fail(`این فایل در ${usedIn.length} محتوا استفاده شده است؛ اول آن‌ها را اصلاح کنید`, 'CONFLICT');
  }

  deleteMedia(id);
  return { deleted: id, detachedFrom: usedIn.length };
}

/* ─────────────────────────── گزارش رویدادها ─────────────────────────── */

/*
 * رویدادهای مرکز رسانه از همان لاگ مرکزی پروژه خوانده می‌شوند و فقط فیلتر
 * می‌شوند. پس «چه کسی، چه زمانی، چه کاری روی چه چیزی» از یک منبع حقیقت
 * می‌آید و دو لاگ موازی که واگرا شوند وجود ندارد.
 */
export function listMediaAudit({ search = '', action = 'all', entityType = 'all', page = 1, perPage = 20 } = {}) {
  const needle = String(search ?? '').trim().toLowerCase();

  const rows = readCollection('activity')
    .filter((entry) => {
      if (!MEDIA_ENTITY_TYPES.includes(entry.entityType)) return false;
      if (entityType !== 'all' && entry.entityType !== entityType) return false;
      if (action !== 'all' && entry.action !== action) return false;
      if (needle && !`${entry.adminName} ${entry.action} ${entry.entityLabel}`.toLowerCase().includes(needle)) return false;
      return true;
    })
    .map((entry) => ({
      id: entry.id,
      /* نام فیلدها همان قرارداد `activity` است: userId/userName/createdAt */
      at: entry.createdAt,
      adminId: entry.userId,
      adminName: entry.userName,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityLabel: entry.entityLabel,
      metadata: entry.metadata ?? null,
      ip: entry.ip ?? '',
    }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const actions = [...new Set(readCollection('activity')
    .filter((entry) => MEDIA_ENTITY_TYPES.includes(entry.entityType))
    .map((entry) => entry.action))].sort();

  const size = Math.min(Math.max(Number(perPage) || 20, 1), 100);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(Number(page) || 1, 1), pages);
  const start = (current - 1) * size;

  return {
    items: rows.slice(start, start + size),
    actions,
    entityTypes: MEDIA_ENTITY_TYPES,
    total: rows.length,
    page: current,
    perPage: size,
    pages,
  };
}

/* ─────────────────────────────── داشبورد ─────────────────────────────── */

export function mediaOverview({ range = '30d', from = null, to = null } = {}) {
  const resolved = resolveRange({ range, from, to });

  const accounts = readCollection('mediaAccounts');
  const metrics = readCollection('mediaMetrics');
  const contents = readCollection('mediaContents');
  const campaigns = readCollection('mediaCampaigns');
  const tags = readCollection('mediaTags');
  const utmLinks = readCollection('mediaUtm');

  const overview = buildOverview({
    accounts,
    metrics,
    contents,
    campaigns,
    tags,
    utmLinks,
    platformIds: PLATFORM_CATALOG.map((platform) => platform.id),
    resolved,
  });

  return {
    ...overview,
    demo: mediaMeta().demo,
    accountsWithoutMetrics: accounts.filter((account) => !metrics.some((row) => row.accountId === account.id)).length,
    queue: publishQueue(),
    contentStats: contentStats(contents),
  };
}

/* سری زمانی یک اکانت مشخص — برای نمودار صفحهٔ اکانت */
export function accountSeries(accountId, { range = '30d', from = null, to = null } = {}) {
  const resolved = resolveRange({ range, from, to });
  const account = getAccount(accountId);
  if (!account) return null;

  const metrics = readCollection('mediaMetrics');
  const contents = readCollection('mediaContents');

  const inWindow = metrics
    .filter((row) => row.accountId === accountId && row.date >= dayKey(resolved.from) && row.date <= dayKey(resolved.to))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const totals = totalsByAccount(metrics, resolved.from, resolved.to, [accountId])[0] ?? {};

  return {
    account: publicAccount(account),
    range: resolved,
    series: inWindow.map((row) => ({
      date: row.date,
      followers: row.followers,
      reach: row.reach,
      impressions: row.impressions,
      engagement: row.engagement,
      views: row.views,
    })),
    totals,
    contents: contents
      .filter((content) => content.accountId === accountId)
      .map((content) => publicContent(content, mediaContext()))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 30),
  };
}

/* ─────────────────────── تحلیل یک محتوا + مقایسه ─────────────────────── */

export function contentAnalytics(id) {
  const content = rawContent(id);
  if (!content) return null;

  const all = readCollection('mediaContents');
  const context = mediaContext();
  const peers = compareToPeers(content, all);

  return {
    content: publicContent(content, context),
    peers,
    /* بازهٔ مقایسه: همهٔ محتواهای منتشرشدهٔ همین نوع روی همین پلتفرم */
    peerCount: all.filter((row) => row.id !== id && row.status === 'published' && row.contentType === content.contentType && row.platform === content.platform).length,
  };
}

/* ──────────────────── تحلیل پلتفرم، نوع محتوا، هشتگ ──────────────────── */

export function mediaAnalytics({ range = '30d', from = null, to = null, compare = [] } = {}) {
  const resolved = resolveRange({ range, from, to });

  const accounts = readCollection('mediaAccounts');
  const metrics = readCollection('mediaMetrics');
  const contents = readCollection('mediaContents');
  const tags = readCollection('mediaTags');
  const utmLinks = readCollection('mediaUtm');

  const overview = buildOverview({
    accounts, metrics, contents, campaigns: [], tags, utmLinks,
    platformIds: PLATFORM_CATALOG.map((platform) => platform.id),
    resolved,
  });

  const selected = Array.isArray(compare) && compare.length ? compare : null;

  const perAccount = totalsByAccount(metrics, resolved.from, resolved.to)
    .map((row) => {
      const account = accounts.find((item) => item.id === row.accountId);
      return {
        accountId: row.accountId,
        accountName: account?.name ?? '',
        platform: row.platform,
        platformLabel: catalogById(row.platform)?.label ?? row.platform,
        ...row,
        engagementRate: Number.isFinite(row.reach) && row.reach > 0 && Number.isFinite(row.engagement)
          ? (row.engagement / row.reach) * 100
          : null,
      };
    })
    .sort((a, b) => (b.reach ?? -1) - (a.reach ?? -1));

  const comparison = selected
    ? overview.platforms.filter((row) => selected.includes(row.platform))
    : overview.platforms;

  return {
    range: overview.range,
    platforms: overview.platforms,
    comparison,
    perAccount,
    contentTypes: overview.contentTypes,
    tags: tagPerformance(tags, contents),
    funnel: overview.funnel,
    series: overview.series,
    topContents: rankContents(contentsInRange(contents, resolved.from, resolved.to)).ranked.slice(0, 10),
    demo: mediaMeta().demo,
  };
}

function contentsInRange(contents, from, to) {
  return contents.filter((content) => {
    const stamp = content.publishedAt ?? content.scheduledAt;
    if (!stamp) return false;
    const time = new Date(stamp).getTime();
    return time >= new Date(from).getTime() && time <= new Date(to).getTime();
  });
}

/* ───────────────────────────── گزارش‌ها ───────────────────────────── */

/*
 * گزارش یک شیء آمادهٔ خروجی است: عنوان، بازه، سطرهای تخت و خلاصه.
 * UI همین را به CSV/Excel/PDF تبدیل می‌کند؛ پس منطق گزارش یک‌جا است.
 */
export function buildReport({ kind = 'platform', range = '30d', from = null, to = null, campaignId = null, platform = null, teamId = null } = {}) {
  const resolved = resolveRange({ range, from, to });
  const label = rangeLabel(resolved);

  const accounts = readCollection('mediaAccounts');
  const metrics = readCollection('mediaMetrics');
  const contents = readCollection('mediaContents');
  const campaigns = readCollection('mediaCampaigns');
  const team = readCollection('mediaTeam');
  const utmLinks = readCollection('mediaUtm');

  const overview = buildOverview({
    accounts, metrics, contents, campaigns, tags: readCollection('mediaTags'), utmLinks,
    platformIds: PLATFORM_CATALOG.map((item) => item.id),
    resolved,
  });

  const scopedContents = contentsInRange(contents, resolved.from, resolved.to);

  const base = {
    kind,
    title: '',
    range: { ...resolved, label },
    generatedAt: nowIso(),
    demo: mediaMeta().demo,
    summary: [],
    columns: [],
    rows: [],
  };

  if (kind === 'daily' || kind === 'weekly' || kind === 'monthly') {
    return {
      ...base,
      title: kind === 'daily' ? 'گزارش روزانهٔ رسانه' : kind === 'weekly' ? 'گزارش هفتگی رسانه' : 'گزارش ماهانهٔ رسانه',
      summary: [
        { label: 'بازدید', value: overview.kpis.find((kpi) => kpi.key === 'views')?.value },
        { label: 'Reach', value: overview.kpis.find((kpi) => kpi.key === 'reach')?.value },
        { label: 'تعامل', value: overview.kpis.find((kpi) => kpi.key === 'engagement')?.value },
        { label: 'دنبال‌کننده', value: overview.kpis.find((kpi) => kpi.key === 'followers')?.value },
        { label: 'محتوا منتشرشده', value: overview.kpis.find((kpi) => kpi.key === 'published')?.value },
      ],
      columns: ['تاریخ', 'بازدید', 'Reach', 'تعامل', 'دنبال‌کننده'],
      rows: overview.series.daily.map((row) => [row.date, row.views, row.reach, row.engagement, row.followers]),
    };
  }

  if (kind === 'campaign') {
    const scoped = campaignId ? campaigns.filter((row) => row.id === campaignId) : campaigns;
    const rows = listCampaigns();

    return {
      ...base,
      title: campaignId ? `گزارش کمپین «${scoped[0]?.name ?? ''}»` : 'گزارش کمپین‌ها',
      summary: [
        { label: 'تعداد کمپین', value: scoped.length },
        { label: 'کمپین فعال', value: scoped.filter((row) => row.status === 'active').length },
      ],
      columns: ['کمپین', 'وضعیت', 'محتوا', 'Reach', 'تعامل', 'کلیک'],
      rows: rows.filter((row) => !campaignId || row.id === campaignId)
        .map((row) => [row.name, CAMPAIGN_STATUSES.find((status) => status.id === row.status)?.label ?? row.status, row.metrics.contentCount, row.metrics.reach, row.metrics.engagement, row.metrics.clicks]),
    };
  }

  if (kind === 'content') {
    const rows = rankContents(scopedContents).ranked;

    return {
      ...base,
      title: 'گزارش عملکرد محتوا',
      summary: [
        { label: 'محتوا در بازه', value: scopedContents.length },
        { label: 'منتشرشده', value: scopedContents.filter((row) => row.status === 'published').length },
      ],
      columns: ['عنوان', 'پلتفرم', 'نوع', 'Reach', 'تعامل', 'نرخ تعامل'],
      rows: rows.map((row) => [row.title, row.platform, row.contentType, row.metrics?.reach ?? null, row.metrics?.engagement ?? null, row.score]),
    };
  }

  if (kind === 'team') {
    const rows = listTeam();

    return {
      ...base,
      title: 'گزارش عملکرد تیم رسانه',
      summary: [{ label: 'اعضای تیم', value: rows.length }],
      columns: ['نام', 'نقش', 'تولید', 'منتشرشده', 'در انتظار تأیید'],
      rows: rows.filter((row) => !teamId || row.id === teamId)
        .map((row) => [row.name, row.roleLabel, row.metrics.contentCount, row.metrics.publishedCount, row.metrics.pendingReview]),
    };
  }

  /* پیش‌فرض: گزارش پلتفرم */
  const platforms = platform ? overview.platforms.filter((row) => row.platform === platform) : overview.platforms;

  return {
    ...base,
    title: platform ? `گزارش پلتفرم «${catalogById(platform)?.label ?? platform}»` : 'گزارش عملکرد پلتفرم‌ها',
    summary: [
      { label: 'پلتفرم فعال', value: overview.kpis.find((kpi) => kpi.key === 'platforms')?.value },
      { label: 'دنبال‌کننده', value: overview.kpis.find((kpi) => kpi.key === 'followers')?.value },
      { label: 'Reach', value: overview.kpis.find((kpi) => kpi.key === 'reach')?.value },
    ],
    columns: ['پلتفرم', 'اکانت', 'دنبال‌کننده', 'بازدید', 'Reach', 'Impressions', 'تعامل', 'نرخ تعامل', 'محتوا'],
    rows: platforms.map((row) => [
      catalogById(row.platform)?.label ?? row.platform,
      row.accounts,
      row.followers,
      row.views,
      row.reach,
      row.impressions,
      row.engagement,
      row.engagementRate,
      row.contents,
    ]),
  };
}

function rangeLabel(resolved) {
  const preset = MEDIA_RANGES.find((item) => item.key === resolved.key);
  if (resolved.key !== 'custom') return preset?.label ?? resolved.key;
  return `${dayKey(resolved.from)} تا ${dayKey(resolved.to)}`;
}

/* ───────────────────────────── جستجوی مرکزی ───────────────────────────── */

/*
 * یک جستجو روی همهٔ موجودیت‌ها. برای هر گروه حداکثر چند نتیجه برمی‌گردد تا
 * پاسخ سبک بماند و UI بتواند گروه‌بندی کند.
 */
export function mediaSearch(term, { limit = 6 } = {}) {
  const needle = String(term ?? '').trim().toLowerCase();
  if (needle.length < 2) return { term, groups: [], total: 0 };

  const context = mediaContext();
  const match = (haystack) => String(haystack ?? '').toLowerCase().includes(needle);

  const groups = [
    {
      id: 'contents',
      label: 'محتوا',
      items: readCollection('mediaContents')
        .filter((row) => match(`${row.title} ${row.caption}`))
        .slice(0, limit)
        .map((row) => ({ id: row.id, title: row.title, subtitle: row.status, target: 'content', targetId: row.id })),
    },
    {
      id: 'campaigns',
      label: 'کمپین',
      items: readCollection('mediaCampaigns')
        .filter((row) => match(`${row.name} ${row.description}`))
        .slice(0, limit)
        .map((row) => ({ id: row.id, title: row.name, subtitle: row.status, target: 'campaign', targetId: row.id })),
    },
    {
      id: 'platforms',
      label: 'پلتفرم',
      items: PLATFORM_CATALOG
        .filter((row) => match(row.label))
        .slice(0, limit)
        .map((row) => ({ id: row.id, title: row.label, subtitle: row.adapter ? 'با آداپتور' : 'دستی', target: 'platform', targetId: row.id })),
    },
    {
      id: 'accounts',
      label: 'اکانت',
      items: context.accounts
        .filter((row) => match(`${row.name} ${row.handle} ${row.externalId}`))
        .slice(0, limit)
        .map((row) => ({ id: row.id, title: row.name, subtitle: catalogById(row.platform)?.label ?? row.platform, target: 'account', targetId: row.id })),
    },
    {
      id: 'team',
      label: 'عضو تیم',
      items: context.team
        .filter((row) => match(row.name))
        .slice(0, limit)
        .map((row) => ({ id: row.id, title: row.name, subtitle: row.role, target: 'team', targetId: row.id })),
    },
    {
      id: 'assets',
      label: 'فایل رسانه',
      items: readCollection('media')
        .filter((row) => match(`${row.originalName} ${row.filename}`))
        .slice(0, limit)
        .map((row) => ({ id: row.id, title: row.originalName, subtitle: row.mimeType, target: 'asset', targetId: row.id })),
    },
    {
      id: 'tags',
      label: 'هشتگ و موضوع',
      items: readCollection('mediaTags')
        .filter((row) => match(`${row.label} ${row.slug}`))
        .slice(0, limit)
        .map((row) => ({ id: row.id, title: row.label, subtitle: row.kind === 'hashtag' ? 'هشتگ' : 'موضوع', target: 'tag', targetId: row.id })),
    },
  ].filter((group) => group.items.length);

  return {
    term,
    groups,
    total: groups.reduce((total, group) => total + group.items.length, 0),
  };
}

/* ─────────────────────────── تنظیمات و متادیتا ─────────────────────────── */

export function mediaMeta() {
  const rows = readCollection('mediaMeta');
  return rows[0] ?? { id: 'meta', seededAt: null, seedVersion: 0, demo: false };
}

function writeMediaMeta(patch) {
  const rows = readCollection('mediaMeta');
  const next = { id: 'meta', ...(rows[0] ?? {}), ...patch, updatedAt: nowIso() };
  writeCollection('mediaMeta', [next]);
  return next;
}

/* همهٔ چیزهایی که UI برای ساختن فرم‌ها و برچسب‌ها لازم دارد — یک درخواست */
export function mediaConfig() {
  return {
    platforms: PLATFORM_CATALOG,
    contentStatuses: CONTENT_STATUSES,
    contentTransitions: CONTENT_TRANSITIONS,
    contentTypes: CONTENT_TYPES,
    accountKinds: ACCOUNT_KINDS,
    mediaRoles: MEDIA_ROLES,
    campaignStatuses: CAMPAIGN_STATUSES,
    inboxStatuses: INBOX_STATUSES,
    inboxKinds: INBOX_KINDS,
    notificationLevels: NOTIFICATION_LEVELS,
    tagKinds: TAG_KINDS,
    assetKinds: ASSET_KINDS,
    utmMediums: UTM_MEDIUMS,
    ranges: MEDIA_RANGES,
    siteUrl: String(process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, ''),
    forcedDryRun: process.env.PUBLISH_DRY_RUN === '1',
    demo: mediaMeta().demo,
  };
}

/* ─────────────────────────── دادهٔ نمونه ─────────────────────────── */

/*
 * چرا دادهٔ نمونه وجود دارد؟ چون این بخش باید بدون هیچ API واقعی کامل قابل
 * استفاده و تست باشد (خواستهٔ صریح). ولی «نمونه» بودنش پنهان نمی‌شود:
 *   - همه‌جا `source: 'seed'` می‌خورد.
 *   - پرچم `demo` در `mediaMeta` می‌نشیند و UI بنر «دادهٔ نمونه» نشان می‌دهد.
 *   - دکمهٔ «پاک‌کردن دادهٔ نمونه» فقط رکوردهای seed را حذف می‌کند و به دادهٔ
 *     واقعی کاری ندارد.
 *
 * تولید اعداد با PRNG بذردار است تا هر بار همان داده ساخته شود (تکرارپذیر،
 * بدون churn در فایل‌ها).
 */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const SEED_PLATFORMS = [
  { platform: 'instagram', label: 'اینستاگرام تپش', description: 'صفحهٔ اصلی تپش در اینستاگرام — محتوای آموزشی و معرفی دوره‌ها' },
  { platform: 'telegram', label: 'تلگرام تپش', description: 'کانال اصلی اطلاع‌رسانی و فایل‌های آموزشی' },
  { platform: 'eitaa', label: 'ایتا تپش', description: 'کانال ایتا برای کاربران داخلی' },
  { platform: 'bale', label: 'بله تپش', description: 'کانال بله — ارسال از پنل انتشار' },
];

const SEED_ACCOUNTS = [
  { platform: 'instagram', name: 'تپش — صفحهٔ اصلی', handle: '@tapesh.med', kind: 'profile', url: 'https://instagram.com/tapesh.med', base: 18400 },
  { platform: 'instagram', name: 'تپش پزشکی', handle: '@tapesh.medical', kind: 'profile', url: 'https://instagram.com/tapesh.medical', base: 6200 },
  { platform: 'telegram', name: 'کانال اصلی تپش', handle: '@tapesh', kind: 'channel', url: 'https://t.me/tapesh', base: 11250 },
  { platform: 'telegram', name: 'کانال اطلاع‌رسانی', handle: '@tapesh_news', kind: 'channel', url: 'https://t.me/tapesh_news', base: 4300 },
  { platform: 'eitaa', name: 'کانال ایتا تپش', handle: '@tapesh', kind: 'channel', url: '', base: 2950 },
  { platform: 'bale', name: 'کانال بله تپش', handle: '@tapesh_bale', kind: 'channel', url: '', base: 1180 },
];

const SEED_TAGS = [
  { kind: 'topic', label: 'فیزیولوژی', color: '#937fcd' },
  { kind: 'topic', label: 'آناتومی', color: '#5b8cc7' },
  { kind: 'topic', label: 'بیوشیمی', color: '#61d192' },
  { kind: 'topic', label: 'باکتری‌شناسی', color: '#e0b45c' },
  { kind: 'topic', label: 'علوم پایه', color: '#ab8e7c' },
  { kind: 'topic', label: 'آزمون', color: '#e26d6d' },
  { kind: 'topic', label: 'مطالعات پزشکی', color: '#7cbf8f' },
  { kind: 'topic', label: 'زندگی دانشجویی', color: '#c39a6b' },
  { kind: 'topic', label: 'اخبار تپش', color: '#8f9aa8' },
  { kind: 'topic', label: 'معرفی محصول', color: '#d98b6a' },
  { kind: 'hashtag', label: 'tapesh', color: '' },
  { kind: 'hashtag', label: 'علوم_پایه', color: '' },
  { kind: 'hashtag', label: 'آزمون_علوم_پزشکی', color: '' },
  { kind: 'hashtag', label: 'فیزیولوژی', color: '' },
  { kind: 'hashtag', label: 'آناتومی', color: '' },
];

const SEED_TEAM = [
  { name: 'امیرحسین رضایی', role: 'admin', responsibility: 'مدیریت کل رسانه و تأیید نهایی محتوا' },
  { name: 'سارا محمدی', role: 'media-manager', responsibility: 'برنامه‌ریزی تقویم محتوایی و هماهنگی تیم' },
  { name: 'مهدی کاظمی', role: 'content-manager', responsibility: 'تولید و بازبینی محتوای آموزشی' },
  { name: 'نگار احمدی', role: 'designer', responsibility: 'طراحی پوستر، اینفوگرافیک و کاور' },
  { name: 'پویا نیک‌پور', role: 'video-editor', responsibility: 'تدوین ویدئو و ریلز آموزشی' },
  { name: 'ریحانه سلطانی', role: 'analyst', responsibility: 'تحلیل عملکرد پلتفرم‌ها و گزارش‌گیری' },
];

const SEED_CAMPAIGNS = [
  { name: 'کمپین شروع ترم', goal: 'افزایش ثبت‌نام دوره‌های علوم پایه در شروع ترم', status: 'active' },
  { name: 'کمپین علوم پایه', goal: 'جذب مخاطب علاقه‌مند به علوم پایه', status: 'active' },
  { name: 'کمپین آزمون', goal: 'معرفی آزمون‌های آزمایشی تپش', status: 'active' },
  { name: 'کمپین معرفی تپش', goal: 'برندسازی و معرفی پلتفرم به دانشجویان تازه‌ورود', status: 'active' },
  { name: 'کمپین اشتراک ویژه', goal: 'فروش اشتراک ویژه', status: 'planned' },
  { name: 'کمپین المپیاد', goal: 'جذب دانشجویان المپیادی', status: 'planned' },
  { name: 'کمپین محتوای آموزشی', goal: 'تولید مستمر محتوای آموزشی رایگان', status: 'active' },
];

const SEED_CONTENT_TITLES = [
  ['پوستر جمع‌بندی فیزیولوژی قلبی', 'post', 'image'],
  ['ریلز نکات طلایی آناتومی اندام فوقانی', 'reel', 'video'],
  ['اینفوگرافیک مسیر سوخت‌وساز', 'infographic', 'image'],
  ['اطلاعیهٔ شروع ثبت‌نام دورهٔ علوم پایه', 'announcement', 'text'],
  ['استوری نظرسنجی منابع مطالعاتی', 'story', 'image'],
  ['ویدئو تحلیل سوالات بیوشیمی', 'video', 'video'],
  ['کاروسل باکتری‌شناسی بالینی', 'carousel', 'image'],
  ['پست معرفی دورهٔ آمادگی آزمون', 'post', 'image'],
  ['پادکست گفتگو با رتبهٔ برتر', 'podcast', 'audio'],
  ['کوییز آناتومی سر و گردن', 'quiz', 'interactive'],
  ['ترد نکات مرور سریع فیزیولوژی', 'thread', 'text'],
  ['پست زندگی دانشجویی — مدیریت زمان', 'post', 'image'],
  ['ریلز پشت صحنهٔ تیم تپش', 'reel', 'video'],
  ['اطلاعیهٔ آزمون آزمایشی هفتهٔ آینده', 'announcement', 'text'],
  ['اینفوگرافیک مقایسهٔ منابع آناتومی', 'infographic', 'image'],
  ['پست معرفی اپلیکیشن تپش', 'post', 'image'],
  ['ویدئو حل تشریحی سوالات آزمون', 'video', 'video'],
  ['نظرسنجی انتخاب موضوع وبینار', 'poll', 'interactive'],
  ['کاروسل خلاصهٔ ایمنی‌شناسی', 'carousel', 'image'],
  ['پست انگیزشی شروع ترم', 'post', 'image'],
  ['پادکست مرور هفتگی اخبار پزشکی', 'podcast', 'audio'],
  ['استوری معرفی دورهٔ المپیاد', 'story', 'image'],
  ['ترد منابع پیشنهادی باکتری‌شناسی', 'thread', 'text'],
  ['ریلز تکنیک مطالعهٔ فعال', 'reel', 'video'],
];

const SEED_INBOX_TEXTS = [
  'سلام، دورهٔ علوم پایه برای ترم جدید کی شروع می‌شود؟',
  'اینفوگرافیک عالی بود، فایل PDF‌ش رو دارید؟',
  'لینک ثبت‌نام آزمون آزمایشی باز نمی‌شود.',
  'ممنون از محتوای رایگان‌تون، خیلی کمک کرد.',
  'قیمت اشتراک ویژه چنده؟ تخفیف دانشجویی دارید؟',
  'ویدئو صدا نداشت، لطفاً دوباره آپلود کنید.',
  'برای المپیاد هم دوره دارید؟',
  'پوستر فیزیولوژی رو در کانال تلگرام هم بذارید لطفاً.',
  'منابع آناتومی پیشنهادی شما چیه؟',
  'خیلی ممنون، آزمون آزمایشی خیلی شبیه آزمون اصلی بود.',
];

const SEED_MENTION_TEXTS = [
  'تپش بهترین پلتفرم برای جمع‌بندی علوم پایه است.',
  'از تپش برای آزمون علوم پزشکی استفاده کردم، راضی بودم.',
  'دوستان کسی تجربهٔ استفاده از دوره‌های تپش رو داره؟',
  'اینفوگرافیک‌های تپش واقعاً بی‌نظیره.',
  'سایت تپش امروز کند بود، برای بقیه هم همینطوره؟',
  'بهترین چیز تپش، آزمون‌های آزمایشی با تحلیل سواله.',
  'منابع تپش با کتاب‌های مرجع هماهنگه؟',
  'دورهٔ المپیاد تپش ارزش ثبت‌نام داره؟',
];

const SEED_UTM = [
  { label: 'بیو اینستاگرام — صفحهٔ اصلی', source: 'instagram', medium: 'social', baseUrl: 'https://tapesh.ir/' },
  { label: 'لینک کانال تلگرام', source: 'telegram', medium: 'social', baseUrl: 'https://tapesh.ir/#dashboard' },
  { label: 'استوری معرفی دوره', source: 'instagram', medium: 'social', baseUrl: 'https://tapesh.ir/#courses' },
  { label: 'کمپین شروع ترم — تلگرام', source: 'telegram', medium: 'social-paid', baseUrl: 'https://tapesh.ir/#courses' },
  { label: 'کانال ایتا', source: 'eitaa', medium: 'social', baseUrl: 'https://tapesh.ir/' },
];

/*
 * seed یک‌بار اجرا می‌شود. اگر `mediaMeta.seedVersion` برابر نسخهٔ فعلی باشد،
 * دوباره کاری نمی‌کند — پس اجرای پیاپی سرور چیزی را بازنویسی نمی‌کند.
 */
const SEED_VERSION = 1;

export function ensureMediaStore({ force = false } = {}) {
  const meta = mediaMeta();
  if (!force && meta.seedVersion === SEED_VERSION) return { seeded: false, meta };

  const random = makeRandom(20260916);
  const now = new Date();
  const stamp = nowIso();

  /* ── پلتفرم‌ها ── */
  const platforms = SEED_PLATFORMS.map((row) => ({
    id: row.platform,
    label: row.label,
    isActive: true,
    description: row.description,
    logo: '',
    managerId: null,
    startedAt: dayKey(new Date(now.getTime() - 420 * 24 * 60 * 60 * 1000)),
    notes: '',
    createdAt: stamp,
    updatedAt: stamp,
    createdBy: 'system',
    createdByName: 'دادهٔ نمونه',
    seed: true,
  }));
  writeCollection('mediaPlatforms', platforms);

  /* ── تیم ── */
  const team = SEED_TEAM.map((row, index) => ({
    id: `tm-seed${index + 1}`,
    ...row,
    avatar: '',
    platformIds: [],
    campaignIds: [],
    email: '',
    phone: '',
    adminId: null,
    isActive: true,
    createdAt: stamp,
    createdBy: 'system',
    seed: true,
  }));
  writeCollection('mediaTeam', team);

  /* ── هشتگ و موضوع ── */
  const tags = SEED_TAGS.map((row, index) => ({
    id: `tag-seed${index + 1}`,
    kind: row.kind,
    label: row.label,
    slug: slugify(row.label),
    color: row.color,
    description: '',
    usageCount: 0,
    createdAt: stamp,
    seed: true,
  }));
  writeCollection('mediaTags', tags);

  const topicIds = tags.filter((tag) => tag.kind === 'topic').map((tag) => tag.id);

  /* ── اکانت‌ها ── */
  const accounts = SEED_ACCOUNTS.map((row, index) => ({
    id: `acc-seed${index + 1}`,
    platform: row.platform,
    name: row.name,
    handle: row.handle,
    url: row.url,
    externalId: row.handle,
    internalId: `tpsh-${row.platform}-${index + 1}`,
    kind: row.kind,
    isActive: true,
    avatar: '',
    description: '',
    managerId: index % 2 === 0 ? 'tm-seed1' : 'tm-seed2',
    memberIds: ['tm-seed1', 'tm-seed2'],
    startedAt: dayKey(new Date(now.getTime() - (400 - index * 20) * 24 * 60 * 60 * 1000)),
    publishChannelId: null,
    audience: { followers: row.base, following: null, posts: null },
    metrics: null,
    lastActivityAt: stamp,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncMessage: '',
    createdAt: stamp,
    updatedAt: stamp,
    createdBy: 'system',
    createdByName: 'دادهٔ نمونه',
    seed: true,
  }));
  writeCollection('mediaAccounts', accounts);

  /* ── کمپین‌ها ── */
  const campaigns = SEED_CAMPAIGNS.map((row, index) => {
    const start = new Date(now.getTime() - (150 - index * 12) * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + (60 + index * 5) * 24 * 60 * 60 * 1000);

    return {
      id: `cmp-seed${index + 1}`,
      name: row.name,
      description: '',
      goal: row.goal,
      status: row.status,
      startAt: dayKey(start),
      endAt: dayKey(end),
      budget: [12000000, 8000000, 15000000, 6000000, 20000000, 5000000, 9000000][index] ?? null,
      ownerId: team[index % team.length].id,
      platformIds: SEED_PLATFORMS.map((platform) => platform.platform).slice(0, (index % 3) + 2),
      tagIds: topicIds.slice(0, (index % 3) + 1),
      utmId: null,
      createdAt: stamp,
      updatedBy: 'system',
      createdByName: 'دادهٔ نمونه',
      seed: true,
    };
  });
  writeCollection('mediaCampaigns', campaigns);

  /* ── محتوا ── */
  const statusCycle = [
    'published', 'published', 'published', 'scheduled', 'draft', 'review',
    'published', 'approved', 'published', 'scheduled', 'draft', 'published',
    'published', 'scheduled', 'published', 'draft', 'published', 'review',
    'published', 'approved', 'published', 'draft', 'published', 'failed',
  ];

  const contents = SEED_CONTENT_TITLES.map(([title, contentType, assetKind], index) => {
    const account = accounts[index % accounts.length];
    const status = statusCycle[index % statusCycle.length];
    const campaign = campaigns[index % campaigns.length];

    const daysAgo = status === 'published' ? (index * 3) % 88 + 1 : null;
    /* یک محتوا امروز منتشر شده تا سنجهٔ «منتشرشدهٔ امروز» خالی نماند */
    const publishedAt = status === 'published'
      ? (index === 0 ? stamp : new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString())
      : null;
    /* و یک محتوا همین حالا وقت انتشارش رسیده تا صف انتشار قابل دیدن باشد */
    const scheduledAt = status === 'scheduled' || status === 'approved'
      ? (index === 3
        ? new Date(now.getTime() - 15 * 60 * 1000).toISOString()
        : new Date(now.getTime() + ((index % 9) + 1) * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString())
      : null;

    const base = 900 + Math.round(random() * 5200);
    const reach = status === 'published' ? base : null;
    const interactions = reach ? Math.round(reach * (0.03 + random() * 0.09)) : null;

    const metrics = status === 'published' ? {
      views: reach ? reach + Math.round(random() * 1800) : null,
      reach,
      impressions: reach ? Math.round(reach * 1.28) : null,
      likes: interactions ? Math.round(interactions * 0.78) : null,
      comments: interactions ? Math.round(interactions * 0.09) : null,
      shares: interactions ? Math.round(interactions * 0.07) : null,
      saves: interactions ? Math.round(interactions * 0.06) : null,
      clicks: reach ? Math.round(reach * (0.008 + random() * 0.02)) : null,
      engagement: interactions,
      watchTime: assetKind === 'video' ? Math.round(random() * 4200) : null,
      avgWatchTime: assetKind === 'video' ? Math.round(12 + random() * 40) : null,
      completionRate: assetKind === 'video' ? Math.round(28 + random() * 48) : null,
      followersGained: reach ? Math.round(random() * 120) : null,
      profileVisits: reach ? Math.round(reach * 0.04) : null,
      websiteClicks: reach ? Math.round(reach * (0.004 + random() * 0.01)) : null,
      conversions: reach ? Math.round(random() * 18) : null,
    } : null;

    const topic = topicIds[index % topicIds.length];
    const hashtagLabels = tags.filter((tag) => tag.kind === 'hashtag').slice(index % 3, (index % 3) + 2).map((tag) => tag.slug);

    return {
      id: `cnt-seed${index + 1}`,
      title,
      caption: `${title}\n\nمحتوای آموزشی تپش برای دانشجویان علوم پزشکی.`,
      contentType,
      platform: account.platform,
      accountId: account.id,
      campaignId: campaign.id,
      tagIds: [topic],
      hashtags: hashtagLabels,
      mentions: [],
      links: [],
      cta: 'برای مشاهدهٔ دوره به سایت تپش سر بزنید',
      assets: assetKind === 'text' || assetKind === 'interactive' ? [] : [{
        mediaId: null,
        url: '',
        filename: `${contentType}-${index + 1}`,
        mimeType: assetKind === 'video' ? 'video/mp4' : assetKind === 'audio' ? 'audio/mpeg' : 'image/jpeg',
        kind: assetKind,
      }],
      thumbnail: '',
      status,
      scheduledAt,
      publishedAt,
      timezone: 'Asia/Tehran',
      authorId: team[(index + 2) % team.length].id,
      reviewerId: team[0].id,
      utmId: null,
      metrics,
      publishResult: null,
      rejection: null,
      history: [{
        at: publishedAt ?? stamp,
        byId: 'system',
        byName: 'دادهٔ نمونه',
        from: null,
        to: status,
        action: 'created',
        note: '',
      }],
      notes: '',
      createdAt: new Date(now.getTime() - ((index * 3) % 90 + 2) * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: stamp,
      createdBy: 'system',
      createdByName: 'دادهٔ نمونه',
      seed: true,
    };
  });
  writeCollection('mediaContents', contents);

  /* ── سنجه‌های روزانه (۹۰ روز) ── */
  const metrics = [];

  accounts.forEach((account, accountIndex) => {
    const seedAccount = SEED_ACCOUNTS[accountIndex];
    let followers = seedAccount.base;
    let reachBase = 900 + accountIndex * 620;

    for (let dayOffset = 89; dayOffset >= 0; dayOffset -= 1) {
      const date = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const weekday = date.getDay();
      /* تعطیلات آخر هفته در ایران (پنجشنبه/جمعه) بازدید کمتری دارند */
      const weekendFactor = weekday === 4 || weekday === 5 ? 0.72 : 1;

      const growth = Math.round(18 + random() * 46 + accountIndex * 4);
      followers += growth;

      const reach = Math.round(reachBase * weekendFactor * (0.82 + random() * 0.42));
      const impressions = Math.round(reach * (1.2 + random() * 0.3));
      const views = reach + Math.round(random() * 900);
      const interactions = Math.round(reach * (0.035 + random() * 0.075));
      const clicks = Math.round(reach * (0.008 + random() * 0.016));

      metrics.push({
        id: `mtr-seed${accountIndex + 1}-${dayKey(date)}`,
        date: dayKey(date),
        accountId: account.id,
        platform: account.platform,
        source: 'seed',
        followers,
        following: account.platform === 'instagram' ? 320 + accountIndex * 40 : null,
        posts: 180 + accountIndex * 90 + Math.floor((89 - dayOffset) / 3),
        views,
        reach,
        impressions,
        likes: Math.round(interactions * 0.76),
        comments: Math.round(interactions * 0.1),
        shares: Math.round(interactions * 0.08),
        saves: Math.round(interactions * 0.06),
        clicks,
        engagement: interactions,
        websiteClicks: Math.round(clicks * (0.42 + random() * 0.24)),
        signups: Math.round(clicks * (0.05 + random() * 0.05)),
        purchases: Math.round(clicks * (0.008 + random() * 0.012)),
        createdAt: stamp,
        updatedAt: stamp,
        seed: true,
      });
    }

    reachBase = Math.round(reachBase * (1.04 + random() * 0.05));
  });

  writeCollection('mediaMetrics', metrics);

  /* ── اینباکس ── */
  const inboxStatuses = ['unread', 'read', 'pending', 'answered', 'important', 'ignored'];
  const inbox = SEED_INBOX_TEXTS.map((text, index) => {
    const account = accounts[index % accounts.length];
    const author = ['کاربر تپش', 'دانشجوی پزشکی', 'مریم ر.', 'علی ک.', 'زهرا م.', 'حسین ط.', 'نیلوفر ب.', 'سینا ر.', 'فاطمه ن.', 'امید ص.'][index];

    return {
      id: `inb-seed${index + 1}`,
      platform: account.platform,
      accountId: account.id,
      kind: ['comment', 'dm', 'message'][index % 3],
      authorName: author,
      authorHandle: `@user${1000 + index}`,
      authorAvatar: '',
      text,
      url: '',
      at: new Date(now.getTime() - (index * 7 + 2) * 60 * 60 * 1000).toISOString(),
      status: inboxStatuses[index % inboxStatuses.length],
      assignedToId: index % 3 === 0 ? team[1].id : null,
      tags: [],
      contentId: contents[index % contents.length].id,
      replies: [],
      createdAt: stamp,
      seed: true,
    };
  });
  writeCollection('mediaInbox', inbox);

  /* ── رصد نام ── */
  const sentiments = ['positive', 'positive', 'neutral', 'negative', 'positive', 'neutral', 'positive', 'neutral'];
  const mentions = SEED_MENTION_TEXTS.map((text, index) => {
    const keyword = tags.filter((tag) => tag.kind === 'topic')[index % 10];

    return {
      id: `mnt-seed${index + 1}`,
      platform: SEED_PLATFORMS[index % SEED_PLATFORMS.length].platform,
      keywordId: keyword.id,
      keywordLabel: keyword.label,
      authorName: ['کاربر اینستاگرام', 'دانشجوی ترم ۳', 'کاربر تلگرام', 'کاربر ایتا', 'دانشجوی پزشکی', 'کاربر بله', 'دانشجوی ترم ۵', 'کاربر اینستاگرام'][index],
      authorHandle: `@mention${2000 + index}`,
      text,
      url: '',
      at: new Date(now.getTime() - (index * 11 + 3) * 60 * 60 * 1000).toISOString(),
      sentiment: sentiments[index],
      reach: Math.round(400 + random() * 5200),
      handled: index % 3 === 0,
      createdAt: stamp,
      seed: true,
    };
  });
  writeCollection('mediaMentions', mentions);

  /* ── لینک‌های UTM ── */
  const utm = SEED_UTM.map((row, index) => {
    const clicks = Math.round(320 + random() * 2400);
    const visits = Math.round(clicks * (0.72 + random() * 0.22));

    return {
      id: `utm-seed${index + 1}`,
      label: row.label,
      baseUrl: row.baseUrl,
      url: buildUtmUrl({ baseUrl: row.baseUrl, source: row.source, medium: row.medium, campaign: campaigns[index % campaigns.length].name }),
      source: row.source,
      medium: row.medium,
      campaign: campaigns[index % campaigns.length].name,
      content: '',
      term: '',
      campaignId: campaigns[index % campaigns.length].id,
      contentId: contents[index].id,
      clicks,
      visits,
      signups: Math.round(visits * (0.05 + random() * 0.06)),
      purchases: Math.round(visits * (0.006 + random() * 0.014)),
      createdAt: stamp,
      createdByName: 'دادهٔ نمونه',
      seed: true,
    };
  });
  writeCollection('mediaUtm', utm);

  /* ── اعلان‌ها ── */
  writeCollection('mediaNotifications', []);
  refreshNotifications();

  rebuildTagUsage();

  const meta2 = writeMediaMeta({ seededAt: stamp, seedVersion: SEED_VERSION, demo: true });

  return {
    seeded: true,
    meta: meta2,
    counts: {
      platforms: platforms.length,
      accounts: accounts.length,
      contents: contents.length,
      metrics: metrics.length,
      campaigns: campaigns.length,
      team: team.length,
      tags: tags.length,
      inbox: inbox.length,
      mentions: mentions.length,
      utm: utm.length,
    },
  };
}

/*
 * پاک‌کردن **فقط** رکوردهای نمونه. دادهٔ واقعی (هر رکوردی که `seed` ندارد)
 * دست‌نخورده می‌ماند — این تفکیک همان چیزی است که اجازه می‌دهد کاربر با
 * خیال راحت دادهٔ نمونه را بردارد.
 */
export function clearDemoData() {
  const strip = (collection) => {
    const rows = readCollection(collection);
    const real = rows.filter((row) => !row.seed);
    const removed = rows.length - real.length;
    if (removed) writeCollection(collection, real);
    return removed;
  };

  const removed = {
    platforms: strip('mediaPlatforms'),
    accounts: strip('mediaAccounts'),
    contents: strip('mediaContents'),
    metrics: strip('mediaMetrics'),
    campaigns: strip('mediaCampaigns'),
    team: strip('mediaTeam'),
    tags: strip('mediaTags'),
    inbox: strip('mediaInbox'),
    mentions: strip('mediaMentions'),
    utm: strip('mediaUtm'),
    notifications: strip('mediaNotifications'),
  };

  writeMediaMeta({ demo: false, seedVersion: 0 });

  return { removed, total: Object.values(removed).reduce((total, value) => total + value, 0) };
}

/* خلاصهٔ کوچک برای هدر پنل و نشان‌های منو */
export function mediaSummary() {
  const contents = readCollection('mediaContents');
  const notifications = readCollection('mediaNotifications');
  const inbox = readCollection('mediaInbox');
  const accounts = readCollection('mediaAccounts');

  return {
    accounts: accounts.length,
    connectedAccounts: accounts.filter((account) => resolveAccountCredentials(account).token).length,
    contents: contents.length,
    pendingReview: contents.filter((content) => content.status === 'review').length,
    scheduled: contents.filter((content) => content.status === 'scheduled').length,
    failed: contents.filter((content) => content.status === 'failed').length,
    unreadNotifications: notifications.filter((row) => !row.isRead && !row.isArchived).length,
    unreadInbox: inbox.filter((row) => row.status === 'unread').length,
    demo: mediaMeta().demo,
  };
}

export { resolveAccountCredentials, hasAdapter, isKnownPlatform, catalogById, PLATFORM_CATALOG };
