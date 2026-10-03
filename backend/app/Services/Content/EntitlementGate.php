<?php

namespace App\Services\Content;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * قرارداد دسترسی پولی/اشتراکی — **فقط extension point، بدون پیاده‌سازی واقعی**.
 *
 * فاز ۱۸ (Payment/Entitlement) مالک این دامنه است. در فاز ۵/۶ هیچ پرداخت،
 * اشتراک یا طرح premium وجود ندارد و **Mock هم نمی‌شود**: بایند فعلی
 * `NullEntitlementGate` است که همیشه `true` برمی‌گرداند و صریحاً می‌گوید
 * «هیچ کنترل دسترسی‌ای انجام نشد».
 *
 * چرا این interface از حالا وجود دارد: `ContentVisibility` و Policyها همین
 * امروز از آن عبور می‌کنند، پس افزودن entitlement در آینده یک بایند است، نه
 * بازنویسی مسیرهای محتوا.
 */
interface EntitlementGate
{
    /**
     * آیا کاربر به این قابلیت روی این منبع دسترسی دارد؟
     *
     * @param  string  $capability  کلید قابلیت (مثلاً `content.premium`)
     */
    public function allows(?User $user, string $capability, ?Model $resource = null): bool;

    /** آیا این گیت واقعاً کنترل دسترسی انجام می‌دهد یا no-op است؟ */
    public function isEnforcing(): bool;
}
