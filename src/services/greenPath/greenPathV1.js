/*
 * پل مسیر سبز بین فرانت و v1 (فاز ۱۳) — تنها نقطهٔ تماس UI با `/api/v1/me/green-path/*`.
 *
 * قرارداد v1:
 *   GET   /me/green-path/profile       → { profile }
 *   GET   /me/green-path/roadmap       → { path, steps, current_step, next_step, progress, meta }
 *   GET   /me/green-path/today         → { date, path_id, steps, overdue, progress }
 *   GET   /me/green-path/calendar      → { from, to, days }            (from/to با شکل Y-m-d)
 *   GET   /me/green-path/performance   → { steps, study_time, exams, trend }
 *   PATCH /me/green-path/steps/{id}    → { step }   (هدر Idempotency-Key؛ بدنه فقط status+version)
 *
 * قواعد:
 *   ۱. هویت از سشن است؛ هیچ userId‌ای به سرور نمی‌رود.
 *   ۲. سرور مالک وضعیت و تاریخ است؛ کلاینت فقط `status` پیشنهادی + `version` برای
 *      optimistic lock می‌فرستد. ۴۰۹ یعنی نسخه عقب است یا گذار نامعتبر ⇒ refetch.
 *   ۳. `createGreenPathV1Repository` دادهٔ v1 را به‌عنوان لایهٔ **جدا و افزودنی**
 *      (`serverGreenPath`) روی snapshot محلی می‌گذارد — هیچ فیلد موجود UI را
 *      بازنویسی نمی‌کند تا UI بدون بازطراحی کار کند. نگاشت شناسهٔ محتوا
 *      (UUID درس v1 ↔ شناسهٔ موضوع محلی) به cutover محتوایی موکول است.
 */

import { V1_REASON, newRequestKey, v1Request } from '../api/v1';

export const GREEN_PATH_V1_REASON = V1_REASON;

/* وضعیت‌های قدم — فقط برای تصمیم‌های نمایشی کلاینت؛ اعتباری سمت سرور دارد. */
export const STEP_STATUS = {
  LOCKED: 'locked',
  AVAILABLE: 'available',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  RECOMMENDED: 'recommended',
};

function toTarget(row) {
  if (!row || typeof row !== 'object') return null;
  return { type: row.type ?? null, id: row.id ?? null };
}

function toStep(row) {
  if (!row) return null;

  return {
    id: row.id ?? null,
    kind: row.kind ?? 'action',
    target: toTarget(row.target),
    position: Number(row.position ?? 0),
    status: row.status ?? STEP_STATUS.LOCKED,
    dueAt: row.due_at ?? null,
    completedAt: row.completed_at ?? null,
    version: Number(row.version ?? 1),
    /* نشانهٔ منبع — قدم‌های v1 با patchTask محلی نمی‌آمیزند. */
    isServerStep: true,
  };
}

function toProgress(row) {
  return {
    totalSteps: Number(row?.total_steps ?? 0),
    completedSteps: Number(row?.completed_steps ?? 0),
    percent: Number(row?.percent ?? 0),
  };
}

function toRoadmap(data) {
  return {
    path: {
      id: data?.path?.id ?? null,
      goalKey: data?.path?.goal_key ?? null,
      planVersion: Number(data?.path?.plan_version ?? 0),
      status: data?.path?.status ?? null,
      startsAt: data?.path?.starts_at ?? null,
    },
    steps: (data?.steps ?? []).map(toStep),
    currentStep: toStep(data?.current_step),
    nextStep: toStep(data?.next_step),
    progress: toProgress(data?.progress),
    meta: {
      planVersion: Number(data?.meta?.plan_version ?? 0),
      goalKey: data?.meta?.goal_key ?? null,
      generatedAt: data?.meta?.generated_at ?? null,
    },
  };
}

/**
 * پروفایل برنامهٔ مسیر سبز. خروجی: `{ ok, reason?, profile? }`.
 */
export async function fetchGreenPathProfile() {
  const result = await v1Request('/me/green-path/profile');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  const row = result.data?.profile ?? {};

  return {
    ok: true,
    profile: {
      userId: row.user_id ?? null,
      username: row.username ?? null,
      firstName: row.first_name ?? null,
      lastName: row.last_name ?? null,
      university: row.university ?? null,
      grade: row.grade ?? null,
      term: row.term ?? null,
      goalKey: row.goal_key ?? null,
      planVersion: Number(row.plan_version ?? 0),
      planStart: row.plan_start ?? null,
      planEnd: row.plan_end ?? null,
    },
  };
}

/**
 * نقشهٔ راه کامل (کش کوتاه‌مدت سمت سرور دارد).
 */
export async function fetchGreenPathRoadmap() {
  const result = await v1Request('/me/green-path/roadmap');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  return { ok: true, roadmap: toRoadmap(result.data) };
}

/**
 * قدم‌های امروز + عقب‌افتاده‌ها. «امروز» را سرور تعیین می‌کند.
 */
export async function fetchGreenPathToday() {
  const result = await v1Request('/me/green-path/today');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  const row = result.data ?? {};

  return {
    ok: true,
    today: {
      date: row.date ?? null,
      pathId: row.path_id ?? null,
      steps: (row.steps ?? []).map(toStep),
      overdue: (row.overdue ?? []).map(toStep),
      progress: toProgress(row.progress),
    },
  };
}

/**
 * تقویم برنامه در بازهٔ بسته — `from`/`to` با شکل `Y-m-d`؛ سقف بازه سرور است.
 */
export async function fetchGreenPathCalendar({ from, to } = {}) {
  const params = new URLSearchParams();

  if (from) params.set('from', from);
  if (to) params.set('to', to);

  const query = params.toString();
  const result = await v1Request(`/me/green-path/calendar${query ? `?${query}` : ''}`);

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  const row = result.data ?? {};

  return {
    ok: true,
    calendar: {
      from: row.from ?? null,
      to: row.to ?? null,
      days: (row.days ?? []).map((day) => ({
        date: day.date ?? null,
        steps: (day.steps ?? []).map(toStep),
        plannedMinutes: Number(day.planned_minutes ?? 0),
      })),
    },
  };
}

/**
 * عملکرد واقعی کاربر در مسیر — همهٔ اعداد از جداول منبع بک‌اند.
 */
export async function fetchGreenPathPerformance() {
  const result = await v1Request('/me/green-path/performance');

  if (!result.ok) return { ok: false, reason: result.reason, status: result.status, code: result.code ?? null };

  const row = result.data ?? {};

  return {
    ok: true,
    performance: {
      steps: {
        total: Number(row.steps?.total ?? 0),
        completed: Number(row.steps?.completed ?? 0),
        overdue: Number(row.steps?.overdue ?? 0),
        completionRate: Number(row.steps?.completion_rate ?? 0),
      },
      studyTime: {
        sessions: Number(row.study_time?.sessions ?? 0),
        seconds: Number(row.study_time?.seconds ?? 0),
      },
      exams: {
        taken: Number(row.exams?.taken ?? 0),
        avgPercentage: Number(row.exams?.avg_percentage ?? 0),
      },
      trend: (row.trend ?? []).map((point) => ({ date: point.date ?? null, completed: Number(point.completed ?? 0) })),
    },
  };
}

/**
 * تغییر وضعیت یک قدم — تنها mutation مسیر سبز.
 *
 * `version` اجباری است (optimistic lock). خروجی ناموفق:
 *   `conflict: true`          ⇒ نسخه عقب است یا گذار نامعتبر ⇒ refetch و تلاش دوباره.
 *   `notFound: true`          ⇒ قدم متعلق به کاربر جاری نیست یا وجود ندارد.
 * پاسخ تکراری همان Idempotency-Key با `replayed: true` بازمی‌گردد.
 */
export async function updateGreenPathStep(stepId, { status, version, requestKey } = {}) {
  const result = await v1Request(`/me/green-path/steps/${encodeURIComponent(stepId)}`, {
    method: 'PATCH',
    body: { status, version },
    idempotencyKey: requestKey ?? newRequestKey('gp-step'),
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      status: result.status,
      code: result.code ?? null,
      conflict: result.status === 409,
      notFound: result.status === 404,
      invalidTransition: result.code === 'INVALID_TRANSITION',
    };
  }

  return { ok: true, step: toStep(result.data?.step), replayed: result.status === 200 && result.meta?.replayed === true };
}

/**
 * Repository سازگار با قرارداد `greenPathService` — دادهٔ v1 به‌صورت لایهٔ افزودنی.
 *
 * - `getSnapshot`: snapshot محلی (fallback) + `serverGreenPath` وقتی v1 واقعاً سرو می‌شود.
 *   `dataStatus.greenPathServer` منبع داده را صادقانه اعلام می‌کند.
 * - `patchTask`: قدم‌های `isServerStep` به `updateGreenPathStep` می‌روند؛ بقیه محلی‌اند.
 * - بقیهٔ متدها (پروفایل/اهداف/ددلاین/…) هنوز قرارداد v1 ندارند ⇒ به fallback سپرده می‌شوند.
 */
export function createGreenPathV1Repository({ fallback } = {}) {
  if (!fallback || typeof fallback.getSnapshot !== 'function') {
    throw new Error('GREEN_PATH_V1_FALLBACK_REQUIRED');
  }

  return {
    async getSnapshot(userRef, options = {}) {
      const base = await fallback.getSnapshot(userRef, options);
      const [roadmap, today] = await Promise.all([fetchGreenPathRoadmap(), fetchGreenPathToday()]);

      if (!roadmap.ok || !today.ok) {
        const unavailable = roadmap.reason === V1_REASON.NOT_V1 && today.reason === V1_REASON.NOT_V1;

        return {
          ...base,
          dataStatus: { ...(base.dataStatus ?? {}), greenPathServer: unavailable ? 'unavailable' : 'error' },
        };
      }

      return {
        ...base,
        serverGreenPath: {
          roadmap: roadmap.roadmap,
          today: today.today,
          fetchedAt: new Date().toISOString(),
        },
        dataStatus: { ...(base.dataStatus ?? {}), greenPathServer: 'connected' },
      };
    },

    async patchTask(userRef, task, patch) {
      if (task?.isServerStep && task?.id && task?.version != null) {
        if (patch?.state === 'completed') {
          return updateGreenPathStep(task.id, { status: STEP_STATUS.COMPLETED, version: task.version });
        }

        /* گذارهای دیگر قدم‌های سرور (جابه‌جایی تاریخ و…) هنوز قرارداد v1 ندارند. */
        return { ok: false, reason: V1_REASON.API, code: 'UNSUPPORTED_SERVER_STEP_PATCH' };
      }

      return fallback.patchTask(userRef, task, patch);
    },

    updateStep: (stepId, payload) => updateGreenPathStep(stepId, payload),

    getState: (userRef) => fallback.getState(userRef),
    saveProfile: (userRef, patch) => fallback.saveProfile(userRef, patch),
    saveGoals: (userRef, goals) => fallback.saveGoals(userRef, goals),
    completeOnboarding: (userRef, payload) => fallback.completeOnboarding(userRef, payload),
    saveStudySession: (userRef, session) => fallback.saveStudySession(userRef, session),
    addDeadline: (userRef, deadline) => fallback.addDeadline(userRef, deadline),
    setRecoveryMode: (userRef, mode) => fallback.setRecoveryMode(userRef, mode),
    reset: (userRef) => fallback.reset(userRef),
  };
}
