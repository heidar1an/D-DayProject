<?php

namespace App\Services\Notes;

use App\Exceptions\ApiErrorException;
use App\Models\User;
use App\Models\UserNote;
use Illuminate\Support\Arr;

/**
 * یادداشت شخصی کاربر — فاز ۱۶ (§31-§34).
 *
 * مالکیت فقط از سشن؛ هیچ متدی userId نمی‌گیرد. `source_type` از allowlist
 * config می‌آید (§34) و بدنهٔ یادداشت **plain text** است — قرارداد رندر UI
 * متن است، پس HTML ذخیره نمی‌شود (§51).
 */
final class UserNoteService
{
    /** @return array<int, UserNote> */
    public function list(User $user): array
    {
        return UserNote::query()
            ->where('user_id', $user->getKey())
            ->orderByDesc('pinned')
            ->orderByDesc('updated_at')
            ->get()
            ->all();
    }

    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): UserNote
    {
        $note = new UserNote;
        $note->forceFill([
            'user_id' => $user->getKey(),
            'kind' => (string) ($data['kind'] ?? UserNote::KIND_TEXT),
            'title' => $this->plainOrNull($data['title'] ?? null, (int) config('notes.note.title_max')),
            'body' => $this->plainOrNull($data['body'] ?? null, (int) config('notes.note.body_max')),
            'content' => $this->validateContent($data),
            'subject_id' => $data['subjectId'] ?? null,
            'tags' => $this->validateTags($data['tags'] ?? null),
            'color' => $data['color'] ?? null,
            'pinned' => (bool) ($data['pinned'] ?? false),
        ]);
        $note->source_type = $data['sourceType'] ?? null;
        $note->source_id = isset($data['sourceId']) ? mb_substr((string) $data['sourceId'], 0, (int) config('notes.note.source_id_max')) : null;
        $note->source_title = $this->plainOrNull($data['sourceTitle'] ?? null, (int) config('notes.note.source_title_max'));
        $note->save();

        return $note;
    }

    /**
     * PATCH جزئی. یادداشتِ کاربر دیگر در همین کوئری پیدا نمی‌شود ⇒ ۴۰۴ (IDOR).
     *
     * @param array<string, mixed> $data
     */
    public function update(User $user, string $noteId, array $data): UserNote
    {
        /** @var UserNote|null */
        $note = UserNote::query()
            ->where('user_id', $user->getKey())
            ->whereKey($noteId)
            ->first();

        if (! $note instanceof UserNote) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Note not found.');
        }

        if (array_key_exists('kind', $data)) {
            $note->kind = (string) $data['kind'];
        }

        foreach (['title' => 'title', 'body' => 'body', 'subjectId' => 'subject_id', 'color' => 'color', 'sourceType' => 'source_type', 'sourceId' => 'source_id', 'sourceTitle' => 'source_title'] as $input => $column) {
            if (! array_key_exists($input, $data)) {
                continue;
            }

            if ($input === 'title') {
                $note->title = $this->plainOrNull($data[$input], (int) config('notes.note.title_max'));

                continue;
            }

            if ($input === 'body') {
                $note->body = $this->plainOrNull($data[$input], (int) config('notes.note.body_max'));

                continue;
            }

            if ($input === 'sourceTitle') {
                $note->source_title = $this->plainOrNull($data[$input], (int) config('notes.note.source_title_max'));

                continue;
            }

            $note->{$column} = $data[$input];
        }

        if (array_key_exists('pinned', $data)) {
            $note->pinned = (bool) $data['pinned'];
        }

        if (array_key_exists('tags', $data)) {
            $note->tags = $this->validateTags($data['tags']);
        }

        if (array_key_exists('content', $data)) {
            $note->content = $this->validateContent($data, (string) $note->kind);
        }

        $note->save();

        return $note;
    }

    public function delete(User $user, string $noteId): void
    {
        $deleted = UserNote::query()
            ->where('user_id', $user->getKey())
            ->whereKey($noteId)
            ->delete();

        if ($deleted === 0) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Note not found.');
        }
    }

    /** @param array<string, mixed> $data */
    private function validateContent(array $data, ?string $kind = null): ?array
    {
        $content = $data['content'] ?? null;

        if ($content === null) {
            return null;
        }

        if (! is_array($content)) {
            throw new ApiErrorException('VALIDATION_FAILED', 422, 'content must be an object.', ['content' => ['content must be an object.']]);
        }

        $kind ??= (string) ($data['kind'] ?? '');
        $itemMax = (int) config('notes.note.checklist_item_max');

        $clean = match ($kind) {
            UserNote::KIND_CHECKLIST => ['items' => $this->boundedList($content['items'] ?? [], (int) config('notes.note.checklist_items_max'), ['id', 'text', 'done'], $itemMax)],
            UserNote::KIND_QA => ['pairs' => $this->boundedList($content['pairs'] ?? [], (int) config('notes.note.qa_pairs_max'), ['id', 'question', 'answer'], $itemMax)],
            UserNote::KIND_TABLE => $this->tableContent($content),
            default => ['text' => $this->plainOrNull($content['text'] ?? null, (int) config('notes.note.body_max'))],
        };

        return $clean;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function boundedList(mixed $items, int $max, array $keys, int $textMax): array
    {
        if (! is_array($items)) {
            throw new ApiErrorException('VALIDATION_FAILED', 422, 'content items must be a list.', ['content' => ['content items must be a list.']]);
        }

        if (count($items) > $max) {
            throw new ApiErrorException('VALIDATION_FAILED', 422, "content may not have more than {$max} items.", ['content' => ["content may not have more than {$max} items."]]);
        }

        $clean = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $row = ['id' => (string) ($item['id'] ?? '')];

            foreach ($keys as $key) {
                if (! array_key_exists($key, $row) && isset($item[$key]) && is_string($item[$key])) {
                    $row[$key] = mb_substr($item[$key], 0, $textMax);
                }
            }

            if (isset($item['done'])) {
                $row['done'] = (bool) $item['done'];
            }

            $clean[] = $row;
        }

        return $clean;
    }

    /** @return array<string, mixed> */
    private function tableContent(array $content): array
    {
        $columns = [];

        foreach (Arr::wrap($content['columns'] ?? []) as $column) {
            if (! is_array($column) || ! isset($column['id'], $column['label'])) {
                continue;
            }

            $columns[] = ['id' => (string) $column['id'], 'label' => mb_substr((string) $column['label'], 0, (int) config('notes.note.checklist_item_max'))];

            if (count($columns) >= (int) config('notes.note.table_columns_max')) {
                break;
            }
        }

        $rows = [];

        foreach (Arr::wrap($content['rows'] ?? []) as $row) {
            if (! is_array($row) || ! isset($row['id'])) {
                continue;
            }

            $cells = [];

            foreach (Arr::wrap($row['cells'] ?? []) as $columnId => $cell) {
                $cells[(string) $columnId] = mb_substr((string) $cell, 0, (int) config('notes.note.checklist_item_max'));
            }

            $rows[] = ['id' => (string) $row['id'], 'cells' => $cells];

            if (count($rows) >= (int) config('notes.note.table_rows_max')) {
                break;
            }
        }

        return ['columns' => $columns, 'rows' => $rows];
    }

    /** @return list<string>|null */
    private function validateTags(mixed $tags): ?array
    {
        if ($tags === null) {
            return null;
        }

        if (! is_array($tags)) {
            throw new ApiErrorException('VALIDATION_FAILED', 422, 'tags must be a list.', ['tags' => ['tags must be a list.']]);
        }

        $clean = [];

        foreach ($tags as $tag) {
            if (! is_string($tag) || trim($tag) === '') {
                continue;
            }

            $clean[] = mb_substr(trim($tag), 0, (int) config('notes.note.tag_max'));

            if (count($clean) >= (int) config('notes.note.tags_max')) {
                break;
            }
        }

        return array_values(array_unique($clean));
    }

    private function plainOrNull(mixed $value, int $max): ?string
    {
        if ($value === null) {
            return null;
        }

        return mb_substr((string) $value, 0, $max);
    }
}
