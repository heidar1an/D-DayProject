<?php

/*
 * پیکربندی Media Core — فاز ۱۵.
 *
 * مرز دامنه: Media فقط مالک «متادیتای فایل + دسترسی به Storage» است؛ هیچ دانستنی
 * دربارهٔ Reference/Anatomy/Article ندارد (§55). Media Center/پلیتفرم انتشار
 * (media_platforms، media_campaigns و…) عمداً ساخته نمی‌شود — Blueprint فاز ۱۷.
 *
 * ⚠️ همهٔ اعداد سقف محافظتی‌اند در config، نه hardcode در کد؛ تغییرشان migration
 * نمی‌خواهد.
 */

return [

    /*
     * دیسک هر visibility. هر دو دیسک در config/filesystems.php از قبل وجود دارند؛
     * فایل خصوصی هرگز زیر web root سرو نمی‌شود و فقط از مسیر استریم امضاشده
     * عبور می‌کند (§71).
     */
    'disks' => [
        'private' => env('MEDIA_PRIVATE_DISK', 'local'),
        'public' => env('MEDIA_PUBLIC_DISK', 'public'),
    ],

    /*
     * عمر Signed URL — کوتاه و وابسته به مجوز لحظه‌ای. پس از انقضا، دسترسی
     * فقط با دریافت URL تازه ممکن است (§6).
     */
    'signed_ttl_minutes' => (int) env('MEDIA_SIGNED_TTL_MINUTES', 10),

    /*
     * انواع فایل مجاز — اعتبارسنجی چندلایه: پسوند + MIME اعلامی + MIME شناسایی‌شده
     * از magic bytes + سقف حجم. هیچ‌کدام به‌تنهایی کافی نیستند (§7).
     * `max_bytes` برای video/model3d بالاتر است چون Use Case واقعی‌شان سنگین است.
     */
    'kinds' => [
        'image' => [
            'extensions' => ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            'mimes' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            'max_bytes' => 10 * 1024 * 1024,
        ],
        'document' => [
            'extensions' => ['pdf'],
            'mimes' => ['application/pdf'],
            'max_bytes' => 50 * 1024 * 1024,
        ],
        'video' => [
            'extensions' => ['mp4', 'webm'],
            'mimes' => ['video/mp4', 'video/webm'],
            'max_bytes' => 200 * 1024 * 1024,
        ],
        'model3d' => [
            'extensions' => ['glb'],
            'mimes' => ['model/gltf-binary', 'application/octet-stream'],
            'max_bytes' => 128 * 1024 * 1024,
        ],
    ],

    /* سقف محافظتی pagination پنل. */
    'pagination' => [
        'per_page' => (int) env('MEDIA_PER_PAGE', 24),
        'max_per_page' => (int) env('MEDIA_MAX_PER_PAGE', 100),
    ],
];
