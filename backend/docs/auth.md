# احراز هویت v1 (فاز ۲)

مرجع قرارداد: `docs/openapi.v1.json` · کد: `app/Services/Identity/` · مسیرها: `routes/api.php`.

## اصل حاکم

**هویت فقط از سشن سرور می‌آید.** هیچ فیلدی در body/query/هدر نمی‌تواند بگوید
«من کاربر X هستم»، «نقشم ادمین است» یا «وارد شده‌ام». `GET /api/v1/me?userId=…`
هیچ اثری ندارد.

## مسیرها

| متد | مسیر | میان‌افزار | کد موفق |
|---|---|---|---|
| POST | `/api/v1/auth/register` | `api.session`, `api.origin`, `throttle:auth-register` | 201 |
| POST | `/api/v1/auth/login` | `api.session`, `api.origin`, `throttle:auth-login` | 200 |
| POST | `/api/v1/auth/logout` | `api.session`, `api.origin`, `api.csrf`, `throttle:auth-logout` | 200 |
| GET | `/api/v1/me` | `api.session`, `api.auth`, `throttle:me` | 200 |
| PATCH | `/api/v1/me` | `api.session`, `api.auth`, `api.origin`, `api.csrf`, `throttle:profile` | 200 |
| GET | `/api/v1/universities` | `api.session`, `throttle:universities` | 200 |

میان‌افزارها در `bootstrap/app.php` نام‌گذاری شده‌اند: `api.session` =
`ResolveApiSession` (اختیاری، سشن را می‌خواند) · `api.auth` = `RequireSessionUser`
(اجبار) · `api.origin` = `EnsureSameOrigin` (fail-closed روی نوشتن‌ها) ·
`api.csrf` = `EnsureCsrfToken` (double-submit).

## شکل پاسخ

```jsonc
// موفق
{ "data": { "user": { … } }, "requestId": "…" }
// خطا
{ "error": { "code": "INVALID_CREDENTIALS", "message": "…", "fields": {} }, "requestId": "…" }
```

`requestId` روی هر پاسخ (موفق و ناموفق) هست و با لاگ ساخت‌یافته یکی است.
`error.fields` فقط در ۴۲۲ پر می‌شود (`{ "field": ["CODE"] }`).

## ثبت‌نام — `POST /api/v1/auth/register`

ورودی: `phone` **یا** `email` (حداقل یکی)، `password`، و `profile` اختیاری.

1. نرمال‌سازی (`IdentityNormalizer`): ارقام فارسی/عربی → لاتین، `+98`/`0098`/`98`
   → `0…`، email و username → lowercase.
2. بررسی مقدماتی تکراری‌بودن (پیام یکسان برای جلوگیری از enumeration سطحی).
3. سیاست رمز (`PasswordPolicy`) — آینهٔ `database/authPolicy.js`.
4. هش با درایور پیکربندی‌شده (پیش‌فرض Argon2id).
5. در **یک تراکنش**: `users` + `user_profiles` + `auth_sessions`.
6. صدور کوکی سشن + CSRF ⇒ `201`.

تکراری‌بودن ⇒ `409 USER_ALREADY_EXISTS`. مسابقهٔ همزمان با `UniqueConstraintViolationException`
گرفته و به همان ۴۰۹ نگاشت می‌شود — نه ۵۰۰.

**`role=admin` نادیده گرفته نمی‌شود، رد می‌شود:** هر فیلد غیرمجاز
(`id`, `user_id`, `role`, `roles`, `permissions`, `is_admin`, `admin`,
`password_hash`, `entitlement(s)`, `email_verified_at`, `google_subject`,
`created_at`, `updated_at` و معادل‌های `profile.*`) با قاعدهٔ `prohibited`
⇒ `422 VALIDATION_FAILED`. هیچ کدی نقش را از ورودی نمی‌خواند.

## ورود — `POST /api/v1/auth/login`

ورودی: `identity` (شماره یا ایمیل) و `password`. نام قدیمی `phone` هم پذیرفته و
به `identity` نگاشت می‌شود.

- پاسخ ۴۰۱ برای «حساب نیست»، «رمز غلط» و «حساب فقط-گوگل» **کاملاً یکسان** است
  (`INVALID_CREDENTIALS` با همان `message` و همان `fields`).
- برای حساب ناموجود یک هش ساختگی verify می‌شود تا زمان پاسخ تفاوت نکند.
- ورود موفق ⇒ **rotation**: سشن قبلی باطل و سشن تازه صادر می‌شود (ضد fixation).
- پاسخ ورود همان شکل ثبت‌نام است (شامل `profile`).

## خروج — `POST /api/v1/auth/logout`

سشن فعلی در دیتابیس `revoked_at` می‌گیرد و کوکی‌ها پاک می‌شوند. **idempotent**:
بدون سشن هم `200 { data: { ok: true } }` می‌دهد.

## کاربر جاری — `GET /api/v1/me`

بدون سشن معتبر ⇒ `401 UNAUTHENTICATED`. خروجی هرگز شامل `password_hash`،
`google_subject`، توکن سشن، نقش یا مجوز نیست. `google_linked` یک boolean است،
نه خود شناسهٔ گوگل.

## ویرایش پروفایل — `PATCH /api/v1/me`

فقط فیلدهای فهرست سفید: `username`, `first_name`, `last_name`, `university_id`,
`university` (نام کامل → سرور خودش به `university_id` نگاشت می‌کند), `term`,
`grade`, `gender`, `birth_date_jalali`, `avatar_key`, `motivations`, `referrals`.

نام‌های قدیمی فرانت‌اند در `prepareForValidation` نگاشت می‌شوند:
`firstName`→`first_name` · `lastName`→`last_name` · `avatar`→`avatar_key` ·
`birthDate`→`birth_date_jalali` · `referralSources`/`referral_sources`→`referrals`.

**PATCH واقعی است:** فیلدهای ارسال‌نشده دست‌نخورده می‌مانند. بدنهٔ خالی ⇒ no-op با ۲۰۰.

ممنوع‌ها ⇒ `422`: `id`, `user_id`, `role`, `roles`, `permissions`, `is_admin`,
`admin`, `password_hash`, `password`, `password_confirmation`, `entitlement(s)`,
`email`, `phone`, `email_verified_at`, `google_subject`, `created_at`, `updated_at`.
تغییر شماره/ایمیل یک جریان تأیید جدا می‌خواهد و در فاز ۲ وجود ندارد.

`username` تکراری ⇒ `409 USERNAME_TAKEN`.

تفاوت عمدی: فیلدهای **ناشناختهٔ بی‌خطر** (مثل `admin_note`) نادیده گرفته می‌شوند و
ذخیره نمی‌شوند (۲۰۰)، ولی فیلدهای هویتی/مجوزیِ فهرست بالا با ۴۲۲ **رد** می‌شوند.
یک کلید اضافیِ بی‌ضرر نباید درخواست را بشکند، اما یک کلید خطرناک نباید بی‌صدا دور
ریخته شود — کاربر باید بفهمد که `role` پذیرفته نشد.

## کوکی‌ها

| نام | HttpOnly | محتوا |
|---|---|---|
| `tapesh_session` (قابل تغییر با `IDENTITY_SESSION_COOKIE`) | بله | توکن ۲۵۶ بیتی هگز |
| `tapesh_csrf` (قابل تغییر با `IDENTITY_CSRF_COOKIE`) | خیر | همان توکن CSRF که باید در هدر بیاید |

هر دو: `SameSite=Strict`، `Secure` در هر محیطی جز `local`، `Path=/`، `Max-Age` = عمر سشن.
جزئیات حمله/دفاع در `session-security.md`.

## CSRF

double-submit: مقدار کوکی `tapesh_csrf` باید در هدر `X-CSRF-Token` تکرار شود.
مقایسه با `hash_equals` روی **هشِ ذخیره‌شده** انجام می‌شود، نه مقدار خام.
عدم تطابق ⇒ `403 CSRF_FAILED`. `EnsureSameOrigin` هم پیش از آن Origin/Referer را
چک می‌کند (روی GET اعمال نمی‌شود).

## Rate limit

نام‌دار و از `config/identity.php` (هیچ عددی hardcode نیست). کلیدها HMAC آی‌پی
هستند (`ClientFingerprint::ipHash`)، نه IP خام.

| نام | پیش‌فرض | کلید |
|---|---|---|
| `auth-register` | ۵ در ۶۰ دقیقه | IP |
| `auth-login` | ۱۰ در ۱۵ دقیقه | identity+IP، و به‌علاوه ۳۰ در ۱۵ دقیقه برای کل IP |
| `auth-logout` | ۳۰ در ۱ دقیقه | IP |
| `me` | ۱۲۰ در ۱ دقیقه | IP |
| `profile` | ۲۰ در ۱ دقیقه | IP |
| `universities` | ۱۲۰ در ۱ دقیقه | IP |

سرریز ⇒ `429 RATE_LIMITED` با هدر `Retry-After`. این اعداد **پیش‌فرض پیشنهادی**
هستند، نه اندازه‌گیری‌شده؛ با `RATE_*` در `.env` تنظیم می‌شوند.

## رمزهای قدیمی (مهاجرت تدریجی)

فرمت‌های شناسایی‌شده در `PasswordHasher::algorithm()`:

| فرمت | تشخیص | verify |
|---|---|---|
| `argon2id$…` | پیشوند | درایور Argon2id |
| `$argon2i$…` / `$2y$…` | پیشوند | درایور متناظر |
| `scrypt$<saltHex>$<keyHex>` | پیشوند | `Scrypt::derive` خالص PHP (RFC 7914) |
| ۶۴ نویسهٔ هگز | طول+هگز | `hash('sha256', $password)` |

پس از **ورود موفق** با فرمت قدیمی، اگر `IDENTITY_REHASH_LEGACY=true` باشد، هش به
Argon2id ارتقا می‌یابد و `password_updated_at` به‌روز می‌شود. تا وقتی کاربر وارد
نشده، هش قدیمی دست‌نخورده می‌ماند — هیچ رمزی بازنشانی نمی‌شود و هیچ رمزی
لاگ نمی‌شود.

> پیاده‌سازی scrypt دستی است چون `sodium_crypto_pwhash_scryptsalsa208sha256_ll`
> در این build موجود نیست و تابع سطح‌بالا نمکِ ۱۶ بایتی legacy را نمی‌پذیرد.
> صحت با fixture واقعی Node تأیید شده (تطابق کامل).

## گوگل (فاز ۲: عمداً غیرفعال)

`GoogleIdentityProvider` یک interface است و بایندینگ همیشه
`UnconfiguredGoogleProvider` است که `503 FEATURE_NOT_CONFIGURED` می‌دهد.
**هیچ ورود ساختگی/mock ساخته نشده.** اگر روزی credential ست شود و پیاده‌سازی
واقعی نوشته نشده باشد، هنگام boot یک هشدار لاگ می‌شود (بدون لو دادن مقدار).

## هویت ادمین پنل (فاز ۳ — حداقلِ لازم برای فاز ۶)

`POST /api/v1/admin/auth/login` · `POST /api/v1/admin/auth/logout` ·
`GET /api/v1/admin/auth/me`

- **principal جدا:** `admins` جدول خودش را دارد و `auth_sessions` دقیقاً یکی از
  `user_id`/`admin_id` را پر می‌کند (قید `auth_sessions_principal_exclusive`).
  یک سشن دانشجو هرگز `$request->user()` را برای ادمین پر نمی‌کند و برعکس؛
  `RequireAdminSession` صریحاً `principal_type === admin` می‌خواهد.
- **کوکی همان کوکی سشن است**، ولی سشن‌ها دو principal جدا دارند. توکن خام هرگز
  در بدنه نمی‌آید.
- **پاسخ یکنواخت:** «ادمین نیست» و «رمز غلط» هر دو `401 INVALID_CREDENTIALS`
  هستند؛ با هش ساختگی، زمان پاسخ هم یکسان می‌شود (timing equalization).
- **حساب غیرفعال:** `active = false` ⇒ ورود رد می‌شود **و** سشن‌های باز هم بی‌اثر
  می‌شوند (چون `ResolveApiSession` هیچ attribute ای برای ادمین غیرفعال نمی‌نشاند).
- **RBAC:** مجوز فقط از نقش می‌آید (`admin_roles` → `role_permissions` →
  `permissions`). هیچ ستون `role`/`permission` روی ادمین نیست. deny-by-default:
  ادمین بدون نقش هیچ کاری نمی‌تواند بکند (۴۰۳).
- **کلیدهای مجوز واقعی‌اند** و کپی دقیق `PERMISSIONS` پنل legacy هستند
  (`testbank.*`, `comprehensive.*`, `articles.*`, …). هیچ کلید تازه‌ای برای این
  فاز اختراع نشد.
- `ADMIN_DENIED_PERMISSIONS` (`users.delete`, `users.superadmin.manage`,
  `settings.security.manage`) و `SENSITIVE_ANALYTICS` عیناً حفظ شده‌اند.
- **ساخت ادمین:** `php artisan tapesh:admin:create <username> --role=editor`
  (`AdminRbacSeeder` هیچ ادمینی نمی‌سازد — حساب با رمز قابل‌حدس در هر محیطی
  یک آسیب‌پذیری است).
- `password_hash` در `$fillable` و `$hidden` نیست؛ `AdminResource` آن را و
  `must_change_password` را برنمی‌گرداند. مجوزها برمی‌گردند چون پنل برای
  مخفی/نمایان کردن دکمه‌ها به آن‌ها نیاز دارد — ولی **اعتبارسنجی سمت سرور
  مستقل از این فهرست است**.
