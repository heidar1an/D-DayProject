/*
 * رجیستری آداپتورهای پلتفرم — تنها جایی که پنل پلتفرم‌ها را می‌شناسد.
 *
 * هر پلتفرم یک فایل در همین پوشه دارد و یک شکل واحد صادر می‌کند:
 *
 *   PLATFORM     → توصیف پلتفرم (برچسب، نوع، چه چیزی پشتیبانی می‌کند، سنجه‌ها)
 *   verify       → تست اعتبار: توکن درست است؟ دسترسی به مقصد هست؟
 *   plan         → محتوا به چند پیام/مرحله می‌شکند (خالص، بدون شبکه)
 *   summarize    → خلاصهٔ امن برنامه برای لاگ و پیش‌نمایش
 *   send         → ارسال واقعی
 *   metrics      → سنجهٔ واقعی؛ اگر پلتفرم نمی‌دهد `null`
 *
 * **افزودن پلتفرم جدید = یک فایل در این پوشه + یک سطر در `ADAPTERS`.**
 * هیچ‌جای دیگری از پروژه (نه store، نه API، نه UI) لازم نیست عوض شود؛ چون
 * همه فقط از همین رجیستری می‌خوانند.
 *
 * `bale.js` دست‌نخورده مانده چون قرارداد خودش را دارد و تست‌ها به آن تکیه
 * دارند؛ اینجا فقط به شکل واحد درمی‌آید.
 */

import {
  BALE_PLATFORM,
  getChat as baleGetChat,
  getMe as baleGetMe,
  planBaleMessages,
  previewBaleRequest,
  sendToBale,
  summarizePlan as summarizeBalePlan,
} from './bale.js';

import telegram from './telegram.js';
import eitaa from './eitaa.js';
import instagram from './instagram.js';

/* ───────────────────────── آداپتور بله (پوشش) ───────────────────────── */

function friendlyBaleError(error) {
  return error?.message || 'سرویس درخواست را نپذیرفت';
}

const baleAdapter = {
  PLATFORM: {
    ...BALE_PLATFORM,
    family: 'messenger',
    apiKind: 'telegram-like',
    targetLabel: 'شناسهٔ کانال',
    apiName: 'Bale Bot API',
    docsUrl: 'https://ble.ir/botfather',
    setupUrl: 'https://ble.ir/botfather',
    setupUrlLabel: 'باز کردن BotFather در بله',
    contentTypes: ['post', 'announcement', 'poll', 'video'],
    metrics: ['followers'],
    capabilities: { publish: true, metrics: true, comments: false, messages: false, sync: false },
  },

  plan: ({ text, media }) => planBaleMessages({ text, media }),

  summarize: (steps, target) => ({ api: 'Bale Bot API', ...summarizeBalePlan(steps, target) }),

  async send({ token, target, text, media, options = {} }) {
    return sendToBale({
      token,
      chatId: target,
      text,
      media,
      disableNotification: Boolean(options.disableNotification),
    });
  },

  async metrics({ token, target }) {
    try {
      const chat = await baleGetChat(token, target);
      if (chat?.memberCount === null || chat?.memberCount === undefined) return null;
      return { followers: Number(chat.memberCount), followersAt: new Date().toISOString() };
    } catch {
      return null;
    }
  },

  /*
   * همان منطق `testCredentials` قبلی، عیناً: شناسهٔ بررسی دسترسی «chat» می‌ماند
   * چون تست‌های موجود به آن تکیه دارند.
   */
  async verify({ token, target }) {
    const value = String(token ?? '').trim();
    const dest = String(target ?? '').trim();

    if (!value) {
      return {
        ok: false,
        complete: false,
        account: null,
        target: null,
        checks: [{ id: 'token', label: 'توکن ربات', ok: false, message: 'توکن را وارد کنید' }],
      };
    }

    const checks = [];
    let account = null;

    try {
      account = await baleGetMe(value);
      checks.push({
        id: 'token',
        label: 'توکن ربات',
        ok: true,
        message: `ربات «${account.name || account.username || account.id}» شناسایی شد`,
      });
    } catch (error) {
      checks.push({ id: 'token', label: 'توکن ربات', ok: false, message: friendlyBaleError(error) });
      return { ok: false, complete: false, account: null, target: null, checks };
    }

    if (!dest) {
      checks.push({
        id: 'chat',
        label: 'دسترسی به کانال',
        ok: null,
        message: 'برای بررسی دسترسی، شناسهٔ کانال را وارد کنید',
      });
      return { ok: true, complete: false, account, target: null, checks };
    }

    try {
      const chat = await baleGetChat(value, dest);
      checks.push({
        id: 'chat',
        label: 'دسترسی به کانال',
        ok: true,
        message: `کانال «${chat.title || chat.username || chat.id}» در دسترس ربات است`,
      });
      return { ok: true, complete: true, account, target: chat, checks };
    } catch (error) {
      checks.push({ id: 'chat', label: 'دسترسی به کانال', ok: false, message: friendlyBaleError(error) });
      return { ok: false, complete: false, account, target: null, checks };
    }
  },

  /* درخواستی که در حالت آزمایشی «می‌رفت» — بدون هیچ شبکه‌ای */
  previewRequest: ({ text, media, target, options = {} }) => previewBaleRequest({
    text,
    media,
    chatId: target,
    disableNotification: Boolean(options.disableNotification),
  }),
};

/* ─────────────────────────────── رجیستری ─────────────────────────────── */

const ADAPTERS = [
  baleAdapter,
  telegram,
  eitaa,
  instagram,
];

const ADAPTER_MAP = Object.fromEntries(ADAPTERS.map((adapter) => [adapter.PLATFORM.id, adapter]));

/* ترتیب همین آرایه = ترتیب نمایش در پنل */
export const PLATFORM_LIST = ADAPTERS.map((adapter) => adapter.PLATFORM);

export const PLATFORM_IDS = PLATFORM_LIST.map((platform) => platform.id);

export function platformById(id) {
  return ADAPTER_MAP[String(id ?? '')]?.PLATFORM ?? null;
}

export function adapterById(id) {
  return ADAPTER_MAP[String(id ?? '')] ?? null;
}

export function isSupportedPlatform(id) {
  return Boolean(ADAPTER_MAP[String(id ?? '')]);
}

/* نام متغیر محیطی توکن هر پلتفرم — برای پیام «منبع اعتبار» در UI */
export function platformTokenEnv(id) {
  return platformById(id)?.tokenEnv ?? '';
}

/*
 * آیا این پلتفرم «کلید اپ» جدا می‌خواهد؟ (فقط اینستاگرام)
 * پنل از همین پرچم می‌فهمد فیلدهای App ID/Secret را نشان بدهد یا نه.
 */
export function platformNeedsAppKeys(id) {
  return platformById(id)?.apiKind === 'graph';
}

/* ───────────────────────── عملیات واحد روی هر پلتفرم ───────────────────────── */

export async function verifyPlatform({ platform, token, target, appId = '' }) {
  const adapter = adapterById(platform);
  if (!adapter) {
    return {
      ok: false,
      complete: false,
      account: null,
      target: null,
      checks: [{ id: 'platform', label: 'پلتفرم', ok: false, message: 'پلتفرم پشتیبانی نمی‌شود' }],
    };
  }

  /* بدون توکن هیچ درخواستی به بیرون نمی‌رود — قاعدهٔ ثابت این بخش */
  if (!String(token ?? '').trim()) {
    return {
      ok: false,
      complete: false,
      account: null,
      target: null,
      checks: [{ id: 'token', label: adapter.PLATFORM.tokenLabel ?? 'توکن', ok: false, message: 'توکن را وارد کنید' }],
    };
  }

  return adapter.verify({ token, target, appId });
}

export function planPlatform({ platform, text, media }) {
  const adapter = adapterById(platform);
  if (!adapter) return [];
  return adapter.plan({ text, media });
}

export function summarizePlatform({ platform, steps, target }) {
  const adapter = adapterById(platform);
  if (!adapter) return { api: '', target, steps: [] };
  return adapter.summarize(steps, target);
}

export async function sendPlatform({ platform, token, target, text, media, options }) {
  const adapter = adapterById(platform);
  if (!adapter) {
    throw Object.assign(new Error('پلتفرم پشتیبانی نمی‌شود'), { code: 'VALIDATION_ERROR' });
  }
  return adapter.send({ token, target, text, media, options });
}

export async function platformMetrics({ platform, token, target }) {
  const adapter = adapterById(platform);
  if (!adapter?.metrics) return null;
  try {
    return await adapter.metrics({ token, target });
  } catch {
    /* شکست خواندن سنجه نباید چیزی را بشکند؛ فقط «داده‌ای نیست» */
    return null;
  }
}

/*
 * درخواستی که در حالت آزمایشی می‌رفت. برای پلتفرم‌هایی که آداپتورشان تابع
 * اختصاصی دارد از آن استفاده می‌شود، وگرنه خلاصهٔ برنامه ساخته می‌شود.
 */
export function previewPlatformRequest({ platform, text, media, target, options = {} }) {
  const adapter = adapterById(platform);
  if (!adapter) return null;
  if (adapter.previewRequest) return adapter.previewRequest({ text, media, target, options });

  return {
    endpoint: platformById(platform)?.apiName ?? platform,
    target,
    ...adapter.summarize(adapter.plan({ text, media }), target),
  };
}

export { baleAdapter, telegram, eitaa, instagram };

/* ─────────────────────────── فهرست پلتفرم‌های شناخته‌شده ───────────────────────────
 *
 * دو دستهٔ متفاوت، عمداً جدا:
 *
 *   ۱) پلتفرم‌هایی که **آداپتور** دارند (`adapter: true`) — ارسال، تست اتصال و
 *      خواندن سنجه از API واقعی کار می‌کند. این‌ها در `ADAPTERS` بالا هستند.
 *   ۲) پلتفرم‌هایی که **شناخته‌شده ولی بدون آداپتور** هستند (`adapter: false`) —
 *      مدیر می‌تواند اکانتش را ثبت و دستی رصد کند (دنبال‌کننده، تعداد پست،
 *      عملکرد محتوا)، ولی انتشار خودکار ندارد. این‌ها عدد ساختگی نمی‌سازند؛
 *      فقط جایی برای ثبت دادهٔ واقعی‌اند تا وقتی آداپتورش نوشته شود.
 *
 * افزودن پلتفرم از دستهٔ دوم به اول = نوشتن یک فایل آداپتور و یک سطر در
 * `ADAPTERS`. هیچ‌جای دیگری از پروژه عوض نمی‌شود.
 */
const CATALOG_ONLY = [
  { id: 'youtube', label: 'یوتیوب', family: 'video', accent: '#e06b6b', kinds: ['channel'] },
  { id: 'aparat', label: 'آپارات', family: 'video', accent: '#d98b6a', kinds: ['channel'] },
  { id: 'x', label: 'ایکس (توییتر)', family: 'social', accent: '#8f9aa8', kinds: ['profile'] },
  { id: 'linkedin', label: 'لینکدین', family: 'social', accent: '#5b8cc7', kinds: ['page'] },
  { id: 'rubika', label: 'روبیکا', family: 'messenger', accent: '#7cbf8f', kinds: ['channel', 'group'] },
  { id: 'whatsapp', label: 'واتساپ', family: 'messenger', accent: '#61d192', kinds: ['channel'] },
  { id: 'pinterest', label: 'پینترست', family: 'social', accent: '#d97b7b', kinds: ['profile'] },
  { id: 'website', label: 'وب‌سایت', family: 'site', accent: '#9a9a9a', kinds: ['site'] },
  { id: 'podcast', label: 'پادکست', family: 'audio', accent: '#c39a6b', kinds: ['show'] },
  { id: 'newsletter', label: 'خبرنامه', family: 'audio', accent: '#ab8e7c', kinds: ['list'] },
];

export const PLATFORM_CATALOG = [
  ...PLATFORM_LIST.map((platform) => ({
    id: platform.id,
    label: platform.label,
    family: platform.family,
    accent: platform.accent ?? null,
    adapter: true,
    kinds: platform.kinds ?? ['channel', 'page', 'profile'],
    capabilities: platform.capabilities,
    metrics: platform.metrics,
    contentTypes: platform.contentTypes,
    tokenEnv: platform.tokenEnv,
    /* توصیف کامل فیلدها — UI از همین می‌سازد، نه از کد سخت‌کدشده */
    apiKind: platform.apiKind ?? 'telegram-like',
    description: platform.description ?? '',
    targetLabel: platform.targetLabel ?? 'شناسهٔ مقصد',
    targetHint: platform.targetHint ?? '',
    tokenLabel: platform.tokenLabel ?? 'توکن',
    tokenHint: platform.tokenHint ?? '',
    docsUrl: platform.docsUrl ?? '',
    botFatherUrl: platform.botFatherUrl ?? '',
    /* لینک راه‌اندازی + برچسبش؛ پنل به‌جای متن سخت‌کدشده از همین می‌سازد */
    setupUrl: platform.setupUrl ?? platform.botFatherUrl ?? platform.docsUrl ?? '',
    setupUrlLabel: platform.setupUrlLabel ?? (platform.botFatherUrl ? 'باز کردن BotFather' : 'مستندات پلتفرم'),
    needsAppKeys: platform.apiKind === 'graph',
    appIdLabel: platform.appIdLabel ?? '',
    appIdHint: platform.appIdHint ?? '',
    appSecretLabel: platform.appSecretLabel ?? '',
    appSecretHint: platform.appSecretHint ?? '',
    setupSteps: platform.setupSteps ?? [],
  })),
  ...CATALOG_ONLY.map((platform) => ({
    ...platform,
    adapter: false,
    capabilities: { publish: false, metrics: false, comments: false, messages: false, sync: false, manual: true },
    metrics: [],
    contentTypes: [],
    tokenEnv: '',
    apiKind: 'manual',
    description: 'این پلتفرم در این نسخه آداپتور API ندارد؛ اکانت و اعدادش دستی مدیریت می‌شود.',
    targetLabel: 'شناسهٔ مقصد',
    targetHint: '',
    tokenLabel: '',
    tokenHint: '',
    docsUrl: '',
    botFatherUrl: '',
    setupUrl: '',
    setupUrlLabel: '',
    needsAppKeys: false,
    appIdLabel: '',
    appIdHint: '',
    appSecretLabel: '',
    appSecretHint: '',
    setupSteps: [],
  })),
];

const CATALOG_MAP = Object.fromEntries(PLATFORM_CATALOG.map((platform) => [platform.id, platform]));

export function catalogById(id) {
  return CATALOG_MAP[String(id ?? '')] ?? null;
}

export function isKnownPlatform(id) {
  return Boolean(CATALOG_MAP[String(id ?? '')]);
}

/* آیا این پلتفرم آداپتور واقعی دارد؟ (ارسال/سنجهٔ خودکار) */
export function hasAdapter(id) {
  return Boolean(ADAPTER_MAP[String(id ?? '')]);
}

