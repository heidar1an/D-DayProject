/*
 * موتور آمار قلب تپش — کاملاً Pure (بدون DOM و localStorage).
 * این فایل فقط «داده و محاسبه» است؛ ذخیره‌سازی و API در heartStatsService.js انجام می‌شود.
 *
 * دادهٔ پایه: یک دفتر روزانهٔ سادهٔ Map — کلید 'YYYY-MM-DD' (تاریخ محلی) → تعداد قلب همان روز.
 *
 * برچسب‌ها (روز هفته، تاریخ جلالی، ماه، سال) با Intl لوکیل fa-IR ساخته می‌شوند —
 * یعنی تقویم جلالی و اعداد فارسی بدون هیچ کتابخانه‌ای.
 */

export const HEART_RANGES = ['daily', 'weekly', 'monthly', 'yearly'];

/* ── ابزارهای تاریخ ── */

export const toDayKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const fromDayKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return startOfDay(d);
};

/* شنبه، شروع هفتهٔ ایران */
export const startOfIranWeek = (date) => addDays(date, -((date.getDay() + 1) % 7));

/* ── قالب‌بندی فارسی (جلالی) ── */

const fWeekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' });
const fDay = new Intl.DateTimeFormat('fa-IR', { day: 'numeric' });
const fDayMonth = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' });
const fMonth = new Intl.DateTimeFormat('fa-IR', { month: 'long' });
const fYear = new Intl.DateTimeFormat('fa-IR', { year: 'numeric' });

/* حرف اول نام روز (ش، ی، د، س، چ، پ، ج) */
const weekdayLetter = (date) => fWeekday.format(date).charAt(0);

/* ── تجمیع بر اساس بازه ── */

const sumRange = (days, start, endClamped) => {
  let sum = 0;
  const cursor = new Date(start);
  while (cursor <= endClamped) {
    sum += days[toDayKey(cursor)] ?? 0;
    cursor.setDate(cursor.getDate() + 1);
  }
  return sum;
};

/* روزانه: ۱۴ روز اخیر (امروز + ۱۳ روز قبل) */
function dailyPoints(days, today0) {
  const points = [];
  for (let i = 13; i >= 0; i -= 1) {
    const date = addDays(today0, -i);
    const key = toDayKey(date);
    points.push({
      id: key,
      hearts: days[key] ?? 0,
      start: date,
      end: date,
      isCurrent: i === 0,
      label: { top: i === 0 ? 'امروز' : weekdayLetter(date), bottom: fDay.format(date) },
      title: `${fWeekday.format(date)} ${fDayMonth.format(date)} ${fYear.format(date)}`,
      insight: `${fWeekday.format(date)} ${fDayMonth.format(date)}`,
    });
  }
  return points;
}

/* هفتگی: ۱۲ هفتهٔ اخیر (شنبه تا جمعه؛ هفتهٔ جاری تا امروز) */
function weeklyPoints(days, today0) {
  const currentStart = startOfIranWeek(today0);
  const points = [];
  for (let w = 11; w >= 0; w -= 1) {
    const start = addDays(currentStart, -7 * w);
    const end = addDays(start, 6);
    const clampedEnd = end > today0 ? today0 : end;
    points.push({
      id: toDayKey(start),
      hearts: sumRange(days, start, clampedEnd),
      start,
      end,
      isCurrent: w === 0,
      label: { top: fDayMonth.format(start) },
      title: `هفتهٔ ${fDayMonth.format(start)} تا ${fDayMonth.format(end)} ${fYear.format(start)}`,
      insight: `هفتهٔ ${fDayMonth.format(start)}`,
    });
  }
  return points;
}

/*
 * ماهانه: ۱۲ ماه جلالی اخیر — چون مرز ماه جلالی با ماه میلادی یکی نیست،
 * روزبه‌روز به عقب می‌رویم و با کلید (سال، ماه) جلالی گروه می‌کنیم.
 */
function jalaliBucketPoints(days, today0, bucketCount, keyOf, titleOf, labelOf, insightOf) {
  const buckets = new Map();
  const cursor = new Date(today0);
  while (buckets.size < bucketCount) {
    const key = keyOf(cursor);
    if (!buckets.has(key)) buckets.set(key, { sum: 0, start: new Date(cursor) });
    buckets.get(key).sum += days[toDayKey(cursor)] ?? 0;
    cursor.setDate(cursor.getDate() - 1);
  }

  return [...buckets.entries()].reverse().map(([key, bucket], index, all) => ({
    id: key,
    hearts: bucket.sum,
    start: bucket.start,
    end: null,
    isCurrent: index === all.length - 1,
    label: labelOf(key, bucket.start),
    title: titleOf(key, bucket.start),
    insight: insightOf(key, bucket.start),
  }));
}

const monthlyKeyOf = (d) => `${fYear.format(d)}-${fMonth.format(d)}`;

function monthlyPoints(days, today0) {
  return jalaliBucketPoints(
    days,
    today0,
    12,
    monthlyKeyOf,
    (key, start) => `${fMonth.format(start)} ${fYear.format(start)}`,
    (_key, start) => ({ top: fMonth.format(start) }),
    (_key, start) => fMonth.format(start),
  );
}

function yearlyPoints(days, today0) {
  return jalaliBucketPoints(
    days,
    today0,
    5,
    (d) => fYear.format(d),
    (key) => `سال ${key}`,
    (key) => ({ top: key }),
    (key) => key,
  );
}

/* ── خلاصهٔ تحلیلی بازه ── */

function summarize(points) {
  const total = points.reduce((sum, p) => sum + p.hearts, 0);
  const best = points.reduce((acc, p) => (p.hearts > acc.hearts ? p : acc), points[0]);
  return {
    total,
    avg: total / Math.max(points.length, 1),
    best: best ? { value: best.hearts, insight: best.insight, id: best.id } : null,
  };
}

/*
 * GET معادل /api/hearts/series?range=daily|weekly|monthly|yearly
 * خروجی: points (مرتب از قدیم به جدید) + summary
 */
export function aggregateHeartSeries(days, range = 'daily', today = new Date()) {
  const today0 = startOfDay(today);
  const points =
    range === 'weekly'
      ? weeklyPoints(days, today0)
      : range === 'monthly'
        ? monthlyPoints(days, today0)
        : range === 'yearly'
          ? yearlyPoints(days, today0)
          : dailyPoints(days, today0);

  return { range, points, summary: summarize(points) };
}
