# گزارش نهایی فاز ۱۳ و ۱۴ — مسیر سبز + لیگ و گیمیفیکیشن

> تاریخ: ۳ اکتبر ۲۰۲۶ · Laravel 12 / PHP 8.5 / PostgreSQL (تست: SQLite) · پیمانهٔ قرارداد: OpenAPI v1 **1.7.0**

---

## Phase 13 Status: COMPLETE
## Phase 14 Status: COMPLETE

---

## A. فایل‌های ساخته‌شده

**مهاجرت‌ها**
- `backend/database/migrations/2026_10_03_001100_create_green_path_tables.php` — `green_paths` + `green_path_steps`
- `backend/database/migrations/2026_10_03_001200_create_gamification_tables.php` — `league_seasons`, `league_memberships`, `xp_transactions`, `achievements`, `user_achievements`, `challenges`, `user_challenges`, `streaks`

**کانفیگ**
- `backend/config/green_path.php` — کلیدهای هدف (`semester-excellence`, `basic-sciences`)، افق برنامه ۱۲ هفته، ۱۸۰ دقیقه/روز، ۴۵ دقیقه به‌ازای هر قدم درس، `max_steps=400`، `unlock_window=5`، سقف تقویم ۶۰ روز، TTL کش roadmap = ۱۲۰ ثانیه، rate limit خواندن ۱۲۰/دقیقه و نوشتن ۶۰/دقیقه
- `backend/config/gamification.php` — قواعد XP (`page_completed=20`, `question_correct=5`, `exam_finished=50`, `study_session=10` با حداقل ۹۰۰ ثانیه)، صفحه‌بندی leaderboard (۲۰ / سقف ۵۰)، `neighbor_count=2`، آستانهٔ ۶ نشان

**مدل‌ها** (`backend/app/Models/`)
- `GreenPath.php`, `GreenPathStep.php` (گذارهای مجاز کاربر/موتور جدا شدند؛ تکمیل مشتق‌شده `completionIsDerived()`)
- `LeagueSeason.php`, `LeagueMembership.php`, `XpTransaction.php` (غیرقابل update/delete در `booted()` ⇒ LogicException), `Achievement.php`, `UserAchievement.php`, `Challenge.php`, `UserChallenge.php`, `Streak.php`
- همه با `HasUuids` و `$fillable` خالی (هیچ mass-assignment ناامنی)

**سرویس‌ها** (`backend/app/Services/`)
- `GreenPath/GreenPathService.php` — Create/Generate/Rebuild/StepState/Dependency/Roadmap/Today/Calendar/Performance/UpdateStep + کش roadmap با کلید `green-path:{userId}:roadmap` و باطل‌سازی در هر تغییر
- `Gamification/XpService.php` — دلتای XP فقط از قواعد سرور؛ `request_key = {source_type}:{source_id}`؛ idempotency در سطح DB با `UNIQUE(request_key)` و ترجمهٔ `UniqueConstraintViolationException` به بازپخش
- `Gamification/LeagueService.php` — فصل هفتگی خودکار (`ensureCurrent` + `closeStaleSeasons`)، projection عضویت با `lockForUpdate`، رتبهٔ سروری با tie-breaker قطعی، `publicIdentity` مستعار
- `Gamification/StreakService.php` — امروز=بی‌اثر، دیروز=+۱، قدیمی‌تر=ریست؛ ثبت `longest_count`
- `Gamification/ChallengeService.php` — پیشرفت با `period_key` روزانه/هفتگی، سقف در target، پاداش XP یک‌بار با `request_key = challenge_completed:uch:{id}`
- `Gamification/AchievementService.php` — ارزیابی قطعی/idempotent با درج مقاوم به نقض unique

**رخدادها و شنونده‌ها**
- `backend/app/Events/GreenPath/GreenPathStepCompleted.php`
- `backend/app/Listeners/GreenPath/SyncLearningActivity.php` — پس از commit؛ fail-soft با لاگ ساختاریافته
- `backend/app/Listeners/Gamification/ProcessActivity.php` — پس از commit؛ زنجیرهٔ streak → XP → challenge → achievement

**HTTP**
- `backend/app/Http/Requests/GreenPath/CalendarRangeRequest.php` (سقف بازه، ترتیب from/to)
- `backend/app/Http/Requests/GreenPath/UpdateGreenPathStepRequest.php` (status مجاز + version اجباری)
- `backend/app/Http/Controllers/Api/V1/GreenPathController.php`
- `backend/app/Http/Controllers/Api/V1/LeagueController.php`

**زیرساخت**
- `backend/app/Providers/GamificationServiceProvider.php` (ثبت شنونده‌ها + سه limiter)
- `backend/app/Console/Commands/ReconcileLeagueXp.php` — `gamification:reconcile-xp` (بازچینی projection از دفتر؛ بدون endpoint عمومی)
- `backend/database/seeders/AchievementSeeder.php`, `backend/database/seeders/ChallengeSeeder.php` (تعریف رسمی، بدون دادهٔ جعلی)

**فرانت‌اند (پل، بدون تغییر UI)**
- `src/services/greenPath/greenPathV1.js` — شش تابع v1 + `createGreenPathV1Repository` (لایهٔ افزودنی `serverGreenPath` روی snapshot محلی، fallback کامل روی `not_v1`، PATCH قدم با version و `Idempotency-Key`)
- `src/services/league/leagueV1.js` — چهار تابع v1 با نگاشت camelCase و هویت مستعار
- سوئیچ UI طبق الگوی examV1 به cutover اتمی موکول شد (بخش L)

## B. فایل‌های تغییر یافته

- `backend/routes/api.php` — گروه `me/green-path` با `api.auth + throttle:greenpath_read`، PATCH قدم با `api.origin + api.csrf + throttle:greenpath_write`، چهار مسیر لیگ
- `backend/bootstrap/providers.php` — ثبت `GamificationServiceProvider`
- `backend/database/seeders/DatabaseSeeder.php` — فراخوانی دو seeder تازه
- `backend/tests/Feature/ApiV1ContractTest.php` — ۱۰ مسیر تازه در فهرست مجاز + جدول وضعیت + گارد مسیرهای ممنوع بازنویسی + گارد وجود مسیرهای فاز ۱۳/۱۴
- `backend/docs/openapi.v1.json` — نسخه 1.7.0، تگ‌های `green-path`/`league`، ۱۰ مسیر و ۱۱ schema تازه (GreenPathTarget/Step/Profile/Roadmap/Calendar/Performance، LeagueSeasonInfo/Entry/Overview، ChallengeInfo، AchievementInfo) ⇒ **۹۴ مسیر / ۶۳ schema**
- `src/services/greenPath/greenPathService.js` — repository پیش‌فرض = `createGreenPathV1Repository({ fallback: mock })`
- `scripts/v1-frontend-contract.mjs` — دو پل تازه، ۱۰ schema مصرفی، ۹ چک تودرتو، ممنوعیت‌های تازه (FK خام در `GreenPathStep`، `user_id` در `LeagueEntry`) ⇒ **۸۳ بررسی سبز / ۹ پل**

## C. پایگاه داده

- شناسه‌ها UUID؛ `goal_key` کانونی؛ `plan_version` ≥ ۱
- `green_path_steps`: انحصار هدف (XOR چهار نوع) با CHECK؛ `UNIQUE(path_id, position)`؛ وضعیت‌های `locked/available/in_progress/completed/recommended`؛ `(status='completed') = (completed_at IS NOT NULL)`؛ ایندکس `(path_id,status)` و `due_at`
- `green_paths`: partial unique index «فقط یک مسیر active به‌ازای هر کاربر» (`WHERE status='active'`)؛ FKهای restrict
- `xp_transactions`: **غیرقابل تغییر** — `UNIQUE(request_key)`، CHECK دلتای ناصفر و منبع مجاز (۶ مقدار)، قفل مدل روی update/delete؛ `league_memberships`: `UNIQUE(season_id,user_id)`، CHECK `xp_total>=0`، ایندکس `(season_id,xp_total)`
- `user_challenges`: `UNIQUE(user_id,challenge_id,period_key)`؛ `streaks`: `UNIQUE(user_id,kind)`
- مسیر SQLite (تست) از trait `CreatesPortableTables`؛ ساختار دو-مسیری هم‌ارز تأیید شد
- مهاجرت اجرا و روی PG واقعی در چرخهٔ `backend/scripts/verify-on-pg.sh` بازتأییدشدنی است

## D. APIها

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/v1/me/green-path/profile` | پروفایل برنامه + goal_key/plan_version |
| GET | `/api/v1/me/green-path/roadmap` | نقشهٔ کامل + کش ۱۲۰ثانیه‌ای |
| GET | `/api/v1/me/green-path/today` | قدم‌های امروز + عقب‌افتاده‌ها (سقف ۲۰) |
| GET | `/api/v1/me/green-path/calendar` | بازهٔ بسته `from/to` (سقف ۶۰ روز) |
| GET | `/api/v1/me/green-path/performance` | اعداد از جداول منبع |
| PATCH | `/api/v1/me/green-path/steps/{id}` | فقط status+version؛ ۴۰۹ VERSION_CONFLICT / INVALID_TRANSITION؛ ۴۰۴ مالکیت |
| GET | `/api/v1/me/league` | فصل جاری + membership + rank + همسایه‌ها |
| GET | `/api/v1/league/seasons/{id}/leaderboard` | صفحه‌بندی سروری (سقف perPage=۵۰) + meta |
| GET | `/api/v1/me/challenges` | چالش‌های دورهٔ جاری + پیشرفت واقعی |
| GET | `/api/v1/me/achievements` | تعریف نشان‌ها + وضعیت باز شدن |

پوشش: `{data, meta, requestId}` · خطاها با کد صریح (`NOT_FOUND`, `VERSION_CONFLICT`, `INVALID_TRANSITION`, `VALIDATION_FAILED`) · همگی در OpenAPI 1.7.0 و قفل قرارداد دوسویه.

## E. مجوزها و سیاست‌ها

- هیچ endpoint ادمینی ساخته نشد (طبق قاعدهٔ «فقط با UI واقعی» — UI ادمین وجود ندارد).
- همهٔ مسیرها session-based؛ هویت فقط از سشن، `?userId=`/body بی‌اثر.
- deny-by-default پابرجا؛ برای قدم دیگران ⇒ ۴۰۴ (نه ۴۰۳).
- Rate limiting: `greenpath_read` ۱۲۰/دقیقه، `greenpath_write` ۶۰/دقیقه، `league_read` ۱۲۰/دقیقه با کلید actor.

## F. سرویس‌ها (ناوردایی‌ها)

- وضعیت قدم فقط با موتور: `locked→available→…` طبق `unlock_window`؛ `locked→completed` ممنوع (۴۰۹)؛ تکمیل مشتق‌شده (درس/سؤال/آزمون) از PATCH کلاینت ممنوع (۴۰۹) — فقط از رخداد واقعی یادگیری.
- تاریخ دستکاری‌ناپذیر: «امروز» سرور است؛ پارامتر تاریخ فقط در calendar بستهٔ محدود.
- بازسازی برنامه: archive-first سپس تولید، سپس انتقال قدم‌های action تکمیل‌شده؛ fingerprint محتوا ⇒ rebuild تنبل فقط با تغییر واقعی.
- XP: هیچ مسیر کلاینتی؛ `{"xp":100}` مفهومی ندارد؛ قلب ≠ XP و تبدیل خودکار وجود ندارد.
- رتبه فقط از projection فصل جاری با tie-breaker `user_id ASC`؛ reconciliation از دفتر (دستور artisan) و بدون endpoint عمومی.

## G. رخدادها

- `LessonCompleted` / `QuestionAnswered(isCorrect)` / `ExamFinished` / `StudySessionRecorded` / `GreenPathStepCompleted` — همهٔ اثرها پس از commit (`ShouldHandleEventsAfterCommit`) و fail-soft با لاگ `green_path.sync_failed` / `gamification.listener_failed` (شامل message و محل خطا).
- رخدادها فقط ID/متادیتا حمل می‌کنند.

## H. تست‌ها

- `tests/Feature/GreenPath/GreenPathApiTest.php` (۱۶) — IDOR/مالکیت، mass-assignment، دستکاری status/date، گذارهای نامعتبر، version ⇒ ۴۰۹، کش و باطل‌سازی
- `tests/Feature/GreenPath/GreenPathIntegrationTest.php` (۳) — اتصال واقعی پیشرفت درس/آزمون/سؤال به تکمیل قدم
- `tests/Feature/Gamification/LeagueAndXpTest.php` (۱۲) — XP idempotent، رقابت هم‌زمانی، رتبهٔ قطعی، صفحه‌بندی، هویت مستعار، بازچینی
- `tests/Feature/Gamification/StreakChallengeAchievementTest.php` (۸) — streak، چالش روزانه/هفتگی، نشان‌ها
- `ApiV1ContractTest` — ۱۳ تست / ۱۷۴۴ assertion (سبز)
- خلاصه: `GreenPath` = ۱۹ تست/۱۱۲ assertion · `Gamification` = ۲۰ تست/۱۰۸ assertion · اجرای پوششی فاز ۱–۱۴ = **۶۰۷ تست / ۵۷۲۴ assertion / ۲ شکست از پیش موجود (خارج از محدوده: `/api/v1/media/{id}/access`) / ۲ skip**
- فرانت: `v1:contract:check` = **۸۳ بررسی سبز / ۰ شکست / ۹ پل**

## I. یافته‌های امنیتی

1. **IDOR:** PATCH قدم دیگران ⇒ ۴۰۴ (تست‌شده).
2. **تغییر وضعیت/تاریخ:** گذار نامعتبر و جعل «امروز» ناممکن؛ همه سمت سرور (تست‌شده).
3. **جعل XP:** هیچ ورودی XP از کلاینت؛ `request_key` سرورساخته؛ تکرار ⇒ بازپخش همان تراکنش.
4. **Race:** هم‌زمانی XP با `UNIQUE(request_key)` + `lockForUpdate` روی projection حل شده.
5. **حریم leaderboard:** فقط `display_name` مستعار + `avatar_key` + دانشگاه؛ قفل قراردادی `user_id` در `LeagueEntry` (اسکریپت فرانت).
6. **Mass assignment:** `$fillable` خالی در همهٔ مدل‌های تازه؛ درج‌ها با `forceFill` کنترل‌شده.
7. **SQLi:** کوئری‌ها همه با query builder/Eloquent و پارامتر مقید؛ ورودی عددی با allowlist regex.
8. **No regreso:** گاردهای فازهای قبل (کلید پاسخ، CSRF، Origin) دست‌نخورده و سبز.

## J. تغییرات قرارداد

- OpenAPI v1: `1.6.0 → 1.7.0`؛ ۱۰ مسیر و ۱۱ schema تازه؛ هیچ مسیر/فیلد موجودی تغییر نکرد (سازگاری رو به جلو).
- قفل دوسویه: `ApiV1ContractTest` (بک‌اند) + `v1:contract:check` (فرانت، ۸۳ بررسی).

## K. سازگاری با Legacy

- سرور Node legacy دست‌نخورده؛ `data:check` همان وضعیت از پیش موجود (۲۲ خطا / ۲۳ هشدار — نه رگرسیون).
- localStorage هرگز منبع حقیقت نیست؛ در پل مسیر سبز فقط به‌عنوان fallback محلی وقتی v1 سرو نمی‌شود باقی مانده و `reason: 'not_v1'` مسیر legacy را بازمی‌گرداند.
- UI لیگ و مسیر سبز بدون تغییر؛ دادهٔ v1 به‌صورت لایهٔ افزودنی (`serverGreenPath`) در دسترس است.

## L. TODO / محدودیت‌ها

1. **سوئیچ UI به v1 اتمی است:** پل‌ها ساخته و قفل شدند ولی importهای UI (leagueService و نگاشت شناسهٔ محتوای درس v1↔موضوع محلی مسیر سبز) به cutover موکول است — همان الگوی examV1.
2. فصل لیگ هفتگی است؛ سیاست ارتقا/تنزل بین لیگ‌ها (tiers) در v1 وجود ندارد و UI فعلی tiers را از mock می‌خواند.
3. `/api/v1/media/{id}/access` — دو شکست از پیش موجود، خارج از محدودهٔ این فاز.
4. Bank Session در production نیازمند Redis است (بدهی سابق، تغییر نکرده).
5. Seeding نشان/چالش در deploy production باید صریح اجرا شود (`db:seed`).

## M. نقض محدوده

- هیچ‌کدام. پرداخت، اعلان، AI، جست‌وجو، داشبورد کامل ادمین، Docker/CD و همهٔ اقلام Scope Lock لمس نشدند.
