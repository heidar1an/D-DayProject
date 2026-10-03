# فاز ۸ — تحلیل‌ها (Analytics)

دامنهٔ **Analytics** یک دامنهٔ **خواندنی/تجمیعی** است، نه منبع حقیقت تازه.

> **قاعدهٔ بنیادی:** هیچ جدول مشتق‌شده‌ای نوشته نمی‌شود. هر عدد از جداول دامنه
> محاسبه و کوتاه‌مدت cache می‌شود. اگر روزی یک عدد با جدول دامنه اختلاف داشت،
> **جدول دامنه درست است** و محاسبه باگ دارد.

## منبع هر عدد (الزامی)

| عدد | منبع | جدولی که **نیست** |
|---|---|---|
| زمان مطالعه | `study_sessions.duration_sec` | ❌ `analytics_events` |
| زمان خواندن | `learning_progress.reading_seconds` | ❌ `study_sessions` |
| صفحهٔ دنبال‌شده / کامل‌شده | `learning_progress` | ❌ `analytics_events` |
| درس کامل‌شده | `learning_progress` با `lesson_pages.lesson_id` متمایز | ❌ شمارش صفحه |
| دقت تمرین | `question_attempts` | ❌ `exam_answers` |
| دقت آزمون | `exam_results` (فقط منتشرشده) | ❌ `question_attempts` |
| رتبه | `exam_results` منتشرشده و معتبر | ❌ نمرهٔ کلاینت · `analytics_events` · localStorage |
| روند زمانی | `study_sessions` + `learning_progress` | ❌ `analytics_events` |
| جریان فعالیت | `analytics_events` (فقط نمایشی) | — |

> ⚠️ **`study_seconds` و `reading_seconds` هرگز با هم جمع نمی‌شوند.** دو مفهوم
> متفاوت‌اند: یکی «سشن مطالعهٔ ثبت‌شده»، دیگری «زمان روی صفحهٔ درس». جمع‌کردنشان
> یک عدد بی‌معنا می‌سازد که هیچ‌جا در محصول وجود ندارد. در تست‌ها
> (`study 1500s ≠ reading 120s`) این تفکیک قفل شده است.

> ⚠️ **دو دقت، دو مخرج جدا.** `exam_answers` هرگز در مخرج دقت تمرین نمی‌آید و
> `question_attempts` هرگز در مخرج دقت آزمون. آزمون و تمرین دو رفتار متفاوت‌اند؛
> مخلوط‌کردنشان هم آمار تمرین و هم آمار آزمون را غلط می‌کند.

## تعریف دقیق هر متریک

### `GET /api/v1/me/analytics/overview`

| فیلد | تعریف |
|---|---|
| `study_seconds` | `Σ study_sessions.duration_sec` کاربر |
| `reading_seconds` | `Σ learning_progress.reading_seconds` کاربر |
| `tracked_pages` | تعداد `learning_progress` با `page_id` غیرتهی |
| `completed_pages` | تعداد `learning_progress` با `completed_at` غیرتهی |
| `completed_lessons` | تعداد **درس** متمایز (join به `lesson_pages.lesson_id`)، نه تعداد صفحه |
| `practice_questions` | تعداد `question_attempts` کاربر |
| `practice_accuracy` | `correct / total` روی `question_attempts` |
| `exams_taken` | تعداد `exam_results` **منتشرشده** |
| `recent_activity` | آخرین رویدادهای `analytics_events` (سقف از config) |

**«کاربر بدون داده» صفر می‌گیرد، نه خطا.** هیچ‌کدام از این مسیرها برای کاربر
خالی ۴۰۴ یا ۵۰۰ نمی‌دهند — شکل پاسخ ثابت است.

### `GET /api/v1/me/analytics/topics`

گروه‌بندی بر پایهٔ **`question_attempts` واقعی** با join به `question_topics` و
`subjects`. فقط مباحثی که کاربر واقعاً رویشان پاسخ داده ظاهر می‌شوند.

- `accuracy = correct / total` در همان مبحث.
- سقف ردیف از `config('analytics.limits.max_topic_rows')` (۲۰۰).
- **`exam_answers` نادیده گرفته می‌شود** — آمار مبحث فقط از تمرین می‌آید.

### `GET /api/v1/me/analytics/exams`

- فقط `exam_results` که آزمونشان **منتشرشده** است (`result_release_at` رسیده).
  نتیجهٔ منتشرنشده در هیچ تجمیعی نمی‌آید و **پس از انتشار ظاهر می‌شود** (تست شده).
- `accuracy = correct / (correct + wrong + blank)` — یعنی «بی‌پاسخ» هم در مخرج
  هست، چون در آزمون واقعی سؤال بی‌پاسخ یک انتخاب است، نه غیبت.
- `subject_performance` از `exam_results.subject_breakdown` **ذخیره‌شده** خوانده
  می‌شود، نه بازمحاسبه از پاسخ‌ها. منبع حقیقت تصحیح، `ExamGrader` است.
- `teraz` نمایش داده نمی‌شود (`null`) چون محاسبه نمی‌شود.

### `GET /api/v1/me/analytics/progress`

| پارامتر | مقدار |
|---|---|
| `bucket` | `daily` \| `weekly` \| `monthly` (از `config('analytics.buckets')`) |
| `tz` | منطقهٔ زمانی معتبر (IANA) |
| `from` / `to` | بازهٔ اختیاری |

- **درصد دوره از زنجیرهٔ منتشرشدهٔ قابل‌مشاهده** محاسبه می‌شود: صفحه‌های
  منتشرنشده در مخرج نمی‌آیند، وگرنه کاربر هرگز ۱۰۰٪ نمی‌دید.
- `trend` زمان مطالعه و تکمیل‌ها را در باکت‌های روزانه/هفتگی/ماهانه می‌ریزد.
- **Timezone مرز باکت را جابه‌جا می‌کند ولی مجموع را نه.** دیتابیس همیشه UTC
  می‌ماند و تبدیل **در لایهٔ تجمیع** انجام می‌شود. تست این ناوردایی را قفل کرده
  (`sum` ثابت می‌ماند، مرزها عوض می‌شوند).
- `tz` نامعتبر ⇒ **۴۲۲ `VALIDATION_FAILED`** با پیام `The selected tz is invalid.`
- `tz` هرگز hardcode نیست؛ از پروفایل کاربر/`app.timezone` می‌آید.

## API — قرارداد

| متد و مسیر | توضیح |
|---|---|
| `GET /api/v1/me/analytics/overview` | نمای کلی |
| `GET /api/v1/me/analytics/topics` | عملکرد مبحثی |
| `GET /api/v1/me/analytics/exams` | عملکرد آزمون |
| `GET /api/v1/me/analytics/progress` | پیشرفت و روند |

- **ورود اجباری.** `user_id` **فقط** از سشن می‌آید. `?userId=` با
  **۴۰۰ `UNKNOWN_QUERY_PARAMETER`** رد می‌شود، نه اینکه نادیده گرفته شود —
  وگرنه یک اشتباه کلاینت به «دیدن آمار کاربر دیگر» تبدیل می‌شد.
- پارامتر خارج از allowlist ⇒ **۴۰۰ `UNKNOWN_QUERY_PARAMETER`**.
- rate limit: `read` ۱۲۰/m.
- شکل پاسخ همان envelope v1 است: `{ data, meta?, requestId }`.

## `analytics_events` — جدول رویداد

`analytics_events` **منبع حقیقت نیست**. اولویت داده‌ای همیشه «جداول دامنه >
رویداد تحلیلی» است.

- **typed و بسته.** `event_types` در `config/analytics.php`:
  `lesson_completed`, `question_answered`, `study_session_recorded`,
  `exam_started`, `exam_finished`. نوع تازه فقط با **تولیدکنندهٔ واقعی**
  (Domain Event موجود) اضافه می‌شود. نوع ناشناخته ⇒ `UNKNOWN_EVENT_TYPE`.
- **بدون ingestion کلاینت.** هیچ endpointی برای نوشتن رویداد از سمت کلاینت
  وجود ندارد. رویدادهای حساس (`exam_finished`, `lesson_completed`) **فقط** از
  Domain Event سمت سرور تولید می‌شوند. اگر ingestion کلاینت باز بود، کاربر
  می‌توانست «درس تمام کردم» جعل کند.
- **dedup سرور-ساخته.** `event_key` یکتاست (`exam.finished:{attemptId}`).
  انتشار دوبارهٔ یک Domain Event رکورد تکراری نمی‌سازد — همان چیزی که
  at-least-once بودن listener ها را بی‌ضرر می‌کند. سه بار `finish` ⇒
  **دقیقاً یک** `exam_finished`.
- **بدون نمره در رویداد.** `exam_finished` دقیقاً سه کلید دارد:
  `['exam_id', 'status', 'reason']`. نه `score`، نه `percentage`، نه
  `correct_count`. علتش ساده است: نمره در `exam_results` است؛ تکرارش در رویداد
  یعنی دو منبع حقیقت که می‌توانند واگرا شوند.
- **PII.** `properties` سقف بایت دارد (`max_properties_bytes` = ۲۰۴۸) و کلیدهای
  ممنوع case-insensitive و **بر پایهٔ «شامل بودن»** چک می‌شوند تا
  `access_token`/`sessionId`/`password_hash` هم گرفته شود. نقض ⇒
  `FORBIDDEN_PROPERTY_KEY:{key}` و **صفر رکورد نوشته‌شده**.
  فهرست: `password, passwd, token, secret, authorization, cookie, session,
  sessionid, session_id, apikey, api_key, private_key, card, cvv, iban,
  national_id, nationalcode, phone, mobile, email, address, ip`.
- **حذف حساب آمار را نمی‌شکند.** `user_id` با `set null` حذف می‌شود تا تجمیع
  باقی بماند، ولی هیچ ستون هویتی دیگری باقی نمی‌ماند که هویت را بازگرداند.
- **فقط autosave های progress رویداد تولید نمی‌کنند.** `lesson_completed`
  دقیقاً یک بار ثبت می‌شود، نه در هر autosave.

### نگاشت Domain Event → رویداد

| Domain Event | `event_type` | `event_key` |
|---|---|---|
| `ExamStarted` | `exam_started` | `exam.started:{attemptId}` |
| `ExamFinished` | `exam_finished` | `exam.finished:{attemptId}` |
| `LessonCompleted` | `lesson_completed` | `lesson.completed:{userId}:{lessonId}` |
| `QuestionAnswered` | `question_answered` | `question.answered:{attemptId}` |
| `StudySessionRecorded` | `study_session_recorded` | `study.session:{sessionId}` |

رویدادها با `ShouldHandleEventsAfterCommit` مصرف می‌شوند تا نوشتن رویداد پس از
**commit** تراکنش دامنه انجام شود، نه داخل آن.

## کش

`AnalyticsCache` یک لایهٔ **per-user و نسخه‌آگاه** است:

- کلید همیشه `userId` + نام بخش + **شمارندهٔ invalidation** را در خود دارد.
- **cache مشترک بین کاربران ممنوع است.** `AnalyticsService` یک لایهٔ نازک روی
  چهار سرویس است و کش را در **یک نقطه** اعمال می‌کند؛ اگر هر سرویس خودش کش
  می‌کرد، احتمال فراموش‌کردن `userId` در کلید و نشتی بین کاربران وجود داشت.
- invalidate با شمارنده انجام می‌شود (۰→۱→۲)، نه با حذف کلیدها. پس کلیدهای
  کهنه خودشان بی‌اعتبار می‌شوند و نیازی به پیمایش ندارند.
- **رویدادهای دامنهٔ واقعی کش را باطل می‌کنند** (تست: ۰ → ۹۰۰). باطل‌کردن یک
  کاربر به کاربر دیگر دست نمی‌زند (تست شده).
- TTL از `config('analytics.cache.ttl_seconds')` (۶۰s). با
  `ANALYTICS_CACHE_ENABLED=false` کامل خاموش می‌شود.

## Retention و پاک‌سازی

```
php artisan analytics:prune-events [--days=] [--limit=5000] [--apply]
```

- **پیش‌فرض dry-run است.** نوشتن واقعی فقط با `--apply`.
- **فقط `analytics_events`.** هرگز به `exam_results`, `learning_progress`,
  `question_attempts` دست نمی‌زند — این‌ها تاریخچهٔ واقعی‌اند.
- حذف دسته‌ای و قابل‌کران.
- `--days=0` **صریحاً رد می‌شود**، نه اینکه بی‌صدا به مقدار config برگردد
  (باگ `?:` که `0` را falsy می‌گیرد).
- نگه‌داشت پیش‌فرض: `config('analytics.retention_days')` = ۴۰۰ روز.

## پیکربندی (`config/analytics.php`)

`event_types` · `max_properties_bytes` (2048) · `forbidden_property_keys` (۲۲ کلید) ·
`retention_days` (400) · `cache` (enabled/ttl 60/prefix) · `limits`
(recent 20، recent_results 10، trend_buckets 90، topic_rows 200) ·
`buckets` (daily/weekly/monthly) · `rate_limits` (read 120/m).

همه از `.env`؛ هیچ عدد hardcode نیست.

## ایندکس‌ها

| جدول | ایندکس | برای چه کوئری |
|---|---|---|
| `analytics_events` | `UNIQUE(event_key)` | dedup سرور-ساخته |
| `analytics_events` | `(user_id, occurred_at)` | نمای کلی و جریان فعالیت |
| `analytics_events` | `(user_id, event_type, occurred_at)` | روند و شمارش نوع |
| `analytics_events` | `(event_type, occurred_at)` | پاک‌سازی retention |

ایندکس‌های تجمیع روی `exam_results` (`(exam_id, percentage)`,
`(user_id, graded_at)`) و `question_attempts` در فازهای ۶/۷ ساخته شدند و همین‌جا
مصرف می‌شوند. `EXPLAIN (ANALYZE)` روی ۸ کوئری اجرا شد و ایندکس‌ها درست انتخاب
می‌شوند.

## کارایی

- **بدون جدول pre-aggregate.** چون حجم فعلی و الگوی مصرف آن را توجیه نمی‌کند و
  جدول مشتق‌شده یک منبع حقیقت دوم می‌سازد.
- **تنها نقطهٔ مقیاس‌پذیری شناخته‌شده** در فاز ۷/۸: `order by random()` در Bank
  Session (فاز ۶) — نه Analytics.
- بار محاسبه با کش ۶۰ ثانیه‌ای و صفحه‌بندی/سقف ردیف مهار شده است.
- **تست بار انجام نشد.** هیچ عدد throughput ای اندازه‌گیری نشده و ادعایی هم
  مطرح نمی‌شود.

## بدهی باز

- **`analytics_events` پر می‌شود ولی هیچ dashboard مصرف‌کنندهٔ کامل ندارد** —
  UI فعلی فقط `overview.recent_activity` را نشان می‌دهد.
- **بدون ingestion کلاینت** — عمدی.
- **بدون جدول pre-aggregate** — عمدی.
- **بدون export/CSV و بدون گزارش دوره‌ای** — مصرف‌کنندهٔ واقعی ندارد.
- **تست بار و رفتار واقعی Redis در تولید** اندازه‌گیری نشده.
