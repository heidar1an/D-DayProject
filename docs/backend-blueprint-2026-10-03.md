# Backend Blueprint تپش — نسخهٔ As-Built (پس از ۲۴ فاز)

**تاریخ بررسی:** ۱۴۰۵/۰۷/۱۱ (۲۰۲۶-۱۰-۰۳) · **مبنای کد:** `main`، `c2f2a54` + درخت کاری (پوشهٔ `backend/` هنوز untracked) · **وضعیت:** بک‌اند Laravel **ساخته، اجرا و تست شده** است؛ این سند «طرح» نیست، **تصویر واقعیت** است.

**رابطه با سند قبلی:** `docs/backend-blueprint-2026-10-02.md` (نسخهٔ تصمیم‌گیری پیش از پیاده‌سازی) دست‌نخورده باقی مانده است. آن سند «چه باید ساخته شود» بود؛ این سند «چه ساخته شد، چه تأیید شد، چه باقی ماند» است. هرجا این دو واگرا شوند، **این سند معتبر است**.

**واژگان وضعیت (هر ردیف فقط یکی را می‌گوید):**
`IMPLEMENTED` = کد وجود دارد · `TESTED` = تست خودکار سبز است · `VERIFIED` = روی PostgreSQL واقعی/محیط واقعی اجرا و تأیید شده · `NOT VERIFIED` = اجرا نشده، پس ادعا نمی‌شود · `BLOCKED` = زیرساخت/مصرف‌کنندهٔ واقعی وجود ندارد.

> قاعده‌ای که در همهٔ ۲۴ فاز رعایت شد: **هیچ provider، درگاه پرداخت، staging یا دادهٔ جعلی ساخته نشد.** هرجا زیرساخت واقعی نبود، پاسخ صریح `۵۰۳` یا گزارش `NOT VERIFIED` است — نه موفقیت ساختگی.

---

## ۰. خلاصهٔ اجرایی — اعداد اندازه‌گیری‌شدهٔ امروز

| سنجه | مقدار | روش اندازه‌گیری |
|---|---|---|
| سوییت تست (SQLite) | **۹۱۲ passed / ۲ skipped / ۰ failed — ۹٬۴۰۹ assertion — ۴۷.۵ ثانیه** | `php -d memory_limit=1024M artisan test` (اجرای همین امروز) |
| فایل تست | ۷۵ فایل · ۹۱۴ تست تعریف‌شده | `phpunit --list-tests` |
| مسیرهای v1 ثبت‌شده | **۲۲۴** (۹۶ تای آن زیر `/api/v1/admin/`) | `php artisan route:list --json` |
| مسیرهای legacy در Laravel | **۰** | همان اجرا — legacy کاملاً روی Node است |
| قرارداد OpenAPI v1 | **۱۸۴ path / ۲۲۴ عملیات / ۱۱۱ schema — نسخهٔ ۱.۱۰.۰** | شمارش مستقیم `docs/openapi.v1.json` |
| جدول‌های دیتابیس | **۹۱** (۸۶ دامنه‌ای + ۵ فریم‌ورکی) | `Schema::create` در ۳۴ migration |
| کد دامنه | ۸۳ Model · ۱۲۵ Service در **۲۹ دامنه** · ۶۳ Controller · ۹۳ Request · ۶۸ Resource | شمارش فایل |
| سیاست‌ها و عملیات عرضی | ۱۵ Policy · ۸ Middleware · ۱۴ Provider · ۷ Job · ۱۲ Event · ۴ Listener · ۷ فرمان Console · ۴۰ فایل config | شمارش فایل |
| پل فرانت ↔ v1 | **۱۲ پل / ۱۰۸ بررسی سبز / ۰ شکست** | `node scripts/v1-frontend-contract.mjs` (اجرای همین امروز) |
| سبک کد (Pint) | **FAIL — ۶۹۷ فایل، ۳۶ تخلف** (خارج از دامنهٔ فازهای اخیر) | `vendor/bin/pint --test` |
| محیط اجراشده | PHP 8.5.11 · Laravel ^13.17 · PostgreSQL 17.11 · Redis 8.10.2 | `php -v` · `composer.json` · گزارش فاز ۱ |
| Docker / CI | `IMPLEMENTED` ولی **UNVERIFIED-EXTERNAL** (docker نصب نیست؛ workflow روی runner اجرا نشده) | — |
| مهاجرت داده | ابزار کامل + **rehearsal واقعی** روی DB موقت: ۱۵ رکورد نوشته، ۱۲ قرنطینه | `docs/phase22-import-report.json` |

---

## ۱. حکم معماری — طرح در برابر واقعیت

| تصمیم سند ۲۰۲۶-۱۰-۰۲ | وضعیت امروز |
|---|---|
| Laravel/PHP + PostgreSQL برای هستهٔ نهایی؛ Node تا اثبات هم‌ارزی فعال بماند | **اجرا شد.** Laravel 13.34 روی PHP 8.5.11 + PG 17.11 + Redis 8.10.2. `server.js` و `/api/*` دست‌نخورده و **تنها نویسندهٔ داده** تا cutover. |
| اپلیکیشن جدید در مرز مستقل `backend/` — «هنوز ساخته نشده» | **ساخته شد.** ۳۴ migration، ۹۱ جدول، ۲۲۴ عملیات v1، ۹۱۲ تست. |
| `/api/v1/*` برای قرارداد جدید؛ `/api/*` قدیم دست‌نخورده | **برقرار.** صفر مسیر legacy در Laravel؛ OpenAPI قدیم (`docs/api/openapi.json`) تغییر نکرده. |
| منبع حقیقت پروفایل/نتیجه/دسترسی/قیمت = سرور | **برقرار.** مبلغ سفارش، زمان آزمون، نمره، XP و entitlement همه سرور-محور؛ بدنهٔ کلاینت این‌ها را تعیین نمی‌کند (`prohibited` ⇒ ۴۲۲). |
| PostgreSQL system of record؛ Redis فقط cache/queue/rate-limit | **برقرار.** Redis هیچ‌جا منبع رکورد نیست. |
| «تا ماتریس تطبیق پذیرفته نشود، migration تولیدی آغاز نشود» | **دروازه رد شد و فاز ۱ آغاز شد**؛ توالی طرح در عمل بازچینی شد (بخش ۱۱). |
| «php/composer/docker در PATH نیست» | **منقضی.** PHP/Composer/PostgreSQL/Redis نصب و اجرا شدند؛ فقط **Docker** در دسترس نیست. |

**نتیجه:** هدف معماری (modular monolith با مالکیت روشن داده) محقق شد. آنچه محقق **نشد** cutover است، نه معماری.

---

## ۲. موجودی As-Built

### ۲.۱ لایه‌بندی واقعی
`Controller (نازک) → FormRequest → Service/Action دامنه → Eloquent transaction → Resource`

- ۲۹ دامنهٔ سرویس: Admin · Ai · Analytics · Anatomy · Articles · Audit · Commerce · Content · Exam · Feedback · Flashcards · Gamification · GreenPath · Groups · Health · Identity · International · Knowledge · Learning · Media · Notes · Notifications · Outbox · QuestionBank · References · Search · Settings · Support · Wiki
- ۸ Middleware اختصاصی: `EnsureRequestId` · `ResolveApiSession` · `RequireSessionUser` · `RequireAdminSession` · `RequirePermission` · `EnsureSameOrigin` · `EnsureCsrfToken` · `AuditAdminMutation`
- ۱۵ Policy روی منابع حساس (آزمون، سؤال، فلش‌کارت، ویکی، گراف دانش، پیشرفت)

### ۲.۲ دیتابیس
۹۱ جدول از ۳۴ migration. تفکیک: ۵ جدول فریم‌ورکی (`cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`) + ۸۶ جدول دامنه‌ای.

**ناوردایی‌هایی که واقعاً در DB قفل شده‌اند:**
- PK همهٔ جدول‌های دامنه `uuid`؛ جدول‌های ledger/رخداد (`xp_transactions`, `flashcard_reviews`, `analytics_events`, `audit_logs`, `payment_webhooks`) **بدون `updated_at`** و append-only.
- ضد تکرار در سطح DB، نه فقط سرویس: `payments.authority` UNIQUE · `payment_webhooks(provider, event_id)` UNIQUE · `idempotency_keys` · `flashcard_reviews.request_key` UNIQUE · `group_retired_codes` برای چرخش کد گروه.
- **جداسازی کلید پاسخ:** `question_keys` جدول جدا از `questions`؛ پاسخ عمومی هرگز `correctAnswer`/`explanation` ندارد.
- snapshot آزمون در `exam_questions` (نسخه + render snapshot + key snapshot رمزنگاری‌شده) تا ویرایش بعدی سؤال، نتیجهٔ گذشته را بازنویسی نکند.
- FKهای مالی/آزمون/audit روی `RESTRICT`؛ soft delete برای attempt/result/ledger/payment/audit **ممنوع**.
- CHECKهای دامنه‌ای (مثلاً `flashcard_states.ease >= 1.3`، ظرفیت گروه ۲–۳) به‌جای ENUM سخت.
- قفل ردیف `users` + PK مرکب `(user_id, usage_date)` در `ai_daily_usage` برای سهمیهٔ اتمیک.

**بدهی دیتابیس:** ۲۵ entity قدیمی (Media Center، publishing و…) **هنوز جدول مقصد ندارند** — همان ۱۴ جدول media که سند قبلی «طرح گروهی» خوانده بود، ساخته نشده‌اند. این تنها شکاف بزرگ داده است.

### ۲.۳ مسیرها و قرارداد
- ۲۲۴ عملیات v1 ثبت‌شده = ۲۲۴ عملیات OpenAPI. **انطباق یک‌به‌یک، قفل‌شده با `ApiV1ContractTest` (دوطرفه: route ↔ OpenAPI).**
- ۳۰ tag دامنه‌ای؛ بزرگ‌ترین گروه‌ها: `admin` (۹۶ مسیر)، `me` (۴۵)، `flashcards` (۱۷).
- شکل پاسخ: موفق `{data, meta?, requestId}` / خطا `{error:{code,message,fields?}, requestId}`؛ کدهای خطا پایدار.
- سازندهٔ OpenAPI idempotent است (`scripts/build-openapi-v1-phase*.mjs`)، ولی **هر builder کل فایل را می‌نویسد ⇒ ترتیب اجرا مهم است**.
- `.env.example` شامل **۱۰۲ کلید** — همهٔ سقف‌ها، rate limitها و retentionها پیکربندی‌پذیرند.

---

## ۳. نقشهٔ ماژول As-Built

| دامنه | مالک داده | جدول‌ها | وضعیت |
|---|---|---|---|
| Identity/Auth | Laravel | `users`, `user_profiles`, `auth_sessions`, `universities`, `semesters` | TESTED + VERIFIED(PG) |
| Admin/RBAC | Laravel | `admins`, `roles`, `permissions`, `admin_roles`, `role_permissions` | TESTED |
| Content | Laravel | `subjects`, `courses`, `chapters`, `lessons`, `lesson_pages` | TESTED |
| Learning | Laravel | `learning_progress`, `study_sessions`, `user_notes`, `review_items` | TESTED |
| QuestionBank | Laravel | `questions`, `question_options`, `question_keys`, `question_attempts`, `question_reports`, `heart_rewards` | TESTED |
| Exam | Laravel | `exams`, `exam_questions`, `exam_registrations`, `exam_attempts`, `exam_answers`, `exam_results` | TESTED |
| Analytics | Laravel (فقط مصرف‌کننده) | `analytics_events` | TESTED |
| Flashcards | Laravel | `flashcard_decks`, `flashcards`, `flashcard_states`, `flashcard_reviews` | TESTED |
| Wiki / Knowledge | Laravel | `wiki_*` (۴) · `knowledge_nodes`, `knowledge_edges` | TESTED |
| GreenPath | Laravel | `green_paths`, `green_path_steps` | TESTED |
| Gamification | Laravel | `league_*`, `xp_transactions`, `achievements`, `user_achievements`, `challenges`, `user_challenges`, `streaks` | TESTED |
| Media/References/Anatomy | Laravel | `media`, `references`, `reference_assets`, `anatomy_assets` | TESTED |
| Articles/Notes/Groups/Feedback | Laravel | `articles`, `article_categories`, `article_bookmarks`, `user_notes`, `study_groups`, `group_memberships`, `group_retired_codes`, `feedback`, `feedback_replies` | TESTED |
| International | Laravel | `international_providers`, `international_courses` | TESTED |
| Commerce | Laravel | `products`, `plans`, `product_capabilities`, `orders`, `order_lines`, `payments`, `subscriptions`, `entitlements`, `payment_webhooks` | TESTED (gateway واقعی: BLOCKED) |
| Notifications/Outbox/Search | Laravel | `notifications`, `notification_deliveries`, `search_documents`, `outbox_events` | TESTED |
| Ops/Audit/Settings | Laravel | `audit_logs`, `system_settings` | TESTED |
| **AI Mentor** | Laravel | `ai_conversations`, `ai_messages`, `ai_daily_usage` | TESTED (provider واقعی: BLOCKED) |
| **Legacy Node** | **Node (تنها نویسنده)** | فروشگاه JSON + ۴۴ منبع | **فعال — مالک نوشتن تا cutover** |

---

## ۴. Authorization و نقش‌ها As-Built

- دو principal جدا: `users` (دانشجو) و `admins` (پنل) با guard و سشن مستقل.
- زنجیرهٔ واقعی روی هر مسیر ادمین: `api → api.session → api.audit → api.admin → throttle:<domain>_admin → api.origin → api.csrf → api.can:<permission>`. **deny-by-default**؛ نبود permission ⇒ ۴۰۳.
- **entitlement ≠ role.** تنها صادرکنندهٔ حق دسترسی `PaymentService::finalize` است؛ بستن دسترسی با `ends_at` انجام می‌شود — بدون نیاز به Cron.
- گیت‌ها **صادقانه خاموش**‌اند: `commerce.checkout.enabled=false` و `commerce.entitlements.enforce=false` پیش‌فرض‌اند و مستند. `EntitlementGate` تا وقتی enforcement خاموش است `true` برمی‌گرداند — و دقیقاً به همین دلیل AI از آن استفاده **نمی‌کند** (بخش ۵.۴).
- sweep استاتیک امنیتی: صفر `super-admin` در کد اپ، صفر `DB::table(` در Controllerهای ادمین، صفر هدر `X-Forwarded-*` خوانده‌شده در کد اپ.

---

## ۵. Flowهای کلیدی As-Built

### ۵.۱ نشست و هویت
سشن **سرور-کنترل‌شده**: کلاینت فقط توکن ۲۵۶ بیتی در کوکی `HttpOnly` (`tapesh_session`) دارد؛ سرور تنها `SHA-256` آن را نگه می‌دارد. rotation در ورود، `expires_at` لغزان، `revoked_at`. CSRF با double-submit (`tapesh_csrf` + `X-CSRF-Token`) و Origin/Referer **fail-closed** روی هر نوشتن. هویت هرگز از body/query نمی‌آید. هش‌های قدیمی `scrypt$salt$hash` و SHA-256 هنگام ورود verify و **پس از ورود موفق** به Argon2id ارتقا می‌یابند (بدون بازنشانی رمز). Google OAuth: provider بایند‌نشده ⇒ `۵۰۳ FEATURE_NOT_CONFIGURED` (تنها ست‌کردن credential کافی نیست).

### ۵.۲ تجارت
`quote → order pending → redirect → verify سرور-به-سرور → payment paid → subscription/entitlement`. مبلغ فقط از سرور؛ `paid` فقط توسط `PaymentService::finalize` نوشته می‌شود. sandbox زرین‌پال **امضای HMAC واقعی** دارد، نه پرچم `success` قابل جعل. ضد تکرار در DB (نه در حافظه). `price_minor` مصوب وجود ندارد ⇒ محصولات `purchasable:false` و checkout خاموش است — عمدی.

### ۵.۳ آزمون
سه مرز دامنه بدون جدول تکراری؛ یک موتور نمره‌دهی با `kind ∈ quiz|personal|coordinated|international`. زمان، کلید و نمره فقط سرور؛ `finish` با قفل ردیف و idempotency؛ کلید تا موعد انتشار لو نمی‌رود.

### ۵.۴ AI Mentor (فاز ۲۱) — الگوی «fail-closed صادقانه»
`AiController → AiService → AiProvider(interface)`؛ بایند پیش‌فرض `UnconfiguredAiProvider` ⇒ **۵۰۳ صریح، بدون mock**.
- `AiService::authorize` از `EntitlementService::has()` **مستقیم** می‌پرسد، نه از `EntitlementGate` ⇒ AI هرگز از خاموش‌بودن enforcement باز نمی‌شود.
- سهمیهٔ روزانه اتمیک؛ متن پیام `encrypted`؛ `providerMessageId`، مصرف توکن و `error_code` در `$hidden`؛ خطای provider **بازنویسی** می‌شود (بدون نشت پیام یا credential).
- مالکیت غیرمالک ⇒ **۴۰۴** (نه ۴۰۳) تا وجود منبع افشا نشود.
- idempotency واقعی: کلید با بدنهٔ متفاوت ⇒ `۴۰۹ IDEMPOTENCY_CONFLICT`؛ درخواست نیمه‌تمام ⇒ `۴۰۹ AI_REQUEST_IN_PROGRESS`.
- پیوست: Media با `purpose=ai`، فقط `image|document`، همیشه private. **مسیر انتقال فایل به provider ساخته نشد** ⇒ ارسال `attachmentIds` پاسخ `۵۰۳` است، نه ادعای جعلی.
- **SSE ساخته نشد** — مصرف‌کنندهٔ واقعی streaming وجود ندارد. تصمیم، نه فراموشی.

### ۵.۵ رخداد، صف، اعلان، جست‌وجو
هر اثر جانبی حساس از **Outbox** می‌گذرد (هیچ اثری بی‌Outbox نیست): ۱۲ Event + ۴ Listener + ۵ Job + ۷ فرمان Console (از جمله `PublishOutboxCommand`, `SearchRebuildCommand`, `ReconcileLeagueXp`, `ExpireExamAttempts`, `PruneOpsData`). `search_documents` یک **پروجکشن قابل بازسازی** است؛ DB منبع حقیقت می‌ماند. جست‌وجو نرمال‌سازی فارسی/عربی دارد و wildcard کلاینت به wildcard تبدیل نمی‌شود.

### ۵.۶ Cutover (فاز ۲۲) — rehearsal واقعی انجام شد
زنجیرهٔ مصوب: `Inventory → Crosswalk → Staging → Normalize → Validate → Import → Compare → Parity → Read Switch → Write Switch`.
- inventory: **۴۴ منبع / ۱٬۵۵۹ رکورد / ۱۸ entity نگاشت‌شده** (`docs/phase22-inventory.json`).
- parity پس از import روی DB موقت: **۵ در parity · ۱۲ not_migrated · ۱ excluded_by_policy · ۰ جدول گم‌شده · ۰ یتیم FK**.
- import در حالت `apply` روی `/tmp/tapesh-rehearsal.sqlite`: **۱۵ رکورد نوشته، ۱۲ قرنطینه** — ۱۲ مقاله با دلیل `body_not_html_string` رد شدند (بدنهٔ legacy رشتهٔ HTML نیست). **قرنطینه به‌جای حدس‌زدن.**
- سشن‌های legacy (۶۳ عدد) **مهاجرت نمی‌شوند**؛ سیاست `re-login`. صفر Dual Writer: تا cutover فقط Node می‌نویسد.

---

## ۶. نقشهٔ فاز ۱ تا ۲۴ (As-Built)

| فاز | تحویل واقعی | وضعیت |
|---|---|---|
| ۱ | Foundation: boot، envelope خطا، `requestId`، healthz/readyz، لاگ JSON. نصب و اجرای PHP/Composer/PG/Redis | TESTED + VERIFIED |
| ۲ | Identity: register/login/logout/me/PATCH me/universities، سشن سرور، CSRF/Origin، rate limit، مهاجرت رمز legacy، ۶۱ دانشگاه seed | TESTED + VERIFIED(PG) |
| ۳–۴ | در `backend/` وجود نداشتند؛ **حداقل لازم در جریان فاز ۵–۶ ساخته شد** (ادمین/RBAC + محتوای آموزشی) | TESTED |
| ۵ | Learning: پیشرفت صفحه + نشست مطالعه با بازهٔ محدود و منطق monotonic | TESTED |
| ۶ | QuestionBank: جداسازی سؤال/گزینه/کلید، تلاش، گزارش، قلب پاداش | TESTED |
| ۷ | Exam Engine: snapshot، زمان و نمرهٔ سرور، چهار `kind`، نتیجهٔ منتشرشده | TESTED + VERIFIED(PG) |
| ۸ | Analytics: رخداد محدود و غیرحساس، فقط مصرف‌کننده | TESTED |
| ۹ | Flashcards: سه‌سطحی تعریف/وضعیت/رخداد، الگوریتم versioned، ۲۸ مسیر | TESTED + VERIFIED(PG) |
| ۱۰–۱۱ | Wiki: دسته/مقاله/رابطه/bookmark + جست‌وجو و suggest (۷۱ متد تست) | TESTED + VERIFIED(PG) |
| ۱۲ | Knowledge Graph: نود/یال، دامنهٔ مستقل از ویکی، FK روی RESTRICT | TESTED + VERIFIED(PG) |
| ۱۳ | GreenPath: مسیر/قدم، roadmap/today/calendar/performance، گذار سروری | TESTED + VERIFIED(PG) |
| ۱۴ | League/Gamification: فصل، عضویت، XP ledger تغییرناپذیر، نشان/چالش/streak | TESTED + VERIFIED(PG) |
| ۱۵–۱۶ | Media/References/Anatomy + Articles/Notes/Review/Groups/Feedback | TESTED |
| ۱۷–۱۸ | International + Commerce: مبلغ سرور-محور، sandbox با امضای HMAC، entitlement فقط از finalize | TESTED |
| ۱۹–۲۰ | Outbox + Notifications + Search + پنل کامل مدیریت (۹۳ تست تازه، ۱۶ path تازه) | TESTED |
| ۲۱ | AI Mentor: fail-closed، سهمیه، idempotency، پیوست private، بدون SSE | TESTED + VERIFIED(PG) |
| ۲۲ | Migration/Cutover: inventory، crosswalk، parity، import + **rehearsal روی DB موقت** | TESTED — مهاجرت production انجام نشد |
| ۲۳ | Security Hardening: ۱۲۰ تست امنیتی/هویت/تجارت/رسانه سبز + sweep استاتیک | TESTED |
| ۲۴ | Performance/Production: فقط baseline ساختاری؛ **هیچ بهینه‌سازی‌ای انجام نشد** (چون baseline واقعی نبود) | **NOT VERIFIED** |

**نگاشت شماره‌گذاری:** «فاز ۱۱ = Wiki» در پرامپت با «فاز ۱۰ = Wiki» در شماره‌گذاری داخلی بک‌اند یکی است (KG پرامپت ۱۲ = داخلی ۱۱). سند قبلی فقط تا فاز ۲۱ نقشه داشت.

---

## ۷. دفتر تأیید (Verification Ledger)

### تأییدشده (اجرا و سبز)
- **SQLite:** ۹۱۲ passed / ۲ skipped / ۹٬۴۰۹ assertion (امروز).
- **PostgreSQL واقعی** (خوشهٔ موقت `/tmp` با `scripts/verify-on-pg.sh`): `migrate:fresh → rollback → migrate` سبز؛ کل سوییت روی PG **۹۰۵ سبز / ۱ skip / ۰ شکست** (اجرای جریان موازی فاز ۱۷/۱۸) و دامنهٔ AI+قرارداد **۲۴ تست / ۴٬۰۲۵ assertion** سبز.
- **قرارداد:** `ApiV1ContractTest` دوطرفه سبز — ۲۲۴ route ↔ ۲۲۴ عملیات OpenAPI.
- **پل فرانت:** ۱۲ پل / ۱۰۸ بررسی سبز (امروز).
- **Rehearsal مهاجرت:** روی DB موقت اجرا شد (بخش ۵.۶).

### تأییدنشده یا مسدود (صادقانه)
| مورد | وضعیت | دلیل |
|---|---|---|
| provider واقعی AI (LLM) | `BLOCKED` | credential/بودجه پیکربندی نشده |
| SSE برای AI | `BLOCKED` | مصرف‌کنندهٔ واقعی ندارد |
| درگاه پرداخت واقعی | `BLOCKED` | `price_minor` مصوب وجود ندارد ⇒ `purchasable:false` |
| Google OAuth | `BLOCKED` | provider بایند‌نشده ⇒ ۵۰۳ |
| AV scan / quarantine آپلود | `BLOCKED` | زیرساخت ندارد |
| staging | **وجود ندارد** | هیچ ادعای benchmark/load معتبر نیست |
| Cutover واقعی + migration داده | `NOT VERIFIED` | نیازمند پنجرهٔ cutover و تأیید صریح کاربر |
| p50/p95/p99، query count، cache hit، queue depth | اندازه‌گیری نشده | بدون staging |
| Docker build و `backend-ci.yml` | `UNVERIFIED-EXTERNAL` | docker در دسترس نیست؛ workflow روی runner اجرا نشده |
| Backup/Restore drill و RPO/RTO | اندازه‌گیری نشده | drill روی دادهٔ production انجام نشد |
| Trusted proxies پشت Nginx | `NOT VERIFIED` | پیش‌فرض فریم‌ورک امن است، پیکربندی تولیدی تأیید نشده |
| سوئیچ UI به v1 | انجام نشد | عمدی: با provider/گیت خاموش، UI می‌شکست |

### سبک کد
Pint: **۶۹۷ فایل بررسی، ۳۶ تخلف** ⇒ گام `pint --test` سبز نیست. تخلف‌ها در فایل‌های خارج از دامنهٔ فازهای اخیرند و عمداً دست نخوردند تا با جریان موازی تصادم نشود.

---

## ۸. واگرایی طرح ↔ واقعیت (Deviation Log)

1. **`backend/` ساخته شد** — سند قبلی آن را «هنوز ساخته نشده» می‌دانست.
2. **توالی فازها بازچینی شد:** فازهای ۳ و ۴ در زمان فاز ۵–۶ وجود نداشتند و حداقل لازمشان همان‌جا ساخته شد. یعنی توالی سند قبلی در عمل رعایت نشد.
3. **جدول‌های «مشروط» ساخته شدند:** `search_documents`, `outbox_events`, `payment_webhooks` که سند قبلی گفته بود «فقط وقتی نیاز فاز اثبات شد» — فازهای ۱۷–۲۰ نیاز را اثبات کردند.
4. **SSE ساخته نشد** و **مسیر انتقال فایل AI ساخته نشد** — تصمیم آگاهانه، نه فراموشی.
5. **۱۴ جدول Media Center / publishing ساخته نشد** — ۲۵ entity قدیمی هنوز جدول مقصد ندارند. بزرگ‌ترین شکاف باقی‌مانده.
6. **مهاجرت داده انجام نشد**؛ فقط rehearsal.
7. **بهینه‌سازی عملکرد انجام نشد** — چون baseline واقعی وجود نداشت (اصل «Optimization بدون baseline ممنوع»).
8. **`backend/README.md` کهنه است:** عنوانش هنوز «Phase 1 + Phase 2» و عدد تستش ۱۳۱ است، در حالی که واقعیت ۲۴ فاز و ۹۱۲ تست است. باید بازنویسی شود.
9. **Pint سبز نیست** (۳۶ تخلف خارج از دامنه).

---

## ۹. بدهی باز و قدم بعدی (به ترتیب اولویت)

1. **`backend/` را tracked کن** — الان هیچ شبکهٔ امنیتی نسخه‌بندی برای rollback کد وجود ندارد. این پیش‌نیاز هر کار بعدی است.
2. **README بک‌اند را با واقعیت ۲۴ فاز هم‌تراز کن** (عدد تست، فهرست دامنه‌ها، وضعیت گیت‌ها).
3. **Pint را سبز کن** — یا دامنه را صریح محدود کن. ۳۶ تخلف در CI گام `pint --test` را می‌شکند.
4. **UI را به پل‌های v1 سوئیچ کن** — اتمیک و به‌شرط روشن‌بودن provider/گیت مربوطه. الان UI هنوز legacy است و پل‌ها بی‌مصرف.
5. **staging بساز** — بدون آن، فاز ۲۴ (`NOT VERIFIED`) هرگز سبز نمی‌شود و هیچ ادعای عملکردی معتبر نیست.
6. **Cutover واقعی** — فقط در پنجرهٔ اعلام‌شده، با backup مانیفست‌دار، import delta، parity و rollback دوگانهٔ مستقل (کد ≠ داده).
7. **۱۴ جدول Media/publishing** — قبل از cutover دامنهٔ محتوا، crosswalk و migration آن‌ها باید تصمیم بگیرد.
8. **گیت‌های خاموش را آگاهانه روشن کن** — `checkout.enabled` و `entitlements.enforce` فقط پس از تأیید قیمت مصوب و اتصال درگاه.
9. **توزیع صندلی گروهی** و `audit_logs` مالی — دو بدهی طراحی شناخته‌شده.
10. **دکترین backup/restore + اندازه‌گیری RPO/RTO** روی محیط واقعی.

---

## ۱۰. نتیجهٔ as-built

بک‌اند تپش از یک «طرح پیش از پیاده‌سازی» به یک **modular monolith اجراشده با ۹۱ جدول، ۲۲۴ عملیات v1 و ۹۱۲ تست سبز** تبدیل شده است. معماری، مالکیت داده، جداسازی کلید پاسخ، entitlement، fail-closed بودن AI و ضد تکرار پرداخت همه در کد و تست قفل شده‌اند.

آنچه **نیست**: staging، cutover، provider واقعی AI، درگاه پرداخت واقعی، اعداد عملکردی، و سوئیچ UI. این‌ها نه فراموش شده‌اند و نه ادعا شده‌اند — **صریحاً باز و برچسب‌دار** هستند. هیچ عددی در این سند تخمین نیست؛ هر سنجه با دستور یا فایل شاهد قابل بازتولید است.

---

## پیوست الف — نقشهٔ کامل endpointهای v1 (۲۲۴ عملیات / ۳۰ دامنه)

استخراج مستقیم از `docs/openapi.v1.json` نسخهٔ ۱.۱۰.۰. هر خط = یک عملیات ثبت‌شده.

### `admin` — 96 عملیات

```
DELETE /api/v1/admin/articles/categories/{id}
DELETE /api/v1/admin/flashcards/cards/{id}
DELETE /api/v1/admin/flashcards/decks/{id}
DELETE /api/v1/admin/international/courses/{id}
DELETE /api/v1/admin/knowledge/edges/{id}
DELETE /api/v1/admin/knowledge/nodes/{id}
DELETE /api/v1/admin/media/{id}
DELETE /api/v1/admin/references/{id}/assets/{assetId}
DELETE /api/v1/admin/wiki/categories/{id}
DELETE /api/v1/admin/wiki/relations/{id}
GET    /api/v1/admin/anatomy/assets
GET    /api/v1/admin/articles
GET    /api/v1/admin/articles/categories
GET    /api/v1/admin/articles/{id}
GET    /api/v1/admin/audit-logs
GET    /api/v1/admin/audit-logs/{id}
GET    /api/v1/admin/auth/me
GET    /api/v1/admin/dashboard
GET    /api/v1/admin/feedback
GET    /api/v1/admin/feedback/{id}
GET    /api/v1/admin/flashcards/decks
GET    /api/v1/admin/flashcards/decks/{id}
GET    /api/v1/admin/flashcards/decks/{id}/cards
GET    /api/v1/admin/international/courses
GET    /api/v1/admin/international/providers
GET    /api/v1/admin/knowledge/nodes
GET    /api/v1/admin/knowledge/nodes/{id}
GET    /api/v1/admin/media
GET    /api/v1/admin/notifications/deliveries
GET    /api/v1/admin/questions
GET    /api/v1/admin/questions/{id}
GET    /api/v1/admin/queue/failed
GET    /api/v1/admin/references
GET    /api/v1/admin/references/{id}
GET    /api/v1/admin/search/status
GET    /api/v1/admin/settings
GET    /api/v1/admin/users
GET    /api/v1/admin/users/{id}
GET    /api/v1/admin/wiki/articles
GET    /api/v1/admin/wiki/articles/{id}
GET    /api/v1/admin/wiki/categories
PATCH  /api/v1/admin/anatomy/assets/{id}
PATCH  /api/v1/admin/articles/categories/{id}
PATCH  /api/v1/admin/articles/{id}
PATCH  /api/v1/admin/feedback/{id}
PATCH  /api/v1/admin/flashcards/cards/{id}
PATCH  /api/v1/admin/flashcards/decks/{id}
PATCH  /api/v1/admin/international/courses/{id}
PATCH  /api/v1/admin/international/providers/{id}
PATCH  /api/v1/admin/knowledge/nodes/{id}
PATCH  /api/v1/admin/questions/{id}
PATCH  /api/v1/admin/references/{id}
PATCH  /api/v1/admin/settings
PATCH  /api/v1/admin/wiki/articles/{id}
PATCH  /api/v1/admin/wiki/categories/{id}
POST   /api/v1/admin/anatomy/assets
POST   /api/v1/admin/anatomy/assets/{id}/archive
POST   /api/v1/admin/anatomy/assets/{id}/publish
POST   /api/v1/admin/articles
POST   /api/v1/admin/articles/categories
POST   /api/v1/admin/articles/{id}/archive
POST   /api/v1/admin/articles/{id}/publish
POST   /api/v1/admin/auth/login
POST   /api/v1/admin/auth/logout
POST   /api/v1/admin/feedback/{id}/replies
POST   /api/v1/admin/flashcards/decks
POST   /api/v1/admin/flashcards/decks/{id}/archive
POST   /api/v1/admin/flashcards/decks/{id}/cards
POST   /api/v1/admin/flashcards/decks/{id}/publish
POST   /api/v1/admin/international/courses
POST   /api/v1/admin/international/courses/{id}/status
POST   /api/v1/admin/international/providers
POST   /api/v1/admin/international/providers/{id}/status
POST   /api/v1/admin/knowledge/edges
POST   /api/v1/admin/knowledge/nodes
POST   /api/v1/admin/knowledge/nodes/{id}/archive
POST   /api/v1/admin/knowledge/nodes/{id}/publish
POST   /api/v1/admin/media/uploads
POST   /api/v1/admin/media/{id}/archive
POST   /api/v1/admin/notifications
POST   /api/v1/admin/notifications/broadcast
POST   /api/v1/admin/notifications/deliveries/{id}/retry
POST   /api/v1/admin/questions
POST   /api/v1/admin/questions/{id}/archive
POST   /api/v1/admin/questions/{id}/publish
POST   /api/v1/admin/queue/failed/{id}/retry
POST   /api/v1/admin/references
POST   /api/v1/admin/references/{id}/archive
POST   /api/v1/admin/references/{id}/assets
POST   /api/v1/admin/references/{id}/publish
POST   /api/v1/admin/search/rebuild
POST   /api/v1/admin/wiki/articles
POST   /api/v1/admin/wiki/articles/{id}/archive
POST   /api/v1/admin/wiki/articles/{id}/publish
POST   /api/v1/admin/wiki/categories
POST   /api/v1/admin/wiki/relations
```

### `me` — 45 عملیات

```
DELETE /api/v1/me/article-bookmarks/{articleId}
DELETE /api/v1/me/notes/{id}
DELETE /api/v1/me/review-items/{id}
DELETE /api/v1/me/wiki-bookmarks/{articleId}
GET    /api/v1/me
GET    /api/v1/me/achievements
GET    /api/v1/me/analytics/exams
GET    /api/v1/me/analytics/overview
GET    /api/v1/me/analytics/progress
GET    /api/v1/me/analytics/topics
GET    /api/v1/me/article-bookmarks
GET    /api/v1/me/challenges
GET    /api/v1/me/entitlements
GET    /api/v1/me/feedback
GET    /api/v1/me/green-path/calendar
GET    /api/v1/me/green-path/performance
GET    /api/v1/me/green-path/profile
GET    /api/v1/me/green-path/roadmap
GET    /api/v1/me/green-path/today
GET    /api/v1/me/league
GET    /api/v1/me/notes
GET    /api/v1/me/notifications
GET    /api/v1/me/orders
GET    /api/v1/me/orders/{id}
GET    /api/v1/me/payments
GET    /api/v1/me/progress
GET    /api/v1/me/progress/pages/{id}
GET    /api/v1/me/review-items
GET    /api/v1/me/subscriptions
GET    /api/v1/me/wiki-bookmarks
PATCH  /api/v1/me
PATCH  /api/v1/me/green-path/steps/{id}
PATCH  /api/v1/me/notes/{id}
PATCH  /api/v1/me/notifications/read-all
PATCH  /api/v1/me/notifications/{id}/read
PATCH  /api/v1/me/review-items/{id}
POST   /api/v1/me/feedback/read
POST   /api/v1/me/notes
POST   /api/v1/me/review-items
POST   /api/v1/me/review-items/{id}/complete-review
POST   /api/v1/me/review-items/{id}/restart
POST   /api/v1/me/study-sessions
PUT    /api/v1/me/article-bookmarks/{articleId}
PUT    /api/v1/me/progress/pages/{id}
PUT    /api/v1/me/wiki-bookmarks/{articleId}
```

### `flashcards` — 17 عملیات

```
DELETE /api/v1/flashcards/cards/{id}
DELETE /api/v1/flashcards/decks/{id}
GET    /api/v1/flashcards/cards
GET    /api/v1/flashcards/decks
GET    /api/v1/flashcards/decks/{id}
GET    /api/v1/flashcards/decks/{id}/cards
GET    /api/v1/flashcards/progress
GET    /api/v1/flashcards/review/queue
PATCH  /api/v1/flashcards/cards/{id}
PATCH  /api/v1/flashcards/decks/{id}
POST   /api/v1/flashcards/cards/{id}/bookmark
POST   /api/v1/flashcards/cards/{id}/bury
POST   /api/v1/flashcards/cards/{id}/suspend
POST   /api/v1/flashcards/decks
POST   /api/v1/flashcards/decks/{id}/cards
POST   /api/v1/flashcards/decks/{id}/clone
POST   /api/v1/flashcards/review/{cardId}
```

### `groups` — 7 عملیات

```
DELETE /api/v1/groups/{id}/members/{memberId}
GET    /api/v1/groups/me
GET    /api/v1/groups/{id}
POST   /api/v1/groups
POST   /api/v1/groups/join
POST   /api/v1/groups/{id}/leave
POST   /api/v1/groups/{id}/rotate-code
```

### `exam-attempts` — 5 عملیات

```
GET    /api/v1/exam-attempts/{id}
GET    /api/v1/exam-attempts/{id}/result
GET    /api/v1/exam-attempts/{id}/review
POST   /api/v1/exam-attempts/{id}/finish
PUT    /api/v1/exam-attempts/{id}/answers
```

### `exams` — 6 عملیات

```
DELETE /api/v1/exams/{idOrSlug}/registrations
GET    /api/v1/exams
GET    /api/v1/exams/{idOrSlug}
GET    /api/v1/exams/{idOrSlug}/ranking
POST   /api/v1/exams/{idOrSlug}/attempts
POST   /api/v1/exams/{idOrSlug}/registrations
```

### `wiki` — 5 عملیات

```
GET    /api/v1/wiki/articles
GET    /api/v1/wiki/articles/{slug}
GET    /api/v1/wiki/categories
GET    /api/v1/wiki/search
GET    /api/v1/wiki/suggest
```

### `questions` — 4 عملیات

```
GET    /api/v1/questions
GET    /api/v1/questions/{id}
POST   /api/v1/questions/{id}/answers
POST   /api/v1/questions/{id}/reports
```

### `articles` — 3 عملیات

```
GET    /api/v1/articles
GET    /api/v1/articles/categories
GET    /api/v1/articles/{slug}
```

### `auth` — 3 عملیات

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/register
```

### `international` — 3 عملیات

```
GET    /api/v1/international/courses
GET    /api/v1/international/courses/{slug}
GET    /api/v1/international/providers
```

### `knowledge` — 3 عملیات

```
GET    /api/v1/knowledge/graph
GET    /api/v1/knowledge/nodes/{id}
GET    /api/v1/knowledge/nodes/{id}/neighbors
```

### `orders` — 3 عملیات

```
POST   /api/v1/orders
POST   /api/v1/orders/{id}/cancel
POST   /api/v1/orders/{orderId}/payments
```

### `ai` — 2 عملیات

```
POST   /api/v1/ai/attachments
POST   /api/v1/ai/chat
```

### `bank` — 2 عملیات

```
GET    /api/v1/bank/sessions/{id}
POST   /api/v1/bank/sessions
```

### `courses` — 2 عملیات

```
GET    /api/v1/courses
GET    /api/v1/courses/{idOrSlug}
```

### `media` — 2 عملیات

```
GET    /api/v1/media/{id}/access
GET    /api/v1/media/{id}/stream
```

### `payments` — 2 عملیات

```
POST   /api/v1/payments/webhook/{provider}
POST   /api/v1/payments/{id}/verify
```

### `pricing` — 2 عملیات

```
GET    /api/v1/pricing/plans
POST   /api/v1/pricing/quote
```

### `references` — 2 عملیات

```
GET    /api/v1/references
GET    /api/v1/references/{idOrSlug}
```

### `anatomy` — 1 عملیات

```
GET    /api/v1/anatomy/assets
```

### `feedback` — 1 عملیات

```
POST   /api/v1/feedback
```

### `healthz` — 1 عملیات

```
GET    /api/v1/healthz
```

### `league` — 1 عملیات

```
GET    /api/v1/league/seasons/{id}/leaderboard
```

### `lesson-pages` — 1 عملیات

```
GET    /api/v1/lesson-pages/{id}
```

### `lessons` — 1 عملیات

```
GET    /api/v1/lessons/{id}
```

### `readyz` — 1 عملیات

```
GET    /api/v1/readyz
```

### `search` — 1 عملیات

```
GET    /api/v1/search
```

### `subjects` — 1 عملیات

```
GET    /api/v1/subjects
```

### `universities` — 1 عملیات

```
GET    /api/v1/universities
```

## پیوست ب — ماتریس واقعی permission (استخراج از `route:list`)

این ۴۰ کلید، تنها مجوزهای **واقعاً استفاده‌شده** در middleware `api.can:*` هستند. تعداد = شمار مسیرهایی که آن کلید را می‌خواهند. deny-by-default: هر مسیر ادمین که هیچ‌یک از این کلیدها را نداشته باشد، ساخته نمی‌شود.

| permission | تعداد مسیر | permission | تعداد مسیر |
|---|---|---|---|
| `articles.update` | 7 | `articles.read` | 6 |
| `articles.publish` | 6 | `references.update` | 4 |
| `references.publish` | 4 | `references.read` | 3 |
| `articles.create` | 3 | `flashcards.read` | 3 |
| `ops.read` | 3 | `ops.manage` | 3 |
| `references.create` | 2 | `categories.read` | 2 |
| `categories.create` | 2 | `categories.update` | 2 |
| `categories.delete` | 2 | `logs.read` | 2 |
| `feedback.read` | 2 | `feedback.manage` | 2 |
| `flashcards.update` | 2 | `flashcards.delete` | 2 |
| `flashcards.create` | 2 | `flashcards.publish` | 2 |
| `intl.read` | 2 | `intl.create` | 2 |
| `intl.update` | 2 | `intl.publish` | 2 |
| `media.delete` | 2 | `notifications.send` | 2 |
| `testbank.read` | 2 | `testbank.publish` | 2 |
| `users.read` | 2 | `analytics.read` | 1 |
| `intl.delete` | 1 | `articles.delete` | 1 |
| `media.read` | 1 | `media.upload` | 1 |
| `testbank.create` | 1 | `testbank.update` | 1 |
| `settings.read` | 1 | `settings.update` | 1 |

**limiterهای نام‌دار throttle:** 79 عدد — از `admin_wiki` (۱۲ مسیر) و `admin_flashcards` (۱۱) تا limiterهای تک‌مسیر مثل `ai_chat`/`ai_chat_ip`. هیچ limiterای بیش از یک مسئولیت ندارد (تلهٔ شناخته‌شدهٔ لاراول: آرایهٔ `Limit` لایهٔ دوم را بی‌اثر می‌کند).

## پیوست پ — موجودی جدول‌ها به تفکیک migration

- `create_cache_table` *(فریم‌ورکی)* → `cache`, `cache_locks`
- `create_jobs_table` *(فریم‌ورکی)* → `jobs`, `job_batches`, `failed_jobs`
- `create_universities_table` → `universities`
- `create_semesters_table` → `semesters`
- `create_users_table` → `users`
- `create_user_profiles_table` → `user_profiles`
- `create_auth_sessions_table` → `auth_sessions`
- `create_admin_rbac_tables` → `admins`, `roles`, `permissions`, `admin_roles`, `role_permissions`
- `create_content_core_tables` → `subjects`, `courses`, `chapters`, `lessons`, `lesson_pages`
- `create_learning_progress_tables` → `learning_progress`, `study_sessions`
- `create_idempotency_keys_table` → `idempotency_keys`
- `create_question_bank_tables` → `question_topics`, `questions`, `question_options`, `question_keys`, `question_attempts`, `question_reports`, `heart_rewards`
- `create_exam_engine_tables` → `exams`, `exam_questions`, `exam_registrations`, `exam_attempts`, `exam_answers`, `exam_results`
- `create_analytics_events_table` → `analytics_events`
- `create_flashcard_tables` → `flashcard_decks`, `flashcards`, `flashcard_states`, `flashcard_reviews`
- `create_wiki_tables` → `wiki_categories`, `wiki_articles`, `wiki_relations`, `wiki_bookmarks`
- `create_knowledge_graph_tables` → `knowledge_nodes`, `knowledge_edges`
- `create_green_path_tables` → `green_paths`, `green_path_steps`
- `create_gamification_tables` → `league_seasons`, `league_memberships`, `xp_transactions`, `achievements`, `user_achievements`, `challenges`, `user_challenges`, `streaks`
- `create_media_table` → `media`
- `create_references_tables` → `references`, `reference_assets`
- `create_anatomy_assets_table` → `anatomy_assets`
- `create_articles_tables` → `article_categories`, `articles`, `article_bookmarks`
- `create_user_notes_tables` → `user_notes`, `review_items`
- `create_study_groups_tables` → `study_groups`, `group_memberships`, `group_retired_codes`
- `create_feedback_tables` → `feedback`, `feedback_replies`
- `create_international_courses_tables` → `international_providers`, `international_courses`
- `create_commerce_tables` → `products`, `product_capabilities`, `plans`, `orders`, `order_lines`, `payments`, `payment_webhooks`, `subscriptions`, `entitlements`
- `create_outbox_events_table` → `outbox_events`
- `create_notifications_tables` → `notifications`, `notification_deliveries`
- `create_search_documents_table` → `search_documents`
- `create_audit_logs_table` → `audit_logs`
- `create_system_settings_table` → `system_settings`
- `create_ai_tables` → `ai_conversations`, `ai_messages`, `ai_daily_usage`

**جمع: 91 جدول در 34 فایل migration.**

### شکاف‌های شناخته‌شده (جدول‌هایی که ساخته نشدند)

۱۴ جدول Media Center / publishing (`media_platforms`, `media_accounts`, `media_contents`, `media_campaigns`, `media_team`, `media_tags`, `media_metrics`, `media_inbox`, `media_mentions`, `media_notifications`, `media_utm`, `media_meta`, `publish_channels`, `publish_logs`) ساخته نشده‌اند و ۲۵ entity قدیمی جدول مقصد ندارند. همچنین `site_pages` و `banners` ساخته نشده‌اند. این‌ها باید پیش از cutover دامنهٔ محتوا تصمیم‌گیری شوند.
