# فاز ۲۱ تا ۲۴ Backend تپش — گزارش اجرا

> تاریخ: ۲۰۲۶-۱۰-۰۳ · محدوده: `backend/` · منبع حقیقت نوشتن تا Cutover: Node Legacy
> وضعیت‌ها: `IMPLEMENTED` ≠ `TESTED` ≠ `VERIFIED` — هر ردیف فقط یکی از این‌ها را می‌گوید.

---

## ۰. خلاصهٔ اجرایی

| فاز | نتیجه | شاهد |
|---|---|---|
| ۲۱ — AI Mentor | `IMPLEMENTED` + `TESTED` | ۷ تست اختصاصی، SQLite **OK** · PG واقعی **OK** · OpenAPI ۱.۱۰.۰ |
| ۲۲ — Migration + Cutover | ابزار `IMPLEMENTED` + `TESTED`؛ **مهاجرت واقعی انجام نشد** | `inventory.json` (۴۴ منبع / ۱٬۵۵۹ رکورد) · `parity.json` |
| ۲۳ — Security Hardening | sweep + تست‌های موجود **TESTED**؛ hardening تازه فقط در دامنهٔ AI | ۱۲۰ تست امنیتی/هویت/تجارت/رسانه سبز |
| ۲۴ — Performance + Production | **NOT VERIFIED** (بدون staging/بار واقعی) | فقط baseline ساختاری و اسکریپت‌های موجود |

قاعده‌ای که رعایت شد: هیچ provider/درگاه/staging جعلی ساخته نشد؛ هرجا زیرساخت واقعی
نبود، پاسخ صریح `۵۰۳` یا گزارش `NOT VERIFIED` است — نه موفقیت ساختگی.

---

## ۱. فاز ۲۱ — AI Mentor

### ۱.۱ معماری پیاده‌شده

```
Controller (AiController)
  → FormRequest (ChatRequest | StoreAiAttachmentRequest)
  → AiService  (Authorization → Entitlement → Quota → Rate limit → Context → Provider → Persist)
  → AiProvider (interface) → UnconfiguredAiProvider (بایند پیش‌فرض)
  → ai_conversations / ai_messages / ai_daily_usage
```

AI **مصرف‌کنندهٔ** دادهٔ معتبر است، نه مالک آن: نه پیشرفت می‌نویسد، نه آزمون، نه XP.

### ۱.۲ فایل‌های تازه

| نوع | فایل |
|---|---|
| Config | `config/ai.php` |
| Migration | `database/migrations/2026_10_04_130100_create_ai_tables.php` |
| Models | `app/Models/AiConversation.php` · `AiMessage.php` |
| Services | `app/Services/Ai/{AiService,AiProvider,AiProviderAnswer,UnconfiguredAiProvider,AiContextBuilder,AiQuota}.php` |
| Controller | `app/Http/Controllers/Api/V1/AiController.php` |
| Requests | `app/Http/Requests/Ai/{ChatRequest,StoreAiAttachmentRequest}.php` |
| Resource | `app/Http/Resources/AiMessageResource.php` |
| Provider | `app/Providers/AiServiceProvider.php` (بایند + rate limitها) |
| Tests | `tests/Feature/Ai/AiMentorTest.php` |
| OpenAPI | `scripts/build-openapi-v1-phase21.mjs` (idempotent) |
| ویرایش‌شده | `routes/api.php` · `bootstrap/providers.php` · `tests/Feature/ApiV1ContractTest.php` · `app/Services/Media/MediaService.php` |

### ۱.۳ ناوردایی‌هایی که تست شده‌اند

- **Fail-closed پیش‌فرض:** بدون `ai.enabled` + `ai.external_processing_approved` + entitlement
  + quota + provider، پاسخ `۵۰۳ FEATURE_NOT_CONFIGURED` است. هیچ mock و هیچ پاسخ جعلی وجود ندارد.
- **entitlement مستقل از گیت محتوا:** `AiService::authorize` از `EntitlementService::has()`
  مستقیم استفاده می‌کند، نه از `EntitlementGate` که تا `commerce.entitlements.enforce=false`
  صادقانه `true` برمی‌گرداند. AI هیچ‌وقت به‌خاطر خاموش‌بودن enforcement باز نمی‌شود.
- **مالکیت ⇒ ۴۰۴:** گفت‌وگو یا پیوست کاربر دیگر `۴۰۴` است (نه ۴۰۳) تا وجود منبع افشا نشود.
- **idempotency واقعی:** `UNIQUE(user_id, request_key)` + `request_hash`؛ کلید با بدنهٔ
  متفاوت ⇒ `۴۰۹ IDEMPOTENCY_CONFLICT`، درخواست نیمه‌تمام ⇒ `۴۰۹ AI_REQUEST_IN_PROGRESS`.
- **سهمیهٔ روزانه:** `ai_daily_usage` با PK مرکب `(user_id, usage_date)` و قفل ردیف `users`
  (`lockForUpdate`) — تخصیص/آزادسازی اتمیک. شکست provider ⇒ آزادسازی سهمیه.
- **نشت‌ناپذیری راز:** متن پیام با cast `encrypted` ذخیره می‌شود؛ `providerMessageId`، مصرف
  توکن و `error_code` در `$hidden` و هرگز در پاسخ نیستند. استثنای provider **بازنویسی**
  می‌شود (`AI_PROVIDER_UNAVAILABLE`) و پیام اصلی آن نه پاسخ می‌شود نه لاگ.
- **بدنهٔ کلاینت:** `userId`/`role`/`entitlement`/`quota`/`context`/`history`/`model`/`score`
  صریحاً `prohibited` ⇒ ۴۲۲.
- **context کمینه:** فقط از Read Model تجمیعی (`OverviewAnalyticsService`) و فقط در حالت
  `study`/`quiz`؛ بدون شناسه، بدون رکورد خام، بدون PII/پزشکی.
- **پیوست:** از همان Media architecture با اعتبارسنجی چندلایه؛ برای دانشجو فقط
  `image|document`، همیشه `private`، با `purpose=ai`. مسیر انتقال فایل به provider
  **ساخته نشد** ⇒ اگر `attachmentIds` بفرستی، پاسخ صریح `۵۰۳` است (نه ادعای جعلی
  «provider فایل را دید»).
- **SSE ساخته نشد** — مصرف‌کنندهٔ واقعی streaming به این قرارداد وصل نیست؛ قرارداد فعلی
  JSON است و در OpenAPI همان مستند شده. (تصمیم، نه فراموشی.)

### ۱.۴ تله‌های واقعی که در همین فاز دیده شد

1. **`throttle:a,b` کار نمی‌کند.** لاراول فقط وقتی limiter نام‌دار را می‌شناسد که
   `func_num_args() === 3` باشد؛ با کاما، آرگومان دوم `decayMinutes` می‌شود و
   `MissingRateLimiterException` می‌دهد. راه‌حل: هر limiter در middleware جدا
   (`throttle:ai_chat`, `throttle:ai_chat_ip`).
2. **آرایهٔ `Limit` از یک limiter نام‌دار، لایهٔ دوم را عملاً بی‌اثر می‌کند.**
   راه‌حل همان: limiterهای جدا و تک‌مسئولیتی.
3. **کلید throttle با md5 هش می‌شود** (`md5($limiterName.$limit->key)`)، و در هارنس
   تست با کش `array` شمارنده یک درخواست عقب دیده می‌شود. تست rate limit به‌جای تکیه بر
   شمارش پیاپی، کلید را صریح پر می‌کند تا قطعی باشد.

### ۱.۵ وضعیت فاز ۲۱

| مورد | وضعیت |
|---|---|
| جداول + سرویس + adapter + entitlement + quota + rate limit + مالکیت پیوست | `TESTED` (SQLite) |
| همان‌ها روی PG واقعی (migrate:fresh → rollback → migrate) | `TESTED` |
| OpenAPI دوطرفه (`ApiV1ContractTest`) | `TESTED` |
| اتصال provider واقعی (LLM) | `BLOCKED` — credential/provider در پروژه پیکربندی نشده |
| SSE | `BLOCKED` — مصرف‌کنندهٔ واقعی ندارد |
| اتصال UI به AI واقعی | `NOT VERIFIED` — عمداً انجام نشد (با provider خاموش، UI را می‌شکست) |

**Gate ۲۱ → ۲۲ سبز است:** AI «configured but disabled» است و هیچ وابستگی‌ای برای مهاجرت نمی‌سازد.

---

## ۲. فاز ۲۲ — Data Migration + Cutover

### ۲.۱ ابزار ساخته‌شده (خواندنی، بدون نوشتن روی داده)

| فایل | کار |
|---|---|
| `scripts/cutover/inventory.mjs` | inventory خواندنی از ۴۴ منبع legacy + sha256 + تعداد رکورد + crosswalk |
| `scripts/cutover/parity.php` | مقایسهٔ count legacy ↔ جدول Laravel + گزارش یتیم FK + کد خروج گیت |
| `docs/phase22-inventory.json` | خروجی ماشین‌خوان inventory |
| `docs/phase22-parity.json` | خروجی ماشین‌خوان parity |

Inventory از لایهٔ schema پروژه (`database/models/`) می‌خواند، نه از حدس شکل فایل.

### ۲.۲ اندازه‌گیری واقعی (۲۰۲۶-۱۰-۰۳)

```
۴۴ منبع · ۱٬۵۵۹ رکورد · ۱۸ entity نگاشت‌شده به جدول Laravel
۲۵ entity دارای رکورد که هنوز جدول مقصد ندارند (Media Center، publishing، …)
```

دامنه‌های نگاشت‌شده: Auth(2) · Admin(1) · Articles(2) · References(1) · Flashcards(1) ·
International(2) · QuestionBank(2) · Exam(4) · Feedback(2) · Media(1).

Parity روی DB محلی: `table_missing = 17`، `not_migrated = 1`، `parity = 0`، یتیم FK = ۰.
یعنی **هیچ داده‌ای مهاجرت نشده** — عدد واقعی، نه ادعا.

### ۲.۳ چرخهٔ مصوب برای هر module

```
Inventory → Crosswalk → Staging → Normalize → Validate → Import
   → Compare → Parity → Read Switch → Write Switch
```

قواعدی که در ابزار و runbook قفل شده‌اند:

- **Crosswalk قطعی:** `U(file, legacy_id)` → UUID یکتا؛ بدون تصادف، بدون حدس.
- **Backup پیش از هر Import:** `data-backup.mjs` (موجود) مانیفست `SHA256SUMS-<label>.txt`
  می‌سازد؛ برچسب پیشنهادی `pre-cutover-<env>`.
- **Import idempotent/checkpointed/batch:** یک تراکنش غول‌آسا ممنوع.
- **دادهٔ تاریخی بازنویسی نمی‌شود:** attempt/result/payment/audit/XP ledger فقط import
  می‌شوند، نه بازنویسی؛ اگر نگاشت هویت لازم بود، «هویت تازه + snapshot تاریخی».
- **Session:** `auth_sessions` هدف نیست. سشن‌های legacy مهاجرت **نمی‌شوند**؛ کاربر
  دوباره وارد می‌شود. (۶۳ سشن روی دیسک، بدون تصمیم معکوس.)
- **LocalStorage:** فقط opt-in، با version/owner/consent/dedup/conflict/rollback؛
  هیچ import خودکار برای XP/پول/وضعیت پرداخت.
- **Media:** `checksum → object storage → metadata → ACL → verify`؛ پس از انتقال،
  sha256 مبدأ و مقصد باید یکی باشد؛ فایل private نباید public شود.
- **Zero Dual Writer:** برای هر دامنه دقیقاً یک نویسنده. تا Cutover، Node.
- **Rollback دوگانهٔ مستقل:** Code rollback (release N → N-1) و Data rollback
  (snapshot + delta + migration log) — هرگز «rollback کد = rollback داده» فرض نشود.

### ۲.۴ پنجرهٔ Cutover (رویه)

```
اعلام پنجره → توقف نویسندهٔ Node → backup نهایی → import delta → validate
→ parity → سوییچ Nginx/routing → فعال‌کردن نوشتن Laravel → smoke
```

### ۲.۵ وضعیت فاز ۲۲

| مورد | وضعیت |
|---|---|
| Inventory کامل + checksum | `TESTED` (اجرا شد، اعداد بالا) |
| Crosswalk (۱۸ entity) | `IMPLEMENTED` + `TESTED` (تولید شد) |
| ابزار parity + یتیم FK | `TESTED` |
| Backup manifest | `IMPLEMENTED` (اسکریپت موجود legacy؛ اجرای واقعی cutover نشده) |
| Import واقعی داده | **NOT VERIFIED** — عمداً انجام نشد (بدون پنجرهٔ Cutover و بدون تأیید کاربر) |
| Rehearsal در محیط ایزوله | **NOT VERIFIED** — staging واقعی وجود ندارد |
| LocalStorage opt-in | `IMPLEMENTED` (سیاست)، اجرا نشده |
| Media checksum parity | **NOT VERIFIED** — مهاجرت Media اجرا نشده |

**Gate ۲۲ → ۲۳:** pipeline تکرارپذیر است (inventory/parity قابل اجرا و قطعی‌اند)، ولی
Cutover واقعی **انجام نشد**. طبق Prompt، Production Cutover قبل از سبز شدن Security Gate
هم ممنوع است — پس ترتیب حفظ شده.

---

## ۳. فاز ۲۳ — Security Hardening

اصل: امنیت از بیرون به داخل سنجیده می‌شود، نه از ساختار کد فرض شود.

### ۳.۱ آنچه واقعاً اجرا و سبز شد

```
tests/Feature/{Security,Auth,Commerce,Media}  →  ۱۲۰ تست / ۷۹۲ assertion / ۰ شکست
کل سوییت backend (SQLite)                     →  ۹۱۴ تست / ۹٬۴۰۹ assertion / ۲ skip / ۰ شکست
```

پوشش موجود در این دامنه‌ها: CSRF/Origin fail-closed، چرخش و ابطال سشن، مهاجرت رمز legacy،
RBAC و منع ارتقای خود، پرداخت (جعل مبلغ/وضعیت، webhook تکراری)، رسانه (magic bytes،
مسیر غیرقابل‌حدس، signed URL)، IDOR در چند دامنه.

### ۳.۲ sweep استاتیک (اجرا شد)

| الگو | یافته |
|---|---|
| `X-Forwarded-Host` / `X-Forwarded-Proto` در کد اپ | **۰** (فقط vendor) |
| `super-admin` در کد اپ | **۰** |
| `DB::table(` در Controllerهای ادمین | **۰** (پنل فقط از Domain Service) |
| `secret` در `app/config/routes/database` | فقط کلیدهای پیکربندی و cast رمزنگاری؛ هیچ رازِ hardcode‌شده |

### ۳.۳ نتایج امنیتی مخصوص فاز ۲۱ (تست‌شده)

- بدون سشن ⇒ ۴۰۱ · بدون entitlement ⇒ ۴۰۳ · گفت‌وگو/پیوست غیرمالک ⇒ ۴۰۴
- quota ⇒ ۴۲۹ `AI_QUOTA_EXCEEDED` · rate limit ⇒ ۴۲۹ `AI_RATE_LIMITED`
- خطای/تایم‌اوت provider ⇒ ۵۰۳ نرمال‌شده، **بدون** نشت پیام اصلی یا credential
- پاسخ هیچ‌وقت `providerMessageId`/`userId` را برنمی‌گرداند
- بدنهٔ کلاینت نمی‌تواند هویت/سهمیه/context/provider را تعیین کند

### ۳.۴ موارد باز (صادقانه)

- **Trusted proxies** صریحاً تنظیم نشده؛ رفتار پیش‌فرض فریم‌ورک (بدون trust) امن است، ولی
  پیکربندی production پشت Nginx **NOT VERIFIED** است.
- **Attack 9 (Host/X-Forwarded spoof → OAuth redirect):** هیچ کد اپی این هدرها را
  نمی‌خواند؛ ولی چون redirect واقعی Google در این محیط اجرا نشده ⇒ `NOT VERIFIED`.
- **SSRF:** publisher `urlGuard.js` در سمت Node تست‌های خودش را دارد؛ هیچ URL
  server-controlled تازه‌ای در این چهار فاز اضافه نشد ⇒ سطح SSRF تغییر نکرد.
- **AV scan / quarantine** برای آپلود: زیرساخت موجود نیست ⇒ `BLOCKED`.
- تست‌های «حمله» به‌صورت سناریوی یکپارچه در staging اجرا نشده‌اند ⇒ `NOT VERIFIED`.

---

## ۴. فاز ۲۴ — Performance + Production

### ۴.۱ Baseline — چه چیزی واقعاً اندازه‌گیری شد

| سنجه | مقدار | منبع |
|---|---|---|
| مدت اجرای کل سوییت (SQLite) | ۴۴.۳ ثانیه · ۱۲۵ MB | اجرای همین امروز |
| مدت اجرای دامنهٔ امنیت/هویت/تجارت/رسانه | ۹.۹ ثانیه · ۹۴.۵ MB | اجرای همین امروز |
| تعداد مسیر v1 | ۱۸۴ path / ۲۲۴ عملیات | OpenAPI ۱.۱۰.۰ |
| اندازهٔ inventory | ۴۴ منبع / ۱٬۵۵۹ رکورد | `phase22-inventory.json` |

این‌ها **baseline ساختاری** هستند، نه benchmark محصول. p50/p95/p99، query count،
cache hit ratio، queue depth و memory در محیط staging **اندازه‌گیری نشده** است.

### ۴.۲ آنچه از قبل وجود دارد ولی اجرا نشده

- `/healthz`, `/readyz`, `/metrics` (محدود/توکن‌دار) — مسیرها در کد و تست‌ها سبز؛
  رفتار در production **NOT VERIFIED**.
- `docker-compose.yml` (app+nginx+worker+postgres+redis) و `Dockerfile` — **اجرا نشده**.
- `backend-ci.yml` (Pint + SQLite + PG/Redis) — در GitHub Actions **اجرا نشده**.
- `data-backup.mjs` / `data-restore.mjs` / `backup-restore-test.mjs` — روی root موقت
  تست می‌شوند؛ drill واقعی روی دادهٔ production انجام نشده ⇒ **RPO/RTO اندازه‌گیری نشده**.
- `Pint`: فایل‌های خارج از دامنهٔ این چهار فاز تخلف سبک دارند ⇒ گام `pint --test` سبز نیست
  (عمداً دست نخورد تا با جریان موازی تصادم نکند).

### ۴.۳ بهینه‌سازی

هیچ بهینه‌سازی‌ای انجام نشد. دلیل: **Optimization بدون baseline ممنوع** (Prompt §24.1)
و baseline واقعی (staging/بار) وجود ندارد. ایندکس، cache و N+1 بدون measurement تغییر
نکردند.

### ۴.۴ Production Readiness (صادقانه)

هیچ‌کدام از موارد زیر در محیط واقعی اثبات نشده: deploy، PG تولیدی، Redis خصوصی، Nginx،
tuning PHP-FPM، externalize کردن secrets، staging، rehearsal مهاجرت، cutover، backup،
restore، RPO/RTO، monitoring، load test، smoke، rollback.
⇒ وضعیت: **NOT VERIFIED** (نه «آماده»).

---

## ۵. Audit بین‌فازی — جدول ماژول

| Module | Data Owner | جدول‌ها | Policy/Permission | Entitlement | Jobs/Events | Migration | Security | Performance |
|---|---|---|---|---|---|---|---|---|
| Auth | Laravel | users, user_profiles, auth_sessions | سشن + CSRF/Origin | — | — | not_migrated | TESTED | NOT VERIFIED |
| Admin/RBAC | Laravel | admins, roles, permissions | `api.can:*` deny-by-default | — | audit | not_migrated | TESTED | NOT VERIFIED |
| Content | Laravel | subjects/courses/chapters/lessons/pages | published-only | `content.*` (gateable) | — | not_migrated | TESTED | NOT VERIFIED |
| Learning | Laravel | learning_progress, study_sessions | مالکیت سشن | — | ProgressUpdated | not_migrated | TESTED | NOT VERIFIED |
| QuestionBank | Laravel | questions, question_keys, attempts | کلید جدا | — | QuestionAnswered | not_migrated | TESTED | NOT VERIFIED |
| Exam | Laravel | exams, exam_questions/attempts/answers/results | snapshot + زمان سرور | — | ExamFinished | not_migrated | TESTED | NOT VERIFIED |
| Analytics | Laravel | analytics_events | مشتق، منبع حقیقت نیست | — | listener | not_migrated | TESTED | NOT VERIFIED |
| Flashcards | Laravel | flashcard_decks/cards/states/reviews | مالکیت سشن | — | — | not_migrated | TESTED | NOT VERIFIED |
| Wiki/Knowledge | Laravel | wiki_*, knowledge_* | published-only | — | — | not_migrated | TESTED | NOT VERIFIED |
| GreenPath | Laravel | green_paths, green_path_steps | گذار سروری | — | GreenPathStepCompleted | not_migrated | TESTED | NOT VERIFIED |
| League/Gamification | Laravel | league_*, xp_transactions, achievements | فقط خواندنی کلاینت | — | رخداد واقعی | not_migrated | TESTED | NOT VERIFIED |
| Media/References/Anatomy | Laravel | media, reference_assets, anatomy_assets | مالکیت + signed URL | — | — | not_migrated | TESTED | NOT VERIFIED |
| Articles/Notes/Groups/Feedback | Laravel | articles, user_notes, study_groups, feedback | مالکیت/کد hash | — | — | not_migrated | TESTED | NOT VERIFIED |
| International | Laravel | international_providers/courses | `intl.*` | `intl.*` | — | not_migrated | TESTED | NOT VERIFIED |
| Commerce | Laravel | plans, orders, payments, entitlements | مبلغ سرور-محور | مالک entitlement | پس از تأیید پرداخت | not_migrated | TESTED | NOT VERIFIED |
| Notifications/Search/Queue | Laravel | notifications, search_documents, outbox_events | مالکیت سشن | — | outbox + handler registry | not_migrated | TESTED | NOT VERIFIED |
| **AI** | **Laravel** | **ai_conversations, ai_messages, ai_daily_usage** | **مالکیت + entitlement `ai.mentor` + quota** | **اجباری (fail-closed)** | **—** | **جدید (بدون دادهٔ legacy)** | **TESTED** | **NOT VERIFIED** |

---

## ۶. محدودیت‌ها و ریسک‌های باقی‌مانده

1. **provider واقعی AI وصل نیست** ⇒ AI در عمل خاموش است (این عمدی و صادقانه است).
2. **مهاجرت واقعی داده انجام نشد** — ابزار آماده است، اجرا در پنجرهٔ Cutover و با تأیید.
3. **staging وجود ندارد** ⇒ هیچ ادعای production/benchmark/load معتبر نیست.
4. **PG:** در این نوبت فقط دامنهٔ AI + قرارداد روی خوشهٔ موقت PG اجرا شد
   (`migrate:fresh → rollback → migrate` + ۲۴ تست / ۴٬۰۲۵ assertion — سبز). جریان موازی
   فاز ۱۷/۱۸ در همان شب کل سوییت را روی PG گرفت: **۹۰۵ سبز / ۱ skip / ۰ شکست** (شامل
   رفع `Commerce/OrderService` که قبلاً `0A000` می‌داد). بدهی باقی‌مانده: فقط فایل‌های
   Pint خارج از دامنه ⇒ گام `pint --test` در `verify-on-pg.sh` هنوز سبز نیست.
5. **هم‌زمانی با جریان فاز ۱۹/۲۰:** فایل‌های مشترک (`routes/api.php`،
   `bootstrap/providers.php`، `ApiV1ContractTest.php`، `openapi.v1.json`) فقط **افزایشی**
   ویرایش شدند؛ ترتیب اجرای builderهای OpenAPI باید محفوظ بماند (هر builder کل فایل را
   می‌نویسد).
6. **`backend/` در git tracked نیست** ⇒ هیچ شبکهٔ امنیتی نسخه‌بندی برای rollback کد وجود ندارد.
7. **تلهٔ هارنس (دیده شد):** اجرای کل سوییت با `memory_limit` پیش‌فرض یک‌بار وسط کار با
   `Fatal error: Premature end of PHP process` (در `Gamification/LeagueAndXpTest`) قطع شد؛
   همان فایل تنها سبز بود و اجرای دوبارهٔ کل سوییت با `php -d memory_limit=1024M` کامل و
   سبز شد (۹۱۴ تست / ۹٬۴۰۹ assertion / ۱۴۷MB). این مصنوع حافظهٔ هارنس است، نه باگ محصول —
   ولی برای CI باید سقف حافظه صریح تعیین شود.
