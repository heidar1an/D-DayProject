<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۵ — Anatomy Assets.
 *
 * نگاشت part_key → Media؛ مدل 3D روی Object Storage می‌ماند و اینجا فقط
 * متادیتا و قانون دسترسی است (§17). `part_key` یکتاست و از دادهٔ واقعی
 * viewer (Z-Anatomy categories) تغذیه می‌شود. `subject_id` به `subjects`
 * موجود (فاز ۴) وصل است، NULL = ساختار عمومی.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const STATUS_CHECK = "status in ('draft','published','archived')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE anatomy_assets (
                id varchar(36) not null primary key,
                subject_id varchar(36) null,
                media_id varchar(36) not null,
                part_key varchar(160) not null,
                label varchar(240) null,
                category varchar(32) null,
                status varchar(16) not null default 'draft',
                version integer not null default 1,
                author_admin_id varchar(36) null,
                editor_admin_id varchar(36) null,
                published_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint anatomy_assets_part_key_unique unique (part_key),
                constraint anatomy_assets_status_valid check (status in ('draft','published','archived')),
                constraint anatomy_assets_version_positive check (version >= 1),
                foreign key (subject_id) references subjects (id) on delete set null,
                foreign key (media_id) references media (id) on delete restrict,
                foreign key (author_admin_id) references admins (id) on delete set null,
                foreign key (editor_admin_id) references admins (id) on delete set null
            )
            SQL);

            DB::statement('CREATE INDEX anatomy_assets_status_index ON anatomy_assets (status)');

            return;
        }

        Schema::create('anatomy_assets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('subject_id')->nullable();
            $table->uuid('media_id');
            $table->string('part_key', 160)->unique();
            $table->string('label', 240)->nullable();
            $table->string('category', 32)->nullable();
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->uuid('author_admin_id')->nullable();
            $table->uuid('editor_admin_id')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();

            $table->index('status');
            $table->foreign('subject_id')->references('id')->on('subjects')->nullOnDelete();
            $table->foreign('media_id')->references('id')->on('media')->restrictOnDelete();
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
            $table->foreign('editor_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('anatomy_assets', 'anatomy_assets_status_valid', self::STATUS_CHECK);
        $this->addCheck('anatomy_assets', 'anatomy_assets_version_positive', 'version >= 1');
    }

    public function down(): void
    {
        Schema::dropIfExists('anatomy_assets');
    }
};
