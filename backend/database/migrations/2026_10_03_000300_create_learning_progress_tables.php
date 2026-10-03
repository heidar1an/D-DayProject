<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۵ — پیشرفت یادگیری و نشست‌های مطالعه.
 *
 * مرزهای قطعی (Blueprint §4 و §6 سند فاز):
 *   • `learning_progress` = «کاربر در یک **صفحهٔ درس** تا کجا پیش رفته».
 *     رکورد منبع است؛ هیچ aggregate ذخیره‌شده‌ای اینجا نیست.
 *   • `study_sessions` = «یک بازهٔ واقعی مطالعه». جدولش مستقل از progress است:
 *     یک نشست می‌تواند به صفحه گره بخورد یا نخورد (`lesson_page_id` nullable).
 *   • Exam Attempt / Exam Result **اینجا نیستند** — فاز ۷.
 *
 * تصمیم‌های داده:
 *   • `UNIQUE(user_id, lesson_page_id)` — یک رکورد در هر (کاربر، صفحه).
 *   • `version` برای optimistic lock؛ مقدارش در سرویس بالا می‌رود، نه از کلاینت.
 *   • `seconds_spent` CHECK >= 0 و `version` CHECK >= 1 ⇒ دادهٔ منفی/صفر وارد نشود.
 *   • `status` varchar + CHECK (not_started|in_progress|completed) — همان سه وضعیتی
 *     که UI فعلی معنایش را دارد. وضعیت تازه بدون مصرف‌کنندهٔ واقعی اضافه نشد.
 *   • همهٔ زمان‌ها `timestamptz` (UTC) هستند. `learning_progress.completed_at`
 *     nullable است چون «تکمیل‌شده بدون زمان تکمیل» بی‌معناست ولی «در حال انجام»
 *     زمان تکمیل ندارد.
 *   • `study_sessions.duration_sec` nullable است: نشستِ باز (`ended_at` تهی)
 *     هنوز مدت قطعی ندارد. `CHECK (ended_at IS NULL OR ended_at >= started_at)`
 *     جلوی بازهٔ معکوس را در خود دیتابیس می‌گیرد.
 *   • FK به `users` و `lesson_pages` هر دو RESTRICT: حذف کاربر یا محتوایی که
 *     پیشرفت دارد، تصادفی نباید تاریخچه را پاک کند.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const STATUS_CHECK = "status in ('not_started','in_progress','completed')";

    /**
     * فهرست source — **کوچک‌تر از Blueprint**، عمداً.
     *
     * Blueprint پنج مقدار می‌خواست (`lesson`, `micro_lesson`, `course`,
     * `pomodoro`, `manual`). در Frontend فعلی فقط سه‌تای اول قابل اثبات است:
     * خوانندهٔ درس/میکرودرس و تایمر پومودورو (`.pomodoro__*` در `motion.css`).
     * `course` و `manual` هیچ مصرف‌کنندهٔ واقعی ندارند، پس وارد enum نشدند —
     * بزرگ‌کردن enum بدون مصرف‌کننده یعنی قرارداد صوری.
     */
    private const SOURCE_CHECK = "source in ('lesson','micro_lesson','pomodoro')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('learning_progress', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('lesson_page_id');
            $table->string('status', 16)->default('not_started');
            $table->unsignedInteger('last_position')->nullable();
            $table->unsignedInteger('seconds_spent')->default(0);
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();

            $table->unique(['user_id', 'lesson_page_id']);
            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'updated_at']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('lesson_page_id')->references('id')->on('lesson_pages')->restrictOnDelete();
        });
        $this->addCheck('learning_progress', 'learning_progress_status_valid', self::STATUS_CHECK);
        $this->addCheck('learning_progress', 'learning_progress_version_positive', 'version >= 1');
        $this->addCheck('learning_progress', 'learning_progress_seconds_non_negative', 'seconds_spent >= 0');

        Schema::create('study_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('lesson_page_id')->nullable();
            $table->string('source', 24);
            $table->timestampTz('started_at');
            $table->timestampTz('ended_at')->nullable();
            $table->unsignedInteger('duration_sec')->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'started_at']);
            $table->index(['user_id', 'lesson_page_id']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('lesson_page_id')->references('id')->on('lesson_pages')->nullOnDelete();
        });
        $this->addCheck('study_sessions', 'study_sessions_source_valid', self::SOURCE_CHECK);
        $this->addCheck('study_sessions', 'study_sessions_duration_non_negative', 'duration_sec is null or duration_sec >= 0');
        $this->addCheck('study_sessions', 'study_sessions_range_ordered', 'ended_at is null or ended_at >= started_at');
    }

    public function down(): void
    {
        Schema::dropIfExists('study_sessions');
        Schema::dropIfExists('learning_progress');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            <<<'SQL'
            CREATE TABLE learning_progress (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                lesson_page_id varchar(36) not null,
                status varchar(16) not null default 'not_started',
                last_position integer null,
                seconds_spent integer not null default 0,
                version integer not null default 1,
                completed_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint learning_progress_user_id_lesson_page_id_unique unique (user_id, lesson_page_id),
                constraint learning_progress_status_valid check (status in ('not_started','in_progress','completed')),
                constraint learning_progress_version_positive check (version >= 1),
                constraint learning_progress_seconds_non_negative check (seconds_spent >= 0),
                foreign key (user_id) references users (id) on delete restrict,
                foreign key (lesson_page_id) references lesson_pages (id) on delete restrict
            )
            SQL,
            'CREATE INDEX learning_progress_user_id_status_index ON learning_progress (user_id, status)',
            'CREATE INDEX learning_progress_user_id_updated_at_index ON learning_progress (user_id, updated_at)',
            <<<'SQL'
            CREATE TABLE study_sessions (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                lesson_page_id varchar(36) null,
                source varchar(24) not null,
                started_at datetime not null,
                ended_at datetime null,
                duration_sec integer null,
                created_at datetime null,
                updated_at datetime null,
                constraint study_sessions_source_valid check (source in ('lesson','micro_lesson','pomodoro')),
                constraint study_sessions_duration_non_negative check (duration_sec is null or duration_sec >= 0),
                constraint study_sessions_range_ordered check (ended_at is null or ended_at >= started_at),
                foreign key (user_id) references users (id) on delete restrict,
                foreign key (lesson_page_id) references lesson_pages (id) on delete set null
            )
            SQL,
            'CREATE INDEX study_sessions_user_id_started_at_index ON study_sessions (user_id, started_at)',
            'CREATE INDEX study_sessions_user_id_lesson_page_id_index ON study_sessions (user_id, lesson_page_id)',
        ];
    }
};
