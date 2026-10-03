<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * سشن‌های احراز هویت — سشن سرور-کنترل‌شده (Blueprint §8).
 *
 * قواعد قطعی:
 *   • توکن خام **هرگز** ذخیره نمی‌شود؛ فقط `token_hash` = SHA-256 توکن.
 *   • توکن CSRF هم فقط به‌صورت هش ذخیره می‌شود (`csrf_hash`).
 *   • هر سشن انقضای اجباری دارد (`expires_at` غیر-null) ⇒ «سشن بدون expiry» ممنوع.
 *   • principal_type ∈ {user, admin} و CHECK تضمین می‌کند دقیقاً یکی از
 *     `user_id`/`admin_id` پر باشد. جدول `admins` در فاز ۳ ساخته می‌شود، پس
 *     `admin_id` در این فاز هیچ FK ندارد (BluePrint §19) — ولی معماری دو
 *     principal از همین حالا جدا نگه داشته می‌شود.
 *   • هیچ IP/User-Agent ذخیره نمی‌شود (قاعدهٔ مشاهده‌پذیری پروژه: IP/UA هرگز
 *     ثبت نمی‌شود). فقط `last_seen_at`.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const PRINCIPAL_CHECK = "(principal_type = 'user' AND user_id IS NOT NULL AND admin_id IS NULL) "
        ."OR (principal_type = 'admin' AND admin_id IS NOT NULL AND user_id IS NULL)";

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('auth_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('principal_type', 16);
            $table->uuid('user_id')->nullable();
            $table->uuid('admin_id')->nullable();
            $table->char('token_hash', 64)->unique();
            $table->char('csrf_hash', 64);
            $table->timestamp('expires_at');
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'revoked_at']);
            $table->index('expires_at');
        });

        $this->addCheck('auth_sessions', 'auth_sessions_principal_exclusive', self::PRINCIPAL_CHECK);
    }

    public function down(): void
    {
        Schema::dropIfExists('auth_sessions');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return array_merge([self::sqliteDdl()], self::sqliteIndexes());
    }

    /** @return list<string> */
    private static function sqliteIndexes(): array
    {
        return [
            'CREATE INDEX auth_sessions_user_id_revoked_at_index ON auth_sessions (user_id, revoked_at)',
            'CREATE INDEX auth_sessions_expires_at_index ON auth_sessions (expires_at)',
        ];
    }

    private static function sqliteDdl(): string
    {
        return <<<'SQL'
        CREATE TABLE auth_sessions (
            id varchar(36) not null primary key,
            principal_type varchar(16) not null,
            user_id varchar(36) null,
            admin_id varchar(36) null,
            token_hash varchar(64) not null,
            csrf_hash varchar(64) not null,
            expires_at datetime not null,
            last_seen_at datetime null,
            revoked_at datetime null,
            created_at datetime null,
            updated_at datetime null,
            constraint auth_sessions_token_hash_unique unique (token_hash),
            foreign key (user_id) references users (id) on delete cascade,
            constraint auth_sessions_principal_exclusive check (
                (principal_type = 'user' and user_id is not null and admin_id is null)
                or (principal_type = 'admin' and admin_id is not null and user_id is null)
            )
        )
        SQL;
    }
};
