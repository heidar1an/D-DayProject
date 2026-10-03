<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۷ — کاتالوگ دوره‌های بین‌الملل.
 *
 * مرز دامنه (Blueprint §4): این ماژول فقط **کاتالوگ** را مالک است — ناشر و
 * دوره. هیچ درس/فصل/صفحه‌ای اینجا ساخته نمی‌شود؛ محتوای آموزشی همچنان مالکیت
 * Content Engine است (`chapters`/`lessons`/`lesson_pages`) و دورهٔ بین‌الملل
 * فقط یک موجودیت کاتالوگ با فرادادهٔ نمایشی است. دلیل: ساختن
 * `international_lessons`/`international_pages` یعنی دو منبع حقیقت برای یک
 * مفهوم، و هر ویرایش محتوا باید دو جا انجام شود.
 *
 * تصمیم‌های کلیدی:
 *   • `legacy_id` — پل به شناسهٔ رکورد در لایهٔ قدیم (`database/contentStore.js`:
 *     `intlProviders`/`intlCourses` با شناسه‌هایی مثل `harvard`/`global-health`).
 *     بدون آن، مهاجرت داده یک‌بارمصرف و بی‌بازگشت می‌شود. UNIQUE تا نگاشت
 *     دوسویه بماند.
 *   • `slug` روی دوره **سراسری** یکتاست (نه `UNIQUE(provider_id, slug)`):
 *     مسیر عمومی `GET /international/courses/{slug}` فقط slug را می‌گیرد و
 *     بدون یکتایی سراسری، «کدام دوره؟» بی‌پاسخ می‌ماند.
 *   • `status` = `draft|published|archived` — عیناً واژگان Content Engine
 *     (Blueprint §6). هیچ وضعیت تازه‌ای اختراع نشد.
 *   • `required_capability` NULL یعنی **رایگان**. مقداردار یعنی دوره فقط با
 *     entitlement همان قابلیت باز می‌شود (`intl` در واژگان واقعی محصول).
 *     چرا ستون و نه boolean: «پرمیوم» بدون گفتن «کدام قابلیت» یعنی Content
 *     مجبور شود به دامنهٔ Commerce نگاه کند؛ اینجا فقط نام قابلیت می‌آید.
 *   • `progress` عمداً **نیست**: در کاتالوگ قدیم یک عدد نمایشی per-user بود؛
 *     پیشرفت واقعی مالکیت دامنهٔ Learning است، نه کاتالوگ.
 *   • Media فقط با FK (`logo_media_id`/`cover_media_id`) وصل می‌شود؛ هیچ URL
 *     خام کاربر در دیتابیس نمی‌نشیند (فاز ۱۵).
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const STATUS_CHECK = "status in ('draft','published','archived')";

    private const PROVIDER_KIND_CHECK = "kind in ('university','media','journal','organization')";

    private const ORIGIN_CHECK = "origin in ('tapesh','panel')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('international_providers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->string('slug', 64)->unique();
            $table->string('name', 160);
            $table->string('name_en', 160)->nullable();
            $table->string('kind', 24)->default('university');
            $table->string('country', 80)->nullable();
            $table->string('founded', 20)->nullable();
            $table->text('description')->nullable();
            $table->jsonb('focus')->nullable();
            $table->uuid('logo_media_id')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedInteger('marquee_order')->default(0);
            $table->string('status', 16)->default('draft');
            $table->string('origin', 16)->default('panel');
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();

            $table->index(['status', 'sort_order']);
            $table->index(['kind', 'status']);
            $table->foreign('logo_media_id')->references('id')->on('media')->nullOnDelete();
        });
        $this->addCheck('international_providers', 'intl_providers_status_valid', self::STATUS_CHECK);
        $this->addCheck('international_providers', 'intl_providers_kind_valid', self::PROVIDER_KIND_CHECK);
        $this->addCheck('international_providers', 'intl_providers_origin_valid', self::ORIGIN_CHECK);

        Schema::create('international_courses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->uuid('provider_id');
            $table->string('slug', 64)->unique();
            $table->string('title', 160);
            $table->text('description')->nullable();
            $table->string('category', 40)->default('medicine');
            $table->string('level', 40)->nullable();
            $table->jsonb('tags')->nullable();
            $table->uuid('cover_media_id')->nullable();
            $table->string('accent', 9)->nullable();
            $table->string('accent_soft', 9)->nullable();
            $table->string('badge', 40)->nullable();
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->string('total_duration_label', 20)->nullable();
            $table->string('required_capability', 64)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status', 16)->default('draft');
            $table->string('origin', 16)->default('panel');
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();

            $table->index(['provider_id', 'status', 'sort_order']);
            $table->index(['status', 'sort_order']);
            $table->index(['status', 'category']);
            $table->foreign('provider_id')->references('id')->on('international_providers')->restrictOnDelete();
            $table->foreign('cover_media_id')->references('id')->on('media')->nullOnDelete();
        });
        $this->addCheck('international_courses', 'intl_courses_status_valid', self::STATUS_CHECK);
        $this->addCheck('international_courses', 'intl_courses_origin_valid', self::ORIGIN_CHECK);
        $this->addCheck('international_courses', 'intl_courses_duration_non_negative', 'duration_minutes is null or duration_minutes >= 0');
    }

    public function down(): void
    {
        Schema::dropIfExists('international_courses');
        Schema::dropIfExists('international_providers');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            <<<'SQL'
            CREATE TABLE international_providers (
                id varchar(36) not null primary key,
                legacy_id varchar(64) null,
                slug varchar(64) not null,
                name varchar(160) not null,
                name_en varchar(160) null,
                kind varchar(24) not null default 'university',
                country varchar(80) null,
                founded varchar(20) null,
                description text null,
                focus text null,
                logo_media_id varchar(36) null,
                sort_order integer not null default 0,
                marquee_order integer not null default 0,
                status varchar(16) not null default 'draft',
                origin varchar(16) not null default 'panel',
                published_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint international_providers_legacy_id_unique unique (legacy_id),
                constraint international_providers_slug_unique unique (slug),
                constraint intl_providers_status_valid check (status in ('draft','published','archived')),
                constraint intl_providers_kind_valid check (kind in ('university','media','journal','organization')),
                constraint intl_providers_origin_valid check (origin in ('tapesh','panel')),
                foreign key (logo_media_id) references media (id) on delete set null
            )
            SQL,
            'CREATE INDEX international_providers_status_sort_order_index ON international_providers (status, sort_order)',
            'CREATE INDEX international_providers_kind_status_index ON international_providers (kind, status)',
            <<<'SQL'
            CREATE TABLE international_courses (
                id varchar(36) not null primary key,
                legacy_id varchar(64) null,
                provider_id varchar(36) not null,
                slug varchar(64) not null,
                title varchar(160) not null,
                description text null,
                category varchar(40) not null default 'medicine',
                level varchar(40) null,
                tags text null,
                cover_media_id varchar(36) null,
                accent varchar(9) null,
                accent_soft varchar(9) null,
                badge varchar(40) null,
                duration_minutes integer null,
                total_duration_label varchar(20) null,
                required_capability varchar(64) null,
                sort_order integer not null default 0,
                status varchar(16) not null default 'draft',
                origin varchar(16) not null default 'panel',
                published_at datetime null,
                created_at datetime null,
                updated_at datetime null,
                constraint international_courses_legacy_id_unique unique (legacy_id),
                constraint international_courses_slug_unique unique (slug),
                constraint intl_courses_status_valid check (status in ('draft','published','archived')),
                constraint intl_courses_origin_valid check (origin in ('tapesh','panel')),
                constraint intl_courses_duration_non_negative check (duration_minutes is null or duration_minutes >= 0),
                foreign key (provider_id) references international_providers (id) on delete restrict,
                foreign key (cover_media_id) references media (id) on delete set null
            )
            SQL,
            'CREATE INDEX international_courses_provider_id_status_sort_order_index ON international_courses (provider_id, status, sort_order)',
            'CREATE INDEX international_courses_status_sort_order_index ON international_courses (status, sort_order)',
            'CREATE INDEX international_courses_status_category_index ON international_courses (status, category)',
        ];
    }
};
