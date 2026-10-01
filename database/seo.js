/*
 * SEO سرورمحور — فاز ۲۲.
 *
 * محدودیت واقعی این پروژه (مستند می‌شود، پنهان نمی‌شود): مسیریابی **hash-driven**
 * است. یعنی `/#dashboard` و `/#admin` هرگز به سرور نمی‌رسند و pathname همیشه `/`
 * است. پیامدش:
 *   • هیچ route جداگانه‌ای برای خزنده وجود ندارد ⇒ per-route metadata فقط
 *     **کلاینتی** ممکن است (`src/services/seo/routeMeta.js`).
 *   • `sitemap.xml` نمی‌تواند برای هر صفحهٔ داخلی یک URL بدهد؛ فقط URL عمومی
 *     ریشه + مقالات منتشرشده‌ای که URL مستقل دارند.
 *   • `robots.txt` هم نمی‌تواند مسیرهای خصوصی را ببندد (همه یک URL‌اند) ⇒
 *     `noindex` روی همان صفحهٔ ریشه برای مسیرهای خصوصی + متای کلاینتی.
 *
 * منبع حقیقت دامنه: `PUBLIC_SITE_URL`. اگر تنظیم نشده باشد، پیش‌فرض
 * `http://localhost:4173` است و **در production نبودش خطاست** (sitemap با دامنهٔ
 * غلط، بدتر از نبود sitemap است).
 */

export const DEFAULT_SITE_URL = 'http://localhost:4173';

/** مسیرهای عمومی که واقعاً محتوا دارند (برای sitemap و متا). */
export const PUBLIC_ROUTES = Object.freeze([
  { path: '/', hash: '', changefreq: 'weekly', priority: '1.0' },
  { path: '/', hash: '#articles', changefreq: 'weekly', priority: '0.8' },
  { path: '/', hash: '#pricing', changefreq: 'monthly', priority: '0.6' },
  { path: '/', hash: '#courses', changefreq: 'weekly', priority: '0.8' },
]);

/** مسیرهایی که باید `noindex` بگیرند (پنل، داشبورد، ورود). */
export const PRIVATE_HASH_PREFIXES = Object.freeze([
  '#admin',
  '#dashboard',
  '#login',
  '#register',
  '#exam',
  '#test-bank',
  '#settings',
]);

/** دامنهٔ عمومی — تنها منبع حقیقت. */
export function siteUrlFromEnv(env = process.env) {
  const raw = String(env.PUBLIC_SITE_URL ?? '').trim();
  if (!raw) return DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}

/** آیا این hash یک ناحیهٔ خصوصی است؟ */
export function isPrivateHash(hash) {
  const value = String(hash ?? '').toLowerCase();
  if (!value.startsWith('#')) return false;
  return PRIVATE_HASH_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** بدنهٔ robots.txt. */
export function robotsTxt({ siteUrl = DEFAULT_SITE_URL } = {}) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /uploads/private/',
    'Disallow: /metrics',
    'Disallow: /readyz',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * ساخت XML نقشهٔ سایت.
 * @param {{siteUrl?: string, entries?: {loc: string, lastmod?: string, changefreq?: string, priority?: string}[], lastmod?: string}} options
 */
export function buildSitemap({ siteUrl = DEFAULT_SITE_URL, entries = [], lastmod = null } = {}) {
  const rows = entries.map((entry) => {
    const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];
    if (entry.lastmod ?? lastmod) parts.push(`    <lastmod>${escapeXml(entry.lastmod ?? lastmod)}</lastmod>`);
    if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    if (entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
    return `  <url>\n${parts.join('\n')}\n  </url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...rows,
    '</urlset>',
    '',
  ].join('\n');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** فهرست URLهای عمومی از routeهای ثابت + مقالات منتشرشده. */
export function publicEntries({ siteUrl = DEFAULT_SITE_URL, articles = [] } = {}) {
  const entries = PUBLIC_ROUTES.map((route) => ({
    loc: `${siteUrl}${route.path}${route.hash}`,
    changefreq: route.changefreq,
    priority: route.priority,
  }));

  for (const article of articles) {
    if (!article?.slug) continue;
    entries.push({
      loc: `${siteUrl}/#article/${article.slug}`,
      lastmod: article.updatedAt ?? article.createdAt ?? null,
      changefreq: 'monthly',
      priority: '0.7',
    });
  }

  /* حذف تکراری‌ها با حفظ ترتیب — sitemap نباید URL تکراری داشته باشد. */
  const seen = new Set();
  return entries.filter((entry) => (seen.has(entry.loc) ? false : (seen.add(entry.loc), true)));
}

/** استخراج مقالات منتشرشده از یک آرایهٔ خام (بدون نوشتن روی دیسک). */
export function publishedArticles(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && item.slug && String(item.status ?? 'published') === 'published')
    .map((item) => ({
      slug: item.slug,
      updatedAt: item.updatedAt ?? null,
      createdAt: item.createdAt ?? null,
    }));
}

const META_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => META_ESCAPE[ch]);

/**
 * تزریق متای پایه (canonical / og:url / og:image / twitter / JSON-LD) در HTML
 * سرورمحور. `noindex` برای ناحیهٔ خصوصی اضافه می‌شود.
 *
 * @param {string} html محتوای index.html
 * @param {{siteUrl?: string, hash?: string, title?: string, description?: string, image?: string}} options
 */
export function injectBaselineMeta(html, { siteUrl = DEFAULT_SITE_URL, hash = '', title = 'تپش | یادگیری پزشکی ساده‌تر', description = 'تپش؛ پلتفرم یادگیری پزشکی و آمادگی برای آزمون‌های علوم پزشکی', image = '/images/pictures/600ppi/Asset 6.webp' } = {}) {
  const canonical = `${siteUrl}/${hash}`;
  const ogImage = image.startsWith('http') ? image : `${siteUrl}${image}`;
  const privateArea = isPrivateHash(hash);

  const tags = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:image" content="${esc(ogImage)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(ogImage)}" />`,
  ];

  if (privateArea) tags.push('<meta name="robots" content="noindex, nofollow" />');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'تپش',
    url: siteUrl,
    logo: ogImage,
    description,
  };
  tags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);

  const block = `    ${tags.join('\n    ')}\n`;
  return String(html).includes('</head>') ? String(html).replace('</head>', `${block}  </head>`) : `${block}${html}`;
}

/** اعتبارسنجی متای تولیدشده — همان چیزی که `scripts/seo-validate.mjs` می‌سنجد. */
export function validateSeoHtml(html) {
  const problems = [];
  const text = String(html ?? '');
  const required = [
    [/<link rel="canonical"/, 'canonical'],
    [/property="og:title"/, 'og:title'],
    [/property="og:description"/, 'og:description'],
    [/property="og:image"/, 'og:image'],
    [/property="og:url"/, 'og:url'],
    [/name="twitter:card"/, 'twitter:card'],
    [/application\/ld\+json/, 'JSON-LD'],
    [/<title>/, 'title'],
  ];
  for (const [re, label] of required) if (!re.test(text)) problems.push(`متای «${label}» نیست`);
  return problems;
}
