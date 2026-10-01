#!/usr/bin/env node
/*
 * نقشهٔ منابع داده و diff واقعی میان منابع موازی — `npm run data:sources`
 *
 * ── چرا این ابزار وجود دارد ────────────────────────────────────────────────
 * در Audit این ادعا مطرح شد که چند دامنه «دو منبع داده» دارند (JSON سرور در برابر
 * `mockData` کلاینت). ادعا کافی نیست: تا وقتی دو منبع **واقعاً** diff نشوند،
 * نمی‌دانیم کدام canonical است و حذف هیچ‌کدام مجاز نیست.
 *
 * این ابزار فقط می‌خواند و چیزی نمی‌نویسد. خروجی‌اش قطعی (deterministic) است.
 *
 * ── قانون داوری «منبع حقیقت» ───────────────────────────────────────────────
 * canonical فقط وقتی اعلام می‌شود که **مسیر خواندن در کد** آن را اثبات کند.
 * «فایل تازه‌تر» یا «فایل بزرگ‌تر» شاهد نیست. هر داوری یک `evidence` دارد که
 * فایل و تابع را نام می‌برد. اگر شاهدی نبود، حکم `UNKNOWN` است.
 *
 * گزینه‌ها:
 *   --json      خروجی ماشین‌خوان
 *   --domain=X  فقط یک دامنه
 */

import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const OPTIONS = {
  json: args.includes('--json'),
  domain: (args.find((arg) => arg.startsWith('--domain=')) ?? '').slice('--domain='.length) || null,
};

const readJson = (relative) => {
  const path = resolve(ROOT, relative);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

/** آرایهٔ رکورد از یک فایل، با پذیرش ظرف‌های مختلف. */
const rowsOf = (value, key) => {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value[key])) return value[key];
  return [];
};

const sorted = (list) => [...list].map(String).sort();

/* ─────────────── بارگذارِ ماژول ایستا: سه حالتِ صریح ───────────────
 *
 * ⚠️ چرا لازم است: الگوی `try { await import(p) } catch {}` **شکستِ خواندن** را
 * بی‌صدا می‌بلعد و دامنه در مستندات به‌عنوان «وجود ندارد» ثبت می‌شود — در حالی
 * که فایل هست و فقط import بدون پسوند دارد (`from './articleCatalog'`) که Vite
 * حلش می‌کند ولی Node ESM نه (`ERR_MODULE_NOT_FOUND`).
 *
 * پس سه حالت از هم جدا می‌شوند و در گزارش هم جدا نمایش داده می‌شوند:
 *   loaded  → با `import` مستقیم خوانده شد
 *   bundled → با esbuild باندل شد و بعد خوانده شد (import بدون پسوند حل شد)
 *   failed  → خوانده **نشد** (خطا ثبت می‌شود؛ هرگز «وجود ندارد» گفته نمی‌شود)
 *   missing → فایل واقعاً وجود ندارد
 */
const MODULE_STATE = new Map();

async function bundleWithEsbuild(relative) {
  const bin = resolve(ROOT, 'node_modules/.bin/esbuild');
  if (!existsSync(bin)) return { module: null, error: 'esbuild در node_modules نیست' };

  const dir = mkdtempSync(resolve(tmpdir(), 'data-sources-'));
  const out = resolve(dir, 'bundle.mjs');
  try {
    execFileSync(bin, [
      relative, '--bundle', '--format=esm', '--platform=node', '--charset=utf8',
      /* تصویر/فونت فقط برای ماژول لازم‌اند؛ محتوایشان برای diff بی‌اثر است. */
      '--loader:.png=empty', '--loader:.webp=empty', '--loader:.jpg=empty', '--loader:.jpeg=empty',
      '--loader:.svg=empty', '--loader:.woff2=empty', '--loader:.css=empty',
      `--outfile=${out}`,
    ], { cwd: ROOT, stdio: 'pipe' });
    const module = await import(pathToFileURL(out).href);
    return { module, error: null };
  } catch (error) {
    const detail = String(error?.stderr ?? error?.message ?? error).replace(/\s+/g, ' ').slice(0, 240);
    return { module: null, error: detail };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function loadStatic(relative) {
  if (MODULE_STATE.has(relative)) return MODULE_STATE.get(relative);
  const path = resolve(ROOT, relative);
  if (!existsSync(path)) {
    const state = { state: 'missing', module: null, error: null, exports: [] };
    MODULE_STATE.set(relative, state);
    return state;
  }
  try {
    const module = await import(path);
    const state = { state: 'loaded', module, error: null, exports: Object.keys(module) };
    MODULE_STATE.set(relative, state);
    return state;
  } catch (directError) {
    const bundled = await bundleWithEsbuild(relative);
    const state = bundled.module
      ? { state: 'bundled', module: bundled.module, error: directError.code ?? directError.message, exports: Object.keys(bundled.module) }
      : { state: 'failed', module: null, error: bundled.error, exports: [] };
    MODULE_STATE.set(relative, state);
    return state;
  }
}

/** آرایهٔ رکورد از یک ماژول ایستا — یا `null` اگر خوانده نشد/آرایه نبود. */
const staticRows = (relative, exportName) => {
  const loaded = MODULE_STATE.get(relative);
  const value = loaded?.module?.[exportName];
  return Array.isArray(value) ? value : null;
};

/* ─────────────────────────── کمکی‌های diff ─────────────────────────── */

/**
 * diff کلیدی دو فهرست رکورد.
 * @returns {{a:string, b:string, keyA:string, keyB:string, countA:number, countB:number,
 *            onlyA:string[], onlyB:string[], shared:number}}
 */
function diffKeys({ a, b, keyA, keyB = keyA, labelA, labelB }) {
  const mapA = new Map(a.map((row) => [row?.[keyA], row]).filter(([key]) => key !== undefined && key !== null));
  const mapB = new Map(b.map((row) => [row?.[keyB], row]).filter(([key]) => key !== undefined && key !== null));
  const onlyA = [...mapA.keys()].filter((key) => !mapB.has(key));
  const onlyB = [...mapB.keys()].filter((key) => !mapA.has(key));
  return {
    a: labelA, b: labelB, keyA, keyB,
    countA: mapA.size, countB: mapB.size,
    onlyA: sorted(onlyA), onlyB: sorted(onlyB),
    shared: [...mapA.keys()].filter((key) => mapB.has(key)).length,
  };
}

/**
 * diff فیلدی روی رکوردهای هم‌کلید.
 * نتیجه بر اساس «امضای اختلاف» گروه‌بندی می‌شود تا گزارش خوانا بماند.
 */
function diffFields(a, b, keyA, keyB = keyA) {
  const mapB = new Map(b.map((row) => [row?.[keyB], row]));
  const groups = new Map();
  let identical = 0;

  for (const rowA of a) {
    const rowB = mapB.get(rowA?.[keyA]);
    if (!rowB) continue;
    const keysA = Object.keys(rowA);
    const keysB = Object.keys(rowB);
    const onlyA = keysA.filter((key) => !keysB.includes(key));
    const onlyB = keysB.filter((key) => !keysA.includes(key));
    const differing = keysA.filter((key) => keysB.includes(key)
      && JSON.stringify(rowA[key]) !== JSON.stringify(rowB[key]));

    if (!onlyA.length && !onlyB.length && !differing.length) {
      identical += 1;
      continue;
    }
    const signature = `onlyA:[${sorted(onlyA).join(',')}]|onlyB:[${sorted(onlyB).join(',')}]|diff:[${sorted(differing).join(',')}]`;
    if (!groups.has(signature)) groups.set(signature, { onlyA: sorted(onlyA), onlyB: sorted(onlyB), differing: sorted(differing), count: 0 });
    groups.get(signature).count += 1;
  }

  return { identical, total: a.length, groups: [...groups.values()].sort((x, y) => y.count - x.count) };
}

/* ─────────────────────────── منابع ─────────────────────────── */

/* رجیستری میکرودرسنامه: شناسهٔ محلی (`physiology`) در برابر شناسهٔ پنل (`mcr-physiology`). */
await loadStatic('src/data/micro/registry.js');
await loadStatic('src/services/testBank/mockData.js');
/* ⚠️ این‌ها قبلاً با `try/import/catch` خوانده می‌شدند و `rows: null` می‌گرفتند؛
   در حالی که آرایهٔ رکورد دارند و diff واقعی‌شان هرگز انجام نشده بود. */
await loadStatic('src/services/wiki/mockData.js');
await loadStatic('src/services/flashcards/mockData.js');
await loadStatic('src/services/international/intlCatalog.js');
await loadStatic('src/services/international/mockData.js');
await loadStatic('src/services/notes/mockData.js');
await loadStatic('src/services/references/referenceCatalog.js');
await loadStatic('src/services/league/mockData.js');
await loadStatic('src/services/analytics/mockData.js');
await loadStatic('src/services/articles/articleCatalog.js');
await loadStatic('src/services/articles/mockData.js');

const microRegistry = MODULE_STATE.get('src/data/micro/registry.js')?.module ?? null;
const testBankMock = MODULE_STATE.get('src/services/testBank/mockData.js')?.module ?? null;

const microCoursesJson = rowsOf(readJson('database/content/microCourses.json'), 'courses');
const microCoursesStatic = microRegistry ? Object.values(microRegistry.MICRO_COURSE_REGISTRY) : [];

/* رکوردهای سمت سرور که چند دامنه به آن‌ها نیاز دارند (یک‌بار خوانده می‌شوند). */
const articlesJson = rowsOf(readJson('database/content/articles.json'), 'articles');
const flashcardDecksJson = rowsOf(readJson('database/content/flashcardDecks.json'), 'decks');
const referencesJson = rowsOf(readJson('database/content/references.json'), 'references');
const intlCoursesJson = rowsOf(readJson('database/content/intlCourses.json'), 'courses');

const testBankJson = rowsOf(readJson('database/content/testBankQuestions.json'), 'questions');
const testBankStatic = testBankMock?.QUESTIONS ?? [];

const DOMAINS = [
  {
    id: 'microCourses',
    title: 'میکرودرسنامه',
    sources: [
      { kind: 'server-json', path: 'database/content/microCourses.json', rows: microCoursesJson, key: 'id' },
      { kind: 'static-js', path: 'src/data/micro/registry.js', rows: microCoursesStatic, key: 'id' },
    ],
    /*
     * کلید اتصال `subjectId` است نه `id`: رجیستری `physiology` دارد و پنل
     * `mcr-physiology`. شاهد در `microContentService.publishedCourse`.
     */
    diff: diffKeys({
      a: microCoursesJson, b: microCoursesStatic, keyA: 'subjectId', keyB: 'subjectId',
      labelA: 'پنل (JSON)', labelB: 'رجیستری ثابت',
    }),
    canonical: {
      verdict: 'SERVER-WHEN-PUBLISHED',
      statement: 'نسخهٔ پنل برای درسِ **منتشرشده** جای رجیستری را می‌گیرد؛ برای درس منتشرنشده رجیستری پاسخ می‌دهد.',
      evidence: 'src/services/micro/microContentService.js → getCourseSync/getCourse: `publishedCourse(id) ?? COURSE_REGISTRY[id]`؛ publishedCourse فقط رکوردهای /api/public/micro/library را می‌بیند.',
    },
  },
  {
    id: 'testBankQuestions',
    title: 'بانک تست',
    sources: [
      { kind: 'server-json', path: 'database/content/testBankQuestions.json', rows: testBankJson, key: 'id' },
      { kind: 'static-js', path: 'src/services/testBank/mockData.js', rows: testBankStatic, key: 'id' },
    ],
    diff: diffKeys({
      a: testBankJson, b: testBankStatic, keyA: 'id',
      labelA: 'پنل (JSON)', labelB: 'mockData کلاینت',
    }),
    fieldDiff: diffFields(testBankJson, testBankStatic, 'id'),
    canonical: {
      verdict: 'SERVER',
      statement: 'پاسخ سرور **درجای** آرایهٔ mockData را بازنویسی می‌کند؛ پس mockData فقط seed و fallback پیش از hydration است.',
      evidence: 'src/services/testBank/testBankService.js → loadPublishedQuestions: `QUESTIONS.splice(0, QUESTIONS.length, ...payload.data.questions)` از /api/public/test-bank/questions.',
    },
  },
  {
    id: 'wiki',
    title: 'ویکی',
    sources: [
      { kind: 'static-js', path: 'src/services/wiki/mockData.js', export: 'WIKI_ENTITIES', rows: staticRows('src/services/wiki/mockData.js', 'WIKI_ENTITIES'), key: 'slug' },
    ],
    canonical: {
      verdict: 'CLIENT-STATIC',
      statement: 'هیچ مجموعهٔ سروری برای ویکی وجود ندارد؛ تنها منبع، ماژول ایستای کلاینت است.',
      evidence: 'در `database/models/` هیچ Schema یا مجموعه‌ای به نام wiki نیست و `database/content/` فایل wiki ندارد.',
    },
  },
  {
    id: 'flashcards',
    title: 'فلش‌کارت',
    sources: [
      { kind: 'server-json', path: 'database/content/flashcardDecks.json', rows: flashcardDecksJson, key: 'id' },
      { kind: 'static-js', path: 'src/services/flashcards/mockData.js', export: 'TAPESH_DECKS', rows: staticRows('src/services/flashcards/mockData.js', 'TAPESH_DECKS'), key: 'id' },
      { kind: 'static-js', path: 'src/services/flashcards/mockData.js', export: 'TAPESH_CARDS', rows: staticRows('src/services/flashcards/mockData.js', 'TAPESH_CARDS'), key: 'id' },
    ],
    diff: diffKeys({
      a: flashcardDecksJson, b: staticRows('src/services/flashcards/mockData.js', 'TAPESH_DECKS') ?? [], keyA: 'id',
      labelA: 'پنل (JSON)', labelB: 'mockData کلاینت',
    }),
    canonical: {
      verdict: 'SERVER-WHEN-PUBLISHED',
      statement: 'نسخهٔ منتشرشدهٔ پنل «جای» نسخهٔ ثابت را می‌گیرد (بر پایهٔ id، نه کنار آن)؛ ثابت‌ها فقط دک‌های منتشرنشده را پر می‌کنند و fallback آفلاین‌اند. سرور خودش ثابت‌ها را با syncFlashcardDecks() به رکورد تبدیل و منتشر می‌کند.',
      evidence: 'flashcardService.js:83-89 (fetch /api/public/flashcards/library) · :106-113 (کامنت قرارداد «جای، نه کنار» + دلیل دوبرابرشدن) · :118-124 tapeshDecks() = publishedDecks + TAPESH_DECKS.filter(!published.has(id)) · :127-133 tapeshCards() با همان الگو',
    },
  },
  {
    id: 'international',
    title: 'دوره‌های بین‌الملل',
    sources: [
      { kind: 'server-json', path: 'database/content/intlCourses.json', rows: intlCoursesJson, key: 'id' },
      { kind: 'server-json', path: 'database/content/intlProviders.json', rows: rowsOf(readJson('database/content/intlProviders.json'), 'providers'), key: 'id' },
      { kind: 'static-js', path: 'src/services/international/intlCatalog.js', export: 'INTL_COURSE_CATALOG', rows: staticRows('src/services/international/intlCatalog.js', 'INTL_COURSE_CATALOG'), key: 'id' },
      { kind: 'static-js', path: 'src/services/international/intlCatalog.js', export: 'INTL_PROVIDER_CATALOG', rows: staticRows('src/services/international/intlCatalog.js', 'INTL_PROVIDER_CATALOG'), key: 'id' },
      { kind: 'static-js', path: 'src/services/international/mockData.js', export: 'EXAMS', rows: staticRows('src/services/international/mockData.js', 'EXAMS'), key: 'id' },
    ],
    diff: diffKeys({
      a: intlCoursesJson, b: staticRows('src/services/international/intlCatalog.js', 'INTL_COURSE_CATALOG') ?? [], keyA: 'id',
      labelA: 'پنل (JSON)', labelB: 'کاتالوگ ایستا',
    }),
    canonical: {
      verdict: 'SERVER-WHEN-PUBLISHED',
      statement: 'فهرست منتشرشدهٔ غیرخالی «جای» کاتالوگ ثابت را کاملاً می‌گیرد؛ فهرست خالی یعنی «هنوز چیزی منتشر نشده» و کاتالوگ را پاک نمی‌کند. providers منتشرنشده به INTL_PROVIDER_CATALOG برمی‌گردند. seed سرور هر ۶ دورهٔ ثابت را یک‌بار به رکورد تبدیل می‌کند، پس ادغام، دوبرابر می‌ساخت.',
      evidence: 'intlCoursesService.js:1-8 (کامنت قرارداد «جای، نه کنار» + دلیل) · :70-110 loadIntlCatalog() — fetch /api/public/intl-courses/library · :89-92 (فقط فهرست غیرخالی جایگزین می‌شود + fallback منابع) · :98-99 (آفلاین ⇒ ثابت می‌ماند)',
    },
  },
  {
    id: 'notes',
    title: 'یادداشت‌ها',
    sources: [
      { kind: 'server-json', path: 'database/content/notes.json', rows: rowsOf(readJson('database/content/notes.json'), 'notes'), key: 'id' },
      { kind: 'static-js', path: 'src/services/notes/mockData.js', rows: null, key: 'id', note: 'فقط ثابت‌های UI (NOTE_COLORS/NOTE_KINDS/SOURCE_TYPES/SUBJECTS/TAG_COLORS) — هیچ آرایهٔ رکوردی ندارد' },
    ],
    canonical: {
      verdict: 'NO-OVERLAP',
      statement: '`notes/mockData.js` فقط ثابت‌های UI (رنگ، نوع، درس) دارد و **هیچ رکوردی** حمل نمی‌کند ⇒ رقابتی با JSON سرور ندارد.',
      evidence: 'src/services/notes/mockData.js فقط NOTE_COLORS/NOTE_KINDS/SOURCE_TYPES/SUBJECTS/TAG_COLORS را export می‌کند.',
    },
  },
  {
    id: 'references',
    title: 'منابع مرجع',
    sources: [
      { kind: 'server-json', path: 'database/content/references.json', rows: referencesJson, key: 'id' },
      { kind: 'static-js', path: 'src/services/references/referenceCatalog.js', export: 'REFERENCE_CATALOG', rows: staticRows('src/services/references/referenceCatalog.js', 'REFERENCE_CATALOG'), key: 'id' },
    ],
    diff: diffKeys({
      a: referencesJson, b: staticRows('src/services/references/referenceCatalog.js', 'REFERENCE_CATALOG') ?? [], keyA: 'id',
      labelA: 'پنل (JSON)', labelB: 'کاتالوگ ایستا',
    }),
    canonical: {
      verdict: 'NO-OVERLAP',
      statement: 'ادعای Audit دربارهٔ `src/services/references/mockData.js` نادرست است؛ چنین فایلی وجود ندارد. تنها فایل این پوشه `referenceCatalog.js` است.',
      evidence: '`ls src/services/references/` → فقط referenceCatalog.js.',
    },
  },
  {
    id: 'league',
    title: 'لیگ',
    sources: [{
      kind: 'static-js',
      path: 'src/services/league/mockData.js',
      rows: null,
      key: 'id',
      note: 'بستهٔ دموی کامل (۲۴ export: GLOBAL_TOP/BATTLES/DUEL/SEASON/…) — یک آرایهٔ واحد نیست و رکورد پنل هم ندارد',
    }],
    canonical: {
      verdict: 'CLIENT-STATIC',
      statement: 'لیگ کاملاً کلاینت‌محور است و هیچ مجموعهٔ سروری ندارد.',
      evidence: 'هیچ Schema یا فایل دادهٔ سروری برای league وجود ندارد.',
    },
  },
  {
    id: 'analytics',
    title: 'تحلیل',
    sources: [
      { kind: 'server-json', path: 'database/content/alerts.json', rows: rowsOf(readJson('database/content/alerts.json'), 'alerts'), key: 'id' },
      { kind: 'static-js', path: 'src/services/analytics/mockData.js', rows: null, key: 'id' },
    ],
    canonical: {
      verdict: 'SERVER',
      statement: 'دادهٔ تحلیلی در زمان اجرا از سرور می‌آید (events.json از طریق analyticsStore و مسیرهای /api/admin/analytics/*، به‌همراه نشست‌های testBank و پیشرفت micro). فایل analytics/mockData.js هیچ آرایهٔ رکوردی ندارد — تنها export آن تابع مولد generateMockHistory است و در کل src/ و server.js و database/ هیچ importer ندارد ⇒ کد مرده.',
      evidence: 'analyticsService.js:22-33 (منبع داده: testBank/mockData + testBankService + microProgress + analyticsEngine — نه mockData خودِ analytics) · mockData.js:284 (تنها export = generateMockHistory) · جست‌وجوی generateMockHistory در src/ و server.js و database/ ⇒ فقط تعریف، بدون مصرف‌کننده',
    },
  },
  /*
   * ⚠️ این دامنه بعداً اضافه شد (نشست بازبینی §۴۶). نسخهٔ اول این ابزار
   * `articles` را نداشت و یادداشت همراهِ آن ادعا می‌کرد
   * `src/services/articles/mockData.js` **وجود ندارد** — که نادرست است.
   *
   * چرا اول «خوانده‌نشده» بود: `articles/mockData.js` با import بدون پسوند
   * (`from './articleCatalog'`) و با import تصویر نوشته شده. حالا با بارگذارِ
   * سه‌حالته خوانده می‌شود؛ ولی `articleCatalog.js` که **خودِ داده** را دارد و
   * هیچ import ندارد، منبع مرجع برای diff است.
   */
  {
    id: 'articles',
    title: 'مقالات',
    sources: [
      { kind: 'server-json', path: 'database/content/articles.json', rows: articlesJson, key: 'slug' },
      { kind: 'static-js', path: 'src/services/articles/articleCatalog.js', export: 'ARTICLE_CATALOG', rows: staticRows('src/services/articles/articleCatalog.js', 'ARTICLE_CATALOG'), key: 'slug' },
      {
        kind: 'static-js',
        path: 'src/services/articles/mockData.js',
        export: 'ARTICLES',
        rows: staticRows('src/services/articles/mockData.js', 'ARTICLES'),
        key: 'slug',
        note: 'ARTICLES = ARTICLE_CATALOG.map(...) ⇒ هیچ رکورد تازه‌ای اضافه نمی‌کند؛ فقط `cover` را از نگاشت تصویر پر می‌کند',
      },
    ],
    diff: diffKeys({
      a: articlesJson, b: staticRows('src/services/articles/articleCatalog.js', 'ARTICLE_CATALOG') ?? [], keyA: 'slug',
      labelA: 'پنل (JSON)', labelB: 'کاتالوگ ایستا',
    }),
    canonical: {
      verdict: 'SERVER',
      statement: 'رکورد سرور **جای** مقالهٔ ثابت را می‌گیرد و مقالات منتشرنشدهٔ پنل کنار نسخهٔ ایستا می‌مانند؛ پس `mockData` فقط seed و fallback است.',
      evidence: 'src/services/articles/articlesService.js:152-154 → `if (!cmsArticles.length) return ARTICLES;` و `[...cmsArticles, ...ARTICLES.filter((a) => !published.has(a.slug))]` از GET /api/public/articles. seed یک‌باره: database/contentStore.js:531 `syncArticles()` از `../src/services/articles/articleCatalog.js` (خط ۶۱).',
    },
  },
];

/* ─────────────────────────── گزارش ─────────────────────────── */

const selected = OPTIONS.domain ? DOMAINS.filter((domain) => domain.id === OPTIONS.domain) : DOMAINS;
const verdictLabel = {
  SERVER: 'سرور canonical است',
  'SERVER-WHEN-PUBLISHED': 'سرور برای رکورد منتشرشده canonical است',
  'CLIENT-STATIC': 'کلاینت تنها منبع است',
  'NO-OVERLAP': 'هم‌پوشانی رکوردی ندارد',
  UNKNOWN: 'UNKNOWN — اثبات‌نشده',
};

const MODULE_STATE_LABEL = {
  loaded: 'خوانده شد',
  bundled: 'با esbuild باندل و خوانده شد',
  failed: 'خوانده **نشد**',
  missing: 'فایل وجود ندارد',
};

/**
 * چرا یک منبع رکورد ندارد — «نبود» و «خوانده‌نشد» باید از هم جدا باشند.
 * قبلاً همه‌شان یک برچسب می‌گرفتند: «ثابت‌های UI / خوانده‌نشده» که هم مبهم
 * بود و هم باعث شد یک دامنهٔ موجود به‌عنوان «وجود ندارد» ثبت شود.
 */
function describeSource(source) {
  if (Array.isArray(source.rows)) {
    return `${source.rows.length} رکورد${source.export ? `  (${source.export})` : ''}`;
  }
  if (source.note) return `بدون رکورد — ${source.note}`;
  const loaded = MODULE_STATE.get(source.path);
  if (loaded) {
    const label = MODULE_STATE_LABEL[loaded.state] ?? loaded.state;
    const exports = loaded.exports.length ? `  (${loaded.exports.length} export)` : '';
    return `بدون رکورد — ${label}${exports}${loaded.error ? ` — ${loaded.error}` : ''}`;
  }
  return 'بدون رکورد — آرایهٔ رکورد اعلام‌نشده';
}

if (OPTIONS.json) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    moduleStates: [...MODULE_STATE.entries()].map(([path, state]) => ({
      path, state: state.state, exports: state.exports, error: state.error,
    })),
    domains: selected,
  }, null, 2));
} else {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  نقشهٔ منابع داده و diff واقعی — تپش');
  console.log('═══════════════════════════════════════════════════════════════════');

  for (const domain of selected) {
    console.log('');
    console.log(`── ${domain.title} (${domain.id}) ──`);
    for (const source of domain.sources) {
      console.log(`  [${source.kind}] ${source.path}  —  ${describeSource(source)}`);
    }

    if (domain.diff) {
      const d = domain.diff;
      console.log(`  diff: ${d.a}=${d.countA}  ${d.b}=${d.countB}  مشترک=${d.shared}`);
      console.log(`    فقط در ${d.a}: ${d.onlyA.length}${d.onlyA.length ? `  (${d.onlyA.slice(0, 6).join(', ')}${d.onlyA.length > 6 ? ' …' : ''})` : ''}`);
      console.log(`    فقط در ${d.b}: ${d.onlyB.length}${d.onlyB.length ? `  (${d.onlyB.slice(0, 6).join(', ')}${d.onlyB.length > 6 ? ' …' : ''})` : ''}`);
    }

    if (domain.fieldDiff) {
      const f = domain.fieldDiff;
      console.log(`  diff فیلدی: ${f.identical}/${f.total} رکورد کاملاً یکسان`);
      for (const group of f.groups) {
        console.log(`    ×${group.count}  فقط-پنل:[${group.onlyA.join(',')}]  فقط-ایستا:[${group.onlyB.join(',')}]  مقدار متفاوت:[${group.differing.join(',')}]`);
      }
    }

    console.log(`  داوری منبع حقیقت: ${verdictLabel[domain.canonical.verdict]}`);
    console.log(`    ${domain.canonical.statement}`);
    if (domain.canonical.evidence) console.log(`    شاهد: ${domain.canonical.evidence}`);
  }

  const unknown = selected.filter((domain) => domain.canonical.verdict === 'UNKNOWN').length;
  console.log('');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`  دامنه: ${selected.length}   داوری‌شده: ${selected.length - unknown}   UNKNOWN: ${unknown}`);
  console.log('  ⓘ این ابزار فقط می‌خواند؛ هیچ فایلی نوشته یا حذف نشد.');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('');
}
