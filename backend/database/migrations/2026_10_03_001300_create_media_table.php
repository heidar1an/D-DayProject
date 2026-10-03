<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۵ — Media Core.
 *
 * تصمیم‌های کلیدی:
 *   • Binary هرگز داخل PostgreSQL ذخیره نمی‌شود؛ `key` مسیر منطقی روی دیسک است
 *     و مسیرش از ورودی کاربر ساخته نمی‌شود (random UUID + تاریخ) تا path
 *     traversal در ریشه بی‌معنا باشد (§8).
 *   • `UNIQUE(disk, key)` — کلید جای‌گذاری یکتاست؛ `sha256` ایندکس دارد تا dedup
 *     و Migration بعداً ممکن باشد (§9). Checksum فقط سمت سرور محاسبه می‌شود.
 *   • مالکیت: کاربر یا ادمین یا محتوای سیستمی (هر دو NULL). آپلود مصرف‌کنندهٔ
 *     واقعی‌اش پنل محتواست؛ آپلود دانشجو در این فاز مصرف‌کننده ندارد و ساخته نشد.
 *   • حذف = آرشیو (§63)؛ DELETE سخت فقط برای رکورد بدون فایل.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE media (
                id varchar(36) not null primary key,
                owner_user_id varchar(36) null,
                owner_admin_id varchar(36) null,
                disk varchar(32) not null,
                key varchar(512) not null,
                kind varchar(16) not null,
                mime varchar(128) not null,
                size_bytes integer not null,
                sha256 char(64) not null,
                visibility varchar(16) not null,
                status varchar(16) not null default 'active',
                original_name varchar(255) null,
                metadata text null,
                created_at datetime null,
                updated_at datetime null,
                constraint media_disk_key_unique unique (disk, key),
                constraint media_kind_valid check (kind in ('image','document','video','model3d')),
                constraint media_visibility_valid check (visibility in ('public','private')),
                constraint media_status_valid check (status in ('active','archived')),
                constraint media_size_non_negative check (size_bytes >= 0),
                foreign key (owner_user_id) references users (id) on delete set null,
                foreign key (owner_admin_id) references admins (id) on delete set null
            )
            SQL);

            DB::statement('CREATE INDEX media_sha256_index ON media (sha256)');
            DB::statement('CREATE INDEX media_owner_admin_id_index ON media (owner_admin_id)');
            DB::statement('CREATE INDEX media_visibility_status_index ON media (visibility, status)');

            return;
        }

        Schema::create('media', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('owner_user_id')->nullable();
            $table->uuid('owner_admin_id')->nullable();
            $table->string('disk', 32);
            $table->string('key', 512);
            $table->string('kind', 16);
            $table->string('mime', 128);
            $table->unsignedBigInteger('size_bytes');
            $table->char('sha256', 64);
            $table->string('visibility', 16);
            $table->string('status', 16)->default('active');
            $table->string('original_name', 255)->nullable();
            $table->json('metadata')->nullable();
            $table->timestampsTz();

            $table->unique(['disk', 'key']);
            $table->index('sha256');
            $table->index('owner_admin_id');
            $table->index(['visibility', 'status']);
            $table->foreign('owner_user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('owner_admin_id')->references('id')->on('admins')->nullOnDelete();
        });

        $this->addCheck('media', 'media_kind_valid', "kind in ('image','document','video','model3d')");
        $this->addCheck('media', 'media_visibility_valid', "visibility in ('public','private')");
        $this->addCheck('media', 'media_status_valid', "status in ('active','archived')");
        $this->addCheck('media', 'media_size_non_negative', 'size_bytes >= 0');
    }

    public function down(): void
    {
        Schema::dropIfExists('media');
    }
};
