# پنل مدیریت محتوای تپش (CMS)

پنل مدیریت اختصاصی تپش برای مدیریت محتوای سایت بدون دست‌زدن به کد.
آدرس ورود: `/#admin` — نام کاربری و رمز پیش‌فرض: `0135`

---

## ۱. معماری

```
                    ┌──────────────────────────┐
                    │   Admin Panel  /#admin   │
                    │  src/layout/admin/**     │
                    └────────────┬─────────────┘
                                 │  fetch (کوکی HttpOnly + هدر CSRF)
                                 ▼
                    ┌──────────────────────────┐
                    │   Backend /api/admin/**  │
                    │   database/adminApi.js   │  ← یک هندلر، دو میزبان
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  database/content/*.json │
                    │  database/contentStore.js│
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │   Tapesh Website         │
                    │   src/App.jsx + src/...  │
                    └──────────────────────────┘
```

**چرا JSON و نه یک دیتابیس واقعی؟**
پروژه در حال حاضر هیچ Backend ندارد؛ تنها لایهٔ سروری موجود، middleware توسعهٔ ویت
(`database/apiPlugin.js`) روی فایل `users.json` است. برای هم‌خوانی با همان معماری و
بدون افزودن وابستگی جدید، همین الگو ادامه داده شده. تمام دسترسی داده در
`database/contentStore.js` متمرکز است و امضای توابع دقیقاً معادل کوئری SQL آینده است؛
مهاجرت به PostgreSQL/MySQL فقط بازنویسی بدنهٔ همین توابع است، نه UI و نه API.

**دو میزبان، یک کد:**

| محیط | میزبان API |
|---|---|
| توسعه (`npm run dev`) | `database/adminApiPlugin.js` — middleware ویت |
| پروداکشن (`npm run start`) | `server.js` — سرور `node:http` بدون وابستگی، سرو `dist/` و `/uploads` |

---

## ۲. ساختار فایل‌ها

```
database/
  adminApi.js            هندلر کامل API (مستقل از فریم‌ورک) + جدول مسیرها
  adminApiPlugin.js      پلاگین ویت برای توسعه
  contentStore.js        لایهٔ داده: CRUD، RBAC، نشست، گزارش رویداد
  publishingStore.js     لایهٔ دادهٔ انتشار: کانال‌ها، توکن‌ها، تاریخچهٔ ارسال
  publishers/             registry + آداپتورهای بله/تلگرام/ایتا/اینستاگرام؛ افزودن پلتفرم = یک آداپتور
  mediaStore.js           لایهٔ دادهٔ مرکز رسانه: پلتفرم، اکانت، محتوا، کمپین، تیم، سنجه، UTM
  mediaInsights.js        موتور تجمیع روند، مقایسه، قیف و رتبه‌بندی — بدون عدد ساختگی
  analyticsStore.js       لایهٔ دادهٔ تحلیل: رویداد، سنجهٔ درخواست، سیستم، هشدار
  analyticsEngine.js     موتور محاسبهٔ بخش ۱–۱۰ + ریاضیات مشترک
  analyticsInsights.js   موتور محاسبهٔ بخش ۱۱–۱۶
  sanitizeHtml.js        پاک‌ساز HTML (تک‌نسخه، مشترک سرور و کلاینت)
  adminApi.test.mjs      تست دودی بدون فریم‌ورک تست
  content/*.json         دادهٔ CMS (خودکار ساخته و seed می‌شود)
  publishing.secrets.json  توکن ربات‌ها — مجوز ۰۶۰۰، بیرون از Git (خودکار ساخته می‌شود)
  media.secrets.json        کلید اکانت‌های رسانه — مجوز ۰۶۰۰، بیرون از Git

public/uploads/          فایل‌های آپلودی پنل (در Build کپی می‌شوند)

server.js                سرور پروداکشن

src/services/admin/
  adminService.js        تنها نقطهٔ تماس UI با API (شامل گروه‌های `analytics` و `publishing`)
  sanitizeHtml.js        پل import پاک‌ساز برای کلاینت

src/services/telemetry/
  trafficTracker.js      ردیاب مرورگر — تنها منبع «بازدید واقعی» مرکز تحلیل

src/layout/admin/
  AdminLayout.jsx        دروازهٔ احراز هویت + چیدمان + روتر داخلی
  AdminLogin.jsx         صفحهٔ ورود
  RichTextEditor.jsx     ویرایشگر متن غنی
  MediaPicker.jsx        گالری انتخاب/آپلود تصویر
  adminShared.jsx        اجزای مشترک: دکمه، فرم، جدول، مودال، Toast، هوک‌ها
  adminIcons.jsx         آیکون‌ها
  admin.css              استایل لایه (پیشوند ad-)
  views/                 صفحه‌های پنل
    AdminDashboard.jsx   داشبورد و آمار واقعی
    AdminArticles.jsx    فهرست مقالات
    AdminContentEditor.jsx  ویرایشگر مقاله و صفحه
    AdminCategories.jsx  دسته‌بندی‌ها
    AdminPages.jsx       صفحات
    AdminMedia.jsx       کتابخانهٔ رسانه
    AdminBanners.jsx     بنرها
  AdminPublishing.jsx  انتشار در کانال‌های پیام‌رسان (بله) — در مرکز رسانه هم embed شده
  AdminUsers.jsx       کاربران و نقش‌ها
    AdminSettings.jsx    تنظیمات سایت
    AdminLogs.jsx        گزارش رویدادها
    AdminNotes.jsx       یادداشت‌های شخصی (متن و چک‌لیست)
    AdminProfile.jsx     حساب من / تغییر رمز
  analytics/             مرکز تحلیل — ۱۶ بخش (پیشوند an-)
    README.md            مستندات کامل این زیرلایه
  media/                 مرکز مدیریت رسانه و فضای مجازی (پیشوند mc-)
    MediaCenter.jsx      پوسته، تب‌ها، اقدام‌های سریع و جست‌وجوی مرکزی
    mediaKit.jsx         کارت سنجه، نمودار SVG، وضعیت‌های خالی/خطا، خروجی گزارش
    ContentComposer.jsx  فرم محتوا + پیش‌نمایش سروری همسان با انتشار
    sections/            پلتفرم، اکانت، تقویم، محتوا، کمپین، کتابخانه، تیم، اینباکس، تحلیل و گزارش
    media.css            استایل مستقل مرکز رسانه

    AnalyticsCenter.jsx  پوسته: تب‌ها، بازهٔ زمانی، خروجی، به‌روزرسانی زنده
    analyticsCharts.jsx  کیت نمودار SVG بدون کتابخانه
    analyticsKit.jsx     کارت سنجه، وضعیت، «نیازمند اتصال»، جدول، خروجی
    analytics.css        استایل زیرلایه
    sections/            بخش‌های ۱۶گانه (۵ فایل بر پایهٔ حوزه)
```

> **مرکز تحلیل:** زیرلایهٔ `analytics/` یک سند مستقل دارد — `analytics/README.md`.
> خلاصه: ۱۶ بخش روی دادهٔ واقعی پروژه، بدون هیچ عدد ساختگی؛ هر سنجه‌ای که منبعش
> وصل نیست صریحاً «نیازمند اتصال» اعلام می‌شود.

### چیدمان پوسته — نوار کناری داینامیک

نوار کناری دو حالت دارد و هر دو در `AdminShell` (`AdminLayout.jsx`) مدیریت می‌شوند:

| حالت | کلاس | عرض | برچسب‌ها | چه زمانی |
|---|---|---|---|---|
| باز (پیش‌فرض) | — | `--ad-sidebar-w` = ۲۵۸px | دیده می‌شوند | همیشه، مگر کاربر جمع کند |
| ریل آیکونی | `is-collapsed` | `--ad-sidebar-w-min` = ۷۹px | پنهان | بعد از زدن کلید پایین نوار |
| کشوی موبایل | `is-open` | ۲۵۸px | دیده می‌شوند | زیر ۸۶۱px، با دکمهٔ همبرگری هدر |

- کلید جمع/باز کردن، `.ad-sidebar__collapse` است و **اولین آیتم `.ad-sidebar__foot`**
  (بالای «حساب من») — چون در ریل ۷۹px کنار لوگو جا نمی‌شود. `aria-expanded` و
  `aria-controls="ad-sidebar"` دارد و زیر ۸۶۱px با `display: none` پنهان است.
- در حالت جمع، هر آیتم ناوبری `title` می‌گیرد تا عنوانش به‌صورت راهنمای شناور
  پیدا باشد؛ در حالت باز `title` برداشته می‌شود (وگرنه با برچسبِ کنار آیکون تکراری است).
- نوار در جریان (flow) می‌ماند و اورلی نیست؛ پس `.ad-main` فضای آزادشده را می‌گیرد
  (۲۵۸px ⇒ ۷۹px یعنی ۱۷۹px فضای بیشتر).
- ⚠️ **سه تلهٔ تأییدشدهٔ همین بخش** (جزئیات در بخش ۱۲ ریشهٔ پروژه):
  1. `.ad-nav__item > svg` باید `flex-shrink: 0` باشد، وگرنه آیکون ۱۸px در ریل به
     عرض باقی‌ماندهٔ خط کوبیده می‌شود (۶٫۶px شد).
  2. `gap` حتی با برچسبِ عرض‌صفر جا می‌گیرد ⇒ در حالت جمع `gap: 0` و پدینگ افقی
     لوگو `0` (تا لوگوی ۴۲px جا شود). عرض ریل از همین حساب می‌آید.
  3. برچسب باید `min-width: 0` بگیرد، وگرنه `min-width: auto` فلیکس‌آیتم روی
     «بزرگ‌ترین کلمه» می‌ماند و `max-width: 0` را باطل می‌کند.

---

## ۳. اجرا

```bash
npm install

# توسعه — پنل روی http://localhost:5173/#admin
npm run dev

# تست API پنل (بدون نیاز به سرور در حال اجرا)
node database/adminApi.test.mjs

# پروداکشن
npm run build
npm run start          # پیش‌فرض: http://localhost:4173
```

### متغیرهای محیطی

فایل `.env.example` را به `.env` کپی کنید. هیچ رمزی داخل سورس نیست؛ مقدار اولیهٔ
مدیر کل هنگام ساخت اولین بار از محیط خوانده می‌شود:

```
TAPESH_ADMIN_USERNAME=0135
TAPESH_ADMIN_PASSWORD=0135
TAPESH_ADMIN_NAME=مدیر تپش
TAPESH_ADMIN_EMAIL=
TAPESH_INSECURE_COOKIE=1   # فقط برای اجرای پروداکشن روی http محلی
PORT=4173
```

> اگر `TAPESH_ADMIN_PASSWORD` تنظیم نشود، رمز پیش‌فرض `0135` استفاده می‌شود و پنل
> پرچم «تغییر رمز لازم است» را در صفحهٔ «حساب من» نشان می‌دهد.

**متغیرهای اختیاری مرکز تحلیل** (هیچ‌کدام اجباری نیست؛ هرکدام تنظیم شود بخش وابسته
از حالت «نیازمند اتصال» به حالت فعال می‌رود): `GA_PROPERTY_ID`, `GA_CLIENT_EMAIL`,
`GA_PRIVATE_KEY`, `GSC_SITE_URL`, `PAGESPEED_API_KEY`, `PAYMENT_PROVIDER`,
`PAYMENT_API_KEY`, `LLM_API_KEY`, `LLM_MODEL`, `MONITORING_API_URL`,
`MONITORING_API_KEY`, `ALERT_WEBHOOK_URL`, `ALERT_TELEGRAM_TOKEN`,
`ALERT_TELEGRAM_CHAT` — همه در `.env.example` توضیح داده شده‌اند.

---

## ۴. مدل داده

| مجموعه | فایل | فیلدهای کلیدی |
|---|---|---|
| `admins` | `admins.json` | `id, username, name, email, passwordHash, role, isActive, mustChangePassword, lastLoginAt, createdAt, updatedAt` |
| `articles` | `articles.json` | `id, title, slug, excerpt, contentHtml, cover, coverAlt, category, tags[], authorName, status, featured, recommended, readingTime, views, seo{}, publishedAt, createdAt, updatedAt, createdBy, updatedBy` |
| `categories` | `categories.json` | `id, label, accent` |
| `pages` | `pages.json` | `id, title, slug, contentHtml, cover, status, seo{}, publishedAt, createdAt, updatedAt` |
| `media` | `media.json` | `id, filename, originalName, mimeType, size, url, altText, createdAt, uploadedBy` |
| `banners` | `banners.json` | `id, title, subtitle, image, buttonText, buttonUrl, isActive, sortOrder, startDate, endDate` |
| `activity` | `activity.json` | `id, userId, userName, action, entityType, entityId, entityLabel, metadata, ip, userAgent, createdAt` |
| `notes` | `notes.json` | `id, authorId, authorName, title, kind: 'text'\|'checklist', body, items[{id,text,done}], pinned, createdAt, updatedAt` |
| `publishChannels` | `publishChannels.json` | `id, platform, name, chatId, isActive, disableNotification, note, createdBy, createdByName, lastSentAt, lastStatus, lastError, createdAt, updatedAt` |
| `publishLog` | `publishLog.json` | `id, channelId, channelName, platform, tokenSource, status: 'sent'\|'failed'\|'dry-run', error, errorCode, reason, contentPreview, source, request{}, messages[], adminId, adminName, at` |
| `settings` | `settings.json` | `siteName, siteDescription, logo, favicon, email, phone, address, social{}, seo{}, integrations{}, media{}, security{}` |

> **توکن ربات‌ها در هیچ‌کدام از این مجموعه‌ها نیست.** توکن‌ها در
> `database/publishing.secrets.json` با مجوز `۰۶۰۰` ذخیره می‌شوند — بیرون از `content/`
> و بیرون از Git. دلیلش در بخش ۸ توضیح داده شده.

**ارتباط‌ها:** `articles.category → categories.id` · `articles.createdBy → admins.id` ·
`media.id → articles.cover` (به‌صورت URL) · `activity.userId → admins.id` ·
`notes.authorId → admins.id` · `publishLog.channelId → publishChannels.id` ·
`publishLog.adminId → admins.id`

**وضعیت‌ها:** `draft` (پیش‌نویس) · `published` (منتشرشده) · `archived` (بایگانی)

### Migration و Seed

داده در اولین درخواست به‌صورت خودکار ساخته و seed می‌شود (`ensureStore`).
برای بازنشانی کامل محیط توسعه:

```bash
rm -rf database/content     # دفعهٔ بعد با دادهٔ نمونه از نو ساخته می‌شود
```

افزودن مجموعهٔ تازه: نام آن را به `COLLECTIONS` در `contentStore.js` اضافه کنید و یک
تابع `seedX()` و `listX()` بنویسید — الگوی بقیه دقیقاً همین است.

---

## ۵. API

همهٔ پاسخ‌ها یکی از این دو شکل‌اند:

```json
{ "success": true,  "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

### عمومی (بدون احراز هویت)

```
GET  /api/public/articles        مقالات منتشرشده
GET  /api/public/banners         بنرهای فعال در بازهٔ زمانی امروز
GET  /api/public/settings        تنظیمات قابل نمایش عمومی
GET  /api/public/pages/:slug     صفحهٔ منتشرشده
```

### پنل

```
POST   /api/admin/auth/login          ورود (تنها مسیر بدون نشست)
POST   /api/admin/auth/logout         خروج
GET    /api/admin/auth/me             نشست جاری + توکن CSRF
POST   /api/admin/auth/password       تغییر رمز خود

GET    /api/admin/stats               آمار داشبورد
GET    /api/admin/meta                نقش‌ها، دسترسی‌ها، دسته‌ها، تنظیمات

GET    /api/admin/articles            ?search&status&category&sort&page&perPage
GET    /api/admin/articles/:id
POST   /api/admin/articles
PUT    /api/admin/articles/:id
POST   /api/admin/articles/:id/status   { status }
DELETE /api/admin/articles/:id

GET/POST/PUT/DELETE  /api/admin/categories[/:id]
GET/POST/PUT/DELETE  /api/admin/pages[/:id]
GET/POST/PUT/DELETE  /api/admin/media[/:id]
GET/POST/PUT/DELETE  /api/admin/banners[/:id]
GET/POST/PUT/DELETE  /api/admin/users[/:id]
GET/PUT              /api/admin/settings
GET                  /api/admin/logs    ?search&action&page&perPage

GET    /api/admin/notes                  ?search&kind&sort   → { notes, stats }
GET    /api/admin/notes/:id
POST   /api/admin/notes
PUT    /api/admin/notes/:id
POST   /api/admin/notes/:id/pin          { pinned }
POST   /api/admin/notes/:id/items/:itemId/toggle
DELETE /api/admin/notes/:id

GET    /api/admin/analytics/sources      وضعیت اتصال ۱۲ منبع داده
GET    /api/admin/analytics/ping         پاسخ سبک برای مانیتورینگ بیرونی
GET    /api/admin/analytics/<section>    ?range&from&to  → ۱۶ بخش تحلیل
GET    /api/admin/analytics/export       ?section&range   → دادهٔ تخت برای CSV/Excel
GET    /api/admin/analytics/alerts       ?range
POST   /api/admin/analytics/alerts
PUT    /api/admin/analytics/alerts/:id
DELETE /api/admin/analytics/alerts/:id

GET    /api/admin/publishing/overview    پلتفرم‌ها، وضعیت‌ها و آمار
GET    /api/admin/publishing/channels    کانال‌ها + آمار + تنظیمات پلتفرم‌ها
POST   /api/admin/publishing/channels
PUT    /api/admin/publishing/channels/:id
DELETE /api/admin/publishing/channels/:id
POST   /api/admin/publishing/channels/:id/token   { token }  ← خالی = پاک‌کردن
POST   /api/admin/publishing/channels/:id/test    تست اتصال کانال ذخیره‌شده
POST   /api/admin/publishing/test        تست اعتبار پیش از ذخیره { platform, token, chatId }
POST   /api/admin/publishing/preview     پیش‌نمایش پیام‌ها — بدون شبکه
GET    /api/admin/publishing/targets     مقاله‌های منتشرشده + رسانه‌های تازه
POST   /api/admin/publishing/send        { channelIds, content, dryRun }
GET    /api/admin/publishing/log         ?channelId&status&page&perPage

POST   /api/public/analytics/collect     تلمری مرورگر (تنها مسیر عمومی غیر-GET)
```

**یادداشت‌ها:** هر یادداشت به `authorId` نویسنده‌اش گره خورده و فهرست هر مدیر فقط
یادداشت‌های خودش را برمی‌گرداند؛ `stats` هم در همان پاسخ می‌آید (کل، چک‌لیست‌ها،
گلچین‌شده‌ها، آیتم‌های انجام‌شده) تا نمای پنل به درخواست دوم نیاز نداشته باشد.

**آپلود:** `POST /api/admin/media` با بدنهٔ JSON شامل `originalName`, `mimeType`,
`data` (base64). دلیل انتخاب JSON به‌جای multipart: بدون افزودن هیچ وابستگی‌ای
(مثل multer/busboy) کار می‌کند و اعتبارسنجی کامل سمت سرور انجام می‌شود.

---

## ۶. احراز هویت و مجوزدهی

- **نشست:** توکن تصادفی ۳۲ بایتی در کوکی `tapesh_admin_session` با پرچم‌های
  `HttpOnly`، `SameSite=Strict`، `Path=/` و (در پروداکشن) `Secure`.
  توکن در حافظهٔ پروسهٔ سرور نگه داشته می‌شود و مدت آن لغزان است.
- **CSRF:** هر درخواست تغییردهنده باید هدر `x-tapesh-csrf` هم‌ارز توکن نشست بفرستد.
  توکن در حافظهٔ ماژول کلاینت است، نه `localStorage`.
- **RBAC:** هر Route یک Permission دارد. نقش‌ها:

| نقش | دسترسی |
|---|---|
| `super-admin` | همهٔ دسترسی‌ها |
| `admin` | همه‌چیز جز حذف کاربر و بخش‌های حساس تحلیل (کاربران، سئو، امنیت، درآمد) |
| `editor` | ایجاد/ویرایش/انتشار مقاله، بارگذاری رسانه، ویرایش صفحه، یادداشت‌های خودش، ارسال به کانال‌ها (بدون مدیریت کانال)، فقط `analytics.read` |

نمونهٔ Permissionها: `articles.create`, `articles.publish`, `media.upload`,
`users.delete`, `settings.update`, `logs.read`, `notes.update`

**دسترسی‌های مرکز تحلیل:** `analytics.read`, `analytics.users.read`,
`analytics.seo.read`, `analytics.security.read`, `analytics.revenue.read`,
`analytics.alerts.manage`, `analytics.export`

جزئیات کامل در `analytics/README.md`.

**دسترسی‌های انتشار:** `publishing.read` (دیدن کانال‌ها و تاریخچه)، `publishing.send`
(ارسال واقعی و تست اتصال)، `publishing.channels.manage` (ساخت/ویرایش/حذف کانال و ثبت
توکن). تفکیک عمدی است: نویسنده می‌تواند منتشر کند ولی نمی‌تواند توکن ربات را ببیند یا
عوض کند.

**قواعد محافظتی در سرور:**
- آخرین مدیر کل فعال را نمی‌توان حذف، غیرفعال یا تنزل داد.
- کاربر نمی‌تواند حساب خودش را حذف کند.
- دسته‌بندی‌ای که روی مقاله‌ای استفاده شده حذف نمی‌شود.

---

## ۷. امنیت

| تهدید | اقدام |
|---|---|
| ذخیرهٔ رمز | `scrypt` + salt تصادفی ۱۶ بایتی؛ مقایسه با `timingSafeEqual` |
| User enumeration | پیام خطای یکسان برای «کاربر ناموجود» و «رمز اشتباه» |
| Brute force | شمارش تلاش ناموفق + قفل موقت (قابل تنظیم در تنظیمات) |
| XSS | پاک‌سازی allow-list قبل از ذخیره **و** قبل از رندر؛ چسباندن از کلیپ‌بورد هم پاک‌سازی می‌شود |
| CSRF | کوکی `SameSite=Strict` + هدر توکن اختصاصی |
| IDOR | هر عملیات با `id` ابتدا وجود منبع و سپس مجوز نقش را بررسی می‌کند |
| Mass assignment | هر موجودیت فقط فیلدهای مجاز را از بدنه می‌خواند (`articlePayload`, `pagePayload`, …) |
| Path traversal | نام فایل آپلودی هرگز از ورودی کاربر ساخته نمی‌شود؛ سرو فایل با بررسی `startsWith` روی پوشهٔ مجاز |
| آپلود خطرناک | allow-list نوع MIME + سقف حجم + پسوند از روی MIME (نه از نام فایل) |
| افشای خطا | در پروداکشن فقط پیام عمومی؛ جزئیات در کنسول سرور |
| Secrets | هیچ کلیدی در سورس یا دیتابیس نیست؛ همه از `process.env` |
| Audit | هر عملیات مهم در `activity.json` ثبت می‌شود، بدون دادهٔ حساس |

---

## ۸. مرکز مدیریت رسانه و فضای مجازی

مسیر مرکز: `#admin/media-center/overview`. تب فعال در بخش دوم hash می‌نشیند، بنابراین
لینک مستقیم، refresh و Back/Forward پایدار هستند. پوستهٔ `MediaCenter.jsx` فقط روتر تب‌ها
و اقدام‌های سریع است؛ داده از `services/admin/adminService.js` و API مرکز رسانه می‌آید.

### تب‌ها

`overview`, `platforms`, `accounts`, `calendar`, `content`, `queue`, `campaigns`,
`library`, `team`, `inbox`, `listening`, `analytics`, `tags`, `utm`, `reports`,
`notifications`, `audit`, `publishing`, `settings`

تب `publishing` همان `AdminPublishing.jsx` از قبل طراحی‌شده را embed می‌کند؛ منبع انتشار
و تاریخچهٔ بله بازنویسی نشده است. دکمهٔ «افزودن از کانال‌های انتشار» کانال‌های موجود را
به اکانت رسانه لینک می‌کند و توکن را دوباره نمی‌گیرد.

### لایهٔ پلتفرم

`database/publishers/index.js` رجیستری واحد آداپتورهاست. در این نسخه بله، تلگرام، ایتا
و اینستاگرام آداپتور دارند؛ سایر بسترهای کاتالوگ برای ثبت دستی آماده‌اند. افزودن آداپتور
تازه یک فایل در `publishers/` و یک ورودی رجیستری می‌خواهد، نه تغییر UI یا Store.

- تلگرام و ایتا: API خانوادهٔ Telegram، با `getMe`, `getChat`, ارسال متن/مدیا و سنجه.
- اینستاگرام: Graph API، ساخت container سپس `media_publish`؛ مدیای عمومی HTTPS لازم است.
- بله: مسیر قدیمی حفظ شده و از طریق registry به مرکز رسانه هم می‌رسد.

### قاعدهٔ داده

دادهٔ نمایشی با `seed: true` و نسخهٔ دمو علامت‌گذاری می‌شود. «پاک‌کردن دادهٔ نمونه»
فقط همین رکوردها را حذف می‌کند. سنجهٔ ناموجود `null` است و UI آن را «—» می‌نمایاند؛
هیچ پلتفرم دستی با عدد تخمینی پر نمی‌شود. بدون توکن هیچ تماس شبکه‌ای انجام نمی‌شود و
درخواست در حالت dry-run ثبت می‌شود.

### مسیرهای API مرکز

```text
GET  /api/admin/media/config|summary|overview|analytics|search|report
GET  /api/admin/media/platforms|accounts|contents|calendar|queue|campaigns
POST/PUT/DELETE /api/admin/media/platforms|accounts|contents|campaigns
POST /api/admin/media/accounts/test|import|sync
POST /api/admin/media/contents/preview|queue/run|:id/submit|:id/approve|:id/revision|:id/schedule|:id/publish|:id/retry
GET/POST/PUT/DELETE /api/admin/media/team|tags|inbox|mentions|notifications|utm
GET  /api/admin/media/assets|audit
POST /api/admin/media/notifications/refresh|notifications/read-all|utm/preview|demo/clear|demo/seed
```

مجوزهای جداگانه: `media.read`, `media.content.manage`, `media.content.review`,
`media.content.publish`, `media.platforms.manage`, `media.team.manage`,
`media.ops.manage`, `media.audit.read`.

کلیدهای اکانت در `database/media.secrets.json` با مجوز `۰۶۰۰` ذخیره می‌شوند و در پاسخ
API برنمی‌گردند؛ فقط `hasToken`, `hasAppKeys`, `tokenSource`, `tokenHint` و `appIdHint`
نمایش داده می‌شود. متغیرهای جایگزین در `.env.example` مستند شده‌اند.

---
## ۹. انتشار در کانال‌های پیام‌رسان

بخش `#admin/publishing` محتوای سایت را از پنل به کانال‌های واقعی پیام‌رسان می‌فرستد.
افزودن پلتفرم تازه **یک فایل در `database/publishers/` + یک سطر در `ADAPTERS`** است؛
نه store، نه API و نه UI دست نمی‌خورد (پنل از خودِ آداپتور می‌سازد).

```
پنل (AdminPublishing) ──▶ publishingStore.publish()
                              │
                              ├─ بدون توکن ──▶ وضعیت «dry-run» (هیچ درخواستی به بیرون نمی‌رود)
                              └─ با توکن   ──▶ publishers/index.js (رجیستری)
                                                   ├─ bale.js      ──▶ tapi.bale.ai
                                                   ├─ telegram.js  ──▶ api.telegram.org
                                                   ├─ eitaa.js     ──▶ eitaayar.ir
                                                   └─ instagram.js ──▶ graph.facebook.com
```

### پلتفرم‌های پشتیبانی‌شده

| پلتفرم | فایل | متد ارسال فایل | بررسی مقصد | بررسی اجازهٔ ارسال | سنجهٔ دنبال‌کننده |
|---|---|---|---|---|---|
| بله | `bale.js` | `sendPhoto` / `sendDocument` | ✅ `getChat` | ✅ با همان `getChat` | ✅ |
| تلگرام | `telegram.js` | `sendPhoto` / `sendDocument` | ✅ `getChat` | ✅ `getChatAdministrators` | ✅ |
| ایتا | `eitaa.js` | `sendFile` (پارامتر `file`) | ❌ ندارد | ❌ ندارد | ❌ ندارد |
| اینستاگرام | `instagram.js` | Graph API | ✅ | ✅ | ✅ |

> **چرا «بررسی مقصد» با «بررسی اجازهٔ ارسال» جداست؟** چون کانال **عمومی** را هر رباتی
> با `getChat` می‌بیند، حتی وقتی اصلاً عضو آن نیست. آزمون واقعی: `getChat` روی کانال
> عمومی `@mytapesh` موفق شد ولی ارسال `403 Forbidden: bot is not a member of the
> channel chat` گرفت. پنلی که از آن تیک سبز بسازد، دروغ گفته است. پس تلگرام یک گام
> جلوتر می‌رود: `getChatAdministrators` — اگر ربات ادمین باشد لیست ادمین‌ها را می‌دهد،
> وگرنه «member list is inaccessible». فقط همین دو حالت قطعی خوانده می‌شود و هر خطای
> دیگری «نامعلوم» (`ok: null`) می‌ماند تا قطع‌شدن شبکه «ربات ادمین نیست» ترجمه نشود.
>
> بله این مشکل را ندارد: اگر ربات ادمین نباشد، `getChat` همان‌جا «chat not found»
> می‌دهد، پس `getChat` برایش هم «دسترسی» را ثابت می‌کند.

> **ایتا استثناست.** ایتایار متد `getChat` و `getChatMemberCount` ندارد (آزمون واقعی:
> هر دو «method not found» می‌دهند). پس «تست اتصال» فقط **توکن** را تأیید می‌کند و
> بررسی مقصد با `ok: null` («بررسی‌نشده») برمی‌گردد. پنل این حالت را کهربایی نشان
> می‌دهد، نه سبز — و دکمهٔ ذخیره می‌شود «ذخیره (کانال بررسی‌نشده)». تأیید نهایی
> دسترسی با اولین ارسال واقعی معلوم می‌شود. برای همین ایتا `metrics: []` دارد و
> `metrics()` صادقانه `null` برمی‌گرداند، بدون هیچ درخواست شبکه‌ای.

### قواعد ثابت این بخش

- **بدون توکن، هیچ درخواستی به بیرون نمی‌رود.** به‌جایش وضعیت `dry-run` ثبت می‌شود و
  دقیقاً همان درخواستی که می‌رفت در تاریخچه می‌ماند. پس می‌توان کل مسیر را بدون هیچ
  اعتباری ساخت، دید و تست کرد.
- **توکن هرگز به مرورگر نمی‌رسد.** پاسخ هیچ مسیری فیلد `token` ندارد؛ فقط `hasToken`،
  `tokenSource` (`channel` / `env` / `none`) و `tokenHint` (۴ نویسهٔ آخر). ثبت توکن هم در
  گزارش رویدادها بدون مقدار و بدون طول ثبت می‌شود.
- **پیش‌نمایش = ارسال.** پیش‌نمایش از سرور می‌آید و همان تابع آداپتور آن را می‌سازد که
  ارسال را (`plan`). آنچه در پنل می‌بینی دقیقاً همان چیزی است که فرستاده می‌شود.
  پیام‌بندی هر پلتفرم فرق دارد، پس پیش‌نمایش **پلتفرم کانال انتخاب‌شده** را می‌فرستد.
- **خطای یک کانال، بقیه را متوقف نمی‌کند.** هر کانال مستقل ارسال می‌شود و نتیجهٔ همه در
  خروجی و در تاریخچه می‌ماند.
- **۴۰۳ یعنی «دسترسی ندارد»، نه «توکن باطل».** تلگرام و بله برای «ربات ادمین نیست» هم
  کد ۴۰۳ می‌دهند — همان کدی که برای توکن باطل می‌دهند. ترجمه اول متن سرویس را می‌خواند و
  بعد کد وضعیت؛ وگرنه کاربری که فقط باید ربات را ادمین کانال کند، دنبال توکن تازه می‌رود.
  کد خطا هم `PUBLISH_FORBIDDEN` است (۴۰۱ می‌ماند `PUBLISH_UNAUTHORIZED`).

### چرا توکن در فایل جدا؟

`content/` محتوای سایت است و ممکن است روزی Export یا بکاپ عمومی شود. توکن ربات در بکاپ
محتوا جایی ندارد. پس:

| فایل | محتوا | مجوز |
|---|---|---|
| `database/content/publishChannels.json` | تعریف کانال‌ها (بدون اعتبار) | معمولی |
| `database/content/publishLog.json` | تاریخچهٔ ارسال (بدون اعتبار) | معمولی |
| `database/publishing.secrets.json` | فقط توکن‌ها | `0600` + در `.gitignore` |

### شکستن یک محتوا به چند پیام

| ورودی | بله / تلگرام | ایتا |
|---|---|---|
| مدیا + متن ≤ ۱۰۰۰ نویسه | یک پیام: مدیا با کپشن | یک پیام: `sendFile` با `caption` |
| مدیا + متن > ۱۰۰۰ نویسه | مدیا بی‌کپشن، بعد متن کامل | همان |
| فقط مدیا | یک پیام مدیا | یک پیام `sendFile` |
| فقط متن | یک پیام متنی | یک پیام `sendMessage` |

عکس با `sendPhoto` و بقیهٔ فایل‌ها (مثل PDF) با `sendDocument` می‌روند. ایتا یک متد
واحد دارد: `sendFile` با پارامتر `file` و `caption`. بین دو پیام پشت‌سرهم ۶۰۰ms مکث
است — این پلتفرم‌ها ۲ پیام در ثانیه به هر گفتگو اجازه می‌دهند.

> ایتا یک پارامتر اضافهٔ `title` دارد که فقط در پنل ایتایار برای جست‌وجوی پیام‌ها به
> کار می‌آید. پنل عنوان مقالهٔ منبع را در همین فیلد می‌فرستد.

### راه‌اندازی بله (گام‌به‌گام)

همهٔ این کارها در یک مودال انجام می‌شود: `#admin/publishing` → کارت «کانال‌ها» →
«کانال جدید». لازم نیست اول کانال را بسازی و بعد دنبال توکن بگردی.

1. در بله به `@BotFather` پیام بده → `New Bot` → نام و یوزرنیم → **توکن** را بگیر.
2. کانال بله‌ات را باز کن → مدیریت اعضا → ربات را **ادمین** کن با دسترسی «ارسال پیام».
3. `chat_id` کانال را بردار: اگر کانال یوزرنیم عمومی دارد، همان `@username` کافی است.
4. در مودال «کانال جدید»: پلتفرم «بله»، نام دلخواه، شناسهٔ کانال و توکن را بگذار.
5. **«تست اتصال» را بزن** (قبل از ذخیره). دو چیز بررسی می‌شود و نتیجه‌اش گام‌به‌گام
   نشان داده می‌شود:
   - **توکن ربات** → `getMe`؛ اگر توکن غلط باشد همان‌جا خطا می‌گیری.
   - **دسترسی به کانال** → `getChat`؛ اگر ربات ادمین نباشد، بله خطای «chat not found»
     می‌دهد و پیام فارسی‌اش («ربات در این کانال ادمین نیست…») نمایش داده می‌شود.
6. وقتی پیام «آمادهٔ ارسال است» آمد، «ذخیره» را بزن. کانال و توکن با هم ذخیره می‌شوند.
7. در کارت «ارسال پیام»: کانال را تیک بزن، محتوا را انتخاب یا بنویس، پیش‌نمایش را ببین،
   و «ارسال آزمایشی» را یک‌بار بزن تا مسیر را ببینی — بعد ارسال واقعی.

> **چرا `getChat` و نه فقط `getMe`؟** چون ۹۰٪ خطاهای واقعی ارسال از «ربات ادمین
> نیست» یا «`chat_id` غلط» می‌آید، نه از توکن بد. `getChat` همان لحظه این را می‌گیرد،
> وقتی هنوز هیچ کانالی ذخیره نشده.

> **تست اعتبار کدام مجوز را می‌خواهد؟** `publishing.channels.manage` و نه
> `publishing.send` — چون توکن از بدنهٔ درخواست می‌آید. کسی که اجازهٔ دیدن توکن را
> ندارد، نباید بتواند توکن دلخواه را هم تست کند. این تست در گزارش رویدادها فقط با
> «موفق/ناموفق» ثبت می‌شود، بدون مقدار توکن و بدون طولش.

### راه‌اندازی تلگرام (گام‌به‌گام)

1. در تلگرام به `@BotFather` پیام بده → `/newbot` → نام و یوزرنیم → **توکن** را بگیر.
   لینک مستقیمش در مودال «کانال جدید» هست (از `setupUrl` خودِ پلتفرم می‌آید).
2. کانال را باز کن → `Manage Channel` → `Administrators` → ربات را با اجازهٔ
   **Post Messages** ادمین کن. بدون این کار ارسال با خطای
   «ربات در این کانال عضو یا ادمین نیست» برمی‌گردد (کد ۴۰۳).
3. شناسهٔ کانال: اگر عمومی است همان `@username`؛ اگر خصوصی است شناسهٔ عددی منفی
   (شروع با `-100`).
4. «تست اتصال» → باید **سه تیک سبز** بگیری: توکن با `getMe`، دیدن کانال با `getChat`،
   و **اجازهٔ ارسال** با `getChatAdministrators`. اگر تیک سوم قرمز بود یعنی ربات ادمین
   نیست — و ارسال واقعی هم قطعاً همین‌جا می‌افتاد.
5. ذخیره کن. سنجهٔ «دنبال‌کننده» از `getChatMemberCount` می‌آید و واقعی است؛ بازدید و
   تعامل را Bot API نمی‌دهد و در پنل «نیازمند اتصال» می‌ماند.

> **چرا سه بررسی و نه دو تا؟** چون کانال عمومی را هر رباتی با `getChat` می‌بیند، حتی
> وقتی اصلاً عضو آن نیست. آزمون واقعی: `getChat` روی `@mytapesh` موفق شد ولی ارسال
> `403 Forbidden: bot is not a member of the channel chat` گرفت. پس «کانال دیده
> می‌شود» با «ربات اجازهٔ ارسال دارد» یکی نیست و پنل باید هر دو را جدا بگوید.

> ⚠️ **شناسهٔ عددی بگذار، نه یوزرنیم.** دو کانال با یوزرنیم تقریباً یکسان
> (`@mytapesh` و `@mtapesh`) می‌توانند هم‌زمان وجود داشته باشند؛ اگر ربات را در یکی
> ادمین کنی و پنل به آن یکیِ دیگر اشاره کند، «دیدن کانال» سبز می‌شود ولی ارسال
> می‌افتد. شناسهٔ عددی (مثل `-1004445358153`) با تغییر یوزرنیم باطل نمی‌شود و با
> کانال هم‌نام اشتباه نمی‌شود.
>
> **راه تشخیص قطعی وقتی مطمئن نیستی ربات کجاست:** `getUpdates` روی ربات را بزن؛
> تلگرام رویداد `my_chat_member` را نگه می‌دارد و می‌گوید ربات در کدام چت و با چه
> وضعیتی عضو شده:
> `https://api.telegram.org/bot<token>/getUpdates`

### راه‌اندازی ایتا (گام‌به‌گام)

ایتا API رسمی ندارد و از **ایتایار** (`eitaayar.ir`) عبور می‌کند. قراردادش همان
`POST https://eitaayar.ir/api/{token}/{method}` با بدنهٔ JSON و پاسخ `{ ok, result }`
است (مستند رسمی: `eitaayar.ir/assets/download/API_eitaayar.ir.pdf`).

1. در ایتا عضو سرویس ایتایار شو و با همان شمارهٔ ایتا وارد پنل شو.
2. پنل ایتایار → بخش **API** → توکن را بردار. شکلش `bot123456:0000-1111-…` است.
3. پنل ایتایار → بخش **کانال‌ها** → کانال تپش را اضافه کن و اجازهٔ ارسالش را فعال کن.
   **این گام اجباری است:** تا کانال در پنل ایتایار ثبت نشود، هیچ `chat_id`ی برایش
   پیدا نمی‌شود و ارسال با «شناسهٔ کانال پیدا نشد» برمی‌گردد.
4. **شناسهٔ عددی** همان کانال را از بخش «کانال‌ها» بردار (مثل `11252784`) و بگذار.
5. «تست اتصال»: توکن با `getMe` بررسی می‌شود. بررسی کانال با «—» (بررسی‌نشده) می‌ماند،
   چون ایتایار چنین متدی ندارد. حکم کهربایی است و دکمه می‌شود «ذخیره (کانال بررسی‌نشده)».
6. ذخیره کن، بعد یک **ارسال واقعی** بزن — تنها راه تأیید دسترسی همین است.

> ⚠️ **یوزرنیم کانال کار نمی‌کند.** مستندات ایتایار می‌گوید «به جای شناسه از username
> کانال بدون @ استفاده کنید»، ولی در عمل یوزرنیم را *پیدا* می‌کند و بعد ارسال را رد
> می‌کند: `403 Forbidden: user not access of channel chat`. مجوز ارسال فقط به **شناسهٔ
> عددی** همان کانال در پنل ایتایار گره خورده است. (آزمون واقعی: `chat_id=mytapesh` →
> همین خطا، `chat_id=11252784` → ارسال موفق.) پنل حالا شناسهٔ غیرعددی را همان‌جا و
> پیش از ذخیره رد می‌کند، نه بعد از یک ارسال شکست‌خورده.

> متدهای شناخته‌شدهٔ ایتایار فقط سه‌تایند: `getMe`، `sendMessage`، `sendFile`.
> `getChat`، `getChatMemberCount`، `getUpdates`، `getChannels` و `getChannel` همه
> «method not found» می‌دهند. اگر ایتایار متد تازه‌ای اضافه کرد، فقط `eitaa.js` عوض
> می‌شود و بقیهٔ پنل دست‌نخورده می‌ماند.

### متغیرهای محیطی

| متغیر | کار |
|---|---|
| `BALE_BOT_TOKEN` | توکن پیش‌فرض بله، فقط اگر روی خود کانال توکنی ثبت نشده باشد |
| `BALE_API_BASE` | آدرس پایهٔ API بله (پیش‌فرض `https://tapi.bale.ai/bot`) |
| `TELEGRAM_BOT_TOKEN` | توکن پیش‌فرض تلگرام (اگر روی خود کانال ثبت نشده باشد) |
| `TELEGRAM_API_BASE` | آدرس پایهٔ Bot API (پیش‌فرض `https://api.telegram.org/bot`) |
| `EITAA_BOT_TOKEN` | توکن پیش‌فرض ایتایار (اگر روی خود کانال ثبت نشده باشد) |
| `EITAA_API_BASE` | آدرس پایهٔ ایتایار (پیش‌فرض `https://eitaayar.ir/api`) |
| `PUBLISH_TIMEOUT_MS` | مهلت پاسخ سرویس بیرونی (پیش‌فرض ۱۵۰۰۰) |
| `PUBLISH_DRY_RUN=1` | حالت آزمایشی سراسری: هیچ پیامی واقعاً فرستاده نمی‌شود |
| `PUBLIC_SITE_URL` | برای ساختن لینک مقاله در متن پیام |

> **توکن را در متغیر محیطی نگذار.** توصیه‌شده این است که از داخل پنل ثبتش کنی تا در
> `database/publishing.secrets.json` با مجوز `0600` بماند. متغیر محیطی فقط fallback
> است و برای حالتی است که یک توکن مشترک برای چند کانال می‌خواهی. اگر هم‌زمان هر دو
> باشد، توکن خودِ کانال اولویت دارد.

> این پروژه `.env` را خودکار نمی‌خواند. توکن را از داخل پنل ثبت کن (توصیه‌شده) یا
> متغیر را در شل `export` کن / در systemd یا پنل هاست ست کن.

---

## ۹. تست

```bash
node database/adminApi.test.mjs
```

۶۱ سنجه: ورود درست، رد رمز نادرست، رد بدون نشست، رد بدون CSRF، مجوزدهی نقش‌ها،
پاک‌سازی XSS، صفحه‌بندی سمت سرور، رد MIME غیرمجاز، ثبت گزارش رویداد، اعتبارسنجی و
CRUD یادداشت، تفکیک مالکیت یادداشت‌ها بین مدیران، پذیرش/رد تلمتری عمومی، مجوزدهی
هر بخش تحلیل، حالت «نیازمند اتصال» درآمد، بازرسی واقعی امنیت و سئو، CRUD هشدارها، و
انتشار در کانال‌ها (اعتبارسنجی کانال، پنهان‌ماندن توکن، پیش‌نمایش، ارسال آزمایشی بدون
شبکه، تاریخچه، مجوز مدیریت کانال، منطق شکستن پیام، و تست اعتبار پیش از ذخیره با
`fetch` جعلی: توکن درست/غلط، دسترسی نداشتن ربات، و اینکه بدون توکن هیچ درخواستی نمی‌رود).

> تست انتشار عمداً `BALE_BOT_TOKEN` را پاک می‌کند و برای بخش تست اعتبار، `fetch` را با
> یک نسخهٔ جعلی جایگزین می‌کند؛ پس بدون هیچ اعتباری و بدون هیچ تماس شبکه‌ای اجرا می‌شود.
> تاریخچهٔ واقعی کاربر هم دست‌نخورده می‌ماند — فقط رکوردهای همان کانال تست پاک می‌شوند.

بررسی سلامت رندر ۱۶ بخش تحلیل روی سرور نیز در `analytics/README.md` توضیح داده شده است.

---

## ۱۰. راهنماهای سریع

**چگونه وارد پنل شوم؟**
`http://localhost:5173/#admin` → نام کاربری `0135`، رمز `0135`.

**چگونه مقاله بسازم؟**
مقالات → «مقالهٔ جدید» → عنوان و متن را پر کنید → وضعیت را روی «منتشرشده» بگذارید →
ذخیره. تصویر شاخص را از کتابخانهٔ رسانه انتخاب کنید.

**چگونه رمز را عوض کنم؟**
«حساب من» → تغییر رمز عبور. برای تغییر رمز پیش‌فرض، پیش از اولین اجرا
`TAPESH_ADMIN_PASSWORD` را در محیط تنظیم کنید.

**چگونه یادداشت بنویسم؟**
بخش «یادداشت‌ها» → «یادداشت جدید» → حالت را روی «متنی» یا «چک‌لیست» بگذارید، عنوان و
متن/آیتم‌ها را پر کنید و ذخیره کنید. تیک آیتم‌های چک‌لیست هم روی کارت و هم در مودال
خورده می‌شود؛ «گلچین» یادداشت را بالای فهرست نگه می‌دارد. هر مدیر فقط یادداشت‌های
خودش را می‌بیند.

**مرکز تحلیل کجاست؟**
`/#admin/analytics` — ۱۶ تب. نمای کلی در کمتر از ۳۰ ثانیه وضعیت تپش را نشان می‌دهد:
یک جملهٔ خلاصه، سنجه‌های کلیدی با تغییر نسبت به بازهٔ قبل، روند روزانه، و فهرست
کارهایی که به توجه نیاز دارند. برای دیدن دلیل هر عدد، «جزئیات» روی کارت سنجه را
بزنید تا به بخش تخصصی همان سنجه بروید.

**چرا بعضی بخش‌های تحلیل خالی‌اند؟**
چون منبع داده‌شان وصل نیست و پنل عمداً هیچ عدد ساختگی نشان نمی‌دهد. در همان کادر،
نام متغیرهای محیطی لازم نوشته شده است — بخش «منابع دادهٔ وصل‌نشده» در پایین هر بخش
هم فهرست کامل را می‌دهد.

**چگونه محتوا را در کانال بله منتشر کنم؟**
همه‌چیز در یک مودال است: `#admin/publishing` → کارت «کانال‌ها» → «کانال جدید» → پلتفرم
«بله»، نام، شناسهٔ کانال و توکن را بگذار → «تست اتصال» را بزن (هم توکن و هم دسترسی ربات
بررسی می‌شود) → «ذخیره». بعد در کارت «ارسال پیام»: کانال را تیک بزن → منبع را انتخاب کن
(مقاله، رسانه یا متن آزاد) → متن را ویرایش کن → پیش‌نمایش را ببین → «ارسال». تا وقتی توکن
ثبت نشده، دکمهٔ ارسال واقعی خاموش است و فقط «ارسال آزمایشی» کار می‌کند.

**چرا دکمهٔ «ارسال» خاموش است؟**
یعنی هیچ کانال تیک‌خورده‌ای توکن ندارد. در همان ردیف کانال، وضعیت «توکن ربات» را ببین؛
اگر «ثبت نشده» است، «ثبت توکن» را بزن یا کانال را ویرایش کن و توکن را در همان مودال بگذار.

**چرا ارسال من «آزمایشی» ثبت شد و پیامی نرفت؟**
یعنی کانال توکن ندارد، یا `PUBLISH_DRY_RUN=1` در محیط ست است، یا خودت «ارسال آزمایشی» را
زده‌ای. در تاریخچه، ستون وضعیت دلیل را نشان می‌دهد.

**ارسال ناموفق شد؛ از کجا بفهمم چرا؟**
تاریخچهٔ ارسال → «جزئیات» همان ردیف. خطای بله به فارسی ترجمه می‌شود («ربات در این کانال
ادمین نیست»، «کانال پیدا نشد»، «توکن نامعتبر است»). رایج‌ترین علت: ربات ادمین کانال نشده
یا `chat_id` غلط است.

**چگونه داده را از نو بسازم؟**
`rm -rf database/content` و یک درخواست به پنل. توجه: با این کار **رویدادهای تحلیل و
تاریخچهٔ ارسال هم پاک می‌شوند** و تلمتری از صفر شروع می‌کند. توکن‌ها در
`database/publishing.secrets.json` می‌مانند؛ اگر می‌خواهی آن‌ها هم بروند، آن فایل را
جدا حذف کن.

**چگونه Deploy کنم؟**
`npm run build` سپس `npm run start`. مسیر `database/` باید قابل نوشتن باشد و
`TAPESH_ADMIN_USERNAME` / `TAPESH_ADMIN_PASSWORD` در محیط سرور تنظیم شوند.
اگر روی http سرو می‌شود، `TAPESH_INSECURE_COOKIE=1` را هم بگذارید.

**چرا در نسخهٔ Build پنل کار نمی‌کند؟**
چون API نیاز به سرور دارد. از `npm run start` استفاده کنید، نه هاست استاتیک.

---

## ۱۱. عیب‌یابی

| نشانه | علت و راه‌حل |
|---|---|
| «ارتباط با سرور برقرار نشد» | سرور بالا نیست (`npm run dev` یا `npm run start`) |
| ورود انجام می‌شود ولی بلافاصله بیرون می‌اندازد | کوکی `Secure` روی http؛ `TAPESH_INSECURE_COOKIE=1` را تنظیم کنید |
| «درخواست از منبع نامعتبر رد شد» | توکن CSRF از دست رفته؛ صفحه را رفرش کنید |
| فایل آپلود نمی‌شود | نوع MIME در allow-list نیست یا از سقف حجم گذشته است (تنظیمات → رسانه) |
| تصویر آپلودی در Build دیده نمی‌شود | `public/uploads/` باید هنگام `npm run build` موجود باشد |
| نمودارهای مرکز تحلیل خالی‌اند | رویدادی ثبت نشده؛ سایت را در مرورگر باز کنید تا ردیاب شروع کند |
| بخشی از تحلیل «نیازمند اتصال» است | رفتار عمدی — منبع دادهٔ آن سرویس وصل نیست. جزئیات در `analytics/README.md` |
| ارسال به بله «ناموفق» است | «تست اتصال» را بزن؛ اگر توکن درست است، ربات را در کانال ادمین کن و `chat_id` را بررسی کن. متن دقیق خطا در تاریخچه → «جزئیات» |
| در مودال «کانال جدید» «تست اتصال» غیرفعال است | تا توکن را ننوشته‌ای فعال نمی‌شود — این عمدی است تا درخواست بی‌مورد نرود |
| تست می‌گوید «توکن درست است» ولی «دسترسی به کانال تأیید نشد» | `chat_id` خالی یا غلط است، یا ربات در آن کانال ادمین نیست |
| «ارتباط با سرور بله برقرار نشد» | شبکهٔ سرور به `tapi.bale.ai` دسترسی ندارد (پروکسی/DNS). با `BALE_API_BASE` می‌توان آدرس را عوض کرد |
| «پاسخ بله در ۱۵ ثانیه نرسید» | `PUBLISH_TIMEOUT_MS` را بالا ببرید (فایل‌های بزرگ کند آپلود می‌شوند) |
| توکن ثبت کردم ولی هنوز «بدون توکن» است | توکن روی **همان کانال** ذخیره می‌شود؛ اگر ردیف دیگری را باز کرده‌اید، توکنش جداست. «تست اتصال» وضعیت واقعی را می‌گوید |
| **کل پنل هر چند ثانیه یک‌بار رفرش می‌شود** | سرور در هر درخواست `database/content/*.json` را بازنویسی می‌کند و ویت هر نوشتن در ریشه را `full-reload` می‌کند. `server.watch.ignored` در `vite.config.js` این مسیرها را کنار گذاشته است؛ اگر پوشهٔ دادهٔ تازه‌ای اضافه شد، همان‌جا اضافه‌اش کنید |

---

## ۱۲. وضعیت فازها

| فاز | وضعیت |
|---|---|
| ۱ ممیزی پروژه | ✅ |
| ۲ معماری | ✅ |
| ۳ برنامهٔ پیاده‌سازی | ✅ |
| ۴ دیتابیس (مدل، seed، نمایه) | ✅ |
| ۵ Backend (احراز هویت، مجوز، API، اعتبارسنجی، گزارش) | ✅ |
| ۶ رابط کاربری پنل | ✅ |
| ۷ مرکز تحلیل (۱۶ بخش، تلمتری، تحلیلگر، هشدار، خروجی) | ✅ |
| ۸ انتشار در کانال‌های پیام‌رسان — بله (کانال، توکن، تست پیش از ذخیره، پیش‌نمایش، ارسال، تاریخچه) | ✅ |
| ۹ اتصال Frontend سایت به CMS | ⏳ فاز بعد |
| ۱۰ بازبینی امنیتی نهایی | ⏳ فاز بعد |
| ۱۱ تست یکپارچه | 🟡 ۶۱ سنجهٔ API + ۱۹ سنجهٔ رندر مودال کانال + ۱۸ سنجهٔ رندر بخش انتشار؛ تست تعاملی UI دستی |
| ۱۲ مستندات نهایی | 🟡 همین سند + `analytics/README.md` |

**پلتفرم‌های بعدی انتشار:** آداپتور بله در `database/publishers/bale.js` الگوی بقیه است.
ربات‌های ایرانی (روبیکا، ایتا) و تلگرام تقریباً همان قرارداد را دارند؛ افزودن هرکدام یک
فایل تازه در `publishers/` + یک سطر در `PUBLISH_PLATFORMS` است. واتساپ و اینستاگرام
فرایند تأیید و توکن بلندمدت متا لازم دارند و جداگانه بررسی می‌شوند.

**فاز ۹ (کار بعدی):** سرویس `articlesService.js` طوری گسترش می‌یابد که مقاله‌های
منتشرشدهٔ CMS را با مقاله‌های ایستای فعلی ادغام کند (CMS اولویت دارد) و
`ArticlePage` در صورت وجود `contentHtml` همان را رندر کند. تغییرات فقط افزایشی
است و در صورت نبود API، سایت دقیقاً مثل امروز کار می‌کند.
