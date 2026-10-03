<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۶ — یادداشت شخصی کاربر و مرور G5.
 *
 *   user_notes     یادداشت چهارحالته فرانت (text/checklist/qa/table) — jsonb برای
 *                  items/pairs/table؛ HTML ذخیره نمی‌شود، قرارداد plain text است (§51).
 *   review_items   آیتم مرور — `UNIQUE(user_id, source_type, source_id)` رقابت
 *                  دوباره‌سازی را در سطح دیتابیس می‌بندد (§68). با Flashcards
 *                  اشتباه گرفته نمی‌شود: اینجا فقط مرحلهٔ G5 است، نه الگوریتم SR.
 *
 * مالکیت همیشه از سشن؛ هیچ کوئری‌ای user_id را از کلاینت نمی‌گیرد (§32).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const NOTE_KIND_CHECK = "kind in ('text','checklist','qa','table')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE user_notes (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                kind varchar(16) not null default 'text',
                title varchar(240) null,
                body text null,
                content text null,
                subject_id varchar(40) null,
                tags text null,
                color varchar(16) null,
                pinned integer not null default 0,
                source_type varchar(24) null,
                source_id varchar(64) null,
                source_title varchar(240) null,
                created_at datetime null,
                updated_at datetime null,
                constraint user_notes_kind_valid check (kind in ('text','checklist','qa','table')),
                constraint user_notes_source_type_valid check (source_type is null or source_type in ('lesson','question','article','wiki','book','other')),
                constraint user_notes_color_valid check (color is null or color in ('#e26d6d','#5b8cc7','#77b787','#e0b45c','#937fcd','#c2a48c')),
                foreign key (user_id) references users (id) on delete cascade
            )
            SQL);

            DB::statement('CREATE INDEX user_notes_user_id_updated_at_index ON user_notes (user_id, updated_at)');
            DB::statement('CREATE INDEX user_notes_user_id_pinned_index ON user_notes (user_id, pinned)');

            DB::statement(<<<'SQL'
            CREATE TABLE review_items (
                id varchar(36) not null primary key,
                user_id varchar(36) not null,
                source_type varchar(32) not null,
                source_id varchar(64) not null,
                title varchar(240) not null,
                subject varchar(40) null,
                description text null,
                activity_type varchar(16) not null default 'other',
                stage integer not null default 1,
                status varchar(16) not null default 'active',
                learned_at datetime not null,
                last_reviewed_at datetime null,
                due_at datetime null,
                completed_reviews integer not null default 0,
                completed_at datetime null,
                history text null,
                created_at datetime null,
                updated_at datetime null,
                constraint review_items_user_id_source_type_source_id_unique unique (user_id, source_type, source_id),
                constraint review_items_activity_type_valid check (activity_type in ('learning','test','flashcard','note','other')),
                constraint review_items_status_valid check (status in ('active','mastered')),
                constraint review_items_stage_range check (stage between 1 and 5),
                constraint review_items_completed_reviews_non_negative check (completed_reviews >= 0),
                foreign key (user_id) references users (id) on delete cascade
            )
            SQL);

            DB::statement('CREATE INDEX review_items_user_id_status_due_at_index ON review_items (user_id, status, due_at)');

            return;
        }

        Schema::create('user_notes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('kind', 16)->default('text');
            $table->string('title', 240)->nullable();
            $table->text('body')->nullable();
            $table->jsonb('content')->nullable();
            $table->string('subject_id', 40)->nullable();
            $table->jsonb('tags')->nullable();
            $table->string('color', 16)->nullable();
            $table->boolean('pinned')->default(false);
            $table->string('source_type', 24)->nullable();
            $table->string('source_id', 64)->nullable();
            $table->string('source_title', 240)->nullable();
            $table->timestampsTz();

            $table->index(['user_id', 'updated_at']);
            $table->index(['user_id', 'pinned']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
        $this->addCheck('user_notes', 'user_notes_kind_valid', self::NOTE_KIND_CHECK);
        $this->addCheck('user_notes', 'user_notes_source_type_valid', "source_type is null or source_type in ('lesson','question','article','wiki','book','other')");
        $this->addCheck('user_notes', 'user_notes_color_valid', "color is null or color in ('#e26d6d','#5b8cc7','#77b787','#e0b45c','#937fcd','#c2a48c')");

        Schema::create('review_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('source_type', 32);
            $table->string('source_id', 64);
            $table->string('title', 240);
            $table->string('subject', 40)->nullable();
            $table->text('description')->nullable();
            $table->string('activity_type', 16)->default('other');
            $table->unsignedSmallInteger('stage')->default(1);
            $table->string('status', 16)->default('active');
            $table->timestampTz('learned_at');
            $table->timestampTz('last_reviewed_at')->nullable();
            $table->timestampTz('due_at')->nullable();
            $table->unsignedSmallInteger('completed_reviews')->default(0);
            $table->timestampTz('completed_at')->nullable();
            $table->jsonb('history')->nullable();
            $table->timestampsTz();

            $table->unique(['user_id', 'source_type', 'source_id']);
            $table->index(['user_id', 'status', 'due_at']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
        $this->addCheck('review_items', 'review_items_activity_type_valid', "activity_type in ('learning','test','flashcard','note','other')");
        $this->addCheck('review_items', 'review_items_status_valid', "status in ('active','mastered')");
        $this->addCheck('review_items', 'review_items_stage_range', 'stage between 1 and 5');
        $this->addCheck('review_items', 'review_items_completed_reviews_non_negative', 'completed_reviews >= 0');
    }

    public function down(): void
    {
        Schema::dropIfExists('review_items');
        Schema::dropIfExists('user_notes');
    }
};
