/*
 * هارنس آزمون بار — فاز ۴ (Production Readiness).
 *
 * چرا وجود دارد: ممیزی «Load Testing = NOT FOUND / BLOCKED» را ثبت کرده بود.
 * این ابزار سناریوهای واقعی را روی یک Base URL می‌کوبد و سنجه‌های توزیعی
 * (p50/p95/p99، نرخ موفقیت، 4xx/5xx، توان عبوری) را **ماشین‌خوان** بیرون می‌دهد.
 *
 * بدون هیچ وابستگی بیرونی — فقط `node:http`/`fetch` و `node:perf_hooks`.
 *
 * استفاده:
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:4173 node scripts/load-test.mjs
 *   node scripts/load-test.mjs --concurrency=20 --duration=10 --json
 *   node scripts/load-test.mjs --check          # نقض آستانه ⇒ exit 1
 *
 * ⚠️ ایمنی: اگر Base URL محلی نباشد (localhost/127.0.0.1/::1) اجرا **متوقف**
 * می‌شود مگر `--allow-remote` صریحاً داده شود. آزمون بار هرگز نباید تصادفی روی
 * production اجرا شود. هیچ دادهٔ واقعی نوشته نمی‌شود؛ سناریوهای نوشتن عمداً
 * نیستند (فقط خواندن + یک تلاش ورود با اعتبار جعلی که باید ۴xx بدهد).
 *
 * کد خروج: ۰ سبز/گزارش · ۱ نقض آستانه (فقط با --check) · ۲ خطای استفاده
 */

import { performance } from 'node:perf_hooks';

const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const CHECK = argv.includes('--check');
const ALLOW_REMOTE = argv.includes('--allow-remote');
const num = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  const value = hit ? Number(hit.slice(name.length + 3)) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const BASE = String(process.env.LOAD_TEST_BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/+$/, '');
const CONCURRENCY = num('concurrency', 10);
const DURATION_S = num('duration', 5);

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);
let parsedBase;
try {
  parsedBase = new URL(BASE);
} catch {
  console.error(`✗ LOAD_TEST_BASE_URL نامعتبر است: ${BASE}`);
  process.exit(2);
}
if (!LOCAL_HOSTS.has(parsedBase.hostname) && !ALLOW_REMOTE) {
  console.error(`✗ Base URL غیرمحلی است (${parsedBase.hostname}) — برای اجرای صریح --allow-remote بدهید.`);
  console.error('  آزمون بار روی محیط غیرمحلی بدون تأیید مالک اجرا نمی‌شود.');
  process.exit(2);
}

/*
 * سناریوها — هر کدام یک درخواست بی‌اثر (idempotent/خواندنی).
 * `ok` وضعیت‌های قابل‌قبول را می‌گوید؛ بقیه «شکست» شمرده می‌شوند.
 */
const SCENARIOS = [
  { name: 'healthz', method: 'GET', path: '/healthz', ok: [200] },
  { name: 'readyz', method: 'GET', path: '/readyz', ok: [200, 503] },
  { name: 'home', method: 'GET', path: '/', ok: [200] },
  { name: 'robots', method: 'GET', path: '/robots.txt', ok: [200] },
  { name: 'sitemap', method: 'GET', path: '/sitemap.xml', ok: [200] },
  { name: 'api.health', method: 'GET', path: '/api/health', ok: [200] },
  /* ورود با اعتبار جعلی — باید رد شود (۴xx). ۲۰۰ یعنی یک نقص امنیتی. */
  { name: 'auth.login.reject', method: 'POST', path: '/api/users/login',
    body: { phone: '0000000000', password: 'not-a-real-password' }, ok: [400, 401, 403, 404, 422, 429] },
  /* مسیر محافظت‌شدهٔ ادمین بدون سشن — باید ۴xx بدهد. */
  { name: 'admin.unauthorized', method: 'GET', path: '/api/admin/me', ok: [401, 403, 404] },
];

const percentile = (sorted, p) => {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

async function hit(scenario) {
  const started = performance.now();
  try {
    const response = await fetch(`${BASE}${scenario.path}`, {
      method: scenario.method,
      headers: scenario.body ? { 'content-type': 'application/json' } : undefined,
      body: scenario.body ? JSON.stringify(scenario.body) : undefined,
      redirect: 'manual',
    });
    /* بدنه باید مصرف شود وگرنه سوکت باز می‌ماند و آزمون بار معنایی ندارد */
    await response.arrayBuffer();
    return { scenario: scenario.name, status: response.status, ms: performance.now() - started,
      ok: scenario.ok.includes(response.status) };
  } catch (error) {
    return { scenario: scenario.name, status: 0, ms: performance.now() - started, ok: false,
      error: error?.message ?? 'network' };
  }
}

const startedAt = performance.now();
const results = [];
const deadline = startedAt + DURATION_S * 1000;

/* هر کارگر یک سناریو را می‌زند و بین نتایج می‌چرخد تا توزیع منصفانه باشد. */
async function worker(offset) {
  let index = offset;
  while (performance.now() < deadline) {
    results.push(await hit(SCENARIOS[index % SCENARIOS.length]));
    index += 1;
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
const elapsedS = (performance.now() - startedAt) / 1000;

const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
const statuses = {};
for (const r of results) statuses[r.status] = (statuses[r.status] ?? 0) + 1;

const byScenario = SCENARIOS.map((scenario) => {
  const rows = results.filter((r) => r.scenario === scenario.name);
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  return {
    scenario: scenario.name,
    requests: rows.length,
    success: rows.filter((r) => r.ok).length,
    failure: rows.filter((r) => !r.ok).length,
    p50: Number(percentile(times, 50).toFixed(1)),
    p95: Number(percentile(times, 95).toFixed(1)),
    p99: Number(percentile(times, 99).toFixed(1)),
  };
});

const success = results.filter((r) => r.ok).length;
const failure = results.length - success;
const clientErrors = results.filter((r) => r.status >= 400 && r.status < 500).length;
const serverErrors = results.filter((r) => r.status >= 500 || r.status === 0).length;

/*
 * آستانه‌های اولیه — مستند و قابل‌بازبینی، نه برای «سبز کردن».
 * هدف: یک محیط staging سالم باید زیر بار ۱۰ همزمان نرخ موفقیت بالا و p95
 * معقول داشته باشد. اگر staging واقعی عدد دیگری بدهد، آستانه با **تصمیم مالک**
 * و بر پایهٔ همان اندازه‌گیری به‌روز می‌شود، نه برای سبز شدن.
 */
const THRESHOLDS = {
  'success.rate.min': 0.99,
  'p95.ms.max': 1500,
  'server.5xx.max': 0,
};
const measured = {
  'success.rate.min': results.length ? Number((success / results.length).toFixed(4)) : 0,
  'p95.ms.max': Number(percentile(latencies, 95).toFixed(1)),
  'server.5xx.max': serverErrors,
};
const violations = Object.entries(THRESHOLDS)
  .filter(([key, limit]) => (key === 'success.rate.min' ? measured[key] < limit : measured[key] > limit))
  .map(([key]) => key);

const report = {
  baseUrl: BASE,
  concurrency: CONCURRENCY,
  durationSeconds: Number(elapsedS.toFixed(2)),
  requests: results.length,
  success,
  failure,
  successRate: measured['success.rate.min'],
  throughputRps: Number((results.length / elapsedS).toFixed(1)),
  http4xx: clientErrors,
  http5xx: serverErrors,
  latencyMs: {
    p50: Number(percentile(latencies, 50).toFixed(1)),
    p95: measured['p95.ms.max'],
    p99: Number(percentile(latencies, 99).toFixed(1)),
    max: Number((latencies.at(-1) ?? 0).toFixed(1)),
  },
  statuses,
  byScenario,
  thresholds: THRESHOLDS,
  violations,
};

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(CHECK && violations.length ? 1 : 0);
}

console.log('══ آزمون بار — تپش ══\n');
console.log(`  هدف            : ${BASE}`);
console.log(`  هم‌زمانی/مدت    : ${CONCURRENCY} · ${report.durationSeconds}s\n`);
console.log(`  درخواست        : ${report.requests}`);
console.log(`  موفق / ناموفق   : ${report.success} / ${report.failure}  (${(report.successRate * 100).toFixed(2)}%)`);
console.log(`  توان عبوری      : ${report.throughputRps} req/s`);
console.log(`  4xx / 5xx      : ${report.http4xx} / ${report.http5xx}`);
console.log(`  تأخیر p50/p95/p99: ${report.latencyMs.p50} / ${report.latencyMs.p95} / ${report.latencyMs.p99} ms\n`);
console.log('── به تفکیک سناریو ──');
for (const row of report.byScenario) {
  console.log(`  ${row.scenario.padEnd(22)} ${String(row.requests).padStart(5)} req · موفق ${String(row.success).padStart(5)} · p95 ${String(row.p95).padStart(7)} ms`);
}
console.log('\n── آستانه‌ها ──');
for (const [key, limit] of Object.entries(THRESHOLDS)) {
  const value = measured[key];
  const ok = key === 'success.rate.min' ? value >= limit : value <= limit;
  console.log(`  ${ok ? '✓' : '✗'} ${key.padEnd(20)} ${value} (حد ${limit})`);
}
console.log(violations.length ? `\n✗ ${violations.length} نقض آستانه: ${violations.join(', ')}` : '\n✓ هیچ نقض آستانه‌ای نیست.');
console.log('\nتوجه: این عدد «ظرفیت production» نیست — محیط staging واقعی لازم است.');

process.exit(CHECK && violations.length ? 1 : 0);
