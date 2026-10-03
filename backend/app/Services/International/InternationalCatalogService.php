<?php

namespace App\Services\International;

use App\Exceptions\ApiErrorException;
use App\Models\Exam;
use App\Models\InternationalCourse;
use App\Models\InternationalProvider;
use App\Models\User;
use App\Services\Content\EntitlementGate;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * کاتالوگ بین‌الملل — فاز ۱۷. تنها مسیر خواندن/نوشتن این دامنه.
 *
 * قواعدی که اینجا قفل شده‌اند:
 *
 *   • **پیش‌نویس لو نمی‌رود.** خواندن عمومی فقط `published` می‌بیند و «پیدا
 *     نشد» با ۴۰۴ پاسخ می‌گیرد، نه ۴۰۳ — وگرنه فهرست پیش‌نویس‌ها قابل شمارش
 *     می‌شد (همان قاعدهٔ `ContentQueryService`).
 *   • **دورهٔ زیر ناشرِ پیش‌نویس دیده نمی‌شود** (`scopePubliclyVisible`)، چون
 *     انتشار ناشر باید اثر داشته باشد.
 *   • **دسترسی پرمیوم از یک جا.** `required_capability` از خود دوره خوانده
 *     می‌شود و از `EntitlementGate` عبور می‌کند. این سرویس هیچ‌وقت به
 *     Payment/Order/Subscription نگاه نمی‌کند (Prompt §91).
 *   • **آزمون موتور تازه ندارد.** `kind = international` روی همان `exams`
 *     موجود است و خواندنش از همان جدول انجام می‌شود (Prompt §12/§14).
 */
class InternationalCatalogService
{
    /** @var array<string, list<string>> */
    private const STATUS_TRANSITIONS = [
        InternationalProvider::STATUS_DRAFT => [InternationalProvider::STATUS_PUBLISHED, InternationalProvider::STATUS_ARCHIVED],
        InternationalProvider::STATUS_PUBLISHED => [InternationalProvider::STATUS_DRAFT, InternationalProvider::STATUS_ARCHIVED],
        InternationalProvider::STATUS_ARCHIVED => [InternationalProvider::STATUS_DRAFT],
    ];

    public function __construct(private readonly EntitlementGate $entitlements) {}

    /* ───────────────────────── عمومی ───────────────────────── */

    /** @return Collection<int, InternationalProvider> */
    public function publishedProviders(): Collection
    {
        return InternationalProvider::query()
            ->published()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }

    /**
     * فهرست دوره‌های منتشرشده.
     *
     * جست‌وجو روی `title`/`description`/`category` انجام می‌شود و **نه** روی
     * `tags`: ستون `tags` از نوع jsonb است و `like` روی jsonb در PostgreSQL خطای
     * operator می‌دهد (`SQLSTATE[42883]`) — همان تله‌ای که در فاز ۱۶ برای کد
     * گروه دیده شد. جست‌وجوی برچسب Use Case تأییدشده‌ای ندارد (§10).
     */
    public function publishedCourses(
        ?string $providerSlug,
        ?string $category,
        ?string $search,
        int $perPage,
    ): LengthAwarePaginator {
        $term = $search === null ? null : trim($search);

        return InternationalCourse::query()
            ->publiclyVisible()
            ->with('provider:id,slug,name,name_en,kind,country,logo_media_id')
            ->when($providerSlug !== null && $providerSlug !== '', function ($query) use ($providerSlug): void {
                $query->whereHas('provider', fn ($inner) => $inner->where('slug', $providerSlug));
            })
            ->when($category !== null && $category !== '', fn ($query) => $query->where('category', $category))
            ->when($term !== null && $term !== '', function ($query) use ($term): void {
                $like = '%'.$this->escapeLike($term).'%';

                $query->where(function ($inner) use ($like): void {
                    $inner->where('title', 'like', $like)
                        ->orWhere('description', 'like', $like)
                        ->orWhere('category', 'like', $like);
                });
            })
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * دورهٔ منتشرشده + وضعیت دسترسی کاربر جاری.
     *
     * @return array{course: InternationalCourse, locked: bool}
     */
    public function publishedCourse(string $slug, ?User $user): array
    {
        $course = InternationalCourse::query()
            ->publiclyVisible()
            ->with('provider')
            ->where('slug', $slug)
            ->first();

        if ($course === null) {
            throw new ApiErrorException('NOT_FOUND', 404, 'Course not found.');
        }

        $locked = $course->isPremium()
            && ! $this->entitlements->allows($user, (string) $course->required_capability, $course);

        return ['course' => $course, 'locked' => $locked];
    }

    /**
     * وضعیت دسترسی برای مجموعه‌ای از قابلیت‌ها — یک‌بار برای کل یک صفحه.
     *
     * چرا این متد: اگر Resource برای هر ردیف خودش گیت را صدا بزند، فهرست ۱۲
     * دوره‌ای یعنی ۱۲ کوئری. اینجا قابلیت‌های متمایز یک‌بار پرسیده می‌شوند و
     * تصمیم در یک جا (همان گیت) گرفته می‌شود.
     *
     * @param  list<string>  $capabilities
     * @return array<string, bool>
     */
    public function capabilityAccess(?User $user, array $capabilities): array
    {
        $access = [];

        foreach (array_unique(array_filter($capabilities)) as $capability) {
            $access[$capability] = $this->entitlements->allows($user, $capability);
        }

        return $access;
    }

    /**
     * آیا کاربر به این دوره دسترسی دارد؟ تنها نقطهٔ تصمیم دسترسی دوره.
     * در صورت نبود دسترسی ⇒ ۴۰۳ با کد صریح (`ENTITLEMENT_REQUIRED`).
     *
     * چرا ۴۰۳ و نه ۴۰۴: دورهٔ پرمیوم **منتشر** است و در فهرست عمومی دیده
     * می‌شود؛ پس وجودش راز نیست. پنهان‌کردنش فقط UI را گمراه می‌کرد.
     */
    public function assertAccessible(InternationalCourse $course, ?User $user): void
    {
        if (! $course->isPremium()) {
            return;
        }

        if (! $this->entitlements->allows($user, (string) $course->required_capability, $course)) {
            throw new ApiErrorException(
                'ENTITLEMENT_REQUIRED',
                403,
                'This course requires an active entitlement.',
                ['capability' => [(string) $course->required_capability]],
            );
        }
    }

    /**
     * آزمون‌های بین‌الملل — **بدون endpoint تازه**.
     *
     * آزمون بین‌الملل روی همان `exams` با `kind = international` است و از
     * `GET /api/v1/exams?kind=international` (با محاسبهٔ کامل وضعیت کاربر) سرو
     * می‌شود. این متد فقط یک query خواندنی برای تست/گزارش است و به هیچ مسیری
     * وصل نیست؛ ساختن مسیر موازی، موتور و قرارداد دومی می‌ساخت (Prompt §12/§14).
     *
     * @return LengthAwarePaginator<Exam>
     */
    public function internationalExams(int $perPage): LengthAwarePaginator
    {
        return Exam::query()
            ->where('kind', Exam::KIND_INTERNATIONAL)
            ->publiclyVisible()
            ->orderBy('title')
            ->paginate($perPage)
            ->withQueryString();
    }

    /* ───────────────────────── پنل ───────────────────────── */

    /** @return LengthAwarePaginator<InternationalProvider> */
    public function adminProviders(?string $status, int $perPage): LengthAwarePaginator
    {
        return InternationalProvider::query()
            ->when($status !== null && $status !== '', fn ($query) => $query->where('status', $status))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    /** @param array<string, mixed> $data */
    public function createProvider(array $data): InternationalProvider
    {
        $provider = new InternationalProvider;
        $provider->forceFill([
            ...$this->providerAttributes($data),
            'status' => InternationalProvider::STATUS_DRAFT,
            'published_at' => null,
            'origin' => 'panel',
        ])->save();

        return $provider;
    }

    /** @param array<string, mixed> $data */
    public function updateProvider(InternationalProvider $provider, array $data): InternationalProvider
    {
        /* `origin` هرگز از درخواست خوانده نمی‌شود؛ فقط رکورد قبلی آن را تعیین می‌کند. */
        $provider->forceFill($this->providerAttributes($data))->save();

        return $provider->refresh();
    }

    public function setProviderStatus(InternationalProvider $provider, string $status): InternationalProvider
    {
        $allowed = self::STATUS_TRANSITIONS[$provider->status] ?? [];

        if (! in_array($status, $allowed, true)) {
            throw new ApiErrorException('INVALID_STATUS_TRANSITION', 409, "Cannot move provider from {$provider->status} to {$status}.");
        }

        $provider->forceFill([
            'status' => $status,
            'published_at' => $status === InternationalProvider::STATUS_PUBLISHED
                ? ($provider->published_at ?? Carbon::now())
                : $provider->published_at,
        ])->save();

        return $provider->refresh();
    }

    /** @return LengthAwarePaginator<InternationalCourse> */
    public function adminCourses(?string $status, ?string $providerId, int $perPage): LengthAwarePaginator
    {
        return InternationalCourse::query()
            ->with('provider:id,slug,name,status')
            ->when($status !== null && $status !== '', fn ($query) => $query->where('status', $status))
            ->when($providerId !== null && $providerId !== '', fn ($query) => $query->where('provider_id', $providerId))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    /** @param array<string, mixed> $data */
    public function createCourse(array $data): InternationalCourse
    {
        $provider = $this->providerFor($data['provider_id'] ?? null);

        $course = new InternationalCourse;
        $course->forceFill([
            ...$this->courseAttributes($data),
            'provider_id' => $provider->getKey(),
            'status' => InternationalCourse::STATUS_DRAFT,
            'published_at' => null,
            'origin' => 'panel',
        ])->save();

        return $course;
    }

    /** @param array<string, mixed> $data */
    public function updateCourse(InternationalCourse $course, array $data): InternationalCourse
    {
        $attributes = $this->courseAttributes($data);

        if (array_key_exists('provider_id', $data)) {
            $attributes['provider_id'] = $this->providerFor($data['provider_id'])->getKey();
        }

        $course->forceFill($attributes)->save();

        return $course->refresh();
    }

    public function setCourseStatus(InternationalCourse $course, string $status): InternationalCourse
    {
        $allowed = self::STATUS_TRANSITIONS[$course->status] ?? [];

        if (! in_array($status, $allowed, true)) {
            throw new ApiErrorException('INVALID_STATUS_TRANSITION', 409, "Cannot move course from {$course->status} to {$status}.");
        }

        if ($status === InternationalCourse::STATUS_PUBLISHED) {
            $provider = $course->provider;

            if ($provider === null || ! $provider->isPublished()) {
                /* انتشار دوره زیر ناشر منتشرنشده، دوره را بی‌اثر می‌کند ⇒ صریح رد می‌شود. */
                throw new ApiErrorException('PROVIDER_NOT_PUBLISHED', 409, 'Publish the provider before publishing its courses.');
            }
        }

        $course->forceFill([
            'status' => $status,
            'published_at' => $status === InternationalCourse::STATUS_PUBLISHED
                ? ($course->published_at ?? Carbon::now())
                : $course->published_at,
        ])->save();

        return $course->refresh();
    }

    /**
     * حذف فیزیکی — **فقط** برای دوره/ناشری که هیچ تاریخچه‌ای ندارد.
     *
     * چون جدول‌های Commerce به این کاتالوگ FK ندارند، خطر مالی وجود ندارد؛ ولی
     * حذف رکورد منتشرشده آدرس عمومی را می‌شکند، پس ابتدا باید آرشیو شود.
     */
    public function deleteCourse(InternationalCourse $course): void
    {
        if ($course->status !== InternationalCourse::STATUS_ARCHIVED) {
            throw new ApiErrorException('COURSE_NOT_ARCHIVED', 409, 'Archive the course before deleting it.');
        }

        DB::transaction(fn () => $course->delete());
    }

    /** @param array<string, mixed> $data */
    private function providerFor(mixed $providerId): InternationalProvider
    {
        $provider = is_string($providerId) && Str::isUuid($providerId)
            ? InternationalProvider::query()->find($providerId)
            : null;

        if ($provider === null) {
            throw ApiErrorException::invalid(['provider_id' => ['PROVIDER_NOT_FOUND']]);
        }

        return $provider;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function providerAttributes(array $data): array
    {
        $attributes = [];

        foreach ([
            'slug', 'name', 'name_en', 'kind', 'country', 'founded',
            'description', 'focus', 'logo_media_id', 'sort_order', 'marquee_order',
        ] as $key) {
            if (array_key_exists($key, $data)) {
                $attributes[$key] = $data[$key];
            }
        }

        return $attributes;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function courseAttributes(array $data): array
    {
        $attributes = [];

        foreach ([
            'slug', 'title', 'description', 'category', 'level', 'tags',
            'cover_media_id', 'accent', 'accent_soft', 'badge',
            'duration_minutes', 'total_duration_label', 'required_capability', 'sort_order',
        ] as $key) {
            if (array_key_exists($key, $data)) {
                $attributes[$key] = $data[$key];
            }
        }

        return $attributes;
    }

    /** فرار دادن نویسه‌های ویژهٔ LIKE تا `%` کاربر به wildcard تبدیل نشود. */
    private function escapeLike(string $term): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term);
    }
}
