<?php

namespace App\Services\Analytics;

use App\Exceptions\ApiErrorException;
use App\Models\AnalyticsEvent;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * ثبت رویداد تحلیلی — تنها نویسندهٔ `analytics_events` (فاز ۸).
 *
 * سه قاعده‌ای که اینجا تحمیل می‌شوند:
 *
 *   1. **Typed** — `event_type` باید در `config('analytics.event_types')` باشد.
 *      نوع آزاد یعنی جدول به سطل زباله تبدیل می‌شود و هیچ Query ای معنا ندارد.
 *
 *   2. **Duplicate-safe** — `event_key` یکتاست و درج با `insertOrIgnore` انجام
 *      می‌شود. اگر یک Domain Event دو بار publish شود (at-least-once بودن
 *      listener ها)، رکورد دوم ساخته نمی‌شود.
 *
 *   3. **PII-safe** — کلیدهای ممنوع (`token`, `password`, `phone`, `email`, …) و
 *      payload بزرگ‌تر از سقف config رد می‌شوند. خطا **پرتاب** می‌شود تا توسعه‌دهنده
 *      لود ببیند؛ listener آن را می‌گیرد و لاگ می‌کند تا تراکنش دامنه نشکند.
 */
class AnalyticsEventRecorder
{
    /**
     * @param  array<string, mixed>  $properties
     */
    public function record(
        string $eventKey,
        string $eventType,
        ?string $userId,
        array $properties = [],
        ?CarbonInterface $occurredAt = null,
    ): bool {
        $this->assertType($eventType);
        $this->assertPropertiesSafe($properties);

        $encoded = $properties === []
            ? null
            : json_encode($properties, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $inserted = DB::table('analytics_events')->insertOrIgnore([
            'id' => (string) Str::uuid(),
            'event_key' => Str::limit($eventKey, 120, ''),
            'user_id' => $userId,
            'event_type' => $eventType,
            'occurred_at' => ($occurredAt ?? Carbon::now())->utc(),
            'properties' => $encoded,
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ]);

        return $inserted > 0;
    }

    /** @param array<string, mixed> $properties */
    private function assertPropertiesSafe(array $properties): void
    {
        $encoded = json_encode($properties, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if (is_string($encoded) && strlen($encoded) > (int) config('analytics.max_properties_bytes')) {
            throw ApiErrorException::invalid(['properties' => ['PROPERTIES_TOO_LARGE']]);
        }

        $forbidden = (array) config('analytics.forbidden_property_keys');

        foreach (array_keys($properties) as $key) {
            $normalized = strtolower((string) $key);

            foreach ($forbidden as $needle) {
                if (str_contains($normalized, (string) $needle)) {
                    throw ApiErrorException::invalid(
                        ['properties' => ["FORBIDDEN_PROPERTY_KEY:{$key}"]],
                        'Analytics properties must not contain personal or secret fields.',
                    );
                }
            }
        }
    }

    private function assertType(string $eventType): void
    {
        if (! in_array($eventType, (array) config('analytics.event_types'), true)) {
            throw ApiErrorException::invalid(['event_type' => ['UNKNOWN_EVENT_TYPE']]);
        }
    }

    /** فقط برای تست/ابزار — تعداد رویدادهای یک کاربر. */
    public function countFor(?string $userId, ?string $eventType = null): int
    {
        return AnalyticsEvent::query()
            ->where('user_id', $userId)
            ->when($eventType !== null, fn ($query) => $query->where('event_type', $eventType))
            ->count();
    }
}
