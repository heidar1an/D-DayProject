/*
 * پل کاتالوگ بین‌الملل بین فرانت و v1 (فاز ۱۷) — تنها نقطهٔ تماس UI با
 * `/api/v1/international/*`.
 *
 * قرارداد v1:
 *   GET /international/providers                    → { providers }
 *   GET /international/courses?provider=&category=&search=&page=&perPage=
 *                                                   → { courses } + meta
 *   GET /international/courses/{slug}               → { course }
 *
 * ⚠️ مهم‌ترین تصمیم این پل: **موتور محتوا را تکرار نمی‌کند.**
 * v1 عمداً `sections`/`lessons` نمی‌دهد، چون فصل/درس/صفحه مالکیت Content Engine
 * است و آزمون روی همان موتور آزمون با `kind=international` سرو می‌شود. پس این
 * پل هیچ `sections` ساختگی نمی‌سازد؛ در عوض `serverIntl` را به‌عنوان لایهٔ
 * **افزودنی** روی کاتالوگ محلی می‌گذارد و `dataStatus.intlServer` منبع داده را
 * صادقانه اعلام می‌کند. اتصال فصل‌ها به Content API کارِ cutover است.
 *
 * `locked` از سرور می‌آید و بر اساس entitlement **همین** کاربر محاسبه شده است.
 * پل هرگز خودش تصمیم دسترسی نمی‌گیرد — یک منبع حقیقت برای «قفل است یا نه».
 */

import { V1_REASON, v1Request } from '../api/v1';

export const INTERNATIONAL_V1_REASON = V1_REASON;

export function toProvider(row) {
  if (!row) return null;

  return {
    id: row.id ?? null,
    slug: row.slug ?? null,
    name: row.name ?? null,
    nameEn: row.name_en ?? null,
    kind: row.kind ?? null,
    country: row.country ?? null,
    founded: row.founded ?? null,
    description: row.description ?? null,
    focus: row.focus ?? [],
    logoMediaId: row.logo_media_id ?? null,
    logoUrl: row.logo_url ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    marqueeOrder: Number(row.marquee_order ?? 0),
  };
}

/**
 * نگاشت دوره به شکل مصرفی لایه.
 *
 * `sections` عمداً **نیست** (مالکیت Content Engine) و `image`/`provider` برای
 * سازگاری با کارت‌های فعلی از همان دادهٔ سرور ساخته می‌شوند — نه از کاتالوگ ثابت.
 */
export function toCourse(row) {
  if (!row) return null;

  const provider = toProvider(row.provider);

  return {
    id: row.id ?? null,
    slug: row.slug ?? null,
    title: row.title ?? null,
    description: row.description ?? null,
    category: row.category ?? null,
    level: row.level ?? null,
    tags: row.tags ?? [],
    coverMediaId: row.cover_media_id ?? null,
    coverUrl: row.cover_url ?? null,
    accent: row.accent ?? null,
    accentSoft: row.accent_soft ?? null,
    badge: row.badge ?? null,
    durationMinutes: row.duration_minutes ?? null,
    totalDurationLabel: row.total_duration_label ?? null,
    requiredCapability: row.required_capability ?? null,
    /* تصمیم دسترسی از سرور — نه از پرچم کلاینت. */
    locked: row.locked === true,
    isPremium: Boolean(row.required_capability),
    sortOrder: Number(row.sort_order ?? 0),
    /* سازگاری با کارت‌های فعلی کاتالوگ. */
    providerId: provider?.id ?? null,
    provider: provider?.name ?? '',
    providerEn: provider?.nameEn ?? '',
    providerLogo: provider?.logoUrl ?? '',
    image: row.cover_url ?? null,
    providerRecord: provider,
  };
}

function toMeta(meta) {
  return {
    page: Number(meta?.page ?? 1),
    perPage: Number(meta?.perPage ?? 0),
    total: Number(meta?.total ?? 0),
    lastPage: Number(meta?.lastPage ?? 1),
  };
}

export async function fetchInternationalProviders() {
  const result = await v1Request('/international/providers');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, providers: (result.data?.providers ?? []).map(toProvider) };
}

/**
 * فهرست دوره‌ها. فیلترها allowlist اند؛ مقدار ناشناخته ۴۲۲ می‌گیرد (نه نادیده).
 */
export async function fetchInternationalCourses({ provider, category, search, page = 1, perPage = 12 } = {}) {
  const params = new URLSearchParams();

  if (provider) params.set('provider', provider);
  if (category) params.set('category', category);
  if (search) params.set('search', search);

  params.set('page', String(page));
  params.set('perPage', String(perPage));

  const result = await v1Request(`/international/courses?${params}`);

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      invalid: result.status === 422,
      fields: result.fields ?? null,
    };
  }

  return {
    ok: true,
    courses: (result.data?.courses ?? []).map(toCourse),
    meta: toMeta(result.meta),
  };
}

/**
 * جزئیات دوره.
 *
 * `forbidden:true` (۴۰۳ `ENTITLEMENT_REQUIRED`) یعنی دوره **منتشر** است ولی
 * پرمیوم و کاربر دسترسی ندارد ⇒ UI باید paywall بسازد، نه «پیدا نشد».
 * `notFound:true` یعنی پیش‌نویس/آرشیو/ناموجود ⇒ نباید از وجودش حرفی زد.
 */
export async function fetchInternationalCourse(slug) {
  const result = await v1Request(`/international/courses/${encodeURIComponent(slug)}`);

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      notFound: result.status === 404,
      forbidden: result.status === 403,
      entitlementRequired: result.code === 'ENTITLEMENT_REQUIRED',
    };
  }

  return { ok: true, course: toCourse(result.data?.course) };
}

/**
 * منبع سازگار با `intlCoursesService` — v1 به‌عنوان لایهٔ افزودنی.
 *
 * - `loadCatalog`: کاتالوگ محلی (fallback) + `serverIntl` وقتی v1 واقعاً سرو
 *   می‌شود. اگر v1 فهرست **خالی** برگرداند، کاتالوگ محلی دست‌نخورده می‌ماند
 *   (همان قاعدهٔ فعلی: «هنوز چیزی منتشر نشده» نباید کاتالوگ را پاک کند).
 * - `getCourse`: جزئیات از سرور؛ اگر v1 نبود، از fallback.
 */
export function createInternationalV1Source({ fallback } = {}) {
  if (!fallback || typeof fallback.loadCatalog !== 'function') {
    throw new Error('INTERNATIONAL_V1_FALLBACK_REQUIRED');
  }

  return {
    async loadCatalog(options = {}) {
      const base = await fallback.loadCatalog(options);
      const result = await fetchInternationalCourses({
        page: options.page ?? 1,
        perPage: options.perPage ?? 12,
      });

      if (!result.ok) {
        const unavailable = result.reason === V1_REASON.NOT_V1;

        return {
          ...base,
          dataStatus: { ...(base?.dataStatus ?? {}), intlServer: unavailable ? 'unavailable' : 'error' },
        };
      }

      if (result.courses.length === 0) {
        return { ...base, dataStatus: { ...(base?.dataStatus ?? {}), intlServer: 'empty' } };
      }

      return {
        ...base,
        /* لایهٔ افزودنی — فیلد موجودی را بازنویسی نمی‌کند. */
        serverIntl: {
          courses: result.courses,
          meta: result.meta,
          fetchedAt: new Date().toISOString(),
        },
        dataStatus: { ...(base?.dataStatus ?? {}), intlServer: 'connected' },
      };
    },

    async getCourse(slug, options = {}) {
      const result = await fetchInternationalCourse(slug);

      if (result.ok) return { ok: true, course: result.course, source: 'server' };
      if (result.forbidden) return { ok: false, ...result };

      if (typeof fallback.getCourse === 'function') {
        return { ...(await fallback.getCourse(slug, options)), source: 'local' };
      }

      return { ok: false, ...result };
    },

    async providers() {
      const result = await fetchInternationalProviders();

      if (result.ok) return { ok: true, providers: result.providers, source: 'server' };

      if (typeof fallback.providers === 'function') {
        return { ...(await fallback.providers()), source: 'local' };
      }

      return { ok: false, ...result };
    },
  };
}

/* ── پنل (فاز ۱۷) — مجوزهای واقعی `intl.*` ────────────────────────────
 *
 * چرا اینجا و نه فایل جدا: همان دامنه است و همان نگاشت‌ها استفاده می‌شوند.
 * تفاوت با نمای عمومی: `status`/`origin`/`published_at` می‌آیند (ادمین چرخهٔ
 * عمر را مدیریت می‌کند) و `status` فیلتر مجاز است.
 *
 * ⚠️ `status` هرگز در بدنهٔ ساخت/ویرایش فرستاده **نمی‌شود**: گذار وضعیت مسیر
 * جداگانه دارد و سرویس آن را اعتبارسنجی می‌کند. اگر پنل اشتباهاً وضعیت را در
 * PATCH بفرستد، سرور آن را نادیده می‌گیرد و UI نباید روی آن حساب کند.
 */

function toAdminProvider(row) {
  const base = toProvider(row);
  if (!base) return null;

  return {
    ...base,
    status: row.status ?? null,
    origin: row.origin ?? null,
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function toAdminCourse(row) {
  const base = toCourse(row);
  if (!base) return null;

  return {
    ...base,
    status: row.status ?? null,
    origin: row.origin ?? null,
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    /* در نمای پنل، ناشر کامل می‌آید (نه فقط نام). */
    providerRecord: toAdminProvider(row.provider) ?? base.providerRecord,
  };
}

export async function fetchAdminInternationalProviders({ status, page = 1, perPage = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  if (status) params.set('status', status);

  const result = await v1Request(`/admin/international/providers?${params}`);

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      forbidden: result.status === 403,
    };
  }

  return { ok: true, providers: (result.data?.providers ?? []).map(toAdminProvider), meta: toMeta(result.meta) };
}

export async function fetchAdminInternationalCourses({ status, providerId, page = 1, perPage = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  if (status) params.set('status', status);
  if (providerId) params.set('providerId', providerId);

  const result = await v1Request(`/admin/international/courses?${params}`);

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      forbidden: result.status === 403,
    };
  }

  return { ok: true, courses: (result.data?.courses ?? []).map(toAdminCourse), meta: toMeta(result.meta) };
}

/**
 * ساخت/ویرایش دوره یا ناشر از پنل.
 *
 * `status` عمداً از بدنه حذف می‌شود حتی اگر UI بفرستد — گذار وضعیت مسیر
 * جداگانه دارد و یک منبع حقیقت باید بماند.
 */
export async function upsertAdminInternational(kind, payload, { id } = {}) {
  const resource = kind === 'provider' ? 'providers' : 'courses';
  const path = id
    ? `/admin/international/${resource}/${encodeURIComponent(id)}`
    : `/admin/international/${resource}`;

  const { status: _ignoredStatus, ...body } = payload ?? {};

  const result = await v1Request(path, { method: id ? 'PATCH' : 'POST', body });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      fields: result.fields ?? null,
      notFound: result.status === 404,
      forbidden: result.status === 403,
    };
  }

  const row = result.data?.provider ?? result.data?.course ?? null;

  return { ok: true, record: kind === 'provider' ? toAdminProvider(row) : toAdminCourse(row) };
}

/**
 * گذار وضعیت — تنها راه تغییر `status`.
 *
 * `conflict:true` (۴۰۹) یعنی گذار مجاز نیست (مثلاً `draft → archived` یا انتشار
 * دوره زیر ناشر منتشرنشده). UI باید وضعیت را refetch کند، نه دوباره بزند.
 */
export async function setAdminInternationalStatus(kind, id, status) {
  const resource = kind === 'provider' ? 'providers' : 'courses';

  const result = await v1Request(`/admin/international/${resource}/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: { status },
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      notFound: result.status === 404,
      conflict: result.status === 409,
      forbidden: result.status === 403,
    };
  }

  const row = result.data?.provider ?? result.data?.course ?? null;

  return { ok: true, record: kind === 'provider' ? toAdminProvider(row) : toAdminCourse(row) };
}

/**
 * حذف فیزیکی دوره — فقط `archived`.
 *
 * `conflict:true` یعنی دوره آرشیو نشده است. حذف رکورد منتشرشده آدرس عمومی را
 * می‌شکند، پس سرور عمداً سخت‌گیر است و UI باید اول آرشیو کند.
 */
export async function deleteAdminInternationalCourse(id) {
  const result = await v1Request(`/admin/international/courses/${encodeURIComponent(id)}`, { method: 'DELETE' });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      notFound: result.status === 404,
      conflict: result.status === 409,
      forbidden: result.status === 403,
    };
  }

  return { ok: true, deleted: result.data?.deleted === true };
}
