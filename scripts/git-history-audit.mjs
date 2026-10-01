/*
 * ممیزی تاریخچهٔ Git — فاز ۲ (بخش history rewrite).
 *
 * ⚠️ این ابزار **فقط می‌خواند**. هیچ rewrite، هیچ reset، هیچ حذفی انجام نمی‌دهد و
 * هیچ محتوایی از blobها چاپ نمی‌کند — فقط مسیر، اندازه و شمارنده. دلیل: history
 * rewrite یک عملیات destructive است و طبق قاعده باید با تأیید صریح و پس از
 * پشتیبان اجرا شود.
 *
 * چه می‌دهد:
 *   ۱. blobهای حجیم reachable در تاریخچه (بالای سقف).
 *   ۲. مسیرهای حساسی که در تاریخچه حاضرند (کاربران، هش رمز مدیر، IP/UA).
 *   ۳. فهرست دقیق مسیرهایی که باید از تاریخچه حذف شوند.
 *   ۴. دستور آمادهٔ rewrite (چاپ می‌شود، اجرا نمی‌شود).
 *
 * اجرا:  node scripts/git-history-audit.mjs [--json] [--max-mb=2]
 * کد خروج: همیشه ۰ — این ابزار دروازه نیست، گزارش است.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const maxMbArg = argv.find((a) => a.startsWith('--max-mb='));
const MAX_BYTES = (Number(maxMbArg?.split('=')[1]) || 2) * 1024 * 1024;

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...options });
}

/* ── ۱. همهٔ objectهای reachable + اندازه ── */
const revList = git(['rev-list', '--objects', '--all']).split('\n').filter(Boolean);
const pathsBySha = new Map();
for (const line of revList) {
  const space = line.indexOf(' ');
  if (space === -1) continue;
  pathsBySha.set(line.slice(0, space), line.slice(space + 1));
}

const shas = [...pathsBySha.keys()];
const sizes = new Map();
/* batch-check برای پرهیز از N فراخوانی جدا */
for (let i = 0; i < shas.length; i += 5000) {
  const chunk = shas.slice(i, i + 5000);
  const out = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], { input: `${chunk.join('\n')}\n` });
  for (const line of out.split('\n')) {
    const [sha, type, size] = line.split(' ');
    if (sha && type === 'blob') sizes.set(sha, Number(size) || 0);
  }
}

const large = [];
for (const [sha, size] of sizes) {
  if (size <= MAX_BYTES) continue;
  const path = pathsBySha.get(sha) ?? '(بدون مسیر)';
  large.push({ sha: sha.slice(0, 12), path, bytes: size });
}
large.sort((a, b) => b.bytes - a.bytes);

/* ── ۲. مسیرهای حساس در تاریخچه ── */
const SENSITIVE = [
  /^database\/users\.json$/,
  /^database\/users\.sessions\.json$/,
  /^database\/content\/admins\.json$/,
  /^database\/content\/activity\.json$/,
  /^database\/content\/exam(Questions|Attempts|Audit|Reports)?\.json$/,
  /^database\/.*\.secrets\.json$/,
  /^database\/content\/feedback\.json$/,
  /^database\/admin\.sessions\.json$/,
];

const sensitiveHits = new Map(); /* path -> {commits, bytes} */
for (const [sha, path] of pathsBySha) {
  if (!SENSITIVE.some((re) => re.test(path))) continue;
  const entry = sensitiveHits.get(path) ?? { path, blobs: 0, bytes: 0 };
  entry.blobs += 1;
  entry.bytes += sizes.get(sha) ?? 0;
  sensitiveHits.set(path, entry);
}

const sensitive = [...sensitiveHits.values()].sort((a, b) => b.bytes - a.bytes);

/* ── ۳. حجم مخزن و شمارش commit ── */
const commitCount = Number(git(['rev-list', '--count', '--all']).trim());
const objectCount = shas.length;

const report = {
  generatedAt: new Date().toISOString(),
  readOnly: true,
  maxBytes: MAX_BYTES,
  commits: commitCount,
  objects: objectCount,
  largeBlobs: large,
  sensitivePaths: sensitive,
  rewriteRequired: large.length > 0 || sensitive.length > 0,
  rewritePlan: null,
};

/*
 * دستور پیشنهادی. `git filter-repo` ترجیح دارد (سریع‌تر و درست‌تر)؛ اگر نبود،
 * `git filter-branch` نسخهٔ پشتیبان است. هر دو **فقط پیشنهاد**‌اند و اجرا
 * نمی‌شوند.
 */
if (report.rewriteRequired) {
  const pathArgs = [...new Set([...sensitive.map((row) => row.path), ...large.map((row) => row.path)])]
    .filter((path) => path && path !== '(بدون مسیر)')
    .map((path) => `--path '${path}'`)
    .join(' \\\n    ');

  report.rewritePlan = {
    preconditions: [
      'backup: git clone --mirror . ../tapeshweb-backup-$(date +%Y%m%d)',
      'همهٔ همکاران باید بعد از rewrite دوباره clone کنند (تاریخچه عوض می‌شود)',
      'remote باید force-push شود — نیازمند تأیید صریح',
    ],
    preferred: `git filter-repo --invert-paths \\\n    ${pathArgs} \\\n    --force`,
    fallback: `git filter-branch --force --index-filter \\\n    'git rm --cached --ignore-unmatch ${[...new Set(sensitive.map((r) => r.path))].join(' ')}' \\\n    --prune-empty --tag-name-filter cat -- --all`,
    aftercare: [
      'git reflog expire --expire=now --all && git gc --prune=now --aggressive',
      'git fsck --full --unreachable',
      'node scripts/git-history-audit.mjs   # باید دیگر یافته‌ای نداشته باشد',
      'node scripts/repo-hygiene.mjs        # بهداشت working tree',
    ],
  };
}

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)}MB`;

console.log('══ ممیزی تاریخچهٔ Git — تپش (فقط‌خواندنی) ══');
console.log(`  commit: ${commitCount}   object: ${objectCount}   سقف حجم: ${mb(MAX_BYTES)}`);

console.log(`\n── blobهای حجیم در تاریخچه (${large.length}) ──`);
if (!large.length) console.log('  ✓ یافته‌ای نبود');
for (const row of large.slice(0, 15)) console.log(`  • ${mb(row.bytes).padStart(9)}  ${row.path}  (${row.sha})`);
if (large.length > 15) console.log(`  … و ${large.length - 15} مورد دیگر`);

console.log(`\n── مسیرهای حساس در تاریخچه (${sensitive.length}) ──`);
if (!sensitive.length) console.log('  ✓ یافته‌ای نبود');
for (const row of sensitive) console.log(`  • ${row.path}  — ${row.blobs} نسخه · ${mb(row.bytes)}`);
console.log('  (هیچ محتوایی چاپ نشد — فقط مسیر و اندازه)');

if (report.rewriteRequired) {
  console.log('\n── وضعیت ──');
  console.log('  rewrite تاریخچه **لازم** است ولی **اجرا نشد** (نیازمند پشتیبان + تأیید صریح).');
  console.log('\n  پیش‌شرط‌ها:');
  for (const line of report.rewritePlan.preconditions) console.log(`    · ${line}`);
  console.log('\n  دستور پیشنهادی (اجرا نشده):');
  console.log(`    ${report.rewritePlan.preferred}`);
  console.log('\n  پس از اجرا:');
  for (const line of report.rewritePlan.aftercare) console.log(`    · ${line}`);
} else {
  console.log('\n── وضعیت ──\n  ✓ تاریخچه تمیز است؛ rewrite لازم نیست.');
}
