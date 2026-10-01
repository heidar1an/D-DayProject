/*
 * سیاههٔ لایهٔ داده + بنچمارک فایل‌های بزرگ (فاز ۱۱ پیشنهادی — بند ۱ و تست «حجم و زمان»).
 *
 * چرا وجود دارد: ادعای «۳۶ فایل JSON، بدون index/constraint» و ادعای «فایل‌های بزرگ
 * کند نیستند» تا وقتی اندازه و زمان واقعی اندازه‌گیری نشود، فقط گزارهٔ توصیفی است.
 * این ابزار:
 *   ۱) هر فایل JSON داده را فهرست می‌کند: مسیر · بایت · تعداد رکورد · شکل ذخیره‌سازی
 *   ۲) زمان parse را اندازه می‌گیرد (میانهٔ چند اجرا)
 *   ۳) زمان **نوشتن اتمیک** را با همان دو primitive واقعی `contentStore`
 *      (`writeFileSync` روی tmp + `renameSync`) اندازه می‌گیرد — اما هدف،
 *      دایرکتوری موقت است، **نه** فایل واقعی. هیچ داده‌ای بازنویسی نمی‌شود.
 *   ۴) زمان end-to-end خواندن از خودِ `contentStore` را برای بزرگ‌ترین مجموعه‌ها می‌سنجد
 *
 * بودجه: اگر بزرگ‌ترین فایل در parse یا write از سقف (`--budget-ms`، پیش‌فرض ۵۰۰)
 * بگذرد، کد خروج ۱ می‌شود. سقف عمداً سخاوتمندانه است تا رگرسیون مرتبهٔ بزرگی را
 * بگیرد، نه نوسان ماشین.
 *
 * استفاده:
 *   node scripts/persistence-benchmark.mjs
 *   node scripts/persistence-benchmark.mjs --json
 *   node scripts/persistence-benchmark.mjs --runs=11 --budget-ms=300
 */

import { existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CONTENT_DIR = join(ROOT, 'database', 'content');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const runsArg = argv.find((a) => a.startsWith('--runs='));
const budgetArg = argv.find((a) => a.startsWith('--budget-ms='));
const RUNS = runsArg ? Math.max(3, Number(runsArg.slice(7)) || 7) : 7;
const BUDGET_MS = budgetArg ? Number(budgetArg.slice(11)) || 500 : 500;
/* سقف «سربارهٔ خواندن» = زمان `readCollection` منهای هزینهٔ خام خواندن همان فایل.
   این همان هزینهٔ منطق برنامه است. پیش از اصلاح `ensureFile`، ساخت seedها در هر
   خواندن ~۴۰ms سرباره می‌ساخت؛ سقف ۲۵ms آن رگرسیون را می‌گیرد و از نوسان fs
   مستقل است. */
const OVERHEAD_BUDGET_MS = 25;
const WRITE_SAMPLE = 6; /* چند فایل بزرگ برای بنچمارک نوشتن */

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.floor(sorted.length / 2)].toFixed(2));
};

/* ───────────────────── ۱) سیاهه ───────────────────── */

function collectFiles() {
  const files = [];
  for (const name of readdirSync(CONTENT_DIR)) {
    if (name.endsWith('.json')) files.push(join(CONTENT_DIR, name));
  }
  for (const name of readdirSync(join(ROOT, 'database'))) {
    if (name.endsWith('.json')) files.push(join(ROOT, 'database', name));
  }
  return files;
}

function shapeOf(value) {
  if (Array.isArray(value)) return { kind: 'array', records: value.length };
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const arrayKeys = keys.filter((key) => Array.isArray(value[key]));
    if (arrayKeys.length === 1) return { kind: `wrapped:${arrayKeys[0]}`, records: value[arrayKeys[0]].length };
    return { kind: 'object', records: keys.length };
  }
  return { kind: typeof value, records: 0 };
}

const inventory = [];
for (const file of collectFiles()) {
  const bytes = statSync(file).size;
  const raw = readFileSync(file, 'utf8');

  const parseTimes = [];
  let parsed = null;
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = performance.now();
    parsed = JSON.parse(raw);
    parseTimes.push(performance.now() - t0);
  }
  const shape = shapeOf(parsed);

  inventory.push({
    path: relative(ROOT, file),
    bytes,
    records: shape.records,
    shape: shape.kind,
    parseMs: median(parseTimes),
  });
}

inventory.sort((a, b) => b.bytes - a.bytes);

/* ───────────────────── ۲) بنچمارک نوشتن اتمیک ───────────────────── */

const writeDir = mkdtempSync(join(tmpdir(), 'tapesh-bench-'));
const writeResults = [];

for (const entry of inventory.slice(0, WRITE_SAMPLE)) {
  const payload = JSON.parse(readFileSync(join(ROOT, entry.path), 'utf8'));
  const target = join(writeDir, entry.path.replace(/[/\\]/g, '__'));

  const times = [];
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = performance.now();
    /* همان دو primitive `contentStore.writeJsonAtomic` — ولی روی هدف موقت */
    const tmp = `${target}.tmp`;
    writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    renameSync(tmp, target);
    times.push(performance.now() - t0);
  }

  writeResults.push({ path: entry.path, bytes: entry.bytes, writeMs: median(times), outBytes: statSync(target).size });
}

rmSync(writeDir, { recursive: true, force: true });

/* ───────────────────── ۳) خواندن end-to-end از contentStore ───────────────────── */

const store = await import('../database/contentStore.js');
const collectionByFile = new Map(
  readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => [join('database', 'content', name), name.replace(/\.json$/, '')]),
);

const readResults = [];
for (const entry of inventory.slice(0, WRITE_SAMPLE)) {
  const collection = collectionByFile.get(entry.path);
  if (!collection) continue;

  /* گرم‌کردن: اولین `readCollection` کار یک‌بارهٔ `ensureStore` (همگام‌سازی
     مقاله/فلش‌کارت/میکروکورس/مراجع/بین‌الملل) را انجام می‌دهد. اگر آن در
     اندازه‌گیری بیفتد، سنجه به‌جای مسیر داغ، هزینهٔ راه‌اندازی را می‌سنجد. */
  store.readCollection(collection);
  JSON.parse(readFileSync(join(ROOT, entry.path), 'utf8'));

  const times = [];
  const rawTimes = [];
  const overheads = [];
  for (let i = 0; i < RUNS; i += 1) {
    const t0 = performance.now();
    store.readCollection(collection);
    const readMs = performance.now() - t0;
    times.push(readMs);

    const t1 = performance.now();
    JSON.parse(readFileSync(join(ROOT, entry.path), 'utf8'));
    const rawMs = performance.now() - t1;
    rawTimes.push(rawMs);

    /* سربارهٔ **جفتی** هر تکرار، نه تفاضل دو میانه: اگر بار سیستم بین دو حلقه
       جابه‌جا شود، تفاضل میانه‌ها به‌جای سرباره، نوسان بار را می‌سنجد. */
    overheads.push(readMs - rawMs);
  }
  readResults.push({
    path: entry.path,
    collection,
    readMs: median(times),
    rawMs: median(rawTimes),
    overheadMs: Number(median(overheads).toFixed(2)),
  });
}

/* ───────────────────── گزارش ───────────────────── */

const totalBytes = inventory.reduce((sum, row) => sum + row.bytes, 0);
const totalRecords = inventory.reduce((sum, row) => sum + row.records, 0);
const largestParse = Math.max(...inventory.map((row) => row.parseMs));
const largestWrite = Math.max(...writeResults.map((row) => row.writeMs));
const largestOverhead = Math.max(...readResults.map((row) => row.overheadMs));
const overBudget = largestParse > BUDGET_MS || largestWrite > BUDGET_MS || largestOverhead > OVERHEAD_BUDGET_MS;

if (asJson) {
  process.stdout.write(`${JSON.stringify({
    inventory, write: writeResults, read: readResults,
    summary: {
      files: inventory.length, totalBytes, totalRecords, runs: RUNS,
      budgetMs: BUDGET_MS, overheadBudgetMs: OVERHEAD_BUDGET_MS,
      largestParseMs: largestParse, largestWriteMs: largestWrite, largestReadOverheadMs: largestOverhead, overBudget,
    },
  }, null, 2)}\n`);
} else {
  console.log('══ سیاههٔ فایل‌های داده (بزرگ‌ترین ۱۵) ══');
  console.log('بایت      رکورد   parse(ms)  شکل                    مسیر');
  for (const row of inventory.slice(0, 15)) {
    console.log(`${String(row.bytes).padStart(8)}  ${String(row.records).padStart(6)}  ${String(row.parseMs).padStart(9)}  ${row.shape.padEnd(22)}  ${row.path}`);
  }

  console.log('');
  console.log('══ نوشتن اتمیک (tmp → rename، هدف موقت) ══');
  console.log('بایت      write(ms)  مسیر');
  for (const row of writeResults) {
    console.log(`${String(row.bytes).padStart(8)}  ${String(row.writeMs).padStart(9)}  ${row.path}`);
  }

  console.log('');
  console.log('══ خواندن از contentStore — سربارهٔ منطق برنامه، جدا از هزینهٔ fs ══');
  console.log('read(ms)   raw(ms)  overhead(ms)  مجموعه                مسیر');
  for (const row of readResults) {
    console.log(`${String(row.readMs).padStart(8)}  ${String(row.rawMs).padStart(7)}  ${String(row.overheadMs).padStart(12)}  ${row.collection.padEnd(20)}  ${row.path}`);
  }

  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`فایل‌های داده: ${inventory.length} · مجموع ${(totalBytes / 1024).toFixed(1)}KB · ${totalRecords} رکورد`);
  console.log(`تکرار هر سنجه: ${RUNS} · سقف بودجه parse/write: ${BUDGET_MS}ms · سقف سربارهٔ خواندن: ${OVERHEAD_BUDGET_MS}ms`);
  console.log(`کندترین parse: ${largestParse}ms · کندترین write اتمیک: ${largestWrite}ms · بیشترین سربارهٔ خواندن: ${largestOverhead}ms`);
  console.log(overBudget ? 'نتیجه: از سقف بودجه گذشت' : 'نتیجه: در بودجه');
  console.log('هیچ فایل دادهٔ واقعی بازنویسی نشد (هدف بنچمارک نوشتن، دایرکتوری موقت بود).');
  console.log('⚠️ ستون raw شامل هزینهٔ سیستم فایلِ همین محیط است؛ برای مقایسهٔ منطق برنامه به ستون overhead نگاه کن.');
}

process.exitCode = overBudget ? 1 : 0;
