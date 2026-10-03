# فاز ۶ — بانک سؤال

دامنهٔ **Question Bank** مالک `questions`, `question_options`, `question_keys`,
`question_topics`, `question_attempts`, `question_reports` و `heart_rewards` است.

> **موتور آزمون اینجا نیست.** `exams`/`exam_attempts`/`exam_results` و ثبت‌نام
> آزمون فاز ۷ هستند. `question_attempts` یک «پاسخ به یک سؤال» است، نه «تلاش در
> یک آزمون».

## جدایی کلید پاسخ — قرارداد اصلی

`correct_option_id` و `explanation` **فقط** در `question_keys` هستند:

- هیچ ستونی در `questions`/`question_options` آن‌ها را تکرار نمی‌کند؛ پس یک
  `SELECT *` اشتباه هم نمی‌تواند کلید را لو بدهد.
- `QuestionResource` (شکل عمومی) هیچ‌وقت `key` را eager-load نمی‌کند.
- `QuestionQueryService` در هیچ کوئری مسیر دانشجو `key` را بارگذاری نمی‌کند.
- `AdminQuestionResource` تنها جایی است که کلید serialize می‌شود، و فقط پشت
  `api.admin` + `api.can:testbank.read`.

مجموعهٔ کلیدهای JSON عمومی **دقیقاً** این است (تست `AnswerKeyIsolationTest`
این را با `assertSame` قفل کرده):

```
question: id, stem, figure_key, type, difficulty, source, track,
          year, exam_month, subject, topic, options
option:   id, position, label, body
```

خارج از آن: `correct_option_id`, `explanation`, `key_version`, `is_correct`,
`status`, `version`, `legacy_id`, `author_admin_id`, `stats`.

**بازگشایی فقط پس از پاسخ.** تصمیم از رفتار واقعی محصول استخراج شد، نه از حدس:
`src/services/testBank/testBankService.js::applyReveal` کلید را روی همان سؤالی که
پاسخ گرفته می‌نشاند، و `database/contentStore.js::recordTestBankAnswers` مقدار
`correctAnswer` و `explanation` را **در همان پاسخ** برمی‌گرداند. پس
`reveal` فوری و فقط برای همان سؤال است؛ اگر روزی محصول بازگشایی را به موعد
موکول کند، تنها `QuestionRevealService` عوض می‌شود
(`QUESTION_BANK_REVEAL_AFTER_ANSWER=false` هم آن را کامل خاموش می‌کند).

## واژگان (از دادهٔ واقعی، بدون اختراع)

| میدان | مقادیر |
|---|---|
| `type` | `single`, `concept`, `memorization`, `calculation`, `clinical`, `image`, `combined` |
| `difficulty` | `easy`, `medium`, `hard`, `very_hard` |
| `source` | `official`, `comprehensive`, `tapesh` |
| `track` | `medicine`, `dentistry` |
| `status` | `draft`, `published`, `archived` |
| `question_reports.kind` | `error`, `ambiguity`, `typo`, `wrong_answer`, `other` |

`explanation` یک آبجکت آزاد با کلیدهای واقعی UI است
(`summary`, `deep`, `keyPoint`, `trap`, `whyWrong`) و در دیتابیس به‌شکل `json`
ذخیره می‌شود.

`question_topics` سلسله‌مراتبی است (`parent_id` خودارجاع) و آینهٔ `TOPIC_TREE` در
`mockData.js`. `question.topicPath` legacy به همین ساختار crosswalk می‌شود، نه به
رشتهٔ denormalized.

## مسیر دانشجو

### `GET /api/v1/questions` — عمومی

فیلترهای مجاز (allowlist، هر پارامتر ناشناخته ⇒ **۴۰۰ `UNKNOWN_QUERY_PARAMETER`**):

`subject` (slug) · `topic` (slug، شامل زیرمبحث‌ها) · `chapter` · `lesson` ·
`difficulty` · `type` · `source` · `track` · `year` · `q` · `sort` · `page` · `perPage`

- `status` عمداً فیلتر **نیست**: لایهٔ دانشجو فقط `published` می‌بیند و
  `?status=draft` با ۴۰۰ رد می‌شود، نه اینکه بی‌صدا نادیده گرفته شود.
- صفحه‌بندی اجباری است (`meta.page/perPage/total/lastPage`)، سقف `perPage` از config.
- `sort` ∈ `newest` | `oldest`.
- `q` روی `stem` جست‌وجو می‌کند: `ILIKE` روی PostgreSQL، `LIKE` روی بقیه.
  **صداقت مهندسی:** جست‌وجوی زیررشته‌ای با wildcard ابتدایی از هیچ ایندکس B-tree
  استفاده نمی‌کند. ریسکش با سقف `perPage`، صفحه‌بندی و rate limit مهار شده و
  FTS/trigram برای فاز ۹/۱۳ باقی می‌ماند. ادعای «indexed search» مطرح نمی‌شود.

### `GET /api/v1/questions/{id}`

هیچ پارامتر query نمی‌پذیرد (`ShowQuestionRequest` با allowlist خالی). پیش‌نویس و
آرشیو ⇒ **۴۰۴**.

### `POST /api/v1/questions/{id}/answers` — دانشجو

```jsonc
{ "selectedOptionId": "uuid|null", "attemptKey": "…?", "timeSpent": 120? }
```

- `selectedOptionId` می‌تواند `null` باشد = «بدون پاسخ» (ثبت می‌شود با
  `is_correct = false`، نه خطا).
- گزینه‌ای که به این سؤال تعلق ندارد ⇒ **۴۲۲ `OPTION_NOT_IN_QUESTION`**.
- هیچ فیلد نتیجه‌ای از بدنه خوانده نمی‌شود. در `rules` وجود ندارند و بی‌اثرند:
  `isCorrect`, `correctAnswer`, `correctOptionId`, `score`, `negativeMarking`,
  `xp`, `heartReward`, `reward`, `answeredAt`, `question_version`, `userId`.
- `answered_at` از **ساعت سرور** می‌آید. `timeSpent` کلاینت clamp می‌شود و
  بالاتر از سقف ⇒ ۴۲۲.
- `question_version` همان نسخهٔ سؤال در لحظهٔ پاسخ است — پایهٔ snapshot فاز ۷.
- **idempotency:** `attemptKey` همان کلید است. همان کلید + همان payload ⇒ همان
  پاسخ (بدون Attempt دوم). همان کلید + payload متفاوت ⇒ **۴۰۹**.
- ورود **اجباری** است. ستون `guest_id` و CHECK انحصاری‌اش از روز اول در دیتابیس
  هست تا آزمونک مهمان فاز ۷ بدون migration اضافه شود، ولی مسیر مهمان در این فاز
  ساخته نشد (UI فعلی پاسخ‌دادن بدون ورود ندارد).

### `POST /api/v1/questions/{id}/reports` — دانشجو

`kind` از پنج مقدار بالا؛ `body` سقف طول دارد. `status` و `resolved_at` در
`$fillable` نیستند: **گزارش‌دهنده وضعیت بررسی را تعیین نمی‌کند.** فهرست گزارش‌ها و
تغییر وضعیت کار پنل با `feedback.manage` است و در این فاز ساخته نشد.

### `POST /api/v1/bank/sessions` — دانشجو

```jsonc
{ "filters": { … }, "count": 20?, "mode": "practice|exam"? }
```

**تصمیم معماری: جدول `bank_sessions` ساخته نشد.** state گذرا در cache store
است (Redis در production، array در تست) چون:

- نیاز به resume بلندمدت وجود ندارد؛ تاریخچهٔ واقعی از `question_attempts`
  مشتق می‌شود، نه از این state.
- حجم: هر سشن فقط فهرست شناسه + متادیتای کوچک.
- عمر کوتاه (TTL از config) یعنی سطح حملهٔ کمتر.
- معیار «بدون دلیل جدول تازه نساز» رعایت می‌شود؛ اگر روزی resume واقعی اثبات
  شد، همین سرویس با پیاده‌سازی دیتابیسی جایگزین می‌شود.

ویژگی‌ها: شناسهٔ **opaque** (UUIDv4 سرور-ساخته)، **user-scoped** (شناسهٔ کاربر
داخل state ذخیره و در خواندن چک می‌شود؛ سشن دیگری ⇒ ۴۰۴ بدون افشای تفاوت)،
**بدون کلید پاسخ**، و انتخاب سؤال **کاملاً سمت سرور** (`inRandomOrder` روی
دیتابیس). `questionIds` از کلاینت پذیرفته نمی‌شود؛ اگر honor می‌شد، کلاینت
می‌توانست فهرست را تعیین کند.

## مسیر پنل

| متد و مسیر | مجوز |
|---|---|
| `GET /admin/questions`, `GET /admin/questions/{id}` | `testbank.read` |
| `POST /admin/questions` | `testbank.create` |
| `PATCH /admin/questions/{id}` | `testbank.update` |
| `POST /admin/questions/{id}/publish` | `testbank.publish` |
| `POST /admin/questions/{id}/archive` | `testbank.publish` |

- کلیدهای مجوز **واقعی پنل legacy** هستند؛ هیچ کلید تازه‌ای اختراع نشد
  (`docs/auth.md`).
- **`DELETE` وجود ندارد، عمداً.** سؤالِ استفاده‌شده در `question_attempts`
  (و در فاز ۷ در `exam_questions`) نباید فیزیکی حذف شود؛ FKهای `RESTRICT` هم
  جلوی آن را می‌گیرند. مسیر درست `archive` است.
- `status`, `version`, `author_admin_id`, `published_at`, `legacy_id` از بدنه
  پذیرفته **نمی‌شوند**. `author_admin_id` از سشن ادمین می‌آید.
- `PATCH` نیازمند `version` است؛ عدم تطابق ⇒ **۴۰۹ `VERSION_CONFLICT`**.
- **تغییر درس سؤال ممنوع** و **قبل از نوشتن** رد می‌شود ⇒ ۴۰۹ `SUBJECT_IMMUTABLE`.
  اگر بعد از `update()` چک می‌شد، محتوا ذخیره شده بود و کلاینت ۴۰۹ می‌گرفت —
  یعنی یک نوشتن انجام‌شده که کلاینت فکر می‌کند انجام نشده.
- `version` با هر تغییر محتوایی بالا می‌رود؛ `key_version` فقط وقتی گزینهٔ درست
  عوض شود. این تفکیک از روز اول لازم بود تا فاز ۷ بتواند سؤال را snapshot کند.
- یکپارچگی روابط پیش از نوشتن چک می‌شود: `chapter_id` باید به همان درس تعلق
  داشته باشد (`CHAPTER_SUBJECT_MISMATCH`)، `lesson_id` داخل همان فصل
  (`LESSON_CHAPTER_MISMATCH`)، `topic_id` در همان درس (`TOPIC_SUBJECT_MISMATCH`).
- انتشار بدون کلید، یا کلیدی که به گزینهٔ سؤال دیگری اشاره کند ⇒
  **۴۰۹ `QUESTION_NOT_PUBLISHABLE`**.

## پاداش قلب

آینهٔ قاعدهٔ legacy (`contentStore.js`): **«برای هر سؤال، حداکثر یک قلب در روز
سرور»**. کلید = `<questionId>:<floor(now / 86400)>` و یکتایی روی
`(user_id, attempt_key)` — پس Replay همان پاسخ در همان روز پاداشی تولید نمی‌کند،
مستقل از هر ورودی کلاینت. یکتایی را **دیتابیس** تصمیم می‌گیرد، نه کد.

مقدار پاداش از `config('question_bank.hearts.reward_amount')` می‌آید و
**از کلاینت گرفته نمی‌شود**. `0` یعنی «سیستم قلب فعال نیست» و در آن حالت هیچ
رکوردی نوشته نمی‌شود.

> ⚠️ **قلب ≠ XP.** XP در فاز ۱۲/۱۴ (`xp_transactions`, League) خواهد بود. هیچ
> XP ای در این فاز تولید یا محاسبه نمی‌شود.

## پیکربندی (`config/question_bank.php`)

`pagination` (20/50) · `limits.max_options` (8) · `limits.report_body_max` (1000) ·
`attempts.max_time_spent_seconds` (3600) · `reveal.after_answer` (true) ·
`hearts.reward_amount` (1) · `bank_session` (ttl 120m, count 20/100, modes
`practice|exam`) · `rate_limits` (read 120/m · answer 120/m · report 20/h ·
bank_session 30/m · admin 120/m).

همه از `.env` و «سقف محافظتی/پیش‌فرض پیشنهادی»اند، نه عدد اندازه‌گیری‌شده.

## ایندکس‌ها

| جدول | ایندکس | برای چه کوئری |
|---|---|---|
| `questions` | `(subject_id, status)`, `(topic_id, status)`, `(difficulty, status)`, `(status)`, `(created_at)` | فهرست و فیلترهای UI |
| `questions` | `UNIQUE(legacy_id)` | crosswalk مهاجرت |
| `question_attempts` | `(user_id, question_id, answered_at)`, `(guest_id, …)`, `(question_id, answered_at)` | تاریخچهٔ کاربر و آمار سؤال |
| `question_options` | `UNIQUE(question_id, position)` | ترتیب و یکتایی جایگاه |
| `question_topics` | `UNIQUE(subject_id, parent_id, slug)` + یگانهٔ **جزئی** روی ریشه‌ها | جلوگیری از مبحث تکراری |
| `heart_rewards` | `UNIQUE(user_id, attempt_key)`, `UNIQUE(question_attempt_id)` | قاعدهٔ یک‌قلب‌در‌روز |

ایندکس تازه فقط با کوئری واقعی اضافه می‌شود؛ هیچ ایندکس «شاید لازم شود» ساخته نشد.

## بدهی باز

- **مسیر مهمان ساخته نشد** (UI فعلی پاسخ‌دادن بدون ورود ندارد). ستون و CHECK
  آماده‌اند.
- **پنل بررسی گزارش‌ها** (فهرست + تغییر وضعیت با `feedback.manage`) ساخته نشد؛
  مدل داده از روز اول درست است.
- **آمار سؤال (`stats`, `option_percents`)** عمداً در هیچ payload عمومی نیست —
  خودش کلید را لو می‌دهد. محاسبه‌اش کار فاز ۹ است.
- **FTS/trigram** پیاده نشد؛ `ILIKE` با wildcard ابتدایی index-free است.
- مهاجرت ۵۹ سؤال seed و مبحث‌ها انجام نشد؛ فقط crosswalk طراحی شد
  (`legacy_id`).
