<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۶ — بانک سؤال.
 *
 * مرز دامنه (Blueprint §4 و §48): بانک سؤال مالک `questions`, `question_options`,
 * `question_keys`, `question_topics`, `question_attempts`, `question_reports` و
 * `heart_rewards` است. Exam Engine (فاز ۷) مالک `exams`/`exam_*` خواهد بود و
 * اینجا ساخته نمی‌شود.
 *
 * تصمیم‌های کلیدی:
 *   • **جدایی کلید:** `correct_option_id` و `explanation` فقط در `question_keys`
 *     هستند و هیچ ستونی در `questions`/`question_options` آن‌ها را تکرار نمی‌کند.
 *     تنها نویسندهٔ آن سرویس بانک است و `QuestionKey` در هیچ Resource عمومی
 *     serialize نمی‌شود.
 *   • `questions.legacy_id` برای crosswalk با شناسه‌های `tb-phy-01` موجود؛ یکتا
 *     است تا مهاجرت داده دوباره‌کاری نکند. حذف فیزیکی سؤال ممنوع است؛
 *     `status = archived` جایگزین است (FKهای `RESTRICT` همین را تحمیل می‌کنند).
 *   • `question_options.label` جدا از `body` است چون UI فعلی ترتیب را نمایش
 *     می‌دهد و متن گزینه مستقل از برچسب آن است.
 *   • `question_attempts` **جدا** از `exam_attempts` است (فاز ۷). `user_id` و
 *     `guest_id` هر دو nullable و CHECK تضمین می‌کند دقیقاً یکی پر باشد —
 *     مهمان هرگز به حساب کاربر وصل نمی‌شود.
 *   • `question_attempts.is_correct` را فقط سرویس تصحیح می‌نویسد؛ در
 *     `$fillable` مدل نیست.
 *   • `heart_rewards.attempt_key` = `questionId:<باکت روز سرور>` — همان قاعدهٔ
 *     legacy (`contentStore.js`) که «یک قلب در روز برای هر سؤال» را تضمین
 *     می‌کند، مستقل از هر ورودی کلاینت. یکتایی روی `(user_id, attempt_key)`.
 *   • `question_topics.parent_id` سلسله‌مراتب دارد؛ برای گره‌های ریشه یک
 *     ایندکس یگانهٔ **جزئی** لازم است چون در PostgreSQL/SQLite مقادیر NULL در
 *     قید UNIQUE با هم یکتا حساب نمی‌شوند.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const STATUS_CHECK = "status in ('draft','published','archived')";

    private const QUESTION_TYPE_CHECK = "type in ('single','concept','memorization','calculation','clinical','image','combined')";

    private const DIFFICULTY_CHECK = "difficulty in ('easy','medium','hard','very_hard')";

    private const SOURCE_CHECK = "source in ('official','comprehensive','tapesh')";

    private const TRACK_CHECK = "track in ('medicine','dentistry')";

    private const REPORT_KIND_CHECK = "kind in ('error','ambiguity','typo','wrong_answer','other')";

    private const REPORT_STATUS_CHECK = "status in ('open','reviewing','resolved')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('question_topics', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('subject_id');
            $table->uuid('parent_id')->nullable();
            $table->string('slug', 80);
            $table->string('title', 160);
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status', 16)->default('draft');
            $table->timestampsTz();

            $table->unique(['subject_id', 'parent_id', 'slug']);
            $table->index(['subject_id', 'status', 'sort_order']);
            $table->foreign('subject_id')->references('id')->on('subjects')->restrictOnDelete();
        });

        /*
         * ⚠️ کلید خارجیِ **خودارجاع** باید بیرون از `Schema::create` اضافه شود.
         *
         * لاراول `->primary()` را به‌شکل `alter table … add primary key` و **پس از**
         * همهٔ FKهای همان `create` کامپایل می‌کند. روی PostgreSQL این یعنی FK به
         * ستونی اشاره می‌کند که هنوز یکتا نشده ⇒
         * `SQLSTATE[42830] there is no unique constraint matching given keys`.
         * روی SQLite دیده نمی‌شد چون شاخهٔ SQLite جدول را با یک دستور خام و
         * `primary key` درون‌خطی می‌سازد.
         */
        Schema::table('question_topics', function (Blueprint $table): void {
            $table->foreign('parent_id')->references('id')->on('question_topics')->restrictOnDelete();
        });

        $this->addCheck('question_topics', 'question_topics_status_valid', self::STATUS_CHECK);
        DB::statement('CREATE UNIQUE INDEX question_topics_root_slug_unique ON question_topics (subject_id, slug) WHERE parent_id IS NULL');

        Schema::create('questions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->uuid('subject_id');
            $table->uuid('chapter_id')->nullable();
            $table->uuid('lesson_id')->nullable();
            $table->uuid('topic_id')->nullable();
            $table->text('stem');
            $table->string('figure_key', 190)->nullable();
            $table->string('type', 24)->default('single');
            $table->string('difficulty', 16)->default('medium');
            $table->string('source', 24)->default('tapesh');
            $table->string('track', 24)->default('medicine');
            $table->unsignedSmallInteger('year')->nullable();
            $table->unsignedTinyInteger('exam_month')->nullable();
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->uuid('author_admin_id')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();

            $table->index(['subject_id', 'status', 'difficulty', 'id']);
            $table->index(['topic_id', 'status']);
            $table->index(['status', 'created_at']);
            $table->index(['source', 'status']);
            $table->index(['track', 'status']);
            $table->foreign('subject_id')->references('id')->on('subjects')->restrictOnDelete();
            $table->foreign('chapter_id')->references('id')->on('chapters')->nullOnDelete();
            $table->foreign('lesson_id')->references('id')->on('lessons')->nullOnDelete();
            $table->foreign('topic_id')->references('id')->on('question_topics')->nullOnDelete();
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('questions', 'questions_status_valid', self::STATUS_CHECK);
        $this->addCheck('questions', 'questions_type_valid', self::QUESTION_TYPE_CHECK);
        $this->addCheck('questions', 'questions_difficulty_valid', self::DIFFICULTY_CHECK);
        $this->addCheck('questions', 'questions_source_valid', self::SOURCE_CHECK);
        $this->addCheck('questions', 'questions_track_valid', self::TRACK_CHECK);
        $this->addCheck('questions', 'questions_version_positive', 'version >= 1');

        Schema::create('question_options', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('question_id');
            $table->unsignedSmallInteger('position');
            $table->string('label', 8)->nullable();
            $table->text('body');
            $table->timestampsTz();

            $table->unique(['question_id', 'position']);
            $table->foreign('question_id')->references('id')->on('questions')->cascadeOnDelete();
        });
        $this->addCheck('question_options', 'question_options_position_positive', 'position >= 1');

        Schema::create('question_keys', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('question_id');
            $table->uuid('correct_option_id');
            $table->json('explanation')->nullable();
            $table->unsignedInteger('key_version')->default(1);
            $table->timestampsTz();

            $table->unique('question_id');
            $table->foreign('question_id')->references('id')->on('questions')->cascadeOnDelete();
            $table->foreign('correct_option_id')->references('id')->on('question_options')->restrictOnDelete();
        });
        $this->addCheck('question_keys', 'question_keys_version_positive', 'key_version >= 1');

        Schema::create('question_attempts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('guest_id', 64)->nullable();
            $table->uuid('question_id');
            $table->uuid('selected_option_id')->nullable();
            $table->boolean('is_correct');
            $table->unsignedInteger('question_version')->default(1);
            $table->unsignedInteger('time_spent_sec')->nullable();
            $table->timestampTz('answered_at');
            $table->timestampsTz();

            $table->index(['user_id', 'question_id', 'answered_at']);
            $table->index(['guest_id', 'question_id', 'answered_at']);
            $table->index(['question_id', 'answered_at']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('question_id')->references('id')->on('questions')->restrictOnDelete();
            $table->foreign('selected_option_id')->references('id')->on('question_options')->restrictOnDelete();
        });
        $this->addCheck(
            'question_attempts',
            'question_attempts_actor_exclusive',
            '(user_id IS NOT NULL AND guest_id IS NULL) OR (user_id IS NULL AND guest_id IS NOT NULL)',
        );

        Schema::create('question_reports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->uuid('question_id');
            $table->string('kind', 24);
            $table->string('status', 16)->default('open');
            $table->text('body')->nullable();
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampsTz();

            $table->index(['status', 'created_at']);
            $table->index(['question_id', 'status']);
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('question_id')->references('id')->on('questions')->restrictOnDelete();
        });
        $this->addCheck('question_reports', 'question_reports_kind_valid', self::REPORT_KIND_CHECK);
        $this->addCheck('question_reports', 'question_reports_status_valid', self::REPORT_STATUS_CHECK);

        Schema::create('heart_rewards', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('question_attempt_id');
            $table->uuid('question_id');
            $table->unsignedSmallInteger('amount')->default(1);
            $table->string('attempt_key', 96);
            $table->timestampTz('awarded_at');
            $table->timestampsTz();

            $table->unique('question_attempt_id');
            $table->unique(['user_id', 'attempt_key']);
            $table->index(['user_id', 'awarded_at']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('question_attempt_id')->references('id')->on('question_attempts')->restrictOnDelete();
            $table->foreign('question_id')->references('id')->on('questions')->restrictOnDelete();
        });
        $this->addCheck('heart_rewards', 'heart_rewards_amount_positive', 'amount >= 1');
    }

    public function down(): void
    {
        Schema::dropIfExists('heart_rewards');
        Schema::dropIfExists('question_reports');
        Schema::dropIfExists('question_attempts');
        Schema::dropIfExists('question_keys');
        Schema::dropIfExists('question_options');
        Schema::dropIfExists('questions');
        Schema::dropIfExists('question_topics');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            self::sqliteTopic(),
            'CREATE UNIQUE INDEX question_topics_root_slug_unique ON question_topics (subject_id, slug) WHERE parent_id IS NULL',
            self::sqliteQuestion(),
            self::sqliteOption(),
            self::sqliteKey(),
            self::sqliteAttempt(),
            self::sqliteReport(),
            self::sqliteHeart(),
        ];
    }

    private static function sqliteTopic(): string
    {
        return <<<'SQL'
        CREATE TABLE question_topics (
            id varchar(36) not null primary key,
            subject_id varchar(36) not null,
            parent_id varchar(36) null,
            slug varchar(80) not null,
            title varchar(160) not null,
            sort_order integer not null default 0,
            status varchar(16) not null default 'draft',
            created_at datetime null,
            updated_at datetime null,
            constraint question_topics_subject_id_parent_id_slug_unique unique (subject_id, parent_id, slug),
            constraint question_topics_status_valid check (status in ('draft','published','archived')),
            foreign key (subject_id) references subjects (id) on delete restrict,
            foreign key (parent_id) references question_topics (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteQuestion(): string
    {
        return <<<'SQL'
        CREATE TABLE questions (
            id varchar(36) not null primary key,
            legacy_id varchar(64) null,
            subject_id varchar(36) not null,
            chapter_id varchar(36) null,
            lesson_id varchar(36) null,
            topic_id varchar(36) null,
            stem text not null,
            figure_key varchar(190) null,
            type varchar(24) not null default 'single',
            difficulty varchar(16) not null default 'medium',
            source varchar(24) not null default 'tapesh',
            track varchar(24) not null default 'medicine',
            year integer null,
            exam_month integer null,
            status varchar(16) not null default 'draft',
            version integer not null default 1,
            author_admin_id varchar(36) null,
            published_at datetime null,
            created_at datetime null,
            updated_at datetime null,
            constraint questions_legacy_id_unique unique (legacy_id),
            constraint questions_status_valid check (status in ('draft','published','archived')),
            constraint questions_type_valid check (type in ('single','concept','memorization','calculation','clinical','image','combined')),
            constraint questions_difficulty_valid check (difficulty in ('easy','medium','hard','very_hard')),
            constraint questions_source_valid check (source in ('official','comprehensive','tapesh')),
            constraint questions_track_valid check (track in ('medicine','dentistry')),
            constraint questions_version_positive check (version >= 1),
            foreign key (subject_id) references subjects (id) on delete restrict,
            foreign key (chapter_id) references chapters (id) on delete set null,
            foreign key (lesson_id) references lessons (id) on delete set null,
            foreign key (topic_id) references question_topics (id) on delete set null,
            foreign key (author_admin_id) references admins (id) on delete set null
        )
        SQL;
    }

    private static function sqliteOption(): string
    {
        return <<<'SQL'
        CREATE TABLE question_options (
            id varchar(36) not null primary key,
            question_id varchar(36) not null,
            position integer not null,
            label varchar(8) null,
            body text not null,
            created_at datetime null,
            updated_at datetime null,
            constraint question_options_question_id_position_unique unique (question_id, position),
            constraint question_options_position_positive check (position >= 1),
            foreign key (question_id) references questions (id) on delete cascade
        )
        SQL;
    }

    private static function sqliteKey(): string
    {
        return <<<'SQL'
        CREATE TABLE question_keys (
            id varchar(36) not null primary key,
            question_id varchar(36) not null,
            correct_option_id varchar(36) not null,
            explanation text null,
            key_version integer not null default 1,
            created_at datetime null,
            updated_at datetime null,
            constraint question_keys_question_id_unique unique (question_id),
            constraint question_keys_version_positive check (key_version >= 1),
            foreign key (question_id) references questions (id) on delete cascade,
            foreign key (correct_option_id) references question_options (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteAttempt(): string
    {
        return <<<'SQL'
        CREATE TABLE question_attempts (
            id varchar(36) not null primary key,
            user_id varchar(36) null,
            guest_id varchar(64) null,
            question_id varchar(36) not null,
            selected_option_id varchar(36) null,
            is_correct tinyint(1) not null,
            question_version integer not null default 1,
            time_spent_sec integer null,
            answered_at datetime not null,
            created_at datetime null,
            updated_at datetime null,
            constraint question_attempts_actor_exclusive check (
                (user_id is not null and guest_id is null) or (user_id is null and guest_id is not null)
            ),
            foreign key (user_id) references users (id) on delete restrict,
            foreign key (question_id) references questions (id) on delete restrict,
            foreign key (selected_option_id) references question_options (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteReport(): string
    {
        return <<<'SQL'
        CREATE TABLE question_reports (
            id varchar(36) not null primary key,
            user_id varchar(36) null,
            question_id varchar(36) not null,
            kind varchar(24) not null,
            status varchar(16) not null default 'open',
            body text null,
            resolved_at datetime null,
            created_at datetime null,
            updated_at datetime null,
            constraint question_reports_kind_valid check (kind in ('error','ambiguity','typo','wrong_answer','other')),
            constraint question_reports_status_valid check (status in ('open','reviewing','resolved')),
            foreign key (user_id) references users (id) on delete set null,
            foreign key (question_id) references questions (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteHeart(): string
    {
        return <<<'SQL'
        CREATE TABLE heart_rewards (
            id varchar(36) not null primary key,
            user_id varchar(36) not null,
            question_attempt_id varchar(36) not null,
            question_id varchar(36) not null,
            amount integer not null default 1,
            attempt_key varchar(96) not null,
            awarded_at datetime not null,
            created_at datetime null,
            updated_at datetime null,
            constraint heart_rewards_question_attempt_id_unique unique (question_attempt_id),
            constraint heart_rewards_user_id_attempt_key_unique unique (user_id, attempt_key),
            constraint heart_rewards_amount_positive check (amount >= 1),
            foreign key (user_id) references users (id) on delete restrict,
            foreign key (question_attempt_id) references question_attempts (id) on delete restrict,
            foreign key (question_id) references questions (id) on delete restrict
        )
        SQL;
    }
};
