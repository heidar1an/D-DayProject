<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * کاربران — هستهٔ هویتی (principal: user).
 *
 * تصمیم‌های کلیدی:
 *   • PK از نوع UUID (Blueprint §4) — هیچ شناسهٔ قابل‌شمارش لو نمی‌رود.
 *   • `phone` و `email` هر دو nullable هستند چون هویت می‌تواند موبایل، ایمیل یا
 *     Google باشد؛ ولی «حداقل یکی باید موجود باشد» با CHECK تضمین می‌شود.
 *   • ستون رمز `password_hash` است (نه `password`) تا هیچ جایی این ستون را
 *     به‌اشتباه به `Hash::make` نسپارند و هش دوباره هش نشود.
 *   • uniqueness روی مقادیر **normalize‌شده** معنا دارد؛ نرمال‌سازی در لایهٔ
 *     سرویس انجام می‌شود و این ایندکس‌ها تضمین نهایی (race-safe) هستند.
 *   • هیچ ستون profile اینجا نیست (Blueprint §5): یک‌به‌یک در `user_profiles`.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const IDENTITY_CHECK = 'phone IS NOT NULL OR email IS NOT NULL OR google_subject IS NOT NULL';

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('phone', 20)->nullable()->unique();
            $table->string('email', 190)->nullable()->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password_hash', 255)->nullable();
            $table->string('google_subject', 255)->nullable()->unique();
            $table->timestamp('password_updated_at')->nullable();
            $table->timestamps();

            $table->index('created_at');
        });

        $this->addCheck('users', 'users_identity_present', self::IDENTITY_CHECK);
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            <<<'SQL'
            CREATE TABLE users (
                id varchar(36) not null primary key,
                phone varchar(20) null,
                email varchar(190) null,
                email_verified_at datetime null,
                password_hash varchar(255) null,
                google_subject varchar(255) null,
                password_updated_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint users_phone_unique unique (phone),
                constraint users_email_unique unique (email),
                constraint users_google_subject_unique unique (google_subject),
                constraint users_identity_present check (phone is not null or email is not null or google_subject is not null)
            )
            SQL,
            'CREATE INDEX users_created_at_index ON users (created_at)',
        ];
    }
};
