# گزارش فاز ۵ + فاز ۶ — Learning Progress / Study Sessions / Question Bank

> تاریخ: ۳ اکتبر ۲۰۲۶ · محیط: macOS 26.0 · Laravel 13.34 / PHP 8.5.11
> **دامنهٔ اجراشده:** `/api/v1/*` روی سرور Laravel جدید در `backend/`.
> سرور Node قدیمی (`server.js` + `/api/*`) **دست‌نخورده** است.

## خلاصهٔ مدیریتی

| موضوع | وضعیت |
|---|---|
| فاز ۳ (ادمین/RBAC) و فاز ۴ (محتوای آموزشی) | **در `backend/` وجود نداشتند** ⇒ حداقلِ لازم ساخته شد |
| فاز ۵ (پیشرفت + نشست مطالعه) | Implemented + Verified |
| فاز ۶ (بانک سؤال + پاسخ) | Implemented + Verified |
| Exam Engine (فاز ۷) | **ساخته نشد** — عمدی |
| تست‌ها | **۲۶۸ passed / ۲ skipped / ۰ failed (۱۶۶۸ assertion)** |
| Pint | ۲۱۸ فایل PASS |
| OpenAPI v1 | ۲۸ path / ۲۳ schema / ۰ `$ref` معلق |
| PostgreSQL | **اجرا نشد** — سرور PG محلی بالا نیست (زیر «Not Verified») |

---

## Phase 5 — Learning

### Database

| جدول | نقش |
|---|---|
| `learning_progress` | پیشرفت کاربر روی یک **صفحهٔ درس** |
| `study_sessions` | یک بازهٔ واقعی مطالعه |

- `UNIQUE(user_id, lesson_page_id)` · `CHECK(status in ('not_started','in_progress','completed'))`
  · `CHECK(seconds_spent >= 0)` · `CHECK(version >= 1)`
  · `CHECK(duration_sec >= 0)` · `CHECK(ended_at IS NULL OR ended_at >= started_at)`
- FKها `RESTRICT` (رکورد پیشرفت با حذف کاربر/صفحه بی‌صدا یتیم نمی‌شود).
- ایندکس‌ها: `(user_id, status)` · `(user_id, updated_at)` · `UNIQUE(user_id, lesson_page_id)`.
- زمان‌ها `timestamptz` / UTC.
- **`source` باریک‌تر از پیش‌نویس Blueprint:** فقط `lesson` \| `micro_lesson` \| `pomodoro`.
  هر سه در Frontend قابل اثبات‌اند؛ `course`/`manual` هیچ مصرف‌کننده‌ای نداشتند.
- **سه حالت پیشرفت کافی است** — فهرست از Frontend استخراج شد، حالت چهارم اختراع نشد.

### API

| متد | مسیر | پاسخ |
|---|---|---|
| `GET` | `/api/v1/me/progress` | خلاصهٔ **مشتق** (totals + per-course) |
| `GET` | `/api/v1/me/progress/pages/{id}` | صفحه + پیشرفت (رکورد غایب ⇒ شکل «شروع‌نشده»، `version: 0`) |
| `PUT` | `/api/v1/me/progress/pages/{id}` | ۲۰۰ / ۴۰۹ `VERSION_CONFLICT` |
| `POST` | `/api/v1/me/study-sessions` | ۲۰۱ |

- **`completed` سرور-کنترل‌شده است.** کلاینت `completed=true` می‌فرستد ولی سرور
  اول صفحه را اعتبارسنجی می‌کند؛ مقدار `status` از بدنه خوانده نمی‌شود.
- `secondsSpent` یک **دلتا** با سقف config است؛ بیشتر ⇒ ۴۲۲ (نه clamp بی‌صدا).
  clamp دوم در سرویس به‌عنوان دفاع لایه‌ای باقی مانده.
- `lastPosition` **یکنوا نیست** (بازگشت به عقب مجاز)، خارج از بازه ⇒ ۴۲۲.
- `completed` **چسبنده** است: بدون reset صریح (که در این فاز وجود ندارد) برنمی‌گردد.
- **idempotency:** هدر `Idempotency-Key` + جدول `idempotency_keys` با
  `UNIQUE(scope, actor_key, request_key)` و هش payload. همان کلید + همان payload ⇒
  پاسخ بازپخش می‌شود و `seconds_spent` دو بار اضافه **نمی‌شود**؛ همان کلید + payload
  متفاوت ⇒ **۴۰۹ `IDEMPOTENCY_KEY_REUSED`**. تصمیم مستند شد: تضمین race-safe فقط
  در دیتابیس ممکن است، نه با بررسی در حافظه.
- **`userId` در بدنه هیچ اثری ندارد** (تست اختصاصی دارد).
- نشست مطالعه: `startedAt`/`endedAt`/`durationSec` روی **ساعت سرور** اعتبارسنجی
  می‌شوند. ردها: `TIMESTAMP_IN_FUTURE` · `TIMESTAMP_RANGE_INVALID` ·
  `TIMESTAMP_TOO_OLD` · `DURATION_MISMATCH` · `DURATION_TOO_LONG`. مقدار ذخیره‌شده
  همان مدت **مشتق** است، نه عدد کلاینت.
- `GET /users/{id}/progress` **وجود ندارد** (تست قرارداد این را قفل کرده).
- rate limit نام‌دار از config: read ۲۴۰/m · write ۱۲۰/m · session ۶۰/m.

### Security

- مالکیت از **سشن** — تنها منبع. هیچ مسیر/بدنه‌ای هویت تعیین نمی‌کند.
- هر query با `user_id` سشن محدود می‌شود؛ `ProgressPolicy` لایهٔ دفاعی دوم است.
- صفحهٔ نامرئی ⇒ **۴۰۴ نه ۴۰۳** (وجود پیش‌نویس لو نمی‌رود). زنجیرهٔ کامل
  `subject→course→chapter→lesson→page` باید published باشد (`ContentVisibility`).
- `EntitlementGate` بایندش `NullEntitlementGate` با `isEnforcing() === false` است:
  **نقطهٔ توسعهٔ خالی، بدون mock پرداخت.** فاز ۱۸ مالک واقعی است.
- پاسخ هیچ‌وقت `user_id` برنمی‌گرداند (تست محتوایی).

---

## Phase 6 — Question Bank

### Database

`question_topics` · `questions` · `question_options` · `question_keys` ·
`question_attempts` · `question_reports` · `heart_rewards`

- **`question_keys` جداست:** `correct_option_id` و `explanation` در هیچ ستونی از
  `questions`/`question_options` تکرار نشده‌اند ⇒ `SELECT *` اشتباه هم کلید را لو نمی‌دهد.
- `questions.version` از روز اول + `question_keys.key_version` جدا.
  تغییر محتوا ⇒ `version++`؛ تغییر گزینهٔ درست ⇒ `key_version++`.
- `questions.legacy_id UNIQUE` برای crosswalk (`tb-phy-01` …).
- `question_options UNIQUE(question_id, position)`.
- `question_attempts` با CHECK انحصاری `user_id`/`guest_id` — **مهمان هرگز به حساب
  کاربر وصل نمی‌شود.**
- `question_reports` با `kind`/`status` CHECK و `resolved_at`.
- `heart_rewards` با `UNIQUE(user_id, attempt_key)` و `UNIQUE(question_attempt_id)`.
- **حذف فیزیکی سؤال ممنوع** — `status = archived`؛ FKهای `RESTRICT` تحمیل می‌کنند.
- ایندکس‌ها بر پایهٔ کوئری واقعی: `(subject_id,status)` · `(topic_id,status)` ·
  `(difficulty,status)` · `(status)` · `(created_at)` · `(user_id,question_id,answered_at)` ·
  `(guest_id,…)` · `(question_id,answered_at)`.

### Question Security

- **مجموعهٔ کلیدهای JSON عمومی با `assertSame` قفل شده:**
  question = `id, stem, figure_key, type, difficulty, source, track, year, exam_month,
  subject, topic, options` · option = `id, position, label, body`.
  بیرون از آن: `correct_option_id`, `explanation`, `key_version`, `is_correct`,
  `status`, `version`, `legacy_id`, `author_admin_id`, `stats`.
- `QuestionQueryService` در هیچ کوئری مسیر دانشجو `key` را eager-load **نمی‌کند**.
- `GET /questions/{id}` هیچ پارامتر query نمی‌پذیرد ⇒ `?includeAnswerKey=true` **۴۰۰**.
- **بازگشایی فقط پس از پاسخ** — استخراج‌شده از رفتار واقعی
  (`testBankService.js::applyReveal` و `contentStore.js::recordTestBankAnswers`)،
  نه از حدس. با `QUESTION_BANK_REVEAL_AFTER_ANSWER=false` کامل خاموش می‌شود.
- پیش‌نویس/آرشیو در همهٔ مسیرهای دانشجو ⇒ **۴۰۴** (حتی برای ادمین روی مسیر دانشجو).
- **enumeration protection:** `status` فیلتر مجاز نیست؛ هر پارامتر ناشناخته ⇒ ۴۰۰؛
  صفحه‌بندی اجباری با سقف `perPage`.
- `stats`/`option_percents` عمداً در هیچ payload عمومی نیستند (خودشان کلید را لو می‌دهند).

### Grading

- **فقط سمت سرور.** کلاینت فقط `selectedOptionId` را می‌فرستد. بی‌اثر بودن این
  فیلدها تست شده: `isCorrect`, `correctAnswer`, `correctOptionId`, `score`,
  `negativeMarking`, `xp`, `heartReward`, `reward`, `answeredAt`, `question_version`, `userId`.
- تعلق گزینه به سؤال چک می‌شود ⇒ **۴۲۲ `OPTION_NOT_IN_QUESTION`**.
- `answered_at` از ساعت سرور. `timeSpent` clamp می‌شود و بالاتر از سقف ⇒ ۴۲۲.
- `selectedOptionId = null` مجاز است = «بدون پاسخ» (`is_correct = false`)، نه خطا.
- **idempotency:** `attemptKey`. همان کلید + همان payload ⇒ همان `attempt_id`
  (یک Attempt، یک قلب)؛ همان کلید + payload متفاوت ⇒ **۴۰۹**.
- **قلب:** `attemptKey = <questionId>:<floor(now/86400)>`، یکتایی را **دیتابیس**
  تصمیم می‌گیرد (نه کد). فقط پاسخ درست، حداکثر ۱ قلب در روز سرور برای هر سؤال،
  مقدار از config. **قلب ≠ XP**؛ هیچ XP ای تولید نمی‌شود.
- سؤال بدون کلید ⇒ `409 QUESTION_NOT_GRADABLE` (خطای محتوا، نه خطای کاربر).

### API

| متد | مسیر | دسترسی |
|---|---|---|
| `GET` | `/questions` | عمومی، صفحه‌بندی‌شده |
| `GET` | `/questions/{id}` | عمومی |
| `POST` | `/questions/{id}/answers` | دانشجو |
| `POST` | `/questions/{id}/reports` | دانشجو |
| `POST` | `/bank/sessions` | دانشجو |
| `GET` | `/bank/sessions/{id}` | دانشجو (مالک) |
| `GET/POST` | `/admin/questions` | `testbank.read` / `testbank.create` |
| `GET/PATCH` | `/admin/questions/{id}` | `testbank.read` / `testbank.update` |
| `POST` | `/admin/questions/{id}/publish` · `/archive` | `testbank.publish` |

- **`DELETE` وجود ندارد** (۴۰۵ تست شده).
- **Bank Session: جدول `bank_sessions` ساخته نشد.** state گذرا در cache store
  (Redis در production، array در تست) با TTL، شناسهٔ opaque، user-scoped، و انتخاب
  سؤال **کاملاً سمت سرور** (`inRandomOrder`). `questionIds` کلاینت نادیده گرفته
  می‌شود. تصمیم در `BankSessionService` و `docs/question-bank.md` مستند شده است.
- مجوزها **کلیدهای واقعی پنل legacy** (`testbank.*`) هستند؛ هیچ کلید تازه‌ای
  اختراع نشد. `author_admin_id` از سشن ادمین می‌آید.
- `PATCH` نیازمند `version` است ⇒ ۴۰۹ در تعارض. تغییر درس سؤال **قبل از نوشتن**
  رد می‌شود ⇒ ۴۰۹ `SUBJECT_IMMUTABLE` (باگ «نوشتن انجام‌شده + ۴۰۹» رفع شد).
- یکپارچگی روابط: `CHAPTER_SUBJECT_MISMATCH` · `LESSON_CHAPTER_MISMATCH` ·
  `TOPIC_SUBJECT_MISMATCH`. انتشار بدون کلید یا با کلید بیرونی ⇒
  `QUESTION_NOT_PUBLISHABLE`.
- فیلترهای allowlist: `subject, topic (+زیرمبحث‌ها), chapter, lesson, difficulty,
  type, source, track, year, q, sort, page, perPage`. جست‌وجو `ILIKE` روی PG و
  `LIKE` روی بقیه — **بدون ادعای indexed search** (wildcard ابتدایی index-free است
  و این در کد کامنت شده).

---

## Tests

| سوییت | تعداد |
|---|---|
`ProgressTest` | ۲۴ |
`StudySessionTest` | ۱۶ |
`LearningFlowIntegrationTest` (۶ سناریوی سرتاسری) | ۶ |
`QuestionBankReadTest` | ۱۴ |
`AnswerKeyIsolationTest` | ۷ |
`QuestionAnswerTest` | ۱۵ |
`QuestionReportTest` | ۹ |
`BankSessionTest` | ۱۴ |
`AdminQuestionCrudTest` | ۲۴ |
`CreateAdminCommandTest` | ۷ |
`ApiV1ContractTest` (توسعه‌یافته به سطح فاز ۱–۶) | ۹ |

**نتیجهٔ اجرای کامل:** `268 passed, 2 skipped, 1668 assertions, 0 failed`.
۲ skip همان تست‌های سرویس‌محور قبلی هستند که PostgreSQL/Redis زنده می‌خواهند.

**بازاجرای تأییدی (۲۰۲۶-۱۰-۰۳، همین نوبت):** `php artisan test` ⇒
`268 passed, 2 skipped, 1668 assertions, 0 failed` (۱۳٫۱۱s). هیچ رگرسیونی نیست.

**دروازه‌های legacy که پس از این تغییرات اجرا شدند:**
`npm run api:contract:check` ⇒ **۲۳۰ مسیر · ۲۸ کد خطا · ۰ نقض** ·
`npm run api:openapi:check` ⇒ **۲۳۰ مسیر · ۱۶۶ path · هم‌گام** ·
`npm run v1:contract:check` ⇒ **۱۷ بررسی سبز · ۰ شکست**.
`npm run data:check` ⇒ ۲۲ خطا/۲۳ هشدار **از پیش موجود** (بخش Legacy).

### اجرای واقعی روی PostgreSQL 17 و Redis (۲۰۲۶-۱۰-۰۳)

خوشهٔ موقت PG 17.11 روی `/tmp` (`initdb` + `pg_ctl`، پورت 55432) و Redis روی
پورت 56379 بالا آمدند؛ سپس:

| اجرا | نتیجه |
|---|---|
| `migrate:fresh` روی PG | ✅ ۱۳ migration، ۳۱ جدول، exit 0 |
| `migrate:rollback` (همه) | ✅ exit 0 |
| `migrate` دوباره | ✅ exit 0 |
| `php artisan test` روی **PG + cache آرایه** | ✅ **۲۶۸ passed / ۲ skipped / ۰ failed (۱۶۶۸ assertion)** |
| `php artisan test` روی SQLite (پس از همان تغییرات) | ✅ ۲۶۸ passed / ۲ skipped / ۰ failed — بدون رگرسیون |
| `backend/scripts/verify-on-pg.sh` (PG + Redis واقعی) | ✅ **۲۷۰ passed / ۰ skipped / ۱۶۷۱ assertion** |
| `vendor/bin/pint --test` پس از همان اجرا | ✅ ۲۱۸ فایل PASS |
| `ServiceIntegrationTest` با `TAPESH_TEST_PGSQL_HOST` | ✅ `postgresql connection when service available` |
| `ServiceIntegrationTest` با `TAPESH_TEST_REDIS=1` | ✅ `redis roundtrip when service available` |

⇒ **هر دو skip قبلی حالا با سرویس واقعی سبز می‌شوند** (۲۶۸+۲ ⇒ ۲۷۰ passed، صفر
skip). روی PG و SQLite عدد تست دقیقاً یکسان است.

این مسیر **تکرارپذیر** است: `backend/scripts/verify-on-pg.sh` خودش خوشهٔ موقت PG
و Redis را می‌سازد، `migrate:fresh` → `rollback` → `migrate` و کل سوییت و Pint را
اجرا می‌کند، و با `trap … EXIT INT TERM` همیشه سرویس‌ها را می‌بندد و `/tmp` را پاک
می‌کند. جزئیات: `backend/docs/development.md`.

### چهار باگ واقعی که فقط با اجرای PG پیدا شد (و رفع شد)

۱. **`question_topics.parent_id` خودارجاع روی PG migrate را می‌شکست.**
   `SQLSTATE[42830] there is no unique constraint matching given keys`.
   علت: لاراول `->primary()` را به‌شکل `alter table … add primary key` و **پس از**
   همهٔ FKهای همان `Schema::create` کامپایل می‌کند. رفع: FK خودارجاع به
   `Schema::table()` بعد از ساخت جدول منتقل شد.
   (`database/migrations/2026_10_03_000500_…`)

۲. **`IdempotencyService::reserve()` روی PG بازپخش را می‌شکست.**
   `SQLSTATE[25P02] current transaction is aborted` — چون پس از شکستِ INSERT،
   `replayOrConflict()` بلافاصله SELECT می‌زند و روی PG تراکنش abort شده است.
   رفع: INSERT داخل `DB::transaction()` (⇒ savepoint) بسته شد.
   ۶ تست (Progress/StudySession/QuestionAnswer/LearningFlow) از این راه سبز شدند.

۳. **`GET /courses/{idOrSlug}` با slug روی PG ۵۰۰ می‌داد.**
   `SQLSTATE[22P02] invalid input syntax for type uuid: "course-vel-dolorem"`.
   رفع: مقایسهٔ `id` فقط وقتی ورودی `Str::isUuid()` باشد؛ همیشه با `slug` مقایسه می‌شود.

۴. **تایم‌زون سشن PG با اپ یکی نبود ⇒ همهٔ `timestamptz`ها ۳:۳۰ جابه‌جا ذخیره می‌شدند.**
   `config('app.timezone')` = UTC ولی `initdb` تایم‌زون سرور را Asia/Tehran می‌گذارد و
   لاراول رشتهٔ ساعت دیواری UTC را می‌فرستد؛ PG آن را در تایم‌زون **سشن** تفسیر می‌کند.
   علائم: `answered_at > now()` بی‌دلیل false می‌شد.
   رفع: `'timezone' => env('DB_TIMEZONE', 'UTC')` در اتصال pgsql — **تنظیم اجباری، نه اختیاری.**

علاوه بر این، قید `whereUuid` روی همهٔ پارامترهای `{id}` در `routes/api.php` اضافه شد
(جز `courses/{idOrSlug}`) تا شناسهٔ بدشکل روی PG به **۴۰۴** بخورد نه ۵۰۰.
و در `DataIntegrityTest` هر نقض عمدی داخل savepoint اجرا می‌شود تا شمارش بعدی روی PG نشکند.

### Redis و تست‌ها — یک محدودیت واقعی

اجرای کل سوییت با `CACHE_STORE=redis` **شکست می‌دهد** (۱۶۰ خطا، اکثراً ۴۲۹ و در
ادامه‌اش ۴۰۱). این باگ محصول نیست: `phpunit.xml` عمداً `CACHE_STORE=array` را قفل
می‌کند چون شمارنده‌های rate limit با کش پایدار **بین تست‌ها** باقی می‌مانند و هر تست
سهمیهٔ تست بعدی را می‌سوزاند. یعنی سوییت برای کش پایدار طراحی نشده است.
`Redis` خودش با `TAPESH_TEST_REDIS=1` تأیید شد (roundtrip سبز).


پوشش تست‌های الزامی سند: create/update/complete صفحه · update تکراری · نسخهٔ
کهنه · صفحهٔ نامعتبر · کاربر ناشناس · cross-user · ثانیهٔ نامعتبر · timestamp آینده ·
مدت نجومی · مالکیت · یکپارچگی تراکنش · idempotency · ۴۰۹ کلید تکراری با payload
متفاوت · IDOR پیشرفت · سؤال پیش‌نویس · نشت کلید · گزینهٔ سؤال دیگر · دست‌کاری
`isCorrect` · ویرایشگر غیرمجاز · سؤال خصوصی ناشناس · `negativeMarking` · XP ·
rate limit · enumeration.

**دو باگ واقعی که فقط با تست پیدا شد (و رفع شد):**
1. `bootstrap/app.php` برای `api.admin`/`api.can` ایمپورت نداشت ⇒ هر مسیر پنل با
   `BindingResolutionException` می‌شکست. (`route:list` آن را نشان نمی‌داد.)
2. جدول‌های واسط `admin_roles`/`role_permissions` ستون `id` اجباری داشتند ولی
   `belongsToMany::attach()/sync()` آن را پر نمی‌کند ⇒ **هر assignRole می‌شکست**
   (روی PostgreSQL هم، نه فقط SQLite). به کلید مرکب تغییر کرد.

---

## Performance

- صفحه‌بندی اجباری روی هر فهرست؛ سقف `perPage` از config.
- eager loading صریح با انتخاب ستون‌های لازم (`subject:id,slug,title` و …) — بدون N+1.
- خلاصهٔ پیشرفت با **۲ کوئری aggregate** (`groupBy` در SQL)، نه حلقه در PHP.
- مخرج `percent` با یک کوئری `pluck` برای همهٔ دوره‌ها، نه per-course.
- ایندکس‌ها بر پایهٔ کوئری واقعی؛ هیچ ایندکس «شاید لازم شود» ساخته نشد.
- **`EXPLAIN (ANALYZE)` روی PostgreSQL 17 اجرا شد** — روی دادهٔ ساختگی
  (۲۰۰۰ سؤال · ۸۰۰۰ گزینه · ۱۵۰ پیشرفت · ۳۰۰ نشست · ۵۰۰۰ تلاش · `ANALYZE`).

| کوئری | برنامهٔ واقعی | زمان |
|---|---|---|
| خلاصهٔ پیشرفت (تجمیع) | `Aggregate` روی `Seq Scan learning_progress` (۱۵۰ ردیف) | ۰٫۰۶ms |
| تجمیع دوره‌ها (۵ join) | `HashAggregate` + `Nested Loop` (۱۵۰ ردیف) | ۰٫۱۲ms |
| فهرست سؤال + فیلترها | **`Index Scan Backward using questions_status_created_at_index`** + `Incremental Sort` | ۰٫۰۵ms |
| جست‌وجوی `ILIKE` | `Seq Scan` (۲۰۰۰ ردیف) — بدون ایندکس | ۰٫۰۱ms |
| تلاش‌های یک کاربر روی یک سؤال | **`Index Scan … question_attempts_user_id_question_id_answered_at_index`** | ۰٫۰۱ms |
| نشست‌های مطالعهٔ کاربر | **`Index Scan … study_sessions_user_id_started_at_index`** | ۰٫۰۲ms |
| جست‌وجوی idempotency | `Seq Scan` روی جدول خالی (ایندکس یگانه وجود دارد) | ۰٫۰۱ms |
| انتخاب تصادفی Bank Session | `Seq Scan` + `top-N heapsort` (۱۸۰۰ ردیف) | ۰٫۷۲ms |

دو نکتهٔ صادقانه:
- `Seq Scan` روی خلاصهٔ پیشرفت و idempotency **انتظاری** است: در این دیتاست همهٔ
  ردیف‌ها به یک کاربر تعلق دارند (۱۵۰ ردیف) و جدول کلید خالی است؛ ایندکس‌ها
  ساخته شده‌اند و در مقیاس واقعی انتخاب می‌شوند.
- `order by random()` در Bank Session کل مجموعهٔ منتشرشده را می‌خواند. در
  ۱۸۰۰ ردیف ۰٫۷۲ms است؛ با بانک بزرگ‌تر این تنها نقطهٔ مقیاس‌پذیری شناخته‌شدهٔ
  فاز ۶ است (راه‌حل آینده: نمونه‌گیری بر پایهٔ کلید، بدون تغییر قرارداد).


## Frontend

پل مرزی v1 ساخته شد — **کد اجراشدنی، ولی UI عمداً به آن سوئیچ نشده** (پایین توضیح).

**فایل‌های تازه:**
- `src/services/api/v1.js` — تنها نقطهٔ تماس فرانت با `/api/v1/*`. envelope فاز ۱ را
  اعتبارسنجی می‌کند (`data`/`error` + `requestId`) و اگر پاسخ JSON معتبر نبود
  `reason: 'not_v1'` برمی‌گرداند. **چرا حیاتی است:** سرور Node هر مسیر ناشناختهٔ
  `/api/v1/*` را به SPA fallback می‌فرستد ⇒ ۲۰۰ با HTML؛ بدون این گارد، کاربرِ
  واردشده بی‌صدا دادهٔ خالی می‌بیند. CSRF double-submit (`tapesh_csrf` +
  `X-CSRF-Token`) و `Idempotency-Key` هم اینجا مدیریت می‌شوند.
- `src/services/learning/progressV1.js` — `GET/PUT /me/progress*` و
  `POST /me/study-sessions`. `secondsSpent` به‌عنوان **دلتا** پاس می‌شود، `version`
  اجباری است، ۴۰۹ ⇒ `{ conflict: true }` برای refetch. `mastery` در v1 وجود ندارد
  و `null` برمی‌گردد — **عدد ساختگی ساخته نمی‌شود**.
- `src/services/testBank/testBankV1.js` — فهرست/جزئیات سؤال، پاسخ، گزارش، Bank Session.
  `buildQuestionQuery()` فیلتر UI را به query مجاز v1 نگاشت می‌کند و هر فیلتری که v1
  نمی‌تواند بیان کند (چندانتخابی، بازهٔ سال، `tags`، `status`) را در `unsupported`
  **اعلام** می‌کند، نه بی‌صدا حذف.
- `scripts/v1-frontend-contract.mjs` + `npm run v1:contract:check` — قفل قرارداد.

**قفل قرارداد (`v1:contract:check` ⇒ ۱۷ بررسی سبز / ۰ شکست):**
1. هر فیلدی که پل مصرف می‌کند در OpenAPI v1 وجود دارد (اگر سرور نامی را عوض کند،
   تست می‌شکند نه اینکه UI بی‌صدا `undefined` ببیند).
2. `Question`/`QuestionOption`/`BankSession` **هیچ** فیلد کلید/متادیتای داخلی ندارند
   (`correct_option_id`, `explanation`, `stats`, `version`, …).
3. هر شناسهٔ snake_case داخل پل‌ها در فهرست اعلام‌شدهٔ اسکریپت هست ⇒ اسکریپت از
   کد عقب نمی‌افتد.

**ناسازگاری‌های واقعی که صریح مدیریت شدند (نه مخفی):**
- `stats` (تعداد حل / درصد پاسخ صحیح / میانگین زمان) در v1 **عمومی نیست** — توزیع
  پاسخ‌ها خودش کلید را لو می‌دهد. پل `{ solves: 0, correctPercent: null, avgTimeSec: null }`
  می‌دهد تا ویجت آمار خودش را پنهان کند.
- `topicPath` فقط یک عضو دارد: `QuestionResource` برگ موضوع را می‌دهد، نه زنجیرهٔ والدها.
- `tags` خالی است: v1 در فاز ۶ برچسب عمومی ندارد (بدون مصرف‌کنندهٔ واقعی).

**چرا UI سوئیچ نشد:** مسیر پاسخ legacy با **اندیس گزینه** کار می‌کند
(`POST /api/users/test-bank/answers` + `correctAnswer` به‌صورت index) ولی v1 با
**UUID گزینه** (`selectedOptionId` + `reveal.correct_option_id`). تا وقتی فهرست سؤال
از منبع legacy می‌آید، UUID گزینه‌ها وجود ندارد ⇒ نیمه‌وصل‌کردن، پاسخ‌ها را بی‌صدا
خراب می‌کند. سوئیچ یک تغییر اتمی روی کل زنجیره است و **به cutover وابسته است، نه به
این فاز**. بنابراین: قرارداد **verified**، اتصال **انجام‌نشده** — و همین‌طور گزارش می‌شود.

- **مهاجرت localStorage انجام نشد و خودکار هم نیست.** قلب/پاداش محلی هرگز خوانده
  نمی‌شود، هیچ Attempt ای از state محلی ساخته نمی‌شود، و هیچ XP/پول/پاداشی از دادهٔ
  محلی مشتق نمی‌شود.
- **تست رابط کاربری اجرا نشد** (طبق درخواست صریح).
- به‌روزرسانی خوش‌بینانهٔ UI: قرارداد برای آن آماده است — ۴۰۹ ⇒ refetch، و سرور
  هرگز برای رضایت UI یکپارچگی را فدا نمی‌کند.
- **دو نویسندهٔ هم‌زمان ساخته نشد:** چون UI وصل نشده، تنها نویسندهٔ
  `learning_progress`/`question_attempts` هنوز هیچ مصرف‌کنندهٔ زنده‌ای ندارد.


## Legacy

- سرور Node (`server.js`, `database/usersApi.js`, `database/examApi.js`,
  `database/models/`, `database/apiContract/`) **دست‌نخورده**.
- `docs/api/openapi.json` (legacy) دست‌نخورده. `backend/docs/openapi.v1.json` فایل جداست.
- تصحیح legacy حذف نشد؛ `/api/users/test-bank/grade` سر جایش است.
- کلیدهای مجوز، واژگان (type/difficulty/source/track)، ساختار مبحث و قاعدهٔ قلب
  **کپی دقیق** رفتار legacy هستند، نه بازتعریف.
- **دو نویسندهٔ هم‌زمان وجود ندارد:** Frontend هنوز به `/api/*` (Node) می‌زند؛
  سطح v1 به Frontend وصل نشده. crosswalk فقط طراحی شده (`legacy_id`).
- `npm run data:check` روی دادهٔ legacy امروز **۲۲ خطا / ۲۳ هشدار** می‌دهد که
  **از این نوبت نیست**: `notes.authorId → admins.id` (۱۱ یتیم) و
  `activity.userId → admins.id` (۱۹ یتیم). `mtime` فایل‌ها پیش از این نوبت است
  (`admins.json` ۲۰۲۶-۱۰-۰۱ · `notes.json` ۲۰۲۶-۱۰-۰۲) و این نوبت هیچ فایل داده‌ای
  را ننوشت. یکپارچگی دادهٔ legacy خارج از دامنهٔ این فاز است و دست نخورد.

## Migration

- ۵ migration تازه، همه `up`/`down` دارند و **روی SQLite فایلی واقعی** و
  **روی PostgreSQL 17.11 واقعی** اجرا، rollback و دوباره اجرا شدند
  (۱۳ migration، ۳۱ جدول نهایی، exit 0 در هر سه مرحله روی هر دو موتور).
  (پیش از رفع باگ خودارجاعی `question_topics`، مهاجرت روی PG **می‌شکست** —
  جزئیات در بخش Tests.)

- seeder روی همان دیتابیس واقعی اجرا شد: `UniversitySeeder` + `AdminRbacSeeder`
  (۳ نقش، ۸۰ مجوز) — **هیچ ادمینی ساخته نشد**.
- `tapesh:admin:create qa-editor --role=editor` روی دیتابیس واقعی اجرا شد و ادمین
  ساخت (خروجی تأیید شد).
- expand/backfill/switch/contract: **مهاجرت داده انجام نشد** (داده‌ای برای بردن
  نبود). هیچ dual-writer و هیچ backfill ساخته نشد.
- هیچ شمارش ردیف/orphan/duplicate/checksum روی دادهٔ legacy محاسبه نشد، چون
  مهاجرت داده در این نوبت انجام نشد.

## Not Verified

- **PostgreSQL:** ~~اجرا نشد~~ ⇒ **اجرا شد** (۲۰۲۶-۱۰-۰۳). migration، rollback،
  ۲۶۸ تست، `ServiceIntegrationTest` و ۸ کوئری `EXPLAIN (ANALYZE)` همه روی PG 17.11.
  جزئیات و ۴ باگ پیدا‌شده در بخش Tests. آنچه هنوز تأیید نشده: **بار واقعی** و
  **حجم واقعی** (دیتاست ۲۰۰۰ سؤالی ساختگی است، نه دادهٔ production).
- **Redis:** تأیید شد (`redis roundtrip when service available` سبز). **اما**
  اجرای کل سوییت با `CACHE_STORE=redis` کار نمی‌کند — دلیل در بخش Tests
  (شمارنده‌های rate limit بین تست‌ها باقی می‌مانند). Bank Session روی Redis واقعی
  جداگانه تست نشد، فقط روی cache store با درایور آرایه.

- **مرز دقیق rate limit:** اندازه‌گیری شد که در محیط تست با cache آرایه‌ای،
  limiter با `max = N` تعداد **N+1** درخواست را می‌پذیرد و بعد ۴۲۹ می‌دهد. این
  معنای `ThrottleRequests`/`RateLimiter` لاراول است، نه منطق ما؛ تست روی
  «سقف از config می‌آید + ۴۲۹ با کد `RATE_LIMITED` + هیچ نوشتنی گم نمی‌شود» قفل
  شده و عدد مرز را hardcode نمی‌کند.
- **تست رابط کاربری:** اجرا نشد (درخواست صریح).
- **همگام‌سازی Frontend با v1:** پل مرزی + قفل قرارداد ساخته شد
  (`v1:contract:check` سبز) ولی **UI به v1 سوئیچ نشد** — دلیل در بخش Frontend.
- **آزمون رفتار واقعی پل‌ها:** پل‌ها با OpenAPI سنجیده شدند، **نه با سرور زندهٔ v1**
  (Laravel روی دامنه سرو نمی‌شود). هیچ درخواست واقعی از پل به v1 نرفت.
- **CI:** `.github/workflows/backend-ci.yml` نوشته شده ولی اجرا نشده.
- **CRUD ادمین محتوا (فاز ۴):** ساخته نشد؛ محتوا فعلاً فقط خواندنی است.
- **پنل بررسی گزارش‌ها:** ساخته نشد (فقط ثبت گزارش).
- **آمار سؤال (`stats`/`option_percents`):** محاسبه نشد.
- **FTS/trigram:** پیاده نشد.
- **مهاجرت ۵۹ سؤال seed و درخت مبحث:** انجام نشد.

## Known Risks

1. ~~**PG بدون تأیید**~~ ⇒ **بسته شد (۲۰۲۶-۱۰-۰۳)**: PG 17.11 واقعی، ۲۶۸ تست سبز،
   `EXPLAIN` اجرا شد، و ۴ باگ PG-only پیدا و رفع شد. ریسک باقی‌مانده در همین محور:
   - خوشهٔ تست **موقت** بود (`/tmp`، پورت 55432، `-A trust`). روی خوشهٔ production
     با احراز هویت/SSL واقعی اجرا نشده.
   - `DB_TIMEZONE=UTC` اکنون پیش‌فرض اتصال است؛ هر محیطی که عمداً تایم‌زون دیگری
     بخواهد باید آن را صریح ست کند، وگرنه همان جابه‌جایی زمانی برمی‌گردد.
   - بار و حجم واقعی سنجیده نشد (دیتاست ۲۰۰۰ سؤالی).

2. **کلید پاسخ در یک جدول اما در همان دیتابیس** — اگر روزی کسی مسیر جدیدی بدون
   `QuestionResource` بنویسد، تست `AnswerKeyIsolationTest` می‌شکند. این عمدی است.
3. **جست‌وجوی index-free** — با رشد بانک، `q` می‌تواند کند شود. مهار فعلی:
   `perPage` سقف‌دار + صفحه‌بندی + rate limit.
4. **Bank Session در cache** — با `CACHE_STORE=array` در production کار نمی‌کند
   (سشن‌ها بین درخواست‌ها گم می‌شوند). باید Redis باشد. این یک الزام عملیاتی است،
   نه باگ کد.
5. **off-by-one مرز rate limit** — مستند و تست‌شده، ولی علتش در سطح فریم‌ورک است.
6. **`must_change_password`** در مسیر ورود ادمین اجبار نمی‌شود؛ فقط برگردانده
   نمی‌شود. اگر سیاست «تغییر اجباری رمز اولین ورود» لازم است، فاز بعدی باید آن را
   اجرا کند.
7. **بدون CI اجراشده و بدون staging** — هیچ دروازهٔ خودکاری جلوی regression را
   نمی‌گیرد مگر اجرای دستی `php artisan test`.
8. **سوئیچ Frontend به v1 یک تغییر اتمی است، نه تدریجی.** مسیر پاسخ legacy با
   اندیس گزینه کار می‌کند و v1 با UUID گزینه. تا وقتی فهرست سؤال از منبع legacy
   می‌آید، وصل‌کردن پاسخ به v1 پاسخ‌ها را بی‌صدا خراب می‌کند. ترتیب درست:
   ابتدا فهرست سؤال (و درخت مبحث/درس)، سپس پاسخ، سپس گزارش.
9. **پنل بررسی گزارش‌ها در v1 نیست** — در legacy گزارش‌ها به `/api/admin/feedback`
   می‌رفتند (مجوز `feedback.read`/`feedback.manage`). ستون `status` از روز اول
   درست مدل شده و endpoint فهرست/تغییر وضعیت در فاز بعدی فقط لایهٔ نازک است.
   **هیچ endpoint ادمینی بدون مصرف‌کنندهٔ واقعی ساخته نشد.**
10. **Audit در `backend/` فعال نیست** — عملیات ادمین روی سؤال audit نمی‌شود
    (در legacy فقط `examAudit.json` وجود دارد). §۷۲ مشروط به «فعال بودن
    زیرساخت Audit» است و در این بک‌اند فعال نیست.
11. **`whereUuid` یک تغییر رفتار عمدی است** — هر پارامتر `{id}` در v1 اکنون باید
    UUID باشد وگرنه مسیر match نمی‌شود (۴۰۴). این با قرارداد OpenAPI یکی است و
    قبلاً هم روی SQLite نتیجهٔ ۴۰۴ می‌داد؛ فقط روی PG از ۵۰۰ به ۴۰۴ تغییر کرد.
    `courses/{idOrSlug}` عمداً مستثناست.
12. **سوییت تست با کش پایدار سازگار نیست** — `CACHE_STORE` در تست‌ها باید `array`
    بماند. اگر روزی کسی آن را روی `redis` بگذارد، شمارنده‌های rate limit بین
    تست‌ها نشت می‌کنند و ۱۶۰ تست قرمز می‌شوند (بدون هیچ باگ محصولی).


## Phase 7 Readiness

معماری آمادهٔ Exam Engine است، **بدون اینکه چیزی از فاز ۷ ساخته شده باشد:**

- `questions.version` و `question_keys.key_version` از روز اول وجود دارند ⇒
  snapshot آزمون می‌تواند «نسخهٔ سؤالی که دانشجو دیده» را ثابت نگه دارد.
- `question_attempts` **جدا** از `exam_attempts` است؛ هیچ ستون یا رفتاری قاطی نشده.
- `question_attempts.guest_id` + CHECK انحصاری آماده است ⇒ آزمونک مهمان بدون
  migration اضافه می‌شود.
- `question_reports` از روز اول `status`/`resolved_at` دارد ⇒ پنل بررسی فقط
  endpoint اضافه می‌کند.
- `idempotency_keys` عمومی است (scope-based) و برای ثبت‌نام/ارسال آزمون هم قابل
  استفاده است.
- رویدادهای دامنه‌ای (`QuestionAnswered` و …) شناسهٔ حداقلی حمل می‌کنند ⇒ side
  effect های فاز ۷/۱۴ با outbox/afterCommit اضافه می‌شوند، بدون تغییر نویسنده‌ها.
- `test_no_exam_engine_route_exists_in_this_phase` قفل کرده که هیچ مسیری با
  `exam` بی‌صدا وارد نشود.
