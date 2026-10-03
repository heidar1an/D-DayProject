# داده‌های کاربر و دادهٔ مرجع (فاز ۲)

مایگریشن‌ها: `database/migrations/2026_10_02_0001xx…0005xx` · مدل‌ها: `app/Models/` ·
سرویس‌ها: `app/Services/Identity/`.

## مرز فاز ۲

فقط پنج موجودیت: `users`, `user_profiles`, `universities`, `semesters`,
`auth_sessions`. هیچ جدول دوره/آزمون/پرداخت/نقش اینجا نیست.

## `users` — هویت

| ستون | نوع | نکته |
|---|---|---|
| `id` | uuid PK | `HasUuids` |
| `phone` | varchar(20), nullable, **unique** | نرمال‌شده `0XXXXXXXXXX` |
| `email` | varchar(190), nullable, **unique** | lowercase |
| `email_verified_at` | timestamp, nullable | فاز ۲ تأییدی انجام نمی‌دهد |
| `password_hash` | varchar(255), nullable | **نام ستون `password` نیست** — تا مسیرهای پیش‌فرض Laravel که رمز خام را هش می‌کنند اشتباه نروند |
| `google_subject` | varchar(255), nullable, unique | شناسهٔ بیرونی؛ در `$hidden` |
| `password_updated_at` | timestamp, nullable | با هر تغییر/ارتقای هش |
| `created_at`, `updated_at` | timestamp | |

قیود:
- `users_identity_present`: `phone IS NOT NULL OR email IS NOT NULL OR google_subject IS NOT NULL`
  — کاربر بدون هیچ هویتی در سطح دیتابیس ممنوع است.
- یکتایی روی مقدار **نرمال‌شده** است، نه خام: «۰۹۱۲…» و «0912…» یک هویت‌اند.

`$fillable` فقط `phone`, `email`, `email_verified_at`, `password_updated_at`.
`password_hash` و `google_subject` عمداً بیرون‌اند و فقط با `forceFill` (سرویس‌ها)
ست می‌شوند.

## `user_profiles` — پروفایل (یک‌به‌یک)

`user_id` **unique** ⇒ یک‌به‌یک در سطح دیتابیس. `ON DELETE CASCADE` از `users`.
`university_id` → `universities` با `ON DELETE SET NULL` (حذف یک ردیف مرجع نباید
پروفایل کاربر را از بین ببرد).

ستون‌ها: `username`(32, unique), `first_name`(60), `last_name`(60), `term`(8),
`grade`(80), `birth_date_jalali`(10), `gender`(20), `avatar_key`(8),
`motivations`(json), `referrals`(json).

دادهٔ پروفایل **داخل `users` نیست**: خواندن احراز هویت نباید به دادهٔ تکاملی
وابسته شود.

## `universities` — دادهٔ مرجع

`slug`(64, unique), `name`(160), `active`(bool), ایندکس `['active','name']`.

seed: ۶۱ دانشگاه واقعی استخراج‌شده از `src/services/league/mockData.js`
(`database/seeders/data/universities.php`) با `updateOrCreate` ⇒ **idempotent**.
هیچ دانشگاه حدسی ساخته نشده.

## `semesters` — آماده، بی‌داده

`number`(smallint), `degree`(32), `academic_year`(9), `active`, unique
`['number','degree','academic_year']`.

**هیچ seed و هیچ endpointی ندارد.** فهرست واقعی مقاطع تثبیت نشده و Blueprint
صریحاً seed حدسی را ممنوع کرده؛ schema آماده است تا فاز دوره‌ها روی آن بسازد.

## `auth_sessions` — سشن سرور

| ستون | نوع | نکته |
|---|---|---|
| `id` | uuid PK | |
| `principal_type` | varchar(16) | `user` یا `admin` |
| `user_id` | uuid, nullable, FK cascade | |
| `admin_id` | uuid, nullable | فاز ۳ پر می‌کند؛ FK ندارد چون جدول ادمین وجود ندارد |
| `token_hash` | char(64), unique | **SHA-256 توکن؛ هرگز توکن خام** |
| `csrf_hash` | char(64) | هش توکن CSRF |
| `expires_at` | timestamp **NOT NULL** | سشن بی‌انقضا ممنوع |
| `last_seen_at` | timestamp, nullable | throttle‌شده (۵ دقیقه) |
| `revoked_at` | timestamp, nullable | |

قید `auth_sessions_principal_exclusive`: **دقیقاً یکی** از `user_id`/`admin_id`
پر است — نه هیچ‌کدام، نه هر دو.

هیچ ستون IP/User-Agent وجود ندارد.

## نرمال‌سازی (`IdentityNormalizer`)

| ورودی | خروجی | چرا |
|---|---|---|
| `۰۹۱۲…`, `٠٩١٢…` | `0912…` | در پروژهٔ قدیمی دو حساب متفاوت می‌ساخت |
| `+98912…`, `0098912…`, `98912…` | `0912…` | یک شماره = یک هویت |
| `User@Example.COM` | `user@example.com` | یکتایی case-insensitive |
| `Aria.H` (username) | `aria.h` | یکتایی case-insensitive |
| `۴` (term) | `4` | قرارداد رشتهٔ رقمی |

ترتیب اجباری: `normalize → validate → persist`. هیچ مقایسه یا یکتایی‌ای پیش از
نرمال‌سازی انجام نمی‌شود.

## `GET /api/v1/universities`

عمومی (بدون ورود). پارامترهای مجاز **فقط**: `search`, `page`, `per_page`, `sort`.
هر پارامتر دیگری (`q`, `filter`, `order`, …) با `prohibited` ⇒ ۴۲۲.

- فقط `active = true` برمی‌گردد.
- `per_page` پیش‌فرض ۲۵، سقف ۱۰۰.
- `sort` = `name` (پیش‌فرض) یا `-name`/`slug`/`-slug`؛ هر چیز دیگری به `name` می‌افتد.
- جست‌وجو با binding پارامتری و escape نویسه‌های `\ % _` درون مقدار ⇒ نه SQL
  injection، نه اینکه `%`ِ کاربر الگوی کامل شود.
- نتیجه ۳۰۰ ثانیه کش می‌شود (کلید = هش پارامترها). تغییر seed ⇒ حداکثر ۵ دقیقه تأخیر.

```jsonc
{
  "data": [ { "id": "…", "slug": "…", "name": "…" } ],
  "meta": { "page": 1, "perPage": 25, "total": 61, "lastPage": 3 },
  "requestId": "…"
}
```

## مالکیت داده — قاعدهٔ گذار

تا **cutover** اعلام‌نشده:

- **سرور Node نویسندهٔ اصلی است.** `server.js`, `database/usersApi.js`,
  `database/models/`, `database/persistence/` دست‌نخورده می‌مانند.
- **دو نویسندهٔ همزمان روی دادهٔ کاربر ممنوع است.** Laravel روی دیتابیس خودش
  (PostgreSQL) می‌نویسد و به فایل‌های `database/*.json` دست نمی‌زند.
- هیچ migration داده‌ای از JSON به PostgreSQL در این فاز اجرا نشده و هیچ اسکریپت
  مهاجرت داده نوشته نشده — این کار فاز جداگانه با تأیید صریح است.

## یکپارچگی

- ثبت‌نام: `users` + `user_profiles` + `auth_sessions` در **یک تراکنش**.
- مسابقهٔ همزمان روی یکتایی با `UniqueConstraintViolationException` گرفته می‌شود و
  به ۴۰۹ نگاشت می‌شود (نه ۵۰۰).
- خطای هیچ نوشتنی بی‌صدا بلعیده نمی‌شود.
