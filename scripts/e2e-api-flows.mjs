/*
 * E2E سطح API — بدون مرورگر و بدون build.
 *
 * چرا وجود دارد: فاز ۲۳.۱ «جریان‌های حیاتی end-to-end» را می‌خواهد و ابزار E2E
 * مرورگری نصب نیست. این ابزار بخشی که واقعاً قابل‌سنجش است را می‌پوشاند: سرور
 * واقعی بالا می‌آید و **رفتار مرزی و مسیرهای شکست** با کلاینت HTTP خودِ نود
 * سنجیده می‌شود — نه مسیرهای خوش‌بینانهٔ UI.
 *
 * آنچه می‌سنجد:
 *   • زنجیرهٔ راه‌اندازی: spawn ⇒ `/healthz` ⇒ `/readyz` ⇒ آماده‌بودن
 *   • SPA fallback (۲۰۰) در برابر asset ناشناس (۴۰۴)
 *   • مرزهای احراز هویت: `/api/users/me` · `/api/admin/*` بدون نشست ⇒ ۴۰۱
 *   • مسیر ناموجود admin بدون نشست ⇒ ۴۰۴ (وجود مسیر پیش از auth سنجیده می‌شود ⇒
 *     enumeration در سطح مسیر؛ یافتهٔ LOW، رفتار فعلی قفل می‌شود)
 *   • CSRF: `assertSameOrigin` — نبود `Origin` روی مسیر state-changing ⇒ ۴۰۳
 *   • اعتبارسنجی ورودی: `Content-Type` نادرست ⇒ ۴۱۵ · JSON نامعتبر ⇒ ۴۰۰
 *   • عدم شمارش حساب: شمارهٔ ناموجود ⇒ `INVALID_CREDENTIALS` نه `USER_NOT_FOUND`
 *   • سقف بدنه: بدنهٔ >۱MB ⇒ رد (۴۱۳ یا قطع اتصال)، هرگز ۲۰۰
 *   • Rate limit: تلاش‌های پیاپی روی یک شناسه ⇒ ۴۲۹ با `Retry-After`
 *   • liveness مستقل از rate limit: `/healthz` پس از ۴۲۹ هم ۲۰۰
 *   • عدم افشا: هیچ بدنهٔ خطایی `stack`، مسیر مطلق یا `node_modules` ندارد
 *   • `X-Request-Id` روی هر پاسخ
 *
 * قید: هیچ دادهٔ کاربری نوشته نمی‌شود — همهٔ درخواست‌ها رد می‌شوند، پس هیچ
 * رکوردی در `database/users.json` یا `users.sessions.json` اضافه نمی‌گردد.
 *
 * اجرا: `node scripts/e2e-api-flows.mjs`
 */

import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PORT = 4900 + (process.pid % 90);
const METRICS_TOKEN = 'e2e-token-local';
const ORIGIN = `http://127.0.0.1:${PORT}`;

const results = [];
let failures = 0;
let requestIdMissing = 0;
let responsesSeen = 0;

function check(name, ok, detail = '') {
  results.push(`${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function call(path, { headers = {}, method = 'GET', body = null } = {}) {
  return new Promise((done) => {
    const payload = body === null ? null : Buffer.from(body);
    const finalHeaders = { ...headers };
    if (payload) finalHeaders['content-length'] = String(payload.length);

    const req = request(
      { host: '127.0.0.1', port: PORT, path, method, headers: finalHeaders, timeout: 5000 },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => {
          responsesSeen += 1;
          if (!res.headers['x-request-id']) requestIdMissing += 1;
          done({ status: res.statusCode, headers: res.headers, body: text, error: null });
        });
      },
    );
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (error) => done({ status: 0, headers: {}, body: '', error }));
    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const json = (body) => ({
  'content-type': 'application/json',
  origin: ORIGIN,
  ...body,
});

/* ───────────────────────── راه‌اندازی سرور ───────────────────────── */

const child = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    TAPESH_METRICS_TOKEN: METRICS_TOKEN,
    TAPESH_ACCESS_LOG: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
child.stdout.on('data', (chunk) => { serverLog += chunk; });
child.stderr.on('data', (chunk) => { serverLog += chunk; });

function shutdown() {
  try { child.kill('SIGTERM'); } catch { /* بی‌اثر */ }
}

let up = false;
for (let i = 0; i < 60; i += 1) {
  const probe = await call('/healthz');
  if (probe.status === 200) { up = true; break; }
  await sleep(250);
}

if (!up) {
  console.log('✗ سرور در ۱۵ ثانیه بالا نیامد.');
  console.log(serverLog.slice(-1200));
  shutdown();
  process.exit(1);
}

/* ───────────────────────── ۱. راه‌اندازی و سلامت ───────────────────────── */

const healthz = await call('/healthz');
check('/healthz ⇒ ۲۰۰', healthz.status === 200, `status=${healthz.status}`);
check('/healthz بدنه status:ok دارد', /"status"\s*:\s*"ok"/.test(healthz.body));

const readyz = await call('/readyz');
check('/readyz ⇒ ۲۰۰', readyz.status === 200, `status=${readyz.status}`);
check('/readyz گزارش checks دارد', /"checks"/.test(readyz.body));

const apiHealth = await call('/api/health');
check('/api/health بدون احراز هویت ⇒ ۲۰۰', apiHealth.status === 200);
let apiHealthKeys = [];
try { apiHealthKeys = Object.keys(JSON.parse(apiHealth.body)); } catch { /* بدنهٔ نامعتبر */ }
check(
  '/api/health فقط status و uptimeSeconds برمی‌گرداند (بدون افشا)',
  apiHealthKeys.length === 2 && apiHealthKeys.includes('status') && apiHealthKeys.includes('uptimeSeconds'),
  apiHealthKeys.join(','),
);

const postHealth = await call('/api/health', { method: 'POST' });
check('POST /api/health ⇒ ۴۰۵', postHealth.status === 405, `status=${postHealth.status}`);

/* ───────────────────────── ۲. مسیریابی ایستا ───────────────────────── */

const spa = await call('/deep/unknown/client/route');
check(
  'مسیر بدون پسوند (SPA fallback) ⇒ ۲۰۰',
  spa.status === 200 && /<div id="root"|<!doctype html/i.test(spa.body),
  `status=${spa.status}`,
);

const asset = await call('/nope-xyz-not-an-asset.js');
check('asset ناشناس با پسوند ⇒ ۴۰۴', asset.status === 404, `status=${asset.status}`);

/* ───────────────────────── ۳. مرزهای احراز هویت ───────────────────────── */

const me = await call('/api/users/me');
check('/api/users/me بدون نشست ⇒ ۴۰۱', me.status === 401, `status=${me.status}`);

const adminStats = await call('/api/admin/stats');
check('/api/admin/stats بدون نشست ⇒ ۴۰۱', adminStats.status === 401, `status=${adminStats.status}`);

const adminGhost = await call('/api/admin/definitely-not-a-route');
check(
  'admin مسیر ناموجود بدون نشست ⇒ ۴۰۴ — وجود مسیر پیش از احراز هویت سنجیده می‌شود (enumeration در سطح مسیر · یافتهٔ LOW)',
  adminGhost.status === 404,
  `status=${adminGhost.status}`,
);

/* ───────────────────────── ۴. CSRF ───────────────────────── */

const logoutNoOrigin = await call('/api/users/logout', { method: 'POST' });
check(
  'POST /api/users/logout بدون Origin ⇒ ۴۰۳ (CSRF)',
  logoutNoOrigin.status === 403,
  `status=${logoutNoOrigin.status}`,
);

const loginNoOrigin = await call('/api/users/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ phone: '09000000000', password: 'x' }),
});
check(
  'POST /api/users/login بدون Origin ⇒ ۴۰۳ (CSRF)',
  loginNoOrigin.status === 403,
  `status=${loginNoOrigin.status}`,
);

/* ───────────────────────── ۵. اعتبارسنجی ورودی ───────────────────────── */

const wrongType = await call('/api/users/login', {
  method: 'POST',
  headers: { 'content-type': 'text/plain', origin: ORIGIN },
  body: 'not json at all',
});
check(
  'Content-Type غیر JSON ⇒ ۴۱۵',
  wrongType.status === 415,
  `status=${wrongType.status}`,
);

const malformed = await call('/api/users/login', {
  method: 'POST',
  headers: json({}),
  body: '{"phone": "0900", ',
});
check(
  'JSON نامعتبر ⇒ ۴۰۰ (نه ۵۰۰)',
  malformed.status === 400,
  `status=${malformed.status}`,
);

const ghostLogin = await call('/api/users/login', {
  method: 'POST',
  headers: json({}),
  body: JSON.stringify({ phone: '09999999999', password: 'WrongPassword123' }),
});
check(
  'شمارهٔ ناموجود ⇒ ۴۰۱',
  ghostLogin.status === 401,
  `status=${ghostLogin.status}`,
);
check(
  'عدم شمارش حساب: کد خطا INVALID_CREDENTIALS است نه USER_NOT_FOUND',
  /INVALID_CREDENTIALS/.test(ghostLogin.body) && !/USER_NOT_FOUND/.test(ghostLogin.body),
  ghostLogin.body.slice(0, 120),
);

/* ───────────────────────── ۶. سقف بدنه ───────────────────────── */

const oversize = await call('/api/users/login', {
  method: 'POST',
  headers: json({}),
  body: JSON.stringify({ phone: '09120000000', password: 'x'.repeat(1_200_000) }),
});
check(
  'بدنهٔ >۱MB رد می‌شود (۴۱۳ یا قطع اتصال) و هرگز ۲۰۰ نیست',
  oversize.status === 413 || oversize.status === 0,
  oversize.status === 0 ? `اتصال قطع شد: ${oversize.error?.code ?? 'unknown'}` : `status=${oversize.status}`,
);

/* ───────────────────────── ۷. Rate limit ───────────────────────── */

const target = '09121110000';
let last = null;
let saw429 = false;
for (let i = 0; i < 10; i += 1) {
  last = await call('/api/users/login', {
    method: 'POST',
    headers: json({}),
    body: JSON.stringify({ phone: target, password: 'WrongPassword123' }),
  });
  if (last.status === 429) { saw429 = true; break; }
}
check('تلاش‌های پیاپی روی یک شناسه ⇒ ۴۲۹', saw429, `آخرین status=${last?.status}`);
check(
  'پاسخ ۴۲۹ هدر Retry-After دارد',
  saw429 && Boolean(last.headers['retry-after']),
  saw429 ? `Retry-After=${last.headers['retry-after']}` : 'به ۴۲۹ نرسید',
);

const healthAfter = await call('/healthz');
check(
  'liveness پس از ۴۲۹ هم ۲۰۰ است (مستقل از rate limit)',
  healthAfter.status === 200,
  `status=${healthAfter.status}`,
);

/* ───────────────────────── ۸. قرارداد خطا و عدم افشا ───────────────────────── */

const bodies = [ghostLogin, adminStats, malformed, logoutNoOrigin, ghostLogin];
const leaked = bodies.filter((r) => /at\s+\w+\s+\(|node_modules|\/Users\/|\bstack\b/i.test(r.body));
check('هیچ بدنهٔ خطایی stack/مسیر مطلق/node_modules ندارد', leaked.length === 0,
  leaked.length ? leaked[0].body.slice(0, 160) : '');

check(
  'شکل خطای admin: {success:false, error:{code,…}}',
  (() => {
    try {
      const parsed = JSON.parse(adminStats.body);
      return parsed.success === false && typeof parsed.error?.code === 'string';
    } catch { return false; }
  })(),
  adminStats.body.slice(0, 120),
);

const usersGhost = await call('/api/users/definitely-not-a-route');
check(
  'شکل خطای users ناهمگون است: {error:"CODE"} در ریشه (مستندشده، تغییرش breaking)',
  usersGhost.status === 404 && /"error"\s*:\s*"NOT_FOUND"/.test(usersGhost.body),
  `status=${usersGhost.status} body=${usersGhost.body.slice(0, 80)}`,
);

const lookup = await call('/api/users?phone=09121110000');
check(
  'هیچ مسیر lookup عمومی وجود ندارد: GET /api/users?phone=… ⇒ ۴۰۴',
  lookup.status === 404,
  `status=${lookup.status}`,
);

check(
  'X-Request-Id روی هر پاسخ دیده‌شده حاضر است',
  requestIdMissing === 0,
  `${responsesSeen} پاسخ · ${requestIdMissing} بدون هدر`,
);

/* ───────────────────────── گزارش ───────────────────────── */

shutdown();
await sleep(150);

console.log('══ E2E سطح API — تپش ══\n');
console.log(results.join('\n'));
console.log(`\nنتیجه: ${results.length - failures}/${results.length} موفق · ${failures} شکست`);
process.exitCode = failures ? 1 : 0;
