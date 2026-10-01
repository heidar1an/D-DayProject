# TEST-RESULTS — فازهای ۲۱–۲۳

اجرا: ۲۰۲۶-۱۰-۰۱ · Node `22.22.2` (مسیر مطلق) · شاخه `main` @ `a86d875` · سندباکس محلی

## ۱. اجرای مرجع: `node scripts/verify-all.mjs`

- **کد خروج: ۰** · **نتیجه: سبز** · **گام‌های سبز: ۲۶/۲۶** · **زمان کل: ۴۲۶٫۷ ثانیه**
- لاگ‌های کامل: `.workbuddy-ai/phase-logs/verify-all.log` (۲۳ گام) · `verify-all-24.log` (۲۴) · `verify-all-25.log` (۲۵) · **`verify-all-26.log` (۲۶ — مرجع)**
- `data:check` گام اول (پیش‌پرواز) · snapshot/restore در پایان

| # | سوییت | exit | مدت | شمارش |
|---|---|---|---|---|
| ۱ | `data:check` | ۰ | ۵٫۱s | ۰ خطا |
| ۲ | `data:test` | ۰ | ۳۷٫۷s | — |
| ۳ | `auth:test` | ۰ | ۱۰٫۴s | ۷۸ قبول · ۰ رد |
| ۴ | `bank:test` | ۰ | ۲۰٫۱s | ۴۰/۴۰ |
| ۵ | `xss:test` **(تازه)** | ۰ | ۱۹٫۶s | ۱۴/۱۴ |
| ۶ | `exam:test` | ۰ | ۴٫۸s | ۲۷/۲۷ |
| ۷ | `domain:test` | ۰ | ۱٫۳s | `duration_ms 1253` |
| ۸ | `planning:test` | ۰ | ۴٫۹s | ۳۴ موفق · ۰ ناموفق |
| ۹ | `admin:test` | ۰ | ۳۷٫۴s | ۹۲/۹۲ |
| ۱۰ | `admin:rbac:test` | ۰ | ۲۹٫۶s | ۶۴/۶۴ |
| ۱۱ | `admin:security:test` | ۰ | ۲۷٫۷s | ۶۰/۶۰ |
| ۱۲ | `api:test` | ۰ | ۱۱۱٫۲s | `duration_ms 111116` |
| ۱۳ | `api:input:test` | ۰ | ۲٫۰s | `duration_ms 1946` |
| ۱۴ | `obs:test` | ۰ | ۱۱٫۷s | `duration_ms 11678` |
| ۱۵ | `router:test` | ۰ | ۱٫۱s | ۱۲۸ قبول · ۰ رد |
| ۱۶ | `content:atomic:test` | ۰ | ۶٫۳s | `duration_ms 6258` |
| ۱۷ | `content:hotpath:test` | ۰ | ۶٫۶s | `duration_ms 6544` |
| ۱۸ | `storage:test` | ۰ | ۵٫۲s | `duration_ms 5174` |
| ۱۹ | `publish:guard:test` | ۰ | ۰٫۷s | `duration_ms 699` |
| ۲۰ | `backup:restore:test` | ۰ | ۲۹٫۷s | ۱۲ موفق · ۰ شکست |
| ۲۱ | `data:benchmark` | ۰ | ۱۴٫۴s | — |
| ۲۲ | `perf:bundle` **(تازه)** | ۰ | ۰٫۲s | ۰ نقض بودجه (۸ سقف) |
| ۲۳ | `api:contract:check` | ۰ | ۶٫۵s | ۲۲۹ مسیر · ۲۸ کد خطا · ۱۱ DTO · ۰ نقض |
| ۲۴ | `audit:api:selftest` | ۰ | ۱۰٫۱s | خودآزمون سبز |
| ۲۵ | `smoke:test` | ۰ | ۱۱٫۹s | ۱۷/۱۷ |
| ۲۶ | `e2e:api` **(تازه)** | ۰ | ۱۰٫۵s | ۲۷/۲۷ |

**مجموع سنجه‌های صریح‌شمارش‌شده:** ۷۸ + ۴۰ + **۱۴** + ۲۷ + ۳۴ + ۹۲ + ۶۴ + ۶۰ + ۱۲۸ + ۱۲ + ۱۷ + **۲۷** = **۵۹۳**

> تاریخچهٔ دروازه در همین نشست: ۲۳ گام (۳۵۳٫۶s) → ۲۴ با `e2e:api` (۳۷۲٫۵s) → ۲۵ با `xss:test` (۴۱۷٫۰s)
> → **۲۶ با `perf:bundle` (۴۲۶٫۷s — مرجع)**.
(سه سوییت `admin:*` در این دروازه جدا اجرا می‌شوند؛ عدد تاریخی ۲۱۶ مربوط به اجرای دستی ترکیبی است.)

## ۲. Coverage

- **ابزار اندازه‌گیری coverage نصب نیست** (`c8`/`nyc`/`istanbul` در `node_modules` یافت نشد).
- **Coverage عددی: UNKNOWN.** پوشش فقط به‌صورت «دامنه‌ای» از نام سوییت‌ها قابل استنتاج است.

## ۳. تست‌های رابط کاربری / E2E

### ۳.۱ E2E سطح API — **VERIFIED**

`scripts/e2e-api-flows.mjs` (`e2e:api`) — **۲۷/۲۷ · exit 0** · گام ۲۴ دروازه.

سرور واقعی بالا می‌آید و با کلاینت HTTP خودِ نود (بدون curl، بدون مرورگر، بدون proxy) سنجیده می‌شود.
هیچ دادهٔ کاربری نوشته نمی‌شود — همهٔ درخواست‌ها رد می‌شوند.

پوشش: راه‌اندازی و سلامت · SPA fallback در برابر asset ناشناس · مرزهای احراز هویت (`/api/users/me`,
`/api/admin/*`) · CSRF (`Origin` غایب ⇒ ۴۰۳) · اعتبارسنجی (`Content-Type` ⇒ ۴۱۵، JSON نامعتبر ⇒ ۴۰۰) ·
عدم شمارش حساب (`INVALID_CREDENTIALS` نه `USER_NOT_FOUND`) · سقف بدنه (>۱MB ⇒ رد) ·
rate limit (۴۲۹ + `Retry-After`) · liveness مستقل از rate limit · قرارداد خطا · عدم افشای `stack` ·
`X-Request-Id` روی ۲۷/۲۷ پاسخ.

**اثبات حساسیت:** حذف `assertSameOrigin(request)` از هندلر `logout` در `database/usersApi.js`
⇒ **۲۶/۲۷ · exit 1** با پیام دقیق روی همان سنجه. سپس `shasum -a 256 -c` ⇒ `OK` و اجرای بعدی
**۲۷/۲۷ · exit 0**. فایل در نهایت **صفر تغییر خالص** دارد.

### ۳.۲ E2E مرورگری — **BLOCKED**

- هیچ ابزار E2E مرورگری نصب نیست (`playwright`/`cypress`/`puppeteer`/`vitest`/`jest`/`jsdom` = NONE).
- اجرای تست رابط کاربری در این نشست صریحاً ممنوع بود.
- ⇒ جریان‌های UI (ثبت‌نام از فرم، ویرایش محتوا، draft/publish، exam flow، media، planning، wiki،
  publisher dry-run) **UNVERIFIED**.

## ۴. Load و Performance

| مورد | وضعیت |
|---|---|
| **Bundle baseline (واقعی)** | **VERIFIED** — `perf:bundle` از `dist/` موجود: کل **۲۰۰٫۸۹MB** / ۱۸۳ فایل · JS **۵٫۷۴MB** / ۱۹ chunk · CSS **۹۳۲KB** / ۱۰ chunk · بزرگ‌ترین chunk JS **۱٫۸۱MB** (`mockData`) · بزرگ‌ترین CSS **۷۲۸KB** · glb **۱۰۵٫۹۰MB** · mp4 **۳۹٫۰۲MB** · تصاویر **۴۸٫۱۰MB** |
| **بودجهٔ باندل** | **VERIFIED** — ۸ سقف سنجیده شد، **۰ نقض** (مصرف ۸۷٪–۹۳٪). اثبات حساسیت: کاهش عمدی `js.total` ⇒ **exit 1** |
| Load test | **BLOCKED** — بدون محیط staging و بدون ابزار load |
| `data:benchmark` | اجرا شد (exit 0). هشدار خود اسکریپت: ستون `raw` شامل هزینهٔ سیستم فایل محیط است ⇒ مقایسه فقط با ستون `overhead` |
| Core Web Vitals | **UNVERIFIED** — بدون اندازه‌گیری مرورگر |
| `vite build` | **اجرا نشد** (قاعدهٔ پروژه) — ولی اندازه‌گیری از artifact موجود انجام شد، پس baseline عددی دارد |

## ۵. امنیت (اجراشده)

| تست | خروجی |
|---|---|
| `npm audit --json` | ۰ آسیب‌پذیری (critical 0 · high 0 · moderate 0 · low 0 · info 0) در ۲۰۹ وابستگی |
| `bank:test` | ۴۰/۴۰ — شامل گارد نشت `correctAnswer`/`explanation`/`answerKey` |
| **`xss:test` (تازه)** | **۱۴/۱۴** — ۳۹ payload خصمانه، idempotence، کنترل‌های منفی، رگرسیون ساختاری روی ۵ sink رندر، و تک‌نسخه‌بودن پاک‌ساز. **یک دور زدن واقعی XSS را کشف و قفل کرد** (جزئیات در `EVIDENCE-LOG` بند ۱۱ و `FINAL-REPORT` بند C-2) |
| **اثبات حساسیت `xss:test`** | بازگرداندن عمدی escape ⇒ **۱۲/۱۴ · exit 1** با پیام «`<` escape‌نشده در متن: `<img src=x onerror=alert(1) title="unclosed>`» · لاگ: `.workbuddy-ai/phase-logs/xss-mutation.log` |
| `admin:security:test` | ۶۰/۶۰ — سرّها write-only · `*.secrets.json` ۰۶۰۰ |
| `admin:rbac:test` | ۶۴/۶۴ — deny-by-default · آخرین مدیر کل ⇒ ۴۰۹ |
| `publish:guard:test` | ۹ سنجه — گارد SSRF |
| `repo:hygiene` | ۰ سرّ · ۱۳ فایل حجیم · ۵ دادهٔ زمان‌اجرا tracked ⇒ **۱۸ نقض** |
| `auth:test` | ۷۸/۷۸ — شامل rate limit و نبود enumeration |

## ۶. محدودیت‌های اجرا

1. اجرا داخل سندباکس میزبان انجام شد؛ گارد حذف انبوه می‌تواند پاک‌سازی فایل موقت در تست‌ها را رد کند
   و «شکست کاذب» بسازد. **این بار هیچ گامی با شکست کاذب مواجه نشد** و دروازه exit 0 داد.
2. برای نتیجهٔ مرجع نهایی، `verify:all` باید در ترمینال معمولی (بیرون سندباکس) هم اجرا شود.
3. ۷ فایل `content/*.json` تغییرات commit‌نشدهٔ کاربر داشتند؛ دروازه آن‌ها را دست نزد و بازنگرداند.
4. دادهٔ تست واقعی کاربران (۵ fixture در `database/users.json`) حذف نشد.
