/*
 * Smoke test پنل مدیریت — بدون هیچ فریم‌ورک تست.
 * اجرا: node database/adminApi.test.mjs
 *
 * روی همان هندلر واقعی API کار می‌کند و سنجه‌های امنیتی/عملکردی را بررسی می‌کند:
 *   ۱) ورود با رمز درست
 *   ۲) رد رمز نادرست
 *   ۳) رد درخواست بدون نشست
 *   ۴) رد درخواست بدون هدر CSRF
 *   ۵) مجوزدهی بر پایهٔ نقش
 *   ۶) پاک‌سازی XSS در محتوا
 *   ۷) صفحه‌بندی سمت سرور
 *   ۸) اعتبارسنجی نوع فایل در آپلود
 *   ۹) ثبت رویداد در audit log
 *  ۱۰) یادداشت‌های پنل: اعتبارسنجی، ساخت، فهرست و تیک آیتم
 *  ۱۱) تفکیک مالکیت یادداشت‌ها بین مدیران
 *  ۱۲) پذیرش تلمتری عمومی مرورگر (بدون احراز هویت)
 *  ۱۳) رد تلمتری خالی
 *  ۱۴) خواندن بخش‌های مرکز تحلیل با نقش مجاز
 *  ۱۵) رد بخش‌های حساس (کاربران، مالی، امنیت) برای نقش غیرمجاز
 *  ۱۶) هشدارها: ساخت، اعتبارسنجی، فهرست و حذف
 *  ۱۷) Monitoring API
 */

import assert from 'node:assert/strict';

import { handleApi } from './adminApi.js';

const ORIGIN = 'http://localhost';

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    end(chunk) {
      this.body = chunk ?? '';
    },
  };
}

async function call(method, path, { body, cookies = {}, csrf, headers = {} } = {}) {
  const cookieHeader = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ');
  const request = {
    method,
    url: path,
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(csrf ? { 'x-tapesh-csrf': csrf } : {}),
      ...headers,
    },
    socket: { remoteAddress: '127.0.0.1' },
    on(event, handler) {
      if (event === 'data' && body !== undefined) handler(Buffer.from(JSON.stringify(body)));
      if (event === 'end') handler();
      return this;
    },
  };

  const response = createResponse();
  await handleApi(request, response);
  return { status: response.statusCode, payload: JSON.parse(response.body || '{}'), headers: response.headers };
}

const results = [];
function check(name, condition) {
  results.push({ name, pass: Boolean(condition) });
  assert.ok(condition, `FAILED: ${name}`);
}

/* ۱) ورود با اعتبار درست */
const login = await call('POST', '/api/admin/auth/login', {
  body: { username: '0135', password: '0135' },
});
check('۱. ورود با نام کاربری و رمز درست', login.status === 200 && login.payload.data?.admin?.role === 'super-admin');

const setCookie = login.headers.get('set-cookie') ?? '';
const token = setCookie.match(/tapesh_admin_session=([^;]+)/)?.[1] ?? '';
const csrf = login.payload.data?.csrfToken ?? '';
const cookies = { tapesh_admin_session: token };

/* ۲) رمز نادرست */
const badLogin = await call('POST', '/api/admin/auth/login', {
  body: { username: '0135', password: 'wrong-password' },
});
check('۲. رد رمز عبور نادرست', badLogin.status === 401 && badLogin.payload.error?.code === 'INVALID_CREDENTIALS');

/* ۳) بدون نشست */
const anonymous = await call('GET', '/api/admin/stats');
check('۳. رد دسترسی بدون نشست', anonymous.status === 401 && anonymous.payload.error?.code === 'UNAUTHENTICATED');

/* ۴) بدون هدر CSRF */
const noCsrf = await call('POST', '/api/admin/articles', {
  cookies,
  body: { title: 'تست', category: 'physiology' },
});
check('۴. رد درخواست تغییردهنده بدون CSRF', noCsrf.status === 403);

/* ۶) XSS — قبل از بررسی مجوز لازم است، پس با مدیر کل انجام می‌شود */
const created = await call('POST', '/api/admin/articles', {
  cookies,
  csrf,
  body: {
    title: 'مقاله تست امنیت',
    category: 'physiology',
    status: 'published',
    contentHtml:
      '<p onclick="alert(1)">متن سالم</p><script>alert("xss")</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">لینک</a>',
  },
});
const article = created.payload.data?.article;
check('۶. پاک‌سازی HTML مخرب پیش از ذخیره', article && !/script|onerror|onclick|javascript:/i.test(article.contentHtml));

/* ۷) صفحه‌بندی سمت سرور */
const list = await call('GET', '/api/admin/articles?page=1&perPage=1', { cookies });
check('۷. صفحه‌بندی سمت سرور', list.payload.data?.perPage === 1 && Array.isArray(list.payload.data?.items));

/* ۸) آپلود با نوع غیرمجاز */
const upload = await call('POST', '/api/admin/media', {
  cookies,
  csrf,
  body: { originalName: 'evil.html', mimeType: 'text/html', data: Buffer.from('<script>').toString('base64') },
});
check('۸. رد آپلود با MIME غیرمجاز', upload.status === 415);

/* ۹) Audit log */
const logs = await call('GET', '/api/admin/logs', { cookies });
check('۹. ثبت رویداد در گزارش', logs.payload.data?.total > 0 && logs.payload.data.items.some((entry) => entry.action === 'auth.login'));

/* ۵) مجوزدهی — یک نویسنده نباید کاربر بسازد */
/* اگر اجرای قبلی کاربر تست را جا گذاشته باشد، اول پاکش می‌کنیم تا تست تکرارشدنی بماند */
const staleEditors = await call('GET', '/api/admin/users?search=editor-test', { cookies });
const stale = (staleEditors.payload.data?.items ?? []).find((row) => row.username === 'editor-test');
if (stale) await call('DELETE', `/api/admin/users/${stale.id}`, { cookies, csrf });

const editor = await call('POST', '/api/admin/users', {
  cookies,
  csrf,
  body: { username: 'editor-test', password: '1234', role: 'editor', name: 'نویسنده تست' },
});
check('۵. ساخت کاربر توسط مدیر کل', editor.status === 200 && editor.payload.data?.admin?.role === 'editor');

const editorLogin = await call('POST', '/api/admin/auth/login', {
  body: { username: 'editor-test', password: '1234' },
});
const editorToken = (editorLogin.headers.get('set-cookie') ?? '').match(/tapesh_admin_session=([^;]+)/)?.[1] ?? '';
const editorCsrf = editorLogin.payload.data?.csrfToken ?? '';

const forbidden = await call('DELETE', `/api/admin/articles/${article.id}`, {
  cookies: { tapesh_admin_session: editorToken },
  csrf: editorCsrf,
});
check('۵. رد حذف مقاله توسط نویسنده', forbidden.status === 403);

const allowed = await call('GET', '/api/admin/articles', { cookies: { tapesh_admin_session: editorToken } });
check('۵. اجازهٔ خواندن مقاله برای نویسنده', allowed.status === 200);

/* ۱۰) یادداشت‌های پنل — ساخت، فهرست، تیک و تفکیک مالکیت */
const emptyNote = await call('POST', '/api/admin/notes', { cookies, csrf, body: { title: '', body: '' } });
check('۱۰. رد یادداشت خالی', emptyNote.status === 400 && emptyNote.payload.error?.code === 'VALIDATION_ERROR');

const note = await call('POST', '/api/admin/notes', {
  cookies,
  csrf,
  body: {
    title: 'یادداشت تست',
    kind: 'checklist',
    items: [{ text: 'کار اول' }, { text: 'کار دوم' }],
  },
});
const savedNote = note.payload.data?.note;
check('۱۰. ساخت یادداشت چک‌لیستی', note.status === 200 && savedNote?.items?.length === 2);

const noteList = await call('GET', '/api/admin/notes?search=تست', { cookies });
check('۱۰. یادداشت در فهرست خودم', noteList.payload.data?.notes?.some((row) => row.id === savedNote.id));

const toggled = await call('POST', `/api/admin/notes/${savedNote.id}/items/${savedNote.items[0].id}/toggle`, { cookies, csrf });
check('۱۰. تیک‌زدن آیتم چک‌لیست', toggled.payload.data?.note?.items?.[0]?.done === true);

const editorNotes = await call('GET', '/api/admin/notes', { cookies: { tapesh_admin_session: editorToken } });
check(
  '۱۱. یادداشت هر مدیر فقط برای خودش',
  editorNotes.status === 200 && !(editorNotes.payload.data?.notes ?? []).some((row) => row.id === savedNote.id),
);

/* ۱۲) تلمتری عمومی — رویداد واقعی مرورگر بدون احراز هویت ثبت می‌شود */
const collect = await call('POST', '/api/public/analytics/collect', {
  body: {
    events: [
      { type: 'page_view', sessionId: 'test-session', path: '/articles/test', referrer: 'https://www.google.com/' },
      { type: 'test_submit', sessionId: 'test-session', path: '/#dashboard', meta: { questions: 5, subjectId: 'physiology' } },
    ],
  },
});
check('۱۲. پذیرش تلمتری عمومی بدون احراز هویت', collect.status === 202 && collect.payload.data?.recorded === 2);

const emptyCollect = await call('POST', '/api/public/analytics/collect', { body: { events: [] } });
check('۱۳. رد تلمتری خالی', emptyCollect.status === 400 && emptyCollect.payload.error?.code === 'VALIDATION_ERROR');

/* ۱۴) مرکز تحلیل — خواندن با نقش مجاز و رد بخش حساس برای نقش غیرمجاز */
const overview = await call('GET', '/api/admin/analytics/overview?range=7d', { cookies });
check(
  '۱۴. خواندن نمای کلی تحلیل توسط مدیر کل',
  overview.status === 200 && Array.isArray(overview.payload.data?.data?.kpis) && overview.payload.data.data.kpis.length > 10,
);

const realtime = await call('GET', '/api/admin/analytics/realtime', { cookies });
check('۱۴. بخش لحظه‌ای پاسخ می‌دهد', realtime.status === 200 && typeof realtime.payload.data?.data?.onlineSessions === 'number');

const ai = await call('GET', '/api/admin/analytics/ai', { cookies });
check('۱۴. تحلیل‌گر یافته‌ها را برمی‌گرداند', ai.status === 200 && Array.isArray(ai.payload.data?.data?.findings));

const sources = await call('GET', '/api/admin/analytics/sources', { cookies });
check('۱۴. فهرست منابع داده', sources.status === 200 && sources.payload.data?.sources?.some((source) => source.id === 'payment'));

const editorOverview = await call('GET', '/api/admin/analytics/overview', { cookies: { tapesh_admin_session: editorToken } });
check('۱۴. نویسنده نمای کلی تحلیل را می‌بیند', editorOverview.status === 200);

const editorRevenue = await call('GET', '/api/admin/analytics/revenue', { cookies: { tapesh_admin_session: editorToken } });
check('۱۵. رد بخش مالی برای نقش غیرمجاز', editorRevenue.status === 403);

const editorUsers = await call('GET', '/api/admin/analytics/users', { cookies: { tapesh_admin_session: editorToken } });
check('۱۵. رد دادهٔ کاربران برای نقش غیرمجاز', editorUsers.status === 403);

const revenue = await call('GET', '/api/admin/analytics/revenue', { cookies });
check('۱۵. بخش درآمد بدون درگاه، «نیازمند اتصال» است', revenue.status === 200 && revenue.payload.data?.data?.connected === false);

const security = await call('GET', '/api/admin/analytics/security', { cookies });
check('۱۵. مرکز امنیت با لاگ واقعی', security.status === 200 && security.payload.data?.data?.audit?.total > 0);

const seo = await call('GET', '/api/admin/analytics/seo', { cookies });
check('۱۵. ممیزی on-page سئو روی محتوای واقعی', seo.status === 200 && Array.isArray(seo.payload.data?.data?.health));

/* ۱۶) هشدارها — ساخت، فهرست، حذف + monitoring API */
const alertCreated = await call('POST', '/api/admin/analytics/alerts', {
  cookies,
  csrf,
  body: { name: 'هشدار تست', metric: 'error_rate', comparator: 'above', threshold: 7, severity: 'high' },
});
const savedAlert = alertCreated.payload.data?.alert;
check('۱۶. ساخت هشدار', alertCreated.status === 200 && savedAlert?.metric === 'error_rate');

const badAlert = await call('POST', '/api/admin/analytics/alerts', {
  cookies,
  csrf,
  body: { name: 'نامعتبر', metric: 'not-a-metric', threshold: 1 },
});
check('۱۶. رد هشدار با سنجهٔ نامعتبر', badAlert.status === 400);

const alertList = await call('GET', '/api/admin/analytics/alerts', { cookies });
check('۱۶. هشدار در فهرست و ارزیابی‌شده', alertList.payload.data?.data?.alerts?.some((row) => row.id === savedAlert.id));

const editorAlert = await call('DELETE', `/api/admin/analytics/alerts/${savedAlert.id}`, {
  cookies: { tapesh_admin_session: editorToken },
  csrf: editorCsrf,
});
check('۱۶. رد مدیریت هشدار برای نقش غیرمجاز', editorAlert.status === 403);

await call('DELETE', `/api/admin/analytics/alerts/${savedAlert.id}`, { cookies, csrf });

const ping = await call('GET', '/api/admin/analytics/ping', { cookies });
check('۱۷. Monitoring API وضعیت سرور را می‌دهد', ping.status === 200 && typeof ping.payload.data?.uptimeSeconds === 'number');

/* پاک‌سازی داده‌های تست */
await call('POST', '/api/admin/analytics/reset', { cookies, csrf });
await call('DELETE', `/api/admin/notes/${savedNote.id}`, { cookies, csrf });
await call('DELETE', `/api/admin/articles/${article.id}`, { cookies, csrf });
await call('DELETE', `/api/admin/users/${editor.payload.data.admin.id}`, { cookies, csrf });

console.log('\nنتیجهٔ تست پنل مدیریت:');
results.forEach((result) => console.log(`  ${result.pass ? '✓' : '✗'} ${result.name}`));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} سنجه موفق\n`);
