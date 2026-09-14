/*
 * سرویس آمار قلب تپش — قرارداد API به شکل واقعی طراحی شده؛ پیاده‌سازی فعلی Mock با
 * persistence در localStorage (تا تغییرات «امروز» بین رفرش‌ها بماند).
 *
 * قراردادهای آینده (اتصال Backend فقط بدنهٔ این توابع را تغییر می‌دهد):
 *   GET  /api/hearts/series?range=daily|weekly|monthly|yearly
 *   POST /api/hearts/gains ← ثبت قلب کسب‌شده (در نسخهٔ سرور: اعتبارسنجی با HeartTransaction)
 *
 * اصول:
 *   - محاسبهٔ سری و تولید برچسب‌ها در heartSeries.js (Pure) است؛ اینجا فقط orchestration است.
 *   - دادهٔ seed با anchor/seed ثابت deterministic تولید می‌شود؛ ذخیرهٔ کاربر روی آن merge
 *     می‌شود تا روزهای استفادهٔ واقعی همیشه بر دادهٔ نمونه برتری داشته باشند.
 *   - لایه‌های دیگر (آزمون، فلش‌کارت، لیگ، ...) برای ثبت قلب روز فقط recordHeartGain
 *     را صدا می‌زنند؛ نمودار خودش از همین دفتر می‌خواند.
 */

import { aggregateHeartSeries, buildSeedDays, startOfDay, toDayKey } from './heartSeries';

const STORAGE_KEY = 'tapesh:hearts:v1';
const LATENCY_MS = 360;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function respond(build) {
  await delay(LATENCY_MS + Math.random() * 180);
  return build();
}

let cache = null;

function loadDays() {
  if (cache) return cache;
  const seed = buildSeedDays();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1 && parsed.days && typeof parsed.days === 'object') {
        cache = { ...seed, ...parsed.days };
      } else {
        cache = seed;
      }
    } else {
      cache = seed;
    }
  } catch {
    cache = seed;
  }
  return cache;
}

function persist(days) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, days }));
  } catch {
    /* حالت Private Browsing — نمودار فقط از دادهٔ seed می‌خواند */
  }
}

/* GET /api/hearts/series?range= */
export function fetchHeartSeries({ range = 'daily' } = {}) {
  return respond(() => aggregateHeartSeries(loadDays(), range));
}

/* POST /api/hearts/gains — ثبت قلب کسب‌شدهٔ امروز توسط سایر لایه‌ها */
export function recordHeartGain({ amount = 0, date = new Date() } = {}) {
  return respond(() => {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const days = loadDays();
    const key = toDayKey(startOfDay(date));
    days[key] = (days[key] ?? 0) + Math.round(amount);
    persist(days);
    return { day: key, hearts: days[key] };
  });
}

/* برای تست از کنسول: __heartStatsService.__reset() */
export function __reset() {
  cache = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
