/*
 * تست امنیتی «RBAC، مدیر کل و مرز ارتقای سطح دسترسی» — PHASE 3 (بخش اول).
 * اجرا: node database/adminRbac.test.mjs
 *
 * روی هندلر واقعی پنل کار می‌کند (`handleApi`) و سنجه‌ها را به همان دسته‌های
 * سند فاز می‌بندد: admin-rbac · admin-superadmin · admin-privilege-escalation ·
 * admin-session · admin-revocation · admin-csrf.
 *
 * داده: `content/*.json` (مدیران، رویدادها، تنظیمات، رسانه) پیش از اجرا
 * نسخه‌برداری و در `finally` بازگردانده می‌شود — تست هیچ اثری روی دادهٔ واقعی
 * نمی‌گذارد. هیچ درخواستی به شبکهٔ بیرونی زده نمی‌شود.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { handleApi } from './adminApi.js';
import {
  PERMISSIONS, ROLES, SENSITIVE_ANALYTICS, deleteAdmin, rolePermissions,
} from './contentStore.js';

/* ───────────────────────────── بکاپ داده ───────────────────────────── */

const CONTENT_FILES = ['admins.json', 'activity.json', 'settings.json', 'events.json', 'media.json'];
const paths = CONTENT_FILES.map((name) => fileURLToPath(new URL(`./content/${name}`, import.meta.url)));
const backups = paths.map((path) => (existsSync(path) ? readFileSync(path, 'utf8') : null));

function restoreContent() {
  paths.forEach((path, index) => {
    if (backups[index] === null) return;
    writeFileSync(path, backups[index], 'utf8');
  });
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
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    end(chunk) { this.body = chunk ?? ''; },
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
  let payload = {};
  try { payload = JSON.parse(response.body || '{}'); } catch { payload = {}; }
  return { status: response.statusCode, payload, headers: response.headers };
}

async function login(username, password) {
  const response = await call('POST', '/api/admin/auth/login', { body: { username, password } });
  const setCookie = response.headers.get('set-cookie') ?? '';
  const token = setCookie.match(/tapesh_admin_session=([^;]+)/)?.[1] ?? '';
  return {
    status: response.status,
    token,
    csrf: response.payload.data?.csrfToken ?? '',
    cookies: token ? { tapesh_admin_session: token } : {},
    admin: response.payload.data?.admin ?? null,
    setCookie,
  };
}

const sessionOf = (user) => ({ cookies: { tapesh_admin_session: user.token }, csrf: user.csrf });

const SUPER_PASSWORD = '0135';
const superLogin = await login('0135', SUPER_PASSWORD);

/* ───────────────────────── ۱. یکپارچگی مدل مجوز ───────────────────────── */

check(
  '۱. فهرست PERMISSIONS تکراری ندارد',
  new Set(PERMISSIONS).size === PERMISSIONS.length,
);

check(
  '۱. فهرست مجوزهای هیچ نقشی تکراری ندارد',
  Object.keys(ROLES).every((roleId) => {
    const list = rolePermissions(roleId);
    return new Set(list).size === list.length;
  }),
);

check(
  '۱. هر مجوزی که یک نقش دارد، در فهرست PERMISSIONS اعلام شده است',
  Object.keys(ROLES).every((roleId) => rolePermissions(roleId).every((p) => PERMISSIONS.includes(p))),
);

check(
  '۱. مجوزهای super-admin اَبَرمجموعهٔ همهٔ نقش‌های دیگر است',
  Object.keys(ROLES)
    .filter((roleId) => roleId !== 'super-admin')
    .every((roleId) => rolePermissions(roleId).every((p) => rolePermissions('super-admin').includes(p))),
);

check(
  '۱. نقش admin مجوز ارتقا به مدیر کل را ندارد',
  !rolePermissions('admin').includes('users.superadmin.manage'),
);

check(
  '۱. نقش admin مجوز تغییر تنظیمات امنیتی را ندارد',
  !rolePermissions('admin').includes('settings.security.manage'),
);

check(
  '۱. سنجه‌های حساس تحلیل به نقش admin داده نمی‌شود',
  SENSITIVE_ANALYTICS.every((p) => !rolePermissions('admin').includes(p)),
);

/* ───────────────────────── ۲. ورود و نشست پایه ───────────────────────── */

check('۲. ورود مدیر کل با رمز درست', superLogin.status === 200 && superLogin.admin?.role === 'super-admin');

check(
  '۲. پاسخ ورود، هش رمز را برنمی‌گرداند',
  superLogin.admin && !('passwordHash' in superLogin.admin),
);

check(
  '۲. کوکی نشست HttpOnly + SameSite=Strict + Path=/ است',
  /HttpOnly/.test(superLogin.setCookie)
    && /SameSite=Strict/.test(superLogin.setCookie)
    && /Path=\//.test(superLogin.setCookie),
);

check(
  '۲. در محیط غیرپروداکشن پرچم Secure گذاشته نمی‌شود (رفتار مستندشده)',
  process.env.NODE_ENV === 'production' || !/;\s*Secure/.test(superLogin.setCookie),
);

/* ───────────────────── ۳. بدون احراز هویت هیچ‌چیز باز نیست ───────────────────── */

const ANONYMOUS_PROBES = [
  ['GET', '/api/admin/stats'],
  ['GET', '/api/admin/users'],
  ['GET', '/api/admin/settings'],
  ['GET', '/api/admin/logs'],
  ['GET', '/api/admin/analytics/users'],
  ['GET', '/api/admin/analytics/export'],
  ['GET', '/api/admin/publishing/channels'],
  ['GET', '/api/admin/media/accounts'],
  ['POST', '/api/admin/users'],
  ['PUT', '/api/admin/settings'],
  ['DELETE', '/api/admin/users/x'],
];

let anonymousAllDenied = true;
for (const [method, path] of ANONYMOUS_PROBES) {
  const response = await call(method, path);
  if (response.status !== 401) anonymousAllDenied = false;
}
check('۳. هر ۱۱ مسیر پنل بدون نشست ۴۰۱ می‌دهد (I1)', anonymousAllDenied);

const anonymousLogin = await call('POST', '/api/admin/auth/login', { body: {} });
check(
  '۳. مسیر ورود عمومی می‌ماند ولی بدنهٔ خالی را رد می‌کند',
  anonymousLogin.status === 400,
);

/* ───────────────────── ۴. CSRF روی همهٔ مسیرهای تغییردهنده ───────────────────── */

const MUTATING_PROBES = [
  ['POST', '/api/admin/users', { username: 'csrf-x', password: 'x1234', role: 'editor' }],
  ['PUT', '/api/admin/settings', { siteName: 'تپش' }],
  ['DELETE', '/api/admin/users/adm-nope', undefined],
  ['POST', '/api/admin/auth/password', { currentPassword: '0135', nextPassword: 'zzzz' }],
  ['POST', '/api/admin/auth/logout', undefined],
  ['POST', '/api/admin/articles', { title: 'x' }],
  ['POST', '/api/admin/publishing/send', {}],
];

let mutatingAllGuarded = true;
for (const [method, path, body] of MUTATING_PROBES) {
  const response = await call(method, path, { cookies: superLogin.cookies, body });
  if (response.status !== 403) mutatingAllGuarded = false;
}
check('۴. هر ۷ مسیر تغییردهنده بدون هدر CSRF ۴۰۳ می‌دهد (I8)', mutatingAllGuarded);

const wrongCsrf = await call('PUT', '/api/admin/settings', {
  cookies: superLogin.cookies, csrf: 'not-the-token', body: { siteName: 'تپش' },
});
check('۴. توکن CSRF نادرست رد می‌شود', wrongCsrf.status === 403);

/* ───────────────────── ۵. ساخت actor های آزمایشی ───────────────────── */

const stamp = Date.now().toString(36);
const adminUser = `p3-admin-${stamp}`;
const editorUser = `p3-editor-${stamp}`;
const ADMIN_PASSWORD = 'p3-admin-pass';
const EDITOR_PASSWORD = 'p3-editor-pass';

const createdAdmin = await call('POST', '/api/admin/users', {
  ...sessionOf(superLogin),
  body: { username: adminUser, name: 'مدیر آزمون', password: ADMIN_PASSWORD, role: 'admin' },
});
check(
  '۵. مدیر کل می‌تواند «مدیر» بسازد (users.create کافی است)',
  createdAdmin.status === 200 && createdAdmin.payload.data?.admin?.role === 'admin',
);
const adminId = createdAdmin.payload.data?.admin?.id;

const createdEditor = await call('POST', '/api/admin/users', {
  ...sessionOf(superLogin),
  body: { username: editorUser, name: 'نویسندهٔ آزمون', password: EDITOR_PASSWORD, role: 'editor' },
});
const editorId = createdEditor.payload.data?.admin?.id;

const adminLogin = await login(adminUser, ADMIN_PASSWORD);
const editorLogin = await login(editorUser, EDITOR_PASSWORD);
check('۵. ورود «مدیر» آزمایشی کار می‌کند', adminLogin.status === 200 && Boolean(adminLogin.token));
check('۵. ورود «نویسنده» آزمایشی کار می‌کند', editorLogin.status === 200 && Boolean(editorLogin.token));

/* ───────────────────── ۶. Attack 1 — Admin → Super Admin ───────────────────── */

const attackCreateSuper = await call('POST', '/api/admin/users', {
  ...sessionOf(adminLogin),
  body: { username: `p3-evil-${stamp}`, password: 'evil-pass', role: 'super-admin' },
});
check(
  '۶. [Attack 1] مدیر معمولی نمی‌تواند «مدیر کل» بسازد → ۴۰۳',
  attackCreateSuper.status === 403 && attackCreateSuper.payload.error?.code === 'FORBIDDEN',
);

const attackCreateSuperByName = await call('GET', `/api/admin/users?search=p3-evil-${stamp}`, sessionOf(superLogin));
check(
  '۶. [Attack 1] حساب ارتقایافته ساخته نشده است',
  (attackCreateSuperByName.payload.data?.items ?? []).length === 0,
);

/* ───────────────────── ۷. Attack 2 — Self Escalation ───────────────────── */

const attackSelfEscalate = await call('PUT', `/api/admin/users/${adminId}`, {
  ...sessionOf(adminLogin),
  body: { role: 'super-admin' },
});
check(
  '۷. [Attack 2] مدیر نمی‌تواند نقش خودش را به «مدیر کل» ارتقا دهد → ۴۰۳',
  attackSelfEscalate.status === 403,
);

const selfStillAdmin = await call('GET', `/api/admin/users?search=${adminUser}`, sessionOf(superLogin));
check(
  '۷. [Attack 2] نقش حساب دست‌نخورده مانده است',
  selfStillAdmin.payload.data?.items?.[0]?.role === 'admin',
);

/* ───────────────────── ۸. Attack 3 — Permission Injection ───────────────────── */

const attackInjectPermissions = await call('POST', '/api/admin/users', {
  ...sessionOf(adminLogin),
  body: {
    username: `p3-inject-${stamp}`,
    password: 'inject-pass',
    role: 'editor',
    permissions: ['*', 'users.superadmin.manage', 'analytics.users.read'],
    isSuperAdmin: true,
  },
});
const injected = attackInjectPermissions.payload.data?.admin;
check(
  '۸. [Attack 3] فیلد permissions از کلاینت نادیده گرفته می‌شود (I10)',
  injected
    && !injected.permissions.includes('*')
    && !injected.permissions.includes('users.superadmin.manage')
    && !injected.permissions.includes('analytics.users.read'),
);
check(
  '۸. [Attack 3] فیلد isSuperAdmin از کلاینت هیچ اثری ندارد',
  injected && injected.role === 'editor' && !('isSuperAdmin' in injected),
);
check(
  '۸. [Attack 3] مجوزهای حساب تازه دقیقاً همان مجوزهای نقش است',
  injected && injected.permissions.length === rolePermissions('editor').length,
);

const injectedLogin = await login(`p3-inject-${stamp}`, 'inject-pass');
const injectedProbe = await call('GET', '/api/admin/analytics/users', sessionOf(injectedLogin));
check(
  '۸. [Attack 3] حساب تزریق‌شده واقعاً به دادهٔ حساس دسترسی ندارد',
  injectedProbe.status === 403,
);

/* ───────────── ۹. Attack 3b — ارتقای غیرمستقیم از طریق حساب مدیر کل ───────────── */

const targetSuper = (await call('GET', '/api/admin/users?role=super-admin', sessionOf(superLogin)))
  .payload.data?.items?.[0];

const attackDemoteSuper = await call('PUT', `/api/admin/users/${targetSuper.id}`, {
  ...sessionOf(adminLogin),
  body: { role: 'editor' },
});
check(
  '۹. مدیر معمولی نمی‌تواند «مدیر کل» را تنزل دهد → ۴۰۳',
  attackDemoteSuper.status === 403,
);

const attackDisableSuper = await call('PUT', `/api/admin/users/${targetSuper.id}`, {
  ...sessionOf(adminLogin),
  body: { isActive: false },
});
check(
  '۹. مدیر معمولی نمی‌تواند «مدیر کل» را غیرفعال کند → ۴۰۳',
  attackDisableSuper.status === 403,
);

/* تصاحب حساب: عوض‌کردن رمز مدیر کل توسط مدیر معمولی */
const attackTakeover = await call('PUT', `/api/admin/users/${targetSuper.id}`, {
  ...sessionOf(adminLogin),
  body: { password: 'hijacked-password' },
});
check(
  '۹. مدیر معمولی نمی‌تواند رمز «مدیر کل» را عوض کند (تصاحب حساب) → ۴۰۳',
  attackTakeover.status === 403,
);

const superStillWorks = await login('0135', SUPER_PASSWORD);
check(
  '۹. رمز مدیر کل واقعاً عوض نشده است',
  superStillWorks.status === 200,
);

const attackDeleteSuper = await call('DELETE', `/api/admin/users/${targetSuper.id}`, sessionOf(adminLogin));
check(
  '۹. مدیر معمولی نمی‌تواند «مدیر کل» را حذف کند → ۴۰۳',
  attackDeleteSuper.status === 403,
);

/* مدیر معمولی مجوز users.delete ندارد، پس حذف هر حسابی بسته است */
const attackDeleteEditor = await call('DELETE', `/api/admin/users/${editorId}`, sessionOf(adminLogin));
check(
  '۹. مدیر معمولی مجوز users.delete ندارد → حذف هر حساب ۴۰۳',
  attackDeleteEditor.status === 403,
);

/* ───────────────────── ۱۰. آخرین مدیر کل محافظت‌شده ───────────────────── */

const selfDelete = await call('DELETE', `/api/admin/users/${superLogin.admin.id}`, sessionOf(superLogin));
check('۱۰. مدیر کل نمی‌تواند حساب خودش را حذف کند → ۴۰۹', selfDelete.status === 409);

const selfRoleChange = await call('PUT', `/api/admin/users/${superLogin.admin.id}`, {
  ...sessionOf(superLogin),
  body: { role: 'admin' },
});
check('۱۰. مدیر کل نمی‌تواند نقش خودش را از این مسیر عوض کند → ۴۰۳', selfRoleChange.status === 403);

/*
 * غیرفعال‌کردن خود: سیاست آگاهانه این است که «خودکشی حساب» تا وقتی مدیر کل
 * فعال دیگری وجود دارد مجاز است، ولی وقتی آخرین مدیر کل فعال باشی با invariant
 * «دست‌کم یک مدیر کل فعال» بسته می‌شود (۴۰۹ با پیام روشن).
 */
const selfDeactivate = await call('PUT', `/api/admin/users/${superLogin.admin.id}`, {
  ...sessionOf(superLogin),
  body: { isActive: false },
});
check(
  '۱۰. آخرین مدیر کل فعال نمی‌تواند خودش را غیرفعال کند → ۴۰۹ (invariant)',
  selfDeactivate.status === 409 && selfDeactivate.payload.error?.code === 'CONFLICT',
);

const stillActive = await call('GET', `/api/admin/users?search=0135`, sessionOf(superLogin));
check(
  '۱۰. حساب مدیر کل پس از تلاش ناموفق همچنان فعال است',
  stillActive.payload.data?.items?.[0]?.isActive === true,
);

/*
 * invariant «دست‌کم یک مدیر کل فعال باید بماند» با مسیر HTTP قابل رسیدن نیست
 * (فقط مدیر کل مجوز دارد و actor هم فعال است)، پس مستقیماً روی لایهٔ دامنه
 * سنجیده می‌شود — همان تابعی که Route صدا می‌زند.
 */
let lastAdminGuard = false;
try {
  deleteAdmin(superLogin.admin.id, { id: 'adm-inactive-actor', role: 'super-admin' });
} catch (error) {
  lastAdminGuard = error.code === 'CONFLICT';
}
check('۱۰. حذف آخرین مدیر کل فعال در لایهٔ دامنه ۴۰۹ می‌دهد', lastAdminGuard);

/* ───────────────────── ۱۱. Attack 7 — باطل‌شدن نشست ───────────────────── */

const victimUser = `p3-victim-${stamp}`;
const victim = await call('POST', '/api/admin/users', {
  ...sessionOf(superLogin),
  body: { username: victimUser, password: 'victim-pass', role: 'editor' },
});
const victimId = victim.payload.data?.admin?.id;
const victimSession = await login(victimUser, 'victim-pass');

const victimBefore = await call('GET', '/api/admin/meta', sessionOf(victimSession));
check('۱۱. نشست قربانی پیش از رویداد امنیتی کار می‌کند', victimBefore.status === 200);

await call('PUT', `/api/admin/users/${victimId}`, {
  ...sessionOf(superLogin), body: { role: 'admin' },
});
const victimAfterRoleChange = await call('GET', '/api/admin/meta', sessionOf(victimSession));
check(
  '۱۱. [Attack 7] تغییر نقش، نشست قبلی را باطل می‌کند → ۴۰۱',
  victimAfterRoleChange.status === 401,
);

const victimSession2 = await login(victimUser, 'victim-pass');
await call('PUT', `/api/admin/users/${victimId}`, {
  ...sessionOf(superLogin), body: { password: 'victim-new-pass' },
});
const victimAfterPasswordReset = await call('GET', '/api/admin/meta', sessionOf(victimSession2));
check(
  '۱۱. [Attack 7] تغییر رمز توسط مدیر دیگر، نشست قبلی را باطل می‌کند → ۴۰۱',
  victimAfterPasswordReset.status === 401,
);

const victimSession3 = await login(victimUser, 'victim-new-pass');
await call('DELETE', `/api/admin/users/${victimId}`, sessionOf(superLogin));
const victimAfterDelete = await call('GET', '/api/admin/meta', sessionOf(victimSession3));
check(
  '۱۱. [Attack 7] حذف حساب، نشست آن حساب را باطل می‌کند → ۴۰۱',
  victimAfterDelete.status === 401,
);

/* تغییر رمز توسط خودِ مدیر: نشست فعلی می‌ماند، نشست‌های دیگر می‌روند */
const otherDevice = await login(adminUser, ADMIN_PASSWORD);
const changeOwn = await call('POST', '/api/admin/auth/password', {
  ...sessionOf(adminLogin),
  body: { currentPassword: ADMIN_PASSWORD, nextPassword: 'p3-admin-pass-2' },
});
check('۱۱. مدیر می‌تواند رمز خودش را عوض کند', changeOwn.status === 200);

const currentSessionAlive = await call('GET', '/api/admin/meta', sessionOf(adminLogin));
check('۱۱. نشست فعلی پس از تغییر رمز زنده می‌ماند', currentSessionAlive.status === 200);

const otherSessionDead = await call('GET', '/api/admin/meta', sessionOf(otherDevice));
check('۱۱. نشست‌های دیگر همان حساب پس از تغییر رمز باطل می‌شوند', otherSessionDead.status === 401);

/* ───────────────────── ۱۲. Session Fixation ───────────────────── */

const fixationProbe = await call('POST', '/api/admin/auth/login', {
  cookies: { tapesh_admin_session: 'attacker-chosen-token' },
  body: { username: editorUser, password: EDITOR_PASSWORD },
});
const issuedToken = (fixationProbe.headers.get('set-cookie') ?? '').match(/tapesh_admin_session=([^;]+)/)?.[1] ?? '';
check(
  '۱۲. ورود همیشه توکن تازه می‌سازد و توکن انتخابی مهاجم را نمی‌پذیرد',
  fixationProbe.status === 200 && issuedToken && issuedToken !== 'attacker-chosen-token',
);
check(
  '۱۲. توکن جعلی پیش از ورود معتبر نیست',
  (await call('GET', '/api/admin/meta', { cookies: { tapesh_admin_session: 'attacker-chosen-token' } })).status === 401,
);

const secondLogin = await login(editorUser, EDITOR_PASSWORD);
check(
  '۱۲. دو ورود پیاپی توکن یکسان نمی‌دهند',
  secondLogin.token && secondLogin.token !== issuedToken,
);

/* ───────────────────── ۱۳. Logout ───────────────────── */

const logoutResponse = await call('POST', '/api/admin/auth/logout', sessionOf(secondLogin));
check(
  '۱۳. خروج، کوکی را با Max-Age=0 پاک می‌کند',
  logoutResponse.status === 200 && /Max-Age=0/.test(logoutResponse.headers.get('set-cookie') ?? ''),
);
check(
  '۱۳. پس از خروج، همان توکن دیگر کار نمی‌کند',
  (await call('GET', '/api/admin/meta', sessionOf(secondLogin))).status === 401,
);

/* ───────────────────── ۱۴. محافظت از brute force ───────────────────── */

const lockUser = `p3-lock-${stamp}`;
await call('POST', '/api/admin/users', {
  ...sessionOf(superLogin),
  body: { username: lockUser, password: 'lock-pass', role: 'editor' },
});

let lastStatus = 0;
for (let attempt = 0; attempt < 8; attempt += 1) {
  lastStatus = (await call('POST', '/api/admin/auth/login', {
    body: { username: lockUser, password: 'wrong' },
  })).status;
}
check('۱۴. تلاش‌های ناموفق زیر سقف، ۴۰۱ می‌دهند', lastStatus === 401);

const lockedOut = await call('POST', '/api/admin/auth/login', {
  body: { username: lockUser, password: 'lock-pass' },
});
check(
  '۱۴. پس از ۸ تلاش ناموفق، حتی رمز درست هم ۴۲۹ می‌گیرد (قفل server-side)',
  lockedOut.status === 429 && lockedOut.payload.error?.code === 'RATE_LIMITED',
);

const lockResponseBody = JSON.stringify(lockedOut.payload);
check(
  '۱۴. پاسخ قفل، وجود یا نبود نام کاربری را لو نمی‌دهد',
  !lockResponseBody.includes(lockUser) && lockedOut.payload.error?.code === 'RATE_LIMITED',
);

/* نام کاربری ناموجود هم همان مسیر را می‌رود — بدون افشای وجود حساب */
const missingUser = await call('POST', '/api/admin/auth/login', {
  body: { username: `p3-missing-${stamp}`, password: 'whatever' },
});
check(
  '۱۴. حساب ناموجود همان ۴۰۱ حساب موجود با رمز اشتباه را می‌دهد',
  missingUser.status === 401 && missingUser.payload.error?.code === 'INVALID_CREDENTIALS',
);

/* ───────────────────── ۱۵. اعتبارسنجی نقش ───────────────────── */

const badRole = await call('POST', '/api/admin/users', {
  ...sessionOf(superLogin),
  body: { username: `p3-badrole-${stamp}`, password: 'x1234', role: 'root' },
});
check('۱۵. نقش ناموجود رد می‌شود → ۴۰۰', badRole.status === 400);

const badRoleUpdate = await call('PUT', `/api/admin/users/${editorId}`, {
  ...sessionOf(superLogin), body: { role: 'root' },
});
check('۱۵. تغییر نقش به مقدار ناموجود رد می‌شود → ۴۰۰', badRoleUpdate.status === 400);

/* ───────────────────── ۱۶. deny-by-default در عمل ───────────────────── */

const editorOnLogs = await call('GET', '/api/admin/logs', sessionOf(editorLogin));
check('۱۶. نقش نویسنده به گزارش رویدادها دسترسی ندارد → ۴۰۳', editorOnLogs.status === 403);

const editorOnUsers = await call('GET', '/api/admin/users', sessionOf(editorLogin));
check('۱۶. نقش نویسنده به مدیریت کاربران دسترسی ندارد → ۴۰۳', editorOnUsers.status === 403);

const editorOnSettingsWrite = await call('PUT', '/api/admin/settings', {
  ...sessionOf(editorLogin), body: { siteName: 'تپش' },
});
check('۱۶. نقش نویسنده نمی‌تواند تنظیمات را بنویسد → ۴۰۳', editorOnSettingsWrite.status === 403);

const editorOnMeta = await call('GET', '/api/admin/meta', sessionOf(editorLogin));
check(
  '۱۶. مسیر «فقط ورود لازم است» (meta) برای نقش‌های دیگر باز است',
  editorOnMeta.status === 200 && Array.isArray(editorOnMeta.payload.data?.permissions),
);

/* ───────────────────── ۱۷. متد اشتباه، تغییر ایجاد نمی‌کند ───────────────────── */

const wrongMethod = await call('POST', '/api/admin/stats', { ...sessionOf(superLogin), body: {} });
check('۱۷. متد اشتباه روی مسیر خواندنی رد می‌شود', wrongMethod.status >= 400);

const patchProbe = await call('PATCH', '/api/admin/settings', {
  ...sessionOf(superLogin), body: { siteName: 'hacked' },
});
const settingsAfterPatch = await call('GET', '/api/admin/settings', sessionOf(superLogin));
check(
  '۱۷. PATCH روی مسیر PUT چیزی تغییر نمی‌دهد',
  patchProbe.status >= 400 && settingsAfterPatch.payload.data?.settings?.siteName === 'تپش',
);

/* ───────────────────── ۱۸. CORS محدود می‌ماند ───────────────────── */

const corsProbe = await call('GET', '/api/admin/meta', sessionOf(superLogin));
check(
  '۱۸. هیچ هدر Access-Control-Allow-Origin صادر نمی‌شود',
  !corsProbe.headers.has('access-control-allow-origin'),
);

/* ───────────────────── ۱۹. افشا نکردن جزئیات در خطا ───────────────────── */

const forbiddenBody = JSON.stringify(attackCreateSuper.payload);
check(
  '۱۹. بدنهٔ ۴۰۳ فقط code/message دارد و stack یا مسیر فایل ندارد',
  !/stack|at Object\.|\.js:\d+|\/Users\//.test(forbiddenBody),
);

const notFoundBody = JSON.stringify((await call('GET', '/api/admin/nope', sessionOf(superLogin))).payload);
check(
  '۱۹. بدنهٔ ۴۰۴ جزئیات داخلی بیرون نمی‌دهد',
  !/stack|at Object\.|\.js:\d+|\/Users\//.test(notFoundBody),
);

/* ───────────────────── پاک‌سازی ───────────────────── */

const cleanupUsers = [adminId, editorId, `p3-inject-${stamp}`, lockUser].filter(Boolean);
for (const id of cleanupUsers) {
  await call('DELETE', `/api/admin/users/${id}`, sessionOf(superLogin));
}

/* فایل‌های ساخته‌شدهٔ آزمایشی رسانه (اگر تست آپلود چیزی ساخت) */
const leftoverMedia = JSON.parse(readFileSync(paths[4], 'utf8') || '[]');
for (const item of leftoverMedia) {
  if (typeof item.originalName === 'string' && item.originalName.startsWith('p3-test-')) {
    const target = fileURLToPath(new URL(`../public/uploads/${item.filename}`, import.meta.url));
    if (existsSync(target)) unlinkSync(target);
  }
}

restoreContent();

console.log('\nنتیجهٔ تست RBAC و مرز ارتقای سطح دسترسی پنل (PHASE 3 — بخش ۱):');
results.forEach((row) => console.log(`  ${row.pass ? '✓' : '✗'} ${row.name}`));
const passed = results.filter((row) => row.pass).length;
console.log(`\n${passed}/${results.length} سنجه موفق\n`);

if (passed !== results.length) process.exitCode = 1;
