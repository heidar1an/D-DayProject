/*
 * تست دودی ورود/ثبت‌نام با گوگل — بدون سرور بیرونی و بدون مرورگر.
 *
 * اجرا:  node database/googleAuth.test.mjs
 *
 * چه چیزی سنجیده می‌شود: هر بخشی از جریان که **قطعی** است — ساخت آدرس گوگل،
 * کوکی‌ها، گارد CSRF، مسیرهای بازگشت، و همهٔ منطق حساب (upsert، اتصال با ایمیل
 * تأییدشده، حذف `googleId` از پاسخ عمومی).
 *
 * چه چیزی سنجیده **نمی‌شود** (صادقانه): معاوضهٔ واقعی کد با توکن، چون به
 * `GOOGLE_CLIENT_ID/SECRET` واقعی و مرورگر نیاز دارد. سنجهٔ ۱۱ فقط ثابت می‌کند
 * «کد نامعتبر ⇒ خطای مدیریت‌شده»، نه «ورود موفق». برای اثبات ورود واقعی باید
 * یک‌بار با حساب گوگل خودتان وارد شوید.
 *
 * ⚠️ این تست `database/users.json` را دست می‌زند، ولی در `finally` فقط همان
 * رکوردهایی را پاک می‌کند که خودش ساخته است.
 */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';

const USERS_FILE = new URL('./users.json', import.meta.url);

/* پیش از import ماژول‌ها ست می‌شود؛ پیکربندی در هر درخواست خوانده می‌شود */
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

const { handleGoogleAuthApi } = await import('./googleAuth.js');
const { findUserById, publicUser, saveGoogleUser, verifyUser } = await import('./usersStore.js');

const before = new Set(
  JSON.parse(readFileSync(USERS_FILE, 'utf8')).users.map((user) => user.id),
);

const server = createServer(async (request, response) => {
  const handled = await handleGoogleAuthApi(request, response);
  if (!handled) {
    response.statusCode = 404;
    response.end('not-handled');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

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

/* `redirect: 'manual'` چون همهٔ پاسخ‌ها ۳۰۲ هستند و باید Location را بخوانیم */
const get = (path, headers = {}) => fetch(`${base}${path}`, { redirect: 'manual', headers });

try {
  /* ── ۱. وضعیت پیکربندی ── */
  const status = await get('/api/auth/google/status');
  const statusBody = await status.json();
  check('۱. با هر دو متغیر، status می‌گوید configured=true', statusBody.configured === true);
  check('۲. status آدرس بازگشت را می‌دهد تا در گوگل ثبت شود', statusBody.redirectUri === `${base}/api/auth/google/callback`);

  /* ── ۲. ساخت آدرس گوگل ── */
  const start = await get('/api/auth/google/start', {
    'x-forwarded-host': 'tapesh.test',
    'x-forwarded-proto': 'https',
  });
  const authorize = new URL(start.headers.get('location'));
  const cookie = start.headers.get('set-cookie') ?? '';

  check('۳. start به accounts.google.com می‌رود', authorize.origin === 'https://accounts.google.com');
  check('۴. client_id پاس می‌شود', authorize.searchParams.get('client_id') === 'test-client-id.apps.googleusercontent.com');
  check('۵. redirect_uri همان دامنهٔ عمومی + مسیر callback است', authorize.searchParams.get('redirect_uri') === 'https://tapesh.test/api/auth/google/callback');
  check('۶. scope دقیقاً openid/email/profile است', authorize.searchParams.get('scope') === 'openid email profile');
  check('۷. response_type کد یک‌بارمصرف است', authorize.searchParams.get('response_type') === 'code');
  check('۸. prompt=select_account تا انتخاب حساب ممکن باشد', authorize.searchParams.get('prompt') === 'select_account');
  check('۹. کوکی state: HttpOnly + SameSite=Lax', /tapesh_google_state=[0-9a-f]{48}/.test(cookie) && cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax'));
  check('۱۰. روی https پرچم Secure دارد', cookie.includes('Secure'));

  const state = cookie.match(/tapesh_google_state=([0-9a-f]+)/)[1];

  const insecure = await get('/api/auth/google/start', { 'x-forwarded-host': 'localhost:5173' });
  check('۱۱. روی http پرچم Secure نمی‌گیرد (وگرنه مرورگر کوکی را دور می‌ریزد)', !(insecure.headers.get('set-cookie') ?? '').includes('Secure'));

  /* ── ۳. گارد CSRF و مسیرهای بازگشت ── */
  const wrongState = await get('/api/auth/google/callback?code=x&state=deadbeef', { cookie: `tapesh_google_state=${state}` });
  check('۱۲. state ناهمخوان رد می‌شود ⇒ ?google=state', wrongState.headers.get('location')?.endsWith('/?google=state#auth') === true);

  const noCode = await get(`/api/auth/google/callback?state=${state}`, { cookie: `tapesh_google_state=${state}` });
  check('۱۳. بدون کد ⇒ ?google=failed', noCode.headers.get('location')?.endsWith('/?google=failed#auth') === true);

  const denied = await get('/api/auth/google/callback?error=access_denied', { cookie: `tapesh_google_state=${state}` });
  check('۱۴. لغو کاربر ⇒ ?google=cancelled (نه failed)', denied.headers.get('location')?.endsWith('/?google=cancelled#auth') === true);

  const badCode = await get(`/api/auth/google/callback?code=not-a-real-code&state=${state}`, { cookie: `tapesh_google_state=${state}` });
  check('۱۵. کد نامعتبر ⇒ ?google=failed، بدون کرش', badCode.headers.get('location')?.endsWith('/?google=failed#auth') === true);
  check('۱۶. کوکی state پس از callback پاک می‌شود', (badCode.headers.get('set-cookie') ?? '').includes('tapesh_google_state=;'));

  /* ── ۴. دست‌دادن ── */
  const noHandoff = await get('/api/auth/google/handoff');
  const noHandoffBody = await noHandoff.json();
  check('۱۷. handoff بدون کوکی ⇒ user:null، نه خطا', noHandoff.status === 200 && noHandoffBody.user === null);
  check('۱۸. handoff کوکی را در هر حالت پاک می‌کند', (noHandoff.headers.get('set-cookie') ?? '').includes('tapesh_google_handoff=;'));

  /* ── ۵. روتر ── */
  check('۱۹. زیرمسیر ناشناس ⇒ 404', (await get('/api/auth/google/whatever')).status === 404);
  check('۲۰. مسیر غیرمرتبط به لایهٔ بعد واگذار می‌شود', (await get('/api/users/lookup')).status === 404);
  check('۲۱. متد غیر GET ⇒ 405', (await fetch(`${base}/api/auth/google/status`, { method: 'POST' })).status === 405);

  /* ── ۶. حساب گوگلی ── */
  const created = saveGoogleUser({
    sub: 'google-sub-1',
    email: 'Ali@Example.com',
    email_verified: true,
    given_name: 'علی',
    family_name: 'محمدی',
  });
  check('۲۲. حساب گوگلی ساخته شد', Boolean(created.id) && created.googleId === 'google-sub-1');
  check('۲۳. ایمیل نرمال‌شده ذخیره شد', created.email === 'ali@example.com');
  check('۲۴. نام گوگل در پروفایل نشست', created.profile.firstName === 'علی' && created.profile.lastName === 'محمدی');
  check('۲۵. حساب گوگلی phone و passwordHash ندارد', created.phone === '' && created.passwordHash === null);

  const secondLogin = saveGoogleUser({ sub: 'google-sub-1', email: 'ali@example.com', email_verified: true, given_name: 'دیگر' });
  check('۲۶. ورود دوم حساب تازه نمی‌سازد', secondLogin.id === created.id);
  check('۲۷. نامی که کاربر خودش نوشته بازنویسی نمی‌شود', secondLogin.profile.firstName === 'علی');

  const byEmail = saveGoogleUser({ sub: 'google-sub-2', email: 'ali@example.com', email_verified: true });
  check('۲۸. ایمیل تأییدشده به حساب موجود وصل می‌شود', byEmail.id === created.id);

  const untrusted = saveGoogleUser({ sub: 'google-sub-3', email: 'ali@example.com', email_verified: false });
  check('۲۹. ایمیل تأییدنشده حساب دیگری را در اختیار نمی‌گیرد', untrusted.id !== created.id);

  const safe = publicUser(findUserById(created.id));
  check('۳۰. پاسخ عمومی هم passwordHash و هم googleId را حذف می‌کند', safe.passwordHash === undefined && safe.googleId === undefined && safe.email === 'ali@example.com');
  check('۳۱. پاسخ عمومی null را تحمل می‌کند', publicUser(findUserById('nope')) === null);

  /* گارد امنیتی: حساب بدون رمز نباید با هر رمزی وارد شود */
  check('۳۲. ورود با رمز روی حساب گوگلی رد می‌شود', verifyUser({ phone: '09120000000', password: 'anything' }) === null);

  /* ── ۷. پیکربندی‌نشده ── */
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;

  const bareStatus = await (await get('/api/auth/google/status')).json();
  check('۳۳. بدون متغیرها status صریحاً configured=false می‌گوید', bareStatus.configured === false);
  check('۳۴. بدون متغیرها start به ?google=unconfigured برمی‌گردد', (await get('/api/auth/google/start')).headers.get('location')?.endsWith('/?google=unconfigured#auth') === true);
} finally {
  /* فقط رکوردهای آزمایشی: آن‌هایی که پیش از تست نبودند و شناسهٔ گوگل تستی دارند */
  const parsed = JSON.parse(readFileSync(USERS_FILE, 'utf8'));
  const kept = parsed.users.filter(
    (user) => before.has(user.id) || !String(user.googleId ?? '').startsWith('google-sub-'),
  );

  writeFileSync(USERS_FILE, JSON.stringify({ users: kept }, null, 2), 'utf8');
  console.log(`\n— ${parsed.users.length - kept.length} رکورد آزمایشی پاک شد —`);

  server.close();
}

console.log(`\n${passed} سنجهٔ موفق · ${failed} ناموفق`);
process.exit(failed === 0 ? 0 : 1);
