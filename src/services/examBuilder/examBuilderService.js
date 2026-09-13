/*
 * سرویس «آزمون‌ساز شخصی» — قرارداد API به شکل واقعی طراحی شده؛ پیاده‌سازی فعلی Mock است
 * و آزمون‌های ذخیره‌شده در localStorage (کلید tapesh:exams:v1:<userId>) نگه داشته می‌شوند.
 * با اتصال Backend فقط بدنهٔ توابع به fetch تبدیل می‌شود؛ امضا و شکل Entity عوض نمی‌شود.
 *
 * قراردادهای آینده:
 *   GET  /api/exam-builder/catalog          → fetchBuilderCatalog()   (درس‌ها + درخت مبحث + عملکرد کاربر)
 *   POST /api/exam-builder/availability     → fetchAvailability()     (آمار زندهٔ مخزن)
 *   POST /api/exam-builder/plan             → buildExamPlan()         (موتور انتخاب سؤال)
 *   POST /api/exam-builder/related-topics   → fetchRelatedTopics()    (قلاب Knowledge Graph آینده)
 *   POST /api/exam-builder/next-config      → prefillFromSession()    (آزمون بعدی از دل کارنامه)
 *   GET/POST/DELETE /api/exams              → آزمون‌های ذخیره‌شده («آزمون‌های من»)
 *   POST /api/exams/:id/attempts            → recordAttempt()
 *
 * اصول طراحی:
 *  - انتخاب سؤال هرگز در UI انجام نمی‌شود؛ UI فقط config می‌سازد و plan می‌گیرد.
 *  - آزمون ذخیره‌شده snapshot سؤال‌ها (questionIds) را نگه می‌دارد تا Attemptهای چندگانه
 *    روی همان آزمون ممکن باشند؛ تولید دوباره با همان config در دست کاربر می‌ماند.
 *  - Attempt یک رکورد سبک است که به سشن بانک تست (نتایج واقعی) ارجاع می‌دهد — داده
 *    تصحیح فقط یک‌جا (testBankService) زندگی می‌کند.
 */

import { QUESTIONS, SUBJECTS, TOPIC_TREE } from '../testBank/mockData';
import {
  fetchPerformanceProfile,
  fetchPoolStats,
  normalizeFilters,
  searchQuestions,
} from '../testBank/testBankService';
import { findRelatedTopics, planExam } from './selectionEngine';
import { buildExamTitle, faDigits, STATUS_LABELS } from './presets';

const STATE_KEY_PREFIX = 'tapesh:exams:v1:';
const LATENCY_MS = 260;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const respond = async (build) => {
  await delay(LATENCY_MS + Math.random() * 140);
  return build();
};

const genId = () => `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function resolveUserKey(userRef) {
  if (typeof userRef === 'string') return userRef || 'guest';
  const identity = userRef?.id ?? userRef?.phone;
  return identity ? String(identity) : 'guest';
}

const stateKey = (userId) => `${STATE_KEY_PREFIX}${resolveUserKey(userId)}`;

function loadState(userId) {
  if (typeof window === 'undefined') return { exams: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(stateKey(userId)) || 'null');
    return parsed && Array.isArray(parsed.exams) ? parsed : { exams: [] };
  } catch {
    return { exams: [] };
  }
}

function saveState(userId, state) {
  if (typeof window === 'undefined') return state;
  try {
    window.localStorage.setItem(stateKey(userId), JSON.stringify(state));
  } catch {
    /* محدودیت فضای localStorage آزمون‌ها را نمی‌شکند */
  }
  return state;
}

function mutateState(userId, mutator) {
  const state = loadState(userId);
  mutator(state);
  return saveState(userId, state);
}

/* ────────────────────────── پیکربندی → فیلتر بانک ────────────────────────── */

/*
 * فیلترهای پیشرفته (سال/منبع/نوع/جستجو) سمت بانک حل می‌شوند؛ سختی و وضعیت را
 * موتور انتخاب هندل می‌کند چون توزیع و سهمیه می‌خواهد، نه حذف ساده.
 */
export function configToFilters(config = {}) {
  const advanced = config.advanced ?? {};
  return normalizeFilters({
    subjectIds: config.subjectIds ?? [],
    topicPaths: config.topicPaths ?? [],
    types: advanced.types ?? [],
    sources: advanced.sources ?? [],
    yearFrom: advanced.yearFrom ?? null,
    yearTo: advanced.yearTo ?? null,
    search: advanced.search ?? '',
  });
}

/* ────────────────────────── API: کاتالوگ سازنده ────────────────────────── */

/*
 * GET /api/exam-builder/catalog — دادهٔ مراحل ۲ و ۳: درس‌ها با آمار واقعی
 * (موجودی، حل‌شده، دقت) و درخت مبحث با شمارش واقعی هر گره. تسلط ضعیف‌ها هم از
 * همین‌جا می‌آید تا «آزمون نقاط ضعف من» دادهٔ واقعی داشته باشد.
 */
export async function fetchBuilderCatalog(userId) {
  const profile = await fetchPerformanceProfile(userId);
  return respond(() => {
    const subjects = SUBJECTS.map((subject) => {
      const questionCount = QUESTIONS.filter((question) => question.subject === subject.id).length;
      const perf = profile.subjects.find((entry) => entry.subjectId === subject.id);
      return {
        ...subject,
        questionCount,
        solvedCount: perf?.questions ?? 0,
        accuracy: perf?.accuracy ?? null,
        attempts: perf?.attempts ?? 0,
      };
    });

    const topicTree = Object.fromEntries(
      Object.entries(TOPIC_TREE).map(([subjectId, branches]) => [
        subjectId,
        branches.map((branch) => ({
          name: branch.name,
          count: QUESTIONS.filter(
            (question) => question.subject === subjectId && question.topicPath[0] === branch.name,
          ).length,
          children: (branch.children ?? []).map((child) => ({
            name: child,
            count: QUESTIONS.filter(
              (question) =>
                question.subject === subjectId &&
                question.topicPath[0] === branch.name &&
                question.topicPath[1] === child,
            ).length,
          })),
        })),
      ]),
    );

    const weakTopics = profile.topics
      .filter((entry) => entry.accuracy !== null && entry.accuracy < 60)
      .sort((a, b) => a.accuracy - b.accuracy)
      .map((entry) => ({
        path: entry.path,
        topic: entry.topic,
        subtopic: entry.subtopic,
        subjectId: entry.subjectId,
        accuracy: entry.accuracy,
        attempts: entry.attempts,
      }));

    return {
      subjects,
      topicTree,
      weakTopics,
      bankSize: QUESTIONS.length,
      hasPerformance: profile.attemptedCount > 0,
    };
  });
}

/* ────────────────────────── API: دسترس‌پذیری زنده ────────────────────────── */

/* POST /api/exam-builder/availability — «از X تست موجود، Y تست در دسترس است» */
export function fetchAvailability(userId, config) {
  return fetchPoolStats(userId, configToFilters(config));
}

/* ────────────────────────── API: برنامهٔ آزمون (موتور) ────────────────────────── */

/*
 * POST /api/exam-builder/plan — مخزن کامل (با وضعیت کاربر) از بانک گرفته می‌شود،
 * مباحث ضعیف از پروفایل عملکرد استخراج می‌شود و موتور انتخاب، سؤال‌ها را واقعاً برمی‌گزیند.
 */
export async function buildExamPlan(userId, config) {
  const [poolResult, profile] = await Promise.all([
    searchQuestions(userId, configToFilters(config), { page: 1, pageSize: 9999 }),
    fetchPerformanceProfile(userId),
  ]);

  const weakTopics = profile.topics
    .filter((entry) => entry.accuracy !== null && entry.accuracy < 60)
    .flatMap((entry) => (entry.subtopic ? [entry.subtopic, entry.topic] : [entry.topic]));

  return respond(() => planExam(poolResult.items, { ...config, weakTopics }));
}

/* ────────────────────────── API: مباحث مرتبط (شبکهٔ دانش) ────────────────────────── */

/* POST /api/exam-builder/related-topics — از دادهٔ واقعی (درخت + تگ‌ها)؛ بعداً از Knowledge Graph */
export function fetchRelatedTopics(topicName) {
  return respond(() => ({
    topic: topicName,
    related: findRelatedTopics(topicName, TOPIC_TREE, QUESTIONS),
  }));
}

/* ────────────────────────── API: آزمون‌های ذخیره‌شده ────────────────────────── */

function examSummary(exam) {
  const lastAttempt = exam.attempts[exam.attempts.length - 1] ?? null;
  return {
    id: exam.id,
    title: exam.title,
    purpose: exam.purpose,
    createdAt: exam.createdAt,
    questionCount: exam.questionIds.length,
    durationMinutes: exam.config.durationMinutes ?? null,
    subjectIds: exam.config.subjectIds ?? [],
    topics: (exam.config.topicPaths ?? []).slice(0, 4),
    topicCount: (exam.config.topicPaths ?? []).length,
    attemptCount: exam.attempts.length,
    lastAttempt: lastAttempt
      ? {
          id: lastAttempt.id,
          sessionId: lastAttempt.sessionId,
          at: lastAttempt.at,
          percentage: lastAttempt.percentage,
        }
      : null,
    bestPercentage: exam.attempts.reduce((best, attempt) => Math.max(best, attempt.percentage ?? 0), 0),
    trend: exam.attempts.map((attempt) => ({ at: attempt.at, percentage: attempt.percentage ?? 0 })),
  };
}

export function fetchSavedExams(userId) {
  return respond(() => loadState(userId).exams.map(examSummary).reverse());
}

export function fetchExam(userId, examId) {
  return respond(() => {
    const exam = loadState(userId).exams.find((entry) => entry.id === examId);
    if (!exam) throw new Error('exam-not-found');
    return exam;
  });
}

/* POST /api/exams — ذخیرهٔ آزمون از یک plan واقعی موتور */
export function saveExam(userId, { config, plan, title = null }) {
  return respond(() => {
    if (!plan?.questionIds?.length) throw new Error('empty-plan');

    const subjectNames = (config.subjectIds ?? [])
      .map((id) => SUBJECTS.find((subject) => subject.id === id)?.name)
      .filter(Boolean);

    const exam = {
      id: genId(),
      title: (title ?? '').trim() || buildExamTitle(config, subjectNames),
      purpose: config.purpose ?? 'personal',
      createdAt: Date.now(),
      config: { ...config, title: undefined },
      blueprint: plan.breakdown,
      questionIds: plan.questionIds,
      attempts: [],
    };

    mutateState(userId, (state) => {
      state.exams.push(exam);
    });
    return exam;
  });
}

/* DELETE /api/exams/:id */
export function deleteExam(userId, examId) {
  return respond(() => {
    mutateState(userId, (state) => {
      state.exams = state.exams.filter((exam) => exam.id !== examId);
    });
    return { ok: true };
  });
}

/* POST /api/exams/:id/attempts — ثبت تلاش از سشن تصحیح‌شدهٔ بانک تست */
export function recordAttempt(userId, examId, submittedSession) {
  const result = submittedSession?.result;
  if (!result) return Promise.resolve(null);

  return respond(() => {
    let updated = null;
    mutateState(userId, (state) => {
      const exam = state.exams.find((entry) => entry.id === examId);
      if (!exam) return;
      const attempt = {
        id: `at-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        sessionId: submittedSession.id,
        at: result.submittedAt ?? Date.now(),
        percentage: result.percentage,
        correct: result.correct,
        wrong: result.wrong,
        unanswered: result.unanswered,
        total: result.total,
        timeSpent: result.timeSpent,
      };
      exam.attempts.push(attempt);
      updated = exam;
    });
    return updated ? examSummary(updated) : null;
  });
}

/* ────────────────────────── API: آزمون بعدی از دل کارنامه ────────────────────────── */

/*
 * POST /api/exam-builder/next-config — از کارنامهٔ سشن تمام‌شده، مباحث ضعیف
 * (دقت < ۶۰٪) استخراج و به‌عنوان پیش‌تنظیم «رفع نقاط ضعف» به Builder برمی‌گردد.
 */
export function prefillFromSession(session) {
  return respond(() => {
    const result = session?.result;
    if (!result) throw new Error('no-result');

    const weakTopics = result.topics
      .filter((entry) => entry.percent < 60)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 3);

    const weakSubjects = result.subjects
      .filter((entry) => entry.percent < 60)
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 2)
      .map((entry) => entry.subjectId);

    const topicPaths = weakTopics.map((entry) => (entry.subtopic ? entry.subtopic : entry.topic));
    const subjectIds = [...new Set([...weakTopics.map((entry) => entry.subjectId), ...weakSubjects])];

    return {
      config: {
        purpose: 'weakness',
        weaknessFocus: true,
        subjectIds,
        topicPaths,
        questionCount: 15,
        mode: 'practice',
        difficulty: { mode: 'mixed', level: null, distribution: { easy: 20, medium: 50, hard: 30, very_hard: 0 } },
        statuses: { base: 'any', quotas: [] },
        durationMode: 'suggested',
        durationMinutes: null,
        negativeMarking: false,
        feedback: 'full',
        advanced: {},
      },
      note:
        weakTopics.length > 0
          ? `${faDigits(weakTopics.length)} مبحث ضعیف از کارنامهٔ آخر شناسایی شد: ${weakTopics
              .map((entry) => (entry.subtopic ? `${entry.topic} › ${entry.subtopic}` : entry.topic))
              .join('، ')}`
          : 'در این کارنامه مبحث خیلی ضعیفی پیدا نشد؛ مباحث با دقت پایین‌تر پیش‌تنظیم شدند.',
    };
  });
}

/* ────────────────────────── تبدیل آزمون ذخیره‌شده → سشن بانک ────────────────────────── */

/*
 * پیکربندی سشن برای Attempt جدید یک آزمون ذخیره‌شده — حلّهٔ سؤال همان snapshot
 * آزمون است و mode/زمان/نمرهٔ منفی از تنظیمات آزمون می‌آید.
 */
export function buildSessionConfigFromExam(exam) {
  const config = exam.config ?? {};
  const durationMinutes =
    config.durationMode === 'custom' ? (config.durationMinutes ?? null) : config.durationMode === 'none' ? null : (config.durationMinutes ?? null);
  const subjectNames = (config.subjectIds ?? [])
    .map((id) => SUBJECTS.find((subject) => subject.id === id)?.name)
    .filter(Boolean);

  const parts = [];
  if (subjectNames.length) parts.push(subjectNames.join('، '));
  if (config.topicPaths?.length) parts.push(config.topicPaths.slice(0, 3).join('، ') + (config.topicPaths.length > 3 ? '…' : ''));
  if (durationMinutes) parts.push(`${durationMinutes} دقیقه`);

  return {
    mode: config.mode === 'practice' ? 'practice' : 'exam',
    title: exam.title,
    subtitle: parts.join(' · '),
    questionIds: exam.questionIds,
    durationMinutes,
    negativeMarking: config.negativeMarking ? -0.25 : 0,
    explainDepth: config.feedback === 'answer-only' ? 'answer-only' : 'full',
    blueprint: { kind: 'personal', examId: exam.id, purpose: exam.purpose, questionIds: exam.questionIds },
  };
}

/* خروجی ثابت برای UI */
export { STATUS_LABELS };
