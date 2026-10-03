<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class AiMessage extends Model
{
    use HasUuids;

    protected $fillable = [];

    protected $hidden = ['content', 'provider_message_id', 'request_key', 'request_hash', 'user_id', 'error_code'];

    protected function casts(): array
    {
        return ['content' => 'encrypted', 'usage_input' => 'integer', 'usage_output' => 'integer'];
    }
}
