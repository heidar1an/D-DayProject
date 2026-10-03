<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<UserProfile> */
class UserProfileFactory extends Factory
{
    protected $model = UserProfile::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            // الگوی username در v1 حروف کوچک/رقم/._- است ⇒ دادهٔ کارخانه هم همان.
            'username' => Str::lower(Str::random(10)),
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
        ];
    }
}
