# تپش وب — یادداشت بلندمدت

> روزانه: `.workbuddy-ai/memory/YYYY-MM-DD.md` · اسناد: `docs/{audit,api,data,security,ops}/` · تله‌های مک در `~/.workbuddy-ai/MEMORY.md`.

## قواعد
فارسی، مستقیم، کوتاه. فایل تازه فقط با درخواست صریح. **پیش از هر حذف: فهرست + تأیید.** `npm install`/`build` و تست رابط کاربری بدون درخواست اجرا نشود. تغییر توکن ⇒ همگام‌سازی `references/tokens.css` اسکیل `tapesh-design-system`؛ تغییر seed ⇒ بالا بردن نسخهٔ localStorage.

## تله‌ها
- `npm run` ⇒ `CODEBUDDY_BROKER_DENY` ⇒ مسیر مطلق node: `~/.workbuddy-ai/binaries/node/versions/22.22.2-2/bin/node`.
- `grep` در zsh بی‌صدا خراب ⇒ ابزار Grep · `curl` به loopback نمی‌رسد ⇒ `node:http`.
- `git checkout -- A B C` با یک pathspec غیرtracked بی‌صدا کل دستور را می‌شکند.
- **untracked:** `database/users.json` · `users.sessions.json` · `content/{exams,examAttempts,examAudit,examQuestions,examReports,feedback}.json` · `src/router/`.
- `content/events.json`: HEAD ۱٬۸۹۱ → دیسک ۰ (تصمیم ۳۰ سپتامبر، دست نزن).
- گارد حذف انبوه میزبان ⇒ «شکست کاذب» پاک‌سازی؛ معتبر ⇒ ترمینال معمولی. `dist/assets` ⇒ `dangerouslyDisableSandbox`.

## معماری
`services/<domain>/` + `layout/dashboard/<domain>/`؛ مسیریابی hash-driven با `SECTION_SUBVIEWS`/`sectionOf()` و `ROUTABLE_VIEWS`/`renderView`؛ **تشخیص پیشوندی ممنوع**. `src/router/` untracked ⇒ جهش با کپی پشتیبان.

## ناوردایی‌ها
- **احراز هویت:** `createUser` فقط CREATE (۴۰۹) · `updateUserProfileById` فقط UPDATE؛ **هرگز upsert**. `scrypt$salt$hash` (+SHA-256 legacy) · `authPolicy.js` خالص · منبع حقیقت `GET/PATCH /api/users/me`. تحویل توکن با **کوکی** `HttpOnly; SameSite=Strict`+`Secure` شرطی؛ **CSRF فعال** با `assertSameOrigin` روی ۷ نقطه. rate limit در `userRateLimit.js`.
- **RBAC:** مجوز مرزی `users.superadmin.manage` · `settings.security.manage`؛ `ADMIN_DENIED_PERMISSIONS`+`users.delete`. تغییر نقش خودِ بازیگر ممنوع · آخرین مدیر کل ⇒ ۴۰۹ · deny-by-default. ۸۰/۷۳/۴۵.
- **داده:** منبع حقیقت `database/models/` (نه `persistence/`). **`data:check` پیش و پس از هر تغییر**؛ `data:repair` dry-run. `normalize → validate → persist`. **گارد `storage_shape_mismatch` را حذف نکن.** `integrity.js` خالص.
- **ناظر:** `models/observe.js` ناظر است نه دروازه؛ تنها تزریق در `writeJson` `contentStore.js`؛ `TAPESH_MODEL_OBSERVE=1`.
- **انبار:** write اتمیک `tmp`→`rename`؛ هر seed thunk؛ خرابی JSON خاموش نیست (`storageCorruptionReport()` · `STORAGE_CORRUPT` · `TAPESH_STORAGE_CORRUPT_MODE=throw`).
- **`verify:all`:** ۲۶ گامه (۵ `xss:test` · ۲۲ `perf:bundle` · آخر `e2e:api`)؛ `data:check` گام اول. آلودگی: `users.sessions.json` · `content/{activity,admins,exams,settings}.json`.
- **API:** مرجع خطا `apiContract/errorModel.js`؛ `STATUS_BY_CODE = ADMIN_STATUS_BY_CODE` ⇒ کپی نکن. `users` شکل خطای متفاوت ⇒ یکسان‌سازی breaking. ۲۲۹ مسیر/۲۸ کد/۰ نقض. `explanation`/`correctAnswer`/`answerKey` فقط در DTO بانک تست ممنوع.
- **انتشار:** ۴ آداپتر (bale/eitaa/instagram/telegram)؛ بدون توکن صفر درخواست؛ retry ندارد. SSRF بسته با `publishers/urlGuard.js`.
- **پاک‌ساز HTML** (`database/sanitizeHtml.js`، محافظت‌شده): **خروجی = متنِ escape‌شده + فقط تگ‌های خوش‌ساختِ فهرست سفید**؛ هر `<` سرگردان ⇒ `&lt;` (باگ: `<(?![a-zA-Z/])` ⇒ XSS). `rel` نویسنده با `rel` امن قاطی نشود. قفل `xss:test` ۱۴ سنجه؛ **۵ sink در زمان رندر پاک می‌کنند، استثنا خالی.**
- **مشاهده‌پذیری:** `/healthz` · `/api/health` · `/readyz` · `/metrics` (بدون `TAPESH_METRICS_TOKEN` ⇒ ۴۰۴). لاگ یک‌خطی JSON؛ query/IP/UA/بدنه هرگز.

## عملیات
`deploy.mjs` · `data-restore.mjs` (dry-run/`--apply`) · `data-backup.mjs` · `repo:hygiene` · `bundle-budget.mjs`.
**NOT FOUND:** CI/CD · Docker · staging · CDN · backup زمان‌بندی‌شده · migration نسخه‌دار · OpenAPI (`.github/workflows/ci.yml` نوشته شده، **اجرا نشده**).
**build VERIFIED:** `vite build` exit 0، ۲۰٫۵s، ۵۹۵ ماژول. bundle: dist ۲۰۰٫۹MB · JS ۵٫۷۴MB.

## تست‌ها (baseline ۲۰۲۶-۱۰-۰۱)
مجموع **۹۴۸** (۱۸ سوییت؛ +`backup:restore:test` ۱۲) · `data:check` ۰ خطا · `api:contract:check` ۰ نقض · `npm audit` ۰. جزئیات: `docs/audit/phase-21-23/TEST-RESULTS.md`.
`e2e:api` بدون مرورگر و بدون نوشتن دادهٔ کاربری. تست جدا ⇒ آلودگی `content/{activity,admins}.json` ⇒ `git checkout --` همان دو. **اثبات حساسیت:** شکستن گارد ⇒ تست باید بشکند ⇒ برگردان + `shasum -c`.

## بدهی باز
- ۷ فایل `content/*.json` تغییرات commit‌نشدهٔ کاربر ⇒ دست نزن. `assertInputValid` در ۲ از ۱۱۷ مسیر · ۴ fixture در `users.json` · ۵ PNG در `public/uploads/`.
- ۵۳ از ۵۵ نشست یتیم · localStorage بدون نسخه (۱۰ کلید).
- `.git` ۲۱۹MB؛ `content/admins.json` (هش رمز) و `activity.json` (IP/UA) در تاریخچه ⇒ بازنویسی **نیازمند تأیید**.
- بلاکرها: staging ندارد · E2E مرورگری ندارد · SEO پیاده نشده.
