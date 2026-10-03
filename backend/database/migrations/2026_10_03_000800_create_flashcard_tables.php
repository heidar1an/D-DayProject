<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۹ — فلش‌کارت.
 *
 * سه سطح **جدا** (الزام فاز ۹ §4):
 *   `flashcards`        → تعریف کارت (محتوا)
 *   `flashcard_states`  → وضعیت فعلی یک کاربر نسبت به یک کارت (mutable)
 *   `flashcard_reviews` → تاریخچهٔ مرور (immutable، بدون updated_at)
 *
 * تصمیم‌های کلیدی:
 *   • `flashcard_decks.owner_user_id = NULL` یعنی «دک رسمی تپش». CHECK دیتابیس
 *     تضمین می‌کند دک رسمی همیشه `public` باشد — دک رسمیِ خصوصی بی‌معنا است و
 *     نمی‌خواهیم فقط در سرویس چک شود.
 *   • حذف فیزیکی **زنجیره‌ای نیست**: `flashcards.deck_id` و
 *     `flashcard_states.card_id` و `flashcard_reviews.state_id` همه `RESTRICT`
 *     هستند. یعنی دک تا وقتی کارت دارد و کارت تا وقتی وضعیت/تاریخچه دارد حذف
 *     نمی‌شود؛ مسیر درست `status = archived` است. این جلوی «مرور پس از حذف دک»
 *     را در سطح دیتابیس می‌گیرد، نه فقط در سرویس.
 *   • `UNIQUE(deck_id, position)` برای ترتیب قطعی، `UNIQUE(user_id, card_id)`
 *     برای یک وضعیت به‌ازای هر کاربر/کارت، و `UNIQUE(request_key)` برای
 *     idempotency در سطح دیتابیس.
 *   • `flashcard_reviews` هیچ `updated_at` ندارد — رکورد immutable است.
 *   • `legacy_id` برای crosswalk با دادهٔ localStorage در صورت نیاز به مهاجرت؛
 *     خودِ مهاجرت در این فاز اجرا نمی‌شود.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const DECK_STATUS_CHECK = "status in ('draft','published','archived')";

    private const DECK_VISIBILITY_CHECK = "visibility in ('private','public')";

    private const CARD_STATUS_CHECK = "status in ('active','suspended','archived')";

    private const STATE_CHECK = "state in ('new','learning','review','relearning','mastered','suspended','archived')";

    private const RATING_CHECK = "rating in ('again','hard','good','easy')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('flashcard_decks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            // NULL = دک رسمی TAPESH؛ غیر NULL = دک شخصی کاربر.
            $table->uuid('owner_user_id')->nullable();
            $table->uuid('author_admin_id')->nullable();
            $table->string('title', 160);
            $table->text('description')->nullable();
            $table->string('status', 16)->default('draft');
            $table->string('visibility', 16)->default('private');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();

            $table->index(['owner_user_id', 'status']);
            $table->index(['status', 'visibility', 'id']);
            $table->foreign('owner_user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('flashcard_decks', 'flashcard_decks_status_valid', self::DECK_STATUS_CHECK);
        $this->addCheck('flashcard_decks', 'flashcard_decks_visibility_valid', self::DECK_VISIBILITY_CHECK);
        $this->addCheck('flashcard_decks', 'flashcard_decks_version_positive', 'version >= 1');
        // دک رسمی (بدون مالک) نمی‌تواند خصوصی باشد.
        $this->addCheck(
            'flashcard_decks',
            'flashcard_decks_official_is_public',
            'owner_user_id IS NOT NULL OR visibility = \'public\'',
        );

        Schema::create('flashcards', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->uuid('deck_id');
            $table->text('front');
            $table->text('back');
            $table->unsignedInteger('position');
            $table->string('status', 16)->default('active');
            $table->timestampsTz();

            $table->unique(['deck_id', 'position']);
            $table->index(['deck_id', 'status', 'position']);
            $table->foreign('deck_id')->references('id')->on('flashcard_decks')->restrictOnDelete();
        });
        $this->addCheck('flashcards', 'flashcards_position_positive', 'position >= 1');
        $this->addCheck('flashcards', 'flashcards_status_valid', self::CARD_STATUS_CHECK);

        Schema::create('flashcard_states', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('card_id');
            /*
             * نسخهٔ الگوریتمی که **آخرین بار** این وضعیت را محاسبه کرده. برای
             * اینکه بدانیم بازمحاسبه با V2 مجاز است یا نه.
             */
            $table->string('algorithm_version', 32);
            $table->string('state', 16)->default('new');
            $table->timestampTz('due_at')->nullable();
            $table->decimal('interval_days', 10, 3)->default(0);
            $table->unsignedInteger('interval_minutes')->default(0);
            $table->decimal('ease', 4, 2)->default(2.5);
            $table->unsignedInteger('review_count')->default(0);
            $table->unsignedInteger('lapse_count')->default(0);
            $table->unsignedInteger('correct_count')->default(0);
            $table->unsignedInteger('incorrect_count')->default(0);
            $table->unsignedSmallInteger('learning_step')->default(0);
            $table->decimal('difficulty', 4, 3)->default(0.3);
            $table->decimal('stability', 10, 3)->default(0);
            $table->unsignedTinyInteger('mastery_score')->default(0);
            $table->boolean('suspended')->default(false);
            $table->timestampTz('buried_until')->nullable();
            $table->boolean('bookmarked')->default(false);
            $table->timestampTz('last_reviewed_at')->nullable();
            // optimistic lock سطح وضعیت — کلاینت نسخه نمی‌فرستد، ولی سرویس
            // می‌تواند از آن برای تشخیص نوشتن هم‌زمان استفاده کند.
            $table->unsignedInteger('version')->default(1);
            $table->timestampsTz();

            $table->unique(['user_id', 'card_id']);
            $table->index(['user_id', 'due_at']);
            $table->index(['user_id', 'suspended', 'due_at']);
            $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('card_id')->references('id')->on('flashcards')->restrictOnDelete();
        });
        $this->addCheck('flashcard_states', 'flashcard_states_state_valid', self::STATE_CHECK);
        $this->addCheck('flashcard_states', 'flashcard_states_ease_floor', 'ease >= 1.3');
        $this->addCheck('flashcard_states', 'flashcard_states_interval_non_negative', 'interval_days >= 0');
        $this->addCheck('flashcard_states', 'flashcard_states_mastery_range', 'mastery_score <= 100');
        $this->addCheck('flashcard_states', 'flashcard_states_difficulty_range', 'difficulty >= 0 AND difficulty <= 1');

        Schema::create('flashcard_reviews', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('state_id');
            $table->string('rating', 8);
            $table->string('previous_state', 16)->nullable();
            $table->string('new_state', 16);
            $table->timestampTz('previous_due_at')->nullable();
            $table->timestampTz('next_due_at');
            $table->unsignedInteger('previous_interval_minutes')->nullable();
            $table->unsignedInteger('next_interval_minutes');
            $table->decimal('previous_ease', 4, 2)->nullable();
            $table->decimal('next_ease', 4, 2);
            $table->string('algorithm_version', 32);
            $table->timestampTz('reviewed_at');
            // کلید idempotency — یکتایی در دیتابیس، نه فقط در کد.
            $table->string('request_key', 96)->nullable()->unique();
            // immutable: فقط created_at، بدون updated_at.
            $table->timestampTz('created_at')->nullable();

            $table->index(['state_id', 'reviewed_at']);
            $table->index(['reviewed_at']);
            $table->foreign('state_id')->references('id')->on('flashcard_states')->restrictOnDelete();
        });
        $this->addCheck('flashcard_reviews', 'flashcard_reviews_rating_valid', self::RATING_CHECK);
        $this->addCheck('flashcard_reviews', 'flashcard_reviews_interval_non_negative', 'next_interval_minutes >= 0');
        $this->addCheck('flashcard_reviews', 'flashcard_reviews_ease_floor', 'next_ease >= 1.3');
    }

    public function down(): void
    {
        Schema::dropIfExists('flashcard_reviews');
        Schema::dropIfExists('flashcard_states');
        Schema::dropIfExists('flashcards');
        Schema::dropIfExists('flashcard_decks');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            self::sqliteDeck(),
            self::sqliteCard(),
            self::sqliteState(),
            self::sqliteReview(),
        ];
    }

    private static function sqliteDeck(): string
    {
        return <<<'SQL'
        CREATE TABLE flashcard_decks (
            id varchar(36) not null primary key,
            legacy_id varchar(64) null,
            owner_user_id varchar(36) null,
            author_admin_id varchar(36) null,
            title varchar(160) not null,
            description text null,
            status varchar(16) not null default 'draft',
            visibility varchar(16) not null default 'private',
            version integer not null default 1,
            published_at datetime null,
            created_at datetime null,
            updated_at datetime null,
            constraint flashcard_decks_legacy_id_unique unique (legacy_id),
            constraint flashcard_decks_status_valid check (status in ('draft','published','archived')),
            constraint flashcard_decks_visibility_valid check (visibility in ('private','public')),
            constraint flashcard_decks_version_positive check (version >= 1),
            constraint flashcard_decks_official_is_public check (owner_user_id is not null or visibility = 'public'),
            foreign key (owner_user_id) references users (id) on delete restrict,
            foreign key (author_admin_id) references admins (id) on delete set null
        )
        SQL;
    }

    private static function sqliteCard(): string
    {
        return <<<'SQL'
        CREATE TABLE flashcards (
            id varchar(36) not null primary key,
            legacy_id varchar(64) null,
            deck_id varchar(36) not null,
            front text not null,
            back text not null,
            position integer not null,
            status varchar(16) not null default 'active',
            created_at datetime null,
            updated_at datetime null,
            constraint flashcards_legacy_id_unique unique (legacy_id),
            constraint flashcards_deck_id_position_unique unique (deck_id, position),
            constraint flashcards_position_positive check (position >= 1),
            constraint flashcards_status_valid check (status in ('active','suspended','archived')),
            foreign key (deck_id) references flashcard_decks (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteState(): string
    {
        return <<<'SQL'
        CREATE TABLE flashcard_states (
            id varchar(36) not null primary key,
            user_id varchar(36) not null,
            card_id varchar(36) not null,
            algorithm_version varchar(32) not null,
            state varchar(16) not null default 'new',
            due_at datetime null,
            interval_days numeric not null default 0,
            interval_minutes integer not null default 0,
            ease numeric not null default 2.5,
            review_count integer not null default 0,
            lapse_count integer not null default 0,
            correct_count integer not null default 0,
            incorrect_count integer not null default 0,
            learning_step integer not null default 0,
            difficulty numeric not null default 0.3,
            stability numeric not null default 0,
            mastery_score integer not null default 0,
            suspended tinyint(1) not null default 0,
            buried_until datetime null,
            bookmarked tinyint(1) not null default 0,
            last_reviewed_at datetime null,
            version integer not null default 1,
            created_at datetime null,
            updated_at datetime null,
            constraint flashcard_states_user_id_card_id_unique unique (user_id, card_id),
            constraint flashcard_states_state_valid check (state in ('new','learning','review','relearning','mastered','suspended','archived')),
            constraint flashcard_states_ease_floor check (ease >= 1.3),
            constraint flashcard_states_interval_non_negative check (interval_days >= 0),
            constraint flashcard_states_mastery_range check (mastery_score <= 100),
            constraint flashcard_states_difficulty_range check (difficulty >= 0 and difficulty <= 1),
            foreign key (user_id) references users (id) on delete restrict,
            foreign key (card_id) references flashcards (id) on delete restrict
        )
        SQL;
    }

    private static function sqliteReview(): string
    {
        return <<<'SQL'
        CREATE TABLE flashcard_reviews (
            id varchar(36) not null primary key,
            state_id varchar(36) not null,
            rating varchar(8) not null,
            previous_state varchar(16) null,
            new_state varchar(16) not null,
            previous_due_at datetime null,
            next_due_at datetime not null,
            previous_interval_minutes integer null,
            next_interval_minutes integer not null,
            previous_ease numeric null,
            next_ease numeric not null,
            algorithm_version varchar(32) not null,
            reviewed_at datetime not null,
            request_key varchar(96) null,
            created_at datetime null,
            constraint flashcard_reviews_request_key_unique unique (request_key),
            constraint flashcard_reviews_rating_valid check (rating in ('again','hard','good','easy')),
            constraint flashcard_reviews_interval_non_negative check (next_interval_minutes >= 0),
            constraint flashcard_reviews_ease_floor check (next_ease >= 1.3),
            foreign key (state_id) references flashcard_states (id) on delete restrict
        )
        SQL;
    }
};
