<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notes\StoreNoteRequest;
use App\Http\Resources\UserNoteResource;
use App\Services\Notes\UserNoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * یادداشت شخصی کاربر — فاز ۱۶ (§33).
 *
 *   GET    /api/v1/me/notes          فهرست (سنجاق‌ها بالا)
 *   POST   /api/v1/me/notes          ساخت
 *   PATCH  /api/v1/me/notes/{id}     ویرایش جزئی
 *   DELETE /api/v1/me/notes/{id}     حذف
 *
 * هیچ مسیری userId نمی‌پذیرد — مالکیت فقط از سشن (§32).
 */
final class UserNoteController extends Controller
{
    public function __construct(
        private readonly UserNoteService $notes,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $notes = $this->notes->list($request->user());

        return ApiResponse::success(['notes' => UserNoteResource::collection($notes)]);
    }

    public function store(StoreNoteRequest $request): JsonResponse
    {
        $note = $this->notes->create($request->user(), $request->validated());

        return ApiResponse::success(['note' => new UserNoteResource($note)], null, 201);
    }

    public function update(StoreNoteRequest $request, string $noteId): JsonResponse
    {
        $note = $this->notes->update($request->user(), $noteId, $request->validated());

        return ApiResponse::success(['note' => new UserNoteResource($note)]);
    }

    public function destroy(Request $request, string $noteId): JsonResponse
    {
        $this->notes->delete($request->user(), $noteId);

        return ApiResponse::success(null, null, 204);
    }
}
