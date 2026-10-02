/*
 * Smoke test زمان اجرا برای `server.js` — بدون مرورگر و بدون build.
 *
 * چرا وجود دارد: ادعاهای فاز ۱۴ (health/readiness، مرزهای احراز هویت،
 * redaction لاگ) تا وقتی سرور واقعاً بالا نیامده و درخواست واقعی نگیرد،
 * «مستند» هستند نه «تأییدشده». این ابزار سرور را به‌عنوان پروسهٔ فرزند بالا
 * می‌آورد، با کلاینت HTTP خودِ نود (بدون curl و بدون proxy محیطی) به آن
 * درخواست می‌زند و در پایان نتیجه را با کد خروج گزارش می‌کند.
 *
 * آنچه می‌سنجد:
 *   • `/healthz` ⇒ ۲۰۰ و `status: 'ok'` (liveness، نباید به داده وابسته باشد)
 *   • `/api/health` ⇒ همان liveness روی مسیر عمومی استاندارد؛ بدون احراز هویت،
 *     بدون افشای مسیر/نسخه/stack، و `POST` روی آن ۴۰۵ می‌دهد
 *   • `/readyz`  ⇒ ۲۰۰ با گزارش `checks` (data-writable · uploads-writable · build-artifact · model-registry)
 *   • `/metrics` ⇒ بدون توکن و با توکن غلط **۴۰۴** (نه ۴۰۳)؛ با توکن درست ۲۰۰
 *   • `/api/users/me` و `/api/admin/summary` بدون احراز هویت ⇒ ۴۰۱
 *   • `X-Request-Id` روی هر پاسخ
 *   • لاگ دسترسی: شامل `requestId` است و شمارهٔ تلفنِ داخل مسیر را لو نمی‌دهد
 *
 * اجرا: `node scripts/server-smoke.mjs`
 */

import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PORT = 4700 + (process.pid % 200);
const METRICS_TOKEN = 'smoke-token-local';
const PHONE = '09121234567';

const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push(`${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function probe(path, { headers = {}, method = 'GET' } = {}) {
  return new Promise((done) => {
    const req = request(
      { host: '127.0.0.1', port: PORT, path, method, headers, timeout: 4000 },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => done({ status: res.statusCode, headers: res.headers, body }));
      },
    );
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (error) => done({ status: 0, headers: {}, body: '', error }));
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), TAPESH_METRICS_TOKEN: METRICS_TOKEN, TAPESH_ACCESS_LOG: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
child.stdout.on('data', (chunk) => { serverLog += chunk; });
child.stderr.on('data', (chunk) => { serverLog += chunk; });

/*
 * پنجرهٔ آمادگی.
 *
 * ⚠️ چرا از ۱۰ ثانیه به ۳۰ ثانیه رفت (یافتهٔ واقعی دروازه): `server.js` کل لایهٔ
 * داده را در سطح ماژول import می‌کند (`adminApi` → `contentStore` → رجیستری مدل)،
 * پس راه‌اندازی روی همین ماشین **~۸ ثانیه** طول می‌کشد. پنجرهٔ قبلی
 * (۴۰ × ۲۵۰ms = ۱۰ ثانیه) دقیقاً روی همین مرز بود و تست را **متناوب** می‌کرد.
 * ۳۰ ثانیه یعنی «سرور بالا نیامد» دیگر یک شکست معنادار است، نه باختِ مسابقهٔ
 * ثانیه‌شماری. (کندیِ خودِ راه‌اندازی جداگانه ثبت شده؛ این تغییر آن را پنهان
 * نمی‌کند — فقط تست را از یک سنجهٔ نوسانی به یک سنجهٔ پایدار تبدیل می‌کند.)
 */
const READY_ATTEMPTS = 120; /* ۱۲۰ × ۲۵۰ms = ۳۰ ثانیه */

async function waitForUp() {
  for (let attempt = 0; attempt < READY_ATTEMPTS; attempt += 1) {
    const res = await probe('/healthz');
    if (res.status === 200) return true;
    await sleep(250);
  }
  return false;
}

try {
  const up = await waitForUp();
  check('سرور بالا آمد و /healthz پاسخ داد', up, `port=${PORT}`);
  if (!up) throw new Error('server did not start');

  const health = await probe('/healthz');
  check('/healthz ⇒ ۲۰۰', health.status === 200, `http=${health.status}`);
  check('/healthz بدنه status:ok دارد', (() => {
    try { return JSON.parse(health.body).status === 'ok'; } catch { return false; }
  })(), health.body.slice(0, 80));
  check('/healthz هدر X-Request-Id دارد', Boolean(health.headers['x-request-id']),
    health.headers['x-request-id'] ?? 'missing');

  /* نام عمومی سلامت — همان liveness، ولی مسیر استاندارد برای load balancer */
  const apiHealth = await probe('/api/health');
  check('/api/health بدون احراز هویت ⇒ ۲۰۰', apiHealth.status === 200, `http=${apiHealth.status}`);
  check('/api/health فقط status و uptimeSeconds دارد (بدون افشا)', (() => {
    try {
      const body = JSON.parse(apiHealth.body);
      return body.status === 'ok' && Object.keys(body).sort().join(',') === 'status,uptimeSeconds';
    } catch { return false; }
  })(), apiHealth.body.slice(0, 80));
  const apiHealthPost = await probe('/api/health', { method: 'POST' });
  check('/api/health با متد POST ⇒ ۴۰۵', apiHealthPost.status === 405, `http=${apiHealthPost.status}`);

  const ready = await probe('/readyz');
  check('/readyz ⇒ ۲۰۰ (محیط آماده)', ready.status === 200, `http=${ready.status} ${ready.body.slice(0, 120)}`);
  check('/readyz گزارش checks دارد', (() => {
    try { return Array.isArray(JSON.parse(ready.body).checks); } catch { return false; }
  })());

  const noToken = await probe('/metrics');
  check('/metrics بدون توکن ⇒ ۴۰۴ (نه ۴۰۳)', noToken.status === 404, `http=${noToken.status}`);
  const badToken = await probe('/metrics', { headers: { authorization: 'Bearer nope' } });
  check('/metrics با توکن غلط ⇒ ۴۰۴', badToken.status === 404, `http=${badToken.status}`);
  const goodToken = await probe('/metrics', { headers: { authorization: `Bearer ${METRICS_TOKEN}` } });
  check('/metrics با توکن درست ⇒ ۲۰۰', goodToken.status === 200, `http=${goodToken.status}`);
  check('/metrics خروجی JSON متریک است', (() => {
    try { return typeof JSON.parse(goodToken.body).uptimeSeconds === 'number'; } catch { return false; }
  })());

  const me = await probe('/api/users/me');
  check('/api/users/me بدون احراز هویت ⇒ ۴۰۱', me.status === 401, `http=${me.status}`);
  const admin = await probe('/api/admin/stats');
  check('/api/admin/stats بدون احراز هویت ⇒ ۴۰۱', admin.status === 401, `http=${admin.status}`);

  await probe(`/api/users/${PHONE}`);
  await sleep(200);

  check('لاگ دسترسی: شمارهٔ تلفن در مسیر لو نمی‌رود', !serverLog.includes(PHONE));
  check('لاگ دسترسی: خط JSON با reqId ثبت شده', /"reqId"/.test(serverLog));
} catch (error) {
  check('اجرای smoke بدون استثنا', false, error.message);

  /*
   * ⚠️ خروجی سرور پیش از این **بلعیده** می‌شد: شکست فقط «server did not start»
   * می‌گفت و هیچ‌کس نمی‌فهمید چرا (خطای راه‌اندازی؟ گارد credential مدیر؟
   * پورت اشغال؟ import کند؟). حالا لاگ واقعی سرور چاپ می‌شود.
   */
  console.error('── خروجی سرور ──');
  console.error(serverLog.trim() || '(سرور هیچ خروجی‌ای نداد)');
  console.error('─────────────────');
} finally {
  child.kill('SIGTERM');
  await new Promise((r) => { child.once('exit', r); setTimeout(r, 2000); });
}

console.log('─────────────────────────────────────────────');
for (const line of results) console.log(line);
console.log('─────────────────────────────────────────────');
console.log(failures === 0 ? `نتیجه: ${results.length}/${results.length} موفق` : `نتیجه: ${failures} ناموفق از ${results.length}`);
process.exitCode = failures === 0 ? 0 : 1;
