<?php

namespace Tests\Concerns;

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\User;

/**
 * ساخت دادهٔ فلش‌کارت برای تست — فاز ۹.
 *
 * چرا مستقیم روی مدل و نه از مسیر API: تست‌های امنیتی باید بتوانند حالتی را
 * بسازند که از مسیر API **ساختنی نیست** (مثلاً دک رسمی، دک آرشیو، کارت
 * آرشیو). اگر همه‌چیز از API ساخته شود، تست فقط همان چیزی را می‌سنجد که API
 * اجازه می‌دهد و مرزهای واقعی پنهان می‌مانند.
 */
trait BuildsFlashcards
{
    /** @param array<string, mixed> $payload */
    protected function signedInStudent(array $payload = []): array
    {
        $session = $this->register($payload);
        $session->assertCreated();

        $this->withAuthCookies($session);

        $phone = $payload['phone'] ?? '09123456789';
        $user = User::query()->where('phone', $phone)->firstOrFail();

        return ['user' => $user, 'session' => $session, 'csrf' => $this->csrfHeader($session)];
    }

    /** @param array<string, mixed> $attributes */
    protected function makeDeck(User $owner, array $attributes = []): FlashcardDeck
    {
        $deck = new FlashcardDeck;
        $deck->forceFill([
            'owner_user_id' => $owner->getKey(),
            'author_admin_id' => null,
            'title' => (string) ($attributes['title'] ?? 'دک شخصی'),
            'description' => $attributes['description'] ?? null,
            'status' => (string) ($attributes['status'] ?? FlashcardDeck::STATUS_DRAFT),
            'visibility' => (string) ($attributes['visibility'] ?? FlashcardDeck::VISIBILITY_PRIVATE),
            'version' => 1,
        ])->save();

        return $deck;
    }

    /** دک رسمی — `owner_user_id = null` و منتشرشده/عمومی. */
    protected function makeOfficialDeck(array $attributes = []): FlashcardDeck
    {
        $deck = new FlashcardDeck;
        $deck->forceFill([
            'owner_user_id' => null,
            'author_admin_id' => null,
            'title' => (string) ($attributes['title'] ?? 'دک رسمی تپش'),
            'description' => $attributes['description'] ?? null,
            'status' => (string) ($attributes['status'] ?? FlashcardDeck::STATUS_PUBLISHED),
            'visibility' => (string) ($attributes['visibility'] ?? FlashcardDeck::VISIBILITY_PUBLIC),
            'version' => 1,
            'published_at' => now(),
        ])->save();

        return $deck;
    }

    /** @param array<string, mixed> $attributes */
    protected function makeCard(FlashcardDeck $deck, array $attributes = []): Flashcard
    {
        $card = new Flashcard;
        $card->forceFill([
            'deck_id' => $deck->getKey(),
            'front' => (string) ($attributes['front'] ?? 'روی کارت'),
            'back' => (string) ($attributes['back'] ?? 'پشت کارت'),
            'position' => (int) ($attributes['position']
                ?? ((int) Flashcard::query()->where('deck_id', $deck->getKey())->max('position')) + 1),
            'status' => (string) ($attributes['status'] ?? Flashcard::STATUS_ACTIVE),
        ])->save();

        return $card;
    }

    /** @param array<string, mixed> $attributes */
    protected function makeCards(FlashcardDeck $deck, int $count, array $attributes = []): array
    {
        $cards = [];

        foreach (range(1, $count) as $index) {
            $cards[] = $this->makeCard($deck, [...$attributes, 'front' => 'کارت '.$index]);
        }

        return $cards;
    }
}
