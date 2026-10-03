<?php

namespace Tests\Feature\Ai;

use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Models\Entitlement;
use App\Models\Media;
use App\Models\User;
use App\Services\Ai\AiProvider;
use App\Services\Ai\AiProviderAnswer;
use App\Services\Media\MediaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

final class AiMentorTest extends TestCase
{
    use RefreshDatabase;

    private array $captured = [];

    private function enableFake(?string $error = null): void
    {
        config()->set('ai.enabled', true);
        config()->set('ai.external_processing_approved', true);
        config()->set('ai.quota.daily_requests', 3);
        $this->app->instance(AiProvider::class, new class($this->captured, $error) implements AiProvider
        {
            public function __construct(private array &$captured, private ?string $error) {}

            public function chat(string $message, array $context, array $history): AiProviderAnswer
            {
                $this->captured = compact('message', 'context', 'history');
                if ($this->error !== null) {
                    throw new RuntimeException($this->error);
                }
                return new AiProviderAnswer('پاسخ آموزشی', 'provider-private-id', 7, 3);
            }
        });
    }

    private function entitled(string $phone): array
    {
        $session = $this->register(['phone' => $phone]);
        $session->assertCreated();
        $user = User::query()->where('phone', $phone)->firstOrFail();
        (new Entitlement)->forceFill([
            'user_id' => $user->getKey(), 'capability' => 'ai.mentor',
            'starts_at' => now()->subMinute(), 'ends_at' => now()->addDay(),
        ])->save();
        return [$session, $user];
    }

    private function ask($session, array $body = [], array $headers = [])
    {
        return $this->withAuthCookies($session)->postJson('/api/v1/ai/chat', [
            'message' => 'مفهوم کلیه چیست؟', ...$body,
        ], ['Origin' => $this->origin(), ...$this->csrfHeader($session), ...$headers]);
    }

    public function test_guest_and_non_entitled_user_cannot_call_provider(): void
    {
        $this->enableFake();
        $this->forgetCookies()->postJsonWithOrigin('/api/v1/ai/chat', ['message' => 'سلام'])->assertUnauthorized();
        $session = $this->register(['phone' => '09120001001']);
        $this->ask($session)->assertForbidden();
        $this->assertSame([], $this->captured);
        $this->assertDatabaseCount('ai_messages', 0);
    }

    public function test_disabled_provider_fails_closed_even_for_entitled_user(): void
    {
        [$session] = $this->entitled('09120001002');
        $this->ask($session)->assertStatus(503)->assertJsonPath('error.code', 'FEATURE_NOT_CONFIGURED');
        $this->assertDatabaseCount('ai_messages', 0);
    }

    public function test_owned_chat_is_encrypted_minimal_and_idempotent(): void
    {
        $this->enableFake();
        [$session, $user] = $this->entitled('09120001003');
        $headers = ['Idempotency-Key' => 'client-key-0001'];
        $response = $this->ask($session, ['mode' => 'study'], $headers)->assertOk()
            ->assertJsonPath('data.message.text', 'پاسخ آموزشی');
        $id = $response->json('data.conversationId');
        $this->assertSame($id, $this->ask($session, ['mode' => 'study'], $headers)->assertOk()->json('data.conversationId'));
        $this->assertDatabaseCount('ai_messages', 2);
        $this->assertDatabaseHas('ai_daily_usage', ['user_id' => $user->getKey(), 'reserved' => 1]);
        $this->assertNotSame('مفهوم کلیه چیست؟', DB::table('ai_messages')->where('role', 'user')->value('content'));
        $this->assertStringNotContainsString('provider-private-id', $response->getContent());
        $this->assertStringNotContainsString((string) $user->getKey(), $response->getContent());
        $this->assertSame(['purpose', 'learning', 'questions', 'exams'], array_keys($this->captured['context']));
        $this->assertArrayNotHasKey('phone', $this->captured['context']);
        $this->ask($session, ['mode' => 'quiz'], $headers)->assertStatus(409)->assertJsonPath('error.code', 'IDEMPOTENCY_CONFLICT');
    }

    public function test_cross_user_conversation_and_attachment_return_404(): void
    {
        $this->enableFake();
        [$a, $userA] = $this->entitled('09120001004');
        [$b] = $this->entitled('09120001005');
        $this->ask($a)->assertOk();
        $conversation = AiConversation::query()->firstOrFail();
        $this->ask($b, ['conversationId' => $conversation->getKey()])->assertNotFound();
        $this->assertDatabaseCount('ai_messages', 2);
        Storage::fake((string) config('media.disks.private'));
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==');
        $media = app(MediaService::class)->store($userA, UploadedFile::fake()->createWithContent('study.png', $png), ['purpose' => 'ai']);
        $this->assertSame(Media::VISIBILITY_PRIVATE, $media->visibility);
        $this->ask($b, ['attachmentIds' => [$media->getKey()]])->assertNotFound();
    }

    public function test_quota_rate_and_provider_failures_never_leak_secret(): void
    {
        $this->enableFake();
        [$session, $user] = $this->entitled('09120001006');
        config()->set('ai.quota.daily_requests', 1);
        $this->ask($session)->assertOk();
        $this->ask($session)->assertStatus(429)->assertJsonPath('error.code', 'AI_QUOTA_EXCEEDED');
        config()->set('ai.quota.daily_requests', 5);
        config()->set('ai.rate_limits.user_per_minute', 1);
        /*
         * سهمیهٔ کاربر از قبل پر می‌شود، نه با تکیه بر شمارش درخواست‌های پیاپی:
         * هارنس تست با کش array شمارنده را یک درخواست عقب‌تر می‌بیند. کلید همان
         * چیزی است که `ThrottleRequests` می‌سازد: md5(limiterName.limitKey).
         */
        $throttleKey = md5('ai_chat'.'ai_chat:user:'.$user->getKey());
        RateLimiter::hit($throttleKey, 60);
        RateLimiter::hit($throttleKey, 60);
        $this->ask($session)->assertStatus(429)->assertJsonPath('error.code', 'AI_RATE_LIMITED');
        $this->assertSame(1, (int) DB::table('ai_daily_usage')->where('user_id', $user->getKey())->value('reserved'));
    }

    public function test_provider_timeout_or_error_is_normalized_and_quota_released(): void
    {
        $this->enableFake('timeout secret=never-print credential=123');
        [$session, $user] = $this->entitled('09120001007');
        $response = $this->ask($session)->assertStatus(503)->assertJsonPath('error.code', 'AI_PROVIDER_UNAVAILABLE');
        $this->assertStringNotContainsString('never-print', $response->getContent());
        $this->assertSame(0, (int) DB::table('ai_daily_usage')->where('user_id', $user->getKey())->value('reserved'));
        $this->assertSame('failed', AiMessage::query()->where('role', 'user')->firstOrFail()->status);
    }

    public function test_client_identity_context_and_missing_csrf_are_rejected(): void
    {
        $this->enableFake();
        [$session] = $this->entitled('09120001008');
        $this->ask($session, ['userId' => fake()->uuid()])->assertStatus(422);
        $this->ask($session, ['context' => ['password' => 'secret']])->assertStatus(422);
        $this->withAuthCookies($session)->postJsonWithOrigin('/api/v1/ai/chat', ['message' => 'hi'])->assertForbidden();
        $this->assertSame([], $this->captured);
    }
}
