# استقرار، پشتیبان‌گیری و بازگردانی — تپش

> این سند دربارهٔ «فاز ۱۵ پیشنهادی» است. آن تقسیم‌بندی در `MASTER-AUDIT-2026-09-29.md`
> تعریف رسمی ندارد (بندهای ۱۱۸۸–۱۱۹۰ و ۱۹۴۷–۱۹۴۹)؛ پس نه roadmap رسمی است و نه
> تعهد قبلی. تنها آنچه در همین مخزن **اجرا و تأیید** شده اینجا ثبت شده است.

## ۱) محیط‌ها

| محیط | `TAPESH_ENV` / `NODE_ENV` | `PUBLIC_SITE_URL` | `dist/` | داده |
|---|---|---|---|---|
| development | `development` (پیش‌فرض) | اختیاری | از `vite dev` | `database/content/*.json` واقعی |
| test | `test` | اختیاری | لازم نیست | همان دادهٔ واقعی (تست‌ها در `finally` برمی‌گردانند) |
| staging | `staging` | **اجباری** | artifact ساخته‌شده | توصیه: کپی، نه دادهٔ اصلی |
| production | `production` | **اجباری** | artifact ساخته‌شده | دادهٔ اصلی |

گاردهای اجرایی (در `scripts/deploy.mjs`):

- `--env=production` بدون `NODE_ENV=production` اجرا **نمی‌شود** (کد خروج ۳) —
  جلوگیری از استقرار روی محیط اشتباه.
- `staging`/`production` بدون `PUBLIC_SITE_URL` اجرا نمی‌شوند (کد خروج ۳) —
  وگرنه `requestOrigin` به `localhost:5173` برمی‌گردد.
  برای استثنای عمدی: `TAPESH_ALLOW_LOCALHOST_ORIGIN=1`.

### متغیرهای محیطی

| متغیر | اجباری؟ | نبودنش ⇒ |
|---|---|---|
| `PORT` | خیر (پیش‌فرض `5173`) | سرور روی پیش‌فرض بالا می‌آید |
| `PUBLIC_SITE_URL` | در staging/production | استقرار متوقف می‌شود |
| `TAPESH_METRICS_TOKEN` | خیر | `/metrics` ⇒ **۴۰۴** (مسیر لو نمی‌رود) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | خیر | ورود با گوگل غیرفعال، بقیهٔ سایت سالم |
| `TAPESH_MODEL_OBSERVE` | خیر | ناظر نوشتن خاموش ⇒ صفر هزینه |
| `TAPESH_STORAGE_CORRUPT_MODE` | خیر | پیش‌فرض `degraded`؛ با `throw` خواندن fail-closed می‌شود |
| `TAPESH_ACCESS_LOG` | خیر | بدون آن، لاگ دسترسی نوشته نمی‌شود |
| `BALE_API_BASE` / `EITAA_API_BASE` / `TELEGRAM_API_BASE` | خیر | پیش‌فرض ثابت و امن |
| `TAPESH_PUBLISH_ALLOW_PRIVATE_BASE` | خیر | **فقط** برای mock محلی؛ پیش‌فرض بسته |
| `PUBLISH_TIMEOUT_MS` | خیر | پیش‌فرض ۱۵ ثانیه |

## ۲) فرمان‌های عملیاتی

```bash
# فقط بررسی (هیچ فایلی ساخته/عوض نمی‌شود)
node scripts/deploy.mjs --dry-run
node scripts/deploy.mjs --env=production --dry-run

# استقرار: بررسی داده → پشتیبان داده → dry-run مهاجرت → build → تأیید artifact
node scripts/deploy.mjs --env=production

# استقرار و اجرا (پس از start، روی /healthz سنجیده می‌شود)
node scripts/deploy.mjs --env=production --start

# اعمال واقعی مهاجرت‌ها (پیش‌فرض فقط dry-run است)
node scripts/deploy.mjs --env=production --apply-migrations

# استقرار روی artifact موجود (بدون build) — برای بازانتشار سریع
node scripts/deploy.mjs --env=staging --skip-build

# بازگردانی نسخهٔ قبلی dist (۳ نسخهٔ آخر نگه داشته می‌شود)
node scripts/deploy.mjs --rollback

# پشتیبان و بازگردانی داده
node scripts/data-backup.mjs --label=before-change
node scripts/data-restore.mjs --archive=.workbuddy-ai/backups/....tar.gz          # آزمایشی
node scripts/data-restore.mjs --archive=... --apply                               # واقعی

# مهاجرت داده (پیش‌فرض dry-run؛ فقط با --apply می‌نویسد)
node scripts/data-migrate.mjs
node scripts/data-migrate.mjs --apply

# اثبات اینکه restore کار می‌کند (روی دادهٔ واقعی نمی‌نویسد)
node scripts/backup-restore-test.mjs
```

### ترتیب اجرایی `deploy.mjs` (قرارداد)

```
۱. پیش‌شرط محیط    (env معتبر، NODE_ENV، PUBLIC_SITE_URL، node_modules)
۲. data:check      (یکپارچگی داده)
۳. data-backup     (برچسب: pre-deploy-<env>) ← بدون آن، استقرار متوقف می‌شود
۴. data-migrate    (dry-run؛ با --apply-migrations واقعی)
۵. build           (+ عکس dist پیش از build)
۶. تأیید artifact  (dist/index.html تازه و غیرخالی)
۷. start           (اختیاری، با --start)
۸. health check    (تا ۳۰ ثانیه روی /healthz)
```

### کدهای خروج `deploy.mjs`

| کد | معنا |
|---|---|
| ۰ | موفق |
| ۱ | خطای استفاده |
| ۲ | نام محیط نامعتبر |
| ۳ | ناهم‌خوانی محیط (گارد محیط اشتباه) |
| ۴ | `node_modules` نصب نیست |
| ۵ | پیش‌شرط build رد شد (وابستگی لازم نصب نیست) |
| ۶ | بررسی داده، **پشتیبان‌گیری**، **مهاجرت**، یا **اعمال مهاجرت** شکست خورد — استقرار متوقف شد |
| ۷ | build یا تأیید artifact شکست خورد |
| ۸ | rollback شکست خورد |
| ۹ | سرور با خطا بسته شد |

## ۳) پشتیبان‌گیری

- **دامنه:** همهٔ فایل‌های اعلام‌شده در `database/models/` (منبع حقیقت). فایل داده‌ای
  که در Schema نباشد، پشتیبان هم نمی‌گیرد — و همان‌جا خطر است.
- **نام‌گذاری:** `<label>-<YYYYMMDD-HHMMSS>.tar.gz` + `SHA256SUMS-<همان برچسب>.txt`
  (برچسب پیش‌فرض پیش از استقرار: `pre-deploy-<env>`)
- **مقصد:** `.workbuddy-ai/backups/` (قابل تغییر با `--out=`)
- **یکپارچگی:** چک‌سام SHA-256 برای هر فایل؛ بازگردانی **پیش از** نوشتن همه را تأیید می‌کند.
  تشخیص خرابی: اگر چک‌سام یکی از فایل‌ها نخواند، بازگردانی رد می‌شود (fail-closed) و
  چیزی روی دیسک نوشته نمی‌شود.
- **retention:** خودکار وجود ندارد — نگه‌داشتن/پاک‌کردن دستی است. توصیهٔ عملیاتی:
  نگه‌داشتن ۷ نسخهٔ روزانه + ۴ نسخهٔ هفتگی + همهٔ `pre-deploy-*` آخرین انتشار.
  پاک‌سازی با `ls -t .workbuddy-ai/backups/*.tar.gz | tail -n +12 | xargs rm` — **فقط پس از
  تأیید مالک**؛ این فرمان برگشت‌پذیر نیست.
- **بازگردانی:** پیش‌فرض آزمایشی؛ `--apply` پیش از نوشتن از فایل‌های فعلی عکس امنیتی
  در `.workbuddy-ai/backups/pre-restore-<stamp>/` می‌گیرد
- **تأییدشده:** زنجیرهٔ backup → verify → restore → مقایسهٔ بایت‌به‌بایت روی ریشهٔ موقت
  (`backup:restore:test`، ۱۲ سنجه)
- **تمرین بازگردانی (restore drill):** `npm run backup:restore:test` — روی ریشهٔ موقت اجرا
  می‌شود و به دادهٔ اصلی دست نمی‌زند. توصیه: پیش از هر انتشار مهم یک‌بار اجرا شود.

## ۴) rollback

- **کد/برنامه:** پیش از هر build از `dist/` عکس گرفته می‌شود
  (`.workbuddy-ai/dist-snapshots/`) و ۳ نسخهٔ آخر نگه داشته می‌شود؛ `--rollback` تازه‌ترین
  عکس معتبر را برمی‌گرداند و از dist فعلی هم یک عکس `pre-rollback` می‌گیرد.
- **داده:** `data-restore --apply` با عکس امنیتی خودکار.
- **⚠️ قاعدهٔ صریح: rollback کد هرگز به‌معنای rollback داده نیست.** کد را برگرداندن،
  دادهٔ نوشته‌شده با کد جدید را برنمی‌گرداند. اگر مهاجرت داده اجرا شده باشد، بازگشت
  کد می‌تواند داده را **ناخوانا** کند. پس همیشه: اول کد را برگردان، `/healthz` را ببین،
  و **تنها اگر** لازم بود داده را از `pre-deploy-<env>` بازگردان.
- **migration:** سیستم مهاجرت **نسخه‌دار** وجود دارد (`database/migrations/registry.js` +
  `runner.js`، اجرا با `scripts/data-migrate.mjs`). پیش‌فرض **dry-run** است و فقط با
  `--apply` (یا `--apply-migrations` در deploy) می‌نویسد. هر مهاجرت idempotent است و
  وضعیت اعمال‌شده ثبت می‌شود.
- **ردیابی:** نام عکس‌ها زمان‌دار است و `deploy` تازگی `dist/index.html` را نسبت به
  شروع build تأیید می‌کند (artifact کهنه رد می‌شود).

### رویهٔ بازگشت در صورت شکست استقرار (ترتیب اجباری)

```
۱. لاگ‌ها را نگه دار        (.workbuddy-ai/verify-logs/ + لاگ دسترسی)
۲. کد را برگردان            node scripts/deploy.mjs --rollback
۳. سلامت را ببین            curl -fsS http://<host>/healthz && curl -fsS http://<host>/readyz
۴. فقط در صورت نیاز، داده   node scripts/data-restore.mjs --archive=.workbuddy-ai/backups/pre-deploy-<env>-….tar.gz --apply
۵. دوباره سلامت + smoke     curl /healthz  ·  npm run smoke:test
```


## ۵) وضعیت صادقانه

| مورد | وضعیت |
|---|---|
| `/api/health` عمومی، بدون افشا، `POST` ⇒ ۴۰۵ | **VERIFIED** (`smoke:test`) |
| `/healthz` / `/readyz` / `/metrics` | **VERIFIED** (`smoke:test`) |
| اسکریپت استقرار با ترتیب کنترل‌شده و کد خروج معنادار | **VERIFIED** — `--dry-run` و `--skip-build` واقعاً اجرا شد؛ پشتیبان `pre-deploy-*` + dry-run مهاجرت + health probe دیده شد |
| پشتیبان‌گیری خودکار پیش از استقرار | **VERIFIED** (داخل `deploy.mjs`؛ در اجرای واقعی یک `pre-deploy-development-*.tar.gz` ساخت) |
| health check پس از `--start` | **IMPLEMENTED + VERIFIED در کد**؛ مسیر «پاسخ نداد» در این محیط دیده نشد |
| خاموشی نرم (SIGTERM/SIGINT + مهلت) | **VERIFIED** — سرور با SIGTERM و کد خروج ۰ بسته شد |
| build قابل‌تکرار از سورس فعلی | **VERIFIED** — `vite build` واقعی سبز، `build:check` سبز |
| پشتیبان‌گیری + بازگردانی واقعی | **VERIFIED** (روی ریشهٔ موقت؛ روی دادهٔ اصلی اجرا نشد) |
| rollback برنامه | **IMPLEMENTED + VERIFIED در dry-run**؛ بازگردانی واقعی dist در این نوبت اجرا نشد |
| سیستم migration نسخه‌دار (dry-run/idempotent) | **VERIFIED** (`data:migrate`؛ dry-run روی دادهٔ واقعی: «تغییر لازم: ۰، شکست: ۰») |
| CI (GitHub Actions) | **IMPLEMENTED-BUT-UNVERIFIED-EXTERNAL** — `.github/workflows/ci.yml` با ۵ job؛ تا روی runner واقعی اجرا نشود، سبز اعلام نمی‌شود |
| Docker / docker-compose staging | **IMPLEMENTED-BUT-UNVERIFIED** — `Dockerfile` + `docker-compose.staging.yml`؛ docker در این محیط نصب نیست |
| staging واقعی | **NOT FOUND** — راه‌اندازی نیازمند سرور مالک است |
| backup زمان‌بندی‌شده (cron/systemd timer) | **NOT FOUND** — نیازمند تصمیم مالک (زمان‌بندی روی سرور) |
| CDN | **NOT FOUND** — خارج از دامنهٔ مخزن |
| استقرار روی production | **UNVERIFIED** — نیازمند محیط، credential و تأیید مالک |

## ۵.۱) اجرای staging با Docker

```bash
cp .env.example .env.staging        # مقادیر staging را پر کنید (credential واقعی production نه)
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
docker compose -f docker-compose.staging.yml ps          # باید healthy بدهد
curl -fsS http://127.0.0.1:${STAGING_PORT:-4173}/healthz
curl -fsS http://127.0.0.1:${STAGING_PORT:-4173}/readyz
docker compose -f docker-compose.staging.yml logs -f tapesh
```

نکات پیکربندی که در فایل رعایت شده است:

- **هیچ credential در فایل نیست** — همه از `--env-file` می‌آید و `.env.staging` زیر
  الگوی `.env` در `.gitignore` است.
- **سه volume پایدار:** `tapesh-data:/app/database`، `tapesh-uploads:/app/public/uploads`،
  `tapesh-logs:/app/logs` (آخری برای لاگ دسترسی پایدار).
- **healthcheck روی `/healthz`** با `start_period: 10s` — منطبق با قرارداد liveness سرور.
- **`stop_grace_period: 20s`** — بزرگ‌تر از `TAPESH_SHUTDOWN_GRACE_MS` (پیش‌فرض ۱۰ ثانیه)
  تا ارکستریتور پیش از SIGKILL فرصت خاموشی نرم بدهد.
- **`PUBLISH_DRY_RUN: 1`** پیش‌فرض staging است تا انتشار واقعی ناخواسته رخ ندهد.
- **دو مسیر نوشتنی در ایمیج ساخته و به `node` واگذار می‌شود** (`/app/logs`،
  `/app/public/uploads`) — وگرنه داکر آن‌ها را با مالک root می‌سازد و کاربر غیر-روت
  نمی‌تواند بنویسد.


## ۶) کنترل تغییرات (source control)

- `database/content/activity.json` و `database/content/events.json` دادهٔ زمان اجرا
  هستند و **tracked**‌اند؛ هر اجرای ادمین آن‌ها را تغییر می‌دهد ⇒ نویز در diff.
- `database/users.json` (شامل کاربران واقعی) در history است. حذف از history **انجام نشد**؛
  نیازمند تأیید صریح، پشتیبان، هماهنگی با همهٔ کلون‌ها و بازنویسی تاریخ است (`git filter-repo`).
- فایل‌های secret (`database/publishing.secrets.json`) با مجوز `0600` نگه داشته می‌شوند و
  در `git status` دیده می‌شوند — وضعیت tracked بودنشان **UNKNOWN** و نیازمند تصمیم مالک است.
