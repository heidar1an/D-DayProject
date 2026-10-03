<?php

namespace App\Services\Support;

use App\Exceptions\ApiErrorException;
use App\Models\IdempotencyKey;
use App\Support\Idempotency\IdempotencyOutcome;
use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * اجرای یک‌بارهٔ mutation با کلید idempotency.
 *
 * الگو: «همان بازیگر + همان scope + همان کلید + همان payload ⇒ همان پاسخ».
 *
 * چرا در دیتابیس و نه Redis: `UNIQUE(scope, actor_key, request_key)` تنها
 * تضمینِ race-safe است. بررسی «قبلاً دیدم؟» در کد، دو درخواست هم‌زمان را رد
 * نمی‌کند. کش به‌عنوان لایهٔ سرعت می‌تواند بعداً اضافه شود، ولی منبع حقیقت اینجا است.
 *
 * سه حالت:
 *   1. کلید تازه            → عملیات اجرا و پاسخ ذخیره می‌شود.
 *   2. همان کلید و همان payload → پاسخ ذخیره‌شده بازپخش می‌شود (بدون اجرای دوباره).
 *   3. همان کلید و payload متفاوت → ۴۰۹. بازنویسی بی‌صدا هرگز.
 */
class IdempotencyService
{
    /**
     * @param  array<string, mixed>  $requestPayload
     * @param  Closure():IdempotencyOutcome  $callback
     */
    public function once(
        string $scope,
        string $actorKey,
        ?string $requestKey,
        array $requestPayload,
        Closure $callback,
    ): IdempotencyOutcome {
        $requestKey = $requestKey === null ? null : trim($requestKey);

        // بدون کلید، عملیات ساده اجرا می‌شود. محافظت در آن حالت با optimistic
        // lock (فاز ۵) یا `attemptKey` (فاز ۶) انجام می‌شود.
        if ($requestKey === null || $requestKey === '') {
            return $callback();
        }

        if (strlen($requestKey) > 96) {
            throw new ApiErrorException('IDEMPOTENCY_KEY_INVALID', 422, 'Idempotency key is too long.');
        }

        $hash = $this->hash($requestPayload);
        $record = $this->reserve($scope, $actorKey, $requestKey, $hash);

        if ($record instanceof IdempotencyOutcome) {
            return $record;
        }

        try {
            $outcome = $callback();
        } catch (Throwable $e) {
            // شکست ⇒ کلید آزاد می‌شود تا retry واقعی بتواند کار کند.
            $this->release($record);

            throw $e;
        }

        $record->forceFill([
            'state' => IdempotencyKey::STATE_COMPLETED,
            'response_status' => $outcome->status,
            'response_body' => ['data' => $outcome->data, 'meta' => $outcome->meta],
        ])->save();

        return $outcome;
    }

    /**
     * @return IdempotencyKey|IdempotencyOutcome رکورد تازه، یا پاسخ بازپخش‌شده
     */
    private function reserve(string $scope, string $actorKey, string $requestKey, string $hash): IdempotencyKey|IdempotencyOutcome
    {
        $record = new IdempotencyKey;
        $record->forceFill([
            'scope' => $scope,
            'actor_key' => $actorKey,
            'request_key' => $requestKey,
            'request_hash' => $hash,
            'state' => IdempotencyKey::STATE_RESERVED,
            'expires_at' => now()->addMinutes((int) config('api.idempotency.ttl_minutes')),
        ]);

        try {
            /*
             * ⚠️ داخل `DB::transaction` بسته می‌شود تا در PostgreSQL شکستِ INSERT
             * به **savepoint** برگردد، نه به کل تراکنش.
             *
             * چرا حیاتی است: روی PG هر خطای یک دستور، تراکنش جاری را abort می‌کند و
             * هر کوئری بعدی `SQLSTATE[25P02] current transaction is aborted` می‌دهد.
             * بدون savepoint، `replayOrConflict()` — که بلافاصله SELECT می‌زند —
             * روی PG می‌شکند (و روی SQLite دیده نمی‌شود). وقتی تراکنش بیرونی
             * وجود نداشته باشد، این فراخوانی یک تراکنش تازهٔ معمولی است.
             */
            DB::transaction(fn () => $record->save());

            return $record;
        } catch (UniqueConstraintViolationException) {
            return $this->replayOrConflict($scope, $actorKey, $requestKey, $hash);
        }
    }

    private function replayOrConflict(string $scope, string $actorKey, string $requestKey, string $hash): IdempotencyOutcome
    {
        $existing = IdempotencyKey::query()
            ->where('scope', $scope)
            ->where('actor_key', $actorKey)
            ->where('request_key', $requestKey)
            ->first();

        if ($existing === null) {
            // رکورد بین insert و select پاک شده (انقضا). تلاش دوباره امن است.
            throw new ApiErrorException('REQUEST_IN_PROGRESS', 409, 'The same request is still being processed.');
        }

        if (! hash_equals((string) $existing->request_hash, $hash)) {
            throw new ApiErrorException(
                'IDEMPOTENCY_KEY_REUSED',
                409,
                'This idempotency key was already used with a different payload.',
            );
        }

        if ($existing->state !== IdempotencyKey::STATE_COMPLETED) {
            throw new ApiErrorException('REQUEST_IN_PROGRESS', 409, 'The same request is still being processed.');
        }

        $body = is_array($existing->response_body) ? $existing->response_body : [];

        return new IdempotencyOutcome(
            true,
            (int) ($existing->response_status ?? 200),
            is_array($body['data'] ?? null) ? $body['data'] : [],
            is_array($body['meta'] ?? null) ? $body['meta'] : null,
        );
    }

    private function release(IdempotencyKey $record): void
    {
        try {
            $record->delete();
        } catch (Throwable) {
            // پاک‌نشدن رکوردِ رزروشده فقط یعنی همان کلید تا انقضا ۴۰۹ می‌دهد؛
            // خودِ عملیات دامنه است که نباید بی‌صدا ادامه پیدا کند.
        }
    }

    /**
     * هش پایدار payload — ترتیب کلیدها بی‌اثر است تا همان داده با ترتیب متفاوت
     * «payload متفاوت» حساب نشود.
     *
     * @param  array<string, mixed>  $payload
     */
    private function hash(array $payload): string
    {
        return hash('sha256', (string) json_encode(
            $this->normalize($payload),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION,
        ));
    }

    /** @param array<string, mixed> $payload */
    private function normalize(array $payload): array
    {
        ksort($payload);

        foreach ($payload as $key => $value) {
            if (is_array($value)) {
                $payload[$key] = $this->normalize($value);
            }
        }

        return $payload;
    }
}
