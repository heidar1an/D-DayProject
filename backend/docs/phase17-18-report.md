# گزارش فاز ۱۷ و ۱۸ — International Courses + Commerce/Payments/Subscriptions/Entitlements

> تاریخ: ۲۰۲۶-۱۰-۰۳ · Laravel 13.34 / PHP 8.5.11 · PostgreSQL (سیستم حقیقت) + SQLite (تست)
> الگو: Controller نازک → FormRequest → Service/Action → Model → Resource
> وضعیت: **فاز ۱۷ و ۱۸ انجام شد** — ۹۰۴ تست سبز (۹٬۰۷۲ assertion) در سوییت کامل

## ۰. دو قید طلایی که کل طراحی را شکل داد

| قید | نتیجهٔ عملی |
| --- | --- |
| **موتور محتوا تکرار نشود** (§۹/§۱۲/§۱۴) | هیچ جدول/سرویس `international_lessons`/`international_pages`/`international_questions`/`international_exam_engine` ساخته نشد. فصل/درس/صفحه از Content Engine موجود و آزمون از همان `exams` با `kind = international` سرو می‌شود. سه مسیر موازی (`.../chapters`، `.../exams`، `.../attempts`) عمداً ساخته **نشدند** و دلیلش در کامنت کنترلر و در سند OpenAPI ثبت است. |
| **بک‌اند منبع حقیقت پول است** (§۲۲/§۳۰/§۵۲) | `create`/`quote`/`start` هیچ پارامتر مبلغی در امضا ندارند. نه `amount`، نه `price`، نه `discount`، نه `currency`، نه `paid`. اگر کلاینت بفرستد، به `validated()` راه نمی‌یابد. سه تست مستقل این را می‌سنجند. |

## ۱. فایل‌های ساخته‌شده

### Config (۲)
- `backend/config/international.php` — statuses، provider kinds، ۷ دستهٔ دوره، pagination (سقف `per_page`)
- `backend/config/commerce.php` — `checkout.enabled=false`، `entitlements.enforce=false` (هر دو پیش‌فرض خاموش و مستند)، currency whitelist (`IRT`/`IRR`)، `minor_units=0` (تومان اعشار ندارد)، `orders.ttl_minutes/max_seats/max_open_per_user`، نگاشت چرخه (۱→monthly، ۳→quarterly، ۱۲→yearly)، آداپتور `sandbox` + محل اتصال `zarinpal` (**غیرفعال**)، نردبان صندلی گروهی، rate limitها. **هیچ Secret در فایل نیست.**

### Migration (۲)
- `2026_10_03_001500_create_international_courses_tables.php` — `international_providers` (slug UNIQUE، kind CHECK، focus jsonb، logo_media_id FK، status/origin) + `international_courses` (slug **یکتای سراسری**، provider_id FK RESTRICT، `required_capability` NULL=رایگان، cover_media_id FK، **بدون ستون `progress`**)
- `2026_10_03_001600_create_commerce_tables.php` — `products` (UNIQUE sku)، `product_capabilities` (UNIQUE(product_id,code))، `plans` (UNIQUE code، `price_minor` bigint، approved_at، pricing_rules jsonb، UNIQUE(product_id,cycle_months))، `orders` (quote_snapshot jsonb + CHECK `(status='paid')=(paid_at is not null)`)، `order_lines`، `payments` (UNIQUE authority/provider_reference + CHECK `(status='verified')⟷verified_at`)، `payment_webhooks` (UNIQUE(provider,event_id))، `subscriptions`، `entitlements` (CHECK پنجرهٔ معتبر)

مسیر دوگانه با trait موجود `CreatesPortableTables`: SQLite با CHECK/UNIQUE/FK inline، PostgreSQL با `Schema::create` + `addCheck()`. **همهٔ FK جدول‌های پولی `RESTRICT` هستند** (تغییرناپذیری مالی، §۷۷).

### Model (۱۰)
`InternationalProvider`، `InternationalCourse` (`scopePubliclyVisible`، `isPremium`) · `Product`، `ProductCapability`، `Plan` (`isPurchasable`، `scopeVisibleInCatalog`)، `Order` (`isPayable`/`isExpired`/`TERMINAL`)، `OrderLine`، `Payment` (`isVerified`) — با CHECK `(status='verified')⟷verified_at` —، `PaymentWebhook`، `Subscription` (`isEffective`، `scopeEffective`)، `Entitlement` (`isActive`، `scopeActive`) — همگی `HasUuids`، `$fillable = []` (mass assignment بسته)، نوشتن فقط با `forceFill` از سرویس.

### Service (۱۲)
- `Commerce/Gateway/PaymentGateway` (interface) · `SandboxGateway` — **امضای واقعی HMAC-SHA256** (`verify|{authority}|{amount}` و `webhook|{event_id}|{authority}|{amount}|{status}`)، Secret خالی ⇒ ۵۰۳ (هرگز مقدار پیش‌فرض حدس‌زدنی) · `GatewayManager` (zarinpal ⇒ 503 `notConfigured`)
- `Commerce/PricingService` — `resolvePlan`، `assertPurchasable`، `quote()` (آینهٔ عین‌به‌عین الگوریتم `pricingService.js`)، `catalog()`، `checkoutState()`
- `Commerce/OrderService` — `create` (idempotent)، نقشهٔ گذار `TRANSITIONS` (شامل `pending → paid` برای race قانونی webhook)، `transition`، `cancel`، `findOwned` (۴۰۴)
- `Commerce/PaymentService` — `start` (بازپخش تراکنش باز)، `verify`، `handleWebhook`، `finalize` (**تراکنش طلایی**)، تطبیق مبلغ/ارز
- `Commerce/SubscriptionService` — `activateFromOrder` (تمدید از انتهای دورهٔ فعلی)، `revoke` (cascade به entitlement)
- `Commerce/EntitlementService` — `has`، `isGateable` (فهرست بستهٔ `product_capabilities`)، `grantFromOrder` (idempotent + تمدید)، `revoke`/`revokeFromOrder`/`revokeFromSubscription`، `expireLapsedSubscriptions`
- `Content/CommerceEntitlementGate` — جانشین `NullEntitlementGate`؛ تا `enforce=false` همیشه `true`
- `International/InternationalCatalogService` — خواندن عمومی + CRUD پنل + گذار وضعیت + `capabilityAccess`/`assertAccessible`

### Controller (۶) · Request (۱۰) · Resource (۸)
`InternationalCourseController` (فقط providers/courses/showCourse) · `Admin/AdminInternationalController` (CRUD ناشر/دوره + status + delete) · `PricingController` · `OrderController` · `PaymentController` · `MeCommerceController`

Requestها: `International/*` (۵) و `Commerce/*` (۵ — **هیچ‌کدام فیلد مبلغی ندارند**؛ `StoreOrderRequest extends QuoteRequest` چون سفارش همان «قصد تأییدشده» است).

Resourceها: `InternationalProviderResource`/`InternationalCourseResource` (با `locked`)، `AdminInternational*Resource` (۲)، `OrderResource`/`OrderLineResource`، `PaymentResource`، `SubscriptionResource`، `EntitlementResource` — **هیچ‌کدام `user_id` نمی‌دهند**.

### Provider (۲) و مسیرها (۲۴)
`InternationalServiceProvider` + `CommerceServiceProvider` (bind گیت + ۷ rate limiter نام‌دار با کلید `admin:{id}`/`user:{id}`/`ip:HMAC`)؛ ثبت در `bootstrap/providers.php`. `LearningServiceProvider` binding قدیمی گیت را از دست داد (یک منبع حقیقت).

۲۴ مسیر تازهٔ v1: کاتالوگ عمومی (۳)، پنل بین‌الملل (۹)، قیمت‌گذاری (۲)، سفارش (۲)، پرداخت (۳)، دادهٔ کاربر (۵).

### تست (۴ فایل — ۵۹ تست)
| فایل | تعداد | چه چیزی قفل می‌کند |
| --- | --- | --- |
| `International/InternationalCatalogTest.php` | ۱۹ | انتشار (پیش‌نویس ۴۰۴ نه ۴۰۳)، دسترسی پرمیوم از entitlement، آزمون بین‌الملل روی همان موتور |
| `Commerce/PricingTest.php` | ۹ | الگوریتم quote (تطابق با فرانت)، نردبان صندلی، نادیده‌گرفتن کامل مبلغ کلاینت، ۴۲۲/۴۰۴، عدم لو رفتن Secret |
| `Commerce/OrderTest.php` | ۱۲ | مبلغ سرور-محور، idempotency واقعی (بازپخش + ۴۰۹)، IDOR ۴۰۴، گذارهای پایانی، سقف سفارش باز، «هیچ مسیری سفارش را paid نمی‌کند» |
| `Commerce/PaymentTest.php` | ۱۹ | **تراکنش طلایی**، idempotency verify، امضای جعلی/غایب/مبلغ‌ناهم‌خوان، webhook معتبر بدون سشن، replay، امضای نامعتبر بی‌اثر، `AMOUNT_MISMATCH`، authority ناشناس، provider ناشناس، تعارض event_id، race webhook-then-verify، انقضای entitlement بدون Cron، **باز شدن دورهٔ پرمیوم پس از پرداخت واقعی** |

`tests/Concerns/BuildsCommerce.php` — ساخت داده با مدل (برای حالت‌های مرزی) ولی **پرداخت از مسیر واقعی درگاه** با امضای واقعی HMAC.

## ۲. فایل‌های تغییر‌یافته

| فایل | تغییر |
| --- | --- |
| `backend/routes/api.php` | ۲۴ مسیر تازهٔ v1 + import کنترلرها |
| `backend/bootstrap/providers.php` | ثبت دو provider (+ `use`) |
| `backend/app/Services/Content/EntitlementGate.php` + `NullEntitlementGate.php` | توضیح به‌روز (binding به Commerce منتقل شد) |
| `backend/tests/Feature/ApiV1ContractTest.php` | فاز ۱۷/۱۸ به فهرست دامنهٔ اعلام‌شده، ۲۸ سطر ماتریس وضعیت، **۲ محافظ معکوس تازه** |
| `backend/docs/openapi.v1.json` | bump به **1.9.0** — **۱۸۲ path / ۲۲۲ operation / ۱۰۹ schema** |
| `scripts/v1-frontend-contract.mjs` | ۳ پل تازه در `ADAPTERS`، ۱۵ schema در `CONSUMED`، ۴ ردیف `NESTED`، ۶ ردیف `FORBIDDEN_IN_PUBLIC` |

## ۳. سه ناوردایی که با تست ثابت شده‌اند

### ۳.۱ تراکنش طلایی (§۴۹)
`PaymentService::finalize()` تنها جایی است که `paid` نوشته می‌شود و تنها جایی که entitlement صادر می‌شود. هر چهار اثر (پرداخت verified + سفارش paid + اشتراک + entitlement) در **یک** `DB::transaction` با `lockForUpdate` انجام می‌شوند. پس «paid بدون entitlement» ممکن نیست — و تست `test_verify_is_idempotent_and_never_grants_a_second_entitlement` + `test_webhook_first_then_verify_converges_to_a_single_entitlement` هر دو مسیر race را می‌بندند.

### ۳.۲ ضد تکرار در **دیتابیس**، نه در کد (§۷۱/§۷۲)
سه قید یگانه هم‌زمان کار می‌کنند: `payments.authority`، `payments.provider_reference`، `payment_webhooks(provider,event_id)`. بررسی «قبلاً دیدم؟» در کد race-safe نیست، پس منبع حقیقت DB است. `IdempotencyService` هم `UNIQUE(scope,actor_key,request_key)` دارد و INSERT داخل savepoint بسته می‌شود (تلهٔ PG `25P02`).

### ۳.۳ دسترسی از `ends_at` بسته می‌شود، نه از Cron (§۷۵)
`ends_at` هر entitlement از `subscription.ends_at` کپی می‌شود؛ `scopeActive` خودبه‌خود آن را نادیده می‌گیرد. تست `test_expired_entitlement_no_longer_unlocks_the_course` فقط زمان را جلو می‌برد و نشان می‌دهد دوره دوباره قفل می‌شود — **بدون هیچ Job و بدون refresh سمت کلاینت**.

## ۴. انحراف‌های مستند (آگاهانه)

| موضوع | تصمیم | چرا |
| --- | --- | --- |
| `checkout.enabled=false` و `entitlements.enforce=false` پیش‌فرض | خاموش | تا قیمت واقعی تأیید و درگاه واقعی وصل نشده، هیچ راه قانونی برای گرفتن entitlement وجود ندارد. روشن‌کردن enforcement از امروز، محتوا را برای همهٔ کاربران فعلی بی‌دلیل می‌بست. **این رفتار صریح و مستند است، نه mock پنهان** (§۱۱). |
| `enforce` فقط قابلیت‌های `product_capabilities` را می‌بندد | فهرست بسته | `content.lesson_page` که `ProgressService` می‌پرسد دروازه‌بانی **نمی‌شود** ⇒ روشن‌کردن enforcement محتوای امروز را قفل نمی‌کند. |
| درگاه `zarinpal` ساخته نشد | فقط محل اتصال | آداپتور بدون merchant واقعی و بدون قیمت تأییدشده، کد مرده است. `SandboxGateway` با **امضای واقعی HMAC** جریان را کامل و قابل‌تست می‌کند. |
| سقف صندلی گروهی توزیع نمی‌شود | `Subscription` برای خریدار فعال می‌شود | تخصیص دسترسی به اعضای گروه یک Use Case جدا با مالکیت دامنهٔ Group است و UI ندارد (§۶۱). تعداد صندلی در snapshot سفارش ثبت است. |
| `Order.status = failed` پایانی است | `failed → paid` وجود ندارد | پرداخت شکست‌خورده نیازمند سفارش تازه است؛ گذار معکوس، تاریخچهٔ مالی را مبهم می‌کند (§۳۵). |
| مسیر ادمین برای آزمون بین‌الملل ساخته نشد | — | پنل فعلی CRUD آزمون ندارد؛ قاعدهٔ فاز ۷ («endpoint بی‌مصرف ساخته نشود») دست‌نخورده است. |

## ۵. فرانت‌اند — سه پل v1 (فاز ۱۷/۱۸)

| پل | پوشش |
| --- | --- |
| `src/services/pricing/pricingV1.js` | `fetchPricingCatalog`، `fetchPricingQuote`، `toLegacyQuote` (نگاشت به شکل `pricingService.quote()`)، `createPricingV1Reader` |
| `src/services/commerce/commerceV1.js` | `createOrder`، `cancelOrder`، `startPayment`، `verifyPayment`، **`startCheckout`** (جریان کامل)، `fetchMyOrders/Payments/Subscriptions/Entitlements`، `hasCapability` |
| `src/services/international/internationalV1.js` | خواندن عمومی (providers/courses/course) + **پنل** (list/upsert/status/delete)، `createInternationalV1Source` |

⚠️ **UI روی این پل‌ها سوئیچ نشده است** — مثل بقیهٔ پل‌های v1 پروژه. نگاشت‌ها ساخته و با قرارداد قفل شده‌اند ولی importها در cutover عوض می‌شوند تا تغییر اتمی باشد.

**نکتهٔ مهم برای cutover:** v1 عمداً `sections`/`lessons` نمی‌دهد (مالکیت Content Engine). پس این پل `sections` ساختگی نمی‌سازد؛ `serverIntl` به‌عنوان لایهٔ **افزودنی** روی کاتالوگ محلی می‌نشیند و `dataStatus.intlServer` منبع داده را صادقانه اعلام می‌کند (`connected`/`unavailable`/`error`/`empty`). اتصال فصل‌ها به Content API کارِ cutover است.

### قفل قرارداد فرانت (`scripts/v1-frontend-contract.mjs`)
**۱۲ پل / ۱۰۸ بررسی — ۰ شکست.** افزوده‌های این فاز:
- `FORBIDDEN_IN_PUBLIC`: `Order`/`Payment`/`Subscription`/`Entitlement` **نباید `user_id` داشته باشند**؛ `InternationalCourse`/`InternationalProvider` نباید `status`/`origin`/`legacy_id`/`progress` داشته باشند. اگر روزی کسی مالکیت یا چرخهٔ عمر را به payload عمومی اضافه کند، تست می‌شکند.
- `CONSUMED`/`NESTED`: ۱۵ schema تازه (قیمت، سفارش، پرداخت، اشتراک، دسترسی، بین‌الملل) + چهار ساختار تودرتو (`Order.lines`، `Subscription.plan`، `InternationalCourse.provider`، `AdminInternationalCourse.provider`).

## ۶. قرارداد OpenAPI v1 — 1.9.0

```
۱۸۲ path / ۲۲۲ operation / ۱۰۹ schema
```
ساخته‌شده با `backend/scripts/build-openapi-v1-phase17-18.mjs` (idempotent، همان الگوی فازهای قبل). دو نکتهٔ عمدی در سند:
- مسیرهای موازی ساخته‌نشده **مستند نشدند** (سند نباید چیزی وعده دهد که وجود ندارد).
- Webhook صریحاً «بدون سشن/Origin/CSRF» توصیف شده تا مصرف‌کننده فکر نکند سند ناقص است.

`ApiV1ContractTest` (۱۶ تست) دوطرفه بودن را قفل می‌کند: هر مسیر واقعی مستند است، هر مسیر مستندشده وجود دارد، و **هیچ دامنهٔ تکرارشده‌ای** ساخته نشده (محافظ رجکس روی `international/*/{chapters,lessons,pages,questions,exams,attempts}` و روی مسیرهای «paid/grant/revoke»).

## ۷. تأیید

| سنجه | نتیجه |
| --- | --- |
| سوییت کامل بک‌اند (SQLite) | **۹۰۴ passed · ۲ skipped · ۹٬۰۷۲ assertion · ۴۷.۷s** |
| سوییت کامل بک‌اند (**PostgreSQL واقعی**) | **۹۰۵ passed · ۱ skipped · ۹٬۰۷۳ assertion · ۷۸.۸s — صفر شکست** |
| تست‌های تازهٔ فاز ۱۷/۱۸ | ۵۹ تست (۱۹ + ۹ + ۱۲ + ۱۹) — همه سبز |
| `ApiV1ContractTest` | ۱۶ passed (۳٬۶۹۶ assertion) |
| قرارداد فرانت v1 | ۱۲ پل / ۱۰۸ بررسی / ۰ شکست |
| OpenAPI v1 | ۱۸۲ path / ۲۲۲ operation — هم‌گام با `routes/api.php` |
| build:check:static | سبز |
| Pint (فایل‌های این فاز) | ۵ تخلف سبک اصلاح شد ⇒ سهم این فاز صفر |
| تست رابط کاربری | **اجرا نشد** (طبق درخواست) |

### ۷.۱ یک باگ PG-only که در همین تأیید پیدا و اصلاح شد

`OrderService::persist()` سقف سفارش باز را با `->lockForUpdate()->count()` می‌سنجید. روی PostgreSQL این کوئری **رد می‌شود**:

```
SQLSTATE[0A000]: FOR UPDATE is not allowed with aggregate functions
```

SQLite این را بی‌صدا قبول می‌کند ⇒ تست‌ها سبز بودند ولی ۲۶ تست روی PG قرمز می‌شدند. بدتر از خطا، **بی‌اثری قفل** بود: `FOR UPDATE` روی مجموعهٔ **خالی** هیچ ردیفی قفل نمی‌کند، پس سقف زیر هم‌زمانی واقعاً بسته نمی‌شد.

**اصلاح:** قفل روی ردیف **مالک** (`User::query()->whereKey($user->getKey())->lockForUpdate()->first()`) و سپس شمارش بدون lock. یک نقطهٔ سریال‌سازی درست به‌ازای هر کاربر، کوئری ارزان، و بدون خطای PG. مدرک: پیش از اصلاح ۲۷ شکست روی PG، پس از اصلاح **صفر**.
 |

## ۸. بدهی‌های باز (صریح)

۱. **درگاه واقعی وصل نشده.** `zarinpal` فقط محل اتصال است. تا `PAYMENT_GATEWAY=zarinpal` + `ZARINPAL_ENABLED=true` + merchant واقعی نباشد، هیچ پرداخت واقعی‌ای انجام نمی‌شود.
۲. **قیمت واقعی تأیید نشده.** `commerce.seed_prices` از env می‌آید و عمداً پیش‌فرض ندارد؛ اگر تنظیم نشود، طرح بدون `approved_at` ساخته می‌شود و `purchasable:false` می‌ماند.
۳. **UI سوئیچ نشده.** سه پل ساخته و قفل شده‌اند؛ cutover اتمی باقی است. برای بین‌الملل، اتصال `sections` به Content Engine بخشی از همان cutover است.
۴. **توزیع صندلی گروهی** ساخته نشد (§۶۱) — نیازمند Use Case با مالکیت دامنهٔ Group.
۵. **تست هم‌زمانی واقعی روی PG** اجرا نشد؛ مسیرهای race در سطح منطق (webhook-then-verify، verify-then-webhook، replay) با SQLite پوشش داده شده‌اند. تأیید روی PG از مسیر `backend/scripts/verify-on-pg.sh` قابل تکرار است.
۶. **`audit_logs` برای عملیات مالی** ثبت نمی‌شود (فاز ۱۹/۲۰ دامنهٔ Audit را ساخته است)؛ `PaymentService` فقط لاگ ساختاریافته می‌نویسد. اتصال به Audit دامنه یک کار تازه است.
