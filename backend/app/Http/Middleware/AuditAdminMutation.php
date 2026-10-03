<?php

namespace App\Http\Middleware;

use App\Models\Admin;
use App\Services\Audit\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Audit خودکار Mutationهای پنل — فاز ۲۰ (§98).
 *
 * چرا middleware و نه صدا زدن دستی در هر کنترلر: پوشش یکنواخت. اگر ثبت audit
 * به یادآوری هر نویسندهٔ کنترلر وابسته باشد، دیر یا زود یک mutation بی‌audit
 * می‌ماند. اینجا **هر** نوشتن موفق پنل ثبت می‌شود.
 *
 * قواعد:
 *   • فقط متدهای نوشتاری (POST/PUT/PATCH/DELETE).
 *   • فقط پاسخ موفق (< ۴۰۰) — درخواست ناموفق چیزی را تغییر نداده.
 *   • actor همیشه از سشن ادمین، هرگز از بدنه (§11).
 *   • بدنه redact می‌شود؛ رمز/توکن/کد هرگز ذخیره نمی‌شود (§83).
 */
final class AuditAdminMutation
{
    private const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    public function __construct(
        private readonly AuditLogger $audit,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! in_array($request->method(), self::WRITE_METHODS, true)) {
            return $response;
        }

        $admin = $request->attributes->get(ResolveApiSession::ADMIN_ATTRIBUTE);

        if (! $admin instanceof Admin) {
            return $response;
        }

        if ($response->getStatusCode() >= 400) {
            return $response;
        }

        [$targetType, $targetId] = $this->target($request);

        $this->audit->recordAdmin(
            admin: $admin,
            action: $this->action($request),
            targetType: $targetType,
            targetId: $targetId,
            changes: $this->changes($request),
        );

        return $response;
    }

    /**
     * بدنهٔ ثبت‌شده — redactشده، و **خالی** برای مسیرهای معاف.
     *
     * چرا معافیت لازم است: بعضی بدنه‌ها ذاتاً راز دارند و نام کلیدشان عمومی است
     * (`value`)، پس redact بر اساس نام کلید کافی نیست (§14/§83).
     *
     * @return array<string, mixed>
     */
    private function changes(Request $request): array
    {
        if ($request->method() === 'DELETE') {
            return [];
        }

        $exempt = (array) config('audit.body_exempt_routes', []);

        if (in_array($this->action($request), $exempt, true)) {
            return [];
        }

        return $request->except(['_token', '_method']);
    }

    private function action(Request $request): string
    {
        $name = $request->route()?->getName();

        return is_string($name) && $name !== ''
            ? $name
            : strtolower($request->method()).' '.$request->path();
    }

    /** @return array{0: ?string, 1: ?string} */
    private function target(Request $request): array
    {
        $params = $request->route()?->parameters() ?? [];

        $targetId = null;
        $targetType = null;

        foreach ($params as $name => $value) {
            if (! is_scalar($value)) {
                continue;
            }

            $value = (string) $value;

            if ($value === '' || preg_match('/^[A-Za-z0-9_-]+$/', $value) !== 1) {
                continue;
            }

            /* شناسهٔ ترجیحی: پارامترهایی که به Id ختم می‌شوند یا خود `id` هستند. */
            $isIdentifier = $name === 'id' || str_ends_with((string) $name, 'Id');

            if ($targetId === null || $isIdentifier) {
                $targetId = $value;
                $targetType = (string) $name;

                if ($isIdentifier) {
                    break;
                }
            }
        }

        return [$targetType, $targetId];
    }
}
