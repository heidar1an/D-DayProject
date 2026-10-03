<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Commerce\PaymentWebhookRequest;
use App\Http\Requests\Commerce\VerifyPaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Services\Commerce\OrderService;
use App\Services\Commerce\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * پرداخت — فاز ۱۸.
 *
 *   POST /api/v1/orders/{orderId}/payments   → ساخت تراکنش در درگاه + آدرس هدایت
 *   POST /api/v1/payments/{id}/verify        → تأیید (کاربر)
 *   POST /api/v1/payments/webhook/{provider} → رخداد درگاه (بدون سشن)
 *
 * ⚠️ تفاوت امنیتی مسیر webhook با دو مسیر دیگر عمدی و مستند است:
 *   • دو مسیر اول: سشن دانشجو + same-origin + CSRF (اقدام کاربر در مرورگر).
 *   • webhook: **هیچ‌کدام**. اعتبارسنجی آن کاملاً رمزنگاری‌شده است (امضای
 *     provider). CSRF مرورگری اینجا بی‌معناست چون درخواست از مرورگر نمی‌آید و
 *     کوکی هم ندارد (§41/§64).
 *
 * مالکیت پرداخت/سفارش فقط از سشن می‌آید؛ `userId` در هیچ ورودی‌ای وجود ندارد.
 */
class PaymentController extends Controller
{
    public function __construct(
        private readonly PaymentService $payments,
        private readonly OrderService $orders,
    ) {}

    /** ساخت تراکنش برای سفارش کاربر. */
    public function store(Request $request, string $orderId): JsonResponse
    {
        $user = $request->user();
        $order = $this->orders->findOwned($user, $orderId);

        $result = $this->payments->start($user, $order);

        return ApiResponse::success(
            [
                'payment' => (new PaymentResource($result['payment']))->resolve(),
                'redirect_url' => $result['redirect_url'],
                'replayed' => $result['replayed'],
            ],
            null,
            $result['replayed'] ? 200 : 201,
        );
    }

    /** تأیید پرداخت توسط کاربر — idempotent. */
    public function verify(VerifyPaymentRequest $request, string $id): JsonResponse
    {
        $user = $request->user();
        $payment = $this->payments->findOwned($user, $id);

        $verified = $this->payments->verify($user, $payment, $request->validated()['signature'] ?? null);

        return ApiResponse::success(['payment' => (new PaymentResource($verified))->resolve()]);
    }

    /**
     * رخداد درگاه.
     *
     * پاسخ‌ها بر اساس §43:
     *   • امضای نامعتبر ⇒ ۴۰۳ (و رخداد `rejected` ثبت می‌شود، بدون اثر مالی)
     *   • رخداد معتبرِ تکراری ⇒ ۲۰۰ با no-op (`ignored`) تا retry درگاه بند بیاید
     *   • رخداد معتبر تازه ⇒ ۲۰۰ با نتیجهٔ پردازش
     */
    public function webhook(PaymentWebhookRequest $request, string $provider): JsonResponse
    {
        $result = $this->payments->handleWebhook(
            $provider,
            $request->validated(),
            $request->header('X-Payment-Signature'),
        );

        return ApiResponse::success([
            'received' => true,
            'status' => $result['status'],
            'result' => $result['result'],
        ]);
    }
}
