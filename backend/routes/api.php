<?php

use App\Http\Controllers\Api\V1\Admin\AdminAnatomyController;
use App\Http\Controllers\Api\V1\Admin\AdminArticleController;
use App\Http\Controllers\Api\V1\Admin\AdminAuditLogController;
use App\Http\Controllers\Api\V1\Admin\AdminDashboardController;
use App\Http\Controllers\Api\V1\Admin\AdminFeedbackController;
use App\Http\Controllers\Api\V1\Admin\AdminFlashcardController;
use App\Http\Controllers\Api\V1\Admin\AdminInternationalController;
use App\Http\Controllers\Api\V1\Admin\AdminKnowledgeController;
use App\Http\Controllers\Api\V1\Admin\AdminMediaController;
use App\Http\Controllers\Api\V1\Admin\AdminNotificationController;
use App\Http\Controllers\Api\V1\Admin\AdminOpsController;
use App\Http\Controllers\Api\V1\Admin\AdminQuestionController;
use App\Http\Controllers\Api\V1\Admin\AdminReferenceController;
use App\Http\Controllers\Api\V1\Admin\AdminSettingController;
use App\Http\Controllers\Api\V1\Admin\AdminUserController;
use App\Http\Controllers\Api\V1\Admin\AdminWikiController;
use App\Http\Controllers\Api\V1\AdminAuthController;
use App\Http\Controllers\Api\V1\AiController;
use App\Http\Controllers\Api\V1\AnalyticsController;
use App\Http\Controllers\Api\V1\AnatomyController;
use App\Http\Controllers\Api\V1\ArticleBookmarkController;
use App\Http\Controllers\Api\V1\ArticleController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BankSessionController;
use App\Http\Controllers\Api\V1\ContentController;
use App\Http\Controllers\Api\V1\ExamAttemptController;
use App\Http\Controllers\Api\V1\ExamController;
use App\Http\Controllers\Api\V1\ExamRankingController;
use App\Http\Controllers\Api\V1\ExamRegistrationController;
use App\Http\Controllers\Api\V1\ExamResultController;
use App\Http\Controllers\Api\V1\FeedbackController;
use App\Http\Controllers\Api\V1\FlashcardController;
use App\Http\Controllers\Api\V1\FlashcardDeckController;
use App\Http\Controllers\Api\V1\FlashcardReviewController;
use App\Http\Controllers\Api\V1\GreenPathController;
use App\Http\Controllers\Api\V1\GroupController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InternationalCourseController;
use App\Http\Controllers\Api\V1\KnowledgeGraphController;
use App\Http\Controllers\Api\V1\LeagueController;
use App\Http\Controllers\Api\V1\MeCommerceController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\MediaController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\PricingController;
use App\Http\Controllers\Api\V1\ProgressController;
use App\Http\Controllers\Api\V1\QuestionAnswerController;
use App\Http\Controllers\Api\V1\QuestionController;
use App\Http\Controllers\Api\V1\QuestionReportController;
use App\Http\Controllers\Api\V1\ReferenceController;
use App\Http\Controllers\Api\V1\ReviewItemController;
use App\Http\Controllers\Api\V1\SearchController;
use App\Http\Controllers\Api\V1\StudySessionController;
use App\Http\Controllers\Api\V1\UniversityController;
use App\Http\Controllers\Api\V1\UserNoteController;
use App\Http\Controllers\Api\V1\WikiBookmarkController;
use App\Http\Controllers\Api\V1\WikiController;
use App\Http\Controllers\Api\V1\WikiSearchController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1 — قرارداد جدید
|--------------------------------------------------------------------------
| قدیمی `/api/*` (سرور Node) دست‌نخورده می‌ماند؛ هر مسیر جدید فقط زیر `/api/v1`.
|
| ترتیب میان‌افزارها معنادار است:
|   api.session → سشن را از کوکی می‌خواند (اختیاری، دانشجو یا ادمین)
|   api.auth    → اجبار به ورود **دانشجو**
|   api.admin   → اجبار به ورود **ادمین** (principal جدا)
|   api.can     → مجوز ادمین با کلیدهای واقعی پنل
|   api.origin  → same-origin برای هر نوشتن
|   api.csrf    → double-submit token (فقط وقتی سشنی وجود دارد)
|
| فاز ۵/۶: محتوای منتشرشده + پیشرفت/نشست مطالعه + بانک سؤال + CRUD سؤال پنل.
| فاز ۷: موتور آزمون (آزمون/Snapshot/ثبت‌نام/Attempt/پاسخ/کارنامه/مرور/رتبه‌بندی).
| فاز ۸: تحلیل کاربر جاری — فقط **مصرف‌کننده**، بدون منبع حقیقت تازه.
|
| ⚠️ هیچ مسیر ادمینی برای آزمون ساخته نشد: در پنل فعلی مصرف‌کنندهٔ واقعی ندارد و
| ساختن endpoint بدون مصرف‌کننده، «طراحی‌شده» را جای «پیاده‌شده» جا می‌زند.
*/

Route::prefix('v1')->name('api.v1.')->middleware('api.session')->group(function (): void {
    Route::get('healthz', [HealthController::class, 'health'])->name('healthz');
    Route::get('readyz', [HealthController::class, 'ready'])->name('readyz');

    // ── احراز هویت دانشجو (عمومی) ───────────────────────────────────────
    Route::middleware(['api.origin', 'throttle:auth-register'])
        ->post('auth/register', [AuthController::class, 'register'])
        ->name('auth.register');

    Route::middleware(['api.origin', 'throttle:auth-login'])
        ->post('auth/login', [AuthController::class, 'login'])
        ->name('auth.login');

    Route::middleware(['api.origin', 'api.csrf', 'throttle:auth-logout'])
        ->post('auth/logout', [AuthController::class, 'logout'])
        ->name('auth.logout');

    // ── احراز هویت ادمین (عمومی) ────────────────────────────────────────
    Route::middleware(['api.origin', 'throttle:admin-login'])
        ->post('admin/auth/login', [AdminAuthController::class, 'login'])
        ->name('admin.auth.login');

    Route::middleware(['api.origin', 'api.csrf', 'throttle:admin-logout'])
        ->post('admin/auth/logout', [AdminAuthController::class, 'logout'])
        ->name('admin.auth.logout');

    // ── کاربر جاری (نیازمند سشن دانشجو) ─────────────────────────────────
    Route::middleware(['api.auth', 'throttle:me'])
        ->get('me', [MeController::class, 'show'])
        ->name('me.show');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:profile'])
        ->patch('me', [MeController::class, 'update'])
        ->name('me.update');

    // ── دادهٔ مرجع (عمومی) ──────────────────────────────────────────────
    Route::middleware('throttle:universities')
        ->get('universities', [UniversityController::class, 'index'])
        ->name('universities.index');

    // ── محتوای منتشرشده (عمومی) — فاز ۴ ────────────────────────────────
    /*
     * ⚠️ قید `whereUuid` روی پارامترهای شناسه اجباری است.
     *
     * ستون‌های `id` روی PostgreSQL از نوع `uuid` هستند و مقایسه‌شان با یک رشتهٔ
     * دلخواه (`/lessons/abc`) خطای `SQLSTATE[22P02]` می‌دهد ⇒ **۵۰۰ به‌جای ۴۰۴**.
     * با این قید، مسیر اصلاً match نمی‌شود و پاسخ همان ۴۰۴ قراردادی است.
     * `courses/{idOrSlug}` عمداً قید ندارد چون slug هم می‌پذیرد و خودِ سرویس
     * شکل ورودی را تشخیص می‌دهد.
     */
    Route::middleware('throttle:content_read')->group(function (): void {
        Route::get('subjects', [ContentController::class, 'subjects'])->name('subjects.index');
        Route::get('courses', [ContentController::class, 'courses'])->name('courses.index');
        Route::get('courses/{idOrSlug}', [ContentController::class, 'showCourse'])->name('courses.show');
        Route::get('lessons/{id}', [ContentController::class, 'showLesson'])->whereUuid('id')->name('lessons.show');
        Route::get('lesson-pages/{id}', [ContentController::class, 'showPage'])->whereUuid('id')->name('lesson-pages.show');
    });

    // ── پیشرفت یادگیری (نیازمند سشن دانشجو) — فاز ۵ ────────────────────
    Route::middleware(['api.auth', 'throttle:progress_read'])->group(function (): void {
        Route::get('me/progress', [ProgressController::class, 'index'])->name('me.progress.index');
        Route::get('me/progress/pages/{id}', [ProgressController::class, 'show'])->whereUuid('id')->name('me.progress.show');
    });

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:progress_write'])
        ->put('me/progress/pages/{id}', [ProgressController::class, 'update'])
        ->whereUuid('id')
        ->name('me.progress.update');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:study_session'])
        ->post('me/study-sessions', [StudySessionController::class, 'store'])
        ->name('me.study-sessions.store');

    // ── بانک سؤال (خواندن عمومی، پاسخ/سشن با سشن دانشجو) — فاز ۶ ───────
    Route::middleware('throttle:questions_read')->group(function (): void {
        Route::get('questions', [QuestionController::class, 'index'])->name('questions.index');
        Route::get('questions/{id}', [QuestionController::class, 'show'])->whereUuid('id')->name('questions.show');
    });

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:questions_answer'])
        ->post('questions/{id}/answers', [QuestionAnswerController::class, 'store'])
        ->whereUuid('id')
        ->name('questions.answers.store');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:questions_report'])
        ->post('questions/{id}/reports', [QuestionReportController::class, 'store'])
        ->whereUuid('id')
        ->name('questions.reports.store');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:bank_session'])
        ->post('bank/sessions', [BankSessionController::class, 'store'])
        ->name('bank.sessions.store');

    Route::middleware(['api.auth', 'throttle:bank_session'])
        ->get('bank/sessions/{id}', [BankSessionController::class, 'show'])
        ->whereUuid('id')
        ->name('bank.sessions.show');

    // ── آزمون (فاز ۷) ──────────────────────────────────────────────────
    /*
     * `{idOrSlug}` عمداً قید ندارد چون هم UUID و هم slug می‌پذیرد و خودِ سرویس
     * شکل ورودی را تشخیص می‌دهد (`Str::isUuid`). برخلاف آن، `{id}` روی مسیرهای
     * Attempt قید `whereUuid` دارد: ستون `id` روی PostgreSQL از نوع `uuid` است و
     * مقایسه با رشتهٔ دلخواه `SQLSTATE[22P02]` و **۵۰۰ به‌جای ۴۰۴** می‌دهد.
     */
    Route::middleware('throttle:exam_read')->group(function (): void {
        Route::get('exams', [ExamController::class, 'index'])->name('exams.index');
        Route::get('exams/{idOrSlug}', [ExamController::class, 'show'])->name('exams.show');
        Route::get('exams/{idOrSlug}/ranking', [ExamRankingController::class, 'index'])->name('exams.ranking');
    });

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:exam_registration'])->group(function (): void {
        Route::post('exams/{idOrSlug}/registrations', [ExamRegistrationController::class, 'store'])->name('exams.registrations.store');
        Route::delete('exams/{idOrSlug}/registrations', [ExamRegistrationController::class, 'destroy'])->name('exams.registrations.destroy');
    });

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:exam_attempt_start'])
        ->post('exams/{idOrSlug}/attempts', [ExamAttemptController::class, 'store'])
        ->name('exams.attempts.store');

    Route::middleware(['api.auth', 'throttle:exam_read'])
        ->get('exam-attempts/{id}', [ExamAttemptController::class, 'show'])
        ->whereUuid('id')
        ->name('exam-attempts.show');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:exam_answer'])
        ->put('exam-attempts/{id}/answers', [ExamAttemptController::class, 'saveAnswer'])
        ->whereUuid('id')
        ->name('exam-attempts.answers');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:exam_finish'])
        ->post('exam-attempts/{id}/finish', [ExamAttemptController::class, 'finish'])
        ->whereUuid('id')
        ->name('exam-attempts.finish');

    Route::middleware(['api.auth', 'throttle:exam_result'])->group(function (): void {
        Route::get('exam-attempts/{id}/result', [ExamResultController::class, 'show'])->whereUuid('id')->name('exam-attempts.result');
        Route::get('exam-attempts/{id}/review', [ExamResultController::class, 'review'])->whereUuid('id')->name('exam-attempts.review');
    });

    // ── تحلیل کاربر جاری (فاز ۸) ───────────────────────────────────────
    /*
     * همه زیر `/me/*`. هیچ مسیری برای تحلیل کاربر دیگر وجود ندارد و هیچ‌کدام
     * `userId` از URL یا بدنه نمی‌پذیرند — مالکیت فقط از سشن.
     */
    Route::middleware(['api.auth', 'throttle:analytics_read'])
        ->prefix('me/analytics')
        ->name('me.analytics.')
        ->group(function (): void {
            Route::get('overview', [AnalyticsController::class, 'overview'])->name('overview');
            Route::get('topics', [AnalyticsController::class, 'topics'])->name('topics');
            Route::get('exams', [AnalyticsController::class, 'exams'])->name('exams');
            Route::get('progress', [AnalyticsController::class, 'progress'])->name('progress');
        });

    // ── فلش‌کارت (نیازمند سشن دانشجو) — فاز ۹ ──────────────────────────
    /*
     * مرز مالکیت: هیچ مسیری `userId` نمی‌پذیرد. دک رسمی برای همه **خواندنی** است
     * و وضعیت یادگیری همیشه مال کاربر سشن.
     *
     * ترتیب معنادار است: `flashcards/review/queue` پیش از هر الگوی پارامتری
     * می‌آید و همهٔ `{id}`ها قید `whereUuid` دارند — ستون `id` روی PostgreSQL از
     * نوع `uuid` است و مقایسه با رشتهٔ دلخواه `SQLSTATE[22P02]` و **۵۰۰ به‌جای
     * ۴۰۴** می‌دهد.
     */
    Route::middleware(['api.auth', 'throttle:flashcards_read'])->group(function (): void {
        Route::get('flashcards/decks', [FlashcardDeckController::class, 'index'])->name('flashcards.decks.index');
        Route::get('flashcards/decks/{id}', [FlashcardDeckController::class, 'show'])->whereUuid('id')->name('flashcards.decks.show');
        Route::get('flashcards/decks/{id}/cards', [FlashcardController::class, 'indexByDeck'])->whereUuid('id')->name('flashcards.decks.cards.index');
        Route::get('flashcards/cards', [FlashcardController::class, 'index'])->name('flashcards.cards.index');
        Route::get('flashcards/review/queue', [FlashcardReviewController::class, 'queue'])->name('flashcards.review.queue');
        Route::get('flashcards/progress', [FlashcardReviewController::class, 'progress'])->name('flashcards.progress');
    });

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:flashcards_write'])->group(function (): void {
        Route::post('flashcards/decks', [FlashcardDeckController::class, 'store'])->name('flashcards.decks.store');
        Route::patch('flashcards/decks/{id}', [FlashcardDeckController::class, 'update'])->whereUuid('id')->name('flashcards.decks.update');
        Route::delete('flashcards/decks/{id}', [FlashcardDeckController::class, 'destroy'])->whereUuid('id')->name('flashcards.decks.destroy');
        Route::post('flashcards/decks/{id}/clone', [FlashcardDeckController::class, 'clone'])->whereUuid('id')->name('flashcards.decks.clone');
        Route::post('flashcards/decks/{id}/cards', [FlashcardController::class, 'store'])->whereUuid('id')->name('flashcards.decks.cards.store');
        Route::patch('flashcards/cards/{id}', [FlashcardController::class, 'update'])->whereUuid('id')->name('flashcards.cards.update');
        Route::delete('flashcards/cards/{id}', [FlashcardController::class, 'destroy'])->whereUuid('id')->name('flashcards.cards.destroy');
        Route::post('flashcards/cards/{id}/suspend', [FlashcardController::class, 'suspend'])->whereUuid('id')->name('flashcards.cards.suspend');
        Route::post('flashcards/cards/{id}/bury', [FlashcardController::class, 'bury'])->whereUuid('id')->name('flashcards.cards.bury');
        Route::post('flashcards/cards/{id}/bookmark', [FlashcardController::class, 'bookmark'])->whereUuid('id')->name('flashcards.cards.bookmark');
    });

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:flashcards_review'])
        ->post('flashcards/review/{cardId}', [FlashcardReviewController::class, 'review'])
        ->whereUuid('cardId')
        ->name('flashcards.review.store');

    // ── ویکی (عمومی) — فاز ۱۰ ───────────────────────────────────────────
    /*
     * هیچ‌کدام سشن لازم ندارند. `status=published` در **کوئری** اعمال می‌شود، نه
     * در Resource؛ پس پیش‌نویس/آرشیو حتی در facet و پیشنهاد هم دیده نمی‌شود.
     *
     * `wiki/articles/{slug}` قید `whereUuid` **ندارد** چون slug است، نه شناسه —
     * و `publishedBySlug` شکل ورودی را از مسیر می‌گیرد.
     */
    Route::middleware('throttle:wiki_read')->group(function (): void {
        Route::get('wiki/categories', [WikiController::class, 'categories'])->name('wiki.categories');
        Route::get('wiki/articles', [WikiController::class, 'articles'])->name('wiki.articles');
        Route::get('wiki/articles/{slug}', [WikiController::class, 'show'])->name('wiki.articles.show');
    });

    Route::middleware('throttle:wiki_search')->group(function (): void {
        Route::get('wiki/search', [WikiSearchController::class, 'search'])->name('wiki.search');
        Route::get('wiki/suggest', [WikiSearchController::class, 'suggest'])->name('wiki.suggest');
    });

    // ── نشان‌گذاری ویکی (نیازمند سشن دانشجو) — فاز ۱۰ ──────────────────
    Route::middleware(['api.auth', 'throttle:wiki_bookmark'])
        ->get('me/wiki-bookmarks', [WikiBookmarkController::class, 'index'])
        ->name('me.wiki-bookmarks.index');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:wiki_bookmark'])
        ->put('me/wiki-bookmarks/{articleId}', [WikiBookmarkController::class, 'store'])
        ->whereUuid('articleId')
        ->name('me.wiki-bookmarks.store');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:wiki_bookmark'])
        ->delete('me/wiki-bookmarks/{articleId}', [WikiBookmarkController::class, 'destroy'])
        ->whereUuid('articleId')
        ->name('me.wiki-bookmarks.destroy');

    // ── گراف دانش (عمومی) — فاز ۱۲ ──────────────────────────────────────
    /*
     * فقط `published` (نود و مقالهٔ متصل). `nodes/{id}` قید `whereUuid` دارد —
     * شناسهٔ نود UUID است؛ ریشه با slug مقاله از پارامتر `?node=` می‌آید.
     * depth/نود/یال سقف سمت سرور دارند (config/knowledge.php) و کلاینت هرگز
     * پیمایش بی‌کران نمی‌گیرد.
     */
    Route::middleware('throttle:knowledge_read')->group(function (): void {
        Route::get('knowledge/graph', [KnowledgeGraphController::class, 'index'])->name('knowledge.graph');
        Route::get('knowledge/nodes/{id}', [KnowledgeGraphController::class, 'show'])->whereUuid('id')->name('knowledge.nodes.show');
        Route::get('knowledge/nodes/{id}/neighbors', [KnowledgeGraphController::class, 'neighbors'])->whereUuid('id')->name('knowledge.nodes.neighbors');
    });

    /*
     * ── مسیر سبز (فاز ۱۳) ─────────────────────────────────────────────
     *
     * همه زیر `/me/*` — هویت فقط از سشن و هیچ مسیری `userId` نمی‌پذیرد.
     * «امروز» و هر محاسبهٔ تاریخ سمت سرور است؛ `{id}` قید `whereUuid` دارد
     * (ستون `id` روی PG از نوع uuid است و رشتهٔ دلخواه ⇒ ۵۰۰ به‌جای ۴۰۴).
     */
    Route::middleware(['api.auth', 'throttle:greenpath_read'])
        ->prefix('me/green-path')
        ->name('me.green-path.')
        ->group(function (): void {
            Route::get('profile', [GreenPathController::class, 'profile'])->name('profile');
            Route::get('roadmap', [GreenPathController::class, 'roadmap'])->name('roadmap');
            Route::get('today', [GreenPathController::class, 'today'])->name('today');
            Route::get('calendar', [GreenPathController::class, 'calendar'])->name('calendar');
            Route::get('performance', [GreenPathController::class, 'performance'])->name('performance');
        });

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:greenpath_write'])
        ->patch('me/green-path/steps/{id}', [GreenPathController::class, 'updateStep'])
        ->whereUuid('id')
        ->name('me.green-path.steps.update');

    /*
     * ── لیگ و گیمیفیکیشن (فاز ۱۴) — فقط خواندنی ────────────────────────
     *
     * هیچ endpoint نوشتاری برای XP/رتبه/نشان/چالش وجود ندارد: پاداش فقط از
     * رخداد واقعی بک‌اند صادر می‌شود. `seasons/{id}` قید `whereUuid` دارد.
     */
    Route::middleware(['api.auth', 'throttle:league_read'])
        ->get('me/league', [LeagueController::class, 'me'])
        ->name('me.league');

    Route::middleware(['api.auth', 'throttle:league_read'])->group(function (): void {
        Route::get('me/challenges', [LeagueController::class, 'myChallenges'])->name('me.challenges');
        Route::get('me/achievements', [LeagueController::class, 'myAchievements'])->name('me.achievements');
        Route::get('league/seasons/{id}/leaderboard', [LeagueController::class, 'leaderboard'])
            ->whereUuid('id')
            ->name('league.seasons.leaderboard');
    });

    // ── Media Core (فاز ۱۵) ─────────────────────────────────────────────
    /*
     * هیچ استریم مستقیمی بدون Policy نیست: فایل خصوصی فقط با Signed URL
     * کوتاه‌عمر از `stream` عبور می‌کند؛ فایل عمومی با visibility خود مسیر
     * کنترل می‌شود (§71). آپلود مصرف‌کنندهٔ واقعی‌اش پنل است، پس فقط زیر
     * /admin/media/uploads است.
     */
    Route::middleware(['api.auth', 'throttle:media_access'])
        ->get('media/{id}/access', [MediaController::class, 'access'])
        ->whereUuid('id')
        ->name('media.access');

    Route::middleware('throttle:media_stream')
        ->get('media/{id}/stream', [MediaController::class, 'stream'])
        ->whereUuid('id')
        ->name('media.stream');

    // ── مراجع (فاز ۱۵) — فقط `published` در مسیر عمومی ──────────────────
    Route::middleware('throttle:references_read')->group(function (): void {
        Route::get('references', [ReferenceController::class, 'index'])->name('references.index');
        Route::get('references/{idOrSlug}', [ReferenceController::class, 'show'])->name('references.show');
    });

    // ── آناتومی (فاز ۱۵) — کاتالوگ منتشرشده ─────────────────────────────
    Route::middleware('throttle:anatomy_read')
        ->get('anatomy/assets', [AnatomyController::class, 'assets'])
        ->name('anatomy.assets.index');

    // ── مقاله‌ها (فاز ۱۶) — فقط `published`؛ پیش‌نویس ۴۰۴ (§26) ─────────
    Route::middleware('throttle:articles_read')->group(function (): void {
        Route::get('articles', [ArticleController::class, 'index'])->name('articles.index');
        Route::get('articles/categories', [ArticleController::class, 'categories'])->name('articles.categories');
        Route::get('articles/{slug}', [ArticleController::class, 'show'])->name('articles.show');
    });

    /*
     * ── جست‌وجو (فاز ۱۹) — عمومی ─────────────────────────────────────────
     *
     * پاسخ از projection `search_documents` می‌آید، ولی هر نتیجه یک بار دیگر با
     * سیاست دسترسی دامنه فیلتر می‌شود (§34/§39): پیش‌نویس/آرشیو هرگز از این
     * مسیر بیرون نمی‌زند. `q` الزامی است و سقف طول دارد (§42).
     */
    Route::middleware('throttle:search_read')
        ->get('search', [SearchController::class, 'index'])
        ->name('search.index');

    /*
     * ── اعلان‌های کاربر (فاز ۱۹) — مالکیت فقط از سشن ─────────────────────
     *
     * هیچ `userId` از بدنه/query خوانده نمی‌شود (§11) و اعلان کاربر دیگر ۴۰۴
     * می‌گیرد، نه ۴۰۳ (§25). `read_at` فقط سرور-محور است (§26).
     */
    Route::middleware(['api.auth', 'throttle:notifications_read'])
        ->get('me/notifications', [NotificationController::class, 'index'])
        ->name('me.notifications.index');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:notifications_write'])->group(function (): void {
        Route::patch('me/notifications/{id}/read', [NotificationController::class, 'read'])
            ->whereUuid('id')
            ->name('me.notifications.read');

        Route::patch('me/notifications/read-all', [NotificationController::class, 'readAll'])
            ->name('me.notifications.read-all');
    });

    // ── نشان‌گذاری مقاله (فاز ۱۶) — مالکیت فقط از سشن ───────────────────
    Route::middleware(['api.auth', 'throttle:article_bookmark'])
        ->get('me/article-bookmarks', [ArticleBookmarkController::class, 'index'])
        ->name('me.article-bookmarks.index');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:article_bookmark'])->group(function (): void {
        Route::put('me/article-bookmarks/{articleId}', [ArticleBookmarkController::class, 'store'])
            ->whereUuid('articleId')
            ->name('me.article-bookmarks.store');

        Route::delete('me/article-bookmarks/{articleId}', [ArticleBookmarkController::class, 'destroy'])
            ->whereUuid('articleId')
            ->name('me.article-bookmarks.destroy');
    });

    // ── یادداشت شخصی (فاز ۱۶) — مالکیت فقط از سشن (§32) ─────────────────
    Route::middleware(['api.auth', 'throttle:notes_write'])
        ->get('me/notes', [UserNoteController::class, 'index'])
        ->name('me.notes.index');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:notes_write'])->group(function (): void {
        Route::post('me/notes', [UserNoteController::class, 'store'])->name('me.notes.store');
        Route::patch('me/notes/{id}', [UserNoteController::class, 'update'])->whereUuid('id')->name('me.notes.update');
        Route::delete('me/notes/{id}', [UserNoteController::class, 'destroy'])->whereUuid('id')->name('me.notes.destroy');
    });

    // ── مرور G5 (فاز ۱۶) — پیشرفت سمت سرور محاسبه می‌شود (§35) ──────────
    Route::middleware(['api.auth', 'throttle:review_write'])
        ->get('me/review-items', [ReviewItemController::class, 'index'])
        ->name('me.review-items.index');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:review_write'])->group(function (): void {
        Route::post('me/review-items', [ReviewItemController::class, 'store'])->name('me.review-items.store');
        Route::patch('me/review-items/{id}', [ReviewItemController::class, 'update'])->whereUuid('id')->name('me.review-items.update');
        Route::post('me/review-items/{id}/complete-review', [ReviewItemController::class, 'completeReview'])->whereUuid('id')->name('me.review-items.complete');
        Route::post('me/review-items/{id}/restart', [ReviewItemController::class, 'restart'])->whereUuid('id')->name('me.review-items.restart');
        Route::delete('me/review-items/{id}', [ReviewItemController::class, 'destroy'])->whereUuid('id')->name('me.review-items.destroy');
    });

    // ── گروه‌های مطالعه (فاز ۱۶) — join/rotate سخت‌گیرانه محدود شده (§60) ─
    Route::middleware(['api.auth', 'throttle:groups_read'])
        ->get('groups/me', [GroupController::class, 'myGroups'])
        ->name('groups.my');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:groups_join'])
        ->post('groups/join', [GroupController::class, 'join'])
        ->name('groups.join');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf'])->group(function (): void {
        Route::middleware('throttle:groups_write')
            ->post('groups', [GroupController::class, 'store'])
            ->name('groups.store');

        Route::middleware('throttle:groups_read')
            ->get('groups/{id}', [GroupController::class, 'show'])
            ->whereUuid('id')
            ->name('groups.show');

        Route::middleware('throttle:groups_write')->group(function (): void {
            Route::post('groups/{id}/rotate-code', [GroupController::class, 'rotateCode'])->whereUuid('id')->name('groups.rotate');
            Route::post('groups/{id}/leave', [GroupController::class, 'leave'])->whereUuid('id')->name('groups.leave');
            Route::delete('groups/{id}/members/{memberId}', [GroupController::class, 'kick'])->whereUuid('id')->whereUuid('memberId')->name('groups.kick');
        });
    });

    // ── بازخورد (فاز ۱۶) — ارسال مهمان هم مجاز؛ هویت از سشن/گست‌رف (§46) ─
    Route::middleware(['api.origin', 'api.csrf', 'throttle:feedback_submit'])
        ->post('feedback', [FeedbackController::class, 'store'])
        ->name('feedback.store');

    Route::middleware(['api.auth', 'throttle:feedback_read'])
        ->get('me/feedback', [FeedbackController::class, 'myFeedback'])
        ->name('me.feedback.index');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:feedback_read'])
        ->post('me/feedback/read', [FeedbackController::class, 'markRead'])
        ->name('me.feedback.read');

    /*
     * ── کاتالوگ بین‌الملل (فاز ۱۷) ──────────────────────────────────────
     *
     * عمومی است ولی `api.session` (سراسری گروه) اجازه می‌دهد سشن اختیاری هم
     * خوانده شود — چون پاسخ باید بگوید دورهٔ پرمیوم برای **همین** کاربر قفل
     * است یا نه. نبود سشن یعنی مهمان، و مهمان هیچ entitlement ندارد.
     *
     * ⚠️ مسیر `.../chapters` و مسیرهای آزمون ساخته **نشدند**: فصل/درس از
     * Content API موجود و آزمون بین‌الملل از `GET /exams?kind=international`
     * سرو می‌شوند. endpoint موازی یعنی دو منبع حقیقت (Prompt §9/§12).
     */
    Route::middleware('throttle:intl_read')->group(function (): void {
        Route::get('international/providers', [InternationalCourseController::class, 'providers'])->name('international.providers');
        Route::get('international/courses', [InternationalCourseController::class, 'courses'])->name('international.courses');
        Route::get('international/courses/{slug}', [InternationalCourseController::class, 'showCourse'])
            ->where('slug', '[a-z0-9-]+')
            ->name('international.courses.show');
    });

    /*
     * ── قیمت‌گذاری (فاز ۱۸) — عمومی ─────────────────────────────────────
     *
     * `quote` یک POST است ولی **نوشتن نیست**: هیچ رکوردی نمی‌سازد و هیچ مبلغی
     * از کلاینت نمی‌پذیرد. برای همین CSRF نمی‌خواهد (مهمان هم باید بتواند قیمت
     * ببیند) ولی same-origin دارد تا از scraping بین‌سایتی جلوگیری شود.
     */
    Route::middleware('throttle:pricing_plans')
        ->get('pricing/plans', [PricingController::class, 'plans'])
        ->name('pricing.plans');

    Route::middleware(['api.origin', 'throttle:pricing_quote'])
        ->post('pricing/quote', [PricingController::class, 'quote'])
        ->name('pricing.quote');

    /* ── سفارش (فاز ۱۸) — مالکیت فقط از سشن ───────────────────────────── */
    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:commerce_orders'])
        ->post('orders', [OrderController::class, 'store'])
        ->name('orders.store');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:commerce_orders'])
        ->post('orders/{id}/cancel', [OrderController::class, 'cancel'])
        ->whereUuid('id')
        ->name('orders.cancel');

    /* ── پرداخت (فاز ۱۸) ──────────────────────────────────────────────── */
    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:commerce_payments'])
        ->post('orders/{orderId}/payments', [PaymentController::class, 'store'])
        ->whereUuid('orderId')
        ->name('orders.payments.store');

    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:commerce_payments'])
        ->post('payments/{id}/verify', [PaymentController::class, 'verify'])
        ->whereUuid('id')
        ->name('payments.verify');

    /*
     * ⚠️ Webhook: **بدون** `api.auth`/`api.origin`/`api.csrf`.
     *
     * دلیل: درخواست از مرورگر کاربر نمی‌آید و کوکی/سشن ندارد؛ پس CSRF
     * double-submit و same-origin اینجا بی‌معنا و در عمل فقط retry درگاه را
     * می‌شکند. اعتبارسنجی آن **کاملاً رمزنگاری‌شده** است (امضای provider که در
     * آداپتور بررسی می‌شود) — همان چیزی که §41/§64 خواسته‌اند.
     */
    Route::middleware('throttle:payment_webhook')
        ->post('payments/webhook/{provider}', [PaymentController::class, 'webhook'])
        ->where('provider', '[a-z0-9-]+')
        ->name('payments.webhook');

    /* ── دادهٔ تجاری کاربر جاری (فاز ۱۸) ──────────────────────────────── */
    Route::middleware(['api.auth', 'throttle:commerce_me'])
        ->prefix('me')
        ->name('me.')
        ->group(function (): void {
            Route::get('orders', [MeCommerceController::class, 'orders'])->name('orders.index');
            Route::get('orders/{id}', [MeCommerceController::class, 'order'])->whereUuid('id')->name('orders.show');
            Route::get('payments', [MeCommerceController::class, 'payments'])->name('payments.index');
            Route::get('subscriptions', [MeCommerceController::class, 'subscriptions'])->name('subscriptions.index');
            Route::get('entitlements', [MeCommerceController::class, 'entitlements'])->name('entitlements.index');
        });

    // AI Mentor: fail-closed until explicit entitlement, quota, processing approval and provider.
    /* دو لایهٔ rate limit جدا: `throttle:a,b` پشتیبانی نمی‌شود (لاراول آرگومان دوم
       را decay می‌گیرد) ⇒ هر limiter در middleware خودش. */
    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:ai_chat', 'throttle:ai_chat_ip'])
        ->post('ai/chat', [AiController::class, 'chat'])->name('ai.chat');
    Route::middleware(['api.auth', 'api.origin', 'api.csrf', 'throttle:ai_upload', 'throttle:ai_upload_ip'])
        ->post('ai/attachments', [AiController::class, 'attachment'])->name('ai.attachments');

    // ── پنل (نیازمند سشن ادمین + مجوز واقعی پنل) — فاز ۶ ───────────────
    Route::prefix('admin')->name('admin.')->middleware('api.audit')->group(function (): void {
        Route::middleware(['api.admin', 'throttle:admin-me'])
            ->get('auth/me', [AdminAuthController::class, 'me'])
            ->name('auth.me');

        Route::middleware(['api.admin', 'throttle:admin_questions'])->group(function (): void {
            Route::middleware('api.can:testbank.read')->group(function (): void {
                Route::get('questions', [AdminQuestionController::class, 'index'])->name('questions.index');
                Route::get('questions/{id}', [AdminQuestionController::class, 'show'])->whereUuid('id')->name('questions.show');
            });

            Route::middleware(['api.origin', 'api.csrf'])->group(function (): void {
                Route::middleware('api.can:testbank.create')
                    ->post('questions', [AdminQuestionController::class, 'store'])
                    ->name('questions.store');

                Route::middleware('api.can:testbank.update')
                    ->patch('questions/{id}', [AdminQuestionController::class, 'update'])
                    ->whereUuid('id')
                    ->name('questions.update');

                Route::middleware('api.can:testbank.publish')->group(function (): void {
                    Route::post('questions/{id}/publish', [AdminQuestionController::class, 'publish'])->whereUuid('id')->name('questions.publish');
                    Route::post('questions/{id}/archive', [AdminQuestionController::class, 'archive'])->whereUuid('id')->name('questions.archive');
                });
            });
        });

        // ── فلش‌کارت رسمی (فاز ۹) — مجوزهای واقعی `flashcards.*` ────────
        Route::middleware(['api.admin', 'throttle:admin_flashcards'])->group(function (): void {
            Route::middleware('api.can:flashcards.read')->group(function (): void {
                Route::get('flashcards/decks', [AdminFlashcardController::class, 'index'])->name('flashcards.decks.index');
                Route::get('flashcards/decks/{id}', [AdminFlashcardController::class, 'show'])->whereUuid('id')->name('flashcards.decks.show');
                Route::get('flashcards/decks/{id}/cards', [AdminFlashcardController::class, 'cards'])->whereUuid('id')->name('flashcards.decks.cards');
            });

            Route::middleware(['api.origin', 'api.csrf'])->group(function (): void {
                Route::middleware('api.can:flashcards.create')
                    ->post('flashcards/decks', [AdminFlashcardController::class, 'store'])
                    ->name('flashcards.decks.store');

                Route::middleware('api.can:flashcards.create')
                    ->post('flashcards/decks/{id}/cards', [AdminFlashcardController::class, 'storeCard'])
                    ->whereUuid('id')
                    ->name('flashcards.decks.cards.store');

                Route::middleware('api.can:flashcards.update')
                    ->patch('flashcards/decks/{id}', [AdminFlashcardController::class, 'update'])
                    ->whereUuid('id')
                    ->name('flashcards.decks.update');

                Route::middleware('api.can:flashcards.update')
                    ->patch('flashcards/cards/{id}', [AdminFlashcardController::class, 'updateCard'])
                    ->whereUuid('id')
                    ->name('flashcards.cards.update');

                Route::middleware('api.can:flashcards.delete')
                    ->delete('flashcards/decks/{id}', [AdminFlashcardController::class, 'destroy'])
                    ->whereUuid('id')
                    ->name('flashcards.decks.destroy');

                Route::middleware('api.can:flashcards.delete')
                    ->delete('flashcards/cards/{id}', [AdminFlashcardController::class, 'destroyCard'])
                    ->whereUuid('id')
                    ->name('flashcards.cards.destroy');

                Route::middleware('api.can:flashcards.publish')->group(function (): void {
                    Route::post('flashcards/decks/{id}/publish', [AdminFlashcardController::class, 'publish'])->whereUuid('id')->name('flashcards.decks.publish');
                    Route::post('flashcards/decks/{id}/archive', [AdminFlashcardController::class, 'archive'])->whereUuid('id')->name('flashcards.decks.archive');
                });
            });
        });

        /*
         * ── ویکی (فاز ۱۰) — مجوزهای واقعی `articles.*` و `categories.*` ──
         *
         * ⚠️ کلید `wiki.*` عمداً ساخته نشد: در RBAC واقعی پنل وجود ندارد و مجوز
         * اختراعی یعنی «deny-by-default» شکسته می‌شود. ادیتور مقالهٔ پنل همین
         * کلیدها را مصرف می‌کند.
         */
        Route::middleware(['api.admin', 'throttle:admin_wiki'])->group(function (): void {
            Route::middleware('api.can:articles.read')->group(function (): void {
                Route::get('wiki/articles', [AdminWikiController::class, 'articles'])->name('wiki.articles.index');
                Route::get('wiki/articles/{id}', [AdminWikiController::class, 'showArticle'])->whereUuid('id')->name('wiki.articles.show');
            });

            Route::middleware('api.can:categories.read')
                ->get('wiki/categories', [AdminWikiController::class, 'categories'])
                ->name('wiki.categories.index');

            Route::middleware(['api.origin', 'api.csrf'])->group(function (): void {
                Route::middleware('api.can:articles.create')
                    ->post('wiki/articles', [AdminWikiController::class, 'storeArticle'])
                    ->name('wiki.articles.store');

                Route::middleware('api.can:articles.update')
                    ->patch('wiki/articles/{id}', [AdminWikiController::class, 'updateArticle'])
                    ->whereUuid('id')
                    ->name('wiki.articles.update');

                Route::middleware('api.can:articles.publish')->group(function (): void {
                    Route::post('wiki/articles/{id}/publish', [AdminWikiController::class, 'publishArticle'])->whereUuid('id')->name('wiki.articles.publish');
                    Route::post('wiki/articles/{id}/archive', [AdminWikiController::class, 'archiveArticle'])->whereUuid('id')->name('wiki.articles.archive');
                });

                Route::middleware('api.can:categories.create')
                    ->post('wiki/categories', [AdminWikiController::class, 'storeCategory'])
                    ->name('wiki.categories.store');

                Route::middleware('api.can:categories.update')
                    ->patch('wiki/categories/{id}', [AdminWikiController::class, 'updateCategory'])
                    ->whereUuid('id')
                    ->name('wiki.categories.update');

                Route::middleware('api.can:categories.delete')
                    ->delete('wiki/categories/{id}', [AdminWikiController::class, 'destroyCategory'])
                    ->whereUuid('id')
                    ->name('wiki.categories.destroy');

                Route::middleware('api.can:articles.update')
                    ->post('wiki/relations', [AdminWikiController::class, 'storeRelation'])
                    ->name('wiki.relations.store');

                Route::middleware('api.can:articles.update')
                    ->delete('wiki/relations/{id}', [AdminWikiController::class, 'destroyRelation'])
                    ->whereUuid('id')
                    ->name('wiki.relations.destroy');
            });
        });

        /*
         * ── گراف دانش (فاز ۱۲) — مجوزهای واقعی `articles.*` ─────────────
         *
         * مانند ویکی، کلید `knowledge.*` عمداً ساخته نشد: در RBAC واقعی پنل
         * وجود ندارد و مجوز اختراعی یعنی deny-by-default شکسته می‌شود. گراف
         * دانش محتوای دانشی است و با همان کلیدهای مقاله قفل شده است.
         */
        Route::middleware(['api.admin', 'throttle:admin_knowledge'])->group(function (): void {
            Route::middleware('api.can:articles.read')->group(function (): void {
                Route::get('knowledge/nodes', [AdminKnowledgeController::class, 'nodes'])->name('knowledge.nodes.index');
                Route::get('knowledge/nodes/{id}', [AdminKnowledgeController::class, 'showNode'])->whereUuid('id')->name('knowledge.nodes.admin-show');
            });

            Route::middleware(['api.origin', 'api.csrf'])->group(function (): void {
                Route::middleware('api.can:articles.create')
                    ->post('knowledge/nodes', [AdminKnowledgeController::class, 'storeNode'])
                    ->name('knowledge.nodes.store');

                Route::middleware('api.can:articles.update')
                    ->patch('knowledge/nodes/{id}', [AdminKnowledgeController::class, 'updateNode'])
                    ->whereUuid('id')
                    ->name('knowledge.nodes.update');

                Route::middleware('api.can:articles.publish')->group(function (): void {
                    Route::post('knowledge/nodes/{id}/publish', [AdminKnowledgeController::class, 'publishNode'])->whereUuid('id')->name('knowledge.nodes.publish');
                    Route::post('knowledge/nodes/{id}/archive', [AdminKnowledgeController::class, 'archiveNode'])->whereUuid('id')->name('knowledge.nodes.archive');
                });

                Route::middleware('api.can:articles.delete')
                    ->delete('knowledge/nodes/{id}', [AdminKnowledgeController::class, 'destroyNode'])
                    ->whereUuid('id')
                    ->name('knowledge.nodes.destroy');

                Route::middleware('api.can:articles.update')
                    ->post('knowledge/edges', [AdminKnowledgeController::class, 'storeEdge'])
                    ->name('knowledge.edges.store');

                Route::middleware('api.can:articles.update')
                    ->delete('knowledge/edges/{id}', [AdminKnowledgeController::class, 'destroyEdge'])
                    ->whereUuid('id')
                    ->name('knowledge.edges.destroy');
            });
        });

        /*
         * ── Media Core (فاز ۱۵) — مجوزهای واقعی `media.*` ────────────────
         *
         * آپلود مصرف‌کنندهٔ واقعی‌اش پنل محتواست (Reference/Anatomy assets)؛
         * مسیر دانشجویی ساخته نشد چون مصرف‌کننده ندارد. Media Center/پلیتفرم
         * انتشار عمداً غایب است (§22).
         */
        Route::middleware(['api.admin', 'throttle:media_admin'])->group(function (): void {
            Route::middleware(['api.origin', 'api.can:media.upload'])
                ->post('media/uploads', [AdminMediaController::class, 'upload'])
                ->name('media.upload');

            Route::middleware('api.can:media.read')
                ->get('media', [AdminMediaController::class, 'index'])
                ->name('media.index');

            Route::middleware(['api.origin', 'api.csrf', 'api.can:media.delete'])->group(function (): void {
                Route::post('media/{id}/archive', [AdminMediaController::class, 'archive'])->whereUuid('id')->name('media.archive');
                Route::delete('media/{id}', [AdminMediaController::class, 'destroy'])->whereUuid('id')->name('media.destroy');
            });
        });

        /*
         * ── مراجع (فاز ۱۵) — مجوزهای واقعی `references.*` ────────────────
         */
        Route::middleware(['api.admin', 'throttle:references_admin'])->group(function (): void {
            Route::middleware('api.can:references.read')->group(function (): void {
                Route::get('references', [AdminReferenceController::class, 'index'])->name('references.admin-index');
                Route::get('references/{id}', [AdminReferenceController::class, 'show'])->whereUuid('id')->name('references.admin-show');
            });

            Route::middleware(['api.origin', 'api.csrf'])->group(function (): void {
                Route::middleware('api.can:references.create')
                    ->post('references', [AdminReferenceController::class, 'store'])
                    ->name('references.store');

                Route::middleware('api.can:references.update')->group(function (): void {
                    Route::patch('references/{id}', [AdminReferenceController::class, 'update'])->whereUuid('id')->name('references.update');
                    Route::post('references/{id}/assets', [AdminReferenceController::class, 'attachAsset'])->whereUuid('id')->name('references.assets.attach');
                    Route::delete('references/{id}/assets/{assetId}', [AdminReferenceController::class, 'detachAsset'])->whereUuid('id')->whereUuid('assetId')->name('references.assets.detach');
                });

                Route::middleware('api.can:references.publish')->group(function (): void {
                    Route::post('references/{id}/publish', [AdminReferenceController::class, 'publish'])->whereUuid('id')->name('references.publish');
                    Route::post('references/{id}/archive', [AdminReferenceController::class, 'archive'])->whereUuid('id')->name('references.archive');
                });
            });
        });

        /*
         * ── آناتومی (فاز ۱۵) — کلید `references.*`: در RBAC واقعی پنل کلید
         * مستقل آناتومی وجود ندارد و کلید اختراعی یعنی شکستن deny-by-default؛
         * اطلس سه‌بعدی محتوای مرجع است (انتخاب مستندشده در گزارش).
         */
        Route::middleware(['api.admin', 'throttle:anatomy_admin'])->group(function (): void {
            Route::middleware('api.can:references.read')
                ->get('anatomy/assets', [AdminAnatomyController::class, 'index'])
                ->name('anatomy.assets.admin-index');

            Route::middleware(['api.origin', 'api.csrf'])->group(function (): void {
                Route::middleware('api.can:references.create')
                    ->post('anatomy/assets', [AdminAnatomyController::class, 'store'])
                    ->name('anatomy.assets.store');

                Route::middleware('api.can:references.update')
                    ->patch('anatomy/assets/{id}', [AdminAnatomyController::class, 'update'])
                    ->whereUuid('id')
                    ->name('anatomy.assets.update');

                Route::middleware('api.can:references.publish')->group(function (): void {
                    Route::post('anatomy/assets/{id}/publish', [AdminAnatomyController::class, 'publish'])->whereUuid('id')->name('anatomy.assets.publish');
                    Route::post('anatomy/assets/{id}/archive', [AdminAnatomyController::class, 'archive'])->whereUuid('id')->name('anatomy.assets.archive');
                });
            });
        });

        /*
         * ── مقاله‌ها (فاز ۱۶) — مجوزهای واقعی `articles.*` و `categories.*` ─
         */
        Route::middleware(['api.admin', 'throttle:articles_admin'])->group(function (): void {
            Route::middleware('api.can:articles.read')->group(function (): void {
                Route::get('articles', [AdminArticleController::class, 'index'])->name('articles.admin-index');
                Route::get('articles/{id}', [AdminArticleController::class, 'show'])->whereUuid('id')->name('articles.admin-show');
            });

            Route::middleware('api.can:categories.read')
                ->get('articles/categories', [AdminArticleController::class, 'categories'])
                ->name('articles.admin-categories');

            Route::middleware(['api.origin', 'api.csrf'])->group(function (): void {
                Route::middleware('api.can:articles.create')
                    ->post('articles', [AdminArticleController::class, 'store'])
                    ->name('articles.store');

                Route::middleware('api.can:articles.update')
                    ->patch('articles/{id}', [AdminArticleController::class, 'update'])
                    ->whereUuid('id')
                    ->name('articles.update');

                Route::middleware('api.can:articles.publish')->group(function (): void {
                    Route::post('articles/{id}/publish', [AdminArticleController::class, 'publish'])->whereUuid('id')->name('articles.publish');
                    Route::post('articles/{id}/archive', [AdminArticleController::class, 'archive'])->whereUuid('id')->name('articles.archive');
                });

                Route::middleware('api.can:categories.create')
                    ->post('articles/categories', [AdminArticleController::class, 'storeCategory'])
                    ->name('articles.categories.store');

                Route::middleware('api.can:categories.update')
                    ->patch('articles/categories/{id}', [AdminArticleController::class, 'updateCategory'])
                    ->whereUuid('id')
                    ->name('articles.categories.update');

                Route::middleware('api.can:categories.delete')
                    ->delete('articles/categories/{id}', [AdminArticleController::class, 'destroyCategory'])
                    ->whereUuid('id')
                    ->name('articles.categories.destroy');
            });
        });

        /*
         * ── بازخورد (فاز ۱۶) — مجوزهای واقعی `feedback.*` ────────────────
         */
        Route::middleware(['api.admin', 'throttle:feedback_admin'])->group(function (): void {
            Route::middleware('api.can:feedback.read')->group(function (): void {
                Route::get('feedback', [AdminFeedbackController::class, 'index'])->name('feedback.index');
                Route::get('feedback/{id}', [AdminFeedbackController::class, 'show'])->whereUuid('id')->name('feedback.show');
            });

            Route::middleware(['api.origin', 'api.csrf', 'api.can:feedback.manage'])->group(function (): void {
                Route::post('feedback/{id}/replies', [AdminFeedbackController::class, 'reply'])->whereUuid('id')->name('feedback.reply');
                Route::patch('feedback/{id}', [AdminFeedbackController::class, 'updateStatus'])->whereUuid('id')->name('feedback.status');
            });
        });

        /*
         * ── کاتالوگ بین‌الملل (فاز ۱۷) — مجوزهای واقعی `intl.*` ───────────
         *
         * چرا این مسیرها ساخته شدند: مصرف‌کنندهٔ واقعی وجود دارد
         * (`src/layout/admin/views/AdminIntlCourses.jsx`) و کلیدهای `intl.*`
         * از قبل در RBAC واقعی پنل ثبت‌اند. هیچ کلید مجوز تازه‌ای اختراع نشد.
         *
         * ⚠️ CRUD آزمون بین‌الملل اینجا **نیست**: پنل فعلی CRUD آزمون ندارد و
         * قاعدهٔ فاز ۷ («endpoint بی‌مصرف ساخته نشود») دست‌نخورده است.
         */
        Route::middleware(['api.admin', 'throttle:intl_write'])->group(function (): void {
            Route::middleware('api.can:intl.read')->group(function (): void {
                Route::get('international/providers', [AdminInternationalController::class, 'providers'])->name('international.providers.index');
                Route::get('international/courses', [AdminInternationalController::class, 'courses'])->name('international.courses.index');
            });

            Route::middleware(['api.origin', 'api.csrf'])->group(function (): void {
                Route::middleware('api.can:intl.create')->group(function (): void {
                    Route::post('international/providers', [AdminInternationalController::class, 'storeProvider'])->name('international.providers.store');
                    Route::post('international/courses', [AdminInternationalController::class, 'storeCourse'])->name('international.courses.store');
                });

                Route::middleware('api.can:intl.update')->group(function (): void {
                    Route::patch('international/providers/{id}', [AdminInternationalController::class, 'updateProvider'])->whereUuid('id')->name('international.providers.update');
                    Route::patch('international/courses/{id}', [AdminInternationalController::class, 'updateCourse'])->whereUuid('id')->name('international.courses.update');
                });

                Route::middleware('api.can:intl.publish')->group(function (): void {
                    Route::post('international/providers/{id}/status', [AdminInternationalController::class, 'setProviderStatus'])->whereUuid('id')->name('international.providers.status');
                    Route::post('international/courses/{id}/status', [AdminInternationalController::class, 'setCourseStatus'])->whereUuid('id')->name('international.courses.status');
                });

                Route::middleware('api.can:intl.delete')
                    ->delete('international/courses/{id}', [AdminInternationalController::class, 'destroyCourse'])
                    ->whereUuid('id')
                    ->name('international.courses.destroy');
            });
        });

        /*
         * ── داشبورد (فاز ۲۰) — سنجه‌های واقعی، بدون Mock ────────────────────
         * مجوز: `analytics.read` (کلید واقعی پنل).
         */
        Route::middleware(['api.admin', 'throttle:admin_dashboard', 'api.can:analytics.read'])
            ->get('dashboard', [AdminDashboardController::class, 'overview'])
            ->name('dashboard.overview');

        /*
         * ── کاربران (فاز ۲۰) — فقط خواندن و جست‌وجو ─────────────────────────
         *
         * هیچ endpoint حذف/تغییر نقش ساخته نشد: UI مصرف‌کنندهٔ واقعی ندارد و
         * `users.delete` عمداً در `ADMIN_DENIED` است (§76). دادهٔ حساس (هش رمز،
         * subject گوگل، توکن سشن) هرگز خوانده نمی‌شود (§101).
         */
        Route::middleware(['api.admin', 'throttle:admin_users', 'api.can:users.read'])->group(function (): void {
            Route::get('users', [AdminUserController::class, 'index'])->name('users.index');
            Route::get('users/{id}', [AdminUserController::class, 'show'])->whereUuid('id')->name('users.show');
        });

        /*
         * ── Audit log (فاز ۲۰) — فقط خواندن ────────────────────────────────
         * Audit append-only است؛ هیچ مسیر ویرایش/حذف وجود ندارد (§82).
         */
        Route::middleware(['api.admin', 'throttle:admin_audit', 'api.can:logs.read'])->group(function (): void {
            Route::get('audit-logs', [AdminAuditLogController::class, 'index'])->name('audit-logs.index');
            Route::get('audit-logs/{id}', [AdminAuditLogController::class, 'show'])->whereUuid('id')->name('audit-logs.show');
        });

        /*
         * ── تنظیمات سیستم (فاز ۲۰) — allowlist + optimistic lock ───────────
         * کلید محرمانه فقط نوشتنی است و مقدارش هرگز برنمی‌گردد (§80).
         */
        Route::middleware(['api.admin', 'throttle:admin_settings_read', 'api.can:settings.read'])
            ->get('settings', [AdminSettingController::class, 'index'])
            ->name('settings.index');

        Route::middleware(['api.admin', 'api.origin', 'api.csrf', 'throttle:admin_settings_write', 'api.can:settings.update'])
            ->patch('settings', [AdminSettingController::class, 'update'])
            ->name('settings.update');

        /*
         * ── عملیات (فاز ۲۰) — Dead letter / ایندکس / تحویل اعلان ────────────
         *
         * مجوزها `ops.read` و `ops.manage` هستند: قابلیتشان (مشاهدهٔ زیرساخت صف،
         * ایندکس جست‌وجو، وضعیت تحویل اعلان) در واژگان legacy وجود نداشت، پس
         * نزدیک‌ترین کلید موجود **جعل** نشد و کلید صریح ساخته شد؛ در seeder به
         * `super-admin` و `admin` داده می‌شود.
         */
        Route::middleware(['api.admin', 'throttle:admin_ops_read', 'api.can:ops.read'])->group(function (): void {
            Route::get('queue/failed', [AdminOpsController::class, 'failedJobs'])->name('queue.failed');
            Route::get('search/status', [AdminOpsController::class, 'searchStatus'])->name('search.status');
            Route::get('notifications/deliveries', [AdminOpsController::class, 'deliveries'])->name('notifications.deliveries');
        });

        Route::middleware(['api.admin', 'api.origin', 'api.csrf', 'throttle:admin_ops_read', 'api.can:ops.manage'])->group(function (): void {
            Route::post('queue/failed/{id}/retry', [AdminOpsController::class, 'retryFailedJob'])
                ->whereUuid('id')
                ->name('queue.failed.retry');

            Route::post('notifications/deliveries/{id}/retry', [AdminOpsController::class, 'retryDelivery'])
                ->whereUuid('id')
                ->name('notifications.deliveries.retry');
        });

        Route::middleware(['api.admin', 'api.origin', 'api.csrf', 'throttle:admin_search_rebuild', 'api.can:ops.manage'])
            ->post('search/rebuild', [AdminOpsController::class, 'rebuildSearch'])
            ->name('search.rebuild');

        /*
         * ── ارسال اعلان (فاز ۲۰) — فقط نوع `system` ─────────────────────────
         * نوع‌های دامنه‌ای (نتیجهٔ آزمون/دستاورد) از پنل قابل جعل نیستند؛ فقط از
         * رخداد واقعی ساخته می‌شوند (§19/§21).
         */
        Route::middleware(['api.admin', 'api.origin', 'api.csrf', 'throttle:admin_notifications_send', 'api.can:notifications.send'])
            ->post('notifications', [AdminNotificationController::class, 'store'])
            ->name('notifications.store');

        Route::middleware(['api.admin', 'api.origin', 'api.csrf', 'throttle:admin_notifications_send', 'api.can:notifications.send'])
            ->post('notifications/broadcast', [AdminNotificationController::class, 'broadcast'])
            ->name('notifications.broadcast');
    });
});
