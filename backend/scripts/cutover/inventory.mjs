#!/usr/bin/env node
/*
 * فاز ۲۲ — Inventory خواندنی از دادهٔ legacy (Node = مالک نوشتن تا Cutover).
 *
 * این اسکریپت **هیچ چیزی را تغییر نمی‌دهد**: فقط می‌خواند، می‌شمارد و checksum
 * می‌گیرد. خروجی، ورودی `parity.php` است.
 *
 * اجرا:
 *   node scripts/cutover/inventory.mjs            # خلاصه روی stdout
 *   node scripts/cutover/inventory.mjs --write    # + نوشتن docs/phase22-inventory.json
 *
 * چرا از `MODELS` پروژه می‌خواند و shape را حدس نمی‌زند: لایهٔ schema در
 * `database/models/` تنها منبع حقیقت شکل داده است؛ هر حدس تازه یک منبع دوم
 * می‌سازد (Prompt §22.5/§22.6).
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODELS, recordsFromContainer } from '../../../database/models/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = resolve(ROOT, 'backend/docs/phase22-inventory.json');
const WRITE = process.argv.includes('--write');

/**
 * Crosswalk — نگاشت legacy entity به جدول Laravel.
 *
 * فقط نگاشت‌هایی ثبت می‌شوند که **واقعاً** جدول مقصد دارند. هر چیزی که اینجا
 * نیست، «بدون جدول مقصد» است و باید آگاهانه تصمیم‌گیری شود (نه با حدس).
 */
const CROSSWALK = {
  user: { table: 'users', domain: 'Auth' },
  admin: { table: 'admins', domain: 'Admin' },
  session: { table: 'auth_sessions', domain: 'Auth', policy: 're-login' },
  category: { table: 'article_categories', domain: 'Articles' },
  article: { table: 'articles', domain: 'Articles' },
  reference: { table: 'references', domain: 'References' },
  flashcardDeck: { table: 'flashcard_decks', domain: 'Flashcards' },
  intlProvider: { table: 'international_providers', domain: 'International' },
  intlCourse: { table: 'international_courses', domain: 'International' },
  testBankQuestion: { table: 'questions', domain: 'QuestionBank' },
  testBankAnswer: { table: 'question_keys', domain: 'QuestionBank' },
  exam: { table: 'exams', domain: 'Exam' },
  examQuestion: { table: 'exam_questions', domain: 'Exam' },
  examAttempt: { table: 'exam_attempts', domain: 'Exam' },
  examReport: { table: 'exam_results', domain: 'Exam' },
  feedback: { table: 'feedback', domain: 'Feedback' },
  feedbackReply: { table: 'feedback_replies', domain: 'Feedback' },
  mediaAsset: { table: 'media', domain: 'Media' },
};

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const stores = [];
let legacyTotal = 0;

for (const model of MODELS) {
  const absolute = resolve(ROOT, model.file);

  if (!existsSync(absolute)) {
    stores.push({ entity: model.name, file: model.file, status: 'missing', records: 0 });
    continue;
  }

  const buffer = readFileSync(absolute);
  let parsed = null;

  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch {
    stores.push({
      entity: model.name,
      file: model.file,
      status: 'unparsable',
      records: 0,
      sha256: sha256(buffer),
      bytes: buffer.byteLength,
    });
    continue;
  }

  let records = 0;

  try {
    records = recordsFromContainer(model, parsed).records.length;
  } catch {
    records = -1; // shape ناشناخته — صریح، نه صفرِ گمراه‌کننده
  }

  if (records > 0) {
    legacyTotal += records;
  }

  stores.push({
    entity: model.name,
    domain: CROSSWALK[model.name]?.domain ?? null,
    table: CROSSWALK[model.name]?.table ?? null,
    policy: CROSSWALK[model.name]?.policy ?? null,
    storage: model.storage,
    file: model.file,
    status: 'ok',
    records,
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
  });
}

const unmapped = stores.filter((store) => store.status === 'ok' && store.table === null && store.records > 0);

const manifest = {
  phase: 22,
  kind: 'legacy-inventory',
  generatedAt: new Date().toISOString(),
  sourceOfTruth: 'Node Legacy (write owner until cutover)',
  totals: {
    stores: stores.length,
    records: legacyTotal,
    crosswalked: stores.filter((store) => store.table !== null).length,
    withoutTargetTable: unmapped.length,
  },
  stores,
};

console.log(`فایل‌ها: ${manifest.totals.stores} · رکورد: ${legacyTotal} · نگاشت‌شده: ${manifest.totals.crosswalked}`);
console.log(`بدون جدول مقصد (دارای رکورد): ${unmapped.length}`);
for (const store of unmapped) {
  console.log(`  · ${store.entity} (${store.records}) — ${store.file}`);
}

if (WRITE) {
  writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`نوشته شد: backend/docs/phase22-inventory.json`);
}
