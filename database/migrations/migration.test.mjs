/*
 * تست چارچوب مهاجرت — فاز ۱۲.
 *
 * چه اثبات می‌کند (هر assert یک ویژگی اعلام‌شده):
 *   • ترتیب قطعی شناسه‌ها
 *   • dry-run هیچ فایلی را نمی‌نویسد
 *   • اجرا رکورد بدون `id` را تعمیر می‌کند
 *   • اجرای دوباره = idempotent (مانیفست)
 *   • دادهٔ سازگار ⇒ هیچ نوشتنی (no-op detection)
 *   • پشتیبان پیش از نوشتن ساخته می‌شود
 *
 * اجرا: node --test database/migrations/migration.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { MIGRATIONS, orderedMigrations } from './registry.js';
import { runMigrations } from './runner.js';

function sandbox(files) {
  const root = mkdtempSync(join(tmpdir(), 'tapesh-migrate-'));
  mkdirSync(join(root, 'database', 'content'), { recursive: true });
  for (const [rel, value] of Object.entries(files)) {
    writeFileSync(join(root, rel), typeof value === 'string' ? value : JSON.stringify(value, null, 2), 'utf8');
  }
  return root;
}

function cleanup(root) {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    /* پاک‌نشدن فایل موقت شرط درستی نتیجه نیست */
  }
}

test('ترتیب مهاجرت‌ها قطعی و شناسه‌ها یکتاست', () => {
  const ordered = orderedMigrations();
  assert.equal(ordered.length, MIGRATIONS.length);
  const ids = ordered.map((migration) => migration.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => a.localeCompare(b)));
  assert.equal(new Set(ids).size, ids.length);
});

test('dry-run هیچ فایلی را نمی‌نویسد', async () => {
  const root = sandbox({
    'database/content/articles.json': [{ title: 'بدون شناسه' }],
  });
  const before = readFileSync(join(root, 'database/content/articles.json'), 'utf8');

  const report = await runMigrations({ root, apply: false });
  assert.equal(report.ok, true);
  assert.ok(report.pendingChanges > 0, 'باید تغییر لازم را ببیند');
  assert.equal(readFileSync(join(root, 'database/content/articles.json'), 'utf8'), before, 'dry-run نباید بنویسد');
  assert.equal(existsSync(join(root, 'database/migrations/applied.json')), false, 'dry-run نباید مانیفست بسازد');
  cleanup(root);
});

test('اجرا شناسهٔ گم‌شده را پر می‌کند و پشتیبان می‌گیرد', async () => {
  const root = sandbox({
    'database/content/articles.json': [{ title: 'بدون شناسه' }, { id: 'keep-me', title: 'دارد' }],
  });

  const report = await runMigrations({ root, apply: true, only: ['0001'] });
  assert.equal(report.failures, 0);

  const after = JSON.parse(readFileSync(join(root, 'database/content/articles.json'), 'utf8'));
  assert.equal(after.length, 2);
  assert.ok(after[0].id, 'رکورد بدون شناسه باید شناسه بگیرد');
  assert.equal(after[1].id, 'keep-me', 'شناسهٔ موجود نباید عوض شود');

  const applied = JSON.parse(readFileSync(join(root, 'database/migrations/applied.json'), 'utf8'));
  assert.ok(applied.applied['0001'], 'مانیفست باید مهاجرت را ثبت کند');

  const backups = report.migrations[0].stores.find((row) => row.store === 'articles')?.backup;
  assert.ok(backups, 'مسیر پشتیبان باید گزارش شود');
  assert.ok(existsSync(join(root, backups)), 'فایل پشتیبان باید روی دیسک باشد');
  cleanup(root);
});

test('اجرای دوباره idempotent است', async () => {
  const root = sandbox({ 'database/content/articles.json': [{ title: 'بدون شناسه' }] });

  await runMigrations({ root, apply: true, only: ['0001'] });
  const firstPass = readFileSync(join(root, 'database/content/articles.json'), 'utf8');

  const second = await runMigrations({ root, apply: true, only: ['0001'] });
  assert.equal(second.migrations[0].status, 'already-applied');
  assert.equal(readFileSync(join(root, 'database/content/articles.json'), 'utf8'), firstPass, 'دوباره نباید بنویسد');
  cleanup(root);
});

test('دادهٔ سازگار ⇒ هیچ نوشتنی (no-op detection)', async () => {
  const root = sandbox({
    'database/content/articles.json': [{ id: 'a1', title: 'سالم', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
  });
  const before = readFileSync(join(root, 'database/content/articles.json'), 'utf8');

  const report = await runMigrations({ root, apply: true });
  const articleRows = report.migrations.flatMap((row) => row.stores ?? []).filter((row) => row.store === 'articles');
  assert.ok(articleRows.every((row) => row.status === 'no-change'), `وضعیت‌ها: ${JSON.stringify(articleRows)}`);
  assert.equal(readFileSync(join(root, 'database/content/articles.json'), 'utf8'), before);
  cleanup(root);
});

test('JSON خراب ⇒ مهاجرت روی آن نوشتن نمی‌کند', async () => {
  const root = sandbox({ 'database/content/articles.json': '{ not json' });

  const report = await runMigrations({ root, apply: true });
  assert.equal(readFileSync(join(root, 'database/content/articles.json'), 'utf8'), '{ not json');
  const failed = report.migrations.flatMap((row) => row.stores ?? []).filter((row) => row.status.startsWith('invalid'));
  assert.ok(failed.length > 0, 'خرابی JSON باید گزارش شود');
  cleanup(root);
});

test('audit log فقط شناسه و شمارنده دارد، نه محتوای رکورد', async () => {
  const root = sandbox({ 'database/content/articles.json': [{ title: 'محرمانه-۱۲۳' }] });
  await runMigrations({ root, apply: true, only: ['0001'] });

  const audit = readFileSync(join(root, 'database/migrations/audit.jsonl'), 'utf8');
  assert.ok(audit.includes('0001'));
  assert.ok(!audit.includes('محرمانه-۱۲۳'), 'محتوای رکورد نباید در audit بیاید');
  cleanup(root);
});
