#!/usr/bin/env node
/*
 * فاز ۲۲ — Crosswalk قطعی: `legacy_file + legacy_id` → UUID.
 *
 * چرا UUIDv5 و نه UUIDv4: نگاشت باید **قابل تکرار** باشد. اگر import دوباره اجرا
 * شود یا بعداً delta بیاید، همان legacy_id باید همان UUID را بدهد، وگرنه هر اجرا
 * رکورد تازه‌ای می‌سازد و «یک نویسنده، یک هویت» می‌شکند (Prompt §22.4/§22.7).
 *
 * نام‌فضا (namespace) یک ثابت مستند است و **نباید** تغییر کند؛ عوض‌کردنش یعنی
 * هویت همهٔ رکوردهای مهاجرت‌شده عوض می‌شود.
 *
 * اجرا:
 *   node scripts/cutover/crosswalk.mjs            # خلاصه
 *   node scripts/cutover/crosswalk.mjs --write    # + docs/phase22-crosswalk.json
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODELS, recordsFromContainer } from '../../../database/models/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = resolve(ROOT, 'backend/docs/phase22-crosswalk.json');
const WRITE = process.argv.includes('--write');

/** ثابت مستند — تغییرش هویت مهاجرت را می‌شکند. */
export const TAPESH_NAMESPACE = 'f2b7c1d4-0a3e-4d5f-9c8b-7e6a5d4c3b2a';

/** همان crosswalk `inventory.mjs` — یک منبع، نه دو کپی. */
const CROSSWALK = {
  user: { table: 'users', domain: 'Auth' },
  admin: { table: 'admins', domain: 'Admin' },
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
  session: { table: 'auth_sessions', domain: 'Auth', policy: 're-login' },
};

const uuidToBytes = (uuid) => Buffer.from(uuid.replace(/-/g, ''), 'hex');
const bytesToUuid = (buffer) => {
  const hex = buffer.toString('hex');

  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
};

/** UUIDv5 (SHA-1) — مطابق RFC 4122. */
export function uuidv5(name, namespace = TAPESH_NAMESPACE) {
  const hash = createHash('sha1').update(uuidToBytes(namespace)).update(Buffer.from(name, 'utf8')).digest().subarray(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant RFC 4122

  return bytesToUuid(hash);
}

/** نام قطعی نگاشت: entity + legacy id. */
export const crosswalkName = (entity, legacyId) => `tapesh:${entity}:${legacyId}`;

const entries = [];
const perDomain = new Map();

for (const model of MODELS) {
  const target = CROSSWALK[model.name];

  if (!target) {
    continue;
  }

  const absolute = resolve(ROOT, model.file);
  let container = null;

  try {
    container = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch {
    continue;
  }

  const { records, keys } = recordsFromContainer(model, container);
  const field = model.identityField ?? 'id';

  records.forEach((record, index) => {
    const legacyId = String(record?.[field] ?? keys[index] ?? '').trim();

    if (legacyId === '') {
      return; // رکورد بی‌هویت ⇒ quarantine در import، نه حدس اینجا
    }

    entries.push({
      entity: model.name,
      domain: target.domain,
      table: target.table,
      legacyFile: model.file,
      legacyId,
      uuid: uuidv5(crosswalkName(model.name, legacyId)),
      migrationVersion: 1,
    });

    perDomain.set(target.domain, (perDomain.get(target.domain) ?? 0) + 1);
  });
}

const duplicates = entries.length - new Set(entries.map((entry) => `${entry.entity}:${entry.legacyId}`)).size;

const manifest = {
  phase: 22,
  kind: 'crosswalk',
  generatedAt: new Date().toISOString(),
  algorithm: 'uuidv5(sha1)',
  namespace: TAPESH_NAMESPACE,
  namePattern: 'tapesh:<entity>:<legacy_id>',
  totals: { entries: entries.length, duplicates, domains: perDomain.size },
  byDomain: Object.fromEntries([...perDomain.entries()].sort()),
  entries,
};

console.log(`نگاشت‌ها: ${entries.length} · تکراری: ${duplicates} · دامنه: ${perDomain.size}`);
for (const [domain, count] of [...perDomain.entries()].sort()) {
  console.log(`  · ${domain}: ${count}`);
}

if (duplicates > 0) {
  console.error('⚠️ legacy_id تکراری در یک entity — Crosswalk قطعی نیست.');
  process.exit(1);
}

if (WRITE) {
  writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log('نوشته شد: backend/docs/phase22-crosswalk.json');
}
