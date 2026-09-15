# تپش وب — یادداشت‌های بلندمدت پروژه

## خواستهٔ همیشگی کاربر
- تغییرات باید **درون ساختار مینیمال و کلی موجود پروژه** انجام شوند: بدون بازطراحی،
  بدون فایل/لایهٔ اضافه، هم‌زبان و هم‌رنگ با بقیهٔ بخش‌ها. قبل از افزودن چیز جدید،
  الگوی موجود همان لایه را پیدا کن و ادامه بده.
- خروجی عملی و قابل اجرا؛ توضیح کوتاه و مستقیم.

## معماری
- **جدایی داده از UI:** هر بخش یک سرویس در `src/services/<domain>/` دارد (پیاده‌سازی فعلی
  Mock + localStorage با کلید `tapesh:<domain>:v1:<userId>`) و کامپوننت‌های لایه در
  `src/layout/dashboard/<domain>/`. امضاها طوری نوشته شده‌اند که با اتصال Backend فقط
  بدنهٔ توابع به `fetch` تبدیل شود.
- **ناوبری داشبورد روی hash است** — فایل `src/layout/dashboard/dashboardRoute.jsx`
  تنها منبع حقیقت «کدام بخش، کدام لایه، کدام نما» است:
  `#dashboard?s=<section>&l=<layer>&v=<JSON view>` یا `#dashboard?s=…&o=settings&t=<tab>`
  (لایه و پنل هم‌زمان باز نمی‌شوند). `DashboardLayout` هیچ state بولی لایه ندارد؛ همه از
  `route` مشتق می‌شود (`openLayer`/`closeLayer`/`handleSettingsTabChange`).
  نتیجه: **Back/Forward بین لایه‌ها و نماهای داخلی جابه‌جا می‌شود و رفرش همان‌جا می‌ماند.**
- **هوک `useLayerRoute(layerId, initialView, { slot, volatile, screenOf })`** جای state
  داخلی نمای هر لایه را گرفته (بانک تست، ویکی، هوش مصنوعی، دانش‌نما، آنالیتیکس، آزمون‌های
  بین‌الملل/هماهنگ، درس‌ها، آناتومی). `initialView` باید **ثابت و خارج از کامپوننت** باشد.
  - `screenOf` → تغییر صفحه = `push`، تغییر درون همان صفحه (فیلتر/تب/جست‌وجو) = `replace`.
  - `volatile` → نماهای زمان‌اجرا (`live`، `lab`، `result`، `review`) هرگز در آدرس نمی‌نشینند.
  - `slot` → لایه‌های تودرتو زیر یک کلید در همان view (مثلاً `view.anatomy`).
  - نوشتن باید از `context.routeRef.current` بخواند (نه state همان رندر) وگرنه چند نوشتن
    پشت‌سرهم در یک تیک گم می‌شود.
  - نمای داده‌محور `result` هنگام ورود مستقیم با افکت `restoredRef` از سرویس بازخوانی می‌شود.
- **`App.jsx`** هم `#dashboard?…` را به‌عنوان مسیر داشبورد می‌شناسد و در `getRouteUrl('dashboard')`
  اگر hash فعلی `#dashboard?` باشد همان را برمی‌گرداند.
- **لایه‌های بزرگ README معماری دارند** (مثلاً `tests/bank/README.md`)؛ بعد از تغییر
  معماری، همان README را به‌روز کن.
- روتر داخلی هر لایه یک `view` است (نه react-router) و از این پس با هوک `useLayerRoute`
  با hash هم‌گام می‌شود.
- **اعلان‌ها یک سطح واحد دارند:** لایهٔ `NotificationsSection` (زنگولهٔ هدر اصلی) تنها
  جای اعلان است؛ کادر پروفایل داشبورد و سربرگ لایهٔ لیگ هیچ اعلان جداگانه‌ای ندارند.
  منبع داده `src/services/league/leagueService.js` (`fetchLeagueNotifications` +
  `fetchFriendsLeagueNotifications`) و شمارندهٔ بج در `DashboardLayout` است.

## دفترچه مرور (`src/layout/dashboard/review/`)
- سرتیتر هم‌سبک هیرو «درسنامهٔ جامع» است (خط کوچک + خط بزرگ گرادیانی
  `#5b8cc7 → #937fcd`)؛ الگوی مشترک `dars-hero` / `BankHome` / `review-hero`.
- خلاصه‌های بالای صفحه **چیپ گرد** هستند (هم‌سبک `PathChip` لایهٔ بانک تست)، نه کارت.
- تقویم **شبکهٔ مربعی ماه شمسی** است (`monthStart` + `aspect-ratio:1`)، نه نوار هفتگی.
  ماه شمسی بدون کتابخانه با `Intl` (`fa-IR-u-ca-persian-nu-latn`) حساب می‌شود.
- توضیح مراحل G پشت **آیکون علامت سؤال** است، نه کادر همیشه‌باز.

## دیزاین سیستم (تیره)
- تم تیره: پس‌زمینهٔ کارت `#242426`، متن اصلی سفید، متن کم‌رنگ `#8a8a8a`/`#9a9a9a`.
- سبز برند `#61D192`، بنفش انتخاب `#937fcd`، قرمز خطا `#e26d6d`/`#ef9196`، طلایی `#e0b45c`.
- فونت‌ها: `Pinar` برای متن، `Doran` برای تیترها؛ اعداد فارسی با `toFa`/`faNum`.
- `--content-width: 80%` عرض محتوای داشبورد؛ `border-radius` بزرگ (۲ تا ۲.۵rem) و کارت‌های
  گرد رایج‌اند.
- هر لایه CSS اختصاصی خودش را دارد با پیشوند کلاس (`tb-`, `an-`, `intl-`, …) و گارد
  `prefers-reduced-motion` دارد.
- کلاس `dashboard-layer-reveal` / `dash-stagger` برای انیمیشن ورود استفاده می‌شود.
- در `@media (min-width: 701px)` داشبورد `height: 100dvh; overflow: hidden` می‌گیرد و هر
  بخش دقیقاً فضای زیر هدر را پر می‌کند (اسکرول نمی‌خورد)؛ چیدمان‌های عمودی را با
  `flex: n 1 0` نسبت بده، نه با ارتفاع ثابت.

## پنل مدیریت محتوا (CMS)
- مسیر `/#admin` — ورود **مستقل** از حساب کاربری سایت؛ کاربری/رمز پیش‌فرض `0135`
  (از `TAPESH_ADMIN_USERNAME`/`TAPESH_ADMIN_PASSWORD` قابل تغییر).
- لایهٔ سرور: `database/contentStore.js` (داده + RBAC + نشست + audit) و
  `database/adminApi.js` (هندلر مستقل از فریم‌ورک، جدول مسیرها). همان هندلر در
  middleware ویت (`adminApiPlugin.js`) و در `server.js` (پروداکشن، `npm run start`)
  اجرا می‌شود. هیچ وابستگی جدیدی اضافه نشده.
- داده در `database/content/*.json` و فایل‌های آپلودی در `public/uploads/`.
  پاک‌کردن `database/content` = بازنشانی و seed مجدد.
- قرارداد پاسخ API: `{ success: true, data }` یا `{ success: false, error: { code, message } }`.
- امنیت: کوکی HttpOnly + SameSite=Strict + هدر `x-tapesh-csrf`، رمز با scrypt+salt،
  پاک‌سازی HTML با `database/sanitizeHtml.js` (تک‌نسخه، سرور و کلاینت).
- UI: `src/layout/admin/**` با پیشوند کلاس `ad-`؛ روتر داخلی همان `view = { name, payload }`
  و هم‌گام با hash (`#admin/articles/art-xxx`).
- تست: `node database/adminApi.test.mjs`.
- مستندات کامل: `src/layout/admin/README.md`.

## نکات فنی
- بیلد: `npm run build` **`dist/assets` را پاک می‌کند** و کاربر یک‌بار آن را رد کرده است.
  برای بررسی سریع صحت، از `./node_modules/.bin/esbuild <files> --loader:.jsx=jsx --outdir=/tmp/...`
  استفاده کن یا `npm run dev` را بالا بیاور.
