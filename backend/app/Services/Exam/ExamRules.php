<?php

namespace App\Services\Exam;

use App\Exceptions\ApiErrorException;

/**
 * قوانین آزمون — ساختار **versioned و validate شده** (فاز ۷).
 *
 * چرا value object و نه آرایهٔ آزاد: `rules` در JSONB است و اگر بدون قید نوشته
 * شود، هر کسی می‌تواند کلید دلخواه («score: 100») اضافه کند و لایه‌های بعدی
 * بی‌صدا آن را نادیده بگیرند. اینجا:
 *   • کلید ناشناخته ⇒ ۴۲۲ (fail-closed، نه نادیده‌گرفتن خاموش)؛
 *   • نوع و بازهٔ هر مقدار صریح است؛
 *   • `version` اجباری و یکنواست تا اسنپ‌شات‌های قدیمی قابل تشخیص بمانند.
 *
 * ⚠️ **قوانین query-critical اینجا نیستند.** `attempt_limit`, `negative_marking`,
 * `duration_minutes`, `result_release_at` و `grace_seconds` ستون جدی دارند تا
 * Query/Index روی آن‌ها معنا داشته باشد.
 *
 * پارامترهای `allow_back_navigation`/`allow_marking` عمداً از legacy حفظ شده‌اند
 * ولی سرور آن‌ها را **اجرا نمی‌کند** — همان‌طور که legacy هم نمی‌کرد. این‌ها
 * فقط راهنمای نمایشی‌اند و به‌عنوان «اجراشده» معرفی نمی‌شوند.
 */
final class ExamRules
{
    public const CURRENT_VERSION = 1;

    public const DEADLINE_EXAM_END = 'exam_end';

    public const DEADLINE_PER_ATTEMPT = 'per_attempt';

    public const DEADLINE_MODES = [self::DEADLINE_EXAM_END, self::DEADLINE_PER_ATTEMPT];

    private const ALLOWED_KEYS = [
        'version', 'deadline_mode', 'allow_review', 'allow_answer_change',
        'allow_back_navigation', 'allow_marking', 'late_registration', 'guest',
    ];

    /**
     * @param  array{deadline_mode: string, allow_review: bool, allow_answer_change: bool, allow_back_navigation: bool, allow_marking: bool, late_registration: bool, guest: array{allowed: bool}}  $values
     */
    private function __construct(private readonly array $values, private readonly int $version) {}

    /**
     * ساخت از ورودی خام ادمین/seed. کلید ناشناخته یا مقدار نامعتبر ⇒ ۴۲۲.
     *
     * @param  array<string, mixed>  $raw
     */
    public static function fromArray(array $raw): self
    {
        $unknown = array_diff(array_keys($raw), self::ALLOWED_KEYS);

        if ($unknown !== []) {
            throw ApiErrorException::invalid([
                'rules' => array_map(static fn (string $key): string => "UNKNOWN_RULE:{$key}", $unknown),
            ], 'Unknown exam rule keys are not accepted.');
        }

        $version = $raw['version'] ?? self::CURRENT_VERSION;

        if (! is_int($version) || $version < 1) {
            throw ApiErrorException::invalid(['rules.version' => ['INVALID_RULE_VERSION']]);
        }

        if ($version !== self::CURRENT_VERSION) {
            throw ApiErrorException::invalid(['rules.version' => ['UNSUPPORTED_RULE_VERSION']]);
        }

        $deadlineMode = $raw['deadline_mode'] ?? self::DEADLINE_EXAM_END;

        if (! is_string($deadlineMode) || ! in_array($deadlineMode, self::DEADLINE_MODES, true)) {
            throw ApiErrorException::invalid(['rules.deadline_mode' => ['INVALID_DEADLINE_MODE']]);
        }

        $guest = $raw['guest'] ?? [];
        if (! is_array($guest) || array_diff(array_keys($guest), ['allowed']) !== []) {
            throw ApiErrorException::invalid(['rules.guest' => ['INVALID_GUEST_RULES']]);
        }

        return new self([
            'deadline_mode' => $deadlineMode,
            'allow_review' => self::bool($raw, 'allow_review', true),
            'allow_answer_change' => self::bool($raw, 'allow_answer_change', true),
            'allow_back_navigation' => self::bool($raw, 'allow_back_navigation', true),
            'allow_marking' => self::bool($raw, 'allow_marking', true),
            'late_registration' => self::bool($raw, 'late_registration', false),
            'guest' => ['allowed' => self::bool($guest, 'allowed', false)],
        ], $version);
    }

    /** پیش‌فرض امن برای آزمونی که `rules` ندارد (مثلاً آزمون ساخته‌شدهٔ legacy). */
    public static function defaults(): self
    {
        return self::fromArray([]);
    }

    /** @param array<string, mixed> $source */
    private static function bool(array $source, string $key, bool $default): bool
    {
        $value = $source[$key] ?? $default;

        if (! is_bool($value)) {
            throw ApiErrorException::invalid(["rules.{$key}" => ['NOT_A_BOOLEAN']]);
        }

        return $value;
    }

    /** @return array<string, mixed> شکل قابل ذخیره در JSONB (شامل version). */
    public function toArray(): array
    {
        return ['version' => $this->version] + $this->values;
    }

    public function version(): int
    {
        return $this->version;
    }

    public function deadlineMode(): string
    {
        return $this->values['deadline_mode'];
    }

    public function perAttemptDeadline(): bool
    {
        return $this->values['deadline_mode'] === self::DEADLINE_PER_ATTEMPT;
    }

    public function allowsReview(): bool
    {
        return $this->values['allow_review'];
    }

    public function allowsAnswerChange(): bool
    {
        return $this->values['allow_answer_change'];
    }

    public function allowsLateRegistration(): bool
    {
        return $this->values['late_registration'];
    }

    public function allowsGuest(): bool
    {
        return $this->values['guest']['allowed'];
    }

    /**
     * زیرمجموعهٔ **امن برای نمایش** به دانشجو.
     *
     * چرا همهٔ قوانین عمومی نیستند: دانستن `attempt_limit`/`negative_marking` از
     * ستون‌های آزمون می‌آید و UI لازمش دارد، ولی نگاشت داخلی تصمیم‌گیری
     * (`deadline_mode`) و وضعیت `guest` لازم نیست به کلاینت برود.
     *
     * @return array<string, mixed>
     */
    public function publicView(): array
    {
        return [
            'allow_review' => $this->allowsReview(),
            'allow_answer_change' => $this->allowsAnswerChange(),
            'allow_back_navigation' => $this->values['allow_back_navigation'],
            'allow_marking' => $this->values['allow_marking'],
        ];
    }
}
