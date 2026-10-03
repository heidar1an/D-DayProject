<?php

namespace App\Http\Controllers\Api\V1\Admin\Concerns;

use App\Http\Middleware\ResolveApiSession;
use App\Models\Admin;
use Illuminate\Http\Request;

/**
 * استخراج principal ادمین از سشن — فاز ۲۰.
 *
 * چرا trait: هر کنترلر پنل به همان principal نیاز دارد و `adminId` **هرگز** از
 * بدنه یا query نمی‌آید (§11). تکرار این قطعه در هر کنترلر یعنی احتمال واگرایی.
 */
trait ResolvesAdmin
{
    protected function admin(Request $request): Admin
    {
        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if (! $admin instanceof Admin) {
            abort(401);
        }

        return $admin;
    }
}
