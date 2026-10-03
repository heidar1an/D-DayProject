<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۲۰ — Audit log.
 *
 * Append-only: هیچ ستون `updated_at` نیست و مدل `AuditLog` ویرایش/حذف را قفل
 * کرده است (§82). `changes` فقط **کلیدها و مقدارهای redactشده** را نگه می‌دارد؛
 * رمز/توکن/کد گروه هرگز ذخیره نمی‌شود (§83).
 *
 * `request_id` برای همبستگی با لاگ JSON و envelope پاسخ است.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE audit_logs (
                id varchar(36) not null primary key,
                actor_type varchar(16) not null,
                actor_id varchar(64) null,
                action varchar(120) not null,
                target_type varchar(64) null,
                target_id varchar(64) null,
                request_id varchar(64) null,
                changes text null,
                created_at datetime null,
                constraint audit_logs_actor_type_valid check (actor_type in ('admin','user','system'))
            )
            SQL);

            DB::statement('CREATE INDEX audit_logs_created_at_id_index ON audit_logs (created_at, id)');
            DB::statement('CREATE INDEX audit_logs_actor_index ON audit_logs (actor_type, actor_id, created_at)');
            DB::statement('CREATE INDEX audit_logs_target_index ON audit_logs (target_type, target_id, created_at)');
            DB::statement('CREATE INDEX audit_logs_action_index ON audit_logs (action)');

            return;
        }

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('actor_type', 16);
            $table->string('actor_id', 64)->nullable();
            $table->string('action', 120);
            $table->string('target_type', 64)->nullable();
            $table->string('target_id', 64)->nullable();
            $table->string('request_id', 64)->nullable();
            $table->jsonb('changes')->nullable();
            $table->timestampTz('created_at')->nullable();

            $table->index(['created_at', 'id']);
            $table->index(['actor_type', 'actor_id', 'created_at']);
            $table->index(['target_type', 'target_id', 'created_at']);
            $table->index('action');
        });

        $this->addCheck('audit_logs', 'audit_logs_actor_type_valid', "actor_type in ('admin','user','system')");
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
