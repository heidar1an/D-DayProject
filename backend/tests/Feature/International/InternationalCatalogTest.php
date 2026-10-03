<?php

namespace Tests\Feature\International;

use App\Models\Exam;
use App\Models\InternationalCourse;
use App\Models\InternationalProvider;
use App\Services\Commerce\EntitlementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsCommerce;
use Tests\Concerns\BuildsExams;
use Tests\Concerns\BuildsQuestionBank;
use Tests\Concerns\InteractsWithAdmin;
use Tests\TestCase;

/**
 * کاتالوگ بین‌الملل — فاز ۱۷.
 *
 * سه چیز سنجیده می‌شود: (۱) انتشار درست — پیش‌نویس لو نمی‌رود، (۲) دسترسی
 * پرمیوم از entitlement می‌آید و نه از پرچم کلاینت، (۳) آزمون بین‌الملل روی
 * همان موتور آزمون است، نه موتور دوم.
 */
class InternationalCatalogTest extends TestCase
{
    use BuildsCommerce, BuildsExams, BuildsQuestionBank, InteractsWithAdmin, RefreshDatabase;

    private function provider(string $slug = 'harvard', string $status = InternationalProvider::STATUS_PUBLISHED): InternationalProvider
    {
        $provider = new InternationalProvider;
        $provider->forceFill([
            'slug' => $slug,
            'name' => 'دانشگاه '.$slug,
            'name_en' => 'University of '.$slug,
            'kind' => InternationalProvider::KIND_UNIVERSITY,
            'country' => 'ایالات متحده',
            'focus' => ['سلامت عمومی'],
            'sort_order' => 10,
            'status' => $status,
            'origin' => 'tapesh',
            'published_at' => $status === InternationalProvider::STATUS_PUBLISHED ? now() : null,
        ])->save();

        return $provider;
    }

    /** @param array<string, mixed> $overrides */
    private function course(InternationalProvider $provider, array $overrides = []): InternationalCourse
    {
        $status = $overrides['status'] ?? InternationalCourse::STATUS_PUBLISHED;

        $course = new InternationalCourse;
        $course->forceFill([
            'slug' => $overrides['slug'] ?? 'global-health',
            'provider_id' => $provider->getKey(),
            'title' => $overrides['title'] ?? 'نگاهی جهانی به سلامت',
            'description' => $overrides['description'] ?? 'دورهٔ سلامت عمومی',
            'category' => $overrides['category'] ?? 'medicine',
            'level' => 'مقدماتی',
            'tags' => ['سلامت عمومی'],
            'required_capability' => $overrides['required_capability'] ?? null,
            'sort_order' => $overrides['sort_order'] ?? 10,
            'status' => $status,
            'origin' => 'panel',
            'published_at' => $status === InternationalCourse::STATUS_PUBLISHED ? now() : null,
        ])->save();

        return $course;
    }

    public function test_public_list_returns_only_published_courses_of_published_providers(): void
    {
        $provider = $this->provider();
        $this->course($provider, ['slug' => 'published-one']);
        $this->course($provider, ['slug' => 'draft-one', 'status' => InternationalCourse::STATUS_DRAFT]);
        $this->course($provider, ['slug' => 'archived-one', 'status' => InternationalCourse::STATUS_ARCHIVED]);

        $response = $this->getJson('/api/v1/international/courses')->assertOk();

        $this->assertSame(['published-one'], array_column($response->json('data.courses'), 'slug'));
        $this->assertSame(1, $response->json('meta.total'));
    }

    public function test_course_under_draft_provider_is_hidden_even_when_published(): void
    {
        $draftProvider = $this->provider('draft-university', InternationalProvider::STATUS_DRAFT);
        $this->course($draftProvider, ['slug' => 'hidden-course']);

        $this->getJson('/api/v1/international/courses')->assertOk()->assertJsonCount(0, 'data.courses');
        $this->getJson('/api/v1/international/courses/hidden-course')->assertNotFound();
    }

    public function test_draft_and_archived_course_detail_return_404_not_403(): void
    {
        $provider = $this->provider();
        $this->course($provider, ['slug' => 'draft-detail', 'status' => InternationalCourse::STATUS_DRAFT]);
        $this->course($provider, ['slug' => 'archived-detail', 'status' => InternationalCourse::STATUS_ARCHIVED]);

        /* ۴۰۴ نه ۴۰۳: وجود پیش‌نویس نباید لو برود (enumeration). */
        $this->getJson('/api/v1/international/courses/draft-detail')->assertNotFound();
        $this->getJson('/api/v1/international/courses/archived-detail')->assertNotFound();
        $this->getJson('/api/v1/international/courses/does-not-exist')->assertNotFound();
    }

    public function test_list_filters_and_pagination_are_server_side(): void
    {
        $harvard = $this->provider('harvard');
        $mit = $this->provider('mit');
        $this->course($harvard, ['slug' => 'a', 'category' => 'medicine', 'title' => 'سلامت عمومی']);
        $this->course($mit, ['slug' => 'b', 'category' => 'science', 'title' => 'علم را چطور ببینیم']);
        $this->course($mit, ['slug' => 'c', 'category' => 'science', 'title' => 'آزمایش طراحی']);

        $byProvider = $this->getJson('/api/v1/international/courses?provider=mit')->assertOk();
        $this->assertSame(['b', 'c'], array_column($byProvider->json('data.courses'), 'slug'));

        $byCategory = $this->getJson('/api/v1/international/courses?category=medicine')->assertOk();
        $this->assertSame(['a'], array_column($byCategory->json('data.courses'), 'slug'));

        $bySearch = $this->getJson('/api/v1/international/courses?search='.rawurlencode('آزمایش'))->assertOk();
        $this->assertSame(['c'], array_column($bySearch->json('data.courses'), 'slug'));

        $paged = $this->getJson('/api/v1/international/courses?perPage=1&page=2')->assertOk();
        $this->assertSame(3, $paged->json('meta.total'));
        $this->assertSame(2, $paged->json('meta.page'));
        $this->assertCount(1, $paged->json('data.courses'));
    }

    public function test_unknown_query_parameter_is_rejected(): void
    {
        /* allowlist بسته است: `?status=draft` نباید «شاید بعداً» باشد. */
        $this->getJson('/api/v1/international/courses?status=draft')->assertStatus(400);
    }

    public function test_providers_endpoint_returns_published_providers_only(): void
    {
        $this->provider('harvard');
        $this->provider('draft-university', InternationalProvider::STATUS_DRAFT);

        $response = $this->getJson('/api/v1/international/providers')->assertOk();

        $this->assertSame(['harvard'], array_column($response->json('data.providers'), 'slug'));
        /* وضعیت/مبدأ/legacy_id هرگز در پاسخ عمومی نیست. */
        $this->assertArrayNotHasKey('status', $response->json('data.providers.0'));
        $this->assertArrayNotHasKey('origin', $response->json('data.providers.0'));
        $this->assertArrayNotHasKey('legacy_id', $response->json('data.providers.0'));
    }

    public function test_premium_course_is_locked_for_guest_and_for_user_without_entitlement(): void
    {
        $this->enableCommerce();
        $this->makeProduct('pro', ['intl']);
        $provider = $this->provider();
        $this->course($provider, ['slug' => 'premium-one', 'required_capability' => 'intl']);

        /* مهمان: قفل است ولی وجودش پنهان نمی‌شود (دوره منتشر شده است). */
        $list = $this->getJson('/api/v1/international/courses')->assertOk();
        $this->assertTrue($list->json('data.courses.0.locked'));

        $this->getJson('/api/v1/international/courses/premium-one')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'ENTITLEMENT_REQUIRED');

        /* کاربر بدون entitlement: همان ۴۰۳. */
        $student = $this->signedInStudent();
        $this->getJson('/api/v1/international/courses/premium-one')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'ENTITLEMENT_REQUIRED');

        $this->assertNotNull($student['user']);
    }

    public function test_free_course_stays_open_when_entitlements_are_enforced(): void
    {
        $this->enableCommerce();
        $this->makeProduct('pro', ['intl']);
        $provider = $this->provider();
        $this->course($provider, ['slug' => 'free-one']);

        $this->getJson('/api/v1/international/courses/free-one')->assertOk()->assertJsonPath('data.course.locked', false);
    }

    public function test_entitlement_holder_can_open_premium_course(): void
    {
        $this->enableCommerce();
        $catalog = $this->makePurchasablePro();
        $provider = $this->provider();
        $this->course($provider, ['slug' => 'premium-owned', 'required_capability' => 'intl']);

        $student = $this->signedInStudent();
        $orderId = $this->placeOrder($student, 'pro', 'monthly');
        $authority = $this->startPayment($student, $orderId);

        $this->postJsonWithOrigin('/api/v1/payments/'.$this->paymentIdOf($orderId).'/verify', [
            'signature' => $this->verifySignature($authority, 449000),
        ], $student['csrf'])->assertOk();

        $this->getJson('/api/v1/international/courses/premium-owned')->assertOk()->assertJsonPath('data.course.locked', false);

        $this->assertTrue(app(EntitlementService::class)->has($student['user'], 'intl'));
        $this->assertSame($catalog['monthly']->code, 'pro-monthly');
    }

    public function test_when_enforcement_is_off_premium_is_open_and_reported_honestly(): void
    {
        /* رفتار مستند فاز ۱۸: تا زیرساخت پرداخت واقعی نیست، محتوا باز است. */
        $this->enableCommerce(enforceEntitlements: false);
        $this->makeProduct('pro', ['intl']);
        $provider = $this->provider();
        $this->course($provider, ['slug' => 'premium-off', 'required_capability' => 'intl']);

        $this->getJson('/api/v1/international/courses/premium-off')->assertOk()->assertJsonPath('data.course.locked', false);
    }

    public function test_international_exam_uses_the_existing_exam_engine(): void
    {
        ['exam' => $exam] = $this->makeExam(['kind' => Exam::KIND_INTERNATIONAL, 'title' => 'USMLE Step 1']);

        $this->assertSame(Exam::KIND_INTERNATIONAL, $exam->kind);

        $response = $this->getJson('/api/v1/exams?kind=international')->assertOk();

        $this->assertContains($exam->slug, array_column($response->json('data.exams'), 'slug'));

        /* موتور تازه‌ای ساخته نشده: همان مسیر Attempt موتور آزمون کار می‌کند. */
        $this->getJson('/api/v1/exams/'.$exam->getKey())->assertOk();

        /* و کلید پاسخ هرگز در قرارداد عمومی نیست. */
        $payload = $this->getJson('/api/v1/exams/'.$exam->slug)->assertOk()->json('data.exam');
        $this->assertArrayNotHasKey('key_snapshot_encrypted', $payload);
        $this->assertArrayNotHasKey('answer_key', $payload);
    }

    public function test_draft_international_exam_is_not_listed(): void
    {
        $this->makeExam(['kind' => Exam::KIND_INTERNATIONAL, 'slug' => 'draft-intl-exam', 'publish' => false]);

        $this->getJson('/api/v1/exams?kind=international')->assertOk()->assertJsonCount(0, 'data.exams');
        $this->getJson('/api/v1/exams/draft-intl-exam')->assertNotFound();
    }

    public function test_admin_lifecycle_requires_published_provider_before_publishing_course(): void
    {
        $this->seedRbac();
        $admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($admin);

        $created = $this->postJsonWithOrigin('/api/v1/admin/international/providers', [
            'slug' => 'oxford',
            'name' => 'دانشگاه آکسفورد',
            'kind' => 'university',
        ], $this->adminCsrf())->assertCreated();

        $providerId = $created->json('data.provider.id');
        $this->assertSame(InternationalProvider::STATUS_DRAFT, $created->json('data.provider.status'));

        $course = $this->postJsonWithOrigin('/api/v1/admin/international/courses', [
            'slug' => 'research-methods',
            'provider_id' => $providerId,
            'title' => 'روش تحقیق',
        ], $this->adminCsrf())->assertCreated();

        $courseId = $course->json('data.course.id');

        /* انتشار دوره زیر ناشر پیش‌نویس ⇒ ۴۰۹ صریح، نه انتشار بی‌اثر. */
        $this->postJsonWithOrigin("/api/v1/admin/international/courses/{$courseId}/status", [
            'status' => 'published',
        ], $this->adminCsrf())->assertStatus(409)->assertJsonPath('error.code', 'PROVIDER_NOT_PUBLISHED');

        $this->postJsonWithOrigin("/api/v1/admin/international/providers/{$providerId}/status", [
            'status' => 'published',
        ], $this->adminCsrf())->assertOk()->assertJsonPath('data.provider.status', 'published');

        $this->postJsonWithOrigin("/api/v1/admin/international/courses/{$courseId}/status", [
            'status' => 'published',
        ], $this->adminCsrf())->assertOk()->assertJsonPath('data.course.status', 'published');

        /* حالا در API عمومی دیده می‌شود. */
        $this->getJson('/api/v1/international/courses/research-methods')->assertOk();
    }

    public function test_admin_cannot_skip_status_transitions(): void
    {
        $this->seedRbac();
        $admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($admin);

        $created = $this->postJsonWithOrigin('/api/v1/admin/international/providers', [
            'slug' => 'cambridge',
            'name' => 'دانشگاه کمبریج',
        ], $this->adminCsrf())->assertCreated();

        $id = $created->json('data.provider.id');

        /* draft → archived → draft مجاز است، ولی archived → published نیست. */
        $this->postJsonWithOrigin("/api/v1/admin/international/providers/{$id}/status", ['status' => 'archived'], $this->adminCsrf())->assertOk();
        $this->postJsonWithOrigin("/api/v1/admin/international/providers/{$id}/status", ['status' => 'published'], $this->adminCsrf())
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'INVALID_STATUS_TRANSITION');
    }

    public function test_admin_endpoints_deny_by_default_without_permission(): void
    {
        $this->seedRbac();
        $roleless = $this->makeRolelessAdmin();
        $this->actingAsAdmin($roleless);

        $this->getJson('/api/v1/admin/international/courses', $this->adminCsrf())->assertStatus(403);
        $this->postJsonWithOrigin('/api/v1/admin/international/providers', ['slug' => 'x', 'name' => 'X'], $this->adminCsrf())->assertStatus(403);
    }

    public function test_editor_cannot_delete_and_delete_requires_archived_course(): void
    {
        $this->seedRbac();
        $editor = $this->makeAdmin('editor');
        $this->actingAsAdmin($editor);

        $provider = $this->provider();
        $course = $this->course($provider, ['slug' => 'to-delete']);

        /* editor کلید intl.delete ندارد (آینهٔ RBAC واقعی پنل). */
        $this->deleteJsonWithOrigin('/api/v1/admin/international/courses/'.$course->getKey(), [], $this->adminCsrf())
            ->assertStatus(403);

        $this->forgetCookies();
        $admin = $this->makeAdmin('admin');
        $this->actingAsAdmin($admin);

        /* حذف قبل از آرشیو ⇒ ۴۰۹؛ حذف رکورد منتشرشده آدرس عمومی را می‌شکند. */
        $this->deleteJsonWithOrigin('/api/v1/admin/international/courses/'.$course->getKey(), [], $this->adminCsrf())
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'COURSE_NOT_ARCHIVED');

        $this->postJsonWithOrigin('/api/v1/admin/international/courses/'.$course->getKey().'/status', ['status' => 'archived'], $this->adminCsrf())->assertOk();

        $this->deleteJsonWithOrigin('/api/v1/admin/international/courses/'.$course->getKey(), [], $this->adminCsrf())->assertOk();

        $this->assertNull(InternationalCourse::query()->find($course->getKey()));
    }

    public function test_premium_capability_must_exist_in_the_product_model(): void
    {
        $this->seedRbac();
        $admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($admin);

        $provider = $this->provider();

        /* قابلیتی که هیچ محصولی نمی‌فروشد ⇒ دوره‌ای که هرگز باز نمی‌شود. */
        $this->postJsonWithOrigin('/api/v1/admin/international/courses', [
            'slug' => 'locked-forever',
            'provider_id' => $provider->getKey(),
            'title' => 'دورهٔ بی‌کلید',
            'required_capability' => 'not-a-real-capability',
        ], $this->adminCsrf())->assertStatus(422)->assertFieldError('required_capability');

        $this->makeProduct('pro', ['intl']);

        $this->postJsonWithOrigin('/api/v1/admin/international/courses', [
            'slug' => 'locked-properly',
            'provider_id' => $provider->getKey(),
            'title' => 'دورهٔ پرمیوم',
            'required_capability' => 'intl',
        ], $this->adminCsrf())->assertCreated();
    }

    public function test_course_cannot_reference_arbitrary_provider_or_media(): void
    {
        $this->seedRbac();
        $admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($admin);

        $this->postJsonWithOrigin('/api/v1/admin/international/courses', [
            'slug' => 'bad-provider',
            'provider_id' => '11111111-1111-4111-8111-111111111111',
            'title' => 'دورهٔ بی‌ناشر',
        ], $this->adminCsrf())->assertStatus(422)->assertFieldError('provider_id');

        $provider = $this->provider();

        $this->postJsonWithOrigin('/api/v1/admin/international/courses', [
            'slug' => 'bad-media',
            'provider_id' => $provider->getKey(),
            'title' => 'دورهٔ با مدیای جعلی',
            'cover_media_id' => '11111111-1111-4111-8111-111111111111',
        ], $this->adminCsrf())->assertStatus(422)->assertFieldError('cover_media_id');
    }

    public function test_unknown_admin_route_identifiers_return_404_not_500(): void
    {
        $this->seedRbac();
        $admin = $this->makeAdmin('editor');
        $this->actingAsAdmin($admin);

        /* قید `whereUuid` روی مسیر: رشتهٔ دلخواه اصلاً match نمی‌شود ⇒ ۴۰۴. */
        $this->patchJsonWithOrigin('/api/v1/admin/international/courses/not-a-uuid', ['title' => 'x'], $this->adminCsrf())
            ->assertNotFound();

        $this->patchJsonWithOrigin('/api/v1/admin/international/courses/11111111-1111-4111-8111-111111111111', ['title' => 'x'], $this->adminCsrf())
            ->assertNotFound();
    }
}
