#!/usr/bin/env node
/*
 * تست واقعی پشتیبان‌گیری و بازگردانی (فاز ۱۵ پیشنهادی — بند ۵).
 *
 * «اسکریپت backup داشتن» موفقیت نیست؛ موفقیت یعنی **restore واقعاً کار کند**.
 * این تست همان زنجیره را اجرا می‌کند و روی دادهٔ واقعی **نمی‌نویسد**:
 *
 *   بخش الف — زنجیرهٔ واقعی (بدون دست‌زدن به داده):
 *     ۱) پشتیبان واقعی گرفته می‌شود (`data-backup` → آرشیو + مانیفست چک‌سام)
 *     ۲) آرشیو در یک ریشهٔ موقت **آزمایشی** بازگردانی می‌شود (dry-run) — همه تأیید
 *     ۳) همان آرشیو با `--apply` روی ریشهٔ موقت اعمال می‌شود و بایت‌به‌بایت با
 *        دادهٔ واقعی مقایسه می‌شود ⇒ اثبات «restore کار می‌کند»
 *
 *   بخش ب — تشخیص خرابی (باید متوقف شود):
 *     ۴) مانیفست با چک‌سام نادرست ⇒ کد خروج ۲ و **هیچ فایلی نوشته نمی‌شود**
 *     ۵) مسیر غیرمجاز (`../`) در مانیفست ⇒ کد خروج ۲ (گارد path traversal)
 *
 * اجرا: `npm run backup:restore:test`  (یا `node scripts/backup-restore-test.mjs`)
 */

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODE = process.execPath;
const BACKUP = resolve(ROOT, 'scripts', 'data-backup.mjs');
const RESTORE = resolve(ROOT, 'scripts', 'data-restore.mjs');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const run = (script, args) => spawnSync(NODE, [script, ...args], { cwd: ROOT, encoding: 'utf8' });

let passed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const sandbox = mkdtempSync(join(tmpdir(), 'tapesh-backup-restore-'));
const backups = join(sandbox, 'backups');
const restoreRoot = join(sandbox, 'restore-root');

try {
  console.log('');
  console.log('── تست پشتیبان‌گیری و بازگردانی ──');

  /* ── ۱) پشتیبان واقعی ── */
  const backupRun = run(BACKUP, [`--out=${backups}`, '--label=restoretest']);
  check('۱) پشتیبان واقعی ساخته شد', backupRun.status === 0, `exit=${backupRun.status}`);

  const archive = readdirSync(backups).find((name) => name.endsWith('.tar.gz'));
  const manifest = readdirSync(backups).find((name) => name.startsWith('SHA256SUMS-'));
  check('۲) آرشیو و مانیفست هر دو ساخته شدند', Boolean(archive) && Boolean(manifest));
  if (!archive || !manifest) throw new Error('بدون آرشیو، ادامهٔ تست بی‌معناست');

  const archivePath = join(backups, archive);
  const manifestPath = join(backups, manifest);
  const entries = readFileSync(manifestPath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
  check('۳) مانیفست چک‌سام خالی نیست', entries.length > 0, `${entries.length} خط`);

  /* ── ۲) بازگردانی آزمایشی ── */
  const dryRun = run(RESTORE, [`--archive=${archivePath}`, `--root=${restoreRoot}`]);
  check('۴) بازگردانی آزمایشی همهٔ فایل‌ها را تأیید کرد', dryRun.status === 0 && /تأییدشده:\s*(\d+)\/\1/.test(dryRun.stdout), `exit=${dryRun.status}`);
  check('۵) در حالت آزمایشی هیچ فایلی نوشته نشد', !existsSync(restoreRoot));

  /* ── ۳) بازگردانی واقعی روی ریشهٔ موقت ── */
  const apply = run(RESTORE, [`--archive=${archivePath}`, `--root=${restoreRoot}`, '--apply']);
  check('۶) بازگردانی واقعی موفق شد', apply.status === 0, `exit=${apply.status}\n${apply.stderr ?? ''}`);

  let compared = 0;
  let mismatched = 0;
  for (const line of entries) {
    const match = line.match(/^([0-9a-f]{64})\s+(.+)$/i);
    if (!match) continue;
    const [, sha, rel] = match;
    const source = join(ROOT, rel);
    const target = join(restoreRoot, rel);
    if (!existsSync(source) || !existsSync(target)) continue;
    compared += 1;
    if (sha256(readFileSync(target)) !== sha || sha256(readFileSync(source)) !== sha) mismatched += 1;
  }
  check('۷) هر فایل بازگردانی‌شده بایت‌به‌بایت با نسخهٔ اصلی یکی است', compared > 0 && mismatched === 0, `${compared} فایل مقایسه، ${mismatched} ناهمخوان`);

  check('۸) دادهٔ واقعی پروژه دست‌نخورده ماند', !existsSync(join(ROOT, 'database', 'content', 'settings.json.tmp')));

  /* ── ۴) تشخیص چک‌سام نادرست ── */
  const tamperDir = join(sandbox, 'tamper-src');
  mkdirSync(join(tamperDir, 'database', 'content'), { recursive: true });
  writeFileSync(join(tamperDir, 'database', 'content', 'settings.json'), '{"real":1}', 'utf8');
  const tamperArchive = join(sandbox, 'tamper.tar.gz');
  execFileSync('tar', ['-czf', tamperArchive, '-C', tamperDir, 'database/content/settings.json'], { stdio: 'pipe' });

  const tamperManifest = join(sandbox, 'SHA256SUMS-tamper.txt');
  writeFileSync(tamperManifest, `${sha256(Buffer.from('{"other":2}'))}  database/content/settings.json\n`, 'utf8');

  const tamperDest = join(sandbox, 'tamper-dest');
  const tamperRun = run(RESTORE, [`--archive=${tamperArchive}`, `--manifest=${tamperManifest}`, `--root=${tamperDest}`, '--apply']);
  check('۹) مانیفست نادرست با کد خروج ۲ متوقف می‌شود', tamperRun.status === 2, `exit=${tamperRun.status}`);
  check('۱۰) در شکست یکپارچگی هیچ فایلی نوشته نمی‌شود', !existsSync(tamperDest));

  /* ── ۵) گارد path traversal ── */
  const evilManifest = join(sandbox, 'SHA256SUMS-evil.txt');
  writeFileSync(evilManifest, `${'a'.repeat(64)}  ../../etc/evil.json\n`, 'utf8');
  const evilRun = run(RESTORE, [`--archive=${tamperArchive}`, `--manifest=${evilManifest}`, `--root=${join(sandbox, 'evil-dest')}`, '--apply']);
  check('۱۱) مسیر غیرمجاز در مانیفست رد می‌شود', evilRun.status === 2 && /غیرمجاز/.test(`${evilRun.stdout}${evilRun.stderr}`), `exit=${evilRun.status}`);

  /* ── ۶) آرشیو ناموجود ── */
  const missingRun = run(RESTORE, [`--archive=${join(sandbox, 'nope.tar.gz')}`]);
  check('۱۲) آرشیو ناموجود با کد خروج ۱ رد می‌شود', missingRun.status === 1, `exit=${missingRun.status}`);
} catch (error) {
  failures.push('خطای اجرای تست');
  console.error('✗ خطای غیرمنتظره:', error?.message ?? error);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log('─────────────────────────────────────────────');
console.log(`نتیجه: ${passed} سنجه موفق، ${failures.length} شکست`);
if (failures.length) for (const label of failures) console.log(`  • ${label}`);
process.exitCode = failures.length === 0 ? 0 : 1;
