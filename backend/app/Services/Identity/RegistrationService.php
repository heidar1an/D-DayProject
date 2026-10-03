<?php

namespace App\Services\Identity;

use App\Exceptions\ApiErrorException;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * ثبت‌نام — CREATE ONLY.
 *
 * نکته‌های معماری:
 *   • role هرگز از ورودی خوانده نمی‌شود. هر نقشی که Client بفرستد در
 *     `RegisterRequest` با قاعدهٔ `prohibited` رد می‌شود (۴۲۲)، نه اینکه
 *     بی‌صدا نادیده گرفته شود.
 *   • user + profile + session هر سه در **یک تراکنش** ساخته می‌شوند: اگر
 *     پروفایل یا سشن شکست بخورد، حساب نیمه‌ساخته باقی نمی‌ماند (Blueprint §24).
 *   • duplicate: یک pre-check برای پیام بهتر + unique index به‌عنوان تضمین
 *     نهایی. اگر دو درخواست هم‌زمان از pre-check رد شوند، دیتابیس برنده را
 *     تعیین می‌کند و `UniqueConstraintViolationException` به همان ۴۰۹ تبدیل می‌شود.
 *   • رمز و توکن هرگز در پاسخ برنمی‌گردند؛ کوکی سشن در کنترلر ست می‌شود.
 */
class RegistrationService
{
    public function __construct(
        private readonly IdentityNormalizer $normalizer,
        private readonly PasswordHasher $hasher,
        private readonly PasswordPolicy $policy,
        private readonly ProfileService $profiles,
        private readonly SessionManager $sessions,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{user: User, issued: IssuedSession}
     */
    public function register(array $input): array
    {
        $phone = $this->normalizer->phone($this->stringOrNull($input['phone'] ?? null));
        $email = $this->normalizer->email($this->stringOrNull($input['email'] ?? null));
        $password = $this->stringOrNull($input['password'] ?? null) ?? '';

        $errors = [];

        if ($phone === null && $email === null) {
            $errors['phone'][] = 'PHONE_REQUIRED';
        }

        if ($phone !== null && preg_match('/^0\d{9,12}$/', $phone) !== 1) {
            $errors['phone'][] = 'PHONE_MALFORMED';
        }

        if ($email !== null && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $errors['email'][] = 'EMAIL_MALFORMED';
        }

        $policyError = $this->policy->check($password);

        if ($policyError !== null) {
            $errors['password'][] = $policyError['code'];
        }

        if ($errors !== []) {
            throw ApiErrorException::invalid($errors);
        }

        if ($phone !== null && User::query()->where('phone', $phone)->exists()) {
            throw ApiErrorException::alreadyExists();
        }

        if ($email !== null && User::query()->where('email', $email)->exists()) {
            throw ApiErrorException::alreadyExists();
        }

        $profileInput = is_array($input['profile'] ?? null) ? $input['profile'] : [];

        try {
            return DB::transaction(function () use ($phone, $email, $password, $profileInput): array {
                $user = new User;
                $user->forceFill([
                    'phone' => $phone,
                    'email' => $email,
                    'password_hash' => $this->hasher->hash($password),
                    'password_updated_at' => now(),
                ])->save();

                $profile = $this->profiles->createFor($user, $profileInput);
                $issued = $this->sessions->issue($user);

                $user->setRelation('profile', $profile);

                return ['user' => $user, 'issued' => $issued];
            });
        } catch (UniqueConstraintViolationException) {
            throw ApiErrorException::alreadyExists();
        }
    }

    private function stringOrNull(mixed $value): ?string
    {
        return is_string($value) ? $value : null;
    }
}
