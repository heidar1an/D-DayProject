# تپش وب — یادداشت‌های بلندمدت پروژه

## خواستهٔ همیشگی کاربر
- تغییرات **درون ساختار مینیمال و کلی موجود** انجام شوند: بدون بازطراحی، بدون فایل/لایهٔ
  اضافه، هم‌زبان و هم‌رنگ با بقیهٔ بخش‌ها. قبل از افزودن چیز جدید، الگوی موجود همان لایه را
  پیدا کن و ادامه بده. خروجی عملی و قابل اجرا؛ توضیح کوتاه و مستقیم.

## معماری
- **جدایی داده از UI:** هر بخش سرویس خودش را در `src/services/<domain>/` دارد و کامپوننت‌های
  لایه در `src/layout/dashboard/<domain>/`. امضاها طوری‌اند که با اتصال Backend فقط بدنهٔ
  توابع به `fetch` تبدیل شود.
- **ناوبری داشبورد روی hash است**؛ `src/layout/dashboard/dashboardRoute.jsx` تنها منبع حقیقت
  «کدام بخش/لایه/نما» است: `#dashboard?s=<section>&l=<layer>&v=<JSON view>` یا
  `#dashboard?s=…&o=settings&t=<tab>`. `DashboardLayout` هیچ state بولی لایه ندارد؛ همه از
  `route` مشتق می‌شود. نتیجه: Back/Forward بین لایه‌ها کار می‌کند و رفرش همان‌جا می‌ماند.
- **`useLayerRoute(layerId, initialView, { slot, volatile, screenOf })`** جای state داخلی نمای
  هر لایه را گرفته (بانک تست، ویکی، هوش مصنوعی، دانش‌نما، آنالیتیکس، آزمون‌ها، درس‌ها، آناتومی).
  - `initialView` باید **ثابت و خارج از کامپوننت** باشد.
  - `screenOf` → تغییر صفحه = `push`، تغییر درون همان صفحه (فیلتر/تب/جست‌وجو) = `replace`.
  - `volatile` → نماهای زمان‌اجرا (`live`، `lab`، `result`، `review`) هرگز در آدرس نمی‌نشینند.
  - `slot` → لایه‌های تودرتو زیر یک کلید در همان view (مثلاً `view.anatomy`).
  - نوشتن باید از `context.routeRef.current` بخواند (نه state همان رندر) وگرنه چند نوشتن
    پشت‌سرهم در یک تیک گم می‌شود.
- **`App.jsx`** هم `#dashboard?…` را مسیر داشبورد می‌شناسد و در `getRouteUrl('dashboard')` اگر
  hash فعلی `#dashboard?` باشد همان را برمی‌گرداند.
- **لایه‌های بزرگ README معماری دارند** (مثلاً `tests/bank/README.md`)؛ بعد از تغییر معماری
  همان README را به‌روز کن.
- **اعلان‌ها یک سطح واحد دارند:** لایهٔ `NotificationsSection` (زنگولهٔ هدر اصلی). کادر پروفایل
  داشبورد و سربرگ لایهٔ لیگ اعلان جدا ندارند. منبع: `src/services/league/leagueService.js`.

## دفترچه مرور (`src/layout/dashboard/review/`)
- سرتیتر هم‌سبک هیرو «درسنامهٔ جامع» (خط کوچک + خط بزرگ گرادیانی `#5b8cc7 → #937fcd`).
- خلاصه‌های بالای صفحه **چیپ گرد** هستند (هم‌سبک `PathChip`)، نه کارت.
- تقویم **شبکهٔ مربعی ماه شمسی** است (`monthStart` + `aspect-ratio:1`)؛ ماه شمسی بدون کتابخانه
  با `Intl` (`fa-IR-u-ca-persian-nu-latn`). توضیح مراحل G پشت آیکون علامت سؤال.

## دیزاین سیستم (تیره)
- کارت `#242426`، متن اصلی سفید، کم‌رنگ `#8a8a8a`/`#9a9a9a`؛ سبز `#61D192`، بنفش `#937fcd`،
  قرمز `#e26d6d`/`#ef9196`، طلایی `#e0b45c`.
- فونت‌ها: `Pinar` متن، `Doran` تیتر؛ اعداد فارسی با `toFa`/`faNum`.
- `--content-width: 80%`؛ `border-radius` بزرگ (۲ تا ۲.۵rem).
- هر لایه CSS با پیشوند کلاس خودش (`tb-`, `an-`, `intl-`, `ad-`, …) و گارد
  `prefers-reduced-motion`. انیمیشن ورود: `dashboard-layer-reveal` / `dash-stagger`.
- در `@media (min-width: 701px)` داشبورد `height:100dvh; overflow:hidden` می‌گیرد؛ چیدمان‌های
  عمودی را با `flex: n 1 0` نسبت بده، نه ارتفاع ثابت.

## پنل مدیریت محتوا (CMS)
- مسیر `/#admin` — ورود **مستقل** از حساب سایت؛ پیش‌فرض `0135`
  (`TAPESH_ADMIN_USERNAME`/`TAPESH_ADMIN_PASSWORD`).
- سرور: `database/contentStore.js` (داده + RBAC + نشست + audit) و `database/adminApi.js`
  (هندلر مستقل از فریم‌ورک). همان هندلر در middleware ویت (`adminApiPlugin.js`) و در
  `server.js` (پروداکشن) اجرا می‌شود. **هیچ وابستگی جدیدی اضافه نشده.**
- داده در `database/content/*.json`، آپلودها در `public/uploads/`. پاک‌کردن `database/content`
  = بازنشانی و seed مجدد. قرارداد پاسخ: `{success:true,data}` یا `{success:false,error:{code,message}}`.
- امنیت: کوکی HttpOnly + SameSite=Strict + هدر `x-tapesh-csrf`، رمز scrypt+salt، پاک‌سازی HTML
  با `database/sanitizeHtml.js` (تک‌نسخه، سرور و کلاینت).
- UI: `src/layout/admin/**` با پیشوند `ad-`؛ روتر داخلی همان `view={name,payload}` و هم‌گام با
  hash (`#admin/articles/art-xxx`).
- **الگوی افزودن هر بخش تازه:** PERMISSIONS → COLLECTIONS/ensureStore → توابع دامنه → مسیر در
  `adminApi.js` → `adminService.js` → `SECTIONS` و `renderView` در `AdminLayout` → کلاس‌های `ad-`.
- تست: `node database/adminApi.test.mjs` (۳۳ سنجه). مستندات: `src/layout/admin/README.md`.

## مرکز تحلیل (`/#admin/analytics`) — ۱۶ بخش
- **اصل حاکم: هیچ عدد ساختگی.** هر سنجه‌ای که منبعش وصل نیست با `NeedsConnection` + نام دقیق
  متغیر محیطی؛ `null` با `—` نمایش داده می‌شود نه `0`. این قاعده همیشه باید حفظ شود.
- تفکیک لایه: داده `database/analyticsStore.js` (هیچ محاسبه‌ای نمی‌کند) → محاسبه
  `analyticsEngine.js` (۱–۱۰) + `analyticsInsights.js` (۱۱–۱۶) → API در `adminApi.js` → UI در
  `src/layout/admin/analytics/**` با پیشوند `an-`. تنها منبع «بازدید واقعی» ردیاب مرورگر
  `src/services/telemetry/trafficTracker.js` است که در `App.jsx` یک‌بار روشن می‌شود.
- **تحلیلگر آماری است، نه LLM:** روند با رگرسیون خطی + R²، ناهنجاری با امتیاز Z، ریشه‌یابی از
  تفاضل نیمهٔ اول/دوم، پیش‌بینی با فاصلهٔ اطمینان. `LLM_API_KEY` فقط روایت متنی اضافه می‌کند.
- `rootCause` در تحلیلگر **شیء** است (`{trafficChange, sources, page, errors, causes}`) نه رشته.
- **حریم خصوصی:** هویت کاربر شمارهٔ موبایل است؛ ردیاب هرگز آن را نمی‌فرستد و شبه‌نام یک‌طرفهٔ
  FNV-1a می‌فرستد. مسیرهای `#admin` ردیابی نمی‌شوند. با Do-Not-Track ردیاب روشن نمی‌شود.
- **مجوزها:** هر بخش Permission مستقل (`analytics.read|users.read|seo.read|security.read|
  revenue.read|alerts.manage|export`). کلاینت فقط تب‌های مجاز را می‌سازد ولی منبع حقیقت سرور است.
- Poll «لحظه‌ای» هر ۱۰ ثانیه؛ مسیرهای `/api/admin/analytics/*` عمداً در
  `NOT_MEASURED_PREFIXES` هستند تا خودسنجی، سنجه را آلوده نکند.
- `POST /api/admin/analytics/reset` در UI نیست و کل رویدادهای واقعی را پاک می‌کند — با احتیاط.
- مستندات: `src/layout/admin/analytics/README.md`.

## تله‌های تأییدشدهٔ کد (اینها را دوباره نساز)
- **ویت + دادهٔ زمان‌اجرا = حلقهٔ رفرش.** سرور در هر درخواست `database/content/*.json`،
  `database/users.json` و `public/uploads/` را بازنویسی می‌کند. ویت هر نوشتن در ریشه را
  می‌بیند و چون این فایل‌ها در گراف ماژول نیستند، **کل صفحه را `full-reload` می‌کند**
  (`updateModules`: `needFullReload = modules.length === 0`). این یک حلقهٔ خودتقویت‌شونده
  می‌سازد: رفرش → بوت → flush ردیاب → نوشتن → رفرش. **هر مسیر دادهٔ زمان‌اجرا باید در
  `server.watch.ignored` در `vite.config.js` باشد.** (فقط در حالت توسعه؛ در `npm run start`
  ناظری نیست.) تشخیص: شنوندهٔ `ws://localhost:5173/` با پروتکل `vite-hmr` + `fs.watch` روی ریشه.
- **`useAsync(loader, deps)`** — ری‌اکت درایه‌های `deps` را با `Object.is` مقایسه می‌کند،
  نه خود آرایه را؛ پس آرایهٔ تازه در هر رندر (`[activeTab, params, customReady]`) حلقه
  نمی‌سازد **به شرطی که درایه‌ها پایدار باشند**. اگر شیئی/آرایه‌ای تازه در هر رندر داخل
  deps بگذاری، همان حلقهٔ بی‌پایان fetch رخ می‌دهد.
- هر اسکریپت آزمایشی که `clearEvents()` صدا بزند، **رویدادهای واقعی** را هم پاک می‌کند.

## بررسی بدون مرورگر (تکرارشدنی)
- مرورگر خودکار نصب نیست (نصب Chromium صدها مگابایت است). دو روش:
- **رندر سرور (برای خطای زمان اجرا):** فایل موقت در **ریشهٔ پروژه** بساز و با
  `--jsx=automatic --format=esm --platform=node` و
  `--external:react --external:react-dom --external:react-dom/server --external:react/jsx-runtime`
  باندل کن (خروجی باید داخل پروژه باشد تا `react-dom` حل شود؛ `--format=cjs` به‌خاطر
  `import.meta.url` و top-level await شکست می‌خورد). این روش باگ `rootCause` را گرفت.
- **jsdom (برای UI تعاملی):** esbuild bundle با `--format=cjs --define:process.env.NODE_ENV='"development"'`
  (jsdom در `/Users/heidarian2/.workbuddy-ai/binaries/node/workspace` نصب است). globals را از
  jsdom روی `globalThis` بگذار، `globalThis.fetch` را به dev server پروکسی کن و هدر `cookie`
  را **کامل** بفرست (`tapesh_admin_session=<token>`) وگرنه `parseCookies` رد می‌کند.
  برای input کنترل‌شده از `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set`
  + رویداد `input` استفاده کن.

## نکات فنی
- بیلد: `npm run build` **`dist/assets` را پاک می‌کند** و کاربر یک‌بار آن را رد کرده است. برای
  بررسی سریع صحت از `./node_modules/.bin/esbuild <files> --loader:.jsx=jsx --outdir=/tmp/...`
  یا `npm run dev` استفاده کن.
