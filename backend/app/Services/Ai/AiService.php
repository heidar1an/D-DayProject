<?php

namespace App\Services\Ai;

use App\Exceptions\ApiErrorException;
use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Models\Media;
use App\Models\User;
use App\Services\Commerce\EntitlementService;
use Illuminate\Support\Facades\DB;
use Throwable;

/** AI owns only its own conversation state. The learning and commerce modules remain authoritative. */
final class AiService
{
    public function __construct(
        private readonly AiProvider $provider,
        private readonly AiContextBuilder $context,
        private readonly AiQuota $quota,
        private readonly EntitlementService $entitlements,
    ) {}

    public function authorize(User $user): void
    {
        // Do not use Content's optional/no-op entitlement gate: AI is always fail-closed.
        if (! $this->entitlements->has($user, (string) config('ai.capability'))) {
            throw ApiErrorException::forbidden('AI entitlement is required.');
        }
        if (! config('ai.enabled') || ! config('ai.external_processing_approved')) {
            throw ApiErrorException::notConfigured('AI');
        }
    }

    /** @param array<string, mixed> $data */
    public function chat(User $user, array $data, ?string $requestKey = null): array
    {
        $conversation = null;
        if (isset($data['conversationId'])) {
            $conversation = AiConversation::query()->whereKey($data['conversationId'])
                ->where('user_id', $user->getKey())->where('status', 'active')->first();
            if ($conversation === null) {
                throw new ApiErrorException('NOT_FOUND', 404, 'Conversation not found.');
            }
        }

        $this->authorize($user);
        foreach ($data['attachmentIds'] ?? [] as $id) {
            $media = Media::query()->whereKey($id)->where('owner_user_id', $user->getKey())
                ->where('visibility', Media::VISIBILITY_PRIVATE)->where('status', Media::STATUS_ACTIVE)->first();
            if ($media === null || ($media->metadata['purpose'] ?? null) !== 'ai') {
                throw new ApiErrorException('NOT_FOUND', 404, 'Attachment not found.');
            }
        }
        // No attachment bytes/URLs leave this boundary until a provider-specific, approved
        // transport is implemented; do not silently imply that the provider saw a file.
        if (($data['attachmentIds'] ?? []) !== []) {
            throw ApiErrorException::notConfigured('AI attachment transport');
        }
        if ($requestKey !== null && ! preg_match('/^[A-Za-z0-9_.:-]{8,100}$/D', $requestKey)) {
            throw ApiErrorException::invalid(['Idempotency-Key' => ['Invalid idempotency key.']]);
        }

        $requestHash = hash('sha256', json_encode([
            'message' => $data['message'], 'mode' => $data['mode'] ?? 'general',
            'conversationId' => $data['conversationId'] ?? null, 'attachmentIds' => $data['attachmentIds'] ?? [],
        ], JSON_THROW_ON_ERROR));

        [$userMessage, $usageDate, $replay] = DB::transaction(function () use ($user, $data, $requestKey, $requestHash, $conversation): array {
            // Lock the principal row: serializes quota reservations, even for distinct conversations.
            User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();
            if ($requestKey !== null) {
                $existing = AiMessage::query()->where('user_id', $user->getKey())->where('request_key', $requestKey)->first();
                if ($existing !== null) {
                    if (! hash_equals((string) $existing->request_hash, $requestHash)) {
                        throw new ApiErrorException('IDEMPOTENCY_CONFLICT', 409, 'Idempotency key was used with different input.');
                    }
                    $answer = AiMessage::query()->where('reply_to_id', $existing->getKey())->first();
                    if ($answer !== null && $existing->status === 'done') {
                        return [$existing, '', $this->payload($answer, (string) $existing->conversation_id)];
                    }
                    throw new ApiErrorException('AI_REQUEST_IN_PROGRESS', 409, 'Request already submitted.');
                }
            }
            $date = $this->quota->reserve($user);
            $conversation ??= (new AiConversation)->forceFill([
                'user_id' => $user->getKey(), 'status' => 'active', 'model_key' => config('ai.model_key'),
            ]);
            if (! $conversation->exists) {
                $conversation->save();
            }
            $message = new AiMessage;
            $message->forceFill([
                'conversation_id' => $conversation->getKey(), 'user_id' => $user->getKey(),
                'role' => 'user', 'content' => $data['message'], 'status' => 'pending',
                'request_key' => $requestKey, 'request_hash' => $requestHash, 'model_key' => config('ai.model_key'),
            ])->save();

            return [$message, $date, null];
        });
        if ($replay !== null) {
            return $replay;
        }

        try {
            $history = AiMessage::query()->where('conversation_id', $userMessage->conversation_id)
                ->where('status', 'done')->where('id', '!=', $userMessage->getKey())
                ->orderByDesc('created_at')->limit((int) config('ai.limits.history_messages'))
                ->get()->reverse()->map(fn (AiMessage $m): array => ['role' => $m->role, 'content' => $m->content])->values()->all();
            $context = $this->context->build($user, $data['mode'] ?? 'general');
            $answer = $this->provider->chat($data['message'], $context, $history);
            if (trim($answer->content) === '' || mb_strlen($answer->content) > (int) config('ai.limits.answer_chars')) {
                throw new ApiErrorException('AI_PROVIDER_UNAVAILABLE', 503, 'AI provider unavailable.');
            }
            return DB::transaction(function () use ($user, $userMessage, $answer): array {
                $reply = new AiMessage;
                $reply->forceFill([
                    'conversation_id' => $userMessage->conversation_id, 'user_id' => $user->getKey(),
                    'role' => 'assistant', 'reply_to_id' => $userMessage->getKey(),
                    'content' => $answer->content, 'status' => 'done', 'model_key' => config('ai.model_key'),
                    'provider_message_id' => $answer->providerMessageId,
                    'usage_input' => $answer->usageInput, 'usage_output' => $answer->usageOutput,
                ])->save();
                $userMessage->forceFill(['status' => 'done'])->save();
                AiConversation::query()->whereKey($userMessage->conversation_id)->update(['last_message_at' => now()]);
                return $this->payload($reply, (string) $userMessage->conversation_id);
            });
        } catch (Throwable $e) {
            // Never serialize or log the upstream exception: it can contain credentials/PII.
            DB::transaction(function () use ($user, $userMessage, $usageDate): void {
                User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();
                $userMessage->forceFill(['status' => 'failed', 'error_code' => 'AI_PROVIDER_UNAVAILABLE'])->save();
                $this->quota->release($user, $usageDate);
            });
            if ($e instanceof ApiErrorException && $e->errorCode === 'FEATURE_NOT_CONFIGURED') {
                throw $e;
            }
            throw new ApiErrorException('AI_PROVIDER_UNAVAILABLE', 503, 'AI provider unavailable.');
        }
    }

    private function payload(AiMessage $message, string $conversationId): array
    {
        return [
            'conversationId' => $conversationId,
            'message' => ['id' => $message->getKey(), 'role' => 'assistant', 'text' => $message->content, 'status' => 'done'],
        ];
    }
}
