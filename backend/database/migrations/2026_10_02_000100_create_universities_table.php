<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * دانشگاه‌ها — جدول مرجع (reference table).
 *
 * `slug` کلید عمومی/پایدار است (همان `id` در فرانت‌اند)؛ `id` فقط UUID داخلی.
 * seed این جدول از فهرست واقعی پروژه می‌آید: `database/seeders/data/universities.php`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('universities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('slug', 64)->unique();
            $table->string('name', 160);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['active', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('universities');
    }
};
