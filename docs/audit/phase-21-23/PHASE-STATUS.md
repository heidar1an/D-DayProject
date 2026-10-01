# PHASE-STATUS — فازهای پیشنهادی ۲۱، ۲۲ و ۲۳

تاریخ اجرا: ۲۰۲۶-۱۰-۰۱ · شاخه: `main` @ `a86d875` · محیط: سندباکس محلی (macOS)

> این فازها **پیشنهادی** هستند. `MASTER-AUDIT-2026-09-29.md` هیچ Roadmap/Scope رسمی برای ۲۱–۲۳ ندارد.
> هیچ موردی از فازهای قبلی «تکمیل‌شده» فرض نشده. `IMPLEMENTED ≠ VERIFIED`.

## فاز ۲۱ — Production Readiness / SRE / Data Governance

| مرحله | موضوع | وضعیت |
|---|---|---|
| ۲۱.۰ | Baseline عملیاتی | **VERIFIED** |
| ۲۱.۱ | Build و Deployment تکرارپذیر | **PARTIAL — VERIFIED** (deploy.mjs کامل؛ build این نشست اجرا نشد) |
| ۲۱.۲ | Staging و CI/CD | **PARTIAL** — workflow CI افزوده شد (`.github/workflows/ci.yml`، ۳ job)؛ **staging همچنان BLOCKED** و اجرای واقعی CI دیده نشد |
| ۲۱.۳ | Health / Readiness | **VERIFIED** (۱۷/۱۷ smoke + ۲۷/۲۷ E2E زنده) |
| ۲۱.۴ | Backup / Restore / DR | **VERIFIED** (backup:restore:test ۱۲/۱۲) — زمان‌بندی خودکار ندارد |
| ۲۱.۵ | Rollback | **PARTIAL** — rollback خودکار در `deploy.mjs` کد ۸؛ drill دستی انجام نشد |
| ۲۱.۶ | Persistence و Data Governance | **VERIFIED (سطح JSON)** — migration نسخه‌دار وجود ندارد |

**Gate فاز ۲۱: عبور نکرد.** دو مورد باز: staging (BLOCKED) و migration نسخه‌دار (NOT FOUND).

## فاز ۲۲ — Security / API Contracts / Integration

| مرحله | موضوع | وضعیت |
|---|---|---|
| ۲۲.۰ | Threat Model | **VERIFIED (سند)** — `docs/security/threat-model.md`؛ ۲۰ تهدید، ۱۰ دارایی؛ ۶ ردیف `OPEN` |
| ۲۲.۱ | Password / Auth Migration | **VERIFIED** — `scrypt$salt$hash` + پشتیبانی legacy SHA-256 |
| ۲۲.۲ | ATO / Enumeration / Abuse | **VERIFIED** — `userRateLimit.js` (۸/شناسه · ۳۰/IP در ۶۰s)؛ عدم شمارش حساب با E2E اثبات شد؛ multi-instance محدود |
| ۲۲.۳ | Authorization / CSRF / CORS | **VERIFIED** — RBAC تست‌شده · `assertSameOrigin` روی ۷ نقطه · کوکی `HttpOnly; SameSite=Strict` + `Secure` شرطی · CORS صریح تعریف نشده (هم‌مبدأ) |
| ۲۲.۴ | Validation و API Contracts | **PARTIAL** — ۲۲۹ مسیر / ۲۸ کد خطا / ۱۱ DTO / ۰ نقض؛ OpenAPI وجود ندارد |
| ۲۲.۵ | Sanitization و Rich Text | **VERIFIED + یک آسیب‌پذیری واقعی کشف و رفع شد** — `xss:test` (۱۴ سنجه) با ۳۹ payload خصمانه؛ **دور زدن XSS در تگ با نقل‌قول بسته‌نشده** رفع شد؛ **۵ از ۵ sink** اکنون پاک‌سازیِ زمان‌رندر دارند (رجوع به `FINAL-REPORT` بند C-2) |
| ۲۲.۶ | Publisher / AI / Payment | **UNVERIFIED** — آداپترها بدون توکن؛ AI/Payment بدون consumer واقعی |
| ۲۲.۷ | Dependency / Secret / Repo | **PARTIAL** — `npm audit` ۰ آسیب‌پذیری؛ hygiene ۱۸ یافته |

**Gate فاز ۲۲: عبور نکرد.** موارد باز: OpenAPI، AI/Payment، سرّها و دادهٔ زمان‌اجرا در تاریخچهٔ Git.

## فاز ۲۳ — Quality / Scale / Product Readiness

| مرحله | موضوع | وضعیت |
|---|---|---|
| ۲۳.۰ | Test Strategy و Coverage | **VERIFIED** — دروازهٔ **۲۶ گام** سبز (۲۶/۲۶ · exit 0 · ۴۲۶٫۷s)، بدون coverage tooling |
| ۲۳.۱ | E2E جریان‌های حیاتی | **PARTIAL** — `e2e:api` (۲۷ سنجه، گام آخر دروازه): راه‌اندازی، سلامت، مسیریابی، مرزهای احراز هویت، CSRF، اعتبارسنجی، سقف بدنه، rate limit، قرارداد خطا، عدم افشا. **E2E مرورگری همچنان BLOCKED** |
| ۲۳.۲ | Accessibility | **PARTIAL** — ۴۳/۵۵ فایل CSS گارد reduced-motion · ۷۰/۷۰ `<img>` با `alt`؛ بدون بررسی صفحه‌خوان |
| ۲۳.۳ | Responsive | **UNVERIFIED** — بدون بررسی viewport (تست رابط کاربری در این نشست ممنوع بود) |
| ۲۳.۴ | Performance و Bundle | **VERIFIED (baseline)** — `perf:bundle` از `dist/` واقعی: کل ۲۰۰٫۸۹MB · JS ۵٫۷۴MB · CSS ۹۳۲KB · بزرگ‌ترین chunk ۱٫۸۱MB · ۸ سقف بودجه، ۰ نقض. Core Web Vitals هنوز **UNVERIFIED** (بدون مرورگر) |
| ۲۳.۵ | Load و Scalability | **BLOCKED** — بدون staging |
| ۲۳.۶ | Observability | **VERIFIED (پایه)** — لاگ JSON تک‌خطی، `X-Request-Id`، `/metrics` توکن‌دار؛ متریک درون-حافظه |
| ۲۳.۷ | SEO | **تصمیم مستند شد، پیاده‌سازی معوق** — `docs/ops/seo-strategy.md`؛ گزینهٔ A (پایهٔ ریسک‌صفر) + C (prerender) پیشنهاد شد، D رد شد. دو پیش‌نیاز بیرونی: دامنهٔ قطعی و build تازه |
| ۲۳.۸ | Integration خارجی | **UNVERIFIED** — publisher/AI/payment/monitoring بدون sandbox |

**Gate فاز ۲۳: عبور نکرد.** موارد باز: E2E مرورگری، load test، پیاده‌سازی SEO، responsive، integration خارجی.

## جمع‌بندی سه فاز

هیچ‌یک از سه Gate به‌طور کامل عبور نکرد. نسبت به شروع این نشست، برداشته‌شده‌ها:

۱. دروازهٔ کیفیت از **۲۳ به ۲۶ گام** رسید (`xss:test` · `perf:bundle` · `e2e:api`) و **۲۶/۲۶ سبز** است.
۲. یک **آسیب‌پذیری واقعی XSS** در `sanitizeHtml.js` کشف و رفع شد، با تست رگرسیون و اثبات حساسیت جهشی.
۳. آخرین شکاف دفاع‌درعمق بسته شد: **۵ از ۵** نقطهٔ رندر اکنون پاک‌سازیِ زمان‌رندر دارند.
۴. **baseline واقعی Performance** اندازه‌گیری و بودجه‌بندی شد (از `dist/` موجود، بدون نیاز به build).
۵. workflow CI، threat model (۲۰ تهدید) و سند تصمیم SEO اضافه شد.

بیشترین شکاف باقی‌مانده: staging، E2E مرورگری، load test، Core Web Vitals، و یک یافتهٔ **Critical**
در تاریخچهٔ Git.
