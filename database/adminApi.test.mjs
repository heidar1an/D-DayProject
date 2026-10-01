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
 *  ۲۷) آداپتور ایتا: sendFile/file، نبود getChat، سنجهٔ null، شناسهٔ عددی، و توصیف پلتفرم
 *  ۲۸) ۴۰۳ «ربات ادمین نیست» است نه «توکن باطل» (ترجمهٔ درست خطای دسترسی)
 *  ۲۹) تلگرام: «کانال دیده می‌شود» با «ربات اجازهٔ ارسال دارد» یکی نیست
 *  ۳۰) میکرو درسنامه: فهرست/جزئیات، انتخاب از بانک تست، ساخت، انتشار و تحویل عمومی
 *  ۳۱) Guardian: فقط‌خواندنی، بدون نشت IP/UA/شناسه در پاسخ
 *  ۳۲) Guardian: دسترسی امنیتی برای نقش غیرمجاز رد می‌شود
 */

import assert from 'node:assert/strict';

import { handleApi } from './adminApi.js';
import { readCollection, writeCollection } from './contentStore.js';
import { planBaleMessages } from './publishers/bale.js';
import { eitaaPlanMessages, sendToEitaa } from './publishers/eitaa.js';
import { platformMetrics } from './publishers/index.js';
import { sendToTelegram } from './publishers/telegram.js';
import { publishingConfig, testCredentials } from './publishingStore.js';

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

/* Guardian فقط‌خواندنی — permission مرزی و DTO بدون دادهٔ هویتی */
const guardianStatus = await call('GET', '/api/admin/guardian/status', { cookies });
const guardianJson = JSON.stringify(guardianStatus.payload.data ?? {});
check('۳۱. Guardian برای مدیر کل گزارش فقط‌خواندنی می‌دهد', guardianStatus.status === 200
  && guardianStatus.payload.data?.schemaVersion === 1
  && guardianStatus.payload.data?.scope?.automatedBlocking === false);
check('۳۱. Guardian پاسخ را به IP/UA/شناسهٔ ورود آلوده نمی‌کند',
  !guardianJson.includes('"ip":')
  && !guardianJson.includes('"userAgent":')
  && !guardianJson.includes('"username":')
  && !guardianJson.includes('"token":')
  && !guardianJson.includes('"csrfToken":')
  && !guardianJson.includes('"password":')
  && !guardianJson.includes('09123456789'));

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
const editorGuardian = await call('GET', '/api/admin/guardian/status', { cookies: { tapesh_admin_session: editorToken } });
check('۳۲. دسترسی Guardian برای نویسنده بسته است', editorGuardian.status === 403);

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

/*
 * پاک‌سازی باقی‌ماندهٔ اجراهای قبلی.
 *
 * اگر اجرای قبلی وسط کار بترکد (یک `assert` بیفتد)، بلوک پاک‌سازی انتهای فایل
 * اجرا نمی‌شود و کانال تست در پنل واقعی جا می‌ماند. پس پیش از ساخت، هر کانال
 * هم‌نام قبلی حذف می‌شود تا اجراها روی هم انبار نشوند.
 */
const STALE_TEST_CHANNEL = 'کانال تست بله';
const beforeCreate = await call('GET', '/api/admin/publishing/channels', { cookies });
for (const row of beforeCreate.payload.data?.channels ?? []) {
  if (row.name === STALE_TEST_CHANNEL) {
    await call('DELETE', `/api/admin/publishing/channels/${row.id}`, { cookies, csrf });
  }
}

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

/* ۲۷) آداپتور ایتا — قرارداد خودش، نه قرارداد تلگرام
 *
 * ایتایار چهار تفاوت واقعی با تلگرام دارد و این تست‌ها همان‌ها را قفل می‌کنند:
 *   ۱) ارسال فایل با `sendFile` و پارامتر `file` می‌رود (نه sendPhoto/sendDocument)
 *   ۲) هیچ متد خواندنی برای مقصد وجود ندارد ⇒ `getChat` نباید هرگز صدا زده شود
 *   ۳) سنجهٔ دنبال‌کننده وجود ندارد ⇒ `null` بدون هیچ درخواست شبکه‌ای
 *   ۴) شناسهٔ کانال باید **عددی** باشد؛ یوزرنیم پیدا می‌شود ولی ارسال با آن ۴۰۳ می‌دهد
 */
const eitaaCalls = [];

globalThis.fetch = async (url, init) => {
  eitaaCalls.push({ url: String(url), body: init?.body });
  return {
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      result: { id: 523958, first_name: 'امیرحسین', last_name: 'حیدریان', username: 'heidar1an', message_id: 42 },
    }),
  };
};

/* ارسال باید بترکد؛ متن خطا چیزی است که کاربر می‌بیند */
async function sendEitaaError(payload) {
  try {
    await sendToEitaa(payload);
    return '';
  } catch (error) {
    return `${error.message} ${error.code}`;
  }
}

/* شناسهٔ عددی → توکن تأیید می‌شود، مقصد «بررسی‌نشده» می‌ماند */
const eitaaNumeric = await testCredentials({ platform: 'eitaa', token: secretToken, chatId: '11252784' });
check(
  '۲۷. تست ایتا با شناسهٔ عددی: توکن تأیید و مقصد «بررسی‌نشده» می‌ماند',
  eitaaNumeric.ok === true && eitaaNumeric.complete === true
    && eitaaNumeric.bot?.username === 'heidar1an'
    && eitaaNumeric.checks.some((check_) => check_.id === 'target' && check_.ok === null),
);

/*
 * یوزرنیم → رد قطعی پیش از ذخیره.
 *
 * این باگ واقعی کاربر بود: `chat_id=mytapesh` را گذاشته بود و ارسال با
 * «Forbidden: user not access of channel chat» می‌افتاد، چون ایتایار یوزرنیم را
 * پیدا می‌کند ولی مجوز ارسال فقط به شناسهٔ عددی گره خورده است. حالا همان‌جا و
 * پیش از ذخیره گفته می‌شود.
 */
const eitaaUsername = await testCredentials({ platform: 'eitaa', token: secretToken, chatId: 'mytapesh' });
check(
  '۲۷. تست ایتا با یوزرنیم پیش از ذخیره رد می‌شود و به شناسهٔ عددی راهنمایی می‌کند',
  eitaaUsername.ok === true && eitaaUsername.complete === false
    && eitaaUsername.checks.some((check_) => check_.id === 'target' && check_.ok === false && /عددی/.test(check_.message)),
);

check(
  '۲۷. ایتا هرگز getChat یا getChatMemberCount صدا نمی‌زند (در API وجود ندارند)',
  eitaaCalls.length === 2 && eitaaCalls.every((row) => /\/getMe$/.test(row.url)),
);
check(
  '۲۷. نتیجهٔ تست ایتا توکن را لو نمی‌دهد',
  !JSON.stringify(eitaaNumeric).includes(secretToken) && !JSON.stringify(eitaaUsername).includes(secretToken),
);

/* متن آزاد → یک پیام sendMessage با بدنهٔ JSON */
eitaaCalls.length = 0;
const eitaaText = await sendToEitaa({ token: secretToken, target: 'mytapesh', text: 'سلام تپش', media: null, options: {} });
check(
  '۲۷. ارسال متن ایتا با sendMessage و chat_id می‌رود',
  /\/sendMessage$/.test(eitaaCalls[0].url)
    && JSON.parse(eitaaCalls[0].body).chat_id === 'mytapesh'
    && JSON.parse(eitaaCalls[0].body).text === 'سلام تپش'
    && eitaaText.messages[0].messageId === 42,
);

/* فایل + متن کوتاه → یک sendFile با caption و پارامتر `file` */
eitaaCalls.length = 0;
const eitaaMedia = await sendToEitaa({
  token: secretToken,
  target: 'mytapesh',
  text: 'کوتاه',
  media: { buffer: Buffer.from('png-bytes'), filename: 'a.png', mimeType: 'image/png', kind: 'image' },
  options: { title: 'عنوان تست' },
});
check(
  '۲۷. فایل ایتا با sendFile و پارامتر file و caption می‌رود',
  /\/sendFile$/.test(eitaaCalls[0].url)
    && eitaaCalls[0].body instanceof FormData
    && eitaaCalls[0].body.get('file') !== null
    && eitaaCalls[0].body.get('caption') === 'کوتاه'
    && eitaaCalls[0].body.get('chat_id') === 'mytapesh'
    && eitaaCalls[0].body.get('title') === 'عنوان تست'
    && eitaaMedia.messages.length === 1,
);

/* متن بلند + فایل → فایل بی‌کپشن، بعد متن کامل (بدون تکرار) */
const eitaaPlanLong = eitaaPlanMessages({ text: 'x'.repeat(1200), media: { filename: 'a.png', kind: 'image' } });
check(
  '۲۷. متن بلند ایتا: فایل بی‌کپشن بعد متن کامل',
  eitaaPlanLong.length === 2 && eitaaPlanLong[0].method === 'sendFile'
    && eitaaPlanLong[0].caption === '' && eitaaPlanLong[1].method === 'sendMessage',
);

/* سنجه: ایتایار عدد نمی‌دهد، پس null برمی‌گردد و هیچ درخواستی نمی‌رود */
eitaaCalls.length = 0;
const eitaaMetric = await platformMetrics({ platform: 'eitaa', token: secretToken, target: 'mytapesh' });
check('۲۷. سنجهٔ ایتا null است و هیچ درخواست شبکه‌ای نمی‌زند', eitaaMetric === null && eitaaCalls.length === 0);

/* توکن نامعتبر ایتا → پیام فارسی روشن، بدون توکن در خروجی */
globalThis.fetch = async () => ({
  ok: false,
  status: 401,
  json: async () => ({ ok: false, error_code: 401, description: 'Unauthorized' }),
});
const eitaaBadToken = await testCredentials({ platform: 'eitaa', token: secretToken, chatId: 'mytapesh' });
check(
  '۲۷. توکن نامعتبر ایتا پیام فارسی روشن می‌دهد',
  eitaaBadToken.ok === false && /ایتایار/.test(eitaaBadToken.checks[0].message)
    && !JSON.stringify(eitaaBadToken).includes(secretToken),
);

/*
 * ۴۰۳ «user not access of channel chat» — خطای واقعیِ کاربر با یوزرنیم.
 * پیام باید کاربر را به شناسهٔ عددی ببرد، نه به «توکن را عوض کن».
 */
globalThis.fetch = async () => ({
  ok: false,
  status: 403,
  json: async () => ({ ok: false, error_code: 403, description: 'Forbidden: user not access of channel chat' }),
});
const eitaaNoAccess = await sendEitaaError({
  token: secretToken, target: 'mytapesh', text: 'سلام', media: null, options: {},
});
check(
  '۲۷. خطای «user not access» ایتا کاربر را به شناسهٔ عددی راهنمایی می‌کند',
  /عددی/.test(eitaaNoAccess) && /PUBLISH_FORBIDDEN/.test(eitaaNoAccess) && !/توکن نامعتبر/.test(eitaaNoAccess),
);

/* پنل باید ایتا و تلگرام را با فیلدهای درستشان بشناسد */const eitaaConfig = publishingConfig().platforms.find((row) => row.id === 'eitaa');
const telegramConfig = publishingConfig().platforms.find((row) => row.id === 'telegram');
check(
  '۲۷. پنل ایتا را با برچسب و راهنمای خودش می‌شناسد و سنجه ندارد',
  eitaaConfig?.tokenLabel === 'توکن ایتایار' && eitaaConfig.metrics.length === 0
    && eitaaConfig.capabilities.metrics === false && Boolean(eitaaConfig.setupUrl),
);
check(
  '۲۷. پنل تلگرام را با BotFather می‌شناسد و سنجهٔ دنبال‌کننده دارد',
  telegramConfig?.tokenEnv === 'TELEGRAM_BOT_TOKEN' && telegramConfig.metrics.includes('followers')
    && telegramConfig.setupUrl === 'https://t.me/BotFather',
);

/*
 * گارد ضدّ لو رفتن توکن در متن راهنما.
 *
 * وسوسه‌اش زیاد است که در «شکل توکن» یک نمونهٔ واقعی نوشته شود؛ ولی اگر آن نمونه
 * از توکن خودِ کاربر کپی شده باشد، دو بخش اول توکنش در پاسخ API پنل و در مرورگر
 * می‌افتد. پس هیچ متن راهنمای پلتفرمی نباید الگوی توکن واقعی داشته باشد.
 */
const platformHelpText = JSON.stringify(publishingConfig().platforms);
check(
  '۲۷. راهنمای پلتفرم‌ها فقط جای‌نگهدار دارد، نه نمونهٔ واقعی توکن',
  !/bot\d{3,}:[0-9a-f]{8,}/i.test(platformHelpText) && !/\d{8,}:[A-Za-z0-9_-]{25,}/.test(platformHelpText),
);

/* ۲۸) ۴۰۳ یعنی «ربات ادمین نیست»، نه «توکن باطل»
 *
 * تلگرام و بله برای کمبود دسترسی هم ۴۰۳ می‌دهند. ترجمهٔ قبلی هر ۴۰۳ را «توکن
 * نامعتبر» می‌خواند و همین باعث شد خطای واقعی («ربات عضو کانال نیست») در پنل
 * به‌شکل «توکن را عوض کن» دیده شود — یعنی کاربر دنبال جای اشتباهی می‌رفت.
 */
globalThis.fetch = async (url) => (String(url).endsWith('/getMe')
  ? { ok: true, status: 200, json: async () => ({ ok: true, result: { id: 7, username: 'mytapeshBot', name: 'tapeshbot' } }) }
  : { ok: false, status: 403, json: async () => ({ ok: false, error_code: 403, description: 'Forbidden: bot is not a member of the channel chat' }) });

/* ارسال باید بترکد؛ متن خطا چیزی است که کاربر می‌بیند */
async function sendErrorText(payload) {
  try {
    await sendToTelegram(payload);
    return '';
  } catch (error) {
    return `${error.message} ${error.code}`;
  }
}

const notMember = await sendErrorText({
  token: secretToken, target: '@mytapesh', text: 'سلام', media: null, options: {},
});
check(
  '۲۸. خطای ۴۰۳ تلگرام «ربات ادمین نیست» ترجمه می‌شود، نه «توکن باطل»',
  /ادمین/.test(notMember) && !/توکن/.test(notMember) && /PUBLISH_FORBIDDEN/.test(notMember),
);

/* همان پیام با کد ۴۰۱ باید واقعاً «توکن نامعتبر» بماند */
globalThis.fetch = async () => ({
  ok: false, status: 401, json: async () => ({ ok: false, error_code: 401, description: 'Unauthorized' }),
});
const trulyBadToken = await sendErrorText({
  token: secretToken, target: '@mytapesh', text: 'سلام', media: null, options: {},
});
check(
  '۲۸. خطای ۴۰۱ همچنان «توکن نامعتبر» می‌ماند',
  /توکن/.test(trulyBadToken) && /PUBLISH_UNAUTHORIZED/.test(trulyBadToken),
);

/*
 * ۲۹) تلگرام: «کانال دیده می‌شود» ≠ «ربات اجازهٔ ارسال دارد»
 *
 * کانال عمومی را هر رباتی با `getChat` می‌بیند، حتی اگر اصلاً عضو نباشد. پنل قبلاً
 * از همین تیک سبز می‌ساخت و می‌گفت «آمادهٔ ارسال است»، ولی ارسال با
 * `Forbidden: bot is not a member of the channel chat` می‌افتاد. حالا «اجازهٔ ارسال»
 * جدا با `getChatAdministrators` بررسی می‌شود.
 */
function telegramFetch({ adminsOk }) {
  return async (url) => {
    const method = String(url).split('/').pop();
    if (method === 'getMe') {
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { id: 8697284788, username: 'mytapeshBot', first_name: 'tapeshbot' } }) };
    }
    if (method === 'getChat') {
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { id: -1001392410731, type: 'channel', title: 'myTapesh', username: 'myTapesh' } }) };
    }
    if (method === 'getChatAdministrators') {
      return adminsOk
        ? { ok: true, status: 200, json: async () => ({ ok: true, result: [{ user: { id: 8697284788, is_bot: true }, status: 'administrator' }] }) }
        : { ok: false, status: 400, json: async () => ({ ok: false, error_code: 400, description: 'Bad Request: member list is inaccessible' }) };
    }
    return { ok: false, status: 404, json: async () => ({ ok: false, description: 'not found' }) };
  };
}

globalThis.fetch = telegramFetch({ adminsOk: true });
const tgAdmin = await testCredentials({ platform: 'telegram', token: secretToken, chatId: '@mytapesh' });
check(
  '۲۹. تلگرام با ربات ادمین: هر سه بررسی سبز است',
  tgAdmin.complete === true && tgAdmin.checks.length === 3
    && tgAdmin.checks.every((check_) => check_.ok === true),
);

globalThis.fetch = telegramFetch({ adminsOk: false });
const tgNotAdmin = await testCredentials({ platform: 'telegram', token: secretToken, chatId: '@mytapesh' });
check(
  '۲۹. تلگرام با ربات غیرادمین: «کانال دیده می‌شود» ولی «اجازهٔ ارسال» رد می‌شود',
  tgNotAdmin.complete === false && tgNotAdmin.ok === false
    && tgNotAdmin.checks.some((check_) => check_.id === 'target' && check_.ok === true)
    && tgNotAdmin.checks.some((check_) => check_.id === 'admin' && check_.ok === false && /ادمین/.test(check_.message)),
);

/* ────────────────── ۳۰) میکرو درسنامه: ساخت، انتشار، تحویل ────────────────── */

const microList = await call('GET', '/api/admin/micro', { cookies });
check(
  '۳۰. فهرست درسنامه‌ها + شمارندهٔ ساختار (مبحث/صفحه/ایستگاه)',
  microList.status === 200 && microList.payload.data.items.length > 0
    && typeof microList.payload.data.items[0].counts.pages === 'number',
);

const seedMicro = microList.payload.data.items[0];
const microDetail = await call('GET', `/api/admin/micro/${seedMicro.id}`, { cookies });
check(
  '۳۰. خواندن درسنامهٔ کامل: مبحث → واحد → صفحه',
  microDetail.status === 200 && microDetail.payload.data.course.topics[0].units[0].pages.length > 0,
);

/* مسیر بانک تست باید پیش از `/:id` گرفته شود، وگرنه «test-bank» شناسهٔ درسنامه می‌شود */
const bankSearch = await call('GET', '/api/admin/micro/test-bank?subjectId=physiology&difficulty=easy&limit=5', { cookies });
check(
  '۳۰. انتخاب از بانک تست: فیلتر درس و سطح درست اعمال می‌شود',
  bankSearch.status === 200 && bankSearch.payload.data.items.length > 0
    && bankSearch.payload.data.items.every((row) => row.subject === 'physiology' && row.difficulty === 'easy'),
);

/* فهرست درس‌های رجیستری — باید پیش از `/:id` گرفته شود، درست مثل test-bank */
const microSubjects = await call('GET', '/api/admin/micro/subjects', { cookies });
const subjectList = microSubjects.payload.data?.subjects ?? [];
check(
  '۳۰. فهرست درس‌های رجیستری برای فرم «درسنامهٔ تازه»',
  microSubjects.status === 200 && subjectList.length === 16
    && subjectList.every((row) => row.id && row.title && row.accent),
);

/* درس‌هایی که بعداً به رجیستری اضافه شوند باید خودبه‌خود به پنل راه پیدا کنند */
check(
  '۳۰. همهٔ درس‌های رجیستری در پنل رکورد دارند (همگام‌سازی افزایشی seed)',
  microList.payload.data.items.length >= 16,
);

const seedPage = microDetail.payload.data.course.topics[0].units[0].pages[0];
check(
  '۳۰. صفحهٔ درسنامه متن غنی دارد (مشتق‌شده از بلوک‌های قدیمی)',
  typeof seedPage.content === 'string' && seedPage.content.length > 0,
);

const microCreated = await call('POST', '/api/admin/micro', {
  cookies,
  csrf,
  body: {
    title: 'درسنامهٔ تست میکرو',
    subjectId: 'physiology',
    topics: [{
      id: 't1',
      title: 'مبحث تست',
      published: true,
      units: [{
        id: 'u1',
        title: 'واحد تست',
        testBank: { subjectId: 'physiology', topicPaths: ['قلب و عروق › ECG'] },
        pages: [{ id: 'p1', title: 'صفحهٔ تست', blocks: [{ type: 'text', text: 'متن', depth: 'extended' }] }],
        checkpoints: [{
          id: 'cp1', afterPage: 'p1', questionCount: 2, scopePages: ['p1'], pinnedQuestionIds: ['tb-phy-01'],
        }],
      }],
    }],
  },
});
const microId = microCreated.payload.data?.course?.id;
check('۳۰. ساخت درسنامه از پنل', microCreated.status === 200 && Boolean(microId));

/* صفحهٔ تازه بلوک متنی دارد و content ندارد → سرور متن غنی را از همان بلوک می‌سازد */
const createdPageContent = microCreated.payload.data?.course?.topics?.[0]?.units?.[0]?.pages?.[0]?.content ?? '';
check('۳۰. متن غنی صفحهٔ تازه از بلوک‌ها مشتق می‌شود', createdPageContent.includes('متن'));

/* همان درسنامه با متن آلوده بازنویسی می‌شود: پاک‌ساز سرور باید script را حذف کند */
const microSanitize = await call('PUT', `/api/admin/micro/${microId}`, {
  cookies,
  csrf,
  body: {
    ...microCreated.payload.data.course,
    topics: microCreated.payload.data.course.topics.map((topic, topicIndex) => (topicIndex !== 0 ? topic : {
      ...topic,
      units: topic.units.map((unit, unitIndex) => (unitIndex !== 0 ? unit : {
        ...unit,
        pages: unit.pages.map((page, pageIndex) => (pageIndex !== 0 ? page : {
          ...page,
          content: '<p>سالم</p><script>alert(1)</script>',
        })),
      })),
    })),
  },
});
const sanitizedContent = microSanitize.payload.data?.course?.topics?.[0]?.units?.[0]?.pages?.[0]?.content ?? '';
check(
  '۳۰. متن غنی در سرور پاک‌سازی می‌شود (script هرگز ذخیره نمی‌شود)',
  microSanitize.status === 200 && sanitizedContent.includes('سالم') && !sanitizedContent.includes('script'),
);

/* ساخت از درس رجیستری — همان الگویی که برای همهٔ درس‌ها خواسته شده بود */
const microFromRegistry = await call('POST', '/api/admin/micro', {
  cookies,
  csrf,
  body: { subjectId: 'genetics', title: 'ژنتیک (کپی از رجیستری)' },
});
const registryId = microFromRegistry.payload.data?.course?.id;
check(
  '۳۰. ساخت درسنامه از درس رجیستری، مبحث‌های همان درس را می‌آورد',
  microFromRegistry.status === 200
    && (microFromRegistry.payload.data?.course?.topics?.length ?? 0) > 0,
);

const microPublished = await call('POST', `/api/admin/micro/${microId}/status`, {
  cookies, csrf, body: { status: 'published' },
});
check(
  '۳۰. انتشار درسنامه',
  microPublished.payload.data?.course?.status === 'published' && Boolean(microPublished.payload.data.course.publishedAt),
);

const publicMicro = await call('GET', '/api/public/micro/library');
const publicCourse = publicMicro.payload.data?.courses?.find((course) => course.id === microId);
check(
  '۳۰. تحویل عمومی درسنامهٔ منتشرشده، بدون فرادادهٔ مدیریتی',
  Boolean(publicCourse) && publicCourse.topics.length === 1
    && !('status' in publicCourse) && !('createdBy' in publicCourse),
);

await call('POST', `/api/admin/micro/${microId}/status`, { cookies, csrf, body: { status: 'draft' } });
const publicMicro2 = await call('GET', '/api/public/micro/library');
check(
  '۳۰. لغو انتشار → درسنامه از مسیر عمومی برداشته می‌شود',
  !(publicMicro2.payload.data?.courses ?? []).some((course) => course.id === microId),
);

const microBadStatus = await call('POST', `/api/admin/micro/${microId}/status`, {
  cookies, csrf, body: { status: 'weird' },
});
check('۳۰. وضعیت نامعتبر رد می‌شود', microBadStatus.status >= 400);

/* پاک‌سازی داده‌های تست */
await call('POST', '/api/admin/analytics/reset', { cookies, csrf });
await call('DELETE', `/api/admin/notes/${savedNote.id}`, { cookies, csrf });
await call('DELETE', `/api/admin/articles/${article.id}`, { cookies, csrf });
await call('DELETE', `/api/admin/users/${editor.payload.data.admin.id}`, { cookies, csrf });
await call('DELETE', `/api/admin/publishing/channels/${testChannel.id}`, { cookies, csrf });
await call('DELETE', `/api/admin/micro/${microId}`, { cookies, csrf });
await call('DELETE', `/api/admin/micro/${registryId}`, { cookies, csrf });

/*
 * رکوردهای تاریخچهٔ همین کانال تست پاک می‌شوند — و **فقط** همین‌ها.
 * پاک‌کردن کل `publishLog` تاریخچهٔ واقعی کاربر را از بین می‌برد.
 */
writeCollection('publishLog', readCollection('publishLog').filter((row) => row.channelId !== testChannel.id));

console.log('\nنتیجهٔ تست پنل مدیریت:');
results.forEach((result) => console.log(`  ${result.pass ? '✓' : '✗'} ${result.name}`));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} سنجه موفق\n`);
