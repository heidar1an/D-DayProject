<?php

namespace App\Services\Identity;

use Illuminate\Http\Request;

/**
 * اثر انگشت کلاینت برای کلید rate limit.
 *
 * قاعدهٔ پروژه: IP هرگز log یا ذخیره نمی‌شود. برای rate limit به یک کلید پایدار
 * نیاز داریم، پس IP را با کلید اپ HMAC می‌کنیم: قابل محاسبه برای همان IP،
 * غیرقابل بازگشت به IP. هیچ‌جای دیگری این مقدار نگه‌داری نمی‌شود.
 */
class ClientFingerprint
{
    public function ipHash(Request $request): string
    {
        return hash_hmac('sha256', 'ip:'.$this->clientIp($request), (string) config('app.key'));
    }

    /**
     * IP مؤثر کلاینت. `X-Forwarded-For` فقط وقتی معتبر است که اپ پشت proxy
     * قابل‌اعتماد اجرا شود؛ Laravel همان سیاست TrustProxies را اعمال می‌کند.
     */
    public function clientIp(Request $request): string
    {
        return (string) ($request->ip() ?? 'unknown');
    }
}
