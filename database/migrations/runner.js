/*
 * اجراکنندهٔ مهاجرت‌های داده — فاز ۱۲.
 *
 * خط لولهٔ هر مهاجرت روی هر انبار:
 *
 *   before → transform → validate → persist → verify
 *
 * و پیش از هر نوشتن: **پشتیبان**. پیش‌فرض `dryRun` است — یعنی اجرای معمولی
 * هیچ‌چیز را عوض نمی‌کند و فقط می‌گوید «چه چیزی عوض می‌شد». نوشتن فقط با
 * `apply: true` انجام می‌شود.
 *
 * ویژگی‌هایی که هر کدام یک آزمون واقعی دارند (`migration.test.mjs`):
 *   • ترتیب قطعی      — `orderedMigrations()` بر اساس شناسه
 *   • idempotency     — مهاجرتِ اعمال‌شده دوباره اجرا نمی‌شود (مانیفست)
 *   • no-op detection — اگر `up` همان داده را برگرداند، **هیچ نوشتنی** رخ نمی‌دهد
 *   • backup          — پیش از هر نوشتن، نسخهٔ قبلی کپی می‌شود
 *   • verify          — پس از نوشتن، فایل دوباره خوانده و با نتیجه مقایسه می‌شود
 *   • audit log       — هر اقدام در `audit.jsonl` ثبت می‌شود (بدون دادهٔ حساس)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

import { orderedMigrations, STORES } from './registry.js';
import { fileRevision, mutateJsonFile } from '../writeQueue.js';

const MIGRATIONS_DIR = 'database/migrations';
const APPLIED_FILE = 'database/migrations/applied.json';
const AUDIT_FILE = 'database/migrations/audit.jsonl';

function readJsonIfPresent(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function shapeProblem(value, shape) {
  if (shape === 'array' && !Array.isArray(value)) return 'انتظار آرایه بود';
  if (shape === 'object' && (Array.isArray(value) || typeof value !== 'object' || value === null)) return 'انتظار شیء بود';
  return null;
}

function appendAudit(root, record) {
  const file = resolve(root, AUDIT_FILE);
  mkdirSync(dirname(file), { recursive: true });
  /* فقط شناسه‌ها و شمارنده‌ها — هیچ محتوای رکوردی، هیچ دادهٔ شخصی. */
  writeFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...record })}\n`, { flag: 'a', encoding: 'utf8' });
}

/**
 * اجرای مهاجرت‌ها.
 *
 * @param {{root?: string, apply?: boolean, only?: string[]|null, stores?: typeof STORES}} options
 * @returns {Promise<object>} گزارش کامل
 */
export async function runMigrations({ root = process.cwd(), apply = false, only = null, stores = STORES } = {}) {
  const migrations = orderedMigrations();
  const selected = only ? migrations.filter((migration) => only.includes(migration.id)) : migrations;
  const appliedPath = resolve(root, APPLIED_FILE);
  const manifest = readJsonIfPresent(appliedPath, { applied: {} });
  const byName = new Map(stores.map((store) => [store.name, store]));
  const results = [];

  for (const migration of selected) {
    if (manifest.applied?.[migration.id]) {
      results.push({ migration: migration.id, status: 'already-applied', stores: [] });
      continue;
    }

    const storeResults = [];

    for (const storeName of migration.appliesTo) {
      const store = byName.get(storeName);
      if (!store) continue;

      const file = resolve(root, store.file);

      /*
       * «نبودن فایل» و «فایل خراب» یکی نیستند.
       *
       * اگر فایل هست ولی JSON نیست، آن را «آرایهٔ خالی» فرض نکنیم — همان الگوی
       * از‌دست‌رفتنِ خاموش داده که `contentStore` با گارد `STORAGE_CORRUPT`
       * بسته است. مهاجرت روی فایل خراب **نمی‌نویسد** و آن را گزارش می‌کند.
       */
      let before = store.shape === 'array' ? [] : {};
      if (existsSync(file)) {
        try {
          before = JSON.parse(readFileSync(file, 'utf8'));
        } catch {
          storeResults.push({ store: storeName, status: 'invalid-shape', detail: 'JSON نامعتبر — نوشتن انجام نشد' });
          continue;
        }
      }

      const shapeIssue = shapeProblem(before, store.shape);
      if (shapeIssue) {
        storeResults.push({ store: storeName, status: 'invalid-shape', detail: shapeIssue });
        continue;
      }

      const revision = fileRevision(file);
      const next = await migration.up(before, {
        makeId: () => `mig-${randomUUID().slice(0, 8)}`,
        now: new Date().toISOString(),
      });

      if (next === before || deepEqual(next, before)) {
        storeResults.push({ store: storeName, status: 'no-change' });
        continue;
      }

      const afterShapeIssue = shapeProblem(next, store.shape);
      if (afterShapeIssue) {
        storeResults.push({ store: storeName, status: 'transform-invalid', detail: afterShapeIssue });
        continue;
      }

      if (!apply) {
        storeResults.push({ store: storeName, status: 'would-change', beforeRevision: revision });
        continue;
      }

      /* پشتیبان پیش از نوشتن */
      const backupDir = resolve(root, MIGRATIONS_DIR, 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
      mkdirSync(backupDir, { recursive: true });
      const backupFile = join(backupDir, `${storeName}.json`);
      if (existsSync(file)) copyFileSync(file, backupFile);
      else writeFileSync(backupFile, JSON.stringify(before, null, 2), 'utf8');

      /* persist */
      await mutateJsonFile(file, () => next, { fallback: before, crossProcess: false });

      /* verify — بازخوانی و مقایسهٔ دقیق */
      const readBack = JSON.parse(readFileSync(file, 'utf8'));
      const verified = deepEqual(readBack, next);
      storeResults.push({
        store: storeName,
        status: verified ? 'applied' : 'verify-failed',
        backup: backupFile.slice(root.length + 1),
      });
      if (!verified) throw new Error(`verify پس از مهاجرت ${migration.id} روی ${storeName} شکست خورد`);
    }

    const touched = storeResults.filter((row) => row.status === 'applied').length;
    const failed = storeResults.filter((row) => row.status.endsWith('failed') || row.status.startsWith('invalid')).length;

    if (apply && !failed) {
      manifest.applied = manifest.applied ?? {};
      manifest.applied[migration.id] = { at: new Date().toISOString(), touched, description: migration.description };
      mkdirSync(dirname(appliedPath), { recursive: true });
      writeFileSync(appliedPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    }

    appendAudit(root, {
      migration: migration.id,
      mode: apply ? 'apply' : 'dry-run',
      touched,
      failed,
      stores: storeResults.map((row) => `${row.store}:${row.status}`),
    });

    results.push({ migration: migration.id, description: migration.description, status: apply ? 'applied' : 'dry-run', stores: storeResults });
  }

  const changed = results.flatMap((row) => row.stores ?? []).filter((row) => row.status === 'would-change' || row.status === 'applied').length;
  const failures = results.flatMap((row) => row.stores ?? []).filter((row) => row.status.includes('failed') || row.status.startsWith('invalid')).length;

  return {
    mode: apply ? 'apply' : 'dry-run',
    migrations: results,
    pendingChanges: changed,
    failures,
    ok: failures === 0,
  };
}
