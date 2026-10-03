<?php

namespace App\Services\Groups;

use App\Exceptions\ApiErrorException;
use App\Models\GroupMembership;
use App\Models\GroupRetiredCode;
use App\Models\StudyGroup;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Study Group — فاز ۱۶ (§37-§44).
 *
 * قواعد از UI واقعی: seats ۲–۳ (config)، هر کاربر حداکثر یک گروه فعال
 * (UNIQUE(user_id))، کد فقط hash و rotation بازنشسته‌ها را نگه می‌دارد.
 *
 * Join: تراکنش + lockForUpdate روی ردیف گروه ⇒ ظرفیت هرگز ترک نمی‌خورد؛
 * قید یکتا لایهٔ دوم دفاع است و INSERT شکست‌خورده در savepoint بسته می‌شود
 * (`25P02`).
 */
final class GroupService
{
    public function __construct(
        private readonly GroupCodeService $codes,
    ) {}

    /**
     * ساخت گروه. کد خام فقط در همین پاسخ برمی‌گردد.
     *
     * @return array{group: StudyGroup, code: string}
     */
    public function create(User $owner, int $seats): array
    {
        $seatsMin = (int) config('groups.seats.min');
        $seatsMax = (int) config('groups.seats.max');

        if ($seats < $seatsMin || $seats > $seatsMax) {
            throw new ApiErrorException('VALIDATION_FAILED', 422, "seats must be between {$seatsMin} and {$seatsMax}.", ['seats' => ["seats must be between {$seatsMin} and {$seatsMax}."]]);
        }

        try {
            return DB::transaction(function () use ($owner, $seats): array {
                $generated = $this->codes->generateWithHash();

                $group = new StudyGroup;
                $group->forceFill([
                    'owner_user_id' => $owner->getKey(),
                    'code_hash' => $generated['hash'],
                    'plan_id' => config('groups.default_plan_id'),
                    'seats' => $seats,
                    'status' => StudyGroup::STATUS_ACTIVE,
                ]);
                $group->save();

                $membership = new GroupMembership;
                $membership->forceFill([
                    'group_id' => $group->getKey(),
                    'user_id' => $owner->getKey(),
                    'role' => GroupMembership::ROLE_OWNER,
                ]);
                $membership->save();

                return ['group' => $group, 'code' => $generated['code']];
            });
        } catch (UniqueConstraintViolationException) {
            // کاربر از قبل عضو گروهی است (تک‌گروهی) یا برخورد کد — کد تصادفی است،
            // پس اینجا یعنی membership.
            throw new ApiErrorException('ALREADY_IN_GROUP', 409, 'You are already a member of a group.');
        }
    }

    /**
     * عضویت با کد. ۴۰۴ برای کد ناموجود (وجود گروه افشا نمی‌شود) و ۴۰۹ برای
     * کد بازنشسته/گروه پر/عضویت تکراری/گروه دیگر.
     */
    public function joinByCode(User $user, string $rawCode): StudyGroup
    {
        $normalized = $this->codes->normalize($rawCode);
        $this->codes->assertFormat($normalized);
        $hash = $this->codes->hash($normalized);

        return DB::transaction(function () use ($user, $hash): StudyGroup {
            /** @var StudyGroup|null */
            $group = StudyGroup::query()
                ->where('code_hash', $hash)
                ->lockForUpdate()
                ->first();

            if ($group === null) {
                // کد به هیچ کد فعال تعلق ندارد — یا بازنشده است (۴۰۹) یا ناموجود
                // (۴۰۴). تفکیک این دو از جدول retiredها می‌آید، نه از حدس.
                $retired = GroupRetiredCode::query()
                    ->where('code_hash', $hash)
                    ->lockForUpdate()
                    ->exists();

                if ($retired) {
                    throw new ApiErrorException('GROUP_CODE_RETIRED', 409, 'This code has been retired.');
                }

                throw new ApiErrorException('GROUP_CODE_NOT_FOUND', 404, 'No active group matches this code.');
            }

            if ($group->status !== StudyGroup::STATUS_ACTIVE) {
                throw new ApiErrorException('GROUP_CODE_NOT_FOUND', 404, 'No active group matches this code.');
            }

            $memberCount = (int) $group->memberships()->count();

            if ($memberCount >= (int) $group->seats) {
                throw new ApiErrorException('GROUP_FULL', 409, 'This group is full.');
            }

            $membership = new GroupMembership;
            $membership->forceFill([
                'group_id' => $group->getKey(),
                'user_id' => $user->getKey(),
                'role' => GroupMembership::ROLE_MEMBER,
            ]);

            try {
                /* INSERT در savepoint و گرفتن استثنا بیرون از آن. بدون savepoint،
                   شکستِ UNIQUE در PG تراکنش بیرونی را abort می‌کرد (`25P02`) و
                   کوئری `exists()` پایین می‌ترکید. */
                DB::transaction(function () use ($membership): void {
                    $membership->save();
                });
            } catch (UniqueConstraintViolationException) {
                $alreadyHere = GroupMembership::query()
                    ->where('group_id', $group->getKey())
                    ->where('user_id', $user->getKey())
                    ->exists();

                if ($alreadyHere) {
                    throw new ApiErrorException('ALREADY_MEMBER', 409, 'You are already a member of this group.');
                }

                throw new ApiErrorException('ALREADY_IN_GROUP', 409, 'You are already a member of a group.');
            }

            return $group;
        });
    }

    /**
     * بازچرخش کد — atomic: هش تازه جایگزین می‌شود و هش کهنه به retired می‌رود
     * (§44). کد تازه فقط یک‌بار در پاسخ می‌آید.
     *
     * @return array{group: StudyGroup, code: string}
     */
    public function rotateCode(User $owner, StudyGroup $group): array
    {
        return DB::transaction(function () use ($owner, $group): array {
            /** @var StudyGroup */
            $locked = StudyGroup::query()->whereKey($group->getKey())->lockForUpdate()->firstOrFail();

            $this->assertOwner($owner, $locked);

            $generated = $this->codes->generateWithHash();

            (new GroupRetiredCode)->forceFill([
                'group_id' => $locked->getKey(),
                'code_hash' => (string) $locked->code_hash,
            ])->save();

            // سقف نگه‌داری کدهای بازنشده (config) — کهنه‌ترین‌ها آزاد می‌شوند.
            $keep = (int) config('groups.code.retired_keep');
            $stale = GroupRetiredCode::query()
                ->where('group_id', $locked->getKey())
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->pluck('id')
                ->slice($keep)
                ->values();

            if ($stale->isNotEmpty()) {
                GroupRetiredCode::query()->whereIn('id', $stale->all())->delete();
            }

            $locked->forceFill([
                'code_hash' => $generated['hash'],
            ])->save();

            return ['group' => $locked, 'code' => $generated['code']];
        });
    }

    /** اخراج عضو توسط میزبان. */
    public function kick(User $owner, StudyGroup $group, string $memberId): void
    {
        if ((string) $memberId === (string) $owner->getKey()) {
            throw new ApiErrorException('NOT_ALLOWED', 422, 'The owner cannot kick themselves.');
        }

        $this->assertOwner($owner, $group);

        $deleted = GroupMembership::query()
            ->where('group_id', $group->getKey())
            ->where('user_id', $memberId)
            ->delete();

        if ($deleted === 0) {
            throw new ApiErrorException('NOT_MEMBER', 404, 'That user is not a member of this group.');
        }
    }

    /**
     * خروج عضو. میزبان فقط وقتی تنهاست می‌تواند خارج شود — گروه آرشیو و
     * membershipها آزاد می‌شوند.
     */
    public function leave(User $user, StudyGroup $group): void
    {
        DB::transaction(function () use ($user, $group): void {
            /** @var StudyGroup */
            $locked = StudyGroup::query()->whereKey($group->getKey())->lockForUpdate()->firstOrFail();

            $membership = GroupMembership::query()
                ->where('group_id', $locked->getKey())
                ->where('user_id', $user->getKey())
                ->first();

            if (! $membership instanceof GroupMembership) {
                throw new ApiErrorException('NOT_MEMBER', 404, 'You are not a member of this group.');
            }

            $isOwner = $membership->role === GroupMembership::ROLE_OWNER;
            $memberCount = (int) $locked->memberships()->count();

            if ($isOwner && $memberCount > 1) {
                throw new ApiErrorException('GROUP_OWNER_LEAVE', 409, 'The owner cannot leave while other members are in the group.');
            }

            if ($isOwner) {
                $locked->forceFill(['status' => StudyGroup::STATUS_ARCHIVED])->save();
            }

            $membership->delete();
        });
    }

    /** گروه‌های کاربر جاری. */
    public function groupsOf(User $user): array
    {
        return GroupMembership::query()
            ->where('user_id', $user->getKey())
            ->with(['group.owner:id,phone', 'group.memberships'])
            ->get()
            ->all();
    }

    public function assertMember(User $user, StudyGroup $group): GroupMembership
    {
        /** @var GroupMembership|null */
        $membership = GroupMembership::query()
            ->where('group_id', $group->getKey())
            ->where('user_id', $user->getKey())
            ->first();

        if (! $membership instanceof GroupMembership) {
            // ۴۰۴ نه ۴۰۳: وجود گروه برای غریبه‌ها افشا نمی‌شود.
            throw new ApiErrorException('NOT_FOUND', 404, 'Group not found.');
        }

        return $membership;
    }

    private function assertOwner(User $user, StudyGroup $group): void
    {
        $isOwner = GroupMembership::query()
            ->where('group_id', $group->getKey())
            ->where('user_id', $user->getKey())
            ->where('role', GroupMembership::ROLE_OWNER)
            ->exists();

        if (! $isOwner) {
            throw new ApiErrorException('NOT_OWNER', 403, 'Only the group owner can do this.');
        }
    }
}
