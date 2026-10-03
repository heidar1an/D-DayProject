<?php

namespace App\Services\Content;

use App\Models\InternationalCourse;
use App\Models\User;
use App\Services\Commerce\EntitlementService;
use Illuminate\Database\Eloquent\Model;

/**
 * دروازهٔ واقعی دسترسی — فاز ۱۸. جای `NullEntitlementGate` را می‌گیرد.
 *
 * ⚠️ اما همچنان صادق است: `isEnforcing()` تا وقتی
 * `commerce.entitlements.enforce` روشن نشده `false` است و `allows()` همیشه
 * `true` برمی‌گرداند. دلیل: تا درگاه/قیمت واقعی وصل نشده، هیچ راه قانونی برای
 * گرفتن entitlement وجود ندارد؛ اگر از امروز همه‌چیز قفل شود، محصول برای همهٔ
 * کاربران فعلی بی‌دلیل می‌بندد. این رفتار **مستند** است، نه یک mock پنهان
 * (Prompt §11).
 *
 * دو تصمیم که این گیت را بی‌خطر می‌کند:
 *
 *   ۱. **فهرست بستهٔ قابلیت‌های دروازه‌بانی‌شده = `product_capabilities`.**
 *      قابلیتی که هیچ محصولی نمی‌فروشد (مثل `content.lesson_page` که
 *      `ProgressService` می‌پرسد) دروازه‌بانی نمی‌شود. پس روشن‌کردن enforcement،
 *      محتوای امروز را قفل نمی‌کند و فقط قابلیت‌های واقعاً فروشی را می‌بندد.
 *   ۲. **قابلیت از خود منبع می‌آید.** اگر منبع `required_capability` داشته باشد
 *      (دورهٔ بین‌الملل)، همان خواسته می‌شود — نه قابلیت عمومی که فراخوان
 *      پاس داده. پس Content لازم نیست بداند «کدام محصول این را می‌فروشد».
 */
final class CommerceEntitlementGate implements EntitlementGate
{
    public function __construct(private readonly EntitlementService $entitlements) {}

    public function allows(?User $user, string $capability, ?Model $resource = null): bool
    {
        if (! $this->isEnforcing()) {
            return true;
        }

        $capability = $this->capabilityFor($resource, $capability);

        /* قابلیت غیرفروشی ⇒ دروازه‌ای وجود ندارد. */
        if (! $this->entitlements->isGateable($capability)) {
            return true;
        }

        /* قابلیت فروشی ⇒ هویت لازم است. مهمان هرگز entitlement ندارد. */
        if ($user === null) {
            return false;
        }

        return $this->entitlements->has($user, $capability);
    }

    public function isEnforcing(): bool
    {
        return (bool) config('commerce.entitlements.enforce');
    }

    /** قابلیت موردنیاز این منبع، یا قابلیت پیش‌فرض فراخوان. */
    private function capabilityFor(?Model $resource, string $fallback): string
    {
        if ($resource instanceof InternationalCourse && $resource->isPremium()) {
            return (string) $resource->required_capability;
        }

        return $fallback;
    }
}
