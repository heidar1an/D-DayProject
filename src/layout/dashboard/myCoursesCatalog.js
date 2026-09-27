/*
 * منبعِ واحدِ «دوره‌های من» — سینک‌شده با سه خانوادهٔ واقعیِ دوره‌ها:
 *   • درسنامهٔ جامع     (ComprehensiveCourseLayer → SUBJECTS)
 *   • میکرو درسنامه    (MicroCourseLayer → SUBJECTS)
 *   • دوره‌های بین‌الملل (InternationalCoursesLayer → COURSES)
 *
 * هر خانواده هویت بصریِ خودش را دارد (COURSE_KINDS): رنگ، آیکون، برچسب،
 * بافتِ کارت و مدلِ نمایشِ پیشرفت — همه برداشت‌شده از همان لایه‌ای که دوره
 * از آن آمده تا «دوره‌های من» با کل سایت یک‌دست بماند.
 *
 * پیشرفتِ هر دوره از فعّالیّت واقعیِ کاربر (localStorage از طریق MyCoursesService)
 * خوانده می‌شود و اگر فعّالیّتی ثبت نشده باشد، همان مقداری نمایش داده می‌شود که
 * خودِ آن بخش نمایش می‌دهد؛ در نتیجه «دوره‌های من» همیشه با آن بخش‌ها هم‌خوان است.
 */

import { SUBJECTS as COMPREHENSIVE_SUBJECTS } from './courses/ComprehensiveCourseLayer';
import { SUBJECTS as MICRO_SUBJECTS } from './courses/MicroCourseLayer';
import { COURSES as INTERNATIONAL_COURSES } from './courses/InternationalCoursesLayer';
import { MyCoursesService } from '../../services/learning';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const toFa = (value) =>
  String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/**
 * هویت بصریِ هر خانوادهٔ دوره.
 *   accent  — رنگِ ثابتِ «نوع دوره» (برای چیپ، آیکون و نوار لبه)
 *   icon    — آیکونِ اختصاصی (book / bolt / globe؛ هم‌زبان با لایهٔ خودش)
 *   surface — بافتِ کارت: solid (هاله) | dashed (هاشور) | grid (شبکه + اورب)
 *   meter   — مدل نمایش پیشرفت: bar (پیوسته) | segments (قطعه‌ای) | beads (مهره‌ای)
 */
export const COURSE_KINDS = {
  comprehensive: {
    id: 'comprehensive',
    label: 'درسنامه جامع',
    shortLabel: 'جامع',
    accent: '#5b8cc7',
    icon: 'book',
    surface: 'solid',
    meter: 'bar',
    action: 'ادامه یادگیری',
    doneAction: 'مرور دوباره',
  },
  micro: {
    id: 'micro',
    label: 'میکرو درسنامه',
    shortLabel: 'میکرو',
    accent: '#937fcd',
    icon: 'bolt',
    surface: 'dashed',
    meter: 'segments',
    action: 'ادامه مرور',
    doneAction: 'مرور سه‌سوته',
  },
  international: {
    id: 'international',
    label: 'دوره‌های بین‌الملل',
    shortLabel: 'بین‌الملل',
    accent: '#61d192',
    icon: 'globe',
    surface: 'grid',
    meter: 'beads',
    action: 'ادامه تماشا',
    doneAction: 'مرور دوباره',
  },
};

/* ترتیب نمایش خانواده‌ها در راهنما و فیلترها */
export const COURSE_KIND_ORDER = ['comprehensive', 'micro', 'international'];

/**
 * فهرست دوره‌های «دوره‌های من».
 * خروجی هر آیتم:
 *   key      — کلید یکتا (<kind>:<id>)
 *   kind     — یکی از کلیدهای COURSE_KINDS؛ تعیین‌کنندهٔ ظاهر کارت
 *   courseId — لایه‌ای که باید باز شود ('comprehensive' | 'micro' | 'international')
 *   target   — لینک عمیق به همان درس/دوره
 *   title    — نام دوره
 *   accent   — رنگ اختصاصیِ خودِ دوره (هم‌رنگ با آن بخش)
 *   tagline  — خلاصه‌ای که نوع دوره را هم توضیح می‌دهد
 *   progress — درصد پیشرفت (واقعی یا هم‌خوان با آن بخش)
 */
export function buildMyCourses() {
  const activity = MyCoursesService.getActivity();

  /* ── ۱) درسنامهٔ جامع ── */
  const comprehensive = COMPREHENSIVE_SUBJECTS.map((subject) => {
    const real = activity[subject.id] ?? null;
    /* پیشرفت: فعّالیّت واقعی مقدم است؛ در غیر این صورت همان مقداری که خودِ بخش نشان می‌دهد */
    const progress = real?.progress ?? subject.progress ?? 0;

    const parts = [];
    if (subject.chapters) parts.push(`${toFa(subject.chapters)} فصل`);
    if (subject.lessons) parts.push(`${toFa(subject.lessons)} درسنامه`);
    if (subject.tests) parts.push(`${toFa(subject.tests)} تست`);

    return {
      key: `comprehensive:${subject.id}`,
      kind: 'comprehensive',
      courseId: 'comprehensive',
      target: { subject: subject.id },
      title: subject.title,
      accent: subject.accent,
      accentSoft: null,
      image: subject.image ?? null,
      glyph: subject.glyph ?? null,
      tagline: parts.join(' · '),
      progress,
      lastStudiedAt: real?.lastStudiedAt ?? null,
      hasRealActivity: Boolean(real),
    };
  });

  /* ── ۲) میکرو درسنامه — پیشرفت دقیقاً همان چیزی که خودِ این بخش نشان می‌دهد ── */
  const micro = MICRO_SUBJECTS.map((subject) => ({
    key: `micro:${subject.id}`,
    kind: 'micro',
    courseId: 'micro',
    target: { subject: subject.id },
    title: subject.title,
    accent: subject.accent,
    accentSoft: null,
    image: null,
    glyph: null,
    tagline: subject.minutes ? `${toFa(subject.minutes)} دقیقه مرور فشرده` : 'مرور فشرده',
    progress: subject.progress ?? 0,
    lastStudiedAt: null,
    hasRealActivity: false,
  }));

  /* ── ۳) دوره‌های بین‌الملل — با نام ارائه‌دهنده، هم‌زبان با لایهٔ بین‌الملل ── */
  const international = INTERNATIONAL_COURSES.map((course) => ({
    key: `international:${course.id}`,
    kind: 'international',
    courseId: 'international',
    target: null,
    title: course.title,
    accent: course.accent,
    accentSoft: course.accentSoft ?? null,
    image: null,
    glyph: null,
    provider: course.provider,
    providerEn: course.providerEn,
    tagline: `${course.provider} · ${toFa(course.lessons)} ویدیو`,
    progress: course.progress ?? 0,
    lastStudiedAt: null,
    hasRealActivity: false,
  }));

  return [...comprehensive, ...micro, ...international];
}

/* وضعیت هر دوره بر اساس پیشرفت */
export const courseStatus = (course) =>
  course.progress >= 100 ? 'completed' : course.progress > 0 ? 'in_progress' : 'not_started';

/* زمان نسبی برای نمایش «آخرین مطالعه» */
export function relativeTime(isoDate) {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return '';

  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${toFa(minutes)} دقیقه پیش`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${toFa(hours)} ساعت پیش`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'دیروز';
  if (days < 7) return `${toFa(days)} روز پیش`;
  return new Date(timestamp).toLocaleDateString('fa-IR');
}
