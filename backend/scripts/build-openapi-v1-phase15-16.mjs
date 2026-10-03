#!/usr/bin/env node
/*
 * افزودن مسیرها و schemaهای فاز ۱۵/۱۶ به OpenAPI v1.
 *
 * همان الگوی build-openapi-v1-phase12.mjs: idempotent، مسیرهای فازهای قبل را
 * دست نمی‌زند و فقط مسیرهایی را می‌نویسد که واقعاً در routes/api.php هستند
 * (`ApiV1ContractTest` دوطرفه بودن را قفل می‌کند).
 *
 * اجرا: node scripts/build-openapi-v1-phase15-16.mjs
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

const noContent = (description = 'انجام شد') => ({ description, headers: requestIdHeader });

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const refList = (name) => ({ type: 'array', items: ref(name) });
const string = { type: 'string' };
const uuid = { type: 'string', format: 'uuid' };
const integer = { type: 'integer' };
const nullable = (schema) => ({ ...schema, nullable: true });
const dateTime = { type: 'string', format: 'date-time' };

const pageMeta = { page: integer, perPage: integer, total: integer, lastPage: integer };

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

const body = (properties, required) => ({
  required: true,
  content: {
    'application/json': {
      schema: { type: 'object', properties, ...(required ? { required } : {}) },
    },
  },
});

const pathId = (name = 'id') => ({ name, in: 'path', required: true, schema: uuid });

/* ── Schemaها ───────────────────────────────────────────────────────── */

const MEDIA_KINDS = ['image', 'document', 'video', 'model3d'];
const CONTENT_STATUS = ['draft', 'published', 'archived'];
const ANATOMY_CATEGORIES = ['skin', 'bones', 'muscles', 'nerves', 'cns', 'arteries', 'veins', 'respiratory', 'digestive', 'urinary', 'reproductive', 'ligaments', 'lymph', 'fasciae', 'refs', 'other'];
const NOTE_KINDS = ['text', 'checklist', 'qa', 'table'];
const FEEDBACK_SOURCES = ['support', 'test-bank', 'coordinated-exam', 'comprehensive', 'micro', 'question-lab', 'intl-courses'];
const FEEDBACK_STATUS = ['open', 'answered', 'closed'];
const REVIEW_STAGES = [1, 2, 3, 4, 5];

const schemas = {
  MediaAccess: {
    type: 'object',
    description: 'URL استریم. فایل خصوصی Signed URL کوتاه‌عمر دارد (پیش‌فرض ۱۰ دقیقه).',
    properties: { url: string, expiresAt: nullable(dateTime) },
    required: ['url'],
  },
  MediaFile: {
    type: 'object',
    description: 'رکورد Media — مسیر ذخیره (`key`) از پاسخ عمومی حذف است.',
    properties: {
      id: uuid,
      kind: { type: 'string', enum: MEDIA_KINDS },
      mime: string,
      sizeBytes: integer,
      visibility: { type: 'string', enum: ['public', 'private'] },
      status: { type: 'string', enum: ['active', 'archived'] },
      originalName: nullable(string),
      url: nullable(string),
      expiresAt: nullable(dateTime),
      createdAt: dateTime,
    },
    required: ['id', 'kind', 'mime', 'sizeBytes', 'visibility', 'status'],
  },
  ReferenceTopic: {
    type: 'object',
    description: 'موضوع داخل فصل؛ `content` خروجی پاک‌ساز whitelist است.',
    properties: { id: string, title: string, content: string },
    required: ['id', 'title', 'content'],
  },
  ReferenceSection: {
    type: 'object',
    properties: { id: string, title: string, topics: refList('ReferenceTopic') },
    required: ['id', 'title', 'topics'],
  },
  Reference: {
    type: 'object',
    description: 'مرجع منتشرشده — فقط `published`؛ پیش‌نویس ۴۰۴.',
    properties: {
      id: uuid,
      slug: string,
      title: string,
      description: nullable(string),
      sections: refList('ReferenceSection'),
      chapterCount: integer,
      assets: { type: 'object', additionalProperties: string, description: 'نقشهٔ key → URL استریم' },
      publishedAt: nullable(dateTime),
      updatedAt: dateTime,
    },
    required: ['id', 'slug', 'title', 'sections', 'chapterCount', 'assets'],
  },
  AdminReference: {
    type: 'object',
    description: 'مرجع از دید پنل — با وضعیت و متادیتای مدیریتی.',
    properties: {
      id: uuid,
      slug: string,
      title: string,
      description: nullable(string),
      sections: refList('ReferenceSection'),
      status: { type: 'string', enum: CONTENT_STATUS },
      version: integer,
      authorAdminId: nullable(uuid),
      editorAdminId: nullable(uuid),
      publishedAt: nullable(dateTime),
      createdAt: dateTime,
      updatedAt: dateTime,
    },
    required: ['id', 'slug', 'title', 'sections', 'status', 'version'],
  },
  AnatomyAsset: {
    type: 'object',
    description: 'asset اطلس سه‌بعدی — نگاشت part_key → Media. Viewer واقعی API صدا نمی‌زند؛ این کاتالوگ قرارداد اتصال آینده است.',
    properties: {
      id: uuid,
      part_key: string,
      label: nullable(string),
      category: { type: 'string', enum: ANATOMY_CATEGORIES },
      subject_id: nullable(uuid),
      media: nullable({ type: 'object', properties: { id: uuid, mime: string, size_bytes: integer } }),
      url: nullable(string),
      url_expires_at: nullable(dateTime),
      updated_at: dateTime,
    },
    required: ['id', 'part_key', 'category', 'media', 'url'],
  },
  AdminAnatomyAsset: {
    type: 'object',
    description: 'asset از دید پنل — part_key تغییرناپذیر است.',
    properties: {
      id: uuid,
      part_key: string,
      label: nullable(string),
      category: { type: 'string', enum: ANATOMY_CATEGORIES },
      subject_id: nullable(uuid),
      media_id: nullable(uuid),
      media: nullable({ type: 'object', properties: { id: uuid, mime: string, size_bytes: integer } }),
      status: { type: 'string', enum: CONTENT_STATUS },
      version: integer,
      published_at: nullable(dateTime),
      created_at: dateTime,
      updated_at: dateTime,
    },
    required: ['id', 'part_key', 'category', 'status', 'version'],
  },
  ArticleCategory: {
    type: 'object',
    properties: { id: uuid, slug: string, name: string },
    required: ['id', 'slug', 'name'],
  },
  ArticleSummary: {
    type: 'object',
    description: 'خلاصهٔ مقالهٔ منتشرشده برای فهرست.',
    properties: {
      id: uuid,
      slug: string,
      title: string,
      summary: nullable(string),
      category: nullable(ref('ArticleCategory')),
      publishedAt: nullable(dateTime),
    },
    required: ['id', 'slug', 'title', 'category'],
  },
  Article: {
    type: 'object',
    description: 'مقالهٔ منتشرشده — `body` خروجی پاک‌ساز whitelist است.',
    properties: {
      id: uuid,
      slug: string,
      title: string,
      summary: nullable(string),
      body: string,
      category: nullable(ref('ArticleCategory')),
      publishedAt: nullable(dateTime),
    },
    required: ['id', 'slug', 'title', 'body', 'category'],
  },
  AdminArticle: {
    type: 'object',
    description: 'مقاله از دید پنل؛ `version` برای optimistic lock ادیتور.',
    properties: {
      id: uuid,
      category_id: nullable(uuid),
      category: nullable(ref('ArticleCategory')),
      slug: string,
      title: string,
      summary: nullable(string),
      body: string,
      status: { type: 'string', enum: CONTENT_STATUS },
      version: integer,
      author_admin_id: nullable(uuid),
      editor_admin_id: nullable(uuid),
      published_at: nullable(dateTime),
      created_at: dateTime,
      updated_at: dateTime,
    },
    required: ['id', 'slug', 'title', 'body', 'status', 'version'],
  },
  ArticleBookmark: {
    type: 'object',
    properties: {
      id: uuid,
      article_id: uuid,
      created_at: dateTime,
      article: ref('ArticleSummary'),
    },
    required: ['id', 'article_id', 'created_at', 'article'],
  },
  UserNote: {
    type: 'object',
    description: 'یادداشت شخصی — مالکیت فقط از سشن؛ هیچ مسیر دیگری به یادداشت کاربر دیگر نمی‌رسد.',
    properties: {
      id: uuid,
      kind: { type: 'string', enum: NOTE_KINDS },
      title: nullable(string),
      body: nullable(string),
      content: nullable({ description: 'بدنهٔ ساختاری برای checklist/qa/table', type: 'object' }),
      subjectId: nullable(uuid),
      tags: { type: 'array', items: string },
      color: nullable(string),
      pinned: { type: 'boolean' },
      source: nullable({ type: 'object', properties: { type: string, id: string, title: nullable(string) } }),
      createdAt: dateTime,
      updatedAt: dateTime,
    },
    required: ['id', 'kind', 'pinned', 'createdAt', 'updatedAt'],
  },
  ReviewItem: {
    type: 'object',
    description: 'آیتم مرور G5 — مرحلهٔ بعد سمت سرور محاسبه می‌شود؛ کلاینت `stage` نمی‌فرستد.',
    properties: {
      id: uuid,
      sourceType: { type: 'string', enum: ['lesson', 'question', 'article', 'wiki', 'book', 'other'] },
      sourceId: uuid,
      title: nullable(string),
      subject: nullable(string),
      description: nullable(string),
      activityType: string,
      stage: { type: 'integer', enum: REVIEW_STAGES },
      status: { type: 'string', enum: ['active', 'completed'] },
      learnedAt: dateTime,
      lastReviewedAt: nullable(dateTime),
      dueAt: nullable(dateTime),
      completedReviews: integer,
      completedAt: nullable(dateTime),
      history: { type: 'array', items: { type: 'object', properties: { stage: integer, reviewedAt: dateTime } } },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
    required: ['id', 'sourceType', 'sourceId', 'stage', 'status', 'learnedAt', 'completedReviews'],
  },
  StudyGroup: {
    type: 'object',
    description: 'گروه مطالعه — کد فقط یک‌بار در create/rotate برمی‌گردد و هرگز ذخیره نمی‌شود (فقط SHA-256).',
    properties: {
      id: uuid,
      name: nullable(string),
      planId: nullable(string),
      seats: integer,
      memberCount: integer,
      status: { type: 'string', enum: ['active', 'archived'] },
      createdAt: dateTime,
    },
    required: ['id', 'seats', 'memberCount', 'status'],
  },
  GroupMember: {
    type: 'object',
    properties: { id: uuid, role: { type: 'string', enum: ['owner', 'member'] }, joinedAt: dateTime },
    required: ['id', 'role'],
  },
  FeedbackReply: {
    type: 'object',
    properties: { id: uuid, body: string, adminName: nullable(string), createdAt: dateTime },
    required: ['id', 'body', 'createdAt'],
  },
  Feedback: {
    type: 'object',
    description: 'بازخورد — بدنه plain text؛ پاسخ ادمین فقط با مجوز `feedback.manage`.',
    properties: {
      id: uuid,
      source: { type: 'string', enum: FEEDBACK_SOURCES },
      status: { type: 'string', enum: FEEDBACK_STATUS },
      subject: nullable(string),
      category: nullable(string),
      body: string,
      meta: nullable({ type: 'object', additionalProperties: true }),
      repliesCount: integer,
      replies: refList('FeedbackReply'),
      createdAt: dateTime,
    },
    required: ['id', 'source', 'status', 'body', 'createdAt'],
  },
};

/* ── مسیرها ─────────────────────────────────────────────────────────── */

const paths = {
  /* فاز ۱۵ — Media */
  '/api/v1/media/{id}/access': {
    get: {
      tags: ['media'],
      summary: 'URL استریم برای فایل مجاز',
      description:
        'فایل عمومی URL ساده می‌دهد؛ فایل خصوصی Signed URL کوتاه‌عمر (پیش‌فرض ۱۰ دقیقه). فایل خصوصیِ دیگران ۴۰۴ است (وجودش افشا نمی‌شود). مجوز: سشن دانشجو.',
      parameters: [pathId()],
      responses: {
        200: okResponse('URL استریم', { media: ref('MediaAccess') }),
        401: unauthorized(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/media/{id}/stream': {
    get: {
      tags: ['media'],
      summary: 'استریم باینری فایل',
      description:
        'فایل خصوصی فقط با امضای معتبر (`expires` گذشته ⇒ ۴۰۳). فایل عمومی با `Cache-Control: immutable` می‌آید. Media آرشیوشده ۴۰۴ است.',
      parameters: [pathId()],
      responses: {
        200: { description: 'محتوای باینری فایل', headers: requestIdHeader },
        403: errorResponse('فایل خصوصی بدون امضا یا امضای منقضی', 'FORBIDDEN'),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/media/uploads': {
    post: {
      tags: ['media'],
      summary: 'آپلود فایل از پنل',
      description:
        'مجوز: `media.upload`. اعتبارسنجی چندلایه: پسوند + MIME اعلامی + MIME شناسایی‌شده از magic bytes + سقف حجم بر اساس kind (۴۱۵/۴۱۳). مسیر ذخیره از ورودی کاربر ساخته نمی‌شود؛ sha256 سمت سرور محاسبه می‌شود.',
      parameters: [{ name: 'visibility', in: 'query', required: false, schema: { type: 'string', enum: ['public', 'private'] }, description: 'پیش‌فرض private' }],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' },
                visibility: { type: 'string', enum: ['public', 'private'] },
              },
              required: ['file'],
            },
          },
        },
      },
      responses: {
        201: okResponse('فایل ذخیره‌شده', { media: ref('MediaFile') }),
        401: unauthorized(),
        403: forbidden(),
        413: errorResponse('حجم فایل بیش از سقف kind', 'UPLOAD_TOO_LARGE'),
        415: errorResponse('نوع فایل پذیرفته نیست یا با محتوا نمی‌خواند', 'UPLOAD_TYPE_REJECTED'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/media': {
    get: {
      tags: ['media'],
      summary: 'فهرست Media پنل',
      description: 'مجوز: `media.read`.',
      parameters: [
        { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['active', 'archived'] } },
        { name: 'visibility', in: 'query', required: false, schema: { type: 'string', enum: ['public', 'private'] } },
        { name: 'page', in: 'query', required: false, schema: integer },
        { name: 'perPage', in: 'query', required: false, schema: integer },
      ],
      responses: {
        200: okResponse('فهرست Media', { media: refList('MediaFile') }, pageMeta),
        401: unauthorized(),
        403: forbidden(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/media/{id}/archive': {
    post: {
      tags: ['media'],
      summary: 'آرشیو Media (حذف نرم)',
      description: 'مجوز: `media.delete`. فایل روی دیسک می‌ماند؛ استریم ۴۰۴ می‌شود.',
      parameters: [pathId()],
      responses: {
        200: okResponse('آرشیو شد', { media: { type: 'object', properties: { id: uuid, status: string }, required: ['id', 'status'] } }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/media/{id}': {
    delete: {
      tags: ['media'],
      summary: 'حذف فیزیکی رکورد — فقط آرشیوشده',
      description: 'مجوز: `media.delete`. حذف رکورد فعال ۴۰۹ می‌دهد.',
      parameters: [pathId()],
      responses: {
        204: noContent(),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: errorResponse('رکورد هنوز آرشیو نشده', 'MEDIA_NOT_ARCHIVED'),
        429: rateLimited(),
      },
    },
  },

  /* فاز ۱۵ — References */
  '/api/v1/references': {
    get: {
      tags: ['reference'],
      summary: 'فهرست مراجع منتشرشده',
      parameters: [
        { name: 'page', in: 'query', required: false, schema: integer },
        { name: 'perPage', in: 'query', required: false, schema: integer },
      ],
      responses: {
        200: okResponse('فهرست مراجع', { references: refList('Reference') }, pageMeta),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/references/{idOrSlug}': {
    get: {
      tags: ['reference'],
      summary: 'جزئیات مرجع منتشرشده',
      description: 'با UUID یا slug. پیش‌نویس/آرشیو ۴۰۴ — وجودشان افشا نمی‌شود.',
      parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: string }],
      responses: {
        200: okResponse('مرجع کامل', { reference: ref('Reference') }),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/references': {
    get: {
      tags: ['reference'],
      summary: 'فهرست مراجع پنل — همهٔ وضعیت‌ها',
      description: 'مجوز: `references.read`.',
      parameters: [
        { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: CONTENT_STATUS } },
        { name: 'q', in: 'query', required: false, schema: string },
        { name: 'page', in: 'query', required: false, schema: integer },
        { name: 'perPage', in: 'query', required: false, schema: integer },
      ],
      responses: {
        200: okResponse('فهرست پنل', { references: refList('AdminReference') }, pageMeta),
        401: unauthorized(),
        403: forbidden(),
        429: rateLimited(),
      },
    },
    post: {
      tags: ['reference'],
      summary: 'ساخت مرجع — همیشه draft',
      description: 'مجوز: `references.create`. ساختار sections کراندار است (سقف فصل/موضوع/حجم محتوا از config) و محتوا از پاک‌ساز عبور می‌کند.',
      requestBody: body({
        slug: { type: 'string', maxLength: 120 },
        title: { type: 'string', maxLength: 200 },
        description: nullable(string),
        sections: refList('ReferenceSection'),
      }, ['slug', 'title', 'sections']),
      responses: {
        201: okResponse('مرجع ساخته‌شده', { reference: ref('AdminReference') }),
        401: unauthorized(),
        403: forbidden(),
        409: errorResponse('slug تکراری', 'SLUG_TAKEN'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/references/{id}': {
    get: {
      tags: ['reference'],
      summary: 'مرجع از دید پنل',
      description: 'مجوز: `references.read`.',
      parameters: [pathId()],
      responses: {
        200: okResponse('مرجع', { reference: ref('AdminReference') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
    patch: {
      tags: ['reference'],
      summary: 'ویرایش مرجع',
      description: 'مجوز: `references.update`. `slug` و `status` اینجا عوض نمی‌شوند.',
      parameters: [pathId()],
      requestBody: body({
        title: string,
        description: nullable(string),
        sections: refList('ReferenceSection'),
      }),
      responses: {
        200: okResponse('مرجع ویرایش‌شده', { reference: ref('AdminReference') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/references/{id}/publish': {
    post: {
      tags: ['reference'],
      summary: 'انتشار مرجع',
      description: 'مجوز: `references.publish`.',
      parameters: [pathId()],
      responses: {
        200: okResponse('منتشرشده', { reference: ref('AdminReference') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/references/{id}/archive': {
    post: {
      tags: ['reference'],
      summary: 'آرشیو مرجع',
      description: 'مجوز: `references.publish`. از مسیر عمومی حذف می‌شود.',
      parameters: [pathId()],
      responses: {
        200: okResponse('آرشیو شد', { reference: ref('AdminReference') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/references/{id}/assets': {
    post: {
      tags: ['reference'],
      summary: 'اتصال Media به مرجع',
      description: 'مجوز: `references.update`. Media باید `active` باشد؛ جفت تکراری ۴۰۹.',
      parameters: [pathId()],
      requestBody: body({ mediaId: uuid, key: string, label: nullable(string) }, ['mediaId']),
      responses: {
        201: okResponse('asset متصل‌شده', { asset: { type: 'object', properties: { id: uuid, reference_id: uuid, media_id: uuid, key: string }, required: ['id', 'media_id'] } }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: errorResponse('این Media قبلاً به مرجع وصل شده', 'ASSET_ALREADY_ATTACHED'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/references/{id}/assets/{assetId}': {
    delete: {
      tags: ['reference'],
      summary: 'جداسازی Media از مرجع',
      description: 'مجوز: `references.update`. Media خودش حذف نمی‌شود.',
      parameters: [pathId(), pathId('assetId')],
      responses: {
        204: noContent(),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },

  /* فاز ۱۵ — Anatomy */
  '/api/v1/anatomy/assets': {
    get: {
      tags: ['anatomy'],
      summary: 'کاتالوگ منتشرشدهٔ اطلس',
      description: 'نگاشت part_key → Media؛ URL فایل خصوصی Signed است. Detail endpoint عمداً وجود ندارد (viewer امروز API صدا نمی‌زند).',
      parameters: [
        { name: 'category', in: 'query', required: false, schema: { type: 'string', enum: ANATOMY_CATEGORIES } },
        { name: 'subjectId', in: 'query', required: false, schema: uuid },
      ],
      responses: {
        200: okResponse('کاتالوگ assetها', { assets: refList('AnatomyAsset') }),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/anatomy/assets': {
    get: {
      tags: ['anatomy'],
      summary: 'فهرست assetهای پنل — همهٔ وضعیت‌ها',
      description: 'مجوز: `references.read` (کلید مستقل آناتومی در RBAC واقعی پنل وجود ندارد).',
      parameters: [
        { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: CONTENT_STATUS } },
        { name: 'category', in: 'query', required: false, schema: { type: 'string', enum: ANATOMY_CATEGORIES } },
      ],
      responses: {
        200: okResponse('فهرست پنل', { assets: refList('AdminAnatomyAsset') }),
        401: unauthorized(),
        403: forbidden(),
        429: rateLimited(),
      },
    },
    post: {
      tags: ['anatomy'],
      summary: 'ساخت asset — همیشه draft',
      description: 'مجوز: `references.create`. `part_key` یکتاست؛ تکرارش ۴۰۹. Media ناموجود/آرشیو ۴۲۲.',
      requestBody: body({
        mediaId: uuid,
        partKey: { type: 'string', maxLength: 120, description: 'مثل `femur.left`' },
        label: nullable(string),
        category: { type: 'string', enum: ANATOMY_CATEGORIES },
        subjectId: nullable(uuid),
      }, ['mediaId', 'partKey']),
      responses: {
        201: okResponse('asset ساخته‌شده', { asset: ref('AdminAnatomyAsset') }),
        401: unauthorized(),
        403: forbidden(),
        409: errorResponse('part_key تکراری', 'PART_KEY_TAKEN'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/anatomy/assets/{id}': {
    patch: {
      tags: ['anatomy'],
      summary: 'ویرایش asset — بدون part_key',
      description: 'مجوز: `references.update`. ارسال `partKey` در بدنه ۴۲۲ می‌گیرد (هویت asset تغییرناپذیر است).',
      parameters: [pathId()],
      requestBody: body({
        label: nullable(string),
        category: { type: 'string', enum: ANATOMY_CATEGORIES },
        subjectId: nullable(uuid),
        mediaId: uuid,
      }),
      responses: {
        200: okResponse('asset ویرایش‌شده', { asset: ref('AdminAnatomyAsset') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/anatomy/assets/{id}/publish': {
    post: {
      tags: ['anatomy'],
      summary: 'انتشار asset',
      description: 'مجوز: `references.publish`.',
      parameters: [pathId()],
      responses: {
        200: okResponse('منتشرشده', { asset: ref('AdminAnatomyAsset') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/anatomy/assets/{id}/archive': {
    post: {
      tags: ['anatomy'],
      summary: 'آرشیو asset',
      description: 'مجوز: `references.publish`. از کاتالوگ عمومی حذف می‌شود.',
      parameters: [pathId()],
      responses: {
        200: okResponse('آرشیو شد', { asset: ref('AdminAnatomyAsset') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },

  /* فاز ۱۶ — Articles */
  '/api/v1/articles': {
    get: {
      tags: ['articles'],
      summary: 'فهرست مقاله‌های منتشرشده',
      parameters: [
        { name: 'category', in: 'query', required: false, schema: string, description: 'slug دسته' },
        { name: 'sort', in: 'query', required: false, schema: { type: 'string', enum: ['latest'] } },
        { name: 'page', in: 'query', required: false, schema: integer },
        { name: 'perPage', in: 'query', required: false, schema: integer },
      ],
      responses: {
        200: okResponse('فهرست مقاله‌ها', { articles: refList('ArticleSummary') }, pageMeta),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/articles/categories': {
    get: {
      tags: ['articles'],
      summary: 'دسته‌های مقاله با شمار مقالهٔ منتشرشده',
      responses: {
        200: okResponse('دسته‌ها', {
          categories: { type: 'array', items: { type: 'object', properties: { id: uuid, slug: string, name: string, sortOrder: integer, articlesCount: integer }, required: ['id', 'slug', 'name', 'articlesCount'] } },
        }),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/articles/{slug}': {
    get: {
      tags: ['articles'],
      summary: 'جزئیات مقالهٔ منتشرشده',
      description: 'پیش‌نویس/آرشیو ۴۰۴ — slug enumeration بسته است.',
      parameters: [{ name: 'slug', in: 'path', required: true, schema: string }],
      responses: {
        200: okResponse('مقاله کامل', { article: ref('Article') }),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/me/article-bookmarks': {
    get: {
      tags: ['articles'],
      summary: 'نشان‌های مقالهٔ من',
      description: 'فقط مقاله‌های هنوز منتشرشده در فهرست می‌آیند.',
      parameters: [
        { name: 'page', in: 'query', required: false, schema: integer },
        { name: 'perPage', in: 'query', required: false, schema: integer },
      ],
      responses: {
        200: okResponse('فهرست نشان‌ها', { bookmarks: refList('ArticleBookmark') }, pageMeta),
        401: unauthorized(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/me/article-bookmarks/{articleId}': {
    put: {
      tags: ['articles'],
      summary: 'افزودن نشان — idempotent',
      description: 'ساخت تازه ۲۰۱؛ تکرارِ نشان موجود ۲۰۰ (رکورد تازه نمی‌سازد). مقالهٔ منتشرنشده ۴۰۴.',
      parameters: [pathId('articleId')],
      responses: {
        200: okResponse('قبلاً نشان شده', { bookmark: ref('ArticleBookmark') }),
        201: okResponse('نشان ساخته شد', { bookmark: ref('ArticleBookmark') }),
        401: unauthorized(),
        404: notFound(),
        429: rateLimited(),
      },
    },
    delete: {
      tags: ['articles'],
      summary: 'حذف نشان — idempotent',
      description: 'نبودن نشان خطا نیست؛ همیشه ۲۰۴.',
      parameters: [pathId('articleId')],
      responses: {
        204: noContent(),
        401: unauthorized(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/articles': {
    get: {
      tags: ['articles'],
      summary: 'فهرست مقاله‌های پنل — همهٔ وضعیت‌ها',
      description: 'مجوز: `articles.read`.',
      parameters: [
        { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: CONTENT_STATUS } },
        { name: 'categoryId', in: 'query', required: false, schema: uuid },
        { name: 'q', in: 'query', required: false, schema: string },
        { name: 'page', in: 'query', required: false, schema: integer },
        { name: 'perPage', in: 'query', required: false, schema: integer },
      ],
      responses: {
        200: okResponse('فهرست پنل', { articles: refList('AdminArticle') }, pageMeta),
        401: unauthorized(),
        403: forbidden(),
        429: rateLimited(),
      },
    },
    post: {
      tags: ['articles'],
      summary: 'ساخت مقاله — همیشه draft',
      description: 'مجوز: `articles.create`. `status`/`author` از بدنه نمی‌آیند؛ body از پاک‌ساز عبور می‌کند.',
      requestBody: body({
        slug: string,
        title: string,
        summary: nullable(string),
        body: string,
        categoryId: nullable(uuid),
      }, ['slug', 'title', 'body']),
      responses: {
        201: okResponse('مقاله ساخته‌شده', { article: ref('AdminArticle') }),
        401: unauthorized(),
        403: forbidden(),
        409: errorResponse('slug تکراری', 'SLUG_TAKEN'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/articles/{id}': {
    get: {
      tags: ['articles'],
      summary: 'مقاله از دید پنل',
      description: 'مجوز: `articles.read`.',
      parameters: [pathId()],
      responses: {
        200: okResponse('مقاله', { article: ref('AdminArticle') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
    patch: {
      tags: ['articles'],
      summary: 'ویرایش مقاله با optimistic lock',
      description: 'مجوز: `articles.update`. `expectedVersion` قدیمی ⇒ ۴۰۹.',
      parameters: [pathId()],
      requestBody: body({
        title: string,
        summary: nullable(string),
        body: string,
        categoryId: nullable(uuid),
        expectedVersion: integer,
      }),
      responses: {
        200: okResponse('ویرایش‌شده', { article: ref('AdminArticle') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: errorResponse('نسخه قدیمی است', 'VERSION_CONFLICT'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/articles/{id}/publish': {
    post: {
      tags: ['articles'],
      summary: 'انتشار مقاله',
      description: 'مجوز: `articles.publish`.',
      parameters: [pathId()],
      responses: {
        200: okResponse('منتشرشده', { article: ref('AdminArticle') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/articles/{id}/archive': {
    post: {
      tags: ['articles'],
      summary: 'آرشیو مقاله',
      description: 'مجوز: `articles.publish`. از مسیر عمومی و فهرست نشان‌ها حذف می‌شود.',
      parameters: [pathId()],
      responses: {
        200: okResponse('آرشیو شد', { article: ref('AdminArticle') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/articles/categories': {
    get: {
      tags: ['articles'],
      summary: 'دسته‌های پنل',
      description: 'مجوز: `categories.read`.',
      responses: {
        200: okResponse('دسته‌ها', { categories: { type: 'array', items: { type: 'object', properties: { id: uuid, slug: string, name: string, sortOrder: integer, status: { type: 'string', enum: CONTENT_STATUS }, articlesCount: integer } } } }),
        401: unauthorized(),
        403: forbidden(),
        429: rateLimited(),
      },
    },
    post: {
      tags: ['articles'],
      summary: 'ساخت دسته — بلافاصله public',
      description: 'مجوز: `categories.create`. دسته taxonomy است نه محتوا؛ publish جدا ندارد.',
      requestBody: body({ slug: string, name: string, sortOrder: integer }, ['slug', 'name']),
      responses: {
        201: okResponse('دسته ساخته‌شده', { category: { type: 'object', properties: { id: uuid, slug: string, name: string, sortOrder: integer, status: { type: 'string', enum: CONTENT_STATUS } } } }),
        401: unauthorized(),
        403: forbidden(),
        409: errorResponse('slug تکراری', 'SLUG_TAKEN'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/articles/categories/{id}': {
    patch: {
      tags: ['articles'],
      summary: 'ویرایش دسته',
      description: 'مجوز: `categories.update` (نقش editor این مجوز را ندارد — آینهٔ legacy).',
      parameters: [pathId()],
      requestBody: body({ name: string, sortOrder: integer }),
      responses: {
        200: okResponse('دسته ویرایش‌شده', { category: { type: 'object', properties: { id: uuid, slug: string, name: string, sortOrder: integer, status: { type: 'string', enum: CONTENT_STATUS } } } }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
    delete: {
      tags: ['articles'],
      summary: 'حذف دسته',
      description: 'مجوز: `categories.delete`. دسته دارای مقاله ۴۰۹ می‌دهد.',
      parameters: [pathId()],
      responses: {
        204: noContent(),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: errorResponse('دسته مقاله دارد', 'CATEGORY_IN_USE'),
        429: rateLimited(),
      },
    },
  },

  /* فاز ۱۶ — یادداشت شخصی */
  '/api/v1/me/notes': {
    get: {
      tags: ['notes'],
      summary: 'یادداشت‌های من',
      parameters: [
        { name: 'kind', in: 'query', required: false, schema: { type: 'string', enum: NOTE_KINDS } },
        { name: 'subjectId', in: 'query', required: false, schema: uuid },
        { name: 'sourceType', in: 'query', required: false, schema: string },
        { name: 'sourceId', in: 'query', required: false, schema: string },
        { name: 'pinned', in: 'query', required: false, schema: { type: 'boolean' } },
        { name: 'q', in: 'query', required: false, schema: string },
        { name: 'page', in: 'query', required: false, schema: integer },
        { name: 'perPage', in: 'query', required: false, schema: integer },
      ],
      responses: {
        200: okResponse('یادداشت‌ها', { notes: refList('UserNote') }, pageMeta),
        401: unauthorized(),
        429: rateLimited(),
      },
    },
    post: {
      tags: ['notes'],
      summary: 'ساخت یادداشت',
      description: 'بدنه بر اساس `kind` اعتبارسنجی می‌شود (checklist/qa/table ساختارِ بسته دارند).',
      requestBody: body({
        kind: { type: 'string', enum: NOTE_KINDS },
        title: nullable(string),
        body: nullable(string),
        content: nullable({ type: 'object' }),
        subjectId: nullable(uuid),
        tags: { type: 'array', items: string },
        color: nullable(string),
        sourceType: string,
        sourceId: string,
        sourceTitle: nullable(string),
      }, ['kind']),
      responses: {
        201: okResponse('یادداشت ساخته‌شده', { note: ref('UserNote') }),
        401: unauthorized(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/me/notes/{id}': {
    patch: {
      tags: ['notes'],
      summary: 'ویرایش یادداشت من',
      description: 'یادداشت کاربر دیگر ۴۰۴ (IDOR بسته).',
      parameters: [pathId()],
      requestBody: body({
        title: nullable(string),
        body: nullable(string),
        content: nullable({ type: 'object' }),
        tags: { type: 'array', items: string },
        color: nullable(string),
        pinned: { type: 'boolean' },
      }),
      responses: {
        200: okResponse('ویرایش‌شده', { note: ref('UserNote') }),
        401: unauthorized(),
        404: notFound(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
    delete: {
      tags: ['notes'],
      summary: 'حذف یادداشت من',
      parameters: [pathId()],
      responses: {
        204: noContent(),
        401: unauthorized(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },

  /* فاز ۱۶ — مرور G5 */
  '/api/v1/me/review-items': {
    get: {
      tags: ['notes'],
      summary: 'آیتم‌های مرور من',
      parameters: [
        { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['active', 'completed'] } },
        { name: 'due', in: 'query', required: false, schema: { type: 'boolean' }, description: 'فقط سررسیدگذشته‌ها' },
        { name: 'sourceType', in: 'query', required: false, schema: string },
        { name: 'page', in: 'query', required: false, schema: integer },
        { name: 'perPage', in: 'query', required: false, schema: integer },
      ],
      responses: {
        200: okResponse('آیتم‌ها', { items: refList('ReviewItem') }, pageMeta),
        401: unauthorized(),
        429: rateLimited(),
      },
    },
    post: {
      tags: ['notes'],
      summary: 'افزودن آیتم مرور — idempotent',
      description: 'هر (user, sourceType, sourceId) حداکثر یک آیتم فعال؛ تکرار ۴۰۹. `stage` از بدنه نمی‌آید.',
      requestBody: body({
        sourceType: { type: 'string', enum: ['lesson', 'question', 'article', 'wiki', 'book', 'other'] },
        sourceId: uuid,
        title: nullable(string),
        subject: nullable(string),
        description: nullable(string),
        activityType: string,
      }, ['sourceType', 'sourceId']),
      responses: {
        201: okResponse('آیتم ساخته‌شده', { item: ref('ReviewItem'), idempotent: { type: 'boolean' } }),
        401: unauthorized(),
        409: errorResponse('برای این منبع آیتم فعال دارید', 'REVIEW_ITEM_EXISTS'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/me/review-items/{id}': {
    patch: {
      tags: ['notes'],
      summary: 'ویرایش متادیتای آیتم مرور',
      description: 'فقط عنوان/موضوع/توضیح/نوع فعالیت — stage و status از این مسیر عوض نمی‌شوند.',
      parameters: [pathId()],
      requestBody: body({ title: nullable(string), subject: nullable(string), description: nullable(string), activityType: string }),
      responses: {
        200: okResponse('ویرایش‌شده', { item: ref('ReviewItem') }),
        401: unauthorized(),
        404: notFound(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
    delete: {
      tags: ['notes'],
      summary: 'حذف آیتم مرور',
      parameters: [pathId()],
      responses: {
        204: noContent(),
        401: unauthorized(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/me/review-items/{id}/complete-review': {
    post: {
      tags: ['notes'],
      summary: 'ثبت مرور انجام‌شده — پیشرفت G5',
      description: 'مرحلهٔ بعد سمت سرور از جدول G5 (۱→۲→۴→۸→۱۶ روز) محاسبه می‌شود؛ مرحلهٔ ۵ کامل می‌شود.',
      parameters: [pathId()],
      responses: {
        200: okResponse('آیتم پس از مرور', { item: ref('ReviewItem') }),
        401: unauthorized(),
        404: notFound(),
        409: errorResponse('آیتم کامل شده', 'REVIEW_ITEM_COMPLETED'),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/me/review-items/{id}/restart': {
    post: {
      tags: ['notes'],
      summary: 'شروع دوبارهٔ چرخهٔ مرور',
      description: 'stage به ۱ برمی‌گردد؛ history حفظ می‌شود.',
      parameters: [pathId()],
      responses: {
        200: okResponse('ریستارت شد', { item: ref('ReviewItem') }),
        401: unauthorized(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },

  /* فاز ۱۶ — گروه‌های مطالعه */
  '/api/v1/groups/me': {
    get: {
      tags: ['groups'],
      summary: 'گروه‌های من',
      responses: {
        200: okResponse('گروه‌ها', { groups: { type: 'array', items: { type: 'object', properties: { id: uuid, role: { type: 'string', enum: ['owner', 'member'] }, joinedAt: dateTime, group: ref('StudyGroup') }, required: ['id', 'role', 'group'] } } }),
        401: unauthorized(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/groups': {
    post: {
      tags: ['groups'],
      summary: 'ساخت گروه ۲–۳ نفره',
      description: 'کد فقط در همین پاسخ برمی‌گردد و در دیتابیس فقط SHA-256 آن می‌نشیند. هر کاربر حداکثر یک گروه فعال (UNIQUE(user_id)) — عضوِ فعلی ۴۰۹ ALREADY_IN_GROUP می‌گیرد.',
      requestBody: body({ seats: { type: 'integer', minimum: 2, maximum: 3 } }, ['seats']),
      responses: {
        201: okResponse('گروه ساخته‌شده (شامل کد یک‌بارمصرف)', { code: string, group: ref('StudyGroup') }),
        401: unauthorized(),
        409: errorResponse('کاربر از قبل عضو گروهی است', 'ALREADY_IN_GROUP'),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/groups/join': {
    post: {
      tags: ['groups'],
      summary: 'عضویت با کد',
      description:
        'کد نرمال‌سازی می‌شود (ارقام فارسی/عربی، حروف بزرگ، حذف فاصله/خط‌تیره). فرمت بد ۴۲۲ GROUP_CODE_FORMAT؛ ناموجود ۴۰۴؛ بازنشده/پر/تکراری ۴۰۹. ظرفیت با قفل ردیفی + قید دیتابیس هرگز ترک نمی‌خورد.',
      requestBody: body({ code: string }, ['code']),
      responses: {
        200: okResponse('عضو شد', { group: ref('StudyGroup') }),
        401: unauthorized(),
        404: errorResponse('کد به هیچ گروه فعالیتی تعلق ندارد', 'GROUP_CODE_NOT_FOUND'),
        409: errorResponse('کد بازنشسته / گروه پر / عضو تکراری / عضو گروه دیگر', 'GROUP_CODE_RETIRED'),
        422: errorResponse('فرمت کد نامعتبر', 'GROUP_CODE_FORMAT'),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/groups/{id}': {
    get: {
      tags: ['groups'],
      summary: 'جزئیات گروه — فقط اعضا',
      description: 'غریبه ۴۰۴ (وجود گروه افشا نمی‌شود). پاسخ هیچ کد/هش کد ندارد.',
      parameters: [pathId()],
      responses: {
        200: okResponse('گروه و اعضا', { group: ref('StudyGroup'), members: refList('GroupMember') }),
        401: unauthorized(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/groups/{id}/rotate-code': {
    post: {
      tags: ['groups'],
      summary: 'بازچرخانی کد — فقط میزبان',
      description: 'کد کهنه به retired می‌رود (۴۰۹ GROUP_CODE_RETIRED)؛ کد تازه فقط یک‌بار برمی‌گردد.',
      parameters: [pathId()],
      responses: {
        200: okResponse('کد تازه', { code: string, group: ref('StudyGroup') }),
        401: unauthorized(),
        403: errorResponse('فقط میزبان', 'NOT_OWNER'),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/groups/{id}/leave': {
    post: {
      tags: ['groups'],
      summary: 'خروج از گروه',
      description: 'میزبان فقط وقتی تنهاست می‌تواند خارج شود (۴۰۹ GROUP_OWNER_LEAVE)؛ در آن حالت گروه آرشیو و عضویت‌ها آزاد می‌شوند.',
      parameters: [pathId()],
      responses: {
        204: noContent(),
        401: unauthorized(),
        404: notFound(),
        409: errorResponse('میزبان با عضوِ حاضر نمی‌تواند خارج شود', 'GROUP_OWNER_LEAVE'),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/groups/{id}/members/{memberId}': {
    delete: {
      tags: ['groups'],
      summary: 'اخراج عضو — فقط میزبان',
      description: 'اخراج خودِ میزبان ۴۲۲؛ عضو ناموجود ۴۰۴.',
      parameters: [pathId(), pathId('memberId')],
      responses: {
        204: noContent(),
        401: unauthorized(),
        403: errorResponse('فقط میزبان', 'NOT_OWNER'),
        404: notFound(),
        422: errorResponse('میزبان خودش را اخراج نمی‌کند', 'NOT_ALLOWED'),
        429: rateLimited(),
      },
    },
  },

  /* فاز ۱۶ — بازخورد */
  '/api/v1/feedback': {
    post: {
      tags: ['feedback'],
      summary: 'ارسال بازخورد — با سشن یا مهمان',
      description: 'مهمان باید `guestRef` شفاف بفرستد. بدنه plain text است؛ در لاگ/تحلیل رفتاری نمی‌رود.',
      requestBody: body({
        source: { type: 'string', enum: FEEDBACK_SOURCES },
        subject: nullable(string),
        category: nullable(string),
        message: string,
        guestRef: nullable(string),
        meta: nullable({ type: 'object', additionalProperties: true }),
      }, ['source', 'message']),
      responses: {
        201: okResponse('ثبت شد', { feedback: { type: 'object', properties: { id: uuid, source: string, status: { type: 'string', enum: FEEDBACK_STATUS }, createdAt: dateTime }, required: ['id', 'status'] } }),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/me/feedback': {
    get: {
      tags: ['feedback'],
      summary: 'بازخوردها و پاسخ‌های من',
      responses: {
        200: okResponse('بازخوردها', { feedback: refList('Feedback') }),
        401: unauthorized(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/me/feedback/read': {
    post: {
      tags: ['feedback'],
      summary: 'علامت‌گذاری پاسخ‌ها خوانده‌شده',
      responses: {
        200: okResponse('تعداد به‌روزشده', { updated: integer }),
        401: unauthorized(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/feedback': {
    get: {
      tags: ['feedback'],
      summary: 'فهرست بازخوردها برای پنل',
      description: 'مجوز: `feedback.read`.',
      parameters: [
        { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: FEEDBACK_STATUS } },
        { name: 'source', in: 'query', required: false, schema: { type: 'string', enum: FEEDBACK_SOURCES } },
        { name: 'page', in: 'query', required: false, schema: integer },
        { name: 'perPage', in: 'query', required: false, schema: integer },
      ],
      responses: {
        200: okResponse('فهرست پنل', { feedback: refList('Feedback') }, pageMeta),
        401: unauthorized(),
        403: forbidden(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/feedback/{id}': {
    get: {
      tags: ['feedback'],
      summary: 'جزئیات بازخورد',
      description: 'مجوز: `feedback.read`.',
      parameters: [pathId()],
      responses: {
        200: okResponse('بازخورد', { feedback: ref('Feedback') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
    patch: {
      tags: ['feedback'],
      summary: 'تغییر وضعیت بازخورد',
      description: 'مجوز: `feedback.manage`. وضعیت‌ها: open/answered/closed.',
      parameters: [pathId()],
      requestBody: body({ status: { type: 'string', enum: FEEDBACK_STATUS } }, ['status']),
      responses: {
        200: okResponse('به‌روزشده', { feedback: ref('Feedback') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/feedback/{id}/replies': {
    post: {
      tags: ['feedback'],
      summary: 'پاسخ ادمین — وضعیت به answered می‌رود',
      description: 'مجوز: `feedback.manage`. `admin_id` همیشه از سشن می‌آید؛ جعل بدنه بی‌اثر است.',
      parameters: [pathId()],
      requestBody: body({ body: { type: 'string', maxLength: 5000 } }, ['body']),
      responses: {
        201: okResponse('پاسخ ثبت‌شده', { reply: ref('FeedbackReply') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        422: unprocessable(),
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

const newTags = [
  ['media', 'فایل‌ها — Media Core (فاز ۱۵). آپلود فقط از پنل؛ استریم عمومی/امضادار.'],
  ['reference', 'مراجع آموزشی (فاز ۱۵) — فقط `published` در مسیر عمومی.'],
  ['anatomy', 'اطلس سه‌بعدی (فاز ۱۵) — کاتالوگ منتشرشده؛ نگاشت part_key → Media.'],
  ['articles', 'مقاله‌ها و نشان‌گذاری (فاز ۱۶) — فقط `published` در مسیر عمومی.'],
  ['notes', 'یادداشت شخصی و مرور G5 (فاز ۱۶) — مالکیت فقط از سشن.'],
  ['groups', 'گروه‌های مطالعه (فاز ۱۶) — کد فقط hash؛ ظرفیت ۲–۳ نفر.'],
  ['feedback', 'بازخورد (فاز ۱۶) — ارسال مهمان مجاز؛ هویت از سشن/guestRef.'],
];

const existingTags = new Set((spec.tags ?? []).map((tag) => tag.name));

for (const [name, description] of newTags) {
  if (!existingTags.has(name)) {
    spec.tags.push({ name, description });
  }
}

// ترتیب پایدار: مسیرها الفبایی تا diff تمیز بماند.
spec.paths = Object.fromEntries(Object.entries(spec.paths).sort(([a], [b]) => a.localeCompare(b)));

spec.info.description =
  (spec.info.description ?? '') +
  '\n\n**فاز ۱۵/۱۶ (Media/References/Anatomy + Articles/Notes/Review/Groups/Feedback):** Media Core با آپلود چندلایه و Signed URL کوتاه‌عمر؛ محتوای عمومی فقط `published`؛ یادداشت/مرور/نشان فقط با سشن و مالکیت سمت سرور؛ گروه‌ها با کد hash و ظرفیتِ قفل‌شده؛ بازخورد مهمان با guestRef. هیچ دامنهٔ Commerce/Publishing/Notification/Search در این فازها ساخته نشد (Scope Lock).';
spec.info.version = '1.8.0';

writeFileSync(FILE, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

const counts = Object.keys(spec.paths).length;
const operations = Object.values(spec.paths).reduce((sum, ops) => sum + Object.keys(ops).length, 0);

console.log(`openapi.v1.json → ${counts} paths / ${operations} operations / ${Object.keys(spec.components.schemas).length} schemas`);
