<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * RBAC پنل — فاز ۳ (پیش‌نیاز فاز ۶).
 *
 * چرا این migration در فاز ۵/۶ وجود دارد: فاز ۵/۶ روی خروجی فازهای ۱–۴ سوار
 * می‌شوند، ولی `backend/` در پایان فاز ۲ متوقف شده بود. CRUD سؤال (فاز ۶) بدون
 * هویت ادمین و مجوز، قابل ساخت امن نیست؛ پس حداقلِ لازم فاز ۳ اینجا ساخته می‌شود
 * و بقیهٔ فاز ۳ (پنل، مدیریت ادمین‌ها) دست‌نخورده باقی می‌ماند.
 *
 * تصمیم‌ها:
 *   • کلیدهای permission **همان** کلیدهای واقعی پنل قدیم‌اند (`database/contentStore.js`)
 *     ⇒ هیچ کلید تازه‌ای اختراع نشد؛ `testbank.*` مجوز دامنهٔ بانک سؤال است.
 *   • نقش `super-admin` در دیتابیس با `is_system = true` علامت می‌خورد و از
 *     فهرست کامل مجوزها ساخته می‌شود؛ `admin` و `editor` از همان فهرست منهای
 *     `ADMIN_DENIED_PERMISSIONS`/`SENSITIVE_ANALYTICS`.
 *   • `admins.username` یکتا روی `lower(username)` است (PostgreSQL و SQLite هر دو
 *     expression index دارند) تا `Admin` و `admin` دو حساب جدا نشوند.
 *   • `auth_sessions.admin_id` در فاز ۲ بدون FK ساخته شد چون جدول `admins` وجود
 *     نداشت. **این migration عمداً آن FK را اضافه نمی‌کند**: در SQLite
 *     `ALTER TABLE ... ADD CONSTRAINT` پشتیبانی نمی‌شود و افزودن FK فقط روی
 *     PostgreSQL یعنی تست چیزی را تأیید کند که در production نیست (قاعدهٔ
 *     `CreatesPortableTables`). به‌جایش `SessionManager::resolve` وجود اصل
 *     (principal) را چک می‌کند و سشنِ یتیم را بی‌اعتبار می‌داند.
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

        Schema::create('admins', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('username', 64);
            $table->string('display_name', 80)->nullable();
            $table->string('password_hash', 255)->nullable();
            $table->boolean('active')->default(true);
            $table->boolean('must_change_password')->default(false);
            $table->timestampTz('last_login_at')->nullable();
            $table->timestampsTz();

            $table->index('active');
        });

        DB::statement('CREATE UNIQUE INDEX admins_username_lower_unique ON admins (lower(username))');

        Schema::create('roles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('key', 64)->unique();
            $table->string('name', 80);
            $table->string('description', 255)->nullable();
            $table->boolean('is_system')->default(false);
            $table->timestampsTz();
        });

        Schema::create('permissions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('key', 96)->unique();
            $table->string('description', 255)->nullable();
            $table->timestampsTz();
        });

        /*
         * جدول‌های واسط با **کلید مرکب** ساخته می‌شوند، نه `id` مصنوعی.
         *
         * چرا: `belongsToMany` در لاراول فقط ستون‌های دو طرف + timestamps را
         * درج می‌کند. با `id` اجباری، هر `attach()`/`sync()` با
         * «NOT NULL constraint failed» می‌شکند (و این در PostgreSQL هم همین‌طور
         * است، نه فقط SQLite). کلید مرکب هم طبیعی‌ترین شکل یک جدول واسط است و
         * هم یکتایی زوج را تضمین می‌کند.
         */
        Schema::create('admin_roles', function (Blueprint $table): void {
            $table->uuid('admin_id');
            $table->uuid('role_id');
            $table->timestampsTz();

            $table->primary(['admin_id', 'role_id']);
            $table->foreign('admin_id')->references('id')->on('admins')->cascadeOnDelete();
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
        });

        Schema::create('role_permissions', function (Blueprint $table): void {
            $table->uuid('role_id');
            $table->uuid('permission_id');
            $table->timestampsTz();

            $table->primary(['role_id', 'permission_id']);
            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->foreign('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('admin_roles');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('admins');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            <<<'SQL'
            CREATE TABLE admins (
                id varchar(36) not null primary key,
                username varchar(64) not null,
                display_name varchar(80) null,
                password_hash varchar(255) null,
                active tinyint(1) not null default 1,
                must_change_password tinyint(1) not null default 0,
                last_login_at datetime null,
                created_at datetime null,
                updated_at datetime null
            )
            SQL,
            'CREATE UNIQUE INDEX admins_username_lower_unique ON admins (lower(username))',
            'CREATE INDEX admins_active_index ON admins (active)',
            <<<'SQL'
            CREATE TABLE roles (
                id varchar(36) not null primary key,
                key varchar(64) not null,
                name varchar(80) not null,
                description varchar(255) null,
                is_system tinyint(1) not null default 0,
                created_at datetime null,
                updated_at datetime null,
                constraint roles_key_unique unique (key)
            )
            SQL,
            <<<'SQL'
            CREATE TABLE permissions (
                id varchar(36) not null primary key,
                key varchar(96) not null,
                description varchar(255) null,
                created_at datetime null,
                updated_at datetime null,
                constraint permissions_key_unique unique (key)
            )
            SQL,
            <<<'SQL'
            CREATE TABLE admin_roles (
                admin_id varchar(36) not null,
                role_id varchar(36) not null,
                created_at datetime null,
                updated_at datetime null,
                primary key (admin_id, role_id),
                foreign key (admin_id) references admins (id) on delete cascade,
                foreign key (role_id) references roles (id) on delete cascade
            )
            SQL,
            <<<'SQL'
            CREATE TABLE role_permissions (
                role_id varchar(36) not null,
                permission_id varchar(36) not null,
                created_at datetime null,
                updated_at datetime null,
                primary key (role_id, permission_id),
                foreign key (role_id) references roles (id) on delete cascade,
                foreign key (permission_id) references permissions (id) on delete cascade
            )
            SQL,
        ];
    }
};
