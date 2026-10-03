<?php

namespace App\Http\Resources;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * رکورد Audit در پنل — فاز ۲۰ (§82/§83).
 *
 * فقط خواندنی است: هیچ مسیری این رکورد را تغییر نمی‌دهد. `changes` قبلاً redact
 * شده و رمز/توکن/کد در آن نیست.
 *
 * @property AuditLog $resource
 */
final class AuditLogResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->getKey(),
            'actorType' => (string) $this->resource->actor_type,
            'actorId' => $this->resource->actor_id,
            'action' => (string) $this->resource->action,
            'targetType' => $this->resource->target_type,
            'targetId' => $this->resource->target_id,
            'requestId' => $this->resource->request_id,
            'changes' => $this->resource->changes,
            'createdAt' => $this->resource->created_at?->toIso8601String(),
        ];
    }
}
