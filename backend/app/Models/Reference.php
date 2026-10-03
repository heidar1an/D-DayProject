<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Reference — فاز ۱۵.
 *
 * مالک «محتوای مرجع + نگاشت asset» (§54). `sections` همان ساختار viewer است و
 * `content` آن فقط از مسیر پاک‌ساز عبور کرده. Predefined asset کلیدهای تصویر
 * بلوک‌ها هستند (مثل `anatomy`/`histology` در فرانت).
 */
class Reference extends Model
{
    use HasUuids;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_ARCHIVED = 'archived';

    protected $table = 'references';

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sections' => 'array',
            'version' => 'integer',
            'published_at' => 'datetime',
        ];
    }

    /** @return HasMany<ReferenceAsset, $this> */
    public function assets(): HasMany
    {
        return $this->hasMany(ReferenceAsset::class, 'reference_id');
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
