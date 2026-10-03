<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۹ — Notifications + Delivery.
 *
 *   notifications           اعلان درون‌برنامه‌ای کاربر. `payload` محدود و
 *                           versionable؛ هیچ رمز/توکن/سشن در آن نیست (§18).
 *   notification_deliveries وضعیت تحویل هر کانال با `UNIQUE(notification_id,
 *                           channel)` ⇒ تحویل تکراری ممکن نیست (§20).
 *
 * `dedup_key` (اختیاری) با UNIQUE جزئی روی `(user_id, dedup_key)` قفل شده:
 * رخداد تکراری ⇒ اعلان تکراری نمی‌سازد (§27).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE notifications (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                type varchar(48) not null,
                dedup_key varchar(190) null,
                payload text not null,
                read_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                foreign key (user_id) references users (id) on delete cascade
            )
            SQL);

            DB::statement('CREATE INDEX notifications_user_read_created_index ON notifications (user_id, read_at, created_at)');
            DB::statement('CREATE UNIQUE INDEX notifications_user_dedup_unique ON notifications (user_id, dedup_key) WHERE dedup_key IS NOT NULL');

            DB::statement(<<<'SQL'
            CREATE TABLE notification_deliveries (
                id varchar(36) not null primary key,
                notification_id varchar(36) not null,
                channel varchar(16) not null,
                status varchar(16) not null default 'pending',
                attempts integer not null default 0,
                last_error_code varchar(64) null,
                created_at datetime null,
                updated_at datetime null,
                constraint notification_deliveries_notification_channel_unique unique (notification_id, channel),
                constraint notification_deliveries_channel_valid check (channel in ('in_app','email','sms','push')),
                constraint notification_deliveries_status_valid check (status in ('pending','sent','delivered','failed','skipped')),
                foreign key (notification_id) references notifications (id) on delete cascade
            )
            SQL);

            DB::statement('CREATE INDEX notification_deliveries_status_index ON notification_deliveries (status, channel, created_at)');

            return;
        }

        Schema::create('notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('type', 48);
            $table->string('dedup_key', 190)->nullable();
            $table->jsonb('payload');
            $table->timestampTz('read_at')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'read_at', 'created_at']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        /* UNIQUE جزئی: فقط وقتی dedup_key دارد. PostgreSQL و SQLite هر دو پشتیبانی می‌کنند. */
        DB::statement('CREATE UNIQUE INDEX notifications_user_dedup_unique ON notifications (user_id, dedup_key) WHERE dedup_key IS NOT NULL');

        Schema::create('notification_deliveries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('notification_id');
            $table->string('channel', 16);
            $table->string('status', 16)->default('pending');
            $table->integer('attempts')->default(0);
            $table->string('last_error_code', 64)->nullable();
            $table->timestampsTz();

            $table->unique(['notification_id', 'channel']);
            $table->index(['status', 'channel', 'created_at']);
            $table->foreign('notification_id')->references('id')->on('notifications')->cascadeOnDelete();
        });

        $this->addCheck('notification_deliveries', 'notification_deliveries_channel_valid', "channel in ('in_app','email','sms','push')");
        $this->addCheck('notification_deliveries', 'notification_deliveries_status_valid', "status in ('pending','sent','delivered','failed','skipped')");
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_deliveries');
        Schema::dropIfExists('notifications');
    }
};
