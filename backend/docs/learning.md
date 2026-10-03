# فاز ۵ — یادگیری (پیشرفت + نشست مطالعه)

دامنهٔ **Learning** مالک `learning_progress` و `study_sessions` است. هیچ‌کدام از
این دو با «تلاش آزمون» (`question_attempts`) یا «تلاش آزمون دوره‌ای»
(`exam_attempts` فاز ۷) قاطی نمی‌شوند؛ سه مفهوم جدا با سه نویسندهٔ جدا.

## مدل داده

### `learning_progress`

| ستون | معنا | چه‌کسی می‌نویسد |
|---|---|---|
| `user_id` | مالک | سرویس، از **سشن** |
| `lesson_page_id` | صفحهٔ درس | سرویس، از مسیر |
| `status` | `not_started` \| `in_progress` \| `completed` | سرویس |
| `last_position` | آخرین محل مطالعه | سرویس (کلاینت فقط عدد خام می‌دهد) |
| `seconds_spent` | مجموع ثانیهٔ مطالعه | سرویس (دلتا) |
| `version` | optimistic lock | سرویس |
| `completed_at` | زمان گذار به `completed` | سرور |

- `UNIQUE(user_id, lesson_page_id)` — یک رکورد برای هر (کاربر، صفحه).
- `CHECK(seconds_spent >= 0)`, `CHECK(version >= 1)`, `CHECK(status in …)`.
- ایندکس‌ها: `(user_id, status)` برای خلاصهٔ پیشرفت، `(user_id, updated_at)` برای
  «آخرین فعالیت».

**سه حالت کافی است.** فهرست از Frontend واقعی استخراج شد
(`src/services/learning/progressService.js` و مصرف‌کننده‌هایش): فقط
«شروع‌نشده / در جریان / تمام‌شده» وجود دارد. حالت چهارم (مثل `skipped`) هیچ
مصرف‌کننده‌ای ندارد و اضافه نشد.

### `study_sessions`

| ستون | معنا |
|---|---|
| `user_id` | مالک (از سشن) |
| `lesson_page_id` | اختیاری؛ اگر بیاید باید صفحهٔ **قابل مشاهده** باشد |
| `source` | `lesson` \| `micro_lesson` \| `pomodoro` |
| `started_at` / `ended_at` | UTC / `timestamptz` |
| `duration_sec` | **مشتق‌شده** از بازه (یا عدد کلاینت، اگر بازه بسته نباشد) |

`source` عمداً باریک‌تر از پیش‌نویس Blueprint است. سه مقدار بالا در Frontend
قابل اثبات‌اند (خوانندهٔ درس، میکرودرس، تایمر پومودورو در
`src/styles/motion.css`). `course` و `manual` هیچ مصرف‌کننده‌ای نداشتند، پس وارد
enum نشدند — و چون CHECK دارد، افزودن مقدار تازه به migration نیاز دارد
(تصمیم عمدی: enum بی‌مصرف نباید بی‌صدا بزرگ شود).

## قرارداد API

### `GET /api/v1/me/progress`

خلاصهٔ **مشتق** (در هیچ ستونی ذخیره نمی‌شود):

```jsonc
{ "data": { "progress": {
  "totals": { "tracked_pages": 3, "completed_pages": 2, "seconds_spent": 240,
              "study_sessions": 1, "study_seconds": 1800 },
  "courses": [ { "course_id": "…", "course_slug": "…", "tracked_pages": 3,
                 "completed_pages": 2, "total_pages": 3, "percent": 67,
                 "seconds_spent": 240 } ] } } }
```

مخرج کسر `percent` = صفحه‌های **قابل مشاهدهٔ** دوره، یعنی زنجیرهٔ کامل
`subject → course → chapter → lesson → page` با وضعیت `published`. اگر فقط وضعیت
خودِ صفحه چک می‌شد، صفحهٔ منتشرشده زیر درس پیش‌نویس هم شمرده می‌شد و درصد
هیچ‌وقت به ۱۰۰ نمی‌رسید.

### `GET /api/v1/me/progress/pages/{id}`

اگر رکوردی نباشد، شکل «شروع‌نشده» برمی‌گردد با `id: null` و `version: 0` — همان
مقداری که کلاینت باید در اولین `PUT` بفرستد. کلاینت لازم نیست `null`-چک کند.

صفحهٔ نامرئی (`draft` یا زیر درس/فصل/دوره/درسِ غیرمنتشر) **۴۰۴** می‌گیرد، نه
۴۰۳: وجود پیش‌نویس نباید از روی کد وضعیت لو برود.

### `PUT /api/v1/me/progress/pages/{id}`

```jsonc
// بدنه — فقط همین چهار فیلد
{ "version": 0, "lastPosition": 120, "completed": true, "secondsSpent": 45 }
```

| فیلد | قاعده |
|---|---|
| `version` | **اجباری**. `0` = «رکوردی ندارم». عدم تطابق ⇒ **۴۰۹ `VERSION_CONFLICT`** |
| `lastPosition` | `0..max_position`؛ خارج از بازه ⇒ ۴۲۲. **یکنوا نیست** |
| `completed` | boolean. **چسبنده**: بدون reset صریح برنمی‌گردد |
| `secondsSpent` | **دلتا**؛ `0..max_seconds_per_update`؛ بیشتر ⇒ ۴۲۲ |

- هویت فقط از سشن: `userId` / `user_id` در بدنه هیچ اثری ندارد.
- `status`، `id`، `completedAt` در بدنه نادیده گرفته می‌شوند (در `rules` نیستند،
  پس به `validated()` راه ندارند).
- هدر اختیاری `Idempotency-Key`: همان کلید + همان payload ⇒ پاسخ بازپخش
  می‌شود و `seconds_spent` دو بار اضافه **نمی‌شود**؛ همان کلید + payload متفاوت
  ⇒ **۴۰۹ `IDEMPOTENCY_KEY_REUSED`**.
- `completed` فقط سمت سرور تعیین می‌شود؛ کلاینت نمی‌تواند بگوید «تمام شد» و
  بی‌چون‌وچرا پذیرفته شود — سرور صفحه را اول اعتبارسنجی می‌کند.
- پاسخ هیچ‌وقت `user_id` برنمی‌گرداند.

**idempotency در دیتابیس، نه در کد:** `UNIQUE(scope, actor_key, request_key)` تنها
تضمینِ race-safe است؛ بررسی «قبلاً دیدم؟» در حافظه دو درخواست هم‌زمان را رد
نمی‌کند.

### `POST /api/v1/me/study-sessions`

```jsonc
{ "startedAt": "…", "endedAt": "…", "durationSec": 1500,
  "source": "pomodoro", "lessonPageId": "…?" }
```

مرز اعتماد: **کلاینت بازه می‌گوید، سرور مدت را تعیین می‌کند.**

| وضعیت | کد |
|---|---|
| `startedAt` جلوتر از `now + skew` | ۴۲۲ `TIMESTAMP_IN_FUTURE` |
| `endedAt < startedAt` | ۴۲۲ `TIMESTAMP_RANGE_INVALID` |
| `startedAt` قدیمی‌تر از `max_backdate_days` | ۴۲۲ `TIMESTAMP_TOO_OLD` |
| `durationSec` اعلامی ≠ مدت مشتق (بیش از تلورانس) | ۴۲۲ `DURATION_MISMATCH` |
| مدت > `max_duration_seconds` | ۴۲۲ `DURATION_TOO_LONG` |
| `source` بیرون از allowlist | ۴۲۲ |
| `lessonPageId` نامرئی | ۴۰۴ |

مقدار ذخیره‌شده در `duration_sec` همان **مشتق** است، نه عدد کلاینت.

## پیکربندی (`config/learning.php`)

همهٔ اعداد از `.env` می‌آیند و «سقف محافظتی» هستند، نه benchmark:

| کلید | پیش‌فرض | نقش |
|---|---|---|
| `progress.max_seconds_per_update` | 600 | سقف دلتای هر درخواست |
| `progress.max_position` | 10000 | سقف `lastPosition` |
| `study_sessions.max_duration_seconds` | 14400 | سقف مدت |
| `study_sessions.max_clock_skew_seconds` | 120 | تلورانس ساعت کلاینت |
| `study_sessions.max_backdate_days` | 30 | عقب‌ترین تاریخ مجاز |
| `study_sessions.duration_tolerance_seconds` | 30 | تلورانس اختلاف مدت |
| `rate_limits.*` | read 240/m · write 120/m · session 60/m | throttle نام‌دار |

## رویدادها

`ProgressUpdated` · `LessonCompleted` · `StudySessionRecorded` — فقط شناسه و
metadata حداقلی حمل می‌کنند (نه محتوای محرمانه، نه متن صفحه).

## بدهی باز

- **CRUD ادمین محتوا** (فاز ۴) ساخته نشد؛ محتوا فعلاً فقط خواندنی است.
- `EntitlementGate` بایندش `NullEntitlementGate` است و `isEnforcing() === false`
  برمی‌گرداند. هیچ پرداخت/اشتراکی mock نشده — فاز ۱۸ مالک واقعی است.
- زمان‌بندی autosave کلاینت اندازه‌گیری نشد؛ سقف‌ها محافظتی‌اند.
