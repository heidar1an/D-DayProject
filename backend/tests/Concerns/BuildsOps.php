<?php

namespace Tests\Concerns;

use App\Models\Article;
use App\Models\Notification;
use App\Models\User;
use App\Models\WikiArticle;
use App\Services\Notifications\NotificationService;
use App\Services\Search\SearchIndexer;
use Illuminate\Support\Str;

/**
 * ساخت دادهٔ تست فاز ۱۹/۲۰.
 *
 * چرا رکورد مستقیم و نه مسیر API: تست اعلان/جست‌وجو باید **مصرف‌کنندهٔ** داده
 * باشد، نه تولیدکنندهٔ آن. ساخت از مسیر API یعنی تست هر بار به فاز ۱۶ وابسته
 * می‌شود و شکست آنجا این تست‌ها را قرمز می‌کند.
 */
trait BuildsOps
{
    /** @param array<string, mixed> $overrides */
    protected function makeArticle(array $overrides = []): Article
    {
        $article = new Article;
        $article->forceFill([
            'slug' => $overrides['slug'] ?? 'art-'.Str::lower(Str::random(8)),
            'title' => $overrides['title'] ?? 'آناتومی قلب',
            'summary' => $overrides['summary'] ?? 'خلاصه',
            'body' => $overrides['body'] ?? 'متن کامل دربارهٔ کلیه و بافت',
            'status' => $overrides['status'] ?? Article::STATUS_PUBLISHED,
            'version' => 1,
            'published_at' => now(),
        ])->save();

        return $article->refresh();
    }

    /** @param array<string, mixed> $overrides */
    protected function makeWikiArticle(array $overrides = []): WikiArticle
    {
        $article = new WikiArticle;
        $article->forceFill([
            'slug' => $overrides['slug'] ?? 'wiki-'.Str::lower(Str::random(8)),
            'title' => $overrides['title'] ?? 'نیم‌فاصله و کلیه',
            'summary' => $overrides['summary'] ?? 'خلاصه',
            'body' => $overrides['body'] ?? 'متن ویکی دربارهٔ کلیه',
            'status' => $overrides['status'] ?? 'published',
            'version' => 1,
            'published_at' => now(),
        ])->save();

        return $article->refresh();
    }

    protected function indexDocument(string $entityType, string $entityId): void
    {
        app(SearchIndexer::class)->index($entityType, $entityId);
    }

    /** @param array<string, mixed> $payload */
    protected function notify(string $userId, string $type = Notification::TYPE_SYSTEM, array $payload = [], ?string $dedupKey = null): ?Notification
    {
        return app(NotificationService::class)->create($userId, $type, $payload === [] ? ['title' => 'پیام سیستمی'] : $payload, $dedupKey);
    }

    protected function makeStudent(string $phone = '09120000001'): User
    {
        $response = $this->register(['phone' => $phone]);

        /* ثبت‌نام ۲۰۱ می‌دهد، نه ۲۰۰. */
        $response->assertCreated();

        /** @var User */
        return User::query()->where('phone', $phone)->firstOrFail();
    }
}
