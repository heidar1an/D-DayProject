<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۳ — مسیر سبز (Green Path).
 *
 * مرز مالکیت (Blueprint فاز ۱۳):
 *   • `green_paths` = «برنامهٔ مطالعهٔ کاربر» — مالک Roadmap. هیچ پیشرفت واقعی
 *     اینجا ذخیره نمی‌شود؛ `learning_progress` همچنان تنها منبع «کاربر چه کرد» است.
 *   • `green_path_steps` = «قدم‌های برنامه». Target انحصاری است: هر قدم یا درس
 *     است، یا سؤال، یا آزمون، یا action بدون target — هرگز دو تا با هم.
 *
 * تصمیم‌های داده:
 *   • `goal_key` شناسهٔ canonical است (فهرست بسته در config/green_path.php)، نه متن آزاد.
 *   • `status` مسیر: فقط active|archived — مسیر هرگز حذف فیزیکی نمی‌شود؛ Rebuild
 *     یعنی archive + ساخت مسیر تازه با `plan_version` بالاتر و carry-over قدم‌های completed.
 *   • یک مسیر فعال per-user: unique partial index (PostgreSQL و SQLite هر دو از
 *     partial unique index پشتیبانی می‌کنند).
 *   • `green_path_steps.version` برای optimistic lock؛ فقط سرویس بالا می‌برد.
 *   • `completed_at` فقط هنگام گذار به completed نوشته می‌شود — همیشه سرور.
 *   • FKهای target همگی RESTRICT: حذف محتوایی که قدم برنامه است باید ناممکن باشد
 *     (محتوا در فازهای قبل هم restrict است؛ اینجا همان سیاست).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const PATH_STATUS_CHECK = "status in ('active','archived')";

    private const STEP_KIND_CHECK = "kind in ('lesson','question','exam','action')";

    private const STEP_STATUS_CHECK = "status in ('locked','available','in_progress','completed','recommended')";

    private const STEP_SOURCE_CHECK = "source in ('plan','carry_over')";

    /**
     * انحصار target: lesson XOR question XOR exam XOR بدون target.
     *
     * @param  string  $table  نام جدول برای پیشوند constraint
     */
    private const TARGET_XOR_TEMPLATE = "(
        (kind = 'lesson' and lesson_id is not null and question_id is null and exam_id is null)
        or (kind = 'question' and lesson_id is null and question_id is not null and exam_id is null)
        or (kind = 'exam' and lesson_id is null and question_id is null and exam_id is not null)
        or (kind = 'action' and lesson_id is null and question_id is null and exam_id is null)
    )";

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('green_paths', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('semester_id')->nullable();
            $table->string('goal_key', 48);
            $table->unsignedInteger('plan_version')->default(1);
            $table->string('status', 16)->default('active');
            $table->timestampTz('starts_at')->nullable();
            /* اثر انگشت محتوای مؤثر بر برنامه — کلید rebuild تنبل (§ GreenPathService). */
            $table->string('content_fingerprint', 64)->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'status']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('semester_id')->references('id')->on('semesters')->restrictOnDelete();
        });
        $this->addCheck('green_paths', 'green_paths_status_valid', self::PATH_STATUS_CHECK);
        $this->addCheck('green_paths', 'green_paths_plan_version_positive', 'plan_version >= 1');
        DB::statement(
            "CREATE UNIQUE INDEX green_paths_one_active_per_user ON green_paths (user_id) WHERE status = 'active'"
        );

        Schema::create('green_path_steps', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('path_id');
            $table->string('kind', 16);
            $table->uuid('lesson_id')->nullable();
            $table->uuid('question_id')->nullable();
            $table->uuid('exam_id')->nullable();
            $table->unsignedInteger('position');
            $table->string('status', 16)->default('locked');
            $table->timestampTz('due_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->string('source', 16)->default('plan');
            $table->unsignedInteger('version')->default(1);
            $table->timestampsTz();

            $table->unique(['path_id', 'position']);
            $table->index(['path_id', 'status']);
            $table->index('due_at');
            $table->foreign('path_id')->references('id')->on('green_paths')->restrictOnDelete();
            $table->foreign('lesson_id')->references('id')->on('lessons')->restrictOnDelete();
            $table->foreign('question_id')->references('id')->on('questions')->restrictOnDelete();
            $table->foreign('exam_id')->references('id')->on('exams')->restrictOnDelete();
        });
        $this->addCheck('green_path_steps', 'green_path_steps_kind_valid', self::STEP_KIND_CHECK);
        $this->addCheck('green_path_steps', 'green_path_steps_status_valid', self::STEP_STATUS_CHECK);
        $this->addCheck('green_path_steps', 'green_path_steps_source_valid', self::STEP_SOURCE_CHECK);
        $this->addCheck('green_path_steps', 'green_path_steps_target_exclusive', self::TARGET_XOR_TEMPLATE);
        $this->addCheck('green_path_steps', 'green_path_steps_position_positive', 'position >= 1');
        $this->addCheck('green_path_steps', 'green_path_steps_version_positive', 'version >= 1');
        $this->addCheck(
            'green_path_steps',
            'green_path_steps_completed_requires_time',
            "(status = 'completed') = (completed_at is not null)",
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('green_path_steps');
        Schema::dropIfExists('green_paths');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            <<<'SQL'
            CREATE TABLE green_paths (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                semester_id varchar(36) null,
                goal_key varchar(48) not null,
                plan_version integer not null default 1,
                status varchar(16) not null default 'active',
                starts_at datetime null,
                content_fingerprint varchar(64) null,
                created_at datetime null,
                updated_at datetime null,
                constraint green_paths_status_valid check (status in ('active','archived')),
                constraint green_paths_plan_version_positive check (plan_version >= 1),
                foreign key (user_id) references users (id) on delete restrict,
                foreign key (semester_id) references semesters (id) on delete restrict
            )
            SQL,
            'CREATE INDEX green_paths_user_id_status_index ON green_paths (user_id, status)',
            "CREATE UNIQUE INDEX green_paths_one_active_per_user ON green_paths (user_id) WHERE status = 'active'",
            <<<'SQL'
            CREATE TABLE green_path_steps (
                id varchar(36) not null primary key,
                path_id varchar(36) not null,
                kind varchar(16) not null,
                lesson_id varchar(36) null,
                question_id varchar(36) null,
                exam_id varchar(36) null,
                position integer not null,
                status varchar(16) not null default 'locked',
                due_at datetime null,
                completed_at datetime null,
                source varchar(16) not null default 'plan',
                version integer not null default 1,
                created_at datetime null,
                updated_at datetime null,
                constraint green_path_steps_kind_valid check (kind in ('lesson','question','exam','action')),
                constraint green_path_steps_status_valid check (status in ('locked','available','in_progress','completed','recommended')),
                constraint green_path_steps_source_valid check (source in ('plan','carry_over')),
                constraint green_path_steps_target_exclusive check (
                    (kind = 'lesson' and lesson_id is not null and question_id is null and exam_id is null)
                    or (kind = 'question' and lesson_id is null and question_id is not null and exam_id is null)
                    or (kind = 'exam' and lesson_id is null and question_id is null and exam_id is not null)
                    or (kind = 'action' and lesson_id is null and question_id is null and exam_id is null)
                ),
                constraint green_path_steps_position_positive check (position >= 1),
                constraint green_path_steps_version_positive check (version >= 1),
                constraint green_path_steps_completed_requires_time check ((status = 'completed') = (completed_at is not null)),
                foreign key (path_id) references green_paths (id) on delete restrict,
                foreign key (lesson_id) references lessons (id) on delete restrict,
                foreign key (question_id) references questions (id) on delete restrict,
                foreign key (exam_id) references exams (id) on delete restrict
            )
            SQL,
            'CREATE UNIQUE INDEX green_path_steps_path_id_position_unique ON green_path_steps (path_id, position)',
            'CREATE INDEX green_path_steps_path_id_status_index ON green_path_steps (path_id, status)',
            'CREATE INDEX green_path_steps_due_at_index ON green_path_steps (due_at)',
        ];
    }
};
