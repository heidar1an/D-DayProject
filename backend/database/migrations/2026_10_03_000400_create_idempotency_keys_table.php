<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * کلیدهای idempotency — زیرساخت مشترک فاز ۵ و ۶.
 *
 * چرا یک جدول مشترک و نه دو راه‌حل جدا:
 *   • فاز ۵ به آن نیاز دارد تا autosave تکراری `seconds_spent` را چند برابر نکند.
 *   • فاز ۶ به آن نیاز دارد تا double-click/retry شبکه دو Question Attempt نسازد.
 *   • هر دو یک الگو دارند: «همان بازیگر + همان کلید + همان payload ⇒ همان پاسخ».
 *
 * قواعد:
 *   • `UNIQUE(scope, actor_key, request_key)` تنها تضمین واقعیِ ضدِ تکرار است؛
 *     بررسی «قبلاً دیدم؟» در کد به‌تنهایی race-safe نیست.
 *   • `request_hash` = SHA-256 بدنهٔ نرمال‌شده. اگر همان کلید با payload متفاوت
 *     بیاید ⇒ 409 (تعارض)، نه بازنویسی بی‌صدا.
 *   • `response_body` پاسخِ ذخیره‌شدهٔ همان درخواست است تا retry دقیقاً همان
 *     نتیجه را بگیرد (مثلاً همان `isCorrect` و همان بازگشایی).
 *   • `expires_at` اجباری است: این جدول transient است، نه ledger دائمی.
 *   • هیچ دادهٔ حساسی اینجا ذخیره نمی‌شود — پاسخ‌های ذخیره‌شده همان چیزی است که
 *     به کلاینت برگشته، یعنی چیزی که کلاینت از قبل دیده است.
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

        Schema::create('idempotency_keys', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('scope', 48);
            $table->string('actor_key', 96);
            $table->string('request_key', 96);
            $table->char('request_hash', 64);
            $table->string('state', 16)->default('reserved');
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->json('response_body')->nullable();
            $table->timestampTz('expires_at');
            $table->timestampsTz();

            $table->unique(['scope', 'actor_key', 'request_key']);
            $table->index('expires_at');
        });
        $this->addCheck('idempotency_keys', 'idempotency_keys_state_valid', "state in ('reserved','completed')");
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            <<<'SQL'
            CREATE TABLE idempotency_keys (
                id varchar(36) not null primary key,
                scope varchar(48) not null,
                actor_key varchar(96) not null,
                request_key varchar(96) not null,
                request_hash varchar(64) not null,
                state varchar(16) not null default 'reserved',
                response_status integer null,
                response_body text null,
                expires_at datetime not null,
                created_at datetime null,
                updated_at datetime null,
                constraint idempotency_keys_scope_actor_key_request_key_unique unique (scope, actor_key, request_key),
                constraint idempotency_keys_state_valid check (state in ('reserved','completed'))
            )
            SQL,
            'CREATE INDEX idempotency_keys_expires_at_index ON idempotency_keys (expires_at)',
        ];
    }
};
