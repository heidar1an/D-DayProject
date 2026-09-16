# تپش وب — یادداشت بلندمدت پروژه

## خواستهٔ کاربر
تغییر **درون ساختار مینیمال موجود**: بدون بازطراحی، بدون فایل/لایهٔ اضافه، هم‌زبان و هم‌رنگ با بقیه.
الگوی همان لایه را پیدا کن و ادامه بده. توضیح کوتاه و مستقیم.

## معماری
- جدایی داده از UI: سرویس `src/services/<domain>/`، لایه `src/layout/dashboard/<domain>/`.
  امضاها طوری‌اند که اتصال Backend فقط بدنهٔ توابع را به `fetch` تبدیل کند.
- **ناوبری داشبورد روی hash**؛ `dashboardRoute.jsx` تنها منبع حقیقت:
  `#dashboard?s=<section>&l=<layer>&v=<JSON>` یا `&o=settings&t=<tab>`. `DashboardLayout` هیچ
  state بولی لایه ندارد ⇒ Back/Forward و رفرش کار می‌کنند.
- `useLayerRoute(layerId, initialView, {slot, volatile, screenOf})`: `initialView` ثابت و بیرون از
  کامپوننت (نام `<DOMAIN>_VIEW`)؛ تغییر صفحه push، درون صفحه replace؛ `volatile`
  (`live/lab/result/review`) در آدرس نمی‌نشیند؛ `slot` برای لایهٔ تودرتو (مثل `view.anatomy`).
  نوشتن از `context.routeRef.current` بخواند نه state همان رندر.
- اعلان‌ها یک سطح واحد: `NotificationsSection` (منبع `services/league/leagueService.js`).
- لایه‌های بزرگ README معماری دارند — بعد از تغییر معماری به‌روزشان کن.

## درس‌ها و لینک عمیق
- ۵ کارت `CATALOG_COURSES` در `CoursesSection.jsx`؛ نگاشت کارت→لایه در `DashboardLayout.jsx`
  (`COURSE_LAYERS`). «مسیر سبز» فقط اسکرول می‌شود.
- **هر جابه‌جایی صفحه باید هم کلید صفحه و هم `deep` را بنویسد**، وگرنه `view.X ?? deepLink.X`
  همان صفحه را باز می‌کند (`setOpenSubject({subject, deep:null})`).
- یادگیری آناتومی (`courses/learning/`): سه سطح overview→module→unit، مسیر در `view.anatomy`.

## دیزاین سیستم (تیره)
- کارت `#242426`/`#282828`، متن سفید، کم‌رنگ `#8a8a8a`؛ سبز `#61D192`، بنفش `#937fcd`،
  قرمز `#e26d6d`، طلایی `#e0b45c`، برند آبی `#5b8cc7`. فونت `Pinar` متن / `Doran` تیتر؛
  اعداد فارسی `toFa`. `--content-width:80%`؛ radius ۲–۲.۵rem.
- هر لایه CSS با پیشوند خودش (`tb-`,`an-`,`intl-`,`ad-`) + گارد `prefers-reduced-motion`.
- در `min-width:701px` داشبورد `height:100dvh; overflow:hidden` ⇒ چیدمان عمودی با `flex:n 1 0`.

## CMS و مرکز تحلیل
- `/#admin`، ورود مستقل، پیش‌فرض `0135`. `database/contentStore.js` (داده+RBAC+نشست+audit) +
  `adminApi.js` (هندلر مستقل از فریم‌ورک؛ دو میزبان `adminApiPlugin.js` و `server.js`).
  داده در `database/content/*.json` — **نه** پوشهٔ ریشهٔ `content/` (کهنه). آپلود `public/uploads/`.
  پاسخ `{success,data}` / `{success,error}`. **هیچ وابستگی جدید.** کوکی HttpOnly+SameSite=Strict+
  هدر `x-tapesh-csrf`، scrypt، `database/sanitizeHtml.js` مشترک سرور و کلاینت.
- الگوی بخش تازه: PERMISSIONS → COLLECTIONS → توابع دامنه → مسیر `adminApi.js` → `adminService.js`
  → `SECTIONS`/`renderView` در `AdminLayout` → کلاس‌های `ad-`. تست `node database/adminApi.test.mjs`.
- **اصل حاکم تحلیل: هیچ عدد ساختگی.** منبع وصل‌نشده → `NeedsConnection` + نام متغیر محیطی؛
  `null` با `—` نه `0`. `analyticsStore.js` → `analyticsEngine.js`(۱–۱۰) + `analyticsInsights.js`(۱۱–۱۶)
  → API → UI `an-`. تحلیلگر آماری است نه LLM (رگرسیون+R²، Z، بازهٔ اطمینان). `rootCause` **شیء** است.
  هویت = شمارهٔ موبایل؛ ردیاب فقط شبه‌نام یک‌طرفهٔ FNV-1a می‌فرستد. `POST /api/admin/analytics/reset`
  در UI نیست و رویدادهای واقعی را پاک می‌کند.

## انتشار در کانال‌ها (`/#admin/publishing`) — فاز ۱: بله
- `database/publishers/<platform>.js` = آداپتور، تنها نقطهٔ تماس بیرونی. افزودن پلتفرم =
  یک فایل در `publishers/` + یک سطر در `PUBLISH_PLATFORMS`.
- **پیش‌نمایش = ارسال:** هر دو از یک تابع (`planBaleMessages`) می‌آیند، پس پیش‌نمایش سمت سرور
  است نه بازسازی کلاینت. مدیا+متن ≤۱۰۰۰ = یک پیام با کپشن؛ >۱۰۰۰ = مدیا بی‌کپشن + متن کامل.
  عکس `sendPhoto`، بقیه `sendDocument`؛ ۶۰۰ms مکث (سقف بله ۲ پیام/ثانیه به هر گفتگو).
- **توکن‌ها در `database/publishing.secrets.json` با مجوز ۰۶۰۰** — بیرون از `content/`
  (که بکاپ‌پذیر است)، در `.gitignore` و در `server.watch.ignored`. **هرگز در پاسخ API
  برنمی‌گردد**؛ فقط `hasToken` + `tokenSource` (`channel|env|none`) + `tokenHint`.
  ثبت توکن در audit بدون مقدار و بدون طول.
- **بدون توکن هیچ درخواستی به بیرون نمی‌رود** → وضعیت `dry-run` با همان درخواستی که می‌رفت.
  `PUBLISH_DRY_RUN=1` حالت سراسری. خطای یک کانال بقیه را متوقف نمی‌کند.
- مجوزها: `publishing.read` / `publishing.send` / `publishing.channels.manage`.
  `editor` ارسال دارد، مدیریت کانال و توکن ندارد.
- بله: `tapi.bale.ai/bot<token>/<method>` (سازگار با تلگرام)، ربات از `@BotFather` بله،
  `chat_id` کانال، ربات باید ادمین باشد. مستند کامل: `src/layout/admin/README.md` بخش ۸.
- **تست اعتبار پیش از ذخیره:** `POST /publishing/test` با `{platform, token, chatId}` →
  `testCredentials` دو بررسی جدا می‌دهد: توکن با `getMe`، دسترسی با **`getChat`** (اگر
  ربات ادمین نباشد بله «chat not found» می‌دهد). خروجی `{ok, complete, bot, chat, checks[]}`
  و هر check `{id, label, ok: true|false|null, message}`. مجوزش `channels.manage` است نه
  `send`، چون توکن از بدنه می‌آید. **توکن و تست باید داخل خودِ مودال «کانال جدید» باشد،
  نه مرحلهٔ جدا بعد از ساخت کانال** — کاربر همین را خواست.
- تست: `node database/adminApi.test.mjs` (۶۱ سنجه؛ `BALE_BOT_TOKEN` را پاک می‌کند و برای
  تست اعتبار `fetch` جعلی می‌گذارد تا هرگز به شبکه نزند) + هارنس jsdom. تست فقط رکوردهای
  کانال تست را پاک می‌کند، نه کل لاگ.

## تله‌های تأییدشده (دوباره نساز)
- **«هیچ کاری نمی‌کند» = اول هندلر را بخوان.** تابع صدا‌زده‌شدهٔ تعریف‌نشده در `onClick` ⇒
  ReferenceError و توقف بقیهٔ هندلر، بی‌خطای UI. دو بار: `setAnatomyRoute`، `INTL_COURSES_VIEW`.
  **ErrorBoundary وجود ندارد؛ خطای رندر یک لایه کل درخت را خالی می‌کند.**
- **ویت + دادهٔ زمان‌اجرا = حلقهٔ رفرش.** هر مسیر داده‌ای که سرور بازنویسی می‌کند باید در
  `server.watch.ignored` (`vite.config.js`) باشد. تشخیص: شنوندهٔ `ws://localhost:5173/` با `vite-hmr`.
- `useAsync(loader, deps)` با `Object.is` ⇒ شیء/آرایهٔ تازه در هر رندر = حلقهٔ fetch.
- هر اسکریپت آزمایشی که `clearEvents()` بزند، رویدادهای واقعی را هم پاک می‌کند.
- **هارنس jsdom با React باندل‌شده کشته می‌شود** (۱.۲MB ⇒ `SIGTERM`/۱۳۷، بی‌خروجی). React را
  `--external` بده. خروجی را به فایل بریز نه `tail` (بافر پایت با kill از دست می‌رود).
  `onChange` چک‌باکس روی رویداد `click` می‌آید نه `change` ⇒ با `input.click()` تست کن.
  `textContent` را در هر سنجه از نو بخوان و **هیچ ارجاع DOM را بین رندرها نگه ندار** (گره
  کهنه ⇒ سنجهٔ غلط). و در درخت بزرگ، «setter پروتوتایپ + رویداد input» ممکن است
  `onChange` را شلیک نکند ⇒ هندلر را از روی `el['__reactProps$…'].onChange(...)` صدا بزن.
  جزئیات در اسکیل `react-layer-headless-verify`.

## بررسی بدون مرورگر
- **بیلد ممنوع:** `npm run build` پوشهٔ `dist/assets` را پاک می‌کند (کاربر رد کرده).
- دو روش تکرارشدنی (رندر سرور با esbuild / jsdom تعاملی) در اسکیل
  `react-layer-headless-verify` — همان را بخوان.
