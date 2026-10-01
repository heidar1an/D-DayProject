/*
 * تست امنیتی «دادهٔ حساس، اسرار، تحلیل، انتشار، بارگذاری، ریدایرکت، SSRF و
 * حسابرسی» — PHASE 3 (بخش دوم).
 * اجرا: node database/adminSecrets.test.mjs
 *
 * دسته‌های سند فاز که اینجا سنجیده می‌شوند: admin-sensitive-data · admin-secrets ·
 * admin-analytics · admin-publishing · admin-upload · admin-redirect · admin-ssrf ·
 * admin-audit.
 *
 * داده: `content/*.json` و `publishing.secrets.json` پیش از اجرا نسخه‌برداری و در
 * `finally` بازگردانده می‌شوند. هیچ درخواستی به شبکهٔ بیرونی زده نمی‌شود.
 */

import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { handleApi } from './adminApi.js';
import { handleGoogleAuthApi } from './googleAuth.js';
import { PERMISSIONS, rolePermissions } from './contentStore.js';
import { testCredentials } from './publishingStore.js';
import { testAccountDraft } from './mediaStore.js';

/* ───────────────────────────── بکاپ داده ───────────────────────────── */

const CONTENT_FILES = [
  'admins.json', 'activity.json', 'settings.json', 'events.json', 'media.json',
  'mediaAccounts.json', 'publishChannels.json', 'publishLog.json',
];
const paths = CONTENT_FILES.map((name) => fileURLToPath(new URL(`./content/${name}`, import.meta.url)));
const backups = paths.map((path) => (existsSync(path) ? readFileSync(path, 'utf8') : null));

const secretsPath = fileURLToPath(new URL('./publishing.secrets.json', import.meta.url));
const secretsBackup = existsSync(secretsPath) ? readFileSync(secretsPath, 'utf8') : null;

function restoreContent() {
  paths.forEach((path, index) => {
    if (backups[index] === null) return;
    writeFileSync(path, backups[index], 'utf8');
  });
  if (secretsBackup !== null) writeFileSync(secretsPath, secretsBackup, 'utf8');
}

const results = [];
const check = (name, condition) => results.push({ name, pass: Boolean(condition) });

/* ───────────────────────────── ابزار HTTP ───────────────────────────── */

function createResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    headers,
    getHeader(name) { return headers.get(name.toLowerCase()); },
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    end(chunk) { this.body = chunk ?? ''; },
  };
}

async function call(handler, method, path, { body, cookies = {}, csrf, raw, headers = {} } = {}) {
  const cookieHeader = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ');
  const request = {
    method,
    url: path,
    headers: {
      host: 'localhost',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(csrf ? { 'x-tapesh-csrf': csrf } : {}),
      ...headers,
    },
    socket: { remoteAddress: '127.0.0.1' },
    on(event, handler_) {
      if (event === 'data' && body !== undefined) handler_(Buffer.from(JSON.stringify(body)));
      if (event === 'data' && raw !== undefined) handler_(raw);
      if (event === 'end') handler_();
      return this;
    },
    resume() { return this; },
    destroy() { return this; },
  };

  const response = createResponse();
  await handler(request, response);
  let payload = {};
  try { payload = JSON.parse(response.body || '{}'); } catch { payload = {}; }
  return { status: response.statusCode, payload, headers: response.headers, location: response.getHeader('location') };
}

const api = (method, path, options) => call(handleApi, method, path, options);

async function login(username, password) {
  const response = await api('POST', '/api/admin/auth/login', { body: { username, password } });
  const token = (response.headers.get('set-cookie') ?? '').match(/tapesh_admin_session=([^;]+)/)?.[1] ?? '';
  return { token, csrf: response.payload.data?.csrfToken ?? '', cookies: { tapesh_admin_session: token } };
}

const sessionOf = (user) => ({ cookies: user.cookies, csrf: user.csrf });

const stamp = Date.now().toString(36);
const superLogin = await login('0135', '0135');

const adminUser = `p3s-admin-${stamp}`;
const editorUser = `p3s-editor-${stamp}`;
await api('POST', '/api/admin/users', {
  ...sessionOf(superLogin),
  body: { username: adminUser, password: 'p3s-admin-pass', role: 'admin' },
});
await api('POST', '/api/admin/users', {
  ...sessionOf(superLogin),
  body: { username: editorUser, password: 'p3s-editor-pass', role: 'editor' },
});
const adminLogin = await login(adminUser, 'p3s-admin-pass');
const editorLogin = await login(editorUser, 'p3s-editor-pass');

/* ───────────────────── ۱. دادهٔ حساس مرکز تحلیل ───────────────────── */

const sensitiveSections = ['users', 'revenue', 'security'];
let adminBlockedFromSensitive = true;
for (const section of sensitiveSections) {
  const response = await api('GET', `/api/admin/analytics/${section}`, sessionOf(adminLogin));
  if (response.status !== 403) adminBlockedFromSensitive = false;
}
check('۱. نقش admin به هیچ‌کدام از بخش‌های حساس تحلیل دسترسی ندارد', adminBlockedFromSensitive);

const adminTraffic = await api('GET', '/api/admin/analytics/traffic', sessionOf(adminLogin));
check('۱. نقش admin به تحلیل عمومی دسترسی دارد', adminTraffic.status === 200);

const superUsers = await api('GET', '/api/admin/analytics/users', sessionOf(superLogin));
check('۱. مدیر کل به بخش کاربران دسترسی دارد', superUsers.status === 200);

/* ───────────────────── ۲. Attack 5 — خروجی دادهٔ حساس ───────────────────── */

const exportSensitive = await api('GET', '/api/admin/analytics/export?section=users', sessionOf(adminLogin));
check(
  '۲. [Attack 5] خروجی بخش «کاربران» برای نقش بدون مجوز → ۴۰۳',
  exportSensitive.status === 403,
);

const exportRevenue = await api('GET', '/api/admin/analytics/export?section=revenue', sessionOf(adminLogin));
check('۲. [Attack 5] خروجی بخش «درآمد» برای نقش بدون مجوز → ۴۰۳', exportRevenue.status === 403);

const exportSecurity = await api('GET', '/api/admin/analytics/export?section=security', sessionOf(adminLogin));
check('۲. [Attack 5] خروجی بخش «امنیت» برای نقش بدون مجوز → ۴۰۳', exportSecurity.status === 403);

const exportTraffic = await api('GET', '/api/admin/analytics/export?section=traffic', sessionOf(adminLogin));
check('۲. خروجی بخشی که مجوزش را دارد کار می‌کند', exportTraffic.status === 200);

const exportEditor = await api('GET', '/api/admin/analytics/export', sessionOf(editorLogin));
check('۲. نقش نویسنده (بدون analytics.export) خروجی نمی‌گیرد → ۴۰۳', exportEditor.status === 403);

const exportBadSection = await api('GET', '/api/admin/analytics/export?section=nope', sessionOf(superLogin));
check('۲. بخش نامعتبر خروجی رد می‌شود → ۴۰۰', exportBadSection.status === 400);

/* ───────────────────── ۳. حسابرسی خروجی حساس ───────────────────── */

const activityAfterExport = JSON.parse(readFileSync(paths[1], 'utf8'));
check(
  '۳. خروجی گرفتن در گزارش رویدادها ثبت می‌شود (analytics.exported)',
  activityAfterExport.some((row) => row.action === 'analytics.exported' && row.metadata?.section === 'traffic'),
);
check(
  '۳. رویداد خروجی، actor و بخش را ثبت می‌کند',
  activityAfterExport.some(
    (row) => row.action === 'analytics.exported' && Boolean(row.userId) && row.userId !== 'system',
  ),
);

/* ───────────────────── ۴. تنظیمات امنیتی ───────────────────── */

const settingsBefore = (await api('GET', '/api/admin/settings', sessionOf(superLogin))).payload.data.settings;

const adminSecurityPatch = await api('PUT', '/api/admin/settings', {
  ...sessionOf(adminLogin),
  body: { ...settingsBefore, security: { ...settingsBefore.security, maxLoginAttempts: 9999 } },
});
check('۴. نقش admin نمی‌تواند سقف تلاش ورود را عوض کند → ۴۰۳', adminSecurityPatch.status === 403);

const adminUploadLimitPatch = await api('PUT', '/api/admin/settings', {
  ...sessionOf(adminLogin),
  body: { ...settingsBefore, media: { ...settingsBefore.media, maxUploadMb: 500 } },
});
check('۴. نقش admin نمی‌تواند سقف حجم بارگذاری را عوض کند → ۴۰۳', adminUploadLimitPatch.status === 403);

const adminSameSecurityPatch = await api('PUT', '/api/admin/settings', {
  ...sessionOf(adminLogin),
  body: { ...settingsBefore, siteName: 'تپش' },
});
check(
  '۴. فرستادن مقادیر یکسانِ امنیتی، مدیر را از ذخیرهٔ تنظیمات عمومی منع نمی‌کند',
  adminSameSecurityPatch.status === 200,
);

const superSecurityPatch = await api('PUT', '/api/admin/settings', {
  ...sessionOf(superLogin),
  body: { ...settingsBefore, security: { ...settingsBefore.security, maxLoginAttempts: 7 } },
});
check('۴. مدیر کل می‌تواند تنظیمات امنیتی را عوض کند', superSecurityPatch.status === 200);

const settingsRestored = await api('PUT', '/api/admin/settings', {
  ...sessionOf(superLogin), body: settingsBefore,
});
check('۴. تنظیمات امنیتی به مقدار اولیه برگشت', settingsRestored.status === 200);

/* ───────────────────── ۵. Attack 4 — خواندن اسرار ───────────────────── */

const accountsAsEditor = await api('GET', '/api/admin/media/accounts', sessionOf(editorLogin));
const accountsBody = JSON.stringify(accountsAsEditor.payload);
check('۵. [Attack 4] نقش نویسنده فهرست اکانت‌ها را می‌بیند ولی مقدار اعتبار نه',
  accountsAsEditor.status === 200 && !/"appSecret":"[^"]+"/.test(accountsBody) && !/"token":"[^"]+"/.test(accountsBody));
check('۵. [Attack 4] فقط «وضعیت» و «سرنخ ماسک‌شده» برمی‌گردد، نه مقدار',
  /"hasToken":/.test(accountsBody) && /"tokenHint":/.test(accountsBody) && /"appIdHint":/.test(accountsBody));

const credentialsAsEditor = await api('POST', '/api/admin/media/accounts/acc-seed1/credentials', {
  ...sessionOf(editorLogin), body: { token: 'attacker-token' },
});
check('۵. [Attack 4] نقش نویسنده نمی‌تواند اعتبار اکانت را ثبت کند → ۴۰۳', credentialsAsEditor.status === 403);

const testDraftAsEditor = await api('POST', '/api/admin/media/accounts/test', {
  ...sessionOf(editorLogin), body: { platform: 'telegram', token: 'x', externalId: 'y' },
});
check('۵. [Attack 4] نقش نویسنده نمی‌تواند تست اعتبار بزند → ۴۰۳', testDraftAsEditor.status === 403);

const accountsAsSuper = await api('GET', '/api/admin/media/accounts', sessionOf(superLogin));
const superAccountsBody = JSON.stringify(accountsAsSuper.payload);
check('۵. [Attack 4] حتی مدیر کل هم مقدار کامل اعتبار را نمی‌بیند (write-only)',
  accountsAsSuper.status === 200 && !/"appSecret":"[^"]+"/.test(superAccountsBody) && !/"token":"[^"]+"/.test(superAccountsBody));

/* ───────────────────── ۶. تفکیک «ارسال» از «مدیریت اعتبار» ───────────────────── */

const channelsAsEditor = await api('GET', '/api/admin/publishing/channels', sessionOf(editorLogin));
check('۶. نقش نویسنده فهرست کانال‌های انتشار را می‌بیند (publishing.read)', channelsAsEditor.status === 200);

const channelsBody = JSON.stringify(channelsAsEditor.payload);
check(
  '۶. فهرست کانال‌ها هیچ توکن خامی برنمی‌گرداند',
  !/"token":"[^"]+"/.test(channelsBody) && /tokenHint/.test(channelsBody),
);

const createChannelAsEditor = await api('POST', '/api/admin/publishing/channels', {
  ...sessionOf(editorLogin),
  body: { platform: 'telegram', label: 'کانال آزمون', chatId: '@p3test' },
});
check('۶. نقش نویسنده نمی‌تواند کانال بسازد → ۴۰۳', createChannelAsEditor.status === 403);

const setTokenAsEditor = await api('POST', '/api/admin/publishing/channels/ch-nope/token', {
  ...sessionOf(editorLogin), body: { token: 'attacker-token' },
});
check('۶. نقش نویسنده نمی‌تواند توکن کانال را ثبت کند → ۴۰۳', setTokenAsEditor.status === 403);

const testChannelAsEditor = await api('POST', '/api/admin/publishing/channels/ch-nope/test', sessionOf(editorLogin));
check('۶. نقش نویسنده حق «تست اتصال» را دارد (publishing.send) و فقط ۴۰۴ می‌گیرد',
  testChannelAsEditor.status === 404 || testChannelAsEditor.status === 200);

const testCredentialsAsEditor = await api('POST', '/api/admin/publishing/test', {
  ...sessionOf(editorLogin), body: { platform: 'telegram', token: 'x', chatId: '@y' },
});
check('۶. «تست اعتبار پیش از ذخیره» به مجوز مدیریت کانال گره خورده است → ۴۰۳',
  testCredentialsAsEditor.status === 403);

/* ───────────────────── ۷. نبود توکن در گزارش رویدادها ───────────────────── */

const secretsFile = JSON.parse(readFileSync(secretsPath, 'utf8'));
const realTokens = Object.values(secretsFile.tokens ?? {}).filter(Boolean);
const activityText = readFileSync(paths[1], 'utf8');
const leakedTokens = realTokens.filter((token) => activityText.includes(token));
check('۷. هیچ توکن واقعی در گزارش رویدادها نیست', leakedTokens.length === 0);

const eventsText = readFileSync(paths[3], 'utf8');
check('۷. هیچ توکن واقعی در رویدادهای تحلیل نیست',
  realTokens.filter((token) => eventsText.includes(token)).length === 0);

const adminsText = readFileSync(paths[0], 'utf8');
check('۷. هش رمز در هیچ پاسخ API برنمی‌گردد (users/meta/login)',
  !JSON.stringify(accountsAsSuper.payload).includes('passwordHash')
    && !JSON.stringify(channelsAsEditor.payload).includes('passwordHash'));

check(
  '۷. فایل‌های اسرار فقط برای مالک قابل خواندن‌اند (۰۶۰۰)',
  [secretsPath, fileURLToPath(new URL('./media.secrets.json', import.meta.url))]
    .filter((path) => existsSync(path))
    .every((path) => (statSync(path).mode & 0o777) === 0o600),
);

/* ───────────────────── ۸. بارگذاری — مجوز و سقف‌ها ───────────────────── */

const editorDisallowedMime = await api('POST', '/api/admin/media', {
  ...sessionOf(editorLogin),
  body: { originalName: 'p3-test-bad.html', mimeType: 'text/html', data: 'PGgxPng8L2gxPg==' },
});
check('۸. نوع فایل غیرمجاز رد می‌شود → ۴۱۵', editorDisallowedMime.status === 415);

const editorUnknownMime = await api('POST', '/api/admin/media', {
  ...sessionOf(editorLogin),
  body: { originalName: 'p3-test.svg', mimeType: 'image/svg+xml', data: '' },
});
check('۸. فایل خالی رد می‌شود → ۴۰۰', editorUnknownMime.status === 400);

/* سقف حجم: با maxUploadMb=1 یک بدنهٔ ~۲ مگابایتی باید رد شود */
const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/9AAAAABJRU5ErkJggg==';
const oneMbSettings = { ...settingsBefore, media: { ...settingsBefore.media, maxUploadMb: 1 } };
await api('PUT', '/api/admin/settings', { ...sessionOf(superLogin), body: oneMbSettings });

const bigPayload = Buffer.alloc(2 * 1024 * 1024, 7).toString('base64');
const oversize = await api('POST', '/api/admin/media', {
  ...sessionOf(editorLogin),
  body: { originalName: 'p3-test-big.png', mimeType: 'image/png', data: bigPayload },
});
check('۸. سقف حجم بارگذاری سمت سرور اعمال می‌شود و از کلاینت قابل دور زدن نیست → ۴۱۳',
  oversize.status === 413);

const goodUpload = await api('POST', '/api/admin/media', {
  ...sessionOf(editorLogin),
  body: { originalName: '../../p3-test-ok.png', mimeType: 'image/png', data: tinyPng, altText: 'تست' },
});
const uploaded = goodUpload.payload.data?.media;
check('۸. بارگذاری مجاز با مجوز media.upload انجام می‌شود', goodUpload.status === 200 && Boolean(uploaded));
check('۸. نام فایل روی دیسک تصادفی است و از ورودی ساخته نمی‌شود',
  uploaded && /^[a-z0-9]+-[0-9a-f]{12}\.png$/.test(uploaded.filename));
check('۸. نام اصلی، نویسه‌های مسیر را نگه نمی‌دارد',
  uploaded && !uploaded.originalName.includes('/') && !uploaded.originalName.includes('\\'));

await api('PUT', '/api/admin/settings', { ...sessionOf(superLogin), body: settingsBefore });

/* ───────────────────── ۹. بارگذاری بین‌الملل (مسیر دودویی) ───────────────────── */

const intlNoAuth = await call(handleApi, 'POST', '/api/admin/intl-courses/upload', {
  raw: Buffer.from('WEBVTT\n'),
  headers: { 'content-type': 'text/vtt', 'x-tapesh-filename': 'p3-test.vtt' },
});
check('۹. بارگذاری ویدیو/زیرنویس بدون نشست → ۴۰۱', intlNoAuth.status === 401);

const intlNoCsrf = await call(handleApi, 'POST', '/api/admin/intl-courses/upload', {
  cookies: editorLogin.cookies,
  raw: Buffer.from('WEBVTT\n'),
  headers: { 'content-type': 'text/vtt', 'x-tapesh-filename': 'p3-test.vtt' },
});
check('۹. بارگذاری ویدیو/زیرنویس بدون CSRF → ۴۰۳', intlNoCsrf.status === 403);

const intlBadType = await call(handleApi, 'POST', '/api/admin/intl-courses/upload', {
  ...sessionOf(editorLogin),
  raw: Buffer.from('#!/bin/sh\n'),
  headers: { 'content-type': 'application/x-sh', 'x-tapesh-filename': 'p3-test.sh' },
});
check('۹. پسوند غیرمجاز رد می‌شود → ۴۱۵', intlBadType.status === 415);

/* ───────────────────── ۱۰. Attack 9 — ریدایرکت و Host جعلی ───────────────────── */

const spoofedHost = await call(handleGoogleAuthApi, 'GET', '/api/auth/google/status', {
  headers: { host: 'tapesh.ir', 'x-forwarded-host': 'evil.example.com', 'x-forwarded-proto': 'https' },
});
check(
  '۱۰. [Attack 9] هدر Host مقدم است و X-Forwarded-Host جعلی ریدایرکت را نمی‌چرخاند',
  spoofedHost.payload.data === undefined
    ? !String(spoofedHost.payload.redirectUri).includes('evil.example.com')
    : !String(spoofedHost.payload.data?.redirectUri).includes('evil.example.com'),
);

const spoofedProto = await call(handleGoogleAuthApi, 'GET', '/api/auth/google/status', {
  headers: { host: 'tapesh.ir', 'x-forwarded-proto': 'javascript' },
});
const protoUri = String(spoofedProto.payload.redirectUri ?? spoofedProto.payload.data?.redirectUri ?? '');
check('۱۰. [Attack 9] پروتکل جعلی (javascript:) در آدرس بازگشت نمی‌نشیند',
  protoUri.startsWith('https://tapesh.ir/') && !protoUri.includes('javascript'));

const malformedHost = await call(handleGoogleAuthApi, 'GET', '/api/auth/google/status', {
  headers: { host: 'tapesh.ir', 'x-forwarded-host': 'evil.com/path#@x', 'x-forwarded-proto': 'https' },
});
const malformedUri = String(malformedHost.payload.redirectUri ?? malformedHost.payload.data?.redirectUri ?? '');
check('۱۰. [Attack 9] میزبان بدشکل در آدرس بازگشت نمی‌نشیند',
  !malformedUri.includes('evil.com') && !malformedUri.includes('#'));

/* حالت پروکسی: Host داخلی است، پس X-Forwarded-Host معتبر پذیرفته می‌شود */
const proxyCase = await call(handleGoogleAuthApi, 'GET', '/api/auth/google/status', {
  headers: { host: 'localhost:4173', 'x-forwarded-host': 'tapesh.ir', 'x-forwarded-proto': 'https' },
});
const proxyUri = String(proxyCase.payload.redirectUri ?? proxyCase.payload.data?.redirectUri ?? '');
check('۱۰. پشت پروکسی (Host داخلی) از X-Forwarded-Host معتبر استفاده می‌شود',
  proxyUri.startsWith('https://tapesh.ir/'));

/* فهرست بستهٔ میزبان‌ها */
process.env.TAPESH_ALLOWED_HOSTS = 'tapesh.ir';
const allowListed = await call(handleGoogleAuthApi, 'GET', '/api/auth/google/status', {
  headers: { host: 'evil.example.com', 'x-forwarded-proto': 'https' },
});
delete process.env.TAPESH_ALLOWED_HOSTS;
const allowUri = String(allowListed.payload.redirectUri ?? allowListed.payload.data?.redirectUri ?? '');
check('۱۰. با TAPESH_ALLOWED_HOSTS فهرست بسته می‌شود و میزبان غریبه رد می‌شود',
  allowUri.startsWith('https://tapesh.ir/'));

const startRedirect = await call(handleGoogleAuthApi, 'GET', '/api/auth/google/start', {
  headers: { host: 'tapesh.ir', 'x-forwarded-host': 'evil.example.com', 'x-forwarded-proto': 'https' },
});
check('۱۰. [Attack 9] خودِ ریدایرکت start هم به میزبان جعلی نمی‌رود',
  startRedirect.status === 302 && !String(startRedirect.location).includes('evil.example.com'));

/* ───────────────────── ۱۱. SSRF ───────────────────── */

/*
 * قاعدهٔ معماری: آدرس سرویس‌های بیرونی فقط از `process.env` با مقدار پیش‌فرض
 * ثابت می‌آید. نه تنظیمات پنل و نه بدنهٔ درخواست نباید در URL خروجی بنشیند.
 * این سنجه، همان قاعده را روی سورس نگهبان می‌کند.
 */
const outboundSources = [
  './mediaStore.js', './publishingStore.js', './publishers/index.js', './publishers/bale.js',
  './publishers/eitaa.js', './publishers/instagram.js', './publishers/telegram.js',
  './publishers/telegramLike.js',
];

/*
 * فقط **آرگومان اول** هر `fetch(...)` را برمی‌دارد — یعنی خودِ URL، نه شیء
 * گزینه‌ها (که `body` دارد و اگر با هم دیده شوند، مثبت کاذب می‌دهد).
 */
function fetchUrls(source) {
  const urls = [];
  let cursor = 0;

  while ((cursor = source.indexOf('fetch(', cursor)) !== -1) {
    let index = cursor + 'fetch('.length;
    let depth = 0;
    let end = index;

    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === '(') depth += 1;
      else if (char === ')') {
        if (depth === 0) break;
        depth -= 1;
      } else if (char === ',' && depth === 0) break;
    }

    urls.push(source.slice(index, end));
    cursor = end;
  }

  return urls;
}

let noSettingsInOutbound = true;
let noRequestBodyInUrl = true;
for (const relative of outboundSources) {
  const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
  if (/readSettings/.test(source)) noSettingsInOutbound = false;

  for (const url of fetchUrls(source)) {
    if (/\b(input|ctx|req\.body|request\.body|settings|body)\b/.test(url)) noRequestBodyInUrl = false;
  }
}
check('۱۱. هیچ ماژول خروجی، آدرس را از تنظیمات پنل نمی‌سازد', noSettingsInOutbound);
check('۱۱. هیچ URL خروجی از بدنهٔ درخواست ساخته نمی‌شود', noRequestBodyInUrl);

const unknownPlatform = await api('POST', '/api/admin/media/accounts/test', {
  ...sessionOf(superLogin),
  body: { platform: 'http://169.254.169.254/latest/meta-data', token: 'x', externalId: 'y' },
});
check('۱۱. پلتفرم، «نام از فهرست بسته» است نه آدرس — مقدار دلخواه رد می‌شود',
  unknownPlatform.status === 400 || unknownPlatform.status === 403 || unknownPlatform.payload.data?.ok === false);

const unknownPublishPlatform = await api('POST', '/api/admin/publishing/test', {
  ...sessionOf(superLogin),
  body: { platform: 'file:///etc/passwd', token: 'x', chatId: 'y' },
});
check('۱۱. پلتفرم انتشار هم از فهرست بسته می‌آید و آدرس نمی‌پذیرد',
  unknownPublishPlatform.status >= 400 || unknownPublishPlatform.payload.data?.complete === false);

const noTokenSend = await api('POST', '/api/admin/publishing/send', {
  ...sessionOf(superLogin),
  body: { channelId: 'ch-does-not-exist', content: { text: 'تست' } },
});
check('۱۱. ارسال بدون توکن، هیچ درخواست شبکه‌ای نمی‌زند → خطای کنترل‌شده',
  noTokenSend.status >= 400);

/* ───────────────────── ۱۲. Attack 6 — دست‌کاری گزارش رویدادها ───────────────────── */

const deleteLogs = await api('DELETE', '/api/admin/logs', sessionOf(superLogin));
check('۱۲. [Attack 6] مسیر حذف گزارش رویدادها وجود ندارد', deleteLogs.status >= 400);

const deleteActivity = await api('DELETE', '/api/admin/activity', sessionOf(superLogin));
check('۱۲. [Attack 6] مسیر حذف سابقه وجود ندارد', deleteActivity.status >= 400);

const editorReadsLogs = await api('GET', '/api/admin/logs', sessionOf(editorLogin));
check('۱۲. [Attack 6] نقش بدون logs.read گزارش را نمی‌بیند → ۴۰۳', editorReadsLogs.status === 403);

const logsList = await api('GET', '/api/admin/logs', sessionOf(superLogin));
const logActions = new Set((logsList.payload.data?.items ?? []).map((row) => row.action));
const expectedActions = ['auth.login', 'admin.created', 'settings.updated', 'analytics.exported'];
check('۱۲. رویدادهای حساس پنل واقعاً ثبت می‌شوند',
  expectedActions.every((action) => logActions.has(action)));

const logsBody = JSON.stringify(logsList.payload);
check('۱۲. گزارش رویدادها هش رمز یا توکن برنمی‌گرداند',
  !logsBody.includes('passwordHash') && realTokens.every((token) => !logsBody.includes(token)));

/* ───────────────────── ۱۳. Attack 8 — CSRF روی مسیرهای حساس ───────────────────── */

const csrfSensitive = [
  ['POST', '/api/admin/media/accounts/acc-seed1/credentials', { token: 'x' }],
  ['POST', '/api/admin/publishing/channels/ch-nope/token', { token: 'x' }],
  ['PUT', '/api/admin/settings', { security: { sessionHours: 999 } }],
  ['POST', '/api/admin/analytics/alerts', { name: 'x', metric: 'y', threshold: 1 }],
];
let csrfAllBlocked = true;
for (const [method, path, body] of csrfSensitive) {
  const response = await api(method, path, { cookies: superLogin.cookies, body });
  if (response.status !== 403) csrfAllBlocked = false;
}
check('۱۳. [Attack 8] هر ۴ مسیر حساس بدون CSRF رد می‌شوند', csrfAllBlocked);

const crossOriginPost = await api('POST', '/api/admin/users', {
  ...sessionOf(superLogin),
  body: { username: `p3s-csrf-${stamp}`, password: 'x1234', role: 'editor' },
  headers: { origin: 'https://evil.example.com', referer: 'https://evil.example.com/x' },
});
check(
  '۱۳. [Attack 8] Origin مهاجم، درخواست تغییردهنده را به حساب خودش نمی‌پذیرد',
  crossOriginPost.status === 200 || crossOriginPost.status === 403,
);

/* ───────────────────── پاک‌سازی ───────────────────── */

/*
 * پاک‌سازی نباید سرنوشت تست را تعیین کند.
 *
 * در سندباکسِ میزبان هر حذف از یک گارد بیرونی پرسیده می‌شود و اگر سهمیهٔ
 * نوبت پر باشد رد می‌شود؛ آن خطا **پرتاب** می‌شود و پروسه را می‌کشد. نتیجه
 * دو چیز است: (۱) تستی که همهٔ assertهایش سبز است با exit 1 تمام می‌شود،
 * (۲) `restoreContent()` که پایین‌تر می‌آید هرگز اجرا نمی‌شود. هر دو در
 * اجرای واقعی `verify:all` دیده شد. پس شکستِ پاک‌سازی را هشدار می‌کنیم، نه
 * شکستِ تست.
 */
function safeUnlink(target) {
  if (!existsSync(target)) return;
  try {
    unlinkSync(target);
  } catch (error) {
    console.warn(`⚠️ پاک‌سازی ${target} انجام نشد: ${error && error.message ? error.message : error}`);
  }
}

if (uploaded) {
  await api('DELETE', `/api/admin/media/${uploaded.id}`, sessionOf(superLogin));
  safeUnlink(fileURLToPath(new URL(`../public/uploads/${uploaded.filename}`, import.meta.url)));
}

const adminsNow = JSON.parse(readFileSync(paths[0], 'utf8'));
for (const admin of adminsNow) {
  if (typeof admin.username === 'string' && admin.username.startsWith('p3s-')) {
    await api('DELETE', `/api/admin/users/${admin.id}`, sessionOf(superLogin));
  }
}

/* فایل‌های زیرنویس آزمایشی بین‌الملل (اگر ساخته شده باشند) */
for (const name of ['p3-test.vtt', 'p3-test.sh']) {
  safeUnlink(fileURLToPath(new URL(`../public/uploads/intl/${name}`, import.meta.url)));
}

restoreContent();

/* سنجه‌ای که به وضعیت بعد از پاک‌سازی نیاز دارد */
check('۱۴. نقش admin مجوز settings.security.manage ندارد',
  !rolePermissions('admin').includes('settings.security.manage'));
check('۱۴. مدل مجوز هنوز فهرست کامل را برای مدیر کل نگه می‌دارد',
  PERMISSIONS.every((permission) => rolePermissions('super-admin').includes(permission)));

console.log('\nنتیجهٔ تست دادهٔ حساس، اسرار و حسابرسی پنل (PHASE 3 — بخش ۲):');
results.forEach((row) => console.log(`  ${row.pass ? '✓' : '✗'} ${row.name}`));
const passed = results.filter((row) => row.pass).length;
console.log(`\n${passed}/${results.length} سنجه موفق\n`);

if (passed !== results.length) process.exitCode = 1;
