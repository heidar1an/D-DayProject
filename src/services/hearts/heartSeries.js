/*
 * موتور آمار قلب تپش — کاملاً Pure (بدون DOM و localStorage).
 * این فایل فقط «داده و محاسبه» است؛ ذخیره‌سازی و API در heartStatsService.js انجام می‌شود.
 *
 * دادهٔ پایه: یک دفتر روزانهٔ سادهٔ Map — کلید 'YYYY-MM-DD' (تاریخ محلی) → تعداد قلب همان روز.
 * تولید دادهٔ Mock: با seed ثابت و anchor ثابت، تا برای هر تاریخ همیشه همان مقدار تولید شود
 * (رفرش یا جابه‌جایی بین بازه‌ها عدد عوض نمی‌کند).
 *
 * برچسب‌ها (روز هفته، تاریخ جلالی، ماه، سال) با Intl لوکیل fa-IR ساخته می‌شوند —
 * یعنی تقویم جلالی و اعداد فارسی بدون هیچ کتابخانه‌ای.
 */

export const HEART_RANGES = ['daily', 'weekly', 'monthly', 'yearly'];

const DAY_MS = 86_400_000;

/* anchor = ۱ فروردین ۱۴۰۱ → دفتر روزانه حدود ۵ سال جلالی را پوشش می‌دهد (نمای سالانه ۵ میله) */
const SEED_ANCHOR = new Date(2022, 2, 21);
const SEED_SALT = 0x7a25c3;

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

/* ── تولید دفتر روزانهٔ Mock (deterministic) ── */

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
 * ریتم دانش‌آموزی: فعالیت پایه با روند رشد آرام، پنجشنبهٔ نیمه‌فعال، جمعه تقریباً تعطیل،
 * اسپایک‌های چالش/نبرد، و روزهای غیبت. امروز و دو روز قبل غیرصفر تا با استریک ۳ روزهٔ
 * هدر داشبورد بخواند؛ امروز عمداً مقدار متعادلی دارد و با recordHeartGain رشد می‌کند.
 */
export function buildSeedDays(today = new Date()) {
  const today0 = startOfDay(today);
  const rnd = mulberry32(SEED_SALT);
  const days = {};
  const totalDays = Math.max(1, Math.round((today0 - SEED_ANCHOR) / DAY_MS));

  const cursor = new Date(SEED_ANCHOR);
  for (let i = 0; cursor <= today0; i += 1) {
    const dow = cursor.getDay();
    let value = 0;

    if (dow !== 5) {
      const growth = 0.72 + (i / totalDays) * 0.55;
      value = (16 + rnd() * 26) * growth * (dow === 4 ? 0.55 : 1);
      const roll = rnd();
      if (roll < 0.045) value += 55 + rnd() * 85; /* روز چالش/نبرد */
      else if (roll < 0.06) value += 170 + rnd() * 130; /* برد بزرگ */
      if (rnd() < 0.055) value = 0; /* غیبت */
    } else if (rnd() < 0.18) {
      value = rnd() * 14; /* جمعهٔ مطالعهٔ سبک */
    }

    days[toDayKey(cursor)] = Math.round(value);
    cursor.setDate(cursor.getDate() + 1);
  }

  /* استریک اخیر: دو روز گذشته غیرصفر + امروز */
  days[toDayKey(addDays(today0, -2))] = 32 + Math.round(rnd() * 18);
  days[toDayKey(addDays(today0, -1))] = 41 + Math.round(rnd() * 22);
  days[toDayKey(today0)] = 18 + Math.round(rnd() * 20);

  return days;
}

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
