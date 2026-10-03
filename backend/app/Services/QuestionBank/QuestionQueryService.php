<?php

namespace App\Services\QuestionBank;

use App\Exceptions\ApiErrorException;
use App\Models\Question;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * خواندن بانک سؤال — تنها مسیر query برای فهرست/جزئیات/انتخاب سؤال.
 *
 * **کلید پاسخ هیچ‌وقت بارگذاری نمی‌شود.** رابطهٔ `key` عمداً در هیچ eager-load
 * این کلاس نیست؛ پس حتی یک `toArray()` اشتباهی هم نمی‌تواند کلید را لو بدهد.
 *
 * فیلترها **allowlist** هستند و در یک جا تعریف شده‌اند تا مسیر عمومی، Bank
 * Session و مسیر ادمین یک رفتار داشته باشند.
 */
class QuestionQueryService
{
    /** فیلترهای مجاز مسیر دانشجو. `status` عمداً بین آن‌ها نیست. */
    public const FILTERS = ['subject', 'topic', 'chapter', 'lesson', 'difficulty', 'type', 'source', 'track', 'year', 'q'];

    public const SORTS = ['newest', 'oldest'];

    /**
     * فهرست سؤال‌های منتشرشده با صفحه‌بندی.
     *
     * @param  array<string, mixed>  $filters
     */
    public function published(array $filters, int $perPage, string $sort = 'newest'): LengthAwarePaginator
    {
        return $this->base($filters)
            ->with(['subject:id,slug,title', 'topic:id,slug,title,parent_id', 'options'])
            ->orderBy('published_at', $sort === 'oldest' ? 'asc' : 'desc')
            ->orderBy('id', $sort === 'oldest' ? 'asc' : 'desc')
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * انتخاب سؤال سمت سرور برای Bank Session.
     *
     * چرا `inRandomOrder` و نه shuffle در PHP: انتخاب باید از **دیتابیس** بیاید،
     * نه از فهرستی که کلاینت فرستاده. هیچ `questionIds` ای از بیرون پذیرفته نمی‌شود.
     *
     * @param  array<string, mixed>  $filters
     * @return Collection<int, Question>
     */
    public function randomSet(array $filters, int $count): Collection
    {
        return $this->base($filters)
            ->with(['subject:id,slug,title', 'topic:id,slug,title,parent_id', 'options'])
            ->inRandomOrder()
            ->limit($count)
            ->get();
    }

    /** جزئیات یک سؤال منتشرشده؛ در غیر این صورت ۴۰۴ (نه ۴۰۳). */
    public function findPublished(string $id): Question
    {
        $question = Question::query()
            ->published()
            ->where('id', $id)
            ->with(['subject:id,slug,title', 'topic:id,slug,title,parent_id', 'options'])
            ->first();

        if ($question === null) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Question not found.');
        }

        return $question;
    }

    /**
     * فهرست ادمین — تنها جایی که سؤال draft/archived دیده می‌شود.
     *
     * کلید پاسخ اینجا eager-load می‌شود چون `AdminQuestionResource` آن را
     * برمی‌گرداند؛ این مسیر پشت `api.can:testbank.read` است.
     *
     * @param  array<string, mixed>  $filters
     */
    public function adminList(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = Question::query();

        $status = $filters['status'] ?? null;

        if (is_string($status) && $status !== '') {
            $query->where('status', $status);
        }

        $this->applySubject($query, $filters);
        $this->applyTopic($query, $filters);
        $this->applyEnums($query, $filters);
        $this->applySearch($query, (string) ($filters['q'] ?? ''));

        return $query
            ->with(['options', 'key', 'subject:id,slug,title', 'topic:id,slug,title,parent_id'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    /** جزئیات کامل برای ادمین — شامل کلید. */
    public function findForAdmin(string $id): Question
    {
        $question = Question::query()
            ->where('id', $id)
            ->with(['options', 'key', 'subject:id,slug,title', 'topic:id,slug,title,parent_id'])
            ->first();

        if ($question === null) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Question not found.');
        }

        return $question;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Question>
     */
    public function base(array $filters): Builder
    {
        $query = Question::query()->published();

        $this->applySubject($query, $filters);
        $this->applyTopic($query, $filters);
        $this->applyStructural($query, $filters);
        $this->applyEnums($query, $filters);

        if (isset($filters['year']) && $filters['year'] !== null) {
            $query->where('year', (int) $filters['year']);
        }

        $this->applySearch($query, (string) ($filters['q'] ?? ''));

        return $query;
    }

    /** @param Builder<Question> $query */
    private function applySubject(Builder $query, array $filters): void
    {
        $subject = $filters['subject'] ?? null;

        if (is_string($subject) && $subject !== '') {
            $query->whereHas('subject', fn ($inner) => $inner->where('slug', $subject));
        }
    }

    /** @param Builder<Question> $query */
    private function applyTopic(Builder $query, array $filters): void
    {
        $topic = $filters['topic'] ?? null;

        if (is_string($topic) && $topic !== '') {
            // مبحث و همهٔ زیرمبحث‌هایش — همان معنایی که UI از «تست مبحثی» دارد.
            $query->whereHas('topic', function ($inner) use ($topic): void {
                $inner->where('slug', $topic)
                    ->orWhereHas('parent', fn ($parent) => $parent->where('slug', $topic));
            });
        }
    }

    /** @param Builder<Question> $query */
    private function applyStructural(Builder $query, array $filters): void
    {
        foreach (['chapter', 'lesson'] as $key) {
            $value = $filters[$key] ?? null;

            if (is_string($value) && $value !== '') {
                $query->where($key.'_id', $value);
            }
        }
    }

    /** @param Builder<Question> $query */
    private function applyEnums(Builder $query, array $filters): void
    {
        foreach (['difficulty', 'type', 'source', 'track'] as $key) {
            $value = $filters[$key] ?? null;

            if (is_string($value) && $value !== '') {
                $query->where($key, $value);
            }
        }
    }

    /**
     * جست‌وجو — PostgreSQL `ILIKE`، سایر درایورها `LIKE`.
     *
     * صداقت مهندسی: جست‌وجوی زیررشته‌ای با wildcard ابتدایی **از هیچ ایندکس
     * B-tree استفاده نمی‌کند**. در این فاز ریسکش با سقف `perPage`، صفحه‌بندی و
     * rate limit مهار شده و FTS/trigram برای فاز ۹/۱۳ باقی می‌ماند. ادعای
     * «indexed search» اینجا مطرح نمی‌شود.
     *
     * @param  Builder<Question>  $query
     */
    private function applySearch(Builder $query, string $term): void
    {
        $term = trim($term);

        if ($term === '') {
            return;
        }

        $needle = '%'.addcslashes($term, '%_\\').'%';

        if (DB::connection()->getDriverName() === 'pgsql') {
            $query->whereRaw('stem ILIKE ?', [$needle]);

            return;
        }

        $query->where('stem', 'like', $needle);
    }
}
