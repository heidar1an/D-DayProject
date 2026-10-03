<?php

namespace App\Services\Exam;

use App\Exceptions\ApiErrorException;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\Question;
use App\Models\QuestionKey;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

/**
 * ساخت Snapshot سؤال‌های آزمون — فاز ۷.
 *
 * قاعدهٔ بنیادین: **بعد از انتشار، Attempt به بانک سؤال زنده وابسته نیست.**
 * اگر ادمین متن یا گزینه‌های سؤال را ویرایش کند، Snapshot تغییر نمی‌کند و Attempt
 * قدیمی همان چیزی را می‌بیند که دانشجو دیده بود.
 *
 * آنچه کپی می‌شود:
 *   • متن سؤال، متادیتای نمایشی، و **گزینه‌ها با شناسهٔ درون‌snapshot خودشان**؛
 *   • `question_version` برای ردگیری «کدام نسخه snapshot شد»؛
 *   • کلید پاسخ در `key_snapshot_encrypted` (cast `encrypted` لاراول).
 *
 * آنچه بیرون می‌ماند: شناسهٔ گزینهٔ **بانک سؤال** هرگز به کلاینت نمی‌رود. گزینه‌های
 * snapshot شناسهٔ تازهٔ خودشان را دارند و نگاشت «گزینهٔ بانک → گزینهٔ snapshot»
 * فقط در حافظهٔ همین سرویس و در لحظهٔ ساخت زنده است.
 *
 * سؤال بدون کلید قابل تصحیح نیست؛ در زمان snapshot خطا می‌دهد تا آزمون
 * نیمه‌قابل‌تصحیح منتشر نشود.
 *
 * ⚠️ کلید رمزنگاری از `APP_KEY` می‌آید؛ هیچ Secret ای در کد نیست. چرخش `APP_KEY`
 * نیازمند re-encrypt این ستون است (ریسک مستندشده).
 */
class ExamSnapshotService
{
    /**
     * @param  Collection<int, Question>  $questions  مرتب — ترتیب ورودی = `position`
     * @return list<array<string, mixed>> ردیف‌های آمادهٔ درج در `exam_questions`
     */
    public function build(Exam $exam, Collection $questions): array
    {
        $max = (int) config('exam.limits.max_questions');

        if ($questions->count() > $max) {
            throw ApiErrorException::invalid(['questions' => ['TOO_MANY_QUESTIONS']]);
        }

        if ($questions->isEmpty()) {
            throw ApiErrorException::invalid(['questions' => ['NO_QUESTIONS']]);
        }

        $rows = [];
        $position = 0;
        $now = Carbon::now();

        foreach ($questions as $question) {
            $position++;
            $snapshot = $this->snapshot($question);

            $rows[] = [
                'id' => (string) Str::uuid(),
                'exam_id' => $exam->getKey(),
                'question_id' => $question->getKey(),
                'position' => $position,
                'question_version' => (int) $question->version,
                /* درج دسته‌ای از cast مدل عبور نمی‌کند، پس هر دو مقدار را صریح
                   آماده می‌کنیم: JSON برای Snapshot، و متن رمزنگاری‌شده برای کلید. */
                'render_snapshot' => json_encode($snapshot['render'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'key_snapshot_encrypted' => Crypt::encryptString(json_encode(
                    $snapshot['key'],
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
                )),
                'weight' => 1.0,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        return $rows;
    }

    /**
     * Snapshot یک سؤال — شکل `render` همان چیزی است که `ExamQuestionResource` به
     * دانشجو می‌دهد؛ `key` هرگز از مرز سرور بیرون نمی‌رود.
     *
     * @return array{render: array<string, mixed>, key: array<string, mixed>}
     */
    public function snapshot(Question $question): array
    {
        $key = $question->key;

        if (! $key instanceof QuestionKey) {
            throw ApiErrorException::invalid(['questions' => ['QUESTION_WITHOUT_KEY']]);
        }

        if ($question->options->isEmpty()) {
            throw ApiErrorException::invalid(['questions' => ['QUESTION_WITHOUT_OPTIONS']]);
        }

        $options = [];
        $optionMap = []; // source option id → snapshot option id (فقط در حافظه)

        foreach ($question->options as $option) {
            $snapshotOptionId = (string) Str::uuid();
            $optionMap[(string) $option->getKey()] = $snapshotOptionId;

            $options[] = [
                'id' => $snapshotOptionId,
                'position' => (int) $option->position,
                'label' => $option->label,
                'body' => $option->body,
            ];
        }

        $correctSnapshotId = $optionMap[(string) $key->correct_option_id] ?? null;

        if ($correctSnapshotId === null) {
            throw ApiErrorException::invalid(['questions' => ['KEY_OPTION_NOT_IN_QUESTION']]);
        }

        return [
            'render' => [
                'question_id' => $question->getKey(),
                'question_version' => (int) $question->version,
                'subject' => $this->relationSummary($question, 'subject'),
                'topic' => $this->relationSummary($question, 'topic'),
                'difficulty' => $question->difficulty,
                'type' => $question->type,
                'figure_key' => $question->figure_key,
                'stem' => $question->stem,
                'options' => $options,
            ],
            'key' => [
                'correct_option_id' => $correctSnapshotId,
                'key_version' => (int) $key->key_version,
                'explanation' => $key->explanation,
            ],
        ];
    }

    /** @return array{id: string, slug: string, title: string}|null */
    private function relationSummary(Question $question, string $relation): ?array
    {
        if (! $question->relationLoaded($relation)) {
            return null;
        }

        $model = $question->getRelation($relation);

        if ($model === null) {
            return null;
        }

        return [
            'id' => $model->getKey(),
            'slug' => $model->slug,
            'title' => $model->title,
        ];
    }

    /** شناسه‌های گزینهٔ مجاز یک سؤالِ snapshotشده — تنها ورودی مجاز `selected_option_id`. */
    /** @return list<string> */
    public function optionIdsOf(ExamQuestion $examQuestion): array
    {
        return $examQuestion->optionIds();
    }
}
