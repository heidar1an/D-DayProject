<?php

namespace Database\Factories;

use App\Models\User;
use App\Services\Identity\PasswordHasher;
use App\Services\Identity\Scrypt;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<User>
 *
 * نکته: `password_hash` و `google_subject` در `$fillable` نیستند، پس با
 * `forceFill` ست می‌شوند — همان مسیری که کد تولید هم استفاده می‌کند. اگر روزی
 * تستی به `google_subject` نیاز داشت، از `forceFill` استفاده کند نه از آرایهٔ
 * `definition()` (وگرنه بی‌صدا null می‌ماند).
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'phone' => '09'.fake()->unique()->numerify('#########'),
            'email' => null,
            'email_verified_at' => null,
            'password_updated_at' => null,
        ];
    }

    public function withPassword(string $password = 'Tapesh#1402'): static
    {
        return $this->afterMaking(function (User $user) use ($password): void {
            $user->forceFill([
                'password_hash' => app(PasswordHasher::class)->hash($password),
                'password_updated_at' => now(),
            ]);
        });
    }

    /** هش legacy (SHA-256 بدون salt) — برای تست مهاجرت رمز. */
    public function withLegacySha256Password(string $password = 'Tapesh#1402'): static
    {
        return $this->afterMaking(function (User $user) use ($password): void {
            $user->forceFill([
                'password_hash' => hash('sha256', $password),
                'password_updated_at' => null,
            ]);
        });
    }

    /** هش legacy scrypt (فرمت واقعی Node) — گران؛ فقط در تست مهاجرت استفاده شود. */
    public function withLegacyScryptPassword(string $password = 'Tapesh#1402', string $saltHex = '00112233445566778899aabbccddeeff'): static
    {
        return $this->afterMaking(function (User $user) use ($password, $saltHex): void {
            $derived = Scrypt::derive($password, (string) hex2bin($saltHex), 16384, 8, 1, 64);

            $user->forceFill([
                'password_hash' => 'scrypt$'.$saltHex.'$'.bin2hex($derived),
                'password_updated_at' => null,
            ]);
        });
    }

    /** حساب Google-only: بدون رمز. */
    public function withoutPassword(): static
    {
        return $this->state(fn (): array => ['password_hash' => null]);
    }
}
