<?php

namespace Tests\Feature\Gamification;

use App\Events\Exam\ExamFinished;
use App\Events\Learning\LessonCompleted;
use App\Models\LeagueMembership;
use App\Models\LeagueSeason;
use App\Models\User;
use App\Models\XpTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * فاز ۱۴ — دفتر کل XP و لیگ.
 *
 *   ۱. XP فقط از رخداد واقعی؛ request_key سرورساخت ⇒ انتشار دوباره = replay.
 *   ۲. projection عضویت در همان تراکنش؛ reconcile از دفتر بازمی‌سازد.
 *   ۳. ترتیب و رتبهٔ leaderboard قطعی و سروری است.
 */
class LeagueAndXpTest extends TestCase
{
    use RefreshDatabase;

    /** UUID معتبر برای `lessonId` — روی PG ستون uuid است (نه رشتهٔ دلخواه). */
    private const LESSON_ID = '0199e2c0-0000-7000-8000-000000000001';

    private function newUser(string $phone, ?string $username = null): User
    {
        $this->postJsonWithOrigin('/api/v1/auth/register', [
            'phone' => $phone,
            'password' => 'Tapesh#1402',
        ])->assertCreated();

        $user = User::query()->where('phone', $phone)->firstOrFail();

        if ($username !== null) {
            DB::table('user_profiles')->where('user_id', $user->getKey())->update(['username' => $username]);
        }

        return $user;
    }

    /** ورود از مسیر واقعی (ثبت‌نام فقط CREATE است و ورود دوباره ۴۰۹ می‌دهد). */
    private function signIn(string $phone): void
    {
        $login = $this->postJsonWithOrigin('/api/v1/auth/login', [
            'phone' => $phone,
            'password' => 'Tapesh#1402',
        ])->assertOk();

        $this->withAuthCookies($login);
    }

    private function awardPage(User $user, string $pageId): void
    {
        /* `lessonId` باید UUID معتبر باشد: روی PostgreSQL ستون `lesson_pages.lesson_id`
           از نوع uuid است و رشتهٔ دلخواه (`22P02`) کل تراکنش تست را abort می‌کند
           (`25P02`) — خطایی که SQLite هرگز نشان نمی‌دهد. */
        LessonCompleted::dispatch($user->getKey(), $pageId, self::LESSON_ID);
    }

    public function test_xp_comes_only_from_real_events(): void
    {
        $user = $this->newUser('09120000001');

        $this->awardPage($user, 'page-1');

        $row = XpTransaction::query()->sole();
        $this->assertSame(XpTransaction::SOURCE_PAGE_COMPLETED, $row->source_type);
        $this->assertSame('page_completed:page:page-1', $row->request_key);
        $this->assertSame(20, (int) $row->delta);
        $this->assertSame($user->getKey(), $row->user_id);
    }

    public function test_duplicate_event_never_double_awards(): void
    {
        $user = $this->newUser('09120000001');

        $this->awardPage($user, 'page-1');
        $this->awardPage($user, 'page-1');
        $this->awardPage($user, 'page-1');

        $this->assertSame(1, XpTransaction::query()->count());
        $this->assertSame(20, (int) LeagueMembership::query()->sole()->xp_total);
    }

    public function test_season_is_created_lazily_and_weekly(): void
    {
        $user = $this->newUser('09120000001');
        $this->awardPage($user, 'page-1');

        $season = LeagueSeason::query()->sole();
        $this->assertSame(now()->format('o-\WW'), $season->slug);
        $this->assertSame(LeagueSeason::STATUS_ACTIVE, $season->status);
        $this->assertTrue($season->covers(now()));

        $membership = LeagueMembership::query()->sole();
        $this->assertSame($season->getKey(), $membership->season_id);
        $this->assertSame(20, (int) $membership->xp_total);
    }

    public function test_exam_event_awards_xp(): void
    {
        $user = $this->newUser('09120000001');

        ExamFinished::dispatch('exam-1', 'attempt-1', $user->getKey(), 'finished', 'user', 'result-1');

        $this->assertSame(50, (int) XpTransaction::query()->sole()->delta);
    }

    public function test_leaderboard_order_is_deterministic_including_ties(): void
    {
        $alpha = $this->newUser('09120000001', 'alpha');
        $bravo = $this->newUser('09120000002', 'bravo');
        $charlie = $this->newUser('09120000003', 'charlie');

        /* alpha و bravo مساوی (۴۰)؛ ترتیب قطعی بر اساس user_id ASC. */
        $this->awardPage($alpha, 'p1');
        $this->awardPage($alpha, 'p2');
        $this->awardPage($bravo, 'p3');
        $this->awardPage($bravo, 'p4');
        $this->awardPage($charlie, 'p5');

        $season = LeagueSeason::query()->sole();
        $this->signIn('09120000001');
        $body = $this->getJson("/api/v1/league/seasons/{$season->getKey()}/leaderboard")->assertOk()->json();

        $names = array_column($body['data']['entries'], 'display_name');

        /* alpha.zamin پیش از bravo ثبت شده ⇒ user_id کوچک‌تر ⇒ رتبهٔ بالاتر. */
        $this->assertSame('alpha', $names[0]);
        $this->assertSame('bravo', $names[1]);
        $this->assertSame('charlie', $names[2]);
        $this->assertSame([1, 2, 3], array_column($body['data']['entries'], 'rank'));
        $this->assertSame([40, 40, 20], array_column($body['data']['entries'], 'xp_total'));
    }

    public function test_leaderboard_pagination_keeps_global_ranks(): void
    {
        $a = $this->newUser('09120000001');
        $b = $this->newUser('09120000002');
        $c = $this->newUser('09120000003');

        $this->awardPage($a, 'p1');
        $this->awardPage($b, 'p3');
        $this->awardPage($c, 'p4');

        $season = LeagueSeason::query()->sole();
        $this->signIn('09120000001');

        $this->getJson("/api/v1/league/seasons/{$season->getKey()}/leaderboard?page=2&perPage=2")
            ->assertOk()
            ->assertJsonPath('data.entries.0.rank', 3)
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.lastPage', 2);
    }

    public function test_unknown_season_returns_404(): void
    {
        $this->newUser('09120000001');
        $this->signIn('09120000001');

        $this->getJson('/api/v1/league/seasons/00000000-0000-0000-0000-000000000000/leaderboard')
            ->assertStatus(404);
    }

    public function test_me_league_reports_rank_and_neighbors(): void
    {
        $alpha = $this->newUser('09120000001', 'alpha');
        $this->newUser('09120000002', 'bravo');
        $this->newUser('09120000003', 'charlie');

        $this->awardPage($alpha, 'p1');
        $this->awardPage($alpha, 'p2');
        $this->awardPage(User::where('phone', '09120000002')->firstOrFail(), 'p3');
        $this->awardPage(User::where('phone', '09120000003')->firstOrFail(), 'p4');

        $this->signIn('09120000002');
        $response = $this->getJson('/api/v1/me/league')->assertOk();

        $this->assertSame(2, $response->json('data.rank'));
        $this->assertSame(20, $response->json('data.membership.xp_total'));

        $neighborNames = array_column($response->json('data.neighbors'), 'display_name');
        $this->assertContains('alpha', $neighborNames);
        $this->assertContains('charlie', $neighborNames);
        $this->assertNotContains('bravo', $neighborNames);
    }

    public function test_user_without_membership_gets_season_but_no_rank(): void
    {
        $this->newUser('09120000001');
        $other = $this->newUser('09120000002');
        $this->awardPage($other, 'p1');

        $this->signIn('09120000001');
        $response = $this->getJson('/api/v1/me/league')->assertOk();

        $this->assertNotNull($response->json('data.season'));
        $this->assertNull($response->json('data.membership'));
        $this->assertNull($response->json('data.rank'));
    }

    public function test_reconcile_rebuilds_projection_from_ledger(): void
    {
        $user = $this->newUser('09120000001');
        $this->awardPage($user, 'p1');
        $this->awardPage($user, 'p2');

        $membership = LeagueMembership::query()->sole();
        $this->assertSame(40, (int) $membership->xp_total);

        /* projection دستی خراب می‌شود؛ reconcile از دفتر کل بازمی‌سازد. */
        DB::table('league_memberships')->where('id', $membership->getKey())->update(['xp_total' => 9999]);

        $this->artisan('gamification:reconcile-xp')->assertSuccessful();

        $this->assertSame(40, (int) LeagueMembership::query()->sole()->xp_total);
    }

    public function test_new_week_gets_a_fresh_season_and_fresh_projection(): void
    {
        $user = $this->newUser('09120000001');
        $this->awardPage($user, 'p1');

        $firstSeasonId = LeagueSeason::query()->sole()->getKey();

        Carbon::setTestNow(now()->addWeek()->addDay());
        $this->awardPage($user, 'p2');

        $this->assertSame(2, LeagueSeason::query()->count());
        $this->assertSame(20, (int) LeagueMembership::query()->where('season_id', $firstSeasonId)->sole()->xp_total);
        $this->assertSame(20, (int) LeagueMembership::query()->where('season_id', '!=', $firstSeasonId)->sole()->xp_total);

        Carbon::setTestNow();
    }

    public function test_leaderboard_never_exposes_contact_data(): void
    {
        $user = $this->newUser('09120000001');
        $this->awardPage($user, 'p1');

        $season = LeagueSeason::query()->sole();
        $this->signIn('09120000001');
        $body = $this->getJson("/api/v1/league/seasons/{$season->getKey()}/leaderboard")->assertOk()->json();

        $json = json_encode($body);
        $this->assertStringNotContainsString('09120000001', (string) $json);
        $this->assertArrayNotHasKey('user_id', $body['data']['entries'][0] ?? []);
    }

    public function test_no_client_path_leads_to_xp(): void
    {
        $this->newUser('09120000001');
        $this->signIn('09120000001');

        /* خواندن همهٔ endpointهای لیگ/مسیر سبز هرگز XP نمی‌سازد. */
        $this->getJson('/api/v1/me/league')->assertOk();
        $this->getJson('/api/v1/me/green-path/roadmap')->assertOk();
        $this->getJson('/api/v1/me/challenges')->assertOk();
        $this->getJson('/api/v1/me/achievements')->assertOk();

        $this->assertSame(0, XpTransaction::query()->count());
        $this->assertSame(0, LeagueMembership::query()->count());
    }
}
