/*
 * پل ویکی بین فرانت و v1 (فاز ۱۰).
 *
 * قرارداد v1:
 *   GET    /wiki/categories               → { categories }           (درخت؛ فقط منتشرشده)
 *   GET    /wiki/articles                 → { articles, meta }
 *   GET    /wiki/articles/{slug}          → { article, related, backlinks }
 *   GET    /wiki/search                   → { query, results, facets }
 *   GET    /wiki/suggest                  → { query, suggestions }
 *   GET    /me/wiki-bookmarks             → { bookmarks, meta }
 *   PUT    /me/wiki-bookmarks/{articleId} → { bookmark }             (Idempotency-Key؛ 201)
 *   DELETE /me/wiki-bookmarks/{articleId} → 204
 *
 * مرز اعتماد (فاز ۱۰): API عمومی هرگز `status`/`version`/نویسنده/شمارندهٔ بازدید
 * نمی‌آورد — پیش‌نویس و آرشیو ۴۰۴ می‌دهند. نگاشت اینجا چیزی «تکمیل نمی‌کند».
 *
 * نکتهٔ فاز ۱۱: `related`/`backlinks` مرجع کنترل‌شدهٔ بین‌دامنه‌ای‌اند؛ هنوز گراف
 * دانشی وجود ندارد و این پل چیزی برای آن نمی‌سازد.
 */

import { V1_REASON, newRequestKey, v1Request } from '../api/v1';

/* ── نگاشت snake_case → camelCase (آینهٔ Resources سرور) ── */

function toSummary(row) {
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? null,
    subject: row.subject ?? null,
    contentType: row.content_type ?? null,
    difficulty: row.difficulty ?? null,
    readMinutes: row.read_minutes == null ? null : Number(row.read_minutes),
    popularity: Number(row.popularity ?? 0),
    category: row.category ?? null,
    publishedAt: row.published_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function toArticle(row) {
  if (!row) return null;

  return {
    ...toSummary(row),
    body: row.body ?? '',
    keyFacts: Array.isArray(row.key_facts) ? row.key_facts : [],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
  };
}

function toRelation(row) {
  if (!row) return null;

  return {
    articleId: row.article_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? null,
    subject: row.subject ?? null,
    contentType: row.content_type ?? null,
    difficulty: row.difficulty ?? null,
    kind: row.kind,
    kindLabel: row.kind_label ?? row.kind,
    direction: row.direction,
  };
}

/* درخت دسته‌بندی — سرور از قبل بازسازی می‌کند؛ اینجا فقط نام فیلدها یکسان می‌شود. */
function toCategory(row) {
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    parentId: row.parent_id ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    status: row.status,
    articlesCount: Number(row.articles_count ?? 0),
    children: (row.children ?? []).map(toCategory),
  };
}

function toBookmark(row) {
  if (!row) return null;

  return {
    id: row.id,
    articleId: row.article_id,
    createdAt: row.created_at ?? null,
    article: toSummary(row.article),
  };
}

/* ── کوئری ── */

function qs(params) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }

  const encoded = search.toString();

  return encoded ? `?${encoded}` : '';
}

function toMeta(meta) {
  if (!meta) return null;

  return {
    page: Number(meta.page ?? 1),
    perPage: Number(meta.perPage ?? 0),
    total: Number(meta.total ?? 0),
    lastPage: Number(meta.lastPage ?? 1),
  };
}

/* ── عمومی ── */

export async function fetchWikiCategories() {
  const result = await v1Request('/wiki/categories');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, categories: (result.data?.categories ?? []).map(toCategory) };
}

export async function fetchWikiArticles({ subject, type, difficulty, categoryId, sort, page, perPage } = {}) {
  const result = await v1Request(`/wiki/articles${qs({ subject, type, difficulty, categoryId, sort, page, perPage })}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, articles: (result.data?.articles ?? []).map(toSummary), meta: toMeta(result.meta) };
}

/* مقالهٔ ناموجود، پیش‌نویس و آرشیو هر سه ۴۰۴ می‌دهند — تمایز داده نمی‌شود. */
export async function fetchWikiArticle(slug) {
  const result = await v1Request(`/wiki/articles/${encodeURIComponent(slug)}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return {
    ok: true,
    article: toArticle(result.data?.article),
    related: (result.data?.related ?? []).map(toRelation),
    backlinks: (result.data?.backlinks ?? []).map(toRelation),
  };
}

export async function searchWiki({ q, subject, type, difficulty, categoryId, sort, page, perPage } = {}) {
  const result = await v1Request(`/wiki/search${qs({ q, subject, type, difficulty, categoryId, sort, page, perPage })}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return {
    ok: true,
    query: result.data?.query ?? '',
    results: (result.data?.results ?? []).map(toSummary),
    facets: {
      bySubject: result.data?.facets?.bySubject ?? {},
      byType: result.data?.facets?.byType ?? {},
      byDifficulty: result.data?.facets?.byDifficulty ?? {},
    },
    meta: toMeta(result.meta),
  };
}

/* پیشنهاد خودکار — محدود و فقط عنوان/slug؛ برای کادر جست‌وجو. */
export async function suggestWiki({ q, limit } = {}) {
  const result = await v1Request(`/wiki/suggest${qs({ q, limit })}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return {
    ok: true,
    query: result.data?.query ?? '',
    suggestions: (result.data?.suggestions ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      subject: row.subject ?? null,
      contentType: row.content_type ?? null,
      difficulty: row.difficulty ?? null,
    })),
  };
}

/* ── نشانک‌ها (کاربر جاری — دامنهٔ خودِ کاربر، نه URL) ── */

export async function fetchWikiBookmarks({ page, perPage } = {}) {
  const result = await v1Request(`/me/wiki-bookmarks${qs({ page, perPage })}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, bookmarks: (result.data?.bookmarks ?? []).map(toBookmark), meta: toMeta(result.meta) };
}

/* افزودن نشانک idempotent است؛ تکرار همان مقاله خطا نمی‌دهد. */
export async function addWikiBookmark(articleId, { requestKey } = {}) {
  const result = await v1Request(`/me/wiki-bookmarks/${encodeURIComponent(articleId)}`, {
    method: 'PUT',
    idempotencyKey: requestKey ?? newRequestKey('wiki'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, bookmark: toBookmark(result.data?.bookmark) };
}

/* حذف نشانک idempotent است؛ نشانک ناموجود ۲۰۴ می‌دهد. */
export async function removeWikiBookmark(articleId) {
  const result = await v1Request(`/me/wiki-bookmarks/${encodeURIComponent(articleId)}`, { method: 'DELETE' });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true };
}

export { V1_REASON };
