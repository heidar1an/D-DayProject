<?php

namespace App\Services\Identity\Google;

use App\Exceptions\ApiErrorException;

/**
 * مرزِ provider گوگل (BluePrint §18).
 *
 * در این فاز هیچ credential واقعی و هیچ provider فعالی وجود ندارد، پس هیچ ورود
 * ساختگی/مُکِ production ساخته نمی‌شود: تنها همین interface تعریف می‌شود و
 * پیاده‌سازی پیش‌فرض صریحاً می‌گوید «پیکربندی نشده‌ام».
 *
 * فاز بعدی فقط باید یک پیاده‌سازی واقعی بسازد و در provider بایند کند — بدون
 * تغییر در قرارداد یا کنترلرها.
 */
interface GoogleIdentityProvider
{
    /** آیا credential واقعی موجود است؟ (پیش‌فرض این فاز: false) */
    public function isConfigured(): bool;

    /** URL شروع جریان، یا `null` اگر پیکربندی نشده باشد. */
    public function authorizationUrl(string $state): ?string;

    /**
     * تبادل کد با توکن و خواندن هویت.
     *
     * @return array{sub: string, email: string|null, email_verified: bool, given_name: string|null, family_name: string|null}
     *
     * @throws ApiErrorException وقتی provider پیکربندی نشده است
     */
    public function exchange(string $code): array;
}
