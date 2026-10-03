<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Exceptions\ApiErrorException;
use App\Models\LeagueSeason;
use App\Services\Gamification\AchievementService;
use App\Services\Gamification\ChallengeService;
use App\Services\Gamification\LeagueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * لیگ و گیمیفیکیشن — فاز ۱۴ (فقط خواندنی برای کلاینت).
 *
 *   GET /api/v1/me/league
 *   GET /api/v1/league/seasons/{id}/leaderboard
 *   GET /api/v1/me/challenges
 *   GET /api/v1/me/achievements
 *
 * هیچ endpoint نوشتاری برای XP/رتبه/نشان/چالش وجود ندارد: همهٔ پاداش‌ها از
 * رخداد واقعی بک‌اند صادر می‌شوند. هویت از سشن است؛ `userId` پذیرفته نمی‌شود.
 * ترتیب/رتبه کاملاً سروری است و کلاینت هیچ `ORDER BY` ای نمی‌دهد.
 */
class LeagueController extends Controller
{
    public function __construct(
        private readonly LeagueService $league,
        private readonly ChallengeService $challenges,
        private readonly AchievementService $achievements,
    ) {}

    public function me(Request $request): JsonResponse
    {
        return ApiResponse::success($this->league->overview($request->user()));
    }

    public function leaderboard(Request $request, string $seasonId): JsonResponse
    {
        $season = LeagueSeason::query()->where('id', $seasonId)->first();

        if ($season === null) {
            throw new ApiErrorException('NOT_FOUND', 404, 'League season not found.');
        }

        $page = $this->intParam($request, 'page', 1);
        $perPage = $this->intParam($request, 'perPage', (int) config('gamification.league.leaderboard_per_page'));

        $result = $this->league->leaderboard($season, $page, $perPage);

        return ApiResponse::success(
            ['entries' => $result['entries']],
            [
                'page' => $result['page'],
                'perPage' => $result['per_page'],
                'total' => $result['total'],
                'lastPage' => $result['last_page'],
            ],
        );
    }

    public function myChallenges(Request $request): JsonResponse
    {
        return ApiResponse::success([
            'items' => $this->challenges->forUser($request->user()->getKey()),
        ]);
    }

    public function myAchievements(Request $request): JsonResponse
    {
        return ApiResponse::success([
            'items' => $this->achievements->forUser($request->user()->getKey()),
        ]);
    }

    private function intParam(Request $request, string $key, int $default): int
    {
        $value = $request->query($key);

        if ($value === null || $value === '') {
            return $default;
        }

        if (! preg_match('/^\d{1,4}$/', (string) $value)) {
            throw ApiErrorException::invalid([$key => ['INVALID']]);
        }

        return (int) $value;
    }
}
