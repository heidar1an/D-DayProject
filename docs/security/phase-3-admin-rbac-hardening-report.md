# PHASE 3 — گزارش سخت‌سازی امنیت پنل مدیریت (RBAC و مرز اختیارات)

تاریخ: ۲۹ سپتامبر ۲۰۲۶ · دامنه: `database/adminApi.js`، `database/contentStore.js`،
`database/googleAuth.js`، `src/layout/admin/**` · وضعیت نهایی: **PHASE 3 COMPLETE**

اجرا: `npm run admin:test` → ۹۲ + ۶۴ + ۶۰ = **۲۱۶ سنجه، همه موفق**

---

## A. Verified Initial State

وضعیت واقعی که پیش از هر تغییری از سورس استخراج شد (Audit قبلی فرض قطعی گرفته نشد؛
ارجاع‌های خطی آن هم کهنه بود و همه‌چیز دوباره از فایل‌های فعلی خوانده شد).

| مورد | وضعیت | شاهد |
|---|---|---|
| Total Permissions | `IMPLEMENTED` — ۷۸ عضو، **۷۷ یکتا** (یک تکرار `media.read`) | `contentStore.js:78-128` |
| Total Roles | `IMPLEMENTED` — ۳ نقش: `super-admin`, `admin`, `editor` | `contentStore.js:136-207` |
| `super-admin` behavior | `IMPLEMENTED` — `permissions: ['*']` که در `rolePermissions` به کل کاتالوگ باز می‌شود | `contentStore.js:174-183` |
| Each role permissions | `IMPLEMENTED` — `admin` = کاتالوگ منهای `users.delete` و `SENSITIVE_ANALYTICS`؛ `editor` فهرست دستی | `contentStore.js:179-206` |
| Admin creation flow | `PARTIALLY IMPLEMENTED` — نقش اعتبارسنجی می‌شد ولی **هیچ محدودیتی روی سطح نقش نبود** | `contentStore.js:3880-3910` |
| Admin update flow | `PARTIALLY IMPLEMENTED` — همان نقص + محافظت آخرین مدیر کل | `contentStore.js:3912-3957` |
| Admin deletion flow | `PARTIALLY IMPLEMENTED` — گارد حذف خود + آخرین مدیر کل، ولی شمارش «فعال» نبود | `contentStore.js:3983-4002` |
| Session flow | `IMPLEMENTED` — `Map` در حافظهٔ پروسه، توکن ۳۲ بایتی، TTL لغزان | `contentStore.js:759-809` |
| CSRF flow | `IMPLEMENTED` — `x-tapesh-csrf` + `safeEqual`، فقط برای متدهای تغییردهنده | `adminApi.js:2716-2721` |
| Sensitive analytics rules | `PARTIALLY IMPLEMENTED` — بخش‌ها permission جدا دارند، ولی **مسیر Export آن‌ها را چک نمی‌کرد** | `adminApi.js:2405-2413` |
| Publishing credential rules | `IMPLEMENTED` — `publicChannel` توکن را ماسک می‌کند؛ `publishing.send` ≠ `channels.manage` | `publishingStore.js:124-155` |
| Media credential rules | `IMPLEMENTED` — `publicAccount` فقط `hasToken`/`tokenHint` می‌دهد | `mediaStore.js:453-495` |
| Upload permissions | `IMPLEMENTED` — `media.upload` و `intl.upload` جدا؛ سقف حجم و فهرست MIME سمت سرور | `contentStore.js:3793-3812` |
| Audit logging | `PARTIALLY IMPLEMENTED` — بیشتر عملیات ثبت می‌شد، ولی **خروجی دادهٔ حساس ثبت نمی‌شد** | `adminApi.js:1325` |
| Password hashing | `IMPLEMENTED` — `scrypt` + salt تصادفی ۱۶ بایتی + `timingSafeEqual` | `contentStore.js:370-384` |

نکتهٔ مهم: گزارش قبلی (`docs/audit/MASTER-AUDIT-2026-09-29.md`) این ارتقا را
«MEDIUM» درجه‌بندی کرده بود. بازبینی مستقل نشان داد دامنهٔ واقعی آن **بزرگ‌تر** است:
علاوه بر ساخت مدیر کل، **تصاحب حساب مدیر کل با عوض‌کردن رمزش** و **دور زدن
تفکیک تحلیل حساس از مسیر Export** هم ممکن بود.

---

## B. Permission Matrix

`super-admin` هر ۸۰ مجوز را دارد (با `['*']` که در موتور مجوزدهی باز می‌شود).

| Permission | super-admin | admin | editor |
|---|---|---|---|
| `articles.create` | ✓ | ✓ | ✓ |
| `articles.read` | ✓ | ✓ | ✓ |
| `articles.update` | ✓ | ✓ | ✓ |
| `articles.delete` | ✓ | ✓ | — |
| `articles.publish` | ✓ | ✓ | ✓ |
| `categories.create` | ✓ | ✓ | ✓ |
| `categories.read` | ✓ | ✓ | ✓ |
| `categories.update` | ✓ | ✓ | — |
| `categories.delete` | ✓ | ✓ | — |
| `pages.create` | ✓ | ✓ | — |
| `pages.read` | ✓ | ✓ | ✓ |
| `pages.update` | ✓ | ✓ | ✓ |
| `pages.delete` | ✓ | ✓ | — |
| `flashcards.create` | ✓ | ✓ | ✓ |
| `flashcards.read` | ✓ | ✓ | ✓ |
| `flashcards.update` | ✓ | ✓ | ✓ |
| `flashcards.delete` | ✓ | ✓ | — |
| `flashcards.publish` | ✓ | ✓ | ✓ |
| `testbank.create` | ✓ | ✓ | ✓ |
| `testbank.read` | ✓ | ✓ | ✓ |
| `testbank.update` | ✓ | ✓ | ✓ |
| `testbank.delete` | ✓ | ✓ | — |
| `testbank.publish` | ✓ | ✓ | ✓ |
| `micro.create` | ✓ | ✓ | ✓ |
| `micro.read` | ✓ | ✓ | ✓ |
| `micro.update` | ✓ | ✓ | ✓ |
| `micro.delete` | ✓ | ✓ | — |
| `micro.publish` | ✓ | ✓ | ✓ |
| `references.create` | ✓ | ✓ | ✓ |
| `references.read` | ✓ | ✓ | ✓ |
| `references.update` | ✓ | ✓ | ✓ |
| `references.delete` | ✓ | ✓ | — |
| `references.publish` | ✓ | ✓ | ✓ |
| `comprehensive.read` | ✓ | ✓ | ✓ |
| `comprehensive.update` | ✓ | ✓ | ✓ |
| `comprehensive.publish` | ✓ | ✓ | ✓ |
| `intl.read` | ✓ | ✓ | ✓ |
| `intl.create` | ✓ | ✓ | ✓ |
| `intl.update` | ✓ | ✓ | ✓ |
| `intl.delete` | ✓ | ✓ | — |
| `intl.publish` | ✓ | ✓ | ✓ |
| `intl.upload` | ✓ | ✓ | ✓ |
| `media.upload` | ✓ | ✓ | ✓ |
| `media.read` | ✓ | ✓ | ✓ |
| `media.delete` | ✓ | ✓ | ✓ |
| `banners.create` | ✓ | ✓ | — |
| `banners.update` | ✓ | ✓ | — |
| `banners.delete` | ✓ | ✓ | — |
| `users.create` | ✓ | ✓ | — |
| `users.read` | ✓ | ✓ | — |
| `users.update` | ✓ | ✓ | — |
| `users.delete` | ✓ | — | — |
| **`users.superadmin.manage`** | ✓ | — | — |
| `settings.read` | ✓ | ✓ | — |
| `settings.update` | ✓ | ✓ | — |
| **`settings.security.manage`** | ✓ | — | — |
| `logs.read` | ✓ | ✓ | — |
| `feedback.read` | ✓ | ✓ | — |
| `feedback.manage` | ✓ | ✓ | — |
| `notes.create` | ✓ | ✓ | ✓ |
| `notes.read` | ✓ | ✓ | ✓ |
| `notes.update` | ✓ | ✓ | ✓ |
| `notes.delete` | ✓ | ✓ | ✓ |
| `publishing.read` | ✓ | ✓ | ✓ |
| `publishing.send` | ✓ | ✓ | ✓ |
| `publishing.channels.manage` | ✓ | ✓ | — |
| `media.content.manage` | ✓ | ✓ | ✓ |
| `media.content.review` | ✓ | ✓ | — |
| `media.content.publish` | ✓ | ✓ | ✓ |
| `media.platforms.manage` | ✓ | ✓ | — |
| `media.team.manage` | ✓ | ✓ | — |
| `media.ops.manage` | ✓ | ✓ | ✓ |
| `media.audit.read` | ✓ | ✓ | — |
| `analytics.read` | ✓ | ✓ | ✓ |
| `analytics.users.read` | ✓ | — | — |
| `analytics.seo.read` | ✓ | ✓ | — |
| `analytics.revenue.read` | ✓ | — | — |
| `analytics.security.read` | ✓ | — | — |
| `analytics.alerts.manage` | ✓ | — | — |
| `analytics.export` | ✓ | ✓ | — |

جمع: `super-admin` ۸۰ · `admin` ۷۳ · `editor` ۴۵

`SENSITIVE_ANALYTICS` = `analytics.users.read`, `analytics.revenue.read`,
`analytics.security.read`, `analytics.alerts.manage`

`ADMIN_DENIED_PERMISSIONS` = `users.delete`, `users.superadmin.manage`,
`settings.security.manage`

### جدول نقش → قابلیت

| Role | Permissions | Can Create Admin? | Can Modify Roles? | Can Access Secrets? | Can Export Sensitive Data? |
|---|---|---|---|---|---|
| `super-admin` | ۸۰ (همه) | ✓ (از جمله مدیر کل) | ✓ | فقط write-only؛ مقدار ماسک‌شده | ✓ |
| `admin` | ۷۳ | ✓ (فقط `admin`/`editor`) | ✓ (فقط بین `admin`/`editor`) | ✗ (فقط `hasToken`/`tokenHint`) | ✗ |
| `editor` | ۴۵ | ✗ | ✗ | ✗ | ✗ |

---

## C. Security Findings

### F1 — ارتقای سطح دسترسی: ساخت «مدیر کل» با `users.create` 🔴 CRITICAL
- **Location:** `adminApi.js:1237` (Route) + `contentStore.js:3958-3988` (`createAdmin`)
- **Severity:** Critical (privilege escalation → full takeover)
- **Evidence:** `createAdmin` مقدار `input.role` را فقط با `ROLES[input.role]` می‌سنجید و
  هیچ شرطی روی *سطح actor* نداشت. نقش `admin` مجوز `users.create` دارد. پس:
  `POST /api/admin/users {role:"super-admin"}` → ۲۰۰ و یک مدیر کل تازه.
  حتی رابط کاربری هم در کشوی «نقش» گزینهٔ «مدیر کل» را نشان می‌داد (`AdminUsers.jsx:210`).

### F2 — ارتقای سطح دسترسی: خودارتقایی با `users.update` 🔴 CRITICAL
- **Location:** `adminApi.js:1247` + `contentStore.js:3990-4035` (`updateAdmin`)
- **Severity:** Critical
- **Evidence:** `PUT /api/admin/users/<own-id> {role:"super-admin"}` با فقط `users.update`
  → ۲۰۰. هیچ گارد «خود» وجود نداشت.

### F3 — تصاحب حساب «مدیر کل» با عوض‌کردن رمزش 🔴 CRITICAL
- **Location:** `contentStore.js:4015-4021`
- **Severity:** Critical
- **Evidence:** `updateAdmin` فیلد `password` را بدون هیچ بررسی سطحی اعمال می‌کرد.
  `PUT /api/admin/users/<super-admin-id> {password:"x"}` با `users.update` → رمز مدیر کل
  عوض می‌شد و مهاجم می‌توانست با آن رمز وارد شود. این پیدا نشده در Audit قبلی بود.

### F4 — دور زدن تفکیک تحلیل حساس از مسیر Export 🟠 HIGH
- **Location:** `adminApi.js:2405-2413`
- **Severity:** High (sensitive data disclosure)
- **Evidence:** مسیر Export فقط `analytics.export` را می‌سنجید و بعد بخش خواسته‌شده را
  از `ANALYTICS_SECTION_MAP` برمی‌داشت — بدون هیچ بررسی مجوز بخش. نقش `admin`
  (`analytics.users.read` ندارد) می‌توانست
  `GET /api/admin/analytics/export?section=users|revenue|security` بزند و همان دادهٔ
  ممنوع را بگیرد. نقض مستقیم invariant «دیدن ≠ خروجی‌گرفتن».

### F5 — ضعیف‌کردن مکانیزم‌های امنیتی با `settings.update` 🟠 MEDIUM
- **Location:** `adminApi.js:1306-1322` + `contentStore.js:650-654`
- **Severity:** Medium
- **Evidence:** `writeSettings` بدنه را کورکورانه پخش می‌کرد. نقش `admin`
  (`settings.update`) می‌توانست `security.maxLoginAttempts` را ۹۹۹۹،
  `security.lockMinutes` را ۰ و `security.sessionHours` را بی‌نهایت کند — یعنی
  حفاظت brute-force خودش را خاموش کند. همچنین سقف حجم بارگذاری را بالا ببرد.

### F6 — نبود رکورد حسابرسی برای خروجی دادهٔ حساس 🟡 MEDIUM
- **Location:** `adminApi.js:2405` (پیش از اصلاح)
- **Severity:** Medium (auditability)
- **Evidence:** هیچ رویدادی برای Export ثبت نمی‌شد، در حالی که خروجی دادهٔ کاربران/مالی
  حساس‌ترین عملیات خواندن پنل است.

### F7 — نشست‌ها پس از رویداد امنیتی باطل نمی‌شدند 🟡 MEDIUM
- **Location:** `contentStore.js` — `updateAdmin`, `changeOwnPassword`, `deleteAdmin`
- **Severity:** Medium
- **Evidence:** `getSession` رکورد مدیر را تازه می‌خواند (پس نقش/فعال‌بودن فوراً اعمال
  می‌شد) ولی **توکن نشست** باطل نمی‌شد. یعنی پس از عوض‌کردن رمز یا حذف حساب، نشستِ
  دزدیده‌شده تا پایان TTL (پیش‌فرض ۱۲ ساعت) زنده می‌ماند.

### F8 — افشای وجود نام کاربری با زمان‌سنجی 🟡 LOW-MEDIUM
- **Location:** `contentStore.js:770-781`
- **Severity:** Low-Medium
- **Evidence:** برای حساب ناموجود/غیرفعال، `verifyPassword` (و در نتیجه `scryptSync`)
  اجرا نمی‌شد و پاسخ چند ده میلی‌ثانیه سریع‌تر برمی‌گشت. پیام خطا یکسان بود، ولی زمان
  نبود.

### F9 — محافظت «آخرین مدیر کل» فقط مدیران کلِ فعال را نمی‌شمرد 🟡 LOW
- **Location:** `contentStore.js:3992-3998` (پیش از اصلاح)
- **Severity:** Low (invariant edge case)
- **Evidence:** `deleteAdmin` همهٔ مدیران کل باقی‌مانده را می‌شمرد، حتی غیرفعال‌ها. اگر
  تنها مدیر کل باقی‌مانده غیرفعال بود، حذف مدیر کل فعال یعنی سیستم بدون حساب
  مدیریتیِ قابل‌ورود.

### F10 — اعتماد کورکورانه به هدرهای پروکسی در آدرس بازگشت OAuth 🟡 LOW-MEDIUM
- **Location:** `googleAuth.js:106-118` (پیش از اصلاح)
- **Severity:** Low-Medium (open redirect)
- **Evidence:** `x-forwarded-host` بر `host` مقدم بود و `x-forwarded-proto` بدون
  محدودیت در رشتهٔ آدرس می‌نشست. هر درخواستی با هدر جعلی می‌توانست کاربر را پس از
  ورود با گوگل به دامنهٔ مهاجم برگرداند (`https://evil.example.com/?google=…`) یا
  پروتکل را به `javascript:` چرخاند.

### F11 — نبود گارد ساختاری برای مسیرهای بدون مجوز 🟡 LOW
- **Location:** `adminApi.js:2723` (پیش از اصلاح)
- **Severity:** Low (deny-by-default gap)
- **Evidence:** هر Route با `permission = null` بی‌صدا از مجوزدهی رد می‌شد. افزودن یک
  Route حساس تازه با `null` آن را به «فقط ورود کافی است» تبدیل می‌کرد، بدون هیچ
  هشداری.

### F12 — انحراف کاتالوگ مجوزها (cosmetic / latent) ⚪ INFO
- **Location:** `contentStore.js:78-207`
- **Severity:** Info
- **Evidence:** سه ناسازگاری: (۱) `media.read` در `PERMISSIONS` دو بار آمده بود؛
  (۲) `categories.read` در نقش `editor` استفاده می‌شد ولی در کاتالوگ نبود — یعنی
  `super-admin` (که «همه» را از کاتالوگ می‌گیرد) از نویسنده کم‌دسترسی‌تر بود؛
  (۳) `media.read` در فهرست `editor` هم دو بار آمده بود که شمارش مجوزها را در پنل
  یک واحد بیشتر نشان می‌داد.

### موارد بررسی‌شده و سالم (دست‌نخورده ماندند)
`scrypt` + salt تصادفی + `timingSafeEqual` · `safeEqual` CSRF · `HttpOnly` ·
`SameSite=Strict` · سقف حجم بدنه · ماسک‌کردن توکن کانال و اعتبار اکانت ·
`SENSITIVE_ANALYTICS` · ثبت رویدادها · سقف حجم و فهرست MIME بارگذاری ·
پاک‌سازی HTML · نبود `Access-Control-Allow-Origin` · نبود stack trace در پاسخ‌ها.

---

## D. Changes Applied

| File | Old behavior | New behavior | Reason |
|---|---|---|---|
| `contentStore.js` | `PERMISSIONS` ۷۸ عضو با یک تکرار | ۸۰ عضو یکتا؛ `users.superadmin.manage` و `settings.security.manage` اضافه؛ `categories.read` اعلام شد | بستن F1/F2/F3/F5 و رفع انحراف کاتالوگ (F12) |
| `contentStore.js` | `admin` = کاتالوگ منهای `users.delete` + `SENSITIVE_ANALYTICS` | منهای `ADMIN_DENIED_PERMISSIONS` (سه مورد) + `SENSITIVE_ANALYTICS` | مجوز حساس نباید با `users.create`/`settings.update` بیاید |
| `contentStore.js` | `createAdmin` نقش را فقط با `ROLES` می‌سنجید | نقش `super-admin` مجوز `users.superadmin.manage` روی actor می‌خواهد | F1 |
| `contentStore.js` | `updateAdmin` هیچ گارد خود/سطح نداشت | تغییر نقش خود ممنوع؛ دست‌زدن به مدیر کل (شامل رمز) مجوز صریح می‌خواهد؛ شمارش «فعال»؛ باطل‌کردن نشست‌ها | F2/F3/F7/F9 |
| `contentStore.js` | `changeOwnPassword` نشست‌ها را دست نمی‌زد | نشست‌های دیگر همان حساب باطل؛ نشست فعلی حفظ | F7 |
| `contentStore.js` | `deleteAdmin(id, actorId)` | `deleteAdmin(id, actor)`؛ مجوز برای مدیر کل؛ شمارش فقط فعال‌ها؛ باطل‌کردن نشست‌ها | F3/F7/F9 |
| `contentStore.js` | مسیر حساب ناموجود بدون `scrypt` برمی‌گشت | یک `scrypt` روی هش ساختگی هم اجرا می‌شود | F8 |
| `contentStore.js` | — | `destroySessionsForAdmin(adminId, {keepToken})` | زیرساخت F7 |
| `adminApi.js` | `/analytics/export` مجوز بخش را چک نمی‌کرد | مجوز خودِ بخش + ثبت رویداد `analytics.exported` | F4/F6 |
| `adminApi.js` | `PUT /settings` هر کلیدی را می‌نوشت | تغییر واقعیِ `security`/`media` مجوز `settings.security.manage` می‌خواهد | F5 |
| `adminApi.js` | Route با `permission = null` باز بود | `AUTHENTICATED_ONLY_PATHS` صریح؛ بقیه deny-by-default | F11 |
| `adminApi.js` | `DELETE /users/:id` فقط `actor.id` می‌داد | شیء کامل actor می‌دهد | پشتیبانی گاردهای جدید |
| `adminApi.js` | `/auth/password` توکن نشست را نمی‌شناخت | `keepToken` می‌فرستد تا نشست فعلی حفظ شود | F7 |
| `adminApi.js` | `/analytics/sources` کاتالوگ را با `{...PERMISSIONS}` (کلید عددی) می‌فرستاد | آرایهٔ کاتالوگ، مثل `/meta` | شکل درست قرارداد |
| `googleAuth.js` | `x-forwarded-host` مقدم بر `host` | `PUBLIC_SITE_URL` ← `host` عمومی ← `x-forwarded-host` (پروکسی) ← `TAPESH_ALLOWED_HOSTS`؛ پروتکل فقط `http`/`https` | F10 |
| `AdminUsers.jsx` | کشوی نقش همهٔ نقش‌ها را نشان می‌داد | «مدیر کل» فقط با مجوز؛ ویرایش ردیف مدیر کل قفل؛ نقش خود غیرقابل‌تغییر | هم‌راستایی UI با سرور |
| `AdminSettings.jsx` | فیلدهای امنیتی برای همه باز بود | بدون `settings.security.manage` فقط‌خواندنی | هم‌راستایی UI با سرور |
| `package.json` | — | `admin:smoke:test` · `admin:rbac:test` · `admin:security:test` · `admin:test` | اجرای تک‌فرمان تست‌های فاز |
| `src/layout/admin/README.md` | جدول نقش‌ها بدون مرزهای حساس | مرزهای F1–F5 مستند شد | مستندسازی |
| `database/adminRbac.test.mjs` (جدید) | — | ۶۴ سنجه | RBAC/SuperAdmin/Escalation/Session/Revocation/CSRF |
| `database/adminSecrets.test.mjs` (جدید) | — | ۶۰ سنجه | SensitiveData/Secrets/Analytics/Publishing/Upload/Redirect/SSRF/Audit |

---

## E. Privilege Escalation Tests

| Scenario | Result |
|---|---|
| Admin → Super Admin (ساخت با `role:"super-admin"`) | **PASS** (۴۰۳ + حساب ساخته نشد) |
| Self escalation (تغییر نقش خود) | **PASS** (۴۰۳ + نقش دست‌نخورده) |
| Permission injection (`permissions:["*"]`, `isSuperAdmin:true`) | **PASS** (فیلدها نادیده گرفته می‌شوند؛ مجوزها فقط از نقش) |
| Secret access (توکن کانال/اعتبار اکانت) | **PASS** (۴۰۳ برای نوشتن؛ مقدار کامل هرگز در پاسخ) |
| Sensitive export (`?section=users\|revenue\|security`) | **PASS** (۴۰۳) |
| تنزل / غیرفعال‌کردن / حذف مدیر کل توسط مدیر معمولی | **PASS** (۴۰۳) |
| عوض‌کردن رمز مدیر کل توسط مدیر معمولی (تصاحب حساب) | **PASS** (۴۰۳؛ رمز واقعاً عوض نشد) |
| حذف خود / آخرین مدیر کل فعال | **PASS** (۴۰۹) |
| Audit tampering (حذف گزارش‌ها) | **PASS** (مسیر وجود ندارد؛ `editor` حتی نمی‌بیند) |
| Revoked admin (نشست قدیمی پس از تنزل/تغییر رمز/حذف) | **PASS** (۴۰۱) |
| CSRF (۱۱ مسیر تغییردهنده + ۴ مسیر حساس) | **PASS** (۴۰۳) |
| Host header / redirect abuse | **PASS** (Host عمومی مقدم؛ پروتکل جعلی دور ریخته می‌شود) |
| SSRF (آدرس از ورودی مدیر) | **PASS** (پلتفرم فهرست بسته است؛ URL خروجی از env می‌آید) |

---

## F. Session Security

| موضوع | وضعیت |
|---|---|
| **Fixation** | بسته. ورود همیشه توکن تصادفی ۳۲ بایتی تازه می‌سازد؛ توکن انتخابی مهاجم پذیرفته نمی‌شود و دو ورود پیاپی توکن یکسان نمی‌دهند. |
| **Revocation** | تغییر رمز (توسط خود یا دیگری)، تغییر نقش، غیرفعال‌سازی و حذف ⇒ نشست‌های همان حساب باطل می‌شوند. در تغییر رمز توسط خودِ مدیر، نشست فعلی حفظ و بقیه باطل می‌شود. |
| **Privilege reduction** | `getSession` هر درخواست رکورد تازهٔ مدیر را می‌خواند، پس نقش جدید بلافاصله اعمال می‌شود (بدون تأخیر) — و در تغییر نقش، نشست هم باطل می‌شود. |
| **TTL** | پیش‌فرض ۱۲ ساعت، لغزان. مقدار از `settings.security.sessionHours` می‌آید که اکنون فقط با `settings.security.manage` تغییرپذیر است. |
| **Cookies** | `HttpOnly` + `SameSite=Strict` + `Path=/` + `Max-Age`. `Secure` وقتی `NODE_ENV=production` (با راه فرار `TAPESH_INSECURE_COOKIE=1`). تصمیم `Secure` به هدرهای پروکسی وابسته نیست. |
| **Restart behavior** | نشست‌ها در `Map` حافظهٔ پروسه‌اند ⇒ با ری‌استارت/crash همه باطل می‌شوند و قفل تلاش ورود هم پاک می‌شود. **محدودیت مستندشده؛ در این فاز عمداً به دیتابیس منتقل نشد.** |

---

## G. Secrets Security

| مورد | خواندن | نوشتن | در پاسخ API | در لاگ |
|---|---|---|---|---|
| توکن کانال انتشار (`publishing.secrets.json`, ۰۶۰۰) | فقط وضعیت: `hasToken`, `tokenSource`, `tokenHint` (`••••1234`) | فقط `publishing.channels.manage` | مقدار کامل هرگز | فقط `hasToken` |
| اعتبار اکانت رسانه (`media.secrets.json`, ۰۶۰۰) | فقط `hasToken`/`hasAppKeys`/`tokenHint`/`appIdHint` | فقط `media.platforms.manage` | مقدار کامل هرگز | فقط `hasToken`/`hasAppKeys` |
| رمز مدیر (`scrypt$salt$hash`) | هرگز | با `auth.password` (خود) یا `users.update` (دیگری) | هرگز (سرکشی `passwordHash` حذف می‌شود) | هرگز |
| توکن نشست / CSRF | — | — | `csrfToken` فقط به صاحب همان نشست | هرگز |
| متغیرهای محیطی (`*_TOKEN`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_SITE_URL`) | — | — | هرگز | هرگز |

سنجهٔ خودکار: محتوای `activity.json` و `events.json` در برابر **توکن‌های واقعیِ** فایل
`publishing.secrets.json` اسکن می‌شود — هیچ‌کدام ظاهر نشدند.

الگوی حاکم: `stored secret → write-only/update → masked metadata on read`.

---

## H. Auditability

رویدادهای ثبت‌شده در `content/activity.json` (سقف ۵۰۰ رکورد، `actor/action/target/time/result`):

`auth.login` · `auth.logout` · `auth.password-changed` · `admin.created` ·
`admin.updated` (با `passwordChanged` و `revokedSessions`) · `admin.deleted` ·
`settings.updated` · `analytics.exported` (جدید) · `alert.created|updated|deleted` ·
`analytics.reset` · `media.uploaded` · `media.deleted` · `intl-media.uploaded` ·
`media.account.created|updated|deleted|imported|synced` ·
`media.account.credentials-set` · `media.account.credentials-tested` · `media.account.tested` ·
`media.platform.saved|removed` · `channel.token-set|cleared` · `article.*` · `note.*` ·
`banner.*` · `media.demo.seeded`

مقدار هیچ سرّی در رویداد نمی‌نشیند (نه کامل، نه طول، نه بخشی از آن).

**تمامیت گزارش:** هیچ مسیری برای حذف یا دست‌کاری `activity.json` وجود ندارد
(`DELETE /api/admin/logs` و `/api/admin/activity` → ۴۰۴). خواندنش `logs.read` می‌خواهد
که `editor` ندارد. تنها ابزار پاک‌سازی، `POST /api/admin/analytics/reset` است که
`analytics.alerts.manage` می‌خواهد (فقط مدیر کل) و **فقط `events.json`** را پاک می‌کند،
نه گزارش رویدادها.

---

## I. Tests

| Suite | File | Result |
|---|---|---|
| admin-rbac | `adminRbac.test.mjs` §۱ | PASS |
| admin-superadmin | `adminRbac.test.mjs` §۶،§۹،§۱۰ | PASS |
| admin-privilege-escalation | `adminRbac.test.mjs` §۶–§۹ | PASS |
| admin-session | `adminRbac.test.mjs` §۱۲،§۱۳،§۱۴ | PASS |
| admin-revocation | `adminRbac.test.mjs` §۱۱ | PASS |
| admin-csrf | `adminRbac.test.mjs` §۴ + `adminSecrets.test.mjs` §۱۳ | PASS |
| admin-sensitive-data | `adminSecrets.test.mjs` §۱ | PASS |
| admin-analytics | `adminSecrets.test.mjs` §۱–§۴ | PASS |
| admin-secrets | `adminSecrets.test.mjs` §۵–§۷ | PASS |
| admin-publishing | `adminSecrets.test.mjs` §۶ | PASS |
| admin-upload | `adminSecrets.test.mjs` §۸–§۹ | PASS |
| admin-redirect | `adminSecrets.test.mjs` §۱۰ | PASS |
| admin-ssrf | `adminSecrets.test.mjs` §۱۱ | PASS |
| admin-audit | `adminSecrets.test.mjs` §۳،§۱۲ | PASS |

| Regression | Result |
|---|---|
| `npm run admin:smoke:test` (پنل مدیریت) | ۹۲/۹۲ PASS |
| `npm run admin:rbac:test` | ۶۴/۶۴ PASS |
| `npm run admin:security:test` | ۶۰/۶۰ PASS |
| `npm run auth:test` | ۷۸/۷۸ PASS |
| `npm run bank:test` | ۴۰/۴۰ PASS |
| `npm run exam:test` | ۲۷/۲۷ PASS |
| `npm run domain:test` | ۲۲/۲۲ PASS |
| `npm run planning:test` | ۳۴/۳۴ PASS |
| `npm run build` | **FAIL — پیش از این فاز هم شکست می‌خورد** (پایین را ببینید) |
| باندل esbuild (تأیید کامپایل کد) | PASS — ۱۲٫۶ مگابایت، فقط هشدارهای ازپیش‌موجود `import.meta` |

`npm run build` با خطای `Rollup failed to resolve import "three"` شکست می‌خورد.
علت: `node_modules/three` ناقص نصب شده و `package.json` ندارد. این محدودیت محیطیِ
ازپیش‌موجود است و ربطی به این فاز ندارد؛ تأیید کد با باندل esbuild انجام شد
(`--jsx=automatic` و externalهای react/three/assets) که شامل همهٔ ویرایش‌های
`AdminUsers.jsx` و `AdminSettings.jsx` هم می‌شود.

---

## J. Files Changed

```
database/contentStore.js          مدل مجوز، گاردهای نقش، باطل‌کردن نشست، زمان‌سنجی ورود
database/adminApi.js              Export، تنظیمات امنیتی، deny-by-default، حسابرسی
database/googleAuth.js            اعتبارسنجی هدرهای پروکسی در آدرس بازگشت
src/layout/admin/views/AdminUsers.jsx      قفل نقش مدیر کل و نقش خود
src/layout/admin/views/AdminSettings.jsx   قفل فیلدهای امنیتی
src/layout/admin/README.md        مستندسازی مرزهای حساس
package.json                      اسکریپت‌های تست فاز ۳
database/adminRbac.test.mjs       (جدید) ۶۴ سنجه
database/adminSecrets.test.mjs    (جدید) ۶۰ سنجه
docs/security/phase-3-admin-rbac-hardening-report.md   (جدید) همین گزارش
```

---

## K. Files Intentionally Not Changed

| File | دلیل |
|---|---|
| `database/examApi.js` · `examStore.js` | مرز آزمون‌های هماهنگ؛ dependency مستقیم این فاز نبود (طبق بند ۴۴ سند) |
| `database/userSessions.js` · `usersStore.js` · `usersApi.js` · `authPolicy.js` | دامنهٔ کاربران سایت، نه پنل مدیریت؛ فقط برای الگو خوانده شد |
| `database/sanitizeHtml.js` | سالم و بیربط |
| `database/mediaStore.js` · `publishingStore.js` · `publishers/**` | اعتبارسنجی کردم: ماسک‌کردن اسرار و فهرست بستهٔ پلتفرم‌ها درست بود؛ SSRF وجود نداشت. تنها ایراد در *دسترسی به* این مسیرها بود که در `adminApi.js` رفع شد |
| `database/analyticsEngine.js` · `analyticsInsights.js` | داده‌ها درست تفکیک شده بودند؛ نقص در لایهٔ Route بود |
| `database/uploadsFile.js` | ضد path traversal درست بود؛ `X-Content-Type-Options: nosniff` دارد |
| `server.js` | مسیرهای API و فایل سالم؛ CORS صادر نمی‌کند |
| ساختار `adminApi.js` / `contentStore.js` | طبق بند ۴۵: هیچ split، هیچ لایهٔ Persistence، هیچ ORM/فریم‌ورک تازه |

---

## L. Remaining Risks

1. **نشست‌ها در حافظهٔ پروسه‌اند.** ری‌استارت سرور همهٔ نشست‌ها و قفل‌های تلاش ورود را
   پاک می‌کند؛ چند‌نمونه‌ای (multi-instance) کار نمی‌کند. (Deferred — بند M)
2. **قفل تلاش ورود فقط با نام کاربری کلید می‌خورد.** مهاجم می‌تواند با ۸ تلاش ناموفق،
   یک نام کاربری معلوم را برای ۱۰ دقیقه قفل کند (DoS سبک). سطل مبتنی بر IP برای ورود
   پنل وجود ندارد (بند ۱۶ سند: rate limiting توزیع‌شده در این فاز خواسته نشده).
3. **`x-forwarded-for` کورکورانه باور می‌شود** (`adminApi.js:428-432`) و در لاگ‌ها و
   سطل‌های عمومی (`/analytics/collect`، `/feedback`) می‌نشیند. برای ورود پنل خطر
   دور زدن ندارد (کلید، نام کاربری است) ولی IP لاگ‌شده قابل جعل است. در این فاز تغییر
   ندادم تا رفتار توسعهٔ محلی نشکند.
4. **`GET /api/admin/meta` سند تنظیمات را کامل برمی‌گرداند** (شامل `security`).
   افشای اطلاعاتیِ کم‌خطر برای هر مدیر واردشده؛ پنل به آن نیاز دارد.
5. **بدون CSP.** فایل‌های SVG بارگذاری‌شده با `Content-Type: image/svg+xml` از
   `/uploads/` سرو می‌شوند؛ باز کردن مستقیم یک SVG مخرب توسط مدیر می‌تواند اسکریپت
   اجرا کند. فقط مدیران می‌توانند بارگذاری کنند، پس خطر پایین است.
6. **مسیرهای ثبت/ورود کاربران سایت بدون rate-limit مبتنی بر IP قابل جعل‌اند** —
   بیرون از دامنهٔ این فاز.
7. **`TAPESH_INSECURE_COOKIE=1`** راه فرار برای خاموش‌کردن `Secure` است. عمداً نگه
   داشته شد (برای استقرار پشت پروکسی بدون TLS)، ولی در پروداکشن باید ست نشود.
8. **مجوز wildcard `['*']`:** مدیر کل هر مجوز **آیندهٔ** تازه را هم خودکار می‌گیرد.
   این intentional است و با `rolePermissions` فقط در موتور مجوزدهی معنا دارد (هیچ
   جای دیگری `'*'` تفسیر نمی‌شود و `permissions` از Client هرگز خوانده نمی‌شود).
   ریسک: اگر روزی مجوز بسیار حساسی اضافه شود و فراموش شود از `admin` حذف شود، مدیر کل
   آن را خودکار می‌گیرد — که مطلوب است — ولی `admin` هم می‌گیرد اگر در
   `ADMIN_DENIED_PERMISSIONS` نیاید. سنجهٔ خودکار این invariant را نگه می‌دارد.

---

## M. Deferred Work

| مورد | فاز پیشنهادی |
|---|---|
| انتقال نشست‌ها به ذخیره‌گاه پایدار (جدول/فایل با TTL) | Persistence |
| rate limit توزیع‌شده برای ورود پنل (IP + شناسه، در چند نمونه) | Scalability |
| تقسیم `adminApi.js` (۲۷۶۰ خط) به ماژول‌های دامنه‌ای | Refactor |
| سیاست رمز قوی‌تر (حداقل ۴ کاراکتر فعلی) و اجباری‌کردن `mustChangePassword` | Auth hardening |
| اعتبارسنجی IP معتبر برای `x-forwarded-for` با فهرست پروکسی‌های مورد اعتماد | Deployment |
| هدرهای CSP / Permissions-Policy | Deployment |
| تعمیر `node_modules/three` تا `npm run build` کار کند | Environment |

---

## تکمیل: `PHASE 3 COMPLETE`

همهٔ موارد Definition of Done تأیید شد:

**RBAC** — همهٔ Routeهای پنل احراز هویت دارند (۱۱ مسیر نمونه‌آزمایی شد) · مسیرهای حساس
مجوز صریح دارند · ماتریس نقش/مجوز واقعاً اجرا می‌شود (نه فقط تعریف) · مسیر بدون مجوز
deny-by-default است · تغییر نقش server-side اعمال می‌شود.

**Super Admin** — مدیر معمولی نمی‌تواند مدیر کل بسازد · خودش را ارتقا دهد · مجوز تزریق
کند · رمز مدیر کل را عوض کند. حذف/تنزل آخرین مدیر کل فعال بسته است.

**Sessions** — fixation بسته · توکن امن · revocation تأییدشده · کاهش اختیار فوری ·
محدودیت ری‌استارت مستند شد.

**CSRF/Cookies** — همهٔ مسیرهای تغییردهنده CSRF دارند · چرخهٔ عمر توکن به نشست گره
خورده · `HttpOnly`/`SameSite=Strict` فعال · `Secure` در پروداکشن.

**Secrets** — مقدار سرّ به مدیر غیرمجاز داده نمی‌شود · در لاگ نیست ·
`publishing.send ≠ credential read` · `media.content.* ≠ credential read`.

**Analytics** — بخش‌های حساس مجوزمحور · خروجی مجوزمحور · مدیر دادهٔ خارج از scope
نمی‌بیند.

**Security** — SSRF بررسی شد (پاک) · Open Redirect بسته شد · بارگذاری مجوزمحور و
سقف‌دار · افشای خطا بررسی شد · گزارش‌های حسابرسی قابل سوءاستفاده نیستند.

اصل بنیادین حفظ شد: **امنیت موجود خراب نشد.** هیچ‌کدام از موارد بند ۴۴
(`scrypt`, `safeEqual`, `SameSite=Strict`, `HttpOnly`, مکانیزم CSRF, خط لولهٔ
per-route authorization, `SENSITIVE_ANALYTICS`, لاگ رویدادها) بازنویسی نشد — همه
دست‌نخورده ماندند و ۲۱۶ سنجهٔ فاز + ۲۰۱ سنجهٔ رگرسیون سبز است.
