<?php

namespace App\Services\Content;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * پیاده‌سازی موقت و **صادق**: هیچ کنترل دسترسی‌ای انجام نمی‌دهد.
 *
 * `isEnforcing() === false` یعنی هر کدی که روی این گیت حساب باز می‌کند می‌داند
 * امروز مرزی وجود ندارد.
 *
 * ⚠️ **از فاز ۱۸ این کلاس بایند نیست.** بایند واقعی
 * `CommerceEntitlementGate` است (ثبت در `CommerceServiceProvider`) که با
 * `commerce.entitlements.enforce = false` دقیقاً همین رفتار no-op را دارد.
 *
 * چرا کلاس باقی مانده: قرارداد `EntitlementGate` و تست‌های قدیمی به یک
 * پیاده‌سازی «بی‌مرز» نیاز دارند تا بتوانند صریحاً no-op را بایند کنند؛ حذفش
 * یعنی هر تست مجبور شود config را دستکاری کند. این کلاس «کد مرده» نیست،
 * پیاده‌سازی صریح «هیچ مرزی نیست» است.
 */
final class NullEntitlementGate implements EntitlementGate
{
    public function allows(?User $user, string $capability, ?Model $resource = null): bool
    {
        return true;
    }

    public function isEnforcing(): bool
    {
        return false;
    }
}
