<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۶ — Articles.
 *
 *   article_categories   دستهٔ تخت (قرارداد فرانت دستهٔ سلسله‌مراتبی ندارد)
 *   articles             lifecycle واقعی draft/published/archived + version
 *   article_bookmarks    pivot کاربر↔مقاله — CASCADE (تنها استثنای مجاز پروژه)
 *
 * `body` متن پاک‌سازی‌شده (RichTextSanitizer در سرویس) و `status`/`published_at`/
 * `author_admin_id` هرگز از بدنهٔ درخواست نمی‌آیند (Mass Assignment بسته).
 * پیش‌نویس در مسیر عمومی ۴۰۴ است تا وجودش افشا نشود (§26).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const STATUS_CHECK = "status in ('draft','published','archived')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE article_categories (
                id varchar(36) not null primary key,
                legacy_id varchar(64) null,
                slug varchar(120) not null,
                name varchar(160) not null,
                sort_order integer not null default 0,
                status varchar(16) not null default 'draft',
                created_at datetime null,
                updated_at datetime null,
                constraint article_categories_legacy_id_unique unique (legacy_id),
                constraint article_categories_slug_unique unique (slug),
                constraint article_categories_status_valid check (status in ('draft','published','archived'))
            )
            SQL);

            DB::statement(<<<'SQL'
            CREATE TABLE articles (
                id varchar(36) not null primary key,
                legacy_id varchar(64) null,
                category_id varchar(36) null,
                slug varchar(160) not null,
                title varchar(240) not null,
                summary text null,
                body text not null,
                status varchar(16) not null default 'draft',
                version integer not null default 1,
                author_admin_id varchar(36) null,
                editor_admin_id varchar(36) null,
                published_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint articles_legacy_id_unique unique (legacy_id),
                constraint articles_slug_unique unique (slug),
                constraint articles_status_valid check (status in ('draft','published','archived')),
                constraint articles_version_positive check (version >= 1),
                foreign key (category_id) references article_categories (id) on delete set null,
                foreign key (author_admin_id) references admins (id) on delete set null,
                foreign key (editor_admin_id) references admins (id) on delete set null
            )
            SQL);

            DB::statement('CREATE INDEX articles_status_published_at_index ON articles (status, published_at, id)');
            DB::statement('CREATE INDEX articles_category_id_status_index ON articles (category_id, status)');

            DB::statement(<<<'SQL'
            CREATE TABLE article_bookmarks (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                article_id varchar(36) not null,
                created_at datetime null,
                updated_at datetime null,
                constraint article_bookmarks_user_id_article_id_unique unique (user_id, article_id),
                foreign key (user_id) references users (id) on delete cascade,
                foreign key (article_id) references articles (id) on delete cascade
            )
            SQL);

            DB::statement('CREATE INDEX article_bookmarks_user_id_created_at_index ON article_bookmarks (user_id, created_at)');

            return;
        }

        Schema::create('article_categories', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->string('slug', 120)->unique();
            $table->string('name', 160);
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status', 16)->default('draft');
            $table->timestampsTz();
        });
        $this->addCheck('article_categories', 'article_categories_status_valid', self::STATUS_CHECK);

        Schema::create('articles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->uuid('category_id')->nullable();
            $table->string('slug', 160)->unique();
            $table->string('title', 240);
            $table->text('summary')->nullable();
            $table->text('body');
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->uuid('author_admin_id')->nullable();
            $table->uuid('editor_admin_id')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();

            $table->index(['status', 'published_at', 'id']);
            $table->index(['category_id', 'status']);
            $table->foreign('category_id')->references('id')->on('article_categories')->nullOnDelete();
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
            $table->foreign('editor_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('articles', 'articles_status_valid', self::STATUS_CHECK);
        $this->addCheck('articles', 'articles_version_positive', 'version >= 1');

        Schema::create('article_bookmarks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('article_id');
            $table->timestampsTz();

            $table->unique(['user_id', 'article_id']);
            $table->index(['user_id', 'created_at']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('article_id')->references('id')->on('articles')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('article_bookmarks');
        Schema::dropIfExists('articles');
        Schema::dropIfExists('article_categories');
    }
};
