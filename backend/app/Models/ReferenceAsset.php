<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * نگاشت Reference → Media — فاز ۱۵.
 */
class ReferenceAsset extends Model
{
    use HasUuids;

    protected $table = 'reference_assets';

    /** @var list<string> */
    protected $fillable = [];

    public function reference(): BelongsTo
    {
        return $this->belongsTo(Reference::class, 'reference_id');
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'media_id');
    }
}
