#!/usr/bin/env node
/*
 * افزودن مسیرها و schemaهای فاز ۱۹/۲۰ به OpenAPI v1.
 *
 * همان الگوی build-openapi-v1-phase15-16.mjs: idempotent، مسیرهای فازهای قبل را
 * دست نمی‌زند و فقط مسیرهایی را می‌نویسد که واقعاً در routes/api.php هستند
 * (`ApiV1ContractTest` دوطرفه بودن را قفل می‌کند).
 *
 * اجرا: node scripts/build-openapi-v1-phase19-20.mjs
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

const accepted = (description, dataProperties) => ({
  description,
  headers: requestIdHeader,
  content: { 'application/json': { schema: jsonEnvelope(dataProperties) } },
});

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const refList = (name) => ({ type: 'array', items: ref(name) });
const string = { type: 'string' };
const uuid = { type: 'string', format: 'uuid' };
const integer = { type: 'integer' };
const boolean = { type: 'boolean' };
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
const badRequest = () => errorResponse('پارامتر ناشناخته یا نامعتبر', 'BAD_REQUEST');
const conflict = () => errorResponse('تعارض نسخه/وضعیت', 'CONFLICT');

const body = (properties, required) => ({
  required: true,
  content: {
    'application/json': {
      schema: { type: 'object', properties, ...(required ? { required } : {}) },
    },
  },
});

const pathId = (name = 'id') => ({ name, in: 'path', required: true, schema: uuid });
const query = (name, description, schema = string) => ({ name, in: 'query', description, schema });

/* ── Schemaها ───────────────────────────────────────────────────────── */

const NOTIFICATION_TYPES = ['achievement_unlocked', 'exam_result', 'feedback_reply', 'system'];
const SEARCH_TYPES = ['course', 'lesson', 'wiki_article', 'article', 'reference', 'knowledge_node'];
const SEARCH_SORTS = ['relevance', 'latest'];
const DELIVERY_STATUS = ['pending', 'sent', 'delivered', 'failed', 'skipped'];
const CONTENT_STATUS_BREAKDOWN = { draft: integer, published: integer, archived: integer, total: integer };

const schemas = {
  Notification: {
    type: 'object',
    description:
      'اعلان کاربر. `userId` عمداً بازنمی‌گردد (خودِ کاربر است)؛ متن‌ها plain text و sanitize شده‌اند.',
    properties: {
      id: uuid,
      type: { type: 'string', enum: NOTIFICATION_TYPES },
      title: string,
      body: string,
      action: nullable(string),
      entityId: nullable(string),
      meta: nullable({ type: 'object', additionalProperties: true }),
      read: boolean,
      readAt: nullable(dateTime),
      createdAt: dateTime,
    },
    required: ['id', 'type', 'title', 'body', 'read'],
  },
  SearchResult: {
    type: 'object',
    description:
      'نتیجهٔ جست‌وجو — شکل «نتیجه»، نه موجودیت دامنه. متن `snippet` بریده است و کل بدنه را افشا نمی‌کند.',
    properties: {
      entityType: { type: 'string', enum: SEARCH_TYPES },
      entityId: string,
      label: string,
      title: string,
      snippet: string,
    },
    required: ['entityType', 'entityId', 'label', 'title', 'snippet'],
  },
  AdminUser: {
    type: 'object',
    description:
      'کاربر در پنل. `password_hash`/`google_subject`/توکن سشن هرگز بازنمی‌گردد؛ اتصال گوگل فقط boolean.',
    properties: {
      id: uuid,
      phone: nullable(string),
      email: nullable(string),
      emailVerified: boolean,
      emailVerifiedAt: nullable(dateTime),
      googleLinked: boolean,
      createdAt: nullable(dateTime),
      updatedAt: nullable(dateTime),
    },
    required: ['id', 'emailVerified', 'googleLinked'],
  },
  AuditLog: {
    type: 'object',
    description:
      'رکورد Audit — فقط خواندنی و append-only. `changes` قبلاً redact شده (رمز/توکن/کد در آن نیست).',
    properties: {
      id: uuid,
      actorType: { type: 'string', enum: ['admin', 'user', 'system'] },
      actorId: nullable(string),
      action: string,
      targetType: nullable(string),
      targetId: nullable(string),
      requestId: nullable(string),
      changes: nullable({ type: 'object', additionalProperties: true }),
      createdAt: dateTime,
    },
    required: ['id', 'actorType', 'action'],
  },
  SystemSetting: {
    type: 'object',
    description:
      'تنظیم سیستم از allowlist. کلید محرمانه مقدارش **هرگز** برنمی‌گردد (`value` = null)؛ فقط نوشتنی است.',
    properties: {
      key: string,
      type: { type: 'string', enum: ['string', 'integer', 'boolean'] },
      description: string,
      secret: boolean,
      version: nullable(integer),
      value: nullable({ type: 'object', additionalProperties: true }),
      updatedAt: nullable(dateTime),
    },
    required: ['key', 'type', 'secret'],
  },
  AdminDashboard: {
    type: 'object',
    description: 'شمارنده‌های واقعی پنل — هیچ عدد Mock در این پاسخ نیست.',
    properties: {
      users: {
        type: 'object',
        properties: { total: integer, adminsTotal: integer, adminsActive: integer },
      },
      content: {
        type: 'object',
        properties: {
          subjects: integer,
          courses: integer,
          lessons: integer,
          articles: { type: 'object', properties: CONTENT_STATUS_BREAKDOWN },
          wikiArticles: { type: 'object', properties: CONTENT_STATUS_BREAKDOWN },
          references: { type: 'object', properties: CONTENT_STATUS_BREAKDOWN },
          questions: { type: 'object', properties: CONTENT_STATUS_BREAKDOWN },
        },
      },
      learning: {
        type: 'object',
        properties: {
          completedLessons: integer,
          studySessions: integer,
          examAttempts: integer,
          examResults: integer,
          flashcardReviews: integer,
        },
      },
      engagement: {
        type: 'object',
        properties: {
          feedbackOpen: integer,
          notifications: integer,
          notificationsUnread: integer,
          notificationDeliveriesFailed: integer,
          groupMemberships: integer,
        },
      },
      operations: {
        type: 'object',
        properties: {
          outboxPending: integer,
          outboxFailed: integer,
          failedJobs: integer,
          searchDocuments: integer,
          auditLogs: integer,
        },
      },
      generatedAt: dateTime,
    },
  },
  FailedJob: {
    type: 'object',
    description: 'Dead letter — فقط metadata امن؛ payload خام Job هرگز بازنمی‌گردد.',
    properties: {
      id: uuid,
      connection: string,
      queue: string,
      job: string,
      attempts: nullable(integer),
      failedAt: string,
    },
  },
  SearchIndexStatus: {
    type: 'object',
    description: 'وضعیت ایندکس هر دامنه: تعداد سند ایندکس‌شده در برابر تعداد موجودیت منتشرشده.',
    additionalProperties: {
      type: 'object',
      properties: { indexed: integer, published: integer },
    },
  },
  NotificationDelivery: {
    type: 'object',
    description: 'ردیف تحویل اعلان — یک ردیف به‌ازای هر (اعلان، کانال).',
    properties: {
      id: uuid,
      notificationId: uuid,
      userId: nullable(uuid),
      type: nullable(string),
      channel: string,
      status: { type: 'string', enum: DELIVERY_STATUS },
      attempts: integer,
      lastErrorCode: nullable(string),
      createdAt: nullable(dateTime),
    },
  },
};

/* ── مسیرها ─────────────────────────────────────────────────────────── */

const adminErrors = {
  401: unauthorized(),
  403: forbidden(),
  429: rateLimited(),
};

const paths = {
  /* ── فاز ۱۹ — جست‌وجوی سراسری (عمومی) ───────────────────────────── */
  '/api/v1/search': {
    get: {
      tags: ['search'],
      summary: 'جست‌وجوی سراسری',
      description:
        'ایندکس یک **پروجکشن قابل بازسازی** است و منبع حقیقت نیست؛ هر نتیجه یک بار دیگر با سیاست دسترسی دامنه چک می‌شود، پس پیش‌نویس/آرشیو حتی با ایندکس کهنه بیرون نمی‌زند. توکن‌ها سانیتایز و عبارت FTS پارامتری است (تزریق ممکن نیست). تعداد نامزدها سقف دارد (`candidateCapped`).',
      parameters: [
        query('q', 'عبارت جست‌وجو (نرمال‌سازی ی/ي، ک/ك و نیم‌فاصله)', { type: 'string', minLength: 2, maxLength: 80 }),
        query('type', 'محدودکردن به یک دامنه', { type: 'string', enum: SEARCH_TYPES }),
        query('sort', 'ترتیب نتایج', { type: 'string', enum: SEARCH_SORTS }),
        query('page', 'شمارهٔ صفحه', { type: 'integer', minimum: 1 }),
        query('perPage', 'تعداد در هر صفحه', { type: 'integer', minimum: 1, maximum: 50 }),
      ],
      responses: {
        200: okResponse('نتایج جست‌وجو', { results: refList('SearchResult') }, {
          ...pageMeta,
          candidateCapped: boolean,
        }),
        400: badRequest(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  /* ── فاز ۱۹ — اعلان‌های کاربر (مالکیت فقط از سشن) ────────────────── */
  '/api/v1/me/notifications': {
    get: {
      tags: ['notifications'],
      summary: 'فهرست اعلان‌های کاربر جاری',
      description: 'مالکیت فقط از سشن می‌آید؛ هیچ `userId` از query خوانده نمی‌شود.',
      parameters: [
        query('type', 'فیلتر نوع', { type: 'string', enum: NOTIFICATION_TYPES }),
        query('page', 'شمارهٔ صفحه', { type: 'integer', minimum: 1 }),
        query('perPage', 'تعداد در هر صفحه', { type: 'integer', minimum: 1, maximum: 50 }),
      ],
      responses: {
        200: okResponse(
          'اعلان‌ها',
          { notifications: refList('Notification'), unreadCount: integer },
          pageMeta,
        ),
        400: badRequest(),
        401: unauthorized(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/me/notifications/{id}/read': {
    patch: {
      tags: ['notifications'],
      summary: 'علامت‌زدن یک اعلان به‌عنوان خوانده‌شده',
      description:
        'مالکیت فقط از سشن است و هر `userId` در بدنه نادیده گرفته می‌شود. اعلان کاربر دیگر ⇒ ۴۰۴ (نه ۴۰۳) تا وجود شناسه افشا نشود.',
      parameters: [pathId()],
      responses: {
        200: okResponse('اعلان خوانده‌شده', { notification: ref('Notification') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/me/notifications/read-all': {
    patch: {
      tags: ['notifications'],
      summary: 'علامت‌زدن همهٔ اعلان‌های کاربر جاری',
      responses: {
        200: okResponse('تعداد ردیف‌های علامت‌خورده', { marked: integer }),
        401: unauthorized(),
        403: forbidden(),
        429: rateLimited(),
      },
    },
  },

  /* ── فاز ۲۰ — داشبورد ────────────────────────────────────────────── */
  '/api/v1/admin/dashboard': {
    get: {
      tags: ['admin'],
      summary: 'داشبورد پنل',
      description: 'نیازمند مجوز `dashboard.read`. همهٔ اعداد از منبع واقعی‌اند.',
      responses: {
        200: okResponse('شمارنده‌ها', { dashboard: ref('AdminDashboard') }),
        ...adminErrors,
      },
    },
  },

  /* ── فاز ۲۰ — کاربران ────────────────────────────────────────────── */
  '/api/v1/admin/users': {
    get: {
      tags: ['admin'],
      summary: 'فهرست کاربران',
      description:
        'نیازمند مجوز `users.read`. فیلترها و `sort` هر دو allowlist‌اند؛ هیچ نام ستونی از کلاینت نمی‌آید.',
      parameters: [
        query('q', 'جست‌وجوی آزاد در تلفن/ایمیل'),
        query('phone', 'فیلتر پیشوندی تلفن'),
        query('email', 'فیلتر ایمیل'),
        query('verified', 'فقط تأییدشده/تأییدنشده', { type: 'boolean' }),
        query('createdFrom', 'از تاریخ', { type: 'string', format: 'date' }),
        query('createdTo', 'تا تاریخ', { type: 'string', format: 'date' }),
        query('sort', 'ترتیب', { type: 'string', enum: ['createdAt', 'createdAtAsc'] }),
        query('page', 'شمارهٔ صفحه', { type: 'integer', minimum: 1 }),
        query('perPage', 'تعداد در هر صفحه', { type: 'integer', minimum: 1, maximum: 100 }),
      ],
      responses: {
        200: okResponse('کاربران', { users: refList('AdminUser') }, pageMeta),
        400: badRequest(),
        422: unprocessable(),
        ...adminErrors,
      },
    },
  },
  '/api/v1/admin/users/{id}': {
    get: {
      tags: ['admin'],
      summary: 'جزئیات یک کاربر',
      description: 'نیازمند مجوز `users.read`. شناسهٔ ناشناخته ⇒ ۴۰۴.',
      parameters: [pathId()],
      responses: {
        200: okResponse('کاربر', { user: ref('AdminUser') }),
        404: notFound(),
        ...adminErrors,
      },
    },
  },

  /* ── فاز ۲۰ — Audit (فقط خواندنی، append-only) ───────────────────── */
  '/api/v1/admin/audit-logs': {
    get: {
      tags: ['admin'],
      summary: 'فهرست رکوردهای Audit',
      description: 'نیازمند مجوز `logs.read`. این رکوردها append-only‌اند و هیچ مسیر ویرایش/حذفی ندارند.',
      parameters: [
        query('action', 'فیلتر نام action'),
        query('actorType', 'نوع کنشگر', { type: 'string', enum: ['admin', 'user', 'system'] }),
        query('actorId', 'شناسهٔ کنشگر'),
        query('targetType', 'نوع هدف'),
        query('targetId', 'شناسهٔ هدف'),
        query('from', 'از تاریخ', { type: 'string', format: 'date-time' }),
        query('to', 'تا تاریخ', { type: 'string', format: 'date-time' }),
        query('page', 'شمارهٔ صفحه', { type: 'integer', minimum: 1 }),
        query('perPage', 'تعداد در هر صفحه', { type: 'integer', minimum: 1, maximum: 100 }),
      ],
      responses: {
        200: okResponse('رکوردها', { logs: refList('AuditLog') }, pageMeta),
        400: badRequest(),
        422: unprocessable(),
        ...adminErrors,
      },
    },
  },
  '/api/v1/admin/audit-logs/{id}': {
    get: {
      tags: ['admin'],
      summary: 'جزئیات یک رکورد Audit',
      parameters: [pathId()],
      responses: {
        200: okResponse('رکورد', { log: ref('AuditLog') }),
        404: notFound(),
        ...adminErrors,
      },
    },
  },

  /* ── فاز ۲۰ — تنظیمات ────────────────────────────────────────────── */
  '/api/v1/admin/settings': {
    get: {
      tags: ['admin'],
      summary: 'فهرست تنظیمات',
      description:
        'نیازمند مجوز `settings.read`. کلیدهای محرمانه فقط نشانهٔ «تنظیم‌شده/نشده» می‌دهند، نه مقدار.',
      responses: {
        200: okResponse('تنظیمات', { settings: refList('SystemSetting') }),
        ...adminErrors,
      },
    },
    patch: {
      tags: ['admin'],
      summary: 'به‌روزرسانی یک تنظیم',
      description:
        'کلید ناشناخته ⇒ ۴۲۲ (تنظیم پویا وجود ندارد). `version` برای optimistic lock است؛ نسخهٔ کهنه ⇒ ۴۰۹. کلید محرمانه علاوه بر `settings.update` مجوز `settings.security.manage` می‌خواهد و مقدارش رمزنگاری‌شده ذخیره می‌شود.',
      requestBody: body(
        {
          key: string,
          value: nullable({ type: 'object', additionalProperties: true }),
          version: integer,
        },
        ['key', 'value'],
      ),
      responses: {
        200: okResponse('تنظیم به‌روزشده', { setting: ref('SystemSetting') }),
        401: unauthorized(),
        403: forbidden(),
        409: conflict(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  /* ── فاز ۲۰ — عملیات (صف/ایندکس/تحویل) ──────────────────────────── */
  '/api/v1/admin/queue/failed': {
    get: {
      tags: ['admin'],
      summary: 'فهرست Jobهای شکست‌خورده (Dead letter)',
      description: 'نیازمند مجوز `ops.read`. فقط metadata امن؛ payload خام Job بازنمی‌گردد.',
      parameters: [
        query('queue', 'نام صف'),
        query('connection', 'نام اتصال'),
        query('from', 'از تاریخ', { type: 'string', format: 'date-time' }),
        query('page', 'شمارهٔ صفحه', { type: 'integer', minimum: 1 }),
        query('perPage', 'تعداد در هر صفحه', { type: 'integer', minimum: 1, maximum: 200 }),
      ],
      responses: {
        200: okResponse('Jobهای شکست‌خورده', { jobs: refList('FailedJob') }, pageMeta),
        400: badRequest(),
        422: unprocessable(),
        ...adminErrors,
      },
    },
  },
  '/api/v1/admin/queue/failed/{id}/retry': {
    post: {
      tags: ['admin'],
      summary: 'تلاش دوباره برای یک Job شکست‌خورده',
      description: 'نیازمند مجوز `ops.manage`. شناسهٔ ناشناخته ⇒ ۴۰۴.',
      parameters: [pathId()],
      responses: {
        200: okResponse('صف‌شده برای تلاش دوباره', { retried: boolean }),
        404: notFound(),
        ...adminErrors,
      },
    },
  },
  '/api/v1/admin/search/status': {
    get: {
      tags: ['admin'],
      summary: 'وضعیت ایندکس جست‌وجو',
      description: 'نیازمند مجوز `ops.read`. تعداد سند ایندکس‌شده در برابر موجودیت منتشرشده.',
      responses: {
        200: okResponse('وضعیت ایندکس', { index: ref('SearchIndexStatus') }),
        ...adminErrors,
      },
    },
  },
  '/api/v1/admin/search/rebuild': {
    post: {
      tags: ['admin'],
      summary: 'بازسازی ایندکس جست‌وجو (صف‌شده)',
      description:
        'نیازمند مجوز `ops.manage`. کار در صف انجام می‌شود، نه در چرخهٔ درخواست؛ پاسخ ۲۰۲ با `queued: true`.',
      requestBody: body({ entityType: nullable({ type: 'string', enum: SEARCH_TYPES }) }),
      responses: {
        202: accepted('در صف قرار گرفت', { queued: boolean }),
        401: unauthorized(),
        403: forbidden(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/notifications/deliveries': {
    get: {
      tags: ['admin'],
      summary: 'فهرست ردیف‌های تحویل اعلان',
      description: 'نیازمند مجوز `ops.read`.',
      parameters: [
        query('channel', 'کانال'),
        query('status', 'وضعیت', { type: 'string', enum: DELIVERY_STATUS }),
        query('type', 'نوع اعلان', { type: 'string', enum: NOTIFICATION_TYPES }),
        query('notificationId', 'شناسهٔ اعلان', { type: 'string', format: 'uuid' }),
        query('page', 'شمارهٔ صفحه', { type: 'integer', minimum: 1 }),
        query('perPage', 'تعداد در هر صفحه', { type: 'integer', minimum: 1, maximum: 100 }),
      ],
      responses: {
        200: okResponse('تحویل‌ها', { deliveries: refList('NotificationDelivery') }, pageMeta),
        400: badRequest(),
        422: unprocessable(),
        ...adminErrors,
      },
    },
  },
  '/api/v1/admin/notifications/deliveries/{id}/retry': {
    post: {
      tags: ['admin'],
      summary: 'تلاش دوباره برای تحویل یک اعلان',
      description: 'نیازمند مجوز `ops.manage`. شناسهٔ ناشناخته ⇒ ۴۰۴.',
      parameters: [pathId()],
      responses: {
        200: okResponse('تحویل', {
          delivery: { type: 'object', properties: { id: uuid, status: string } },
        }),
        404: notFound(),
        ...adminErrors,
      },
    },
  },

  /* ── فاز ۲۰ — ارسال اعلان از پنل ────────────────────────────────── */
  '/api/v1/admin/notifications': {
    post: {
      tags: ['admin'],
      summary: 'ارسال اعلان به یک کاربر',
      description:
        'نیازمند مجوز `notifications.send`. پنل **فقط** نوع `system` می‌سازد؛ نوع‌های دامنه‌ای (نتیجهٔ آزمون/دستاورد) فقط از رخداد واقعی می‌آیند و از پنل قابل جعل نیستند. `dedupKey` بر پایهٔ محتوا ساخته می‌شود، پس ارسال دوباره رکورد تازه نمی‌سازد (`created: false`).',
      requestBody: body(
        {
          userId: uuid,
          type: { type: 'string', enum: ['system'] },
          title: string,
          body: nullable(string),
          action: nullable(string),
        },
        ['userId', 'type', 'title'],
      ),
      responses: {
        200: okResponse('همان اعلان قبلاً ساخته شده', { created: boolean }),
        201: accepted('اعلان ساخته شد', {
          created: boolean,
          notification: {
            type: 'object',
            properties: { id: uuid, type: string, createdAt: dateTime },
          },
        }),
        401: unauthorized(),
        403: forbidden(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },
  '/api/v1/admin/notifications/broadcast': {
    post: {
      tags: ['admin'],
      summary: 'ارسال گروهی اعلان (صف‌شده، chunked)',
      description:
        'نیازمند مجوز `notifications.send`. `broadcastKey` کلید idempotency است. سقف گیرندگان **قبل از** صف‌بندی چک می‌شود؛ سقف‌شکنی ⇒ ۴۲۲. اگر ارسال گروهی از تنظیمات خاموش باشد ⇒ ۴۰۹ با `reason: broadcast_disabled`.',
      requestBody: body(
        { broadcastKey: string, title: string, body: nullable(string) },
        ['broadcastKey', 'title'],
      ),
      responses: {
        200: okResponse('در صف قرار گرفت', { queued: boolean, recipients: integer }),
        401: unauthorized(),
        403: forbidden(),
        409: conflict(),
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
  ['search', 'جست‌وجوی سراسری (فاز ۱۹) — ایندکس پروجکشن است و DB منبع حقیقت.'],
  ['notifications', 'اعلان‌های کاربر (فاز ۱۹) — مالکیت فقط از سشن؛ تحویل یک پروجکشن است.'],
  ['admin', 'پنل مدیریت (فاز ۲۰) — RBAC deny-by-default، Audit اجباری، تنظیمات با optimistic lock.'],
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
  '\n\n**فاز ۱۹/۲۰ (Queue + Notifications + Search / پنل مدیریت):** صف با صف‌های نام‌دار و dead-letter دیدنی؛ Outbox با `event_key` یکتا و handler registry؛ اعلان با `UNIQUE(user_id, dedup_key)` و allowlist نوع/payload؛ جست‌وجوی `tsvector` با سقف نامزد و فیلتر دسترسی دوم. پنل: داشبورد واقعی، کاربران بدون ستون حساس، Audit append-only با redact، تنظیمات allowlist با رمزنگاری مقدار محرمانه و optimistic lock.';
spec.info.version = '1.9.0';

writeFileSync(FILE, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

const counts = Object.keys(spec.paths).length;
const operations = Object.values(spec.paths).reduce((sum, ops) => sum + Object.keys(ops).length, 0);

console.log(`openapi.v1.json → ${counts} paths / ${operations} operations / ${Object.keys(spec.components.schemas).length} schemas`);
