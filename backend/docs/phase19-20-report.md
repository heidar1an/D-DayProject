# گزارش فاز ۱۹ و ۲۰ — Queue + Notifications + Search / پنل کامل مدیریت

> تاریخ: ۳ اکتبر ۲۰۲۶ · Laravel 13.x / PHP 8.5.11 · SQLite `:memory:` در تست، PostgreSQL در production.
> **وضعیت: COMPLETE** (بدون مورد BLOCKED).

---

## A. خلاصهٔ اجرایی

| سنجه | مقدار |
| --- | --- |
| تست کل بک‌اند | **۹۰۴ تست / ۸٬۲۹۹ assertion / ۰ شکست / ۲ skip** (skipها از پیش موجود) |
| تست‌های تازهٔ فاز ۱۹/۲۰ | ۹۳ تست (۷۰ فاز ۱۹ + ۲۳ فاز ۲۰) |
| مسیرهای v1 واقعی | ۱۸۲ |
| مسیرهای ثبت‌شده در OpenAPI v1 | **۱۶۱ path / ۱۹۸ عملیات / ۹۱ schema — نسخهٔ ۱.۹.۰** |
| مسیرهای تازهٔ این فاز | ۱۶ path (۱۸ عملیات) |
| `php -l` روی فایل‌های تازه/تغییریافته | بدون خطا |
| Scope Lock | رعایت شد — نه AI Mentor، نه Data Migration، نه موتور جست‌وجوی بیرونی |

هر سه تضمین اصلی فاز برقرار است: **هیچ اثری بی‌Outbox نیست**، **جست‌وجو پروجکشن قابل بازسازی است و DB منبع حقیقت می‌ماند**، و **پنل هیچ جدول دامنه‌ای را بدون Domain Service دست‌کاری نمی‌کند**.

---

## B. فایل‌های ساخته‌شده

**Config (۷):** `outbox.php` · `notifications.php` · `search.php` · `audit.php` · `settings.php` · (ویرایش) `queue.php` (بلوک `tapesh`) · (ویرایش) `admin.php` (pagination).

**Migration (۵):** `…_120100_create_outbox_events_table` · `…_120200_create_notifications_tables` · `…_120300_create_search_documents_table` · `…_120400_create_audit_logs_table` · `…_120500_create_system_settings_table`.

**Model (۶):** `OutboxEvent` · `Notification` · `NotificationDelivery` · `SearchDocument` · `AuditLog` (قفل `updating`/`deleting`) · `SystemSetting`.

**Service (۱۷):** `Outbox/{OutboxService, OutboxPublisher, OutboxHandlerRegistry, Handlers/{OutboxHandler, NotificationOutboxHandler, SearchOutboxHandler}}` · `Notifications/{NotificationService, NotificationTypeRegistry, NotificationPayloadSanitizer, ChannelRegistry, Channels/{NotificationChannelProvider, InAppChannelProvider, NullChannelProvider}}` · `Search/{SearchDocumentBuilder, SearchIndexer, SearchService}` · `Support/Search/SearchNormalizer` · `Audit/AuditLogger` · `Settings/SystemSettingsService` · `Admin/{AdminDashboardService, AdminUserQueryService, AdminOpsQueryService}`.

**Job (۵):** `TapeshJob` (پایه) · `ProcessOutboxEventJob` · `DeliverNotificationJob` · `BroadcastNotificationJob` · `RebuildSearchIndexJob`.

**Listener (۱):** `Listeners/Notifications/QueueExamResultNotification`.

**Controller (۸):** `NotificationController` · `SearchController` · `Admin/{AdminDashboardController, AdminUserController, AdminAuditLogController, AdminSettingController, AdminOpsController, AdminNotificationController}` + `Admin/Concerns/ResolvesAdmin`.

**Request (۱۰):** `Notifications/ListNotificationsRequest` · `Search/SearchRequest` · `Admin/{ListUsersRequest, ListAuditLogsRequest, UpdateSettingRequest, ListFailedJobsRequest, ListDeliveriesRequest, RebuildSearchRequest, SendNotificationRequest, BroadcastNotificationRequest}`.

**Resource (۴):** `NotificationResource` · `SearchResultResource` · `UserAdminResource` · `AuditLogResource`.

**Command (۳):** `outbox:publish` · `search:rebuild` · `ops:prune`.

**Middleware (۱):** `AuditAdminMutation` (alias: `api.audit`).

**Provider (۱):** `OpsServiceProvider` (listener + rate limiterهای نام‌دار).

**تست (۷):** `Concerns/BuildsOps` · `Unit/Search/SearchNormalizerTest` · `Unit/Notifications/NotificationPayloadSanitizerTest` · `Unit/Audit/AuditRedactionTest` · `Feature/Notifications/NotificationsTest` · `Feature/Search/SearchTest` · `Feature/Outbox/OutboxTest` · `Feature/Admin/AdminPanelTest`.

**اسکریپت (۱):** `scripts/build-openapi-v1-phase19-20.mjs` (idempotent، هم‌الگو با فازهای قبل).

---

## C. فایل‌های تغییر‌یافته

| فایل | تغییر |
| --- | --- |
| `routes/api.php` | ۴ مسیر عمومی/کاربری + ۱۲ مسیر پنل + گروه `api.audit` |
| `routes/console.php` | زمان‌بند `outbox:publish` (۵ دقیقه) · `outbox:publish --prune` · `search:rebuild --queue` · `ops:prune` |
| `bootstrap/app.php` | alias تازهٔ `api.audit` |
| `bootstrap/providers.php` | ثبت `OpsServiceProvider` (بعد از providerهای کارِ هم‌زمان) |
| `database/seeders/AdminRbacSeeder.php` | مجوزهای تازه: `ops.read` · `ops.manage` · `notifications.send` |
| `app/Listeners/Gamification/ProcessActivity.php` | تزریق `OutboxService` + `notifyUnlockedAchievements()` |
| `app/Services/Gamification/AchievementService.php` | `evaluateUnlocked(string $userId): array` (فهرست دستاوردهای تازه) |
| `backend/.env.example` | متغیرهای QUEUE/OUTBOX/NOTIFICATIONS/SEARCH/ADMIN/AUDIT/SETTINGS |
| `docs/openapi.v1.json` | ۱۶ path تازه + ۱۲ schema + ۳ tag + نسخه ۱.۹.۰ |
| `tests/Feature/ApiV1ContractTest.php` | مسیرهای تازه در دامنهٔ اعلام‌شده + فهرست بدهی مستندسازی فاز ۱۷/۱۸ |
| `tests/Feature/Wiki/WikiBookmarkTest.php` | محافظ «مسیر خواندن نشان دیگری» برای namespace پنل استثنا شد |

---

## D. پایگاه داده

- **`outbox_events`** — `event_key UNIQUE` · `published_at` · `attempts` · `last_error_code` · ایندکس `(published_at, created_at)`.
- **`notifications`** — `UNIQUE(user_id, dedup_key) WHERE dedup_key IS NOT NULL` (partial index؛ روی PostgreSQL و SQLite کار می‌کند) · `payload` JSON · `read_at`.
- **`notification_deliveries`** — `UNIQUE(notification_id, channel)` · `status` · `attempts` · `last_error_code`.
- **`search_documents`** — PostgreSQL: ستون **generated stored** `document tsvector` + ایندکس **GIN**؛ SQLite: ستون متن نرمال‌شده + `LIKE`. `UNIQUE(entity_type, entity_id)`.
- **`audit_logs`** — append-only (قفل مدل) · `request_id` · `changes` JSON · ایندکس روی `(action, created_at)` و `(actor_type, actor_id)`.
- **`system_settings`** — `key UNIQUE` · `value` (رمزنگاری‌شده برای کلید محرمانه) · `is_secret` · `version` (optimistic lock) · `updated_by_admin_id`.
- همهٔ migrationها از الگوی `CreatesPortableTables` پیروی می‌کنند: شاخهٔ SQLite (CHECK درون‌خطی) + شاخهٔ PostgreSQL (`Schema` + `ALTER … ADD CONSTRAINT`).

---

## E. API

**عمومی/کاربری (۴):** `GET /api/v1/search` · `GET /api/v1/me/notifications` · `PATCH /api/v1/me/notifications/{id}/read` · `PATCH /api/v1/me/notifications/read-all`.

**پنل (۱۲):** `GET /admin/dashboard` · `GET /admin/users` · `GET /admin/users/{id}` · `GET /admin/audit-logs` · `GET /admin/audit-logs/{id}` · `GET|PATCH /admin/settings` · `GET /admin/queue/failed` · `POST /admin/queue/failed/{id}/retry` · `GET /admin/search/status` · `POST /admin/search/rebuild` · `POST /admin/notifications` · `POST /admin/notifications/broadcast` · `GET /admin/notifications/deliveries` · `POST /admin/notifications/deliveries/{id}/retry`.

- `RebuildSearch` پاسخ **۲۰۲** می‌دهد (کار صف‌شده است، نه درخواست طولانی).
- پنل **فقط** نوع `system` می‌سازد؛ نوع‌های دامنه‌ای از پنل قابل جعل نیستند.
- `ApiV1ContractTest` دوطرفه بودن کد/سند را قفل می‌کند (۱۴ تست / ۲٬۹۲۳ assertion).

---

## F. صف و Outbox

- صف‌های نام‌دار: `default` · `notifications` · `search` · `outbox`؛ سیاست per-queue (`tries`/`backoff`/`timeout`) در `config/queue.php`.
- `TapeshJob` سیاست را از config می‌خواند؛ payload فقط **شناسه** است.
- ثبت رخداد: **اول commit دامنه، بعد Outbox** (`ShouldHandleEventsAfterCommit`) و `dispatch()->afterCommit()`.
- `event_key` یکتا ⇒ ثبت دوباره رکورد دوم نمی‌سازد و `null` برمی‌گرداند.
- Sweeper زمان‌بند، مسیر جبرانی برای رخدادی است که بین insert و dispatch گم شده.
- نوع بدون handler **بی‌صدا رد نمی‌شود**: Job fail می‌کند و در `failed_jobs` دیده می‌شود.
- **Dead letter دیدنی:** `GET /admin/queue/failed` فقط metadata امن می‌دهد (بدون payload خام) و retry از پنل ممکن است.

---

## G. اعلان‌ها

- نوع‌ها allowlist‌اند (`achievement_unlocked` · `exam_result` · `feedback_reply` · `system`)؛ هر نوع `payload_keys` و کانال‌های مجاز خود را دارد.
- Payload sanitizer: حذف HTML، رد کلیدهای متا، اعتبارسنجی scheme در `action`.
- `dedup_key` ⇒ ارسال دوباره اعلان تکراری نمی‌سازد.
- تحویل **پروجکشن** است، نه حقیقت دامنه: `notification_deliveries` یک ردیف به‌ازای هر (اعلان، کانال). فقط `in_app` فعال است؛ `email`/`sms`/`push` در این فاز `null`/`skipped`.
- Broadcast: کلید idempotency، chunked با keyset cursor، **سقف گیرندگان پیش از صف‌بندی** چک می‌شود.

---

## H. جست‌وجو

- PostgreSQL: `tsvector` generated + GIN + `ts_rank`؛ SQLite: نرمال‌سازی + `LIKE` با AND روی توکن‌ها.
- `SearchNormalizer`: ی/ي · ک/ك · نیم‌فاصله→فاصله · lowercase · توکن‌بندی **فقط** `\p{L}`/`\p{N}` (سد تزریق در `to_tsquery`) · تطابق پیشوندی · سقف ۱۰ توکن.
- سقف نامزد (`max_candidates`) ⇒ پرس‌وجوی بی‌کران ممکن نیست؛ `candidateCapped` در meta گزارش می‌شود.
- **دفاع دوم دسترسی:** هر نامزد یک بار دیگر با `publishedIds()` دامنه چک می‌شود ⇒ سند کهنهٔ پیش‌نویس هرگز لو نمی‌رود (تست اختصاصی دارد).
- برش متن حول نخستین توکن، با پنجره‌ای که توکن را در خود دارد؛ کل بدنه افشا نمی‌شود.

---

## I. پنل مدیریت

- **داشبورد:** شمارنده‌های واقعی (کاربر/محتوا/یادگیری/تعامل/عملیات) — هیچ عدد Mock.
- **کاربران:** فیلتر و `sort` allowlist؛ `UserAdminResource` هرگز `password_hash`/`google_subject`/توکن نمی‌دهد (اتصال گوگل فقط boolean).
- **Audit:** هر نوشتن موفق پنل رکورد می‌گیرد، نوشتن ناموفق **نه**؛ `target` ثبت می‌شود؛ کلیدهای حساس redact می‌شوند؛ بدنهٔ مسیر تنظیمات معاف است تا مقدار خام ننشیند؛ رکورد append-only (تست: `LogicException` روی `save()`).
- **تنظیمات:** allowlist کلید (ناشناخته ⇒ ۴۲۲)؛ مقدار محرمانه رمزنگاری‌شده و **نوشتنی‌محور** (هرگز خوانده نمی‌شود)؛ `version` ⇒ تعارض ۴۰۹؛ کلید محرمانه علاوه بر `settings.update` مجوز `settings.security.manage` می‌خواهد.
- **عملیات:** صف/ایندکس/تحویل — هیچ‌کدام دامنه را مستقیم mutate نمی‌کنند.

---

## J. امنیت

- RBAC با `api.can:<key>` و deny-by-default؛ کلیدهای مجوز از `AdminRbacSeeder` می‌آیند (آینهٔ پنل واقعی).
- هویت **فقط** از سشن؛ هیچ `userId`/`adminId` از بدنه یا query منبع حقیقت نیست (تست: بدنهٔ `userId` بی‌اثر است).
- مالکیت اعلان: اعلان کاربر دیگر ⇒ **۴۰۴** (نه ۴۰۳) تا وجود شناسه افشا نشود.
- CSRF double-submit روی نوشتن‌ها + Origin/Referer fail-closed.
- هیچ رمز/توکن/کلید در DB plaintext، لاگ، OpenAPI یا پاسخ نیست؛ cache عمومی بدون دادهٔ حساس.
- Rate limiterهای نام‌دار: `notifications_read/write` · `search_read` · `admin_*` · `admin_search_rebuild`.

---

## K. کارایی و سقف‌ها

- همهٔ لیست‌ها صفحه‌بندی‌شده و `perPage` سقف‌دار؛ پارامتر ناشناخته ⇒ ۴۰۰.
- Query جست‌وجو پارامتری، با `LIMIT` و سقف نامزد؛ رتبه‌بندی deterministic (بدون ML).
- Broadcast با keyset cursor (بدون offset عمیق) و شمارندهٔ `processed`.
- Commandهای prune محدود و batch-based.

---

## L. تست‌ها

| مجموعه | تعداد |
| --- | --- |
| `Feature/Outbox/OutboxTest` | ۱۶ |
| `Feature/Notifications/NotificationsTest` | ۱۴ |
| `Feature/Search/SearchTest` | ۱۷ |
| `Unit/{Search,Notifications,Audit}` | ۲۵ |
| `Feature/Admin/AdminPanelTest` | ۲۳ |
| کل سوییت | **۹۰۴ تست / ۸٬۲۹۹ assertion / ۰ شکست / ۲ skip** |

پوشش: idempotency، مالکیت/IDOR، CSRF/Origin، allowlist فیلتر و sort، عدم افشای ستون حساس، redact شدن Audit، optimistic lock، جلوگیری از لو رفتن پیش‌نویس با ایندکس کهنه، تزریق `tsquery`، سقف صفحه‌بندی، prune و rebuild.

---

## M. سازگاری و مهاجرت

- Legacy `/api/admin/*` دست‌نخورده ماند (مهاجرت/cutover فاز ۲۲ است).
- `test_the_legacy_api_surface_is_not_served_by_laravel` همچنان سبز است.
- `QUEUE_CONNECTION=database` پیش‌فرض است تا بدون Redis هم کار کند؛ Redis فقط با env.
- OpenAPI legacy سرور Node دست‌نخورده.

---

## N. Scope Lock

ساخته **نشد** (طبق قفل دامنه): AI Mentor · Data Migration/Cutover (فاز ۲۲) · بهینه‌سازی نهایی کارایی (فاز ۲۴) · موتور جست‌وجوی بیرونی (نیاز اندازه‌گیری‌شده ندارد) · UI ادمین جدید در فرانت (فاز ۲۱) · ادغام با Payment/Entitlement.

---

## O. بدهی باز و ریسک‌ها

1. **مستندسازی OpenAPI فاز ۱۷/۱۸** (۲۱ مسیر Commerce/International) هنوز نوشته نشده — در `ApiV1ContractTest::pendingDocumentation()` به‌صراحت به‌عنوان بدهی ثبت شد، نه معافیت دائمی. آن فهرست باید تا پایان آن جریان **خالی** شود.
2. **Bank Session در production باید Redis باشد** (بدهی از فاز ۶) — این فاز آن را تغییر نداد.
3. **`EXPLAIN ANALYZE` روی PG** برای کوئری‌های `search_documents` و `audit_logs` اجرا نشد؛ ایندکس‌ها در migration هستند ولی پلن واقعی اندازه‌گیری نشده.
4. **UI پنل در فرانت ساخته نشد** — فقط قرارداد API آماده است.
5. `vite build` و تست مرورگری در این فاز اجرا نشد (خارج از دامنهٔ بک‌اند).
6. **`OrderService.php:120-125` (فاز ۱۷/۱۸)** — `lockForUpdate()->count()` روی PG
   `FOR UPDATE is not allowed with aggregate functions` می‌دهد ⇒ ۲۶ تست قرمز روی PG.
   در دامنهٔ جریان هم‌زمان است؛ جزئیات و اصلاح در بخش R.۴.
7. **بدهی Pint پروژه‌ای** — ۴۶ فایل خارج از دامنهٔ فاز ۱۹/۲۰ همچنان تخلف سبک دارند
   (فازهای ۱۳–۱۸) ⇒ گام `pint --test` در `verify-on-pg.sh` سبز نمی‌شود. بخش R.۵.

---

## P. باگ‌های واقعی که در همین فاز پیدا و اصلاح شد

هر سه مورد از یک ریشه‌اند: **dot-notation لاراول روی کلیدهایی که خودشان نقطه دارند.**

1. **`OutboxService::assertKnownEventType` / `OutboxHandlerRegistry::for`** — `config('outbox.handlers.search.index')` کلید `search.index` را به‌عنوان تودرتویی می‌خواند و همیشه `null` می‌داد ⇒ «Unknown outbox event type: search.index» برای نوع معتبر. اصلاح: دسترسی آرایه‌ای.
2. **`SystemSettingsService::definition`** — `config('settings.keys.site.announcement')` همان مشکل ⇒ «Unknown setting key» برای کلید معتبر و حذف شدن کلید محرمانه از فهرست. اصلاح: دسترسی آرایه‌ای.
3. **`SearchNormalizer::snippet`** — پنجره از `position - length` شروع می‌شد، پس توکن دقیقاً بیرون انتهای پنجره می‌افتاد و «کلیه» در متن بریده نمی‌آمد. اصلاح: پیش‌بینی `length/4` به‌عنوان مقدمه.

**دو تلهٔ هارنس که سنجه را کاذب می‌کردند (اصلاح شدند):**

4. **متن غیر‑ASCII خام در query string تست.** `Request::create('/api/v1/search?q=کلیه')` هر بایت در بازهٔ `0x80–0x9F` را با `_` جایگزین می‌کند ⇒ پرس‌وجو بی‌صدا صفر نتیجه می‌دهد. تست‌ها به `http_build_query`/`urlencode` منتقل شدند (مرورگر واقعی هم همین کار را می‌کند). یک تست (ویکی) تا پیش از اصلاح **کاذبانه سبز** بود، چون توکن خراب‌شده «با» می‌شد و به‌صورت پیشوندی تطابق می‌یافت.
5. **نبود هدر CSRF در نوشتن‌های کاربر.** سه تست اعلان به‌جای سنجیدن مالکیت، فقط ۴۰۳ CSRF را می‌سنجیدند ⇒ هدر `csrfHeader()` اضافه شد.

همچنین دو **محافظ کهنه** به‌روزرسانی شدند (نه ضعیف): `ApiV1ContractTest` فهرست دامنهٔ اعلام‌شده + محافظ دامنه‌های ساخته‌نشده، و `WikiBookmarkTest` استثنای namespace پنل.

---

## Q. وضعیت نهایی فاز ۱۹/۲۰

| بخش | وضعیت |
| --- | --- |
| فاز ۱۹ — Queue | **COMPLETE** |
| فاز ۱۹ — Outbox | **COMPLETE** |
| فاز ۱۹ — Notifications | **COMPLETE** |
| فاز ۱۹ — Search | **COMPLETE** |
| فاز ۲۰ — داشبورد | **COMPLETE** |
| فاز ۲۰ — کاربران | **COMPLETE** |
| فاز ۲۰ — Audit | **COMPLETE** |
| فاز ۲۰ — تنظیمات | **COMPLETE** |
| فاز ۲۰ — عملیات (صف/ایندکس/تحویل) | **COMPLETE** |
| فاز ۲۰ — ارسال اعلان از پنل | **COMPLETE** |
| OpenAPI v1 | **COMPLETE** (۱.۹.۰ — ۱۶۱ path / ۱۹۸ عملیات / ۹۱ schema) |
| تست و رگرسیون (SQLite) | **COMPLETE** (۹۰۴ تست — ۹۰۲ سبز / ۲ skip / ۰ شکست / ۸٬۲۹۹ assertion) |
| تأیید واقعی روی PostgreSQL | **COMPLETE برای دامنهٔ فاز** (۱۰۶ تست سبز) — ۲۶ شکست باقی‌مانده همه در فاز ۱۷/۱۸ |
| مستندسازی فاز ۱۷/۱۸ (خارج از دامنه) | **بدهی ثبت‌شده** |

---

## R. تأیید واقعی روی PostgreSQL (بازاجرا پس از اصلاح‌ها)

خوشهٔ موقت PG 17 در `/tmp` (پورت موقت، `LC_ALL=C`، `CACHE_STORE=array`) — همان مسیر
`backend/scripts/verify-on-pg.sh`. دستور:

```
DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=<port> DB_DATABASE=<db> \
DB_USERNAME=postgres CACHE_STORE=array php artisan test
```

### اعداد

| اجرا | نتیجه |
| --- | --- |
| SQLite (سوییت کامل) | **۹۰۲ سبز · ۲ skip · ۰ شکست · ۸٬۲۹۹ assertion** |
| PostgreSQL (سوییت کامل) | ۸۷۵ سبز · ۲ skip · **۲۷ شکست** · ۸٬۰۹۲ assertion |
| PostgreSQL — دامنهٔ فاز ۱۹/۲۰ + دایرکتوری‌های اصلاح‌شده | **۱۰۶ سبز · ۰ شکست** |

دایرکتوری‌های دامنهٔ فاز: `Admin` · `Search` · `Notifications` · `Outbox` · `Gamification` · `Groups`.
شکست‌های باقی‌مانده: **۲۵** `Commerce` + **۱** `International` (هر دو فاز ۱۷/۱۸) + **۱** فلاکی
`Flashcards`. هیچ‌کدام در دامنهٔ فاز ۱۹/۲۰ نیستند.

سوییت کامل PG دیگر **کرش نمی‌کند** (پیش‌تر `Premature end of PHP process` می‌داد).

### ۱. باگ محصول — الگوی «گرفتن استثنا داخل `DB::transaction`» (`25P02`)

در PostgreSQL هر دستور شکست‌خورده **کل تراکنش جاری** را abort می‌کند. اگر استثنای
`UniqueConstraintViolationException` **داخل** کلوژر `DB::transaction` گرفته شود، لاراول کلوژر را
«موفق» می‌بیند و هیچ rollback ای انجام نمی‌دهد ⇒ تراکنش abort باقی می‌ماند و **هر دستور بعدی**
با `25P02` می‌ترکد. SQLite این را کاملاً پنهان می‌کند (بدون abort).

**اصلاح:** `INSERT` در یک `DB::transaction` تودرتو (savepoint) و گرفتن استثنا **بیرون** از آن.

جاهایی که اصلاح شد:

| فایل | متد |
| --- | --- |
| `app/Services/Notifications/NotificationService.php` | `create` (فاز ۱۹) |
| `app/Services/Outbox/OutboxService.php` | `record` (فاز ۱۹) |
| `app/Services/Gamification/AchievementService.php` | `evaluateUnlocked` |
| `app/Services/Gamification/XpService.php` | `award` · `projectMembership` |
| `app/Services/Gamification/LeagueService.php` | `ensureCurrent` · `ensureMembership` |
| `app/Services/Gamification/ChallengeService.php` | `findOrCreate` |
| `app/Services/Groups/GroupService.php` | `joinByCode` |

**مدرک:** لاگ خودِ سرور PG پس از اصلاح `duplicate key value violates unique constraint
"group_memberships_user_id_unique"` و `"xp_transactions_request_key_unique"` را نشان می‌دهد و
**هیچ `25P02` ای پس از آن نیست** — یعنی مسابقهٔ UNIQUE رخ می‌دهد، ولی تراکنش سالم می‌ماند.
قبل از اصلاح، هر یک از این رخدادها کل تست را می‌شکست.

### ۲. مصنوع تست — `lessonId` غیر‑UUID

`LessonCompleted::dispatch($userId, $pageId, 'lesson-x')` در تست گیمیفیکیشن ⇒ روی PG
`select count(*) from "lesson_pages" where "lesson_id" = $1` ⇒
`22P02: invalid input syntax for type uuid` ⇒ abort ⇒ دو listener بعدی
(`SyncLearningActivity` و `ProcessActivity`) با `25P02` روی اولین کوئری‌شان (`select * from "users"`)
می‌ترکیدند و **بی‌صدا** (fail-soft) بلعیده می‌شدند. SQLite چون `uuid` را text می‌گیرد، هیچ
خطایی نمی‌داد. اصلاح در خود تست: `self::LESSON_ID` (UUID معتبر). **این باگ محصول نبود.**

### ۳. مصنوع تست — فلاکی زمانی در `FlashcardReviewTest`

`tests/Feature/Flashcards/FlashcardReviewTest.php:127` دو `due_at` را مقایسه می‌کند که در **دو
درخواست جدا** ساخته شده‌اند. زیر بار سوییت کامل، دو درخواست می‌توانند دو ثانیهٔ متفاوت
(`18:15:01` در برابر `18:15:02`) را ببینند. همان فایل **تک‌به‌تک ۸۹ تست سبز** می‌دهد.
اصلاح پیشنهادی (خارج از دامنهٔ این فاز): `Carbon::setTestNow()` یا مقایسه با تلورانس.

### ۴. باگ محصول فاز ۱۷/۱۸ — برای تحویل (اصلاح نشد)

`app/Services/Commerce/OrderService.php:120-125`

```php
$open = Order::query()
    ->where('user_id', $user->getKey())
    ->whereIn('status', [Order::STATUS_PENDING, Order::STATUS_AWAITING_PAYMENT])
    ->where('expires_at', '>', Carbon::now())
    ->lockForUpdate()   // ← اینجا
    ->count();
```

PostgreSQL: `0A000: FOR UPDATE is not allowed with aggregate functions`. SQLite بی‌صدا رد می‌کند.
**اثر اندازه‌گیری‌شده: ۲۵ تست `Commerce` + ۱ تست `International`** (تنها ریشهٔ شکست‌های باقی‌مانده).
این فایل در دامنهٔ جریان هم‌زمان فاز ۱۷/۱۸ است و **عمداً دست نخورد**.
اصلاح: قفل روی `count()` نگذارید — یا `->lockForUpdate()->get()` بگیرید و در PHP بشمارید، یا
قفل را به رکورد کاربر منتقل کنید.

### ۵. سبک‌نویسی (Pint)

`vendor/bin/pint --test` پیش از این فاز هم پروژه‌ای قرمز بود. **۱۲ فایل از دامنهٔ فاز ۱۹/۲۰**
با `pint` اصلاح شد (کانفیگ، کنترلرهای ادمین، سرویس‌های Outbox/Notifications/Search/Settings،
`routes/api.php`، `bootstrap/providers.php`، تست جست‌وجو). **۴۶ فایل** همچنان خارج از دامنه
(فازهای ۱۳–۱۸) تخلف دارند و عمداً دست نخوردند تا با جریان هم‌زمان تعارض نکند.
⇒ گام Pint در `verify-on-pg.sh` تا پاک‌سازی آن ۴۶ فایل سبز نخواهد شد.
