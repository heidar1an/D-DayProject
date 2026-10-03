<?php

namespace Tests\Feature\Auth;

use App\Models\University;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ProfileUpdateTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: TestResponse, 1: User} */
    private function signedIn(): array
    {
        $register = $this->register();
        $this->withAuthCookies($register);

        // نه `sole()`: بعضی تست‌ها خودشان کاربر می‌سازند (مثل یکتایی username)،
        // پس کاربرِ «همین سشن» با شمارهٔ ثبت‌نام پیدا می‌شود، نه با شمارش کل جدول.
        return [$register, User::query()->where('phone', '09123456789')->sole()];
    }

    public function test_it_updates_the_allowlisted_profile_fields(): void
    {
        [$register] = $this->signedIn();
        $university = University::factory()->create();

        $response = $this->patchJsonWithOrigin('/api/v1/me', [
            'first_name' => 'آریا',
            'last_name' => 'حیدریان',
            'username' => 'Aria.H',
            'university_id' => $university->getKey(),
            'term' => '۴',
            'grade' => 'اینترنی',
            'gender' => 'مرد',
            'birth_date_jalali' => '۱۳۸۲/۰۴/۱۵',
            'avatar_key' => '07',
            'motivations' => ['learning', 'income'],
            'referrals' => ['telegram'],
        ], $this->csrfHeader($register));

        $response->assertStatus(200)
            ->assertJsonPath('data.user.profile.username', 'aria.h')
            ->assertJsonPath('data.user.profile.term', '4')
            ->assertJsonPath('data.user.profile.birth_date_jalali', '1382/04/15')
            ->assertJsonPath('data.user.profile.avatar_key', '07')
            ->assertJsonPath('data.user.profile.motivations', ['learning', 'income'])
            ->assertJsonPath('data.user.profile.referrals', ['telegram']);

        $this->assertDatabaseHas('user_profiles', [
            'username' => 'aria.h',
            'university_id' => $university->getKey(),
            'grade' => 'اینترنی',
        ]);
    }

    public function test_it_is_a_real_patch_and_leaves_untouched_fields_alone(): void
    {
        [$register] = $this->signedIn();

        $this->patchJsonWithOrigin('/api/v1/me', ['first_name' => 'آریا'], $this->csrfHeader($register))
            ->assertStatus(200);

        $this->patchJsonWithOrigin('/api/v1/me', ['last_name' => 'حیدریان'], $this->csrfHeader($register))
            ->assertStatus(200)
            ->assertJsonPath('data.user.profile.first_name', 'آریا')
            ->assertJsonPath('data.user.profile.last_name', 'حیدریان');
    }

    public function test_it_accepts_legacy_field_names(): void
    {
        [$register] = $this->signedIn();
        $university = University::factory()->create(['name' => 'دانشگاه علوم پزشکی مراغه']);

        $this->patchJsonWithOrigin('/api/v1/me', [
            'firstName' => 'آریا',
            'lastName' => 'حیدریان',
            'avatar' => '12',
            'birthDate' => '1382/04/15',
            'referralSources' => ['internet'],
            'university' => 'دانشگاه علوم پزشکی مراغه',
        ], $this->csrfHeader($register))
            ->assertStatus(200)
            ->assertJsonPath('data.user.profile.avatar_key', '12')
            ->assertJsonPath('data.user.profile.referrals', ['internet'])
            ->assertJsonPath('data.user.profile.university_id', $university->getKey());
    }

    public function test_forbidden_fields_are_rejected(): void
    {
        [$register, $user] = $this->signedIn();

        foreach ([
            ['role' => 'admin'],
            ['permissions' => ['*']],
            ['password_hash' => '$argon2id$fake'],
            ['id' => (string) Str::uuid()],
            ['user_id' => (string) Str::uuid()],
            ['phone' => '09999999999'],
            ['email_verified_at' => now()->toIso8601String()],
        ] as $payload) {
            $this->patchJsonWithOrigin('/api/v1/me', $payload, $this->csrfHeader($register))
                ->assertStatus(422)
                ->assertJsonPath('error.code', 'VALIDATION_FAILED');
        }

        $fresh = $user->fresh();
        $this->assertSame('09123456789', $fresh->phone);
        $this->assertSame($user->password_hash, $fresh->password_hash);
    }

    public function test_invalid_values_are_rejected_with_field_errors(): void
    {
        [$register] = $this->signedIn();

        /** @var list<array{0: array<string, mixed>, 1: string}> $cases */
        $cases = [
            [['username' => 'A B!'], 'username'],
            [['term' => '۹۹'], 'term'],
            [['grade' => 'کارآموزی'], 'grade'],
            [['gender' => 'other'], 'gender'],
            [['avatar_key' => '99'], 'avatar_key'],
            [['birth_date_jalali' => '1382-04-15'], 'birth_date_jalali'],
            [['motivations' => ['hacking']], 'motivations'],
            [['referrals' => ['ads']], 'referrals'],
        ];

        foreach ($cases as [$payload, $field]) {
            $response = $this->patchJsonWithOrigin('/api/v1/me', $payload, $this->csrfHeader($register));

            $response->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');
            $this->assertArrayHasKey($field, (array) $response->json('error.fields'), "field: {$field}");
        }
    }

    public function test_username_uniqueness_is_enforced_across_users(): void
    {
        UserProfile::factory()->create(['username' => 'taken']);

        [$register] = $this->signedIn();

        $this->patchJsonWithOrigin('/api/v1/me', ['username' => 'taken'], $this->csrfHeader($register))
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'USERNAME_TAKEN');
    }

    public function test_profile_update_requires_authentication(): void
    {
        $this->patchJsonWithOrigin('/api/v1/me', ['first_name' => 'x'])
            ->assertStatus(401)
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }

    public function test_profile_update_requires_the_csrf_header(): void
    {
        $this->signedIn();

        $this->patchJsonWithOrigin('/api/v1/me', ['first_name' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'CSRF_FAILED');
    }

    public function test_an_empty_patch_is_a_no_op(): void
    {
        [$register, $user] = $this->signedIn();

        $this->patchJsonWithOrigin('/api/v1/me', [], $this->csrfHeader($register))
            ->assertStatus(200)
            ->assertJsonPath('data.user.id', $user->getKey());
    }
}
