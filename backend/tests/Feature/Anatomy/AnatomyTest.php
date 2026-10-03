<?php

namespace Tests\Feature\Anatomy;

use App\Models\AnatomyAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsContent;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * Anatomy Assets — فاز ۱۵ (§16-§19).
 *
 * part_key یکتا و تغییرناپذیر؛ دسته از allowlist واقعی viewer؛ مدل 3D فقط
 * روی Media — هیچ باینری‌ای در دیتابیس نیست.
 */
final class AnatomyTest extends TestCase
{
    use BuildsContent, InteractsWithAdmin, RefreshDatabase;

    private ?\App\Models\Admin $admin = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRbac();
    }

    public function test_admin_creates_publishes_and_public_catalog_lists(): void
    {
        $this->admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);

        $media = $this->makeMedia($this->admin, ['visibility' => 'public']);

        $this->postJsonWithOrigin('/api/v1/admin/anatomy/assets', [
            'mediaId' => $media->getKey(),
            'partKey' => 'femur.left',
            'label' => 'استخوان ران',
            'category' => 'bones',
        ], $this->adminCsrf())->assertCreated();

        $asset = AnatomyAsset::query()->where('part_key', 'femur.left')->firstOrFail();
        $this->assertSame(AnatomyAsset::STATUS_DRAFT, $asset->status);

        // draft در کاتالوگ عمومی نیست.
        $this->getJson('/api/v1/anatomy/assets')->assertOk()->assertJsonCount(0, 'data.assets');

        $this->postJsonWithOrigin("/api/v1/admin/anatomy/assets/{$asset->getKey()}/publish", [], $this->adminCsrf())->assertOk();

        $this->getJson('/api/v1/anatomy/assets')
            ->assertOk()
            ->assertJsonPath('data.assets.0.part_key', 'femur.left')
            ->assertJsonPath('data.assets.0.media.id', $media->getKey())
            ->assertJsonPath('data.assets.0.url', fn ($url) => is_string($url) && str_contains($url, '/stream'));
    }

    public function test_part_key_must_be_unique(): void
    {
        $this->admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);

        $media = $this->makeMedia($this->admin);

        $this->postJsonWithOrigin('/api/v1/admin/anatomy/assets', [
            'mediaId' => $media->getKey(), 'partKey' => 'femur.right',
        ], $this->adminCsrf())->assertCreated();

        $this->postJsonWithOrigin('/api/v1/admin/anatomy/assets', [
            'mediaId' => $media->getKey(), 'partKey' => 'femur.right',
        ], $this->adminCsrf())->assertFieldError('partKey');
    }

    public function test_category_is_allowlisted(): void
    {
        $this->admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);

        $media = $this->makeMedia($this->admin);

        $this->postJsonWithOrigin('/api/v1/admin/anatomy/assets', [
            'mediaId' => $media->getKey(), 'partKey' => 'weird.part', 'category' => 'spaceships',
        ], $this->adminCsrf())->assertFieldError('category');
    }

    public function test_part_key_is_immutable_on_update(): void
    {
        $this->admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);

        $media = $this->makeMedia($this->admin);

        $this->postJsonWithOrigin('/api/v1/admin/anatomy/assets', [
            'mediaId' => $media->getKey(), 'partKey' => 'femur.left',
        ], $this->adminCsrf())->assertCreated();

        $asset = AnatomyAsset::query()->where('part_key', 'femur.left')->firstOrFail();

        $this->patchJsonWithOrigin("/api/v1/admin/anatomy/assets/{$asset->getKey()}", [
            'partKey' => 'femur.changed',
        ], $this->adminCsrf())->assertStatus(422);
    }

    public function test_unknown_media_reference_is_rejected(): void
    {
        $this->admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($this->admin);

        $this->postJsonWithOrigin('/api/v1/admin/anatomy/assets', [
            'mediaId' => '00000000-0000-0000-0000-000000000000', 'partKey' => 'x.y',
        ], $this->adminCsrf())->assertFieldError('mediaId');
    }

    public function test_roleless_admin_cannot_manage_assets(): void
    {
        $this->admin = $this->makeRolelessAdmin();
        $this->actingAsAdmin($this->admin);

        $this->getJsonWithAdmin('/api/v1/admin/anatomy/assets')->assertForbidden();
    }

    private function getJsonWithAdmin(string $uri): \Illuminate\Testing\TestResponse
    {
        return $this->getJson($uri);
    }
}
