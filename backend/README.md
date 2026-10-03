# TAPESH Backend — فاز ۱ تا ۲۴ (As-Built)

پایهٔ Laravel/PostgreSQL تپش برای مهاجرت تدریجی از Node legacy.

- **مرجع وضعیت واقعی:** `../docs/backend-blueprint-2026-10-03.md` (نسخهٔ As-Built با اعداد اندازه‌گیری‌شده).
- **مرجع تصمیم‌های اولیه:** `../docs/backend-blueprint-2026-10-02.md` (سند طرح پیش از پیاده‌سازی — **کهنه**؛ بر مبنای آن تصمیم نگیرید).
- Node legacy (`server.js` + `/api/*`) **دست‌نخورده** و تا cutover **تنها نویسندهٔ داده** است (Zero Dual Writer).
- قرارداد جدید فقط روی `/api/v1/*` ساخته می‌شود — **۲۲۴ عملیات ثبت‌شده**؛ صفر مسیر legacy در Laravel.
- OpenAPI legacy (`docs/api/openapi.json`) تغییر نکرده است.

## وضعیت فازها

| فاز | دامنه |
|---|---|
| ۱ | Foundation: boot، envelope خطا، `requestId`، health/ready، لاگ JSON |
| ۲ | Identity: ثبت‌نام/ورود/خروج/me/پروفایل/دانشگاه، سشن سرور، CSRF/Origin، rate limit، مهاجرت رمز legacy |
| ۳–۴ | Admin/RBAC + Content core — در زمان خودشان وجود نداشتند و **حداقل لازم در جریان فاز ۵–۶** ساخته شد |
| ۵–۸ | Learning · QuestionBank · Exam Engine · Analytics |
| ۹–۱۲ | Flashcards · Wiki · Knowledge Graph |
| ۱۳–۱۴ | GreenPath · League/Gamification (XP ledger تغییرناپذیر) |
| ۱۵–۱۶ | Media/References/Anatomy · Articles/Notes/Review/Groups/Feedback |
| ۱۷–۱۸ | International · Commerce (مبلغ سرور-محور، `PaymentService::finalize` تنها صادرکنندهٔ entitlement) |
| ۱۹–۲۰ | Outbox + Notifications + Search + پنل کامل مدیریت |
| ۲۱ | AI Mentor — fail-closed؛ provider واقعی وصل نیست ⇒ `۵۰۳ FEATURE_NOT_CONFIGURED` (بدون mock) |
| ۲۲ | Migration/Cutover tooling + **rehearsal واقعی روی DB موقت**؛ مهاجرت production **انجام نشد** |
| ۲۳ | Security Hardening |
| ۲۴ | Performance/Production — **NOT VERIFIED** (staging وجود ندارد؛ هیچ بهینه‌سازی‌ای بدون baseline انجام نشد) |

گزارش تفصیلی هر فاز: `docs/phase*-report.md` · قرارداد: `docs/openapi.v1.json` (۱.۱۰.۰ — ۱۸۴ path / ۲۲۴ عملیات / ۱۱۱ schema).

## Requirements (نسخه‌های تاییدشدهٔ این پروژه)

| ابزار | نسخهٔ تاییدشده | نقش |
|---|---|---|
| PHP | 8.5.11 (نیازمندی: `^8.3`) | runtime |
| Laravel | ^13.17 | framework |
| Composer | 2.10.3 | dependency |
| PostgreSQL | 17.11 | system of record |
| Redis | 8.10.2 | cache/queue/rate-limit |
| Docker | — | اختیاری؛ در محیط توسعهٔ فعلی در دسترس نیست |

## Quick Start

```bash
cd backend
composer install
cp .env.example .env          # سپس: php artisan key:generate
php artisan migrate           # با DB_CONNECTION=sqlite پیش‌فرضِ توسعهٔ سریع
php artisan db:seed           # ۶۱ دانشگاه واقعی (idempotent؛ هیچ کاربر تستی نمی‌سازد)
php artisan serve             # http://127.0.0.1:8000/api/v1/healthz
```

اتصال PostgreSQL (پیش‌نهاد برای هر محیطی جدی‌تر از توسعهٔ محلی):

```bash
# مقادیر .env:  DB_CONNECTION=pgsql  DB_HOST=127.0.0.1  DB_PORT=5432
#               DB_DATABASE=tapesh   DB_USERNAME=…      DB_PASSWORD=…
createdb tapesh
php artisan migrate --force
```

Redis فقط باید در دسترس باشد (برای `readyz` و rate limit در محیط چند-پروسه):

```bash
redis-server --daemonize yes
```

## API v1

| متد | مسیر | ورود لازم | توضیح |
|---|---|---|---|
| GET | `/api/v1/healthz` | — | liveness |
| GET | `/api/v1/readyz` | — | readiness (DB/Redis) |
| POST | `/api/v1/auth/register` | — | ثبت‌نام ⇒ ۲۰۱ + کوکی سشن |
| POST | `/api/v1/auth/login` | — | ورود ⇒ ۲۰۰ + rotation سشن |
| POST | `/api/v1/auth/logout` | اختیاری | باطل‌کردن سشن + پاک‌کردن کوکی (idempotent) |
| GET | `/api/v1/me` | بله | کاربر جاری |
| PATCH | `/api/v1/me` | بله | ویرایش پروفایل (whitelist) |
| GET | `/api/v1/universities` | — | فهرست دانشگاه‌های فعال + pagination |

بقیهٔ ۲۱۶ عملیات در سایر دامنه‌ها (learning، questions، exams، flashcards، wiki، knowledge، green-path، league، media، articles، notes، groups، feedback، search، notifications، international، pricing، orders، payments، subscriptions، ai و ۹۶ مسیر `/admin/*`) در `docs/openapi.v1.json` و پیوست الف سند As-Built فهرست شده‌اند.

شکل پاسخ: `{ "data": …, "requestId": "…" }` برای موفق و
`{ "error": { "code", "message", "fields" }, "requestId": "…" }` برای خطا.
شرح: `docs/auth.md` · `docs/users.md` · `docs/session-security.md` · `docs/architecture.md`.

## مدل سشن

سشن **سرور-کنترل‌شده** است. کلاینت فقط یک توکن ۲۵۶ بیتی در کوکی `HttpOnly`
(`tapesh_session`) دارد؛ سرور فقط `SHA-256` آن را در `auth_sessions.token_hash`
نگه می‌دارد. هر سشن `expires_at` دارد (پیش‌فرض ۷ روز، تمدید لغزان)، با
`last_seen_at` (throttle ۵ دقیقه) و `revoked_at`. ورود ⇒ rotation (سشن قبلی باطل،
تازه صادر می‌شود). CSRF با double-submit روی کوکی `tapesh_csrf` و هدر
`X-CSRF-Token`؛ Origin/Referer روی هر نوشتن fail-closed چک می‌شود.

هویت **هرگز** از body/query نمی‌آید: `GET /api/v1/me?userId=…` هیچ اثری ندارد.

## مدل پروفایل

`user_profiles` یک‌به‌یک با `users` است (`user_id` unique، cascade delete).
دادهٔ پروفایل داخل `users` نیست. `PATCH /api/v1/me` فقط فیلدهای whitelist را
می‌پذیرد (`first_name`, `last_name`, `username`, `university_id`, `term`, `grade`,
`gender`, `birth_date_jalali`, `avatar_key`, `motivations`, `referrals`) و
نام‌های قدیمی فرانت‌اند (`firstName`, `avatar`, `birthDate`, `referralSources`)
را نگاشت می‌کند. `role`/`permissions`/`password_hash`/`phone`/`email` ⇒ ۴۲۲.

## مهاجرت رمزهای قدیمی

هش‌های `scrypt$salt$hash` (RFC 7914) و SHA-256 قدیمی هنگام ورود شناسایی و
verify می‌شوند. پس از **ورود موفق**، اگر `IDENTITY_REHASH_LEGACY=true` باشد هش به
Argon2id ارتقا می‌یابد. تا وقتی کاربر وارد نشده هش قدیمی دست‌نخورده می‌ماند —
هیچ رمزی بازنشانی یا لاگ نمی‌شود. پیاده‌سازی scrypt دستی است (توضیح در `docs/auth.md`).

## Environment

- همهٔ مقادیر از `.env` می‌آید؛ `.env` هرگز commit نمی‌شود (الگوی کامل: `.env.example` با **۱۰۲ کلید**).
- پایه: `APP_ENV` / `APP_DEBUG` / `APP_URL`، `DB_*`، `REDIS_*`، `CACHE_STORE`، `QUEUE_CONNECTION`، `SESSION_DRIVER`، `LOG_CHANNEL`، `READYZ_CHECK_DATABASE` / `READYZ_CHECK_REDIS`.
- هویت: `IDENTITY_HASH_DRIVER`، `IDENTITY_PASSWORD_MIN/MAX`، `IDENTITY_REHASH_LEGACY`،
  `IDENTITY_SESSION_TTL_MINUTES`، `IDENTITY_SESSION_COOKIE`، `IDENTITY_CSRF_COOKIE`،
  `IDENTITY_CSRF_HEADER`، `IDENTITY_COOKIE_SECURE`، `IDENTITY_COOKIE_SAME_SITE`،
  `IDENTITY_ENFORCE_ORIGIN`، `IDENTITY_COOKIE_DOMAIN`.
- rate limit: `RATE_*` برای auth/profile/universities · صف و outbox: `QUEUE_*`، `OUTBOX_*` · اعلان: `NOTIFICATIONS_*` · جست‌وجو: `SEARCH_*` · ادمین/audit/settings: `ADMIN_*`، `AUDIT_*`، `SETTINGS_*`.
- گیت‌های خاموش (عمدی و مستند): `COMMERCE_CHECKOUT_ENABLED=false`، `commerce.entitlements.enforce=false`، `AI_ENABLED=false`، `AI_EXTERNAL_PROCESSING_APPROVED=false`.
- گوگل: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`.
  **هیچ پیاده‌سازی واقعی وجود ندارد** — provider همیشه `UnconfiguredGoogleProvider`
  است و `503 FEATURE_NOT_CONFIGURED` می‌دهد. ست‌کردن credential به‌تنهایی ورود گوگل
  را روشن نمی‌کند (هشدار لاگ می‌شود).
- لاگ پیش‌فرض: JSON تک‌خطی در `storage/logs/api.log` (کانال `api`)؛ در container از `LOG_CHANNEL=stderr_json` استفاده کنید. هر رکورد `request_id` دارد؛ هیچ logger این پروژه body/پسورد/توکن/IP/UA ثبت نمی‌کند.

## Running Tests

```bash
php -d memory_limit=1024M artisan test   # سقف حافظه اجباری است (پایین را بخوانید)
vendor/bin/pint --test                    # سبک کد

# اجرای کامل با سرویس‌های واقعی:
TAPESH_TEST_PGSQL_HOST=127.0.0.1 TAPESH_TEST_PGSQL_DB=tapesh \
TAPESH_TEST_PGSQL_USER=… TAPESH_TEST_REDIS=1 php artisan test
```

نتیجهٔ اندازه‌گیری‌شدهٔ آخرین اجرا (۲۰۲۶-۱۰-۰۳): **۹۱۲ passed، ۲ skipped، ۰ failed (۹٬۴۰۹ assertion)** در ۴۷.۵ ثانیه.
`php vendor/bin/phpunit --list-tests` = **۹۱۴ تست تعریف‌شده**. دو skipped همان تست‌های
سرویس‌محور هستند که PostgreSQL/Redis زنده می‌خواهند.

⚠️ **بدون سقف حافظه، سوییت ناقص تمام می‌شود:** اجرای پیش‌فرض یک‌بار وسط کار با
`Fatal error: Premature end of PHP process` (در `Gamification/LeagueAndXpTest`) می‌افتد.
همیشه `php -d memory_limit=1024M artisan test`.

⚠️ **Pint سبز نیست:** ۶۹۷ فایل بررسی می‌شود و ۳۶ تخلف سبک در فایل‌های خارج از دامنهٔ
فازهای اخیر وجود دارد ⇒ گام `pint --test` در CI فعلاً قرمز است.

تأیید روی PostgreSQL واقعی (بدون سرویس دائمی، خوشهٔ موقت در `/tmp`):

```bash
./scripts/verify-on-pg.sh
```

## Health Endpoints

| Endpoint | معنا | پاسخ |
|---|---|---|
| `GET /api/v1/healthz` | liveness — اپلیکیشن زنده است | `200 {"status":"ok","requestId":…}` |
| `GET /api/v1/readyz` | readiness — وابستگی‌ها بررسی می‌شوند | `200` همه ok / `503` با `checks.*.status=fail` |

(`health: '/up'` فریم‌ورک هم فعال است؛ صرفاً bootstrap check.)

جزئیات قرارداد: `docs/api.md`

## Architecture Summary

- Modular Monolith هدف است؛ لایه‌بندی `Controller → FormRequest → Service/Action → Model → Resource`.
- envelope استاندارد v1 (موفق/خطا) + error codes پایدار + `requestId` سراسری.
- **۲۹ دامنهٔ سرویس** زیر `app/Services/`؛ controller‌ها نازک‌اند و هیچ‌کدام مستقیماً روی مدل نمی‌نویسند.
- **زنجیرهٔ واقعی middleware روی مسیرهای ادمین:** `api → api.session → api.audit → api.admin → throttle:<domain>_admin → api.origin → api.csrf → api.can:<permission>` — deny-by-default با **۴۰ کلید permission** و **۷۹ limiter نام‌دار**.
- **۸۶ جدول دامنه‌ای** از ۳۴ migration؛ جداسازی کلید پاسخ در `question_keys`، ضد تکرار در DB (`payments.authority`، `payment_webhooks(provider,event_id)`، `idempotency_keys`)، و ledgerهای تغییرناپذیر بدون `updated_at`.
- جزئیات کامل: `docs/architecture.md` · راه‌اندازی: `docs/development.md` · فهرست گزارش فازها: `docs/phase*-report.md`.

## یکپارچگی با فرانت‌اند

**۱۲ پل** بین سرویس‌های فرانت و `/api/v1` وجود دارد و قراردادشان قفل شده است:
`src/services/api/v1.js` + `src/services/*/*V1.js` (commerce، flashcards، learning/progress،
wiki، league، greenPath، testBank، knowledge، exam، pricing، international).
نگاشت `snake_case → camelCase` داخل همان پل انجام می‌شود تا هیچ کامپوننتی عوض نشود.

قفل قرارداد: `node scripts/v1-frontend-contract.mjs` ⇒ **۱۰۸ بررسی سبز / ۰ شکست**.

⚠️ **UI هنوز روی legacy است** — پل‌ها ساخته و تست شده‌اند ولی سوئیچ UI انجام نشده
(عمدی: با provider/gate خاموش، UI می‌شکست). این سوئیچ بخشی از cutover است.

## Docker

`docker-compose.yml` در همین پوشه: `app` (php-fpm) + `nginx` + `worker` (queue) + `postgres:17` + `redis:8` با healthcheck. ⚠️ در محیط توسعهٔ فعلی build نشده — IMPLEMENTED-BUT-UNVERIFIED (دلیل: docker در دسترس نیست).

## CI

`.github/workflows/backend-ci.yml` (ریشهٔ مخزن): Pint + migrate check روی PostgreSQL واقعی + کل سری تست‌ها با سرویس‌های postgres/redis. مستقل از `ci.yml` فرانت‌اند. ⚠️ UNVERIFIED-EXTERNAL تا اولین اجرا روی runner.

## بدهی باز (خلاصه)

`backend/` در git tracked نیست (بدون شبکهٔ نسخه‌بندی برای rollback کد) · Pint سبز نیست ·
UI روی v1 سوئیچ نشده · staging وجود ندارد · درگاه پرداخت و provider واقعی AI وصل نیستند ·
۱۴ جدول Media/publishing و `site_pages`/`banners` ساخته نشده‌اند · مهاجرت production و
cutover انجام نشده (فقط rehearsal). فهرست کامل با اولویت: بخش ۹ سند As-Built.
