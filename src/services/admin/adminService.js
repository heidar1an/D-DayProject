/*
 * سرویس پنل مدیریت تپش — تنها نقطهٔ تماس UI با API.
 *
 * هیچ کامپوننتی مستقیم fetch نمی‌زند. قرارداد پاسخ سرور:
 *   { success: true, data }  |  { success: false, error: { code, message, fields } }
 *
 * نکات امنیتی سمت کلاینت:
 *   - توکن نشست در کوکی HttpOnly است و این کد هرگز آن را نمی‌خواند؛ فقط
 *     `credentials: 'same-origin'` می‌فرستد تا مرورگر کوکی را ضمیمه کند.
 *   - توکن CSRF در حافظهٔ همین ماژول نگه داشته می‌شود (نه localStorage) و روی
 *     هر درخواست تغییردهنده در هدر می‌رود.
 */

const API_BASE = '/api/admin';

export class AdminApiError extends Error {
  constructor({ code, message, status, fields }) {
    super(message || 'خطای نامشخص');
    this.name = 'AdminApiError';
    this.code = code || 'INTERNAL_ERROR';
    this.status = status || 0;
    this.fields = fields ?? null;
  }
}

let csrfToken = null;

export function setCsrfToken(token) {
  csrfToken = token || null;
}

export function getCsrfToken() {
  return csrfToken;
}

async function request(method, path, body, { signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrfToken && method !== 'GET') headers['x-tapesh-csrf'] = csrfToken;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new AdminApiError({
      code: 'NETWORK_ERROR',
      message: 'ارتباط با سرور برقرار نشد. مطمئن شوید سرور در حال اجراست.',
    });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    throw new AdminApiError({
      status: response.status,
      code: payload?.error?.code,
      message: payload?.error?.message,
      fields: payload?.error?.fields,
    });
  }

  return payload.data;
}

const get = (path, options) => request('GET', path, undefined, options);
const post = (path, body) => request('POST', path, body ?? {});
const put = (path, body) => request('PUT', path, body ?? {});
const del = (path, body = {}) => request('DELETE', path, body);

/* ─────────────────────────── ساخت پارامترهای لیست ─────────────────────────── */

export function toQuery(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') return;
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

/* ─────────────────────────────── احراز هویت ─────────────────────────────── */

export const auth = {
  async login(credentials) {
    const data = await post('/auth/login', credentials);
    setCsrfToken(data.csrfToken);
    return data.admin;
  },

  async logout() {
    try {
      await post('/auth/logout');
    } finally {
      setCsrfToken(null);
    }
  },

  async me() {
    const data = await get('/auth/me');
    setCsrfToken(data.csrfToken);
    return data.admin;
  },

  changePassword(payload) {
    return post('/auth/password', payload);
  },
};

/* ──────────────────────────────── داشبورد ──────────────────────────────── */

export const getStats = (options) => get('/stats', options);
export const getMeta = () => get('/meta');

/* ──────────────────────────────── مقالات ──────────────────────────────── */

export const articles = {
  list: (params) => get(`/articles${toQuery(params)}`),
  get: (id) => get(`/articles/${encodeURIComponent(id)}`),
  create: (payload) => post('/articles', payload),
  update: (id, payload) => put(`/articles/${encodeURIComponent(id)}`, payload),
  setStatus: (id, status) => post(`/articles/${encodeURIComponent(id)}/status`, { status }),
  remove: (id) => del(`/articles/${encodeURIComponent(id)}`),
};

/* ─────────────────────────────── دسته‌بندی‌ها ─────────────────────────────── */

export const categories = {
  list: () => get('/categories'),
  create: (payload) => post('/categories', payload),
  update: (id, payload) => put(`/categories/${encodeURIComponent(id)}`, payload),
  remove: (id) => del(`/categories/${encodeURIComponent(id)}`),
};

/* ──────────────────────────────── صفحات ──────────────────────────────── */

export const pages = {
  list: (params) => get(`/pages${toQuery(params)}`),
  get: (id) => get(`/pages/${encodeURIComponent(id)}`),
  create: (payload) => post('/pages', payload),
  update: (id, payload) => put(`/pages/${encodeURIComponent(id)}`, payload),
  remove: (id) => del(`/pages/${encodeURIComponent(id)}`),
};

/* ──────────────── کتابخانهٔ فلش‌کارت تپش (مجموعه‌ها و کارت‌ها) ──────────────── */

export const flashcards = {
  list: (params) => get(`/flashcards${toQuery(params)}`),
  get: (id) => get(`/flashcards/${encodeURIComponent(id)}`),
  create: (payload) => post('/flashcards', payload),
  update: (id, payload) => put(`/flashcards/${encodeURIComponent(id)}`, payload),
  remove: (id) => del(`/flashcards/${encodeURIComponent(id)}`),
};

/* ──────────────── میکرو درسنامه (لایهٔ داخل پنل) ────────────────
 *
 * ساختار کامل درسنامه (مبحث → واحد → صفحه → بلوک → ایستگاه تست) در یک رکورد
 * است، پس ویرایش یک PUT کامل می‌فرستد و ذخیره اتمیک می‌ماند. `setStatus` تنها
 * راه انتشار است: با `published` درسنامه از مسیر عمومی `/api/public/micro/library`
 * در دسترس همهٔ کاربران تپش می‌گذارد.
 */

export const micro = {
  list: (params) => get(`/micro${toQuery(params)}`),
  get: (id) => get(`/micro/${encodeURIComponent(id)}`),
  create: (payload) => post('/micro', payload),
  update: (id, payload) => put(`/micro/${encodeURIComponent(id)}`, payload),
  setStatus: (id, status) => post(`/micro/${encodeURIComponent(id)}/status`, { status }),
  remove: (id) => del(`/micro/${encodeURIComponent(id)}`),

  /* انتخاب از بانک تست — برای ایستگاه‌های تست */
  testBank: (params) => get(`/micro/test-bank${toQuery(params)}`),

  /* درس‌های رجیستری برای فرم «درسنامهٔ تازه» — از سرور می‌آید تا باندل پنل
     مجبور نباشد ۱۶ فایل درس را با خودش حمل کند */
  subjects: () => get('/micro/subjects'),
};

/* ──────────────────────────────── رسانه ──────────────────────────────── */

export const media = {
  list: (params) => get(`/media${toQuery(params)}`),
  create: (payload) => post('/media', payload),
  update: (id, payload) => put(`/media/${encodeURIComponent(id)}`, payload),
  remove: (id) => del(`/media/${encodeURIComponent(id)}`),
};

/* ──────────────────────────────── بنرها ──────────────────────────────── */

export const banners = {
  list: () => get('/banners'),
  create: (payload) => post('/banners', payload),
  update: (id, payload) => put(`/banners/${encodeURIComponent(id)}`, payload),
  remove: (id) => del(`/banners/${encodeURIComponent(id)}`),
};

/* ──────────────────────────────── مدیران ──────────────────────────────── */

export const users = {
  list: (params) => get(`/users${toQuery(params)}`),
  create: (payload) => post('/users', payload),
  update: (id, payload) => put(`/users/${encodeURIComponent(id)}`, payload),
  remove: (id) => del(`/users/${encodeURIComponent(id)}`),
};

/* ─────────────────────────────── تنظیمات ─────────────────────────────── */

export const settings = {
  get: () => get('/settings'),
  update: (payload) => put('/settings', payload),
};

/* ───────────────────────────── گزارش رویدادها ───────────────────────────── */

export const logs = {
  list: (params) => get(`/logs${toQuery(params)}`),
};

/* ──────────────────────────── یادداشت‌های پنل ──────────────────────────── */

export const notes = {
  list: (params) => get(`/notes${toQuery(params)}`),
  get: (id) => get(`/notes/${encodeURIComponent(id)}`),
  create: (payload) => post('/notes', payload),
  update: (id, payload) => put(`/notes/${encodeURIComponent(id)}`, payload),
  setPinned: (id, pinned) => post(`/notes/${encodeURIComponent(id)}/pin`, { pinned }),
  toggleItem: (id, itemId) => post(`/notes/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/toggle`),
  remove: (id) => del(`/notes/${encodeURIComponent(id)}`),
};

/* ───────────────────────────── مرکز تحلیل ─────────────────────────────
 *
 * ۱۶ بخش، هرکدام یک Endpoint با Permission مستقل. بخش‌های حساس (کاربران، SEO،
 * مالی، امنیت) مجوز جدا دارند و به نقش غیرمجاز داده نمی‌شوند؛ کلاینت هم فقط
 * بخش‌های مجاز را می‌سازد تا درخواست بی‌دلیل ۴۰۳ نرود.
 *
 * پارامتر بازه: `{ range, from, to }` — همان قرارداد سرور.
 */

/* برچسب بازه‌ها برای انتخابگر تاریخ — باید با RANGES سرور یکی بماند */
export const ANALYTICS_RANGES = [
  { key: 'today', label: 'امروز' },
  { key: '7d', label: '۷ روز اخیر' },
  { key: '30d', label: '۳۰ روز اخیر' },
  { key: '90d', label: '۹۰ روز اخیر' },
  { key: 'ytd', label: 'امسال' },
  { key: 'custom', label: 'بازهٔ سفارشی' },
];

/*
 * فهرست بخش‌ها — ترتیب همین آرایه، ترتیب منو و تب‌هاست. `permission` تعیین
 * می‌کند چه کسی بخش را می‌بیند و `label` عنوان فارسی آن است.
 */
export const ANALYTICS_SECTIONS = [
  { key: 'overview', label: 'نمای کلی', permission: 'analytics.read' },
  { key: 'traffic', label: 'ترافیک', permission: 'analytics.read' },
  { key: 'users', label: 'کاربران', permission: 'analytics.users.read' },
  { key: 'education', label: 'آموزش', permission: 'analytics.read' },
  { key: 'seo', label: 'سئو', permission: 'analytics.seo.read' },
  { key: 'performance', label: 'عملکرد فنی', permission: 'analytics.read' },
  { key: 'security', label: 'امنیت', permission: 'analytics.security.read' },
  { key: 'revenue', label: 'درآمد', permission: 'analytics.revenue.read' },
  { key: 'products', label: 'محصولات', permission: 'analytics.read' },
  { key: 'content', label: 'محتوا', permission: 'analytics.read' },
  { key: 'marketing', label: 'بازاریابی', permission: 'analytics.read' },
  { key: 'system', label: 'سلامت سیستم', permission: 'analytics.read' },
  { key: 'errors', label: 'خطاها', permission: 'analytics.read' },
  { key: 'realtime', label: 'لحظه‌ای', permission: 'analytics.read' },
  { key: 'alerts', label: 'هشدارها', permission: 'analytics.read' },
  { key: 'ai', label: 'تحلیلگر هوشمند', permission: 'analytics.read' },
];

const rangeQuery = (params = {}) => toQuery({
  range: params.range,
  from: params.from,
  to: params.to,
});

export const analytics = {
  /* هر بخش: { section, range, data } */
  section: (name, params) => get(`/analytics/${encodeURIComponent(name)}${rangeQuery(params)}`),

  /* وضعیت اتصال منابع دادهٔ بیرونی + فهرست مجوزها */
  sources: (options) => get('/analytics/sources', options),

  /* Monitoring API — پاسخ سبک برای ابزارهای پایش */
  ping: (options) => get('/analytics/ping', options),

  /* دادهٔ تخت برای خروجی CSV/Excel — مجوز جدا دارد */
  export: (name, params) => get(`/analytics/export${toQuery({ section: name, ...params })}`),

  alerts: {
    list: (params) => get(`/analytics/alerts${rangeQuery(params)}`),
    create: (payload) => post('/analytics/alerts', payload),
    update: (id, payload) => put(`/analytics/alerts/${encodeURIComponent(id)}`, payload),
    remove: (id) => del(`/analytics/alerts/${encodeURIComponent(id)}`),
  },

  /* پاک‌سازی رویدادهای ثبت‌شده — ابزار توسعه */
  reset: () => post('/analytics/reset'),
};

/* ───────────────────── انتشار در کانال‌های پیام‌رسان ─────────────────────
 *
 * نکتهٔ امنیتی: توکن ربات بله هیچ‌وقت از سرور برنمی‌گردد. این سرویس فقط
 * `hasToken` و راهنمای ماسک‌شده (`tokenHint`) می‌گیرد و توکن را فقط یک‌بار،
 * در همان درخواست ذخیره، به سرور می‌فرستد.
 */

export const publishing = {
  /* کانال‌ها + آمار + تنظیمات پلتفرم‌ها (همه در یک درخواست) */
  channels: () => get('/publishing/channels'),

  createChannel: (payload) => post('/publishing/channels', payload),
  updateChannel: (id, payload) => put(`/publishing/channels/${encodeURIComponent(id)}`, payload),
  removeChannel: (id) => del(`/publishing/channels/${encodeURIComponent(id)}`),

  /* توکن خالی = پاک‌کردن توکن ثبت‌شده */
  setToken: (id, token) => post(`/publishing/channels/${encodeURIComponent(id)}/token`, { token }),
  testChannel: (id) => post(`/publishing/channels/${encodeURIComponent(id)}/test`),

  /*
   * تست اعتبار پیش از ذخیره: توکن و دسترسی ربات به کانال را همان‌طور که در فرم
   * نوشته شده بررسی می‌کند، بدون نیاز به وجود کانال. توکن فقط یک‌بار به سرور
   * می‌رود و در پاسخ برنمی‌گردد.
   */
  testCredentials: (payload) => post('/publishing/test', payload),

  /* پیش‌نمایش سمت سرور — بدون شبکه؛ تضمین می‌کند پیش‌نمایش = ارسال */
  preview: (content) => post('/publishing/preview', content),

  /* مقاله‌های منتشرشده و رسانه‌های تازه برای انتخاب محتوا */
  targets: () => get('/publishing/targets'),

  send: (payload) => post('/publishing/send', payload),
  log: (params) => get(`/publishing/log${toQuery(params)}`),
};

/* ─────────────────── مرکز رسانه و فضای مجازی ───────────────────
 *
 * یک فضای‌نام برای همهٔ بخش‌های مرکز رسانه. قراردادها همان قرارداد پنل است:
 * پاسخ `{ success, data }` و خطا به شکل `AdminApiError`.
 *
 * نکتهٔ امنیتی همان نکتهٔ انتشار است: توکن و کلید اپ (App ID/Secret) هرگز از
 * سرور برنمی‌گردد. این سرویس فقط `hasToken`/`hasAppKeys` و راهنمای ماسک‌شده
 * می‌گیرد و مقدار را فقط یک‌بار، در همان درخواست ذخیره، به سرور می‌فرستد.
 */

/* برچسب بازه‌ها — باید با MEDIA_RANGES سرور یکی بماند */
export const MEDIA_RANGES = [
  { key: 'today', label: 'امروز' },
  { key: 'yesterday', label: 'دیروز' },
  { key: '7d', label: '۷ روز اخیر' },
  { key: '30d', label: '۳۰ روز اخیر' },
  { key: '90d', label: '۳ ماه اخیر' },
  { key: '180d', label: '۶ ماه اخیر' },
  { key: '365d', label: 'یک سال اخیر' },
  { key: 'custom', label: 'بازهٔ دلخواه' },
];

export const mediaCenter = {
  /* فراداده: پلتفرم‌ها، وضعیت‌ها، نوع‌ها، نقش‌ها، بازه‌ها */
  config: () => get('/media/config'),

  /* شمارنده‌های سبک برای نشان‌های منو و هدر */
  summary: () => get('/media/summary'),

  /* داشبورد مرکزی */
  overview: (params) => get(`/media/overview${rangeQuery(params)}`),

  /* تحلیل: پلتفرم، اکانت، نوع محتوا، هشتگ و موضوع، قیف UTM */
  analytics: (params = {}) => get(`/media/analytics${toQuery({
    range: params.range,
    from: params.from,
    to: params.to,
    compare: Array.isArray(params.compare) && params.compare.length ? params.compare.join(',') : undefined,
  })}`),

  /* جستجوی مرکزی روی همهٔ موجودیت‌ها */
  search: (term) => get(`/media/search${toQuery({ term })}`),

  /* گزارش آمادهٔ خروجی (سطرهای تخت + خلاصه) */
  report: (params = {}) => get(`/media/report${toQuery(params)}`),

  /* ── پلتفرم‌ها ── */
  platforms: () => get('/media/platforms'),
  savePlatform: (payload) => post('/media/platforms', payload),
  removePlatform: (id) => del(`/media/platforms/${encodeURIComponent(id)}`),

  /* ── اکانت‌ها و کانال‌ها ── */
  accounts: (params) => get(`/media/accounts${toQuery(params)}`),
  account: (id) => get(`/media/accounts/${encodeURIComponent(id)}`),
  accountSeries: (id, params) => get(`/media/accounts/${encodeURIComponent(id)}/series${rangeQuery(params)}`),
  createAccount: (payload) => post('/media/accounts', payload),
  updateAccount: (id, payload) => put(`/media/accounts/${encodeURIComponent(id)}`, payload),
  removeAccount: (id) => del(`/media/accounts/${encodeURIComponent(id)}`),

  /* مقدار خالی = پاک‌کردن اعتبار ثبت‌شده */
  setCredentials: (id, payload) => post(`/media/accounts/${encodeURIComponent(id)}/credentials`, payload),

  /* تست اعتبار پیش از ذخیره — توکن از فرم می‌آید، اکانت لازم نیست */
  testCredentials: (payload) => post('/media/accounts/test', payload),
  testAccount: (id) => post(`/media/accounts/${encodeURIComponent(id)}/test`),
  syncAccount: (id) => post(`/media/accounts/${encodeURIComponent(id)}/sync`),
  syncAccounts: (platform) => post(`/media/accounts/sync${toQuery({ platform })}`),

  /* ادغام کانال‌های انتشار موجود به‌عنوان اکانت رسانه */
  importChannels: () => post('/media/accounts/import'),

  /* ── محتوا ── */
  contents: (params) => get(`/media/contents${toQuery(params)}`),
  content: (id) => get(`/media/contents/${encodeURIComponent(id)}`),
  contentAnalytics: (id) => get(`/media/contents/${encodeURIComponent(id)}/analytics`),
  createContent: (payload) => post('/media/contents', payload),
  updateContent: (id, payload) => put(`/media/contents/${encodeURIComponent(id)}`, payload),
  removeContent: (id) => del(`/media/contents/${encodeURIComponent(id)}`),
  setContentStatus: (id, status, note) => post(`/media/contents/${encodeURIComponent(id)}/status`, { status, note }),
  submitContent: (id, payload) => post(`/media/contents/${encodeURIComponent(id)}/submit`, payload ?? {}),
  approveContent: (id, note) => post(`/media/contents/${encodeURIComponent(id)}/approve`, { note }),
  requestRevision: (id, payload) => post(`/media/contents/${encodeURIComponent(id)}/revision`, payload),
  scheduleContent: (id, scheduledAt, note) => post(`/media/contents/${encodeURIComponent(id)}/schedule`, { scheduledAt, note }),
  publishContent: (id, dryRun) => post(`/media/contents/${encodeURIComponent(id)}/publish`, { dryRun: dryRun === true }),
  retryContent: (id) => post(`/media/contents/${encodeURIComponent(id)}/retry`),

  /* پیش‌نمایش سمت سرور — بدون شبکه؛ تضمین می‌کند پیش‌نمایش = انتشار */
  previewContent: (payload) => post('/media/contents/preview', payload),

  calendar: (params) => get(`/media/calendar${toQuery(params)}`),
  queue: () => get('/media/queue'),
  runQueue: (limit) => post('/media/queue/run', { limit }),

  /* ── کمپین‌ها ── */
  campaigns: (params) => get(`/media/campaigns${toQuery(params)}`),
  campaign: (id) => get(`/media/campaigns/${encodeURIComponent(id)}`),
  createCampaign: (payload) => post('/media/campaigns', payload),
  updateCampaign: (id, payload) => put(`/media/campaigns/${encodeURIComponent(id)}`, payload),
  removeCampaign: (id) => del(`/media/campaigns/${encodeURIComponent(id)}`),

  /* ── تیم رسانه ── */
  team: (params) => get(`/media/team${toQuery(params)}`),
  addMember: (payload) => post('/media/team', payload),
  updateMember: (id, payload) => put(`/media/team/${encodeURIComponent(id)}`, payload),
  removeMember: (id) => del(`/media/team/${encodeURIComponent(id)}`),

  /* ── هشتگ و موضوع ── */
  tags: (params) => get(`/media/tags${toQuery(params)}`),
  addTag: (payload) => post('/media/tags', payload),
  updateTag: (id, payload) => put(`/media/tags/${encodeURIComponent(id)}`, payload),
  removeTag: (id) => del(`/media/tags/${encodeURIComponent(id)}`),

  /* ── سنجه‌ها ── */
  metrics: (params) => get(`/media/metrics${toQuery(params)}`),
  saveMetrics: (payload) => post('/media/metrics', payload),
  removeMetrics: (id) => del(`/media/metrics/${encodeURIComponent(id)}`),

  /* ── کتابخانهٔ رسانه ── */
  assets: (params) => get(`/media/assets${toQuery(params)}`),
  updateAsset: (id, payload) => put(`/media/assets/${encodeURIComponent(id)}`, payload),
  archiveAsset: (id, isArchived) => post(`/media/assets/${encodeURIComponent(id)}/archive`, { isArchived }),
  removeAsset: (id, force) => del(`/media/assets/${encodeURIComponent(id)}`, { force }),

  /* ── اینباکس ── */
  inbox: (params) => get(`/media/inbox${toQuery(params)}`),
  addInboxItem: (payload) => post('/media/inbox', payload),
  setInboxStatus: (id, status) => post(`/media/inbox/${encodeURIComponent(id)}/status`, { status }),
  assignInboxItem: (id, assignedToId) => post(`/media/inbox/${encodeURIComponent(id)}/assign`, { assignedToId }),
  replyInboxItem: (id, text) => post(`/media/inbox/${encodeURIComponent(id)}/reply`, { text }),
  removeInboxItem: (id) => del(`/media/inbox/${encodeURIComponent(id)}`),

  /* ── رصد نام و کلیدواژه ── */
  mentions: (params) => get(`/media/mentions${toQuery(params)}`),
  listeningSummary: () => get('/media/mentions/summary'),
  addMention: (payload) => post('/media/mentions', payload),
  updateMention: (id, payload) => put(`/media/mentions/${encodeURIComponent(id)}`, payload),
  removeMention: (id) => del(`/media/mentions/${encodeURIComponent(id)}`),

  /* ── اعلان‌ها ── */
  notifications: (params) => get(`/media/notifications${toQuery(params)}`),
  refreshNotifications: () => post('/media/notifications/refresh'),
  setNotification: (id, payload) => post(`/media/notifications/${encodeURIComponent(id)}`, payload),
  markAllRead: () => post('/media/notifications/read-all'),

  /* ── UTM ── */
  utmLinks: (params) => get(`/media/utm${toQuery(params)}`),
  previewUtm: (payload) => post('/media/utm/preview', payload),
  addUtm: (payload) => post('/media/utm', payload),
  updateUtm: (id, payload) => put(`/media/utm/${encodeURIComponent(id)}`, payload),
  removeUtm: (id) => del(`/media/utm/${encodeURIComponent(id)}`),

  /* ── گزارش رویدادها ── */
  audit: (params) => get(`/media/audit${toQuery(params)}`),

  /* ── دادهٔ نمونه ── */
  clearDemo: () => post('/media/demo/clear'),
  seedDemo: () => post('/media/demo/seed'),
};

/* ───────────────────── خواندن فایل به‌صورت base64 (برای آپلود) ───────────────────── */

export function readFileAsBase64(file) {
  return new Promise((resolvePromise, rejectPromise) => {
    const reader = new FileReader();
    reader.onload = () => resolvePromise(String(reader.result ?? ''));
    reader.onerror = () => rejectPromise(new AdminApiError({ code: 'READ_ERROR', message: 'خواندن فایل ناموفق بود' }));
    reader.readAsDataURL(file);
  });
}

export default {
  auth, articles, categories, pages, flashcards, micro, media, banners, users, settings, logs, notes,
  publishing, analytics, mediaCenter, getStats, getMeta, toQuery, readFileAsBase64, AdminApiError,
};
