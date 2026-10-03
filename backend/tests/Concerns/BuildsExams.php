<?php

namespace Tests\Concerns;

use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\User;
use App\Services\Exam\ExamService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Testing\TestResponse;

/**
 * ساخت دادهٔ آزمون برای تست‌ها — از **سرویس واقعی**، نه از درج مستقیم.
 *
 * چرا از سرویس: اگر تست خودش ردیف `exam_questions` بسازد، Snapshot و کلید
 * رمزنگاری‌شده را دور می‌زند و چیزی را تأیید می‌کند که در production وجود ندارد.
 * `ExamService::create` همان مسیری است که ادمین/seed استفاده می‌کند.
 */
trait BuildsExams
{
    /**
     * آزمون منتشرشده با سؤال‌های snapshotشده.
     *
     * @param  array<string, mixed>  $attributes
     * @return array{exam: Exam, questions: Collection<int, ExamQuestion>}
     */
    protected function makeExam(array $attributes = [], int $questionCount = 3, array $questionIds = []): array
    {
        $ids = $questionIds;

        for ($index = count($ids); $index < $questionCount; $index++) {
            $ids[] = $this->makeQuestion(['difficulty' => 'medium'])['question']->getKey();
        }

        /* `publish` کلید کنترلی تست است، نه ستون دامنه — نباید به سرویس برود. */
        $publish = $attributes['publish'] ?? true;
        unset($attributes['publish']);

        /** @var ExamService $service */
        $service = app(ExamService::class);

        $exam = $service->create(array_merge([
            'slug' => 'exam-'.uniqid(),
            'kind' => Exam::KIND_COORDINATED,
            'title' => 'آزمون تستی',
            'opens_at' => Carbon::now()->subMinutes(5),
            'closes_at' => Carbon::now()->addMinutes(60),
            /* پنجرهٔ ثبت‌نام صریح، جدا از پنجرهٔ برگزاری — همان مدل legacy. */
            'registration_opens_at' => Carbon::now()->subHours(2),
            'registration_closes_at' => Carbon::now()->addMinutes(60),
            'duration_minutes' => 60,
            'attempt_limit' => 1,
            'negative_marking' => 0,
        ], $attributes), $ids);

        if ($publish) {
            $exam = $service->publish($exam);
        }

        return [
            'exam' => $exam->refresh(),
            'questions' => ExamQuestion::query()->where('exam_id', $exam->getKey())->orderBy('position')->get(),
        ];
    }

    /**
     * آزمون همیشه‌در‌دسترس (بدون پنجرهٔ زمانی) — معادل `alwaysAvailable` در legacy.
     *
     * @param  array<string, mixed>  $attributes
     * @return array{exam: Exam, questions: Collection<int, ExamQuestion>}
     */
    protected function makeAlwaysAvailableExam(array $attributes = [], int $questionCount = 2): array
    {
        return $this->makeExam(array_merge([
            'kind' => Exam::KIND_QUIZ,
            'opens_at' => null,
            'closes_at' => null,
        ], $attributes), $questionCount);
    }

    /** کاربر واقعی با سشن معتبر؛ کوکی‌ها روی کلاینت تست ست می‌شوند. */
    protected function signedInStudent(array $payload = []): array
    {
        $session = $this->register($payload);
        $session->assertCreated();

        $this->withAuthCookies($session);

        $phone = $payload['phone'] ?? '09123456789';
        $user = User::query()->where('phone', $phone)->firstOrFail();

        return ['user' => $user, 'session' => $session, 'csrf' => $this->csrfHeader($session)];
    }

    /** شروع Attempt از مسیر واقعی API و بازگشت شناسهٔ آن. */
    protected function startAttempt(Exam $exam, array $csrf, array $headers = []): TestResponse
    {
        return $this->postJsonWithOrigin(
            '/api/v1/exams/'.$exam->getKey().'/attempts',
            [],
            array_merge($csrf, $headers),
        );
    }

    /**
     * Attempt باز با سؤال‌ها — مسیر واقعی: ثبت‌نام ⇒ شروع.
     *
     * @param  array<string, mixed>  $examAttributes
     * @param  array<string, mixed>  $payload  payload ثبت‌نام دانش‌آموز (برای چند دانش‌آموز در یک تست)
     * @return array{exam: Exam, attemptId: string, questions: Collection<int, ExamQuestion>, csrf: array<string, string>, user: User, session: TestResponse}
     */
    protected function openAttempt(int $questionCount = 2, array $examAttributes = [], array $payload = []): array
    {
        ['exam' => $exam, 'questions' => $questions] = $this->makeExam($examAttributes, $questionCount);
        $student = $this->signedInStudent($payload);

        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $student['csrf'])
            ->assertStatus(201);

        $attemptId = $this->startAttempt($exam, $student['csrf'])->assertStatus(201)->json('data.attempt.id');

        return [
            'exam' => $exam,
            'attemptId' => $attemptId,
            'questions' => $questions,
            'csrf' => $student['csrf'],
            'user' => $student['user'],
            'session' => $student['session'],
        ];
    }

    /** اولین گزینهٔ یک سؤالِ snapshotشده (شناسهٔ درون‌snapshot). */
    protected function optionIdAt(ExamQuestion $examQuestion, int $index = 0): string
    {
        return $examQuestion->render_snapshot['options'][$index]['id'];
    }

    /** اندیس گزینهٔ درست — از کلید رمزگشایی‌شده، نه از یک فرض ثابت. */
    protected function correctOptionIndex(ExamQuestion $examQuestion): int
    {
        $correct = $examQuestion->correctOptionId();
        $options = $examQuestion->render_snapshot['options'];

        foreach ($options as $index => $option) {
            if ($option['id'] === $correct) {
                return $index;
            }
        }

        return 0;
    }

    /**
     * یک دانش‌آموز تازه را در آزمون می‌نشاند: ثبت‌نام ⇒ شروع ⇒ پاسخ ⇒ پایان.
     *
     * `$correctCount` تعیین می‌کند چند سؤال **درست** پاسخ داده شود؛ بقیه عمداً
     * غلط. کل مسیر از API واقعی می‌گذرد تا نتیجهٔ ساخته‌شده همان چیزی باشد که
     * production تولید می‌کند — نه یک ردیف دست‌ساز در `exam_results`.
     *
     * @param  Collection<int, ExamQuestion>  $questions
     * @param  array<string, mixed>  $payload
     * @return array{user: User, attemptId: string, resultId: string|null, response: TestResponse, session: TestResponse, csrf: array<string, string>}
     */
    protected function sitExam(Exam $exam, Collection $questions, int $correctCount = 0, array $payload = []): array
    {
        $student = $this->signedInStudent($payload);

        $this->postJsonWithOrigin('/api/v1/exams/'.$exam->getKey().'/registrations', [], $student['csrf'])
            ->assertStatus(201);

        $attemptId = $this->startAttempt($exam, $student['csrf'])->assertStatus(201)->json('data.attempt.id');

        foreach ($questions as $index => $question) {
            $correct = $this->correctOptionIndex($question);
            $options = $question->render_snapshot['options'];
            $pick = $index < $correctCount ? $correct : ($correct + 1) % count($options);

            $this->putJsonWithOrigin('/api/v1/exam-attempts/'.$attemptId.'/answers', [
                'questionId' => $question->getKey(),
                'selectedOptionId' => $this->optionIdAt($question, $pick),
                'revision' => 0,
            ], $student['csrf'])->assertOk();
        }

        $response = $this->postJsonWithOrigin('/api/v1/exam-attempts/'.$attemptId.'/finish', [], $student['csrf'])
            ->assertOk();

        return [
            'user' => $student['user'],
            'attemptId' => $attemptId,
            'resultId' => $response->json('data.result.id'),
            'response' => $response,
            'session' => $student['session'],
            'csrf' => $student['csrf'],
        ];
    }
}
