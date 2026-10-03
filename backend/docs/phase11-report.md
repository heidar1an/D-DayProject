# گزارش فاز ۱۱ — Wiki (دانشنامهٔ پزشکی)

تاریخ: ۲۰۲۶-۱۰-۰۳ · OpenAPI v1 = **1.5.0** · مسیرها = ۷۵ · Schemaها = ۴۸

> **تطبیق نام‌گذاری:** «فاز ۱۱» در پرامپت (Wiki) = همان «فاز ۱۰» در شماره‌گذاری داخلی بک‌اند (KG پرامپت = فاز ۱۲ = فاز ۱۱ داخلی). پیاده‌سازی کامل این فاز در جلسات پیش انجام و در `phase9-10-report.md` گزارش شده بود. در این نوبت کل زنجیره (§۱–۳۴ پرامپت) بازبینی و با اجرای واقعی تست بازتأیید شد — **هیچ تغییر کدی لازم نشد** (صفر باگ، صفر رگرسیون).

وضعیت: **PHASE 11 (WIKI) COMPLETE — Implemented + Verified.**

## بازتأیید امروز (اعداد اندازه‌گیری‌شده)

- سوییت بک‌اند (SQLite): **۵۹۴ تست / ۴٬۷۷۱ assertion / ۰ failed / ۲ skipped** (دو گیت Redis مطابق سیاست `phpunit.xml` — دست‌نخورده).
- تست‌های Wiki: **۷۱ متد** در ۳ فایل (WikiPublicTest ۲۶ · WikiAdminTest ۲۹ · WikiBookmarkTest ۱۶).
- پل فرانت: `v1-frontend-contract.mjs` ⇒ **۵۴ بررسی سبز / ۰ شکست** (شامل قفل قرارداد ویکی).
- تأیید PG واقعی این کد پیش‌تر با `verify-on-pg.sh` انجام شد: **۵۹۴ passed / ۰ failed روی PG** — کد از آن پس تغییر نکرده.

## ۱. فایل‌های ساخته‌شده (اجرای اصلی فاز)

- Migration: `2026_10_03_000900_create_wiki_tables.php` (دوگانهٔ PG/SQLite).
- Models: `WikiCategory` · `WikiArticle` · `WikiRelation` · `WikiBookmark`.
- Services: `WikiCategoryService` · `WikiArticleService` · `WikiRelationService` · `WikiBookmarkService` · `WikiQueryService` · `WikiSearchService`.
- Controllers: `WikiController` · `WikiSearchController` · `WikiBookmarkController` · `Admin/AdminWikiController`.
- Policies: `WikiCategoryPolicy` · `WikiArticlePolicy` · `WikiRelationPolicy` · `WikiBookmarkPolicy`.
- Requests: `app/Http/Requests/Wiki/` (عمومی: List/Search/Suggest/ListBookmarks + ادمین: ۶ FormRequest).
- Resources: `WikiCategoryResource` · `WikiArticleSummaryResource` · `WikiArticleResource` · `WikiRelationResource` · `WikiBookmarkResource` + `AdminWikiArticleResource` (عمومی/ادمین جداست).
- Events: `WikiArticleOpened` · `WikiBookmarkAdded` · `WikiBookmarkRemoved` (وصل به analytics فاز ۸؛ dispatch پس از commit).
- پل فرانت: `src/services/wiki/wikiV1.js`.

## ۲. فایل‌های تغییریافته

`routes/api.php` · `database/seeders/AdminRbacSeeder.php` (فقط نقش‌های موجود) · `docs/openapi.v1.json` (1.4.0→1.5.0) · `scripts/v1-frontend-contract.mjs` · `tests/Feature/ApiV1ContractTest.php`. فازهای قبلی دست نخوردند.

## ۳. Migrations — ۴ جدول

- `wiki_categories`: UUID PK، `parent_id` خودارجاع (FK بیرون از `Schema::create` — تلهٔ PG 42830)، slug یکتا، `sort_order`، CHECK وضعیت + عدم خود-والدی. حذف دستهٔ دارای مقاله/فرزند ⇒ آرشیو (حذف فیزیکی بسته).
- `wiki_articles`: UUID PK، slug یکتا، `category_id` nullable (SET NULL)، `status ∈ {draft,published,archived}`، `version ≥ 1`، `author_admin_id`/`editor_admin_id` فقط سمت سرور، `published_at` هنگام انتشار، CHECKهای content_type/difficulty/read_minutes.
- `wiki_relations`: `UNIQUE(from,to,kind)`، CHECK `from ≠ to` (خودارجاع در سطح DB رد)، FK هر دو سمت `RESTRICT` — حذف مقاله رابطهٔ تاریخی را cascade نمی‌کند.
- `wiki_bookmarks`: `UNIQUE(user_id, article_id)` (race تکراری‌سازی در DB بسته)، FK کاربر CASCADE (تنها استثنا).

## ۴. Models — ۴ / ۴ ✓ (بند ۱ جدول بالا)

## ۵. Endpoints — ۲۰ مسیر / ۱۵ path OpenAPI

- عمومی (`throttle:wiki_read`/`wiki_search`): `GET wiki/categories` · `wiki/articles` · `wiki/articles/{slug}` · `wiki/search` · `wiki/suggest`.
- کاربر: `GET`/`PUT`/`DELETE /me/wiki-bookmarks/{articleId}` — مالکیت فقط از سشن، mutation با `api.auth + api.origin + api.csrf`، idempotent.
- ادمین (`api.admin` + `RequirePermission`): `admin/wiki/articles[/{id}][/publish|/archive]` · `admin/wiki/categories[/{id}]` · `admin/wiki/relations[/{id}]` — create/read/update/publish/archive/delete-محدود (حذف دستهٔ غیرخالی غیرممکن).

## ۶. Permissions

هیچ کلید `wiki.*` اختراع نشد (عمداً — RBAC واقعی پنل چنین کلیدی ندارد). مجوزها از RBAC فاز ۳: `articles.create/update/publish`، `categories.manage`، `relations.manage` و هم‌خانواده‌ها با deny-by-default. Role جدید ساخته نشد.

## ۷–۸. تست‌ها (۷۱ متد) — پوشش §۲۸

Database: UUID، slug یکتا، bookmark یکتا (DB-سطح)، relation یکتا، رد خودارجاع، FK integrity، سلسله‌مراتب + رد چرخهٔ چندسطحی + سقف عمق. API: مقالهٔ منتشرشده، draft/archived ⇒ **404** بدون افشای وجود، جست‌وجوی فقط-published، suggest سبک (بی‌بدنه، سقف سخت)، صفحه‌بندی/سقف perPage، slug/category نامعتبر، ایجاد/تکرار/حذف نشانک، مالکیت. Authorization: مهمان، کاربر بدون نقش روی همهٔ مسیرها، editor بدون مجوز انتشار، CSRF. Security: IDOR (هیچ مسیر خواندن نشانک کاربر دیگر وجود ندارد)، mass-assignment (`$fillable = []`؛ author/editor سرور-تعیین)، unknown query parameter ⇒ 400، **Stored XSS: body پیش از ذخیره با `RichTextSanitizer` (whitelist) پاک‌سازی می‌شود — تست سبز** (+ قفل ۱۴ سنجهٔ `RichTextSanitizerTest`)، نشت متادیتای ادمین (Resource عمومی هرگز status/version/نویسنده/view_count نمی‌دهد).

## ۹. یافته‌های امنیتی

بدون یافتهٔ باز. ۴۰۴ به‌جای 403 برای محتوای منتشرنشده؛ uuid نامعتبر ⇒ 404 نه 500؛ جست‌وجو LIKE-escape شده با نرمال‌سازی فارسی (`PersianText`)؛ ورژن stale در ویرایش ⇒ **409 `VERSION_CONFLICT`** و بدنه بازنویسی نمی‌شود.

## ۱۰. تغییرات قرارداد API

OpenAPI 1.5.0: ۵ schema ویکی (`WikiCategory`/`WikiArticleSummary`/`WikiArticle`/`WikiRelation`/`WikiBookmark`) + ۱۵ path. Lint معادل پروژه: `ApiV1ContractTest` دوطرفه (هر مسیر واقعی مستند، هر مسیر مستند واقعی) + گارد ممنوع-مسیر (payment/knowledge/…) — سبز.

## ۱۱. سازگاری فرانت

پل `wikiV1.js` روی `v1Request` با نگاشت snake→camel ساخته و قفل شد (۵۴ بررسی سبز). **UI هنوز از `wikiService.js`/`mockData.js` قدیمی می‌خواند** — سوییچ اتمی، خارج از محدودهٔ فاز (سیاست مشترک فازهای ۵–۱۰). localStorage (`tapesh:wiki:v1:*`) خوانده/نوشته نمی‌شود؛ **import خودکار مسدود است** (§۲۷: نسخه/مالکیت/رضا/rollback لازم است و فعلاً وجود ندارد).

## ۱۲. TODOهای باقی‌مانده

- سوییچ UI دانشجویی/ادمین به v1 (cutover اتمی، فاز مستقل).
- Knowledge Graph → فاز ۱۲. در این فاز **هیچ** جدول/مسیر/schema گرافی ساخته نشد؛ گارد قراردادی مسیرهای `knowledge_*` را می‌بندد. `wiki_relations` با ۱۱ kind (استخراج‌شده از فرانت واقعی، allowlist در config) نقطهٔ اتصال آینده است.

## ۱۳. محدودیت‌های شناخته‌شده

- **Audit جدولی append-only در `backend/` وجود ندارد** (در هیچ فازی ساخته نشده؛ §۳۰ با «زیرساخت موجود» قابل تطبیق نبود). جایگزین فعلی: رخدادهای دامنه + تست‌های رفتاری. ساخت زیرساخت audit جدید از محدودهٔ این فاز خارج بود.
- جست‌وجو LIKE-محور با نرمال‌سازی فارسی/عربی است، نه tsvector/GIN (§۱۴: index فقط وقتی query واقعی توجیه کند). روی دادهٔ فعلی ~۶ms؛ سرویس (`WikiSearchService`) برای تعویض موتور آینده طراحی شده. در مقیاس بزرگ به PG FTS نیاز خواهد بود.
- اجرای امروز روی SQLite بود؛ تأیید PG واقعی همین کد قبلاً انجام شده (بند «بازتأیید امروز»). بارسنجی UI و production واقعی انجام نشده.

## ۱۴. تخطی از محدوده

هیچ. KG / Meilisearch / Elasticsearch / queue / gamification / payment / notifications ساخته نشدند؛ «فاز ۱۱ = فقط Wiki» با گارد خودکار در `ApiV1ContractTest` قفل است.
