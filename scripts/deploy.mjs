#!/usr/bin/env node
/*
 * اسکریپت استقرار — `node scripts/deploy.mjs [--env=production] [--start]`
 *
 * چرا لازم است: پیش از این «استقرار» یعنی اجرای دستی `npm run build` و بعد
 * `npm start` — بدون هیچ پیش‌شرط، بدون تأیید اینکه artifact تازه ساخته شده، و
 * بدون هیچ راه برگشتی. اگر build شکست می‌خورد، `dist/` قبلی (کهنه) سر جایش
 * می‌ماند و سرور **بی‌صدا** نسخهٔ قدیمی را سرو می‌کرد.
 *
 * چه تضمین‌هایی می‌دهد:
 *   ۱) ترتیب کنترل‌شده: پیش‌شرط → بررسی داده → **پشتیبان داده** → **مهاجرت
 *      (dry-run)** → build → تأیید artifact → start → **بررسی سلامت**
 *   ۲) گارد محیط: `--env=production` بدون `NODE_ENV=production` اجرا نمی‌شود
 *      (جلوگیری از استقرار ناخواسته روی محیط اشتباه)
 *   ۳) عکس‌برداری از `dist/` پیش از build و نگه‌داشتن ۳ نسخهٔ آخر (rollback)
 *   ۴) تأیید تازگی artifact: `dist/index.html` باید تازه‌تر از build باشد
 *   ۵) پشتیبان‌گیری از داده **پیش از** هر تغییر — چون «بازگردانی کد» به‌هیچ‌وجه
 *      یعنی «بازگردانی داده»؛ این دو مستقل‌اند و باید جدا تأمین شوند.
 *   ۶) بررسی سلامت پس از بالا آمدن: «استقرار موفق» یعنی سرور **پاسخ می‌دهد**،
 *      نه فقط اینکه پروسه بالا آمده باشد.
 *   ۷) کد خروج معنادار برای هر نوع شکست (زیر را ببین)
 *
 * کد خروج:
 *   ۰ موفق · ۱ خطای استفاده · ۲ محیط نامعتبر · ۳ ناهم‌خوانی محیط
 *   ۴ وابستگی نبود · ۵ پیش‌شرط build رد شد · ۶ بررسی/پشتیبان‌گیری/مهاجرت داده شکست خورد
 *   ۷ تأیید artifact شکست خورد · ۸ rollback شکست خورد · ۹ start شکست خورد
 */

import { execFileSync, spawn } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODE = process.execPath;
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const valueOf = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const VALID_ENVS = ['development', 'test', 'staging', 'production'];
const ENVIRONMENT = String(valueOf('env', process.env.TAPESH_ENV || process.env.NODE_ENV || 'development')).trim();
const DRY_RUN = flag('dry-run');
const SKIP_BUILD = flag('skip-build');
const SKIP_CHECKS = flag('skip-checks');
const ROLLBACK = flag('rollback');
const START = flag('start');

const DIST = resolve(ROOT, 'dist');
const SNAPSHOT_DIR = resolve(ROOT, '.workbuddy-ai', 'dist-snapshots');
const KEEP_SNAPSHOTS = 3;

const log = (message) => console.log(message);
const fail = (code, message) => { console.error(`✗ ${message}`); process.exit(code); };
const stamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

/* ─────────────────────────── rollback ─────────────────────────── */

function newestSnapshot() {
  if (!existsSync(SNAPSHOT_DIR)) return '';
  const dirs = readdirSync(SNAPSHOT_DIR)
    .map((name) => resolve(SNAPSHOT_DIR, name))
    .filter((path) => existsSync(join(path, 'index.html')))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return dirs[0] ?? '';
}

function snapshotDist(reason) {
  if (!existsSync(DIST)) return '';
  const target = resolve(SNAPSHOT_DIR, `${stamp()}-${reason}`);
  mkdirSync(target, { recursive: true });
  cpSync(DIST, target, { recursive: true });

  const keep = readdirSync(SNAPSHOT_DIR)
    .map((name) => resolve(SNAPSHOT_DIR, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const stale of keep.slice(KEEP_SNAPSHOTS)) rmSync(stale, { recursive: true, force: true });

  return target;
}

if (ROLLBACK) {
  const target = newestSnapshot();
  if (!target) fail(8, 'هیچ عکس dist معتبری برای بازگردانی نیست.');
  if (!DRY_RUN) {
    if (existsSync(DIST)) cpSync(DIST, resolve(SNAPSHOT_DIR, `${stamp()}-pre-rollback`), { recursive: true });
    rmSync(DIST, { recursive: true, force: true });
    cpSync(target, DIST, { recursive: true });
  }
  log(`✓ بازگردانی dist از ${relative(ROOT, target)}${DRY_RUN ? ' (dry-run)' : ''}`);
  process.exit(0);
}

/* ─────────────────────────── پیش‌شرط‌ها ─────────────────────────── */

log('');
log('── استقرار تپش ──');
log(`  محیط : ${ENVIRONMENT}${DRY_RUN ? '  (dry-run)' : ''}`);

if (!VALID_ENVS.includes(ENVIRONMENT)) {
  fail(2, `محیط نامعتبر: «${ENVIRONMENT}». یکی از: ${VALID_ENVS.join(' · ')}`);
}

if (ENVIRONMENT === 'production' && String(process.env.NODE_ENV ?? '') !== 'production') {
  fail(3, 'استقرار production فقط با NODE_ENV=production مجاز است (گارد محیط اشتباه).');
}

if ((ENVIRONMENT === 'production' || ENVIRONMENT === 'staging')
  && !String(process.env.PUBLIC_SITE_URL ?? '').trim()
  && String(process.env.TAPESH_ALLOW_LOCALHOST_ORIGIN ?? '') !== '1') {
  fail(3, `${ENVIRONMENT} به PUBLIC_SITE_URL نیاز دارد (وگرنه origin به localhost برمی‌گردد).`);
}

if (!existsSync(join(ROOT, 'node_modules'))) {
  fail(4, 'node_modules نیست؛ اول `npm install` را اجرا کن.');
}

if (!SKIP_CHECKS && !DRY_RUN) {
  try {
    execFileSync(NODE, ['scripts/data-integrity.mjs'], { cwd: ROOT, stdio: 'pipe' });
    log('  داده : سالم (data:check)');
  } catch (error) {
    const out = `${error?.stdout ?? ''}${error?.stderr ?? ''}`.split('\n').filter(Boolean).slice(-3).join('\n');
    fail(6, `بررسی یکپارچگی داده شکست خورد — استقرار متوقف شد.\n${out}`);
  }
} else {
  log('  داده : بررسی نشد');
}

/* پیش‌شرط build — وابستگی‌های اعلام‌شده باید واقعاً نصب باشند. */
const buildBlockers = [];
for (const dependency of ['three', 'vite', 'react']) {
  const manifest = join(ROOT, 'node_modules', dependency, 'package.json');
  if (!existsSync(manifest)) buildBlockers.push(dependency);
}
if (buildBlockers.length > 0) {
  fail(5, `وابستگی لازم برای build نصب نیست: ${buildBlockers.join(' · ')} — اول \`npm install\`.`);
}
if (!existsSync(join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'))) {
  fail(5, 'اجراشدنی vite پیدا نشد (node_modules/vite/bin/vite.js).');
}

/* کهنگی dist نسبت به سورس */
function newestSourceMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestSourceMtime(path));
    else newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
}

const indexHtml = join(DIST, 'index.html');
if (existsSync(indexHtml) && existsSync(join(ROOT, 'src'))) {
  const distTime = statSync(indexHtml).mtimeMs;
  const srcTime = newestSourceMtime(join(ROOT, 'src'));
  log(distTime >= srcTime
    ? '  dist  : تازه‌تر از src'
    : '  ⚠ dist  : از src کهنه‌تر است (نیازمند build)');
} else {
  log('  dist  : وجود ندارد (build لازم است)');
}

if (DRY_RUN) {
  log('  ⓘ dry-run: هیچ فایلی ساخته/عوض نشد.');
  log('');
  process.exit(0);
}

/* ─────────────── پشتیبان داده + مهاجرت (فاز ۱۱) ─────────────── */

/*
 * ⚠️ چرا **پیش از** build و نه بعد از آن: پشتیبان باید وضعیت «قبل از استقرار» را
 * ثبت کند. اگر بعد از build گرفته شود، در بدترین حالت (build موفق ولی مهاجرت
 * خراب) پشتیبان از دادهٔ نیمه‌تغییریافته گرفته می‌شود.
 *
 * و چرا مهاجرت اینجا فقط dry-run است: اعمال مهاجرت یک عمل برگشت‌ناپذیر روی داده
 * است و باید با `--apply-migrations` و آگاهانه انجام شود، نه به‌عنوان اثر جانبی
 * استقرار.
 */
if (!SKIP_CHECKS) {
  try {
    execFileSync(NODE, ['scripts/data-backup.mjs', `--label=pre-deploy-${ENVIRONMENT}`], {
      cwd: ROOT, stdio: 'inherit',
    });
    log('  پشتیبان داده : گرفته شد (وضعیت پیش از استقرار)');
  } catch {
    fail(6, 'پشتیبان‌گیری پیش از استقرار شکست خورد. استقرار متوقف شد — بدون پشتیبان، بازگشت ممکن نیست.');
  }

  try {
    execFileSync(NODE, ['scripts/data-migrate.mjs'], { cwd: ROOT, stdio: 'inherit' });
  } catch {
    fail(6, 'اجرای dry-run مهاجرت شکست خورد. پیش از استقرار آن را درست کن.');
  }

  if (flag('apply-migrations')) {
    try {
      execFileSync(NODE, ['scripts/data-migrate.mjs', '--apply'], { cwd: ROOT, stdio: 'inherit' });
      log('  مهاجرت : اعمال شد');
    } catch {
      fail(6, 'اعمال مهاجرت شکست خورد. داده را از پشتیبان بالا بازگردان.');
    }
  } else {
    log('  مهاجرت : dry-run (برای اعمال، --apply-migrations بده)');
  }
}

/* ─────────────────────────── build ─────────────────────────── */

if (!SKIP_BUILD) {
  const snapshot = snapshotDist('pre-build');
  if (snapshot) log(`  عکس dist : ${relative(ROOT, snapshot)}`);

  const startedAt = Date.now();
  try {
    execFileSync(NODE, ['node_modules/vite/bin/vite.js', 'build'], { cwd: ROOT, stdio: 'inherit' });
  } catch {
    fail(7, 'build شکست خورد. dist قبلی دست‌نخورده در عکس بالا محفوظ است؛ با --rollback برگردان.');
  }

  if (!existsSync(indexHtml)) fail(7, 'پس از build، dist/index.html ساخته نشد.');
  if (statSync(indexHtml).mtimeMs < startedAt) {
    fail(7, 'dist/index.html تازه‌تر از این build نیست — artifact تأیید نشد.');
  }
  log(`  build : موفق (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
}

/* ─────────────────────────── start ─────────────────────────── */

if (!START) {
  log('  ⓘ برای اجرای سرور: همان فرمان را با --start تکرار کن.');
  log('');
  process.exit(0);
}

const port = valueOf('port', process.env.PORT || '5173');
const child = spawn(NODE, ['server.js'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, PORT: String(port) },
});

const forward = (signal) => { try { child.kill(signal); } catch { /* پروسه تمام شده */ } };
process.on('SIGINT', () => forward('SIGINT'));
process.on('SIGTERM', () => forward('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) log(`  سرور با سیگنال ${signal} بسته شد.`);
  process.exit(code === 0 ? 0 : 9);
});

/*
 * بررسی سلامت پس از بالا آمدن.
 *
 * «پروسه بالا آمد» با «سرویس آماده است» یکی نیست: سرور می‌تواند بدون خطا بالا
 * بیاید ولی داده یا artifact نداشته باشد (`/readyz` همین را جدا می‌گوید). این
 * گام، استقرار را تا لحظهٔ پاسخ واقعی `/healthz` تأیید نمی‌کند.
 */
const HEALTH_URL = `http://127.0.0.1:${port}/healthz`;
const healthDeadline = Date.now() + 30_000;
let healthy = false;

while (Date.now() < healthDeadline && !healthy) {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1500) });
    healthy = response.ok;
  } catch { /* هنوز بالا نیامده */ }
  if (!healthy) await new Promise((done) => setTimeout(done, 300));
}

log(healthy
  ? `  سلامت : ${HEALTH_URL} ⇒ ۲۰۰`
  : `  ⚠ سلامت : ${HEALTH_URL} در ۳۰ ثانیه پاسخ نداد — سرور بالاست ولی آماده نیست.`);
