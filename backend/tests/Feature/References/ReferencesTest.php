<?php

namespace Tests\Feature\References;

use App\Models\Reference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsContent;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * References — فاز ۱۵ (§12-§15/§61/§63).
 *
 * lifecycle واقعی draft/published/archived؛ پیش‌نویس در مسیر عمومی ۴۰۴ است و
 * محتوای sections فقط از پاک‌ساز whitelist عبور می‌کند.
 */
final class ReferencesTest extends TestCase
{
    use BuildsContent, InteractsWithAdmin, RefreshDatabase;

    private ?\App\Models\Admin $admin = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRbac();
    }

    /** @param array<string, mixed> $overrides */
    private function sections(array $overrides = []): array
    {
        return [[
            'id' => 'sec-1',
            'title' => 'فصل اول',
            'topics' => [[
                'id' => 'topic-1',
                'title' => 'موضوع اول',
                'content' => $overrides['content'] ?? '<p>متن <strong>مهم</strong></p>',
            ]],
        ]];
    }

    private function storeReference(): \Illuminate\Testing\TestResponse
    {
        /** @var \App\Models\Admin $admin */
        $admin = $this->admin;

        return $this->postJsonWithOrigin('/api/v1/admin/references', [
            'slug' => 'anatomy-atlas',
            'title' => 'اطلس آناتومی',
            'description' => 'مرجع تصویری',
            'sections' => $this->sections(),
        ], $this->adminCsrf());
    }

    public function test_admin_creates_draft_and_body_is_sanitized(): void
    {
        $this->admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);

        $this->postJsonWithOrigin('/api/v1/admin/references', [
            'slug' => 'xss-atlas',
            'title' => 'تست XSS',
            'sections' => $this->sections(['content' => '<p>سلام</p><script>alert(1)</script><p onclick="x()">حمله</p><a href="javascript:evil()">لینک</a>']),
        ], $this->adminCsrf())->assertCreated();

        $reference = Reference::query()->where('slug', 'xss-atlas')->firstOrFail();

        $this->assertStringNotContainsString('<script', (string) $reference->sections[0]['topics'][0]['content']);
        $this->assertStringNotContainsString('onclick', (string) $reference->sections[0]['topics'][0]['content']);
        $this->assertStringNotContainsString('javascript:', (string) $reference->sections[0]['topics'][0]['content']);
        $this->assertStringContainsString('سلام', (string) $reference->sections[0]['topics'][0]['content']);
        $this->assertSame(Reference::STATUS_DRAFT, $reference->status);
    }

    public function test_public_list_and_detail_show_published_only(): void
    {
        $this->admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);

        $this->storeReference()->assertCreated();
        $reference = Reference::query()->where('slug', 'anatomy-atlas')->firstOrFail();

        // draft در فهرست عمومی نیست.
        $this->getJson('/api/v1/references')->assertOk()->assertJsonCount(0, 'data.references');

        $this->getJson("/api/v1/references/{$reference->slug}")->assertNotFound();

        $this->actingAsAdmin($this->admin)
            ->postJsonWithOrigin("/api/v1/admin/references/{$reference->getKey()}/publish", [], $this->adminCsrf())
            ->assertOk();

        $this->getJson('/api/v1/references')
            ->assertOk()
            ->assertJsonPath('data.references.0.slug', 'anatomy-atlas');

        $this->getJson("/api/v1/references/{$reference->slug}")
            ->assertOk()
            ->assertJsonPath('data.reference.title', 'اطلس آناتومی')
            ->assertJsonPath('data.reference.chapterCount', 1);
    }

    public function test_assets_map_appears_in_public_detail(): void
    {
        $this->admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);

        $this->storeReference()->assertCreated();
        $reference = Reference::query()->where('slug', 'anatomy-atlas')->firstOrFail();

        $media = $this->makeMedia($this->admin, ['visibility' => 'public']);

        $this->postJsonWithOrigin("/api/v1/admin/references/{$reference->getKey()}/assets", [
            'mediaId' => $media->getKey(),
            'key' => 'anatomy',
        ], $this->adminCsrf())->assertCreated();

        $this->postJsonWithOrigin("/api/v1/admin/references/{$reference->getKey()}/publish", [], $this->adminCsrf())->assertOk();

        $this->getJson("/api/v1/references/{$reference->slug}")
            ->assertOk()
            ->assertJsonStructure(['data' => ['reference' => ['assets' => ['anatomy']]]]);
    }

    public function test_version_conflict_returns_409(): void
    {
        $this->admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);

        $this->storeReference()->assertCreated();
        $reference = Reference::query()->where('slug', 'anatomy-atlas')->firstOrFail();

        $this->patchJsonWithOrigin("/api/v1/admin/references/{$reference->getKey()}", [
            'title' => 'نسخهٔ جدید',
            'expectedVersion' => 99,
        ], $this->adminCsrf())->assertStatus(409);
    }

    public function test_roleless_admin_cannot_manage_references(): void
    {
        $this->admin = $this->makeRolelessAdmin();
        $this->actingAsAdmin($this->admin);

        $this->storeReference()->assertForbidden();
    }

    public function test_guest_cannot_reach_admin_endpoints(): void
    {
        $this->postJsonWithOrigin('/api/v1/admin/references', ['slug' => 'x', 'title' => 'y'])
            ->assertUnauthorized();
    }

    public function test_sections_structure_is_bounded(): void
    {
        $this->admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);

        $max = (int) config('references.max_sections');

        $this->postJsonWithOrigin('/api/v1/admin/references', [
            'slug' => 'too-big',
            'title' => 'بزرگ',
            'sections' => collect(range(1, $max + 1))->map(fn ($i) => ['id' => "s{$i}", 'title' => 'فصل', 'topics' => []])->all(),
        ], $this->adminCsrf())->assertStatus(422)->assertFieldError('sections');
    }
}
