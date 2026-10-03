<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * شکل یکسان meta صفحه‌بندی در v1.
 *
 * چرا یک کلاس: `meta` بخشی از قرارداد است؛ اگر هر کنترلر خودش بسازد، نام کلیدها
 * واگرا می‌شود و کلاینت دو شکل می‌بیند. سقف `perPage` در config هر دامنه است.
 */
class Pagination
{
    /** @return array<string, int> */
    public static function meta(LengthAwarePaginator $paginator): array
    {
        return [
            'page' => (int) $paginator->currentPage(),
            'perPage' => (int) $paginator->perPage(),
            'total' => (int) $paginator->total(),
            'lastPage' => (int) $paginator->lastPage(),
        ];
    }
}
