# گزارش اجرای Phase ۱۱–۱۴ پیشنهادی — تپش وب

> تاریخ اجرا: ۱ اکتبر ۲۰۲۶ · مخزن: `/Users/heidarian/Documents/my own project/tapeshweb` · HEAD: `a86d875`
> این سند **roadmap رسمی پروژه نیست**. تقسیم‌بندی ۱۱–۱۴ همان تقسیم‌بندی پیشنهادی کار است و در `docs/audit/MASTER-AUDIT-2026-09-29.md` تعریف رسمی ندارد.
> هیچ ادعای audit یا README جایگزین اجرای واقعی نشده است؛ هر گزاره با کد، تست یا اجرا برچسب خورده است.

---

## ۱) وضعیت کلی

| فاز | وضعیت | یک‌خطی |
|---|---|---|
| Phase 11 (persistence/schema/integrity/migration) | **PARTIALLY VERIFIED** | نوشتن اتمیک انبار محتوا پیاده و با تست اثبات شد؛ migration اجرا نشد؛ PostgreSQL تلاش نشد |
| Phase 12 (API contract/امنیت/domain) | **PARTIALLY VERIFIED** | لایهٔ قرارداد و ۳۱ سنجه سبز؛ اما دروازهٔ اعتبارسنجی روی ۰ از ۱۱۷ مسیر نوشتن سیم‌کشی نشده |
| Phase 13 (publishers/analytics/observability) | **UNVERIFIED** | هیچ credential یا محیط بیرونی در دسترس نبود؛ ارسال واقعی publisher آزمایش نشد |
| Phase 14 (deploy/backup/rollback/perf/a11y) | **BLOCKED (build)** | `npm run build` واقعاً اجرا شد و شکست خورد؛ smoke زمان اجرا اضافه و سبز شد؛ CI/staging/rollback وجود ندارد |

وضعیت کل مخزن: **۸۴۷ سنجهٔ موجود سبز** (pre/post تغییر)، به‌علاوهٔ **۲۳ سنجهٔ تازه** (۹ اتمیک + ۱۴ smoke).

---

## ۲) تغییرات انجام‌شده

### ۲٫۱ `database/contentStore.js` — نوشتن اتمیک (تنها تغییر رفتاری)

- **شرح:** تابع تازهٔ `writeJsonAtomic(file, value)` اضافه شد (`tmp` → `renameSync`) و `writeJson` از آن رد می‌شود. `renameSync` به importهای `node:fs` اضافه شد.
- **دلیل فنی (VERIFIED):** `writeJson` **تنها دروازهٔ نوشتن روی دیسک** برای ۳۳ مجموعهٔ `COLLECTIONS` + `settings` بود و فایل را **در جای خود** بازنویسی می‌کرد (`writeFileSync(path, …)`)، در حالی که چهار انبار دیگر همان پروژه از قبل اتمیک‌اند:
  `usersStore.js:143` · `examStore.js:61` · `userSessions.js:53` · `feedbackStore.js:61`.
  نتیجهٔ باگ: مرگ پروسه یا پر شدن دیسک وسط نوشتن ⇒ JSON بریده روی دیسک؛ `readJson` هم در `catch` بی‌صدا به fallback برمی‌گردد ⇒ **از دست رفتن داده بدون هیچ خطا**.
- **ریسک تحت‌تأثیر:** مسیر نوشتن محتوا (خودش). ریسک‌های بررسی‌شده و رد‌شده:
  - قالب خروجی: `JSON.stringify(value, null, 2)` بدون newline پایانی — عوض نشد (تست بیت‌به‌بیت).
  - مجوز فایل: همهٔ `database/content/*.json` برابر `-rw-r--r--` (۰۶۴۴) هستند ⇒ `rename` مجوز را عوض نمی‌کند (تست).
  - فایل‌های `*.secrets.json` (۰۶۰۰) **از این مسیر نمی‌گذرند** و دست نخورده‌اند.
  - ناظر مسیر نوشتن (`observeWrite`) سر جایش است؛ ترتیب «نوشتن، بعد observe» عوض نشد.
- **نکتهٔ سازگاری:** تست ساختاری `database/dataIntegrity.test.mjs:1077` بدنهٔ `writeJson` را با regex استخراج می‌کند؛ چون `writeJsonAtomic` در سطح ماژول و با `}` در ستون صفر بسته می‌شود، regex دست‌نخورده کار می‌کند (post-change: ۲۵۴/۲۵۴).

```js
function writeJsonAtomic(file, value) {
  ensureDir(dirname(file));
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  renameSync(tmp, file);
}

function writeJson(path, value) {
  ensureFile(path, Array.isArray(value) ? [] : {});
  writeJsonAtomic(path, value);
  observeWrite(collectionOfFile.get(path) ?? null, value);
}
```

### ۲٫۲ `database/contentStoreAtomicWrite.test.mjs` — تست تازه (۹ سنجه)

سه لایهٔ اثبات: **ساختاری** (مسیر `tmp`→`rename`، نبود `writeFileSync` روی مقصد)، **رفتاری** (قالب بیت‌به‌بیت، تغییر inode = اثبات `rename`، مجوز ۰۶۴۴، نبود `*.tmp`)، **تزریق خطا** (اشغال `${file}.tmp` با دایرکتوری ⇒ `EISDIR`؛ فایل مقصد باید بیت‌به‌بیت سالم بماند). هر تست روی دادهٔ واقعی، در `finally` بایت‌های اصلی را برمی‌گرداند.

### ۲٫۳ `scripts/server-smoke.mjs` — smoke زمان اجرا (۱۴ سنجه)

سرور را به‌عنوان پروسهٔ فرزند بالا می‌آورد و با کلاینت `node:http` (نه curl — به دلیل محدودیت محیط، بخش ۴) می‌سنجد: `/healthz` · `/readyz` · `/metrics` · مرزهای احراز هویت · هدر `X-Request-Id` · redaction لاگ.

### ۲٫۴ `package.json` — دو اسکریپت تازه

`content:atomic:test` · `smoke:test` (هر دو فقط `node`، بدون dependency تازه).

### ۲٫۵ `.workbuddy-ai/memory/MEMORY.md`

بازنویسی و فشرده‌سازی (۱۷٫۲KB ⇒ ~۷KB) با حفظ همهٔ ناوردایی‌های قفل‌شده؛ جزئیات روایی به لاگ‌های روزانه ارجاع داده شد.

**هیچ تغییر کاربر حذف یا بازنویسی نشد.** تنها بازگردانی انجام‌شده: `database/content/admins.json` که **خودِ اجرای baseline** آلوده کرده بود (بخش ۵).

---

## ۳) تست‌های اجراشده

روش اجرا: `npm run` روی این مک با `CODEBUDDY_BROKER_DENY` رد می‌شود، پس همه با مسیر مطلق `node` و ریدایرکت به فایل اجرا شدند (خروجی هر سوییت در `/tmp/tapesh-baseline-20261001/*.log`).

| command | exit | زمان | نتیجه |
|---|---|---|---|
| `node database/dataIntegrity.test.mjs` | 0 | ۳۱s | **۲۵۴/۲۵۴** |
| `node database/usersAuth.test.mjs` | 0 | ۱۴s | **۷۸ قبول · ۰ رد** |
| `node database/testBankSecurity.test.mjs` | 0 | ۱۸s | **۴۰/۴۰** |
| `node database/examApi.test.mjs` | 0 | ۴s | **۲۷/۲۷** |
| `node --test scripts/domain-tests.mjs` | 0 | ۱s | **pass ۲۲ · fail ۰** |
| `node scripts/planning-service-test.mjs` | 0 | ۵s | **۳۴ موفق · ۰ ناموفق** |
| `node --test database/apiContract.test.mjs` | 0 | ۹۶s | **pass ۳۱ · fail ۰** |
| `node --test database/observability.test.mjs` | 0 | ۹s | **pass ۱۷ · fail ۰** |
| `node scripts/router-test.mjs` | 0 | ۱s | **۱۲۸ قبول · ۰ رد** |
| `node database/adminApi.test.mjs` | 0 | ۴۴s | **۹۲/۹۲** |
| `node database/adminRbac.test.mjs` | 0 | ۳۵s | **۶۴/۶۴** |
| `node database/adminSecrets.test.mjs` | 0 | ۳۱s | **۶۰/۶۰** |
| `node scripts/data-integrity.mjs` | 0 | ۴s | **۰ خطا · ۲۲ هشدار · ۱۵۳۷ رکورد** |
| `node scripts/api-contract.mjs --check` | 0 | ۴s | **۲۲۹ مسیر · ۲۷ کد خطا · ۱۱ DTO · ۰ نقض** |
| `node scripts/api-input-audit.mjs` | 0 | ۱۱s | ۱۸۵ مسیر · ۱۱۷ نوشتن |
| `node scripts/api-input-audit.mjs --selftest` | 0 | ۱۰s | خودآزمون ابزار سبز |
| **`node --test database/contentStoreAtomicWrite.test.mjs`** (تازه) | 0 | ۵s | **pass ۹ · fail ۰** |
| **`node scripts/server-smoke.mjs`** (تازه) | 0 | ~۵s | **۱۴/۱۴ موفق** |
| **جهش عمدی روی `writeJson`** (تازه) | **1** | ۵s | **pass ۵ · fail ۴** ← اثبات حساسیت تست |

جمع سنجه‌های موجود: **۸۴۷** · تازه: **۲۳** · skipped: هیچ · failed در وضعیت نهایی: هیچ.

**آزمون حساسیت (اثبات اینکه تست واقعاً باگ را می‌گیرد):** `writeJsonAtomic(path, value)` با `writeFileSync(path, …)` جایگزین شد (برگرداندن به رفتار درجا). نتیجه: `exit=1` و ۴ شکست — «`writeJson` مستقیم روی مقصد نمی‌نویسد» · «قالب/inode/بدون tmp» · «settings از مسیر اتمیک» · «شکست نوشتن داده را خراب می‌کند». سپس فایل از کپی پشتیبان بازگردانده شد و `shasum -c` تأیید کرد.

---

## ۴) build و runtime

### build — **شکست واقعی (BLOCKED)**

```
$ node node_modules/vite/bin/vite.js build          → exit 1   (۱۸٫۷۸s)
vite v7.3.6 building client environment for production...
✓ 546 modules transformed.
✗ Build failed in 18.78s
[vite]: Rollup failed to resolve import "three" from
  ".../src/layout/dashboard/anatomy3d/engine/AnatomyEngine.js"
```

- **علت ریشه‌ای (VERIFIED):** `node_modules/three/` نصب ناقص است — `package.json` این پکیج **وجود ندارد** (`ls node_modules/three` ⇒ `LICENSE build examples src`). پس resolve نمی‌شود.
- **اثر روی `dist/`:** صفر. `shasum` فایل‌های `dist/index.html` و `dist/assets/index-CE3tjnht.js` پیش و پس از build **یکسان** است ⇒ شکست در فاز bundle است، نه فاز write.
- **تخریب محیطی تازه‌ای ایجاد نشد**؛ این نقص از قبل موجود بود. طبق قاعدهٔ پروژه `npm install` بدون درخواست اجرا نشد ⇒ رفع آن **UNVERIFIED** می‌ماند.

### وضعیت artifact (`npm run start`)

- `dist/assets/index-CE3tjnht.js` = **۴٬۴۱۰٬۷۲۱ بایت** · `dist/` = ۴۱MB · تاریخ هر دو: **۱۸ سپتامبر ۱۲:۲۴**.
- سورس تا **۱ اکتبر ۱۱:۱۵** تغییر کرده است ⇒ **artifact کهنه (VERIFIED)**. `npm run start` (که `server.js` ⇒ `dist/`) همان artifact ۱۳ روز پیش را سرو می‌کند.
- `dist/index.html` فقط `./assets/index-CE3tjnht.js` را صدا می‌زند و آن فایل موجود است ⇒ dist **ناسازگار نیست، کهنه است**.
- `/readyz` فقط وجود `dist/index.html` را می‌سنجد (`observability.js:234-242`) ⇒ نمی‌تواند کهنگی را تشخیص دهد. این یک **شکاف طراحی** است، تغییر داده نشد.

### server start / smoke — **سبز (VERIFIED)**

`node scripts/server-smoke.mjs` ⇒ **۱۴/۱۴**، `exit 0`:

| سنجه | نتیجه |
|---|---|
| بالا آمدن سرور + `/healthz` | ۲۰۰ · `{"status":"ok","uptimeSeconds":0}` |
| هدر `X-Request-Id` روی پاسخ | موجود |
| `/readyz` | ۲۰۰ · `{"ready":true,"checks":[data-writable ✓, build-artifact ✓, model-registry ✓]}` |
| `/metrics` بدون توکن / با توکن غلط / با توکن درست | **۴۰۴** / **۴۰۴** / **۲۰۰** |
| `/api/users/me` بی‌احراز هویت | **۴۰۱** |
| `/api/admin/stats` بی‌احراز هویت | **۴۰۱** |
| لاگ دسترسی: شمارهٔ تلفن در مسیر | لو نمی‌رود |
| لاگ دسترسی: خط JSON با `reqId` | ثبت می‌شود |

**محدودیت محیطی ثبت‌شده:** `curl` روی این مک از طریق proxy سندباکس می‌رود و به loopback نمی‌رسد (`upstream connect failed (os error 61)`)، حتی با `--noproxy '*'`. به همین دلیل smoke با کلاینت خودِ نود نوشته شد (تأیید شد که loopback نود کار می‌کند). **پورت/URL واقعی: `127.0.0.1:4700–4899` (پورت پویا) و `server.js` پیش‌فرض `4173`/`0.0.0.0`.**

---

## ۵) داده و migration

- **backup:** migration‌ای اجرا نشد ⇒ `data:backup` لازم نشد. (ابزار موجود است و فهرست را از Schema می‌خواند.)
- **dry-run:** `data:repair` **اجرا نشد** — طبق قاعدهٔ پروژه، تعمیر خودکار بدون تصمیم مالک داده ممنوع است.
- **migration:** اجرا نشد. `database/persistence/` وجود ندارد و ساخته نشد؛ PostgreSQL تلاش نشد ⇒ **UNVERIFIED**.
- **rollback test:** انجام نشد (چیزی برای rollback نبود).
- **دادهٔ نامعتبر/orphan:** `data:check` ⇒ **۰ خطا · ۲۲ هشدار · ۱۵۳۷ رکورد**، پیش و پس از تغییر یکسان. هشدارها همه از یک کلاس‌اند: `[activity] … userId: admins با شناسهٔ «adm-…» پیدا نشد (ارجاع نرم — تاریخی)`.
- **آلودگی داده توسط تست — شناسایی و بازگردانی شد:** `database/adminApi.test.mjs` در اجرای baseline فیلدهای `updatedAt`/`lastLoginAt` فایل `database/content/admins.json` را به `2026-10-01T07:43:28.924Z` تغییر داد. این فایل در `git status` ساعت ۱۱:۱۰ **تمیز** بود، پس با `git checkout --` به HEAD برگردانده شد و اکنون تمیز است. `database/content/activity.json` هم آلوده شده بود و از پشتیبان دقیق بازگردانده شد (تمیز).
- **فایل سرگردان ایجادشده توسط هارنس خودم:** در اسکریپت baseline یک برخورد نام بین پشتیبان دستی و مرحلهٔ بازگردانی باعث ساخته‌شدن `database/admins.json` در **ریشهٔ** `database/` شد (این فایل پیش از اجرا وجود نداشت — با `ls` ساعت ۱۱:۱۰:۲۴ تأیید شد). طبق قاعدهٔ «پیش از حذف، تأیید بگیر»، **حذف نشد**؛ به `/tmp/tapesh-baseline-20261001/stray-database-admins.json` منتقل شد. **تصمیم با شماست.**
- **باقی‌مانده‌های جلسهٔ قبل (دست‌نخورده):** `database/content/banners.json.bak` · `database/content/mediaTags.json.bak` (از `data:repair --apply` تاریخ ۳۰ سپتامبر).
- **ناسازگاری قالب ثبت‌شده:** `scripts/data-integrity.mjs:507` نسخهٔ تعمیر را با **newline پایانی** می‌نویسد (`… , null, 2)}\n`) ولی `contentStore.writeJson` **بدون** newline می‌نویسد. تغییر داده نشد (ابزار migration بدون تصمیم مالک دست نمی‌خورد)؛ اما هر چرخهٔ `repair → write` باعث diff بی‌معنای یک‌بایتی می‌شود.

---

## ۶) امنیت

**تأییدشده در همین اجرا (runtime، smoke):**
- `/metrics` بدون توکن و با توکن غلط ⇒ **۴۰۴** (نه ۴۰۳ — عدم افشای وجود مسیر) · با توکن درست ⇒ ۲۰۰.
- `/api/users/me` و `/api/admin/stats` بی‌احراز هویت ⇒ **۴۰۱**.
- `X-Request-Id` روی هر پاسخ.
- **redaction لاگ:** شمارهٔ تلفن داخل مسیر (`/api/users/09121234567`) در لاگ دسترسی دیده نمی‌شود، در حالی که خط لاگ همان درخواست ثبت شده است (پس حذف واقعی است، نه نبود لاگ).

**تأییدشده با سوییت‌های موجود (سبز، اجراشده در همین جلسه):** RBAC ۲۱۶ سنجه · محرمانگی سرّها ۶۰ · بانک تست ۴۰ · احراز هویت/نشست ۷۸ · قرارداد API ۳۱ + `api:contract:check` ۰ نقض.

**UNVERIFIED در این اجرا (نیازمند محیط/آزمون منفی هدفمند):** CSRF/Origin matrix روی مسیرهای تغییردهنده · rate limit به‌صورت آزمون منفی مستقل · session expiry/revoke/rotation مستقل · idempotency key برای انتشار و پیام · upload authorization و path traversal روی مسیر آپلود واقعی · SSRF در publisherها (بدون محیط بیرونی) · account takeover / user enumeration به‌صورت آزمون هدفمند.

---

## ۷) عملکرد (اندازه‌گیری‌شده)

| شاخص | مقدار | روش |
|---|---|---|
| باندل اصلی (artifact موجود) | **۴٬۴۱۰٬۷۲۱ بایت (۴٫۲MiB)** — ۱۸ سپتامبر | `ls` روی `dist/assets/index-CE3tjnht.js` |
| کل `dist/` | ۴۱MB | `du -sh` |
| `public/` | **۱۶۱MB** | `du -sh` |
| `images/` | ۳۸MB · `fonts/` ۸۲۴KB | `du -sh` |
| بزرگ‌ترین دارایی | `public/uploads/intl/mujqoxfn-….mp4` = **۴۰٫۹MB** | `find -size +500k` |
| مدل‌های سه‌بعدی | `nervous.glb` ۲۸٫۸MB · `cardio` ۲۱٫۸ · `skeletal` ۲۱٫۵ · `muscular` ۱۹٫۴ · `visceral` ۹٫۴ · `joints` ۵٫۵ · `regions` ۲٫۹ · `lymph` ۱٫۴ | `ls` |
| بزرگ‌ترین فایل سورس | `src/services/wiki/mockData.js` = **۲٬۲۵۹٬۹۳۴ بایت** | `find src -size +100k` |
| زمان build (تا نقطهٔ شکست) | ۱۸٫۷۸s · ۵۴۶ ماژول transform | `vite build` |

**اندازه‌گیری‌نشده (UNVERIFIED):** latency واقعی API · Core Web Vitals · bundle پس از تغییر سورس (build مسدود) · هر ادعای scale/تحمل کاربر. هیچ عددی برآورد نشد.

---

## ۸) کارهای انجام‌نشده و مانع‌ها

| کار | مانع |
|---|---|
| build تازه + artifact هم‌خوان با HEAD | `node_modules/three/package.json` گم است. رفع نیازمند `npm install` است که بدون درخواست صریح اجرا نمی‌شود. **BLOCKED** |
| migration واقعی (JSON → PostgreSQL یا هر چیز دیگر) | درخواست/زیرساخت واقعی وجود ندارد. عمداً انجام نشد. |
| `data:repair --apply` | تصمیم مالک داده لازم است. |
| تست race/concurrency روی انبار JSON | فروشگاه تک‌فرآیندی و بدون قفل است؛ تست معنادار بدون لایهٔ قفل وجود ندارد. |
| publisher contract/dry-run/SSRF | بدون credential و محیط مجاز قابل‌آزمایش نیست. |
| CI/CD · staging · backup زمان‌بندی‌شده · rollback نسخه‌بندی‌شده | زیرساخت واقعی وجود ندارد؛ ساخت Docker/CI بدون آن معادل «اجرای واقعی» نیست. |
| سیم‌کشی `assertInputValid` در ۱۱۷ مسیر نوشتن | تغییر پرریسک در `adminApi.js`/`contentStore.js`؛ نیازمند تصمیم محصولی + تست regression هدفمند. |
| redaction فیلدهای آلوده (`createdBy`/`updatedBy` در `public/articles`، `userId` در `public/flashcards/library`) | قبلاً گزارش‌شده؛ تغییر = breaking و خارج از دامنهٔ این اجرا. |

---

## ۹) موارد UNKNOWN / UNVERIFIED

- **UNKNOWN:** منبع حقیقت نهایی فلش‌کارت · دوره‌های بین‌الملل · داده‌های تحلیل (سه دامنه).
- **UNKNOWN:** آیا `database/content/events.json` (از ۳۰ سپتامبر `[]`) عمداً خالی شده است یا حادثه — منتظر تصمیم مالک داده.
- **UNVERIFIED:** اجرای واقعی publisherها · اتصال MONITORING_*/GA4/GSC/PageSpeed · OAuth گوگل (پیام راه‌انداز: «GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET را در .env بگذارید» ⇒ در این محیط فعال نیست).
- **UNVERIFIED:** CSRF/Origin · rate limit منفی · session revoke · idempotency · upload authorization (بخش ۶).
- **UNVERIFIED:** latency و Core Web Vitals · اثر code splitting (نیازمند build).
- **UNVERIFIED:** جایگزینی PostgreSQL — انجام نشد و صریحاً انجام‌نشده اعلام می‌شود.
- **PARTIALLY VERIFIED:** Phase 12 به‌طور کلی — لایهٔ قرارداد کامل است، اما «اعتبارسنجی ورودی به‌عنوان دروازه» در ۰ از ۱۱۷ مسیر نوشتن فعال نیست.

---

## ۱۰) پیشنهاد گام بعد (فقط بر پایهٔ شواهد همین اجرا)

1. **رفع مانع build** — بازگرداندن `node_modules/three` (نیازمند `npm install` با تأیید شما). تا آن زمان هر ادعای bundle/latency/CWV مسدود است. این تنها کاری است که هم‌زمان چند بند فاز ۱۴ را باز می‌کند.
2. **پاکسازی artifact کهنه** — پس از build موفق، `dist/` را با HEAD هم‌خوان کن؛ و `/readyz` را چنان تقویت کن که وجود باندلِ ارجاع‌شده در `dist/index.html` را هم بسنجد (الان فقط وجود `index.html` را می‌بیند).
3. **تصمیم دربارهٔ دو فایل:** `database/content/banners.json.bak` · `mediaTags.json.bak` · و فایل سرگردان منتقل‌شده به `/tmp`. هیچ‌کدام حذف نشدند.
4. **یکسان‌سازی newline بین `data:repair` و `contentStore`** (یا تصمیم آگاهانه برای حفظ تفاوت) — پیش از هر migration.
5. **در گام بعدی Phase 12:** سیم‌کشی `assertInputValid` روی **یک** گروه کوچک از مسیرهای نوشتن (مثلاً `articles`) به‌عنوان نمونهٔ اثباتی، همراه با تست regression و سپس گسترش تدریجی — نه یک‌جا روی ۱۱۷ مسیر.
6. **گام مستقل و کم‌ریسک Phase 14:** افزودن CI که فقط اسکریپت‌های موجود (`data:check` · `api:contract:check` · `smoke:test` · سوییت‌ها) را اجرا کند؛ بدون Docker و بدون staging تا زیرساخت واقعی نباشد.

---
---

# پیوست — اجرای دوم (مسیر داغ، بنچمارک واقعی، دروازهٔ کیفیت)

این پیوست بخش‌های ۲ · ۳ · ۷ ساختار بالا را با دادهٔ اندازه‌گیری‌شدهٔ تازه تکمیل می‌کند. بخش‌های ۱ تا ۶ و ۸ تا ۱۰ بالا معتبر می‌مانند، مگر جایی که اینجا صریحاً به‌روز شده است.

## الف) تغییر دوم — مسیر داغ `ensureStore` (نتیجهٔ بنچمارک)

**یافتهٔ VERIFIED (اندازه‌گیری‌شده):** `ensureStore()` روی **هر** `readCollection` / `writeCollection` / `readSettings` اجرا می‌شود و seedها را به‌صورت آرگومانِ **ارزیابی‌شده** پاس می‌داد:

```js
ensureFile(files.admins, seedAdmins());   // ← همیشه اجرا می‌شد، نتیجه دور ریخته می‌شد
```

- `seedAdmins()` داخل خود `hashPassword` ⇒ `scryptSync` را صدا می‌زند. هزینهٔ اندازه‌گیری‌شدهٔ `scryptSync(…, 64)` روی همین مک: **۳۹٫۸ms** (CPU خالص).
- ۱۱ فراخوانی از این نوع در `ensureStore` وجود داشت (همهٔ `seed*` + `TEST_BANK_QUESTIONS.map(…)`).
- سنجش پیش از اصلاح: `readCollection('banners')` (فایل ۵۳۲ بایتی) = **۸۵–۱۰۵ms** · `readSettings()` = **۸۷–۹۱ms**.

**اصلاح:** `ensureFile` اکنون thunk می‌پذیرد و مسیر داغ (فایل موجود) **زودتر برمی‌گردد**؛ هر ۱۱ فراخوانی به شکل thunk درآمدند.

```js
function ensureFile(path, fallback) {
  ensureDir(dirname(path));
  if (existsSync(path)) return;
  const value = typeof fallback === 'function' ? fallback() : fallback;
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
}
```

**سنجش پس از اصلاح — سربارهٔ خواندن (زمان `readCollection` منهای هزینهٔ خام `readFileSync+JSON.parse` همان فایل):**

| مجموعه | read(ms) | raw(ms) | **overhead(ms)** |
|---|---|---|---|
| microCourses (۸۵۰KB) | ۹۱٫۰۸ | ۹۰٫۱۵ | **۰٫۹۳** |
| mediaMetrics (۳۰۱KB) | ۵۸٫۴۲ | ۵۹٫۲۵ | −۰٫۸۳ |
| comprehensiveCourses (۲۰۶KB) | ۶۰٫۲۸ | ۶۵٫۸۲ | −۵٫۵۴ |
| activity (۱۸۸KB) | ۵۶٫۰۹ | ۵۷٫۱۲ | −۱٫۰۳ |
| testBankQuestions (۱۶۴KB) | ۵۹٫۶ | ۵۸٫۷۷ | ۰٫۸۳ |
| references (۱۵۰KB) | ۵۹٫۲۶ | ۶۰٫۱۷ | −۰٫۹۱ |

⇒ سربارهٔ منطق برنامه از **~۴۱ms** به **<۱ms** رسید. (ستون `raw` در این محیط سندباکس‌شده باد کرده است — هر `readFileSync` از طریق broker سندباکس ~۴۹ms می‌گیرد؛ به همین دلیل معیار درست، ستون `overhead` است، نه عدد خام. این تله در بنچمارک هم مستند شد.)

**ریسک بررسی‌شده:** مسیر «فایل غایب ⇒ ساخت seed» باید سالم بماند. با تست اثبات شد: فایل `banners.json` موقتاً پارک شد، `readCollection` فایل را با seed بازساخت، سپس نسخهٔ اصلی برگردانده شد. seedها تابع خالص‌اند (بدون side effect) ⇒ زمان‌بندی ارزیابی‌شان بی‌اثر است.

## ب) تغییر سوم — سیاههٔ لایهٔ داده و بنچمارک

`scripts/persistence-benchmark.mjs` (`data:benchmark`): سیاههٔ هر فایل JSON داده + تعداد رکورد + شکل ذخیره‌سازی + زمان parse + زمان نوشتن اتمیک (روی هدف موقت، نه فایل واقعی) + سربارهٔ خواندن. این ابزار بند ۱ فاز ۱۱ («inventory کن») و تست الزامی «حجم و زمان برای فایل‌های بزرگ» را پوشش می‌دهد.

نتیجهٔ اجرا: **۴۳ فایل داده · ۲٬۲۴۳٫۱KB · ۱٬۵۰۴ رکورد** · کندترین `parse` = **۱٫۸۲ms** (microCourses) · کندترین نوشتن اتمیک = **۱۰٫۸۲ms** · بیشترین سربارهٔ خواندن = **۰٫۹۳ms** · `exit 0`.

بزرگ‌ترین فایل‌ها: `microCourses.json` ۸۴۹٬۹۸۹B (۱۶ رکورد) · `mediaMetrics.json` ۳۰۰٬۶۷۷B (۵۴۰) · `comprehensiveCourses.json` ۲۰۵٬۹۲۲B (۱) · `activity.json` ۱۸۷٬۹۳۶B (۵۰۰).

## ج) تغییر چهارم — دروازهٔ کیفیت یک‌دستوره

`scripts/verify-all.mjs` (`verify:all`): ۱۹ گام (همهٔ سوییت‌ها + `data:check` + `data:benchmark` + `api:contract:check` + خودآزمون + `smoke:test`) در پروسهٔ فرزند، با **عکس‌برداری پیش از اجرا و بازگردانی پس از اجرا** از ۴۵ فایل داده.

**نتیجهٔ اجرا:** `19/19 موفق` · `exit 0` · **۳۱۱٫۳s**.

**آلودگی داده که خودکار شناسایی و برگردانده شد (VERIFIED):**

```
• database/users.sessions.json      → بازگردانده شد
• database/content/activity.json    → بازگردانده شد
• database/content/admins.json      → بازگردانده شد
• database/content/exams.json       → بازگردانده شد
```

⇒ همان آلودگی‌ای که در اجرای دستی baseline رخ داد و دستی برگردانده شد، اکنون **ساختاری** مدیریت می‌شود. `database/content/banners.json` تغییر نکرد (تنها فایل `M` آن، تغییر خودِ کاربر است).

## د) تست‌های تازه (به بخش ۳ اضافه شود)

| command | exit | زمان | نتیجه |
|---|---|---|---|
| `node --test database/contentStoreHotPath.test.mjs` | 0 | ۶٫۳s | **pass ۶ · fail ۰** |
| **جهش عمدی: `seedAdmins` دوباره eager** | **1** | ۶s | **pass ۳ · fail ۳** ← اثبات حساسیت |
| `node scripts/persistence-benchmark.mjs` | 0 | ۱۲٫۱s | در بودجه |
| `node scripts/verify-all.mjs` | 0 | ۳۱۱٫۳s | **۱۹/۱۹ گام** |

جمع سنجه‌های موجود: **۸۴۷** (بدون تغییر) · تازه: **۹ + ۶ + ۱۴ = ۲۹** · هیچ failed/skipped در وضعیت نهایی.

## ه) به‌روزرسانی بخش ۷ (عملکرد)

| شاخص | قبل | بعد | روش |
|---|---|---|---|
| سربارهٔ خواندن محتوا | **~۴۱ms** در هر `readCollection`/`readSettings` | **<۱ms** | بنچمارک، میانهٔ ۷ اجرا، منهای هزینهٔ خام fs |
| `readCollection('banners')` مطلق | ۸۵–۱۰۵ms | ۴۸–۵۱ms (همهٔ آن، هزینهٔ fs سندباکس) | همان |
| کندترین parse فایل داده | — | ۱٫۸۲ms (۸۵۰KB) | بنچمارک |
| کندترین نوشتن اتمیک | — | ۱۰٫۸۲ms (۸۵۰KB) | بنچمارک |
| باندل / `dist` / `public` | بدون تغییر: ۴٫۴MB · ۴۱MB · ۱۶۱MB | بدون تغییر (build همچنان BLOCKED) | `ls` · `du` |

**Core Web Vitals و latency شبکه همچنان UNVERIFIED** (نیازمند build و مرورگر).

## و) به‌روزرسانی وضعیت فازها

- **Phase 11:** PARTIALLY VERIFIED → **PARTIALLY VERIFIED (تقویت‌شده)**. اکنون: نوشتن اتمیک + تست تزریق خطا ✓ · سیاههٔ ۴۳ فایل/۱۵۰۴ رکورد ✓ · بنچمارک فایل بزرگ ✓ · interface حفظ‌شده ✓ (۸۴۷ سنجه سبز) · migration اجرا نشد ✗.
- **Phase 12:** بدون تغییر (PARTIALLY VERIFIED).
- **Phase 13:** بدون تغییر (UNVERIFIED).
- **Phase 14:** build همچنان **BLOCKED**؛ اما بند ۳ و ۵ (readFileSync در مسیر request / رشد بدون محدودیت) اکنون **VERIFIED و اصلاح‌شده**، و بند ۱۱ (CI quality gates) اکنون **VERIFIED** با `verify:all` به‌عنوان گام CI قابل‌استفاده.

## ز) فایل‌های افزوده/تغییرکرده در دو اجرا

| فایل | نوع |
|---|---|
| `database/contentStore.js` | M — نوشتن اتمیک + thunk شدن seedها |
| `package.json` | M — ۵ اسکریپت تازه: `content:atomic:test` · `content:hotpath:test` · `data:benchmark` · `verify:all` · `smoke:test` |
| `database/contentStoreAtomicWrite.test.mjs` | جدید — ۹ سنجه |
| `database/contentStoreHotPath.test.mjs` | جدید — ۶ سنجه |
| `scripts/server-smoke.mjs` | جدید — ۱۴ سنجه |
| `scripts/persistence-benchmark.mjs` | جدید — سیاهه + بنچمارک |
| `scripts/verify-all.mjs` | جدید — دروازهٔ کیفیت ۱۹ گامه |
| `docs/audit/phase-11-14-verification-report.md` | جدید — همین سند |
| `.workbuddy-ai/memory/MEMORY.md` | بازنویسی فشرده (۱۷KB ⇒ ~۱۱KB) |

---
---

# پیوست ب — دروازهٔ ورودی API (فاز ۱۲ پیشنهادی)

## الف) یافتهٔ VERIFIED

`database/apiContract/input.js` پل اعتبارسنجی را آماده کرده بود، ولی `grep -rn "assertInputValid\|validateInput" database/*.js` **هیچ خروجی‌ای نداشت** ⇒ بدهی ثبت‌شده («۰ از ۱۱۷ مسیر نوشتن») در همین اجرا بازتأیید شد.

## ب) تغییر انجام‌شده

`database/adminApi.js` — دروازه روی دو مسیر:

```js
['POST', '/api/admin/notes', 'notes.create', async (ctx) => {
  assertInputValid('note', ctx.body, { mode: 'patch' });
  const note = createNote(ctx.body, ctx.admin);
```

و همان یک خط در `PUT /api/admin/notes/:id`.

**چرا `mode: 'patch'`؟** `id` · `authorId` · `createdAt` سمت سرور ساخته می‌شوند و در بدنهٔ درخواست نیستند؛ در `create` این فیلدهای الزامی همیشه خطا می‌دادند و دروازه به مسیرِ همیشه‌شکست‌خورده تبدیل می‌شد. `patch` فقط فیلدهای **ارسال‌شده** را می‌سنجد.

**چرا مسیر یادداشت (انتخاب آگاهانه، نه تصادفی)؟** سه شرط لازم برای «کوچک‌ترین تغییر قابل‌اثبات»:

1. کلاینت وب این مسیر را صدا نمی‌زند (`grep` روی `src/` هیچ `api/admin/notes` ندارد) ⇒ سخت‌گیرشدن **نمی‌تواند** رابط کاربری زنده را بشکند.
2. `adminApi.test.mjs` این مسیر را واقعاً اجرا می‌کند (ساخت، تیک آیتم، فهرست، حذف) ⇒ تور رگرسیون موجود.
3. قرارداد خطا دست‌نخورده می‌ماند: همان `VALIDATION_ERROR` که `createNote` از قبل برای «یادداشت خالی» پرتاب می‌کرد و تست ۱۰ آن را ۴۰۰ می‌بیند.

## ج) چه می‌گیرد (اندازه‌گیری‌شده، نه فرضی)

| ورودی | نتیجه |
|---|---|
| `kind: 'bogus'` | `ok=false` · `fields.kind = 'enum'` |
| `title: {nested:true}` | `ok=false` · `fields.title = 'type'` |
| `id: 'note-hack'` (کلاینت) | `ok=false` · `fields.id = 'protected_field'` |
| `createdAt` (کلاینت) | `ok=false` · `fields.createdAt = 'protected_field'` |
| `{title:'', body:''}` | `ok=true` ← عمداً، تا رد آن همچنان از `createNote` بیاید (قرارداد تست ۱۰ دست‌نخورده) |

نگاشت خطا از قبل قفل بود: `ADMIN_STATUS_BY_CODE.VALIDATION_ERROR = 400` و `publicMessage('VALIDATION_ERROR', …)` پیام را دست‌نخورده برمی‌گرداند (و `INTERNAL_ERROR` آن را عوض می‌کند ⇒ سنجه غیر‌واقعی نیست).

## د) چه چیزی را **نمی‌گیرد** — محدودیت مستند

در `database/models/validator.js:209` تشخیص کلید ناشناخته فقط در `mode === 'create'` (یا برای Entityهای `STRICT_UNKNOWN_FIELD_ENTITIES`) فعال است:

```js
const strictUnknown = mode === 'create' || STRICT_UNKNOWN_FIELD_ENTITIES.has(schema.name);
```

⇒ دروازهٔ ما در حالت `patch` **کلید ناشناخته را نمی‌گیرد**. این رفتار با یک تست «محدودیت مستند» قفل شد (در `create` رد می‌شود، در `patch` نه) تا کسی فرض نکند دروازه allowlist است. سخت‌گیرکردن `patch` یک تغییر **مشترک** در `validator.js` است با اثر روی اسکنر `data:check` و همهٔ Entityها ⇒ نیازمند تصمیم صریح، نه تغییر ضمنی.

محدودیت دوم: `authorId` در Schema محافظت‌شده نیست و دروازه آن را می‌پذیرد. آسیب‌پذیری نیست چون `createNote`/`updateNote` مقدارش را از بازیگر احراز‌هویت‌شده بازنویسی می‌کنند — ولی تست مربوطه این وابستگی را مستند می‌کند.

## ه) تست و رگرسیون

| command | exit | نتیجه |
|---|---|---|
| `node --test database/inputGate.test.mjs` (`api:input:test`) | 0 | **۱۳ سنجه سبز** |
| **جهش عمدی: حذف دروازه از `POST /admin/notes`** | **1** | **۲ شکست** ← اثبات حساسیت |
| `node database/adminApi.test.mjs` (رگرسیون) | 0 | **۹۲/۹۲ بدون تغییر** |
| `node scripts/verify-all.mjs` | 0 | **۲۰/۲۰ گام** |

**پیشرفت بدهی:** از **۰ به ۲** از ۱۱۷ مسیر نوشتن (۱٫۷٪). عمداً محدود؛ گسترش باید با همین الگو (انتخاب Entity، انتخاب `mode`، تست قرارداد + تست رفتاری + جهش) انجام شود، نه یک‌جا.

## و) اصلاح روش بنچمارک (نتیجهٔ یک شکست واقعی)

اجرای دوم `verify:all` با `data:benchmark exit=1` شکست خورد — علت **محیطی** بود (هم‌زمانی با اجرای دستورهای دیگر روی همان ماشین)، نه رگرسیون. دو اصلاح روشی اعمال شد:

1. **گرم‌کردن** پیش از اندازه‌گیری: اولین `readCollection` کار یک‌بارهٔ `ensureStore` را انجام می‌دهد؛ اگر در اندازه‌گیری بیفتد، سنجه هزینهٔ راه‌اندازی را به‌جای مسیر داغ می‌سنجد.
2. **سربارهٔ جفتی**: به‌جای `median(read) − median(raw)`، میانهٔ `read_i − raw_i` هر تکرار. تفاضل دو میانه زیر بار متغیر، نوسان بار را می‌سنجد نه سرباره را.

نتیجه: سه اجرای متوالی ⇒ بیشترین سرباره **۰٫۱۷ / ۲٫۹۴ / ۱٫۴۴ms**، همه `exit 0`. سقف بودجه ۲۵ms دست‌نخورده.

⚠️ **درس برای آینده:** اجرای هم‌زمان ابزارهای CPU-محور روی همین ماشین، سنجه‌های زمانی را بی‌اعتبار می‌کند. `verify:all` را تنها اجرا کن.

## ز) گارد «آلودگی ازپیش‌موجود» — نتیجهٔ یک خطای واقعی در همین اجرا

پس از اجرای سبز `verify:all`، معلوم شد `database/content/activity.json` و `database/content/admins.json` **باز هم `M`** هستند. علت: `verify:all` به **وضعیت شروع خودش** برمی‌گرداند، نه به HEAD. چون پیش از آن یک `adminApi.test.mjs` دستی اجرا شده بود، وضعیت شروع خودش آلوده بود ⇒ آلودگی «موفق‌انه بازگردانی» شد.

اصلاح (سه بخش):
1. گام **پیش‌پرواز**: `git status --porcelain` روی همان ۴۵ فایل دیده‌شده اجرا می‌شود و هر فایلی که نسبت به HEAD تغییر کرده، پیش از شروع گزارش می‌شود.
2. فلگ اختیاری `--require-clean`: اگر داده از قبل آلوده باشد، با **کد خروج ۲** می‌ایستد (مناسب CI).
3. خروجی `--json` حالا فیلد `preexisting` هم دارد.

**آزمون سه‌حالته (VERIFIED):**

| حالت | نتیجه |
|---|---|
| درخت با تغییرات خودِ کاربر | هشدار ۷ فایل + ادامه، `exit 0` |
| `--require-clean` روی همان درخت | `exit 2` |
| `--require-clean` پس از تزریق آلودگی مصنوعی | `exit 2` با ۸ فایل |

نکتهٔ مهم: آن ۷ فایل **تغییرات خودِ کاربر** هستند (`banners` · `comprehensiveCourses` · `events` · `mediaTags` · `microCourses` · `pages` · `references`) و ابزار **هرگز** به آن‌ها دست نمی‌زند؛ فقط گزارش می‌کند. به همین دلیل `--require-clean` **پیش‌فرض نیست** (روی این مخزن تا وقتی تغییرات دادهٔ کاربر commit نشده، همیشه شکست می‌خورد).

دو فایل آلودهٔ باقی‌مانده با `git checkout --` به HEAD برگردانده شدند (هر دو در `git status` ساعت ۱۱:۱۰ تمیز بودند ⇒ HEAD = وضعیت پیش از جلسه) و `data:check` دوباره **۰ خطا / ۲۲ هشدار / ۱۵۳۷ رکورد** داد.

---

## پیوست ج — شواهد فاز ۱۳ (بازبینی فقط-خواندنی، بدون اعتبارنامه)

هدف: جایگزینی برچسب «UNVERIFIED» با شواهد مشخص از کد، به‌جای حدس. هیچ فایلی در این پیوست تغییر نکرد و **هیچ درخواست خروجی واقعی زده نشد**.

### ج-۱ نگاشت آداپترها

| پلتفرم | فایل | `adapter` | فراخوانی شبکه |
|---|---|---|---|
| bale | `publishers/bale.js` | `true` | `fetch(\`${baleApiBase()}${token}/${method}\`)` — خط ۱۲۸ |
| eitaa | `publishers/eitaa.js` | `true` | `fetch(\`${apiBase()}/${token}/${method}\`)` — خط ۱۴۸ |
| instagram | `publishers/instagram.js` | `true` | `fetch(\`${graphBase()}${path}\`)` — خطوط ۱۰۹ و ۱۱۵ |
| telegram | `publishers/telegram.js` | `true` | از طریق `telegramLike.js` — خط ۱۵۲ |
| youtube · aparat · x · linkedin · rubika · whatsapp · pinterest · website · podcast · newsletter | `publishers/index.js` (`CATALOG_ONLY`) | `false` | **هیچ** — فقط `capabilities.manual: true` |

`verifyPlatform` (`index.js:203-214`) و `sendPlatform` (`index.js:229-234`) و `platformMetrics` (`index.js:237-241`) تنها مسیرهای رسیدن به آداپترها هستند.

### ج-۲ یافته‌های VERIFIED

1. **بدون توکن، هیچ درخواستی به بیرون نمی‌رود (دو لایه).** لایهٔ اول: `verifyPlatform` با توکن خالی پیش از رسیدن به آداپتر برمی‌گردد (`'توکن را وارد کنید'`). لایهٔ دوم: `callMethod` در `bale.js:121` (`eitaa.js`/`telegramLike.js` مشابه) با `throw publishError(…, 'PUBLISH_NO_TOKEN')` پیش از `fetch` می‌ایستد. ⇒ ادعای «بدون توکن صفر درخواست» **مستند به کد است**، نه به کامنت.
2. **مهلت (timeout) در همهٔ ۴ آداپتر هست.** `PUBLISH_TIMEOUT_MS` → `AbortController` → `clearTimeout` در `finally` (`bale.js:123-142`). خطای `AbortError` به کد `PUBLISH_TIMEOUT` و پیام فارسی ترجمه می‌شود.
3. **بدون retry/backoff.** جست‌وجو برای `retry|backoff|maxAttempt|for (let attempt` در کل پوشه فقط تطبیق‌های تشخیص پیام ۴۲۹ را می‌دهد (`bale.js:74` · `eitaa.js:116` · `telegramLike.js:54`). `sleep` در `bale.js:114` **فاصله‌گذاری بین پیام‌های یک ارسال چندبخشی** است (`PAUSE_BETWEEN_MESSAGES_MS`, خط ۲۹۲)، نه تلاش دوباره. ⇒ «تست retry/backoff» در فاز ۱۳ **موضوعِ آزمون ندارد**؛ باید به‌عنوان **قابلیت غایب** ثبت شود، نه تست شکست‌خورده.
4. **توکن در خطا و لاگ درز نمی‌کند.** توکن در **مسیر URL** جاسازی می‌شود (سبک تلگرام)، پس هر پیامی که URL را بازتاب دهد نشت می‌کند. اما `friendlyDescription` (`bale.js:66-108`) صریحاً مستند شده «متن خود بله برگردانده می‌شود (**بدون توکن**)» و تنها `payload.description` را ترجمه می‌کند؛ هیچ‌جا `response.url` یا رشتهٔ درخواست در پیام خطا نیست. ⇒ نشت توکن **VERIFIED منتفی** است، ولی این یک **قرارداد نوشتاری** است نه گارد اجرایی: هیچ تابع `redact()`/`mask()` در لایهٔ publisherها وجود ندارد. افزودن گارد خودکار = کار فاز ۱۳.
5. **SSRF: دامنهٔ ثابت، ولی بدون اعتبارسنجی میزبان.** همهٔ آدرس‌های پایه از `process.env` با پیش‌فرض سخت‌کدشده می‌آیند: `BALE_API_BASE` → `https://tapi.bale.ai/bot` (`bale.js:21,49`) · `EITAA_API_BASE` → `https://eitaayar.ir/api` (`eitaa.js:57,68`) · `INSTAGRAM_GRAPH_BASE` → `https://graph.facebook.com/v21.0` (`instagram.js:21,65`) · `TELEGRAM_API_BASE` (`telegram.js:23`). این با قاعدهٔ فاز ۳ («URL خروجی فقط از `process.env` + پیش‌فرض ثابت») **سازگار است**، اما **هیچ اعتبارسنجی‌ای** روی مقدار env وجود ندارد: نه بررسی `protocol === 'https:'`، نه منع `localhost`/IP خصوصی/`169.254.169.254`. ⇒ اگر مهاجم به env دسترسی پیدا کند، می‌تواند ارسال را به میزبان داخلی بچرخاند. **ریسک باقی‌مانده در سطح پیکربندی، ثبت‌شده و رفع‌نشده.**
6. **`appId` در `verifyPlatform({platform, token, target, appId})`** فقط به `adapter.verify` پاس می‌شود؛ مسیر `send` آن را نمی‌گیرد ⇒ تفکیک مجوز بررسی از ارسال، مطابق الگوی فاز ۳.

### ج-۳ UNVERIFIED (نیازمند اعتبارنامه/محیط مجاز)

| سنجهٔ خواسته‌شده | وضعیت | دلیل |
|---|---|---|
| قرارداد واقعی هر publisher (ارسال موفق) | **UNVERIFIED** | توکن بله/ایتا/تلگرام/اینستاگرام در این محیط نیست |
| dry-run / mock transport | **UNVERIFIED** | `previewRequest` برای برخی آداپترها هست، ولی مسیر اجرای dry-run سرتاسری تست نشد |
| جلوگیری از ارسال تکراری (idempotency/dedup) | **UNVERIFIED** | کلید dedup در لایهٔ publisher دیده نشد؛ مالکیت آن باید مشخص شود (publisher یا `publishingService`) |
| رفتار واقعی ۴۲۹ و سهمیهٔ هر پلتفرم | **UNVERIFIED** | بدون تماس واقعی قابل اندازه‌گیری نیست |
| `MONITORING_*` · GA4 · GSC · PageSpeed | **UNVERIFIED** | کلید/سرویس خارجی موجود نیست؛ وجود متغیر env = اتصال فعال **نیست** |
| OAuth گوگل | **UNVERIFIED** | پیام راه‌انداز `GOOGLE_CLIENT_ID/SECRET` ⇒ در این محیط فعال نیست |
| `analyticsStore.js` (۸۹۲ خط) — جریان رویداد، نگهداشت، حریم خصوصی | **UNVERIFIED** | `grep 'events.json|analyticsStore'` در `database/*.js` **هیچ** تطبیقی برنگرداند ⇒ لایهٔ API آن را مصرف نمی‌کند؛ این خودش یافتهٔ فاز ۱۳ است و باید پیش از هر تغییر جریان واقعی رویداد تعیین شود |
| `analyticsEngine.js` / `analyticsInsights.js` با دادهٔ نمونه | **UNVERIFIED** | بدون جریان رویداد واقعی، آزمون فرمول معنادار نیست |

**نتیجهٔ صریح:** فاز ۱۳ از نظر کد **بخشاً موجود** است (آداپتر، مهلت، گارد توکن) ولی از نظر **اجرا** UNVERIFIED می‌ماند. هیچ‌کدام از این موارد «IMPLEMENTED» اعلام نمی‌شود.
