<?php

namespace Tests\Feature\Admin;

use App\Models\AuditLog;
use App\Services\Settings\SystemSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use LogicException;
use Tests\Concerns\BuildsOps;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * پنل مدیریتی — فاز ۲۰: داشبورد، کاربران، Audit، تنظیمات.
 *
 * تمرکز: مجوز واقعی (deny-by-default)، عدم افشای دادهٔ حساس، append-only بودن
 * Audit، optimistic lock و پوشش/redact شدن Audit.
 */
final class AdminPanelTest extends TestCase
{
    use BuildsOps, InteractsWithAdmin, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRbac();
    }

    /**
     * ورود ادمین با نقش داده‌شده و برگرداندن خودِ TestCase، تا زنجیرهٔ
     * `->getJson(...)`/`->patchJsonWithOrigin(...)` مثل مرورگر کار کند.
     */
    private function asAdmin(string $role = 'admin'): static
    {
        $this->actingAsAdmin($this->makeAdmin($role));

        return $this;
    }

    /* ── داشبورد ─────────────────────────────────────────────────────── */

    public function test_dashboard_requires_a_permission(): void
    {
        $this->actingAsAdmin($this->makeRolelessAdmin())
            ->getJson('/api/v1/admin/dashboard')
            ->assertForbidden();
    }

    public function test_dashboard_reports_real_numbers(): void
    {
        $this->register(['phone' => '09122000001']);
        $this->register(['phone' => '09122000002']);
        $this->forgetCookies();

        $response = $this->asAdmin('admin')->getJson('/api/v1/admin/dashboard');

        $response->assertOk()
            ->assertJsonPath('data.dashboard.users.total', 2)
            ->assertJsonPath('data.dashboard.content.articles.total', 0)
            ->assertJsonStructure(['data' => ['dashboard' => ['operations' => ['outboxPending', 'failedJobs', 'searchDocuments', 'auditLogs']]]]);
    }

    public function test_dashboard_audit_counter_moves_with_real_writes(): void
    {
        $admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($admin);

        $this->postJsonWithOrigin('/api/v1/admin/articles', [
            'slug' => 'dash-check',
            'title' => 'بررسی داشبورد',
            'body' => '<p>متن</p>',
        ], $this->adminCsrf())->assertCreated();

        $this->actingAsAdmin($this->makeAdmin('admin'))
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.dashboard.operations.auditLogs', 1);
    }

    /* ── کاربران ─────────────────────────────────────────────────────── */

    public function test_user_list_requires_users_read(): void
    {
        $this->asAdmin('editor')->getJson('/api/v1/admin/users')->assertForbidden();
    }

    public function test_user_list_never_exposes_sensitive_columns(): void
    {
        $this->register(['phone' => '09122000003']);
        $this->forgetCookies();

        $response = $this->asAdmin('admin')->getJson('/api/v1/admin/users');

        $response->assertOk()
            ->assertJsonPath('data.users.0.phone', '09122000003')
            ->assertJsonMissingPath('data.users.0.passwordHash')
            ->assertJsonMissingPath('data.users.0.password_hash')
            ->assertJsonMissingPath('data.users.0.googleSubject')
            ->assertJsonPath('data.users.0.googleLinked', false);
    }

    public function test_user_detail_is_not_found_for_an_unknown_id(): void
    {
        $this->asAdmin('admin')->getJson('/api/v1/admin/users/'.Str::uuid())->assertNotFound();
    }

    public function test_user_filters_and_sort_are_allowlisted(): void
    {
        $this->register(['phone' => '09122000004']);
        $this->forgetCookies();

        $admin = $this->asAdmin('admin');

        $admin->getJson('/api/v1/admin/users?sort=password_hash')->assertStatus(422);
        $admin->getJson('/api/v1/admin/users?isAdmin=true')->assertStatus(400);
        $admin->getJson('/api/v1/admin/users?phone=0912200')->assertOk()->assertJsonPath('meta.total', 1);
    }

    /* ── Audit ───────────────────────────────────────────────────────── */

    public function test_every_successful_admin_mutation_is_audited(): void
    {
        $admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($admin);

        $this->postJsonWithOrigin('/api/v1/admin/articles', [
            'slug' => 'audit-me',
            'title' => 'قابل حسابرسی',
            'body' => '<p>متن</p>',
        ], $this->adminCsrf())->assertCreated();

        $log = AuditLog::query()->firstOrFail();

        self::assertSame('admin', (string) $log->actor_type);
        self::assertSame((string) $admin->getKey(), (string) $log->actor_id);
        self::assertSame('api.v1.admin.articles.store', (string) $log->action);
        self::assertNotNull($log->request_id);
    }

    public function test_a_failed_admin_write_is_not_audited(): void
    {
        $this->actingAsAdmin($this->makeAdmin('editor'));

        $this->postJsonWithOrigin('/api/v1/admin/articles', ['title' => ''], $this->adminCsrf())
            ->assertStatus(422);

        self::assertSame(0, AuditLog::query()->count());
    }

    public function test_audit_target_is_recorded_for_a_targeted_mutation(): void
    {
        $admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($admin);

        $article = $this->makeArticle(['title' => 'هدف']);

        $this->patchJsonWithOrigin('/api/v1/admin/articles/'.$article->getKey(), [
            'title' => 'هدف ویرایش‌شده',
        ], $this->adminCsrf())->assertOk();

        $log = AuditLog::query()->orderByDesc('created_at')->firstOrFail();

        self::assertSame('id', (string) $log->target_type);
        self::assertSame((string) $article->getKey(), (string) $log->target_id);
    }

    public function test_audit_redacts_sensitive_keys(): void
    {
        $admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($admin);

        /* بدنهٔ حساس از مسیر یک endpoint واقعی نوشتاری فرستاده می‌شود. */
        $article = $this->makeArticle(['title' => 'راز']);

        $this->patchJsonWithOrigin('/api/v1/admin/articles/'.$article->getKey(), [
            'title' => 'عنوان تازه',
            'password' => 'SuperSecret#1',
        ], $this->adminCsrf());

        $log = AuditLog::query()->orderByDesc('created_at')->firstOrFail();
        $changes = (array) $log->changes;

        if (array_key_exists('password', $changes)) {
            self::assertSame((string) config('audit.redacted_placeholder'), $changes['password']);
        }

        self::assertStringNotContainsString('SuperSecret#1', json_encode($log->changes));
    }

    public function test_audit_logs_require_logs_read(): void
    {
        $this->asAdmin('editor')->getJson('/api/v1/admin/audit-logs')->assertForbidden();
    }

    public function test_audit_logs_are_listed_and_append_only(): void
    {
        $admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($admin);
        $this->postJsonWithOrigin('/api/v1/admin/articles', ['slug' => 'log-1', 'title' => 'لاگ', 'body' => 'x'], $this->adminCsrf())->assertCreated();

        $log = AuditLog::query()->firstOrFail();

        $this->actingAsAdmin($this->makeAdmin('admin'))
            ->getJson('/api/v1/admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('data.logs.0.action', 'api.v1.admin.articles.store')
            ->assertJsonPath('meta.total', 1);

        /* هیچ مسیر ویرایش/حذفی وجود ندارد و مدل هم قفل است. */
        $this->actingAsAdmin($this->makeAdmin('admin'))
            ->patchJson('/api/v1/admin/audit-logs/'.$log->getKey(), [], ['Origin' => $this->origin()])
            ->assertStatus(405);

        $this->expectException(LogicException::class);
        $log->forceFill(['action' => 'tampered'])->save();
    }

    /* ── تنظیمات ─────────────────────────────────────────────────────── */

    public function test_settings_require_settings_read(): void
    {
        $this->asAdmin('editor')->getJson('/api/v1/admin/settings')->assertForbidden();
    }

    public function test_settings_list_masks_secret_values(): void
    {
        $response = $this->asAdmin('super-admin')->getJson('/api/v1/admin/settings');

        $response->assertOk();

        $settings = collect($response->json('data.settings'));

        $secret = $settings->firstWhere('key', 'integration.gateway_api_key');

        self::assertNotNull($secret);
        self::assertTrue($secret['secret']);
        /* تنظیم‌نشده ⇒ null؛ مقدار خام هرگز از این مسیر بیرون نمی‌زند. */
        self::assertNull($secret['value']);

        $plain = $settings->firstWhere('key', 'site.announcement');

        self::assertNotNull($plain);
        self::assertFalse($plain['secret']);
        self::assertSame('', $plain['value']);
    }

    public function test_an_unknown_setting_key_is_rejected(): void
    {
        $this->asAdmin('admin')
            ->patchJsonWithOrigin('/api/v1/admin/settings', ['key' => 'made.up.key', 'value' => 'x'], $this->adminCsrf())
            ->assertStatus(422);
    }

    public function test_a_setting_update_is_versioned_and_audited_without_leaking_the_value(): void
    {
        $admin = $this->asAdmin('admin');

        $admin->patchJsonWithOrigin('/api/v1/admin/settings', [
            'key' => 'site.announcement',
            'value' => 'سلام',
        ], $this->adminCsrf())->assertOk()->assertJsonPath('data.setting.version', 1);

        $log = AuditLog::query()->where('action', 'api.v1.admin.settings.update')->firstOrFail();

        /* بدنهٔ این مسیر معاف است: مقدار خام هرگز در audit نمی‌نشیند. */
        self::assertNull($log->changes);
    }

    public function test_a_stale_version_gets_a_conflict(): void
    {
        $admin = $this->asAdmin('admin');

        $admin->patchJsonWithOrigin('/api/v1/admin/settings', ['key' => 'content.default_page_size', 'value' => 30], $this->adminCsrf())
            ->assertOk()
            ->assertJsonPath('data.setting.version', 1);

        $admin->patchJsonWithOrigin('/api/v1/admin/settings', [
            'key' => 'content.default_page_size',
            'value' => 40,
            'version' => 1,
        ], $this->adminCsrf())->assertOk()->assertJsonPath('data.setting.version', 2);

        /* نسخهٔ کهنه ⇒ ۴۰۹ (ادمین دیگر جلوتر رفته). */
        $admin->patchJsonWithOrigin('/api/v1/admin/settings', [
            'key' => 'content.default_page_size',
            'value' => 50,
            'version' => 1,
        ], $this->adminCsrf())->assertStatus(409);
    }

    public function test_a_secret_setting_requires_the_security_permission(): void
    {
        $admin = $this->asAdmin('admin');

        $admin->patchJsonWithOrigin('/api/v1/admin/settings', [
            'key' => 'integration.gateway_api_key',
            'value' => 'sk-live-123',
        ], $this->adminCsrf())->assertForbidden();
    }

    public function test_a_super_admin_can_store_a_secret_and_never_reads_it_back(): void
    {
        $admin = $this->asAdmin('super-admin');

        $admin->patchJsonWithOrigin('/api/v1/admin/settings', [
            'key' => 'integration.gateway_api_key',
            'value' => 'sk-live-123',
        ], $this->adminCsrf())->assertOk();

        $list = $admin->getJson('/api/v1/admin/settings')->assertOk();

        $secret = collect($list->json('data.settings'))->firstWhere('key', 'integration.gateway_api_key');
        self::assertSame((string) config('settings.secret_placeholder'), $secret['value']);

        /* مقدار واقعی فقط از سرویس درون‌برنامه‌ای خوانده می‌شود. */
        self::assertSame('sk-live-123', app(SystemSettingsService::class)->value('integration.gateway_api_key'));

        self::assertStringNotContainsString('sk-live-123', (string) $list->getContent());
    }

    public function test_an_out_of_range_integer_setting_is_rejected(): void
    {
        $this->asAdmin('admin')
            ->patchJsonWithOrigin('/api/v1/admin/settings', [
                'key' => 'content.default_page_size',
                'value' => 9999,
            ], $this->adminCsrf())
            ->assertStatus(422);
    }

    public function test_settings_writes_require_csrf(): void
    {
        $this->asAdmin('admin')
            ->patchJson('/api/v1/admin/settings', ['key' => 'site.announcement', 'value' => 'x'], ['Origin' => $this->origin()])
            ->assertForbidden();
    }

    public function test_a_guest_cannot_touch_the_panel(): void
    {
        $this->forgetCookies()->getJson('/api/v1/admin/dashboard')->assertUnauthorized();
        $this->forgetCookies()->getJson('/api/v1/admin/users')->assertUnauthorized();
        $this->forgetCookies()->getJson('/api/v1/admin/settings')->assertUnauthorized();
    }
}
