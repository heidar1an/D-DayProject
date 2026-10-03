<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * نقش‌ها و مجوزهای پنل — **کپیِ دقیق** مدل legacy
 * (`database/contentStore.js`: `PERMISSIONS`, `ADMIN_DENIED_PERMISSIONS`,
 * `SENSITIVE_ANALYTICS`, `ROLES`).
 *
 * چرا هیچ کلید تازه‌ای ساخته نشد: کاربر پنل و دادهٔ legacy با همین کلیدها کار
 * می‌کنند؛ افزودن `questions.*` یعنی دو واژگان موازی برای یک کار. مجوز دامنهٔ
 * بانک سؤال `testbank.*` است و مجوز محتوای درس `comprehensive.*`.
 *
 * ⚠️ این seeder **هیچ ادمینی نمی‌سازد**. ساخت حساب مدیر با رمز مشخص، یک حساب
 * قابل‌حدس در هر محیطی است. ادمین واقعی با `php artisan tapesh:admin:create`
 * ساخته می‌شود.
 */
class AdminRbacSeeder extends Seeder
{
    /** فهرست کامل مجوزها — آینهٔ `PERMISSIONS` در legacy. */
    public const PERMISSIONS = [
        'articles.create', 'articles.read', 'articles.update', 'articles.delete', 'articles.publish',
        'categories.create', 'categories.read', 'categories.update', 'categories.delete',
        'pages.create', 'pages.read', 'pages.update', 'pages.delete',
        'flashcards.create', 'flashcards.read', 'flashcards.update', 'flashcards.delete', 'flashcards.publish',
        'testbank.create', 'testbank.read', 'testbank.update', 'testbank.delete', 'testbank.publish',
        'micro.create', 'micro.read', 'micro.update', 'micro.delete', 'micro.publish',
        'references.create', 'references.read', 'references.update', 'references.delete', 'references.publish',
        'comprehensive.read', 'comprehensive.update', 'comprehensive.publish',
        'intl.read', 'intl.create', 'intl.update', 'intl.delete', 'intl.publish', 'intl.upload',
        'media.upload', 'media.read', 'media.delete',
        'banners.create', 'banners.update', 'banners.delete',
        'users.create', 'users.read', 'users.update', 'users.delete', 'users.superadmin.manage',
        'settings.read', 'settings.update',
        'settings.security.manage',
        'logs.read',
        'feedback.read', 'feedback.manage',
        'notes.create', 'notes.read', 'notes.update', 'notes.delete',
        'publishing.read', 'publishing.send', 'publishing.channels.manage',
        'media.content.manage', 'media.content.review', 'media.content.publish',
        'media.platforms.manage', 'media.team.manage', 'media.ops.manage', 'media.audit.read',
        'analytics.read',
        'analytics.users.read',
        'analytics.seo.read',
        'analytics.revenue.read',
        'analytics.security.read',
        'analytics.alerts.manage',
        'analytics.export',

        /*
         * فاز ۱۹/۲۰ — کلیدهای تازه فقط برای قابلیت‌هایی که **در واژگان legacy
         * وجود نداشتند**: مشاهدهٔ زیرساخت صف/ایندکس/تحویل اعلان، انجام
         * عملیات تعمیراتی (retry/rebuild) و ارسال اعلان از پنل.
         *
         * چرا نزدیک‌ترین کلید موجود استفاده نشد: `logs.read` فقط خواندن لاگ است
         * و `settings.update` تغییر پیکربندی — نه retry صف. جعل معنا یعنی
         * مرز مجوز مبهم می‌شود. این کلیدها به `super-admin` و `admin` داده
         * می‌شوند و `editor` (فهرست صریح) هیچ‌کدام را ندارد.
         */
        'ops.read', 'ops.manage', 'notifications.send',
    ];

    /** سنجه‌های حساس — نقش `admin` این‌ها را ندارد. */
    public const SENSITIVE_ANALYTICS = [
        'analytics.users.read',
        'analytics.revenue.read',
        'analytics.security.read',
        'analytics.alerts.manage',
    ];

    /** مجوزهایی که `admin` هرگز نباید داشته باشد. */
    public const ADMIN_DENIED = [
        'users.delete',
        'users.superadmin.manage',
        'settings.security.manage',
    ];

    /** مجوزهای نقش `editor` — آینهٔ فهرست legacy. */
    public const EDITOR_PERMISSIONS = [
        'articles.create', 'articles.read', 'articles.update', 'articles.publish',
        'categories.create', 'categories.read',
        'pages.read', 'pages.update',
        'flashcards.read', 'flashcards.create', 'flashcards.update', 'flashcards.publish',
        'testbank.read', 'testbank.create', 'testbank.update', 'testbank.publish',
        'micro.read', 'micro.create', 'micro.update', 'micro.publish',
        'references.read', 'references.create', 'references.update', 'references.publish',
        'comprehensive.read', 'comprehensive.update', 'comprehensive.publish',
        'intl.read', 'intl.create', 'intl.update', 'intl.publish', 'intl.upload',
        'media.upload', 'media.read', 'media.delete',
        'notes.create', 'notes.read', 'notes.update', 'notes.delete',
        'publishing.read', 'publishing.send',
        'media.content.manage', 'media.content.publish', 'media.ops.manage',
        'analytics.read',
    ];

    public function run(): void
    {
        foreach (self::PERMISSIONS as $key) {
            Permission::query()->firstOrCreate(['key' => $key]);
        }

        $roles = [
            [Role::SUPER_ADMIN, 'مدیر کل', 'دسترسی کامل به همهٔ بخش‌ها، از جمله تحلیل مالی و امنیتی', true, self::PERMISSIONS],
            [Role::ADMIN, 'مدیر', 'مدیریت محتوا و کاربران + تحلیل عمومی؛ بدون دادهٔ مالی، امنیتی و بدون ارتقا به مدیر کل', false,
                array_values(array_diff(self::PERMISSIONS, array_merge(self::ADMIN_DENIED, self::SENSITIVE_ANALYTICS)))],
            [Role::EDITOR, 'نویسنده', 'ایجاد و ویرایش محتوا + تحلیل عمومی؛ بدون دادهٔ کاربران، مالی و امنیتی', false, self::EDITOR_PERMISSIONS],
        ];

        foreach ($roles as [$key, $name, $description, $isSystem, $permissions]) {
            $role = Role::query()->updateOrCreate(
                ['key' => $key],
                ['name' => $name, 'description' => $description, 'is_system' => $isSystem],
            );

            $ids = Permission::query()->whereIn('key', $permissions)->pluck('id')->all();

            $role->permissions()->sync($ids);
        }
    }
}
