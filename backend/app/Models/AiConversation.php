<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class AiConversation extends Model
{
    use HasUuids;

    protected $fillable = [];

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime'];
    }

    public function messages(): HasMany
    {
        return $this->hasMany(AiMessage::class, 'conversation_id');
    }
}
