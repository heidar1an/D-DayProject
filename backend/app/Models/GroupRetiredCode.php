<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * هش کد بازنشستهٔ گروه — فاز ۱۶ (§44).
 *
 * چرا جدول جدا و نه ستون jsonb: جست‌وجوی join بر اساس کد بازنشده باید
 * ایندکس‌پذیر و `lockForUpdate`پذیر باشد؛ کوئری پرتابل روی ستون JSON در PG
 * (`jsonb ~~ text`) وجود ندارد و در SQLite هم بدون ایندکس است. `code_hash`
 * UNIQUE سراسری است — یک کد حداکثر به یک گروه تعلق دارد.
 */
class GroupRetiredCode extends Model
{
    use HasUuids;

    protected $table = 'group_retired_codes';

    /** @var list<string> */
    protected $fillable = [];

    public function group(): BelongsTo
    {
        return $this->belongsTo(StudyGroup::class, 'group_id');
    }
}
