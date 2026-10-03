<?php

namespace App\Services\Identity\Google;

use App\Exceptions\ApiErrorException;

/**
 * پیاده‌سازی پیش‌فرض فاز ۲: هیچ provider واقعی وجود ندارد.
 *
 * این کلاس عمداً هیچ «کاربر گوگل ساختگی» نمی‌سازد و هیچ secret فرضی ندارد.
 * هر مسیری که به تبادل واقعی نیاز داشته باشد با 503 صریح شکست می‌خورد تا
 * نبودِ قابلیت با یک ورود جعلی اشتباه گرفته نشود.
 */
class UnconfiguredGoogleProvider implements GoogleIdentityProvider
{
    public function isConfigured(): bool
    {
        return false;
    }

    public function authorizationUrl(string $state): ?string
    {
        return null;
    }

    public function exchange(string $code): array
    {
        throw ApiErrorException::notConfigured('Google authentication');
    }
}
