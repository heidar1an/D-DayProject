<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Groups\CreateGroupRequest;
use App\Http\Requests\Groups\JoinGroupRequest;
use App\Models\GroupMembership;
use App\Models\StudyGroup;
use App\Services\Groups\GroupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * گروه‌های مطالعه — فاز ۱۶ (§40-§44).
 *
 *   POST   /api/v1/groups                          ساخت (کد فقط یک‌بار)
 *   POST   /api/v1/groups/join                     عضویت با کد
 *   GET    /api/v1/groups/me                       گروه‌های من
 *   GET    /api/v1/groups/{id}                     جزئیات (فقط اعضا)
 *   POST   /api/v1/groups/{id}/rotate-code         بازچرخش کد (میزبان)
 *   POST   /api/v1/groups/{id}/leave               خروج
 *   DELETE /api/v1/groups/{id}/members/{userId}    اخراج (میزبان)
 *
 * کد خام فقط در پاسخ create/rotate برمی‌گردد؛ هیچ مسیری hash یا کد ذخیره‌شده
 * را serialize نمی‌کند (§39/§72).
 */
final class GroupController extends Controller
{
    public function __construct(
        private readonly GroupService $groups,
    ) {}

    public function store(CreateGroupRequest $request): JsonResponse
    {
        $result = $this->groups->create($request->user(), (int) $request->validated('seats'));

        return ApiResponse::success([
            'group' => $this->groupRow($result['group']),
            'code' => $result['code'],
        ], null, 201);
    }

    public function join(JoinGroupRequest $request): JsonResponse
    {
        $group = $this->groups->joinByCode($request->user(), (string) $request->validated('code'));

        return ApiResponse::success(['group' => $this->groupRow($group)]);
    }

    public function myGroups(Request $request): JsonResponse
    {
        $rows = collect($this->groups->groupsOf($request->user()))
            ->map(function (GroupMembership $membership) {
                /** @var StudyGroup|null */
                $group = $membership->group;

                return $group === null ? null : [
                    ...$this->groupRow($group),
                    'role' => $membership->role,
                    'joinedAt' => $membership->created_at?->toIso8601String(),
                ];
            })
            ->filter()
            ->values()
            ->all();

        return ApiResponse::success(['groups' => $rows]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $group = $this->groupOrFail($id);
        $this->groups->assertMember($request->user(), $group);

        $members = $group->memberships()
            ->with('user.profile')
            ->orderBy('created_at')
            ->get()
            ->map(fn (GroupMembership $membership) => [
                'id' => (string) $membership->user_id,
                'role' => $membership->role,
                'name' => $membership->user?->profile?->full_name ?? null,
                'isOwner' => $membership->role === GroupMembership::ROLE_OWNER,
                'joinedAt' => $membership->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        return ApiResponse::success(['group' => [...$this->groupRow($group), 'members' => $members]]);
    }

    public function rotateCode(Request $request, string $id): JsonResponse
    {
        $group = $this->groupOrFail($id);

        $result = $this->groups->rotateCode($request->user(), $group);

        return ApiResponse::success(['group' => $this->groupRow($result['group']), 'code' => $result['code']]);
    }

    public function leave(Request $request, string $id): JsonResponse
    {
        $this->groups->leave($request->user(), $this->groupOrFail($id));

        return ApiResponse::success(null, null, 204);
    }

    public function kick(Request $request, string $id, string $memberId): JsonResponse
    {
        $this->groups->kick($request->user(), $this->groupOrFail($id), $memberId);

        return ApiResponse::success(null, null, 204);
    }

    private function groupOrFail(string $id): StudyGroup
    {
        /** @var StudyGroup|null */
        $group = StudyGroup::query()->with('memberships')->whereKey($id)->first();

        if (! $group instanceof StudyGroup) {
            abort(404);
        }

        return $group;
    }

    /** @return array<string, mixed> */
    private function groupRow(StudyGroup $group): array
    {
        return [
            'id' => $group->getKey(),
            'seats' => (int) $group->seats,
            'memberCount' => (int) $group->memberships()->count(),
            'planId' => $group->plan_id,
            'status' => $group->status,
            'createdAt' => $group->created_at?->toIso8601String(),
        ];
    }
}
