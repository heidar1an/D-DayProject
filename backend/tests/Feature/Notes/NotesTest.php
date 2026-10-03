<?php

namespace Tests\Feature\Notes;

use App\Models\ReviewItem;
use App\Models\UserNote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsWiki;
use Tests\TestCase;

/**
 * یادداشت شخصی + مرور G5 — فاز ۱۶ (§31-§36/§61/§68).
 *
 * IDOR: یادداشت/آیتم مرورِ کاربر دیگر برای کاربر سشن اصلاً وجود ندارد (۴۰۴).
 * مالکیت هرگز از بدنه نمی‌آید و source_type از allowlist رد می‌شود.
 */
final class NotesTest extends TestCase
{
    use BuildsWiki, RefreshDatabase;

    /** @return array<string, mixed> */
    private function notePayload(array $overrides = []): array
    {
        return [
            'kind' => 'text',
            'title' => 'نکتهٔ قلب',
            'body' => 'دندهٔ چهارم — مرکز قلب',
            'subjectId' => 'anatomy',
            'tags' => ['قلب', 'آناتومی'],
            'color' => '#5b8cc7',
            ...$overrides,
        ];
    }

    public function test_user_crud_note(): void
    {
        $student = $this->signedInStudent();

        $created = $this->postJsonWithOrigin('/api/v1/me/notes', $this->notePayload(), $student['csrf'])
            ->assertCreated()
            ->assertJsonPath('data.note.kind', 'text')
            ->assertJsonPath('data.note.pinned', false);

        $noteId = $created->json('data.note.id');

        $this->patchJsonWithOrigin("/api/v1/me/notes/{$noteId}", [
            'pinned' => true,
            'body' => 'به‌روزشده',
        ], $student['csrf'])->assertOk();

        $note = UserNote::query()->findOrFail($noteId);
        $this->assertTrue($note->pinned);
        $this->assertSame('به‌روزشده', $note->body);

        // فهرست: سنجاق‌ها بالا.
        $this->getJson('/api/v1/me/notes')
            ->assertOk()
            ->assertJsonPath('data.notes.0.id', $noteId);

        $this->deleteJsonWithOrigin("/api/v1/me/notes/{$noteId}", [], $student['csrf'])
            ->assertNoContent();

        $this->assertSame(0, UserNote::query()->count());
    }

    public function test_notes_are_private_idor_is_closed(): void
    {
        $owner = $this->signedInStudent(['phone' => '09311111111']);
        $created = $this->postJsonWithOrigin('/api/v1/me/notes', $this->notePayload(), $owner['csrf'])->assertCreated();
        $noteId = $created->json('data.note.id');

        $this->forgetCookies();
        $attacker = $this->signedInStudent(['phone' => '09322222222']);

        $this->getJson('/api/v1/me/notes')->assertOk()->assertJsonCount(0, 'data.notes');
        $this->patchJsonWithOrigin("/api/v1/me/notes/{$noteId}", ['body' => 'خرابکاری'], $attacker['csrf'])->assertNotFound();
        $this->deleteJsonWithOrigin("/api/v1/me/notes/{$noteId}", [], $attacker['csrf'])->assertNotFound();

        // هیچ تغییری رخ نداده.
        $this->assertSame('دندهٔ چهارم — مرکز قلب', UserNote::query()->findOrFail($noteId)->body);
    }

    public function test_user_id_from_body_is_ignored(): void
    {
        $student = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/me/notes', [
            ...$this->notePayload(),
            'userId' => '00000000-0000-0000-0000-000000000000',
        ], $student['csrf'])->assertCreated();

        $note = UserNote::query()->firstOrFail();
        $this->assertSame($student['user']->getKey(), (string) $note->user_id);
    }

    public function test_source_type_and_color_are_allowlisted(): void
    {
        $student = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/me/notes', $this->notePayload([
            'sourceType' => 'arbitrary-table',
        ]), $student['csrf'])->assertFieldError('sourceType');

        $this->postJsonWithOrigin('/api/v1/me/notes', $this->notePayload([
            'color' => '#ff00ff',
        ]), $student['csrf'])->assertFieldError('color');

        $ok = $this->postJsonWithOrigin('/api/v1/me/notes', $this->notePayload([
            'sourceType' => 'lesson',
            'sourceTitle' => 'درس اول',
            'kind' => 'checklist',
            'content' => ['items' => [['id' => 'i1', 'text' => 'مرحلهٔ اول', 'done' => false]]],
        ]), $student['csrf'])->assertCreated();

        $note = UserNote::query()->findOrFail($ok->json('data.note.id'));
        $this->assertSame('checklist', $note->kind);
        $this->assertSame('مرحلهٔ اول', $note->content['items'][0]['text']);
    }

    public function test_review_item_lifecycle_with_g5_progression(): void
    {
        $student = $this->signedInStudent();

        $created = $this->postJsonWithOrigin('/api/v1/me/review-items', [
            'sourceType' => 'course-unit',
            'sourceId' => 'unit-1',
            'title' => 'فصل گوارشی',
            'subject' => 'pathology',
            'activityType' => 'learning',
        ], $student['csrf'])->assertCreated()->assertJsonPath('data.item.stage', 1);

        $itemId = $created->json('data.item.id');

        // تکرار ثبت همان source — به‌روزرسانی، نه رکورد تازه (idempotent).
        $this->postJsonWithOrigin('/api/v1/me/review-items', [
            'sourceType' => 'course-unit',
            'sourceId' => 'unit-1',
            'title' => 'فصل گوارشی (ویراسته)',
            'activityType' => 'learning',
        ], $student['csrf'])->assertOk()->assertJsonPath('data.item.id', $itemId);

        $this->assertSame(1, ReviewItem::query()->count());

        // G5: پنج مرور تا تسلط؛ فاصله‌ها ۱/۲/۴/۸/۱۶ روز.
        foreach ([2, 3, 4, 5] as $expectedStage) {
            $response = $this->postJsonWithOrigin("/api/v1/me/review-items/{$itemId}/complete-review", [], $student['csrf'])->assertOk();
            $this->assertSame($expectedStage, (int) $response->json('data.item.stage'));
        }

        $final = $this->postJsonWithOrigin("/api/v1/me/review-items/{$itemId}/complete-review", [], $student['csrf'])
            ->assertOk()
            ->assertJsonPath('data.item.status', 'mastered');

        $this->assertNull($final->json('data.item.dueAt'));

        // restart از مرحلهٔ ۱.
        $this->postJsonWithOrigin("/api/v1/me/review-items/{$itemId}/restart", [], $student['csrf'])
            ->assertOk()
            ->assertJsonPath('data.item.stage', 1)
            ->assertJsonPath('data.item.status', 'active');
    }

    public function test_review_items_are_private_and_source_type_allowlisted(): void
    {
        $owner = $this->signedInStudent(['phone' => '09411111111']);

        $created = $this->postJsonWithOrigin('/api/v1/me/review-items', [
            'sourceType' => 'lesson',
            'title' => 'شبکهٔ نورونی',
            'activityType' => 'note',
        ], $owner['csrf'])->assertCreated();

        $itemId = $created->json('data.item.id');

        $this->postJsonWithOrigin('/api/v1/me/review-items', [
            'sourceType' => 'questions', // خارج از allowlist
            'title' => 'x',
            'activityType' => 'other',
        ], $owner['csrf'])->assertFieldError('sourceType');

        $this->forgetCookies();
        $attacker = $this->signedInStudent(['phone' => '09422222222']);

        $this->getJson('/api/v1/me/review-items')->assertOk()->assertJsonCount(0, 'data.items');
        $this->postJsonWithOrigin("/api/v1/me/review-items/{$itemId}/complete-review", [], $attacker['csrf'])->assertNotFound();
        $this->deleteJsonWithOrigin("/api/v1/me/review-items/{$itemId}", [], $attacker['csrf'])->assertNotFound();
    }

    public function test_duplicate_review_item_race_is_closed_by_database(): void
    {
        $student = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/me/review-items', [
            'sourceType' => 'lesson', 'title' => 'a', 'activityType' => 'other',
        ], $student['csrf'])->assertCreated();

        $item = ReviewItem::query()->firstOrFail();

        // قید UNIQUE(user_id, source_type, source_id) — لایهٔ دوم دفاع.
        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);

        $row = new ReviewItem;
        $row->forceFill([
            'user_id' => $item->user_id,
            'source_type' => $item->source_type,
            'source_id' => $item->source_id,
            'title' => 'b',
            'activity_type' => 'other',
            'stage' => 1,
            'status' => 'active',
            'learned_at' => now(),
        ]);
        $row->save();
    }
}
