<?php

namespace Tests\Feature\Groups;

use App\Models\GroupMembership;
use App\Models\StudyGroup;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsWiki;
use Tests\TestCase;

/**
 * Study Groups — فاز ۱۶ (§37-§44/§61/§68).
 *
 * کد فقط hash می‌نشیند و فقط یک‌بار دیده می‌شود؛ ظرفیت هرگز ترک نمی‌خورد
 * (قید دیتابیس + قفل ردیفی)؛ کد بازنشسته دوباره کار نمی‌کند؛ مالکیت قابل
 * جعل نیست.
 */
final class GroupsTest extends TestCase
{
    use BuildsWiki, RefreshDatabase;

    /** گروهی با میزبانِ واردشده می‌سازد و [پاسخ، میزبان] برمی‌گرداند. */
    private function createGroup(int $seats = 3): array
    {
        $owner = $this->signedInStudent(['phone' => '09'.random_int(100000000, 999999999)]);

        $response = $this->postJsonWithOrigin('/api/v1/groups', ['seats' => $seats], $owner['csrf'])
            ->assertCreated();

        return [$response, $owner];
    }

    public function test_owner_creates_group_code_returned_once_and_never_stored(): void
    {
        [$response, $owner] = $this->createGroup(2);

        $code = (string) $response->json('data.code');
        $groupId = (string) $response->json('data.group.id');

        $this->assertMatchesRegularExpression('/^TP[A-Z2-9]{6}$/', $code);
        $this->assertSame(2, (int) $response->json('data.group.seats'));

        $group = StudyGroup::query()->findOrFail($groupId);
        $this->assertSame(hash('sha256', $code), $group->code_hash);
        $this->assertDatabaseMissing('study_groups', ['code_hash' => $code]);
        $this->assertSame(1, $group->memberships()->count());

        // در جزئیات گروه هم کدِ ذخیره‌شده serialize نمی‌شود.
        $detail = $this->getJson("/api/v1/groups/{$groupId}");
        $detail->assertOk();
        $this->assertArrayNotHasKey('code', (array) $detail->json('data.group'));
        $this->assertArrayNotHasKey('code_hash', (array) $detail->json('data.group'));
    }

    public function test_seats_must_be_between_2_and_3(): void
    {
        $owner = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/groups', ['seats' => 1], $owner['csrf'])->assertFieldError('seats');
        $this->postJsonWithOrigin('/api/v1/groups', ['seats' => 5], $owner['csrf'])->assertFieldError('seats');
    }

    public function test_join_flow_with_code_normalization(): void
    {
        [$created, $owner] = $this->createGroup(3);
        $code = (string) $created->json('data.code');

        $joiner = $this->signedInStudent(['phone' => '09511111111']);

        // همان کد با فاصله/خط‌تیره/حروف کوچک — قرارداد نرمال‌سازی فرانت.
        // تفکیک بدون هم‌پوشانی: [0,2) | [2,5) | [5,8).
        $sloppy = strtolower(substr($code, 0, 2)).'-'.substr($code, 2, 3).' '.substr($code, 5);

        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => $sloppy], $joiner['csrf'])
            ->assertOk()
            ->assertJsonPath('data.group.id', $created->json('data.group.id'));

        $this->assertSame(2, StudyGroup::query()->findOrFail((string) $created->json('data.group.id'))->memberships()->count());
    }

    public function test_capacity_is_never_broken(): void
    {
        [$created, $owner] = $this->createGroup(2);
        $code = (string) $created->json('data.code');
        $groupId = (string) $created->json('data.group.id');

        $first = $this->signedInStudent(['phone' => '09522222222']);
        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => $code], $first['csrf'])->assertOk();

        // ظرفیت پر شد — نفر سوم ۴۰۹ می‌گیرد.
        $this->forgetCookies();
        $second = $this->signedInStudent(['phone' => '09533333333']);
        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => $code], $second['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'GROUP_FULL');

        $this->assertSame(2, StudyGroup::query()->findOrFail($groupId)->memberships()->count());
    }

    public function test_duplicate_join_and_second_group_are_rejected(): void
    {
        [$created, $owner] = $this->createGroup(3);
        $code = (string) $created->json('data.code');

        $joiner = $this->signedInStudent(['phone' => '09544444444']);
        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => $code], $joiner['csrf'])->assertOk();

        // عضویت تکراری در همان گروه.
        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => $code], $joiner['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ALREADY_MEMBER');

        // عضویت در گروه دوم — قاعدهٔ UI: هر کاربر یک گروه فعال.
        // createGroup سشن کلاینت را به میزبان تازه برمی‌گرداند؛ کوکی‌های joiner
        // باید دوباره بسته شوند وگرنه درخواست با سشن اشتباه و ۴۰۳ CSRF می‌رود.
        [$second] = $this->createGroup(3);
        $secondCode = (string) $second->json('data.code');

        $this->withAuthCookies($joiner['session']);

        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => $secondCode], $joiner['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ALREADY_IN_GROUP');
    }

    public function test_rotation_retires_old_code(): void
    {
        [$created, $owner] = $this->createGroup(3);
        $oldCode = (string) $created->json('data.code');
        $groupId = (string) $created->json('data.group.id');

        $rotated = $this->postJsonWithOrigin("/api/v1/groups/{$groupId}/rotate-code", [], $owner['csrf'])->assertOk();
        $newCode = (string) $rotated->json('data.code');

        $this->assertNotSame($oldCode, $newCode);

        // کد کهنه دیگر کار نمی‌کند و پیام مشخص «بازنشسته» می‌دهد.
        $joiner = $this->signedInStudent(['phone' => '09555555555']);
        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => $oldCode], $joiner['csrf'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'GROUP_CODE_RETIRED');

        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => $newCode], $joiner['csrf'])->assertOk();
    }

    public function test_only_owner_can_rotate_or_kick(): void
    {
        [$created, $owner] = $this->createGroup(3);
        $groupId = (string) $created->json('data.group.id');
        $code = (string) $created->json('data.code');

        $member = $this->signedInStudent(['phone' => '09566666666']);
        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => $code], $member['csrf'])->assertOk();

        $this->postJsonWithOrigin("/api/v1/groups/{$groupId}/rotate-code", [], $member['csrf'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'NOT_OWNER');

        $this->deleteJsonWithOrigin("/api/v1/groups/{$groupId}/members/{$owner['user']->getKey()}", [], $member['csrf'])
            ->assertStatus(403);
    }

    public function test_owner_cannot_kick_themselves_and_cannot_leave_with_members(): void
    {
        [$created, $owner] = $this->createGroup(3);
        $groupId = (string) $created->json('data.group.id');
        $code = (string) $created->json('data.code');

        $member = $this->signedInStudent(['phone' => '09577777777']);
        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => $code], $member['csrf'])->assertOk();

        // عضویت member کوکی‌های کلاینت را عوض کرد؛ هر actor با کوکی خودش.
        $this->withAuthCookies($owner['session']);

        $this->deleteJsonWithOrigin("/api/v1/groups/{$groupId}/members/{$owner['user']->getKey()}", [], $owner['csrf'])
            ->assertStatus(422);

        $this->postJsonWithOrigin("/api/v1/groups/{$groupId}/leave", [], $owner['csrf'])
            ->assertStatus(409);

        // عضو خارج می‌شود؛ بعد میزبانِ تنها می‌تواند خارج شود (گروه آرشیو).
        $this->withAuthCookies($member['session']);
        $this->postJsonWithOrigin("/api/v1/groups/{$groupId}/leave", [], $member['csrf'])->assertNoContent();

        $this->withAuthCookies($owner['session']);
        $this->postJsonWithOrigin("/api/v1/groups/{$groupId}/leave", [], $owner['csrf'])->assertNoContent();

        $this->assertSame('archived', StudyGroup::query()->findOrFail($groupId)->status);
        $this->assertSame(0, GroupMembership::query()->count());
    }

    public function test_non_member_cannot_see_group(): void
    {
        [$created] = $this->createGroup(3);
        $groupId = (string) $created->json('data.group.id');

        $outsider = $this->signedInStudent(['phone' => '09588888888']);

        $this->getJson("/api/v1/groups/{$groupId}")->assertNotFound();
    }

    public function test_unique_user_membership_is_enforced_by_database(): void
    {
        [$created, $owner] = $this->createGroup(3);
        $group = StudyGroup::query()->findOrFail((string) $created->json('data.group.id'));

        $this->expectException(UniqueConstraintViolationException::class);

        $row = new GroupMembership;
        $row->forceFill([
            'group_id' => $group->getKey(),
            'user_id' => $owner['user']->getKey(),
            'role' => 'member',
        ]);
        $row->save();
    }

    public function test_invalid_code_format_is_422_and_unknown_is_404(): void
    {
        $student = $this->signedInStudent();

        // فرمت کد در سرویس (بعد از نرمال‌سازی) چک می‌شود — کد دامنهٔ مشخص می‌دهد.
        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => 'SHORT'], $student['csrf'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'GROUP_CODE_FORMAT')
            ->assertJsonStructure(['error' => ['fields' => ['code']]]);

        $this->postJsonWithOrigin('/api/v1/groups/join', ['code' => 'TPAAAAAA'], $student['csrf'])
            ->assertNotFound();
    }
}
