<?php

namespace Tests\Feature;

use App\Models\University;
use Database\Seeders\UniversitySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UniversitiesTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_only_active_universities(): void
    {
        University::factory()->create(['name' => 'دانشگاه الف', 'slug' => 'a']);
        University::factory()->inactive()->create(['name' => 'دانشگاه ب', 'slug' => 'b']);

        $response = $this->getJson('/api/v1/universities');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [['id', 'slug', 'name']],
                'meta' => ['page', 'perPage', 'total', 'lastPage'],
                'requestId',
            ]);

        $this->assertSame(1, $response->json('meta.total'));
        $this->assertSame('a', $response->json('data.0.slug'));
    }

    public function test_it_searches_by_name(): void
    {
        University::factory()->create(['name' => 'دانشگاه علوم پزشکی تهران', 'slug' => 'tehran']);
        University::factory()->create(['name' => 'دانشگاه علوم پزشکی مشهد', 'slug' => 'mashhad']);

        $response = $this->getJson('/api/v1/universities?search='.rawurlencode('تهران'));

        $this->assertSame(1, $response->json('meta.total'));
        $this->assertSame('tehran', $response->json('data.0.slug'));
    }

    public function test_it_paginates(): void
    {
        University::factory()->count(5)->create();

        $response = $this->getJson('/api/v1/universities?per_page=2&page=2');

        $response->assertStatus(200);
        $this->assertSame(5, $response->json('meta.total'));
        $this->assertSame(2, $response->json('meta.page'));
        $this->assertCount(2, $response->json('data'));
    }

    public function test_like_wildcards_from_the_user_are_not_treated_as_patterns(): void
    {
        University::factory()->count(3)->create();

        $this->getJson('/api/v1/universities?search=%25')
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 0);
    }

    public function test_parameters_outside_the_allowlist_are_rejected(): void
    {
        $this->getJson('/api/v1/universities?q=x')->assertStatus(422);
        $this->getJson('/api/v1/universities?filter[active]=1')->assertStatus(422);
        $this->getJson('/api/v1/universities?order=id')->assertStatus(422);
        $this->getJson('/api/v1/universities?per_page=9999')->assertStatus(422);
        $this->getJson('/api/v1/universities?sort=drop')->assertStatus(422);
    }

    public function test_it_does_not_require_authentication(): void
    {
        $this->getJson('/api/v1/universities')->assertStatus(200);
    }

    public function test_the_seeded_catalogue_matches_the_real_project_list(): void
    {
        $rows = require database_path('seeders/data/universities.php');

        $this->assertCount(61, $rows);

        $this->seed(UniversitySeeder::class);

        $this->assertSame(61, University::query()->count());
        $this->assertDatabaseHas('universities', ['slug' => 'tehran', 'name' => 'دانشگاه علوم پزشکی تهران']);
        $this->assertDatabaseHas('universities', ['slug' => 'maragheh']);

        // idempotent: اجرای دوباره ردیف تکراری نمی‌سازد
        $this->seed(UniversitySeeder::class);
        $this->assertSame(61, University::query()->count());
    }
}
