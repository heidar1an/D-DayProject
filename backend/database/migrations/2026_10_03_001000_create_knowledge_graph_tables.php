<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۲ — Knowledge Graph.
 *
 * دو موجودیت: Node (مفهوم علمی) → Edge (رابطهٔ جهت‌دار بین دو نود).
 *
 * تصمیم‌های کلیدی:
 *   • **دامنهٔ جدا از ویکی.** `knowledge_nodes != wiki_articles` و
 *     `knowledge_edges != wiki_relations`. ارتباط با ویکی فقط یک reference
 *     اختیاری است (`wiki_article_id`، blueprint §104: `U`) — هر مقالهٔ ویکی
 *     حداکثر یک نود نماینده دارد، چون هر مقاله یک Entity است (content_type
 *     مقاله همین‌طور آن را تعیین می‌کند).
 *   • `wiki_article_id` FK روی **RESTRICT** است: حذف فیزیکی مقالهٔ دارای نود
 *     مسدود می‌شود تا هیچ نودِ بی‌ربطِ مخفی ساخته نشود (§39 — مقالهٔ نیم‌مُرده
 *     آرشیو می‌شود، نود هم با همان policy آرشیو می‌شود).
 *   • `kind` و `relation_type` عمداً **CHECK دیتابیسی ندارند** — allowlist آن‌ها
 *     از دادهٔ واقعی فرانت (`NODE_TYPES`/`RELATION_TYPES` در
 *     `src/services/knowledge/graphData.js`) در `config/knowledge.php` است و
 *     سرویس رد می‌کند؛ افزودن نوع تازه نباید migration بخواهد. برخلاف `status`
 *     که مانند ویکی CHECK دارد (سه وضعیت CMS هماهنگ با فاز ۵).
 *   • `knowledge_edges` قید `from <> to` دارد (self edge ممنوع) و
 *     `UNIQUE(from,to,relation_type)`. FKها RESTRICT — حذف نودِ دارای یال
 *     مسدود است؛ نود آرشیو می‌شود نه حذف فیزیکی (تاریخی‌سازی، §40).
 *   • `weight` عددی اختیاری بین ۰ به بالا (قدرت رابطه برای رندر ضخامت یال)؛
 *     هیچ مصرف‌کنندهٔ الگوریتمی در این فاز ندارد و صرفاً ذخیره می‌شود.
 *   • **هیچ چیز AI/Vector/Neo4j اینجا نیست.** گراف دیتابیس‌محور و deterministic
 *     است (§4).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const NODE_STATUS_CHECK = "status in ('draft','published','archived')";

    private const EDGE_WEIGHT_CHECK = 'weight IS NULL OR weight >= 0';

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('knowledge_nodes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('wiki_article_id')->nullable()->unique();
            $table->string('kind', 32);
            $table->string('label', 240);
            $table->string('status', 16)->default('draft');
            $table->timestampsTz();

            $table->index(['status', 'kind']);
            $table->foreign('wiki_article_id')->references('id')->on('wiki_articles')->restrictOnDelete();
        });
        $this->addCheck('knowledge_nodes', 'knowledge_nodes_status_valid', self::NODE_STATUS_CHECK);

        Schema::create('knowledge_edges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('from_node_id');
            $table->uuid('to_node_id');
            $table->string('relation_type', 32);
            $table->decimal('weight', 6, 2)->nullable();
            $table->timestampsTz();

            $table->unique(['from_node_id', 'to_node_id', 'relation_type']);
            $table->index(['from_node_id', 'relation_type']);
            $table->index(['to_node_id', 'relation_type']);
            $table->foreign('from_node_id')->references('id')->on('knowledge_nodes')->restrictOnDelete();
            $table->foreign('to_node_id')->references('id')->on('knowledge_nodes')->restrictOnDelete();
        });
        // self edge ممنوع — در سطح دیتابیس، نه فقط سرویس.
        $this->addCheck('knowledge_edges', 'knowledge_edges_no_self', 'from_node_id <> to_node_id');
        $this->addCheck('knowledge_edges', 'knowledge_edges_weight_valid', self::EDGE_WEIGHT_CHECK);
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_edges');
        Schema::dropIfExists('knowledge_nodes');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            self::sqliteNode(),
            self::sqliteEdge(),
        ];
    }

    private static function sqliteNode(): string
    {
        return <<<'SQL'
        CREATE TABLE knowledge_nodes (
            id varchar(36) not null primary key,
            wiki_article_id varchar(36) null,
            kind varchar(32) not null,
            label varchar(240) not null,
            status varchar(16) not null default 'draft',
            created_at datetime null,
            updated_at datetime null,
            constraint knowledge_nodes_wiki_article_id_unique unique (wiki_article_id),
            constraint knowledge_nodes_status_valid check (status in ('draft','published','archived')),
            foreign key (wiki_article_id) references wiki_articles (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteEdge(): string
    {
        return <<<'SQL'
        CREATE TABLE knowledge_edges (
            id varchar(36) not null primary key,
            from_node_id varchar(36) not null,
            to_node_id varchar(36) not null,
            relation_type varchar(32) not null,
            weight numeric(6,2) null,
            created_at datetime null,
            updated_at datetime null,
            constraint knowledge_edges_from_node_id_to_node_id_relation_type_unique unique (from_node_id, to_node_id, relation_type),
            constraint knowledge_edges_no_self check (from_node_id <> to_node_id),
            constraint knowledge_edges_weight_valid check (weight is null or weight >= 0),
            foreign key (from_node_id) references knowledge_nodes (id) on delete restrict,
            foreign key (to_node_id) references knowledge_nodes (id) on delete restrict
        )
        SQL;
    }
};
