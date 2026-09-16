/*
 * موتور محاسبات مرکز رسانه — توابع خالص، بدون فایل و بدون شبکه.
 *
 * چرا جدا از `mediaStore.js`؟ چون همهٔ این توابع فقط «آرایه در، عدد بیرون»
 * هستند: قابل تست، قابل بازاستفاده در همهٔ بخش‌ها، و بی‌خبر از اینکه داده از
 * فایل می‌آید یا بعداً از یک API واقعی.
 *
 * دو قاعدهٔ ثابت:
 *
 *   ۱) **هیچ عدد ساختگی.** اگر سنجه‌ای در بازه وجود نداشته باشد، `null`
 *      برمی‌گردد نه صفر. صفر یعنی «اندازه گرفتیم و صفر بود»؛ null یعنی
 *      «اندازه نگرفتیم» — و UI این دو را متفاوت نشان می‌دهد.
 *   ۲) نرخ‌ها همیشه همراه با ورودی‌شان برمی‌گردند تا کاربر بداند عدد از چه
 *      چیزی ساخته شده (مثلاً `engagementRate` با `reach`).
 */

/* ───────────────────────────── بازهٔ زمانی ───────────────────────────── */

const DAY_MS = 24 * 60 * 60 * 1000;

export const MEDIA_RANGES = [
  { key: 'today', label: 'امروز', days: 1 },
  { key: 'yesterday', label: 'دیروز', days: 1 },
  { key: '7d', label: '۷ روز اخیر', days: 7 },
  { key: '30d', label: '۳۰ روز اخیر', days: 30 },
  { key: '90d', label: '۳ ماه اخیر', days: 90 },
  { key: '180d', label: '۶ ماه اخیر', days: 180 },
  { key: '365d', label: 'یک سال اخیر', days: 365 },
  { key: 'custom', label: 'بازهٔ دلخواه', days: 0 },
];

/* کلید روز به وقت محلی — همان چیزی که در `mediaMetrics.date` ذخیره می‌شود */
export function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

/*
 * بازه را به `{ from, to, days, previous }` تبدیل می‌کند.
 * `previous` بازهٔ هم‌اندازهٔ قبلی است تا رشد معنا داشته باشد (۷ روز با ۷ روز
 * قبلش، نه با ماه قبل).
 */
export function resolveRange({ range = '30d', from = null, to = null } = {}) {
  const now = new Date();

  if (range === 'custom' && from) {
    const start = startOfDay(from);
    const end = to ? endOfDay(to) : endOfDay(now);
    const days = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
    return {
      key: 'custom',
      from: start.toISOString(),
      to: end.toISOString(),
      days,
      previous: {
        from: new Date(start.getTime() - days * DAY_MS).toISOString(),
        to: new Date(start.getTime() - 1).toISOString(),
      },
    };
  }

  const preset = MEDIA_RANGES.find((item) => item.key === range) ?? MEDIA_RANGES[2];
  const days = preset.days;

  let end = endOfDay(now);
  if (preset.key === 'yesterday') {
    end = endOfDay(new Date(now.getTime() - DAY_MS));
  }

  const start = startOfDay(new Date(end.getTime() - (days - 1) * DAY_MS));

  return {
    key: preset.key,
    from: start.toISOString(),
    to: end.toISOString(),
    days,
    previous: {
      from: new Date(start.getTime() - days * DAY_MS).toISOString(),
      to: new Date(start.getTime() - 1).toISOString(),
    },
  };
}

export function rangeLabel(resolved) {
  const preset = MEDIA_RANGES.find((item) => item.key === resolved.key);
  if (resolved.key !== 'custom') return preset?.label ?? resolved.key;
  return `${dayKey(resolved.from)} تا ${dayKey(resolved.to)}`;
}

/* ─────────────────────────────── ابزار عدد ─────────────────────────────── */

/* جمع مقادیر؛ اگر هیچ مقدار معتبری نبود `null` نه صفر */
export function sum(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((total, value) => total + value, 0);
}

/* میانگین همان قاعدهٔ جمع را دارد */
export function average(values) {
  const total = sum(values);
  return total === null ? null : total / values.filter(Number.isFinite).length;
}

/* درصد رشد بین دو بازه؛ مخرج صفر یا نامعلوم ⇒ null (نه بی‌نهایت) */
export function growth(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function inRange(iso, from, to) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= new Date(from).getTime() && time <= new Date(to).getTime();
}

/* ───────────────────────────── سنجه‌ها ───────────────────────────── */

const METRIC_KEYS = [
  'followers', 'following', 'posts', 'views', 'reach', 'impressions',
  'likes', 'comments', 'shares', 'saves', 'clicks', 'engagement',
  'websiteClicks', 'signups', 'purchases',
];

/*
 * آخرین عکس لحظه‌ای هر اکانت. سنجه‌های «انباره» (دنبال‌کننده، تعداد پست)
 * را باید از آخرین روز خواند نه جمع زد؛ جمع‌زدنشان عدد بی‌معنا می‌دهد.
 */
export function latestByAccount(metrics) {
  const map = new Map();

  metrics.forEach((row) => {
    const current = map.get(row.accountId);
    if (!current || String(row.date) > String(current.date)) map.set(row.accountId, row);
  });

  return map;
}

/* جمع سنجه‌های «جریانی» در بازه، به تفکیک اکانت */
export function totalsInRange(metrics, from, to) {
  const totals = {};

  METRIC_KEYS.forEach((key) => { totals[key] = sum(metrics.filter((row) => inRange(`${row.date}T12:00:00`, from, to)).map((row) => row[key])); });

  return totals;
}

/*
 * مجموع سنجه‌ها به تفکیک اکانت در بازه.
 * دنبال‌کننده از آخرین عکس بازه خوانده می‌شود (انباره)، بقیه جمع می‌شوند.
 */
export function totalsByAccount(metrics, from, to, accountIds = null) {
  const rows = accountIds ? metrics.filter((row) => accountIds.includes(row.accountId)) : metrics;
  const inWindow = rows.filter((row) => inRange(`${row.date}T12:00:00`, from, to));

  const byAccount = new Map();

  inWindow.forEach((row) => {
    const bucket = byAccount.get(row.accountId) ?? { accountId: row.accountId, platform: row.platform, days: 0 };

    METRIC_KEYS.forEach((key) => {
      if (!Number.isFinite(row[key])) return;
      if (key === 'followers' || key === 'following' || key === 'posts') {
        /* انباره: بیشترین مقدار بازه ≈ آخرین مقدار */
        bucket[key] = bucket[key] === undefined ? row[key] : Math.max(bucket[key], row[key]);
      } else {
        bucket[key] = (bucket[key] ?? 0) + row[key];
      }
    });

    bucket.days += 1;
    byAccount.set(row.accountId, bucket);
  });

  return [...byAccount.values()];
}

/* سری روزانه برای نمودار — هر روز یک نقطه، حتی روزهای بی‌داده (null) */
export function dailySeries(metrics, from, to, accountIds = null) {
  const rows = accountIds ? metrics.filter((row) => accountIds.includes(row.accountId)) : metrics;
  const byDay = new Map();

  rows.forEach((row) => {
    const bucket = byDay.get(row.date) ?? { date: row.date, reach: 0, engagement: 0, views: 0, followers: 0, hasFollowers: false };
    bucket.reach += Number(row.reach) || 0;
    bucket.engagement += Number(row.engagement) || 0;
    bucket.views += Number(row.views) || 0;
    if (Number.isFinite(row.followers)) {
      bucket.followers += row.followers;
      bucket.hasFollowers = true;
    }
    byDay.set(row.date, bucket);
  });

  const series = [];
  const start = startOfDay(from);
  const end = startOfDay(to);

  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    const key = dayKey(new Date(time));
    const bucket = byDay.get(key);
    series.push({
      date: key,
      reach: bucket?.reach ?? 0,
      engagement: bucket?.engagement ?? 0,
      views: bucket?.views ?? 0,
      followers: bucket?.hasFollowers ? bucket.followers : null,
      hasData: Boolean(bucket),
    });
  }

  return series;
}

/* ───────────────────────────── محتوا ───────────────────────────── */

export const PUBLISHED_STATUSES = ['published'];
export const PENDING_STATUSES = ['review'];
export const OPEN_STATUSES = ['draft', 'review', 'approved', 'scheduled', 'publishing', 'failed'];

/* امتیاز تعامل یک محتوا — نرخ تعامل، و اگر reach نبود فقط جمع تعامل */
export function engagementRate(metrics) {
  if (!metrics) return null;
  const interactions = sum([metrics.likes, metrics.comments, metrics.shares, metrics.saves]);
  if (interactions === null || !Number.isFinite(metrics.reach) || metrics.reach === 0) return null;
  return (interactions / metrics.reach) * 100;
}

export function contentStats(contents) {
  const byStatus = {};
  contents.forEach((content) => {
    byStatus[content.status] = (byStatus[content.status] ?? 0) + 1;
  });

  const todayKey = dayKey(new Date());

  return {
    total: contents.length,
    byStatus,
    draft: byStatus.draft ?? 0,
    pending: (byStatus.review ?? 0) + (byStatus.approved ?? 0),
    scheduled: byStatus.scheduled ?? 0,
    publishing: byStatus.publishing ?? 0,
    published: byStatus.published ?? 0,
    failed: byStatus.failed ?? 0,
    cancelled: byStatus.cancelled ?? 0,
    archived: byStatus.archived ?? 0,
    publishedToday: contents.filter((content) => content.publishedAt && dayKey(content.publishedAt) === todayKey).length,
  };
}

/* محتواهایی که در بازه منتشر شده‌اند */
export function contentsInRange(contents, from, to) {
  return contents.filter((content) => (
    (content.publishedAt && inRange(content.publishedAt, from, to))
    || (content.scheduledAt && inRange(content.scheduledAt, from, to))
  ));
}

/*
 * بهترین و ضعیف‌ترین محتوا بر پایهٔ امتیاز واقعی خود محتوا.
 * فقط محتواهایی که سنجه دارند در رقابت شرکت می‌کنند — وگرنه «بهترین محتوا»
 * می‌شد اولین محتوای بی‌داده.
 */
export function rankContents(contents) {
  const scored = contents
    .map((content) => ({
      id: content.id,
      title: content.title,
      platform: content.platform,
      contentType: content.contentType,
      publishedAt: content.publishedAt,
      metrics: content.metrics ?? null,
      score: engagementRate(content.metrics) ?? (content.metrics ? sum([content.metrics.likes, content.metrics.comments, content.metrics.shares, content.metrics.saves]) : null),
    }))
    .filter((row) => Number.isFinite(row.score));

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const averageScore = average(scored.map((row) => row.score));

  return {
    ranked: sorted,
    averageScore,
    best: sorted[0] ?? null,
    worst: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    compared: scored.length,
  };
}

/* عملکرد به تفکیک نوع محتوا — کدام نوع بهتر کار می‌کند */
export function contentTypeBreakdown(contents) {
  const buckets = new Map();

  contents.forEach((content) => {
    const key = content.contentType ?? 'post';
    const bucket = buckets.get(key) ?? { contentType: key, count: 0, reach: 0, engagement: 0, hasReach: false, hasEngagement: false };
    bucket.count += 1;
    if (Number.isFinite(content.metrics?.reach)) { bucket.reach += content.metrics.reach; bucket.hasReach = true; }
    if (Number.isFinite(content.metrics?.engagement)) { bucket.engagement += content.metrics.engagement; bucket.hasEngagement = true; }
    buckets.set(key, bucket);
  });

  return [...buckets.values()]
    .map((bucket) => ({
      contentType: bucket.contentType,
      count: bucket.count,
      reach: bucket.hasReach ? bucket.reach : null,
      engagement: bucket.hasEngagement ? bucket.engagement : null,
      engagementRate: bucket.hasReach && bucket.hasEngagement && bucket.reach > 0 ? (bucket.engagement / bucket.reach) * 100 : null,
      averageReach: bucket.hasReach ? bucket.reach / bucket.count : null,
    }))
    .sort((a, b) => (b.averageReach ?? -1) - (a.averageReach ?? -1));
}

/* ───────────────────────────── پلتفرم‌ها ───────────────────────────── */

export function platformTotals({ accounts, metrics, contents, from, to }) {
  const byPlatform = new Map();

  accounts.forEach((account) => {
    const bucket = byPlatform.get(account.platform) ?? {
      platform: account.platform,
      accounts: 0,
      activeAccounts: 0,
      followers: 0,
      hasFollowers: false,
      reach: 0,
      hasReach: false,
      impressions: 0,
      hasImpressions: false,
      engagement: 0,
      hasEngagement: false,
      views: 0,
      hasViews: false,
      contents: 0,
      publishedContents: 0,
    };

    bucket.accounts += 1;
    if (account.isActive !== false) bucket.activeAccounts += 1;
    byPlatform.set(account.platform, bucket);
  });

  /* دنبال‌کننده: آخرین عکس لحظه‌ای هر اکانت (نه جمع بازه) */
  const latest = latestByAccount(metrics);
  latest.forEach((row, accountId) => {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;
    const bucket = byPlatform.get(account.platform);
    if (!bucket || !Number.isFinite(row.followers)) return;
    bucket.followers += row.followers;
    bucket.hasFollowers = true;
  });

  const windowRows = metrics.filter((row) => inRange(`${row.date}T12:00:00`, from, to));
  windowRows.forEach((row) => {
    const bucket = byPlatform.get(row.platform);
    if (!bucket) return;

    if (Number.isFinite(row.reach)) { bucket.reach += row.reach; bucket.hasReach = true; }
    if (Number.isFinite(row.impressions)) { bucket.impressions += row.impressions; bucket.hasImpressions = true; }
    if (Number.isFinite(row.engagement)) { bucket.engagement += row.engagement; bucket.hasEngagement = true; }
    if (Number.isFinite(row.views)) { bucket.views += row.views; bucket.hasViews = true; }
  });

  contents.forEach((content) => {
    const bucket = byPlatform.get(content.platform);
    if (!bucket) return;
    bucket.contents += 1;
    if (content.status === 'published') bucket.publishedContents += 1;
  });

  return [...byPlatform.values()].map((bucket) => ({
    ...bucket,
    followers: bucket.hasFollowers ? bucket.followers : null,
    reach: bucket.hasReach ? bucket.reach : null,
    impressions: bucket.hasImpressions ? bucket.impressions : null,
    engagement: bucket.hasEngagement ? bucket.engagement : null,
    views: bucket.hasViews ? bucket.views : null,
    engagementRate: bucket.hasReach && bucket.hasEngagement && bucket.reach > 0 ? (bucket.engagement / bucket.reach) * 100 : null,
  }));
}

/* ─────────────────────────── هشتگ و موضوع ─────────────────────────── */

/*
 * عملکرد هر هشتگ/موضوع از خود محتواها حساب می‌شود، نه از یک فیلد ذخیره‌شده.
 * پس اگر محتوایی ویرایش شود، آمار هشتگ خودش درست می‌شود.
 */
export function tagPerformance(tags, contents) {
  return tags.map((tag) => {
    const related = contents.filter((content) => (content.tagIds ?? []).includes(tag.id)
      || (tag.kind === 'hashtag' && (content.hashtags ?? []).some((item) => item.replace(/^#/, '') === tag.slug)));

    const published = related.filter((content) => content.status === 'published');
    const reach = sum(published.map((content) => content.metrics?.reach));
    const engagement = sum(published.map((content) => content.metrics?.engagement));
    const clicks = sum(published.map((content) => content.metrics?.clicks));

    return {
      ...tag,
      usageCount: related.length,
      publishedCount: published.length,
      reach,
      engagement,
      clicks,
      engagementRate: Number.isFinite(reach) && Number.isFinite(engagement) && reach > 0 ? (engagement / reach) * 100 : null,
    };
  }).sort((a, b) => (b.reach ?? -1) - (a.reach ?? -1));
}

/* ───────────────────────────── قیف UTM ───────────────────────────── */

/*
 * قیف «شبکهٔ اجتماعی → سایت → ثبت‌نام → خرید».
 * هر پله فقط وقتی عدد دارد که همان پله اندازه گرفته شده باشد؛ پلهٔ بعدی از
 * پلهٔ قبلی ساخته نمی‌شود (وگرنه عدد ساختگی می‌شود).
 */
export function utmFunnel(links, metrics, from, to) {
  const clicks = sum(links.map((link) => link.clicks));
  const visits = sum(links.map((link) => link.visits)) ?? clicks;

  const windowRows = metrics.filter((row) => inRange(`${row.date}T12:00:00`, from, to));
  const websiteClicks = sum(windowRows.map((row) => row.websiteClicks));
  const signups = sum(windowRows.map((row) => row.signups));
  const purchases = sum(windowRows.map((row) => row.purchases));

  const steps = [
    { id: 'clicks', label: 'کلیک روی لینک', value: clicks },
    { id: 'visits', label: 'ورود به سایت', value: visits },
    { id: 'signups', label: 'ثبت‌نام', value: signups },
    { id: 'purchases', label: 'خرید', value: purchases },
  ];

  return {
    steps,
    websiteClicks,
    visits,
    signups,
    purchases,
    /* نرخ تبدیل رسانه به سایت: ورودی سایت ÷ کلیک */
    visitRate: Number.isFinite(visits) && Number.isFinite(clicks) && clicks > 0 ? (visits / clicks) * 100 : null,
    signupRate: Number.isFinite(signups) && Number.isFinite(visits) && visits > 0 ? (signups / visits) * 100 : null,
    purchaseRate: Number.isFinite(purchases) && Number.isFinite(signups) && signups > 0 ? (purchases / signups) * 100 : null,
  };
}

/* ─────────────────────────── داشبورد مرکزی ─────────────────────────── */

/*
 * نمای کلی. ورودی‌ها همه آرایه‌های خام‌اند؛ خروجی یک شیء آمادهٔ نمایش.
 * هر جا داده نبود `null` می‌ماند تا UI «داده ثبت نشده» نشان دهد.
 */
export function buildOverview({
  accounts, metrics, contents, campaigns, tags, utmLinks, platformIds, resolved,
}) {
  const { from, to, previous } = resolved;

  const accountIds = accounts.map((account) => account.id);

  const current = totalsByAccount(metrics, from, to, accountIds);
  const prev = totalsByAccount(metrics, previous.from, previous.to, accountIds);

  const sumKey = (rows, key) => sum(rows.map((row) => row[key]));

  const currentReach = sumKey(current, 'reach');
  const currentEngagement = sumKey(current, 'engagement');
  const currentViews = sumKey(current, 'views');
  const currentImpressions = sumKey(current, 'impressions');

  const prevReach = sumKey(prev, 'reach');
  const prevEngagement = sumKey(prev, 'engagement');
  const prevViews = sumKey(prev, 'views');

  /* دنبال‌کننده: آخرین عکس هر اکانت، در پایان بازهٔ جاری و بازهٔ قبلی */
  const latestNow = latestByAccount(metrics.filter((row) => inRange(`${row.date}T12:00:00`, new Date(0).toISOString(), to)));
  const latestBefore = latestByAccount(metrics.filter((row) => inRange(`${row.date}T12:00:00`, new Date(0).toISOString(), previous.to)));

  const followersNow = sum([...latestNow.values()].map((row) => row.followers));
  const followersBefore = sum([...latestBefore.values()].map((row) => row.followers));

  const stats = contentStats(contents);
  const inRangeContents = contentsInRange(contents, from, to);
  const ranked = rankContents(inRangeContents);
  const platforms = platformTotals({ accounts, metrics, contents, from, to });

  const reachLeader = [...platforms].filter((row) => Number.isFinite(row.reach)).sort((a, b) => b.reach - a.reach)[0] ?? null;
  const engagementLeader = [...platforms].filter((row) => Number.isFinite(row.engagementRate)).sort((a, b) => b.engagementRate - a.engagementRate)[0] ?? null;

  const funnel = utmFunnel(utmLinks, metrics, from, to);

  const engagementRateNow = Number.isFinite(currentReach) && Number.isFinite(currentEngagement) && currentReach > 0
    ? (currentEngagement / currentReach) * 100
    : null;

  const activePlatforms = new Set(accounts.filter((account) => account.isActive !== false).map((account) => account.platform));

  return {
    range: { ...resolved, label: rangeLabel(resolved) },
    kpis: [
      { key: 'platforms', label: 'پلتفرم فعال', value: activePlatforms.size, format: 'count', hint: `از ${platformIds.length} پلتفرم ثبت‌شده` },
      { key: 'accounts', label: 'کانال و صفحهٔ فعال', value: accounts.filter((account) => account.isActive !== false).length, format: 'count', hint: `${accounts.length} اکانت ثبت‌شده` },
      { key: 'followers', label: 'کل دنبال‌کنندگان', value: followersNow, format: 'count', delta: growth(followersNow, followersBefore), hint: 'مجموع آخرین سنجهٔ هر اکانت' },
      { key: 'views', label: 'بازدید', value: currentViews, format: 'count', delta: growth(currentViews, prevViews) },
      { key: 'reach', label: 'Reach', value: currentReach, format: 'count', delta: growth(currentReach, prevReach) },
      { key: 'impressions', label: 'Impressions', value: currentImpressions, format: 'count' },
      { key: 'engagement', label: 'Engagement', value: currentEngagement, format: 'count', delta: growth(currentEngagement, prevEngagement) },
      { key: 'engagementRate', label: 'نرخ تعامل', value: engagementRateNow, format: 'percent', hint: 'تعامل ÷ Reach' },
      { key: 'published', label: 'منتشرشده در بازه', value: inRangeContents.filter((content) => content.status === 'published').length, format: 'count' },
      { key: 'pending', label: 'در انتظار تأیید', value: stats.pending, format: 'count' },
      { key: 'draft', label: 'پیش‌نویس', value: stats.draft, format: 'count' },
      { key: 'scheduled', label: 'زمان‌بندی‌شده', value: stats.scheduled, format: 'count' },
      { key: 'publishedToday', label: 'منتشرشدهٔ امروز', value: stats.publishedToday, format: 'count' },
      { key: 'failed', label: 'انتشار ناموفق', value: stats.failed, format: 'count' },
      { key: 'socialVisits', label: 'ورودی سایت از شبکه‌ها', value: funnel.visits, format: 'count', hint: 'از لینک‌های UTM و سنجهٔ اکانت‌ها' },
      { key: 'socialSignups', label: 'ثبت‌نام از شبکه‌ها', value: funnel.signups, format: 'count' },
      { key: 'conversionRate', label: 'نرخ تبدیل رسانه به سایت', value: funnel.visitRate, format: 'percent', hint: 'ورود به سایت ÷ کلیک' },
    ],
    growth: {
      followers: growth(followersNow, followersBefore),
      reach: growth(currentReach, prevReach),
      engagement: growth(currentEngagement, prevEngagement),
      views: growth(currentViews, prevViews),
      followersNow,
      followersBefore,
    },
    series: {
      daily: dailySeries(metrics, from, to, accountIds),
      contentTimeline: contentTimeline(contents, from, to),
    },
    platforms,
    platformComparison: {
      reachLeader,
      engagementLeader,
    },
    best: ranked.best,
    worst: ranked.worst,
    rankedSample: ranked.compared,
    averageEngagementScore: ranked.averageScore,
    contentTypes: contentTypeBreakdown(inRangeContents),
    tags: tagPerformance(tags, contents).slice(0, 12),
    funnel,
    campaignCount: campaigns.length,
    activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
  };
}

/* تعداد محتوا به تفکیک روز — برای نمودار «تعداد محتوا در طول زمان» */
export function contentTimeline(contents, from, to) {
  const byDay = new Map();

  contents.forEach((content) => {
    const stamp = content.publishedAt ?? content.scheduledAt;
    if (!stamp) return;
    const key = dayKey(stamp);
    if (!inRange(`${key}T12:00:00`, from, to)) return;
    const bucket = byDay.get(key) ?? { date: key, published: 0, scheduled: 0 };
    if (content.status === 'published') bucket.published += 1;
    else bucket.scheduled += 1;
    byDay.set(key, bucket);
  });

  const series = [];
  const start = startOfDay(from);
  const end = startOfDay(to);

  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    const key = dayKey(new Date(time));
    const bucket = byDay.get(key);
    series.push({ date: key, published: bucket?.published ?? 0, scheduled: bucket?.scheduled ?? 0 });
  }

  return series;
}

/* ─────────────────── مقایسهٔ محتوا با میانگین مشابه‌ها ─────────────────── */

/*
 * «این محتوا ۲.۴ برابر میانگین Reach محتواهای مشابه بوده است.»
 * مشابه = همان نوع محتوا روی همان پلتفرم. اگر کمتر از دو محتوای مشابه با
 * سنجه وجود داشته باشد، مقایسه بی‌معنا است و `null` برمی‌گردد.
 */
export function compareToPeers(content, allContents) {
  const peers = allContents.filter((row) => (
    row.id !== content.id
    && row.status === 'published'
    && row.contentType === content.contentType
    && row.platform === content.platform
    && Number.isFinite(row.metrics?.reach)
  ));

  if (peers.length < 2 || !Number.isFinite(content.metrics?.reach)) {
    return { comparable: false, peers: peers.length, reachRatio: null, engagementRatio: null, peerAverageReach: null };
  }

  const peerAverageReach = average(peers.map((row) => row.metrics.reach));
  const peerRates = peers.map((row) => engagementRate(row.metrics)).filter(Number.isFinite);
  const peerAverageRate = average(peerRates);
  const ownRate = engagementRate(content.metrics);

  return {
    comparable: true,
    peers: peers.length,
    peerAverageReach,
    peerAverageRate,
    reachRatio: peerAverageReach > 0 ? content.metrics.reach / peerAverageReach : null,
    engagementRatio: Number.isFinite(peerAverageRate) && peerAverageRate > 0 && Number.isFinite(ownRate) ? ownRate / peerAverageRate : null,
  };
}
