/* ── لایهٔ سرویس «شبکه دانش» (Tapesh Knowledge Network API) ──
   قرارداد API برای اتصال به بک‌اند:
     GET   /knowledge/graph                      → getGraph()
     GET   /knowledge/nodes/:id                  → getNode()
     GET   /knowledge/nodes/:id/content          → getTopicContent()
     GET   /knowledge/search?q=                  → searchNodes() از graphModel
     GET   /knowledge/path?from=&to=             → مسیر BFS (سمت سرور با PageRank هم جایگزین‌پذیر)
     GET   /knowledge/learning-path/:nodeId      → computeLearningPath()
     GET   /knowledge/progress                   → getProgress()
     PUT   /knowledge/progress/:nodeId           → setNodeProgress()
   الان همه‌چیز با دادهٔ موک + localStorage جواب می‌دهد؛ برای اتصال به بک‌اند فقط
   بدنهٔ همین توابع به fetch تبدیل می‌شود — هیچ کامپوننتی به جزئیات mock وابسته نیست.

   نکتهٔ «محتوای مرتبط»: شمارش درسنامه/تست/فلش‌کارت/مقاله هر مفهوم Hard-Code نیست؛
   با کلیدواژه و درسِ همان مفهوم از لایهٔ دادهٔ سایر بخش‌های تپش (ویکی، بانک تست،
   فلش‌کارت، مقالات) شمرده می‌شود. هرچه آن بخش‌ها بزرگ‌تر شوند، این عددها واقعی‌تر.
   هر اتصال در try/catch است تا خرابی یک سرویس، شبکهٔ دانش را از کار نیندازد. */

import {
  KNOWLEDGE_NODES,
  KNOWLEDGE_EDGES,
  COURSES,
  NODE_TYPES,
  RELATION_TYPES,
  STARTING_POINTS,
} from './graphData';
import {
  buildGraph,
  computeLayout,
  computeLearningPath,
  findPath,
  getDependents,
  getNeighborhood,
  getPrerequisites,
  getRelatedSuggestions,
  searchNodes,
  getGraphStats,
  nodeCourses,
} from './graphModel';

const delay = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── گراف زنده — یک‌بار ساخته و بین همهٔ نماها مشترک است ── */
export const GRAPH = buildGraph(KNOWLEDGE_NODES, KNOWLEDGE_EDGES);

/* پس‌زمینهٔ گراف برای SVG — قطعی و پایدار بین رندرها */
export const LAYOUT = computeLayout(GRAPH, { width: 1280, height: 940, seed: 42 });

/* ─────────────────────────── متادیتای نمایش ─────────────────────────── */

export const COURSE_META = COURSES;
export const TYPE_META = NODE_TYPES;
export const RELATION_META = RELATION_TYPES;

export const courseLabel = (id) => COURSES.find((course) => course.id === id)?.label ?? id;
export const courseAccent = (id) => COURSES.find((course) => course.id === id)?.accent ?? '#8a8a8a';

/* ابزارهای موتور گراف که UI مستقیم استفاده می‌کند */
export { searchNodes as searchKnowledgeSync, getGraphStats, getNeighborhood, findPath, computeLearningPath };

/* درس اصلی نود = اولین درس فهرست؛ برای حلقهٔ رنگی نودها */
export const primaryCourse = (node) => node?.courses?.[0] ?? null;

/* GET /knowledge/graph — کل شبکه + آمار */
export async function getGraph() {
  await delay(360); /* نمایش skeleton — در نسخهٔ بک‌اند حذف می‌شود */
  return {
    nodes: KNOWLEDGE_NODES,
    edges: KNOWLEDGE_EDGES,
    layout: LAYOUT,
    stats: getGraphStats(GRAPH),
    startingPoints: STARTING_POINTS,
  };
}

/* محاسبهٔ سینک جزئیات نود — دادهٔ گراف کامل روی کلاینت است؛ UI همین را مصرف می‌کند.
   نسخهٔ async فقط قرارداد GET /knowledge/nodes/:id را برای بک‌اند نگه می‌دارد. */
export function getNodeDetail(nodeId) {
  const node = GRAPH.nodeById.get(nodeId);
  if (!node) return null;

  const neighbors = GRAPH.neighborsOf(nodeId).map(({ node: neighbor, edge, direction }) => ({
    node: neighbor,
    relation: {
      type: edge.type,
      label: direction === 'out' ? `این مفهوم ${RELATION_TYPES[edge.type]?.label ?? 'مرتبط با'}` : `${RELATION_TYPES[edge.type]?.label ?? 'مرتبط با'} این مفهوم`,
      direction,
    },
  }));

  return {
    node,
    neighbors,
    prerequisites: getPrerequisites(GRAPH, nodeId),
    dependents: getDependents(GRAPH, nodeId),
    neighborhood: getNeighborhood(GRAPH, nodeId, 2),
    related: getRelatedSuggestions(GRAPH, nodeId, { limit: 6 }).map((n) => n.id),
    courses: nodeCourses(node).map((id) => ({
      id,
      label: courseLabel(id),
      accent: courseAccent(id),
    })),
  };
}

/* GET /knowledge/nodes/:id — جزئیات کامل نود + همسایه‌های برچسب‌دار */
export async function getNode(nodeId) {
  await delay(200);
  const detail = getNodeDetail(nodeId);
  if (!detail) throw new Error('NODE_NOT_FOUND');
  return detail;
}

/* GET /knowledge/path?from=&to= — کوتاه‌ترین مسیر مفهومی */
export function findConceptPath(fromId, toId) {
  return findPath(GRAPH, fromId, toId);
}

/* GET /knowledge/learning-path/:nodeId — مسیر مطالعه از پیش‌نیازها */
export function getLearningPath(nodeId) {
  return computeLearningPath(GRAPH, nodeId);
}

/* GET /knowledge/search?q= */
export function searchKnowledge(query, options = {}) {
  return searchNodes(GRAPH, query, options);
}

/* ─────────────────────────── محتوای مرتبط تپش ───────────────────────────
   شمارش پویا از لایهٔ دادهٔ بقیهٔ سایت. تطبیق با کلیدواژهٔ نرمال‌شده انجام می‌شود؛
   اتصال واقعی به‌ازای هر بخش از data واقعی همان بخش می‌آید نه عدد ثابت. */

import { WIKI_ENTITIES } from '../wiki/mockData';
import { QUESTIONS } from '../testBank/mockData';
import { TAPESH_CARDS, TAPESH_DECKS } from '../flashcards/mockData';
import { ARTICLES } from '../articles/mockData';

const normalizedTokens = (node) => {
  const terms = new Set();
  const addTerm = (term) => {
    const normalized = normalizeTerm(term);
    if (normalized.length >= 3) terms.add(normalized);
  };
  addTerm(node.title);
  (node.englishTitle ? [node.englishTitle] : []).forEach(addTerm);
  (node.keywords ?? []).forEach(addTerm);
  (node.aliases ?? []).forEach(addTerm);
  return terms;
};

const normalizeTerm = (term) =>
  String(term ?? '')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[^a-z0-9\u0600-\u06FF ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const textOf = (value) => normalizeTerm(String(value ?? ''));

/* آیا مجموعهٔ کلیدواژهٔ نود با متن یک آیتم تقاطع دارد؟ */
const matchesNode = (nodeTerms, ...texts) => {
  const haystack = texts.map(textOf).join(' ');
  for (const term of nodeTerms) {
    if (haystack.includes(term)) return true;
  }
  return false;
};

const contentCache = new Map();

/* GET /knowledge/nodes/:id/content — { wiki, tests, flashcards, articles, decks } */
export function getTopicContent(nodeId) {
  if (contentCache.has(nodeId)) return contentCache.get(nodeId);

  const node = GRAPH.nodeById.get(nodeId);
  if (!node) return null;

  const terms = normalizedTokens(node);
  const primaryCourseId = primaryCourse(node);
  const result = { wiki: [], tests: 0, flashcards: 0, articles: [], decks: [] };

  try {
    /* ویکی: موجودیت‌هایی که کلیدواژه‌شان با مفهوم تقاطع دارد */
    result.wiki = WIKI_ENTITIES.filter((entity) =>
      matchesNode(
        terms,
        entity.title,
        entity.englishTitle,
        (entity.keywords ?? []).join(' '),
        (entity.aliases ?? []).join(' '),
        entity.summary ?? '',
      ),
    ).map((entity) => ({ slug: entity.slug, title: entity.title, subject: entity.subject }));
  } catch {
    /* ویکی در دسترس نیست — شمارش صفر می‌ماند */
  }

  try {
    /* بانک تست: سؤال‌های همان درس + کلیدواژه/مبحث مشترک */
    result.tests = QUESTIONS.filter((question) => {
      if (primaryCourseId && question.subject && question.subject !== primaryCourseId) {
        /* درس اصلی متفاوت — فقط اگر کلیدواژه صریح دارد شمرده شود */
        return matchesNode(terms, (question.tags ?? []).join(' '), (question.topicPath ?? []).join(' '));
      }
      return matchesNode(
        terms,
        (question.tags ?? []).join(' '),
        (question.topicPath ?? []).join(' '),
        question.stem ?? '',
      );
    }).length;
  } catch {
    /* ignore */
  }

  try {
    /* فلش‌کارت: کارت‌های پک‌های تپش در همان درس یا با کلیدواژهٔ مشترک */
    const deckById = new Map(TAPESH_DECKS.map((deck) => [deck.id, deck]));
    result.flashcards = TAPESH_CARDS.filter((card) => {
      const deck = deckById.get(card.deckId);
      const deckSubject = deck?.subjectId;
      if (deckSubject && primaryCourseId && deckSubject === primaryCourseId) return true;
      return matchesNode(terms, (card.tags ?? []).join(' '), deck?.title ?? '', card.front ?? '');
    }).length;
    result.decks = TAPESH_DECKS.filter(
      (deck) =>
        (primaryCourseId && deck.subjectId === primaryCourseId) ||
        matchesNode(terms, deck.title ?? '', (deck.tags ?? []).join(' ')),
    ).map((deck) => ({ id: deck.id, title: deck.title, cardCount: deck.cardCount ?? null }));
  } catch {
    /* ignore */
  }

  try {
    /* مقالات: تگ/عنوان مشترک */
    result.articles = ARTICLES.filter((article) =>
      matchesNode(terms, article.title ?? '', (article.tags ?? []).join(' '), article.excerpt ?? ''),
    ).map((article) => ({ slug: article.slug, title: article.title }));
  } catch {
    /* ignore */
  }

  contentCache.set(nodeId, result);
  return result;
}

/* خلاصهٔ شمارشی برای چیپ‌های پنل و صفحهٔ موضوع */
export const contentCounts = (content) =>
  content
    ? {
        lessons: content.wiki.length,
        tests: content.tests,
        flashcards: content.flashcards,
        articles: content.articles.length,
      }
    : { lessons: 0, tests: 0, flashcards: 0, articles: 0 };

/* ─────────────────────────── وضعیت یادگیری کاربر ───────────────────────────
   localStorage الان؛ در بک‌اند PUT /knowledge/progress/:nodeId.
   مقادیر: unstarted | studying | studied | mastered | review-needed | weak */

import { ProgressService } from '../learning/progressService';

const PROGRESS_STATUSES = {
  unstarted: { label: 'مطالعه نشده', accent: '#8a8a8a', order: 0 },
  studying: { label: 'در حال مطالعه', accent: '#5b8cc7', order: 1 },
  studied: { label: 'مطالعه شده', accent: '#77b787', order: 2 },
  mastered: { label: 'مسلط', accent: '#937fcd', order: 3 },
  'review-needed': { label: 'نیازمند مرور', accent: '#e0b45c', order: 4 },
  weak: { label: 'ضعیف', accent: '#e26d6d', order: 5 },
};

export const STATUS_META = PROGRESS_STATUSES;
export const statusLabel = (status) => PROGRESS_STATUSES[status]?.label ?? 'مطالعه نشده';
export const statusAccent = (status) => PROGRESS_STATUSES[status]?.accent ?? '#8a8a8a';

const STORE_PREFIX = 'tapesh:knowledge:v1';

const storageKey = (userId) => `${STORE_PREFIX}:${userId ?? 'guest'}`;

const readProgress = (userId) => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '{}');
  } catch {
    return {};
  }
};

const writeProgress = (userId, progress) => {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(progress));
  } catch {
    /* حافظه در دسترس نیست — وضعیت فقط در سشن می‌ماند */
  }
};

/* GET /knowledge/progress — { [nodeId]: { status, progress, lastReviewed } } */
export function getProgress(userId) {
  return readProgress(userId);
}

/* PUT /knowledge/progress/:nodeId */
export function setNodeProgress(userId, nodeId, patch = {}) {
  const progress = readProgress(userId);
  const current = progress[nodeId] ?? { status: 'unstarted', progress: 0, lastReviewed: null };
  progress[nodeId] = {
    ...current,
    ...patch,
    lastReviewed: new Date().toISOString(),
  };
  writeProgress(userId, progress);
  return progress[nodeId];
}

/* وضعیت نود برای نمایش در گراف — پیش‌فرض unstarted */
export const nodeStatus = (progressMap, nodeId) => progressMap[nodeId]?.status ?? 'unstarted';
export const nodeProgressValue = (progressMap, nodeId) => progressMap[nodeId]?.progress ?? 0;

/* پیشرفت کلی روی شبکه: میانگین وزنی وضعیت‌ها (۰ تا ۱۰۰) */
export function overallMastery(progressMap) {
  const entries = Object.values(progressMap ?? {});
  if (entries.length === 0) return 0;
  const weight = { unstarted: 0, studying: 0.35, studied: 0.7, mastered: 1, 'review-needed': 0.45, weak: 0.15 };
  const total = entries.reduce((sum, entry) => sum + (weight[entry.status] ?? 0), 0);
  return Math.round((total / entries.length) * 100);
}

/* ── اتصال به سیستم یادگیری موجود: درسنامهٔ جامعِ در‌حال‌مطالعهٔ کاربر
   از ProgressService خوانده می‌شود تا در آینده وضعیت «در حال مطالعه» خودکار
   پر شود؛ الان فقط قرارداد آماده است تا اتصال بدون تغییر UI ممکن باشد. ── */
export const learningBridge = { ProgressService };

/* نودهای شروع — کارت‌های «از اینجا شروع کن» صفحهٔ اصلی شبکه */
export const getStartingPoints = () =>
  STARTING_POINTS.map((id) => GRAPH.nodeById.get(id)).filter(Boolean);
