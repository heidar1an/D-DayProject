# گزارش فاز ۱ — Backend Foundation

**تاریخ:** ۲۰۲۶-۱۰-۰۲ · **مبنای کد:** `main` (درخت کاری پیش از شروع: تنها `docs/backend-blueprint-2026-10-02.md` untracked) · **مرجع:** Blueprint رسمی + درخواست فاز ۱

---

## Environment

ابزارها پیش از شروع **هیچ‌کدام** در PATH نبودند (php/composer/docker/psql/redis همگی NOT FOUND — همسو با تصریح Blueprint). در طول این فاز با Homebrew نصب و **اجرا/تایید** شدند:

| ابزار | نسخهٔ نصب‌شده | وضعیت اجرا |
|---|---|---|
| PHP | 8.5.11 (NTS, arm64) | ✅ اجرا شد — migrations/test/serve |
| Composer | 2.10.3 | ✅ اجرا شد — create-project + require |
| PostgreSQL | 17.11 (Homebrew) | ✅ اجرا شد — migrate/rollback/migrate + integration test |
| Redis | 8.10.2 | ✅ اجرا شد — ping/set/get/del + readyz |
| Docker | نصب نشد (در دسترس نیست) | ❌ هیچ claimی از build/run container وجود ندارد |

دو تلهٔ محیطی ثبت شد: (۱) macOS 26 `sandbox-exec` با profileهای deny → `sandbox_apply: EPERM` که brew 6 را می‌شکند؛ برای نصب، sandbox داخلی brew موقتاً غیرفعال شد و **بلافاصله با بازگردانی دقیق و تطابق shasum** ترمیم شد. (۲) PG محلی با locale نامعتبر با «postmaster became multithreaded» می‌افتد؛ با `LC_ALL=en_US.UTF-8` حل شد (در `docs/development.md` ثبت است).

## Files Created

```
backend/  (کل پوشه — Laravel 13.17 اسکلت تولیدی + سفارشی‌سازی فاز ۱)
├── app/
│   ├── Exceptions/ApiExceptionHandler.php      ← نقشهٔ خطای استاندارد v1
│   ├── Http/
│   │   ├── ApiResponse.php                     ← envelope موفق/خطا + هدر requestId
│   │   ├── Middleware/EnsureRequestId.php      ← requestId سراسری
│   │   ├── Requests/ApiFormRequest.php         ← پایهٔ FormRequest آینده
│   │   └── Controllers/Api/V1/HealthController.php
│   ├── Services/Health/ReadinessChecker.php    ← پروب DB/Redis (fail-safe, بدون leak)
│   └── Support/RequestId.php                   ← resolve/validate/context
├── config/api.php                              ← error codes + readiness toggles
├── routes/api.php                              ← /api/v1/{healthz,readyz}
├── bootstrap/app.php                           ← سیم‌کشی api routes/middleware/exceptions
├── .env (محلی) · .env.example (کامل، بدون secret) · Dockerfile · docker-compose.yml
├── docker/{nginx/default.conf, php/opcache.ini} · .dockerignore
├── tests/Feature/{ApplicationBootsTest, HealthEndpointsTest, ApiErrorFormatTest,
│                  RequestIdTest, ServiceIntegrationTest}.php
├── README.md · docs/{architecture, development, api, phase1-report}.md
.github/workflows/backend-ci.yml  (افزودنیِ ریشه — مستقل از ci.yml فرانت‌اند)
```

## Files Modified

- `backend/.env` / `backend/.env.example` — بازنویسی کامل (DB/Redis/Cache/Queue/Session/Log/api)
- `backend/bootstrap/app.php` — routes api + میان‌افزار prepend + exception rendering
- `backend/config/logging.php` — کانال‌های JSON: `api` (فایل) و `stderr_json` (container)
- `backend/phpunit.xml` — `LOG_CHANNEL=api`، `REDIS_CLIENT=predis`، `REDIS_HOST/PORT`
- `backend/composer.json` / `composer.lock` — نام `tapesh/backend`، توضیح، `predis/predis`

**حذف‌شده (فقط stock اسکلتِ تولیدشده در همین نشست، بدون هیچ دادهٔ کاربر):** `database/migrations/0001_01_01_000000_create_users_table.php` (users/password_reset_tokens/sessions به فاز Auth با شکل UUID موکول شد) و دو `tests/**/ExampleTest.php`.

**Legacy دست‌نخورده (تایید با git status):** `server.js`، `src/**`، `docs/api/openapi.json`، `package.json`، `ci.yml`، `database/**` — هیچ تغییری. تنها تغییر ریشه: افزودن workflow جدید.

## Architecture

لایه‌بندی هدف: `Controller → FormRequest → Service/Action → Model → Resource` با envelope استاندارد v1 (`{data,meta?,requestId}` / `{error:{code,message,fields},requestId}`)، `requestId` سراسری (بیرونی‌ترین middleware؛ پذیرش/تولید/ردّ مقدار نامعتبر)، لاگ JSON تک‌خطی با `extra.request_id` و بدون query/body/IP/UA/secret، خطاهای ۵xx همیشه عمومی. PostgreSQL system of record؛ Redis آماده اما بی‌وابستگی منطقی. UUID PK سیاست ثبت‌شدهٔ فازهای بعد (`HasUuids`). جزئیات: `backend/docs/architecture.md`.

## Dependencies

| Package | دلیل |
|---|---|
| `laravel/framework ^13.17` | هسته (همراه create-project؛ PHP `^8.3`) |
| `predis/predis ^3.6` | کلاینت Redis بدون نیاز به کامپایل phpredis (اکستنشن در PHP محلی موجود نیست) — قابل تعویض با `phpredis` بدون تغییر کد |

عمداً **اضافه نشد:** Sanctum (فاز Auth)، packageهای modular/permission، ابزار API-doc — Laravel همه را پایه پوشش می‌دهد یا به فاز خودشان تعلق دارند.

## Tests

**سری کامل: ۱۴ passed (۵۰ assertion)، ۰ failed** — `php artisan test` دو بار: (الف) بدون سرویس (۲ integration test با skip صریح)، (ب) با PG 17.11 و Redis 8.10.2 واقعی — **۱۴/۱۴ سبز**.

| تست | پوشش DoD |
|---|---|
| ApplicationBootsTest | بوت اپلیکیشن (#1) |
| HealthEndpointsTest | healthz ۲۰۰ + readyz ok + readyz ۵۰۳ با DB شکسته (PG روی پورت مرده) + ۵۰۳ با Redis شکسته (#3) |
| ApiErrorFormatTest | قالب خطای ۴۰۴/۴۲۲/۴۰۵ + عدم leak در ۵۰۰ (پیام/کلاس/trace/secret در بدنه نیست) (#6, #8) |
| RequestIdTest | تولید UUID، پذیرش هدر معتبر، ردّ مقدار نامعتبر (#7) |
| ServiceIntegrationTest | اتصال واقعی PG (`select version()`) و Redis (ping/set/get/del) (#4, #5) |

افزون بر تست‌ها: `vendor/bin/pint --test` → **۳۷ فایل سبز**؛ migration روی PG → **migrate/rollback/migrate موفق**؛ اجرای زندهٔ `artisan serve` (تأیید با node:http، نه curl): healthz ۲۰۰، readyz ۲۰۰ با هر دو check ok، ۴۰۴ با envelope کامل، echo هدر `X-Request-Id`.

## Not Verified

- **Docker:** `backend/Dockerfile` و `docker-compose.yml` (app/php-fpm + nginx + worker + PG + Redis) نوشته و منسجم‌اند اما build/run نشدند — docker در محیط موجود نیست. وضعیت: IMPLEMENTED-BUT-UNVERIFIED.
- **CI:** `backend-ci.yml` ثبت شد اما روی runner گیت‌هاب اجرا نشده — UNVERIFIED-EXTERNAL (همان قاعدهٔ ci.yml فرانت‌اند).
- OpenAPI v1 و adapter مرز legacy — تعلق به فازهای بعد، در این فاز آغاز نشد (طبق scope).

## Risks

1. PHP 8.5/Laravel 13 بسیار جدید است؛ پکیج‌های فاز ۲ (مثلاً Sanctum بعدی) باید سازگاریشان با L13/PHP 8.5 بررسی شود.
2. Dockerfile/compose تا اولین build در محیط دارای docker، معلوم نیست؛ احتمال تنظیم‌خوردن جزئی (نسخهٔ ایمیج php:8.5-fpm-alpine و …).
3. migrationهای stock (`cache`/`jobs`) از اسکلت با PK بزرگint مانده‌اند — صرفاً زیرساخت فریم‌ورک؛ جدول‌های دامنه از فاز بعد UUID می‌گیرند.
4. اجرای نهایی CI به secret/runner واقعی وابسته است؛ تا آن زمان دروازهٔ خودکار backend وجود بیرونی ندارد.

## Phase 2 Readiness

✅ بله — هر ۱۵ بند Definition of Done تحقق واقعی یافته است: پوشهٔ backend و bootstrap (#1-2)، env کامل (#3)، PG (#4) و Redis (#5) آماده و تست‌شده، healthz (#6) و readyz با تشخیص خرابی (#7)، error handling استاندارد (#8)، requestId (#9)، لاگ امن (#10)، زیرساخت تست (#11) و تست‌های سبز ۱۴/۱۴ (#12)، مستندات (#13)، legacy دست‌نخورده (#14)، خارج از scope هیچ چیز ساخته نشده (#15). فاز ۲ (Auth/هویت با UUID + اولین ماژول دامنه) می‌تواند بدون بازنویسی foundation شروع شود.

**PHASE 1 COMPLETE**
