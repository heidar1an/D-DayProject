/*
 * رجیستری مهاجرت‌های نسخه‌دار داده — فاز ۱۲.
 *
 * هر مهاجرت: `{ id, description, appliesTo, up }`
 *   • `id`          — ترتیب قطعی بر اساس رشته (مرتب‌سازی صعودی). پیشوند عددی
 *                     چهاررقمی، پس ترتیب همیشه یکتا و صریح است.
 *   • `appliesTo`   — نام انبارهایی که این مهاجرت لمس می‌کند (فهرست صریح).
 *   • `up(data)`    — تابع **خالص**: دادهٔ فعلی را می‌گیرد و دادهٔ تازه را
 *                     برمی‌گرداند. اگر داده از قبل سازگار باشد، باید **همان
 *                     ورودی** را برگرداند (یا مقدار هم‌ارز عمیق) تا runner
 *                     تشخیص دهد «تغییری لازم نیست» و هیچ نوشتنی نکند.
 *
 * ⚠️ قاعدهٔ سخت: `up` هرگز نباید داده را حذف کند. حذف فقط با تصمیم صریح
 * محصولی و در مهاجرتی با `destructive: true` انجام می‌شود و runner قبلش
 * پشتیبان می‌گیرد و در گزارش هشدار می‌دهد.
 */

/** افزودن `id` به رکوردهای بدون شناسه — کلاسیک‌ترین مهاجرت نخست. */
function backfillIds(data, { makeId }) {
  if (!Array.isArray(data)) return data;
  let changed = false;
  const next = data.map((record) => {
    if (!record || typeof record !== 'object') return record;
    if (record.id) return record;
    changed = true;
    return { ...record, id: makeId() };
  });
  return changed ? next : data;
}

/** اطمینان از وجود `updatedAt` روی رکوردی که `createdAt` دارد. */
function ensureUpdatedAt(data) {
  if (!Array.isArray(data)) return data;
  let changed = false;
  const next = data.map((record) => {
    if (!record || typeof record !== 'object') return record;
    if (!record.createdAt || record.updatedAt) return record;
    changed = true;
    return { ...record, updatedAt: record.createdAt };
  });
  return changed ? next : data;
}

/** انبارهایی که مهاجرت‌ها روی آن‌ها اجرا می‌شوند. */
export const STORES = Object.freeze([
  { name: 'articles', file: 'database/content/articles.json', shape: 'array' },
  { name: 'categories', file: 'database/content/categories.json', shape: 'array' },
  { name: 'banners', file: 'database/content/banners.json', shape: 'array' },
  { name: 'pages', file: 'database/content/pages.json', shape: 'array' },
  { name: 'references', file: 'database/content/references.json', shape: 'array' },
  { name: 'flashcardDecks', file: 'database/content/flashcardDecks.json', shape: 'array' },
  { name: 'microCourses', file: 'database/content/microCourses.json', shape: 'array' },
  { name: 'comprehensiveCourses', file: 'database/content/comprehensiveCourses.json', shape: 'array' },
  { name: 'intlProviders', file: 'database/content/intlProviders.json', shape: 'array' },
  { name: 'intlCourses', file: 'database/content/intlCourses.json', shape: 'array' },
  { name: 'testBank', file: 'database/content/testBank.json', shape: 'array' },
  { name: 'notes', file: 'database/content/notes.json', shape: 'array' },
]);

const ALL_STORES = STORES.map((store) => store.name);

export const MIGRATIONS = Object.freeze([
  Object.freeze({
    id: '0001',
    description: 'افزودن شناسه به رکوردهای بدون `id`',
    appliesTo: ALL_STORES,
    up: backfillIds,
  }),
  Object.freeze({
    id: '0002',
    description: 'هم‌گام‌سازی `updatedAt` با `createdAt` در رکوردهای ناقص',
    appliesTo: ALL_STORES,
    up: ensureUpdatedAt,
  }),
]);

/** ترتیب قطعی و یکتا — پیش از هر اجرا سنجیده می‌شود. */
export function orderedMigrations() {
  const ids = MIGRATIONS.map((migration) => migration.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new Error('شناسهٔ مهاجرت تکراری است');
  return [...MIGRATIONS].sort((a, b) => a.id.localeCompare(b.id));
}
