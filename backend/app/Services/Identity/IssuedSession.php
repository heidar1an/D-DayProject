<?php

namespace App\Services\Identity;

use App\Models\AuthSession;

/**
 * نتیجهٔ صدور سشن.
 *
 * `token` و `csrf` مقادیر **خام** هستند و فقط یک بار — برای گذاشتن در کوکی —
 * از این کلاس خوانده می‌شوند. در دیتابیس فقط هش‌شان هست.
 */
final readonly class IssuedSession
{
    public function __construct(
        public string $token,
        public string $csrf,
        public AuthSession $session,
    ) {}
}
