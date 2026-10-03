<?php

namespace App\Services\Media;

use App\Exceptions\ApiErrorException;
use Illuminate\Http\UploadedFile;

/**
 * تشخیص واقعی نوع فایل از magic bytes — فاز ۱۵ (§7).
 *
 * MIME اعلامی (`getMimeType()`) فقط یک ادعاست و قابل جعل؛ اینجا امضای باینری
 * فایل خوانده می‌شود و فقط وقتی نوع «شناسایی‌شده» با یکی از انواع مجاز هم‌خوان
 * بود فایل می‌تواند `image`/`document`/`video`/`model3d` باشد.
 *
 * تصاویر مسیر دوم هم دارند: `getimagesize()` — یک اعتبارسنجی داخلی PHP که هم
 * امضا و هم ابعاد می‌دهد. برای PNG/JPEG/GIF/WebP معتبر است.
 */
final class MediaMimeDetector
{
    /**
     * نوع شناسایی‌شده از امضای فایل، یا null اگر امضا ناشناخته باشد.
     *
     * @return 'image'|'document'|'video'|'model3d'|null
     */
    public function detectKind(string $path, string $declaredMime): ?string
    {
        $sniffed = $this->sniff($path);

        if ($sniffed === null) {
            return null;
        }

        return $sniffed;
    }

    /** @return array{width: int, height: int}|null ابعاد تصویر معتبر */
    public function imageDimensions(string $path): ?array
    {
        $info = @getimagesize($path);

        if ($info === false) {
            return null;
        }

        return ['width' => (int) $info[0], 'height' => (int) $info[1]];
    }

    private function sniff(string $path): ?string
    {
        $handle = @fopen($path, 'rb');

        if ($handle === false) {
            throw ApiErrorException::forbidden('Cannot read the uploaded file.');
        }

        $head = (string) fread($handle, 64);
        fclose($handle);

        // JPEG: FF D8 FF — PNG: 89 50 4E 47 — GIF: GIF8 — WEBP: RIFF....WEBP
        if (str_starts_with($head, "\xFF\xD8\xFF")) {
            return 'image';
        }

        if (str_starts_with($head, "\x89PNG\r\n\x1a\n")) {
            return 'image';
        }

        if (str_starts_with($head, 'GIF8')) {
            return 'image';
        }

        if (str_starts_with($head, 'RIFF') && substr($head, 8, 4) === 'WEBP') {
            return 'image';
        }

        // PDF: %PDF-
        if (str_starts_with($head, '%PDF-')) {
            return 'document';
        }

        // GLB: امضای 'glTF' در بایت‌های 0..3 (binary glTF — Use Case مدل سه‌بعدی).
        if (str_starts_with($head, 'glTF')) {
            return 'model3d';
        }

        // MP4/MOV: box ftyp — WebM: EBML 1A 45 DF A3
        if (substr($head, 4, 4) === 'ftyp') {
            return 'video';
        }

        if (str_starts_with($head, "\x1A\x45\xDF\xA3")) {
            return 'video';
        }

        return null;
    }
}
