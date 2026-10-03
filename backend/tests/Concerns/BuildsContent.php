<?php

namespace Tests\Concerns;

use App\Models\Admin;
use App\Models\Media;
use Illuminate\Http\Testing\FileFactory;
use Illuminate\Http\UploadedFile;

/**
 * ساخت Media برای تست‌های فاز ۱۵/۱۶.
 *
 * آپلود از مسیر **واقعی** multipart انجام می‌شود (نه ساخت مستقیم رکورد) تا
 * magic-byte/size validation هم سنجیده شود. تصویر ۱×۱ واقعی PNG — بدنهٔ
 * امضادار، نه رشتهٔ دلخواه.
 */
trait BuildsContent
{
    protected const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    protected function pngBytes(): string
    {
        return (string) base64_decode(self::PNG_1PX, true);
    }

    /**
     * آپلود واقعی از پنل با ادمین داده‌شده.
     *
     * @param  array<string, mixed>  $overrides
     * @return array{response: \Illuminate\Testing\TestResponse, media: Media|null}
     */
    protected function uploadMediaViaApi(Admin $admin, string $filename = 'figure.png', ?string $bytes = null, array $overrides = []): array
    {
        $bytes ??= $this->pngBytes();

        /** @var UploadedFile */
        $file = (new FileFactory)->createWithContent($filename, $bytes);

        $response = $this
            ->actingAsAdmin($admin)
            ->post('/api/v1/admin/media/uploads', [
                'file' => $file,
                ...$overrides,
            ], [
                'Origin' => $this->origin(),
                ...$this->adminCsrf(),
            ]);

        /** @var Media|null */
        $media = $response->status() === 201
            ? Media::query()->find($response->json('data.media.id'))
            : null;

        return ['response' => $response, 'media' => $media];
    }

    /** @return Media */
    protected function makeMedia(Admin $admin, array $overrides = []): Media
    {
        $result = $this->uploadMediaViaApi($admin, $overrides['filename'] ?? 'figure.png', null, [
            'visibility' => $overrides['visibility'] ?? 'public',
        ]);

        $media = $result['media'];

        \PHPUnit\Framework\assertNotNull($media, 'makeMedia() expected a successful upload.');

        return $media;
    }
}
