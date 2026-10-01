# ROLLBACK-PLAN — فازهای ۲۱–۲۳

> این نشست **هیچ تغییر مخربی** اعمال نکرد: نه migration داده، نه تغییر persistence، نه بازنویسی تاریخچهٔ Git،
> نه حذف کد/asset. بنابراین rollback برای «کار انجام‌شده» فقط حذف اسناد تولیدشده است.
> بخش‌های زیر برای **تغییرات پیشنهادی** فازهای ۲۱–۲۳ آماده شده‌اند.

## ۰. Rollback کار این نشست

| مورد | فایل‌های تولیدشده | Rollback |
|---|---|---|
| اسناد فاز ۲۱–۲۳ | `docs/audit/phase-21-23/*.md` | حذف پوشه (فایل تازه، بدون اثر زمان‌اجرا) |
| threat model | `docs/security/threat-model.md` | حذف فایل |
| تصمیم SEO | `docs/ops/seo-strategy.md` | حذف فایل |
| CI workflow | `.github/workflows/ci.yml` | حذف فایل (هیچ اثر زمان‌اجرا؛ اجرا فقط در GitHub) |
| E2E سطح API | `scripts/e2e-api-flows.mjs` | حذف فایل |
| رگرسیون XSS | `database/sanitizeHtmlXss.test.mjs` | حذف فایل |
| بودجهٔ باندل | `scripts/bundle-budget.mjs` | حذف فایل (فقط خواندن `dist/`؛ هیچ اثری روی artifact ندارد) |
| **بستن شکاف رندر** | `src/layout/dashboard/courses/reference/reader/ContentBlocks.jsx` (۲ خط) | بازگردانی import و `markHtml(block.html, …)` — rollback امنیت را عقب می‌برد |
| **رفع امنیتی پاک‌ساز** | `database/sanitizeHtml.js` (+۲۲/−۵) | **بازگردانی به نسخهٔ قبلی** — ولی ⚠️ نسخهٔ قبلی **آسیب‌پذیر** است (`<img src=x onerror=alert(1) title="unclosed>` خام رد می‌شد). rollback فقط برای رگرسیون رفتاری، نه برای عقب‌نشینی امنیتی |
| گام‌های دروازه | `scripts/verify-all.mjs` (۳ خط: `xss:test` · `perf:bundle` · `e2e:api`) | حذف همان سه خط (۲۶ → ۲۳ گام) |
| اسکریپت‌های npm | `package.json` (۴ خط) | حذف همان چهار خط |
| `database/usersApi.js` | جهش موقت برای اثبات حساسیت | **قبلاً بازگردانده شد**؛ `shasum -a 256 -c` ⇒ `OK` · پشتیبان: `/tmp/usersApi.js.e2e-backup` |
| لاگ دروازه | `.workbuddy-ai/phase-logs/*.log` | حذف فایل |
| یادداشت بلندمدت | `.workbuddy-ai/memory/MEMORY.md` | بازگردانی از نسخهٔ قبلی (فقط فشرده‌سازی، بدون حذف واقعیت) |
| تغییر `src/**` | **هیچ** | — |
| تغییر `index.html` / `dist/` | **هیچ** | — |
| تغییر تاریخچهٔ Git | **هیچ** | — |

## ۱. Rollback استقرار (کد و artifact)

`scripts/deploy.mjs` خودش rollback درون‌خطی دارد:

1. **عکس `dist` پیش از build:** اگر `dist` موجود باشد، پیش از build عکس گرفته می‌شود.
2. **شکست build ⇒ کد ۷:** `dist` قبلی دست‌نخورده می‌ماند.
3. **نبود عکس ⇒ کد ۸:** `fail(8, 'هیچ عکس dist معتبری برای بازگردانی نیست.')`
4. **artifact کهنه ⇒ کد ۷:** `dist/index.html` تازه‌تر از build نباشد ⇒ متوقف می‌شود.

**دستورالعمل rollback دستی:**

```bash
# ۱) توقف سرویس فعلی
# ۲) بازگردانی artifact قبلی از عکس dist
# ۳) تأیید تازگی و درستی
ls -lT dist/index.html
# ۴) اجرای دوبارهٔ دروازهٔ داده پیش از start
node scripts/data-integrity.mjs
# ۵) start
node server.js
```

## ۲. Rollback داده

`scripts/data-restore.mjs`:

- پیش‌فرض **dry-run** (بدون `--apply` هیچ‌چیز نوشته نمی‌شود).
- با `--apply` یک عکس `pre-restore-<stamp>` می‌گیرد (عکس معکوس) ⇒ rollback خودِ restore.
- گارد path traversal · `--root=DIR` برای محیط جدا.

```bash
node scripts/data-restore.mjs            # فقط گزارش
node scripts/data-restore.mjs --apply    # اعمال + عکس pre-restore
```

## ۳. Rollback schema / migration

- در حال حاضر **migration نسخه‌دار وجود ندارد** ⇒ rollback schema فعلاً بی‌موضوع.
- برای migration پیشنهادی (فاز ۲۱.۶) الزامات rollback:
  - هر migration باید `up` و `down` داشته باشد.
  - versioned + idempotent + قابل اجرای دوباره.
  - عکس کامل داده پیش از اجرا + checksum.
  - forward-fix به‌عنوان مسیر جایگزین وقتی `down` پرهزینه است.
  - ناسازگاری نسخهٔ جدید/قدیم در حین traffic: schema باید حداقل یک نسخه عقب‌سازگار باشد.

## ۴. Rollback پیکربندی

| تغییر | Rollback |
|---|---|
| متغیر محیطی (`NODE_ENV`, `PUBLIC_SITE_URL`, `TAPESH_METRICS_TOKEN`, …) | بازگردانی مقدار قبلی + restart؛ هیچ‌کدام در کد hardcode نیستند |
| `.gitignore` | بازگردانی فایل از Git |
| CI/CD پیشنهادی | غیرفعال‌کردن workflow + بازگشت به استقرار دستی (امروز مسیر موجود است) |

## ۵. Rollback سرّها و تاریخچهٔ Git

بازنویسی تاریخچه (`git filter-repo`) **ممنوع تا تأیید صریح**. اگر انجام شد، مسیر rollback:

1. عکس کامل repository پیش از rewrite (`git bundle create`).
2. clone آزمایشی و اجرای rewrite روی آن.
3. مقایسهٔ `git log` و درخت فایل‌ها پس از rewrite.
4. **reissue تمام سرّهای افشاشده** (`admins.json` هش رمز، `activity.json` داده) — rollback تاریخچه سرّ افشاشده را امن نمی‌کند.
5. اطلاع‌رسانی به مصرف‌کنندگان مخزن.

## ۶. ترتیب rollback پیشنهادی در حادثهٔ واقعی

```
۱. توقف traffic (یا بازگردانی artifact قبلی)
۲. عکس وضعیت فعلی داده (پیش از هر کاری)
۳. rollback کد/artifact
۴. rollback پیکربندی
۵. rollback داده فقط در صورت ناسازگاری schema
۶. اجرای data:check + smoke:test
۷. ثبت زمان، خطا و نتیجه در RISK-REGISTER / EVIDENCE-LOG
```

## ۷. معیار پذیرش rollback (وضعیت فعلی)

| معیار | وضعیت |
|---|---|
| deployment آزمایشی rollback شود | **UNVERIFIED** — drill واقعی انجام نشد |
| داده‌های سالم از بین نروند | VERIFIED در `backup:restore:test` (۱۲/۱۲) |
| rollback با دستورالعمل مستند انجام شود | VERIFIED — مسیرهای بالا مستند شد |
| زمان و خطاهای rollback ثبت شوند | UNVERIFIED — drill ثبت‌شده‌ای وجود ندارد |
