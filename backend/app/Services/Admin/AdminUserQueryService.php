<?php

namespace App\Services\Admin;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * کوئری کاربران در پنل — فاز ۲۰ (§75).
 *
 * فقط فیلترهای allowlist و sort امن؛ هیچ ستون دلخواهی از کلاینت نمی‌آید
 * (§91/§92). دادهٔ حساس (`password_hash`, `google_subject`, توکن سشن) هرگز
 * خوانده نمی‌شود — نه اینکه «در پاسخ فیلتر شود».
 */
final class AdminUserQueryService
{
    /** @return LengthAwarePaginator<int, User> */
    public function list(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = User::query()->select(['id', 'phone', 'email', 'email_verified_at', 'created_at', 'updated_at']);

        if (! empty($filters['q'])) {
            $term = $this->escapeLike((string) $filters['q']);

            $query->where(function ($inner) use ($term): void {
                $inner->where('phone', 'like', '%'.$term.'%')
                    ->orWhere('email', 'like', '%'.$term.'%');
            });
        }

        if (! empty($filters['phone'])) {
            $query->where('phone', 'like', '%'.$this->escapeLike((string) $filters['phone']).'%');
        }

        if (! empty($filters['email'])) {
            $query->where('email', 'like', '%'.$this->escapeLike((string) $filters['email']).'%');
        }

        if (array_key_exists('verified', $filters) && $filters['verified'] !== null) {
            $filters['verified']
                ? $query->whereNotNull('email_verified_at')
                : $query->whereNull('email_verified_at');
        }

        if (! empty($filters['createdFrom'])) {
            $query->where('created_at', '>=', (string) $filters['createdFrom']);
        }

        if (! empty($filters['createdTo'])) {
            $query->where('created_at', '<=', (string) $filters['createdTo']);
        }

        return match ((string) ($filters['sort'] ?? 'createdAt')) {
            'createdAtAsc' => $query->orderBy('created_at')->orderBy('id')->paginate($perPage),
            default => $query->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage),
        };
    }

    public function find(string $id): ?User
    {
        /** @var User|null */
        return User::query()
            ->select(['id', 'phone', 'email', 'email_verified_at', 'created_at', 'updated_at'])
            ->whereKey($id)
            ->first();
    }

    /** آیا حساب Google وصل است؟ — خودِ subject هرگز برنمی‌گردد (§75). */
    public function hasGoogleLinked(string $id): bool
    {
        return User::query()->whereKey($id)->whereNotNull('google_subject')->exists();
    }

    /** `%` و `_` کاربر نباید wildcard شوند — escape صریح، پارامتریزه باقی می‌ماند. */
    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_substr($value, 0, 120));
    }
}
