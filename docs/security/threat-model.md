# Threat Model — تپش

تاریخ: ۲۰۲۶-۱۰-۰۱ · دامنه: `server.js` + `database/` + `src/` (کلاینت) · وضعیت: **پیش‌نویس — UNVERIFIED**

> چرا این سند وجود دارد: ممیزی فاز ۲۲.۰ خواستار threat model بود و سندی یافت نشد.
> این نسخه از **کد واقعی** استخراج شده، نه از فرض. هر ردیف کنترلش با ارجاع به فایل و
> وضعیت تأیید (`VERIFIED` = با تست/اجرا دیده شده · `CODE` = فقط در کد · `OPEN` = کنترل ندارد).
>
> این سند جایگزین تست نیست. ردیف‌های `OPEN` بدهی امنیتی‌اند، نه پذیرش ریسک.

## دارایی‌ها (Assets)

| دارایی | محل | حساسیت |
|---|---|---|
| هش رمز کاربران | `database/users.json` (untracked) | بحرانی |
| نشست‌های کاربری | `database/users.sessions.json` (untracked) | بالا |
| هش رمز ادمین‌ها | `database/content/admins.json` (**tracked**) | بحرانی |
| دادهٔ تحلیلی با IP/UA | `database/content/activity.json` (**tracked**) | بالا |
| کلیدهای سرویس بیرونی | `*.secrets.json` (۰۶۰۰) | بحرانی |
| بانک تست + کلید پاسخ | `database/content/testBankQuestions.json` | بالا |
| محتوای منتشرنشده | `database/content/{pages,articles,…}.json` | متوسط |
| آپلود رسانه | `public/uploads/` | متوسط |

## سطح حمله (Attack Surface)

| # | دارایی | تهدید | سطح حمله | احتمال | اثر | کنترل موجود | وضعیت |
|---|---|---|---|---|---|---|---|
| T-01 | هش رمز | brute force خارج از خط | `POST /api/users/login` | بالا | بالا | `scrypt$salt$hash` + `timingSafeEqual` + دو-سطل rate limit (۸/شناسه، ۳۰/IP در ۶۰s) | **VERIFIED** (`auth:test` ۷۸/۷۸ · e2e ۴۲۹) |
| T-02 | حساب کاربر | شمارش حساب (enumeration) | `login` · `register` · مسیر lookup | متوسط | متوسط | پاسخ یکسان `INVALID_CREDENTIALS` · حذف `GET /api/users?phone=` (۴۰۴) | **VERIFIED** (e2e) |
| T-03 | هش رمز | تصاحب حساب با هش قدیمی | migration | متوسط | بالا | تشخیص SHA-256 legacy + rehash هنگام login | CODE |
| T-04 | نشست | CSRF روی عملیات state-changing | همهٔ `POST/PUT/PATCH` کاربر | متوسط | بالا | `assertSameOrigin` (۷ نقطه) + `SameSite=Strict` + `HttpOnly` | **VERIFIED** (e2e: ۴۰۳ بدون `Origin`) |
| T-05 | نشست | سرقت کوکی | XSS / MITM | متوسط | بالا | `HttpOnly` · `Secure` شرطی (TLS واقعی / `NODE_ENV=production` / `x-forwarded-proto`) | CODE |
| T-06 | نشست | fixation / عدم انقضا | — | کم | متوسط | توکن تازه در هر ورود · `ttl` در `userSessions.js` | CODE |
| T-07 | پنل ادمین | escalation افقی/عمودی | `/api/admin/*` | متوسط | بحرانی | RBAC + deny-by-default + مجوزهای مرزی + تغییر نقش خودِ بازیگر ممنوع + آخرین مدیر کل ⇒ ۴۰۹ | **VERIFIED** (`admin:rbac:test` ۶۴/۶۴) |
| T-08 | مسیرهای ادمین | enumeration مسیر بدون احراز هویت | `/api/admin/<ناموجود>` | بالا | کم | — (**۴۰۴ پیش از سنجش نشست**) | **OPEN — یافتهٔ LOW** |
| T-09 | بانک تست | افشای `correctAnswer`/`explanation`/`answerKey` | `GET /api/public/…` | بالا | بالا | گارد نشت بافت‌محور `DTO_FORBIDDEN_EXTRA` | **VERIFIED** (`bank:test` ۴۰/۴۰) |
| T-10 | محتوای غنی | XSS ذخیره‌شده | editor → ذخیره → نمایش (۵ نقطهٔ `dangerouslySetInnerHTML`) | بالا | بالا | allowlist `ALLOWED_TAGS`/`ALLOWED_ATTRS` · **دور زدن با نقل‌قول بسته‌نشده رفع شد** (escape همهٔ `<`های متن) · `xss:test` با ۳۹ payload خصمانه · **۵ از ۵ sink در زمان رندر دوباره پاک می‌کنند** | **VERIFIED** (`xss:test` ۱۴/۱۴ · `bank:test` ۴۰/۴۰) |
| T-11 | سرّ سرویس | افشا در خطا یا لاگ | آداپترهای انتشار | متوسط | بالا | توکن در URL جاسازی می‌شود ولی هیچ‌جا `response.url` در خطا نیست؛ **`redact()` وجود ندارد** | OPEN (قرارداد نوشتاری) |
| T-12 | شبکهٔ داخلی | SSRF به متادیتا/loopback | آدرس پایهٔ publisher از env | متوسط | بالا | `publishers/urlGuard.js` روی ۴ آدرس پایه؛ پوشش IPv4 عددی/hex/octal و IPv6 | **VERIFIED** (`publish:guard:test` ۹) |
| T-13 | انتشار | ارسال تکراری | آداپترها | متوسط | متوسط | — (**retry/backoff و idempotency key ندارد**) | OPEN |
| T-14 | سرّ | افشا در تاریخچهٔ Git | `.git` | قطعی | بحرانی | `.gitignore` فقط آینده | **OPEN — CRITICAL** |
| T-15 | لاگ | افشای IP/UA/query/تلفن | لاگ دسترسی | متوسط | متوسط | `safePathname` + ممنوعیت صریح query/IP/UA/Cookie/بدنه | **VERIFIED** (`obs:test` · smoke) |
| T-16 | آپلود | فایل مخرب / مصرف حجم | `public/uploads/` | متوسط | متوسط | سقف بایت (۱MB کاربر، ۱۲MB ادمین، ۲۵۶KB آزمون) + `PAYLOAD_TOO_LARGE` | **VERIFIED** (e2e ۴۱۳) |
| T-17 | متریک | افشای مسیر/خطا | `/metrics` | کم | متوسط | فقط با `TAPESH_METRICS_TOKEN`؛ بدون توکن **۴۰۴ نه ۴۰۳** | **VERIFIED** (`obs:test` ۱۷) |
| T-18 | وابستگی | CVE | `node_modules` | متوسط | بالا | lockfile + `npm audit` | **VERIFIED** (۰ آسیب‌پذیری / ۲۰۹ وابستگی) |
| T-19 | پنل | abuse و اسپم | مسیرهای عادی پنل | متوسط | متوسط | **فقط login/register و مسیرهای بانک تست محدودند** | OPEN |
| T-20 | داده | فساد JSON | `content/*.json` | متوسط | بالا | write اتمیک + `storageCorruptionReport` + fail-closed | **VERIFIED** (`storage:test` ۶) |

## ردیف‌های باز (بدهی امنیتی)

| # | اقدام پیشنهادی | ریسک تغییر | نیازمند تأیید |
|---|---|---|---|
| T-08 | سنجش نشست **پیش از** lookup مسیر در روتر ادمین | متوسط (تغییر ترتیب ⇒ ممکن است مسیرهای عمومی ادمین بشکنند) | بله |
| T-10 | تست XSS روی هر ۶ نقطهٔ `dangerouslySetInnerHTML` | کم (تست تازه) | خیر |
| T-11 | افزودن `redact()` واقعی به‌جای قرارداد نوشتاری | کم | خیر |
| T-13 | idempotency key + retry/backoff در آداپترها | متوسط | بله |
| T-14 | `git rm --cached` + بازنویسی تاریخچه + reissue سرّها | بالا (تاریخچه) | **بله، صریح** |
| T-19 | rate limit برای مسیرهای عادی پنل | متوسط (خطر lockout کاربر واقعی) | بله |
