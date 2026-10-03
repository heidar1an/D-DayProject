<?php

namespace App\Services\Notifications;

use InvalidArgumentException;

/**
 * allowlist انواع اعلان — فاز ۱۹ (§19).
 *
 * چرا allowlist و نه رشتهٔ آزاد: `type` تعیین می‌کند payload چه کلیدهایی
 * می‌تواند داشته باشد و UI چه برچسبی نشان می‌دهد. نوع آزاد یعنی دادهٔ بی‌قاعده
 * در دیتابیس و مسیر ناشناخته در UI.
 */
final class NotificationTypeRegistry
{
    /** @return list<string> */
    public function types(): array
    {
        return array_keys((array) config('notifications.types', []));
    }

    public function has(string $type): bool
    {
        return array_key_exists($type, (array) config('notifications.types', []));
    }

    /** @return array<string, mixed> */
    public function definition(string $type): array
    {
        $definition = config('notifications.types.'.$type);

        if (! is_array($definition)) {
            throw new InvalidArgumentException('Unknown notification type: '.$type);
        }

        return $definition;
    }

    /** @return list<string> */
    public function payloadKeys(string $type): array
    {
        $keys = $this->definition($type)['payload_keys'] ?? null;

        return is_array($keys) ? array_values(array_map('strval', $keys)) : [];
    }

    /** @return list<string> */
    public function channels(string $type): array
    {
        $channels = $this->definition($type)['channels'] ?? null;

        return is_array($channels) ? array_values(array_map('strval', $channels)) : [];
    }

    public function label(string $type): string
    {
        return (string) ($this->definition($type)['label'] ?? $type);
    }

    public function titleRequired(string $type): bool
    {
        return (bool) ($this->definition($type)['title_required'] ?? false);
    }

    /**
     * نگاشت `event_type` رخداد به نوع اعلان — `notification.exam_result` ⇒
     * `exam_result`. نوع خروجی هم دوباره در allowlist چک می‌شود.
     */
    public function fromEventType(string $eventType): string
    {
        $type = str_starts_with($eventType, 'notification.')
            ? substr($eventType, strlen('notification.'))
            : $eventType;

        if (! $this->has($type)) {
            throw new InvalidArgumentException('Event type maps to an unknown notification type: '.$eventType);
        }

        return $type;
    }
}
