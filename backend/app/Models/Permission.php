<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * مجوز. هیچ کلید تازه‌ای در فاز ۵/۶ اختراع نشد: فهرست از `PERMISSIONS` واقعی
 * پنل legacy می‌آید و مجوز دامنهٔ بانک سؤال `testbank.*` است.
 */
class Permission extends Model
{
    use HasUuids;

    protected $table = 'permissions';

    /** @var list<string> */
    protected $fillable = ['key', 'description'];
}
