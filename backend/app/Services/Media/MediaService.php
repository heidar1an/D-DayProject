<?php

namespace App\Services\Media;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Models\Media;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * آپلود و چرخهٔ حیات Media — فاز ۱۵.
 *
 * اعتبارسنجی چندلایه (§7): پسوند مجاز + MIME اعلامی + MIME شناسایی‌شده از
 * magic bytes + سقف حجم بر اساس kind از config. هیچ‌کدام به‌تنهایی قابل اتکا
 * نیستند و ترتیبشان مهم است.
 *
 * مسیر ذخیره از ورودی کاربر ساخته **نمی‌شود** (`media/{y}/{m}/{uuid}.{ext}`) —
 * double extension و path traversal در ریشه بی‌معنا می‌شوند (§8).
 * `sha256` فقط سمت سرور محاسبه می‌شود؛ ادعای کلاینت هرگز منبع حقیقت نیست (§9).
 */
final class MediaService
{
    public function __construct(
        private readonly MediaMimeDetector $detector,
    ) {}

    /**
     * ذخیرهٔ فایل و ساخت رکورد Media.
     *
     * @param  array{visibility?: string, purpose?: string}  $options
     */
    public function store(Admin|User $uploader, UploadedFile $file, array $options = []): Media
    {
        if (! $file->isValid()) {
            throw new ApiErrorException('UPLOAD_INVALID', 422, 'The uploaded file is not valid.');
        }

        $original = (string) $file->getClientOriginalName();
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $declaredMime = strtolower((string) $file->getMimeType());

        $kind = $this->resolveKind($extension, $file, $declaredMime);
        $rules = (array) config('media.kinds.'.$kind);
        if ($uploader instanceof User && ($options['purpose'] ?? null) !== 'ai') {
            throw ApiErrorException::forbidden();
        }
        if ($uploader instanceof User && ! in_array($kind, ['image', 'document'], true)) {
            throw new ApiErrorException('UPLOAD_TYPE_REJECTED', 415, 'This file type is not accepted for AI.');
        }
        $maxBytes = (int) ($rules['max_bytes'] ?? 0);

        if ($maxBytes <= 0 || $file->getSize() > $maxBytes) {
            throw new ApiErrorException('UPLOAD_TOO_LARGE', 413, 'The file exceeds the maximum allowed size for its type.');
        }

        $visibility = $options['visibility'] ?? Media::VISIBILITY_PRIVATE;
        if ($uploader instanceof User && $visibility !== Media::VISIBILITY_PRIVATE) {
            throw ApiErrorException::forbidden('AI attachments must be private.');
        }

        if (! in_array($visibility, [Media::VISIBILITY_PUBLIC, Media::VISIBILITY_PRIVATE], true)) {
            throw new ApiErrorException('VALIDATION_FAILED', 422, 'Invalid visibility.');
        }

        $diskName = (string) config('media.disks.'.$visibility);
        $mime = $declaredMime;
        $sha256 = hash_file('sha256', (string) $file->getRealPath());
        $key = sprintf('media/%s/%s.%s', now()->format('Y/m'), (string) Str::uuid(), $extension);

        /** @var Media $media */
        $media = DB::transaction(function () use ($uploader, $file, $diskName, $key, $kind, $mime, $sha256, $visibility, $original): Media {
            $stream = fopen((string) $file->getRealPath(), 'rb');
            $stored = Storage::disk($diskName)->put($key, $stream);

            if (! is_resource($stream)) {
                fclose($stream);
            }

            if (! $stored) {
                throw new ApiErrorException('UPLOAD_FAILED', 500, 'Could not store the uploaded file.');
            }

            $metadata = $kind === 'image' ? $this->detector->imageDimensions((string) $file->getRealPath()) : null;

            $media = new Media;
            $media->forceFill([
                'owner_admin_id' => $uploader instanceof Admin ? $uploader->getKey() : null,
                'owner_user_id' => $uploader instanceof User ? $uploader->getKey() : null,
                'disk' => $diskName,
                'key' => $key,
                'kind' => $kind,
                'mime' => $mime,
                'size_bytes' => (int) $file->getSize(),
                'sha256' => $sha256,
                'visibility' => $visibility,
                'status' => Media::STATUS_ACTIVE,
                'original_name' => $original,
                'metadata' => $uploader instanceof User ? ['purpose' => 'ai', 'dimensions' => $metadata] : $metadata,
            ]);
            $media->save();

            return $media;
        });

        return $media;
    }

    /**
     * جست‌وجو با checksum — برای Migration/dedup ابزار آینده؛ آپلود خودکار
     * جایگزین نمی‌شود چون مالکیت و visibility دو رکورد هم‌ checksum می‌تواند
     * متفاوت باشد (§9).
     */
    public function findByChecksum(string $sha256): ?Media
    {
        if (! preg_match('/^[a-f0-9]{64}$/', $sha256)) {
            return null;
        }

        /** @var Media|null */
        return Media::query()->where('sha256', $sha256)->where('status', Media::STATUS_ACTIVE)->first();
    }

    /** آرشیو (حذف نرم) — حذف فیزیکی فایل عمداً انجام نمی‌شود (§63). */
    public function archive(Media $media): Media
    {
        $media->forceFill(['status' => Media::STATUS_ARCHIVED])->save();

        return $media;
    }

    /** حذف فیزیکی رکوردِ بدون مصرف — فقط برای رکورد آرشیوشده. */
    public function deleteArchived(Media $media): void
    {
        if ($media->status !== Media::STATUS_ARCHIVED) {
            throw new ApiErrorException('MEDIA_NOT_ARCHIVED', 409, 'Only archived media can be permanently deleted.');
        }

        DB::transaction(function () use ($media): void {
            try {
                Storage::disk($media->disk)->delete($media->key);
            } catch (Throwable) {
                // فایل ناموجود نباید رکورد را قفل کند؛ رکورد حذف می‌شود.
            }

            $media->delete();
        });
    }

    /**
     * kind از پسوند + MIME اعلامی تعیین می‌شود و بعد امضای واقعی فایل تأییدش —
     * MIME spoofing در همین مرحله ۴۱۵ می‌گیرد (§7/§61).
     *
     * @param  string  $declaredMime
     * @return 'image'|'document'|'video'|'model3d'
     */
    private function resolveKind(string $extension, UploadedFile $file, string $declaredMime): string
    {
        $candidate = null;

        foreach ((array) config('media.kinds') as $kind => $rules) {
            if (in_array($extension, (array) ($rules['extensions'] ?? []), true)) {
                $candidate = (string) $kind;

                break;
            }
        }

        if ($candidate === null) {
            throw new ApiErrorException('UPLOAD_TYPE_REJECTED', 415, 'This file type is not accepted.');
        }

        $allowedMimes = (array) (config('media.kinds.'.$candidate.'.mimes') ?? []);

        if ($allowedMimes !== [] && ! in_array($declaredMime, $allowedMimes, true)) {
            throw new ApiErrorException('UPLOAD_TYPE_REJECTED', 415, 'The declared MIME type does not match the file extension.');
        }

        $detected = $this->detector->detectKind((string) $file->getRealPath(), $declaredMime);

        if ($detected !== $candidate) {
            throw new ApiErrorException('UPLOAD_TYPE_REJECTED', 415, 'The file content does not match its declared type.');
        }

        return $candidate;
    }
}
