# گزارش فاز ۹ و ۱۰ — فلشکارت و ویکی

تاریخ: ۲۰۲۶-۱۰-۰۳ · OpenAPI v1 = **1.5.0** · مسیرها = **75** · Schemaها = **48**

وضعیت کلی: **PHASE 9-10 COMPLETE** — تمام معیارهای Definition of Done (فاز ۹: ۱۷ مورد، فاز ۱۰: ۱۷ مورد، ترکیبی) با اجرای واقعی تست تأیید شده‌اند. تفکیک Designed / Implemented / Verified در هر بخش رعایت شده است.

**اعداد تأییدشده:** کل مجموعهٔ بک‌اند: **۵۹۲ passed / ۲ skipped / ۰ failed** (۴٬۷۷۱ assertion). تست‌های تازهٔ فاز ۹–۱۰: **۲۱۱ passed** (۱٬۳۴۱ assertion) در ۹ فایل / ۳٬۴۲۹ خط. پل فرانت: `v1:contract:check` = **۵۴ بررسی سبز / ۰ شکست**. قرارداد بک‌اند: `ApiV1ContractTest` = سبز (دوطرفه + گارد فاز ۱۱ + گارد معکوس).

**تأیید واقعی PostgreSQL (خوشهٔ موقت `/tmp`):** `verify-on-pg.sh` کامل اجرا شد — `migrate:fresh → rollback → migrate` روی PG سالم؛ **کل سوییت روی PG: ۵۹۴ passed / ۰ failed** (۴٬۷۷۴ assertion — دو تست بیش از SQLite چون دو تست Redis-gate با Redis موقت باز شدند). هیچ باگ PG-only در فاز ۹–۱۰ دیده نشد: FK خودارجاع خارج از `Schema::create`، CHECKهای `addCheck`، INSERTهای savepoint-پیچ و گاردهای `whereUuid` همگی روی PG واقعی درست کار کردند. Pint: ۹ مورد سبک در فایل‌های فاز ۹–۱۰ → اصلاح شد → PASS (۳۸۶ فایل)؛ اجرای دوبارهٔ SQLite بدون رگرسیون (۵۹۲ سبز). ⚠️ روی production با auth/SSL واقعی تأیید نشده — خوشهٔ تست موقت بود.

---

### Phase 9 — Flashcards

**Implemented + Verified.** معماری سه‌سطحی واقعی: تعریف کارت (`flashcards`) / وضعیت مرور کاربر (`flashcard_states`، قابل تغییر) / رخداد مرور (`flashcard_reviews`، تغییرناپذیر). دک رسمی (`owner_user_id = null`) در برابر دک شخصی؛ مالکیت فقط از سشن (`api.auth`)، نه از URL/ID. مسیرها: `/api/v1/flashcards/decks[/{id}][/clone|/cards]`، `/flashcards/cards[/{id}][/suspend|/bury|/bookmark]`، `/flashcards/review/queue`، `/flashcards/review/{cardId}`، `/flashcards/progress` — ۲۸ مسیر ثبت‌شده، همه با `whereUuid`. صف مرور با ۴ حالت واقعی فرانت (today/deck/weak/cram)؛ دیدن صف هیچ ردیفی نمی‌سازد (پیش‌نمایش روی state ذخیره‌نشده). پیشرفت فقط مشتق از state + reviews است (total/new/learning/due/reviewed_today/mastered/suspended) — هیچ وضعیت اضافه‌ای اختراع نشده. دک رسمی قابل حذف نیست (۴۰۹)؛ کلون آن به دک شخصی بدون تاریخچهٔ مرور.

### Flashcard Database

**Implemented + Verified.** چهار جدول در مهاجرت دوگانهٔ PG/SQLite (`2026_10_03_000800`): `flashcard_decks` (CHECK: `owner_user_id IS NOT NULL OR visibility='public'`)، `flashcards` (`UNIQUE(deck_id, position)`)، `flashcard_states` (`UNIQUE(user_id, card_id)`، ایندکس `(user_id, due_at)`، CHECK وضعیت/ease≥1.3/difficulty∈[0,1])، `flashcard_reviews` (**بدون `updated_at`**، `UNIQUE(request_key)`، CHECK رتبه/آسانی). همهٔ FKها `RESTRICT` — حذف دکِ دارای کارت و مرور کارتِ دکِ حذف‌شده در سطح DB مسدود است، به‌علاوهٔ 409 سرویسی (`DECK_NOT_EMPTY`, `DECK_ARCHIVED`). مدل‌ها `$fillable = []` (ضد mass-assignment) و مقدارگذاری با `forceFill`.

### Spaced Repetition

**Implemented + Verified.** انتزاع مستقل: `SpacedRepetitionStrategy` (اینترفیس) + `StrategyV1` + `SpacedRepetitionRegistry` (سینگلتون در `FlashcardServiceProvider`). نسخهٔ الگوریتم = `sm2-tapesh-v1`، پورت وفادار از `src/services/flashcards/spacedRepetition.js` فرانت (گام‌های یادگیری `[10,1440]`، فارغ‌التحصیلی ۴ روز، easy ۱۰ روز، ease شروع 2.5، easyBonus 1.3، hardFactor 1.2، maxInterval 365، minEase 1.3). Controller هیچ الگوریتمی اجرا نمی‌کند. نسخهٔ الگوریتم هم در state و هم در هر رکورد مرور ثبت می‌شود؛ مرورهای V1 هرگز با V2 بازمحاسبه نمی‌شوند (مصرف‌کنندهٔ نسخهٔ ناشناخته ⇒ 422 `ALGORITHM_VERSION_UNKNOWN`). تست یکگان (Unit) رفتار کلیدهای الگوریتم را در برابر پورت می‌سنجد.

### Review Integrity

**Implemented + Verified.** زنجیرهٔ تراکنش: Load State → Lock (`lockForUpdate`) → مالکیت → اعتبارسنجی رتبه → Resolve Strategy → محاسبه → به‌روزرسانی State → ساخت Immutable Review → Commit. کلاینت فقط `rating` + `requestKey` می‌فرستد؛ `due_at`/`ease`/`interval`/`algorithm_version`/`owner_user_id` در Request کلاً ناموجودند (فیلد اضافه رد می‌شود). Idempotency با `IdempotencyService` (ledger در DB، `UNIQUE(scope, actor_key, request_key)`): تکرار همان کلید ⇒ همان نتیجه؛ همان کلید با بدنهٔ دیگر ⇒ **409**. مقادیر قبلی پیش از `save()` کپچر می‌شوند (تلهٔ `syncOriginal` ایلکوئنت). رخداد `FlashcardReviewed` پس از commit dispatch می‌شود. رقابت: دو مرور همزمان روی یک کارت ⇒ بدون خرابی وضعیت، بدون مرور تکراری (تست concurrency سبز).

### Phase 9 Security

**Implemented + Verified — ۱۲ سنجهٔ مشخصه §43 همگی اجرا و سبز:** ① دستبرد متقاطع به دک/کارت کاربر دیگر ⇒ 404 (نه 403، نه افشای وجود) ② دک خصوصی برای غریبه نامرئی در فهرست ③ دک رسمی فقط-خواندنی برای کاربر (تغییر ⇒ 403) ④ URL/ID مبنای مجوز نیست ⑤ mass-assignment: `owner_user_id`/`status`/`visibility` از بدنهٔ کلاینت قابل تزریق نیست ⑥ `requestKey` تکراری با بدنهٔ متفاوت ⇒ 409 ⑦ `requestKey` تکراری با بدنهٔ یکسان ⇒ پاسخ قبلی (بدون رکورد دوم) ⑧ فیلد ممنوع کلاینت (`due_at` و امثال آن) ⇒ رد ⑨ محتوای خطرناک (`<script>`، `onerror`، `javascript:`) پیش از ذخیره پاک می‌شود ⑩ کارت غیرمرورپذیر/دک آرشیو ⇒ 409 ⑪ `whereUuid` ⇒ شناسهٔ غیرواقعی ۴۰۴ نه ۵۰۰ ⑫ rate limit اختصاصی (خواندن/نوشتن/مرور/ادمین) با actor_key هش‌شده.

### Phase 10 — Wiki

**Implemented + Verified.** ساختار `wiki_categories` (سلسله‌مراتب با `parent_id`، FK خودارجاع خارج از `Schema::create` — تلهٔ PG 42830) → `wiki_articles` (slug یکتا، status، version، author_admin_id) → `wiki_relations` → `wiki_bookmarks`. دسته‌بندی‌ها ادمینی، مقاله‌ها ادمین‌نویش، کاربر فقط می‌خواند و نشانک می‌زند. `WikiArticleOpened` در مشاهدهٔ مقاله dispatch می‌شود و در docblock صریحاً «تکمیل آموزشی نیست». مسیرها: عمومی (categories/articles/search/suggest)، نشانک (`/me/wiki-bookmarks`)، ادمین (`/admin/wiki/*`) — ۲۰ مسیر.

### Wiki Publishing

**Implemented + Verified.** فقط `published` در API عمومی دیده می‌شود؛ `draft` و `archived` ⇒ **404** (بدون افشای وجود). انتشار/آرشیو فقط با مجوز واقعی `articles.publish` (کلید `wiki.*` عمداً اختراع نشد). ویرایش با **قفل خوش‌بینانه**: `version` اجباری در PUT؛ عدم تطابق ⇒ **409 `VERSION_CONFLICT`**. حذف سخت مقاله ممنوع نیست ولی دسته‌بندی دارای مقاله/فرزند حذف سخت نمی‌شود (آرشیو به‌جای حذف). API عمومی هیچ‌گاه `status`/`version`/نویسنده/ویراستار/`view_count` را نمی‌دهد (Resource جدای عمومی/ادمین + قفل در `v1-frontend-contract.mjs`).

### Wiki Search

**Implemented + Verified.** جست‌وجوی PostgreSQL-only (بدون موتور خارجی)، پارامتری و LIKE-escape شده، با نرمال‌سازی فارسی/عربی (`PersianText`: ی/ك، ZWNJ، ارقام، تنوین) و **دو variant** (فاصله‌دار/فشرده). محدود و صفحه‌بندی‌شده؛ facets (bySubject/byType/byDifficulty) روی مجموعهٔ فیلترشده. Suggest محدود (حداکثر مجاز config) و فقط title/slug/subject/content_type/difficulty — بدنه برنمی‌گردد. پارامتر ناشناخته در query ⇒ 400 (`UNKNOWN_QUERY_PARAMETER`). هیچ draft/ارشیوی در هیچ مسیر جست‌وجو/پیشنهاد نشت نمی‌کند (تست سبز).

### Wiki Relations

**Implemented + Verified.** `wiki_relations` با `UNIQUE(from_article_id, to_article_id, kind)`، CHECK عدم خودارجاع، FK `RESTRICT`. kinds از UI/دادهٔ واقعی فرانت استخراج شد: ۱۱ نوع (`related_to` … `measures`) در allowlist config؛ kind خارج از فهرست ⇒ 422، تکرار ⇒ 409، خودارجاع ⇒ 422. relations عمومی فقط بین مقاله‌های منتشرشده. جهت‌ها: `related` (خروجی) + `backlinks` (بدون تکرار). این لایه مرجع کنترل‌شده برای فاز ۱۱ است — **گراف دانشی ساخته نشد** (خارج از محدوده).

### Security

**Implemented + Verified — فاز ۱۰: ۱۴ سنجهٔ §44 همگی اجرا و سبز:** نشت پیش‌نویس/آرشیو در list/detail/search/suggest ⇒ 404؛ IDOR نشانک (نشانک کاربر دیگر دست‌نخوردنی، حذف نشانک غریبه بی‌اثر)؛ نشانک تکراری ⇒ idempotent؛ مقالهٔ منتشرنشده قابل نشانک‌گذاری نیست؛ sanitize whitelist سمت سرور برای body (script/iframe/object/svg/math/event-handler/style/`javascript:` پس از حذف کاراکترهای کنترلی، URL ناامن حذف، `target=_blank` ⇒ `rel="noopener noreferrer"`)؛ تزریق دستهٔ ناشناخته رد می‌شود؛ سلسله‌مراتب دسته: چرخه (تک‌سطحی و چندسطحی) ⇒ 422 `CATEGORY_CYCLE`، عمق بیش از حد ⇒ 422؛ RBAC ادمین deny-by-default (`makeRolelessAdmin` ⇒ 403/404)؛ تغییرن‌پذیری نسخه بدون `version` ⇒ 422؛ پارامتر ناشناخته ⇒ 400. پاک‌ساز HTML با DOM whitelist (`RichTextSanitizer`) با متن فارسی به‌صورت تجربی تأیید شد (`<` سرگردان ⇒ `&lt;`).

### Performance

**Implemented + Measured on real PostgreSQL.** دو کوئری حساس مشخصه §47 روی خوشهٔ موقت PG با دادهٔ حجمی سنجیده شد (`scripts/measure-phase9-10-pg.php`؛ ۳۰۰ کاربر، **۱۲۰٬۰۰۰ وضعیت مرور**، ۲۰٬۰۰۰ رخداد مرور، ۱٬۰۰۰ مقالهٔ منتشرشده با بدنهٔ ~۲KB، ۲٬۳۹۸ رابطه؛ ANALYZE پس از seed):

| عملیات (۱۵ بار، پس از warm-up) | mean | p95 |
|---|---|---|
| صف مرور today (۲٬۴۰۰ وضعیت کاربر، ~۷۲۰ سرآموخته) | **7.95ms** | 8.14ms |
| صف مرور deck | 2.80ms | 2.90ms |
| progress | **4.34ms** ← قبلاً 160.35ms | 4.46ms |
| فهرست دک‌ها | 1.29ms | 1.38ms |
| جست‌وجوی ویکی «کلیه» (~۱۰۰ نتیجه) + facets | 6.26ms | 6.37ms |
| جست‌وجوی بی‌نتیجه (بدترین حالت) | 26.97ms | 27.82ms |
| suggest | 0.62ms | 0.66ms |
| relations یک مقاله | 1.52ms | 1.60ms |

**باگ کارایی که اندازه‌گیری گرفت:** `progress()` قبل از این، ۲٬۴۰۰ مدل Eloquent را هیدرات و در PHP می‌شمرد (160ms روی PG واقعی) — به یک کوئری تجمیعی SQL تبدیل شد که آینهٔ دقیق `FlashcardState::isDue()` است (توضیح در کد ثبت شده) ⇒ **۱۶۰ms → 4.3ms**. تست‌ها پس از تغییر: ۵۹۲ سبز (بدون رگرسیون)، Pint PASS.

پلن‌ها (`EXPLAIN (ANALYZE, BUFFERS)`): اسکن سرآموخته‌ها روی `flashcard_states_user_id_due_at_index` (Index Scan، 0.09ms)؛ کارت‌های نو با Anti-Join روی `flashcard_states_user_id_card_id_unique` (Index Only Scan)؛ صفحهٔ نتایج جست‌وجو با اسکن معکوس `wiki_articles_status_popularity_index` + Incremental Sort و توقف در LIMIT (0.04ms)؛ facets/count روی این حجم Seq Scan کامل جدول ۱٬۲۰۰ ردیفی‌اند (~0.9ms هرکدام — روی جدول کوچک انتخاب درست برنامه‌ریز است). صفحه‌بندی همهٔ لیست‌ها اجباری؛ کران صف (`queue_limit_max=100`) و suggest در config. کش: کاتالوگ دک رسمی و مقالهٔ منتشرشده TTL کوتاه در config دارند؛ وضعیت مرور/صف/دک خصوصی shared-cache نمی‌شود. N+1 وجود ندارد (buildTree یک‌گذره، relations با دو کوئری).

### API

**Implemented + Verified.** همه زیر `/api/v1/*` با پوشهٔ استاندارد (`data`/`meta`/`requestId`، خطای `error.code/message/fields` + `requestId`)، 401/403/404/409/422/429 یکدست. OpenAPI v1 با اسکریپت `scripts/build-openapi-v1-phase9-10.mjs` به‌روز شد: **۱۴ schema** جدید (`FlashcardDeck`, `Flashcard`, `FlashcardState`, `FlashcardReview`, `FlashcardPreview`, `FlashcardQueueItem`, `FlashcardReviewResult`, `FlashcardProgress`, `WikiCategory`, `WikiArticleSummary`, `WikiArticle`, `WikiRelation`, `WikiBookmark`, `PaginationMeta` بازمصرف) و **۳۳ مسیر** فاز ۹–۱۰؛ نسخهٔ سند 1.4.0 → **1.5.0**. `ApiV1ContractTest` دوطرفه (هر مسیر واقعی مستند، هر مسیر مستند واقعی) سبز است + گارد فاز ۱۱ (هیچ مسیر payment/knowledge/xp/… وجود ندارد) + گارد معکوس (۱۲ مسیر کلیدی فاز ۹–۱۰ واقعاً موجودند).

### Frontend

**Implemented (پل) — Verified (قرارداد). مطابق الگوی فاز ۵–۸، سوییچ UI انجام نشد.** دو پل تازه: `src/services/flashcards/flashcardsV1.js` (دک/کارت/صف/مرور/پیشرفت/تعلیق/bury/نشانک) و `src/services/wiki/wikiV1.js` (دسته/فهرست/detail/search/suggest/نشانک) — هر دو روی `v1Request`، با نگاشت snake→camel و پیمان «کلاینت فقط rating می‌فرستد». `scripts/v1-frontend-contract.mjs` توسعه یافت: ۶ پل، CONSUMED برای ۱۲ schema تازه، FORBIDDEN (`owner_user_id`, `status`/`version`/نویسنده در عمومی، `user_id` نشانک، `request_key` مرور) و NESTED تازه ⇒ **۵۴ بررسی سبز**. پنل ادمین: مسیرهای v1 ادمین محتوا/آزمون/فلشکارت/ویکی قرارداد سرور قفل‌شده‌اند؛ **UI اختصاصی ویرایش ویکی وجود ندارد** و `AdminFlashcards.jsx` فعلی به legacy (`/api/admin/*`) متصل است — سوییچ ادمین به v1 انجام نشد. UI دانشجویی فلشکارت/ویکی هنوز از `flashcardService.js`/`wikiService.js` قدیمی می‌خواند؛ cutover اتمی و از محدودهٔ این فاز جدا است (مثل فازهای قبل).

### Legacy

**Verified — دست‌نخورده.** هیچ مسیر `/api/*` قدیمی تغییر نکرد؛ OpenAPI legacy سرور Node (۲۳۰ عملیات / ۱۶۶ مسیر) دست‌نخورده است. `database/content/events.json` و ۷ فایل تغییرنکردهٔ کاربر لمس نشدند. انباری legacy حذف نشد؛ تطبیق فقط در مرز (پل‌های v1). adapter دائمی بین دو دامنه وجود ندارد — دامنهٔ فلشکارت و ویکی هیچ Service یا Model مشترکی ندارند و FK بین‌دامنه‌ای ممنوع است.

### Migration

**Implemented (سیاست) — Verified (پیکربندی). اجرای import مسدود است.** دادهٔ واقعی کاربر فقط در localStorage است (`tapesh:flashcards:v1`، `tapesh:wiki:v1`). طبق §22/§54: history مرور از کلاینت **قابل اعتماد نیست**؛ بنابراین import خودکار وجود ندارد (`config('flashcards.client_migration.import_enabled') = false`). سیاست مستند: نسخه/مالک/رضا/حذف تکرار/بازگشت در صورت فعال‌سازی آینده لازم است و تا آن زمان تنها «سازگاری» به شکل پل v1 است که legacy localStorage را **نمی‌خواند** و نمی‌نویسد (دادهٔ کاربر دست‌نخورده می‌ماند). اگر روزی import لازم شود، مسیر Inventory → Crosswalk → Validation → Staging → Import → Compare الزامی است.

### Not Verified

صادقانه، اجرانشده‌ها: ① **UI دانشجویی/ادمینی** — پل‌ها قرارداد-تأییدند اما هیچ مرورگری باز نشده و هیچ سوییچ UI رخ نداده (طبق دستور: تست رابط کاربری گرفته نشد؛ سوییچ اتمی و وابسته به cutover است) ② import آزمایشی localStorage (سیاست عمداً غیرفعال) ③ کش در برابر بار واقعی (TTLها پیکربندی‌اند، رفتار تولید سنجیده نشده) ④ production PG با auth/SSL واقعی — تأیید PG و سنجش کارایی فقط روی خوشهٔ موقت `/tmp` با trust auth بود. *(در نسخهٔ اول این گزارش «اندازه‌گیری کارایی» هم اجرانشده بود؛ اکنون با `EXPLAIN ANALYZE` روی ۱۲۰k وضعیت و ۱٬۰۰۰ مقاله سنجیده شد — بند Performance.)*

### Known Risks

① فهرست‌های سفید sanitize و kinds/statuses در config اند — تغییر فرانت بدون همگام‌سازی config قرارداد را می‌شکند (چک قرارداد می‌گیرد ولی محصول می‌لغزد) ② `flashcard_reviews.request_key` UNIQUE در DB هست ولی سرویس عمداً `null` می‌نویسد (ledger مرجع است) — اگر روزی مستقیم نوشته شود، ستون باید پر شود یا قید شل شود ③ «شخصی + visibility=public هنوز فقط برای مالک» عمداً محافظه‌کارانه است؛ اگر آینده «عمومی واقعی» خواست، تصمیم محصولی لازم است ④ پنل ادمین ویکی UI ندارد — تا ساخت UI، مدیریت ویکی فقط با API client ممکن است ⑤ دو variant جست‌وجو با OR روی LIKE ایندکس‌پذیر نیست؛ اندازه‌گیری شد: در ۱٬۰۰۰ مقالهٔ منتشرشده بدترین حالت (بی‌نتیجه) ≈ ۲۷ms و حالت نتیجه‌دار ≈ ۶ms — اما هزینهٔ بی‌نتیجه با حجم مقاله خطی رشد می‌کند (برون‌یابی خطی به ۵۰k مقاله ⇒ ~۱.۳s)؛ در آن مقیاس مهاجرت به FTS (`tsvector` + GIN) لازم خواهد بود ⑥ APP_KEY rotation در فاز ۷ snapshot را می‌شکند؛ فاز ۹/۱۰ دادهٔ رمزشده ندارد ولی یادآوری می‌شود.

### Phase 11 Readiness

آماده‌سازی واقعی و بدون ادعای اضافه: ① `wiki_relations` + `related`/`backlinks` مرجع کنترل‌شدهٔ بین‌مقاله‌ای‌اند؛ پل `graphData.js` فرانت تا امروز فقط legacy localStorage می‌خواند — نقطهٔ اتصال آینده روشن است ولی **هیچ FK/پلی بین‌دامنه‌ای ساخته نشد** ② `FlashcardReviewed` / `WikiArticleOpened` / `WikiBookmarkAdded` / `WikiBookmarkRemoved` به زیرساخت analytics فاز ۸ وصل‌اند (dispatch پس از commit؛ `WikiArticleOpened` صریحاً «تکمیل آموزشی نیست») ③ `SpacedRepetitionRegistry` الگوریتم را swap-pable نگه می‌دارد (فاز آینده می‌تواند StrategyV2 ثبت کند بدون دست‌زدن به V1) ④ `app/Support/Content/*` و `PersianText` دامنه-مستقل‌اند و برای هر دامنهٔ متنی آینده قابل بازمصرف‌اند ⑤ هیچ جدول، مسیر، schema یا واژگان گراف دانشی پیش‌ساخته نشده — فاز ۱۱ از صفر و آزاد شروع می‌کند.

---

**جمع‌بندی DoD:** زنجیرهٔ کامل فلشکارت و ویکی روی بک‌اند واقعی فاز ۱–۸ کار می‌کند؛ هیچ وابستگی به localStorage/mock/نقش فرانت/وضعیت متعلق به کلاینت وجود ندارد؛ ۵۹۲ تست سبز؛ ۵۴ بررسی قرارداد فرانت سبز؛ OpenAPI 1.5.0 هم‌اَسان با پیاده‌سازی؛ گارد فاز ۱۱ سبز.
