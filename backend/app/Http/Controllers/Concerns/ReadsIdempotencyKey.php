<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;

/**
 * خواندن کلید idempotency از هدر.
 *
 * چرا هدر و نه بدنه: کلید بخشی از **قرارداد انتقال** است، نه دادهٔ دامنه. اگر در
 * بدنه بود، به `validated()` راه می‌یافت و هر تغییر در فهرست فیلدها آن را جابه‌جا
 * می‌کرد. نام هدر در `config('api.idempotency.header')` است.
 *
 * کلید هرگز در URL نمی‌آید: URL در لاگ سرور و تاریخچهٔ مرورگر می‌ماند.
 */
trait ReadsIdempotencyKey
{
    protected function idempotencyKey(Request $request): ?string
    {
        $header = (string) config('api.idempotency.header');
        $value = $request->headers->get($header);

        return is_string($value) && $value !== '' ? $value : null;
    }
}
