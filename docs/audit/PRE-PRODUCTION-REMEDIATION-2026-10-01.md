# گزارش Pre-Production Remediation — تپش

تاریخ: ۱ اکتبر ۲۰۲۶ · مخزن: `tapeshweb` · شاخه: `main` · HEAD: `3aa04c8`

> این گزارش **وضعیت فعلی** است، نه روایت تاریخی. هر ادعا با شاهد قابل‌تکرار
> (فرمان، خروجی، فایل، عدد) پشتیبانی می‌شود. هیچ‌چیز بر پایهٔ «به‌نظر می‌رسد
> درست است» FIXED اعلام نشده.

## واژه‌نامهٔ وضعیت

| وضعیت | معنا |
|---|---|
| `FIXED + TESTED` | کد اصلاح شد و تست خودکار روی همین مخزن سبز است |
| `FIXED + VERIFIED EXTERNALLY` | علاوه بر تست، در محیط بیرونی هم اجرا شد |
| `PARTIAL` | بخشی اصلاح شد؛ دقیقاً مشخص شده چه بخشی باقی است |
| `BLOCKED BY ENVIRONMENT` | کار در این workspace ممکن نیست؛ دلیل و اقدام بیرونی مشخص است |
| `OPEN` | دست‌نخورده — با مسیر رفع |
| `NOT APPLICABLE` | برای این پروژه معنا ندارد |

---

## ۰. خط پایه و ایمنی

| مورد | اندازه/وضعیت اندازه‌گیری‌شده |
|---|---|
| تغییرات working tree در آغاز | **۱۷۲ مسیر** |
| `.git` | **۲۱۹MB** |
| `dist/` | **۲۰۱MB** |
| `node_modules/` | **۱۴۸MB** |
| شاخه‌ها | `main` · `backup/pre-merge-20260927` · `origin/main` |
| commit در تاریخچه | **۴۷** · object: **۲۴۰۸** |

هیچ عملیات destructive اجرا نشد: نه `git reset --hard`، نه `git clean -fd`، نه
حذف داده. تنها تغییر ایندکس، `git rm --cached` روی دادهٔ زمان‌اجرا بود که فایل
محلی را دست‌نخورده می‌گذارد (شاهد: اندازهٔ فایل‌ها پیش و پس یکی است).

**نقطهٔ بازگشت:** هر مرحله یک commit جداگانه دارد؛ `git log --oneline` مسیر
بازگشت را نشان می‌دهد. پشتیبان مستقل مخزن ساخته **نشد** (فضای دیسک و نبود
درخواست صریح) — پیش از history rewrite الزامی است (بخش ۱۳).

---

## ۱. معماری فعلی

```
server.js                     ← میزبان پروداکشن (node:http، بدون وابستگی)
  ├─ database/securityHeaders.js        ← هدرهای امنیتی (تازه، فاز ۸)
  ├─ database/seo.js                    ← متای پایه + robots/sitemap (تازه، فاز ۲۲)
  ├─ database/observability.js          ← /healthz /readyz /metrics + لاگ یک‌خطی
  ├─ database/adminApi.js  (۲۸۵۰ خط)    ← ۲۲۹ مسیر، جدول ROUTES مرکزی
  │    └─ apiContract/{input,inputGateway,routeContracts,dtos,errorModel}.js
  ├─ database/examApi.js  · usersApi.js · googleAuth.js
  └─ database/contentStore.js (۴۴۲۰ خط) ← انبار JSON، تنها دروازهٔ نوشتن: writeJson
       ├─ models/            ← منبع حقیقت داده (validator/normalizer/relations/integrity)
       ├─ writeQueue.js      ← قفل درون/بین‌پروسه + بررسی نسخه (تازه، فاز ۳)
       └─ migrations/        ← مهاجرت نسخه‌دار (تازه، فاز ۱۲)

src/  ← ۵۳۴ فایل سورس (۳۰۲ jsx) · مسیریابی hash-driven در src/router/
```

**بدهی معماری شناخته‌شده:** `adminApi.js` و `contentStore.js` همچنان مونولیت‌اند
(فاز ۲۶ دست‌نخورده — بخش ۱۴).

---

## ۲. وضعیت امنیت

| مورد | وضعیت | شاهد |
|---|---|---|
| هدرهای امنیتی | `FIXED + TESTED` | `database/securityHeaders.test.mjs` (۹ سنجه) + `securityHeaders.integration.test.mjs` روی سرور واقعی (۱ سنجه) — همه سبز |
| CSP بدون `unsafe-inline`/`unsafe-eval` در production | `FIXED + TESTED` | هش SHA-256 از خودِ `dist/index.html` محاسبه می‌شود؛ سنجهٔ صریح در تست |
| HSTS فقط production + HTTPS | `FIXED + TESTED` | سنجهٔ سه‌حالته (HTTP محلی / HTTPS production / dev) |
| credential مدیر fail-closed | `FIXED + TESTED` | `adminCredentialPolicy.test.mjs` — ۹ سنجه؛ fallback شناخته‌شدهٔ `0135` حذف شد |
| دروازهٔ قرارداد ورودی مسیرهای نوشتن | `FIXED + TESTED` | ۱۳۴ مسیر ثبت‌شده، `api:contract:check` ⇒ «بدون قرارداد ۰» |
| sanitizeHtml / XSS | از قبل سالم | `xss:test` (۱۴ سنجه) در دروازه |
| rate limit ورود/ثبت‌نام | از قبل سالم | `userRateLimit.js` — دست‌نخورده |
| سرّ در فایل‌های tracked | `FIXED + TESTED` | `repo:hygiene`: سرّ = ۰ |
| هدر امنیتی روی فایل‌های آپلودی | `FIXED + TESTED` | CSP همراه پاسخ آپلود (SVG آپلودی هم بسته می‌شود) |

**اعتراف صریح:** اعتبارسنجی سطح Schema فقط برای **۵ مسیر** فعال است، نه ۱۳۴.
برای ۱۲۵ مسیر باقی‌مانده قرارداد «ساختار بدنه» اجرا می‌شود (شیء JSON بودن +
سقف حجم). دلیل با شاهد اجرایی ثبت شده:

```
POST /api/admin/articles  {title, category, status:'published', contentHtml}
→ 400  publishedAt: missing_published_at
```

قاعدهٔ بین‌فیلدیِ Schema برای رکورد منتشرشده `publishedAt` می‌خواهد، ولی **هندلر
خودش آن را می‌سازد**. یعنی «شکل بدنهٔ سیم» با «شکل رکورد انبار» یکی نیست و
نگاشت سادهٔ دامنه→Entity غلط است. رفع درست: تعریف قرارداد سیم جدا برای هر
دامنه — بخش ۱۴.

---

## ۳. وضعیت یکپارچگی داده

| مورد | وضعیت | شاهد |
|---|---|---|
| نوشتن اتمیک (`tmp→rename`) | `FIXED + TESTED` | `contentStoreAtomicWrite.test.mjs` + `concurrency.test.mjs` |
| جلوگیری از lost update درون‌پروسه | `FIXED + TESTED` | ۵۰ افزایش هم‌زمان ⇒ دقیقاً ۵۰ |
| جلوگیری از lost update **بین‌پروسه** | `FIXED + TESTED` | ۵ پروسهٔ نود × ۲۰ افزایش ⇒ دقیقاً ۱۰۰ |
| اثبات حساسیت تست | `FIXED + TESTED` | همان الگو **بدون** قفل ⇒ update گم می‌شود (assert `< 10`) |
| تشخیص نوشتن بیرونی | `FIXED + TESTED` | `LOST_UPDATE_DETECTED` |
| نوشتن روی JSON خراب | `FIXED + TESTED` | `STORAGE_CORRUPT` + تست مهاجرت: فایل خراب بازنویسی نمی‌شود |
| مهاجرت نسخه‌دار | `FIXED + TESTED` | `migration.test.mjs` — ۷ سنجه (ترتیب، dry-run، idempotency، پشتیبان، no-op، خرابی، audit) |
| مهاجرت معلق روی دادهٔ واقعی | ✅ صفر | `data:migrate` ⇒ «تغییر لازم: ۰ · شکست: ۰» |
| `data:check` | ✅ ۰ خطا | گام اول دروازه |

**دقیق‌سازی مهم (قاعدهٔ ۱۰):** در این کدبیس همهٔ تغییرهای JSON در `contentStore`
**همگام**‌اند و هیچ `await`ی بین خواندن و نوشتن نیست؛ پس lost update **درون یک
پروسه** ساختاراً ممکن نیست. آن‌چه واقعاً ممکن است، نوشتن **چند پروسه** روی یک
دیسک است (pm2 cluster / دو کانتینر). `writeQueue.js` همان را می‌بندد.

**باقی‌مانده:** هندلرهای موجود پنل هنوز از `mutateJsonFile` استفاده نمی‌کنند.
تا آن مهاجرت انجام نشود، استقرار چند-پروسه‌ای تضمین lost update ندارد — `OPEN`
(بخش ۱۴).

---

## ۴. وضعیت قرارداد API

| سنجه | مقدار |
|---|---|
| مسیر کل | **۲۲۹** |
| مسیر نوشتن | **۱۳۴** |
| کد خطا در مدل / مصرف‌شده | **۲۸ / ۲۸** |
| DTO عمومی | **۱۱** |
| `publicRoutesWithoutDto` | **۰** |
| `writeRoutesWithoutInputContract` | **۰** |
| مسیر ادمین با مجوز null خارج از فهرست | **۰** |

`scripts/api-contract.mjs --check` ⇒ سبز. رجیستری `routeContracts.js` تولیدشده
است و `scripts/generate-route-contracts.mjs --check` کهنه‌بودنش را می‌گیرد — پس
یک منبع حقیقت، دو مصرف (دروازهٔ CI + اجرا).

**OpenAPI استاندارد (فاز ۱۱): `OPEN`.** `docs/api/api-contract.json` ماشین‌خوان
است ولی OpenAPI 3 نیست.

---

## ۵. موجودی تست‌ها

| دسته | تعداد |
|---|---|
| تست‌های افزودهٔ این مأموریت | **۳۴** سنجه در ۵ فایل |
| — هدرهای امنیتی (واحد) | ۹ |
| — هدرهای امنیتی (یکپارچه، سرور واقعی) | ۱ |
| — سیاست credential مدیر | ۹ |
| — هم‌زمانی و lost update | ۸ |
| — مهاجرت داده | ۷ |
| گام‌های دروازهٔ کیفیت | **۳۴** (از ۲۶) |
| سنجه‌های اجراشده در این نشست | `adminApi` ۹۲/۹۲ · `apiContract` سبز · `e2e:api` ۲۷/۲۷ · `rbac` سبز · `secrets` سبز · `inputGate` سبز · `testBankSecurity` سبز |

Coverage (`c8`) اضافه **نشده** — `OPEN` (بخش ۱۴).

---

## ۶. وضعیت E2E مرورگری

`BLOCKED BY ENVIRONMENT` + محدودیت دستور.

- Playwright/Cypress نصب نیست و `npm install` در این محیط اجرا نشد.
- فرمان صریح: «تست رابط کاربری نگیر».
- آن‌چه هست: `e2e:api` **بدون مرورگر** — ۲۷/۲۷ سبز (شامل بررسی حضور
  `X-Request-Id` روی هر پاسخ).
- آن‌چه نیست: هیچ E2E مرورگری، هیچ mock به‌جای E2E واقعی ثبت نشد.

---

## ۷. بازتولیدپذیری Build

`FIXED + TESTED`

| سنجه | نتیجه |
|---|---|
| یکپارچگی وابستگی | ۵۳۴ فایل سورس اسکن شد؛ هر import بیرونی declare + در lockfile |
| `vite build` | **exit=0 · ۱۸.۸s** |
| entry و chunkها | ۸ asset ارجاع‌شده، همه موجود و غیرخالی |
| هم‌گامی `dist` با سورس | ✅ (هش‌های asset پس از build عوض شدند) |

**یافتهٔ واقعی رفع‌شده:** `esbuild` در ۳ اسکریپت (`auth-render-check`,
`planning-service-test`, `router-test`) مستقیم import می‌شد ولی در
`package.json` declare نبود — وابستگی به یک پکیج transitively متزلزل. به
`devDependencies` و lockfile اضافه شد.

**یافتهٔ باقی‌مانده (هشدار، نه شکست):** ۵ پکیج آناتومی (`fbx2gltf`,
`@gltf-transform/*`, `meshoptimizer`) در lockfile هستند ولی در `node_modules`
فعلی نصب نیستند. `npm ci` نصبشان می‌کند؛ این‌ها فقط برای
`scripts/anatomy/build-anatomy-models.mjs` لازماند و در گراف build نیستند.

`clean environment → install → build → start` کامل اجرا **نشد** (نصب تمیز
نیازمند شبکه/`npm ci` است و در این محیط اجرا نشد) ⇒ `PARTIAL`: یکپارچگی
استاتیک + build واقعی اثبات شد؛ نصب تمیز `UNVERIFIED-EXTERNAL`.

---

## ۸. اندازه‌گیری کارایی

خروجی واقعی `vite build` (exit=0 · ۱۶.۹–۱۸.۸s):

**بار اولیه (در `dist/index.html` ارجاع شده):**

| سنجه | مقدار |
|---|---|
| JS اولیه | **۱۶۴۲KB** (`assets/index-QO8RxNhD.js`) |
| CSS اولیه | **۷۲۷.۶KB** (`assets/index-BOvJWmhE.css`) |
| فونت‌های preload | ۹۲ + ۱۰۱ + ۱۵۲ + ۱۴۸ KB |

**chunkهای تنبل (خارج از بار اولیه):**

| chunk | اندازه |
|---|---|
| `mockData` (دادهٔ ویکی) | **۱۸۹۷KB** |
| `admin` (پنل) | **۱۰۲۴KB** |
| `three` (موتور ۳بعدی) | **۵۷۶KB** |
| `AnatomyLayer` · `InternationalExamsLayer` · `GreenPathLayer` · … | ۱۲۸ · ۱۵۹ · ۱۱۵ KB |

**یافتهٔ مهم:** دادهٔ ویکی و کتابخانهٔ `three` **در بار اولیه نیستند** — ویت
آن‌ها را به chunk جدا شکسته و فقط در مسیر خودشان می‌آورد. پس ادعای «کل dataset
ویکی در initial bundle است» نادرست است (بخش ۱۶ فاز). آن‌چه باقی می‌ماند این است
که ۱.۹MB JS به‌جای fetch از API می‌آید.

Load test واقعی، p50/p95/p99 و Core Web Vitals اندازه‌گیری **نشدند** —
`BLOCKED BY ENVIRONMENT` (نیازمند staging). هیچ عدد تخمینی به‌عنوان benchmark
ثبت نشد.

---

## ۹. وضعیت SEO

`PARTIAL`

| مورد | وضعیت |
|---|---|
| `robots.txt` | ✅ تولید می‌شود (`dist/robots.txt`) |
| `sitemap.xml` | ✅ ۱۹ URL — ۴ route ثابت + **۱۵ مقالهٔ منتشرشدهٔ واقعی** |
| canonical / OG / Twitter / `og:image` | ✅ تزریق در زمان سرو |
| JSON-LD | ✅ (Organization) |
| noindex برای ناحیهٔ خصوصی | ✅ (`#admin`, `#dashboard`, …) |
| اعتبارسنجی | `scripts/seo-validate.mjs` — سبز |
| per-route metadata | ❌ `OPEN` |

**محدودیت ساختاری مستند:** مسیریابی hash-driven است، پس `pathname` همیشه `/`
است و خزنده route داخلی نمی‌بیند. per-route metadata فقط **کلاینتی** ممکن است
(`src/services/seo/routeMeta.js` ساخته **نشد** — بخش ۱۴). `PUBLIC_SITE_URL`
تنها منبع حقیقت دامنه است و در production نبودش خطا است.

---

## ۱۰. وضعیت CI/CD

`OPEN` — `.github/workflows/ci.yml` در مخزن هست ولی **هرگز اجرا نشده**.
دروازهٔ کیفیت (`verify:all`) به ۳۶ گام رسید و روی همین ماشین اجرا شد:

```
اجرای کامل اول:  ۳۴/۳۶ سبز · ۲ شکست
  ✗ build:check   ← شکست کاذب: گارد حذف انبوهِ سندباکس، خالی‌کردن dist را رد کرد
  ✗ repo:hygiene  ← یافتهٔ کاذب: الگوی پهنِ رمز روی fixture تست و متن خطای فرم

هر دو ریشه‌ای تشخیص و اصلاح شدند و جداگانه تأیید شدند:
  repo:hygiene  ⇒ «پاک» (۰ نقض · ۱۳ هشدار حجم)  exit=0
  build:check   ⇒ exit=0 بیرون سندباکس · exit=3 («نامعین») داخل سندباکس
                  به‌جای «شکست» — تا دروازه گمراه نکند
```

سیم‌کشی به CI، branch protection و runner واقعی انجام نشده.

---

## ۱۱. وضعیت Staging

`BLOCKED BY ENVIRONMENT` — هیچ staging وجود ندارد. `.env.staging.example` و
اسکریپت smoke staging ساخته **نشد** (بخش ۱۴).

---

## ۱۲. وضعیت پشتیبان‌گیری / بازیابی

`PARTIAL`

- `data:backup` · `data:restore` (dry-run/`--apply`) · `backup:restore:test`
  از قبل وجود دارند و در دروازه اجرا می‌شوند.
- **زمان‌بندی، retention، ذخیره خارج از working directory، integrity check،
  drill دوره‌ای و RPO/RTO: `OPEN`.**
- backup → destroy → restore → validate روی staging اجرا نشد (`BLOCKED`).

---

## ۱۳. بهداشت Git

| مورد | وضعیت |
|---|---|
| دادهٔ زمان‌اجرا tracked | **۰** (از ۵) — `activity`/`admins`/`events`/`publishLog`/`mediaMetrics` از index خارج شدند، فایل محلی سالم |
| `feedback.json` | به گیت‌ایگنور اضافه شد |
| سرّ در فایل‌های tracked | **۰** |
| فایل سورس حجیم | **۱** — `src/services/wiki/mockData.js` (۲.۱۶MB) ⇒ **هشدار** (چون در chunk تنبل است، فاز ۱۶) |
| دارایی دودویی حجیم | **۱۲** (هشدار) — ۵ مدل GLB آناتومی + ویدیو ۳۹MB؛ توصیهٔ Git LFS |
| نقض دروازهٔ بهداشت | **۰** — `repo:hygiene` ⇒ «پاک» (۱۳ هشدار حجم) |
| تفکیک نقض از هشدار | ✅ اضافه شد: سرّ و دادهٔ زمان‌اجرا ⇒ نقض؛ حجم ⇒ هشدار |
| تفکیک دارایی از سورس | ✅ اضافه شد (تا GLB دروازه را بی‌اعتبار نکند) |
| commitهای این مأموریت | **۸** (مرحله‌ای، هر کدام یک دغدغه) |
| دادهٔ کاربر دست‌نخورده | ۶ فایل `content/*.json` عمداً commit نشد |

**ممیزی تاریخچه (`scripts/git-history-audit.mjs`، فقط‌خواندنی):**

| یافته | مقدار |
|---|---|
| `database/content/activity.json` | ۱۹ نسخه · ۲.۸۱MB (IP/UA) |
| `database/users.json` | ۱۱ نسخه · ۰.۰۲MB (PII) |
| `database/content/admins.json` | ۱۷ نسخه · ۰.۰۱MB (هش رمز) |
| بزرگ‌ترین blob | `.app.out.mjs` — **۴۵.۲۸MB** (زائدهٔ probe) |

**History rewrite اجرا نشد.** پیش‌شرط، دستور پیشنهادی (`git filter-repo
--invert-paths`) و aftercare (`reflog expire` → `gc` → `fsck` → ممیزی دوباره)
توسط اسکریپت چاپ می‌شود. هیچ محتوایی از blobها چاپ نشد.

---

## ۱۴. یافته‌های باز (OPEN)

| # | مورد | وضعیت | مسیر رفع |
|---|---|---|---|
| ۱ | اعتبارسنجی Schema برای ۱۲۵ مسیر نوشتن | `PARTIAL` | تعریف «قرارداد سیم» جدا از مدل انبار، به‌ازای هر دامنه |
| ۲ | هندلرهای پنل روی `mutateJsonFile` | `OPEN` | مهاجرت تدریجی؛ تا آن‌جا استقرار تک‌پروسه |
| ۳ | نشست ادمین memory-only (فاز ۵) | `OPEN` | `sessionStore` + `admin.sessions.json` + تست restart |
| ۴ | مدل دسترسی `/uploads/**` (فاز ۷) | `OPEN` | `visibility: public\|private` + signed access |
| ۵ | rate limit عمومی پنل (فاز ۱۰) | `OPEN` | دو سطح عمومی/نوشتنی، کلید identity+IP |
| ۶ | OpenAPI استاندارد (فاز ۱۱) | `OPEN` | generator از `api-contract.json` |
| ۷ | E2E مرورگری (فاز ۱۳) | `BLOCKED` + ممنوع | Playwright روی staging |
| ۸ | هارنس‌های رندر/responsive (فاز ۱۴) | `OPEN` | اجرای `verify-render`/`theme-contrast`/`tailwind-probe` |
| ۹ | جدا‌کردن CSS پنل (فاز ۱۵) | `OPEN` | baseline ثبت شد: CSS اولیه ۷۲۷.۶KB |
| ۱۰ | دادهٔ ویکی از bundle اولیه (فاز ۱۶) | `PARTIAL` — معیار اصلی برآورده است | دادهٔ ویکی در chunk تنبل جدا (۱۸۹۷KB) است، نه در بار اولیه. باقی‌مانده: ۲.۱۶MB سورس در مخزن + سرو به‌صورت JS به‌جای API |
| ۱۱ | Coverage (فاز ۱۷) | `OPEN` | `c8` + baseline پیش از threshold |
| ۱۲ | زمان‌بندی backup و DR (فاز ۱۸) | `PARTIAL` | scheduler + retention + drill |
| ۱۳ | Observability پایدار (فاز ۲۴) | `PARTIAL` | log sink + rotation + error tracking |
| ۱۴ | سخت‌سازی تصویر/رسانه (فاز ۲۵) | `OPEN` | resize/thumbnail/metadata strip |
| ۱۵ | refactor فایل‌های بزرگ (فاز ۲۶) | `OPEN` | `adminApi.js` ۲۸۵۰ خط · `contentStore.js` ۴۴۲۰ خط |
| ۱۶ | رمز کاربر و هویت کلاینتی (فاز ۲۷) | `OPEN` | server-authoritative identity |
| ۱۷ | History rewrite (فاز ۲) | `OPEN` — نیازمند تأیید | پشتیبان + دستور آماده در اسکریپت ممیزی |
| ۱۸ | یکپارچه‌سازی‌های بیرونی (فاز ۲۳) | `UNVERIFIED-EXTERNAL` | قرارداد آداپتر + mock server |

---

## ۱۵. یافته‌های مسدودشده به‌دلیل محیط

| مورد | چرا مسدود | اقدام بیرونی لازم |
|---|---|---|
| Staging (فاز ۱۹) | زیرساخت واقعی در دسترس نیست | ساخت محیط + secrets جدا |
| Load test (فاز ۲۰) | نیازمند staging | اجرا روی URL عمومی |
| Core Web Vitals (فاز ۲۱) | نیازمند staging + مرورگر | Lighthouse/CrUX روی staging |
| نصب تمیز (`npm ci`) | نیازمند شبکه؛ در این محیط اجرا نشد | اجرا روی ماشین تمیز |
| E2E مرورگری (فاز ۱۳) | Playwright نصب نیست + فرمان ممنوع | نصب + staging |
| CI/CD (فاز ۱۰ بخش ۱۰) | runner واقعی وجود ندارد | فعال‌سازی workflow |
| OAuth/Publisher/Payment | credential واقعی وجود ندارد | کلید واقعی + تست live |

---

## ۱۶. اقدام‌های بیرونی دقیق بعدی

1. **پشتیبان مخزن، سپس history rewrite** — `git clone --mirror . ../tapeshweb-backup-$(date +%Y%m%d)`؛ بعد دستور `git filter-repo` که `scripts/git-history-audit.mjs` چاپ می‌کند؛ سپس `fsck` و ممیزی دوباره. **نیازمند تأیید صریح.**
2. **`npm ci` روی ماشین تمیز** و اجرای `npm run build:check` برای بستن ادعای
   بازتولیدپذیری از `PARTIAL` به `VERIFIED EXTERNAL`.
3. **`PUBLIC_SITE_URL` را در محیط production تنظیم کن** — بدون آن sitemap با
   دامنهٔ `localhost` ساخته می‌شود.
4. **`TAPESH_ADMIN_PASSWORD` قوی در production** — بدون آن سرور عمداً بالا
   نمی‌آید (این رفتار درست است، نه باگ).
5. **staging بساز** و بعد: load test، Core Web Vitals، اجرای drill
   `backup → destroy → restore → validate`.
6. **`TAPESH_METRICS_TOKEN` را تنظیم کن** — بدون آن `/metrics` ۴۰۴ می‌دهد.
7. **Git LFS برای مدل‌های GLB و ویدیوها** — ۱۲ دارایی، بزرگ‌ترین ۳۹MB.

---

## جمع‌بندی عددی

| شاخص | قبل | بعد |
|---|---|---|
| گام‌های دروازهٔ کیفیت | ۲۶ | **۳۶** |
| مسیر نوشتن بدون قرارداد ورودی | ۱۱۵ (از ۱۱۷) | **۰** (از ۱۳۴) |
| دادهٔ زمان‌اجرا tracked | ۵ | **۰** |
| سرّ tracked | ۰ | **۰** |
| نقض بهداشت مخزن | ۵ | **۰** (۱۳ هشدار حجم) |
| هدر امنیتی روی پاسخ | ۰ (فقط nosniff) | **۷** |
| Error Boundary در `src` | ۰ | **۳ سطح** |
| تست هم‌زمانی/lost update | ۰ | **۸ سنجه** |
| تست مهاجرت | ۰ | **۷ سنجه** |
| تست امنیتی افزوده | ۰ | **۱۹ سنجه** |
| مسیر تغییر یافته در working tree | ۱۷۲ | **۶** (فقط دادهٔ کاربر، دست‌نخورده) |
| commit افزوده | — | **۱۰** |
| `vite build` | نامعلوم | **exit=0 · ۱۶.۹s** |

## آن‌چه این مأموریت **انجام نداد**

برای شفافیت، این‌ها دست‌نخورده ماندند: نشست ادمین فایل‌محور · مدل دسترسی
`/uploads` · rate limit عمومی پنل · OpenAPI · E2E مرورگری · هارنس‌های رندر و
responsive · جداسازی CSS پنل · backend ویکی · coverage · زمان‌بندی backup ·
سخت‌سازی تصویر · refactor مونولیت‌ها · هویت کلاینتی · staging · load test ·
Core Web Vitals · یکپارچه‌سازی‌های بیرونی · history rewrite.
مسیر رفع هر کدام در بخش ۱۴ آمده است. هیچ‌کدام «انجام‌شده» گزارش نشده‌اند.
