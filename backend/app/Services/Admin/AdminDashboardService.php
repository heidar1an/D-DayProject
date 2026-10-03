<?php

namespace App\Services\Admin;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * داشبورد پنل — فاز ۲۰ (§90).
 *
 * همهٔ اعداد **از منبع واقعی** خوانده می‌شوند؛ هیچ Mock («۱۰٬۰۰۰ کاربر»,
 * «۹۹٪ موفقیت») اینجا نیست. هر سنجه یک `COUNT` محدود و index-دار است، نه
 * حلقه روی رکوردها (بدون N+1).
 *
 * `hasTable` به‌عنوان گارد: پنل نباید به‌خاطر نبودن یک دامنهٔ اختیاری ۵۰۰ بدهد.
 */
final class AdminDashboardService
{
    /** @return array<string, mixed> */
    public function overview(): array
    {
        return [
            'users' => [
                'total' => $this->count('users'),
                'newLast7Days' => $this->count('users', fn ($q) => $q->where('created_at', '>=', now()->subDays(7))),
                'adminsActive' => $this->count('admins', fn ($q) => $q->where('active', true)),
            ],
            'content' => [
                'subjects' => $this->count('subjects'),
                'courses' => $this->count('courses'),
                'lessons' => $this->count('lessons'),
                'articles' => $this->statusBreakdown('articles'),
                'wikiArticles' => $this->statusBreakdown('wiki_articles'),
                'references' => $this->statusBreakdown('references'),
                'questions' => $this->statusBreakdown('questions'),
            ],
            'learning' => [
                'completedLessons' => $this->count('learning_progress', fn ($q) => $q->where('status', 'completed')),
                'studySessions' => $this->count('study_sessions'),
                'examAttempts' => $this->count('exam_attempts'),
                'examResults' => $this->count('exam_results'),
                'flashcardReviews' => $this->count('flashcard_reviews'),
            ],
            'engagement' => [
                'feedbackOpen' => $this->count('feedback', fn ($q) => $q->where('status', 'open')),
                'notifications' => $this->count('notifications'),
                'notificationsUnread' => $this->count('notifications', fn ($q) => $q->whereNull('read_at')),
                'notificationDeliveriesFailed' => $this->count('notification_deliveries', fn ($q) => $q->where('status', 'failed')),
                'groupMemberships' => $this->count('group_memberships'),
            ],
            'operations' => [
                'outboxPending' => $this->count('outbox_events', fn ($q) => $q->whereNull('published_at')),
                'outboxFailed' => $this->count('outbox_events', fn ($q) => $q->whereNotNull('last_error_code')),
                'failedJobs' => $this->count('failed_jobs'),
                'searchDocuments' => $this->count('search_documents'),
                'auditLogs' => $this->count('audit_logs'),
            ],
            'generatedAt' => now()->toIso8601String(),
        ];
    }

    /** @param callable(Builder):void|null $scope */
    private function count(string $table, ?callable $scope = null): int
    {
        $table = $this->tableName($table);

        if (! Schema::hasTable($table)) {
            return 0;
        }

        $query = DB::table($table);

        if ($scope !== null) {
            $scope($query);
        }

        return (int) $query->count();
    }

    /**
     * تفکیک وضعیت — سه `COUNT` روی یک جدول با index روی `status`.
     *
     * @return array{draft: int, published: int, archived: int, total: int}
     */
    private function statusBreakdown(string $table): array
    {
        $real = $this->tableName($table);

        if (! Schema::hasTable($real)) {
            return ['draft' => 0, 'published' => 0, 'archived' => 0, 'total' => 0];
        }

        $rows = DB::table($real)->select('status', DB::raw('count(*) as total'))->groupBy('status')->pluck('total', 'status');
        $draft = (int) ($rows['draft'] ?? 0);
        $published = (int) ($rows['published'] ?? 0);
        $archived = (int) ($rows['archived'] ?? 0);

        return [
            'draft' => $draft,
            'published' => $published,
            'archived' => $archived,
            'total' => $draft + $published + $archived,
        ];
    }

    /** نام واقعی جدول — `"references"` یک کلمهٔ کلیدی SQL است. */
    private function tableName(string $table): string
    {
        return trim($table, '"');
    }
}
