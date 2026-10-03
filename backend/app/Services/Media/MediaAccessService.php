<?php

namespace App\Services\Media;

use App\Models\Admin;
use App\Models\Media;
use App\Models\User;
use Illuminate\Support\Facades\URL;

/**
 * دسترسی به فایل — فاز ۱۵ (§6/§71).
 *
 * هیچ مسیر مستقیم `/media/{id}` بدون Policy وجود ندارد. URL دائمی قابل‌اشتراک
 * تولید نمی‌شود؛ فایل خصوصی فقط با Signed URL کوتاه‌عمر از `access` عبور می‌کند
 * و امضا فقط همین endpoint را باز می‌کند، نه Object دیگر را.
 *
 * مالکیت کاربر از سشن تعیین می‌شود؛ `user_id` بدنهٔ درخواست هرگز منبع مجوز نیست.
 */
final class MediaAccessService
{
    /**
     * آیا کاربر سشن به این Media دسترسی دارد؟ عمومی‌ها همه؛ خصوصی فقط مالک.
     */
    public function canUserAccess(Media $media, ?User $user): bool
    {
        if ($media->isPublic()) {
            return true;
        }

        return $user instanceof User
            && (string) $media->owner_user_id === (string) $user->getKey();
    }

    /**
     * آیا ادمین به این Media دسترسی دارد؟ (مسیر پنل با `api.can:media.read`
     * قبلاً قفل شده؛ اینجا فقط لایهٔ دامنه برای ساختن URL است.)
     */
    public function canAdminAccess(Media $media, Admin $admin): bool
    {
        return true;
    }

    /**
     * URL استریم. خصوصی ⇒ Signed URL با TTL کوتاه؛ عمومی ⇒ URL استریم ساده
     * (visibility خودش در مسیر استریم چک می‌شود).
     *
     * @return array{url: string, expiresAt: string|null}
     */
    public function accessFor(Media $media): array
    {
        if ($media->isPublic()) {
            return [
                'url' => rtrim((string) URL::route('api.v1.media.stream', ['id' => $media->getKey()]), '/'),
                'expiresAt' => null,
            ];
        }

        $expiresAt = now()->addMinutes((int) config('media.signed_ttl_minutes'));

        return [
            'url' => URL::temporarySignedRoute('api.v1.media.stream', $expiresAt, ['id' => $media->getKey()]),
            'expiresAt' => $expiresAt->toIso8601String(),
        ];
    }
}
