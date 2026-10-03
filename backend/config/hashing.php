<?php

// سیاست هش رمز. Argon2id پیش‌فرض است (BluePrint §12)؛ هش‌های legacy پروژه
// (scrypt / SHA-256) توسط `App\Services\Identity\PasswordHasher` جداگانه
// verify می‌شوند و پس از اولین ورود موفق به Argon2id ارتقا می‌یابند.
//
// `rehash_on_login` عمداً false است: rehash در `AuthenticationService` صریح و
// قابل‌تست انجام می‌شود، نه به‌صورت خودکار و پنهان توسط guard.

return [

    'driver' => env('HASH_DRIVER', 'argon2id'),

    'bcrypt' => [
        'rounds' => env('BCRYPT_ROUNDS', 12),
        'verify' => true,
        'limit' => null,
    ],

    'argon' => [
        'memory' => env('ARGON_MEMORY', 65536),
        'threads' => env('ARGON_THREADS', 1),
        'time' => env('ARGON_TIME', 4),
        'verify' => true,
    ],

    'rehash_on_login' => false,

];
