<?php

namespace Tests\Concerns;

use App\Models\Admin;
use App\Services\Identity\RbacService;
use Database\Seeders\AdminRbacSeeder;
use Illuminate\Testing\TestResponse;

/**
 * ورود ادمین از مسیر **واقعی** (endpoint + کوکی)، نه دست‌کاری سشن.
 *
 * چرا seeder واقعی و نه ساختن دستی نقش: مجوزهای تست باید همان کلیدهای
 * `testbank.*` پنل واقعی باشند؛ نقش ساختگی یعنی تست چیزی را تأیید می‌کند که در
 * production وجود ندارد.
 */
trait InteractsWithAdmin
{
    protected const ADMIN_PASSWORD = 'Tapesh#1402';

    protected function seedRbac(): void
    {
        $this->seed(AdminRbacSeeder::class);
    }

    protected function makeAdmin(string $roleKey = 'editor', ?string $password = null): Admin
    {
        $password ??= self::ADMIN_PASSWORD;

        $admin = Admin::factory()->withPassword($password)->create();

        app(RbacService::class)->assignRole($admin, $roleKey);

        return $admin->refresh();
    }

    /** ادمین بدون هیچ نقشی — برای تست deny-by-default. */
    protected function makeRolelessAdmin(): Admin
    {
        return Admin::factory()->withPassword(self::ADMIN_PASSWORD)->create();
    }

    protected function loginAdmin(Admin $admin, ?string $password = null): TestResponse
    {
        return $this->postJsonWithOrigin('/api/v1/admin/auth/login', [
            'username' => $admin->username,
            'password' => $password ?? self::ADMIN_PASSWORD,
        ]);
    }

    /** پاسخ ورود ادمین — برای برداشتن هدر CSRF در نوشتن‌های بعدی. */
    protected ?TestResponse $adminLogin = null;

    /** ورود و چسباندن کوکی‌ها به درخواست‌های بعدی. */
    protected function actingAsAdmin(Admin $admin, ?string $password = null): static
    {
        $response = $this->loginAdmin($admin, $password);

        $response->assertOk();

        $this->adminLogin = $response;

        return $this->withAuthCookies($response);
    }

    /**
     * هدر CSRF سشن ادمین.
     *
     * مسیرهای نوشتاری پنل `api.csrf` دارند (double-submit)؛ بدون این هدر هر
     * POST/PATCH پنل ۴۰۳ می‌گیرد. تست باید مثل مرورگر رفتار کند، نه اینکه
     * میان‌افزار را دور بزند.
     *
     * @return array<string, string>
     */
    protected function adminCsrf(): array
    {
        $this->assertNotNull($this->adminLogin, 'actingAsAdmin() must run before adminCsrf().');

        return $this->csrfHeader($this->adminLogin);
    }
}
