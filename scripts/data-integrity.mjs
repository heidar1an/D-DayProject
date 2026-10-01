#!/usr/bin/env node
/*
 * اسکنر یکپارچگی داده — `npm run data:check`
 *
 * کل دادهٔ Repository را می‌خواند و در برابر لایهٔ Schema (`database/models/`)
 * می‌سنجد. خروجی سه‌حالته است:
 *
 *   PASS   هیچ خطا و هیچ هشداری نیست
 *   WARN   خطای سخت نیست، ولی چیزی هست که باید دیده شود
 *   ERROR  یکپارچگی داده شکسته است
 *
 * ── بررسی‌ها ──────────────────────────────────────────────────────────────
 *   ۱) اعتبار Schema هر رکورد (required / type / enum / unknown field)
 *   ۲) قواعد بین‌فیلدی و بررسی‌های عمیق
 *   ۳) شناسهٔ تکراری در یک مجموعه
 *   ۴) نبودِ فیلد شناسه در Entityهای شناسه‌دار
 *   ۵) قیدهای یکتایی (ساده و ترکیبی)
 *   ۶) ارجاع‌ها: نبودِ والد (یتیم)، با تفکیک خطا/هشدار
 *   ۷) ارجاع‌های چندریختی (اعلان رسانه)
 *   ۸) نشت فیلد راز به مجموعه‌ای که نباید
 *
 * ── گزینه‌ها ──────────────────────────────────────────────────────────────
 *   --json        خروجی ماشین‌خوان (JSON) برای CI یا ابزار دیگر
 *   --quiet       فقط خلاصه
 *   --entity=NAME فقط یک Entity
 *   --max=N       حداکثر خطای نمایش‌داده‌شده در هر دسته (پیش‌فرض ۸)
 *
 * ⚠️ این اسکنر **هیچ چیزی را تغییر نمی‌دهد**. ابزار تعمیر جداگانه است
 * (`--repair`) و پیش‌فرضش dry-run است.
 */

import { readFileSync, existsSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODELS, MODELS_BY_COLLECTION, RELATIONS, POLYMORPHIC_RELATIONS,
  validateEntity, getModel, secretFieldNames, normalizeRecord, domainNormalizersFor,
  findIdentityIssues, findUniqueViolations, findRelationOrphans,
  checkStorageShape, recordsFromContainer, findSecretLeaks, findStorageKeyIssues,
} from '../database/models/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ─────────────────────────── گزینه‌های خط فرمان ─────────────────────────── */

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const flagValue = (name, fallback = null) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const OPTIONS = {
  json: hasFlag('json'),
  quiet: hasFlag('quiet'),
  entity: flagValue('entity'),
  max: Number(flagValue('max', '8')),
  repair: hasFlag('repair'),
  apply: hasFlag('apply'),
};

/* ─────────────────────────── بارگذاری داده ─────────────────────────── */

/**
 * دادهٔ یک فایل را به آرایهٔ رکورد تبدیل می‌کند.
 *
 * ⚠️ استخراج رکورد از ظرف **اینجا پیاده نشده** — در `recordsFromContainer`
 * (`database/models/integrity.js`) است، چون ناظر مسیر نوشتن (`models/observe.js`)
 * هم دقیقاً همین منطق را لازم دارد و کپی دوم همان چیزی می‌شد که این فاز
 * (بند ۴۸) می‌خواهد از بین ببرد. این تابع فقط «خواندن فایل + نبودِ فایل» را
 * اضافه می‌کند.
 */
function loadDataset(schema) {
  if (!schema.file) return { records: [], container: null, missing: true };
  const path = resolve(ROOT, schema.file);
  if (!existsSync(path)) return { records: [], container: null, missing: true };

  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const { records, keys } = recordsFromContainer(schema, raw);

  return keys.length
    ? { records, container: raw, missing: false, keys }
    : { records, container: raw, missing: false };
}

/** همهٔ مجموعه‌ها، با کلید نام مجموعه — همان چیزی که `ref()` انتظار دارد. */
function loadAll() {
  const byCollection = new Map();
  const fileOf = new Map();

  for (const schema of MODELS) {
    const key = schema.collection ?? schema.name;
    const loaded = loadDataset(schema);
    const existing = byCollection.get(key) ?? { records: [], containers: [], schemas: [] };
    existing.records.push(...loaded.records);
    existing.containers.push({ schema, ...loaded });
    existing.schemas.push(schema);
    byCollection.set(key, existing);
    if (schema.file) fileOf.set(key, schema.file);
  }

  /* نگاشت نام → آرایه برای جست‌وجوی ارجاع */
  const collections = {};
  for (const [key, value] of byCollection) collections[key] = value.records;

  return { byCollection, collections, fileOf };
}

/* ─────────────────────────── ساختار نتیجه ─────────────────────────── */

const report = {
  generatedAt: new Date().toISOString(),
  datasets: [],
  errors: [],
  warnings: [],
  stats: {},
};

function addIssue(level, scope, code, message, extra = {}) {
  const entry = { scope, code, message, ...extra };
  (level === 'error' ? report.errors : report.warnings).push(entry);
}

/* ─────────────────────────── بررسی یک Entity ─────────────────────────── */

/** شمارندهٔ فیلدهای نرمال‌شده در کل اسکن — برای گزارش، نه خطا. */
let normalizedFieldCount = 0;

function checkEntity(schema, records, collections) {
  const dataset = {
    entity: schema.name,
    collection: schema.collection,
    file: schema.file,
    storage: schema.storage,
    records: records.length,
    errors: 0,
    warnings: 0,
    status: 'PASS',
  };

  const before = { errors: report.errors.length, warnings: report.warnings.length };

  /* ── ۱) شناسه ── */
  if (schema.identityField) {
    const { missing, duplicates } = findIdentityIssues(schema, records);
    for (const index of missing) {
      void index;
      addIssue('error', schema.name, 'missing_identity',
        `رکورد بدون «${schema.identityField}».`, { file: schema.file });
    }
    for (const { value, count } of duplicates) {
      addIssue('error', schema.name, 'duplicate_id',
        `شناسهٔ «${value}» ${count} بار تکرار شده.`, { file: schema.file, value });
    }
  }

  /* ── ۲) اعتبارسنجی هر رکورد — با خط لولهٔ normalize → validate (بند ۱۷) ──
     نرمال‌سازی اینجا **فقط در حافظه** است؛ چیزی روی دیسک نوشته نمی‌شود.
     اگر مقدار نرمال‌شده معتبر باشد، آن «نمایش نامتعارف ولی سالم» است، نه خطا.
     تعداد فیلدهای نرمال‌شده جداگانه شمرده و گزارش می‌شود.

     ⚠️ نرمال‌سازهای دامنه‌ای از `domainNormalizersFor` می‌آیند تا ناظر مسیر
     نوشتن (`models/observe.js`) هم دقیقاً همان قواعد را ببیند — یک منبع حقیقت. */
  records.forEach((record, index) => {
    const { record: normalized, changed } = normalizeRecord(schema, record, {
      domainNormalizers: domainNormalizersFor(schema),
    });
    if (changed.length) normalizedFieldCount += changed.length;

    const result = validateEntity(schema.name, normalized, { mode: 'stored', collections });
    const label = schema.identityField ? normalized?.[schema.identityField] : `#${index}`;

    for (const entry of result.errors) {
      addIssue('error', schema.name, entry.code, `${label} → ${entry.field}: ${entry.message}`,
        { file: schema.file, record: label, field: entry.field });
    }
    for (const entry of result.warnings) {
      addIssue('warn', schema.name, entry.code, `${label} → ${entry.field}: ${entry.message}`,
        { file: schema.file, record: label, field: entry.field });
    }
  });

  /* ── ۳) قیدهای یکتایی (schema.unique روی validateRecord هم اجرا می‌شود، ولی
         آنجا `record` تازه و بدون فهرست است؛ اینجا روی دادهٔ واقعی می‌سنجیم) ── */
  for (const violation of findUniqueViolations(schema, records)) {
    addIssue('error', schema.name, 'duplicate_unique',
      `قید یکتای (${violation.constraint.join(' + ')}) نقض شده: `
        + `«${violation.key.replace(/\u0000/g, ' + ')}» در ${violation.count} رکورد.`,
      { file: schema.file, constraint: violation.constraint });
  }

  dataset.errors = report.errors.length - before.errors;
  dataset.warnings = report.warnings.length - before.warnings;
  dataset.status = dataset.errors ? 'ERROR' : dataset.warnings ? 'WARN' : 'PASS';
  return dataset;
}

/* ─────────────────────────── بررسی ارجاع‌ها ─────────────────────────── */

function checkRelations(collections) {
  const results = [];

  for (const relation of RELATIONS) {
    const rows = collections[relation.child] ?? [];
    const parentRows = collections[relation.parent] ?? [];
    const parentField = relation.parentField ?? 'id';
    const parentIds = new Set(parentRows.map((row) => row?.[parentField]).filter(Boolean));

    const { missing, nulls } = findRelationOrphans(relation, rows, parentIds);

    const level = relation.onMissing === 'warn' ? 'warn' : 'error';

    /*
     * ⚠️ ارجاع نرمی که Schema خودش هم آن را می‌شناسد (فیلد `ref` با `meta.soft`)
     * یک‌بار در `validateEntity` گزارش شده است. تکرارش در این لایه فقط شمارش
     * هشدار را باد می‌کند. پس اینجا فقط **ثبت در جدول** می‌شود و هشدار تازه‌ای
     * ساخته نمی‌شود.
     */
    const declaredSoft = (MODELS_BY_COLLECTION[relation.child] ?? [])
      .some((model) => model.fields?.[relation.field]?.meta?.soft === true);
    if (!(level === 'warn' && declaredSoft)) {
      for (const detail of missing) {
        addIssue(level, relation.child, relation.onMissing === 'warn' ? 'orphan_soft' : 'orphan',
          `${relation.child}.${relation.field} → ${relation.parent}.${parentField}: والد پیدا نشد (${detail})`,
          { relation: `${relation.child}.${relation.field}`, evidence: relation.evidence });
      }
    }

    results.push({
      relation: `${relation.child}.${relation.field} → ${relation.parent}.${parentField}`,
      rows: rows.length,
      nulls,
      orphans: missing.length,
      required: Boolean(relation.required),
      array: Boolean(relation.array),
      deleteRule: relation.deleteRule,
      status: missing.length ? (relation.onMissing === 'warn' ? 'WARN' : 'ERROR') : 'PASS',
    });
  }

  /* ── ارجاع‌های چندریختی ── */
  for (const relation of POLYMORPHIC_RELATIONS) {
    const rows = collections[relation.child] ?? [];
    const sentinels = new Set(relation.sentinels ?? []);
    let checked = 0;
    let orphans = 0;

    for (const row of rows) {
      const target = relation.map[row?.[relation.byField]];
      const value = row?.[relation.field];
      if (!target || !value || sentinels.has(value)) continue;
      checked += 1;
      const parentIds = new Set((collections[target] ?? []).map((item) => item?.id).filter(Boolean));
      if (!parentIds.has(value)) {
        orphans += 1;
        addIssue('warn', relation.child, 'orphan_polymorphic',
          `${relation.child}.${relation.field} → ${target}: «${value}» پیدا نشد.`,
          { relation: `${relation.child}.${relation.field}`, evidence: relation.evidence });
      }
    }

    results.push({
      relation: `${relation.child}.${relation.field} → (${Object.values(relation.map).join(' | ')})`,
      rows: rows.length,
      checked,
      orphans,
      polymorphic: true,
      status: orphans ? 'WARN' : 'PASS',
    });
  }

  return results;
}

/* ─────────────────────────── بررسی نشت راز ─────────────────────────── */

/**
 * نشت فیلد راز در سطح **مدل** — منطق در `database/models/integrity.js` است تا
 * تست هم بتواند همان قاعده را بسنجد.
 */
function checkSecretLeaks(collections) {
  const findings = findSecretLeaks(MODELS, collections, secretFieldNames);
  for (const finding of findings) {
    const [entity, field] = finding.split('.');
    addIssue('error', entity, 'undeclared_secret',
      `فیلد راز «${field}» در این مجموعه هست ولی در Schema به‌عنوان secret علامت نخورده.`,
      { file: getModel(entity)?.file });
  }
  return findings;
}

/* ─────────────────────────── گزارش انسانی ─────────────────────────── */

const STATUS_ICON = { PASS: 'PASS ', WARN: 'WARN ', ERROR: 'ERROR' };

function printHuman(result) {
  const { datasets, relations, errors, warnings, stats } = result;

  if (!OPTIONS.quiet) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  اسکنر یکپارچگی داده — تپش');
    console.log(`  ${result.generatedAt}`);
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('── پوشش ──');
    console.log(`  Entity با Schema رسمی : ${stats.entities}`);
    console.log(`  فایل دادهٔ اسکن‌شده     : ${stats.files}`);
    console.log(`  رکورد اسکن‌شده         : ${stats.records}`);
    console.log(`  قید یکتایی            : ${stats.uniqueConstraints}`);
    console.log(`  ارتباط (relation)      : ${stats.relations}`);
    console.log(`  فیلد نرمال‌شده (نمایش)  : ${stats.normalizedFields}`);
    console.log('');

    console.log('── به‌تفکیک Entity ──');
    for (const dataset of datasets) {
      if (dataset.records === 0 && dataset.status === 'PASS') continue;
      console.log(`  ${STATUS_ICON[dataset.status]}  ${dataset.entity.padEnd(22)} ${String(dataset.records).padStart(5)} رکورد   خطا=${dataset.errors} هشدار=${dataset.warnings}`);
    }
    console.log('');

    console.log('── ارتباط‌ها ──');
    for (const relation of relations) {
      if (relation.orphans === 0) continue;
      console.log(`  ${STATUS_ICON[relation.status]}  ${relation.relation}  (یتیم=${relation.orphans}, خالی=${relation.nulls})`);
    }
    const cleanRelations = relations.filter((relation) => relation.orphans === 0).length;
    console.log(`  (${cleanRelations} ارتباط دیگر سالم‌اند)`);
    console.log('');

    if (errors.length) {
      console.log(`── خطاها (${errors.length}) ──`);
      for (const entry of errors.slice(0, OPTIONS.max)) {
        console.log(`  ERROR  [${entry.scope}] ${entry.message}`);
      }
      if (errors.length > OPTIONS.max) console.log(`  … و ${errors.length - OPTIONS.max} خطای دیگر (با --json کامل ببینید)`);
      console.log('');
    }

    if (warnings.length) {
      console.log(`── هشدارها (${warnings.length}) ──`);
      for (const entry of warnings.slice(0, OPTIONS.max)) {
        console.log(`  WARN   [${entry.scope}] ${entry.message}`);
      }
      if (warnings.length > OPTIONS.max) console.log(`  … و ${warnings.length - OPTIONS.max} هشدار دیگر (با --json کامل ببینید)`);
      console.log('');
    }
  }

  const verdict = errors.length ? 'ERROR' : warnings.length ? 'WARN' : 'PASS';
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`  نتیجهٔ نهایی: ${verdict}`);
  console.log(`  خطا=${errors.length}   هشدار=${warnings.length}   رکورد=${stats.records}`);
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('');
  return verdict;
}

/* ─────────────────────────── حالت تعمیر (dry-run) ─────────────────────────── */

/**
 * تعمیر **هرگز** خودکار اجرا نمی‌شود و پیش‌فرضش dry-run است.
 *
 * ⚠️ این ابزار فقط «نرمال‌سازی» می‌کند، نه «تعمیر معنایی» (بند ۵۳).
 * مثلاً ارقام فارسی شمارهٔ تماس را لاتین می‌کند؛ ولی یک `price = "abc"`
 * را به `0` تبدیل نمی‌کند — آن را گزارش می‌دهد.
 */
/* ─────────────────────────── تعمیر (فقط نرمال‌سازی) ─────────────────────────── */

/** مسیر نقطه‌ای (`profile.term`, `history[0].at`) → توکن‌ها. */
function pathTokens(path) {
  return String(path).match(/[^.[\]]+/g) ?? [];
}

/** خواندن مقدار با مسیر نقطه‌ای. */
function getPath(source, path) {
  let current = source;
  for (const token of pathTokens(path)) {
    if (current === null || current === undefined) return undefined;
    current = current[token];
  }
  return current;
}

/**
 * جای رکوردها در ظرفِ فایل، بر اساس شکل ذخیره‌سازی.
 * `set(index, value)` ظرف را **درجا** تغییر می‌دهد تا نوشتن ساده بماند.
 */
function recordSlots(schema, container) {
  const shape = schema.storage ?? 'array';

  if (shape === 'array') {
    const rows = Array.isArray(container) ? container : [];
    return { rows, set: (index, value) => { rows[index] = value; } };
  }
  if (shape === 'keyed-array') {
    const rows = Array.isArray(container?.[schema.arrayKey]) ? container[schema.arrayKey] : [];
    return { rows, set: (index, value) => { rows[index] = value; } };
  }
  if (shape === 'keyed-object') {
    const source = schema.objectKey ? (container?.[schema.objectKey] ?? {}) : (container ?? {});
    const keys = Object.keys(source);
    return { rows: keys.map((key) => source[key]), set: (index, value) => { source[keys[index]] = value; } };
  }
  /* singleton */
  return { rows: container && typeof container === 'object' ? [container] : [], set: () => {} };
}

/**
 * تعمیر — **فقط نرمال‌سازی**، هرگز «اصلاح» مقدار نامعتبر (بند ۵۳).
 *
 * پیش‌فرض DRY-RUN است. با `--apply` هر فایل قبل از نوشتن یک `.bak` کنار خودش
 * می‌گیرد و خروجی، diff واقعی هر فیلد را نشان می‌دهد.
 */
async function runRepair() {
  const plans = [];

  /* شمارندهٔ گزارش مهاجرت (بند ۶۲): اسکن‌شده / تغییر / بدون تغییر / نامعتبر */
  const counters = { scanned: 0, changed: 0, skipped: 0, failed: 0, files: 0 };

  for (const schema of MODELS) {
    if (!schema.file || schema.sensitiveFile) continue;
    const loaded = loadDataset(schema);
    if (loaded.missing || !loaded.container) continue;

    const { rows, set } = recordSlots(schema, loaded.container);
    const changes = [];
    counters.scanned += rows.length;
    counters.files += 1;

    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object') {
        counters.failed += 1;
        return;
      }
      const { record, changed } = normalizeRecord(schema, row, {
        domainNormalizers: schema.name === 'user' || schema.name === 'admin'
          ? { phone: (value) => String(value ?? '').replace(/\s/g, '') }
          : {},
      });
      if (!changed.length) {
        counters.skipped += 1;
        return;
      }

      counters.changed += 1;
      changes.push({
        index,
        id: row?.id ?? row?.userId ?? `#${index}`,
        fields: changed,
        before: Object.fromEntries(changed.map((field) => [field, getPath(row, field)])),
        after: Object.fromEntries(changed.map((field) => [field, getPath(record, field)])),
        record,
      });
    });

    if (changes.length) plans.push({ schema, container: loaded.container, set, changes });
  }

  console.log('');
  console.log('── برنامهٔ تعمیر (فقط نرمال‌سازی — بند ۵۳) ──');
  console.log(`  اسکن‌شده: ${counters.scanned}   تغییر: ${counters.changed}`
    + `   بدون تغییر: ${counters.skipped}   نامعتبر: ${counters.failed}   فایل: ${counters.files}`);

  const total = plans.reduce((sum, plan) => sum + plan.changes.length, 0);
  if (!total) {
    console.log('  هیچ نرمال‌سازی لازم نیست. داده از قبل در شکل متعارف است.');
    console.log('');
    return 0;
  }

  for (const plan of plans) {
    console.log(`  ${plan.schema.name.padEnd(24)} ${plan.changes.length} رکورد  (${plan.schema.file})`);
  }
  console.log(`  مجموع: ${total} رکورد`);
  console.log('');

  let shown = 0;
  for (const plan of plans) {
    for (const change of plan.changes) {
      if (shown >= OPTIONS.max) break;
      console.log(`  ${plan.schema.name} ${change.id}`);
      for (const field of change.fields) {
        console.log(`      ${field}: ${JSON.stringify(change.before[field])} → ${JSON.stringify(change.after[field])}`);
      }
      shown += 1;
    }
    if (shown >= OPTIONS.max) break;
  }
  if (total > shown) console.log(`  … و ${total - shown} مورد دیگر`);

  if (!OPTIONS.apply) {
    console.log('');
    console.log('  ⓘ DRY-RUN — هیچ فایلی نوشته نشد.');
    console.log('    پیش از اعمال واقعی، پشتیبان بگیرید: npm run data:backup');
    console.log('    سپس: npm run data:repair -- --apply');
    console.log('');
    return 0;
  }

  console.log('');
  console.log('── اعمال ──');
  for (const plan of plans) {
    const path = resolve(ROOT, plan.schema.file);
    copyFileSync(path, `${path}.bak`);
    for (const change of plan.changes) plan.set(change.index, change.record);
    writeFileSync(path, `${JSON.stringify(plan.container, null, 2)}\n`, 'utf8');
    console.log(`  نوشته شد: ${plan.schema.file}  (${plan.changes.length} رکورد) — نسخهٔ قبلی: ${plan.schema.file}.bak`);
  }
  console.log('');
  console.log('  ⓘ برای بازگردانی: فایل `.bak` را روی اصل برگردانید، سپس `npm run data:check`.');
  console.log('');
  return 0;
}

/* ─────────────────────────── بررسی کلید ذخیره‌سازی ─────────────────────────── */

/**
 * در ذخیره‌سازی نگاشتی، **کلید** خودش هویت رکورد است. پس قالب کلید هم باید
 * اعتبارسنجی شود — کاری که اعتبارسنجی فیلدها نمی‌تواند بکند.
 * (مثال: توکن نشست کاربر باید ۶۴ نویسهٔ hex باشد.)
 */
function checkStorageKeys() {
  const findings = [];
  for (const schema of MODELS) {
    if (!schema.keyIsIdentity || schema.storage !== 'keyed-object') continue;
    const { keys = [] } = loadDataset(schema);
    for (const key of findStorageKeyIssues(schema, keys)) {
      findings.push(`${schema.name}:${key}`);
      addIssue('error', schema.name, 'invalid_storage_key',
        `کلید ذخیره‌سازی قالب درست ندارد: «${String(key).slice(0, 16)}…»`, { file: schema.file });
    }
  }
  return findings;
}

/* ─────────────────────────── اجرا ─────────────────────────── */

const { byCollection, collections } = loadAll();

const datasets = [];
let totalRecords = 0;

for (const [key, value] of byCollection) {
  for (const container of value.containers) {
    const { schema, records, missing } = container;
    if (missing) {
      addIssue('warn', schema.name, 'missing_file', `فایل داده وجود ندارد: ${schema.file}`, { file: schema.file });
      datasets.push({ entity: schema.name, collection: key, file: schema.file, records: 0, errors: 0, warnings: 1, status: 'WARN' });
      continue;
    }
    if (OPTIONS.entity && schema.name !== OPTIONS.entity) continue;

    const shapeIssue = checkStorageShape(schema, container.container);
    if (shapeIssue) {
      addIssue('error', schema.name, shapeIssue.code, shapeIssue.message, { file: schema.file });
    }

    totalRecords += records.length;
    datasets.push(checkEntity(schema, records, collections));
  }
}

const relations = checkRelations(collections);
const secretFindings = checkSecretLeaks(collections);
const storageKeyFindings = checkStorageKeys();

const result = {
  generatedAt: report.generatedAt,
  datasets,
  relations,
  errors: report.errors,
  warnings: report.warnings,
  secretFindings,
  storageKeyFindings,
  stats: {
    entities: MODELS.length,
    files: new Set(MODELS.map((schema) => schema.file).filter(Boolean)).size,
    collections: Object.keys(MODELS_BY_COLLECTION).length,
    records: totalRecords,
    uniqueConstraints: MODELS.reduce((total, schema) => total + (schema.unique?.length ?? 0), 0),
    relations: RELATIONS.length + POLYMORPHIC_RELATIONS.length,
    normalizedFields: normalizedFieldCount,
  },
};

let exitCode = 0;
if (OPTIONS.repair) {
  exitCode = await runRepair();
} else if (OPTIONS.json) {
  console.log(JSON.stringify(result, null, 2));
  exitCode = result.errors.length ? 1 : 0;
} else {
  const verdict = printHuman(result);
  exitCode = verdict === 'ERROR' ? 1 : 0;
}

process.exit(exitCode);
