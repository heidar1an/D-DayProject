<?php

namespace App\Models;

use Database\Factories\UniversityFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class University extends Model
{
    /** @use HasFactory<UniversityFactory> */
    use HasFactory, HasUuids;

    protected $table = 'universities';

    /** @var list<string> */
    protected $fillable = ['slug', 'name', 'active'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    /** @param Builder<University> $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('active', true);
    }
}
