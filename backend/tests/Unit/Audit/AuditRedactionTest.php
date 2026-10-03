<?php

namespace Tests\Unit\Audit;

use App\Services\Audit\AuditLogger;
use Tests\TestCase;

/**
 * redact در Audit — فاز ۲۰ (§83).
 *
 * قاعده: کلید حساس **نامش می‌ماند ولی مقدارش هرگز ثبت نمی‌شود**.
 */
final class AuditRedactionTest extends TestCase
{
    private function logger(): AuditLogger
    {
        return app(AuditLogger::class);
    }

    public function test_sensitive_keys_are_replaced_with_a_placeholder(): void
    {
        $clean = $this->logger()->redact([
            'password' => 'Tapesh#1402',
            'token' => 'abc',
            'group_code' => 'XYZ-123',
            'title' => 'عنوان امن',
        ]);

        $placeholder = (string) config('audit.redacted_placeholder');

        self::assertSame($placeholder, $clean['password']);
        self::assertSame($placeholder, $clean['token']);
        self::assertSame($placeholder, $clean['group_code']);
        self::assertSame('عنوان امن', $clean['title']);
    }

    public function test_long_strings_are_truncated(): void
    {
        $limit = (int) config('audit.max_field_length');

        $clean = $this->logger()->redact(['body' => str_repeat('x', $limit + 500)]);

        self::assertLessThanOrEqual($limit + 1, mb_strlen($clean['body']));
    }

    public function test_nesting_is_bounded(): void
    {
        $clean = $this->logger()->redact([
            'a' => ['b' => ['c' => ['d' => ['e' => 'deep']]]],
        ]);

        self::assertSame('[DEPTH_LIMIT]', $clean['a']['b']['c']['d']);
    }

    public function test_field_count_is_bounded(): void
    {
        $payload = [];

        for ($i = 0; $i < (int) config('audit.max_fields') + 20; $i++) {
            $payload['field'.$i] = $i;
        }

        $clean = $this->logger()->redact($payload);

        self::assertTrue($clean['__truncated__'] ?? false);
    }

    public function test_non_serializable_values_never_leak(): void
    {
        $clean = $this->logger()->redact(['resource' => fopen('php://memory', 'r')]);

        self::assertSame('[UNSERIALIZABLE]', $clean['resource']);
    }
}
