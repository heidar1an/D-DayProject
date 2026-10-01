/*
 * تست‌های مشاهده‌پذیری — فاز ۱۰ (پیشنهادی): لاگ دسترسی، متریک، سلامت/آمادگی.
 *
 * اجرا: `npm run obs:test`  (یا `node --test database/observability.test.mjs`)
 *
 * اصل همان اصل `apiContract.test.mjs` است: هر سنجه یا خروجی زندهٔ ماژول را
 * می‌سنجد یا یک مقدار ثابت را که شاهدش در کامنت آمده. هیچ انتظاری از حدس
 * ساخته نشده. سنجه‌های ۱۲ به بعد روی **سرور واقعی** اجرا می‌شوند (spawn + fetch)
 * تا ادعای «لاگ می‌شود» و «۴۰۴ می‌دهد» با رفتار واقعی HTTP اثبات شود.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { connect, createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REDACTED,
  accessLogEnabled,
  accessLogLine,
  checkReadiness,
  createMetrics,
  isMetricsAuthorized,
  metricsTokenFromEnv,
  safePathname,
} from './observability.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const METRICS_TOKEN = 'test-metrics-token-2f7c1a';

/* ───────────────────────── ۱. حذف دادهٔ حساس از مسیر ───────────────────────── */

test('۱. مسیر با شمارهٔ تلفن، ایمیل و توکن بلند حذف‌شده لاگ می‌شود', () => {
  assert.equal(safePathname('/api/users/09123456789'), `/api/users/${REDACTED}`);
  assert.equal(safePathname('/reset/989123456789'), `/reset/${REDACTED}`);
  assert.equal(safePathname('/verify/user@example.com'), `/verify/${REDACTED}`);
  assert.equal(
    safePathname('/handoff/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd'),
    `/handoff/${REDACTED}`,
  );
});

test('۲. مسیرهای عادی دست‌نخورده می‌مانند (بیش‌حذفیِ کاذب نداریم)', () => {
  for (const path of [
    '/',
    '/healthz',
    '/readyz',
    '/metrics',
    '/api/users/me',
    '/api/public/articles',
    '/api/admin/content/articles/42',
    '/assets/index-CE3tjnht.js',
    '/uploads/intl/lesson-1.mp4',
  ]) {
    assert.equal(safePathname(path), path);
  }
});

test('۳. query و hash هرگز وارد مسیر لاگ نمی‌شوند', () => {
  assert.equal(safePathname('/api/users/me?phone=09123456789'), '/api/users/me');
  assert.equal(safePathname('/auth?token=secret#frag'), '/auth');
  assert.equal(safePathname('/login?next=%2F%23admin'), '/login');
});

test('۴. مسیر بلندتر از سقف بریده می‌شود (لاگ با مسیر جعلی پر نمی‌شود)', () => {
  const long = `/${Array.from({ length: 200 }, () => 'seg').join('/')}`;
  assert.equal(long.length > 200, true);
  assert.equal(safePathname(long).length, 200);
});

/* ───────────────────────────── ۵. خط لاگ دسترسی ───────────────────────────── */

test('۵. خط لاگ JSON معتبر است و فقط فیلدهای مجاز را دارد', () => {
  const line = accessLogLine({
    requestId: 'req-1',
    method: 'get',
    path: '/api/users/me?phone=09123456789',
    status: 200,
    durationMs: 12.6,
  });

  const parsed = JSON.parse(line);
  assert.deepEqual(Object.keys(parsed).sort(), ['kind', 'method', 'ms', 'path', 'reqId', 'status', 't']);
  assert.equal(parsed.kind, 'http');
  assert.equal(parsed.method, 'GET');
  assert.equal(parsed.path, '/api/users/me');
  assert.equal(parsed.status, 200);
  assert.equal(parsed.ms, 13);
});

test('۶. خط لاگ هیچ PII یا اعتبارنامه‌ای حمل نمی‌کند', () => {
  const line = accessLogLine({
    method: 'POST',
    path: '/api/users/login',
    status: 401,
    durationMs: 3,
  });

  /* شاهد: فهرست ممنوعه از قواعد محرمانگی همین ماژول — نه حدس */
  for (const forbidden of ['ip', 'ipAddress', 'userAgent', 'cookie', 'authorization', 'password', 'token', 'phone', 'body']) {
    assert.equal(line.includes(forbidden), false, `«${forbidden}» نباید در خط لاگ باشد`);
  }
  assert.equal(line.includes('?'), false);
});

test('۷. کد خطا فقط وقتی حاضر است که مقدار داشته باشد', () => {
  assert.equal('errorCode' in JSON.parse(accessLogLine({ path: '/x', status: 500 })), false);
  assert.equal(JSON.parse(accessLogLine({ path: '/x', status: 500, errorCode: 'INTERNAL_ERROR' })).errorCode, 'INTERNAL_ERROR');
});

test('۸. کلید لاگ دسترسی پیش‌فرض روشن است و با ۰/off خاموش می‌شود', () => {
  assert.equal(accessLogEnabled({}), true);
  assert.equal(accessLogEnabled({ TAPESH_ACCESS_LOG: '1' }), true);
  for (const off of ['0', 'false', 'off', 'no', 'OFF']) {
    assert.equal(accessLogEnabled({ TAPESH_ACCESS_LOG: off }), false);
  }
});

/* ─────────────────────────────── ۹. متریک ─────────────────────────────── */

test('۹. متریک شمارش، کلاس وضعیت، متد و تأخیر را درست جمع می‌زند', () => {
  const metrics = createMetrics();
  metrics.record({ method: 'GET', path: '/a', status: 200, durationMs: 10 });
  metrics.record({ method: 'get', path: '/a', status: 404, durationMs: 20 });
  metrics.record({ method: 'POST', path: '/b', status: 500, durationMs: 30 });
  metrics.record({ method: 'GET', path: '/c', status: 301, durationMs: 0 });

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.requests.total, 4);
  assert.equal(snapshot.requests.errors, 2);
  assert.deepEqual(snapshot.requests.byStatusClass, { '1xx': 0, '2xx': 1, '3xx': 1, '4xx': 1, '5xx': 1, other: 0 });
  assert.deepEqual(snapshot.requests.byMethod, { GET: 3, POST: 1 });
  assert.equal(snapshot.latencyMs.max, 30);
  assert.equal(snapshot.latencyMs.avg, 15);
  assert.deepEqual(snapshot.topPaths, [{ path: '/a', count: 2 }, { path: '/b', count: 1 }, { path: '/c', count: 1 }]);
});

test('۱۰. حافظهٔ متریک سقف دارد: مسیرهای یکتا و خطاها بی‌مرز رشد نمی‌کنند', () => {
  const metrics = createMetrics({ maxPaths: 10, maxRecentErrors: 3 });

  for (let index = 0; index < 100; index += 1) {
    metrics.record({ method: 'GET', path: `/unique-${index}`, status: 500, durationMs: 1 });
  }

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.requests.total, 100);
  assert.equal(snapshot.topPaths.length, 10);
  assert.equal(snapshot.droppedPathKeys, 90);
  assert.equal(snapshot.recentErrors.length, 3);
  assert.equal(snapshot.recentErrors.at(-1).path, '/unique-99');
});

test('۱۱. مسیر حساس پیش از ذخیره در متریک حذف می‌شود، نه فقط هنگام چاپ', () => {
  const metrics = createMetrics();
  metrics.record({ method: 'GET', path: '/api/users/09123456789', status: 200, durationMs: 1 });

  const serialized = JSON.stringify(metrics.snapshot());
  assert.equal(serialized.includes('09123456789'), false);
  assert.equal(metrics.snapshot().topPaths[0].path, `/api/users/${REDACTED}`);
});

/* ────────────────────── ۱۲. توکن متریک (write-only) ────────────────────── */

test('۱۲. توکن متریک فقط از محیط می‌آید و مقایسه‌اش ثابت‌زمان است', () => {
  assert.equal(metricsTokenFromEnv({}), '');
  assert.equal(metricsTokenFromEnv({ TAPESH_METRICS_TOKEN: '  abc  ' }), 'abc');

  assert.equal(isMetricsAuthorized('Bearer abc', ''), false, 'توکن خالی هرگز مجاز نمی‌کند');
  assert.equal(isMetricsAuthorized(undefined, 'abc'), false);
  assert.equal(isMetricsAuthorized('abc', 'abc'), false, 'بدون پیشوند Bearer');
  assert.equal(isMetricsAuthorized('Basic abc', 'abc'), false);
  assert.equal(isMetricsAuthorized('Bearer abcd', 'abc'), false, 'طول نابرابر');
  assert.equal(isMetricsAuthorized('Bearer abd', 'abc'), false, 'محتوای نابرابر');
  assert.equal(isMetricsAuthorized('Bearer abc', 'abc'), true);
});

/* ──────────────────────── ۱۳. سلامت و آمادگی ──────────────────────── */

test('۱۳. readiness با دیسک واقعی پروژه «آماده» است', () => {
  const report = checkReadiness({ distDir: resolve(ROOT, 'dist'), dataDir: resolve(ROOT, 'database') });
  assert.equal(report.ready, true);
  assert.deepEqual(report.checks.map((check) => check.name), ['data-writable', 'build-artifact', 'model-registry']);
  assert.equal(report.checks.every((check) => check.ok), true);
  /* شاهد: شمار مدل‌ها از خودِ رجیستری خوانده می‌شود، نه عدد ثابت در تست */
  assert.match(report.checks.at(-1).detail, /^\d+ مدل$/);
});

test('۱۴. نبودِ artifact بیلد ⇒ آماده نیست، ولی مدل داده سالم گزارش می‌شود', () => {
  const report = checkReadiness({ distDir: resolve(ROOT, 'dist-وجود-ندارد'), dataDir: resolve(ROOT, 'database') });
  assert.equal(report.ready, false);
  assert.equal(report.checks.find((check) => check.name === 'build-artifact').ok, false);
  assert.equal(report.checks.find((check) => check.name === 'data-writable').ok, true);
  assert.equal(report.checks.find((check) => check.name === 'model-registry').ok, true);
});

test('۱۵. پوشهٔ دادهٔ نانوشتنی ⇒ آماده نیست (آمادگی، خودش چیزی نمی‌نویسد)', () => {
  const report = checkReadiness({ distDir: resolve(ROOT, 'dist'), dataDir: '/proc/self/nope' });
  assert.equal(report.ready, false);
  assert.equal(report.checks.find((check) => check.name === 'data-writable').ok, false);
});

/* ─────────────────── ۱۶. سرور واقعی: سلامت/آمادگی/متریک/لاگ ─────────────────── */

function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.on('error', rejectPort);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

/* درخواست خام روی سوکت — چون `fetch` مسیر بدشکل (`/%ZZ`) را همان‌جا رد می‌کند */
function rawRequest(port, raw) {
  return new Promise((resolveRaw, rejectRaw) => {
    const socket = connect(port, '127.0.0.1', () => socket.write(raw));
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => { buffer += chunk; });
    socket.on('end', () => resolveRaw(buffer));
    socket.on('error', rejectRaw);
  });
}

async function waitForHealth(baseUrl, deadlineMs = 45_000) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return true;
    } catch {
      /* سرور هنوز بالا نیامده */
    }
    await new Promise((tick) => setTimeout(tick, 250));
  }
  return false;
}

test('۱۶. سرور واقعی: healthz/readyz/metrics و لاگ بدون نشت (smoke)', async (t) => {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      TAPESH_METRICS_TOKEN: METRICS_TOKEN,
      TAPESH_ACCESS_LOG: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });

  t.after(() => {
    if (!child.killed) child.kill('SIGTERM');
  });

  assert.equal(await waitForHealth(baseUrl), true, 'سرور در مهلت مقرر بالا نیامد');

  /* liveness */
  const health = await fetch(`${baseUrl}/healthz`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('x-request-id')?.length > 0, true, 'X-Request-Id باید ست شود');
  assert.equal((await health.json()).status, 'ok');

  /* readiness */
  const ready = await fetch(`${baseUrl}/readyz`);
  assert.equal(ready.status, 200);
  const readyBody = await ready.json();
  assert.equal(readyBody.ready, true);
  assert.deepEqual(readyBody.checks.map((check) => check.name), ['data-writable', 'build-artifact', 'model-registry']);

  /* متد نادرست روی مسیر سلامت */
  const wrongMethod = await fetch(`${baseUrl}/healthz`, { method: 'POST' });
  assert.equal(wrongMethod.status, 405);

  /* متریک: بدون توکن و با توکن غلط ⇒ ۴۰۴ (وجود مسیر لو نمی‌رود) */
  assert.equal((await fetch(`${baseUrl}/metrics`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/metrics`, { headers: { Authorization: 'Bearer wrong-token' } })).status, 404);
  assert.equal((await fetch(`${baseUrl}/metrics`, { headers: { Authorization: METRICS_TOKEN } })).status, 404, 'بدون پیشوند Bearer');

  /* متریک با توکن درست */
  const metricsResponse = await fetch(`${baseUrl}/metrics`, { headers: { Authorization: `Bearer ${METRICS_TOKEN}` } });
  assert.equal(metricsResponse.status, 200);
  const metricsBody = await metricsResponse.json();
  assert.equal(metricsBody.requests.total >= 6, true, `شمار درخواست‌ها: ${metricsBody.requests.total}`);
  assert.equal(metricsBody.requests.byStatusClass['2xx'] >= 2, true);
  assert.equal(metricsBody.requests.byStatusClass['4xx'] >= 4, true);

  /* درخواست با شمارهٔ تلفن در query — نباید هیچ‌جا روی stdout بیفتد */
  await fetch(`${baseUrl}/api/users/me?phone=09123456789&token=leaky-secret-value`);

  /*
   * رفتار پیشین سرور دست‌نخورده مانده است (قفل رگرسیون):
   *   • مسیر بدون پسوند ⇒ SPA fallback ⇒ index.html با ۲۰۰
   *   • مسیر با پسوندِ ناشناس ⇒ ۴۰۴
   * مسیرهای سلامت این ترتیب را عوض نکرده‌اند.
   */
  assert.equal((await fetch(`${baseUrl}/definitely-not-a-route`)).status, 200, 'SPA fallback');
  assert.equal((await fetch(`${baseUrl}/definitely-not-a-route.json`)).status, 404, 'دارایی ناموجود');

  /*
   * مسیر بدشکل (`%ZZ`) نباید پروسه را بکشد. پیش از این تغییر هم ۵۰۰ با مدل خطا
   * برمی‌گشت؛ اینجا همان رفتار قفل می‌شود چون حالا یک listener لاگ هم به پاسخ
   * وصل است و اگر استثنا بیرون می‌زد، به‌جای ۵۰۰ پروسه می‌مرد.
   */
  const malformed = await rawRequest(port, 'GET /%ZZ HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
  assert.equal(malformed.startsWith('HTTP/1.1 500'), true, malformed.split('\r\n')[0]);
  assert.equal(malformed.includes('INTERNAL_ERROR'), true);

  /* سرور پس از مسیر بدشکل همچنان جواب می‌دهد (زنده است) */
  assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);

  await new Promise((tick) => setTimeout(tick, 300));

  const httpLines = stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.kind === 'http');

  assert.equal(httpLines.length >= 8, true, `شمار خطوط لاگ: ${httpLines.length}`);

  /* هر خط باید شکل بستهٔ مجاز را داشته باشد */
  for (const entry of httpLines) {
    assert.equal(typeof entry.method, 'string');
    assert.equal(entry.path.startsWith('/'), true);
    assert.equal(entry.path.includes('?'), false);
  }

  /* هیچ PII/اعتبارنامه‌ای نباید بیرون افتاده باشد */
  assert.equal(stdout.includes('09123456789'), false, 'شمارهٔ تلفن در لاگ افتاده است');
  assert.equal(stdout.includes('leaky-secret-value'), false, 'توکن query در لاگ افتاده است');

  /* همان درخواست باید با مسیر تمیزش ثبت شده باشد */
  assert.equal(httpLines.some((entry) => entry.path === '/api/users/me' && entry.status >= 400), true);
  assert.equal(httpLines.some((entry) => entry.path === '/healthz' && entry.status === 200), true);
  assert.equal(httpLines.some((entry) => entry.path === '/metrics' && entry.status === 404), true);

  /* همان درخواست‌ها در متریک هم با مسیر تمیز دیده می‌شوند */
  assert.equal(JSON.stringify(metricsBody).includes('09123456789'), false);
});

/* ─────────── ۱۷. قفل ناواردایی: سورس ماژول هیچ لاگ حساسی نمی‌سازد ─────────── */

test('۱۷. سورس ماژول هرگز هدر یا کوکی را لاگ نمی‌کند (قفل رگرسیون)', () => {
  const source = readFileSync(resolve(ROOT, 'database/observability.js'), 'utf8');

  for (const forbidden of ['request.headers', 'headers.cookie', 'user-agent', 'remoteAddress', 'request.url']) {
    assert.equal(source.includes(forbidden), false, `«${forbidden}» نباید در ماژول مشاهده‌پذیری باشد`);
  }

  /* شاهد: query فقط در `safePathname` بریده می‌شود — تنها یک محل */
  assert.equal(source.split("split('?')").length - 1, 1);
});
