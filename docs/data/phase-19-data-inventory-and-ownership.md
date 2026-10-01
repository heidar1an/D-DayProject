# Phase 19.1 — Data Inventory، Ownership و Sensitivity

> **وضعیت سند:** `IMPLEMENTED` (سند تحلیلی، تولیدشده از اجرای واقعی ابزارهای مخزن)
> **تاریخ:** ۲۰۲۶-۱۰-۰۱ · **commit مبنا:** `a86d875` روی `main`
> **ابزارهای مولد شواهد:** `scripts/data-sources.mjs` · `scripts/data-integrity.mjs`
> · `scripts/data-integrity.mjs --json` · `scripts/client-contract-audit.mjs`
>
> **هشدار محدوده:** Phase 19 در `MASTER-AUDIT-2026-09-29.md` تعریف رسمی ندارد.
> این سند بخشی از scope **پیشنهادی** است، نه roadmap رسمی پروژه.

---

## ۱. خلاصهٔ کمی

| سنجه | مقدار | منبع |
|---|---|---|
| Entity با Schema رسمی | ۴۴ | `data:check` → «پوشش» |
| فایل دادهٔ اسکن‌شده | ۴۳ | همان |
| رکورد اسکن‌شده | ۱٬۵۴۱ | همان |
| قید یکتایی | ۱۴ | همان |
| ارتباط (relation) | ۴۰ | همان |
| حجم کل JSON داده | ۲٫۱۹MB | اندازه‌گیری مستقیم |
| خطای یکپارچگی | ۰ | `data:check` (exit 0) |
| هشدار یکپارچگی | ۲۲ | همان |
| مسیر API سرور | ۲۲۹ | `api:contract:check` |
| DTO | ۱۱ | همان |
| کد خطا | ۲۸ | همان |
| فایل اسکن‌شدهٔ کلاینت | ۴۲۵ | `api:client` |
| تماس واقعی کلاینت↔API | ۱۵ | همان |
| مسیر مستند اما پیاده‌نشده | ۱۲۲ | همان |
| تماس شکسته | ۰ | همان |

**System of record** در همهٔ دامنه‌های محتوایی `database/content/*.json` است و
مرجع شکل/اعتبار داده `database/models/` (خالص، بدون I/O). هیچ دیتابیس رابطه‌ای،
schema اجرایی، foreign key یا index واقعی وجود ندارد.

---

## ۲. Inventory به‌تفکیک دامنه

`SOR` = System of Record · `PUB` = در معرض مسیر عمومی

| # | دامنه | فایل/منبع | رکورد | حجم | SOR | نویسنده | خواننده | حساسیت | PUB |
|---|---|---|---|---|---|---|---|---|---|
| ۱ | کاربران | `database/users.json` | ۱ | ۶۸۷B | فایل (untracked) | `usersStore.js` | `usersApi.js` | **PII + هش رمز** | ✗ |
| ۲ | نشست‌ها | `database/users.sessions.json` | ۴۹ | ۱۶KB | فایل (untracked) | `usersStore.js` | `usersApi.js` | **توکن نشست** | ✗ |
| ۳ | مدیران | `database/content/admins.json` | ۱ | ۵۱۸B | فایل (**tracked**) | `contentStore.js` | `adminApi.js` | **هش رمز + ایمیل** | ✗ |
| ۴ | رویداد پنل | `database/content/activity.json` | ۵۰۰ | ۱۸۴KB | فایل (**tracked**) | `contentStore.js` | `adminApi.js` | **IP + User-Agent (PII)** | ✗ |
| ۵ | رویداد زمان‌اجرا | `database/content/events.json` | ۰ | ۲B | فایل (**tracked**) | `analyticsStore.js` | `analyticsStore.js` | کم (خالی) | ✗ |
| ۶ | تنظیمات | `database/content/settings.json` | ۱ | ۱٫۱KB | فایل (tracked) | `contentStore.js` | `adminApi.js` | متوسط | ✗ |
| ۷ | بانک سؤال | `database/content/testBankQuestions.json` | ۵۹ | ۱۶۰KB | فایل (tracked) | `contentStore.js` + seed | `adminApi.js` | **کلید پاسخ** | ✓ (DTO) |
| ۸ | پاسخ بانک | `database/content/testBankAnswers.json` | ۷ | ۱٫۱KB | فایل (tracked) | `contentStore.js` | `adminApi.js` | **کلید پاسخ** | ✗ |
| ۹ | پاداش قلب | `database/content/testBankHeartRewards.json` | ۴ | ۶۹۶B | فایل (tracked) | `contentStore.js` | `adminApi.js` | کم | ✗ |
| ۱۰ | آزمون‌های هماهنگ | `database/content/exams.json` | ۶ | ۱۵KB | فایل (**tracked**) | `examStore.js` | `examApi.js` | متوسط | ✓ |
| ۱۱ | سؤال آزمون | `database/content/examQuestions.json` | ۱۱۹ | ۱۲۱KB | فایل (**tracked**) | `examStore.js` | `examApi.js` | **کلید پاسخ** | ✗ |
| ۱۲ | تلاش/گزارش/حسابرسی آزمون | `examAttempts` · `examReports` · `examAudit` | ۰/۰/۱ | — | فایل (tracked) | `examStore.js` | `examApi.js` | متوسط | ✗ |
| ۱۳ | میکرودرس | `database/content/microCourses.json` | ۱۶ | ۸۳۰KB | فایل (tracked) | `contentStore.js` | `microContentService.js` | کم | ✓ |
| ۱۴ | دورهٔ جامع | `database/content/comprehensiveCourses.json` | ۱ | ۲۰۱KB | فایل (tracked) | `contentStore.js` | کلاینت | کم | ✓ |
| ۱۵ | دورهٔ بین‌الملل | `database/content/intlCourses.json` | ۷ | ۱۸KB | فایل (tracked) | `contentStore.js` | `intlCoursesService.js` | کم | ✓ |
| ۱۶ | ارائه‌دهندهٔ بین‌الملل | `database/content/intlProviders.json` | ۱۳ | ۹KB | فایل (tracked) | `contentStore.js` | همان | کم | ✓ |
| ۱۷ | فلش‌کارت | `database/content/flashcardDecks.json` | ۱۱ | ۵۵KB | فایل (tracked) | `contentStore.js` | `flashcardService.js` | کم | ✓ |
| ۱۸ | مقاله | `database/content/articles.json` | ۱۵ | ۶۱KB | فایل (tracked) | `contentStore.js` | `articlesService.js` | کم | ✓ |
| ۱۹ | صفحه | `database/content/pages.json` | ۱۵ | ۱۱KB | فایل (tracked) | `contentStore.js` | کلاینت | کم | ✓ |
| ۲۰ | دسته‌بندی | `database/content/categories.json` | ۱۰ | ۹۳۵B | فایل (tracked) | `contentStore.js` | کلاینت | کم | ✓ |
| ۲۱ | بنر | `database/content/banners.json` | ۱ | ۵۳۲B | فایل (tracked) | `contentStore.js` | کلاینت | کم | ✓ |
| ۲۲ | منبع مرجع | `database/content/references.json` | ۳ | ۱۴۶KB | فایل (tracked) | `contentStore.js` | `referencesApi.js` | کم | ✓ |
| ۲۳ | یادداشت | `database/content/notes.json` | ۱۱ | ۱۳KB | فایل (tracked) | `contentStore.js` | `notesService.js` | متوسط (کاربرمحور) | ✗ |
| ۲۴ | بازخورد | `database/content/feedback.json` | ۱ | ۶۸۱B | فایل (untracked) | `feedbackStore.js` | `adminApi.js` | PII سبک | ✗ |
| ۲۵ | هشدار تحلیلی | `database/content/alerts.json` | ۵ | ۱٫۹KB | فایل (tracked) | `analyticsStore.js` | `adminApi.js` | کم | ✗ |
| ۲۶ | دارایی رسانه | `database/content/media.json` | ۲۴ | ۹KB | فایل (tracked) | `mediaStore.js` | `mediaStore.js` | کم | ✗ |
| ۲۷ | حساب رسانه | `database/content/mediaAccounts.json` | ۶ | ۵٫۴KB | فایل (tracked) | `mediaStore.js` | `mediaStore.js` | متوسط | ✗ |
| ۲۸ | متریک رسانه | `database/content/mediaMetrics.json` | ۵۴۰ | ۲۹۴KB | فایل (**tracked**) | `mediaStore.js` | `analyticsStore.js` | کم (زمان‌اجرا) | ✗ |
| ۲۹ | محتوای رسانه | `database/content/mediaContents.json` | ۲۴ | ۴۰KB | فایل (tracked) | `mediaStore.js` | `mediaStore.js` | کم | ✗ |
| ۳۰ | کمپین/UTM/منشن/تگ/تیم/اعلان/اینباکس/پلتفرم | `media{Campaigns,Utm,Mentions,Tags,Team,Notifications,Inbox,Platforms}.json` | ۷/۴/۸/۱۵/۶/۷/۱۰/۴ | ۲۱KB | فایل (tracked) | `mediaStore.js` | `mediaStore.js` | کم | ✗ |
| ۳۱ | کانال انتشار | `database/content/publishChannels.json` | ۳ | ۱٫۶KB | فایل (tracked) | `publishingStore.js` | `publishingStore.js` | متوسط | ✗ |
| ۳۲ | لاگ انتشار | `database/content/publishLog.json` | ۲۲ | ۲۲KB | فایل (**tracked**) | `publishingStore.js` | `adminApi.js` | **پیش‌نمایش محتوا** | ✗ |
| ۳۳ | سرّ انتشار | `database/publishing.secrets.json` | ۱ | ۲۴۵B | فایل (untracked، `0600`) | `publishingStore.js` | publisherها | **توکن ربات** | ✗ |
| ۳۴ | ویکی | `src/services/wiki/mockData.js` | ۴۶۶ | **۲٫۱۶MB** | **کلاینت (بدون بک‌اند)** | کلاینت | `wikiService.js` | کم | ✓ |
| ۳۵ | دانش | `tapesh:knowledge:v1` (localStorage) | — | — | **کلاینت** | کلاینت | `knowledgeService.js` | کم | ✗ |
| ۳۶ | لیگ | `src/services/league/mockData.js` | بستهٔ دمو | — | **کلاینت** | کلاینت | `leagueService.js` | کم | ✓ |
| ۳۷ | AI | `src/services/ai/mockAI.js` | — | — | **کلاینت (شبیه‌ساز)** | کلاینت | `aiService.js` | کم | ✓ |
| ۳۸ | فلش‌کارت کلاینت | `tapesh:flashcards:v1` | — | — | **کلاینت** | کلاینت | `flashcardService.js` | کم | ✗ |
| ۳۹ | قلب | `tapesh:hearts:v1` | — | — | **کلاینت** | کلاینت | `testBankService.js` | کم | ✗ |
| ۴۰ | یادداشت کلاینت | `tapesh:notes:v2` | — | — | **کلاینت** | کلاینت | `notesService.js` | متوسط | ✗ |
| ۴۱ | درخواست پشتیبانی | `tapesh:support-requests` | — | — | **کلاینت** | کلاینت | پنل پشتیبانی | PII سبک | ✗ |
| ۴۲ | خواننده | `tapesh:reader` | — | — | **کلاینت** | کلاینت | `referencesApi.js` | کم | ✗ |
| ۴۳ | نشان تغییر بانک | `tapesh:testbank:changed` | — | — | **کلاینت** | کلاینت | `testBankService.js` | کم | ✗ |

---

## ۳. Ownership Matrix (مالکیت ماژول)

| دامنه | owner module | migration path | retention | deletion policy | منبع حقیقت در تعارض |
|---|---|---|---|---|---|
| کاربران/نشست | `database/usersStore.js` | ندارد (فایل) | نامحدود | دستی | سرور |
| محتوای پنل | `database/contentStore.js` | ندارد (فایل) | نامحدود | دستی | سرور |
| آزمون | `database/examStore.js` | ندارد (فایل) | نامحدود | دستی | سرور |
| رسانه | `database/mediaStore.js` | ندارد (فایل) | نامحدود | دستی | سرور |
| انتشار | `database/publishingStore.js` | ندارد (فایل) | نامحدود | دستی | سرور |
| تحلیل/رویداد | `database/analyticsStore.js` | ندارد (فایل) | نامحدود (بدون چرخش) | دستی | سرور |
| ویکی | `src/services/wiki/` | **ندارد** | نامحدود | — | کلاینت |
| لیگ | `src/services/league/` | **ندارد** | نامحدود | — | کلاینت |
| AI | `src/services/ai/` | **ندارد** | نامحدود | — | کلاینت (شبیه‌ساز) |

**نتیجهٔ مالکیت:** `contentStore.js` مالک ۲۸ دامنه از ۴۳ فایل است و تنها نقطهٔ
تمرکز نوشتن محسوب می‌شود (ریسک معماری ثبت‌شدهٔ ممیزی).

---

## ۴. Dependency Map و منابع تکراری

`scripts/data-sources.mjs` ده دامنه را داوری می‌کند و **۰ مورد `UNKNOWN`** می‌دهد:

| دامنه | منابع هم‌پوشان | حکم |
|---|---|---|
| میکرودرس | JSON سرور (۱۶) + `src/data/micro/registry.js` (۱۶) | سرور برای رکورد **منتشرشده** canonical؛ رجیستری برای منتشرنشده |
| بانک تست | JSON سرور (۵۹) + `src/services/testBank/mockData.js` (۵۹) | سرور canonical؛ mock فقط seed و fallback پیش از hydration |
| ویکی | تنها `src/services/wiki/mockData.js` (۴۶۶) | **کلاینت تنها منبع — بدون بک‌اند** |
| فلش‌کارت | JSON سرور (۱۱) + `mockData.js` (۱۰ دک + ۶۰ کارت) | سرور canonical؛ ثابت‌ها fallback آفلاین («جای، نه کنار») |
| بین‌الملل | JSON سرور (۷+۱۳) + `intlCatalog.js` (۶+۱۳) + `mockData.js` (۵) | سرور canonical؛ فهرست منتشرشدهٔ غیرخالی جای کاتالوگ را می‌گیرد |
| یادداشت | JSON سرور (۱۱) + `notes/mockData.js` (فقط ثابت UI) | هم‌پوشانی رکوردی **ندارد** |
| منابع مرجع | JSON سرور (۳) + `referenceCatalog.js` (۳) | هم‌پوشانی رکوردی ندارد (ادعای ممیزی دربارهٔ `references/mockData.js` **نادرست** بود؛ چنین فایلی وجود ندارد) |
| لیگ | تنها `league/mockData.js` | **کلاینت تنها منبع** |
| تحلیل | JSON سرور (`alerts.json` ۵) | سرور canonical؛ `analytics/mockData.js` **کد مرده** است |
| مقالات | JSON سرور (۱۵) + `articleCatalog.js` (۱۲) + `mockData.js` (۱۲) | سرور canonical؛ mock فقط seed/fallback |

**منابع تکراری (duplicated sources):** ۶ دامنه الگوی «JSON سرور + کاتالوگ ایستای
کلاینت» دارند. در همه، سرور در تعارض برنده است و کلاینت با قرارداد صریح
«جای، نه کنار» ادغام می‌کند — پس تکرار، **دادهٔ رقیب** نیست، بلکه seed/fallback است.

---

## ۵. Sensitivity Classification

| رده | دامنه‌ها | ریسک |
|---|---|---|
| **بحرانی** | `users.json` (هش رمز) · `admins.json` (هش رمز، **tracked**) · `publishing.secrets.json` (توکن) · `testBankAnswers/Questions` + `examQuestions` (کلید پاسخ) | افشا = نقض احراز هویت / تقلب |
| **PII** | `activity.json` (IP + UA، **tracked**) · `users.sessions.json` (توکن) · `feedback.json` · `notes.json` | افشا = نقض حریم خصوصی |
| **متوسط** | `settings.json` · `publishLog.json` (پیش‌نمایش محتوا) · `mediaAccounts.json` · `publishChannels.json` | اطلاعات عملیاتی |
| **کم** | بقیهٔ محتوای عمومی | — |

**گارد نشت در DTO:** `explanation` / `correctAnswer` / `answerKey` فقط در DTO
بانک تست ممنوع‌اند (گارد **بافت‌محور**، نه سراسری). `api:contract:check` = ۰ نقض.

---

## ۶. فیلدهای Client-Authoritative

دامنه‌هایی که کلاینت مالک حالت است و سرور در آن‌ها حرف اول را نمی‌زند:

| کلید | مصرف‌کننده | ملاحظه |
|---|---|---|
| `tapesh:wiki:v1` | `wikiService.js` | ۴۶۶ رکورد ویکی در localStorage |
| `tapesh:knowledge:v1` | `knowledgeService.js` | گراف دانش |
| `tapesh:reader` | `referencesApi.js` | وضعیت خواننده |
| `tapesh:flashcards:v1` | `flashcardService.js` | دک/کارت محلی |
| `tapesh:hearts:v1` | `testBankService.js` | **امتیاز/جان کلاینت‌محور** |
| `tapesh:notes:v2` | `notesService.js` | یادداشت محلی |
| `tapesh:support-requests` | پنل پشتیبانی | درخواست‌های مهمان |
| `tapesh:testbank:changed` | `testBankService.js` | نشان نسخه |

**هیچ‌کدام نسخه ندارند** و مهاجرت انبوه ممنوع است. `tapesh:hearts:v1` به‌تنهایی
یک حالت **پاداش‌محور client-authoritative** است؛ سرور آن را تأیید نمی‌کند.

---

## ۷. دامنه‌های Mock-Only (بدون بک‌اند)

| دامنه | فایل | اندازه | وضعیت |
|---|---|---|---|
| ویکی | `src/services/wiki/mockData.js` | ۲٫۱۶MB · ۴۶۶ رکورد | **بدون بک‌اند — `NOT production-ready`** |
| لیگ | `src/services/league/mockData.js` | بستهٔ دمو (۲۴ export) | **بدون بک‌اند** |
| AI | `src/services/ai/mockAI.js` | شبیه‌ساز | **بدون اتصال واقعی** |

**کد مردهٔ تأییدشده:** `src/services/analytics/mockData.js` → تنها export آن
`generateMockHistory` است و در `src/`، `server.js` و `database/` **هیچ مصرف‌کننده‌ای ندارد**.

---

## ۸. روابط Orphan-Capable

`data:check` دو رابطهٔ هشداردهنده و ۳۸ رابطهٔ سالم گزارش می‌کند:

| رابطه | یتیم | نوع | اثر |
|---|---|---|---|
| `activity.userId → admins.id` | ۱۸ | ارجاع نرم تاریخی | رکورد رویداد به مدیر حذف‌شده اشاره می‌کند |
| `publishLog.channelId → publishChannels.id` | ۲ | ارجاع نرم | لاگ انتشار به کانال حذف‌شده اشاره می‌کند |

**ریسک بازماندهٔ ثبت‌شده:** سه رابطهٔ `FREE` (`mediaMentions.keywordId` ·
`mediaUtm.contentId`/`campaignId` · `mediaMetrics.accountId`) که امکان یتیم‌شدن
بدون هشدار دارند.

### ۸.۱ یتیمیِ **سنجیده‌نشده** — `session.userId` (اندازه‌گیری ۰۱ مهر، پایان جلسه)

| سنجه | مقدار |
|---|---|
| فایل | `database/users.sessions.json` — ۱۹٬۲۵۴B |
| شکل ذخیره | نگاشت `{ sessions: { <token>: {…} } }` (کلید = توکن، `keyIsIdentity`) |
| تعداد نشست | **۵۵** |
| نشستِ **یتیم** (`userId` در `users.json` نیست) | **۵۳** |
| کاربران موجود | **۱** (`7ee46a00-…`) |
| گزارش اسکنر | `PASS` · خطا=۰ · **هشدار=۰** |

⇒ در `database/models/` **هیچ رابطهٔ `session → user` تعریف نشده** است، پس این
کلاس از آلودگی از دروازهٔ یکپارچگی **رد می‌شود** (برخلاف `activity.userId` و
`publishLog.channelId` که رابطهٔ `SOFT` دارند و هشدار می‌دهند). منشأ یتیمی:
کاربرانی که تست‌ها می‌سازند و بعد حذف می‌کنند، ولی نشست‌شان می‌ماند.
**اقدام پیشنهادی:** افزودن رابطهٔ `SOFT` برای `session.userId → user.id` و سپس
هرسِ یتیم‌ها (هرس = تغییر داده ⇒ نیازمند تأیید).

**نکتهٔ مهم:** هیچ‌کدام از این‌ها **خطا** نیستند. `data:check` با `خطا=۰` و
`exit=0` تمام می‌شود؛ تنها ابزار **خروجی غیرصفر** وقتی هشدار وجود دارد،
`verify:all` است (که آن هم `data:check` را با کد ۱ گزارش می‌کند چون گام‌های
دیگر را هم می‌سنجد).

---

## ۹. سیاست نگهداری و حذف

- **Retention:** هیچ دامنه‌ای چرخش/انقضا ندارد. `activity.json` سقف سخت **۵۰۰
  رکورد** دارد (ring buffer؛ در آزمون این جلسه تأیید شد: افزودن ۴۲ رکورد،
  ۴۲ رکورد قدیمی را بیرون انداخت).
- **Deletion policy:** حذف فقط دستی از پنل. هیچ مسیر «حذف گزارش رویداد» یا
  «حذف سابقه» وجود ندارد و تست امنیتی `adminSecrets.test.mjs` این را
  به‌عنوان سنجهٔ مثبت تأیید می‌کند.
- **Backup:** `data:backup` → `.workbuddy-ai/backups/*.tar.gz` + `SHA256SUMS`.
  **زمان‌بندی خودکار ندارد.**
- **Restore:** `data:restore` پیش‌فرض **dry-run**؛ `--apply` عکس امنیتی
  `pre-restore-<stamp>` می‌سازد. زنجیرهٔ کامل با `backup:restore:test` روی
  ریشهٔ **موقت** اثبات شده است (۱۲ سنجه).

---

## ۱۰. شکاف‌های باقی‌مانده

| # | شکاف | وضعیت |
|---|---|---|
| ۱ | `database/persistence/` وجود ندارد؛ abstraction از implementation جدا نیست | `NOT FOUND` |
| ۲ | هیچ migration نسخه‌دار، dry-run یا rollback وجود ندارد (فقط `data:repair`) | `NOT FOUND` |
| ۳ | PostgreSQL/دیتابیس واقعی در scope محیط نیست | `BLOCKED BY ENVIRONMENT` |
| ۴ | ویکی/لیگ/AI بک‌اند ندارند | `IMPLEMENTED BUT UNVERIFIED` |
| ۵ | ۱۲۲ مسیر API مستند شده اما پیاده نشده | `IMPLEMENTED BUT UNVERIFIED` |
| ۶ | `assertInputValid` فقط روی ۲ مسیر از ۱۱۷ مسیر اعمال می‌شود | `PARTIALLY VERIFIED` |
| ۷ | `activity.json` و `admins.json` و `events.json` در گیت tracked مانده‌اند | `IMPLEMENTED` (سیاست نوشته شد، خارج‌کردن نیازمند تأیید) |
| ۸ | حجم ویکی (۲٫۱۶MB) در باندل تولیدی می‌نشیند | `VERIFIED` (باندل ۱٫۸۵MB `mockData-*`) |
