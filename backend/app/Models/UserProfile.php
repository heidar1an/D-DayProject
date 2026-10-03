<?php

namespace App\Models;

use Database\Factories\UserProfileFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * پروفایل — یک‌به‌یک با `User`.
 *
 * `$fillable` یک **whitelist** است (BluePrint §15): نه `id`، نه `user_id`ِ
 * قابل‌تغییر، نه هیچ فیلد هویتی. سرویس پروفایل هم فقط همین کلیدها را از درخواست
 * برمی‌دارد؛ دو لایه محافظت، نه یکی.
 */
class UserProfile extends Model
{
    /** @use HasFactory<UserProfileFactory> */
    use HasFactory, HasUuids;

    protected $table = 'user_profiles';

    /** @var list<string> */
    protected $fillable = [
        'username',
        'first_name',
        'last_name',
        'university_id',
        'term',
        'grade',
        'birth_date_jalali',
        'gender',
        'avatar_key',
        'motivations',
        'referrals',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'motivations' => 'array',
            'referrals' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function university(): BelongsTo
    {
        return $this->belongsTo(University::class);
    }
}
