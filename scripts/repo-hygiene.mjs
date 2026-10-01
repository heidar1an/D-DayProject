/*
 * repo-hygiene — دروازهٔ بهداشت مخزن (PHASE 20.2).
 *
 * چرا وجود دارد: ممیزی نشان داد دادهٔ زمان‌اجرا (activity/admins/events) و
 * مصنوعات حجیم در گیت **tracked** مانده‌اند و هیچ بررسی خودکاری جلوی اضافه‌شدن
 * سرّ یا فایل چند‌مگابایتی را نمی‌گیرد. این ابزار فقط **می‌خواند** و حکم می‌دهد.
 *
 * سه بررسی:
 *   ۱. سرّ در فایل‌های tracked (الگوهای پرخطر، نه هر رشتهٔ شبیه کلید).
 *   ۲. فایل tracked با حجم بیش از سقف (پیش‌فرض ۲ مگابایت).
 *   ۳. دادهٔ زمان‌اجرا که نباید tracked باشد (فهرست صریح، نه حدس).
 *
 * اجرا:  node scripts/repo-hygiene.mjs [--json] [--max-mb=2]
 * کد خروج: ۰ سالم · ۱ یافتهٔ نقض · ۲ خطای اجرا
 *
 * این اسکریپت را می‌توان در pre-commit یا CI سوار کرد.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const maxMbArg = argv.find((a) => a.startsWith('--max-mb='));
const MAX_BYTES = (Number(maxMbArg?.split('=')[1]) || 2) * 1024 * 1024;

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
}

/* ── فهرست فایل‌های tracked ── */
const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);

/*
 * دادهٔ زمان‌اجرا: نوشتنی در هر درخواست و بی‌ارزش برای تاریخچه.
 * فهرست صریح است تا حذف بر پایهٔ حدس انجام نشود.
 */
const RUNTIME_DATA = [
  'database/content/activity.json',
  'database/content/admins.json',
  'database/content/events.json',
  'database/content/publishLog.json',
  'database/content/mediaMetrics.json',
];

/*
 * الگوهای سرّ. عمداً محدود و پرسیگنال‌اند: تطبیق کاذب زیاد، دروازه را بی‌فایده
 * می‌کند. مقادیر نمونه/جای‌نگهدار و فایل‌های مستندسازی مستثنا می‌شوند.
 */
const SECRET_PATTERNS = [
  { name: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'slack-token', re: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'github-token', re: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/ },
  { name: 'telegram-bot-token', re: /\b\d{8,10}:[A-Za-z0-9_-]{33,}\b/ },
  { name: 'literal-secret-assignment', re: /(?:password|passwd|secret|api[_-]?key|access[_-]?token|bot[_-]?token)\s*[:=]\s*['"][^'"\n]{16,}['"]/i },
];

/* جای‌نگهدارها و نمونه‌های مستند — نباید نقض شمرده شوند */
const PLACEHOLDER = /(your[-_]|example|placeholder|change[-_]?me|xxx+|\$\{|<[^>]+>|test[-_]|dummy|redacted)/i;

/* مسیرهایی که محتوایشان به‌عمد نمونهٔ مستند یا خودِ الگو است */
const SECRET_SCAN_SKIP = [
  /^docs\//,
  /^README\.md$/,
  /\.env\.example$/,
  /^scripts\/repo-hygiene\.mjs$/,
  /^database\/content\/publishLog\.json$/,
  /\.test\.mjs$/,
  /*
   * استثناهای **بازبینی‌شده** برای الگوی `literal-secret-assignment`.
   *
   * این الگو عمداً پهن است (هر `password: '<۱۶+ کاراکتر>'`)، پس دو مورد بی‌خطر
   * را هم می‌گیرد. هر دو دستی بررسی شدند و هیچ‌کدام سرّ واقعی نیستند:
   *   • `scripts/e2e-api-flows.mjs` — رمز ثابتِ fixture تست
   *     (`WrongPassword123`) که در سورس عمومی است و به هیچ سرویسی وصل نیست.
   *   • `src/layout/auth/AuthPage.jsx` — متن خطای فارسی فرم
   *     («شماره تلفن یا رمز عبور نادرست است.») که فقط تصادفاً شکل تخصیص رمز
   *     دارد.
   * استثنا با مسیر **دقیق** است، نه الگوی باز — تا فایل‌های تازه بی‌سنجش نمانند.
   */
  /^scripts\/e2e-api-flows\.mjs$/,
  /^src\/layout\/auth\/AuthPage\.jsx$/,
];

const findings = { secrets: [], largeFiles: [], largeAssets: [], runtimeData: [] };

/*
 * تفکیک «دارایی دودویی» از «فایل متنی/سورس» — فاز ۲۲ ممیزی، اصلاح‌شده در فاز ۲.
 *
 * چرا: مدل‌های سه‌بعدی آناتومی (`public/anatomy/models/*.glb`، ۵ تا ۲۱ مگابایت)
 * داراییِ **عمدیِ** محصول‌اند، نه زائده. قرمز‌کردن دروازه به‌خاطر آن‌ها، دروازه را
 * بی‌اعتبار می‌کند. ولی یک فایل **سورس** ۲ مگابایتی (مثل
 * `src/services/wiki/mockData.js`) یک ایراد واقعی است: نباید در مخزن سورس باشد.
 * پس: دارایی دودویی ⇒ هشدار (با شمارش)؛ فایل متنی ⇒ نقض.
 */
const BINARY_ASSET = /\.(glb|gltf|fbx|png|jpe?g|webp|gif|ico|mp4|webm|mov|mkv|woff2?|pdf|zip|tar|gz|bin|wasm)$/i;

for (const rel of tracked) {
  let size = 0;
  try {
    size = statSync(resolve(ROOT, rel)).size;
  } catch {
    continue; // فایل tracked ولی روی دیسک نیست (حذف‌شده و stage‌نشده)
  }

  if (size > MAX_BYTES) {
    if (BINARY_ASSET.test(rel)) findings.largeAssets.push({ file: rel, bytes: size });
    else findings.largeFiles.push({ file: rel, bytes: size });
  }

  if (RUNTIME_DATA.includes(rel)) findings.runtimeData.push({ file: rel, bytes: size });

  if (SECRET_SCAN_SKIP.some((re) => re.test(rel))) continue;
  if (size > 1024 * 1024) continue; // فایل حجیم متن نیست؛ جای دیگری سنجیده می‌شود

  let text = '';
  try {
    text = readFileSync(resolve(ROOT, rel), 'utf8');
  } catch {
    continue;
  }
  if (text.includes('\0')) continue; // دودویی

  for (const line of text.split('\n')) {
    for (const pattern of SECRET_PATTERNS) {
      const match = pattern.re.exec(line);
      if (!match) continue;
      if (PLACEHOLDER.test(match[0])) continue;
      findings.secrets.push({ file: rel, pattern: pattern.name, sample: match[0].slice(0, 12) + '…' });
    }
  }
}

/*
 * تفکیک «نقض» از «هشدار».
 *
 * نقض (کد خروج ۱): سرّ در فایل tracked · دادهٔ زمان‌اجرا tracked.
 *   این دو **دستهٔ ناخواسته**اند: هیچ‌کدام نباید در مخزن باشد.
 *
 * هشدار (کد خروج ۰): فایل حجیم — چه دارایی دودویی، چه سورس.
 *   «حجم» به‌تنهایی یک فایل را ناخواسته نمی‌کند. مدل‌های GLB آناتومی و
 *   `mockData.js` ویکی هر دو **عمدی**‌اند؛ تصمیم درباره‌شان (Git LFS، انتقال
 *   به بک‌اند) یک تصمیم محصولی است، نه چیزی که یک دروازه خودکار تحمیل کند.
 *   پس گزارش می‌شوند، ولی دروازه را قرمز نمی‌کنند.
 *
 * مصنوعات تولیدشده (dist، *.out.mjs، .probe*) جداگانه پوشش دارند: در
 * `.gitignore` هستند، پس اصلاً نمی‌توانند tracked شوند.
 */
const violations = findings.secrets.length + findings.runtimeData.length;
const warnings = findings.largeFiles.length + findings.largeAssets.length;

if (asJson) {
  process.stdout.write(
    JSON.stringify({ generatedAt: new Date().toISOString(), maxBytes: MAX_BYTES, findings, violations, warnings }, null, 2),
  );
  process.exit(violations ? 1 : 0);
}

console.log('══ بهداشت مخزن — تپش ══');
console.log(`  فایل tracked: ${tracked.length}   سقف حجم: ${(MAX_BYTES / 1048576).toFixed(1)}MB`);

console.log(`\n── سرّ در فایل‌های tracked (${findings.secrets.length}) ──`);
if (!findings.secrets.length) console.log('  ✓ یافته‌ای نبود');
for (const s of findings.secrets) console.log(`  ✗ ${s.file}  [${s.pattern}]  ${s.sample}`);

console.log(`\n── فایل متنی/سورس حجیم tracked (${findings.largeFiles.length}) — هشدار ──`);
if (!findings.largeFiles.length) console.log('  ✓ یافته‌ای نبود');
for (const f of findings.largeFiles.sort((a, b) => b.bytes - a.bytes)) {
  console.log(`  ⚠ ${f.file}  ${(f.bytes / 1048576).toFixed(2)}MB`);
}
if (findings.largeFiles.length) {
  console.log('  فایل سورس ۲+ مگابایتی معمولاً یعنی دادهٔ حجیم جای سورس نشسته است.');
}

console.log(`\n── دارایی دودویی حجیم tracked (${findings.largeAssets.length}) — هشدار، نه نقض ──`);
if (!findings.largeAssets.length) console.log('  ✓ یافته‌ای نبود');
for (const f of findings.largeAssets.sort((a, b) => b.bytes - a.bytes).slice(0, 8)) {
  console.log(`  ⚠ ${f.file}  ${(f.bytes / 1048576).toFixed(2)}MB`);
}
if (findings.largeAssets.length > 8) console.log(`  … و ${findings.largeAssets.length - 8} مورد دیگر`);
if (findings.largeAssets.length) {
  console.log('  توصیه: این‌ها دارایی محصول‌اند؛ برای سبک‌کردن مخزن Git LFS گزینهٔ درست است.');
}

console.log(`\n── دادهٔ زمان‌اجرا که نباید tracked باشد (${findings.runtimeData.length}) ──`);
if (!findings.runtimeData.length) console.log('  ✓ یافته‌ای نبود');
for (const r of findings.runtimeData) console.log(`  ✗ ${r.file}  ${(r.bytes / 1024).toFixed(0)}KB`);

console.log(`\n${violations ? `${violations} یافتهٔ نقض` : 'پاک'}`);
process.exit(violations ? 1 : 0);
