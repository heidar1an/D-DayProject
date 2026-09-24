/*
 * رجیستری میکرودرسنامه‌ها — تک منبع حقیقت برای «کدام درس میکرودرسنامه دارد».
 *
 * چرا جدا شد؟ دو مصرف‌کننده داشتیم که هر دو فهرست ۱۶ درس را دستی نگه می‌داشتند:
 *   ۱) موتور خواننده (`src/services/micro/microContentService.js`)
 *   ۲) لایهٔ دادهٔ سرور (`database/contentStore.js`) برای seed و ساخت درسنامهٔ تازه
 * دو فهرست موازی یعنی روزی که یک درس اضافه شود، یکی عقب می‌ماند. اینجا فقط یک‌بار
 * import می‌شود و بقیه از همین‌جا می‌خوانند.
 *
 * این ماژول خالص داده است: نه React، نه DOM، نه `window` — پس هم در باندل مرورگر
 * و هم در Node (سرور بدون مرورگر) قابل import است.
 *
 * ترتیب کلیدها مهم است: اولین عضو، درسِ پیش‌فرضِ ورود به میکرودرسنامه است
 * (`firstPublishedCourse`). فیزیولوژی عمداً اول می‌ماند چون محتوای مرجع و کامل است.
 */

/* پسوند `.js` عمدی است: همین فایل هم در باندل Vite و هم در Node (سرور بدون مرورگر)
   خوانده می‌شود و Node برای ESM پسوند را حدس نمی‌زند. */
import anatomyCourse from './anatomyCourse.js';
import biochemistryCourse from './biochemistryCourse.js';
import embryologyCourse from './embryologyCourse.js';
import englishCourse from './englishCourse.js';
import entomologyCourse from './entomologyCourse.js';
import geneticsCourse from './geneticsCourse.js';
import histologyCourse from './histologyCourse.js';
import hygieneCourse from './hygieneCourse.js';
import immunologyCourse from './immunologyCourse.js';
import microbiologyCourse from './microbiologyCourse.js';
import mycologyCourse from './mycologyCourse.js';
import parasitologyCourse from './parasitologyCourse.js';
import pathologyCourse from './pathologyCourse.js';
import pharmacologyCourse from './pharmacologyCourse.js';
import physiologyCourse from './physiologyCourse.js';
import virologyCourse from './virologyCourse.js';

export const MICRO_COURSE_REGISTRY = {
  physiology: physiologyCourse,
  anatomy: anatomyCourse,
  biochemistry: biochemistryCourse,
  embryology: embryologyCourse,
  english: englishCourse,
  entomology: entomologyCourse,
  genetics: geneticsCourse,
  histology: histologyCourse,
  hygiene: hygieneCourse,
  immunology: immunologyCourse,
  microbiology: microbiologyCourse,
  mycology: mycologyCourse,
  parasitology: parasitologyCourse,
  pathology: pathologyCourse,
  pharmacology: pharmacologyCourse,
  virology: virologyCourse,
};

/* فهرست مرتب درس‌ها به‌صورت آرایه — برای seed سرور و فهرست انتخاب در پنل */
export const MICRO_COURSE_SOURCES = Object.entries(MICRO_COURSE_REGISTRY)
  .map(([courseId, course]) => ({ courseId, course }));

/*
 * گزینه‌های «درس» برای فرم ساخت درسنامهٔ تازه در پنل.
 * فقط دادهٔ نمایشی — هیچ‌کدام به React وابسته نیست.
 */
export const MICRO_SUBJECT_OPTIONS = MICRO_COURSE_SOURCES.map(({ courseId, course }) => ({
  id: courseId,
  title: course.title ?? courseId,
  englishTitle: course.englishTitle ?? '',
  accent: course.accent ?? '#ab8e7c',
  description: course.description ?? '',
  topics: (course.topics ?? []).length,
}));

export default MICRO_COURSE_REGISTRY;
