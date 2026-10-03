<?php

namespace App\Services\Identity;

use App\Exceptions\ApiErrorException;
use App\Models\University;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * نوشتن پروفایل — تنها مسیر مجاز تغییر دادهٔ پروفایل.
 *
 * دو لایه محافظت:
 *   1. whitelist صریح کلیدها (`$mutable`) — هر کلید ناشناخته **نادیده گرفته
 *      نمی‌شود**، بلکه در FormRequest رد شده است. اینجا دوباره فیلتر می‌شود تا
 *      حتی اگر کسی سرویس را مستقیم صدا بزند، mass assignment ممکن نباشد.
 *   2. validation معنایی (allowlist ها، uniqueness، وجود دانشگاه) که به کد خطای
 *      فیلدی تبدیل می‌شود.
 *
 * هیچ‌کدام از این کلیدها قابل تغییر نیستند و در `$mutable` نیستند:
 * id, user_id, phone, email, password_hash, role, permissions, entitlement.
 */
class ProfileService
{
    /** @var list<string> */
    private const MUTABLE = [
        'username',
        'first_name',
        'last_name',
        'university',
        'university_id',
        'term',
        'grade',
        'birth_date_jalali',
        'gender',
        'avatar_key',
        'motivations',
        'referrals',
    ];

    public function __construct(private readonly IdentityNormalizer $normalizer) {}

    /** پروفایل اولیه — همیشه یک ردیف وجود دارد تا `/me` هرگز بدون profile نباشد. */
    public function createFor(User $user, array $input = []): UserProfile
    {
        $profile = new UserProfile;
        $profile->user_id = $user->getKey();

        return $this->apply($profile, $input);
    }

    /** PATCH: فقط کلیدهای آمده در ورودی تغییر می‌کنند (semantics واقعی PATCH). */
    public function update(User $user, array $input): UserProfile
    {
        $profile = UserProfile::query()->firstOrNew(['user_id' => $user->getKey()]);

        return $this->apply($profile, $input);
    }

    private function apply(UserProfile $profile, array $input): UserProfile
    {
        $errors = [];

        foreach (self::MUTABLE as $key) {
            if (! array_key_exists($key, $input)) {
                continue;
            }

            $value = $input[$key];

            switch ($key) {
                case 'username':
                    $username = $this->normalizer->username(is_string($value) ? $value : null);
                    if ($username !== null && ! $this->usernameValid($username)) {
                        $errors['username'][] = 'USERNAME_MALFORMED';
                    } elseif ($username !== null && $this->usernameTaken($username, $profile)) {
                        throw ApiErrorException::usernameTaken();
                    }
                    $profile->username = $username;
                    break;

                case 'first_name':
                case 'last_name':
                    $text = $this->normalizer->text(is_string($value) ? $value : null);
                    if ($text !== null && mb_strlen($text) > (int) config('identity.profile.name_max')) {
                        $errors[$key][] = 'NAME_TOO_LONG';
                    }
                    $profile->{$key} = $text;
                    break;

                case 'university':
                    // نام کامل دانشگاه (قرارداد قدیمی) → UUID؛ اگر `university_id`
                    // هم آمده باشد، در ادامه همان اولویت دارد.
                    $byName = $this->resolveUniversityByName($value, $errors);
                    if ($byName !== null || $value === null || $value === '') {
                        $profile->university_id = $byName;
                    }
                    break;

                case 'university_id':
                    $profile->university_id = $this->resolveUniversity($value, $errors);
                    break;

                case 'term':
                    $term = $this->normalizer->term(is_string($value) || is_int($value) ? (string) $value : null);
                    $range = config('identity.profile.term');
                    if ($term !== null && (! ctype_digit($term) || (int) $term < (int) $range['min'] || (int) $term > (int) $range['max'])) {
                        $errors['term'][] = 'TERM_OUT_OF_RANGE';
                    }
                    $profile->term = $term;
                    break;

                case 'grade':
                    $profile->grade = $this->allowlisted('grade', $value, $errors);
                    break;

                case 'gender':
                    $profile->gender = $this->allowlisted('gender', $value, $errors);
                    break;

                case 'avatar_key':
                    $avatar = $this->normalizer->text(is_string($value) ? $value : null);
                    if ($avatar !== null && preg_match((string) config('identity.profile.avatar.pattern'), $avatar) !== 1) {
                        $errors['avatar_key'][] = 'UNKNOWN_AVATAR';
                    }
                    $profile->avatar_key = $avatar;
                    break;

                case 'birth_date_jalali':
                    $birth = $this->normalizer->digits($this->normalizer->text(is_string($value) ? $value : null) ?? '');
                    if ($birth !== '' && preg_match((string) config('identity.profile.birth_date_jalali.pattern'), $birth) !== 1) {
                        $errors['birth_date_jalali'][] = 'INVALID_DATE';
                    }
                    $profile->birth_date_jalali = $birth === '' ? null : $birth;
                    break;

                case 'motivations':
                    $profile->motivations = $this->optionList('motivations', $value, $errors);
                    break;

                case 'referrals':
                    $profile->referrals = $this->optionList('referrals', $value, $errors);
                    break;
            }
        }

        if ($errors !== []) {
            throw ApiErrorException::invalid($errors);
        }

        try {
            $profile->save();
        } catch (UniqueConstraintViolationException) {
            // race: دو درخواست هم‌زمان با یک username ⇒ دیتابیس برنده را تعیین می‌کند
            throw ApiErrorException::usernameTaken();
        }

        return $profile->refresh();
    }

    private function usernameValid(string $username): bool
    {
        $rule = config('identity.profile.username');

        return preg_match((string) $rule['pattern'], $username) === 1
            && mb_strlen($username) >= (int) $rule['min']
            && mb_strlen($username) <= (int) $rule['max'];
    }

    private function usernameTaken(string $username, UserProfile $profile): bool
    {
        return UserProfile::query()
            ->where('username', $username)
            ->when($profile->getKey() !== null, fn ($query) => $query->whereKeyNot($profile->getKey()))
            ->exists();
    }

    /** @param array<string, list<string>> $errors */
    private function resolveUniversity(mixed $value, array &$errors): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_string($value)) {
            $errors['university_id'][] = 'UNKNOWN_UNIVERSITY';

            return null;
        }

        $exists = University::query()->whereKey($value)->where('active', true)->exists();

        if (! $exists) {
            $errors['university_id'][] = 'UNKNOWN_UNIVERSITY';

            return null;
        }

        return $value;
    }

    /** @param array<string, list<string>> $errors */
    private function resolveUniversityByName(mixed $value, array &$errors): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_string($value)) {
            $errors['university'][] = 'UNKNOWN_UNIVERSITY';

            return null;
        }

        $university = University::query()
            ->where('name', trim($value))
            ->where('active', true)
            ->first();

        if ($university === null) {
            $errors['university'][] = 'UNKNOWN_UNIVERSITY';

            return null;
        }

        return $university->getKey();
    }

    /** @param array<string, list<string>> $errors */
    private function allowlisted(string $field, mixed $value, array &$errors): ?string
    {
        $allowed = config('identity.profile.'.($field === 'grade' ? 'grades' : 'genders'));

        if ($value === null || $value === '') {
            return null;
        }

        if (! is_string($value) || ! in_array($value, $allowed, true)) {
            $errors[$field === 'grade' ? 'grade' : 'gender'][] = 'INVALID_OPTION';

            return null;
        }

        return $value;
    }

    /**
     * فهرست گزینه‌ها (motivations/referrals).
     * مقدار نامعتبر **حذف نمی‌شود** بلکه رد می‌شود؛ سکوت در برابر دادهٔ ناشناخته
     * یعنی پروفایل ناقص بدون هیچ نشانه‌ای.
     *
     * @param  array<string, list<string>>  $errors
     * @return list<string>|null
     */
    private function optionList(string $field, mixed $value, array &$errors): ?array
    {
        if ($value === null || $value === []) {
            return null;
        }

        if (! is_array($value)) {
            $errors[$field][] = 'INVALID_OPTION';

            return null;
        }

        $allowed = config('identity.profile.'.$field);
        $items = [];

        foreach ($value as $item) {
            if (! is_string($item) || ! in_array($item, $allowed, true)) {
                $errors[$field][] = 'INVALID_OPTION';
            } else {
                $items[] = $item;
            }
        }

        if (count($items) > (int) config('identity.profile.max_list_items')) {
            $errors[$field][] = 'TOO_MANY_ITEMS';
        }

        return $items === [] ? null : array_values(array_unique($items));
    }
}
