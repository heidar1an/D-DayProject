<?php

use App\Support\Database\CreatesPortableTables;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * فاز ۱۹ — Search index.
 *
 *   `document_text` = متن **نرمال‌شدهٔ فارسی** که اپ می‌نویسد (ی/ي، ک/ك،
 *   نیم‌فاصله→فاصله، lowercase). روی هر دو درایور وجود دارد و هر دو مسیر کوئری
 *   از همین ستون می‌خوانند.
 *
 *   PostgreSQL: ستون `document` از نوع `tsvector` و **generated stored** است و از
 *   همان `document_text` ساخته می‌شود؛ ایندکس GIN روی آن. چون نرمال‌سازی سمت اپ
 *   انجام شده، جست‌وجوی «كليه»/«نیم‌فاصله» روی production هم کار می‌کند.
 *
 *   ⚠️ چرا tsvector از `title`/`body` خام ساخته **نمی‌شود**: آن‌ها متن نمایشی‌اند
 *   و نرمال‌سازی نشده‌اند ⇒ عبارت کاربر («كليه» با کاف عربی) هیچ تطابقی پیدا
 *   نمی‌کرد. این باگ فقط روی PostgreSQL دیده می‌شد (SQLite از `document_text`
 *   با LIKE می‌خواند) و در تأیید واقعی روی PG بیرون آمد.
 *
 *   SQLite (تست/توسعه): کوئری با `LIKE` روی `document_text`.
 *
 * `UNIQUE(entity_type, entity_id)` ⇒ یک سند به‌ازای هر موجودیت؛ upsert ساده و
 * duplicate-safe است.
 */
return new class extends Migration
{
    use CreatesPortableTables;

    public function up(): void
    {
        if ($this->isSqlite()) {
            DB::statement(<<<'SQL'
            CREATE TABLE search_documents (
                id varchar(36) not null primary key,
                entity_type varchar(48) not null,
                entity_id varchar(64) not null,
                title varchar(300) not null,
                body text not null,
                document_text text not null,
                created_at datetime null,
                updated_at datetime null,
                constraint search_documents_entity_type_entity_id_unique unique (entity_type, entity_id)
            )
            SQL);

            DB::statement('CREATE INDEX search_documents_entity_type_index ON search_documents (entity_type)');

            return;
        }

        Schema::create('search_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('entity_type', 48);
            $table->string('entity_id', 64);
            $table->string('title', 300);
            $table->text('body');
            $table->text('document_text');
            $table->timestampsTz();

            $table->unique(['entity_type', 'entity_id']);
            $table->index('entity_type');
        });

        /*
         * `simple` انتخاب شده چون متن فارسی است و stemming انگلیسی معنایی ندارد؛
         * نرمال‌سازی فارسی سمت اپ روی `document_text` انجام شده (§35).
         */
        DB::statement("ALTER TABLE search_documents ADD COLUMN document tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(document_text, ''))) STORED");
        DB::statement('CREATE INDEX search_documents_document_gin ON search_documents USING GIN (document)');
    }

    public function down(): void
    {
        Schema::dropIfExists('search_documents');
    }
};
