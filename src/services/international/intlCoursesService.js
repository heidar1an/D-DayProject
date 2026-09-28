/*
 * خوانندهٔ عمومی «دوره‌های بین‌الملل» — همان الگوی `/api/public/micro/library`
 * و `/api/public/references/library`: کاتالوگ ثابت (`intlCatalog.js`) fallback
 * است و نسخهٔ منتشرشدهٔ پنل، وقتی وجود داشته باشد، **جای** آن را می‌گیرد.
 *
 * چرا «جای» و نه «کنار»: seed سرور هر ۶ دورهٔ ثابت را یک‌بار به رکورد پنل
 * تبدیل می‌کند، پس اگر ادغام می‌کردیم هر دوره دو بار در کاتالوگ می‌آمد و
 * ویرایش پنل هم بی‌اثر می‌ماند.
 *
 * نکتهٔ کلیدی معماری: ناشر دوره فقط با `providerId` به منبع وصل است. اتصال
 * نام/لوگوی منبع به دوره در همین فایل انجام می‌شود (`withProviders`) تا یک
 * منبع حقیقت بماند — ویرایش نام دانشگاه، همهٔ کارت‌هایش را هم عوض می‌کند.
 */

import { INTL_COURSE_CATALOG, INTL_COURSE_CATEGORIES, INTL_PROVIDER_CATALOG } from './intlCatalog';
import { courseImage, providerLogo } from './intlAssets';

const TTL_MS = 15000;

let cache = null;
let cachedAt = 0;
let pending = null;

const categoryLabelOf = (categoryId, fallback) =>
  fallback || INTL_COURSE_CATEGORIES.find((item) => item.id === categoryId)?.label || 'دوره';

/* رکورد سرور → شکل مصرفی لایه (تصویر حل‌شده، تعداد ویدیو، ناشر) */
function normalizeCourse(record, providerById) {
  const sections = Array.isArray(record?.sections) ? record.sections : [];
  const provider = providerById.get(record?.providerId) ?? null;

  return {
    ...record,
    sections,
    /* تعداد ویدیو همیشه از خود بخش‌ها می‌آید تا با ویرایش پنل یکی بماند */
    lessons: sections.length,
    image: courseImage(record),
    provider: provider?.name ?? record?.providerName ?? '',
    providerEn: provider?.nameEn ?? record?.providerEn ?? '',
    providerLogo: provider ? providerLogo(provider) : '',
    categoryLabel: categoryLabelOf(record?.category, record?.categoryLabel),
  };
}

function normalizeProvider(record) {
  return { ...record, logo: providerLogo(record) };
}

/* اتصال ناشر به دوره + نرمال‌سازی هر دو فهرست */
function buildCatalog(courses, providers) {
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  return {
    courses: courses.map((course) => normalizeCourse(course, providerById)),
    providers: providers.map(normalizeProvider),
  };
}

/* کاتالوگ ثابت داخل کد — fallback و مبنای seed سرور */
export function staticCatalog() {
  return buildCatalog(INTL_COURSE_CATALOG, INTL_PROVIDER_CATALOG);
}

const bySort = (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);

/*
 * خواندن کاتالوگ. اگر سرور در دسترس نباشد یا هنوز چیزی منتشر نشده باشد،
 * کاتالوگ ثابت برمی‌گردد و لایه هرگز خالی نمی‌ماند.
 * `force: true` کش را دور می‌زند (باز کردن دوبارهٔ لایه همیشه تازه می‌گیرد).
 */
export async function loadIntlCatalog({ force = false } = {}) {
  if (!force && cachedAt && Date.now() - cachedAt < TTL_MS) return cache;
  if (pending) return pending;

  pending = (async () => {
    let result = staticCatalog();

    try {
      const response = await fetch('/api/public/intl-courses/library', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`intl-library-http-${response.status}`);

      const payload = await response.json();
      const courses = payload?.data?.courses;
      const providers = payload?.data?.providers;

      /* فقط فهرست غیرخالی جای نسخهٔ ثابت را می‌گیرد؛ فهرست خالی یعنی «هنوز
         چیزی منتشر نشده» و نباید کاتالوگ را پاک کند. */
      if (Array.isArray(courses) && courses.length > 0) {
        const publishedProviders = Array.isArray(providers) && providers.length > 0
          ? providers
          : INTL_PROVIDER_CATALOG;
        result = buildCatalog(
          [...courses].sort(bySort),
          [...publishedProviders].sort(bySort),
        );
      }
    } catch {
      /* سرور نیست — کاتالوگ ثابت سرجایش می‌ماند */
    } finally {
      cache = result;
      cachedAt = Date.now();
      pending = null;
    }

    return result;
  })();

  return pending;
}

/* فهرست فیلترهای کاتالوگ = «همه» + دسته‌هایی که واقعاً دوره دارند */
export function catalogFilters(courses = []) {
  const used = new Set(courses.map((course) => course.category));
  return [
    { id: 'all', label: 'همه دوره‌ها' },
    ...INTL_COURSE_CATEGORIES.filter((category) => used.has(category.id)),
  ];
}

export default { loadIntlCatalog, staticCatalog, catalogFilters };
