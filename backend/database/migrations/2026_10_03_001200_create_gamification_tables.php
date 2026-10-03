<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۴ — لیگ و گیمیفیکیشن.
 *
 * مرز مالکیت (Blueprint فاز ۱۴):
 *   • `xp_transactions` = **دفتر کل نامتغیر**. منبع حقیقت XP. هیچ update/delete
 *     مسیری ندارد (سرویس و مدل هر دو مانع‌اند). تصحیح آینده = رکورد جدید با
 *     `admin_adjustment`، نه ویرایش رکورد قبلی.
 *   • `league_memberships.xp_total` = **projection** مشتق‌شده؛ اگر mismatch شد،
 *     فرمان `gamification:reconcile-xp` از روی دفتر کل بازمی‌سازد.
 *   • قلب (heart_rewards) و XP دو ارز جدایند — هیچ تبدیل خودکاری وجود ندارد.
 *
 * تصمیم‌های داده:
 *   • `xp_transactions.request_key` UNIQUE = تضمین idempotency در سطح دیتابیس؛
 *     دو درخواست هم‌زمان با یک کلید ⇒ یکی موفق، یکی UniqueConstraintViolation
 *     که سرویس به «از قبل اعمال‌شده» ترجمه می‌کند.
 *   • فصل لیگ هویت weekly دارد (`2026-W42` مانند) و به‌صورت lazy ساخته می‌شود؛
 *     هیچ season الکی seed نمی‌شود.
 *   • `user_challenges` برای هر (کاربر، چالش، دورهٔ زمانی) یک رکورد — UNIQUE.
 *   • `streaks.last_day` از نوع date است: باکت روز بر اساس ساعت **سرور** ساخته
 *     می‌شود، هرگز از ورودی کلاینت.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const SEASON_STATUS_CHECK = "status in ('upcoming','active','ended','archived')";

    private const XP_SOURCE_CHECK = "source_type in ('page_completed','question_correct','exam_finished','study_session','challenge_completed','admin_adjustment')";

    private const CHALLENGE_KIND_CHECK = "kind in ('daily','weekly')";

    private const CHALLENGE_METRIC_CHECK = "metric in ('steps_completed','lessons_completed','questions_correct','exams_finished','study_minutes')";

    private const USER_CHALLENGE_STATUS_CHECK = "status in ('active','completed','expired')";

    private const STREAK_KIND_CHECK = "kind in ('study')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('league_seasons', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('slug', 64)->unique();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->string('status', 16)->default('upcoming');
            $table->timestampsTz();

            $table->index(['status', 'starts_at']);
        });
        $this->addCheck('league_seasons', 'league_seasons_status_valid', self::SEASON_STATUS_CHECK);
        $this->addCheck('league_seasons', 'league_seasons_range_ordered', 'ends_at > starts_at');

        Schema::create('league_memberships', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('season_id');
            $table->uuid('user_id');
            $table->uuid('university_id')->nullable();
            $table->unsignedBigInteger('xp_total')->default(0);
            $table->timestampsTz();

            $table->unique(['season_id', 'user_id']);
            $table->index(['season_id', 'xp_total']);
            $table->foreign('season_id')->references('id')->on('league_seasons')->restrictOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('university_id')->references('id')->on('universities')->nullOnDelete();
        });
        $this->addCheck('league_memberships', 'league_memberships_xp_non_negative', 'xp_total >= 0');

        Schema::create('xp_transactions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('season_id')->nullable();
            $table->string('source_type', 32);
            $table->string('source_id', 64);
            $table->integer('delta');
            $table->string('request_key', 96)->unique();
            $table->timestampTz('created_at');

            $table->index(['user_id', 'created_at']);
            $table->index(['season_id', 'user_id']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('season_id')->references('id')->on('league_seasons')->restrictOnDelete();
        });
        $this->addCheck('xp_transactions', 'xp_transactions_source_valid', self::XP_SOURCE_CHECK);
        $this->addCheck('xp_transactions', 'xp_transactions_delta_non_zero', 'delta <> 0');

        Schema::create('achievements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 64)->unique();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->string('status', 16)->default('active');
            $table->timestampsTz();
        });
        $this->addCheck('achievements', 'achievements_status_valid', "status in ('active','inactive')");

        Schema::create('user_achievements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('achievement_id');
            $table->timestampTz('unlocked_at');
            $table->timestampTz('created_at');

            $table->unique(['user_id', 'achievement_id']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('achievement_id')->references('id')->on('achievements')->restrictOnDelete();
        });

        Schema::create('challenges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 64)->unique();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->string('kind', 16);
            $table->string('metric', 32);
            $table->unsignedInteger('target');
            $table->unsignedInteger('xp_reward');
            $table->string('status', 16)->default('active');
            $table->timestampsTz();
        });
        $this->addCheck('challenges', 'challenges_kind_valid', self::CHALLENGE_KIND_CHECK);
        $this->addCheck('challenges', 'challenges_metric_valid', self::CHALLENGE_METRIC_CHECK);
        $this->addCheck('challenges', 'challenges_status_valid', "status in ('active','inactive')");
        $this->addCheck('challenges', 'challenges_target_positive', 'target >= 1');
        $this->addCheck('challenges', 'challenges_reward_positive', 'xp_reward >= 1');

        Schema::create('user_challenges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('challenge_id');
            $table->string('period_key', 16);
            $table->string('status', 16)->default('active');
            $table->unsignedInteger('progress')->default(0);
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();

            $table->unique(['user_id', 'challenge_id', 'period_key']);
            $table->index(['user_id', 'status']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('challenge_id')->references('id')->on('challenges')->restrictOnDelete();
        });
        $this->addCheck('user_challenges', 'user_challenges_status_valid', self::USER_CHALLENGE_STATUS_CHECK);
        $this->addCheck('user_challenges', 'user_challenges_progress_non_negative', 'progress >= 0');
        $this->addCheck(
            'user_challenges',
            'user_challenges_completed_requires_time',
            "(status = 'completed') = (completed_at is not null)",
        );

        Schema::create('streaks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('kind', 16);
            $table->unsignedInteger('current_count')->default(0);
            $table->unsignedInteger('longest_count')->default(0);
            $table->date('last_day')->nullable();
            $table->timestampsTz();

            $table->unique(['user_id', 'kind']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
        });
        $this->addCheck('streaks', 'streaks_kind_valid', self::STREAK_KIND_CHECK);
        $this->addCheck('streaks', 'streaks_counts_non_negative', 'current_count >= 0 and longest_count >= 0');
    }

    public function down(): void
    {
        Schema::dropIfExists('streaks');
        Schema::dropIfExists('user_challenges');
        Schema::dropIfExists('challenges');
        Schema::dropIfExists('user_achievements');
        Schema::dropIfExists('achievements');
        Schema::dropIfExists('xp_transactions');
        Schema::dropIfExists('league_memberships');
        Schema::dropIfExists('league_seasons');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            <<<'SQL'
            CREATE TABLE league_seasons (
                id varchar(36) not null primary key,
                slug varchar(64) not null,
                starts_at datetime not null,
                ends_at datetime not null,
                status varchar(16) not null default 'upcoming',
                created_at datetime null,
                updated_at datetime null,
                constraint league_seasons_slug_unique unique (slug),
                constraint league_seasons_status_valid check (status in ('upcoming','active','ended','archived')),
                constraint league_seasons_range_ordered check (ends_at > starts_at)
            )
            SQL,
            'CREATE INDEX league_seasons_status_starts_at_index ON league_seasons (status, starts_at)',
            <<<'SQL'
            CREATE TABLE league_memberships (
                id varchar(36) not null primary key,
                season_id varchar(36) not null,
                user_id varchar(36) not null,
                university_id varchar(36) null,
                xp_total integer not null default 0,
                created_at datetime null,
                updated_at datetime null,
                constraint league_memberships_season_id_user_id_unique unique (season_id, user_id),
                constraint league_memberships_xp_non_negative check (xp_total >= 0),
                foreign key (season_id) references league_seasons (id) on delete restrict,
                foreign key (user_id) references users (id) on delete restrict,
                foreign key (university_id) references universities (id) on delete set null
            )
            SQL,
            'CREATE INDEX league_memberships_season_id_xp_total_index ON league_memberships (season_id, xp_total)',
            <<<'SQL'
            CREATE TABLE xp_transactions (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                season_id varchar(36) null,
                source_type varchar(32) not null,
                source_id varchar(64) not null,
                delta integer not null,
                request_key varchar(96) not null,
                created_at datetime not null,
                constraint xp_transactions_request_key_unique unique (request_key),
                constraint xp_transactions_source_valid check (source_type in ('page_completed','question_correct','exam_finished','study_session','challenge_completed','admin_adjustment')),
                constraint xp_transactions_delta_non_zero check (delta <> 0),
                foreign key (user_id) references users (id) on delete restrict,
                foreign key (season_id) references league_seasons (id) on delete restrict
            )
            SQL,
            'CREATE INDEX xp_transactions_user_id_created_at_index ON xp_transactions (user_id, created_at)',
            'CREATE INDEX xp_transactions_season_id_user_id_index ON xp_transactions (season_id, user_id)',
            <<<'SQL'
            CREATE TABLE achievements (
                id varchar(36) not null primary key,
                code varchar(64) not null,
                name varchar(120) not null,
                description text null,
                status varchar(16) not null default 'active',
                created_at datetime null,
                updated_at datetime null,
                constraint achievements_code_unique unique (code),
                constraint achievements_status_valid check (status in ('active','inactive'))
            )
            SQL,
            <<<'SQL'
            CREATE TABLE user_achievements (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                achievement_id varchar(36) not null,
                unlocked_at datetime not null,
                created_at datetime null,
                constraint user_achievements_user_id_achievement_id_unique unique (user_id, achievement_id),
                foreign key (user_id) references users (id) on delete restrict,
                foreign key (achievement_id) references achievements (id) on delete restrict
            )
            SQL,
            <<<'SQL'
            CREATE TABLE challenges (
                id varchar(36) not null primary key,
                code varchar(64) not null,
                name varchar(120) not null,
                description text null,
                kind varchar(16) not null,
                metric varchar(32) not null,
                target integer not null,
                xp_reward integer not null,
                status varchar(16) not null default 'active',
                created_at datetime null,
                updated_at datetime null,
                constraint challenges_code_unique unique (code),
                constraint challenges_kind_valid check (kind in ('daily','weekly')),
                constraint challenges_metric_valid check (metric in ('steps_completed','lessons_completed','questions_correct','exams_finished','study_minutes')),
                constraint challenges_status_valid check (status in ('active','inactive')),
                constraint challenges_target_positive check (target >= 1),
                constraint challenges_reward_positive check (xp_reward >= 1)
            )
            SQL,
            <<<'SQL'
            CREATE TABLE user_challenges (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                challenge_id varchar(36) not null,
                period_key varchar(16) not null,
                status varchar(16) not null default 'active',
                progress integer not null default 0,
                completed_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint user_challenges_user_id_challenge_id_period_key_unique unique (user_id, challenge_id, period_key),
                constraint user_challenges_status_valid check (status in ('active','completed','expired')),
                constraint user_challenges_progress_non_negative check (progress >= 0),
                constraint user_challenges_completed_requires_time check ((status = 'completed') = (completed_at is not null)),
                foreign key (user_id) references users (id) on delete restrict,
                foreign key (challenge_id) references challenges (id) on delete restrict
            )
            SQL,
            'CREATE INDEX user_challenges_user_id_status_index ON user_challenges (user_id, status)',
            <<<'SQL'
            CREATE TABLE streaks (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                kind varchar(16) not null,
                current_count integer not null default 0,
                longest_count integer not null default 0,
                last_day date null,
                created_at datetime null,
                updated_at datetime null,
                constraint streaks_user_id_kind_unique unique (user_id, kind),
                constraint streaks_kind_valid check (kind in ('study')),
                constraint streaks_counts_non_negative check (current_count >= 0 and longest_count >= 0),
                foreign key (user_id) references users (id) on delete restrict
            )
            SQL,
        ];
    }
};
