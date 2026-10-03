<?php

namespace App\Http\Resources;

use App\Services\Identity\RbacService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * شکل عمومی ادمین در v1.
 *
 * هیچ‌گاه برنمی‌گرداند: `password_hash`، `must_change_password` (وضعیت امنیتی
 * حساب)، هیچ توکنی. مجوزها عمداً برگردانده می‌شوند چون پنل برای مخفی/نمایان
 * کردن دکمه‌ها به آن‌ها نیاز دارد — ولی **اعتبارسنجی سمت سرور مستقل از این
 * فهرست است**؛ پنهان‌کردن دکمه هرگز جای enforcement را نمی‌گیرد.
 */
class AdminResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $admin = $this->resource;

        return [
            'id' => $admin->getKey(),
            'username' => $admin->username,
            'display_name' => $admin->display_name,
            'roles' => $admin->relationLoaded('roles')
                ? $admin->roles->pluck('key')->values()->all()
                : [],
            'permissions' => app(RbacService::class)->permissionsFor($admin),
            'last_login_at' => $admin->last_login_at?->toIso8601String(),
        ];
    }
}
