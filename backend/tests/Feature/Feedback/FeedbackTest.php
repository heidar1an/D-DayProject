<?php

namespace Tests\Feature\Feedback;

use App\Models\Feedback;
use App\Models\FeedbackReply;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsWiki;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * Feedback — فاز ۱۶ (§45-§51/§61).
 *
 * هویت فقط از سشن (یا guestRef شفاف مهمان)؛ بدنه plain text؛ admin_id پاسخ
 * قابل جعل نیست؛ هر کاربر فقط بازخورد خودش را می‌بیند.
 */
final class FeedbackTest extends TestCase
{
    use BuildsWiki, InteractsWithAdmin, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedRbac();
    }

    public function test_guest_can_submit_with_opaque_guest_ref(): void
    {
        // بدون سشن — فقط guestRef.
        $this->postJsonWithOrigin('/api/v1/feedback', [
            'source' => 'support',
            'subject' => 'مشکل ورود',
            'message' => 'صفحهٔ ورود باز نمی‌شود.',
            'guestRef' => 'guest-abc123',
        ])->assertCreated()->assertJsonPath('data.feedback.status', 'open');

        $row = Feedback::query()->firstOrFail();
        $this->assertNull($row->user_id);
        $this->assertSame('guest-abc123', $row->guest_ref);
    }

    public function test_guest_without_ref_is_rejected(): void
    {
        $this->postJsonWithOrigin('/api/v1/feedback', [
            'source' => 'support',
            'message' => 'پیام مهمان بی‌ref',
        ])->assertFieldError('guestRef');
    }

    public function test_signed_user_identity_comes_from_session_not_body(): void
    {
        $student = $this->signedInStudent(['phone' => '09611111111']);

        $this->postJsonWithOrigin('/api/v1/feedback', [
            'source' => 'test-bank',
            'message' => 'نمایش گزینه‌ها به‌هم می‌ریزد.',
            // تلاش برای جعل هویت/مقصد — باید نادیده گرفته شود.
            'guestRef' => 'guest-forged',
            'meta' => ['page' => '/test-bank'],
        ], $student['csrf'])->assertCreated();

        $row = Feedback::query()->firstOrFail();
        $this->assertSame($student['user']->getKey(), (string) $row->user_id);
        $this->assertNull($row->guest_ref);
    }

    public function test_source_is_allowlisted(): void
    {
        $student = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/feedback', [
            'source' => 'arbitrary-source',
            'message' => 'x',
        ], $student['csrf'])->assertFieldError('source');
    }

    public function test_user_sees_only_own_feedback_and_replies(): void
    {
        $first = $this->signedInStudent(['phone' => '09622222222']);
        $this->postJsonWithOrigin('/api/v1/feedback', [
            'source' => 'micro', 'message' => 'بازخورد اول',
        ], $first['csrf'])->assertCreated();

        $this->forgetCookies();
        $second = $this->signedInStudent(['phone' => '09633333333']);
        $this->postJsonWithOrigin('/api/v1/feedback', [
            'source' => 'micro', 'message' => 'بازخورد دوم',
        ], $second['csrf'])->assertCreated();

        $rows = $this->getJson('/api/v1/me/feedback')->assertOk()->assertJsonCount(1, 'data.feedback');
        $this->assertSame('بازخورد دوم', $rows->json('data.feedback.0.body'));
    }

    public function test_admin_reply_sets_status_and_admin_id_from_session(): void
    {
        $student = $this->signedInStudent();
        $created = $this->postJsonWithOrigin('/api/v1/feedback', [
            'source' => 'coordinated-exam', 'message' => 'تایمر آزمون اشتباه است.',
        ], $student['csrf'])->assertCreated();
        $feedbackId = $created->json('data.feedback.id');

        $admin = $this->makeAdmin('admin'); // نقش admin بدون feedback.manage؟ — مجوز دارد (فقط SENSITIVE/ADMIN_DENIED حذف می‌شوند).

        $this->actingAsAdmin($admin)
            ->postJsonWithOrigin("/api/v1/admin/feedback/{$feedbackId}/replies", [
                // تلاش برای جعل admin_id — نادیده گرفته می‌شود (§49).
                'adminId' => '00000000-0000-0000-0000-000000000000',
                'body' => 'بررسی شد؛ اصلاح می‌شود.',
            ], $this->adminCsrf())->assertCreated();

        $feedback = Feedback::query()->findOrFail($feedbackId);
        $reply = $feedback->replies()->firstOrFail();

        $this->assertSame($admin->getKey(), (string) $reply->admin_id);
        $this->assertSame('answered', $feedback->status);
    }

    public function test_roleless_admin_cannot_read_or_reply(): void
    {
        $student = $this->signedInStudent();
        $created = $this->postJsonWithOrigin('/api/v1/feedback', [
            'source' => 'support', 'message' => 'پیام تستی',
        ], $student['csrf'])->assertCreated();
        $feedbackId = $created->json('data.feedback.id');

        $roleless = $this->makeRolelessAdmin();
        $this->actingAsAdmin($roleless);

        $this->getJson('/api/v1/admin/feedback')->assertForbidden();
        $this->postJsonWithOrigin("/api/v1/admin/feedback/{$feedbackId}/replies", ['body' => 'x'], $this->adminCsrf())
            ->assertForbidden();

        $this->assertSame(0, FeedbackReply::query()->count());
    }

    public function test_status_update_and_mark_read_flow(): void
    {
        $student = $this->signedInStudent(['phone' => '09644444444']);
        $created = $this->postJsonWithOrigin('/api/v1/feedback', [
            'source' => 'intl-courses', 'message' => 'پیشنهاد دورهٔ تازه',
        ], $student['csrf'])->assertCreated();
        $feedbackId = $created->json('data.feedback.id');

        $admin = $this->makeAdmin('admin');
        $this->actingAsAdmin($admin)
            ->postJsonWithOrigin("/api/v1/admin/feedback/{$feedbackId}/replies", ['body' => 'پاسخ تیم'], $this->adminCsrf())
            ->assertCreated();

        // کاربر پاسخ را می‌بیند و خوانده‌شده می‌زند — ورود دوبارهٔ همان کاربر
        // (ثبت‌نام تکراری ۴۰۹ می‌گیرد؛ ورود با identity/رمز واقعی).
        $this->forgetCookies();
        $login = $this->postJsonWithOrigin('/api/v1/auth/login', [
            'identity' => '09644444444',
            'password' => 'Tapesh#1402',
        ])->assertOk();
        $this->withAuthCookies($login);
        $student = ['csrf' => $this->csrfHeader($login)];

        $this->getJson('/api/v1/me/feedback')
            ->assertOk()
            ->assertJsonPath('data.feedback.0.replies.0.body', 'پاسخ تیم');

        $this->postJsonWithOrigin('/api/v1/me/feedback/read', [], $student['csrf'])
            ->assertOk()
            ->assertJsonPath('data.updated', 1);

        $this->assertNotNull(Feedback::query()->findOrFail($feedbackId)->user_read_at);

        // بستن دستی از پنل.
        $this->actingAsAdmin($admin)
            ->patchJsonWithOrigin("/api/v1/admin/feedback/{$feedbackId}", ['status' => 'closed'], $this->adminCsrf())
            ->assertOk()
            ->assertJsonPath('data.feedback.status', 'closed');
    }

    public function test_feedback_body_is_plain_text_not_sanitized_html(): void
    {
        $student = $this->signedInStudent();

        $this->postJsonWithOrigin('/api/v1/feedback', [
            'source' => 'question-lab',
            'message' => '<script>alert(1)</script> مشکل در <b>فیلترها</b>',
        ], $student['csrf'])->assertCreated();

        // قرارداد plain text: بدنه دست‌نخورده ذخیره می‌شود چون فقط به‌صورت
        // متن رندر می‌شود؛ هیچ مسیر HTML از آن نمی‌سازد.
        $row = Feedback::query()->firstOrFail();
        $this->assertStringContainsString('<script>', $row->body);
        $this->assertStringContainsString('مشکل', $row->body);
    }
}
