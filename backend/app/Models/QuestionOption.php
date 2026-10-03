<?php

namespace App\Models;

use Database\Factories\QuestionOptionFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * گزینهٔ سؤال.
 *
 * `position` از ۱ شروع می‌شود و `UNIQUE(question_id, position)` ترتیب را قطعی
 * می‌کند. `label` جدا از `body` است چون UI برچسب («الف»، «ب»، …) را مستقل از متن
 * نشان می‌دهد و برچسب در دادهٔ legacy وجود ندارد (ترتیب، برچسب را می‌سازد).
 *
 * هیچ ستونی «درست است/نیست» اینجا نیست — آن فقط در `question_keys` است.
 */
class QuestionOption extends Model
{
    /** @use HasFactory<QuestionOptionFactory> */
    use HasFactory, HasUuids;

    protected $table = 'question_options';

    /** @var list<string> */
    protected $fillable = ['position', 'label', 'body'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
