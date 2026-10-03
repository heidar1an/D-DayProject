<?php

namespace App\Services\Ai;

use App\Exceptions\ApiErrorException;

final class UnconfiguredAiProvider implements AiProvider
{
    public function chat(string $message, array $context, array $history): AiProviderAnswer
    {
        throw ApiErrorException::notConfigured('AI provider');
    }
}
