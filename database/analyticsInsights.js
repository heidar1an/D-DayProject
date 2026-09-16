/*
 * موتور تحلیل تپش — بخش‌های ۱۱ تا ۱۶ «مرکز تحلیل».
 *
 *  ۱۱. بازاریابی  |  ۱۲. سلامت سیستم  |  ۱۳. خطاها
 *  ۱۴. لحظه‌ای    |  ۱۵. هشدارها      |  ۱۶. تحلیل‌گر (AI Analyst)
 *
 * تحلیل‌گر این فایل «قاعده‌محور و آماری» است، نه یک مدل زبانی: رگرسیون خطی برای
 * روند و پیش‌بینی، امتیاز Z برای ناهنجاری، و نسبت‌سنجی برای ریشه‌یابی. همهٔ
 * یافته‌ها از حساب واقعی روی دادهٔ واقعی می‌آیند. اگر LLM_API_KEY تنظیم شود،
 * روایت متنی طبیعی هم اضافه می‌شود؛ بدون آن هم تحلیل کامل کار می‌کند.
 */

import {
  ALERT_METRICS,
  listAlerts,
  requestMetrics,
  sourceMap,
  systemMetrics,
} from './analyticsStore.js';
import { sessionStats } from './contentStore.js';
import {
  DAY_MS,
  average,
  buildDailySeries,
  byKey,
  collectIssues,
  deltaOf,
  detectAnomalies,
  forecast,
  kpi,
  linearFit,
  pct,
  round,
  sessionize,
  sum,
  unique,
} from './analyticsEngine.js';

/* ───────────────────────────── ۱۱. تحلیل بازاریابی ───────────────────────────── */

const CHANNEL_LABELS = {
  organic: 'جست‌وجوی ارگانیک', direct: 'مستقیم', social: 'شبکه‌های اجتماعی',
  referral: 'ارجاعی', email: 'ایمیل', campaign: 'کمپین', other: 'سایر',
};

export function marketingSection(context) {
  const sessions = sessionize(context.events);
  const sessionIds = new Set(sessions.map((session) => session.sessionId));

  const campaigns = new Map();
  context.events.forEach((event) => {
    const key = event.campaign || '(بدون کمپین)';
    const current = campaigns.get(key) ?? {
      campaign: key, source: event.source, medium: event.medium || '—',
      sessions: new Set(), signups: 0, tests: 0, purchases: 0,
    };
    current.sessions.add(event.sessionId);
    if (event.type === 'signup') current.signups += 1;
    if (event.type === 'test_submit') current.tests += 1;
    if (event.type === 'purchase') current.purchases += 1;
    campaigns.set(key, current);
  });

  const rows = [...campaigns.values()].map((row) => ({
    campaign: row.campaign,
    source: row.source,
    sourceLabel: CHANNEL_LABELS[row.source] ?? row.source,
    medium: row.medium,
    sessions: row.sessions.size,
    signups: row.signups,
    tests: row.tests,
    purchases: row.purchases,
    conversion: pct(row.signups, row.sessions.size),
    ctr: null,      /* نیازمند Impression واقعی کمپین */
    cac: null,      /* نیازمند دادهٔ هزینهٔ کمپین */
    revenue: null,  /* نیازمند درگاه پرداخت */
    roas: null,
  })).sort((a, b) => b.sessions - a.sessions);

  const channels = Object.entries(byKey(sessions, (session) => session.source)).map(([key, count]) => {
    const list = sessions.filter((session) => session.source === key);
    const ids = new Set(list.map((session) => session.sessionId));
    const signups = context.events.filter((event) => event.type === 'signup' && ids.has(event.sessionId)).length;
    const purchases = context.events.filter((event) => event.type === 'purchase' && ids.has(event.sessionId)).length;
    return {
      key,
      label: CHANNEL_LABELS[key] ?? key,
      sessions: count,
      signups,
      purchases,
      conversion: pct(signups, count),
      revenue: null,
      share: pct(count, sessions.length),
    };
  }).sort((a, b) => b.sessions - a.sessions);

  const utmTracked = context.events.some((event) => event.campaign || event.medium);
  const declared = context.users.flatMap((user) => user.referralSources);

  return {
    range: context.resolved,
    campaigns: {
      connected: true,
      utmTracked,
      rows,
      note: utmTracked
        ? 'پارامترهای UTM از URL واقعی بازدیدها استخراج و ذخیره می‌شوند.'
        : 'هنوز بازدیدی با پارامتر UTM ثبت نشده است. با ورود از لینک‌های UTM دار، این جدول پر می‌شود.',
    },
    channels,
    declaredSources: Object.entries(declared.reduce((accumulator, key) => {
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {})).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    ads: {
      connected: context.sources.payment?.connected ?? false,
      requires: 'PAYMENT_PROVIDER + PAYMENT_API_KEY',
      note: 'CAC، ROAS و هزینهٔ جذب به دادهٔ هزینهٔ کمپین و درآمد نیاز دارد که هنوز وصل نیست.',
    },
    totals: {
      sessions: sessions.length,
      signups: sum(channels.map((channel) => channel.signups)),
      purchases: sum(channels.map((channel) => channel.purchases)),
      revenue: null,
      cost: null,
      trackedSessions: [...sessionIds].length,
    },
    questions: {
      mostUsers: channels[0] ?? null,
      mostPurchases: [...channels].sort((a, b) => b.purchases - a.purchases)[0] ?? null,
      mostRevenue: null,
    },
  };
}

/* ───────────────────────────── ۱۲. سلامت سیستم ───────────────────────────── */

export function systemSection(context) {
  const system = systemMetrics();
  const api = context.requests;
  const sessions = sessionStats();

  const statusOf = (value, warn, critical) => {
    if (value === null || value === undefined) return 'unknown';
    return value >= critical ? 'critical' : value >= warn ? 'warn' : 'healthy';
  };

  const checks = [
    { key: 'server', label: 'Server', status: 'healthy', detail: `فعال — ${Math.round(system.server.uptimeSeconds / 60)} دقیقه` },
    { key: 'database', label: 'Database', status: 'healthy', detail: `${system.database.collections.length} مجموعه · ${Math.round(system.database.sizeBytes / 1024)} کیلوبایت` },
    { key: 'api', label: 'API', status: api.errorRate >= 15 ? 'critical' : api.errorRate >= 5 ? 'warn' : 'healthy', detail: `نرخ خطا ${api.errorRate}٪` },
    { key: 'auth', label: 'Authentication', status: sessions.active > 0 ? 'healthy' : 'warn', detail: `${sessions.active} نشست فعال` },
    { key: 'storage', label: 'Storage', status: system.disk ? statusOf(system.disk.usedPercent, 75, 90) : 'unknown', detail: system.disk ? `${system.disk.usedPercent}٪ مصرف` : 'در دسترس نیست' },
    { key: 'cpu', label: 'CPU', status: statusOf(system.cpu.usedPercent, 70, 90), detail: `${system.cpu.usedPercent}٪ از ${system.cpu.cores} هسته` },
    {
      key: 'ram',
      label: 'RAM',
      /* سنجهٔ قابل اقدام: سهم همین فرایند (نه freemem سیستم که در macOS گمراه‌کننده است) */
      status: statusOf(system.memory.processRssBytes / 1e9, 1.5, 3),
      detail: `${round(system.memory.processRssBytes / 1048576, 0)} مگابایت فرایند · ${system.memory.usedPercent}٪ سیستم`,
    },
    { key: 'disk', label: 'Disk', status: system.disk ? statusOf(system.disk.usedPercent, 75, 90) : 'unknown', detail: system.disk ? `${system.disk.usedPercent}٪` : 'در دسترس نیست' },
    { key: 'errors', label: 'Error Rate', status: api.errorRate >= 15 ? 'critical' : api.errorRate >= 5 ? 'warn' : 'healthy', detail: `${api.errorRate}٪` },
    { key: 'response', label: 'Response Time', status: statusOf(api.averageMs, 500, 1200), detail: api.averageMs === null ? 'بدون نمونه' : `${api.averageMs} میلی‌ثانیه` },
  ];

  const healthy = checks.filter((check) => check.status === 'healthy').length;
  const overall = checks.some((check) => check.status === 'critical')
    ? 'critical'
    : checks.some((check) => check.status === 'warn') ? 'warn' : 'healthy';

  return {
    range: context.resolved,
    overall,
    score: Math.round((healthy / checks.length) * 100),
    checks,
    system,
    sessions,
    requests: {
      total: api.total, errorRate: api.errorRate, averageMs: api.averageMs,
      p95Ms: api.p95Ms, byStatus: api.byStatus, minutes: api.minutes,
      rpm: api.rpm, uptimeSeconds: api.uptimeSeconds, startedAt: api.startedAt,
    },
    monitoring: {
      connected: context.sources.monitoring?.connected ?? false,
      requires: 'MONITORING_API_URL + MONITORING_API_KEY',
      note: 'این سنجه‌ها مستقیم از فرایند همین سرور خوانده می‌شوند (node:os). برای تاریخچهٔ بلندمدت، یک سرویس مانیتورینگ بیرونی لازم است.',
    },
  };
}

/* ───────────────────────────── ۱۳. مانیتورینگ خطا ───────────────────────────── */

export function errorsSection(context) {
  const events = context.events.filter((event) => event.type === 'js_error' || event.type === 'api_error');
  const previous = context.previousEvents.filter((event) => event.type === 'js_error' || event.type === 'api_error');

  const grouped = new Map();
  events.forEach((event) => {
    const message = event.meta?.message || event.title || (event.type === 'api_error' ? `پاسخ ${event.value}` : 'خطای نامشخص');
    const key = `${event.type}::${message}`;

    const current = grouped.get(key) ?? {
      key,
      type: event.type,
      message: String(message).slice(0, 200),
      count: 0,
      firstSeen: event.ts,
      lastSeen: event.ts,
      paths: new Set(),
      browsers: new Set(),
      systems: new Set(),
      userIds: new Set(),
      resolved: false,
      stack: event.meta?.stack ? String(event.meta.stack).slice(0, 1200) : null,
      status: event.value ?? null,
    };

    current.count += 1;
    current.firstSeen = Math.min(current.firstSeen, event.ts);
    current.lastSeen = Math.max(current.lastSeen, event.ts);
    current.paths.add(event.path);
    current.browsers.add(event.browser);
    current.systems.add(event.os);
    if (event.userId) current.userIds.add(event.userId);
    if (!current.stack && event.meta?.stack) current.stack = String(event.meta.stack).slice(0, 1200);
    grouped.set(key, current);
  });

  const groups = [...grouped.values()].map((group) => ({
    key: group.key,
    type: group.type,
    message: group.message,
    count: group.count,
    firstSeen: new Date(group.firstSeen).toISOString(),
    lastSeen: new Date(group.lastSeen).toISOString(),
    paths: [...group.paths].slice(0, 6),
    browsers: [...group.browsers].slice(0, 5),
    systems: [...group.systems].slice(0, 5),
    userCount: group.userIds.size,
    resolved: group.resolved,
    stack: group.stack,
    status: group.status,
  })).sort((a, b) => b.count - a.count);

  const api = context.requests;

  return {
    range: context.resolved,
    kpis: [
      kpi({ key: 'total', label: 'کل خطاها', value: events.length, previous: previous.length, direction: 'lower', hint: 'خطاهای Frontend و API ثبت‌شده در بازه.' }),
      kpi({ key: 'js', label: 'JavaScript Errors', value: events.filter((event) => event.type === 'js_error').length, previous: null, direction: 'lower', hint: 'خطاهای اجرای کد در مرورگر کاربران.' }),
      kpi({ key: 'api', label: 'API / Server Errors', value: events.filter((event) => event.type === 'api_error').length, previous: null, direction: 'lower', hint: 'پاسخ‌های ۵xx سرور.' }),
      kpi({ key: 'e404', label: '404', value: null, previous: null, available: false, hint: 'ردیابی 404 مسیرهای سایت به لاگ دسترسی وب‌سرور نیاز دارد.' }),
      kpi({ key: 'e403', label: '403', value: null, previous: null, available: false, hint: 'رد دسترسی (۴۰۳) در پاسخ‌های سایت؛ فقط خطاهای API در دسترس است.' }),
      kpi({ key: 'e500', label: '500', value: api.byStatus['5xx'] ?? 0, previous: null, direction: 'lower', hint: 'خطاهای داخلی سرور در همین پروسه.' }),
      kpi({ key: 'groups', label: 'خطاهای یکتا', value: groups.length, previous: null, direction: 'lower', hint: 'تعداد خطاهای متمایز پس از گروه‌بندی.' }),
    ],
    groups,
    serverErrors: api.serverErrors,
    statusDistribution: api.byStatus,
    note: 'برای هر خطا: تعداد وقوع، اولین و آخرین وقوع، مسیر، مرورگر، سیستم‌عامل و تعداد کاربر. Stack Trace فقط در حدی که مرورگر اجازه داده ذخیره می‌شود.',
  };
}

/* ───────────────────────────── ۱۴. مانیتورینگ لحظه‌ای ───────────────────────────── */

export function realtimeSection(context) {
  const now = Date.now();
  const windowMs = 5 * 60_000;
  const recent = context.allEvents.filter((event) => event.ts >= now - windowMs);

  const sessions = new Map();
  recent.forEach((event) => {
    const current = sessions.get(event.sessionId) ?? {
      sessionId: event.sessionId, userId: event.userId, last: 0,
      pages: new Set(), device: event.device, source: event.source,
    };
    current.last = Math.max(current.last, event.ts);
    current.pages.add(event.path);
    if (event.userId) current.userId = event.userId;
    sessions.set(event.sessionId, current);
  });

  const activePages = new Map();
  recent.filter((event) => event.type === 'page_view').forEach((event) => {
    const current = activePages.get(event.path) ?? { path: event.path, viewers: new Set(), views: 0 };
    current.viewers.add(event.sessionId);
    current.views += 1;
    activePages.set(event.path, current);
  });

  const api = requestMetrics();
  const system = systemMetrics();
  const lastMinute = api.minutes.at(-1) ?? { count: 0, errors: 0 };

  return {
    generatedAt: new Date(now).toISOString(),
    windowSeconds: windowMs / 1000,
    onlineUsers: unique([...sessions.values()].map((session) => session.userId ?? session.sessionId)).size,
    onlineSessions: sessions.size,
    pages: [...activePages.values()]
      .map((page) => ({ path: page.path, viewers: page.viewers.size, views: page.views }))
      .sort((a, b) => b.viewers - a.viewers)
      .slice(0, 12),
    signups: recent.filter((event) => event.type === 'signup').length,
    purchases: recent.filter((event) => event.type === 'purchase').length,
    testsInProgress: recent.filter((event) => event.type === 'test_start').length,
    testsCompleted: recent.filter((event) => event.type === 'test_submit').length,
    errors: recent.filter((event) => event.type === 'js_error' || event.type === 'api_error').length,
    requests: {
      rpm: api.rpm,
      lastMinute: lastMinute.count,
      errorsLastMinute: lastMinute.errors,
      total: api.total,
      errorRate: api.errorRate,
    },
    feed: context.allEvents.slice(0, 25).map((event) => ({
      id: event.id,
      type: event.type,
      ts: event.ts,
      path: event.path,
      device: event.device,
      source: event.source,
      sessionId: event.sessionId,
    })),
    server: {
      status: api.errorRate >= 15 ? 'critical' : api.errorRate >= 5 ? 'warn' : 'healthy',
      uptimeSeconds: system.server.uptimeSeconds,
      cpuPercent: system.cpu.usedPercent,
      memoryPercent: system.memory.usedPercent,
      processRssMb: Math.round(system.memory.processRssBytes / 1048576),
    },
    transport: {
      mode: 'polling',
      intervalSeconds: 10,
      note: 'بدون WebSocket و بدون وابستگی جدید؛ پنل هر ۱۰ ثانیه همین endpoint را می‌خواند. برای جریان پیوسته می‌توان بعداً SSE/WebSocket جای آن گذاشت.',
    },
    empty: recent.length === 0,
  };
}

/* ───────────────────────────── ۱۵. هشدارها ───────────────────────────── */

function metricValue(metric, context, series) {
  switch (metric) {
    case 'page_views':
      return sum(series.map((point) => point.pageViews));
    case 'signups':
      return sum(series.map((point) => point.signups)) || context.users.filter((user) => {
        const ts = new Date(user.createdAt).getTime();
        return ts >= context.resolved.start && ts <= context.resolved.end;
      }).length;
    case 'test_submits':
      return context.events.filter((event) => event.type === 'test_submit').length;
    case 'error_rate':
      return context.requests.errorRate;
    case 'failed_logins':
      return context.activity.filter((entry) => entry.action === 'auth.login-failed').length;
    case 'server_latency':
      return context.requests.averageMs;
    case 'memory':
      return systemMetrics().memory.processUsedPercent;
    case 'disk':
      return systemMetrics().disk?.usedPercent ?? null;
    case 'lcp': {
      const samples = context.events
        .filter((event) => event.type === 'cwv' && event.metric === 'LCP')
        .map((event) => Number(event.value))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      return samples.length ? samples[Math.floor(samples.length * 0.75)] : null;
    }
    default:
      return null;
  }
}

export function alertsSection(context) {
  const series = buildDailySeries(context);
  const half = Math.max(1, Math.floor(series.length / 2));
  const firstHalf = series.slice(0, half);
  const secondHalf = series.slice(half);

  const before = sum(firstHalf.map((point) => point.pageViews));
  const after = sum(secondHalf.map((point) => point.pageViews));
  const trend = deltaOf(after, before);

  const alerts = listAlerts().map((alert) => {
    const metric = ALERT_METRICS.find((item) => item.id === alert.metric);
    const value = metricValue(alert.metric, context, series);
    const available = Boolean(metric?.available) && value !== null;

    let triggered = false;
    let description = '';

    if (available) {
      switch (alert.comparator) {
        case 'above':
          triggered = value > alert.threshold;
          description = `مقدار فعلی ${round(value, 1)} در برابر آستانهٔ ${alert.threshold}`;
          break;
        case 'below':
          triggered = value < alert.threshold;
          description = `مقدار فعلی ${round(value, 1)} در برابر آستانهٔ ${alert.threshold}`;
          break;
        case 'drop':
          triggered = trend !== null && trend <= -Math.abs(alert.threshold);
          description = `تغییر نیمهٔ دوم بازه نسبت به نیمهٔ اول: ${trend ?? '—'}٪`;
          break;
        case 'rise':
          triggered = trend !== null && trend >= Math.abs(alert.threshold);
          description = `تغییر نیمهٔ دوم بازه نسبت به نیمهٔ اول: ${trend ?? '—'}٪`;
          break;
        default:
          triggered = false;
      }
    }

    return {
      ...alert,
      metricLabel: metric?.label ?? alert.metric,
      unit: metric?.unit ?? '',
      available,
      requires: metric?.requires ?? null,
      currentValue: available ? round(value, 1) : null,
      trend,
      triggered,
      description,
    };
  });

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = alerts.sort((a, b) => (Number(b.triggered) - Number(a.triggered)) || (order[a.severity] - order[b.severity]));

  return {
    range: context.resolved,
    alerts: sorted,
    metrics: ALERT_METRICS,
    triggered: sorted.filter((alert) => alert.triggered).length,
    active: sorted.filter((alert) => alert.enabled).length,
    unavailable: sorted.filter((alert) => !alert.available).length,
    notifications: {
      connected: context.sources.notifications?.connected ?? false,
      requires: 'ALERT_WEBHOOK_URL یا ALERT_TELEGRAM_TOKEN',
      channels: [
        { id: 'panel', label: 'پنل مدیریت', connected: true, requires: null },
        { id: 'email', label: 'ایمیل', connected: false, requires: 'SMTP یا ALERT_WEBHOOK_URL' },
        { id: 'telegram', label: 'تلگرام', connected: context.sources.notifications?.connected ?? false, requires: 'ALERT_TELEGRAM_TOKEN + ALERT_TELEGRAM_CHAT' },
        { id: 'webhook', label: 'Webhook', connected: context.sources.notifications?.connected ?? false, requires: 'ALERT_WEBHOOK_URL' },
      ],
    },
  };
}

/* ───────────────────────────── ۱۶. تحلیل‌گر ───────────────────────────── */

export function aiSection(context) {
  const series = buildDailySeries(context);
  const sessions = sessionize(context.events);
  const findings = [];
  const add = (finding) => findings.push({ id: `f-${findings.length}`, ...finding });

  /* ── روند: رگرسیون خطی روی سری روزانهٔ واقعی ── */
  const tracked = [
    { key: 'pageViews', label: 'بازدید صفحات' },
    { key: 'sessions', label: 'نشست‌ها' },
    { key: 'signups', label: 'ثبت‌نام' },
    { key: 'tests', label: 'تست‌های انجام‌شده' },
    { key: 'newUsers', label: 'کاربران جدید' },
  ];

  const trends = tracked.map((item) => {
    const values = series.map((point) => Number(point[item.key]) || 0);
    const fit = linearFit(values);
    return {
      ...item,
      total: sum(values),
      slope: round(fit.slope, 3),
      r2: fit.r2,
      direction: fit.slope > 0.05 ? 'up' : fit.slope < -0.05 ? 'down' : 'flat',
      strength: Math.abs(fit.r2) >= 0.5 ? 'strong' : Math.abs(fit.r2) >= 0.25 ? 'moderate' : 'weak',
    };
  });

  trends
    .filter((trend) => trend.total > 0 && trend.direction !== 'flat' && trend.strength !== 'weak')
    .forEach((trend) => {
      add({
        category: 'trend',
        severity: trend.direction === 'down' ? 'medium' : 'low',
        title: `روند ${trend.direction === 'up' ? 'صعودی' : 'نزولی'} در «${trend.label}»`,
        statement: `شاخص «${trend.label}» در این بازه شیب روزانهٔ ${trend.slope > 0 ? '+' : ''}${trend.slope} دارد (R² = ${trend.r2}). مجموع بازه ${trend.total}.`,
        evidence: [`شیب روزانه: ${trend.slope}`, `ضریب تعیین: ${trend.r2}`, `مجموع بازه: ${trend.total}`],
        cause: trend.direction === 'down' ? 'کاهش تدریجی و پیوسته، نه یک افت لحظه‌ای' : 'رشد پیوستهٔ شاخص',
        confidence: trend.strength === 'strong' ? 'بالا' : 'متوسط',
        impact: trend.direction === 'down' ? 'کاهش پایدار در صورت ادامهٔ روند' : 'رشد پایدار',
        action: trend.direction === 'down'
          ? `علت افت «${trend.label}» را در بخش ترافیک و منابع ورود بررسی کنید.`
          : `عامل رشد «${trend.label}» را شناسایی و تقویت کنید.`,
        priority: trend.direction === 'down' ? 'high' : 'low',
      });
    });

  /* ── ناهنجاری ── */
  const anomalies = detectAnomalies(series.map((point) => ({ key: point.key, value: point.pageViews })), { threshold: 2 });
  anomalies.slice(0, 4).forEach((point) => {
    add({
      category: 'anomaly',
      severity: point.direction === 'drop' ? 'high' : 'low',
      title: `${point.direction === 'drop' ? 'افت' : 'جهش'} غیرعادی بازدید در ${point.key}`,
      statement: `بازدید روز ${point.key} با ${point.value} بازدید، ${point.direction === 'drop' ? 'کمتر' : 'بیشتر'} از الگوی معمول بازه بوده است (امتیاز Z = ${point.z}).`,
      evidence: [`امتیاز Z: ${point.z}`, `مقدار: ${point.value}`, `میانگین بازه: ${round(average(series.map((p) => p.pageViews)), 1)}`],
      cause: 'انحراف معنادار از میانگین — نیازمند بررسی علت همان روز',
      confidence: 'متوسط',
      impact: 'نوسان غیرمنتظره در ترافیک',
      action: 'رویدادهای همان روز (خطا، انتشار محتوا، کمپین) را بررسی کنید.',
      priority: point.direction === 'drop' ? 'high' : 'low',
    });
  });

  /* ── ریشه‌یابی افت ترافیک: تفکیک منبع ورود و صفحه ── */
  const half = Math.max(1, Math.floor(series.length / 2));
  const splitAt = context.resolved.start + half * DAY_MS;
  const trafficChange = deltaOf(
    sum(series.slice(half).map((point) => point.pageViews)),
    sum(series.slice(0, half).map((point) => point.pageViews)),
  );

  let rootCause = null;
  if (trafficChange !== null && trafficChange <= -15) {
    const early = sessions.filter((session) => session.start < splitAt);
    const late = sessions.filter((session) => session.start >= splitAt);
    const earlySources = byKey(early, (session) => session.source);
    const lateSources = byKey(late, (session) => session.source);

    const sourceDeltas = Object.keys({ ...earlySources, ...lateSources })
      .map((key) => ({
        key,
        label: CHANNEL_LABELS[key] ?? key,
        before: earlySources[key] ?? 0,
        after: lateSources[key] ?? 0,
        delta: deltaOf(lateSources[key] ?? 0, earlySources[key] ?? 0),
      }))
      .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

    const worstSource = sourceDeltas.find((item) => item.delta !== null && item.delta < 0) ?? null;

    const earlyPages = byKey(
      context.events.filter((event) => event.type === 'page_view' && event.ts < splitAt),
      (event) => event.path,
    );
    const latePages = byKey(
      context.events.filter((event) => event.type === 'page_view' && event.ts >= splitAt),
      (event) => event.path,
    );
    const worstPage = Object.keys(earlyPages)
      .map((path) => ({ path, before: earlyPages[path], after: latePages[path] ?? 0, delta: deltaOf(latePages[path] ?? 0, earlyPages[path]) }))
      .filter((item) => item.delta !== null && item.before >= 3)
      .sort((a, b) => a.delta - b.delta)[0] ?? null;

    /* آیا افت هم‌زمان با خطا بوده است؟ */
    const earlyErrors = context.events.filter((event) => event.ts < splitAt && (event.type === 'js_error' || event.type === 'api_error')).length;
    const lateErrors = context.events.filter((event) => event.ts >= splitAt && (event.type === 'js_error' || event.type === 'api_error')).length;

    const causes = [];
    if (worstSource && worstSource.delta <= -20) {
      causes.push(`افت منبع «${worstSource.label}» (${worstSource.before} → ${worstSource.after}، ${worstSource.delta}٪)`);
    }
    if (worstPage && worstPage.delta <= -30) {
      causes.push(`افت صفحهٔ ${worstPage.path} (${worstPage.before} → ${worstPage.after}، ${worstPage.delta}٪)`);
    }
    if (lateErrors > earlyErrors && lateErrors > 0) {
      causes.push(`افزایش خطاها هم‌زمان با افت (${earlyErrors} → ${lateErrors})`);
    }
    if (!context.sources['search-console']?.connected) {
      causes.push('برای تأیید نقش سئو، اتصال Google Search Console لازم است');
    }

    rootCause = {
      trafficChange,
      sources: sourceDeltas,
      page: worstPage,
      errors: { early: earlyErrors, late: lateErrors },
      causes,
    };

    add({
      category: 'root-cause',
      severity: trafficChange <= -40 ? 'critical' : 'high',
      title: `افت ${Math.abs(trafficChange)}٪ ترافیک در نیمهٔ دوم بازه`,
      statement: `بازدید نیمهٔ دوم بازه ${Math.abs(trafficChange)}٪ کمتر از نیمهٔ اول است.${causes.length ? ` محتمل‌ترین عوامل: ${causes.join('؛ ')}.` : ''}`,
      evidence: [
        `تغییر ترافیک: ${trafficChange}٪`,
        ...(worstSource ? [`ضعیف‌ترین منبع: ${worstSource.label} (${worstSource.delta}٪)`] : []),
        ...(worstPage ? [`ضعیف‌ترین صفحه: ${worstPage.path} (${worstPage.delta}٪)`] : []),
        `خطاها: ${earlyErrors} → ${lateErrors}`,
      ],
      cause: causes.length ? causes.join('؛ ') : 'علت با دادهٔ موجود قطعی نشد',
      confidence: causes.length >= 2 ? 'بالا' : 'متوسط',
      impact: 'کاهش مستقیم بازدید، ثبت‌نام و درآمد',
      action: 'منبع و صفحهٔ ضعیف را در بخش ترافیک بررسی و برای همان‌ها اقدام اصلاحی تعریف کنید.',
      priority: 'critical',
    });
  }

  /* ── قیف: ریشه‌یابی افت تبدیل ── */
  const signups = context.events.filter((event) => event.type === 'signup').length;
  const tests = context.events.filter((event) => event.type === 'test_submit').length;
  const sessionsCount = sessions.length;
  const conversion = pct(signups || tests, sessionsCount);
  const previousConversion = pct(
    context.previousEvents.filter((event) => event.type === 'signup').length
      || context.previousEvents.filter((event) => event.type === 'test_submit').length,
    sessionize(context.previousEvents).length,
  );

  if (signups > 0 && tests === 0 && sessionsCount > 5) {
    add({
      category: 'funnel',
      severity: 'high',
      title: 'ثبت‌نام هست اما استفاده از محصول نیست',
      statement: `${signups} ثبت‌نام در بازه دیده می‌شود اما هیچ تستی ثبت نشده است؛ گلوگاه در مرحلهٔ «ثبت‌نام → شروع مطالعه» است.`,
      evidence: [`ثبت‌نام: ${signups}`, `تست: 0`, `نشست: ${sessionsCount}`],
      cause: 'اصطکاک در مسیر ورود به محصول یا نبود تلمتری مراحل بعدی',
      impact: 'کاربران جذب می‌شوند ولی ارزش دریافت نمی‌کنند',
      action: 'مسیر بعد از ثبت‌نام را بررسی کنید و تلمتری مراحل مطالعه/تست را فعال کنید.',
      priority: 'high',
    });
  }

  /* ── مشکلات جمع‌آوری‌شده (همان منبع خلاصهٔ مدیریتی) ── */
  const issues = collectIssues(context, { kpis: [], series });
  issues.forEach((issue) => {
    add({
      category: 'issue',
      severity: issue.severity,
      title: issue.title,
      statement: issue.evidence || issue.title,
      evidence: [issue.evidence].filter(Boolean),
      cause: issue.cause,
      confidence: 'بالا',
      impact: issue.impact,
      action: issue.action,
      priority: issue.severity,
    });
  });

  /* ── پیش‌بینی ── */
  const forecastSource = series.map((point) => Number(point.pageViews) || 0);
  const trafficForecast = forecastSource.length >= 3 ? forecast(forecastSource, 7) : { projection: [], slope: 0, r2: 0 };
  const signupForecastSource = series.map((point) => Number(point.signups) || 0);
  const signupForecast = signupForecastSource.some((value) => value > 0) && signupForecastSource.length >= 3
    ? forecast(signupForecastSource, 7)
    : { projection: [], slope: 0, r2: 0 };

  /* ── اولویت‌بندی نهایی ── */
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const priorityOf = (finding) => finding.priority ?? finding.severity ?? 'low';
  const sorted = [...findings].sort((a, b) => order[priorityOf(a)] - order[priorityOf(b)]);

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  sorted.forEach((finding) => { counts[priorityOf(finding)] += 1; });

  const llm = sourceMap().llm;

  return {
    range: context.resolved,
    engine: {
      kind: 'rule-based-statistical',
      note: 'این تحلیلگر با رگرسیون خطی، امتیاز Z و نسبت‌سنجی روی دادهٔ واقعی کار می‌کند — نه تولید متن. بنابراین یافته‌هایش قابل بازتولید و قابل اتکاست.',
      llm: {
        connected: llm?.connected ?? false,
        requires: 'LLM_API_KEY',
        note: llm?.connected
          ? 'روایت متنی طبیعی هم فعال است.'
          : 'برای افزودن روایت متنی طبیعی، LLM_API_KEY را تنظیم کنید. تحلیل فعلی بدون آن هم کامل است.',
      },
    },
    findings: sorted,
    counts,
    trends,
    anomalies,
    rootCause,
    forecast: {
      traffic: trafficForecast,
      signups: signupForecast,
      horizonDays: 7,
      history: series.map((point) => ({ key: point.key, value: point.pageViews })),
      note: trafficForecast.projection.length
        ? 'پیش‌بینی بر پایهٔ برازش خطی روی سری روزانهٔ واقعی؛ بازهٔ اطمینان از پراکندگی باقی‌مانده‌ها محاسبه شده است.'
        : 'برای پیش‌بینی به حداقل ۳ روز داده نیاز است.',
    },
    recommendations: sorted
      .filter((finding) => finding.action)
      .slice(0, 8)
      .map((finding, index) => ({
        rank: index + 1,
        title: finding.title,
        action: finding.action,
        priority: priorityOf(finding),
        category: finding.category,
      })),
    summary: {
      headline: counts.critical > 0
        ? `${counts.critical} مشکل بحرانی و ${counts.high} مشکل مهم نیازمند اقدام است.`
        : counts.high > 0
          ? `${counts.high} مشکل مهم نیازمند بررسی است.`
          : sorted.length
            ? 'مشکل بحرانی‌ای یافت نشد؛ چند مورد با اولویت پایین ثبت شده است.'
            : 'دادهٔ کافی برای یافتن مشکل وجود ندارد.',
      conversion,
      previousConversion,
      conversionDelta: deltaOf(conversion, previousConversion),
    },
    dataQuality: {
      events: context.events.length,
      days: series.length,
      sessions: sessionsCount,
      sufficient: context.events.length >= 50 && series.length >= 3,
    },
  };
}
