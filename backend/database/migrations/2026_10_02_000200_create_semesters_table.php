<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ترم‌ها/نیم‌سال‌های تحصیلی — جدول مرجع برای فازهای بعد.
 *
 * ⚠️ در این فاز هیچ endpoint یا seedی ندارد: دادهٔ واقعی دانشگاه/رشته در پروژه
 * وجود ندارد و Blueprint صریحاً seed حدسی را ممنوع کرده است. schema آماده است تا
 * فاز دوره‌ها بتواند روی آن بسازد. مقادیر مجاز `degree` هم عمداً اینجا
 * محدود نشده‌اند تا وقتی فهرست واقعی مقاطع تثبیت شد، بدون migration تعیین شوند.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('semesters', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedSmallInteger('number');
            $table->string('degree', 32);
            $table->string('academic_year', 9); // مثال: 1404-1405
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['number', 'degree', 'academic_year']);
            $table->index(['active', 'academic_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('semesters');
    }
};
