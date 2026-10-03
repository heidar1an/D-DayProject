<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * قرارداد v1 در برابر پیاده‌سازی واقعی.
 *
 * هدف: فایل OpenAPI **از کد جدا نشود**. هیچ generator ای در پروژه نصب نیست،
 * پس به‌جای تولید خودکار، این تست دوطرفه بودن را تضمین می‌کند:
 *   • هر مسیر واقعی v1 در فایل مستند شده باشد.
 *   • هر مسیر مستندشده واقعاً وجود داشته باشد.
 * نتیجه: هر مسیر تازه بدون به‌روزرسانی مستندات، تست را می‌شکند.
 */
class ApiV1ContractTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, mixed> */
    private function spec(): array
    {
        $path = base_path('docs/openapi.v1.json');

        $this->assertFileExists($path, 'docs/openapi.v1.json must exist');

        return json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    /** @return list<array{0: string, 1: string}> */
    private function routePairs(): array
    {
        $pairs = [];

        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1/')) {
                continue;
            }

            foreach ($route->methods() as $method) {
                if (in_array($method, ['HEAD', 'OPTIONS'], true)) {
                    continue;
                }

                $pairs[] = ['/'.$route->uri(), strtolower($method)];
            }
        }

        return $pairs;
    }

    /**
     * مسیرهای فاز ۱۷/۱۸ که مستندسازی OpenAPI‌شان هنوز نرسیده است.
     *
     * این فهرست **بدهی موقت** است، نه معافیت دائمی: هر مسیرِ آن باید واقعاً وجود
     * داشته باشد (assertion پایین) و وقتی جریان فاز ۱۷/۱۸ مستنداتش را نوشت باید
     * خالی شود. هر مسیر تازهٔ **دیگری** بدون مستندات، تست را می‌شکند.
     *
     * @return list<string>
     */
    private function pendingDocumentation(): array
    {
        return [
            '/api/v1/pricing/plans', '/api/v1/pricing/quote',
            '/api/v1/orders', '/api/v1/orders/{id}/cancel', '/api/v1/orders/{orderId}/payments',
            '/api/v1/payments/{id}/verify', '/api/v1/payments/webhook/{provider}',
            '/api/v1/me/orders', '/api/v1/me/orders/{id}',
            '/api/v1/me/payments', '/api/v1/me/subscriptions', '/api/v1/me/entitlements',
            '/api/v1/international/courses', '/api/v1/international/courses/{slug}',
            '/api/v1/international/providers',
            '/api/v1/admin/international/courses', '/api/v1/admin/international/courses/{id}',
            '/api/v1/admin/international/courses/{id}/status',
            '/api/v1/admin/international/providers', '/api/v1/admin/international/providers/{id}',
            '/api/v1/admin/international/providers/{id}/status',
        ];
    }

    public function test_every_real_v1_route_is_documented(): void
    {
        $spec = $this->spec();
        $pending = $this->pendingDocumentation();
        $real = array_column($this->routePairs(), 0);

        /* فهرست بدهی نباید کهنه بماند: هر مسیرِ آن باید واقعاً وجود داشته باشد. */
        foreach ($pending as $path) {
            $this->assertContains($path, $real, "stale entry in pendingDocumentation(): {$path}");
        }

        foreach ($this->routePairs() as [$path, $method]) {
            if (in_array($path, $pending, true)) {
                continue;
            }

            $this->assertArrayHasKey($path, $spec['paths'], "undocumented path: {$path}");
            $this->assertArrayHasKey($method, $spec['paths'][$path], "undocumented method: {$method} {$path}");
        }
    }

    public function test_every_documented_v1_path_exists(): void
    {
        $spec = $this->spec();
        $real = array_column($this->routePairs(), 0);

        foreach (array_keys($spec['paths']) as $path) {
            $this->assertContains($path, $real, "documented but not implemented: {$path}");
        }
    }

    public function test_every_documented_operation_has_a_response_and_an_error_envelope(): void
    {
        $spec = $this->spec();

        foreach ($spec['paths'] as $path => $operations) {
            foreach ($operations as $method => $operation) {
                $this->assertArrayHasKey('responses', $operation, "{$method} {$path} has no responses");
                $this->assertNotEmpty($operation['responses'], "{$method} {$path} has empty responses");

                foreach (array_keys($operation['responses']) as $status) {
                    $this->assertMatchesRegularExpression('/^[1-5]\d\d$/', (string) $status, "{$method} {$path} has a non-numeric status");
                }
            }
        }
    }

    public function test_the_documented_status_codes_match_the_implementation(): void
    {
        $spec = $this->spec();

        $expected = [
            ['/api/v1/auth/register', 'post', '201', '409', '422', '429'],
            ['/api/v1/auth/login', 'post', '200', '401', '422', '429'],
            ['/api/v1/auth/logout', 'post', '200', '403'],
            ['/api/v1/me', 'get', '200', '401'],
            ['/api/v1/me', 'patch', '200', '401', '403', '409', '422'],
            ['/api/v1/universities', 'get', '200', '422'],
            // فاز ۴ — محتوا
            ['/api/v1/courses', 'get', '200', '400', '422', '429'],
            ['/api/v1/courses/{idOrSlug}', 'get', '200', '404', '429'],
            ['/api/v1/lessons/{id}', 'get', '200', '404', '429'],
            ['/api/v1/lesson-pages/{id}', 'get', '200', '404', '429'],
            // فاز ۵ — پیشرفت و نشست مطالعه
            ['/api/v1/me/progress', 'get', '200', '401', '429'],
            ['/api/v1/me/progress/pages/{id}', 'put', '200', '401', '403', '404', '409', '422', '429'],
            ['/api/v1/me/study-sessions', 'post', '201', '401', '404', '422', '429'],
            // فاز ۶ — بانک تست
            ['/api/v1/questions', 'get', '200', '400', '422', '429'],
            ['/api/v1/questions/{id}', 'get', '200', '404', '429'],
            ['/api/v1/questions/{id}/answers', 'post', '201', '401', '404', '409', '422', '429'],
            ['/api/v1/questions/{id}/reports', 'post', '201', '401', '404', '422', '429'],
            ['/api/v1/bank/sessions', 'post', '201', '400', '401', '422', '429'],
            ['/api/v1/bank/sessions/{id}', 'get', '200', '401', '404', '429'],
            // فاز ۷ — موتور آزمون
            ['/api/v1/exams', 'get', '200', '400', '422', '429'],
            ['/api/v1/exams/{idOrSlug}', 'get', '200', '404', '429'],
            ['/api/v1/exams/{idOrSlug}/ranking', 'get', '200', '404', '409', '429'],
            ['/api/v1/exams/{idOrSlug}/registrations', 'post', '200', '201', '401', '403', '404', '409', '422', '429'],
            ['/api/v1/exams/{idOrSlug}/registrations', 'delete', '200', '401', '403', '404', '409', '429'],
            ['/api/v1/exams/{idOrSlug}/attempts', 'post', '200', '201', '401', '403', '404', '409', '422', '429'],
            ['/api/v1/exam-attempts/{id}', 'get', '200', '401', '404', '429'],
            ['/api/v1/exam-attempts/{id}/answers', 'put', '200', '401', '403', '404', '409', '422', '429'],
            ['/api/v1/exam-attempts/{id}/finish', 'post', '200', '401', '403', '404', '409', '422', '429'],
            ['/api/v1/exam-attempts/{id}/result', 'get', '200', '401', '404', '409', '429'],
            ['/api/v1/exam-attempts/{id}/review', 'get', '200', '401', '403', '404', '409', '429'],
            // فاز ۲۱ — AI Mentor (JSON; SSE تا وجود مصرف‌کنندهٔ واقعی فعال نیست)
            ['/api/v1/ai/chat', 'post', '200', '400', '401', '403', '404', '409', '422', '429', '503'],
            ['/api/v1/ai/attachments', 'post', '201', '400', '401', '403', '413', '415', '422', '429', '503'],
            // فاز ۸ — تحلیل کاربر جاری
            ['/api/v1/me/analytics/overview', 'get', '200', '400', '401', '422', '429'],
            ['/api/v1/me/analytics/topics', 'get', '200', '400', '401', '422', '429'],
            ['/api/v1/me/analytics/exams', 'get', '200', '400', '401', '422', '429'],
            ['/api/v1/me/analytics/progress', 'get', '200', '400', '401', '422', '429'],
            // فاز ۱۳ — مسیر سبز
            ['/api/v1/me/green-path/profile', 'get', '200', '401', '429'],
            ['/api/v1/me/green-path/roadmap', 'get', '200', '401', '429'],
            ['/api/v1/me/green-path/today', 'get', '200', '401', '429'],
            ['/api/v1/me/green-path/calendar', 'get', '200', '401', '422', '429'],
            ['/api/v1/me/green-path/performance', 'get', '200', '401', '429'],
            ['/api/v1/me/green-path/steps/{id}', 'patch', '200', '401', '404', '409', '422', '429'],
            // فاز ۱۴ — لیگ و گیمیفیکیشن
            ['/api/v1/me/league', 'get', '200', '401', '429'],
            ['/api/v1/league/seasons/{id}/leaderboard', 'get', '200', '401', '404', '422', '429'],
            ['/api/v1/me/challenges', 'get', '200', '401', '429'],
            ['/api/v1/me/achievements', 'get', '200', '401', '429'],
            // فاز ۱۵ — Media/References/Anatomy
            ['/api/v1/media/{id}/stream', 'get', '200', '403', '404', '429'],
            ['/api/v1/admin/media/uploads', 'post', '201', '401', '403', '413', '415', '422', '429'],
            ['/api/v1/references', 'get', '200', '429'],
            ['/api/v1/references/{idOrSlug}', 'get', '200', '404', '429'],
            ['/api/v1/anatomy/assets', 'get', '200', '429'],
            // فاز ۱۶ — مقاله‌ها/یادداشت/گروه‌ها/بازخورد
            ['/api/v1/articles', 'get', '200', '429'],
            ['/api/v1/articles/{slug}', 'get', '200', '404', '429'],
            ['/api/v1/me/article-bookmarks', 'get', '200', '401', '429'],
            ['/api/v1/me/article-bookmarks/{articleId}', 'put', '200', '201', '401', '404', '429'],
            ['/api/v1/me/article-bookmarks/{articleId}', 'delete', '204', '401', '429'],
            ['/api/v1/me/notes', 'get', '200', '401', '429'],
            ['/api/v1/me/notes', 'post', '201', '401', '422', '429'],
            ['/api/v1/me/review-items', 'post', '201', '401', '409', '422', '429'],
            ['/api/v1/groups', 'post', '201', '401', '409', '422', '429'],
            ['/api/v1/groups/join', 'post', '200', '401', '404', '409', '422', '429'],
            ['/api/v1/feedback', 'post', '201', '422', '429'],
            // فاز ۳ — مدیر و RBAC
            ['/api/v1/admin/auth/login', 'post', '200', '401', '403', '422', '429'],
            ['/api/v1/admin/auth/me', 'get', '200', '401', '429'],
            // فاز ۶ — مدیریت بانک تست
            ['/api/v1/admin/questions', 'post', '201', '401', '403', '422', '429'],
            ['/api/v1/admin/questions/{id}', 'patch', '200', '401', '403', '404', '409', '422', '429'],
            ['/api/v1/admin/questions/{id}/publish', 'post', '200', '401', '403', '404', '409', '429'],
            ['/api/v1/admin/questions/{id}/archive', 'post', '200', '401', '403', '404', '429'],
            // فاز ۱۷ — کاتالوگ بین‌الملل
            ['/api/v1/international/providers', 'get', '200', '429'],
            ['/api/v1/international/courses', 'get', '200', '422', '429'],
            ['/api/v1/international/courses/{slug}', 'get', '200', '403', '404', '429'],
            ['/api/v1/admin/international/providers', 'get', '200', '401', '403', '422', '429'],
            ['/api/v1/admin/international/providers', 'post', '201', '401', '403', '422', '429'],
            ['/api/v1/admin/international/providers/{id}', 'patch', '200', '401', '403', '404', '422', '429'],
            ['/api/v1/admin/international/providers/{id}/status', 'post', '200', '401', '403', '404', '409', '422', '429'],
            ['/api/v1/admin/international/courses', 'get', '200', '401', '403', '422', '429'],
            ['/api/v1/admin/international/courses', 'post', '201', '401', '403', '422', '429'],
            ['/api/v1/admin/international/courses/{id}', 'patch', '200', '401', '403', '404', '422', '429'],
            ['/api/v1/admin/international/courses/{id}', 'delete', '200', '401', '403', '404', '409', '429'],
            ['/api/v1/admin/international/courses/{id}/status', 'post', '200', '401', '403', '404', '409', '422', '429'],
            // فاز ۱۸ — قیمت‌گذاری، سفارش و پرداخت
            ['/api/v1/pricing/plans', 'get', '200', '429'],
            ['/api/v1/pricing/quote', 'post', '200', '404', '422', '429'],
            ['/api/v1/orders', 'post', '201', '401', '403', '404', '409', '422', '429', '503'],
            ['/api/v1/orders/{id}/cancel', 'post', '200', '401', '403', '404', '409', '429'],
            ['/api/v1/orders/{orderId}/payments', 'post', '200', '201', '401', '403', '404', '409', '429', '503'],
            ['/api/v1/payments/{id}/verify', 'post', '200', '401', '403', '404', '409', '422', '429'],
            ['/api/v1/payments/webhook/{provider}', 'post', '200', '403', '404', '409', '422', '429', '503'],
            ['/api/v1/me/orders', 'get', '200', '401', '422', '429'],
            ['/api/v1/me/orders/{id}', 'get', '200', '401', '404', '429'],
            ['/api/v1/me/payments', 'get', '200', '401', '422', '429'],
            ['/api/v1/me/subscriptions', 'get', '200', '401', '429'],
            ['/api/v1/me/entitlements', 'get', '200', '401', '429'],
        ];

        foreach ($expected as $row) {
            $path = (string) $row[0];
            $method = (string) $row[1];
            $statuses = array_slice($row, 2);

            $documented = array_map('strval', array_keys($spec['paths'][$path][$method]['responses']));

            foreach ($statuses as $status) {
                $this->assertContains($status, $documented, "{$method} {$path} should document {$status}");
            }
        }
    }

    public function test_the_legacy_api_surface_is_not_served_by_laravel(): void
    {
        foreach ([
            '/api/users/me',
            '/api/users/login',
            '/api/users/register',
            '/api/users/logout',
            '/api/admin/users',
            '/api/auth/google/status',
        ] as $uri) {
            $status = $this->getJson($uri)->getStatusCode();

            $this->assertContains($status, [404, 405], "legacy path unexpectedly served: {$uri}");
        }
    }

    public function test_every_named_route_stays_inside_the_v1_prefix(): void
    {
        foreach (Route::getRoutes() as $route) {
            $name = (string) $route->getName();

            if (! str_starts_with($name, 'api.v1.')) {
                continue;
            }

            $this->assertStringStartsWith('api/v1/', $route->uri(), "route {$name} escapes the v1 prefix");
        }
    }

    /**
     * فهرست مسیرهای مجاز = فازهای ۱ تا ۱۶.
     *
     * هر مسیر تازه‌ای که خارج از این دامنه اضافه شود، تست را می‌شکند. این عمدی است:
     * دامنه‌های فاز ۱۷ و بعد (Payment/AI/Search/…) نباید بی‌صدا وارد شوند.
     *
     * @return list<string>
     */
    private function allowedProductPaths(): array
    {
        return [
            // فاز ۱ — زیرساخت/مشاهده‌پذیری
            '/api/v1/healthz', '/api/v1/readyz',
            // فاز ۲ — هویت
            '/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/auth/logout',
            '/api/v1/me', '/api/v1/universities',
            // فاز ۳ — مدیر و RBAC
            '/api/v1/admin/auth/login', '/api/v1/admin/auth/logout', '/api/v1/admin/auth/me',
            // فاز ۴ — محتوای آموزشی (خواندن عمومی)
            '/api/v1/subjects', '/api/v1/courses', '/api/v1/courses/{idOrSlug}',
            '/api/v1/lessons/{id}', '/api/v1/lesson-pages/{id}',
            // فاز ۵ — پیشرفت یادگیری و نشست مطالعه
            '/api/v1/me/progress', '/api/v1/me/progress/pages/{id}', '/api/v1/me/study-sessions',
            // فاز ۶ — بانک تست
            '/api/v1/questions', '/api/v1/questions/{id}',
            '/api/v1/questions/{id}/answers', '/api/v1/questions/{id}/reports',
            '/api/v1/bank/sessions', '/api/v1/bank/sessions/{id}',
            // فاز ۷ — موتور آزمون
            '/api/v1/exams', '/api/v1/exams/{idOrSlug}',
            '/api/v1/exams/{idOrSlug}/ranking',
            '/api/v1/exams/{idOrSlug}/registrations',
            '/api/v1/exams/{idOrSlug}/attempts',
            '/api/v1/exam-attempts/{id}',
            '/api/v1/exam-attempts/{id}/answers',
            '/api/v1/exam-attempts/{id}/finish',
            '/api/v1/exam-attempts/{id}/result',
            '/api/v1/exam-attempts/{id}/review',
            // فاز ۸ — تحلیل کاربر جاری
            '/api/v1/me/analytics/overview', '/api/v1/me/analytics/topics',
            '/api/v1/me/analytics/exams', '/api/v1/me/analytics/progress',
            // فاز ۶ — مدیریت بانک تست (زیر RBAC فاز ۳)
            '/api/v1/admin/questions', '/api/v1/admin/questions/{id}',
            '/api/v1/admin/questions/{id}/publish', '/api/v1/admin/questions/{id}/archive',
            // فاز ۹ — فلش‌کارت (کاربر)
            '/api/v1/flashcards/decks', '/api/v1/flashcards/decks/{id}',
            '/api/v1/flashcards/decks/{id}/cards', '/api/v1/flashcards/decks/{id}/clone',
            '/api/v1/flashcards/cards', '/api/v1/flashcards/cards/{id}',
            '/api/v1/flashcards/cards/{id}/suspend', '/api/v1/flashcards/cards/{id}/bury',
            '/api/v1/flashcards/cards/{id}/bookmark',
            '/api/v1/flashcards/review/queue', '/api/v1/flashcards/review/{cardId}',
            '/api/v1/flashcards/progress',
            // فاز ۹ — فلش‌کارت رسمی (پنل)
            '/api/v1/admin/flashcards/decks', '/api/v1/admin/flashcards/decks/{id}',
            '/api/v1/admin/flashcards/decks/{id}/cards',
            '/api/v1/admin/flashcards/decks/{id}/publish',
            '/api/v1/admin/flashcards/decks/{id}/archive',
            '/api/v1/admin/flashcards/cards/{id}',
            // فاز ۱۰ — ویکی (عمومی و کاربر)
            '/api/v1/wiki/categories', '/api/v1/wiki/articles',
            '/api/v1/wiki/articles/{slug}', '/api/v1/wiki/search', '/api/v1/wiki/suggest',
            '/api/v1/me/wiki-bookmarks', '/api/v1/me/wiki-bookmarks/{articleId}',
            // فاز ۱۰ — ویکی (پنل)
            '/api/v1/admin/wiki/articles', '/api/v1/admin/wiki/articles/{id}',
            '/api/v1/admin/wiki/articles/{id}/publish', '/api/v1/admin/wiki/articles/{id}/archive',
            '/api/v1/admin/wiki/categories', '/api/v1/admin/wiki/categories/{id}',
            '/api/v1/admin/wiki/relations', '/api/v1/admin/wiki/relations/{id}',
            // فاز ۱۲ — گراف دانش (عمومی)
            '/api/v1/knowledge/graph', '/api/v1/knowledge/nodes/{id}',
            '/api/v1/knowledge/nodes/{id}/neighbors',
            // فاز ۱۲ — گراف دانش (پنل)
            '/api/v1/admin/knowledge/nodes', '/api/v1/admin/knowledge/nodes/{id}',
            '/api/v1/admin/knowledge/nodes/{id}/publish', '/api/v1/admin/knowledge/nodes/{id}/archive',
            '/api/v1/admin/knowledge/edges', '/api/v1/admin/knowledge/edges/{id}',
            // فاز ۱۳ — مسیر سبز
            '/api/v1/me/green-path/profile', '/api/v1/me/green-path/roadmap',
            '/api/v1/me/green-path/today', '/api/v1/me/green-path/calendar',
            '/api/v1/me/green-path/performance', '/api/v1/me/green-path/steps/{id}',
            // فاز ۱۴ — لیگ و گیمیفیکیشن (فقط خواندنی برای کلاینت)
            '/api/v1/me/league', '/api/v1/league/seasons/{id}/leaderboard',
            '/api/v1/me/challenges', '/api/v1/me/achievements',
            // فاز ۱۵ — Media Core
            '/api/v1/media/{id}/access', '/api/v1/media/{id}/stream',
            '/api/v1/admin/media', '/api/v1/admin/media/uploads',
            '/api/v1/admin/media/{id}', '/api/v1/admin/media/{id}/archive',
            // فاز ۱۵ — مراجع
            '/api/v1/references', '/api/v1/references/{idOrSlug}',
            '/api/v1/admin/references', '/api/v1/admin/references/{id}',
            '/api/v1/admin/references/{id}/assets', '/api/v1/admin/references/{id}/assets/{assetId}',
            '/api/v1/admin/references/{id}/publish', '/api/v1/admin/references/{id}/archive',
            // فاز ۱۵ — آناتومی
            '/api/v1/anatomy/assets',
            '/api/v1/admin/anatomy/assets', '/api/v1/admin/anatomy/assets/{id}',
            '/api/v1/admin/anatomy/assets/{id}/publish', '/api/v1/admin/anatomy/assets/{id}/archive',
            // فاز ۱۶ — مقاله‌ها و نشان‌گذاری
            '/api/v1/articles', '/api/v1/articles/{slug}', '/api/v1/articles/categories',
            '/api/v1/me/article-bookmarks', '/api/v1/me/article-bookmarks/{articleId}',
            '/api/v1/admin/articles', '/api/v1/admin/articles/{id}',
            '/api/v1/admin/articles/{id}/publish', '/api/v1/admin/articles/{id}/archive',
            '/api/v1/admin/articles/categories', '/api/v1/admin/articles/categories/{id}',
            // فاز ۱۶ — یادداشت شخصی و مرور G5
            '/api/v1/me/notes', '/api/v1/me/notes/{id}',
            '/api/v1/me/review-items', '/api/v1/me/review-items/{id}',
            '/api/v1/me/review-items/{id}/complete-review', '/api/v1/me/review-items/{id}/restart',
            // فاز ۱۶ — گروه‌های مطالعه
            '/api/v1/groups/me', '/api/v1/groups', '/api/v1/groups/join', '/api/v1/groups/{id}',
            '/api/v1/groups/{id}/rotate-code', '/api/v1/groups/{id}/leave',
            '/api/v1/groups/{id}/members/{memberId}',
            // فاز ۱۶ — بازخورد
            '/api/v1/feedback', '/api/v1/me/feedback', '/api/v1/me/feedback/read',
            '/api/v1/admin/feedback', '/api/v1/admin/feedback/{id}',
            '/api/v1/admin/feedback/{id}/replies',
            // فاز ۱۹ — جست‌وجوی سراسری و اعلان‌های کاربر
            '/api/v1/search',
            '/api/v1/me/notifications', '/api/v1/me/notifications/{id}/read',
            '/api/v1/me/notifications/read-all',
            // فاز ۲۰ — پنل مدیریت
            '/api/v1/admin/dashboard',
            '/api/v1/admin/users', '/api/v1/admin/users/{id}',
            '/api/v1/admin/audit-logs', '/api/v1/admin/audit-logs/{id}',
            '/api/v1/admin/settings',
            '/api/v1/admin/queue/failed', '/api/v1/admin/queue/failed/{id}/retry',
            '/api/v1/admin/search/status', '/api/v1/admin/search/rebuild',
            '/api/v1/admin/notifications', '/api/v1/admin/notifications/broadcast',
            '/api/v1/admin/notifications/deliveries',
            '/api/v1/admin/notifications/deliveries/{id}/retry',
            // فاز ۲۱ — AI Mentor (adapter-controlled؛ provider پیکربندی‌نشده ⇒ ۵۰۳)
            '/api/v1/ai/chat', '/api/v1/ai/attachments',
            /*
             * فاز ۱۷/۱۸ (Commerce/International) — توسط کارِ هم‌زمانِ دیگری ساخته
             * شده و اینجا فقط به‌عنوان «دامنهٔ اعلام‌شده» ثبت می‌شود تا محافظ
             * دامنه اشتباهاً روی کار آن جریان شلیک نکند. مستندسازی OpenAPI آن‌ها
             * وظیفهٔ همان جریان است (`pendingDocumentation()`).
             */
            '/api/v1/pricing/plans', '/api/v1/pricing/quote',
            '/api/v1/orders', '/api/v1/orders/{id}/cancel', '/api/v1/orders/{orderId}/payments',
            '/api/v1/payments/{id}/verify', '/api/v1/payments/webhook/{provider}',
            '/api/v1/me/orders', '/api/v1/me/orders/{id}',
            '/api/v1/me/payments', '/api/v1/me/subscriptions', '/api/v1/me/entitlements',
            '/api/v1/international/courses', '/api/v1/international/courses/{slug}',
            '/api/v1/international/providers',
            '/api/v1/admin/international/courses', '/api/v1/admin/international/courses/{id}',
            '/api/v1/admin/international/courses/{id}/status',
            '/api/v1/admin/international/providers', '/api/v1/admin/international/providers/{id}',
            '/api/v1/admin/international/providers/{id}/status',
        ];
    }

    public function test_no_product_route_outside_the_declared_scope_exists(): void
    {
        /*
         * `routePairs()` مسیر را با اسلش ابتدایی برمی‌گرداند (شکل OpenAPI).
         *
         * فهرست مجاز = فازهای ۱ تا ۱۶. دامنه‌های بعدی (Payment/Notification/
         * Search/AI/…) نباید بی‌صدا وارد شوند — وقتی فاز آینده واقعاً ساخته
         * شد، مسیرهایش از این فهرست ممنوع خارج و محافظ معکوس می‌گیرد.
         */
        $allowed = $this->allowedProductPaths();

        foreach ($this->routePairs() as [$path]) {
            $this->assertContains($path, $allowed, "out-of-scope route: {$path}");
        }
    }

    /**
     * دامنه‌های **ساخته‌نشده** نباید وارد شوند.
     *
     * قاعدهٔ تکرارشونده: وقتی دامنه‌ای واقعاً ساخته می‌شود، از فهرست ممنوع خارج
     * و محافظ معکوس می‌گیرد. تا امروز `green-path`/`league`/`xp`/`achievement`
     * (فاز ۱۳/۱۴)، `search`/`notification` (فاز ۱۹) و
     * `payment`/`subscription`/`entitlement` (فاز ۱۷/۱۸) از این فهرست برداشته
     * شده‌اند و در `allowedProductPaths()` ثبت‌اند.
     */
    public function test_no_unbuilt_domain_route_exists(): void
    {
        /*
         * دامنه‌های ساخته‌نشده. `ai`/`mentor` در فاز ۲۱ واقعاً ساخته شد و از این
         * فهرست بیرون آمد (فقط دو مسیر `ai/chat` و `ai/attachments`)؛ Duel/Battle
         * هنوز ساخته نشده‌اند.
         */
        $forbidden = '#(duel|battle)#i';

        foreach ($this->routePairs() as [$path]) {
            $this->assertDoesNotMatchRegularExpression(
                $forbidden,
                $path,
                "unbuilt domain route must not exist yet: {$path}",
            );
        }
    }

    /**
     * محافظ معکوس فاز ۲۱: حذف ناخواستهٔ مسیرهای AI تست را می‌شکند، و AI
     * **نباید** موتور موازی برای گفت‌وگو/پیام بسازد یا دادهٔ یادگیری را بنویسد.
     */
    public function test_the_ai_mentor_routes_exist_and_own_only_their_own_state(): void
    {
        $paths = array_column($this->routePairs(), 0);

        foreach (['/api/v1/ai/chat', '/api/v1/ai/attachments'] as $expected) {
            $this->assertContains($expected, $paths, "phase 21 route is missing: {$expected}");
        }

        foreach ($paths as $path) {
            /* AI نه پیام می‌سازد نه آزمون/پیشرفت را می‌نویسد. */
            $this->assertDoesNotMatchRegularExpression(
                '#^/api/v1/ai/.+(messages|progress|attempts|answers|score|xp)#',
                $path,
                "AI must not own learning truth: {$path}",
            );
        }
    }

    /** محافظ معکوس فاز ۱۹/۲۰: حذف ناخواستهٔ این مسیرها تست را می‌شکند. */
    public function test_the_search_notification_and_admin_panel_routes_exist_now(): void
    {
        $paths = array_column($this->routePairs(), 0);

        foreach ([
            '/api/v1/search',
            '/api/v1/me/notifications',
            '/api/v1/me/notifications/{id}/read',
            '/api/v1/me/notifications/read-all',
            '/api/v1/admin/dashboard',
            '/api/v1/admin/users',
            '/api/v1/admin/audit-logs',
            '/api/v1/admin/settings',
            '/api/v1/admin/queue/failed',
            '/api/v1/admin/search/rebuild',
            '/api/v1/admin/notifications/broadcast',
        ] as $expected) {
            $this->assertContains($expected, $paths, "phase 19/20 route is missing: {$expected}");
        }
    }

    /** محافظ معکوس فاز ۱۷/۱۸: حذف ناخواستهٔ این مسیرها تست را می‌شکند. */
    public function test_the_international_and_commerce_routes_exist_now(): void
    {
        $paths = array_column($this->routePairs(), 0);

        foreach ([
            // فاز ۱۷ — کاتالوگ بین‌الملل
            '/api/v1/international/providers',
            '/api/v1/international/courses',
            '/api/v1/international/courses/{slug}',
            '/api/v1/admin/international/courses',
            '/api/v1/admin/international/courses/{id}/status',
            // فاز ۱۸ — قیمت‌گذاری و سفارش
            '/api/v1/pricing/plans',
            '/api/v1/pricing/quote',
            '/api/v1/orders',
            '/api/v1/orders/{id}/cancel',
            // فاز ۱۸ — پرداخت
            '/api/v1/orders/{orderId}/payments',
            '/api/v1/payments/{id}/verify',
            '/api/v1/payments/webhook/{provider}',
            // فاز ۱۸ — دادهٔ تجاری کاربر جاری
            '/api/v1/me/orders',
            '/api/v1/me/payments',
            '/api/v1/me/subscriptions',
            '/api/v1/me/entitlements',
        ] as $expected) {
            $this->assertContains($expected, $paths, "phase 17/18 route is missing: {$expected}");
        }
    }

    /**
     * فاز ۱۷/۱۸ مسیر **موازی** نساخت.
     *
     * چرا این محافظ لازم است: وسوسهٔ ساختن `.../chapters` و `.../exams` زیر
     * `/international/courses` زیاد است، ولی فصل/درس از Content Engine و آزمون
     * از همان موتور آزمون با `kind=international` سرو می‌شود. مسیر موازی یعنی دو
     * منبع حقیقت برای یک محتوا (Prompt §9/§12/§14). همین‌طور هیچ مسیر ادمینی
     * برای «paid کردن» سفارش یا نوشتن مستقیم entitlement وجود ندارد.
     */
    public function test_the_international_and_commerce_domains_did_not_duplicate_an_engine(): void
    {
        $paths = array_column($this->routePairs(), 0);

        foreach ($paths as $path) {
            /* موتور موازی برای محتوای بین‌الملل */
            $this->assertDoesNotMatchRegularExpression(
                '#^/api/v1/international/.+(chapters|lessons|pages|questions|exams|attempts)#',
                $path,
                "international domain must ride the existing engines, not duplicate them: {$path}",
            );

            /* مسیر مستقیم برای «paid کردن» سفارش یا صدور/لغو entitlement */
            $this->assertDoesNotMatchRegularExpression(
                '#^/api/v1/(admin/)?(orders|entitlements|subscriptions)(/\{id\})?/(pay|paid|verify|grant|revoke)#',
                $path,
                "no client/admin route may set money or access state directly: {$path}",
            );
        }

        /* تأیید و لغو فقط از سرویس‌ها، نه از مسیرهای عمومی. */
        $this->assertNotContains('/api/v1/admin/entitlements', $paths);
        $this->assertNotContains('/api/v1/admin/orders', $paths);
    }

    /** محافظ معکوس فاز ۱۳/۱۴: حذف ناخواستهٔ این مسیرها تست را می‌شکند. */
    public function test_the_green_path_and_league_routes_exist_now(): void
    {
        $paths = array_column($this->routePairs(), 0);

        foreach ([
            '/api/v1/me/green-path/profile',
            '/api/v1/me/green-path/roadmap',
            '/api/v1/me/green-path/today',
            '/api/v1/me/green-path/calendar',
            '/api/v1/me/green-path/performance',
            '/api/v1/me/green-path/steps/{id}',
            '/api/v1/me/league',
            '/api/v1/league/seasons/{id}/leaderboard',
            '/api/v1/me/challenges',
            '/api/v1/me/achievements',
        ] as $expected) {
            $this->assertContains($expected, $paths, "phase 13/14 route is missing: {$expected}");
        }
    }

    /** محافظ معکوس فاز ۱۲: حذف ناخواستهٔ این مسیرها تست را می‌شکند. */
    public function test_the_knowledge_routes_exist_now(): void
    {
        $paths = array_column($this->routePairs(), 0);

        foreach ([
            '/api/v1/knowledge/graph',
            '/api/v1/knowledge/nodes/{id}',
            '/api/v1/knowledge/nodes/{id}/neighbors',
            '/api/v1/admin/knowledge/nodes',
            '/api/v1/admin/knowledge/nodes/{id}/publish',
            '/api/v1/admin/knowledge/edges',
        ] as $expected) {
            $this->assertContains($expected, $paths, "phase 12 route is missing: {$expected}");
        }
    }

    /** محافظ معکوس فاز ۹ و ۱۰: حذف ناخواستهٔ این مسیرها تست را می‌شکند. */
    public function test_the_flashcard_and_wiki_routes_exist_now(): void
    {
        $paths = array_column($this->routePairs(), 0);

        foreach ([
            '/api/v1/flashcards/decks',
            '/api/v1/flashcards/review/queue',
            '/api/v1/flashcards/review/{cardId}',
            '/api/v1/flashcards/progress',
            '/api/v1/admin/flashcards/decks/{id}/publish',
            '/api/v1/wiki/categories',
            '/api/v1/wiki/articles/{slug}',
            '/api/v1/wiki/search',
            '/api/v1/wiki/suggest',
            '/api/v1/me/wiki-bookmarks',
            '/api/v1/admin/wiki/articles/{id}/publish',
            '/api/v1/admin/wiki/categories/{id}',
        ] as $expected) {
            $this->assertContains($expected, $paths, "phase 9/10 route is missing: {$expected}");
        }
    }

    public function test_the_exam_engine_routes_exist_now(): void
    {
        // محافظ معکوس: اگر روزی مسیرهای فاز ۷ حذف شوند، اینجا دیده می‌شود.
        $paths = array_column($this->routePairs(), 0);

        foreach ([
            '/api/v1/exams',
            '/api/v1/exam-attempts/{id}',
            '/api/v1/exam-attempts/{id}/finish',
            '/api/v1/me/analytics/overview',
        ] as $expected) {
            $this->assertContains($expected, $paths, "phase 7/8 route is missing: {$expected}");
        }
    }

    public function test_a_wrong_method_on_a_real_path_returns_405(): void
    {
        $this->getJson('/api/v1/auth/login')->assertStatus(405);
        $this->deleteJson('/api/v1/me')->assertStatus(405);
    }
}
