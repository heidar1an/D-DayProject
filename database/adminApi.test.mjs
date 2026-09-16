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
 *  ۱۸) انتشار در کانال‌ها: اعتبارسنجی کانال و پلتفرم
 *  ۱۹) کانال بدون توکن «آمادهٔ ارسال» نیست
 *  ۲۰) توکن ربات هرگز در پاسخ API برنمی‌گردد
 *  ۲۱) پیش‌نمایش پیام و رد محتوای خالی
 *  ۲۲) بدون توکن هیچ درخواستی به بیرون نمی‌رود (ارسال آزمایشی)
 *  ۲۳) تاریخچهٔ ارسال
 *  ۲۴) مجوز جدا برای مدیریت کانال
 *  ۲۵) منطق شکستن پیام (متن کوتاه/بلند + فایل)
 *  ۲۶) تست اعتبار پیش از ذخیره: توکن + دسترسی ربات به کانال (با fetch جعلی)
 */

import assert from 'node:assert/strict';

import { handleApi } from './adminApi.js';
import { readCollection, writeCollection } from './contentStore.js';
import { planBaleMessages } from './publishers/bale.js';
import { testCredentials } from './publishingStore.js';

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

/* ۱۸) انتشار در کانال‌ها — ساخت کانال، پنهان‌ماندن توکن، ارسال آزمایشی و مجوزها
 *
 * توکن محیطی عمداً پاک می‌شود تا تست قطعی بماند: اگر `BALE_BOT_TOKEN` روی ماشین
 * ست باشد، مسیر ارسال واقعی می‌شد و تست به شبکه وابسته می‌شد.
 */
delete process.env.BALE_BOT_TOKEN;
delete process.env.PUBLISH_DRY_RUN;

const badChannel = await call('POST', '/api/admin/publishing/channels', {
  cookies,
  csrf,
  body: { platform: 'bale', name: 'بی‌شناسه' },
});
check('۱۸. رد کانال بدون شناسه (chat_id)', badChannel.status === 400 && badChannel.payload.error?.code === 'VALIDATION_ERROR');

const badPlatform = await call('POST', '/api/admin/publishing/channels', {
  cookies,
  csrf,
  body: { platform: 'not-a-platform', name: 'تست', chatId: '@x' },
});
check('۱۸. رد پلتفرم پشتیبانی‌نشده', badPlatform.status === 400);

const channelCreated = await call('POST', '/api/admin/publishing/channels', {
  cookies,
  csrf,
  body: { platform: 'bale', name: 'کانال تست بله', chatId: '@tapesh_test', isActive: true },
});
const testChannel = channelCreated.payload.data?.channel;
check('۱۸. ساخت کانال بله', channelCreated.status === 200 && testChannel?.platform === 'bale');

const channelsAfterCreate = await call('GET', '/api/admin/publishing/channels', { cookies });
check(
  '۱۹. کانال تازه توکن ندارد و «آمادهٔ ارسال» نیست',
  channelsAfterCreate.payload.data?.channels?.some((row) => row.id === testChannel.id && row.hasToken === false && row.isReady === false),
);

/* توکن هرگز نباید در پاسخ هیچ مسیری ظاهر شود */
const tokenValue = '123456789:TEST-TOKEN-DO-NOT-LEAK';
const tokenSet = await call('POST', `/api/admin/publishing/channels/${testChannel.id}/token`, {
  cookies,
  csrf,
  body: { token: tokenValue },
});
check(
  '۲۰. ثبت توکن و پنهان‌ماندن مقدار آن در پاسخ',
  tokenSet.status === 200
    && tokenSet.payload.data?.hasToken === true
    && !JSON.stringify(tokenSet.payload).includes(tokenValue)
    && tokenSet.payload.data?.tokenHint?.endsWith('LEAK'),
);

const channelsWithToken = await call('GET', '/api/admin/publishing/channels', { cookies });
check(
  '۲۰. فهرست کانال‌ها هم توکن کامل را برنمی‌گرداند',
  channelsWithToken.status === 200
    && !JSON.stringify(channelsWithToken.payload).includes(tokenValue)
    && channelsWithToken.payload.data?.channels?.some((row) => row.id === testChannel.id && row.hasToken === true),
);

/* پاک‌کردن توکن، تا ارسال بعدی قطعاً آزمایشی و بدون شبکه بماند */
const tokenCleared = await call('POST', `/api/admin/publishing/channels/${testChannel.id}/token`, {
  cookies,
  csrf,
  body: { token: '' },
});
check('۲۰. پاک‌کردن توکن ثبت‌شده', tokenCleared.payload.data?.hasToken === false);

const preview = await call('POST', '/api/admin/publishing/preview', {
  cookies,
  csrf,
  body: { text: 'خط اول پیام\n\nخط دوم پیام', source: { type: 'custom' } },
});
check(
  '۲۱. پیش‌نمایش یک پیام متنی می‌سازد',
  preview.status === 200 && preview.payload.data?.steps?.length === 1 && preview.payload.data.steps[0].method === 'sendMessage',
);

const emptyPreview = await call('POST', '/api/admin/publishing/preview', { cookies, csrf, body: { text: '   ' } });
check('۲۱. رد پیش‌نمایش خالی', emptyPreview.status === 400);

const drySend = await call('POST', '/api/admin/publishing/send', {
  cookies,
  csrf,
  body: { channelIds: [testChannel.id], content: { text: 'پیام آزمایشی تست' } },
});
check(
  '۲۲. بدون توکن، ارسال به حالت آزمایشی می‌رود (بدون درخواست شبکه)',
  drySend.status === 200 && drySend.payload.data?.dryRun === 1 && drySend.payload.data?.sent === 0,
);

const forcedDry = await call('POST', '/api/admin/publishing/send', {
  cookies,
  csrf,
  body: { channelIds: [testChannel.id], content: { text: 'پیام آزمایشی اجباری' }, dryRun: true },
});
check('۲۲. ارسال آزمایشی اجباری هم ثبت می‌شود', forcedDry.payload.data?.dryRun === 1);

const noTarget = await call('POST', '/api/admin/publishing/send', {
  cookies,
  csrf,
  body: { channelIds: [], content: { text: 'بی‌مخاطب' } },
});
check('۲۲. رد ارسال بدون کانال', noTarget.status === 400);

const publishLog = await call('GET', '/api/admin/publishing/log?perPage=5', { cookies });
check(
  '۲۳. تاریخچهٔ ارسال رکوردهای آزمایشی را نگه می‌دارد',
  publishLog.status === 200
    && publishLog.payload.data?.items?.some((row) => row.channelId === testChannel.id && row.status === 'dry-run'),
);

const editorChannels = await call('GET', '/api/admin/publishing/channels', { cookies: { tapesh_admin_session: editorToken } });
check('۲۴. نویسنده فهرست کانال‌ها را می‌بیند', editorChannels.status === 200);

const editorCreateChannel = await call('POST', '/api/admin/publishing/channels', {
  cookies: { tapesh_admin_session: editorToken },
  csrf: editorCsrf,
  body: { platform: 'bale', name: 'کانال نویسنده', chatId: '@nope' },
});
check('۲۴. رد ساخت کانال توسط نقش غیرمجاز', editorCreateChannel.status === 403);

const editorSetToken = await call('POST', `/api/admin/publishing/channels/${testChannel.id}/token`, {
  cookies: { tapesh_admin_session: editorToken },
  csrf: editorCsrf,
  body: { token: 'x' },
});
check('۲۴. رد ثبت توکن توسط نقش غیرمجاز', editorSetToken.status === 403);

/* ۲۵) منطق شکستن پیام — تابع خالص، بدون شبکه */
const planShort = planBaleMessages({ text: 'کوتاه', media: { filename: 'a.png', kind: 'image' } });
check('۲۵. مدیا + متن کوتاه = یک پیام با کپشن', planShort.length === 1 && planShort[0].caption === 'کوتاه');

const planLong = planBaleMessages({ text: 'x'.repeat(1200), media: { filename: 'a.png', kind: 'image' } });
check(
  '۲۵. مدیا + متن بلند = مدیا بی‌کپشن، بعد متن کامل (بدون تکرار)',
  planLong.length === 2 && planLong[0].caption === '' && planLong[1].text.length === 1200,
);

const planDocument = planBaleMessages({ text: '', media: { filename: 'a.pdf', kind: 'document' } });
check('۲۵. فایل غیرتصویری با sendDocument می‌رود', planDocument.length === 1 && planDocument[0].method === 'sendDocument');

/* ۲۶) تست اعتبار پیش از ذخیره — توکن + دسترسی ربات به کانال
 *
 * شبکه با یک `fetch` جعلی جایگزین می‌شود تا هم پاسخ بله شبیه‌سازی شود و هم اگر
 * جایی ناخواسته درخواست واقعی زده شد، تست بترکد نه اینکه به اینترنت وابسته شود.
 */
const secretToken = '123456789:SECRET-MUST-NOT-LEAK';
const fetchCalls = [];

globalThis.fetch = async (url) => {
  const method = String(url).split('/').pop();
  fetchCalls.push(method);

  if (method === 'getMe') {
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { id: 7, username: 'tapesh_bot', name: 'ربات تپش' } }) };
  }
  if (method === 'getChat') {
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { id: -100123, type: 'channel', title: 'کانال تپش', username: 'tapesh' } }) };
  }
  return { ok: false, status: 404, json: async () => ({ ok: false, description: 'not found' }) };
};

const direct = await testCredentials({ platform: 'bale', token: secretToken, chatId: '@tapesh' });
check(
  '۲۶. تست اعتبار، هم توکن و هم دسترسی کانال را تأیید می‌کند',
  direct.ok === true && direct.complete === true
    && direct.bot?.username === 'tapesh_bot' && direct.chat?.title === 'کانال تپش'
    && direct.checks.every((check_) => check_.ok === true),
);
check('۲۶. نتیجهٔ تست هیچ‌جای توکن را لو نمی‌دهد', !JSON.stringify(direct).includes(secretToken));
check('۲۶. هر دو متد getMe و getChat صدا زده شدند', fetchCalls.includes('getMe') && fetchCalls.includes('getChat'));

/* بدون شناسهٔ کانال: توکن تأیید می‌شود ولی دسترسی «بررسی‌نشده» می‌ماند */
const tokenOnly = await testCredentials({ platform: 'bale', token: secretToken, chatId: '' });
check(
  '۲۶. بدون شناسهٔ کانال، توکن تأیید و دسترسی «بررسی‌نشده» اعلام می‌شود',
  tokenOnly.ok === true && tokenOnly.complete === false && tokenOnly.checks.some((check_) => check_.ok === null),
);

/* توکن نامعتبر → خطای روشن، و هیچ توکنی در خروجی */
globalThis.fetch = async (url) => ({
  ok: false,
  status: 401,
  json: async () => ({ ok: false, description: 'Unauthorized', error_code: 401 }),
});
const badToken = await testCredentials({ platform: 'bale', token: secretToken, chatId: '@tapesh' });
check(
  '۲۶. توکن نامعتبر خطای فارسی و روشن می‌دهد',
  badToken.ok === false && badToken.checks[0].ok === false && !JSON.stringify(badToken).includes(secretToken),
);

/* ربات ادمین نیست → getChat خطا می‌دهد و کاربر باید بفهمد چرا */
globalThis.fetch = async (url) => (String(url).endsWith('/getMe')
  ? { ok: true, status: 200, json: async () => ({ ok: true, result: { id: 7, username: 'tapesh_bot', name: 'ربات تپش' } }) }
  : { ok: false, status: 400, json: async () => ({ ok: false, description: 'Bad Request: chat not found' }) });

const noAccess = await testCredentials({ platform: 'bale', token: secretToken, chatId: '@wrong' });
check(
  '۲۶. وقتی ربات به کانال دسترسی ندارد، دلیلش گفته می‌شود',
  noAccess.ok === false && noAccess.bot !== null
    && noAccess.checks.some((check_) => check_.id === 'chat' && check_.ok === false && /کانال/.test(check_.message)),
);

/* بدون توکن: هیچ درخواستی به بیرون نمی‌رود — fetch نباید حتی یک‌بار صدا زده شود */
let networkHits = 0;
globalThis.fetch = async () => { networkHits += 1; throw new Error('نباید درخواست شبکه‌ای زده شود'); };

const noToken = await testCredentials({ platform: 'bale', token: '', chatId: '@tapesh' });
check('۲۶. بدون توکن، تست اعتبار هیچ درخواست شبکه‌ای نمی‌زند', noToken.ok === false && networkHits === 0);

const routeTest = await call('POST', '/api/admin/publishing/test', {
  cookies,
  csrf,
  body: { platform: 'bale', token: '', chatId: '@tapesh' },
});
check('۲۶. مسیر تست اعتبار با توکن خالی، پاسخ روشن می‌دهد', routeTest.status === 200 && routeTest.payload.data?.ok === false);

const editorTestRoute = await call('POST', '/api/admin/publishing/test', {
  cookies: { tapesh_admin_session: editorToken },
  csrf: editorCsrf,
  body: { platform: 'bale', token: 'x', chatId: '@x' },
});
check('۲۶. رد تست اعتبار برای نقش غیرمجاز (چون توکن می‌گیرد)', editorTestRoute.status === 403);

/* پاک‌سازی داده‌های تست */
await call('POST', '/api/admin/analytics/reset', { cookies, csrf });
await call('DELETE', `/api/admin/notes/${savedNote.id}`, { cookies, csrf });
await call('DELETE', `/api/admin/articles/${article.id}`, { cookies, csrf });
await call('DELETE', `/api/admin/users/${editor.payload.data.admin.id}`, { cookies, csrf });
await call('DELETE', `/api/admin/publishing/channels/${testChannel.id}`, { cookies, csrf });

/*
 * رکوردهای تاریخچهٔ همین کانال تست پاک می‌شوند — و **فقط** همین‌ها.
 * پاک‌کردن کل `publishLog` تاریخچهٔ واقعی کاربر را از بین می‌برد.
 */
writeCollection('publishLog', readCollection('publishLog').filter((row) => row.channelId !== testChannel.id));

console.log('\nنتیجهٔ تست پنل مدیریت:');
results.forEach((result) => console.log(`  ${result.pass ? '✓' : '✗'} ${result.name}`));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} سنجه موفق\n`);
