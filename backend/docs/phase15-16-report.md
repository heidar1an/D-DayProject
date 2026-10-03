# گزارش فاز ۱۵ و ۱۶ — Media/References/Anatomy + Articles/Notes/Review/Groups/Feedback

> تاریخ: ۲۰۲۶-۱۰-۰۳ · Laravel 13.34 / PHP 8.5.11 · PostgreSQL (سیستم حقیقت) + SQLite (تست)
> الگو: Controller نازک → FormRequest → Service/Action → Model → Resource

## ۱. فایل‌های ساخته‌شده

### Config (۶)
- `backend/config/media.php` — disks، signed_ttl_minutes (۱۰)، kinds (image/document/video/model3d با extensions/mimes/max_bytes)، pagination
- `backend/config/references.php` — سقف slug/title/description، statuses، max_sections (۴۰)، max_topics (۶۰)، topic_content_max (۱۰۰٬۰۰۰)
- `backend/config/anatomy.php` — ۱۶ دستهٔ واقعی viewer، statuses، part_key_max
- `backend/config/articles.php` — slug/title/summary/body، statuses، sorts، categories
- `backend/config/notes.php` — kinds، source types، review stages (G5)، سقف‌ها
- `backend/config/groups.php` — کد (پیشوند TP، بدنهٔ ۶، الفبا، retired_keep=۱۲)، seats ۲–۳، statuses
- `backend/config/feedback.php` — sources، statuses، سقف بدنه/reply، pagination

### Migration (۷)
- `2026_10_03_001300_create_media_table.php` — UNIQUE(disk,key)، index sha256
- `2026_10_03_001310_create_references_tables.php` — `"references"` (نقل‌قولِ کلمهٔ رزرو) + reference_assets UNIQUE(reference_id,media_id)
- `2026_10_03_001320_create_anatomy_assets_table.php` — UNIQUE(part_key)
- `2026_10_03_001400_create_articles_tables.php` — article_categories، articles، article_bookmarks UNIQUE(user_id,article_id)
- `2026_10_03_001410_create_user_notes_tables.php` — user_notes + review_items UNIQUE(user_id,source_type,source_id)
- `2026_10_03_001420_create_study_groups_tables.php` — study_groups (seats CHECK ۲–۳) + group_memberships **UNIQUE(user_id)** + `group_retired_codes` (UNIQUE(code_hash))
- `2026_10_03_001430_create_feedback_tables.php` — feedback + feedback_replies

مسیر دوگانه: SQLite با `DB::statement` خام (CHECK/UNIQUE/FK inline) و PostgreSQL با `Schema::create` + `addCheck()` — trait موجود `CreatesPortableTables`.

### Model (۱۴)
`Media`، `Reference`، `ReferenceAsset`، `AnatomyAsset`، `Article`، `ArticleCategory`، `ArticleBookmark`، `UserNote`، `ReviewItem`، `StudyGroup`، `GroupMembership`، `GroupRetiredCode`، `Feedback`، `FeedbackReply` — همگی `HasUuids`، `$fillable = []` (mass assignment بسته)، ثابت‌های status/kind/role، castها.

### Service (۱۲)
- `Media/MediaMimeDetector` — شناسایی magic bytes + ابعاد تصویر
- `Media/MediaService` — store (اعتبارسنجی چندلایه، sha256 سمت سرور، کلید غیرقابل‌حدس `media/{Y/m}/{uuid}.{ext}`)، findByChecksum، archive، deleteArchived
- `Media/MediaAccessService` — canUserAccess/canAdminAccess/accessFor (Signed URL کوتاه‌عمر)
- `References/ReferenceService` — CRUD + publish/archive + attach/detach asset + sanitizeSections
- `References/ReferenceQueryService` — publishedPaginated/publishedByIdOrSlug/assetUrls
- `Anatomy/AnatomyAssetService` — create/update (part_key تغییرناپذیر)/publish/archive
- `Anatomy/AnatomyQueryService` — publishedCatalog/publicRow
- `Articles/ArticleService` — CRUD + optimistic lock (version)
- `Articles/ArticleQueryService` — published با sort allowlist
- `Articles/ArticleBookmarkService` — list/add/remove idempotent (race-safe با قید یگانه + savepoint)
- `Notes/UserNoteService` — CRUD با اعتبارسنجی ساختاری checklist/qa/table
- `Notes/ReviewItemService` — add idempotent، completeReview (جدول G5: ۱→۲→۴→۸→۱۶ روز)، restart
- `Groups/GroupCodeService` — generate/normalize/hash/assertFormat (SHA-256 فقط)
- `Groups/GroupService` — create/joinByCode (lockForUpdate)/rotateCode/kick/leave
- `Feedback/FeedbackService` — submit/reply/listForUser/markRepliesRead/adminList/cleanMeta

### Controller (۱۴) و Request (۱۶) و Resource (۹)
Controllerهای عمومی/پنل همهٔ دامنه‌ها + FormRequest با allowlist (RejectsUnknownParameters برای query) + Resourceهای camelCase برای payloadهای عمومی. فهرست کامل در `git status`.

### Provider (۱)
`app/Providers/CommunityServiceProvider.php` — ۱۹ rate limiter نام‌دار (media_access/stream/admin، references/anatomy/articles read+admin، article_bookmark، notes/review write، groups read/write/join، feedback submit/read/admin) با کلید `admin:{id}` / `user:{id}` / `ip:HMAC`.

### تست (۹)
- `tests/Concerns/BuildsContent.php` — PNG واقعی ۱×۱ + آپلود واقعی multipart
- `tests/Feature/Media/MediaTest.php` (۱۱)، `References/ReferencesTest.php`، `Anatomy/AnatomyTest.php`، `Articles/ArticlesTest.php`، `Notes/NotesTest.php`، `Groups/GroupsTest.php`، `Feedback/FeedbackTest.php`
- **جمع: ۵۹ تست / ۴۶۵ assertion — همه سبز** (SQLite in-memory)

## ۲. فایل‌های تغییر‌یافته

| فایل | تغییر |
| --- | --- |
| `backend/bootstrap/providers.php` | ثبت `CommunityServiceProvider::class` (+ import) |
| `backend/routes/api.php` | ۵۲ مسیر تازهٔ عمومی/پنل + importهای کنترلر |
| `tests/Feature/ApiV1ContractTest.php` | فهرست مسیرهای مجاز تا فاز ۱۶ + سطرهای ماتریس وضعیت + تغییرنام تست scope |
| `docs/openapi.v1.json` | bump به 1.8.0 — ۱۴۳ path / ۱۷۹ operation / ۸۲ schema |

## ۳. پایگاه داده
- ۹ جدول تازه (همه با UUID PK، `timestampsTz`، CHECK constraint، FK با cascade/restrict آگاهانه)
- انحراف مستند: `group_memberships UNIQUE(user_id)` برای قاعدهٔ تک‌گروهی UI (قوی‌تر از U(group,user) و رقابت بین‌گروهی را هم می‌بندد)
- کدهای بازنشستهٔ گروه از ستون jsonb به جدول `group_retired_codes` منتقل شد — چون کوئری پرتابل روی jsonb در PG (`jsonb ~~ text`) وجود ندارد و جست‌وجوی join باید ایندکس‌پذیر و lockForUpdate باشد

## ۴. API
- عمومی: media access/stream، references، anatomy assets، articles + categories، feedback (مهمان با guestRef)
- سشن‌دار: article-bookmarks، me/notes، me/review-items (+complete-review/restart)، groups (create/join/show/rotate/leave/kick/me)، me/feedback (+read)
- پنل: media (upload/index/archive/destroy)، references (+assets/publish/archive)، anatomy (+publish/archive)، articles (+categories CRUD)، feedback (list/show/reply/status)
- مجوزها فقط کلیدهای واقعی RBAC پنل: `media.*`، `references.*` (برای آناتومی هم — کلید مستقل در legacy وجود ندارد)، `articles.*`، `categories.*`، `feedback.*` — **هیچ کلید اختراعی**

## ۵. امنیت
- ownership همیشه از سشن؛ `user_id` بدنه هرگز منبع مجوز نیست
- IDOR: یادداشت/مرور/نشان/گروهِ دیگری ⇒ ۴۰۴ (وجود افشا نمی‌شود)
- آپلود: پسوند+MIME اعلامی+magic bytes+سقف حجم؛ کلید ذخیره غیرقابل‌حدس؛ `shell.php.png` تست شد
- XSS: body مقاله/مرجع از `RichTextSanitizer` (whitelist)؛ feedback عمداً plain text
- CSRF double-submit و Origin fail-closed روی همهٔ نوشتن‌ها؛ guest هم CSRF دارد
- Signed URL فقط endpoint استریم را باز می‌کند؛ امضای منقضی ۴۰۳
- race: bookmark/join با قید UNIQUE + savepoint (`25P02` در PG)؛ ظرفیت گروه با lockForUpdate
- rate limit: گروه/بازخورد سخت‌گیرانه (join=۵/دقیقه، feedback=۵/دقیقه)

## ۶. تست‌ها و رگرسیون
- فازهای ۱۵/۱۶: **۵۹ تست / ۴۶۵ assertion سبز**
- کل سوییت: **۷۵۱ تست** — فقط `ApiV1ContractTest` ۲ قرمز داشت که با به‌روزرسانی scope + OpenAPI سبز شد (۱۳ تست / ۲٬۵۷۲ assertion)
- `test_oversized_file_is_rejected` داخل سوییت کامل OOM می‌داد (۱۲۸MB) → بازنویسی با فایل sparse روی دیسک
- رگرسیون فازهای ۱–۱۴: صفر

## ۷. سازگاری فرانت
- قرارداد OpenAPI v1 (1.8.0) منبع حقیقت است؛ `ApiV1ContractTest` دوطرفه بودن را قفل می‌کند
- سویچ UI به v1 اتمی است و طبق تصمیم پل v1 (فاز قبل) عمداً انجام نشد — مسیرهای legacy سرور Node برای این دامنه‌ها هنوز فعال‌اند
- نکته برای cutover: آیتم legacy اندیس عددی است، v1 UUID است (نگاشت در cutover)، `idOrSlug` مراجعه دوگانه پذیرفته می‌شود، envelope `data/meta/error` با `requestId`

## ۸. Scope Violations / آیتم‌های deferred
- **هیچ نقض scope**: Media Center، Publishing Platform، Commerce/Payment، Notification، Search، AI، Admin Panel ساخته نشد
- Admin CRUD محتوای legacy (course/lesson/…) خارج از scope بود و دست نخورد
- عملکرد (EXPLAIN ANALYZE روی PG) به مرحلهٔ verify-on-pg موکول شد — ایندکس‌ها در migrationها تعریف شده‌اند

## ۹. جمع‌بندی
Phase 15 Status: COMPLETE
Phase 16 Status: COMPLETE
