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
| این پروژه چیست؟ | «تپش» — پلتفرم یادگیری پزشکی و آمادگی آزمون‌های علوم پزشکی. فارسی، RTL، **دو تم: تیره (پیش‌فرض) + روشن**. |
| استک | React 19 + Vite 7 + Tailwind 4. **بدون TypeScript، بدون Next.js، بدون کتابخانهٔ UI، بدون کتابخانهٔ نمودار.** |
| بک‌اند | فقط `node:http` خالص. **هیچ وابستگی سروری نصب نشده** (بدون Express، بدون دیتابیس واقعی). |
| داده کجاست؟ | Mock درون `src/services/**/mockData.js` + `localStorage` مرورگر. تنها دادهٔ سمت سرور: `database/content/*.json` و `database/users.json`. |
| مسیرها | روی **hash**: `#dashboard?…`، `#admin`، `#pricing`، `#group`، `#articles/…`، `#auth`. |
| چند بخش اصلی؟ | ۷ صفحهٔ عمومی سایت (اصلی، محصولات، تعرفه‌ها، اشتراک گروهی، مقالات، ورود، آنبوردینگ) + ۹ بخش داشبورد + ۱۲ لایهٔ تودرتو + پنل مدیریت با ۱۶ بخش تحلیل. |
| فونت و رنگ | `Pinar` (متن) / `Doran` (تیتر) / **`Vazir` (فالبک)**؛ همهٔ رنگ‌ها توکن‌اند (بخش ۱۰) — سبز `#61D192`، بنفش `#937fcd`، کارت `--surface` `#242426`. |
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

node database/adminApi.test.mjs   # تست دودی API پنل (۷۸ سنجه، بدون نیاز به سرور)
node database/googleAuth.test.mjs # تست دودی ورود با گوگل (۳۴ سنجه، بدون سرور بیرونی)

npm run theme:check   # ✅ همهٔ سنجه‌های تم — بدون مرورگر و بدون بیلد
                      # = theme:verify + theme:contrast + theme:tailwind + theme:render
npm run theme:render  # ۱۴۸ سنجهٔ رندر سرور (React + esbuild) — صفحهٔ اصلی، ورود/گوگل، هدر داشبورد، دکمهٔ تم
npm run theme:contrast # کنتراست WCAG هر ۲۱ جفت متن/سطح در هر دو تم
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
`TAPESH_INSECURE_COOKIE` / `PORT` / `HOST` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` +
یازده متغیر اختیاری مرکز تحلیل
(`GA_*`, `GSC_SITE_URL`, `PAGESPEED_API_KEY`, `PAYMENT_*`, `LLM_*`, `MONITORING_*`, `ALERT_*`).
همه در `.env.example` توضیح داده شده‌اند. متغیرهای تحلیل **اجباری نیستند** — هرکدام تنظیم شود،
بخش وابسته از «نیازمند اتصال» به «فعال» می‌رود.

**`.env` را چه کسی می‌خواند:** `vite.config.js` (برای `npm run dev`) و `server.js` (برای
`npm run start`) هر دو در ابتدای کار `process.loadEnvFile('.env')` را صدا می‌زنند. این خط لازم
است چون **ویت خودش این کار را نمی‌کند**: `.env` را فقط برای مرورگر (`import.meta.env`) و فقط
کلیدهای `VITE_*` می‌خواند و هیچ‌وقت `process.env` را پر نمی‌کند. یعنی بدون آن، متغیرهای سروری
مثل `GOOGLE_CLIENT_ID` بی‌صدا نادیده گرفته می‌شدند (تلهٔ ۱۶). `process.loadEnvFile` خودِ نود
است — وابستگی تازه‌ای اضافه نشد. متغیری که در پوسته `export` شده باشد بر مقدار فایل مقدم است.
هر دو میزبان هم در بالا آمدن یک خط وضعیت چاپ می‌کنند: «ورود با گوگل: فعال / غیرفعال».

### ورود / ثبت‌نام با گوگل (بخش ۸ را ببین)

بدون `GOOGLE_CLIENT_ID` و `GOOGLE_CLIENT_SECRET` دکمهٔ گوگل در `#auth` **کار نمی‌کند و همین را
می‌گوید** (مرز خط‌چین + پیام «پیکربندی نشده») — هیچ ورود ساختگی‌ای انجام نمی‌شود. برای فعال کردن:

۱) Google Cloud Console → APIs & Services → Credentials → Create credentials →
OAuth client ID → Application type: **Web application**.
۲) در «Authorized redirect URIs» آدرس بازگشت را ثبت کن:

```
http://localhost:5173/api/auth/google/callback     ← توسعه
https://<دامنهٔ سایت>/api/auth/google/callback     ← پروداکشن
```

۳) `Client ID` و `Client secret` را در `.env` بگذار و `npm run dev` را دوباره اجرا کن. اگر خط
بالا آمدن «ورود با گوگل: فعال» گفت، پیکربندی درست است.

⚠️ **در توسعه سایت را با `http://localhost:5173` باز کن**، نه `127.0.0.1` و نه `[::1]`. کوکیِ
گاردِ state به میزبان گره خورده است؛ اگر با یک میزبان شروع کنی و گوگل به میزبان دیگری برگردد،
کوکی فرستاده نمی‌شود و همیشه خطای «نشست منقضی شد» می‌گیری.

مسیر دقیق پروداکشن را از `GET /api/auth/google/status` (فیلد `redirectUri`) بگیر — همان چیزی
است که سرور می‌سازد و اگر با مقدار ثبت‌شده در گوگل یکی نباشد، گوگل `redirect_uri_mismatch` می‌دهد.

---

## ۳. نقشهٔ پوشه‌ها

```
D-DayProject/
├── index.html              نقطهٔ ورود Vite
├── server.js               سرور پروداکشن (node:http خالص) — dist/ + /uploads + API
├── vite.config.js          پلاگین‌ها + server.watch.ignored + خواندن `.env`  ← حیاتی، بخش ۱۲
├── .env.example            همهٔ متغیرهای محیطی
├── .env                    ⚠️ ساختهٔ خودت، در Git نیست — همان‌ها که واقعاً خوانده می‌شوند
│
├── src/
│   ├── main.jsx            createRoot + تزریق فاوآیکون
│   ├── App.jsx             ۲۰۸۷ خط — صفحهٔ اصلی سایت + روتر کل + ورود/ثبت‌نام (+ ورود با گوگل)
│   ├── styles.css          دیزاین سیستم پایه (فونت‌ها، متغیرها، کلاس‌های سایت)
│   ├── data/learning/      anatomyCourse.js — محتوای دورهٔ آناتومی
│   ├── layout/             ← تمام UI
│   │   ├── ThemeToggle.jsx  دکمهٔ مشترک تم تیره/روشن (در ۶ سطح استفاده می‌شود)
│   │   ├── OfflinePage.jsx / SecondaryRegistrationLayout.jsx
│   │   ├── articles/       صفحات عمومی مقالات
│   │   ├── products/       صفحهٔ مستقل محصولات `#products` (+ README)
│   │   ├── pricing/        صفحهٔ تعرفه‌ها (+ README)
│   │   ├── group/          صفحهٔ مستقل اشتراک گروهی `#group` (+ README)
│   │   ├── admin/          پنل مدیریت محتوا (+ README)
│   │   └── dashboard/      داشبورد (+ ۱۰ زیرلایه؛ مسیر سبز یک موتور مستقل است)
│   └── services/           ← تمام لایهٔ داده (بدون UI)
│       ├── greenPath/      موتور مسیر سبز: گراف، Roadmap، زمان‌بندی، تطبیق و Repository
│       ├── products/productsService.js   محصولات + مقصد واقعی هر کدام در داشبورد
│       ├── pricing/pricingService.js   پلن‌ها، دوره‌ها، قابلیت‌ها، `quote()`
│       ├── group/groupService.js   اشتراک گروهی: کد اشتراک، پله‌های تخفیف، چرخهٔ گروه
│       └── theme/themeService.js   تنها منبع حقیقت تم (getTheme/setTheme/toggleTheme)
│
├── database/               ← تمام کد سمت سرور
│   ├── contentStore.js     دادهٔ CMS + RBAC + نشست + audit
│   ├── adminApi.js         هندلر API پنل (مستقل از فریم‌ورک)
│   ├── adminApiPlugin.js   میزبان توسعه (middleware ویت)
│   ├── analyticsStore.js / analyticsEngine.js / analyticsInsights.js
│   ├── sanitizeHtml.js     پاک‌ساز HTML (تک‌نسخه، سرور و کلاینت)
│   ├── usersStore.js / apiPlugin.js   حساب‌های کاربری سایت
│   ├── googleAuth.js       ورود/ثبت‌نام با گوگل (OAuth 2.0، بدون وابستگی بیرونی)
│   ├── googleAuth.test.mjs تست دودی گوگل (۳۴ سنجه)
│   ├── mediaStore.js       مرکز رسانه و فضای مجازی
│   ├── publishingStore.js  کانال‌ها + توکن‌ها + تاریخچهٔ ارسال
│   ├── publishers/         آداپتور هر پلتفرم (bale/telegram/eitaa/instagram)
│   ├── publishing.secrets.json   فقط توکن‌ها (۰۶۰۰، خارج از Git)
│   ├── adminApi.test.mjs   تست دودی
│   └── content/*.json      دادهٔ واقعی CMS (۱۱ مجموعه)
│
├── scripts/                ← ابزارهای بررسی تم (بخش ۱۰) — بدون بیلد و بدون مرورگر
│   ├── theme-verify.mjs / theme-contrast.mjs / tailwind-probe.mjs / verify-render.mjs
│   └── theme-migrate.mjs / rgba-migrate.mjs   ⚠️ یک‌بارمصرف — دوباره اجرا نکن
│
├── public/uploads/         فایل‌های آپلودی پنل
├── images/                 تصاویر منبع (pictures, courses, icons, avatars)
├── fonts/                  doran/ · pinar/ · vazir/ (woff2)
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
| `` (بدون hash) یا هر لنگر دیگر (`#faq`, …) | صفحهٔ اصلی سایت | `App` (درون خودش) |
| `#products` | صفحهٔ محصولات | `ProductsPage` |
| `#pricing` و لنگرهای داخلی‌اش (`#pr-products`, `#pr-plans`, `#pr-compare`) | صفحهٔ تعرفه‌ها | `PricingPage` |
| `#group` و `#group?join=CODE` | اشتراک گروهی («با رفقا درس بخون») | `GroupPage` |
| `#auth` | ورود / ثبت‌نام (+ ورود و ثبت‌نام با گوگل) | `AuthPage` |
| `#onboarding` | تکمیل پروفایل پس از ثبت‌نام | `SecondaryRegistrationLayout` |
| `#dashboard` و `#dashboard?…` | داشبورد | `DashboardLayout` |
| `#dashboard?l=green-path` | موتور مستقل مسیر سبز | `greenPath/GreenPathLayer` |
| `#articles` | فهرست مقالات | `ArticlesPage` |
| `#articles/<slug>` | یک مقاله | `ArticlePage` |
| `#articles/category/<id>` | مقالات یک دسته | `ArticlesPage` با `initialCategory` |
| `#articles/saved` | لیست مطالعه | `ReadingListPage` |
| `#admin` و `#admin/<view>/<id>` | پنل مدیریت | `AdminLayout` |

> نوار فیلتر لایهٔ مقالات دسته‌های قدیمی آناتومی، میکروب‌شناسی، بیوشیمی، ایمنی‌شناسی و داروشناسی را نمایش نمی‌دهد و به‌جای آن «اخبار»، «بیوتکنولوژی»، «بهداشت عمومی» و «منتخب تپش» را دارد. شمار مقاله‌ها و مرتب‌سازی در همان ردیف دسته‌ها قرار دارند؛ فیلترهای «کوتاه» و «مفصل» در رابط این لایه حذف شده‌اند. صفحهٔ لیست مطالعه نیز دکمهٔ «بازگشت به مقالات» دارد.
| `#admin/media-center/<tab>` | مدیریت رسانه و فضای مجازی | `MediaCenter` |
| `#admin/publishing` | انتشار در کانال‌ها (بله/تلگرام/ایتا) | `AdminPublishing` |
| `#admin/analytics/<tab>` | مرکز تحلیل ۱۶ بخشی | `AnalyticsCenter` |
| — | آفلاین (`navigator.onLine === false`) | `OfflinePage` — **پیش از همهٔ مسیرها** بررسی می‌شود |

**ترتیب اولویت در `App`:** آفلاین → `adminOpen` → `onboardingOpen` → `dashboardOpen` →
`authOpen` → `pricingOpen` → `productsOpen` → `aboutOpen` → `groupOpen` → `articlesOpen` → صفحهٔ اصلی.
پنل مدیریت **مستقل از حساب سایت** است.

> بازگشت از گوگل به `/?google=…#auth` می‌آید، **نه** `#auth?…` — چون `getAppRoute()` روی
> `hash === '#auth'` تطبیق **دقیق** می‌دهد و افزودن query به hash، مسیر را به «صفحهٔ اصلی»
> برمی‌گرداند. خودِ `AuthPage` پارامتر را از `location.search` می‌خواند، جریان را تمام می‌کند و
> بلافاصله پاکش می‌کند (وگرنه رفرش، جریان را دوباره اجرا می‌کرد).

> لنگرهای داخلی لایهٔ تعرفه در `App.jsx` داخل مجموعهٔ صریح `PRICING_HASHES` ثبت
> شده‌اند (نگاشت صریح، نه حدس پیشوندی). هر لنگر تازه باید همان‌جا اضافه شود.

> `#products` مسیرِ مستقلِ **صفحهٔ محصولات** است (نوبار، فوتر و CTAهای صفحهٔ اصلی
> همگی همین‌جا می‌آیند) و در `App.jsx` داخل مجموعهٔ صریح `PRODUCTS_HASHES` ثبت
> شده است — همان قاعدهٔ `PRICING_HASHES`. مقصدِ **هر محصول** اما لایهٔ واقعیِ خودش
> در داشبورد است (`productsService.js` → `href`)؛ کاربرِ واردنشده نخست به `#auth`
> می‌رود. مقصدها از `LAYER_IDS` ساخته می‌شوند، نه رشتهٔ دستی.
>
> تنها استثنا کارتِ **«مقالات تپش»** است: مقصدش `#articles` است و `openProduct`
> آن را به `openArticles` می‌سپارد (نه به `openDashboard`). لینکِ عمیقِ هر مقاله
> (`#articles/<slug>`) هم از راه `hashchange` → `syncAuthRoute` مسیر را باز می‌کند.

> `#group` مسیرِ مستقلِ **اشتراک گروهی** است و دو جا به آن لینک داده می‌شود: کادر
> «با رفقا درس بخون» در صفحهٔ اصلی و CTA پلن گروهی در `#pricing`. هر دو از ثابتِ
> `GROUP_PAGE_HASH` (در `groupService.js`) ساخته می‌شوند، نه رشتهٔ دستی.
> **تنها حالتِ query-دارِ سایت است:** `#group?join=CODE` کد اشتراک را با خودش
> می‌آورد تا فرمِ پیوستن از پیش پُر شود؛ پس `getAppRoute()` اینجا — برخلاف
> `#auth` — تطبیق **پیشوندی** می‌دهد (`hash.startsWith('#group?')`) و
> `getRouteUrl()` این query را در نرمال‌سازی مسیر مستقیم حفظ می‌کند.
> این لایه لنگر داخلی hash ندارد (پیمایش با `scrollIntoView` است)، پس نیازی به
> مجموعهٔ لنگر مثل `PRICING_HASHES` ندارد. جزئیات در `src/layout/group/README.md`.

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
| `green-path` | `greenPath/GreenPathLayer` | کاتالوگ دوره‌ها، CTA مسیر سبز و لینک فوتر |
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

- **کاتالوگ دوره‌ها:** ۵ کارت ثابت در `CoursesSection.jsx` → `CATALOG_COURSES` و آیکن هر دوره در
  `CatalogIcon`. نگاشت کارت به لایه در `DashboardLayout.jsx` → `COURSE_LAYERS` — **هر پنج کارت
  لایهٔ واقعی دارند، از جمله مسیر سبز.**
- **همان پنج کارت روی صفحهٔ اصلی:** بلافاصله زیر دکمهٔ «از الان شروع کنید» هیرو، در
  `.hero__courses`، با **همان کامپوننت مشترک** `CatalogCourseCard` و همان شبکه رندر می‌شوند؛ پس
  کارت صفحهٔ اصلی هرگز از کارت داشبورد جدا نمی‌افتد. کاربر واردشده با کلیک مستقیم به لایهٔ همان
  دوره می‌رود (`courseDashboardHash` در `App.jsx`، ساخته‌شده از `COURSE_LAYERS`)؛ کاربر
  واردنشده پاپ‌آپ `SignupPromptModal` را می‌بیند و مقصدش در `pendingDashboardHash` می‌ماند تا
  پس از ورود یا تکمیل پروفایل همان‌جا فرود بیاید.
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
- **پس‌زمینهٔ داشبورد هم‌رنگ صفحهٔ اصلی است:** `.dashboard` و `.dashboard-header` از
  `--background` می‌خوانند (تم تیره `#181818`) و هر سه بخشی که خودشان پس‌زمینه می‌کشند
  (`CoursesSection`، `TestsSection`، `notes/NotesSection`) هم `bg-[var(--background)]`
  دارند — قبلاً `var(--deep)` و `bg-black` بودند و داشبورد یک پله از بقیهٔ سایت جدا
  می‌افتاد (آن زمان `--deep` هنوز سیاهِ خالص بود؛ امروز `#121212` است ولی قاعده سرِ جایش
  می‌ماند: پس‌زمینهٔ صفحه `--background` است، نه `--deep`).
  بقیهٔ بخش‌ها پس‌زمینه نمی‌کشند و خودشان از پوسته ارث می‌برند.
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
| `greenPath/` | موتور مسیر سبز: Curriculum Graph، Goal/Priority، Roadmap، Scheduler، Recovery، Progress، Resource و Repository | `greenPathService.js`, `greenPathRepository.js`, `roadmapEngine.js` |
| `articles/` | مقالات سایت | `articlesService.js`, `userState.js` |
| `coordinatedExams/` | آزمون‌های هماهنگ (ثبت‌نام، سالن، کارنامه، رتبه) | `coordinatedExamService.js` |
| `examBuilder/` | آزمون‌ساز شخصی | `selectionEngine.js`, `presets.js` |
| `flashcards/` | فلش‌کارت + الگوریتم SM-2 | `flashcardService.js`, `spacedRepetition.js` |
| `hearts/` | اقتصاد قلب (نمودار داشبورد) | `heartSeries.js`, `heartStatsService.js` |
| `group/` | اشتراک گروهی: کد اشتراک، پله‌های تخفیف، چرخهٔ ساخت/پیوستن/چرخش/خروج | `groupService.js` |
| `international/` | آزمون‌های بین‌الملل (USMLE/PLAB/…) | `internationalService.js` |
| `knowledge/` | گراف دانش (۵۶ نود، ۸۸ یال) | `graphData.js`, `graphModel.js`, `knowledgeService.js` |
| `league/` | لیگ، رتبه‌بندی، چالش، اعلان‌ها | `leagueService.js` |
| `learning/` | موتور درسنامهٔ جامع | `index.js` (ری‌اکسپورت ۶ سرویس) |
| `notes/` | دفترچهٔ یادداشت | `notesService.js` |
| `products/` | صفحهٔ محصولات: هدرِ بدون هاله، برگه‌های ورق‌خور دوره‌ها، کادرهای چرخان بانک تست، ویکی/مقالات، تصویر شبکهٔ دانش، دفترچهٔ مرور و اکوسیستم متحرک؛ با **مقصد واقعی** هر محصول | `productsService.js` |
| `pricing/` | تعرفه‌ها: پلن‌ها، دوره‌های پرداخت، ماتریس قابلیت، `quote()` | `pricingService.js` |
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
| `tapesh:group:v1`, `tapesh:group:v1:viewer` | اشتراک گروهی — **عمداً بدون تفکیک کاربر**: هویت «من» شناسهٔ همین دستگاه است، نه حساب، تا گروهِ ساخته‌شده با ورود/خروج از حساب گم نشود |
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
GET    /api/auth/google/{status,start,callback,handoff}   ورود/ثبت‌نام با گوگل
```

**قرارداد پاسخ:** `{ success: true, data }` یا `{ success: false, error: { code, message } }`.

### ورود / ثبت‌نام با گوگل

جریان کامل در `database/googleAuth.js` است و **سمت سرور** انجام می‌شود، چون `client_secret`
هرگز نباید به مرورگر برود و «کد» یک‌بارمصرف گوگل باید در سرور با توکن معاوضه شود.

```
مرورگر  ──GET /api/auth/google/start──▶  سرور (کوکی state + ۳۰۲)
        ──▶ accounts.google.com (prompt=select_account)
        ──▶ GET /api/auth/google/callback?code&state
              ├─ گارد CSRF: state آدرس باید با کوکی HttpOnly یکی باشد
              ├─ معاوضهٔ code با access_token، سپس userinfo
              ├─ saveGoogleUser()  →  upsert در database/users.json
              └─ ۳۰۲ به /?google=handoff#auth + کوکی یک‌بارمصرف (۲ دقیقه)
        ──▶ AuthPage: GET /api/auth/google/handoff  →  { user }
```

**پیشنیاز — تنها چیزی که بدون تو ممکن نیست:** یک OAuth client واقعی از نوع Web application در
Google Cloud Console. خودِ جریان کد کامل است، ولی `client_id` ساختهٔ گوگل است و هیچ‌کس جز صاحب
حساب نمی‌تواند بسازدش. `GOOGLE_CLIENT_ID` و `GOOGLE_CLIENT_SECRET` را در `.env` بگذار و آدرس
`<origin>/api/auth/google/callback` را در Console ثبت کن — مراحل دقیق در بخش ۲. تا آن موقع
`status` مقدار `configured: false` می‌دهد و دکمه صریح همین را می‌گوید؛ هیچ ورود ساختگی‌ای نیست.

| نکته | چرا |
|---|---|
| مسیر بازگشت `/?google=…#auth` است، نه `#auth?…` | `getAppRoute()` تطبیق **دقیق** `hash === '#auth'` دارد |
| کوکی‌ها `SameSite=Lax` هستند، نه `Strict` | بازگشت از گوگل ناوبری بین‌سایتی سطح‌بالاست؛ `Strict` در آن فرستاده نمی‌شود ⇒ همیشه خطای state |
| `Secure` فقط وقتی آدرس https است | روی `http://localhost` کوکی `Secure` دور ریخته می‌شود و جریان بی‌صدا می‌شکند |
| در توسعه میزبان باید `localhost` بماند | کوکیِ state به میزبان گره خورده؛ `127.0.0.1`/`[::1]` رفتن و `localhost` برگشتن = کوکی نمی‌رسد ⇒ خطای state |
| شناسهٔ حساب گوگلی `googleId` (همان `sub`) است | حساب سایت با شمارهٔ موبایل هویت می‌گیرد؛ حساب گوگلی شماره ندارد |
| اتصال به حساب موجود فقط با ایمیلِ `email_verified` | ایمیل تأییدنشدهٔ یک Workspace می‌توانست حساب دیگری را در اختیار بگیرد |
| نام گوگل فقط جای خالی را پر می‌کند | چیزی که کاربر خودش در پروفایل نوشته بازنویسی نمی‌شود |
| `googleId` مثل `passwordHash` در `publicUser` حذف می‌شود | شناسهٔ داخلی سرور است؛ نشست سایت در `localStorage` مرورگر می‌نشیند |
| پروفایل ناقص ⇒ `#onboarding`، پروفایل کامل ⇒ `#dashboard` | همان «ثبت نام اولیه» خواسته‌شده؛ حساب موجود دوباره آنبوردینگ نمی‌بیند |

**دو تفاوت مهم با `/api/users/*`:**

1. `/api/users/*` **فقط در حالت توسعه** سوار می‌شود (`apiPlugin.js` → middleware ویت)؛
   `server.js` آن را ندارد و کلاینت در نبودش به `localStorage` می‌افتد. `/api/auth/google/*`
   در **هر دو میزبان** فعال است.
2. `POST /api/users/login` با یک گارد سخت‌گیرانه کار می‌کند: حساب بدون `passwordHash`
   (یعنی حساب گوگلی) **هرگز** با رمز وارد نمی‌شود. بدون آن گارد، شرط قدیمی
   (`if (user.passwordHash && …)`) برای حساب گوگلی هر رمزی را قبول می‌کرد.

**تست:** `node database/googleAuth.test.mjs` — ۳۴ سنجه، بدون سرور بیرونی. سنجهٔ «ورود موفق»
عمداً وجود ندارد؛ آن را فقط با یک ورود واقعی با حساب گوگل خودت می‌شود ثابت کرد.


### مجموعه‌های دادهٔ CMS (`database/content/*.json`)

`admins` · `articles` · `categories` · `pages` · `media` · `banners` · `activity` · `notes` ·
`settings` · `alerts` · `events`

در اولین درخواست خودکار ساخته و seed می‌شوند (`ensureStore`).
**بازنشانی کامل:** `rm -rf database/content` (توجه: رویدادهای واقعی تحلیل هم پاک می‌شوند).

> ✅ پوشهٔ `content/` و `users.json` در **ریشهٔ پروژه** کهنه بودند و حذف شدند؛ کد فقط
> `database/content/` و `database/users.json` را می‌خواند. اگر جایی خطای «فایل پیدا نشد» دیدی،
> اول مطمئن شو مسیر `database/` است نه ریشه.

### امنیت (خلاصه)

کوکی `HttpOnly` + `SameSite=Strict` + هدر `x-tapesh-csrf` · رمز `scrypt` + salt + `timingSafeEqual` ·
پاک‌سازی HTML با allow-list پیش و پس از ذخیره · allow-list نوع MIME برای آپلود ·
پیام خطای یکسان برای «کاربر ناموجود» و «رمز اشتباه» · قفل موقت پس از تلاش‌های ناموفق ·
ثبت هر عملیات مهم در `activity.json` · هیچ کلیدی در سورس نیست.

**ورود با گوگل:** `client_secret` فقط سمت سرور · گارد CSRF با `state` دوگانه (آدرس + کوکی
`HttpOnly`) و مقایسهٔ `timingSafeEqual` · کوکی «دست‌دادن» یک‌بارمصرف و ۲ دقیقه‌ای · دادهٔ کاربر
هرگز در آدرس نمی‌نشیند · خطای واقعی گوگل فقط در لاگ سرور می‌ماند و به مرورگر «نشد» می‌رود.

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

### رنگ‌ها — همه توکن‌اند، نه hex

هیچ رنگی در کد سخت‌کد نمی‌شود. `src/styles.css` تنها منبع رنگ است و **دو بلوک** دارد:

| بلوک | نقش |
|---|---|
| `:root` | تم تیره (پیش‌فرض) — ۶۰ توکن |
| `:root[data-theme='light']` | تم روشن — ۴۹ توکن وابسته به تم را بازنویسی می‌کند |

| گروه | توکن | مقدار در تم تیره |
|---|---|---|
| سطح | `--deep` `--background` `--surface` `--surface-soft` `--surface-strong` | `#121212` `#181818` `#242426` `#282828` `#333` |
| متن | `--white` `--muted` `--faint` `--ghost` `--ink-deep` | `#fff` `#d0d0d0` `#8a8a8a` `#707070` `#111114` |
| پرکنندهٔ خنثی | `--pure` `--light-fill` `--light-fill-soft` `--border-solid` | `#fff` `#d4d4d4` `#efefef` `#3f3f47` |
| اکسنت | `--blue` `--green` `--brown` `--purple` (+`-bright`) | `#2e4b75` `#465c4d` `#604e42` `#574c80` → `-bright`: `#5b8cc7` `#77b787` `#ab8e7c` `#937fcd` |
| اکسنت تیره | `--gold` `--orange` `--red` `--rose` `--green-vivid` | `#e0b45c` `#ff9717` `#e26d6d` `#ef9196` `#61d192` |
| متن اکسنت | `--{family}-ink` / `--{family}-soft-ink` | متن روی پس‌زمینهٔ رنگی (در تم روشن تیره می‌شود) |
| پنل اکسنت | `--{family}-deep` | `#0d1b2c` `#0f2018` `#191430` `#221a0b` `#241a15` `#241012` |
| کارت رنگی | `--card-lavender` `-copper` `-sage` `-sky` `-warm` | `#302942` `#342b27` `#25312b` `#1f2c3d` `#302925` |
| آلفا | `--wash-rgb` `--scrim-rgb` `--line-rgb` `--ink-rgb` `--shadow-rgb` `--shadow-scale` | پایهٔ `rgb(var(--x-rgb) / 0.05)` |
| متفرقه | `--icon-filter` `--form-error` (`#ff6969`) `--content-width` (`80%`) | |

> ⚠️ `--white` **متن اصلی است، نه «رنگ سفید»** — در تم روشن `#16161b` می‌شود. برای سفیدِ واقعی
> `--pure` را استفاده کن.

> ⚠️ **نردبان سطح را جدی بگیر:** پس‌زمینهٔ *صفحه* همیشه `--background` است — هم بدنهٔ سایت،
> هم پوستهٔ داشبورد (`.dashboard`) و هدرش، هم `--gp-bg` مسیر سبز. `--deep` کارش
> «فرورفته‌ترین سطح» است و فقط برای **فرورفته‌های درون‌کارت** مصرف می‌شود: نشان برند،
> برچسب دوره، فوتر کارت، لوگوی پنل ورود.
>
> `--deep` **سیاهِ خالص نیست**: `#121212` است، یعنی همان فاصلهٔ ۶ واحدیِ زیرِ
> `--background` (`#181818`) که تم روشن از قبل داشت. دلیلش این است که هر پنلِ فرورفته
> و هر `bg-black/N` با زمینهٔ صفحه هم‌خانواده بماند و «سیاهِ مطلق» جدا نیفتد.
> در Tailwind هم `bg-black` از `--color-black` → `--deep` می‌آید (تم‌پذیر)، نه از
> hex ثابتِ `#000`.
>
> اگر جایی واقعاً به «همیشه تیره» نیاز داری (سایه، پردهٔ پشت مودال، روکش تیره‌کنندهٔ
> روی تصویر) سراغ `--deep` نرو؛ آن‌ها `--shadow-rgb` می‌خواهند که در هر دو تم سیاه می‌ماند.

> ⚠️ برای اکسنت، فقط `*-ink` (متن/دکمه) و `*-deep` (پرکنندهٔ ملایم) در **هر دو تم**
> بازتعریف شده‌اند. `--gold`, `--copper`, `--red`, `--orange` در تم روشن بازنویسی
> **نمی‌شوند**؛ پس برای پرکننده استفاده نشوند (در بخش محصولات همین قاعده رعایت شده:
> اکسنتِ نارنجی زمینه‌اش را از `--copper-deep` می‌گیرد).

**سه «تیره»ی متفاوت که در تم روشن رفتار جدا دارند:**

| توکن | معنی | تم تیره | تم روشن |
|---|---|---|---|
| `--wash-rgb` | لایهٔ نازک روی سطح (مثل `rgb(var(--wash-rgb) / 0.05)`) | `255 255 255` | `16 20 28` |
| `--scrim-rgb` | پردهٔ ماتِ هم‌رنگِ سطح (پنل شیشه‌ای، پس‌زمینهٔ کارت، روکش روی مدیا) | `18 18 18` | `255 255 255` |
| `--shadow-rgb` | سایه و هر چیزی که **در هر دو تم تیره می‌ماند** | `0 0 0` | `16 20 28` (+`--shadow-scale: 0.45`) |

### Tailwind v4 و تم‌پذیری کلاس‌های inline

`white` و `black` در Tailwind از `--color-white` / `--color-black` رد می‌شوند. پس با دو خط remap
**بیش از ۸۰۰ کاربرد** `text-white` / `bg-white` / `bg-white/5` / `border-white/10` خودکار تم می‌گیرند:

```css
/* در :root پایه (تم تیره) و تکرارش در بلوک تم روشن */
:root                    { --color-white: var(--white); --color-black: var(--deep); }
:root[data-theme='light'] { --color-white: var(--white); --color-black: var(--deep); }
```

> اگر این دو خط **فقط** در بلوک تم روشن باشند، در تم تیره `bg-black/N` به مقدار پیش‌فرضِ
> خودِ Tailwind (`#000`) برمی‌گردد و سیاهِ خالص می‌شود — همان چیزی که `--deep` عمداً از آن
> فاصله گرفته. پس تعریفشان در `:root` پایه لازم است.

دو استثنا لازم شد — چون `bg-white` باید *سطح* باشد نه متن، و `bg-black/25` باید *لایهٔ خاکستری*
باشد نه پردهٔ سفید:

```css
:root[data-theme='light'] .bg-white     { background-color: var(--surface); }
:root[data-theme='light'] .border-white { border-color: var(--border-solid); }
:root[data-theme='light'] .bg-black\/25 { background-color: rgb(16 20 28 / 0.035); }
/* و همین‌طور /30 /40 /45 /50 /70 /75 */
```

این کار می‌کند چون CSS cascade layers دارد: قواعد **بی‌لایهٔ** نویسنده بر `@layer utilities`
تیل‌ویند بدون `!important` غلبه می‌کنند.

> ⚠️ `bg-[#282828]` به CSS **لیترال** کامپایل می‌شود ⇒ تم‌پذیر نیست. برای رنگ تم‌پذیر همیشه
> `bg-[var(--surface-soft)]` بنویس (یا در Tailwind از `@theme inline` استفاده کن).

### دکمهٔ تم

| فایل | نقش |
|---|---|
| `src/services/theme/themeService.js` | تنها منبع حقیقت: `getTheme` / `setTheme` / `toggleTheme` / `applyTheme` / `subscribeTheme` + `THEME_KEY = 'tapesh:theme'` |
| `src/layout/ThemeToggle.jsx` | دکمهٔ مشترک (آیکون حالت **مقصد** را نشان می‌دهد). اندازه با `--theme-toggle-size` |
| `index.html` | اسکریپت inline ضد FOUC + `<meta name="theme-color">` |

دکمه در ۶ سطح نشسته: هدر سایت (`.site-header__actions`)، ورود/ثبت‌نام (`.auth-panel__theme`)،
هدر پنل مدیریت، ورود پنل، آنبوردینگ، صفحهٔ آفلاین، و هدر داشبورد. `localStorage` + رویداد `storage`
⇒ همگام بین تب‌ها. ریدر (`reader.css`) تم تیره/روشن/سپیا خودش را دارد و فقط **مقدار پیش‌فرضش** از
تم سایت می‌آید.

### تایپوگرافی

- `Pinar` → متن بدنه · `Doran` → تیترها · **`Vazir` → فالبک اول** · سپس `Tahoma, sans-serif`.
- `@font-face` در `src/styles.css`، فایل‌ها در `fonts/{pinar,doran,vazir}/*.woff2`.
- **اعداد همیشه فارسی:** با `toFa(value)` / `faNum(...)` (هر لایه نسخهٔ خودش را دارد یا از
  `leagueShared` می‌گیرد).
- تاریخ شمسی **بدون کتابخانه**: `Intl.DateTimeFormat('fa-IR-u-ca-persian')` و برای محاسبه
  `'fa-IR-u-ca-persian-nu-latn'`.

#### پرش فونت (FOUT) و پیش‌بارگذاری — اندازه‌گیری‌شده، حدس نزن

مرورگر فایل فونت را **فقط وقتی درخواست می‌کند که متنی واقعاً با آن فونت رندر شود**. این پروژه
SPA است، پس آن لحظه = لحظهٔ رندر React، یعنی دانلود فونت تازه **بعد از** بارگذاری کل
جاوااسکریپت شروع می‌شود. عددهای واقعی (کروم headless، `npm run dev` سرد):

| | شروع درخواست فونت | پایان دانلود | اولین رنگ‌آمیزی |
|---|---|---|---|
| بدون `preload` | ۲۶۳۱۹ms (۳۱ms **بعد از** اولین رنگ‌آمیزی) | ۲۷۳۰۱ms | ۲۶۲۸۸ms |
| با `preload` | ۲۰۷۷ms (همراه خود HTML) | ۴۱۱۴ms | ۷۶۸۸ms |

یعنی بدون `preload` کاربر ~۱ ثانیه متن را با فونت پشتیبان می‌بیند؛ با `preload` فونت
**قبل از** اولین رنگ‌آمیزی می‌رسد و هیچ متنی با فونت اشتباه دیده نمی‌شود.

- چهار فایل در `index.html` پیش‌بارگذاری می‌شوند — **همان‌هایی که صفحهٔ اول واقعاً مصرف می‌کند**:
  `Pinar-VF` (بدنه) + `Doran` وزن‌های ۴۰۰/۵۰۰/۷۰۰. وزن‌های ۸۰۰/۹۰۰ Doran فقط در تیترهای
  پایین‌تر صفحه‌اند و پیش‌بارگذاری نمی‌شوند.
- **`crossorigin` روی `rel="preload" as="font"` الزامی است** — فونت با CORS گرفته می‌شود؛
  بدون آن مرورگر همان فایل را دو بار می‌گیرد و سنجهٔ زیر قرمز می‌شود.
- ویت `href` این تگ‌ها را در بیلد به نام هش‌شدهٔ `assets/` بازنویسی می‌کند (تأییدشده در یک
  بیلد سندباکس: `./assets/Pinar-VF_DSTY_KSHD_wght_-DfuwEvYg.woff2`)، پس `base: './'` هم
  مشکلی نمی‌سازد.
- **چرا فونت پشتیبانِ لحظهٔ صفر وزیر نیست:** وزیر خودش وب‌فونت است و باید دانلود شود، پس
  نمی‌تواند در لحظهٔ صفر حاضر باشد؛ تنها فونتی که واقعاً آماده است فونت نصب‌شدهٔ سیستم
  (`Tahoma`) است. با `preload` این بحث عملاً منتفی می‌شود. (سنجیده‌شده با
  `CSS.getPlatformFontsForNode` در حالتی که همهٔ `*.woff2` بلاک بودند: هر سه عنصر ⇒ `Tahoma`.)
- در **توسعه** هر ریلود پرش دارد (ویت فونت را با `Cache-Control: no-cache` می‌دهد ⇒ اعتبارسنجی
  دوباره)، ولی در **پروداکشن** `server.js` فونت را `immutable, max-age=31536000` می‌دهد ⇒
  پرش فقط در اولین بازدید ممکن است.

### قواعد چیدمان و انیمیشن

- `--content-width: 80%` عرض استاندارد محتواست.
- `border-radius` بزرگ: ۲ تا ۲.۵rem (کارت‌ها تا ۳rem).
- **هر لایه CSS خودش را با پیشوند کلاس اختصاصی دارد:** `tb-` (بانک تست)، `an-` (تحلیل پنل)،
  `intl-` (بین‌الملل)، `ad-` (پنل مدیریت)، `dash-` (داشبورد) و…
- توکن‌های محلی لایه‌ها (`--ad-*`, `--learn-*`, `--intl-*`) **به توکن‌های جهانی ارجاع می‌دهند**
  (`--ad-bg: var(--background)`، `--learn-border: rgb(var(--line-rgb) / 0.085)`) ⇒ خودکار تم
  می‌گیرند. تم روشن نیاز به پاس جداگانه ندارد.
- انیمیشن ورود استاندارد: `dashboard-layer-reveal` / `dash-stagger`.
- **همهٔ انیمیشن‌ها گارد `prefers-reduced-motion` دارند** — این یک قاعدهٔ پروژه‌ای است، نه انتخاب.
- ⚠️ **اگر انیمیشن‌ها «روی همین مک» دیده نمی‌شوند ولی روی کامپیوترهای دیگر دیده می‌شوند،
  باگ سایت نیست — تنظیم سیستم است.** `defaults read com.apple.universalaccess reduceMotion`
  اگر `1` برگرداند، «کاهش حرکت» در System Settings ← Accessibility ← Display روشن است؛ کروم
  `prefers-reduced-motion: reduce` گزارش می‌کند و همهٔ گاردها فعال می‌شوند. محتوا **بی‌حرکت ولی
  کامل و خوانا** دیده می‌شود (بلوک‌های reduce هر لایه همین را تضمین می‌کنند) — پس اگر محتوا
  هست و فقط حرکت نیست، دنبال باگ نگرد.
  **این دامنهٔ `defaults` قابل نوشتن نیست:** نه `defaults write` («Could not write domain»)
  و نه `PlistBuddy` («Operation not permitted») — حتی با مالکیت کاربر و `-rw-------`. فقط از
  خود System Settings خاموش می‌شود. تشخیص قطعی: `defaults read com.apple.universalaccess reduceMotion`.
- در `@media (min-width: 701px)` داشبورد `height: 100dvh; overflow: hidden` می‌گیرد.
  **پس چیدمان‌های عمودی را با نسبت `flex: n 1 0` بده، نه ارتفاع ثابت.**
- **هدر داشبورد باید ثابت بماند** (`dashboard.css`). سه چیزی که باعث «پریدن» هنگام جابه‌جایی
  بین لایه‌های تست می‌شد و رفع شد:
  1. انیمیشن ورود روی خودِ `<header>` که با هر remount دوباره اجرا می‌شد → حذف شد.
  2. `background: rgba(0,0,0,0.94)` + `backdrop-filter: blur(16px)` که لبهٔ بلور با لغزش محتوای
     زیرش جابه‌جا می‌شد → `background: var(--background)` **مات** و بدون blur (عیناً همان رنگ
     بدنهٔ داشبورد، تا هدر و بدنه یک تکه دیده شوند).
  3. `min-height: clamp(66px, 10vh, 98px)` که ارتفاع هدر را تابع ویوپورت می‌کرد →
     `--dashboard-header-height: 84px` (در `max-width:1100px` برابر `104px`).
  ظرف‌های اسکرول (`.dashboard__section`، `.dashboard__settings-panel`) هم
  `overflow-anchor: none; scrollbar-gutter: stable` دارند.
- **ناوبری هدر سایت نسبت به کل صفحه وسط است، نه نسبت به ردیف هدر.** لوگو و
  اکشن‌های هدر عرض یکسان ندارند، پس `margin-inline: auto` روی `.site-nav` مرکزش را
  از مرکز صفحه می‌لغزاند. در `@media (min-width: 641px)` دو ستون کناری هم‌عرض
  می‌شوند (`.site-header > .brand` و `.site-header__actions` با `flex: 1 1 0`) ⇒
  مرکز ناوبری = مرکز هدر = مرکز صفحه. اقلام در جریان می‌مانند، پس در عرض باریک
  هیچ‌وقت روی هم نمی‌افتند. ناوبری ۴ لینک دارد: محصولات (آبی) · تعرفه‌ها (بنفش) ·
  درباره ما (قهوه‌ای) · مقالات (سبز — همان اکسنت خودِ لایهٔ مقالات).
- **کارت‌های مقالهٔ صفحهٔ اصلی (`#articles`) با `subgrid` هم‌تراز می‌شوند.** تیتر هر کارت
  بسته به عرض صفحه ۲ تا ۶ خط می‌شود و چون توضیحات بعد از تیتر می‌آمد، شروعش به ارتفاع
  تیترِ همان کارت گره خورده بود و تا ~۳۵px ناتراز می‌شد (۱۲۸۰px: ۳۴.۵px، ۱۳۶۶px: ۳۶.۷px).
  حالا `.article-grid` سه ردیف مشترک دارد (تصویر · تیتر · توضیحات) و هر کارت با
  `grid-template-rows: subgrid` آن‌ها را قرض می‌گیرد؛ `.article-card__content` هم خودش
  subgrid است تا `h3` و `p` روی ردیف‌های والد بنشینند (پدینگ بلوک محفوظ می‌ماند و
  رندر سرور سنجشش نمی‌کند). فقط `min-width: 641px` — زیر آن شبکه تک‌ستونی است و
  هم‌ترازی افقی معنا ندارد. `row-gap: 0` حیاتی است (ردیف‌ها داخلِ هر کارت‌اند، نه
  بین کارت‌ها). ⚠️ **`line-clamp` راه‌حل این مسئله نیست** — تیترهای بلند «…» می‌خورند.
  فلشِ کارت (`.article-card__go`) هم به همین دلیل `flex: 1` روی بلوک محتوا دارد.
- **فهرست پرسش‌های متداول صفحهٔ اصلی (`faqItems` در `App.jsx`) و متن معرفی فوتر**
  محتوای دستی‌اند، نه دادهٔ سرویس؛ جای ویرایششان همان آرایه/بلوک در `App.jsx` است.
  پرسش دوره با نام رسمی پروژه یکی است: **«مسیر سبز»** (نه «مسیر رشد») — همان نامی که
  `LAYER_IDS.greenPath` و README استفاده می‌کنند.
- **نوار پنج دورهٔ صفحهٔ اصلی:** `.hero__courses` فرزند دومِ grid هیرو است (`.hero` با
  `place-items: center`) و عرضش را خودش تعیین می‌کند: `var(--content-width)` — **بی‌سقف**،
  یعنی دقیقاً هم‌عرض `.section-shell` بخش‌های دیگر. زیر ۶۴۰px هم
  `calc(100% - 2 * var(--hero-gutter))` می‌گیرد تا با حاشیهٔ ۱۶pxی بخش‌های موبایل یکی بماند.
  ⚠️ **تلهٔ اندازه‌گیری‌شده:** درصدِ `var(--content-width)` نسبت به **جعبهٔ محتوای** والد
  حساب می‌شود، نه نسبت به ویوپورت. پس اگر `.hero` پدینگ افقی داشته باشد، نوار ۸۰٪ عرضِ
  «ویوپورت منهای پدینگ» می‌شود و بی‌صدا از بخش‌های دیگر باریک‌تر می‌افتد (یک‌بار همین شد:
  ۳۵۴px در برابر ۳۵۸px). راه‌حل: پدینگ افقی روی خودِ هیرو نمی‌نشیند و به‌صورت توکن
  `--hero-gutter` به فرزندانش داده می‌شود (`.hero__content` → `padding-inline`).
  کارت‌ها همان `CatalogCourseCard` داشبوردند و شبکه‌شان (`grid-cols-2 sm:grid-cols-3
  lg:grid-cols-5`) هم همان است؛ فقط نسخهٔ `size="lg"` می‌گیرند که پلهٔ بزرگ‌ترش روی
  `2xl` (۱۵۳۶px) می‌نشیند — چون نوار تازه از ~۱۵۳۵px به بعد از سقف قدیمی ۱۱۸۰px رد می‌شود.
  اندازه‌گیری‌شده در ۱۹۲۰px: کارت ۲۹۱×۳۸۰ (پیش‌تر ۲۱۴×۳۰۰) و نوار هم‌عرض `.promo-grid`.
- **کادرهای تبلیغی محصولات صفحهٔ اصلی:** `.promo-grid` > `.promo-card` در `styles.css`،
  همان‌جا در بخش `.continuation`. چهار محصول (بانک تست · تپش هوشمند · ویکی تپش · شبکهٔ دانش)
  در نمایشگرهای بالاتر از ۶۴۰px یک شبکهٔ ۱۲ ستونهٔ نامتقارن می‌سازند: ردیف اول
  نسبت ۷/۵ و ردیف دوم نسبت ۵/۷ دارد، بنابراین فرمِ دو ردیفِ کادرهای مرجع حفظ می‌شود؛
  زیر ۶۴۰px شبکه به یک ستون برمی‌گردد. خودِ شبکه چپ‌به‌راست فقط برای تعیین عرض کارت‌هاست
  و جهت فارسیِ هر `.promo-card` صریحاً RTL باقی می‌ماند. پس‌زمینهٔ همهٔ کادرها همان
  `--surface` کارت‌های اصلی پنج‌تایی زیر هدر است؛ اکسنت هر کادر `--promo-accent` و متن از
  توکن‌های `*-ink` می‌آید تا هر دو تم درست بمانند. آیکون شبکهٔ دانش هم از `--green-ink`
  استفاده می‌کند (نه زرد). داده‌اش
  `homePromoCards` در `App.jsx` است (**عمداً `export` شده** تا هارنس بتواند مقصدها را بسنجد —
  دکمه `<button>` است و مقصدش در HTML نمی‌نشیند) و مقصد هر کادر از `dashboardRouteHash` +
  `LAYER_IDS` ساخته می‌شود، نه رشتهٔ دستی. `id="courses"` عمداً روی ظرف مانده: لینک‌های فوتر
  و صفحهٔ مقاله به `#courses` می‌آیند. سنجهٔ نگهبانش در `verify-render.mjs` است (شمارش +
  «هر چهار مقصد یک لایهٔ واقعی است»).
- **پاپ‌آپ ثبت‌نام صفحهٔ اصلی:** `.signup-modal` در `styles.css`. پرده‌اش از `--shadow-rgb`
  می‌آید نه `--scrim-rgb` — چون قاعدهٔ خودِ توکن‌ها می‌گوید «هر چیزی که باید همیشه تیره بماند»
  (سایه و پردهٔ پشت مودال) و `--scrim-rgb` در تم روشن سفید می‌شود.
- **«ما را دنبال کنید» در فوتر سایت:** `FOOTER_SOCIAL_LINKS` در `App.jsx` (پنج مورد: بله ·
  ایتا · تلگرام · اینستاگرام · یوتیوب). **هر پنج نشانه تصویرند، نه متن و نه CSS:** فایل‌ها در
  `images/icons/` می‌نشینند (سه `webp` قدیمی + `eitaa.svg` و `youtube.svg`) و همه تک‌فامِ سفید
  ذخیره شده‌اند؛ رنگ با تم از `filter: var(--icon-filter)` روی `.site-footer__social-link img`
  می‌آید (سفید در تیره، تیره در روشن). پس **آیکون تازه باید تصویرِ تک‌فام باشد**، نه گلایفِ
  تایپی — دو مورد قبلی (ایتا با حرف `e` و یوتیوب با `▶` داخل قاب) کنار سه نشانهٔ تصویری ناهمگون
  می‌شدند. `viewBox` هر SVG عمداً ~۷٪ پدینگ دارد تا اندازهٔ نوری‌اش با سه تای دیگر یکی شود.
- **نوار کناری پنل مدیریت داینامیک است:** پیش‌فرض ۲۵۸px باز با عنوان‌ها (مثل قبل)،
  و کلید پایین نوار (`.ad-sidebar__collapse`) کلاس `is-collapsed` را می‌نشاند و آن را
  به ریل آیکونی `--ad-sidebar-w-min: 79px` جمع می‌کند. انیمیشن روی `width`/`flex-basis`
  است و نوار در جریان می‌ماند (اورلی نیست) ⇒ محتوا فضای آزادشده را می‌گیرد.
  در حالت جمع، `title` هر آیتم به‌صورت راهنمای شناور می‌آید. زیر ۸۶۱px (کشوی موبایل)
  کلید پنهان است و نوار همیشه با عنوان می‌ماند. جزئیات در `src/layout/admin/README.md`.
- Tailwind فقط در چند بخش استفاده شده (کلاس‌های inline مثل `bg-[var(--surface-soft)]`) — بیشتر
  استایل‌ها CSS خالص‌اند. برای تغییر یک بخش، **همان الگوی همان بخش** را ادامه بده.
- **لایهٔ «دربارهٔ تپش» (`#about`)** یک روایت ۱۰ مرحله‌ای دارد (۱۱ بخش DOM چون اکوسیستم
  دو زیر‌بخش دارد): هیرو، مسئله، جریانِ «از پراکندگی تا فهم»، نگاه ما، اکوسیستم محصولات،
  چرخهٔ یادگیری، تاریخچه، اصول، مخاطب و CTA پایانی. در هیرو حلقه‌ها با انیمیشنِ آرام حرکت
  می‌کنند؛ جریانِ چرا تپش سه ورودی را به «فهمِ قابل استفاده» می‌رساند؛ چرخه از
  `stageMode: 'endpoints'` استفاده می‌کند تا نشانگر و مرحلهٔ آخر هم‌راستا بمانند؛ و شش اصل،
  شش الگوی حرکت جدا دارند. کادر صدای یادگیرنده در دسکتاپ ثابت و هم‌اندازه است و محتوایش با
  کلیدِ سناریو دوباره وارد می‌شود. بخش «این پایان تپش نیست» عمداً از DOM، سرویس و CSS حذف شده است.

### بررسی خودکار تم — بدون مرورگر، بدون بیلد

`npm run theme:check` هر چهار اسکریپت را پشت‌سرهم اجرا می‌کند:

| اسکریپت | چه چیزی را ثابت می‌کند |
|---|---|
| `theme-verify.mjs` | آکولادها بسته‌اند + هر ۶۰ توکن در `:root` تعریف شده + هر ۴۹ توکن وابسته در تم روشن override شده |
| `theme-contrast.mjs` | کنتراست WCAG هر ۲۱ جفت متن/سطح در هر دو تم (الان: ۰ ایراد در هر دو) |
| `tailwind-probe.mjs` | خروجی **واقعی** کامپایلر Tailwind: نام کلاس‌های تولیدشده دقیقاً با سلکتورهای دست‌نویس `styles.css` یکی است |
| `verify-render.mjs` | سنجه‌های رندر سرور: رگرسیون صفحهٔ اصلی (شامل کادرهای تبلیغی محصولات)، لایهٔ محصولات و تعرفه‌ها و اشتراک گروهی، ثبات هدر داشبورد، حضور دکمهٔ تم در هر ۶ سطح، صفحهٔ ورود/ثبت‌نام با دکمهٔ گوگل (بخش ۹)، و هم‌رنگی پس‌زمینهٔ داشبورد با صفحهٔ اصلی (بخش ۱۰)؛ سنجهٔ محصولات هدرِ یکدست، ۵ برگه، ۴ کادر چرخان، کارتِ مستقلِ مقالات، تصویر شبکه، دفترچه و اکوسیستم را هم کنترل می‌کند. |

> `scripts/theme-migrate.mjs` و `scripts/rgba-migrate.mjs` اسکریپت‌های **یک‌بارمصرف** مهاجرت‌اند
> (قبلاً روی کل پروژه اجرا شده‌اند). دوباره اجرا کردنشان مخرب است.

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
برای بررسی سریع از `./node_modules/.bin/esbuild` استفاده کن.

دو روش بررسی بدون مرورگر در اسکیل `react-layer-headless-verify` مستند شده است:
**رندر سرور** با `react-dom/server` (نیاز به `jsdom` ندارد) و jsdom تعاملی.
در این محیط `npm install` بلاک است و `jsdom` نصب نیست ⇒ عملاً رندر سرور.
نکتهٔ کلیدی: افکت‌ها در رندر سرور اجرا نمی‌شوند، پس کامپوننتی که پشت افکت قفل است
(مثل پوستهٔ پنل که اول نشست می‌گیرد) باید نسخهٔ درونی‌اش `export` شده باشد.

### ۶) فایل‌های کهنه — پاک شدند (۱۸ سپتامبر ۲۰۲۶)

`route-preview.html` + `src/__routePreview.jsx` (هارنس موقت)، `review-preview.html` (به فایل
ناموجود وصل بود)، `content/` و `users.json` در ریشه، و `src/layout/dashboard/setting/fgh.html`
(صفر بایت) بخشی از برنامه نبودند و حذف شدند. بازگردانی هرکدام تا وقتی commit نشده:
`git checkout HEAD -- <file>`.

هم‌زمان **۳۲ زائد probe/bundle** از ریشهٔ پروژه پاک شد (`.app.out.mjs` تنها ۴۷ مگ بود) و الگوی
`.probe*` و `*.out.mjs` به `.gitignore` اضافه شد. هارنس واقعی (`scripts/verify-render.mjs`)
خروجی موقتش را در `node_modules/.cache/tapesh-verify/` می‌سازد و خودش پاک می‌کند —
**پس هیچ فایل موقتی نباید در ریشهٔ پروژه جا بماند.**

### ۷) کد ۴۰۳ در تلگرام/بله یعنی «دسترسی ندارد»، نه «توکن باطل»

تلگرام برای «ربات عضو کانال نیست» هم `403` می‌دهد، نه فقط برای توکن باطل
(`Forbidden: bot is not a member of the channel chat`). ترجمهٔ قبلی هر ۴۰۳ را «توکن
نامعتبر» می‌خواند و همین باعث شد خطای واقعی در پنل به‌شکل «توکن را عوض کن» دیده شود —
یعنی کاربر دنبال جای اشتباهی می‌رفت.
**قاعده:** در ترجمهٔ خطا اول *متن* سرویس را بخوان، بعد کد وضعیت. `401` →
`PUBLISH_UNAUTHORIZED`، `403` → `PUBLISH_FORBIDDEN`. گارد رگرسیون: سنجه‌های ۲۸ در
`adminApi.test.mjs`.

### ۸) «کانال دیده می‌شود» با «ربات اجازهٔ ارسال دارد» یکی نیست

`getChat` روی کانال **عمومی** موفق می‌شود حتی وقتی ربات اصلاً عضو آن نیست. پنلی که از
آن تیک سبز «آمادهٔ ارسال است» بسازد، دروغ گفته است — و ارسال واقعی با ۴۰۳ می‌افتد.
برای تلگرام، «اجازهٔ ارسال» جدا با `getChatAdministrators` بررسی می‌شود.
**قاعده:** هر تیک سبز باید دقیقاً همان چیزی را ثابت کند که ادعا می‌کند؛ اگر API نمی‌تواند
ثابت کند، جواب `ok: null` («بررسی‌نشده») است، نه `true`.

### ۹) شناسهٔ مقصد را حدس نزن

شبیه بودن یوزرنیم کانال‌ها در پلتفرم‌های مختلف دلیل بر یکی بودنشان نیست. `chat_id` را
یا از API بگیر (بله/تلگرام: `getChat`) یا از پنل خود پلتفرم. اگر API راهی برای بررسی
ندارد (ایتا)، مقدار را از کاربر بپرس — حدس زدن یعنی اولین ارسال واقعی می‌شکند.
و اگر مستندات یک پلتفرم می‌گوید «یوزرنیم هم قبول است»، آن را با آزمون واقعی بسنج:
ایتایار یوزرنیم را پیدا می‌کند ولی ارسال با آن را `403` می‌دهد؛ فقط شناسهٔ عددی کار می‌کند.

**همین تله در یک پلتفرم هم رخ می‌دهد.** دو کانال تلگرام با یوزرنیم تقریباً یکسان
(`@mytapesh` و `@mtapesh`) وجود داشت؛ ربات در یکی ادمین شده بود و پنل به آن یکیِ دیگر
اشاره می‌کرد. `getChat` هر دو را سبز نشان می‌داد و فقط ارسال واقعی می‌شکست.
**راه تشخیص قطعی:** `getUpdates` روی ربات — تلگرام رویداد `my_chat_member` را نگه
می‌دارد و دقیقاً می‌گوید ربات در **کدام** چت و با چه وضعیتی عضو شده. برای همین ترجیح
بده `chat_id` را **شناسهٔ عددی** بگذاری، نه یوزرنیم: با تغییر یوزرنیم باطل نمی‌شود و
با کانال‌های هم‌نام اشتباه نمی‌شود.

### ۱۰) CTAی محصول نباید به یک لنگرِ بی‌ربط ختم شود

کارت‌های قدیمیِ بخش محصولاتِ صفحهٔ اصلی، با وجود عنوان‌های متفاوت («درسنامه جامع»،
«بانک تست جامع»، …) همگی به `#benefits` می‌رفتند — یعنی در عمل هیچ‌کدام به محصول
وصل نبودند و کاربر فقط کمی پایین‌تر می‌رفت.
**قاعده:** مقصدِ هر محصول باید **لایهٔ واقعیِ همان محصول در داشبورد** باشد، ساخته‌شده
از `LAYER_IDS` (و نه رشتهٔ دستی)، و کاربرِ واردنشده باید صریحاً به `#auth` برود.
اگر لنگرها/مسیرها عوض شوند و این‌ها از `LAYER_IDS` نیایند، هیچ سنجه‌ای شکستن‌شان را
نمی‌گیرد — چون از نظر مرورگر یک لینکِ کاملاً معتبر است.

امروز محصولات یک **صفحهٔ مستقل** (`#products`) است و هر CTA به لایهٔ واقعیِ همان
محصول می‌رود؛ سنجهٔ «هر محصول مقصدِ واقعیِ داشبورد دارد» در `verify-render.mjs`
همین را نگه می‌دارد.

همین قاعده در **کادرهای تبلیغی محصولات صفحهٔ اصلی** هم رعایت می‌شود: `homePromoCards`
در `App.jsx`، هر کادر با مقصدی ساخته‌شده از `LAYER_IDS` (مسیر سبز · `tapesh-ai` ·
`wiki` · `knowledge`). دکمهٔ این کادرها `<button>` است نه `<a>` — چون رفتن به داشبورد
باید از گارد ورود بگذرد و کاربرِ واردنشده مقصدش را در `pendingDashboardHash` نگه
می‌دارد تا پس از ورود یا تکمیل پروفایل همان‌جا فرود بیاید. هزینه‌اش این است که مقصد
در HTML نمی‌نشیند؛ برای همین هارنس خودِ `homePromoCards` را می‌خواند و لایهٔ هر مقصد
را با `readDashboardRoute` می‌سنجد (به همین دلیل آن ثابت `export` شده است).

### ۱۱) انتخابگر CSSِ بی‌قید = خرابی در جای دیگری

**`.brand` یک کامپوننت مشترک است** (`src/layout/dashboard/Brand.jsx`) و هم هدر سایت
(`SiteHeader` در `App.jsx`) و هم هدر داشبورد (`DashboardHeader.jsx`) آن را رندر
می‌کنند. یک قاعدهٔ بی‌قید `.brand { flex: 1 1 0 }` که برای وسط‌چینی ناوبری سایت
نوشته شده بود، هدر داشبورد را به‌هم ریخت — بی‌هیچ خطای UI و بی‌هیچ سنجهٔ رندری.
**قاعده:** هر انتخابگری که به هدر سایت می‌زنی را به `.site-header` مقید کن
(`.site-header > .brand`)، و همین‌طور برای پنل به `.ad-*`.
گارد رگرسیون: سنجهٔ «قاعدهٔ ستون‌های هدر به .site-header مقید است» در
`verify-render.mjs`.

### ۱۲) در ریل آیکونی، آیکون را فشرده نکن و `gap` را صفر کن

دو تلهٔ جدا که هر دو «آیکونِ له‌شده» می‌سازند:
1. **`flex-shrink` پیش‌فرض (۱)** آیکون ۱۸px را به «عرض باقی‌ماندهٔ خط» می‌کوبد.
   در ریل جمع، آیکون به یک لکهٔ ۶٫۶px تبدیل شد. ⇒ `.ad-nav__item > svg { flex-shrink: 0 }`.
2. **`gap` حتی وقتی برچسب عرض صفر دارد جای می‌گیرد.** با `max-width: 0` روی
   برچسب، همان `gap: 0.7rem` می‌ماند و آیکون از مرکز ریل در می‌آید ⇒ در حالت جمع
   `gap: 0` بده (و پدینگ افقی لوگو را بردار تا لوگوی ۴۲px در ریل ۷۹px جا شود).
   عرض ریل از همین حساب می‌آید: `1rem×2 + 0.85rem×2 + 18px ≈ ۷۷px` ⇒ `79px`.
همچنین `min-width: 0` روی برچسب **اجباری** است؛ وگرنه `min-width: auto` فلیکس‌آیتم
روی «بزرگ‌ترین کلمه» می‌ماند و `max-width: 0` را باطل می‌کند.

### ۱۳) بکتیک خام داخل `String.raw` در هارنس = کل فایل خطای سینتکس

`scripts/verify-render.mjs` یک هارنسِ بزرگِ درونِ `String.raw` است (خط ۳۵ تا ۵۳۰). هر
**بکتیک خام** در متنِ داخلش — حتی در یک کامنت — قالب رشته را زودتر می‌بندد و بقیهٔ فایل
به‌عنوان کد پارس می‌شود. نتیجه یک `SyntaxError` در فایلی است که فقط «بررسی» می‌کند و
هیچ ربطی به خودِ اپ ندارد؛ و چون `theme:check` آن را آخر صدا می‌زند، سه اسکریپت اول سبز
می‌مانند و کل دستور رد می‌شود. دقیقاً یک‌بار رخ داد (کلمهٔ `COURSE_LAYERS` داخل کامنت).

**قاعده:** داخل هارنس بکتیک ننویس — برای نقل‌قول از «گیومهٔ فارسی» استفاده کن.
**تشخیص سریع:** `node --check scripts/verify-render.mjs`.

### ۱۴) حساب بدون رمز + `if (user.passwordHash && …)` = ورود با هر رمزی

گارد قدیمیِ `verifyUser` این بود: `if (user.passwordHash && user.passwordHash !== hash) return null`.
برای حسابی که `passwordHash` ندارد (حساب گوگلی) شرط **رد نمی‌شد** و هر رمزی قبول می‌شد.
**قاعده:** اول «رمز ندارد ⇒ رد کن»، بعد مقایسه کن. سنجهٔ ۳۲ در `googleAuth.test.mjs` نگهبانش است.
(تلهٔ کلی: شرط‌های `&&` روی مقدارِ `null` همیشه «عبور» می‌سازند، نه «رد».)

### ۱۵) افکتِ «یک‌بار در mount» با فلگ `active` زیر StrictMode بی‌صدا می‌شکند

پروژه زیر `StrictMode` است (`src/main.jsx`)، پس در توسعه هر افکت دو بار اجرا می‌شود
(mount → cleanup → mount). الگوی رایج `let active = true; … if (!active) return;` در ادامهٔ
`async` اینجا **مخرب** است: اجرای اول کار را شروع می‌کند، cleanup مقدار را `false` می‌کند،
و اجرای دوم — چون اجرای اول عارضهٔ جانبی (مثل پاک‌کردن پارامتر آدرس) را انجام داده —
شرط ورودی‌اش دیگر برقرار نیست. نتیجه: کار نیمه‌کاره می‌ماند، **بی‌هیچ خطایی**.

**قاعده:** برای افکتِ «فقط یک‌بار» از گارد `useRef` استفاده کن (`if (ref.current) return; ref.current = true`)،
نه فلگ `active`. (جای دیگر همین تله: دو بار صدا زدنِ یک endpoint یک‌بارمصرف.)
سنجهٔ «افکت گوگل یک‌بارمصرف است» در `verify-render.mjs` بخش ۹ نگهبانش است.

### ۱۶) ویت `.env` را در `process.env` نمی‌نویسد — فقط در `import.meta.env`

تلهٔ خاموش و گران. ویت فایل `.env` را می‌خواند، ولی فقط کلیدهایی که با `VITE_` شروع شوند
(پیش‌فرض `envPrefix`) و فقط برای **مرورگر**، در `import.meta.env`. هیچ‌کدام به `process.env`
نمی‌رسند — منبع: `loadEnv` در `node_modules/vite/dist/node/chunks/config.js` تنها
`NODE_ENV` / `BROWSER` / `BROWSER_ARGS` را به `process.env` می‌نویسد. یعنی middleware که در
همان پروسه اجرا می‌شود `GOOGLE_CLIENT_ID` را **نمی‌دید** و ورود با گوگل همیشه «پیکربندی‌نشده»
می‌ماند — با `.env` کاملاً درست، و بی‌هیچ خطایی. علائمش دقیقاً شبیه «کد را وصل نکرده‌اند» است.

**قاعده:** در `vite.config.js` و `server.js` اول از همه `process.loadEnvFile('.env')` را در
`try/catch` صدا بزن (خودِ نود است، وابستگی تازه لازم نیست؛ پوسته بر فایل مقدم است) و یک خط
وضعیت در بالا آمدن چاپ کن.

**بررسی بدون مرورگر:** `import()` کردن `vite.config.js` در یک پروسهٔ نود و بعد نگاه‌کردن به
`process.env`. پروسه طبیعی تمام می‌شود، پس بافر stdout می‌ریزد. برعکسِ کشتن سرور با `kill` که
خروجی بافر‌شده را از بین می‌برد و دروغِ «هیچ لاگی چاپ نشد» را تأیید می‌کند.

### ۱۷) باندل موفق ≠ رندر سالم؛ یک شناسهٔ تعریف‌نشده کل لایه را سفید می‌کند

تلهٔ تازهٔ لایهٔ `#group` و گران‌ترین‌شان، چون **هیچ‌کدام از ابزارهای قبلی نمی‌گیرندش**:

- `esbuild --bundle src/layout/group/GroupPage.jsx` موفق بود (`82.8kb, Done in 17ms`) و
  `node --check` هم سبز بود — چون هر دو فقط *سینتکس* و *حل‌شدن importها* را می‌سنجند.
- ولی در `GroupCreatePanel.jsx` داخل JSX یک `capacity` نوشته شده بود که **هیچ‌جا تعریف
  نشده بود** (نه prop بود، نه متغیر محلی). یعنی `ReferenceError` در زمان رندر.
- و چون `ErrorBoundary` وجود ندارد، کل درختِ آن لایه خالی می‌شود: کاربر صفحهٔ `#group` را
  **کاملاً سفید** می‌بیند، بدون هیچ خطایی در UI. نه کنسول چیزی نشان می‌دهد که به چشم بیاید،
  نه بیلد گیر می‌کند.

**قاعده:** برای هر لایهٔ تازه، «باندل شد» سنجه نیست. باید خودِ لایه **رندر** شود و خروجی‌اش
گرفته شود — همان کاری که `verify-render.mjs` برای هر مسیر می‌کند. اگر لایه‌ای در
`verify-render` سنجهٔ رندر نداشته باشد، سفید شدنش هیچ‌وقت گرفته نمی‌شود.

**قاعدهٔ عملی:** هر مسیر تازه یک سنجهٔ رندر با *نام کامپوننت پوسته* می‌خواهد
(`/class="grp-page"/`)، وگرنه سنجه‌های محتوایی روی رشتهٔ خالی هم می‌توانند «قبول» بدهند.
سنجهٔ رندر خودِ `render()` هم باید اول بیاید تا شکست، صریح گزارش شود:
«رندر صفحهٔ … بدون خطا — capacity is not defined».


---

## ۱۳. نقشهٔ مستندات موجود

این README نقشهٔ کلان است. جزئیات هر زیرلایه در README خودش:

| سند | چه چیزی را کامل توضیح می‌دهد |
|---|---|
| `src/layout/admin/README.md` | CMS: معماری، مدل داده، API، امنیت، عیب‌یابی، وضعیت فازها |
| `src/layout/products/README.md` | صفحهٔ محصولات: ریتم روایت، مدل داده، پیش‌نمایش‌ها، مقصدها، نکات نگهداری |
| `src/layout/pricing/README.md` | تعرفه‌ها: مدل داده، لایه‌های صفحه، تعامل‌ها، واکنش‌گرایی، نکات نگهداری |
| `src/layout/group/README.md` | اشتراک گروهی: کد اشتراک، پله‌های تخفیف، چرخهٔ گروه، محدودیت واقعی کد بدون سرور، قرارداد REST آینده |
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

**مسیر سبز:** `LAYER_IDS.greenPath` تنها مقصد معتبر است؛ کاتالوگ و CTAهای آن
به `#dashboard?l=green-path` می‌روند، و دیگر لینک/اسکرول به لنگر قدیمی `#green-path`
وجود ندارد. UI مسیر سبز فقط از `greenPathService` مصرف می‌کند؛ Repository فعلی Mock
قابل تعویض با API است و موتورهای برنامه‌ریزی در `src/services/greenPath/` مستقل از React هستند.

7. README لایه را بنویس و به جدول بخش ۱۳ اضافه کن.
8. **همین فایل را به‌روز کن:** جدول بخش‌های ۶ (۹ بخش / ۱۲ لایه) + جدول بخش ۷ + نقشهٔ پوشه‌ها (بخش ۳).
9. `node database/adminApi.test.mjs` را اجرا کن تا چیزی نشکسته باشد.
10. اگر بخش تازه رنگ/سطح تازه‌ای می‌سازد: توکنش را در **هر دو بلوک** `:root` و
    `:root[data-theme='light']` تعریف کن، بعد `npm run theme:check` بزن.

### افزودن یک صفحهٔ عمومیِ مستقل (مثل `#products` / `#pricing` / `#group`)

این‌ها صفحهٔ مستقل سایت‌اند، نه لایهٔ داشبورد؛ وگرنه همهٔ سیم‌کشی روی `App.jsx` می‌افتد و
یک مرحله را جا انداختن، بی‌صدا یک باگ می‌سازد (مثلاً «صفحه باز نمی‌شود» یا «صفحه سفید است»).

1. `src/services/<domain>/` — سرویس + **ثابت مسیر** (`export const X_PAGE_HASH = '#x'`) تا
   هیچ رشتهٔ دستیِ `#x` در UI نباشد (تلهٔ ۱۰).
2. `src/layout/<domain>/` — لایه + CSS با پیشوند کلاس اختصاصی + گارد reduced-motion.
   اگر از توکن‌های جهانی استفاده کند، تم روشن پاس جداگانه لازم ندارد.
3. `App.jsx` — همهٔ این‌ها، به همین ترتیب:
   - ایمپورت لایه + ثابت مسیر.
   - `getAppRoute()`: یک شاخهٔ تطبیق (`hash === X || hash.startsWith(X + '?')`).
   - `getRouteUrl()`: اگر مسیر query دارد (مثل `#group?join=CODE`)، حفظش کن.
   - `getRouteState()`: `tapesh<X>: route === 'x'`.
   - `const [xOpen, setXOpen] = useState(() => getAppRoute() === 'x')`.
   - `setXOpen(false)` را به **همهٔ** نقاطی که بقیهٔ لایه‌ها را می‌بندند اضافه کن
     (هر جا `setAboutOpen(false)` هست). جا انداختنش یعنی دو لایه هم‌زمان باز می‌مانند.
   - `syncAuthRoute` → `setXOpen(route === 'x')` + شرط اسکرول به بالا + `hasManagedRoute`.
   - آرایهٔ وابستگی افکت `data-reveal` و فراخوانی `useReturnToAnchor(xOpen)`.
   - یک شاخهٔ رندر (`if (xOpen) { … }`) با `SiteHeader` + صفحه + `SiteFooter`.
4. لنگر داخلی hash دارد؟ اگر بله، در یک مجموعهٔ **صریح** (مثل `PRICING_HASHES`) ثبت کن؛
   حدس پیشوندی نزن. اگر پیمایشش `scrollIntoView` است، نیازی نیست.
5. مقصد CTAها را از همان ثابت بساز — نه رشتهٔ دستی.
6. **`verify-render.mjs` → یک بخش تازه** با سنجهٔ رندر مسیر (`/class="x-page"/`) + سنجه‌های
   محتوایی. بدون سنجهٔ رندر، سفید شدن لایه گرفته نمی‌شود (تلهٔ ۱۷).
7. README لایه را بنویس، به جدول بخش ۱۳ اضافه کن، و **همین فایل را به‌روز کن**:
   جدول مسیرها (بخش ۵) + نقشهٔ پوشه‌ها (بخش ۳) + جدول دامنه‌ها (بخش ۷) +
   کلیدهای `localStorage` (بخش ۷) + ترتیب اولویت `App`.
8. `npm run theme:check` بزن (شامل `verify-render`).

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
| ۱۰ تست یکپارچه | 🟡 ۷۸ سنجهٔ API + `npm run theme:check` (۱۵۴ سنجهٔ رندر + ۴ بررسی تم)؛ تست تعاملی UI دستی |
| ۱۱ مستندات | 🟡 همین سند + READMEهای زیرلایه |
| ۱۲ انتشار در کانال‌ها | ✅ بله · تلگرام · ایتا — هر سه ارسال واقعی |
| ۱۳ تم روشن + فونت فالبک وزیر | ✅ در همهٔ بخش‌ها · ریدر تم مستقل خودش را دارد (پیش‌فرضش از تم سایت می‌آید) |
| ۱۴ ثابت‌کردن هدر داشبورد | ✅ |
| ۱۶ ورود/ثبت‌نام با گوگل | 🟡 کد، تست، گاردها و خواندن `.env` کامل — فقط ساخت OAuth client در Google Cloud و گذاشتن دو مقدار باقی است |

**فاز ۱۶:** جریان گوگل کامل است (start → callback → handoff → onboarding/dashboard)، `.env` هم
واقعاً خوانده می‌شود (تلهٔ ۱۶) و `node database/googleAuth.test.mjs` سی‌وچهار سنجهٔ قطعی‌اش را
نگه می‌دارد. تنها کار باقی‌مانده ساخت OAuth client در Google Cloud Console و گذاشتن
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` در `.env` است — مراحل گام‌به‌گام در بخش ۲.
**ورود واقعی را فقط یک‌بار با حساب گوگل خودت می‌شود ثابت کرد** و تا آن‌جا هیچ تیک سبزی برای
«ورود موفق» ادعا نمی‌شود.

**فاز ۸:** `articlesService.js` طوری گسترش می‌یابد که مقاله‌های منتشرشدهٔ CMS را با مقاله‌های
ایستای فعلی ادغام کند (CMS اولویت دارد) و `ArticlePage` در صورت وجود `contentHtml` همان را
رندر کند. تغییرات فقط افزایشی است و در نبود API، سایت دقیقاً مثل امروز کار می‌کند.

**آماده‌های آینده که مدل و مسیر API‌شان تعریف شده ولی UI نهایی ندارند:** دوئل لیگ،
تولید سؤال با Seed، اتصال گراف دانش به ProgressService، Sync-Queue فلش‌کارت و یادداشت.

**لایهٔ تعرفه‌ها (`#pricing`):** صفحه، مدل داده و مقایسهٔ قابلیت‌ها کامل است و
`npm run theme:check` بیست‌وهشت سنجهٔ آن را پوشش می‌دهد. **مبالغ در
`src/services/pricing/pricingService.js` نمونه‌اند** و پرچم
`PRICING_META.amountsConfirmed` روی `false` است؛ تا وقتی مالک محصول اعداد واقعی را
نگذارد و پرچم را `true` نکند، یادداشت شفاف پای صفحه باقی می‌ماند. تب «اشتراک» در
پنل تنظیمات داشبورد هنوز به این لایه وصل نشده است.
