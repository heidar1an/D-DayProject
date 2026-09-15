/*
 * Smoke test پنل مدیریت — بدون هیچ فریم‌ورک تست.
 * اجرا: node database/adminApi.test.mjs
 *
 * روی همان هندلر واقعی API کار می‌کند و ۹ سنجهٔ امنیتی/عملکردی را بررسی می‌کند:
 *   ۱) ورود با رمز درست
 *   ۲) رد رمز نادرست
 *   ۳) رد درخواست بدون نشست
 *   ۴) رد درخواست بدون هدر CSRF
 *   ۵) مجوزدهی بر پایهٔ نقش
 *   ۶) پاک‌سازی XSS در محتوا
 *   ۷) صفحه‌بندی سمت سرور
 *   ۸) اعتبارسنجی نوع فایل در آپلود
 *   ۹) ثبت رویداد در audit log
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

/* پاک‌سازی داده‌های تست */
await call('DELETE', `/api/admin/articles/${article.id}`, { cookies, csrf });

console.log('\nنتیجهٔ تست پنل مدیریت:');
results.forEach((result) => console.log(`  ${result.pass ? '✓' : '✗'} ${result.name}`));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} سنجه موفق\n`);
