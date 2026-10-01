# گزارش نهایی فازهای ۲۱، ۲۲ و ۲۳ — پروژه «تپش»

تاریخ: ۲۰۲۶-۱۰-۰۱ · شاخه `main` @ `a86d875` · Node `22.22.2` · محیط: سندباکس محلی macOS
پیوست‌ها: `PHASE-STATUS.md` · `EVIDENCE-LOG.md` · `RISK-REGISTER.md` · `TEST-RESULTS.md` · `ROLLBACK-PLAN.md` · `READINESS-MATRIX.md`

---

## ۱. Executive Summary

**چه چیزی واقعاً اجرا و تأیید شد:**
دروازهٔ کامل `verify:all` با **۲۶ گام و exit 0** در ۴۲۶٫۷ ثانیه اجرا شد و سبز بود. `smoke:test` **۱۷/۱۷**
و `e2e:api` **۲۷/۲۷** روی سرور واقعی، مسیرهای `/healthz`، `/api/health`، `/readyz`، `/metrics`،
مرزهای احراز هویت، CSRF، اعتبارسنجی ورودی، سقف بدنه و rate limit را تأیید کردند.
`backup:restore:test` **۱۲/۱۲**، `auth:test` **۷۸/۷۸**، `bank:test` **۴۰/۴۰**، `router:test` **۱۲۸/۱۲۸**،
`xss:test` **۱۴/۱۴**، سه سوییت ادمین **۹۲/۶۴/۶۰**، `api:contract:check` با **۲۲۹ مسیر / ۲۸ کد خطا /
۱۱ DTO / ۰ نقض**، `npm audit` با **۰ آسیب‌پذیری** در ۲۰۹ وابستگی، و `perf:bundle` با **۰ نقض بودجه**.

**یک آسیب‌پذیری واقعی کشف و رفع شد (مهم‌ترین یافتهٔ این نشست):**
پاک‌ساز HTML (`database/sanitizeHtml.js`) تگی که **نقل‌قول بسته‌نشده** داشت را تطبیق نمی‌داد؛ آن تگ
«متن» تلقی می‌شد و `<` آن escape **نمی‌شد** ⇒ خروجی **بایت‌به‌بایت** برابر ورودی و رویدادگردان زنده.
نمونهٔ اثبات‌شده: `sanitizeHtml('<img src=x onerror=alert(1) title="unclosed>')` ⇒ همان رشته ⇒ **XSS**.
همچنین `rel` امنِ افزوده‌شده بی‌اثر بود و پاک‌سازی idempotent نبود.
**هر دو رفع شد**، با تست رگرسیون ۱۴ سنجه‌ای، **اثبات حساسیت جهشی** (۱۲/۱۴ · exit 1) و بازگردانی تأییدشده.
به‌علاوه آخرین شکاف دفاع‌درعمق بسته شد: `ContentBlocks.jsx` که تنها sink بدون پاک‌سازیِ زمان‌رندر بود،
اکنون `block.html` را پیش از رندر از پاک‌ساز می‌گذراند ⇒ **۵ از ۵ sink**.

**چه چیزی در این نشست ساخته شد:**
سوییت **E2E سطح API** (۲۷ سنجه)، سوییت **رگرسیون XSS** (۱۴ سنجه)، **ابزار بودجهٔ باندل** (با baseline
واقعی اندازه‌گیری‌شده از `dist/`) — هر سه گام دروازه؛ یک **workflow CI** سه‌جابی؛ یک **threat model**
با ۲۰ تهدید؛ و یک **سند تصمیم SEO**.

**چه چیزی هنوز UNVERIFIED / UNKNOWN است:**
E2E مرورگری · Load test · Core Web Vitals (اندازه‌گیری مرورگر) ·
Responsive در viewport واقعی · تحویل خارجی publisher/AI/payment/monitoring · اجرای واقعی CI.

**آیا پروژه برای Production آماده است؟ خیر.**

**سه Blocker اصلی:**
1. **سرّ و دادهٔ زمان‌اجرا در تاریخچهٔ Git** (`content/admins.json` = هش رمز · `activity.json` = IP/UA) —
   Critical، نیازمند تأیید صریح برای `git rm --cached` + بازنویسی + reissue سرّها.
2. **نبود staging** ⇒ Load test، Core Web Vitals و اجرای واقعی CI سنجیده نمی‌شوند.
3. **نبود E2E مرورگری** ⇒ جریان‌های حیاتی UI هنوز end-to-end آزموده نمی‌شوند.

---

## ۲. Changes Made

| فایل | نوع | توضیح |
|---|---|---|
| `database/sanitizeHtml.js` | **۲ رفع امنیتی** (+۲۲/−۵) | escape همهٔ `<`های متن · `rel` نویسنده جدا از `rel` امن. فایل محافظت‌شده ⇒ تغییر همراه با تست رگرسیون مرتبط |
| `src/layout/dashboard/courses/reference/reader/ContentBlocks.jsx` | ۲ خط | `markHtml(sanitizeHtml(block.html), …)` + import — بستن آخرین شکاف دفاع‌درعمق |
| `database/sanitizeHtmlXss.test.mjs` | **تازه** | ۱۴ سنجه · ۳۹ payload خصمانه · idempotence · رگرسیون ساختاری sinkها |
| `scripts/e2e-api-flows.mjs` | **تازه** | E2E سطح API — ۲۷ سنجه · بدون مرورگر · بدون نوشتن دادهٔ کاربری |
| `scripts/bundle-budget.mjs` | **تازه** | بودجهٔ باندل/دارایی از `dist/` · `--check` · `--json` · skip صریح اگر `dist/` نباشد |
| `.github/workflows/ci.yml` | **تازه** | `verify` (دروازه) · `build` (+ تأیید artifact + بودجهٔ باندل) · `audit` |
| `docs/security/threat-model.md` | **تازه** | ۱۰ دارایی · ۲۰ تهدید · ۵ ردیف `OPEN` |
| `docs/ops/seo-strategy.md` | **تازه** | ۴ گزینه · تصمیم A+C · رد D · ۲ پیش‌نیاز بیرونی |
| `scripts/verify-all.mjs` | ۳ خط | گام‌های `xss:test` · `perf:bundle` · `e2e:api` (۲۳ → ۲۶ گام) |
| `package.json` | ۴ خط | اسکریپت‌های `xss:test` · `e2e:api` · `perf:bundle` · `perf:bundle:check` |
| `database/usersApi.js` | **صفر تغییر خالص** | برای اثبات حساسیت E2E جهش خورد و بیت‌به‌بیت بازگردانده شد (`shasum -c` ⇒ `OK`) |
| `docs/audit/phase-21-23/*.md` | تازه/به‌روز | ۷ سند گزارش |
| `.workbuddy-ai/memory/MEMORY.md` | فشرده‌سازی | بیش از سقف تزریق بود (بدون حذف واقعیت) |

**دست‌نخورده ماند:** `index.html` · `dist/` · تاریخچهٔ Git · `src/router/**` · `src/styles/**` ·
۷ فایل `content/*.json` با تغییرات commit‌نشدهٔ کاربر · `database/users.json` · `users.sessions.json` ·
`content/events.json` (تصمیم ۳۰ سپتامبر). تنها فایل `src/` تغییریافته: `ContentBlocks.jsx`.

---

## ۳. Verification Evidence

| ادعا | دستور | محیط | خروجی | نتیجه |
|---|---|---|---|---|
| دروازهٔ ۲۶ گامه سبز | `node scripts/verify-all.mjs` | سندباکس محلی | exit 0 · **۲۶/۲۶** · ۴۲۶٫۷s · «نتیجه: سبز» | **VERIFIED** |
| رگرسیون XSS | `node --test database/sanitizeHtmlXss.test.mjs` | سندباکس | **۱۴/۱۴ · exit 0** (با فهرست استثنای **خالی**) | **VERIFIED** |
| **باگ پیش از رفع** | همان سوییت روی کد اصلی | سندباکس | **۱۲/۱۴ · exit 1** (۲ شکست) | **VERIFIED** |
| **اثبات تجربی باگ** | `sanitizeHtml('<img src=x onerror=alert(1) title="unclosed>')` | سندباکس | خروجی بایت‌به‌بایت برابر ورودی ⇒ `onerror` زنده | **VERIFIED (Critical)** |
| حساسیت پس از رفع (XSS) | بازگرداندن عمدی escape ⇒ اجرا ⇒ بازگردانی | سندباکس | **۱۲/۱۴ · exit 1** · لاگ `xss-mutation.log` | **VERIFIED** |
| رگرسیون پاک‌ساز | `node database/testBankSecurity.test.mjs` | سندباکس | **۴۰/۴۰** (بدون افت) | **VERIFIED** |
| E2E سطح API | `node scripts/e2e-api-flows.mjs` | سرور واقعی | **۲۷/۲۷ · exit 0** | **VERIFIED** |
| حساسیت E2E | حذف `assertSameOrigin` از `logout` | — | **۲۶/۲۷ · exit 1** روی همان سنجه | **VERIFIED** |
| بازگردانی جهش E2E | `shasum -a 256 -c` | — | `database/usersApi.js: OK` | **VERIFIED** |
| بودجهٔ باندل | `node scripts/bundle-budget.mjs --check` | `dist/` موجود | exit 0 · ۰ نقض · **baseline کامل** | **VERIFIED** |
| حساسیت بودجه | کاهش عمدی سقف `js.total` به ۱MB ⇒ `--check` ⇒ بازگردانی | — | **exit 1** با «✗ 1 نقض بودجه: js.total» · سپس exit 0 | **VERIFIED** |
| Health در Runtime | `node scripts/server-smoke.mjs` | سرور واقعی | ۱۷/۱۷ | **VERIFIED** |
| `/metrics` بدون توکن ۴۰۴ (نه ۴۰۳) | داخل smoke | — | تأیید شد | **VERIFIED** |
| `/api/health` بدون افشا | smoke + e2e | — | فقط `status` + `uptimeSeconds` | **VERIFIED** |
| CSRF فعال | e2e: `POST /logout` بدون `Origin` | — | **۴۰۳** | **VERIFIED** |
| عدم شمارش حساب | e2e: ورود با شمارهٔ ناموجود | — | **۴۰۱ `INVALID_CREDENTIALS`** | **VERIFIED** |
| Rate limit ورود | e2e: ۱۰ تلاش پیاپی | — | تلاش نهم **۴۲۹ + `Retry-After: 60`** | **VERIFIED** |
| سقف بدنه | e2e: بدنهٔ ۱٫۲MB | — | `ECONNRESET` (هرگز ۲۰۰) | **VERIFIED** |
| Backup/Restore | `node scripts/backup-restore-test.mjs` | سندباکس | ۱۲ موفق · ۰ شکست | **VERIFIED** |
| قرارداد API | `node scripts/api-contract.mjs --check` | سندباکس | ۲۲۹/۲۸/۱۱ · ۰ نقض | **VERIFIED** |
| وابستگی‌ها | `npm audit --json` | شبکه | ۰ آسیب‌پذیری | **VERIFIED** |
| RBAC | `admin:rbac:test` | سندباکس | ۶۴/۶۴ | **VERIFIED** |
| سرّهای ادمین | `admin:security:test` | سندباکس | ۶۰/۶۰ | **VERIFIED** |
| SSRF publisher | `publish:guard:test` | سندباکس | ۹ سنجه سبز | **VERIFIED** |
| بهداشت مخزن | `node scripts/repo-hygiene.mjs` | سندباکس | ۰ سرّ · ۱۳ حجیم · ۵ دادهٔ زمان‌اجرا ⇒ ۱۸ نقض | **VERIFIED (یافته)** |
| Build | `vite build` | — | **اجرا نشد** (قاعدهٔ پروژه)؛ اندازه‌گیری از `dist/` موجود انجام شد | UNVERIFIED (اجرا) |
| CI workflow | — | — | نوشته شد، **اجرا نشد** | UNVERIFIED (اجرا) |
| E2E مرورگری | — | — | ابزار نصب نیست | **BLOCKED** |

لاگ‌های مرجع: `.workbuddy-ai/phase-logs/{verify-all,verify-all-24,verify-all-25,verify-all-26,e2e,e2e-mutation,xss-mutation,bundle-mutation}.log`

---

## ۴. Security Findings

### Critical
| یافته | وضعیت |
|---|---|
| **C-1 · سرّ و دادهٔ شخصی در تاریخچهٔ Git** — `database/content/admins.json` (هش رمز) و `activity.json` (IP/UA) tracked و در history. `.git` = ۲۱۹MB با blob ۴۷MB و ویدیو ۴۱MB. | **باز — نیازمند تأیید صریح** |
| **C-2 · دور زدن XSS در `sanitizeHtml.js`** — تگ با نقل‌قول بسته‌نشده تطبیق نمی‌شد ⇒ `<` آن escape نمی‌شد ⇒ خروجی بایت‌به‌بایت برابر ورودی و رویدادگردان زنده. | **بسته — رفع + قفل رگرسیون (`xss:test` ۱۴ سنجه، گام ۵ دروازه)** |

### High
| یافته | وضعیت |
|---|---|
| H-1 · نبود staging | باز (BLOCKED) |
| H-2 · E2E فقط سطح API | کاهش‌یافته (PARTIAL) |
| H-3 · نبود backup زمان‌بندی‌شده | باز |
| H-4 · ۱۳ فایل حجیم tracked | باز |

### Medium
| یافته | جزئیات |
|---|---|
| M-1 · Rate limit درون-حافظه | در استقرار چند-نودی بی‌اثر (متریک‌ها هم همین‌طور). |
| M-2 · نبود OpenAPI | ۲۲۹ مسیر فقط با اسکریپت اختصاصی سنجیده می‌شود؛ شکل خطای `users` ناهمگون (در E2E قفل شد). |
| M-3 · شکاف اعتبارسنجی | `assertInputValid` روی ۲ از ۱۱۷ مسیر. |
| M-4 · `rel` ناامن و ناپایدار در پاک‌ساز | **بسته — رفع شد.** |
| M-5 · نشست یتیم | ۵۳ از ۵۵ نشست یتیم؛ رابطهٔ `session → user` تعریف نشده ⇒ اسکنر `PASS` کاذب می‌دهد. |
| M-6 · بدون retry/backoff در انتشار | فقط مهلت `PUBLISH_TIMEOUT_MS`. |
| M-7 · `redact()` وجود ندارد | توکن در URL جاسازی می‌شود؛ عدم نشت فعلاً **قرارداد نوشتاری** است نه گارد اجرایی. |
| ~~M-8 · `ContentBlocks.jsx`~~ | **بسته — ۵ از ۵ sink اکنون پاک‌سازیِ زمان‌رندر دارند** (فهرست استثنای تست خالی شد). |

### Low
| یافته | جزئیات |
|---|---|
| L-1 · ~~۱ تصویر بدون `alt`~~ | **باطل شد** — سنجش چندخطی: ۷۰/۷۰ `<img>` دارای `alt`. |
| L-2 · CORS صریح تعریف نشده | `Access-Control-Allow-Origin` = ۰ در `server.js` (هم‌مبدأ). |
| L-3 · ۴ fixture آزمایشی در `users.json` · ۵ PNG در `public/uploads/` · `.bak`ها | — |
| L-4 · enumeration مسیر ادمین | `/api/admin/<ناموجود>` بدون احراز هویت **۴۰۴** نه ۴۰۱. اثر کم. رفتار در `e2e:api` قفل شد. |

### Informational
- **CSRF پوشش دارد:** `assertSameOrigin` (Origin vs Host) روی ۷ نقطه؛ کوکی `HttpOnly; SameSite=Strict` + `Secure` شرطی.
- هش `scrypt$salt$hash` + `timingSafeEqual`؛ SHA-256 فقط legacy.
- گارد SSRF (`publishers/urlGuard.js`) بسته است.
- لاگ دسترسی: query/IP/UA/Cookie/بدنه هرگز ثبت نمی‌شوند.

---

## ۵. Test Results

- **`verify:all`: ۲۶ گام · ۲۶ سبز · ۰ قرمز · exit 0 · ۴۲۶٫۷ ثانیه**
- مجموع سنجه‌های صریح‌شمارش‌شده: **۵۹۳** (۷۸ + ۴۰ + ۱۴ + ۲۷ + ۳۴ + ۹۲ + ۶۴ + ۶۰ + ۱۲۸ + ۱۲ + ۱۷ + ۲۷)
- سه گام در این نشست اضافه شد: `xss:test` (۱۴) · `e2e:api` (۲۷) · `perf:bundle` (۰ نقض بودجه)
- هر سه با **اثبات حساسیت جهشی**: XSS (۱۲/۱۴) · CSRF در E2E (۲۶/۲۷) · بودجهٔ باندل (exit 1)
- Coverage عددی: **UNKNOWN** (ابزار coverage نصب نیست)
- E2E مرورگری: **BLOCKED** · Load: **BLOCKED** · Responsive: **UNVERIFIED**
- جزئیات کامل: `TEST-RESULTS.md`

---

## ۶. SRE و Recovery

| مورد | وضعیت | جزئیات |
|---|---|---|
| Build | VERIFIED (بیرونی) | artifact `dist/index.html` ۲۰۲۶-۱۰-۰۱ ۱۳:۴۸؛ build این نشست اجرا نشد |
| Deploy | VERIFIED (کد) | `deploy.mjs` — کدهای خروج ۲/۳/۴/۵/۶/۷/۸ |
| CI | **PARTIAL** | `.github/workflows/ci.yml` (۳ job) نوشته شد؛ **اجرا نشد** |
| Staging | **BLOCKED** | وجود ندارد |
| Health | **VERIFIED** | `/healthz` · `/api/health` · `/readyz` · `/metrics` (بدون توکن ۴۰۴) |
| Backup | VERIFIED (دستی) | `data-backup.mjs` + تست ۱۲/۱۲؛ بدون زمان‌بندی |
| Restore | **VERIFIED** | dry-run پیش‌فرض + عکس `pre-restore-<stamp>` + گارد path traversal |
| Rollback | PARTIAL | rollback درون‌خطی `deploy.mjs` (کد ۸)؛ drill واقعی انجام نشد |
| DR drill | **UNVERIFIED** | RTO/RPO تعریف‌نشده |

---

## ۷. Performance و Quality

**Baseline واقعی — اندازه‌گیری‌شده از `dist/` با `perf:bundle` (۲۰۲۶-۱۰-۰۱):**

| شاخص | مقدار | بودجه | وضعیت |
|---|---|---|---|
| کل `dist` | **۲۰۰٫۸۹ MB** / ۱۸۳ فایل | ۲۱۵ MB | ۹۳٪ |
| JS کل | **۵٫۷۴ MB** / ۱۹ chunk | ۶٫۳ MB | ۹۱٪ |
| CSS کل | **۹۳۲ KB** / ۱۰ chunk | ۱٫۰۵ MB | ۸۷٪ |
| بزرگ‌ترین chunk JS | **۱٫۸۱ MB** — `assets/mockData-*.js` | ۱٫۹۵ MB | ۹۳٪ |
| بزرگ‌ترین chunk CSS | **۷۲۸ KB** — `assets/index-*.css` | ۸۰۰ KB | ۹۱٪ |
| مدل‌های سه‌بعدی | ۱۰۵٫۹۰ MB | ۱۱۵ MB | ۹۲٪ |
| ویدیو | ۳۹٫۰۲ MB | ۴۵ MB | ۸۷٪ |
| تصاویر | ۴۸٫۱۰ MB | ۵۲ MB | ۹۲٪ |

سه chunk بزرگ JS: `mockData` ۱٫۸۱MB · `index` ۱٫۵۶MB · `admin` ۱٫۰۰MB.
`mockData` همان `src/services/wiki/mockData.js` (۲٫۱۶MB) است که طبق ممیزی فاز ۲۰ بک‌اند ندارد ⇒
کاهشش **کارکردی** است نه آرایشی (منتقل‌کردن به API)، و عمداً انجام نشد.

| مورد دیگر | وضعیت |
|---|---|
| Core Web Vitals | **UNVERIFIED** — بدون اندازه‌گیری مرورگر |
| `data:benchmark` | اجرا شد (exit 0)؛ مقایسه فقط با ستون `overhead` معتبر است |
| Load test | **BLOCKED** — بدون staging |
| Accessibility | PARTIAL — ۴۳/۵۵ فایل CSS گارد `prefers-reduced-motion` · ۱۷۶۵ `aria-*` · ۳۴۲ `role` · ۷۰/۷۰ `<img>` با `alt` |
| SEO | **تصمیم مستند، پیاده‌سازی معوق** — صفحات عمومی هنوز indexable نیستند |
| Responsive | **UNVERIFIED** |
| Observability | VERIFIED (پایه) — لاگ JSON تک‌خطی · `X-Request-Id` روی هر پاسخ · متریک درون‌حافظه |

---

## ۸. Remaining Risks

1. **R-01 (Critical)** — سرّ و دادهٔ زمان‌اجرا در تاریخچهٔ Git؛ نیازمند تأیید صریح.
2. **R-02 (High، کاهش‌یافته)** — CI نوشته شد ولی اجرا نشد؛ **staging همچنان وجود ندارد**.
3. **R-03 (High)** — نبود migration نسخه‌دار و idempotent.
4. **R-04 (High، کاهش‌یافته)** — E2E سطح API اضافه شد؛ E2E مرورگری وجود ندارد.
5. **R-05 (High)** — ۱۳ فایل حجیم tracked.
6. **R-06 (High)** — ۵۳ نشست یتیم؛ رابطهٔ `session → user` تعریف نشده.
7. **R-07 … R-14 (Medium)** — rate limit درون-حافظه · نبود OpenAPI · شکاف اعتبارسنجی · retry/backoff انتشار · نبود backup زمان‌بندی‌شده · fixtureهای باقی‌مانده · `redact()` نبودن.
8. **R-15 … R-20 (Low)** — `alt` (باطل شد) · CORS ضمنی · localStorage بدون نسخه · `events.json` صفرشده (پذیرفته) · گام‌های بدون شمارش صریح · enumeration مسیر ادمین.
9. **بسته‌شده در این نشست** — R-11 (rich text) · R-21 (XSS) · R-22 (`rel`) · M-8 (ContentBlocks).
10. **SEO / Integration خارجی** — تصمیم مستند شد ولی پیاده نشد؛ sandbox واقعی وجود ندارد.

---

## ۹. Final Status

# `NOT READY`

**شواهد وضعیت:**
- دروازهٔ داخلی **۲۶/۲۶ سبز** است و امنیت پایه (هش رمز، RBAC، CSRF، گارد نشت بانک تست، SSRF، پاک‌ساز HTML، `npm audit` ۰) **تأییدشده** است.
- در همین نشست **یک آسیب‌پذیری واقعی XSS** کشف، رفع و با اثبات حساسیت جهشی قفل شد؛ آخرین شکاف دفاع‌درعمق رندر بسته شد؛ baseline واقعی باندل اندازه‌گیری و بودجه‌بندی شد؛ و یک سوییت E2E سطح API، یک workflow CI، یک threat model و یک تصمیم SEO اضافه شد.
- اما staging وجود ندارد، E2E مرورگری اجرا نمی‌شود، Load و Core Web Vitals اندازه‌گیری نشده، SEO پیاده نشده، و یک یافتهٔ **Critical** (سرّ/داده در تاریخچهٔ Git) باز است.

**Blockerهای دقیق:**
1. سرّ و دادهٔ زمان‌اجرا در تاریخچهٔ Git (Critical — نیازمند تأیید صریح برای بازنویسی).
2. نبود staging (Load test، Core Web Vitals و اجرای واقعی CI سنجیده نمی‌شوند).
3. نبود E2E مرورگری (جریان‌های حیاتی UI).

**پیش‌شرط رسیدن به `READY WITH ACCEPTED RISKS`:**
بستن C-1 · اجرای واقعی CI + ایجاد staging · افزودن E2E مرورگری برای ۱۹ جریان فاز ۲۳.۱ ·
backup زمان‌بندی‌شده با محل خارج از سایت · اجرای گام ۱ سند SEO (نیازمند دامنهٔ قطعی + build).
