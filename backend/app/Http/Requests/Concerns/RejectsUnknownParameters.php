<?php

namespace App\Http\Requests\Concerns;

use App\Exceptions\ApiErrorException;

/**
 * رد پارامترهای ناشناخته در query.
 *
 * چرا لازم است: allowlist بدون ردِ ناشناخته یعنی کلاینت می‌تواند
 * `?status=draft` یا `?includeAnswerKey=true` بفرستد و امیدوار باشد روزی کسی
 * آن را «پیاده» کند. اینجا صریح ۴۰۰ می‌گیرد تا قرارداد بسته بماند.
 *
 * فقط روی query اعمال می‌شود؛ بدنهٔ نوشتاری با `$fillable` و `validated()`
 * محافظت می‌شود.
 */
trait RejectsUnknownParameters
{
    /** @param list<string> $allowed */
    protected function rejectUnknownQuery(array $allowed): void
    {
        $unknown = array_values(array_diff(array_keys($this->query()), $allowed));

        if ($unknown === []) {
            return;
        }

        sort($unknown);

        throw new ApiErrorException(
            'UNKNOWN_QUERY_PARAMETER',
            400,
            'Unknown query parameter(s): '.implode(', ', $unknown).'.',
            ['query' => $unknown],
        );
    }
}
