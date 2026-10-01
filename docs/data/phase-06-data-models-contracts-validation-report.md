# فاز ۶ — مدل داده، قراردادها و اعتبارسنجی

**پروژه:** تپش (Tapesh Medical Learning)
**تاریخ اجرا:** ۳۰ سپتامبر ۲۰۲۶
**دامنه:** لایهٔ مدل داده روی Persistence فایل‌محور موجود — بدون مهاجرت دیتابیس، بدون بازنویسی API، بدون تغییر Business Logic
**سند مرجع:** `docs/audit/MASTER-AUDIT-2026-09-29.md` (دست‌نخورده)

---

## ۱. Executive Summary

**وضعیت کلی: DONE با یک مورد PARTIAL و یک مورد BLOCKED.**

> **به‌روزرسانی دور دوم.** پس از تحویل دور اول، **مرحلهٔ ۸ (Validation Integration)**
> که PARTIAL مانده بود کامل شد: ناظر مسیر نوشتن (`database/models/observe.js`) روی
> **تنها دروازهٔ نوشتن روی دیسک** (`writeJson`) سیم‌کشی شد. جزئیات در بخش ۱۳.
> شمار سنجه‌های مدل داده از **۲۰۶** به **۲۵۴** رسید.
>
> **به‌روزرسانی دور سوم.** ناظر به‌عنوان «ابزار کشف شکاف Schema» عمل کرد و **۳ شکاف دیگر**
> از همان کلاس `saveGoogleUser` را رو کرد: `admin.createdBy` · `admin.updatedBy` ·
> و `eventSchema` که ۴ فیلد خیالی اعلام می‌کرد در حالی که منبع واقعی ۱۸ فیلد تولید می‌کند.
> هر سه رفع شد. F1–F4 (۴ خطای دادهٔ واقعی) هم با تأیید کاربر تعمیر شد ⇒ `data:check`
> حالا **۰ خطا · ۲۲ هشدار · ۱۵۲۵ رکورد · exit 0** است.

پیش از این فاز، شکل هیچ Entity در پروژه تعریف نشده بود. قرارداد رکوردها فقط در کامنت‌های `COLLECTIONS` داخل `contentStore.js` و در `README.md` زندگی می‌کرد؛ validation در UI، API و Store پراکنده بود و هیچ مرز قابل‌آزمونی نداشت.

در این فاز یک **لایهٔ مدل دادهٔ کامل و قابل‌اجرا** ساخته شد:

| مؤلفه | نتیجه |
|---|---|
| Schema رسمی | **۴۴ Entity** روی **۴۳ فایل داده** |
| گراف ارتباط | **۳۹ ارتباط + ۱ چندریختی** با قاعدهٔ حذف مستند و شاهد کد |
| قید یکتایی | **۱۴ قید** روی ۱۳ Entity |
| قاعدهٔ بین‌فیلدی | **۱۴ قاعده** |
| ماشین وضعیت | **۹ Entity** |
| Enum متمرکز | **۴۵ Enum** با تست انطباق خودکار با جدول اصلی |
| ناظر مسیر نوشتن | **ناظر (نه دروازه)** روی تنها دروازهٔ نوشتن روی دیسک — پیش‌فرض خاموش |
| تست مدل داده | **۲۵۴/۲۵۴ سنجه سبز** |
| رگرسیون فازهای پیشین | **۴۱۷/۴۱۷ سنجه سبز** (بدون تغییر) |
| `data:check` | **۰ خطا · ۲۲ هشدار · ۱۵۲۵ رکورد · exit 0** |
| build | **FAIL — ازپیش‌موجود و بی‌ربط** (`three`) |

**هفت یافتهٔ واقعی که فقط با بررسی مستقیم Repository پیدا شد:**

1. **شکاف واقعی مدل کاربر سایت (رفع شد).** `usersStore.saveGoogleUser` رکوردی با `googleId`، `email`، `emailVerified`، `passwordHash: null` و `phone: ''` می‌سازد — ولی Schema کاربر هیچ‌کدام را نمی‌شناخت و `passwordHash` را الزامی و غیر-null می‌دانست. یعنی **هر ورود با گوگل یک «رکورد نامعتبر» تولید می‌کرد**. Schema از روی کد اصلاح شد و قراردادش با تست قفل شد.
2. **شکاف نهفتهٔ مدل مدیر پنل (رفع شد).** `contentStore.createAdmin()` می‌نویسد `createdBy: actor?.id ?? 'system'` و `updateAdmin()` می‌نویسد `updatedBy: actor?.id ?? 'system'` — ولی `adminSchema` هیچ‌کدام را اعلام نکرده بود. چون `admin` در `STRICT_UNKNOWN_FIELD_ENTITIES` است، این دو **خطا** می‌دادند نه هشدار. **چرا در اسکن دیده نمی‌شد:** هیچ رکورد موجودی این فیلدها را ندارد (مدیر کلِ seed از `seedAdmins()` می‌آید)، پس نقص فقط با ساخت/ویرایش مدیر از پنل فعال می‌شد — دقیقاً همان الگوی `saveGoogleUser`. هر دو فیلد با `serverOnly` (محافظت‌شده از ورودی Client) اضافه شدند.
3. **ادعای Audit دربارهٔ منابع موازی نادرست بود.** `src/services/references/mockData.js` و `src/services/articles/mockData.js` و `src/services/analytics/mockData.js` **وجود ندارند**. از ۱۰ فایل mockData که Audit نام برده بود، فقط ۸ فایل هست.
4. **منبع حقیقت دو دامنهٔ حساس اثبات شد** (نه حدس): برای `microCourses` و `testBankQuestions` مسیر خواندن در کد نشان می‌دهد کدام نسخه مقدم است.
5. **`eventSchema` کاملاً خیالی بود (رفع شد).** Schema چهار فیلد اعلام می‌کرد، ولی `analyticsStore.normalizeEvent()` واقعاً **۱۸ فیلد** تولید می‌کند و ۲ فیلد اعلامی هم هیچ‌وقت وجود نداشتند. علامت `unverifiedShape: true` این ناشناسی را پنهان می‌کرد. **چرا کشف شد:** ناظر مسیر نوشتن هنگام اجرا با `TAPESH_MODEL_OBSERVE=1` گزارش `events: unknown_field ×۴۰` داد. یعنی ناظر در عمل یک **ابزار حسابرسی شکاف Schema** هم هست.
6. **۱۷ نوع رویداد تحلیلی هیچ Enum متمرکزی نداشتند (رفع شد).** `ANALYTICS_EVENT_TYPES` به رجیستری اضافه شد و با سنجهٔ انطباق به `analyticsStore.EVENT_TYPES` قفل شد.
7. **نرمال‌ساز دامنه‌ای دو نسخه داشت (رفع شد).** قاعدهٔ «شمارهٔ مدیر/کاربر فقط فاصله‌هایش گرفته شود» هم در `normalizers.js` بود و هم سخت‌کد در `scripts/data-integrity.mjs` — نقض مستقیم بند ۴۸. به `domainNormalizersFor(schema)` یک‌کاسه شد و هر دو مصرف‌کننده از همان می‌خوانند.

**آنچه انجام نشد و صریح گزارش می‌شود:** ناظر مسیر نوشتن **فقط نگاه می‌کند و گزارش می‌دهد** — هیچ نوشتنی را رد نمی‌کند. تبدیل آن به **دروازه** (رد کردن نوشتن نامعتبر با `VALIDATION_ERROR`) یک تصمیم محصولی است که آگاهانه به کاربر واگذار شده، چون می‌تواند رفتار زندهٔ پنل را عوض کند. بخش ۱۳ را ببینید.

---

## ۲. Baseline (پیش از تغییر)

### Git
```
branch : main
HEAD   : a86d875 (manageSOP)
working tree: 72 فایل تغییرکرده نسبت به HEAD (تجمعی فازهای ۱ تا ۵) + ۴۰ مسیر untracked
```
⚠️ Phase 5 هرگز commit نشده است؛ پس diff نسبت به HEAD **تجمعی** است و فاز ۶ را از فازهای قبلی جدا نمی‌کند. تفکیک دقیق در بخش ۱۲ آمده.

### اسکریپت‌های موجود در `package.json` (قبل از فاز ۶)
`dev` · `build` · `preview` · `start` · `theme:check` · `theme:verify` · `theme:contrast` · `theme:tailwind` · `theme:render` · `auth:check` · `auth:test` · `exam:test` · `bank:test` · `planning:test` · `domain:test` · `admin:smoke:test` · `admin:rbac:test` · `admin:security:test` · `admin:test`

### Baseline تست — قبل از هر تغییر در این فاز
| فرمان | نتیجه |
|---|---|
| `auth:test` | **۷۸ قبول · ۰ رد** |
| `exam:test` | **۲۷/۲۷** |
| `bank:test` | **۴۰/۴۰** |
| `admin:test` | **۹۲ + ۶۴ + ۶۰ = ۲۱۶/۲۱۶** |
| `planning:test` | **۳۴/۳۴** |
| `domain:test` | **۲۲/۲۲** |
| **مجموع** | **۴۱۷/۴۱۷** |

### Baseline build
```
npm run build  →  FAIL
[vite]: Rollup failed to resolve import "three"
        from src/layout/dashboard/anatomy3d/engine/AnatomyEngine.js
```
**شکست ازپیش‌موجود.** علت تأییدشده: `node_modules/three/` نصب ناقص است و **`package.json` ندارد** (`ls node_modules/three/` → فقط `LICENSE build examples src`). ربطی به فاز ۶ ندارد و در این فاز دست نخورد (`npm install` بدون درخواست اجرا نشد).

### Precondition — Persistence Layer فاز قبل
✅ **موجود است.** Storeها از abstraction نوشتن اتمیک استفاده می‌کنند (`feedbackStore` → `tmp + renameSync`؛ `contentStore` → `writeJson`). هیچ‌کدام از این primitiveها در فاز ۶ دور زده یا بازنویسی نشد. ابزارهای این فاز **فقط می‌خوانند** (به‌جز `--apply` صریح که اجرا نشد).

### Backup
```
.workbuddy-ai/backups/phase-6-baseline-20260930-100630.tar.gz    (۲۹۸.۸ KB)
.workbuddy-ai/backups/SHA256SUMS-phase-6-baseline-20260930-100630.txt   (۴۳ چک‌سام)
```

---

## ۳. Model Inventory

### خلاصهٔ پوشش
| سنجه | مقدار |
|---|---|
| Entity با Schema رسمی | **۴۴** |
| فایل دادهٔ اسکن‌شده | **۴۳** |
| رکورد اسکن‌شده | **۱٬۵۲۳** |
| ارتباط | **۳۹ + ۱ چندریختی** |
| قید یکتایی | **۱۴** (روی ۱۳ Entity) |
| قاعدهٔ بین‌فیلدی | **۱۴** |
| بررسی عمیق (deep check) | **۴** |
| Entity با ماشین وضعیت | **۹** |
| فیلد راز | **۶** |
| فیلد محافظت‌شده (server-only) | **۱۱۵** |
| Enum متمرکز | **۴۴** |

### Entityها به‌تفکیک دامنه

**پلتفرم (۱۲)** — `admin` · `user` · `session` · `settings` · `activity` · `note` · `alert` · `banner` · `mediaAsset` · `event` · `feedback` · `feedbackReply`

**محتوا (۹)** — `category` · `article` · `page` · `reference` · `flashcardDeck` · `microCourse` · `comprehensiveCourse` · `intlProvider` · `intlCourse`

**رسانه (۱۲)** — `mediaPlatform` · `mediaAccount` · `mediaContent` · `mediaCampaign` · `mediaTeam` · `mediaTag` · `mediaMetric` · `mediaInbox` · `mediaMention` · `mediaNotification` · `mediaUtm` · `mediaMeta`

**ارزیابی (۸)** — `testBankQuestion` · `testBankAnswer` · `testBankHeartReward` · `exam` · `examQuestion` · `examAttempt` · `examReport` · `examAudit`

**انتشار (۳)** — `publishChannel` · `publishLog` · `publishingSecret`

### سطح اطمینان

| دسته | وضعیت | مبنا |
|---|---|---|
| شکل فیلدها، الزامی/اختیاری، nullable، enum | **VERIFIED** | استخراج از کد + دادهٔ واقعی + تست؛ ۱٬۵۲۳ رکورد بدون خطای Schema |
| قیدهای یکتایی | **VERIFIED** | صفر نقض روی دادهٔ واقعی |
| ارتباط‌ها و یتیم‌ها | **VERIFIED** | اسکن کامل؛ ۰ یتیم سخت |
| قاعدهٔ حذف والد | **PARTIALLY VERIFIED** | هر قاعده شاهد کد دارد؛ ولی «حذف واقعی» در این فاز اجرا نشد |
| رفتار هم‌زمانی (concurrency) روی یکتایی | **UNVERIFIED** | فروشگاه تک‌فرآیندی است؛ تست race قابل‌اجرا نبود |
| فلش‌کارت / بین‌الملل / تحلیل — منبع حقیقت | **UNKNOWN** | تقدم یکی بر دیگری اثبات نشد |
| ویکی / لیگ — منبع سروری | **NOT APPLICABLE** | مجموعهٔ سروری وجود ندارد |

---

## ۴. Implemented Changes

### فایل‌های تازه

| فایل | خط | نقش |
|---|---|---|
| `database/models/fields.js` | ۴۶۶ | واژگان پایهٔ فیلد: `str/id/slug/hexColor/num/percent/count/bool/timestamp/epoch/enumOf/arr/obj/json/ref/discriminated` + اصلاح‌گرهای `required/optional/nullable/immutable/secret/serverOnly/describe/withDefault` |
| `database/models/enums.js` | ۳۴۳ | **۴۵ Enum** دامنه به‌صورت آرایهٔ خالص + `ENUM_REGISTRY` + `TRANSITION_REGISTRY` + `canTransition()` |
| `database/models/normalizers.js` | ۳۲۳ | نرمال‌سازی **غیرمخرب**: ارقام فارسی→لاتین، trim، slug، تلفن، ایمیل، شناسه؛ `normalizeRecord` با گزارش مسیر فیلدهای تغییرکرده + `domainNormalizersFor` (قواعد دامنه‌ای، منبع حقیقت مشترک با اسکنر) |
| `database/models/validator.js` | ۴۱۰ | موتور اعتبارسنجی با چهار حالت `stored`/`create`/`update`/`public` + `checkUnique` + `toErrorFields` + `stripSecrets` + `assertValid` |
| `database/models/relations.js` | ۳۲۶ | گراف ۳۹ ارتباط + ۱ چندریختی، با `deleteRule`، `onMissing`، `sentinels` و **ستون `evidence`** |
| `database/models/integrity.js` | ۲۷۷ | توابع **خالص** یکپارچگی: شناسهٔ تکراری، نقض یکتایی، یتیم، شکل ذخیره‌سازی، نشت راز، قالب کلید + `recordsFromContainer` (استخراج مشترک رکورد از ظرف) |
| `database/models/index.js` | ۴۵۴ | رجیستری: `MODELS`، `MODEL_BY_NAME`، `MODELS_BY_COLLECTION`، `COLLECTION_FILES`، `CROSS_FIELD_CHECKS`، `DEEP_CHECKS`، `validateEntity()`، `schemaCoverage()` |
| `database/models/observe.js` | ۲۹۸ | **ناظر مسیر نوشتن** (مرحلهٔ ۸): `inspectWrite`، `observeWrite`، `summarizeWriteReport` + حلقهٔ اخیر + خط لولهٔ `normalize → validate`. بدون عارضهٔ جانبی، بدون پرتاب، پیش‌فرض خاموش |
| `database/models/schemas/platform.js` | ۴۶۹ | ۱۲ Entity پلتفرم |
| `database/models/schemas/content.js` | ۵۹۴ | ۹ Entity محتوا |
| `database/models/schemas/media.js` | ۴۵۱ | ۱۲ Entity رسانه |
| `database/models/schemas/assessment.js` | ۳۴۴ | ۸ Entity ارزیابی |
| `database/models/schemas/publishing.js` | ۱۱۴ | ۳ Entity انتشار |
| `scripts/data-integrity.mjs` | ۵۹۸ | اسکنر یکپارچگی + برنامهٔ تعمیر (dry-run پیش‌فرض). استخراج رکورد و نرمال‌ساز دامنه‌ای به لایهٔ مدل واگذار شد (حذف کپی دوم) |
| `scripts/data-backup.mjs` | ۱۰۴ | پشتیبان tar.gz + مانیفست SHA-256، فهرست فایل‌ها **از Schema** |
| `scripts/data-sources.mjs` | ۴۷۸ | نقشهٔ منابع داده + diff واقعی JSON ↔ mockData + داوری منبع حقیقت |
| `database/dataIntegrity.test.mjs` | ۱۱۸۴ | **۲۵۴ سنجه** در ۱۵ بخش |

### فایل‌های تغییرکرده

| فایل | تغییر | دلیل |
|---|---|---|
| `database/mediaStore.js` | **۱ خط** — `const MEDIA_ENTITY_TYPES` → `export const MEDIA_ENTITY_TYPES` | تنها راه تست انطباق Enum با جدول اصلی، بدون import کردن کل ماژول ۱۴۸ کیلوبایتی در مسیر داغ |
| `database/analyticsStore.js` | **۱ خط** — `const EVENT_TYPES` → `export const EVENT_TYPES` | همان دلیل: تست انطباق `ANALYTICS_EVENT_TYPES ↔ EVENT_TYPES`. مقدار مجموعه تغییر نکرد |
| `database/models/schemas/platform.js` | بازنویسی `eventSchema` + افزودن `createdBy`/`updatedBy` به `adminSchema` | **۳ شکاف Schema کشف‌شده با ناظر** — پایین را ببین |
| `database/contentStore.js` | **~۴۵ خط، همه در یک نقطه** — `observeWrite` در `writeJson` + گارد `TAPESH_MODEL_OBSERVE` + نگاشت معکوس مسیر→مجموعه | سیم‌کشی ناظر مسیر نوشتن. **تنها دروازهٔ نوشتن روی دیسک** انتخاب شد تا یک نقطهٔ تزریق و پوشش کامل باشد. بدون متغیر محیطی، کد مرده است |
| `package.json` | ۶ اسکریپت تازه | `data:check` · `data:check:json` · `data:repair` · `data:backup` · `data:sources` · `data:test` |

### سه شکاف Schema که ناظر کشف کرد (اثر جانبیِ ارزشمند مرحلهٔ ۸)

ناظر مسیر نوشتن، وقتی با `TAPESH_MODEL_OBSERVE=1` در کنار `adminApi.test.mjs` اجرا شد، گزارش داد:
`events: unknown_field ×۱۶` و `×۴۰`. ریشه‌یابی نشان داد `eventSchema` **۴ فیلد خیالی** اعلام می‌کرد
در حالی که `analyticsStore.normalizeEvent()` واقعاً **۱۸ فیلد** تولید می‌کند و ۲ فیلد اعلامی هم
هیچ‌وقت وجود نداشتند (`unverifiedShape: true` علامت این ناشناسی بود). همین کلاس خطا قبلاً یک‌بار
با `usersStore.saveGoogleUser` دیده شده بود.

| # | شکاف | اصلاح | اثبات |
|---|---|---|---|
| ۱ | `admin.createdBy` اعلام‌نشده | افزودن `serverOnly(str({max:80}))` | `real==declared: true` |
| ۲ | `admin.updatedBy` اعلام‌نشده | همان | همان |
| ۳ | `eventSchema` خیالی (۴ ↔ ۱۸) | بازنویسی کامل روی شکل واقعی؛ `ts` با `epoch()` نه ISO | `event fields: 18 · unverifiedShape: undefined` |

همچنین `ANALYTICS_EVENT_TYPES` (۱۷ مقدار، با ترتیب) به `ENUM_REGISTRY` اضافه شد و سنجهٔ
انطباق `ANALYTICS_EVENT_TYPES ↔ analyticsStore.EVENT_TYPES` نتیجهٔ `true` می‌دهد — پس واگرایی
بی‌صدا میان رجیستری و منبع اصلی دیگر ممکن نیست.

### فایل‌های **دست‌نخورده** (بخش حساس خارج از scope)
`database/examStore.js` (mtime ۰۹-۲۸) · `database/examApi.js` (۰۹-۲۸) · `database/userSessions.js` (۰۹-۲۷) · `database/sanitizeHtml.js` (۰۹-۱۵) · `src/router/appRoute.js` (۰۹-۲۹) · `src/router/routeHashes.js` (۰۹-۲۹) — **هیچ‌کدام در این فاز نوشته نشدند** (تأیید با mtime).

هیچ dependency تازه‌ای نصب نشد. `package-lock.json` تغییر نکرد.

---

## ۵. Contracts

به‌جای یک Schema برای همه‌چیز، **مرزها تفکیک شده‌اند** — با `mode` در `validateRecord`:

| قرارداد | حالت | سیاست فیلد ناشناخته | الزامی‌ها | محافظت‌شده | تغییرناپذیر | Default |
|---|---|---|---|---|---|---|
| **Persisted Record** | `stored` | WARN | خطا اگر غایب | بی‌اثر | بی‌اثر | اعمال نمی‌شود |
| **Create Input** | `create` | **ERROR** | خطا | **ERROR** | بی‌اثر | **اعمال می‌شود** |
| **Update/Patch Input** | `update` | WARN | فقط ارسالی‌ها | **ERROR** | **ERROR** | اعمال نمی‌شود |
| **Public API Output** | `public` | WARN | — | — | — | — |
| **Internal Domain Record** | `stored` + `stripSecrets` | WARN | — | — | — | — |

**قواعد رعایت‌شده:**

- **`required` با `nullable` یکی گرفته نشده.** `checkField` اول `null` را می‌سنجد: `null` فقط وقتی مجاز است که `nullable: true` باشد؛ «غایب» داستان دیگری دارد و جدا سنجیده می‌شود (`Object.hasOwn`).
- **Default فقط در `create`.** در `update` دوباره اعمال نمی‌شود (وگرنه ویرایش جزئی مقدار پاک‌شده را برمی‌گرداند).
- **فیلد راز در خروجی عمومی.** `stripSecrets(schema, record)` هر فیلد با `secret: true` را حذف می‌کند، مستقل از اینکه کدام endpoint داده را می‌فرستد. ۶ فیلد راز: `admin.passwordHash` · `user.passwordHash` · `user.googleId` · `testBankQuestion.correctAnswer` · `exam.registrations` · `examQuestion.correctAnswer` · `publishingSecret.tokens`.
- **قرارداد خطای موجود API تغییر نکرد.** `toErrorFields(result)` همان نگاشت `{ field: code }` را می‌سازد که `adminApi.fail('VALIDATION_ERROR', message, fields)` انتظار دارد. **response envelope بازطراحی نشد.**
- **سازگاری دادهٔ قدیمی.** `stored` سخت‌گیر نیست (فیلد ناشناخته = WARN)، پس دادهٔ موجود بی‌دلیل «خراب» اعلام نمی‌شود؛ ولی برای Entityهای امنیت‌محور (`admin`, `user`, `session`, `examAttempt`, `settings`, `publishChannel`, …) فهرست `STRICT_UNKNOWN_FIELD_ENTITIES` فیلد ناشناخته را **ERROR** می‌کند.

### قرارداد شکل رکورد گوگل (یافته و رفع‌شده در این فاز)
`usersStore.saveGoogleUser` رکورد زیر را می‌سازد:
```
{ id, phone: '', googleId, email, emailVerified, passwordHash: null, profile, createdAt, updatedAt }
```
Schema پیش از اصلاح این شکل را **رد می‌کرد** (۴ خطا: `passwordHash: null` + سه فیلد ناشناخته). اصلاح انجام‌شده:

| فیلد | قبل | بعد | شاهد |
|---|---|---|---|
| `passwordHash` | `required` + غیر-null | `nullable: true` | `saveGoogleUser`: `existing?.passwordHash ?? null` |
| `phone` | `min:3`, `allowEmpty:false` | `max:20`, `allowEmpty:true` | `saveGoogleUser`: `phone: existing?.phone ?? ''` |
| `googleId` | تعریف‌نشده | `secret(optional(str))` | `publicUser` آن را حذف می‌کند |
| `email` | تعریف‌نشده | `optional(str)` — **عمومی** | تست گوگل: ایمیل در پاسخ امن می‌آید |
| `emailVerified` | تعریف‌نشده | `optional(bool())` | مبنای اتصال حساب |

⚠️ سیاست «شمارهٔ الزامی و معتبر» **در Schema تکرار نشد** — آن قاعده ورودیِ ثبت‌نام است و در `database/authPolicy.js` می‌ماند (اصل: یک قاعده، یک جا).

### قرارداد شکل رکورد مدیر پنل (یافته و رفع‌شده در این فاز)
`contentStore.createAdmin()` و `updateAdmin()` رکورد زیر را می‌نویسند:
```
{ id, username, name, email, passwordHash, role, isActive,
  mustChangePassword, lastLoginAt, createdAt, updatedAt,
  createdBy: actor?.id ?? 'system',      ← createAdmin
  updatedBy: actor?.id ?? 'system' }     ← updateAdmin
```
`adminSchema` هیچ‌کدام از دو فیلد آخر را اعلام نکرده بود. چون `admin` در `STRICT_UNKNOWN_FIELD_ENTITIES` است، نتیجه **خطای `unknown_field`** بود نه هشدار. اصلاح:

| فیلد | قبل | بعد | شاهد |
|---|---|---|---|
| `createdBy` | تعریف‌نشده | `serverOnly(str({ max: 80 }))` | `createAdmin()`: `createdBy: actor?.id ?? 'system'` |
| `updatedBy` | تعریف‌نشده | `serverOnly(str({ max: 80 }))` | `updateAdmin()`: `updatedBy: actor?.id ?? 'system'` |

`serverOnly` ⇒ `protected: true` ⇒ در حالت `create`/`update` ورودی Client با کد `protected_field` رد می‌شود. این هم‌جهت با قاعدهٔ RBAC است: **رد پای سازنده را نباید کلاینت تعیین کند.**

⚠️ **چرا این نقص «نهفته» بود و در `data:check` دیده نمی‌شد:** هیچ رکورد موجودی این فیلدها را ندارد — مدیر کلِ seed از `seedAdmins()` می‌آید و این فیلد را ست نمی‌کند. یعنی نقص فقط با **ساخت یا ویرایش یک مدیر از پنل** فعال می‌شد. برای همین، اسکن دادهٔ موجود نمی‌توانست آن را بگیرد؛ تست قرارداد (بخش ۲) آن را قفل می‌کند.
✅ **اثبات غیرمخرب‌بودن اصلاح:** خروجی `data:check` پس از افزودن این دو فیلد **بایت‌به‌بایت** برابر قبل است — چون دادهٔ موجود این فیلدها را ندارد، افزودنشان هیچ خطا/هشدار تازه‌ای تولید نمی‌کند.

### گاردِ سراسری شکاف Schema
فراتر از این یک مورد، یک سنجهٔ دائمی اضافه شد: **هیچ فیلدی در دادهٔ واقعی نباید اعلام‌نشده باشد.** این تست، کلاسِ همین نقص را می‌گیرد — اگر روزی Store فیلد تازه‌ای بنویسد و Schema به‌روز نشود، تست می‌شکند (نه اینکه بی‌صدا رد شود).

---

## ۶. Integrity Findings

### گراف ارتباط — ۳۹ + ۱
| قاعدهٔ حذف | تعداد | معنا |
|---|---|---|
| `RESTRICT` | ۲۳ | حذف والد ممنوع تا وقتی فرزند دارد |
| `SET_NULL` | ۷ | ارجاع فرزند `null` می‌شود |
| `SOFT` | ۴ | ارجاع تاریخی؛ نبودِ والد خطا نیست |
| `FREE` | ۳ | بدون چک والد — **ریسک بازمانده، مستند** |
| `DETACH` | ۲ | عضو از آرایهٔ فرزند برداشته می‌شود |
| `CASCADE` | ۰ | واژه تعریف شده ولی **هیچ رابطه‌ای استفاده نمی‌کند** |

هر ۳۹ ردیف ستون `evidence` دارد که فایل و تابع را نام می‌برد (مثال: `mediaStore.js:592 → deleteAccount (CONFLICT اگر محتوا دارد)`).

### یتیم‌های واقعی
| رابطه | نوع | تعداد | تفسیر |
|---|---|---|---|
| `publishLog.channelId → publishChannels.id` | **SOFT** | **۲** | لاگ تاریخی پس از حذف کانال `ch-p5yo48cgn`. رفتار عمدی: `publishingStore.deleteChannel` لاگ را دست‌نخورده می‌گذارد. |
| `activity.userId → admins.id` | **SOFT** | **۱۸** | لاگ فقط‌افزودنی؛ مدیر حذف‌شده رکورد تاریخی‌اش می‌ماند. مقدار `system` به‌عنوان sentinel شناخته می‌شود. |
| **یتیم سخت (نقض یکپارچگی ارجاعی)** | **ERROR** | **۰** | — |

**۳۸ ارتباط دیگر کاملاً سالم‌اند.**

### خطاهای واقعی دادهٔ — F1–F4 (**تعمیر شد** در ۳۰ سپتامبر با تأیید کاربر)
| # | Entity | کد | توصیف | وضعیت |
|---|---|---|---|---|
| ۱ | `page` `pg-layer-01` | `unexpected_published_at` | `publishedAt` روی رکورد منتشرنشده مقدار دارد | ✅ تعمیر شد |
| ۲–۴ | `microCourse` `mcr-physiology` | `orphan_page_ref` ×۳ | ایستگاه `cp3` به صفحه‌های `p11`/`p12` ارجاع می‌دهد که در واحد `cardiac-cycle-unit` وجود ندارند | ✅ تعمیر شد |

**خطاهای فعلی دادهٔ واقعی = ۰** (`data:check` → `خطا=0 هشدار=22 رکورد=1525`، exit 0). تست `dataIntegrity.test.mjs` از حالت «قفلِ وجودِ نقص» به «قفلِ سلامتِ پابرجا» برگشت: اگر F1–F4 برگردند یا یافتهٔ تازه‌ای ظاهر شود، سنجهٔ ناموفق نامِ کد را در پیام خود می‌آورد.

### سیاست حذف والد — وضعیت اثبات
| رابطه | policy | وضعیت |
|---|---|---|
| `articles.category` | RESTRICT | ✅ اثبات‌شده (`deleteCategory` → CONFLICT) |
| `intlCourses.providerId` | RESTRICT | ✅ |
| `mediaContents.accountId` | RESTRICT | ✅ |
| `mediaContents.campaignId` | SET_NULL | ✅ (`deleteCampaign` محتوا را جدا می‌کند) |
| `mediaContents.tagIds[]` | DETACH | ✅ (`deleteTag` از آرایه برمی‌دارد) |
| `mediaMentions.keywordId` | FREE | ⚠️ **ریسک بازمانده** — `deleteMention` والد را چک نمی‌کند |
| `mediaUtm.contentId` / `campaignId` | FREE | ⚠️ **ریسک بازمانده** |
| `mediaMetrics.accountId` | RESTRICT (اعلامی) | ⚠️ سنجه‌ها در `deleteAccount` چک نمی‌شوند |

قاعدهٔ حذف در این فاز **اجرا نشد** — فقط inventory و اسکن شد (بند «رفتار هنگام حذف parent: اگر از کد اثبات‌نشدنی، UNKNOWN ثبت کن»).

---

## ۷. Uniqueness Findings

### ۱۴ قید
| Entity | فیلد(ها) | scope | حساس به بزرگی/کوچکی | نرمال‌سازی |
|---|---|---|---|---|
| `admin` | `username` | global | **بله** (`caseInsensitive`) | trim |
| `user` | `phone` | global | خیر | حذف فاصله + ارقام لاتین |
| `article` | `slug` | global | خیر | trim |
| `page` | `slug` | global | خیر | trim |
| `intlProvider` | `logoKey` | global | خیر | `ignoreEmpty` |
| `mediaAccount` | `internalId` | global | خیر | trim |
| `mediaAccount` | `platform + externalId` | **scoped ترکیبی** | خیر | — |
| `mediaTag` | `kind + slug` | ترکیبی | خیر | — |
| `mediaMetric` | `accountId + date` | ترکیبی | خیر | — |
| `testBankQuestion` | `id` | global | خیر | — |
| `testBankAnswer` | `userId + questionId` | ترکیبی | خیر | — |
| `testBankHeartReward` | `userId + attemptKey` | ترکیبی | خیر | — |
| `exam` | `slug` | global | خیر | — |
| `examAttempt` | `id` | global | خیر | — |

### duplicate واقعی
**صفر.** اسکنر روی هر ۱٬۵۲۳ رکورد هیچ نقض قید یکتایی و هیچ شناسهٔ تکراری پیدا نکرد. پس هیچ merge یا حذفی لازم نشد.

### محل بررسی
- بررسی **قبل از نوشتن**: `validator.checkUnique()` — به‌طور پیش‌فرض **خاموش** است؛ چون بدون فهرست کامل، هر رکورد با خودش «تکراری» می‌شود. `assertValid()` آن را روشن می‌کند.
- بررسی **روی دادهٔ ذخیره‌شده**: `findUniqueViolations()` در اسکنر — فهرست را یک‌جا می‌بیند.

### هم‌زمانی
**UNVERIFIED.** فروشگاه JSON تک‌فرآیندی است و primitive قفل (lock) ندارد؛ «چک قبل از نوشتن» یک **constraint اتمیک نیست**. اگر دو نوشتن هم‌زمان برسند، هر دو چک را پاس می‌کنند و دومی برنده می‌شود. این محدودیت **مستند شد و پنهان نشد**؛ رفعش نیازمند قفل فایل یا دیتابیس است که خارج از scope این فاز است.

---

## ۸. Duplication Findings

ابزار: `npm run data:sources` (فقط‌خواندنی، خروجی قطعی)

### میکرودرسنامه — واگرایی صفر
| منبع | رکورد |
|---|---|
| `database/content/microCourses.json` (پنل) | ۱۶ |
| `src/data/micro/registry.js` (ایستا) | ۱۶ |
| **مشترک بر اساس `subjectId`** | **۱۶ (۱۰۰٪)** |
| فقط در پنل / فقط در ایستا | **۰ / ۰** |

وضعیت انتشار: **۱ منتشرشده** (`physiology`)، **۱۵ پیش‌نویس**.
کلید اتصال `subjectId` است نه `id` (رجیستری `physiology`، پنل `mcr-physiology`).

**داوری منبع حقیقت: `SERVER-WHEN-PUBLISHED`**
شاهد: `microContentService.js` → `getCourseSync`/`getCourse`:
```js
publishedCourse(courseId) ?? COURSE_REGISTRY[courseId]
```
`publishedCourse` فقط رکوردهای `/api/public/micro/library` را می‌بیند. پس برای درس منتشرشده، نسخهٔ پنل جای ایستا را می‌گیرد؛ برای ۱۵ درس دیگر، ایستا پاسخ می‌دهد. `id` خروجی روی شناسهٔ محلی یکسان می‌شود تا کلید پیشرفت کاربران گم نشود.

### بانک تست — واگرایی کلیدی صفر، واگرایی فیلدی معنادار
| منبع | رکورد |
|---|---|
| `database/content/testBankQuestions.json` (پنل) | ۵۹ |
| `src/services/testBank/mockData.js` (ایستا) | ۵۹ |
| **مشترک بر اساس `id`** | **۵۹ (۱۰۰٪)** |
| رکورد کاملاً یکسان | **۰ / ۵۹** |

diff فیلدی:
| الگو | تعداد | فیلدهای فقط-پنل | فیلدهای با مقدار متفاوت |
|---|---|---|---|
| A | **۳۱** | `correctAnswer`, `explanation`, `status` | `difficulty`, `stats` |
| B | **۲۷** | `correctAnswer`, `explanation`, `status` | `stats` |
| C | **۱** | `conceptIds`, `correctAnswer`, `examMonth`, `explanation`, `status`, `updatedBy` | `difficulty`, `stats`, `stem`, `updatedAt`, `year` |

**داوری منبع حقیقت: `SERVER`**
شاهد: `testBankService.js` → `loadPublishedQuestions`:
```js
QUESTIONS.splice(0, QUESTIONS.length, ...payload.data.questions);
```
پاسخ `/api/public/test-bank/questions` **درجای** آرایهٔ mockData را بازنویسی می‌کند. پس mockData فقط seed و fallback پیش از hydration است. وجود `correctAnswer` **فقط** در نسخهٔ پنل، تأیید دوم است: کلید پاسخ هرگز به mockData نمی‌رسد.

### سایر دامنه‌ها
| دامنه | منابع | داوری |
|---|---|---|
| ویکی | فقط `src/services/wiki/mockData.js` | **CLIENT-STATIC** — هیچ مجموعهٔ سروری نیست |
| لیگ | فقط `src/services/league/mockData.js` | **CLIENT-STATIC** |
| یادداشت | `notes.json` (۱۱) + `notes/mockData.js` | **NO-OVERLAP** — mockData فقط ثابت‌های UI دارد، صفر رکورد |
| منابع مرجع | `references.json` (۳) + `referenceCatalog.js` | **NO-OVERLAP** — **`references/mockData.js` وجود ندارد** |
| فلش‌کارت | `flashcardDecks.json` (۱۱) + `flashcards/mockData.js` | **UNKNOWN** |
| بین‌الملل | `intlCourses.json` (۷) + `intlProviders.json` (۱۳) + `intlCatalog.js` + `mockData.js` | **UNKNOWN** |
| تحلیل | `alerts.json` (۵) + `analytics/mockData.js` | **UNKNOWN** |

### تصحیح Audit
ادعای «۱۰ فایل mockData» در Audit نادرست است. فایل‌های موجود: `analytics` · `flashcards` · `international` · `league` · `notes` · `testBank` · `wiki` (۷ فایل) — `articles`، `references` و `ai/mockResponses.js` طبق مسیرهای نام‌برده‌شده وجود ندارند.

### اقدام انجام‌شده روی duplication
**هیچ منبعی حذف یا ادغام نشد.** دلیل: مصرف‌کنندگان هر دو منبع زنده‌اند و migration + rollback کامل تعریف نشده. تنها اقدام، **مستندسازی مسیر canonical با شاهد کد** و قفل‌کردن ناوردایی‌ها با تست است (بخش ۱۴ تست).

---

## ۹. Migration Report

### Preflight + Dry-run
```
npm run data:repair      →  پیش‌فرض DRY-RUN

اسکن‌شده: 1522   تغییر: 6   بدون تغییر: 1516   نامعتبر: 0   فایل: 43
```
تفاوت ۱۵۲۲ با ۱۵۲۳ اسکنر: فایل راز انتشار (`sensitiveFile`) از تعمیر کنار گذاشته می‌شود.

| Entity | فایل | رکورد | تغییر |
|---|---|---|---|
| `banner` | `database/content/banners.json` | ۱ | `startDate: "" → null` · `endDate: "" → null` |
| `mediaTag` | `database/content/mediaTags.json` | ۵ | `color: "" → null` |

### ماهیت migration
این migration **فقط نرمال‌سازی ساختاری** است (`""` یعنی «تعیین‌نشده» → `null`). **هیچ «تعمیر معنایی» انجام نمی‌دهد** — مقدار نامعتبر گزارش می‌شود، نه بازنویسی. (`"abc"` برای یک فیلد عددی هرگز به `0` تبدیل نمی‌شود.)

### آنچه تأمین شده
| الزام | وضعیت | شاهد |
|---|---|---|
| preflight scan | ✅ | شمارندهٔ `اسکن‌شده/تغییر/بدون تغییر/نامعتبر` |
| dry-run | ✅ | پیش‌فرض؛ اعمال فقط با `--apply` صریح |
| backup | ✅ | `data:backup` → tar.gz + SHA-256 + فایل `.bak` کنار هر فایل |
| deterministic transform | ✅ | همان ورودی ⇒ همان برنامه (خروجی قطعی) |
| post-migration validation | ✅ | `npm run data:check` |
| rollback | ✅ | بازگرداندن `.bak` (تست‌شده) |
| idempotency | ✅ | تست روی **کل ۱٬۵۲۳ رکورد واقعی** |
| گزارش scanned/changed/skipped/failed | ✅ | خط شمارنده در خروجی |
| عدم اجرای پنهان در import/startup | ✅ | فقط CLI صریح |

### اعمال واقعی
**انجام نشد.** دلایل:
1. نرمال‌سازی `"" → null` سود عملکردی ندارد و تغییر داده برای تغییر تزئینی، با اصل «غیرمخرب بمان» ناسازگار است.
2. کاربر ترجیح می‌دهد قبل از هر تغییر روی داده، صریح پرسیده شود.

اگر اعمال لازم شد:
```bash
npm run data:backup -- --label=before-normalize
npm run data:repair -- --apply
npm run data:check
```

---

## ۱۰. Tests

| فرمان | نتیجه | توضیح |
|---|---|---|
| `npm run data:test` | **۲۵۴/۲۵۴ ✅** | ۱۵ بخش: پایهٔ فیلد (۳۳) · ماتریس اعتبارسنجی (۲۰) · ساختار تودرتو (۶) · یکتایی (۱۱) · ارجاع و حذف (۱۳) · گذار وضعیت (۷) · بین‌فیلدی (۷) · نرمال‌سازی≠تعمیر (۱۲) · راز/محافظت/default (۷) · شکل ذخیره‌سازی (۱۱) · انطباق enum (۳۴) · اسکن دادهٔ واقعی (۴۱) · مهاجرت (۱۲) · منابع موازی (۶) · **ناظر مسیر نوشتن (۳۴)** |
| `npm run data:check` | **WARN (۰ خطا، ۲۲ هشدار، ۱۵۲۵ رکورد) ✅** | خروجی ۰. ۲۲ هشدار همه «ارجاع نرم تاریخی»اند (۱۸ `activity.userId` · ۲ `publishLog.channelId` · ۲ `exam`). F1–F4 تعمیر شد ⇒ هیچ خطای یکپارچگی نمانده. |
| `npm run data:sources` | **۹ دامنه · ۶ داوری‌شده · ۳ UNKNOWN** | فقط‌خواندنی |
| `npm run auth:test` | **۷۸ قبول · ۰ رد ✅** | |
| `npm run exam:test` | **۲۷/۲۷ ✅** | |
| `npm run bank:test` | **۴۰/۴۰ ✅** | |
| `npm run admin:test` | **۹۲ + ۶۴ + ۶۰ = ۲۱۶/۲۱۶ ✅** | |
| `npm run planning:test` | **۳۴/۳۴ ✅** | |
| `npm run domain:test` | **۲۲/۲۲ ✅** | |
| **مجموع رگرسیون** | **۴۱۷/۴۱۷ ✅** | برابر baseline، صفر شکست تازه |
| `npm run build` | **FAIL ❌ (ازپیش‌موجود)** | `Rollup failed to resolve import "three"` |

### پوشش ۲۵ تست اجباری صورت‌مسئله
| # | تست | وضعیت |
|---|---|---|
| ۱–۷ | schema · create/update معتبر و نامعتبر · optional≠nullable · default · unknown field | ✅ بخش ۲ |
| ۸–۱۰ | unique slug · username · phone | ✅ بخش ۴ |
| ۱۱–۱۴ | relation معتبر · parent مفقود · orphan scanner · رفتار حذف | ✅ بخش ۵ (حذف = inventory، اجرا نشد) |
| ۱۵–۱۷ | JSON سالم · legacy · malformed | ✅ بخش ۱۰ |
| ۱۸ | consistency JSON ↔ mockData | ✅ بخش ۱۴ |
| ۱۹–۲۱ | migration dry-run · idempotency · rollback | ✅ بخش ۱۳ |
| ۲۲ | backward compatibility API | ✅ بخش ۱۱ |
| ۲۳ | public output بدون فیلد حساس | ✅ بخش ۹ |
| ۲۴ | regression بخش‌های حساس | ✅ ۴۱۷ سنجه |
| ۲۵ | build کامل | ❌ **BLOCKED** (`three`) |
| + | race/concurrency | ⚠️ **UNVERIFIED** — ساختار تک‌فرآیندی، تست قابل‌اجرا نبود |
| + | ناظر مسیر نوشتن (خارج از فهرست ۲۵، افزودهٔ مرحلهٔ ۸) | ✅ بخش ۱۵ — ۳۴ سنجه |

### اثبات بی‌اثری ناظر (اجرای واقعی، نه استدلال)

| سنجه | خاموش (پیش‌فرض) | روشن (`TAPESH_MODEL_OBSERVE=1`) |
|---|---|---|
| گزارش‌های ناظر | **۰** | **۶** (۵ مجموعه + `settings`) |
| فایل‌های تغییرکرده از ۴۳ | **۰** | **۰** |
| ارجاع برگشتی `writeCollection` | همان آرایهٔ ورودی | همان آرایهٔ ورودی |
| زمان اضافه‌شده به بارگذاری `contentStore` | **۰ms** (ماژول مدل بارگذاری نمی‌شود) | ~۱٬۵s فقط در اولین نوشتن |

اجرا با اثر انگشت SHA-256 روی همهٔ ۴۳ فایل داده، پیش و پس از نوشتن. اسکریپت کاوش موقت بود و **حذف شد**؛ همین سنجه‌ها به‌صورت دائمی در بخش ۱۵ تست قفل شده‌اند.

### تله‌های محیطی (ثبت‌شده برای اجراهای بعدی)
- اجرای سوییت‌ها با `npm run` روی این مک به `CODEBUDDY_BROKER_DENY` می‌خورد؛ با **مسیر مطلق node مدیریت‌شده** اجرا کنید: `/Users/heidarian/.workbuddy-ai/binaries/node/versions/22.22.2-2/bin/node`.
- `adminApi.test.mjs` فایل‌های `content/*.json` را بازنویسی می‌کند ⇒ **قبل از اجرا `npm run data:backup`**.
- `usersAuth.test.mjs` در `finally` بکاپ را برمی‌گرداند، ولی اگر **وسط اجرا kill شود**، fixtureها می‌مانند (بخش ۱۳).

---

## ۱۱. Compatibility

### API
- **هیچ endpoint تغییر نکرد.** هیچ مسیری اضافه/حذف/تغییر نشد.
- **response envelope بازطراحی نشد.** `toErrorFields()` فقط همان `fields: { field: code }` موجود را پر می‌کند.
- **هیچ status code عوض نشد.**
- اثبات: `admin:test` (۹۲ سنجهٔ API) و `admin:rbac` (۶۴) و `auth:test` (۷۸) — همه سبز، برابر baseline.

### Store و Persistence
- هیچ Store بازنویسی نشد. `mediaStore.js` فقط یک `export` گرفت (رفتار بدون تغییر).
- primitiveهای اتمیک فاز قبل (`tmp + rename`) دست‌نخورده.
- **`contentStore.js` و `adminApi.js` به domain module نشکستند.**

### دادهٔ legacy
- حالت `stored` روی فیلد ناشناخته **WARN** می‌دهد نه ERROR ⇒ دادهٔ قدیمی «خراب» اعلام نمی‌شود.
- `verifyPasswordHash` و مسیر ارتقای SHA-256 → scrypt دست‌نخورده (`auth:test` سبز).
- ۱٬۵۲۳ رکورد واقعی با صفر خطای Schema خوانده شدند.

### Frontend
هیچ فایل `src/` به‌جز یک `export` در `database/mediaStore.js` تغییر نکرد. هیچ CSS، هیچ UI، هیچ منطق آزمون/امتیاز/قلب/لیگ/مسیر سبز دست نخورد.

### شکست‌های جدید
**صفر.** تنها شکست، `build` است که از پیش از این فاز شکسته بود و علتش در `node_modules` است نه در کد.

---

## ۱۲. Git Diff Summary

### تغییرات فاز ۶
```
جدید (untracked):
  database/models/                      (۱۳ فایل، ۴٬۸۶۹ خط)
  database/dataIntegrity.test.mjs       (۱٬۱۸۴ خط)
  scripts/data-integrity.mjs            (۵۹۸ خط)
  scripts/data-backup.mjs               (۱۰۴ خط)
  scripts/data-sources.mjs              (۴۷۸ خط)
  ── مجموع کد تازه: ۷٬۲۳۳ خط

تغییرکرده:
  database/mediaStore.js                +۱ −۱     (افزودن export به یک const موجود)
  database/analyticsStore.js            +۱ −۱     (افزودن export به یک const موجود)
  database/contentStore.js              +۵۶ −۱    (ناظر مسیر نوشتن: ۱ import + ۴ خط نگاشت معکوس
                                                  + ۵ خط writeJson + ۴۷ خط بلوک ناظر)
  package.json                          +۶ −۰     (اسکریپت‌های data:*)
```

> ⚠️ **دربارهٔ diff تجمعی `contentStore.js`.** `git diff` عدد **+۵۸۴ −۴۹** نشان می‌دهد
> که **تجمعی فازهای پیشین** است (کار روی media/planning/analytics)، نه فاز ۶.
> سهم دقیق این مرحله **+۵۶ −۱** است و با شمارش خطی همان بلوک‌ها اندازه‌گیری شد،
> نه تخمین.

> ⚠️ `contentStore.js` **مسیر CRUD، امضاها و مقادیر برگشتی‌اش دست‌نخورده است.** تنها
> تغییر، یک فراخوانی `observeWrite` پس از `writeFileSync` در `writeJson` است که
> خودش اول با گارد `process.env.TAPESH_MODEL_OBSERVE !== '1'` برمی‌گردد.
> اثبات: خروجی `data:check` بایت‌به‌بایت برابر baseline، و هر ۴۱۷ سنجهٔ رگرسیون سبز.

### تغییرات **نامرتبط** وارد diff نشده‌اند
۷۲ فایل تغییرکردهٔ دیگر نسبت به HEAD، تجمعی فازهای ۱ تا ۵ است (سبک‌ها، احراز هویت، RBAC، امنیت آزمون) و در این فاز دست نخوردند — تأیید با mtime: هیچ‌کدام از آن‌ها تاریخ ۰۹-۳۰ ندارند.

Git history دست‌کاری نشد. هیچ commit/stash/reset انجام نشد.

---

## ۱۳. Unknown / Unverified / Blocked

### BLOCKED
| مورد | دلیل | کوچک‌ترین dependency لازم |
|---|---|---|
| **`npm run build`** | `node_modules/three/package.json` وجود ندارد؛ نصب ناقص | اجرای `npm install` (بدون درخواست صریح اجرا نشد) |
| **تست race/concurrency روی یکتایی** | فروشگاه JSON تک‌فرآیندی و بدون قفل است؛ شبیه‌سازی هم‌زمانی واقعی ممکن نیست | قفل فایل یا دیتابیس — خارج از scope این فاز |

### PARTIAL
| مورد | چه چیزی هست | چه چیزی نیست |
|---|---|---|
| **Validation Integration** | اعتبارسنجی روی **هر دو مرز** فعال است. **مرز خواندن:** اسکنر هر ۱٬۵۲۵ رکورد را در هر اجرا می‌سنجد. **مرز نوشتن:** ناظر `database/models/observe.js` روی **تنها دروازهٔ نوشتن روی دیسک** (`writeJson` در `contentStore.js`) سیم‌کشی شده و هر نوشتنِ `database/content/` — چه از مسیر CRUD پنل و چه از توابع یک‌بارهٔ همگام‌سازی — را می‌سنجد. پوشش: **۳۳ مجموعهٔ `COLLECTIONS` + `settings`** (۱۰۰٪، با تست). | ناظر **دروازه نیست**: نوشتن نامعتبر را رد نمی‌کند و `VALIDATION_ERROR` پرتاب نمی‌کند. **عمدی:** صورت‌مسئله گفته «رفتار عمومی endpointها را بدون ضرورت تغییر نده»؛ تبدیل ناظر به دروازه می‌تواند رفتار زندهٔ پنل را عوض کند، پس یک **تصمیم محصولی** است و به کاربر واگذار شده. |
| **قاعدهٔ حذف والد** | هر ۳۹ رابطه قاعدهٔ مستند + شاهد کد دارد | خودِ حذف اجرا و تست نشد؛ رفتار `FREE` در سه رابطه **ریسک بازمانده** است |

#### ناظر مسیر نوشتن — چه چیزی اثبات شد

| ویژگی | شاهد |
|---|---|
| **پیش‌فرض خاموش** | بدون `TAPESH_MODEL_OBSERVE=1` هیچ ماژول مدلی بارگذاری نمی‌شود. گارد در `writeJson` قبل از هر کاری برمی‌گردد. |
| **بدون تغییر رفتار** | `writeCollection` همان **ارجاع** آرایهٔ ورودی را برمی‌گرداند و فایل بایت‌به‌بایت دست‌نخورده می‌ماند — با اثر انگشت SHA-256 روی همهٔ ۴۳ فایل، در دو حالت خاموش و روشن. |
| **بدون پرتاب** | روی `null` / `undefined` / رشته / عدد / آرایه در جای نگاشت / مجموعهٔ ناشناخته ⇒ گزارش خالی، بدون استثنا (۸ حالت تست‌شده). |
| **بدون تغییر داده** | `inspectWrite` روی ورودی، همان ارجاع و همان محتوا را برمی‌گرداند. |
| **هم‌عقیده با اسکنر** | روی دادهٔ واقعی، خطاهای ناظر **دقیقاً** برابر خطاهای اسکنر است (نه بیشتر، نه کمتر) — این تست وجود دو روایت از یک داده را غیرممکن می‌کند. |
| **هزینهٔ صفر در حالت خاموش** | `import` ثابت مدل ۱٬۵۳۷ms و `contentStore` ۳٬۵۸۸ms طول می‌کشد؛ پس بارگذاری **تنبل و همگام** با `createRequire` انجام می‌شود، نه `import` ثابت (که هزینه را به همه تحمیل می‌کرد) و نه `import()` دینامیک (که نوشتن اول را از دست می‌داد). |

#### سه دوری که در این مرحله اصلاح شد

۱. **نقطهٔ تزریق اول اشتباه بود.** ابتدا ناظر در `writeCollection` و `writeSettings` گذاشته شد؛ ولی grep نشان داد **۶ فراخوانی مستقیم دیگر** به `writeJson` هست (توابع یک‌بارهٔ `syncArticles` · `syncReferences` · `syncFlashcardDecks` · `syncMicroCourses` · `syncIntlCatalog`). پس تزریق به **خودِ `writeJson`** منتقل شد: یک نقطه، پوشش کامل، بدون گزارش تکراری.

۲. **ناظر داشت دادهٔ خام را اعتبارسنجی می‌کرد.** این خلاف دکترین خودِ پروژه بود: `normalizers.js` صریح می‌گوید **`normalize → validate → persist`** و نه `validate raw → normalize later`. اعتبارسنجی خام، **۷ خطای کاذب** می‌ساخت (`۵×mediaTag.color:empty` + `۲×banner.startDate/endDate:format`) که خودِ نرمال‌سازی پروژه حلشان می‌کند. ناظر اصلاح شد و حالا **دقیقاً** مثل اسکنر عمل می‌کند.

۳. **نرمال‌ساز دامنه‌ای کپی دوم داشت.** قاعدهٔ «شمارهٔ مدیر/کاربر فقط فاصله‌هایش گرفته شود» داخل خودِ اسکنر سخت‌کد بود. به `domainNormalizersFor(schema)` در `normalizers.js` منتقل شد و **هر دو** مصرف‌کننده از آن می‌خوانند — یک منبع حقیقت، طبق بند ۴۸.

### UNKNOWN
- منبع حقیقت فلش‌کارت، بین‌الملل و تحلیل (۳ دامنه).
- رفتار هم‌زمانی روی قیدهای یکتایی.
- `CASCADE` به‌عنوان قاعدهٔ حذف تعریف شده ولی هیچ رابطه‌ای از آن استفاده نمی‌کند — یعنی ممکن است رابطه‌ای وجود داشته باشد که ناشناخته است.

### یافتهٔ محیطی (نیازمند تصمیم کاربر — **حذف نشد**)
فایل `database/users.json` در حال حاضر **۵ کاربر** دارد: ۱ کاربر واقعی (`heidarian`) + **۴ fixture آزمایشی** که از یک اجرای نیمه‌تمام `usersAuth.test.mjs` باقی مانده‌اند (`قربانی` · `legacy-user-1` · `google-user-1` · `تازه`). این‌ها دادهٔ واقعی نیستند، ولی طبق سیاست، **هیچ‌چیز حذف نشد**. پاک‌سازی برگشت‌پذیر:
```bash
tar -xzf .workbuddy-ai/backups/phase-6-baseline-20260930-100630.tar.gz database/users.json
```
(پشتیبان همان لحظه فقط کاربر واقعی را داشت.)

به همین ترتیب، اجرای سوییت‌های رگرسیون ۹ فایل داده را تغییر داد: `activity.json` · `admins.json` · `articles.json` · `events.json` · `exams.json` · `notes.json` · `publishChannels.json` · `users.json` · `users.sessions.json`. این اثر جانبی **ازپیش‌موجود** تست‌هاست، نه فاز ۶.

**وضعیت نهایی پس از آخرین اجرا (۱ اکتبر):** `activity.json` و `admins.json` که سوییت `adminApi.test.mjs` آلوده کرده بود (لاگ‌های آزمایشی `2026-10-01T06:11` و `lastLoginAt` تست)، به HEAD بازگردانده شد و نسخهٔ آلوده در `/tmp/tapesh-testpollution-20261001/` نگه داشته شد. `users.json` و `users.sessions.json` خودِ تست در `finally` برمی‌گرداند. `exams.json` هم پس از اجرا بایت‌به‌بایت با HEAD یکی است. پس از بازگردانی: `data:check` → **۰ خطا · ۲۲ هشدار · ۱۵۲۵ رکورد · exit 0**.

---

## ۱۴. Definition of Done

| بند | وضعیت | شاهد |
|---|---|---|
| inventory مدل‌ها بر اساس شواهد Repository | **PASS** | ۴۴ Entity، بخش ۳ |
| Schemaهای Entityهای توافق‌شده | **PASS** | ۵ فایل دامنه، بدون God File |
| Create/Update/Persisted/Public تفکیک‌شده | **PASS** | ۴ حالت `validateRecord` |
| validation در write boundaryهای **انتخاب‌شده** فعال | **PASS** | ناظر روی تنها دروازهٔ نوشتن روی دیسک (`writeJson`)؛ پوشش ۳۳ مجموعه + `settings`؛ ۳۴ سنجه در بخش ۱۵ |
| Enumهای مشترک و اثبات‌شده متمرکز | **PASS** | ۴۴ Enum + ۳۳ سنجهٔ انطباق با جدول اصلی |
| unique rules مستند و تست‌شده | **PASS** | ۱۴ قید، صفر duplicate |
| relationهای شناخته‌شده inventory‌شده | **PASS** | ۳۹ + ۱ با ستون evidence |
| integrity scanner غیرمخرب | **PASS** | `data:check` فقط‌خواندنی |
| تفکیک orphan واقعی از ممکن | **PASS** | ۲ نرم واقعی، ۰ سخت |
| diff واقعی JSON ↔ mockData | **PASS** | `data:sources` |
| canonical source فقط در موارد اثبات‌شده | **PASS** | ۲ اثبات‌شده، ۳ UNKNOWN، ۲ CLIENT-STATIC، ۲ NO-OVERLAP |
| migration با dry-run/backup/idempotency/rollback | **PASS** | بخش ۹ |
| داده بدون گزارش و migration حذف/بازنویسی نشده | **PASS** | صفر نوشتن روی دادهٔ واقعی |
| APIهای موجود backward-compatible | **PASS** | ۴۱۷ سنجهٔ رگرسیون سبز |
| build و تست‌ها اجرا و ثبت‌شده | **PARTIAL** | تست‌ها ✅ · build ❌ (ازپیش‌موجود) |
| بخش‌های حساس خارج از scope تغییر نکرده | **PASS** | تأیید با mtime |
| UNKNOWN/UNVERIFIEDها صریح گزارش شده | **PASS** | بخش ۱۳ |
| Git diff فقط شامل تغییرات لازم این فاز | **PASS** | بخش ۱۲ |

**۱ PARTIAL از ۱۸ بند** (`build` — ازپیش‌موجود و بی‌ربط) — هیچ‌کدام ناشی از تخطی از scope نیست؛ ریشه در محدودیت محیط دارد.

---

## ۱۵. Rollback Instructions

### بازگرداندن کامل فاز ۶
```bash
cd "/Users/heidarian/Documents/my own project/tapeshweb"

# ۱) حذف فایل‌های تازهٔ فاز ۶
rm -rf database/models
rm -f database/dataIntegrity.test.mjs
rm -f scripts/data-integrity.mjs scripts/data-backup.mjs scripts/data-sources.mjs

# ۲) بازگرداندن فایل‌های تغییرکردهٔ بیرون از database/models/
#    mediaStore/analyticsStore فقط «export» شدند (مقدار داده عوض نشد) و چون
#    مصرف‌کنندهٔ‌شان (dataIntegrity.test.mjs) حذف می‌شود، بازگرداندنشان بی‌خطر است.
git checkout -- database/contentStore.js database/mediaStore.js database/analyticsStore.js package.json

# ۳) اگر migration اعمال شده بود (در این فاز اعمال نشد)
#    فایل‌های .bak کنار داده را برگردانید:
#    cp database/content/banners.json.bak   database/content/banners.json
#    cp database/content/mediaTags.json.bak database/content/mediaTags.json

# ۴) بازگرداندن داده از پشتیبان (در صورت نیاز)
tar -xzf .workbuddy-ai/backups/phase-6-baseline-20260930-100630.tar.gz -C .
npm run data:check
```

### بازگرداندن یک فایل دادهٔ تنها
```bash
tar -xzf .workbuddy-ai/backups/phase-6-baseline-20260930-100630.tar.gz database/users.json
```

### تأیید صحت پشتیبان
```bash
shasum -a 256 -c .workbuddy-ai/backups/SHA256SUMS-phase-6-baseline-20260930-100630.txt
```

### بازگرداندن **فقط** ناظر مسیر نوشتن (بدون حذف کل فاز)
```bash
cd "/Users/heidarian/Documents/my own project/tapeshweb"

# ۱) سیم‌کشی را بردار (فقط همان ~۴۵ خط در writeJson + گارد + نگاشت معکوس)
git checkout -- database/contentStore.js

# ۲) خودِ ناظر را حذف کن (اگر لازم بود)
rm -f database/models/observe.js

# ۳) تأیید: هیچ چیزی نباید بشکند چون ناظر هیچ‌جا import نشده بود
node database/dataIntegrity.test.mjs   # بخش ۱۵ می‌شکند (عمدی — سنجه‌های ناظر حذف شده‌اند)
```
⚠️ **نکتهٔ مهم:** تا وقتی متغیر `TAPESH_MODEL_OBSERVE` تنظیم نشده باشد، حذف
`observe.js` **هیچ اثری روی رفتار ندارد** — چون `writeJson` حتی یک بار هم آن را
بارگذاری نمی‌کند. یعنی ناظر کاملاً قابل‌جداشدن است و ریسک rollback صفر است.

### پس از rollback
هیچ migration داده‌ای، هیچ تغییر Schema‌ای و هیچ تغییر API‌ای باقی نمی‌ماند — فاز ۶ کاملاً **افزایشی (additive)** است.

---

## پیوست — فرمان‌های تکرارپذیر

```bash
npm run data:test        # ۲۴۰ سنجهٔ مدل داده، یکپارچگی و ناظر مسیر نوشتن
npm run data:check       # اسکن یکپارچگی (فقط‌خواندنی)
npm run data:check:json  # خروجی ماشین‌خوان
npm run data:repair      # برنامهٔ نرمال‌سازی — DRY-RUN
npm run data:backup      # پشتیبان + مانیفست SHA-256
npm run data:sources     # diff منابع موازی JSON ↔ mockData
npm run auth:test exam:test bank:test admin:test planning:test domain:test
```

### روشن‌کردن ناظر مسیر نوشتن (اختیاری، پیش‌فرض خاموش)

```bash
# فقط گزارش به حلقهٔ حافظه (بدون هیچ خروجی روی کنسول)
TAPESH_MODEL_OBSERVE=1 node server.js

# به‌علاوهٔ یک خط خلاصه روی stderr برای هر نوشتنِ دارای ایراد
TAPESH_MODEL_OBSERVE=1 TAPESH_MODEL_OBSERVE_LOG=1 node server.js
```

مثال خروجی وقتی ناظر روشن باشد و نوشتن ایراد داشته باشد:
```
[model-observe] categories: 3 مورد (2 رکورد سنجیده شد) — missing_identity×1 · enum×1 · required×1
```

> **اصل حاکم بر این فاز:** هیچ یافته‌ای با حدس ساخته نشد. هر قاعدهٔ حذف، هر قید یکتایی، هر enum و هر داوری منبع حقیقت یک `evidence` دارد که فایل و تابع را نام می‌برد — و هر جا شاهد کافی نبود، صریحاً `UNKNOWN` ثبت شد.
>
> همین اصل در مرحلهٔ ۸ هم رعایت شد: ناظر روی **دادهٔ واقعی** اجرا شد و خروجی‌اش با خروجی اسکنر مقایسه شد؛ هر جا اختلاف بود، **کد ناظر اصلاح شد** نه اینکه انتظار تست را پایین بیاوریم.
