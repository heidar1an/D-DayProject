<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۷ — موتور آزمون.
 *
 * مرز دامنه: بانک سؤال مالک سؤال و کلید است؛ این ماژول مالک آزمون، Snapshot،
 * ثبت‌نام، Attempt، پاسخ و نتیجه. هیچ‌کدام مالک دیگری نمی‌شود.
 *
 * تصمیم‌های کلیدی:
 *   • **Snapshot:** `exam_questions.render_snapshot` + `key_snapshot_encrypted`
 *     عکس لحظهٔ انتشار‌اند. ویرایش بعدی سؤال، Attempt قدیمی را تغییر نمی‌دهد.
 *   • **جدایی کلید:** کلید پاسخ **هرگز** در ستون قابل serialize نیست. با cast
 *     `encrypted` لاراول (AES-256-GCM، کلید `APP_KEY`) ذخیره می‌شود؛ تنها
 *     `ExamGrader` آن را می‌خواند. هیچ Secret در ریپو نیست و کلید hardcode نشده.
 *     ⚠️ چرخش `APP_KEY` نیازمند re-encrypt این ستون است (ریسک مستندشده).
 *   • **زمان سرور:** `deadline_at` و `started_at`/`submitted_at`/`graded_at`
 *     همه `timestamptz` و فقط با ساعت سرور نوشته می‌شوند. کلاینت هیچ ستون
 *     زمانی نمی‌نویسد.
 *   • **پاسخ snapshot-local است:** گزینهٔ انتخابی با شناسهٔ درونِ
 *     `render_snapshot` ثبت می‌شود (`selected_option_id`)، پس نمی‌تواند به
 *     گزینهٔ سؤال دیگری اشاره کند. FK به `question_options` عمداً **نیست** —
 *     Snapshot باید از تغییرات بانک سؤال مستقل بماند.
 *   • **نتیجه تغییرن‌پذیر:** نه soft delete، نه cascade. FKها `RESTRICT` اند تا
 *     حذف تصادفی سؤال/کاربر، تاریخچهٔ آزمون را از بین نبرد.
 *   • **قیدهای جزئی:** `UNIQUE(submit_key) WHERE NOT NULL` و
 *     `UNIQUE(exam_id, question_id) WHERE NOT NULL` چون در PG/SQLite مقادیر
 *     NULL در UNIQUE با هم یکتا حساب نمی‌شوند.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const KIND_CHECK = "kind in ('quiz','personal','coordinated','international')";

    private const EXAM_STATUS_CHECK = "status in ('draft','scheduled','open','closed','archived')";

    private const ATTEMPT_STATUS_CHECK = "status in ('in_progress','graded','expired')";

    private const SUBMIT_REASON_CHECK = "submit_reason is null or submit_reason in ('user','auto','grace','timeout')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('exams', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->string('slug', 120)->unique();
            $table->string('kind', 24);
            $table->string('type', 24)->nullable();
            $table->string('title', 200);
            $table->string('short_name', 120)->nullable();
            $table->text('description')->nullable();
            $table->uuid('subject_id')->nullable();
            $table->string('status', 16)->default('draft');

            $table->timestampTz('opens_at')->nullable();
            $table->timestampTz('closes_at')->nullable();
            $table->timestampTz('registration_opens_at')->nullable();
            $table->timestampTz('registration_closes_at')->nullable();
            $table->timestampTz('result_release_at')->nullable();
            $table->timestampTz('published_at')->nullable();

            $table->unsignedInteger('duration_minutes')->nullable();
            $table->unsignedSmallInteger('grace_seconds')->default(0);
            $table->unsignedSmallInteger('attempt_limit')->default(1);
            $table->decimal('negative_marking', 5, 2)->default(0);
            $table->unsignedInteger('question_count')->default(0);

            $table->jsonb('rules')->nullable();
            $table->unsignedInteger('rules_version')->default(1);
            $table->jsonb('meta')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->uuid('created_by_admin_id')->nullable();
            $table->timestampsTz();

            $table->index(['status', 'opens_at']);
            $table->index(['kind', 'status']);
            $table->index(['subject_id', 'status']);
            $table->foreign('subject_id')->references('id')->on('subjects')->nullOnDelete();
            $table->foreign('created_by_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('exams', 'exams_kind_valid', self::KIND_CHECK);
        $this->addCheck('exams', 'exams_status_valid', self::EXAM_STATUS_CHECK);
        $this->addCheck('exams', 'exams_attempt_limit_positive', 'attempt_limit >= 1');
        $this->addCheck('exams', 'exams_negative_marking_range', 'negative_marking <= 0 and negative_marking >= -1');
        $this->addCheck('exams', 'exams_duration_positive', 'duration_minutes is null or duration_minutes >= 1');
        $this->addCheck('exams', 'exams_rules_version_positive', 'rules_version >= 1');
        $this->addCheck('exams', 'exams_version_positive', 'version >= 1');

        Schema::create('exam_questions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('exam_id');
            $table->uuid('question_id')->nullable();
            $table->unsignedInteger('position');
            $table->unsignedInteger('question_version')->default(1);
            $table->jsonb('render_snapshot');
            $table->text('key_snapshot_encrypted')->nullable();
            $table->decimal('weight', 6, 3)->default(1);
            $table->timestampsTz();

            $table->unique(['exam_id', 'position']);
            $table->index(['exam_id', 'id']);
            $table->foreign('exam_id')->references('id')->on('exams')->cascadeOnDelete();
            $table->foreign('question_id')->references('id')->on('questions')->restrictOnDelete();
        });
        $this->addCheck('exam_questions', 'exam_questions_position_positive', 'position >= 1');
        $this->addCheck('exam_questions', 'exam_questions_question_version_positive', 'question_version >= 1');
        $this->addCheck('exam_questions', 'exam_questions_weight_positive', 'weight > 0');
        DB::statement('CREATE UNIQUE INDEX exam_questions_exam_question_unique ON exam_questions (exam_id, question_id) WHERE question_id IS NOT NULL');

        Schema::create('exam_registrations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('exam_id');
            $table->uuid('user_id');
            $table->timestampTz('registered_at');
            $table->timestampsTz();

            $table->unique(['exam_id', 'user_id']);
            $table->index(['user_id', 'exam_id']);
            $table->foreign('exam_id')->references('id')->on('exams')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('exam_attempts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('exam_id');
            $table->uuid('user_id')->nullable();
            $table->string('guest_id', 64)->nullable();
            $table->unsignedSmallInteger('attempt_no');
            $table->string('status', 16)->default('in_progress');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('started_at');
            $table->timestampTz('deadline_at');
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampTz('graded_at')->nullable();
            $table->timestampTz('last_seen_at')->nullable();
            $table->string('submit_key', 96)->nullable();
            $table->string('submit_reason', 16)->nullable();
            $table->timestampsTz();

            $table->unique(['exam_id', 'user_id', 'attempt_no']);
            $table->index(['user_id', 'status']);
            $table->index(['exam_id', 'status']);
            $table->index(['status', 'deadline_at']);
            $table->foreign('exam_id')->references('id')->on('exams')->restrictOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
        });
        $this->addCheck('exam_attempts', 'exam_attempts_status_valid', self::ATTEMPT_STATUS_CHECK);
        $this->addCheck('exam_attempts', 'exam_attempts_submit_reason_valid', self::SUBMIT_REASON_CHECK);
        $this->addCheck('exam_attempts', 'exam_attempts_attempt_no_positive', 'attempt_no >= 1');
        $this->addCheck('exam_attempts', 'exam_attempts_version_positive', 'version >= 1');
        $this->addCheck('exam_attempts', 'exam_attempts_deadline_after_start', 'deadline_at >= started_at');
        $this->addCheck(
            'exam_attempts',
            'exam_attempts_principal_exclusive',
            '(user_id IS NOT NULL AND guest_id IS NULL) OR (user_id IS NULL AND guest_id IS NOT NULL)',
        );
        DB::statement('CREATE UNIQUE INDEX exam_attempts_submit_key_unique ON exam_attempts (submit_key) WHERE submit_key IS NOT NULL');
        DB::statement('CREATE UNIQUE INDEX exam_attempts_guest_no_unique ON exam_attempts (exam_id, guest_id, attempt_no) WHERE guest_id IS NOT NULL');

        Schema::create('exam_answers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('attempt_id');
            $table->uuid('exam_question_id');
            $table->string('selected_option_id', 64)->nullable();
            $table->unsignedInteger('revision')->default(1);
            $table->unsignedInteger('time_spent_sec')->nullable();
            $table->timestampTz('answered_at');
            $table->timestampsTz();

            $table->unique(['attempt_id', 'exam_question_id']);
            $table->index(['exam_question_id']);
            $table->foreign('attempt_id')->references('id')->on('exam_attempts')->restrictOnDelete();
            $table->foreign('exam_question_id')->references('id')->on('exam_questions')->restrictOnDelete();
        });
        $this->addCheck('exam_answers', 'exam_answers_revision_positive', 'revision >= 1');

        Schema::create('exam_results', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('attempt_id');
            $table->uuid('exam_id');
            $table->uuid('user_id')->nullable();
            $table->string('submit_reason', 16);
            $table->decimal('score', 8, 3);
            $table->decimal('max_score', 8, 3);
            $table->decimal('percentage', 5, 2);
            $table->unsignedInteger('correct_count');
            $table->unsignedInteger('wrong_count');
            $table->unsignedInteger('blank_count');
            $table->decimal('negative_marking', 5, 2)->default(0);
            $table->unsignedInteger('time_spent_sec')->default(0);
            $table->jsonb('subject_breakdown')->nullable();
            $table->timestampTz('graded_at');
            $table->timestampsTz();

            $table->unique('attempt_id');
            $table->index(['exam_id', 'percentage']);
            $table->index(['user_id', 'graded_at']);
            $table->foreign('attempt_id')->references('id')->on('exam_attempts')->restrictOnDelete();
            $table->foreign('exam_id')->references('id')->on('exams')->restrictOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
        });
        $this->addCheck('exam_results', 'exam_results_submit_reason_valid', "submit_reason in ('user','auto','grace','timeout')");
        $this->addCheck('exam_results', 'exam_results_percentage_range', 'percentage >= 0 and percentage <= 100');
        $this->addCheck('exam_results', 'exam_results_counts_non_negative', 'correct_count >= 0 and wrong_count >= 0 and blank_count >= 0');
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_results');
        Schema::dropIfExists('exam_answers');
        Schema::dropIfExists('exam_attempts');
        Schema::dropIfExists('exam_registrations');
        Schema::dropIfExists('exam_questions');
        Schema::dropIfExists('exams');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            self::sqliteExams(),
            self::sqliteExamQuestions(),
            'CREATE UNIQUE INDEX exam_questions_exam_question_unique ON exam_questions (exam_id, question_id) WHERE question_id IS NOT NULL',
            self::sqliteRegistrations(),
            self::sqliteAttempts(),
            'CREATE UNIQUE INDEX exam_attempts_submit_key_unique ON exam_attempts (submit_key) WHERE submit_key IS NOT NULL',
            'CREATE UNIQUE INDEX exam_attempts_guest_no_unique ON exam_attempts (exam_id, guest_id, attempt_no) WHERE guest_id IS NOT NULL',
            self::sqliteAnswers(),
            self::sqliteResults(),
        ];
    }

    private static function sqliteExams(): string
    {
        return <<<'SQL'
        CREATE TABLE exams (
            id varchar(36) not null primary key,
            legacy_id varchar(64) null,
            slug varchar(120) not null,
            kind varchar(24) not null,
            type varchar(24) null,
            title varchar(200) not null,
            short_name varchar(120) null,
            description text null,
            subject_id varchar(36) null,
            status varchar(16) not null default 'draft',
            opens_at datetime null,
            closes_at datetime null,
            registration_opens_at datetime null,
            registration_closes_at datetime null,
            result_release_at datetime null,
            published_at datetime null,
            duration_minutes integer null,
            grace_seconds integer not null default 0,
            attempt_limit integer not null default 1,
            negative_marking numeric not null default 0,
            question_count integer not null default 0,
            rules text null,
            rules_version integer not null default 1,
            meta text null,
            version integer not null default 1,
            created_by_admin_id varchar(36) null,
            created_at datetime null,
            updated_at datetime null,
            constraint exams_legacy_id_unique unique (legacy_id),
            constraint exams_slug_unique unique (slug),
            constraint exams_kind_valid check (kind in ('quiz','personal','coordinated','international')),
            constraint exams_status_valid check (status in ('draft','scheduled','open','closed','archived')),
            constraint exams_attempt_limit_positive check (attempt_limit >= 1),
            constraint exams_negative_marking_range check (negative_marking <= 0 and negative_marking >= -1),
            constraint exams_duration_positive check (duration_minutes is null or duration_minutes >= 1),
            constraint exams_rules_version_positive check (rules_version >= 1),
            constraint exams_version_positive check (version >= 1),
            foreign key (subject_id) references subjects (id) on delete set null,
            foreign key (created_by_admin_id) references admins (id) on delete set null
        )
        SQL;
    }

    private static function sqliteExamQuestions(): string
    {
        return <<<'SQL'
        CREATE TABLE exam_questions (
            id varchar(36) not null primary key,
            exam_id varchar(36) not null,
            question_id varchar(36) null,
            position integer not null,
            question_version integer not null default 1,
            render_snapshot text not null,
            key_snapshot_encrypted text null,
            weight numeric not null default 1,
            created_at datetime null,
            updated_at datetime null,
            constraint exam_questions_exam_id_position_unique unique (exam_id, position),
            constraint exam_questions_position_positive check (position >= 1),
            constraint exam_questions_question_version_positive check (question_version >= 1),
            constraint exam_questions_weight_positive check (weight > 0),
            foreign key (exam_id) references exams (id) on delete cascade,
            foreign key (question_id) references questions (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteRegistrations(): string
    {
        return <<<'SQL'
        CREATE TABLE exam_registrations (
            id varchar(36) not null primary key,
            exam_id varchar(36) not null,
            user_id varchar(36) not null,
            registered_at datetime not null,
            created_at datetime null,
            updated_at datetime null,
            constraint exam_registrations_exam_id_user_id_unique unique (exam_id, user_id),
            foreign key (exam_id) references exams (id) on delete cascade,
            foreign key (user_id) references users (id) on delete cascade
        )
        SQL;
    }

    private static function sqliteAttempts(): string
    {
        return <<<'SQL'
        CREATE TABLE exam_attempts (
            id varchar(36) not null primary key,
            exam_id varchar(36) not null,
            user_id varchar(36) null,
            guest_id varchar(64) null,
            attempt_no integer not null,
            status varchar(16) not null default 'in_progress',
            version integer not null default 1,
            started_at datetime not null,
            deadline_at datetime not null,
            submitted_at datetime null,
            graded_at datetime null,
            last_seen_at datetime null,
            submit_key varchar(96) null,
            submit_reason varchar(16) null,
            created_at datetime null,
            updated_at datetime null,
            constraint exam_attempts_exam_id_user_id_attempt_no_unique unique (exam_id, user_id, attempt_no),
            constraint exam_attempts_status_valid check (status in ('in_progress','graded','expired')),
            constraint exam_attempts_submit_reason_valid check (submit_reason is null or submit_reason in ('user','auto','grace','timeout')),
            constraint exam_attempts_attempt_no_positive check (attempt_no >= 1),
            constraint exam_attempts_version_positive check (version >= 1),
            constraint exam_attempts_deadline_after_start check (deadline_at >= started_at),
            constraint exam_attempts_principal_exclusive check (
                (user_id is not null and guest_id is null) or (user_id is null and guest_id is not null)
            ),
            foreign key (exam_id) references exams (id) on delete restrict,
            foreign key (user_id) references users (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteAnswers(): string
    {
        return <<<'SQL'
        CREATE TABLE exam_answers (
            id varchar(36) not null primary key,
            attempt_id varchar(36) not null,
            exam_question_id varchar(36) not null,
            selected_option_id varchar(64) null,
            revision integer not null default 1,
            time_spent_sec integer null,
            answered_at datetime not null,
            created_at datetime null,
            updated_at datetime null,
            constraint exam_answers_attempt_id_exam_question_id_unique unique (attempt_id, exam_question_id),
            constraint exam_answers_revision_positive check (revision >= 1),
            foreign key (attempt_id) references exam_attempts (id) on delete restrict,
            foreign key (exam_question_id) references exam_questions (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteResults(): string
    {
        return <<<'SQL'
        CREATE TABLE exam_results (
            id varchar(36) not null primary key,
            attempt_id varchar(36) not null,
            exam_id varchar(36) not null,
            user_id varchar(36) null,
            submit_reason varchar(16) not null,
            score numeric not null,
            max_score numeric not null,
            percentage numeric not null,
            correct_count integer not null,
            wrong_count integer not null,
            blank_count integer not null,
            negative_marking numeric not null default 0,
            time_spent_sec integer not null default 0,
            subject_breakdown text null,
            graded_at datetime not null,
            created_at datetime null,
            updated_at datetime null,
            constraint exam_results_attempt_id_unique unique (attempt_id),
            constraint exam_results_submit_reason_valid check (submit_reason in ('user','auto','grace','timeout')),
            constraint exam_results_percentage_range check (percentage >= 0 and percentage <= 100),
            constraint exam_results_counts_non_negative check (correct_count >= 0 and wrong_count >= 0 and blank_count >= 0),
            foreign key (attempt_id) references exam_attempts (id) on delete restrict,
            foreign key (exam_id) references exams (id) on delete restrict,
            foreign key (user_id) references users (id) on delete restrict
        )
        SQL;
    }
};
