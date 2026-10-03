/*
 * پل گراف دانش بین فرانت و v1 (فاز ۱۲).
 *
 * قرارداد v1:
 *   GET /knowledge/graph                      → { nodes, edges }, meta: { root, depth }
 *   GET /knowledge/nodes/{id}                 → { node, neighbors }
 *   GET /knowledge/nodes/{id}/neighbors       → { node, neighbors }
 *
 * مرز اعتماد (فاز ۱۲): API عمومی هرگز `status`/`wiki_article_id`/timestamp
 * نمی‌آورد؛ نود پیش‌نویس/آرشیو ۴۰۴ می‌دهد. سقف‌های depth/نود/یال سمت سرورند و
 * این پل هیچ پارامتری بیرون از allowlist سرور نمی‌فرستد.
 *
 * تفاوت مدل داده: نود v1 فقط {id,label,kind,article?} است. فیلدهای نمایشی
 * `graphData.js` (courses/description/importance/aliases/…) فعلاً «محتوای
 * گراف» نیستند — این پل عمداً هیچ‌کدام را **از خودش نمی‌سازد** (null می‌دهد)
 * تا UI خودش به fallback موک برود؛ ساخت آن‌ها به فاز محتوای گراف تعلق دارد.
 */

import { V1_REASON, v1Request } from '../api/v1';

/* ── نگاشت snake_case → camelCase (آینهٔ Resources سرور) ── */

function toNode(row) {
  if (!row) return null;

  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    slug: row.article?.slug ?? null,
    title: row.article?.title ?? null,
    /* فیلدهای نمایشی موک — تا فاز محتوای گراف مقدار واقعی ندارند. */
    courses: [],
    description: null,
    importance: null,
  };
}

function toEdge(row) {
  if (!row) return null;

  return {
    source: row.from,
    target: row.to,
    type: row.relation,
    weight: row.weight == null ? null : Number(row.weight),
  };
}

function toNeighbor(row) {
  if (!row) return null;

  return {
    node: toNode(row.node),
    relation: {
      type: row.relation?.type ?? null,
      direction: row.relation?.direction ?? null,
      weight: row.relation?.weight == null ? null : Number(row.relation.weight),
    },
  };
}

function qs(params) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }

  const encoded = search.toString();

  return encoded ? `?${encoded}` : '';
}

/* ── عمومی ── */

/*
 * کل گراف: node را نمی‌فرستیم. با node (UUID نود یا slug مقالهٔ متصل) گراف
 * ریشه‌دار تا depth می‌آید — depth سقف سروری دارد و clamp سمت کلاینت فقط
 * برای جلوگیری از 422 بی‌مورد است.
 */
export async function fetchKnowledgeGraph({ node, depth, kind, relation, maxDepth = 3 } = {}) {
  const safeDepth = Math.max(0, Math.min(Number(depth ?? 2), Number(maxDepth)));
  const result = await v1Request(`/knowledge/graph${qs({ node, depth: safeDepth, kind, relation })}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return {
    ok: true,
    nodes: (result.data?.nodes ?? []).map(toNode),
    edges: (result.data?.edges ?? []).map(toEdge),
    root: result.meta?.root ?? null,
    depth: result.meta?.depth ?? null,
  };
}

/* نود ناموجود، پیش‌نویس و آرشیو هر سه ۴۰۴ می‌دهند — تمایز داده نمی‌شود. */
export async function fetchKnowledgeNode(nodeId) {
  const result = await v1Request(`/knowledge/nodes/${encodeURIComponent(nodeId)}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return {
    ok: true,
    node: toNode(result.data?.node),
    neighbors: (result.data?.neighbors ?? []).map(toNeighbor),
  };
}

export async function fetchKnowledgeNeighbors(nodeId) {
  const result = await v1Request(`/knowledge/nodes/${encodeURIComponent(nodeId)}/neighbors`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return {
    ok: true,
    node: toNode(result.data?.node),
    neighbors: (result.data?.neighbors ?? []).map(toNeighbor),
  };
}

export { V1_REASON };
