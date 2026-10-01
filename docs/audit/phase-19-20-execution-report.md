# Phase 19/20 Execution Report

**تاریخ اجرا:** ۲۰۲۶-۱۰-۰۱ · **بازوی اجرا:** `main` @ `a86d875`
**وضعیت کلی:** `PARTIALLY VERIFIED` — هیچ‌کدام از دو فاز `VERIFIED` کامل نیست.

---

## 1. Scope Notice

**Phase 19 و Phase 20 در `MASTER-AUDIT-2026-09-29.md` هیچ تعریف رسمی، roadmap،
Scope، Deliverable یا معیار پذیرشی ندارند.** این دو فاز، scope **پیشنهادی** این
گزارش‌اند و نباید به‌عنوان roadmap رسمی پروژه معرفی شوند.

هر ادعای این سند یا با اجرای واقعی (تست، build، اسکنر، اسکریپت) پشتیبانی شده
یا صریحاً `UNKNOWN` / `UNVERIFIED` / `BLOCKED` علامت خورده است. **وجود کد، فایل،
adapter یا متغیر محیطی به‌تنهایی «فعال بودن قابلیت» شمرده نشده است.**

منابع ممیزی مرجع: `MASTER-AUDIT-2026-09-29.md:277` · `:290-316` · `:871-872` ·
`:1011` · `:1020` · `:1092` · `:1096-1117` · `:1143-1144` · `:1164-1173` ·
`:1885` · `:1924-1938`.

---

## 2. Baseline

| مورد | مقدار |
|---|---|
| Branch | `main` |
| Commit | `a86d875` |
| وضعیت git پیش از شروع | **۱۵۱ ورودی** modified/untracked — کار uncommitted کاربر |
| Package manager | npm (`package-lock.json`، lockfileVersion معتبر) |
| Runtime | node `22.22.2` (managed) |
| Build status پیش از شروع | **BLOCKED** — `node_modules/three` یک stub ناقص بود |
| Test status پیش از شروع | ۱۶ سوییت سبز (۹۰۷ سنجه) — بازتأیید شد |
| دادهٔ اسکن‌شده | ۴۳ فایل · ۱٬۵۴۱ رکورد · ۰ خطا · ۲۲ هشدار |
| محدودیت محیط | `npm install` ⇒ `CODEBUDDY_BROKER_DENY` · `mkdir` بیرون از workspace مسدود · `timeout` وجود ندارد · `grep` در zsh بی‌صدا خراب است |

**هیچ تغییر uncommitted کاربر حذف، reset، checkout یا overwrite نشد.**
تنها سه فایل داده که در شروع جلسه **نسبت به HEAD تمیز** بودند و در اثر اجرای
تست‌ها آلوده شدند، پس از اثبات با `git hash-object` به HEAD برگردانده شدند
(بخش ۴).

---

## 3. Changes Made

| # | فایل | هدف | ریسک | شاهد ممیزی | تست |
|---|---|---|---|---|---|
| ۱ | `scripts/theme-contrast.mjs` | رفع **سبزِ کاذب**: اسکریپت `src/styles.css` را می‌خواند که پس از بازآرایی فقط زنجیرهٔ `@import` است ⇒ صفر توکن می‌خواند و «۰ ایراد» با کد خروج ۰ برمی‌گرداند. حالا زنجیرهٔ import را باز می‌کند و اگر هیچ توکن هگزی پیدا نشود با کد ۲ **fail-closed** می‌شود. | کم (فقط اسکریپت) | `:1885` (اجرای واقعی theme-contrast تأیید نشده بود) | اجرای مستقیم: ۴۴ جفت سنجیده شد، ۰ ایراد |
| ۲ | `scripts/theme-verify.mjs` | رفع **شکستِ کاذب**: همان علت — همهٔ توکن‌های جهانی «گم‌شده» گزارش می‌شدند و دروازهٔ `theme:check` با ۱۰۹ مشکل و کد ۱ می‌شکست. | کم (فقط اسکریپت) | — | اجرای مستقیم: `all good`، exit 0 |
| ۳ | `.gitignore` | سیاست دادهٔ زمان‌اجرا: `activity/admins/events/publishLog/mediaMetrics` به فهرست ignore اضافه شد تا **در آینده** track نشوند. | کم | `:1096-1117` (runtime data tracked) | `repo:hygiene` وضعیت را گزارش می‌کند |
| ۴ | `scripts/repo-hygiene.mjs` | **دروازهٔ تازهٔ بهداشت مخزن**: سرّ در فایل tracked، فایل حجیم tracked، دادهٔ زمان‌اجرای tracked. فقط می‌خواند. مناسب pre-commit/CI. | کم (فایل تازه، بدون اثر runtime) | `:1924-1938` (Git hygiene) | اجرای واقعی: ۰ سرّ · ۱۳ فایل حجیم · ۵ دادهٔ زمان‌اجرا · ۱۸ یافته |
| ۵ | `package.json` | افزودن `"repo:hygiene"` · `"theme:scripts:test"` به `scripts`. | کم | — | همان اجرای بالا |
| ۵.۱ | `scripts/theme-scripts.test.mjs` | **قفل رگرسیون برای تغییر ۱ و ۲** — بدون این، هر دو نقص می‌توانستند بی‌صدا برگردند. سه چیز را قفل می‌کند: سنجش واقعی روی درخت واقعی · بازشدن زنجیرهٔ `@import` · fail-closed بودن گارد. | کم (فایل تازه) | قاعدهٔ «هر تغییر باید تست داشته باشد» | **۴/۴ سبز** + **اثبات حساسیت:** برگرداندن عمدی `theme-contrast` به خواندن مستقیم ⇒ **۲ شکست**؛ بازگردانی با `shasum -c` تأیید شد |
| ۵.۲ | `--root=DIR` در `theme-contrast.mjs` / `theme-verify.mjs` | قابل‌آزمون‌کردن گارد روی درخت موقت (الگو از `data-restore.mjs`). پیش‌فرض بدون آرگومان **بدون تغییر**. | کم | — | تست ۳ و ۴ روی ریشهٔ موقت |
| ۶ | `node_modules/three` | **ترمیم محیط**: پکیج ناقص بود (بدون `package.json`، `build/three.cjs` فقط ۶۳۱ بایت). از tarball رسمی با `integrity` **تطبیق‌داده‌شده با lockfile** بازگردانده شد. | کم (gitignored، بازسازی‌شدنی) | `:277` (build status) | `sha512` tarball == `package-lock.json` ⇒ `MATCH true` |
| ۷ | `dist/` | Build واقعی تولید شد (پیش‌تر artifact از ۱۸ سپتامبر کهنه بود). | صفر (gitignored) | `:277` | `vite build` ⇒ exit 0 در ۲۰٫۴۷s |
| ۸ | `docs/data/phase-19-data-inventory-and-ownership.md` | سند ۱۹.۱: inventory + ownership matrix + sensitivity + dependency map. | صفر | `:290-316` | داده‌ها از اجرای واقعی ابزارها |
| ۹ | `docs/audit/phase-20-dead-code-and-artifact-inventory.md` | سند ۲۰.۱/۲۰.۲: ۸ فایل بدون ارجاع · ۱ ماژول مرده · ۳ کلید env بی‌مصرف · ۱۳ فایل حجیم · تاریخچهٔ گیت. | صفر | `:1924-1938` | `repo:hygiene` + گراف ارجاع |
| ۱۰ | همین سند | گزارش اجرای فاز ۱۹/۲۰. | صفر | — | — |
| ۱۱ | `scripts/verify-all.mjs` | افزودن **نگه‌داشتِ خروجی کامل گام‌های ناموفق** در `.workbuddy-ai/verify-logs/`. همین تغییر بود که علت ریشه‌ای هر ۳ شکست را قابل‌دیدن کرد. | کم | قاعدهٔ ۱۰ | `planning-test.log` و `admin-security-test.log` علت را بی‌واسطه نشان دادند |
| ۱۲ | `scripts/verify-all.mjs` | `data:check` از گام ۱۹ به گام **۱** منتقل شد (پیش‌پرواز: «پیش از تست، داده سالم است؟»). | متوسط (ترتیب دروازه) | بخش ۴.۲ بند ۲ | اجرای پس از رفع: بخش ۴.۳ |
| ۱۳ | `scripts/verify-all.mjs` | تشخیص/اعلام گاردِ حذفِ میزبان (`deleteGuard` در `--json` + هشدار) و تبدیل ۳ حذفِ داخلی به helper `tryRemove`. | کم | بخش ۴.۲ بند ۳ | دروازه‌ای که وسط کار بمیرد هیچ نتیجه‌ای تولید نمی‌کند |
| ۱۴ | `scripts/planning-service-test.mjs` | پاک‌سازیِ نهایی به «تلاش + هشدار». پاک‌سازی assert نیست. | کم | بخش ۴.۲ بند ۱ | `planning:test` در اجرای پیاپی ۲۳ گام سبز شد |
| ۱۵ | `database/adminSecrets.test.mjs` | همان، برای دو نقطهٔ `unlink` (helper محلی `safeUnlink`). **هیچ assertی تغییر یا حذف نشد.** | کم | بخش ۴.۲ بند ۱ | بخش ۴.۳ |

**فایل‌های حساس دست‌نخورده:** `database/adminApi.js` · `database/contentStore.js` ·
`database/sanitizeHtml.js` · auth/session modules · publisher adapters ·
routeهای public و admin — **هیچ‌کدام ویرایش نشدند.**

---

## 4. Verification Results

| check | command | result | status | evidence |
|---|---|---|---|---|
| Build | `node node_modules/vite/bin/vite.js build` | **exit 0** · ۲۰٫۴۷s · ۵۹۵ ماژول | **VERIFIED** | `dist/index.html` تازه؛ ۱۹ chunk JS + ۱۰ chunk CSS |
| Bundle — JS کل | اندازه‌گیری `dist/assets` | ۵٫۷۴MB / ۱۹ فایل | **VERIFIED** | بزرگ‌ترین: `mockData` ۱٫۸۵MB · `index` ۱٫۶۰MB · `admin` ۱٫۰۰MB · `three` ۰٫۵۶MB |
| Bundle — CSS کل | همان | ۹۳۲KB / ۱۰ فایل | **VERIFIED** | `index-*.css` ۷۲۸KB |
| `data:test` | `node database/dataIntegrity.test.mjs` | exit 0 | **VERIFIED** | — |
| `auth:test` | `node database/usersAuth.test.mjs` | exit 0 · ۷۸ قبول · ۰ رد | **VERIFIED** | — |
| `bank:test` | `node database/testBankSecurity.test.mjs` | exit 0 · ۴۰/۴۰ | **VERIFIED** | — |
| `exam:test` | `node database/examApi.test.mjs` | exit 0 · ۲۷/۲۷ | **VERIFIED** | — |
| `domain:test` | `node --test scripts/domain-tests.mjs` | exit 0 · ۲۲ pass · ۰ fail | **VERIFIED** | — |
| `planning:test` | `node scripts/planning-service-test.mjs` | exit 0 · ۳۴ موفق · ۰ ناموفق | **VERIFIED** | اجرای مستقل |
| `admin:test` (۳ سوییت) | `adminApi` + `adminRbac` + `adminSecrets` | exit 0 · ۹۲ + ۶۴ + ۶۰ = **۲۱۶** | **VERIFIED** | `adminApi.test.mjs` و `examApi.test.mjs` **واقعاً اجرا شدند** (شکاف ممیزی `:1164-1173` بسته شد) |
| `api:test` | `node --test database/apiContract.test.mjs` | exit 0 · ۳۱ pass | **VERIFIED** | — |
| `api:input:test` | `node --test database/inputGate.test.mjs` | exit 0 · ۱۳ pass | **VERIFIED** | — |
| `obs:test` | `node --test database/observability.test.mjs` | exit 0 · ۱۷ pass | **VERIFIED** | شامل redaction مسیر/توکن/IP |
| `router:test` | `node scripts/router-test.mjs` | exit 0 · ۱۲۸ قبول · ۰ رد | **VERIFIED** | — |
| `content:atomic:test` | `node --test ...AtomicWrite.test.mjs` | exit 0 · ۹ pass | **VERIFIED** | — |
| `content:hotpath:test` | `node --test ...HotPath.test.mjs` | exit 0 · ۶ pass | **VERIFIED** | — |
| `storage:test` | `node --test ...Corruption.test.mjs` | exit 0 · ۶ pass | **VERIFIED** | — |
| `publish:guard:test` | `node --test ...UrlGuard.test.mjs` | exit 0 · ۹ pass | **VERIFIED** | SSRF |
| `smoke:test` | `node scripts/server-smoke.mjs` | exit 0 · ۱۷/۱۷ | **VERIFIED** | اجرای مستقل و در `verify:all` |
| `backup:restore:test` | `node scripts/backup-restore-test.mjs` | exit 0 · ۱۲ موفق · ۰ شکست | **VERIFIED** | زنجیرهٔ واقعی روی ریشهٔ موقت |
| `data:check` | `node scripts/data-integrity.mjs` | **exit 0** · خطا=۰ · هشدار=۲۲ · رکورد=۱٬۵۴۷ · فایل=۴۳ | **VERIFIED** | پس از بازگردانی آلودگی تست (عدد رکورد با باقی‌ماندهٔ اجرای تست‌ها چند واحد نوسان دارد) |
| `api:contract:check` | `node scripts/api-contract.mjs --check` | exit 0 · ۲۲۹ مسیر · ۲۸ کد خطا · ۱۱ DTO · ۰ نقض | **VERIFIED** | — |
| `api:client` | `node scripts/client-contract-audit.mjs` | exit 0 · ۴۲۵ فایل · ۰ تماس شکسته | **VERIFIED** | ۱۵ تماس واقعی · ۱۴۶ مستند · ۱۲۲ پیاده‌نشده |
| `audit:api:selftest` | `node scripts/api-input-audit.mjs --selftest` | exit 0 | **VERIFIED** | — |
| `theme:contrast` | `node scripts/theme-contrast.mjs` | exit 0 · ۴۴ جفت · ۰ ایراد | **VERIFIED** (پس از تغییر ۱) | قبل از تغییر: ۰ جفت سنجیده — سبزِ کاذب |
| `theme:verify` | `node scripts/theme-verify.mjs` | exit 0 · `all good` | **VERIFIED** (پس از تغییر ۲) | قبل: ۱۰۹ مشکل |
| `theme:tailwind` | `node scripts/tailwind-probe.mjs` | exit 0 · ۹/۹ قبول | **VERIFIED** | — |
| `repo:hygiene` | `node scripts/repo-hygiene.mjs` | exit 1 · ۱۸ یافته | **VERIFIED** (یافته‌ها واقعی‌اند) | ۰ سرّ · ۱۳ حجیم · ۵ runtime |
| `theme:scripts:test` | `node --test scripts/theme-scripts.test.mjs` | **exit 0 · ۴/۴ pass** | **VERIFIED** | اثبات حساسیت: جهش ⇒ ۲ شکست ⇒ بازگردانی با `shasum -c` |
| `verify:all` | `node scripts/verify-all.mjs` | **۲۳/۲۳ موفق · exit 0 · نتیجه: سبز · ۴۳۷٫۷s** (پس از رفع — بخش ۴.۳) | **VERIFIED** | پیش از رفع: ۲۰/۲۳ در سه اجرای مستقل |
| `theme:render` (`verify-render.mjs`) | اجرا نشد | — | **NOT EXECUTED** | به‌دستور صریح کاربر: تست رابط کاربری گرفته نشد |

### ۴.۱ دو نقص واقعی که در مسیر اجرا کشف و رفع شد

**(الف) `theme-contrast.mjs` سبزِ کاذب بود.** توکن‌های تم در
`src/styles/tokens.css` زندگی می‌کنند و `src/styles.css` (۵۴۲ بایت) فقط
`@import` است. اسکریپت به `src/styles.css` قفل بود، پس `dark`/`light` هر دو
**خالی** می‌شدند و همهٔ ۴۴ جفت «توکن غیر هگز — بررسی نشد» می‌گرفتند و در پایان
**«۰ ایراد» با کد خروج ۰** چاپ می‌شد. یعنی دروازهٔ دسترس‌پذیری هیچ‌چیز را
نمی‌سنجید ولی سبز گزارش می‌داد. پس از رفع: ۴۴ جفت واقعاً سنجیده شد؛
بدترین مورد `AA-large` است و **هیچ `LOW` وجود ندارد**.

**(ب) `theme-verify.mjs` شکستِ کاذب بود.** همین علت، ولی اثر معکوس: همهٔ ۶۰
توکن جهانی «گم‌شده از `:root`» و ۴۹ توکن «گم‌شده از تم روشن» گزارش می‌شد و
`theme:check` با **۱۰۹ مشکل** می‌شکست. پس از رفع: `all good`.

این دو، نمونهٔ دقیق همان چیزی‌اند که اصل وضعیت‌دهی می‌خواهد: **«اجرای اسکریپت»
با «سنجش واقعی» یکی نیست.**

### ۴.۲ `verify:all` — علت ریشه‌ای هر ۳ شکست تعیین شد؛ دو نقص واقعی در دروازه رفع شد

`verify:all` سه بار (۱۰:۱۸ · ۱۰:۳۰ · ۱۴:۴۱) اجرا شد و هر سه بار **دقیقاً همان ۳ گام**
شکست خورد. علت‌ها در گام چهارم — یعنی افزودن **نگه‌داشتِ خروجی کامل گام‌های ناموفق**
به `verify-all.mjs` — پیدا شد. تا پیش از آن، گزارش انسانی فقط دو خط آخر را چاپ
می‌کرد و شکست واقعی به شکل `Node.js v22.22.2` دیده می‌شد.

| گام | در `verify:all` | اجرای مستقل | علت ریشه‌ای (تعیین‌شده) |
|---|---|---|---|
| `planning:test` | exit ۱ · ۴٫۷s | **exit ۰ · ۳۴/۳۴** | گارد حذف انبوهِ میزبان در `scripts/planning-service-test.mjs:172` |
| `admin:security:test` | exit ۱ · ۲۶٫۳s | **exit ۰ · ۶۰/۶۰** | همان گارد در `database/adminSecrets.test.mjs:523` |
| `data:check` | exit ۱ (خطا=۱) | **exit ۰** | **نقص ترتیب گام‌ها** — پس از گام‌های آلوده‌کننده و پیش از بازگردانی |

**۱) دو شکست نخست — گاردِ حذفِ انبوهِ میزبان (artifact محیطی، نه نقص محصول).**

`planning:test` هر ۳۴ سنجه را سبز می‌کند و **بعد** می‌میرد
(`.workbuddy-ai/verify-logs/planning-test.log`):

```
34 موفق · 0 ناموفق
Error: [safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]
{"count":334,"threshold":50,"scope":"turn","targets":["…/node_modules/.cache/tapesh-planning/entry.js"],"targetCount":1}
    at checkBulkDeleteGuard (node-safe-delete-shim.cjs:214:19)
    at tryTrash (node-safe-delete-shim.cjs:566:5)
    at tryRm (node-safe-delete-shim.cjs:747:5)
    at wrappedRmSync (node-safe-delete-shim.cjs:753:15)
    at scripts/planning-service-test.mjs:172:1
```

و `admin:security:test` عیناً همان، روی پاک‌سازی یک PNG آزمایشی
(`.workbuddy-ai/verify-logs/admin-security-test.log`):

```
Error: [safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]
{"count":334,"threshold":50,"scope":"turn","targets":["…/public/uploads/mupfqdlj-3db277533cac.png"],"targetCount":1}
    at checkBulkDeleteGuard (node-safe-delete-shim.cjs:214:19)
    at database/adminSecrets.test.mjs:523:27
```

**سازوکار:** شیمِ سندباکسِ میزبان هر `unlink`/`rm` را از یک helper بیرونی می‌پرسد
(`node-safe-delete-shim.cjs:192-218`؛ شرط فعال‌شدن: وجود هم‌زمانِ
`CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` و `CODEBUDDY_TOOL_CALL_ID` که به پروسه‌های
فرزند هم ارث می‌رسد). آن helper وقتی سهمیهٔ «حذف در یک نوبت» را رد کند **خطا
پرتاب می‌کند و پروسه را می‌کشد**. پس شکست در **لحظهٔ پاک‌سازی** رخ می‌دهد، بعد از
آنکه همهٔ assertها سبز شده‌اند ⇒ «شکست کاذب». این دقیقاً توضیح می‌دهد چرا هر دو
گام مستقل سبزند و در اجرای پیاپی ۲۳ گام می‌میرند. در `adminSecrets.test.mjs` اثر
دوم هم دارد: `restoreContent()` که **پایین‌تر** از خط ۵۲۳ است هرگز اجرا نمی‌شود.

**آنچه رد شد (آزمایش‌شده، نه فرض):** ترتیب گام‌ها (`--only=planning:test` سبز؛
`--only=<۶ گام نخست>` سبز؛ `--only=data:test,planning:test` سبز) · آلودگی داده
(پس از `data:test` سبز) · بازتولید دستی با همان `spawnSync`
(`process.execPath` · `maxBuffer: 64MB` · `cwd: ROOT`) سبز · و فرضیهٔ پیشینِ
«برخورد پورت / `TIME_WAIT` / فشار منابع» — **باطل**، چون استکِ خطا حذفِ فایل است،
نه سرور.

**آنچه تعیین نشد و ادعا نمی‌شود:** قاعدهٔ دقیقِ شمارشِ آن helper. فایل
`safe-delete-bulk-guard.cjs` با خطای `Sandbox blocked read access` خوانده نشد؛ پس
payload را همان‌طور که هست نقل می‌کنیم و **قاعده** را `UNKNOWN` نگه می‌داریم. یک
مشاهدهٔ ناسازگار با فرض «سهمیهٔ تجمعیِ یکنواخت»: گام ۸ (`admin:rbac:test`) با همان
الگوی حذف، **پس از** گام ۶، سبز است.

**اقدام انجام‌شده — پروژه‌ای، بدون دست‌زدن به سندباکس:**
- پاک‌سازی در همان دو نقطهٔ واقعاً شکست‌خورده به «تلاش + هشدار» تبدیل شد. پاک‌سازی
  assert نیست و نباید سرنوشت تست را تعیین کند. **هیچ assertی تغییر یا حذف نشد.**
- `verify-all.mjs` وجود گارد میزبان را **تشخیص و اعلام** می‌کند (هشدار در خروجی
  انسانی + فیلد `deleteGuard` در `--json`) تا نتیجه اشتباه تفسیر نشود.
- **گارد سندباکس حذف نشد، غیرفعال نشد و دور زده نشد.** این کار وظیفهٔ من نیست.

**۳) شکستِ چهارمِ کشف‌شده در اجرای تأییدی — خودِ ابزار.** پس از رفع دو نقطهٔ بالا،
`verify:all` تا گام ۶ پیش رفت، `planning:test` **سبز شد**، و بعد خودِ
`verify-all.mjs` در خط ۱۸۶ مُرد، روی حذف **لاگ کهنهٔ همان گام موفق**:

```
Error: [safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]
{"count":334,"threshold":50,"scope":"turn","targets":["…/.workbuddy-ai/verify-logs/planning-test.log"],"targetCount":1}
    at scripts/verify-all.mjs:186:5
```

⇒ نتیجه: **هر حذفی در مسیر دروازه باید بهترین‌تلاش باشد، وگرنه دروازه وسط کار
می‌میرد و هیچ نتیجه‌ای تولید نمی‌کند.** سه فراخوانِ `rmSync` خودِ `verify-all.mjs`
به helper محلیِ `tryRemove` (تلاش + هشدار) تبدیل شدند.

**۲) شکست سوم — `data:check`: یک نقص واقعی در دروازهٔ خودمان.**

`data:check` گام ۱۹ بود، ولی بازگردانی آلودگی پس از **همهٔ** گام‌ها انجام می‌شود.
پس **ساختاراً** دادهٔ آلوده را می‌سنجید: `activity` با ۵۰۰ رکورد و `خطا=۱`
(رکورد نامعتبر `log-5d644fb8`) — که خودِ گام‌های پیشین ساخته بودند. حالا
`data:check` گام **اول** است (پیش‌پرواز: «پیش از اجرای تست‌ها داده سالم است؟»).
وضعیت پس از اجرا هم بی‌پاسخ نمانده: سازوکار snapshot/restore و فهرست `polluted`
در پایان آن را گزارش می‌کند. نتیجهٔ اجرای پس از رفع در بخش ۴.۳.

### ۴.۳ نتیجهٔ اجرای پس از رفع — `verify:all` **سبز**

```
✓ data:check             exit= 0      5s   ← گام اول (پیش‌پرواز)
✓ data:test              exit= 0   41.1s
✓ auth:test              exit= 0   11.8s   78 قبول · 0 رد
✓ bank:test              exit= 0   24.2s   40/40
✓ exam:test              exit= 0    6.2s   27/27
✓ domain:test            exit= 0    1.3s
✓ planning:test          exit= 0    4.8s   ← پیش‌تر exit 1
✓ admin:test             exit= 0   41.4s   92/92
✓ admin:rbac:test        exit= 0   32.1s   64/64
✓ admin:security:test    exit= 0   31.6s   ← پیش‌تر exit 1
✓ api:test               exit= 0  123.2s
✓ api:input:test         exit= 0    2.2s
✓ obs:test               exit= 0   12.1s
✓ router:test            exit= 0    1.2s   128 قبول · 0 رد
✓ content:atomic:test    exit= 0    6.8s
✓ content:hotpath:test   exit= 0    7.3s
✓ storage:test           exit= 0    5.7s
✓ publish:guard:test     exit= 0    0.8s
✓ backup:restore:test    exit= 0   32.9s   12/12
✓ data:benchmark         exit= 0   16.5s
✓ api:contract:check     exit= 0    6.8s   229 مسیر · 28 کد خطا · 11 DTO
✓ audit:api:selftest     exit= 0     10s
✓ smoke:test             exit= 0   12.7s   17/17

دادهٔ واقعی: ۴ فایل توسط تست‌ها تغییر کرد و بازگردانی شد:
  users.sessions.json · content/{activity,admins,exams}.json
گام‌ها: 23/23 موفق   ·   زمان کل: 437.7s   ·   نتیجه: سبز   ·   کد خروج: 0
```

**آنچه این اجرا اثبات می‌کند:** هر ۳ شکستِ پیشین واقعاً از همان علت‌های بخش ۴.۲
بودند و رفع شدند. در همین اجرا **۵ بار** گاردِ میزبان حذف را رد کرد — و هر ۵ بار
به **هشدار** تبدیل شد، نه شکست:

| هدفِ ردشده | اثر پیش از رفع |
|---|---|
| `verify-logs/planning-test.log` | کشتنِ خودِ `verify-all.mjs` (اجرای va7) |
| `node_modules/.cache/tapesh-planning/entry.js` | کشتنِ `planning:test` (اجرای va6) |
| `verify-logs/admin-security-test.log` | — |
| `public/uploads/mupgcxw0-….png` | کشتنِ `admin:security:test` (اجرای va6) |
| `verify-logs/data-check.log` | — |

**ریسک باقی‌مانده‌ای که پاک نمی‌شود:** این سبزی **در محیط سندباکس** گرفته شده و
ارزش اثباتی‌اش همین است (دروازه واقعاً ۲۳ گام را اجرا کرد و همه سبز شدند)، ولی
گارد میزبان هنوز می‌تواند گامی را بکشد. نتیجهٔ **مرجع** را در ترمینال معمولی
بگیر. یک اثر جانبی هم مانده: پاک‌سازی‌های ردشده فایل آزمایشی باقی می‌گذارند
(۵ PNG در `public/uploads/` — رجیستر بند ۳۳).

**درس روشی:** اگر نگه‌داشتِ خروجی کامل گام‌های ناموفق اضافه نشده بود، این علت
هرگز پیدا نمی‌شد. گزارش قبلی فقط `Node.js v22.22.2` را نشان می‌داد و سه گامِ
مستقلِ سبز، تشخیص را به سمت «فرضیهٔ پورت/منابع» می‌بردند. **ابزار سنجش باید
خودش قابل اشکال‌زدایی باشد.**


---

## 5. Data and Migration Status

| مورد | وضعیت | شاهد |
|---|---|---|
| Persistence فعلی | فایل JSON، ۴۳ فایل، ۲٫۱۹MB، بدون transaction | `data:check` |
| Abstraction بین store و persistence | **NOT FOUND** — `database/persistence/` وجود ندارد | `ls` |
| Repository interface جدا از implementation | **NOT FOUND** | — |
| Schema / migration version | Schema دارد (`database/models/`، ۴۴ entity) ولی **نسخه ندارد** | `ls database/models/` |
| Migration framework | **NOT FOUND** — نه پوشهٔ migration، نه runner، نه rollback | `ls database/migrations` ⇒ موجود نیست |
| ابزار تعمیر | فقط `data:repair` (پیش‌فرض dry-run) — **migration نیست** | `package.json` |
| Preflight / post-check یکپارچگی | **VERIFIED** — `data:check` پیش و پس | اجرا |
| Backup | **VERIFIED** — `data:backup` ⇒ `.workbuddy-ai/backups/*.tar.gz` + `SHA256SUMS` | فایل‌های موجود |
| Backup زمان‌بندی‌شده | **NOT FOUND** | — |
| Restore | **VERIFIED** — `data:restore` پیش‌فرض dry-run؛ `--apply` عکس `pre-restore-<stamp>` | `backup:restore:test` ۱۲/۱۲ |
| Restore verification | **VERIFIED** — روی ریشهٔ موقت، دادهٔ اصلی دست‌نخورده | همان |
| شبیه‌سازی شکست وسط migration | **NOT EXECUTED** — migration وجود ندارد | — |
| PostgreSQL | **BLOCKED BY ENVIRONMENT** — نه سرور، نه credential، نه دادهٔ واقعی در دسترس | — |
| Dual-read / dual-write | **NOT FOUND** | — |
| Data reconciliation | **NOT FOUND** | — |

**معیار پذیرش ۱۹.۳ محقق نشده است.** هیچ read-modify-write پرریسکی «رفع» نشد،
چون ابزار transaction/recovery وجود ندارد. تنها چیزی که واقعاً اثبات شد،
**زنجیرهٔ backup→restore** است.

**malformed JSON به empty dataset تبدیل نمی‌شود** — `VERIFIED`:
`readJson` خرابی را اعلام می‌کند، `writeJsonAtomic` روی فایل خراب نمی‌نویسد
(`STORAGE_CORRUPT`) و `TAPESH_STORAGE_CORRUPT_MODE=throw` حالت fail-closed است
(`storage:test` ۶/۶).

---

## 6. Security and Privacy Status

| مورد | وضعیت | شاهد |
|---|---|---|
| احراز هویت (هش scrypt، `createUser` فقط CREATE) | **VERIFIED** | `auth:test` ۷۸/۷۸ |
| Rate limit (`login`/`register`/`testBank*`) | **VERIFIED** | `userRateLimit.js` + تست |
| RBAC (deny-by-default، آخرین مدیر کل ⇒ ۴۰۹، تغییر نقش خود ممنوع) | **VERIFIED** | `admin:rbac:test` ۶۴/۶۴ |
| سرّها write-only، `*.secrets.json` `0600` | **VERIFIED** | `admin:security:test` ۶۰/۶۰ |
| CSRF روی مسیرهای حساس | **VERIFIED** | ۴ مسیر بدون CSRF ⇒ ۴۰۳ |
| Host/Origin — `X-Forwarded-Host` جعلی ریدایرکت را نمی‌چرخاند | **VERIFIED** | همان |
| SSRF در publisherها | **VERIFIED** | `publish:guard:test` ۹/۹ + `urlGuard.js` |
| **بدون توکن، صفر درخواست شبکه‌ای** | **VERIFIED** | `admin:security:test` |
| **Redaction لاگ دسترسی** | **VERIFIED** | query/IP/UA/Cookie/هدر/بدنه لاگ نمی‌شوند؛ `safePathname` + `obs:test` ۱۷/۱۷ |
| Redaction پاسخ عمومی (کلید پاسخ) | **VERIFIED** | `api:contract:check` ۰ نقض |
| Sanitizer HTML | **VERIFIED** | `bank:test` ۴۰/۴۰ |
| **سرّ در فایل‌های tracked** | **پاک** — ۰ یافته | `repo:hygiene` |
| **ریسک تاریخچهٔ گیت** | **باز** — بخش ۶.۱ | `git cat-file` |

### ۶.۱ ریسک تاریخچهٔ Git (اقدام واقعی انجام **نشد**)

| مورد | اندازه | وضعیت |
|---|---|---|
| `database/content/admins.json` | ۱ رکورد · **هش رمز + ایمیل مدیر** | **tracked، در تاریخچه** |
| `database/content/activity.json` | ۵۰۰ رکورد · **IP + User-Agent** | **tracked، در تاریخچه** (۱۹ commit) |
| `database/users.json` | هش رمز کاربران | **از ردیابی خارج شده** ولی در **۱۲ commit** تاریخچه |
| `database/content/events.json` | ۰ رکورد | tracked، ۱۷ commit |
| `.app.out.mjs` | **۴۷MB** | در تاریخچه (الان در `.gitignore`) |
| `public/uploads/intl/mujqoxfn-*.mp4` | **۴۱MB** | **در تاریخچه** |
| `public/anatomy/models/*.glb` | ۹ فایل · **۱۰۶MB** | در تاریخچه |
| حجم `.git` | **۲۱۹MB** | — |

**هیچ‌کدام از این‌ها بازنویسی، force-push یا حذف نشد.** دلیل: نیازمند تأیید
صریح و برنامهٔ بازسازی است. دستورالعمل در بخش ۹ آمده.

---

## 7. Integration Status

| Integration | consumer code | env | secret | timeout | retry | idempotency | webhook | error handling | وضعیت |
|---|---|---|---|---|---|---|---|---|---|
| `bale` | `publishers/bale.js` | `BALE_BOT_TOKEN` · `BALE_API_BASE` | توکن در URL | `PUBLISH_TIMEOUT_MS` | **ندارد** | ندارد | — | خطای کنترل‌شده | `IMPLEMENTED BUT UNVERIFIED` (بدون توکن واقعی) |
| `eitaa` | `publishers/eitaa.js` | `EITAA_API_BASE` | per-channel | همان | **ندارد** | ندارد | — | همان | `IMPLEMENTED BUT UNVERIFIED` |
| `instagram` | `publishers/instagram.js` | `INSTAGRAM_ACCESS_TOKEN` · `INSTAGRAM_GRAPH_BASE` | توکن | همان | **ندارد** | ندارد | — | همان | `IMPLEMENTED BUT UNVERIFIED` |
| `telegram` | `publishers/telegramLike.js` | `TELEGRAM_BOT_TOKEN` · `TELEGRAM_API_BASE` | توکن | همان | **ندارد** | ندارد | — | همان | `IMPLEMENTED BUT UNVERIFIED` |
| ۹ پلتفرم دیگر | `CATALOG_ONLY` | — | — | — | — | — | — | — | `PLANNED BUT NOT IMPLEMENTED` |
| Google OAuth | `googleAuth.js` | `GOOGLE_CLIENT_ID/SECRET` | بله | — | — | state | callback | کنترل‌شده | `IMPLEMENTED BUT UNVERIFIED` (بدون credential واقعی) |
| **AI / LLM** | `analyticsInsights.js` (فقط `requires`) · `src/services/ai/mockAI.js` | `LLM_API_KEY` · `LLM_MODEL` | — | — | — | — | — | — | **`CONFIGURED BUT UNUSED`** — هیچ درخواست HTTP واقعی وجود ندارد؛ روایت متنی «اختیاری» است و تحلیل بدون آن هم کار می‌کند |
| **Payment** | `analyticsStore.js` (فقط `configured()`) | `PAYMENT_PROVIDER` · `PAYMENT_API_KEY` | — | — | — | — | — | — | **`CONFIGURED BUT UNUSED`** — هیچ route، adapter، webhook یا reconciliation وجود ندارد |
| GA4 | `analyticsStore.js` `configured()` | `GA_PROPERTY_ID` · `GA_CLIENT_EMAIL` · `GA_PRIVATE_KEY` | کلید خصوصی | — | — | — | — | — | **`CONFIGURED BUT UNUSED`** |
| Search Console | همان | `GSC_SITE_URL` | — | — | — | — | — | — | **`CONFIGURED BUT UNUSED`** |
| PageSpeed | همان | `PAGESPEED_API_KEY` | — | — | — | — | — | — | **`CONFIGURED BUT UNUSED`** |
| Monitoring | همان | `MONITORING_API_URL` · `MONITORING_API_KEY` | — | — | — | — | — | — | **`CONFIGURED BUT UNUSED`** |
| Alerting | همان | `ALERT_WEBHOOK_URL` · `ALERT_TELEGRAM_TOKEN` · `ALERT_TELEGRAM_CHAT` | — | — | — | — | — | — | **`CONFIGURED BUT UNUSED`** |
| CDN | — | — | — | — | — | — | — | — | **`NOT FOUND`** |
| External log provider | — | — | — | — | — | — | — | — | **`NOT FOUND`** |

**تعیین تکلیف `LLM_API_KEY` و `PAYMENT_PROVIDER`:**
هر دو **مصرف‌کنندهٔ واقعی ندارند**. تنها نقطهٔ خواندن، تابع `configured()` در
`analyticsStore.js` است که صرفاً **وجود** کلید را برای نمایش «وصل/قطع» در پنل
می‌سنجد. هیچ درخواستی به بیرون نمی‌رود. تصمیم پیشنهادی: **نگهداری با برچسب
صریح `planned, not implemented`** در `.env.example` — نه حذف (چون بخشی از
نقشهٔ راه تحلیل است) و نه ادعای فعال بودن.

`INSTAGRAM_APP_ID` · `INSTAGRAM_APP_SECRET` · `EITAA_BOT_TOKEN` در `.env.example`
مستند شده‌اند اما adapterها آن‌ها را نمی‌خوانند (توکن per-channel از پنل مقدم است).

---

## 8. Performance Status

### ۸.۱ Baseline (اندازه‌گیری‌شده، پس از build موفق)

| سنجه | مقدار |
|---|---|
| Build time | **۲۰٫۴۷s** (۵۹۵ ماژول) |
| JS کل | **۵٫۷۴MB** در ۱۹ chunk |
| CSS کل | **۹۳۲KB** در ۱۰ chunk |
| `mockData-*.js` | **۱٫۸۵MB** |
| `index-*.js` (entry) | **۱٫۶۰MB** (gzip ۴۳۶KB) |
| `admin-*.js` | **۱٫۰۰MB** (gzip ۲۷۱KB) |
| `three-*.js` | **۰٫۵۶MB** (gzip ۱۴۵KB) |
| `index-*.css` | **۷۲۸KB** (gzip ۱۲۲KB) |
| ۳D models | ۹ فایل `.glb` · **۱۰۶MB** در `public/anatomy/models/` |
| `public/uploads` | **۵۵MB** |
| `images/` | **۳۸MB** |

### ۸.۲ یافته‌های عملکردی (اندازه‌گیری‌شده، بدون ادعای رفع)

1. **`mockData-*.js` = ۱٫۸۵MB.** علت اصلی: `src/services/wiki/mockData.js`
   با **۲٫۱۶MB** (۴۶۶ رکورد) که تنها منبع ویکی است و بک‌اند ندارد. این chunk
   در `dist/index.html` **preload نمی‌شود** (بارگذاری تنبل) — یعنی خوش‌شانسی،
   ولی حجمش در artifact تولیدی می‌نشیند.
2. **`admin-*.js` = ۱٫۰۰MB در فهرست `modulepreload` صفحهٔ عمومی است.**
   `dist/index.html` هر ۴ فایل `index` · `admin` · `react` · `index.css` را
   preload می‌کند. یعنی بازدیدکنندهٔ سایت عمومی **۱MB کد پنل مدیریت** را
   پیش‌بار می‌گیرد. این یک هدف بهینه‌سازی مشخص و قابل‌اثبات است.
3. **code splitting مؤثر است:** ورودی ۱٫۶۰MB در برابر ۴٫۴۱MB قبلی (باندل
   تک‌فایلی dist کهنه) — کاهش ۶۴٪ روی entry.
4. **`chunkSizeWarningLimit: 600`** با ۴ chunk نقض می‌شود.
5. **`events.json` دیگر کامل خوانده نمی‌شود در هر درخواست** — `VERIFIED`:
   فایل در این جلسه **۰ رکورد / ۲ بایت** است. اما `mediaMetrics.json` با ۵۴۰
   رکورد و `microCourses.json` با ۸۳۰KB همچنان در هر بار کامل parse می‌شوند.
6. **Core Web Vitals اندازه‌گیری نشد** — `UNVERIFIED` (نیازمند مرورگر/production).
7. **حافظه/CPU/شبکهٔ موبایل اندازه‌گیری نشد** — `UNVERIFIED`.

**هیچ ادعای «بهینه‌سازی شد» مطرح نیست.** تنها یک baseline واقعی ثبت شد و
دو هدف مشخص شناسایی شد.

---

## 9. UNKNOWN / UNVERIFIED Register

| # | مورد | وضعیت فعلی | چرا تأیید نشد | verification لازم | owner |
|---|---|---|---|---|---|
| ۱ | `NODE_ENV=production` در استقرار | `UNKNOWN` | محیط production در دسترس نیست | اجرا روی میزبان واقعی + `GET /readyz` | DevOps |
| ۲ | SSL/TLS | `UNKNOWN` | terminate در لایهٔ بیرونی | `curl -vI https://<domain>` + بررسی زنجیره | DevOps |
| ۳ | secure cookie در production | `IMPLEMENTED BUT UNVERIFIED` | فقط شرط کد (`NODE_ENV==='production' && TAPESH_INSECURE_COOKIE!=='1'`) | اجرا با `NODE_ENV=production` + بررسی `Set-Cookie; Secure` | Backend |
| ۴ | proxy headers | `PARTIALLY VERIFIED` | زنجیرهٔ `PUBLIC_SITE_URL→Host→X-Forwarded-Host→ALLOWED_HOSTS` تست شده، ولی پشت پروکسی واقعی نه | استقرار پشت nginx | DevOps |
| ۵ | PostgreSQL | `BLOCKED BY ENVIRONMENT` | سرور/credential موجود نیست | فراهم‌کردن instance + اجرای migration | Infra |
| ۶ | migration نسخه‌دار | `NOT FOUND` | پیاده نشده | طراحی + اجرا روی DB تست | Backend |
| ۷ | backup زمان‌بندی‌شده | `NOT FOUND` | cron/timer وجود ندارد | زمان‌بند + تست بازیابی | DevOps |
| ۸ | CI/CD | `NOT FOUND` | — | pipeline + سوار کردن `repo:hygiene` و `verify:all` | DevOps |
| ۹ | CDN / cache headers | `NOT FOUND` | — | — | DevOps |
| ۱۰ | external log provider | `NOT FOUND` | فقط `console.log` یک‌خطی JSON | اتصال به sink + retention | DevOps |
| ۱۱ | log rotation / retention | `NOT FOUND` | مدیریت لاگ به بیرون سپرده شده | تعریف policy | DevOps |
| ۱۲ | 5xx پایدار | `NOT FOUND` | خطاها پس از restart از بین می‌روند | sink پایدار | Backend |
| ۱۳ | `LLM_API_KEY` | `CONFIGURED BUT UNUSED` | مصرف‌کنندهٔ واقعی ندارد | پیاده‌سازی فراخوانی یا حذف از مستندات | Backend |
| ۱۴ | `PAYMENT_PROVIDER` / `PAYMENT_API_KEY` | `CONFIGURED BUT UNUSED` | route/adapter/webhook ندارد | طراحی درگاه یا حذف | Product |
| ۱۵ | publisherها (۴ آداپتر) | `IMPLEMENTED BUT UNVERIFIED` | توکن واقعی + سرویس بیرونی لازم است | اجرا در sandbox پلتفرم | Backend |
| ۱۶ | Google OAuth | `IMPLEMENTED BUT UNVERIFIED` | credential واقعی لازم است | اجرا با `GOOGLE_CLIENT_ID/SECRET` واقعی | Backend |
| ۱۷ | GA4 / GSC / PageSpeed / Monitoring / Alerting | `CONFIGURED BUT UNUSED` | فقط `configured()`؛ بدون درخواست | پیاده‌سازی یا علامت‌گذاری صریح | Backend |
| ۱۸ | ویکی | `IMPLEMENTED BUT UNVERIFIED` | بک‌اند ندارد (کلاینت‌محور، ۲٫۱۶MB) | طراحی API یا پذیرش صریح | Product |
| ۱۹ | لیگ | `IMPLEMENTED BUT UNVERIFIED` | بک‌اند ندارد | همان | Product |
| ۲۰ | AI | `IMPLEMENTED BUT UNVERIFIED` | `mockAI.js` شبیه‌ساز است | اتصال واقعی | Backend |
| ۲۱ | Core Web Vitals | `UNVERIFIED` | نیازمند مرورگر و شبکهٔ واقعی | Lighthouse در محیط تعریف‌شده | Frontend |
| ۲۲ | mobile / slow-network | `UNVERIFIED` | همان | throttling در محیط واقعی | Frontend |
| ۲۳ | `theme:render` (`verify-render.mjs`) | `NOT EXECUTED` | دستور صریح کاربر: تست رابط کاربری گرفته نشد | اجرا توسط کاربر | Frontend |
| ۲۴ | keyboard nav / focus order / ARIA / screen-reader | `NOT FOUND` | هیچ ابزار خودکاری وجود ندارد | افزودن axe-core یا بررسی دستی | Frontend |
| ۲۵ | reduced motion | `NOT FOUND` (در مخزن) | — | گارد `prefers-reduced-motion` + تست | Frontend |
| ۲۶ | بازنویسی تاریخچهٔ گیت | `NOT EXECUTED` | نیازمند تأیید صریح | `git filter-repo --path ... --invert-paths` + هماهنگی force-push | Owner |
| ۲۷ | rotation سرّها | `UNVERIFIED` | احتمال exposure در تاریخچه | چرخش `admins` passwordHash و توکن‌های انتشار | Security |
| ۲۸ | ۱۲۲ مسیر مستند اما پیاده‌نشده | `IMPLEMENTED BUT UNVERIFIED` | خارج از scope این اجرا | تصمیم پیاده‌سازی/حذف مستندات | Backend |
| ۲۹ | `assertInputValid` روی ۱۱۵ مسیر از ۱۱۷ | `PARTIALLY VERIFIED` | فقط ۲ مسیر notes دروازه دارند | تعمیم تدریجی | Backend |
| ۳۰ | dead code (۸ فایل بدون ارجاع) | `IMPLEMENTED` (شناسایی‌شده) | حذف نیازمند تأیید و regression | quarantine سپس حذف | Backend |
| ۳۱ | `verify:all` ⇒ شکست ۳ گام | **RESOLVED** — علت هر ۳ تعیین و رفع شد؛ اجرای تأییدی **۲۳/۲۳ سبز** (بخش ۴.۳) | — | تکرار در ترمینال معمولی (بیرون سندباکس) برای تأیید مستقل | QA |
| ۳۴ | قاعدهٔ دقیق شمارشِ گاردِ حذفِ انبوهِ میزبان | `UNKNOWN` | فایل `safe-delete-bulk-guard.cjs` با `Sandbox blocked read access` خوانده نشد؛ payload خطا خودگزارش است ولی الگوریتمش دیده نشد | خواندن منبع helper یا اجرای شمارش‌دارِ آزمایشی | QA |
| ۳۵ | اختلاف ۶ رکوردی شمارش کل (۱٬۵۴۱ → ۱٬۵۴۷) | `UNKNOWN` (محدودشده) | `activity`/`admins` **اثباتاً برابر HEAD**؛ تنها تفاوت دو اجرای اسکنر `admin` ۴→۱ است؛ منبع ۶ رکورد در مجموعه‌ای است که این شواهد پوشش نمی‌دهد | مقایسهٔ فایل‌به‌فایلِ رکوردشمار در دو مقطع زمانی | Data |
| ۳۲ | `users.sessions.json` — رشد و ترکیب | **اندازه‌گیری شد · `UNVERIFIED` (پاک‌سازی)** | **۱۹٬۲۵۴B · ۵۵ نشست · ۵۳ نشستِ یتیم** — `userId` آن‌ها در `users.json` وجود ندارد و `users.json` فقط **۱ کاربر** دارد. فایل untracked است و snapshot شروع جلسه ندارد. **اسکنر `session` را `PASS` با ۰ خطا/۰ هشدار می‌دهد** و در `database/models/` هیچ رابطهٔ `session → user` تعریف نشده ⇒ این یتیمی **توسط `data:check` گرفته نمی‌شود** | تصمیم دربارهٔ هرسِ نشست‌های یتیم (نیازمند تأیید) + افزودن رابطهٔ `session.userId → user` به `RELATIONS` | Backend |
| ۳۳ | **۵ فایل آپلود آزمایشی در `public/uploads/`** | `mupdwc2u-…png` · `mupe2en4-…png` · `mupebcpg-…png` · `mupehn6k-…png` (۱۳:۵۱–۱۴:۰۷) · `mupfqdlj-…png` (۱۴:۴۲) — و با هر اجرای `admin:security:test` یکی اضافه می‌شود (پاک‌سازی‌اش را گارد میزبان رد می‌کند) | ساختهٔ تست‌های بارگذاری همین جلسه؛ **حذف نشدند** (نیازمند تأیید). حالا رد شدنِ حذف **هشدار** می‌دهد، ولی فایل می‌ماند | تأیید سپس حذف | Backend |

### ۹.۱ دستورالعمل بازنویسی تاریخچه (آماده، **اجرا نشده**)

```bash
# پس از تأیید صریح و در یک branch جدا، با پشتیبان کامل .git
git filter-repo \
  --path database/content/admins.json \
  --path database/content/activity.json \
  --path database/users.json \
  --path database/users.sessions.json \
  --path public/uploads/intl/mujqoxfn-5655345c4baa.mp4 \
  --path .app.out.mjs \
  --invert-paths
# سپس: چرخش هش رمز مدیران و توکن‌های انتشار، force-push هماهنگ‌شده
```

---

## 10. Remaining Risks

۱. **`database/content/admins.json` با هش رمز و `activity.json` با IP/User-Agent
   در گیت tracked و در تاریخچه‌اند.** افشای مخزن = افشای credential و PII.
   `.gitignore` فقط آینده را می‌بندد.
۲. **`.git` = ۲۱۹MB** با یک blob ۴۷ مگابایتی و یک ویدیوی ۴۱ مگابایتی در تاریخچه.
۳. **`dist/index.html` کد پنل مدیریت را در `modulepreload` صفحهٔ عمومی می‌گذارد**
   (۱MB) — هزینهٔ پهنای باند برای هر بازدیدکننده.
۴. **`src/services/wiki/mockData.js` (۲٫۱۶MB)** در artifact تولیدی می‌نشیند و
   تنها منبع ویکی است (بدون بک‌اند).
۵. **نبود migration framework و PostgreSQL** یعنی هر تغییر شکل داده یک
   read-modify-write بدون transaction است.
۶. **آلودگی تست‌ها روی دادهٔ واقعی.** در همین جلسه، اجرای `adminSecrets.test.mjs`
   سه حساب مدیر آزمایشی به `admins.json` اضافه کرد و یک رکورد نامعتبر به
   `activity.json` (که `data:check` را به `ERROR` برد) و یک کلید
   `maxVideoUploadMb` به `settings.json`. **همه بازگردانده شد** (بخش ۴ پیوست)،
   ولی این یک ریسک ساختاری است: تست‌ها روی دادهٔ واقعی می‌نویسند.
۷. **`verify:all` بیرون از سندباکس معتبر است، نه داخل آن.** علت هر ۳ شکست تعیین
   شد (بخش ۴.۲): دو مورد گاردِ حذفِ انبوهِ میزبان، یک مورد نقص ترتیب گام‌ها که
   رفع شد. ریسک باقی‌مانده: آن گارد می‌تواند **هر** حذفی — از جمله پاک‌سازیِ
   خودِ ابزار یا گام‌هایی که تا امروز سبز بوده‌اند — را رد کند و گام را بکشد.
   برای نتیجهٔ مرجع، دروازه را در ترمینال معمولی اجرا کن؛ ابزار حالا این وضعیت
   را با هشدار و فیلد `deleteGuard` در `--json` اعلام می‌کند.
۸. **۲۲ هشدار یکپارچگی** (۱۸ یتیم `activity.userId` + ۲ یتیم
   `publishLog.channelId`) + سه رابطهٔ `FREE` بدون گارد. **و یک یتیمیِ
   سنجیده‌نشده:** `users.sessions.json` **۵۳ نشستِ یتیم** از ۵۵ دارد
   (`userId` در `users.json` وجود ندارد) ولی اسکنر `session` را `PASS` با
   **۰ هشدار** می‌دهد، چون در `database/models/` هیچ رابطهٔ `session → user`
   تعریف نشده است. یعنی این کلاس از آلودگی **از دروازهٔ یکپارچگی رد می‌شود**.
   افزودن آن رابطه یک تغییر در `models/` است (نیازمند تصمیم).
۹. **بدون CI** — هیچ‌کدام از دروازه‌های بالا خودکار اجرا نمی‌شوند.

---

## 11. Final Status

| فاز | وضعیت | توضیح |
|---|---|---|
| **Phase 19** | **PARTIALLY VERIFIED** | ۱۹.۱ (inventory/ownership) ✅ · ۱۹.۲ (mock disposition) ✅ تحلیل‌شده · ۱۹.۴ (API contract) ✅ ۰ نقض · ۱۹.۵ (structured logging + redaction) ✅ ۱۷ تست · ۱۹.۶ (UNKNOWN register) ✅ ثبت‌شده · **۱۹.۳ (persistence/migration) ✗ — `NOT FOUND`/`BLOCKED`** |
| **Phase 20** | **PARTIALLY VERIFIED** | ۲۰.۱ (dead code) ✅ شناسایی‌شده، حذف نشده · ۲۰.۲ (git/artifact) ✅ ابزار ساخته شد، تاریخچه دست‌نخورده · ۲۰.۳ (performance) ✅ baseline ثبت شد، بهینه‌سازی **انجام نشد** · ۲۰.۴ (integrations) ✅ تعیین تکلیف شد · ۲۰.۵ (quality gate) ✅ ۱۶ سوییت سبز + `verify:all` **۲۳/۲۳ سبز** · ۲۰.۶ (readiness matrix) ✅ بخش پیوست |

**Phase 19: `PARTIALLY VERIFIED` — نه `VERIFIED`.**
**Phase 20: `PARTIALLY VERIFIED` — نه `VERIFIED`.**

بخش‌های `BLOCKED`: PostgreSQL · migration · CI/CD · staging · CDN ·
credentialهای بیرونی · بازنویسی تاریخچه · Core Web Vitals.

هیچ‌کدام از این دو فاز «کامل شد»، «production-ready» یا «امن است» اعلام
**نمی‌شود**.

---

## پیوست الف — Production Readiness Matrix

| حوزه | وضعیت | شواهد | ریسک باقی‌مانده | اقدام بعدی |
|---|---|---|---|---|
| Build | **VERIFIED** | `vite build` exit 0 · ۲۰٫۴۷s · ۵۹۵ ماژول · `dist/index.html` تازه | chunk بزرگ `mockData` ۱٫۸۵MB | code splitting ویکی |
| Deploy | `IMPLEMENTED BUT UNVERIFIED` | `scripts/deploy.mjs` با کدهای خروج ۳/۵/۶/۷/۸/۹ | `--env=production` بدون `NODE_ENV=production` اجرا نمی‌شود | اجرای واقعی روی staging |
| SSL/TLS | `UNKNOWN` | — | ناشناخته | `curl -vI` روی دامنهٔ واقعی |
| `NODE_ENV` | `UNKNOWN` | — | ناشناخته | تأیید روی میزبان |
| Database | **PARTIALLY VERIFIED** | ۴۳ فایل JSON · ۱٬۵۴۷ رکورد · ۰ خطا · ۲۲ هشدار | بدون transaction/index/FK | تصمیم دربارهٔ PostgreSQL |
| Migration | **NOT FOUND** | — | هر تغییر داده بدون rollback | طراحی runner |
| Backup | **VERIFIED** | `data:backup` + `SHA256SUMS` | زمان‌بندی ندارد | cron |
| Restore | **VERIFIED** | `backup:restore:test` ۱۲/۱۲ روی ریشهٔ موقت | — | اجرای دوره‌ای |
| Auth | **VERIFIED** | `auth:test` ۷۸/۷۸ · `admin:rbac` ۶۴/۶۴ | — | — |
| API | **VERIFIED** | `api:contract:check` ۲۲۹/۲۸/۱۱/۰ · `api:test` ۳۱ · `api:input` ۱۳ | ۱۲۲ مسیر پیاده‌نشده · ۱۱۵ مسیر بدون دروازهٔ ورودی | تعمیم `assertInputValid` |
| Logging | **PARTIALLY VERIFIED** | `obs:test` ۱۷/۱۷ · لاگ یک‌خطی JSON با redaction | بدون level · بدون sink پایدار · بدون rotation | افزودن level و sink |
| Monitoring | **NOT FOUND** | `/metrics` فقط با توکن؛ درون-حافظه | چند-نودی نیاز به ذخیره‌گاه مشترک | ذخیره‌گاه مشترک |
| Publishers | `IMPLEMENTED BUT UNVERIFIED` | ۴ آداپتر + `publish:guard:test` ۹/۹ + `admin:security` ۶۰/۶۰ | بدون retry/backoff · بدون تأیید بیرونی | sandbox پلتفرم |
| AI | `CONFIGURED BUT UNUSED` | فقط `requires: 'LLM_API_KEY'` | مصرف‌کنندهٔ واقعی ندارد | پیاده‌سازی یا برچسب‌گذاری |
| Payment | `CONFIGURED BUT UNUSED` | فقط `configured('PAYMENT_PROVIDER')` | بدون route/webhook/reconciliation | تصمیم محصول |
| Accessibility | **PARTIALLY VERIFIED** | `theme:contrast` ۴۴ جفت · ۰ `LOW` (پس از رفع سبزِ کاذب) · `theme:verify` سبز · `tailwind-probe` ۹/۹ | keyboard/ARIA/reduced-motion هیچ ابزاری ندارند · `theme:render` اجرا نشد | axe-core + اجرای `theme:render` |
| Performance | **PARTIALLY VERIFIED** | baseline ثبت شد (JS ۵٫۷۴MB · CSS ۹۳۲KB · build ۲۰٫۴۷s) | CWV و موبایل اندازه‌گیری نشد | Lighthouse |
| Git hygiene | **PARTIALLY VERIFIED** | `repo:hygiene` ساخته و اجرا شد · `.gitignore` اصلاح شد | تاریخچهٔ ۲۱۹MB با credential و PII | تأیید + `filter-repo` |
| Dead code | **IMPLEMENTED BUT UNVERIFIED** | ۸ فایل بدون ارجاع شناسایی شد | حذف انجام نشد | quarantine سپس حذف |
| **Quality gate** | **VERIFIED** (اجرا در سندباکس) | `verify:all` **۲۳/۲۳ سبز** · exit 0 · ۴۳۷٫۷s · ۴ فایل آلوده خودکار بازگردانی شد (بخش ۴.۳) | گاردِ حذفِ میزبان می‌تواند گامی را بکشد ⇒ نتیجهٔ مرجع در ترمینال معمولی | افزودن به CI |

### پیوست ب — یافته‌های `repo:hygiene` (اجرای واقعی)

- **سرّ در فایل‌های tracked: ۰ یافته.**
- **فایل حجیم tracked (۱۳):** `mujqoxfn-*.mp4` ۳۹٫۰MB · `nervous.glb` ۲۷٫۵MB ·
  `cardio.glb` ۲۰٫۸MB · `skeletal.glb` ۲۰٫۵MB · `muscular.glb` ۱۸٫۵MB ·
  `visceral.glb` ۹٫۰MB · `joints.glb` ۵٫۳MB · دو PNG آپلود ۲٫۹/۲٫۹MB ·
  `regions.glb` ۲٫۷MB · `Asset 7.webp` ۲٫۴MB · `wiki/mockData.js` ۲٫۲MB ·
  یک PNG ۲٫۱MB
- **دادهٔ زمان‌اجرای tracked (۵):** `activity.json` ۱۸۴KB · `admins.json` ۱KB ·
  `events.json` ۰KB · `mediaMetrics.json` ۲۹۴KB · `publishLog.json` ۲۲KB

### پیوست ج — بازگردانی آلودگی تست (اثبات)

سه فایل `activity.json` · `admins.json` · `settings.json` که **در شروع جلسه
نسبت به HEAD تمیز بودند** و اجرای تست‌ها آن‌ها را تغییر داده بود، بازگردانده شدند:

| فایل | اثبات تمیزی در شروع | آلودگی | بازگردانی |
|---|---|---|---|
| `activity.json` | `git hash-object` روی snapshot ۱۱:۱۰ == `HEAD:…` (`7472021b`) | ۴۲ رکورد تست + ۱ رکورد نامعتبر (`log-5d644fb8`) | `git checkout --` |
| `admins.json` | `git hash-object` روی snapshot ۱۱:۱۱ == `HEAD:…` (`44b2376e`) | ۳ حساب آزمایشی `p3s-admin-*` / `p3s-editor-*` | `git checkout --` |
| `settings.json` | در فهرست modified شروع جلسه نبود | کلید `maxVideoUploadMb: 512` | `git checkout --` |

نتیجهٔ پس از بازگردانی: `data:check` ⇒ **exit 0** · خطا=۰ · هشدار=۲۲ · رکورد=۱٬۵۴۱
(دقیقاً برابر baseline شروع جلسه). اندازهٔ فایل‌ها نیز بازگشت:
`activity.json` = ۱۸۷٬۹۳۶B (۵۰۰ رکورد) · `admins.json` = ۵۱۸B (۱ رکورد) ·
`settings.json` = ۱٬۱۴۷B.

⚠️ عدد رکورد در پایان جلسه **۱٬۵۴۷** است (نه ۱٬۵۴۱). منبعِ این اختلاف
**تعیین نشد** و ادعا نمی‌شود. اما با شواهد زیر **محدود** شد:

| شاهد | نتیجه |
|---|---|
| `activity.json` در برابر HEAD | **۵۰۰ = ۵۰۰ رکورد · ۱۸۷٬۹۳۶B — بایت‌به‌بایت برابر HEAD** |
| `admins.json` در برابر HEAD | **۱ = ۱ رکورد — برابر HEAD** |
| تفکیک کامل دو اجرای اسکنر (اجرای آلودهٔ va6 ↔ اکنون) | **تنها تفاوت: `admin` ۴ → ۱** (همان ۳ حساب آزمایشی) |
| `admin=۱ · user=۱ · session=۵۵ · activity=۵۰۰ · mediaAsset=۲۴` | با baseline همخوان |

⇒ آلودگی `activity`/`admins`/`settings` **اثباتاً** برگشته است؛ اختلاف ۶ رکوردی در
مجموعه‌ای است که این شواهد پوشش نمی‌دهند. **معیار درستی در این پروژه `خطا=۰` است،
نه عدد ثابت رکورد** (عدد با هر اجرای تست چند واحد جابه‌جا می‌شود).

### پیوست د — اثرات جانبی باقی‌ماندهٔ اجرای تست (گزارش‌شده، حذف‌نشده)

| مورد | تغییر | وضعیت |
|---|---|---|
| `database/users.json` | ۶۸۷B ← ۴۴۵B | **محتوای رکورد کاربر یکسان است** (تطبیق فیلدبه‌فیلد با backup ۲۹ سپتامبر: هیچ `DIFF`). تفاوت فقط قالب‌بندی JSON است. فایل untracked است. |
| `database/users.sessions.json` | ۱۶٬۴۸۶B ← ۱۸٬۵۶۲B | نشست‌های آزمایشی؛ فایل untracked است و snapshot شروع جلسه ندارد |
| `public/uploads/*.png` | **۵ فایل تازه** | `mupdwc2u-13b21dfecf3a.png` · `mupe2en4-abc0f836fe11.png` · `mupebcpg-3f53a5b56d97.png` · `mupehn6k-209ae25ab931.png` · `mupfqdlj-3db277533cac.png` — **حذف نشدند** (نیازمند تأیید). پاک‌سازی‌شان را گاردِ میزبان رد کرد؛ حالا رد شدن **هشدار** می‌دهد و فایل می‌ماند ⇒ با هر اجرای `admin:security:test` یکی اضافه می‌شود |
| `database/content/*.bak` · `feedback.json` | بدون تغییر | از قبل موجود بودند؛ ساختهٔ این جلسه نیستند |
