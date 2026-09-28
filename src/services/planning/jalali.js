/*
 * تقویم هجری شمسی — تبدیل، شبکهٔ ماه و کمکی‌های تاریخ.
 *
 * چرا خودمان پیاده کرده‌ایم: هیچ کتابخانهٔ تقویمی در `package.json` نیست و قانون
 * پروژه افزودن وابستگی تازه است. الگوریتم همان الگوریتم مرجع `jalaali-js` است
 * (جدول `BREAKS` + حساب عدد روز جولیَن) که سال‌هاست در عمل آزموده شده؛ `Intl` را
 * برای «ساختن شبکه» نمی‌توان استفاده کرد چون برعکسش (شمسی → میلادی) با آن
 * قابل اتکا نیست و برای ساختن رویداد لازم است.
 *
 * همهٔ حساب‌ها روی «نیمه‌شب محلی» انجام می‌شود؛ قالب ذخیره‌سازی تاریخ در سرویس
 * میلادی ISO (`YYYY-MM-DD`) است تا مرتب‌سازی و مقایسه ساده بماند.
 */

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
  1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
];

const div = (a, b) => Math.trunc(a / b);
const mod = (a, b) => a - Math.trunc(a / b) * b;

/* ───────────────────────────── تبدیل‌های پایه ───────────────────────────── */

function jalCal(jy) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jm = 0;
  let jump = 0;

  if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error(`سال شمسی نامعتبر: ${jy}`);

  for (let i = 1; i < bl; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;

  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

export function isLeapJalali(jy) {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalali(jy) ? 30 : 29;
}

/* روز جولیَن از تاریخ میلادی */
export function gregorianToJdn(gy, gm, gd) {
  let jdn = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
    + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  jdn = jdn - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return jdn;
}

/* تاریخ میلادی از روز جولیَن */
export function jdnToGregorian(jdn) {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

export function jalaliToJdn(jy, jm, jd) {
  const r = jalCal(jy);
  return gregorianToJdn(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

export function jdnToJalali(jdn) {
  const gy = jdnToGregorian(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = gregorianToJdn(gy, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }

  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

/* ───────────────────────────── ابزارهای تاریخ ───────────────────────────── */

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export const JALALI_WEEKDAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
export const JALALI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export const toFa = (value) => String(value ?? '').replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
export const toEn = (value) => String(value ?? '').replace(/[۰-۹]/g, (digit) => String(FA_DIGITS.indexOf(digit)));

export const pad2 = (value) => String(value).padStart(2, '0');

/* `YYYY-MM-DD` میلادی → Date در نیمه‌شب محلی */
export function parseISODate(iso) {
  if (!iso) return null;
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/* Date → `YYYY-MM-DD` میلادی */
export function isoDate(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, days) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function diffDays(a, b) {
  return Math.round((startOfDay(a) - startOfDay(b)) / 86_400_000);
}

/* شنبه = ۰ … جمعه = ۶ */
export function jalaliWeekday(date) {
  return (date.getDay() + 1) % 7;
}

export function jalaliParts(input) {
  const date = input instanceof Date ? input : parseISODate(input);
  if (!date) return null;
  const jdn = gregorianToJdn(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return { ...jdnToJalali(jdn), weekday: jalaliWeekday(date) };
}

export function jalaliToDate(jy, jm, jd) {
  const g = jdnToGregorian(jalaliToJdn(jy, jm, jd));
  return new Date(g.gy, g.gm - 1, g.gd);
}

export function jalaliToIso(jy, jm, jd) {
  return isoDate(jalaliToDate(jy, jm, jd));
}

export function todayJalali() {
  return jalaliParts(new Date());
}

/* برچسب خوانا: «۶ مهر ۱۴۰۵» */
export function jalaliLabel(input, { short = false } = {}) {
  const parts = jalaliParts(input);
  if (!parts) return '—';
  const month = JALALI_MONTHS[parts.jm - 1];
  return short
    ? toFa(`${parts.jd} ${month}`)
    : toFa(`${parts.jd} ${month} ${parts.jy}`);
}

/* برچسب عددی: «۱۴۰۵/۰۷/۰۶» */
export function jalaliNumeric(input) {
  const parts = jalaliParts(input);
  if (!parts) return '—';
  return toFa(`${parts.jy}/${pad2(parts.jm)}/${pad2(parts.jd)}`);
}

export function jalaliWeekdayName(input) {
  const parts = jalaliParts(input);
  return parts ? JALALI_WEEKDAYS[parts.weekday] : '—';
}

/* ماه بعد/قبل با جمع جبری؛ خروجی همیشه معتبر است */
export function shiftJalaliMonth(jy, jm, delta) {
  const total = jy * 12 + (jm - 1) + delta;
  return { jy: Math.floor(total / 12), jm: mod(total, 12) + 1 };
}

/*
 * شبکهٔ ماه شمسی: ۶ سطر × ۷ ستون، از شنبه.
 * ستون‌های قبل/بعد از ماه هم پر می‌شوند تا چیدمان ثابت بماند.
 */
export function buildMonthGrid(jy, jm, { today = new Date() } = {}) {
  const first = jalaliToDate(jy, jm, 1);
  const lead = jalaliWeekday(first);
  const start = addDays(first, -lead);
  const todayIso = isoDate(today);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    const parts = jalaliParts(date);
    const iso = isoDate(date);
    return {
      key: iso,
      iso,
      date,
      jy: parts.jy,
      jm: parts.jm,
      jd: parts.jd,
      weekday: parts.weekday,
      inMonth: parts.jy === jy && parts.jm === jm,
      isToday: iso === todayIso,
      isFriday: parts.weekday === 6,
    };
  });
}

/* هفتهٔ جاری (شنبه تا جمعه) حول یک تاریخ */
export function weekDays(date) {
  const start = addDays(date, -jalaliWeekday(date));
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function jalaliYearDays(jy) {
  return isLeapJalali(jy) ? 366 : 365;
}

export function jalaliYearOf(input) {
  return jalaliParts(input)?.jy ?? todayJalali().jy;
}

/* ───────────────────────────── ابزار زمان ───────────────────────────── */

export const minutesOf = (time) => {
  const match = String(time ?? '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const timeOf = (minutes) => `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`;

export const faTime = (time) => (time ? toFa(String(time)) : '—');

/* ترکیب تاریخ و ساعت به یک Date محلی */
export function combine(dateIso, time) {
  const date = parseISODate(dateIso);
  if (!date) return null;
  const minutes = minutesOf(time || '00:00');
  date.setMinutes(minutes);
  return date;
}

export function relativeFa(input) {
  const date = input instanceof Date ? input : combine(input?.date, input?.time) ?? parseISODate(input);
  if (!date) return '—';

  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const suffix = diff < 0 ? 'پیش' : 'دیگر';

  if (abs < 60_000) return 'همین حالا';
  if (abs < 3_600_000) return `${toFa(Math.round(abs / 60_000))} دقیقه ${suffix}`;
  if (abs < 86_400_000) return `${toFa(Math.round(abs / 3_600_000))} ساعت ${suffix}`;
  return `${toFa(Math.round(abs / 86_400_000))} روز ${suffix}`;
}

/* ───────────────────────────── اعداد فارسی ───────────────────────────── */

export function faNumber(value) {
  return toFa(new Intl.NumberFormat('en-US').format(Number(value) || 0));
}

/* قالب پول تومانی: «۱۲٬۴۵۰٬۰۰۰ تومان» */
export function faToman(value, { unit = true } = {}) {
  const amount = Math.round(Number(value) || 0);
  const sign = amount < 0 ? '−' : '';
  const text = toFa(new Intl.NumberFormat('en-US').format(Math.abs(amount)));
  return unit ? `${sign}${text} تومان` : `${sign}${text}`;
}

/* خلاصهٔ کوتاه برای محورها و کارت‌ها: ۱۲٫۴ میلیون */
export function faCompact(value) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';

  if (abs >= 1_000_000_000) return `${sign}${toFa((abs / 1_000_000_000).toFixed(1))} میلیارد`;
  if (abs >= 1_000_000) return `${sign}${toFa((abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1))} میلیون`;
  if (abs >= 1_000) return `${sign}${toFa(Math.round(abs / 1_000))} هزار`;
  return `${sign}${toFa(abs)}`;
}

export function faPercent(value, digits = 1) {
  const number = Number(value) || 0;
  return `${toFa(number.toFixed(digits))}٪`;
}
