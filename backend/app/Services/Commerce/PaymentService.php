<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiErrorException;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentWebhook;
use App\Models\User;
use App\Services\Commerce\Gateway\GatewayManager;
use App\Services\Commerce\Gateway\PaymentGateway;
use App\Support\RequestId;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * پرداخت — فاز ۱۸. مالک «وضعیت تراکنش درگاه».
 *
 * سه ضمانت:
 *
 *   ۱. **کلاینت هرگز پرداخت نمی‌سازد.** `start()` فقط سفارشِ **خودِ کاربر**
 *      را می‌پذیرد، مبلغ را از خود سفارش می‌خواند و authority را درگاه
 *      می‌دهد. هیچ مسیری `amount`/`status` از بدنه نمی‌خواند (§39).
 *   ۲. **موفقیت درگاه کافی نیست.** `finalize()` پنج چیز را با هم می‌سنجد:
 *      تأیید پرداخت، وضعیت سفارش، تطبیق مبلغ، تطبیق ارز و مالکیت. اگر یکی
 *      بلرزد ⇒ **هیچ entitlement‌ای صادر نمی‌شود** (§40/§70).
 *   ۳. **تکرار بی‌اثر است.** `payments.authority` یکتا،
 *      `payments.provider_reference` یکتا و `payment_webhooks(provider,event_id)`
 *      یکتا. verify دوباره، webhook دوباره و verify+webhook هم‌زمان همه به
 *      **یک** وضعیت پایانی می‌رسند (§71/§72).
 *
 * تراکنش طلایی (§49): علامت‌زدن پرداخت + paid شدن سفارش + اشتراک + entitlement
 * همه در **یک** `DB::transaction` با `lockForUpdate`. وضعیت نیمه‌کاره
 * «paid بدون entitlement» ممکن نیست.
 */
class PaymentService
{
    public function __construct(
        private readonly GatewayManager $gateways,
        private readonly OrderService $orders,
        private readonly SubscriptionService $subscriptions,
        private readonly EntitlementService $entitlements,
    ) {}

    /**
     * شروع پرداخت برای سفارش کاربر.
     *
     * اگر پرداخت بازِ همان سفارش وجود داشته باشد، همان برگردانده می‌شود: هر
     * بار زدن دکمه نباید authority تازه بسازد (وگرنه چند تراکنش باز در درگاه
     * می‌ماند و تطبیق callback سخت می‌شود).
     *
     * @return array{payment: Payment, redirect_url: string, replayed: bool}
     */
    public function start(User $user, Order $order): array
    {
        if (! (bool) config('commerce.checkout.enabled')) {
            throw ApiErrorException::notConfigured('Checkout');
        }

        $gateway = $this->gateways->default();

        if (! $gateway->isConfigured()) {
            throw ApiErrorException::notConfigured('Payment gateway ('.$gateway->name().')');
        }

        $existing = Payment::query()
            ->where('order_id', $order->getKey())
            ->where('user_id', $user->getKey())
            ->where('status', Payment::STATUS_PENDING)
            ->latest('created_at')
            ->first();

        if ($existing !== null && $order->isPayable()) {
            return [
                'payment' => $existing,
                'redirect_url' => $this->redirectUrl($gateway, (string) $existing->authority),
                'replayed' => true,
            ];
        }

        if (! $order->isPayable()) {
            throw new ApiErrorException('ORDER_NOT_PAYABLE', 409, 'This order can no longer be paid.');
        }

        $created = $gateway->create((int) $order->total_minor, (string) $order->currency, (string) $order->getKey());

        $payment = DB::transaction(function () use ($user, $order, $gateway, $created): Payment {
            $payment = new Payment;
            $payment->forceFill([
                'order_id' => $order->getKey(),
                'user_id' => $user->getKey(),
                'provider' => $gateway->name(),
                'authority' => $created['authority'],
                'provider_reference' => null,
                'status' => Payment::STATUS_PENDING,
                'amount_minor' => (int) $order->total_minor,
                'currency' => (string) $order->currency,
                'verified_at' => null,
            ])->save();

            $this->orders->transition($order->refresh(), Order::STATUS_AWAITING_PAYMENT);

            return $payment;
        });

        return ['payment' => $payment, 'redirect_url' => $created['redirect_url'], 'replayed' => false];
    }

    /** پرداخت کاربر — پرداخت دیگری ۴۰۴ می‌گیرد، نه ۴۰۳ (IDOR). */
    public function findOwned(User $user, string $paymentId): Payment
    {
        $payment = Payment::query()
            ->whereKey($paymentId)
            ->where('user_id', $user->getKey())
            ->first();

        if ($payment === null) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Payment not found.');
        }

        return $payment;
    }

    public function forUser(User $user, int $perPage): LengthAwarePaginator
    {
        return Payment::query()
            ->where('user_id', $user->getKey())
            ->orderByDesc('created_at')
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * تأیید پرداخت از سمت کاربر — idempotent.
     *
     * @param  string|null  $signature  شاهد درگاه (در Sandbox: امضای HMAC)
     */
    public function verify(User $user, Payment $payment, ?string $signature): Payment
    {
        /* تکرار تأیید ⇒ همان نتیجه، بدون entitlement دوم. */
        if ($payment->isVerified()) {
            return $payment;
        }

        $order = $payment->order;

        if ($order === null) {
            throw new ApiErrorException('PAYMENT_WITHOUT_ORDER', 409, 'This payment is not linked to an order.');
        }

        if ($order->isPaid()) {
            /* سفارش قبلاً پرداخت شده (webhook جلو زده) ⇒ فقط پرداخت را هم‌راستا کن. */
            $this->markVerified($payment, $payment->provider_reference);

            return $payment->refresh();
        }

        if (! $order->isPayable()) {
            throw new ApiErrorException('ORDER_NOT_PAYABLE', 409, 'This order can no longer be paid.');
        }

        $gateway = $this->gateways->driver((string) $payment->provider);
        $result = $gateway->verify((string) $payment->authority, (int) $order->total_minor, $signature);

        if (! $result['ok']) {
            $this->fail($payment, $order, (string) ($result['reason'] ?? 'VERIFY_FAILED'));

            throw new ApiErrorException(
                'PAYMENT_VERIFICATION_FAILED',
                422,
                'Payment could not be verified.',
            );
        }

        $this->finalize($payment, $order, $result['reference'], $result['amount_minor']);

        return $payment->refresh();
    }

    /**
     * پردازش Webhook درگاه.
     *
     * ⚠️ هیچ وابستگی‌ای به کوکی/سشن ندارد: اعتبارسنجی کاملاً رمزنگاری‌شده است
     * (امضای provider). پس CSRF مرورگری اینجا بی‌معناست و نباید اعمال شود.
     *
     * @param  array<string, mixed>  $payload
     * @return array{status: string, result: string}
     */
    public function handleWebhook(string $provider, array $payload, ?string $signature): array
    {
        if (! $this->gateways->knows($provider)) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Unknown payment provider.');
        }

        $gateway = $this->gateways->driver($provider);

        if (! $gateway->isConfigured()) {
            throw ApiErrorException::notConfigured('Payment gateway ('.$provider.')');
        }

        $eventId = (string) ($payload['event_id'] ?? '');

        if ($eventId === '') {
            /* بدون event_id امکان ثبت دفتر ضد تکرار نیست ⇒ صریح رد می‌شود. */
            throw ApiErrorException::invalid(['event_id' => ['REQUIRED']]);
        }

        if (! $gateway->verifyWebhook($payload, $signature)) {
            $this->record($provider, $eventId, $payload, PaymentWebhook::STATUS_REJECTED, 'SIGNATURE_INVALID');

            /* ۴۰۳: امضا معتبر نیست؛ هیچ اثری روی پرداخت/سفارش نمی‌گذارد. */
            throw ApiErrorException::forbidden('Invalid webhook signature.');
        }

        $record = $this->reserve($provider, $eventId, $payload);

        /*
         * `wasRecentlyCreated === false` یعنی همین (provider, event_id) قبلاً
         * دیده شده ⇒ replay واقعی. اثر دوباره اعمال نمی‌شود؛ ۲۰۰ با no-op
         * برمی‌گردد تا درگاه retry را «موفق» ببیند و پشت‌سرهم نفرستد (§42/§43).
         */
        if (! $record->wasRecentlyCreated) {
            if ($record->status === PaymentWebhook::STATUS_RECEIVED) {
                /* همان رخداد همین حالا در حال پردازش است (race) — نه دوباره اجرا کن. */
                throw new ApiErrorException('REQUEST_IN_PROGRESS', 409, 'The same webhook is still being processed.');
            }

            return ['status' => $record->status, 'result' => 'REPLAY_IGNORED'];
        }

        try {
            $result = $this->processWebhook($provider, $payload);
        } catch (ApiErrorException $e) {
            $this->mark($record, PaymentWebhook::STATUS_REJECTED, $e->errorCode);

            throw $e;
        }

        $this->mark($record, $result['status'], $result['result']);

        return $result;
    }

    /**
     * اعمال اثر یک webhook معتبر.
     *
     * @param  array<string, mixed>  $payload
     * @return array{status: string, result: string}
     */
    private function processWebhook(string $provider, array $payload): array
    {
        $authority = (string) ($payload['authority'] ?? '');
        $amount = (int) ($payload['amount_minor'] ?? -1);
        $state = (string) ($payload['status'] ?? '');

        $payment = Payment::query()->where('authority', $authority)->where('provider', $provider)->first();

        if ($payment === null) {
            /* authority ناشناس ⇒ رخداد بی‌ربط؛ رد می‌شود، نه ۵۰۰. */
            return ['status' => PaymentWebhook::STATUS_REJECTED, 'result' => 'UNKNOWN_AUTHORITY'];
        }

        $order = $payment->order;

        if ($order === null) {
            return ['status' => PaymentWebhook::STATUS_REJECTED, 'result' => 'PAYMENT_WITHOUT_ORDER'];
        }

        if ($state !== 'success') {
            if (! $payment->isVerified()) {
                $this->fail($payment, $order, strtoupper($state) ?: 'FAILED');
            }

            return ['status' => PaymentWebhook::STATUS_PROCESSED, 'result' => 'PAYMENT_FAILED'];
        }

        /* تطبیق مبلغ: درگاه ۱۰٬۰۰۰ و سفارش ۱٬۰۰۰ ⇒ رد، بدون entitlement (§70). */
        if ($amount !== (int) $order->total_minor || $amount !== (int) $payment->amount_minor) {
            return ['status' => PaymentWebhook::STATUS_REJECTED, 'result' => 'AMOUNT_MISMATCH'];
        }

        if ($payment->isVerified()) {
            /* همان تراکنش، دو مسیر (verify و webhook) ⇒ no-op، بدون entitlement دوم. */
            return ['status' => PaymentWebhook::STATUS_IGNORED, 'result' => 'ALREADY_VERIFIED'];
        }

        $this->finalize($payment, $order, $this->referenceFrom($payload), $amount);

        return ['status' => PaymentWebhook::STATUS_PROCESSED, 'result' => 'PAYMENT_VERIFIED'];
    }

    /**
     * تراکنش طلایی: تأیید پرداخت → paid سفارش → اشتراک → entitlement.
     *
     * تنها جایی که `paid` نوشته می‌شود و تنها جایی که entitlement صادر می‌شود.
     */
    private function finalize(Payment $payment, Order $order, ?string $reference, ?int $gatewayAmount): void
    {
        DB::transaction(function () use ($payment, $order, $reference, $gatewayAmount): void {
            /* قفل ردیف: verify و webhook هم‌زمان ⇒ یکی می‌برد، دیگری no-op. */
            $lockedPayment = Payment::query()->whereKey($payment->getKey())->lockForUpdate()->first();

            if ($lockedPayment === null || $lockedPayment->isVerified()) {
                return;
            }

            $lockedOrder = Order::query()->whereKey($order->getKey())->lockForUpdate()->first();

            if ($lockedOrder === null) {
                throw new ApiErrorException('PAYMENT_WITHOUT_ORDER', 409, 'This payment is not linked to an order.');
            }

            if (! $lockedOrder->isPaid() && ! $lockedOrder->isPayable()) {
                throw new ApiErrorException('ORDER_NOT_PAYABLE', 409, 'This order can no longer be paid.');
            }

            /* تطبیق مبلغ و ارز — پیش از هر اثر مالی. */
            if ((int) $lockedPayment->amount_minor !== (int) $lockedOrder->total_minor) {
                throw new ApiErrorException('AMOUNT_MISMATCH', 422, 'Payment amount does not match the order.');
            }

            if ($gatewayAmount !== null && $gatewayAmount !== (int) $lockedOrder->total_minor) {
                throw new ApiErrorException('AMOUNT_MISMATCH', 422, 'Gateway amount does not match the order.');
            }

            if ((string) $lockedPayment->currency !== (string) $lockedOrder->currency) {
                throw new ApiErrorException('CURRENCY_MISMATCH', 422, 'Payment currency does not match the order.');
            }

            $lockedPayment->forceFill([
                'status' => Payment::STATUS_VERIFIED,
                'verified_at' => now(),
                'provider_reference' => $reference ?? $lockedPayment->provider_reference,
            ])->save();

            if (! $lockedOrder->isPaid()) {
                $this->orders->transition($lockedOrder, Order::STATUS_PAID);
            }

            $subscription = $this->subscriptions->activateFromOrder($lockedOrder->refresh());
            $capabilities = $this->entitlements->grantFromOrder($lockedOrder->refresh(), $subscription);

            $this->log('payment.verified', [
                'provider' => $lockedPayment->provider,
                'order_id' => (string) $lockedOrder->getKey(),
                'payment_id' => (string) $lockedPayment->getKey(),
                'capabilities' => $capabilities,
            ]);
        });
    }

    private function markVerified(Payment $payment, ?string $reference): void
    {
        $payment->forceFill([
            'status' => Payment::STATUS_VERIFIED,
            'verified_at' => $payment->verified_at ?? now(),
            'provider_reference' => $reference ?? $payment->provider_reference,
        ])->save();
    }

    /** شکست پرداخت: پرداخت failed و سفارش failed — **بدون** entitlement. */
    private function fail(Payment $payment, Order $order, string $reason): void
    {
        DB::transaction(function () use ($payment, $order, $reason): void {
            $payment->forceFill(['status' => Payment::STATUS_FAILED])->save();

            if ($order->isPayable()) {
                $this->orders->transition($order, Order::STATUS_FAILED);
            }

            $this->log('payment.failed', [
                'provider' => $payment->provider,
                'order_id' => (string) $order->getKey(),
                'payment_id' => (string) $payment->getKey(),
                'reason' => $reason,
            ]);
        });
    }

    /**
     * رزرو رخداد در دفتر ضد تکرار.
     *
     * @param  array<string, mixed>  $payload
     * @return PaymentWebhook رکورد تازه، یا رکورد موجود در صورت replay
     */
    private function reserve(string $provider, string $eventId, array $payload): PaymentWebhook
    {
        $hash = hash('sha256', (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $record = new PaymentWebhook;
        $record->forceFill([
            'provider' => $provider,
            'event_id' => $eventId,
            'payload_hash' => $hash,
            'payment_id' => null,
            'order_id' => null,
            'status' => PaymentWebhook::STATUS_RECEIVED,
            'result' => null,
            'processed_at' => null,
        ]);

        try {
            /* savepoint: شکست INSERT نباید تراکنش بیرونی را روی PG abort کند. */
            DB::transaction(fn () => $record->save());

            return $record;
        } catch (UniqueConstraintViolationException) {
            $existing = PaymentWebhook::query()
                ->where('provider', $provider)
                ->where('event_id', $eventId)
                ->first();

            if ($existing === null) {
                throw new ApiErrorException('REQUEST_IN_PROGRESS', 409, 'The same webhook is still being processed.');
            }

            /* همان event_id با بدنهٔ متفاوت ⇒ یا قرارداد درگاه عوض شده یا دستکاری. */
            if (! hash_equals((string) $existing->payload_hash, $hash)) {
                throw new ApiErrorException('WEBHOOK_PAYLOAD_MISMATCH', 409, 'This event id was already used with a different payload.');
            }

            return $existing;
        }
    }

    private function record(string $provider, string $eventId, array $payload, string $status, string $result): void
    {
        try {
            $this->reserve($provider, $eventId, $payload);
            PaymentWebhook::query()
                ->where('provider', $provider)
                ->where('event_id', $eventId)
                ->update(['status' => $status, 'result' => $result, 'processed_at' => now(), 'updated_at' => now()]);
        } catch (\Throwable) {
            /* ثبت نتوانست انجام شود — ولی رد کردن webhook نامعتبر نباید بشکند. */
        }
    }

    private function mark(PaymentWebhook $record, string $status, string $result): void
    {
        $record->forceFill([
            'status' => $status,
            'result' => substr($result, 0, 48),
            'processed_at' => now(),
        ])->save();
    }

    /** @param array<string, mixed> $payload */
    private function referenceFrom(array $payload): ?string
    {
        $reference = $payload['reference'] ?? $payload['provider_reference'] ?? null;

        return is_string($reference) && $reference !== '' ? $reference : null;
    }

    private function redirectUrl(PaymentGateway $gateway, string $authority): string
    {
        return rtrim((string) config('commerce.gateway.sandbox.checkout_url'), '/').'/'.$authority;
    }

    /**
     * لاگ مالی — فقط شناسه‌ها و نتیجه.
     *
     * هرگز: Secret، توکن، کوکی، بدنهٔ خام، شمارهٔ کارت، مبلغ حساس در متن آزاد
     * (§65).
     *
     * @param  array<string, mixed>  $context
     */
    private function log(string $event, array $context): void
    {
        Log::info($event, ['request_id' => RequestId::current(), ...$context]);
    }
}
