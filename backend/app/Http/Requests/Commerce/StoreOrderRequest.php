<?php

namespace App\Http\Requests\Commerce;

/**
 * ساخت سفارش — فاز ۱۸.
 *
 * همان قرارداد Quote، چون سفارش فقط «قصد تأییدشده» است: محصول، چرخه، صندلی.
 * هیچ مبلغی پذیرفته نمی‌شود (§22).
 *
 * Idempotency از هدر `Idempotency-Key` می‌آید، نه بدنه — چون بخشی از قرارداد
 * انتقال است، نه دادهٔ دامنه (`ReadsIdempotencyKey`).
 */
class StoreOrderRequest extends QuoteRequest {}
