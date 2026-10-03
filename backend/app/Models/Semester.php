<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * ترم تحصیلی — جدول مرجع آماده برای فازهای بعد (بدون endpoint در فاز ۲).
 * Blueprint §7: schema ساخته می‌شود ولی seed حدسی تولید نمی‌شود.
 */
class Semester extends Model
{
    use HasUuids;

    protected $table = 'semesters';

    /** @var list<string> */
    protected $fillable = ['number', 'degree', 'academic_year', 'active'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['active' => 'boolean', 'number' => 'integer'];
    }

    /** @param Builder<Semester> $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('active', true);
    }
}
