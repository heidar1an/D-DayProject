<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۶ — Feedback.
 *
 *   feedback           گزارش کاربر یا مهمان؛ بدنه plain text (§51) و هرگز در
 *                      Log/کش عمومی/event تحلیلی نمی‌رود (§50).
 *   feedback_replies   پاسخ مدیر — `admin_id` همیشه از سشن ادمین، نه بدنه (§49).
 *
 * Guest Identity ساختگی نیست: `guest_ref` رشتهٔ شفافِ مرورگر خود کاربر است
 * (`tapesh:feedback-guest`)، فقط برای پیوند پاسخ به همان مرورگر (§46).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE feedback (
                id varchar(36) not null primary key,
                user_id varchar(36) null,
                guest_ref varchar(64) null,
                source varchar(32) not null,
                subject varchar(240) null,
                category varchar(64) null,
                body text not null,
                meta text null,
                status varchar(16) not null default 'open',
                user_read_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint feedback_source_valid check (source in ('support','test-bank','coordinated-exam','comprehensive','micro','question-lab','intl-courses')),
                constraint feedback_status_valid check (status in ('open','answered','closed')),
                foreign key (user_id) references users (id) on delete set null
            )
            SQL);

            DB::statement('CREATE INDEX feedback_status_created_at_index ON feedback (status, created_at)');
            DB::statement('CREATE INDEX feedback_user_id_created_at_index ON feedback (user_id, created_at)');
            DB::statement('CREATE INDEX feedback_guest_ref_index ON feedback (guest_ref)');

            DB::statement(<<<'SQL'
            CREATE TABLE feedback_replies (
                id varchar(36) not null primary key,
                feedback_id varchar(36) not null,
                admin_id varchar(36) null,
                body text not null,
                created_at datetime null,
                updated_at datetime null,
                foreign key (feedback_id) references feedback (id) on delete cascade,
                foreign key (admin_id) references admins (id) on delete set null
            )
            SQL);

            DB::statement('CREATE INDEX feedback_replies_feedback_id_created_at_index ON feedback_replies (feedback_id, created_at)');

            return;
        }

        Schema::create('feedback', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('guest_ref', 64)->nullable();
            $table->string('source', 32);
            $table->string('subject', 240)->nullable();
            $table->string('category', 64)->nullable();
            $table->text('body');
            $table->jsonb('meta')->nullable();
            $table->string('status', 16)->default('open');
            $table->timestampTz('user_read_at')->nullable();
            $table->timestampsTz();

            $table->index(['status', 'created_at']);
            $table->index(['user_id', 'created_at']);
            $table->index('guest_ref');
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
        $this->addCheck('feedback', 'feedback_source_valid', "source in ('support','test-bank','coordinated-exam','comprehensive','micro','question-lab','intl-courses')");
        $this->addCheck('feedback', 'feedback_status_valid', "status in ('open','answered','closed')");

        Schema::create('feedback_replies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('feedback_id');
            $table->uuid('admin_id')->nullable();
            $table->text('body');
            $table->timestampsTz();

            $table->index(['feedback_id', 'created_at']);
            $table->foreign('feedback_id')->references('id')->on('feedback')->cascadeOnDelete();
            $table->foreign('admin_id')->references('id')->on('admins')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_replies');
        Schema::dropIfExists('feedback');
    }
};
