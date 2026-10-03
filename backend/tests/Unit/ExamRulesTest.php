<?php

namespace Tests\Unit;

use App\Exceptions\ApiErrorException;
use App\Services\Exam\ExamRules;
use PHPUnit\Framework\TestCase;

/**
 * قوانین آزمون — تست واحد خالص، بدون دیتابیس.
 *
 * چرا مهم: `rules` در JSONB است و اگر بدون قید نوشته شود، هر کلیدی می‌تواند
 * وارد شود و بی‌صدا نادیده گرفته شود. این تست‌ها قفل می‌کنند که ساختار
 * **بسته** است.
 */
class ExamRulesTest extends TestCase
{
    public function test_defaults_are_safe_and_versioned(): void
    {
        $rules = ExamRules::defaults();

        $this->assertSame(ExamRules::CURRENT_VERSION, $rules->version());
        $this->assertSame(ExamRules::DEADLINE_EXAM_END, $rules->deadlineMode());
        $this->assertFalse($rules->perAttemptDeadline());
        $this->assertTrue($rules->allowsReview());
        $this->assertFalse($rules->allowsGuest());
        $this->assertSame(ExamRules::CURRENT_VERSION, $rules->toArray()['version']);
    }

    public function test_unknown_rule_key_is_rejected(): void
    {
        $this->expectException(ApiErrorException::class);

        ExamRules::fromArray(['score' => 100]);
    }

    public function test_invalid_deadline_mode_is_rejected(): void
    {
        $this->expectException(ApiErrorException::class);

        ExamRules::fromArray(['deadline_mode' => 'whenever']);
    }

    public function test_non_boolean_flag_is_rejected(): void
    {
        $this->expectException(ApiErrorException::class);

        ExamRules::fromArray(['allow_review' => 'yes']);
    }

    public function test_unsupported_rule_version_is_rejected(): void
    {
        $this->expectException(ApiErrorException::class);

        ExamRules::fromArray(['version' => 99]);
    }

    public function test_per_attempt_deadline_mode(): void
    {
        $rules = ExamRules::fromArray(['deadline_mode' => ExamRules::DEADLINE_PER_ATTEMPT]);

        $this->assertTrue($rules->perAttemptDeadline());
    }

    public function test_public_view_hides_internal_decision_keys(): void
    {
        $view = ExamRules::fromArray(['deadline_mode' => 'per_attempt', 'guest' => ['allowed' => true]])->publicView();

        /* `deadline_mode` و `guest` نگاشت داخلی‌اند و نباید به کلاینت بروند. */
        $this->assertArrayNotHasKey('deadline_mode', $view);
        $this->assertArrayNotHasKey('guest', $view);
        $this->assertArrayHasKey('allow_review', $view);
    }
}
