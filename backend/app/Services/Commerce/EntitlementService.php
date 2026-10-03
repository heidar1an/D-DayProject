<?php

namespace App\Services\Commerce;

use App\Models\Entitlement;
use App\Models\Order;
use App\Models\ProductCapability;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Entitlement — فاز ۱۸. **تنها** دروازهٔ اعطا و لغو دسترسی قابلیت.
 *
 * قاعدهٔ طلایی (Prompt §48/§49): entitlement فقط پس از **تأیید پرداخت** و داخل
 * همان تراکنش ساخته می‌شود. نه با ساخت سفارش، نه با ادعای کلاینت.
 *
 * دو تصمیم مهم:
 *
 *   ۱. **انتشار در انتها (expiry) بدون Cron.** `ends_at` هر entitlement از
 *      `subscription.ends_at` کپی می‌شود. پس با گذشت زمان،
 *      `Entitlement::scopeActive()` خودبه‌خود آن را نادیده می‌گیرد. هیچ Job
 *      زمان‌بندی‌شده‌ای برای «قفل کردن» لازم نیست و هیچ کلاینتی هم نمی‌تواند با
 *      دست‌کاری ساعت، دسترسی بگیرد (§75).
 *
 *   ۲. **تمدید = کشیدن `ends_at` به جلو، نه ردیف تازه.** خرید مجدد همان قابلیت،
 *      ردیف فعال موجود را تمدید می‌کند تا سابقهٔ دسترسی تکه‌تکه نشود؛ ولی
 *      `source_order_id` اولیه دست‌نخورده می‌ماند تا معلوم باشد دسترسی از کدام
 *      معامله شروع شده.
 */
class EntitlementService
{
    /** آیا کاربر همین حالا این قابلیت را دارد؟ تنها پرسش Content از Commerce. */
    public function has(User $user, string $capability): bool
    {
        return Entitlement::query()
            ->where('user_id', $user->getKey())
            ->where('capability', $capability)
            ->active()
            ->exists();
    }

    /**
     * آیا این قابلیت اصلاً دروازه‌بانی می‌شود؟
     *
     * فهرست بسته = `product_capabilities`. قابلیتی که هیچ محصولی آن را نمی‌فروشد
     * (مثل `content.lesson_page`) عملاً دروازه‌بانی نمی‌شود؛ پس فعال‌کردن
     * enforcement، محتوای امروز را قفل نمی‌کند.
     */
    public function isGateable(string $capability): bool
    {
        return ProductCapability::query()->where('code', $capability)->exists();
    }

    /** @return Collection<int, Entitlement> */
    public function forUser(User $user): Collection
    {
        return Entitlement::query()
            ->where('user_id', $user->getKey())
            ->orderBy('capability')
            ->get();
    }

    /** @return list<string> */
    public function activeCapabilities(User $user): array
    {
        return Entitlement::query()
            ->where('user_id', $user->getKey())
            ->active()
            ->orderBy('capability')
            ->pluck('capability')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * اعطای قابلیت‌های یک سفارش پرداخت‌شده — idempotent.
     *
     * @return list<string> قابلیت‌هایی که (تازه یا تمدیدشده) فعال شدند
     */
    public function grantFromOrder(Order $order, ?Subscription $subscription = null): array
    {
        $capabilities = $this->capabilitiesOf($order);
        $startsAt = Carbon::now();
        $endsAt = $subscription?->ends_at;

        $granted = [];

        foreach ($capabilities as $capability) {
            $existing = Entitlement::query()
                ->where('user_id', $order->user_id)
                ->where('capability', $capability)
                ->active()
                ->lockForUpdate()
                ->first();

            if ($existing !== null) {
                /*
                 * همان سفارش دوباره پردازش شده ⇒ هیچ کاری نکن (no-op).
                 * سفارش تازه ⇒ فقط اگر دورهٔ تازه دیرتر تمام می‌شود، تمدید کن.
                 */
                if ((string) $existing->source_order_id === (string) $order->getKey()) {
                    $granted[] = $capability;

                    continue;
                }

                if ($endsAt !== null && ($existing->ends_at === null || $existing->ends_at->lt($endsAt))) {
                    $existing->forceFill(['ends_at' => $endsAt])->save();
                }

                $granted[] = $capability;

                continue;
            }

            $entitlement = new Entitlement;
            $entitlement->forceFill([
                'user_id' => $order->user_id,
                'capability' => $capability,
                'source_order_id' => $order->getKey(),
                'source_subscription_id' => $subscription?->getKey(),
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'revoked_at' => null,
            ])->save();

            $granted[] = $capability;
        }

        return array_values(array_unique($granted));
    }

    /**
     * لغو سرور-محور.
     *
     * تنها راه لغو. هیچ endpoint ادمینی مستقیم این جدول را نمی‌نویسد (§60/§76).
     *
     * @return int تعداد ردیف‌های لغوشده
     */
    public function revoke(User $user, string $capability): int
    {
        return Entitlement::query()
            ->where('user_id', $user->getKey())
            ->where('capability', $capability)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => Carbon::now(), 'updated_at' => Carbon::now()]);
    }

    /**
     * لغو قابلیت‌هایی که از یک سفارش آمده‌اند (مسیر جبرانی).
     *
     * @return int تعداد ردیف‌های لغوشده
     */
    public function revokeFromOrder(Order $order): int
    {
        return Entitlement::query()
            ->where('source_order_id', $order->getKey())
            ->whereNull('revoked_at')
            ->update(['revoked_at' => Carbon::now(), 'updated_at' => Carbon::now()]);
    }

    /**
     * لغو قابلیت‌هایی که از یک **اشتراک** آمده‌اند.
     *
     * چرا لازم است: `ends_at` هر entitlement در لحظهٔ اعطا از اشتراک کپی می‌شود.
     * اگر اشتراک دستی لغو شود، آن کپی عقب‌تر می‌ماند و دسترسی بی‌دلیل باز
     * می‌ماند. این متد آن شکاف را می‌بندد (§75/§76).
     *
     * @return int تعداد ردیف‌های لغوشده
     */
    public function revokeFromSubscription(Subscription $subscription): int
    {
        return Entitlement::query()
            ->where('source_subscription_id', $subscription->getKey())
            ->whereNull('revoked_at')
            ->update(['revoked_at' => Carbon::now(), 'updated_at' => Carbon::now()]);
    }

    /**
     * قابلیت‌های یک سفارش = اجتماع قابلیت‌های محصولات سطرهای سفارش.
     *
     * چرا از `order_lines.product_id` و نه از snapshot: محصول مالک قابلیت است و
     * افزودن قابلیت تازه به محصول باید روی معاملهٔ آینده اثر بگذارد (برخلاف
     * قیمت که باید تاریخی بماند).
     *
     * @return list<string>
     */
    private function capabilitiesOf(Order $order): array
    {
        $productIds = $order->lines()
            ->whereNotNull('product_id')
            ->pluck('product_id')
            ->unique()
            ->values()
            ->all();

        if ($productIds === []) {
            return [];
        }

        return ProductCapability::query()
            ->whereIn('product_id', $productIds)
            ->orderBy('code')
            ->pluck('code')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * همگام‌سازی وضعیت اشتراک‌ها — **اختیاری و idempotent**.
     *
     * فقط وضعیت صریح `active → expired` را می‌نویسد؛ دسترسی از قبل با `ends_at`
     * بسته شده است. این متد برای گزارش‌های `/me/subscriptions` است تا وضعیت
     * نمایشی با واقعیت یکی باشد، نه برای امنیت.
     *
     * @return int تعداد اشتراک‌های منقضی‌شده
     */
    public function expireLapsedSubscriptions(User $user): int
    {
        return DB::table('subscriptions')
            ->where('user_id', $user->getKey())
            ->where('status', Subscription::STATUS_ACTIVE)
            ->whereNotNull('ends_at')
            ->where('ends_at', '<=', Carbon::now())
            ->update(['status' => Subscription::STATUS_EXPIRED, 'updated_at' => Carbon::now()]);
    }
}
