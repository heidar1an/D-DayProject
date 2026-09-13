import anatomyCourse from '../../data/learning/anatomyCourse';

const COURSE_REGISTRY = {
  anatomy: anatomyCourse,
};

const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

/**
 * قرارداد دسترسی به محتوا. پیاده‌سازی امروز از داده محلی می‌خواند؛ نسخه API فقط
 * کافی است بدنه این متدها را عوض کند.
 */
export const ContentService = {
  async getCourse(courseId, { signal } = {}) {
    await wait(180);

    if (signal?.aborted) {
      throw new DOMException('درخواست لغو شد', 'AbortError');
    }

    const course = COURSE_REGISTRY[courseId];
    if (!course) throw new Error('محتوای این درس پیدا نشد.');
    return course;
  },

  getModule(course, moduleId) {
    return course.modules.find((module) => module.id === moduleId) ?? null;
  },

  getUnits(course, moduleId) {
    return course.unitsByModule[moduleId] ?? [];
  },

  getUnit(course, unitId) {
    return Object.values(course.unitsByModule)
      .flat()
      .find((unit) => unit.id === unitId) ?? null;
  },
};

export default ContentService;
