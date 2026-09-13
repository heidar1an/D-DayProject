/*
 * سرویس «آزمون‌های هماهنگ تپش» — قرارداد API به شکل واقعی طراحی شده؛ پیاده‌سازی فعلی
 * Mock است و وضعیت کاربر (ثبت‌نام، Attempt، کارنامه) در localStorage (کلید
 * tapesh:coordinated:v1:<userId>) ذخیره می‌شود. با اتصال Backend فقط بدنهٔ توابع
 * به fetch تبدیل می‌شود؛ امضای خروجی و شکل Entityها عوض نمی‌شود.
 *
 * قراردادهای آینده (مطابق سند محصول):
 *   GET  /api/exams                            → fetchExams()
 *   GET  /api/exams/:slug                      → fetchExam()
 *   POST /api/exams/:slug/registration         → registerUser()
 *   DELETE /api/exams/:slug/registration       → cancelRegistration()
 *   GET  /api/exams/:slug/questions            → fetchExamQuestions()   (بدون کلید پاسخ)
 *   POST /api/exams/:slug/attempts             → startAttempt()         (زمان پایان از سرور)
 *   PUT  /api/attempts/:id/progress            → saveAttemptProgress()  (autosave)
 *   POST /api/attempts/:id/submit              → submitAttempt()        (تصحیح سمت سرور)
 *   GET  /api/exams/:slug/result               → fetchResult()
 *   GET  /api/exams/:slug/questions/review     → fetchReviewQuestions() (فقط بعد از submit)
 *   GET  /api/exams/:slug/ranking              → fetchRanking()
 *   GET  /api/server-time                      → getServerTime()
 *
 * اصول امنیتی:
 *  - fetchExamQuestions هرگز correctAnswer و explanation را برنمی‌گرداند؛ تصحیح فقط
 *    در submitAttempt انجام می‌شود تا هیچ UIای به دادهٔ ناامن وابسته نشود.
 *  - زمان پایان Attempt (endsAt) از سرویس صادر می‌شود نه از فرانت؛ Timer فقط آن را نمایش می‌دهد.
 *  - توزیع نمرات جامعهٔ آماری Deterministic است (seeded by examId) تا رتبه بین رفرش‌ها ثابت بماند.
 */

import { COMMUNITY_META, EXAMS, QUESTIONS } from './mockData';

const STATE_KEY_PREFIX = 'tapesh:coordinated:v1:';
const LATENCY_MS = 320;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const respond = async (build) => {
  await delay(LATENCY_MS + Math.random() * 180);
  return build();
};

/* ────────────────────────── زمان سرور ────────────────────────── */

/*
 * منبع واحد زمان برای Countdown و Timer. در نسخهٔ سرور، اینجا اختلاف ساعت
 * با Response سرور (serverTimeOffset) محاسبه می‌شود و کل UI از همین تابع تغذیه می‌کند.
 */
export function getServerTime() {
  return Date.now();
}

/* ────────────────────────── وضعیت کاربر (USER STATE) ────────────────────────── */

const EMPTY_STATE = {
  registrations: {}, // examId → timestamp ثبت‌نام
  attempts: [],
  seeded: false,
};

/*
 * کلید فضای کاربر: هم رشتهٔ id و هم کل شیء userData پذیرفته می‌شود تا اگر جایی
 * اشیای کامل پاس داده شد، داده‌ها زیر کلید [object Object] نروند. id یا phone
 * پایدارترین شناسهٔ سشن است؛ در نبود هر دو، فضای مهمان.
 */
function resolveUserKey(userRef) {
  if (typeof userRef === 'string') return userRef || 'guest';
  const identity = userRef?.id ?? userRef?.phone;
  return identity ? String(identity) : 'guest';
}

function stateKey(userId) {
  return `${STATE_KEY_PREFIX}${resolveUserKey(userId)}`;
}

function loadState(userId) {
  if (typeof window === 'undefined') return { ...EMPTY_STATE };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(stateKey(userId)) || 'null');
    return parsed && typeof parsed === 'object' ? { ...EMPTY_STATE, ...parsed } : { ...EMPTY_STATE };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function saveState(userId, state) {
  if (typeof window === 'undefined') return state;
  try {
    window.localStorage.setItem(stateKey(userId), JSON.stringify(state));
  } catch {
    /* محدودیت فضای localStorage وضعیت آزمون را نمی‌شکند */
  }
  return state;
}

function mutateState(userId, mutator) {
  const state = loadState(userId);
  mutator(state);
  return saveState(userId, state);
}

/* ────────────────────────── وضعیت آزمون (EXAM STATUS) ────────────────────────── */

/*
 * وضعیت آزمون از زمان‌ها مشتق می‌شود نه از فیلد دستی؛ در Backend همین منطق
 * server-authoritative خواهد بود. ترتیب بررسی مهم است.
 */
export function computeExamStatus(exam, now = getServerTime()) {
  if (exam.cancelled) return 'CANCELLED';
  if (exam.alwaysAvailable) return 'AVAILABLE';
  if (now >= exam.startTime && now <= exam.endTime) return 'LIVE';
  if (now > exam.endTime) {
    return exam.resultReleaseAt && now >= exam.resultReleaseAt ? 'RESULTS_AVAILABLE' : 'FINISHED';
  }
  if (exam.registrationDeadline && now >= exam.registrationDeadline) return 'REGISTRATION_CLOSED';
  if (exam.registrationOpenAt && now < exam.registrationOpenAt) return 'UPCOMING';
  return 'REGISTRATION_OPEN';
}

export const STATUS_META = {
  UPCOMING: { label: 'در انتظار برگزاری', accent: '#8a8a8a' },
  REGISTRATION_OPEN: { label: 'ثبت‌نام فعال', accent: '#61D192' },
  REGISTRATION_CLOSED: { label: 'ثبت‌نام بسته', accent: '#e0b45c' },
  LIVE: { label: 'در حال برگزاری', accent: '#e26d6d' },
  FINISHED: { label: 'پایان یافته', accent: '#8a8a8a' },
  RESULTS_AVAILABLE: { label: 'کارنامه آماده', accent: '#937fcd' },
  AVAILABLE: { label: 'آماده شروع', accent: '#61D192' },
  CANCELLED: { label: 'لغو شده', accent: '#e26d6d' },
};

export const TYPE_META = {
  national: { label: 'هماهنگ سراسری', accent: '#61D192' },
  comprehensive: { label: 'آزمون جامع', accent: '#937fcd' },
  subject: { label: 'آزمون موضوعی', accent: '#5b8cc7' },
  course: { label: 'آزمون درس', accent: '#77b787' },
  quiz: { label: 'آزمونک', accent: '#e0b45c' },
  occasion: { label: 'مناسبتی', accent: '#e26d6d' },
  mock: { label: 'آزمایشی', accent: '#b99a86' },
};

const getExam = (slugOrId) =>
  EXAMS.find((exam) => exam.slug === slugOrId || exam.id === slugOrId) ?? null;

const examQuestions = (examId) => QUESTIONS.filter((question) => question.examId === examId);

/* سؤالِ «شسته‌شده» — بدون کلید پاسخ و تحلیل (اصل امنیتی سند) */
const sanitizeQuestion = (question) => ({
  id: question.id,
  examId: question.examId,
  subject: question.subject,
  topic: question.topic,
  difficulty: question.difficulty,
  stem: question.stem,
  options: question.options,
});

/* ────────────────────────── Attempt ────────────────────────── */

const attemptForExam = (state, examId) =>
  state.attempts
    .filter((attempt) => attempt.examId === examId)
    .sort((a, b) => b.startedAt - a.startedAt);

function computeUserState(state, exam, now = getServerTime()) {
  const status = computeExamStatus(exam, now);
  const attempts = attemptForExam(state, exam.id);
  const registered = Boolean(state.registrations[exam.id]);
  const active = attempts.find((attempt) => attempt.status === 'in_progress') ?? null;
  const completed = attempts.filter((attempt) => attempt.status !== 'in_progress');
  const lastCompleted = completed[0] ?? null;
  const resultReady =
    status === 'RESULTS_AVAILABLE' && Boolean(lastCompleted) &&
    (!exam.resultReleaseAt || now >= exam.resultReleaseAt);

  return {
    status,
    statusMeta: STATUS_META[status],
    registered,
    registeredAt: state.registrations[exam.id] ?? null,
    canRegister:
      (status === 'REGISTRATION_OPEN' || (status === 'LIVE' && exam.type === 'quiz')) &&
      !registered,
    canCancelRegistration: registered && status === 'REGISTRATION_OPEN',
    attemptsUsed: attempts.length,
    attemptLimit: exam.rules.attemptLimit,
    canStart:
      status === 'AVAILABLE'
        ? attempts.length < exam.rules.attemptLimit
        : status === 'LIVE' && (registered || !exam.alwaysAvailable && exam.type === 'quiz') && attempts.length < exam.rules.attemptLimit,
    activeAttemptId: active?.id ?? null,
    activeProgress: active
      ? {
          answeredCount: Object.keys(active.answers ?? {}).length,
          totalQuestions: active.questionIds.length,
        }
      : null,
    lastAttemptId: lastCompleted?.id ?? null,
    resultReady,
    hasParticipated: attempts.length > 0,
  };
}

function buildExamSummary(exam, state, now = getServerTime()) {
  const bankCount = examQuestions(exam.id).length;
  return {
    ...exam,
    endTime: exam.endTime,
    status: undefined,
    ...(() => {
      const userState = computeUserState(state, exam, now);
      return { ...userState, id: exam.id, slug: exam.slug };
    })(),
    bankCount,
    // تعداد سؤال واقعی بانک تا UI هرگز عدد خیالی نشان ندهد
    effectiveQuestionCount: bankCount || exam.questionCount,
  };
}

/* ────────────────────────── توزیع جامعهٔ آماری (Deterministic) ────────────────────────── */

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
 * توزیع نمرات شرکت‌کنندگان — Deterministic با seed ثابت هر آزمون تا رتبه کاربر
 * بین رفرش‌ها عوض نشود. در نسخهٔ Backend این توزیع واقعی از Results می‌آید.
 */
function communityScores(exam) {
  const meta = COMMUNITY_META[exam.id] ?? { medianPercent: 45, averagePercent: 47, topPercent: 96 };
  const rng = mulberry32(hashSeed(exam.id));
  const count = Math.max(exam.participantsCount ?? 100, 60);
  const scores = new Array(count);
  for (let i = 0; i < count; i += 1) {
    /* تقریب نرمال با Box-Muller: میانگین کمی زیر میانهٔ اعلامی + دم راست برای قوی‌ها */
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const value = meta.averagePercent + normal * 17;
    scores[i] = Math.min(Math.max(value, 0), meta.topPercent);
  }
  scores.sort((a, b) => b - a);
  return { scores, meta };
}

/* ────────────────────────── تصحیح و کارنامه (RESULT) ────────────────────────── */

function gradeAttempt(attempt, exam) {
  const answeredEntries = Object.entries(attempt.answers ?? {});
  let correct = 0;
  let wrong = 0;

  for (const [questionId, answer] of answeredEntries) {
    const question = QUESTIONS.find((item) => item.id === questionId);
    if (!question) continue;
    if (answer.selected === question.correctAnswer) correct += 1;
    else wrong += 1;
  }

  const total = attempt.questionIds.length;
  const unanswered = total - answeredEntries.length;
  const negative = exam.rules.negativeMarking ?? 0;
  const score = correct + wrong * negative;
  const percentage = Math.max(0, Math.min(100, Math.round((score / Math.max(total, 1)) * 1000) / 10));

  const subjectMap = new Map();
  for (const questionId of attempt.questionIds) {
    const question = QUESTIONS.find((item) => item.id === questionId);
    if (!question) continue;
    const entry = subjectMap.get(question.subject) ?? { subject: question.subject, correct: 0, wrong: 0, unanswered: 0, total: 0 };
    entry.total += 1;
    const answer = (attempt.answers ?? {})[questionId];
    if (!answer) entry.unanswered += 1;
    else if (answer.selected === question.correctAnswer) entry.correct += 1;
    else entry.wrong += 1;
    subjectMap.set(question.subject, entry);
  }
  const subjects = [...subjectMap.values()]
    .map((entry) => ({ ...entry, percent: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0 }))
    .sort((a, b) => b.percent - a.percent);

  return { correct, wrong, unanswered, total, score, percentage, subjects, negative };
}

function buildResult(attempt, exam, reason = 'user') {
  const grade = gradeAttempt(attempt, exam);
  const { scores, meta } = communityScores(exam);
  const participants = scores.length;

  /* نمرهٔ کاربر در مقیاس درصد جامعه — همان percentage با اعمال نمرهٔ منفی */
  const better = scores.filter((value) => value > grade.percentage).length;
  const rank = better + 1;
  const percentile = Math.max(0, Math.round(((participants - rank) / participants) * 100));
  const teraz = Math.round(4200 + grade.percentage * 53); // فرمول دموی تراز — در سرور واقعی محاسبه می‌شود

  const timeSpent = Math.min(
    Math.round(((attempt.submittedAt ?? getServerTime()) - attempt.startedAt) / 1000),
    (exam.duration ?? 60) * 60,
  );

  return {
    attemptId: attempt.id,
    examId: exam.id,
    examSlug: exam.slug,
    examTitle: exam.title,
    examType: exam.type,
    submittedAt: attempt.submittedAt,
    reason, // user | timeout | auto
    timeSpent,
    total: grade.total,
    answered: grade.total - grade.unanswered,
    correct: grade.correct,
    wrong: grade.wrong,
    unanswered: grade.unanswered,
    score: Math.round(grade.score * 100) / 100,
    maxScore: grade.total,
    negativeMarking: grade.negative,
    percentage: grade.percentage,
    rank,
    participantsCount: participants,
    percentile,
    teraz: exam.type === 'national' || exam.type === 'mock' ? teraz : null,
    community: {
      averagePercent: meta.averagePercent,
      medianPercent: meta.medianPercent,
      topPercent: meta.topPercent,
    },
    subjects: grade.subjects,
  };
}

/* پاداش لیگ — قلب تپشی؛ منطق کامل اتصال به League بعداً سمت سرور اعمال می‌شود */
export function rewardOf(result, exam) {
  const base = exam.type === 'quiz' ? 5 : 10;
  const bonus = Math.round(result.percentage / 10);
  return { hearts: base + bonus, base, bonus };
}

/* ────────────────────────── دادهٔ نمونه (DEMO SEED) ────────────────────────── */

/*
 * برای اینکه کارنامه/تحلیل/مرور از همان اول قابل تجربه باشد، یک Attempt کامل‌شده
 * برای آزمون «موضوعی بیوشیمی» و ثبت‌نام برای آزمون LIVE در اولین بار seed می‌شود.
 */
function ensureSeed(userId, state) {
  if (state.seeded) return state;

  const biochem = getExam('biochem-subject-01');
  const physio = getExam('physio-heart-live-01');

  if (biochem) {
    const examQuestionsIds = examQuestions(biochem.id).map((question) => question.id);
    const demoPicks = {
      'q-bio-01': 1,
      'q-bio-02': 1,
      'q-bio-03': 0, // غلط
      'q-bio-04': 2,
      'q-bio-06': 2, // غلط
    };
    const answers = {};
    examQuestionsIds.forEach((questionId, index) => {
      if (demoPicks[questionId] !== undefined) {
        answers[questionId] = {
          selected: demoPicks[questionId],
          marked: questionId === 'q-bio-05',
          timeSpent: 90 + index * 55,
          answeredAt: biochem.startTime + (index + 1) * 210000,
        };
      }
    });
    const attempt = {
      id: `att-seed-${hashSeed(String(userId)).toString(36)}`,
      userId: userId ?? 'guest',
      examId: biochem.id,
      startedAt: biochem.startTime,
      endsAt: biochem.endTime,
      submittedAt: biochem.endTime - 6 * 60000,
      status: 'submitted',
      questionIds: examQuestionsIds,
      answers,
      reason: 'user',
    };
    attempt.result = buildResult(attempt, biochem, 'user');
    state.attempts.push(attempt);
  }

  if (physio) {
    state.registrations[physio.id] = getServerTime() - DAY_MS;
  }

  state.seeded = true;
  return state;
}

const DAY_MS = 86400000;

/* ────────────────────────── API: محتوا ────────────────────────── */

/* GET /api/exams — خلاصهٔ همهٔ آزمون‌ها + وضعیت کاربر برای هرکدام */
export function fetchExams(userId) {
  return respond(() => {
    const state = ensureSeed(userId, loadState(userId));
    saveState(userId, state);
    const now = getServerTime();
    return EXAMS.map((exam) => buildExamSummary(exam, state, now));
  });
}

/* GET /api/exams/:slug */
export function fetchExam(slug, userId) {
  return respond(() => {
    const exam = getExam(slug);
    if (!exam) throw new Error('exam-not-found');
    const state = ensureSeed(userId, loadState(userId));
    const now = getServerTime();
    const bank = examQuestions(exam.id);
    return {
      ...exam,
      bankCount: bank.length,
      effectiveQuestionCount: bank.length || exam.questionCount,
      userState: computeUserState(state, exam, now),
    };
  });
}

/* GET /api/exams/:slug/questions — بدون کلید پاسخ (امن) */
export function fetchExamQuestions(slug) {
  return respond(() => {
    const exam = getExam(slug);
    if (!exam) throw new Error('exam-not-found');
    return examQuestions(exam.id).map(sanitizeQuestion);
  });
}

/* ────────────────────────── API: ثبت‌نام ────────────────────────── */

/* POST /api/exams/:slug/registration */
export function registerUser(userId, slug) {
  return respond(() => {
    const exam = getExam(slug);
    if (!exam) throw new Error('exam-not-found');
    const status = computeExamStatus(exam);
    if (status !== 'REGISTRATION_OPEN' && !(status === 'AVAILABLE')) {
      throw new Error('registration-closed');
    }
    mutateState(userId, (state) => {
      state.registrations[exam.id] = getServerTime();
    });
    trackEvent('exam_registered', { examId: exam.id });
    return { ok: true, registeredAt: stateOf(userId).registrations[exam.id] };
  });
}

/* DELETE /api/exams/:slug/registration */
export function cancelRegistration(userId, slug) {
  return respond(() => {
    const exam = getExam(slug);
    if (!exam) throw new Error('exam-not-found');
    mutateState(userId, (state) => {
      delete state.registrations[exam.id];
    });
    trackEvent('exam_registration_cancelled', { examId: exam.id });
    return { ok: true };
  });
}

function stateOf(userId) {
  return loadState(userId);
}

/* ────────────────────────── API: Attempt ────────────────────────── */

/*
 * POST /api/exams/:slug/attempts — زمان پایان از «سرور» صادر می‌شود:
 *   deadlineMode exam_end → پایان هماهنگ برای همه
 *   deadlineMode per_attempt → startedAt + duration
 */
export function startAttempt(userId, slug) {
  return respond(() => {
    const exam = getExam(slug);
    if (!exam) throw new Error('exam-not-found');
    const state = ensureSeed(userId, loadState(userId));
    const status = computeExamStatus(exam);
    const userState = computeUserState(state, exam);

    if (!userState.canStart) throw new Error(status === 'LIVE' ? 'not-registered' : 'exam-not-open');
    if (userState.attemptsUsed >= exam.rules.attemptLimit) throw new Error('attempt-limit-reached');

    const bank = examQuestions(exam.id);
    if (!bank.length) throw new Error('questions-not-published');

    const now = getServerTime();
    const attempt = {
      id: `att-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      userId: userId ?? 'guest',
      examId: exam.id,
      examSlug: exam.slug,
      startedAt: now,
      endsAt: exam.rules.deadlineMode === 'exam_end' ? exam.endTime : now + exam.duration * 60000,
      submittedAt: null,
      status: 'in_progress',
      questionIds: bank.map((question) => question.id),
      answers: {}, // qid → { selected, timeSpent, answeredAt }
      marked: [], // qid → علامت برای مرور
    };

    mutateState(userId, (draft) => {
      draft.attempts.push(attempt);
    });
    trackEvent('coordinated_attempt_started', { examId: exam.id, attemptId: attempt.id });
    return attempt;
  });
}

/* GET /api/attempts/:id — برای Resume بعد از Refresh */
export function fetchAttempt(userId, attemptId) {
  return respond(() => {
    const state = loadState(userId);
    const attempt = state.attempts.find((item) => item.id === attemptId);
    if (!attempt) throw new Error('attempt-not-found');
    return attempt;
  });
}

/* PUT /api/attempts/:id/progress — autosave هر تغییر پاسخ/علامت.
 * ادغام به‌جای جایگزینی: دو عمل پشت‌سرهم با closureهای نزدیک به‌هم نریزند. */
export function saveAttemptProgress(userId, attempt) {
  const state = mutateState(userId, (draft) => {
    const index = draft.attempts.findIndex((item) => item.id === attempt.id);
    if (index === -1) return;
    const stored = draft.attempts[index];
    draft.attempts[index] = {
      ...stored,
      ...attempt,
      answers: { ...(stored.answers ?? {}), ...(attempt.answers ?? {}) },
      marked: Array.isArray(attempt.marked) ? attempt.marked : (stored.marked ?? []),
    };
  });
  const stored = state.attempts.find((item) => item.id === attempt.id);
  return stored ?? attempt;
}

/*
 * POST /api/attempts/:id/submit — تصحیح و صدور کارنامه.
 * فقط سمت این تابع کلید پاسخ خوانده می‌شود (در نسخهٔ سرور: کاملاً Backend).
 */
export function submitAttempt(userId, attemptId, { reason = 'user' } = {}) {
  return respond(() => {
    const state = ensureSeed(userId, loadState(userId));
    const attempt = state.attempts.find((item) => item.id === attemptId);
    if (!attempt) throw new Error('attempt-not-found');
    if (attempt.status !== 'in_progress') return attempt;

    const exam = getExam(attempt.examId);
    const now = getServerTime();
    const timedOut = reason === 'timeout' || now > attempt.endsAt;

    const submitted = {
      ...attempt,
      status: 'submitted',
      submittedAt: Math.min(now, attempt.endsAt),
      reason: timedOut ? 'timeout' : reason,
    };
    submitted.result = buildResult(submitted, exam, timedOut ? 'timeout' : reason);

    mutateState(userId, (draft) => {
      const index = draft.attempts.findIndex((item) => item.id === attemptId);
      if (index !== -1) draft.attempts[index] = submitted;
    });

    trackEvent('coordinated_attempt_submitted', {
      examId: exam.id,
      attemptId,
      percentage: submitted.result.percentage,
      reason: submitted.reason,
    });
    return { attempt: submitted, result: submitted.result, reward: rewardOf(submitted.result, exam) };
  });
}

/* ────────────────────────── API: کارنامه و مرور ────────────────────────── */

/*
 * GET /api/exams/:slug/result — ماشین وضعیت صفحهٔ کارنامه:
 *   ready | processing (نتایج هنوز اعلام نشده) | not_participated | exam_not_finished
 */
export function fetchResult(userId, slug) {
  return respond(() => {
    const exam = getExam(slug);
    if (!exam) throw new Error('exam-not-found');
    const state = ensureSeed(userId, loadState(userId));
    const now = getServerTime();
    const status = computeExamStatus(exam, now);
    const completed = attemptForExam(state, exam.id).filter((attempt) => attempt.status !== 'in_progress');

    if (!completed.length) {
      if (status === 'LIVE' || status === 'AVAILABLE' || status === 'REGISTRATION_OPEN' || status === 'UPCOMING' || status === 'REGISTRATION_CLOSED') {
        return { state: 'not_participated', exam };
      }
      return { state: 'not_participated', exam };
    }

    const last = completed[0];
    if (exam.resultReleaseAt && now < exam.resultReleaseAt && status !== 'AVAILABLE') {
      return { state: 'processing', exam, releaseAt: exam.resultReleaseAt };
    }
    if (!last.result) {
      /* Attempt قدیمی بدون نتیجهٔ محاسبه‌شده (مثلاً بعد از تغییر mock) — همین‌جا تصحیح می‌شود */
      const result = buildResult(last, exam, last.reason ?? 'user');
      mutateState(userId, (draft) => {
        const index = draft.attempts.findIndex((item) => item.id === last.id);
        if (index !== -1) draft.attempts[index] = { ...last, result };
      });
      return { state: 'ready', exam, result, attempt: last };
    }
    return { state: 'ready', exam, result: last.result, attempt: last };
  });
}

/* GET /api/exams/:slug/questions/review — کلید پاسخ فقط بعد از submit */
export function fetchReviewQuestions(userId, slug) {
  return respond(() => {
    const exam = getExam(slug);
    if (!exam) throw new Error('exam-not-found');
    const state = loadState(userId);
    const completed = attemptForExam(state, exam.id).filter((attempt) => attempt.status !== 'in_progress');
    if (!completed.length) throw new Error('review-not-allowed');

    const attempt = completed[0];
    const full = examQuestions(exam.id).map((question) => ({
      ...question,
      userAnswer: attempt.answers?.[question.id] ?? null,
    }));
    return { exam, attempt, questions: full };
  });
}

/* GET /api/exams/:slug/ranking — مقایسهٔ جامعه‌محور (نه Leaderboard کامل) */
export function fetchRanking(userId, slug) {
  return respond(() => {
    const exam = getExam(slug);
    if (!exam) throw new Error('exam-not-found');
    const state = ensureSeed(userId, loadState(userId));
    const completed = attemptForExam(state, exam.id).find((attempt) => attempt.status !== 'in_progress');
    const { scores, meta } = communityScores(exam);

    const mine = completed?.result?.percentage ?? null;
    const rank = mine === null ? null : scores.filter((value) => value > mine).length + 1;
    const median = scores[Math.floor(scores.length / 2)];
    const average = Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10;

    return {
      participantsCount: scores.length,
      topPercent: Math.round(scores[0]),
      medianPercent: Math.round(median),
      averagePercent: average,
      me: mine === null
        ? null
        : {
            percentage: mine,
            rank,
            percentile: Math.max(0, Math.round(((scores.length - rank) / scores.length) * 100)),
            teraz: exam.type === 'national' || exam.type === 'mock' ? Math.round(4200 + mine * 53) : null,
          },
    };
  });
}

/* ────────────────────────── Analytics stub ────────────────────────── */

export function trackEvent(name, payload = {}) {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[exams:track] ${name}`, payload);
  }
}
