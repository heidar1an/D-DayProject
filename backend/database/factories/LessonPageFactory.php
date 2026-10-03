<?php

namespace Database\Factories;

use App\Models\Lesson;
use App\Models\LessonPage;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<LessonPage>
 *
 * `LessonPage::factory()->published()->create()` کل زنجیره (subject→course→
 * chapter→lesson) را published می‌سازد تا صفحه واقعاً «قابل مشاهده» باشد.
 */
class LessonPageFactory extends Factory
{
    protected $model = LessonPage::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $slug = Str::slug(fake()->unique()->words(2, true)) ?: 'page';

        return [
            'lesson_id' => Lesson::factory()->published(),
            'slug' => 'page-'.$slug,
            'title' => 'صفحهٔ آزمایشی',
            'body' => 'محتوای آزمایشی صفحه.',
            'sort_order' => fake()->numberBetween(1, 20),
            'status' => LessonPage::STATUS_DRAFT,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (): array => [
            'status' => LessonPage::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);
    }

    public function forLesson(Lesson $lesson): static
    {
        return $this->state(fn (): array => ['lesson_id' => $lesson->getKey()]);
    }
}
