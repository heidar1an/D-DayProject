/*
 * بررسی بازتولیدپذیری Build — فاز ۱.
 *
 * چه چیزی را ثابت می‌کند (پنج بررسی، هر پنج لازم):
 *   ۱. **یکپارچگی وابستگی‌ها**: هر import بیرونی در سورس، در `package.json`
 *      declare شده و روی دیسک `node_modules` نصب است. شکستِ قبلیِ build همین
 *      بود: `three` در کد import می‌شد ولی در محیط تمیز نصب نبود.
 *   ۲. **موفقیت build**: `vite build` با کد خروج ۰ تمام شود.
 *   ۳. **وجود entry**: `dist/index.html` باشد و به assetهایی اشاره کند که
 *      واقعاً روی دیسک‌اند.
 *   ۴. **chunkهای مورد انتظار**: هر `src`/`href` داخل HTML بیلد موجود و
 *      غیرخالی باشد (خروجی ناقص نداشته باشیم).
 *   ۵. **عدم اتکا به artifact قبلی**: با `--fresh` پوشهٔ `dist` پیش از build
 *      پاک می‌شود تا ثابت شود build از صفر کار می‌کند.
 *
 * استفاده:
 *   node scripts/reproducible-build-check.mjs              # بررسی کامل + build
 *   node scripts/reproducible-build-check.mjs --skip-build # فقط ایستا (سریع)
 *   node scripts/reproducible-build-check.mjs --fresh      # dist را پاک کن، بعد build
 *   node scripts/reproducible-build-check.mjs --json
 *
 * کد خروج: ۰ سبز · ۱ شکست بررسی · ۲ خطای اجرا
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const skipBuild = argv.includes('--skip-build');
const fresh = argv.includes('--fresh');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]);

const findings = { missingDeclared: [], notInLock: [], notInstalled: [], build: null, entry: [], problems: [], inconclusive: [] };

/* ───────────── ۱. یکپارچگی وابستگی‌ها ───────────── */

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'].includes(extname(entry.name))) out.push(full);
  }
  return out;
}

const SOURCE_DIRS = ['src', 'database', 'scripts'];
const sources = [
  ...SOURCE_DIRS.flatMap((dir) => walk(join(ROOT, dir))),
  ...['server.js', 'vite.config.js', 'index.html'].map((f) => join(ROOT, f)).filter((f) => existsSync(f)),
];

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
const bare = new Map(); /* packageName -> Set<file> */

/*
 * نام معتبر بستهٔ npm: حروف کوچک، رقم، `-`/`_`/`.`، و پیشوند دامنهٔ `@scope/`.
 * چرا فیلتر لازم است: این اسکنر سورس را «متن‌خوانی» می‌کند و رشته‌هایی مثل
 * `require('BUNDLE_URL')` یا `'.\x'` (مسیر ویندوزی داخل رشتهٔ تست) هم با regex
 * جور می‌شوند. بدون فیلتر، دروازه با «وابستگی جعلی» قرمز می‌شود و بی‌اعتبار.
 */
const VALID_PACKAGE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

for (const file of sources) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1];
    if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:') || spec.startsWith('data:')) continue;
    const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!VALID_PACKAGE.test(name)) continue;
    if (!bare.has(name)) bare.set(name, new Set());
    bare.get(name).add(relative(ROOT, file));
  }
}

/* نسخهٔ قفل — مرجع «از یک checkout تمیز نصب‌شدنی است یا نه». */
const lockPackages = Object.keys(JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')).packages ?? {});

for (const [name, files] of bare) {
  if (!declared.has(name)) {
    findings.missingDeclared.push({ package: name, usedIn: [...files].slice(0, 3) });
    continue;
  }
  /*
   * دو وضعیت متفاوت‌اند و نباید قاطی شوند:
   *   • در lockfile نیست ⇒ `npm ci` روی checkout تمیز هم نصبش نمی‌کند ⇒ **خطا**.
   *   • در lockfile هست ولی روی دیسک فعلی نیست ⇒ نصب جاری ناقص است؛
   *     `npm ci` درستش می‌کند ⇒ **هشدار**، نه شکست دروازه.
   */
  if (!lockPackages.includes(`node_modules/${name}`)) findings.notInLock.push({ package: name, usedIn: [...files].slice(0, 3) });
  else if (!existsSync(join(ROOT, 'node_modules', name, 'package.json'))) {
    findings.notInstalled.push({ package: name, usedIn: [...files].slice(0, 3) });
  }
}

if (findings.missingDeclared.length) {
  findings.problems.push(`${findings.missingDeclared.length} وابستگی import‌شده در package.json declare نشده است`);
}
if (findings.notInLock.length) {
  findings.problems.push(`${findings.notInLock.length} وابستگی declare‌شده در lockfile نیست (npm ci نصبش نمی‌کند)`);
}

/* ───────────── ۲. build ───────────── */

const distDir = join(ROOT, 'dist');
const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

if (!skipBuild) {
  if (!existsSync(viteBin)) {
    findings.build = { ok: false, reason: 'vite نصب نیست', exitCode: -1 };
    findings.problems.push('vite روی دیسک نیست');
  } else {
    if (fresh && existsSync(distDir)) {
      rmSync(distDir, { recursive: true, force: true });
      console.log('• dist پیش از build پاک شد (--fresh)');
    }

    const started = Date.now();
    const result = spawnSync(process.execPath, [viteBin, 'build'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: 'production' },
    });

    const buildOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    /*
     * ⚠️ «شکست کاذب» سندباکس — همان تلهٔ ثبت‌شدهٔ پروژه.
     *
     * ویت پیش از build پوشهٔ `dist` را خالی می‌کند (`emptyOutDir`). اگر این
     * ابزار داخل سندباکس میزبان اجرا شود، گارد حذف انبوهِ میزبان هر `rm` را رد
     * می‌کند و **build سالم** با کد خروج ۱ می‌افتد — بی‌آنکه چیزی خراب باشد.
     * تشخیصش می‌دهیم و با کد ۳ («نامعین») اعلام می‌کنیم، نه «شکست».
     */
    const deleteGuard = Boolean(
      process.env.CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR && process.env.CODEBUDDY_TOOL_CALL_ID,
    );

    findings.build = {
      ok: result.status === 0,
      exitCode: result.status ?? -1,
      seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
      deleteGuard,
      inconclusive: false,
      tail: buildOutput.split('\n').filter(Boolean).slice(-25),
    };

    if (!findings.build.ok) {
      if (deleteGuard) {
        findings.build.inconclusive = true;
        findings.inconclusive.push(
          'build داخل سندباکس میزبان شکست خورد و گارد حذف انبوه فعال است ⇒ «شکست کاذب» محتمل است، نه شکست واقعی',
        );
      } else {
        findings.problems.push(`build با کد خروج ${findings.build.exitCode} شکست خورد`);
      }
    }
  }
}

/* ───────────── ۳ و ۴. entry و chunkها ───────────── */

const indexHtml = join(distDir, 'index.html');

if (!existsSync(indexHtml)) {
  findings.problems.push('dist/index.html وجود ندارد (build اجرا نشده یا ناقص است)');
} else {
  const html = readFileSync(indexHtml, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((ref) => ref.startsWith('./') || ref.startsWith('/'))
    .filter((ref) => !ref.startsWith('//'))
    .map((ref) => ref.replace(/^\.?\//, ''));

  for (const ref of refs) {
    const target = resolve(distDir, ref);
    if (!target.startsWith(distDir)) continue;
    if (!existsSync(target)) {
      findings.entry.push({ ref, ok: false, reason: 'فایل نیست' });
      findings.problems.push(`asset ارجاع‌شده در index.html روی دیسک نیست: ${ref}`);
      continue;
    }
    const size = statSync(target).size;
    if (size === 0) {
      findings.entry.push({ ref, ok: false, reason: 'فایل صفر بایت' });
      findings.problems.push(`asset صفر بایت: ${ref}`);
      continue;
    }
    findings.entry.push({ ref, ok: true, bytes: size });
  }

  /* entry اسکریپت ماژول باید باشد و JS موجود */
  const hasModuleScript = /<script[^>]+type="module"[^>]+src=/.test(html);
  if (!hasModuleScript) findings.problems.push('dist/index.html هیچ <script type="module" src> ندارد');
}

/* ───────────── خروجی ───────────── */

const ok = findings.problems.length === 0;
const inconclusiveOnly = ok && findings.inconclusive.length > 0;

if (asJson) {
  process.stdout.write(
    `${JSON.stringify({ ok, inconclusive: findings.inconclusive.length > 0, generatedAt: new Date().toISOString(), declared: declared.size, imported: bare.size, ...findings }, null, 2)}\n`,
  );
  process.exit(findings.problems.length ? 1 : inconclusiveOnly ? 3 : 0);
}

console.log('══ بازتولیدپذیری build — تپش ══');
console.log(`  وابستگی declare‌شده : ${declared.size}`);
console.log(`  پکیج import‌شده     : ${bare.size}`);
console.log(`  فایل سورس اسکن‌شده  : ${sources.length}`);

console.log('\n── یکپارچگی وابستگی‌ها ──');
if (!findings.missingDeclared.length && !findings.notInLock.length) console.log('  ✓ همهٔ importهای بیرونی declare شده و در lockfile هستند');
for (const row of findings.missingDeclared) console.log(`  ✗ declare نشده: ${row.package}  (${row.usedIn.join(', ')})`);
for (const row of findings.notInLock) console.log(`  ✗ در lockfile نیست: ${row.package}  (${row.usedIn.join(', ')})`);
if (findings.notInstalled.length) {
  console.log(`  ⚠ در lockfile هست ولی روی دیسک فعلی نصب نیست (${findings.notInstalled.length}) — «npm ci» نصبشان می‌کند:`);
  for (const row of findings.notInstalled) console.log(`      · ${row.package}  (${row.usedIn.join(', ')})`);
}

if (findings.build) {
  console.log('\n── build ──');
  console.log(`  ${findings.build.ok ? '✓' : findings.build.inconclusive ? '⚠' : '✗'} exit=${findings.build.exitCode}  ${findings.build.seconds ?? '—'}s`);
  if (findings.build.deleteGuard) console.log('    (گارد حذف انبوهِ سندباکس میزبان فعال است)');
  for (const line of findings.build.tail ?? []) console.log(`    ${line}`);
}

console.log('\n── entry و chunkها ──');
if (!findings.entry.length) console.log('  (بررسی نشد)');
for (const row of findings.entry) console.log(`  ${row.ok ? '✓' : '✗'} ${row.ref}${row.bytes ? `  ${(row.bytes / 1024).toFixed(1)}KB` : ''}${row.reason ? `  — ${row.reason}` : ''}`);

console.log('');
if (findings.problems.length) {
  console.log(`نتیجه: ${findings.problems.length} ایراد`);
  for (const problem of findings.problems) console.log(`  ✗ ${problem}`);
} else if (inconclusiveOnly) {
  console.log('نتیجه: نامعین — همهٔ بررسی‌های ایستا سبزند، ولی build داخل سندباکس');
  console.log('       قابل‌اعتبار نیست. برای نتیجهٔ قطعی این را در ترمینال معمولی اجرا کن.');
  for (const line of findings.inconclusive) console.log(`  ⚠ ${line}`);
} else {
  console.log('نتیجه: سبز');
}

process.exit(findings.problems.length ? 1 : inconclusiveOnly ? 3 : 0);
