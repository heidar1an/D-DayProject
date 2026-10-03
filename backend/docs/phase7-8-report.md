# گزارش فاز ۷ و ۸ — موتور آزمون و تحلیل‌ها

تاریخ: ۳ اکتبر ۲۰۲۶ · Laravel 13.34.0 · PHP 8.5.11 · PostgreSQL 17.11 · Redis

اسناد تفصیلی: `exam.md` (فاز ۷) · `analytics.md` (فاز ۸) · `openapi.v1.json`.

---

# فاز ۷ — موتور آزمون

## ۱. معماری آزمون

**سه مرز دامنه، بدون جابه‌جایی:**

| دامنه | مالک |
|---|---|
| Question Bank (فاز ۶) | `questions`, `question_options`, `question_keys`, `question_attempts` |
| **Exam Engine (فاز ۷)** | `exams`, `exam_questions`, `exam_registrations`, `exam_attempts`, `exam_answers`, `exam_results` |
| Analytics (فاز ۸) | هیچ — فقط مصرف‌کننده |

**بدون جدول تکراری.** پیش از ساخت، خروجی واقعی فازهای ۱–۶ audit شد؛ سؤال، گزینه
و کلید از فاز ۶ مصرف می‌شوند و بازسازی نشدند.

**بدون سه موتور جدا.** `kind` ∈ `quiz` | `personal` | `coordinated` | `international`
تنها تمایز موتور است. مقادیر از UI واقعی استخراج شدند
(`coordinatedExamService.TYPE_META`, `examBuilderService`, `internationalService`,
`examApi.js`). `type` نمایشی ریزتر در ستون جدا و **بی‌اثر در تصمیم موتور**.

**رفتار legacy اول بازمهندسی شد:** `database/examApi.js`, `examStore.js`,
`examPhase()`, `gradeAttempt()`, `sanitizeReason()`, `graceSeconds`,
`releaseGate`, `sweepExpiredAttempts`, `Math.min(spent, duration*60)`. هر تصمیم
معماری به یک رفتار واقعی ارجاع دارد یا صریحاً به‌عنوان «انحراف» علامت خورده.

**بدون endpoint ادمین.** پنل فعلی مصرف‌کنندهٔ واقعی CRUD آزمون ندارد. مدل داده،
`created_by_admin_id`, `version` و `rules_version` آماده‌اند.

## ۲. دیتابیس

مهاجرت `2026_10_03_000600_create_exam_engine_tables.php` — ۶ جدول، ۱۵ CHECK،
۵ قید یکتایی، ۱۲ ایندکس.

**قیدهای کلیدی:**

| قید | چرا |
|---|---|
| `exam_attempts_principal_exclusive` | `(user_id NOT NULL AND guest_id NULL) OR (user_id NULL AND guest_id NOT NULL)` — آمادهٔ آزمونک مهمان |
| `exam_attempts_deadline_after_start` | `deadline_at >= started_at` |
| `UNIQUE(exam_id, user_id, attempt_no)` | سهمیهٔ Attempt |
| `UNIQUE(submit_key) WHERE NOT NULL` | idempotency پایان |
| `UNIQUE(exam_id, question_id) WHERE question_id IS NOT NULL` | سؤال تکراری در آزمون |
| `UNIQUE(attempt_id)` روی `exam_results` | **یک نتیجه در هر Attempt** |
| `UNIQUE(attempt_id, exam_question_id)` روی `exam_answers` | یک پاسخ در هر سؤال |
| FKها `RESTRICT` | حذف تصادفی سؤال/کاربر تاریخچهٔ آزمون را از بین نمی‌برد |
| `exams_negative_marking_range` | `-1 ≤ negative_marking ≤ 0` |

**قیدهای جزئی (`WHERE ... IS NOT NULL`)** لازم‌اند چون PG و SQLite مقادیر NULL را
در UNIQUE با هم یکتا حساب نمی‌کنند. بدون این، یا سؤال تکراری ممکن می‌شد یا
`submit_key` تهی برای همه تصادم می‌کرد.

**قاعدهٔ JSONB در برابر ستون.** `rules` سطل زباله نیست: هر قاعده‌ای که در کوئری
مصرف می‌شود ستون دارد (`duration_minutes`, `grace_seconds`, `attempt_limit`,
`negative_marking`, `question_count`, `rules_version`, `version`). `rules` فقط
تنظیمات نمایشی/غیر‌کوئری‌محور را نگه می‌دارد. `rules_version` با هر تغییر معنایی
بالا می‌رود.

**پورتاپیلیتی.** `CreatesPortableTables` با `isSqlite()`/`addCheck()`: روی SQLite
CHECK داخل `CREATE TABLE`، روی PG با `ALTER TABLE`. یک مسیر، دو dialect، **بدون
انحراف schema**.

## ۳. Snapshot

`exam_questions.render_snapshot` (JSONB) + `key_snapshot_encrypted` (text) عکس
لحظهٔ **انتشار**اند.

- ویرایش بعدی سؤال در بانک سؤال، Attempt قدیمی را تغییر نمی‌دهد — نه صورت، نه
  گزینه، نه کلید. `question_version` نسخهٔ لحظهٔ snapshot را ثبت می‌کند.
- **پاسخ snapshot-local است:** `exam_answers.selected_option_id` شناسهٔ درون
  `render_snapshot` است، نه `question_options`. FK به `question_options` عمداً
  **نیست** — Snapshot باید از بانک سؤال مستقل بماند. گزینهٔ متعلق به Attempt دیگر
  ⇒ **۴۲۲ `OPTION_NOT_IN_ATTEMPT`**.
- **کلید رمزنگاری‌شده:** cast `encrypted` لاراول (AES-256-GCM، کلید `APP_KEY`).
  `ExamQuestion::$hidden` ستون را پنهان می‌کند و Resource ها serialize نمی‌کنند.
  درج دسته‌ای از cast عبور می‌کند ⇒ در `ExamSnapshotService` صریحاً
  `Crypt::encryptString()` استفاده می‌شود.
- **هیچ Secret در ریپو نیست و کلید hardcode نشده.**
- ⚠️ **چرخش `APP_KEY` نیازمند re-encrypt این ستون است** — ریسک مستندشده.

## ۴. زمان‌بندی

`ExamPhaseResolver` فاز را **فقط از ساعت سرور** مشتق می‌کند: `DRAFT` · `ARCHIVED` ·
`SCHEDULED` · `LIVE` · `GRACE` · `FINISHED` · `RESULTS` · `AVAILABLE`. همان
برچسب‌های `uiStatus` legacy برمی‌گردد (`UPCOMING`, `REGISTRATION_OPEN`,
`REGISTRATION_CLOSED`, `LIVE`, `FINISHED`, `RESULTS_AVAILABLE`, `AVAILABLE`,
`CANCELLED`) تا UI بدون تغییر بماند.

**تفاوت عمدی با legacy:** ستون `status` به‌عنوان **دروازهٔ محدودکننده** اضافه شد —
می‌تواند آزمون را ببندد یا آرشیو کند، ولی **هرگز زودتر از زمانش باز نمی‌کند**.
legacy همه‌چیز را از زمان مشتق می‌کرد و ادمین هیچ کنترلی نداشت.

- `deadline_at` = `started_at + duration_minutes` (clamp با `closes_at`)، **سرور**.
- پنجرهٔ گریس: پاسخ تا `deadline_at`، **ارسال** تا `deadline_at + grace_seconds`
  (۳۰s). همان `graceSeconds` legacy.
- `time_spent_sec` با `min(duration×60, deadline−started)` **clamp** می‌شود (همان
  `Math.min` legacy).
- **هیچ ستون زمانی از بدنهٔ درخواست نوشته نمی‌شود.** `startedAt`/`deadlineAt`/
  `submittedAt`/`answeredAt` در `rules` نیستند و ارسالشان بی‌اثر است
  (تست: `deadline == started + 30min` می‌ماند).
- همهٔ ستون‌ها `timestamptz` و `config('database.connections.pgsql.timezone')`
  صریح `UTC`.

## ۵. تصحیح

`ExamGrader` **تنها جایی است که نمره محاسبه می‌شود.** Controller هرگز grading
نمی‌کند. ورودی فقط دادهٔ سرور: سؤال از **Snapshot** (نه بانک زنده)، پاسخ از
`exam_answers`، سیاست از ستون `negative_marking` (نه بدنه).

```
score      = Σ weight × ( درست ? 1 : (نادرست ? negative_marking : 0) )
maxScore   = Σ weight
percentage = clamp( round(score/maxScore × 1000)/10 , 0 , 100 )
```

با `weight = 1` دقیقاً به فرمول legacy فرو می‌کاهد: `score = correct + wrong×neg`.
**فرمول تازه‌ای اختراع نشد.** تعمیم وزن از خود schema می‌آید.

- بی‌پاسخ: نه امتیاز، نه جریمه — فقط `blank_count`.
- `subject_breakdown` (تنها مصرف JSONB در نتیجه) نزولی بر `percent`.
- تصحیح **همگام و در همان تراکنش `finish`** ⇒ حالت میانی `submitted` هرگز persist
  نمی‌شود؛ به همین دلیل `pending`/`submitted`/`cancelled` در enum نیستند.
- **`teraz` محاسبه نمی‌شود.** در legacy با کامنت «فرمول دموی» علامت خورده و policy
  رسمی ندارد. فیلد برای سازگاری شکل `null` است. ساختنش یعنی جعل قاعدهٔ کسب‌وکار.

## ۶. امنیت

| حمله | پاسخ | تست |
|---|---|---|
| IDOR روی Attempt دیگری | **۴۰۴** (نه ۴۰۳) روی `show`/`answer`/`finish`/`result`/`review` | ✓ |
| تزریق نمره | `score`/`percentage`/`maxScore`/`correct_count`/`negativeMarking`/`status`/`result` بی‌اثر | ✓ |
| تزریق زمان | `startedAt`/`deadlineAt`/`attempt_no`/`version` بی‌اثر | ✓ |
| تزریق فهرست سؤال | فهرست از Snapshot سرور | ✓ |
| گزینهٔ بیگانه | **۴۲۲ `OPTION_NOT_IN_ATTEMPT`** | ✓ |
| پاسخ پس از پایان | **۴۰۹ `ATTEMPT_CLOSED`** | ✓ |
| دستکاری رتبه | رتبه فقط از `exam_results` منتشرشده | ✓ |
| مهمان روی هر مسیر | **۴۰۱** | ✓ |
| نبود CSRF | **۴۰۳ `CSRF_FAILED`** | ✓ |
| منشأ متقاطع / نبود Origin | **۴۰۳ `FORBIDDEN`** (fail-closed) | ✓ |
| پیش‌نویس / آزمون باز‌نشده | **۴۰۴** / **۴۰۹ `EXAM_NOT_OPEN`** | ✓ |
| سیل شروع Attempt | **۴۲۹ `RATE_LIMITED`** | ✓ |
| **نشت کلید پاسخ** | ۹ نام ممنوع روی بدنهٔ خام در `list`/`show`/`start`/`read`/`finish`/`result` | ✓ |

- **۴۰۴ به‌جای ۴۰۳ برای IDOR:** وجود/عدم وجود منبع لو نمی‌رود.
- **دروازهٔ بازبینی، چهار شرط:** انتشار رسیده + قاعدهٔ آزمون + وضعیت `graded` +
  مالکیت. `review` **تنها** جایی است که کلید ظاهر می‌شود.
- **rate limit:** ۷ limiter نام‌دار از config (read 120/m · registration 30/m ·
  attempt_start 12/m · answer 240/m · finish 20/m · result 120/m · ranking 120/m).
  اعداد از `examApi.js` تا رفتار پیش از cutover عوض نشود. کلید = HMAC آی‌پی یا
  شناسهٔ بازیگر؛ **IP خام هرگز ذخیره/لاگ نمی‌شود**.
- **نتیجهٔ منتشرنشده لو نمی‌رود.** `finish` با `result_released: false` پاسخ
  می‌دهد و `/result` تا رسیدن `result_release_at` محتوا نمی‌دهد.
- **رتبه فقط از نتایج منتشرشدهٔ معتبر.** نه نمرهٔ کلاینت، نه `analytics_events`،
  نه localStorage. بدون توزیع مصنوعی.

## ۷. هم‌روندی و idempotency

سه سازوکار **مستقل** با هم‌پوشانی:

1. **Idempotency در دیتابیس** — `idempotency_keys` با
   `UNIQUE(scope, actor_key, request_key)`. تصادم ⇒ همان پاسخ قبلی
   (`idempotent = true`). پیاده‌سازی با **savepoint** (`DB::transaction(fn () => …)`)
   وگرنه «خطا بگیر و ادامه بده» داخل تراکنش PG را به `25P02` می‌برد.
2. **Optimistic lock** — `exam_answers.revision` و `exam_attempts.version`؛
   نسخهٔ کهنه ⇒ **۴۰۹ `REVISION_CONFLICT`**.
3. **قید یکتایی** — حتی اگر کد اشتباه کند، **دیتابیس** نوشتن دوم را رد می‌کند
   (`UniqueConstraintViolationException` در تست مستقیماً اثبات شد).

| سناریو | نتیجهٔ اندازه‌گیری‌شده |
|---|---|
| دو `finish` با کلید متفاوت | یک نتیجه؛ دومی `idempotent = true` |
| دو `finish` هم‌زمان | `UNIQUE(attempt_id)` یکی را رد می‌کند |
| دو پاسخ در همان `revision` | دومی ۴۰۹ `REVISION_CONFLICT` |
| دو `start` بدون کلید | یکی ساخته می‌شود، دومی `resumed = true` |
| دو `start` با همان کلید | یک Attempt |
| انقضا و سپس `finish` | یک نتیجهٔ `expired` |
| `finish` و سپس sweep | sweep صفر برمی‌گرداند، **دوباره تصحیح نمی‌کند** |
| sweep مکرر | `graded_at` تغییر نمی‌کند |
| Attempt بسته | هرگز برنمی‌گردد؛ `start` بعدی ۴۰۹ `ATTEMPT_LIMIT_REACHED` |

**فرمان `exam:expire-attempts`** — `--exam` · `--limit` · `--dry-run`؛ idempotent،
قابل‌کران، و Attempt در پنجرهٔ گریس را نمی‌بندد. لازم است چون انقضای تنبل فقط
Attempt کاربرِ **بازگشته** را می‌بندد.

---

# فاز ۸ — تحلیل‌ها

## ۱. Analytics

دامنهٔ **خواندنی/تجمیعی**. **هیچ جدول مشتق‌شده‌ای نوشته نشد.** تنها جدول این فاز
`analytics_events` است که **منبع حقیقت نیست**.

قاعدهٔ داوری: اگر عددی با جدول دامنه اختلاف داشت، **جدول دامنه درست است** و
محاسبه باگ دارد.

`AnalyticsService` یک لایهٔ نازک روی چهار سرویس است و کش را در **یک نقطه** اعمال
می‌کند — اگر هر سرویس خودش کش می‌کرد، احتمال فراموش‌کردن `userId` در کلید و نشتی
بین کاربران وجود داشت.

## ۲. تعریف متریک‌ها

| متریک | منبع | جدولی که نیست |
|---|---|---|
| `study_seconds` | `study_sessions.duration_sec` | ❌ `analytics_events` |
| `reading_seconds` | `learning_progress.reading_seconds` | ❌ `study_sessions` |
| `tracked_pages` / `completed_pages` | `learning_progress` | ❌ `analytics_events` |
| `completed_lessons` | `learning_progress` + `lesson_pages.lesson_id` **متمایز** | ❌ شمارش صفحه |
| `practice_accuracy` | `question_attempts` | ❌ `exam_answers` |
| `exam accuracy` | `exam_results` منتشرشده | ❌ `question_attempts` |
| رتبه | `exam_results` منتشرشده و معتبر | ❌ نمرهٔ کلاینت · رویداد · localStorage |
| `trend` | `study_sessions` + `learning_progress` | ❌ `analytics_events` |
| `recent_activity` | `analytics_events` (نمایشی) | — |

**دو ناوردایی که مخلوط‌کردنشان آمار را غلط می‌کند:**

1. **`study_seconds` و `reading_seconds` هرگز جمع نمی‌شوند.** «سشن مطالعهٔ
   ثبت‌شده» و «زمان روی صفحهٔ درس» دو مفهوم‌اند؛ جمعشان عددی می‌سازد که هیچ‌جا در
   محصول وجود ندارد. تست: `study 1500s ≠ reading 120s`.
2. **دو دقت، دو مخرج جدا.** `exam_answers` هرگز در مخرج تمرین و
   `question_attempts` هرگز در مخرج آزمون.

**دقت آزمون = `correct / (correct + wrong + blank)`** — «بی‌پاسخ» هم در مخرج است،
چون در آزمون واقعی سؤال بی‌پاسخ یک انتخاب است، نه غیبت.

**نتیجهٔ منتشرنشده در هیچ تجمیعی نمی‌آید و پس از انتشار ظاهر می‌شود** (تست شده).

**درصد دوره از زنجیرهٔ منتشرشدهٔ قابل‌مشاهده** — صفحه‌های منتشرنشده در مخرج
نمی‌آیند، وگرنه کاربر هرگز ۱۰۰٪ نمی‌دید.

**Timezone:** مرز باکت را جابه‌جا می‌کند، **مجموع را نه**. دیتابیس همیشه UTC و
تبدیل در لایهٔ تجمیع (ناوردایی تست‌شده).

## ۳. API

| متد و مسیر | توضیح |
|---|---|
| `GET /api/v1/me/analytics/overview` | نمای کلی |
| `GET /api/v1/me/analytics/topics` | عملکرد مبحثی |
| `GET /api/v1/me/analytics/exams` | عملکرد آزمون |
| `GET /api/v1/me/analytics/progress` | پیشرفت + روند (`bucket`, `tz`, `from`, `to`) |

- **`user_id` فقط از سشن.** `?userId=` ⇒ **۴۰۰ `UNKNOWN_QUERY_PARAMETER`**، نه
  نادیده‌گرفتن بی‌صدا — وگرنه یک اشتباه کلاینت به «دیدن آمار کاربر دیگر» تبدیل
  می‌شد.
- پارامتر خارج از allowlist ⇒ ۴۰۰ `UNKNOWN_QUERY_PARAMETER`.
- `tz` نامعتبر ⇒ **۴۲۲ `VALIDATION_FAILED`** (`The selected tz is invalid.`).
- کاربر بدون داده ⇒ **صفر**، نه خطا.
- rate limit `read` ۱۲۰/m.
- envelope v1: `{ data, meta?, requestId }`.

## ۴. کارایی

- **بدون جدول pre-aggregate** — حجم و الگوی مصرف توجیهش نمی‌کند و جدول مشتق‌شده
  یک منبع حقیقت دوم می‌سازد.
- `EXPLAIN (ANALYZE)` روی ۸ کوئری فاز ۷/۸: ایندکس‌ها **درست انتخاب می‌شوند**.
- **تنها نقطهٔ مقیاس‌پذیری شناخته‌شده در فاز ۷/۸:** `order by random()` در Bank
  Session (فاز ۶) — **نه Analytics**.
- بار محاسبه با کش ۶۰ ثانیه‌ای per-user و سقف ردیف/صفحه‌بندی مهار شده.
- **تست بار انجام نشد.** هیچ عدد throughput ای اندازه‌گیری نشده و ادعایی مطرح نیست.

## ۵. فرانت

**پل تازه: `src/services/exam/examV1.js`** — هم‌الگو با `progressV1.js` و
`testBankV1.js` (فاز ۵/۶). تنها نقطهٔ تماس با `/api/v1/exams*` و
`/api/v1/exam-attempts*`؛ قرارداد را از طریق `v1Request` اعتبارسنجی می‌کند و
`reason:'not_v1'` ⇒ fallback به legacy.

**دو ناسازگاری واقعی که پل صریح مدیریت می‌کند (نه بی‌صدا):**

1. **هویت گزینه: اندیس در برابر UUID.** UI فعلی (`coordinatedExamService`) پاسخ
   را با **اندیس گزینه** نگه می‌دارد؛ v1 `selected_option_id` یک **UUID درون
   Snapshot** است. اگر این نگاشت بی‌صدا اشتباه شود، کاربر پاسخ درست را می‌فرستد و
   **نمرهٔ غلط** می‌گیرد. پل هر گزینه را هم با `id` و هم با `index` می‌دهد و
   `optionIdAt()` / `indexOfOptionId()` هرگز حدس نمی‌زنند: ورودی ناشناس ⇒
   `null` / `-1`. در `saveAnswer` اگر اندیس نامعتبر باشد **هیچ درخواستی فرستاده
   نمی‌شود** و خطای صریح `OPTION_NOT_IN_ATTEMPT` برمی‌گردد — سکوت اینجا یعنی نمرهٔ غلط.
2. **`revision` اجباری است (قفل خوش‌بینانه).** v1 برای هر نوشتن پاسخ `revision`
   می‌خواهد و **`0` یعنی «هنوز پاسخی ثبت نشده»**. پل `revisionByQuestion` را از
   پاسخ‌های خوانده‌شده می‌سازد؛ اگر همیشه `0` می‌فرستاد، هر ویرایش دوم ۴۰۹ می‌گرفت.
   در `saveAnswers` با اولین `REVISION_CONFLICT` **متوقف** می‌شود (ادامه‌دادن با
   نسخهٔ کهنه فقط ۴۰۹ بیشتری می‌سازد) و مصرف‌کننده باید دوباره `fetchAttempt` بزند.

**شکاف‌های صریح با legacy که علامت خورده‌اند (نه پنهان):**

- **`/api/exams/server-time` معادل v1 ندارد.** `clockSkewMs()` صریحاً `0`
  برمی‌گرداند تا کسی تصور نکند اختلاف ساعت جبران می‌شود. `deadline_at` از سرور
  می‌آید و مرجع نهایی هم سرور است؛ شمارش معکوس کلاینت فقط **نمایشی** است.
- **`reward` در v1 نیست** (XP فاز ۱۲/۱۴) ⇒ `rewardOf()` همیشه `{awarded:false, amount:0}`.
- **`trackEvent` در v1 نیست** — هیچ ingestion رویداد کلاینت وجود ندارد.
- **`teraz` ساخته نمی‌شود** ⇒ `null` عبور می‌کند.
- **`ranking.me` تهی** ⇒ `null` می‌ماند؛ عدد ساختگی برای «رتبه‌ای نیست» تولید نمی‌شود.

**مرز کلید پاسخ در پل:** `mapExamQuestion` هیچ‌وقت کلید را نمی‌سازد؛
`FORBIDDEN_KEY_FIELDS` (۹ نام) اعلام شده تا هرگز مصرف نشود. کلید **فقط** در
`mapReviewQuestion` ظاهر می‌شود، و پر بودن آن به‌تنهایی یعنی سرور چهار شرط را
تأیید کرده است. `result_released` در `finish` جدا مصرف می‌شود، وگرنه UI نتیجهٔ
منتشرنشده را نشان می‌داد.

- **UI به v1 سوئیچ نشد** — پل ساخته و قفل شد، ولی هیچ کامپوننتی import عوض نکرد.
  سوئیچ باید اتمی و همراه با cutover باشد، وگرنه کاربر واردشده بی‌صدا بیرون می‌افتد.
- `v1:contract:check` ⇒ **۳۳ سبز / ۰ شکست** (۴ پل اسکن‌شده، ۷ schema تازه).
- **دود-تست پل: ۳۸ سنجه / ۰ شکست** روی توابع خالص — رفت‌وبرگشت اندیس↔UUID،
  عدم نشت کلید در سؤال شرکت، ظهور کلید در بازبینی، عبور `revision`، و
  `teraz`/`me`/`clockSkewMs` که مقدار ساختگی تولید نمی‌کنند.
- **تست رابط کاربری اجرا نشد** (طبق درخواست صریح).
- **دست‌نزدن به League/Payment/AI/Flashcards/Wiki** — هیچ وابستگی سختی نبود.

## ۶. Legacy

- **هیچ چیز legacy تغییر نکرد و نشکست.** سرور Node و `database/examApi.js` دست‌نخورده.
- **API v1 تازه است؛ `/api/*` دست‌نخورده.** OpenAPI legacy همان **۲۳۰ عملیات /
  ۱۶۶ path** است.
- آزمون‌های legacy: **۹۴۸ تست (۱۸ سوییت)** · `api:contract:check` ⇒ ۲۳۰ مسیر /
  ۲۸ کد / ۰ نقض · `api:openapi:check` ⇒ ۲۳۰ مسیر / ۱۶۶ path.
- **OpenAPI v1 به‌روز شد:** ۱۴ path تازه (**۴۲ کل**) و ۱۱ schema تازه
  (**۳۴ کل**)، دو tag تازه (`exams`, `analytics`)، `info.version` → **۱.۴.۰**.
  توضیحات شامل قاعدهٔ کلید پاسخ، مرز سه دامنه، قاعدهٔ ساعت سرور، و حذف‌های عمدی
  (`teraz`، توزیع مصنوعی).
- `ApiV1ContractTest` با ۱۴ ردیف تازه به‌روز شد و نگهبان دامنهٔ ممنوع فاز ۹+
  اضافه شد (`payment|subscription|entitlement|league|xp|achievement|flashcard|
  wiki|knowledge|notification|search|ai-`).
- **انحراف‌های عمدی از legacy، هر چهار مورد علامت‌خورده:**
  1. بدون توزیع مصنوعی رتبه (legacy از `mulberry32` استفاده می‌کرد).
  2. بدون محاسبهٔ `teraz`.
  3. بدون افشای فوری نتیجه در `finish` (`result_released: false`).
  4. بدون مسیر ادمین آزمون (مصرف‌کنندهٔ واقعی ندارد).

## ۷. مهاجرت

- **مهاجرت داده انجام نشد.** آزمون‌های legacy مهاجرت نکردند؛ فقط `legacy_id` و
  crosswalk طراحی شد.
- **مهاجرت‌های فاز ۷/۸ روی PostgreSQL واقعی تأیید شدند:** `migrate:fresh` →
  `migrate:rollback` (همه) → `migrate` دوباره، هر سه سبز، شامل
  `2026_10_03_000600` و `2026_10_03_000700`.
- مسیر تکرارپذیر: `backend/scripts/verify-on-pg.sh` (خوشهٔ موقت در `/tmp`، بدون
  نصب سرویس دائمی).

## ۸. تأییدنشده (Not Verified)

مواردی که **اندازه‌گیری یا اثبات نشده‌اند** — نه اینکه شکست خورده باشند:

1. **مسابقهٔ واقعی چند-اتصالی روی PostgreSQL.** PHPUnit تک‌رشته‌ای است؛
   `ExamConcurrencyTest` **سازوکارها** و ترتیب‌های ترتیبی را می‌سنجد، نه دو
   connection واقعی هم‌زمان. تست بار/race واقعی انجام نشد.
2. **رفتار Redis در production.** کش و rate limit روی Redis واقعی تست نشد؛
   `phpunit.xml` عمداً `CACHE_STORE=array` را قفل کرده. **دست نزنید.**
3. **تست بار و throughput.** هیچ عدد QPS/تأخیری اندازه‌گیری نشد.
4. **مسیر مهمان آزمونک.** ستون و CHECK آماده‌اند؛ مسیر ساخته نشد چون UI فعلی
   آزمون بدون ورود ندارد.
5. **مسیر ادمین آزمون.** ساخته نشد.
6. **مهاجرت آزمون‌های legacy.** انجام نشد.
7. **switching فرانت به v1.** پل آزمون **ساخته و قفل شد**، ولی هیچ کامپوننتی
   import عوض نکرد ⇒ مسیر واقعی UI هنوز legacy است. سوئیچ انجام نشد.
8. **CI/CD.** `.github/workflows/backend-ci.yml` نوشته شده ولی **هرگز اجرا نشد**.
9. **`verify-on-pg.sh` روی خوشهٔ `/tmp` است، نه یک staging واقعی.** Docker،
   staging و backup زمان‌بندی‌شده وجود ندارند.

## ۹. ریسک‌های شناخته‌شده

| ریسک | اثر | مهار |
|---|---|---|
| **چرخش `APP_KEY`** | `key_snapshot_encrypted` رمزگشایی نمی‌شود ⇒ تصحیح آزمون‌های گذشته می‌شکند | re-encrypt ستون پیش از چرخش؛ مستند شده |
| `order by random()` در Bank Session | با رشد بانک سؤال کند می‌شود | سقف + صفحه‌بندی؛ FTS/trigram فاز ۹+ |
| جست‌وجوی `ILIKE` با wildcard ابتدایی | index-free | سقف `perPage` + rate limit |
| rate limit روی `array` در تست | نشت شمارنده ⇒ ۴۲۹/۴۰۱ کاذب | `phpunit.xml` عمداً `array` را قفل کرده |
| `analytics_events` بدون dashboard کامل | جدول پر می‌شود ولی مصرف کامل ندارد | retention + prune؛ نمایش `recent_activity` |
| بدون جدول pre-aggregate | تجمیع روی حجم بزرگ کند می‌شود | کش ۶۰s؛ تصمیم آگاهانه |
| `teraz` محاسبه نمی‌شود | فیلد `null` است | عمدی؛ policy رسمی ندارد |

## ۱۰. آمادگی فاز ۹

**آماده:**

- مدل دادهٔ آزمون و تحلیل کامل و تأییدشده روی PG واقعی.
- `legacy_id` روی `exams` برای crosswalk مهاجرت.
- `guest_id` + CHECK انحصاری برای آزمونک مهمان.
- `created_by_admin_id`, `version`, `rules_version` برای CRUD ادمین.
- `subject_breakdown` ذخیره‌شده ⇒ آمار مبحثی آزمون بدون بازمحاسبه.
- پل v1 فرانت با اعتبارسنجی قرارداد و fallback.
- مسیر تأیید PG: `verify-on-pg.sh`.

**پیش‌نیاز فاز ۹:**

- پنل ادمین آزمون (مصرف‌کنندهٔ واقعی) + گذارهای `publish`/`close`/`archive`.
- مهاجرت آزمون‌های legacy از `examStore.js`.
- تصمیم دربارهٔ `teraz` (policy رسمی) یا حذف کامل فیلد.
- cutover فرانت به v1 (اتمی) — نگاشت اندیس گزینه → UUID از قبل در `examV1.js`
  ساخته و تست شده است، پس گام باقی‌مانده فقط تعویض importهاست.
- تصمیم دربارهٔ معادل v1 برای `/api/exams/server-time` (اکنون `clockSkewMs()=0`).
- race واقعی روی PG با چند connection و تست بار.
- مسیر مهمان آزمونک اگر UI آن را بخواهد.

---

## وضعیت تست — اعداد اندازه‌گیری‌شده

| مجموعه | SQLite | PostgreSQL واقعی |
|---|---|---|
| کل بک‌اند | ۲ skipped · **۳۸۰ passed** (۲۷۹۲ assertion) | **۳۸۲ passed** (۲۷۹۵ assertion) · ۰ skipped |
| فاز ۷ + ۸ | **۱۰۴ passed** (۸۲۳ assertion) | همان |
| — Exam Engine | ۳۱ | ۳۱ |
| — نشت کلید پاسخ | ۷ | ۷ |
| — امنیت | ۱۶ | ۱۶ |
| — هم‌روندی | ۱۰ | ۱۰ |
| — فرمان‌ها | ۱۰ | ۱۰ |
| — Analytics API | ۱۶ | ۱۶ |
| — Analytics رویداد/کش | ۱۴ | ۱۴ |

دو تست `ServiceIntegrationTest` روی SQLite skip می‌شوند و روی PG واقعاً اجرا
می‌شوند — به همین دلیل جمع ۳۸۲ است. **Pint: ۲۸۷ فایل PASS.**
پل فرانت: **۳۳ سبز / ۰ شکست** (۴ پل، ۷ schema تازه) + دود-تست پل آزمون
**۳۸ سنجه / ۰ شکست**. OpenAPI v1: **۴۲ path / ۳۴ schema**.
Legacy: **۹۴۸ تست** · **۲۳۰ مسیر / ۱۶۶ path** · ۰ نقض.

دو باگ **فقط-PG** در همین اجرا کشف و رفع شد:

1. **بازچینی کلید `jsonb`** — PostgreSQL ترتیب درج را حفظ نمی‌کند ⇒ تست
   ترتیب-وابسته قرمز شد. رفع: سنجش **مجموعهٔ** کلیدها به‌جای ترتیب (قدرت تست حفظ شد).
2. **مقایسهٔ ستون `uuid` با رشتهٔ دلخواه** ⇒ `SQLSTATE[22P02]` در
   `exam:expire-attempts`. رفع: گارد `Str::isUuid()` — همان الگوی
   `ExamQueryService`.

## تعریف «انجام‌شده» — وضعیت

| معیار | وضعیت |
|---|---|
| مهاجرت‌ها روی PG واقعی بالا/پایین می‌روند | ✅ |
| تست‌های موتور، امنیت، نشت کلید، هم‌روندی سبز | ✅ ۱۰۴ تست |
| کلید پاسخ در هیچ پاسخ عمومی نیست | ✅ ۷ تست + فهرست ممنوع |
| نمره فقط سمت سرور | ✅ `ExamGrader` تنها نقطه |
| ساعت سرور تنها منبع زمان | ✅ تست تزریق زمان |
| نتیجه یکتا و تغییرن‌پذیر | ✅ `UNIQUE(attempt_id)` + FK `RESTRICT` |
| نتیجه پیش از انتشار لو نمی‌رود | ✅ |
| رتبه فقط از نتایج منتشرشده | ✅ تست دستکاری |
| Analytics فقط مصرف‌کننده | ✅ صفر جدول مشتق‌شده |
| دو دقت با دو مخرج جدا | ✅ تست‌شده |
| OpenAPI v1 به‌روز | ✅ ۱.۴.۰ |
| Legacy نشکسته | ✅ ۹۴۸ تست · ۰ نقض |
| Pint سبز | ✅ ۲۸۷ فایل |
| پل فرانت آزمون ساخته و قفل شد | ✅ `examV1.js` + ۳۳ بررسی قرارداد + ۳۸ سنجهٔ دود |
| UI به v1 سوئیچ شد | ❌ عمدی — وابسته به cutover |
| مهاجرت legacy انجام شد | ❌ انجام نشد |
