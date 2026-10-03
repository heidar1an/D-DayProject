<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۶ — Study Groups.
 *
 *   study_groups       گروه ۲–۳ نفره؛ `code_hash` فقط SHA-256 است — Plaintext
 *                      هرگز ذخیره نمی‌شود (§39). کدهای بازنشسته هم hash می‌مانند.
 *   group_memberships  عضویت؛ **UNIQUE(user_id)**: قاعدهٔ واقعی UI «هر کاربر
 *                      حداکثر یک گروه فعال» است (GROUP_ERRORS.ALREADY_IN_GROUP).
 *                      این قید قوی‌تر از U(group_id,user_id) است و رقابت
 *                      بین‌گروهیِ Join را هم در دیتابیس می‌بندد — انحراف آگاهانه
 *                      از Blueprint، با همان تضمین داخلی. عضو kick/leave ردیفش
 *                      حذف می‌شود؛Cascade فقط pivot (§63).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE study_groups (
                id varchar(36) not null primary key,
                owner_user_id varchar(36) not null,
                code_hash char(64) not null,
                plan_id varchar(64) null,
                seats integer not null,
                status varchar(16) not null default 'active',
                created_at datetime null,
                updated_at datetime null,
                constraint study_groups_code_hash_unique unique (code_hash),
                constraint study_groups_seats_range check (seats between 2 and 3),
                constraint study_groups_status_valid check (status in ('active','archived')),
                foreign key (owner_user_id) references users (id) on delete restrict
            )
            SQL);

            DB::statement('CREATE INDEX study_groups_owner_user_id_index ON study_groups (owner_user_id)');
            DB::statement('CREATE INDEX study_groups_status_index ON study_groups (status)');

            DB::statement(<<<'SQL'
            CREATE TABLE group_memberships (
                id varchar(36) not null primary key,
                group_id varchar(36) not null,
                user_id varchar(36) not null,
                role varchar(16) not null default 'member',
                created_at datetime null,
                updated_at datetime null,
                constraint group_memberships_user_id_unique unique (user_id),
                constraint group_memberships_group_id_user_id_unique unique (group_id, user_id),
                constraint group_memberships_role_valid check (role in ('owner','member')),
                foreign key (group_id) references study_groups (id) on delete cascade,
                foreign key (user_id) references users (id) on delete cascade
            )
            SQL);

            DB::statement(<<<'SQL'
            CREATE TABLE group_retired_codes (
                id varchar(36) not null primary key,
                group_id varchar(36) not null,
                code_hash char(64) not null,
                created_at datetime null,
                updated_at datetime null,
                constraint group_retired_codes_code_hash_unique unique (code_hash),
                foreign key (group_id) references study_groups (id) on delete cascade
            )
            SQL);

            DB::statement('CREATE INDEX group_retired_codes_group_id_index ON group_retired_codes (group_id)');

            return;
        }

        Schema::create('study_groups', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('owner_user_id');
            $table->char('code_hash', 64)->unique();
            $table->string('plan_id', 64)->nullable();
            $table->unsignedSmallInteger('seats');
            $table->string('status', 16)->default('active');
            $table->timestampsTz();

            $table->index('owner_user_id');
            $table->index('status');
            $table->foreign('owner_user_id')->references('id')->on('users')->restrictOnDelete();
        });
        $this->addCheck('study_groups', 'study_groups_seats_range', 'seats between 2 and 3');
        $this->addCheck('study_groups', 'study_groups_status_valid', "status in ('active','archived')");

        Schema::create('group_memberships', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('group_id');
            $table->uuid('user_id');
            $table->string('role', 16)->default('member');
            $table->timestampsTz();

            $table->unique('user_id');
            $table->unique(['group_id', 'user_id']);
            $table->foreign('group_id')->references('id')->on('study_groups')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
        $this->addCheck('group_memberships', 'group_memberships_role_valid', "role in ('owner','member')");

        Schema::create('group_retired_codes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('group_id');
            $table->char('code_hash', 64)->unique();
            $table->timestampsTz();

            $table->index('group_id');
            $table->foreign('group_id')->references('id')->on('study_groups')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_retired_codes');
        Schema::dropIfExists('group_memberships');
        Schema::dropIfExists('study_groups');
    }
};
