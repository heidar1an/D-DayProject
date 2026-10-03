<?php

namespace App\Support;

use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;

/**
 * Request id is resolved once per request: honored from X-Request-Id when it
 * matches the safe format, otherwise generated (UUIDv4). It is stored in
 * Laravel Context so every JSON log line and every API envelope carries it.
 */
class RequestId
{
    public const HEADER = 'X-Request-Id';

    public static function resolve(?string $incoming): string
    {
        $requestId = ($incoming !== null && preg_match('/^[A-Za-z0-9._-]{8,64}$/', $incoming) === 1)
            ? $incoming
            : (string) Str::uuid();

        Context::add('request_id', $requestId);

        return $requestId;
    }

    /** Current request id; middleware is the only writer. */
    public static function current(): string
    {
        return (string) (Context::get('request_id') ?? (string) Str::uuid());
    }
}
