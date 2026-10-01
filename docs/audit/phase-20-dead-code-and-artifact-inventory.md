# Phase 20.1 / 20.2 — Dead Code و Artifact Inventory

> **وضعیت سند:** `IMPLEMENTED` (شناسایی انجام شد؛ **هیچ حذفی اجرا نشد**)
> **تاریخ:** ۲۰۲۶-۱۰-۰۱ · **commit مبنا:** `a86d875`
> **ابزارهای مولد شواهد:** `scripts/repo-hygiene.mjs` · `git cat-file` ·
> `git log -- <path>` · گراف ارجاع متنی روی `src/`
>
> **هشدار محدوده:** Phase 20 در `MASTER-AUDIT-2026-09-29.md` تعریف رسمی ندارد.
> این سند scope **پیشنهادی** است. قاعدهٔ حاکم: **ابتدا quarantine/deprecate،
> سپس حذف** — و هیچ حذفی بدون تأیید صریح انجام نشد.

---

## ۱. فایل‌های `src/` بدون هیچ ارجاع (۸ فایل)

روش: گراف ارجاع متنی روی ۴۸۰ فایل `src/**` (شامل `.js`/`.jsx`/`.css`)، و
سپس **جست‌وجوی نام برای import دینامیک** (`import(...)`, `lazy(...)`, رشتهٔ
مسیر) تا «فقط dynamic import دارد» رد شود.

| # | فایل | ارجاع متنی | import دینامیک | حکم |
|---|---|---|---|---|
| ۱ | `src/layout/admin/views/AdminArticles.jsx` | فقط `src/layout/admin/README.md` | **ندارد** | **dead (کاندید quarantine)** |
| ۲ | `src/layout/admin/views/AdminBanners.jsx` | فقط `README.md` | **ندارد** | **dead** |
| ۳ | `src/layout/admin/views/AdminCategories.jsx` | فقط `README.md` | **ندارد** | **dead** |
| ۴ | `src/layout/dashboard/ai/AIPopup.jsx` | فقط `src/layout/dashboard/ai/README.md` | **ندارد** | **dead** |
| ۵ | `src/layout/products/ProductStickyShowcase.jsx` | **هیچ** | **ندارد** | **dead** |
| ۶ | `src/layout/products/visuals/KnowledgeGraphPreview.jsx` | **هیچ** | **ندارد** | **dead** |
| ۷ | `src/layout/products/visuals/ReaderPreview.jsx` | **هیچ** | **ندارد** | **dead** |
| ۸ | `src/layout/products/visuals/WikiPreview.jsx` | **هیچ** | **ندارد** | **dead** |

**نکتهٔ مهم:** مورد ۱–۴ **در README خودشان مستند شده‌اند**. یعنی احتمالاً
«پیاده‌سازی‌شده اما سیم‌کشی‌نشده»اند، نه «مرده». تفاوت عملی: پیش از حذف باید
تصمیم محصول گرفته شود (سیم‌کشی یا حذف). **حذف نشدند.**

**هیچ فایل حساسی در این فهرست نیست** (`database/*.js` · routeها · publisherها ·
auth/session · `src/router/`) ⇒ حذف این‌ها breaking change نمی‌سازد، ولی طبق
قاعدهٔ «quarantine سپس حذف» به تأیید نیاز دارد.

---

## ۲. ماژول مردهٔ تأییدشده

| ماژول | شاهد | حکم |
|---|---|---|
| `src/services/analytics/mockData.js` | تنها export آن `generateMockHistory` است (خط ۲۸۴). جست‌وجو در `src/`، `server.js` و `database/` ⇒ **فقط تعریف، صفر مصرف‌کننده**. خودِ `analyticsService.js` منبع داده‌اش `testBank/mockData` + `testBankService` + `microProgress` + `analyticsEngine` است، **نه** این فایل. | **dead — تأییدشده** |

این مورد توسط `scripts/data-sources.mjs` هم مستقلاً تأیید شده است.

---

## ۳. متغیرهای محیطی بدون مصرف‌کنندهٔ واقعی

`.env.example` شامل **۳۶ کلید** است. ۳۱ کلید در کد ارجاع دارند.

| کلید | وضعیت | یادداشت |
|---|---|---|
| `INSTAGRAM_APP_ID` | **بدون مصرف‌کننده** | adapter فقط `INSTAGRAM_ACCESS_TOKEN` و `INSTAGRAM_GRAPH_BASE` را می‌خواند |
| `INSTAGRAM_APP_SECRET` | **بدون مصرف‌کننده** | همان |
| `EITAA_BOT_TOKEN` | **فقط اعلام‌شده** | `publishers/eitaa.js:398` آن را به‌عنوان `tokenEnv` اعلام می‌کند ولی توکن per-channel از پنل مقدم است |

### ۳.۱ «تنظیم‌شده اما بی‌مصرف» — مصرف‌کنندهٔ واقعی صفر

این‌ها **در کد خوانده می‌شوند** ولی تنها از طریق `configured()` در
`analyticsStore.js` — یعنی فقط **وجود** کلید برای نمایش «وصل/قطع» در پنل
سنجیده می‌شود و **هیچ درخواست شبکه‌ای** به سرویس بیرونی زده نمی‌شود:

| کلیدها | مصرف‌کنندهٔ کد | حکم |
|---|---|---|
| `LLM_API_KEY` · `LLM_MODEL` | `analyticsInsights.js:674` (`requires`) · `analyticsStore.js:641` | **`CONFIGURED BUT UNUSED`** |
| `PAYMENT_PROVIDER` · `PAYMENT_API_KEY` | `analyticsStore.js:633` | **`CONFIGURED BUT UNUSED`** |
| `GA_PROPERTY_ID` · `GA_CLIENT_EMAIL` · `GA_PRIVATE_KEY` | `analyticsStore.js:609` | **`CONFIGURED BUT UNUSED`** |
| `GSC_SITE_URL` | `analyticsStore.js:617` | **`CONFIGURED BUT UNUSED`** |
| `PAGESPEED_API_KEY` | `analyticsStore.js` | **`CONFIGURED BUT UNUSED`** |
| `MONITORING_API_URL` · `MONITORING_API_KEY` | `analyticsStore.js:650` | **`CONFIGURED BUT UNUSED`** |
| `ALERT_WEBHOOK_URL` · `ALERT_TELEGRAM_TOKEN` · `ALERT_TELEGRAM_CHAT` | `analyticsStore.js:658` | **`CONFIGURED BUT UNUSED`** |

**تصمیم پیشنهادی:** نگهداری با برچسب صریح `planned, not implemented` در
`.env.example` — نه حذف (بخشی از نقشهٔ راه تحلیل است) و نه ادعای فعال بودن.

---

## ۴. وابستگی‌های بلااستفاده

**هیچ‌کدام بلااستفاده نیستند.** هر ۵ وابستگی توسعه با `scripts/anatomy/build-anatomy-models.mjs`
(خط ۱۳–۱۸) مصرف می‌شوند:

| پکیج | مصرف‌کننده |
|---|---|
| `fbx2gltf` | `scripts/anatomy/build-anatomy-models.mjs:13` |
| `@gltf-transform/core` | `:15` |
| `@gltf-transform/extensions` | `:16` |
| `@gltf-transform/functions` | `:17` |
| `meshoptimizer` | `:18` |

**حذف نشد** (قاعدهٔ «dependency را فقط پس از package graph و build verification حذف کن»).
نکته: این پنج پکیج در `node_modules` **بدون `package.json`** نصب شده‌اند (۱۹ پکیج
در کل) ⇒ `build-anatomy-models.mjs` در محیط فعلی قابل اجرا نیست. وضعیت:
`BLOCKED BY ENVIRONMENT` — این اسکریپت در build شرکت نمی‌کند (خروجی `.glb` از قبل
در `public/anatomy/models/` موجود است) پس build را مسدود نمی‌کند.

---

## ۵. Asset بدون reference و مصنوعات حجیم

`repo:hygiene` روی **۷۲۵ فایل tracked** اجرا شد.

### ۵.۱ فایل‌های حجیم tracked (۱۳ · آستانه ۲MB)

| فایل | حجم | حکم |
|---|---|---|
| `public/uploads/intl/mujqoxfn-5655345c4baa.mp4` | **۳۹٫۰MB** | **دادهٔ زمان‌اجرای آپلودی در گیت** — باید از ردیابی خارج شود |
| `public/anatomy/models/nervous.glb` | ۲۷٫۵MB | دارایی مشروع (LOD/فشرده‌سازی شود) |
| `public/anatomy/models/cardio.glb` | ۲۰٫۸MB | همان |
| `public/anatomy/models/skeletal.glb` | ۲۰٫۵MB | همان |
| `public/anatomy/models/muscular.glb` | ۱۸٫۵MB | همان |
| `public/anatomy/models/visceral.glb` | ۹٫۰MB | همان |
| `public/anatomy/models/joints.glb` | ۵٫۳MB | همان |
| `public/uploads/mujzxvwd-c216e68df06b.png` | ۲٫۹MB | آپلود زمان‌اجرا |
| `public/uploads/mujzxu8z-d105a2abc606.png` | ۲٫۹MB | آپلود زمان‌اجرا |
| `public/anatomy/models/regions.glb` | ۲٫۷MB | دارایی مشروع |
| `images/pictures/Asset 7.webp` | ۲٫۴MB | تصویر بدون بهینه‌سازی |
| `src/services/wiki/mockData.js` | ۲٫۲MB | **دادهٔ کلاینت‌محور بدون بک‌اند** |
| `public/uploads/mujzxujh-f1eca2158b03.png` | ۲٫۱MB | آپلود زمان‌اجرا |

### ۵.۲ فایل‌های حجیم در **تاریخچهٔ گیت** (`.git` = ۲۱۹MB)

| مسیر | حجم blob | وضعیت |
|---|---|---|
| `.app.out.mjs` | **۴۷MB** | زائد probe — الان در `.gitignore` (`*.out.mjs`) ولی در تاریخچه |
| `public/uploads/intl/mujqoxfn-*.mp4` | **۴۱MB** | ویدیوی آپلودی در تاریخچه |
| `public/anatomy/models/nervous.glb` | ۲۷٫۵MB | دارایی مشروع |

### ۵.۳ دادهٔ زمان‌اجرای tracked (۵ فایل)

`activity.json` ۱۸۴KB (شامل **IP + User-Agent**) · `mediaMetrics.json` ۲۹۴KB ·
`publishLog.json` ۲۲KB · `admins.json` ۱KB (**هش رمز**) · `events.json` ۰KB.

---

## ۶. اسکریپت‌ها و مستندات

- **هیچ اسکریپت npm بی‌استفاده‌ای یافت نشد.** ۳۹ اسکریپت `package.json` همه به
  فایل موجود اشاره می‌کنند.
- **مستندات خلاف implementation (۱ مورد تأییدشده):** ادعای ممیزی دربارهٔ
  وجود `src/services/references/mockData.js` **نادرست** است — چنین فایلی وجود
  ندارد؛ تنها فایل آن پوشه `referenceCatalog.js` است (شاهد: `ls src/services/references/`).
  خودِ این سند تصحیح است.

---

## ۷. `.gitignore` — چه چیزی اضافه شد و چه چیزی **نشد**

**اضافه شد** (PHASE 20.2): `database/content/{activity,admins,events,publishLog,mediaMetrics}.json`
به‌عنوان دادهٔ زمان‌اجرا.

**⚠️ محدودیت مهم:** `.gitignore` فقط **فایل‌های تازه** را می‌بندد. این پنج فایل
**از قبل tracked** هستند، پس همچنان در `git status` و در commitهای بعدی حاضرند.
برای خارج‌کردنشان لازم است:

```bash
git rm --cached database/content/activity.json database/content/admins.json \
                database/content/events.json database/content/publishLog.json \
                database/content/mediaMetrics.json
```

**اجرا نشد** — چون ایندکس را در درخت کاری با ۱۵۹ تغییر uncommitted تغییر
می‌دهد و نیازمند تأیید صریح است.

**اقدام انجام‌شدهٔ جایگزین:** دروازهٔ `scripts/repo-hygiene.mjs` (+ `repo:hygiene`)
ساخته شد که همین پنج فایل را در هر اجرا به‌عنوان نقض گزارش می‌کند (کد خروج ۱)
⇒ می‌توان آن را به pre-commit یا CI سوار کرد تا وضعیت **قابل‌مشاهده** بماند.
