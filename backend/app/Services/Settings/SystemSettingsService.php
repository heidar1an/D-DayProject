<?php

namespace App\Services\Settings;

use App\Exceptions\ApiErrorException;
use App\Models\Admin;
use App\Models\SystemSetting;
use App\Services\Identity\RbacService;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * تنظیمات سیستم — فاز ۲۰ (§80/§81).
 *
 *   • فقط کلیدهای allowlist `config/settings.php` قابل خواندن/نوشتن‌اند؛ کلید
 *     ناشناخته ⇒ ۴۲۲ (نه ایجاد پویا).
 *   • کلید محرمانه: مقدار **رمزنگاری‌شده** ذخیره می‌شود و هرگز در پاسخ نمی‌آید
 *     (§80). ⚠️ چرخش `APP_KEY` ⇒ بازرمزنگاری اجباری (همان قاعدهٔ Snapshot).
 *   • `version` = optimistic lock؛ دو ادمین هم‌زمان ⇒ دومی ۴۰۹ (§81/§93).
 *   • مجوز هر کلید از خود تعریف کلید می‌آید (`settings.update` یا
 *     `settings.security.manage`) و در سرویس enforce می‌شود.
 */
final class SystemSettingsService
{
    public function __construct(
        private readonly RbacService $rbac,
    ) {}

    /**
     * فهرست تنظیمات قابل مشاهده برای این ادمین — کلید محرمانه فقط نشانهٔ
     * «تنظیم‌شده/نشده» را می‌دهد، نه مقدار را.
     *
     * @return list<array<string, mixed>>
     */
    public function listForAdmin(Admin $admin): array
    {
        $rows = SystemSetting::query()->get()->keyBy('key');
        $items = [];

        foreach ((array) config('settings.keys', []) as $key => $definition) {
            if (! $this->rbac->allows($admin, (string) ($definition['permission'] ?? 'settings.update'))) {
                continue;
            }

            $row = $rows->get($key);
            $isSecret = (bool) ($definition['secret'] ?? false);

            $items[] = [
                'key' => $key,
                'type' => (string) ($definition['type'] ?? 'string'),
                'description' => (string) ($definition['description'] ?? ''),
                'secret' => $isSecret,
                'version' => $row instanceof SystemSetting ? (int) $row->version : null,
                'value' => $isSecret
                    ? ($row instanceof SystemSetting ? (string) config('settings.secret_placeholder') : null)
                    : $this->present($row, $definition),
                'updatedAt' => $row instanceof SystemSetting ? $row->updated_at?->toIso8601String() : null,
            ];
        }

        return $items;
    }

    /** مقدار مؤثر برای مصرف درون‌برنامه‌ای (پیش‌فرض config اگر ردیف نباشد). */
    public function value(string $key): mixed
    {
        $definition = $this->definition($key);

        /** @var SystemSetting|null $row */
        $row = SystemSetting::query()->where('key', $key)->first();

        if (! $row instanceof SystemSetting) {
            return $definition['default'] ?? null;
        }

        if ((bool) ($definition['secret'] ?? false)) {
            return $row->value === null ? null : Crypt::decryptString((string) $row->value);
        }

        return $this->cast($row->value, $definition);
    }

    /**
     * به‌روزرسانی یک کلید با optimistic lock.
     *
     * @throws ApiErrorException ۴۲۲ کلید ناشناخته/مقدار نامعتبر، ۴۰۳ بدون مجوز، ۴۰۹ نسخهٔ کهنه
     */
    public function update(Admin $admin, string $key, mixed $value, ?int $expectedVersion): SystemSetting
    {
        $definition = $this->definition($key);
        $permission = (string) ($definition['permission'] ?? 'settings.update');

        if (! $this->rbac->allows($admin, $permission)) {
            throw ApiErrorException::forbidden('You do not have permission to change this setting.');
        }

        $isSecret = (bool) ($definition['secret'] ?? false);
        $stored = $isSecret
            ? Crypt::encryptString($this->coerce($value, $definition))
            : $this->coerce($value, $definition);

        return DB::transaction(function () use ($admin, $key, $stored, $isSecret, $expectedVersion): SystemSetting {
            /** @var SystemSetting|null $row */
            $row = SystemSetting::query()->where('key', $key)->lockForUpdate()->first();

            if (! $row instanceof SystemSetting) {
                $row = new SystemSetting;
                $row->forceFill([
                    'key' => $key,
                    'value' => $stored,
                    'is_secret' => $isSecret,
                    'version' => 1,
                    'updated_by_admin_id' => $admin->getKey(),
                ])->save();

                return $row;
            }

            if ($expectedVersion !== null && (int) $row->version !== $expectedVersion) {
                throw new ApiErrorException(
                    'CONFLICT',
                    409,
                    'This setting was changed by another admin. Reload and try again.',
                );
            }

            $row->forceFill([
                'value' => $stored,
                'is_secret' => $isSecret,
                'version' => (int) $row->version + 1,
                'updated_by_admin_id' => $admin->getKey(),
            ])->save();

            return $row;
        });
    }

    /** @return array<string, mixed> */
    public function definition(string $key): array
    {
        /*
         * ⚠️ کلیدهای allowlist خودشان نقطه دارند (`site.announcement`) ⇒
         * `config('settings.keys.site.announcement')` آن را تودرتو می‌خواند و
         * همیشه null می‌دهد («Unknown setting key» برای کلید معتبر).
         */
        $keys = (array) config('settings.keys', []);
        $definition = $keys[$key] ?? null;

        if (! is_array($definition)) {
            throw new ApiErrorException(
                'VALIDATION_FAILED',
                422,
                'Unknown setting key.',
                ['key' => ['UNKNOWN_SETTING_KEY']],
            );
        }

        return $definition;
    }

    /** @return list<string> */
    public function keys(): array
    {
        return array_keys((array) config('settings.keys', []));
    }

    /** @param array<string, mixed> $definition */
    private function coerce(mixed $value, array $definition): string
    {
        $type = (string) ($definition['type'] ?? 'string');

        return match ($type) {
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOL) ? '1' : '0',
            'integer' => (string) $this->integer($value, $definition),
            default => $this->string($value, $definition),
        };
    }

    /** @param array<string, mixed> $definition */
    private function integer(mixed $value, array $definition): int
    {
        if (! is_numeric($value)) {
            throw new InvalidArgumentException('Setting value must be an integer.');
        }

        $number = (int) $value;
        $min = $definition['min'] ?? null;
        $max = $definition['max'] ?? null;

        if ($min !== null && $number < (int) $min) {
            throw new InvalidArgumentException('Setting value is below the minimum.');
        }

        if ($max !== null && $number > (int) $max) {
            throw new InvalidArgumentException('Setting value is above the maximum.');
        }

        return $number;
    }

    /** @param array<string, mixed> $definition */
    private function string(mixed $value, array $definition): string
    {
        if (! is_scalar($value)) {
            throw new InvalidArgumentException('Setting value must be a string.');
        }

        $text = trim((string) $value);
        $max = (int) ($definition['max'] ?? 0);

        if ($max > 0 && mb_strlen($text) > $max) {
            throw new InvalidArgumentException('Setting value is too long.');
        }

        return $text;
    }

    /** @param array<string, mixed> $definition */
    private function present(?SystemSetting $row, array $definition): mixed
    {
        if (! $row instanceof SystemSetting) {
            return $definition['default'] ?? null;
        }

        return $this->cast($row->value, $definition);
    }

    /** @param array<string, mixed> $definition */
    private function cast(?string $value, array $definition): mixed
    {
        if ($value === null) {
            return $definition['default'] ?? null;
        }

        return match ((string) ($definition['type'] ?? 'string')) {
            'boolean' => $value === '1' || filter_var($value, FILTER_VALIDATE_BOOL),
            'integer' => (int) $value,
            default => $value,
        };
    }
}
