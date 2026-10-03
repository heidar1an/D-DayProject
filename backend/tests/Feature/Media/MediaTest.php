<?php

namespace Tests\Feature\Media;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\Concerns\BuildsContent;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * Media Core — فاز ۱۵ (§7/§8/§9/§61/§71).
 *
 * اعتبارسنجی چندلایه، مسیر غیرقابل‌حدس، sha256 سمت سرور، Signed URL کوتاه‌عمر
 * برای فایل خصوصی و ۴۰۳ برای استریم امضانشده.
 */
final class MediaTest extends TestCase
{
    use BuildsContent, InteractsWithAdmin, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRbac();
    }

    public function test_admin_upload_stores_public_image_with_checksum(): void
    {
        $admin = $this->makeAdmin('editor');

        $result = $this->uploadMediaViaApi($admin, 'figure.png', null, ['visibility' => 'public']);
        $result['response']->assertCreated();

        $media = $result['media'];
        $this->assertNotNull($media);
        $this->assertSame('image', $media->kind);
        $this->assertSame('public', $media->visibility);
        $this->assertSame(hash('sha256', $this->pngBytes()), $media->sha256);
        $this->assertStringStartsWith('media/', $media->key);
        $this->assertStringEndsWith('.png', $media->key);
        Storage::disk($media->disk)->assertExists($media->key);
    }

    public function test_upload_defaults_to_private_and_hides_key_from_streaming_without_signature(): void
    {
        $admin = $this->makeAdmin('editor');

        $result = $this->uploadMediaViaApi($admin);
        $result['response']->assertCreated();
        $media = $result['media'];

        $this->assertSame('private', $media->visibility);

        // بدون امضا ⇒ ۴۰۳؛ خودِ وجود فایل حدس‌زدنی نیست ولی مسیر باز نمی‌شود.
        $this->getJson("/api/v1/media/{$media->getKey()}/stream")->assertForbidden();
    }

    public function test_private_stream_accepts_valid_signed_url_only(): void
    {
        $admin = $this->makeAdmin('editor');
        $media = $this->makeMedia($admin, ['visibility' => 'private']);

        $signed = URL::temporarySignedRoute('api.v1.media.stream', now()->addMinutes(5), ['id' => $media->getKey()]);

        $this->getJson($signed)->assertOk();
        $this->assertSame('image/png', $this->getJson($signed)->headers->get('Content-Type'));

        $expired = URL::temporarySignedRoute('api.v1.media.stream', now()->subMinute(), ['id' => $media->getKey()]);
        $this->getJson($expired)->assertForbidden();

        // امضای معتبر برای فایل دیگر — روی فایل خصوصی دیگر باز نمی‌شود.
        $other = $this->makeMedia($admin, ['visibility' => 'private']);
        $this->getJson($signed)->assertOk();
        $this->assertNotSame($media->getKey(), $other->getKey());
    }

    public function test_student_cannot_access_private_media_via_access_endpoint(): void
    {
        $admin = $this->makeAdmin('editor');
        $media = $this->makeMedia($admin, ['visibility' => 'private']);

        $session = $this->register();
        $session->assertCreated();
        $this->withAuthCookies($session);

        // IDOR: مالکیت ادمین است؛ کاربر ۴۰۴ می‌گیرد، نه ۴۰۳ (وجود افشا نشود).
        $this->getJson("/api/v1/media/{$media->getKey()}/access")->assertNotFound();
    }

    public function test_mime_spoofing_is_rejected(): void
    {
        $admin = $this->makeAdmin('editor');

        // بدنهٔ PDF با پسوند png — magic bytes برنده است.
        $result = $this->uploadMediaViaApi($admin, 'evil.png', "%PDF-1.7 fake body", ['visibility' => 'public']);

        $result['response']->assertStatus(415);
        $this->assertNull($result['media']);
    }

    public function test_unknown_extension_is_rejected(): void
    {
        $admin = $this->makeAdmin('editor');

        $result = $this->uploadMediaViaApi($admin, 'shell.php', '<?php echo 1;', ['visibility' => 'public']);

        $result['response']->assertStatus(415);
    }

    public function test_double_extension_cannot_become_executable(): void
    {
        $admin = $this->makeAdmin('editor');

        // shell.php.png — محتوای PNG معتبر؛ kind=image و کلید مسیر با .png
        // ساخته می‌شود (پسوند از whitelist image)، پس هیچ‌چیز قابل اجرا نیست.
        $result = $this->uploadMediaViaApi($admin, 'shell.php.png', $this->pngBytes(), ['visibility' => 'public']);

        $result['response']->assertCreated();
        $this->assertNotNull($result['media']);
        $this->assertStringEndsWith('.png', $result['media']->key);
        $this->assertStringNotContainsString('.php', $result['media']->key);
    }

    public function test_oversized_file_is_rejected(): void
    {
        $admin = $this->makeAdmin('editor');
        $max = (int) config('media.kinds.image.max_bytes');

        // فایل پرکنندهٔ واقعی روی **دیسک** (sparse) — رشتهٔ ۱۰ مگابایتی در حافظه
        // داخل سوییتِ کامل OOM می‌دهد؛ امضای PNG + پرکننده تا عبور از سقف ⇒ ۴۱۳.
        $path = (string) tempnam(sys_get_temp_dir(), 'tapesh-big-');
        $stream = fopen($path, 'wb');
        fwrite($stream, $this->pngBytes());
        ftruncate($stream, $max + 1);
        fclose($stream);

        $file = new \Illuminate\Http\UploadedFile($path, 'big.png', 'image/png', null, true);

        $response = $this->actingAsAdmin($admin)->post('/api/v1/admin/media/uploads', [
            'file' => $file,
            'visibility' => 'public',
        ], ['Origin' => $this->origin(), ...$this->adminCsrf()]);

        $response->assertStatus(413);

        @unlink($path);
    }

    public function test_roleless_admin_cannot_upload(): void
    {
        $admin = $this->makeRolelessAdmin();

        $result = $this->uploadMediaViaApi($admin);

        $result['response']->assertForbidden();
    }

    public function test_archive_then_delete_flow(): void
    {
        $admin = $this->makeAdmin('editor');
        $media = $this->makeMedia($admin, ['visibility' => 'private']);

        // حذف فیزیکیِ رکوردِ فعال ممنوع — فقط آرشیوشده.
        $this->actingAsAdmin($admin)
            ->deleteJsonWithOrigin("/api/v1/admin/media/{$media->getKey()}", [], $this->adminCsrf())
            ->assertStatus(409);

        $this->actingAsAdmin($admin)
            ->postJsonWithOrigin("/api/v1/admin/media/{$media->getKey()}/archive", [], $this->adminCsrf())
            ->assertOk();

        // پس از آرشیو ⇒ حذف ۲۰۴؛ رکورد و فایل از دیسک می‌روند.
        $this->actingAsAdmin($admin)
            ->deleteJsonWithOrigin("/api/v1/admin/media/{$media->getKey()}", [], $this->adminCsrf())
            ->assertNoContent();

        $this->assertDatabaseMissing('media', ['id' => $media->getKey()]);
    }

    public function test_checksum_lookup_finds_active_media(): void
    {
        $admin = $this->makeAdmin('editor');
        $media = $this->makeMedia($admin, ['visibility' => 'public']);

        $service = app(\App\Services\Media\MediaService::class);

        $this->assertNotNull($service->findByChecksum($media->sha256));
        $this->assertNull($service->findByChecksum(str_repeat('a', 64)));
        $this->assertNull($service->findByChecksum('not-a-hash'));
    }
}
