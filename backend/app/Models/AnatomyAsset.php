<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Anatomy Asset — فاز ۱۵.
 *
 * نگاشت part_key → Media. مدل 3D هرگز داخل PostgreSQL نیست (§17). دسته‌ها
 * allowlist واقعی viewer هستند (config/anatomy.php).
 */
class AnatomyAsset extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'anatomy_assets';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'media_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class, 'subject_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'author_admin_id');
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }
}
