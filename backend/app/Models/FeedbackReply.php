<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * پاسخ مدیر به بازخورد — فاز ۱۶. `admin_id` همیشه از Auth Context می‌آید (§49).
 */
class FeedbackReply extends Model
{
    use HasUuids;

    protected $table = 'feedback_replies';

    /** @var list<string> */
    protected $fillable = [];

    public function feedback(): BelongsTo
    {
        return $this->belongsTo(Feedback::class, 'feedback_id');
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'admin_id');
    }
}
