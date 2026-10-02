/*
 * بازرسی تاریخچهٔ Git — سرّ · PII · artifact حجیم. فاز ۵ (Production Readiness).
 *
 * ⚠️ فقط‌خواندنی. این ابزار **هیچ‌چیز** را بازنویسی، حذف یا force-push نمی‌کند.
 * فقط فهرست می‌دهد، شدت می‌گذارد و دستور پاک‌سازی آماده را چاپ می‌کند تا با
 * تأیید صریح مالک اجرا شود.
 *
 * چرا لازم است: `repo:hygiene` فقط **Working Tree** را می‌بیند. سرّی که یک‌بار
 * commit شده باشد در تاریخچه می‌ماند حتی اگر فایل امروز ردیابی نشود.
 *
 * استفاده:
 *   node scripts/secret-history-audit.mjs
 *   node scripts/secret-history-audit.mjs --json
 *   node scripts/secret-history-audit.mjs --sizes        # پیمایش اندازهٔ اشیاء (کندتر)
 *
 * کد خروج: ۰ همیشه (ابزار بازرسی است، نه دروازه).
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const WITH_SIZES = argv.includes('--sizes');

const git = (args, { maxBuffer = 64 * 1024 * 1024 } = {}) => {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer });
  return result.status === 0 ? (result.stdout ?? '') : '';
};

/*
 * طبقه‌بندی مسیرهای حساس. `kind` نوع داده است، `severity` شدت افشا.
 * الگوها عمداً محافظه‌کارانه‌اند: اگر مسیری «شاید» حساس است، گزارش می‌شود.
 */
const RULES = [
  { id: 'admin-credentials', pattern: /(^|\/)admins\.json$/, kind: 'secret', severity: 'critical',
    note: 'هش رمز مدیران (scrypt). افشا ⇒ rotation اجباری همهٔ رمزهای مدیر.' },
  { id: 'admin-sessions', pattern: /(^|\/)admin\.sessions\.json/, kind: 'secret', severity: 'critical',
    note: 'توکن نشست ادمین + IP/UA.' },
  { id: 'user-sessions', pattern: /(^|\/)users\.sessions\.json/, kind: 'secret', severity: 'high',
    note: 'توکن نشست کاربران + IP/UA.' },
  { id: 'users-pii', pattern: /(^|\/)users\.json(\.bak-avatar)?$/, kind: 'pii', severity: 'critical',
    note: 'شمارهٔ تماس، پروفایل و هش رمز کاربران.' },
  { id: 'activity-pii', pattern: /(^|\/)activity\.json$/, kind: 'pii', severity: 'high',
    note: 'لاگ فعالیت همراه IP و User-Agent.' },
  { id: 'events', pattern: /(^|\/)events\.json$/, kind: 'pii', severity: 'medium',
    note: 'رویدادهای ردیاب بازدید.' },
  { id: 'publish-log', pattern: /(^|\/)publishLog\.json$/, kind: 'pii', severity: 'medium',
    note: 'تاریخ انتشار کانال‌ها.' },
  { id: 'answer-keys', pattern: /(^|\/)(examQuestions|testBankAnswers)\.json$/, kind: 'secret', severity: 'high',
    note: 'کلید پاسخ آزمون — افشا یعنی بی‌اعتباری سنجش.' },
  { id: 'bot-secrets', pattern: /\.secrets\.json$/, kind: 'secret', severity: 'critical',
    note: 'توکن ربات انتشار / کلید اپ رسانه.' },
  /*
   * ⚠️ `exclude` لازم است: الگوی dotenv، فایل‌های **الگو** مثل `.env.example` را
   * هم می‌گرفت و آن‌ها را CRITICAL اعلام می‌کرد. آن فایل‌ها عمداً در مخزن‌اند و
   * هیچ مقدار واقعی ندارند؛ هشدار کاذب، اعتبار کل گزارش را پایین می‌آورد.
   */
  { id: 'dotenv', pattern: /(^|\/)\.env(\.|$)/, exclude: /\.(example|sample|template)$/, kind: 'secret', severity: 'critical',
    note: 'متغیرهای محیطی — می‌تواند شامل credential باشد.' },
  { id: 'keys', pattern: /\.(pem|key|p12|pfx|jks)$/, kind: 'secret', severity: 'critical',
    note: 'کلید خصوصی.' },
  { id: 'backup', pattern: /\.(bak|orig|rej|sql|dump)$/, kind: 'artifact', severity: 'low',
    note: 'پشتیبان/artifact — نه سرّ، ولی نباید در مخزن بماند.' },
  { id: 'dist', pattern: /^dist\//, kind: 'artifact', severity: 'medium',
    note: 'artifact ساخته‌شده — بازتولیدپذیر است و نباید در تاریخچه باشد.' },
];

const everAdded = git(['log', '--all', '--pretty=format:', '--name-only', '--diff-filter=A'])
  .split('\n').map((line) => line.trim()).filter(Boolean);
const uniquePaths = [...new Set(everAdded)];

const findings = [];
for (const path of uniquePaths) {
  for (const rule of RULES) {
    if (!rule.pattern.test(path)) continue;
    if (rule.exclude && rule.exclude.test(path)) continue;
    const commits = git(['log', '--all', '--oneline', '--follow', '--', path])
      .split('\n').filter(Boolean).length;
    findings.push({ path, rule: rule.id, kind: rule.kind, severity: rule.severity, commits, note: rule.note });
    break;
  }
}

const rank = { critical: 0, high: 1, medium: 2, low: 3 };
findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.path.localeCompare(b.path));

const counts = findings.reduce((acc, row) => ({ ...acc, [row.severity]: (acc[row.severity] ?? 0) + 1 }), {});

/* اندازهٔ مخزن — برای برآورد هزینهٔ بازنویسی تاریخچه. */
const sizeLine = git(['count-objects', '-vH']).split('\n')
  .filter((line) => /^(count|size-pack|size|in-pack)/.test(line)).join(' · ');

let largest = [];
if (WITH_SIZES) {
  const objects = git(['rev-list', '--objects', '--all']);
  const batch = spawnSync('git', ['cat-file', '--batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)'],
    { cwd: ROOT, input: objects, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  largest = (batch.stdout ?? '').split('\n')
    .map((line) => line.split(' '))
    .filter((parts) => parts[0] === 'blob' && parts[3])
    .map((parts) => ({ path: parts.slice(3).join(' '), bytes: Number(parts[2]) }))
    .filter((row) => row.bytes > 1024 * 1024)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 15);
}

/* دستور آماده — اجرا نمی‌شود. نیازمند تأیید صریح مالک است. */
const cleanupTargets = findings.map((row) => row.path);
const cleanupCommand = cleanupTargets.length
  ? [
      '# ⚠️ نیازمند تأیید صریح مالک — اجرا نکنید تا بکاپ و هماهنگی انجام شود.',
      'git filter-repo --force \\',
      ...cleanupTargets.map((path) => `  --path '${path}' \\`),
      '  --invert-paths',
      '',
      '# سپس (بازنویسی تاریخچه ⇒ force-push اجباری):',
      '#   git push --force-with-lease origin main',
    ].join('\n')
  : '';

const report = {
  generatedAt: new Date().toISOString(),
  branch: git(['branch', '--show-current']).trim(),
  head: git(['log', '-1', '--oneline']).trim(),
  repoSize: sizeLine,
  totals: { paths: uniquePaths.length, findings: findings.length, ...counts },
  findings,
  largestBlobs: largest,
  cleanup: { targets: cleanupTargets, command: cleanupCommand, executed: false },
};

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

console.log('══ بازرسی تاریخچهٔ Git — تپش ══\n');
console.log(`  شاخه/HEAD   : ${report.branch} · ${report.head}`);
console.log(`  اندازهٔ مخزن : ${report.repoSize}`);
console.log(`  مسیرهای دیده‌شده در تاریخچه: ${report.totals.paths}`);
console.log(`  یافته‌ها: ${report.totals.findings}  (critical ${counts.critical ?? 0} · high ${counts.high ?? 0} · medium ${counts.medium ?? 0} · low ${counts.low ?? 0})\n`);

console.log('── یافته‌ها (فقط‌خواندنی) ──');
for (const row of findings) {
  console.log(`  [${row.severity.toUpperCase().padEnd(8)}] ${row.kind.padEnd(8)} ${row.path}  (${row.commits} commit)`);
  console.log(`             ${row.note}`);
}

if (largest.length) {
  console.log('\n── بزرگ‌ترین blobهای تاریخچه (>۱MB) ──');
  for (const row of largest) console.log(`  ${(row.bytes / 1024 / 1024).toFixed(2)} MB  ${row.path}`);
}

console.log('\n── دستور پاک‌سازی آماده (اجرا نشد) ──');
console.log(cleanupCommand || '  (چیزی برای پاک‌سازی نیست)');
console.log('\nهیچ تغییری روی تاریخچه اعمال نشد. اجرا نیازمند تأیید صریح مالک است.');

process.exit(0);
