<?php

namespace App\Services\Notifications;

use App\Services\Notifications\Channels\InAppChannelProvider;
use App\Services\Notifications\Channels\NotificationChannelProvider;
use App\Services\Notifications\Channels\NullChannelProvider;

/**
 * رجیستری کانال‌ها — فاز ۱۹ (§21/§29).
 *
 * تنها منبع «کدام کانال واقعاً فعال است». کانال بدون Provider واقعی
 * `enabled() === false` است و هرگز تحویل نمی‌شود؛ پس هیچ‌جا «تحویل موفق»
 * بدون Provider ثبت نمی‌شود.
 */
final class ChannelRegistry
{
    /** @return list<string> */
    public function channels(): array
    {
        return array_keys((array) config('notifications.channels', []));
    }

    public function provider(string $channel): NotificationChannelProvider
    {
        if ($channel === 'in_app') {
            return app(InAppChannelProvider::class);
        }

        return new NullChannelProvider($channel);
    }

    public function isEnabled(string $channel): bool
    {
        return in_array($channel, $this->channels(), true) && $this->provider($channel)->enabled();
    }

    /** @return list<string> */
    public function enabledChannels(): array
    {
        return array_values(array_filter($this->channels(), fn (string $channel): bool => $this->isEnabled($channel)));
    }

    /**
     * کانال‌های مؤثر یک نوع اعلان = کانال‌های نوع ∩ کانال‌های فعال.
     *
     * @param  list<string>  $declared
     * @return list<string>
     */
    public function effectiveChannels(array $declared): array
    {
        return array_values(array_filter($declared, fn (string $channel): bool => $this->isEnabled($channel)));
    }
}
