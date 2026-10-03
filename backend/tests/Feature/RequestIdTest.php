<?php

namespace Tests\Feature;

use Tests\TestCase;

/** DoD فاز ۱ — «Request ID تولید می‌شود» (پذیرش، تولید و ردّ مقدار نامعتبر). */
class RequestIdTest extends TestCase
{
    public function test_request_id_is_generated_per_request(): void
    {
        $first = $this->getJson('/api/v1/healthz');
        $second = $this->getJson('/api/v1/healthz');

        $firstId = $first->headers->get('X-Request-Id');
        $secondId = $second->headers->get('X-Request-Id');

        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $firstId);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $secondId);
        $this->assertNotSame($firstId, $secondId);
    }

    public function test_valid_incoming_request_id_is_honored_end_to_end(): void
    {
        $response = $this->getJson('/api/v1/healthz', ['X-Request-Id' => 'client-id-123456']);

        $this->assertSame('client-id-123456', $response->headers->get('X-Request-Id'));
        $this->assertSame('client-id-123456', $response->json('requestId'));
    }

    public function test_malformed_request_id_is_replaced(): void
    {
        $response = $this->getJson('/api/v1/healthz', ['X-Request-Id' => 'bad id!!']);

        $id = $response->headers->get('X-Request-Id');

        $this->assertMatchesRegularExpression('/^[A-Za-z0-9._-]{8,64}$/', $id);
        $this->assertNotSame('bad id!!', $id);
    }
}
