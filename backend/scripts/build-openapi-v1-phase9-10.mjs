#!/usr/bin/env node
/*
 * افزودن مسیرها و schemaهای فاز ۹ (فلش‌کارت) و فاز ۱۰ (ویکی) به OpenAPI v1.
 *
 * چرا اسکریپت و نه ویرایش دستی: فایل ۱۷۸KB است و ویرایش دستی JSON یعنی
 * احتمال شکستن کاما/آکولاد. این اسکریپت idempotent است — هر بار اجرا شود همان
 * نتیجه را می‌دهد و مسیرهای فازهای قبل را دست نمی‌زند.
 *
 * قرارداد: فقط مسیرهایی نوشته می‌شوند که **واقعاً در routes/api.php هستند**.
 * `ApiV1ContractTest` دوطرفه بودن این سند با پیاده‌سازی را قفل می‌کند.
 *
 * اجرا: node scripts/build-openapi-v1-phase9-10.mjs
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
const nullable = (schema) => ({ ...schema, nullable: true });
const string = { type: 'string' };
const uuid = { type: 'string', format: 'uuid' };
const dateTime = { type: 'string', format: 'date-time' };
const integer = { type: 'integer' };
const number = { type: 'number' };
const boolean = { type: 'boolean' };

const paginationMeta = {
  page: integer,
  perPage: integer,
  total: integer,
  lastPage: integer,
};

const errors = (...codes) =>
  Object.fromEntries(codes.map((code) => [code, { $ref: `#/components/responses/${ERROR_RESPONSE[code]}` }]));

const ERROR_RESPONSE = {
  400: 'ValidationFailed',
  401: 'Unauthenticated',
  403: 'Forbidden',
  404: 'ValidationFailed',
  409: 'ValidationFailed',
  422: 'ValidationFailed',
  429: 'RateLimited',
};

const noContent = (description) => ({ description, headers: requestIdHeader });

/* ── schemaها ───────────────────────────────────────────────────────── */

const schemas = {
  FlashcardDeck: {
    type: 'object',
    description:
      'دک فلش‌کارت. `owner_user_id` عمداً serialize نمی‌شود؛ کلاینت فقط `is_official` و `is_owned` را می‌بیند.',
    properties: {
      id: uuid,
      title: string,
      description: nullable(string),
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      visibility: { type: 'string', enum: ['private', 'public'] },
      is_official: boolean,
      is_owned: boolean,
      cards_count: nullable(integer),
      version: integer,
      published_at: nullable(dateTime),
      created_at: dateTime,
      updated_at: dateTime,
    },
  },
  Flashcard: {
    type: 'object',
    description: 'تعریف کارت — مستقل از وضعیت یادگیری کاربر. `front`/`back` پاک‌سازی‌شده‌اند.',
    properties: {
      id: uuid,
      deck_id: uuid,
      front: string,
      back: string,
      position: integer,
      status: { type: 'string', enum: ['active', 'suspended', 'archived'] },
      created_at: dateTime,
      updated_at: dateTime,
    },
  },
  FlashcardState: {
    type: 'object',
    description:
      'وضعیت فعلی کاربر نسبت به کارت. **همهٔ اعداد سرور-ساخته‌اند**؛ کلاینت هیچ‌کدام را تعیین نمی‌کند.',
    properties: {
      card_id: uuid,
      state: { type: 'string', enum: ['new', 'learning', 'review', 'relearning', 'mastered', 'suspended', 'archived'] },
      algorithm_version: string,
      due_at: nullable(dateTime),
      interval_days: number,
      interval_minutes: integer,
      ease: number,
      review_count: integer,
      lapse_count: integer,
      correct_count: integer,
      incorrect_count: integer,
      difficulty: number,
      stability: number,
      mastery_score: integer,
      suspended: boolean,
      buried_until: nullable(dateTime),
      bookmarked: boolean,
      last_reviewed_at: nullable(dateTime),
      version: integer,
    },
  },
  FlashcardReview: {
    type: 'object',
    description: 'رکورد **immutable** تاریخچهٔ مرور. هیچ مسیری این را تغییر نمی‌دهد.',
    properties: {
      id: uuid,
      state_id: uuid,
      rating: { type: 'string', enum: ['again', 'hard', 'good', 'easy'] },
      previous_state: nullable(string),
      new_state: string,
      previous_due_at: nullable(dateTime),
      next_due_at: dateTime,
      previous_interval_minutes: nullable(integer),
      next_interval_minutes: integer,
      previous_ease: nullable(number),
      next_ease: number,
      algorithm_version: string,
      reviewed_at: dateTime,
    },
  },
  FlashcardPreview: {
    type: 'object',
    description: 'فاصلهٔ چهار rating که **سرور** محاسبه کرده — UI الگوریتم را تکرار نمی‌کند.',
    additionalProperties: {
      type: 'object',
      properties: { interval_minutes: integer, due_at: dateTime },
    },
  },
  FlashcardQueueItem: {
    type: 'object',
    properties: {
      card: ref('Flashcard'),
      deck: nullable({
        type: 'object',
        properties: { id: uuid, title: string, is_official: boolean },
      }),
      state: nullable(ref('FlashcardState')),
      preview: ref('FlashcardPreview'),
    },
  },
  FlashcardReviewResult: {
    type: 'object',
    properties: {
      card_id: uuid,
      deck_id: uuid,
      state: ref('FlashcardState'),
      review: ref('FlashcardReview'),
      preview: ref('FlashcardPreview'),
    },
  },
  FlashcardProgress: {
    type: 'object',
    description: 'مشتق از `flashcard_states` و `flashcard_reviews` — هیچ ستون شمارشی ذخیره نمی‌شود.',
    properties: {
      total: integer,
      new: integer,
      learning: integer,
      due: integer,
      reviewed_today: integer,
      mastered: integer,
      suspended: integer,
    },
  },
  WikiCategory: {
    type: 'object',
    description: 'دستهٔ ویکی — درخت واقعی با `children`. چرخه در سرور و دیتابیس منع شده است.',
    properties: {
      id: uuid,
      slug: string,
      name: string,
      description: nullable(string),
      parent_id: nullable(uuid),
      sort_order: integer,
      status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      articles_count: integer,
      children: { type: 'array', items: { type: 'object' } },
    },
  },
  WikiArticleSummary: {
    type: 'object',
    description: 'خلاصهٔ مقاله. **هیچ متادیتای نویسنده‌ای** در این schema نیست.',
    properties: {
      id: uuid,
      slug: string,
      title: string,
      summary: nullable(string),
      subject: nullable(string),
      content_type: nullable(string),
      difficulty: nullable(string),
      read_minutes: nullable(integer),
      popularity: integer,
      category: nullable({ type: 'object', properties: { id: uuid, slug: string, name: string } }),
      published_at: dateTime,
      updated_at: dateTime,
    },
  },
  WikiArticle: {
    type: 'object',
    description:
      'مقالهٔ **منتشرشده**. `author_admin_id`/`editor_admin_id`/`status`/`version` عمداً غایب‌اند (خطر نشت متادیتا).',
    properties: {
      id: uuid,
      slug: string,
      title: string,
      summary: nullable(string),
      body: string,
      subject: nullable(string),
      content_type: nullable(string),
      difficulty: nullable(string),
      key_facts: nullable({ type: 'array', items: string }),
      keywords: nullable({ type: 'array', items: string }),
      read_minutes: nullable(integer),
      popularity: integer,
      category: nullable({ type: 'object', properties: { id: uuid, slug: string, name: string } }),
      published_at: dateTime,
      updated_at: dateTime,
    },
  },
  WikiRelation: {
    type: 'object',
    description: 'یک لبهٔ گراف از دید یک مقاله. گراف واقعی فاز ۱۱ است، نه این.',
    properties: {
      article_id: uuid,
      slug: string,
      title: string,
      summary: nullable(string),
      subject: nullable(string),
      content_type: nullable(string),
      difficulty: nullable(string),
      kind: string,
      kind_label: string,
      direction: { type: 'string', enum: ['outgoing', 'incoming'] },
    },
  },
  WikiBookmark: {
    type: 'object',
    description: 'نشان‌گذاری کاربر. `user_id` عمداً serialize نمی‌شود.',
    properties: {
      id: uuid,
      article_id: uuid,
      created_at: dateTime,
      article: nullable(ref('WikiArticleSummary')),
    },
  },
};

/* ── مسیرها ─────────────────────────────────────────────────────────── */

const flashcardTags = ['flashcards'];
const wikiTags = ['wiki'];
const adminTags = ['admin'];

const paths = {
  /* فاز ۹ — فلش‌کارت (کاربر) */
  '/api/v1/flashcards/decks': {
    get: {
      tags: flashcardTags,
      summary: 'فهرست دک‌های قابل‌دسترس کاربر',
      description:
        'دک‌های شخصیِ کاربر + دک‌های رسمی منتشرشده. `owner` فیلتر است، نه مجوز — همهٔ کوئری‌ها از مرز دسترسی عبور می‌کنند.',
      parameters: [
        { name: 'owner', in: 'query', schema: { type: 'string', enum: ['me', 'official'] } },
        { name: 'q', in: 'query', schema: string },
        { name: 'page', in: 'query', schema: integer },
        { name: 'perPage', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse('فهرست دک‌ها', { decks: refList('FlashcardDeck') }, paginationMeta),
        ...errors(400, 401, 422, 429),
      },
    },
    post: {
      tags: flashcardTags,
      summary: 'ساخت دک شخصی',
      description: '`owner_user_id` از سشن پر می‌شود. دک تازه همیشه `draft` + `private` است.',
      responses: {
        201: okResponse('دک ساخته شد', { deck: ref('FlashcardDeck') }),
        ...errors(401, 403, 422, 429),
      },
    },
  },
  '/api/v1/flashcards/decks/{id}': {
    get: {
      tags: flashcardTags,
      summary: 'یک دک',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('دک', { deck: ref('FlashcardDeck') }),
        ...errors(401, 404, 429),
      },
    },
    patch: {
      tags: flashcardTags,
      summary: 'ویرایش دک شخصی',
      description: '`version` اختیاری است؛ اگر کهنه باشد ⇒ ۴۰۹. دک رسمی از این مسیر تغییر نمی‌کند.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('دک ویرایش‌شده', { deck: ref('FlashcardDeck') }),
        ...errors(401, 403, 404, 409, 422, 429),
      },
    },
    delete: {
      tags: flashcardTags,
      summary: 'حذف دک خالی',
      description: 'دک دارای کارت ۴۰۹ می‌گیرد؛ مسیر درست آرشیو است. دک رسمی هرگز از اینجا حذف نمی‌شود.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        204: noContent('حذف شد'),
        ...errors(401, 403, 404, 409, 429),
      },
    },
  },
  '/api/v1/flashcards/decks/{id}/clone': {
    post: {
      tags: flashcardTags,
      summary: 'کلون دک رسمی به دک شخصی',
      description: 'تاریخچهٔ مرور منتقل نمی‌شود؛ کارت‌های کلون وضعیت «نو» دارند.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        201: okResponse('دک کلون‌شده', { deck: ref('FlashcardDeck') }),
        ...errors(401, 403, 404, 409, 422, 429),
      },
    },
  },
  '/api/v1/flashcards/decks/{id}/cards': {
    get: {
      tags: flashcardTags,
      summary: 'کارت‌های یک دک',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: uuid },
        { name: 'page', in: 'query', schema: integer },
        { name: 'perPage', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse(
          'کارت‌ها',
          {
            deck: { type: 'object', properties: { id: uuid, title: string } },
            cards: {
              type: 'array',
              items: {
                type: 'object',
                properties: { card: ref('Flashcard'), state: nullable(ref('FlashcardState')) },
              },
            },
          },
          paginationMeta,
        ),
        ...errors(400, 401, 404, 429),
      },
    },
    post: {
      tags: flashcardTags,
      summary: 'ساخت کارت (تک یا دسته‌ای)',
      description:
        'دو شکل: `{front, back}` برای یک کارت، `{cards:[{front, back}, …]}` برای دسته‌ای. `position` و `status` سرور-ساخته‌اند.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        201: okResponse(
          'کارت(ها) ساخته شد',
          { card: ref('Flashcard'), cards: refList('Flashcard') },
          { created: integer },
        ),
        ...errors(401, 403, 404, 409, 422, 429),
      },
    },
  },
  '/api/v1/flashcards/cards': {
    get: {
      tags: flashcardTags,
      summary: 'جست‌وجو/فیلتر کارت‌ها',
      description: 'فیلترهای `state`/`bookmarked` روی **وضعیت خودِ کاربر** اعمال می‌شوند (subquery محدود به سشن).',
      parameters: [
        { name: 'deckId', in: 'query', schema: uuid },
        { name: 'q', in: 'query', schema: string },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'suspended', 'archived'] } },
        {
          name: 'state',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['new', 'learning', 'review', 'relearning', 'mastered', 'suspended', 'archived'],
          },
        },
        { name: 'bookmarked', in: 'query', schema: boolean },
        { name: 'page', in: 'query', schema: integer },
        { name: 'perPage', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse(
          'کارت‌ها',
          {
            cards: {
              type: 'array',
              items: {
                type: 'object',
                properties: { card: ref('Flashcard'), state: nullable(ref('FlashcardState')) },
              },
            },
          },
          paginationMeta,
        ),
        ...errors(400, 401, 422, 429),
      },
    },
  },
  '/api/v1/flashcards/cards/{id}': {
    patch: {
      tags: flashcardTags,
      summary: 'ویرایش کارت',
      description: '`deck_id`/`position` تغییرناپذیرند.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('کارت ویرایش‌شده', { card: ref('Flashcard') }),
        ...errors(401, 403, 404, 422, 429),
      },
    },
    delete: {
      tags: flashcardTags,
      summary: 'حذف کارت',
      description: 'کارت بدون تاریخچه فیزیکی حذف می‌شود؛ کارت با تاریخچه **آرشیو** می‌شود (تاریخچه immutable است).',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('نتیجه', { outcome: { type: 'string', enum: ['deleted', 'archived'] } }),
        ...errors(401, 403, 404, 429),
      },
    },
  },
  '/api/v1/flashcards/cards/{id}/suspend': {
    post: {
      tags: flashcardTags,
      summary: 'معلق/آزاد کردن کارت',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('وضعیت', { state: ref('FlashcardState') }),
        ...errors(401, 403, 404, 422, 429),
      },
    },
  },
  '/api/v1/flashcards/cards/{id}/bury': {
    post: {
      tags: flashcardTags,
      summary: 'بی‌صدا کردن موقت کارت',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('وضعیت', { state: ref('FlashcardState') }),
        ...errors(401, 403, 404, 422, 429),
      },
    },
  },
  '/api/v1/flashcards/cards/{id}/bookmark': {
    post: {
      tags: flashcardTags,
      summary: 'نشان‌گذاری کارت',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('وضعیت', { state: ref('FlashcardState') }),
        ...errors(401, 403, 404, 422, 429),
      },
    },
  },
  '/api/v1/flashcards/review/queue': {
    get: {
      tags: flashcardTags,
      summary: 'صف مرور',
      description:
        'کارت‌های due کاربر + کارت‌های نو. سقف تعداد «نو» جدا از `limit` است و `limit` سقف سخت دارد. کارت معلق/bury‌شده هرگز نمی‌آید.',
      parameters: [
        { name: 'mode', in: 'query', schema: { type: 'string', enum: ['today', 'deck', 'weak', 'cram'] } },
        { name: 'deckId', in: 'query', schema: uuid },
        { name: 'limit', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse('صف', { queue: refList('FlashcardQueueItem') }, { count: integer }),
        ...errors(400, 401, 404, 422, 429),
      },
    },
  },
  '/api/v1/flashcards/review/{cardId}': {
    post: {
      tags: flashcardTags,
      summary: 'ثبت مرور',
      description:
        'بدنه فقط `rating` و `requestKey`. `intervalDays`/`ease`/`nextDueAt`/`algorithmVersion`/`userId` نه در rules هستند و نه خوانده می‌شوند. همان `requestKey` با payload متفاوت ⇒ ۴۰۹؛ با payload یکسان ⇒ همان پاسخ بازپخش می‌شود.',
      parameters: [{ name: 'cardId', in: 'path', required: true, schema: uuid }],
      responses: {
        201: okResponse('مرور ثبت شد', { review: ref('FlashcardReviewResult') }),
        200: okResponse('بازپخش idempotent', { review: ref('FlashcardReviewResult') }),
        ...errors(401, 403, 404, 409, 422, 429),
      },
    },
  },
  '/api/v1/flashcards/progress': {
    get: {
      tags: flashcardTags,
      summary: 'پیشرفت فلش‌کارت',
      responses: {
        200: okResponse('پیشرفت', { progress: ref('FlashcardProgress') }),
        ...errors(401, 429),
      },
    },
  },

  /* فاز ۹ — فلش‌کارت رسمی (پنل) */
  '/api/v1/admin/flashcards/decks': {
    get: {
      tags: adminTags,
      summary: 'فهرست دک‌ها در پنل',
      description: 'مجوز: `flashcards.read`. همهٔ دک‌ها (رسمی و شخصی) قابل مشاهده‌اند.',
      parameters: [
        { name: 'owner', in: 'query', schema: { type: 'string', enum: ['official', 'personal'] } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'published', 'archived'] } },
        { name: 'q', in: 'query', schema: string },
        { name: 'page', in: 'query', schema: integer },
        { name: 'perPage', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse('دک‌ها', { decks: refList('FlashcardDeck') }, paginationMeta),
        ...errors(400, 401, 403, 422, 429),
      },
    },
    post: {
      tags: adminTags,
      summary: 'ساخت دک رسمی',
      description: 'مجوز: `flashcards.create`. `owner_user_id` همیشه `null` می‌ماند.',
      responses: {
        201: okResponse('دک رسمی', { deck: ref('FlashcardDeck') }),
        ...errors(401, 403, 422, 429),
      },
    },
  },
  '/api/v1/admin/flashcards/decks/{id}': {
    get: {
      tags: adminTags,
      summary: 'یک دک (پنل)',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: { 200: okResponse('دک', { deck: ref('FlashcardDeck') }), ...errors(401, 403, 404, 429) },
    },
    patch: {
      tags: adminTags,
      summary: 'ویرایش دک رسمی',
      description: 'مجوز: `flashcards.update`. دک شخصی از این مسیر ویرایش نمی‌شود (۴۰۳).',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('دک', { deck: ref('FlashcardDeck') }),
        ...errors(401, 403, 404, 409, 422, 429),
      },
    },
    delete: {
      tags: adminTags,
      summary: 'حذف دک خالی',
      description: 'مجوز: `flashcards.delete`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: { 204: noContent('حذف شد'), ...errors(401, 403, 404, 409, 429) },
    },
  },
  '/api/v1/admin/flashcards/decks/{id}/publish': {
    post: {
      tags: adminTags,
      summary: 'انتشار دک رسمی',
      description: 'مجوز: `flashcards.publish`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: { 200: okResponse('دک', { deck: ref('FlashcardDeck') }), ...errors(401, 403, 404, 429) },
    },
  },
  '/api/v1/admin/flashcards/decks/{id}/archive': {
    post: {
      tags: adminTags,
      summary: 'آرشیو دک رسمی',
      description: 'مجوز: `flashcards.publish`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: { 200: okResponse('دک', { deck: ref('FlashcardDeck') }), ...errors(401, 403, 404, 429) },
    },
  },
  '/api/v1/admin/flashcards/decks/{id}/cards': {
    get: {
      tags: adminTags,
      summary: 'کارت‌های دک (پنل)',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: uuid },
        { name: 'page', in: 'query', schema: integer },
        { name: 'perPage', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse('کارت‌ها', { cards: refList('Flashcard') }, paginationMeta),
        ...errors(401, 403, 404, 429),
      },
    },
    post: {
      tags: adminTags,
      summary: 'افزودن کارت به دک رسمی',
      description: 'مجوز: `flashcards.create`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        201: okResponse('کارت(ها)', { card: ref('Flashcard'), cards: refList('Flashcard') }, { created: integer }),
        ...errors(401, 403, 404, 409, 422, 429),
      },
    },
  },
  '/api/v1/admin/flashcards/cards/{id}': {
    patch: {
      tags: adminTags,
      summary: 'ویرایش کارت (پنل)',
      description: 'مجوز: `flashcards.update`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: { 200: okResponse('کارت', { card: ref('Flashcard') }), ...errors(401, 403, 404, 422, 429) },
    },
    delete: {
      tags: adminTags,
      summary: 'حذف/آرشیو کارت (پنل)',
      description: 'مجوز: `flashcards.delete`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('نتیجه', { outcome: { type: 'string', enum: ['deleted', 'archived'] } }),
        ...errors(401, 403, 404, 429),
      },
    },
  },

  /* فاز ۱۰ — ویکی (عمومی) */
  '/api/v1/wiki/categories': {
    get: {
      tags: wikiTags,
      summary: 'درخت دسته‌های منتشرشده',
      description: 'فقط `status=published`. شمارش مقاله فقط مقالهٔ منتشرشده را می‌شمارد.',
      responses: { 200: okResponse('درخت دسته‌ها', { categories: refList('WikiCategory') }), ...errors(429) },
    },
  },
  '/api/v1/wiki/articles': {
    get: {
      tags: wikiTags,
      summary: 'فهرست مقاله‌های منتشرشده',
      parameters: [
        { name: 'q', in: 'query', schema: string },
        { name: 'subject', in: 'query', schema: string },
        { name: 'type', in: 'query', schema: string },
        { name: 'difficulty', in: 'query', schema: { type: 'string', enum: ['basic', 'intermediate', 'advanced'] } },
        { name: 'categoryId', in: 'query', schema: uuid },
        { name: 'sort', in: 'query', schema: { type: 'string', enum: ['popular', 'recent', 'title'] } },
        { name: 'page', in: 'query', schema: integer },
        { name: 'perPage', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse('مقاله‌ها', { articles: refList('WikiArticleSummary') }, paginationMeta),
        ...errors(400, 422, 429),
      },
    },
  },
  '/api/v1/wiki/articles/{slug}': {
    get: {
      tags: wikiTags,
      summary: 'مقاله + رابطه‌ها',
      description: '`draft`/`archived` و slug ناموجود هر دو ۴۰۴ می‌گیرند — وجود پیش‌نویس لو نمی‌رود.',
      parameters: [{ name: 'slug', in: 'path', required: true, schema: string }],
      responses: {
        200: okResponse('مقاله', {
          article: ref('WikiArticle'),
          related: refList('WikiRelation'),
          backlinks: refList('WikiRelation'),
        }),
        ...errors(404, 429),
      },
    },
  },
  '/api/v1/wiki/search': {
    get: {
      tags: wikiTags,
      summary: 'جست‌وجوی ویکی',
      description:
        'PostgreSQL/ILIKE با نرمال‌سازی حروف عربی/فارسی و نیم‌فاصله. facetها روی همان مجموعهٔ فیلترشده حساب می‌شوند. فقط `published`.',
      parameters: [
        { name: 'q', in: 'query', required: true, schema: string },
        { name: 'subject', in: 'query', schema: string },
        { name: 'type', in: 'query', schema: string },
        { name: 'difficulty', in: 'query', schema: { type: 'string', enum: ['basic', 'intermediate', 'advanced'] } },
        { name: 'categoryId', in: 'query', schema: uuid },
        { name: 'sort', in: 'query', schema: { type: 'string', enum: ['popular', 'recent', 'title'] } },
        { name: 'page', in: 'query', schema: integer },
        { name: 'perPage', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse(
          'نتایج',
          {
            query: string,
            results: refList('WikiArticleSummary'),
            facets: {
              type: 'object',
              properties: {
                bySubject: { type: 'object', additionalProperties: integer },
                byType: { type: 'object', additionalProperties: integer },
                byDifficulty: { type: 'object', additionalProperties: integer },
              },
            },
          },
          paginationMeta,
        ),
        ...errors(400, 422, 429),
      },
    },
  },
  '/api/v1/wiki/suggest': {
    get: {
      tags: wikiTags,
      summary: 'پیشنهاد زنده',
      description: 'فقط روی `title`/`slug`، سقف سخت، فقط `published`.',
      parameters: [
        { name: 'q', in: 'query', required: true, schema: string },
        { name: 'limit', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse('پیشنهادها', { query: string, suggestions: refList('WikiArticleSummary') }),
        ...errors(400, 422, 429),
      },
    },
  },

  /* فاز ۱۰ — نشان‌گذاری (کاربر) */
  '/api/v1/me/wiki-bookmarks': {
    get: {
      tags: ['me'],
      summary: 'نشان‌گذاری‌های کاربر جاری',
      description: 'هویت فقط از سشن. مقالهٔ غیرمنتشرشده از فهرست ناپدید می‌شود.',
      parameters: [
        { name: 'page', in: 'query', schema: integer },
        { name: 'perPage', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse('نشان‌ها', { bookmarks: refList('WikiBookmark') }, paginationMeta),
        ...errors(400, 401, 422, 429),
      },
    },
  },
  '/api/v1/me/wiki-bookmarks/{articleId}': {
    put: {
      tags: ['me'],
      summary: 'افزودن نشان',
      description: 'idempotent: نشان تکراری همان رکورد را برمی‌گرداند. مقالهٔ پیش‌نویس ⇒ ۴۰۴.',
      parameters: [{ name: 'articleId', in: 'path', required: true, schema: uuid }],
      responses: {
        201: okResponse('نشان', { bookmark: ref('WikiBookmark') }),
        ...errors(401, 403, 404, 422, 429),
      },
    },
    delete: {
      tags: ['me'],
      summary: 'حذف نشان',
      description: 'idempotent: نبودن نشان خطا نیست.',
      parameters: [{ name: 'articleId', in: 'path', required: true, schema: uuid }],
      responses: { 204: noContent('حذف شد'), ...errors(401, 403, 404, 429) },
    },
  },

  /* فاز ۱۰ — ویکی (پنل) */
  '/api/v1/admin/wiki/categories': {
    get: {
      tags: adminTags,
      summary: 'درخت دسته‌ها (پنل)',
      description: 'مجوز: `categories.read`. شامل همهٔ وضعیت‌ها.',
      responses: { 200: okResponse('درخت', { categories: refList('WikiCategory') }), ...errors(401, 403, 429) },
    },
    post: {
      tags: adminTags,
      summary: 'ساخت دسته',
      description: 'مجوز: `categories.create`. دسته تازه همیشه `draft` است.',
      responses: { 201: okResponse('دسته', { category: ref('WikiCategory') }), ...errors(401, 403, 422, 429) },
    },
  },
  '/api/v1/admin/wiki/categories/{id}': {
    patch: {
      tags: adminTags,
      summary: 'ویرایش/جابه‌جایی دسته',
      description: 'مجوز: `categories.update`. `parentId` چرخه‌ساز ⇒ ۴۲۲ `CATEGORY_CYCLE`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: { 200: okResponse('دسته', { category: ref('WikiCategory') }), ...errors(401, 403, 404, 422, 429) },
    },
    delete: {
      tags: adminTags,
      summary: 'حذف/آرشیو دسته',
      description: 'مجوز: `categories.delete`. دستهٔ دارای مقاله یا فرزند آرشیو می‌شود، نه حذف.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('نتیجه', { outcome: { type: 'string', enum: ['deleted', 'archived'] } }),
        ...errors(401, 403, 404, 429),
      },
    },
  },
  '/api/v1/admin/wiki/articles': {
    get: {
      tags: adminTags,
      summary: 'فهرست مقاله‌ها (پنل)',
      description: 'مجوز: `articles.read`. `status` تنها اینجا فیلتر مجاز است.',
      parameters: [
        { name: 'q', in: 'query', schema: string },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'published', 'archived'] } },
        { name: 'categoryId', in: 'query', schema: uuid },
        { name: 'subject', in: 'query', schema: string },
        { name: 'type', in: 'query', schema: string },
        { name: 'difficulty', in: 'query', schema: string },
        { name: 'page', in: 'query', schema: integer },
        { name: 'perPage', in: 'query', schema: integer },
      ],
      responses: {
        200: okResponse('مقاله‌ها', { articles: { type: 'array', items: { type: 'object' } } }, paginationMeta),
        ...errors(400, 401, 403, 422, 429),
      },
    },
    post: {
      tags: adminTags,
      summary: 'ساخت مقاله',
      description: 'مجوز: `articles.create`. `body` پیش از ذخیره sanitize می‌شود. `author_admin_id` از سشن.',
      responses: { 201: okResponse('مقاله', { article: { type: 'object' } }), ...errors(401, 403, 409, 422, 429) },
    },
  },
  '/api/v1/admin/wiki/articles/{id}': {
    get: {
      tags: adminTags,
      summary: 'یک مقاله (پنل)',
      description: 'مجوز: `articles.read`. شامل `status`/`version`/متادیتای نویسنده.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: { 200: okResponse('مقاله', { article: { type: 'object' } }), ...errors(401, 403, 404, 429) },
    },
    patch: {
      tags: adminTags,
      summary: 'ویرایش مقاله',
      description: 'مجوز: `articles.update`. `version` اجباری است؛ نسخهٔ کهنه ⇒ ۴۰۹.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('مقاله', { article: { type: 'object' } }),
        ...errors(401, 403, 404, 409, 422, 429),
      },
    },
  },
  '/api/v1/admin/wiki/articles/{id}/publish': {
    post: {
      tags: adminTags,
      summary: 'انتشار مقاله',
      description: 'مجوز: `articles.publish`. فقط اینجا `status` عوض می‌شود.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: { 200: okResponse('مقاله', { article: { type: 'object' } }), ...errors(401, 403, 404, 429) },
    },
  },
  '/api/v1/admin/wiki/articles/{id}/archive': {
    post: {
      tags: adminTags,
      summary: 'آرشیو مقاله',
      description: 'مجوز: `articles.publish`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: { 200: okResponse('مقاله', { article: { type: 'object' } }), ...errors(401, 403, 404, 429) },
    },
  },
  '/api/v1/admin/wiki/relations': {
    post: {
      tags: adminTags,
      summary: 'ساخت رابطه بین دو مقاله',
      description:
        'مجوز: `articles.update`. `kind` از allowlist. self relation ⇒ ۴۲۲ `RELATION_SELF_NOT_ALLOWED`، تکرار ⇒ ۴۰۹.',
      responses: { 201: okResponse('رابطه', { relation: ref('WikiRelation') }), ...errors(401, 403, 422, 429) },
    },
  },
  '/api/v1/admin/wiki/relations/{id}': {
    delete: {
      tags: adminTags,
      summary: 'حذف رابطه',
      description: 'مجوز: `articles.update`.',
      parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      responses: { 204: noContent('حذف شد'), ...errors(401, 403, 404, 429) },
    },
  },
};

/* ── ادغام ──────────────────────────────────────────────────────────── */

spec.info.title =
  'TAPESH API v1 — Identity (Phase 2) + Learning (Phase 5) + Question Bank (Phase 6) + Exam Engine (Phase 7) + Analytics (Phase 8) + Flashcards (Phase 9) + Wiki (Phase 10)';
spec.info.version = '1.5.0';
spec.info.description +=
  '\n\n**فاز ۹ (فلش‌کارت):** سه سطح جدا — `flashcards` (تعریف) · `flashcard_states` (وضعیت mutable) · `flashcard_reviews` (تاریخچهٔ immutable). وضعیت مرور **فقط** توسط سرور و از الگوریتم نسخه‌دار (`algorithm_version`) تعیین می‌شود؛ `interval`/`ease`/`next_due_at` هرگز از بدنه خوانده نمی‌شوند. ثبت مرور با `requestKey` idempotent است.' +
  '\n\n**فاز ۱۰ (ویکی):** `Category → Article → Relation → Bookmark`. مسیرهای عمومی فقط `published` را برمی‌گردانند و `draft`/`archived` ⇒ ۴۰۴. گراف دانش واقعی فاز ۱۱ است؛ رابطه‌های اینجا فقط پایهٔ آن‌اند.' +
  '\n\n**مجوزهای پنل:** فلش‌کارت با `flashcards.*` و ویکی با `articles.*`/`categories.*` — همان کلیدهای واقعی RBAC. هیچ کلید `wiki.*` اختراع نشد.';

for (const [name, schema] of Object.entries(schemas)) {
  spec.components.schemas[name] = schema;
}

for (const [path, operations] of Object.entries(paths)) {
  spec.paths[path] = operations;
}

const existingTags = new Set((spec.tags ?? []).map((tag) => tag.name));

for (const tag of [
  { name: 'flashcards', description: 'فلش‌کارت — دک/کارت/مرور (فاز ۹). مالکیت فقط از سشن.' },
  { name: 'wiki', description: 'ویکی — دانشنامهٔ پزشکی منتشرشده (فاز ۱۰). فقط `published`.' },
]) {
  if (!existingTags.has(tag.name)) {
    spec.tags.push(tag);
  }
}

// ترتیب پایدار: مسیرها الفبایی تا diff تمیز بماند.
spec.paths = Object.fromEntries(Object.entries(spec.paths).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync(FILE, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

const counts = Object.keys(spec.paths).length;
const operations = Object.values(spec.paths).reduce((sum, ops) => sum + Object.keys(ops).length, 0);

console.log(`openapi.v1.json → ${counts} paths / ${operations} operations / ${Object.keys(spec.components.schemas).length} schemas`);
