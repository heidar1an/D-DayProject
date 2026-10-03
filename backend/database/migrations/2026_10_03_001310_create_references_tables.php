<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۵ — References.
 *
 *   references          محتوای مرجع (sections به‌صورت jsonb) — فایل روی Media
 *   reference_assets    نگاشت Reference → Media با کلید asset (UNIQUE)
 *
 * `sections` ساختار واقعی viewer است: [{ id, title, topics: [{ id, title, content }] }]
 * و `content` هر topic هنگام نوشتن با whitelist پاک‌سازی می‌شود — همان
 * RichTextSanitizer مشترک پروژه (§29). Binary در DB ممنوع (§13).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const STATUS_CHECK = "status in ('draft','published','archived')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE "references" (
                id varchar(36) not null primary key,
                legacy_id varchar(64) null,
                slug varchar(160) not null,
                title varchar(240) not null,
                description text null,
                sections text null,
                status varchar(16) not null default 'draft',
                version integer not null default 1,
                author_admin_id varchar(36) null,
                editor_admin_id varchar(36) null,
                published_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint references_legacy_id_unique unique (legacy_id),
                constraint references_slug_unique unique (slug),
                constraint references_status_valid check (status in ('draft','published','archived')),
                constraint references_version_positive check (version >= 1),
                foreign key (author_admin_id) references admins (id) on delete set null,
                foreign key (editor_admin_id) references admins (id) on delete set null
            )
            SQL);

            DB::statement('CREATE INDEX references_status_published_at_index ON "references" (status, published_at, id)');

            DB::statement(<<<'SQL'
            CREATE TABLE reference_assets (
                id varchar(36) not null primary key,
                reference_id varchar(36) not null,
                media_id varchar(36) not null,
                key varchar(120) null,
                created_at datetime null,
                updated_at datetime null,
                constraint reference_assets_reference_id_media_id_unique unique (reference_id, media_id),
                foreign key (reference_id) references "references" (id) on delete restrict,
                foreign key (media_id) references media (id) on delete restrict
            )
            SQL);

            DB::statement('CREATE INDEX reference_assets_reference_id_index ON reference_assets (reference_id)');

            return;
        }

        Schema::create('references', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->string('slug', 160)->unique();
            $table->string('title', 240);
            $table->text('description')->nullable();
            $table->jsonb('sections')->nullable();
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->uuid('author_admin_id')->nullable();
            $table->uuid('editor_admin_id')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();

            $table->index(['status', 'published_at', 'id']);
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
            $table->foreign('editor_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('"references"', 'references_status_valid', self::STATUS_CHECK);
        $this->addCheck('"references"', 'references_version_positive', 'version >= 1');

        Schema::create('reference_assets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('reference_id');
            $table->uuid('media_id');
            $table->string('key', 120)->nullable();
            $table->timestampsTz();

            $table->unique(['reference_id', 'media_id']);
            $table->index('reference_id');
            $table->foreign('reference_id')->references('id')->on('references')->restrictOnDelete();
            $table->foreign('media_id')->references('id')->on('media')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reference_assets');
        Schema::dropIfExists('references');
    }
};
