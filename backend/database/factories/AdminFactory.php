<?php

namespace Database\Factories;

use App\Models\Admin;
use App\Services\Identity\PasswordHasher;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Admin>
 *
 * `password_hash` در `$fillable` نیست، پس با `forceFill` ست می‌شود — همان
 * مسیری که کد تولید هم می‌رود.
 */
class AdminFactory extends Factory
{
    protected $model = Admin::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'username' => 'admin-'.fake()->unique()->numerify('######'),
            'display_name' => 'مدیر آزمایشی',
            'active' => true,
            'must_change_password' => false,
        ];
    }

    public function withPassword(string $password = 'Tapesh#1402'): static
    {
        return $this->afterMaking(function (Admin $admin) use ($password): void {
            $admin->forceFill(['password_hash' => app(PasswordHasher::class)->hash($password)]);
        });
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['active' => false]);
    }
}
