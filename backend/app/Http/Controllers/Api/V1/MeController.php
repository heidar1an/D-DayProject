<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Me\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Services\Identity\ProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * کاربر جاری — هویت **همیشه** از سشن سرور می‌آید.
 *
 * `GET /api/v1/me?userId=…` هیچ اثری ندارد: هیچ پارامتری خوانده نمی‌شود و
 * هیچ مسیری برای گرفتن کاربر دیگری وجود ندارد (`PATCH /users/{id}` ساخته
 * نشده است). این پایهٔ ownership برای Policy layer فازهای بعد است.
 */
class MeController extends Controller
{
    public function __construct(private readonly ProfileService $profiles) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('profile.university');

        return ApiResponse::success(['user' => new UserResource($user)]);
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();

        $this->profiles->update($user, $request->validated());

        $user->load('profile.university');

        return ApiResponse::success(['user' => new UserResource($user)]);
    }
}
