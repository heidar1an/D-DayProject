<?php

namespace Tests\Unit\Notifications;

use App\Services\Notifications\NotificationPayloadSanitizer;
use App\Services\Notifications\NotificationTypeRegistry;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * پاک‌سازی payload اعلان — فاز ۱۹ (§18/§19/§28).
 */
final class NotificationPayloadSanitizerTest extends TestCase
{
    private function sanitizer(): NotificationPayloadSanitizer
    {
        return new NotificationPayloadSanitizer(new NotificationTypeRegistry);
    }

    public function test_unknown_type_is_rejected_by_the_registry(): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new NotificationTypeRegistry)->definition('made_up_type');
    }

    public function test_unknown_payload_keys_are_dropped(): void
    {
        $clean = $this->sanitizer()->sanitize('system', [
            'title' => 'سلام',
            'password' => 'secret-value',
            'answerKey' => 'B',
            'internal' => ['deep' => true],
        ]);

        self::assertSame(['title' => 'سلام'], $clean);
    }

    public function test_html_is_stripped_so_stored_xss_is_impossible(): void
    {
        $clean = $this->sanitizer()->sanitize('system', [
            'title' => '<script>alert(1)</script>عنوان',
            'body' => '<img src=x onerror=evil()>متن',
        ]);

        self::assertSame('alert(1)عنوان', $clean['title']);
        self::assertSame('متن', $clean['body']);
    }

    public function test_dangerous_action_schemes_are_dropped(): void
    {
        $clean = $this->sanitizer()->sanitize('system', [
            'title' => 'عنوان',
            'action' => 'javascript:alert(1)',
        ]);

        self::assertArrayNotHasKey('action', $clean);
    }

    public function test_safe_action_is_kept(): void
    {
        $clean = $this->sanitizer()->sanitize('system', [
            'title' => 'عنوان',
            'action' => '/dashboard/exams',
        ]);

        self::assertSame('/dashboard/exams', $clean['action']);
    }

    public function test_denied_meta_keys_never_reach_the_payload(): void
    {
        $clean = $this->sanitizer()->sanitize('system', [
            'title' => 'عنوان',
            'meta' => ['score' => 12, 'token' => 'abc', 'group_code' => 'XYZ', 'nested' => ['a' => 1]],
        ]);

        self::assertSame(['score' => 12], $clean['meta']);
    }

    public function test_title_is_required_for_types_that_declare_it(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->sanitizer()->sanitize('achievement_unlocked', ['body' => 'بدون عنوان']);
    }

    public function test_title_is_truncated_to_the_configured_limit(): void
    {
        $limit = (int) config('notifications.limits.title_max');

        $clean = $this->sanitizer()->sanitize('system', ['title' => str_repeat('ا', $limit + 50)]);

        self::assertSame($limit, mb_strlen($clean['title']));
    }

    public function test_non_scalar_meta_values_are_dropped(): void
    {
        $clean = $this->sanitizer()->sanitize('system', [
            'title' => 'عنوان',
            'meta' => ['ok' => 'x', 'bad' => ['nested'], 'alsoBad' => null],
        ]);

        self::assertSame(['ok' => 'x'], $clean['meta']);
    }
}
