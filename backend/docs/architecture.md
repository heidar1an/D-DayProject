# معماری Backend تپش — فاز ۱ (Foundation)

مرجع اصلی: `docs/backend-blueprint-2026-10-02.md`. این سند فقط تصمیم‌های **اجرا/تاییدشدهٔ فاز ۱** را ثبت می‌کند، نه آرزوها.

## ۱. جایگاه در مهاجرت

- Node فعلی (`server.js` + فروشگاه JSON + `/api/*`) legacy backend است و **دست‌نخورده** مانده؛ تا cutover فعال می‌ماند.
- قرارداد جدید فقط روی `/api/v1/*` است. adapter مرز legacy (پوشش `{error:"CODE"}`) کارِ فازهای بعد با تست برابری است و هیچ‌وقت داخل business logic قرار نمی‌گیرد.
- OpenAPI فعلی (۲۳۰ عملیات/۱۶۶ path) مرجع legacy است و تغییری نکرده؛ نسخهٔ v1 جدا و از route/Request/Resource تولید خواهد شد.

## ۲. تصمیم‌های تثبیت‌شده

| تصمیم | وضعیت در فاز ۱ |
|---|---|
| Laravel 13 (PHP `^8.3`) / PostgreSQL system of record | ✅ اجرا و تست‌شده (PG 17.11) |
| Redis فقط برای cache/queue/rate-limit/session | ✅ آماده (predis؛ هیچ منطقی وابسته نیست) — driverهای پیش‌فرض فعلی `database` هستند تا وابستگی سخت ایجاد نشود |
| UUID PK برای جدول‌های دامنه | 📌 سیاست ثبت‌شده: مدل‌ها از `Illuminate\Database\Eloquent\Concerns\HasUuids` استفاده می‌کنند؛ هیچ جدول دامنه‌ای در این فاز ساخته نشده |
| Modular Monolith در یک process / یک DB | 📌 فاز ۱ app تخت است؛ ماژول‌های دامنه از فاز بعد زیر `app/<Domain>` یا `app/Modules/<Name>` با همین foundation سوار می‌شوند |

## ۳. لایه‌بندی هدف درخواست

```
Controller → FormRequest (ApiFormRequest) → Service/Action → Model → Resource
                                    ↑
                    ApiResponse (envelope) / ApiExceptionHandler
```

- Controllerهای چاق؛ منطق در Service/Action.
- هر endpoint جدید یک `FormRequest` از `App\Http\Requests\ApiFormRequest` می‌گیرد (خطا → ۴۲۲ استاندارد).
- هیچ endpointی خارج از `/api/v1` ساخته نمی‌شود.

## ۴. Envelope استاندارد v1

```jsonc
// موفق
{ "data": …, "meta": { … }?, "requestId": "uuid" }
// خطا
{ "error": { "code": "NOT_FOUND", "message": "…", "fields": {} }, "requestId": "uuid" }
```

- `requestId` = هدر `X-Request-Id` ورودی اگر با الگوی `[A-Za-z0-9._-]{8,64}` بخواند، وگرنه UUIDv4 تازه. به Context تزریق می‌شود → در **تمام** لاگ‌ها (`extra.request_id`) و **تمام** پاسخ‌ها (هدر + envelope) یکسان است.
- نگاشت status→code در `config/api.php` (۴۰۰/۴۰۱/۴۰۳/۴۰۴/۴۰۵/۴۰۹/۴۱۳/۴۱۵/۴۲۲/۴۲۹/۵۰۰/۵۰۳). کدها فقط توسعه می‌یابند، هرگز تغییر نام نمی‌گیرند.
- ۵xx هرگز جزئیات داخلی (کلاس/پیام/trace) نمی‌دهد؛ پیام همیشه «Internal server error.» است و جزئیات فقط در لاگ با همان requestId می‌ماند (تست‌شده).
- Endpoints سلامت شکل محدود خودشان را دارند (مجاز طبق Blueprint).

## ۵. میان‌افزار و لاگ

- `EnsureRequestId` **سراسری و بیرونی‌ترین** است تا خطاهای پیش از مسیریابی (مثلاً 413) هم شناسه داشته باشند.
- لاگ: کانال `api` (Monolog `JsonFormatter`، تک‌خطی، `storage/logs/api.log`) و `stderr_json` برای container. هیچ logger این پروژه query/بدنه/IP/UA ثبت نمی‌کند؛ در `ReadyzChecker` فقط نوع استثنا ثبت می‌شود، نه جواب کلاینت.

## ۶. دیتابیس و Redis

- مهاجرت‌های فاز ۱ فقط زیرساخت فریم‌ورک: `cache` و `jobs` (روی PG 17.11 اجرا/rollback/اجرای مجدد تایید شد). migration کاربرانِ پیش‌فرض اسکلت حذف شد تا فاز Auth جدول هویت را با شکل درست (UUID) بسازد.
- تراکنش/`DB::transaction` از فریم‌ورک؛ در فازهای بعد، Actionها روی آن سوار می‌شوند.
- Redis: کانکشن `cache` آماده و ping-پذیر؛ استفادهٔ واقعی از فازهای بعد.

## ۷. مرزهای تغییرنیافتنی (قانون فاز ۱)

`server.js`، `src/`، `docs/api/openapi.json`، `package.json` ریشه، `ci.yml` ریشه، `database/**` — همه دست‌نخورده. تنها افزودهٔ بیرون از `backend/`: `.github/workflows/backend-ci.yml`.
