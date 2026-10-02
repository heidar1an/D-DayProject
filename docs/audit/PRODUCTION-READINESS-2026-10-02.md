# گزارش آمادگی تولید — تپش · ۲۰۲۶-۱۰-۰۲

> مبنای این گزارش **وضعیت واقعی همین مخزن** در لحظهٔ نگارش است، نه بخش‌های ۱–۴۹ سند
> `MASTER-AUDIT-2026-09-29` و نه بازبینی‌های قدیمی. هر یافته پیش از اقدام در کد
> فعلی اثبات شده است.
>
> قاعدهٔ گزارش: هیچ موردی برای «سبز شدن گزارش» سبز نشده. هر جا تأیید بیرونی لازم
> بوده، صریحاً `UNVERIFIED`/`BLOCKED` مانده است.

## ۰) خط پایه (PHASE 0)

| قلم | مقدار |
|---|---|
| شاخه | `main` |
| آخرین commit | `e34a6c1` — `miniedit02` |
| Node | `v22.22.2` (مدیریت‌شده) · `engines` در `package.json` = `>=22.0.0 <23` · `.nvmrc` = `22.22.2` |
| npm | `10.9.7` |
| دروازهٔ کیفیت | `npm run verify:all` — **۴۳ گام** |

نکتهٔ مهم دربارهٔ اجرای درست: در این محیط `node` روی PATH به نسخهٔ ۲۰ اشاره می‌کند،
در حالی که پروژه به `WebSocket` سراسری نود ۲۲ نیاز دارد. اجرای دروازه با نود ۲۰
گام `e2e:browser` را با «WebSocket is not defined» می‌شکند. **اجرای درست:**
`/Users/heidarian2/.workbuddy-ai/binaries/node/versions/22.22.2-2/bin/node scripts/verify-all.mjs`.

---

## خلاصهٔ وضعیت

| فاز | موضوع | وضعیت |
|---|---|---|
| ۰ | خط پایه | ✅ VERIFIED |
| ۱ | E2E مرورگری | ✅ VERIFIED (۱۱/۱۱ جریان) |
| ۲ | CI واقعی | 🟡 IMPLEMENTED-BUT-UNVERIFIED (EXTERNAL) |
| ۳ | زیرساخت staging/production | 🟡 IMPLEMENTED-BUT-UNVERIFIED (Docker بدون docker) |
| ۴ | آزمون بار | ✅ VERIFIED (محلی) · 🟠 برای staging واقعی BLOCKED-EXTERNAL |
| ۵ | پاک‌سازی راز و تاریخچهٔ Git | 🟡 IMPLEMENTED (ابزار آماده) · اجرا نیازمند تأیید مالک |
| ۶ | ماندگاری و چندپروسه‌ای | ✅ VERIFIED (نوشتن اتمیک) · 🟠 نشست‌های ادمین نیازمند تصمیم مالک |
| ۷ | امنیت آپلود و ذخیره‌سازی | ✅ VERIFIED |
| ۸ | اعتبارسنجی کامل Schema | ✅ VERIFIED (سرشماری ماشین‌خوان) |
| ۹ | مشاهده‌پذیری واقعی | ✅ VERIFIED (لاگ پایدار/چرخش/ردیابی خطا) |
| ۱۰ | Publisher / AI / Payment | 🟡 برچسب‌گذاری‌شدهٔ سه‌گانه |
| ۱۱ | پشتیبان/بازگردانی/ایمنی استقرار | ✅ VERIFIED (محلی) |
| ۱۲ | مستندسازی API (OpenAPI) | ✅ VERIFIED |
| ۱۳ | دروازهٔ نهایی | 🟠 آخرین اجرای کامل ۴۳/۴۳ سبز · اجرای بازآزمایی **ناتمام ماند** (۱ سنجهٔ `data:test` — پایین ببینید) |

---

## PHASE 1 — E2E مرورگری ✅ VERIFIED

**وضعیت فعلی:** یک هارنس E2E مرورگری **بدون هیچ وابستگی بیرونی** روی پروتکل
Chrome DevTools نوشته شد (`scripts/browser-e2e.mjs`). چون `npm install` در این
پروژه بسته است، Playwright نصب نشد؛ به‌جایش از `WebSocket` سراسری نود ۲۲ و
کرومِ نصب‌شده روی سیستم استفاده می‌شود. ورودی‌ها (تایپ/کلیک) از لایهٔ **ورودی
واقعی کروم** می‌آیند، نه تغییر مستقیم `value` یا رخداد ساختگی.

**شواهد:**
```
جریان‌ها: 11/11 موفق
بررسی‌ها: 67 موفق · 0 ناموفق · 1 رد‌شده
ورودی واقعی: بسته به اجرا ۰ تا ۲ کلیک با مسیر جانشین سطح-DOM
```
پوشش ۱۱ جریان: مسیرها و صفحهٔ اصلی · اعتبارسنجی ثبت‌نام · ثبت‌نام واقعی ·
خروج و ورود مجدد · مشاهده/ویرایش پروفایل · ورود به مسیر یادگیری · بانک تست و
آزمون · پنل بدون دسترسی · ورود مدیر + CRUD واقعی · نشست نامعتبر/ابطال‌شده ·
مرزهای خطا.

**صداقت دربارهٔ مکانیزم کلیک:** کروم headless=new گاهی رخداد ماوس را **بی‌صدا**
گم می‌کند. هارنس یک **کاوشگر کلیک** دارد که تأیید می‌کند رخداد `click` واقعاً
ثبت شده؛ اگر نشده باشد، یک کلیک سطح-DOM به‌عنوان جانشین می‌زند و شمارندهٔ
`clickFallbacks` را در گزارش ماشین‌خوان بالا می‌برد (۰ تا ۲ در اجراهای مختلف).
هیچ‌وقت بی‌صدا جانشین نمی‌شود و اثباتِ خودِ جریان همیشه از **لاگ شبکه** می‌آید
(`POST /api/admin/notes` واقعاً به سرور رفت و ۲۰۰ گرفت) — نه از مکانیزم کلیک.

**فایل‌های تغییر‌یافته:** `scripts/browser-e2e.mjs` (جدید) ·
`src/layout/dashboard/setting/EditProfile.jsx` (رفع باگ واقعی) ·
`package.json` (اسکریپت‌های `e2e:browser`، `e2e:browser:headed`، `e2e:browser:json`) ·
`docs/audit/browser-e2e.json` (خروجی ماشین‌خوان).

**تست:** `npm run e2e:browser` → exit 0 · در دروازهٔ ۴۱ گامی به‌عنوان گام
`e2e:browser` اجرا می‌شود.

**باگ واقعی که همین E2E پیدا کرد:** در بارگذاری کامل `#dashboard?o=settings&t=profile`،
کامپوننت **پیش از** رسیدن `/api/users/me` سوار می‌شود و `useState(initialForm)`
مقادیر خالی را قفل می‌کند ⇒ کاربر وارد‌شده پروفایل خالی می‌دید. با یک افکت
هم‌گام‌سازی (که تایپ در جریان کاربر را خراب نمی‌کند) رفع شد.

**امنیت هارنس:** ۴۱ فایل دادهٔ زمان‌اجرا پیش از اجرا عکس‌برداری و پس از اجرا
بازگردانی می‌شوند؛ فایل‌هایی که اجرا ساخته و قبلاً نبودند حذف می‌شوند؛
اعتبارنامهٔ مدیر از محیط خوانده می‌شود (پیش‌فرض توسعه، نه production)؛
روی base بیرونی هیچ نوشتنی انجام نمی‌شود.

**وابستگی باقی‌مانده:** برای اثبات «روی مرورگر دیگر هم کار می‌کند» به
کرومیوم/Firefox اضافه نیاز است. اجرا روی staging واقعی ⇒ `UNVERIFIED-EXTERNAL`.

**اقدام بعدی دقیق:** در CI (job `e2e-browser`) و روی یک staging واقعی یک‌بار
`E2E_BASE_URL=https://staging… npm run e2e:browser` اجرا و نتیجه ثبت شود.

---

## PHASE 2 — CI واقعی 🟡 IMPLEMENTED-BUT-UNVERIFIED

**وضعیت فعلی:** `.github/workflows/ci.yml` بازنویسی شد. **۵ job:**
`verify` (دروازهٔ ۴۱ گام) · `build` (build واقعی + بودجهٔ باندل + اعتبارسنجی SEO) ·
`load` (سرور واقعی + `load-test --check`) · `e2e-browser` (با `--require-browser`) ·
`audit` (`npm audit --audit-level=high` + `repo:hygiene`).

**شواهد:** ساختار YAML با پارسر مستقل اعتبارسنجی شد: ۵ job، `needs` درست،
۰ گام نامعتبر. `continue-on-error` که پیش‌تر شکستِ `repo:hygiene` را پنهان می‌کرد
**حذف شد**. نسخهٔ نود با `.nvmrc` (`node-version-file`) پین شده و نصب با `npm ci`
قطعی است. لاگ‌های تشخیصی روی شکست آپلود می‌شوند.

**فایل‌های تغییر‌یافته:** `.github/workflows/ci.yml` · `.nvmrc` (جدید) ·
`package.json` (`engines`).

**تست:** اعتبارسنجی ساختاری YAML (سبز). **اجرای واقعی روی runner گیت‌هاب انجام
نشده است.**

**⚠️ صریح: «CI پیکربندی شد» ≠ «CI اجرا شد».**

**وابستگی باقی‌مانده:** یک push روی گیت‌هاب و یک runner واقعی.

**اقدام بعدی دقیق:** `git push` روی شاخهٔ کاری و باز کردن PR؛ سپس تأیید سبز شدن
هر ۵ job در تب Actions. تا آن لحظه این مورد `UNVERIFIED-EXTERNAL` می‌ماند.

---

## PHASE 3 — زیرساخت آمادهٔ staging/production 🟡 IMPLEMENTED-BUT-UNVERIFIED

**وضعیت فعلی:** `.env.example` (۲۲۲ خط) همهٔ دسته‌ها را مستند می‌کند:
محیط اجرا (`NODE_ENV`/`TAPESH_ENV`)، میزبان‌های مجاز، مشاهده‌پذیری، خاموشی نرم،
حساب اولیهٔ مدیر، گوگل OAuth، انتشار، مرکز رسانه/تحلیل، AI، پرداخت، هشدار.
`/healthz` (liveness) و `/readyz` (readiness) پیاده‌اند. `scripts/deploy.mjs`
ترتیب قطعی دارد. خاموشی نرم با SIGTERM/SIGINT تست شده.

**آمادگی، حالا مسیر نوشتن آپلودها را هم می‌بیند:** `/readyz` پیش‌تر فقط
`data-writable` (`database/`) و `build-artifact` را می‌سنجید. `public/uploads`
دومین مسیر نوشتنی پروداکشن است؛ بدون آن، پاد می‌توانست «آماده» اعلام شود در
حالی که هر آپلود کاربر با خطای دسترسی می‌شکند. حالا سنجهٔ `uploads-writable`
هم اضافه شده و `server.js` و پنل (مسیر نگهبان) هر دو همان را می‌بینند.
گزارش `checkReadiness` بدون `uploadsDir` دقیقاً همان سه سنجهٔ قبلی را می‌دهد،
پس مصرف‌کننده‌های موجود دست‌نخورده ماندند.

**Docker (درخواست صریح مالک):** `Dockerfile` دو مرحله‌ای (`node:22-alpine`،
کاربر غیر-روت، `HEALTHCHECK` روی `/healthz`) و `docker-compose.staging.yml`
(سه volume پایدار، `stop_grace_period: 20s`، چرخش لاگ json-file، بدون هیچ
credential در فایل). **دو اصلاح واقعی در همین نوبت:** مسیرهای نوشتنی
`/app/logs` و `/app/public/uploads` پیش از `USER node` ساخته و به `node` واگذار
می‌شوند — وگرنه داکر آن‌ها را با مالک root می‌سازد و staging با خطای دسترسی
بالا می‌آمد، نه با خطای کد. همچنین لاگ پایدار به volume وصل شد
(`TAPESH_LOG_FILE=/app/logs/access.log`).

**فایل‌های تغییر‌یافته:** `.env.example` · `Dockerfile` · `.dockerignore` ·
`docker-compose.staging.yml` · `server.js` (خاموشی نرم) · `scripts/deploy.mjs` ·
`docs/ops/deployment-and-recovery.md`.

**تست:** `deploy.mjs --dry-run` و `--skip-build` واقعاً اجرا شدند: پشتیبان
`pre-deploy-development-20261002-134030.tar.gz` (۲۶۷KB) + `SHA256SUMS` ساخته شد و
dry-run مهاجرت «تغییر لازم: ۰ · شکست: ۰» داد. خاموشی نرم با SIGTERM و کد خروج ۰
تأیید شد.

**⚠️ docker در این محیط نصب نیست** (`command -v docker` → موجود نیست) ⇒ هیچ
ایمیجی build و هیچ کانتینری اجرا نشد.

**وابستگی باقی‌مانده:** میزبان دارای docker + دامنهٔ staging.

**اقدام بعدی دقیق:**
```bash
cp .env.example .env.staging
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
docker compose -f docker-compose.staging.yml ps     # انتظار: healthy
curl -fsS http://127.0.0.1:4173/healthz && curl -fsS http://127.0.0.1:4173/readyz
```

---

## PHASE 4 — آزمون بار ✅ VERIFIED (محلی)

**وضعیت فعلی:** `scripts/load-test.mjs` — هارنس بدون وابستگی، base از
`LOAD_TEST_BASE_URL`، خروجی ماشین‌خوان، با گارد ایمنی: روی base غیرمحلی بدون
`--allow-remote` **اجرا نمی‌شود**. سناریوها فقط خواندنی‌اند + یک تلاش ورود با
اعتبار جعلی که باید ۴xx بدهد + یک مسیر محافظت‌شدهٔ ادمین بدون سشن.

**سنجه‌های پوشش‌داده‌شده:** requests · success rate · failure rate · p50 · p95 ·
p99 · throughput · HTTP 4xx · HTTP 5xx — به تفکیک سناریو.

**تست:** `npm run perf:load:check` — روی سرور محلی واقعی اجرا شد
(`--concurrency=10 --duration=5`):

```
requests: 18249   success: 18249   failure: 0   successRate: 1
throughput: 3647.7 rps
p50: 2.3ms   p95: 5.9ms   p99: 8.1ms   max: 66.5ms
http5xx: 0   http4xx: 4561 (عمدی: تلاش ورود جعلی + مسیر ادمین بدون سشن)
violations: []
thresholds: successRate ≥ 0.99 · p95 ≤ 1500ms · 5xx = 0
```

**وصل‌شدن به دروازهٔ محلی:** `scripts/load-test-local.mjs` سرور را روی یک پورت
آزاد (فقط `127.0.0.1`) بالا می‌آورد، آزمون را اجرا می‌کند و سرور را پایین
می‌آورد. حالا گام `perf:load:local` در دروازه است — چون هارنسی که فقط در CI
اجرا شود، روی ماشین توسعه کهنه می‌شود. بدون artifact بیلد، کد خروج **۳**
(نامعین) می‌دهد، نه سبز. آستانه‌ها هیچ‌وقت برای سبز شدن شل نمی‌شوند.

**وابستگی باقی‌مانده:** عددهای معنادار فقط روی staging واقعی به‌دست می‌آید.
آستانه‌ها مستند و **قابل‌بازبینی با تصمیم مالک** هستند، نه برای سبز شدن.

**اقدام بعدی دقیق:** `LOAD_TEST_BASE_URL=https://staging… node scripts/load-test.mjs --check --json`
و ثبت نتیجه در `docs/ops/`.

---

## PHASE 5 — پاک‌سازی راز و تاریخچهٔ Git 🟡 IMPLEMENTED · اجرا نیازمند تأیید مالک

**وضعیت فعلی:** `scripts/secret-history-audit.mjs` فقط **می‌خواند** و هیچ‌وقت
تاریخچه را بازنویسی نمی‌کند. یک مثبت کاذب واقعی هم رفع شد: `.env.example`
پیش‌تر CRITICAL علامت می‌خورد.

**شواهد (اجرای واقعی، فقط‌خواندنی):** `main · e34a6c1 miniedit02` · ۹۵۴ مسیر
تاریچه · **۱۱ یافته (critical 5 · high 3 · medium 3)**:

| مسیر | نوع | شدت |
|---|---|---|
| `content/admins.json` · `database/content/admins.json` | secret (هش رمز) | critical |
| `database/users.json` · `database/users.json.bak-avatar` · `users.json` | PII | critical |
| `content/activity.json` · `database/content/activity.json` | artifact | high |
| `database/content/testBankAnswers.json` | artifact | high |
| `content/events.json` · `database/content/events.json` | artifact | high |
| `database/content/publishLog.json` | artifact | medium |

ابزار فرمان پاک‌سازی آماده (`git filter-repo --force … --invert-paths`) و
`git push --force-with-lease origin main` را **چاپ می‌کند ولی اجرا نمی‌کند** و با
پیام «هیچ تغییری روی تاریخچه اعمال نشد» تمام می‌شود.

**پیامدهای force-push (باید مالک بداند):** هر کلون قدیمی واگرا می‌شود و نیاز به
`git fetch && git reset --hard origin/main` دارد؛ PRهای باز باید بسته/بازسازی
شوند؛ **هیچ credential قدیمی را پاک نمی‌کند** — توکن‌ها/رمزهای لو‌رفته باید
جداگانه rotate شوند؛ بازنویسی تاریخچه یک عملیات برگشت‌ناپذیر است و پیش از آن
پشتیبان `git bundle` لازم است.

**پیشگیری از تکرار:** `.gitignore` و دروازهٔ `repo:hygiene` و اسکنر راز موجودند.

**تست:** `npm run audit:secrets` (فقط‌خواندنی).

**اقدام بعدی دقیق (نیازمند تأیید صریح مالک):** گرفتن `git bundle` پشتیبان →
چرخش همهٔ credentialهای تاریخی → اجرای فرمان چاپ‌شده → `git push --force-with-lease`.

---

## PHASE 6 — ماندگاری و آمادگی چندپروسه‌ای ✅ VERIFIED · 🟠 یک مورد نیازمند تصمیم مالک

**وضعیت فعلی:** مسیر نوشتن مرکزی `database/contentStore.js` (`writeJson` با
tmp→rename) و قفل بین‌پروسه‌ای در `database/writeQueue.js` وجود دارد.

**دو نوشتنِ غیراتمیک واقعی پیدا و رفع شد** — در `database/publishingStore.js` و
`database/mediaStore.js`: فایل رازها **در جای خود** نوشته می‌شد؛ اگر پروسه در
میانهٔ نوشتن می‌مرد، `readSecrets` خطا را بی‌صدا می‌بلعید و نتیجه **از دست رفتن
کامل همهٔ توکن‌های ربات** بود. حالا:
```js
const tmp = `${secretsFile}.${process.pid}.tmp`;
writeFileSync(tmp, JSON.stringify(secrets, null, 2), 'utf8');
try { chmodSync(tmp, 0o600); } catch { /* */ }
renameSync(tmp, secretsFile);
```

**🟠 مورد نیازمند تصمیم مالک — نشست‌های ادمین فقط در حافظه‌اند:**
`database/contentStore.js:918-919`
```js
const sessions = new Map();
const loginAttempts = new Map();
```
نشست ادمین و شمارش تلاش ورود در حافظهٔ پروسه‌اند. در چند پروسه/چند کانتینر:
(الف) ادمین ممکن است بین درخواست‌ها بیرون بیفتد، (ب) rate limit ورود دور زده
می‌شود. نشست کاربران عادی **فایل‌محور** است (`database/users.sessions.json`).
تغییر این رفتار یک **تصمیم معماری** است (ذخیره‌گاه مشترک)، پس بدون تأیید مالک
تغییر ندادم و در کد هم صریح کامنت شده است.

**فایل‌های تغییر‌یافته:** `database/publishingStore.js` · `database/mediaStore.js`.

**تست:** `npm run content:atomic:test` · `npm run storage:test` · `npm run concurrency:test` — همه سبز.

**اقدام بعدی دقیق:** مالک تصمیم بگیرد: (۱) تک‌پروسه بماند و مستند شود، یا
(۲) نشست ادمین هم به فایل/ذخیره‌گاه مشترک منتقل شود (کار متوسط، نیازمند تست
چندپروسه‌ای).

---

## PHASE 7 — امنیت آپلود و ذخیره‌سازی ✅ VERIFIED

**وضعیت فعلی:** مسیر `/uploads/**` از `database/uploadsFile.js` سرو می‌شود.

**آسیب واقعی که بسته شد:** هر فایلی با پسوند اجرایی (`.html`/`.js`/`.mjs`/`.css`/`.json`)
در `public/uploads` **هم‌مبدأ و با نوع اجرایی** سرو می‌شد — یک بردار ذخیره‌شدهٔ XSS.
حالا فقط پسوندهای ایمنِ درون‌خطی (`INLINE_SAFE_EXTENSIONS`) با نوع درست سرو
می‌شوند و بقیه با `application/octet-stream` + `Content-Disposition: attachment`.
`X-Content-Type-Options: nosniff` روی همه. هدرهای امنیتی (از جمله CSP) روی
پاسخ آپلود هم اعمال می‌شوند.

**پوشش تست‌شده:** پیمایش مسیر (`/uploads/../users.json`، `../../database/users.json`،
شکل `%2e%2e`)، مسیر مشروع داخل `UPLOADS_DIR` می‌ماند، فایل ناموجود ⇒ ۴۰۴ JSON
(هرگز پوستهٔ SPA)، پسوند اجرایی ⇒ octet-stream + attachment، رسانهٔ مشروع
همچنان درون‌خطی با نوع درست.

**هدرهای کش و درخواست شرطی (افزودهٔ همین نوبت):** پیش از این فقط تصویر و فونت
`Cache-Control` داشتند؛ ویدیو، PDF و زیرنویس **هیچ** نشانهٔ کشی نداشتند، پس
مرورگر هر بار کل فایل را دوباره می‌گرفت. حالا:
- `ETag` قوی (حجم + زمان تغییر) و `Last-Modified` روی **همهٔ** پاسخ‌ها؛
- `If-None-Match` / `If-Modified-Since` ⇒ **۳۰۴ بدون بدنه** (کش اعتبارسنجی‌شده،
  پس محتوای کهنه هرگز سرو نمی‌شود)؛
- `Accept-Ranges: bytes` فقط برای رسانه‌هایی که **واقعاً** بازه می‌دهند
  (ویدیو، صدا، PDF) — ادعای بی‌پشتوانه نمی‌شود؛
- Range روی PDF و صدا هم فعال شد (پیش‌تر فقط ویدیو بود)، شامل شکل دنباله‌ای
  `bytes=-N` و پاسخ درست `416` برای بازهٔ بیرون از فایل؛
- جدول MIME و فهرست درون‌مرورگری هم‌خوان شدند (`.avif/.bmp/.tiff/.heic/.heif`
  و `.mp3/.m4a/.wav/.ogg` پیش‌تر «مجاز» شمرده می‌شدند ولی نوع واقعی نمی‌گرفتند).

**شاهد روی سرور واقعی** (فایل آزمایشی داخل `public/uploads`، سپس پاک شد):
```
GET  /uploads/…pdf                    → 200 · Content-Type: application/pdf
                                        ETag: "a-1a0fc36b992" · Last-Modified: …
GET  Range: bytes=2-5                 → 206 Partial Content
GET  If-None-Match: "a-1a0fc36b992"   → 304
GET  Range: bytes=99-200              → 416
```

**کوری که پیدا شد — زائد آزمون در پوشهٔ سروشده (افزودهٔ همین نوبت):** آزمون امنیت
آپلود فایل موقش را **داخل خود `public/uploads`** می‌سازد (لازم است، چون تابع
تصمیم‌گیرنده عمداً فقط داخل آن پوشه را می‌بیند) و در `finally` پاک می‌کند. ولی
آزمون‌ها هم‌زمان اجرا می‌شوند؛ اگر یک اجرا وسط کار قطع شود، فایل‌های
`e2e-*.pdf/.vtt/.txt/.html/.png/.mp3/.avif` **در پوشه‌ای می‌مانند که سرو می‌شود**.
در وضعیت فعلی مخزن، ۶ مورد از همین نوع انبار شده بود و `repo:hygiene` هم «پاک»
گزارش می‌داد — چون آن ابزار فقط فایل‌های **tracked** را می‌نگرد و این‌ها untracked
بودند. یعنی یک فایل قابل‌دریافت در محصول، بدون هیچ سیگنالی.

سه لایهٔ اصلاح (هیچ‌کدام آستانه‌شل‌کن نیست):
- `healStaleArtifacts()` در **بارگذاری ماژول** آزمون: هر `e2e-*` که پیش از این
  اجرا وجود دارد، زائد اجرای قبلی است و پاک می‌شود ⇒ پوشه هرگز انبار نمی‌شود و
  یک اجرای شکست‌خورده اجرای بعدی را قرمز نمی‌کند (حلقهٔ بازخورد مثبت شکل نمی‌گیرد).
- تور ایمنی `process.on('exit')`: بازماندهٔ همین پروسه پاک می‌شود.
- `repo:hygiene` حالا پوشهٔ سروشده را هم مستقیم می‌نگرد: هر فایل با پیشوند رزرو
  `e2e-` ⇒ **نقض** (کد خروج ۱) با پیام صریح. پیشوند رزروشده است، پس هیچ آپلود
  واقعی محصول را هدف نمی‌گیرد.
- `.gitignore`: `public/uploads/e2e-*` — حتی اگر چیزی جا بماند، هرگز commit نمی‌شود.

سنجهٔ درون‌آزمونی عمداً بر پایهٔ `mtime` گذاشته **نشد**: آزمون‌ها هم‌زمان‌اند و
چنین سنجشی به‌طور تصادفی قرمز می‌شود؛ و آن قرمزِ تصادفی اجرا را وسط کار قطع
می‌کند و خودش زائد بیشتری جا می‌گذارد. سنجهٔ «صفر زائد» در `repo:hygiene` است.

**شاهد:** اجرای آزمون ۳ بار پیاپی از حالت پاک ⇒ `۱۷/۱۷` · خروج ۰ · `left=0` هر بار.
با ۲ زائد دست‌سازِ قدیمی ⇒ خودترمیمی، `۱۷/۱۷` سبز، `left=0`.
`repo:hygiene` با زائد دست‌ساز ⇒ خروج ۱ و نام‌بردن همان فایل؛ پس از خودترمیمی ⇒
خروج ۰ و «پاک» (بدون آبشار قرمزی).

**فایل‌های تغییر‌یافته:** `database/uploadsFile.js` · `database/uploadsSecurity.test.mjs` ·
`scripts/repo-hygiene.mjs` · `.gitignore`.
**تست:** `npm run uploads:security:test` — **۱۷/۱۷** سبز (۵ سنجهٔ پیشین + ۱۲ سنجهٔ
تازهٔ کش/Range/MIME) · در دروازه به‌عنوان گام `uploads:security:test`.

**وابستگی باقی‌مانده:** ذخیره‌سازی ابری/CDN خارج از دامنهٔ مخزن است.

**اقدام بعدی دقیق:** پیش از production، `public/uploads` را روی volume/CDN
منتقل کنید و مطمئن شوید سرو مستقیم وب‌سرور (بدون `server.js`) هدرهای همین
تابع را تکرار می‌کند — وگرنه سخت‌سازی بی‌اثر می‌شود.

---

## PHASE 8 — اعتبارسنجی کامل Schema ✅ VERIFIED

**وضعیت فعلی:** خط لولهٔ HTTP Input → Input Contract → Normalization → Domain
Model → Entity Validation → Persistence برقرار است.

**شواهد (ماشین‌خوان، `docs/audit/validation-coverage.json`):**
```
مسیرهای نوشتن: 134
  entity (اعتبارسنجی کامل مدل): 5
  object (فقط «بدنه یک شیء JSON است»): 125
  none   (بدون بدنه: آپلود جریانی/عملیات بدون payload): 4
  بدون قرارداد: 0
```
۴ مسیر بدون بدنه، **عمداً** بی‌بدنه‌اند: `POST /api/admin/media/demo/clear`،
`demo/seed`، `notifications/read-all`، `notifications/refresh`.

**بدهی مستند و صادقانه:** برچسب `object` یعنی «بدنه یک شیء JSON است»، **نه**
اعتبارسنجی شکل دقیق. شکل دقیق در هندلر سنجیده می‌شود. این بدهی پنهان نشده و در
خروجی ابزار هم صریح هشدار داده می‌شود.

**فایل‌های تغییر‌یافته:** `scripts/validation-coverage.mjs` (جدید) ·
`docs/audit/validation-coverage.json` (خروجی) · `package.json` (`audit:validation`).

**تست:** `npm run audit:validation` · `npm run api:input:test` · گام `api:contract:check`
(۱۳۴ مسیر نوشتن، ۰ بدون قرارداد) · گام `route:contracts:fresh`.

**اقدام بعدی دقیق:** برای مسیرهای حساس (کاربران، محتوا، انتشار) قرارداد `entity`
بنویسید تا از `object` به اعتبارسنجی مدل ارتقا یابند — کار تدریجی، هر مسیر یک PR.

---

## PHASE 9 — مشاهده‌پذیری واقعی ✅ VERIFIED

**وضعیت فعلی و آنچه اضافه شد:**
- **لاگ ساخت‌یافته:** یک خط JSON در هر درخواست (`accessLogLine`) با `reqId`.
- **لاگ پایدار + چرخش (جدید):** `appendLogLine` — خاموش به‌صورت پیش‌فرض؛ با
  `TAPESH_LOG_FILE` روشن می‌شود و `TAPESH_LOG_MAX_BYTES`/`TAPESH_LOG_KEEP`
  چرخش را کنترل می‌کنند. **همان خطِ حذف‌شدهٔ PII** روی دیسک هم می‌نشیند.
- **ردیابی خطای آمادهٔ اتصال (جدید):** `createErrorReporter`/`captureError` در
  `database/observability.js` و اتصالش در `server.js`. **بدون `TAPESH_ERROR_DSN`
  یک no-op کامل است** — هیچ درخواست شبکه‌ای نمی‌رود.
- **سلامت:** `/healthz` (liveness، بدون وابستگی) · `/readyz` (readiness، دیسک +
  artifact + رجیستری مدل) · `/metrics` فقط با توکن (بدون توکن ⇒ ۴۰۴).
- **خاموشی نرم:** SIGTERM/SIGINT با مهلت و کد خروج ۰.

**محرمانگی:** IP، User-Agent، Cookie، هدر و بدنه لاگ **نمی‌شوند**؛ query هرگز
وارد لاگ نمی‌شود؛ قطعه‌های مسیر با شکل ایمیل/تلفن/توکن حذف می‌شوند. در
ردیابی خطا هم پیام/پشته پاک‌سازی می‌شوند و کلیدهای حساس
(`token|secret|password|cookie|authorization|auth|dsn|key|credential`) **کامل حذف**
می‌شوند. جهت خطا **بیش‌حذفی** است، با یک استثنای عمدی: تاریخ (۸ رقم) قربانی
نمی‌شود چون تلفن نیست و در عیب‌یابی ارزش دارد.

**شاهد اجرای واقعی:** در یک اجرای سرور، `access.log` + `access.log.1` با سقف
۴KB ساخته شد و `grep -c "127.0.0.1"` روی لاگ **۰** داد (هیچ IP لو نرفت).

**Guardian:** فقط مشاهده/گزارش می‌کند. **به‌تنهایی هیچ‌وقت block، revoke،
quarantine، rollback یا تغییر کد نمی‌کند.**

**فایل‌های تغییر‌یافته:** `database/observability.js` · `server.js` ·
`database/logRotation.test.mjs` (جدید) · `database/observability.test.mjs`
(۴ سنجهٔ جدید برای ردیابی خطا) · `.env.example` · `docker-compose.staging.yml`.

**تست:** `npm run obs:test` — ۲۳/۲۳ سبز · `npm run log:test` — ۴/۴ سبز.

**وابستگی باقی‌مانده:** اتصال واقعی به Sentry/Rollbar بدون DSN معتبر
**تأییدنشده** است ⇒ `UNVERIFIED-EXTERNAL`. تجمیع متریک در چند پروسه ذخیره‌گاه
مشترک لازم دارد (همان محدودیت ثبت‌شدهٔ نشست‌ها).

**اقدام بعدی دقیق:** یک پروژهٔ Sentry بسازید، DSN را در secret manager بگذارید،
`TAPESH_ERROR_DSN` را ست کنید و با یک خطای عمدی، رسیدن رخداد را تأیید کنید.

---

## PHASE 10 — Publisher / AI / Payment 🟡 برچسب‌گذاری‌شدهٔ سه‌گانه

| قلم | برچسب | شاهد |
|---|---|---|
| آداپتورهای انتشار (بله/تلگرام/ایتا/اینستاگرام) | **IMPLEMENTED** | `database/publishers/*.js` — HTTP واقعی، `AbortController` با `PUBLISH_TIMEOUT_MS` (پیش‌فرض ۱۵s)، تشخیص ۴۲۹/`retry after`، نگاشت خطا (`platformError`)، `plan` خالص بدون شبکه |
| حالت آزمایشی سراسری | **IMPLEMENTED** | `PUBLISH_DRY_RUN=1` در `publishingStore.js:388,642` و `mediaStore.js:2972` — هیچ پیام واقعی نمی‌رود |
| گارد SSRF آدرس پایه | **IMPLEMENTED** | `database/publishers/urlGuard.js` — فقط http/https، بدون credential در URL، میزبان خصوصی/loopback/متادیتا ممنوع، شامل معادل‌های عددی IPv4؛ پیش‌فرض fail-closed |
| ثبت توکن هر کانال | **IMPLEMENTED** | `database/publishing.secrets.json` با مجوز `0600`، خارج از Git؛ متغیر محیطی فقط fallback |
| Circuit breaker | **IMPLEMENTED + گزارش‌شده** | `database/publishers/resilience.js` — مدارشکن پروسه‌ای به‌ازای هر پلتفرم؛ پس از ۵ شکست گذرای پیاپی باز می‌شود، ۶۰ ثانیه سریع شکست می‌دهد، سپس یک «کاوش» می‌دهد. خطای قطعی (۴۰۳/۴۰۰) مدار را **باز نمی‌کند**. کد خطای جدید ساخته نشد — مدار باز همان `PUBLISH_UNREACHABLE` (۵۰۲) با پرچم `circuitOpen` است تا جدول قرارداد API دست‌نخورده بماند. وضعیت هر پلتفرم در `GET /api/admin/publishing/channels` زیر کلید `circuits` گزارش می‌شود (فقط خواندنی). |
| سیاست تلاش مجدد | **IMPLEMENTED** | backoff نمایی؛ `verify`/`metrics` (خواندنی) ۲ تلاش، `send` **حداکثر یک‌بار** به‌صورت پیش‌فرض. دلیل: مهلت‌تمام‌شدن ارسال مبهم است و تکرار خودکار ⇒ پست تکراری. تکرار ارسال فقط با `options.retry === true`. فقط ۴۲۹/۵xx/مهلت/قطع ارتباط تکرار می‌شوند. |
| اتصال واقعی به پلتفرم‌ها | **UNVERIFIED-EXTERNAL** | هیچ توکن واقعی استفاده نشد؛ هیچ پیامی ارسال نشد |
| AI (تحلیلگر/دستیار) | **MOCKED** | `src/services/ai/mockAI.js` شبیه‌ساز است؛ `LLM_API_KEY` در کد فقط به‌عنوان `requires` اعلام شده و **هیچ فراخوانی HTTP ندارد** |
| Payment | **NOT IMPLEMENTED** | هیچ route/adapter/webhook/idempotency در کد نیست؛ فقط `PAYMENT_PROVIDER`/`PAYMENT_API_KEY` در `.env.example` به‌عنوان `CONFIGURED BUT UNUSED` |
| اعلان/هشدار | **CONFIGURED BUT UNUSED** | `ALERT_WEBHOOK_URL`/`ALERT_TELEGRAM_*` فقط خوانده می‌شوند برای برچسب «وصل/قطع»؛ مصرف‌کنندهٔ شبکه‌ای ندارند |

**تست:** `npm run publish:guard:test` · `npm run publish:resilience:test` (۱۲ سنجه) —
هر دو سبز. هیچ تستی «اتصال واقعی» را ادعا نمی‌کند.

**اقدام بعدی دقیق:** (۱) تصمیم محصول دربارهٔ پرداخت (پیاده‌سازی یا حذف کامل
متغیرها)؛ (۲) نمایش `circuits` در UI پنل (داده از قبل در پاسخ API هست، فقط
مصرف‌کنندهٔ نمایشی ندارد)؛ (۳) تأیید اتصال واقعی انتشار فقط با توکن sandbox و
تأیید مالک.

---

## PHASE 11 — پشتیبان / بازگردانی / ایمنی استقرار ✅ VERIFIED (محلی)

**وضعیت فعلی:** `scripts/deploy.mjs` حالا ترتیب کامل دارد:
پیش‌شرط محیط → `data:check` → **پشتیبان داده** → **dry-run مهاجرت** → build →
تأیید artifact → start → **health check**.

**شواهد:** اجرای واقعی `--skip-build` یک
`pre-deploy-development-20261002-134030.tar.gz` (۲۶۷KB) به‌همراه
`SHA256SUMS-pre-deploy-development-20261002-134030.txt` ساخت و dry-run مهاجرت
«تغییر لازم: ۰ · شکست: ۰» داد. پشتیبان‌گیری schema-محور است (دامنه از
`database/models/`) و چک‌سام SHA-256 دارد؛ بازگردانی **پیش از** نوشتن همه را
تأیید می‌کند (fail-closed ⇒ تشخیص خرابی).

**قاعدهٔ صریح که در سند ثبت شد: rollback کد هرگز به‌معنای rollback داده نیست.**

**رویهٔ بازگشت در صورت شکست:** نگه‌داشتن لاگ → `deploy --rollback` →
`/healthz` + `/readyz` → **فقط در صورت نیاز** `data-restore --apply` از
`pre-deploy-<env>` → سلامت + smoke.

**retention:** خودکار وجود ندارد؛ توصیهٔ عملیاتی (۷ روزانه + ۴ هفتگی + همهٔ
`pre-deploy-*` آخرین انتشار) و فرمان پاک‌سازی — **فقط با تأیید مالک** — در سند ثبت شد.

**تمرین بازگردانی:** `npm run backup:restore:test` — ۱۲ سنجه، روی ریشهٔ موقت
(به دادهٔ اصلی دست نمی‌زند).

**فایل‌های تغییر‌یافته:** `scripts/deploy.mjs` · `docs/ops/deployment-and-recovery.md`.

**اقدام بعدی دقیق:** یک‌بار `data-restore --apply` واقعی روی staging (نه
production) با تأیید مالک اجرا و نتیجه ثبت شود؛ و زمان‌بندی پشتیبان (cron/systemd
timer) روی سرور اضافه شود.

---

## PHASE 12 — مستندسازی API (OpenAPI) ✅ VERIFIED

**وضعیت فعلی:** `scripts/openapi-generate.mjs` از **منبع حقیقت** (`api-contract.json`)
سند OpenAPI 3.x می‌سازد. رفتار تغییر نکرده — فقط شکل استاندارد شده.

**شواهد:** `docs/api/openapi.json` — **۲۳۰ مسیر · ۱۶۶ path · ۲۸ کد خطای مدل‌شده**
(۲۳ کد در مسیرها استفاده می‌شود)؛ شامل schema درخواست/پاسخ/خطا و الزامات
احراز هویت/مجوز. `--check` برای **تشخیص drift** وجود دارد و در دروازه به‌عنوان
گام `api:openapi:check` اجرا می‌شود — سند بدون timestamp تولید می‌شود تا مقایسهٔ
بایت‌به‌بایت معنادار باشد. یک drift واقعی در همین نوبت دیده و رفع شد: افزودن
`PUBLISH_UNREACHABLE` به سورس اسکن‌شده شمارش «کدهای استفاده‌شده» را ۲۲→۲۳ برد و
`--check` درست شکست؛ با بازتولید سند هم‌گام شد.

**فایل‌های تغییر‌یافته:** `scripts/openapi-generate.mjs` (جدید) ·
`docs/api/openapi.json` (خروجی) · `package.json` (`api:openapi`, `api:openapi:check`).

**تست:** `npm run api:openapi:check` — exit 0 («OpenAPI هم‌گام است»).

**اقدام بعدی دقیق:** در CI یک گام «اگر `openapi.json` تغییر کرد ولی
`api-contract.json` نه ⇒ شکست» اضافه شود (هم‌اکنون `--check` همین را می‌سنجد و
در job `verify` اجرا می‌شود).

---

## PHASE 13 — دروازهٔ نهایی 🟠 آخرین اجرای کامل سبز · بازآزمایی ناتمام

**آخرین اجرای کامل (پیش از تغییرات بهداشت پوشهٔ سروشده) با نود ۲۲.۲۲.۲:**

```
گام‌ها: 43/43 موفق
زمان کل: ~140s
نتیجه: سبز
```

گام‌های کلیدی و نتیجه: `data:check` ۰ خطا · `data:test` ۲۵۷/۲۵۷ ·
`auth:test` ۷۸ قبول/۰ رد · `admin:test` ۹۵/۹۵ · `admin:rbac:test` ۶۴/۶۴ ·
`admin:security:test` ۶۰/۶۰ · `api:test` سبز · `obs:test` ۲۳/۲۳ ·
`log:test` ۴/۴ · `guardian:test` سبز · `router:test` ۱۲۸/۱۲۸ ·
`uploads:security:test` ۱۷/۱۷ · `publish:resilience:test` ۱۲/۱۲ ·
`backup:restore:test` ۱۲/۱۲ · `build:check` سبز ·
`perf:bundle` سبز · `seo:check` سبز · `api:contract:check` ۱۳۴ مسیر/۰ بدون قرارداد ·
`route:contracts:fresh` سبز · `data:migrate:dry` سبز · `smoke:test` ۱۷/۱۷ ·
`e2e:api` ۲۷/۲۷ · `api:openapi:check` سبز · `audit:validation` سبز ·
`e2e:browser` ۱۱/۱۱ جریان · `perf:load:local` سبز · `repo:hygiene` پاک.

**دادهٔ واقعی:** ۶ فایل توسط تست‌ها تغییر کرد و **همه بازگردانی شدند**
(`database/users.json`, `database/users.sessions.json`,
`database/content/{activity,admins,events,exams}.json`).

**بنچمارک راه‌اندازی سرور:** ۱۳۶ / ۱۴۰ / ۱۴۱ میلی‌ثانیه (کمینه ۱۳۶ms، میانه
۱۴۰ms) — هم‌راستا با خط پایهٔ اعلام‌شدهٔ ۱۳۵–۱۵۲ms.

**آزمون بار (اجرای واقعی):** ۱۸٬۲۴۹ درخواست · ۱۰۰٪ موفق · ۳۶۴۷.۷ rps ·
p50 ۲.۳ms · p95 ۵.۹ms · p99 ۸.۱ms · صفر خطای ۵xx · بدون نقض آستانه.

**بازآزمایی پس از تغییرات «بهداشت پوشهٔ سروشده» — ناتمام (صادقانه، نه سبز):**
دروازه پس از آن تغییرات دوباره اجرا شد و **به درخواست مالک در ۱۱m۴۶s متوقف شد**.
تا لحظهٔ توقف:
- `data:test` ⇒ **۲۵۶/۲۵۷**؛ سنجهٔ ناموفق: «dry-run تعمیر هیچ فایل داده‌ای را تغییر
  نداد» (`database/dataIntegrity.test.mjs:947`).
- گام‌های بعدی اجرا نشدند ⇒ وضعیتشان **نامعین** است، نه سبز.

**ریشه‌یابی همین شکست (شاهد، نه حدس):** همان ابزار در انزوا اجرا شد:
`node scripts/data-integrity.mjs --repair` ⇒ «اسکن‌شده: 544 · تغییر: 0 · بدون تغییر:
544 · فایل: 40 · هیچ نرمال‌سازی لازم نیست»، و اثر انگشت SHA-256 هیچ فایل محتوایی
تغییر نکرد. پس **خودِ تعمیر هیچ فایلی نمی‌نویسد** و شکست از نوشتنِ یک **نویسندهٔ
هم‌زمان** در همان بازهٔ اثر‌انگشت می‌آید — `dataFingerprint()` فهرست را پیش و پس از
`execFileSync` می‌گیرد و هر نوشتنِ موازی، آن را می‌شکند. قوی‌ترین نامزد:
`database/content/{activity,events}.json` که طبق مستندات خود پروژه با هر کنش ادمین
بازنویسی می‌شوند و در فهرست فایل‌های دادهٔ اعلام‌شده‌اند.
**اقدام بعدی دقیق:** سنجه باید فایل‌های تغییر‌کرده را **نام ببرد** (نه فقط شمارش) و
فایل‌های زمان‌اجرا (`activity`/`events`) از دامنهٔ اثر‌انگشت خارج یا زیر قفلِ نوشتن
محافظت شوند؛ سپس دروازه کامل بازآزمایی شود. **تا آن لحظه PHASE 13 سبز نیست.**

**ریشه‌یابی شکست‌های این نوبت (همه رفع شد):**
1. `e2e:browser` با «WebSocket is not defined» می‌شکست — **ریشه:** اجرا با نود ۲۰
   (`/usr/local/bin/node`) به‌جای نود ۲۲ مدیریت‌شده. راه‌حل: اجرا با مسیر نود ۲۲
   و پین‌کردن نسخه با `.nvmrc` + `engines`.
2. F9 (`ورود مدیر و CRUD واقعی`) متناوب بود — **ریشه:** در headless=new تنها
   تبِ فعال رخداد ورودی می‌گیرد؛ تبِ ساخته‌شده فعال نبود و
   `Input.dispatchMouseEvent` بی‌صدا گم می‌شد. راه‌حل: `Target.activateTarget` +
   `Page.bringToFront` + `Emulation.setFocusEmulationEnabled`، به‌علاوه یک
   **کاوشگر کلیک** که تأیید می‌کند رخداد `click` واقعاً ثبت شده است. جریان حالا
   پایدار است؛ در اجراهای باقی‌ماندهٔ نادر، مسیر جانشین سطح-DOM استفاده می‌شود و
   **در گزارش شمرده می‌شود** (`clickFallbacks`) — نه پنهان.

---

# A. مواردی که واقعاً با کد در همین مخزن حل شدند

۱. **باگ واقعی محصول:** پروفایل کاربر پس از بارگذاری کامل خالی نمایش داده می‌شد
   (`EditProfile.jsx`) — با افکت هم‌گام‌سازی رفع شد و با تست مرورگری اثبات شد.
۲. **بردار ذخیره‌شدهٔ XSS در `/uploads`:** پسوندهای اجرایی دیگر هم‌مبدأ و با نوع
   اجرایی سرو نمی‌شوند (octet-stream + attachment) + `nosniff`.
۳. **کش و بازه‌بندی رسانه‌های آپلودی:** `ETag`/`Last-Modified`/۳۰۴ روی همهٔ
   پاسخ‌ها، `Accept-Ranges` صادقانه، Range برای PDF و صدا (نه فقط ویدیو)،
   پاسخ درست ۴۱۶، و هم‌خوان‌سازی جدول MIME با فهرست درون‌مرورگری.
۴. **از دست رفتن کامل توکن‌های ربات:** نوشتن غیراتمیک فایل رازها در
   `publishingStore.js` و `mediaStore.js` ⇒ tmp→rename + `chmod 0600` پیش از rename.
۵. **E2E مرورگری واقعی و بدون وابستگی** برای ۱۱ جریان حیاتی، با اثبات از لاگ
   شبکه (نه فقط DOM) و بازگردانی کامل دادهٔ زمان‌اجرا.
۶. **لاگ پایدار با چرخش** با حفظ کامل قواعد حذف PII (بدون IP/UA/query/بدنه).
۷. **لایهٔ ردیابی خطای آمادهٔ اتصال** با پاک‌سازی PII و حذف کامل کلیدهای حساس؛
   بدون DSN یک no-op کامل.
۸. **CI واقعی با ۵ job** و حذف `continue-on-error` که شکست را پنهان می‌کرد؛
   نسخهٔ نود پین شد و نصب قطعی (`npm ci`).
۹. **پشتیبان خودکار پیش از استقرار + dry-run مهاجرت + health check** در
   `deploy.mjs`، و مسیر `--rollback` مستند.
۱۰. **Docker واقعاً سازگار با معماری** (`node:22-alpine`، غیر-روت، volume برای
    داده/آپلود/لاگ) و رفع باگ مالکیت دو مسیر نوشتنی که staging را با خطای دسترسی
    بالا می‌آورد.
۱۱. **گزارش ماشین‌خوان پوشش اعتبارسنجی** و **OpenAPI ۳.x با تشخیص drift** از
    منبع حقیقت.
۱۲. **رفع مثبت کاذب اسکنر راز** (`.env.example` دیگر CRITICAL نیست) — تا گزارش
    پاک‌سازی باورپذیر بماند.
۱۳. **مدارشکن + سیاست تلاش مجدد برای سرویس‌های بیرونی انتشار**
    (`database/publishers/resilience.js`): سرویس خراب سریع شکست می‌دهد، خطای قطعی
    مدار را باز نمی‌کند، و ارسال به‌صورت پیش‌فرض «حداکثر یک‌بار» است تا پست تکراری
    ساخته نشود. بدون افزودن کد خطای جدید به قرارداد API.
۱۴. **بستن یک کوری واقعی: زائد آزمون در پوشهٔ سروشده.** ۶ فایل `e2e-*` از یک
    اجرای نیمه‌کاره در `public/uploads/` انبار شده بود — یعنی فایل قابل‌دریافت در
    محصول — و `repo:hygiene` هم «پاک» می‌گفت، چون فقط فایل‌های tracked را می‌دید.
    اصلاح: خودترمیمی در بارگذاری آزمون + تور ایمنی `exit` + بررسی مستقیم پوشهٔ
    سروشده در `repo:hygiene` (نقض، کد خروج ۱) + `.gitignore`. هیچ آستانه‌ای شل نشد
    و هیچ سنجهٔ جدیدی بر پایهٔ `mtime` ساخته نشد (به‌دلیل تصادفی‌شدن با اجرای
    هم‌زمان آزمون‌ها).

# B. مواردی که فقط با سرور / GitHub / Staging قابل تأییدند (UNVERIFIED-EXTERNAL)

| مورد | چه چیزی لازم است |
|---|---|
| اجرای واقعی CI | یک push و runner گیت‌هاب؛ تأیید سبز شدن ۵ job در تب Actions |
| build و اجرای ایمیج Docker | میزبانی با docker: `docker build` + `compose up` + `ps` = healthy |
| staging واقعی | دامنه + سرور؛ سپس `healthz`/`readyz`/`load-test`/`e2e:browser` روی آن |
| اعداد معنادار آزمون بار | `LOAD_TEST_BASE_URL` واقعی؛ آستانه‌ها با تصمیم مالک || اتصال واقعی انتشار (بله/تلگرام/ایتا/اینستاگرام) | توکن sandbox و تأیید مالک؛ هیچ پیامی نباید بدون اجازه برود |
| اتصال Sentry/Rollbar | DSN واقعی + یک خطای عمدی برای تأیید رسیدن رخداد |
| ورود با گوگل | `GOOGLE_CLIENT_ID/SECRET` واقعی و ثبت redirect URI |
| پشتیبان‌گیری زمان‌بندی‌شده | cron/systemd timer روی سرور |
| تجمیع متریک/نشست در چند پروسه | ذخیره‌گاه مشترک — تصمیم معماری |

# C. مواردی که نیاز به تأیید مالک دارند

۱. **بازنویسی تاریخچهٔ Git** (۱۱ یافته، ۵ مورد critical شامل هش رمز مدیر و PII
   کاربران): ابزار و فرمان آماده است ولی **اجرا نشد**. پیش‌نیاز: پشتیبان
   `git bundle` + چرخش همهٔ credentialهای تاریخی + هماهنگی با همهٔ کلون‌ها.
   پیامد: force-push برگشت‌ناپذیر و واگرایی کلون‌های قدیمی.
۲. **نشست‌های ادمین فقط در حافظه‌اند** (`contentStore.js:918-919`): تصمیم
   «تک‌پروسه بماند» یا «به ذخیره‌گاه مشترک منتقل شود». بدون تأیید تغییر نکردم.
۳. **پرداخت:** هیچ پیاده‌سازی‌ای وجود ندارد؛ تصمیم محصول لازم است
   (پیاده‌سازی یا حذف کامل `PAYMENT_*` از `.env.example`).
۴. **AI:** فقط شبیه‌ساز است؛ تصمیم دربارهٔ اتصال واقعی به مدل زبانی.
۵. **retention پشتیبان:** پاک‌سازی نسخه‌های قدیمی برگشت‌ناپذیر است ⇒ فقط با
   تأیید صریح.
۶. **آستانه‌های آزمون بار:** هر تغییر آستانه باید بر پایهٔ اندازه‌گیری staging و
   با تصمیم مالک باشد، نه برای سبز شدن.
۷. **`database/content/activity.json` و `events.json` tracked‌اند** و هر اجرای
   ادمین آن‌ها را تغییر می‌دهد ⇒ نویز دائمی در diff. تصمیم دربارهٔ
   untrack کردن نیازمند تأیید مالک است.

---

## پیوست — فایل‌های این نوبت

**جدید:** `scripts/browser-e2e.mjs` · `scripts/load-test.mjs` ·
`scripts/load-test-local.mjs` · `scripts/openapi-generate.mjs` ·
`scripts/validation-coverage.mjs` · `scripts/secret-history-audit.mjs` ·
`database/logRotation.test.mjs` · `database/uploadsSecurity.test.mjs` ·
`database/publisherResilience.test.mjs` ·
`database/publishers/resilience.js` · `.nvmrc` · `Dockerfile` · `.dockerignore` ·
`docker-compose.staging.yml` · `docs/api/openapi.json` ·
`docs/audit/validation-coverage.json` · `docs/audit/browser-e2e.json` ·
همین گزارش.

**تغییر‌یافته:** `server.js` · `database/observability.js` ·
`database/uploadsFile.js` · `database/uploadsSecurity.test.mjs` ·
`database/publishingStore.js` · `database/mediaStore.js` ·
`database/publishers/index.js` · `database/adminApi.js` ·
`database/observability.test.mjs` · `database/adminApi.test.mjs` ·
`scripts/deploy.mjs` · `scripts/verify-all.mjs` · `scripts/server-smoke.mjs` ·
`scripts/repo-hygiene.mjs` · `.gitignore` ·
`package.json` · `.env.example` · `.github/workflows/ci.yml` ·
`src/layout/dashboard/setting/EditProfile.jsx` · `docs/ops/deployment-and-recovery.md`.

**توجه:** درخت کاری این مخزن تغییرهای نامرتبط دیگری هم دارد (مثلاً
`src/layout/articles/*`، بخش‌هایی از `src/layout/dashboard/*`،
`database/models/*`) که **بخشی از این مأموریت نیستند** و به آن نسبت داده نشده‌اند.
