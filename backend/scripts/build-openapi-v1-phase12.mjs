#!/usr/bin/env node
/*
 * افزودن مسیرها و schemaهای فاز ۱۲ (گراف دانش) به OpenAPI v1.
 *
 * همان الگوی build-openapi-v1-phase9-10.mjs: idempotent، مسیرهای فازهای قبل
 * را دست نمی‌زند و فقط مسیرهایی را می‌نویسد که واقعاً در routes/api.php هستند
 * (`ApiV1ContractTest` دوطرفه بودن را قفل می‌کند).
 *
 * اجرا: node scripts/build-openapi-v1-phase12.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'docs/openapi.v1.json');

const spec = JSON.parse(readFileSync(FILE, 'utf8'));

/* ── کمک‌تابع‌های ساخت پاسخ ─────────────────────────────────────────── */

const requestIdHeader = { 'X-Request-Id': { $ref: '#/components/headers/RequestId' } };

const jsonEnvelope = (dataProperties, metaProperties) => ({
  type: 'object',
  properties: {
    data: { type: 'object', properties: dataProperties },
    ...(metaProperties ? { meta: { type: 'object', properties: metaProperties } } : {}),
    requestId: { type: 'string' },
  },
});

const okResponse = (description, dataProperties, metaProperties) => ({
  description,
  headers: requestIdHeader,
  content: { 'application/json': { schema: jsonEnvelope(dataProperties, metaProperties) } },
});

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const refList = (name) => ({ type: 'array', items: ref(name) });
const string = { type: 'string' };
const uuid = { type: 'string', format: 'uuid' };
const integer = { type: 'integer' };
const number = { type: 'number' };
const nullable = (schema) => ({ ...schema, nullable: true });

const errorResponse = (description, code) => ({
  description,
  headers: requestIdHeader,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', enum: [code] },
              message: { type: 'string' },
              fields: { type: 'object' },
            },
          },
          requestId: { type: 'string' },
        },
      },
    },
  },
});

const unprocessable = () => errorResponse('خطای اعتبارسنجی', 'VALIDATION_FAILED');
const unauthorized = () => errorResponse('سشن معتبر نیست', 'UNAUTHENTICATED');
const forbidden = () => errorResponse('مجوز کافی ندارد', 'FORBIDDEN');
const rateLimited = () => errorResponse('سقف نرخ درخواست', 'RATE_LIMITED');
const notFound = () => errorResponse('منبع یافت نشد', 'NOT_FOUND');

const query = (name, description) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema: { type: 'string' },
});

/* ── Schemaها ───────────────────────────────────────────────────────── */

const KINDS = ['disease', 'concept', 'anatomy', 'process', 'pathway', 'drug', 'cell', 'molecule', 'microorganism', 'finding', 'labTest'];
const RELATIONS = ['part_of', 'contains', 'located_in', 'produces', 'regulates', 'activates', 'inhibits', 'causes', 'leads_to', 'associated_with', 'participates_in', 'targets', 'treated_by', 'measured_by', 'related_to'];

const schemas = {
  KnowledgeNode: {
    type: 'object',
    description: 'نود گراف دانش — قرارداد عمومی. `status`/`wiki_article_id` عمداً غایب‌اند (متادیتای داخلی).',
    properties: {
      id: uuid,
      label: string,
      kind: { type: 'string', enum: KINDS },
      article: {
        nullable: true,
        description: 'فقط وقتی نود به مقالهٔ ویکیِ **منتشرشده** متصل باشد.',
        type: 'object',
        properties: { slug: string, title: string },
      },
    },
    required: ['id', 'label', 'kind', 'article'],
  },
  KnowledgeEdge: {
    type: 'object',
    description: 'یال جهت‌دار گراف — `from → relation → to`.',
    properties: {
      from: uuid,
      to: uuid,
      relation: { type: 'string', enum: RELATIONS },
      weight: nullable(number),
    },
    required: ['from', 'to', 'relation'],
  },
  KnowledgeNeighbor: {
    type: 'object',
    description: 'همسایهٔ مستقیم نود با نوع و جهت رابطه.',
    properties: {
      node: ref('KnowledgeNode'),
      relation: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: RELATIONS },
          direction: { type: 'string', enum: ['out', 'in'], description: 'out = این نود مبدأ یال است.' },
          weight: nullable(number),
        },
        required: ['type', 'direction'],
      },
    },
    required: ['node', 'relation'],
  },
  KnowledgeGraphMeta: {
    type: 'object',
    description: 'متادیتای پاسخ گراف. `root=null` یعنی کل گراف منتشرشده.',
    properties: { root: nullable(uuid), depth: nullable(integer) },
  },
  AdminKnowledgeNode: {
    type: 'object',
    description: 'نود از دید پنل — شامل `status` و متادیتای مدیریتی.',
    properties: {
      id: uuid,
      label: string,
      kind: { type: 'string', enum: KINDS },
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      wiki_article_id: nullable(uuid),
      article_slug: nullable(string),
      edges_count: integer,
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'label', 'kind', 'status', 'wiki_article_id', 'edges_count'],
  },
};

/* ── مسیرها ─────────────────────────────────────────────────────────── */

const paths = {
  '/api/v1/knowledge/graph': {
    get: {
      tags: ['knowledge'],
      summary: 'گراف دانش عمومی',
      description:
        'بدون `node` ⇒ کل گراف منتشرشده (کراندار: ۲۰۰ نود/۵۰۰ یال). با `node` (UUID نود یا slug مقالهٔ ویکیِ منتشرشدهٔ متصل) ⇒ پیمایش BFS تا `depth` (سقف سرور ۳). فقط `published`؛ یالی که یک سرش غیرمنتشره است هرگز نمی‌آید. مجوز: عمومی.',
      parameters: [
        query('node', 'UUID نود یا slug مقالهٔ متصل'),
        query('depth', 'عمق پیمایش (۰ تا ۳؛ پیش‌فرض ۲)'),
        query('kind', 'فیلتر نوع نود'),
        query('relation', 'فیلتر نوع یال'),
      ],
      responses: {
        200: okResponse(
          'گراف عمومی',
          { nodes: refList('KnowledgeNode'), edges: refList('KnowledgeEdge') },
          { root: nullable(uuid), depth: nullable(integer) },
        ),
        400: errorResponse('پارامتر ناشناخته', 'UNKNOWN_QUERY_PARAMETER'),
        404: notFound(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/knowledge/nodes/{id}': {
    get: {
      tags: ['knowledge'],
      summary: 'جزئیات نود منتشرشده + همسایه‌های برچسب‌دار',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse(
          'نود و همسایه‌ها (هر دو جهت)',
          { node: ref('KnowledgeNode'), neighbors: refList('KnowledgeNeighbor') },
        ),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/knowledge/nodes/{id}/neighbors': {
    get: {
      tags: ['knowledge'],
      summary: 'همسایه‌های مستقیم نود منتشرشده',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse(
          'همسایه‌ها با نوع/جهت رابطه',
          { node: ref('KnowledgeNode'), neighbors: refList('KnowledgeNeighbor') },
        ),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/knowledge/nodes': {
    get: {
      tags: ['knowledge'],
      summary: 'فهرست نودها برای پنل — همهٔ وضعیت‌ها',
      description: 'مجوز: `articles.read`.',
      parameters: [
        query('status', 'draft | published | archived'),
        query('kind', 'فیلتر نوع نود'),
        query('q', 'جست‌وجو در label'),
        query('sort', 'label | created_at'),
        query('page', 'شمارهٔ صفحه'),
        query('perPage', 'اندازهٔ صفحه (سقف ۵۰)'),
      ],
      responses: {
        200: okResponse(
          'فهرست نودهای پنل',
          { nodes: refList('AdminKnowledgeNode') },
          { page: integer, perPage: integer, total: integer, lastPage: integer },
        ),
        400: errorResponse('پارامتر ناشناخته', 'UNKNOWN_QUERY_PARAMETER'),
        401: unauthorized(),
        403: forbidden(),
        429: rateLimited(),
      },
    },
    post: {
      tags: ['knowledge'],
      summary: 'ساخت نود — همیشه draft',
      description:
        'مجوز: `articles.create`. `status` در بدنه **موجود نیست**؛ انتشار فقط از مسیر publish. پیوند مقالهٔ ناموجود/آرشیو ⇒ ۴۲۲؛ مقالهٔ دارای نود ⇒ ۴۰۹.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                label: { type: 'string', maxLength: 240 },
                kind: { type: 'string', enum: KINDS },
                wikiArticleId: nullable(uuid),
              },
              required: ['label', 'kind'],
            },
          },
        },
      },
      responses: {
        201: okResponse('نود ساخته‌شده', { node: ref('AdminKnowledgeNode') }),
        401: unauthorized(),
        403: forbidden(),
        409: errorResponse('مقاله قبلاً به نود دیگری وصله', 'ARTICLE_ALREADY_LINKED'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/knowledge/nodes/{id}': {
    get: {
      tags: ['knowledge'],
      summary: 'نود از دید پنل',
      description: 'مجوز: `articles.read`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('نود', { node: ref('AdminKnowledgeNode') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
    patch: {
      tags: ['knowledge'],
      summary: 'ویرایش نود — label/kind/پیوند مقاله',
      description: 'مجوز: `articles.update`. `status` اینجا قابل تغییر نیست.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                label: { type: 'string', maxLength: 240 },
                kind: { type: 'string', enum: KINDS },
                wikiArticleId: nullable(uuid),
              },
            },
          },
        },
      },
      responses: {
        200: okResponse('نود ویرایش‌شده', { node: ref('AdminKnowledgeNode') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: errorResponse('مقاله قبلاً به نود دیگری وصله', 'ARTICLE_ALREADY_LINKED'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
    delete: {
      tags: ['knowledge'],
      summary: 'حذف فیزیکی نود — فقط بدون یال',
      description: 'مجوز: `articles.delete`. نود دارای یال ⇒ ۴۰۹ (آرشیو به‌جای حذف).',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        204: { description: 'حذف شد', headers: requestIdHeader },
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: errorResponse('نود یال دارد', 'NODE_HAS_EDGES'),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/knowledge/nodes/{id}/publish': {
    post: {
      tags: ['knowledge'],
      summary: 'انتشار نود',
      description: 'مجوز: `articles.publish`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('نود منتشرشده', { node: ref('AdminKnowledgeNode') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/knowledge/nodes/{id}/archive': {
    post: {
      tags: ['knowledge'],
      summary: 'آرشیو نود',
      description: 'مجوز: `articles.publish`. نود آرشیوشده از گراف عمومی حذف می‌شود.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('نود آرشیوشده', { node: ref('AdminKnowledgeNode') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/knowledge/edges': {
    post: {
      tags: ['knowledge'],
      summary: 'ساخت یال جهت‌دار',
      description:
        'مجوز: `articles.update`. یال تکراری (from,to,relation) ⇒ ۴۰۹؛ self edge ⇒ ۴۲۲؛ نود ناموجود ⇒ ۴۲۲. `id` یال در پاسخ برمی‌گردد (پنل برای حذف به آن نیاز دارد).',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                fromNodeId: uuid,
                toNodeId: uuid,
                relation: { type: 'string', enum: RELATIONS },
                weight: nullable(number),
              },
              required: ['fromNodeId', 'toNodeId', 'relation'],
            },
          },
        },
      },
      responses: {
        201: okResponse('یال ساخته‌شده (شامل id)', {
          edge: {
            type: 'object',
            properties: { id: uuid, from: uuid, to: uuid, relation: { type: 'string' }, weight: nullable(number) },
            required: ['id', 'from', 'to', 'relation'],
          },
        }),
        401: unauthorized(),
        403: forbidden(),
        409: errorResponse('یال تکراری', 'EDGE_ALREADY_EXISTS'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/knowledge/edges/{id}': {
    delete: {
      tags: ['knowledge'],
      summary: 'حذف یال',
      description: 'مجوز: `articles.update`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        204: { description: 'حذف شد', headers: requestIdHeader },
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
};

/* ── اعمال و نوشتن ──────────────────────────────────────────────────── */

for (const [name, schema] of Object.entries(schemas)) {
  spec.components.schemas[name] = schema;
}

for (const [path, operations] of Object.entries(paths)) {
  spec.paths[path] = operations;
}

const existingTags = new Set((spec.tags ?? []).map((tag) => tag.name));

if (!existingTags.has('knowledge')) {
  spec.tags.push({
    name: 'knowledge',
    description: 'گراف دانش — نود/یال/پیمایش کراندار (فاز ۱۲). فقط `published`؛ دامنه‌ای مستقل از ویکی.',
  });
}

// ترتیب پایدار: مسیرها الفبایی تا diff تمیز بماند.
spec.paths = Object.fromEntries(Object.entries(spec.paths).sort(([a], [b]) => a.localeCompare(b)));

spec.info.title =
  (spec.info.title ?? '') +
  '';
spec.info.description =
  (spec.info.description ?? '') +
  '\n\n**فاز ۱۲ (گراف دانش):** `/knowledge/graph` با پیمایش BFS کراندار (depth ≤ ۳، ۲۰۰ نود، ۵۰۰ یال)، فقط نودهای منتشرشده. مدیریت با مجوزهای واقعی `articles.*` — هیچ کلید `knowledge.*` اختراع نشد.';
spec.info.version = '1.6.0';

writeFileSync(FILE, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

const counts = Object.keys(spec.paths).length;
const operations = Object.values(spec.paths).reduce((sum, ops) => sum + Object.keys(ops).length, 0);

console.log(`openapi.v1.json → ${counts} paths / ${operations} operations / ${Object.keys(spec.components.schemas).length} schemas`);
