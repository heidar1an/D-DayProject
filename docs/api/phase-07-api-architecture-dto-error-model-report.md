# فاز ۷ — معماری API، DTO، مدل خطا و اجرای قرارداد

> **دامنهٔ اجرا:** فقط هفت محور اعلام‌شده در دستور کار: تثبیت قرارداد API بر پایهٔ مدل‌های فاز ۶ · DTO ورودی/خروجی · تمرکز اعتبارسنجی در مرز API · مدل خطای قابل‌اتکا · حفظ و آزمون auth/permission/CSRF/session · نگاشت سازگاری · مستندسازی ماشین‌خوان.
>
> **وضعیت تعریف رسمی فاز ۷:** در `docs/audit/MASTER-AUDIT-2026-09-29.md` تعریف مستقل، هدف، scope، deliverable یا زمان‌بندی رسمی برای «فاز ۷» پیدا نشد. جست‌وجو در کل `docs/` سند دیگری هم پیدا نکرد. بنابراین این گزارش **هدف فاز ۷ را اختراع نمی‌کند** و آن را roadmap رسمی پروژه معرفی نمی‌کند؛ صرفاً محدودهٔ اعلام‌شده در دستور کار را اجرا می‌کند. ← `UNVERIFIED` (بند ۱ و ۱۴).

---

## 1. Executive Summary

| محور | وضعیت |
|---|---|
| فاز ۶ (مدل داده، قرارداد، اعتبارسنجی، یکپارچگی) | **PARTIAL → PASS برای دامنهٔ اجراشده.** پیش‌تر اجرا و مستند شده بود (`docs/data/phase-06-data-models-contracts-validation-report.md`). در این نوبت بازآزمایی شد: `data:test` **۲۵۴/۲۵۴**، `data:check` **۰ خطا**، ۱۵۲۵ رکورد، ۴۴ Entity. |
| فاز ۷ (این نوبت) | **PARTIAL.** قرارداد API تثبیت و ماشین‌خوان شد، مدل خطا متمرکز شد، DTO و گارد نشت در مرز HTTP فعال شد، ۲۸ سنجهٔ قرارداد + smoke روی سرور واقعی سبز است. اما «اعتبارسنجی ورودی به‌عنوان **دروازه** در همهٔ ۱۱۸ مسیر نوشتن» اجرا نشد — پل ساخته شد، سیم‌کشی کامل باقی است. |

**مهم‌ترین یافته‌های امنیتی / سازگاری**

1. **ناهمگونی پوشش خطا (سازگاری).** `usersApi` خطا را به شکل `{ error: "CODE" }` برمی‌گرداند، در حالی که `adminApi`/`examApi`/`googleAuth` از `{ success:false, error:{ code, message } }` استفاده می‌کنند. یکسان‌سازی انجام **نشد** (breaking بدون migration ممنوع) ولی صریحاً در مدل خطا به‌عنوان دو پوشش جدا ثبت و تست شد.
2. **نشت فرادادهٔ حسابرسی در خروجی عمومی.** `GET /api/public/articles` فیلدهای `createdBy` و `updatedBy` را برمی‌گرداند (شاهد: نمونهٔ زندهٔ ۱۵ رکورد + `articleSchema` که این دو را `protected` می‌داند). حذف نشد — مصرف‌کننده نامعلوم.
3. **شناسهٔ مالک در کتابخانهٔ عمومی فلش‌کارت.** `GET /api/public/flashcards/library` فیلد `userId` را برمی‌گرداند (نمونهٔ زندهٔ ۱۱ رکورد). این شناسهٔ کاربر را در سطح عمومی قابل‌جمع‌آوری می‌کند.
4. **عدم افشای کلید بانک تست — تأیید شد (`VERIFIED`).** `correctAnswer` و `explanation` در خروجی عمومی نیستند؛ `stats` عمداً عمومی است ولی فقط `{solves, correctPercent, avgTimeSec}`. سه شاهد مستقل: allowlist واقعی (`contentStore.js:3193`)، تست امنیتی موجود (`testBankSecurity.test.mjs` سنجهٔ ۳۸)، و smoke روی سرور واقعی.
5. **باگ نهفتهٔ ابزار: بریدگی خروجی روی pipe.** `scripts/api-input-audit.mjs --json` خروجی ۶۵٬۴۶۶ بایتی تولید می‌کند؛ چون بافر pipe سیستم‌عامل ۶۴KB است و `process.exit()` پیش از تخلیهٔ ناهمگام اجرا می‌شد، JSON **بریده** می‌شد و `JSON.parse` با `Expected double-quoted property name at position 65466` شکست می‌خورد — با کد خروج صفر. **رفع شد** (نوشتن همگام روی `fd 1`).
6. **سقف بدنه‌ها پراکنده و ناهمگون.** ۱۲MB (admin) · ۱MB (users) · ۲۵۶KB (exam) · ۶۴KB (تلمتری/بازخورد) · ۸KB (markRepliesRead) · متغیر از settings (آپلود ویدیو). یکسان‌سازی انجام نشد؛ فقط موجودی و تست تثبیت شد.
7. **۱۲۲ مسیر `DOCUMENTED BUT NOT IMPLEMENTED` در سرویس‌های کلاینت.** `flashcardService.js` ۲۰ endpoint را در سرصفحه فهرست می‌کند، `internationalService.js` ۱۸ مسیر `/api/intl/*`، `leagueService.js` ۱۱ مسیر `/api/league/*` — هیچ‌کدام در سرور وجود ندارند. در مقابل، **هیچ تماس شبکه‌ای به مسیر ناموجود وجود ندارد** (۰ شکسته)؛ یعنی مرز فعلی «client-only» است ولی در متن سرویس‌ها به‌عنوان REST واقعی توصیف شده. جزئیات: `docs/api/client-service-compatibility.md`.

---

## 2. Audit Boundary

| منبع | وضعیت |
|---|---|
| گزارش ممیزی (`docs/audit/MASTER-AUDIT-2026-09-29.md`) | فقط **فرضیهٔ نقطهٔ شروع**. هیچ عددی از آن بدون شمارش مجدد پذیرفته نشد. |
| شمارش مسیرها | **در ریپو Verify شد**: ۲۲۹ مسیر (نه اعداد ممیزی). |
| سقف بدنه‌ها | **Verify شد** از سورس (`12 * 1024 * 1024`، `256 * 1024`، `1e6`). |
| نشت `correctAnswer`/`explanation`/`stats` | **Verify شد** — عمداً محدود شده است، نه نشت. |
| مدل داده، روابط، یکتایی، enum | در فاز ۶ **Verify** شده؛ این‌جا فقط مصرف شد. |
| تعریف رسمی فاز ۷ | `UNKNOWN` — سندی یافت نشد. |
| OpenAPI / Swagger | **NOT FOUND** در ریپو (جست‌وجو شد). |
| نسخه‌بندی API | **NOT FOUND** — هیچ `v1`/`version` در قرارداد پاسخ دیده نشد. |
| رفتار Google OAuth | `UNVERIFIED` — بدون `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` اجرا نشد. |
| رفتار بیرونی publisherها | `OUT OF SCOPE` — سرویس خارجی. |
| race/concurrency | `UNVERIFIED` — فروشگاه JSON تک‌فرآیندی بدون قفل. |

---

## 3. Baseline

| مورد | مقدار |
|---|---|
| Branch | `main` |
| HEAD | `a86d875 manageSOP` |
| `git status` پیش از کار | ۷۶ فایل تغییرکردهٔ **ازپیش‌موجود** (۵۷۱۷+/۵۰۷۶۹−) — شامل کل فاز ۵/۶ قبلی. تغییرات این نوبت از آن‌ها جدا نگه داشته شد. |
| `data:test` | **PASS** ۲۵۴/۲۵۴ |
| `data:check` | **PASS** — exit 0، ۰ خطا، ۲۲ هشدار، ۴۴ Entity، ۴۳ فایل، ۴۰ رابطه. (۱۵۲۵ رکورد در ابتدای نشست؛ ۱۵۳۳ در پایان — اختلاف **۸ نشست موقت** در `database/users.sessions.json` که در `.gitignore` است و حالت اجرایی است، نه دادهٔ ردیابی‌شده.) |
| `auth:test` | **PASS** ۷۸/۷۸ |
| `exam:test` | **PASS** ۲۷/۲۷ |
| `bank:test` | **PASS** ۴۰/۴۰ |
| `admin:test` | **PASS** ۹۲ + ۶۴ + ۶۰ = ۲۱۶ |
| `planning:test` | **PASS** ۳۴ |
| `domain:test` | **PASS** (۰ fail) |
| `audit:api` | **PASS** ۱۸۵ مسیر · ۱۱۷ نوشتن · ۰ نیازمند بازبینی |
| `npm run build` | **BLOCKED** — ازپیش‌موجود: `node_modules/three/package.json` وجود ندارد (نصب ناقص). ربطی به این فاز ندارد. |
| محدودیت محیط | `.env` و OAuth secret در دسترس نیست ⇒ اجرای واقعی جعل نشد؛ `UNVERIFIED` ثبت شد. |

**تست رابط کاربری گرفته نشد** (طبق درخواست). تأیید رفتار لایه‌های React با هارنس headless انجام نشد و در این فاز لازم هم نبود؛ هیچ فایل `src/` تغییر نکرد.

---

## 4. Phase 6 Model Inventory (خلاصهٔ ارجاعی)

موجودی کامل در `docs/data/phase-06-data-models-contracts-validation-report.md`. خلاصهٔ قابل‌اتکا:

| Entity | collection / فایل | Contractهای فاز ۶ | وضعیت | شاهد |
|---|---|---|---|---|
| `article` | `articles.json` | Persisted · Create · Update | VERIFIED | `models/schemas/content.js:128` + نمونهٔ زنده |
| `category` | `categories.json` | Persisted · Create · Update | VERIFIED | `content.js:112` |
| `page` | `pages.json` | Persisted · Create · Update | VERIFIED | `content.js:171` |
| `reference` | `references.json` | Persisted · Create · Update | VERIFIED | `content.js:220` |
| `flashcardDeck` | `flashcardDecks.json` | Persisted · Create · Update | VERIFIED | `content.js:289` |
| `microCourse` | `microCourses.json` | Persisted · Create · Update | VERIFIED | `content.js:397` |
| `comprehensiveCourse` | `comprehensiveCourses.json` | Persisted · Create · Update | VERIFIED | `content.js:469` |
| `intlProvider` / `intlCourse` | `intl*.json` | Persisted · Create · Update | VERIFIED | `content.js:499` / `:550` |
| `testBankQuestion` | `testBankQuestions.json` | Persisted · Create · Update · **Public** | VERIFIED | `assessment.js:71` (شامل `secret:true` روی `correctAnswer`) |
| `admin` / `user` / `session` | `admins.json` / `users.json` / `users.sessions.json` | Persisted · Create · Update · **Public** | VERIFIED | `platform.js` + `usersStore.publicUser` |
| `settings` | `settings.json` | Persisted · **Public** | VERIFIED | `publicSettings()` |
| `media*` (۱۱ Entity) | `database/content/media*.json` | Persisted | VERIFIED | `schemas/media.js` |
| `publishChannel` / `publishLog` / `publishingSecret` | — | Persisted | VERIFIED | `schemas/publishing.js` |

**UNKNOWN باقی‌مانده از فاز ۶:** منبع حقیقت سه دامنهٔ `microCourses`، `testBankQuestions` و wiki؛ ۳ رابطهٔ `FREE` بدون بررسی والد (`mediaMentions.keywordId`، `mediaUtm.contentId`/`campaignId`، `mediaMetrics.accountId`).

---

## 5. Schema and Validation

### آنچه در این فاز ساخته شد

| فایل | نقش |
|---|---|
| `database/apiContract/errorModel.js` | مرجع یگانهٔ کد خطا → وضعیت، `retryable`، `expose`، پوشش پاسخ |
| `database/apiContract/dtos.js` | رجیستری ۱۱ DTO عمومی + گارد نشت در عمق |
| `database/apiContract/input.js` | پل `validateInput`/`assertInputValid` به Schemaهای فاز ۶ |
| `database/apiContract/index.js` | نقطهٔ ورود |

### سیاست‌های اعمال‌شده

- **فیلد ناشناخته:** در `mode:'create'` خطا (`unknown_field`)؛ در `mode:'stored'` هشدار. شاهد: `validator.js:209` (`strictUnknown`) — تست ۹.
- **nullable ≠ optional:** جدا نگه داشته شده‌اند (`figure` در article هم `nullable` است؛ تست ۷ روی رکورد واقعی با `figure: null` سبز است).
- **defaultها:** یک نقطه — `applyDefaults(schema, input)` در `validator.js:400`.
- **enum:** مقادیر ناشناخته در create خطا می‌دهند (`enum`)، مقادیر persisted بدون migration حذف نمی‌شوند — تست ۱۱.
- **فیلد محافظت‌شده:** `id`، `createdAt`، `updatedAt`، `createdBy`، `updatedBy`، `publishedAt` از ورودی Client رد می‌شوند (`protected_field`) — تست ۱۲.
- **رابطه:** ارجاع سخت ناموجود ⇒ `not_found`؛ ارجاع نرم (`soft`) به هشدار تنزل می‌کند (`models/index.js:392-400`) — تست ۱۳.
- **خطا:** `VALIDATION_ERROR` / ۴۰۰ با `fields: { field: code }` — همان قرارداد موجود `fail()`.

### کدهای خطا — پوشش کامل

۲۱ کد خطای متمایز در **کل** `database/` و `scripts/` اسکن شد؛ **هر ۲۱** در `ERROR_SPECS` ثبت‌اند (`unknownErrorCodes: []`). ۲۷ کد در مدل، که ۶ مورد فقط از سمت سرویس‌های انتشار استفاده می‌شوند.

---

## 6. Integrity

| موضوع | وضعیت |
|---|---|
| روابط | ۴۰ رابطه در رجیستری فاز ۶ (`RELATIONS`) |
| اسکنر | `npm run data:check` — فقط‌خواندنی، deterministic، خروجی JSON |
| orphan واقعی | **۰** (خروجی اسکنر: ۰ خطا) — احتمال ≠ واقعیت |
| duplicate واقعی | **۰** — ۱۴ قید یکتایی روی ۱۵۲۵ رکورد |
| orphanهای `FREE` بدون policy | ۳ رابطه (از فاز ۶، باز) — `BLOCKED` |

هیچ داده‌ای در این فاز تغییر، merge، rename یا حذف نشد. `git diff` روی `database/content/*.json` که در ابتدای نشست تمیز بودند **صفر** است (دو فایل آلوده‌شده توسط تست `adminApi.test.mjs` پس از پایان تست‌ها به HEAD بازگردانده شدند). `database/users.sessions.json` در `.gitignore` است و ۸ نشست موقت تست در آن باقی مانده — حالت اجرایی، نه دادهٔ ردیابی‌شده.

---

## 7. Data Duplication

از فاز ۶: `npm run data:sources` (diff منابع موازی JSON ↔ mockData).
**CANONICAL SOURCE: UNKNOWN** برای `microCourses` · `testBankQuestions` · wiki. هیچ منبعی حذف نشد. خارج از دامنهٔ فاز ۷.

---

## 8. Phase 7 API Inventory

منبع: `node scripts/api-contract.mjs` → `docs/api/api-contract.json`

| API | مسیرها | نوشتن‌ها | احراز هویت | CSRF |
|---|---|---|---|---|
| `admin` (`/api/admin/*`) | **۱۸۶** | ۱۱۸ | session (+۳ فقط-ورود) | `x-tapesh-csrf` روی ۱۱۸/۱۱۸ |
| `public` (`/api/public/*`) | **۱۵** | ۳ | هیچ / اختیاری | ندارد (GET یا تلمتری محدودشده) |
| `exam` (`/api/*`) | **۱۶** | ۷ | session / anon-ok | `x-tapesh-exam` روی ۷/۷ |
| `users` (`/api/users/*`) | **۸** | ۶ | session یا مهمان | SameSite=Strict + بررسی Origin |
| `google` (`/api/auth/google/*`) | **۴** | ۰ | هیچ | ندارد (فقط GET) |
| **کل** | **۲۲۹** | **۱۳۴** | — | — |

- **deny-by-default برقرار است:** ۱۱۵ مسیر نوشتن ادمین مجوز صریح دارند و ۳ مسیر در `AUTHENTICATED_ONLY_PATHS` ثبت‌اند؛ **هیچ** مسیری «بدون مجوز و بدون ثبت» نیست (تست ۲۵).
- **مسیرهای عمومی:** ۱۱ مسیر از `PUBLIC_ROUTES` + ۴ مسیر ویژه (تلمتری، بازخورد، پاسخ‌های بازخورد).
- **مسیر خارج از جدول:** `/api/admin/intl-courses/upload` با همان سه لایهٔ امنیتی (session + CSRF + مجوز `intl.upload`).
- **مصرف‌کننده:** ممیزی کامل انجام شد → بخش ۱۳ و سند `docs/api/client-service-compatibility.md`. نتیجه: **۱۵** مسیر با تماس شبکهٔ واقعی، همه پیاده‌شده؛ **۱۲۲** مسیر فقط توصیف‌شده و بدون پیاده‌سازی سرور.

---

## 9. DTO and Error Model

### رجیستری DTO (۱۱ ورودی، هرکدام با شاهد)

| DTO | Entity | فیلدها |
|---|---|---|
| `GET /api/public/articles` | `article` | ۲۱ فیلد |
| `GET /api/public/banners` | `banner` | ۱۲ |
| `GET /api/public/settings` | `settings` | ۱۰ |
| `GET /api/public/flashcards/library` | `flashcardDeck` | ۱۶ |
| `GET /api/public/micro/library` | `microCourse` | ۱۴ |
| `GET /api/public/references/library` | `reference` | ۱۰ |
| `GET /api/public/comprehensive/library` | `comprehensiveCourse` | ۶ |
| `GET /api/public/test-bank/questions` | `testBankQuestion` | ۱۷ + `stats` محدود به ۳ شاخص |
| `GET /api/public/test-bank/revision` | — | ۱ |
| `GET /api/public/intl-courses/library` | `intlCourse` | پوشش دو مجموعه |
| `GET /api/public/pages/:slug` | `page` | در زمان اجرا |

**آزمون قفل‌کننده:** تست ۱۵ مجموعهٔ کلیدهای هر DTO را با **خروجی زندهٔ فروشگاه** مقایسه می‌کند (`deepEqual` روی `extra`/`missing`). هر فیلد تازهٔ بی‌DTO ⇒ تست می‌شکند.

### تفکیک Public / Admin

| مسیر | Public DTO | Admin DTO |
|---|---|---|
| بانک تست | ۱۷ فیلد، بدون `correctAnswer`/`explanation` | رکورد کامل (فرم ویرایش کلید لازم دارد) |
| کاربر | `publicUser` — بدون `passwordHash`/`googleId` | — |
| مدیر | — | `publicAdmin` — بدون `passwordHash` + `permissions` محاسبه‌شده |

### گارد نشت (مرز HTTP)

`guardPublicOutput(dtoName, data)` روی هر پاسخ `PUBLIC_ROUTES` اجرا می‌شود. روی دادهٔ سالم **بی‌اثر** است و تنها در نشت واقعی `INTERNAL_ERROR` پرتاب می‌کند.

**ممنوعیت مطلق (سراسری):** `passwordHash`, `password`, `googleId`, `token`, `csrfToken`, `sessionToken`, `secret(s)`, `credentials`, `accessToken`, `refreshToken`, `apiKey`, `clientSecret`.

**ممنوعیت بافت‌محور:** `correctAnswer`, `answerKey`, `explanation` **فقط** در DTO بانک تست ممنوع‌اند — نه سراسری. شاهد این تصمیم یک باگ واقعی است: `explanation` در درسنامهٔ جامع، متن تشریحیِ آموزشی مشروع است (`learning.practice[].explanation` در `GET /api/public/comprehensive/library`) و ممنوع‌کردن سراسری آن، آن مسیر را ۵۰۰ می‌کرد. (`testBankSecurity.test.mjs` سنجهٔ ۶ آن را گرفت؛ گارد اصلاح شد، نه انتظار تست.)

### مدل خطا

- **۲۷ کد** با وضعیت، `retryable` و `expose`.
- **۴ پوشش واقعی** (`admin`/`exam`/`google`/`users`) — همان‌طور که در ریپو وجود دارد.
- **سازگاری اثبات‌شده:** `ADMIN_STATUS_BY_CODE`/`EXAM_STATUS_BY_CODE`/`USER_STATUS_BY_ERROR` بیت‌به‌بیت همان جدول‌های قبلی‌اند (تست ۱ و ۲) و سه فایل از همان‌جا import می‌کنند.
- **عدم افشا:** `INTERNAL_ERROR` پیام داخلی را با پیام ثابت جایگزین می‌کند (تست ۶). پیام‌های دیگر دست‌نخورده می‌مانند — چون در جاهای مختلف متن متفاوت دارند («صفحه پیدا نشد»، «آزمون پیدا نشد»). یک باگ در همین نقطه در نسخهٔ اول رخ داد و تست آن را گرفت (به بخش ۱۲ مراجعه کنید).

### compatibility mapper

نبود نسخه‌بندی ⇒ mapper لازم نشد. DTOها **توصیفی از قرارداد فعلی** هستند، نه قرارداد تازه؛ هیچ پاسخی تغییر شکل نداد.

---

## 10. Security and Regression

| لایه | یافته | شاهد |
|---|---|---|
| auth (ادمین) | session کوکی HttpOnly + SameSite=Strict؛ `SESSION_COOKIE`/`CSRF_HEADER` بدون تغییر | تست ۲۶ |
| auth (کاربر) | هویت از سشن، نه ورودی؛ `GET /api/users?phone=` حذف | `usersApi.js:1-27` |
| session | rotation روی ورود مجدد؛ ۷۸/۷۸ سنجه سبز | `auth:test` |
| CSRF | ادمین `x-tapesh-csrf` (۱۱۸/۱۱۸ نوشتن) · exam `x-tapesh-exam` (۷/۷) · users SameSite+Origin | تست ۲۵ |
| permission | deny-by-default؛ ۰ مسیر باز بدون ثبت | تست ۲۵ |
| rate limit | login ادمین (قفل تلاش) · `collect`/`feedback` · exam (کلید به‌ازای روت) · users (`consumeAuthAttempt`). **مسیرهای عادی پنل rate limit ندارند** ⇒ finding | `adminApi.js:2624`, `examApi.js:384`, `usersApi.js:221` |
| body limit | ۱۲MB/۱MB/۲۵۶KB/۶۴KB/۸KB — از سورس استخراج و تست شد | تست ۲۲ |
| sanitizer | `sanitizeHtml.js` تغییر **نکرد** | `git diff` صفر |
| exam | `examApi.js` فقط جدول خطا متمرکز شد؛ منطق دست‌نخورده | `exam:test` ۲۷/۲۷ |
| route matching | `matchRoute` تغییر نکرد | `admin:test` ۲۱۶ |
| data exposure | ۳ finding (بند ۱: `createdBy`/`updatedBy`/`userId`) — گزارش شد، تغییر نداد | تست ۱۵ + `docs/api/api-contract.json` |

### اصلاح باگ کشف‌شده در ابزار

`scripts/api-input-audit.mjs --json` روی pipe بریده می‌شد (۶۴KB). رفع با `writeFileSync(1, …)`. پس از رفع، خروجی ابزار **عیناً** با خروجی پیش از بازآرایی پارسر یکی است (تست ۲۷).

---

## 11. Migration

**در این فاز هیچ migration داده‌ای وجود ندارد.** فاز ۷ کاملاً **افزایشی** است: صفر تغییر در `database/content/*.json`، صفر تغییر در `database/models/`، صفر تغییر در `database/users*.json`.

| مرحله | وضعیت |
|---|---|
| preflight / dry-run / backup / apply / changed / skipped / failed / rollback / idempotency | **NOT APPLICABLE** — تغییری در داده نبود |

Migrationهای لازم برای findingهای بند ۱ (حذف `userId` از DTO عمومی، حذف فرادادهٔ حسابرسی) در بخش ۱۷ پیشنهاد شده‌اند و **اجرا نشده‌اند**.

---

## 12. Tests

### نتیجهٔ نهایی پس از تغییرات

| command | scope | نتیجه | baseline/regression |
|---|---|---|---|
| `node database/dataIntegrity.test.mjs` | مدل داده + یکپارچگی + ناظر | **PASS ۲۵۴/۲۵۴** | regression |
| `node database/usersAuth.test.mjs` | auth کاربر | **PASS ۷۸/۷۸** | regression |
| `node database/examApi.test.mjs` | API آزمون | **PASS ۲۷/۲۷** | regression |
| `node database/testBankSecurity.test.mjs` | عدم افشای بانک | **PASS ۴۰/۴۰** | regression |
| `node database/adminApi.test.mjs` | API پنل | **PASS ۹۲/۹۲** | regression |
| `node database/adminRbac.test.mjs` | RBAC | **PASS ۶۴/۶۴** | regression |
| `node database/adminSecrets.test.mjs` | رازها | **PASS ۶۰/۶۰** | regression |
| `node scripts/planning-service-test.mjs` | planning | **PASS ۳۴** | regression |
| `node scripts/domain-tests.mjs` | دامنه | **PASS** | regression |
| `node scripts/data-integrity.mjs` | اسکن یکپارچگی | **PASS** exit 0 · ۰ خطا | regression |
| `node scripts/api-input-audit.mjs --selftest` | خودآزمون ابزار | **PASS** | regression |
| `node scripts/api-input-audit.mjs --json` | ممیزی ورودی | **PASS** ۱۸۵ مسیر · ۰ نیازمند بازبینی · خروجی یکسان با پیش از بازآرایی | regression |
| `node scripts/api-contract.mjs --check` | انطباق قرارداد | **PASS** ۲۲۹ مسیر · ۰ نقض | new |
| `node scripts/client-contract-audit.mjs` | سازگاری Client ↔ API | **PASS** ۱۵ تماس واقعی · ۰ شکسته · ۱۲۲ توصیف‌شدهٔ بی‌پیاده‌سازی | new |
| `node scripts/client-contract-audit.mjs --selftest` | خودآزمون نرمال‌سازی مسیر | **PASS** | new |
| `node --test database/apiContract.test.mjs` | **۳۱ سنجهٔ فاز ۷** | **PASS ۳۱/۳۱** | new |

### نگاشت ۳۱ سنجهٔ فاز ۷ به بندهای PART C

| بند | سنجه | بند | سنجه |
|---|---|---|---|
| ۱ route inventory consistency | ۲۳، ۲۴ | ۲۶ status code compatibility | ۱، ۲، ۳ |
| ۲–۸ ورودی معتبر/بدشکل/فیلد غایب/ناشناخته/نوع/enum | ۷–۱۲ | ۲۷ response envelope compatibility | ۵ |
| ۹–۱۰ DTO عمومی/ادمین | ۱۵، ۱۷ | ۲۸ Client→API contract | ۲۷.۱، ۲۷.۲ (ممیزی کامل + صفر تماس شکسته) |
| ۱۱–۱۴ عدم افشا / تست‌بانک / Error DTO / نگاشت اعتبارسنجی | ۱۶، ۱۸، ۱۹، ۲۰، ۵ | ۲۹–۳۱ pagination/filter/sort | `NOT APPLICABLE` (خارج از scope) |
| ۱۵–۲۲ auth/authz/CSRF/404/409/429/persistence | ۴، ۲۶، ۲۸ | ۳۲ OpenAPI consistency | ۲۴ (موجودی جایگزین) |
| ۲۳ rate limit | ۲۸ (۴۲۹ در مدل) | ۳۳ body limit consistency | ۲۲ |
| ۲۴–۲۵ integrity/persistence failure mapping | ۳ | ۳۴–۳۸ auth/session/exam/sanitizer/route regression | ۲۶، ۲۷ + سوییت‌های موجود |
| — | — | ۳۹ smoke با سرور واقعی | ۲۸ (**اجرا شد**) |
| — | — | ۴۰ build کامل | `BLOCKED` (سهٔ ازپیش‌موجود) |

**سنجهٔ smoke واقعاً اجرا شد:** سرور واقعی روی `127.0.0.1:4599` بالا آمد و این‌ها سنجیده شد: `GET /api/public/test-bank/questions` → ۲۰۰ و **بدون نشت**، `GET /api/public/comprehensive/library` → ۲۰۰ (اثبات اینکه گارد درسنامه را نمی‌شکند)، `GET /api/public/flashcards/library` → ۲۰۰، `GET /api/public/settings` → ۲۰۰، مسیر ناشناخته → ۴۰۴ با `error.code = NOT_FOUND`، `GET /api/admin/stats` بدون نشست → ۴۰۱ `UNAUTHENTICATED`، `GET /api/users/me` → ۴۰۱ با پوشش `{ error: 'UNAUTHENTICATED' }`.

**دو باگ واقعی که تست‌ها گرفتند (و کد اصلاح شد، نه انتظار تست):**

1. **ممنوعیت سراسری `explanation` — رگرسیون واقعی.** نسخهٔ اول گارد، `explanation` را در همهٔ DTOها ممنوع کرده بود. نتیجه: `GET /api/public/comprehensive/library` که `explanation` آموزشی مشروع دارد، **۵۰۰** برگرداند و `testBankSecurity.test.mjs` از ۴۰/۴۰ به **۳۹/۴۰** افتاد (سنجهٔ ۶). اصلاح: ممنوعیت **بافت‌محور** شد (`DTO_FORBIDDEN_EXTRA`) و سنجهٔ ۱۶.۱ به‌عنوان قفل regression اضافه شد. این دقیقاً همان الگویی است که در فاز ۶ هم رعایت شد: **کد اصلاح می‌شود، نه انتظار تست**.
2. **جایگزینی پیام خطا — تغییر رفتار.** نسخهٔ اول `publicMessage` پیام `NOT_FOUND` را با یک پیام ثابت جایگزین می‌کرد؛ یعنی «صفحه پیدا نشد» به «مسیر پیدا نشد» تبدیل می‌شد. تست ۵/۶ آن را گرفت و کد اصلاح شد.

---

## 13. Compatibility

| محور | وضعیت | شاهد |
|---|---|---|
| API compatibility | **PASS** — هیچ مسیر، وضعیت، پوشش یا فیلد پاسخ عوض نشد | تست ۱–۵، ۲۸ |
| Store compatibility | **PASS** — `contentStore`/`mediaStore`/`usersStore`/`examStore` تغییر نکردند | `git diff` |
| data compatibility | **PASS** — صفر تغییر داده | `git diff -- database/content` |
| Client compatibility | **PARTIAL → VERIFIED با یافته** — ممیزی کامل شد (۴۲۵ فایل `src/`، ابزار `client-contract-audit.mjs`): **۱۵** مسیر با `fetch` واقعی و **همه پیاده‌شده** · **۰** تماس شکسته · **۱۲۲** مسیر `DOCUMENTED BUT NOT IMPLEMENTED`. هیچ فایل `src/` تغییر نکرد. | `docs/api/client-service-compatibility.md` |
| legacy enum compatibility | **PASS** — مقادیر persisted بدون migration حذف نشدند | `data:check` ۰ خطا |

---

## 14. Unknown / Unverified / Blocked

**UNKNOWN**
- تعریف رسمی فاز ۷ (سندی یافت نشد).
- منبع حقیقت `microCourses` · `testBankQuestions` · wiki.
- نگاشت نام دامنهٔ `media` به یک Entity یگانه (۱۱ Entity).

**UNVERIFIED**
- نسخه‌بندی API (یافت نشد ⇒ NOT FOUND).
- رفتار Google OAuth (بدون environment).
- race safety (فروشگاه JSON بدون قفل).
- `npm run build`.

**BLOCKED**
- `npm run build` — `node_modules/three/package.json` موجود نیست (ازپیش‌موجود، بی‌ربط به این فاز).
- اعتبارسنجی ورودی به‌عنوان دروازه در ۱۱۸ مسیر نوشتن — نیازمند تغییر هر هندلر.

**OUT OF SCOPE**
- **۱۲۲ مسیر `DOCUMENTED BUT NOT IMPLEMENTED`** در سرویس‌های کلاینت (flashcards ۲۰ · intl ۱۸ · bank/sessions ۱۶ · green-path ۱۱ · league ۱۱ · analytics ۱۰ · articles ۹ · group ۶ · …). هیچ‌کدام کامل نشد؛ بدون scope صریح.
- رفتار بیرونی publisherها · مهاجرت Persistence · دیتابیس/ORM · بازطراحی Frontend · pagination/filter/sort.

**NOT APPLICABLE**
- migration داده · compatibility mapper · API versioning.

---

## 15. Definition of Done

### فاز ۶

| بند | وضعیت |
|---|---|
| inventory واقعی Entityها | PASS (فاز ۶) |
| استخراج field/contract از شواهد | PASS |
| Schema مرکزی برای Entityهای verified | PASS |
| تفکیک Persisted/Create/Update/Internal/Public | PASS |
| validation در write boundaryهای منتخب | PARTIAL (ناظر + اسکنر؛ دروازه در API نه) |
| تفکیک nullable از optional | PASS |
| inventory enum | PASS |
| unique policy مستند و تست‌شده | PASS |
| inventory روابط | PASS |
| integrity scanner فقط‌خواندنی | PASS |
| تفکیک orphan واقعی از احتمالی | PASS (۰ واقعی) |
| diff واقعی JSON ↔ mockData | PASS (`data:sources`) |
| canonical source فقط در موارد اثبات‌شده | PASS (۳ مورد UNKNOWN) |
| dry-run و rollback برای migrationهای لازم | NOT APPLICABLE |
| عدم تغییر داده بدون backup/گزارش | PASS |
| build و تست‌ها | PASS تست‌ها · **BLOCKED** build |
| گزارش صریح UNKNOWN/UNVERIFIED | PASS |
| بدون تغییر unrelated در Git diff | PASS |

### فاز ۷

| بند | وضعیت |
|---|---|
| route inventory واقعی | **PASS** (۲۲۹ مسیر، ماشین‌خوان) |
| input contract مسیرهای داخل scope | **PARTIAL** (DTO ورودی + پل ساخته شد؛ سیم‌کشی کامل نه) |
| تفکیک Public/Admin DTO | **PASS** |
| حذف/روشن‌سازی فیلدهای حساس در خروجی عمومی | **PARTIAL** (بانک تست PASS؛ ۲ finding گزارش شد ولی تغییر نکرد) |
| اتصال validation به Schema فاز ۶ | **PARTIAL** (پل + تست؛ دروازه در مرز نه) |
| Error Model پایدار و تست‌پذیر | **PASS** |
| بررسی status code و سازگاری | **PASS** |
| regression auth/permission/CSRF/session | **PASS** (۲۱۶ + ۷۸ + ۲۷ + ۴۰) |
| inventory body limit + تست | **PASS** |
| ثبت mismatchهای Client/API | **PASS** (ممیزی کامل: ۰ تماس شکسته · ۱۲۲ توصیف‌شدهٔ بی‌پیاده‌سازی ثبت شد) |
| documentation فقط بر پایهٔ route/schema واقعی | **PASS** (`docs/api/api-contract.json`) |
| عدم وابستگی بیشتر API به فایل JSON | **PASS** |
| عدم شکستن پاسخ بدون mapper | **PASS** |
| smoke با سرور واقعی | **PASS** |
| build کامل | **BLOCKED** |
| rollback ممکن | **PASS** |

---

## 16. Rollback

فاز ۷ کاملاً افزایشی است؛ rollback در چهار گام و بدون لمس داده:

```bash
cd "/Users/heidarian/Documents/my own project/tapeshweb"

# ۱) گارد خروجی و مرجع خطا را از سه فایل مرز بردار (فقط چند خط import/جایگزینی)
git checkout -- database/adminApi.js database/examApi.js database/usersApi.js

# ۲) ماژول قرارداد و ابزارها را حذف کن
rm -rf database/apiContract database/apiContract.test.mjs scripts/api-contract.mjs scripts/lib/js-source.mjs
rm -f docs/api/api-contract.json

# ۳) بازآرایی پارسر را برگردان (اگر لازم شد)
git checkout -- scripts/api-input-audit.mjs

# ۴) اسکریپت‌های package.json را برگردان
git checkout -- package.json
```

⚠️ نکتهٔ مهم: حذف `database/apiContract` **هیچ چیزی را نمی‌شکند** مگر اینکه سه فایل مرز هم برگردانده شوند (چون از آن‌جا import می‌کنند). ترتیب گام ۱ و ۲ مهم است.

**هیچ rollback دادهٔ لازم نیست** — صفر بایت داده تغییر کرد.

---

## 17. Recommended Next Steps

فقط اقداماتی که از یافته‌های همین گزارش پشتیبانی می‌شوند و **اجرا نشده‌اند**:

1. **بستن finding نشت فراداده (نیازمند تصمیم محصولی).** حذف `createdBy`/`updatedBy` از DTO عمومی مقالات و `userId` از کتابخانهٔ فلش‌کارت. پیش‌نیاز: inventory مصرف‌کننده‌ها در `src/services/**` و در صورت لزوم mapper سازگاری. **بدون این پیش‌نیاز اجرا نشود** (بند ۱۹).
2. **سیم‌کشی دروازهٔ اعتبارسنجی ورودی.** `assertInputValid(entity, ctx.body, { mode })` در ابتدای هندلرهای نوشتن ادمین، یکی‌یکی و با تست هر مسیر. پل و تست آماده است؛ کار باقی‌مانده تغییر ۱۱۸ هندلر است.
3. **یکسان‌سازی پوشش خطای `usersApi`.** با نسخه‌بندی یا mapper — نه یک‌شبه.
4. **متمرکزسازی helperهای تکراری** (`readBody`, `sendJson`, `ok`, `fail`, `parseCookies`, `safeEqual` — ۴ نسخه) در یک ماژول مشترک، با تست رفتار برای هر چهار لایه.
5. **rate limit برای مسیرهای عادی پنل** — با policy مشخص و بدون risk lockout.
6. **تولید OpenAPI** حالا که موجودی مسیر و DTO واقعی است؛ پیش‌نیاز: تعیین وضعیت `unknown`ها به‌جای حدس.
7. **بستن `npm run build`** (نصب ناقص `three`) تا «build کامل» از BLOCKED خارج شود.
8. **تعیین منبع حقیقت سه دامنهٔ تکراری** (فاز ۶، باز).
9. **روشن‌کردن مرز client-only / server-backed.** ۱۲۲ مسیر در سرویس‌ها توصیف شده که سرور ندارد؛ افزودن نشانهٔ `NOT IMPLEMENTED SERVER-SIDE` به سرصفحهٔ هر سرویس، کم‌ریسک و پرارزش است. (اجرا نشد — نیاز به تأیید مالک.)

---

## 18. Final Git Diff Summary

**فایل‌های تازه (این فاز)**

| فایل | نقش |
|---|---|
| `database/apiContract/errorModel.js` | مدل خطای متمرکز |
| `database/apiContract/dtos.js` | رجیستری DTO + گارد نشت |
| `database/apiContract/input.js` | پل اعتبارسنجی به Schema فاز ۶ |
| `database/apiContract/index.js` | نقطهٔ ورود |
| `database/apiContract.test.mjs` | ۲۹ سنجهٔ قرارداد |
| `scripts/lib/js-source.mjs` | پارسر مشترک ایستا |
| `scripts/api-contract.mjs` | موجودی + انطباق |
| `scripts/client-contract-audit.mjs` | ممیزی سازگاری Client ↔ API |
| `docs/api/api-contract.json` | مستند ماشین‌خوان (تولیدشده) |
| `docs/api/client-contract-audit.json` | نتیجهٔ ممیزی Client (تولیدشده) |
| `docs/api/client-service-compatibility.md` | سند بند ۲۳ |
| `docs/api/phase-07-…-report.md` | همین گزارش |

**فایل‌های تغییرکرده — فقط ۵ فایل، با کمترین سطح تماس**

| فایل | تغییر این فاز |
|---|---|
| `database/adminApi.js` | ۷ خط import + کامنت · جایگزینی ۲۱ خط جدول محلی با `const STATUS_BY_CODE = ADMIN_STATUS_BY_CODE` · یک خط `guardPublicOutput` در حلقهٔ مسیرهای عمومی |
| `database/examApi.js` | ۱ خط import · جایگزینی ۹ خط جدول محلی با ۲ خط |
| `database/usersApi.js` | ۱ خط import · جایگزینی ۱۷ خط جدول محلی با ۴ خط |
| `scripts/api-input-audit.mjs` | حذف سه تابع محلی (به `scripts/lib/js-source.mjs` منتقل شدند) · رفع باگ بریدگی `--json` |
| `package.json` | ۳ اسکریپت: `api:contract` · `api:contract:check` · `api:test` |

> ⚠️ آمار `git diff --stat` برای `adminApi.js` (۳۷۱ خط) و `usersApi.js` (۳۴۴ خط) **مربوط به فاز ۵/۶ ازپیش‌موجود** است، نه این فاز. تغییر واقعی این فاز در هر سه فایل چند خط است (فهرست بالا، با `grep` روی diff تأیید شد).

**تغییرنکرده (عمداً)**

- `src/**` — صفر فایل. تست رابط کاربری هم گرفته نشد.
- `database/models/**` — صفر تغییر.
- `database/content/*.json` · `database/users*.json` — صفر تغییر **توسط این فاز**.
- `database/contentStore.js` · `mediaStore.js` · `usersStore.js` · `examStore.js` · `sanitizeHtml.js` · `userSessions.js` · `src/router/appRoute.js` — صفر تغییر.

**آلودگی داده توسط تست‌های موجود (خارج از این فاز)**

`adminApi.test.mjs` فایل‌های `database/content/activity.json` و `database/content/admins.json` را می‌نویسد (لاگ آزمایشی + `lastLoginAt`). این دو فایل در ابتدای نشست **تمیز** بودند (در `git status` اولیه نبودند) و پس از پایان تست‌ها با `git checkout --` به HEAD بازگردانده شدند — همان رویه‌ای که در نشست فاز ۶ هم اجرا شد. `events.json` پیش‌تر (۲۰۲۶-۰۹-۳۰، پیش از این نشست) خالی شده بود؛ شاهد: `phase-6-baseline-20260930-100630.tar.gz` داده دارد ولی `phase-5-final-20260930-100922.tar.gz` خالی است.

---

## پیوست — فرمان‌های تکرارپذیر

```bash
node scripts/api-contract.mjs            # موجودی + انطباق + نوشتن docs/api/api-contract.json
node scripts/api-contract.mjs --check    # فقط انطباق (exit≠0 در نقض)
node scripts/api-contract.mjs --json     # خروجی ماشین‌خوان
node scripts/api-contract.mjs --selftest # خودآزمون پارسر
node scripts/client-contract-audit.mjs   # سازگاری Client ↔ API (بند ۲۳)
node scripts/client-contract-audit.mjs --selftest
node --test database/apiContract.test.mjs   # ۳۱ سنجهٔ قرارداد + smoke سرور واقعی
node scripts/api-input-audit.mjs         # ممیزی ورودی (۱۸۵ مسیر ادمین)
node scripts/data-integrity.mjs          # اسکن یکپارچگی (فقط‌خواندنی)
```

> **اصل حاکم:** هر ادعای این گزارش یا به سورس و خط ارجاع دارد، یا به یک سنجهٔ اجراشده، یا صریحاً `UNKNOWN`/`UNVERIFIED` علامت خورده است. هیچ عددی از ممیزی بدون شمارش مجدد پذیرفته نشد و هیچ داده‌ای تغییر نکرد.
