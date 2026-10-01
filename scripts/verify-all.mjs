/*
 * دروازهٔ کیفیت یک‌دستوره (فاز ۱۴ پیشنهادی — بند ۱۱).
 *
 * یک فرمان، همهٔ بررسی‌های موجود پروژه: تست‌های واحد، یکپارچگی داده، قرارداد API،
 * smoke زمان اجرا. هر گام در پروسهٔ فرزند اجرا می‌شود تا `process.exit` یک تست،
 * اجرای بقیه را نکشد.
 *
 * ⚠️ چرا این ابزار لازم است: بخشی از تست‌ها روی **دادهٔ واقعی** می‌نویسند
 * (`adminApi.test.mjs` فایل‌های `content/admins.json` و `content/activity.json` را
 * دست می‌زند). پیش از این، هر اجرای دستی یک آلودگی باقی می‌گذاشت که باید دستی
 * برگردانده می‌شد. این ابزار پیش از اجرا از همهٔ فایل‌های داده عکس می‌گیرد و پس از
 * اجرا هر فایلی که بایت‌هایش عوض شده باشد را برمی‌گرداند و **گزارش می‌کند**.
 *
 * استفاده:
 *   node scripts/verify-all.mjs              # همهٔ گام‌ها
 *   node scripts/verify-all.mjs --only=data:check,api:contract:check
 *   node scripts/verify-all.mjs --json       # خروجی ماشین‌خوان
 *   node scripts/verify-all.mjs --keep-pollution   # بازگردانی نکن (برای دیباگ)
 *   node scripts/verify-all.mjs --require-clean    # اگر داده از قبل نسبت به HEAD تغییر کرده باشد، با کد ۲ بایست
 *
 * ⚠️ این ابزار را **تنها** اجرا کن: گام‌های زمان‌سنج (بنچمارک) زیر بار هم‌زمانِ
 * CPU بی‌اعتبار می‌شوند.
 *
 * کد خروج: ۰ اگر همهٔ گام‌ها موفق باشند، ۱ در غیر این صورت، ۲ برای `--require-clean`.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const NODE = process.execPath;

/*
 * خروجی کامل گام‌های ناموفق اینجا نگه داشته می‌شود.
 *
 * چرا: گزارش انسانی فقط دو خط آخر را چاپ می‌کرد و `--json` هم `tail` دوخطی
 * داشت. نتیجه این بود که یک شکست واقعی مثل «dump استثنای نود» فقط به شکل
 * `Node.js v22.22.2` دیده می‌شد و علت ریشه‌ای قابل تشخیص نبود. حالا خروجی
 * کامل روی دیسک می‌ماند و مسیرش چاپ می‌شود.
 */
const LOG_DIR = join(ROOT, '.workbuddy-ai', 'verify-logs');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const keepPollution = argv.includes('--keep-pollution');
const requireClean = argv.includes('--require-clean');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').filter(Boolean)) : null;

/* ───────────────────────── گام‌ها ───────────────────────── */

/*
 * ⚠️ ترتیب گام‌ها معنا دارد — `data:check` باید **اول** باشد.
 *
 * چرا: بازگردانی آلودگی پس از **همهٔ** گام‌ها انجام می‌شود. پس اگر `data:check`
 * بعد از گام‌های تست بنشیند، دادهٔ آلودهٔ همان گام‌ها را می‌سنجد و **ساختاراً**
 * شکست می‌خورد — نه چون داده خراب است، چون ترتیب غلط است. این ایراد در اجرای
 * واقعی دیده شد: `activity` با ۵۰۰ رکورد و `خطا=۱`، فقط به‌خاطر رکوردهای
 * آزمایشیِ گام‌های پیشین. حالا `data:check` پیش‌پرواز است: «پیش از تست، داده
 * سالم است؟». وضعیت پس از اجرا هم بی‌پاسخ نمانده — سازوکار snapshot/restore و
 * فهرست `polluted` در پایان آن را گزارش می‌کند.
 */
const STEPS = [
  { id: 'data:check', args: ['scripts/data-integrity.mjs'] },
  { id: 'data:test', args: ['database/dataIntegrity.test.mjs'] },
  { id: 'auth:test', args: ['database/usersAuth.test.mjs'] },
  { id: 'bank:test', args: ['database/testBankSecurity.test.mjs'] },
  { id: 'xss:test', args: ['--test', 'database/sanitizeHtmlXss.test.mjs'] },
  { id: 'exam:test', args: ['database/examApi.test.mjs'] },
  { id: 'domain:test', args: ['--test', 'scripts/domain-tests.mjs'] },
  { id: 'planning:test', args: ['scripts/planning-service-test.mjs'] },
  { id: 'admin:test', args: ['database/adminApi.test.mjs'] },
  { id: 'admin:rbac:test', args: ['database/adminRbac.test.mjs'] },
  { id: 'admin:security:test', args: ['database/adminSecrets.test.mjs'] },
  { id: 'api:test', args: ['--test', 'database/apiContract.test.mjs'] },
  { id: 'api:input:test', args: ['--test', 'database/inputGate.test.mjs'] },
  { id: 'obs:test', args: ['--test', 'database/observability.test.mjs'] },
  { id: 'router:test', args: ['scripts/router-test.mjs'] },
  { id: 'content:atomic:test', args: ['--test', 'database/contentStoreAtomicWrite.test.mjs'] },
  { id: 'content:hotpath:test', args: ['--test', 'database/contentStoreHotPath.test.mjs'] },
  { id: 'storage:test', args: ['--test', 'database/storageCorruption.test.mjs'] },
  { id: 'publish:guard:test', args: ['--test', 'database/publisherUrlGuard.test.mjs'] },
  /*
   * گام‌های افزودهٔ Pre-Production Remediation (فازهای ۳، ۴، ۸، ۹، ۱۲، ۲۲، ۲۸).
   * هر کدام یک سازوکار تازه را می‌سنجد، نه یک تست تشریفاتی:
   *   • security:*  — هدرها روی پاسخ واقعی سرور + سیاست credential مدیر
   *   • concurrency — lost update درون/بین‌پروسه
   *   • migration   — چارچوب مهاجرت نسخه‌دار
   */
  { id: 'security:headers:test', args: ['--test', 'database/securityHeaders.test.mjs', 'database/securityHeaders.integration.test.mjs'] },
  { id: 'security:credential:test', args: ['--test', 'database/adminCredentialPolicy.test.mjs'] },
  { id: 'concurrency:test', args: ['--test', 'database/concurrency.test.mjs'] },
  { id: 'migration:test', args: ['--test', 'database/migrations/migration.test.mjs'] },
  { id: 'backup:restore:test', args: ['scripts/backup-restore-test.mjs'] },
  { id: 'data:benchmark', args: ['scripts/persistence-benchmark.mjs'] },
  /* build **قبل** از سنجش بودجه و SEO — وگرنه روی artifact کهنه سنجیده می‌شود */
  { id: 'build:check', args: ['scripts/reproducible-build-check.mjs'] },
  { id: 'perf:bundle', args: ['scripts/bundle-budget.mjs', '--check'] },
  /* نقشهٔ سایت و robots پس از build ساخته می‌شوند (build پوشهٔ dist را پاک می‌کند) */
  { id: 'seo:generate', args: ['scripts/generate-sitemap.mjs'] },
  { id: 'seo:check', args: ['scripts/seo-validate.mjs'] },
  { id: 'api:contract:check', args: ['scripts/api-contract.mjs', '--check'] },
  { id: 'route:contracts:fresh', args: ['scripts/generate-route-contracts.mjs', '--check'] },
  { id: 'data:migrate:dry', args: ['scripts/data-migrate.mjs'] },
  { id: 'audit:api:selftest', args: ['scripts/api-input-audit.mjs', '--selftest'] },
  { id: 'smoke:test', args: ['scripts/server-smoke.mjs'] },
  { id: 'e2e:api', args: ['scripts/e2e-api-flows.mjs'] },
  { id: 'repo:hygiene', args: ['scripts/repo-hygiene.mjs'] },
];

/* ───────────────── عکس‌برداری از فایل‌های داده ─────────────────
 * فهرست **صریح** است، نه glob: تست‌ها فقط روی همین‌ها می‌نویسند و glob
 * ممکن است فایل‌های موقت یا پشتیبان را هم وارد کند.
 */

const WATCHED = [
  'database/users.json',
  'database/users.sessions.json',
  ...readdirSync(join(ROOT, 'database', 'content'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => join('database', 'content', name)),
  ...readdirSync(join(ROOT, 'database'))
    .filter((name) => name.endsWith('.secrets.json'))
    .map((name) => join('database', name)),
].filter((rel) => existsSync(join(ROOT, rel)));

function snapshot() {
  const map = new Map();
  for (const rel of WATCHED) map.set(rel, readFileSync(join(ROOT, rel)));
  return map;
}

const before = snapshot();
const snapshotDir = mkdtempSync(join(tmpdir(), 'tapesh-verify-all-'));
for (const [rel, bytes] of before) writeFileSync(join(snapshotDir, rel.replace(/[/\\]/g, '__')), bytes);

/*
 * ⚠️ آلودگی **ازپیش‌موجود**: بازگردانی این ابزار به «وضعیت شروع» برمی‌گرداند، نه به
 * HEAD. اگر داده پیش از اجرا آلوده باشد (مثلاً از یک اجرای دستی قبلی تست)، همان
 * آلودگی سر جایش می‌ماند و در پایان «بازگردانی‌شده» گزارش می‌شود — که گمراه‌کننده
 * است. پس همان اول آن را نسبت به HEAD گزارش می‌کنیم.
 */
const gitStatus = spawnSync('git', ['status', '--porcelain', '--', ...WATCHED], { cwd: ROOT, encoding: 'utf8' });
const preexisting = (gitStatus.stdout ?? '')
  .split('\n')
  .map((line) => line.trimEnd())
  .filter((line) => line && !line.startsWith('??'))
  .map((line) => line.slice(3).trim());

if (preexisting.length > 0 && !asJson) {
  console.log(`⚠️ دادهٔ ازپیش‌تغییرکرده نسبت به HEAD (${preexisting.length}) — بازگردانی این ابزار آن را تمیز نمی‌کند:`);
  for (const rel of preexisting) console.log(`  • ${rel}`);
  console.log('  برای شروع تمیز: این فایل‌ها را خودت بررسی/برگردان، سپس دوباره اجرا کن.');
}
if (requireClean && preexisting.length > 0) {
  console.error(`--require-clean: ${preexisting.length} فایل داده از قبل نسبت به HEAD تغییر کرده است.`);
  process.exitCode = 2;
  tryRemove(snapshotDir, { recursive: true, force: true });
  process.exit(2);
}

/*
 * ⚠️ گاردِ حذفِ انبوهِ میزبان (شیم سندباکس).
 *
 * اگر این ابزار از داخل سندباکس اجرا شود، میزبان به همهٔ پروسه‌های فرزند دو
 * متغیر تزریق می‌کند و هر `unlink`/`rm` را از یک helper بیرونی می‌پرسد. آن
 * helper سهمیه‌ای برای «حذف در یک نوبت» دارد و وقتی رد کند، خطای پرتاب‌شده
 * **پروسه را می‌کشد** (exit 1) — آن هم معمولاً در لحظهٔ **پاک‌سازی**، یعنی
 * بعد از آنکه همهٔ assertها سبز شده‌اند. این باعث «شکست کاذب» می‌شود و
 * قبلاً هم شد (`planning:test` و `admin:security:test`) و یک‌بار هم خودِ
 * همین ابزار را کشت: حذفِ لاگِ کهنهٔ یک گام **موفق**.
 * تشخیص و اعلامش می‌کنیم تا نتیجه اشتباه تفسیر نشود.
 */
const deleteGuard = Boolean(
  process.env.CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR && process.env.CODEBUDDY_TOOL_CALL_ID,
);

if (deleteGuard && !asJson) {
  console.log('⚠️ سندباکس میزبان فعال است (گارد حذف انبوه). پاک‌سازیِ فایل موقت در تست‌ها ممکن است رد شود و');
  console.log('   گامی که همهٔ assertهایش سبز است را با exit 1 بکشد ⇒ «شکست کاذب». برای نتیجهٔ معتبر،');
  console.log('   این دروازه را در ترمینال معمولی (بیرون سندباکس) اجرا کن.');
  console.log('');
}

/*
 * حذفِ «بهترین‌تلاش». دروازه‌ای که وسط کار بمیرد بی‌فایده است، پس شکستِ
 * پاک‌سازیِ خودِ ابزار را هشدار می‌دهیم و ادامه می‌دهیم — پاک‌سازی شرطِ
 * درستیِ نتیجه نیست.
 */
function tryRemove(target, options) {
  try {
    rmSync(target, options);
  } catch (error) {
    console.warn(`⚠️ حذف ${target} انجام نشد: ${error && error.message ? error.message : error}`);
  }
}

/* ───────────────────────── اجرا ───────────────────────── */

const selected = STEPS.filter((step) => !only || only.has(step.id));
const report = [];

for (const step of selected) {
  const started = Date.now();
  const result = spawnSync(NODE, step.args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const seconds = Number(((Date.now() - started) / 1000).toFixed(1));
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  const exitCode = result.status ?? -1;

  /*
   * خروجی کامل گام ناموفق روی دیسک می‌ماند؛ گام موفق، لاگ کهنهٔ خودش را پاک
   * می‌کند تا پوشهٔ لاگ فقط شکست‌های جاری را نشان دهد.
   */
  const logFile = join(LOG_DIR, `${step.id.replace(/:/g, '-')}.log`);
  let logPath = null;
  if (exitCode !== 0) {
    mkdirSync(LOG_DIR, { recursive: true });
    writeFileSync(logFile, `# ${step.id} · exit=${exitCode} · ${seconds}s\n\n${output}`);
    logPath = logFile;
  } else if (existsSync(logFile)) {
    tryRemove(logFile, { force: true });
  }

  report.push({ id: step.id, exitCode, seconds, tail: lines.slice(-2), logPath });
  if (!asJson) {
    /* کد ۳ = «نامعین» (مثلاً شکست کاذب سندباکس) — نه سبز، نه شکست قطعی */
    const mark = exitCode === 0 ? '✓' : exitCode === 3 ? '⚠' : '✗';
    console.log(`${mark} ${step.id.padEnd(22)} exit=${String(exitCode).padStart(2)}  ${String(seconds).padStart(5)}s  ${lines.slice(-1)[0] ?? ''}`);
    if (logPath) console.log(`    ↳ خروجی کامل: ${logPath.slice(ROOT.length + 1)}`);
  }
}

/* ─────────────────── شناسایی و بازگردانی آلودگی ─────────────────── */

const polluted = [];
for (const [rel, original] of before) {
  const current = readFileSync(join(ROOT, rel));
  if (!current.equals(original)) polluted.push(rel);
}

const restored = [];
if (!keepPollution) {
  for (const rel of polluted) {
    writeFileSync(join(ROOT, rel), before.get(rel));
    restored.push(rel);
  }
}
tryRemove(snapshotDir, { recursive: true, force: true });

const failed = report.filter((row) => row.exitCode !== 0 && row.exitCode !== 3);
const inconclusive = report.filter((row) => row.exitCode === 3);

if (asJson) {
  process.stdout.write(`${JSON.stringify({ steps: report, preexisting, polluted, restored, deleteGuard, failed: failed.map((f) => f.id) }, null, 2)}\n`);
} else {
  console.log('─────────────────────────────────────────────────────────────');
  if (polluted.length === 0) {
    console.log('دادهٔ واقعی: هیچ فایلی توسط تست‌ها تغییر نکرد.');
  } else {
    console.log(`دادهٔ واقعی: ${polluted.length} فایل توسط تست‌ها تغییر کرد${keepPollution ? ' (بازگردانی نشد — --keep-pollution)' : ' و بازگردانی شد'}:`);
    for (const rel of polluted) console.log(`  • ${rel}${restored.includes(rel) ? '  → بازگردانده شد' : ''}`);
  }
  console.log(`گام‌ها: ${report.length - failed.length - inconclusive.length}/${report.length} موفق`);
  console.log(`زمان کل: ${report.reduce((sum, row) => sum + row.seconds, 0).toFixed(1)}s`);
  if (inconclusive.length) {
    console.log(`نامعین (نیازمند اجرا بیرون سندباکس): ${inconclusive.map((f) => f.id).join(', ')}`);
  }
  console.log(failed.length === 0 ? 'نتیجه: سبز' : `نتیجه: شکست در ${failed.map((f) => f.id).join(', ')}`);
}

process.exitCode = failed.length === 0 ? 0 : 1;
