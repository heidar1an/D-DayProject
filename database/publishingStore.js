/*
 * انبار انتشار تپش — کانال‌های شبکه‌های اجتماعی، توکن‌ها و تاریخچهٔ ارسال.
 *
 * این فایل دقیقاً ادامهٔ همان الگوی `contentStore.js` است: فایل JSON روی دیسک +
 * توابع دامنهٔ خالص. با مهاجرت به Backend واقعی، فقط بدنهٔ همین توابع عوض می‌شود.
 *
 * سه فایل، سه مسئولیت جدا:
 *   content/publishChannels.json  → تعریف کانال‌ها (نام، پلتفرم، chat_id، وضعیت)
 *   content/publishLog.json       → تاریخچهٔ هر تلاش ارسال (موفق/ناموفق/آزمایشی)
 *   publishing.secrets.json       → فقط توکن‌ها، با مجوز ۰۶۰۰، بیرون از content
 *
 * چرا توکن جدا شد؟ چون `content/` محتوای سایت است و ممکن است روزی Export یا
 * بکاپ عمومی شود؛ توکن ربات در بکاپ محتوا جایی ندارد. توکن هرگز در پاسخ API
 * برنمی‌گردد — فقط `hasToken` و یک راهنمای ماسک‌شده.
 *
 * اصل حاکم بر ارسال: **بدون توکن، هیچ درخواستی به بیرون نمی‌رود.** به‌جایش
 * وضعیت «آزمایشی» ثبت می‌شود و دقیقاً همان درخواستی که می‌رفت، در لاگ می‌ماند.
 * پس می‌توان کل مسیر را بدون هیچ اعتباری ساخت و دید.
 */

import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCollection, writeCollection } from './contentStore.js';
import {
  PLATFORM_LIST,
  isSupportedPlatform,
  platformById,
  platformMetrics,
  planPlatform,
  previewPlatformRequest,
  sendPlatform,
  summarizePlatform,
  verifyPlatform,
} from './publishers/index.js';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const uploadsDir = resolve(databaseDir, '..', 'public', 'uploads');
const secretsFile = resolve(databaseDir, 'publishing.secrets.json');

/*
 * پلتفرم‌هایی که در این نسخه پشتیبانی می‌شوند — از رجیستری آداپتورها خوانده
 * می‌شود، پس افزودن پلتفرم تازه اینجا هیچ تغییری نمی‌خواهد.
 */
export const PUBLISH_PLATFORMS = PLATFORM_LIST;

const PLATFORM_MAP = Object.fromEntries(PLATFORM_LIST.map((platform) => [platform.id, platform]));

export const PUBLISH_STATUSES = {
  sent: 'ارسال شد',
  failed: 'ناموفق',
  'dry-run': 'آزمایشی',
};

const TEXT_MAX = 4000;
const LOG_MAX = 400;
const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm'];

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function fail(message, code = 'VALIDATION_ERROR') {
  throw Object.assign(new Error(message), { code });
}

/* ─────────────────────────── توکن‌ها (فایل جدا) ─────────────────────────── */

function readSecrets() {
  if (!existsSync(secretsFile)) return { version: 1, tokens: {} };
  try {
    const parsed = JSON.parse(readFileSync(secretsFile, 'utf8'));
    return { version: 1, tokens: parsed?.tokens ?? {} };
  } catch {
    return { version: 1, tokens: {} };
  }
}

function writeSecrets(secrets) {
  writeFileSync(secretsFile, JSON.stringify(secrets, null, 2), 'utf8');
  /* فقط صاحب فایل بخواند/بنویسد — توکن ربات اینجاست */
  try {
    chmodSync(secretsFile, 0o600);
  } catch {
    /* روی برخی فایل‌سیستم‌ها chmod معنا ندارد؛ ذخیره انجام شده است */
  }
}

function storedToken(channelId) {
  return String(readSecrets().tokens?.[channelId] ?? '').trim();
}

/*
 * توکن مؤثر کانال: اول توکن اختصاصی خود کانال، بعد متغیر محیطی پلتفرم.
 * `source` برای این است که پنل بتواند بگوید «از env می‌خوانم» یا «توکن ثبت نشده».
 */
function resolveToken(channel) {
  const own = storedToken(channel.id);
  if (own) return { token: own, source: 'channel' };

  const platform = PLATFORM_MAP[channel.platform];
  const fromEnv = platform?.tokenEnv ? String(process.env[platform.tokenEnv] ?? '').trim() : '';
  if (fromEnv) return { token: fromEnv, source: 'env' };

  return { token: '', source: 'none' };
}

/* هرگز توکن کامل برنمی‌گردد؛ فقط ۴ رقم آخر برای اینکه کاربر بداند کدام را ثبت کرده */
function tokenHint(token) {
  if (!token) return '';
  const tail = token.slice(-4);
  return `••••${tail}`;
}

/* ─────────────────────────────── کانال‌ها ─────────────────────────────── */

/*
 * خروجی عمومی کانال — همین شکل به مرورگر می‌رود. فیلد `token` اینجا وجود ندارد
 * و هیچ‌جای مسیر API هم ساخته نمی‌شود.
 */
function publicChannel(channel, log) {
  const { token, source } = resolveToken(channel);
  const platform = PLATFORM_MAP[channel.platform];
  const entries = log.filter((entry) => entry.channelId === channel.id);

  return {
    id: channel.id,
    platform: channel.platform,
    platformLabel: platform?.label ?? channel.platform,
    name: channel.name,
    chatId: channel.chatId,
    isActive: channel.isActive !== false,
    disableNotification: Boolean(channel.disableNotification),
    note: channel.note ?? '',
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
    createdByName: channel.createdByName ?? '',
    /* وضعیت اعتبار — نه خود اعتبار */
    hasToken: Boolean(token),
    tokenSource: source,
    tokenHint: tokenHint(token),
    tokenEnv: platform?.tokenEnv ?? '',
    isReady: Boolean(token) && channel.isActive !== false,
    /* سنجهٔ واقعی — فقط اگر پلتفرم داده باشد؛ وگرنه null */
    metrics: channel.metrics ?? null,
    lastSyncAt: channel.lastSyncAt ?? null,
    capabilities: platform?.capabilities ?? {},
    lastSentAt: channel.lastSentAt ?? null,
    lastStatus: channel.lastStatus ?? null,
    lastError: channel.lastError ?? '',
    sentCount: entries.filter((entry) => entry.status === 'sent').length,
    failedCount: entries.filter((entry) => entry.status === 'failed').length,
  };
}

function channelPayload(input, existing = null) {
  const platform = String(input.platform ?? existing?.platform ?? '').trim();
  if (!isSupportedPlatform(platform)) fail('پلتفرم انتخاب‌شده پشتیبانی نمی‌شود');

  const name = String(input.name ?? '').trim().slice(0, 80);
  if (!name) fail('نام کانال الزامی است');

  const chatId = String(input.chatId ?? '').trim().slice(0, 120);
  if (!chatId) fail('شناسهٔ کانال الزامی است', 'VALIDATION_ERROR');

  return {
    platform,
    name,
    chatId,
    isActive: input.isActive !== false,
    disableNotification: Boolean(input.disableNotification),
    note: String(input.note ?? '').slice(0, 300),
  };
}

export function listChannels() {
  const log = readCollection('publishLog');
  const channels = readCollection('publishChannels')
    .map((channel) => publicChannel(channel, log))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  return { channels };
}

export function getChannel(id) {
  return readCollection('publishChannels').find((channel) => channel.id === id) ?? null;
}

export function createChannel(input, admin = null) {
  const channels = readCollection('publishChannels');
  const created = nowIso();

  const channel = {
    id: makeId('ch'),
    ...channelPayload(input),
    createdAt: created,
    updatedAt: created,
    createdBy: admin?.id ?? 'system',
    createdByName: admin?.name || admin?.username || '',
    lastSentAt: null,
    lastStatus: null,
    lastError: '',
  };

  channels.push(channel);
  writeCollection('publishChannels', channels);
  return channel;
}

export function updateChannel(id, input, admin = null) {
  const channels = readCollection('publishChannels');
  const index = channels.findIndex((channel) => channel.id === id);
  if (index === -1) return null;

  channels[index] = {
    ...channels[index],
    ...channelPayload({ ...channels[index], ...input }, channels[index]),
    updatedAt: nowIso(),
    updatedBy: admin?.id ?? 'system',
    updatedByName: admin?.name || admin?.username || '',
  };

  writeCollection('publishChannels', channels);
  return channels[index];
}

export function deleteChannel(id) {
  const channels = readCollection('publishChannels');
  const target = channels.find((channel) => channel.id === id);
  if (!target) return null;

  writeCollection('publishChannels', channels.filter((channel) => channel.id !== id));

  /* توکن کانال حذف‌شده هم باید برود؛ وگرنه در فایل بی‌صاحب می‌ماند */
  const secrets = readSecrets();
  if (secrets.tokens?.[id]) {
    delete secrets.tokens[id];
    writeSecrets(secrets);
  }

  return target;
}

/* ثبت/پاک‌کردن توکن کانال. توکن خالی = حذف توکن ثبت‌شده. */
export function setChannelToken(id, token) {
  const channel = getChannel(id);
  if (!channel) return null;

  const value = String(token ?? '').trim();
  const secrets = readSecrets();
  secrets.tokens = secrets.tokens ?? {};

  if (value) secrets.tokens[id] = value;
  else delete secrets.tokens[id];

  writeSecrets(secrets);

  /* نتیجه بدون خودِ توکن برگردانده می‌شود */
  return { id, hasToken: Boolean(value), tokenHint: tokenHint(value) };
}

/* ─────────────────────────── محتوا و پیش‌نمایش ─────────────────────────── */

/*
 * فایل مدیا از پنل (`/uploads/xxx`) به شکل قابل‌آپلود تبدیل می‌شود.
 * مسیر حل‌شده باید داخل پوشهٔ uploads بماند (ضد path traversal).
 */
function loadMedia(media) {
  if (!media?.url) return null;

  const relative = String(media.url).replace(/^\/uploads\//, '');
  if (!relative || relative.includes('..')) fail('مسیر فایل نامعتبر است');

  const path = resolve(uploadsDir, relative);
  if (!path.startsWith(uploadsDir)) fail('مسیر فایل نامعتبر است');
  if (!existsSync(path)) fail('فایل انتخاب‌شده روی سرور پیدا نشد');

  const mimeType = String(media.mimeType ?? '');
  const buffer = readFileSync(path);

  return {
    buffer,
    filename: String(media.filename ?? relative).slice(0, 120),
    mimeType: mimeType || 'application/octet-stream',
    kind: IMAGE_MIME.includes(mimeType) ? 'image' : VIDEO_MIME.includes(mimeType) ? 'video' : 'document',
    size: buffer.length,
    url: String(media.url),
  };
}

/*
 * برای مرکز رسانه: همان خواندن امن فایل آپلودی، ولی از بیرون قابل صدا زدن.
 * (مسیر باید داخل uploads بماند — همان گارد path traversal.)
 */
export function loadPublishMedia(media) {
  return loadMedia(media);
}

/*
 * محتوای ارسال — یک شکل واحد برای هر پلتفرم. متن آزاد یا برگرفته از مقاله/رسانه.
 * خروجی این تابع تنها منبع حقیقت «چه چیزی فرستاده می‌شود» است.
 */
export function normalizeContent(input) {  const source = input?.source && typeof input.source === 'object' ? input.source : null;
  const text = String(input?.text ?? '').trim().slice(0, TEXT_MAX);

  const media = input?.media?.url ? {
    url: String(input.media.url),
    filename: String(input.media.filename ?? '').slice(0, 160),
    mimeType: String(input.media.mimeType ?? ''),
  } : null;

  if (!text && !media) fail('متن پیام و فایل هر دو خالی است؛ حداقل یکی لازم است');

  return {
    text,
    media,
    source: source ? {
      type: String(source.type ?? 'custom').slice(0, 20),
      id: source.id ? String(source.id).slice(0, 60) : null,
      title: String(source.title ?? '').slice(0, 160),
    } : null,
  };
}

/* پیش‌نمایش دقیق پیام‌هایی که فرستاده می‌شود — بدون هیچ درخواست شبکه‌ای */
export function previewPublish(input) {
  const content = normalizeContent(input);
  const media = loadMedia(content.media);
  const platform = String(input?.platform ?? 'bale');
  const steps = planPlatform({ platform, text: content.text, media });

  return {
    platform,
    text: content.text,
    source: content.source,
    media: media ? { filename: media.filename, mimeType: media.mimeType, kind: media.kind, url: media.url } : null,
    steps: steps.map((step) => ({
      method: step.method,
      label: step.label,
      text: step.text ?? step.caption ?? '',
      hasMedia: Boolean(step.media),
      warning: step.warning ?? null,
    })),
  };
}

/* ─────────────────────────────── ارسال ─────────────────────────────── */

function appendLog(entry) {
  const log = readCollection('publishLog');
  log.unshift(entry);
  writeCollection('publishLog', log.slice(0, LOG_MAX));
  return entry;
}

function touchChannel(channelId, { status, error }) {
  const channels = readCollection('publishChannels');
  const index = channels.findIndex((channel) => channel.id === channelId);
  if (index === -1) return;

  channels[index] = {
    ...channels[index],
    lastSentAt: nowIso(),
    lastStatus: status,
    lastError: error ?? '',
  };
  writeCollection('publishChannels', channels);
}

/* آیا ارسال به حالت آزمایشی می‌رود؟ (بدون توکن، یا با درخواست صریح) */
export function isDryRun(channel) {
  if (process.env.PUBLISH_DRY_RUN === '1') return true;
  return !resolveToken(channel).token;
}

/*
 * ارسال به چند کانال. هر کانال مستقل ارسال می‌شود: خطای یکی، بقیه را متوقف
 * نمی‌کند و نتیجهٔ همه در خروجی و در لاگ می‌ماند.
 */
export async function publish({ channelIds, content: rawContent, admin = null, forceDryRun = false }) {
  const ids = Array.isArray(channelIds) ? channelIds.filter(Boolean) : [];
  if (!ids.length) fail('هیچ کانالی برای ارسال انتخاب نشده است');

  const content = normalizeContent(rawContent);
  const media = loadMedia(content.media);

  const all = readCollection('publishChannels');
  const targets = ids.map((id) => all.find((channel) => channel.id === id)).filter(Boolean);
  if (!targets.length) fail('کانال انتخاب‌شده پیدا نشد', 'NOT_FOUND');

  const results = [];

  for (const channel of targets) {
    const platform = PLATFORM_MAP[channel.platform];
    const { token, source } = resolveToken(channel);
    const dryRun = forceDryRun || isDryRun(channel);

    const base = {
      channelId: channel.id,
      channelName: channel.name,
      platform: channel.platform,
      platformLabel: platform?.label ?? channel.platform,
      tokenSource: source,
    };

    if (dryRun) {
      const request = previewPlatformRequest({
        platform: channel.platform,
        text: content.text,
        media,
        target: channel.chatId,
        options: { disableNotification: channel.disableNotification },
      });

      const entry = appendLog({
        id: makeId('pl'),
        ...base,
        status: 'dry-run',
        error: '',
        reason: forceDryRun ? 'اجرای آزمایشی اجباری' : 'توکن ربات ثبت نشده است',
        contentPreview: content.text.slice(0, 160),
        source: content.source,
        request,
        messages: [],
        at: nowIso(),
        adminId: admin?.id ?? 'system',
        adminName: admin?.name || admin?.username || '',
      });

      touchChannel(channel.id, { status: 'dry-run', error: '' });
      results.push({ ...base, status: 'dry-run', reason: entry.reason, request, messages: [], logId: entry.id });
      continue;
    }

    const request = summarizePlatform({
      platform: channel.platform,
      steps: planPlatform({ platform: channel.platform, text: content.text, media }),
      target: channel.chatId,
    });

    try {
      const sent = await sendPlatform({
        platform: channel.platform,
        token,
        target: channel.chatId,
        text: content.text,
        media,
        options: { disableNotification: channel.disableNotification },
      });

      const entry = appendLog({
        id: makeId('pl'),
        ...base,
        status: 'sent',
        error: '',
        reason: '',
        contentPreview: content.text.slice(0, 160),
        source: content.source,
        request,
        messages: sent.messages,
        at: nowIso(),
        adminId: admin?.id ?? 'system',
        adminName: admin?.name || admin?.username || '',
      });

      touchChannel(channel.id, { status: 'sent', error: '' });
      results.push({ ...base, status: 'sent', messages: sent.messages, request, logId: entry.id });
    } catch (error) {
      const message = error?.message || 'ارسال ناموفق بود';

      const entry = appendLog({
        id: makeId('pl'),
        ...base,
        status: 'failed',
        error: message,
        errorCode: error?.code ?? 'PUBLISH_FAILED',
        reason: '',
        contentPreview: content.text.slice(0, 160),
        source: content.source,
        request,
        messages: [],
        at: nowIso(),
        adminId: admin?.id ?? 'system',
        adminName: admin?.name || admin?.username || '',
      });

      touchChannel(channel.id, { status: 'failed', error: message });
      results.push({ ...base, status: 'failed', error: message, errorCode: error?.code ?? 'PUBLISH_FAILED', request, logId: entry.id });
    }
  }

  return {
    results,
    sent: results.filter((row) => row.status === 'sent').length,
    failed: results.filter((row) => row.status === 'failed').length,
    dryRun: results.filter((row) => row.status === 'dry-run').length,
  };
}

/* ─────────────────────── تست اعتبار (پیش از ذخیره) ───────────────────────
 *
 * این تابع به وجود کانال وابسته نیست: توکن و `chat_id` را همان‌طور که کاربر در
 * فرم نوشته می‌گیرد و **قبل از ذخیره** دو چیز را بررسی می‌کند:
 *
 *   ۱) توکن معتبر است؟
 *   ۲) ربات به آن کانال دسترسی دارد؟
 *
 * بررسی دوم همان چیزی است که واقعاً ارسال را می‌شکند: اگر ربات در کانال ادمین
 * نباشد، سرویس خطای «chat not found» می‌دهد. پس کاربر بدون اینکه کانال را
 * ذخیره کند، دقیقاً می‌فهمد کجای کار می‌لنگد.
 *
 * کار پلتفرم‌محور در رجیستری آداپتورها انجام می‌شود؛ این تابع فقط شکل خروجی
 * قدیمی (`bot` و `chat`) را برای سازگاری حفظ می‌کند تا پلتفرم‌های تازه هم از
 * همین مسیر و همان UI رد شوند.
 *
 * توکن هرگز در خروجی برنمی‌گردد و هرگز لاگ نمی‌شود.
 */
export async function testCredentials({ platform = 'bale', token = '', chatId = '' } = {}) {
  const result = await verifyPlatform({ platform, token, target: chatId });

  return {
    ok: result.ok,
    complete: result.complete,
    platform,
    bot: result.account,
    chat: result.target,
    checks: result.checks,
  };
}

/* ─────────────────────── تست اتصال کانال ذخیره‌شده ─────────────────────── */

export async function testChannel(id) {
  const channel = getChannel(id);
  if (!channel) return null;

  const { token, source } = resolveToken(channel);

  if (!token) {
    return {
      ok: false,
      complete: false,
      status: 'no-token',
      tokenSource: source,
      checks: [{ id: 'token', label: 'توکن ربات', ok: false, message: 'توکن ربات ثبت نشده است؛ اول توکن را ذخیره کنید' }],
    };
  }

  /* تست اتصال عمداً در حالت آزمایشی سراسری هم واقعی است — تنها راه فهمیدن درستی توکن */
  const result = await testCredentials({ platform: channel.platform, token, chatId: channel.chatId });

  return { ...result, status: result.complete ? 'ok' : 'failed', tokenSource: source };
}

/* ─────────────────────────── تاریخچه و آمار ─────────────────────────── */

export function listLog({ channelId = 'all', status = 'all', page = 1, perPage = 15 } = {}) {
  const rows = readCollection('publishLog').filter((entry) => {
    if (channelId !== 'all' && entry.channelId !== channelId) return false;
    if (status !== 'all' && entry.status !== status) return false;
    return true;
  });

  const size = Math.min(Math.max(Number(perPage) || 15, 1), 100);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(Number(page) || 1, 1), pages);
  const start = (current - 1) * size;

  return { items: rows.slice(start, start + size), total: rows.length, page: current, perPage: size, pages };
}

export function publishingStats() {
  const channels = readCollection('publishChannels');
  const log = readCollection('publishLog');
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  return {
    channels: channels.length,
    activeChannels: channels.filter((channel) => channel.isActive !== false).length,
    readyChannels: channels.filter((channel) => resolveToken(channel).token && channel.isActive !== false).length,
    sent: log.filter((entry) => entry.status === 'sent').length,
    failed: log.filter((entry) => entry.status === 'failed').length,
    dryRun: log.filter((entry) => entry.status === 'dry-run').length,
    sentToday: log.filter((entry) => entry.status === 'sent' && new Date(entry.at).getTime() >= dayAgo).length,
    lastAt: log[0]?.at ?? null,
  };
}

/* وضعیت کلی برای هدر پنل: حالت آزمایشی سراسری روشن است یا نه */
export function publishingConfig() {
  return {
    /*
     * توصیف هر پلتفرم از رجیستری آداپتورها می‌آید. پنل از همین توصیف می‌سازد:
     * برچسب فیلدها، راهنمای گام‌به‌گام، و اینکه فیلد کلید اپ نشان بدهد یا نه.
     */
    platforms: PLATFORM_LIST.map((platform) => ({
      id: platform.id,
      label: platform.label,
      family: platform.family,
      apiKind: platform.apiKind,
      description: platform.description,
      /* نام‌های قدیمی برای سازگاری با کارت کانال‌های موجود */
      chatIdHint: platform.targetHint ?? platform.chatIdHint,
      botFatherUrl: platform.botFatherUrl ?? '',
      /* نام‌های واحد برای پلتفرم‌های تازه */
      targetLabel: platform.targetLabel ?? 'شناسهٔ مقصد',
      targetHint: platform.targetHint ?? '',
      tokenLabel: platform.tokenLabel,
      tokenHint: platform.tokenHint,
      tokenEnv: platform.tokenEnv,
      docsUrl: platform.docsUrl ?? '',
      supports: platform.supports ?? [],
      contentTypes: platform.contentTypes ?? [],
      metrics: platform.metrics ?? [],
      capabilities: platform.capabilities ?? {},
      needsAppKeys: platform.apiKind === 'graph',
      appIdLabel: platform.appIdLabel ?? '',
      appIdHint: platform.appIdHint ?? '',
      appSecretLabel: platform.appSecretLabel ?? '',
      appSecretHint: platform.appSecretHint ?? '',
      setupSteps: platform.setupSteps ?? [],
    })),
    statuses: Object.entries(PUBLISH_STATUSES).map(([value, label]) => ({ value, label })),
    forcedDryRun: process.env.PUBLISH_DRY_RUN === '1',
    captionLimit: 1000,
    textMax: TEXT_MAX,
    siteUrl: publicSiteUrl(),
  };
}

/* ───────────────────── سنجهٔ واقعی کانال‌های انتشار ─────────────────────
 *
 * فقط عددی برمی‌گردد که پلتفرم واقعاً داده باشد. اگر API پلتفرم آمار ندهد،
 * `null` می‌ماند و پنل «داده‌ای نیست» نشان می‌دهد — عدد ساختگی ساخته نمی‌شود.
 */
export async function syncChannelMetrics(id) {
  const channel = getChannel(id);
  if (!channel) return null;

  const { token } = resolveToken(channel);
  if (!token) {
    return { id, status: 'no-token', metrics: null, syncedAt: null, message: 'توکن ثبت نشده است' };
  }

  const metrics = await platformMetrics({ platform: channel.platform, token, target: channel.chatId });
  const syncedAt = nowIso();

  const channels = readCollection('publishChannels');
  const index = channels.findIndex((row) => row.id === id);
  if (index !== -1) {
    channels[index] = {
      ...channels[index],
      metrics: metrics ?? channels[index].metrics ?? null,
      lastSyncAt: syncedAt,
    };
    writeCollection('publishChannels', channels);
  }

  return {
    id,
    status: metrics ? 'ok' : 'unsupported',
    metrics,
    syncedAt,
    message: metrics ? '' : `${platformById(channel.platform)?.label ?? channel.platform} آمار دنبال‌کننده را از API ربات نمی‌دهد`,
  };
}

/* سنجهٔ همهٔ کانال‌های آماده — برای دکمهٔ «همگام‌سازی همه» در مرکز رسانه */
export async function syncAllChannelMetrics() {
  const channels = readCollection('publishChannels');
  const results = [];

  for (const channel of channels) {
    if (resolveToken(channel).token) results.push(await syncChannelMetrics(channel.id));
  }

  return {
    results,
    synced: results.filter((row) => row.status === 'ok').length,
    skipped: results.filter((row) => row.status === 'no-token').length,
    unsupported: results.filter((row) => row.status === 'unsupported').length,
  };
}

/* گزینه‌های محتوا برای فرم ارسال: مقاله‌های منتشرشده + رسانه‌های تازه */
export function publishTargets() {
  const articles = readCollection('articles')
    .filter((article) => article.status === 'published')
    .sort((a, b) => String(b.publishedAt ?? b.updatedAt).localeCompare(String(a.publishedAt ?? a.updatedAt)))
    .slice(0, 60)
    .map((article) => ({
      id: article.id,
      title: article.title,
      excerpt: article.excerpt ?? '',
      slug: article.slug,
      cover: article.cover ?? '',
      category: article.category,
      publishedAt: article.publishedAt,
    }));

  const media = readCollection('media')
    .slice(0, 60)
    .map((item) => ({
      id: item.id,
      url: item.url,
      filename: item.filename,
      originalName: item.originalName,
      mimeType: item.mimeType,
      size: item.size,
    }));

  return { articles, media };
}

/* آدرس عمومی سایت برای ساختن لینک مقاله در متن پیام */
export function publicSiteUrl() {
  return String(process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '');
}
