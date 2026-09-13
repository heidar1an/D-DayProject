/*
 * وضعیت کاربر روی مقالات — Reading List، پیشرفت مطالعه، هایلایت و یادداشت.
 *
 * پیاده‌سازی فعلی: localStorage + pub-sub سبک (useSyncExternalStore سازگار است).
 * قرارداد API آینده:
 *   GET/PUT  /api/articles/:id/state      → UserArticleState
 *   GET/POST/DELETE /api/articles/:id/highlights → ArticleHighlight[]
 *   GET/POST /api/me/collections          → ArticleCollection[] (نسخه بعد)
 *
 * مدل‌ها (مستند در mockData.js):
 *   UserArticleState { articleId, bookmarked, startedAt, lastReadAt, progress, completedAt, updatedAt }
 *   ArticleHighlight { id, articleId, blockId, start, end, text, note, createdAt }
 *   ArticleCollection { id, userId, title, description, createdAt }
 */

const STORAGE_PREFIX = 'tapesh:articles';
const STATE_KEY = `${STORAGE_PREFIX}:user-state`;
const HIGHLIGHTS_KEY = `${STORAGE_PREFIX}:highlights`;
const COLLECTIONS_KEY = `${STORAGE_PREFIX}:collections`;

function readJson(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) ?? null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* حافظه پر یا در دسترس نیست؛ تجربه بدون ذخیره ادامه می‌یابد */
  }
}

/* ── store سبک با اعلان تغییر برای useSyncExternalStore ── */
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function createEntry(articleId) {
  return {
    articleId,
    bookmarked: false,
    startedAt: null,
    lastReadAt: null,
    progress: 0,
    completedAt: null,
    updatedAt: null,
  };
}

let userState = readJson(STATE_KEY) ?? {};

function persistState() {
  writeJson(STATE_KEY, userState);
  emit();
}

export function getArticleUserState(articleId) {
  return userState[articleId] ?? null;
}

/* برای useSyncExternalStore: با هر تغییر، شناسه شیء عوض می‌شود */
export function getUserStateSnapshot() {
  return userState;
}

export function getProgress(articleId) {
  return userState[articleId]?.progress ?? 0;
}

/* شروع خواندن؛ فقط اولین بار ثبت می‌شود */
export function ensureStarted(articleId) {
  const entry = userState[articleId] ?? createEntry(articleId);
  if (entry.startedAt) return;
  entry.startedAt = new Date().toISOString();
  userState = { ...userState, [articleId]: entry };
  persistState();
}

/* پیشرفت فقط جلو می‌رود (حداکثر دسترسی) و در ۹۵٪ خوانده‌شده تلقی می‌شود */
export function saveProgress(articleId, progress, { silent = false } = {}) {
  const bounded = Math.min(Math.max(progress, 0), 1);
  const entry = userState[articleId] ?? createEntry(articleId);
  const wasCompleted = Boolean(entry.completedAt);

  entry.startedAt = entry.startedAt ?? new Date().toISOString();

  if (bounded > (entry.progress ?? 0)) {
    entry.progress = bounded;
  }
  entry.lastReadAt = new Date().toISOString();
  if (bounded >= 0.95) entry.completedAt = entry.completedAt ?? new Date().toISOString();

  userState = { ...userState, [articleId]: entry };

  /* لحظهٔ «خوانده شد» باید در UI های زنده هم دیده شود */
  const becameCompleted = !wasCompleted && Boolean(entry.completedAt);
  if (silent && !becameCompleted) {
    writeJson(STATE_KEY, userState);
    return;
  }

  persistState();
}

export function toggleBookmark(articleId) {
  const entry = userState[articleId] ?? createEntry(articleId);
  entry.bookmarked = !entry.bookmarked;
  entry.updatedAt = new Date().toISOString();
  userState = { ...userState, [articleId]: entry };
  persistState();
  return entry.bookmarked;
}

export function isBookmarked(articleId) {
  return Boolean(userState[articleId]?.bookmarked);
}

/* ── مجموعه‌های لیست مطالعه ── */

export function getReadingList() {
  return Object.values(userState).filter((entry) => entry.bookmarked);
}

export function getInProgress() {
  return Object.values(userState)
    .filter((entry) => (entry.progress ?? 0) > 0.02 && !entry.completedAt)
    .sort((a, b) => String(b.lastReadAt).localeCompare(String(a.lastReadAt)));
}

export function getCompleted() {
  return Object.values(userState)
    .filter((entry) => entry.completedAt)
    .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
}

export function getSavedCount() {
  return getReadingList().length;
}

/* ── هایلایت و یادداشت ── */

let highlightsByArticle = readJson(HIGHLIGHTS_KEY) ?? {};
const EMPTY_HIGHLIGHTS = [];

function persistHighlights() {
  writeJson(HIGHLIGHTS_KEY, highlightsByArticle);
  emit();
}

/* خروجی خالی باید شناسه پایدار داشته باشد (قرارداد useSyncExternalStore) */
export function getArticleHighlights(articleId) {
  return highlightsByArticle[articleId] ?? EMPTY_HIGHLIGHTS;
}

export function addHighlight(articleId, highlight) {
  const entry = {
    id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    articleId,
    blockId: highlight.blockId,
    start: highlight.start,
    end: highlight.end,
    text: highlight.text,
    note: highlight.note ?? null,
    createdAt: new Date().toISOString(),
  };

  highlightsByArticle = {
    ...highlightsByArticle,
    [articleId]: [...getArticleHighlights(articleId), entry],
  };
  persistHighlights();
  return entry;
}

export function removeHighlight(articleId, highlightId) {
  highlightsByArticle = {
    ...highlightsByArticle,
    [articleId]: getArticleHighlights(articleId).filter((item) => item.id !== highlightId),
  };
  persistHighlights();
}

/* ── کالکشن‌ها (مدل آماده؛ UI نسخه بعد) ── */

export function getCollections() {
  return readJson(COLLECTIONS_KEY) ?? [];
}

export function createCollection(title, description = '') {
  const collections = [
    ...getCollections(),
    {
      id: `col-${Date.now()}`,
      userId: 'me',
      title,
      description,
      createdAt: new Date().toISOString(),
    },
  ];
  writeJson(COLLECTIONS_KEY, collections);
  return collections.at(-1);
}
