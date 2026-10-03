<?php

namespace App\Services\Ai;

/** Provider sees only an allowlisted educational read model, never identity or credentials. */
interface AiProvider
{
    /** @param array<string, mixed> $context @param list<array{role:string,content:string}> $history */
    public function chat(string $message, array $context, array $history): AiProviderAnswer;
}
