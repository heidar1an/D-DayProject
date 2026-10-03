<?php

namespace Tests\Feature\Admin;

use App\Models\Admin;
use App\Models\Role;
use App\Services\Identity\RbacService;
use Database\Seeders\AdminRbacSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * تنها مسیر ساخت حساب مدیر.
 *
 * چرا تست دارد: اگر این command بی‌صدا حساب تکراری بسازد یا نقش نامعتبر را
 * بپذیرد، اولین خط دفاع پنل شکسته است — و هیچ تست دیگری آن را نمی‌گیرد.
 */
class CreateAdminCommandTest extends TestCase
{
    use InteractsWithAdmin, RefreshDatabase;

    public function test_it_creates_an_admin_with_a_real_role(): void
    {
        $this->seedRbac();

        $this->artisan('tapesh:admin:create', [
            'username' => 'new-editor',
            '--role' => 'editor',
            '--name' => 'نویسندهٔ تازه',
            '--password' => 'Tapesh#1402',
        ])->assertSuccessful();

        $admin = Admin::query()->where('username', 'new-editor')->firstOrFail();

        $this->assertSame('نویسندهٔ تازه', $admin->display_name);
        $this->assertTrue($admin->isActive());
        $this->assertNotNull($admin->password_hash);

        // رمز خام هرگز ذخیره نمی‌شود.
        $this->assertStringNotContainsString('Tapesh#1402', (string) $admin->password_hash);

        $permissions = app(RbacService::class)->permissionsFor($admin);

        $this->assertContains('testbank.read', $permissions);
        $this->assertNotContains('users.superadmin.manage', $permissions);
    }

    public function test_it_refuses_a_duplicate_username_case_insensitively(): void
    {
        $this->seedRbac();
        $this->makeAdmin('editor');

        $existing = Admin::query()->firstOrFail()->username;

        $this->artisan('tapesh:admin:create', [
            'username' => strtoupper($existing),
            '--role' => 'editor',
            '--password' => 'Tapesh#1402',
        ])->assertFailed();

        $this->assertSame(1, Admin::query()->count());
    }

    public function test_it_rejects_an_invalid_username(): void
    {
        $this->seedRbac();

        $this->artisan('tapesh:admin:create', [
            'username' => 'no',
            '--role' => 'editor',
            '--password' => 'Tapesh#1402',
        ])->assertFailed();

        $this->assertSame(0, Admin::query()->count());
    }

    public function test_it_rejects_an_invalid_role(): void
    {
        $this->seedRbac();

        $this->artisan('tapesh:admin:create', [
            'username' => 'someone',
            '--role' => 'root',
            '--password' => 'Tapesh#1402',
        ])->assertFailed();

        $this->assertSame(0, Admin::query()->count());
    }

    public function test_it_refuses_a_weak_password(): void
    {
        $this->seedRbac();

        $this->artisan('tapesh:admin:create', [
            'username' => 'someone',
            '--role' => 'editor',
            '--password' => 'short',
        ])->assertFailed();

        $this->assertSame(0, Admin::query()->count());
    }

    public function test_it_refuses_when_roles_are_not_seeded(): void
    {
        // بدون AdminRbacSeeder هیچ نقشی وجود ندارد ⇒ نباید ادمین بی‌نقش بسازد.
        $this->artisan('tapesh:admin:create', [
            'username' => 'someone',
            '--role' => 'editor',
            '--password' => 'Tapesh#1402',
        ])->assertFailed();

        $this->assertSame(0, Admin::query()->count());
    }

    public function test_the_seeder_never_creates_an_admin_account(): void
    {
        $this->seed(AdminRbacSeeder::class);

        $this->assertSame(0, Admin::query()->count());
        $this->assertSame(3, Role::query()->count());
    }
}
