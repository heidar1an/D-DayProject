<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۰ — ویکی (دانشنامهٔ پزشکی).
 *
 * چهار موجودیت: Category → Article → Relation → Bookmark.
 *
 * تصمیم‌های کلیدی:
 *   • **هیچ جدول Knowledge Graph اینجا ساخته نمی‌شود.** `knowledge_nodes`/
 *     `knowledge_edges` فاز ۱۱ است. طراحی فقط طوری است که فاز ۱۱ بتواند با
 *     `wiki_articles.id` به گراف وصل شود (Blueprint §4).
 *   • `wiki_categories.parent_id` **خودارجاع** است و FK آن بیرون از
 *     `Schema::create` اضافه می‌شود: لاراول `->primary()` را به‌شکل
 *     `alter table … add primary key` و پس از همهٔ FKهای همان create کامپایل
 *     می‌کند ⇒ روی PostgreSQL خطای `42830 there is no unique constraint matching
 *     given keys`. روی SQLite دیده نمی‌شود چون جدول با یک دستور خام ساخته می‌شود.
 *   • `wiki_relations` قید `from <> to` دارد (self relation ممنوع) و
 *     `UNIQUE(from,to,kind)`. حذف مقاله `RESTRICT` است — محتوا آرشیو می‌شود، نه
 *     حذف فیزیکی؛ پس رابطه‌ها هم یتیم نمی‌شوند.
 *   • `wiki_bookmarks` یک pivot کاربر↔مقاله است و CASCADE دارد (تنها جایی که
 *     CASCADE مجاز است)، با `UNIQUE(user_id, article_id)` تا race تکراری‌سازی
 *     را در سطح دیتابیس ببندد.
 *   • `version` روی مقاله برای optimistic lock آیندهٔ ویرایش؛ در این فاز فقط
 *     افزایش و مقایسه می‌شود.
 *   • `body` متن **پاک‌سازی‌شده** است (whitelist سمت سرور). `key_facts` و
 *     `keywords` آرایه‌های jsonb برای رندر/جست‌وجو هستند.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const ARTICLE_STATUS_CHECK = "status in ('draft','published','archived')";

    private const CATEGORY_STATUS_CHECK = "status in ('draft','published','archived')";

    private const DIFFICULTY_CHECK = "difficulty in ('basic','intermediate','advanced')";

    private const CONTENT_TYPE_CHECK = "content_type in ('concept','disease','drug','anatomy','pathway','labTest','microorganism','sign')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('wiki_categories', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->uuid('parent_id')->nullable();
            $table->string('slug', 120)->unique();
            $table->string('name', 160);
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status', 16)->default('draft');
            $table->timestampsTz();

            $table->index(['parent_id', 'status', 'sort_order']);
            $table->index(['status', 'sort_order']);
        });

        // FK خودارجاع — بیرون از create؛ دلیل در docblock بالای فایل.
        Schema::table('wiki_categories', function (Blueprint $table): void {
            $table->foreign('parent_id')->references('id')->on('wiki_categories')->restrictOnDelete();
        });
        $this->addCheck('wiki_categories', 'wiki_categories_status_valid', self::CATEGORY_STATUS_CHECK);
        $this->addCheck('wiki_categories', 'wiki_categories_no_self_parent', 'parent_id IS NULL OR parent_id <> id');

        Schema::create('wiki_articles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->uuid('category_id')->nullable();
            $table->string('slug', 160)->unique();
            $table->string('title', 240);
            $table->text('summary')->nullable();
            $table->text('body');
            $table->string('subject', 40)->nullable();
            $table->string('content_type', 24)->nullable();
            $table->string('difficulty', 16)->nullable();
            $table->json('key_facts')->nullable();
            $table->json('keywords')->nullable();
            $table->unsignedSmallInteger('read_minutes')->nullable();
            $table->unsignedInteger('popularity')->default(0);
            $table->unsignedInteger('view_count')->default(0);
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->uuid('author_admin_id')->nullable();
            $table->uuid('editor_admin_id')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();

            $table->index(['status', 'published_at', 'id']);
            $table->index(['subject', 'status']);
            $table->index(['category_id', 'status']);
            $table->index(['content_type', 'status']);
            $table->index(['status', 'popularity']);
            $table->foreign('category_id')->references('id')->on('wiki_categories')->nullOnDelete();
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
            $table->foreign('editor_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('wiki_articles', 'wiki_articles_status_valid', self::ARTICLE_STATUS_CHECK);
        $this->addCheck('wiki_articles', 'wiki_articles_version_positive', 'version >= 1');
        $this->addCheck('wiki_articles', 'wiki_articles_difficulty_valid', self::DIFFICULTY_CHECK);
        $this->addCheck('wiki_articles', 'wiki_articles_content_type_valid', self::CONTENT_TYPE_CHECK);
        $this->addCheck('wiki_articles', 'wiki_articles_read_minutes_positive', 'read_minutes IS NULL OR read_minutes >= 1');

        Schema::create('wiki_relations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('from_article_id');
            $table->uuid('to_article_id');
            $table->string('kind', 32);
            $table->timestampsTz();

            $table->unique(['from_article_id', 'to_article_id', 'kind']);
            $table->index(['from_article_id', 'kind']);
            $table->index(['to_article_id', 'kind']);
            $table->foreign('from_article_id')->references('id')->on('wiki_articles')->restrictOnDelete();
            $table->foreign('to_article_id')->references('id')->on('wiki_articles')->restrictOnDelete();
        });
        // self relation ممنوع — در سطح دیتابیس، نه فقط سرویس.
        $this->addCheck('wiki_relations', 'wiki_relations_no_self', 'from_article_id <> to_article_id');

        Schema::create('wiki_bookmarks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('article_id');
            $table->timestampsTz();

            $table->unique(['user_id', 'article_id']);
            $table->index(['user_id', 'created_at']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('article_id')->references('id')->on('wiki_articles')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wiki_bookmarks');
        Schema::dropIfExists('wiki_relations');
        Schema::dropIfExists('wiki_articles');
        Schema::dropIfExists('wiki_categories');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            self::sqliteCategory(),
            self::sqliteArticle(),
            self::sqliteRelation(),
            self::sqliteBookmark(),
        ];
    }

    private static function sqliteCategory(): string
    {
        return <<<'SQL'
        CREATE TABLE wiki_categories (
            id varchar(36) not null primary key,
            legacy_id varchar(64) null,
            parent_id varchar(36) null,
            slug varchar(120) not null,
            name varchar(160) not null,
            description text null,
            sort_order integer not null default 0,
            status varchar(16) not null default 'draft',
            created_at datetime null,
            updated_at datetime null,
            constraint wiki_categories_legacy_id_unique unique (legacy_id),
            constraint wiki_categories_slug_unique unique (slug),
            constraint wiki_categories_status_valid check (status in ('draft','published','archived')),
            constraint wiki_categories_no_self_parent check (parent_id is null or parent_id <> id),
            foreign key (parent_id) references wiki_categories (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteArticle(): string
    {
        return <<<'SQL'
        CREATE TABLE wiki_articles (
            id varchar(36) not null primary key,
            legacy_id varchar(64) null,
            category_id varchar(36) null,
            slug varchar(160) not null,
            title varchar(240) not null,
            summary text null,
            body text not null,
            subject varchar(40) null,
            content_type varchar(24) null,
            difficulty varchar(16) null,
            key_facts text null,
            keywords text null,
            read_minutes integer null,
            popularity integer not null default 0,
            view_count integer not null default 0,
            status varchar(16) not null default 'draft',
            version integer not null default 1,
            author_admin_id varchar(36) null,
            editor_admin_id varchar(36) null,
            published_at datetime null,
            created_at datetime null,
            updated_at datetime null,
            constraint wiki_articles_legacy_id_unique unique (legacy_id),
            constraint wiki_articles_slug_unique unique (slug),
            constraint wiki_articles_status_valid check (status in ('draft','published','archived')),
            constraint wiki_articles_version_positive check (version >= 1),
            constraint wiki_articles_difficulty_valid check (difficulty in ('basic','intermediate','advanced')),
            constraint wiki_articles_content_type_valid check (content_type in ('concept','disease','drug','anatomy','pathway','labTest','microorganism','sign')),
            constraint wiki_articles_read_minutes_positive check (read_minutes is null or read_minutes >= 1),
            foreign key (category_id) references wiki_categories (id) on delete set null,
            foreign key (author_admin_id) references admins (id) on delete set null,
            foreign key (editor_admin_id) references admins (id) on delete set null
        )
        SQL;
    }

    private static function sqliteRelation(): string
    {
        return <<<'SQL'
        CREATE TABLE wiki_relations (
            id varchar(36) not null primary key,
            from_article_id varchar(36) not null,
            to_article_id varchar(36) not null,
            kind varchar(32) not null,
            created_at datetime null,
            updated_at datetime null,
            constraint wiki_relations_from_article_id_to_article_id_kind_unique unique (from_article_id, to_article_id, kind),
            constraint wiki_relations_no_self check (from_article_id <> to_article_id),
            foreign key (from_article_id) references wiki_articles (id) on delete restrict,
            foreign key (to_article_id) references wiki_articles (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteBookmark(): string
    {
        return <<<'SQL'
        CREATE TABLE wiki_bookmarks (
            id varchar(36) not null primary key,
            user_id varchar(36) not null,
            article_id varchar(36) not null,
            created_at datetime null,
            updated_at datetime null,
            constraint wiki_bookmarks_user_id_article_id_unique unique (user_id, article_id),
            foreign key (user_id) references users (id) on delete cascade,
            foreign key (article_id) references wiki_articles (id) on delete cascade
        )
        SQL;
    }
};
