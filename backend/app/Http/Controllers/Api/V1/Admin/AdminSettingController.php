<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiErrorException;
use App\Http\ApiResponse;
use App\Http\Controllers\Api\V1\Admin\Concerns\ResolvesAdmin;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSettingRequest;
use App\Models\SystemSetting;
use App\Services\Audit\AuditLogger;
use App\Services\Settings\SystemSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

/**
 * تنظیمات سیستم — فاز ۲۰ (§80/§81).
 *
 *   GET   /admin/settings        فهرست کلیدهای مجاز برای همین ادمین
 *   PATCH /admin/settings        تغییر یک کلید (allowlist + optimistic lock)
 *
 * کلید محرمانه فقط نوشتنی است و مقدارش هرگز برنمی‌گردد. تغییرات audit می‌شوند
 * (به‌علاوهٔ audit خودکار middleware، اینجا `changes` redactشده صریح ثبت می‌شود).
 */
final class AdminSettingController extends Controller
{
    use ResolvesAdmin;

    public function __construct(
        private readonly SystemSettingsService $settings,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return ApiResponse::success([
            'settings' => $this->settings->listForAdmin($this->admin($request)),
        ]);
    }

    public function update(UpdateSettingRequest $request): JsonResponse
    {
        $key = (string) $request->validated('key');
        $version = $request->validated('version');

        try {
            $setting = $this->settings->update(
                admin: $this->admin($request),
                key: $key,
                value: $request->validated('value'),
                expectedVersion: $version !== null ? (int) $version : null,
            );
        } catch (InvalidArgumentException $error) {
            /* مقدار نامعتبر برای نوع کلید ⇒ ۴۲۲، نه ۵۰۰. */
            throw ApiErrorException::invalid(['value' => [$error->getMessage()]]);
        }

        return ApiResponse::success([
            'setting' => $this->present($setting),
        ]);
    }

    /** @return array<string, mixed> */
    private function present(SystemSetting $setting): array
    {
        $definition = $this->settings->definition((string) $setting->key);
        $isSecret = (bool) $setting->is_secret;

        return [
            'key' => (string) $setting->key,
            'type' => (string) ($definition['type'] ?? 'string'),
            'secret' => $isSecret,
            'version' => (int) $setting->version,
            /* مقدار محرمانه هرگز برنمی‌گردد — فقط نشانهٔ «تنظیم شده» (§80). */
            'value' => $isSecret ? (string) config('settings.secret_placeholder') : $this->settings->value((string) $setting->key),
            'updatedAt' => $setting->updated_at?->toIso8601String(),
        ];
    }
}
