<?php

namespace App\Services\Admin;

use App\Models\Notification;
use App\Models\NotificationDelivery;
use App\Services\Notifications\NotificationService;
use App\Services\Search\SearchIndexer;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * مشاهدهٔ عملیاتی پنل — فاز ۲۰ (§10/§88/§89).
 *
 *   failed_jobs             Dead letter قابل مشاهده: job، تلاش‌ها، کد خطا، زمان.
 *                           **payload خام و exception کامل برنمی‌گردد** — ممکن
 *                           است دادهٔ حساس داشته باشند (§10/§44).
 *   notification_deliveries وضعیت تحویل هر کانال + retry کنترل‌شده.
 *   search_documents        وضعیت ایندکس (تعداد سند در برابر منتشرشده).
 */
final class AdminOpsQueryService
{
    public function __construct(
        private readonly SearchIndexer $indexer,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Jobهای شکست‌خورده با metadata امن.
     *
     * @param  array<string, mixed>  $filters
     * @return array{items: list<array<string, mixed>>, total: int, page: int, perPage: int, lastPage: int}
     */
    public function failedJobs(array $filters, int $page, int $perPage): array
    {
        if (! Schema::hasTable('failed_jobs')) {
            return ['items' => [], 'total' => 0, 'page' => 1, 'perPage' => $perPage, 'lastPage' => 1];
        }

        $query = DB::table('failed_jobs')->select(['id', 'uuid', 'connection', 'queue', 'payload', 'failed_at']);

        if (! empty($filters['queue'])) {
            $query->where('queue', (string) $filters['queue']);
        }

        if (! empty($filters['connection'])) {
            $query->where('connection', (string) $filters['connection']);
        }

        if (! empty($filters['from'])) {
            $query->where('failed_at', '>=', (string) $filters['from']);
        }

        $total = (clone $query)->count();
        $lastPage = $total === 0 ? 1 : (int) ceil($total / $perPage);

        $rows = $query
            ->orderByDesc('failed_at')
            ->offset(max(0, ($page - 1) * $perPage))
            ->limit($perPage)
            ->get();

        $items = $rows->map(function ($row): array {
            $payload = json_decode((string) $row->payload, true);

            return [
                'id' => (string) $row->uuid,
                'connection' => $row->connection,
                'queue' => $row->queue,
                'job' => is_array($payload) ? ($payload['displayName'] ?? 'unknown') : 'unknown',
                'attempts' => is_array($payload) ? (int) ($payload['attempts'] ?? 0) : null,
                'failedAt' => (string) $row->failed_at,
            ];
        })->all();

        return [
            'items' => array_values($items),
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'lastPage' => $lastPage,
        ];
    }

    /** Retry یک Job شکست‌خورده — از همان مکانیزم رسمی Laravel. */
    public function retryFailedJob(string $uuid): bool
    {
        if (! Schema::hasTable('failed_jobs')) {
            return false;
        }

        $exists = DB::table('failed_jobs')->where('uuid', $uuid)->exists();

        if (! $exists) {
            return false;
        }

        Artisan::call('queue:retry', ['id' => [$uuid]]);

        return true;
    }

    /** @return array<string, array{indexed: int, published: int}> */
    public function searchStatus(): array
    {
        return $this->indexer->status();
    }

    /**
     * تحویل‌های اعلان — فیلتر allowlist.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, NotificationDelivery>
     */
    public function deliveries(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = NotificationDelivery::query()->with(['notification:id,user_id,type']);

        if (! empty($filters['channel'])) {
            $query->where('channel', (string) $filters['channel']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        if (! empty($filters['type'])) {
            $query->whereHas('notification', fn ($inner) => $inner->where('type', (string) $filters['type']));
        }

        if (! empty($filters['notificationId'])) {
            $query->where('notification_id', (string) $filters['notificationId']);
        }

        return $query->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage);
    }

    public function retryDelivery(string $deliveryId): ?NotificationDelivery
    {
        /** @var NotificationDelivery|null $delivery */
        $delivery = NotificationDelivery::query()->with('notification')->whereKey($deliveryId)->first();

        if (! $delivery instanceof NotificationDelivery) {
            return null;
        }

        if (! $delivery->notification instanceof Notification) {
            return null;
        }

        return $this->notifications->retryDelivery($delivery);
    }
}
