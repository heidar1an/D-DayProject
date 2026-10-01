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

# استقرار: بررسی داده → build → تأیید artifact
node scripts/deploy.mjs --env=production

# استقرار و اجرا
node scripts/deploy.mjs --env=production --start

# بازگردانی نسخهٔ قبلی dist (۳ نسخهٔ آخر نگه داشته می‌شود)
node scripts/deploy.mjs --rollback

# پشتیبان و بازگردانی داده
node scripts/data-backup.mjs --label=before-change
node scripts/data-restore.mjs --archive=.workbuddy-ai/backups/....tar.gz          # آزمایشی
node scripts/data-restore.mjs --archive=... --apply                               # واقعی

# اثبات اینکه restore کار می‌کند (روی دادهٔ واقعی نمی‌نویسد)
node scripts/backup-restore-test.mjs
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
| ۶ | `data:check` شکست خورد — استقرار متوقف شد |
| ۷ | build یا تأیید artifact شکست خورد |
| ۸ | rollback شکست خورد |
| ۹ | سرور با خطا بسته شد |

## ۳) پشتیبان‌گیری

- **دامنه:** همهٔ فایل‌های اعلام‌شده در `database/models/` (منبع حقیقت). فایل داده‌ای
  که در Schema نباشد، پشتیبان هم نمی‌گیرد — و همان‌جا خطر است.
- **نام‌گذاری:** `<label>-<YYYYMMDD-HHMMSS>.tar.gz` + `SHA256SUMS-<همان برچسب>.txt`
- **مقصد:** `.workbuddy-ai/backups/` (قابل تغییر با `--out=`)
- **یکپارچگی:** چک‌سام SHA-256 برای هر فایل؛ بازگردانی **پیش از** نوشتن همه را تأیید می‌کند
- **retention:** خودکار وجود ندارد — نگه‌داشتن/پاک‌کردن دستی است
- **بازگردانی:** پیش‌فرض آزمایشی؛ `--apply` پیش از نوشتن از فایل‌های فعلی عکس امنیتی
  در `.workbuddy-ai/backups/pre-restore-<stamp>/` می‌گیرد
- **تأییدشده:** زنجیرهٔ backup → verify → restore → مقایسهٔ بایت‌به‌بایت روی ریشهٔ موقت
  (`backup:restore:test`، ۱۲ سنجه)

## ۴) rollback

- **کد/برنامه:** پیش از هر build از `dist/` عکس گرفته می‌شود
  (`.workbuddy-ai/dist-snapshots/`) و ۳ نسخهٔ آخر نگه داشته می‌شود؛ `--rollback` تازه‌ترین
  عکس معتبر را برمی‌گرداند و از dist فعلی هم یک عکس `pre-rollback` می‌گیرد.
- **داده:** `data-restore --apply` با عکس امنیتی خودکار.
- **migration:** سیستم migration نسخه‌دار **وجود ندارد**؛ تنها ابزار موجود
  `data:repair` است (پیش‌فرض dry-run، `--apply` فقط با تأیید). برای تغییرهای
  غیرقابل‌برگشت، روش در دسترس **forward recovery** است: پشتیبان → تغییر → `data:check`،
  و در صورت شکست، بازگردانی از همان پشتیبان. rollback جدا برای migration تعریف نشده است.
- **ردیابی:** نام عکس‌ها زمان‌دار است و `deploy` تازگی `dist/index.html` را نسبت به
  شروع build تأیید می‌کند (artifact کهنه رد می‌شود).

## ۵) وضعیت صادقانه

| مورد | وضعیت |
|---|---|
| `/api/health` عمومی، بدون افشا، `POST` ⇒ ۴۰۵ | **VERIFIED** (`smoke:test`، ۳ سنجه) |
| `/healthz` / `/readyz` / `/metrics` | **VERIFIED** (`smoke:test`) |
| اسکریپت استقرار با ترتیب کنترل‌شده و کد خروج معنادار | **IMPLEMENTED + VERIFIED در dry-run** (گارد محیط و پیش‌شرط build با اجرای واقعی دیده شد) |
| build قابل‌تکرار از سورس فعلی | **UNVERIFIED — مسدود**: `node_modules/three/package.json` نصب نیست ⇒ `Rollup failed to resolve import "three"`. `dist/` فعلی کهنه است. |
| پشتیبان‌گیری + بازگردانی واقعی | **VERIFIED** (روی ریشهٔ موقت؛ روی دادهٔ اصلی اجرا نشد) |
| rollback برنامه | **IMPLEMENTED + VERIFIED در dry-run**؛ بازگردانی واقعی dist در این نوبت اجرا نشد |
| backup زمان‌بندی‌شده (cron/systemd timer) | **NOT FOUND** |
| CI/CD | **NOT FOUND** |
| Docker | **NOT FOUND** |
| staging واقعی | **NOT FOUND** |
| CDN | **NOT FOUND** |
| سیستم migration نسخه‌دار (dry-run/idempotent/log) | **NOT FOUND** (فقط `data:repair`) |
| استقرار روی production | **UNVERIFIED** — نیازمند محیط، credential و تأیید مالک |

## ۶) کنترل تغییرات (source control)

- `database/content/activity.json` و `database/content/events.json` دادهٔ زمان اجرا
  هستند و **tracked**‌اند؛ هر اجرای ادمین آن‌ها را تغییر می‌دهد ⇒ نویز در diff.
- `database/users.json` (شامل کاربران واقعی) در history است. حذف از history **انجام نشد**؛
  نیازمند تأیید صریح، پشتیبان، هماهنگی با همهٔ کلون‌ها و بازنویسی تاریخ است (`git filter-repo`).
- فایل‌های secret (`database/publishing.secrets.json`) با مجوز `0600` نگه داشته می‌شوند و
  در `git status` دیده می‌شوند — وضعیت tracked بودنشان **UNKNOWN** و نیازمند تصمیم مالک است.
