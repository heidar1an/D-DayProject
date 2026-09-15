# لیگ تپش — معماری

لایهٔ Gamification و رقابتی تپش: کاربران با فعالیت آموزشی «قلب» می‌گیرند و بر اساس آن
در لیگ‌ها، رتبه‌ها و چالش‌ها قرار می‌گیرند.

## نقشهٔ فایل‌ها

```
src/services/league/
├── mockData.js        ← موجودیت‌های دامنه (Mock) + قرارداد دقیق شکل داده
└── leagueService.js   ← لایهٔ سرویس با امضای API واقعی (فعلاً Mock + تأخیر شبکه)

src/layout/dashboard/league/
├── LeagueSection.jsx  ← پوسته: هیرو (League Header)، نردبان لیگ، ناوبری، توست قلب
├── Leaderboard.jsx    ← سه مقیاس رقابت، پودیوم، کاربر چسبان، صفحه‌بندی
├── Challenges.jsx     ← روزانه / هفتگی / نبردهای رقابتی / پروتوتایپ دوئل
├── LeagueAchievements.jsx ← دستاوردها با دسته و کمیابی
├── LeagueProfile.jsx  ← آمار، مقایسهٔ چندمقیاسی، تقویم استریک، دفتر قلب، فصل‌ها، ریوارد، حریم خصوصی
├── leagueShared.jsx   ← زبان بصری «قلب»، آواتار، مدال، نشان لیگ، نوار پیشرفت، اسکلت
├── league.css         ← انیمیشن‌ها (با گارد prefers-reduced-motion)
└── useAsyncData.js    ← لودینگ / خطا / Retry
```

## ۱. مدل داده (Entity ها)

`User (لایهٔ league)` · `University` · `HeartTransaction` · `League (tier)` · `LeagueGroup` ·
`Season` · `Challenge / Battle` · `ChallengeParticipation` · `Achievement / UserAchievement` ·
`Leaderboard` · `Reward` · `Title` · `Notification` · `Streak` · `Duel`

شکل دقیق هر موجودیت در `mockData.js` مستند شده و همان قرارداد Backend آینده است.

## ۲. قلب و اقتصاد آن (Heart Economy)

- قلب واحد امتیاز است و فقط از طریق `HeartTransaction` ثبت می‌شود — هر قلب منبع و تاریخ دارد
  («دفتر قلب» در پروفایل). قلب هرگز مستقیم روی User ذخیره/افزایش نمی‌شود.
- مقادیر ریوارد (پاسخ صحیح +۲، تکمیل مبحث +۲۰، چالش روزانه +۵۰ …) Hard-Code نیستند؛
  در نسخهٔ واقعی از پنل مدیریت (Activity → Heart Reward) خوانده می‌شوند.
- جلوگیری از تورم و سوءاستفاده (Anti-Cheat):
  - همهٔ rewardها فقط با **اعتبارسنجی سمت سرور** ثبت می‌شوند (`POST /league/challenges/:id/claim`).
  - الگوهای غیرعادی (تکرار بی‌نهایت، رفتار بات‌مانند، الگوی مطالعهٔ ناممکن) در لایهٔ
    Transaction قابل تشخیص‌اند.
- Analytics: `trackEvent` در سرویس، رویدادهای `league_view`, `challenge_start`,
  `challenge_complete`, `heart_earned`, `achievement_unlock`, `rank_changed`, `season_join`,
  `promotion`, `demotion`, `streak_extended` را ثبت می‌کند.

## ۳. API Contract (قرارداد با Backend)

- `GET /api/league/overview` — من، لیگ فعلی، نردبان، فصل، رویدادها، فاصله تا رتبهٔ بعد
- `GET /api/league/leaderboard?scope=university|universities|global&metric=total|avg|active&offset=` — صفحهٔ رتبه‌ها + `nextOffset`
- `GET /api/league/challenges` — روزانه/هفتگی/نبرد/دوئل
- `GET /api/league/achievements` — دستاوردها + تعداد باز‌شده
- `GET /api/league/profile-details` — عناوین، ریواردها، دفتر قلب، تقویم استریک، تاریخچهٔ فصل‌ها
- `GET /api/league/notifications` — اعلان‌های شخصی لیگ (رتبه، رقیب، نبرد، رویداد)
- `GET /api/league/friends/notifications` — اقدامات، نتایج و دستاوردهای «فقط همخوان‌ها»
- `PATCH /api/league/notifications` — علامت‌گذاری اعلان‌های لیگ به‌عنوان خوانده‌شده
- `PATCH /api/league/friends/notifications` — علامت‌گذاری اعلان‌های همخوان‌ها به‌عنوان خوانده‌شده
- `POST /api/league/challenges/:id/claim` — ثبت قلب با اعتبارسنجی سرور
- `POST /api/league/battles/:id/join` — عضویت در نبرد
- `POST /api/league/duels` — دوئل (نسخهٔ نهایی)
- `POST /api/league/events` — Analytics

اتصال واقعی فقط بدنهٔ توابع `leagueService.js` را تغییر می‌دهد؛ UI دست نمی‌خورد.

### سطح اعلان‌ها

اعلان‌ها یک سطح واحد دارند: لایهٔ `NotificationsSection` که از زنگولهٔ هدر اصلی داشبورد باز
می‌شود و دو منبع بالا (لیگ + همخوان‌ها) را در یک فهرست واحد جمع می‌کند. نه کادر پروفایل
داشبورد و نه سربرگ لایهٔ لیگ، اعلان جداگانه ندارند.

## ۴. کنترل از پنل مدیریت (بدون Hard-Code در Frontend)

تعریف لیگ/فصل/چالش/ریوارد/دستاورد، مقادیر Heart Reward، افزودن دانشگاه، انتخاب معیار
رتبه‌بندی دانشگاه‌ها (مجموع / میانگین / دانشجویان فعال / نرخ مشارکت)، قوانین صعود و سقوط
(پیش‌فرض: Top3 صعود، Bottom3 سقوط)، مدیریت Leaderboard و رویدادها — همه سمت سرور.
در UI همین اثر را می‌بینید: تب «دانشگاه‌ها» معیار رتبه‌بندی قابل‌تعویض دارد.

## ۵. رتبه‌بندی دانشگاه‌ها

معیار پیش‌فرض «مجموع قلب» است اما معماری برای `Average Heart`, `Active Students`,
`Participation Rate`, `Performance Score` آماده است تا تعداد دانشجو مزیت ناعادلانه نسازد.

## ۶. فصل‌ها و Matchmaking

- فصل ۳۰ روزه؛ پایان فصل: ثبت رتبه‌ها، ریوارد، ریست نرم و ذخیرهٔ تاریخچه (تب پروفایل).
- هر فصل کاربران در `LeagueGroup` (پیش‌فرض ۱۰۰ نفره) قرار می‌گیرند؛ آستانهٔ صعود/سقوط قابل تنظیم است.

## ۷. دوئل و توسعهٔ آینده

دوئل فعلاً پروتوتایپ است (کارت VS در چالش‌ها) ولی مدل `Duel` و مسیر API تعریف شده.
افزودنی‌های آیندهٔ مسیر: تیم/کلان، Tournament، Season Pass، چالش‌های AI-محور،
رتبه‌بندی درسی (فیزیولوژی، بیوشیمی…)، سیستم ELO-مانند و Skill Rating.

## ۸. UX و دسترس‌پذیری

- چند ثانیهٔ اول صفحه: قلب، رتبه، لیگ، فاصله تا رتبهٔ بعدی، چالش فعال و جدول — همه بالای صفحه.
- کاربر همیشه نوار چسبان جایگاه خودش را در جدول می‌بیند («۲۵ قلب تا رتبه ۱۶»).
- روانشناسی مثبت: پیام‌ها روی پیشرفت شخصی‌اند («فقط ۳۰ قلب تا رتبه بعدی»)، نه مقایسهٔ تحقیرآمیز.
- Skeleton هم‌اندازه با محتوا (بدون Layout Shift)، حالت خطا با Retry، حالت خالی گرم.
- تمام انیمیشن‌ها با `prefers-reduced-motion` خاموش می‌شوند.
- اعداد فارسی در تمام UI؛ آواتارها از سیستم آواتار خود تپش ساخته می‌شوند.
