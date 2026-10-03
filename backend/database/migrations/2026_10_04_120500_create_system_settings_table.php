<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۲۰ — System settings.
 *
 *   `key`     فقط از allowlist `config/settings.php` قابل نوشتن است.
 *   `is_secret`  مقدار کلید محرمانه رمزنگاری‌شده ذخیره می‌شود و هرگز در پاسخ
 *             خوانده نمی‌شود (§80). ⚠️ چرخش `APP_KEY` ⇒ بازرمزنگاری اجباری؛
 *             همان قاعدهٔ Snapshot فاز ۷/۸.
 *   `version` optimistic lock؛ دو ادمین هم‌زمان ⇒ ۴۰۹ برای دومی (§81/§93).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE system_settings (
                id varchar(36) not null primary key,
                key varchar(96) not null,
                value text null,
                is_secret integer not null default 0,
                version integer not null default 1,
                updated_by_admin_id varchar(36) null,
                created_at datetime null,
                updated_at datetime null,
                constraint system_settings_key_unique unique (key),
                constraint system_settings_version_positive check (version >= 1),
                constraint system_settings_is_secret_valid check (is_secret in (0,1)),
                foreign key (updated_by_admin_id) references admins (id) on delete set null
            )
            SQL);

            return;
        }

        Schema::create('system_settings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('key', 96)->unique();
            $table->text('value')->nullable();
            $table->boolean('is_secret')->default(false);
            $table->integer('version')->default(1);
            $table->uuid('updated_by_admin_id')->nullable();
            $table->timestampsTz();

            $table->foreign('updated_by_admin_id')->references('id')->on('admins')->nullOnDelete();
        });

        $this->addCheck('system_settings', 'system_settings_version_positive', 'version >= 1');
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
