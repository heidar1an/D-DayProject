<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\ApiResponse;
use App\Http\Controllers\Api\V1\Admin\Concerns\ResolvesAdmin;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BroadcastNotificationRequest;
use App\Http\Requests\Admin\SendNotificationRequest;
use App\Jobs\BroadcastNotificationJob;
use App\Models\Notification;
use App\Services\Audit\AuditLogger;
use App\Services\Notifications\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ارسال اعلان از پنل — فاز ۲۰ (§88/§103/§108).
 *
 *   POST /admin/notifications             تک‌کاربر، نوع `system`
 *   POST /admin/notifications/broadcast   گروهی، صف‌شده و chunked
 *
 * پنل **فقط** نوع `system` می‌سازد: نوع‌های دامنه‌ای (نتیجهٔ آزمون، دستاورد)
 * فقط از رخداد واقعی می‌آیند و از پنل قابل جعل نیستند (§19/§21).
 *
 * سقف گیرندگان قبل از صف‌بندی چک می‌شود؛ «bulk بدون limit ممنوع» (§103).
 */
final class AdminNotificationController extends Controller
{
    use ResolvesAdmin;

    public function __construct(
        private readonly NotificationService $notifications,
        private readonly AuditLogger $audit,
    ) {}

    public function store(SendNotificationRequest $request): JsonResponse
    {
        $notification = $this->notifications->create(
            userId: (string) $request->validated('userId'),
            type: Notification::TYPE_SYSTEM,
            payload: array_filter([
                'title' => $request->validated('title'),
                'body' => $request->validated('body'),
                'action' => $request->validated('action'),
            ], static fn ($value): bool => $value !== null),
        );

        if (! $notification instanceof Notification) {
            /* dedup: همان اعلان قبلاً ساخته شده — پاسخ موفق بدون رکورد تازه. */
            return ApiResponse::success(['created' => false]);
        }

        $this->audit->recordAdmin(
            admin: $this->admin($request),
            action: 'admin.notifications.send',
            targetType: 'notification',
            targetId: (string) $notification->getKey(),
            changes: ['userId' => (string) $request->validated('userId')],
        );

        return ApiResponse::success([
            'created' => true,
            'notification' => [
                'id' => $notification->getKey(),
                'type' => (string) $notification->type,
                'createdAt' => $notification->created_at?->toIso8601String(),
            ],
        ], null, 201);
    }

    public function broadcast(BroadcastNotificationRequest $request): JsonResponse
    {
        $broadcastKey = (string) $request->validated('broadcastKey');

        if (! (bool) config('notifications.broadcast.enabled', true)) {
            return ApiResponse::success(['queued' => false, 'reason' => 'broadcast_disabled'], null, 409);
        }

        $maxRecipients = (int) config('notifications.broadcast.max_recipients');
        $recipients = Schema::hasTable('users') ? (int) DB::table('users')->count() : 0;

        if ($recipients > $maxRecipients) {
            return ApiResponse::success(['queued' => false, 'reason' => 'recipient_limit_exceeded'], null, 409);
        }

        BroadcastNotificationJob::dispatch(
            $broadcastKey,
            (string) $request->validated('title'),
            (string) ($request->validated('body') ?? ''),
        );

        $this->audit->recordAdmin(
            admin: $this->admin($request),
            action: 'admin.notifications.broadcast',
            targetType: 'broadcast',
            targetId: $broadcastKey,
            changes: ['recipients' => $recipients],
        );

        return ApiResponse::success(['queued' => true, 'recipients' => $recipients], null, 202);
    }
}
