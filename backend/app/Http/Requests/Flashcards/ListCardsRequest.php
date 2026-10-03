<?php

namespace App\Http\Requests\Flashcards;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;
use Illuminate\Validation\Rule;

/**
 * جست‌وجو/فیلتر کارت‌ها.
 *
 * فیلترهای `state`/`bookmarked` روی **وضعیت خودِ کاربر** عمل می‌کنند و با
 * subquery محدود به `user_id` سشن اعمال می‌شوند؛ پس نمی‌توانند برای دیدن
 * دادهٔ کاربر دیگر استفاده شوند.
 */
class ListCardsRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    /** @var list<string> */
    private const ALLOWED = ['deckId', 'q', 'status', 'state', 'bookmarked', 'page', 'perPage'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery(self::ALLOWED);

        /*
         * `?bookmarked=true` یک شکل طبیعی در query string است، ولی قاعدهٔ
         * `boolean` لاراول فقط `1`/`0`/`true`(بولین)/`false`(بولین) را می‌پذیرد
         * و رشتهٔ `'true'` را رد می‌کند. چون `filters()` عمداً با
         * `FILTER_VALIDATE_BOOLEAN` نرمال‌سازی می‌کند، اینجا هم همان شکل‌های
         * متنی را به `1`/`0` تبدیل می‌کنیم تا قرارداد یکدست بماند.
         */
        if ($this->has('bookmarked')) {
            $raw = $this->query('bookmarked');

            if (is_string($raw) && in_array(strtolower($raw), ['true', 'false'], true)) {
                $this->merge(['bookmarked' => strtolower($raw) === 'true' ? '1' : '0']);
            }
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'deckId' => ['nullable', 'uuid'],
            'q' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(config('flashcards.cards.statuses'))],
            'state' => ['nullable', Rule::in(config('flashcards.states'))],
            'bookmarked' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('flashcards.pagination.max_per_page')],
        ];
    }

    /**
     * فقط فیلترهایی که واقعاً آمده‌اند — با نرمال‌سازی boolean.
     *
     * @return array<string, mixed>
     */
    public function filters(): array
    {
        $data = $this->validated();

        if (array_key_exists('bookmarked', $data)) {
            $data['bookmarked'] = filter_var($data['bookmarked'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
        }

        return $data;
    }
}
