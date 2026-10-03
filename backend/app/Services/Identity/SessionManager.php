<?php

namespace App\Services\Identity;

use App\Models\Admin;
use App\Models\AuthSession;
use App\Models\User;

/**
 * چرخهٔ عمر سشن — تنها نویسندهٔ جدول `auth_sessions`.
 *
 * قواعدی که اینجا تضمین می‌شوند:
 *   • توکن ۲۵۶ بیتی تصادفی است و **فقط هش SHA-256** آن ذخیره می‌شود.
 *   • هر سشن `expires_at` دارد؛ هیچ سشنی بی‌انقضا ساخته نمی‌شود.
 *   • `resolve` فقط سشنِ فعال (باطل‌نشده و منقضی‌نشده) برمی‌گرداند.
 *   • ورود ⇒ rotation: سشن قبلی باطل، سشن تازه صادر می‌شود (ضد fixation).
 *   • `last_seen_at` با فاصلهٔ حداقلی نوشته می‌شود تا هر درخواست یک UPDATE نشود.
 */
class SessionManager
{
    public function issue(User $user): IssuedSession
    {
        $token = bin2hex(random_bytes(32));
        $csrf = bin2hex(random_bytes(32));
        $ttl = (int) config('identity.sessions.ttl_minutes');

        $session = new AuthSession;
        $session->forceFill([
            'principal_type' => AuthSession::PRINCIPAL_USER,
            'user_id' => $user->getKey(),
            'admin_id' => null,
            'token_hash' => $this->hashToken($token),
            'csrf_hash' => $this->hashToken($csrf),
            'expires_at' => now()->addMinutes($ttl),
            'last_seen_at' => now(),
        ])->save();

        return new IssuedSession($token, $csrf, $session);
    }

    /** باطل‌کردن سشنِ فعلی و صدور سشن تازه (session rotation). */
    public function rotate(?AuthSession $current, User $user): IssuedSession
    {
        $this->revoke($current);

        return $this->issue($user);
    }

    /** صدور سشن ادمین (principal: admin) — فاز ۳. */
    public function issueForAdmin(Admin $admin): IssuedSession
    {
        $token = bin2hex(random_bytes(32));
        $csrf = bin2hex(random_bytes(32));
        $ttl = (int) config('identity.sessions.ttl_minutes');

        $session = new AuthSession;
        $session->forceFill([
            'principal_type' => AuthSession::PRINCIPAL_ADMIN,
            'user_id' => null,
            'admin_id' => $admin->getKey(),
            'token_hash' => $this->hashToken($token),
            'csrf_hash' => $this->hashToken($csrf),
            'expires_at' => now()->addMinutes($ttl),
            'last_seen_at' => now(),
        ])->save();

        return new IssuedSession($token, $csrf, $session);
    }

    /** rotation برای ادمین — آینهٔ `rotate` با principal متفاوت. */
    public function rotateForAdmin(?AuthSession $current, Admin $admin): IssuedSession
    {
        $this->revoke($current);

        return $this->issueForAdmin($admin);
    }

    /** توکن خام ⇒ سشن فعال؛ در غیر این صورت `null`. */
    public function resolve(?string $token): ?AuthSession
    {
        if ($token === null || strlen($token) !== 64 || ctype_xdigit($token) === false) {
            return null;
        }

        $session = AuthSession::query()
            ->where('token_hash', $this->hashToken($token))
            ->active()
            ->with(['user', 'admin'])
            ->first();

        /*
         * چک وجود اصل (principal). `admin_id` FK ندارد (ستونش پیش از جدول
         * `admins` ساخته شد)، پس اگر ادمین حذف شده باشد سشن یتیم می‌ماند و
         * بدون این چک «ورود» به حساب می‌آمد. سشن بدون اصل = بی‌اعتبار.
         */
        if ($session === null) {
            return null;
        }

        $hasPrincipal = match ($session->principal_type) {
            AuthSession::PRINCIPAL_USER => $session->user !== null,
            AuthSession::PRINCIPAL_ADMIN => $session->admin !== null,
            default => false,
        };

        return $hasPrincipal ? $session : null;
    }

    public function revoke(?AuthSession $session): bool
    {
        if ($session === null || $session->isRevoked()) {
            return false;
        }

        $session->forceFill(['revoked_at' => now()])->save();

        return true;
    }

    /** «خروج از همهٔ دستگاه‌ها» — آمادهٔ فازهای بعد؛ در فاز ۲ مصرف نشده. */
    public function revokeAllFor(User $user): int
    {
        return AuthSession::query()
            ->where('user_id', $user->getKey())
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now(), 'updated_at' => now()]);
    }

    public function touch(AuthSession $session): void
    {
        $interval = (int) config('identity.sessions.touch_interval_minutes');

        if ($session->last_seen_at !== null && $session->last_seen_at->gt(now()->subMinutes($interval))) {
            return;
        }

        $session->forceFill(['last_seen_at' => now()])->save();
    }

    /** تمدید لغزان انقضا؛ فقط وقتی عمر باقی‌مانده از آستانه کمتر شده باشد. */
    public function refresh(AuthSession $session): void
    {
        if (config('identity.sessions.sliding') !== true) {
            return;
        }

        $ttl = (int) config('identity.sessions.ttl_minutes');
        $threshold = (float) config('identity.sessions.renew_when_remaining_below');

        if ($session->expires_at === null) {
            return;
        }

        $remaining = (float) now()->diffInMinutes($session->expires_at, false);

        if ($remaining > ($ttl * $threshold)) {
            return;
        }

        $session->forceFill(['expires_at' => now()->addMinutes($ttl)])->save();
    }

    /** double-submit: هدر باید هشِ ذخیره‌شده را بازتولید کند. */
    public function csrfMatches(AuthSession $session, ?string $presented): bool
    {
        if ($presented === null || $presented === '') {
            return false;
        }

        return hash_equals((string) $session->csrf_hash, $this->hashToken($presented));
    }

    public function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /** پاک‌سازی سشن‌های منقضی — برای زمان‌بند فازهای بعد. */
    public function purgeExpired(int $olderThanDays = 7): int
    {
        return AuthSession::query()
            ->where('expires_at', '<', now()->subDays($olderThanDays))
            ->delete();
    }
}
