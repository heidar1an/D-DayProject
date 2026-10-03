#!/usr/bin/env node
/*
 * افزودن مسیرها و schemaهای فاز ۲۱ (AI Mentor) به OpenAPI v1.
 *
 * همان الگوی build-openapi-v1-phase19-20.mjs: idempotent، مسیرهای فازهای قبل را
 * دست نمی‌زند و فقط مسیرهایی را می‌نویسد که واقعاً در routes/api.php هستند
 * (`ApiV1ContractTest` دوطرفه بودن را قفل می‌کند).
 *
 * اجرا: node scripts/build-openapi-v1-phase21.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'docs/openapi.v1.json');

const spec = JSON.parse(readFileSync(FILE, 'utf8'));

const requestIdHeader = { 'X-Request-Id': { $ref: '#/components/headers/RequestId' } };

const jsonEnvelope = (dataProperties) => ({
  type: 'object',
  properties: {
    data: { type: 'object', properties: dataProperties },
    requestId: { type: 'string' },
  },
});

const okResponse = (description, dataProperties) => ({
  description,
  headers: requestIdHeader,
  content: { 'application/json': { schema: jsonEnvelope(dataProperties) } },
});

const string = { type: 'string' };
const uuid = { type: 'string', format: 'uuid' };
const integer = { type: 'integer' };
const nullable = (schema) => ({ ...schema, nullable: true });
const dateTime = { type: 'string', format: 'date-time' };

const errorResponse = (description, codes) => ({
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
              code: { type: 'string', enum: codes },
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

const unprocessable = () => errorResponse('خطای اعتبارسنجی', ['VALIDATION_FAILED']);
const unauthorized = () => errorResponse('سشن معتبر نیست', ['UNAUTHENTICATED']);
const forbidden = () => errorResponse('بدون مجوز/entitlement', ['FORBIDDEN']);
const badRequest = () => errorResponse('پارامتر ناشناخته یا نامعتبر', ['UNKNOWN_QUERY_PARAMETER', 'BAD_REQUEST']);
const notFound = () => errorResponse('گفت‌وگو/پیوست یافت نشد یا مالک دیگری است', ['NOT_FOUND']);
const conflict = () => errorResponse('تعارض idempotency', ['IDEMPOTENCY_CONFLICT', 'AI_REQUEST_IN_PROGRESS']);
const tooLarge = () => errorResponse('فایل بزرگ‌تر از سقف نوع خود', ['UPLOAD_TOO_LARGE']);
const unsupported = () => errorResponse('نوع فایل پذیرفته نمی‌شود', ['UPLOAD_TYPE_REJECTED']);
const unavailable = () => errorResponse('provider پیکربندی نشده یا در دسترس نیست', ['FEATURE_NOT_CONFIGURED', 'AI_PROVIDER_UNAVAILABLE']);
const throttled = () => errorResponse('سقف نرخ یا سهمیهٔ روزانه', ['RATE_LIMITED', 'AI_RATE_LIMITED', 'AI_QUOTA_EXCEEDED']);

const body = (properties, required) => ({
  required: true,
  content: {
    'application/json': {
      schema: { type: 'object', properties, ...(required ? { required } : {}) },
    },
  },
});

const schemas = {
  AiMessage: {
    type: 'object',
    description:
      'پیام دستیار. `providerMessageId`، شناسهٔ provider، مصرف توکن و هشدار خطای داخلی هرگز برنمی‌گردند؛ متن در DB رمزنگاری‌شده است.',
    properties: {
      id: uuid,
      role: { type: 'string', enum: ['assistant'] },
      text: string,
      status: { type: 'string', enum: ['done'] },
    },
    required: ['id', 'role', 'text', 'status'],
  },
  AiAttachment: {
    type: 'object',
    description:
      'پیوست AI — رکورد Media با visibility=private و purpose=ai. `previewUrl` فقط URL استریم امضاشدهٔ کوتاه‌عمر است.',
    properties: {
      id: uuid,
      name: nullable(string),
      type: string,
      size: integer,
      previewUrl: string,
    },
    required: ['id', 'type', 'size', 'previewUrl'],
  },
};

const paths = {
  '/api/v1/ai/chat': {
    post: {
      tags: ['ai'],
      summary: 'گفت‌وگوی AI Mentor (غیر-استریم)',
      description:
        'نیازمند سشن کاربر + entitlement `ai.mentor` + سهمیهٔ روزانه + provider پیکربندی‌شده. `userId`/`role`/`entitlement`/`quota`/`context`/`history`/`model` از بدنه پذیرفته **نمی‌شوند** (۴۲۲). context از Read Model سرور ساخته می‌شود (فقط شاخص‌های آموزشی تجمیعی) و هرگز دادهٔ هویتی/پزشکی/محرم به provider نمی‌رود. `Idempotency-Key` (هدر) همان درخواست را تکرارناپذیر می‌کند؛ کلید با بدنهٔ متفاوت ⇒ ۴۰۹. تا وقتی provider واقعی پیکربندی نشده، پاسخ صادقانه ۵۰۳ است (نه mock).',
      parameters: [
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          schema: string,
          description: 'کلید idempotency درخواست (۸ تا ۱۰۰ کاراکتر).',
        },
      ],
      requestBody: body(
        {
          conversationId: nullable(uuid),
          message: { type: 'string', minLength: 1, maxLength: 4000 },
          mode: { type: 'string', enum: ['general', 'study', 'medical', 'quiz'] },
          attachmentIds: { type: 'array', items: uuid, maxItems: 3 },
        },
        ['message'],
      ),
      responses: {
        200: okResponse('پاسخ دستیار', {
          conversationId: uuid,
          message: { $ref: '#/components/schemas/AiMessage' },
        }),
        400: badRequest(),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: conflict(),
        422: unprocessable(),
        429: throttled(),
        503: unavailable(),
      },
    },
  },
  '/api/v1/ai/attachments': {
    post: {
      tags: ['ai'],
      description:
        'آپلود پیوست AI با همان اعتبارسنجی چندلایهٔ Media (پسوند + MIME اعلامی + magic bytes + سقف kind) و **فقط** kindهای image/document. visibility همیشه private است و مالکیت از سشن می‌آید. تا وقتی مسیر انتقال فایل به provider تأیید نشده، آپلود برای نگه‌داری و نمایش است؛ پیوست به provider فرستاده **نمی‌شود**.',
      summary: 'آپلود پیوست گفت‌وگو',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: { file: { type: 'string', format: 'binary' } },
              required: ['file'],
            },
          },
        },
      },
      responses: {
        201: okResponse('پیوست ساخته شد', {
          id: uuid,
          name: nullable(string),
          type: string,
          size: integer,
          previewUrl: string,
        }),
        400: badRequest(),
        401: unauthorized(),
        403: forbidden(),
        413: tooLarge(),
        415: unsupported(),
        422: unprocessable(),
        429: throttled(),
        503: unavailable(),
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
  [
    'ai',
    'AI Mentor (فاز ۲۱) — adapter-controlled؛ entitlement/quota/rate-limit سرور-محور و provider پیکربندی‌نشده ⇒ ۵۰۳.',
  ],
];

const existingTags = new Set((spec.tags ?? []).map((tag) => tag.name));

for (const [name, description] of newTags) {
  if (!existingTags.has(name)) {
    spec.tags.push({ name, description });
  }
}

// ترتیب پایدار: مسیرها الفبایی تا diff تمیز بماند.
spec.paths = Object.fromEntries(Object.entries(spec.paths).sort(([a], [b]) => a.localeCompare(b)));

/* idempotent: هر اجرا نباید پاراگراف را دوباره بچسباند. */
const PHASE_21_MARKER = '**فاز ۲۱ (AI Mentor):**';
const PHASE_21_PARAGRAPH =
  PHASE_21_MARKER +
  ' AI فقط **مصرف‌کنندهٔ** دادهٔ معتبر Backend است و هیچ‌وقت مالک حقیقت یادگیری نمی‌شود. جریان: `Controller → FormRequest → AiService → (Entitlement → Quota → Rate limit) → Provider Adapter → Provider`. Provider واقعی در پروژه پیکربندی نشده، پس بایند پیش‌فرض `UnconfiguredAiProvider` است و پاسخ **۵۰۳ صادقانه** می‌دهد — نه mock، نه موفقیت جعلی. پیام‌ها در `ai_messages` با cast `encrypted` ذخیره می‌شوند و `providerMessageId`/مصرف توکن/هشدار خطای provider هرگز در پاسخ یا لاگ عمومی نمی‌آید. context فقط از Read Model تجمیعی آموزشی ساخته می‌شود؛ SSE عمداً ساخته نشد چون مصرف‌کنندهٔ واقعی streaming هنوز به این قرارداد وصل نشده است.';

const baseDescription = (spec.info.description ?? '')
  .split('\n\n')
  .filter((block) => !block.includes(PHASE_21_MARKER))
  .join('\n\n')
  .trimEnd();

spec.info.description = `${baseDescription}\n\n${PHASE_21_PARAGRAPH}`;

spec.info.version = '1.10.0';

writeFileSync(FILE, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

const counts = Object.keys(spec.paths).length;
const operations = Object.values(spec.paths).reduce((sum, ops) => sum + Object.keys(ops).length, 0);

console.log(
  `openapi.v1.json → ${counts} paths / ${operations} operations / ${Object.keys(spec.components.schemas).length} schemas`,
);
