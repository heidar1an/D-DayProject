<?php

namespace App\Services\Exam;

use App\Exceptions\ApiErrorException;
use App\Models\Exam;
use App\Models\ExamRegistration;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * ثبت‌نام در آزمون — فاز ۷.
 *
 * `UNIQUE(exam_id, user_id)` در دیتابیس تضمین نهایی است؛ این سرویس هم پیش از
 * insert چک می‌کند تا پیام کاربرپسند بدهد و مسیر دوبار‌ثبت‌نام را idempotent کند.
 *
 * مالکیت **همیشه** از سشن می‌آید: `user_id` هیچ‌وقت از بدنه/URL خوانده نمی‌شود.
 */
class ExamRegistrationService
{
    public function __construct(private readonly ExamQueryService $exams) {}

    public function register(User $user, string $examIdOrSlug, ?CarbonInterface $now = null): ExamRegistration
    {
        $now = $now ?? Carbon::now();
        $exam = $this->exams->findVisible($examIdOrSlug);

        $existing = ExamRegistration::query()
            ->where('exam_id', $exam->getKey())
            ->where('user_id', $user->getKey())
            ->first();

        if ($existing !== null) {
            /* idempotent — ثبت‌نام دوباره خطا نیست، همان رکورد برمی‌گردد. */
            return $existing;
        }

        $this->assertRegistrationOpen($exam, $now);

        $registration = new ExamRegistration;
        $registration->forceFill([
            'exam_id' => $exam->getKey(),
            'user_id' => $user->getKey(),
            'registered_at' => $now,
        ]);

        try {
            DB::transaction(fn () => $registration->save());
        } catch (UniqueConstraintViolationException) {
            /* دو درخواست هم‌زمان — رکورد برنده برگردانده می‌شود. */
            return ExamRegistration::query()
                ->where('exam_id', $exam->getKey())
                ->where('user_id', $user->getKey())
                ->firstOrFail();
        }

        return $registration;
    }

    public function cancel(User $user, string $examIdOrSlug, ?CarbonInterface $now = null): bool
    {
        $now = $now ?? Carbon::now();
        $exam = $this->exams->findVisible($examIdOrSlug);

        if (! $this->exams->registrationIsOpen($exam, $now)) {
            throw new ApiErrorException('REGISTRATION_CLOSED', 409, 'Registration for this exam is closed.');
        }

        $deleted = ExamRegistration::query()
            ->where('exam_id', $exam->getKey())
            ->where('user_id', $user->getKey())
            ->delete();

        return $deleted > 0;
    }

    private function assertRegistrationOpen(Exam $exam, CarbonInterface $now): void
    {
        if (! $this->exams->registrationIsOpen($exam, $now)) {
            throw new ApiErrorException('REGISTRATION_CLOSED', 409, 'Registration for this exam is closed.');
        }
    }
}
