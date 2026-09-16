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
  analyticsStore.js      لایهٔ دادهٔ تحلیل: رویداد، سنجهٔ درخواست، سیستم، هشدار
  analyticsEngine.js     موتور محاسبهٔ بخش ۱–۱۰ + ریاضیات مشترک
  analyticsInsights.js   موتور محاسبهٔ بخش ۱۱–۱۶
  sanitizeHtml.js        پاک‌ساز HTML (تک‌نسخه، مشترک سرور و کلاینت)
  adminApi.test.mjs      تست دودی بدون فریم‌ورک تست
  content/*.json         دادهٔ CMS (خودکار ساخته و seed می‌شود)

public/uploads/          فایل‌های آپلودی پنل (در Build کپی می‌شوند)

server.js                سرور پروداکشن

src/services/admin/
  adminService.js        تنها نقطهٔ تماس UI با API (شامل گروه `analytics`)
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
    AdminUsers.jsx       کاربران و نقش‌ها
    AdminSettings.jsx    تنظیمات سایت
    AdminLogs.jsx        گزارش رویدادها
    AdminNotes.jsx       یادداشت‌های شخصی (متن و چک‌لیست)
    AdminProfile.jsx     حساب من / تغییر رمز
  analytics/             مرکز تحلیل — ۱۶ بخش (پیشوند an-)
    README.md            مستندات کامل این زیرلایه
    AnalyticsCenter.jsx  پوسته: تب‌ها، بازهٔ زمانی، خروجی، به‌روزرسانی زنده
    analyticsCharts.jsx  کیت نمودار SVG بدون کتابخانه
    analyticsKit.jsx     کارت سنجه، وضعیت، «نیازمند اتصال»، جدول، خروجی
    analytics.css        استایل زیرلایه
    sections/            بخش‌های ۱۶گانه (۵ فایل بر پایهٔ حوزه)
```

> **مرکز تحلیل:** زیرلایهٔ `analytics/` یک سند مستقل دارد — `analytics/README.md`.
> خلاصه: ۱۶ بخش روی دادهٔ واقعی پروژه، بدون هیچ عدد ساختگی؛ هر سنجه‌ای که منبعش
> وصل نیست صریحاً «نیازمند اتصال» اعلام می‌شود.

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
| `settings` | `settings.json` | `siteName, siteDescription, logo, favicon, email, phone, address, social{}, seo{}, integrations{}, media{}, security{}` |

**ارتباط‌ها:** `articles.category → categories.id` · `articles.createdBy → admins.id` ·
`media.id → articles.cover` (به‌صورت URL) · `activity.userId → admins.id` ·
`notes.authorId → admins.id`

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

POST   /api/public/analytics/collect     تلمتری مرورگر (تنها مسیر عمومی غیر-GET)
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
| `editor` | ایجاد/ویرایش/انتشار مقاله، بارگذاری رسانه، ویرایش صفحه، یادداشت‌های خودش، فقط `analytics.read` |

نمونهٔ Permissionها: `articles.create`, `articles.publish`, `media.upload`,
`users.delete`, `settings.update`, `logs.read`, `notes.update`

**دسترسی‌های مرکز تحلیل:** `analytics.read`, `analytics.users.read`,
`analytics.seo.read`, `analytics.security.read`, `analytics.revenue.read`,
`analytics.alerts.manage`, `analytics.export`

جزئیات کامل در `analytics/README.md`.

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

## ۸. تست

```bash
node database/adminApi.test.mjs
```

۳۳ سنجه: ورود درست، رد رمز نادرست، رد بدون نشست، رد بدون CSRF، مجوزدهی نقش‌ها،
پاک‌سازی XSS، صفحه‌بندی سمت سرور، رد MIME غیرمجاز، ثبت گزارش رویداد، اعتبارسنجی و
CRUD یادداشت، تفکیک مالکیت یادداشت‌ها بین مدیران، پذیرش/رد تلمتری عمومی، مجوزدهی
هر بخش تحلیل، حالت «نیازمند اتصال» درآمد، بازرسی واقعی امنیت و سئو، و CRUD هشدارها.

بررسی سلامت رندر ۱۶ بخش تحلیل روی سرور نیز در `analytics/README.md` توضیح داده شده است.

---

## ۹. راهنماهای سریع

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

**چگونه داده را از نو بسازم؟**
`rm -rf database/content` و یک درخواست به پنل. توجه: با این کار **رویدادهای تحلیل هم
پاک می‌شوند** و تلمتری از صفر شروع می‌کند.

**چگونه Deploy کنم؟**
`npm run build` سپس `npm run start`. مسیر `database/` باید قابل نوشتن باشد و
`TAPESH_ADMIN_USERNAME` / `TAPESH_ADMIN_PASSWORD` در محیط سرور تنظیم شوند.
اگر روی http سرو می‌شود، `TAPESH_INSECURE_COOKIE=1` را هم بگذارید.

**چرا در نسخهٔ Build پنل کار نمی‌کند؟**
چون API نیاز به سرور دارد. از `npm run start` استفاده کنید، نه هاست استاتیک.

---

## ۱۰. عیب‌یابی

| نشانه | علت و راه‌حل |
|---|---|
| «ارتباط با سرور برقرار نشد» | سرور بالا نیست (`npm run dev` یا `npm run start`) |
| ورود انجام می‌شود ولی بلافاصله بیرون می‌اندازد | کوکی `Secure` روی http؛ `TAPESH_INSECURE_COOKIE=1` را تنظیم کنید |
| «درخواست از منبع نامعتبر رد شد» | توکن CSRF از دست رفته؛ صفحه را رفرش کنید |
| فایل آپلود نمی‌شود | نوع MIME در allow-list نیست یا از سقف حجم گذشته است (تنظیمات → رسانه) |
| تصویر آپلودی در Build دیده نمی‌شود | `public/uploads/` باید هنگام `npm run build` موجود باشد |
| نمودارهای مرکز تحلیل خالی‌اند | رویدادی ثبت نشده؛ سایت را در مرورگر باز کنید تا ردیاب شروع کند |
| بخشی از تحلیل «نیازمند اتصال» است | رفتار عمدی — منبع دادهٔ آن سرویس وصل نیست. جزئیات در `analytics/README.md` |
| **کل پنل هر چند ثانیه یک‌بار رفرش می‌شود** | سرور در هر درخواست `database/content/*.json` را بازنویسی می‌کند و ویت هر نوشتن در ریشه را `full-reload` می‌کند. `server.watch.ignored` در `vite.config.js` این مسیرها را کنار گذاشته است؛ اگر پوشهٔ دادهٔ تازه‌ای اضافه شد، همان‌جا اضافه‌اش کنید |

---

## ۱۱. وضعیت فازها

| فاز | وضعیت |
|---|---|
| ۱ ممیزی پروژه | ✅ |
| ۲ معماری | ✅ |
| ۳ برنامهٔ پیاده‌سازی | ✅ |
| ۴ دیتابیس (مدل، seed، نمایه) | ✅ |
| ۵ Backend (احراز هویت، مجوز، API، اعتبارسنجی، گزارش) | ✅ |
| ۶ رابط کاربری پنل | ✅ |
| ۷ مرکز تحلیل (۱۶ بخش، تلمتری، تحلیلگر، هشدار، خروجی) | ✅ |
| ۸ اتصال Frontend سایت به CMS | ⏳ فاز بعد |
| ۹ بازبینی امنیتی نهایی | ⏳ فاز بعد |
| ۱۰ تست یکپارچه | 🟡 ۳۳ سنجهٔ API + رندر ۱۶ بخش تحلیل؛ تست تعاملی UI دستی |
| ۱۱ مستندات نهایی | 🟡 همین سند + `analytics/README.md` |

**فاز ۸ (کار بعدی):** سرویس `articlesService.js` طوری گسترش می‌یابد که مقاله‌های
منتشرشدهٔ CMS را با مقاله‌های ایستای فعلی ادغام کند (CMS اولویت دارد) و
`ArticlePage` در صورت وجود `contentHtml` همان را رندر کند. تغییرات فقط افزایشی
است و در صورت نبود API، سایت دقیقاً مثل امروز کار می‌کند.
