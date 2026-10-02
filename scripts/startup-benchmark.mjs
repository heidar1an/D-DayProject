/*
 * بنچمارک زمان راه‌اندازی سرور — فاز ۲۳ (بازنگری).
 *
 * چرا وجود دارد: ممیزی «راه‌اندازی ~۸ ثانیه‌ای سرور» را به‌عنوان یک bottleneck
 * ثبت کرده بود. اندازه‌گیری بدون ابزار تکرارپذیر ممکن نیست، پس این اسکریپت
 * زمان «از spawn تا پاسخ `/healthz`» را چند بار می‌سنجد و کمینه/میانه/بیشینه
 * را گزارش می‌دهد. مقدار **کمینه** مرجع است (کش گرم).
 *
 * ⚠️ تلهٔ محیط: شیم سیستم‌فایلِ میزبان (`node-language-shim.cjs` که از طریق
 * `NODE_OPTIONS` بار می‌شود) هر خواندن ماژول را واسطه می‌کند و راه‌اندازی را
 * از ~۰٫۱ ثانیه به ~۱۰–۱۶ ثانیه می‌برد — **صرفاً هزینهٔ محیط، نه پروژه**.
 * برای عدد واقعی: `NODE_OPTIONS= node scripts/startup-benchmark.mjs`
 *
 * استفاده:
 *   node scripts/startup-benchmark.mjs [--runs=3] [--json]
 *
 * کد خروج: ۰ همیشه (ابزار سنجش است، نه دروازه).
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const runsArg = argv.find((arg) => arg.startsWith('--runs='));
const RUNS = Math.max(1, Number(runsArg?.split('=')[1]) || 3);
const READY_TIMEOUT_MS = 60_000;

const shimmed = String(process.env.NODE_OPTIONS ?? '').includes('shim');

function once(port) {
  return new Promise((resolveRun) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', TAPESH_ACCESS_LOG: '0' },
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearInterval(poller);
      clearTimeout(timer);
      child.kill('SIGKILL');
      resolveRun({ ok, ms: Date.now() - startedAt });
    };

    const poller = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (response.ok) finish(true);
      } catch {
        /* سرور هنوز بالا نیامده */
      }
    }, 25);

    const timer = setTimeout(() => finish(false), READY_TIMEOUT_MS);
    child.on('exit', () => finish(false));
  });
}

const samples = [];
for (let index = 0; index < RUNS; index += 1) {
  /* پورت‌های دور از PORT پیش‌فرض تا با سرور در حال اجرا تصادم نکند */
  samples.push(await once(4700 + index));
}

const okSamples = samples.filter((sample) => sample.ok).map((sample) => sample.ms).sort((a, b) => a - b);
const median = okSamples.length ? okSamples[Math.floor(okSamples.length / 2)] : null;

if (asJson) {
  process.stdout.write(`${JSON.stringify({
    shimmed,
    runs: RUNS,
    samples,
    min: okSamples[0] ?? null,
    median,
    max: okSamples.at(-1) ?? null,
  }, null, 2)}\n`);
  process.exit(0);
}

console.log('══ بنچمارک راه‌اندازی سرور — تپش ══\n');
if (shimmed) {
  console.log('⚠ شیم سیستم‌فایل فعال است — اعداد متورم‌اند (هزینهٔ محیط، نه پروژه).');
  console.log('  برای عدد واقعی: NODE_OPTIONS= node scripts/startup-benchmark.mjs\n');
}
for (const sample of samples) {
  console.log(`  ${sample.ok ? '✓' : '✗'} ${sample.ms} ms`);
}
console.log(`\n  کمینه ${okSamples[0] ?? '—'} ms · میانه ${median ?? '—'} ms · بیشینه ${okSamples.at(-1) ?? '—'} ms`);
console.log(`  (کمینه مرجع است — کش گرم)\n`);
