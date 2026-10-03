<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiErrorException;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\Plan;
use App\Models\User;
use App\Services\Support\IdempotencyService;
use App\Support\Idempotency\IdempotencyOutcome;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * سفارش — فاز ۱۸. مالک «قصد خرید و تاریخچهٔ معامله».
 *
 * سه چیز که این سرویس تضمین می‌کند:
 *
 *   ۱. **مبلغ فقط سمت سرور.** امضای `create` هیچ پارامتر مبلغی ندارد؛ ورودی
 *      فقط (sku، چرخه، صندلی) است. `PricingService::quote()` تنها منبع عدد است.
 *   ۲. **Idempotency واقعی.** کلید در `idempotency_keys` با
 *      `UNIQUE(scope,actor_key,request_key)` ثبت می‌شود: دو درخواست یکسان با
 *      همان کلید ⇒ یک سفارش. همان کلید با payload متفاوت ⇒ ۴۰۹ (Prompt §34).
 *      بررسی «قبلاً دیدم؟» در کد race-safe نیست، پس منبع حقیقت دیتابیس است.
 *   ۳. **گذراهای صریح.** هر تغییر وضعیت از `transition()` عبور می‌کند؛
 *      `failed → paid` وجود ندارد (§35).
 */
class OrderService
{
    public const SCOPE_CREATE = 'orders.create';

    /**
     * نقشهٔ گذار مجاز. هر گذار بیرون این نقشه رد می‌شود (fail-closed).
     *
     * @var array<string, list<string>>
     */
    private const TRANSITIONS = [
        Order::STATUS_PENDING => [
            Order::STATUS_AWAITING_PAYMENT,
            /*
             * `pending → paid` لازم است چون webhook درگاه می‌تواند **پیش از**
             * تأیید مرورگر برسد (race قانونی، §72). این گذار فقط از
             * `PaymentService::finalize()` ممکن است — هیچ مسیر عمومی‌ای به آن
             * وصل نیست.
             */
            Order::STATUS_PAID,
            Order::STATUS_EXPIRED,
            Order::STATUS_CANCELLED,
        ],
        Order::STATUS_AWAITING_PAYMENT => [
            Order::STATUS_PAID,
            Order::STATUS_FAILED,
            Order::STATUS_EXPIRED,
            Order::STATUS_CANCELLED,
        ],
        Order::STATUS_FAILED => [],
        Order::STATUS_PAID => [],
        Order::STATUS_EXPIRED => [],
        Order::STATUS_CANCELLED => [],
    ];

    public function __construct(
        private readonly PricingService $pricing,
        private readonly IdempotencyService $idempotency,
    ) {}

    /**
     * ساخت سفارش — idempotent.
     *
     * @return array{order: Order, replayed: bool}
     */
    public function create(
        User $user,
        string $productSku,
        string $cycleId,
        int $seats,
        ?string $requestKey,
    ): IdempotencyOutcome {
        $plan = $this->pricing->resolvePlan($productSku, $cycleId);
        $this->pricing->assertPurchasable($plan);

        /* مبلغ قبل از ورود به ledger محاسبه می‌شود تا payload بی‌اعتبار ثبت نشود. */
        $quote = $this->pricing->quote($plan, $cycleId, $seats);

        $outcome = $this->idempotency->once(
            self::SCOPE_CREATE,
            'user:'.$user->getKey(),
            $requestKey,
            ['product' => $productSku, 'cycle' => $cycleId, 'seats' => $quote['seats']],
            function () use ($user, $plan, $quote): IdempotencyOutcome {
                $order = $this->persist($user, $plan, $quote);

                return new IdempotencyOutcome(false, 201, ['order' => (new OrderResource($order))->resolve()]);
            },
        );

        return $outcome;
    }

    /**
     * ساخت ردیف‌های سفارش در یک تراکنش.
     *
     * @param  array<string, mixed>  $quote
     */
    private function persist(User $user, Plan $plan, array $quote): Order
    {
        $openLimit = (int) config('commerce.orders.max_open_per_user');
        $ttl = (int) config('commerce.orders.ttl_minutes');

        return DB::transaction(function () use ($user, $plan, $quote, $openLimit, $ttl): Order {
            /*
             * `approved`/`purchasable` وضعیت **لحظه‌ای** است، نه بخشی از محاسبه.
             * اگر در snapshot می‌نشستند، سند تاریخی به config امروز گره می‌خورد.
             */
            $snapshot = Arr::except($quote, ['approved', 'purchasable']);

            /*
             * قفل ردیف کاربر = نقطهٔ سریال‌سازی سقف سفارش باز.
             *
             * چرا نه `lockForUpdate()->count()`: در PostgreSQL هر `FOR UPDATE` روی
             * یک تابع تجمعی با `0A000: FOR UPDATE is not allowed with aggregate
             * functions` رد می‌شود (SQLite بی‌صدا قبول می‌کند ⇒ تست سبز کاذب).
             * و بدتر از آن: `FOR UPDATE` روی مجموعهٔ **خالی** هیچ قفلی نمی‌گیرد،
             * پس سقف زیر هم‌زمانی واقعاً بسته نمی‌شد. قفل ردیف کاربر هر دو مشکل
             * را با هم حل می‌کند و شمارش، کوئری ساده و ارزان می‌ماند.
             */
            User::query()->whereKey($user->getKey())->lockForUpdate()->first();

            $open = Order::query()
                ->where('user_id', $user->getKey())
                ->whereIn('status', [Order::STATUS_PENDING, Order::STATUS_AWAITING_PAYMENT])
                ->where('expires_at', '>', Carbon::now())
                ->count();

            if ($open >= $openLimit) {
                throw new ApiErrorException(
                    'TOO_MANY_OPEN_ORDERS',
                    409,
                    'Too many open orders. Finish or cancel the existing ones first.',
                );
            }

            $order = new Order;
            $order->forceFill([
                'user_id' => $user->getKey(),
                'status' => Order::STATUS_PENDING,
                'total_minor' => (int) $quote['total_minor'],
                'currency' => (string) $quote['currency'],
                'quote_snapshot' => $snapshot,
                'expires_at' => Carbon::now()->addMinutes($ttl),
                'paid_at' => null,
            ])->save();

            $line = $order->lines()->make();
            $line->forceFill([
                'order_id' => $order->getKey(),
                'product_id' => $plan->product_id,
                'plan_id' => $plan->getKey(),
                'unit_minor' => (int) $quote['per_month_minor'],
                'quantity' => (int) $quote['seats'],
                'line_total_minor' => (int) $quote['total_minor'],
                'snapshot' => [
                    'product' => $quote['product'],
                    'product_name' => $quote['product_name'],
                    'plan' => $quote['plan'],
                    'cycle' => $quote['cycle'],
                    'months' => $quote['months'],
                    'seats' => $quote['seats'],
                    'discount_percent' => $quote['discount_percent'],
                    'list_per_month_minor' => $quote['list_per_month_minor'],
                    'per_month_minor' => $quote['per_month_minor'],
                    'currency' => $quote['currency'],
                ],
            ])->save();

            return $order->refresh();
        });
    }

    /** سفارش کاربر — سفارش دیگری **۴۰۴** می‌گیرد، نه ۴۰۳ (§58). */
    public function findOwned(User $user, string $orderId): Order
    {
        $order = Order::query()
            ->whereKey($orderId)
            ->where('user_id', $user->getKey())
            ->with('lines')
            ->first();

        if ($order === null) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Order not found.');
        }

        return $order;
    }

    public function forUser(User $user, int $perPage): LengthAwarePaginator
    {
        return Order::query()
            ->where('user_id', $user->getKey())
            ->orderByDesc('created_at')
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * لغو توسط خود کاربر — فقط روی سفارش بازِ خودش.
     *
     * چرا اجازه داده می‌شود: پنجرهٔ پرداخت محدود است و بدون لغو، کاربر تا
     * انقضا نمی‌تواند سفارش تازه بسازد. سفارش پرداخت‌شده هرگز لغو نمی‌شود.
     */
    public function cancel(User $user, Order $order): Order
    {
        if (! $order->isPayable()) {
            throw new ApiErrorException('ORDER_NOT_CANCELLABLE', 409, 'This order can no longer be cancelled.');
        }

        return $this->transition($order, Order::STATUS_CANCELLED);
    }

    /**
     * تنها راه تغییر وضعیت سفارش.
     *
     * گذار غیرمجاز ⇒ ۴۰۹. پس «کلاینت بگوید paid» هیچ اثری ندارد: مسیر عمومی
     * به این متد با وضعیت `paid` وجود ندارد و `paid` فقط از
     * `PaymentService::finalize()` می‌آید.
     */
    public function transition(Order $order, string $status): Order
    {
        $allowed = self::TRANSITIONS[$order->status] ?? [];

        if (! in_array($status, $allowed, true)) {
            throw new ApiErrorException(
                'INVALID_ORDER_TRANSITION',
                409,
                "Cannot move order from {$order->status} to {$status}.",
            );
        }

        $order->forceFill([
            'status' => $status,
            'paid_at' => $status === Order::STATUS_PAID ? Carbon::now() : $order->paid_at,
        ])->save();

        return $order;
    }
}
