<?php

namespace App\Services\Flashcards;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\User;
use App\Support\Content\RichTextSanitizer;
use Illuminate\Support\Facades\DB;

/**
 * چرخهٔ عمر دک — تنها نویسندهٔ `flashcard_decks`.
 *
 * مرز مالکیت:
 *   • دک شخصی: `owner_user_id` از **سشن** پر می‌شود، هرگز از بدنه.
 *   • دک رسمی: فقط از مسیر ادمین ساخته می‌شود و `owner_user_id = null`.
 *
 * چرا حذف فیزیکی محدود است: `flashcards.deck_id` روی `RESTRICT` است و سرویس هم
 * پیش از حذف تعداد کارت‌ها را می‌شمارد ⇒ «مرور پس از حذف دک» هرگز رکورد یتیم
 * نمی‌سازد. مسیر پیشنهادی برای دک استفاده‌شده، `archive` است.
 */
class FlashcardDeckService
{
    public function __construct(private readonly RichTextSanitizer $sanitizer) {}

    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): FlashcardDeck
    {
        $deck = new FlashcardDeck;
        $deck->forceFill([
            'owner_user_id' => $user->getKey(),
            'author_admin_id' => null,
            'title' => $this->title((string) $data['title']),
            'description' => $this->description($data['description'] ?? null),
            'status' => FlashcardDeck::STATUS_DRAFT,
            'visibility' => FlashcardDeck::VISIBILITY_PRIVATE,
            'version' => 1,
        ])->save();

        return $deck;
    }

    /**
     * آپدیت دک شخصی. `status`/`visibility`/`version` از سرویس مدیریت می‌شوند.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(FlashcardDeck $deck, array $data): FlashcardDeck
    {
        if ($deck->isOfficial()) {
            // لایهٔ دوم دفاعی؛ Policy باید اول جلوی این را گرفته باشد.
            throw ApiErrorException::forbidden('Official decks cannot be edited by users.');
        }

        $expected = $data['version'] ?? null;

        if ($expected !== null && (int) $expected !== (int) $deck->version) {
            throw new ApiErrorException('VERSION_CONFLICT', 409, 'The deck was modified by another request.');
        }

        $attributes = [];

        if (array_key_exists('title', $data)) {
            $attributes['title'] = $this->title((string) $data['title']);
        }

        if (array_key_exists('description', $data)) {
            $attributes['description'] = $this->description($data['description']);
        }

        if (array_key_exists('visibility', $data)) {
            $attributes['visibility'] = (string) $data['visibility'];
        }

        if (array_key_exists('status', $data)) {
            $status = (string) $data['status'];

            if (! in_array($status, (array) config('flashcards.decks.statuses'), true)) {
                throw new ApiErrorException('DECK_STATUS_INVALID', 422, 'Unknown deck status.', ['status' => ['DECK_STATUS_INVALID']]);
            }

            $attributes['status'] = $status;
            $attributes['published_at'] = $status === FlashcardDeck::STATUS_PUBLISHED ? ($deck->published_at ?? now()) : null;
        }

        if ($attributes === []) {
            return $deck;
        }

        $attributes['version'] = (int) $deck->version + 1;

        $deck->forceFill($attributes)->save();

        return $deck;
    }

    /** آرشیو نرم — دک و کارت‌هایش باقی می‌مانند ولی از دسترس کاربر خارج می‌شوند. */
    public function archive(FlashcardDeck $deck): FlashcardDeck
    {
        $deck->forceFill([
            'status' => FlashcardDeck::STATUS_ARCHIVED,
            'published_at' => null,
            'version' => (int) $deck->version + 1,
        ])->save();

        return $deck;
    }

    /**
     * حذف فیزیکی — فقط دک **خالی**.
     *
     * اگر کارتی وجود داشته باشد ۴۰۹ می‌دهد (نه حذف آبشاری). دلیل: هر کارتی ممکن
     * است تاریخچهٔ مرور داشته باشد و تاریخچه immutable است.
     */
    public function delete(FlashcardDeck $deck): void
    {
        $cards = Flashcard::query()->where('deck_id', $deck->getKey())->count();

        if ($cards > 0) {
            throw new ApiErrorException(
                'DECK_NOT_EMPTY',
                409,
                'This deck still has cards; archive it instead of deleting.',
            );
        }

        $deck->delete();
    }

    /**
     * کلون دک رسمی → دک شخصی.
     *
     * فقط وقتی کارت‌های دک رسمی به کتابخانهٔ کاربر اضافه می‌شوند که کاربر
     * بخواهد؛ این عملیات هیچ‌وقت دک رسمی را تغییر نمی‌دهد. کلون شامل
     * **تاریخچهٔ مرور نیست** — کارت‌های تازه وضعیت نو دارند.
     */
    public function clone(User $user, FlashcardDeck $source, ?string $title = null): FlashcardDeck
    {
        return DB::transaction(function () use ($user, $source, $title): FlashcardDeck {
            $deck = new FlashcardDeck;
            $deck->forceFill([
                'owner_user_id' => $user->getKey(),
                'author_admin_id' => null,
                'title' => $this->title($title ?? $source->title),
                'description' => $source->description,
                'status' => FlashcardDeck::STATUS_DRAFT,
                'visibility' => FlashcardDeck::VISIBILITY_PRIVATE,
                'version' => 1,
            ])->save();

            $position = 0;

            foreach ($source->cards()->where('status', Flashcard::STATUS_ACTIVE)->orderBy('position')->cursor() as $card) {
                $position++;
                $clone = new Flashcard;
                $clone->forceFill([
                    'deck_id' => $deck->getKey(),
                    'front' => $card->front,
                    'back' => $card->back,
                    'position' => $position,
                    'status' => Flashcard::STATUS_ACTIVE,
                ])->save();
            }

            return $deck;
        });
    }

    /** @param array<string, mixed> $data */
    public function adminCreate(Admin $admin, array $data): FlashcardDeck
    {
        $deck = new FlashcardDeck;
        $deck->forceFill([
            'owner_user_id' => null,
            'author_admin_id' => $admin->getKey(),
            'title' => $this->title((string) $data['title']),
            'description' => $this->description($data['description'] ?? null),
            'status' => FlashcardDeck::STATUS_DRAFT,
            'visibility' => FlashcardDeck::VISIBILITY_PUBLIC,
            'version' => 1,
        ])->save();

        return $deck;
    }

    /**
     * آپدیت دک رسمی — `owner_user_id` و `author_admin_id` دست‌نخورده می‌مانند.
     *
     * @param  array<string, mixed>  $data
     */
    public function adminUpdate(FlashcardDeck $deck, array $data): FlashcardDeck
    {
        if (! $deck->isOfficial()) {
            throw ApiErrorException::forbidden('Personal decks are not editable from the admin surface.');
        }

        $expected = $data['version'] ?? null;

        if ($expected !== null && (int) $expected !== (int) $deck->version) {
            throw new ApiErrorException('VERSION_CONFLICT', 409, 'The deck was modified by another request.');
        }

        $attributes = [];

        if (array_key_exists('title', $data)) {
            $attributes['title'] = $this->title((string) $data['title']);
        }

        if (array_key_exists('description', $data)) {
            $attributes['description'] = $this->description($data['description']);
        }

        if ($attributes === []) {
            return $deck;
        }

        $attributes['version'] = (int) $deck->version + 1;

        $deck->forceFill($attributes)->save();

        return $deck;
    }

    public function publish(FlashcardDeck $deck): FlashcardDeck
    {
        $deck->forceFill([
            'status' => FlashcardDeck::STATUS_PUBLISHED,
            'published_at' => $deck->published_at ?? now(),
            'version' => (int) $deck->version + 1,
        ])->save();

        return $deck;
    }

    /** پاک‌سازی متن: عنوان دک متن ساده است، نه HTML. */
    private function title(string $title): string
    {
        $clean = $this->sanitizer->toPlainText($title) ?? '';

        if ($clean === '') {
            throw new ApiErrorException('DECK_TITLE_REQUIRED', 422, 'Deck title is required.', ['title' => ['DECK_TITLE_REQUIRED']]);
        }

        return $clean;
    }

    private function description(mixed $description): ?string
    {
        if ($description === null || $description === '') {
            return null;
        }

        return $this->sanitizer->toPlainText((string) $description);
    }
}
