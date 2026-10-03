<?php

namespace App\Http;

use App\Support\RequestId;
use Illuminate\Http\JsonResponse;

/**
 * استاندارد envelope فاز ۱ مطابق Blueprint (جزئیات: docs/api.md):
 *   موفق: {"data": ..., "meta": {...}?, "requestId": "..."}
 *   خطا:  {"error": {"code", "message", "fields"}, "requestId": "..."}
 * «requestId» همان مقداری است که میان‌افزار EnsureRequestId تولید/پذیرفته است.
 */
class ApiResponse
{
    public static function success(mixed $data, ?array $meta = null, int $status = 200, array $headers = []): JsonResponse
    {
        $body = ['data' => $data];

        if ($meta !== null) {
            $body['meta'] = $meta;
        }

        $body['requestId'] = RequestId::current();

        return response()->json($body, $status, self::withRequestId($headers));
    }

    public static function error(string $code, string $message, int $status, array $fields = [], array $headers = []): JsonResponse
    {
        return response()->json([
            'error' => [
                'code' => $code,
                'message' => $message,
                'fields' => (object) $fields,
            ],
            'requestId' => RequestId::current(),
        ], $status, self::withRequestId($headers));
    }

    /**
     * هدر requestId روی هر پاسخ envelope تضمین می‌شود — حتی پاسخ‌های خطا که
     * از مسیر exception handler می‌آیند و میان‌افزار را در مسیر بازگشت
     * ندیده‌اند.
     */
    private static function withRequestId(array $headers): array
    {
        $headers[RequestId::HEADER] = RequestId::current();

        return $headers;
    }
}
