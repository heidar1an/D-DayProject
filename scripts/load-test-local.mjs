/*
 * آزمون بار محلی — سرور را خودش بالا می‌آورد، می‌سنجد، و پایین می‌آورد.
 *
 * چرا این فایل وجود دارد: `scripts/load-test.mjs` یک هارنس واقعی است، ولی به یک
 * Base URL زنده نیاز دارد. اگر فقط در CI اجرا شود، روی ماشین توسعه هرگز
 * اجرا نمی‌شود و **کهنه می‌شود** — همان سرنوشتی که هارنس‌های «فقط در CI» دارند.
 * این پوشش، همان هارنس را به دروازهٔ محلی وصل می‌کند.
 *
 * کد خروج:
 *   ۰ = سبز (هیچ نقض آستانه‌ای نیست)
 *   ۱ = نقض آستانه یا شکست راه‌اندازی سرور
 *   ۳ = نامعین — artifact بیلد (`dist/index.html`) وجود ندارد؛ بدون آن، سناریوی
 *       صفحهٔ اصلی معنا ندارد و نتیجه سبز/سرخ گمراه‌کننده می‌شد.
 *
 * ایمنی: فقط روی `127.0.0.1` و روی پورت آزاد. هیچ دادهٔ واقعی نوشته نمی‌شود
 * (سناریوها خواندنی‌اند + یک تلاش ورود با اعتبار جعلی).
 *
 * اجرا: `node scripts/load-test-local.mjs`
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODE = process.execPath;

const argv = process.argv.slice(2);
const CONCURRENCY = Number(argv.find((a) => a.startsWith('--concurrency='))?.slice(14)) || 5;
const DURATION = Number(argv.find((a) => a.startsWith('--duration='))?.slice(11)) || 3;
const BOOT_TIMEOUT_MS = 25_000;

/* بدون artifact بیلد، سنجیدن صفحهٔ اصلی بی‌معنا است ⇒ «نامعین»، نه سبز */
if (!existsSync(resolve(ROOT, 'dist', 'index.html'))) {
  console.error('⚠️ نامعین: dist/index.html وجود ندارد — اول build کن.');
  process.exit(3);
}

function freePort() {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/*
 * شیم‌های میزبان (سندباکس) هم راه‌اندازی سرور را کند می‌کنند و هم ممکن است
 * گارد حذف انبوه را وارد مسیر تست کنند. فقط اگر همان شیم سندباکس باشد حذفش
 * می‌کنیم؛ `NODE_OPTIONS` کاربر دست‌نخورده می‌ماند.
 */
function childEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  const options = String(env.NODE_OPTIONS ?? '');
  if (options.includes('node-language-shim') || options.includes('node-safe-delete-shim')) {
    delete env.NODE_OPTIONS;
  }
  return env;
}

async function waitForHealth(baseUrl, deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return true;
    } catch { /* هنوز بالا نیامده */ }
    await sleep(200);
  }
  return false;
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;

console.log('══ آزمون بار محلی — تپش ══\n');

const server = spawn(NODE, ['server.js'], {
  cwd: ROOT,
  env: childEnv({ PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'test', TAPESH_ACCESS_LOG: '0' }),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });

let serverExited = false;
server.on('exit', () => { serverExited = true; });

function shutdown() {
  if (!serverExited) {
    try { server.kill('SIGTERM'); } catch { /* */ }
  }
}

const healthy = await waitForHealth(baseUrl, Date.now() + BOOT_TIMEOUT_MS);

if (!healthy) {
  shutdown();
  console.error(`✗ سرور در ${BOOT_TIMEOUT_MS / 1000} ثانیه روی ${baseUrl} آماده نشد.`);
  if (serverLog.trim()) console.error(`── خروجی سرور ──\n${serverLog.slice(-1500)}`);
  process.exit(1);
}

console.log(`  سرور : ${baseUrl} (پورت آزاد، فقط loopback)`);

const load = spawn(NODE, [
  'scripts/load-test.mjs',
  '--check',
  '--json',
  `--concurrency=${CONCURRENCY}`,
  `--duration=${DURATION}`,
], {
  cwd: ROOT,
  env: childEnv({ LOAD_TEST_BASE_URL: baseUrl }),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let loadOut = '';
load.stdout.on('data', (chunk) => { loadOut += chunk; });
load.stderr.on('data', (chunk) => { loadOut += chunk; });

const loadCode = await new Promise((done) => load.on('exit', (code) => done(code ?? 1)));

shutdown();
await sleep(150);

process.stdout.write(loadOut);
console.log(`  خروج : ${loadCode === 0 ? 'سبز' : 'نقض آستانه'}`);
process.exit(loadCode);
