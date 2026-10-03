<?php

use App\Providers\AiServiceProvider;
use App\Providers\AnalyticsServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\CommerceServiceProvider;
use App\Providers\CommunityServiceProvider;
use App\Providers\ExamServiceProvider;
use App\Providers\FlashcardServiceProvider;
use App\Providers\GamificationServiceProvider;
use App\Providers\IdentityServiceProvider;
use App\Providers\InternationalServiceProvider;
use App\Providers\KnowledgeServiceProvider;
use App\Providers\LearningServiceProvider;
use App\Providers\OpsServiceProvider;
use App\Providers\WikiServiceProvider;

return [
    AppServiceProvider::class,
    IdentityServiceProvider::class,
    // فاز ۵/۶: Policyها و rate limit های یادگیری/بانک سؤال.
    // (بایند `EntitlementGate` در فاز ۱۸ به `CommerceServiceProvider` منتقل شد.)
    LearningServiceProvider::class,
    // فاز ۷: Policyها و rate limit های موتور آزمون.
    ExamServiceProvider::class,
    // فاز ۸: اتصال Domain Event ها به Analytics و invalidate کش per-user.
    AnalyticsServiceProvider::class,
    // فاز ۹: Policyها، رجیستری الگوریتم Spaced Repetition و rate limit های فلش‌کارت.
    FlashcardServiceProvider::class,
    // فاز ۱۰: Policyها، rate limit و کش محتوای عمومی ویکی.
    WikiServiceProvider::class,
    // فاز ۱۲: Policyها و rate limitهای گراف دانش.
    KnowledgeServiceProvider::class,
    // فاز ۱۳/۱۴: مسیر سبز + گیمیفیکیشن — listenerهای رخداد واقعی و rate limitها.
    GamificationServiceProvider::class,
    // فاز ۱۵/۱۶: rate limitهای Media/References/Anatomy/Articles/Notes/Groups/Feedback.
    CommunityServiceProvider::class,
    // فاز ۱۷: rate limitهای کاتالوگ بین‌الملل.
    InternationalServiceProvider::class,
    // فاز ۱۸: بایند واقعی `EntitlementGate` + rate limitهای Commerce.
    CommerceServiceProvider::class,
    // فاز ۱۹/۲۰: اعلان/جست‌وجو (مصرف‌کنندهٔ رخداد موجود) + rate limitهای پنل مدیریتی.
    OpsServiceProvider::class,
    AiServiceProvider::class,
];
