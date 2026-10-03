#!/usr/bin/env node
/*
 * افزودن مسیرها و schemaهای فاز ۱۷/۱۸ به OpenAPI v1.
 *
 * همان الگوی build-openapi-v1-phase15-16.mjs: idempotent، مسیرهای فازهای قبل را
 * دست نمی‌زند و فقط مسیرهایی را می‌نویسد که واقعاً در routes/api.php هستند
 * (`ApiV1ContractTest` دوطرفه بودن را قفل می‌کند).
 *
 * دو نکتهٔ عمدی در این فاز:
 *   • مسیرهای موازی ساخته نشدند (`/international/courses/{slug}/chapters`،
 *     `.../exams`). پس اینجا هم مستند نمی‌شوند — سند نباید چیزی وعده دهد که
 *     وجود ندارد.
 *   • webhook درگاه **هیچ** سشن/Origin/CSRF ندارد. در سند صریح نوشته شده تا
 *     مصرف‌کننده فکر نکند سند ناقص است.
 *
 * اجرا: node scripts/build-openapi-v1-phase17-18.mjs
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
const notFound = () => errorResponse('منبع یافت نشد', 'NOT_FOUND');
const conflict = () => errorResponse('تعارض وضعیت/یکتایی', 'CONFLICT');
const rateLimited = () => errorResponse('سقف نرخ درخواست', 'RATE_LIMITED');
const notConfigured = () => errorResponse('قابلیت پیکربندی نشده (درگاه/خرید)', 'FEATURE_NOT_CONFIGURED');
const entitlementRequired = () => errorResponse('این محتوا نیازمند دسترسی فعال است', 'ENTITLEMENT_REQUIRED');

const body = (properties, required) => ({
  required: true,
  content: {
    'application/json': {
      schema: { type: 'object', properties, ...(required ? { required } : {}) },
    },
  },
});

const optionalBody = (properties, required) => ({
  required: false,
  content: {
    'application/json': {
      schema: { type: 'object', properties, ...(required ? { required } : {}) },
    },
  },
});

const pathId = (name = 'id') => ({ name, in: 'path', required: true, schema: uuid });
const query = (name, schema, description) => ({ name, in: 'query', required: false, schema, ...(description ? { description } : {}) });

/* ── فهرست‌های بسته ─────────────────────────────────────────────────── */

const CONTENT_STATUS = ['draft', 'published', 'archived'];
const PROVIDER_KINDS = ['university', 'institute', 'organization', 'platform', 'other'];
const INT_CATEGORIES = ['medicine', 'science', 'technology', 'business', 'arts', 'language', 'other'];
const CYCLE_IDS = ['monthly', 'quarterly', 'yearly'];
const ORDER_STATUSES = ['pending', 'awaiting_payment', 'paid', 'failed', 'expired', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'verified', 'failed', 'expired', 'cancelled'];
const SUBSCRIPTION_STATUSES = ['pending', 'active', 'expired', 'cancelled', 'revoked'];
const WEBHOOK_STATUSES = ['success', 'failed', 'cancelled', 'expired'];
const CURRENCIES = ['IRT', 'IRR'];

/* ── Schemaها ───────────────────────────────────────────────────────── */

const schemas = {
  InternationalProvider: {
    type: 'object',
    description: 'ناشر بین‌الملل (نمای عمومی). `status`/`origin`/`legacy_id` عمداً نیستند.',
    properties: {
      id: uuid,
      slug: string,
      name: string,
      name_en: nullable(string),
      kind: { type: 'string', enum: PROVIDER_KINDS },
      country: nullable(string),
      founded: nullable(string),
      description: nullable(string),
      focus: { type: 'array', items: string },
      logo_media_id: nullable(uuid),
      logo_url: nullable(string),
      sort_order: integer,
      marquee_order: integer,
    },
    required: ['id', 'slug', 'name', 'kind', 'focus'],
  },

  AdminInternationalProvider: {
    type: 'object',
    description: 'ناشر — نمای پنل. `status`/`origin`/`published_at` می‌آیند چون ادمین چرخهٔ عمر را مدیریت می‌کند.',
    properties: {
      id: uuid,
      slug: string,
      name: string,
      name_en: nullable(string),
      kind: { type: 'string', enum: PROVIDER_KINDS },
      country: nullable(string),
      founded: nullable(string),
      description: nullable(string),
      focus: { type: 'array', items: string },
      logo_media_id: nullable(uuid),
      sort_order: integer,
      marquee_order: integer,
      status: { type: 'string', enum: CONTENT_STATUS },
      origin: { type: 'string', enum: ['tapesh', 'panel', 'legacy'] },
      legacy_id: nullable(string),
      published_at: nullable(dateTime),
      courses_count: integer,
      created_at: dateTime,
      updated_at: dateTime,
    },
    required: ['id', 'slug', 'name', 'kind', 'status', 'origin'],
  },

  InternationalCourse: {
    type: 'object',
    description:
      'دورهٔ بین‌الملل (نمای عمومی). **کاتالوگ است، نه محتوا**: فصل/درس/صفحه از Content Engine می‌آید و آزمون از همان موتور آزمون با `kind=international`. `locked` یعنی «پرمیوم و کاربر دسترسی ندارد» — فهرست قفل را نشان می‌دهد، جزئیات ۴۰۳ می‌دهد.',
    properties: {
      id: uuid,
      slug: string,
      title: string,
      description: nullable(string),
      category: nullable(string),
      level: nullable(string),
      tags: { type: 'array', items: string },
      cover_media_id: nullable(uuid),
      cover_url: nullable(string),
      accent: nullable(string),
      accent_soft: nullable(string),
      badge: nullable(string),
      duration_minutes: nullable(integer),
      total_duration_label: nullable(string),
      required_capability: nullable(string),
      locked: { ...boolean, description: 'پرمیوم است و کاربر جاری دسترسی فعال ندارد.' },
      sort_order: integer,
      provider: ref('InternationalProvider'),
    },
    required: ['id', 'slug', 'title', 'required_capability', 'locked', 'provider'],
  },

  AdminInternationalCourse: {
    type: 'object',
    description: 'دورهٔ بین‌الملل — نمای پنل.',
    properties: {
      id: uuid,
      slug: string,
      title: string,
      description: nullable(string),
      category: nullable(string),
      level: nullable(string),
      tags: { type: 'array', items: string },
      cover_media_id: nullable(uuid),
      accent: nullable(string),
      accent_soft: nullable(string),
      badge: nullable(string),
      duration_minutes: nullable(integer),
      total_duration_label: nullable(string),
      required_capability: nullable(string),
      sort_order: integer,
      status: { type: 'string', enum: CONTENT_STATUS },
      origin: { type: 'string', enum: ['tapesh', 'panel', 'legacy'] },
      legacy_id: nullable(string),
      published_at: nullable(dateTime),
      provider: ref('AdminInternationalProvider'),
      created_at: dateTime,
      updated_at: dateTime,
    },
    required: ['id', 'slug', 'title', 'status', 'origin'],
  },

  PricingCycle: {
    type: 'object',
    properties: {
      id: { type: 'string', enum: CYCLE_IDS },
      months: integer,
      discountPercent: integer,
    },
    required: ['id', 'months', 'discountPercent'],
  },

  PricingSeatLadder: {
    type: 'object',
    description: 'نردبان صندلی — فقط برای پلن صندلی‌دار. تخفیف چرخه روی آن اعمال نمی‌شود.',
    properties: {
      min: integer,
      max: integer,
      default: integer,
      discounts: { type: 'object', additionalProperties: integer },
    },
    required: ['min', 'max', 'default', 'discounts'],
  },

  ProductCapability: {
    type: 'object',
    description: 'قابلیت فروشی محصول — همان چیزی که `required_capability` دورهٔ بین‌الملل به آن اشاره می‌کند.',
    properties: {
      code: string,
      coverage: { type: 'string', enum: ['full', 'partial', 'trial'] },
    },
    required: ['code', 'coverage'],
  },

  PricingPlan: {
    type: 'object',
    description:
      'محصول قابل خرید با چرخه‌هایش. `approved:false` یعنی مبلغ نهایی نیست (قیمت واقعی تأیید نشده) — نمایش می‌دهیم ولی نمی‌فروشیم. `id` همان `planId` قرارداد UI است (sku محصول)، نه UUID.',
    properties: {
      id: string,
      product: string,
      name: string,
      kind: { type: 'string', enum: ['subscription', 'one_time'] },
      currency: { type: 'string', enum: CURRENCIES },
      approved: boolean,
      purchasable: boolean,
      seats: nullable(ref('PricingSeatLadder')),
      capabilities: refList('ProductCapability'),
      cycles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: CYCLE_IDS },
            months: integer,
            discountPercent: integer,
            priceMinor: integer,
            approved: boolean,
          },
        },
      },
    },
    required: ['id', 'product', 'name', 'currency', 'approved', 'purchasable', 'capabilities', 'cycles'],
  },

  PricingCatalog: {
    type: 'object',
    description: 'کاتالوگ عمومی. `amountsConfirmed:false` یعنی حداقل یک طرح تأییدنشده دارد ⇒ مبالغ قطعی نیستند.',
    properties: {
      currency: { type: 'string', enum: CURRENCIES },
      currencyLabel: string,
      amountsConfirmed: boolean,
      checkout: ref('CheckoutState'),
      cycles: refList('PricingCycle'),
      plans: refList('PricingPlan'),
    },
    required: ['currency', 'amountsConfirmed', 'checkout', 'cycles', 'plans'],
  },

  CheckoutState: {
    type: 'object',
    description: 'وضعیت واقعی خرید. `configured:false` یعنی Secret درگاه ست نشده ⇒ هر تلاش پرداخت ۵۰۳ می‌گیرد. هیچ Secret در پاسخ نیست.',
    properties: {
      enabled: boolean,
      gateway: string,
      configured: boolean,
    },
    required: ['enabled', 'gateway', 'configured'],
  },

  Quote: {
    type: 'object',
    description:
      'مبلغ محاسبه‌شدهٔ سرور. `list_total_minor` جمع بدون تخفیف است تا UI بتواند «چقدر صرفه‌جویی شد» را نشان دهد. مبلغ هرگز از کلاینت خوانده نمی‌شود.',
    properties: {
      product: string,
      product_name: nullable(string),
      plan: string,
      cycle: { type: 'string', enum: CYCLE_IDS },
      months: integer,
      seats: integer,
      discount_percent: integer,
      list_per_month_minor: integer,
      per_month_minor: integer,
      per_seat_total_minor: integer,
      total_minor: integer,
      list_total_minor: integer,
      saved_total_minor: integer,
      currency: { type: 'string', enum: CURRENCIES },
      approved: boolean,
      purchasable: boolean,
    },
    required: ['product', 'plan', 'cycle', 'months', 'seats', 'per_month_minor', 'total_minor', 'currency', 'approved', 'purchasable'],
  },

  OrderLine: {
    type: 'object',
    description: 'سطر سفارش با snapshot تاریخی — تغییر قیمت فردا سند دیروز را عوض نمی‌کند.',
    properties: {
      id: uuid,
      product_id: nullable(uuid),
      plan_id: nullable(uuid),
      unit_minor: integer,
      quantity: integer,
      line_total_minor: integer,
      snapshot: { type: 'object', additionalProperties: true },
    },
    required: ['id', 'unit_minor', 'quantity', 'line_total_minor'],
  },

  Order: {
    type: 'object',
    description:
      'سفارش. `user_id` عمداً نیست — مالکیت فقط از سشن می‌آید. `paid_at` فقط پس از تأیید واقعی درگاه پر می‌شود و هیچ مسیری آن را از کلاینت نمی‌پذیرد.',
    properties: {
      id: uuid,
      status: { type: 'string', enum: ORDER_STATUSES },
      total_minor: integer,
      currency: { type: 'string', enum: CURRENCIES },
      quote_snapshot: { type: 'object', additionalProperties: true },
      expires_at: nullable(dateTime),
      paid_at: nullable(dateTime),
      created_at: dateTime,
      lines: refList('OrderLine'),
    },
    required: ['id', 'status', 'total_minor', 'currency', 'quote_snapshot', 'created_at'],
  },

  Payment: {
    type: 'object',
    description:
      'تراکنش درگاه. `authority` می‌آید چون کاربر برای تکمیل پرداخت به آن نیاز دارد؛ `provider_reference` و هر دادهٔ رازِ درگاه نمی‌آید.',
    properties: {
      id: uuid,
      order_id: uuid,
      provider: string,
      authority: string,
      status: { type: 'string', enum: PAYMENT_STATUSES },
      amount_minor: integer,
      currency: { type: 'string', enum: CURRENCIES },
      verified_at: nullable(dateTime),
      created_at: dateTime,
    },
    required: ['id', 'order_id', 'provider', 'authority', 'status', 'amount_minor', 'currency', 'created_at'],
  },

  Subscription: {
    type: 'object',
    description: 'اشتراک. `effective` محاسبهٔ سرور است: «active ولی ends_at گذشته» برای کاربر یعنی غیرفعال.',
    properties: {
      id: uuid,
      status: { type: 'string', enum: SUBSCRIPTION_STATUSES },
      effective: boolean,
      starts_at: nullable(dateTime),
      ends_at: nullable(dateTime),
      plan: nullable({
        type: 'object',
        properties: {
          code: string,
          cycle_months: integer,
          product: nullable(string),
        },
      }),
    },
    required: ['id', 'status', 'effective'],
  },

  Entitlement: {
    type: 'object',
    description:
      'قابلیت اعطاشده به کاربر. **نقش نیست** — «کاربر پرمیوم» یک نقش تازه نیست، یک ردیف با پنجرهٔ زمانی است. `active` محاسبهٔ سرور است (شروع/پایان/لغو).',
    properties: {
      id: uuid,
      capability: string,
      active: boolean,
      revoked: boolean,
      source_order_id: nullable(uuid),
      starts_at: nullable(dateTime),
      ends_at: nullable(dateTime),
      revoked_at: nullable(dateTime),
    },
    required: ['id', 'capability', 'active', 'revoked'],
  },

  PaymentWebhookReceipt: {
    type: 'object',
    description:
      'نتیجهٔ پردازش رخداد درگاه. پاسخ **همیشه ۲۰۰** است مگر امضا نامعتبر باشد (۴۰۳). `result` می‌گوید چه شد: `PAYMENT_VERIFIED`، `ALREADY_VERIFIED`، `REPLAY_IGNORED`، `AMOUNT_MISMATCH`، `UNKNOWN_AUTHORITY`، `PAYMENT_FAILED`.',
    properties: {
      received: boolean,
      status: { type: 'string', enum: ['received', 'processed', 'ignored', 'rejected'] },
      result: string,
    },
    required: ['received', 'status', 'result'],
  },

  PaymentStart: {
    type: 'object',
    properties: {
      payment: ref('Payment'),
      redirect_url: string,
      replayed: { ...boolean, description: 'true یعنی تراکنش بازِ همان سفارش برگردانده شد، نه تراکنش تازه.' },
    },
    required: ['payment', 'redirect_url', 'replayed'],
  },
};

/* ── مسیرها ─────────────────────────────────────────────────────────── */

const paginationQuery = [
  query('page', { type: 'integer', minimum: 1 }),
  query('perPage', { type: 'integer', minimum: 1 }),
];

const paths = {
  /* ── فاز ۱۷ — کاتالوگ بین‌الملل (عمومی) ─────────────────────────── */

  '/api/v1/international/providers': {
    get: {
      tags: ['international'],
      summary: 'فهرست ناشران منتشرشده',
      description: 'عمومی. فقط ناشران `published`. سشن اختیاری است و چیزی را تغییر نمی‌دهد.',
      responses: {
        200: okResponse('فهرست ناشران', { providers: refList('InternationalProvider') }),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/international/courses': {
    get: {
      tags: ['international'],
      summary: 'فهرست دوره‌های بین‌الملل',
      description:
        'عمومی. فقط `published` و فقط زیر ناشر منتشرشده. `locked` بر اساس entitlement **همین** کاربر (یا مهمان) محاسبه می‌شود. فیلترها allowlist اند؛ `status` فیلتر نیست.',
      parameters: [
        query('provider', { type: 'string', pattern: '^[a-z0-9-]+$' }, 'slug ناشر'),
        query('category', { type: 'string', enum: INT_CATEGORIES }),
        query('search', { type: 'string', maxLength: 120 }, 'جست‌وجو روی عنوان/توضیح/دسته — نه برچسب‌ها'),
        ...paginationQuery,
      ],
      responses: {
        200: okResponse('فهرست دوره‌ها', { courses: refList('InternationalCourse') }, pageMeta),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/international/courses/{slug}': {
    get: {
      tags: ['international'],
      summary: 'جزئیات یک دورهٔ بین‌الملل',
      description:
        'عمومی. پیش‌نویس/آرشیو ⇒ ۴۰۴ (نه ۴۰۳) تا شمارش پیش‌نویس‌ها ممکن نباشد. دورهٔ پرمیوم منتشرشده بدون دسترسی ⇒ ۴۰۳ با `ENTITLEMENT_REQUIRED` (وجودش راز نیست، ولی بازکردنش دسترسی می‌خواهد).',
      parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-z0-9-]+$' } }],
      responses: {
        200: okResponse('دوره', { course: ref('InternationalCourse') }),
        403: entitlementRequired(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },

  /* ── فاز ۱۸ — قیمت‌گذاری (عمومی) ──────────────────────────────── */

  '/api/v1/pricing/plans': {
    get: {
      tags: ['pricing'],
      summary: 'کاتالوگ قیمت و ماتریس قابلیت‌ها',
      description:
        'عمومی و بدون سشن. اگر Secret درگاه ست نشده باشد، کاتالوگ **باز هم** سرو می‌شود ولی `checkout.configured:false` صادقانه می‌گوید خرید فعال نیست. هیچ Secret در پاسخ نیست.',
      responses: {
        200: okResponse('کاتالوگ', {
          currency: { type: 'string', enum: CURRENCIES },
          currencyLabel: string,
          amountsConfirmed: boolean,
          checkout: ref('CheckoutState'),
          cycles: refList('PricingCycle'),
          plans: refList('PricingPlan'),
        }),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/pricing/quote': {
    post: {
      tags: ['pricing'],
      summary: 'محاسبهٔ مبلغ (Quote)',
      description:
        'POST است ولی **نوشتن نیست**: هیچ رکوردی نمی‌سازد و هیچ مبلغی از کلاینت نمی‌پذیرد. برای همین CSRF نمی‌خواهد (مهمان هم باید قیمت ببیند) ولی same-origin دارد. هر فیلد مبلغی در بدنه نادیده گرفته می‌شود.',
      requestBody: body(
        {
          planId: { ...string, description: 'sku محصول (همان `planId` قرارداد UI)' },
          cycleId: { type: 'string', enum: CYCLE_IDS },
          seats: { type: 'integer', minimum: 1, maximum: 3 },
        },
        ['planId', 'cycleId'],
      ),
      responses: {
        200: okResponse('مبلغ محاسبه‌شده', { quote: ref('Quote') }),
        404: notFound(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  /* ── فاز ۱۸ — سفارش ──────────────────────────────────────────── */

  '/api/v1/orders': {
    post: {
      tags: ['orders'],
      summary: 'ساخت سفارش (idempotent)',
      description:
        'مالکیت از سشن. `Idempotency-Key` + `UNIQUE(scope,actor_key,request_key)`: همان کلید و همان بدنه ⇒ همان سفارش؛ همان کلید و بدنهٔ متفاوت ⇒ ۴۰۹. مبلغ فقط سمت سرور ساخته می‌شود. اگر `checkout.enabled=false` باشد ⇒ ۵۰۳.',
      parameters: [
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          schema: { type: 'string', maxLength: 96 },
          description: 'کلید تکرارزدایی درخواست.',
        },
      ],
      requestBody: body(
        {
          planId: string,
          cycleId: { type: 'string', enum: CYCLE_IDS },
          seats: { type: 'integer', minimum: 1, maximum: 3 },
        },
        ['planId', 'cycleId'],
      ),
      responses: {
        201: okResponse('سفارش ساخته شد', { order: ref('Order') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: conflict(),
        422: unprocessable(),
        429: rateLimited(),
        503: notConfigured(),
      },
    },
  },

  '/api/v1/orders/{id}/cancel': {
    post: {
      tags: ['orders'],
      summary: 'لغو سفارش باز توسط خود کاربر',
      description:
        'سفارش دیگری ⇒ ۴۰۴ (نه ۴۰۳). سفارش پرداخت‌شده/منقضی/لغوشده ⇒ ۴۰۹ (`ORDER_NOT_CANCELLABLE`). لغو فقط برای آزادکردن سقف سفارش باز است.',
      parameters: [pathId()],
      responses: {
        200: okResponse('سفارش لغو شد', { order: ref('Order') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: conflict(),
        429: rateLimited(),
      },
    },
  },

  /* ── فاز ۱۸ — پرداخت ─────────────────────────────────────────── */

  '/api/v1/orders/{orderId}/payments': {
    post: {
      tags: ['payments'],
      summary: 'شروع پرداخت برای سفارش',
      description:
        'مبلغ از **سفارش** خوانده می‌شود، نه از بدنه. اگر تراکنش بازِ همان سفارش وجود داشته باشد، همان برگردانده می‌شود (`replayed:true`) تا هر بار زدن دکمه authority تازه نسازد.',
      parameters: [{ name: 'orderId', in: 'path', required: true, schema: uuid }],
      responses: {
        200: okResponse('تراکنش باز موجود بازگردانده شد', {
          payment: ref('Payment'),
          redirect_url: string,
          replayed: boolean,
        }),
        201: okResponse('تراکنش تازه ساخته شد', {
          payment: ref('Payment'),
          redirect_url: string,
          replayed: boolean,
        }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: conflict(),
        429: rateLimited(),
        503: notConfigured(),
      },
    },
  },

  '/api/v1/payments/{id}/verify': {
    post: {
      tags: ['payments'],
      summary: 'تأیید پرداخت (سمت کاربر) — idempotent',
      description:
        'ورودی فقط `signature` (شاهد رمزنگاری‌شدهٔ درگاه) است. تأیید دوباره روی تراکنش بسته ⇒ no-op، بدون entitlement دوم. تأیید ناموفق ⇒ ۴۲۲ و سفارش `failed` می‌شود؛ هیچ دسترسی‌ای صادر نمی‌شود.',
      parameters: [pathId()],
      requestBody: optionalBody({ signature: nullable(string) }),
      responses: {
        200: okResponse('پرداخت تأییدشده', { payment: ref('Payment') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: conflict(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/payments/webhook/{provider}': {
    post: {
      tags: ['payments'],
      summary: 'رخداد درگاه (Webhook)',
      description:
        '⚠️ **بدون سشن، بدون same-origin، بدون CSRF** — درخواست از مرورگر نمی‌آید و کوکی ندارد؛ اعتبارسنجی کاملاً رمزنگاری‌شده است (امضای provider در هدر `X-Payment-Signature`). امضا نامعتبر ⇒ ۴۰۳ و ثبت `rejected` بدون اثر مالی. رخداد معتبرِ تکراری ⇒ ۲۰۰ با `REPLAY_IGNORED` تا retry درگاه بند بیاید. ناهم‌خوانی مبلغ ⇒ `AMOUNT_MISMATCH` بدون هیچ entitlement.',
      parameters: [
        { name: 'provider', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-z0-9-]+$' } },
        { name: 'X-Payment-Signature', in: 'header', required: false, schema: string },
      ],
      requestBody: body(
        {
          event_id: { ...string, description: 'اجباری — بدون آن دفتر ضد تکرار نمی‌تواند replay را تشخیص دهد.' },
          authority: string,
          amount_minor: { type: 'integer', minimum: 0 },
          status: { type: 'string', enum: WEBHOOK_STATUSES },
          reference: nullable(string),
        },
        ['event_id', 'authority', 'amount_minor', 'status'],
      ),
      responses: {
        200: okResponse('رخداد پردازش شد', {
          received: boolean,
          status: { type: 'string', enum: ['processed', 'ignored', 'rejected'] },
          result: string,
        }),
        403: forbidden(),
        404: notFound(),
        409: conflict(),
        422: unprocessable(),
        429: rateLimited(),
        503: notConfigured(),
      },
    },
  },

  /* ── فاز ۱۸ — دادهٔ تجاری کاربر جاری ─────────────────────────── */

  '/api/v1/me/orders': {
    get: {
      tags: ['orders'],
      summary: 'سفارش‌های کاربر جاری',
      description: 'هیچ `userId` نمی‌پذیرد. فقط سفارش‌های خودِ سشن.',
      parameters: paginationQuery,
      responses: {
        200: okResponse('فهرست سفارش‌ها', { orders: refList('Order') }, pageMeta),
        401: unauthorized(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/me/orders/{id}': {
    get: {
      tags: ['orders'],
      summary: 'یک سفارش از کاربر جاری',
      description: 'سفارش کاربر دیگر ⇒ ۴۰۴ (نه ۴۰۳) تا وجودش لو نرود.',
      parameters: [pathId()],
      responses: {
        200: okResponse('سفارش', { order: ref('Order') }),
        401: unauthorized(),
        404: notFound(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/me/payments': {
    get: {
      tags: ['payments'],
      summary: 'پرداخت‌های کاربر جاری',
      parameters: paginationQuery,
      responses: {
        200: okResponse('فهرست پرداخت‌ها', { payments: refList('Payment') }, pageMeta),
        401: unauthorized(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/me/subscriptions': {
    get: {
      tags: ['subscriptions'],
      summary: 'اشتراک‌های کاربر جاری',
      description:
        'هم‌راستاسازی نمایشی: اشتراکی که `ends_at` آن گذشته و وضعیتش هنوز `active` است، اینجا `expired` گزارش می‌شود. دسترسی از قبل بسته است؛ این فقط گزارش را با واقعیت یکی می‌کند. عملیات idempotent است.',
      responses: {
        200: okResponse('فهرست اشتراک‌ها', { subscriptions: refList('Subscription') }),
        401: unauthorized(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/me/entitlements': {
    get: {
      tags: ['subscriptions'],
      summary: 'قابلیت‌های فعال کاربر جاری',
      description:
        'فقط خواندنی — هیچ مسیری entitlement نمی‌سازد یا لغو نمی‌کند. `active_capabilities` همان فهرستی است که Content از گیت می‌پرسد. `enforced:false` یعنی دروازه‌بانی هنوز روشن نشده و محتوا مثل قبل باز است (رفتار مستند).',
      responses: {
        200: okResponse('قابلیت‌ها', {
          entitlements: refList('Entitlement'),
          active_capabilities: { type: 'array', items: string },
          enforced: boolean,
        }),
        401: unauthorized(),
        429: rateLimited(),
      },
    },
  },

  /* ── فاز ۱۷ — پنل ────────────────────────────────────────────── */

  '/api/v1/admin/international/providers': {
    get: {
      tags: ['admin-intl'],
      summary: 'فهرست ناشران (پنل)',
      description: 'مجوز: `intl.read`. برخلاف مسیر عمومی، `status` فیلتر مجاز است.',
      parameters: [query('status', { type: 'string', enum: CONTENT_STATUS }), ...paginationQuery],
      responses: {
        200: okResponse('فهرست ناشران', { providers: refList('AdminInternationalProvider') }, pageMeta),
        401: unauthorized(),
        403: forbidden(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
    post: {
      tags: ['admin-intl'],
      summary: 'ساخت ناشر',
      description: 'مجوز: `intl.create`. ناشر همیشه `draft` ساخته می‌شود؛ انتشار گذار جداگانه دارد. `status` در بدنه پذیرفته نمی‌شود.',
      requestBody: body(
        {
          slug: { type: 'string', pattern: '^[a-z0-9-]+$', maxLength: 64 },
          name: { type: 'string', maxLength: 160 },
          name_en: nullable(string),
          kind: { type: 'string', enum: PROVIDER_KINDS },
          country: nullable(string),
          founded: nullable(string),
          description: nullable(string),
          focus: { type: 'array', items: string, maxItems: 6 },
          logo_media_id: nullable(uuid),
          sort_order: nullable(integer),
          marquee_order: nullable(integer),
        },
        ['slug', 'name'],
      ),
      responses: {
        201: okResponse('ناشر ساخته شد', { provider: ref('AdminInternationalProvider') }),
        401: unauthorized(),
        403: forbidden(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/admin/international/providers/{id}': {
    patch: {
      tags: ['admin-intl'],
      summary: 'ویرایش ناشر',
      description: 'مجوز: `intl.update`. PATCH جزئی است — هر فیلد غایب دست‌نخورده می‌ماند. `origin` هرگز از درخواست خوانده نمی‌شود.',
      parameters: [pathId()],
      requestBody: optionalBody({
        slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
        name: { type: 'string', maxLength: 160 },
        name_en: nullable(string),
        kind: { type: 'string', enum: PROVIDER_KINDS },
        country: nullable(string),
        founded: nullable(string),
        description: nullable(string),
        focus: { type: 'array', items: string, maxItems: 6 },
        logo_media_id: nullable(uuid),
        sort_order: nullable(integer),
        marquee_order: nullable(integer),
      }),
      responses: {
        200: okResponse('ناشر ویرایش شد', { provider: ref('AdminInternationalProvider') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/admin/international/providers/{id}/status': {
    post: {
      tags: ['admin-intl'],
      summary: 'گذار وضعیت ناشر',
      description: 'مجوز: `intl.publish`. نقشهٔ گذار در سرویس است: `draft ⇄ published`, `published → archived`, `archived → draft`. گذار نامجاز ⇒ ۴۰۹.',
      parameters: [pathId()],
      requestBody: body({ status: { type: 'string', enum: CONTENT_STATUS } }, ['status']),
      responses: {
        200: okResponse('وضعیت تغییر کرد', { provider: ref('AdminInternationalProvider') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: conflict(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/admin/international/courses': {
    get: {
      tags: ['admin-intl'],
      summary: 'فهرست دوره‌ها (پنل)',
      description: 'مجوز: `intl.read`.',
      parameters: [
        query('status', { type: 'string', enum: CONTENT_STATUS }),
        query('providerId', uuid),
        ...paginationQuery,
      ],
      responses: {
        200: okResponse('فهرست دوره‌ها', { courses: refList('AdminInternationalCourse') }, pageMeta),
        401: unauthorized(),
        403: forbidden(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
    post: {
      tags: ['admin-intl'],
      summary: 'ساخت دوره',
      description:
        'مجوز: `intl.create`. دوره همیشه `draft` ساخته می‌شود. `required_capability` باید یک قابلیت واقعی در `product_capabilities` باشد — وگرنه دوره‌ای ساخته می‌شود که هرگز باز نمی‌شود (قفل بی‌کلید) و همان‌جا ۴۲۲ می‌گیرد.',
      requestBody: body(
        {
          slug: { type: 'string', pattern: '^[a-z0-9-]+$', maxLength: 64 },
          provider_id: uuid,
          title: { type: 'string', maxLength: 160 },
          description: nullable(string),
          category: { type: 'string', enum: INT_CATEGORIES },
          level: nullable(string),
          tags: { type: 'array', items: string, maxItems: 8 },
          cover_media_id: nullable(uuid),
          accent: nullable(string),
          accent_soft: nullable(string),
          badge: nullable(string),
          duration_minutes: nullable(integer),
          total_duration_label: nullable(string),
          required_capability: { ...nullable(string), description: 'کد قابلیت فروشی؛ `null` یعنی رایگان.' },
          sort_order: nullable(integer),
        },
        ['slug', 'provider_id', 'title'],
      ),
      responses: {
        201: okResponse('دوره ساخته شد', { course: ref('AdminInternationalCourse') }),
        401: unauthorized(),
        403: forbidden(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/admin/international/courses/{id}': {
    patch: {
      tags: ['admin-intl'],
      summary: 'ویرایش دوره',
      description: 'مجوز: `intl.update`. PATCH جزئی.',
      parameters: [pathId()],
      requestBody: optionalBody({
        slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
        provider_id: uuid,
        title: { type: 'string', maxLength: 160 },
        description: nullable(string),
        category: { type: 'string', enum: INT_CATEGORIES },
        level: nullable(string),
        tags: { type: 'array', items: string, maxItems: 8 },
        cover_media_id: nullable(uuid),
        accent: nullable(string),
        accent_soft: nullable(string),
        badge: nullable(string),
        duration_minutes: nullable(integer),
        total_duration_label: nullable(string),
        required_capability: nullable(string),
        sort_order: nullable(integer),
      }),
      responses: {
        200: okResponse('دوره ویرایش شد', { course: ref('AdminInternationalCourse') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        422: unprocessable(),
        429: rateLimited(),
      },
    },
    delete: {
      tags: ['admin-intl'],
      summary: 'حذف فیزیکی دوره (فقط آرشیوشده)',
      description:
        'مجوز: `intl.delete`. دورهٔ آرشیونشده ⇒ ۴۰۹. چرا سخت‌گیر: حذف رکورد منتشرشده آدرس عمومی را می‌شکند و برگشت‌پذیر نیست. جدول‌های Commerce به این کاتالوگ FK ندارند، پس خطر مالی وجود ندارد.',
      parameters: [pathId()],
      responses: {
        200: okResponse('حذف شد', { deleted: boolean }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
        409: conflict(),
        429: rateLimited(),
      },
    },
  },

  '/api/v1/admin/international/courses/{id}/status': {
    post: {
      tags: ['admin-intl'],
      summary: 'گذار وضعیت دوره',
      description:
        'مجوز: `intl.publish`. انتشار دوره زیر ناشر منتشرنشده ⇒ ۴۰۹ (`PROVIDER_NOT_PUBLISHED`) — وگرنه انتشار دوره بی‌اثر می‌شد و UI دوره‌ای نشان می‌داد که هرگز دیده نمی‌شود.',
      parameters: [pathId()],
      requestBody: body({ status: { type: 'string', enum: CONTENT_STATUS } }, ['status']),
      responses: {
        200: okResponse('وضعیت تغییر کرد', { course: ref('AdminInternationalCourse') }),
        401: unauthorized(),
        403: forbidden(),
        404: notFound(),
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
  ['international', 'کاتالوگ دوره‌های بین‌الملل (فاز ۱۷) — ناشر/دوره؛ محتوا و آزمون از موتورهای موجود می‌آیند.'],
  ['pricing', 'قیمت‌گذاری (فاز ۱۸) — کاتالوگ و Quote؛ مبلغ فقط سمت سرور.'],
  ['orders', 'سفارش (فاز ۱۸) — قصد خرید، idempotent، مبلغ سرور-محور.'],
  ['payments', 'پرداخت (فاز ۱۸) — درگاه، تأیید و Webhook؛ entitlement فقط پس از تأیید.'],
  ['subscriptions', 'اشتراک و entitlement (فاز ۱۸) — فقط خواندنی برای کلاینت.'],
  ['admin-intl', 'مدیریت کاتالوگ بین‌الملل (فاز ۱۷) — مجوزهای واقعی `intl.*`.'],
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
  '\n\n**فاز ۱۷/۱۸ (International Courses + Commerce):** کاتالوگ بین‌الملل بدون موتور تازه — محتوا از Content Engine و آزمون از همان موتور آزمون با `kind=international`. Commerce با مبلغ **فقط** سمت سرور (واحد صحیح minor، بدون اعشار)، سفارش idempotent، درگاه آداپتوری با امضای HMAC، تطبیق مبلغ/ارز، دفتر ضد تکرار Webhook، و entitlement که **تنها پس از تأیید واقعی پرداخت و در یک تراکنش** صادر می‌شود. `checkout.enabled` و `entitlements.enforce` پیش‌فرض `false` هستند تا زمانی که قیمت واقعی تأیید و درگاه واقعی وصل شود — این رفتار صریح و مستند است، نه mock پنهان.';
spec.info.version = '1.9.0';

writeFileSync(FILE, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

const counts = Object.keys(spec.paths).length;
const operations = Object.values(spec.paths).reduce((sum, ops) => sum + Object.keys(ops).length, 0);

console.log(
  `openapi.v1.json → ${counts} paths / ${operations} operations / ${Object.keys(spec.components.schemas).length} schemas`,
);
