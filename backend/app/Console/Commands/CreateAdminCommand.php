<?php

namespace App\Console\Commands;

use App\Models\Admin;
use App\Models\Role;
use App\Services\Identity\PasswordHasher;
use App\Services\Identity\RbacService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * ساخت ادمین واقعی — تنها مسیر ساخت حساب پنل.
 *
 * چرا command و نه seeder: seeder با رمز پیش‌فرض یک حساب قابل‌حدس در هر محیطی
 * می‌سازد. اینجا رمز از پرسش تعاملی (`secret`) یا آرگومان گرفته می‌شود و از
 * سیاست رمز موجود عبور می‌کند.
 *
 * نقش پیش‌فرض `editor` است، نه `admin`/`super-admin`: کمترین دسترسی کافی.
 */
class CreateAdminCommand extends Command
{
    protected $signature = 'tapesh:admin:create
        {username : نام کاربری ادمین}
        {--role=editor : نقش (super-admin|admin|editor)}
        {--name= : نام نمایشی}
        {--password= : رمز (اگر ندهید، تعاملی پرسیده می‌شود)}';

    protected $description = 'ساخت یک حساب مدیر پنل با نقش مشخص';

    public function handle(PasswordHasher $hasher, RbacService $rbac): int
    {
        $username = mb_strtolower(trim((string) $this->argument('username')));
        $roleKey = (string) $this->option('role');
        $password = (string) ($this->option('password') ?: $this->secret('رمز ادمین'));

        $validator = Validator::make(
            ['username' => $username, 'password' => $password, 'role' => $roleKey],
            [
                'username' => ['required', 'string', 'min:3', 'max:64', 'regex:/^[a-z0-9](?:[a-z0-9._-]{1,62}[a-z0-9])?$/'],
                'password' => ['required', 'string', 'min:'.(int) config('identity.passwords.min_length'), 'max:'.(int) config('identity.passwords.max_length')],
                'role' => ['required', 'in:'.implode(',', [Role::SUPER_ADMIN, Role::ADMIN, Role::EDITOR])],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        if (Admin::query()->whereRaw('lower(username) = ?', [$username])->exists()) {
            $this->error('این نام کاربری از قبل وجود دارد.');

            return self::FAILURE;
        }

        if (! Role::query()->where('key', $roleKey)->exists()) {
            $this->error('نقش‌ها seed نشده‌اند. اول `php artisan db:seed --class=AdminRbacSeeder` را اجرا کنید.');

            return self::FAILURE;
        }

        $admin = new Admin;
        $admin->forceFill([
            'username' => $username,
            'display_name' => (string) ($this->option('name') ?: $username),
            'password_hash' => $hasher->hash($password),
            'active' => true,
            'must_change_password' => false,
        ])->save();

        $rbac->assignRole($admin, $roleKey);

        $this->info("ادمین «{$username}» با نقش «{$roleKey}» ساخته شد.");

        return self::SUCCESS;
    }
}
