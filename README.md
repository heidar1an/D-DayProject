# تپش — سند مرجع پروژه

> **این فایل برای هوش مصنوعی نوشته شده است.** هدفش این است که هر مدلی که فایل‌های این پروژه را
> می‌گیرد، بدون خواندن ۲۶۷ فایلِ `src/` بتواند بفهمد پروژه چه بخش‌هایی دارد، هر بخش کجاست،
> داده از کجا می‌آید و چه قواعدی را نباید بشکند.
>
> **قاعدهٔ نگه‌داری:** هر بار بخشی اضافه، حذف یا جابه‌جا شد، **همان لحظه** این فایل را به‌روز کن.
> چک‌لیست دقیق در [بخش ۱۴](#۱۴-چکلیست-افزودن-یا-حذف-یک-بخش).

---

## ۰. خلاصهٔ فوری (اگر فقط ۳۰ ثانیه وقت داری)

| پرسش | پاسخ |
|---|---|
| این پروژه چیست؟ | «تپش» — پلتفرم یادگیری پزشکی و آمادگی آزمون‌های علوم پزشکی. فارسی، RTL، تم تیره. |
| استک | React 19 + Vite 7 + Tailwind 4. **بدون TypeScript، بدون Next.js، بدون کتابخانهٔ UI، بدون کتابخانهٔ نمودار.** |
| بک‌اند | فقط `node:http` خالص. **هیچ وابستگی سروری نصب نشده** (بدون Express، بدون دیتابیس واقعی). |
| داده کجاست؟ | Mock درون `src/services/**/mockData.js` + `localStorage` مرورگر. تنها دادهٔ سمت سرور: `database/content/*.json` و `database/users.json`. |
| مسیرها | روی **hash**: `#dashboard?…`، `#admin`، `#articles/…`، `#auth`. |
| چند بخش اصلی؟ | ۴ صفحهٔ سایت + ۹ بخش داشبورد + ۱۲ لایهٔ تودرتو + پنل مدیریت با ۱۶ بخش تحلیل. |
| فونت و رنگ | `Pinar` (متن) / `Doran` (تیتر)؛ سبز `#61D192`، بنفش `#937fcd`، کارت `#242426`. |
| ممنوعیت‌ها | `npm run build` نزن (پوشهٔ `dist/` را پاک می‌کند). وابستگی جدید اضافه نکن. ساختار موجود را بازطراحی نکن. |

---

## ۱. شناسنامه

- **نام بسته:** `tapesh-medical-learning` — `"type": "module"` (همهٔ فایل‌ها ESM).
- **زبان رابط:** فارسی، `dir="rtl"`، اعداد فارسی.
- **زبان کد و کامنت‌ها:** کامنت‌ها و نام‌های دامنه فارسی‌اند؛ نام متغیرها/توابع انگلیسی.
- **نقطهٔ ورود:** `index.html` → `src/main.jsx` → `src/App.jsx`.
- **مسیر دادهٔ سایت:** `src/App.jsx` یک روتر دستی روی `window.history` + `window.location.hash` دارد.

### وابستگی‌ها (تمام چیزی که نصب است)

| بسته | نقش |
|---|---|
| `react`, `react-dom` ۱۹ | UI |
| `vite` ۷ | Bundler و dev server |
| `@vitejs/plugin-react` | JSX / Fast Refresh |
| `tailwindcss` ۴ + `@tailwindcss/vite` | فقط در چند بخش (داشبورد، پنل، بانک تست) استفاده شده — نه کل پروژه |

> **هیچ کتابخانهٔ دیگری وجود ندارد.** نمودارها SVG دست‌سازند، آیکون‌ها SVG درون‌خطی،
> Markdown رندرر در `src/layout/dashboard/ai/aiShared.jsx` خودنویس است، تاریخ شمسی با `Intl` است.

---

## ۲. راه‌اندازی و دستورها

```bash
npm install

npm run dev        # توسعه — http://localhost:5173
npm run build      # ⚠️ پوشهٔ dist/ را بازنویسی می‌کند
npm run start      # پروداکشن — node server.js روی http://localhost:4173

node database/adminApi.test.mjs   # تست دودی API پنل (۳۳ سنجه، بدون نیاز به سرور)
```

**مسیرهای ورود سریع:**

| مسیر | چه چیزی |
|---|---|
| `http://localhost:5173/` | صفحهٔ اصلی سایت |
| `http://localhost:5173/#auth` | ورود / ثبت‌نام |
| `http://localhost:5173/#dashboard` | داشبورد (نیازمند ورود) |
| `http://localhost:5173/#admin` | پنل مدیریت — `0135` / `0135` |
| `http://localhost:5173/#admin/analytics` | مرکز تحلیل ۱۶ بخشی |

### متغیرهای محیطی

`.env.example` را به `.env` کپی کن. هیچ رمزی در سورس نیست.
`TAPESH_ADMIN_USERNAME` / `TAPESH_ADMIN_PASSWORD` / `TAPESH_ADMIN_NAME` / `TAPESH_ADMIN_EMAIL` /
`TAPESH_INSECURE_COOKIE` / `PORT` / `HOST` + یازده متغیر اختیاری مرکز تحلیل
(`GA_*`, `GSC_SITE_URL`, `PAGESPEED_API_KEY`, `PAYMENT_*`, `LLM_*`, `MONITORING_*`, `ALERT_*`).
همه در `.env.example` توضیح داده شده‌اند. متغیرهای تحلیل **اجباری نیستند** — هرکدام تنظیم شود،
بخش وابسته از «نیازمند اتصال» به «فعال» می‌رود.

---

## ۳. نقشهٔ پوشه‌ها

```
D-DayProject/
├── index.html              نقطهٔ ورود Vite
├── server.js               سرور پروداکشن (node:http خالص) — dist/ + /uploads + API
├── vite.config.js          پلاگین‌ها + server.watch.ignored  ← حیاتی، بخش ۱۲
├── .env.example            همهٔ متغیرهای محیطی
├── route-preview.html      ⚠️ هارنس قدیمی (به src/__routePreview.jsx وصل است)
├── review-preview.html     ⚠️ کهنه — به فایل ناموجود src/__reviewPreview.jsx اشاره می‌کند
├── users.json              ⚠️ کهنه — دادهٔ واقعی کاربران در database/users.json است
├── content/                ⚠️ کهنه — دادهٔ واقعی CMS در database/content/ است
│
├── src/
│   ├── main.jsx            createRoot + تزریق فاوآیکون
│   ├── App.jsx             ۱۵۹۶ خط — صفحهٔ اصلی سایت + روتر کل + ورود/ثبت‌نام
│   ├── styles.css          دیزاین سیستم پایه (فونت‌ها، متغیرها، کلاس‌های سایت)
│   ├── __routePreview.jsx  هارنس پیش‌نمایش مسیر (توسعه)
│   ├── data/learning/      anatomyCourse.js — محتوای دورهٔ آناتومی
│   ├── layout/             ← تمام UI
│   │   ├── OfflinePage.jsx / SecondaryRegistrationLayout.jsx
│   │   ├── articles/       صفحات عمومی مقالات
│   │   ├── admin/          پنل مدیریت محتوا (+ README)
│   │   └── dashboard/      داشبورد (+ ۹ زیرلایه با README)
│   └── services/           ← تمام لایهٔ داده (بدون UI)
│
├── database/               ← تمام کد سمت سرور
│   ├── contentStore.js     دادهٔ CMS + RBAC + نشست + audit
│   ├── adminApi.js         هندلر API پنل (مستقل از فریم‌ورک)
│   ├── adminApiPlugin.js   میزبان توسعه (middleware ویت)
│   ├── analyticsStore.js / analyticsEngine.js / analyticsInsights.js
│   ├── sanitizeHtml.js     پاک‌ساز HTML (تک‌نسخه، سرور و کلاینت)
│   ├── usersStore.js / apiPlugin.js   حساب‌های کاربری سایت
│   ├── adminApi.test.mjs   تست دودی
│   └── content/*.json      دادهٔ واقعی CMS (۱۱ مجموعه)
│
├── public/uploads/         فایل‌های آپلودی پنل
├── images/                 تصاویر منبع (pictures, courses, icons, avatars)
├── fonts/                  doran/ و pinar/ (woff2)
└── dist/                   خروجی build — دست نزن
```

---

## ۴. معماری کلان

پروژه یک قانون سخت دارد: **UI هرگز مستقیم به داده دست نمی‌زند.**

```
src/layout/**  (UI)  ──import──▶  src/services/**  (منطق + داده)
                                        │
                                        └── در آینده: بدنهٔ توابع به fetch تبدیل می‌شود،
                                            امضاها و شکل Entityها ثابت می‌مانند.
```

هر سرویس در سربرگ خودش **قرارداد REST آینده** را مستند کرده است. پس اتصال بک‌اند
= تغییر بدنهٔ توابع، نه بازنویسی UI.

### سه لایهٔ مجزا

| لایه | پوشه | مسئولیت |
|---|---|---|
| داده | `src/services/<domain>/` | منطق دامنه، فیلتر، محاسبه، persistence |
| نمایش | `src/layout/dashboard/<domain>/` | فقط رندر؛ state محلی UI |
| سرور | `database/` | API، احراز هویت، CMS، تحلیل |

### دو نوع state

1. **state ناوبری** → روی hash می‌نشیند (کدام بخش/لایه/نما). با Back/Forward و رفرش زنده می‌ماند.
2. **state گذرا** → محلی می‌ماند (فیلتر لحظه‌ای، اتاق آزمون در حال اجرا، دادهٔ واکشی‌شده).

مرز این دو در `src/layout/dashboard/dashboardRoute.jsx` تعریف شده است.

---

## ۵. نقشهٔ مسیرها (همه روی hash)

`src/App.jsx` تابع `getAppRoute()` را دارد که تنها منبع حقیقت مسیر سطح‌بالاست.

| الگوی آدرس | صفحه | کامپوننت |
|---|---|---|
| `` (بدون hash) یا هر لنگر (`#products`, `#faq`, …) | صفحهٔ اصلی سایت | `App` (درون خودش) |
| `#auth` | ورود / ثبت‌نام | `AuthPage` |
| `#onboarding` | تکمیل پروفایل پس از ثبت‌نام | `SecondaryRegistrationLayout` |
| `#dashboard` و `#dashboard?…` | داشبورد | `DashboardLayout` |
| `#articles` | فهرست مقالات | `ArticlesPage` |
| `#articles/<slug>` | یک مقاله | `ArticlePage` |
| `#articles/category/<id>` | مقالات یک دسته | `ArticlesPage` با `initialCategory` |
| `#articles/saved` | لیست مطالعه | `ReadingListPage` |
| `#admin` و `#admin/<view>/<id>` | پنل مدیریت | `AdminLayout` |
| — | آفلاین (`navigator.onLine === false`) | `OfflinePage` — **پیش از همهٔ مسیرها** بررسی می‌شود |

**ترتیب اولویت در `App`:** آفلاین → `adminOpen` → `onboardingOpen` → `dashboardOpen` →
`authOpen` → `articlesOpen` → صفحهٔ اصلی. پنل مدیریت **مستقل از حساب سایت** است.

### مسیر داخلی داشبورد

```
#dashboard
#dashboard?s=tests
#dashboard?s=tests&l=test-bank&v=%7B%22name%22%3A%22topics%22%7D   ← v = JSON view
#dashboard?s=other&o=settings&t=security                            ← o = overlay
```

| پارامتر | معنی |
|---|---|
| `s` | بخش فعال (`DASHBOARD_SECTIONS`) |
| `l` | لایهٔ باز (`LAYER_IDS`) |
| `v` | نمای داخلی لایه، به‌صورت JSON |
| `o` | overlay: `settings` یا `notifications` |
| `t` | تب پنل تنظیمات (`profile` \| `subscription` \| `transactions` \| `security` \| `support`) |

### هوک `useLayerRoute` — قرارداد اتصال نمای داخلی به آدرس

```jsx
const [view, setView, patchView] = useLayerRoute(LAYER_IDS.wiki, WIKI_HOME_VIEW, {
  slot: null,                 // برای لایهٔ تودرتو (مثل view.anatomy)
  volatile: ['live'],         // نماهایی که هرگز در آدرس نمی‌نشینند
  screenOf: (v) => v.mode,    // تفکیک «صفحه» از «تغییر درون صفحه»
});
```

| قاعده | توضیح |
|---|---|
| `initialView` **ثابت و بیرون از کامپوننت** | وگرنه هر رندر مقدار تازه می‌سازد. الگوی نام: `<DOMAIN>_VIEW` بالای فایل. |
| تغییر **صفحه** → `push` | ورودی تاریخچه می‌سازد؛ Back/Forward کار می‌کند. |
| تغییر **درون صفحه** → `replace` | فیلتر/تب/جست‌وجو تاریخچه را شلوغ نمی‌کند. |
| `volatile` | `live` / `lab` / `result` / `review` — دادهٔ زمان‌اجرا؛ رفرش نباید به آزمون نیمه‌کاره بیفتد. |
| `slot` | لایهٔ تودرتو زیر یک کلید، هم‌زمان با والدش ذخیره می‌شود (مثل `view.anatomy`). |
| **نوشتن باید از `context.routeRef.current` بخواند** | نه از state همان رندر؛ وگرنه دو نوشتن پشت‌سرهم در یک تیک، اولی را از دست می‌دهد. |

---

## ۶. بخش‌ها و لایه‌های داشبورد

### ۹ بخش (`sections` در `DashboardLayout.jsx`)

| کلید | کامپوننت | توضیح |
|---|---|---|
| `dashboard` | `DashboardHome` | خانه: کارت پروفایل، نمودار قلب، اکشن‌کارت‌ها، هم‌کلاسی‌ها |
| `courses` | `CoursesSection` | کاتالوگ ۵ دوره + «کار امروز» + دوره‌های من |
| `tests` | `TestsSection` | بانک تست، آزمون شخصی، آزمون هماهنگ، بین‌الملل، آنالیز وضعیت |
| `flashcards` | `FlashcardSection` | فلش‌کارت با Spaced Repetition |
| `notes` | `NotesSection` | دفترچهٔ یادداشت (متن + چک‌لیست) |
| `review-notebook` | `ReviewNotebook` | دفترچهٔ مرور G5 با تقویم شمسی |
| `other` | `OtherSections` | تپش هوشمند، شبکهٔ دانش، ویکی، مقالات، پشتیبان |
| `league` | `LeagueSection` | لیگ، رتبه‌بندی، چالش، دستاورد |
| `pomodoro` | `Pomodoro` | تایمر تمرکز (state آن در `DashboardLayout` می‌ماند) |

### ۱۲ لایه (`LAYER_IDS`)

| شناسه | کامپوننت | ورود از |
|---|---|---|
| `my-courses` | `MyCoursesLayer` | دکمهٔ «همهٔ دوره‌ها» در `CoursesSection` |
| `course-comprehensive` | `courses/ComprehensiveCourseLayer` | کارت «درسنامه جامع» |
| `course-micro` | `courses/MicroCourseLayer` | کارت «میکرو درسنامه» |
| `course-reference` | `courses/ReferenceLayer` | کارت «رفرنس» (خوانندهٔ کتاب با `reader/`) |
| `intl-courses` | `courses/InternationalCoursesLayer` | کارت «دوره‌های بین‌الملل» |
| `intl-exams` | `tests/InternationalExamsLayer` | کارت «آزمون‌های بین‌الملل» |
| `coordinated-exams` | `tests/coordinated/CoordinatedExamsLayer` | کارت «آزمون‌های هماهنگ» |
| `test-bank` | `tests/bank/TestBankLayer` | کارت بزرگ «بانک تست علوم پایه» |
| `analytics` | `analytics/AnalyticsLayer` | کارت «آنالیز وضعیت» |
| `wiki` | `wiki/WikiLayer` | کارت «ویکی تپش» |
| `knowledge` | `knowledge/KnowledgeLayer` | کارت «شبکه دانش» |
| `tapesh-ai` | `ai/AILayer` | کارت «تپش هوشمند» |

### ۲ overlay

`settings` (۵ تب) و `notifications` — با لایه هم‌زمان باز نمی‌شوند (`readDashboardRoute` صریحاً
`return` می‌کند).

### نکات کلیدی چند لایه

- **کاتالوگ دوره‌ها:** ۵ کارت ثابت در `CoursesSection.jsx` → `CATALOG_COURSES`. نگاشت کارت به لایه
  در `DashboardLayout.jsx` → `COURSE_LAYERS`. کارت «مسیر سبز» لایه ندارد و فقط اسکرول می‌کند.
- **`myCoursesCatalog.js`** منبع واحد «دوره‌های من» است و از سه خانوادهٔ واقعی دوره‌ها
  (`SUBJECTS` درسنامه جامع، `SUBJECTS` میکرو، `COURSES` بین‌الملل) تغذیه می‌شود؛ `COURSE_KINDS`
  هویت بصری هر خانواده (رنگ، آیکون، مدل نوار پیشرفت) را نگه می‌دارد.
- **یادگیری آناتومی** (`courses/learning/`): سه سطح `overview → module → unit`. مسیر داخلی در
  `view.anatomy` (slot) ذخیره می‌شود. سه راه ورود: کارت آناتومی در «درسنامه جامع» / ردیف آناتومی
  در «میکرو درسنامه» / کارت‌های «کار امروز» با لینک عمیق `{subject, moduleId, unitId, stepId}`.
- **قاعدهٔ لینک عمیق:** هر جابه‌جایی صفحه باید **هم** کلید صفحه و **هم** `deep` را بنویسد، وگرنه
  الگوی `view.X ?? deepLink.X` دوباره همان صفحه را باز می‌کند.
  (`setOpenSubject({ subject, deep: null, anatomy: null })`، `setSelectedCourse({ courseId, deep: null })`.)
- **اعلان‌ها یک سطح واحد دارند:** فقط `NotificationsSection` (زنگولهٔ هدر). نه کادر پروفایل خانه و
  نه سربرگ لیگ، اعلان جداگانه ندارند. منبع: `services/league/leagueService.js`.
- **لایهٔ تپش هوشمند** دو مصرف‌کننده دارد: کارت مینیمال در «سایر بخش‌ها» و پاپ‌آپ شناور. هر دو از
  یک استور ماژول‌سطح (`ai/aiStore.js`) تغذیه می‌شوند، پس بستن پاپ‌آپ مکالمه را از دست نمی‌دهد.

---

## ۷. لایهٔ داده — سرویس‌ها

### دامنه‌ها

| پوشه | مسئولیت | فایل‌های شاخص |
|---|---|---|
| `admin/` | تنها نقطهٔ تماس UI پنل با `/api/admin/*` | `adminService.js` |
| `ai/` | دستیار هوشمند (انتزاع Provider) | `aiService.js`, `mockAI.js`, `aiContext.js` |
| `analytics/` | تحلیل عملکرد دانشجو (لایهٔ داشبورد، نه پنل) | `analyticsService.js`, `analyticsEngine.js` |
| `articles/` | مقالات سایت | `articlesService.js`, `userState.js` |
| `coordinatedExams/` | آزمون‌های هماهنگ (ثبت‌نام، سالن، کارنامه، رتبه) | `coordinatedExamService.js` |
| `examBuilder/` | آزمون‌ساز شخصی | `selectionEngine.js`, `presets.js` |
| `flashcards/` | فلش‌کارت + الگوریتم SM-2 | `flashcardService.js`, `spacedRepetition.js` |
| `hearts/` | اقتصاد قلب (نمودار داشبورد) | `heartSeries.js`, `heartStatsService.js` |
| `international/` | آزمون‌های بین‌الملل (USMLE/PLAB/…) | `internationalService.js` |
| `knowledge/` | گراف دانش (۵۶ نود، ۸۸ یال) | `graphData.js`, `graphModel.js`, `knowledgeService.js` |
| `league/` | لیگ، رتبه‌بندی، چالش، اعلان‌ها | `leagueService.js` |
| `learning/` | موتور درسنامهٔ جامع | `index.js` (ری‌اکسپورت ۶ سرویس) |
| `notes/` | دفترچهٔ یادداشت | `notesService.js` |
| `reviewNotebook/` | دفترچهٔ مرور (مراحل G5) | `reviewNotebookService.js` |
| `telemetry/` | ردیاب ترافیک مرورگر | `trafficTracker.js` |
| `testBank/` | بانک تست علوم پایه | `testBankService.js` |
| `wiki/` | ویکی + موتور جست‌وجو | `wikiService.js`, `searchEngine.js` |
| `userStorage.js` | حساب کاربر سایت (localStorage + `/api/users`) | — |
| `referencesApi.js` | دادهٔ رفرنس‌ها و state خواننده | — |

### سرویس‌های `learning/` (ری‌اکسپورت از `index.js`)

| سرویس | نقش |
|---|---|
| `ContentService` | بارگذاری دوره/ماژول/واحد (`getCourse`, `getModule`, `getUnits`, `getUnit`) |
| `ProgressService` | ذخیره/بازیابی پیشرفت (`load`, `save`, `getUnitState`, `updateUnit`, `getModuleSummary`, `getCourseSummary`) |
| `MyCoursesService` | فهرست «دوره‌های من» (`getActivity`, `getProgress`) |
| `AssessmentService` | ارزیابی پاسخ و تشخیص ضعف (`evaluateQuestion`, `evaluateLabel`, `diagnose`) |
| `RecommendationService` | پیشنهاد بعدی (`forCourse`, `forUnit`) |
| `LearningService` | ماشین مراحل درس (`getStep`, `getNextStep`, `calculateProgress`, `completeStep`) |

### کلیدهای `localStorage` (به تفکیک کاربر)

| کلید | دامنه |
|---|---|
| `tapesh:current-user`, `tapesh:users` | حساب کاربر |
| `tapesh:testbank:v1:<userId>` | بانک تست |
| `tapesh:exams:v1:<userId>` | آزمون‌ساز شخصی |
| `tapesh:intl:v1:<userId>` | آزمون‌های بین‌الملل |
| `tapesh:coordinated:v1:<userId>` | آزمون‌های هماهنگ |
| `tapesh:analytics:v1:<userId>` | تحلیل عملکرد |
| `tapesh:learning:v1:<userId>:<courseId>` | پیشرفت درسنامه |
| `tapesh:knowledge:v1:<userId>` | گراف دانش |
| `tapesh:flashcards:v1`, `tapesh:notes:v1`, `tapesh:hearts:v1`, `tapesh:wiki:v1`, `tapesh:articles` | بدون تفکیک کاربر |
| `tapesh:ai:conversations:v1`, `tapesh:ai:saved-messages` | دستیار هوشمند |
| `tapesh:telemetry:off:v1`, `tapesh:telemetry:sid:v1` | ردیاب |
| `tapesh:pomodoro-stats`, `tapesh:reader`, `tapesh:security-settings`, `tapesh:support-requests`, `tapesh:review-notebook:v1` | متفرقه |

**ریست کامل یک دامنه:** `localStorage.removeItem('tapesh:<domain>:v1')` — داده از نو seed می‌شود.

### الگوی اتصال بک‌اند

هر سرویس یک تابع `__setFailure(true)` (یا مشابه) صادر می‌کند تا حالت خطا از کنسول تست شود.
سرویس‌های Mock تأخیر شبکهٔ مصنوعی دارند.

---

## ۸. بک‌اند

### دو میزبان، یک کد

| محیط | میزبان API | فایل |
|---|---|---|
| توسعه (`npm run dev`) | middleware ویت | `database/adminApiPlugin.js` + `database/apiPlugin.js` |
| پروداکشن (`npm run start`) | سرور `node:http` | `server.js` |

هر دو همان `handleApi` را از `database/adminApi.js` صدا می‌زنند. `server.js` علاوه بر API،
`dist/` و `/uploads/` را هم سرو می‌کند (با محافظت path traversal).

### API — پنل مدیریت

```
POST   /api/admin/auth/login | logout | password
GET    /api/admin/auth/me                     نشست جاری + توکن CSRF
GET    /api/admin/stats | meta
CRUD   /api/admin/{articles,categories,pages,media,banners,users,notes}
GET/PUT /api/admin/settings
GET    /api/admin/logs
GET    /api/admin/analytics/{sources,ping,export,alerts} + ۱۶ بخش تحلیل
POST   /api/public/analytics/collect           تلمتری مرورگر (تنها مسیر عمومی غیر-GET)
GET    /api/public/{articles,banners,settings,pages/:slug}
```

**قرارداد پاسخ:** `{ success: true, data }` یا `{ success: false, error: { code, message } }`.

### مجموعه‌های دادهٔ CMS (`database/content/*.json`)

`admins` · `articles` · `categories` · `pages` · `media` · `banners` · `activity` · `notes` ·
`settings` · `alerts` · `events`

در اولین درخواست خودکار ساخته و seed می‌شوند (`ensureStore`).
**بازنشانی کامل:** `rm -rf database/content` (توجه: رویدادهای واقعی تحلیل هم پاک می‌شوند).

> ⚠️ پوشهٔ `content/` در **ریشهٔ پروژه** کهنه و بی‌استفاده است؛ کد فقط `database/content/` را
> می‌خواند. همان‌طور `users.json` ریشه هم کهنه است (واقعی: `database/users.json`).

### امنیت (خلاصه)

کوکی `HttpOnly` + `SameSite=Strict` + هدر `x-tapesh-csrf` · رمز `scrypt` + salt + `timingSafeEqual` ·
پاک‌سازی HTML با allow-list پیش و پس از ذخیره · allow-list نوع MIME برای آپلود ·
پیام خطای یکسان برای «کاربر ناموجود» و «رمز اشتباه» · قفل موقت پس از تلاش‌های ناموفق ·
ثبت هر عملیات مهم در `activity.json` · هیچ کلیدی در سورس نیست.

**نقش‌ها:** `super-admin` (همه) · `admin` (همه جز حذف کاربر و بخش‌های حساس تحلیل) ·
`editor` (محتوای خودش + `analytics.read`).

**قواعد محافظتی:** آخرین مدیر کل فعال را نمی‌توان حذف/غیرفعال/تنزل داد · کاربر نمی‌تواند حساب
خودش را حذف کند · دسته‌بندیِ در حال استفاده حذف نمی‌شود.

### الگوی افزودن یک بخش تازه به پنل

`PERMISSIONS` → `COLLECTIONS` / `ensureStore` → توابع دامنه → مسیر در `adminApi.js` →
`adminService.js` → `SECTIONS` و `renderView` در `AdminLayout.jsx` → کلاس‌های `ad-`.

---

## ۹. مرکز تحلیل (`/#admin/analytics`) — ۱۶ بخش

**اصل حاکم، غیرقابل‌مذاکره: هیچ عدد ساختگی.** سنجه‌ای که منبعش وصل نیست با کامپوننت
`NeedsConnection` و **نام دقیق متغیر محیطی** نشان داده می‌شود. `null` با `—` نمایش داده می‌شود،
نه `0`. این قاعده باید همیشه حفظ شود.

```
analyticsStore.js      داده خام (رویداد، سنجه، سیستم، هشدار) — بدون محاسبه
analyticsEngine.js     بخش ۱–۱۰ + ریاضیات مشترک (رگرسیون، امتیاز Z، پیش‌بینی)
analyticsInsights.js   بخش ۱۱–۱۶ (بازاریابی، سیستم، خطا، لحظه‌ای، هشدار، تحلیلگر)
        ↓ API در adminApi.js
src/layout/admin/analytics/**   UI با پیشوند an-
```

- **تحلیلگر آماری است، نه LLM:** روند با رگرسیون خطی + R²، ناهنجاری با امتیاز Z، ریشه‌یابی از
  تفاضل نیمهٔ اول/دوم، پیش‌بینی با فاصلهٔ اطمینان. `LLM_API_KEY` فقط روایت متنی اضافه می‌کند و
  تحلیلگر بدون آن هم کامل کار می‌کند.
- `rootCause` یک **شیء** است (`{ trafficChange, sources, page, errors, causes }`) نه رشته.
- **حریم خصوصی:** هویت کاربر شمارهٔ موبایل است؛ ردیاب هرگز آن را نمی‌فرستد و فقط شبه‌نام
  یک‌طرفهٔ FNV-1a می‌فرستد. مسیرهای `#admin` ردیابی نمی‌شوند. با Do-Not-Track ردیاب روشن نمی‌شود.
- تنها منبع «بازدید واقعی» ردیاب `src/services/telemetry/trafficTracker.js` است که یک‌بار در
  `App.jsx` روشن می‌شود.
- **مجوزها:** هر بخش Permission مستقل دارد (`analytics.read`, `analytics.users.read`,
  `analytics.seo.read`, `analytics.security.read`, `analytics.revenue.read`,
  `analytics.alerts.manage`, `analytics.export`). کلاینت فقط تب‌های مجاز را می‌سازد؛
  **منبع حقیقت سرور است.**
- مسیرهای `/api/admin/analytics/*` عمداً در `NOT_MEASURED_PREFIXES` هستند تا خودسنجی، سنجه را
  آلوده نکند. Poll «لحظه‌ای» هر ۱۰ ثانیه.
- ⚠️ `POST /api/admin/analytics/reset` در UI نیست و **کل رویدادهای واقعی را پاک می‌کند.**

مستند کامل: `src/layout/admin/analytics/README.md`.

---

## ۱۰. دیزاین سیستم

### رنگ‌ها

| نقش | مقدار |
|---|---|
| پس‌زمینهٔ سایت | `#181818` |
| کارت | `#242426` / `#282828` |
| متن | `#ffffff` · کم‌رنگ `#8a8a8a` / `#9a9a9a` / `#d0d0d0` |
| سبز (موفق/تأیید) | `#61D192` / `#77b787` |
| بنفش (انتخاب) | `#937fcd` |
| آبی (برند/لینک) | `#5b8cc7` |
| قرمز (خطا/ضعف) | `#e26d6d` / `#ef9196` |
| طلایی | `#e0b45c` |
| قهوه‌ای | `#ab8e7c` |

متغیرهای پایه در `:root` در `src/styles.css`: `--background`, `--surface`, `--surface-soft`,
`--white`, `--muted`, `--blue/-bright`, `--green/-bright`, `--brown/-bright`, `--purple/-bright`,
`--black`, `--form-error`, `--content-width: 80%`.

### تایپوگرافی

- `Pinar` → متن بدنه · `Doran` → تیترها · fallback هر دو `Tahoma, sans-serif`.
- `@font-face` در `src/styles.css`، فایل‌ها در `fonts/{pinar,doran}/*.woff2`.
- **اعداد همیشه فارسی:** با `toFa(value)` / `faNum(...)` (هر لایه نسخهٔ خودش را دارد یا از
  `leagueShared` می‌گیرد).
- تاریخ شمسی **بدون کتابخانه**: `Intl.DateTimeFormat('fa-IR-u-ca-persian')` و برای محاسبه
  `'fa-IR-u-ca-persian-nu-latn'`.

### قواعد چیدمان و انیمیشن

- `--content-width: 80%` عرض استاندارد محتواست.
- `border-radius` بزرگ: ۲ تا ۲.۵rem (کارت‌ها تا ۳rem).
- **هر لایه CSS خودش را با پیشوند کلاس اختصاصی دارد:** `tb-` (بانک تست)، `an-` (تحلیل پنل)،
  `intl-` (بین‌الملل)، `ad-` (پنل مدیریت)، `dash-` (داشبورد) و…
- انیمیشن ورود استاندارد: `dashboard-layer-reveal` / `dash-stagger`.
- **همهٔ انیمیشن‌ها گارد `prefers-reduced-motion` دارند** — این یک قاعدهٔ پروژه‌ای است، نه انتخاب.
- در `@media (min-width: 701px)` داشبورد `height: 100dvh; overflow: hidden` می‌گیرد.
  **پس چیدمان‌های عمودی را با نسبت `flex: n 1 0` بده، نه ارتفاع ثابت.**
- Tailwind فقط در چند بخش استفاده شده (کلاس‌های inline مثل `bg-[#282828]`) — بیشتر استایل‌ها
  CSS خالص‌اند. برای تغییر یک بخش، **همان الگوی همان بخش** را ادامه بده.

---

## ۱۱. قراردادهای کدنویسی

1. **UI به داده دست نمی‌زند.** اگر محاسبه‌ای لازم است، در سرویس انجام می‌شود.
2. **امضاها را برای بک‌اند آینده بنویس.** هر تابع سرویس باید با تبدیل بدنه به `fetch` قابل
   اتصال باشد. قرارداد REST را در سربرگ فایل مستند کن.
3. **کامنت‌ها فارسی و «چرا»محور.** توضیح بده چرا این تصمیم گرفته شده، نه اینکه کد چه می‌کند.
4. **بازطراحی نکن.** الگوی موجود همان لایه را پیدا کن و ادامه بده. فایل یا لایهٔ جدید اضافه نکن
   مگر لازم باشد.
5. **وابستگی جدید اضافه نکن.** اگر چیزی لازم است، با پلتفرم بساز (SVG، `Intl`، CSS).
6. **`ErrorBoundary` وجود ندارد.** پس هر خطای رندر در یک لایه، کل درخت React را خالی می‌کند.
7. **حالت خطا و لودینگ را همیشه بده.** الگوهای موجود: `useAsyncData` (لیگ/فلش‌کارت/ویکی)،
   اسکلت هم‌اندازه (بدون Layout Shift)، دکمهٔ Retry.
8. **دسترس‌پذیری:** `dir="rtl"`، `aria-pressed`/`aria-expanded`/`aria-current`،
   `role="dialog"` + focus trap برای مودال، Escape برای بازگشت لایه‌به‌لایه.
9. **`localStorage` همیشه نسخه‌دار** (`:v1`) و در صورت لزوم به تفکیک کاربر.
10. **بعد از تغییر معماری یک لایه، README همان لایه را به‌روز کن** (فهرست در بخش ۱۳).

---

## ۱۲. تله‌ها و باگ‌های تأییدشده — این‌ها را دوباره نساز

### ۱) «دکمه هیچ کاری نمی‌کند» → اول هندلر را بخوان

تابعی که در `onClick` صدا زده می‌شود ولی **تعریف نشده** است، خطای `ReferenceError` می‌دهد و
**بقیهٔ هندلر اجرا نمی‌شود**. نه خطایی در UI دیده می‌شود، نه چیزی می‌شکند — فقط هیچ اتفاقی نمی‌افتد.
دو بار در همین پروژه تکرار شد: `setAnatomyRoute` در `ComprehensiveCourseLayer.jsx` و
`INTL_COURSES_VIEW` در `InternationalCoursesLayer.jsx`.
**تشخیص سریع:** با `Grep` روی نام تابع، «یک ارجاع بدون تعریف» را پیدا کن.

### ۲) ویت + دادهٔ زمان‌اجرا = حلقهٔ رفرش بی‌پایان

سرور در هر درخواست `database/content/*.json`، `database/users.json` و `public/uploads/` را
بازنویسی می‌کند. ویت هر نوشتن در ریشه را «فایل ناشناس» می‌بیند و چون در گراف ماژول نیست
(`needFullReload = modules.length === 0`) کل صفحه را `full-reload` می‌کند ⇒
حلقهٔ خودتقویت‌شونده: رفرش → ردیاب → نوشتن → رفرش.

**قاعده:** هر مسیر دادهٔ زمان‌اجرا **باید** در `server.watch.ignored` در `vite.config.js` باشد.
**تشخیص:** شنوندهٔ `ws://localhost:5173/` با پروتکل `vite-hmr`.

### ۳) `useAsync(loader, deps)` و حلقهٔ fetch

درایه‌های `deps` با `Object.is` مقایسه می‌شوند. شیء یا آرایهٔ تازه در هر رندر = حلقهٔ بی‌پایان
fetch. مقدار `JSON.stringify(filters)` را پاس بده یا شیء را بیرون از کامپوننت بساز.

### ۴) اسکریپت‌های آزمایشی و دادهٔ واقعی

هر اسکریپتی که `clearEvents()` (یا معادلش) صدا بزند، **رویدادهای واقعی تحلیل** را هم پاک می‌کند.

### ۵) بیلد ممنوع

`npm run build` پوشهٔ `dist/assets` را پاک می‌کند و کاربر یک‌بار صریحاً رد کرده است.
برای بررسی سریع از `./node_modules/.bin/esbuild` استفاده کن. دو روش بررسی بدون مرورگر
(رندر سرور + jsdom تعاملی) در اسکیل `react-layer-headless-verify` مستند شده است.

### ۶) فایل‌های کهنه

`route-preview.html`، `review-preview.html` (به فایل ناموجود وصل است)، `content/` و
`users.json` در ریشه، و `src/layout/dashboard/setting/fgh.html` (صفر بایت) بخشی از برنامه نیستند.

---

## ۱۳. نقشهٔ مستندات موجود

این README نقشهٔ کلان است. جزئیات هر زیرلایه در README خودش:

| سند | چه چیزی را کامل توضیح می‌دهد |
|---|---|
| `src/layout/admin/README.md` | CMS: معماری، مدل داده، API، امنیت، عیب‌یابی، وضعیت فازها |
| `src/layout/admin/analytics/README.md` | مرکز تحلیل: ۱۶ بخش، منابع داده، مجوزها، هشدار، خروجی |
| `src/layout/dashboard/tests/bank/README.md` | بانک تست: دو محور طبقه‌بندی، جریان «دامنه»، امنیت آزمون |
| `src/services/examBuilder/README.md` | آزمون‌ساز: موتور انتخاب، blueprint، هشدارها، قلاب‌های آینده |
| `src/layout/dashboard/flashcards/README.md` | فلش‌کارت: مدل داده، SM-2، صف مرور، Focus Mode |
| `src/layout/dashboard/knowledge/README.md` | شبکهٔ دانش: گراف، API، محتوای پویا، وضعیت یادگیری |
| `src/layout/dashboard/league/README.md` | لیگ: اقتصاد قلب، رتبه‌بندی، فصل، ضدتقلب |
| `src/layout/dashboard/notes/README.md` | یادداشت: مدل داده، سرویس، UX، اپتیمستیک |
| `src/layout/dashboard/ai/README.md` | تپش هوشمند: استور مشترک، Context-aware، قرارداد Provider |
| `src/layout/dashboard/heart-chart/README.md` | نمودار قلب: داده، دو حالت نمایش، هندسه، نکات SVG |

---

## ۱۴. چک‌لیست افزودن یا حذف یک بخش

### افزودن بخش تازه به داشبورد

1. `src/services/<domain>/` — سرویس با امضای API واقعی + قرارداد REST در سربرگ.
2. `src/layout/dashboard/<domain>/` — لایه + CSS با پیشوند کلاس اختصاصی + گارد reduced-motion.
3. `dashboardRoute.jsx` → شناسه را به `LAYER_IDS` (یا بخش را به `DASHBOARD_SECTIONS`) اضافه کن.
4. `DashboardLayout.jsx` → کیس در `layerContent` (یا ورودی در `sections`) + ایمپورت.
5. نقطهٔ ورود در بخش والد (مثل `TestsSection` / `OtherSections` / `CoursesSection`).
6. اگر نمای داخلی دارد: `useLayerRoute` با `initialView` ثابت بیرون از کامپوننت.
7. README لایه را بنویس و به جدول بخش ۱۳ اضافه کن.
8. **همین فایل را به‌روز کن:** جدول بخش‌های ۶ (۹ بخش / ۱۲ لایه) + جدول بخش ۷ + نقشهٔ پوشه‌ها (بخش ۳).
9. `node database/adminApi.test.mjs` را اجرا کن تا چیزی نشکسته باشد.

### حذف یک بخش

1. کامپوننت + سرویس + CSS آن را بردار.
2. شناسه را از `LAYER_IDS` / `DASHBOARD_SECTIONS` پاک کن.
3. کیس را از `layerContent` / `sections` پاک کن.
4. ارجاع‌ها را با `Grep` پیدا کن (نقطهٔ ورود، `COURSE_LAYERS`، لینک‌های عمیق).
5. **همین فایل را به‌روز کن** (همان جدول‌های مرحلهٔ ۸ بالا) + README لایه را حذف کن.
6. بررسی کن که مسیر قدیمی در hash به پیش‌فرض برمی‌گردد، نه صفحهٔ خالی
   (`readDashboardRoute` مقادیر ناشناخته را بی‌صدا به پیش‌فرض برمی‌گرداند).

---

## ۱۵. وضعیت فازها و کارهای باقی‌مانده

| فاز | وضعیت |
|---|---|
| ۱–۷ ممیزی، معماری، دیتابیس، Backend، UI پنل، مرکز تحلیل | ✅ |
| ۸ اتصال Frontend سایت به CMS | ⏳ کار بعدی |
| ۹ بازبینی امنیتی نهایی | ⏳ |
| ۱۰ تست یکپارچه | 🟡 ۳۳ سنجهٔ API + رندر ۱۶ بخش تحلیل؛ تست تعاملی UI دستی |
| ۱۱ مستندات | 🟡 همین سند + READMEهای زیرلایه |

**فاز ۸:** `articlesService.js` طوری گسترش می‌یابد که مقاله‌های منتشرشدهٔ CMS را با مقاله‌های
ایستای فعلی ادغام کند (CMS اولویت دارد) و `ArticlePage` در صورت وجود `contentHtml` همان را
رندر کند. تغییرات فقط افزایشی است و در نبود API، سایت دقیقاً مثل امروز کار می‌کند.

**آماده‌های آینده که مدل و مسیر API‌شان تعریف شده ولی UI نهایی ندارند:** دوئل لیگ،
تولید سؤال با Seed، اتصال گراف دانش به ProgressService، Sync-Queue فلش‌کارت و یادداشت.
