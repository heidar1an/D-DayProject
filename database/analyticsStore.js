/*
 * انبار تحلیل تپش — لایهٔ دادهٔ «مرکز تحلیل».
 *
 * دقیقاً همان الگوی موجود پروژه (`contentStore.js`): فایل JSON روی دیسک + توابع
 * دامنهٔ خالص، بدون هیچ وابستگی بیرونی. با مهاجرت به یک Backend واقعی فقط بدنهٔ
 * همین توابع به کوئری دیتابیس تبدیل می‌شود، نه UI و نه API.
 *
 * ── اصل حاکم بر این فایل: هیچ دادهٔ ساختگی‌ای تولید نمی‌شود. ──
 * هر عددی که این لایه برمی‌گرداند از یکی از این منابع واقعی می‌آید:
 *   ۱. رویدادهای واقعی سایت (`content/events.json`) که با beacon از مرورگر می‌آیند
 *   ۲. گزارش رویدادهای پنل (`content/activity.json`) — همان Audit Log
 *   ۳. کاربران واقعی سایت (`database/users.json`)
 *   ۴. محتوای واقعی CMS (`content/articles|pages|media|banners.json`)
 *   ۵. محتوای واقعی محصول (فایل‌های mockData و graphData در src/services) — بانک تست، ویکی، فلش‌کارت، شبکه دانش
 *   ۶. سنجه‌های واقعی فرایند سرور (`node:os` + `node:fs`)
 *   ۷. شمارنده‌های واقعی درخواست‌های HTTP که همین سرور ثبت می‌کند
 * اگر منبعی وصل نباشد (مثل Google Search Console یا درگاه پرداخت)، تابع مربوطه
 * `connected: false` برمی‌گرداند و UI وضعیت «نیازمند اتصال» را نشان می‌دهد؛
 * هرگز مقدار جعلی جای آن نمی‌گذارد.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { statfsSync } from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentDir, logActivity, readCollection, readSettings, writeCollection } from './contentStore.js';
import { readUsers } from './usersStore.js';

const projectRoot = resolve(fileURLToPath(import.meta.url), '..', '..');

/* ───────────────────────────── محدوده‌های زمانی ───────────────────────────── */

export const RANGES = [
  { key: 'today', label: 'امروز', days: 1 },
  { key: '7d', label: '۷ روز اخیر', days: 7 },
  { key: '30d', label: '۳۰ روز اخیر', days: 30 },
  { key: '90d', label: '۹۰ روز اخیر', days: 90 },
  { key: 'ytd', label: 'امسال', days: null },
  { key: 'custom', label: 'بازهٔ سفارشی', days: null },
];

export const startOfDay = (value = Date.now()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const dayKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const DAY_MS = 86_400_000;

/*
 * بازهٔ جاری + بازهٔ قبلی هم‌طول (برای دلتای KPIها).
 * مرزها روی «شروع روز» بسته می‌شوند تا روز اول فقط بخشی از داده را نبیند.
 */
export function resolveRange({ range = '30d', from = null, to = null } = {}) {
  const now = Date.now();
  const today = startOfDay(now);
  let start;
  let end = today + DAY_MS - 1;

  if (range === 'custom' && from) {
    start = startOfDay(new Date(from).getTime());
    end = to ? startOfDay(new Date(to).getTime()) + DAY_MS - 1 : end;
  } else if (range === 'ytd') {
    const first = new Date(now);
    first.setMonth(0, 1);
    start = startOfDay(first.getTime());
  } else {
    const days = RANGES.find((item) => item.key === range)?.days ?? 30;
    start = today - (days - 1) * DAY_MS;
  }

  const span = end - start + 1;
  return {
    key: range,
    start,
    end,
    days: Math.max(1, Math.round(span / DAY_MS)),
    previous: { start: start - span, end: start - 1 },
  };
}

/* ─────────────────────────── رویدادهای سایت (Events) ───────────────────────────
 * شکل رویداد (قرارداد پایدار با beacon کلاینت):
 *   { type, ts, sessionId, userId, path, title, referrer, source, medium, campaign,
 *     device, browser, os, locale, value, meta }
 * مجموعهٔ تایپ‌ها: page_view | session_start | signup | login | logout
 *   | article_read | lesson_view | wiki_view | test_start | test_submit
 *   | flashcard_review | feature_use | search | cwv | js_error | api_error | purchase
 */

const EVENTS_COLLECTION = 'events';
const EVENTS_LIMIT = 20_000;
const EVENT_TYPES = new Set([
  'page_view', 'session_start', 'signup', 'login', 'logout',
  'article_read', 'lesson_view', 'wiki_view', 'test_start', 'test_submit',
  'flashcard_review', 'feature_use', 'search', 'cwv', 'js_error', 'api_error', 'purchase',
]);

const str = (value, max = 200) => String(value ?? '').slice(0, max);
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

/* تشخیص دستگاه/مرورگر/سیستم‌عامل از User-Agent واقعی — بدون وابستگی بیرونی */
export function parseUserAgent(ua = '') {
  const agent = String(ua);
  const isTablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(agent);
  const isMobile = !isTablet && /Mobile|iPhone|iPod|Android|Windows Phone/i.test(agent);
  const isBot = /bot|crawler|spider|crawling|headless/i.test(agent);

  let browser = 'سایر';
  if (/Edg\//i.test(agent)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(agent)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(agent)) browser = 'Samsung Internet';
  else if (/Firefox\//i.test(agent)) browser = 'Firefox';
  else if (/Chrome\//i.test(agent)) browser = 'Chrome';
  else if (/Safari\//i.test(agent)) browser = 'Safari';

  let system = 'سایر';
  if (/Windows/i.test(agent)) system = 'Windows';
  else if (/Android/i.test(agent)) system = 'Android';
  else if (/iPhone|iPad|iPod/i.test(agent)) system = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(agent)) system = 'macOS';
  else if (/Linux/i.test(agent)) system = 'Linux';

  return { device: isBot ? 'bot' : isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop', browser, os: system };
}

/* دسته‌بندی منبع ورود از referrer + پارامترهای UTM */
export function classifySource({ referrer = '', medium = '', campaign = '' } = {}) {
  const mediumKey = String(medium).toLowerCase();
  if (mediumKey === 'email' || /mail|newsletter/i.test(mediumKey)) return 'email';
  if (mediumKey === 'social' || /instagram|telegram|twitter|x\.com|facebook|linkedin|rubika|whatsapp/i.test(mediumKey)) return 'social';
  if (mediumKey === 'cpc' || mediumKey === 'paid' || mediumKey === 'ads' || campaign) return 'campaign';
  if (mediumKey === 'referral') return 'referral';

  if (!referrer) return 'direct';

  let host = '';
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return 'direct';
  }
  if (!host) return 'direct';
  if (/instagram|telegram|twitter|t\.co|x\.com|facebook|linkedin|rubika|whatsapp|youtube|aparat/i.test(host)) return 'social';
  if (/google|bing|yahoo|duckduckgo|yandex|baidu/i.test(host)) return 'organic';
  return 'referral';
}

export function normalizeEvent(input = {}) {
  const type = EVENT_TYPES.has(input.type) ? input.type : 'page_view';
  const ts = input.ts ? new Date(input.ts).getTime() : Date.now();
  const ua = parseUserAgent(input.userAgent ?? input.ua ?? '');

  return {
    id: input.id ? str(input.id, 60) : `ev-${ts.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    ts: Number.isFinite(ts) ? ts : Date.now(),
    sessionId: str(input.sessionId, 60) || 'anon',
    userId: str(input.userId, 80) || null,
    path: str(input.path, 300) || '/',
    title: str(input.title, 160),
    referrer: str(input.referrer, 300),
    source: input.source || classifySource({ referrer: input.referrer, medium: input.medium, campaign: input.campaign }),
    medium: str(input.medium, 40),
    campaign: str(input.campaign, 80),
    device: input.device || ua.device,
    browser: input.browser || ua.browser,
    os: input.os || ua.os,
    locale: str(input.locale, 20),
    value: num(input.value),
    metric: str(input.metric, 30) || null, /* برای cwv: LCP | INP | CLS | FCP | TTFB */
    meta: input.meta && typeof input.meta === 'object' ? input.meta : {},
  };
}

/* ثبت یک دسته رویداد — از beacon عمومی و از خود سرور صدا زده می‌شود */
export function recordEvents(list) {
  const incoming = (Array.isArray(list) ? list : [list]).map(normalizeEvent);
  if (!incoming.length) return { recorded: 0 };

  const existing = readCollection(EVENTS_COLLECTION);
  const cutoff = Date.now() - 180 * DAY_MS;
  const merged = [...incoming.reverse(), ...existing]
    .filter((event) => event.ts >= cutoff)
    .slice(0, EVENTS_LIMIT);

  writeCollection(EVENTS_COLLECTION, merged);
  return { recorded: incoming.length };
}

export function readEvents() {
  const value = readCollection(EVENTS_COLLECTION);
  return Array.isArray(value) ? value : [];
}

export function clearEvents() {
  writeCollection(EVENTS_COLLECTION, []);
  return { cleared: true };
}

/* ─────────────────────────── سنجه‌های درخواست HTTP ───────────────────────────
 * شمارندهٔ زندهٔ درخواست‌های همین سرور. در حافظهٔ پروسه نگه داشته می‌شود (سبک و
 * سریع) و خطاهای ۵xx به‌صورت رویداد پایدار هم ثبت می‌شوند تا از دست نروند.
 */

const REQUEST_LIMIT = 3000;
const requestLog = [];
const serverStartedAt = Date.now();
const serverErrors = [];
const SERVER_ERROR_LIMIT = 200;

export function recordApiRequest({ path = '/', method = 'GET', status = 200, durationMs = 0, error = null }) {
  const entry = {
    ts: Date.now(),
    path: str(path, 200),
    method: str(method, 10),
    status: Number(status) || 0,
    durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
  };

  requestLog.push(entry);
  if (requestLog.length > REQUEST_LIMIT) requestLog.splice(0, requestLog.length - REQUEST_LIMIT);

  if (entry.status >= 500) {
    serverErrors.unshift({ ...entry, message: str(error?.message, 300), code: str(error?.code, 40) });
    if (serverErrors.length > SERVER_ERROR_LIMIT) serverErrors.pop();

    /* خطاهای سرور به‌صورت رویداد پایدار هم ثبت می‌شوند تا در بخش «خطاها» بمانند */
    recordEvents([{
      type: 'api_error',
      path: entry.path,
      value: entry.status,
      meta: { method: entry.method, status: entry.status, code: str(error?.code, 40) },
    }]);
  }

  return entry;
}

export function requestMetrics() {
  const now = Date.now();
  const total = requestLog.length;
  const errors = requestLog.filter((item) => item.status >= 400).length;
  const serverErrorCount = requestLog.filter((item) => item.status >= 500).length;

  const latencies = requestLog.map((item) => item.durationMs).sort((a, b) => a - b);
  const percentile = (p) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))] : null);
  const average = latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;

  const byStatus = {};
  requestLog.forEach((item) => {
    const bucket = `${Math.floor(item.status / 100)}xx`;
    byStatus[bucket] = (byStatus[bucket] ?? 0) + 1;
  });

  const perPath = new Map();
  requestLog.forEach((item) => {
    const key = `${item.method} ${item.path}`;
    const current = perPath.get(key) ?? { path: item.path, method: item.method, count: 0, errors: 0, totalMs: 0, maxMs: 0 };
    current.count += 1;
    if (item.status >= 400) current.errors += 1;
    current.totalMs += item.durationMs;
    current.maxMs = Math.max(current.maxMs, item.durationMs);
    perPath.set(key, current);
  });

  const slowest = [...perPath.values()]
    .map((item) => ({ ...item, avgMs: Math.round(item.totalMs / item.count) }))
    .filter((item) => item.count >= 3)
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 8);

  const failing = [...perPath.values()]
    .map((item) => ({ ...item, avgMs: Math.round(item.totalMs / item.count) }))
    .filter((item) => item.errors > 0)
    .sort((a, b) => b.errors - a.errors)
    .slice(0, 8);

  /* سری دقیقه‌ای ۶۰ دقیقهٔ اخیر — برای «لحظه‌ای» و نمودار بار سرور */
  const minutes = [];
  for (let index = 59; index >= 0; index -= 1) {
    const from = now - index * 60_000;
    const bucket = requestLog.filter((item) => item.ts >= from - 60_000 && item.ts < from);
    minutes.push({
      key: new Date(from).toISOString().slice(11, 16),
      ts: from,
      count: bucket.length,
      errors: bucket.filter((item) => item.status >= 400).length,
    });
  }

  const lastMinute = requestLog.filter((item) => item.ts >= now - 60_000);

  return {
    total,
    errors,
    serverErrorCount,
    errorRate: total ? Math.round((errors / total) * 1000) / 10 : 0,
    averageMs: average,
    p50Ms: percentile(50),
    p95Ms: percentile(95),
    p99Ms: percentile(99),
    byStatus,
    slowest,
    failing,
    minutes,
    rpm: lastMinute.length,
    serverErrors: serverErrors.slice(0, 40),
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(serverStartedAt).toISOString(),
  };
}

/* ───────────────────────── ثبت ورود ناموفق (رویداد امنیتی) ───────────────────────── */

/*
 * محدودیت نرخ برای endpoint عمومی تلمتری. بدون آن، یک مهاجم می‌تواند با سیل
 * درخواست، فایل رویدادها را پر کند. نقض‌ها شمرده می‌شوند و در «مرکز امنیت»
 * به‌عنوان سنجهٔ واقعی نمایش داده می‌شوند.
 */
const collectHits = new Map();
const COLLECT_WINDOW_MS = 60_000;
const COLLECT_MAX = 120;
let rateLimitViolations = 0;
const rateLimitByIp = new Map();

export function allowCollect(ip) {
  const key = ip || 'unknown';
  const now = Date.now();
  const entry = collectHits.get(key);

  if (!entry || now - entry.start >= COLLECT_WINDOW_MS) {
    collectHits.set(key, { start: now, count: 1 });
    /* پاک‌سازی دوره‌ای کلیدهای قدیمی تا نقشه رشد نکند */
    if (collectHits.size > 500) {
      collectHits.forEach((value, mapKey) => {
        if (now - value.start >= COLLECT_WINDOW_MS) collectHits.delete(mapKey);
      });
    }
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > COLLECT_MAX) {
    rateLimitViolations += 1;
    rateLimitByIp.set(key, (rateLimitByIp.get(key) ?? 0) + 1);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((COLLECT_WINDOW_MS - (now - entry.start)) / 1000)) };
  }

  return { allowed: true };
}

export function rateLimitStats() {
  return {
    violations: rateLimitViolations,
    limit: COLLECT_MAX,
    windowSeconds: COLLECT_WINDOW_MS / 1000,
    topIps: [...rateLimitByIp.entries()].map(([ip, count]) => ({ ip, count })).sort((a, b) => b.count - a.count).slice(0, 8),
  };
}

export function recordFailedLogin({ username = '', ip = '', userAgent = '', reason = 'invalid-credentials' }) {
  logActivity({
    admin: null,
    action: 'auth.login-failed',
    entityType: 'admin',
    entityId: '',
    entityLabel: str(username, 80) || 'ناشناس',
    metadata: { reason },
    ip,
    userAgent,
  });

  recordEvents([{
    type: 'login_failed',
    path: '/#admin',
    userAgent,
    meta: { username: str(username, 80), reason },
  }]);
}

/* ─────────────────────────── کاربران واقعی سایت ─────────────────────────── */

export const maskPhone = (phone) => {
  const value = String(phone ?? '');
  if (!value) return '—';
  if (value.length <= 2) return '••';
  return `${'•'.repeat(Math.max(2, value.length - 2))}${value.slice(-2)}`;
};

export const maskEmail = (email) => {
  const value = String(email ?? '');
  const at = value.indexOf('@');
  if (at < 1) return value ? '•••' : '';
  return `${value.slice(0, 1)}•••${value.slice(at)}`;
};

const fullNameOf = (user) => {
  const profile = user?.profile ?? {};
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
    || profile.username
    || maskPhone(user?.phone);
};

export function siteUsers() {
  return readUsers().map((user) => ({
    id: user.id,
    displayName: fullNameOf(user),
    maskedPhone: maskPhone(user.phone),
    maskedEmail: maskEmail(user.profile?.email),
    university: str(user.profile?.university, 120),
    term: str(user.profile?.term, 40),
    grade: str(user.profile?.grade, 60),
    gender: str(user.profile?.gender, 20),
    motivations: Array.isArray(user.profile?.motivations) ? user.profile.motivations : [],
    referralSources: Array.isArray(user.profile?.referralSources) ? user.profile.referralSources : [],
    hasAvatar: Boolean(user.profile?.avatar),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profileComplete: Boolean(user.profile?.firstName && user.profile?.lastName && user.profile?.university),
    hasEmail: Boolean(user.profile?.email),
    hasUsername: Boolean(user.profile?.username),
  }));
}

/* ─────────────────────── محتوای واقعی محصول (Static Content) ───────────────────────
 * بانک تست، ویکی، فلش‌کارت، شبکه دانش، آزمون‌های بین‌الملل و هماهنگ، دادهٔ واقعی
 * همین پروژه‌اند (فایل‌های `mockData.js` و `graphData.js`). اینجا فقط «موجودی»
 * شمرده می‌شود تا مدیر بداند چه حجم محتوایی در محصول وجود دارد — هیچ عدد ساختگی.
 */

let staticCache = null;

const moduleUrl = (relative) => new URL(relative, import.meta.url).href;

async function loadModule(relative) {
  try {
    return await import(moduleUrl(relative));
  } catch {
    return null;
  }
}

export async function staticContent() {
  if (staticCache) return staticCache;

  const inventory = {
    connected: false,
    failed: [],
    testBank: null,
    wiki: null,
    flashcards: null,
    knowledge: null,
    international: null,
    coordinated: null,
    course: null,
  };

  const countBy = (list, keyOf) => list.reduce((accumulator, item) => {
    const key = keyOf(item) ?? 'other';
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  const testBank = await loadModule('../src/services/testBank/mockData.js');
  if (testBank?.QUESTIONS) {
    inventory.testBank = {
      questions: testBank.QUESTIONS.length,
      subjects: (testBank.SUBJECTS ?? []).map((subject) => ({
        id: subject.id,
        name: subject.name,
        accent: subject.accent,
        count: testBank.QUESTIONS.filter((question) => question.subject === subject.id).length,
      })),
      byDifficulty: countBy(testBank.QUESTIONS, (question) => question.difficulty),
      byType: countBy(testBank.QUESTIONS, (question) => question.type),
      byYear: countBy(testBank.QUESTIONS, (question) => question.year),
      byTrack: countBy(testBank.QUESTIONS, (question) => question.track),
      topics: Object.keys(testBank.TOPIC_TREE ?? {}).length,
      difficulties: testBank.DIFFICULTIES ?? {},
      types: testBank.QUESTION_TYPES ?? {},
    };
  } else inventory.failed.push('testBank');

  const wiki = await loadModule('../src/services/wiki/mockData.js');
  if (wiki?.WIKI_ENTITIES) {
    inventory.wiki = {
      entities: wiki.WIKI_ENTITIES.length,
      bySubject: countBy(wiki.WIKI_ENTITIES, (entity) => entity.subject),
      byType: countBy(wiki.WIKI_ENTITIES, (entity) => entity.type),
      subjects: wiki.SUBJECTS ?? [],
      hotSearches: wiki.HOT_SEARCHES ?? [],
    };
  } else inventory.failed.push('wiki');

  const flashcards = await loadModule('../src/services/flashcards/mockData.js');
  if (flashcards?.TAPESH_CARDS) {
    inventory.flashcards = {
      decks: (flashcards.TAPESH_DECKS ?? []).length,
      cards: flashcards.TAPESH_CARDS.length,
      bySubject: countBy(flashcards.TAPESH_CARDS, (card) => card.subjectId),
      deckTitles: (flashcards.TAPESH_DECKS ?? []).map((deck) => ({ id: deck.id, title: deck.title })),
    };
  } else inventory.failed.push('flashcards');

  const knowledge = await loadModule('../src/services/knowledge/graphData.js');
  if (knowledge?.KNOWLEDGE_NODES) {
    inventory.knowledge = {
      nodes: knowledge.KNOWLEDGE_NODES.length,
      edges: (knowledge.KNOWLEDGE_EDGES ?? []).length,
      courses: knowledge.COURSES ?? [],
      byType: countBy(knowledge.KNOWLEDGE_NODES, (node) => node.type),
      byDifficulty: countBy(knowledge.KNOWLEDGE_NODES, (node) => node.difficulty),
    };
  } else inventory.failed.push('knowledge');

  const international = await loadModule('../src/services/international/mockData.js');
  if (international?.EXAMS) {
    inventory.international = {
      exams: international.EXAMS.length,
      questions: (international.QUESTIONS ?? []).length,
      examTitles: international.EXAMS.map((exam) => ({ id: exam.id, title: exam.title ?? exam.name ?? exam.id })),
    };
  } else inventory.failed.push('international');

  const coordinated = await loadModule('../src/services/coordinatedExams/mockData.js');
  if (coordinated?.EXAMS) {
    inventory.coordinated = {
      exams: coordinated.EXAMS.length,
      questions: (coordinated.QUESTIONS ?? []).length,
    };
  } else inventory.failed.push('coordinated');

  const course = await loadModule('../src/data/learning/anatomyCourse.js');
  if (course?.anatomyCourse || course?.default) {
    const data = course.anatomyCourse ?? course.default;
    const units = Object.values(data?.unitsByModule ?? {}).reduce((total, list) => total + (Array.isArray(list) ? list.length : 0), 0);
    inventory.course = {
      id: data?.id ?? 'course',
      title: data?.title ?? 'درسنامه',
      modules: (data?.modules ?? []).length,
      units,
      algorithms: (data?.algorithm ?? []).length,
    };
  } else inventory.failed.push('course');

  inventory.connected = inventory.failed.length < 7;
  staticCache = inventory;
  return inventory;
}

/* ─────────────────────────── اتصال منابع داده (Data Sources) ───────────────────────────
 * شفاف‌ترین بخش مرکز تحلیل: دقیقاً می‌گوید کدام منبع وصل است و کدام نه.
 * هیچ‌کدام از این‌ها Hardcode نیستند؛ همه از `process.env` خوانده می‌شوند.
 */

export function dataSources() {
  const settings = readSettings();
  const env = process.env;

  const configured = (...keys) => keys.every((key) => Boolean(env[key]));

  return [
    {
      id: 'internal',
      label: 'دیتابیس داخلی پروژه',
      kind: 'internal',
      connected: true,
      detail: 'users.json + content/*.json',
    },
    {
      id: 'audit',
      label: 'گزارش رویدادها (Audit Log)',
      kind: 'internal',
      connected: true,
      detail: 'content/activity.json',
    },
    {
      id: 'telemetry',
      label: 'تلمتری مرورگر (Traffic / CWV / Errors)',
      kind: 'internal',
      connected: true,
      detail: 'POST /api/public/analytics/collect',
      note: 'داده از لحظهٔ نصب جمع می‌شود؛ بازه‌های گذشته خالی می‌مانند.',
    },
    {
      id: 'system',
      label: 'سنجه‌های سرور',
      kind: 'internal',
      connected: true,
      detail: 'node:os + node:fs',
    },
    {
      id: 'google-analytics',
      label: 'Google Analytics 4',
      kind: 'external',
      connected: configured('GA_PROPERTY_ID') && configured('GA_CLIENT_EMAIL', 'GA_PRIVATE_KEY'),
      detail: 'GA_PROPERTY_ID · GA_CLIENT_EMAIL · GA_PRIVATE_KEY',
      envKeys: ['GA_PROPERTY_ID', 'GA_CLIENT_EMAIL', 'GA_PRIVATE_KEY'],
    },
    {
      id: 'search-console',
      label: 'Google Search Console',
      kind: 'external',
      connected: configured('GSC_SITE_URL') && configured('GA_CLIENT_EMAIL', 'GA_PRIVATE_KEY'),
      detail: 'GSC_SITE_URL · GA_CLIENT_EMAIL · GA_PRIVATE_KEY',
      envKeys: ['GSC_SITE_URL', 'GA_CLIENT_EMAIL', 'GA_PRIVATE_KEY'],
    },
    {
      id: 'pagespeed',
      label: 'PageSpeed Insights / Lighthouse',
      kind: 'external',
      connected: configured('PAGESPEED_API_KEY'),
      detail: 'PAGESPEED_API_KEY',
      envKeys: ['PAGESPEED_API_KEY'],
    },
    {
      id: 'payment',
      label: 'سیستم پرداخت',
      kind: 'external',
      connected: configured('PAYMENT_PROVIDER') && configured('PAYMENT_API_KEY'),
      detail: 'PAYMENT_PROVIDER · PAYMENT_API_KEY',
      envKeys: ['PAYMENT_PROVIDER', 'PAYMENT_API_KEY'],
    },
    {
      id: 'llm',
      label: 'مدل زبانی (روایت تحلیل)',
      kind: 'external',
      connected: configured('LLM_API_KEY'),
      detail: 'LLM_API_KEY · LLM_MODEL',
      envKeys: ['LLM_API_KEY', 'LLM_MODEL'],
      note: 'تحلیلگر بدون آن هم کار می‌کند؛ فقط روایت متنی طبیعی اضافه می‌شود.',
    },
    {
      id: 'monitoring',
      label: 'سرویس مانیتورینگ بیرونی',
      kind: 'external',
      connected: configured('MONITORING_API_URL', 'MONITORING_API_KEY'),
      detail: 'MONITORING_API_URL · MONITORING_API_KEY',
      envKeys: ['MONITORING_API_URL', 'MONITORING_API_KEY'],
    },
    {
      id: 'notifications',
      label: 'کانال اعلان (ایمیل / تلگرام)',
      kind: 'external',
      connected: configured('ALERT_WEBHOOK_URL') || configured('ALERT_TELEGRAM_TOKEN'),
      detail: 'ALERT_WEBHOOK_URL · ALERT_TELEGRAM_TOKEN · ALERT_TELEGRAM_CHAT',
      envKeys: ['ALERT_WEBHOOK_URL', 'ALERT_TELEGRAM_TOKEN', 'ALERT_TELEGRAM_CHAT'],
    },
    {
      id: 'google-analytics-id',
      label: 'شناسهٔ GA نصب‌شده روی سایت',
      kind: 'internal',
      connected: Boolean(settings.integrations?.googleAnalyticsId),
      detail: 'تنظیمات → یکپارچه‌سازی → شناسهٔ Google Analytics',
    },
  ];
}

export function sourceMap() {
  return Object.fromEntries(dataSources().map((source) => [source.id, source]));
}

/* ─────────────────────────── سنجه‌های واقعی سیستم ─────────────────────────── */

const dirSize = (path) => {
  if (!existsSync(path)) return 0;
  let total = 0;
  const walk = (current) => {
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    entries.forEach((entry) => {
      const full = resolve(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        try {
          total += statSync(full).size;
        } catch {
          /* فایل در دسترس نبود */
        }
      }
    });
  };
  walk(path);
  return total;
};

export function systemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const load = os.loadavg();
  const cores = os.cpus()?.length || 1;
  const memory = process.memoryUsage();

  let disk = null;
  try {
    const stats = statfsSync(contentDir);
    const blockSize = stats.bsize;
    const total = stats.blocks * blockSize;
    const free = stats.bfree * blockSize;
    disk = { total, free, used: total - free, usedPercent: total ? Math.round(((total - free) / total) * 1000) / 10 : null };
  } catch {
    disk = null;
  }

  const contentFiles = ['articles', 'pages', 'media', 'banners', 'activity', 'events', 'admins', 'notes', 'alerts'];
  const database = {
    directory: 'database/',
    sizeBytes: dirSize(contentDir),
    uploadsBytes: dirSize(resolve(projectRoot, 'public', 'uploads')),
    collections: contentFiles.map((name) => {
      const items = readCollection(name);
      return { name, count: Array.isArray(items) ? items.length : 1 };
    }),
    sizeOnDiskBytes: dirSize(resolve(projectRoot, 'database')),
  };

  return {
    server: {
      startedAt: new Date(serverStartedAt).toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      node: process.version,
      platform: `${os.platform()} ${os.release()}`,
      hostname: os.hostname(),
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development',
    },
    cpu: {
      cores,
      model: os.cpus()?.[0]?.model ?? '—',
      load1: Math.round(load[0] * 100) / 100,
      load5: Math.round(load[1] * 100) / 100,
      load15: Math.round(load[2] * 100) / 100,
      /* درصد بار نسبت به تعداد هسته — عدد واقعی و قابل فهم برای مدیر */
      usedPercent: Math.min(100, Math.round((load[0] / cores) * 1000) / 10),
      processCpuSeconds: Math.round((process.cpuUsage().user + process.cpuUsage().system) / 1e6),
    },
    memory: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: totalMem - freeMem,
      usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10,
      processRssBytes: memory.rss,
      processHeapBytes: memory.heapUsed,
      processHeapTotalBytes: memory.heapTotal,
      /* سهم واقعی همین فرایند از کل حافظه — سنجهٔ قابل اقدام برای این سرویس */
      processUsedPercent: Math.round((memory.rss / totalMem) * 1000) / 10,
      /*
       * توجه: در macOS، `freemem` عمداً نزدیک صفر نگه داشته می‌شود چون سیستم
       * حافظهٔ آزاد را به کش تبدیل می‌کند. بنابراین `usedPercent` سیستم به‌تنهایی
       * برای هشدار دادن گمراه‌کننده است؛ بررسی سلامت روی سهم فرایند انجام می‌شود.
       */
      note: os.platform() === 'darwin'
        ? 'در macOS حافظهٔ آزاد عمداً کم گزارش می‌شود (کش سیستم)؛ برای هشدار، مصرف فرایند سنجیده می‌شود.'
        : null,
    },
    disk,
    database,
  };
}

/* ─────────────────────────── هشدارها (Alert Rules) ───────────────────────────
 * قواعد هشدار «تنظیمات» مدیرند، نه دادهٔ ساختگی. چند قاعدهٔ پیش‌فرض که سنجه‌شان
 * همین حالا در دسترس است seed می‌شوند تا بخش هشدار از روز اول معنا داشته باشد.
 */

const ALERTS_COLLECTION = 'alerts';

export const ALERT_METRICS = [
  { id: 'page_views', label: 'بازدید صفحات', unit: 'بازدید', window: 'range', available: true },
  { id: 'signups', label: 'ثبت‌نام جدید', unit: 'نفر', window: 'range', available: true },
  { id: 'test_submits', label: 'تست‌های انجام‌شده', unit: 'تست', window: 'range', available: true },
  { id: 'error_rate', label: 'نرخ خطای API', unit: '٪', window: 'live', available: true },
  { id: 'failed_logins', label: 'ورود ناموفق پنل', unit: 'تلاش', window: 'range', available: true },
  { id: 'server_latency', label: 'میانگین زمان پاسخ API', unit: 'میلی‌ثانیه', window: 'live', available: true },
  { id: 'lcp', label: 'LCP (Core Web Vital)', unit: 'میلی‌ثانیه', window: 'range', available: true },
  { id: 'memory', label: 'مصرف حافظهٔ فرایند سرور', unit: '٪', window: 'live', available: true },
  { id: 'disk', label: 'مصرف دیسک', unit: '٪', window: 'live', available: true },
  { id: 'revenue', label: 'درآمد روزانه', unit: 'تومان', window: 'range', available: false, requires: 'payment' },
  { id: 'seo_position', label: 'میانگین رتبهٔ گوگل', unit: 'رتبه', window: 'range', available: false, requires: 'search-console' },
];

const SEED_ALERTS = [
  { name: 'افت شدید بازدید صفحات', metric: 'page_views', comparator: 'drop', threshold: 30, severity: 'high' },
  { name: 'نرخ خطای API بالا', metric: 'error_rate', comparator: 'above', threshold: 5, severity: 'critical' },
  { name: 'ورود ناموفق مکرر پنل', metric: 'failed_logins', comparator: 'above', threshold: 8, severity: 'critical' },
  { name: 'کندی پاسخ API', metric: 'server_latency', comparator: 'above', threshold: 1200, severity: 'medium' },
  { name: 'Core Web Vital نامطلوب (LCP)', metric: 'lcp', comparator: 'above', threshold: 2500, severity: 'medium' },
];

/* اگر هیچ قاعده‌ای ثبت نشده باشد، قواعد پیش‌فرض یک‌بار seed می‌شوند (تنظیمات، نه دادهٔ جعلی) */
export function listAlerts() {
  const stored = readCollection(ALERTS_COLLECTION);
  if (Array.isArray(stored) && stored.length) return stored;
  return seedAlerts();
}

export function seedAlerts(admin = null) {
  const existing = readCollection(ALERTS_COLLECTION);
  if (Array.isArray(existing) && existing.length) return existing;

  const created = SEED_ALERTS.map((alert, index) => ({
    id: `al-${Date.now().toString(36)}-${index}`,
    ...alert,
    enabled: true,
    channel: 'panel',
    windowHours: 24,
    isDefault: true,
    createdAt: new Date().toISOString(),
    createdBy: admin?.id ?? 'system',
    lastTriggeredAt: null,
  }));

  writeCollection(ALERTS_COLLECTION, created);
  return created;
}

export function saveAlert(input, id = null, admin = null) {
  const alerts = readCollection(ALERTS_COLLECTION);
  const metric = ALERT_METRICS.find((item) => item.id === input.metric);
  if (!metric) {
    throw Object.assign(new Error('سنجهٔ هشدار نامعتبر است'), { code: 'VALIDATION_ERROR' });
  }

  const name = String(input.name ?? '').trim() || metric.label;
  const payload = {
    name: name.slice(0, 120),
    metric: metric.id,
    comparator: ['above', 'below', 'drop', 'rise'].includes(input.comparator) ? input.comparator : 'above',
    threshold: Number.isFinite(Number(input.threshold)) ? Number(input.threshold) : 0,
    severity: ['critical', 'high', 'medium', 'low'].includes(input.severity) ? input.severity : 'medium',
    windowHours: Math.min(720, Math.max(1, Number(input.windowHours) || 24)),
    channel: ['panel', 'email', 'telegram', 'webhook'].includes(input.channel) ? input.channel : 'panel',
    enabled: input.enabled !== false,
  };

  if (id) {
    const index = alerts.findIndex((alert) => alert.id === id);
    if (index === -1) return null;
    alerts[index] = { ...alerts[index], ...payload, updatedAt: new Date().toISOString() };
    writeCollection(ALERTS_COLLECTION, alerts);
    return alerts[index];
  }

  const alert = {
    id: `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ...payload,
    isDefault: false,
    createdAt: new Date().toISOString(),
    createdBy: admin?.id ?? 'system',
    lastTriggeredAt: null,
  };

  alerts.push(alert);
  writeCollection(ALERTS_COLLECTION, alerts);
  return alert;
}

export function deleteAlert(id) {
  const alerts = readCollection(ALERTS_COLLECTION);
  const target = alerts.find((alert) => alert.id === id);
  if (!target) return null;
  writeCollection(ALERTS_COLLECTION, alerts.filter((alert) => alert.id !== id));
  return target;
}

export function markAlertTriggered(id) {
  const alerts = readCollection(ALERTS_COLLECTION);
  const index = alerts.findIndex((alert) => alert.id === id);
  if (index === -1) return null;
  alerts[index] = { ...alerts[index], lastTriggeredAt: new Date().toISOString() };
  writeCollection(ALERTS_COLLECTION, alerts);
  return alerts[index];
}

export { projectRoot };
