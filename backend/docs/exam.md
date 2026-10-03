# فاز ۷ — موتور آزمون

دامنهٔ **Exam Engine** مالک `exams`, `exam_questions`, `exam_registrations`,
`exam_attempts`, `exam_answers` و `exam_results` است.

> **سه مرز دامنه که نباید جابه‌جا شوند**
> 1. **Question Bank** مالک سؤال، گزینه و **کلید پاسخ** (`questions`,
>    `question_options`, `question_keys`) است.
> 2. **Exam Engine** مالک آزمون، Snapshot، ثبت‌نام، Attempt، پاسخ و نتیجه است.
> 3. **Analytics** فقط **مصرف‌کننده** است — هیچ جدولی از این دو دامنه را
>    نمی‌نویسد (`analytics.md`).
>
> `question_attempts` (فاز ۶) «پاسخ به یک سؤال تمرینی» است، نه «تلاش در یک آزمون».
> این دو جدول **هرگز** با هم جمع نمی‌شوند و در یک مخرج قرار نمی‌گیرند.

## چرخهٔ عمر — `phase` و `uiStatus`

`ExamPhaseResolver` فاز را **فقط از ساعت سرور** مشتق می‌کند. جانشین `examPhase()`
در `database/examStore.js` است و همان برچسب‌های `uiStatus` را برمی‌گرداند تا UI
فعلی بدون تغییر بماند.

| `phase` | `uiStatus` | شرط |
|---|---|---|
| `DRAFT` | `DRAFT` | `status = draft` — هرگز در API عمومی دیده نمی‌شود |
| `ARCHIVED` | `FINISHED` | `status = archived` |
| `SCHEDULED` | `UPCOMING` / `REGISTRATION_OPEN` / `REGISTRATION_CLOSED` | `now < opens_at` |
| `LIVE` | `LIVE` | داخل پنجره |
| `GRACE` | `FINISHED` | `closes_at < now ≤ closes_at + grace_seconds` |
| `FINISHED` | `FINISHED` | پس از گریس، بدون انتشار نتیجه |
| `RESULTS` | `RESULTS_AVAILABLE` | پس از گریس (یا `status = closed`) و `result_release_at` رسیده |
| `AVAILABLE` | `AVAILABLE` | آزمون بدون پنجرهٔ زمانی (`opens_at` و `closes_at` هر دو تهی) |

**تفاوت عمدی با legacy.** legacy همه‌چیز را از زمان مشتق می‌کرد. اینجا ستون
`status` به‌عنوان **دروازهٔ محدودکننده** اضافه شده: می‌تواند آزمون را ببندد یا
آرشیو کند، ولی **هرگز نمی‌تواند آزمونی را زودتر از زمانش باز کند**.
`phase` مرجع تصمیم امنیتی است؛ `uiStatus` فقط برچسب نمایشی.

## زمان‌بندی — ساعت سرور تنها منبع

| ستون | نویسنده |
|---|---|
| `exams.opens_at` / `closes_at` / `registration_*` / `result_release_at` | ادمین (در این فاز فقط از طریق دادهٔ seed/مستقیم) |
| `exam_attempts.started_at` | سرور، در لحظهٔ ساخت Attempt |
| `exam_attempts.deadline_at` | سرور = `started_at + duration_minutes` (clamp با `closes_at`) |
| `exam_attempts.submitted_at` / `graded_at` | سرور، در `finish` |
| `exam_answers.answered_at` | سرور، در هر نوشتن پاسخ |

- **هیچ ستون زمانی از بدنهٔ درخواست نوشته نمی‌شود.** `startedAt`, `deadlineAt`,
  `submittedAt`, `answeredAt` در `rules` وجود ندارند و ارسالشان بی‌اثر است
  (`ExamSecurityTest` این را قفل کرده: `deadline == started + 30min` می‌ماند).
- **پنجرهٔ گریس.** پاسخ تا `deadline_at`؛ **ارسال** تا
  `deadline_at + grace_seconds` (`config('exam.default_grace_seconds')` = ۳۰s).
  همان معنای `graceSeconds` در `examStore.js`.
- **همهٔ ستون‌های زمانی `timestamptz`** و `config('database.connections.pgsql.timezone')`
  صریح `UTC` است، وگرنه ساعت سشن PG همه را جابه‌جا می‌کند.
- `time_spent_sec` در نتیجه از `started_at → submitted_at` محاسبه و با
  `min(duration×60, deadline−started)` **clamp** می‌شود (همان `Math.min` legacy)
  تا Attempt ای که ساعت‌ها باز مانده عدد بی‌معنا تولید نکند.

## Snapshot — چرا و چگونه

`exam_questions.render_snapshot` (JSONB) + `key_snapshot_encrypted` (text)
عکس لحظهٔ **انتشار** آزمون‌اند:

- ویرایش بعدی سؤال در بانک سؤال، Attempt قدیمی را تغییر **نمی‌دهد**؛ نه صورت
  سؤال، نه گزینه‌ها، نه کلید.
- `question_version` همان نسخهٔ سؤال در لحظهٔ snapshot است.
- **پاسخ snapshot-local است.** `exam_answers.selected_option_id` شناسهٔ **درون
  `render_snapshot`** است، نه شناسهٔ `question_options`. پس یک پاسخ نمی‌تواند
  به گزینهٔ سؤال دیگری اشاره کند ⇒ `OPTION_NOT_IN_ATTEMPT` (۴۲۲).
  FK به `question_options` عمداً **نیست**: Snapshot باید از تغییرات بانک سؤال
  مستقل بماند.
- `UNIQUE(exam_id, question_id) WHERE question_id IS NOT NULL` جلوگیری از
  تکرار سؤال در یک آزمون. `question_id` می‌تواند `null` باشد (سؤال فقط-snapshot
  که رکورد زنده‌اش بعداً آرشیو شده) ⇒ قید **جزئی** است، چون PG/SQLite مقادیر NULL
  را در UNIQUE با هم یکتا حساب نمی‌کنند.

## جدایی کلید پاسخ — قرارداد اصلی

کلید **هرگز** در ستون قابل serialize نیست:

- `key_snapshot_encrypted` با cast `encrypted` لاراول (AES-256-GCM، کلید
  `APP_KEY`) ذخیره می‌شود. **هیچ Secret در ریپو نیست و کلید hardcode نشده.**
- تنها `ExamGrader` آن را می‌خواند. `QuestionQueryService` در هیچ کوئری مسیر
  دانشجو کلید را eager-load نمی‌کند.
- `ExamQuestion::$hidden` ستون را پنهان می‌کند و Resource ها هم آن را serialize
  نمی‌کنند.
- `ExamAnswerKeyLeakTest` فهرست **ممنوع** را روی بدنهٔ خام پاسخ قفل کرده:
  `key_snapshot_encrypted`, `correct_option_id`, `correctOptionId`,
  `correct_answer`, `correctAnswer`, `answer_key`, `answerKey`, `explanation`,
  `is_correct`. این تست روی `list`/`show`/`start`/`read`/`finish`/`result`
  اجرا می‌شود؛ **`review` تنها جایی است که کلید ظاهر می‌شود**.

> ⚠️ **چرخش `APP_KEY` نیازمند re-encrypt این ستون است.** کلید رمزنگاری عوض شود
> و ستون دوباره رمزگشایی نشود، تصحیح همهٔ آزمون‌های گذشته می‌شکند. ریسک
> مستندشده و پذیرفته‌شده است.

### دروازهٔ بازبینی (review)

بازگشایی کلید **چهار شرط** دارد و هر چهار مورد سمت سرور چک می‌شود:

1. `result_release_at` رسیده باشد (`ExamPhaseResolver::released`)؛
2. قاعدهٔ آزمون بازبینی را اجازه بدهد؛
3. Attempt در وضعیت `graded` باشد (نه `in_progress`، نه `expired`)؛
4. Attempt **متعلق به همان کاربر** باشد.

## تصحیح — `ExamGrader`

**تنها جایی که نمره محاسبه می‌شود.** Controller هیچ‌وقت grading نمی‌کند.
ورودی‌اش فقط دادهٔ سرور است: سؤال‌ها از **Snapshot** (نه بانک سؤال زنده)، پاسخ‌ها
از `exam_answers`، سیاست از ستون `exams.negative_marking` (نه بدنهٔ درخواست).

```
score      = Σ weight × ( درست ? 1 : (نادرست ? negative_marking : 0) )
maxScore   = Σ weight
percentage = clamp( round(score / maxScore × 1000) / 10 , 0 , 100 )
```

- با `weight = 1` (که در این فاز همیشه هست) دقیقاً به فرمول legacy فرو می‌کاهد:
  `score = correct + wrong × negative`. **فرمول تازه‌ای اختراع نشده.**
- بی‌پاسخ (`selected_option_id = null`): نه امتیاز مثبت، نه جریمهٔ منفی — فقط
  `blank_count`.
- `subject_breakdown` (JSONB) از `render_snapshot.subject` ساخته و نزولی بر
  `percent` مرتب می‌شود. این **تنها** مصرف JSONB در نتیجه است.
- **`teraz` (تراز) محاسبه نمی‌شود.** در legacy خودش با کامنت «فرمول دموی» علامت
  خورده و policy رسمی ندارد؛ ساختنش یعنی جعل یک قاعدهٔ کسب‌وکار. فیلد برای
  سازگاری شکل با `null` نگه داشته شده.

### قاعدهٔ JSONB در برابر ستون

`rules` (JSONB) **سطل زباله نیست**. قاعده‌ای که در **کوئری** مصرف می‌شود ستون
دارد:

| قاعده | کجا |
|---|---|
| `duration_minutes`, `grace_seconds`, `attempt_limit`, `negative_marking` | ستون |
| `question_count`, `rules_version`, `version` | ستون |
| تنظیمات نمایشی/غیر‌کوئری‌محور | `rules` JSONB |

`rules_version` با هر تغییر معنایی `rules` بالا می‌رود.

## وضعیت‌ها و گذارها

```
exam_attempts.status ∈ { in_progress, graded, expired }

in_progress → graded    (finish)
in_progress → expired   (deadline + grace گذشت)
graded      → ∅         (پایانی)
expired     → ∅         (پایانی)
```

**`pending` / `submitted` / `cancelled` عمداً وجود ندارند.** تصحیح همگام و در
همان تراکنش `finish` انجام می‌شود، پس حالت میانی `submitted` هرگز persist
نمی‌شود؛ و هیچ مصرف‌کننده‌ای برای لغو Attempt (نه در UI، نه در پنل) وجود ندارد.
افزودنشان «طراحی‌شده» را به‌جای «پیاده‌شده» جا می‌زند.

`submit_reason` ∈ `user` | `auto` | `grace` | `timeout` (همان `sanitizeReason`
legacy). **از بدنهٔ درخواست خوانده نمی‌شود** — سرور تعیین می‌کند.

## API — مسیر دانشجو

| متد و مسیر | توضیح |
|---|---|
| `GET /api/v1/exams` | فهرست آزمون‌های منتشرشده (صفحه‌بندی اجباری) |
| `GET /api/v1/exams/{idOrSlug}` | جزئیات + `phase`/`uiStatus` + وضعیت ثبت‌نام من |
| `GET /api/v1/exams/{idOrSlug}/ranking` | رتبه‌بندی (فقط نتایج منتشرشدهٔ معتبر) |
| `POST /api/v1/exams/{idOrSlug}/registrations` | ثبت‌نام |
| `DELETE /api/v1/exams/{idOrSlug}/registrations` | لغو ثبت‌نام |
| `POST /api/v1/exams/{idOrSlug}/attempts` | شروع Attempt (idempotent) |
| `GET /api/v1/exam-attempts/{id}` | خواندن Attempt + پاسخ‌های ثبت‌شده |
| `PUT /api/v1/exam-attempts/{id}/answers` | نوشتن پاسخ (optimistic lock) |
| `POST /api/v1/exam-attempts/{id}/finish` | پایان + تصحیح |
| `GET /api/v1/exam-attempts/{id}/result` | نتیجه (پشت دروازهٔ انتشار) |
| `GET /api/v1/exam-attempts/{id}/review` | بازبینی با کلید (چهار شرط) |

- `{idOrSlug}` با `Str::isUuid()` تفکیک می‌شود. **مقایسهٔ ستون `uuid` با رشتهٔ
  دلخواه روی PostgreSQL خطای `22P02` و ۵۰۰ می‌دهد** ⇒ بدون `isUuid` روی `id`
  شرط گذاشته نمی‌شود.
- فیلترهای query در allowlist‌اند؛ هر پارامتر ناشناخته ⇒ **۴۰۰
  `UNKNOWN_QUERY_PARAMETER`** (نه نادیده‌گرفتن بی‌صدا).
- ورود **اجباری** است. ستون `guest_id` و CHECK انحصاری
  `exam_attempts_principal_exclusive` از روز اول در دیتابیس هست تا آزمونک مهمان
  بدون migration اضافه شود، ولی **مسیر مهمان ساخته نشد** — UI فعلی آزمون بدون
  ورود ندارد.

### چرا هیچ مسیر ادمینی ساخته نشد

**هیچ endpoint ادمینی برای آزمون ساخته نشد، عمداً.** پنل فعلی مصرف‌کنندهٔ واقعی
برای CRUD آزمون ندارد؛ ساختنش یعنی endpoint بدون مصرف‌کننده. مدل داده،
`created_by_admin_id`, `version` و `rules_version` از روز اول آماده‌اند تا فاز
بعد بدون migration اضافه شود. تنها گذارهایی که ادمین در آینده لازم دارد
(`publish` / `close` / `archive`) در `config/exam.php` به‌شکل `statuses` تعریف
شده‌اند.

## امنیت

| حمله | پاسخ سیستم | تست |
|---|---|---|
| IDOR روی Attempt دیگری | **۴۰۴** (نه ۴۰۳ — وجود/عدم وجود منبع لو نمی‌رود) | `ExamSecurityTest` |
| تزریق نمره در بدنه | فیلدهای `score`/`percentage`/`maxScore`/`correct_count`/`negativeMarking`/`status`/`result` بی‌اثر | ✓ |
| تزریق زمان در بدنه | `startedAt`/`deadlineAt`/`attempt_no`/`version` بی‌اثر | ✓ |
| تزریق فهرست سؤال | فهرست از Snapshot سرور، نه کلاینت | ✓ |
| گزینهٔ متعلق به Attempt دیگر | **۴۲۲ `OPTION_NOT_IN_ATTEMPT`** | ✓ |
| پاسخ پس از پایان | **۴۰۹ `ATTEMPT_CLOSED`** | ✓ |
| دستکاری رتبه با نمرهٔ جعلی | رتبه فقط از `exam_results` منتشرشده | ✓ |
| مهمان روی هر مسیر | **۴۰۱** | ✓ |
| نبود CSRF | **۴۰۳ `CSRF_FAILED`** | ✓ |
| منشأ متقاطع / نبود Origin | **۴۰۳ `FORBIDDEN`** (fail-closed) | ✓ |
| پیش‌نویس / آزمون باز‌نشده | **۴۰۴** / **۴۰۹ `EXAM_NOT_OPEN`** | ✓ |
| سیل شروع Attempt | **۴۲۹ `RATE_LIMITED`** | ✓ |
| نشت کلید پاسخ | فهرست ممنوع روی بدنهٔ خام | `ExamAnswerKeyLeakTest` |

**rate limit ها** نام‌دار و از config‌اند (`config/exam.php → rate_limits`):
read ۱۲۰/m · registration ۳۰/m · attempt_start ۱۲/m · answer ۲۴۰/m · finish ۲۰/m ·
result ۱۲۰/m · ranking ۱۲۰/m. اعداد از `examApi.js` گرفته شده‌اند تا رفتار پیش
از cutover عوض نشود. کلید limiter **HMAC آی‌پی یا شناسهٔ بازیگر** است؛ IP خام
هرگز ذخیره/لاگ نمی‌شود.

## هم‌روندی و idempotency

سه سازوکار **مستقل** که هم‌پوشانی هم دارند:

1. **Idempotency در دیتابیس** — جدول `idempotency_keys` با
   `UNIQUE(scope, actor_key, request_key)`. تصادم ⇒ همان پاسخ قبلی
   (`idempotent = true`)، نه خطا و نه نوشتن دوم.
2. **Optimistic lock** — `exam_answers.revision` و `exam_attempts.version`.
   نوشتن با نسخهٔ کهنه ⇒ **۴۰۹ `REVISION_CONFLICT`**.
3. **قید یکتایی** — `UNIQUE(attempt_id)` روی `exam_results` و
   `UNIQUE(attempt_id, exam_question_id)` روی `exam_answers`. حتی اگر کد اشتباه
   کند، **دیتابیس** نوشتن دوم را رد می‌کند.

| سناریو | رفتار |
|---|---|
| دو `finish` با کلید متفاوت | یک نتیجه؛ دومی `idempotent = true` |
| دو `finish` هم‌زمان | قید `UNIQUE(attempt_id)` یکی را رد می‌کند |
| دو نوشتن پاسخ در همان `revision` | دومی ۴۰۹ `REVISION_CONFLICT` |
| دو `start` بدون کلید | یکی ساخته می‌شود، دومی `resumed = true` |
| دو `start` با همان کلید | یک Attempt |
| انقضا و سپس `finish` | یک نتیجهٔ `expired` |
| `finish` و سپس sweep | sweep صفر برمی‌گرداند و **دوباره تصحیح نمی‌کند** |
| sweep مکرر | `graded_at` تغییر نمی‌کند |
| Attempt بسته | هرگز به `in_progress` برنمی‌گردد؛ `start` بعدی ۴۰۹ `ATTEMPT_LIMIT_REACHED` |

> **صداقت مهندسی:** PHPUnit تک‌رشته‌ای است. `ExamConcurrencyTest` **سازوکارها** و
> **ترتیب‌های ترتیبی** را می‌سنجد، نه مسابقهٔ واقعی چند-اتصالی. مسابقهٔ واقعی روی
> PostgreSQL با چند connection **تأیید نشده** است (فهرست «تأییدنشده» در گزارش
> فاز).

## فرمان `exam:expire-attempts`

```
php artisan exam:expire-attempts [--exam=UUID|slug] [--limit=500] [--dry-run]
```

**چرا لازم است با وجود انقضای تنبل:** `ExamAttemptService::show()` فقط Attempt
های کاربری را می‌بندد که **برمی‌گردد**. Attempt ای که کاربر رهایش کرده تا ابد
`in_progress` می‌ماند و در «سهمیهٔ مصرف‌شده» و شمارش‌ها اثر می‌گذارد.

- **idempotent** — نهایی‌سازی روی Attempt بسته کوتاه می‌شود.
- **قابل‌کران** — `--limit` جلوی اجرای طولانی را می‌گیرد.
- **`--dry-run`** — پیش از هر اجرای واقعی روی production.
- Attempt ای که در پنجرهٔ گریس است **بسته نمی‌شود**.
- ارجاع نامعتبر به آزمون ⇒ `FAILURE` با پیام، نه استثنا (و روی PG نه `22P02`).

## ایندکس‌ها

| جدول | ایندکس | برای چه کوئری |
|---|---|---|
| `exams` | `(status, opens_at)`, `(kind, status)`, `(subject_id, status)` | فهرست و فیلتر UI |
| `exams` | `UNIQUE(slug)`, `UNIQUE(legacy_id)` | مسیر و crosswalk مهاجرت |
| `exam_questions` | `UNIQUE(exam_id, position)`, `(exam_id, id)` | ترتیب سؤال در Snapshot |
| `exam_questions` | `UNIQUE(exam_id, question_id) WHERE question_id IS NOT NULL` | جلوگیری از سؤال تکراری |
| `exam_registrations` | `UNIQUE(exam_id, user_id)`, `(user_id, exam_id)` | ثبت‌نام یکتا |
| `exam_attempts` | `UNIQUE(exam_id, user_id, attempt_no)` | سهمیهٔ Attempt |
| `exam_attempts` | `(user_id, status)`, `(exam_id, status)`, `(status, deadline_at)` | «آزمون‌های من»، sweep انقضا |
| `exam_attempts` | `UNIQUE(submit_key) WHERE NOT NULL` | idempotency پایان |
| `exam_answers` | `UNIQUE(attempt_id, exam_question_id)`, `(exam_question_id)` | یک پاسخ در هر سؤال |
| `exam_results` | `UNIQUE(attempt_id)`, `(exam_id, percentage)`, `(user_id, graded_at)` | رتبه‌بندی و تاریخچه |

ایندکس تازه فقط با کوئری واقعی اضافه می‌شود. `EXPLAIN (ANALYZE)` روی ۸ کوئری
فاز ۷/۸ اجرا شد و ایندکس‌ها درست انتخاب می‌شوند.

## پیکربندی (`config/exam.php`)

`kinds` (`quiz`/`personal`/`coordinated`/`international`) · `statuses` ·
`attempt_statuses` · `attempt_transitions` · `submit_reasons` ·
`pagination` (20/50) · `limits` (questions 300، options 8، title 200، desc 4000) ·
`default_grace_seconds` (30) · `ranking` (20/100) · `rate_limits` (۷ مورد).

همه از `.env` و «سقف محافظتی/پیش‌فرض پیشنهادی»اند، **نه عدد اندازه‌گیری‌شده**.

## انطباق با انواع آزمون legacy

`kind` تنها تمایز موتور است — **سه موتور جدا ساخته نشد**:

| `kind` | منبع در UI فعلی |
|---|---|
| `quiz` | آزمونک (`examApi.js`) |
| `personal` | `examBuilderService` (آزمون شخصی) |
| `coordinated` | `coordinatedExamService.TYPE_META` (آزمون هماهنگ) |
| `international` | `internationalService` (آزمون بین‌الملل) |

`type` نمایشی ریزتر در ستون جدا نگه داشته می‌شود و در تصمیم موتور دخالت نمی‌کند.

## پل فرانت — `src/services/exam/examV1.js`

هم‌الگو با `progressV1.js` و `testBankV1.js`. تنها نقطهٔ تماس فرانت با
`/api/v1/exams*` و `/api/v1/exam-attempts*`. **UI به آن سوئیچ نشده** — پل ساخته و
قفل شده، ولی import کامپوننت‌ها عوض نشده است.

**دو نگاشت که اگر بی‌صدا اشتباه شوند، نمرهٔ کاربر غلط می‌شود:**

| ناسازگاری | راه‌حل در پل |
|---|---|
| UI پاسخ را با **اندیس گزینه** نگه می‌دارد؛ v1 با **UUID درون Snapshot** | هر گزینه هم `id` و هم `index` دارد؛ `optionIdAt()`/`indexOfOptionId()` هرگز حدس نمی‌زنند (ناشناس ⇒ `null`/`-1`). اندیس نامعتبر ⇒ **هیچ درخواستی فرستاده نمی‌شود** |
| `PUT /answers` مقدار `revision` می‌خواهد و **`0` یعنی «ثبت‌نشده»** | `revisionByQuestion` از پاسخ‌های سرور ساخته می‌شود؛ اولین `REVISION_CONFLICT` کار را متوقف می‌کند |

- `questionId` در بدنهٔ نوشتن، **`exam_question_id`** است، نه شناسهٔ بانک سؤال
  (اعتبارسنجی «گزینه به همین سؤال تعلق دارد» باید روی همان Snapshot باشد).
- `finish` مقدار `reason` **نمی‌فرستد** — سرور از ساعت خودش مشتق می‌کند.
  `result_released` جدا مصرف می‌شود، وگرنه UI نتیجهٔ منتشرنشده را نشان می‌دهد.
- `FORBIDDEN_KEY_FIELDS` (۹ نام) اعلام شده تا هرگز مصرف نشود؛ کلید **فقط** در
  `mapReviewQuestion` ظاهر می‌شود.
- **`clockSkewMs()` صریحاً `0`** — v1 معادل `/api/exams/server-time` ندارد.
  `deadline_at` مرجع نهایی است؛ شمارش معکوس کلاینت فقط نمایشی است.
- `rewardOf()` همیشه `{awarded:false, amount:0}` (XP فاز ۱۲/۱۴ است) و
  `trackEvent` هیچ رویدادی نمی‌فرستد (بدون ingestion کلاینت).

## بدهی باز

- **مسیر مهمان ساخته نشد** (UI فعلی آزمون بدون ورود ندارد). ستون و CHECK آماده‌اند.
- **مسیر ادمین آزمون ساخته نشد** — مصرف‌کنندهٔ واقعی ندارد.
- **`teraz` محاسبه نمی‌شود** — policy رسمی ندارد.
- **مهاجرت آزمون‌های legacy انجام نشد**؛ فقط `legacy_id` و crosswalk طراحی شد.
- **مسابقهٔ واقعی چند-اتصالی روی PG تست نشد** (PHPUnit تک‌رشته‌ای است).
