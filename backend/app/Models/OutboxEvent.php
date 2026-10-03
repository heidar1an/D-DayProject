<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * OutboxEvent — فاز ۱۹.
 *
 * `event_key` یکتاست: تولید دوبارهٔ همان رخداد ⇒ رکورد دوم ساخته نمی‌شود
 * (UniqueConstraint) و بنابراین دوبار Publish نمی‌شود (§13).
 *
 * payload فقط **حداقل دادهٔ لازم** را حمل می‌کند (§17): شناسه‌ها و متن کوتاه،
 * هرگز آبجکت کامل دامنه و هرگز رمز/توکن (§8).
 */
class OutboxEvent extends Model
{
    use HasUuids;

    protected $table = 'outbox_events';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'attempts' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    public function isPublished(): bool
    {
        return $this->published_at !== null;
    }
}
