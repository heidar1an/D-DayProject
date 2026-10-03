# راهنمای توسعه — TAPESH Backend (فاز ۱)

## ۱. نصب ابزارها (macOS / Homebrew)

```bash
brew install php composer redis postgresql@17
```

نسخه‌های تاییدشده در محیط این پروژه: PHP 8.5.11 · Composer 2.10.3 · Redis 8.10.2 · PostgreSQL 17.11.

⚠️ نکتهٔ macOS 26 (Tahoe): `sandbox-exec` با profileهای دارای `deny` با خطای `sandbox_apply: Operation not permitted` شکست می‌خورد؛ اگر `brew install` روی همین خطا ایستاد، علت محیط است نه فرمول. (در این پروژه یک‌بار با غیرفعال‌سازی موقت sandbox داخلی brew نصب شد و پچ بلافاصله بازگردانده و با shasum تایید شد.)

⚠️ نکتهٔ PG محلی: اگر `pg_ctl` با «postmaster became multithreaded» افتاد، قبل از start این را ست کنید: `export LC_ALL=en_US.UTF-8`.

## ۲. راه‌اندازی پروژه

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

### دیتابیس (PostgreSQL — system of record)

```bash
export LC_ALL=en_US.UTF-8
initdb -D /tmp/tapesh-pgdata -U <user> --auth=trust -E UTF8   # یک‌بار
pg_ctl -D /tmp/tapesh-pgdata -l /tmp/tapesh-pg.log -o "-p 5432" start
createdb tapesh
# در .env:  DB_CONNECTION=pgsql  DB_HOST=127.0.0.1  DB_PORT=5432  DB_DATABASE=tapesh  DB_USERNAME=<user>
php artisan migrate --force
```

برای توسعهٔ سریع بدون PG: `.env` را روی `DB_CONNECTION=sqlite` بگذارید (فایل `database/database.sqlite` خودکار ساخته می‌شود). staging/production همیشه PG است.

### Redis

```bash
redis-server --daemonize yes --save '' --appendonly no   # محلی/موقت
# یا سرویس دائم:  brew services start redis
# در .env:  REDIS_HOST=127.0.0.1  REDIS_PORT=6379  REDIS_CLIENT=predis
```

فاز ۱ هیچ منطقی به Redis وابسته نیست؛ فقط `readyz` در دسترس‌بودنش را می‌سنجد.

## ۳. اجرا

```bash
php artisan serve            # http://127.0.0.1:8000
curl http://127.0.0.1:8000/api/v1/healthz
curl http://127.0.0.1:8000/api/v1/readyz
```

(در محیط‌هایی که `curl` به loopback نمی‌رسد، از `node:http` استفاده کنید.)

## ۴. تست‌ها و سبک کد

```bash
php artisan test                                   # بدون سرویس هم سبز؛ تست‌های integration skip می‌شوند
TAPESH_TEST_PGSQL_HOST=127.0.0.1 TAPESH_TEST_PGSQL_DB=tapesh \
TAPESH_TEST_PGSQL_USER=<user> TAPESH_TEST_REDIS=1 php artisan test   # با سرویس واقعی
vendor/bin/pint --test                             # و در صورت نیاز: vendor/bin/pint
```

### اجرای کل سوییت روی PostgreSQL (بدون نصب سرویس دائمی)

```bash
backend/scripts/verify-on-pg.sh          # PG + Redis، ساخت و تخریب خودکار
WITH_REDIS=0 backend/scripts/verify-on-pg.sh
PG_PORT=55433 backend/scripts/verify-on-pg.sh
```

اسکریپت یک خوشهٔ موقت PG در `/tmp` و (در صورت وجود) یک Redis موقت بالا می‌آورد،
`migrate:fresh` → `rollback` → `migrate` را اجرا می‌کند، کل تست‌ها و Pint را
می‌گذراند، و **همیشه** — حتی روی خطا — سرویس‌ها را خاموش و `/tmp` را پاک می‌کند.
خروجی مرجع: **۲۷۰ passed / ۰ skipped / ۱۶۷۱ assertion** (هر دو تست integration باز).

⚠️ **`CACHE_STORE` را در تست‌ها روی `redis` نگذارید.** شمارنده‌های rate limit بین
تست‌ها باقی می‌مانند و ~۱۶۰ تست با ۴۲۹ قرمز می‌شوند (بدون هیچ باگ محصولی).
`phpunit.xml` عمداً `array` را قفل کرده است. برای تست Redis از
`TAPESH_TEST_REDIS=1` استفاده کنید که فقط `ServiceIntegrationTest` را باز می‌کند.

⚠️ **اجرای تست روی PostgreSQL اجباری است، نه تفننی.** در ۲۰۲۶-۱۰-۰۳ همین اجرا
**۴ باگ PG-only** بیرون داد که روی SQLite سبز بودند (نوع `uuid`، ترتیب
`primary key` نسبت به FK، abort شدن تراکنش، تایم‌زون `timestamptz`).
`.github/workflows/backend-ci.yml` هم دو اجرا دارد: SQLite و PG+Redis.

## ۵. Docker (وقتی در دسترس شد)

```bash
cd backend
cp .env.example .env        # DB_PASSWORD واقعی + APP_KEY
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8080/api/v1/readyz
```

وضعیت فعلی: IMPLEMENTED-BUT-UNVERIFIED (docker در محیط توسعهٔ این پروژه نصب نیست).

## ۶. قواعد کار روزمره

- `.env` را هرگز commit نکنید؛ الگوی جدید فقط به `.env.example` اضافه می‌شود.
- کد جدید: Controller → `ApiFormRequest` → Service/Action → Model/Resource؛ پاسخ فقط با `ApiResponse`.
- error code جدید فقط با افزودن به `config/api.php` (تغییر نام ممنوع).
- لاگ: فقط `Log::…(message, array)`؛ بدون body/IP/UA/secret. هر رکورد خودش `request_id` دارد.
- پیش از پول: `php artisan test` + `vendor/bin/pint --test` سبز.
