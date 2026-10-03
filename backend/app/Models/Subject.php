<?php

namespace App\Models;

use Database\Factories\SubjectFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * درس (Subject) — ریشهٔ زنجیرهٔ محتوا.
 *
 * `status`: draft | published | archived. `version` از روز اول وجود دارد تا
 * فاز ۷ بتواند محتوا/سؤال را snapshot کند.
 *
 * `$fillable` یک whitelist است: `version`، `published_at` و `author_admin_id`
 * عمداً نیستند — فقط سرویس انتشار آن‌ها را می‌نویسد، نه ورودی درخواست.
 */
class Subject extends Model
{
    /** @use HasFactory<SubjectFactory> */
    use HasFactory, HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'subjects';

    /** @var list<string> */
    protected $fillable = ['slug', 'title', 'description', 'sort_order', 'status'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    /** @return HasMany<Course, $this> */
    public function courses(): HasMany
    {
        return $this->hasMany(Course::class)->orderBy('sort_order')->orderBy('id');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }
}
