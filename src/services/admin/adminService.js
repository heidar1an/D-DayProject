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
const del = (path) => request('DELETE', path, {});

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
  auth, articles, categories, pages, media, banners, users, settings, logs, notes,
  analytics, getStats, getMeta, toQuery, readFileAsBase64, AdminApiError,
};
