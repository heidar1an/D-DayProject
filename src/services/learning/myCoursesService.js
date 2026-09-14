import anatomyCourse from '../../data/learning/anatomyCourse';
import { ProgressService } from './progressService';

const STORAGE_PREFIX = 'tapesh:learning:v1:';

/* شناسه محتوایی دوره‌های کاتالوگ «دوره های من» — دوره‌های آینده همین‌جا اضافه می‌شوند */
const COURSE_CONTENT_IDS = {
  comprehensive: 'anatomy',
};

/**
 * فعالیت واقعی کاربر را از localStorage می‌خواند. هر کلید «tapesh:learning:v1» فقط
 * بعد از یک فعالیت واقعی (شروع یا پیشروی) در همان درس ثبت می‌شود؛ در نتیجه وجودش
 * یعنی کاربر آن دوره را شروع کرده است.
 */
export const MyCoursesService = {
  getActivity() {
    if (typeof window === 'undefined') return {};

    const activityByCourse = {};

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;

      let state;
      try {
        state = JSON.parse(window.localStorage.getItem(key) || 'null');
      } catch {
        continue;
      }
      if (!state?.updatedAt) continue;

      /* ساختار کلید: tapesh:learning:v1:<userId>:<courseId> */
      const courseId = key.slice(STORAGE_PREFIX.length).split(':').pop();
      const previous = activityByCourse[courseId];
      if (previous && new Date(previous.lastStudiedAt) >= new Date(state.updatedAt)) continue;

      activityByCourse[courseId] = {
        courseId,
        lastStudiedAt: state.updatedAt,
        lastLocation: state.lastLocation ?? null,
        progress: this.getProgress(courseId, state),
      };
    }

    return activityByCourse;
  },

  getProgress(courseId, state) {
    if (courseId === COURSE_CONTENT_IDS.comprehensive) {
      return ProgressService.getCourseSummary(anatomyCourse, state).progress;
    }

    /* دوره‌هایی که هنوز مدل محتوایی ندارند: میانگین پیشرفت واحدهای ثبت‌شده */
    const unitStates = Object.values(state.units ?? {});
    if (!unitStates.length) return null;
    return Math.round(
      unitStates.reduce((sum, unitState) => sum + (unitState.progress ?? 0), 0) / unitStates.length,
    );
  },
};

export default MyCoursesService;
