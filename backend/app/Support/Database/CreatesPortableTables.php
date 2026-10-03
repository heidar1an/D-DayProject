<?php

namespace App\Support\Database;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * پل بین SQLite (تست/توسعهٔ سریع) و PostgreSQL (system of record).
 *
 * چرا لازم است: Laravel هیچ API برای CHECK constraint ندارد. در PostgreSQL
 * می‌توان بعد از CREATE TABLE با ALTER TABLE اضافه‌اش کرد، ولی SQLite از
 * `ALTER TABLE ... ADD CONSTRAINT` پشتیبانی نمی‌کند و CHECK باید **داخل**
 * CREATE TABLE بیاید. پس هر migration دو مسیر دارد و این trait فقط مسیر مشترک
 * را نگه می‌دارد تا منطق دوباره نوشته نشود.
 *
 * ⚠️ اگر مسیر SQLite را دستی می‌نویسید، هر CHECK و UNIQUE و FK باید همان‌جا هم
 * باشد؛ وگرنه تست‌ها چیزی را تأیید می‌کنند که در production وجود ندارد.
 */
trait CreatesPortableTables
{
    protected function isSqlite(): bool
    {
        return Schema::getConnection()->getDriverName() === 'sqlite';
    }

    /** در SQLite باید داخل CREATE TABLE باشد؛ اینجا no-op است. */
    protected function addCheck(string $table, string $name, string $expression): void
    {
        if ($this->isSqlite()) {
            return;
        }

        DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$name} CHECK ({$expression})");
    }
}
