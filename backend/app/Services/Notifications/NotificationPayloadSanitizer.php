<?php

namespace App\Services\Notifications;

/**
 * پاک‌سازی payload اعلان — فاز ۱۹ (§18/§28).
 *
 * قواعد:
 *   • فقط کلیدهای allowlist همان نوع می‌مانند؛ بقیه دور ریخته می‌شود.
 *   • متن‌ها **plain text** می‌شوند: تگ HTML حذف می‌شود (پیش‌فرض امن در برابر
 *     Stored XSS؛ Rich Text فقط اگر UI واقعاً بخواهد).
 *   • `action` فقط شکل امن می‌پذیرد؛ `javascript:`/`data:` رد می‌شود.
 *   • `meta` فقط اسکالر و بدون کلیدهای ممنوعه (رمز/توکن/کلید پاسخ).
 */
final class NotificationPayloadSanitizer
{
    public function __construct(
        private readonly NotificationTypeRegistry $types,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     *
     * @throws \InvalidArgumentException وقتی عنوان الزامی غایب است
     */
    public function sanitize(string $type, array $payload): array
    {
        $allowed = $this->types->payloadKeys($type);
        $clean = [];

        foreach ($allowed as $key) {
            if (! array_key_exists($key, $payload)) {
                continue;
            }

            $value = $payload[$key];

            switch ($key) {
                case 'title':
                    $clean['title'] = $this->text($value, (int) config('notifications.limits.title_max'));
                    break;

                case 'body':
                    $clean['body'] = $this->text($value, (int) config('notifications.limits.body_max'));
                    break;

                case 'action':
                    $action = $this->safeAction($value);

                    if ($action !== null) {
                        $clean['action'] = $action;
                    }
                    break;

                case 'entityId':
                    $entityId = $this->identifier($value);

                    if ($entityId !== null) {
                        $clean['entityId'] = $entityId;
                    }
                    break;

                case 'meta':
                    $meta = $this->meta($value);

                    if ($meta !== []) {
                        $clean['meta'] = $meta;
                    }
                    break;
            }
        }

        if ($this->types->titleRequired($type) && ($clean['title'] ?? '') === '') {
            throw new \InvalidArgumentException('Notification payload requires a non-empty "title" for type: '.$type);
        }

        $this->assertSize($clean);

        return $clean;
    }

    private function text(mixed $value, int $max): string
    {
        if (! is_scalar($value)) {
            return '';
        }

        /* plain text: تگ حذف، نویسهٔ کنترلی حذف، فاصله‌های تکراری جمع. */
        $text = strip_tags((string) $value);
        $text = preg_replace('/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}]/u', '', $text) ?? $text;
        $text = preg_replace('/[ \t]+/u', ' ', $text) ?? $text;

        return mb_substr(trim($text), 0, max(1, $max));
    }

    /** فقط شکل امن؛ هیچ scheme خطرناکی پذیرفته نمی‌شود. */
    private function safeAction(mixed $value): ?string
    {
        if (! is_scalar($value)) {
            return null;
        }

        $action = trim((string) $value);

        if ($action === '' || preg_match('/^(javascript|data|vbscript):/i', $action) === 1) {
            return null;
        }

        if (preg_match('~^[A-Za-z0-9._:/?#&=%-]+$~', $action) !== 1) {
            return null;
        }

        return mb_substr($action, 0, (int) config('notifications.limits.action_max'));
    }

    private function identifier(mixed $value): ?string
    {
        if (! is_scalar($value)) {
            return null;
        }

        $id = trim((string) $value);

        if ($id === '' || preg_match('/^[A-Za-z0-9_-]+$/', $id) !== 1) {
            return null;
        }

        return mb_substr($id, 0, 64);
    }

    /** @return array<string, scalar> */
    private function meta(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $denied = array_map('strtolower', (array) config('notifications.meta_denied_keys', []));
        $maxKeys = (int) config('notifications.limits.meta_max_keys');
        $maxValue = (int) config('notifications.limits.meta_value_max');
        $clean = [];

        foreach ($value as $key => $item) {
            if (! is_string($key) || count($clean) >= $maxKeys) {
                break;
            }

            if (in_array(strtolower($key), $denied, true)) {
                continue;
            }

            if (! is_scalar($item)) {
                continue;
            }

            if (is_string($item)) {
                $item = mb_substr(strip_tags($item), 0, $maxValue);
            } elseif (is_bool($item)) {
                $item = $item;
            } elseif (! is_int($item) && ! is_float($item)) {
                continue;
            }

            $clean[mb_substr($key, 0, 64)] = $item;
        }

        return $clean;
    }

    /** @param array<string, mixed> $clean */
    private function assertSize(array $clean): void
    {
        $max = (int) config('notifications.limits.payload_max_bytes');
        $encoded = json_encode($clean);

        if ($max > 0 && $encoded !== false && strlen($encoded) > $max) {
            throw new \InvalidArgumentException('Notification payload exceeds the configured maximum size.');
        }
    }
}
