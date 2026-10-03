<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Ai\ChatRequest;
use App\Http\Requests\Ai\StoreAiAttachmentRequest;
use App\Http\Resources\AiMessageResource;
use App\Models\User;
use App\Services\Ai\AiService;
use App\Services\Media\MediaAccessService;
use App\Services\Media\MediaService;
use Illuminate\Http\JsonResponse;

final class AiController extends Controller
{
    public function chat(ChatRequest $request, AiService $ai): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $result = $ai->chat($user, $request->validated(), $request->header('Idempotency-Key'));

        return ApiResponse::success([
            'conversationId' => $result['conversationId'],
            'message' => new AiMessageResource($result['message']),
        ]);
    }

    public function attachment(StoreAiAttachmentRequest $request, AiService $ai, MediaService $mediaService, MediaAccessService $access): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $ai->authorize($user);
        $media = $mediaService->store($user, $request->upload(), ['purpose' => 'ai', 'visibility' => 'private']);
        $url = $access->accessFor($media);

        return ApiResponse::success([
            'id' => $media->getKey(), 'name' => $media->original_name,
            'type' => $media->mime, 'size' => $media->size_bytes,
            'previewUrl' => $url['url'],
        ], status: 201);
    }
}
