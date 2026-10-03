<?php

namespace App\Services\Learning;

use App\Events\Learning\StudySessionRecorded;
use App\Exceptions\ApiErrorException;
use App\Models\StudySession;
use App\Models\User;
use App\Services\Content\ContentVisibility;
use App\Services\Support\IdempotencyService;
use App\Support\Idempotency\IdempotencyOutcome;
use Carbon\CarbonImmutable;
use Closure;

/**
 * نشست مطالعه — تنها نویسندهٔ `study_sessions`.
 *
 * قاعدهٔ مرز اعتماد (همان قاعدهٔ legacy بانک تست، اینجا برای زمان):
 *     کلاینت می‌گوید:     «از این ساعت تا آن ساعت درس خواندم»
 *     سرور تعیین می‌کند:   «این بازه معقول است»
 *
 * چه چیزی رد می‌شود و چرا:
 *   • زمان آیندهٔ دورتر از skew مجاز ⇒ ۴۲۲ (ساعت کلاینت قابل‌اعتماد نیست).
 *   • `endedAt < startedAt` ⇒ ۴۲۲ (بازهٔ معکوس).
 *   • زمان قدیمی‌تر از `max_backdate_days` ⇒ ۴۲۲ (جلوی پرکردن تاریخچه با
 *     رکورد جعلی گذشته).
 *   • `durationSec` اعلامی که با اختلاف واقعی نمی‌خواند (بیش از تلورانس) ⇒ ۴۲۲.
 *     مدت **مشتق** می‌شود، نه پذیرفته‌شده.
 *   • مدت بیشتر از سقف ⇒ ۴۲۲.
 *   • `lessonPageId` نادیده‌گرفتنی نیست: اگر بیاید باید قابل مشاهده باشد، وگرنه ۴۰۴.
 *
 * مالکیت همیشه از سشن می‌آید؛ `userId` در بدنه هیچ اثری ندارد.
 */
class StudySessionService
{
    public function __construct(
        private readonly ContentVisibility $visibility,
        private readonly IdempotencyService $idempotency,
    ) {}

    /** @param Closure(StudySession):array<string, mixed> $present */
    public function record(User $user, array $data, ?string $requestKey, Closure $present): IdempotencyOutcome
    {
        $pageId = $data['lessonPageId'] ?? null;
        $page = null;

        if ($pageId !== null) {
            $page = app(ProgressService::class)->accessiblePage((string) $pageId);
        }

        return $this->idempotency->once(
            scope: 'learning.study_session.record',
            actorKey: 'user:'.$user->getKey(),
            requestKey: $requestKey,
            requestPayload: [
                'started_at' => $data['startedAt'],
                'ended_at' => $data['endedAt'] ?? null,
                'duration_sec' => $data['durationSec'] ?? null,
                'source' => $data['source'],
                'lesson_page_id' => $page?->getKey(),
            ],
            callback: fn (): IdempotencyOutcome => $this->apply($user, $data, $page, $present),
        );
    }

    /** @param Closure(StudySession):array<string, mixed> $present */
    private function apply(User $user, array $data, mixed $page, Closure $present): IdempotencyOutcome
    {
        $startedAt = CarbonImmutable::parse((string) $data['startedAt']);
        $endedAt = isset($data['endedAt']) ? CarbonImmutable::parse((string) $data['endedAt']) : null;

        $this->assertTimestamps($startedAt, $endedAt);

        $declared = isset($data['durationSec']) ? (int) $data['durationSec'] : null;
        $derived = $endedAt === null ? null : (int) round(abs($startedAt->diffInSeconds($endedAt)));

        if ($derived !== null && $declared !== null
            && abs($derived - $declared) > (int) config('learning.study_sessions.duration_tolerance_seconds')) {
            throw new ApiErrorException(
                'DURATION_MISMATCH',
                422,
                'The declared duration does not match the given time range.',
                ['durationSec' => ['DURATION_MISMATCH']],
            );
        }

        $duration = $derived ?? $declared;
        $max = (int) config('learning.study_sessions.max_duration_seconds');

        if ($duration !== null && $duration > $max) {
            throw new ApiErrorException(
                'DURATION_TOO_LONG',
                422,
                'The study session duration exceeds the allowed maximum.',
                ['durationSec' => ['DURATION_TOO_LONG']],
            );
        }

        $session = new StudySession;
        $session->forceFill([
            'user_id' => $user->getKey(),
            'lesson_page_id' => $page?->getKey(),
            'source' => (string) $data['source'],
            'started_at' => $startedAt,
            'ended_at' => $endedAt,
            'duration_sec' => $duration,
        ])->save();

        StudySessionRecorded::dispatch($user->getKey(), $session->getKey(), $session->source, $duration);

        return new IdempotencyOutcome(false, 201, $present($session));
    }

    private function assertTimestamps(CarbonImmutable $startedAt, ?CarbonImmutable $endedAt): void
    {
        $now = CarbonImmutable::now();
        $skew = (int) config('learning.study_sessions.max_clock_skew_seconds');

        if ($startedAt->greaterThan($now->addSeconds($skew))) {
            throw new ApiErrorException(
                'TIMESTAMP_IN_FUTURE',
                422,
                'The session start time is in the future.',
                ['startedAt' => ['TIMESTAMP_IN_FUTURE']],
            );
        }

        if ($endedAt !== null && $endedAt->greaterThan($now->addSeconds($skew))) {
            throw new ApiErrorException(
                'TIMESTAMP_IN_FUTURE',
                422,
                'The session end time is in the future.',
                ['endedAt' => ['TIMESTAMP_IN_FUTURE']],
            );
        }

        if ($endedAt !== null && $endedAt->lessThan($startedAt)) {
            throw new ApiErrorException(
                'TIMESTAMP_RANGE_INVALID',
                422,
                'The session end time is before its start time.',
                ['endedAt' => ['TIMESTAMP_RANGE_INVALID']],
            );
        }

        if ($startedAt->lessThan($now->subDays((int) config('learning.study_sessions.max_backdate_days')))) {
            throw new ApiErrorException(
                'TIMESTAMP_TOO_OLD',
                422,
                'The session start time is too far in the past.',
                ['startedAt' => ['TIMESTAMP_TOO_OLD']],
            );
        }
    }
}
