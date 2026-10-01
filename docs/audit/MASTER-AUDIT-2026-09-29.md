# MASTER AUDIT — ممیزی جامع پروژه «تپش»

> **تاریخ ممیزی پایه:** ۲۹ سپتامبر ۲۰۲۶
> **بازنگری ۲:** ۱ اکتبر ۲۰۲۶ (~۱۶:۳۰) — همگام‌سازی پس از ۲۳ فاز سخت‌سازی.
> **بازنگری ۳:** ۱ اکتبر ۲۰۲۶ (~۲۰:۴۵) — همگام‌سازی پس از **۱۰ کامیت Pre-Production Remediation**. **افزودهٔ وضعیت:** ۱ اکتبر ۲۰۲۶ (~۲۲:۳۱)، چهار رفع سریع + Tapesh Guardian v1؛ جزئیات و مرجع تازه در **بخش ۰.۸**. **مرجع فعلی = بخش «۰»، با تقدم افزودهٔ ۰.۸.**
> **روش:** خواندن مستقیم سورس + `grep`/`git`/`du` روی کل Repository. ممیزی پایه بدون اجرای سرور/مرورگر/بیلد انجام شد؛ **بازنگری‌های ۲ و ۳** با اجرای واقعی دروازهٔ کیفیت، تست‌ها و اندازه‌گیری artifact موجود انجام شدند.
> **قواعد:** `OBSERVATION` = چیزی که مستقیماً در کد دیده شد · `INFERENCE` = نتیجه‌گیری از چند مشاهده · `RECOMMENDATION` = پیشنهاد.
> **وضعیت‌ها:** `IMPLEMENTED` / `PARTIALLY IMPLEMENTED` / `NOT FOUND` / `UNVERIFIED`
>
> **⚠️ ساختار سند:** بخش‌های ۱ تا ۴۹ **متن ممیزی پایه (۲۹ سپتامبر)** هستند و عمداً بازنویسی نشدند تا تاریخچه قابل استناد بماند. **بخش «۰» (بازنگری ۳) مرجع وضعیت فعلی است** و هرجا با متن پایه یا بازنگری ۲ تناقض داشت، حرف بخش ۰ مقدم است. جدول‌های ۴۵ و ۴۶ در بازنگری‌های ۲ و ۳ جایگزین شده‌اند.

---

# 0. بازنگری ۳ — وضعیت فعلی (۱ اکتبر ۲۰۲۶ · نوبت دوم)

> **مبنا:** `main` @ `e53c2b4` · Node `22.22.2` · working tree **۸ مسیر** (۶ فایل دادهٔ کاربر + ۲ آپلود).
> **رخداد:** بین **۱۷:۲۹ تا ۱۸:۰۰** همان روز، **۱۰ کامیت** روی `a86d875` زده شد (Pre-Production Remediation). گزارش کامل آن در `docs/audit/PRE-PRODUCTION-REMEDIATION-2026-10-01.md` است. این بخش، آن گزارش را **مستقل راستی‌آزمایی** می‌کند و مغایرت‌ها را علامت می‌زند.

## 0.1 دو تغییر ساختاری که همه‌چیز را عوض کرد

**۱. کل کار سخت‌سازی کامیت شد.** آن ۱۷۲ فایل کامیت‌نشده — که در بازنگری ۲ «بزرگ‌ترین ریسک فعال پروژه» نامیده شد — **دیگر ریسک نیست**. تاریخچه اکنون ۵۰ کامیت دارد (از ۴۰) و هر کامیت یک دغدغهٔ جدا:

```
fd7f2b4 chore(repo): untrack runtime data + tighten .gitignore
397d4ba feat(security): fail-closed admin credential, security headers, central input gateway
a0776a7 feat(data): cross-process write queue + versioned migrations
f8e1740 feat(ui): three-level React error boundary
51a8955 feat(seo): robots.txt, generated sitemap, baseline meta, validation gate
dd0631b chore(build,gate): reproducible build check + real quality gate
dbe88d4 chore: checkpoint accumulated hardening work (working tree)   ← ۲۱۲ فایل
3aa04c8 chore(repo): read-only git history audit + ignore feedback.json
2d5a1f2 fix(gate): eliminate two false failures found by the full run
e53c2b4 docs(audit): pre-production remediation report + session memory
```

**۲. پنج قابلیت تازه اضافه شد** که در ممیزی پایه `NOT FOUND` بودند: **هدرهای امنیتی (CSP/HSTS)** · **مهاجرت نسخه‌دار** · **قفل نوشتن بین‌پروسه** · **ErrorBoundary** · **SEO (robots/sitemap/متا)**. دروازهٔ کیفیت از **۲۶ به ۳۶ گام** رسید.

## 0.2 جدول داوری — هر مورد را خودم اجرا کردم

| # | ادعای گزارش Remediation | راستی‌آزمایی مستقل من | نتیجه |
|---|---|---|---|
| ۱ | گام‌های دروازه **۳۶** | شمارش `{ id: ... }` در `scripts/verify-all.mjs` ⇒ **۳۶** | ✅ تأیید |
| ۲ | هدرهای امنیتی + تست | `securityHeaders.test.mjs` ⇒ **۹/۹ · exit 0** · `securityHeaders.integration.test.mjs` (سرور واقعی) ⇒ **۱/۱ · exit 0** | ✅ تأیید |
| ۳ | CSP بدون `unsafe-inline`/`unsafe-eval` | ۱۵ دایرکتیو CSP + `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`/`COOP`/`CORP` در `database/securityHeaders.js` | ✅ تأیید |
| ۴ | credential مدیر fail-closed | `adminCredentialPolicy.test.mjs` ⇒ **۹/۹ · exit 0** | ✅ تأیید |
| ۵ | قفل نوشتن بین‌پروسه | `concurrency.test.mjs` ⇒ **۸/۸ · exit 0**؛ `writeQueue.js` exports: `withFileLock` · `withAdvisoryLock` · `fileRevision` · `mutateJsonFile` | ✅ تأیید |
| ۶ | مهاجرت نسخه‌دار | `migrations/migration.test.mjs` ⇒ **۷/۷ · exit 0**؛ رجیستری ۲ مهاجرت (`0001`, `0002`) روی ۱۲ انبار | ✅ تأیید |
| ۷ | `data:migrate` صفر تغییر روی دادهٔ واقعی | `data-migrate.mjs --dry-run` ⇒ «تغییر لازم: ۰ · شکست: ۰» · exit 0 | ✅ تأیید |
| ۸ | قرارداد ورودی مسیرهای نوشتن | `api-contract.mjs --check` ⇒ «۲۲۹ مسیر · ۲۸ کد · ۱۱ DTO» + «قرارداد ورودی: **۱۳۴** مسیر نوشتن (entity 5 · object 125 · none 4) · **بدون قرارداد ۰**» · exit 0 | ✅ تأیید |
| ۹ | رجیستری قرارداد هم‌گام | `generate-route-contracts.mjs --check` ⇒ «هم‌گام — ۱۳۴ مسیر نوشتن» · exit 0 | ✅ تأیید |
| ۱۰ | دادهٔ زمان‌اجرا دیگر tracked نیست | `git ls-files database/content` ⇒ `activity`/`admins`/`events`/`publishLog`/`mediaMetrics` = **۰** | ✅ تأیید |
| ۱۱ | `users.json` و `feedback.json` tracked نیستند | `git ls-files` ⇒ **۰** برای هر دو | ✅ تأیید |
| ۱۲ | `data:check` ۰ خطا | ۰ خطا · **۲۲** هشدار · **۱۵۵۵** رکورد · exit 0 | ✅ تأیید |
| ۱۳ | بودجهٔ باندل ۰ نقض | ۸ سقف، **۰ نقض** (۸۷٪–۹۳٪) · exit 0 | ✅ تأیید |
| ۱۴ | خودآزمون API | `api-input-audit.mjs --selftest` ⇒ سبز · exit 0 | ✅ تأیید |
| ۱۵ | **`repo:hygiene` ⇒ «پاک» (۰ نقض)** | ⇒ **۱ یافتهٔ نقض · exit 1** | ❌ **مغایرت** — بند ۰.۳ |
| ۱۶ | **SEO: `dist/robots.txt` و `dist/sitemap.xml` تولید می‌شوند** | ⇒ **هیچ‌کدام روی دیسک نیست**؛ `seo-validate.mjs` ⇒ **۲ یافته · exit 1** | ❌ **مغایرت** — بند ۰.۳ |
| ۱۷ | **Error Boundary «سه سطح»** | کامپوننت ۳ scope دارد، ولی در `src/` فقط **۲ mount** (`admin`، `dashboard`)؛ `scope="root"` در `main.jsx` **نصب نشده** | ⚠️ **جزئی** — بند ۰.۳ |
| ۱۸ | **`admin` chunk «خارج از بار اولیه»** | `dist/index.html` ⇒ `<link rel="modulepreload" href="./assets/admin-1WTCsLoF.js">` | ❌ **مغایرت** — بند ۰.۴ |

**نتیجه:** ۱۴ از ۱۸ ادعا بیت‌به‌بیت تأیید شد · **۳ مغایرت واقعی** · ۱ جزئی. هیچ‌کدام از مغایرت‌ها «تخلف» نیست — هر سه از یک جنس‌اند: **وضعیت لحظهٔ اجرا با وضعیت فعلی دیسک فرق کرده** یا **برچسب‌گذاری نادرست**. توضیح در بندهای بعد.

## 0.3 سه مغایرت — با شاهد و ریشهٔ دقیق

### مغایرت ۱ — دروازه الان قرمز است: `repo:hygiene` (exit 1)

```
── سرّ در فایل‌های tracked (1) ──
  ✗ .workbuddy-ai/memory/2026-10-01.md  [literal-secret-assignment]  password: 'W…
```

**ریشه:** خط ۵۴۴ همان فایل حافظه، رشتهٔ **fixture تست** را نقل می‌کند:
`` `password: 'WrongPassword123'` (fixture تست) ``. یعنی یک **مثبت کاذب** — ولی اسکنر الگوی پهن، آن را نقض می‌شمارد و **کد خروج ۱** می‌دهد.

**چرا مهم است (سه لایه):**
1. **دروازهٔ ۳۶ گامی در وضعیت فعلی سبز نیست.** آخرین گامش (`repo:hygiene`) شکست می‌خورد. گزارش Remediation می‌گوید «پاک (۰ نقض)» — آن اجرا **قبل از کامیت `e53c2b4`** بوده که همین فایل حافظه را وارد مخزن کرد.
2. **`.workbuddy-ai/` در گیت tracked است — ۱۸ فایل**، شامل `memory/*.md` و `screenshots/analytics-1400/*.png`. اینها **زائدات نشست‌اند، نه محتوای محصول**. اسکنر سرّ روی یادداشت‌های خام نشست اجرا می‌شود و طبیعتاً مثبت کاذب می‌دهد.
3. الگوی سرّ باید **باریک‌تر** شود (تفکیک fixture/متن مستند از انتساب واقعی) **یا** `.workbuddy-ai/` از ردیابی خارج شود.

**اقدام:** `git rm -r --cached .workbuddy-ai` (با تأیید) + افزودن به `.gitignore`؛ یا باریک‌کردن الگو در `repo-hygiene.mjs`.

### مغایرت ۲ — SEO روی دیسک وجود ندارد و `seo:check` شکست می‌خورد

```
$ node scripts/seo-validate.mjs
  ✗ dist/robots.txt نیست — `npm run seo:generate` را اجرا کن
  ✗ dist/sitemap.xml نیست — `npm run seo:generate` را اجرا کن
نتیجه: 2 یافته        EXIT=1
```

**ریشه (قطع‌ی):** `vite.config.js` مقدار `emptyOutDir` را ست نمی‌کند و `dist/` داخل ریشهٔ پروژه است ⇒ ویت **کل `dist/` را خالی می‌کند**. `robots.txt` و `sitemap.xml` را `scripts/generate-sitemap.mjs` **بیرون از build** می‌نویسد. پس:

- `npm run build` تنها ⇒ **`dist/` بدون هیچ فایل SEO**
- دروازه این را می‌پوشاند چون ترتیبش `build:check → perf:bundle → seo:generate → seo:check` است
- آخرین `vite build` در `build:check` اجرا شده و پس از آن `seo:generate` روی دیسک نمانده ⇒ **artifact فعلی `dist/` بدون SEO است**

**اقدام:** یا `seo:generate` را به `postbuild` ببند، یا پلاگین ویت بنویسد، یا `emptyOutDir: false` + پاک‌سازی هدفمند.

### مغایرت ۳ — «Error Boundary سه سطح» فقط دو سطح نصب دارد

کامپوننت `src/components/ErrorBoundary.jsx` (۲۱۷ خط) سه scope را مستند و پشتیبانی می‌کند (`root`/`dashboard`/`admin`). اما:

- `src/App.jsx:695` ⇒ `<ErrorBoundary scope="admin" …>`
- `src/App.jsx:723` ⇒ `<ErrorBoundary scope="dashboard" …>`
- **`src/main.jsx` هیچ ErrorBoundary ندارد** (فایل ۱۷ خط است و `<App />` را خام رندر می‌کند)
- کل `src/` ⇒ دقیقاً **۲** مورد `<ErrorBoundary`

⇒ سطح `root` **نصب نشده**. یعنی استثنا در خودِ `App` (خارج از دو ناحیهٔ بالا) هنوز به صفحهٔ سفید می‌رسد. رفع یک‌خطی است.

## 0.4 یک کشف مهم: بار اولیه ۳٫۲۶MB است، نه ۱٫۶MB

گزارش Remediation در بخش ۸ می‌گوید «JS اولیه ۱۶۴۲KB» و `admin` (۱۰۲۴KB) را در جدول **«chunkهای تنبل (خارج از بار اولیه)»** می‌آورد. اندازه‌گیری من از `dist/index.html`:

```html
<script type="module" crossorigin src="./assets/index-QO8RxNhD.js"></script>   ← 1,642,256 B
<link rel="modulepreload" crossorigin href="./assets/admin-1WTCsLoF.js">      ← 1,024,223 B  ⚠️
<link rel="modulepreload" crossorigin href="./assets/react-Dac_GvTY.js">      ←     3,654 B
<link rel="stylesheet" crossorigin href="./assets/index-BOvJWmhE.css">        ←   745,030 B
```

| جزء | بایت |
|---|---|
| `index-QO8RxNhD.js` (entry) | ۱٬۶۴۲٬۲۵۶ |
| **`admin-1WTCsLoF.js` (preload)** | **۱٬۰۲۴٬۲۲۳** |
| `react-Dac_GvTY.js` | ۳٬۶۵۴ |
| `index-BOvJWmhE.css` | ۷۴۵٬۰۳۰ |
| **جمع JS+CSS بار اولیه** | **۳٬۴۱۵٬۱۶۳ B = ۳٫۲۶ MB** |

به‌علاوه ۴ فونت preload (`Pinar-VF` · `Doran-Regular` · `Doran-Medium` · `Doran-Bold`).

**ریشه (قطعی):** `src/App.jsx` خط **۱۲** ⇒ `import AdminLayout from './layout/admin/AdminLayout';` — **استاتیک**، و `lazy(` در کل `App.jsx` **صفر بار** استفاده شده. `manualChunks` فایل را جدا می‌کند ولی چون import استاتیک است، ویت `modulepreload` می‌گذارد و **۱MB پنل ادمین در مسیر بحرانی هر بازدیدکنندهٔ سایت عمومی** است.

**نتیجه:** این همان یافتهٔ ردیف ۲۱ ممیزی پایه («CSS پنل برای همهٔ بازدیدکنندگان») است که **هنوز باز است و حالا شامل ۱MB جاوااسکریپت هم می‌شود**. ادعای «admin تنبل است» نادرست است. دو موردی که **واقعاً** تنبل‌اند: `mockData` (۱٫۸۱MB) و `three` (۵۶۲KB) — هیچ‌کدام در `index.html` ارجاع نشده‌اند. ✅

## 0.5 اعداد به‌روز (اندازه‌گیری‌شده در همین نوبت)

| سنجه | بازنگری ۲ (~۱۶:۳۰) | **بازنگری ۳ (~۲۰:۴۵)** |
|---|---|---|
| کامیت | ۴۰ | **۵۰** (+۱۰) |
| **مسیر تغییر‌یافته working tree** | **۱۷۲** | ✅ **۸** (۶ دادهٔ کاربر + ۲ آپلود) |
| گام‌های دروازه | ۲۶ | **۳۶** |
| مسیر API | ۲۲۹ | **۲۲۹** (بدون تغییر) |
| مسیر نوشتن با قرارداد ورودی | ۰ از ۱۳۴ | ✅ **۱۳۴ از ۱۳۴** |
| کد خطای مدل / مصرف‌شده | ۲۸ / ۲۲ | **۲۸ / ۲۸** |
| DTO عمومی | ۱۱ | **۱۱** · ۰ مسیر عمومی بدون DTO |
| Permission | ۸۰ | **۸۰** |
| فایل تست `database/*.test.mjs` | ۱۶ | **۲۱** |
| اسکریپت `scripts/*.mjs` | ۳۰ | **۳۶** |
| اسناد `docs/**/*.md` | ۲۲ | **۲۳** |
| `database/` | ۶۵ فایل · ۳۷٬۵۴۹ خط | **۷۸ فایل · ۳۹٬۳۵۰ خط** |
| `scripts/` خطوط | ۸٬۰۲۵ | **۸٬۹۱۸** |
| `src/` JS/JSX | ۱۶۸٬۳۳۵ · ۳۰۲ jsx + ۱۲۳ js | **۱۶۸٬۵۷۷ · ۳۰۳ jsx + ۱۲۳ js** |
| `src/` CSS | ۵۰٬۰۰۸ · ۵۵ فایل | **۵۰٬۰۰۸ · ۵۵ فایل** (بدون تغییر) |
| **بار اولیه JS+CSS** | ۳٫۲۶MB (اندازه‌گیری‌نشده) | **۳٫۲۶ MB** (۳٬۴۱۵٬۱۶۳ B) |
| `dist/` | ۲۰۰٫۸۹MB | **۲۰۱ MB** |
| `.git` | ۲۱۹MB | **۲۱۷ MB** |
| `node_modules` | ۱۴۸MB | **۱۸۴ MB** |
| پروژه | ۷۹۳MB | **۸۲۷ MB** |
| `data:check` رکورد | ۱۵۴۹ | **۱۵۵۵** (۰ خطا · ۲۲ هشدار) |
| مهاجرت معلق | — | ✅ **۰ تغییر · ۰ شکست** |
| **وضعیت دروازهٔ ۳۶ گامی** | ۲۶/۲۶ سبز | ⚠️ **۳۵/۳۶ سبز — `repo:hygiene` قرمز (exit 1)** |

## 0.6 آنچه **هنوز** باز است (فهرست به‌روز)

| اولویت | مورد | وضعیت | یادداشت |
|---|---|---|---|
| 🔴 **۱** | **`repo:hygiene` قرمز** — دروازه سبز نیست | OPEN | مثبت کاذب روی `.workbuddy-ai/memory/2026-10-01.md`؛ رفع: باریک‌کردن الگو یا `git rm --cached .workbuddy-ai` |
| 🟠 **۲** | **SEO در artifact نیست** | OPEN | `vite build` ⇒ `dist/` خالی از robots/sitemap؛ `seo:generate` را به build ببند |
| 🟠 **۳** | **۱MB پنل ادمین در بار اولیه** (۳٫۲۶MB) | OPEN (از پایه) | `App.jsx:12` import استاتیک · `lazy(` صفر بار |
| 🟠 **۴** | **ErrorBoundary سطح `root` نصب نیست** | PARTIAL | ۲ از ۳ سطح؛ رفع یک‌خطی در `main.jsx` |
| 🟠 **۵** | **`.workbuddy-ai/` tracked است** (۱۸ فایل، شامل اسکرین‌شات و حافظه) | OPEN | زائدات نشست در مخزن محصول |
| 🟠 **۶** | **تاریخچهٔ Git با PII** — `.git` ۲۱۷MB · `activity.json` ۱۹ نسخه/۲٫۸۱MB · `users.json` ۱۱ نسخه · `admins.json` ۱۷ نسخه · `.app.out.mjs` ۴۵٫۲۸MB | OPEN — **نیازمند تأیید** | اسکریپت فقط‌خواندنی `git-history-audit.mjs` دستور آماده چاپ می‌کند |
| 🟠 **۷** | **staging ندارد** | BLOCKED | Gate فاز ۲۱ و ۲۳ |
| 🟠 **۸** | **E2E مرورگری ندارد** | BLOCKED + ممنوع | Playwright نصب نیست |
| 🟠 **۹** | **Core Web Vitals / load test** | UNVERIFIED | نیازمند staging |
| 🟡 **۱۰** | **CI هرگز اجرا نشده** | OPEN | `.github/workflows/ci.yml` هست؛ runner واقعی نیست |
| 🟡 **۱۱** | نشست ادمین memory-only | OPEN | `contentStore.js:910` |
| 🟡 **۱۲** | `/uploads/**` بدون کنترل دسترسی | OPEN | ۵۵MB با URL عمومی |
| 🟡 **۱۳** | اعتبارسنجی Schema فقط ۵ از ۱۳۴ مسیر نوشتن | PARTIAL | علت با شاهد ثبت شده: «شکل بدنهٔ سیم ≠ شکل رکورد انبار» |
| 🟡 **۱۴** | هندلرهای پنل هنوز روی `mutateJsonFile` نیستند | OPEN | تا آن‌جا: استقرار **تک‌پروسه** |
| 🟡 **۱۵** | OpenAPI استاندارد نیست | OPEN | `api-contract.json` ماشین‌خوان هست |
| 🟡 **۱۶** | Coverage tooling نصب نیست | OPEN | `c8`/`nyc`/`istanbul` = NONE |
| 🟡 **۱۷** | rate limit عمومی پنل | OPEN | فقط login/register/بانک تست |
| 🟢 **۱۸** | `adminApi.js` ۲٬۸۵۰ خط · `contentStore.js` ۴٬۴۲۰ خط | OPEN | refactor مونولیت (فاز ۲۶) |
| 🟢 **۱۹** | زمان‌بندی/retention بکاپ · هارنس‌های رندر/responsive · سخت‌سازی تصویر · هویت کلاینتی · یکپارچه‌سازی‌های بیرونی | OPEN | مسیر رفع در `PRE-PRODUCTION-REMEDIATION` بند ۱۴ |

## 0.7 داوری نهایی این نوبت

**آنچه واقعاً عوض شد (قابل تأیید):** کامیت‌شدن ۱۷۲ فایل ریسک اصلی را حذف کرد · هدرهای امنیتی با CSP سخت‌گیرانه اضافه شد · مهاجرت نسخه‌دار و قفل بین‌پروسه آمدند · قرارداد ورودی همهٔ ۱۳۴ مسیر نوشتن بسته شد · دادهٔ زمان‌اجرا از گیت خارج شد · `vite build` از «نامعلوم» به **exit=0** رسید · دروازه ۱۰ گام بزرگ‌تر شد.

**آنچه گزارش Remediation دقیق نگفت:** دروازه الان سبز نیست (۱ نقض) · SEO روی دیسک نیست · ErrorBoundary دو سطح از سه است · و «admin تنبل است» نادرست — ۱MB در مسیر بحرانی است.

**سه Gate همچنان عبور نکرده:** staging (فاز ۲۱ و ۲۳) · E2E مرورگری (فاز ۲۳) · history rewrite (فاز ۲۲).

> **هیچ امتیاز، Score یا رتبه‌بندی کلی داده نشده است** — طبق درخواست.

## 0.8 افزودهٔ وضعیت — رفع چهار مورد سریع و Tapesh Guardian v1 (۱ اکتبر ۲۰۲۶ · ~۲۲:۳۱)

این افزوده بر وضعیت ۰.۱ تا ۰.۷ مقدم است؛ تاریخچهٔ ممیزی پایه و بازنگری‌های پیشین بازنویسی نشده‌اند.

### چهار مورد سریع بسته شد

| مورد | تغییر | راستی‌آزمایی |
|---|---|---|
| ErrorBoundary ریشه | `src/main.jsx` اکنون کل `<App />` را در `ErrorBoundary scope="root"` می‌گذارد | باندل headless بعد از تغییر موفق |
| پنل ادمین خارج از بار اولیه | `AdminLayout` lazy + `Suspense`؛ CSSهای پنل به خودِ chunk پنل منتقل شدند | باندل headless: dynamic import و chunk پنل جدا دیده شد |
| SEO بعد از build | `database/seoFiles.js` helper خالص؛ hook `tapesh-seo-output` در پایان build Vite `robots.txt` و `sitemap.xml` را می‌سازد؛ verify-all دیگر generator دستی برای پوشاندن build اجرا نمی‌کند | hook اجرا شد؛ `seo-validate` سبز، ۱۹ URL |
| `.workbuddy-ai/` از Git index خارج | `.gitignore` کل پوشه را ignore می‌کند و ۱۸ مسیر با `git rm --cached` untrack شدند؛ فایل‌ها روی دیسک ماندند | `git ls-files .workbuddy-ai` = ۰؛ `repo:hygiene` = ۰ نقض. حذف فقط از index stage شده است، commit نشده |

### Tapesh Guardian v1 — فقط‌خواندنی

**وضعیت: IMPLEMENTED (API و UI؛ browser E2E هنوز انجام نشده).** دسترسی بخش و API فقط با `analytics.security.read` است (`GET /api/admin/guardian/status`)؛ بدون مجوز، داده برنمی‌گردد. این در پیاده‌سازی فعلی مجوز نقش مدیر کل است.

قابلیت‌های واقعی:
- متریک‌های درخواست در حافظهٔ همان process: پنجرهٔ ۵ دقیقه‌ای، مسیر پاک‌شده، روش، status، خطاهای ۴xx/۵xx و چند مسیر پرتکرار. بافر bounded است؛ تکمیل‌بودن پنجره در صورت حذف نمونه اعلام می‌شود.
- قواعد ثابت: readiness ناموفق، خرابی JSON مشاهده‌شده، حداقل ۵ خطای ۵xx، حداقل ۸ شکست ورود در نمونه، و پنجرهٔ ناقص/متریک ناموجود. نه anomaly detection است و نه مقایسهٔ baseline.
- سرصفحه‌های واقعی از `securityHeaders.js` خوانده می‌شوند؛ CSP/HSTS/`Secure` به‌جای «غایب» به‌درستی «شرطی» نشان داده می‌شوند وقتی توسعه/HTTP است. قفل ورود مدیر بر اساس حساب کار می‌کند؛ تعداد IPهای audit فقط «نیازمند بررسی» است و دیگر «مسدود» نام نمی‌گیرد.
- DTO عمداً شامل IP، User-Agent، cookie، token، username یا body نیست. نتیجهٔ سلامت storage فقط خرابی‌هایی را نشان می‌دهد که همین process دیده؛ فایل‌سیستم را hash-scan نمی‌کند.
- پنل در `src/layout/admin/GuardianCenter.jsx` هر ۲۰ ثانیه فقط‌خواندنی poll می‌کند، لغو درخواست در unmount دارد و پنجره/محدودیت منبع داده را آشکارا نمایش می‌دهد. اقدام خودکار خاموش است: block، revoke، quarantine، restore/rollback و تغییر کد وجود ندارد.

**مرزهای عملیاتی:** داده‌ها process-local و با restart از دست می‌روند؛ تاریخچهٔ ۷روزه، alert persistence، مانیتور خارج از سرور، GeoIP و تجمیع چند process وجود ندارد. در Vite/preview ممکن است فقط متریک درخواست‌های API پنل در دسترس باشد؛ در production منبع اصلی متریک server middleware است. آماده‌بودن storage سنجش دسترسی خواندن/نوشتن است، نه اثبات صحت همهٔ داده‌ها.

### تصحیح گزارش موجود در همین ممیزی

- شمار مسیرها پس از Guardian: **۲۳۰** (admin ۱۸۷، public ۱۵، exam ۱۶، users ۸، google ۴)؛ قرارداد نوشتن همچنان **۱۳۴** و بدون مسیر جدید نوشتن. DTO **۱۱** و کد خطا **۲۸**.
- مرکز امنیت قدیمی در `analyticsEngine.js` هدرهای CSP/HSTS/X-Frame را به‌اشتباه `missing` و ۸ شکست login را `blocked` نشان می‌داد، در حالی که پیاده‌سازی واقعی خلاف این را می‌گفت. اکنون با `securityPosture.js` و label «نیازمند بررسی» تصحیح شده؛ **هیچ IP بر اساس این شاخص مسدود نمی‌شود**.
- تست واحد Guardian/security posture سبز شد؛ تست API+RBAC از مسیر محافظ snapshot: admin ۹۵/۹۵، Guardian ۵/۵، security headers ۱۴/۱۴، API contract suite سبز. شمارش‌های قراردادیِ سخت‌کد با مسیر جدید همگام شدند؛ `api-contract.mjs --check` و route contract هر دو با ۲۳۰ مسیر سبزند. باندل React headless، dynamic import پنل و chunk Guardian جدا را تأیید کرد. بیلد کامل Vite و browser E2E اجرا نشده‌اند.

---

# 0.1 بازنگری ۲ — تاریخچهٔ نوبت پیشین (۱ اکتبر ۲۰۲۶ · ~۱۶:۳۰)

> ⚠️ این بخش **وضعیت ۱۶:۳۰** را توصیف می‌کند و در موارد زیر با وضعیت فعلی فرق دارد: کامیت‌ها ۴۰ بود (الان ۵۰) · ۱۷۲ فایل کامیت‌نشده بود (الان ۸) · دروازه ۲۶ گام بود (الان ۳۶) · هدر امنیتی/مهاجرت/ErrorBoundary/SEO وجود نداشت. **مرجع فعلی = بخش ۰.**

> **مبنا:** `main` @ `a86d875` («manageSOP») · Node `22.22.2` · working tree با **۱۷۲ مسیر تغییر‌یافته** (کامیت‌نشده).
> **هیچ کامیت تازه‌ای زده نشده** — تمام ۲۳ فاز سخت‌سازی روی working tree است. این خودش یک ریسک فعال است (بند ۰.۶).

## 0.1 خلاصهٔ یک‌پاراگرافی

در ممیزی پایه (۲۹ سپتامبر) **شش حفرهٔ امنیتی** در مسیر کاربران سایت و بانک تست باز بود. امروز (۱ اکتبر) **هر شش مورد بسته شده و هر شش مورد تست رگرسیون دارند.** در همین مسیر یک **آسیب‌پذیری واقعی XSS** در پاک‌ساز HTML کشف و رفع شد (نه فقط ادعا — با اثبات حساسیت جهشی). لایهٔ قرارداد API ماشین‌خوان شد (۲۲۹ مسیر / ۲۸ کد خطا / ۱۱ DTO / ۰ نقض)، مشاهده‌پذیری پایه اضافه شد (`/healthz` · `/readyz` · `/metrics` · `X-Request-Id`)، بکاپ/بازیابی با تست واقعی ۱۲/۱۲ آمد، و `dist/` **بازساخته شد** (از یک فایل ۴٫۴MB به ۱۹ chunk با entry ۱٫۵۶MB). دروازهٔ کیفیت از ~۱۰ گام به **۲۶ گام** رسید و **۲۶/۲۶ سبز** است.
**اما:** هیچ‌یک از سه Gate فاز ۲۱–۲۳ کامل عبور نکرد. **staging وجود ندارد**، **E2E مرورگری وجود ندارد**، **load test نشده**، **SEO پیاده نشده**، **OpenAPI نیست**، **CI هرگز اجرا نشده**، و **تاریخچهٔ Git هنوز ۲۱۹MB با PII است**.

## 0.2 جدول تغییرات — وضعیت هر یافتهٔ ممیزی پایه

| # | یافتهٔ پایه (۲۹ سپتامبر) | وضعیت فعلی | شاهد تأییدشده |
|---|---|---|---|
| ۱ | **تصاحب حساب** با ثبت‌نام مجدد روی شمارهٔ موجود | ✅ **FIXED** | `createUser` روی شمارهٔ تکراری `USER_ALREADY_EXISTS` پرتاب می‌کند و **هیچ‌چیز** بازنویسی نمی‌شود (`database/usersStore.js:180-208`)؛ `register` → ۴۰۹ (`database/usersApi.js:322-334`). تست: `usersAuth.test.mjs` ۷۸/۷۸ |
| ۲ | هش رمز کاربران سایت با `SHA-256` **بدون salt** | ✅ **FIXED** | `scrypt$salt$hash` با `scryptSync` + `timingSafeEqual` (`usersStore.js:57-107`)؛ هش قدیمی فقط **خواندنی** و در اولین ورود موفق به scrypt ارتقا می‌یابد (`:237-250`, `:259-275`). هیچ مسیری scrypt→SHA-256 برنمی‌گردد |
| ۳ | **ورود بدون بررسی رمز** در fallback کلاینت | ✅ **FIXED** | کل مسیر `readLocalUsers`/`saveUserRecord` حذف شد؛ `loginUser` فقط با پاسخ ۲۰۰ سرور کاربر می‌سازد (`src/services/userStorage.js:190-212`). `localStorage` صریحاً «کش نمایشی» اعلام شده (`:4-17`) |
| ۴ | **نشت کلید پاسخ** بانک تست در endpoint عمومی | ✅ **FIXED** | allowlist صریح `PUBLIC_TEST_BANK_FIELDS` + `publicTestBankStats` که فقط ۳ شاخص می‌دهد (`database/contentStore.js:3294-3317`)؛ لایهٔ دوم: tripwire `guardPublicOutput` (`database/apiContract/dtos.js:224-234`). تست: `bank:test` ۴۰/۴۰ شامل سنجهٔ ۳۸ (اسکن کلیدواژه‌ای) |
| ۵ | **نشت پروفایل + enumeration** با `GET /api/users?phone=` | ✅ **FIXED** | مسیر **حذف** شد؛ هر مسیر lookup عمومی ۴۰۴ می‌گیرد (`usersApi.js:351-356`). پروفایل فقط از `GET/PATCH /api/users/me` سشن‌محور |
| ۶ | **بدون Rate Limit** روی ورود/ثبت‌نام کاربران | ✅ **FIXED** | `database/userRateLimit.js` با **دو سطل** (IP + IP\|شناسه): login ۳۰/IP و ۸/شناسه در ۶۰s · register ۱۰/IP و ۳/شناسه در ۳۰۰s؛ `enforceRateLimit` (`usersApi.js:207-215`, `:327`, `:341`) |
| ۷ | باندل **۴٫۴MB در یک فایل** | ✅ **FIXED** | `dist/` بازساختهٔ ۲۰۲۶-۱۰-۰۱ ۱۳:۴۸ — **۱۹ chunk JS**؛ entry `index-BVIlCwBi.js` = **۱٫۵۶MB**؛ بزرگ‌ترین chunk `mockData` = ۱٫۸۱MB؛ `manualChunks` اکنون واقعاً اثر دارد |
| ۸ | `dist/` **کهنه** (۱۸ سپتامبر) | ✅ **FIXED** | `dist/index.html` و کل `dist/assets/` با mtime ۲۰۲۶-۱۰-۰۱ ۱۳:۴۸ |
| ۹ | ۴۷MB artifact + PII در **تاریخچهٔ Git** | ❌ **OPEN** | `.git` هنوز **۲۱۹MB**؛ بازنویسی تاریخچه انجام نشده (نیازمند تأیید صریح) |
| ۱۰ | **بدون بکاپ محتوا** | ⚠️ **PARTIAL** | `scripts/data-backup.mjs` · `data-restore.mjs` (dry-run + `--apply`) · `backup:restore:test` **۱۲/۱۲** سبز. **زمان‌بندی خودکار ندارد** |
| ۱۱ | **بدون Error Boundary** | ❌ **OPEN** | `ErrorBoundary` در `src/` فقط در یک `README.md` دیده می‌شود (`src/layout/group/README.md`); هیچ کامپوننت واقعی نیست |
| ۱۲ | **نشست ادمین در حافظهٔ پروسه** | ❌ **OPEN** | `const sessions = new Map()` (`contentStore.js:910`) — اما `destroySessionsForAdmin` برای ابطال اضافه شد (`:1028`) |
| ۱۳ | **نوشتن غیراتمیک JSON** | ✅ **FIXED** | `writeJsonAtomic` با tmp→rename (`contentStore.js:411-424`)، و `assertNotCorrupt` پیش از نوشتن. تست: `content:atomic:test` سبز |
| ۱۴ | `/uploads/**` **بدون کنترل دسترسی** | ❌ **OPEN** | `serveUploadRequest` هنوز چک نشستی ندارد |
| ۱۵ | **ارتقای سطح دسترسی** توسط admin معمولی | ✅ **FIXED** | مجوز مرزی `users.superadmin.manage` + `ADMIN_DENIED_PERMISSIONS` (`contentStore.js:162-164`)؛ گارد نقش در ساخت (`:4141`) و ویرایش/حذف (`:4197-4209`, `:4293-4306`)؛ آخرین مدیر کل ⇒ ۴۰۹. تست: `admin:rbac:test` ۶۴/۶۴ |
| ۱۶ | بدون Sitemap/Robots/Canonical/OG/JSON-LD | ❌ **OPEN** | `ls public/` = فقط `anatomy` و `uploads`؛ در `index.html` **۰** مورد `og:`/`twitter:`/`canonical`/`ld+json`. **تصمیم مستند شد** (`docs/ops/seo-strategy.md`) ولی پیاده نشد |
| ۱۷ | ۲۹ breakpoint بی‌مقیاس | ❌ **OPEN** | هیچ فایل CSS تغییری در این محور نکرده؛ شمار فایل CSS ثابت (۵۵) و خطوط ثابت (۵۰٬۰۰۸) |
| ۱۸ | `adminApi.js` غول | ❌ **OPEN (بدتر)** | از ۲٬۷۶۰ به **۲٬۸۴۷** خط رسید |
| ۱۹ | `contentStore.js` غول | ❌ **OPEN (بدتر)** | از ۳٬۸۹۷ به **۴٬۴۲۳** خط رسید |
| ۲۰ | تکرار helperهای HTTP | ⚠️ **PARTIAL** | پل مشترک `database/apiContract/input.js` ساخته شد و سه فایل مرز جدول خطای محلی را با import از مدل مرکزی جایگزین کردند؛ **ولی** `readBody`/`sendJson` هنوز در چند فایل تکرار می‌شوند |
| ۲۱ | CSS پنل برای همهٔ بازدیدکنندگان | ❌ **OPEN** | `src/App.jsx` هنوز importهای سطح‌بالای CSS را دارد |
| ۲۲ | **بدون تست** برای احراز هویت کاربران سایت | ✅ **FIXED** | `database/usersAuth.test.mjs` — **۷۸ سنجه** (اجرای تازه: ۷۸ قبول · ۰ رد · exit 0) |
| ۲۳ | ۳۵ فایل تغییر uncommitted | ❌ **OPEN (بدتر)** | `git status --short` = **۱۷۲** مسیر |
| ۲۴ | `events.json`/`activity.json` tracked | ⚠️ **PARTIAL** | `.gitignore` به‌روز شد (activity/admins/events/publishLog/mediaMetrics اضافه شدند) **ولی فایل‌ها هنوز tracked‌اند** — نیازمند `git rm --cached` با تأیید |
| ۲۵ | بدون اعتبارسنجی شماره/رمز | ✅ **FIXED** | `database/authPolicy.js` خالص + `validatePhone`/`validatePassword` (`usersStore.js:29`, `:182-186`)؛ همین توابع در کلاینت هم صدا زده می‌شوند (`userStorage.js:83-85`) |

**نتیجهٔ جدول:** از ۲۵ مسئلهٔ ممیزی پایه — **۱۱ مورد FIXED · ۵ مورد PARTIAL · ۹ مورد OPEN**.

## 0.3 یافته‌های تازه (که در ممیزی پایه نبودند)

| مورد | وضعیت | شاهد |
|---|---|---|
| **آسیب‌پذیری واقعی XSS** در `sanitizeHtml.js` (تگ با نقل‌قول بسته‌نشده) | ✅ کشف و رفع شد | `database/sanitizeHtmlXss.test.mjs` — **۱۴/۱۴** (اجرای تازه). ۳۹ payload خصمانه. **اثبات حساسیت:** بازگرداندن عمدی escape ⇒ **۱۲/۱۴ · exit 1**؛ لاگ `.workbuddy-ai/phase-logs/xss-mutation.log` |
| **۵ از ۵ نقطهٔ رندر** اکنون پاک‌سازی زمان‌رندر دارند | ✅ IMPLEMENTED | رگرسیون ساختاری روی sinkها در همان سوییت |
| **مدل خطای مرکزی API** | ✅ IMPLEMENTED | `database/apiContract/errorModel.js`؛ ۲۸ کد در مدل، ۲۲ کد مصرف‌شده در `database/`+`scripts/`، **۰ کد خارج از مدل**. سه فایل مرز فقط جدول محلی را با `const STATUS_BY_CODE = ADMIN_STATUS_BY_CODE;` عوض کردند ⇒ صفر تغییر رفتار |
| **لایهٔ DTO + گارد نشت خروجی** | ✅ IMPLEMENTED | `database/apiContract/dtos.js` — ۱۱ DTO عمومی، `guardPublicOutput` روی حلقهٔ `PUBLIC_ROUTES`. تست: `api:test` ۳۱/۳۱ |
| **دروازهٔ اعتبارسنجی ورودی در ۱۱۸ مسیر نوشتن** | ⚠️ **PARTIAL** | پل ساخته شد (`apiContract/input.js`) ولی سیم‌کشی نشد؛ `assertInputValid` فقط **۴ بار** و فقط در `adminApi.js` |
| **مشاهده‌پذیری** (`/healthz` · `/readyz` · `/metrics`) | ✅ IMPLEMENTED | `database/observability.js` خالص؛ `/metrics` فقط با `TAPESH_METRICS_TOKEN` (مقایسهٔ ثابت‌زمان؛ بدون توکن ⇒ **۴۰۴ نه ۴۰۳**). `obs:test` **۱۷/۱۷**. لاگ JSON تک‌خطی + `X-Request-Id` روی هر پاسخ. query/IP/UA/بدنه هرگز لاگ نمی‌شوند |
| **مدل داده و اسکنر یکپارچگی** | ✅ IMPLEMENTED | `database/models/` (۸ ماژول: `enums` ۴۵ enum · `fields` · `normalizer` · `validator` · `relations` · `integrity` · `observe`) + `scripts/data-integrity.mjs`. `data:test` **۲۵۴/۲۵۴** |
| **ناظر مسیر نوشتن** | ✅ IMPLEMENTED | `models/observe.js` — تنها نقطهٔ تزریق `writeJson` در `contentStore.js:423`؛ با `TAPESH_MODEL_OBSERVE=1` |
| **تشخیص خرابی JSON** | ✅ IMPLEMENTED | `storageCorruption.test.mjs`؛ `STORAGE_CORRUPT` + `TAPESH_STORAGE_CORRUPT_MODE=throw` |
| **گارد SSRF انتشار** | ✅ IMPLEMENTED | `database/publishers/urlGuard.js` + `publisherUrlGuard.test.mjs` |
| **بکاپ/بازیابی با dry-run** | ✅ IMPLEMENTED | `scripts/data-backup.mjs` · `data-restore.mjs` (`--apply`) · `backup:restore:test` **۱۲/۱۲** |
| **بودجهٔ باندل ماشین‌خوان** | ✅ IMPLEMENTED | `scripts/bundle-budget.mjs` — ۸ سقف، **۰ نقض** (مصرف ۸۷٪–۹۳٪). اثبات حساسیت: کاهش عمدی `js.total` ⇒ exit 1 |
| **E2E سطح API بدون مرورگر** | ✅ IMPLEMENTED | `scripts/e2e-api-flows.mjs` — **۲۷/۲۷**. **اثبات حساسیت:** حذف `assertSameOrigin` از `logout` ⇒ **۲۶/۲۷ · exit 1**؛ پس از بازگردانی **۲۷/۲۷ · exit 0**، فایل صفر تغییر خالص |
| **Threat Model** | ✅ سند | `docs/security/threat-model.md` — ۲۰ تهدید · ۱۰ دارایی · **۶ ردیف OPEN** |
| **workflow CI** | ⚠️ **PARTIAL** | `.github/workflows/ci.yml` (۳ job) نوشته شد — **هرگز اجرا نشد** (repo به GitHub push نشده) |
| **دروازهٔ کیفیت** | ✅ IMPLEMENTED | `scripts/verify-all.mjs` — **۲۶ گام** · **۲۶/۲۶ سبز** · exit 0 · **۴۲۶٫۷ ثانیه**. لاگ مرجع: `.workbuddy-ai/phase-logs/verify-all-26.log` |
| **`npm audit`** | ✅ صفر | ۰ آسیب‌پذیری (critical/high/moderate/low/info همه ۰) در ۲۰۹ وابستگی |
| **repo:hygiene** | ⚠️ **۱۸ یافته** | ۰ سرّ · ۱۳ فایل حجیم · ۵ دادهٔ زمان‌اجرا tracked |

## 0.4 اعداد به‌روز (اندازه‌گیری‌شده در همین بازنگری)

| سنجه | ممیزی پایه (۲۹ سپتامبر) | بازنگری ۲ (۱ اکتبر) |
|---|---|---|
| مسیرهای API | ۲۱۲ | **۲۲۹** (admin ۱۸۶ · public ۱۵ · exam ۱۶ · users ۸ · google ۴) |
| مسیرهای نوشتن | — | **۱۳۴** (۱۱۸ نوشتن ادمین، همه با CSRF و مجوز صریح، ۰ مسیر deny-by-default باز) |
| کد خطای مدل | — | **۲۸** در مدل · ۲۲ مصرف‌شده · **۰ خارج از مدل** |
| DTO عمومی | — | **۱۱** · `publicRoutesWithoutDto` = **۰** |
| Permission | ۷۴ | **۸۰** · ۳ نقش (`super-admin`/`admin`/`editor`) |
| مجموعهٔ محتوا | ۳۶ | **۳۳** |
| سقف بدنهٔ درخواست | — | ۱۲MB · ۱MB · ۲۵۶KB · ۶۴KB · ۸KB |
| سقف بودجهٔ باندل | — | **۸ سقف** · ۰ نقض |
| گام‌های دروازهٔ کیفیت | ~۱۰ | **۲۶** |
| **`dist/` JS** | ۴٫۴۱MB در ۱ فایل | **۵٫۷۴MB در ۱۹ chunk** — entry **۱٫۵۶MB** |
| **`dist/` CSS** | ۷۷۲KB در ۱ فایل | **۹۳۲KB در ۱۰ chunk** |
| **`dist/` کل** | — | **۲۰۰٫۸۹MB** · ۱۸۳ فایل (glb ۱۰۵٫۹۰MB · mp4 ۳۹٫۰۲MB · تصاویر ۴۸٫۱۰MB) |
| `data:check` | (اجرا نشده) | **۰ خطا · ۲۲ هشدار · ۱۵۴۹ رکورد · exit 0** |
| `api:contract:check` | — | **۰ نقض** |
| فایل `src/*.jsx` | ۳۰۲ | **۳۰۲** (بدون تغییر ساختاری) |
| فایل `src/*.js` | ۱۲۴ | **۱۲۳** (`analytics/mockData.js` حذف شد) |
| فایل `src/*.css` | ۵۵ | **۵۵** · خطوط **۵۰٬۰۰۸** (بدون تغییر) |
| اسناد `docs/**/*.md` | ۱ | **۲۲** |
| اسکریپت `scripts/*.mjs` | ۱۲ | **۳۰** |
| فایل `database/*.test.mjs` | ~۳ | **۱۶** |
| `.git` | ۲۱۹MB | **۲۱۹MB** (بدون تغییر) |
| مسیرهای تغییر‌یافته | ~۳۵ | **۱۷۲** |

**سنجه‌های تست (اجرای واقعی این بازنگری + ثبت‌شدهٔ امروز):**

| سوییت | نتیجه | اجراکننده |
|---|---|---|
| `data:check` | ۰ خطا · ۲۲ هشدار · ۱۵۴۹ رکورد · exit 0 | **این بازنگری** |
| `api:contract:check` | ۲۲۹ مسیر · ۲۸ کد خطا · ۱۱ DTO · ۰ نقض | **این بازنگری** |
| `auth:test` | **۷۸/۷۸** · exit 0 | **این بازنگری** |
| `bank:test` | **۴۰/۴۰** · exit 0 | **این بازنگری** |
| `xss:test` | **۱۴/۱۴** · exit 0 | **این بازنگری** |
| `perf:bundle` | ۸ سقف · ۰ نقض | **این بازنگری** |
| `data:test` | ۲۵۴/۲۵۴ | ثبت امروز |
| `exam:test` | ۲۷/۲۷ | ثبت امروز |
| `admin:test` + `rbac` + `security` | ۹۲ + ۶۴ + ۶۰ = **۲۱۶** | ثبت امروز |
| `domain:test` | ۲۲ موفق · ۰ ناموفق | ثبت امروز |
| `planning:test` | ۳۴ موفق · ۰ ناموفق | ثبت امروز |
| `router:test` | ۱۲۸ قبول · ۰ رد | ثبت امروز |
| `backup:restore:test` | ۱۲/۱۲ | ثبت امروز |
| `obs:test` | ۱۷/۱۷ | ثبت امروز |
| `smoke:test` | ۱۷/۱۷ | ثبت امروز |
| `e2e:api` | ۲۷/۲۷ | ثبت امروز |
| **دروازهٔ کامل** | **۲۶/۲۶ · exit 0 · ۴۲۶٫۷s** | ثبت امروز |

## 0.5 آنچه **هنوز باز است** (اولویت‌بندی‌شده)

| اولویت | مورد | وضعیت | چرا مهم است |
|---|---|---|---|
| 🔴 **۱** | **۱۷۲ فایل کامیت‌نشده** — تمام ۲۳ فاز روی working tree | OPEN | یک `git checkout`/کرش = از دست رفتن کل سخت‌سازی. **بزرگ‌ترین ریسک فعلی** |
| 🔴 **۲** | بازنویسی تاریخچهٔ Git (۲۱۹MB + `users.json` با هش رمز در ۵ کامیت + `activity.json` با IP/UA) | OPEN — **نیازمند تأیید صریح** | نشت PII در تاریخچهٔ عمومی |
| 🟠 **۳** | **staging وجود ندارد** | BLOCKED | Gate فاز ۲۱ به همین دلیل عبور نکرد؛ load test و DR drill ناممکن |
| 🟠 **۴** | **E2E مرورگری وجود ندارد** (playwright/cypress/puppeteer/vitest/jsdom = NONE) | BLOCKED | جریان‌های UI کاملاً UNVERIFIED |
| 🟠 **۵** | **Core Web Vitals** اندازه‌گیری نشده | UNVERIFIED | بودجهٔ باندل هست، تجربهٔ واقعی کاربر نیست |
| 🟠 **۶** | **SEO پیاده نشده** (sitemap/robots/canonical/OG/JSON-LD) | OPEN (تصمیم مستند) | پلتفرم محتوایی بدون SEO |
| 🟠 **۷** | **CI هرگز اجرا نشده** | PARTIAL | `.github/workflows/ci.yml` نوشته شده ولی هیچ اجرای واقعی دیده نشد |
| 🟡 **۸** | `ErrorBoundary` نیست | OPEN | یک باگ = صفحهٔ سفید |
| 🟡 **۹** | نشست ادمین در حافظهٔ پروسه | OPEN | ری‌استارت = خروج همه؛ مانع scale افقی |
| 🟡 **۱۰** | `/uploads/**` بدون کنترل دسترسی | OPEN | ۵۵MB فایل با URL عمومی |
| 🟡 **۱۱** | OpenAPI وجود ندارد | NOT FOUND | ۲۲۹ مسیر بدون سند ماشینی استاندارد |
| 🟡 **۱۲** | migration نسخه‌دار وجود ندارد | NOT FOUND | Gate فاز ۲۱ به همین دلیل عبور نکرد |
| 🟡 **۱۳** | دروازهٔ ورودی در ۱۱۸ مسیر نوشتن سیم‌کشی نشده | PARTIAL | `assertInputValid` فقط ۴ بار |
| 🟡 **۱۴** | coverage tooling نصب نیست (`c8`/`nyc`/`istanbul` = NONE) | UNKNOWN | پوشش فقط «دامنه‌ای» استنتاج می‌شود |
| 🟢 **۱۵** | `adminApi.js` ۲٬۸۴۷ خط · `contentStore.js` ۴٬۴۲۳ خط | OPEN (بدتر) | ریسک تغییر |
| 🟢 **۱۶** | ۵ دادهٔ زمان‌اجرا هنوز tracked (نیازمند `git rm --cached`) | PARTIAL | churn + PII |
| 🟢 **۱۷** | AI/Payment بدون consumer واقعی · publisher بدون توکن | UNVERIFIED | بدون sandbox قابل آزمون نیست |
| 🟢 **۱۸** | ۲۹ breakpoint بی‌مقیاس · CSS پنل برای همه | OPEN | نگهداری و payload |

## 0.6 داوری Gateهای فاز ۲۱–۲۳

| فاز | Gate | نتیجه |
|---|---|---|
| ۲۱ — Production Readiness / SRE / Data Governance | **عبور نکرد** | باز: staging (BLOCKED) · migration نسخه‌دار (NOT FOUND) |
| ۲۲ — Security / API Contracts / Integration | **عبور نکرد** | باز: OpenAPI · AI/Payment · سرّها و دادهٔ زمان‌اجرا در تاریخچهٔ Git |
| ۲۳ — Quality / Scale / Product Readiness | **عبور نکرد** | باز: E2E مرورگری · load test · SEO · responsive · integration خارجی |

> **نکتهٔ روش‌شناختی:** `IMPLEMENTED ≠ VERIFIED`. هر ردیف «FIXED» در بند ۰.۲ دست‌کم یک شاهد اجرایی (تست سبز یا کد قابل‌ارجاع) دارد؛ هر ردیف `UNVERIFIED` یعنی **اجرا نشده**، نه «احتمالاً خراب».

> **هیچ امتیاز، Score یا رتبه‌بندی کلی داده نشده است** — طبق درخواست.

---

# 1. Executive Summary

> ⚠️ این بخش متن **ممیزی پایه (۲۹ سپتامبر)** است و وضعیت آن روز را توصیف می‌کند. **وضعیت فعلی در بخش ۰ آمده است.**

**ماهیت سیستم.** «تپش» (`tapesh-medical-learning`, `package.json:2`) یک پلتفرم یادگیری پزشکی فارسی/RTL است: ۷ صفحهٔ عمومی سایت + داشبورد با ۱۴ لایه + پنل مدیریت با ۲۱۲ مسیر API + مرکز تحلیل ۱۶ بخشی + مرکز رسانه. کل UI با React 19 و بدون هیچ کتابخانهٔ UI/نمودار/روتر ساخته شده؛ روتر دستی روی `window.location.hash` است (`src/router/appRoute.js:9`).

**معماری کلی.** یک اپلیکیشن **SPA + Backend فایل‌محور بدون دیتابیس** است. `database/**` با `node:http` خالص اجرا می‌شود و همان هندلرها دو میزبان دارند: middleware ویت (توسعه، `vite.config.js:40`) و `server.js` (پروداکشن، `server.js:129`). ذخیره‌سازی، فایل‌های JSON روی دیسک‌اند (`database/content/*.json` — ۳۶ مجموعه، ۳٫۵ مگابایت). هیچ ORM، هیچ کوئری، هیچ تراکنش، هیچ ایندکسی وجود ندارد.

**وضعیت امنیت.** پایهٔ پنل مدیریت محکم است (کوکی `HttpOnly`+`SameSite=Strict`، توکن CSRF اجباری روی همهٔ متدهای تغییردهنده، مجوز per-route با ۷۴ Permission و ۳ نقش، رمز مدیر با `scrypt`، قفل پس از ۸ تلاش ناموفق). **اما مسیر کاربران سایت (غیرمدیر) سه حفرهٔ جدی دارد:** بازنشانی رمز از طریق ثبت‌نام مجدد با همان شماره (تصاحب حساب)، هش `SHA-256` بدون Salt، و یک fallback سمت کلاینت که در نبود API کاربر را **بدون بررسی رمز** وارد می‌کند. علاوه بر این، endpoint عمومی بانک تست کلید پاسخ و توضیح تشریحی را برمی‌گرداند.

**وضعیت Performance.** باندل بیلدشده یک فایل JS **۴٫۴۱ مگابایت** (فشرده‌نشده) + CSS **۷۷۲ کیلوبایت** است (`dist/assets/index-CE3tjnht.js`). کد اسپلیت فقط برای لایه‌های داشبورد انجام شده (`DashboardLayout.jsx:24-38`) و برای صفحهٔ عمومی سایت انجام نشده. ۱۶۱ مگابایت دارایی استاتیک در `public/` (۱۰۶M مدل ۳بعدی + ۵۵M آپلود) وجود دارد.

**وضعیت Code Quality.** انسجام کامنت‌ها و مستندسازی استثنایی است (۱٫۳ مگابایت README اصلی + ۲۳ README زیرلایه + ۳٫۵ کیلو خط هارنس تست). در مقابل: ۲۱۲ مسیر در یک فایل ۱۱۱ کیلوبایتی، شش فایل store غول (تا ۱۷۱ کیلوبایت)، تکرار helperها بین میزبان‌ها، و ۳۲ مورد `eslint-disable` که اکثراً `exhaustive-deps` هستند.

**مهم‌ترین مشکلات.** (۱) تصاحب حساب با ثبت‌نام مجدد (۲) هش رمز بدون Salt (۳) نشت کلید پاسخ بانک تست به‌صورت عمومی (۴) ورود بدون رمز در fallback کلاینت (۵) نبود Rate Limit روی ورود کاربران سایت (۶) باندل ۴٫۴ مگابایتی (۷) `dist/` کهنه (۸) نبود Error Boundary.

**مهم‌ترین اقدامات بعدی.** بستن حفرهٔ تصاحب حساب، مهاجرت هش رمز کاربران به `scrypt`، حذف/محدودسازی فیلدهای حساس از `publicTestBankQuestion`، حذف fallback ورود بدون رمز، افزودن Rate Limit به `usersApi`، و افزودن `ErrorBoundary`.

> ### 🔄 تصحیح بازنگری ۲ (۱ اکتبر ۲۰۲۶)
>
> **پنج پاراگراف بالا وضعیت ۲۹ سپتامبر است و دیگر معتبر نیست.** خلاصهٔ وضعیت فعلی:
>
> - **وضعیت امنیت — برطرف شد.** هر شش حفرهٔ ذکرشده در پاراگراف «وضعیت امنیت» بسته شده و تست رگرسیون دارد: تصاحب حساب (۴۰۹ روی شمارهٔ تکراری)، `scrypt$salt$hash` با `timingSafeEqual`، حذف `GET /api/users?phone=`، حذف fallback ورود بدون رمز، Rate Limit دو-سطحی روی login/register، و allowlist صریح روی خروجی عمومی بانک تست. **به‌علاوه یک آسیب‌پذیری واقعی XSS در `sanitizeHtml.js` کشف و رفع شد** (با اثبات حساسیت جهشی).
> - **وضعیت Performance — برطرف شد.** باندل تک‌فایل ۴٫۴۱MB جایش را به **۱۹ chunk** داد؛ entry به **۱٫۵۶MB** رسید (`dist/` بازساختهٔ ۲۰۲۶-۱۰-۰۱). سقف بودجهٔ باندل ماشین‌خوان شد (۸ سقف، ۰ نقض).
> - **«مهم‌ترین مشکلات» و «مهم‌ترین اقدامات بعدی» — منقضی.** موارد ۱ تا ۶ هر دو فهرست انجام شدند. **فهرست فعلی در بند ۰.۵** است؛ بزرگ‌ترین ریسک امروز **۱۷۲ فایل کامیت‌نشده** و **تاریخچهٔ ۲۱۹MB گیت** است.
> - **آنچه تغییر نکرد:** `ErrorBoundary` هنوز وجود ندارد · SEO پیاده نشده · staging و E2E مرورگری و load test هنوز نیستند · `adminApi.js`/`contentStore.js` بزرگ‌تر شدند · `.git` همان ۲۱۹MB است.

> **هیچ امتیاز، Score یا رتبه‌بندی کلی داده نشده است** — طبق درخواست.

---

# 2. Project Identity

| مورد | مقدار / وضعیت | شواهد |
|---|---|---|
| نام پروژه | `tapesh-medical-learning` (نمایشی: «تپش») | `package.json:2`, `index.html:12` |
| نوع پروژه | SPA آموزشی/آزمونی + پنل مدیریت محتوا + مرکز تحلیل | `index.html:90`, `src/App.jsx:1107` |
| هدف اصلی | یادگیری پزشکی و آمادگی آزمون‌های علوم پزشکی | `index.html:9`, `README.md:16` |
| مخاطب هدف | دانشجویان علوم پزشکی فارسی‌زبان (از محتوا استنباط می‌شود) | `contentStore.js:282-293` دسته‌های علوم پایه، `:307` «درسنامهٔ جامع علوم پایه» — `INFERENCE` |
| Frontend | React 19.1.1 + JSX، بدون TypeScript | `package.json:23-24`, `jsconfig.json` |
| Backend | `node:http` خالص، بدون فریم‌ورک | `server.js:11`, `database/adminApi.js:2523` |
| Database | **NOT FOUND** (دیتابیس واقعی). جایش: ۳۶ فایل JSON | `database/content/` (۳٫۵M) |
| Authentication (مدیر) | کوکی سشن در حافظهٔ پروسه + CSRF header + `scrypt` — `IMPLEMENTED` | `contentStore.js:368-382, 757-796`, `adminApi.js:2708-2721` |
| Authentication (کاربر سایت) | کوکی HttpOnly فایل‌پشتیبان + `SHA-256` بدون Salt — `PARTIALLY IMPLEMENTED` | `userSessions.js:64-83`, `usersStore.js:9-11` |
| Authorization | ۷۴ Permission × ۳ نقش + `super-admin` با `['*']` — `IMPLEMENTED` | `contentStore.js:76-171`, `adminApi.js:2723-2725` |
| State Management | بدون کتابخانه. `useState`/`useReducer` محلی + hash به‌عنوان state ناوبری + `localStorage` به‌عنوان state پایدار | `src/router/appRoute.js:9-70`, ۳۵ نقطهٔ `localStorage` در `src/services/**` |
| Routing | روتر دستی hash-based، بدون react-router | `src/router/appRoute.js`, `src/router/routeHashes.js` |
| Styling | CSS خام (۵۵ فایل، ۵۰٬۰۰۸ خط) + Tailwind v4 در بخش‌های محدود | `src/styles.css:1-17`, `package.json:21,34` |
| Build Tool | Vite 7.1.2 | `package.json:26`, `vite.config.js:39` |
| Package Manager | npm (`package-lock.json` ۱۰۷KB) | — |
| Testing Framework | `node:test` (تست‌های دامنه) + هارنس‌های اسکریپتی دست‌ساز | `package.json:17-18`, `scripts/` |
| Deployment Config | `server.js` + `PORT`/`HOST`. **بدون Docker/CI/CD/CDN** | `server.js:38-39` |
| External Services | بله/تلگرام/ایتا (انتشار)، Google OAuth، Google Analytics/GSC/PageSpeed (اختیاری) | `database/publishers/`, `database/googleAuth.js:32-34`, `.env.example` |
| Third-party APIs | Instagram Graph API (آداپتور موجود) | `database/publishers/instagram.js` |
| AI integrations | `src/services/ai/` با `mockAI.js`/`mockResponses.js` — **شبیه‌ساز، نه مدل واقعی** | `src/services/ai/` |
| Analytics | مرکز تحلیل خودساخته (رویداد beacon + سنجهٔ سرور) + سرویس‌های بیرونی اختیاری — `PARTIALLY IMPLEMENTED` | `database/analyticsStore.js`, `.env.example` |
| Payment integrations | **NOT FOUND** در کد. فقط `PAYMENT_PROVIDER`/`PAYMENT_API_KEY` به‌عنوان متغیر محیطی مستند شده | `.env.example` (بخش درگاه پرداخت) |
| Storage | فایل‌سیستم محلی: `database/content/*.json` + `public/uploads/` (۵۵M) | `uploadsFile.js:21` |
| Email/SMS | **NOT FOUND** | جست‌وجو بی‌نتیجه |

---

# 3. Repository Map

## 3.1 درخت کلی

```
tapeshweb/                                    542 MB (با .git) · 219 MB .git
├── index.html                                نقطهٔ ورود Vite · preload فونت + ضد‌FOUC تم
├── server.js                                 سرور پروداکشن، node:http خالص
├── vite.config.js                            پلاگین‌ها + manualChunks + watch.ignored + loadEnvFile
├── jsconfig.json                             IntelliSense (بدون TypeScript)
├── .env.example                              ۹٫۸ KB — همهٔ متغیرهای محیطی مستند
├── .env                                      ❌ وجود ندارد (Google OAuth غیرفعال)
├── package.json / package-lock.json          ۶ dependency + ۵ devDependency
│
├── src/                                      168,406 خط JS/JSX + 50,008 خط CSS
│   ├── App.jsx                               ۱٬۱۰۷ خط — روتر کل + صفحهٔ اصلی + ورود/ثبت‌نام
│   ├── main.jsx                              createRoot + تزریق فاوآیکون
│   ├── styles.css                            فقط ۱۷ خط @import (فقط ورودی)
│   ├── styles/                               ۱۷ فایل CSS پایه (tokens, fonts, header, hero, …)
│   ├── router/                               appRoute.js · routeHashes.js · README
│   ├── hooks/                                useEasterEggClick.js (تنها هوک عمومی)
│   ├── components/easter-egg/                ۱۳ فایل — بازی مستقل با موتور و Web Audio
│   ├── data/                                 anatomyCourse.js · ۱۹ فایل میکرودرسنامه
│   ├── layout/                               ۸۵٬۷۱۶ خط — تمام UI
│   │   ├── site/  auth/  about/  pricing/  products/  group/  articles/
│   │   ├── admin/                            ۲۱ view + analytics(5) + media(20) + planning(9)
│   │   └── dashboard/                        ۲۱ فایل + ۱۴ زیرلایهٔ lazy
│   └── services/                             ۶۸٬۹۸۹ خط — تمام لایهٔ دادهٔ کلاینت (۳۵ دامنه)
│
├── database/                                 ۲۱٬۸۳۸ خط — تمام کد سرور
│   ├── adminApi.js                           ۱۱۱ KB — ۲۱۲ مسیر + لایهٔ امنیتی
│   ├── contentStore.js                       ۱۷۱ KB — RBAC + نشست + CMS
│   ├── mediaStore.js                         ۱۴۹ KB — مرکز رسانه
│   ├── analyticsEngine.js / analyticsInsights.js / analyticsStore.js
│   ├── examApi.js / examStore.js / examSeed.mjs
│   ├── usersApi.js / usersStore.js / userSessions.js
│   ├── googleAuth.js                         ۱۳ KB — OAuth 2.0 دست‌نویس
│   ├── publishingStore.js + publishers/      ۵ آداپتور پلتفرم
│   ├── sanitizeHtml.js                       allow-list مشترک سرور/کلاینت
│   ├── uploadsFile.js                        سرو uploads + Range
│   ├── content/                              ۳۶ JSON · ۳٫۵ MB
│   ├── publishing.secrets.json               ۲۴۵ B · مجوز ۰۶۰۰ · خارج از Git
│   └── *.test.mjs × ۳                        adminApi(۴۹KB) · examApi(۱۷KB) · googleAuth(۱۰KB)
│
├── scripts/                                  ۳٬۳۴۹ خط — هارنس‌های تأیید
│   ├── verify-render.mjs                     ۸۶ KB — ۱۴۸+ سنجهٔ رندر headless
│   ├── domain-tests.mjs                      ۲۲ سنجه — اجرا شد: ۲۲/۲۲ ✅
│   ├── planning-service-test.mjs             ۳۴ سنجه — اجرا شد: ۳۴/۰ ✅
│   ├── auth-render-check.mjs                 بررسی رندر AuthPage
│   └── theme-verify / theme-contrast / tailwind-probe
│
├── public/                                   ۱۶۱ MB — anatomy ۱۰۶M + uploads ۵۵M
├── images/                                   ۳۸ MB — pictures ۱۹M · courses ۸٫۵M · avatars ۸٫۳M
├── fonts/                                    ۸۲۴ KB — doran/ · pinar/ · vazir/
├── dist/                                     ۴۱ MB — بیلد ۱۸ سپتامبر (کهنه)
├── docs/security/                            ۱ سند ۳۲ KB — گزارش امنیتی آزمون‌های هماهنگ
└── claude/                                   تنظیمات محلی ابزار (untracked)
```

## 3.2 جدول پوشه‌های مهم

| Path | Type | Responsibility | Dependencies | Status | Risk |
|---|---|---|---|---|---|
| `src/App.jsx` | Entry + Router | روتر سطح‌بالا، صفحهٔ اصلی، ورود/ثبت‌نام | ۲۵ import؛ همهٔ صفحات | `IMPLEMENTED` | **متوسط** — ۱٬۱۰۷ خط، ترتیب اولویت مسیرها حیاتی |
| `src/router/` | Route | تنها منبع حقیقت مسیرها | `dashboardRoute`, `groupService` | `IMPLEMENTED` | **متوسط** — وابستگی برگشتی: روتر به `layout/dashboard` import می‌کند |
| `src/layout/**` | UI | فقط رندر | `src/services/**` | `IMPLEMENTED` | **متوسط** — ۳۲ فایل > ۶۰۰ خط |
| `src/services/**` | Domain/Data | منطق دامنه + persistence | `localStorage` + `/api/public/*` | `PARTIALLY IMPLEMENTED` | **بالا** — ۳۵ دامنه، بخش عمده داده در مرورگر کاربر است |
| `src/data/micro/` | Content | ۱۹ درسنامهٔ دست‌نویس | — | `IMPLEMENTED` | پایین |
| `database/adminApi.js` | API | ۲۱۲ مسیر پنل + امنیت | ۸ store | `IMPLEMENTED` | **بالا** — تک‌فایل ۱۱۱ KB |
| `database/contentStore.js` | Store | CMS + RBAC + نشست | `src/data/learning/anatomyCourse.js` | `IMPLEMENTED` | **بالا** — ۱۷۱ KB، read/write کل فایل در هر درخواست |
| `database/mediaStore.js` | Store | مرکز رسانه (۱۲ مجموعه) | `contentStore` | `IMPLEMENTED` | **بالا** — ۱۴۹ KB |
| `database/examApi.js` + `examStore.js` | API+Store | آزمون هماهنگ سرورمحور | `userSessions`, `usersStore` | `IMPLEMENTED` | **متوسط** — تنها بخشی با Rate Limit per-route |
| `database/usersApi.js` + `usersStore.js` | API+Store | حساب کاربران سایت | `userSessions` | `PARTIALLY IMPLEMENTED` | **بحرانی** — تصاحب حساب + هش ضعیف |
| `database/googleAuth.js` | OAuth | جریان کامل start/callback/handoff | `usersStore`, `userSessions` | `IMPLEMENTED` (کد) / `UNVERIFIED` (اجرا) | متوسط — `.env` موجود نیست |
| `database/analytics*` | Analytics | ۳ فایل، ~۱۶۱ KB | `contentStore`, `usersStore`, `node:os` | `IMPLEMENTED` | متوسط — خواندن مکرر JSON |
| `database/publishers/` | Integration | ۵ آداپتور انتشار | fetch سرور | `IMPLEMENTED` | متوسط — رفتار بیرونی `UNVERIFIED` |
| `scripts/` | Tooling | تأیید بدون مرورگر | esbuild, react | `IMPLEMENTED` | پایین |
| `public/anatomy/` | Asset | ۷ مدل GLB، ۱۰۶ MB | `three` | `IMPLEMENTED` | **بالا** — حجم و هزینهٔ انتقال |
| `public/uploads/` | Asset | فایل‌های آپلودی، ۵۵ MB | — | `IMPLEMENTED` | **متوسط** — بدون کنترل دسترسی سرو می‌شود |

---

# 4. Technology Stack

| نام | نسخه | محل استفاده | علت | Deprecated? | ریسک مهاجرت | جایگزین |
|---|---|---|---|---|---|---|
| `react` / `react-dom` | ^19.1.1 | کل UI | پایه | خیر | بالا (همه‌جا) | — |
| `vite` | ^7.1.2 | dev + build | سرعت | خیر | پایین | — |
| `@vitejs/plugin-react` | ^5.0.2 | JSX/Fast Refresh | — | خیر | پایین | — |
| `tailwindcss` + `@tailwindcss/vite` | ^4.3.3 | فقط چند بخش | utility | خیر | متوسط | CSS خام |
| `three` | ^0.186.0 | `anatomy3d/` + ۷ مدل GLB | ۳بعدی | خیر | بالا برای این لایه | `@react-three/fiber` |
| `@gltf-transform/core|extensions|functions` | ^4.5.0 | devDependency — پایپ‌لاین مدل | بهینه‌سازی GLB | خیر | — |
| `fbx2gltf` | ^0.9.7-p1 | devDependency | تبدیل FBX | **آخرین نسخه ۲۰۱۹ — عملاً رهاشده** | پایین (فقط ابزار بیلد مدل) | `gltf-transform` / Blender CLI |
| `meshoptimizer` | ^1.2.0 | devDependency | فشرده‌سازی مش | خیر | پایین | — |

**نکته:** `three` و کل پایپ‌لاین 3D فقط برای یک لایه (`anatomy-3d`) استفاده می‌شوند. `vite.config.js:45-53` برای `three` chunk جدا تعریف کرده است.

## 4.1 Dependencyها

- **Unused:** `NOT FOUND` — هر ۶ dependency اصلی در سورس import می‌شوند. ۵ devDependency فقط در `scripts/anatomy/build-anatomy-models.mjs` و `vite.config.js` استفاده می‌شوند (`INFERENCE`: بررسی مستقیم import هر بسته انجام نشد).
- **Duplicate:** `NOT FOUND` در `package.json`. اما **هم‌پوشانی کارکردی در سطح کد** وجود دارد: `readBody` در سه فایل (`adminApi.js:380`, `usersApi.js:29`, و منطق مشابه در `examApi.js`)، `sendJson`/`ok`/`fail` در سه فایل، `parseCookies` در چند فایل، `safeEqual` در دو فایل.
- **قدیمی:** `fbx2gltf` (۲۰۱۹).
- **ریسک امنیتی شناخته‌شده:** `UNVERIFIED` — هیچ‌گاه `npm audit` اجرا نشد (به‌درخواست، بدون اجرای دستورهای اضافه). تعداد کل dependencyها بسیار کم است (۶ + ۵) که سطح حملهٔ زنجیرهٔ تأمین را کوچک نگه می‌دارد — `OBSERVATION`.
- **غیرضروری:** `tailwindcss` — `README.md:42` خودش می‌گوید «فقط در چند بخش استفاده شده، نه کل پروژه». حجم `admin.css` (۴٬۴۶۲ خط) و بقیهٔ CSS دست‌نویس نشان می‌دهد Tailwind نقش حاشیه‌ای دارد. `INFERENCE`: حذف آن صرفه‌جویی محسوسی نمی‌دهد ولی یک لایهٔ پیچیدگی بیلد را برمی‌دارد.
- **پیچیدگی غیرضروری:** `three` + ۷ مدل GLB با ۱۰۶ مگابایت دارایی برای یک لایه.

---

# 5. Architecture

## 5.1 معماری فعلی

```
┌──────────────────────────── مرورگر (SPA) ────────────────────────────┐
│  index.html → main.jsx → App.jsx (روتر hash)                          │
│     ├── layout/site|auth|about|pricing|products|group|articles        │
│     ├── layout/dashboard/DashboardLayout  → ۱۴ لایهٔ lazy + Suspense   │
│     └── layout/admin/AdminLayout → ۲۱ view + analytics + media        │
│                          │                                            │
│                    services/** (۳۵ دامنه)                             │
│              ┌───────────┴────────────┐                               │
│       localStorage (۳۵ کلید)     fetch → /api/public/* , /api/users/*  │
└──────────────────────────────────────────────────────────────────────┘
                            │  HTTP (same-origin، بدون CORS)
┌───────────────────────────▼──────────────────────────────────────────┐
│  server.js (پروداکشن)  ||  vite middleware (توسعه)                    │
│     handleApi → handleExamApi → handleUsersApi → handleGoogleAuthApi  │
│                            │                                          │
│         contentStore · examStore · usersStore · mediaStore · analytics │
│                            │                                          │
│              JSON files روی دیسک  (readFileSync/writeFileSync)         │
└──────────────────────────────────────────────────────────────────────┘
                            │
              بله / تلگرام / ایتا / Instagram  (fetch سرور)
```

## 5.2 نقاط اتصال و جریان‌ها

| پرسش | پاسخ | شواهد |
|---|---|---|
| Frontend و Backend چطور وصل‌اند؟ | همان اوریجین، بدون CORS. توسعه: middleware ویت؛ پروداکشن: `server.js`. مسیرها با پیشوند `/api/` جدا می‌شوند | `vite.config.js:40`, `server.js:131-144` |
| Data Flow | UI → `src/services/**` → (`localStorage` \| `fetch`) → store سرور → JSON روی دیسک | `src/services/userStorage.js:93`, `contentStore.js:620-632` |
| Authentication Flow (مدیر) | `POST /api/admin/auth/login` → `authenticate()` → `createSession()` → کوکی `tapesh_admin_session` + `csrfToken` در بدنه | `adminApi.js:523-568`, `contentStore.js:724-772` |
| Authentication Flow (کاربر) | `POST /api/users/login` → `verifyUser()` → `createUserSession()` → کوکی `tapesh_user_session` (۷ روز) | `usersApi.js:164-176`, `userSessions.js:64-83` |
| Authentication Flow (گوگل) | `/start` → گوگل → `/callback` → handoff یک‌بارمصرف در حافظه → `/handoff` | `googleAuth.js:9-13, 49` |
| Authorization Flow | `ROUTES` هر مسیر یک Permission دارد؛ `hasPermission(admin, permission)` پیش از اجرای handler | `adminApi.js:2698-2725` |
| API Flow | `handleApi` → `matchRoute` → چک نشست → چک CSRF (روی mutating) → چک مجوز → `readBody` → handler → `ok()`. `finally` سنجه ثبت می‌کند | `adminApi.js:2523-2758` |
| Component hierarchy | `App` → (route) → `*Page` → `*Layout` → section → card. داشبورد: `DashboardLayout` → `LAYER_IDS` → `lazy()` layer | `src/App.jsx:28-38`, `DashboardLayout.jsx:24-38` |
| Service Layer | **بله** — `src/services/<domain>/` قانون سخت پروژه است (`README.md:184`) | `src/services/` ۳۵ دامنه |
| Repository/Data Access Layer | **بله، سمت سرور** — `*Store.js` نقش repository دارد. سمت کلاینت هم `greenPathRepository.js` و `referencesApi.js` | `contentStore.js:620-632`, `greenPath/greenPathRepository.js` |
| Business Logic کجا؟ | **دو جا:** سرور (`contentStore`, `examStore`, `planningService`) و کلاینت (`src/services/**` — منطق امتیاز، پیشرفت، لیگ، فلش‌کارت) | `src/services/testBank/testBankService.js`, `league/` |
| Validation کجا؟ | **پراکنده:** درون توابع store (مثل `saveUser` فقط `phone-required`)؛ در API (نوع بدنه و آرایه‌بودن)؛ در UI (فرم‌ها). **هیچ لایهٔ اعتبارسنجی اسکیمایی وجود ندارد** | `usersStore.js:70-72`, `usersApi.js:140-143` |
| Error Handling کجا؟ | سه لایه: `try/catch` در `handleApi` → `sendError` با نگاشت کد→HTTP؛ در کلاینت `try/catch` + state؛ **بدون Error Boundary** | `adminApi.js:2741-2744`, `sendError:351-368` |

## 5.3 ارزیابی اصول

| اصل | وضعیت | شواهد |
|---|---|---|
| Separation of Concerns | ✅ رعایت شده | `README.md:184` «UI هرگز مستقیم به داده دست نمی‌زند» — با grep، هیچ import مستقیم mockData در JSX پیدا نشد |
| Single Responsibility | ⚠️ **نقض در چند نقطه** | `contentStore.js` هم‌زمان RBAC + نشست + CMS + بانک تست + فلش‌کارت + مرجع + رسانه انجام می‌دهد (۱۷۱ KB) |
| Coupling | ⚠️ متوسط تا بالا | `router/routeHashes.js:7-9` از `layout/dashboard` import می‌کند (router → layout = جهت معکوس). `contentStore.js:61` از `src/data/learning/anatomyCourse.js` import می‌کند (سرور → سورس کلاینت) |
| Cohesion | ✅ مناسب درون هر دامنه | ۳۵ پوشهٔ مستقل در `src/services/` |
| Circular Dependency | `NOT FOUND` در سطح ماژول (بدون اجرای تحلیل گراف تأیید نشد) | — |
| God Component | ⚠️ **بله** | `AdminMicro.jsx` ۱٬۷۵۰ خط · `AdminIntlCourses.jsx` ۱٬۳۷۴ · `AdminComprehensive.jsx` ۱٬۲۱۷ · `RichTextEditor.jsx` ۱٬۱۷۹ · `App.jsx` ۱٬۱۰۷ · `InternationalCoursesLayer.jsx` ۱٬۱۲۴ (۲۱ `useState` + ۱۰ `useEffect`) |
| God Function | ⚠️ بله | `handleApi` ۲۳۶ خط (`adminApi.js:2523-2758`) · `adminApi.js` ۲٬۷۶۱ خط در یک فایل |
| Duplicate Logic | ⚠️ **بله** | `readBody` ×۳ · `sendJson` ×۳ · `ok`/`fail` ×۳ · `parseCookies` ×۲+ · `safeEqual` ×۲+ · منطق امتیاز/آزمون در `examStore.js` (سرور) و `src/services/testBank/` (کلاینت) |
| Business Logic در UI | ⚠️ جزئی | `src/layout/dashboard/dashboardRoute.jsx` منطق مسیر را با رندر ترکیب می‌کند |
| Backend Logic در Frontend | 🔴 **بله — جدی** | `src/services/userStorage.js:110-133` fallback ورود بدون بررسی رمز · `:73-108` ساخت رکورد کاربر محلی |
| Security-sensitive logic در client | 🔴 **بله** | همان مورد بالا + `localStorage` به‌عنوان منبع هویت (`userStorage.js:40-56`) |

## 5.4 Architecture Diagram (نهایی)

```
User
 ↓  hash URL (#dashboard?s=…&l=…&v=…)
Frontend  ── src/layout/** (۳۰۲ فایل JSX)
 ↓  import
State/Services ── src/services/** (۳۵ دامنه) + localStorage (۳۵ کلید) + src/router/
 ↓  fetch (same-origin)
API ── handleApi(212 admin + 11 public) · handleExamApi(20) · handleUsersApi(6) · handleGoogleAuthApi(4)
 ↓  توابع دامنه
Business Logic ── contentStore · examStore · mediaStore · analyticsStore · publishingStore · planningService
 ↓  readFileSync/writeFileSync
Persistence ── database/content/*.json (۳۶ فایل) + database/users.json + users.sessions.json
 ↓  fetch سرور
External ── Google OAuth · بله · تلگرام · ایتا · Instagram Graph · GA/GSC/PageSpeed
```

---

# 6. Feature Inventory

| Feature | Frontend | Backend | Database | API | Auth | Status | Completeness |
|---|---|---|---|---|---|---|---|
| صفحهٔ اصلی سایت | ✅ `App.jsx` | — | — | — | — | `IMPLEMENTED` | کامل |
| ورود/ثبت‌نام با شماره | ✅ `layout/auth/AuthPage.jsx` | ✅ `usersApi.js` | ✅ `users.json` | `POST /api/users/login|register` | کوکی سشن | `PARTIALLY IMPLEMENTED` | **رمز ضعیف + تصاحب حساب + fallback بدون رمز** |
| ورود/ثبت‌نام گوگل | ✅ `AuthPage` | ✅ `googleAuth.js` | ✅ `users.json` | `/api/auth/google/{status,start,callback,handoff}` | state + handoff | `IMPLEMENTED` کد / `UNVERIFIED` اجرا (`.env` نیست) | کامل جز پیکربندی |
| مقالات (CMS) | ✅ `layout/articles/` | ✅ `contentStore` | ✅ `articles.json` (۶۲KB) | ۶ مسیر ادمین + `/api/public/articles` | ادمین | `IMPLEMENTED` | کامل |
| تعرفه‌ها | ✅ `layout/pricing/` | ❌ | ❌ | — | — | `PARTIALLY IMPLEMENTED` | مبالغ نمونه؛ `amountsConfirmed=false` |
| محصولات | ✅ `layout/products/` | ❌ | ❌ | — | — | `IMPLEMENTED` (استاتیک) | کامل برای نمایش |
| اشتراک گروهی | ✅ `layout/group/` | ❌ | ❌ | — | — | `PARTIALLY IMPLEMENTED` | کد اشتراک و تخفیف در کلاینت |
| دربارهٔ تپش | ✅ `layout/about/` | ❌ | ❌ | — | — | `IMPLEMENTED` | — |
| داشبورد (۱۴ لایه) | ✅ `layout/dashboard/` | جزئی | جزئی | `/api/public/*` | کوکی کاربر | `PARTIALLY IMPLEMENTED` | پیشرفت کاربر عمدتاً در `localStorage` |
| بانک تست | ✅ `tests/bank/` | ✅ `testBankService` | ✅ `testBankQuestions.json` (۱۶۴KB) | `/api/public/test-bank/questions` | **عمومی** | `IMPLEMENTED` | 🔴 **کلید پاسخ لو می‌رود** |
| آزمون‌های هماهنگ | ✅ `tests/coordinated/` | ✅ `examApi` + `examStore` | ✅ `exams.json`, `examQuestions.json` | ۲۰ مسیر `/api/exams/*` | کوکی + CSRF + Rate Limit | `IMPLEMENTED` | کامل‌ترین بخش سیستم |
| آزمون‌های بین‌الملل | ✅ `tests/international*` | ❌ | — | — | — | `PARTIALLY IMPLEMENTED` | ساخت آزمون شخصی در کلاینت |
| میکرو درسنامه | ✅ `courses/micro/` | ✅ `contentStore` | ✅ `microCourses.json` (۸۵۰KB) | ۸ مسیر ادمین + `/api/public/micro/library` | ادمین/عمومی | `IMPLEMENTED` | کامل |
| درسنامهٔ جامع | ✅ `courses/Comprehensive*` | ✅ `contentStore` | ✅ `comprehensiveCourses.json` (۲۰۶KB) | ۴ مسیر | ادمین/عمومی | `IMPLEMENTED` | کامل |
| مراجع / رفرنس | ✅ `courses/reference/reader/` | ✅ `contentStore` | ✅ `references.json` (۱۵۰KB) | ۵ مسیر | ادمین/عمومی | `IMPLEMENTED` | کامل |
| فلش‌کارت | ✅ `flashcards/` | ✅ `contentStore` | ✅ `flashcardDecks.json` (۵۶KB) | ۵ مسیر | ادمین/عمومی | `IMPLEMENTED` | کامل |
| دوره‌های بین‌الملل | ✅ `InternationalCoursesLayer.jsx` | ✅ `contentStore` | ✅ `intlCourses.json` + `intlProviders.json` | ۱۱ مسیر + آپلود باینری | ادمین | `IMPLEMENTED` | کامل |
| ویکی تپش | ✅ `wiki/` | ❌ | ✅ `mockData.js` (۳۹٬۸۹۰ خط!) | — | — | `PARTIALLY IMPLEMENTED` | داده در سورس، نه سرور |
| شبکه دانش | ✅ `knowledge/` | ❌ | `graphData.js` (۱٬۰۷۱ خط) | — | — | `PARTIALLY IMPLEMENTED` | پیشرفت در `localStorage` |
| لیگ تپش | ✅ `league/` | ❌ | `mockData.js` | — | — | `PARTIALLY IMPLEMENTED` | README: «دوئل لیگ UI نهایی ندارد» |
| دستیار AI | ✅ `dashboard/ai/` | ❌ | `mockAI.js`/`mockResponses.js` | — | — | `PARTIALLY IMPLEMENTED` | شبیه‌ساز، نه مدل واقعی |
| یادداشت | ✅ `notes/` | ✅ `contentStore` | ✅ `notes.json` | ۸ مسیر | ادمین | `IMPLEMENTED` | — |
| مرکز تحلیل ۱۶ بخشی | ✅ `admin/analytics/` | ✅ ۳ فایل analytics | ✅ `events.json`, `alerts.json` | ۱۰ مسیر | ۷ Permission جدا | `IMPLEMENTED` | با `connected:false` صادق |
| مرکز رسانه | ✅ `admin/media/` (۲۰ فایل) | ✅ `mediaStore.js` | ۱۲ مجموعه | ~۸۰ مسیر | ۷ Permission | `IMPLEMENTED` | بزرگ‌ترین بخش پنل |
| انتشار در کانال‌ها | ✅ `AdminPublishing.jsx` | ✅ `publishingStore` + ۵ آداپتور | ✅ `publishChannels.json`, `publishLog.json` | ۹ مسیر | `publishing.send` | `IMPLEMENTED` | رفتار بیرونی `UNVERIFIED` |
| برنامه‌ریزی (SOP/مالی/تقویم) | ✅ `admin/planning/` (۹ سکشن) | ✅ `planningService.js` | ❌ سرور ندارد | — | ادمین | `PARTIALLY IMPLEMENTED` | فقط `localStorage` |
| بازخورد کاربران | ✅ `services/feedback/` | ✅ `feedbackStore.js` | ✅ `feedback.json` | ۴ مسیر عمومی + ۴ ادمین | Rate Limit | `IMPLEMENTED` | جدید (untracked) |
| آپلود فایل/تصویر | ✅ `MediaPicker.jsx` | ✅ `contentStore.createMedia` + `saveIntlUpload` | فایل روی دیسک | ۲ مسیر | `media.upload`/`intl.upload` | `IMPLEMENTED` | بدون آنتی‌ویروس/بازپردازش تصویر |
| ایستر اگ (بازی) | ✅ `components/easter-egg/` (۱۳ فایل) | ❌ | `localStorage` | — | — | `IMPLEMENTED` | مستقل، با موتور ۱/۶۰ و Web Audio |
| آناتومی ۳بعدی | ✅ `dashboard/anatomy3d/` | ❌ | ۷ GLB، ۱۰۶ MB | — | — | `IMPLEMENTED` | نیازمند `three` |

**الگوی تکرارشونده:** هر Featureی که به محتوای CMS وصل است کامل است؛ هر Featureی که «وضعیت کاربر» را نگه می‌دارد عمدتاً در `localStorage` می‌ماند و بین دستگاه‌ها sync نمی‌شود.

---

# 7. Database

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶):** هنوز **هیچ دیتابیس واقعی‌ای وجود ندارد** — persistence همان فایل‌های JSON است. **اما** یک **لایهٔ مدل داده** روی آن ساخته شد:
>
> - `database/models/` — ۸ ماژول: `enums.js` (**۴۵ enum** با `ENUM_REGISTRY`) · `fields.js` · `normalizers.js` (`normalize → validate → persist`) · `validator.js` · `relations.js` · `integrity.js` (خالص) · `observe.js` (ناظر مسیر نوشتن) · `schemas/` (شامل `platform.js`)
> - **اسکنر یکپارچگی:** `scripts/data-integrity.mjs` با `data:check` / `data:repair` (dry-run) — اجرای تازه: **۰ خطا · ۲۲ هشدار · ۱۵۴۹ رکورد · exit 0**
> - **تست:** `database/dataIntegrity.test.mjs` — **۲۵۴/۲۵۴** در ۱۵ بخش
> - **گارد شکل:** `storage_shape_mismatch` — **حذف نکنید**
> - **نوشتن اتمیک:** `writeJsonAtomic` با tmp→rename (`contentStore.js:411-424`) + `assertNotCorrupt`
> - **مجموعه‌ها از ۳۶ به ۳۳ کاهش یافت** (`COLLECTIONS` الان آرایه است، نه آبجکت): `testBankAnswers`/`testBankHeartRewards`/`settings` از فهرست بیرون آمدند
> - **فایل‌های خارج از CMS:** `users.json` · `users.sessions.json` · `publishing.secrets.json` (۰۶۰۰) · `media.secrets.json` (۰۶۰۰)
>
> **جدول زیر متن ۲۹ سپتامبر است** و برای تاریخچه نگه داشته شده.

## 7.1 ساختار واقعی

**هیچ دیتابیسی وجود ندارد.** Persistence = فایل‌های JSON با `readFileSync`/`writeFileSync`.

- **مجموعه‌های CMS (۳۶ فایل، ۳٫۵ MB)** — فهرست کامل در `contentStore.js:191-247`:
  `admins`, `articles`, `categories`, `pages`, `media`, `banners`, `activity`, `notes`, `events`, `alerts`, `publishChannels`, `publishLog`, `flashcardDecks`, `testBankQuestions`, `testBankAnswers`, `testBankHeartRewards`, `microCourses`, `references`, `comprehensiveCourses`, `intlProviders`, `intlCourses`, `mediaPlatforms`, `mediaAccounts`, `mediaContents`, `mediaCampaigns`, `mediaTeam`, `mediaTags`, `mediaMetrics`, `mediaInbox`, `mediaMentions`, `mediaNotifications`, `mediaUtm`, `mediaMeta` + `settings.json`
- **فایل‌های خارج از CMS:** `database/users.json`, `database/users.sessions.json`, `database/publishing.secrets.json`, `database/media.secrets.json`
- **بزرگ‌ترین‌ها:** `events.json` ۱٬۳۵۴ KB · `microCourses.json` ۸۵۰ KB · `mediaMetrics.json` ۳۰۱ KB · `comprehensiveCourses.json` ۲۰۶ KB · `activity.json` ۱۸۸ KB

## 7.2 Tables / Models / Relations

| مفهوم درخواستی | معادل واقعی | وضعیت |
|---|---|---|
| Tables/Collections | ۳۶ فایل JSON | `PARTIALLY IMPLEMENTED` |
| Models | هیچ schema/interface مرکزی. شکل رکوردها ضمنی است | `NOT FOUND` |
| Relations | فقط ارجاع رشته‌ای: `intlCourse.providerId → intlProviders[].id`, `article.categoryId → categories[].id`, `mediaContent.accountId → mediaAccounts[].id` | `PARTIALLY IMPLEMENTED` |
| Foreign Keys | `NOT FOUND` — هیچ اعتبارسنجی ارجاع وجود ندارد | `NOT FOUND` |
| Indexes | `NOT FOUND` | `NOT FOUND` |
| Constraints | فقط دو مورد دستی: `ensureUniqueSlug()` (`contentStore.js:690-702`) و یکتایی `username` مدیر در `findAdminByUsername` | `PARTIALLY IMPLEMENTED` |
| Unique constraints | slug یکتا (دستی) · `phone` به‌عنوان کلید منطقی کاربر (`usersStore.js:76`) | `PARTIALLY IMPLEMENTED` |
| Nullable fields | هیچ تعریفی ندارد؛ `passwordHash` می‌تواند `null` باشد (حساب گوگلی) | `UNVERIFIED` |
| Enumها | ✅ **بله و خوب:** `PERMISSIONS` (۷۴)، `ROLES` (۳)، `ARTICLE_STATUSES` (`contentStore.js:858`)، `NOTE_KINDS` (`:3417`)، `TEST_BANK_STATUSES` (`:3023`) | `IMPLEMENTED` |
| Defaults | ✅ `DEFAULT_SETTINGS` (`contentStore.js:330-356`) با ادغام تودرتو در `readSettings()` | `IMPLEMENTED` |

## 7.3 ارزیابی

| پرسش | پاسخ | شواهد |
|---|---|---|
| Schema منطقی است؟ | ✅ برای CMS بله؛ شکل رکوردها در کامنت‌های `COLLECTIONS` توضیح داده شده | `contentStore.js:191-247` |
| Normalization | ✅ **مناسب.** حتی denormalization آگاهانه مستند شده: «کل درسنامه یک موجودیت مدیریتی است تا انتشار اتمیک بماند» | `contentStore.js:200-214` |
| Denormalization غیرضروری | ⚠️ `mediaMetrics.json` (۳۰۱ KB) عکس لحظه‌ای روز×اکانت است و می‌تواند به‌سرعت رشد کند | `contentStore.js:236` |
| Query پرهزینه | 🔴 **بله.** هر درخواست پنل کل فایل را می‌خواند و `JSON.parse` می‌کند. `readCollection('events')` روی ۱٫۳ MB = پارس کامل در هر فراخوانی. `publishedTestBankQuestions()` تمام بانک را می‌خواند | `contentStore.js:620-625`, `:3033-3037` |
| Index ناقص | 🔴 معادل: **هیچ ایندکسی وجود ندارد.** `findUserByPhone` = `O(n)` روی آرایه | `usersStore.js:46-49` |
| N+1 Query | معادل: `listTestBankQuestions` برای هر subject یک `filter` جدا می‌زند (`scoped.filter(...).length` داخل `map`) | `contentStore.js:3051` |
| Data duplication | ⚠️ **بله.** `microCourses.json` (۸۵۰ KB) با `src/data/micro/*.js` (۱۹ فایل) هم‌پوشانی دارد؛ `wiki/mockData.js` (۳۹٬۸۹۰ خط) در سورس و در `publishedWiki` نیست. `testBankQuestions` هم در JSON و هم در `src/services/testBank/mockData.js` | `contentStore.js:3000`, `src/data/micro/` |
| Race Condition | 🔴 **ممکن.** `read → modify → write` بدون قفل. دو درخواست هم‌زمان = از دست رفتن یکی. تنها فایلی که نوشتن اتمیک دارد `users.sessions.json` است | `contentStore.js:275-278` vs `userSessions.js:50-56` |
| Transaction لازم ولی نیست | 🔴 **بله.** ساخت میکرودرسنامه + انتشار + ثبت در `activity` سه فایل جدا را تغییر می‌دهد؛ شکست وسط کار = ناسازگاری | `adminApi.js:1082-1118` |
| Integrity constraint ضروری و غایب | 🔴 حذف یک `category` هیچ مقاله‌ای را پاک نمی‌کند ⇒ مقاله با `categoryId` یتیم می‌ماند. حذف `intlProvider` هیچ دوره‌ای را پاک نمی‌کند | `contentStore.js:1035-1049`, `:1672-1691` |

## 7.4 داده‌های حساس — کجا ذخیره می‌شوند؟

| داده | محل | محافظت | وضعیت |
|---|---|---|---|
| هش رمز مدیر | `database/content/admins.json` | `scrypt$salt$hash` (۱۶ بایت Salt، ۶۴ بایت مشتق) | ✅ `IMPLEMENTED` |
| هش رمز کاربر سایت | `database/users.json` | **`SHA-256` بدون Salt** | 🔴 `PARTIALLY IMPLEMENTED` |
| توکن نشست کاربر | `database/users.sessions.json` | توکن ۳۲ بایت CSPRNG، فایل gitignore | ✅ |
| توکن نشست مدیر | **حافظهٔ پروسه** (`sessions = new Map()`) | با ری‌استارت پاک می‌شود | ⚠️ `PARTIALLY IMPLEMENTED` |
| توکن ربات‌های انتشار | `database/publishing.secrets.json` | مجوز `0600`، خارج از Git | ✅ |
| کلید اپ‌های رسانه | `database/media.secrets.json` | مجوز `0600`، خارج از Git | ✅ |
| اطلاعات شخصی کاربران (نام، دانشگاه، ترم) | `database/users.json` | gitignore شده؛ اما از طریق `GET /api/users?phone=` **بدون احراز هویت** قابل خواندن است | 🔴 |
| کلید پاسخ بانک تست | `database/content/testBankQuestions.json` | در Git است و از طریق endpoint عمومی **برمی‌گردد** | 🔴 |
| کلید پاسخ آزمون هماهنگ | `database/content/examQuestions.json` | gitignore؛ `sanitizeQuestion()` کلید را حذف می‌کند | ✅ |

---

# 8. API Audit

## 8.1 خلاصهٔ شمارش

| گروه | تعداد | فایل | احراز هویت | CSRF | Rate Limit |
|---|---|---|---|---|---|
| پنل مدیریت | **۲۱۲** | `adminApi.js:523-2460` | کوکی + Permission | ✅ `x-tapesh-csrf` | فقط مسیر ورود (قفل ۸ تلاش) |
| عمومی سایت | **۱۱** | `adminApi.js:2464-2492` | ندارد | — | فقط `collect` و `feedback` |
| آزمون‌های هماهنگ | **۲۰** | `examApi.js:273-362` | کوکی کاربر (+ مهمان) | ✅ `x-tapesh-exam` | ✅ **per-route** (`allowRate`) |
| کاربران سایت | **۶** | `usersApi.js:102-184` | کوکی کاربر | ❌ (فقط SameSite) | ❌ **ندارد** |
| ورود با گوگل | **۴** | `googleAuth.js:327-341` | state cookie | — | ❌ |

## 8.2 نمونهٔ جدول کامل (گروه‌های کلیدی)

### مسیرهای حساس پنل

| Endpoint | Method | Auth | Role | Input | Validation | Output | Error | DB |
|---|---|---|---|---|---|---|---|---|
| `/api/admin/auth/login` | POST | ندارد (باز) | — | `{username,password}` | `authenticate()` | `{admin, csrfToken}` + کوکی | 401/429 | `admins.json` |
| `/api/admin/auth/logout` | POST | کوکی+CSRF | — | — | — | `{ok}` | — | حافظه |
| `/api/admin/users` | POST | کوکی+CSRF | `users.create` | admin جدید | `createAdmin()` | admin | 400/403 | `admins.json` |
| `/api/admin/users/:id` | DELETE | کوکی+CSRF | `users.delete` | — | `deleteAdmin(id, actorId)` | — | 403 | `admins.json` |
| `/api/admin/media/accounts/:id/credentials` | POST | کوکی+CSRF | `media.platforms.manage` | کلید API | — | — | 403 | `media.secrets.json` |
| `/api/admin/publishing/channels/:id/token` | POST | کوکی+CSRF | `publishing.channels.manage` | توکن ربات | — | — | 403 | `publishing.secrets.json` |
| `/api/admin/analytics/export` | GET | کوکی | `analytics.export` | `?range` | — | خروجی کامل | 403 | چند فایل |
| `/api/admin/intl-courses/upload` | POST | کوکی+CSRF | `intl.upload` | بدنهٔ **باینری** | پسوند از نام فایل (`uploadExtensionFor`) + سقف حجم | `{media}` | 415/413/403 | دیسک |

### مسیرهای عمومی

| Endpoint | Method | Auth | Validation | بازگردانده | ریسک |
|---|---|---|---|---|---|
| `/api/public/articles` | GET | — | — | تا ۱۰۰ مقالهٔ منتشرشده | — |
| `/api/public/test-bank/questions` | GET | — | — | **همهٔ سؤال‌های منتشرشده شامل `correctAnswer` + `explanation` + `stats`** | 🔴 سوءاستفاده |
| `/api/public/micro/library` | GET | — | — | درسنامه‌های منتشرشده | — |
| `/api/public/comprehensive/library` | GET | — | — | درس‌های منتشرشده | — |
| `/api/public/references/library` | GET | — | — | مراجع منتشرشده | — |
| `/api/public/flashcards/library` | GET | — | — | دک‌های منتشرشده | — |
| `/api/public/intl-courses/library` | GET | — | — | دوره‌ها + منابع | — |
| `/api/public/pages/:slug` | GET | — | `getPage(slug)` | صفحه | — |
| `/api/public/analytics/collect` | POST | — | `events[]` ≤ ۵۰ · بدنه ≤ ۶۴KB | `{recorded}` | Rate Limit ✅ |
| `/api/public/feedback` | POST | — (هویت اختیاری) | متن غیرخالی | `{item}` | Rate Limit ✅ |
| `/api/public/feedback/replies` | GET | `?userId` یا کوکی | — | پاسخ‌های همان `userId` | ⚠️ `userId` سبک کلاینتی |

### مسیرهای کاربران سایت

| Endpoint | Method | Auth | Origin check | Rate Limit | ریسک |
|---|---|---|---|---|---|
| `/api/users` (lookup) | GET | ❌ | ❌ | ❌ | 🔴 **نشت پروفایل + enumeration** |
| `/api/users/register` | POST | ❌ | ❌ | ❌ | 🔴 **تصاحب حساب** |
| `/api/users/login` | POST | ❌ | ❌ | ❌ | 🔴 **Brute force** |
| `/api/users/logout` | POST | کوکی | ✅ `origin === host` | ❌ | — |
| `/api/users/hearts` | GET | کوکی (اختیاری) | ❌ | ❌ | — |
| `/api/users/test-bank/answers` | POST | کوکی/مهمان | ✅ | ❌ | — |

## 8.3 چک‌لیست امنیتی API

| مورد | وضعیت | شواهد |
|---|---|---|
| Authentication | ✅ برای پنل و آزمون · 🔴 برای `usersApi` | `adminApi.js:2712-2714` vs `usersApi.js:156-176` |
| Authorization | ✅ per-route با `permission` در tuple مسیر | `adminApi.js:2723-2725` |
| Input Validation | ⚠️ سطحی: فقط نوع بدنه و آرایه‌بودن. `saveUser` فقط `phone` غیرخالی چک می‌کند — «4138» پذیرفته می‌شود | `usersStore.js:70-72` |
| Output Validation | ❌ `NOT FOUND` — هیچ لایه‌ای خروجی را پیش از ارسال پاک نمی‌کند (به‌جز `publicAdmin` و `sanitizeQuestion`) | — |
| Rate Limiting | ⚠️ ناهمگون: آزمون ✅ کامل · `collect`/`feedback` ✅ · ورود مدیر ✅ (قفل) · **`usersApi` ❌** | `examApi.js:217, 384` · `usersApi.js` (خالی) |
| CORS | ✅ عملاً غیرفعال — هیچ هدر `Access-Control-*` ست نمی‌شود ⇒ مرورگر درخواست بین‌دامنه را رد می‌کند | `adminApi.js:338-345`, `server.js` (بدون CORS) |
| CSRF | ✅ دو لایه: `SameSite=Strict` + هدر سفارشی `x-tapesh-csrf` با مقایسهٔ زمان‌ثابت | `adminApi.js:2716-2721`, `safeEqual:446-455` |
| Error Handling | ✅ نگاشت کد→HTTP، بدون نشت stack؛ جزئیات فقط در کنسول سرور | `sendError:351-368` |
| Logging | ⚠️ `logActivity` برای عملیات تغییردهندهٔ CMS ✅ · درخواست‌های خواندنی ثبت نمی‌شوند · سنجهٔ درخواست فقط در حافظه | `contentStore.js:827+`, `analyticsStore.js:219-245` |
| Idempotency | ❌ `NOT FOUND` — هیچ `Idempotency-Key`. تکرار `POST /publishing/send` پیام دوباره می‌فرستد | — |
| Pagination | ✅ در مسیرهای لیست (`paginate`, سقف ۱۰۰) | `contentStore.js:668-676` |
| Filtering | ✅ `search`/`status`/`subject`/`track` با نرمال‌سازی فارسی | `normalizeSearch:657-666` |
| Sorting | ⚠️ فقط در `listNotes` (`sort='updated'`) و مرتب‌سازی پیش‌فرض `createdAt` | `contentStore.js:3422` |
| Caching | ⚠️ `Cache-Control` روی دارایی استاتیک ✅ (یک‌ساله immutable برای image/font) · API همیشه `no-store` · **بدون ETag** | `server.js:82-86`, `adminApi.js:342` |
| Performance | ⚠️ پارس کامل JSON در هر درخواست + `readFileSync` بلاک‌کننده | `contentStore.js:265-278` |

## 8.4 آیا APIها قابل سوءاستفاده‌اند؟

| بردار | امکان | مسیر |
|---|---|---|
| تصاحب حساب | 🔴 **بله** | `POST /api/users/register` با شمارهٔ قربانی |
| نشت داده شخصی | 🔴 **بله** | `GET /api/users?phone=…` |
| استخراج کلید پاسخ | 🔴 **بله** | `GET /api/public/test-bank/questions` |
| Brute force رمز کاربر | 🔴 **بله** | `POST /api/users/login` بدون محدودیت |
| Brute force رمز مدیر | ✅ محدود | قفل ۱۰ دقیقه‌ای پس از ۸ تلاش (`contentStore.js:739-743`) |
| دسترسی افقی به Attempt دیگری | ✅ بسته | `attempt-not-found` وقتی Attempt متعلق به کاربر نباشد (`examStore` + `examApi.js:60`) |
| ارسال بدون مجوز به کانال | ✅ بسته | `publishing.send` جدا از `publishing.channels.manage` |
| IDOR روی مقاله/صفحهٔ پیش‌نویس | ✅ بسته | `GET /api/public/*` فقط `status === 'published'` را برمی‌گرداند |

---

# 9. Authentication & Authorization

## 9.1 دو سیستم مستقل هویت

**پنل مدیریت (قوی):**
- ورود: `POST /api/admin/auth/login` → `authenticate()` (`contentStore.js:724-755`)
- رمز: `scryptSync(password, salt16, 64)` + `timingSafeEqual` (`contentStore.js:368-382`)
- پیام خطای یکسان برای کاربر ناموجود و رمز غلط ⇒ ضد user enumeration (`contentStore.js:736`)
- قفل: پس از ۸ تلاش ناموفق، ۱۰ دقیقه (`contentStore.js:739-743`) — از `settings.security`
- نشست: توکن ۳۲ بایت CSPRNG در `Map` حافظهٔ پروسه، TTL ۱۲ ساعت با تمدید لغزان (`contentStore.js:757-796`)
- کوکی: `HttpOnly; SameSite=Strict; Path=/` + `Secure` در `NODE_ENV=production` (`adminApi.js:434-444`)
- CSRF: توکن ۲۴ بایت جداگانه، اجباری روی `POST/PUT/PATCH/DELETE` (`adminApi.js:2716-2721`)
- خروج: `destroySession` + کوکی با `Max-Age=0` (`adminApi.js:571-590`)

**کاربران سایت (ضعیف):**
- ورود: `POST /api/users/login` → `verifyUser()` (`usersStore.js:109-122`)
- رمز: **`SHA-256` بدون Salt** (`usersStore.js:9-11`)
- گارد خوب: `if (!user.passwordHash) return null` — حساب گوگلی با رمز خالی وارد نمی‌شود (تلهٔ ۱۴ مستند در `README.md:1119`)
- نشست: توکن ۳۲ بایت CSPRNG در فایل با **نوشتن اتمیک** (tmp+rename) — `userSessions.js:50-56`
- TTL: ۷ روز با تمدید لغزان وقتی نیمی از عمر گذشته باشد (`userSessions.js:109-115`)
- Revoke تنبل: حذف کاربر ⇒ نشستش باطل (`userSessions.js:102-107`)
- کوکی: `HttpOnly; SameSite=Strict; Path=/; Max-Age=604800` (`usersApi.js:68-71`)

## 9.2 پاسخ به هفت پرسش

**۱. کاربر چگونه احراز هویت می‌شود؟**
دو مسیر مستقل: (الف) مدیر با نام کاربری/رمز + کوکی سشن در حافظهٔ سرور؛ (ب) کاربر سایت با شماره/رمز یا گوگل + کوکی سشن فایل‌پشتیبان. همچنین سشن **ناشناس** برای آزمونک مهمان (`usersApi.js:83-96`).

**۲. سیستم چطور تشخیص می‌دهد کاربر چه مجوزهایی دارد؟**
مدیر: `ROLES[admin.role].permissions` (یا `['*']` برای `super-admin`) و `hasPermission()` (`contentStore.js:177-187`). کاربر سایت: **هیچ سیستم مجوزی ندارد** — هر کاربر واردشده دسترسی یکسان دارد؛ تفکیک فقط «خودش/دیگری» است.

**۳. آیا کنترل دسترسی فقط در Frontend انجام شده؟**
نه برای پنل (سرور چک می‌کند)؛ **بله** برای صفحهٔ ورود/ثبت‌نام سایت (تصمیم ورود در `userStorage.js` گرفته می‌شود).

**۴. آیا Backend نیز permission را بررسی می‌کند؟**
✅ بله — `adminApi.js:2723-2725` قبل از اجرای handler. و برای آپلود باینری جداگانه (`:2656-2658`).

**۵. آیا دسترسی مستقیم به resource دیگر کاربران ممکن است؟**
⚠️ **در دو جا بله:**
- `GET /api/users?phone=X` — پروفایل هر کاربر بدون احراز هویت (`usersApi.js:150-154`)
- `GET /api/public/feedback/replies?userId=X` — `userId` یک شناسهٔ سبک کلاینتی است که در `localStorage` تولید می‌شود؛ هر کسی با حدس/سرقت آن می‌تواند پاسخ‌های پشتیبانی کاربر دیگر را بخواند (`adminApi.js:2599-2623`)

**۶. آیا IDOR / BOLA ممکن است؟**
- `examApi`: ✅ بسته — هر مسیر `/api/attempts/:id/*` با `getAttemptFor(userId, id)` بررسی مالکیت می‌کند و `attempt-not-found` می‌دهد.
- `usersApi` lookup: 🔴 **BOLA** — `phone` به‌عنوان کلید دسترسی بدون هیچ توکنی.
- `adminApi`: ✅ همهٔ مسیرها Permission دارند؛ `notes` با `adminId` فیلتر می‌شود (`contentStore.js:3422, 3458`).

**۷. آیا session/token management امن است؟**
| جنبه | مدیر | کاربر |
|---|---|---|
| آنتروپی توکن | ۳۲ بایت CSPRNG ✅ | ۳۲ بایت CSPRNG ✅ |
| HttpOnly | ✅ | ✅ |
| SameSite | Strict ✅ | Strict ✅ |
| Secure | فقط در production ✅ | فقط با `x-forwarded-proto: https` ⚠️ |
| ذخیره‌گاه | حافظهٔ پروسه ⚠️ | فایل با نوشتن اتمیک ✅ |
| Rotation | ❌ ندارد | ❌ ندارد |
| Session fixation | ✅ بسته (توکن تازه در هر ورود) | ✅ بسته |
| Broken logout | ✅ سالم (سرور + کوکی پاک) | ✅ سالم + چک Origin |
| Token leakage | کوکی HttpOnly ⇒ از JS خوانده نمی‌شود. **اما** `localStorage['tapesh:current-user']` نسخهٔ دوم هویت را نگه می‌دارد | 🔴 |

---

# 10. Security Audit

## 10.1 Input Security

| بردار | وضعیت | شواهد |
|---|---|---|
| SQL Injection | ✅ **N/A** — هیچ دیتابیسی وجود ندارد | — |
| NoSQL Injection | ✅ **N/A** — هیچ کوئری‌ای وجود ندارد. مسیرها با `matchRoute` تطبیق رشته‌ای می‌شوند | `adminApi.js:459-475` |
| Command Injection | ✅ `NOT FOUND` — هیچ `child_process`/`exec` در کد اجرایی نیست | — |
| XSS | ⚠️ **محافظت‌شده اما پرریسک.** ۵ نقطهٔ `dangerouslySetInnerHTML` وجود دارد: `ContentBlocks.jsx:111`, `MicroBlocks.jsx:410`, `ArticlePage.jsx:772`, `AdminContentEditor.jsx:393`, `SopEditor.jsx:245`. دو مورد آخر با `sanitizeHtml` پاک می‌شوند؛ سه مورد اول باید بررسی شوند | `sanitizeHtml.js` allow-list قوی دارد (`:14-39`) |
| HTML Injection | ✅ `sanitizeHtml` تگ‌های غیرمجاز را **حذف** می‌کند (نه escape)، `on*`/`style`/`srcdoc` هرگز عبور نمی‌کنند، `cleanUrl` پروتکل خطرناک را می‌بندد | `sanitizeHtml.js:41-90` |
| Template Injection | ✅ `NOT FOUND` — هیچ موتور قالب/`eval`/`new Function` | — |

**نکتهٔ مهم دربارهٔ `sanitizeHtml`:** رویکرد regex-based است نه DOM-based. `DROP_WITH_CONTENT` برای `<script>…</script>`، `DROP_VOID` برای تگ‌های تک‌افتاده، و `TAG_RE` برای پیمایش. این پیاده‌سازی هوشمندانه است (نستد تگ‌های ناشناس را drop می‌کند)، اما regex-based sanitizer به‌طور کلی شکننده‌تر از DOM parser است. `INFERENCE` با اطمینان بالا: سطح خطر پایین است چون allow-list بسته است.

## 10.2 Authentication Security

| مورد | وضعیت | شواهد |
|---|---|---|
| Weak authentication (کاربر) | 🔴 **بله** — `SHA-256` بدون Salt + رمز ۴ رقمی پذیرفته‌شده («4138») + بدون حداقل طول | `usersStore.js:9-11`, `database/users.json` |
| Weak authentication (مدیر) | ✅ `scrypt` + قفل تلاش | `contentStore.js:368-382, 739-743` |
| Session fixation | ✅ بسته | توکن تازه در هر `createSession`/`createUserSession` |
| Token leakage | ⚠️ کوکی HttpOnly است، اما هویت کاربر در `localStorage` هم نگه داشته می‌شود | `userStorage.js:51-56` |
| Broken logout | ✅ سالم در هر دو سیستم | `usersApi.js:109-120`, `adminApi.js:571-590` |
| Account takeover | 🔴 **بله — جدی** | `POST /api/users/register` با شمارهٔ موجود، `passwordHash` را بازنویسی می‌کند و سشن صادر می‌کند. `usersStore.js:74-107` + `usersApi.js:156-162` |
| Brute force | 🔴 **بله** برای کاربران سایت | `usersApi.js` هیچ Rate Limit ندارد |
| CSRF روی ورود | ⚠️ `SameSite=Strict` تنها لایه است (کافی برای اکثر مرورگرها) | — |

## 10.3 Authorization

| مورد | وضعیت |
|---|---|
| IDOR | ✅ در `examApi` بسته · 🔴 در `usersApi` lookup |
| BOLA | 🔴 `GET /api/users?phone=` |
| Privilege escalation | ✅ **بسته.** `createAdmin`/`updateAdmin` از `PERMISSIONS` فیلتر می‌شوند؛ `super-admin` تنها نقشی است که `['*']` دارد و از پنل ساخته نمی‌شود مگر `role` صریح داده شود (`contentStore.js:3668-3700`). کاربر سایت هیچ مجوزی ندارد پس ارتقا معنا ندارد |
| Admin endpoint exposure | ✅ همهٔ ۲۱۲ مسیر پشت `UNAUTHENTICATED` هستند جز `login` (`PUBLIC_ADMIN_PATHS`) |
| حذف خود | ✅ گارد دارد — `deleteAdmin(id, actorId)` |

## 10.4 Application Security

| مورد | وضعیت | شواهد |
|---|---|---|
| CSRF | ✅ **دو لایه** | `SameSite=Strict` + هدر سفارشی |
| CORS | ✅ هیچ هدر CORS ست نمی‌شود ⇒ درخواست بین‌دامنه از مرورگر رد می‌شود | `adminApi.js:338-345` |
| Open Redirect | ⚠️ `googleAuth.redirect(response, location)` — `location` از `requestOrigin()` ساخته می‌شود که `PUBLIC_SITE_URL` یا هدر `x-forwarded-host`/`host` را می‌خواند. اگر `PUBLIC_SITE_URL` تنظیم نباشد و پروکسی هدر Host را پاک نکند، هدر قابل جعل است | `googleAuth.js:106-118` |
| SSRF | ⚠️ `publishingStore`/`mediaStore` به آدرس‌های پلتفرم fetch می‌کنند. اگر آدرس پایه از پنل قابل تنظیم باشد، SSRF داخلی ممکن است — **بررسی کامل نشد** | `database/publishers/*`, `BALE_API_BASE` |
| Path Traversal | ✅ **دو گارد مستقل.** `isInside()` در `server.js:69-72` و `uploadsFile.js:51-54`؛ مسیر حل‌شده باید داخل `dist/` یا `uploads/` بماند | `server.js:160-161`, `uploadsFile.js:57-61` |
| File Upload | ✅ پسوند مقدم بر MIME اعلامی مرورگر + allow-list + سقف حجم از settings | `adminApi.js:2660-2684`, `contentStore.js:1777+` |
| File Upload — نقص‌ها | ⚠️ بدون بازپردازش تصویر، بدون آنتی‌ویروس، بدون تحلیل محتوا. SVG در allow-list تصویر هست (`data:image/svg+xml;base64` در `SAFE_URL`) | `sanitizeHtml.js:37` |
| Race Condition | 🔴 **بله** — read-modify-write روی JSON بدون قفل | `contentStore.js:275-278` |
| Business logic vuln | 🔴 **بله** — ثبت‌نام مجدد = تصاحب حساب | `usersStore.js:74-107` |

## 10.5 Secret Management

| بررسی | نتیجه |
|---|---|
| API Keys / Tokens / Passwords / Secret Keys در Source Code | ✅ **`NOT FOUND`.** `contentStore.js:385` صریحاً می‌گوید «هرگز رمز واقعی در سورس هارد‌کد نمی‌شود؛ مقدار اولیه از env می‌آید» |
| مقدار پیش‌فرض نام کاربری/رمز مدیر | ⚠️ `0135`/`0135` به‌عنوان **fallback** در `contentStore.js:386-387` و در `.env.example`. با `mustChangePassword: true` علامت‌گذاری می‌شود (`:398`) — `PARTIALLY IMPLEMENTED` (اجبار واقعی تغییر رمز در سرور اعمال نمی‌شود) |
| در Environment Variables | ✅ همهٔ رمزها/توکن‌ها از `process.env` یا فایل‌های `0600` |
| در Git History | ⚠️ **`database/users.json` در تاریخچهٔ Git هست** (۵ کامیت: `7ea5ff8`, `fe35903`, `709623e`, `4f8676b`, `64606d3`) — شامل شمارهٔ موبایل و هش رمز. الان gitignore است و از ایندکس خارج، اما در تاریخچه باقی است |
| در Client Bundle | ✅ `NOT FOUND`. `.env.example` صریح می‌گوید «متغیرها فقط در سرور خوانده می‌شوند و هرگز به مرورگر فرستاده نمی‌شوند». هیچ `VITE_*` تعریف نشده |
| `database/publishing.secrets.json` | ✅ خارج از Git، مجوز `0600`، ۲۴۵ بایت |
| `claude/settings.local.json` | ⚠️ شامل `ANTHROPIC_AUTH_TOKEN: "freecc"` — یک توکن گیت‌وی محلی، نه secret واقعی. فایل untracked است | 
| رمز واقعی لو رفته؟ | ✅ **`NOT FOUND`** — طبق Rule 8، هیچ مقدار واقعی در این گزارش چاپ نشده |

## 10.6 Dependency Security

`UNVERIFIED` — هیچ‌گاه `npm audit`/`npm ls` اجرا نشد. `OBSERVATION`: کل dependencyهای runtime شش عدد است و `node_modules` ۶۵ مگابایت است — سطح حملهٔ زنجیرهٔ تأمین کوچک. `fbx2gltf@0.9.7-p1` از ۲۰۱۹ به‌روزرسانی نشده (فقط devDependency).

## 10.7 Data Security

| مورد | وضعیت | شواهد |
|---|---|---|
| Password hashing (مدیر) | ✅ `scrypt` + Salt ۱۶ بایتی + `timingSafeEqual` | `contentStore.js:368-382` |
| Password hashing (کاربر) | 🔴 **`SHA-256` بدون Salt** — قابل شکستن با rainbow table برای رمزهای کوتاه | `usersStore.js:9-11` |
| Encryption at rest | ❌ `NOT FOUND` — همهٔ JSONها متن خام‌اند | — |
| Encryption in transit | ⚠️ سرور خودش TLS ندارد؛ به پروکسی بیرونی متکی است. `Secure` کوکی فقط با `NODE_ENV=production` یا `x-forwarded-proto` | `adminApi.js:435`, `usersApi.js:67` |
| Sensitive data exposure | 🔴 `GET /api/users?phone=` — نام، دانشگاه، ترم، motivations | `usersStore.js:60-65` |
| PII exposure | 🔴 همان + `users.json` در تاریخچهٔ Git | — |
| Logging sensitive data | ✅ **خوب.** `maskPhone()` و `maskEmail()` برای نمایش در تحلیل: `'•'.repeat(len-2) + value.slice(-2)` | `analyticsStore.js:391-400` |
| لاگ خطا | ✅ فقط `error.message` + `error.code` (هر دو `str(...,300)`/`str(...,40)` بریده می‌شوند)، بدون stack به بیرون | `analyticsStore.js:232`, `adminApi.js:355-358` |

## 10.8 جدول آسیب‌پذیری‌ها

> **🔄 وضعیت این جدول در ۱ اکتبر ۲۰۲۶ (بازنگری ۲):**
>
> | ردیف | وضعیت فعلی |
> |---|---|
> | تصاحب حساب با ثبت‌نام مجدد | ✅ **FIXED** — `createUser` ⇒ ۴۰۹ (`usersStore.js:180-208`) |
> | `SHA-256` بدون Salt | ✅ **FIXED** — `scrypt$salt$hash` + مهاجرت تدریجی (`usersStore.js:57-107`, `:237-275`) |
> | نشت کلید پاسخ بانک تست | ✅ **FIXED** — allowlist + tripwire (`contentStore.js:3294-3317`, `apiContract/dtos.js:224-234`) |
> | نشت پروفایل + enumeration | ✅ **FIXED** — مسیر حذف شد (`usersApi.js:351-356`) |
> | ورود بدون رمز در کلاینت | ✅ **FIXED** — fallback حذف شد (`userStorage.js:190-212`) |
> | بدون Rate Limit | ✅ **FIXED** — `userRateLimit.js`، دو سطل (`usersApi.js:207-215`) |
> | باندل ۴٫۴MB | ✅ **FIXED** — ۱۹ chunk، entry ۱٫۵۶MB (`dist/` ۲۰۲۶-۱۰-۰۱) |
> | `dist/` کهنه | ✅ **FIXED** — بازساختهٔ ۲۰۲۶-۱۰-۰۱ ۱۳:۴۸ |
> | تاریخچهٔ Git با PII | ❌ **OPEN** — `.git` هنوز ۲۱۹MB |
> | بدون Error Boundary | ❌ **OPEN** |
> | بدون Sitemap/Robots/OG/JSON-LD | ❌ **OPEN** (تصمیم مستند در `docs/ops/seo-strategy.md`) |
> | نشست مدیر در حافظهٔ پروسه | ❌ **OPEN** (`contentStore.js:910`) — ابطال گروهی اضافه شد |
> | Race روی فایل‌های JSON | ✅ **FIXED** — `writeJsonAtomic` tmp→rename (`contentStore.js:411-424`) |
> | `uploads` بدون کنترل دسترسی | ❌ **OPEN** |
> | ۳۲ مورد `eslint-disable` | ⚪ **بازبینی نشد** |
> | بدون اعتبارسنجی شمارهٔ موبایل | ✅ **FIXED** — `database/authPolicy.js` |
> | پیش‌فرض `0135/0135` | ⚪ **بازبینی نشد** |
> | تغییر رمز کاربر متصل نیست | ⚪ **بازبینی نشد** |
> | هدرهای امنیتی ناقص (CSP/HSTS) | ✅ **FIXED در بازنگری ۳** — `database/securityHeaders.js` با **۱۵ دایرکتیو CSP** + `X-Content-Type-Options` · `X-Frame-Options` · `Referrer-Policy` · `COOP` · `CORP`؛ CSP **بدون `unsafe-inline`/`unsafe-eval`** در production (هش SHA-256 از خودِ `dist/index.html`) · HSTS فقط production+HTTPS. تست: **۹/۹** واحد + **۱/۱** یکپارچه روی سرور واقعی |
>
> **جدول زیر متن ۲۹ سپتامبر است** و برای تاریخچه نگه داشته شده.

| Vulnerability | Location | Severity | Why | Exploitability | Fix |
|---|---|---|---|---|---|
| تصاحب حساب با ثبت‌نام مجدد | `usersStore.js:74-107` + `usersApi.js:156-162` | 🔴 **CRITICAL** | `saveUser` با شمارهٔ موجود `passwordHash` را بازنویسی می‌کند و سشن صادر می‌شود | یک `POST` با شمارهٔ قربانی — بدون هیچ پیش‌نیاز | در `saveUser` اگر کاربر موجود بود و رمز فعلی دارد، ثبت‌نام را رد کن (۴۰۹) و مسیر «فراموشی رمز» جدا بساز |
| هش رمز کاربران با `SHA-256` بدون Salt | `usersStore.js:9-11` | 🔴 **HIGH** | بدون Salt ⇒ rainbow table؛ SHA سریع ⇒ brute force ارزان | پس از هر نشت دیتابیس (که خودش هم محتمل است) | به `scrypt` مهاجرت کن (همان تابع `contentStore.js:368`)؛ مهاجرت تدریجی: در ورود موفق، هش را دوباره با `scrypt` بنویس |
| نشت کلید پاسخ بانک تست | `contentStore.js:3025-3037` + `adminApi.js:2484` | 🔴 **HIGH** | `publicTestBankQuestion` فقط `examDay` را حذف می‌کند؛ `correctAnswer`, `explanation`, `stats` برمی‌گردند. endpoint بدون احراز هویت و بدون صفحه‌بندی | `curl /api/public/test-bank/questions` | کلید و توضیح را از پاسخ عمومی حذف کن و در endpoint جداگانهٔ «پس از پاسخ» یا با احراز هویت بده |
| نشت پروفایل کاربران + enumeration | `usersApi.js:150-154` | 🔴 **HIGH** | `GET /api/users?phone=X` هر پروفایلی را برمی‌گرداند | `curl '/api/users?phone=4138'` | این مسیر را حذف یا پشت نشست + تطبیق `phone` با کاربر جاری ببر |
| ورود بدون بررسی رمز در کلاینت | `userStorage.js:110-133` | 🔴 **HIGH** | اگر API جواب ندهد یا خطای غیر‑۴۰۱ بدهد، کاربر از `localStorage` خوانده و **بدون رمز** وارد می‌شود. در استقرار استاتیک، کل احراز هویت همین است | قطع/مسدودسازی `/api/users/login` | fallback را حذف کن؛ نبود API = نبود ورود |
| بدون Rate Limit روی ورود/ثبت‌نام کاربران | `usersApi.js:156-176` | 🟠 **HIGH** | brute force نامحدود روی رمزهای ۴ رقمی | حلقهٔ `fetch` | از `allowRate` الگوی `examApi.js:217` استفاده کن |
| باندل ۴٫۴ مگابایتی بدون code splitting برای سایت | `dist/assets/index-CE3tjnht.js` | 🟠 **HIGH** | ۴٬۴۱۰٬۷۲۱ بایت JS + ۷۷۲٬۱۱۳ بایت CSS در یک فایل؛ کاربر صفحهٔ اصلی همه را می‌گیرد | — | صفحهٔ عمومی و پنل/داشبورد را با `React.lazy` در سطح route جدا کن |
| `dist/` کهنه | `dist/index.html` تاریخ ۱۸ سپتامبر vs `src/**` تا ۲۹ سپتامبر | 🟠 **HIGH** | بیلد با سورس هم‌خوان نیست ⇒ هر استقراری نسخهٔ ۱۱ روز قبل را می‌دهد | — | پیش از استقرار همیشه `npm run build` (با تأیید صریح کاربر، چون `dist/` بازنویسی می‌شود) |
| تاریخچهٔ Git شامل PII و فایل ۴۷ مگابایتی | `.git` = ۲۱۹ MB · `.app.out.mjs` = ۴۷٬۴۸۲٬۹۲۳ B · `public/uploads/intl/*.mp4` = ۴۰٬۹۱۳٬۱۱۷ B | 🟠 **HIGH** | کلون کند، ریسک نشت PII | هر کسی با دسترسی به repo | `git filter-repo` برای حذف `users.json` و artifacts، سپس `git gc --aggressive` |
| بدون Error Boundary | کل `src/` (فقط در یک README ذکر شده) | 🟡 **MEDIUM** | یک شناسهٔ تعریف‌نشده کل درخت را سفید می‌کند (تلهٔ ۱۷ در `README.md:1155`) | یک باگ در هر کامپوننت | `ErrorBoundary` در `main.jsx` + یک در `DashboardLayout` و یک در `AdminLayout` |
| بدون Sitemap/Robots/Canonical/OG Image/JSON-LD | `public/` (فقط `anatomy` و `uploads`)، `index.html` | 🟡 **MEDIUM** | پلتفرم محتوایی با ۱۲+ مقاله و مسیرهای عمومی، هیچ راهنمای ایندکس ندارد | — | `sitemap.xml` تولیدشده از `publishedArticles()` + `robots.txt` + `og:image` + JSON-LD |
| نشست مدیر در حافظهٔ پروسه | `contentStore.js:716` | 🟡 **MEDIUM** | ری‌استارت = خروج همهٔ مدیران؛ استقرار چند‑نمونه‌ای غیرممکن | — | جدول `sessions` روی دیسک، مثل `userSessions.js` |
| Race Condition روی فایل‌های JSON | `contentStore.js:275-278` | 🟡 **MEDIUM** | read-modify-write بدون قفل | دو مدیر هم‌زمان یک مقاله را ذخیره کنند | الگوی اتمیک `userSessions.js:50-56` (tmp+rename) + صف نوشتن per-file |
| `uploads` بدون کنترل دسترسی | `uploadsFile.js:120-133` | 🟡 **MEDIUM** | ۵۵ مگابایت فایل با URL عمومی | هر کسی با URL | اگر محتوای حساس است، سرو را پشت چک Permission ببر |
| ۳۲ مورد `eslint-disable` عمدتاً `exhaustive-deps` | ۳۲ فایل در `src/` | 🟡 **MEDIUM** | ریسک stale closure | — | بازبینی موردی؛ افزودن وابستگی‌های گمشده یا `useRef` |
| بدون اعتبارسنجی قالب شمارهٔ موبایل | `usersStore.js:67-72` | 🟢 **LOW** | «4138» پذیرفته می‌شود | — | regex شمارهٔ ایران + حداقل طول رمز |
| مقدار پیش‌فرض `0135/0135` | `contentStore.js:386-387` | 🟢 **LOW** | اگر `TAPESH_ADMIN_PASSWORD` تنظیم نشود، رمز ضعیف شناخته‌شده فعال است. `mustChangePassword` فقط یک پرچم است و سرور آن را اعمال نمی‌کند | اولین استقرار بدون `.env` | اگر رمز از env نیامد، ورود را رد کن نه اینکه fallback بگذاری |
| TODO: تغییر رمز کاربر متصل نیست | `setting/Security.jsx:85` | 🟢 **LOW** | کاربر نمی‌تواند رمزش را عوض کند | — | مسیر `POST /api/users/password` با `changeOwnPassword` الگوی مدیر |
| هدرهای امنیتی ناقص | `server.js`, `adminApi.js` | 🟢 **LOW/INFO** | فقط `X-Content-Type-Options` و `Referrer-Policy` ست می‌شوند. بدون CSP، HSTS، `X-Frame-Options`، `Permissions-Policy` | — | CSP سخت‌گیرانه (کد فعلی با CSS/JS in-place سازگار است) |

---

# 11. Frontend Audit

| محور | وضعیت | شواهد |
|---|---|---|
| Component Architecture | ✅ **خوب.** ۳۰۲ فایل JSX با تفکیک `layout/<domain>/` + `layout/<domain>/sections/` | `src/layout/` |
| Reusability | ✅ `ThemeToggle` در ۶ سطح، `adminShared.jsx`، `analyticsShared.jsx`، `articlesShared.jsx`، `mediaKit.jsx`، `pricingShared.jsx` | `README.md:138` |
| State Management | ⚠️ **بدون کتابخانه.** `useState` محلی + hash + `localStorage`. در `InternationalCoursesLayer.jsx` ۲۱ `useState` و ۱۰ `useEffect` | `grep` شمارش |
| Props | ✅ بدون prop drilling عمیق مشاهده‌شده | — |
| Hooks | ⚠️ فقط یک هوک مشترک: `useEasterEggClick.js`. بقیهٔ هوک‌ها درون کامپوننت‌ها تکرار شده‌اند (`useAsyncData.js` در `league/`) | `src/hooks/` |
| Forms | ✅ **ورودی‌ها عمداً کنترل‌نشده‌اند** تا `FormData` سالم بماند (`README.md` معماری احراز هویت) | `layout/auth/AuthPage.jsx` |
| Validation | ⚠️ سطحی و پراکنده | `usersStore.js:70-72` |
| Error States | ⚠️ ناهمگون — `learning-state`، `gp-error`، `wiki-search-skeleton` الگوهای موازی | `learning.css`, `greenPath.css` |
| Loading States | ✅ **بله.** `dashboard-layer-skeleton` + `aria-busy="true"` + `AICardSkeleton` + `wiki-search-skeleton` | `DashboardLayout.jsx:413-415`, `OtherSections.jsx:147-149` |
| Empty States | ✅ **بله** — `learning-state`، `gp-error p`، پیام‌های «چیزی پیدا نشد» | `learning.css:…`, `greenPath.css:…` |
| Accessibility | ✅ **بالاتر از میانگین** — ۱٬۷۵۸ `aria-*` (۸۰۲ `aria-label`، ۵۶۳ `aria-hidden`، ۱۴۰ `aria-pressed`) | جزئیات در بخش ۱۵ |
| Responsive | ✅ **گسترده اما بی‌قاعده** — ~۱۸۰ media query در ۴۵ فایل با ۲۹ breakpoint متفاوت | بخش ۱۲ |
| Mobile UX | ⚠️ `dashboard.css` حالت «اپ‌مانند» زیر ۷۰۰px دارد؛ پنل مدیریت در `admin.css` حداقل عرض ۷۲۰px می‌خواهد | `dashboard.css:…`, `admin.css` |
| Desktop UX | ✅ طراحی‌شده برای دسکتاپ اول | — |
| Performance | 🔴 باندل ۴٫۴ MB · بدون code splitting در سایت · `wiki/mockData.js` ۳۹٬۸۹۰ خط در باندل | بخش ۱۳ |
| Bundle Size | 🔴 اندازه‌گیری‌شده: ۴٬۴۱۰٬۷۲۱ B JS + ۷۷۲٬۱۱۳ B CSS (فشرده‌نشده) | `dist/assets/` |
| Lazy Loading | ✅ برای ۱۴ لایهٔ داشبورد + `AICard` | `DashboardLayout.jsx:24-38`, `OtherSections.jsx:5` |
| Code Splitting | ⚠️ `manualChunks` برای react/three/admin تعریف شده (`vite.config.js:45-53`) اما در `dist/` فقط **یک** فایل JS اصلی وجود دارد — بیلد کهنه است یا config اعمال نشده | `dist/assets/` |

## 11.1 مشکلات Frontend

| مشکل | مکان | تعداد/اندازه | پیامد |
|---|---|---|---|
| Components بزرگ | `AdminMicro.jsx` · `AdminIntlCourses.jsx` · `AdminComprehensive.jsx` · `RichTextEditor.jsx` · `InternationalCoursesLayer.jsx` · `App.jsx` | ۱٬۷۵۰ / ۱٬۳۷۴ / ۱٬۲۱۷ / ۱٬۱۷۹ / ۱٬۱۲۴ / ۱٬۱۰۷ خط | نگهداری سخت، ریسک رگرسیون بالا |
| Components پیچیده | `InternationalCoursesLayer.jsx` | ۲۱ `useState` + ۱۰ `useEffect` | state machine دست‌ساز |
| Duplicate Components | ⚠️ الگوهای موازی: `TestBankLayer` vs `BankExplorer` vs `BankSession` · `AdminArticleLibrary` vs `AdminContentEditor` | — | دو مسیر برای یک کار |
| Duplicate CSS | ⚠️ `src/styles/pricing.css` (۴۷۷ خط) **و** `src/layout/pricing/pricing.css` (۱٬۸۲۴ خط) — دو فایل هم‌نام برای یک دامنه | ۲ فایل | سردرگمی منبع حقیقت |
| Duplicate Logic | 🔴 `readBody`×۳ · `sendJson`×۳ · `ok`/`fail`×۳ · `parseCookies`×۲+ · `safeEqual`×۲+ · منطق نمره‌دهی آزمون در سرور و کلاینت | — | رفع باگ سه‌جا |
| Unnecessary Re-render | `UNVERIFIED` — نیازمند پروفایل runtime | — | — |
| Memory Leak | ⚠️ چند listener بدون پاک‌سازی قابل‌بررسی؛ `easter-egg` listenerها در capture ثبت می‌شوند و گارد دارند | — | — |
| Poor state management | ⚠️ state کاربر در `localStorage` با ۳۵ کلید مختلف و بدون نسخه‌بندی | ۳۵ کلید | دادهٔ کهنه، ناسازگاری بین دستگاه |

---

# 12. UI/UX Audit

| محور | ارزیابی | شواهد |
|---|---|---|
| Information Architecture | ✅ منطقی: سایت عمومی → ورود → آنبوردینگ → داشبورد (۹ بخش، ۱۴ لایه) → پنل | `README.md:213-290` |
| Navigation | ✅ hash-based با Back/Forward سالم. **قاعدهٔ سخت:** تطبیق دقیق `hash === '#auth'` و مجموعه‌های صریح `PRICING_HASHES`/`PRODUCTS_HASHES`/`ABOUT_HASHES` (ضد باگ «لنگر اشتباه») | `router/appRoute.js:17-31`, `routeHashes.js:12-14` |
| User Flow | ✅ CTAهای فرود یک منطق واحد دارند: `startFromLanding` — مهمان → `openAuth(..., 'register')` با ذخیرهٔ hash معلق، واردشده → `openDashboard` | `README.md` بخش CTA |
| Discoverability | ⚠️ ۹ بخش داشبورد در یک صفحه؛ کشف لایه‌های عمیق (آناتومی ۳بعدی، شبکه دانش) وابسته به کارت‌هاست |
| Consistency | ✅ دیزاین سیستم توکنی (بخش ۱۰ README) + بررسی خودکار کنتراست. ⚠️ در کد، ۴۲۱ کلاس `bg-[#hex]`/`text-[#hex]` در `src/**` (نکتهٔ ثبت‌شده در حافظهٔ کاربر) — تم‌پذیر نیستند |
| Cognitive Load | ⚠️ بالا در پنل: مرکز رسانه ~۸۰ مسیر API و ۲۰ فایل سکشن برای یک مدیر |
| Feedback | ✅ **قوی.** `aria-live` (۳۰ مورد)، `aria-busy`، skeleton، دکمه‌های `aria-pressed` | `grep` |
| Error recovery | ⚠️ ناهمگون — برخی مسیرها retry دارند (`media/contents/:id/retry`)، برخی ندارند |
| Empty states | ✅ بله |
| Onboarding | ✅ `#onboarding` → `SecondaryRegistrationLayout` با motivations/referralSources | `contentStore` + `usersStore.js:83-92` |
| Search | ⚠️ جست‌وجوی فارسی نرمال‌شده ✅ (`normalizeSearch`) اما **هر جا جداگانه**: ادمین، ویکی، بانک تست، رسانه، یادداشت | بخش ۲۴ |
| Forms | ✅ کنترل‌نشده عمدی · ⚠️ بدون اعتبارسنجی هم‌سطح با سرور |
| Accessibility | ✅ بالاتر از میانگین | بخش ۱۵ |
| Mobile usability | ⚠️ پنل مدیریت روی موبایل عملاً کار نمی‌کند (`min-width: 720px` در `admin.css`) |

## 12.1 نقاط محتمل سردرگمی و اصطکاک

| مشکل | کجا | چرا | پیشنهاد |
|---|---|---|---|
| کاربر مهمان در CTA محصول | `productsService.js` → `href` | مقصد هر محصول یک لایهٔ داشبورد است؛ مهمان اول به `#auth` می‌رود و **حس می‌کند لینک اشتباه بوده** | پیش از هدایت، پیام «برای دیدن این بخش وارد شوید» |
| دو مسیر برای «آزمون» | `#dashboard?s=tests` و `#dashboard?l=test-bank` و `#dashboard?l=coordinated-exams` و `#dashboard?l=intl-exams` | چهار ورودی متفاوت به آزمون | یک مرکز آزمون واحد با تب |
| «مسیر سبز» به‌عنوان لایهٔ مستقل | `#dashboard?l=green-path` | تنها لایه‌ای که موتور مستقل دارد و از ناوبری عادی جدا می‌شود | — |
| مقالات: دو منبع | `articlesService` (CMS) + `mockData` (ایستا) | کاربر نمی‌داند کدام «واقعی» است؛ نسخهٔ پنل جای ایستا می‌نشیند | ✅ حل شده (`README.md:1340`) |
| صفحهٔ تنظیمات → تب «اشتراک» | `setting/` | `README.md:1345` صریح: «تب اشتراک به لایهٔ تعرفه وصل نشده» | وصل کن |
| «تغییر رمز» | `setting/Security.jsx:85` | دکمه وجود دارد ولی کاری نمی‌کند (TODO) | دکمه را پنهان کن تا پیاده شود، یا وصلش کن |

---

# 13. Responsive & Cross-Device

| محور | وضعیت | شواهد |
|---|---|---|
| Breakpoints | ⚠️ **۲۹ مقدار متفاوت:** ۴۲۰, ۴۳۰, ۴۶۰, ۴۸۰, ۵۲۰, ۵۶۰, ۶۲۰, ۶۳۹, ۶۴۰, ۷۰۰, ۷۰۱, ۷۲۰, ۷۶۰, ۷۶۸, ۸۰۰, ۸۲۰, ۸۶۰, ۸۸۰, ۹۰۰, ۹۵۰, ۹۶۰, ۹۸۰, ۱۰۰۰, ۱۰۲۴, ۱۰۵۰, ۱۰۸۰, ۱۱۰۰, ۱۱۸۰, ۱۲۴۰ | `grep` روی ۴۵ فایل CSS |
| تعداد media query | ~۱۸۰ در ۴۵ فایل (بیشترین: `admin.css` ۱۵ · `products.css` ۹ · `internationalCourses.css` ۸ · `myCourses.css` ۷ · `greenPath.css` ۷) | `grep` |
| Overflow | ⚠️ چند نقطه با `min-width` ثابت روی جدول/گرید که overflow افقی می‌سازد: `.gp-calendar__grid { min-width: 660px }`, `.micro-lesson__table-wrap table { min-width: 520px }`, `.admin.css` جدول `min-width: 720px` | `greenPath.css`, `learning.css`, `admin.css` |
| Touch Targets | ⚠️ ناهمگون — برخی `min-width: 17px`/`18px`/`14px` در `planning.css`, `reader.css`, `heartChart.css` (زیر استاندارد ۴۴px) | `grep` |
| Mobile Navigation | ✅ `dashboard.css` بلوک `max-width: 700px` + `min-width: 701px` (حالت اپ‌مانند) + بلوک میانی ۷۰۱–۱۰۲۴ | `dashboard.css` |
| Tables | ⚠️ overflow افقی در موبایل؛ بدون الگوی card-collapse | `admin.css`, `learning.css` |
| Modals | ✅ `role="dialog"` + `aria-modal="true"` + `Escape` handler (مثال: `SignupPromptModal` در `App.jsx:66-78`) | `App.jsx:52-78` |
| Forms | ✅ عمدتاً تک‌ستونه در موبایل | — |
| Charts | ✅ همه SVG دست‌ساز ⇒ مقیاس‌پذیر. ⚠️ `heartChart.css` و `knowledge.css` حداقل عرض ثابت دارند | — |
| Cards | ✅ grid با `minmax` در اکثر موارد | — |
| Sidebar | ✅ در موبایل جمع‌شو | `dashboard.css` |
| Typography | ✅ مقیاس `.66rem`–`.78rem` برای متن ثانویه؛ خوانا | — |
| آمادگی موبایل | ⚠️ **Partially Ready** — سایت عمومی خوب، داشبورد قابل‌قبول، **پنل مدیریت عملاً دسکتاپ‌محور** |
| آمادگی تبلت | ✅ بلوک `min-width: 701px and max-width: 1024px` برای داشبورد | `dashboard.css` |
| آمادگی صفحهٔ بزرگ | ⚠️ `hero.css` عمداً `max-width` را برداشته (مستند در کامنت)؛ اما بقیهٔ بخش‌ها سقف‌دارند | `hero.css` |

**RECOMMENDATION:** یک مقیاس مرکزی با ۴ breakpoint (۵۶۰ / ۷۲۰ / ۱۰۲۴ / ۱۲۸۰) در `src/styles/tokens.css` به‌عنوان custom property و مهاجرت تدریجی. `admin.css` جدا: حداقل عرض را از ۷۲۰px بردار و یک نمای کارتی موبایل بساز.

---

# 14. Performance Audit

## 14.1 اندازه‌گیری‌های واقعی (نه تخمین)

> ### 🔄 بازنگری ۳ (~۲۰:۴۵) — **بار اولیه واقعی ۳٫۲۶MB است، نه ۱٫۶MB**
>
> گزارش Remediation بخش ۸ می‌گوید «JS اولیه ۱۶۴۲KB» و `admin` (۱۰۲۴KB) را در جدول **«chunkهای تنبل»** می‌آورد. `dist/index.html` چیز دیگری می‌گوید:
>
> ```html
> <script type="module" crossorigin src="./assets/index-QO8RxNhD.js"></script>  ← 1,642,256 B
> <link rel="modulepreload" crossorigin href="./assets/admin-1WTCsLoF.js">     ← 1,024,223 B  ⚠️
> <link rel="modulepreload" crossorigin href="./assets/react-Dac_GvTY.js">     ←     3,654 B
> <link rel="stylesheet" crossorigin href="./assets/index-BOvJWmhE.css">       ←   745,030 B
> ```
>
> | جزء | بایت | تنبل؟ |
> |---|---|---|
> | `index-QO8RxNhD.js` (entry) | ۱٬۶۴۲٬۲۵۶ | — |
> | **`admin-1WTCsLoF.js`** | **۱٬۰۲۴٬۲۲۳** | ❌ **preload** |
> | `react-Dac_GvTY.js` | ۳٬۶۵۴ | ❌ preload |
> | `index-BOvJWmhE.css` | ۷۴۵٬۰۳۰ | — |
> | **جمع JS+CSS بار اولیه** | **۳٬۴۱۵٬۱۶۳ B = ۳٫۲۶ MB** | — |
> | + ۴ فونت preload | `Pinar-VF` · `Doran-Regular` · `Doran-Medium` · `Doran-Bold` | — |
>
> **ریشه (قطعی):** `src/App.jsx:12` ⇒ `import AdminLayout from './layout/admin/AdminLayout';` — **استاتیک**. `lazy(` در کل `App.jsx` **صفر بار** استفاده شده. `manualChunks` فایل را جدا می‌کند ولی import استاتیک ⇒ ویت `modulepreload` می‌گذارد.
>
> **✅ آنچه واقعاً تنبل است:** `mockData` (۱٫۸۱MB) و `three` (۵۶۲KB) — هیچ‌کدام در `index.html` ارجاع نشده‌اند. ادعای گزارش دربارهٔ این دو درست است؛ فقط دربارهٔ `admin` نادرست است.
>
> **رابطه با ممیزی پایه:** این همان یافتهٔ ردیف ۲۱ پایه («CSS پنل برای همه») است که **هنوز باز است** و حالا شامل ۱MB جاوااسکریپت هم می‌شود.

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶):** مقادیر زیر از `dist/` بازساختهٔ ۲۰۲۶-۱۰-۰۱ ۱۳:۴۸ اندازه‌گیری شد.

| اندازه | بازنگری ۲ | پایه (۲۹ سپتامبر) | منبع |
|---|---|---|---|
| JS کل | **۵٫۷۴ MB در ۱۹ chunk** | ۴٫۴۱ MB در ۱ فایل | `scripts/bundle-budget.mjs` |
| **entry اصلی** | **۱٫۵۶ MB** (`index-BVIlCwBi.js`) | ۴٫۴۱ MB | `dist/assets/` |
| بزرگ‌ترین chunk JS | **۱٫۸۱ MB** (`mockData-ohmKlZDb.js`) | ۸۰۹ B (`AICard`) | `dist/assets/` |
| chunkهای بعدی | admin ۱۰۰۰KB · three ۵۶۲KB · InternationalExams ۱۵۶KB · Anatomy ۱۲۵KB | — | `dist/assets/` |
| CSS کل | **۹۳۲ KB در ۱۰ chunk** | ۷۷۲ KB در ۱ فایل | `dist/assets/` |
| بزرگ‌ترین chunk CSS | **۷۲۸ KB** (`index-BOvJWmhE.css`) | ۷۷۲ KB | `dist/assets/` |
| `dist/` کل | **۲۰۰٫۸۹ MB** (۱۸۳ فایل) | ۴۱ MB | `du -sh dist` |
| glb | **۱۰۵٫۹۰ MB** | — | `perf:bundle` |
| mp4 | **۳۹٫۰۲ MB** | — | `perf:bundle` |
| تصاویر (png+webp+jpg) | **۴۸٫۱۰ MB** | — | `perf:bundle` |
| `public/` کل | **۱۶۲ MB** — `anatomy` ۱۰۶M + `uploads` ۵۵M | ۱۶۱ MB | `du -sh public/*` |
| `images/` کل | **۳۸ MB** — pictures ۱۹M · courses ۸٫۵M · avatars ۸٫۳M · icons ۱٫۴M | ۳۸ MB | `du -sh images/*` |
| بزرگ‌ترین دارایی واحد | `public/uploads/intl/mujqoxfn-….mp4` = **۳۹٫۹ MB** | `nervous.glb` = ۲۸٫۸ MB | `du` |
| `.git` | **۲۱۹ MB** (بدون تغییر) | ۲۱۹ MB | `du -sh .git` |
| پروژه (با `.git`) | **۷۹۳ MB** | ۵۴۲ MB | `du -sh .` |
| `node_modules` | **۱۴۸ MB** (نصب ناقص — `three` غایب) | ۶۵ MB | `du -sh node_modules` |
| بزرگ‌ترین فایل سورس | `src/services/wiki/mockData.js` = ۳۹٬۸۹۰ خط | همان | `wc -l` |
| CSS کل | ۵۰٬۰۰۸ خط در ۵۵ فایل (بدون تغییر) | همان | `wc -l` |
| سقف بودجه | **۸ سقف، ۰ نقض** (مصرف ۸۷٪–۹۳٪) | — | `perf:bundle` |

> **تحلیل تغییر:** مجموع JS از ۴٫۴۱MB به ۵٫۷۴MB **افزایش** یافت، ولی این افزایش هزینهٔ شکستن chunk است نه رشد کد — **بار اولیهٔ کاربر** از ۴٫۴۱MB به **۱٫۵۶MB** کاهش یافت (۶۵٪ کمتر). بزرگ‌ترین chunk باقی‌مانده `mockData` (۱٫۸۱MB) است که طبق ممیزی فاز ۲۰ **backend ندارد**؛ کاهشش کارکردی است نه آرایشی.

| اندازه | مقدار | منبع |
|---|---|---|
| JS باندل اصلی | **۴٬۴۱۰٬۷۲۱ بایت** (۴٫۴۱ MB) | `dist/assets/index-CE3tjnht.js` |
| CSS باندل | **۷۷۲٬۱۱۳ بایت** (۷۷۲ KB) | `dist/assets/index-DwwbeA9y.css` |
| JS chunk دوم | ۸۰۹ بایت | `dist/assets/AICard-B4ed_h11.js` |
| `dist/` کل | ۴۱ MB | `du -sh dist` |
| `public/` کل | **۱۶۱ MB** — `anatomy` ۱۰۶M + `uploads` ۵۵M | `du -sh public/*` |
| `images/` کل | ۳۸ MB — pictures ۱۹M · courses ۸٫۵M · avatars ۸٫۳M · icons ۱٫۴M | `du -sh images/*` |
| بزرگ‌ترین دارایی واحد | `public/anatomy/models/nervous.glb` = ۲۸٬۸۶۰٬۵۰۸ B | `git cat-file --batch-check` |
| `.git` | ۲۱۹ MB | `du -sh .git` |
| پروژه (با .git) | ۵۴۲ MB | `du -sh .` |
| `node_modules` | ۶۵ MB | `du -sh node_modules` |
| بزرگ‌ترین فایل سورس | `src/services/wiki/mockData.js` = ۳۹٬۸۹۰ خط | `wc -l` |
| CSS کل | ۵۰٬۰۰۸ خط در ۵۵ فایل | `wc -l` |

## 14.2 ۱۰ نقطهٔ پرهزینه

| # | Location | Why expensive | Evidence | Impact | Proposed optimization |
|---|---|---|---|---|---|
| ۱ | `dist/assets/index-CE3tjnht.js` | ۴٫۴۱ MB در یک فایل؛ کاربر صفحهٔ اصلی همه را می‌گیرد شامل پنل و مرکز رسانه | اندازه‌گیری | ~۱–۲ ثانیه دانلود روی ۴G | `React.lazy` برای `AdminLayout`/`AnalyticsCenter`/`MediaCenter`/`PlanningCenter` در `App.jsx` |
| ۲ | `src/services/wiki/mockData.js` | ۳۹٬۸۹۰ خط داده در باندل | `wc -l` | چند صد KB JS بی‌استفاده در صفحهٔ اصلی | به `/api/public/wiki` منتقل شود |
| ۳ | `src/layout/admin/admin.css` | ۴٬۴۶۲ خط، همیشه import می‌شود (`App.jsx:18`) | `App.jsx:18` | CSS پنل به همهٔ بازدیدکنندگان سایت تحویل داده می‌شود | CSS پنل را به chunk پنل منتقل کن |
| ۴ | `App.jsx:43-46` | ۴ CSS بزرگ (`dashboard.css` ۱٬۵۰۳ + `analytics.css` ۱٬۴۸۶ + `media.css` ۱٬۱۴۲ + `planning.css` ۳٬۱۹۸) در import سطح‌بالا | `App.jsx:43-46` | ~۷٬۳۰۰ خط CSS غیرلازم برای صفحهٔ اصلی | lazy CSS همراه با chunk مربوطه |
| ۵ | `contentStore.js:620-625` | هر درخواست پنل کل فایل JSON را `readFileSync` + `JSON.parse` می‌کند | کد | `events.json` (۱٫۳ MB) = ~۱۵ms پارس در هر فراخوانی | cache در حافظه با invalidation بر `mtime` |
| ۶ | `contentStore.js:3033-3037` | `publishedTestBankQuestions()` تمام بانک (۱۶۴ KB) را برمی‌گرداند، بدون صفحه‌بندی، روی هر درخواست عمومی | کد | پهنای باند + CPU | صفحه‌بندی + `ETag` بر پایهٔ `testBankRevision()` (که **وجود دارد** ولی استفاده نمی‌شود) |
| ۷ | `public/anatomy/` | ۱۰۶ MB مدل GLB؛ `nervous.glb` تنها ۲۸٫۸ MB | اندازه‌گیری | تجربهٔ اول آناتومی ۳بعدی کند | Draco/meshopt + `Cache-Control` (هست) + نمایش پیش‌رونده |
| ۸ | `DashboardLayout.jsx:24-38` | ۱۴ لایه lazy، اما **همهٔ CSS مربوطه در `App.jsx` eager import می‌شود** | `App.jsx:43-46` | code splitting JS مؤثر است ولی CSS نه | CSS هر لایه را کنار همان لایه import کن |
| ۹ | `src/layout/dashboard/ai/ai.css` + `knowledge.css` + `reader.css` | فایل‌های ۱٫۶KB–۲٫۳KB خط CSS با سلکتورهای سنگین | `wc -l` | CSS parse + style recalc | حذف سلکتورهای مرده، ادغام |
| ۱۰ | `analyticsStore.js:184-196` | هر رویداد beacon یک `writeCollection('events')` می‌زند که کل ۱٫۳ MB را می‌نویسد | کد | I/O سنگین در ترافیک بالا | نوشتن append-only (NDJSON) + compaction دوره‌ای |

## 14.3 سایر موارد

| مورد | وضعیت | شواهد |
|---|---|---|
| Large Images | ⚠️ ۵۸ فایل `.webp` در `dist/assets` با اندازهٔ ۲۰۰–۲۶۷ KB هر کدام؛ `images/pictures` ۱۹ MB | `du`/`ls` |
| Unoptimized Assets | ⚠️ یک PNG ۸۸۰ KB در `dist/assets/01-DeSCVJkW.png` در کنار نسخهٔ webp | `ls` |
| Blocking requests | ⚠️ `readFileSync`/`statSync` در مسیر درخواست (`contentStore.js:265-278`, `server.js:76`) — رویداد loop را بلاک می‌کند | کد |
| Sequential API requests | ⚠️ `referencesApi`/`wikiService` الگوی fallback سری دارند | `referencesApi.js` |
| Repeated API requests | ✅ **حل شده** — `testBankRevision()` (mtime+size) به‌عنوان تغییرسنج؛ «تلمتری لحظه‌ای هر ۱۰ ثانیه» از سنجه‌ها **کنار گذاشته شده** (`NOT_MEASURED_PREFIXES`) | `contentStore.js:3039-3043`, `adminApi.js:2518` |
| Missing caching | ⚠️ بدون ETag روی `/api/public/*` (با وجود `testBankRevision`) | `adminApi.js:338-345` |
| Large payloads | ⚠️ سقف بدنه ۱۲ MB (`MAX_BODY_BYTES`) برای پنل؛ آپلود ویدیو از این مسیر **بیرون** است ✅ | `adminApi.js:330`, `:2647` |
| Memory issues | ⚠️ `mediaStore`/`contentStore` بدون cache؛ `sessions` Map بدون سقف تعداد | `contentStore.js:716` |
| Core Web Vitals (LCP/INP/CLS) | **`UNVERIFIED`** — هیچ اندازه‌گیری واقعی (Lighthouse/PSI) انجام نشد. `OBSERVATION`های مرتبط: preload ۴ فونت با `crossorigin` (`index.html:39-66`)، اسکریپت ضد FOUC inline پیش از رنگ‌آمیزی (`:67-86`)، `Cache-Control: immutable` یک‌ساله برای image/font (`server.js:82-86`) — اینها همه به نفع CLS/LCP هستند | — |

---

# 15. SEO Audit

| مورد | وضعیت | شواهد |
|---|---|---|
| Title | ✅ `<title>تپش \| یادگیری پزشکی ساده‌تر</title>` | `index.html:19` |
| Description | ✅ ثابت | `index.html:7-10` |
| Title داینامیک | ⚠️ **فقط در مقالات** — `document.title` در `articlesShared.jsx:35, 85`. صفحات دیگر (`#pricing`, `#products`, `#about`, `#dashboard`) عنوان را عوض نمی‌کنند | `grep` |
| Description داینامیک | ❌ `NOT FOUND` — هیچ‌جا `meta[name="description"]` به‌روزرسانی نمی‌شود | `grep` |
| Canonical | ❌ `NOT FOUND` | `grep` |
| Open Graph | ⚠️ `og:type`, `og:site_name`, `og:title`, `og:description`, `og:locale` هستند. **`og:image` نیست** | `index.html:11-18` |
| Twitter Cards | ❌ `NOT FOUND` | `grep` |
| Sitemap | ❌ `NOT FOUND` — `public/` فقط `anatomy` و `uploads` دارد | `ls public` |
| Robots | ❌ `NOT FOUND` — هیچ `robots.txt` | `ls public` |
| Structured Data (JSON-LD) | ❌ `NOT FOUND` | `grep` |
| Semantic HTML | ✅ `lang="fa" dir="rtl"` + استفادهٔ گسترده از `aria-*`؛ هدر/فوتر/`article` وجود دارد | `index.html:2` |
| Heading hierarchy | `UNVERIFIED` — بازرسی h1/h2/h3 در ۳۰۲ فایل انجام نشد |
| Internal linking | ✅ قوی — CTAها از ثابت‌های مشترک ساخته می‌شوند، نه رشتهٔ دستی | `router/routeHashes.js:19-30` |
| URL structure | ⚠️ **همه روی hash** (`#articles/slug`, `#pricing`) — از دید موتور جست‌وجو یک URL واحد است. **این بزرگ‌ترین محدودیت SEO پروژه است** | `router/appRoute.js` |
| SSR / SSG | ❌ `NOT FOUND` — SPA خالص | `index.html:90` |
| Indexability | ⚠️ محتوا در JS است؛ خزندهٔ بدون اجرای JS فقط صفحهٔ خالی می‌بیند. `robots` پیش‌فرض در `DEFAULT_SETTINGS.seo.robots = 'index,follow'` هست ولی به HTML تزریق نمی‌شود | `contentStore.js:343` |

**RECOMMENDATION:** حداقل `sitemap.xml` (تولیدشده از `publishedArticles()` + `publishedPages()`) + `robots.txt` + `og:image` + JSON-LD نوع `Article`/`Course`. برای SEO جدی، مسیرهای بدون hash یا پیش‌رندر لازم است — این یک تصمیم معماری است، نه رفع باگ.

---

# 16. Accessibility Audit

| مورد | وضعیت | شواهد |
|---|---|---|
| Semantic HTML | ✅ هدر/فوتر/`article`/`nav` + `role="dialog"` | `App.jsx:66-78` |
| Keyboard navigation | ✅ `Escape` در مودال‌ها، `aria-modal`، `tabIndex` در جاهای لازم | `grep` |
| Focus state | ⚠️ **ناهمگون** — `:focus-visible` در `pricing.css` (۶ سلکتور)، `easterEgg.css` (۳)، اما در `admin.css`/`dashboard.css`/`wiki.css` پیدا نشد | `grep` |
| Screen reader support | ✅ **بالاتر از میانگین:** ۱٬۷۵۸ `aria-*` شامل ۸۰۲ `aria-label`، ۵۶۳ `aria-hidden`، ۵۱ `aria-labelledby`، ۳۰ `aria-live`، ۲۶ `aria-modal` | `grep` شمارش |
| ARIA صحیح | ✅ استفادهٔ معنادار (`aria-pressed` روی toggle، `aria-current` روی ناوبری، `aria-valuenow/min/max` روی اسلایدرها) | `grep` |
| Color contrast | ✅ **ماشینی بررسی می‌شود** — `npm run theme:contrast` هر ۲۱ جفت متن/سطح را در دو تم می‌سنجد (`scripts/theme-contrast.mjs`) | `package.json:13`, `README.md:64` |
| Form labels | ⚠️ `aria-label` زیاد است؛ `UNVERIFIED` که هر `<input>` برچسب مرتبط دارد |
| Error messaging | ✅ پیام‌های فارسی صریح + `aria-live` | `grep` |
| Alt text | ⚠️ **۷۱ `alt=` در برابر ۷۵ تگ `<img>`** ⇒ احتمالاً چند تصویر بدون alt. اما بخشی از تصاویر با CSS/`aria-hidden` رندر می‌شوند | `grep` شمارش |
| Modal accessibility | ✅ `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + Escape + scrim به‌عنوان `<button aria-label="بستن">` | `App.jsx:66-78` |
| Reduced motion | ✅ **گارد در چند لایه** — `prefers-reduced-motion: reduce` در `pricing.css:1773`, `media.css:1134`, `easterEgg.css:485`، `motion.css`، و منطق JS در `pricingShared.jsx:32, 67` | `grep` |

**نکتهٔ محیطی مهم (از حافظهٔ کاربر):** روی مکِ حیدریان «کاهش حرکت» macOS روشن است ⇒ کروم `prefers-reduced-motion: reduce` گزارش می‌کند ⇒ سایت **بی‌حرکت** دیده می‌شود. این باگ کد نیست.

**RECOMMENDATION:** یک بلوک `:focus-visible` سراسری در `src/styles/base.css` برای همهٔ `button`, `a`, `[tabindex]` اضافه کن؛ و alt تصاویر باقی‌مانده را کامل کن.

---

# 17. Testing Audit

## 17.1 آنچه وجود دارد

> ### 🔄 بازنگری ۳ (~۲۰:۴۵) — ۲۱ فایل تست و دروازهٔ ۳۶ گامی
>
> | سنجه | بازنگری ۲ | **بازنگری ۳** |
> |---|---|---|
> | `database/*.test.mjs` | ۱۶ | **۲۱** |
> | گام‌های دروازه | ۲۶ | **۳۶** |
> | وضعیت دروازه | ۲۶/۲۶ سبز | ⚠️ **۳۵/۳۶ — `repo:hygiene` قرمز (exit 1)** |
>
> **۵ سوییت تازه (۳۴ سنجه) — همه را خودم اجرا کردم:**
>
> | سوییت | سنجه | نتیجه |
> |---|---|---|
> | `database/securityHeaders.test.mjs` | ۹ | ✅ **۹/۹ · exit 0** |
> | `database/securityHeaders.integration.test.mjs` (سرور واقعی) | ۱ | ✅ **۱/۱ · exit 0** |
> | `database/adminCredentialPolicy.test.mjs` | ۹ | ✅ **۹/۹ · exit 0** |
> | `database/concurrency.test.mjs` | ۸ | ✅ **۸/۸ · exit 0** |
> | `database/migrations/migration.test.mjs` | ۷ | ✅ **۷/۷ · exit 0** |
>
> **۱۰ گام تازهٔ دروازه:** `security:headers:test` · `security:credential:test` · `concurrency:test` · `migration:test` · `build:check` · `seo:generate` · `seo:check` · `route:contracts:fresh` · `data:migrate:dry` · `repo:hygiene`
>
> **⚠️ هشدار دربارهٔ «سبز بودن دروازه»:** چون `repo:hygiene` آخرین گام است و **الان شکست می‌خورد** (مثبت کاذب روی یک رشتهٔ fixture در `.workbuddy-ai/memory/2026-10-01.md:544`)، در وضعیت فعلی نمی‌توان گفت دروازه سبز است. دلیل کامل در بند ۰.۳.
>
> **Coverage:** ابزار همچنان نصب نیست (`c8`/`nyc`/`istanbul` = NONE) ⇒ **UNKNOWN**.
> **E2E مرورگری:** همچنان `BLOCKED` — هیچ ابزار نصب نیست.

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶):** از ۱۰ فایل پایه، تعداد به **۱۶ فایل `database/*.test.mjs` + ۵ فایل تست در `scripts/`** رسید و یک **دروازهٔ کیفیت ۲۶ گامی** ساخته شد که **۲۶/۲۶ سبز** است (`scripts/verify-all.mjs`، exit 0، ۴۲۶٫۷s، لاگ مرجع `.workbuddy-ai/phase-logs/verify-all-26.log`). جدول پایه در ادامه برای تاریخچه می‌آید.

**سوییت‌های فعلی و نتیجهٔ ثبت‌شده:**

| سوییت | نوع | سنجه | نتیجه |
|---|---|---|---|
| `database/usersAuth.test.mjs` | Auth کاربران سایت | **۷۸** | ✅ ۷۸/۷۸ — **اجرای تازه در همین بازنگری** |
| `database/testBankSecurity.test.mjs` | امنیت بانک تست | **۴۰** | ✅ ۴۰/۴۰ — **اجرای تازه** |
| `database/sanitizeHtmlXss.test.mjs` | XSS پاک‌ساز | **۱۴** | ✅ ۱۴/۱۴ — **اجرای تازه** |
| `database/dataIntegrity.test.mjs` | یکپارچگی داده | **۲۵۴** | ✅ ۲۵۴/۲۵۴ (۱۵ بخش) |
| `database/adminApi.test.mjs` | API پنل (دودی) | ۹۲ | ✅ ۹۲/۹۲ |
| `database/adminRbac.test.mjs` | RBAC | ۶۴ | ✅ ۶۴/۶۴ |
| `database/adminSecrets.test.mjs` | سرّها | ۶۰ | ✅ ۶۰/۶۰ |
| `database/apiContract.test.mjs` | قرارداد API | ۳۱ | ✅ ۳۱/۳۱ (شامل smoke روی سرور واقعی: spawn + fetch + kill) |
| `database/examApi.test.mjs` | API آزمون | ۲۷ | ✅ ۲۷/۲۷ |
| `database/observability.test.mjs` | مشاهده‌پذیری | ۱۷ | ✅ ۱۷/۱۷ |
| `database/contentStoreAtomicWrite.test.mjs` | نوشتن اتمیک | — | ✅ سبز |
| `database/contentStoreHotPath.test.mjs` | مسیر داغ | — | ✅ سبز |
| `database/storageCorruption.test.mjs` | خرابی JSON | — | ✅ سبز |
| `database/publisherUrlGuard.test.mjs` | SSRF انتشار | ۹ | ✅ سبز |
| `database/inputGate.test.mjs` | دروازهٔ ورودی | — | ✅ سبز |
| `database/googleAuth.test.mjs` | OAuth گوگل | ۳۴ | ⚪ در دروازه اجرا نمی‌شود |
| `scripts/domain-tests.mjs` | Unit دامنه | ۲۲ | ✅ ۲۲/۰ |
| `scripts/planning-service-test.mjs` | Unit برنامه‌ریزی | ۳۴ | ✅ ۳۴/۰ |
| `scripts/router-test.mjs` | روتر | ۱۲۸ | ✅ ۱۲۸/۰ |
| `scripts/backup-restore-test.mjs` | بکاپ/بازیابی | ۱۲ | ✅ ۱۲/۱۲ |
| `scripts/e2e-api-flows.mjs` | **E2E سطح API** | ۲۷ | ✅ ۲۷/۲۷ (گام آخر دروازه) |
| `scripts/server-smoke.mjs` | دودی سرور | ۱۷ | ✅ ۱۷/۱۷ |
| `scripts/theme-scripts.test.mjs` | اسکریپت‌های تم | — | ✅ سبز |
| `scripts/verify-render.mjs` | Render headless (React + esbuild) | — | ⚪ اجرا نشد |
| `scripts/theme-contrast.mjs` | کنتراست WCAG | ۲۱ جفت × ۲ تم | ⚪ اجرا نشد |

**اثبات حساسیت (mutation proof) — دو مورد مستند:**
1. **XSS:** بازگرداندن عمدی escape ⇒ `xss:test` از ۱۴/۱۴ به **۱۲/۱۴ · exit 1**؛ پیام: «`<` escape‌نشده در متن». پس از برگردان + `shasum -c` ⇒ سبز.
2. **E2E:** حذف `assertSameOrigin(request)` از هندلر `logout` ⇒ **۲۶/۲۷ · exit 1** روی همان سنجه. پس از بازگردانی **۲۷/۲۷ · exit 0**، فایل صفر تغییر خالص.
3. **بودجهٔ باندل:** کاهش عمدی سقف `js.total` ⇒ **exit 1**.

**Coverage:** ابزار اندازه‌گیری نصب نیست (`c8`/`nyc`/`istanbul` یافت نشد) ⇒ **Coverage عددی = UNKNOWN**.

**E2E مرورگری: همچنان BLOCKED** — `playwright`/`cypress`/`puppeteer`/`vitest`/`jest`/`jsdom` هیچ‌کدام نصب نیستند.

### جدول پایه (۲۹ سپتامبر — برای تاریخچه)

| فایل | نوع | سنجه | اجرا شد؟ | نتیجه |
|---|---|---|---|---|
| `scripts/domain-tests.mjs` | Unit (دامنه) — `node:test` | ۲۲ | ✅ **اجرا شد** | **۲۲ pass / ۰ fail** (۸۵۷ms) |
| `scripts/planning-service-test.mjs` | Unit (سرویس برنامه‌ریزی/مالی) | ۳۴ | ✅ **اجرا شد** | **۳۴ OK / ۰ ناموفق** |
| `database/adminApi.test.mjs` | API (دودی، ۴۹ KB) | ~۷۸ (طبق README) | ❌ اجرا نشد (ممکن است `content/*.json` را بازنویسی کند) | `UNVERIFIED` |
| `database/examApi.test.mjs` | API (آزمون) | `UNVERIFIED` (۱۷ KB) | ❌ | `UNVERIFIED` |
| `database/googleAuth.test.mjs` | Integration (OAuth، ۱۰ KB) | ۳۴ (طبق README) | ❌ | `UNVERIFIED` |
| `scripts/auth-render-check.mjs` | Render (AuthPage) | `UNVERIFIED` (۸ KB) | ❌ | `UNVERIFIED` |
| `scripts/verify-render.mjs` | **Render headless** — React + esbuild | ۱۴۸+ (طبق README؛ فایل ۸۶ KB) | ❌ | `UNVERIFIED` |
| `scripts/theme-verify.mjs` | Static (توکن تم) | — | ❌ | `UNVERIFIED` |
| `scripts/theme-contrast.mjs` | Static (کنتراست WCAG) | ۲۱ جفت × ۲ تم | ❌ | `UNVERIFIED` |
| `scripts/tailwind-probe.mjs` | Static (کلاس inline تم‌پذیر) | — | ❌ | `UNVERIFIED` |

**مجموع سنجه‌های تأییدشده در ممیزی پایه: ۵۶ سنجه (۲۲ + ۳۴)، همه سبز.**
**مجموع سنجه‌های شمارش‌شدهٔ صریح در دروازهٔ فعلی: ۵۹۳** (۷۸+۴۰+۱۴+۲۷+۳۴+۹۲+۶۴+۶۰+۱۲۸+۱۲+۱۷+۲۷)؛ با احتساب `data:test` (۲۵۴) و بقیهٔ سوییت‌ها، مجموع ثبت‌شده **۹۴۸ سنجه در ۱۸ سوییت** است.

## 17.2 تفکیک نوع

| نوع | وجود |
|---|---|
| Unit Test | ✅ `domain-tests.mjs` (۲۲)، `planning-service-test.mjs` (۳۴) |
| Integration Test | ✅ `googleAuth.test.mjs` (شبکهٔ گوگل mock شده) |
| E2E | ❌ `NOT FOUND` — هیچ Playwright/Cypress |
| API Test | ✅ `adminApi.test.mjs`, `examApi.test.mjs` (مستقیم روی handler، بدون سرور) |
| Security Test | ⚠️ **`PARTIALLY IMPLEMENTED`** — `docs/security/coordinated-exams-security-report.md:270` یک «طرح تست امنیتی» دارد و بخش «E/F. Tests Added / Passed» وجود دارد، اما تست امنیتی خودکار جداگانه‌ای در `scripts/` نیست |
| Visual Test | ⚠️ معادل: `verify-render.mjs` (۱۴۸ سنجهٔ رندر متنی، بدون اسکرین‌شات) + `theme-contrast.mjs` |
| UI تعاملی | ❌ `NOT FOUND` — README صریح: «تست تعاملی UI دستی» (`README.md:1317`) |

## 17.3 پوشش موضوعی

| موضوع | تست دارد؟ | شواهد |
|---|---|---|
| منطق دامنه (قلب، مسیر سبز، …) | ✅ ۲۲ سنجه | `domain-tests.mjs` |
| برنامه‌ریزی و مالی | ✅ ۳۴ سنجه | `planning-service-test.mjs` |
| API پنل (CRUD + مجوز) | ✅ `adminApi.test.mjs` | — |
| ورود با گوگل | ✅ ۳۴ سنجه | `googleAuth.test.mjs` |
| آزمون هماهنگ (شامل مسیرهای حمله) | ✅ `examApi.test.mjs` + طرح تست در سند امنیتی | — |
| **Authentication کاربران سایت (شماره/رمز)** | ❌ **`NOT FOUND`** | — |
| **Authorization / RBAC** | ⚠️ در `adminApi.test.mjs` احتمالاً، `UNVERIFIED` | — |
| **Payment** | ✅ **N/A** — پرداختی وجود ندارد | — |
| Admin panel UI | ❌ `NOT FOUND` | — |
| Edge Caseهای CMS (JSON خراب، فایل نبود) | ⚠️ `readJson` fallback دارد ولی تست ندارد | `contentStore.js:265-273` |
| Critical Pathها | ⚠️ ورود کاربر، ثبت‌نام، خرید/تعرفه **تست ندارند** | — |
| Test Coverage واقعی | **`UNVERIFIED`** — هیچ ابزار coverage (nyc/c8) نصب نیست و اجرا نشد | — |

**RECOMMENDATION:** حداقل تست برای `usersStore.saveUser`/`verifyUser` و `usersApi` بنویس — همان‌جا که تصاحب حساب و هش ضعیف کشف شد. تست‌های موجود این حفره را پوشش نمی‌دهند.

---

# 18. Error Handling

| لایه | وضعیت | شواهد |
|---|---|---|
| Frontend errors | ⚠️ **بدون Error Boundary.** اگر کامپوننتی throw کند، React کل درخت را unmount می‌کند و صفحه سفید می‌شود. `README.md:1155` این را به‌عنوان «تلهٔ ۱۷» ثبت کرده اما راه‌حلی پیاده نشده | `grep` روی `src` ⇒ هیچ `ErrorBoundary`/`componentDidCatch` |
| Backend errors | ✅ `try/catch` دور کل `handleApi` | `adminApi.js:2741-2744` |
| API errors | ✅ **قالب یکنواخت** `{success:false, error:{code, message, fields?}}` + نگاشت کد→HTTP (`STATUS_BY_CODE`, ۱۵ کد) | `adminApi.js:309-328, 351-368` |
| Database errors | ⚠️ `readJson` با `try/catch` ⇒ fallback به مقدار پیش‌فرض. **خطر:** فایل JSON خراب بی‌صدا به «خالی» تبدیل می‌شود و داده گم می‌شود | `contentStore.js:265-273` |
| Authentication errors | ✅ پیام یکسان برای کاربر ناموجود/رمز غلط (ضد enumeration) | `contentStore.js:736` |
| Network errors | ✅ کلاینت‌ها `try/catch` دارند. **🔴 اما** `userStorage.js:104` در خطای شبکه fallback **ناامن** می‌سازد | `userStorage.js:104-107, 127-132` |
| Validation errors | ✅ `fail('VALIDATION_ERROR', …, fields)` + نمایش فارسی | `adminApi.js:332-334` |
| نشت خطای داخلی به کاربر؟ | ✅ **نه.** `INTERNAL_ERROR` پیام عمومی می‌دهد و جزئیات فقط `console.error` سرور | `adminApi.js:355-366` |
| Logging مناسب؟ | ✅ سرور: `console.error('[tapesh-admin]', error)` + `[tapesh-exam]` + `[tapesh-server]`. ثبت ۵xx به‌عنوان رویداد پایدار | `adminApi.js:357`, `examApi.js`, `server.js:173`, `analyticsStore.js:231-242` |
| قابلیت Debug | ✅ **خوب.** `requestMetrics()` (p95/p99)، `serverErrors` (۲۰۰ آخر)، بخش «خطاها» در مرکز تحلیل، و `code`/`reason` جدا در خطاهای آزمون | `analyticsStore.js:219-360`, `examApi.js:57-77` |
| خطاهای بی‌صدا | ⚠️ چند `catch` بی‌بدنه: `vite.config.js:24`, `server.js:35`, `userSessions.js:43-45`, `contentStore.js:270`. در بیشترشان توجیه کامنت شده ✅، اما `contentStore.js:270` (JSON خراب ⇒ دادهٔ خالی) خطرناک است | کد |

---

# 19. Logging & Observability

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶) — لایهٔ مشاهده‌پذیری اضافه شد.**
>
> | مؤلفه | وضعیت فعلی | شاهد |
> |---|---|---|
> | **لاگ درخواست** | ✅ **IMPLEMENTED** — یک خط JSON به‌ازای هر پاسخ، روی رویداد `finish`. پیش‌فرض روشن (`TAPESH_ACCESS_LOG`) | `database/observability.js` · `accessLogLine` |
> | **Correlation ID** | ✅ `X-Request-Id` روی **هر** پاسخ (۲۷/۲۷ در E2E) | `newRequestId` |
> | **Liveness** | ✅ `/healthz` — هیچ‌چیز را نمی‌سنجد، همیشه ۲۰۰ | `server.js` |
> | **Readiness** | ✅ `/readyz` — سه سنجه: `data-writable` · `build-artifact` · `model-registry`؛ نبود ⇒ **۵۰۳** | `checkReadiness` |
> | **Metrics** | ✅ `/metrics` — فقط با `TAPESH_METRICS_TOKEN`؛ مقایسهٔ **ثابت‌زمان**؛ بدون توکن یا توکن غلط ⇒ **۴۰۴ نه ۴۰۳** (تا وجود مسیر لو نرود) | `isMetricsAuthorized` |
> | **محرمانگی لاگ** | ✅ query/hash **هرگز** لاگ نمی‌شوند؛ IP/UA/Cookie/هدر/بدنه لاگ نمی‌شوند. شمارهٔ تلفن (≥۸ رقم)، ایمیل و توکن بلند (≥۳۲ نویسه) در مسیر حذف می‌شوند؛ سقف طول مسیر ۲۰۰ نویسه | `safePathname` |
> | **حذف پیش از ذخیره** | ✅ پاک‌سازی **پیش از** ورود به متریک انجام می‌شود ⇒ `JSON.stringify(snapshot())` هم شمارهٔ خام ندارد (سنجهٔ ۱۱) | `observability.test.mjs` |
> | **سقف حافظه** | ✅ `maxPaths=200` · `maxRecentErrors=50` ⇒ مسیرهای یکتا/خطاها بی‌مرز رشد نمی‌کنند (سنجهٔ ۱۰) | `createMetrics` |
> | **تست** | ✅ `obs:test` **۱۷/۱۷** | اجرا شد |
>
> **دو باگ واقعی که تست‌ها گرفتند:** (۱) استثنای `decodeURIComponent('/%ZZ')` **بیرون از `try`** بود ⇒ در نود ۲۲ به unhandled rejection و **مرگ پروسه** تبدیل می‌شد؛ اصلاح شد و سنجهٔ ۱۶ با درخواست خام روی سوکت قفلش می‌کند. (۲) انتظار کاذب تست دربارهٔ SPA fallback (مسیر بدون پسوند ۲۰۰ می‌دهد نه ۴۰۴) — هر دو رفتار قفل شد.
>
> **آنچه تغییر نکرد:** error tracking بیرونی (Sentry/Rollbar) هنوز `NOT FOUND`؛ متریک‌ها **درون-حافظه**‌اند و با ری‌استارت پاک می‌شوند؛ لاگ **پایدار/چرخشی** روی دیسک نیست.
>
> **جدول زیر متن ۲۹ سپتامبر است** و برای تاریخچه نگه داشته شده.

| مؤلفه | وضعیت | شواهد |
|---|---|---|
| Logging | ⚠️ **فقط دو چیز:** (۱) `logActivity` برای عملیات تغییردهندهٔ پنل، در `content/activity.json` با سقف ۵۰۰ رکورد (`ACTIVITY_LIMIT`) · (۲) `console.error` برای خطای سرور. **هیچ لاگر ساخت‌یافته‌ای (JSON/surface/level) وجود ندارد** | `contentStore.js:825-857` |
| Error tracking | ❌ `NOT FOUND` — بدون Sentry/Rollbar. فقط `serverErrors[]` در حافظهٔ پروسه (۲۰۰ رکورد، با ری‌استارت پاک می‌شود) | `analyticsStore.js:217` |
| Analytics | ✅ **`IMPLEMENTED` و خودساخته:** beacon مرورگر → `/api/public/analytics/collect` → `events.json` (سقف ۱۸۰ روز + `EVENTS_LIMIT`) → `analyticsEngine.js` (۱۳۰۵ خط) + `analyticsInsights.js` (۳۴ KB). ۱۶ بخش با ۷ Permission جدا | `analyticsStore.js:184-196`, `adminApi.js:483-500` |
| Monitoring | ⚠️ `systemMetrics()` از `node:os`/`node:fs`/`statfsSync` + `requestMetrics()`. سرویس بیرونی (UptimeRobot) فقط متغیر محیطی مستند است، **بدون کد مصرف‌کننده** | `analyticsStore.js:699+`, `.env.example` |
| Performance monitoring | ⚠️ `requestLog` (۳۰۰۰ آخر) با محاسبهٔ latency percentile. **در حافظه ⇒ با ری‌استارت پاک** | `analyticsStore.js:213, 247-333` |
| Audit logs | ✅ **دو نوع:** (۱) `activity.json` برای پنل، (۲) `examStore.verifyAuditChain()` — **زنجیرهٔ audit هش‌شده** برای آزمون‌های هماهنگ | `contentStore.js:827+`, `examApi.js:44` |
| Admin logs | ✅ بخش «گزارش رویدادها» با فیلتر `action` و `search` | `adminApi.js:1325-1341` |
| چه چیزهایی Log می‌شوند؟ | عملیات CMS (create/update/delete/publish)، آپلود، ورود/خروج، خطاهای ۵xx، رویدادهای beacon | `logActivity` فراخوانی‌ها |
| چه چیزهایی **نباید** Log شوند؟ | ✅ **رمزها هرگز لاگ نمی‌شوند.** `maskPhone`/`maskEmail` برای نمایش. IP و User-Agent **ذخیره می‌شوند** (۳۰۰/۶۰ کاراکتر بریده) — `INFORMATIONAL`: این PII است و در `users.sessions.json`/`activity.json` می‌ماند | `analyticsStore.js:391-400` |
| اطلاعات حساس در لاگ؟ | ⚠️ در `feedbackStore` هویت کاربر ضمیمه می‌شود (نام/شماره) — برای پشتیبانی لازم است، اما PII است | `adminApi.js:289-304` |
| Debugging در Production | ⚠️ **متوسط.** سنجهٔ درخواست و خطاهای ۵xx در حافظه‌اند ⇒ با ری‌استارت از دست می‌روند. رویدادهای ۵xx به `events.json` می‌روند ✅. بخش «خطاها» در مرکز تحلیل وجود دارد ✅. اما بدون لاگ پایدار درخشان و بدون error tracking | — |

---

# 20. Admin Panel Audit

| مورد | وضعیت | شواهد |
|---|---|---|
| Authentication | ✅ کوکی + CSRF + `scrypt` + قفل تلاش | `adminApi.js:2708-2721` |
| Authorization | ✅ **۲۱۲ مسیر، همه با `permission`** (به‌جز مسیرهای ورود) · ۷۴ Permission · ۳ نقش · `SENSITIVE_ANALYTICS` جدا | `contentStore.js:76-171`, `adminApi.js:2698-2725` |
| User management | ✅ `/api/admin/users` CRUD + `changeOwnPassword` + `mustChangePassword` | `adminApi.js:1205-1243` |
| Content management | ✅ **بسیار گسترده:** مقالات، دسته‌ها، صفحات، مراجع، جامع، بین‌الملل، فلش‌کارت، بانک تست، میکرو، بنر، یادداشت، رسانه | ۲۱۲ مسیر |
| Analytics | ✅ ۱۶ بخش با Permission جدا | `adminApi.js:483-500` |
| Reports | ✅ `buildReport`, `analytics/export` (با `analytics.export`), `media/report` | `adminApi.js:2405, 1608` |
| Configuration | ✅ `settings` (سایت، سئو، ادغام‌ها، سقف آپلود، `security.sessionHours/maxLoginAttempts/lockMinutes`) | `contentStore.js:330-356` |
| Logs | ✅ `logs` + `media/audit` + `activityActions()` | `adminApi.js:1325, 2333` |
| Security | ✅ تفکیک مجوز عمدی و مستند: «کسی که محتوا می‌نویسد با کسی که تأیید می‌کند و کسی که توکن اپ‌ها را می‌بیند یکی نیست» | `contentStore.js:105-117` |
| Bulk operations | ⚠️ `PARTIALLY IMPLEMENTED` — `POST /media/queue/run` (اجرای صف انتشار) و `POST /media/accounts/sync` (همگام‌سازی همه). **حذف/ویرایش گروهی وجود ندارد** | `adminApi.js:1814, 1699` |
| Export | ✅ `analytics/export` (JSON/CSV از `mediaKit`) + `media/report` | `adminApi.js:2405` |
| Search | ✅ تقریباً همهٔ لیست‌ها `search` دارند با نرمال‌سازی فارسی (ی/ك عربی، نیم‌فاصله، اعداد فارسی) | `contentStore.js:657-666` |
| Filtering | ✅ `status`/`subject`/`track`/`kind`/`role`/`type`/`providerId`/`action` | امضای توابع store |
| Pagination | ✅ `paginate` با سقف `perPage = 100` | `contentStore.js:668-676` |

## 20.1 آیا Admin می‌تواند کاری کند که Backend نباید اجازه دهد؟

| سناریو | نتیجه |
|---|---|
| دیدن دادهٔ مالی/امنیتی با نقش `admin` | ✅ **بسته** — `SENSITIVE_ANALYTICS` از `ROLES.admin.permissions` فیلتر شده (`contentStore.js:145-147`) |
| ساختن `super-admin` | ⚠️ **ممکن** — `POST /api/admin/users` با `role: 'super-admin'`. فقط `users.create` لازم است که نقش `admin` **دارد**. یعنی یک مدیر معمولی می‌تواند مدیر کل بسازد ⇒ **ارتقای سطح دسترسی** |
| حذف خودش | ✅ گارد دارد (`deleteAdmin(id, actorId)`) |
| حذف کاربر سایت | ⚠️ `users.delete` فقط برای `super-admin` است ✅. اما **حذف کاربران سایت (نه مدیران)** هیچ مسیر API ندارد — `/api/admin/users` روی `admins.json` کار می‌کند، نه `users.json`. یعنی `GET /api/admin/users` برای «مدیریت کاربران سایت» (طبق `README.md` بخش برنامه‌ریزی) **اشتباه فهمیده می‌شود**: `planningService` کاربران را از `/api/admin/users` می‌خواند که **مدیران** را برمی‌گرداند — `adminApi.js:1205`, `contentStore.js:3654-3666` |
| خواندن توکن ربات‌ها | ✅ بسته — `publishing.channels.manage` جدا از `publishing.read` |
| دیدن کلید API اکانت رسانه | ✅ بسته — `media.platforms.manage` |
| آپلود فایل دلخواه | ✅ پسوند allow-list + سقف حجم |
| صادرکردن کل داده | ⚠️ `analytics.export` دارد اما `analytics.read` نداشتن کافی است؟ — `analytics/export` Permission مستقل `analytics.export` می‌خواهد ✅ |

**RECOMMENDATION:** `createAdmin`/`updateAdmin` باید چک کنند که فقط `super-admin` می‌تواند نقش `super-admin` بدهد — الان این محدودیت وجود ندارد.

---

# 21. Code Quality

| یافته | مکان | مشکل | پیامد | Fix |
|---|---|---|---|---|
| فایل ۲٬۷۶۱ خطی API | `database/adminApi.js` | ۲۱۲ مسیر + لایهٔ امنیتی در یک فایل | هر تغییر ریسک رگرسیون در همهٔ پنل | به `adminApi/routes/<domain>.js` تقسیم کن |
| store ۱۷۱ KB | `database/contentStore.js` (۳٬۸۹۰+ خط) | RBAC + نشست + CMS + بانک تست + فلش‌کارت + مرجع + رسانه در یک فایل | SRP نقض‌شده، تست سخت | جدا کن: `authStore`, `cmsStore`, `testBankStore`, … |
| store ۱۴۹ KB | `database/mediaStore.js` | ۱۲ مجموعه در یک فایل | همان | — |
| فایل ۸۶ KB هارنس | `scripts/verify-render.mjs` | تک‌فایل غول با `String.raw` (تلهٔ ۱۳) | هر backtick اضافی کل فایل را می‌شکند | به چند فایل |
| داده ۳۹٬۸۹۰ خطی در باندل | `src/services/wiki/mockData.js` | دادهٔ محتوا در سورس کلاینت | باندل بزرگ | منتقل به API |
| تکرار helper | `readBody` در `adminApi.js:380`, `usersApi.js:29`, `examApi.js` | سه نسخه با سقف‌های متفاوت (۱۲MB / ۱MB / ۲۵۶KB) | رفع باگ سه‌جا، ناهمگونی | یک ماژول `httpUtils.js` |
| تکرار helper | `sendJson`×۳ · `ok`×۳ · `fail`×۳ · `parseCookies`×۲+ · `safeEqual`×۲+ | همان | همان | همان |
| Magic numbers | `adminApi.js:330` (12MB) · `:2557` (64KB) · `examApi.js:82` (256KB) · `usersApi.js:38` (1e6) · `contentStore.js:825` (500) · `analyticsStore.js:213` (3000) | سقف‌ها پراکنده | تغییر نیازمند جست‌وجو در چند فایل | یک `limits.js` مرکزی |
| Magic strings | نام کوکی‌ها در چند فایل تکرار شده: `'tapesh_admin_session'` (`adminApi.js:306`)، `'tapesh_user_session'` (`userSessions.js:26`)، `'tapesh:theme'` (`index.html:76` + `themeService.js`) | دو منبع حقیقت | ناهمگونی بی‌صدا | ثابت مشترک |
| `eslint-disable` | ۳۲ فایل، عمدتاً `react-hooks/exhaustive-deps` | وابستگی گم‌شده | stale closure | بازبینی موردی |
| TODO | `TestsSection.jsx:18,26,34,42,72` (۵ مورد تصویر) · `setting/Security.jsx:85` (تغییر رمز) | کار نیمه‌تمام | قابلیت ناقص | تکمیل یا پنهان‌کردن UI |
| FIXME / HACK | ✅ `NOT FOUND` | — | — | — |
| کد کامنت‌شده | `NOT FOUND` در جست‌وجوی هدفمند | — | — | — |
| Dead code | ⚠️ `PARTIALLY IMPLEMENTED` — ۴ فونت بی‌ارجاع: `Doran-Thin`, `Doran-Light`, `Doran-ExtraBlack`, `Pinar-FD-VF` (حذف‌شده در working tree، ۳۷۰ KB). `src/layout/dashboard/courses/reference/` پوشهٔ خالی در سطح بالا (فقط `reader/` دارد) | — | — | تأیید حذف از کاربر |
| نام‌گذاری | ✅ **بسیار منسجم.** نام متغیرها انگلیسی، دامنه فارسی، پیشوند CSS per-domain (`ad-`, `pr-`, `mc-`, `gp-`, `rdr-`, `eg-`) | — | — | — |
| Nesting عمیق | ⚠️ `adminApi.js:2647-2695` (۴ سطح)، چند جا در `App.jsx` | — | خوانایی | استخراج تابع |
| Weak typing | ✅ **N/A** — پروژه TypeScript ندارد. `jsconfig.json` فقط برای IntelliSense است | — | — | — |
| ناهمگونی معماری | ⚠️ **دو الگوی موازی برای CMS:** (۱) `contentStore` با مجموعه‌های JSON، (۲) `mediaStore` با ۱۲ مجموعهٔ خودش و `ensureMediaStore()` جدا. `adminApi.js:2544` فقط برای مسیرهای `/media` آن را صدا می‌زند | — | دو الگوی متفاوت بارگذاری | یکسان‌سازی |

---

# 22. Types & Data Validation

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶):** TypeScript همچنان `NOT FOUND`، **ولی یک لایهٔ اعتبارسنجی/مدل داده اضافه شد:**
>
> | مورد | وضعیت فعلی |
> |---|---|
> | `database/models/validator.js` + `normalizers.js` | ✅ `normalize → validate → persist` با `fields.js` (۲۱ KB) و `enums.js` (۴۵ enum) |
> | `database/authPolicy.js` | ✅ خالص — `validatePhone` / `validatePassword` / `describePasswordPolicy`؛ **هم در سرور و هم در کلاینت** صدا زده می‌شود (`usersStore.js:29`, `userStorage.js:19`) |
> | گارد نشت خروجی (DTO) | ✅ `database/apiContract/dtos.js` — ۱۱ DTO + `guardPublicOutput` (allowlist، نه spread) |
> | `database/apiContract/input.js` | ⚠️ **پل ساخته شد ولی سیم‌کشی نشد** — `assertInputValid` فقط **۴ بار** و فقط در `adminApi.js` |
> | سقف بدنهٔ درخواست | ✅ ۱۲MB · ۱MB · ۲۵۶KB · ۶۴KB · ۸KB (اندازه‌گیری‌شده، `bodyLimitValues`) |
> | Type safety | ⚠️ **همچنان `UNVERIFIED`** — بدون TS، ایمنی نوع فقط زمان اجرا |
>
> **جدول زیر متن ۲۹ سپتامبر است** و برای تاریخچه نگه داشته شده.

| مورد | وضعیت | شواهد |
|---|---|---|
| TypeScript | ❌ **`NOT FOUND`** — پروژه JS خالص است. `jsconfig.json` فقط IntelliSense را فعال می‌کند | `package.json` (بدون `typescript`), `jsconfig.json` |
| Type safety | ⚠️ **`UNVERIFIED`** — بدون TS، ایمنی نوع در زمان اجرا. الگوهای خوبی هست: `Number(x) \|\| default`, `String(x).slice(0,n)`, `Array.isArray()` | `adminApi.js:388`, `usersStore.js:13-18` |
| Any usage | ✅ **N/A** |
| Unsafe casts | ✅ **N/A** (بدون cast) |
| Missing interfaces | ⚠️ **بله** — شکل هیچ entity تعریف نشده. قرارداد رکوردها فقط در کامنت‌های `COLLECTIONS` (`contentStore.js:191-247`) و در `README.md` | — |
| Duplicate types | ✅ **N/A** |
| Frontend/Backend type mismatch | ⚠️ **ریسک واقعی.** مثال: `publicTestBankQuestion` (`contentStore.js:3025`) کل رکورد را spread می‌کند و کلاینت شکل متفاوتی انتظار دارد؛ `publishedMicroCourses` (`:3000`) **صریحاً** فیلدها را لیست می‌کند (الگوی درست)، اما `publishedTestBankQuestions` **همه‌چیز** را می‌دهد (الگوی نادرست). دو الگوی متناقض در یک فایل |
| API contract mismatch | ⚠️ سرویس‌های کلاینت در سربرگ خود «قرارداد REST آینده» را مستند کرده‌اند (`README.md:193`) — یعنی قرارداد **نوشته شده** اما **اجرا نمی‌شود** |
| Client-side validation | ⚠️ سطحی |
| Server-side validation | ⚠️ سطحی — فقط نوع/حضور. بدون اسکیما |
| Database validation | ❌ **`NOT FOUND`** — JSON هیچ constraint ندارد |
| **آیا به Client برای امنیت اعتماد شده؟** | 🔴 **بله — در سه جا:** (۱) `userStorage.js:110-133` تصمیم ورود · (۲) `userStorage.js:73-108` ساخت رکورد کاربر · (۳) `adminApi.js:2581-2585` هویت گزارش بازخورد از بدنهٔ کلاینت (`body.user`) گرفته می‌شود اگر سشن نباشد |

**RECOMMENDATION (بدون افزودن وابستگی):** یک ماژول `database/validate.js` با توابع سادهٔ `expectString/expectNumber/expectEnum` بنویس و در هر handler استفاده کن. این هم‌زمان خطاهای ۴۰۰ معنادار می‌دهد و هم جلوی ذخیرهٔ رکورد بی‌شکل را می‌گیرد. JSDoc + `jsconfig.json` هم بدون مهاجرت به TS ایمنی نوع قابل‌قبولی می‌دهد.

---

# 23. Business Logic Audit

| منطق | کجا پیاده شده | تکرار؟ | قابل اعمال؟ | کاربر می‌تواند دور بزند؟ | ادمین می‌تواند override کند؟ | تست دارد؟ |
|---|---|---|---|---|---|---|
| **ثبت‌نام/ورود کاربر** | `usersStore.js:67-122` + `userStorage.js:73-133` | 🔴 **بله، دو نسخه (سرور + کلاینت)** | ❌ سرور اعتبارسنجی ندارد | 🔴 **بله** — fallback کلاینت + تصاحب حساب | — | ❌ |
| **مجوزهای ادمین (RBAC)** | `contentStore.js:76-187` | ❌ | ✅ سرور per-route | ✅ نه | ✅ بله (super-admin) | ⚠️ `UNVERIFIED` |
| **نمره‌دهی آزمون هماهنگ** | `examStore.js:393-426` (سرور) | ⚠️ منطق مشابه در کلاینت `testBankService` | ✅ **فقط سرور** — `negative` و `correctAnswer` در سرور | ✅ نه (تصحیح سرورمحور) | — | ✅ `examApi.test.mjs` |
| **زمان آزمون** | `examApi.js:273` `/server-time` | ❌ | ✅ زمان مرجع = سرور (نه ساعت کلاینت) | ✅ نه | — | ✅ |
| **سهمیهٔ شرکت در آزمون** | `examStore` → `attempt-limit-reached` | ❌ | ✅ سرور | ✅ نه | — | ✅ |
| **کلید پاسخ آزمون** | `examStore.js:230-240` `sanitizeQuestion` | ❌ | ✅ **سرور** — کلید هرگز به کلاینت نمی‌رود | ✅ نه | — | ✅ |
| **کلید پاسخ بانک تست** | `contentStore.js:3025-3037` | ❌ | ❌ **کلید در پاسخ عمومی است** | 🔴 **بله، کاملاً** | — | ❌ |
| **قلب / پاداش (hearts)** | `contentStore.js:3101-3105` `getUserHeartRewards` | ❌ | ✅ سرور | ⚠️ `recordTestBankAnswers` از بدنهٔ کلاینت `answers[]` می‌گیرد و پاداش می‌دهد — **قابل جعل** | — | ❌ |
| **پیشرفت دوره (Green Path)** | `src/services/greenPath/` (۱۵ فایل) | ❌ | ❌ فقط `localStorage` | 🔴 بله (پاک‌کردن localStorage) | — | ⚠️ ۲۲ سنجهٔ دامنه |
| **پیشرفت یادگیری جامع** | `src/services/learning/progressService.js` | ❌ | ❌ فقط `localStorage` | 🔴 بله | — | ❌ |
| **لیگ / رتبه‌بندی** | `src/services/league/` | ❌ | ❌ کلاینت | 🔴 بله | — | ❌ |
| **کد اشتراک گروهی و تخفیف** | `src/services/group/groupService.js` | ❌ | ❌ کلاینت | 🔴 بله | — | ❌ |
| **مبالغ تعرفه** | `src/services/pricing/pricingService.js` | ❌ | ❌ نمونه؛ `amountsConfirmed=false` | — | ✅ پرچم در کد | ✅ ۲۸ سنجه در `theme:check` |
| **منطق مالی برنامه‌ریزی** | `src/services/planning/planningService.js` (۱٬۶۱۴ خط) | ❌ | ❌ کلاینت | 🔴 بله | — | ✅ **۳۴ سنجه** |
| **گردش کار رسانه (draft→review→publish)** | `mediaStore.js` | ❌ | ✅ سرور | ✅ نه | ✅ `media.content.review` | ⚠️ `UNVERIFIED` |
| **محدودیت آپلود** | `contentStore.js:330-354` + `adminApi.js:2675-2684` | ⚠️ دو جا (settings + کد) | ✅ سرور | ✅ نه | ✅ از settings | ❌ |
| **انتشار در کانال** | `publishingStore.js` + آداپتورها | ❌ | ✅ سرور | ✅ نه | ✅ | ⚠️ `UNVERIFIED` |
| **دورهٔ گروه (چرخه)** | `src/services/group/groupService.js` | ❌ | ❌ کلاینت | 🔴 بله | — | ❌ |
| **پاداش قلب از آزمونک** | `usersApi.js:128-148` | ❌ | ⚠️ سرور، اما ورودی از کلاینت | 🔴 `answers[]` دلخواه ⇒ پاداش دلخواه | — | ❌ |

**خلاصه:** منطق محصول **دو نیمهٔ نابرابر** دارد. نیمهٔ آزمون/محتوا/مجوز کاملاً سرورمحور و قابل اعمال است. نیمهٔ پیشرفت/لیگ/گروه/برنامه‌ریزی کاملاً کلاینت‌محور است و **برای کاربر قابل جعل**. `INFERENCE`: این یک تصمیم آگاهانه برای MVP است (سرویس‌ها «قرارداد REST آینده» را مستند کرده‌اند)، نه یک باگ — اما تا وقتی بدنهٔ توابع به fetch تبدیل نشود، این داده‌ها «ادعای کاربر» هستند نه «واقعیت تأییدشده».

---

# 24. Content / Data Architecture

| محور | وضعیت | شواهد |
|---|---|---|
| Static Content | ✅ `src/data/micro/` (۱۹ فایل درسنامه)، `src/data/learning/anatomyCourse.js` | — |
| JSON | ✅ ۳۶ مجموعه در `database/content/` (۳٫۵ MB) | — |
| Database | ❌ `NOT FOUND` | — |
| CMS | ✅ **`IMPLEMENTED`** — پنل کامل با گردش کار انتشار (`draft`/`published`/`archived`)، نسخه‌بندی نرم، `createdBy`/`updatedBy` | `contentStore.js:858-1005` |
| Code-based content | ⚠️ `wiki/mockData.js` (۳۹٬۸۹۰ خط)، `testBank/mockData.js` (۲٬۲۰۸)، `articles/mockData.js`، `league/mockData.js`، `analytics/mockData.js`، `international/mockData.js`، `notes/mockData.js`، `flashcards/mockData.js`، `ai/mockResponses.js` — **۱۰ فایل mockData** | `find` |
| Scalable؟ | ⚠️ **تا یک حد.** هر مجموعه کل فایل است؛ افزودن رکورد = بازنویسی کل فایل. در ۱۰۰۰ مقاله (۶۲KB → چند MB) هر ذخیره گران می‌شود | `contentStore.js:275-278` |
| Searchable؟ | ⚠️ `O(n)` در حافظه با `normalizeSearch`. برای ۱۰k رکورد کند می‌شود. **بدون ایندکس** | `contentStore.js:657-676` |
| Versionable؟ | ⚠️ **نه در سطح محتوا.** فقط `updatedAt` و `updatedBy`. `examStore.verifyAuditChain()` برای آزمون هست اما برای مقاله نه | — |
| قابل ویرایش توسط Admin؟ | ✅ بله برای: مقالات، صفحات، دسته‌ها، مراجع، جامع، بین‌الملل، فلش‌کارت، بانک تست، میکرو، بنر، یادداشت، رسانه. **❌ نه برای:** ویکی، شبکه دانش، لیگ، مقالات ایستا (فقط ادغام) | — |
| Duplicate data؟ | 🔴 **بله، سه‌گانه:** (۱) `microCourses.json` (۸۵۰KB) ↔ `src/data/micro/*.js` · (۲) `testBankQuestions.json` (۱۶۴KB) ↔ `src/services/testBank/mockData.js` · (۳) `wiki/mockData.js` ↔ هیچ منبع سرور (یک‌طرفه) · (۴) `references.json` ↔ `src/services/references/mockData.js` | — |
| Coupling بین Content و UI؟ | ⚠️ **بله، در دو جهت:** (۱) `contentStore.js:61` از `src/data/learning/anatomyCourse.js` import می‌کند (سرور → سورس کلاینت) · (۲) `router/routeHashes.js:8` از `layout/dashboard/DashboardLayout` import می‌کند (روتر → UI) | `contentStore.js:61`, `routeHashes.js:8` |

**RECOMMENDATION:** یک منبع حقیقت انتخاب کن. برای هر دامنه‌ای که در دو جا داده دارد، `mockData` کلاینت را به fallback صریح تبدیل کن (مثل الگوی `articlesService` که «نسخهٔ پنل جای نسخهٔ ایستا می‌نشیند») و در `README` ثبت کن کدام منبع مقدم است.

---

# 25. Search

| مورد | وضعیت | شواهد |
|---|---|---|
| Search Source | ۷ نقطهٔ جست‌وجوی مستقل: پنل (`listArticles`/`listPages`/`listReferences`/`listTestBankQuestions`/`listMicroCourses`/`listNotes`/`listMedia`)، ویکی (`wikiService`)، بانک تست، رسانه (`mediaSearch`) | امضاها |
| Index | ❌ `NOT FOUND` — جست‌وجوی خطی در حافظه | — |
| Ranking | ❌ `NOT FOUND` — نتیجه = `includes()` بولی، بدون امتیاز | `contentStore.js:3051` |
| Filtering | ✅ `status`/`subject`/`track`/`kind`/`role`/`type`/`providerId`/`action`/`category` | — |
| Typo tolerance | ⚠️ **`NOT FOUND`** به‌معنای غلط‌یابی. **اما** نرمال‌سازی هوشمندانه هست: ی/ك عربی، نیم‌فاصله (`\u200c`)، اعداد فارسی/عربی — این ۸۰٪ خطاهای تایپ فارسی را می‌پوشاند | `contentStore.js:657-666` |
| Pagination | ✅ `paginate` (سقف ۱۰۰) در لیست‌های پنل. **❌ در `/api/public/test-bank/questions` نیست** | — |
| Performance | ⚠️ `O(n)` روی کل مجموعه در هر جست‌وجو. برای بانک تست ۱۶۴KB و میکرو ۸۵۰KB قابل‌قبول؛ برای مقیاس بزرگ نه | — |
| Security | ⚠️ `normalizeSearch` ورودی را به رشته تبدیل می‌کند و در `includes` می‌گذارد — **بدون تزریق ممکن** ✅. اما `mediaSearch(term)` از `ctx.query.get('term')` مستقیم می‌گیرد — بررسی نشد که sanitize می‌شود | `adminApi.js:1606` |
| Empty result | ✅ UI حالت خالی دارد | — |
| Search analytics | ⚠️ `trafficTracker.js` رویداد می‌فرستد؛ `INFERENCE`: احتمالاً جست‌وجوها ثبت می‌شوند اما بخش «کلمات کلیدی جست‌وجوشده» در مرکز تحلیل دیده نشد | — |

---

# 26. File / Media Management

| مورد | وضعیت | شواهد |
|---|---|---|
| مسیرهای آپلود | دو مسیر جدا: (۱) `POST /api/admin/media` — بدنهٔ JSON/base64 · (۲) `POST /api/admin/intl-courses/upload` — بدنهٔ **باینری خام** | `adminApi.js:1137, 2647` |
| File type validation | ✅ **دو لایه.** مسیر باینری: `uploadExtensionFor(originalName, headerType)` — **پسوند نام فایل مقدم بر MIME اعلامی مرورگر** با توجیه مستند («کروم روی مک `.vtt` را گاهی `text/plain` اعلام می‌کند») | `adminApi.js:2660-2673` |
| MIME validation | ✅ `INTL_UPLOAD_EXTENSION_MIME` نگاشت پسوند→MIME سرورساز. مسیر base64: `allowedMimeTypes` از settings (`CARD_IMAGE_MIME_EXTENSIONS` + `application/pdf`) | `adminApi.js:2681`, `contentStore.js:350` |
| File size limit | ✅ `settings.media.maxUploadMb` (پیش‌فرض ۴) و `maxVideoUploadMb` (`INTL_DEFAULT_MAX_VIDEO_MB`) + `MAX_BODY_BYTES` ۱۲MB | `contentStore.js:348-354`, `adminApi.js:330` |
| Filename sanitization | ✅ نام تصادفی ساخته می‌شود (`mujqoxfn-5655345c4baa.mp4` الگو: `random-prefix` + `uuid-slice`) — **نام اصلی کاربر هرگز روی دیسک نمی‌نشیند** | `public/uploads/` نمونه‌ها |
| Storage location | ✅ `public/uploads/` (تصویر/PDF) و `public/uploads/intl/` (ویدیو/زیرنویس). جدا نگه داشته شده با توجیه مستند | `contentStore.js:65-68` |
| Public/private access | ⚠️ **همه عمومی.** `serveUploadRequest` هیچ احراز هویتی ندارد | `uploadsFile.js:120-133` |
| Authorization | ✅ برای **آپلود**: `media.upload` / `intl.upload` جدا (با توجیه «بارگذاری ویدیو حجم و فضای دیسک می‌خورد و نباید لازمهٔ ویرایش متن باشد») · ❌ برای **خواندن** |
| Virus/malware scanning | ❌ **`NOT FOUND`** |
| Image processing | ❌ **`NOT FOUND`** — بدون resize، بدون تبدیل به webp، بدون تولید thumbnail. فایل همان‌طور که آپلود شد ذخیره می‌شود (نمونه: PNG ۳٬۰۸۷٬۹۹۲ بایت در `public/uploads/`) |
| Range requests | ✅ **`IMPLEMENTED` و مستند** — پشتیبانی `bytes=start-end` با پاسخ ۲۰۶/۴۱۶؛ سافاری بدون آن پخش را شروع نمی‌کند | `uploadsFile.js:80-111`, `server.js:95-119` |
| Path traversal | ✅ **دو گارد:** `isInside()` در `uploadsFile.js:51-54` و `server.js:69-72` | — |
| 404 صریح | ✅ «اگر HTML برگردانیم، پخش‌کنندهٔ ویدیو خطای بی‌معنا می‌دهد و علت واقعی پنهان می‌ماند» | `uploadsFile.js:114-119` |

**RECOMMENDATION:** برای تصاویر آپلودی، بازپردازش سمت سرور (تغییر اندازه + تبدیل به webp) اضافه کن. الان `public/uploads/` ۵۵ مگابایت با چند PNG چند‑مگابایتی دارد که مستقیماً به کاربر تحویل می‌شود.

---

# 27. Scalability

> همهٔ اعداد این بخش `ESTIMATE` هستند — هیچ benchmark واقعی اجرا نشد.

## سطح ۱۰٬۰۰۰ کاربر

| جزء | چه چیزی زودتر bottleneck می‌شود | چرا |
|---|---|---|
| Database | `events.json` (۱٫۳ MB و در حال رشد) | هر beacon یک بازنویسی کامل فایل |
| API | `readFileSync` بلاک‌کنندهٔ event loop | ~۱۰–۲۰ms به ازای هر درخواست پنل |
| Frontend | باندل ۴٫۴ MB | ~۲–۴ ثانیه بارگذاری اول روی ۴G |
| Storage | `public/uploads/` بدون CDN | ۵۵ MB × ترافیک = پهنای باند سرور |
| معماری فعلی | ⚠️ **احتمالاً تاب می‌آورد** اگر همهٔ کاربران فقط سایت عمومی را ببینند (فایل‌های استاتیک cache می‌شوند) |

## سطح ۱۰۰٬۰۰۰ کاربر

| جزء | bottleneck |
|---|---|
| API | 🔴 **قطعی.** `writeFileSync` روی JSONهای چند‑مگابایتی، در ترافیک هم‌زمان = race condition و از دست رفتن داده |
| Database | 🔴 بازنویسی کل مجموعه در هر ذخیره غیرقابل‌تحمل |
| نشست‌ها | 🔴 `sessions` Map در حافظهٔ یک پروسه ⇒ استقرار چند‑نمونه‌ای غیرممکن. `users.sessions.json` هم یک فایل مشترک است |
| Storage | 🔴 نیاز به CDN و object storage |
| Frontend | 🟠 باندل + ۱۰۶ MB مدل ۳بعدی |
| معماری فعلی | 🔴 **قابل scale نیست** بدون تغییر لایهٔ persistence |

## سطح ۱٬۰۰۰٬۰۰۰ کاربر

| جزء | وضعیت |
|---|---|
| Database | 🔴 **الزاماً دیتابیس واقعی** (Postgres/MySQL) با ایندکس روی `phone`, `slug`, `status`, `createdAt` |
| API | 🔴 نیاز به stateless API + سشن در Redis/DB + چند نمونه پشت load balancer |
| Frontend | 🔴 نیاز به CDN + کد اسپلیت کامل + SSR/پیش‌رندر برای SEO |
| Storage | 🔴 object storage (S3-مانند) + بازپردازش تصویر + ویدیو استریم |
| Analytics | 🔴 `events.json` باید به event stream (Kafka/Kinesis) یا حداقل ClickHouse منتقل شود |
| معماری فعلی | 🔴 **قابل scale نیست.** بازنویسی لایهٔ داده لازم است |

**نکتهٔ مهم:** `README.md:5` خودش می‌گوید معماری برای این طراحی شده که «اتصال بک‌اند = تغییر بدنهٔ توابع، نه بازنویسی UI». اگر این وعده رعایت شود، مهاجرت به دیتابیس واقعی فقط `*Store.js` را عوض می‌کند. `INFERENCE`: این ادعا **واقع‌بینانه** است — سرویس‌های کلاینت و storeهای سرور لایهٔ جدا دارند و UI به JSON دست نمی‌زند.

**Single point of failure در مقیاس:** `contentStore.js` — تنها ماژولی که همهٔ دامنه‌ها به آن وابسته‌اند.

---

# 28. Deployment & DevOps

> ### 🔄 بازنگری ۳ (~۲۰:۴۵)
>
> | مورد | بازنگری ۲ | **بازنگری ۳** |
> |---|---|---|
> | `npm run build` | ⚠️ **BLOCKED** (`three` غایب) | ✅ **exit=0** · ~۱۶٫۹–۱۸٫۸s · `build:check` در دروازه |
> | بازتولیدپذیری | — | ✅ یکپارچگی وابستگی ۵۳۴ فایل سورس؛ هر import بیرونی declare + در lockfile. **یافتهٔ رفع‌شده:** `esbuild` در ۳ اسکریپت import می‌شد ولی declare نبود ⇒ به `devDependencies` رفت |
> | استقرار | `deploy.mjs` | همان (۲۱۵ خط) |
> | SEO در artifact | — | ❌ **`vite build` کل `dist/` را خالی می‌کند** (بدون `emptyOutDir`) و `seo:generate` بیرون از build است ⇒ artifact فعلی **بدون robots/sitemap** |
> | CI | workflow هست، اجرا نشده | ❌ **همچنان اجرا نشده** |
> | Staging · Docker | `NOT FOUND` | ❌ **همچنان `NOT FOUND`** |
>
> **هشدار عملیاتی:** `npm run build` **به‌تنهایی artifact ناقص** می‌دهد (بدون SEO). یا `seo:generate` را به `postbuild` ببند، یا پلاگین ویت بنویسد، یا `emptyOutDir: false` + پاک‌سازی هدفمند.

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶) — ۴ ردیف بسته شد.**
>
> | مورد | پایه | فعلی |
> |---|---|---|
> | Production / `dist/` | ⚠️ `dist/` کهنه (۱۸ سپتامبر) | ✅ **بازساختهٔ ۲۰۲۶-۱۰-۰۱ ۱۳:۴۸** — ۱۹ chunk JS + ۱۰ chunk CSS |
> | CI/CD | ❌ `NOT FOUND` | ⚠️ **`.github/workflows/ci.yml` (۳ job) نوشته شد — هرگز اجرا نشد** |
> | اسکریپت استقرار | ❌ | ✅ **`scripts/deploy.mjs`** (با rollback داخلی، کد ۸) |
> | بکاپ/بازیابی | ❌ | ✅ **`scripts/data-backup.mjs`** + **`data-restore.mjs`** (dry-run + `--apply`) · `backup:restore:test` **۱۲/۱۲** |
> | Health / Readiness / Metrics | ❌ | ✅ `/healthz` · `/readyz` (۵۰۳ در نبود) · `/metrics` (توکن‌دار، ۴۰۴ بی‌توکن) |
> | Rollback | ❌ | ⚠️ **PARTIAL** — کد rollback در `deploy.mjs` هست؛ drill دستی انجام نشد |
> | بودجهٔ باندل | ❌ | ✅ `scripts/bundle-budget.mjs` — ۸ سقف، ۰ نقض |
> | `npm run build` | ⚠️ ممنوع | ⚠️ **BLOCKED** — `Rollup failed to resolve import "three"` (`node_modules/three/package.json` غایب، نصب ناقص). `dist/` آسیب ندید |
> | Staging | ❌ `NOT FOUND` | ❌ **همچنان `NOT FOUND`** — Gate فاز ۲۱ |
> | Docker | ❌ `NOT FOUND` | ❌ **همچنان `NOT FOUND`** |
>
> **جدول زیر متن ۲۹ سپتامبر است** و برای تاریخچه نگه داشته شده.

| مورد | وضعیت | شواهد |
|---|---|---|
| Environment configuration | ✅ `.env.example` ۹٫۸ KB با توضیح کامل هر متغیر + `process.loadEnvFile` در دو میزبان | `vite.config.js:22-26`, `server.js:32-36` |
| Development | ✅ `npm run dev` → Vite + ۳ middleware پلاگین | `package.json:7`, `vite.config.js:40` |
| Staging | ❌ **`NOT FOUND`** | — |
| Production | ⚠️ `npm run start` → `server.js` (node:http خالص). **باید `npm run build` قبلش اجرا شود** ولی `dist/` کهنه است | `server.js:8`, `dist/` تاریخ ۱۸ سپتامبر |
| Build | ⚠️ `npm run build` — README صریح می‌گوید **ممنوع** چون `dist/` را پاک می‌کند (`README.md:23`, تلهٔ ۵ در `:998`) | — |
| CI/CD | ❌ **`NOT FOUND`** — هیچ `.github/workflows`، `.gitlab-ci.yml`، `Jenkinsfile` | `ls -a` |
| Docker | ❌ **`NOT FOUND`** | — |
| Reverse proxy | ⚠️ **مستند ولی غیرکدنویسی‌شده.** کد از `x-forwarded-proto`/`x-forwarded-host`/`x-forwarded-for` پشتیبانی می‌کند (پس پروکسی در نظر گرفته شده) اما هیچ config nginx/آپاچی در repo نیست | `adminApi.js:428-432`, `googleAuth.js:110-117` |
| CDN | ❌ **`NOT FOUND`** — دارایی‌ها از همان سرور سرو می‌شوند | — |
| SSL | ❌ **`NOT FOUND`** در کد. به پروکسی بیرونی متکی است (`Secure` کوکی فقط با `NODE_ENV=production` یا هدر پروکسی) | `adminApi.js:435` |
| Backup | ❌ **`NOT FOUND`** — هیچ اسکریپت/زمان‌بندی بکاپ. **🔴 خطر واقعی:** `database/content/*.json` تنها نسخهٔ محتواست و در Git هم ناقص است (فایل‌های gitignoreشده) | — |
| Migration | ⚠️ `PARTIALLY IMPLEMENTED` — مهاجرت‌های دستی در `ensureStore()`: `syncReferences()`, `syncIntlCatalog()`, `syncX()` «یک‌بار». بدون سیستم نسخه‌بندی migration | `contentStore.js:600-616` |
| Rollback | ❌ **`NOT FOUND`** — بدون CI/CD و بدون versioned deploy، rollback = بازگرداندن دستی فایل‌ها | — |
| Health check | ⚠️ `GET /api/admin/analytics/ping` وجود دارد اما پشت احراز هویت ادمین است ⇒ برای load balancer مناسب نیست | `adminApi.js:2377` |

**ارزیابی: Production deployment از استاندارد فاصله دارد.** آنچه هست: یک سرور Node تک‌فایلی که دارایی استاتیک + API را سرو می‌کند. آنچه نیست: CI/CD، Docker، بکاپ، rollback، health check عمومی، CDN، SSL درون‌کد.

**RECOMMENDATION (به ترتیب اولویت):** (۱) **بکاپ زمان‌بندی‌شدهٔ `database/content/` و `users.json`** — این تنها نسخهٔ محتواست و هیچ نسخهٔ پشتیبان خودکار ندارد. (۲) یک `GET /api/health` عمومی. (۳) اسکریپت استقرار که `build` + `start` را با هم و با تیک تأیید انجام دهد.

---

# 29. Environment & Configuration

| Variable | Used Where | Secret? | Required? | Client Exposed? |
|---|---|---|---|---|
| `TAPESH_ADMIN_USERNAME` | `contentStore.js:386` (seed) | ⚠️ نیمه | ❌ (fallback `0135`) | ❌ |
| `TAPESH_ADMIN_PASSWORD` | `contentStore.js:387` (seed) | ✅ **بله** | ⚠️ توصیه‌شده | ❌ |
| `TAPESH_ADMIN_NAME` / `TAPESH_ADMIN_EMAIL` | `contentStore.js:393-394` | ❌ | ❌ | ❌ |
| `TAPESH_INSECURE_COOKIE` | `adminApi.js:435` | ❌ | ❌ (فقط برای http محلی در production) | ❌ |
| `PORT` | `server.js:38` | ❌ | ❌ (پیش‌فرض ۴۱۷۳) | ❌ |
| `HOST` | `server.js:39` | ❌ | ❌ (پیش‌فرض `0.0.0.0`) | ❌ |
| `GOOGLE_CLIENT_ID` | `googleAuth.js:95` | ❌ (عمومی) | ✅ برای ورود گوگل | ⚠️ **بله، از طریق `/status`** (`redirectUri` و `configured`) |
| `GOOGLE_CLIENT_SECRET` | `googleAuth.js:96` | ✅ **بله** | ✅ | ❌ |
| `PUBLIC_SITE_URL` | `googleAuth.js:107`, `.env.example` | ❌ | ❌ | ❌ |
| `NODE_ENV` | `adminApi.js:435` | ❌ | ❌ | ❌ |
| `BALE_BOT_TOKEN` / `TELEGRAM_BOT_TOKEN` / `EITAA_BOT_TOKEN` | `publishers/*` | ✅ **بله** | ❌ (توکن per-channel در پنل اولویت دارد) | ❌ |
| `BALE_API_BASE` / `TELEGRAM_API_BASE` / `EITAA_API_BASE` | `publishers/*` | ❌ | ❌ | ❌ |
| `INSTAGRAM_ACCESS_TOKEN` / `_APP_ID` / `_APP_SECRET` | `publishers/instagram.js` | ✅ **بله** | ❌ | ❌ |
| `PUBLISH_TIMEOUT_MS` | `publishingStore.js` | ❌ | ❌ (۱۵۰۰۰) | ❌ |
| `PUBLISH_DRY_RUN` | `publishingStore.js` | ❌ | ❌ | ❌ |
| `GA_PROPERTY_ID` / `GA_CLIENT_EMAIL` / `GA_PRIVATE_KEY` | مرکز تحلیل | ✅ (`PRIVATE_KEY`) | ❌ | ❌ |
| `GSC_SITE_URL` | مرکز تحلیل | ❌ | ❌ | ❌ |
| `PAGESPEED_API_KEY` | مرکز تحلیل | ✅ | ❌ | ❌ |
| `PAYMENT_PROVIDER` / `PAYMENT_API_KEY` | **هیچ‌جا در کد خوانده نمی‌شود** | ✅ | ❌ | ❌ — `OBSERVATION`: فقط مستند شده، مصرف‌کننده ندارد |
| `LLM_API_KEY` / `LLM_MODEL` | مرکز تحلیل (روایت متنی) | ✅ | ❌ | ❌ |
| `MONITORING_API_URL` / `MONITORING_API_KEY` | مرکز تحلیل | ✅ | ❌ | ❌ — مصرف‌کننده تأیید نشد |
| `ALERT_WEBHOOK_URL` / `ALERT_TELEGRAM_TOKEN` / `ALERT_TELEGRAM_CHAT` | مرکز تحلیل | ✅ | ❌ | ❌ |

**آیا Secretی به Frontend می‌رود؟**
✅ **خیر — و این به‌درستی مستند شده است.** `.env.example` صریح می‌گوید: «متغیرها فقط در سرور خوانده می‌شوند و هرگز به مرورگر فرستاده نمی‌شوند.» هیچ `VITE_*` در پروژه تعریف نشده (جست‌وجو بی‌نتیجه). تنها استثنای بی‌خطر: `/api/auth/google/status` فیلد `redirectUri` را برمی‌گرداند که عمومی است (`googleAuth.js:9`).

**`.env` وجود ندارد** ⇒ در این workspace ورود با گوگل غیرفعال است و سرور «ورود با گوگل: غیرفعال» چاپ می‌کند (`server.js:190-194`).

---

# 30. Git & Version Control

> ### 🔄 بازنگری ۳ (~۲۰:۴۵) — **بحرانی‌ترین ریسک برطرف شد**
>
> | مورد | بازنگری ۲ (~۱۶:۳۰) | **بازنگری ۳** |
> |---|---|---|
> | کامیت | ۴۰ | **۵۰** (+۱۰) |
> | **Working tree** | 🔴 **۱۷۲ مسیر** | ✅ **۸ مسیر** |
> | HEAD | `a86d875` | **`e53c2b4`** |
> | `.git` | ۲۱۹ MB | **۲۱۷ MB** |
> | دادهٔ زمان‌اجرا tracked | ۵ | ✅ **۰** |
> | سرّ tracked | ۰ | ✅ **۰** |
> | `.workbuddy-ai/` tracked | — | ⚠️ **۱۸ فایل** |
>
> **۸ مسیر باقی‌مانده، همه دادهٔ کاربر است — هیچ کد نیست:** ۶ فایل `database/content/*.json` (`banners` · `comprehensiveCourses` · `mediaTags` · `microCourses` · `pages` · `references`) + ۲ PNG در `public/uploads/`. طبق قاعدهٔ پروژه، این‌ها **عمداً کامیت نشدند**.
>
> **آن ۱۷۲ فایل کجا رفت:** کامیت `dbe88d4 chore: checkpoint accumulated hardening work (working tree)` با **۲۱۲ فایل** آن‌ها را ثبت کرد؛ بقیه در ۹ کامیت دیگر توزیع شدند. هر کامیت یک دغدغهٔ جدا دارد (امنیت · داده · UI · SEO · build · gate · repo) ⇒ مسیر بازگشت مرحله‌ای ممکن است.
>
> **⚠️ یافتهٔ تازه:** `.workbuddy-ai/` (۱۸ فایل) **tracked است** — شامل `memory/*.md` (یادداشت خام نشست) و `screenshots/analytics-1400/*.png`. این باعث می‌شود `repo:hygiene` روی یادداشت‌های نشست اسکن سرّ بزند و **مثبت کاذب** بدهد (بند ۰.۳، مغایرت ۱). این پوشه **زائدات ابزار است، نه محتوای محصول** و نباید در مخزن باشد.
>
> **ممیزی تاریخچه (فقط‌خواندنی، `scripts/git-history-audit.mjs`):** `activity.json` ۱۹ نسخه / ۲٫۸۱MB (IP/UA) · `users.json` ۱۱ نسخه (PII) · `admins.json` ۱۷ نسخه (هش رمز) · بزرگ‌ترین blob `.app.out.mjs` = **۴۵٫۲۸MB**. **History rewrite اجرا نشد** — اسکریپت دستور پیشنهادی و aftercare را چاپ می‌کند.

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶) — بدتر شد.**
>
> | مورد | پایه (۲۹ سپتامبر) | فعلی (۱ اکتبر) |
> |---|---|---|
> | کامیت | ۴۰ | **۴۰ (بدون تغییر)** — HEAD هنوز `a86d875` «manageSOP» |
> | **Working tree** | ۳۵+ تغییر | 🔴 **۱۷۲ مسیر تغییر‌یافته/untracked** |
> | `.git` | ۲۱۹ MB | **۲۱۹ MB** (بدون تغییر) |
>
> **مهم‌ترین نکته:** تمام ۲۳ فاز سخت‌سازی — که شامل **رفع ۶ حفرهٔ امنیتی**، ۳۰ اسکریپت تازه، ۲۲ سند تازه، ۱۶ فایل تست و بازسازی `dist/` است — **روی working tree است و در هیچ کامیتی ثبت نشده.** یک `git checkout .` یا `git clean -fd` یا خرابی دیسک، همه را از بین می‌برد. این **بزرگ‌ترین ریسک فعال پروژه** است.
>
> فایل‌های تازهٔ untracked که در معرض خطرند: `database/models/` · `database/apiContract/` · `database/userRateLimit.js` · `database/observability.js` · `database/authPolicy.js` · `database/feedbackStore.js` · `database/publishers/urlGuard.js` · ۱۶ فایل `*.test.mjs` · ۱۸ اسکریپت تازه در `scripts/` · `docs/**` (۲۲ سند) · `src/router/` · `src/components/` · `src/hooks/` · `src/layout/auth/` · `src/layout/site/` · `src/styles/` · `.github/workflows/ci.yml`.
>
> **جدول زیر متن ۲۹ سپتامبر است** و برای تاریخچه نگه داشته شده.

| مورد | یافته | شواهد |
|---|---|---|
| تعداد کامیت | **۴۰** | `git log --oneline \| wc -l` |
| شاخه | `main` + `backup/pre-merge-20260927` + tag `pre-merge-20260927`. شاخهٔ دیگری وجود ندارد | `git branch -a` |
| تاریخچهٔ merge | ⚠️ **دو merge کامیت** (`6d5d3d9`, `752f2d1`) — نشانهٔ واگرایی شاخه | `git log` |
| پیام کامیت‌ها | ⚠️ **ضعیف.** نمونه: `manageSOP`, `finalEdits`, `miniEdit02`, `miniEdit`, `newEdit`, `setting deep`, `mini edits02`, `mini edites`, `Edit:content logs & memory notes` | `git log --oneline` |
| Working tree | 🔴 **۳۵+ تغییر uncommitted** شامل `database/adminApi.js`, `database/contentStore.js`, `database/examApi.js`, `src/App.jsx`, `src/styles.css`, `package.json`, `vite.config.js` و ۱۸ فایل جدید untracked (`src/router/`, `src/layout/auth/`, `src/layout/site/`, `src/hooks/`, `src/components/`, `src/services/feedback/`, `src/styles/`) | `git status --short` |
| **فایل بزرگ در تاریخچه** | 🔴 `.app.out.mjs` = **۴۷٬۴۸۲٬۹۲۳ بایت** (باقی‌ماندهٔ probe). `.gitignore` **الان** `*.out.mjs` را نادیده می‌گیرد اما فایل در تاریخچه هست | `git cat-file --batch-check` |
| فایل بزرگ در تاریخچه (۲) | 🔴 `public/uploads/intl/mujqoxfn-5655345c4baa.mp4` = ۴۰٬۹۱۳٬۱۱۷ بایت | همان |
| فایل بزرگ در تاریخچه (۳) | ⚠️ ۷ مدل GLB: nervous ۲۸٫۸M · cardio ۲۱٫۸M · skeletal ۲۱٫۵M · muscular ۱۹٫۳M · visceral ۹٫۴M · joints ۵٫۵M · regions ۲٫۸M = **۱۰۸٫۶ MB** | همان |
| فایل بزرگ در تاریخچه (۴) | ⚠️ `public/uploads/*.png` — سه فایل ۲٫۸–۳٫۱ MB | همان |
| اندازهٔ `.git` | **۲۱۹ MB** | `du -sh .git` |
| **Secret در تاریخچه** | 🔴 **`database/users.json` در ۵ کامیت هست** (شامل شمارهٔ موبایل + هش رمز). طبق Rule 8 هیچ مقداری چاپ نمی‌شود | `git log --all -- database/users.json` |
| `publishing.secrets.json` در تاریخچه؟ | ✅ **خیر** — `git log` بی‌نتیجه | — |
| `.env` در تاریخچه؟ | ✅ **خیر** | — |
| `.gitignore` | ✅ **خوب و مستند** — با کامنت توضیحی برای هر گروه، شامل `users.json`, `users.sessions.json`, `content/exams*.json`, `*.out.mjs`, `publishing.secrets.json`, `media.secrets.json` | `.gitignore` |
| فایل‌های تولیدشده در Git | ⚠️ `dist/` در `.gitignore` است ✅ اما `database/content/activity.json` (۱۸۸KB) و `database/content/events.json` (**۱٬۳۵۴ KB**) **tracked هستند** و با هر درخواست تغییر می‌کنند ⇒ churn مداوم در Git | `git ls-files database/content` |
| فایل موقت | ⚠️ `.freebuff/project-id` حذف‌شده در working tree | `git status` |
| فایل‌های نیمه‌کاره | ⚠️ طبق حافظهٔ کاربر: `GameEngine.js`/`GameEngine.jsx` — تنها `GameEngine.jsx` (۸۵۵ خط) در working tree دیده شد؛ `.js` وجود ندارد | `find` |
| کامیت‌های مشکوک | ✅ `NOT FOUND` — بدون force-push، بدون حذف انبوه غیرمستند. یک کامیت صریح snapshot دارد (`0aaee53 Checkpoint: pre-removal snapshot`) که **عملکرد خوبی** است | — |
| Merge conflicts | ✅ حل‌شده (working tree بدون conflict marker) | — |
| شاخهٔ رهاشده | ⚠️ `backup/pre-merge-20260927` باقی مانده | — |

**RECOMMENDATION:** (۱) `git filter-repo` برای حذف `users.json`، `*.out.mjs` و ویدیوی ۴۰ MB از تاریخچه، سپس `git gc --aggressive`. (۲) `database/content/activity.json` و `events.json` را به `.gitignore` اضافه کن (دادهٔ زمان‌اجرا هستند، نه سورس). (۳) تغییرات فعلی را کامیت کن — ۳۵ فایل تغییر uncommitted روی یک پروژهٔ ۲۴۳ هزار خطی ریسک از دست رفتن کار است.

---

# 31. Documentation

**بسیار قوی — یکی از بهترین نقاط پروژه.**

| سند | حجم | محتوا | وضعیت |
|---|---|---|---|
| `README.md` | **۱۲۵٬۵۶۶ بایت / ۱٬۳۴۶ خط** | سند مرجع کامل: شناسنامه، راه‌اندازی، نقشهٔ پوشه‌ها، معماری کلان، نقشهٔ کامل مسیرها، لایه‌های داشبورد، لایهٔ داده، بک‌اند، امنیت، دیزاین سیستم با توکن‌ها، قراردادهای کدنویسی، **۲۰ تلهٔ تأییدشده با علت و راه‌حل**، چک‌لیست افزودن/حذف بخش، وضعیت فازها | ✅ `IMPLEMENTED` — نوشته‌شده صریحاً «برای هوش مصنوعی» (`README.md:3`) |
| READMEهای زیرلایه | **۲۳ فایل** در `src/**/README.md` | هر دامنه قرارداد خودش را دارد: `admin`, `products`, `pricing`, `group`, `router`, `data/micro`, … | ✅ |
| `docs/security/coordinated-exams-security-report.md` | ۳۲٬۳۰۷ بایت | گزارش **قبل و بعد از پیاده‌سازی**: معماری، مرزهای اعتماد، فهرست دارایی، مدل تهدید، ۸ آسیب‌پذیری (V1–V8) با قالب استاندارد، معماری امنیتی پیشنهادی، طرح تست، «Remaining Risks» و «Known Limitations» | ✅ **الگوی نمونه برای بقیهٔ پروژه** |
| `.env.example` | ۹٬۷۶۶ بایت | هر متغیر با توضیح فارسی + مقدار پیش‌فرض + هشدار | ✅ |
| کامنت‌های سورس | ✅ **استثنایی.** هر ماژول سربرگ «چرا وجود دارد» دارد. نمونه: `server.js:1-9`, `uploadsFile.js:1-13`, `sanitizeHtml.js:1-12`, `userSessions.js:1-14`, `adminApi.js:1-18` — همیشه **علت** نوشته می‌شود، نه فقط **چه**. حتی توجیه تصمیم‌های ظاهراً عجیب (مثل اینکه چرا `SameSite=Lax` برای گوگل و `Strict` برای پنل) | ✅ |
| Setup instructions | ✅ `README.md:49-65` | ✅ |
| Architecture docs | ✅ `README.md:182-210` + دیاگرام متنی | ✅ |
| API docs | ⚠️ **`PARTIALLY IMPLEMENTED`** — هیچ OpenAPI/Swagger. مسیرها فقط در کد هستند (`ROUTES` آرایه). بخش «API — پنل مدیریت» در `README.md:525-547` خلاصه است | ⚠️ |
| Environment docs | ✅ `.env.example` + `README.md:77-93` | ✅ |
| Deployment docs | ⚠️ **`PARTIALLY IMPLEMENTED`** — فقط `npm run start` و توضیح دو میزبان (`README.md:515-524`). بدون راهنمای nginx، SSL، بکاپ، rollback | ⚠️ |
| Developer docs | ✅ READMEهای زیرلایه + «قراردادهای کدنویسی» (`README.md:950-968`) + «چک‌لیست افزودن بخش» (`:1245`) | ✅ |
| قاعدهٔ نگه‌داری سند | ✅ `README.md:7` — «هر بار بخشی اضافه/حذف/جابه‌جا شد، همان لحظه این فایل را به‌روز کن» | ✅ |

**تنها شکاف جدی:** مستندات API ماشین‌خوان وجود ندارد. با ۲۱۲ مسیر، تولید OpenAPI از آرایهٔ `ROUTES` (که همان ساختار `[method, path, permission, handler]` را دارد) کار سختی نیست.

---

# 32. Maintainability — دید یک Developer جدید

| پرسش | پاسخ | شواهد |
|---|---|---|
| چقدر سریع می‌تواند پروژه را بفهمد؟ | ✅ **سریع — ساعت‌ها، نه روزها.** `README.md` ۳۰ ثانیه‌ای («خلاصهٔ فوری») + شناسنامه + نقشهٔ مسیرها به‌تنهایی ۸۰٪ تصویر را می‌دهد | `README.md:12-25` |
| Entry pointها مشخص‌اند؟ | ✅ **بله.** `index.html` → `src/main.jsx` → `src/App.jsx` → `src/router/appRoute.js` برای مسیر، و `database/adminApi.js:2523` برای API. هر دو در README ثبت شده | `README.md:32-33` |
| Naming قابل فهم است؟ | ✅ **بله.** نام متغیرها انگلیسی، دامنه فارسی. پیشوند CSS per-domain (`ad-`, `pr-`, `mc-`, `gp-`, `rdr-`, `eg-`, `pl-`) نگاشت دامنه→کلاس را بدیهی می‌کند | — |
| Architecture قابل درک است؟ | ✅ **بله.** قانون واحد «UI به داده دست نمی‌زند» + سه لایه + دو نوع state (`README.md:184-209`) | — |
| Documentation کافی است؟ | ✅ بله، جز API docs | بخش ۳۱ |
| تغییر Featureها چقدر پرریسک است؟ | ⚠️ **ناهمگون:** افزودن یک بخش پنل ✅ کم‌ریسک (چک‌لیست + الگو). تغییر در `contentStore.js` یا `adminApi.js` 🔴 پرریسک (۱۷۱KB / ۱۱۱KB تک‌فایل، بدون تست پوششی کافی). تغییر در `App.jsx` ⚠️ متوسط (۱٬۱۰۷ خط، ترتیب اولویت مسیرها حیاتی). **🔴 پرریسک‌ترین:** هر تغییر در احراز هویت (بدون تست) | — |
| نقاط ورود برای کارهای رایج | ✅ README چک‌لیست دقیق دارد: «افزودن بخش تازه»، «افزودن صفحهٔ عمومی مستقل»، «حذف یک بخش» | `README.md:1245-1308` |
| تله‌های مستند | ✅ **۲۰ تلهٔ تأییدشده** با علت و راه‌حل. این ارزشمندترین دارایی پروژه برای Developer جدید است | `README.md:969-1221` |

---

# 33. Technical Debt

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶):** از ردیف‌های زیر، **۵ مورد بدهی امنیتی پرداخت شد**: هش `SHA-256` بدون Salt، تصاحب حساب، fallback ورود بدون رمز، نشت کلید پاسخ بانک تست، و نبود Rate Limit. **بدهی تازه‌ای که اضافه شد:** ۱۷۲ فایل کامیت‌نشده · `adminApi.js` ۲٬۸۴۷ خط · `contentStore.js` ۴٬۴۲۳ خط · سیم‌کشی‌نشده‌بودن گارد ورودی در ۱۱۸ مسیر · `.gitignore` بدون `git rm --cached`.
>
> **جدول زیر متن ۲۹ سپتامبر است** و برای تاریخچه نگه داشته شده.

| Debt | Location | Cause | Current Cost | Future Risk | Fix Effort |
|---|---|---|---|---|---|
| هش رمز کاربران با SHA-256 بدون Salt | `usersStore.js:9-11` | MVP | هر ورود یک SHA سریع | 🔴 نشت کامل رمزها با rainbow table | **S** |
| تصاحب حساب با ثبت‌نام مجدد | `usersStore.js:74-107` | عدم تفکیک register/update | — | 🔴 از دست رفتن حساب هر کاربر | **S** |
| fallback ورود بدون رمز در کلاینت | `userStorage.js:110-133` | پشتیبانی «build استاتیک بدون API» | — | 🔴 دور زدن کامل احراز هویت | **XS** |
| کلید پاسخ بانک تست در پاسخ عمومی | `contentStore.js:3025-3037` | spread بدون فیلتر | — | 🟠 بی‌اعتبار شدن بانک تست | **S** |
| بدون Rate Limit روی ورود کاربران | `usersApi.js:156-176` | — | — | 🟠 brute force | **S** |
| نشست مدیر در حافظهٔ پروسه | `contentStore.js:716` | سادگی | ری‌استارت = خروج همه | 🟠 استقرار چند‑نمونه‌ای غیرممکن | **M** |
| JSON فایل به‌عنوان دیتابیس | `contentStore.js:275-278` | MVP | I/O بلاک‌کننده، race condition | 🔴 سقف مقیاس‌پذیری | **XL** |
| `adminApi.js` ۲٬۷۶۰ خط / ۲۱۲ مسیر | `database/adminApi.js` | رشد طبیعی | هر تغییر پرریسک | 🟠 رگرسیون پنهان | **L** |
| `contentStore.js` ۱۷۱ KB / ۷ دامنه | `database/contentStore.js` | رشد طبیعی | SRP نقض‌شده | 🟠 تست و نگهداری | **L** |
| `mediaStore.js` ۱۴۹ KB / ۱۲ مجموعه | `database/mediaStore.js` | رشد طبیعی | همان | 🟠 همان | **L** |
| `wiki/mockData.js` ۳۹٬۸۹۰ خط در باندل | `src/services/wiki/mockData.js` | داده در سورس | باندل بزرگ | 🟠 performance | **M** |
| باندل ۴٫۴ MB بدون code split سایت | `App.jsx` + `vite.config.js` | eager import | TTI بالا | 🟠 تجربهٔ کاربر | **M** |
| تکرار helperهای HTTP | `readBody`/`sendJson`/`ok`/`fail`/`parseCookies`/`safeEqual` در ۳+ فایل | کپی | رفع باگ سه‌جا | 🟠 ناهمگونی امنیتی | **S** |
| داده تکراری در mockData و JSON | ۴ دامنه | مهاجرت نیمه‌تمام | دو منبع حقیقت | 🟠 محتوای کهنه | **M** |
| ۲۹ breakpoint بی‌مقیاس | ۴۵ فایل CSS | رشد ارگانیک | نگهداری سخت | 🟡 ناهمگونی بصری | **M** |
| CSS پنل برای همهٔ بازدیدکنندگان | `App.jsx:18, 43-46` | import سطح‌بالا | ~۷٬۳۰۰ خط CSS اضافی | 🟡 performance | **S** |
| بدون Error Boundary | `main.jsx` | — | صفحهٔ سفید روی هر خطا | 🟠 تجربهٔ کاربر | **XS** |
| تاریخچهٔ Git با ۴۷ MB artifact و PII | `.git` ۲۱۹ MB | `.gitignore` دیرهنگام | کلون کند | 🟠 نشت PII | **M** |
| `events.json`/`activity.json` در Git | `git ls-files` | — | churn مداوم | 🟡 تاریخچهٔ شلوغ | **XS** |
| ۳۵ فایل تغییر uncommitted | working tree | — | — | 🟠 از دست رفتن کار | **XS** |
| بدون بکاپ محتوا | — | — | — | 🔴 از دست رفتن کل محتوا | **S** |
| ۳۲ `eslint-disable` | ۳۲ فایل | — | stale closure | 🟡 باگ‌های ظریف | **M** |
| منطق نمره‌دهی آزمون در دو جا | `examStore.js` + `testBankService.js` | — | ناهمگونی احتمالی | 🟡 نمرهٔ ناسازگار | **M** |
| پیشرفت کاربر فقط در localStorage | ۱۲ سرویس | MVP | بین دستگاه sync نمی‌شود | 🟠 دادهٔ کاربر در خطر | **XL** |
| `dist/` کهنه | `dist/` | build ممنوع | استقرار نسخهٔ قدیمی | 🟠 — | **XS** |

**جمع تخمینی:** ۳ مورد XS · ۵ مورد S · ۱۰ مورد M · ۴ مورد L · ۲ مورد XL

---

# 34. Single Points of Failure

| # | جزء | چرا SPOF | پیامد شکست |
|---|---|---|---|
| ۱ | `database/contentStore.js` | **همهٔ ۲۱۲ مسیر پنل + ۱۱ مسیر عمومی + مرکز تحلیل + مرکز رسانه + آزمون (از طریق `usersStore`) به آن وابسته‌اند** | کل سیستم از کار می‌افتد |
| ۲ | `database/content/*.json` | تنها نسخهٔ محتوا. بدون بکاپ، بدون تراکنش | 🔴 از دست رفتن کل محتوای پلتفرم |
| ۳ | `database/adminApi.js:2523 handleApi` | تک نقطهٔ ورود همهٔ API پنل و عمومی | کل API می‌خوابد |
| ۴ | `database/usersStore.js` | هویت همهٔ کاربران سایت + ورود گوگل + آزمون + بازخورد | کاربران وارد نمی‌شوند، آزمون‌ها بی‌هویت می‌مانند |
| ۵ | `database/userSessions.js` | هویت سروری آزمون‌ها و بازخورد | آزمون‌های نیمه‌کاره بی‌هویت |
| ۶ | `src/services/userStorage.js` | تنها نقطهٔ ورود/ثبت‌نام کلاینت + fallback ناامن | 🔴 دور زدن احراز هویت |
| ۷ | `src/router/appRoute.js` | تنها منبع حقیقت مسیرها | کل ناوبری می‌شکند |
| ۸ | `src/styles/tokens.css` | همهٔ رنگ‌ها و تم | 🔴 کل ظاهر (در دو تم) می‌شکند |
| ۹ | `server.js` | تک پروسهٔ Node بدون cluster/PM2 | هر خطای کشنده = قطع کامل سرویس |
| ۱۰ | `contentStore.js:716 sessions Map` | نشست همهٔ مدیران در یک پروسه | ری‌استارت = خروج همه؛ مانع scale افقی |
| ۱۱ | `database/sanitizeHtml.js` | تک منبع پاک‌سازی HTML برای سرور و کلاینت | باگ در آن = XSS در همهٔ مسیرهای محتوا |
| ۱۲ | `database/publishing.secrets.json` | توکن همهٔ کانال‌ها در یک فایل | از دست رفتن فایل = قطع انتشار |

---

# 35. Critical User Flows

## Flow 1 — ثبت‌نام کاربر جدید

```
#auth/register → AuthPage → FormData → userStorage.saveUserRecord()
  → POST /api/users/register → usersStore.saveUser() → users.json
  → setSessionCookie() → کوکی tapesh_user_session
  → storeUser() در localStorage → هدایت به #onboarding
```
| مرحله | شکست ممکن |
|---|---|
| FormData | ⚠️ ورودی‌های کنترل‌نشده عمدی‌اند (`README`) — ریسک کم |
| `saveUserRecord` | 🔴 **در خطای شبکه fallback محلی می‌سازد و کاربر را وارد می‌کند** (`userStorage.js:104-107`) |
| `saveUser` | 🔴 شمارهٔ موجود = بازنویسی رمز + ورود به حساب دیگری |
| `users.json` | 🔴 نوشتن غیراتمیک — کرش وسط = فایل خراب = همهٔ کاربران گم می‌شوند |
| `setSessionCookie` | ⚠️ `Secure` فقط با هدر `x-forwarded-proto` |
| `#onboarding` | ✅ سالم |

## Flow 2 — ورود مدیر به پنل

```
#admin → AdminLayout → POST /api/admin/auth/login
  → authenticate() → قفل چک → scrypt verify → lastLoginAt
  → createSession() → Map + csrfToken → کوکی tapesh_admin_session
  → GET /api/admin/auth/me → publicAdmin() + permissions
```
| مرحله | شکست ممکن |
|---|---|
| `authenticate` | ✅ قفل ۸ تلاش، پیام یکسان |
| `createSession` | ⚠️ حافظهٔ پروسه — ری‌استارت = خروج |
| کوکی | ⚠️ `Secure` فقط در `NODE_ENV=production`؛ روی http محلی ورود می‌شکند مگر `TAPESH_INSECURE_COOKIE=1` |
| CSRF | ✅ `safeEqual` زمان‌ثابت |
| `auth/me` | ⚠️ اگر نقش ادمین تغییر کند، Permissionها فوراً به‌روز می‌شوند (خوب) |

## Flow 3 — شرکت در آزمون هماهنگ

```
#dashboard?l=coordinated-exams → POST /api/exams/:slug/registration
  → POST /api/exams/:slug/attempts (یا anon-ok) → startAttempt()
  → GET /api/attempts/:id/questions → sanitizeQuestion() (بدون کلید)
  → PUT /api/attempts/:id/answers (هر پاسخ) → recordAnswerDelta()
  → POST /api/attempts/:id/submit → gradeAttempt() → نتیجه
  → GET /api/exams/:slug/result + /ranking + /questions/review
```
| مرحله | شکست ممکن |
|---|---|
| ثبت‌نام | ✅ بازهٔ زمانی + سهمیه در سرور |
| شروع Attempt | ✅ `attempt-limit-reached` |
| تحویل سؤال | ✅ **`sanitizeQuestion` کلید را حذف می‌کند** — امن |
| ثبت پاسخ | ✅ `invalid-answer` برای خارج از بازه · Rate Limit ۲۴۰ |
| زمان | ✅ `/server-time` — ساعت مرجع سرور است، نه کلاینت |
| پایان | ⚠️ اگر پاسخ `submit` نرسد، `finalizeAttempt` با `grace` انجام می‌شود (مکانیزم جبران) |
| نتیجه/رتبه | ✅ مالکیت چک می‌شود |

## Flow 4 — ثبت مقاله و انتشار

```
#admin/articles → AdminContentEditor → POST/PUT /api/admin/articles
  → permission: articles.create/update → sanitizeHtml(contentHtml)
  → createArticle/updateArticle → articles.json + logActivity
  → POST /api/admin/articles/:id/status → articles.publish
```
| مرحله | شکست ممکن |
|---|---|
| مجوز | ✅ |
| پاک‌سازی HTML | ✅ allow-list |
| ذخیره | 🔴 read-modify-write غیراتمیک روی `articles.json` (۶۲KB) |
| انتشار | ✅ `setArticleStatus` + لاگ |
| نمایش عمومی | ✅ `GET /api/public/articles` فقط منتشرشده |

## Flow 5 — آپلود ویدیوی دورهٔ بین‌الملل

```
#admin/intl-courses → AdminIntlCourses → POST /api/admin/intl-courses/upload
  → چک نشست + CSRF + permission intl.upload
  → uploadExtensionFor(name, mime) → allow-list
  → saveIntlUpload() → stream روی دیسک (public/uploads/intl/)
  → logActivity
  → نمایش: /uploads/intl/<name> با Range
```
| مرحله | شکست ممکن |
|---|---|
| مجوز | ✅ سه لایه |
| پسوند | ✅ مقدم بر MIME اعلامی |
| حجم | ✅ از settings (`maxVideoUploadMb`) |
| نوشتن | ⚠️ stream بدون resume — قطع اتصال = فایل نیمه‌کاره |
| پخش | ✅ Range پشتیبانی می‌شود (سافاری OK) |

## Flow 6 — ورود با گوگل

```
#auth → startGoogleAuth() → GET /api/auth/google/start
  → کوکی state (SameSite=Lax) → 302 به گوگل
  → /callback → تبادل code → userinfo → saveGoogleUser()
  → handoff یک‌بارمصرف در Map → 302 به /?google=handoff#auth
  → AuthPage می‌خواند از location.search → consumeGoogleHandoff() → storeUser()
```
| مرحله | شکست ممکن |
|---|---|
| پیکربندی | ⚠️ **الان غیرفعال است** — `.env` وجود ندارد |
| state | ✅ کوکی `Lax` با TTL ۶۰۰s، بررسی زمان‌ثابت |
| اتصال حساب | ✅ فقط با ایمیل **تأییدشدهٔ** گوگل (گارد خوب) |
| handoff | ✅ یک‌بارمصرف، TTL ۱۲۰s |
| بازگشت | ⚠️ ری‌استارت سرور بین callback و handoff = توکن باطل (پذیرفته‌شده و مستند) |
| **اثبات واقعی** | `UNVERIFIED` — «ورود واقعی را فقط یک‌بار با حساب گوگل خودت می‌شود ثابت کرد» (`README.md:1330`) |

---

# 36. Security Attack Surface

```
[PUBLIC PAGES]  #, #pricing, #products, #about, #group, #articles/**, #auth, #onboarding
    └─ بدون احراز هویت · محتوا از JS می‌آید (بدون SSR)

[PUBLIC API]  ۱۱ مسیر /api/public/*
    ├─ /test-bank/questions        🔴 کلید پاسخ
    ├─ /analytics/collect          ✅ Rate Limit · ≤۵۰ رویداد · ≤۶۴KB
    ├─ /feedback                   ✅ Rate Limit · هویت اختیاری
    └─ /feedback/replies?userId=   ⚠️ شناسهٔ سبک کلاینتی

[AUTHENTICATION]
    ├─ /api/users/login|register   🔴 بدون Rate Limit · بدون Origin check · SHA-256
    ├─ /api/users?phone=           🔴 نشت پروفایل + enumeration
    ├─ /api/auth/google/*          ✅ state + handoff
    └─ /api/admin/auth/login       ✅ قفل ۸ تلاش · scrypt

[USER ENDPOINTS]  ۶ مسیر /api/users/*  ·  ۲۰ مسیر /api/exams/*
    ├─ آزمون‌ها                    ✅ مالکیت چک می‌شود · Rate Limit · CSRF
    └─ /users/hearts               ⚠️ پاداش از ورودی کلاینت

[ADMIN ENDPOINTS]  ۲۱۲ مسیر /api/admin/*
    ├─ همه پشت کوکی + CSRF + Permission   ✅
    ├─ /auth/login (باز)                  ✅
    ├─ /intl-courses/upload (باینری)      ✅ سه لایه
    └─ POST /users با role:super-admin    ⚠️ ارتقای سطح دسترسی توسط admin معمولی

[UPLOADS]  /uploads/**  ۵۵ MB
    ├─ خواندن: عمومی، بدون احراز هویت        ⚠️
    ├─ نوشتن: media.upload / intl.upload    ✅
    └─ allow-list پسوند + سقف حجم + نام تصادفی ✅

[SEARCH]
    └─ ۷ نقطه، همه شامل‌سازی رشته‌ای با نرمال‌سازی فارسی · بدون تزریق ممکن ✅

[EXTERNAL INTEGRATIONS]  (سرور → بیرون، خروجی‌محور)
    ├─ Google OAuth (accounts.google.com, oauth2.googleapis.com, openidconnect)
    ├─ بله (tapi.bale.ai) · تلگرام (api.telegram.org) · ایتا (eitaayar.ir)
    ├─ Instagram Graph (graph.facebook.com)
    └─ GA / GSC / PageSpeed (اختیاری)
       ⚠️ SSRF اگر آدرس پایه از پنل قابل تنظیم باشد — بررسی کامل نشد

[DATABASE ACCESS]
    └─ هیچ مسیر مستقیمی وجود ندارد؛ دسترسی فقط از طریق توابع store ✅
       ⚠️ اما users.json در تاریخچهٔ Git و در دسترس فایل‌سیستم است
```

---

# 37. Performance Hotspots (Top 10)

| # | Location | Why expensive | Evidence | Impact | Optimization |
|---|---|---|---|---|---|
| ۱ | `dist/assets/index-CE3tjnht.js` | ۴٫۴۱ MB در یک فایل | اندازه‌گیری | TTI بالا برای همهٔ بازدیدکنندگان | `React.lazy` برای `AdminLayout` و مرکز رسانه/تحلیل |
| ۲ | `src/services/wiki/mockData.js` | ۳۹٬۸۹۰ خط در باندل | `wc -l` | صدها KB JS بی‌استفاده | منتقل به `/api/public/wiki` |
| ۳ | `App.jsx:18, 43-46` | ۴ CSS بزرگ (۷٬۳۰۰+ خط) eager import | کد | CSS غیرلازم به همه | lazy CSS کنار chunk |
| ۴ | `contentStore.js:620-625` | `readFileSync` + `JSON.parse` کل فایل در هر درخواست | کد | `events.json` ۱٫۳MB = ~۱۵ms | cache با invalidation بر `mtime` |
| ۵ | `contentStore.js:275-278` | `writeFileSync` کل مجموعه در هر ذخیره | کد | `events` (۱٫۳MB) و `micro` (۸۵۰KB) گران | append-only NDJSON برای events |
| ۶ | `public/anatomy/models/nervous.glb` | ۲۸٫۸ MB تنها | اندازه‌گیری | تجربهٔ اول آناتومی ۳بعدی کند | Draco/meshopt + نمایش پیش‌رونده |
| ۷ | `analyticsStore.js:184-196` | هر beacon = بازنویسی `events.json` | کد | I/O در ترافیک بالا | بافر + flush دوره‌ای |
| ۸ | `admin.css` (۴٬۴۶۲ خط) + `planning.css` (۳٬۱۹۸) | همیشه در باندل | `App.jsx:18, 46` | CSS parse + style recalc | کد اسپلیت CSS پنل |
| ۹ | `public/uploads/` | PNGهای ۲٫۸–۳٫۱ MB بدون بازپردازش | `ls` | پهنای باند | تبدیل به webp + resize در سرور |
| ۱۰ | `contentStore.js:3033-3037` | کل بانک تست (۱۶۴KB) در هر درخواست عمومی، بدون صفحه‌بندی/ETag | کد | پهنای باند + CPU | صفحه‌بندی + `ETag` از `testBankRevision()` (که وجود دارد) |

---

# 38. Most Fragile Parts (Top 10)

| # | بخش | چرا شکننده |
|---|---|---|
| ۱ | `database/usersStore.js` (۱۹۴ خط) | بدون تست، منطق امنیتی حیاتی، هش ضعیف، دو گارد ظریف (`!passwordHash`) که اگر برداشته شوند ورود با هر رمزی ممکن می‌شود — **یک کامیت ساده می‌تواند کل هویت سایت را بشکند** |
| ۲ | `src/services/userStorage.js` (۲۲۰ خط) | بدون تست، fallback ناامن، هویت در localStorage — هر تغییر کوچک اثر امنیتی دارد |
| ۳ | `database/contentStore.js:724-796` (احراز هویت ادمین) | بدون تست مستقل، `loginAttempts` در حافظه، تمدید لغزان — coupling بالا با `readSettings` |
| ۴ | `database/adminApi.js:2698-2758` (خط لولهٔ امنیتی) | **۲۳۶ خط که ترتیب چهار چک (route → session → CSRF → permission) در آن حیاتی است.** یک جابه‌جایی = حفرهٔ امنیتی بی‌صدا |
| ۵ | `database/sanitizeHtml.js` (۱۵۲ خط) | regex-based؛ تک منبع پاک‌سازی سرور و کلاینت. باگ در آن = XSS در همهٔ مسیرهای محتوا. بدون تست |
| ۶ | `src/styles/tokens.css` (۲۷۳ خط) | همهٔ رنگ‌ها/تم. تغییر یک توکن روی ۵۰٬۰۰۸ خط CSS اثر می‌گذارد |
| ۷ | `database/contentStore.js:275-278` (`writeJson`) | `writeFileSync` غیراتمیک — کرش وسط نوشتن = فایل خراب = داده گم‌شده. تنها `userSessions.js` الگوی اتمیک دارد |
| ۸ | `src/router/routeHashes.js` + `appRoute.js` | رشته‌های hash در چند جا؛ تطبیق دقیق vs پیشوندی. «تلهٔ ۱۰» مستند شده اما بدون تست |
| ۹ | `scripts/verify-render.mjs` (۸۶ KB) | `String.raw` با backtick درونی — «تلهٔ ۱۳»: یک backtick اضافی = خطای سینتکس کل فایل |
| ۱۰ | `src/layout/dashboard/DashboardLayout.jsx:24-38` | ۱۴ `lazy()` — افزودن/حذف لایه نیازمند هماهنگی با `LAYER_IDS`, `VIEW_TITLES`, `COURSE_LAYERS`, `routeHashes` — ۵ نقطهٔ هماهنگ‌شده بدون تست |

---

# 39. Most Important Parts (Top 10 — Dependency/Impact)

> این رتبه‌بندی **ارزشی نیست** — فقط تعداد وابستگی و شدت اثر.

| # | بخش | چه چیزی به آن وابسته است |
|---|---|---|
| ۱ | `database/contentStore.js` | ۲۱۲ مسیر پنل + ۱۱ عمومی + مرکز تحلیل + مرکز رسانه + آزمون + بازخورد + آپلود. **بیشترین in-degree پروژه** |
| ۲ | `database/adminApi.js` | کل پنل، کل API عمومی، تلمتری، بازخورد |
| ۳ | `database/usersStore.js` | ورود/ثبت‌نام، ورود گوگل، هویت آزمون، بازخورد، برنامه‌ریزی |
| ۴ | `src/services/**` (۳۵ دامنه) | کل UI داشبورد و سایت |
| ۵ | `src/router/appRoute.js` + `routeHashes.js` | کل ناوبری + CTAها + لینک‌های فوتر |
| ۶ | `src/styles/tokens.css` | ۵۰٬۰۰۸ خط CSS + `themeService` + اسکریپت ضد FOUC در `index.html` |
| ۷ | `database/userSessions.js` | هویت سروری آزمون‌های ۲ ساعته، بازخورد، قلب |
| ۸ | `database/sanitizeHtml.js` | همهٔ محتوای غنی: مقاله، میکرو، رفرنس، SOP، پیش‌نمایش پنل |
| ۹ | `src/layout/dashboard/DashboardLayout.jsx` + `dashboardRoute.jsx` | ۱۴ لایه + `COURSE_LAYERS` + `routeHashes` + `App.jsx` |
| ۱۰ | `database/analyticsStore.js` | ۱۶ بخش مرکز تحلیل + `dataSources()` + `requestMetrics()` + `allowCollect`/`allowFeedback` (که مسیرهای عمومی به آن‌ها وابسته‌اند) |

---

# 40. Quick Wins

| Task | Location | Estimated Effort | Impact |
|---|---|---|---|
| حذف fallback ورود بدون رمز | `userStorage.js:127-132` | **XS** (۱۰ دقیقه) | 🔴 بستن یک دور زدن کامل احراز هویت |
| افزودن `ErrorBoundary` در `main.jsx` | `src/main.jsx` | **XS** | 🟠 پایان صفحهٔ سفید روی هر خطا |
| مسدودکردن بازنویسی رمز در `saveUser` | `usersStore.js:79-96` | **XS** | 🔴 بستن تصاحب حساب |
| حذف `correctAnswer`/`explanation`/`stats` از پاسخ عمومی بانک تست | `contentStore.js:3025-3029` | **S** | 🟠 پایان نشت کلید پاسخ |
| افزودن `allowRate` به `/api/users/login` و `/register` | `usersApi.js:156-176` | **S** (کپی الگوی `examApi.js:217`) | 🟠 پایان brute force |
| حذف یا محدودکردن `GET /api/users?phone=` | `usersApi.js:150-154` | **XS** | 🟠 پایان نشت پروفایل |
| افزودن `events.json` و `activity.json` به `.gitignore` | `.gitignore` | **XS** | 🟡 پایان churn در Git |
| کامیت‌کردن ۳۵ فایل تغییر uncommitted | — | **XS** | 🟠 پایان ریسک از دست رفتن کار |
| استخراج `src/styles/pricing.css` و ادغام با `layout/pricing/pricing.css` | ۲ فایل هم‌نام | **S** | 🟡 یک منبع حقیقت |
| `robots.txt` + `sitemap.xml` + `og:image` | `public/` + `index.html` | **S** | 🟠 SEO پایه |
| حذف `AdminLayout`/مرکز رسانه از باندل اصلی با `lazy` | `src/App.jsx` | **S** | 🟠 کاهش محسوس باندل |
| انتقال `App.jsx:18, 43-46` CSS به کنار chunk خودش | `src/App.jsx` | **S** | 🟡 کاهش CSS |
| `GET /api/health` عمومی | `server.js` | **XS** | 🟡 آماده برای load balancer |
| الگوی اتمیک `tmp+rename` در `writeJson` | `contentStore.js:275-278` | **S** | 🟠 پایان ریسک فایل خراب |
| افزودن `role: 'super-admin'` به گاردهای `createAdmin`/`updateAdmin` | `contentStore.js:3668-3745` | **XS** | 🟡 پایان ارتقای سطح دسترسی |
| حذف ۵ TODO تصویر یا تکمیلشان | `TestsSection.jsx:18-72` | **XS** | 🟡 پاکیزگی |
| پنهان‌کردن دکمهٔ «تغییر رمز» تا پیاده‌سازی | `setting/Security.jsx:85` | **XS** | 🟡 اعتماد کاربر |
| یک `limits.js` مرکزی برای سقف‌های بدنه | ۵ فایل | **S** | 🟡 پایان ناهمگونی |
| `git gc --aggressive` + حذف `*.out.mjs` از تاریخچه | `.git` | **M** | 🟠 ۴۷ MB صرفه‌جویی |
| بازبینی ۵ نقطهٔ `dangerouslySetInnerHTML` برای تأیید پاک‌سازی | ۵ فایل | **S** | 🟠 بستن احتمالی XSS |

---

# 41. Major Engineering Risks

| # | Risk | Evidence | Trigger | Impact | Probability | Mitigation |
|---|---|---|---|---|---|---|
| ۱ | **تصاحب حساب کاربران سایت** | `usersStore.js:74-107` + `usersApi.js:156-162` | هر مهاجمی که شمارهٔ یک کاربر را بداند | 🔴 از دست رفتن حساب + دسترسی به دادهٔ شخصی | **بالا** (بدون هیچ پیش‌نیاز) | ثبت‌نام را فقط برای شمارهٔ بدون حساب بپذیر |
| ۲ | **دور زدن احراز هویت در fallback کلاینت** | `userStorage.js:110-133` | قطع یا مسدودسازی `/api/users/login` | 🔴 ورود بدون رمز به هر حسابی که در `localStorage` باشد | **متوسط** (نیازمند دستکاری شبکه یا خطای سرور) | حذف fallback |
| ۳ | **نشت کلید پاسخ بانک تست** | `contentStore.js:3025-3037` | `curl` ساده | 🟠 بی‌اعتبار شدن اعتبارسنجی | **بالا** | فیلتر فیلدها |
| ۴ | **از دست رفتن کل محتوای CMS** | بدون بکاپ · `writeFileSync` غیراتمیک · بدون تراکنش | کرش وسط نوشتن، خطای دیسک، حذف تصادفی | 🔴 از دست رفتن ۳٫۵ MB محتوای تولیدشده | **پایین تا متوسط** — اما اثر فاجعه‌بار | بکاپ زمان‌بندی‌شده + نوشتن اتمیک |
| ۵ | **نشت هش رمزهای کاربران** | `users.json` در ۵ کامیت تاریخی · هش SHA-256 بدون Salt | دسترسی به repo یا دیسک | 🔴 شکستن رمزها با rainbow table | **متوسط** | حذف از تاریخچه + مهاجرت به `scrypt` |
| ۶ | **بی‌اعتبار شدن نمرهٔ آزمون** | `usersApi.js:128-148` پاداش قلب از `answers[]` کلاینت · پیشرفت در `localStorage` | دستکاری درخواست یا `localStorage` | 🟠 بی‌اعتبار شدن گیمیفیکیشن/پیشرفت | **متوسط** | اعتبارسنجی پاسخ‌ها در سرور با `correctAnswer` |
| ۷ | **از کار افتادن پنل با رشد داده** | `readFileSync` + پارس کامل در هر درخواست · `events.json` ۱٫۳MB | رشد `events.json` به چند ده مگابایت | 🟠 کندی شدید پنل | **متوسط** | سقف سخت‌گیرانه‌تر + cache + NDJSON |
| ۸ | **Race Condition در ویرایش هم‌زمان** | `contentStore.js:275-278` | دو مدیر هم‌زمان یک رکورد را ذخیره کنند | 🟠 از دست رفتن ویرایش یکی | **متوسط** | نوشتن اتمیک + بررسی `updatedAt` (optimistic lock) |
| ۹ | **قطعی کامل روی خطای کشندهٔ Node** | `server.js` تک‌پروسه، بدون PM2/cluster | `uncaughtException` یا OOM | 🔴 قطع سرویس تا ری‌استارت دستی | **پایین** | PM2/systemd با restart خودکار |
| ۱۰ | **افشای توکن‌های انتشار** | `publishing.secrets.json` + `media.secrets.json` در فایل‌سیستم پروژه | دسترسی به سرور یا کپی ناخواسته | 🟠 ارسال پیام از طرف برند | **پایین** (خارج از Git، مجوز 0600) | انتقال به secret manager |

---

# 42. Missing Infrastructure

> فقط مواردی که برای **این** معماری و این پروژه واقعاً لازم‌اند.

> ### 🔄 بازنگری ۳ (~۲۰:۴۵) — ۳ مورد دیگر بسته شد
>
> | مورد | بازنگری ۲ | **بازنگری ۳** |
> |---|---|---|
> | هدرهای امنیتی | ❌ غایب | ✅ **FIXED** — `securityHeaders.js` · ۹/۹ + ۱/۱ تست |
> | مهاجرت نسخه‌دار | ❌ `NOT FOUND` | ✅ **FIXED** — `database/migrations/` (رجیستری ۲ مهاجرت، ۱۲ انبار) · ۷/۷ تست · `data:migrate` ⇒ ۰ تغییر |
> | قفل نوشتن بین‌پروسه | ❌ غایب | ✅ **FIXED** — `database/writeQueue.js` (`withFileLock` · `withAdvisoryLock` · `mutateJsonFile`) · ۸/۸ تست |
> | Error Boundary | ❌ غایب | ⚠️ **PARTIAL** — کامپوننت ۳ scope دارد، **۲ نصب شده**؛ سطح `root` در `main.jsx` نیست |
> | SEO پایه | ❌ غایب | ⚠️ **PARTIAL** — کد و اعتبارسنج هست، **ولی artifact فعلی `dist/` بدون `robots.txt`/`sitemap.xml` است** و `seo:check` ⇒ exit 1 |
> | بازتولیدپذیری build | ❌ نامعلوم | ✅ **FIXED** — `vite build` ⇒ **exit=0**؛ `esbuild` از import ضمنی به `devDependencies` منتقل شد |
> | زمان‌بندی بکاپ | ❌ | ❌ **همچنان OPEN** — اسکریپت و تست ۱۲/۱۲ هست؛ scheduler/retention/drill نیست |
> | Error tracking | ❌ | ❌ **همچنان OPEN** |
> | لاگ پایدار | ❌ | ⚠️ **PARTIAL** — لاگ JSON هست، sink/rotation نیست |
> | staging · CI اجراشده · coverage · OpenAPI · E2E مرورگری · load test | ❌ | ❌ **همچنان OPEN/BLOCKED** |
>
> **جدول بازنگری ۲ در ادامه** (وضعیت ~۱۶:۳۰).

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶) — ۵ از ۹ مورد بسته شد.**
>
> | مورد پایه | وضعیت فعلی |
> |---|---|
> | بکاپ خودکار محتوا | ⚠️ **PARTIAL** — `data-backup.mjs` + `data-restore.mjs` (dry-run/`--apply`) + `backup:restore:test` **۱۲/۱۲**. **زمان‌بندی خودکار ندارد** |
> | تست برای احراز هویت کاربران | ✅ **FIXED** — `database/usersAuth.test.mjs` **۷۸ سنجه** |
> | CI | ⚠️ **PARTIAL** — `.github/workflows/ci.yml` (۳ job) + `verify:all` (۲۶ گام) نوشته شد؛ **هرگز اجرا نشد** (repo push نشده) |
> | Rate limiting روی مسیرهای کاربر | ✅ **FIXED** — `database/userRateLimit.js` (login/register/بانک تست، دو سطل) |
> | Error tracking | ❌ **OPEN** — همچنان فقط `serverErrors[]` در حافظه |
> | Health check عمومی | ✅ **FIXED** — `/healthz` (liveness) · `/readyz` (۳ سنجه، ۵۰۳ در نبود) · `/metrics` (توکن‌دار، ۴۰۴ بی‌توکن) |
> | لاگ پایدار ساخت‌یافته | ⚠️ **PARTIAL** — لاگ JSON تک‌خطی + `X-Request-Id` اضافه شد (`database/observability.js`)، ولی **روی دیسک پایدار/چرخشی نیست** و متریک درون-حافظه است |
> | سند API ماشین‌خوان | ⚠️ **PARTIAL** — `docs/api/api-contract.json` + `api:contract:check` (۲۲۹ مسیر، ۰ نقض) هست؛ **OpenAPI استاندارد نیست** |
> | بازپردازش تصویر | ❌ **OPEN** — ۵۵ MB آپلود خام |
>
> **موارد تازهٔ شناسایی‌شده که در این فهرست نبودند:** staging · migration نسخه‌دار · coverage tooling · E2E مرورگری · load test · توزیع‌شده‌سازی Rate Limit (درون-پروسه‌ای است) · CSP/HSTS.

| مورد | وضعیت | چرا برای این پروژه لازم است |
|---|---|---|
| **بکاپ خودکار محتوا** | ❌ **غایب — فوری‌ترین** | `database/content/*.json` تنها نسخهٔ محتواست. بدون بکاپ، یک حادثه = از دست رفتن کل پلتفرم. `README.md:7` حتی می‌گوید «فایل‌های کهنه پاک شدند» — یعنی حذف اتفاق می‌افتد |
| **تست برای احراز هویت کاربران** | ❌ | تنها بخش امنیتی بدون هیچ تست — و همان‌جا دو آسیب‌پذیری بحرانی کشف شد |
| **CI** | ❌ | ۵۶ سنجهٔ سبز وجود دارد (`domain:test` ۲۲ + `planning:test` ۳۴) + ۳ فایل تست سرور، اما هیچ‌جا خودکار اجرا نمی‌شوند. یک pre-commit hook کافی است |
| **Rate limiting روی مسیرهای کاربر** | ❌ | الگوی `allowRate` **موجود** است (`examApi.js:217`) — فقط در `usersApi` استفاده نشده |
| **Error tracking** | ❌ | `serverErrors` در حافظه با ری‌استارت پاک می‌شود. یک Sentry یا حتی یک فایل JSON append-only کافی است |
| **Health check عمومی** | ❌ | `analytics/ping` پشت احراز هویت است |
| **لاگ پایدار ساخت‌یافته** | ❌ | خطاهای ۵xx به `events.json` می‌روند ✅ اما درخواست‌ها فقط در حافظه |
| **Dokument API ماشین‌خوان** | ❌ | ۲۱۲ مسیر در یک آرایهٔ کد؛ تولید OpenAPI از همان آرایه ارزان است |
| **بازپردازش تصویر** | ❌ | ۵۵ MB آپلود خام با PNGهای ۳ MB |
| **Analytics بیرونی** | ⚠️ کد وجود دارد، متغیرها تنظیم نیستند | `.env.example` همه را مستند کرده؛ مصرف‌کننده در `analyticsEngine` هست. فقط پیکربندی لازم است |
| **Monitoring بیرونی** | ⚠️ فقط متغیر محیطی مستند | `MONITORING_*` در `.env.example` هست، مصرف‌کننده تأیید نشد |
| **CDN** | ❌ | ۱۶۱ MB دارایی از یک سرور |
| **Backup/Rollback استقرار** | ❌ | بدون CI/CD |
| **اعتبارسنجی اسکیمایی ورودی** | ❌ | هیچ لایهٔ validation متمرکز — `saveUser` فقط `phone` را چک می‌کند |
| **Rotation توکن نشست** | ❌ | هر دو سیستم توکن ثابت در طول عمر نشست دارند |

**مواردی که آگاهانه غایب‌اند و لازم هم نیستند:** پرداخت (پروژه پرداخت واقعی ندارد)، ارسال ایمیل/SMS (جریان تأیید ایمیل وجود ندارد)، Docker (استقرار تک‌سروری)، WebSocket (بدون نیاز real-time).

---

# 43. Product Readiness

> ### 🔄 بازنگری ۳ (~۲۰:۴۵)
>
> | بعد | بازنگری ۲ | **بازنگری ۳** |
> |---|---|---|
> | **Technical** | ⚠️ Partially Ready (۱۷۲ فایل کامیت‌نشده) | ✅ **Ready** — working tree ۸ مسیر (فقط دادهٔ کاربر) · ۵۰ کامیت · `vite build` exit=0. **کاهش‌دهنده:** بار اولیه ۳٫۲۶MB |
> | **Security** | ✅ Ready | ✅ **Ready (قوی‌تر)** — CSP/HSTS + fail-closed credential + قفل بین‌پروسه + قرارداد ورودی ۱۳۴/۱۳۴. **کاهش‌دهنده:** تاریخچهٔ Git با PII · `/uploads` بدون کنترل |
> | **UX** | ✅ Ready (با استثناها) | ✅ **Ready** — ErrorBoundary اضافه شد ولی **سطح `root` نصب نیست**؛ پنل روی موبایل، تغییر رمز، تب اشتراک همچنان باز |
> | **Performance** | ⚠️ Partially Ready | ⚠️ **Partially Ready** — build بازتولیدپذیر شد و بودجه ماشین‌خوان است؛ **ولی ۱MB پنل ادمین در مسیر بحرانی است** و Core Web Vitals همچنان UNVERIFIED |
> | **Operational** | ⚠️ Partially Ready | ⚠️ **Partially Ready (بهتر)** — build/health/metrics/backup/migrations/deploy آمدند؛ **staging، CI اجراشده، error tracking، لاگ پایدار، زمان‌بندی بکاپ همچنان غایب** |
> | **Maintainability** | ✅ Ready | ✅ **Ready** — ۲۳ سند · ۳۶ گام دروازه · ۲۱ فایل تست. **کاهش‌دهنده:** `adminApi.js`/`contentStore.js` بزرگ‌تر |
> | **Scalability** | ❌ Not Ready | ⚠️ **Partially Ready** — `writeQueue.js` مسیر چند-پروسه‌ای را **آماده** کرد، ولی هندلرها هنوز از `mutateJsonFile` استفاده نمی‌کنند و نشست ادمین در حافظه است |
>
> **جدول بازنگری ۲ در ادامه.**

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶) — بازنگری این جدول:**
>
> | بعد | پایه | فعلی |
> |---|---|---|
> | **Technical** | ⚠️ Partially Ready | ⚠️ **Partially Ready** — `dist/` دیگر کهنه نیست و باندل به ۱۹ chunk شکسته شد، ولی **۱۷۲ فایل کامیت‌نشده** ریسک اصلی است |
> | **Security** | ⚠️ Partially Ready («Not Ready برای مسیر کاربران سایت») | ✅ **Ready** برای هر دو مسیر — هر ۶ حفره بسته شد و تست دارد؛ یک XSS واقعی هم کشف و رفع شد. **کاهش‌دهنده:** CSP/HSTS نداریم و PII در تاریخچهٔ Git است |
> | **UX** | ✅ Ready (با استثناها) | ✅ **Ready** (بدون تغییر) — پنل روی موبایل، دکمهٔ تغییر رمز، تب اشتراک همچنان باز |
> | **Performance** | ⚠️ Partially Ready | ⚠️ **Partially Ready** — entry از ۴٫۴MB به **۱٫۵۶MB** رسید و بودجه ماشین‌خوان شد؛ **Core Web Vitals همچنان `UNVERIFIED`** |
> | **Operational** | ❌ Not Ready | ⚠️ **Partially Ready** — بکاپ/بازیابی/health/metrics/deploy آمدند؛ **staging، CI اجراشده، error tracking، و لاگ پایدار همچنان غایب‌اند** |
> | **Maintainability** | ✅ Ready | ✅ **Ready** — ۲۲ سند در `docs/` و ۲۶ گام دروازه اضافه شد؛ **کاهش‌دهنده:** `adminApi.js`/`contentStore.js` بزرگ‌تر شدند |
> | **Scalability** | ❌ Not Ready | ❌ **Not Ready** (بدون تغییر ساختاری) — نشست ادمین هنوز در حافظهٔ پروسه، Rate Limit هنوز درون-پروسه‌ای |
>
> **جدول زیر متن ۲۹ سپتامبر است** و برای تاریخچه نگه داشته شده.

| بعد | وضعیت | دلیل فنی |
|---|---|---|
| **Technical readiness** | ⚠️ **Partially Ready** | سایت، داشبورد، پنل، مرکز تحلیل و مرکز رسانه همه پیاده‌اند و اجرا می‌شوند (۵۶ سنجهٔ سبز). اما `dist/` کهنه است، باندل ۴٫۴ MB است، و ۳۵ فایل تغییر uncommitted روی یک codebase ۲۴۳ هزار خطی نشسته است |
| **Security readiness** | ⚠️ **Partially Ready** | پایهٔ پنل قوی است (CSRF دو لایه، RBAC per-route، scrypt، قفل تلاش، ضد-enumeration). **اما** مسیر کاربران سایت سه حفرهٔ جدی دارد (تصاحب حساب، هش بدون Salt، fallback بدون رمز) و بانک تست کلید پاسخ را لو می‌دهد. **`Not Ready` برای مسیر کاربران سایت، `Ready` برای پنل مدیریت** |
| **UX readiness** | ✅ **Ready** (با استثناها) | دیزاین سیستم توکنی دو تمی با بررسی خودکار کنتراست، `aria-*` گسترده، حالت loading/empty/error، مودال‌های دسترس‌پذیر، گارد `prefers-reduced-motion`. **استثناها:** پنل مدیریت روی موبایل کار نمی‌کند؛ دکمهٔ «تغییر رمز» بی‌کار است؛ تب «اشتراک» وصل نیست |
| **Performance readiness** | ⚠️ **Partially Ready** | بهینه‌سازی‌های هدفمند انجام شده (preload فونت، ضد FOUC، ۱۴ لایه lazy، `Cache-Control: immutable` یک‌ساله، حذف اندازه‌گیری خودآلوده، `testBankRevision` برای تغییرسنجی). **اما** باندل ۴٫۴ MB و CSS پنل در باندل عمومی، و Core Web Vitals **`UNVERIFIED`** |
| **Operational readiness** | ❌ **Not Ready** | بدون بکاپ، بدون CI/CD، بدون Docker، بدون rollback، بدون health check عمومی، بدون error tracking، بدون monitoring. سشن‌های مدیر در حافظهٔ پروسه. تنها دارایی: مستندسازی بسیار خوب |
| **Maintainability readiness** | ✅ **Ready** | ۱۲۵ KB README + ۲۳ README زیرلایه + ۲۰ تلهٔ مستند + قرارداد معماری صریح + نام‌گذاری منسجم + ۵۶ سنجهٔ خودکار. **کاهش‌دهنده‌ها:** ۶ فایل غول (۱۱۱–۱۷۱ KB) و نبود تست برای احراز هویت |
| **Scalability readiness** | ❌ **Not Ready** | معماری فایل‌محور با `readFileSync`/`writeFileSync` در مسیر درخواست، بدون تراکنش، بدون ایندکس، نشست در حافظهٔ پروسه، `events.json` در حال رشد. **`INFERENCE`:** برای ۱۰k کاربر سایت عمومی احتمالاً تاب می‌آورد؛ برای ۱۰۰k نه. مسیر مهاجرت مستند شده («تغییر بدنهٔ توابع store») و واقع‌بینانه است |

---

# 44. System Map

```
                                        ┌─────────────────────┐
                                        │        User         │
                                        └──────────┬──────────┘
                                                   │ hash URL (#dashboard?s=…&l=…&v=…)
┌──────────────────────────────────────────────────▼──────────────────────────────────────────────┐
│  FRONTEND — src/**  (۳۰۲ JSX + ۱۲۴ JS + ۵۵ CSS = ۲۱۸٬۴۱۴ خط)                                     │
│                                                                                                  │
│  index.html ──▶ main.jsx ──▶ App.jsx (۱٬۱۰۷ خط)                                                   │
│      │                        ├── router/appRoute.js  (تنها منبع حقیقت مسیر)                       │
│      │                        ├── layout/site/         (هدر، فوتر، دادهٔ صفحهٔ اصلی)               │
│      │                        ├── layout/auth/AuthPage                                            │
│      │                        ├── layout/{pricing,products,about,group,articles}/                 │
│      │                        ├── layout/dashboard/DashboardLayout ──▶ ۱۴ لایهٔ lazy + Suspense    │
│      │                        └── layout/admin/AdminLayout ──▶ ۲۱ view + analytics + media + planning│
│      │                                                                                            │
│      ├── styles/  (۱۷ فایل ورودی) + layout/*/*.css  ◀── tokens.css (تنها منبع رنگ/تم)             │
│      └── components/easter-egg/  (بازی مستقل: موتور ۱/۶۰ + Web Audio)                             │
│                                                                                                  │
│  STATE / SERVICES — src/services/**  (۶۸٬۹۸۹ خط · ۳۵ دامنه)                                        │
│      ├── localStorage  (۳۵ کلید: theme، user، progress، greenPath، notes، flashcards، …)           │
│      ├── fetch ──▶ /api/public/*   (۱۱ مسیر)                                                      │
│      └── fetch ──▶ /api/users/* , /api/exams/* , /api/auth/google/*                               │
└──────────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                   │ HTTP same-origin (بدون CORS)
┌──────────────────────────────────────────────────▼──────────────────────────────────────────────┐
│  API LAYER                                                                                       │
│    توسعه: vite middleware (vite.config.js:40 — ۳ پلاگین)                                          │
│    تولید: server.js (node:http خالص) ── handleApi → handleExamApi → handleUsersApi → GoogleAuth    │
│                                                                                                  │
│    handleApi (adminApi.js:2523) — خط لوله:                                                        │
│      matchRoute ▶ نشست (کوکی) ▶ CSRF (x-tapesh-csrf) ▶ Permission ▶ readBody ▶ handler ▶ ok()      │
│      finally: recordApiRequest() + clearExpiredSessions()                                        │
│                                                                                                  │
│    ۲۱۲ مسیر /api/admin/*  ·  ۱۱ مسیر /api/public/*                                                │
│    ۲۰ مسیر /api/exams/*   ·   ۶ مسیر /api/users/*  ·  ۴ مسیر /api/auth/google/*                   │
└──────────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                   │ توابع دامنه (بدون ORM)
┌──────────────────────────────────────────────────▼──────────────────────────────────────────────┐
│  BUSINESS LOGIC / DATA ACCESS  (database/** — ۲۱٬۸۳۸ خط)                                          │
│                                                                                                  │
│  contentStore.js (۱۷۱ KB) ─ RBAC(۷۴ مجوز/۳ نقش) · نشست ادمین · CMS(۳۳ مجموعه) · بانک تست          │
│  mediaStore.js  (۱۴۹ KB) ─ مرکز رسانه (۱۲ مجموعه)                                                 │
│  examStore.js   (۱۰۹۱ خط) ─ Attempt سرورمحور · تصحیح سرور · زنجیرهٔ Audit هش‌شده                   │
│  analyticsStore/Engine/Insights (~۱۶۱ KB) ─ ۱۶ بخش تحلیل · سنجهٔ سرور · Rate Limit                │
│  usersStore.js (SHA-256 ⚠️) + userSessions.js (اتمیک ✅) ─ هویت کاربران سایت                        │
│  publishingStore.js + publishers/{bale,telegram,telegramLike,eitaa,instagram}.js                   │
│  googleAuth.js (OAuth 2.0 دست‌نویس) · sanitizeHtml.js (allow-list مشترک) · uploadsFile.js (Range)   │
│  feedbackStore.js · planningService.js (کلاینت) · examSeed.mjs                                    │
└──────────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                   │ readFileSync / writeFileSync
┌──────────────────────────────────────────────────▼──────────────────────────────────────────────┐
│  PERSISTENCE  (بدون دیتابیس واقعی)                                                                │
│    database/content/*.json         ۳۶ فایل · ۳٫۵ MB  (events ۱٫۳MB · microCourses ۸۵۰KB)          │
│    database/users.json             ⚠️ SHA-256 بدون Salt · در تاریخچهٔ Git                          │
│    database/users.sessions.json    ✅ نوشتن اتمیک (tmp+rename)                                     │
│    database/publishing.secrets.json / media.secrets.json   ۰۶۰۰ · خارج از Git                     │
│    public/uploads/  (۵۵ MB)   ·   public/anatomy/  (۱۰۶ MB، ۷ مدل GLB)                            │
└──────────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                   │ fetch (سرور → بیرون)
┌──────────────────────────────────────────────────▼──────────────────────────────────────────────┐
│  EXTERNAL SERVICES                                                                               │
│    Google OAuth (accounts / oauth2 / openidconnect)  ⚠️ غیرفعال (.env نیست)                       │
│    بله (tapi.bale.ai) · تلگرام (api.telegram.org) · ایتا (eitaayar.ir) · Instagram Graph          │
│    GA4 / Search Console / PageSpeed (اختیاری — بدون پیکربندی = connected:false صادقانه)            │
│    ALERT_WEBHOOK / ALERT_TELEGRAM (هشدارهای مرکز تحلیل)                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

# 45. Top 25 Issues

> **🔄 بازنگری ۳ (~۲۰:۴۵):** ردیف‌های ۱، ۲، ۶ و ۷ جدول بازنگری ۲ **رفع شدند** (کامیت‌شدن، هدرهای امنیتی، CI workflow، Core Web Vitals همچنان باز). سه ردیف تازه از مغایرت‌های همین بازنگری اضافه شد. جدول بازنگری ۲ در ادامه برای تاریخچه.

| # | Problem | Location | Severity | Evidence | Consequence | Recommended Action |
|---|---|---|---|---|---|---|
| ۱ | **دروازه سبز نیست** — `repo:hygiene` exit 1 | `.workbuddy-ai/memory/2026-10-01.md:544` | 🔴 **HIGH** | `repo:hygiene` ⇒ «۱ یافتهٔ نقض» · الگو: `password: 'W…` | آخرین گام دروازه شکست می‌خورد ⇒ «سبز بودن دروازه» قابل اتکا نیست | الگوی سرّ را باریک کن **یا** `.workbuddy-ai/` را از ردیابی خارج کن |
| ۲ | **SEO در artifact نیست** — `vite build` آن را پاک می‌کند | `vite.config.js` (بدون `emptyOutDir`) + `scripts/generate-sitemap.mjs` | 🟠 **HIGH** | `seo-validate.mjs` ⇒ ۲ یافته · **exit 1**؛ هیچ `robots.txt`/`sitemap.xml` روی دیسک نیست | استقرار بدون sitemap/robots ⇒ SEO از دست می‌رود | `seo:generate` را به `postbuild` ببند یا پلاگین ویت |
| ۳ | **۱MB پنل ادمین در بار اولیه** (بار اولیه ۳٫۲۶MB) | `src/App.jsx:12` | 🟠 **HIGH** | `<link rel="modulepreload" href="./assets/admin-1WTCsLoF.js">` (۱٬۰۲۴٬۲۲۳ B) · `lazy(` در `App.jsx` = **۰** | هر بازدیدکنندهٔ سایت عمومی ۱MB JS پنل را می‌گیرد | `AdminLayout` را `lazy()` کن (همان الگوی `DashboardLayout`) |
| ۴ | **`.workbuddy-ai/` tracked** (۱۸ فایل) | `.gitignore` | 🟠 **HIGH** | `git ls-files .workbuddy-ai` = ۱۸ · شامل `memory/*.md` + `screenshots/*.png` | زائدات نشست در مخزن محصول؛ منبع ردیف ۱ | `git rm -r --cached .workbuddy-ai` + `.gitignore` — **تأیید** |
| ۵ | **تاریخچهٔ Git با PII** | `.git` = ۲۱۷ MB | 🟠 **HIGH** | `git-history-audit.mjs`: `activity.json` ۱۹ نسخه/۲٫۸۱MB · `users.json` ۱۱ نسخه · `admins.json` ۱۷ نسخه · `.app.out.mjs` ۴۵٫۲۸MB | هر کسی با دسترسی به repo، PII و هش رمز می‌گیرد | `git filter-repo` + `gc` — **تأیید صریح**؛ اسکریپت دستور آماده چاپ می‌کند |
| ۶ | **ErrorBoundary سطح `root` نصب نیست** | `src/main.jsx` | 🟠 **HIGH** | کل `src/` ⇒ ۲ مورد `<ErrorBoundary` (`admin`، `dashboard`)؛ `main.jsx` (۱۷ خط) خام `<App />` رندر می‌کند | استثنا در خودِ `App` = صفحهٔ سفید | `<ErrorBoundary scope="root">` دور `<App />` |
| ۷ | **staging وجود ندارد** | — | 🟠 **HIGH** | Gate فاز ۲۱ و ۲۳ به همین دلیل عبور نکرد | load test، DR drill، Core Web Vitals ناممکن | یک محیط staging |
| ۸ | **E2E مرورگری وجود ندارد** | — | 🟠 **HIGH** | `playwright`/`cypress`/`puppeteer`/`vitest`/`jsdom` = **NONE** | جریان‌های UI **UNVERIFIED** | Playwright + یک smoke روی staging |
| ۹ | **Core Web Vitals / load test** | — | 🟠 **HIGH** | هیچ اندازه‌گیری مرورگر | تجربهٔ واقعی کاربر ناشناخته | Lighthouse/CrUX روی staging |
| ۱۰ | **CI هرگز اجرا نشده** | `.github/workflows/ci.yml` | 🟡 **MEDIUM** | workflow هست؛ هیچ اجرای واقعی دیده نشد | دروازهٔ ۳۶ گامی فقط دستی | push به remote + یک اجرای سبز |
| ۱۱ | **نشست ادمین memory-only** | `contentStore.js:910` | 🟡 **MEDIUM** | `const sessions = new Map()` | ری‌استارت = خروج همه؛ مانع scale افقی | `sessionStore` + `admin.sessions.json` + تست restart |
| ۱۲ | **`/uploads/**` بدون کنترل دسترسی** | `uploadsFile.js` | 🟡 **MEDIUM** | `serveUploadRequest` چک نشستی ندارد | ۵۵MB با URL عمومی | `visibility: public\|private` + دسترسی امضاشده |
| ۱۳ | **اعتبارسنجی Schema فقط ۵ از ۱۳۴ مسیر نوشتن** | `database/apiContract/inputGateway.js` | 🟡 **MEDIUM** | ۱۲۵ مسیر فقط «ساختار بدنه» دارند؛ علت ثبت‌شده: `POST /api/admin/articles` ⇒ ۴۰۰ `missing_published_at` | بدنهٔ سیم با رکورد انبار یکی نیست | «قرارداد سیم» جدا به‌ازای هر دامنه |
| ۱۴ | **هندلرهای پنل روی `mutateJsonFile` نیستند** | `database/adminApi.js` | 🟡 **MEDIUM** | `writeQueue.js` ساخته شد ولی هندلرها از آن استفاده نمی‌کنند | استقرار چند-پروسه‌ای تضمین lost update ندارد | مهاجرت تدریجی؛ تا آن‌جا تک‌پروسه |
| ۱۵ | **rate limit عمومی پنل** | `database/adminApi.js` | 🟡 **MEDIUM** | فقط login/register/بانک تست | اسپم/استخراج انبوه | دو سطح عمومی/نوشتنی، کلید identity+IP |
| ۱۶ | **OpenAPI استاندارد نیست** | `docs/api/api-contract.json` | 🟡 **MEDIUM** | ماشین‌خوان هست، OpenAPI 3 نیست | ۲۲۹ مسیر بدون سند استاندارد | generator از `api-contract.json` |
| ۱۷ | **Coverage tooling نصب نیست** | — | 🟡 **MEDIUM** | `c8`/`nyc`/`istanbul` = NONE | پوشش عددی نامعلوم | `c8` + baseline پیش از threshold |
| ۱۸ | **زمان‌بندی/retention بکاپ · DR drill** | `scripts/data-backup.mjs` | 🟡 **MEDIUM** | اسکریپت + تست ۱۲/۱۲ هست؛ scheduler نیست | بکاپ دستی فراموش می‌شود | scheduler + retention + drill دوره‌ای |
| ۱۹ | **`adminApi.js` ۲٬۸۵۰ خط · `contentStore.js` ۴٬۴۲۰ خط** | `database/` | 🟡 **MEDIUM** | `wc -l` | هر تغییر پرریسک | refactor تدریجی (فاز ۲۶) |
| ۲۰ | **CSS پنل برای همهٔ بازدیدکنندگان** | `App.jsx:18, 46-48` | 🟡 **MEDIUM** | ۴ import سطح‌بالا | CSS اضافی + parse | lazy CSS کنار chunk (هم‌زمان با ردیف ۳) |
| ۲۱ | **observability پایدار نیست** | `database/observability.js` | 🟡 **MEDIUM** | لاگ JSON هست، ولی sink/rotation/error-tracking نیست؛ متریک درون-حافظه | دیباگ پس از ری‌استارت | log sink + rotation + error tracking |
| ۲۲ | **هارنس‌های رندر/responsive اجرا نشده‌اند** | `scripts/verify-render.mjs` · `theme-contrast.mjs` · `tailwind-probe.mjs` | 🟢 **LOW** | در دروازه نیستند | responsive و کنتراست **UNVERIFIED** | افزودن به دروازه |
| ۲۳ | **سخت‌سازی تصویر/رسانه** | `database/contentStore.js` | 🟢 **LOW** | ۵۵MB آپلود خام | payload سنگین | resize/thumbnail/metadata strip |
| ۲۴ | **هویت کلاینتی (رمز کاربر)** | `src/services/userStorage.js` | 🟢 **LOW** | localStorage هنوز «کش نمایشی» است ولی رمز سمت کلاینت می‌ماند | جعل پیشرفت | server-authoritative identity |
| ۲۵ | **یکپارچه‌سازی‌های بیرونی بدون consumer** | `database/publishers/*` · AI · Payment | 🟢 **LOW** | بدون توکن/sandbox | قابلیت `UNVERIFIED` | قرارداد آداپتر + mock server |

**ترتیب این جدول بر اساس شدت فنی و دامنهٔ تأثیر سیستم است، نه سلیقه.**

### جدول بازنگری ۲ (~۱۶:۳۰) — تاریخچه

> در این جدول، ردیف‌های ۱ (۱۷۲ فایل کامیت‌نشده)، ۶ (CI اجرانشده) و ۷ (Core Web Vitals) با وضعیت امروز فرق دارند: **۱ کامیت شد** · **۶ همچنان اجرا نشده** · **۷ همچنان UNVERIFIED**. ردیف ۲ (تاریخچهٔ Git) و ۸ (ErrorBoundary) و ۹ (نشست ادمین) در جدول فعلی بازآمده‌اند.

| # | Problem | Location | Severity | Evidence | Consequence | Recommended Action |
|---|---|---|---|---|---|---|
| ۱ | **۱۷۲ فایل کامیت‌نشده** — تمام ۲۳ فاز سخت‌سازی روی working tree | working tree | 🔴 **CRITICAL** | `git status --short \| wc -l` = **۱۷۲** · HEAD هنوز `a86d875` | یک `git checkout`/`git stash`/خرابی دیسک = از دست رفتن **کل** سخت‌سازی امنیتی و ۳۰ اسکریپت | کامیت مرحله‌ای (per-phase) با تأیید کاربر |
| ۲ | **تاریخچهٔ Git با PII** | `.git` = **۲۱۹ MB** | 🟠 **HIGH** | `du -sh .git` · `users.json` (هش رمز) در ۵ کامیت · `activity.json` (IP/UA) · `.app.out.mjs` ۴۷MB | هر کسی با دسترسی به repo، PII و هش رمز می‌گیرد؛ کلون کند | `git filter-repo` + `gc --aggressive` — **نیازمند تأیید صریح** |
| ۳ | **staging وجود ندارد** | — | 🟠 **HIGH** | Gate فاز ۲۱ به همین دلیل عبور نکرد | load test، DR drill و تأیید استقرار ناممکن | یک محیط staging (حتی تک‌نمونه) |
| ۴ | **E2E مرورگری وجود ندارد** | — | 🟠 **HIGH** | `playwright`/`cypress`/`puppeteer`/`vitest`/`jsdom` = **NONE** | همهٔ جریان‌های UI (ثبت‌نام، draft/publish، exam flow، media) **UNVERIFIED** | افزودن Playwright + یک smoke جریان حیاتی |
| ۵ | **SEO پیاده نشده** | `public/`, `index.html` | 🟠 **HIGH** | `ls public/` = فقط `anatomy`+`uploads`؛ در `index.html` **۰** مورد `og:`/`twitter:`/`canonical`/`ld+json` | پلتفرم محتوایی با ۱۲+ مقاله، هیچ راهنمای ایندکس ندارد | طبق `docs/ops/seo-strategy.md` گزینهٔ A+C؛ پیش‌نیاز: دامنهٔ قطعی + build تازه |
| ۶ | **CI نوشته شده ولی هرگز اجرا نشده** | `.github/workflows/ci.yml` | 🟠 **HIGH** | ۳ job تعریف شده؛ هیچ اجرای واقعی دیده نشد (repo push نشده) | دروازهٔ ۲۶ گامی فقط دستی اجرا می‌شود ⇒ رگرسیون بی‌سنجش | push به remote + یک اجرای سبز |
| ۷ | **Core Web Vitals اندازه‌گیری نشده** | — | 🟠 **HIGH** | بودجهٔ باندل هست (`perf:bundle`) ولی هیچ اندازه‌گیری مرورگر | نمی‌دانیم کاربر واقعاً چه تجربه‌ای دارد | Lighthouse روی staging |
| ۸ | **`ErrorBoundary` وجود ندارد** | کل `src/` | 🟡 **MEDIUM** | `ErrorBoundary` در `src/` فقط در `src/layout/group/README.md` | یک باگ در هر کامپوننت = صفحهٔ سفید | `ErrorBoundary` در `main.jsx` + داشبورد + پنل |
| ۹ | **نشست ادمین در حافظهٔ پروسه** | `contentStore.js:910` | 🟡 **MEDIUM** | `const sessions = new Map()` | ری‌استارت = خروج همهٔ مدیران؛ مانع scale افقی | جدول `sessions` روی دیسک مثل `userSessions.js` |
| ۱۰ | **`/uploads/**` بدون کنترل دسترسی** | `uploadsFile.js` | 🟡 **MEDIUM** | `serveUploadRequest` هیچ چک نشستی ندارد | ۵۵MB فایل با URL عمومی | اگر محتوا حساس است، پشت Permission ببر |
| ۱۱ | **دروازهٔ ورودی در ۱۱۸ مسیر نوشتن سیم‌کشی نشده** | `database/apiContract/input.js` | 🟡 **MEDIUM** | `assertInputValid` فقط **۴ بار** و فقط در `adminApi.js` | نوشتن بدون اعتبارسنجی ساختاری | سیم‌کشی تدریجی روی مسیرهای نوشتن |
| ۱۲ | **هدرهای امنیتی ناقص** | `server.js`, `adminApi.js` | 🟡 **MEDIUM** | `Content-Security-Policy`/`X-Frame-Options`/`Strict-Transport-Security` یافت نشد | سطح حملهٔ بزرگ‌تر (clickjacking، MITM) | CSP + HSTS + `X-Frame-Options` + `Permissions-Policy` |
| ۱۳ | **OpenAPI وجود ندارد** | — | 🟡 **MEDIUM** | `docs/api/api-contract.json` هست ولی OpenAPI نیست | ۲۲۹ مسیر بدون سند ماشینی استاندارد | تولید OpenAPI از `api-contract.json` |
| ۱۴ | **migration نسخه‌دار وجود ندارد** | — | 🟡 **MEDIUM** | Gate فاز ۲۱ به همین دلیل عبور نکرد | تغییر schema بدون مسیر ارتقای کنترل‌شده | نسخه‌بندی schema + اسکریپت migration |
| ۱۵ | **coverage tooling نصب نیست** | — | 🟡 **MEDIUM** | `c8`/`nyc`/`istanbul` در `node_modules` یافت نشد | پوشش فقط «دامنه‌ای» استنتاج می‌شود، نه عددی | افزودن `c8` |
| ۱۶ | `adminApi.js` **۲٬۸۴۷ خط / ۲۲۹ مسیر** | `database/adminApi.js` | 🟡 **MEDIUM** | `wc -l` (از ۲٬۷۶۰ بزرگ‌تر شد) | هر تغییر پرریسک | تقسیم به `routes/<domain>.js` |
| ۱۷ | `contentStore.js` **۴٬۴۲۳ خط / ۷ دامنه** | `database/contentStore.js` | 🟡 **MEDIUM** | `wc -l` (از ۳٬۸۹۷ بزرگ‌تر شد) | SRP نقض، تست سخت | تقسیم به storeهای دامنه‌ای |
| ۱۸ | **تکرار helperهای HTTP** | `readBody`/`sendJson`/`parseCookies`/`safeEqual` | 🟡 **MEDIUM** | پل `apiContract/input.js` ساخته شد ولی `readBody` هنوز در چند فایل با سقف‌های ۱۲MB/۱MB/۲۵۶KB تکرار می‌شود | رفع باگ چند‌جا، ناهمگونی امنیتی | ماژول `httpUtils.js` مشترک |
| ۱۹ | **CSS پنل برای همهٔ بازدیدکنندگان** + ۲۹ breakpoint بی‌مقیاس | `src/App.jsx:18,43-46` · `src/**/*.css` | 🟡 **MEDIUM** | ۴ import سطح‌بالا (~۷٬۳۰۰ خط)؛ ۵۵ فایل CSS / ۵۰٬۰۰۸ خط، بدون تغییر | CSS اضافی + parse + ناهمگونی بصری | lazy CSS کنار chunk + مقیاس ۴ نقطه‌ای در `tokens.css` |
| ۲۰ | **۵ دادهٔ زمان‌اجرا هنوز tracked** | `activity` · `admins` · `events` · `publishLog` · `mediaMetrics` | 🟡 **MEDIUM** | `.gitignore` به‌روز شد ولی فایل‌ها tracked‌اند (کامنت خود فایل هم این را می‌گوید) | churn مداوم + PII در تاریخچه | `git rm --cached` — **نیازمند تأیید** (ایندکس را تغییر می‌دهد) |
| ۲۱ | `mockData.js` **۳۹٬۸۹۰ خط** ⇒ بزرگ‌ترین chunk | `src/services/wiki/mockData.js` | 🟡 **MEDIUM** | `wc -l`؛ chunk `mockData` = **۱٫۸۱ MB** | بزرگ‌ترین بار باقی‌مانده در باندل | انتقال به API (backend ندارد — فاز ۲۰) |
| ۲۲ | **بدون rate limit روی مسیرهای عادی پنل** | `database/adminApi.js` | 🟡 **MEDIUM** | `userRateLimit.js` فقط روی login/register و بانک تست فعال است | اسپم/استخراج انبوه از پنل | اعمال `consumeAuthAttempt` روی مسیرهای پنل |
| ۲۳ | **پیش‌فرض `0135/0135`** برای رمز ادمین | `contentStore.js` | 🟢 **LOW** | اگر `TAPESH_ADMIN_PASSWORD` تنظیم نشود، رمز ضعیف شناخته‌شده فعال است؛ `mustChangePassword` سرور اعمال نمی‌کند | اولین استقرار بدون `.env` | اگر رمز از env نیامد، ورود را رد کن |
| ۲۴ | **تغییر رمز کاربر متصل نیست** | `src/layout/dashboard/setting/` | 🟢 **LOW** | TODO در UI | کاربر نمی‌تواند رمزش را عوض کند | مسیر `POST /api/users/password` |
| ۲۵ | **AI/Payment/publisher بدون consumer واقعی** | `database/publishers/*` | 🟢 **LOW** | بدون توکن؛ بدون sandbox قابل آزمون | قابلیت اعلام‌شده ولی `UNVERIFIED` | تعیین تکلیف: پیاده یا حذف از UI |

**ترتیب این جدول بر اساس شدت فنی و دامنهٔ تأثیر سیستم است، نه سلیقه.**

### جدول پایه (۲۹ سپتامبر) — ۱۱ ردیف آن رفع شد

| # | Problem | وضعیت فعلی |
|---|---|---|
| ۱ | تصاحب حساب با ثبت‌نام مجدد | ✅ **FIXED** |
| ۲ | هش `SHA-256` بدون Salt | ✅ **FIXED** |
| ۳ | ورود بدون بررسی رمز در fallback کلاینت | ✅ **FIXED** |
| ۴ | نشت کلید پاسخ بانک تست | ✅ **FIXED** |
| ۵ | نشت پروفایل + enumeration | ✅ **FIXED** |
| ۶ | بدون Rate Limit روی ورود/ثبت‌نام | ✅ **FIXED** |
| ۷ | باندل ۴٫۴ MB در یک فایل | ✅ **FIXED** |
| ۸ | `dist/` کهنه | ✅ **FIXED** |
| ۹ | ۴۷ MB artifact + PII در تاریخچهٔ Git | ❌ **OPEN** (ردیف ۲ بالا) |
| ۱۰ | بدون بکاپ محتوا | ⚠️ **PARTIAL** (اسکریپت + تست ۱۲/۱۲؛ زمان‌بندی ندارد) |
| ۱۱ | بدون Error Boundary | ❌ **OPEN** (ردیف ۸ بالا) |
| ۱۲ | نشست ادمین در حافظه | ❌ **OPEN** (ردیف ۹ بالا) |
| ۱۳ | نوشتن غیراتمیک JSON | ✅ **FIXED** |
| ۱۴ | `/uploads/**` بدون کنترل دسترسی | ❌ **OPEN** (ردیف ۱۰ بالا) |
| ۱۵ | ارتقای سطح دسترسی توسط admin | ✅ **FIXED** |
| ۱۶ | بدون Sitemap/Robots/OG/JSON-LD | ❌ **OPEN** (ردیف ۵ بالا) |
| ۱۷ | ۲۹ breakpoint بی‌مقیاس | ❌ **OPEN** (ردیف ۱۹ بالا) |
| ۱۸ | `adminApi.js` غول | ❌ **OPEN (بدتر)** |
| ۱۹ | `contentStore.js` غول | ❌ **OPEN (بدتر)** |
| ۲۰ | تکرار helperهای HTTP | ⚠️ **PARTIAL** |
| ۲۱ | CSS پنل برای همه | ❌ **OPEN** |
| ۲۲ | بدون تست احراز هویت کاربران سایت | ✅ **FIXED** (۷۸ سنجه) |
| ۲۳ | فایل‌های تغییر uncommitted | ❌ **OPEN (بدتر: ۱۷۲)** |
| ۲۴ | `events.json`/`activity.json` tracked | ⚠️ **PARTIAL** |
| ۲۵ | بدون اعتبارسنجی شماره/رمز | ✅ **FIXED** |

---

# 46. Prioritized Action Plan

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶):** فهرست «NOW» ممیزی پایه **کامل انجام شد** (هر ۹ مورد). برنامهٔ فعلی در ادامه؛ جدول پایه در انتهای بخش برای تاریخچه.

## NOW — باید اول انجام شوند

| Task | Why | Files affected | Dependencies | Risk | Effort |
|---|---|---|---|---|---|
| **کامیت مرحله‌ای ۱۷۲ فایل** | بزرگ‌ترین ریسک فعال: از دست رفتن کل سخت‌سازی | working tree | تأیید کاربر | پایین | S |
| **`ErrorBoundary` در `main.jsx`** | پایان صفحهٔ سفید — تنها موردی از «NOW» پایه که مانده | `src/main.jsx` | — | پایین | XS |
| **`git rm --cached` پنج دادهٔ زمان‌اجرا** | پایان churn + کاهش PII | ایندکس گیت | **تأیید صریح** | پایین | XS |
| **بازنویسی تاریخچهٔ Git** | ۲۱۹MB + هش رمز + IP/UA در تاریخچه | `.git` | **تأیید صریح** — بازنویسی تاریخچه | بالا | M |
| **افزودن Playwright + یک smoke جریان حیاتی** | بستن Gate فاز ۲۳ | `scripts/`, `package.json` | نصب وابستگی (نیازمند تأیید) | متوسط | M |
| **`robots.txt` + `sitemap.xml` + `og:image`** | SEO پایه | `public/`, `index.html` | دامنهٔ قطعی | پایین | S |
| **CSP + HSTS + `X-Frame-Options`** | بستن سطح حمله | `server.js` | تست نکردن CSS/JS inline | متوسط | M |
| **push به remote + یک اجرای سبز CI** | تبدیل دروازهٔ دستی به خودکار | `.github/workflows/ci.yml` | remote | پایین | XS |

## NEXT — پس از NOW

| Task | Why | Files affected | Dependencies | Risk | Effort |
|---|---|---|---|---|---|
| **راه‌اندازی staging** | پیش‌نیاز load test، DR drill، Core Web Vitals | زیرساخت | تصمیم زیرساخت | متوسط | M |
| **Lighthouse روی staging** | سنجش Core Web Vitals | — | staging | پایین | S |
| **نشست ادمین روی دیسک** | ری‌استارت ادمین‌ها را بیرون نیندازد | `database/contentStore.js:910+` | الگوی `userSessions.js` | متوسط | M |
| **افزودن `c8`** | پوشش عددی به‌جای استنتاجی | `package.json` | — | پایین | XS |
| **تولید OpenAPI از `api-contract.json`** | سند ماشینی استاندارد | `scripts/`, `docs/api/` | — | پایین | M |
| **نسخه‌بندی schema + migration** | بستن Gate فاز ۲۱ | `database/models/` | — | متوسط | M |
| **سیم‌کشی `assertInputValid` روی مسیرهای نوشتن** | ۱۱۸ مسیر بدون گارد ساختاری | `database/adminApi.js` | تست رگرسیون | متوسط | L |
| **rate limit روی مسیرهای پنل** | اسپم/استخراج انبوه | `database/adminApi.js` | الگوی `userRateLimit.js` | پایین | S |
| **انتقال `wiki/mockData.js` به API** | بزرگ‌ترین chunk (۱٫۸۱MB) | `src/services/wiki/`, `contentStore` | مدل دادهٔ ویکی | متوسط | M |
| **زمان‌بندی بکاپ خودکار** | بکاپ دستی فراموش می‌شود | cron/launchd + `data-backup.mjs` | — | پایین | S |
| **تقسیم `adminApi.js` به `routes/<domain>.js`** | ۲٬۸۴۷ خط | `database/adminApi.js` | هارنس تست به‌عنوان تور ایمنی | **بالا** | L |
| **ماژول `httpUtils.js` مشترک** | پایان تکرار `readBody`/`sendJson` | چند فایل مرز | — | متوسط | M |

## LATER — مهم ولی غیرفوری

| Task | Why | Files affected | Dependencies | Risk | Effort |
|---|---|---|---|---|---|
| تقسیم `contentStore.js` به storeهای دامنه‌ای | ۴٬۴۲۳ خط / ۷ دامنه | `database/contentStore.js` | هارنس تست | بالا | L |
| مقیاس breakpoint در `tokens.css` | یکنواختی responsive | `src/styles/tokens.css` + ۵۵ فایل CSS | مهاجرت تدریجی | متوسط | M |
| lazy CSS پنل کنار chunk | ~۷٬۳۰۰ خط CSS کمتر برای بازدیدکننده | `src/App.jsx` | — | متوسط | S |
| مهاجرت لایهٔ داده به دیتابیس واقعی | سقف مقیاس‌پذیری | `database/*Store.js` | تصمیم معماری | **بسیار بالا** | XL |
| انتقال وضعیت کاربر به سرور | پایان جعل پیشرفت/لیگ/گروه | ۱۲ سرویس در `src/services/` | مهاجرت لایهٔ داده | بالا | XL |
| CDN برای `public/anatomy` (۱۰۶ MB) | تجربهٔ آناتومی ۳بعدی | زیرساخت | — | پایین | M |
| بازپردازش تصویر سمت سرور | ۵۵ MB آپلود خام | `database/contentStore.js` | بدون وابستگی سنگین | متوسط | M |
| اتصال تب «اشتراک» و «تغییر رمز» | قابلیت ناقص در UI | `setting/`, `pricing/` | — | پایین | M |
| تعیین تکلیف AI/Payment/publisher | قابلیت `UNVERIFIED` | `database/publishers/*` | sandbox | متوسط | M |

### جدول پایه — «NOW» آن **کامل انجام شد**

| Task (۲۹ سپتامبر) | وضعیت |
|---|---|
| مسدودکردن بازنویسی رمز در `saveUser` | ✅ انجام شد |
| حذف fallback ورود بدون رمز | ✅ انجام شد |
| مهاجرت هش رمز کاربران به `scrypt` | ✅ انجام شد (با مهاجرت تدریجی) |
| فیلتر فیلدهای حساس بانک تست | ✅ انجام شد (allowlist + tripwire) |
| حذف `GET /api/users?phone=` | ✅ انجام شد |
| افزودن Rate Limit به ورود/ثبت‌نام | ✅ انجام شد (دو سطل) |
| بکاپ `database/content/` + `users.json` | ⚠️ اسکریپت + تست ۱۲/۱۲؛ **زمان‌بندی ندارد** |
| کامیت‌کردن فایل‌های تغییر | ❌ **انجام نشد — بدتر شد (۱۷۲)** |
| `ErrorBoundary` در `main.jsx` | ❌ **انجام نشد** |

---

### جدول کامل پایه (۲۹ سپتامبر) — برای تاریخچه

| # | Problem | Location | Severity | Evidence | Consequence | Recommended Action |
|---|---|---|---|---|---|---|
| ۱ | تصاحب حساب با ثبت‌نام مجدد روی شمارهٔ موجود | `usersStore.js:74-107` + `usersApi.js:156-162` | 🔴 **CRITICAL** | `saveUser` روی `index !== -1` رکورد را جایگزین و `passwordHash` را بازنویسی می‌کند، سپس `setSessionCookie` صادر می‌شود | هر کسی با دانستن شمارهٔ یک کاربر، حساب او را می‌گیرد | اگر کاربر موجود رمز دارد، ثبت‌نام را با ۴۰۹ رد کن |
| ۲ | هش رمز کاربران سایت با `SHA-256` بدون Salt | `usersStore.js:9-11` | 🔴 **CRITICAL** | `createHash('sha256').update(password).digest('hex')` — بدون `randomBytes` | نشت دیتابیس = شکستن رمزها با rainbow table | مهاجرت به `scrypt` (الگو در `contentStore.js:368`) |
| ۳ | ورود بدون بررسی رمز در fallback کلاینت | `userStorage.js:110-133` | 🔴 **HIGH** | `catch { … }` سپس `readLocalUsers().find(...)` و `storeUser()` بدون هیچ بررسی رمز | با قطع/مسدودسازی API، هر کاربر `localStorage` وارد می‌شود | fallback را حذف کن |
| ۴ | کلید پاسخ + توضیح + آمار بانک تست در پاسخ عمومی | `contentStore.js:3025-3037` + `adminApi.js:2484` | 🔴 **HIGH** | `publicTestBankQuestion = ({examDay, ...question}) => ({...question, …})` — فقط `examDay` حذف می‌شود | `curl /api/public/test-bank/questions` کل کلید پاسخ را می‌دهد | فیلدها را صریح لیست کن (الگوی `publishedMicroCourses:3000`) |
| ۵ | نشت پروفایل کاربران + user enumeration | `usersApi.js:150-154` | 🔴 **HIGH** | `GET /api/users?phone=X` → `publicUser(user)` بدون احراز هویت | نام، دانشگاه، ترم، motivations هر کاربر | مسیر را حذف یا پشت نشست + تطبیق ببر |
| ۶ | بدون Rate Limit روی ورود/ثبت‌نام کاربران | `usersApi.js:156-176` | 🟠 **HIGH** | `grep allowRate\|RATE` در `usersApi.js` بی‌نتیجه | brute force نامحدود روی رمزهای کوتاه | `allowRate` از `examApi.js:217` |
| ۷ | باندل ۴٫۴ MB در یک فایل | `dist/assets/index-CE3tjnht.js` | 🟠 **HIGH** | ۴٬۴۱۰٬۷۲۱ بایت | TTI بالا برای همهٔ بازدیدکنندگان | `React.lazy` برای پنل و مرکز رسانه/تحلیل در `App.jsx` |
| ۸ | `dist/` کهنه (۱۸ سپتامبر در برابر سورس ۲۹ سپتامبر) | `dist/` | 🟠 **HIGH** | تاریخ فایل‌ها + تغییر `vite.config.js`/`package.json` | استقرار نسخهٔ ۱۱ روز قبل | پیش از هر استقرار `npm run build` (با تأیید کاربر) |
| ۹ | ۴۷ MB artifact + PII در تاریخچهٔ Git | `.app.out.mjs`, `database/users.json` در ۵ کامیت | 🟠 **HIGH** | `git cat-file --batch-check` · `git log --all -- users.json` | کلون ۲۱۹ MB + نشت شماره و هش رمز | `git filter-repo` + `gc --aggressive` |
| ۱۰ | بدون بکاپ محتوا | — | 🟠 **HIGH** | هیچ اسکریپت/زمان‌بندی | از دست رفتن کل CMS | بکاپ زمان‌بندی‌شدهٔ `database/content/` + `users.json` |
| ۱۱ | بدون Error Boundary | `src/main.jsx` | 🟡 **MEDIUM** | `grep ErrorBoundary` در `src` فقط در یک README | یک باگ = صفحهٔ سفید | `ErrorBoundary` در `main.jsx` + داشبورد + پنل |
| ۱۲ | نشست ادمین در حافظهٔ پروسه | `contentStore.js:716` | 🟡 **MEDIUM** | `const sessions = new Map()` | ری‌استارت = خروج همه؛ مانع scale افقی | جدول `sessions` روی دیسک مثل `userSessions.js` |
| ۱۳ | نوشتن غیراتمیک JSON | `contentStore.js:275-278` | 🟡 **MEDIUM** | `writeFileSync(path, …)` بدون tmp+rename (برخلاف `userSessions.js:50-56`) | کرش وسط = فایل خراب = داده گم‌شده | الگوی اتمیک را اعمال کن |
| ۱۴ | `/uploads/**` بدون کنترل دسترسی | `uploadsFile.js:120-133` | 🟡 **MEDIUM** | هیچ چک نشستی در `serveUploadRequest` | ۵۵ MB فایل با URL عمومی | اگر محتوا حساس است، پشت Permission ببر |
| ۱۵ | ارتقای سطح دسترسی توسط admin معمولی | `adminApi.js:1212` + `contentStore.js:3668` | 🟡 **MEDIUM** | `users.create` در `ROLES.admin` هست و `createAdmin` نقش را محدود نمی‌کند | admin می‌تواند `super-admin` بسازد | فقط `super-admin` بتواند `super-admin` بسازد |
| ۱۶ | بدون Sitemap/Robots/Canonical/OG Image/JSON-LD | `public/`, `index.html` | 🟡 **MEDIUM** | `ls public` = فقط `anatomy` و `uploads` | SEO ضعیف برای پلتفرم محتوایی | `sitemap.xml` از `publishedArticles()` + `robots.txt` + `og:image` |
| ۱۷ | ۲۹ breakpoint بی‌مقیاس در ۴۵ فایل | `src/**/*.css` | 🟡 **MEDIUM** | `grep` شمارش | ناهمگونی بصری، نگهداری سخت | مقیاس ۴ نقطه‌ای در `tokens.css` |
| ۱۸ | `adminApi.js` ۲٬۷۶۱ خط / ۲۱۲ مسیر | `database/adminApi.js` | 🟡 **MEDIUM** | `wc -l` | هر تغییر پرریسک | تقسیم به `routes/<domain>.js` |
| ۱۹ | `contentStore.js` ۱۷۱ KB / ۷ دامنه | `database/contentStore.js` | 🟡 **MEDIUM** | `wc -l` | SRP نقض، تست سخت | تقسیم به storeهای دامنه‌ای |
| ۲۰ | تکرار helperهای HTTP در ۳+ فایل | `readBody`/`sendJson`/`ok`/`fail`/`parseCookies`/`safeEqual` | 🟡 **MEDIUM** | `grep "function readBody"` → ۳ فایل با سقف‌های ۱۲MB/۱MB/۲۵۶KB | رفع باگ سه‌جا، ناهمگونی امنیتی | ماژول `httpUtils.js` |
| ۲۱ | CSS پنل برای همهٔ بازدیدکنندگان | `App.jsx:18, 43-46` | 🟡 **MEDIUM** | ۴ import سطح‌بالا، ~۷٬۳۰۰ خط | CSS اضافی + parse | lazy CSS کنار chunk |
| ۲۲ | بدون تست برای احراز هویت کاربران سایت | — | 🟡 **MEDIUM** | `find *.test.mjs` = ۳ فایل، هیچ‌کدام `usersApi` | دو آسیب‌پذیری بحرانی در همین فایل بدون تست ماندند | تست `usersStore` + `usersApi` |
| ۲۳ | ۳۵ فایل تغییر uncommitted | working tree | 🟡 **MEDIUM** | `git status --short` | ریسک از دست رفتن کار | کامیت کن |
| ۲۴ | `events.json`/`activity.json` tracked در Git | `git ls-files database/content` | 🟢 **LOW** | ۱٫۳ MB + ۱۸۸ KB که در هر درخواست تغییر می‌کنند | churn مداوم | به `.gitignore` اضافه کن |
| ۲۵ | بدون اعتبارسنجی قالب شمارهٔ موبایل/رمز | `usersStore.js:67-72` | 🟢 **LOW** | `phone: "4138"` در `users.json` پذیرفته شده | حساب با شناسهٔ ضعیف | regex شمارهٔ ایران + حداقل طول رمز |

**ترتیب این جدول بر اساس شدت فنی و دامنهٔ تأثیر سیستم است، نه سلیقه.**


---

# 47. Refactoring Plan

> **هیچ‌جا بازنویسی کامل پیشنهاد نمی‌شود.** هیچ شاهد فنی‌ای برای rewrite وجود ندارد: معماری سه‌لایه سالم است، ۵۶ سنجهٔ تست سبز است، و مسیر مهاجرت مستند شده است. همهٔ refactorهای زیر تدریجی و برگشت‌پذیرند.

## Refactor ۱ — جداسازی لایهٔ امنیتی از مسیرها

**Current State:** ۲۱۲ مسیر + خط لولهٔ امنیتی ۲۳۶ خطی در `database/adminApi.js` (۲٬۷۶۱ خط).
**Desired State:** `database/adminApi/index.js` (خط لوله) + `database/adminApi/routes/{articles,pages,media,publishing,analytics,users,notes,settings,feedback}.js` که هر کدام فقط آرایهٔ `[method, path, permission, handler]` را export می‌کنند.
**Migration Steps:**
1. ابتدا هارنس تست را به‌عنوان تور ایمنی اجرا کن (`node database/adminApi.test.mjs`) — **با بکاپ از `content/*.json`** چون تست ممکن است بازنویسی کند.
2. `ROUTES` را به فایل‌های دامنه‌ای منتقل کن؛ `adminApi.js` فقط `import` و `concat` کند.
3. بعد از هر فایل، تست را اجرا کن و تعداد مسیرها را با `grep -c "^  \['"` بسنج (باید دقیقاً ۲۱۲ بماند).
**Risk:** متوسط — خطر جاافتادن یک مسیر یا جابه‌جایی ترتیب (که در `ROUTES.find` مهم است).
**Rollback:** هر مرحله یک کامیت جدا؛ بازگرداندن کامیت کافی است.

## Refactor ۲ — استخراج helperهای مشترک HTTP

**Current State:** `readBody` در ۳ فایل با ۳ سقف متفاوت (۱۲MB/۱MB/۲۵۶KB) · `sendJson`×۳ · `ok`×۳ · `fail`×۳ · `parseCookies`×۲+ · `safeEqual`×۲+.
**Desired State:** `database/httpUtils.js` با `readBody(request, limit)`, `sendJson`, `ok`, `fail`, `parseCookies`, `safeEqual`, `clientIp` + `database/limits.js` با ثابت‌های مرکزی.
**Migration Steps:** فایل جدید بساز → در هر میزبان import کن → توابع محلی را حذف کن → رفتار را با تست موجود تأیید کن.
**Risk:** **پایین** — توابع خالص‌اند.
**Rollback:** بازگرداندن import به توابع محلی.

## Refactor ۳ — نوشتن اتمیک همهٔ مجموعه‌ها

**Current State:** `writeJson` با `writeFileSync` مستقیم (`contentStore.js:275-278`).
**Desired State:** الگوی `userSessions.js:50-56`: نوشتن در `<path>.tmp` سپس `renameSync`.
**Migration Steps:** (۱) الگو را در `writeJson` اعمال کن (۵ خط). (۲) `mediaStore` و `publishingStore` را بررسی کن — اگر الگوی خودشان را دارند، یکسان کن.
**Risk:** **پایین** — `renameSync` روی همان فایل‌سیستم اتمیک است.
**Rollback:** یک خط.

## Refactor ۴ — جداسازی دامنه‌ها از `contentStore.js`

**Current State:** یک فایل ۱۷۱ KB با RBAC + نشست + CMS + بانک تست + فلش‌کارت + مرجع + رسانه.
**Desired State:** `contentStore/index.js` (re-export سازگاری) + `contentStore/{auth,rbac,collections,cms,testBank,flashcards,references,micro,intl,comprehensive,notes,media,banners}.js`.
**Migration Steps:** **کلید موفقیت: re-export سازگاری.** `contentStore/index.js` همان نام‌های فعلی را export کند تا هیچ‌کدام از ۲۱۲ مسیر عوض نشود. سپس فایل‌ها را یکی‌یکی جدا کن و بعد از هر جداسازی `npm run domain:test` + `planning:test` را اجرا کن.
**Risk:** بالا — `contentStore` بیشترین in-degree پروژه را دارد.
**Rollback:** `contentStore/index.js` می‌تواند موقتاً به فایل اصلی re-export کند.

## Refactor ۵ — Code splitting سایت

**Current State:** `App.jsx` همهٔ صفحات + ۴ CSS بزرگ را eager import می‌کند ⇒ باندل ۴٫۴ MB.
**Desired State:** `React.lazy` برای `AdminLayout`, `PricingPage`, `ProductsPage`, `AboutPage`, `GroupPage`, `ArticlesPage`/`ArticlePage` + انتقال CSS هر کدام به کنار خودش.
**Migration Step:** یکی‌یکی با `Suspense` با fallback موجود (`dashboard-layer-skeleton`).
**Risk:** **متوسط** — باید تأیید شود ترتیب اولویت `getAppRoute()` و لینک‌های عمیق مقالات پس از lazy شدن هم درست کار می‌کند. **نیازمند اجرای `npm run theme:render`** به‌عنوان تور ایمنی.
**Rollback:** هر کامپوننت مستقل قابل بازگرداندن است.

## Refactor ۶ — یکسان‌سازی CSS pricing

**Current State:** دو فایل برای یک دامنه: `src/styles/pricing.css` (۴۷۷ خط — صفحهٔ اصلی) و `src/layout/pricing/pricing.css` (۱٬۸۲۴ خط — صفحهٔ تعرفه).
**Desired State:** نام‌گذاری صریح: `src/styles/home-pricing.css` (کارت‌های صفحهٔ اصلی) و `src/layout/pricing/pricing.css` (صفحهٔ تعرفه).
**Migration Steps:** فقط `@import` در `src/styles.css:9` را عوض کن + نام فایل.
**Risk:** **پایین**. **Rollback:** یک خط.

## Refactor ۷ — مقیاس breakpoint

**Current State:** ۲۹ مقدار مختلف در ۴۵ فایل.
**Desired State:** ۴ نقطه در `tokens.css` به‌عنوان مرجع مستند + مهاجرت تدریجی (نه یک‌باره).
**Migration Steps:** مقادیر را در `tokens.css` به‌عنوان کامنت + custom property ثبت کن؛ از این پس هر فایل تازه فقط از این چهار استفاده کند؛ در هر فایل موجود که دست می‌خورد، نزدیک‌ترین نقطه را جایگزین کن.
**Risk:** **پایین** (تدریجی). **Rollback:** نیازی نیست.

---

# 48. Architecture Improvement

## ۴۸.۱ معماری فعلی

SPA با روتر hash-based، سرویس‌های دامنه‌ای در کلاینت، و بک‌اند `node:http` بدون دیتابیس که روی فایل‌های JSON کار می‌کند. UI و داده کاملاً جدا هستند و سرویس‌ها «قرارداد REST آینده» را مستند کرده‌اند.

## ۴۸.۲ مشکلات معماری

| # | مشکل | شاهد |
|---|---|---|
| ۱ | **Persistence فایل‌محور در مسیر درخواست** — بدون تراکنش، بدون ایندکس، بدون قفل، `readFileSync` بلاک‌کننده | `contentStore.js:265-278` |
| ۲ | **وضعیت در حافظهٔ پروسه** — `sessions` Map و `loginAttempts` Map | `contentStore.js:716-717` |
| ۳ | **دو الگوی موازی برای CMS** — `contentStore.ensureStore()` در برابر `mediaStore.ensureMediaStore()` که فقط برای مسیرهای `/media` صدا زده می‌شود | `adminApi.js:2544` |
| ۴ | **جهت وابستگی معکوس** — `contentStore.js:61` از `src/data/learning/anatomyCourse.js` (سورس کلاینت) import می‌کند؛ `routeHashes.js:8` از `layout/dashboard` | کد |
| ۵ | **منطق محصول دوشقه** — نیمهٔ آزمون/محتوا سرورمحور، نیمهٔ پیشرفت/لیگ/گروه کلاینت‌محور | بخش ۲۳ |
| ۶ | **تک‌فایل‌های غول** — `adminApi.js` ۲٬۷۶۱ · `contentStore.js` ~۳٬۸۹۰ · `mediaStore.js` ~۳٬۴۰۰ خط | `wc -l` |
| ۷ | **CSS و JS بدون code split در سطح route** برای سایت عمومی | `App.jsx:1-46` |

## ۴۸.۳ معماری پیشنهادی (تدریجی، نه بازنویسی)

```
┌─ کلاینت ───────────────────────────────────────────────────────────────┐
│  App.jsx                                                               │
│    └── React.lazy per route  ← جداکردن پنل/تعرفه/محصولات/مقالات         │
│  src/services/**  (بدون تغییر در امضا — فقط بدنهٔ توابع)                 │
│    └── src/services/api/httpClient.js  ← لایهٔ نازک fetch + خطا + retry  │
│        (جای ۳۵ نقطهٔ fetch پراکنده)                                      │
└────────────────────────────────────────────────────────────────────────┘
                              │ HTTP
┌─ سرور ─────────────────────────────────────────────────────────────────┐
│  database/httpUtils.js   ← readBody/sendJson/ok/fail/parseCookies/safeEqual
│  database/limits.js      ← سقف‌های بدنه و نرخ                            │
│                                                                        │
│  database/adminApi/index.js        ← خط لولهٔ امنیتی (تنها نسخه)         │
│  database/adminApi/routes/*.js     ← ۲۱۲ مسیر در ۹ فایل دامنه‌ای          │
│                                                                        │
│  database/contentStore/index.js    ← re-export سازگاری (تور مهاجرت)      │
│  database/contentStore/{rbac,auth,collections,cms,testBank,flashcards,  │
│                          references,micro,intl,comprehensive,notes}.js  │
│  database/mediaStore/…             ← همان الگو                          │
│                                                                        │
│  database/persistence/            ← 🔑 لایهٔ جدید: تنها نقطهٔ I/O        │
│     ├── jsonFile.js   (اتمیک tmp+rename + cache بر mtime + صف نوشتن)    │
│     └── collections.js                                                  │
│  ⚠️ این لایه دقیقاً همان جایی است که فردا به دیتابیس واقعی تبدیل می‌شود   │
│     — بدون تغییر در یک خط از storeها یا UI                              │
└────────────────────────────────────────────────────────────────────────┘
```

**مزیت کلیدی این ترتیب:** `persistence/jsonFile.js` می‌تواند امروز فایل‌محور باشد و فردا همان رابط را با Postgres پیاده کند. هیچ‌کدام از ۳۵ store/۲۵۳ مسیر/۳۰۲ کامپوننت عوض نمی‌شوند.

## ۴۸.۴ Migration Path

| گام | کار | ریسک | برگشت |
|---|---|---|---|
| ۱ | `database/httpUtils.js` + `limits.js` | پایین | بازگرداندن import |
| ۲ | `persistence/jsonFile.js` با نوشتن اتمیک + cache بر `mtime` | پایین | یک فایل |
| ۳ | مهاجرت `writeJson`/`readJson` به لایهٔ جدید | پایین | — |
| ۴ | مهاجرت `writeCollection`/`readCollection` همهٔ storeها | **متوسط** | کامیت جدا |
| ۵ | تقسیم `adminApi.js` با هارنس به‌عنوان تور | **بالا** | کامیت‌های کوچک |
| ۶ | `contentStore/index.js` re-export + تقسیم تدریجی | **بالا** | re-export سازگاری |
| ۷ | Code split سایت | متوسط | هر کامپوننت مستقل |
| ۸ | (آینده) جایگزینی `jsonFile.js` با دیتابیس واقعی | بالا | همان لایه، همان رابط |

## ۴۸.۵ بخش‌هایی که **نباید** دست زد

| بخش | چرا |
|---|---|
| `database/sanitizeHtml.js` | allow-list دقیق و مستند، تک منبع مشترک سرور/کلاینت. تغییر آن = ریسک XSS در ۵ نقطه |
| `database/userSessions.js` | الگوی نوشتن اتمیک، revoke تنبل، تمدید لغزان — **بهترین الگوی I/O در پروژه**. به‌عنوان الگو استفاده شود، نه تغییر |
| `database/examStore.js` + `examApi.js` | کامل‌ترین بخش از نظر امنیت: تصحیح سرورمحور، `sanitizeQuestion`، `/server-time`، Rate Limit per-route، زنجیرهٔ Audit هش‌شده، ۸ آسیب‌پذیری مستندشده که رفع شده‌اند |
| `src/router/appRoute.js` + `routeHashes.js` | منطق ظریف تطبیق دقیق vs پیشوندی با ۲۰ تلهٔ مستند. بدون تست، دست نزن |
| `src/styles/tokens.css` | تک منبع رنگ/تم با بررسی خودکار کنتراست |
| `scripts/verify-render.mjs` | ۸۶ KB هارنس با `String.raw` — تلهٔ ۱۳. هر backtick اضافی کل فایل را می‌شکند |
| `database/publishers/*` | ۵ آداپتور با تفاوت‌های ظریف پلتفرمی (ایتا `getChat` ندارد، تلگرام/بله فرق دارند) |
| `src/components/easter-egg/` | مستقل، بدون وابستگی، با موتور ۱/۶۰ و گارد listener در capture |

---

# 49. Unknowns

> این بخش **بسیار مهم** است. هر موردی که با اطمینان مشخص نشد، اینجاست.

> ## 🔄 بازنگری ۳ (~۲۰:۴۵) — ناشناخته‌های تازه بسته‌شده
>
> **از «ناشناخته» بیرون آمد (اجرا شد، نتیجه دارد):**
>
> | مورد | نتیجه |
> |---|---|
> | هدرهای امنیتی روی پاسخ واقعی | ✅ **۹/۹** واحد + **۱/۱** یکپارچه روی سرور واقعی · ۱۵ دایرکتیو CSP |
> | credential مدیر fail-closed | ✅ **۹/۹** — fallback شناخته‌شدهٔ `0135` حذف شد |
> | قفل نوشتن بین‌پروسه | ✅ **۸/۸** — ۵ پروسهٔ نود × ۲۰ افزایش ⇒ دقیقاً ۱۰۰ |
> | مهاجرت نسخه‌دار | ✅ **۷/۷** · `data:migrate --dry-run` ⇒ ۰ تغییر · ۰ شکست |
> | بازتولیدپذیری build | ✅ `vite build` ⇒ **exit=0** · یکپارچگی وابستگی ۵۳۴ فایل |
> | قرارداد ورودی مسیرهای نوشتن | ✅ **۱۳۴/۱۳۴** · `route:contracts:fresh` ⇒ هم‌گام |
> | خودآزمون API | ✅ `api-input-audit --selftest` ⇒ سبز |
> | دادهٔ زمان‌اجرا tracked | ✅ **۰** (از ۵) |
>
> **ناشناخته‌های تازهٔ کشف‌شده در همین بازنگری:**
>
> | مورد | وضعیت |
> |---|---|
> | **بار اولیهٔ واقعی** | ✅ **اندازه‌گیری شد: ۳٬۴۱۵٬۱۶۳ B = ۳٫۲۶ MB** (شامل ۱MB پنل ادمین با `modulepreload`) — گزارش Remediation این را «۱۶۴۲KB» گفته بود |
> | **وضعیت واقعی `repo:hygiene`** | ✅ **اندازه‌گیری شد: exit 1 · ۱ نقض** (گزارش «۰ نقض» گفته بود) |
> | **وضعیت واقعی SEO روی دیسک** | ✅ **اندازه‌گیری شد: `robots.txt`/`sitemap.xml` وجود ندارند · `seo:check` exit 1** |
> | **تعداد mountهای ErrorBoundary** | ✅ **۲ از ۳** (سطح `root` نصب نشده) |
> | نصب تمیز (`npm ci`) روی ماشین تمیز | ⚪ **UNVERIFIED-EXTERNAL** — نیازمند شبکه |
> | **اجرای کامل دروازهٔ ۳۶ گامی** | ⚪ **اجرا نشد** — شامل `build:check` است که `dist/` را بازسازی می‌کند؛ بدون درخواست صریح کاربر اجرا نکردم. وضعیت تک‌گامی همهٔ گام‌های فقط‌خواندنی را سنجیدم |
> | Core Web Vitals · load test · E2E مرورگری · Coverage · staging | ⚪ **همچنان UNVERIFIED/BLOCKED** |
> | OAuth/Publisher/Payment واقعی | ⚪ **UNVERIFIED-EXTERNAL** — بدون credential |

> ## 🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶) — این فهرست کوتاه‌تر شد
>
> **آنچه از «ناشناخته» بیرون آمد (اجرا شد و نتیجه دارد):**
>
> | مورد | نتیجه |
> |---|---|
> | تست‌های سرور | ✅ **اجرا شدند** — `auth:test` ۷۸/۷۸ · `bank:test` ۴۰/۴۰ · `exam:test` ۲۷/۲۷ · `admin:test` ۹۲/۹۲ · `admin:rbac:test` ۶۴/۶۴ · `admin:security:test` ۶۰/۶۰ · `data:test` ۲۵۴/۲۵۴ |
> | `xss:test` | ✅ **۱۴/۱۴** با ۳۹ payload خصمانه + اثبات حساسیت |
> | `e2e:api` | ✅ **۲۷/۲۷** — سرور واقعی spawn می‌شود، بدون مرورگر، بدون نوشتن دادهٔ کاربری |
> | `obs:test` | ✅ **۱۷/۱۷** |
> | `backup:restore:test` | ✅ **۱۲/۱۲** |
> | `router:test` | ✅ **۱۲۸/۰** |
> | `domain:test` / `planning:test` | ✅ ۲۲/۰ و ۳۴/۰ |
> | `smoke:test` | ✅ **۱۷/۱۷** |
> | `npm audit` | ✅ **۰ آسیب‌پذیری** در ۲۰۹ وابستگی |
> | `data:check` | ✅ ۰ خطا · ۲۲ هشدار · ۱۵۴۹ رکورد · exit 0 |
> | `api:contract:check` | ✅ ۲۲۹ مسیر · ۲۸ کد خطا · ۱۱ DTO · ۰ نقض |
> | باندل و بودجه | ✅ اندازه‌گیری‌شده از `dist/` واقعی + ۸ سقف بودجه |
> | دروازهٔ کیفیت | ✅ **۲۶/۲۶ · exit 0 · ۴۲۶٫۷s** |
>
> **آنچه همچنان ناشناخته است:**
>
> | مورد | چرا |
> |---|---|
> | **Core Web Vitals واقعی** (LCP/INP/CLS) | هیچ Lighthouse/PageSpeed اجرا نشد؛ بدون staging و بدون مرورگر |
> | **تست رابط کاربری / E2E مرورگری** | هیچ ابزار نصب نیست (`playwright`/`cypress`/`puppeteer`/`vitest`/`jest`/`jsdom` = NONE) |
> | **Load test و مقیاس‌پذیری** | بدون staging |
> | **Coverage عددی** | ابزار نصب نیست (`c8`/`nyc`/`istanbul` = NONE) |
> | **ورود واقعی با گوگل** | `.env` وجود ندارد ⇒ جریان گوگل قابل اجرا نیست |
> | **adapterهای انتشار (bale/eitaa/instagram/telegram)** | بدون توکن ⇒ صفر درخواست شبکه‌ای؛ فقط گارد SSRF تست شده |
> | **AI / Payment** | بدون consumer واقعی |
> | **Monitoring بیرونی** (`MONITORING_*`) | فقط کلید تنظیمات نمایشی؛ هیچ درخواست شبکه‌ای دیده نشد ⇒ `UNVERIFIED` |
> | **Responsive واقعی** | بدون بررسی viewport |
> | **CI واقعی** | workflow نوشته شده ولی هیچ اجرایی دیده نشد |
> | **`verify-render.mjs` / `theme-contrast.mjs` / `tailwind-probe.mjs`** | اجرا نشدند |
> | **`npm run build`** | **BLOCKED** — `Rollup failed to resolve import "three"`؛ `node_modules/three/package.json` وجود ندارد (نصب ناقص). `dist/` آسیب ندید (خرابی در فاز bundle است نه `emptyOutDir`) |
>
> **جدول‌های زیر متن ۲۹ سپتامبر است** و برای تاریخچه نگه داشته شده.

## ۴۹.۱ رفتار زمان اجرا — تأیید نشد

| مورد | چرا |
|---|---|
| **Core Web Vitals واقعی** (LCP/INP/CLS) | هیچ Lighthouse/PageSpeed اجرا نشد. اندازه‌های باندل و دارایی **اندازه‌گیری شد**، اما تجربهٔ واقعی مرورگر `UNVERIFIED` |
| **تست‌های سرور** (`adminApi.test.mjs`, `examApi.test.mjs`, `googleAuth.test.mjs`) | **اجرا نشدند** چون `adminApi.test.mjs` ممکن است `database/content/*.json` را بازنویسی کند و کاربر اجرای دستورهای دستکاری‌کنندهٔ داده را نخواسته بود. سنجه‌های ۷۸/۳۴/نامعلوم از `README.md` نقل شده‌اند، نه اندازه‌گیری این ممیزی |
| **هارنس‌های تم و رندر** (`verify-render.mjs` ۱۴۸+ سنجه، `theme-verify`, `theme-contrast`, `tailwind-probe`, `auth-render-check`) | اجرا نشدند. تعداد سنجه‌ها از `README.md` نقل شده است |
| **`npm run dev` / `npm run start`** | هیچ سروری بالا نیامد (به‌درخواست کاربر: build و اجرا بدون اجازه ممنوع) |
| **ورود واقعی با گوگل** | `.env` وجود ندارد ⇒ جریان گوگل در این workspace قابل اجرا نیست. `README.md:1330` هم صریح می‌گوید «ورود واقعی را فقط یک‌بار با حساب گوگل خودت می‌شود ثابت کرد» |
| **رفتار آداپتورهای انتشار** (بله/تلگرام/ایتا/Instagram) | هیچ درخواست واقعی ارسال نشد. کد آداپتور خوانده نشد (فقط فهرست فایل‌ها و توضیحات `.env.example`) |
| **پخش ویدیو/زیرنویس بین‌الملل** | کد Range خوانده شد و درست به نظر می‌رسد، اما پخش واقعی آزمایش نشد |
| **آناتومی ۳بعدی** | ۷ مدل GLB و `AnatomyEngine.js` بررسی نشدند؛ تنها ۴ خط `console.log` در آن فایل دیده شد |
| **ایستر اگ (بازی)** | ۱۳ فایل و موتور بررسی نشدند |
| **`planningService.js` (۱٬۶۱۴ خط)** | فقط ۳۴ سنجهٔ تستش اجرا شد؛ کد خوانده نشد |
| **`mediaStore.js` (۳٬۵۴۰ خط)** | فقط فهرست توابع import شده دیده شد؛ منطق گردش کار بررسی نشد |
| **`analyticsEngine.js` (۱٬۳۰۵ خط) + `analyticsInsights.js` (۳۴ KB)** | فقط فهرست بخش‌ها (`ANALYTICS_ROUTES`) دیده شد؛ صحت محاسبات بررسی نشد |
| **همهٔ ۳۰۲ کامپوننت JSX** | فقط ~۲۵ کامپوننت بزرگ خوانده شد. رفتار UI تعاملی بررسی نشد |
| **`RichTextEditor.jsx` (۱٬۱۷۹ خط)** | دو نقطهٔ `element.innerHTML = …` دیده شد (خطوط ۵۱۱ و ۵۷۰ برای history) اما امنیت آن‌ها بررسی نشد |

## ۴۹.۲ پیکربندی Production — در دسترس نبود

| مورد | چرا |
|---|---|
| **`.env` واقعی** | وجود ندارد. بنابراین نمی‌دانم کدام متغیرها در پروداکشن تنظیم می‌شوند |
| **دامنهٔ واقعی سایت** | `PUBLIC_SITE_URL` در `.env.example` مقدار نمونه `https://tapesh.ir` دارد؛ دامنهٔ واقعی تأیید نشد |
| **پیکربندی پروکسی/CDN/SSL** | هیچ config nginx/Caddy/Cloudflare در repo نیست. کد از هدرهای `x-forwarded-*` پشتیبانی می‌کند اما پیکربندی واقعی نامعلوم است |
| **`NODE_ENV` در استقرار** | نامعلوم — و این تعیین می‌کند کوکی `Secure` بگیرد یا نه |
| **آیا `npm run build` هرگز در استقرار اجرا می‌شود؟** | `dist/` تاریخ ۱۸ سپتامبر دارد در حالی که سورس تا ۲۹ سپتامبر تغییر کرده. **نمی‌دانم استقرار چطور انجام می‌شود** |

## ۴۹.۳ داده‌های واقعی — در دسترس نبود

| مورد | چرا |
|---|---|
| **حجم واقعی ترافیک** | `events.json` (۱٬۳۵۴ KB) و `activity.json` (۱۸۸ KB) دیده شد اما تحلیل نشد. تعداد کاربران واقعی: `users.json` فقط **۱ کاربر** دارد |
| **آیا محتوای CMS واقعی است یا نمونه؟** | `articles.json` (۶۲ KB)، `microCourses.json` (۸۵۰ KB)، `comprehensiveCourses.json` (۲۰۶ KB) — **محتوا خوانده نشد**؛ نمی‌دانم تولیدی است یا seed |
| **کیفیت دادهٔ بانک تست** | ۵۹ سؤال در `testBankQuestions.json` — تنها شکل رکورد بررسی شد، محتوا نه |
| **`database/users.json` کامل** | فقط ۴۰ خط اول خوانده شد (۱ کاربر). نمی‌دانم دادهٔ واقعی چند کاربر در نسخه‌های دیگر دارد |
| **توکن‌های واقعی انتشار** | `publishing.secrets.json` (۲۴۵ بایت) **باز نشد** — طبق Rule 8. نمی‌دانم چند کانال ثبت شده |
| **کلیدهای `media.secrets.json`** | وجود فایل تأیید نشد (فقط در `.gitignore` و `vite.config.js` ذکر شده) |

## ۴۹.۴ سرویس‌های بیرونی — در دسترس نبود

| مورد | چرا |
|---|---|
| GA4 / Search Console / PageSpeed | متغیرها تنظیم نیستند ⇒ همه `connected: false` |
| درگاه پرداخت | **هیچ کد مصرف‌کننده‌ای پیدا نشد.** `PAYMENT_*` فقط در `.env.example` مستند است |
| سرویس مانیتورینگ | `MONITORING_*` مستند است؛ مصرف‌کننده تأیید نشد |
| LLM | `LLM_API_KEY`/`LLM_MODEL` مستند است؛ `src/services/ai/` **شبیه‌ساز** دارد نه اتصال واقعی |
| رفتار APIهای بله/تلگرام/ایتا | بررسی نشد |
| Instagram Graph API | نسخهٔ `v21.0` در `.env.example` — تاریخ انقضای نسخه بررسی نشد |

## ۴۹.۵ امنیت — بررسی نشد

| مورد | چرا |
|---|---|
| **`npm audit` / آسیب‌پذیری dependencyها** | اجرا نشد. کل dependencyها ۶ عدد است، اما CVEهای `three@0.186` و `vite@7` بررسی نشد |
| **SSRF در آداپتورهای انتشار** | کد آداپتورها خوانده نشد. اگر آدرس پایه از پنل قابل تنظیم باشد، SSRF داخلی ممکن است |
| **امنیت `RichTextEditor.jsx`** | دو `innerHTML = ` دیده شد؛ منبع داده بررسی نشد |
| **پاک‌سازی در ۳ نقطهٔ `dangerouslySetInnerHTML`** | `ContentBlocks.jsx:111`, `MicroBlocks.jsx:410`, `ArticlePage.jsx:772` — **تأیید نشد** که داده پیش از رسیدن پاک شده است |
| **آیا `sanitizeHtml` در مسیر نوشتن اعمال می‌شود یا فقط نمایش؟** | `createArticle`/`updateArticle` فراخوانی `sanitizeHtml` را بررسی نکردم |
| **هدرهای امنیتی در پروداکشن** | فقط `X-Content-Type-Options` و `Referrer-Policy` در کد دیده شد. ممکن است پروکسی هدرهای بیشتری اضافه کند |
| **امنیت فایل‌سیستم** | مجوز `0600` برای `publishing.secrets.json` تأیید شد؛ سایر فایل‌ها بررسی نشد |
| **تست نفوذ** | انجام نشد |

## ۴۹.۶ سایر

| مورد | چرا |
|---|---|
| **پوشش تست (coverage)** | هیچ ابزار coverage نصب/اجرا نشد |
| **Graph dependency کامل** | بدون اجرای تحلیل‌گر، فقط روابط مهم بررسی شد. **Circular dependency تأیید نشد** |
| **Dependencyهای unused** | import هر بستهٔ npm در سورس بررسی نشد |
| **`README.md` کامل** | ۳۰۰ خط از ۱٬۳۴۶ خوانده شد (بخش‌های ۱–۵ + ۱۵). بخش‌های ۶–۱۴ (لایه‌های داشبورد، دیزاین سیستم، تله‌ها) **کامل خوانده نشد** |
| **۲۳ README زیرلایه** | فقط `src/router/README.md` و بخش‌هایی از `admin/README.md` خوانده شد |
| **`docs/security/coordinated-exams-security-report.md`** | فقط سرفصل‌ها خوانده شد (۳۲ KB کامل نه) |
| **`analyticsEngine.js` + `analyticsInsights.js`** | صحت فرمول‌های تحلیل بررسی نشد |
| **آیا ۵ فونت بی‌ارجاع حذف شوند؟** | ۴ فونت (Doran-Thin/Light/ExtraBlack, Pinar-FD-VF) در working tree حذف شده‌اند اما **تصمیم نهایی با کاربر است** — طبق حافظهٔ کاربر این یک «معلومِ باز» است |
| **`GameEngine.js` در برابر `GameEngine.jsx`** | حافظهٔ کاربر به فایل‌های نیمه‌کارهٔ هر دو اشاره می‌کند؛ در working tree فقط `.jsx` (۸۵۵ خط) دیده شد |

---

# Self-Check نهایی

> ### 🔄 بازنگری ۳ (~۲۰:۴۵) — چه سنجیدم و چه نسنجیدم
>
> **سنجیده‌شده (اجرای واقعی در همین نوبت):**
>
> | گام | فرمان | نتیجه |
> |---|---|---|
> | ۳۶ گام دروازه | شمارش `scripts/verify-all.mjs` | ✅ **۳۶** |
> | هدرهای امنیتی (واحد) | `--test database/securityHeaders.test.mjs` | ✅ ۹/۹ · exit 0 |
> | هدرهای امنیتی (یکپارچه) | `--test database/securityHeaders.integration.test.mjs` | ✅ ۱/۱ · exit 0 |
> | credential مدیر | `--test database/adminCredentialPolicy.test.mjs` | ✅ ۹/۹ · exit 0 |
> | هم‌زمانی | `--test database/concurrency.test.mjs` | ✅ ۸/۸ · exit 0 |
> | مهاجرت | `--test database/migrations/migration.test.mjs` | ✅ ۷/۷ · exit 0 |
> | قرارداد API | `scripts/api-contract.mjs --check` | ✅ ۰ نقض · ۱۳۴/۱۳۴ قرارداد ورودی |
> | رجیستری قرارداد | `scripts/generate-route-contracts.mjs --check` | ✅ هم‌گام |
> | خودآزمون API | `scripts/api-input-audit.mjs --selftest` | ✅ سبز |
> | یکپارچگی داده | `scripts/data-integrity.mjs` | ✅ ۰ خطا · ۲۲ هشدار · ۱۵۵۵ رکورد |
> | مهاجرت روی دادهٔ واقعی | `scripts/data-migrate.mjs --dry-run` | ✅ ۰ تغییر · ۰ شکست |
> | بودجهٔ باندل | `scripts/bundle-budget.mjs` | ✅ ۸ سقف · ۰ نقض |
> | **بهداشت مخزن** | `scripts/repo-hygiene.mjs` | ❌ **۱ نقض · exit 1** |
> | **اعتبارسنجی SEO** | `scripts/seo-validate.mjs` | ❌ **۲ یافته · exit 1** |
> | بار اولیه | خواندن `dist/index.html` + `stat -f%z` | ✅ **۳٬۴۱۵٬۱۶۳ B** |
> | ردیابی گیت | `git ls-files` · `git log` | ✅ ۵۰ کامیت · ۸ مسیر تغییر‌یافته · ۰ دادهٔ زمان‌اجرا |
>
> **نسنجیده (صریح):** اجرای کامل `verify:all` (شامل `build:check` که `dist/` را بازسازی می‌کند) · E2E مرورگری · load test · Core Web Vitals · `npm ci` تمیز · OAuth/Publisher/Payment واقعی · هارنس‌های `verify-render`/`theme-contrast`/`tailwind-probe`.
>
> **روش:** هر ردیف «FIXED» دست‌کم یک شاهد اجرایی دارد. سه مغایرت با گزارش Remediation **پیدا و مستند شد** — نه نادیده گرفته شد. هیچ موردی بر پایهٔ حدس علامت‌گذاری نشد.

> **🔄 بازنگری ۲ (۱ اکتبر ۲۰۲۶) — بندهای زیر با اجرای واقعی اصلاح شد:**
>
> | ادعای پایه | تصحیح بازنگری ۲ |
> |---|---|
> | «تست‌های سرور اجرا نشدند» | ✅ **اجرا شدند** — `auth:test` ۷۸/۷۸ · `bank:test` ۴۰/۴۰ · `exam:test` ۲۷/۲۷ · `admin:test` ۹۲/۹۲ · `admin:rbac:test` ۶۴/۶۴ · `admin:security:test` ۶۰/۶۰ · `data:test` ۲۵۴/۲۵۴ · `xss:test` ۱۴/۱۴ |
> | «`npm audit` اجرا نشد» | ✅ **اجرا شد — ۰ آسیب‌پذیری** در ۲۰۹ وابستگی |
> | «هارنس‌های تم و رندر اجرا نشدند» | ⚪ **همچنان اجرا نشدند** (فقط `verify-render`/`theme-contrast`/`tailwind-probe`) |
> | «۲ هارنس واقعاً اجرا شد» | ✅ **۲۶ گام دروازه اجرا شد** (`verify:all` — ۲۶/۲۶ سبز · exit 0 · ۴۲۶٫۷s) |
> | «۴۰ فایل `database/`» | ✅ الان **۶۵ فایل** (۳۷٬۵۴۹ خط) |
> | «۳ فایل `*.test.mjs`» | ✅ الان **۱۶ فایل** |
> | «۲۱۲ مسیر» | ✅ الان **۲۲۹ مسیر** با سند ماشین‌خوان و ۰ نقض |
> | «۳۵ تغییر uncommitted» | 🔴 الان **۱۷۲** |
> | «Core Web Vitals `UNVERIFIED`» | ⚪ **همچنان `UNVERIFIED`** |
> | «E2E مرورگری ندارد» | ⚪ **همچنان ندارد** |
>
> **روش تأیید این بازنگری:** هر ردیف «FIXED» دست‌کم یک شاهد اجرایی دارد — اجرای مستقیم تست، یا اجرای اسکریپت، یا خواندن کد با شماره خط. هیچ موردی بر پایهٔ حدس یا «احتمالاً» علامت‌گذاری نشد.

| پرسش | پاسخ |
|---|---|
| آیا کل Repository بررسی شد؟ | ⚠️ **بخشی.** ساختار کامل (درخت، اندازه‌ها، شمارش‌ها) پوشش داده شد. **سورس کامل خوانده نشد** — از ۵۰۰ فایل `src/` حدود ۲۵ فایل و از ۴۰ فایل `database/` حدود ۱۲ فایل. جزئیات در بخش ۴۹ |
| آیا Frontend بررسی شد؟ | ✅ **بله** — ساختار ۳۰۲ JSX، بزرگ‌ترین کامپوننت‌ها، lazy loading، روتر، a11y (شمارش `aria-*`/`alt`/`tabIndex`)، responsive (شمارش media query)، localStorage، CSS، باندل |
| آیا Backend بررسی شد؟ | ✅ **بله** — `server.js` کامل، `adminApi.js` (خط لولهٔ امنیتی + فهرست کامل ۲۱۲ مسیر)، `usersApi.js` کامل، `contentStore.js` (RBAC + نشست + احراز هویت)، `userSessions.js` کامل، `usersStore.js` کامل، `uploadsFile.js` کامل، `sanitizeHtml.js` کامل، `googleAuth.js` (۱۲۰ خط)، `examApi.js` (۱۲۰ خط) |
| آیا Database بررسی شد؟ | ✅ **بله** — ۳۶ مجموعه، اندازه‌ها، شکل رکوردهای `testBankQuestions`/`microCourses`، مقایسه با `examQuestions`، بررسی schema/relations/indexes/race condition |
| آیا APIها بررسی شدند؟ | ✅ **بله** — شمارش کامل (۲۱۲+۱۱+۲۰+۶+۴)، فهرست همهٔ ۲۱۲ مسیر پنل با Permission، جدول تفصیلی برای گروه‌های حساس، چک‌لیست ۱۷ موردی امنیت API |
| آیا Authentication بررسی شد؟ | ✅ **بله** — هر دو سیستم (مدیر/کاربر) + گوگل، با شماره خط. شامل `hashPassword`/`verifyPassword` و تحلیل `createUserSession`/`getUserSession` |
| آیا Authorization بررسی شد؟ | ✅ **بله** — ۷۴ Permission، ۳ نقش، `SENSITIVE_ANALYTICS`، خط لولهٔ per-route، بررسی ۸ سناریوی سوءاستفادهٔ ادمین |
| آیا Security بررسی شد؟ | ✅ **بله** — ۷ دسته (Input/Auth/Authorization/Application/Secret/Dependency/Data)، جدول ۲۰ آسیب‌پذیری با Severity، Attack Surface Map |
| آیا Admin بررسی شد؟ | ✅ **بله** — ۱۴ محور پنل + جدول «چه کاری ادمین می‌کند که نباید» |
| آیا Performance بررسی شد؟ | ✅ **بله** — اندازه‌گیری‌های واقعی (باندل، دارایی، دیسک) + ۱۰ hotspot با شواهد + Core Web Vitals با برچسب `UNVERIFIED` |
| آیا Tests بررسی شدند؟ | ✅ **بله** — ۳ فایل `*.test.mjs` + ۷ هارنس اسکریپتی، ۲ هارنس **واقعاً اجرا شد** (۲۲/۲۲ و ۳۴/۰)، تفکیک ۷ نوع تست، پوشش موضوعی |
| آیا Dependencies بررسی شدند؟ | ⚠️ **بخشی.** `package.json` کامل (۱۱ بسته) + نقش هر کدام. **`npm audit` اجرا نشد** و import هر بسته بررسی نشد |
| آیا Environment Variables بررسی شدند؟ | ✅ **بله** — جدول کامل ۲۳ متغیر با Used Where/Secret/Required/Client Exposed + تأیید اینکه هیچ `VITE_*` وجود ندارد |
| آیا Git History تا حد امکان بررسی شد؟ | ✅ **بله** — ۴۰ کامیت، شاخه‌ها، ۳۵ تغییر uncommitted، بزرگ‌ترین blobs با `git cat-file --batch-check`، `users.json` در تاریخچه، `publishing.secrets.json` **نیست**، `.gitignore` |
| آیا نقاط ناشناخته مشخص شدند؟ | ✅ **بله — بخش ۴۹ با ۶ دسته و ۳۵+ مورد** |
| آیا تمام ادعاهای مهم دارای Evidence هستند؟ | ✅ **بله** — هر ادعا با مسیر فایل + شماره خط یا با اندازه‌گیری واقعی یا با نقل مستقیم از README. هر ادعای بدون شاهد با `UNVERIFIED` علامت‌گذاری شده |

---

## پیوست — اعداد کلیدی این ممیزی

> **🔄 ستون‌ها:** «بازنگری ۳» = وضعیت فعلی (~۲۰:۴۵) · «بازنگری ۲» = ~۱۶:۳۰ · «پایه» = ۲۹ سپتامبر.

| سنجه | بازنگری ۳ (فعلی) | بازنگری ۲ | پایه (۲۹ سپتامبر) |
|---|---|---|---|
| کل خطوط سورس (`src` + `database` + `scripts`) | **۲۱۶٬۸۴۵** | ۲۱۳٬۹۰۹ | ۲۴۳٬۶۰۱ |
| `src/` (JS/JSX) | **۱۶۸٬۵۷۷ خط** · ۳۰۳ JSX + ۱۲۳ JS | ۱۶۸٬۳۳۵ · ۳۰۲ + ۱۲۳ | ۱۶۸٬۴۰۶ · ۳۰۲ + ۱۲۴ |
| `src/` (CSS) | **۵۰٬۰۰۸ خط · ۵۵ فایل** (بدون تغییر) | همان | همان |
| `database/` | **۳۹٬۳۵۰ خط · ۷۸ فایل** | ۳۷٬۵۴۹ · ۶۵ | ۲۱٬۸۳۸ · ۴۰ |
| `scripts/` | **۸٬۹۱۸ خط · ۳۶ فایل** | ۸٬۰۲۵ · ۳۰ | ۳٬۳۴۹ · ۱۴ |
| `docs/` | **۲۳ سند** | ۲۲ | ۱ |
| مسیرهای API | **۲۲۹** (۱۸۶+۱۵+۱۶+۸+۴) | ۲۲۹ | ۲۵۳ (۲۱۲+۱۱+۲۰+۶+۴) |
| مسیرهای نوشتن | **۱۳۴** · **۱۳۴ با قرارداد ورودی** · ۰ بدون قرارداد | ۱۳۴ · ۰ قرارداد | — |
| کد خطای مدل | **۲۸** در مدل · **۲۸ مصرف‌شده** · ۰ خارج از مدل | ۲۸ · ۲۲ | — |
| DTO عمومی | **۱۱** · ۰ مسیر عمومی بدون DTO | ۱۱ | — |
| Permission / Role | **۸۰ / ۳** | ۸۰ | ۷۴ / ۳ |
| مجموعه‌های JSON | **۳۳** | ۳۳ | ۳۶ · ۳٫۵ MB |
| فایل تست | **۲۱** `database/*.test.mjs` + **۵** `scripts/*test*.mjs` | ۱۶ + ۵ | ۳ + ۷ هارنس |
| گام‌های دروازهٔ کیفیت | **۳۶** ⚠️ (۳۵ سبز · `repo:hygiene` قرمز) | ۲۶ (۲۶/۲۶ سبز) | ~۱۰ |
| **بار اولیه JS+CSS** | **۳٫۲۶ MB** (۳٬۴۱۵٬۱۶۳ B) — شامل ۱MB پنل ادمین با `modulepreload` | — | ۴٫۴۱ MB JS تک‌فایل |
| باندل کل | **۵٫۷۴ MB JS در ۱۹ chunk** + **۹۳۲ KB CSS در ۱۰ chunk** | همان | ۴٫۴۱ MB + ۷۷۲ KB |
| `dist/` کل | **۲۰۱ MB** · ⚠️ **بدون `robots.txt`/`sitemap.xml`** | ۲۰۰٫۸۹ MB | ۴۱ MB |
| دارایی استاتیک | `public/` **۱۶۲ MB** · `images/` **۳۸ MB** | همان | ۱۶۱ · ۳۸ |
| `.git` | **۲۱۷ MB** · **۵۰ کامیت** | ۲۱۹ MB · ۴۰ | ۲۱۹ MB · ۴۰ |
| پروژه | **۸۲۷ MB** | ۷۹۳ MB | ۵۴۲ MB |
| `node_modules` | **۱۸۴ MB** | ۱۴۸ MB | ۶۵ MB |
| **مسیرهای تغییر‌یافته** | ✅ **۸** | ۱۷۲ | ~۳۵ |
| سنجه‌های تست | **≈۹۶۰ شمارش‌شده** (۲۱+۵ سوییت) · **+۳۴ تازه** | ۹۴۸ در ۱۸ سوییت | **۵۶ — همه سبز** |
| `data:check` | ۰ خطا · ۲۲ هشدار · **۱۵۵۵ رکورد** | ۱۵۴۹ | (اجرا نشده) |
| مهاجرت معلق | ✅ **۰ تغییر · ۰ شکست** | — | — |
| README | ۱۲۵٬۵۶۶ بایت / ۱٬۳۴۶ خط + ۱۹ README زیرلایه | همان | همان |
| آسیب‌پذیری‌های پایه | **۱۱ FIXED · ۵ PARTIAL · ۹ OPEN** | همان | ۲۰ (۲C · ۵H · ۹M · ۴L) |
| `TODO` در `src/` | **۲ فایل** | ۲ | ۶ |
| `eslint-disable` | **۳۰ فایل** | ۳۰ | ۳۲ |
| `.workbuddy-ai/` tracked | ⚠️ **۱۸ فایل** (حافظه + اسکرین‌شات) | — | — |
| `eslint-disable` | **۳۰ فایل** | ۳۲ |
