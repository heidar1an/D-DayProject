# EVIDENCE-LOG — فازهای ۲۱–۲۳

محیط: macOS · Node `22.22.2` (مسیر مطلق مدیریت‌شده) · شاخه `main` @ `a86d875` · ۲۰۲۶-۱۰-۰۱

> هر ردیف: دستور اجراشده → خروجی واقعی → وضعیت.

## ۱. Baseline مخزن

| # | دستور | خروجی واقعی | وضعیت |
|---|---|---|---|
| E1 | `git status --porcelain \| wc -l` | ۱۶۵ ورودی (تغییرات commit‌نشدهٔ کاربر) | VERIFIED |
| E2 | `git rev-parse --abbrev-ref HEAD` | `main` | VERIFIED |
| E3 | `git log --oneline -3` | `a86d875 manageSOP` · `6d5d3d9 Merge…` · `ae7a211 finalEdits` | VERIFIED |
| E4 | `ls -d .github .gitlab-ci.yml Dockerfile docker-compose.yml .circleci` | NONE | VERIFIED (عدم وجود) |
| E5 | `ls -a \| grep -i env` | فقط `.env.example` (بدون `.env` واقعی) | VERIFIED |
| E6 | `ls node_modules \| grep -E '^(playwright\|cypress\|puppeteer\|vitest\|jest\|jsdom)'` | NONE | VERIFIED (عدم وجود) |

## ۲. دروازهٔ کامل ۲۳ گامه

| # | دستور | خروجی | وضعیت |
|---|---|---|---|
| E7 | `node scripts/verify-all.mjs` | **exit 0** · ۲۳/۲۳ گام سبز · زمان کل **۳۵۳٫۶s** · «نتیجه: سبز» | VERIFIED |
| E8 | همان — خطوط گام | `data:check` 0 · `data:test` 0 · `auth:test` 78ق/0ر · `bank:test` 40/40 · `exam:test` 27/27 · `domain:test` 0 · `planning:test` 34/0 · `admin:test` 92/92 · `admin:rbac:test` 64/64 · `admin:security:test` 60/60 · `api:test` 0 · `api:input:test` 0 · `obs:test` 0 · `router:test` 128ق/0ر · `content:atomic:test` 0 · `content:hotpath:test` 0 · `storage:test` 0 · `publish:guard:test` 0 · `backup:restore:test` 12/0 · `data:benchmark` 0 · `api:contract:check` 0 · `audit:api:selftest` 0 · `smoke:test` 17/17 | VERIFIED |
| E9 | `git status --porcelain` پس از دروازه | بدون آلودگی جدید (`content/{activity,admins}` تمیز ماند) | VERIFIED |

لاگ کامل: `.workbuddy-ai/phase-logs/verify-all.log`

## ۳. Health / Readiness (Runtime واقعی)

| # | دستور | خروجی | وضعیت |
|---|---|---|---|
| E10 | `node scripts/server-smoke.mjs` | `17/17 موفق` — سرور واقعی بالا آمد و پاسخ داد | VERIFIED |
| E11 | پوشش smoke (استخراج از منبع) | `/healthz ⇒ ۲۰۰` + بدنه `status:ok` + هدر `X-Request-Id` · `/api/health ⇒ ۲۰۰` بدون احراز هویت و **فقط** `status`/`uptimeSeconds` · `POST /api/health ⇒ ۴۰۵` · `/readyz ⇒ ۲۰۰` با گزارش `checks` · `/metrics` بدون توکن ⇒ **۴۰۴ (نه ۴۰۳)** · توکن غلط ⇒ ۴۰۴ · توکن درست ⇒ ۲۰۰ JSON · `/api/users/me` بدون احراز ⇒ ۴۰۱ · `/api/admin/stats` بدون احراز ⇒ ۴۰۱ · لاگ: تلفن در مسیر لو نمی‌رود + خط JSON با `reqId` | VERIFIED |

## ۴. Backup / Restore

| # | دستور | خروجی | وضعیت |
|---|---|---|---|
| E12 | `node scripts/backup-restore-test.mjs` | «نتیجه: ۱۲ سنجه موفق، ۰ شکست» | VERIFIED |
| E13 | `ls -l scripts/data-backup.mjs scripts/data-restore.mjs` | هر دو موجود (۴۵۳۲ و ۹۵۹۴ بایت) | VERIFIED |
| E14 | `ls -d backups .backups` | وجود ندارد (backup زمان‌بندی‌شده پیکربندی نشده) | VERIFIED (عدم وجود) |

## ۵. امنیت

| # | دستور | خروجی | وضعیت |
|---|---|---|---|
| E15 | `npm audit --json` | `vulnerabilities.total = 0` (prod 75 · dev 57 · total 209) | VERIFIED |
| E16 | شمارش الگوها در `database/usersStore.js` | `scrypt:11` · `sha256:2` · `SHA-256:5` · `createHash:3` · `timingSafeEqual:4` · `randomBytes:2` · `salt:10` | VERIFIED |
| E17 | شمارش الگوها در `database/userSessions.js` | `token:17` · `Set-Cookie:0` · `cookie:0` · `ttl:4` · `expire:7` — این فایل فقط توکن می‌سازد؛ تحویل کوکی جای دیگری است | VERIFIED |
| E17b | شمارش الگوها در `database/usersApi.js` (۳۷۲ خط) | `assertSameOrigin:7` · `SameSite=Strict:4` · `HttpOnly:4` · `secureCookieFlag:3` · `USER_SESSION_COOKIE:6` · `requireJsonBody:6` · `enforceRateLimit:5` · `Set-Cookie:3` | VERIFIED |
| E17c | بازبینی `assertSameOrigin` | مقایسهٔ `origin` با `x-forwarded-host`/`host`؛ نبود هریک ⇒ `FORBIDDEN`؛ عدم تطابق ⇒ `FORBIDDEN` ⇒ **CSRF پوشش دارد** | VERIFIED |
| E18 | شمارش الگوها در `server.js` | `Access-Control-Allow-Origin:0` · `SameSite:0` · `HttpOnly:0` · `CSRF:1` · `Origin:0` — کنترل‌های امنیتی در لایهٔ API هستند نه `server.js` | VERIFIED |
| E19 | `ls -l database/userRateLimit.js` | موجود (۴۶۱۴ بایت) | VERIFIED |
| E20 | بررسی `database/sanitizeHtml.js` | ۱۵۳ خط · `ALLOWED_TAGS` و `ALLOWED_ATTRS` به‌صورت allowlist · `javascript:` = ۰ در کد | VERIFIED |
| E21 | `ls -l database/publishers/urlGuard.js` | موجود (۷۶۴۷ بایت) — گارد SSRF | VERIFIED |
| E22 | `node scripts/api-contract.mjs --check` | «✓ انطباق قرارداد API سبز — ۲۲۹ مسیر، ۲۸ کد خطا، ۱۱ DTO» | VERIFIED |
| E23 | `node scripts/repo-hygiene.mjs` | ۷۲۵ فایل tracked · **۰ سرّ** · ۱۳ فایل حجیم tracked · **۵ دادهٔ زمان‌اجرا tracked** (`activity` `admins` `events` `mediaMetrics` `publishLog`) ⇒ **۱۸ یافتهٔ نقض** | VERIFIED |

## ۶. Build / Artifact

| # | دستور | خروجی | وضعیت |
|---|---|---|---|
| E24 | `ls -lT dist/index.html dist/assets` | `dist/index.html` = ۲۰۲۶-۱۰-۰۱ ۱۳:۴۸:۲۱ · `dist/assets/` پر | VERIFIED (artifact تازه) |
| E25 | بررسی `scripts/deploy.mjs` | ۲۱۶ خط · کدهای خروج `fail(2)` محیط نامعتبر · `fail(3)` production بدون `NODE_ENV` / نبود `PUBLIC_SITE_URL` · `fail(4)` نبود `node_modules` · `fail(5)` نبود وابستگی/اجراشدنی vite · `fail(6)` شکست `data:check` · `fail(7)` شکست build / نبود `dist/index.html` / artifact کهنه · `fail(8)` نبود عکس `dist` برای بازگردانی | VERIFIED (کد) |
| E26 | `node scripts/verify-all.mjs` (فهرست گام‌ها) | دقیقاً ۲۳ گام، `data:check` گام اول | VERIFIED |
| — | اجرای `vite build` در این نشست | **اجرا نشد** (قاعدهٔ پروژه: build بدون درخواست اجرا نمی‌شود) | UNVERIFIED (این نشست) |

## ۷. کیفیت / SEO / دسترسی‌پذیری (ایستا)

| # | دستور | خروجی | وضعیت |
|---|---|---|---|
| E27 | شمارش متا در `index.html` (۹۳ خط) | `<title>:1` · `description:2` · `og::5` · `twitter::0` · `canonical:0` · `JSON-LD:0` · `lang=:1` | VERIFIED |
| E28 | `ls public/ \| grep -Ei 'robots\|sitemap\|manifest'` | یافته‌ای نبود | VERIFIED (عدم وجود) |
| E29 | پیمایش `src/**/*.{js,jsx}` — شمارش توکنی | ۴۲۵ فایل · `<img>` = ۷۲ · `alt=` = ۷۱ · `aria-*` = ۱۷۶۵ · `role=` = ۳۴۲ · `tabIndex=` = ۲۸ | VERIFIED |
| E29b | پیمایش چندخطی پس از حذف کامنت‌ها (`/<img\b[\s\S]*?(\/>\|>)/`) | **۷۰ عنصر `<img>` واقعی · ۷۰ با `alt` · ۰ بدون `alt`** — اختلاف E29 یک توکن `<img>` داخل کامنت `CardEditor.jsx:110` بود | VERIFIED (تصحیح E29) |
| E30 | پیمایش `src/**/*.css` | ۵۵ فایل · `prefers-reduced-motion` = ۴۳ | VERIFIED |
| E31 | بررسی `src/router/routeHashes.js` | ۵۱ خط · ارجاع `#` = ۱۱ · `pushState` = ۰ ⇒ مسیریابی hash-based | VERIFIED |
| E32 | `node scripts/persistence-benchmark.mjs` (داخل دروازه) | exit 0 · هشدار: ستون `raw` شامل هزینهٔ سیستم فایل محیط است ⇒ مقایسه با ستون `overhead` | VERIFIED |
| E33 | ۶ فایل `dangerouslySetInnerHTML` | `ArticlePage.jsx` · `SopEditor.jsx` · `AdminContentEditor.jsx` · `MicroBlocks.jsx` · `ContentBlocks.jsx` (+ README) | VERIFIED (فهرست) |

## ۸. موارد تأییدنشده / مسدود

| # | مورد | دلیل |
|---|---|---|
| U1 | Staging واقعی | هیچ محیط staging/CI/Docker وجود ندارد ⇒ BLOCKED |
| U2 | Load test | نیازمند staging ⇒ BLOCKED |
| U3 | E2E جریان‌های حیاتی | هیچ ابزار E2E نصب نیست؛ تست رابط کاربری در این نشست ممنوع بود ⇒ BLOCKED |
| U4 | Core Web Vitals | بدون اندازه‌گیری مرورگر ⇒ UNVERIFIED |
| U5 | Responsive در viewportهای واقعی | بدون بررسی مرورگر ⇒ UNVERIFIED |
| U6 | تحویل واقعی publisher / AI / payment / monitoring | بدون توکن، sandbox و consumer واقعی ⇒ UNVERIFIED |
| U7 | Threat Model مکتوب | سندی یافت نشد ⇒ UNKNOWN |
| U8 | OpenAPI / قرارداد ماشین‌خوان | وجود ندارد ⇒ NOT FOUND |
| U9 | Migration نسخه‌دار | وجود ندارد ⇒ NOT FOUND |

## ۹. تصحیح یافته‌های نادرست (شفافیت)

**تصحیح ۱ — CSRF.** بازبینی اولیه بر پایهٔ `database/userSessions.js` نتیجه گرفته بود «نشست هدرمحور و بدون
کوکی ⇒ CSRF بی‌موضوع». این **نادرست** بود: کوکی نشست در `database/usersApi.js` ست می‌شود (`Set-Cookie` × ۳)
و CSRF با `assertSameOrigin` (۷ نقطه) پوشش دارد. ردیف‌های E17b/E17c اضافه شدند و برچسب مرحلهٔ ۲۲.۳
از «PARTIAL» به **VERIFIED** ارتقا یافت.

**تصحیح ۲ — `alt` تصاویر.** شمارش اولیهٔ E29 بر پایهٔ توکن، «۱ تصویر بدون `alt`» گزارش کرد. سنجش
چندخطی پس از حذف کامنت‌ها نشان داد **۷۰ از ۷۰** عنصر `<img>` واقعی `alt` دارند؛ تنها اختلاف یک توکن
`<img>` داخل **کامنت** `CardEditor.jsx:110` بود. یافتهٔ L-1/R-15 **باطل** شد.

**درس مشترک:** نبود (یا وجود) یک الگو در **یک** فایل یا در یک شمارش خط‌محور، مدرک قطعی نیست.
هر دو یافتهٔ نادرست از شمارش شکننده آمده بودند، نه از رفتار. برای اعداد ثابت، سنجش ساختاری چندخطی
پس از حذف کامنت‌ها لازم است.

---

## ۱۰. کار افزوده در ادامهٔ همین نشست

| # | مورد | دستور / فایل | خروجی واقعی | وضعیت |
|---|---|---|---|---|
| E34 | دروازهٔ تازهٔ ۲۴ گامه | `node scripts/verify-all.mjs` | **exit 0 · ۲۴/۲۴ سبز · ۳۷۲٫۵s** · «نتیجه: سبز» · گام تازه `e2e:api` سبز | VERIFIED |
| E35 | E2E سطح API (تازه) | `node scripts/e2e-api-flows.mjs` | **۲۷/۲۷ موفق · ۰ شکست · exit 0** (۲۷ پاسخ · ۰ بدون `X-Request-Id`) | VERIFIED |
| E35a | رفتارهای اثبات‌شده در E35 | — | `/healthz` ۲۰۰ · `/api/health` فقط `status,uptimeSeconds` · `POST /api/health` ۴۰۵ · SPA fallback ۲۰۰ · asset ناشناس ۴۰۴ · `/api/users/me` ۴۰۱ · `/api/admin/stats` ۴۰۱ · مسیر ناموجود admin **۴۰۴** · `logout` بدون `Origin` **۴۰۳** · `login` بدون `Origin` ۴۰۳ · `text/plain` **۴۱۵** · JSON نامعتبر **۴۰۰** · شمارهٔ ناموجود **۴۰۱ با `INVALID_CREDENTIALS`** · بدنهٔ ۱٫۲MB ⇒ **ECONNRESET** · تلاش نهم ⇒ **۴۲۹ + `Retry-After: 60`** · `/healthz` پس از ۴۲۹ ⇒ ۲۰۰ · هیچ بدنهٔ خطایی `stack`/مسیر مطلق ندارد · شکل خطای admin `{success:false,error:{code}}` · شکل خطای users `{error:"NOT_FOUND"}` · `GET /api/users?phone=…` ۴۰۴ | VERIFIED |
| E35b | اثبات حساسیت E35 (جهش کنترل‌شده) | حذف `assertSameOrigin(request)` از هندلر `logout` در `database/usersApi.js` | **۲۶/۲۷ · exit 1** با پیام دقیق «POST /api/users/logout بدون Origin ⇒ ۴۰۳ (CSRF) — status=200» | VERIFIED |
| E35c | بازگردانی پس از جهش | `cp` از پشتیبان + `shasum -a 256 -c` | `database/usersApi.js: OK` (هش `cd21f080…22dbd`) · اجرای بعدی E2E **۲۷/۲۷ · exit 0** | VERIFIED |
| E36 | Threat model (تازه) | `docs/security/threat-model.md` | ۱۰ دارایی · ۲۰ تهدید (`T-01…T-20`) · شمارش وضعیت: ۱۰ VERIFIED · ۵ CODE · ۶ OPEN | VERIFIED (سند) |
| E37 | تصمیم SEO (تازه) | `docs/ops/seo-strategy.md` | ۴ گزینه ارزیابی شد؛ پیشنهاد A (پایه) + C (prerender)؛ D رد؛ ۲ پیش‌نیاز بیرونی ثبت شد | VERIFIED (سند) |
| E38 | CI (تازه) | `.github/workflows/ci.yml` | ۳ job: `verify` (دروازه) · `build` (+ تأیید `dist/index.html`) · `audit` (`npm audit --audit-level=high` + hygiene). **اجرای واقعی دیده نشد** | UNVERIFIED (اجرا) |
| E39 | اسکریپت npm تازه | `package.json` | `"e2e:api": "node scripts/e2e-api-flows.mjs"` | VERIFIED |

**یافتهٔ تازهٔ E35a (LOW):** مسیر ناموجودِ `/api/admin/*` بدون احراز هویت **۴۰۴** می‌دهد نه ۴۰۱ ⇒
وجود/عدم وجود مسیر پیش از سنجش نشست تعیین می‌شود (enumeration در سطح مسیر). اثر کم است چون
فهرست مسیرها در باندل کلاینت عمومی است. رفتار فعلی در `e2e:api` **قفل** شد؛ رفع نیازمند
تغییر ترتیب در روتر ادمین است (ریسک: مسیرهای عمومی ادمین). ثبت در `threat-model.md` ردیف `T-08`.

**فایل‌های تغییریافته در این ادامه (کامل):**

| فایل | نوع تغییر |
|---|---|
| `scripts/e2e-api-flows.mjs` | **تازه** — E2E سطح API، ۲۷ سنجه |
| `.github/workflows/ci.yml` | **تازه** — pipeline |
| `docs/security/threat-model.md` | **تازه** — threat model |
| `docs/ops/seo-strategy.md` | **تازه** — تصمیم SEO |
| `scripts/verify-all.mjs` | ۱ خط — افزودن گام `e2e:api` (۲۳ → ۲۴ گام) |
| `package.json` | ۱ خط — اسکریپت `e2e:api` |
| `database/usersApi.js` | **صفر تغییر خالص** — برای اثبات حساسیت جهش خورد و بیت‌به‌بیت بازگردانده شد (`shasum -c` ⇒ OK) |

**دست‌نخورده ماند:** `src/**` (صفر تغییر) · `index.html` (تصمیم SEO پیاده نشد) · `dist/` · تاریخچهٔ Git ·
۷ فایل `content/*.json` با تغییرات commit‌نشدهٔ کاربر · `database/users.json` · `users.sessions.json`.

---

## ۱۱. ادامهٔ دوم — کشف و رفع یک آسیب‌پذیری واقعی XSS

| # | مورد | دستور / فایل | خروجی واقعی | وضعیت |
|---|---|---|---|---|
| E40 | سوییت رگرسیون XSS (تازه) | `node --test database/sanitizeHtmlXss.test.mjs` | **۱۴/۱۴ · exit 0** (۳۹ payload خصمانه · idempotence · کنترل‌های منفی · رگرسیون ساختاری sinkها) | VERIFIED |
| E41 | **اثبات وجود باگ (پیش از رفع)** | همان سوییت روی کد اصلی | **۱۲/۱۴ · exit 1** — دو شکست: «نشت از پاک‌ساز» و «idempotent نیست» | VERIFIED |
| E42 | اثبات تجربی باگ | `sanitizeHtml('<img src=x onerror=alert(1) title="unclosed>')` | خروجی **بایت‌به‌بایت** برابر ورودی ⇒ `onerror` زنده در مرورگر | VERIFIED (بحرانی) |
| E43 | اثبات حساسیت پس از رفع (جهش) | بازگرداندن عمدی escape به حالت قبل ⇒ اجرا ⇒ بازگردانی | **۱۲/۱۴ · exit 1** با پیام «`<` escape‌نشده در متن: `<img src=x onerror=alert(1) title="unclosed>`» · لاگ: `.workbuddy-ai/phase-logs/xss-mutation.log` · سپس **۱۴/۱۴ · exit 0** | VERIFIED |
| E44 | رگرسیون پاک‌ساز پس از تغییر | `node database/testBankSecurity.test.mjs` | **۴۰/۴۰** (بدون افت) | VERIFIED |
| E45 | دروازهٔ ۲۵ گامه | `node scripts/verify-all.mjs` | **exit 0 · ۲۵/۲۵ سبز · ۴۱۷٫۰s** · `xss:test` گام ۵ (۱۷٫۴s) | VERIFIED |

### دو باگ رفع‌شده در `database/sanitizeHtml.js`

| باگ | ریشه | رفع | قفل رگرسیون |
|---|---|---|---|
| **دور زدن XSS** | `TAG_RE` تگی با نقل‌قول بسته‌نشده را تطبیق نمی‌داد ⇒ تگ «متن» می‌شد و regex escape فقط `<`های **غیرحرف‌آغاز** را می‌گرفت (`/<(?![a-zA-Z/])/`) ⇒ `<img ... onerror=... title="unclosed>` خام بیرون می‌رفت | escape **همهٔ** `<`ها در قطعه‌های متن (ناوردایی: خروجی = متنِ escape‌شده + فقط تگ‌های خوش‌ساختِ فهرست سفید) | `xss:test` سنجهٔ ۱ و ۲ + `auditOutput()` |
| **`rel` ناامن و ناپایدار** | `rel` نویسنده در فهرست سفید بود و **اول** بیرون می‌آمد؛ مرورگر اولی را می‌خواند ⇒ `noopener` بی‌اثر. هر pass هم یک `rel` تازه می‌افزود ⇒ idempotent نبود | `rel` نویسنده جدا نگه داشته می‌شود؛ با وجود `target` فقط `rel` امن بیرون می‌دهد؛ بدون `target` `rel` نویسنده حفظ می‌شود | `xss:test` سنجهٔ ۳ (idempotence) و ۸ |

### رگرسیون ساختاری روی نقاط رندر

`xss:test` سنجهٔ ۱۲ فهرست `dangerouslySetInnerHTML` در `src/**/*.jsx` را می‌پیماید و تأیید می‌کند هر sink
از خروجی `sanitizeHtml` تغذیه می‌شود. **۵ sink واقعی** یافت شد؛ **۴** در زمان رندر دوباره پاک می‌کنند:
`MicroBlocks.jsx:241` · `ArticlePage.jsx:513` · `AdminContentEditor.jsx:122` · `SopEditor.jsx:245`.
**۱ استثنای مستند:** `ContentBlocks.jsx` (`markHtml` مقدار را دست‌نخورده برمی‌گرداند) که فقط به
پاک‌سازیِ مسیر نوشتن تکیه دارد. افزودن sink بی‌پاک‌سازِ تازه ⇒ شکست تست.

### فایل‌های تغییریافته در این ادامه

| فایل | تغییر |
|---|---|
| `database/sanitizeHtml.js` | **۲ رفع امنیتی** (+۲۲/−۵ خط) — فایل محافظت‌شده، تغییر همراه با تست رگرسیون مرتبط |
| `database/sanitizeHtmlXss.test.mjs` | **تازه** — ۱۴ سنجه |
| `scripts/verify-all.mjs` | ۱ خط — گام `xss:test` (۲۴ → ۲۵ گام) |
| `package.json` | ۱ خط — اسکریپت `xss:test` |

---

## ۱۲. ادامهٔ سوم — بستن آخرین شکاف رندر + baseline واقعی Performance

| # | مورد | دستور / فایل | خروجی واقعی | وضعیت |
|---|---|---|---|---|
| E46 | بستن استثنای پاک‌سازیِ زمان‌رندر | `src/layout/dashboard/courses/reference/reader/ContentBlocks.jsx` — `markHtml(sanitizeHtml(block.html), …)` + import (۲ خط) | فهرست استثنای `xss:test` **خالی** شد و تست **۱۴/۱۴ · exit 0** ماند ⇒ **۵ از ۵ sink** پاک‌سازیِ زمان‌رندر دارند | VERIFIED |
| E46a | ریسک‌سنجی پیش از تغییر | بررسی `referenceCatalog.js` برای `data-*` و کلاس‌های تولیدی | یافته‌ای نبود ⇒ پاک‌سازیِ ورودی `markHtml` برای محتوای مشروع **no-op** است | VERIFIED |
| E47 | ابزار بودجهٔ باندل (تازه) | `node scripts/bundle-budget.mjs` | **baseline واقعی از `dist/`**: کل **۲۰۰٫۸۹MB** / ۱۸۳ فایل · JS **۵٫۷۴MB** / ۱۹ chunk · CSS **۹۳۲KB** / ۱۰ chunk · بزرگ‌ترین chunk JS **۱٫۸۱MB** (`mockData`) · بزرگ‌ترین CSS **۷۲۸KB** · glb ۱۰۵٫۹۰MB · mp4 ۳۹٫۰۲MB · تصاویر ۴۸٫۱۰MB | VERIFIED |
| E48 | بررسی بودجه | `node scripts/bundle-budget.mjs --check` | **exit 0 · ۰ نقض** (۸ سقف سنجیده شد: ۸۷٪–۹۳٪ مصرف) | VERIFIED |
| E49 | اثبات حساسیت بودجه (جهش) | کاهش عمدی سقف `js.total` به ۱MB ⇒ `--check` ⇒ بازگردانی | **exit 1** با «✗ JS کل 5.74 MB / 1.00 MB (574%)» و «✗ 1 نقض بودجه: js.total» · لاگ: `.workbuddy-ai/phase-logs/bundle-mutation.log` · سپس **exit 0** | VERIFIED |
| E50 | دروازهٔ ۲۶ گامه | `node scripts/verify-all.mjs` | **exit 0 · ۲۶/۲۶ سبز · ۴۲۶٫۷s** · `perf:bundle` گام ۲۲ (۰٫۲s) · `xss:test` گام ۵ · `e2e:api` گام آخر | VERIFIED |

### چرا `perf:bundle` به build نیازی ندارد

`vite build` در این نشست بر اساس قاعدهٔ پروژه اجرا نشد، ولی **artifact موجود است** (۲۰۲۶-۱۰-۰۱ ۱۳:۴۸).
این ابزار از همان `dist/` می‌خواند ⇒ baseline واقعی می‌دهد بدون اجرای build. اگر `dist/` نباشد
(مثلاً در CI پیش از گام build) **صریحاً skip می‌کند** و پیام چاپ می‌شود تا «سبز کاذب» ساخته نشود.

### فایل‌های تغییریافته در این ادامه

| فایل | تغییر |
|---|---|
| `src/layout/dashboard/courses/reference/reader/ContentBlocks.jsx` | ۲ خط (import + `sanitizeHtml`) — **تنها فایل `src/` تغییرکردهٔ این نشست** |
| `database/sanitizeHtmlXss.test.mjs` | فهرست استثنا خالی شد |
| `scripts/bundle-budget.mjs` | **تازه** |
| `scripts/verify-all.mjs` | ۱ خط — گام `perf:bundle` (۲۵ → ۲۶ گام) |
| `package.json` | ۲ خط — `perf:bundle` · `perf:bundle:check` |
| `.github/workflows/ci.yml` | ۲ خط — گام بودجهٔ باندل در job `build` |

**`src/router/**` و `src/styles/**` دست‌نخورده · `index.html` دست‌نخورده · تاریخچهٔ Git دست‌نخورده.**
