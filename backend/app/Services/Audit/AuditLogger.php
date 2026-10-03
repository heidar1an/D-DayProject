<?php

namespace App\Services\Audit;

use App\Models\Admin;
use App\Models\AuditLog;
use App\Support\RequestId;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * ثبت Audit — فاز ۲۰ (§82/§83).
 *
 * قواعد:
 *   • **Append-only**: فقط insert؛ مدل ویرایش/حذف را قفل کرده است.
 *   • **Redact**: رمز/توکن/کد گروه هرگز مقدارشان ثبت نمی‌شود؛ فقط نام کلید
 *     می‌ماند تا بدانیم تغییر کرده.
 *   • **Fail-soft**: شکست audit نباید درخواست اصلی را بشکند، ولی حتماً لاگ
 *     می‌شود (audit از دست رفته باید دیده شود).
 */
final class AuditLogger
{
    /**
     * @param  array<string, mixed>  $changes
     */
    public function record(
        string $action,
        ?string $targetType = null,
        ?string $targetId = null,
        array $changes = [],
        string $actorType = AuditLog::ACTOR_SYSTEM,
        ?string $actorId = null,
        ?string $requestId = null,
    ): ?AuditLog {
        try {
            $log = new AuditLog;
            $log->forceFill([
                'actor_type' => $actorType,
                'actor_id' => $actorId !== null ? mb_substr($actorId, 0, 64) : null,
                'action' => mb_substr($action, 0, 120),
                'target_type' => $targetType !== null ? mb_substr($targetType, 0, 64) : null,
                'target_id' => $targetId !== null ? mb_substr($targetId, 0, 64) : null,
                'request_id' => mb_substr($requestId ?? RequestId::current(), 0, 64),
                'changes' => $changes === [] ? null : $this->redact($changes),
                'created_at' => now(),
            ])->save();

            return $log;
        } catch (Throwable $error) {
            Log::error('audit.write_failed', [
                'action' => $action,
                'error' => $error::class,
            ]);

            return null;
        }
    }

    /** @param array<string, mixed> $changes */
    public function recordAdmin(Admin $admin, string $action, ?string $targetType = null, ?string $targetId = null, array $changes = []): ?AuditLog
    {
        return $this->record(
            action: $action,
            targetType: $targetType,
            targetId: $targetId,
            changes: $changes,
            actorType: AuditLog::ACTOR_ADMIN,
            actorId: (string) $admin->getKey(),
        );
    }

    /**
     * پاک‌سازی بازگشتی: کلیدهای حساس redact، رشته‌های بلند بریده، عمق/تعداد
     * محدود. هیچ ساختار تودرتوی بی‌پایانی ثبت نمی‌شود.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function redact(array $payload, int $depth = 0): array
    {
        $denied = (array) config('audit.redact_keys', []);
        $placeholder = (string) config('audit.redacted_placeholder', '[REDACTED]');
        $maxLength = (int) config('audit.max_field_length');
        $maxFields = (int) config('audit.max_fields');

        $clean = [];
        $count = 0;

        foreach ($payload as $key => $value) {
            if ($count >= $maxFields) {
                $clean['__truncated__'] = true;
                break;
            }

            $count++;
            $name = is_string($key) ? $key : (string) $key;

            if ($this->isSensitive($name, $denied)) {
                $clean[$name] = $placeholder;

                continue;
            }

            if (is_array($value)) {
                $clean[$name] = $depth >= 3 ? '[DEPTH_LIMIT]' : $this->redact($value, $depth + 1);

                continue;
            }

            if (is_string($value)) {
                $clean[$name] = Str::length($value) > $maxLength
                    ? Str::limit($value, $maxLength, '…')
                    : $value;

                continue;
            }

            if (is_scalar($value) || $value === null) {
                $clean[$name] = $value;

                continue;
            }

            $clean[$name] = '[UNSERIALIZABLE]';
        }

        return $clean;
    }

    /** @param array<string, mixed> $filters */
    public function list(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = AuditLog::query();

        if (! empty($filters['action'])) {
            $query->where('action', (string) $filters['action']);
        }

        if (! empty($filters['actorType'])) {
            $query->where('actor_type', (string) $filters['actorType']);
        }

        if (! empty($filters['actorId'])) {
            $query->where('actor_id', (string) $filters['actorId']);
        }

        if (! empty($filters['targetType'])) {
            $query->where('target_type', (string) $filters['targetType']);
        }

        if (! empty($filters['targetId'])) {
            $query->where('target_id', (string) $filters['targetId']);
        }

        if (! empty($filters['from'])) {
            $query->where('created_at', '>=', (string) $filters['from']);
        }

        if (! empty($filters['to'])) {
            $query->where('created_at', '<=', (string) $filters['to']);
        }

        return $query->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage);
    }

    public function prune(int $days, int $batch): int
    {
        $cutoff = now()->subDays(max(1, $days));

        return AuditLog::query()->where('created_at', '<', $cutoff)->limit(max(1, $batch))->delete();
    }

    /** @param list<string> $denied */
    private function isSensitive(string $key, array $denied): bool
    {
        $lower = mb_strtolower($key);

        foreach ($denied as $needle) {
            $needle = mb_strtolower((string) $needle);

            if ($needle !== '' && str_contains($lower, $needle)) {
                return true;
            }
        }

        return false;
    }
}
