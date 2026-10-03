<?php

namespace App\Services\Commerce;

use App\Models\Order;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * اشتراک — فاز ۱۸. مالک «دسترسی دوره‌ای».
 *
 * فقط از مسیر «پرداخت تأییدشده» فعال می‌شود. `status = active` هرگز از ورودی
 * کلاینت ست نمی‌شود (Prompt §46).
 *
 * تمدید: خرید مجدد همان طرح، اشتراک فعال موجود را **کشیده** می‌کند (ends_at از
 * انتهای دورهٔ فعلی جلو می‌رود، نه از امروز). اگر این کار را نمی‌کردیم، خرید
 * زودهنگام روزهای باقی‌مانده را می‌سوزاند.
 *
 * ⚠️ سقف صندلی (`seats`) اینجا توزیع نمی‌شود: تخصیص دسترسی به اعضای گروه یک
 * Use Case جدا با مالکیت دامنهٔ Group است و در این فاز ساخته نشد (§61).
 * اشتراک صندلی‌دار برای **خریدار** فعال می‌شود و تعداد صندلی فقط در snapshot
 * سفارش ثبت است.
 */
class SubscriptionService
{
    public function __construct(private readonly EntitlementService $entitlements) {}

    /** فعال‌سازی/تمدید پس از پرداخت — داخل تراکنش فراخوان. */
    public function activateFromOrder(Order $order): ?Subscription
    {
        $plan = $this->planOf($order);

        if ($plan === null) {
            return null;
        }

        $existing = Subscription::query()
            ->where('user_id', $order->user_id)
            ->where('plan_id', $plan->getKey())
            ->where('status', Subscription::STATUS_ACTIVE)
            ->lockForUpdate()
            ->first();

        $now = Carbon::now();
        $months = max(1, (int) $plan->cycle_months);

        if ($existing !== null) {
            /* تمدید از انتهای دورهٔ فعلی اگر هنوز باز است، وگرنه از امروز. */
            $base = $existing->ends_at !== null && $existing->ends_at->isFuture()
                ? $existing->ends_at
                : $now;

            $existing->forceFill([
                'ends_at' => $base->copy()->addMonths($months),
                'status' => Subscription::STATUS_ACTIVE,
            ])->save();

            return $existing;
        }

        $subscription = new Subscription;
        $subscription->forceFill([
            'user_id' => $order->user_id,
            'plan_id' => $plan->getKey(),
            'source_order_id' => $order->getKey(),
            'status' => Subscription::STATUS_ACTIVE,
            'starts_at' => $now,
            'ends_at' => $now->copy()->addMonths($months),
        ])->save();

        return $subscription;
    }

    /** @return Collection<int, Subscription> */
    public function forUser(User $user): Collection
    {
        return Subscription::query()
            ->where('user_id', $user->getKey())
            ->with('plan.product')
            ->orderByDesc('starts_at')
            ->get();
    }

    public function effective(User $user): ?Subscription
    {
        return Subscription::query()
            ->where('user_id', $user->getKey())
            ->effective()
            ->orderByDesc('ends_at')
            ->first();
    }

    /**
     * لغو سرور-محور — هیچ مسیر کلاینتی به این متد وصل نیست.
     *
     * `ends_at` به «الآن» کشیده می‌شود و entitlementهای برخاسته از این اشتراک
     * هم لغو می‌شوند؛ وگرنه `ends_at` کپی‌شده در entitlement عقب‌تر می‌ماند و
     * دسترسی پس از لغو باز می‌ماند.
     */
    public function revoke(Subscription $subscription): Subscription
    {
        $subscription->forceFill([
            'status' => Subscription::STATUS_REVOKED,
            'ends_at' => Carbon::now(),
        ])->save();

        $this->entitlements->revokeFromSubscription($subscription);

        return $subscription;
    }

    private function planOf(Order $order): ?Plan
    {
        $planId = $order->lines()->whereNotNull('plan_id')->value('plan_id');

        return $planId === null ? null : Plan::query()->find($planId);
    }
}
