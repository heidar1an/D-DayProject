/*
 * سرویس مقالات تپش — قرارداد API به شکل واقعی طراحی شده؛ پیاده‌سازی فعلی Mock است.
 * با اتصال Backend کافی است بدنهٔ هر تابع به fetch تبدیل شود؛ امضای خروجی عوض نمی‌شود.
 *
 * ── مقالاتی که کاربران می‌بینند = مقالات پنل + مقالات ثابت ──
 *
 * تا پیش از این، این سرویس فقط دوازده مقالهٔ ثابتِ داخل کد (`mockData`) را برمی‌گرداند
 * و هیچ‌کدام از رکوردهای پنل دیده نمی‌شد؛ یعنی ویرایش مدیر در بخش «مقالات تپش» هیچ
 * اثری روی سایت نداشت. حالا `loadPublishedArticles()` مسیر عمومی
 * `GET /api/public/articles` را می‌خواند و نسخهٔ منتشرشدهٔ پنل **جای** نسخهٔ ثابت
 * می‌نشیند (تطبیق با `slug`)، نه کنارش — وگرنه هر مقاله دو بار در فهرست می‌آمد.
 *
 * اگر سرور در دسترس نباشد (پیش‌نمایش استاتیک/آفلاین) خطا پرت نمی‌شود و همان دوازده
 * مقالهٔ ثابت سر جایشان می‌مانند — رفتار امروز سایت دست‌نخورده است.
 *
 * قراردادهای آینده:
 *   GET /api/articles?category&query&sort&time&recommended&offset&limit
 *   GET /api/articles/:slug
 *   GET /api/articles/:slug/related        → ArticleRelation[]
 *   GET /api/articles/categories
 *   GET /api/articles/suggest?q=           → پیشنهاد جست‌وجو (مقاله + موضوع)
 *   GET /api/me/recommendations            → موتور پیشنهاد آینده (مبتنی بر Reading History)
 */

import { ARTICLES, AUTHORS, CATEGORIES, COVER_FIGURES } from './mockData';
import { getCompleted, getInProgress, getReadingList } from './userState';

const LATENCY_MS = 240;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* جست‌وجو به نیم‌فاصله و حروف کوچک حساس نباشد */
const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u200c/g, ' ');

/* ── مقالات منتشرشدهٔ پنل ── */

const CMS_TTL_MS = 15000;

let cmsArticles = [];
let cmsLoadedAt = 0;
let cmsPending = null;

export async function loadPublishedArticles({ force = false } = {}) {
  if (!force && cmsLoadedAt && Date.now() - cmsLoadedAt < CMS_TTL_MS) return cmsArticles;
  if (cmsPending) return cmsPending;

  cmsPending = (async () => {
    try {
      const response = await fetch('/api/public/articles', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`articles-http-${response.status}`);
      const payload = await response.json();
      const records = payload?.data?.articles;
      if (Array.isArray(records)) {
        cmsArticles = records.filter((record) => record?.slug).map(toReaderArticle);
      }
    } catch {
      /*
       * سرور در دسترس نیست (پیش‌نمایش استاتیک، قطع شبکه) — مقالات ثابت تپش سرجایشان
       * می‌مانند. عمداً خطا بالا نمی‌دهد: نبودِ مقالات پنل نباید کل بخش مقالات را
       * از کار بیندازد.
       */
    } finally {
      cmsLoadedAt = Date.now();
      cmsPending = null;
    }
    return cmsArticles;
  })();

  return cmsPending;
}

/*
 * نویسندهٔ رکورد پنل با «نام» می‌آید، نه با شناسه (`articlePayload` فقط `authorName`
 * را نگه می‌دارد). اگر همان نام در فهرست نویسندگان ثابت باشد همان برگردانده می‌شود؛
 * وگرنه یک نویسندهٔ ترکیبی ساخته و در همان فهرست ثبت می‌شود تا `getAuthorById` هم
 * بعداً پیدایش کند و کارت مقاله بی‌نویسنده نماند.
 */
const AUTHOR_ACCENTS = ['blue', 'purple', 'green', 'copper'];

function initialsOf(name) {
  const words = String(name).split(/\s+/).filter((word) => word && word !== 'دکتر');
  return words.slice(0, 2).map((word) => word[0]).join('‌') || 'ت';
}

function authorByName(name) {
  const clean = String(name ?? '').trim();
  if (!clean) return null;

  const known = Object.values(AUTHORS).find((author) => author.name === clean);
  if (known) return known;

  const id = `panel-${clean.replace(/\s+/g, '-')}`;
  if (!AUTHORS[id]) {
    AUTHORS[id] = {
      id,
      name: clean,
      role: 'نویسندهٔ تپش',
      initials: initialsOf(clean),
      accent: AUTHOR_ACCENTS[Object.keys(AUTHORS).length % AUTHOR_ACCENTS.length],
      bio: '',
    };
  }
  return AUTHORS[id];
}

/*
 * رکورد پنل → شکل مقالهٔ خواننده.
 *
 * متن بلوکی از کاتالوگ می‌آید (رکورد پنل آن را همراه ندارد) و `contentHtml` فقط وقتی
 * پر است که مدیر متن را در پنل ویرایش کرده باشد؛ در آن صورت خواننده همان را رندر
 * می‌کند. تصویر: اگر مدیر کاوری بارگذاری کرده باشد مقدم است، وگرنه کلید `figure`
 * به همان تصویر ثابت تپش نگاشت می‌شود.
 */
function toReaderArticle(record) {
  const catalog = ARTICLES.find((article) => article.slug === record.slug);
  const publishedAt = String(record.publishedAt ?? '').slice(0, 10);
  const updatedAt = String(record.updatedAt ?? '').slice(0, 10);

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    excerpt: record.excerpt ?? '',
    category: record.category,
    tags: Array.isArray(record.tags) ? record.tags : [],
    author: authorByName(record.authorName)?.id ?? null,
    cover: record.cover || COVER_FIGURES[record.figure] || '',
    coverAlt: record.coverAlt ?? '',
    publishedAt,
    updatedAt,
    readingTime: Number(record.readingTime) || 1,
    views: Number(record.views) || 0,
    likes: Number(record.likes) || 0,
    featured: Boolean(record.featured),
    recommended: Boolean(record.recommended),
    content: catalog?.content ?? [],
    contentHtml: record.contentHtml ?? '',
    coverRatio: catalog?.coverRatio ?? '16/10',
    coverFit: catalog?.coverFit ?? 'cover',
    learning: catalog?.learning ?? null,
  };
}

/*
 * فهرست کاملی که کاربران می‌بینند: نسخهٔ منتشرشدهٔ پنل اول، بعد مقالات ثابتی که
 * رکورد هم‌نام ندارند. ترتیب نهایی را همان `SORTERS` هر نما تعیین می‌کند.
 */
function visibleArticles() {
  if (!cmsArticles.length) return ARTICLES;
  const published = new Set(cmsArticles.map((article) => article.slug));
  return [...cmsArticles, ...ARTICLES.filter((article) => !published.has(article.slug))];
}

export function categoryLabel(categoryId) {
  return CATEGORIES.find((category) => category.id === categoryId)?.label ?? '';
}

export function categoryAccent(categoryId) {
  return CATEGORIES.find((category) => category.id === categoryId)?.accent ?? 'blue';
}

export function getAuthorById(authorId) {
  return AUTHORS[authorId] ?? null;
}

const SORTERS = {
  newest: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
  popular: (a, b) => b.likes - a.likes || b.views - a.views,
  mostRead: (a, b) => b.views - a.views || b.publishedAt.localeCompare(a.publishedAt),
  recommended: (a, b) =>
    Number(b.recommended) - Number(a.recommended) ||
    b.publishedAt.localeCompare(a.publishedAt),
};

const TIME_FILTERS = {
  all: () => true,
  /* مقاله‌های کوتاه برای وقتی که وقت کم است */
  short: (article) => article.readingTime <= 6,
  /* مقاله‌های مفصل برای مطالعه عمیق */
  long: (article) => article.readingTime > 6,
};

/* دسته‌های قابل نمایش در نوار فیلتر؛ دسته‌های قدیمی برای برچسب مقاله‌ها نگه داشته می‌شوند. */
const VISIBLE_CATEGORY_IDS = new Set([
  'basic-sciences',
  'physiology',
  'study-skills',
  'olympiad',
  'lifestyle',
  'news',
  'biotechnology',
  'public-health',
  'featured',
]);

function matchesCategory(article, category) {
  if (category === 'featured') return Boolean(article.recommended);
  return article.category === category;
}

function filterArticles({
  category = 'all',
  query = '',
  sort = 'newest',
  time = 'all',
  recommendedOnly = false,
} = {}) {
  const normalizedQuery = normalize(query);

  const list = visibleArticles().filter((article) => {
    if (category !== 'all' && !matchesCategory(article, category)) return false;
    if (!(TIME_FILTERS[time] ?? TIME_FILTERS.all)(article)) return false;
    if (recommendedOnly && !article.recommended) return false;

    if (!normalizedQuery) return true;

    const haystacks = [
      article.title,
      article.excerpt,
      categoryLabel(article.category),
      article.learning?.topic,
      getAuthorById(article.author)?.name,
      ...(article.tags ?? []),
    ];
    return haystacks.some((field) => normalize(field).includes(normalizedQuery));
  });

  return [...list].sort(SORTERS[sort] ?? SORTERS.newest);
}

export async function getArticles(options = {}) {
  await loadPublishedArticles();
  await wait(LATENCY_MS);
  return filterArticles(options);
}

export async function getArticleBySlug(slug) {
  await loadPublishedArticles();
  await wait(LATENCY_MS);
  return visibleArticles().find((article) => article.slug === slug) ?? null;
}

/* مرتبط‌ها: هم‌دسته‌ها با بیشترین تگ مشترک — جایگزین آینده: ArticleRelation سمت سرور */
export async function getRelatedArticles(article, limit = 3) {
  await wait(LATENCY_MS);

  const articleTags = new Set(article.tags ?? []);

  return visibleArticles().filter((candidate) => candidate.slug !== article.slug)
    .map((candidate) => {
      const sharedTags = (candidate.tags ?? []).filter((tag) => articleTags.has(tag)).length;
      return {
        candidate,
        score: (candidate.category === article.category ? 10 : 0) + sharedTags,
      };
    })
    .sort((a, b) => b.score - a.score || b.candidate.publishedAt.localeCompare(a.candidate.publishedAt))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

/* پیشنهاد جست‌وجو: مقاله‌های نزدیک + موضوع‌ها (تگ و دسته‌بندی) */
export async function getSearchSuggestions(query) {
  await wait(140);

  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return { articles: [], topics: [] };

  const articles = filterArticles({ query }).slice(0, 4).map((article) => ({
    slug: article.slug,
    title: article.title,
    category: categoryLabel(article.category),
  }));

  const topicSet = new Map();
  visibleArticles().forEach((article) => {
    (article.tags ?? []).forEach((tag) => topicSet.set(tag, tag));
    topicSet.set(categoryLabel(article.category), categoryLabel(article.category));
    if (article.learning?.topic) topicSet.set(article.learning.topic, article.learning.topic);
  });
  const topics = [...topicSet.keys()]
    .filter((topic) => normalize(topic).includes(normalizedQuery))
    .slice(0, 6);

  return { articles, topics };
}

export function getCategories() {
  const all = visibleArticles();
  return CATEGORIES.filter((category) => VISIBLE_CATEGORY_IDS.has(category.id)).map((category) => ({
    ...category,
    count: all.filter((article) => matchesCategory(article, category.id)).length,
  }));
}

export function getFeaturedArticle() {
  return visibleArticles().find((article) => article.featured) ?? null;
}

/* دو مقالهٔ کنار مقالهٔ منتخب در تخته Editorial */
export function getSideFeaturedArticles(limit = 2) {
  return visibleArticles().filter((article) => article.recommended && !article.featured)
    .sort(SORTERS.newest)
    .slice(0, limit);
}

/* استفادهٔ هم‌زمان در صفحه اصلی سایت (بدون تاخیر) */
export function getLatestArticles(limit = 3) {
  return [...visibleArticles()].sort(SORTERS.newest).slice(0, limit);
}

export function getArticlesByIds(ids) {
  if (!ids?.length) return [];
  const idSet = new Set(ids);
  return visibleArticles().filter((article) => idSet.has(article.id));
}

export function getArticlesByAuthor(authorId, { excludeSlug } = {}) {
  return visibleArticles().filter(
    (article) => article.author === authorId && article.slug !== excludeSlug,
  ).sort(SORTERS.newest);
}

/* ── بخش‌های شخصی‌سازی‌شده؛ فعلاً از تاریخچه محلی تغذیه می‌شوند.
   با Backend، بدنه به /api/me/recommendations وصل می‌شود و UI دست‌نخورده می‌ماند. ── */

export function getContinueReadingArticles(limit = 4) {
  const entries = getInProgress().slice(0, limit);
  const articles = getArticlesByIds(entries.map((entry) => entry.articleId));
  return entries
    .map((entry) => ({
      entry,
      article: articles.find((article) => article.id === entry.articleId),
    }))
    .filter((item) => item.article);
}

export function getCompletedArticles(limit = 8) {
  return getArticlesByIds(getCompleted().slice(0, limit).map((entry) => entry.articleId));
}
