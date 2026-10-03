<?php

namespace App\Services\QuestionBank;

use App\Models\Question;
use App\Models\QuestionKey;

/**
 * بازگشایی کنترل‌شدهٔ کلید پاسخ.
 *
 * **قاعدهٔ ثابت:** کلید فقط پس از ثبت موفق پاسخ برمی‌گردد و فقط برای همان سؤالی
 * که در همین درخواست پاسخ گرفته — نه برای کل بانک، نه در payload سؤال.
 *
 * این تصمیم از رفتار واقعی محصول استخراج شده، نه از حدس:
 *   • `src/services/testBank/testBankService.js` — تابع `applyReveal` کلید را
 *     روی همان سؤال می‌نشاند و کامنت صریح می‌گوید «`correctAnswer === undefined`
 *     یعنی هنوز پاسخ داده نشده».
 *   • `database/contentStore.js::recordTestBankAnswers` — `correctAnswer` و
 *     `explanation` را **در همان پاسخ** برمی‌گرداند (بازگشایی فوری، نه با تأخیر).
 *
 * پس reveal در این فاز «فوری و فقط پس از پاسخ» است. اگر روزی محصول بخواهد
 * بازگشایی را به موعد/نتیجه موکول کند، تنها همین کلاس عوض می‌شود.
 */
class QuestionRevealService
{
    /**
     * @return array<string, mixed>|null `null` یعنی بازگشایی مجاز نیست.
     */
    public function revealAfterAnswer(Question $question, QuestionKey $key): ?array
    {
        if (! config('question_bank.reveal.after_answer')) {
            return null;
        }

        return [
            'correct_option_id' => $key->correct_option_id,
            'explanation' => $key->explanation,
        ];
    }

    /**
     * شکل عمومی کلید برای مسیر ادمین (`testbank.read`) — شامل متن توضیح و
     * شناسهٔ گزینهٔ درست، ولی **هیچ‌وقت** در payload دانشجو.
     *
     * @return array<string, mixed>
     */
    public function adminPayload(QuestionKey $key): array
    {
        return [
            'correct_option_id' => $key->correct_option_id,
            'explanation' => $key->explanation,
            'key_version' => $key->key_version,
        ];
    }
}
