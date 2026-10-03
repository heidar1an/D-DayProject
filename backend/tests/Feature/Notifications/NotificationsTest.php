<?php

namespace Tests\Feature\Notifications;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsOps;
use Tests\TestCase;

/**
 * اعلان‌های کاربر — فاز ۱۹ (§23–§28).
 *
 * تمرکز: مالکیت (IDOR)، صفحه‌بندی، read سرور-محور، dedup، و اینکه هیچ
 * `userId` از بدنه/query مسیر تحویل را تعیین نمی‌کند.
 *
 * ⚠️ نوشتن‌های کاربر `api.csrf` دارند (double-submit)؛ بدون هدر CSRF سشن،
 * درخواست ۴۰۳ می‌گیرد و تست به‌جای سنجیدن مالکیت، صرفاً CSRF را می‌سنجد.
 */
final class NotificationsTest extends TestCase
{
    use BuildsOps, RefreshDatabase;

    public function test_guest_cannot_list_notifications(): void
    {
        $this->forgetCookies()
            ->getJson('/api/v1/me/notifications')
            ->assertUnauthorized();
    }

    public function test_it_lists_only_the_session_users_notifications(): void
    {
        $first = $this->register(['phone' => '09120000001']);
        $second = $this->register(['phone' => '09120000002']);

        $firstUser = User::query()->where('phone', '09120000001')->firstOrFail();
        $secondUser = User::query()->where('phone', '09120000002')->firstOrFail();

        $this->notify((string) $firstUser->getKey(), Notification::TYPE_SYSTEM, ['title' => 'برای اولی']);
        $this->notify((string) $secondUser->getKey(), Notification::TYPE_SYSTEM, ['title' => 'برای دومی']);

        $response = $this->withAuthCookies($first)->getJson('/api/v1/me/notifications');

        $response->assertOk()
            ->assertJsonCount(1, 'data.notifications')
            ->assertJsonPath('data.notifications.0.title', 'برای اولی')
            ->assertJsonPath('data.unreadCount', 1)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_it_does_not_expose_the_owner_id_in_the_payload(): void
    {
        $session = $this->register(['phone' => '09120000003']);
        $user = User::query()->where('phone', '09120000003')->firstOrFail();

        $this->notify((string) $user->getKey());

        $this->withAuthCookies($session)
            ->getJson('/api/v1/me/notifications')
            ->assertOk()
            ->assertJsonMissingPath('data.notifications.0.userId');
    }

    public function test_reading_another_users_notification_is_not_found(): void
    {
        $first = $this->register(['phone' => '09120000004']);
        $this->register(['phone' => '09120000005']);

        $secondUser = User::query()->where('phone', '09120000005')->firstOrFail();
        $foreign = $this->notify((string) $secondUser->getKey());

        self::assertInstanceOf(Notification::class, $foreign);

        $this->withAuthCookies($first)
            ->patchJson(
                '/api/v1/me/notifications/'.$foreign->getKey().'/read',
                [],
                array_merge(['Origin' => $this->origin()], $this->csrfHeader($first)),
            )
            ->assertNotFound();

        /* و خوانده هم نشده است. */
        self::assertNull($foreign->refresh()->read_at);
    }

    public function test_read_state_is_server_owned_and_ignores_client_identity(): void
    {
        $session = $this->register(['phone' => '09120000006']);
        $user = User::query()->where('phone', '09120000006')->firstOrFail();
        $victim = $this->register(['phone' => '09120000007']);
        $victimUser = User::query()->where('phone', '09120000007')->firstOrFail();

        $mine = $this->notify((string) $user->getKey());
        self::assertInstanceOf(Notification::class, $mine);

        $this->withAuthCookies($session)
            ->patchJson(
                '/api/v1/me/notifications/'.$mine->getKey().'/read',
                ['userId' => (string) $victimUser->getKey(), 'user_id' => (string) $victimUser->getKey()],
                array_merge(['Origin' => $this->origin()], $this->csrfHeader($session)),
            )
            ->assertOk()
            ->assertJsonPath('data.notification.read', true);

        self::assertNotNull($mine->refresh()->read_at);
        self::assertSame((string) $user->getKey(), (string) $mine->user_id);

        /* اعلان کاربر دیگر دست‌نخورده است. */
        $other = $this->notify((string) $victimUser->getKey());
        self::assertInstanceOf(Notification::class, $other);
        self::assertNull($other->refresh()->read_at);

        $this->forgetCookies()->withAuthCookies($victim)->getJson('/api/v1/me/notifications')->assertOk();
    }

    public function test_read_all_only_touches_the_session_users_rows(): void
    {
        $session = $this->register(['phone' => '09120000008']);
        $user = User::query()->where('phone', '09120000008')->firstOrFail();

        $this->notify((string) $user->getKey());
        $this->notify((string) $user->getKey());
        $this->notify((string) $user->getKey(), Notification::TYPE_EXAM_RESULT, ['title' => 'کارنامه']);

        $this->withAuthCookies($session)
            ->patchJson(
                '/api/v1/me/notifications/read-all',
                [],
                array_merge(['Origin' => $this->origin()], $this->csrfHeader($session)),
            )
            ->assertOk()
            ->assertJsonPath('data.marked', 3);

        self::assertSame(0, Notification::query()->where('user_id', $user->getKey())->whereNull('read_at')->count());
    }

    public function test_duplicate_dedup_key_does_not_create_a_second_notification(): void
    {
        $session = $this->register(['phone' => '09120000009']);
        $user = User::query()->where('phone', '09120000009')->firstOrFail();

        $first = $this->notify((string) $user->getKey(), Notification::TYPE_SYSTEM, ['title' => 'یک‌بار'], 'event:1');
        $second = $this->notify((string) $user->getKey(), Notification::TYPE_SYSTEM, ['title' => 'دو‌بار'], 'event:1');

        self::assertInstanceOf(Notification::class, $first);
        self::assertNull($second);
        self::assertSame(1, Notification::query()->where('user_id', $user->getKey())->count());

        $this->withAuthCookies($session)->getJson('/api/v1/me/notifications')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_it_creates_one_delivery_row_per_effective_channel(): void
    {
        $session = $this->register(['phone' => '09120000010']);
        $user = User::query()->where('phone', '09120000010')->firstOrFail();

        $notification = $this->notify((string) $user->getKey());
        self::assertInstanceOf(Notification::class, $notification);

        $deliveries = $notification->deliveries()->get();

        self::assertCount(1, $deliveries);
        self::assertSame('in_app', (string) $deliveries->first()->channel);
        self::assertSame('delivered', (string) $deliveries->first()->status);

        $this->withAuthCookies($session)->getJson('/api/v1/me/notifications')->assertOk();
    }

    public function test_pagination_is_enforced_and_per_page_is_capped(): void
    {
        $session = $this->register(['phone' => '09120000011']);
        $user = User::query()->where('phone', '09120000011')->firstOrFail();

        for ($i = 0; $i < 5; $i++) {
            $this->notify((string) $user->getKey(), Notification::TYPE_SYSTEM, ['title' => 'پیام '.$i], 'k:'.$i);
        }

        $this->withAuthCookies($session)
            ->getJson('/api/v1/me/notifications?perPage=2')
            ->assertOk()
            ->assertJsonCount(2, 'data.notifications')
            ->assertJsonPath('meta.total', 5)
            ->assertJsonPath('meta.lastPage', 3);

        $this->withAuthCookies($session)
            ->getJson('/api/v1/me/notifications?perPage='.(int) config('notifications.pagination.max_per_page') + 50)
            ->assertStatus(422);
    }

    public function test_unknown_type_filter_is_rejected(): void
    {
        $session = $this->register(['phone' => '09120000012']);

        $this->withAuthCookies($session)
            ->getJson('/api/v1/me/notifications?type=made_up')
            ->assertStatus(422);
    }

    public function test_unknown_query_parameter_is_rejected(): void
    {
        $session = $this->register(['phone' => '09120000013']);

        $this->withAuthCookies($session)
            ->getJson('/api/v1/me/notifications?userId=somebody-else')
            ->assertStatus(400);
    }

    public function test_writes_require_csrf_and_same_origin(): void
    {
        $session = $this->register(['phone' => '09120000014']);

        $this->withAuthCookies($session)
            ->patchJson('/api/v1/me/notifications/'.fake()->uuid().'/read', [], ['Origin' => $this->origin()])
            ->assertForbidden();

        $this->withAuthCookies($session)
            ->patchJson('/api/v1/me/notifications/'.fake()->uuid().'/read')
            ->assertForbidden();
    }
}
