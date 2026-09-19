/*
 * Repository مسیر سبز.
 *
 * قرارداد Backend آینده:
 *   GET   /api/green-path/profile
 *   GET   /api/green-path/roadmap
 *   GET   /api/green-path/today
 *   GET   /api/green-path/calendar
 *   GET   /api/green-path/performance
 *   GET   /api/green-path/recommendations
 *   POST  /api/green-path/recalculate
 *   PATCH /api/green-path/tasks/:id
 *   POST  /api/green-path/study-sessions
 *   POST  /api/green-path/deadlines
 *
 * UI فقط Repository contract را می‌بیند. Mock و API جایگزین هم‌شکل‌اند.
 */
import { EXAMS } from '../coordinatedExams/examCatalog';
import { loadAttemptHistory } from '../analytics/analyticsService';
import { buildCurriculumGraph } from './curriculumEngine';
import { buildResourcesForTopic } from './resourceEngine';
import { buildRoadmapModel } from './roadmapEngine';
import { buildTopicPerformance, buildCourseProgress, buildExamReadiness, buildOverallProgress, buildRiskSignals } from './progressEngine';
import { assessAdaptation } from './adaptiveEngine';
import { buildRecoveryPlan } from './recoveryEngine';
import { buildRecommendations } from './recommendationEngine';
import { buildYearPlan } from './periodEngine';
import { buildCalendarEvents } from './calendarEngine';
import { DEFAULT_PLANNING_CONFIG, GREEN_PATH_API_BASE, GREEN_PATH_STORAGE_KEY, GOAL_PROFILES } from './greenPathConfig';

const DAY_MS = 86400000;
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const nowIso = (value = new Date()) => new Date(value).toISOString();
const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
const addDays = (value, days) => new Date(new Date(value).getTime() + days * DAY_MS);
const addWeeks = (value, weeks) => addDays(value, weeks * 7);
const asNumber = (value, fallback) => {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const normalized = String(value).replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const safeUserId = (userRef) => String(typeof userRef === 'string' ? userRef : userRef?.id ?? userRef?.phone ?? 'guest');

const safeRead = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const safeWrite = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* نبود فضای ذخیره‌سازی نباید مسیر خواندن را از کار بیندازد. */
  }
};

const stateKey = (userId) => `${GREEN_PATH_STORAGE_KEY}:${userId}`;
const emptyState = () => ({ version: 1, profile: null, goals: null, taskPatches: {}, studySessions: [], deadlines: [], recoveryMode: 'balanced', onboardingCompleted: false, updatedAt: null });

function loadState(userId) {
  const state = safeRead(stateKey(userId), emptyState());
  return { ...emptyState(), ...(state && typeof state === 'object' ? state : {}) };
}

function saveState(userId, state) {
  const next = { ...state, version: 1, updatedAt: nowIso() };
  safeWrite(stateKey(userId), next);
  return next;
}

function createProfile(userRef, state, now) {
  const userProfile = typeof userRef === 'object' ? userRef?.profile ?? {} : {};
  const saved = state.profile ?? {};
  const defaultCurrentWeek = 1;
  const totalWeeks = Math.max(1, asNumber(saved.totalWeeks ?? userProfile.totalWeeks, 52));
  const currentWeek = Math.min(totalWeeks, Math.max(1, asNumber(saved.currentWeek ?? userProfile.currentWeek, defaultCurrentWeek)));
  const start = saved.planStart ?? userProfile.planStart ?? saved.semesterStart ?? userProfile.semesterStart ?? now;
  const end = saved.planEnd ?? userProfile.planEnd ?? saved.semesterEnd ?? userProfile.semesterEnd ?? addWeeks(start, totalWeeks);
  const weekdayCapacity = saved.capacityByWeekday ?? userProfile.capacityByWeekday ?? {
    0: 180,
    1: 240,
    2: 180,
    3: 300,
    4: 240,
    5: 120,
    6: 90,
  };

  return {
    entityType: 'AcademicProfile',
    id: `academic-profile:${safeUserId(userRef)}`,
    userId: safeUserId(userRef),
    university: saved.university ?? userProfile.university ?? 'دانشگاه علوم پزشکی',
    degree: saved.degree ?? userProfile.degree ?? 'پزشکی',
    semester: asNumber(saved.semester ?? userProfile.term, 4),
    academicYear: saved.academicYear ?? userProfile.academicYear ?? '۱۴۰۵–۱۴۰۶',
    planStart: nowIso(start),
    planEnd: nowIso(end),
    semesterStart: nowIso(saved.semesterStart ?? userProfile.semesterStart ?? start),
    semesterEnd: nowIso(saved.semesterEnd ?? userProfile.semesterEnd ?? end),
    currentWeek,
    totalWeeks,
    capacityByWeekday: weekdayCapacity,
    defaultDailyMinutes: asNumber(saved.defaultDailyMinutes ?? userProfile.defaultDailyMinutes, 180),
    freeHoursPerWeek: Object.values(weekdayCapacity).reduce((sum, value) => sum + asNumber(value, 0), 0) / 60,
    updatedAt: nowIso(),
  };
}

function createGoals(state) {
  if (Array.isArray(state.goals) && state.goals.length) return state.goals;
  return [
    {
      id: 'goal:semester-excellence',
      entityType: 'Goal',
      kind: 'semester-excellence',
      title: GOAL_PROFILES['semester-excellence'].title,
      weight: 0.7,
      priority: 1,
      targets: [
        { id: 'target:semester-coverage', entityType: 'GoalTarget', metric: 'coverage', target: 85, unit: 'percent' },
        { id: 'target:exam-readiness', entityType: 'GoalTarget', metric: 'examReadiness', target: 75, unit: 'percent' },
      ],
    },
    {
      id: 'goal:basic-sciences',
      entityType: 'Goal',
      kind: 'basic-sciences',
      title: GOAL_PROFILES['basic-sciences'].title,
      weight: 0.3,
      priority: 2,
      targets: [
        { id: 'target:basic-coverage', entityType: 'GoalTarget', metric: 'coverage', target: 70, unit: 'percent' },
        { id: 'target:basic-accuracy', entityType: 'GoalTarget', metric: 'accuracy', target: 75, unit: 'percent' },
      ],
    },
  ];
}

function mapCourseIds(graph, labels = []) {
  return [...new Set(labels.map((label) => {
    const wanted = String(label).toLowerCase();
    return graph.courses.find((course) => wanted.includes(course.title.toLowerCase()) || course.title.toLowerCase().includes(wanted))?.id ?? null;
  }).filter(Boolean))];
}

function createExams(graph, now) {
  return EXAMS.map((exam) => {
    const courseIds = mapCourseIds(graph, exam.topics ?? [exam.subject]);
    const topicIds = graph.topics.filter((topic) => courseIds.includes(topic.courseId)).map((topic) => topic.id);
    return {
      entityType: 'Exam',
      id: exam.id,
      title: exam.title,
      type: exam.type,
      date: nowIso(exam.startTime),
      topics: exam.topics ?? [],
      courseIds,
      topicIds,
      weight: exam.type === 'national' || exam.type === 'mock' ? 1 : exam.type === 'subject' ? 0.8 : 0.55,
      importance: exam.type === 'national' || exam.type === 'mock' ? 1 : 0.75,
      status: new Date(exam.startTime) >= new Date(now) ? 'upcoming' : 'finished',
      sourceExamId: exam.id,
      createdAt: nowIso(now),
      updatedAt: nowIso(now),
    };
  });
}

function createDeadlines(profile, state, exams, now) {
  const standard = [
    {
      id: 'deadline:semester-final',
      entityType: 'Deadline',
      title: 'امتحان پایان‌ترم',
      date: profile.semesterEnd,
      type: 'semester-final',
      importance: 1,
      topicIds: [],
      completed: false,
    },
    {
      id: 'deadline:mid-coverage',
      entityType: 'Deadline',
      title: 'هدف پوشش نیمهٔ ترم',
      date: nowIso(addDays(now, Math.max(7, Math.round((new Date(profile.semesterEnd) - new Date(now)) / 86400000 / 2)))),
      type: 'coverage-target',
      importance: 0.7,
      topicIds: [],
      completed: false,
    },
  ];
  const custom = (state.deadlines ?? []).map((deadline) => ({
    ...deadline,
    entityType: 'Deadline',
    date: nowIso(deadline.date),
    topicIds: deadline.topicIds ?? [],
  }));
  const examDeadlines = exams
    .filter((exam) => new Date(exam.date) >= new Date(now))
    .map((exam) => ({
      id: `deadline:exam:${exam.id}`,
      entityType: 'Deadline',
      title: exam.title,
      date: exam.date,
      type: 'exam',
      examId: exam.id,
      importance: exam.importance,
      topicIds: exam.topicIds,
      completed: false,
    }));
  return [...standard, ...custom, ...examDeadlines].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function serializeGraph(graph) {
  return {
    courses: graph.courses,
    topics: graph.topics,
    edges: graph.edges,
    stats: graph.stats,
  };
}

function currentPlans(roadmap, now) {
  const today = dateKey(now);
  const todayPlan = roadmap.byDate.find((day) => day.date === today) ?? { date: today, tasks: [], plannedMinutes: 0, effectiveMinutes: 0, utilization: 0 };
  const weekEnd = dateKey(addDays(now, 6));
  const weekTasks = roadmap.tasks.filter((task) => task.plannedDate >= today && task.plannedDate <= weekEnd);
  return {
    dailyPlan: { entityType: 'DailyPlan', date: today, tasks: todayPlan.tasks, plannedMinutes: todayPlan.plannedMinutes, capacity: todayPlan.effectiveMinutes, utilization: todayPlan.utilization },
    weeklyPlan: { entityType: 'WeeklyPlan', startDate: today, endDate: weekEnd, tasks: weekTasks, plannedMinutes: weekTasks.reduce((sum, task) => sum + task.durationMinutes, 0) },
  };
}

function pathStatus({ adaptation, risks, overall, examReadiness }) {
  if (adaptation.status === 'behind') return { code: 'behind', label: 'Behind Schedule', reason: adaptation.explanation };
  if (adaptation.status === 'at-risk' || risks.some((risk) => risk.severity === 'high')) return { code: 'at-risk', label: 'At Risk', reason: risks[0]?.reason ?? adaptation.explanation };
  if (adaptation.status === 'ahead' || overall.overall >= 75) return { code: 'ahead', label: 'Ahead of Schedule', reason: 'نرخ تکمیل و تسلط از حداقل مسیر فعلی جلوتر است.' };
  const nearest = examReadiness.find((exam) => exam.daysRemaining >= 0);
  return { code: 'on-track', label: 'On Track', reason: nearest ? `تا ${nearest.title} هنوز ظرفیت اصلاح و پیشروی وجود دارد.` : 'برنامه با ظرفیت فعلی هم‌خوان است.' };
}

export function createGreenPathMockRepository() {
  return {
    async getSnapshot(userRef, { now = new Date() } = {}) {
      const userId = safeUserId(userRef);
      const state = loadState(userId);
      const graph = buildCurriculumGraph({ now: nowIso(now) });
      const profile = createProfile(userRef, state, now);
      const goals = createGoals(state).sort((a, b) => a.priority - b.priority);
      const exams = createExams(graph, now);
      const deadlines = createDeadlines(profile, state, exams, now);
      const resources = graph.topics.flatMap((topic) => buildResourcesForTopic({ topic, course: graph.courseById.get(topic.courseId), knowledgeNodeId: topic.knowledgeNodeId, now: nowIso(now) }));
      let history = { attempts: [], sessions: [] };
      try {
        history = loadAttemptHistory(userId);
      } catch {
        /* منبع تحلیل ممکن است در حالت آفلاین/تست در دسترس نباشد؛ دادهٔ صادقانه خالی می‌ماند. */
      }
      const topicPerformance = buildTopicPerformance({ graph, attempts: history.attempts, taskPatches: state.taskPatches, now: nowIso(now) });
      const courseProgress = buildCourseProgress({ graph, topicPerformance });
      const examReadiness = buildExamReadiness({ exams, graph, topicPerformance, now: nowIso(now) });
      const roadmap = buildRoadmapModel({ profile, goals, graph, topicPerformance, exams, deadlines, taskPatches: state.taskPatches, resources, now: nowIso(now), config: DEFAULT_PLANNING_CONFIG });
      const adaptation = assessAdaptation({ tasks: roadmap.tasks, studySessions: state.studySessions, now: nowIso(now) });
      const recovery = buildRecoveryPlan({ tasks: roadmap.tasks, profile, now, mode: state.recoveryMode ?? 'balanced', config: DEFAULT_PLANNING_CONFIG });
      const overall = buildOverallProgress({ courseProgress, topicPerformance, roadmap });
      const risks = buildRiskSignals({ courseProgress, topicPerformance, examReadiness, backlogMinutes: adaptation.backlogMinutes, now: nowIso(now) });
      const recommendations = buildRecommendations({ graph, topicPerformance, courseProgress, examReadiness, tasks: roadmap.tasks, adaptation });
      const status = pathStatus({ adaptation, risks, overall, examReadiness });
      const plans = currentPlans(roadmap, now);
      const yearPlan = buildYearPlan({ profile, goals, phases: roadmap.phases, tasks: roadmap.tasks, milestones: roadmap.milestones, exams, now: nowIso(now) });
      const calendarEvents = buildCalendarEvents({ roadmap, deadlines, exams, milestones: roadmap.milestones, studySessions: state.studySessions, recovery });

      return {
        entityType: 'GreenPathSnapshot',
        userId,
        academicProfile: profile,
        goals,
        onboardingCompleted: Boolean(state.onboardingCompleted),
        needsOnboarding: !state.onboardingCompleted,
        curriculumGraph: serializeGraph(graph),
        roadmap,
        yearPlan,
        calendarEvents,
        ...plans,
        courses: courseProgress,
        topicPerformance,
        exams,
        examReadiness,
        deadlines,
        resources,
        progress: overall,
        adaptation,
        recovery,
        risks,
        recommendations,
        status,
        dataStatus: {
          curriculum: 'connected',
          performance: history.attempts.length ? 'partial' : 'empty',
          exams: exams.length ? 'connected' : 'empty',
          resources: resources.length ? 'connected' : 'partial',
        },
        lastCalculatedAt: nowIso(now),
      };
    },

    getState(userRef) {
      return loadState(safeUserId(userRef));
    },

    saveProfile(userRef, patch) {
      const userId = safeUserId(userRef);
      const state = loadState(userId);
      state.profile = { ...(state.profile ?? {}), ...patch };
      saveState(userId, state);
      return state.profile;
    },

    saveGoals(userRef, goals) {
      const userId = safeUserId(userRef);
      const state = loadState(userId);
      state.goals = goals;
      saveState(userId, state);
      return goals;
    },

    completeOnboarding(userRef, { profilePatch = {}, goals = [], deadline = null } = {}) {
      const userId = safeUserId(userRef);
      const state = loadState(userId);
      state.profile = { ...(state.profile ?? {}), ...profilePatch };
      state.goals = goals;
      if (deadline) state.deadlines = [...(state.deadlines ?? []), { ...deadline, id: deadline.id ?? `deadline:${Date.now()}`, createdAt: nowIso() }];
      state.onboardingCompleted = true;
      saveState(userId, state);
      return state;
    },

    patchTask(userRef, task, patch) {
      const userId = safeUserId(userRef);
      const state = loadState(userId);
      state.taskPatches[task.id] = {
        ...(state.taskPatches[task.id] ?? {}),
        topicId: task.topicId,
        type: task.type,
        ...patch,
        updatedAt: nowIso(),
      };
      saveState(userId, state);
      return state.taskPatches[task.id];
    },

    saveStudySession(userRef, session) {
      const userId = safeUserId(userRef);
      const state = loadState(userId);
      state.studySessions = [...(state.studySessions ?? []), { ...session, entityType: 'StudySession', id: session.id ?? `session:${Date.now()}`, createdAt: nowIso() }];
      saveState(userId, state);
      return state.studySessions.at(-1);
    },

    addDeadline(userRef, deadline) {
      const userId = safeUserId(userRef);
      const state = loadState(userId);
      state.deadlines = [...(state.deadlines ?? []), { ...deadline, id: deadline.id ?? `deadline:${Date.now()}`, createdAt: nowIso() }];
      saveState(userId, state);
      return state.deadlines.at(-1);
    },

    setRecoveryMode(userRef, mode) {
      const userId = safeUserId(userRef);
      const state = loadState(userId);
      state.recoveryMode = mode;
      saveState(userId, state);
      return mode;
    },

    reset(userRef) {
      const userId = safeUserId(userRef);
      safeWrite(stateKey(userId), emptyState());
    },
  };
}

export function createGreenPathApiRepository({ fetchImpl = globalThis.fetch, base = GREEN_PATH_API_BASE } = {}) {
  const request = async (path, options = {}) => {
    if (typeof fetchImpl !== 'function') throw new Error('GREEN_PATH_API_UNAVAILABLE');
    const response = await fetchImpl(`${base}${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }, ...options });
    if (!response.ok) throw new Error(`GREEN_PATH_API_${response.status}`);
    const payload = await response.json();
    return payload?.data ?? payload;
  };

  return {
    getSnapshot: (userRef) => request('/bundle', { headers: { 'X-Tapesh-User': safeUserId(userRef) } }),
    saveProfile: (userRef, patch) => request('/profile', { method: 'PATCH', body: JSON.stringify({ userId: safeUserId(userRef), patch }) }),
    saveGoals: (userRef, goals) => request('/goals', { method: 'PUT', body: JSON.stringify({ userId: safeUserId(userRef), goals }) }),
    completeOnboarding: (userRef, payload) => request('/onboarding', { method: 'POST', body: JSON.stringify({ userId: safeUserId(userRef), ...payload }) }),
    patchTask: (userRef, task, patch) => request(`/tasks/${encodeURIComponent(task.id)}`, { method: 'PATCH', body: JSON.stringify({ userId: safeUserId(userRef), patch }) }),
    saveStudySession: (userRef, session) => request('/study-sessions', { method: 'POST', body: JSON.stringify({ userId: safeUserId(userRef), session }) }),
    addDeadline: (userRef, deadline) => request('/deadlines', { method: 'POST', body: JSON.stringify({ userId: safeUserId(userRef), deadline }) }),
    setRecoveryMode: (userRef, mode) => request('/recovery', { method: 'PUT', body: JSON.stringify({ userId: safeUserId(userRef), mode }) }),
  };
}
