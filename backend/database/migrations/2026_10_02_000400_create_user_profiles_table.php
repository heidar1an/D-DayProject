<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * پروفایل کاربر — relation یک‌به‌یک با `users` (Blueprint §5).
 *
 * چرا جدول جدا: پروفایل دادهٔ اختیاری/تکاملی است و در Register ساخته می‌شود؛
 * گذاشتنش داخل `users` هم جدول هویت را شلوغ می‌کند و هم هر خواندنِ احراز هویت را
 * به دادهٔ غیرضروری وابسته می‌کند.
 *
 * `user_id` unique است ⇒ یک‌به‌یک در سطح دیتابیس، نه فقط در قرارداد.
 * حذف کاربر ⇒ حذف پروفایل (cascade). حذف دانشگاه ⇒ `university_id` تهی می‌شود
 * (پروفایل کاربر نباید با حذف یک ردیف مرجع از بین برود).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_profiles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->unique();
            $table->string('username', 32)->nullable()->unique();
            $table->string('first_name', 60)->nullable();
            $table->string('last_name', 60)->nullable();
            $table->uuid('university_id')->nullable();
            $table->string('term', 8)->nullable();
            $table->string('grade', 80)->nullable();
            $table->string('birth_date_jalali', 10)->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('avatar_key', 8)->nullable();
            $table->json('motivations')->nullable();
            $table->json('referrals')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('university_id')->references('id')->on('universities')->nullOnDelete();
            $table->index('university_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_profiles');
    }
};
