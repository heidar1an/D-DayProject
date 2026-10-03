<?php

namespace App\Services\Analytics;

use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Cache تحلیلی **per-user و version-aware** — فاز ۸.
 *
 * چرا نسخه و نه فقط TTL: با TTL تنها، بعد از «پایان آزمون» کاربر تا انقضای کش
 * عدد قدیمی می‌بیند. با نسخه، invalidate فوری است و کلید تازه محاسبه می‌شود.
 *
 * چرا کش مشترک ممنوع است: `userId` **همیشه** بخشی از کلید است. هیچ کلید بدون
 * شناسهٔ کاربر ساخته نمی‌شود، پس نشتی بین کاربران ساختاراً ناممکن است.
 *
 * نسخه در cache نگه داشته می‌شود. اگر evict شود، نسخه به ۰ برمی‌گردد؛ چون در
 * invalidate کلید نسخهٔ قبلی فراموش می‌شود، بدترین حالت «یک بار محاسبهٔ دوباره»
 * است، نه «نمایش دادهٔ کهنه».
 */
class AnalyticsCache
{
    public function remember(string $userId, string $section, Closure $callback): mixed
    {
        if (! (bool) config('analytics.cache.enabled')) {
            return $callback();
        }

        $ttl = (int) config('analytics.cache.ttl_seconds');

        return Cache::remember($this->key($userId, $section), now()->addSeconds($ttl), $callback);
    }

    /**
     * باطل‌کردن همهٔ بخش‌های یک کاربر — بعد از Exam Finish / Progress Update /
     * Study Session.
     *
     * مکانیزم: شمارندهٔ نسخه **یک واحد بالا می‌رود**، پس کلید بعدی تازه است و
     * محاسبهٔ دوباره انجام می‌شود. کلیدهای قدیمی با TTL خودشان می‌میرند؛ لازم
     * نیست شمارش شوند (و نمی‌توان، چون store فهرست‌پذیر نیست).
     *
     * ⚠️ محدودیت مستندشده: اگر فقط همین کلید کوچک از store بیرون بیفتد (LRU)
     * ولی کلیدهای داده بمانند، نسخه به ۰ برمی‌گردد و ممکن است تا TTL کوتاه دادهٔ
     * کهنه دیده شود. برای همین کلید نسخه `forever` نوشته می‌شود و TTL داده کوتاه
     * است — بدترین حالت کراندار باقی می‌ماند.
     */
    public function invalidate(string $userId): void
    {
        if (! (bool) config('analytics.cache.enabled')) {
            return;
        }

        $key = $this->revisionKey($userId);

        if (Cache::has($key)) {
            Cache::increment($key);

            return;
        }

        Cache::forever($key, 1);
    }

    private function key(string $userId, string $section): string
    {
        $prefix = (string) config('analytics.cache.prefix');

        return "{$prefix}:{$section}:{$userId}:".$this->revision($userId);
    }

    private function revision(string $userId): int
    {
        $current = Cache::get($this->revisionKey($userId));

        /* نسخهٔ ۰ در اولین محاسبه؛ افزایش آن کارِ `invalidate` است. */
        return is_numeric($current) ? (int) $current : 0;
    }

    private function revisionKey(string $userId): string
    {
        $prefix = (string) config('analytics.cache.prefix');

        return "{$prefix}:rev:{$userId}";
    }
}
