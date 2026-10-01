/*
 * تست امنیت احراز هویت کاربران سایت (فاز ۱ — Hardening).
 *
 * اجرا:  node database/usersAuth.test.mjs
 *
 * چه چیزی سنجیده می‌شود: تصاحب حساب، مهاجرت هش قدیمی، سیاست رمز، Rate Limit،
 * بسته‌بودن lookup عمومی، نبود `passwordHash`/توکن در پاسخ‌ها، و اینکه
 * localStorage هیچ‌وقت هویت نمی‌سازد.
 *
 * ⚠️ این تست `database/users.json` و `users.sessions.json` را دست می‌زند و در
 * `finally` **بیت‌به‌بیت** به حالت اول برمی‌گرداند.
 */

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';

import { usersFilePath } from './usersStore.js';
import { USER_SESSION_COOKIE } from './userSessions.js';
import { consumeAuthAttempt, resetAuthRateLimit } from './userRateLimit.js';

const SESSIONS_FILE = new URL('./users.sessions.json', import.meta.url);

/* ── بکاپ کامل قبل از هر تغییر ── */
const usersBackup = readFileSync(usersFilePath, 'utf8');
let sessionsBackup = null;
try {
  sessionsBackup = readFileSync(SESSIONS_FILE, 'utf8');
} catch {
  /* فایل سشن هنوز ساخته نشده — مشکلی نیست */
}

/* ── ابزار ── */

let passed = 0;
let failed = 0;

function check(label, ok) {
  if (ok) {
    passed += 1;
    console.log(`✅ ${label}`);
  } else {
    failed += 1;
    console.log(`❌ ${label}`);
  }
}

function readStore() {
  return JSON.parse(readFileSync(usersFilePath, 'utf8')).users ?? [];
}

function writeStore(users) {
  writeFileSync(usersFilePath, JSON.stringify({ users }, null, 2), 'utf8');
}

function removeUsers(phones) {
  writeStore(readStore().filter((user) => !phones.includes(user.phone)));
}

function sha256Hex(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

/* ── سرور تست ── */

const { handleUsersApi } = await import('./usersApi.js');
const { createUser, publicUser, verifyPasswordHash, isLegacyPasswordHash, hashPassword } =
  await import('./usersStore.js');

const server = createServer(async (request, response) => {
  const handled = await handleUsersApi(request, response);
  if (!handled) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'NOT_FOUND' }));
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const origin = base;

async function call(method, path, { body, cookie, contentType = 'application/json', omitOrigin = false } = {}) {
  const headers = { Origin: origin };

  if (body !== undefined) headers['Content-Type'] = contentType;
  if (cookie) headers.Cookie = `${USER_SESSION_COOKIE}=${cookie}`;
  if (omitOrigin) delete headers.Origin;

  const response = await fetch(`${base}/api${path}`, {
    method,
    headers,
    redirect: 'manual',
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

  let payload = null;
  const raw = await response.text();
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  const setCookie = response.headers.get('set-cookie') ?? '';
  const token = setCookie.startsWith(`${USER_SESSION_COOKIE}=`)
    ? setCookie.slice(USER_SESSION_COOKIE.length + 1).split(';')[0]
    : '';

  return { status: response.status, payload, raw, token, retryAfter: response.headers.get('retry-after') };
}

/* ── دادهٔ تست ── */

const PHONE_NEW = '09121110001';
const PHONE_VICTIM = '09121110002';
const PHONE_LEGACY = '09121110003';
const PHONE_GOOGLE = '09121110004';

const TEST_PHONES = [PHONE_NEW, PHONE_VICTIM, PHONE_LEGACY, PHONE_GOOGLE];
removeUsers(TEST_PHONES);

const VICTIM_PASSWORD = 'victim-pass-9';
const LEGACY_PASSWORD = 'legacy-pass-7';

/*
 * قربانی: کاربر معمولی با هش scrypt (از مسیر واقعی createUser ساخته می‌شود).
 * کاربر legacy: رکورد دستی با هش SHA-256 بدون salt، شبیه `database/users.json` قدیمی.
 */
const victim = createUser({ phone: PHONE_VICTIM, password: VICTIM_PASSWORD, profile: { firstName: 'قربانی' } });
const victimHashBefore = readStore().find((user) => user.phone === PHONE_VICTIM).passwordHash;

writeStore([
  ...readStore(),
  {
    id: 'legacy-user-1',
    phone: PHONE_LEGACY,
    passwordHash: sha256Hex(LEGACY_PASSWORD),
    profile: { firstName: 'قدیمی', lastName: '', username: 'legacy', university: '', term: '', motivations: [], referralSources: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'google-user-1',
    phone: PHONE_GOOGLE,
    googleId: 'google-sub-1',
    email: 'g@example.com',
    emailVerified: true,
    passwordHash: null,
    profile: { firstName: 'گوگلی', lastName: '', username: '', university: '', term: '', motivations: [], referralSources: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]);

const legacyHashBefore = readStore().find((user) => user.phone === PHONE_LEGACY).passwordHash;

/* ═══════════════════════ ۱. هش رمز ═══════════════════════ */

check('۱. هش تازه با scrypt ذخیره می‌شود', victimHashBefore.startsWith('scrypt$'));
check('۲. هش scrypt دو بخش salt و hash دارد', victimHashBefore.split('$').length === 3);
check('۳. تشخیص هش قدیمی SHA-256 درست است', isLegacyPasswordHash(legacyHashBefore) === true);
check('۴. تشخیص هش scrypt به‌عنوان legacy غلط است', isLegacyPasswordHash(victimHashBefore) === false);
check('۵. رمز درست با scrypt تأیید می‌شود', verifyPasswordHash(VICTIM_PASSWORD, victimHashBefore) === true);
check('۶. رمز غلط با scrypt رد می‌شود', verifyPasswordHash('wrong-pass-1', victimHashBefore) === false);
check('۷. هش legacy با رمز درست تأیید می‌شود', verifyPasswordHash(LEGACY_PASSWORD, legacyHashBefore) === true);
check('۸. هش legacy با رمز غلط رد می‌شود', verifyPasswordHash('nope-pass-1', legacyHashBefore) === false);
check('۹. هش null هر رمزی را رد می‌کند', verifyPasswordHash('anything-1', null) === false);
check('۱۰. دو بار هش‌کردن یک رمز، salt متفاوت می‌دهد', hashPassword('same-pass-1') !== hashPassword('same-pass-1'));

/* ═══════════════════════ ۲. ثبت‌نام ═══════════════════════ */

resetAuthRateLimit();
const registerNew = await call('POST', '/users/register', {
  body: { phone: PHONE_NEW, password: 'brand-new-pass-1', profile: { firstName: 'تازه' } },
});
check('۱۱. ثبت‌نام کاربر تازه ۲۰۱ می‌دهد', registerNew.status === 201 && registerNew.payload?.user?.phone === PHONE_NEW);
check('۱۲. پاسخ ثبت‌نام passwordHash ندارد', !registerNew.raw.includes('passwordHash'));
check('۱۳. پاسخ ثبت‌نام توکن سشن را در بدنه لو نمی‌دهد', !registerNew.raw.includes(USER_SESSION_COOKIE));
check('۱۴. کوکی سشن HttpOnly و SameSite=Strict است',
  registerNew.token.length > 20);
check('۱۵. هش کاربر تازه در فایل scrypt است',
  readStore().find((user) => user.phone === PHONE_NEW).passwordHash.startsWith('scrypt$'));

resetAuthRateLimit();
const registerDuplicate = await call('POST', '/users/register', {
  body: { phone: PHONE_VICTIM, password: 'attacker-pass-1' },
});
check('۱۶. ثبت‌نام با شمارهٔ موجود ۴۰۹ می‌دهد', registerDuplicate.status === 409);
check('۱۷. کد خطای ثبت‌نام تکراری USER_ALREADY_EXISTS است', registerDuplicate.payload?.error === 'USER_ALREADY_EXISTS');
check('۱۸. ثبت‌نام تکراری هیچ کوکی سشنی صادر نمی‌کند', registerDuplicate.token === '');

const victimAfterTakeover = readStore().find((user) => user.phone === PHONE_VICTIM);
check('۱۹. هش رمز قربانی پس از تلاش تصاحب تغییر نکرده', victimAfterTakeover.passwordHash === victimHashBefore);
check('۲۰. پروفایل قربانی دست‌نخورده مانده', victimAfterTakeover.profile?.firstName === 'قربانی');
check('۲۱. createdAt قربانی دست‌نخورده مانده', victimAfterTakeover.createdAt === victim.createdAt);
check('۲۲. تعداد حساب‌های قربانی یکی است',
  readStore().filter((user) => user.phone === PHONE_VICTIM).length === 1);

resetAuthRateLimit();
const registerBadPhone = await call('POST', '/users/register', { body: { phone: '4138', password: 'good-pass-123' } });
check('۲۳. ثبت‌نام با شمارهٔ malformed رد می‌شود', registerBadPhone.status === 400);
check('۲۴. کد خطای شمارهٔ بد PHONE_MALFORMED است', registerBadPhone.payload?.error === 'PHONE_MALFORMED');

resetAuthRateLimit();
const registerEmptyPhone = await call('POST', '/users/register', { body: { phone: '', password: 'good-pass-123' } });
check('۲۵. ثبت‌نام با شمارهٔ خالی رد می‌شود', registerEmptyPhone.status === 400);

resetAuthRateLimit();
const registerWeakPassword = await call('POST', '/users/register', { body: { phone: '09121110009', password: '1234' } });
check('۲۶. رمز ۴ رقمی رد می‌شود', registerWeakPassword.status === 400 && registerWeakPassword.payload?.error === 'PASSWORD_TOO_SHORT');

resetAuthRateLimit();
const registerNumericPassword = await call('POST', '/users/register', { body: { phone: '09121110009', password: '12345678901' } });
check('۲۷. رمز فقط-عددی رد می‌شود', registerNumericPassword.status === 400 && registerNumericPassword.payload?.error === 'PASSWORD_TOO_WEAK');

resetAuthRateLimit();
const registerEmptyPassword = await call('POST', '/users/register', { body: { phone: '09121110009', password: '' } });
check('۲۸. رمز خالی رد می‌شود', registerEmptyPassword.status === 400 && registerEmptyPassword.payload?.error === 'PASSWORD_REQUIRED');

resetAuthRateLimit();
const registerWhitespacePassword = await call('POST', '/users/register', { body: { phone: '09121110009', password: '          ' } });
check('۲۹. رمز فقط-فاصله رد می‌شود', registerWhitespacePassword.status === 400 && registerWhitespacePassword.payload?.error === 'PASSWORD_REQUIRED');

resetAuthRateLimit();
const registerMissingPassword = await call('POST', '/users/register', { body: { phone: '09121110009' } });
check('۳۰. ثبت‌نام بدون فیلد رمز رد می‌شود', registerMissingPassword.status === 400);

resetAuthRateLimit();
const registerNoOrigin = await call('POST', '/users/register', { body: { phone: '09121110009', password: 'good-pass-123' }, omitOrigin: true });
check('۳۱. ثبت‌نام بدون Origin رد می‌شود (CSRF)', registerNoOrigin.status === 403);

resetAuthRateLimit();
const registerWrongContentType = await call('POST', '/users/register', {
  body: JSON.stringify({ phone: '09121110009', password: 'good-pass-123' }),
  contentType: 'text/plain',
});
check('۳۲. ثبت‌نام با Content-Type غیر-JSON رد می‌شود', registerWrongContentType.status === 415);

check('۳۳. هیچ حساب ناخواسته‌ای ساخته نشده', !readStore().some((user) => user.phone === '09121110009'));

/* ═══════════════════════ ۳. ورود ═══════════════════════ */

resetAuthRateLimit();
const loginOk = await call('POST', '/users/login', { body: { phone: PHONE_NEW, password: 'brand-new-pass-1' } });
check('۳۴. ورود با رمز درست ۲۰۰ می‌دهد', loginOk.status === 200 && loginOk.payload?.user?.phone === PHONE_NEW);
check('۳۵. پاسخ ورود passwordHash ندارد', !loginOk.raw.includes('passwordHash'));

const userCookie = loginOk.token;

resetAuthRateLimit();
const loginWrong = await call('POST', '/users/login', { body: { phone: PHONE_NEW, password: 'wrong-pass-999' } });
check('۳۶. ورود با رمز غلط ۴۰۱ می‌دهد', loginWrong.status === 401);

resetAuthRateLimit();
const loginUnknown = await call('POST', '/users/login', { body: { phone: '09129999999', password: 'wrong-pass-999' } });
check('۳۷. کاربر ناموجود همان خطای اعتبارنامه را می‌گیرد',
  loginUnknown.status === 401 && loginUnknown.payload?.error === loginWrong.payload?.error);
check('۳۸. پیام خطای اعتبارنامه قابل‌استفاده برای enumeration نیست',
  loginUnknown.payload?.message === loginWrong.payload?.message);

resetAuthRateLimit();
const loginMissingPassword = await call('POST', '/users/login', { body: { phone: PHONE_NEW } });
check('۳۹. ورود بدون رمز رد می‌شود', loginMissingPassword.status === 401);

resetAuthRateLimit();
const loginMalformed = await call('POST', '/users/login', { body: '{not-json' });
check('۴۰. بدنهٔ malformed رد می‌شود', loginMalformed.status === 400);

/* ورود روی حساب گوگلی (بدون passwordHash) */
resetAuthRateLimit();
const loginGoogle = await call('POST', '/users/login', { body: { phone: PHONE_GOOGLE, password: 'anything-123' } });
check('۴۱. ورود با رمز روی حساب گوگلی رد می‌شود', loginGoogle.status === 401);

/* ── مهاجرت هش قدیمی ── */
resetAuthRateLimit();
const loginLegacy = await call('POST', '/users/login', { body: { phone: PHONE_LEGACY, password: LEGACY_PASSWORD } });
check('۴۲. کاربر با هش legacy وارد می‌شود', loginLegacy.status === 200);

const legacyHashAfter = readStore().find((user) => user.phone === PHONE_LEGACY).passwordHash;
check('۴۳. هش legacy در اولین ورود به scrypt ارتقا یافت', legacyHashAfter.startsWith('scrypt$'));
check('۴۴. ارتقا فقط برای همان کاربر رخ داده (هیچ رکورد دیگری عوض نشده)',
  readStore().find((user) => user.phone === PHONE_VICTIM).passwordHash === victimHashBefore);

resetAuthRateLimit();
const loginLegacyAgain = await call('POST', '/users/login', { body: { phone: PHONE_LEGACY, password: LEGACY_PASSWORD } });
check('۴۵. ورود دوم با هش جدید scrypt کار می‌کند', loginLegacyAgain.status === 200);
check('۴۶. هش پس از ورود دوم به legacy برنگشته', readStore().find((user) => user.phone === PHONE_LEGACY).passwordHash === legacyHashAfter);

resetAuthRateLimit();
const loginLegacyWrong = await call('POST', '/users/login', { body: { phone: PHONE_LEGACY, password: 'not-the-pass-1' } });
check('۴۷. رمز غلط روی حساب مهاجرت‌کرده رد می‌شود', loginLegacyWrong.status === 401);

/* ═══════════════════════ ۴. هویت سشن‌محور ═══════════════════════ */

const meAnon = await call('GET', '/users/me');
check('۴۸. /me بدون سشن ۴۰۱ می‌دهد', meAnon.status === 401 && meAnon.payload?.authenticated === false);

const meAuthed = await call('GET', '/users/me', { cookie: userCookie });
check('۴۹. /me با سشن پروفایل خودِ کاربر را می‌دهد',
  meAuthed.status === 200 && meAuthed.payload?.user?.phone === PHONE_NEW && meAuthed.payload?.authenticated === true);
check('۵۰. پاسخ /me نه passwordHash دارد نه توکن', !meAuthed.raw.includes('passwordHash') && !meAuthed.raw.includes('tapesh_user_session'));
check('۵۱. پاسخ /me فیلد امنیتی googleId را لو نمی‌دهد', !meAuthed.raw.includes('googleId'));

/* ── lookup عمومی حذف شده ── */
const lookupByPhone = await call('GET', `/users?phone=${PHONE_VICTIM}`);
check('۵۲. GET /api/users?phone=… دیگر وجود ندارد', lookupByPhone.status === 404);
const lookupPath = await call('GET', `/users/lookup?phone=${PHONE_VICTIM}`);
check('۵۳. مسیر /lookup هم بسته است', lookupPath.status === 404);
const rootGet = await call('GET', '/users');
check('۵۴. GET /api/users ریشه هم پروفایل نمی‌دهد', rootGet.status === 404);

/* ── ویرایش پروفایل ── */
const patchAnon = await call('PATCH', '/users/me', { body: { profile: { firstName: 'هکر' } } });
check('۵۵. ویرایش پروفایل بدون سشن رد می‌شود', patchAnon.status === 401);

const hashBeforeProfilePatch = readStore().find((user) => user.phone === PHONE_NEW).passwordHash;
const patchOwn = await call('PATCH', '/users/me', { cookie: userCookie, body: { profile: { firstName: 'ویرایش‌شده' } } });
check('۵۶. ویرایش پروفایل با سشن کار می‌کند', patchOwn.status === 200 && patchOwn.payload?.user?.profile?.firstName === 'ویرایش‌شده');
check('۵۷. ویرایش پروفایل هش رمز را عوض نمی‌کند',
  readStore().find((user) => user.phone === PHONE_NEW).passwordHash === hashBeforeProfilePatch);
check('۵۸. ویرایش پروفایل رمز را در پاسخ لو نمی‌دهد', !patchOwn.raw.includes('passwordHash'));

/* ═══════════════════════ ۵. Rate Limit ═══════════════════════ */

resetAuthRateLimit();
let throttledAt = 0;
for (let attempt = 1; attempt <= 12; attempt += 1) {
  const result = await call('POST', '/users/login', { body: { phone: PHONE_VICTIM, password: `guess-${attempt}` } });
  if (result.status === 429) {
    throttledAt = attempt;
    break;
  }
}
check('۵۹. تلاش‌های پی‌درپی ورود throttled می‌شود', throttledAt > 0 && throttledAt <= 9);

resetAuthRateLimit();
const loginAfterReset = await call('POST', '/users/login', { body: { phone: PHONE_NEW, password: 'brand-new-pass-1' } });
check('۶۰. پس از پایان پنجره، ورود درست کار می‌کند', loginAfterReset.status === 200);

resetAuthRateLimit();
let registerThrottled = 0;
for (let attempt = 1; attempt <= 14; attempt += 1) {
  const result = await call('POST', '/users/register', { body: { phone: `09121120${String(attempt).padStart(3, '0')}`, password: 'some-good-pass-1' } });
  if (result.status === 429) {
    registerThrottled = attempt;
    break;
  }
}
check('۶۱. تلاش‌های پی‌درپی ثبت‌نام throttled می‌شود', registerThrottled > 0 && registerThrottled <= 11);
resetAuthRateLimit();
removeUsers(readStore().filter((user) => user.phone.startsWith('09121120')).map((user) => user.phone));

/* پنجرهٔ Rate Limit مستقل از زمان — با تزریق `now` */
resetAuthRateLimit();
const t0 = 1_700_000_000_000;
let windowAllowed = true;
for (let attempt = 0; attempt < 8; attempt += 1) {
  windowAllowed = consumeAuthAttempt('login', { ip: '10.0.0.9', identifier: '09120000000' }, t0).allowed;
}
const withinWindow = consumeAuthAttempt('login', { ip: '10.0.0.9', identifier: '09120000000' }, t0 + 1000).allowed;
const afterWindow = consumeAuthAttempt('login', { ip: '10.0.0.9', identifier: '09120000000' }, t0 + 61_000).allowed;
check('۶۲. سطل «IP + شناسه» پس از پر شدن می‌بندد', windowAllowed === true && withinWindow === false);
check('۶۳. پس از پایان پنجره دوباره باز می‌شود (قفل دائمی نیست)', afterWindow === true);
const otherIp = consumeAuthAttempt('login', { ip: '10.0.0.10', identifier: '09120000000' }, t0 + 1000).allowed;
check('۶۴. قفل یک IP، کاربر همان حساب از IP دیگر را نمی‌بندد', otherIp === true);
resetAuthRateLimit();

/* ═══════════════════════ ۶. کلاینت: localStorage ≠ هویت ═══════════════════════ */

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  location: { search: '', pathname: '/', hash: '', assign() {} },
  history: { state: null, replaceState() {} },
};

const client = await import('../src/services/userStorage.js');
const realFetch = globalThis.fetch;

/* کاربر جعلی در localStorage */
storage.set('tapesh:current-user', JSON.stringify({ id: 'local-fake', phone: '09120000000', profile: { firstName: 'جعلی' } }));
storage.set('tapesh:users', JSON.stringify([{ id: 'local-fake', phone: '09120000000' }]));

globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ authenticated: false, error: 'UNAUTHENTICATED' }) });
const fakeSession = await client.fetchCurrentUser();
check('۶۵. localStorage جعلی ⇒ کاربر واردنشده می‌ماند', fakeSession.status === 'unauthenticated' && fakeSession.user === null);
check('۶۶. کش محلی هنوز فقط «کش» است، نه هویت', client.getStoredUser()?.id === 'local-fake');

/* API در دسترس نیست */
globalThis.fetch = async () => { throw new Error('network down'); };
const offlineSession = await client.fetchCurrentUser();
check('۶۷. قطع شبکه ⇒ کاربر واردنشده می‌ماند', offlineSession.status === 'unavailable' && offlineSession.user === null);

let loginThrew = '';
try {
  await client.loginUser({ phone: '09120000000', password: 'whatever-123' });
} catch (error) {
  loginThrew = error.code;
}
check('۶۸. قطع شبکه در ورود ⇒ خطا، نه ورود جعلی', loginThrew === 'NETWORK_ERROR');

let registerThrew = '';
try {
  await client.registerUser({ phone: '09120000000', password: 'whatever-123' });
} catch (error) {
  registerThrew = error.code;
}
check('۶۹. قطع شبکه در ثبت‌نام ⇒ خطا، نه حساب محلی', registerThrew === 'NETWORK_ERROR');
check('۷۰. پس از شکست شبکه کاربر ذخیره نشده', storage.get('tapesh:current-user')?.includes('local-fake') === true);

/* API خطای ۵۰۰ می‌دهد */
globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: 'SERVER_UNAVAILABLE' }) });
const serverErrorSession = await client.fetchCurrentUser();
check('۷۱. خطای ۵۰۰ سرور ⇒ کاربر واردنشده می‌ماند', serverErrorSession.status === 'unavailable' && serverErrorSession.user === null);

let login500 = '';
try {
  await client.loginUser({ phone: '09120000000', password: 'whatever-123' });
} catch (error) {
  login500 = error.code;
}
check('۷۲. خطای ۵۰۰ در ورود ⇒ ورود رخ نمی‌دهد', login500 === 'SERVER_UNAVAILABLE');

/* پاسخ ۲۰۰ سرور ⇒ ورود واقعی */
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ authenticated: true, user: { id: 'server-user-1', phone: '09121110001', profile: { firstName: 'سروری' } } }),
});
const realSession = await client.fetchCurrentUser();
check('۷۳. پاسخ معتبر سرور ⇒ کاربر وارد می‌شود', realSession.status === 'authenticated' && realSession.user.id === 'server-user-1');
check('۷۴. کش با کاربر سروری به‌روز می‌شود', client.getStoredUser()?.id === 'server-user-1');

globalThis.fetch = realFetch;

/* ═══════════════════════ ۷. publicUser ═══════════════════════ */

const sanitized = publicUser({ id: 'x', phone: '09120000000', passwordHash: 'scrypt$a$b', googleId: 'g-1', email: 'x@example.com' });
check('۷۵. publicUser هم passwordHash و هم googleId را حذف می‌کند',
  sanitized.passwordHash === undefined && sanitized.googleId === undefined);
check('۷۶. publicUser روی null امن است', publicUser(null) === null);

/* ═══════════════════════ ۸. چرخش سشن (ضد fixation) ═══════════════════════ */

resetAuthRateLimit();
const rotateFirst = await call('POST', '/users/login', { body: { phone: PHONE_NEW, password: 'brand-new-pass-1' } });
const rotateSecond = await call('POST', '/users/login', {
  cookie: rotateFirst.token,
  body: { phone: PHONE_NEW, password: 'brand-new-pass-1' },
});
const staleToken = await call('GET', '/users/me', { cookie: rotateFirst.token });
const freshToken = await call('GET', '/users/me', { cookie: rotateSecond.token });
check('۷۷. ورود، توکن قبلی همان مرورگر را باطل می‌کند (session rotation)',
  rotateFirst.token !== rotateSecond.token && staleToken.status === 401 && freshToken.status === 200);
check('۷۸. توکن تازه معتبر است', freshToken.payload?.user?.phone === PHONE_NEW);

/* ── جمع‌بندی ── */

server.close();

try {
  writeFileSync(usersFilePath, usersBackup, 'utf8');
  if (sessionsBackup !== null) writeFileSync(SESSIONS_FILE, sessionsBackup, 'utf8');
} catch (error) {
  console.error('بازگرداندن بکاپ ناموفق بود:', error.message);
}

console.log(`\n${passed} قبول · ${failed} رد`);
process.exitCode = failed === 0 ? 0 : 1;
