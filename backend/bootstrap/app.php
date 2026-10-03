<?php

use App\Exceptions\ApiExceptionHandler;
use App\Http\Middleware\AuditAdminMutation;
use App\Http\Middleware\EnsureCsrfToken;
use App\Http\Middleware\EnsureRequestId;
use App\Http\Middleware\EnsureSameOrigin;
use App\Http\Middleware\RequireAdminSession;
use App\Http\Middleware\RequirePermission;
use App\Http\Middleware\RequireSessionUser;
use App\Http\Middleware\ResolveApiSession;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // requestId سراسری و بیرونی‌ترین میان‌افزار است تا حتی خطاهایی که پیش
        // از مسیریابی رخ می‌دهند (مثل 413) هم شناسهٔ درخواست داشته باشند.
        $middleware->prepend([
            EnsureRequestId::class,
        ]);

        // میان‌افزارهای ماژول هویت (فاز ۲) — فقط روی مسیرهایی که صریحاً می‌خواهند.
        $middleware->alias([
            'api.session' => ResolveApiSession::class,
            'api.auth' => RequireSessionUser::class,
            'api.origin' => EnsureSameOrigin::class,
            'api.csrf' => EnsureCsrfToken::class,
            // فاز ۳ (حداقلِ لازم فاز ۶): مسیرهای پنل principal جدا دارند و مجوز
            // با کلیدهای واقعی پنل چک می‌شود (`api.can:testbank.update`).
            'api.admin' => RequireAdminSession::class,
            'api.can' => RequirePermission::class,
            // فاز ۲۰: audit خودکار هر Mutation موفق پنل (فقط متدهای نوشتاری،
            // actor از سشن، بدنه redactشده) — پوشش یکنواخت §98.
            'api.audit' => AuditAdminMutation::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // همهٔ خطاهای API → envelope استاندارد v1؛ ۵xx هرگز trace/secret لو نمی‌دهد.
        $exceptions->render(
            fn (Throwable $e, Request $request) => ApiExceptionHandler::render($e, $request),
        );
    })->create();
