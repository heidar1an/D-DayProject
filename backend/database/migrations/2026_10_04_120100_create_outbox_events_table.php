<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۹ — Outbox.
 *
 * چرا Outbox: ترتیب «DB Commit → Event → Queue → Side Effect» (§12/§117) بدون
 * ثبت اتمی رخداد تضمین نمی‌شود. رخداد **بعد از commit دامنه** ثبت می‌شود
 * (listenerها `ShouldHandleEventsAfterCommit` هستند) و یک sweeper زمان‌بند
 * رخدادهای منتشرنشده را برمی‌دارد؛ پس نه رخداد گم می‌شود و نه Side Effect وسط
 * تراکنش دامنه اجرا می‌شود.
 *
 * `event_key UNIQUE` ⇒ idempotency انتشار (§13).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE outbox_events (
                id varchar(36) not null primary key,
                event_key varchar(190) not null,
                aggregate_type varchar(64) not null,
                aggregate_id varchar(64) not null,
                event_type varchar(96) not null,
                payload text null,
                attempts integer not null default 0,
                last_error_code varchar(64) null,
                published_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint outbox_events_event_key_unique unique (event_key)
            )
            SQL);

            DB::statement('CREATE INDEX outbox_events_unpublished_index ON outbox_events (published_at, created_at, id)');
            DB::statement('CREATE INDEX outbox_events_aggregate_index ON outbox_events (aggregate_type, aggregate_id, created_at)');
            DB::statement('CREATE INDEX outbox_events_event_type_index ON outbox_events (event_type, created_at)');

            return;
        }

        Schema::create('outbox_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('event_key', 190)->unique();
            $table->string('aggregate_type', 64);
            $table->string('aggregate_id', 64);
            $table->string('event_type', 96);
            $table->jsonb('payload')->nullable();
            $table->integer('attempts')->default(0);
            $table->string('last_error_code', 64)->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();

            $table->index(['published_at', 'created_at', 'id']);
            $table->index(['aggregate_type', 'aggregate_id', 'created_at']);
            $table->index(['event_type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outbox_events');
    }
};
