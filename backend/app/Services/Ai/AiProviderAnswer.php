<?php

namespace App\Services\Ai;

final readonly class AiProviderAnswer
{
    public function __construct(
        public string $content,
        public ?string $providerMessageId = null,
        public ?int $usageInput = null,
        public ?int $usageOutput = null,
    ) {}
}
