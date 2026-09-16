/*
 * موتور تحلیل تپش — تمام محاسبات «مرکز تحلیل» روی دادهٔ واقعی.
 *
 * این فایل هیچ داده‌ای نمی‌سازد؛ فقط روی سه منبع واقعی حساب می‌کند:
 *   ۱. رویدادهای سایت (`analyticsStore.readEvents`) — تلمتری واقعی مرورگر
 *   ۲. دادهٔ موجود پروژه (کاربران، محتوا، گزارش رویدادها، سنجه‌های سرور)
 *   ۳. موجودی محتوای محصول (بانک تست، ویکی، فلش‌کارت، شبکه دانش)
 *
 * اگر بخشی به منبع بیرونی نیاز دارد (Search Console، درگاه پرداخت، PageSpeed)،
 * تابع آن بخش `connected: false` برمی‌گرداند و UI وضعیت «نیازمند اتصال» نشان
 * می‌دهد. هیچ عدد جعلی جای دادهٔ واقعی نمی‌نشیند.
 *
 * بخش‌های ۱ تا ۱۰ اینجا هستند؛ ۱۱ تا ۱۶ در `analyticsInsights.js`.
 */

import { readCollection, sessionStats } from './contentStore.js';
import {
  dataSources,
  dayKey,
  rateLimitStats,
  requestMetrics,
  resolveRange,
  siteUsers,
  sourceMap,
  startOfDay,
  staticContent,
  systemMetrics,
} from './analyticsStore.js';

export const DAY_MS = 86_400_000;

/* ───────────────────────────── ابزار پایه ───────────────────────────── */

export const sum = (list) => list.reduce((total, value) => total + (Number(value) || 0), 0);
export const round = (value, digits = 1) => (value === null || value === undefined || !Number.isFinite(Number(value))
  ? null
  : Math.round(Number(value) * 10 ** digits) / 10 ** digits);
export const pct = (part, whole) => (whole ? round((part / whole) * 100, 1) : null);
export const average = (list) => (list.length ? sum(list) / list.length : null);
export const unique = (list) => new Set(list.filter(Boolean));

/* درصد تغییر نسبت به دورهٔ قبل. مبنای صفر → درصد بی‌معناست، پس null */
export function deltaOf(current, previous) {
  if (previous === null || previous === undefined || current === null || current === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}

export const byKey = (list, keyOf) => list.reduce((accumulator, item) => {
  const key = keyOf(item) || 'other';
  accumulator[key] = (accumulator[key] ?? 0) + 1;
  return accumulator;
}, {});

export const plainText = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/* ───────────────────────────── رگرسیون و پیش‌بینی ───────────────────────────── */

/* برازش خطی حداقل مربعات — پایهٔ «روند» و «پیش‌بینی» */
export function linearFit(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0, n };

  const xs = values.map((_, index) => index);
  const meanX = sum(xs) / n;
  const meanY = sum(values) / n;

  let numerator = 0;
  let denominator = 0;
  xs.forEach((x, index) => {
    numerator += (x - meanX) * (values[index] - meanY);
    denominator += (x - meanX) ** 2;
  });

  const slope = denominator ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;

  let ssTotal = 0;
  let ssResidual = 0;
  xs.forEach((x, index) => {
    ssTotal += (values[index] - meanY) ** 2;
    ssResidual += (values[index] - (slope * x + intercept)) ** 2;
  });

  return { slope, intercept, r2: ssTotal ? round(1 - ssResidual / ssTotal, 3) : 0, n };
}

/* پیش‌بینی چند روز آینده + بازهٔ اطمینان تقریبی از انحراف باقی‌مانده‌ها */
export function forecast(values, horizon = 7) {
  const fit = linearFit(values);
  const residuals = values.map((value, index) => value - (fit.slope * index + fit.intercept));
  const sigma = Math.sqrt(average(residuals.map((value) => value ** 2)) ?? 0);

  const projection = [];
  for (let step = 1; step <= horizon; step += 1) {
    const point = fit.slope * (values.length - 1 + step) + fit.intercept;
    projection.push({
      step,
      value: Math.max(0, round(point, 1)),
      low: Math.max(0, round(point - 1.28 * sigma, 1)),
      high: Math.max(0, round(point + 1.28 * sigma, 1)),
    });
  }

  return { projection, slope: round(fit.slope, 3), r2: fit.r2 };
}

/* تشخیص ناهنجاری با امتیاز Z — نقاط خارج از آستانهٔ انحراف معیار */
export function detectAnomalies(series, { threshold = 2, key = 'value' } = {}) {
  const values = series.map((point) => Number(point[key]) || 0);
  const mean = average(values) ?? 0;
  const sigma = Math.sqrt(average(values.map((value) => (value - mean) ** 2)) ?? 0);
  if (!sigma) return [];

  return series
    .map((point, index) => ({
      key: point.key ?? point.label ?? String(index),
      value: values[index],
      z: round((values[index] - mean) / sigma, 2),
      direction: values[index] > mean ? 'spike' : 'drop',
    }))
    .filter((point) => Math.abs(point.z) >= threshold)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}

/* ───────────────────────────── KPI و وضعیت ───────────────────────────── */

const KPI_RULES = {
  higher: { warn: -10, critical: -25 },
  lower: { warn: 10, critical: 25 },
};

/* وضعیت یک KPI بر پایهٔ جهت مطلوب + درصد تغییر. دادهٔ ناکافی → neutral */
export function kpiStatus(delta, direction = 'higher', { warn = null, critical = null } = {}) {
  if (delta === null || delta === undefined) return 'neutral';
  const rule = KPI_RULES[direction] ?? KPI_RULES.higher;
  const warnAt = warn ?? rule.warn;
  const criticalAt = critical ?? rule.critical;
  const effective = direction === 'lower' ? delta : -delta;

  if (effective >= criticalAt) return 'critical';
  if (effective >= warnAt) return 'warn';
  return 'good';
}

export function kpi({ key, label, value, previous, unit = '', direction = 'higher', hint = '', available = true, status = null }) {
  const delta = deltaOf(value, previous);
  return {
    key,
    label,
    value: available ? (value ?? null) : null,
    previous: available ? (previous ?? null) : null,
    unit,
    hint,
    available,
    delta: available ? delta : null,
    direction: delta === null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    status: available ? (status ?? kpiStatus(delta, direction)) : 'neutral',
  };
}

/* ───────────────────────────── زمینهٔ تحلیل ───────────────────────────── */

export function buildContext({ range = '30d', from = null, to = null } = {}) {
  const resolved = resolveRange({ range, from, to });
  const allEvents = readCollection('events');
  const inWindow = (window) => allEvents.filter((event) => event.ts >= window.start && event.ts <= window.end);

  return {
    resolved,
    range,
    events: inWindow(resolved),
    previousEvents: inWindow(resolved.previous),
    allEvents,
    users: siteUsers(),
    articles: readCollection('articles'),
    pages: readCollection('pages'),
    media: readCollection('media'),
    banners: readCollection('banners'),
    activity: readCollection('activity'),
    admins: readCollection('admins'),
    requests: requestMetrics(),
    sources: sourceMap(),
  };
}

/* روزهای بازه به‌صورت سطل‌های روزانه */
function dayBuckets({ start, end }) {
  const buckets = [];
  for (let ts = startOfDay(start); ts <= end; ts += DAY_MS) {
    buckets.push({ key: dayKey(ts), ts, start: ts, end: ts + DAY_MS - 1 });
  }
  return buckets;
}

/* سشن‌سازی از رویدادها — پایهٔ تمام سنجه‌های ترافیک */
export function sessionize(events) {
  const map = new Map();
  events.forEach((event) => {
    const list = map.get(event.sessionId);
    if (list) list.push(event);
    else map.set(event.sessionId, [event]);
  });

  return [...map.entries()].map(([sessionId, list]) => {
    list.sort((a, b) => a.ts - b.ts);
    const views = list.filter((event) => event.type === 'page_view');
    const first = list[0];
    const last = list[list.length - 1];

    return {
      sessionId,
      userId: list.find((event) => event.userId)?.userId ?? null,
      start: first.ts,
      end: last.ts,
      durationMs: list.length > 1 ? last.ts - first.ts : 0,
      events: list.length,
      views: views.length,
      pages: [...new Set(views.map((view) => view.path))],
      entry: views[0]?.path ?? first.path,
      exit: views[views.length - 1]?.path ?? last.path,
      source: first.source,
      device: first.device,
      browser: first.browser,
      os: first.os,
      types: new Set(list.map((event) => event.type)),
    };
  });
}

/* سری روزانهٔ همهٔ شاخص‌های ترافیک — یک بار ساخته و در همهٔ بخش‌ها استفاده می‌شود */
export function buildDailySeries(context) {
  const buckets = dayBuckets(context.resolved);
  const sessions = sessionize(context.events);

  const eventsByDay = new Map();
  context.events.forEach((event) => {
    const key = dayKey(event.ts);
    const list = eventsByDay.get(key);
    if (list) list.push(event);
    else eventsByDay.set(key, [event]);
  });

  const sessionsByDay = new Map();
  sessions.forEach((session) => {
    const key = dayKey(session.start);
    const list = sessionsByDay.get(key);
    if (list) list.push(session);
    else sessionsByDay.set(key, [session]);
  });

  const signupsByDay = byKey(context.users.filter((user) => user.createdAt), (user) => dayKey(new Date(user.createdAt).getTime()));

  return buckets.map((bucket) => {
    const dayEvents = eventsByDay.get(bucket.key) ?? [];
    const daySessions = sessionsByDay.get(bucket.key) ?? [];
    const views = dayEvents.filter((event) => event.type === 'page_view');
    const withDuration = daySessions.filter((session) => session.durationMs > 0);

    return {
      key: bucket.key,
      label: bucket.key.slice(5),
      pageViews: views.length,
      visitors: unique(daySessions.map((session) => session.userId ?? session.sessionId)).size,
      sessions: daySessions.length,
      newUsers: signupsByDay[bucket.key] ?? 0,
      signups: dayEvents.filter((event) => event.type === 'signup').length,
      returning: unique(daySessions.filter((session) => session.userId).map((session) => session.userId)).size,
      avgDurationSeconds: round(average(withDuration.map((session) => session.durationMs / 1000)) ?? 0, 1),
      bounceRate: daySessions.length ? pct(daySessions.filter((session) => session.views <= 1).length, daySessions.length) : null,
      tests: dayEvents.filter((event) => event.type === 'test_submit').length,
      errors: dayEvents.filter((event) => event.type === 'js_error' || event.type === 'api_error').length,
    };
  });
}

/* ───────────────────────────── ۱. نمای کلی ───────────────────────────── */

export async function overviewSection(context) {
  const series = buildDailySeries(context);
  const sessions = sessionize(context.events);
  const previousSessions = sessionize(context.previousEvents);

  const usersInRange = context.users.filter((user) => {
    const ts = new Date(user.createdAt).getTime();
    return ts >= context.resolved.start && ts <= context.resolved.end;
  });
  const previousUsers = context.users.filter((user) => {
    const ts = new Date(user.createdAt).getTime();
    return ts >= context.resolved.previous.start && ts <= context.resolved.previous.end;
  });

  const views = context.events.filter((event) => event.type === 'page_view');
  const previousViews = context.previousEvents.filter((event) => event.type === 'page_view');
  const tests = context.events.filter((event) => event.type === 'test_submit');
  const previousTests = context.previousEvents.filter((event) => event.type === 'test_submit');
  const flashcards = context.events.filter((event) => event.type === 'flashcard_review');
  const previousFlashcards = context.previousEvents.filter((event) => event.type === 'flashcard_review');
  const signups = context.events.filter((event) => event.type === 'signup');
  const previousSignups = context.previousEvents.filter((event) => event.type === 'signup');

  const answered = sum(tests.map((event) => Number(event.meta?.questions) || 0));
  const previousAnswered = sum(previousTests.map((event) => Number(event.meta?.questions) || 0));

  const withDuration = sessions.filter((session) => session.durationMs > 0);
  const previousWithDuration = previousSessions.filter((session) => session.durationMs > 0);

  const bounceRate = sessions.length ? pct(sessions.filter((session) => session.views <= 1).length, sessions.length) : null;
  const previousBounce = previousSessions.length
    ? pct(previousSessions.filter((session) => session.views <= 1).length, previousSessions.length)
    : null;

  const visitorToSignup = sessions.length ? pct(signups.length || usersInRange.length, sessions.length) : null;
  const previousVisitorToSignup = previousSessions.length
    ? pct(previousSignups.length || previousUsers.length, previousSessions.length)
    : null;

  const activeIn = (from) => unique(sessions.filter((session) => session.start >= from).map((session) => session.userId ?? session.sessionId)).size;

  const kpis = [
    kpi({ key: 'activeUsers', label: 'کاربران فعال', value: unique(sessions.map((session) => session.userId ?? session.sessionId)).size, previous: unique(previousSessions.map((session) => session.userId ?? session.sessionId)).size, hint: 'کاربر یکتای دارای حداقل یک رویداد در بازه — از تلمتری واقعی مرورگر.' }),
    kpi({ key: 'newUsers', label: 'کاربران جدید', value: usersInRange.length, previous: previousUsers.length, hint: 'حساب‌هایی که در بازه ساخته شده‌اند (users.json).' }),
    kpi({ key: 'pageViews', label: 'بازدید صفحات', value: views.length, previous: previousViews.length, hint: 'مجموع رویداد page_view در بازه.' }),
    kpi({ key: 'sessions', label: 'نشست‌ها (Session)', value: sessions.length, previous: previousSessions.length, hint: 'نشست = یک بازدید پیوسته از یک مرورگر.' }),
    kpi({ key: 'avgDuration', label: 'میانگین زمان حضور', value: round(average(withDuration.map((session) => session.durationMs / 1000)) ?? 0, 1), previous: round(average(previousWithDuration.map((session) => session.durationMs / 1000)) ?? 0, 1), unit: 'ثانیه', hint: 'میانگین فاصلهٔ اولین تا آخرین رویداد هر نشست.' }),
    kpi({ key: 'bounceRate', label: 'نرخ خروج (Bounce)', value: bounceRate, previous: previousBounce, unit: '٪', direction: 'lower', hint: 'درصد نشست‌هایی که فقط یک صفحه دیده‌اند.' }),
    kpi({ key: 'signups', label: 'تعداد ثبت‌نام', value: signups.length || usersInRange.length, previous: previousSignups.length || previousUsers.length, hint: 'رویداد signup؛ اگر تلمتری نباشد از تعداد حساب‌های جدید.' }),
    kpi({ key: 'visitorToSignup', label: 'تبدیل بازدیدکننده به ثبت‌نام', value: visitorToSignup, previous: previousVisitorToSignup, unit: '٪', hint: 'ثبت‌نام تقسیم بر نشست‌ها.' }),
    kpi({ key: 'dau', label: 'کاربران فعال روزانه (DAU)', value: activeIn(startOfDay(Date.now())), previous: null, hint: 'کاربر یکتا در ۲۴ ساعت اخیر.' }),
    kpi({ key: 'wau', label: 'کاربران فعال هفتگی (WAU)', value: activeIn(Date.now() - 7 * DAY_MS), previous: null, hint: 'کاربر یکتا در ۷ روز اخیر.' }),
    kpi({ key: 'mau', label: 'کاربران فعال ماهانه (MAU)', value: activeIn(Date.now() - 30 * DAY_MS), previous: null, hint: 'کاربر یکتا در ۳۰ روز اخیر.' }),
    kpi({ key: 'revenue', label: 'درآمد', value: null, previous: null, unit: 'تومان', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
    kpi({ key: 'purchases', label: 'تعداد خرید', value: null, previous: null, available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
    kpi({ key: 'averageOrderValue', label: 'میانگین ارزش خرید', value: null, previous: null, unit: 'تومان', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
    kpi({ key: 'purchaseConversion', label: 'نرخ تبدیل به خرید', value: null, previous: null, unit: '٪', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
    kpi({ key: 'publishedContent', label: 'محتوای منتشرشده', value: context.articles.filter((article) => article.status === 'published').length, previous: null, hint: 'مقاله‌های منتشرشده در CMS.' }),
    kpi({ key: 'tests', label: 'تست‌های انجام‌شده', value: tests.length, previous: previousTests.length, hint: 'رویداد test_submit از بانک تست و آزمون‌ساز.' }),
    kpi({ key: 'answered', label: 'سؤالات پاسخ‌داده‌شده', value: answered, previous: previousAnswered, hint: 'مجموع سؤالات هر تست ثبت‌شده.' }),
    kpi({ key: 'flashcards', label: 'فلش‌کارت‌های مرورشده', value: flashcards.length, previous: previousFlashcards.length, hint: 'رویداد flashcard_review در بازه.' }),
  ];

  const issues = collectIssues(context, { kpis, series });

  return {
    range: context.resolved,
    kpis,
    series,
    summary: buildExecutiveSummary({ kpis, issues, series }),
    issues,
    dataQuality: describeDataQuality(context),
    sources: dataSources(),
  };
}

function buildExecutiveSummary({ kpis, issues, series }) {
  const grown = kpis.filter((item) => item.available && item.delta !== null && item.delta > 3);
  const fallen = kpis.filter((item) => item.available && item.delta !== null && item.delta < -3);
  const critical = issues.filter((issue) => issue.severity === 'critical').length;
  const attention = issues.filter((issue) => ['high', 'medium'].includes(issue.severity)).length;
  const hasTraffic = sum(series.map((point) => point.pageViews)) > 0;

  const overall = critical > 0 ? 'critical' : attention > 2 ? 'warn' : 'good';
  const lines = [];

  if (!hasTraffic) {
    lines.push({ tone: 'neutral', text: 'هنوز دادهٔ ترافیک واقعی ثبت نشده است. تلمتری از لحظهٔ نصب فعال می‌شود و پس از اولین بازدیدها این خلاصه پر می‌شود.' });
  }
  grown.slice(0, 4).forEach((item) => lines.push({ tone: 'good', text: `${item.label}: ${item.delta > 0 ? '+' : ''}${item.delta}٪` }));
  fallen.slice(0, 4).forEach((item) => lines.push({ tone: 'warn', text: `${item.label}: ${item.delta}٪` }));
  if (!grown.length && !fallen.length && hasTraffic) {
    lines.push({ tone: 'neutral', text: 'شاخص‌های اصلی در این بازه تقریباً ثابت مانده‌اند.' });
  }

  return {
    overall,
    headline: overall === 'critical'
      ? 'وضعیت تپش: نیازمند اقدام فوری'
      : overall === 'warn' ? 'وضعیت تپش: قابل قبول با چند نقطهٔ نیازمند توجه' : 'وضعیت تپش: خوب',
    lines,
    counts: { grown: grown.length, fallen: fallen.length, critical, attention },
    metrics: {
      organicGrowth: null, /* فقط با اتصال Search Console */
      revenueGrowth: null, /* فقط با اتصال درگاه پرداخت */
      testEngagement: kpis.find((item) => item.key === 'tests')?.delta ?? null,
    },
  };
}

/* جمع‌آوری مشکلات واقعی — خوراک بخش «تحلیل‌گر» و «هشدارها» */
export function collectIssues(context, { kpis, series }) {
  const issues = [];
  const push = (issue) => issues.push({ id: `${issue.kind}-${issues.length}`, ...issue });

  kpis.filter((item) => item.available && item.delta !== null && item.delta <= -25).forEach((item) => {
    push({
      kind: 'metric-drop',
      severity: item.delta <= -40 ? 'critical' : 'high',
      title: `افت شدید «${item.label}»`,
      evidence: `کاهش ${Math.abs(item.delta)}٪ نسبت به دورهٔ قبل (${item.previous} → ${item.value})`,
      cause: 'افت هم‌زمان ترافیک ورودی یا تعامل کاربران',
      impact: 'کاهش مستقیم رشد پلتفرم',
      action: `روند «${item.label}» و منابع ورود را در بخش ترافیک بررسی کنید.`,
      metric: item.key,
    });
  });

  const viewSeries = series.map((point) => ({ key: point.key, value: point.pageViews }));
  detectAnomalies(viewSeries, { threshold: 2.5 })
    .filter((point) => point.direction === 'drop')
    .slice(0, 3)
    .forEach((point) => {
      push({
        kind: 'anomaly',
        severity: 'medium',
        title: `افت غیرعادی بازدید در ${point.key}`,
        evidence: `امتیاز Z = ${point.z} (میانگین روزانه: ${round(average(viewSeries.map((p) => p.value)), 1)})`,
        cause: 'نوسان خارج از الگوی معمول — احتمال اختلال فنی یا افت منبع ورود',
        impact: 'از دست رفتن ترافیک یک روز',
        action: 'لاگ خطاهای همان روز و وضعیت سرور را بررسی کنید.',
      });
    });

  const errorEvents = context.events.filter((event) => event.type === 'js_error' || event.type === 'api_error');
  if (errorEvents.length) {
    push({
      kind: 'errors',
      severity: errorEvents.length > 20 ? 'high' : 'medium',
      title: `${errorEvents.length} خطا در بازهٔ جاری`,
      evidence: `${errorEvents.filter((event) => event.type === 'js_error').length} خطای Frontend و ${errorEvents.filter((event) => event.type === 'api_error').length} خطای API`,
      cause: 'خطاهای ثبت‌شدهٔ واقعی در مرورگر کاربران و پاسخ‌های ناموفق سرور',
      impact: 'تجربهٔ کاربری و نرخ تبدیل',
      action: 'بخش «خطاها» را باز کنید و پرتکرارترین خطا را رفع کنید.',
    });
  }

  if (context.requests.errorRate >= 5 && context.requests.total > 20) {
    push({
      kind: 'api-health',
      severity: context.requests.errorRate >= 15 ? 'critical' : 'high',
      title: `نرخ خطای API ${context.requests.errorRate}٪`,
      evidence: `${context.requests.errors} پاسخ ناموفق از ${context.requests.total} درخواست`,
      cause: 'خطاهای سمت سرور یا ورودی نامعتبر',
      impact: 'کندی و شکست عملیات کاربر',
      action: 'فهرست «درخواست‌های ناموفق» در بخش عملکرد را بررسی کنید.',
    });
  }

  const system = systemMetrics();
  const rssGb = system.memory.processRssBytes / 1e9;
  if (rssGb >= 3) {
    push({
      kind: 'system',
      severity: 'critical',
      title: 'مصرف حافظهٔ فرایند سرور بحرانی',
      evidence: `RSS فرایند ${round(rssGb, 2)} گیگابایت از ${round(system.memory.totalBytes / 1e9, 1)} گیگابایت کل`,
      cause: 'نشتی حافظه یا بار غیرمنتظره در همین سرویس',
      impact: 'خطر ری‌استارت و قطع سرویس',
      action: 'فرایند سرور را بررسی و در صورت نیاز راه‌اندازی مجدد کنید.',
    });
  } else if (rssGb >= 1.5) {
    push({
      kind: 'system',
      severity: 'medium',
      title: 'مصرف حافظهٔ فرایند سرور بالا',
      evidence: `RSS فرایند ${round(rssGb, 2)} گیگابایت`,
      cause: 'رشد مصرف در همین سرویس',
      impact: 'کاهش حاشیهٔ امن',
      action: 'روند مصرف را زیر نظر بگیرید.',
    });
  }

  if (system.disk && system.disk.usedPercent >= 85) {
    push({
      kind: 'system',
      severity: 'high',
      title: 'فضای دیسک در حال پر شدن',
      evidence: `${system.disk.usedPercent}٪ مصرف شده`,
      cause: 'رشد فایل‌های آپلودی یا لاگ‌ها',
      impact: 'توقف نوشتن در دیتابیس فایل‌محور',
      action: 'کتابخانهٔ رسانه را پاک‌سازی کنید.',
    });
  }

  const failed = context.activity.filter((entry) => entry.action === 'auth.login-failed');
  if (failed.length >= 5) {
    const byIp = byKey(failed, (entry) => entry.ip || 'ناشناس');
    const worst = Object.entries(byIp).sort((a, b) => b[1] - a[1])[0];
    push({
      kind: 'security',
      severity: failed.length >= 20 ? 'critical' : 'high',
      title: `${failed.length} تلاش ناموفق ورود به پنل`,
      evidence: worst ? `بیشترین از IP ${worst[0]} با ${worst[1]} تلاش` : '',
      cause: 'احتمال تلاش Brute Force یا رمز اشتباه',
      impact: 'خطر دسترسی غیرمجاز',
      action: 'بخش امنیت را ببینید و در صورت لزوم رمز را تغییر دهید.',
    });
  }

  const hasViews = context.events.some((event) => event.type === 'page_view');
  const hasLearning = context.events.some((event) => ['test_submit', 'flashcard_review', 'article_read'].includes(event.type));
  if (hasViews && !hasLearning) {
    push({
      kind: 'coverage',
      severity: 'low',
      title: 'رویدادهای آموزشی ثبت نمی‌شوند',
      evidence: 'بازدید صفحه ثبت می‌شود اما رویداد تست/فلش‌کارت/مطالعه‌ای وجود ندارد',
      cause: 'تلمتری بخش‌های آموزشی فعال نشده است',
      impact: 'تحلیل آموزشی ناقص می‌ماند',
      action: 'در سرویس‌های آموزشی `trackEvent` را صدا بزنید.',
    });
  }

  const missing = dataSources().filter((source) => !source.connected);
  if (missing.length) {
    push({
      kind: 'integration',
      severity: 'low',
      title: `${missing.length} منبع داده وصل نیست`,
      evidence: missing.map((source) => source.label).join('، '),
      cause: 'کلیدهای محیطی تنظیم نشده‌اند',
      impact: 'بخش‌های SEO، درآمد و Lighthouse ناقص می‌مانند',
      action: 'متغیرهای محیطی فهرست‌شده در بخش «منابع داده» را تنظیم کنید.',
    });
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

function describeDataQuality(context) {
  const events = context.events.length;
  return {
    events,
    sessions: sessionize(context.events).length,
    users: context.users.length,
    auditEntries: context.activity.length,
    level: events === 0 ? 'empty' : events < 50 ? 'sparse' : events < 500 ? 'partial' : 'ok',
    since: context.allEvents.length ? new Date(Math.min(...context.allEvents.map((event) => event.ts))).toISOString() : null,
    note: events === 0
      ? 'تلمتری از لحظهٔ نصب جمع می‌شود؛ برای بازه‌های قبل از نصب داده‌ای وجود ندارد.'
      : null,
  };
}

/* ───────────────────────────── ۲. تحلیل ترافیک ───────────────────────────── */

const SOURCE_LABELS = {
  organic: 'جست‌وجوی ارگانیک', direct: 'مستقیم', social: 'شبکه‌های اجتماعی',
  referral: 'ارجاعی', email: 'ایمیل', campaign: 'کمپین', other: 'سایر',
};

export function trafficSection(context) {
  const sessions = sessionize(context.events);
  const previousSessions = sessionize(context.previousEvents);
  const series = buildDailySeries(context);

  const views = context.events.filter((event) => event.type === 'page_view');
  const previousViews = context.previousEvents.filter((event) => event.type === 'page_view');

  const withDuration = sessions.filter((session) => session.durationMs > 0);
  const previousWithDuration = previousSessions.filter((session) => session.durationMs > 0);

  const usersInRange = context.users.filter((user) => {
    const ts = new Date(user.createdAt).getTime();
    return ts >= context.resolved.start && ts <= context.resolved.end;
  });

  const sourceCounts = byKey(sessions, (session) => session.source);
  const sources = Object.entries(sourceCounts)
    .map(([key, count]) => ({ key, label: SOURCE_LABELS[key] ?? key, count, share: pct(count, sessions.length) }))
    .sort((a, b) => b.count - a.count);

  /* ── صفحه‌ها: بازدید، ورود، خروج، تبدیل، مدت ── */
  const pageStats = new Map();
  const ensurePage = (path) => {
    if (!pageStats.has(path)) {
      pageStats.set(path, { path, views: 0, sessions: new Set(), entries: 0, exits: 0, conversions: 0, totalDuration: 0, durationSamples: 0 });
    }
    return pageStats.get(path);
  };

  views.forEach((view) => { ensurePage(view.path).views += 1; });

  const viewsBySession = new Map();
  context.events.filter((event) => event.type === 'page_view').forEach((event) => {
    const list = viewsBySession.get(event.sessionId);
    if (list) list.push(event);
    else viewsBySession.set(event.sessionId, [event]);
  });

  sessions.forEach((session) => {
    session.pages.forEach((path) => ensurePage(path).sessions.add(session.sessionId));
    ensurePage(session.entry).entries += 1;
    ensurePage(session.exit).exits += 1;

    const sessionViews = (viewsBySession.get(session.sessionId) ?? []).sort((a, b) => a.ts - b.ts);
    sessionViews.forEach((view, index) => {
      const next = sessionViews[index + 1];
      if (!next) return;
      const page = ensurePage(view.path);
      page.totalDuration += next.ts - view.ts;
      page.durationSamples += 1;
    });

    if (session.types.has('signup') || session.types.has('test_submit') || session.types.has('purchase')) {
      session.pages.forEach((path) => { ensurePage(path).conversions += 1; });
    }
  });

  const pages = [...pageStats.values()].map((page) => ({
    path: page.path,
    views: page.views,
    sessions: page.sessions.size,
    entries: page.entries,
    exits: page.exits,
    conversions: page.conversions,
    conversionRate: page.sessions.size ? pct(page.conversions, page.sessions.size) : null,
    exitRate: page.views ? pct(page.exits, page.views) : null,
    avgSeconds: page.durationSamples ? round(page.totalDuration / page.durationSamples / 1000, 1) : null,
  }));

  const ranked = [...pages].sort((a, b) => b.views - a.views);

  /* افت شدید: نیمهٔ دوم بازه در برابر نیمهٔ اول */
  const midpoint = context.resolved.start + Math.round((context.resolved.end - context.resolved.start) / 2);
  const firstHalf = byKey(context.events.filter((event) => event.type === 'page_view' && event.ts < midpoint), (event) => event.path);
  const secondHalf = byKey(context.events.filter((event) => event.type === 'page_view' && event.ts >= midpoint), (event) => event.path);
  const declining = Object.entries(firstHalf)
    .map(([path, before]) => ({ path, before, after: secondHalf[path] ?? 0, delta: deltaOf(secondHalf[path] ?? 0, before) }))
    .filter((item) => item.delta !== null && item.delta <= -30 && item.before >= 3)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 8);

  const deviceLabels = { desktop: 'دسکتاپ', mobile: 'موبایل', tablet: 'تبلت', bot: 'ربات' };
  const breakdown = (counts) => Object.entries(counts)
    .map(([key, count]) => ({ key, count, share: pct(count, sessions.length) }))
    .sort((a, b) => b.count - a.count);

  return {
    range: context.resolved,
    kpis: [
      kpi({ key: 'pageViews', label: 'Page Views', value: views.length, previous: previousViews.length, hint: 'مجموع بازدید صفحات.' }),
      kpi({ key: 'visitors', label: 'Unique Visitors', value: unique(sessions.map((session) => session.userId ?? session.sessionId)).size, previous: unique(previousSessions.map((session) => session.userId ?? session.sessionId)).size, hint: 'کاربر یکتا (ورود‌شده یا نشست ناشناس).' }),
      kpi({ key: 'sessions', label: 'Sessions', value: sessions.length, previous: previousSessions.length, hint: 'نشست‌های ثبت‌شده.' }),
      kpi({ key: 'newUsers', label: 'New Users', value: usersInRange.length, previous: null, hint: 'حساب‌های ساخته‌شده در بازه.' }),
      kpi({ key: 'returningUsers', label: 'Returning Users', value: sessions.filter((session) => session.userId).length, previous: null, hint: 'نشست‌های کاربران شناسایی‌شده.' }),
      kpi({ key: 'avgDuration', label: 'Average Session Duration', value: round(average(withDuration.map((session) => session.durationMs / 1000)) ?? 0, 1), previous: round(average(previousWithDuration.map((session) => session.durationMs / 1000)) ?? 0, 1), unit: 'ثانیه', hint: 'میانگین طول نشست.' }),
      kpi({ key: 'bounceRate', label: 'Bounce Rate', value: sessions.length ? pct(sessions.filter((session) => session.views <= 1).length, sessions.length) : null, previous: previousSessions.length ? pct(previousSessions.filter((session) => session.views <= 1).length, previousSessions.length) : null, unit: '٪', direction: 'lower', hint: 'نشست‌های تک‌صفحه‌ای.' }),
      kpi({ key: 'pagesPerSession', label: 'Pages / Session', value: sessions.length ? round(views.length / sessions.length, 2) : null, previous: previousSessions.length ? round(previousViews.length / previousSessions.length, 2) : null, hint: 'میانگین صفحات هر نشست.' }),
      kpi({ key: 'dau', label: 'DAU', value: unique(sessions.filter((session) => session.start >= startOfDay(Date.now())).map((session) => session.userId ?? session.sessionId)).size, previous: null, hint: 'کاربر فعال ۲۴ ساعت اخیر.' }),
      kpi({ key: 'wau', label: 'WAU', value: unique(sessions.filter((session) => session.start >= Date.now() - 7 * DAY_MS).map((session) => session.userId ?? session.sessionId)).size, previous: null, hint: 'کاربر فعال ۷ روز اخیر.' }),
      kpi({ key: 'mau', label: 'MAU', value: unique(sessions.filter((session) => session.start >= Date.now() - 30 * DAY_MS).map((session) => session.userId ?? session.sessionId)).size, previous: null, hint: 'کاربر فعال ۳۰ روز اخیر.' }),
    ],
    series,
    sources,
    pages: {
      top: ranked.slice(0, 10),
      low: ranked.filter((page) => page.views > 0).slice(-10).reverse(),
      topExit: [...pages].sort((a, b) => (b.exitRate ?? 0) - (a.exitRate ?? 0)).slice(0, 8),
      topConversion: pages.filter((page) => page.conversions > 0).sort((a, b) => b.conversions - a.conversions).slice(0, 8),
      landing: [...pages].sort((a, b) => b.entries - a.entries).slice(0, 8),
      declining,
    },
    devices: breakdown(byKey(sessions, (session) => session.device)).map((item) => ({ ...item, label: deviceLabels[item.key] ?? item.key })),
    browsers: breakdown(byKey(sessions, (session) => session.browser)),
    systems: breakdown(byKey(sessions, (session) => session.os)),
    locales: breakdown(byKey(context.events, (event) => event.locale)).slice(0, 10),
    geo: {
      connected: false,
      requires: 'GeoIP (پایگاه دادهٔ کشور/شهر)',
      note: 'تحلیل جغرافیایی به یک منبع GeoIP نیاز دارد که در این نسخه وصل نیست. توزیع زبان مرورگر به‌جای آن نمایش داده می‌شود.',
      countries: [], cities: [], provinces: [],
    },
  };
}

/* ───────────────────────────── ۳. تحلیل کاربران ───────────────────────────── */

export function usersSection(context) {
  const sessions = sessionize(context.events);
  const series = buildDailySeries(context);
  const users = context.users;

  const inRange = users.filter((user) => {
    const ts = new Date(user.createdAt).getTime();
    return ts >= context.resolved.start && ts <= context.resolved.end;
  });

  const activeIds = unique(context.events.map((event) => event.userId));
  const previousActiveIds = unique(context.previousEvents.map((event) => event.userId));
  const seenBefore = unique(context.allEvents.filter((event) => event.ts < context.resolved.start).map((event) => event.userId));
  const returning = [...activeIds].filter((id) => seenBefore.has(id)).length;

  const recentlyActive = unique(context.allEvents.filter((event) => event.ts >= Date.now() - 30 * DAY_MS).map((event) => event.userId));
  const churned = users.filter((user) => !recentlyActive.has(user.id)).length;

  /* Cohort: هفتهٔ ثبت‌نام × فعالیت هفته‌های بعد — بر پایهٔ رویدادهای واقعی */
  const cohortWeeks = 6;
  const cohorts = [];
  for (let offset = cohortWeeks - 1; offset >= 0; offset -= 1) {
    const start = startOfDay(Date.now() - (offset * 7 + 6) * DAY_MS);
    const end = start + 7 * DAY_MS - 1;
    const members = users.filter((user) => {
      const ts = new Date(user.createdAt).getTime();
      return ts >= start && ts <= end;
    });

    if (!members.length) {
      cohorts.push({ key: dayKey(start), label: dayKey(start).slice(5), size: 0, retention: [] });
      continue;
    }

    const ids = new Set(members.map((member) => member.id));
    const retention = [];
    for (let week = 0; week < cohortWeeks - offset; week += 1) {
      const from = start + week * 7 * DAY_MS;
      const to = from + 7 * DAY_MS - 1;
      const active = unique(context.allEvents.filter((event) => ids.has(event.userId) && event.ts >= from && event.ts <= to).map((event) => event.userId)).size;
      retention.push({ week, value: pct(active, members.length) ?? 0, active });
    }
    cohorts.push({ key: dayKey(start), label: dayKey(start).slice(5), size: members.length, retention });
  }

  /* عمر کاربر: ساخت حساب تا آخرین فعالیت واقعی */
  const lastSeen = new Map();
  context.allEvents.forEach((event) => {
    if (!event.userId) return;
    lastSeen.set(event.userId, Math.max(lastSeen.get(event.userId) ?? 0, event.ts));
  });

  const lifetimes = users
    .map((user) => {
      const seen = lastSeen.get(user.id);
      return seen ? Math.round((seen - new Date(user.createdAt).getTime()) / DAY_MS) : null;
    })
    .filter((value) => value !== null);

  /* نقشهٔ فعالیت: روز هفته × ساعت (getDay: یکشنبه=۰ → شنبه=۶ در تقویم ایرانی) */
  const weekdayLabels = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const heatmap = [];
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) heatmap.push({ day, hour, value: 0 });
  }
  context.events.forEach((event) => {
    const date = new Date(event.ts);
    const index = (date.getDay() + 1) % 7;
    const cell = heatmap.find((item) => item.day === index && item.hour === date.getHours());
    if (cell) cell.value += 1;
  });

  /* ── قیف تبدیل: هر مرحله از دادهٔ واقعی موجود ── */
  const profileComplete = inRange.filter((user) => user.profileComplete).length;
  const studied = unique(context.events.filter((event) => ['article_read', 'lesson_view', 'wiki_view'].includes(event.type)).map((event) => event.userId)).size;
  const tested = unique(context.events.filter((event) => event.type === 'test_submit').map((event) => event.userId)).size;
  const purchased = unique(context.events.filter((event) => event.type === 'purchase').map((event) => event.userId)).size;

  const testCounts = context.events
    .filter((event) => event.type === 'test_submit' && event.userId)
    .reduce((accumulator, event) => {
      accumulator[event.userId] = (accumulator[event.userId] ?? 0) + 1;
      return accumulator;
    }, {});
  const repeatTested = Object.values(testCounts).filter((count) => count > 1).length;

  const paymentConnected = context.sources.payment?.connected ?? false;

  const steps = [
    { key: 'visitors', label: 'بازدید', value: sessions.length, hint: 'نشست‌های ثبت‌شده' },
    { key: 'signup', label: 'ثبت‌نام', value: inRange.length, hint: 'حساب ساخته‌شده در بازه' },
    { key: 'profile', label: 'تکمیل پروفایل', value: profileComplete, hint: 'نام، نام خانوادگی و دانشگاه پر شده' },
    { key: 'study', label: 'شروع مطالعه', value: studied, hint: 'رویداد مطالعهٔ مقاله/درسنامه/ویکی' },
    { key: 'test', label: 'انجام تست', value: tested, hint: 'رویداد test_submit' },
    { key: 'purchase', label: 'خرید', value: purchased, hint: 'نیازمند اتصال درگاه پرداخت', available: paymentConnected },
    { key: 'repeat', label: 'استفادهٔ مکرر', value: repeatTested, hint: 'بیش از یک تست ثبت‌شده' },
  ];

  const funnel = steps.map((step, index) => {
    const previousStep = index > 0 ? steps[index - 1] : null;
    return {
      ...step,
      shareOfVisitors: pct(step.value, steps[0].value || 1),
      passRate: previousStep ? pct(step.value, previousStep.value) : 100,
      dropRate: previousStep && previousStep.value ? pct(previousStep.value - step.value, previousStep.value) : null,
    };
  });

  const entryPages = byKey(sessions, (session) => session.entry);
  const exitPages = byKey(sessions, (session) => session.exit);

  return {
    range: context.resolved,
    kpis: [
      kpi({ key: 'newUsers', label: 'کاربران جدید', value: inRange.length, previous: null, hint: 'حساب‌های ساخته‌شده در بازه.' }),
      kpi({ key: 'activeUsers', label: 'کاربران فعال', value: activeIds.size, previous: previousActiveIds.size, hint: 'کاربر یکتا با رویداد در بازه.' }),
      kpi({ key: 'returning', label: 'کاربران بازگشتی', value: returning, previous: null, hint: 'کاربرانی که پیش از بازه هم فعال بوده‌اند.' }),
      kpi({ key: 'retention', label: 'Retention هفتهٔ اول', value: cohorts.at(-1)?.retention?.[1]?.value ?? null, previous: null, unit: '٪', hint: 'درصد اعضای آخرین گروه که هفتهٔ بعد هم فعال بوده‌اند.' }),
      kpi({ key: 'churn', label: 'Churn (۳۰ روز)', value: users.length ? pct(churned, users.length) : null, previous: null, unit: '٪', direction: 'lower', hint: 'کاربرانی که ۳۰ روز اخیر فعال نبوده‌اند.' }),
      kpi({ key: 'lifetime', label: 'میانگین عمر کاربر', value: lifetimes.length ? round(average(lifetimes), 0) : null, previous: null, unit: 'روز', hint: 'فاصلهٔ ساخت حساب تا آخرین فعالیت ثبت‌شده.' }),
    ],
    series,
    cohorts,
    cohortWeeks,
    heatmap: { cells: heatmap, weekdays: weekdayLabels, max: Math.max(1, ...heatmap.map((cell) => cell.value)) },
    funnel,
    entryPages: Object.entries(entryPages).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    exitPages: Object.entries(exitPages).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    demographics: {
      universities: Object.entries(byKey(users.filter((user) => user.university), (user) => user.university)).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      terms: Object.entries(byKey(users.filter((user) => user.term), (user) => user.term)).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      motivations: Object.entries(users.flatMap((user) => user.motivations).reduce((accumulator, key) => {
        accumulator[key] = (accumulator[key] ?? 0) + 1;
        return accumulator;
      }, {})).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
      profileCompletion: users.length ? pct(users.filter((user) => user.profileComplete).length, users.length) : null,
    },
    userList: users
      .map((user) => ({ ...user, lastSeen: lastSeen.get(user.id) ? new Date(lastSeen.get(user.id)).toISOString() : null }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 50),
    privacy: 'شمارهٔ تماس و ایمیل کاربران در این پنل پوشانده می‌شود؛ دادهٔ حساس هرگز نمایش داده نمی‌شود.',
  };
}

/* ───────────────────────────── ۴. تحلیل آموزشی ───────────────────────────── */

export async function educationSection(context) {
  const content = await staticContent();

  const tests = context.events.filter((event) => event.type === 'test_submit');
  const previousTests = context.previousEvents.filter((event) => event.type === 'test_submit');
  const flashcards = context.events.filter((event) => event.type === 'flashcard_review');
  const reads = context.events.filter((event) => ['article_read', 'lesson_view', 'wiki_view'].includes(event.type));

  const scoreOf = (event) => Number(event.meta?.score ?? event.value);
  const scored = tests.map(scoreOf).filter(Number.isFinite);
  const previousScored = previousTests.map(scoreOf).filter(Number.isFinite);
  const timeOf = (event) => Number(event.meta?.seconds ?? 0);

  /* تفکیک درس‌ها بر پایهٔ متادیتای واقعی رویدادها */
  const subjectMap = new Map();
  const ensureSubject = (id) => {
    if (!subjectMap.has(id)) subjectMap.set(id, { id, studies: 0, tests: 0, questions: 0, scores: [], seconds: 0, users: new Set() });
    return subjectMap.get(id);
  };

  [...tests, ...reads].forEach((event) => {
    const subjectId = event.meta?.subjectId || event.meta?.subject;
    if (!subjectId) return;
    const subject = ensureSubject(subjectId);
    if (event.type === 'test_submit') {
      subject.tests += 1;
      subject.questions += Number(event.meta?.questions) || 0;
      const score = scoreOf(event);
      if (Number.isFinite(score)) subject.scores.push(score);
    } else {
      subject.studies += 1;
    }
    subject.seconds += timeOf(event);
    if (event.userId) subject.users.add(event.userId);
  });

  const subjectLabels = new Map((content.testBank?.subjects ?? []).map((subject) => [subject.id, subject.name]));

  /*
   * سؤال‌های هر تست هم درس خودشان را دارند؛ از همان متادیتای واقعی تفکیک می‌شود
   * تا درسی که فقط از مسیر سؤال‌ها دیده شده هم در جدول درس‌ها بیاید.
   */
  tests.forEach((event) => {
    const items = Array.isArray(event.meta?.questionsDetail) ? event.meta.questionsDetail : [];
    items.forEach((item) => {
      if (!item.subjectId) return;
      const subject = ensureSubject(item.subjectId);
      subject.questionAttempts = (subject.questionAttempts ?? 0) + 1;
      if (item.correct) subject.questionCorrect = (subject.questionCorrect ?? 0) + 1;
    });
  });

  const subjects = [...subjectMap.values()]
    .map((subject) => ({
      id: subject.id,
      label: subjectLabels.get(subject.id) ?? subject.id,
      studies: subject.studies,
      tests: subject.tests,
      questions: subject.questions,
      users: subject.users.size,
      accuracy: subject.scores.length ? round(average(subject.scores), 1) : null,
      questionAccuracy: subject.questionAttempts ? round(((subject.questionCorrect ?? 0) / subject.questionAttempts) * 100, 1) : null,
      questionAttempts: subject.questionAttempts ?? 0,
      avgSeconds: subject.tests ? round(subject.seconds / subject.tests, 1) : null,
      retention: null,
      engagement: subject.tests + subject.studies + (subject.questionAttempts ?? 0),
    }))
    .sort((a, b) => b.engagement - a.engagement);

  /* سؤالات: از متادیتای واقعی رویداد تست */
  const questionMap = new Map();
  tests.forEach((event) => {
    const items = Array.isArray(event.meta?.questionsDetail) ? event.meta.questionsDetail : [];
    items.forEach((item) => {
      const id = item.id ?? item.questionId;
      if (!id) return;
      const current = questionMap.get(id) ?? { id, stem: item.stem ?? '', attempts: 0, correct: 0, seconds: 0, topic: item.topicPath || item.topic || null, subjectId: item.subjectId ?? null };
      current.attempts += 1;
      if (item.correct) current.correct += 1;
      current.seconds += Number(item.seconds) || 0;
      questionMap.set(id, current);
    });
  });

  const questions = [...questionMap.values()].map((question) => ({
    ...question,
    accuracy: question.attempts ? round((question.correct / question.attempts) * 100, 1) : null,
    avgSeconds: question.attempts ? round(question.seconds / question.attempts, 1) : null,
  }));

  const wrongTopics = tests.flatMap((event) => {
    const items = Array.isArray(event.meta?.questionsDetail) ? event.meta.questionsDetail : [];
    return items.filter((item) => !item.correct).map((item) => item.topicPath || item.topic || 'نامشخص');
  });

  return {
    range: context.resolved,
    inventory: {
      testBank: content.testBank,
      wiki: content.wiki,
      flashcards: content.flashcards,
      knowledge: content.knowledge,
      international: content.international,
      coordinated: content.coordinated,
      course: content.course,
      failed: content.failed,
    },
    kpis: [
      kpi({ key: 'tests', label: 'تست‌های انجام‌شده', value: tests.length, previous: previousTests.length, hint: 'رویداد test_submit.' }),
      kpi({ key: 'questions', label: 'سؤالات پاسخ‌داده‌شده', value: sum(tests.map((event) => Number(event.meta?.questions) || 0)), previous: sum(previousTests.map((event) => Number(event.meta?.questions) || 0)), hint: 'مجموع سؤالات تست‌ها.' }),
      kpi({ key: 'accuracy', label: 'میانگین درصد کاربران', value: scored.length ? round(average(scored), 1) : null, previous: previousScored.length ? round(average(previousScored), 1) : null, unit: '٪', hint: 'میانگین درصد ثبت‌شده در رویدادهای تست.' }),
      kpi({ key: 'avgTime', label: 'میانگین زمان پاسخ', value: tests.length ? round(average(tests.map(timeOf).filter(Boolean)) ?? 0, 1) : null, previous: null, unit: 'ثانیه', direction: 'lower', hint: 'میانگین زمان هر تست.' }),
      kpi({ key: 'flashcards', label: 'مرور فلش‌کارت', value: flashcards.length, previous: context.previousEvents.filter((event) => event.type === 'flashcard_review').length, hint: 'رویداد flashcard_review.' }),
      kpi({ key: 'studies', label: 'مطالعهٔ محتوا', value: reads.length, previous: context.previousEvents.filter((event) => ['article_read', 'lesson_view', 'wiki_view'].includes(event.type)).length, hint: 'رویدادهای مطالعهٔ مقاله، درسنامه و ویکی.' }),
      kpi({ key: 'activeLearners', label: 'دانشجویان فعال', value: unique([...tests, ...reads].map((event) => event.userId)).size, previous: null, hint: 'کاربر یکتای دارای رویداد آموزشی.' }),
    ],
    subjects,
    questions: {
      total: questions.length,
      hardest: [...questions].sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100)).slice(0, 8),
      easiest: [...questions].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0)).slice(0, 8),
      anomalous: questions.filter((question) => question.attempts >= 3 && (question.accuracy ?? 100) < 25),
    },
    weakTopics: Object.entries(wrongTopics.reduce((accumulator, key) => {
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {})).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    topArticles: [...context.articles]
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 8)
      .map((article) => ({ id: article.id, title: article.title, views: article.views ?? 0, category: article.category })),
    topContent: Object.entries(byKey(reads.filter((event) => event.meta?.contentId), (event) => event.meta.contentId))
      .map(([id, count]) => ({ id, title: context.articles.find((article) => article.id === id)?.title ?? id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    knowledge: content.knowledge
      ? {
        connected: true,
        nodes: content.knowledge.nodes,
        edges: content.knowledge.edges,
        courses: content.knowledge.courses,
        byType: content.knowledge.byType,
        crossLinks: buildCrossLinks(context),
        note: 'شبکهٔ دانش موجود در محصول؛ تحلیل ارتباط بین مباحث بر پایهٔ همین گراف و هم‌نشستی واقعی مباحث در نشست‌ها.',
      }
      : { connected: false, note: 'گراف شبکهٔ دانش خوانده نشد.' },
    note: tests.length === 0
      ? 'رویداد آموزشی ثبت نشده است. موجودی محتوای محصول در بالا واقعی است، اما تحلیل رفتار کاربران به تلمتری بخش‌های آموزشی نیاز دارد.'
      : null,
  };
}

/* ارتباط بین‌درسی: مباحثی که در یک نشست واقعی با هم مرور شده‌اند */
function buildCrossLinks(context) {
  const bySession = new Map();
  context.events.forEach((event) => {
    const subjectId = event.meta?.subjectId;
    if (!subjectId) return;
    const list = bySession.get(event.sessionId);
    if (list) list.add(subjectId);
    else bySession.set(event.sessionId, new Set([subjectId]));
  });

  const pairs = new Map();
  bySession.forEach((subjects) => {
    const list = [...subjects];
    list.forEach((left, index) => {
      list.slice(index + 1).forEach((right) => {
        const key = [left, right].sort().join('|');
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      });
    });
  });

  return [...pairs.entries()]
    .map(([key, count]) => ({ pair: key.split('|'), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/* ───────────────────────────── ۵. تحلیل سئو ───────────────────────────── */

export function seoSection(context) {
  const gsc = context.sources['search-console'];

  const items = [
    ...context.articles.map((article) => ({
      kind: 'article', id: article.id, title: article.title, slug: article.slug,
      status: article.status, seo: article.seo ?? {}, excerpt: article.excerpt ?? '',
      text: plainText(article.contentHtml), cover: article.cover, coverAlt: article.coverAlt,
      updatedAt: article.updatedAt, views: article.views ?? 0,
      internalLinks: (String(article.contentHtml).match(/href="\//g) ?? []).length,
    })),
    ...context.pages.map((page) => ({
      kind: 'page', id: page.id, title: page.title, slug: page.slug,
      status: page.status, seo: page.seo ?? {}, excerpt: '',
      text: plainText(page.contentHtml), cover: page.cover, coverAlt: '',
      updatedAt: page.updatedAt, views: 0,
      internalLinks: (String(page.contentHtml).match(/href="\//g) ?? []).length,
    })),
  ];

  const indexable = items.filter((item) => item.status === 'published');
  const titleOf = (item) => String(item.seo.title || item.title || '').trim();
  const descOf = (item) => String(item.seo.description || item.excerpt || '').trim();
  const titleCounts = byKey(indexable, titleOf);
  const descCounts = byKey(indexable.filter((item) => descOf(item)), descOf);

  const issue = (code, label, severity, list, hint) => ({
    code, label, severity, count: list.length, hint,
    items: list.slice(0, 12).map((item) => ({ id: item.id, kind: item.kind, title: item.title, slug: item.slug, status: item.status })),
  });

  const health = [
    issue('missing-title', 'بدون عنوان سئو', 'high', indexable.filter((item) => !titleOf(item)), 'عنوان متا برای موتور جست‌وجو ضروری است.'),
    issue('duplicate-title', 'عنوان تکراری', 'high', indexable.filter((item) => titleCounts[titleOf(item)] > 1), 'عنوان یکسان باعث رقابت صفحات با خودشان می‌شود.'),
    issue('long-title', 'عنوان بیش از ۶۰ کاراکتر', 'low', indexable.filter((item) => titleOf(item).length > 60), 'عنوان بلند در نتایج گوگل بریده می‌شود.'),
    issue('missing-description', 'بدون Meta Description', 'high', indexable.filter((item) => !descOf(item)), 'توضیح متا نرخ کلیک را تغییر می‌دهد.'),
    issue('duplicate-description', 'توضیح متا تکراری', 'medium', indexable.filter((item) => descOf(item) && descCounts[descOf(item)] > 1), 'توضیح تکراری ارزش رتبه‌بندی ندارد.'),
    issue('long-description', 'توضیح متا بیش از ۱۶۰ کاراکتر', 'low', indexable.filter((item) => descOf(item).length > 160), 'توضیح بلند بریده می‌شود.'),
    issue('thin-content', 'محتوای کم‌عمق (Thin Content)', 'medium', indexable.filter((item) => item.text.length < 300), 'محتوای زیر ۳۰۰ کاراکتر رتبهٔ پایینی می‌گیرد.'),
    issue('missing-canonical', 'بدون Canonical', 'low', indexable.filter((item) => !item.seo.canonical), 'در نبود Canonical ممکن است نسخه‌های مشابه ایندکس شوند.'),
    issue('noindex', 'صفحهٔ Noindex', 'medium', indexable.filter((item) => String(item.seo.robots ?? '').includes('noindex')), 'این صفحه از نتایج جست‌وجو حذف می‌شود.'),
    issue('missing-slug', 'اسلاگ نامناسب', 'low', indexable.filter((item) => !item.slug || item.slug.length < 3), 'اسلاگ کوتاه و توصیفی برای URL بهتر است.'),
    issue('missing-cover-alt', 'تصویر بدون متن جانشین', 'low', indexable.filter((item) => item.cover && !item.coverAlt), 'متن جانشین برای دسترس‌پذیری و سئوی تصویر لازم است.'),
    issue('no-internal-links', 'بدون لینک داخلی', 'medium', indexable.filter((item) => item.internalLinks === 0), 'لینک داخلی به کشف و رتبهٔ صفحات کمک می‌کند.'),
    issue('stale', 'محتوای قدیمی (۶ ماه+)', 'low', indexable.filter((item) => item.updatedAt && Date.now() - new Date(item.updatedAt).getTime() > 180 * DAY_MS), 'به‌روزرسانی محتوای قدیمی رتبه را بهبود می‌دهد.'),
  ];

  const criticalCount = health.filter((item) => item.severity === 'high').reduce((total, item) => total + item.count, 0);
  const mediumCount = health.filter((item) => item.severity === 'medium').reduce((total, item) => total + item.count, 0);
  const totalIssues = health.reduce((total, item) => total + item.count, 0);
  const score = indexable.length
    ? Math.max(0, 100 - Math.min(100, Math.round(((criticalCount * 6 + mediumCount * 2) / indexable.length) * 10)))
    : null;

  return {
    range: context.resolved,
    connected: { onPage: true, searchConsole: Boolean(gsc?.connected), crawl: false },
    requires: { searchConsole: 'GSC_SITE_URL + GA_CLIENT_EMAIL + GA_PRIVATE_KEY' },
    kpis: [
      kpi({ key: 'clicks', label: 'Total Clicks', value: null, previous: null, available: false, hint: 'نیازمند اتصال Google Search Console.' }),
      kpi({ key: 'impressions', label: 'Total Impressions', value: null, previous: null, available: false, hint: 'نیازمند اتصال Google Search Console.' }),
      kpi({ key: 'ctr', label: 'CTR', value: null, previous: null, unit: '٪', available: false, hint: 'نیازمند اتصال Google Search Console.' }),
      kpi({ key: 'position', label: 'Average Position', value: null, previous: null, available: false, hint: 'نیازمند اتصال Google Search Console.' }),
      kpi({ key: 'indexed', label: 'صفحات ایندکس‌شده', value: null, previous: null, available: false, hint: 'نیازمند اتصال Search Console یا ابزار Crawl.' }),
      kpi({ key: 'indexable', label: 'صفحات قابل ایندکس (محلی)', value: indexable.length, previous: null, hint: 'صفحات منتشرشدهٔ واقعی در CMS که واجد شرایط ایندکس‌اند.' }),
      kpi({
        key: 'seoScore', label: 'SEO Health Score', value: score, previous: null, unit: '٪',
        hint: 'محاسبه‌شده از ممیزی واقعی on-page محتوای CMS (نه دادهٔ خارجی).',
        status: score === null ? 'neutral' : score >= 85 ? 'good' : score >= 65 ? 'warn' : 'critical',
      }),
      kpi({ key: 'issues', label: 'مشکلات یافت‌شده', value: totalIssues, previous: null, direction: 'lower', hint: 'مجموع یافته‌های ممیزی on-page.' }),
    ],
    health,
    contentAudit: indexable.map((item) => ({
      id: item.id, kind: item.kind, title: item.title, slug: item.slug,
      titleLength: titleOf(item).length, descriptionLength: descOf(item).length,
      wordCount: item.text.length, internalLinks: item.internalLinks, views: item.views,
    })).sort((a, b) => b.wordCount - a.wordCount),
    keywords: {
      connected: Boolean(gsc?.connected),
      note: 'دادهٔ کلمات کلیدی (کلیک، Impression، CTR، رتبه) فقط از Google Search Console می‌آید.',
      top: [], impressionLeaders: [], clickLeaders: [], bestCtr: [],
      positions: { top3: [], top10: [], top20: [] }, rising: [], falling: [],
    },
    organicPages: {
      connected: Boolean(gsc?.connected),
      note: 'عملکرد ارگانیک هر صفحه به Search Console نیاز دارد.',
      topClicks: [], topImpressions: [], lowCtr: [], weakPosition: [], suddenDrop: [],
    },
    technical: {
      connected: false,
      note: 'بررسی لینک شکسته، زنجیرهٔ ریدایرکت، Sitemap، Robots.txt و صفحات یتیم به یک Crawl داخلی یا دسترسی به سایت زندهٔ منتشرشده نیاز دارد.',
      checks: [
        { label: 'Robots.txt', status: 'unknown', hint: 'نیازمند Crawl' },
        { label: 'Sitemap.xml', status: 'unknown', hint: 'نیازمند Crawl' },
        { label: 'Broken Links', status: 'unknown', hint: 'نیازمند Crawl' },
        { label: 'Redirect Chains', status: 'unknown', hint: 'نیازمند Crawl' },
        { label: '404 Pages', status: 'unknown', hint: 'نیازمند Crawl' },
        { label: 'Orphan Pages', status: 'unknown', hint: 'نیازمند Crawl' },
        { label: 'Duplicate Content', status: 'unknown', hint: 'نیازمند Crawl' },
      ],
    },
  };
}

/* ───────────────────────────── ۶. سرعت و عملکرد ───────────────────────────── */

export const CWV_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000, label: 'LCP', hint: 'زمان نمایش بزرگ‌ترین عنصر' },
  INP: { good: 200, poor: 500, label: 'INP', hint: 'تأخیر تعامل کاربر' },
  CLS: { good: 0.1, poor: 0.25, label: 'CLS', hint: 'جابه‌جایی چیدمان' },
  FCP: { good: 1800, poor: 3000, label: 'FCP', hint: 'اولین رندر محتوا' },
  TTFB: { good: 800, poor: 1800, label: 'TTFB', hint: 'زمان پاسخ سرور' },
  PAGE_LOAD: { good: 2500, poor: 4500, label: 'Page Load', hint: 'زمان کامل بارگذاری' },
};

const cwvStatus = (metric, value) => {
  const rule = CWV_THRESHOLDS[metric];
  if (!rule || value === null || value === undefined) return 'unknown';
  if (value <= rule.good) return 'good';
  if (value <= rule.poor) return 'needs-improvement';
  return 'poor';
};

const cwvKpiStatus = (status) => (status === 'unknown' ? 'neutral' : status === 'good' ? 'good' : status === 'needs-improvement' ? 'warn' : 'critical');

export function performanceSection(context) {
  const cwvEvents = context.events.filter((event) => event.type === 'cwv' && event.metric);
  const metrics = {};

  Object.keys(CWV_THRESHOLDS).forEach((metric) => {
    const samples = cwvEvents.filter((event) => event.metric === metric).map((event) => Number(event.value)).filter(Number.isFinite);
    const digits = metric === 'CLS' ? 3 : 0;

    if (!samples.length) {
      metrics[metric] = { metric, samples: 0, p75: null, average: null, status: 'unknown', ...CWV_THRESHOLDS[metric] };
      return;
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const p75 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
    metrics[metric] = {
      metric, samples: samples.length,
      p75: round(p75, digits), average: round(average(samples), digits),
      status: cwvStatus(metric, p75), ...CWV_THRESHOLDS[metric],
    };
  });

  const byPath = new Map();
  cwvEvents.forEach((event) => {
    const current = byPath.get(event.path) ?? { path: event.path, samples: 0, total: 0, worst: 0 };
    current.samples += 1;
    current.total += Number(event.value) || 0;
    current.worst = Math.max(current.worst, Number(event.value) || 0);
    byPath.set(event.path, current);
  });

  const slowPages = [...byPath.values()]
    .map((item) => ({ path: item.path, samples: item.samples, avgMs: Math.round(item.total / item.samples), worstMs: Math.round(item.worst) }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 10);

  const api = context.requests;
  const scored = Object.values(metrics).filter((metric) => metric.status !== 'unknown');
  const score = scored.length
    ? Math.round((scored.filter((metric) => metric.status === 'good').length / scored.length) * 100)
    : null;

  return {
    range: context.resolved,
    kpis: [
      kpi({ key: 'lcp', label: 'LCP (p75)', value: metrics.LCP.p75, previous: null, unit: 'ms', direction: 'lower', status: cwvKpiStatus(metrics.LCP.status), hint: 'دادهٔ میدانی واقعی از مرورگر کاربران.' }),
      kpi({ key: 'inp', label: 'INP (p75)', value: metrics.INP.p75, previous: null, unit: 'ms', direction: 'lower', status: cwvKpiStatus(metrics.INP.status), hint: 'تأخیر تعامل — دادهٔ میدانی.' }),
      kpi({ key: 'cls', label: 'CLS (p75)', value: metrics.CLS.p75, previous: null, unit: '', direction: 'lower', status: cwvKpiStatus(metrics.CLS.status), hint: 'پایداری چیدمان — دادهٔ میدانی.' }),
      kpi({ key: 'fcp', label: 'FCP (p75)', value: metrics.FCP.p75, previous: null, unit: 'ms', direction: 'lower', status: cwvKpiStatus(metrics.FCP.status), hint: 'اولین رندر محتوا.' }),
      kpi({ key: 'ttfb', label: 'TTFB (p75)', value: metrics.TTFB.p75, previous: null, unit: 'ms', direction: 'lower', status: cwvKpiStatus(metrics.TTFB.status), hint: 'زمان پاسخ سرور از دید مرورگر.' }),
      kpi({ key: 'apiResponse', label: 'میانگین پاسخ API', value: api.averageMs, previous: null, unit: 'ms', direction: 'lower', hint: 'اندازه‌گیری واقعی همین سرور.' }),
      kpi({ key: 'apiP95', label: 'صدک ۹۵ پاسخ API', value: api.p95Ms, previous: null, unit: 'ms', direction: 'lower', hint: 'کندترین ۵٪ درخواست‌ها.' }),
      kpi({ key: 'failed', label: 'درخواست‌های ناموفق', value: api.errors, previous: null, direction: 'lower', hint: 'پاسخ‌های ۴xx و ۵xx.' }),
      kpi({ key: 'frontendErrors', label: 'خطاهای Frontend', value: context.events.filter((event) => event.type === 'js_error').length, previous: null, direction: 'lower', hint: 'خطاهای جاوااسکریپت ثبت‌شده در مرورگر.' }),
      kpi({ key: 'backendErrors', label: 'خطاهای Backend', value: context.events.filter((event) => event.type === 'api_error').length, previous: null, direction: 'lower', hint: 'خطاهای ۵xx سرور.' }),
    ],
    score,
    coreWebVitals: Object.values(metrics),
    slowPages,
    api: {
      averageMs: api.averageMs, p50Ms: api.p50Ms, p95Ms: api.p95Ms, p99Ms: api.p99Ms,
      total: api.total, errorRate: api.errorRate, byStatus: api.byStatus,
      slowest: api.slowest, failing: api.failing, minutes: api.minutes,
    },
    lighthouse: {
      connected: context.sources.pagespeed?.connected ?? false,
      requires: 'PAGESPEED_API_KEY',
      note: 'امتیاز Lighthouse/PageSpeed با تنظیم PAGESPEED_API_KEY قابل اتصال است. تا آن زمان Core Web Vitals میدانی (واقعی) نمایش داده می‌شود.',
    },
  };
}

/* ───────────────────────────── ۷. مرکز امنیت ───────────────────────────── */

export function securitySection(context, { secure = false } = {}) {
  const entries = context.activity;
  const failedLogins = entries.filter((entry) => entry.action === 'auth.login-failed');
  const successfulLogins = entries.filter((entry) => entry.action === 'auth.login');
  const sensitive = entries.filter((entry) => [
    'auth.password-changed', 'admin.created', 'admin.deleted', 'admin.updated', 'settings.updated',
  ].includes(entry.action));

  const suspicious = Object.entries(byKey(failedLogins, (entry) => entry.ip || 'ناشناس'))
    .map(([ip, count]) => ({ ip, count, blocked: count >= 8 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const headers = [
    { key: 'nosniff', label: 'X-Content-Type-Options', value: 'nosniff', status: 'active', hint: 'روی همهٔ پاسخ‌های API تنظیم می‌شود.' },
    { key: 'referrer', label: 'Referrer-Policy', value: 'same-origin', status: 'active', hint: 'روی همهٔ مسیرهای API تنظیم می‌شود.' },
    { key: 'cache', label: 'Cache-Control', value: 'no-store', status: 'active', hint: 'جلوگیری از کش دادهٔ پنل.' },
    { key: 'cookie-httponly', label: 'Cookie HttpOnly', value: 'HttpOnly', status: 'active', hint: 'کوکی نشست پنل.' },
    { key: 'cookie-samesite', label: 'Cookie SameSite', value: 'Strict', status: 'active', hint: 'ضد CSRF.' },
    { key: 'cookie-secure', label: 'Cookie Secure', value: secure ? 'Secure' : '—', status: secure ? 'active' : 'missing', hint: secure ? 'فعال روی HTTPS.' : 'در پروداکشن روی HTTPS فعال می‌شود.' },
    { key: 'csrf', label: 'CSRF Token', value: 'x-tapesh-csrf', status: 'active', hint: 'هدر اجباری روی درخواست‌های تغییردهنده.' },
    { key: 'csp', label: 'Content-Security-Policy', value: '', status: 'missing', hint: 'هنوز تنظیم نشده است — پیشنهاد می‌شود.' },
    { key: 'hsts', label: 'Strict-Transport-Security', value: '', status: 'missing', hint: 'روی HTTPS باید تنظیم شود.' },
    { key: 'frame', label: 'X-Frame-Options', value: '', status: 'missing', hint: 'ضد Clickjacking — پیشنهاد می‌شود.' },
  ];

  const active = headers.filter((header) => header.status === 'active').length;
  const score = Math.round((active / headers.length) * 100);
  const rateLimit = rateLimitStats();

  const severityOf = (action) => {
    if (['admin.deleted', 'auth.password-changed', 'admin.created'].includes(action)) return 'high';
    if (['admin.updated', 'settings.updated', 'auth.login-failed'].includes(action)) return 'medium';
    return 'low';
  };

  return {
    range: context.resolved,
    score,
    scoreBreakdown: { active, total: headers.length },
    kpis: [
      kpi({ key: 'logins', label: 'ورود موفق', value: successfulLogins.length, previous: null, hint: 'رویداد auth.login در بازه.' }),
      kpi({ key: 'failed', label: 'ورود ناموفق', value: failedLogins.length, previous: null, direction: 'lower', status: failedLogins.length >= 20 ? 'critical' : failedLogins.length >= 5 ? 'warn' : 'good', hint: 'رویداد auth.login-failed.' }),
      kpi({ key: 'sensitive', label: 'تغییرات حساس', value: sensitive.length, previous: null, direction: 'lower', hint: 'تغییر رمز، سطح دسترسی و ساخت/حذف مدیر.' }),
      kpi({ key: 'unauthorized', label: 'دسترسی غیرمجاز', value: context.requests.byStatus['4xx'] ?? 0, previous: null, direction: 'lower', hint: 'پاسخ‌های ۴xx سرور (احتمال تلاش دسترسی نامعتبر).' }),
      kpi({ key: 'rateLimit', label: 'نقض محدودیت نرخ', value: rateLimit.violations, previous: null, direction: 'lower', status: rateLimit.violations >= 20 ? 'warn' : 'good', hint: `نقض محدودیت ${rateLimit.limit} درخواست در ${rateLimit.windowSeconds} ثانیه روی endpoint تلمتری.` }),
      kpi({ key: 'suspiciousIps', label: 'IP مشکوک', value: suspicious.filter((item) => item.count >= 3).length, previous: null, direction: 'lower', hint: 'IP با بیش از ۳ ورود ناموفق.' }),
    ],
    headers,
    suspicious,
    rateLimit,
    failedLogins: failedLogins.slice(0, 40),
    audit: {
      total: entries.length,
      entries: entries.slice(0, 60).map((entry) => ({
        id: entry.id,
        user: entry.userName,
        ip: entry.ip,
        createdAt: entry.createdAt,
        action: entry.action,
        resource: `${entry.entityType}${entry.entityId ? ` · ${entry.entityId}` : ''}`,
        result: String(entry.action).includes('failed') ? 'failed' : 'success',
        userAgent: entry.userAgent,
        severity: severityOf(entry.action),
        metadata: entry.metadata,
      })),
    },
    hardening: [
      { label: 'رمز با scrypt + salt', status: 'active' },
      { label: 'محافظت از Brute Force (قفل موقت)', status: 'active' },
      { label: 'پاک‌سازی HTML (ضد XSS)', status: 'active' },
      { label: 'RBAC روی هر مسیر', status: 'active' },
      { label: 'پوشاندن اطلاعات حساس در UI', status: 'active' },
      { label: 'Content-Security-Policy', status: 'missing' },
      { label: 'HSTS', status: 'missing' },
      { label: 'محدودیت نرخ روی endpoint تلمتری', status: 'active' },
      { label: 'محدودیت نرخ روی مسیرهای پنل', status: 'missing' },
    ],
    note: 'اطلاعات حساس (رمز، توکن، شمارهٔ کامل) هرگز در این پنل نمایش داده نمی‌شود؛ شمارهٔ تماس کاربران پوشانده می‌شود.',
  };
}

/* ───────────────────────────── ۸. تحلیل درآمد ───────────────────────────── */

export function revenueSection(context) {
  const payment = context.sources.payment;
  const purchaseEvents = context.events.filter((event) => event.type === 'purchase');

  if (!payment?.connected) {
    return {
      range: context.resolved,
      connected: false,
      requires: 'PAYMENT_PROVIDER + PAYMENT_API_KEY',
      note: 'سیستم پرداخت در این نسخه وصل نیست. هیچ عدد درآمدی نمایش داده نمی‌شود تا دادهٔ ساختگی جای واقعیت را نگیرد. با اتصال درگاه، تمام سنجه‌های این بخش از رویدادهای واقعی خرید پر می‌شوند.',
      willShow: [
        'Revenue · Net Revenue · Gross Revenue · Refund · Discount · Tax',
        'Number of Purchases · Average Order Value · Conversion Rate',
        'Revenue per User · Revenue per Paying User',
        'درآمد به تفکیک روز، ماه، محصول، دوره، اشتراک، کاربر، کمپین و روش پرداخت',
        'محصولات پرفروش و کم‌فروش',
        'قیف درآمد: بازدید → ثبت‌نام → استفادهٔ رایگان → خرید → خرید مکرر',
      ],
      kpis: [
        kpi({ key: 'revenue', label: 'Revenue', value: null, previous: null, unit: 'تومان', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
        kpi({ key: 'net', label: 'Net Revenue', value: null, previous: null, unit: 'تومان', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
        kpi({ key: 'gross', label: 'Gross Revenue', value: null, previous: null, unit: 'تومان', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
        kpi({ key: 'refund', label: 'Refund', value: null, previous: null, unit: 'تومان', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
        kpi({ key: 'purchases', label: 'Number of Purchases', value: null, previous: null, available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
        kpi({ key: 'aov', label: 'Average Order Value', value: null, previous: null, unit: 'تومان', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
        kpi({ key: 'conversion', label: 'Conversion Rate', value: null, previous: null, unit: '٪', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
        kpi({ key: 'arpu', label: 'Revenue per User', value: null, previous: null, unit: 'تومان', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
        kpi({ key: 'arppu', label: 'Revenue per Paying User', value: null, previous: null, unit: 'تومان', available: false, hint: 'نیازمند اتصال درگاه پرداخت.' }),
      ],
      series: [],
      byProduct: [], byPlan: [], byPaymentMethod: [], byDay: [], byMonth: [],
      funnel: null,
      purchaseEventsSeen: purchaseEvents.length,
    };
  }

  const gross = sum(purchaseEvents.map((event) => Number(event.value) || 0));
  const previousGross = sum(context.previousEvents.filter((event) => event.type === 'purchase').map((event) => Number(event.value) || 0));

  return {
    range: context.resolved,
    connected: true,
    kpis: [
      kpi({ key: 'revenue', label: 'Revenue', value: gross, previous: previousGross, unit: 'تومان', hint: 'مجموع رویدادهای خرید.' }),
      kpi({ key: 'purchases', label: 'Number of Purchases', value: purchaseEvents.length, previous: context.previousEvents.filter((event) => event.type === 'purchase').length, hint: 'تعداد رویداد خرید.' }),
      kpi({ key: 'aov', label: 'Average Order Value', value: purchaseEvents.length ? Math.round(gross / purchaseEvents.length) : null, previous: null, unit: 'تومان', hint: 'میانگین ارزش سفارش.' }),
      kpi({ key: 'buyers', label: 'خریداران یکتا', value: unique(purchaseEvents.map((event) => event.userId)).size, previous: null, hint: 'کاربر یکتای خریدار.' }),
    ],
    series: [],
    byProduct: Object.entries(byKey(purchaseEvents, (event) => event.meta?.productId)).map(([key, count]) => ({ key, count })),
    byPlan: Object.entries(byKey(purchaseEvents, (event) => event.meta?.plan)).map(([key, count]) => ({ key, count })),
    byPaymentMethod: Object.entries(byKey(purchaseEvents, (event) => event.meta?.method)).map(([key, count]) => ({ key, count })),
    byDay: [], byMonth: [],
    funnel: null,
    purchaseEventsSeen: purchaseEvents.length,
  };
}

/* ───────────────────────────── ۹. تحلیل محصول ───────────────────────────── */

const FEATURES = [
  { id: 'lessons', label: 'درسنامهٔ جامع', eventTypes: ['lesson_view'], icon: 'book' },
  { id: 'test-bank', label: 'بانک تست', eventTypes: ['test_submit'], icon: 'list' },
  { id: 'flashcards', label: 'فلش‌کارت', eventTypes: ['flashcard_review'], icon: 'cards' },
  { id: 'wiki', label: 'ویکی تپش', eventTypes: ['wiki_view'], icon: 'wiki' },
  { id: 'articles', label: 'مقالات', eventTypes: ['article_read'], icon: 'article' },
  { id: 'league', label: 'لیگ', eventTypes: ['feature_use'], match: 'league', icon: 'trophy' },
  { id: 'exam-builder', label: 'آزمون‌ساز شخصی', eventTypes: ['test_start'], match: 'builder', icon: 'builder' },
  { id: 'coordinated', label: 'آزمون‌های هماهنگ', eventTypes: ['test_submit'], match: 'coordinated', icon: 'users' },
  { id: 'knowledge', label: 'شبکه دانش', eventTypes: ['feature_use'], match: 'knowledge', icon: 'graph' },
  { id: 'international', label: 'آزمون‌های بین‌الملل', eventTypes: ['test_submit'], match: 'international', icon: 'globe' },
  { id: 'ai', label: 'دستیار هوش مصنوعی', eventTypes: ['feature_use'], match: 'ai', icon: 'robot' },
];

export async function productsSection(context) {
  const content = await staticContent();

  const inventory = {
    lessons: content.course ? `${content.course.modules} ماژول · ${content.course.units} واحد درسنامه` : '—',
    'test-bank': content.testBank ? `${content.testBank.questions} سؤال در ${content.testBank.subjects?.length ?? 0} درس` : '—',
    flashcards: content.flashcards ? `${content.flashcards.cards} کارت در ${content.flashcards.decks} دک` : '—',
    wiki: content.wiki ? `${content.wiki.entities} موجودیت دانشی` : '—',
    articles: `${context.articles.length} مقاله در CMS`,
    league: 'لیگ رقابتی تپش',
    'exam-builder': 'آزمون‌ساز شخصی',
    coordinated: content.coordinated ? `${content.coordinated.exams} آزمون هماهنگ` : '—',
    knowledge: content.knowledge ? `${content.knowledge.nodes} مفهوم و ${content.knowledge.edges} ارتباط` : '—',
    international: content.international ? `${content.international.exams} آزمون بین‌الملل` : '—',
    ai: 'دستیار هوش مصنوعی تپش',
  };

  const features = FEATURES.map((feature) => {
    const events = context.events.filter((event) => {
      if (!feature.eventTypes.includes(event.type)) return false;
      if (!feature.match) return true;
      const haystack = `${event.meta?.feature ?? ''} ${event.path ?? ''} ${event.meta?.kind ?? ''}`.toLowerCase();
      return haystack.includes(feature.match);
    });

    const users = unique(events.map((event) => event.userId)).size;
    const totalSeconds = sum(events.map((event) => Number(event.meta?.seconds) || 0));

    const counts = events.filter((event) => event.userId).reduce((accumulator, event) => {
      accumulator[event.userId] = (accumulator[event.userId] ?? 0) + 1;
      return accumulator;
    }, {});
    const returning = Object.values(counts).filter((count) => count > 1).length;

    const errors = context.events.filter((event) => {
      if (event.type !== 'js_error' && event.type !== 'api_error') return false;
      const haystack = `${event.path} ${event.meta?.feature ?? ''}`.toLowerCase();
      return haystack.includes(feature.match ?? feature.id);
    }).length;

    return {
      id: feature.id,
      label: feature.label,
      icon: feature.icon,
      inventory: inventory[feature.id],
      uses: events.length,
      users,
      seconds: totalSeconds,
      avgSecondsPerUse: events.length ? round(totalSeconds / events.length, 1) : null,
      returning,
      returnRate: users ? pct(returning, users) : null,
      errorRate: events.length ? pct(errors, events.length) : null,
      errors,
      status: events.length === 0 ? 'unused' : events.length < 10 ? 'low' : 'active',
    };
  });

  const used = features.filter((feature) => feature.status !== 'unused');

  return {
    range: context.resolved,
    features,
    used: used.length,
    unused: features.length - used.length,
    adoption: pct(used.length, features.length),
    inventory: content,
    note: context.events.length === 0
      ? 'موجودی هر قابلیت واقعی است، اما «استفاده» به تلمتری نیاز دارد و هنوز رویدادی ثبت نشده است.'
      : null,
  };
}

/* ───────────────────────────── ۱۰. تحلیل محتوا ───────────────────────────── */

export async function contentSection(context) {
  const content = await staticContent();
  const viewsByPath = byKey(context.events.filter((event) => event.type === 'page_view'), (event) => event.path);

  const items = [
    ...context.articles.map((article) => ({
      id: article.id, kind: 'article', title: article.title, slug: article.slug,
      status: article.status, category: article.category,
      views: article.views ?? 0, createdAt: article.createdAt, updatedAt: article.updatedAt,
      wordCount: plainText(article.contentHtml).length,
      liveViews: viewsByPath[`/articles/${article.slug}`] ?? 0,
    })),
    ...context.pages.map((page) => ({
      id: page.id, kind: 'page', title: page.title, slug: page.slug,
      status: page.status, category: '—',
      views: 0, createdAt: page.createdAt, updatedAt: page.updatedAt,
      wordCount: plainText(page.contentHtml).length,
      liveViews: viewsByPath[`/pages/${page.slug}`] ?? 0,
    })),
  ];

  const monthAgo = Date.now() - 30 * DAY_MS;
  const sixMonths = Date.now() - 180 * DAY_MS;
  const ranked = [...items].sort((a, b) => (b.views + b.liveViews) - (a.views + a.liveViews));

  const half = Math.max(1, Math.floor(context.resolved.days / 2));
  const splitAt = context.resolved.start + half * DAY_MS;
  const firstHalf = byKey(context.events.filter((event) => event.type === 'page_view' && event.ts < splitAt), (event) => event.path);
  const secondHalf = byKey(context.events.filter((event) => event.type === 'page_view' && event.ts >= splitAt), (event) => event.path);
  const trafficFor = (item) => ({ before: firstHalf[`/articles/${item.slug}`] ?? 0, after: secondHalf[`/articles/${item.slug}`] ?? 0 });

  const growing = items
    .map((item) => ({ ...item, ...trafficFor(item), delta: deltaOf(trafficFor(item).after, trafficFor(item).before) }))
    .filter((item) => item.delta !== null && item.delta >= 25 && item.before >= 2)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 8);

  const declining = items
    .map((item) => ({ ...item, ...trafficFor(item), delta: deltaOf(trafficFor(item).after, trafficFor(item).before) }))
    .filter((item) => item.delta !== null && item.delta <= -25 && item.before >= 2)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 8);

  return {
    range: context.resolved,
    totals: {
      articles: context.articles.length,
      publishedArticles: context.articles.filter((article) => article.status === 'published').length,
      pages: context.pages.length,
      publishedPages: context.pages.filter((page) => page.status === 'published').length,
      media: context.media.length,
      banners: context.banners.length,
      tests: content.testBank?.questions ?? 0,
      flashcards: content.flashcards?.cards ?? 0,
      wikiPages: content.wiki?.entities ?? 0,
      knowledgeNodes: content.knowledge?.nodes ?? 0,
    },
    freshness: {
      newLast30: items.filter((item) => item.createdAt && new Date(item.createdAt).getTime() >= monthAgo).length,
      staleSixMonths: items.filter((item) => item.updatedAt && new Date(item.updatedAt).getTime() <= sixMonths).length,
      neverUpdated: items.filter((item) => item.createdAt === item.updatedAt).length,
      neverViewed: items.filter((item) => (item.views ?? 0) === 0 && item.liveViews === 0).length,
    },
    top: ranked.slice(0, 10),
    low: ranked.filter((item) => (item.views + item.liveViews) > 0).slice(-10).reverse(),
    zeroViews: items.filter((item) => (item.views ?? 0) === 0 && item.liveViews === 0).slice(0, 20),
    growing,
    declining,
    byCategory: Object.entries(byKey(context.articles, (article) => article.category))
      .map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    byKind: [
      { key: 'article', label: 'مقاله', count: context.articles.length },
      { key: 'page', label: 'صفحه', count: context.pages.length },
      { key: 'test', label: 'سؤال بانک تست', count: content.testBank?.questions ?? 0 },
      { key: 'flashcard', label: 'فلش‌کارت', count: content.flashcards?.cards ?? 0 },
      { key: 'wiki', label: 'موجودیت ویکی', count: content.wiki?.entities ?? 0 },
      { key: 'media', label: 'فایل رسانه', count: context.media.length },
    ],
    note: 'بازدید زنده از تلمتری مرورگر می‌آید و شمارندهٔ «views» از خود CMS؛ هر دو واقعی‌اند.',
  };
}

export { sessionStats };
