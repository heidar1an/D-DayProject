/*
 * ردیاب ترافیک تپش — تنها منبع «دادهٔ واقعی بازدید» برای مرکز تحلیل.
 *
 * این ماژول در مرورگر کاربر اجرا می‌شود و رویدادهای واقعی را به
 * `POST /api/public/analytics/collect` می‌فرستد. هیچ عدد ساختگی تولید نمی‌کند:
 * هرچه در پنل دیده می‌شود، خروجی همین ردیاب + لاگ واقعی سرور است.
 *
 * اصول:
 *   1. بدون دادهٔ شخصی. شناسهٔ کاربر فقط `userId` مبهم است؛ نه شماره، نه ایمیل،
 *      نه نام. مسیرها هم اگر شناسهٔ عددی داشته باشند پاک‌سازی می‌شوند.
 *   2. بی‌صدا. هیچ خطایی از این ماژول نباید تجربهٔ کاربر را خراب کند؛ همهٔ
 *      مسیرها در try/catch هستند و در صورت نبود شبکه، صف دور ریخته می‌شود.
 *   3. سبک. رویدادها دسته‌ای و با تأخیر فرستاده می‌شوند (نه به‌ازای هر کلیک).
 *   4. قابل احترام. اگر کاربر Do-Not-Track بفرستد یا خودش ردیابی را خاموش کند،
 *      ردیاب اصلاً روشن نمی‌شود.
 *
 * انواع رویداد پذیرفته‌شده در سرور (analyticsStore.EVENT_TYPES):
 *   page_view | session_start | signup | login | logout | article_read |
 *   lesson_view | wiki_view | test_start | test_submit | flashcard_review |
 *   feature_use | search | cwv | js_error | api_error | purchase
 */

import { getStoredUser } from '../userStorage';

const COLLECT_URL = '/api/public/analytics/collect';

/* کلیدهای ذخیره‌سازی محلی — نسخه‌دار تا تغییر ساختار داده را نشکند */
const SESSION_KEY = 'tapesh:telemetry:sid:v1';
const OPT_OUT_KEY = 'tapesh:telemetry:off:v1';

/* سشن بعد از این مدت بی‌فعالیتی شکسته می‌شود (قرارداد رایج تحلیل وب: ۳۰ دقیقه) */
const SESSION_IDLE_MS = 30 * 60 * 1000;

/* اندازه و زمان ارسال دسته‌ای */
const FLUSH_INTERVAL_MS = 6000;
const FLUSH_THRESHOLD = 20;
const MAX_QUEUE = 120;

/* پنجرهٔ جمع‌آوری Core Web Vitals پیش از گزارش */
const VITALS_SETTLE_MS = 15000;

const state = {
  started: false,
  sessionId: null,
  userId: null,
  queue: [],
  timer: null,
  referrer: '',
  landingPath: null,
  vitals: new Map(), /* metric → آخرین مقدار واقعی اندازه‌گیری‌شده */
  vitalsSent: false,
  lastPath: null,
};

/* ─────────────────────────── ابزارهای پایه ─────────────────────────── */

const now = () => Date.now();

function readStore(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(store, key, value) {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* حالت private/سهمیهٔ پر — ردیابی نباید بشکند */
  }
}

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function randomId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `${now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* آیا ردیابی از سمت کاربر ممنوع شده است؟ */
function isOptedOut() {
  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
  } catch {
    /* ignore */
  }
  return readStore(window.localStorage, OPT_OUT_KEY) === '1';
}

/* ─────────────────────────── سشن ─────────────────────────── */

/*
 * سشن در sessionStorage نگه داشته می‌شود تا بستن تب، سشن را تمام کند؛ اما
 * بی‌فعالیتی طولانی هم سشن تازه می‌سازد تا «مدت سشن» واقعی بماند.
 */
function currentSession() {
  const stored = safeParse(readStore(window.sessionStorage, SESSION_KEY));
  const stamp = now();

  if (stored?.id && Number.isFinite(stored.lastAt) && stamp - stored.lastAt < SESSION_IDLE_MS) {
    const renewed = { id: stored.id, lastAt: stamp };
    writeStore(window.sessionStorage, SESSION_KEY, JSON.stringify(renewed));
    return { id: stored.id, isNew: false };
  }

  const id = `s-${randomId().slice(0, 24)}`;
  writeStore(window.sessionStorage, SESSION_KEY, JSON.stringify({ id, lastAt: stamp }));
  return { id, isNew: true };
}

/* ─────────────────────────── مسیر و کمپین ─────────────────────────── */

/* شناسه‌های فنی (اسلاگ مقاله، بخش داشبورد) معنا دارند و نگه داشته می‌شوند */
function normalizePath() {
  const { hash } = window.location;

  if (!hash || hash === '#') return '/';
  if (hash === '#auth') return '/auth';
  if (hash === '#onboarding') return '/onboarding';
  if (hash === '#articles') return '/articles';

  const article = hash.match(/^#articles\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)$/);
  if (article) return `/articles/${article[1]}`;

  /* داشبورد: بخش از query خوانده می‌شود، لایه در meta می‌رود تا کاردینالیتی کم بماند */
  if (hash === '#dashboard' || hash.startsWith('#dashboard?') || hash.startsWith('#dashboard/')) {
    const params = new URLSearchParams(hash.split('?')[1] ?? '');
    const section = params.get('s');
    return section ? `/dashboard/${section}` : '/dashboard';
  }

  /* پنل مدیریت خودش ابزار سنجش است؛ بازدیدهایش شمرده نمی‌شود */
  if (hash === '#admin' || hash.startsWith('#admin/')) return null;

  return hash.slice(0, 120);
}

/* لایه/تب فعلی داشبورد — برای Drill-down در تحلیل */
function currentLayer() {
  const { hash } = window.location;
  if (!hash.startsWith('#dashboard')) return null;
  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  return params.get('l') || params.get('o') || null;
}

/* کمپین از پارامترهای آدرس — همان استاندارد UTM که سرور هم می‌فهمد */
function campaign() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      medium: params.get('utm_medium') ?? '',
      campaign: params.get('utm_campaign') ?? '',
      source: params.get('utm_source') ?? '',
    };
  } catch {
    return { medium: '', campaign: '', source: '' };
  }
}

function pageTitle() {
  const title = (document.title ?? '').trim();
  if (!title) return '';
  /* عنوان‌های فارسی سایت با «تپش» تمام می‌شوند؛ برای خوانایی کوتاه می‌شود */
  return title.slice(0, 120);
}

/* ─────────────────────────── صف و ارسال ─────────────────────────── */

function enqueue(type, payload = {}) {
  if (!state.started) return;
  if (state.queue.length >= MAX_QUEUE) state.queue.shift();

  const session = state.sessionId;
  const campaignInfo = campaign();
  const layer = currentLayer();

  state.queue.push({
    type,
    ts: now(),
    sessionId: session,
    userId: state.userId,
    path: payload.path ?? state.lastPath ?? normalizePath() ?? '/',
    title: payload.title ?? pageTitle(),
    referrer: payload.referrer ?? state.referrer,
    locale: navigator.language ?? '',
    medium: campaignInfo.medium,
    campaign: campaignInfo.campaign,
    source: campaignInfo.source || undefined,
    metric: payload.metric ?? null,
    value: payload.value ?? 0,
    meta: {
      ...(layer ? { layer } : {}),
      ...(payload.meta ?? {}),
    },
  });

  if (state.queue.length >= FLUSH_THRESHOLD) flush();
}

/*
 * ارسال واقعی. اول با `sendBeacon` تلاش می‌شود (روی pagehide هم کار می‌کند)،
 * بعد با fetch keepalive. اگر شبکه نبود، صف دور ریخته می‌شود — نه انبار می‌شود،
 * چون دادهٔ کهنه ارزش تحلیلی ندارد و حافظه را اشغال می‌کند.
 */
export function flush({ beacon = false } = {}) {
  if (!state.started || !state.queue.length) return;

  const batch = state.queue.splice(0, 50);
  const body = JSON.stringify({ events: batch });

  try {
    if (beacon && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(COLLECT_URL, blob)) return;
    }

    fetch(COLLECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {
      /* ردیابی نباید هیچ‌وقت به کاربر خطا نشان بدهد */
    });
  } catch {
    /* ignore */
  }
}

/* ─────────────────────────── Core Web Vitals ─────────────────────────── */

/*
 * مقادیر از PerformanceObserver واقعی مرورگر می‌آیند (نه تخمین). هر سنجه یک‌بار
 * و با آخرین مقدار اندازه‌گیری‌شده گزارش می‌شود.
 */
function observeVitals() {
  if (typeof PerformanceObserver !== 'function') return;

  const observe = (type, handler, opts = {}) => {
    try {
      const observer = new PerformanceObserver((list) => {
        try {
          handler(list);
        } catch {
          /* ignore */
        }
      });
      observer.observe({ type, buffered: true, ...opts });
    } catch {
      /* مرورگر این نوع را پشتیبانی نمی‌کند */
    }
  };

  /* TTFB و FCP از روی تایم‌لاین ناوبری */
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && Number.isFinite(nav.responseStart)) {
      state.vitals.set('TTFB', Math.round(nav.responseStart));
    }
  } catch {
    /* ignore */
  }

  observe('paint', (list) => {
    list.getEntries().forEach((entry) => {
      if (entry.name === 'first-contentful-paint') {
        state.vitals.set('FCP', Math.round(entry.startTime));
      }
    });
  });

  /* LCP — بزرگ‌ترین عنصر محتوایی؛ آخرین مقدار تا لحظهٔ گزارش معتبر است */
  observe('largest-contentful-paint', (list) => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1];
    if (last) state.vitals.set('LCP', Math.round(last.startTime));
  });

  /* CLS — مجموع جابه‌جایی‌های غیرمنتظرهٔ چیدمان (بدون ورودی کاربر) */
  observe('layout-shift', (list) => {
    list.getEntries().forEach((entry) => {
      if (entry.hadRecentInput) return;
      const current = state.vitals.get('CLS') ?? 0;
      state.vitals.set('CLS', Number((current + entry.value).toFixed(4)));
    });
  });

  /* INP — کندترین تعامل کاربر؛ معیار جایگزین FID در نسخه‌های تازه */
  let worstInteraction = 0;
  observe('event', (list) => {
    list.getEntries().forEach((entry) => {
      if (entry.interactionId && entry.duration > worstInteraction) {
        worstInteraction = entry.duration;
        state.vitals.set('INP', Math.round(entry.duration));
      }
    });
  }, { durationThreshold: 40 });
}

function reportVitals() {
  if (state.vitalsSent || !state.vitals.size) return;
  state.vitalsSent = true;

  state.vitals.forEach((value, metric) => {
    enqueue('cwv', {
      metric,
      value,
      path: state.landingPath ?? normalizePath() ?? '/',
      meta: { unit: metric === 'CLS' ? 'score' : 'ms' },
    });
  });

  flush({ beacon: true });
}

/* ─────────────────────────── خطاهای سمت کلاینت ─────────────────────────── */

/*
 * خطاهای واقعی جاوااسکریپت سایت — همان چیزی که بخش «خطاها» در پنل نشان می‌دهد.
 * پیام کوتاه و بدون دادهٔ کاربر ذخیره می‌شود.
 */
function captureErrors() {
  window.addEventListener('error', (event) => {
    const message = String(event?.message ?? '').slice(0, 200);
    if (!message) return;

    enqueue('js_error', {
      meta: {
        message,
        source: String(event?.filename ?? '').slice(0, 200),
        line: Number(event?.lineno) || 0,
        column: Number(event?.colno) || 0,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const message = String(
      reason?.message ?? reason ?? 'Promise rejected without a reason',
    ).slice(0, 200);

    enqueue('js_error', {
      meta: { message, source: 'unhandledrejection', line: 0, column: 0 },
    });
  });
}

/* ─────────────────────────── ردیابی مسیر ─────────────────────────── */

function trackPageView() {
  const path = normalizePath();
  if (!path || path === state.lastPath) return;

  const isFirst = state.lastPath === null;
  state.lastPath = path;

  if (isFirst) {
    state.landingPath = path;
    enqueue('session_start', { path, referrer: state.referrer });
  }

  enqueue('page_view', { path });
}

/* ─────────────────────────── چرخهٔ عمر ─────────────────────────── */

function attachLifecycle() {
  const onHidden = () => {
    if (document.visibilityState !== 'hidden') return;
    reportVitals();
    flush({ beacon: true });
  };

  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', () => {
    reportVitals();
    flush({ beacon: true });
  });

  /* تغییر مسیر در اپ hash-based است، پس همین رویداد کافی است */
  window.addEventListener('hashchange', trackPageView);

  state.timer = window.setInterval(() => {
    flush();
  }, FLUSH_INTERVAL_MS);
}

/*
 * شروع ردیابی. چند بار صدا زدن بی‌خطر است (idempotent) و در محیط بدون
 * مرورگر (SSR) یا وقتی کاربر ردیابی را خاموش کرده، کاری نمی‌کند.
 */
export function startTracking({ userId = null } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (state.started) return true;
  if (isOptedOut()) return false;

  state.started = true;
  state.referrer = document.referrer ?? '';

  /* هویت هرگز خام ذخیره نمی‌شود — همیشه از مسیر شبه‌نام‌سازی می‌گذرد */
  if (userId) identify(userId);
  else state.userId = readStoredUserId();

  const session = currentSession();
  state.sessionId = session.id;

  captureErrors();
  observeVitals();
  attachLifecycle();

  /* صفحهٔ اول بی‌درنگ ثبت می‌شود تا بازدید از دست نرود */
  trackPageView();
  flush();

  window.setTimeout(reportVitals, VITALS_SETTLE_MS);
  return true;
}

export function stopTracking() {
  if (!state.started) return;
  flush({ beacon: true });
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
  state.started = false;
}

/* قطع/وصل هویت کاربر — با ورود و خروج صدا زده می‌شود.
 * ورودی می‌تواند خودِ شیء کاربر سایت باشد؛ شبه‌نام‌سازی همین‌جا انجام می‌شود تا
 * هیچ فراخوانی‌کننده‌ای نتواند به‌اشتباه دادهٔ شخصی بفرستد. */
export function identify(userOrId) {
  if (!userOrId) {
    state.userId = null;
    return;
  }

  const identity = typeof userOrId === 'object'
    ? (userOrId.id ?? userOrId.phone ?? userOrId.username)
    : userOrId;

  state.userId = identity ? pseudonym(identity) : null;
}

export function optOut() {
  stopTracking();
  writeStore(window.localStorage, OPT_OUT_KEY, '1');
}

export function optIn() {
  writeStore(window.localStorage, OPT_OUT_KEY, null);
  return startTracking();
}

/* ─────────────────────────── API عمومی رویدادها ─────────────────────────── */

/*
 * ثبت رویداد دامنه‌ای از هرجای اپ. مثال:
 *   track('test_submit', { value: score, meta: { examId } });
 */
export function track(type, payload = {}) {
  if (!state.started) return;
  try {
    enqueue(type, payload);
  } catch {
    /* ignore */
  }
}

/* میان‌برهای پرکاربرد تا امضاها در کل پروژه یکسان بمانند */
export const trackArticleRead = (slug, extra = {}) =>
  track('article_read', { path: `/articles/${slug}`, ...extra });

export const trackLessonView = (moduleId, lessonId, extra = {}) =>
  track('lesson_view', {
    path: `/dashboard/lessons/${moduleId}`,
    meta: { lessonId, ...(extra.meta ?? {}) },
    ...extra,
  });

export const trackWikiView = (entityId, extra = {}) =>
  track('wiki_view', { path: '/dashboard/wiki', meta: { entityId, ...(extra.meta ?? {}) }, ...extra });

export const trackTestStart = (mode, extra = {}) =>
  track('test_start', { path: '/dashboard/tests', meta: { mode, ...(extra.meta ?? {}) }, ...extra });

export const trackTestSubmit = (mode, score, extra = {}) =>
  track('test_submit', {
    path: '/dashboard/tests',
    value: Number(score) || 0,
    meta: { mode, ...(extra.meta ?? {}) },
    ...extra,
  });

export const trackFlashcardReview = (count = 1, extra = {}) =>
  track('flashcard_review', { path: '/dashboard/flashcards', value: count, ...extra });

export const trackSearch = (term, resultCount = 0) =>
  track('search', { meta: { term: String(term).slice(0, 60), resultCount } });

export const trackFeature = (name, extra = {}) =>
  track('feature_use', { meta: { feature: name, ...(extra.meta ?? {}) }, ...extra });

export const trackSignup = () => track('signup', { path: '/auth' });
export const trackLogin = () => track('login', { path: '/auth' });
export const trackLogout = () => track('logout', { path: '/auth' });

/*
 * شناسهٔ کاربر سایت — بدون دادهٔ شخصی.
 *
 * هویت واقعی کاربر در این پروژه شمارهٔ موبایل است و شماره هرگز از مرورگر بیرون
 * نمی‌رود. به‌جایش یک شبه‌نام یک‌طرفه (FNV-1a) فرستاده می‌شود که برای «شمردن
 * کاربر یکتا» و «اتصال رویدادها به یک نفر» کافی است و برگشت‌پذیر نیست.
 */
function pseudonym(value) {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `u-${hash.toString(36)}`;
}

function readStoredUserId() {
  try {
    const user = getStoredUser();
    const identity = user?.id ?? user?.phone ?? user?.username;
    return identity ? pseudonym(identity) : null;
  } catch {
    return null;
  }
}

/* وضعیت فعلی — برای صفحهٔ تنظیمات حریم خصوصی */
export function trackingStatus() {
  return {
    enabled: state.started,
    optedOut: typeof window === 'undefined' ? true : isOptedOut(),
    sessionId: state.sessionId,
    queued: state.queue.length,
  };
}
