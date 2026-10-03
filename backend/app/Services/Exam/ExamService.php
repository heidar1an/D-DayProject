<?php

namespace App\Services\Exam;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\Question;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * ساخت و مدیریت آزمون — فاز ۷.
 *
 * این سرویس **دامنه** است، نه endpoint. در این فاز هیچ مسیر ادمینی برای آزمون
 * ساخته نشده چون مصرف‌کنندهٔ واقعی وجود ندارد: پنل فعلی فقط گزارش ایراد سؤال
 * آزمون‌ها را می‌بیند و CRUD آزمون ندارد (`database/adminApi.js`). ساختن
 * endpoint بی‌مصرف، «طراحی‌شده» را جای «پیاده‌شده» جا می‌زند.
 *
 * چرخهٔ عمر:
 *   draft ──▶ scheduled ──▶ open ──▶ closed ──▶ archived
 *     └────────▶ open ────────┘        ▲
 *     └────────────────────────────────┘
 * هر گذار دیگری رد می‌شود (fail-closed). `archived` پایانی است.
 *
 * انتشار (`publish`) Snapshot سؤال‌ها را می‌سازد و وضعیت را به `open`/`scheduled`
 * می‌برد. بعد از انتشار، ویرایش سؤال‌های آزمون ممکن نیست — Snapshot تغییرن‌پذیر است.
 */
class ExamService
{
    /** @var array<string, list<string>> */
    private const TRANSITIONS = [
        Exam::STATUS_DRAFT => [Exam::STATUS_SCHEDULED, Exam::STATUS_OPEN, Exam::STATUS_ARCHIVED],
        Exam::STATUS_SCHEDULED => [Exam::STATUS_OPEN, Exam::STATUS_CLOSED, Exam::STATUS_ARCHIVED],
        Exam::STATUS_OPEN => [Exam::STATUS_CLOSED, Exam::STATUS_ARCHIVED],
        Exam::STATUS_CLOSED => [Exam::STATUS_ARCHIVED],
        Exam::STATUS_ARCHIVED => [],
    ];

    public function __construct(private readonly ExamSnapshotService $snapshots) {}

    /**
     * ساخت آزمون + Snapshot سؤال‌ها در **یک تراکنش**.
     *
     * @param  array<string, mixed>  $data
     * @param  list<string>  $questionIds  ترتیب ورودی = ترتیب سؤال‌های آزمون
     */
    public function create(array $data, array $questionIds = [], ?Admin $admin = null): Exam
    {
        $rules = ExamRules::fromArray(is_array($data['rules'] ?? null) ? $data['rules'] : []);
        $kind = (string) ($data['kind'] ?? Exam::KIND_COORDINATED);

        if (! in_array($kind, (array) config('exam.kinds'), true)) {
            throw ApiErrorException::invalid(['kind' => ['INVALID_KIND']]);
        }

        $questions = $this->loadQuestions($questionIds);

        return DB::transaction(function () use ($data, $kind, $rules, $questions, $admin): Exam {
            $exam = new Exam;
            $exam->forceFill([
                'slug' => $this->slug($data['slug'] ?? $data['title'] ?? ''),
                'kind' => $kind,
                'type' => $data['type'] ?? null,
                'title' => $this->title($data['title'] ?? ''),
                'short_name' => $data['short_name'] ?? null,
                'description' => $this->description($data['description'] ?? null),
                'subject_id' => $data['subject_id'] ?? null,
                'status' => Exam::STATUS_DRAFT,
                'opens_at' => $data['opens_at'] ?? null,
                'closes_at' => $data['closes_at'] ?? null,
                'registration_opens_at' => $data['registration_opens_at'] ?? null,
                'registration_closes_at' => $data['registration_closes_at'] ?? null,
                'result_release_at' => $data['result_release_at'] ?? null,
                'duration_minutes' => $data['duration_minutes'] ?? null,
                'grace_seconds' => $data['grace_seconds'] ?? (int) config('exam.default_grace_seconds'),
                'attempt_limit' => $data['attempt_limit'] ?? 1,
                'negative_marking' => $data['negative_marking'] ?? 0,
                'question_count' => count($questions),
                'rules' => $rules->toArray(),
                'rules_version' => $rules->version(),
                'meta' => $data['meta'] ?? null,
                'created_by_admin_id' => $admin?->getKey(),
            ])->save();

            if ($questions->isNotEmpty()) {
                $this->snapshotInto($exam, $questions);
            }

            return $exam->refresh();
        });
    }

    /** Snapshot سؤال‌ها روی یک آزمون draft (پیش از انتشار). */
    public function snapshotInto(Exam $exam, Collection $questions): void
    {
        $rows = $this->snapshots->build($exam, $questions);
        ExamQuestion::query()->insert($rows);

        $exam->forceFill(['question_count' => count($rows)])->save();
    }

    /** انتشار: آزمون از `draft` بیرون می‌آید و Snapshot باید موجود باشد. */
    public function publish(Exam $exam, ?Admin $admin = null): Exam
    {
        if ($exam->questions()->count() === 0) {
            throw new ApiErrorException('EXAM_HAS_NO_QUESTIONS', 409, 'An exam cannot be published without questions.');
        }

        $target = $exam->opens_at !== null && $exam->opens_at->isFuture()
            ? Exam::STATUS_SCHEDULED
            : Exam::STATUS_OPEN;

        $exam = $this->transitionStatus($exam, $target);
        $exam->forceFill(['published_at' => now()])->save();

        return $exam;
    }

    /** گذار وضعیت با اعتبارسنجی سخت. */
    public function transitionStatus(Exam $exam, string $target): Exam
    {
        if (! in_array($target, (array) config('exam.statuses'), true)) {
            throw ApiErrorException::invalid(['status' => ['INVALID_STATUS']]);
        }

        $allowed = self::TRANSITIONS[$exam->status] ?? [];

        if (! in_array($target, $allowed, true)) {
            throw new ApiErrorException(
                'EXAM_STATUS_TRANSITION_INVALID',
                409,
                "Cannot move an exam from {$exam->status} to {$target}.",
                ['status' => ['EXAM_STATUS_TRANSITION_INVALID']],
            );
        }

        $exam->forceFill(['status' => $target, 'version' => (int) $exam->version + 1])->save();

        return $exam;
    }

    /**
     * @param  list<string>  $questionIds
     * @return Collection<int, Question>
     */
    private function loadQuestions(array $questionIds): Collection
    {
        $ids = array_values(array_unique(array_filter($questionIds, static fn ($id) => is_string($id) && Str::isUuid($id))));

        if ($ids === []) {
            return collect();
        }

        $found = Question::query()
            ->whereIn('id', $ids)
            ->with(['options', 'key', 'subject:id,slug,title', 'topic:id,slug,title'])
            ->get()
            ->keyBy('id');

        /* سؤال ناشناخته/غیرمنتشرشده ⇒ ۴۲۲؛ ترتیب دقیقاً همان ورودی می‌ماند. */
        $ordered = collect();
        foreach ($ids as $id) {
            $question = $found->get($id);

            if ($question === null || $question->status !== Question::STATUS_PUBLISHED) {
                throw ApiErrorException::invalid(['question_ids' => ["QUESTION_NOT_PUBLISHED:{$id}"]]);
            }

            $ordered->push($question);
        }

        return $ordered;
    }

    private function slug(string $raw): string
    {
        $slug = Str::slug($raw);

        if ($slug === '') {
            $slug = 'exam-'.Str::lower(Str::random(10));
        }

        return Str::limit($slug, 120, '');
    }

    private function title(string $raw): string
    {
        $title = trim($raw);

        if ($title === '') {
            throw ApiErrorException::invalid(['title' => ['TITLE_REQUIRED']]);
        }

        return Str::limit($title, (int) config('exam.limits.max_title'), '');
    }

    private function description(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        return Str::limit(trim($raw), (int) config('exam.limits.max_description'), '');
    }
}
