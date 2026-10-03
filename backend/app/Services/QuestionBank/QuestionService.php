<?php

namespace App\Services\QuestionBank;

use App\Exceptions\ApiErrorException;
use App\Models\Chapter;
use App\Models\Lesson;
use App\Models\Question;
use App\Models\QuestionKey;
use App\Models\QuestionOption;
use App\Models\QuestionTopic;
use App\Models\Subject;
use Illuminate\Support\Facades\DB;

/**
 * نوشتن سؤال — تنها نویسندهٔ `questions`, `question_options`, `question_keys`.
 *
 * قواعد سخت:
 *   • **کلید پاسخ در `questions`/`question_options` تکرار نمی‌شود.** یک منبع،
 *     یک نویسنده: `question_keys`.
 *   • **یکپارچگی روابط** قبل از نوشتن چک می‌شود:
 *       – `subject_id` باید وجود داشته باشد؛
 *       – `chapter_id` (اگر بیاید) باید به همان درس تعلق داشته باشد؛
 *       – `lesson_id` (اگر بیاید) باید داخل همان فصل باشد؛
 *       – `topic_id` (اگر بیاید) باید به همان درس تعلق داشته باشد.
 *     بدون این، سؤال می‌تواند به مبحث درس دیگری بچسبد و فیلترهای UI دروغ شوند.
 *   • **حذف فیزیکی وجود ندارد.** `archive` جایگزین است؛ `question_attempts` با
 *     FK RESTRICT جلوی حذف سؤالِ استفاده‌شده را می‌گیرد.
 *   • تغییر محتوایی ⇒ `version++`. تغییر کلید ⇒ `key_version++`. این تفکیک از
 *     روز اول درست است تا فاز ۷ بتواند سؤال را snapshot کند.
 */
class QuestionService
{
    /**
     * @param  array<string, mixed>  $data
     * @param  list<array{label?: string|null, body: string}>  $options
     * @param  array<string, mixed>  $key  `correctPosition` (۱-پایه) + `explanation`
     */
    public function create(Subject $subject, array $data, array $options, array $key, ?string $authorAdminId): Question
    {
        $this->assertOptions($options);

        return DB::transaction(function () use ($subject, $data, $options, $key, $authorAdminId): Question {
            $this->assertRelations($subject, $data);

            $question = new Question;
            $question->fill($data);
            $question->forceFill([
                'subject_id' => $subject->getKey(),
                'status' => Question::STATUS_DRAFT,
                'version' => 1,
                'author_admin_id' => $authorAdminId,
            ])->save();

            $this->syncOptions($question, $options);
            $this->writeKey($question, $key);

            return $question->load(['options', 'key', 'subject:id,slug,title', 'topic:id,slug,title,parent_id']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<array{label?: string|null, body: string}>|null  $options
     * @param  array<string, mixed>|null  $key
     */
    public function update(Question $question, array $data, ?array $options, ?array $key, ?int $expectedVersion = null): Question
    {
        if ($question->status === Question::STATUS_ARCHIVED) {
            throw new ApiErrorException('QUESTION_ARCHIVED', 409, 'An archived question cannot be edited.');
        }

        if ($options !== null) {
            $this->assertOptions($options);
        }

        return DB::transaction(function () use ($question, $data, $options, $key, $expectedVersion): Question {
            // optimistic lock: دو ادمین هم‌زمان نباید نوشتن یکدیگر را پاک کنند.
            $locked = Question::query()->whereKey($question->getKey())->lockForUpdate()->firstOrFail();

            if ($expectedVersion !== null && (int) $expectedVersion !== (int) $locked->version) {
                throw new ApiErrorException(
                    'VERSION_CONFLICT',
                    409,
                    "The question was modified by another request (current version: {$locked->version}).",
                    ['version' => ['VERSION_CONFLICT']],
                );
            }

            $question->setRawAttributes($locked->getAttributes(), true);
            $question->setRelation('key', $locked->key);

            $subject = Subject::query()->findOrFail($question->subject_id);
            $this->assertRelations($subject, $data, $question);

            $question->fill($data);
            // هر تغییر محتوایی نسخه را بالا می‌برد: snapshot فاز ۷ نباید بی‌صدا
            // به محتوای تازه اشاره کند.
            $question->forceFill(['version' => $question->version + 1])->save();

            if ($options !== null) {
                $this->syncOptions($question, $options);
            }

            if ($key !== null) {
                $this->writeKey($question, $key);
            }

            return $question->load(['options', 'key', 'subject:id,slug,title', 'topic:id,slug,title,parent_id']);
        });
    }

    public function publish(Question $question): Question
    {
        $this->assertPublishable($question);

        $question->forceFill([
            'status' => Question::STATUS_PUBLISHED,
            'published_at' => $question->published_at ?? now(),
        ])->save();

        return $question;
    }

    public function archive(Question $question): Question
    {
        $question->forceFill(['status' => Question::STATUS_ARCHIVED])->save();

        return $question;
    }

    /** @param list<array{label?: string|null, body: string}> $options */
    private function assertOptions(array $options): void
    {
        if (count($options) < 2) {
            throw ApiErrorException::invalid(['options' => ['OPTIONS_MIN_2']]);
        }

        if (count($options) > (int) config('question_bank.limits.max_options')) {
            throw ApiErrorException::invalid(['options' => ['OPTIONS_TOO_MANY']]);
        }
    }

    private function assertPublishable(Question $question): void
    {
        $question->loadMissing(['options', 'key']);

        if ($question->options->count() < 2) {
            throw new ApiErrorException('QUESTION_NOT_PUBLISHABLE', 409, 'A question needs at least two options.');
        }

        $key = $question->key;

        if (! $key instanceof QuestionKey) {
            throw new ApiErrorException('QUESTION_NOT_PUBLISHABLE', 409, 'A question needs an answer key before publishing.');
        }

        $belongs = $question->options->contains(
            fn (QuestionOption $option) => (string) $option->getKey() === (string) $key->correct_option_id,
        );

        if (! $belongs) {
            throw new ApiErrorException('QUESTION_NOT_PUBLISHABLE', 409, 'The answer key points to an option that is not part of the question.');
        }
    }

    /**
     * یکپارچگی روابط محتوا.
     *
     * @param  array<string, mixed>  $data
     */
    private function assertRelations(Subject $subject, array $data, ?Question $existing = null): void
    {
        $chapterId = $data['chapter_id'] ?? $existing?->chapter_id;
        $lessonId = $data['lesson_id'] ?? $existing?->lesson_id;
        $topicId = $data['topic_id'] ?? $existing?->topic_id;

        if ($chapterId !== null) {
            $chapter = Chapter::query()->with('course')->find($chapterId);

            if ($chapter === null || (string) $chapter->course?->subject_id !== (string) $subject->getKey()) {
                throw ApiErrorException::invalid(['chapter_id' => ['CHAPTER_SUBJECT_MISMATCH']]);
            }
        }

        if ($lessonId !== null) {
            $lesson = Lesson::query()->find($lessonId);

            if ($lesson === null || ($chapterId !== null && (string) $lesson->chapter_id !== (string) $chapterId)) {
                throw ApiErrorException::invalid(['lesson_id' => ['LESSON_CHAPTER_MISMATCH']]);
            }
        }

        if ($topicId !== null) {
            $topic = QuestionTopic::query()->find($topicId);

            if ($topic === null || (string) $topic->subject_id !== (string) $subject->getKey()) {
                throw ApiErrorException::invalid(['topic_id' => ['TOPIC_SUBJECT_MISMATCH']]);
            }
        }
    }

    /** @param list<array{label?: string|null, body: string}> $options */
    private function syncOptions(Question $question, array $options): void
    {
        /*
         * بازنویسی کامل گزینه‌ها: حذف گزینه‌ای که Attempt روی آن اشاره دارد
         * توسط FK RESTRICT رد می‌شود ⇒ سؤالِ پاسخ‌داده‌شده بی‌صدا تغییر نمی‌کند.
         * گزینه‌های موجود بر اساس position به‌روزرسانی می‌شوند تا شناسه‌ها
         * تا حد ممکن پایدار بمانند.
         */
        $existing = $question->options()->get()->keyBy('position');

        foreach ($options as $index => $option) {
            $position = $index + 1;
            $current = $existing->get($position);

            if ($current instanceof QuestionOption) {
                $current->forceFill([
                    'label' => $option['label'] ?? null,
                    'body' => (string) $option['body'],
                ])->save();

                continue;
            }

            $created = new QuestionOption;
            $created->forceFill([
                'question_id' => $question->getKey(),
                'position' => $position,
                'label' => $option['label'] ?? null,
                'body' => (string) $option['body'],
            ])->save();
        }

        $question->unsetRelation('options');
    }

    /** @param array<string, mixed> $key */
    private function writeKey(Question $question, array $key): void
    {
        $position = (int) ($key['correctPosition'] ?? 0);
        $option = $question->options()->where('position', $position)->first();

        if ($option === null) {
            throw ApiErrorException::invalid(['correctPosition' => ['CORRECT_POSITION_OUT_OF_RANGE']]);
        }

        $existing = QuestionKey::query()->where('question_id', $question->getKey())->first();
        $explanation = $key['explanation'] ?? null;

        if ($existing instanceof QuestionKey) {
            $keyChanged = (string) $existing->correct_option_id !== (string) $option->getKey();

            $existing->forceFill([
                'correct_option_id' => $option->getKey(),
                'explanation' => $explanation,
                'key_version' => $keyChanged ? $existing->key_version + 1 : $existing->key_version,
            ])->save();

            $question->setRelation('key', $existing);

            return;
        }

        $created = new QuestionKey;
        $created->forceFill([
            'question_id' => $question->getKey(),
            'correct_option_id' => $option->getKey(),
            'explanation' => $explanation,
            'key_version' => 1,
        ])->save();

        $question->setRelation('key', $created);
    }
}
