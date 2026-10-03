<?php

namespace App\Http\Resources;

use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * اعلان کاربر — فاز ۱۹.
 *
 * `user_id` **بازنمی‌گردد** (خودِ کاربر است و افشای آن بی‌مصرف) و payload فقط
 * با کلیدهای allowlist بیرون می‌آید. متن‌ها plain text‌اند.
 *
 * @property Notification $resource
 */
final class NotificationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $payload = (array) ($this->resource->payload ?? []);

        return [
            'id' => $this->resource->getKey(),
            'type' => (string) $this->resource->type,
            'title' => (string) ($payload['title'] ?? ''),
            'body' => (string) ($payload['body'] ?? ''),
            'action' => $payload['action'] ?? null,
            'entityId' => $payload['entityId'] ?? null,
            'meta' => $payload['meta'] ?? null,
            'read' => $this->resource->isRead(),
            'readAt' => $this->resource->read_at?->toIso8601String(),
            'createdAt' => $this->resource->created_at?->toIso8601String(),
        ];
    }
}
