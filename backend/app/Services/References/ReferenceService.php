<?php

namespace App\Services\References;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Models\Media;
use App\Models\Reference;
use App\Models\ReferenceAsset;
use App\Support\Content\RichTextSanitizer;
use Illuminate\Support\Facades\DB;

/**
 * چرخهٔ حیات Reference — فاز ۱۵.
 *
 * `sections` ساختار واقعی viewer است و `content` هر topic فقط از پاک‌ساز
 * whitelist عبور می‌کند (§29) — Stored XSS در محتوای مرجع همین‌جا بسته می‌شود.
 * سقف ساختاری (تعداد section/topic و طول محتوا) از config تا JSON عظیم شکل
 * نگیرد (§13).
 */
final class ReferenceService
{
    public function __construct(
        private readonly RichTextSanitizer $sanitizer,
    ) {}

    /** @param array<string, mixed> $data */
    public function create(Admin $author, array $data): Reference
    {
        $reference = new Reference;
        $reference->forceFill([
            'slug' => (string) $data['slug'],
            'title' => (string) $data['title'],
            'description' => $data['description'] ?? null,
            'status' => Reference::STATUS_DRAFT,
            'version' => 1,
            'author_admin_id' => $author->getKey(),
        ]);
        $reference->sections = $this->sanitizeSections($data['sections'] ?? null);
        $reference->save();

        return $reference;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<string>  $allowedFields
     */
    public function update(Admin $editor, Reference $reference, array $data, array $allowedFields = ['slug', 'title', 'description', 'sections']): Reference
    {
        $payload = array_intersect_key($data, array_flip($allowedFields));

        if (array_key_exists('expectedVersion', $data)) {
            if ((int) $data['expectedVersion'] !== (int) $reference->version) {
                throw new ApiErrorException('VERSION_CONFLICT', 409, 'The reference was modified by someone else.');
            }
        }

        if (array_key_exists('sections', $payload)) {
            $reference->sections = $this->sanitizeSections($payload['sections']);
            unset($payload['sections']);
        }

        foreach (['slug', 'title', 'description'] as $field) {
            if (array_key_exists($field, $payload)) {
                $reference->{$field} = $payload[$field];
            }
        }

        $reference->editor_admin_id = $editor->getKey();
        $reference->version = (int) $reference->version + 1;
        $reference->save();

        return $reference;
    }

    public function publish(Reference $reference): Reference
    {
        $reference->forceFill([
            'status' => Reference::STATUS_PUBLISHED,
            'published_at' => $reference->published_at ?? now(),
        ])->save();

        return $reference;
    }

    public function archive(Reference $reference): Reference
    {
        $reference->forceFill(['status' => Reference::STATUS_ARCHIVED])->save();

        return $reference;
    }

    /**
     * اتصال Media به مرجع. UNIQUE(reference_id, media_id) تکرار را در دیتابیس
     * می‌بندد؛ اینجا هم idempotent رفتار می‌کنیم.
     */
    public function attachAsset(Reference $reference, Media $media, ?string $key): ReferenceAsset
    {
        $existing = ReferenceAsset::query()
            ->where('reference_id', $reference->getKey())
            ->where('media_id', $media->getKey())
            ->first();

        if ($existing instanceof ReferenceAsset) {
            return $existing;
        }

        $asset = new ReferenceAsset;
        $asset->forceFill([
            'reference_id' => $reference->getKey(),
            'media_id' => $media->getKey(),
            'key' => $key,
        ]);
        $asset->save();

        return $asset;
    }

    public function detachAsset(Reference $reference, string $assetId): void
    {
        ReferenceAsset::query()
            ->where('reference_id', $reference->getKey())
            ->whereKey($assetId)
            ->delete();
    }

    /**
     * ساختار sections را validate و پاک‌سازی می‌کند.
     *
     * @return array<int, array<string, mixed>>|null
     */
    private function sanitizeSections(mixed $sections): ?array
    {
        if ($sections === null) {
            return null;
        }

        if (! is_array($sections)) {
            throw $this->invalidSections('sections must be a list.');
        }

        $maxSections = (int) config('references.max_sections');
        $maxTopics = (int) config('references.max_topics_per_section');
        $contentMax = (int) config('references.topic_content_max');

        if (count($sections) > $maxSections) {
            throw $this->invalidSections("sections may not have more than {$maxSections} items.");
        }

        $clean = [];

        foreach ($sections as $section) {
            if (! is_array($section) || ! isset($section['id'], $section['title'])) {
                throw $this->invalidSections('each section requires id and title.');
            }

            $topics = $section['topics'] ?? [];

            if (! is_array($topics) || count($topics) > $maxTopics) {
                throw $this->invalidSections("each section may not have more than {$maxTopics} topics.");
            }

            $cleanTopics = [];

            foreach ($topics as $topic) {
                if (! is_array($topic) || ! isset($topic['id'], $topic['title'])) {
                    throw $this->invalidSections('each topic requires id and title.');
                }

                $content = $topic['content'] ?? null;

                if ($content !== null && ! is_string($content)) {
                    throw $this->invalidSections('topic content must be a string.');
                }

                if ($content !== null && mb_strlen($content) > $contentMax) {
                    throw $this->invalidSections("topic content may not be longer than {$contentMax} characters.");
                }

                $cleanTopics[] = [
                    'id' => (string) $topic['id'],
                    'title' => (string) $topic['title'],
                    'content' => $content === null ? null : (string) $this->sanitizer->sanitize($content, 'rich'),
                ];
            }

            $clean[] = [
                'id' => (string) $section['id'],
                'title' => (string) $section['title'],
                'topics' => $cleanTopics,
            ];
        }

        return $clean;
    }

    private function invalidSections(string $message): ApiErrorException
    {
        return new ApiErrorException('VALIDATION_FAILED', 422, $message, ['sections' => [$message]]);
    }
}
