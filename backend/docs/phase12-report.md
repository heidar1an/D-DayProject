# گزارش فاز ۱۲ — Knowledge Graph (گراف دانش)

تاریخ: ۲۰۲۶-۱۰-۰۳ · OpenAPI v1 = **1.6.0** · مسیرها = **۸۴** · Schemaها = **۵۲**

وضعیت کلی: **PHASE 12 (KNOWLEDGE GRAPH) COMPLETE — Implemented + Verified.** تمام معیارهای Definition of Done (§41) با اجرای واقعی تست تأیید شده‌اند. تفکیک Designed / Implemented / Verified در هر بخش رعایت شده است.

**اعداد تأییدشده:**
- سوییت بک‌اند (SQLite): **۶۵۲ passed / ۲ skipped / ۰ failed** (۵٬۲۴۰ assertion) — ۵۸ تست تازهٔ فاز ۱۲ در ۴ فایل.
- سوییت روی **PostgreSQL واقعی** (`verify-on-pg.sh`، خوشهٔ موقت /tmp): **۶۵۲ passed / ۰ failed**؛ `migrate:fresh → rollback → migrate` هر سه سبز. **هیچ باگ PG-only در این فاز دیده نشد.**
- Pint: ۴۱۲ فایل PASS. پل فرانت: `v1-frontend-contract.mjs` = **۶۲ بررسی سبز / ۰ شکست** (۷ پل).
- قرارداد بک‌اند: `ApiV1ContractTest` دوطرفه سبز + گارد «ممنوع-مسیر فاز ۱۳» + محافظ معکوس مسیرهای گراف.

---

### Architecture — دو دامنهٔ جداست

**Implemented + Verified.** `knowledge_nodes != wiki_articles` و `knowledge_edges != wiki_relations` (§1/§2). ارتباط با ویکی فقط یک reference اختیاری `wiki_article_id` (unique — blueprint §104؛ هر مقالهٔ ویکی حداکثر یک نود نماینده دارد، سازگار با مدل محتوای فعلی که هر مقاله یک Entity است). هیچ سرویس ویکی از جدول گراف نمی‌نویسد و هیچ سرویس گرافی جدول ویکی را تغییر نمی‌دهد (§17). FK نود→مقاله روی **RESTRICT** است: حذف فیزیکی مقالهٔ دارای نود مسدود می‌شود تا هیچ نود یتیمِ مخفی ساخته نشود (§39 — تست سبز).

### Database

**Implemented + Verified.** مهاجرت دوگانهٔ PG/SQLite (`2026_10_03_001000`):
- `knowledge_nodes`: UUID PK · `wiki_article_id? U` · `kind` · `label` · `status ∈ {draft,published,archived}` (CHECK دیتابیسی — هماهنگ با CMS فاز ۵) · ایندکس `(status, kind)`.
- `knowledge_edges`: `UNIQUE(from,to,relation_type)` · CHECK `from <> to` (self edge در خود دیتابیس رد می‌شود — تست سبز) · `weight numeric(6,2) NULL` با CHECK `>= 0` · FK هر دو سر RESTRICT · ایندکس‌های `(from_node_id, relation_type)` و `(to_node_id, relation_type)` برای پیمایش.
- `kind`/`relation_type` عمداً CHECK دیتابیسی ندارند: allowlist در `config/knowledge.php` است و افزودن نوع تازه migration نمی‌خواهد (همان الگوی `wiki_relations.kind`).
- **هیچ جدول/شِما/واژگان AI/Vector/Neo4j وجود ندارد** — گراف دیتابیس‌محور و deterministic است (§4).

### Node / Edge — دادهٔ واقعی، نه حدس

**Implemented + Verified.** لیست نهایی از دادهٔ واقعی فرانت استخراج شد، نه از مثال پرامپت:
- **۱۱ kind** عیناً از `NODE_TYPES` در `src/services/knowledge/graphData.js`: disease, concept, anatomy, process, pathway, drug, cell, molecule, microorganism, finding, labTest.
- **۱۵ relation_type** عیناً از `RELATION_TYPES` همان فایل: part_of, contains, located_in, produces, regulates, activates, inhibits, causes, leads_to, associated_with, participates_in, targets, treated_by, measured_by, related_to.
- یال **جهت‌دار** است؛ `A —causes→ B ≠ B —causes→ A` (§12). دو رابطهٔ متفاوت بین همان دو نود مجاز است (تست سبز).
- وضعیت‌ها draft/published/archived (سه‌وضیتی CMS؛ `active` جدا معرفی نشد تا واژگان دوم ساخته نشود — §8).

### Traversal — کراندار، قطعی، بدون N+1

**Implemented + Verified.** BFS سطح‌به‌سطح با «نودهای دیده‌شده» (cycle هرگز حلقهٔ بی‌نهایت نمی‌سازد — تست A→B→C→A سبز)؛ **بدون recursive CTE** (برای depth ≤ ۳ ساده‌تر و قابل‌پیش‌بینی‌تر — §19). نود غیرمنتشره نه همسایه می‌شود نه گذرگاه، و یالِ به آن در هیچ پاسخی نمی‌آید («یادیت عمومی» ممنوع — §40، تست سبز). سقف‌ها همه از config: `max_depth=3`، `max_nodes=200`، `max_edges=500`؛ ترتیب پیمایش قطعی است (created_at/id/yال‌های مرتب) تا کلاینت هر بار زیرگراف متفاوت نبیند. `depth` خارج از ۰–۳ ⇒ ۴۲۲؛ پارامتر ناشناخته (از جمله `limit`) ⇒ ۴۰۰.

### Performance (§36)

**Measured on real PostgreSQL.** اسکریپت تکرارپذیر: `scripts/measure-phase12.php` (فقط روی دیتابیس `*perf*` — گارد دست‌نزستن به دادهٔ واقعی). جدول اندازه‌گیری‌شده (خوشهٔ موقت PG 17، CACHE_STORE=array، مسیر سردِ کش):

| nodes | depth 1 | depth 2 | depth 3 |
|---|---|---|---|
| 1 | 6.4ms / 3q | 1.3ms / 3q | 1.6ms / 3q |
| 10 | 2.2ms / 5q | 3.0ms / 7q | 3.9ms / 9q |
| 50 | 1.8ms / 5q | 2.1ms / 7q | 2.7ms / 9q |
| 100 | 1.9ms / 5q | 2.3ms / 7q | 2.7ms / 9q |
| 200 | 1.8ms / 5q | 2.2ms / 7q | 2.9ms / 9q |
| whole (بدون ریشه) | 7.9ms / **2q** (۲۰۰ نود، ۳۹۷ یال) | | |

**سنجهٔ کلیدی: تعداد کوئری تابع عمق است، نه اندازهٔ گراف** (ریشه + 2×depth + نودها + eager مقاله) — اثبات بدون-N+1 در تست (`KnowledgePerformanceTest` با dataProvider ۱۰/۵۰/۱۰۰/۲۰۰ سقف کوئری را قفل می‌کند). نکتهٔ صادقانه: توپولوژی دادهٔ سنجش خطی-درختی است (i→i+1، i→i+2)؛ یعنی stress اصلی روی واکش‌های سطح است، نه همسایگی بالا-درجه. اگر مدل داده به hubهای پراکنده برسد، دوباره سنجش لازم است.

### Public API

**Implemented + Verified.** همه با envelope استاندارد و throttle نام‌دار `knowledge_read` (۲۴۰/min):
- `GET /api/v1/knowledge/graph` — بدون `node` ⇒ کل گراف (۲ کوئری)؛ با `node` (UUID نود **یا slug مقالهٔ ویکیِ منتشرشدهٔ متصل** — مثال `?node=e-coli` پشتیبانی می‌شود) ⇒ BFS. فیلترهای `kind`/`relation` فقط allowlist؛ فیلتر نود یالِ یتیم را هم حذف می‌کند (تست سبز). `meta: {root, depth}`.
- `GET /api/v1/knowledge/nodes/{id}` — نود + همسایه‌های برچسب‌دار با `direction: out|in` (هم‌شکل `getNode()` فرانت).
- `GET /api/v1/knowledge/nodes/{id}/neighbors`.
- `whereUuid` روی `{id}`؛ UUID نامعتبر ⇒ ۴۰۴ نه ۵۰۰ (تلهٔ PG 22P02). نود draft/archived و ناشناخته هر سه ۴۰۴ — بدون افشای وجود.

### Admin API — فقط برای نیاز واقعی

**Implemented + Verified.** نود: `GET/POST /admin/knowledge/nodes`، `GET/PATCH/DELETE .../{id}`، `POST .../{id}/publish|archive`. یال: `POST /admin/knowledge/edges` (پاسخ شامل `id` برای حذف)، `DELETE /admin/knowledge/edges/{id}`. فهرست پنل همهٔ وضعیت‌ها را می‌بیند با فیلتر/q/sort از allowlist (پارامتر ناشناخته ⇒ ۴۰۰). **UI جدید ساخته نشد** (§24) — این‌ها قرارداد سمت سرور برای مدیریت محتوای گراف‌اند، هم‌الگوی پنل ویکی فاز ۱۰.

### Permission / Authorization

**Implemented + Verified.** کلید `knowledge.*` **اختراع نشد** — همان قاعدهٔ فاز ۱۰. نگاشت روی کلیدهای واقعی RBAC پنل: خواندن `articles.read`، ساخت `articles.create`، ویرایش/یال `articles.update`، انتشار/آرشیو `articles.publish`، حذف نود `articles.delete`. deny-by-default با `api.admin + api.can` + origin/CSRF روی نوشتن‌ها (ادمین بدون نقش روی همهٔ مسیرها ۴۰۳ — تست سبز؛ editor حذف نود ندارد — تست سبز). Role جدید ساخته نشد. Policyهای `KnowledgeNodePolicy`/`KnowledgeEdgePolicy` لایهٔ دوم دفاعی‌اند (view فقط published / هر دو سر منتشر).

### Validation / مرز اعتماد

**Implemented + Verified.** FormRequestهای جدا (`KnowledgeGraphRequest` + ۴ ادمینی) روی `ApiFormRequest`. `status` هرگز از بدنه خوانده نمی‌شود (mass-assignment تلاش ⇒ همچنان draft — تست سبز). `label` با `RichTextSanitizer::toPlainText` پاک‌سازی می‌شود (Stored XSS — تست `<script>` سبز) و سقف طول دارد. پیوند مقاله: ناموجود ⇒ ۴۲۲ `WIKI_ARTICLE_NOT_FOUND`، آرشیو ⇒ ۴۲۲، مقالهٔ دارای نود ⇒ ۴۰۹ `ARTICLE_ALREADY_LINKED` (unique دیتابیسی هم پشت آن است). یال: نود ناموجود ⇒ ۴۲۲، self edge ⇒ ۴۲۲ + CHECK دیتابیس، تکرار ⇒ ۴۰۹ `EDGE_ALREADY_EXISTS`، وزن خارج از ۰–۱۰۰ ⇒ ۴۲۲. حذف نودِ دارای یال ⇒ ۴۰۹ `NODE_HAS_EDGES` (آرشیو به‌جای حذف). Mutations در `DB::transaction` و پس از هرکدام نسخهٔ کش گراف bump می‌شود (تست invalidate سبز).

### Caching (§34)

**Implemented + Verified.** کش shared فقط برای پاسخ‌های عمومی (هیچ دادهٔ کاربر-ویژه‌ای در گراف عمومی وجود دارد). کلید = `knowledge:graph:v{نسخهٔ جهانی}:{hash(node|depth|kind|relation)}` — همهٔ پارامترهای مؤثر در کلیدند؛ هر mutation نسخه را بالا می‌برد ⇒ invalidate فوری؛ TTL سقف مطلق کهنگی (۶۰ ثانیه).

### OpenAPI / Contract

**Implemented + Verified.** `scripts/build-openapi-v1-phase12.mjs` (idempotent، الگوی فاز ۹–۱۰): نسخهٔ سند 1.5.0 → **1.6.0**، **۹ مسیر** تازه / **۵ schema** تازه (`KnowledgeNode`, `KnowledgeEdge`, `KnowledgeNeighbor`, `KnowledgeGraphMeta`, `AdminKnowledgeNode`) + tag `knowledge`. `ApiV1ContractTest` دوطرفه سبز؛ گارد ممنوع-مسیر حالا `knowledge` را مجاز و دامنه‌های فاز ۱۳+ (Green Path/League/payment/…) را می‌بندد + محافظ معکوس مسیرهای گراف.

### Frontend Compatibility (§38)

**Implemented (پل) — Verified (قرارداد). مطابق الگوی فازهای قبل، سوییچ UI انجام نشد.** پل تازه: `src/services/knowledge/knowledgeV1.js` روی `v1Request` (نگاشت `from/to/relation` ↔ `source/target/type`) با endpointهای graph/node/neighbors. `v1-frontend-contract.mjs` توسعه یافت: ۷ پل، CONSUMED برای ۴ schema تازه، FORBIDDEN (`status`/`wiki_article_id` در نود عمومی، `id` در یال عمومی) و NESTED تازه ⇒ **۶۲ بررسی سبز**. UI گراف هنوز از `graphData.js`/`knowledgeService.js` موک می‌خواند؛ cutover اتمی و خارج از محدودهٔ این فاز. پل فیلدهای نمایشی موک (courses/description/importance/…) را **از خودش نمی‌سازد** (null می‌دهد) — ساخت آن‌ها به فاز محتوای گراف تعلق دارد، نه این فاز.

### Mock Seed / Canonicalization (§31/§32)

**Policy: import انجام نشد — عمداً.** دادهٔ `graphData.js` (۶۴ نود/حدود ۱۵۰ یال، محور «دیابت») محتوای دموی محصول است، نه دادهٔ کانونی تأییدشده. بدون crosswalk مقاله (هیچ مقالهٔ ویکی با slug متناظر موجود نیست) و بدون منطق merge مجاز (§32: خودسرانه merge نکن)، ایمپورت یعنی ساخت دادهٔ دروغین. nodeها با `wiki_article_id = null` فقط از مسیر پنل/دستور ساخت می‌شوند. اگر روزی ایمپورت لازم شد: slug→article crosswalk + duplicate check + orphan detection الزامی است — و زیرساخت دیتابیس (uniqueها/CHECKها) همین حالا از دادهٔ خراب جلوگیری می‌کند.

---

## Final Audit (§44)

1. **Files Created (بک‌اند، ۲۱):** migration `2026_10_03_001000` · models `KnowledgeNode`, `KnowledgeEdge` · services `Knowledge/KnowledgeGraphService|KnowledgeNodeService|KnowledgeEdgeService|KnowledgeQueryService` · policies ۲ · requests ۵ (`KnowledgeGraphRequest` + `Admin/{StoreKnowledgeNode,UpdateKnowledgeNode,StoreKnowledgeEdge,AdminListKnowledgeNodes}Request`) · resources ۳ (`KnowledgeNodeResource`, `KnowledgeEdgeResource`, `AdminKnowledgeNodeResource`) · controllers ۲ (`KnowledgeGraphController`, `Admin/AdminKnowledgeController`) · provider `KnowledgeServiceProvider` · config `knowledge.php` · scripts `build-openapi-v1-phase12.mjs`, `measure-phase12.php` · tests ۴ (`BuildsKnowledge` trait + `KnowledgeGraphTest` ۲۶ · `KnowledgeAdminTest` ۲۴ · `KnowledgePerformanceTest` ۶+۲ providers). **فرانت:** `src/services/knowledge/knowledgeV1.js`.
2. **Files Modified (۷):** `routes/api.php` · `bootstrap/providers.php` · `tests/Feature/ApiV1ContractTest.php` · `docs/openapi.v1.json` · `scripts/v1-frontend-contract.mjs` · (تست‌های فازهای قبل دست نخوردند).
3. **Migrations:** ۱ فایل، ۲ جدول (nodes/edges).
4. **Models:** ۲ (`KnowledgeNode`, `KnowledgeEdge`؛ `$fillable = []`).
5. **Endpoints:** ۱۲ مسیر / ۹ path (۳ عمومی + ۹ پنلی… دقیق: ۳ عمومی، ۹ پنلی = ۱۲ route).
6. **Permissions:** هیچ کلید تازه‌ای ساخته نشد؛ فقط `articles.read/create/update/publish/delete` موجود.
7. **Tests Added:** ۵۸ تست (۲۶۷ assertion) در ۴ فایل + گاردهای قرارداد.
8. **Tests Passed:** SQLite ۶۵۲/۶۵۲ (۵٬۲۴۰ assertion) · **PG واقعی ۶۵۲/۶۵۲** · Pint PASS · پل فرانت ۶۲ سبز.
9. **Security Findings:** یافتهٔ باز ندارد. IDOR: نود خصوصی ۴۰۴ (نه ۴۰۳)؛ no public write surface (تست)؛ unbounded traversal مسدود (depth/نود/یال سقف سروری + ۴۲۲/۴۰۰)؛ draft/draft-article leakage مسدود (تست)؛ stored XSS پاک‌سازی (تست)؛ rate limit نام‌دار جدا.
10. **API Contract Changes:** OpenAPI 1.6.0 — ۹ path / ۵ schema تازه؛ گارد ممنوع-مسیر به‌روز شد (`knowledge` از فهرست ممنوع خارج، فاز ۱۳+ بسته).
11. **Frontend Compatibility:** پل آماده و قفل‌شده (۶۲ سبز)؛ UI سوییچ نشده — cutover اتمی، فاز جدا.
12. **Remaining TODOs:** سوییچ UI گراف به v1 (cutover اتمی) · محتوای واقعی گراف (ساخت نود/یال توسط محتوا + crosswalk مقاله) · Green Path (فاز ۱۳) از `prerequisites`-مانندِ یال‌ها می‌تواند تغذیه شود — هیچ چیز پیش‌ساخته نشد.
13. **Known Limitations:** فهرست پنلی یال وجود ندارد (id از پاسخ ساخت می‌آید — همان الگوی relations ویکی) · `aliases`/`courses`/`description` نود در این فاز مدل نشدند (§32: بدون UI و نیاز واقعی feature نساز) · سنجش کارایی با توپولوژی خطی-درختی انجام شد (بند Performance) · `weight` ذخیره می‌شود ولی مصرف‌کنندهٔ الگوریتمی در این فاز ندارد.
14. **Scope Violations:** هیچ. AI/Vector/Neo4j/Elasticsearch/learning-path/progress گراف ساخته نشد؛ «فاز ۱۲ = فقط Knowledge Graph» با گارد خودکار `ApiV1ContractTest` قفل است.
