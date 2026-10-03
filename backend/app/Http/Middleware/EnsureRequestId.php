<?php

namespace App\Http\Middleware;

use App\Support\RequestId;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Assigns a request id to every request, injects it into the log context and
 * echoes it back as a response header, so client reports, envelopes and log
 * lines can be correlated end to end.
 */
class EnsureRequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $requestId = RequestId::resolve($request->headers->get(RequestId::HEADER));

        $response = $next($request);

        $response->headers->set(RequestId::HEADER, $requestId);

        return $response;
    }
}
