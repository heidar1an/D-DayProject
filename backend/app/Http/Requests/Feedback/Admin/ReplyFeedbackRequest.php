<?php

namespace App\Http\Requests\Feedback\Admin;

use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * پاسخ مدیر / تغییر وضعیت — فاز ۱۶ (§49). `adminId` در قرارداد نیست و از
 * سشن ادمین می‌آید.
 */
final class ReplyFeedbackRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'min:2', 'max:'.(int) config('feedback.reply_body_max')],
        ];
    }
}
