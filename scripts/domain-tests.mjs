/*
 * تست‌های دامنهٔ تپش — با اجراکنندهٔ تست خودِ نود (`node:test`)، بدون هیچ وابستگی تازه.
 *
 * چرا وجود دارد: پروژه تا پیش از این فقط سه اسکریپت سنجش دستی داشت (theme/auth/planning)
 * و هیچ تست خودکاری برای منطق خالص نداشت. این فایل همان لایه‌هایی را می‌سنجد که
 * «قرارداد» دارند و بی‌سروصدا می‌شکنند: پاک‌سازی HTML، درجهٔ سختی، الگوریتم مرور
 * فاصله‌دار، نرمال‌سازی ورودی کاربر، تقویم جلالی و سری ضربان.
 *
 * اجرا:  npm run domain:test
 *
 * این فایل **هیچ فایلی را نمی‌نویسد** و به دیسک، شبکه یا مرورگر دست نمی‌زند؛ فقط
 * توابع خالص را می‌سنجد. ماژول‌هایی که در نود با پسوند حل نمی‌شوند (موتورهای
 * greenPath) عمداً اینجا نیستند؛ آن‌ها با `planning:test` سنجیده می‌شوند.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

const load = (relative) => import(new URL(relative, import.meta.url));

const { buildExcerpt, htmlToText, sanitizeHtml } = await load('../database/sanitizeHtml.js');
const { difficultyFromPercent, questionKindLabel } = await load('../src/services/testBank/questionMeta.js');
const { INITIAL_USER_STATE, RATINGS, computeMastery, isDue, isMastered, previewIntervals, rate } = await load(
  '../src/services/flashcards/spacedRepetition.js',
);
const { getDisplayName, normalizeDigits } = await load('../src/services/userStorage.js');
const {
  addDays, diffDays, isLeapJalali, jalaliMonthLength, jalaliToIso, jalaliToJdn, jdnToJalali, toEn, toFa,
} = await load('../src/services/planning/jalali.js');
const { aggregateHeartSeries, fromDayKey, startOfIranWeek, toDayKey } = await load(
  '../src/services/hearts/heartSeries.js',
);

/* ─────────────────────────── پاک‌سازی HTML ─────────────────────────── */

test('sanitizeHtml: تگ اسکریپت و محتوایش حذف می‌شود', () => {
  const out = sanitizeHtml('<p>سالم</p><script>alert(1)</script>');
  assert.ok(!out.includes('<script'), 'تگ script نباید باقی بماند');
  assert.ok(!out.includes('alert'), 'محتوای script نباید باقی بماند');
  assert.ok(out.includes('سالم'), 'متن سالم باید بماند');
});

test('sanitizeHtml: رویدادهای درون‌خطی (onerror/onclick) حذف می‌شوند', () => {
  const out = sanitizeHtml('<img src="x" onerror="alert(1)"><a onclick="evil()">لینک</a>');
  assert.ok(!/onerror/i.test(out), 'onerror نباید باقی بماند');
  assert.ok(!/onclick/i.test(out), 'onclick نباید باقی بماند');
});

test('sanitizeHtml: جاوااسکریپت در href خنثی می‌شود', () => {
  const out = sanitizeHtml('<a href="javascript:alert(1)">کلیک</a>');
  assert.ok(!/javascript:/i.test(out), 'طرح javascript: نباید باقی بماند');
});

test('htmlToText: تگ‌ها را می‌ریزد و متن را نگه می‌دارد', () => {
  assert.equal(htmlToText('<p>ضربان</p>').trim(), 'ضربان');
  assert.equal(htmlToText('<b>a</b><i>b</i>').trim(), 'a b');
});

test('buildExcerpt: طول متن را محدود می‌کند', () => {
  const long = `<p>${'ی'.repeat(500)}</p>`;
  const excerpt = buildExcerpt(long, 50);
  assert.ok(excerpt.length <= 51, `برش باید کوتاه بماند، شد ${excerpt.length}`);
  assert.ok(!excerpt.includes('<'), 'برش نباید تگ داشته باشد');
});

/* ─────────────────────── درجهٔ سختی و نوع سؤال ─────────────────────── */

test('difficultyFromPercent: مرزهای دسته‌بندی', () => {
  assert.equal(difficultyFromPercent(71), 'easy');
  assert.equal(difficultyFromPercent(70), 'medium');
  assert.equal(difficultyFromPercent(50), 'medium');
  assert.equal(difficultyFromPercent(49), 'hard');
  assert.equal(difficultyFromPercent(40), 'hard');
  assert.equal(difficultyFromPercent(39), 'very_hard');
  assert.equal(difficultyFromPercent(0), 'very_hard');
});

test('questionKindLabel: منبع تألیفی در برابر کشوری', () => {
  assert.equal(questionKindLabel({ source: 'tapesh' }), 'تألیفی');
  assert.equal(questionKindLabel({ source: 'national' }), 'کشوری');
  assert.equal(questionKindLabel(null), 'کشوری');
});

/* ──────────────────── مرور فاصله‌دار (فلش‌کارت) ──────────────────── */

test('spacedRepetition: حالت اولیه وابسته به مرور نیست', () => {
  assert.equal(isDue(INITIAL_USER_STATE, Date.now()), true);
  assert.equal(isMastered(INITIAL_USER_STATE), false);
  assert.equal(computeMastery(INITIAL_USER_STATE, Date.now()), 0);
});

test('spacedRepetition: «خوب» کارت را وارد چرخهٔ یادگیری می‌کند', () => {
  const now = Date.UTC(2026, 0, 10, 8, 0, 0);
  const { next, log } = rate(INITIAL_USER_STATE, 'good', {}, now);

  assert.equal(next.reviewCount, 1);
  assert.equal(next.correctCount, 1);
  assert.ok(next.intervalMinutes > 0, 'فاصله باید مثبت شود');
  assert.ok(next.dueAt > now, 'موعد بعدی باید جلوتر از حالا باشد');
  assert.notEqual(next.state, 'new', 'حالت نباید «نو» بماند');
  assert.equal(log.previousState, 'new');
  assert.equal(log.newState, next.state);
});

test('spacedRepetition: «دوباره» لغزش را می‌شمارد و کارت را برمی‌گرداند', () => {
  const now = Date.UTC(2026, 0, 10, 8, 0, 0);
  const learned = rate(INITIAL_USER_STATE, 'good', {}, now).next;
  const lapsed = rate(learned, 'again', {}, now + 60_000).next;

  assert.equal(lapsed.lapseCount, 1);
  assert.equal(lapsed.incorrectCount, 1);
  assert.ok(lapsed.intervalMinutes <= learned.intervalMinutes, 'فاصله پس از لغزش نباید بلندتر شود');
});

test('spacedRepetition: فاکتور آسانی زیر کف پیکربندی نمی‌رود', () => {
  const now = Date.UTC(2026, 0, 10, 8, 0, 0);
  let state = INITIAL_USER_STATE;
  for (let i = 0; i < 40; i += 1) state = rate(state, 'again', {}, now + i * 1000).next;
  assert.ok(state.easeFactor >= 1.3, `فاکتور آسانی نباید زیر ۱٫۳ برود، شد ${state.easeFactor}`);
});

test('spacedRepetition: پیش‌نمایش چهار گزینه را با فاصلهٔ مثبت می‌دهد', () => {
  const preview = previewIntervals(INITIAL_USER_STATE, {}, Date.UTC(2026, 0, 10, 8, 0, 0));
  for (const rating of RATINGS) {
    assert.ok(Number.isFinite(preview[rating]), `پیش‌نمایش «${rating}» باید عدد باشد`);
    assert.ok(preview[rating] > 0, `پیش‌نمایش «${rating}» باید مثبت باشد`);
  }
  assert.ok(preview.easy >= preview.good, '«آسان» نباید کوتاه‌تر از «خوب» باشد');
  assert.ok(preview.good >= preview.again, '«خوب» نباید کوتاه‌تر از «دوباره» باشد');
});

/* ───────────────────────── ورودی کاربر و نام نمایشی ───────────────────────── */

test('normalizeDigits: ارقام فارسی و عربی به لاتین برمی‌گردند', () => {
  assert.equal(normalizeDigits('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  assert.equal(normalizeDigits('٠٩١٢'), '0912');
  assert.equal(normalizeDigits(' ۴۵۶ '), '456');
  assert.equal(normalizeDigits(null), '');
});

test('getDisplayName: نام کامل، سپس نام کاربری، سپس شماره', () => {
  assert.equal(getDisplayName({ profile: { firstName: 'علی', lastName: 'رضایی' } }), 'علی رضایی');
  assert.equal(getDisplayName({ profile: { firstName: 'علی' } }), 'علی');
  assert.equal(getDisplayName({ profile: { username: 'ali' } }), 'ali');
  assert.equal(getDisplayName({ phone: '0912' }), '0912');
  assert.equal(getDisplayName(null), '');
});

/* ───────────────────────────── تقویم جلالی ───────────────────────────── */

test('jalali: رفت‌وبرگشت روز جلالی↔میلادی یکسان است', () => {
  for (const [jy, jm, jd] of [[1403, 1, 1], [1402, 12, 29], [1400, 7, 15], [1399, 12, 30], [1404, 5, 1]]) {
    const jdn = jalaliToJdn(jy, jm, jd);
    assert.deepEqual(jdnToJalali(jdn), { jy, jm, jd }, `رفت‌وبرگشت ${jy}/${jm}/${jd}`);
  }
});

test('jalali: نوروز ۱۴۰۳ برابر ۲۰ مارس ۲۰۲۴ است', () => {
  assert.equal(jalaliToIso(1403, 1, 1), '2024-03-20');
});

test('jalali: سال کبیسه اسفند ۳۰ روزه دارد', () => {
  assert.equal(isLeapJalali(1403), true);
  assert.equal(isLeapJalali(1402), false);
  assert.equal(jalaliMonthLength(1403, 12), 30);
  assert.equal(jalaliMonthLength(1402, 12), 29);
});

test('jalali: تبدیل ارقام دوطرفه است', () => {
  assert.equal(toFa('1403'), '۱۴۰۳');
  assert.equal(toEn('۱۴۰۳'), '1403');
  assert.equal(toEn(toFa('987654')), '987654');
});

test('jalali: جمع و تفاضل روز سازگارند', () => {
  const start = new Date(Date.UTC(2026, 0, 10));
  const later = addDays(start, 45);
  assert.equal(diffDays(later, start), 45);
  assert.equal(diffDays(start, later), -45);
});

/* ───────────────────────────── سری ضربان ───────────────────────────── */

test('heartSeries: کلید روز رفت‌وبرگشت می‌شود', () => {
  const date = new Date(Date.UTC(2026, 4, 12, 9, 30));
  assert.equal(toDayKey(fromDayKey(toDayKey(date))), toDayKey(date));
});

test('heartSeries: شروع هفتهٔ ایران شنبه است و بعد از روز جاری نیست', () => {
  const wednesday = new Date(Date.UTC(2026, 4, 13, 9, 0));
  const start = startOfIranWeek(wednesday);
  assert.equal(start.getDay(), 6, 'شروع هفته باید شنبه باشد');
  assert.ok(start.getTime() <= wednesday.getTime(), 'شروع هفته نباید جلوتر از روز جاری باشد');
});

test('heartSeries: تجمیع روزانه نقطه‌های سری را می‌دهد', () => {
  const today = new Date(Date.UTC(2026, 4, 13));
  const series = aggregateHeartSeries([], 'daily', today);
  assert.equal(series.range, 'daily');
  assert.ok(Array.isArray(series.points), 'نقطه‌ها باید آرایه باشند');
  assert.ok(series.points.length > 0, 'سری نباید خالی باشد');
  assert.ok(series.points.every((point) => typeof point.id === 'string' && Number.isFinite(point.hearts)));
});
