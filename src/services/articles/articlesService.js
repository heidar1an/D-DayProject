/*
 * سرویس مقالات تپش — قرارداد API به شکل واقعی طراحی شده؛ پیاده‌سازی فعلی Mock است.
 * با اتصال Backend کافی است بدنهٔ هر تابع به fetch تبدیل شود؛ امضای خروجی عوض نمی‌شود.
 *
 * قراردادهای آینده:
 *   GET /api/articles?category&query&sort&time&recommended&offset&limit
 *   GET /api/articles/:slug
 *   GET /api/articles/:slug/related        → ArticleRelation[]
 *   GET /api/articles/categories
 *   GET /api/articles/suggest?q=           → پیشنهاد جست‌وجو (مقاله + موضوع)
 *   GET /api/me/recommendations            → موتور پیشنهاد آینده (مبتنی بر Reading History)
 */

import { ARTICLES, AUTHORS, CATEGORIES } from './mockData';
import { getCompleted, getInProgress, getReadingList } from './userState';

const LATENCY_MS = 240;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* جست‌وجو به نیم‌فاصله و حروف کوچک حساس نباشد */
const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u200c/g, ' ');

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

  const list = ARTICLES.filter((article) => {
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
  await wait(LATENCY_MS);
  return filterArticles(options);
}

export async function getArticleBySlug(slug) {
  await wait(LATENCY_MS);
  return ARTICLES.find((article) => article.slug === slug) ?? null;
}

/* مرتبط‌ها: هم‌دسته‌ها با بیشترین تگ مشترک — جایگزین آینده: ArticleRelation سمت سرور */
export async function getRelatedArticles(article, limit = 3) {
  await wait(LATENCY_MS);

  const articleTags = new Set(article.tags ?? []);

  return ARTICLES.filter((candidate) => candidate.slug !== article.slug)
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
  ARTICLES.forEach((article) => {
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
  return CATEGORIES.filter((category) => VISIBLE_CATEGORY_IDS.has(category.id)).map((category) => ({
    ...category,
    count: ARTICLES.filter((article) => matchesCategory(article, category.id)).length,
  }));
}

export function getFeaturedArticle() {
  return ARTICLES.find((article) => article.featured) ?? null;
}

/* دو مقالهٔ کنار مقالهٔ منتخب در تخته Editorial */
export function getSideFeaturedArticles(limit = 2) {
  return ARTICLES.filter((article) => article.recommended && !article.featured)
    .sort(SORTERS.newest)
    .slice(0, limit);
}

/* استفادهٔ هم‌زمان در صفحه اصلی سایت (بدون تاخیر) */
export function getLatestArticles(limit = 3) {
  return [...ARTICLES].sort(SORTERS.newest).slice(0, limit);
}

export function getArticlesByIds(ids) {
  if (!ids?.length) return [];
  const idSet = new Set(ids);
  return ARTICLES.filter((article) => idSet.has(article.id));
}

export function getArticlesByAuthor(authorId, { excludeSlug } = {}) {
  return ARTICLES.filter(
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
