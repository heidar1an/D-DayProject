<?php

namespace Tests\Feature\QuestionBank;

use App\Models\QuestionReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsQuestionBank;
use Tests\TestCase;

/**
 * فاز ۶ — گزارش سؤال.
 *
 * فقط «ثبت» در این فاز وجود دارد. تست‌ها تأیید می‌کنند که گزارش‌دهنده وضعیت
 * بررسی را تعیین نمی‌کند و دستهٔ ناشناخته وارد دیتابیس نمی‌شود.
 */
class QuestionReportTest extends TestCase
{
    use BuildsQuestionBank, RefreshDatabase;

    public function test_reporting_requires_authentication(): void
    {
        $question = $this->makeQuestion()['question'];

        $this->postJsonWithOrigin('/api/v1/questions/'.$question->getKey().'/reports', [
            'kind' => 'typo',
        ])->assertStatus(401);

        $this->assertSame(0, QuestionReport::query()->count());
    }

    public function test_a_valid_report_is_recorded_as_open(): void
    {
        $question = $this->makeQuestion()['question'];

        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$question->getKey().'/reports',
            ['kind' => 'wrong_answer', 'body' => 'گزینهٔ ۳ هم درست است.'],
            $this->csrfHeader($session),
        )
            ->assertStatus(201)
            ->assertJsonPath('data.report.kind', 'wrong_answer')
            ->assertJsonPath('data.report.status', QuestionReport::STATUS_OPEN)
            ->assertJsonPath('data.report.question_id', $question->getKey());

        $report = QuestionReport::query()->firstOrFail();

        $this->assertSame('گزینهٔ ۳ هم درست است.', $report->body);
        $this->assertNull($report->resolved_at);
    }

    public function test_every_documented_kind_is_accepted(): void
    {
        $question = $this->makeQuestion()['question'];

        $session = $this->register();
        $this->withAuthCookies($session);

        foreach (QuestionReport::KINDS as $kind) {
            $this->postJsonWithOrigin(
                '/api/v1/questions/'.$question->getKey().'/reports',
                ['kind' => $kind],
                $this->csrfHeader($session),
            )->assertStatus(201);
        }

        $this->assertSame(count(QuestionReport::KINDS), QuestionReport::query()->count());
    }

    public function test_an_unknown_kind_is_rejected(): void
    {
        $question = $this->makeQuestion()['question'];

        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$question->getKey().'/reports',
            ['kind' => 'made_up_kind'],
            $this->csrfHeader($session),
        )
            ->assertStatus(422)
            ->assertFieldError('kind');

        $this->assertSame(0, QuestionReport::query()->count());
    }

    public function test_the_review_status_cannot_be_set_by_the_reporter(): void
    {
        $question = $this->makeQuestion()['question'];

        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$question->getKey().'/reports',
            [
                'kind' => 'error',
                'status' => QuestionReport::STATUS_RESOLVED,
                'resolvedAt' => now()->toIso8601String(),
            ],
            $this->csrfHeader($session),
        )
            ->assertStatus(201)
            ->assertJsonPath('data.report.status', QuestionReport::STATUS_OPEN);

        $this->assertNull(QuestionReport::query()->firstOrFail()->resolved_at);
    }

    public function test_a_report_body_longer_than_the_limit_is_rejected(): void
    {
        $question = $this->makeQuestion()['question'];

        $session = $this->register();
        $this->withAuthCookies($session);

        $max = (int) config('question_bank.limits.report_body_max');

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$question->getKey().'/reports',
            ['kind' => 'other', 'body' => str_repeat('ا', $max + 1)],
            $this->csrfHeader($session),
        )
            ->assertStatus(422)
            ->assertFieldError('body');
    }

    public function test_a_draft_question_cannot_be_reported(): void
    {
        $question = $this->makeQuestion([], 1, 4, false)['question'];

        $session = $this->register();
        $this->withAuthCookies($session);

        $this->postJsonWithOrigin(
            '/api/v1/questions/'.$question->getKey().'/reports',
            ['kind' => 'typo'],
            $this->csrfHeader($session),
        )->assertStatus(404);

        $this->assertSame(0, QuestionReport::query()->count());
    }

    public function test_the_report_payload_does_not_echo_the_reporter_or_the_body(): void
    {
        $question = $this->makeQuestion()['question'];

        $session = $this->register();
        $this->withAuthCookies($session);

        $content = $this->postJsonWithOrigin(
            '/api/v1/questions/'.$question->getKey().'/reports',
            ['kind' => 'ambiguity', 'body' => 'متن یکتای گزارش'],
            $this->csrfHeader($session),
        )->assertStatus(201)->getContent();

        $this->assertStringNotContainsString('user_id', $content);
        $this->assertStringNotContainsString('متن یکتای گزارش', $content);
    }

    public function test_reporting_is_rate_limited_from_config(): void
    {
        $question = $this->makeQuestion()['question'];

        $session = $this->register();
        $this->withAuthCookies($session);

        $max = (int) config('question_bank.rate_limits.report.max');
        $headers = $this->csrfHeader($session);

        /*
         * سقف را از خود پاسخ می‌خوانیم، نه از یک عدد حدسی.
         *
         * مرز دقیق «چندمین درخواست رد می‌شود» معنای لاراولیِ
         * `ThrottleRequests`/`RateLimiter` است (شمارنده + پنجرهٔ زمانی) و عدد
         * آن به درایور کش وابسته است. آن‌چه قرارداد ماست این است که سقف از
         * config بیاید، ۴۲۹ با کد `RATE_LIMITED` بدهد، و هیچ درخواست پذیرفته‌شده
         * بی‌ثبت نماند.
         */
        $accepted = 0;
        $rejected = 0;

        for ($i = 0; $i < $max + 3; $i++) {
            $response = $this->postJsonWithOrigin(
                '/api/v1/questions/'.$question->getKey().'/reports',
                ['kind' => 'other'],
                $headers,
            );

            $status = $response->getStatusCode();

            if ($status === 201) {
                $accepted++;
                $this->assertSame(
                    (string) $max,
                    (string) $response->headers->get('X-RateLimit-Limit'),
                    'the limiter must advertise the configured maximum',
                );

                continue;
            }

            $this->assertSame(429, $status);
            $this->assertSame('RATE_LIMITED', $response->json('error.code'));
            $rejected++;
        }

        $this->assertGreaterThan(0, $rejected, 'the configured rate limit must eventually reject');
        $this->assertGreaterThanOrEqual($max, $accepted, 'the limiter must not be stricter than configured');

        // هیچ نوشتنی گم یا تکرار نشده: به‌ازای هر ۲۰۱ یک گزارش.
        $this->assertSame($accepted, QuestionReport::query()->count());
    }
}
