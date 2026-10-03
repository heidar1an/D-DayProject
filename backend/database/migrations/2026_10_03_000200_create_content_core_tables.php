<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * هستهٔ محتوا — فاز ۴ (پیش‌نیاز فاز ۵).
 *
 * زنجیره: Subject → Course → Chapter → Lesson → LessonPage (Blueprint §4).
 * فاز ۵ روی `lesson_pages` می‌نشیند؛ بدون این جدول «پیشرفت» بی‌معناست.
 *
 * تصمیم‌های قابل‌دفاع:
 *   • `status` = varchar + CHECK (draft|published|archived) — نه ENUM سختِ
 *     PostgreSQL؛ تغییر فهرست status نباید migration نوع‌ساز بخواهد.
 *   • `version` از روز اول وجود دارد تا فاز ۷ بتواند سؤال/درس را snapshot کند.
 *   • **انحراف مستند از Blueprint:** Blueprint برای هر گره `U(parent_id,sort_order)`
 *     می‌خواهد. یکتاییِ `sort_order` هر جابه‌جاییِ ترتیب را به swap دومرحله‌ای با
 *     تعارض موقت تبدیل می‌کند و در عمل نویسندهٔ محتوا را قفل می‌کند. به‌جایش
 *     `U(parent_id,slug)` + ایندکس `(parent_id,status,sort_order)` نگه داشته شد؛
 *     ترتیب همچنان قطعی است چون `sort_order` NOT NULL است و مرتب‌سازی همیشه
 *     `(sort_order, id)` است.
 *   • `lesson_pages.body` متن خام است؛ پاک‌سازی HTML در لایهٔ سرویس (فاز ۴) انجام
 *     می‌شود نه اینجا. فاز ۵/۶ چیزی از آن را serialize نمی‌کند.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    private const STATUS_CHECK = "status in ('draft','published','archived')";

    public function up(): void
    {
        if ($this->isSqlite()) {
            foreach (self::sqliteStatements() as $statement) {
                DB::statement($statement);
            }

            return;
        }

        Schema::create('subjects', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('slug', 64)->unique();
            $table->string('title', 120);
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('published_at')->nullable();
            $table->uuid('author_admin_id')->nullable();
            $table->uuid('editor_admin_id')->nullable();
            $table->timestampsTz();

            $table->index(['status', 'sort_order']);
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
            $table->foreign('editor_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('subjects', 'subjects_status_valid', self::STATUS_CHECK);
        $this->addCheck('subjects', 'subjects_version_positive', 'version >= 1');

        Schema::create('courses', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('subject_id');
            $table->string('slug', 64);
            $table->string('title', 160);
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('published_at')->nullable();
            $table->uuid('author_admin_id')->nullable();
            $table->uuid('editor_admin_id')->nullable();
            $table->timestampsTz();

            $table->unique(['subject_id', 'slug']);
            $table->index(['subject_id', 'status', 'sort_order']);
            $table->foreign('subject_id')->references('id')->on('subjects')->restrictOnDelete();
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
            $table->foreign('editor_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('courses', 'courses_status_valid', self::STATUS_CHECK);
        $this->addCheck('courses', 'courses_version_positive', 'version >= 1');

        Schema::create('chapters', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('course_id');
            $table->string('slug', 64);
            $table->string('title', 160);
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('published_at')->nullable();
            $table->uuid('author_admin_id')->nullable();
            $table->uuid('editor_admin_id')->nullable();
            $table->timestampsTz();

            $table->unique(['course_id', 'slug']);
            $table->index(['course_id', 'status', 'sort_order']);
            $table->foreign('course_id')->references('id')->on('courses')->restrictOnDelete();
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
            $table->foreign('editor_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('chapters', 'chapters_status_valid', self::STATUS_CHECK);
        $this->addCheck('chapters', 'chapters_version_positive', 'version >= 1');

        Schema::create('lessons', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('chapter_id');
            $table->string('slug', 64);
            $table->string('title', 160);
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('published_at')->nullable();
            $table->uuid('author_admin_id')->nullable();
            $table->uuid('editor_admin_id')->nullable();
            $table->timestampsTz();

            $table->unique(['chapter_id', 'slug']);
            $table->index(['chapter_id', 'status', 'sort_order']);
            $table->foreign('chapter_id')->references('id')->on('chapters')->restrictOnDelete();
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
            $table->foreign('editor_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('lessons', 'lessons_status_valid', self::STATUS_CHECK);
        $this->addCheck('lessons', 'lessons_version_positive', 'version >= 1');

        Schema::create('lesson_pages', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('lesson_id');
            $table->string('slug', 64);
            $table->string('title', 160);
            $table->text('body')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('published_at')->nullable();
            $table->uuid('author_admin_id')->nullable();
            $table->uuid('editor_admin_id')->nullable();
            $table->timestampsTz();

            $table->unique(['lesson_id', 'slug']);
            $table->index(['lesson_id', 'status', 'sort_order']);
            $table->foreign('lesson_id')->references('id')->on('lessons')->restrictOnDelete();
            $table->foreign('author_admin_id')->references('id')->on('admins')->nullOnDelete();
            $table->foreign('editor_admin_id')->references('id')->on('admins')->nullOnDelete();
        });
        $this->addCheck('lesson_pages', 'lesson_pages_status_valid', self::STATUS_CHECK);
        $this->addCheck('lesson_pages', 'lesson_pages_version_positive', 'version >= 1');
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_pages');
        Schema::dropIfExists('lessons');
        Schema::dropIfExists('chapters');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('subjects');
    }

    /** @return list<string> */
    private static function sqliteStatements(): array
    {
        return [
            self::sqliteSubject(),
            self::sqliteCourse(),
            self::sqliteChapter(),
            self::sqliteLesson(),
            self::sqliteLessonPage(),
        ];
    }

    private static function sqliteSubject(): string
    {
        return <<<'SQL'
        CREATE TABLE subjects (
            id varchar(36) not null primary key,
            slug varchar(64) not null,
            title varchar(120) not null,
            description text null,
            sort_order integer not null default 0,
            status varchar(16) not null default 'draft',
            version integer not null default 1,
            published_at datetime null,
            author_admin_id varchar(36) null,
            editor_admin_id varchar(36) null,
            created_at datetime null,
            updated_at datetime null,
            constraint subjects_slug_unique unique (slug),
            constraint subjects_status_valid check (status in ('draft','published','archived')),
            constraint subjects_version_positive check (version >= 1),
            foreign key (author_admin_id) references admins (id) on delete set null,
            foreign key (editor_admin_id) references admins (id) on delete set null
        )
        SQL;
    }

    private static function sqliteCourse(): string
    {
        return <<<'SQL'
        CREATE TABLE courses (
            id varchar(36) not null primary key,
            subject_id varchar(36) not null,
            slug varchar(64) not null,
            title varchar(160) not null,
            description text null,
            sort_order integer not null default 0,
            status varchar(16) not null default 'draft',
            version integer not null default 1,
            published_at datetime null,
            author_admin_id varchar(36) null,
            editor_admin_id varchar(36) null,
            created_at datetime null,
            updated_at datetime null,
            constraint courses_subject_id_slug_unique unique (subject_id, slug),
            constraint courses_status_valid check (status in ('draft','published','archived')),
            constraint courses_version_positive check (version >= 1),
            foreign key (subject_id) references subjects (id) on delete restrict,
            foreign key (author_admin_id) references admins (id) on delete set null,
            foreign key (editor_admin_id) references admins (id) on delete set null
        )
        SQL;
    }

    private static function sqliteChapter(): string
    {
        return <<<'SQL'
        CREATE TABLE chapters (
            id varchar(36) not null primary key,
            course_id varchar(36) not null,
            slug varchar(64) not null,
            title varchar(160) not null,
            description text null,
            sort_order integer not null default 0,
            status varchar(16) not null default 'draft',
            version integer not null default 1,
            published_at datetime null,
            author_admin_id varchar(36) null,
            editor_admin_id varchar(36) null,
            created_at datetime null,
            updated_at datetime null,
            constraint chapters_course_id_slug_unique unique (course_id, slug),
            constraint chapters_status_valid check (status in ('draft','published','archived')),
            constraint chapters_version_positive check (version >= 1),
            foreign key (course_id) references courses (id) on delete restrict,
            foreign key (author_admin_id) references admins (id) on delete set null,
            foreign key (editor_admin_id) references admins (id) on delete set null
        )
        SQL;
    }

    private static function sqliteLesson(): string
    {
        return <<<'SQL'
        CREATE TABLE lessons (
            id varchar(36) not null primary key,
            chapter_id varchar(36) not null,
            slug varchar(64) not null,
            title varchar(160) not null,
            description text null,
            sort_order integer not null default 0,
            status varchar(16) not null default 'draft',
            version integer not null default 1,
            published_at datetime null,
            author_admin_id varchar(36) null,
            editor_admin_id varchar(36) null,
            created_at datetime null,
            updated_at datetime null,
            constraint lessons_chapter_id_slug_unique unique (chapter_id, slug),
            constraint lessons_status_valid check (status in ('draft','published','archived')),
            constraint lessons_version_positive check (version >= 1),
            foreign key (chapter_id) references chapters (id) on delete restrict,
            foreign key (author_admin_id) references admins (id) on delete set null,
            foreign key (editor_admin_id) references admins (id) on delete set null
        )
        SQL;
    }

    private static function sqliteLessonPage(): string
    {
        return <<<'SQL'
        CREATE TABLE lesson_pages (
            id varchar(36) not null primary key,
            lesson_id varchar(36) not null,
            slug varchar(64) not null,
            title varchar(160) not null,
            body text null,
            sort_order integer not null default 0,
            status varchar(16) not null default 'draft',
            version integer not null default 1,
            published_at datetime null,
            author_admin_id varchar(36) null,
            editor_admin_id varchar(36) null,
            created_at datetime null,
            updated_at datetime null,
            constraint lesson_pages_lesson_id_slug_unique unique (lesson_id, slug),
            constraint lesson_pages_status_valid check (status in ('draft','published','archived')),
            constraint lesson_pages_version_positive check (version >= 1),
            foreign key (lesson_id) references lessons (id) on delete restrict,
            foreign key (author_admin_id) references admins (id) on delete set null,
            foreign key (editor_admin_id) references admins (id) on delete set null
        )
        SQL;
    }
};
