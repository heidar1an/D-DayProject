<?php

namespace App\Http\Requests\QuestionBank;

use App\Http\Requests\ApiFormRequest;
use App\Http\Requests\Concerns\RejectsUnknownParameters;

/**
 * جزئیات یک سؤال.
 *
 * این مسیر **هیچ پارامتر query نمی‌پذیرد** و allowlist خالی است. چرا: بدون آن،
 * کلاینتی که `?includeAnswerKey=true` می‌فرستد ۲۰۰ می‌گیرد و تصور می‌کند
 * «روزی این پارامتر پشتیبانی می‌شود». ۴۰۰ صریح، قرارداد را بسته نگه می‌دارد و
 * جلوی «افزودن فیلد برای راحتی UI» را از سمت کلاینت می‌گیرد.
 */
class ShowQuestionRequest extends ApiFormRequest
{
    use RejectsUnknownParameters;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->rejectUnknownQuery([]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}
