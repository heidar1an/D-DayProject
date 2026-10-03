<?php

namespace App\Services\Gamification;

use App\Models\LeagueMembership;
use App\Models\LeagueSeason;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * لیگ — فصل، عضویت، رتبه و leaderboard (فاز ۱۴).
 *
 * تصمیم‌ها:
 *   • فصل هفتگی است و **lazy** ساخته می‌شود (`ensureCurrent`): هیچ season
 *     مصنوعی seed نمی‌شود و همیشه فصل جاریِ واقعی وجود دارد. slug شکل
 *     `2026-W41` دارد و UNIQUE است؛ مسابقهٔ ساخت ⇒ گرفتن Unique و re-fetch.
 *   • ترتیب leaderboard کاملاً سروری است: `xp_total DESC, user_id ASC` —
 *     deterministic و سازگار با صفحه‌بندی؛ rank = جایگاه در همین ترتیب.
 *   • هویت عمومی فقط شکل امن دارد: username یا «نام + حرف اول نام خانوادگی»
 *     یا null. تلفن/ایمیل/شناسهٔ خام هرگز بیرون نمی‌رود.
 */
class LeagueService
{
    /* ─────────────────────────────── فصل ─────────────────────────────── */

    /** فصل جاری — در صورت نبود، می‌سازد. فصل‌های گذشته را هم می‌بندد. */
    public function ensureCurrent(?Carbon $now = null): ?LeagueSeason
    {
        $now ??= Carbon::now();
        $slug = $this->slugFor($now);
        $window = $this->windowFor($now);

        $this->closeStaleSeasons($now);

        $season = LeagueSeason::query()->where('slug', $slug)->first();

        if ($season !== null) {
            return $season;
        }

        try {
            /* savepoint + گرفتن استثنا بیرون (`25P02` در PG). */
            return DB::transaction(function () use ($slug, $window): LeagueSeason {
                $season = new LeagueSeason;
                $season->forceFill([
                    'slug' => $slug,
                    'starts_at' => $window['start'],
                    'ends_at' => $window['end'],
                    'status' => LeagueSeason::STATUS_ACTIVE,
                ])->save();

                return $season;
            });
        } catch (UniqueConstraintViolationException) {
            return LeagueSeason::query()->where('slug', $slug)->first();
        }
    }

    /** بستن فصل‌هایی که زمانشان گذشته — فصل هیچ‌وقت delete نمی‌شود. */
    private function closeStaleSeasons(Carbon $now): void
    {
        LeagueSeason::query()
            ->whereIn('status', [LeagueSeason::STATUS_UPCOMING, LeagueSeason::STATUS_ACTIVE])
            ->where('ends_at', '<=', $now)
            ->update(['status' => LeagueSeason::STATUS_ENDED]);
    }

    private function slugFor(Carbon $now): string
    {
        /* ISO week: `o` سال ISO و `W` شمارهٔ هفته با صفر پیشرو — مرتب‌پذیر. */
        return $now->format('o-\WW');
    }

    /** @return array{start: Carbon, end: Carbon} */
    private function windowFor(Carbon $now): array
    {
        $start = $now->copy()->startOfWeek(Carbon::MONDAY);
        $end = $start->copy()->addWeek();

        return ['start' => $start, 'end' => $end];
    }

    /* ───────────────────────────── عضویت ───────────────────────────── */

    /** عضویت فقط با اولین XP واقعی ساخته می‌شود — نه با بازدید. */
    public function ensureMembership(LeagueSeason $season, User $user): LeagueMembership
    {
        $membership = LeagueMembership::query()
            ->where('season_id', $season->getKey())
            ->where('user_id', $user->getKey())
            ->first();

        if ($membership !== null) {
            return $membership;
        }

        try {
            /* savepoint + گرفتن استثنا بیرون (`25P02`). */
            return DB::transaction(function () use ($season, $user): LeagueMembership {
                $membership = new LeagueMembership;
                $membership->forceFill([
                    'season_id' => $season->getKey(),
                    'user_id' => $user->getKey(),
                    'university_id' => $user->profile?->university_id,
                    'xp_total' => 0,
                ])->save();

                return $membership;
            });
        } catch (UniqueConstraintViolationException) {
            return LeagueMembership::query()
                ->where('season_id', $season->getKey())
                ->where('user_id', $user->getKey())
                ->firstOrFail();
        }
    }

    /* ─────────────────────────── leaderboard ─────────────────────────── */

    /**
     * صفحه‌بندی سمت سرور با rank سازگار با ترتیب قطعی.
     *
     * @return array{entries: list<array<string, mixed>>, page: int, per_page: int, total: int, last_page: int}
     */
    public function leaderboard(LeagueSeason $season, int $page = 1, ?int $perPage = null): array
    {
        $perPage = min(
            max(1, $perPage ?? (int) config('gamification.league.leaderboard_per_page')),
            (int) config('gamification.league.leaderboard_max_per_page'),
        );
        $page = max(1, $page);

        $query = LeagueMembership::query()
            ->where('season_id', $season->getKey())
            ->orderByDesc('xp_total')
            ->orderBy('user_id');

        $total = (clone $query)->count();
        $offset = ($page - 1) * $perPage;

        $rows = $query
            ->with(['user.profile', 'user.profile.university'])
            ->offset($offset)
            ->limit($perPage)
            ->get();

        $entries = $rows->map(fn (LeagueMembership $membership, int $index): array => [
            'rank' => $offset + $index + 1,
            'display_name' => $this->publicIdentity($membership->user),
            'avatar_key' => $membership->user?->profile?->avatar_key,
            'university' => $membership->user?->profile?->university?->name,
            'xp_total' => (int) $membership->xp_total,
            'is_you' => false,
        ])->all();

        return [
            'entries' => $entries,
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'last_page' => (int) max(1, ceil($total / $perPage)),
        ];
    }

    /* ────────────────────────── me/league ────────────────────────── */

    /**
     * نمای لیگ کاربر جاری — فصل، امتیاز، رتبه، همسایه‌ها، پیشرفت فصل.
     *
     * @return array<string, mixed>
     */
    public function overview(User $user): array
    {
        $now = Carbon::now();
        $season = $this->ensureCurrent($now);

        $neighborsCount = max(0, (int) config('gamification.league.neighbor_count'));

        if ($season === null) {
            return ['season' => null, 'membership' => null, 'rank' => null, 'neighbors' => []];
        }

        $membership = LeagueMembership::query()
            ->where('season_id', $season->getKey())
            ->where('user_id', $user->getKey())
            ->first();

        if ($membership === null) {
            return [
                'season' => $this->presentSeason($season, $now),
                'membership' => null,
                'rank' => null,
                'neighbors' => [],
            ];
        }

        /* ترتیب قطعی: xp_total DESC, user_id ASC. rank = تعداد بهترها + ۱. */
        $betterCount = LeagueMembership::query()
            ->where('season_id', $season->getKey())
            ->where(function ($query) use ($membership): void {
                $query->where('xp_total', '>', (int) $membership->xp_total)
                    ->orWhere(function ($inner) use ($membership): void {
                        $inner->where('xp_total', '=', (int) $membership->xp_total)
                            ->where('user_id', '<', $membership->user_id);
                    });
            })
            ->count();

        $rank = $betterCount + 1;
        $offset = max(0, $betterCount - $neighborsCount);

        $window = LeagueMembership::query()
            ->where('season_id', $season->getKey())
            ->orderByDesc('xp_total')
            ->orderBy('user_id')
            ->with(['user.profile', 'user.profile.university'])
            ->offset($offset)
            ->limit($neighborsCount * 2 + 1)
            ->get();

        $neighbors = [];

        foreach ($window as $index => $row) {
            if ($row->getKey() === $membership->getKey()) {
                continue;
            }

            $neighbors[] = [
                'rank' => $offset + $index + 1,
                'display_name' => $this->publicIdentity($row->user),
                'avatar_key' => $row->user?->profile?->avatar_key,
                'university' => $row->user?->profile?->university?->name,
                'xp_total' => (int) $row->xp_total,
                'is_you' => false,
            ];

            if (count($neighbors) >= $neighborsCount * 2) {
                break;
            }
        }

        return [
            'season' => $this->presentSeason($season, $now),
            'membership' => [
                'xp_total' => (int) $membership->xp_total,
                'joined_at' => $membership->created_at?->toIso8601String(),
            ],
            'rank' => $rank,
            'neighbors' => $neighbors,
        ];
    }

    /**
     * بازسازی projection از دفتر کل — مسیر داخلی، بدون endpoint عمومی.
     */
    public function reconcileSeason(LeagueSeason $season): int
    {
        $fixed = 0;

        LeagueMembership::query()
            ->where('season_id', $season->getKey())
            ->orderBy('user_id')
            ->each(function (LeagueMembership $membership) use (&$fixed): void {
                $actual = (int) DB::table('xp_transactions')
                    ->where('season_id', $membership->season_id)
                    ->where('user_id', $membership->user_id)
                    ->sum('delta');

                if ($actual !== (int) $membership->xp_total) {
                    $membership->forceFill(['xp_total' => $actual])->save();
                    $fixed++;
                }
            });

        return $fixed;
    }

    /** @return array<string, mixed> */
    private function presentSeason(LeagueSeason $season, Carbon $now): array
    {
        return [
            'id' => $season->getKey(),
            'slug' => $season->slug,
            'starts_at' => $season->starts_at?->toIso8601String(),
            'ends_at' => $season->ends_at?->toIso8601String(),
            'status' => $season->status,
            'days_remaining' => max(0, (int) $now->startOfDay()->diffInDays($season->ends_at?->copy()->startOfDay(), false)),
        ];
    }

    /** هویت عمومی امن — username، یا نام + حرف اول فامیل، یا null. */
    private function publicIdentity(?User $user): ?string
    {
        $profile = $user?->profile;

        if ($profile === null) {
            return null;
        }

        if (is_string($profile->username) && $profile->username !== '') {
            return $profile->username;
        }

        $first = trim((string) $profile->first_name);
        $last = trim((string) $profile->last_name);

        if ($first !== '' && $last !== '') {
            return $first.' '.mb_substr($last, 0, 1).'.';
        }

        if ($first !== '') {
            return $first;
        }

        return null;
    }
}
