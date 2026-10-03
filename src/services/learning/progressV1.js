/*
 * پل پیشرفت یادگیری بین فرانت و v1 (فاز ۵).
 *
 * قرارداد v1:
 *   GET  /me/progress                 → { progress: { totals, courses } }
 *   GET  /me/progress/pages/{id}      → { page, progress }
 *   PUT  /me/progress/pages/{id}      → { progress }            (هدر Idempotency-Key)
 *   POST /me/study-sessions           → { study_session }        (هدر Idempotency-Key)
 *
 * سه تفاوت شکل که این پل جبران می‌کند (هیچ کامپوننتی عوض نمی‌شود):
 *   ۱. v1 با snake_case می‌آید (`seconds_spent`, `completed_at`) و UI با camelCase.
 *   ۲. `secondsSpent` در v1 یک **دلتا** است، نه مقدار مطلق ⇒ همان‌طور پاس می‌شود.
 *   ۳. `version` برای optimistic lock اجباری است؛ `0` یعنی «رکوردی نیست».
 *
 * `mastery` در v1 وجود ندارد. اینجا `null` برمی‌گردد و **ساخته نمی‌شود** — عدد
 * ساختگی بدتر از نبود عدد است.
 */

import { V1_REASON, newRequestKey, v1Request } from '../api/v1';

export const PROGRESS_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

/* پاسخ «رکوردی نیست» که سرور می‌دهد: id=null و version=0 ⇒ همان چیزی که اولین PUT باید بفرستد. */
export const EMPTY_PAGE_PROGRESS = {
  id: null,
  lessonPageId: null,
  status: PROGRESS_STATUS.NOT_STARTED,
  lastPosition: null,
  secondsSpent: 0,
  version: 0,
  completedAt: null,
  updatedAt: null,
};

function toPageProgress(row) {
  if (!row) return { ...EMPTY_PAGE_PROGRESS };

  return {
    id: row.id ?? null,
    lessonPageId: row.lesson_page_id ?? null,
    status: row.status ?? PROGRESS_STATUS.NOT_STARTED,
    lastPosition: row.last_position ?? null,
    secondsSpent: Number(row.seconds_spent ?? 0),
    version: Number(row.version ?? 0),
    completedAt: row.completed_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/* خلاصهٔ کاربر. aggregate سمت سرور مشتق می‌شود؛ اینجا فقط نام‌ها یکسان می‌شوند. */
function toSummary(progress) {
  const totals = progress?.totals ?? {};

  return {
    totals: {
      trackedPages: Number(totals.tracked_pages ?? 0),
      completedPages: Number(totals.completed_pages ?? 0),
      secondsSpent: Number(totals.seconds_spent ?? 0),
      studySessions: Number(totals.study_sessions ?? 0),
      studySeconds: Number(totals.study_seconds ?? 0),
    },
    courses: (progress?.courses ?? []).map((course) => ({
      courseId: course.course_id,
      courseSlug: course.course_slug,
      courseTitle: course.course_title,
      subjectSlug: course.subject_slug,
      subjectTitle: course.subject_title,
      trackedPages: Number(course.tracked_pages ?? 0),
      completedPages: Number(course.completed_pages ?? 0),
      totalPages: Number(course.total_pages ?? 0),
      percent: Number(course.percent ?? 0),
      secondsSpent: Number(course.seconds_spent ?? 0),
    })),
  };
}

/**
 * خلاصهٔ پیشرفت کاربر.
 * خروجی: `{ ok, reason?, summary? }` — `reason: 'not_v1'` یعنی مسیر قدیمی.
 */
export async function fetchProgressSummary() {
  const result = await v1Request('/me/progress');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, summary: toSummary(result.data?.progress) };
}

/**
 * پیشرفت یک صفحه + خود صفحه.
 * `pageId` باید UUID صفحهٔ درس باشد؛ صفحهٔ نامعتبر ۴۰۴ می‌دهد.
 */
export async function fetchPageProgress(pageId) {
  const result = await v1Request(`/me/progress/pages/${encodeURIComponent(pageId)}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, progress: toPageProgress(result.data?.progress), page: result.data?.page ?? null };
}

/**
 * ثبت پیشرفت صفحه.
 *
 * `version` **اجباری** است: `0` برای اولین ثبت. عدم تطابق ⇒ `{ ok:false, conflict:true }`
 * و کلاینت باید خلاصه/صفحه را refetch کند (سرور نسخهٔ فعلی را در `message` می‌آورد).
 *
 * `secondsSpent` دلتای این بازه است، نه کل زمان. `lastPosition` یکنوا نیست.
 * `completed=true` فقط پیشنهاد است؛ سرور تعیین می‌کند (و چسبنده است).
 */
export async function savePageProgress(pageId, { version, lastPosition = null, completed = false, secondsSpent = 0, requestKey } = {}) {
  const result = await v1Request(`/me/progress/pages/${encodeURIComponent(pageId)}`, {
    method: 'PUT',
    body: { version, lastPosition, completed, secondsSpent },
    idempotencyKey: requestKey ?? newRequestKey('progress'),
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      /* ۴۰۹ = کسی دیگر (تب دیگر) نسخه را جلو برده ⇒ refetch لازم است. */
      conflict: result.status === 409,
    };
  }

  return { ok: true, progress: toPageProgress(result.data?.progress) };
}

/**
 * ثبت نشست مطالعه.
 *
 * `startedAt`/`endedAt` ISO ۸۶۰۱ هستند. `durationSec` فقط **پیشنهاد** است؛ سرور
 * بازه را اعتبارسنجی می‌کند و مقدار غیرواقعی را رد می‌کند (۴۲۲). مقدار ارسالی از
 * اختلاف دو timestamp ساخته می‌شود تا با سرور ناسازگار نباشد.
 */
export async function recordStudySession({ lessonPageId = null, source, startedAt, endedAt, durationSec = null, requestKey } = {}) {
  const derived = durationSec ?? deriveDurationSec(startedAt, endedAt);

  const result = await v1Request('/me/study-sessions', {
    method: 'POST',
    body: { lessonPageId, source, startedAt, endedAt, durationSec: derived },
    idempotencyKey: requestKey ?? newRequestKey('session'),
  });

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  const session = result.data?.study_session ?? {};

  return {
    ok: true,
    session: {
      id: session.id ?? null,
      lessonPageId: session.lesson_page_id ?? null,
      source: session.source ?? null,
      startedAt: session.started_at ?? null,
      endedAt: session.ended_at ?? null,
      durationSec: Number(session.duration_sec ?? 0),
    },
  };
}

/* اختلاف دو ISO — کلاینت عدد را «می‌سازد» ولی سرور بازهم آن را verify می‌کند. */
function deriveDurationSec(startedAt, endedAt) {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  return Math.max(0, Math.round((end - start) / 1000));
}

/*
 * نگاشت خلاصهٔ v1 به شکلی که `ProgressService.getCourseSummary` به UI می‌دهد.
 * `mastery` عمداً `null` است — v1 چنین مفهومی ندارد و عدد ساختگی نمی‌سازیم.
 */
export function courseSummaryFor(summary, courseSlug) {
  const course = summary?.courses?.find((row) => row.courseSlug === courseSlug);

  if (!course) return { progress: 0, mastery: null, completed: 0, total: 0, secondsSpent: 0 };

  return {
    progress: course.percent,
    mastery: null,
    completed: course.completedPages,
    total: course.totalPages,
    secondsSpent: course.secondsSpent,
  };
}

export { V1_REASON };
