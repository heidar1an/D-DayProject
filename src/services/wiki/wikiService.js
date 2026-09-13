/* ── لایه سرویس ویکی تپش (Tapesh Knowledge Engine API) ──
   قرارداد API برای اتصال به بک‌اند:
     GET  /wiki/search?q=&subject=&type=&difficulty=&sort=   → searchWiki()
     GET  /wiki/suggest?q=                                   → suggestWiki()
     GET  /wiki/home                                         → getHomeData()
     GET  /wiki/articles/:slug                               → getArticle()
     GET  /wiki/subjects                                     → getSubjects()
     POST /wiki/bookmarks/:slug | DELETE /wiki/bookmarks/:slug
     GET/POST/DELETE recent-searches
   الان همه‌چیز با داده موک + localStorage جواب می‌دهد؛ برای اتصال به بک‌اند کافی است
   هر تابع به fetch همین مسیرها تبدیل شود — هیچ کامپوننتی به جزئیات mock وابسته نیست.
   تأخیرهای مصنوعی (delay) فقط برای شبیه‌سازی شبکه و نمایش skeleton هستند. */

import {
  WIKI_ENTITIES,
  SUBJECTS,
  CONTENT_TYPES,
  RELATIONS,
  HOT_SEARCHES,
} from './mockData';
import {
  searchWiki as engineSearch,
  suggestWiki as engineSuggest,
  getHotSearches,
  normalize,
  buildSnippet,
} from './searchEngine';

const delay = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── داده‌های کاربر (بوکمارک/تاریخچه) — الان localStorage؛ در بک‌اند POST/DELETE می‌شوند ── */
const STORE_PREFIX = 'tapesh:wiki:v1';

const readStore = (key, fallback) => {
  try {
    const raw = localStorage.getItem(`${STORE_PREFIX}:${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeStore = (key, value) => {
  try {
    localStorage.setItem(`${STORE_PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    /* حافظه در دسترس نیست — خواندن همچنان کار می‌کند */
  }
};

/* ─────────────────────────── متادیتای نمایش ─────────────────────────── */

export const SUBJECT_META = SUBJECTS;
export const TYPE_META = CONTENT_TYPES;
export const RELATION_LABELS = RELATIONS;

export const subjectLabel = (id) => SUBJECTS.find((s) => s.id === id)?.label ?? id;
export const subjectAccent = (id) => SUBJECTS.find((s) => s.id === id)?.accent ?? '#8a8a8a';
export const typeLabel = (type) => CONTENT_TYPES[type]?.label ?? type;

/* شمارش موجودیت هر درس — برای کارت‌های دسته‌بندی صفحه اصلی */
export const getSubjectStats = () =>
  SUBJECTS.map((subject) => ({
    ...subject,
    count: WIKI_ENTITIES.filter((entity) => entity.subject === subject.id).length,
  })).filter((subject) => subject.count > 0);

/* ─────────────────────────── API جست‌وجو ─────────────────────────── */

/* GET /wiki/search — صفحه کامل نتایج: نتیجه اصلی، نتایج مرتبط، فست‌ها و اصلاح عبارت */
export async function searchWiki(query, options = {}) {
  await delay(query ? 240 : 80);
  const response = engineSearch(query, options);

  /* اسنیپت گوگل‌مانند برای نتیجه اصلی و نتایج مرتبط — یکجا در سرویس تا UI فقط نمایش بدهد */
  const withSnippet = (entry) => ({
    ...entry,
    snippet: entry ? buildSnippet(entry.doc.entity, query) : null,
  });

  return {
    ...response,
    primary: response.primary ? withSnippet(response.primary) : null,
    results: response.results.map(withSnippet),
  };
}

/* GET /wiki/suggest — پیشنهادهای زنده هنگام تایپ */
export function suggestWiki(query, options = {}) {
  return engineSuggest(query, options);
}

/* GET /wiki/browse?subject=&type=&difficulty=&sort= — مرور بدون عبارت جست‌وجو
   (کلیک روی کارت درس‌ها از صفحه اصلی). خروجی هم‌شکل searchWiki است تا UI یکی باشد. */
export async function browseWiki({ filters = {}, sort = 'popular' } = {}) {
  await delay(200);

  const passes = (entity) =>
    (!filters.subject || entity.subject === filters.subject) &&
    (!filters.type || entity.type === filters.type) &&
    (!filters.difficulty || entity.difficulty === filters.difficulty);

  const entities = WIKI_ENTITIES.filter(passes);
  const sorters = {
    popular: (a, b) => b.popularity - a.popularity,
    recent: (a, b) => b.lastUpdated.localeCompare(a.lastUpdated),
    title: (a, b) => a.title.localeCompare(b.title, 'fa'),
  };
  const sorted = [...entities].sort(sorters[sort] ?? sorters.popular);

  const bySubject = {};
  const byType = {};
  const byDifficulty = {};
  entities.forEach((entity) => {
    bySubject[entity.subject] = (bySubject[entity.subject] ?? 0) + 1;
    byType[entity.type] = (byType[entity.type] ?? 0) + 1;
    byDifficulty[entity.difficulty] = (byDifficulty[entity.difficulty] ?? 0) + 1;
  });

  return {
    query: '',
    total: entities.length,
    primary: null,
    results: sorted.map((entity) => ({
      doc: { entity },
      score: entity.popularity,
      snippet: { text: entity.summary, match: null },
    })),
    didYouMean: null,
    relatedSearches: [],
    facets: { bySubject, byType, byDifficulty },
  };
}

/* ─────────────────────────── صفحه اصلی ─────────────────────────── */

/* GET /wiki/home — آمار، درس‌ها، پرجست‌وجوها و آخرین به‌روزرسانی‌ها */
export async function getHomeData() {
  await delay(200);

  const stats = {
    articles: WIKI_ENTITIES.length,
    subjects: new Set(WIKI_ENTITIES.map((entity) => entity.subject)).size,
    topics: new Set(WIKI_ENTITIES.map((entity) => entity.topic)).size,
    relations: WIKI_ENTITIES.reduce((sum, entity) => sum + entity.related.length, 0),
  };

  const popular = [...WIKI_ENTITIES]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 6);

  const recent = [...WIKI_ENTITIES]
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
    .slice(0, 5);

  return {
    stats,
    subjects: getSubjectStats(),
    popular,
    recent,
    hotSearches: getHotSearches(),
  };
}

/* ─────────────────────────── مقاله ─────────────────────────── */

/* GET /wiki/articles/:slug — مقاله کامل + همسایه‌های گراف دانش */
export async function getArticle(slug) {
  await delay(260);
  const article = WIKI_ENTITIES.find((entity) => entity.slug === slug);
  if (!article) throw new Error('ARTICLE_NOT_FOUND');

  /* همسایه‌های گراف: موجودیت هدف هر رابطه + برچسب فارسی رابطه */
  const related = article.related
    .map(({ slug: targetSlug, relation }) => {
      const target = WIKI_ENTITIES.find((entity) => entity.slug === targetSlug);
      if (!target) return null;
      return {
        slug: target.slug,
        title: target.title,
        englishTitle: target.englishTitle,
        type: target.type,
        subject: target.subject,
        summary: target.summary,
        relation,
        relationLabel: RELATIONS[relation] ?? 'مرتبط با',
      };
    })
    .filter(Boolean);

  /* روابط برگشتی: چه موجودیت‌هایی به این مقاله اشاره کرده‌اند؛ آن‌هایی که در روابط
     مستقیم همین مقاله هستند دوباره نمایش داده نمی‌شوند تا کارت‌ها تکراری نشوند */
  const relatedSlugs = new Set(article.related.map(({ slug: targetSlug }) => targetSlug));
  const backlinks = WIKI_ENTITIES.filter(
    (entity) =>
      entity.slug !== slug &&
      !relatedSlugs.has(entity.slug) &&
      entity.related.some(({ slug: targetSlug }) => targetSlug === slug),
  ).map((entity) => ({
    slug: entity.slug,
    title: entity.title,
    englishTitle: entity.englishTitle,
    type: entity.type,
    subject: entity.subject,
    summary: entity.summary,
    relation: 'related_to',
    relationLabel: 'ارجاع از',
  }));

  return { article, related, backlinks };
}

/* GET /wiki/articles — فهرست کامل (برای سایدبارها و استفاده‌های بعدی) */
export function listArticles() {
  return WIKI_ENTITIES.map(({ sections, keyFacts, ...meta }) => meta);
}

export const findArticle = (slug) => WIKI_ENTITIES.find((entity) => entity.slug === slug);

/* ─────────────────────────── بوکمارک ─────────────────────────── */

export function getBookmarks() {
  return readStore('bookmarks', []);
}

export function isBookmarked(slug) {
  return getBookmarks().includes(slug);
}

/* POST/DELETE /wiki/bookmarks/:slug */
export async function toggleBookmark(slug) {
  await delay(120);
  const bookmarks = getBookmarks();
  const next = bookmarks.includes(slug)
    ? bookmarks.filter((item) => item !== slug)
    : [...bookmarks, slug];
  writeStore('bookmarks', next);
  return next.includes(slug);
}

/* ─────────────────────────── تاریخچه جست‌وجو ─────────────────────────── */

export function getRecentSearches() {
  return readStore('recent-searches', []);
}

export function saveRecentSearch(query) {
  const term = query.trim();
  if (term.length < 2) return;
  const next = [term, ...getRecentSearches().filter((item) => item !== term)].slice(0, 6);
  writeStore('recent-searches', next);
}

export function clearRecentSearches() {
  writeStore('recent-searches', []);
}

/* پیشنهاد شروع جست‌وجوی خالی: تاریخچه کاربر + عبارت‌های داغ */
export function getEmptyQuerySuggestions() {
  const recents = getRecentSearches().map((term) => ({ term, kind: 'history' }));
  const hot = getHotSearches()
    .map(({ term, slug }) => ({ term, kind: 'hot', slug }))
    .filter(({ term }) => !recents.some(({ term: recent }) => normalize(recent) === normalize(term)));
  return { recents, hot };
}

/* پاک‌سازی به‌روزرسانی‌های گذشته برای نمایش نسبی در UI (با ارقام فارسی) */
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const faDigits = (value) => String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

export const formatRelativeDays = (isoDate) => {
  const days = Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 86400000));
  if (days === 0) return 'امروز';
  if (days === 1) return 'دیروز';
  if (days < 30) return `${faDigits(days)} روز پیش`;
  const months = Math.round(days / 30);
  return months === 1 ? '۱ ماه پیش' : `${faDigits(months)} ماه پیش`;
};

/* جست‌وجوی داغ به‌صورت داده خام (برای چیپ‌های صفحه اصلی) */
export { HOT_SEARCHES };
