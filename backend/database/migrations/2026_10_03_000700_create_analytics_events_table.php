<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۸ — رویدادهای تحلیلی.
 *
 * `analytics_events` **منبع حقیقت نیست**. اولویت داده‌ای همیشه
 * «جداول دامنه > رویداد تحلیلی» است: Completion از `learning_progress`، نمره از
 * `exam_results`. این جدول فقط رویدادهای typed و کوتاه‌عمر را نگه می‌دارد تا
 * «جریان فعالیت» و «روند زمانی» قابل بازسازی باشد.
 *
 * تصمیم‌های کلیدی:
 *   • **dedup سرور-ساخته:** `event_key` یکتاست (`exam.finished:{attemptId}` …).
 *     انتشار دوبارهٔ یک Domain Event رکورد تکراری نمی‌سازد — همان چیزی که
 *     at-least-once بودن listener ها را بی‌ضرر می‌کند.
 *   • **بدون ingestion کلاینت:** هیچ endpointی برای نوشتن رویداد از سمت کلاینت
 *     وجود ندارد. رویداد حساس (`exam_finished`, `lesson_completed`) فقط از
 *     Domain Event سمت سرور تولید می‌شود.
 *   • **PII:** `properties` با سقف بایت و allowlist کلید در سرویس کنترل می‌شود؛
 *     اینجا هیچ ستون آزادی برای secret نیست.
 *   • `user_id` با `set null` حذف می‌شود تا حذف حساب، آمار تجمیعی را نشکند —
 *     ولی رویداد باقی نمی‌ماند با هویت قابل بازگشت (بدون ستون هویتی دیگر).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('analytics_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('event_key', 120)->unique();
            $table->uuid('user_id')->nullable();
            $table->string('event_type', 48);
            $table->timestampTz('occurred_at');
            $table->jsonb('properties')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'occurred_at']);
            $table->index(['user_id', 'event_type', 'occurred_at']);
            $table->index(['event_type', 'occurred_at']);
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_events');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            <<<'SQL'
            CREATE TABLE analytics_events (
                id varchar(36) not null primary key,
                event_key varchar(120) not null,
                user_id varchar(36) null,
                event_type varchar(48) not null,
                occurred_at datetime not null,
                properties text null,
                created_at datetime null,
                updated_at datetime null,
                constraint analytics_events_event_key_unique unique (event_key),
                foreign key (user_id) references users (id) on delete set null
            )
            SQL,
        ];
    }
};
