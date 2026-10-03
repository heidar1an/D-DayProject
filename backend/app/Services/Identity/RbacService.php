<?php

namespace App\Services\Identity;

use App\Models\Admin;
use App\Models\Permission;
use App\Models\Role;

/**
 * حل مجوزهای ادمین — deny-by-default.
 *
 * قاعده: ادمین مجوز را فقط از طریق نقش‌هایش می‌گیرد. هیچ ستون role روی ادمین
 * نیست و هیچ مسیری مجوز را مستقیم روی ادمین نمی‌نویسد.
 *
 * دو سطح کش:
 *   • روی نمونهٔ `Admin` (per-request) — تا هر درخواست حداکثر یک کوئری بزند.
 *   • درون خود درخواست برای نقش‌ها.
 */
class RbacService
{
    /** @return list<string> کلیدهای مجوز ادمین (بدون تکرار) */
    public function permissionsFor(Admin $admin): array
    {
        if ($admin->resolvedPermissions !== null) {
            return $admin->resolvedPermissions;
        }

        $keys = Permission::query()
            ->whereIn('id', function ($query) use ($admin): void {
                $query->select('permission_id')
                    ->from('role_permissions')
                    ->whereIn('role_id', function ($inner) use ($admin): void {
                        $inner->select('role_id')->from('admin_roles')->where('admin_id', $admin->getKey());
                    });
            })
            ->pluck('key')
            ->all();

        return $admin->resolvedPermissions = array_values(array_unique($keys));
    }

    /** آیا ادمین این مجوز را دارد؟ فقط تطابق دقیق کلید. */
    public function allows(Admin $admin, string $permission): bool
    {
        return in_array($permission, $this->permissionsFor($admin), true);
    }

    /** @param list<string> $permissions */
    public function allowsAny(Admin $admin, array $permissions): bool
    {
        $granted = $this->permissionsFor($admin);

        foreach ($permissions as $permission) {
            if (in_array($permission, $granted, true)) {
                return true;
            }
        }

        return false;
    }

    /** @return list<string> کلید نقش‌های ادمین */
    public function roleKeysFor(Admin $admin): array
    {
        return $admin->roles()->pluck('key')->all();
    }

    /**
     * اعطای نقش با کلید. تنها مسیر اعطا — هیچ کنترلری این کار را مستقیم نمی‌کند.
     */
    public function assignRole(Admin $admin, string $roleKey): void
    {
        $role = Role::query()->where('key', $roleKey)->firstOrFail();

        $admin->roles()->syncWithoutDetaching([$role->getKey()]);

        $admin->resolvedPermissions = null;
    }
}
