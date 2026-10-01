/*
 * موتور آزمون‌های هماهنگ — تک مرجع حقیقت سمت سرور.
 *
 * اصل بنیادین: کلاینت فقط نمایش می‌دهد و درخواست می‌سازد؛ هیچ داده‌ای که از
 * کلاینت برسد «حقیقت امنیتی» نیست. زمان، وضعیت آزمون، Attempt، تصحیح، نتیجه و
 * رتبه همه اینجا و از دادهٔ سرور محاسبه می‌شوند.
 *
 * داده: فایل‌های JSON در `database/content/` با نوشتن اتمیک (tmp + rename).
 * هر تغییر وضعیت در یک بلوک همگام (read-modify-write اتمیک در تک‌پروسسهٔ Node)
 * انجام می‌شود؛ بنابراین Race درون-پروسسه ممکن نیست. مقیاس افقی چند-نودی به
 * پایگاه دادهٔ واقعی نیاز دارد و در سند امنیتی به‌عنوان محدودیت مستند شده است.
 *
 * مدل:
 *   Exam ──(currentVersion)──▶ Question (examId + version)   ← کلید پاسخ فقط سرور
 *   Attempt ── snapshot(questionIds + examVersion در لحظهٔ ساخت)
 *            ── answers{qid→{selected, answeredAt, changes}} + deliveredAt{qid}
 *            ── result (پس از submit، تغییرن‌پذیر)
 *
 * خط‌مشی زمان: مرز پذیرش = ساعت سرور هنگام رسیدن درخواست.
 *   پذیرش پاسخ تا `endsAt`؛ پذیرش submit تا `endsAt + graceSeconds`.
 *   بعد از آن سوئیپ، Attempt را با reason 'timeout' نهایی می‌کند.
 */

import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSeedExams, buildSeedQuestions, COMMUNITY_META } from './examSeed.mjs';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const contentDir = join(databaseDir, 'content');

const FILES = {
  exams: join(contentDir, 'exams.json'),
  questions: join(contentDir, 'examQuestions.json'),
  attempts: join(contentDir, 'examAttempts.json'),
  reports: join(contentDir, 'examReports.json'),
  audit: join(contentDir, 'examAudit.json'),
};

const AUDIT_ROTATE_LIMIT = 5000;
const SEED_SIGNATURE = 'tapesh-exam-seed-v1';

/* ────────────────────────── ذخیره‌سازی اتمیک ────────────────────────── */

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    /* فایل نیمه‌نوشته/خراب — با seed پیش‌فرض ادامه می‌دهیم اما لاگ می‌کنیم */
    console.error(`[examStore] فایل ${file} قابل خواندن نیست؛ fallback اعمال شد`);
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  if (!existsSync(contentDir)) mkdirSync(contentDir, { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmp, file);
}

let store = null;

/* بارگذاری اولیه — در import ماژول؛ تمام توابع به store در حافظه تکیه دارند */
loadStore();

function loadStore() {
  if (store) return store;

  const examsRaw = readJson(FILES.exams, null);
  const questionsRaw = readJson(FILES.questions, null);
  const attemptsRaw = readJson(FILES.attempts, null);
  const reportsRaw = readJson(FILES.reports, null);
  const auditRaw = readJson(FILES.audit, null);

  store = {
    exams: examsRaw && examsRaw.seedSignature === SEED_SIGNATURE && Array.isArray(examsRaw.exams)
      ? { seededAt: examsRaw.seededAt, seededUsers: examsRaw.seededUsers ?? {}, list: examsRaw.exams }
      : null,
    questions: Array.isArray(questionsRaw?.questions) ? questionsRaw.questions : null,
    attempts: Array.isArray(attemptsRaw?.attempts) ? attemptsRaw.attempts : [],
    reports: Array.isArray(reportsRaw?.reports) ? reportsRaw.reports : [],
    audit: auditRaw && Array.isArray(auditRaw.events)
      ? auditRaw
      : { seq: 0, head: '0'.repeat(64), events: [] },
    sweeper: null,
  };

  ensureExamSeed();
  startSweeper();
  return store;
}

function persistExams() {
  const data = { seedSignature: SEED_SIGNATURE, seededAt: store.exams.seededAt, seededUsers: store.exams.seededUsers, exams: store.exams.list };
  writeJsonAtomic(FILES.exams, data);
}
/* function declaration تا با فراخوانی loadStore در بالای ماژول (قبل از خط تعریف) hoist شده باشد */
function persistQuestions() {
  writeJsonAtomic(FILES.questions, { questions: store.questions });
}
function persistAttempts() {
  writeJsonAtomic(FILES.attempts, { attempts: store.attempts });
}
function persistReports() {
  writeJsonAtomic(FILES.reports, { reports: store.reports });
}
function persistAudit() {
  writeJsonAtomic(FILES.audit, { seq: store.audit.seq, head: store.audit.head, events: store.audit.events });
}

/*
 * Seed اولیه + re-anchor دمو: آزمون‌های seed که تمام شده‌اند و هیچ Attemptی
 * ندارند، دوباره حول «الان» لنگر می‌شوند تا دمو همیشه زنده بماند. آزمون‌های
 * دارای سابقهٔ شرکت‌کننده هرگز جابه‌جا نمی‌شوند. آزمون واقعی ادمین (بدون
 * seedSource) هرگز دست نمی‌خورد.
 */
function ensureExamSeed(now = Date.now()) {
  if (!store.exams || !Array.isArray(store.questions)) {
    store.exams = { seededAt: now, seededUsers: {}, list: buildSeedExams(now) };
    store.questions = buildSeedQuestions();
    persistExams();
    persistQuestions();
    return;
  }

  let reanchored = false;
  for (const exam of store.exams.list) {
    if (exam.seedSource !== 'demo' || exam.alwaysAvailable) continue;
    const releaseBound = Math.max(exam.endTime, exam.resultReleaseAt ?? 0);
    if (now <= releaseBound + 24 * 60 * 60 * 1000) continue;
    const hasHistory = store.attempts.some((attempt) => attempt.examId === exam.id);
    if (hasHistory) continue;

    const anchored = buildSeedExams(now).find((seed) => seed.id === exam.id);
    if (!anchored) continue;
    Object.assign(exam, anchored);
    reanchored = true;
  }
  if (reanchored) persistExams();
}

function startSweeper() {
  if (store.sweeper) return;
  /* سوئیپ انقضا هر ۳۰ ثانیه — unref تا مانع خاموشی پروسه نشود */
  store.sweeper = setInterval(() => {
    try {
      sweepExpiredAttempts();
    } catch (error) {
      console.error('[examStore] sweeper', error);
    }
  }, 30000);
  if (typeof store.sweeper.unref === 'function') store.sweeper.unref();
}

/* ریست برای تست‌ها — فقطAttempt/گزارش/حسابرسی پاک می‌شوند؛ تعریف آزمون‌ها می‌ماند */
export function __resetExamStore({ fullSeed = false } = {}) {
  if (fullSeed || !store) {
    store = null;
    loadStore();
  }
  store.attempts = [];
  store.reports = [];
  store.audit = { seq: 0, head: '0'.repeat(64), events: [] };
  store.exams.seededUsers = {};
  persistAttempts();
  persistReports();
  persistAudit();
  persistExams();
}

/* ────────────────────────── زمان و فاز آزمون ────────────────────────── */

export function nowMs() {
  return Date.now();
}

/*
 * State Machine آزمون — فقط از زمان سرور مشتق می‌شود؛ کلاینت هیچ نقشی در
 * تعیین فاز ندارد. phase مرجع امنیتی است؛ uiStatus فقط برچسب نمایشی.
 */
export function examPhase(exam, now = nowMs()) {
  if (exam.cancelled) return { phase: 'CANCELLED', uiStatus: 'CANCELLED' };
  if (exam.archived) return { phase: 'ARCHIVED', uiStatus: 'FINISHED' };
  if (exam.alwaysAvailable) return { phase: 'AVAILABLE', uiStatus: 'AVAILABLE' };

  if (now < exam.startTime) {
    let uiStatus = 'REGISTRATION_OPEN';
    if (exam.registrationOpenAt && now < exam.registrationOpenAt) uiStatus = 'UPCOMING';
    else if (exam.registrationDeadline && now >= exam.registrationDeadline) uiStatus = 'REGISTRATION_CLOSED';
    return { phase: 'SCHEDULED', uiStatus };
  }

  if (now <= exam.endTime) return { phase: 'LIVE', uiStatus: 'LIVE' };

  /* دورهٔ ظرف submit (grace) — phase رسمی FINISHED است اما submit هنوز باز */
  const submissionOpenUntil = exam.endTime + (exam.graceSeconds ?? 0) * 1000;
  if (now <= submissionOpenUntil) return { phase: 'GRACE', uiStatus: 'FINISHED' };

  if (exam.resultReleaseAt && now >= exam.resultReleaseAt) {
    return { phase: 'RESULTS', uiStatus: 'RESULTS_AVAILABLE' };
  }
  return { phase: 'FINISHED', uiStatus: 'FINISHED' };
}

export function submissionOpenUntil(attempt, exam) {
  return attempt.endsAt + (exam.graceSeconds ?? 0) * 1000;
}

/* ────────────────────────── دادهٔ آزمون و سؤال ────────────────────────── */

const getExamBySlugOrId = (slugOrId) =>
  store.exams.list.find((exam) => exam.slug === slugOrId || exam.id === slugOrId) ?? null;

const getExamById = (examId) => store.exams.list.find((exam) => exam.id === examId) ?? null;

/* سؤال‌های نسخهٔ جاری آزمون — Attempt فقط به همین snapshot متصل می‌شود */
function questionsOfVersion(exam) {
  return store.questions.filter(
    (question) => question.examId === exam.id && (question.version ?? 1) === (exam.currentVersion ?? 1),
  );
}

const questionMap = () => new Map(store.questions.map((question) => [question.id, question]));

/* سؤالِ بدون کلید — تنها شکلی که از مرز سرور به کلاینت عبور می‌کند */
export function sanitizeQuestion(question) {
  return {
    id: question.id,
    examId: question.examId,
    subject: question.subject,
    topic: question.topic,
    difficulty: question.difficulty,
    stem: question.stem,
    options: question.options,
  };
}

/* ────────────────────────── توزیع جامعهٔ آماری (دمو) ────────────────────────── */

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
 * تا وقتی شرکت‌کنندهٔ واقعی کمتر از آستانه است، توزیع دمو (seeded by examId)
 * فضای آماری را پر می‌کند؛ نمرات واقعی شرکت‌کننده‌ها همیشه در توزیع داخل‌اند و
 * با بیشترشدنشان سهم دمو کم می‌شود. سقف آستانه در سند امنیتی مستند است.
 */
const REAL_DISTRIBUTION_THRESHOLD = 10;

function scoreDistribution(exam, now = nowMs()) {
  const meta = COMMUNITY_META[exam.id] ?? { medianPercent: 45, averagePercent: 47, topPercent: 96 };
  const real = submittedAttemptsFor(exam.id, now).map((attempt) => attempt.result?.percentage ?? 0);

  if (real.length >= REAL_DISTRIBUTION_THRESHOLD) {
    return { scores: [...real].sort((a, b) => b - a), meta, synthetic: false };
  }

  const rng = mulberry32(hashSeed(exam.id));
  const target = Math.max(exam.participantsCount ?? 100, 60);
  const syntheticCount = Math.max(target - real.length, 0);
  const synthetic = new Array(syntheticCount);
  for (let i = 0; i < syntheticCount; i += 1) {
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const value = meta.averagePercent + normal * 17;
    synthetic[i] = Math.min(Math.max(value, 0), meta.topPercent);
  }
  return { scores: [...real, ...synthetic].sort((a, b) => b - a), meta, synthetic: true };
}

/* ────────────────────────── Attempt ────────────────────────── */

const attemptForExam = (identityId, examId) =>
  store.attempts
    .filter((attempt) => attempt.userId === identityId && attempt.examId === examId)
    .sort((a, b) => b.startedAt - a.startedAt);

const submittedAttemptsFor = (examId, now = nowMs()) =>
  store.attempts.filter(
    (attempt) => attempt.examId === examId
      && attempt.status === 'submitted'
      && (attempt.result?.percentage ?? 0) >= 0
      /* Attempt دموی seed در رتبه‌بندی واقعی شرکت نمی‌کند مگر کاربر واقعی باشد */
      && attempt.demo !== true,
  );

function findAttempt(identityId, attemptId) {
  const attempt = store.attempts.find((item) => item.id === attemptId) ?? null;
  /* ownership — Attempt کاربر دیگر حتی با ID درست در دسترس نیست (ضد IDOR) */
  if (!attempt || attempt.userId !== identityId) return null;
  return attempt;
}

function publicAttempt(attempt) {
  return {
    id: attempt.id,
    userId: attempt.userId,
    examId: attempt.examId,
    examSlug: attempt.examSlug,
    startedAt: attempt.startedAt,
    endsAt: attempt.endsAt,
    submittedAt: attempt.submittedAt,
    status: attempt.status,
    reason: attempt.reason ?? null,
    questionIds: attempt.questionIds,
    answers: attempt.answers ?? {},
    marked: attempt.marked ?? [],
    currentIndex: attempt.currentIndex ?? null,
    subjectTab: attempt.subjectTab ?? null,
    exitedAt: attempt.exitedAt ?? null,
    result: attempt.result ?? null,
    demo: attempt.demo ?? false,
  };
}

/*
 * نهایی‌سازی Attempt (submit یا انقضا) — تنها نقطهٔ گذار IN_PROGRESS→SUBMITTED.
 * خروجی تغییرن‌پذیر ثبت می‌شود؛ فراخوانی دوباره همان رکورد را برمی‌گرداند
 * (idempotency در سطح گذار وضعیت).
 */
function finalizeAttempt(attempt, exam, reason, now = nowMs()) {
  if (attempt.status !== 'in_progress') return attempt;

  const limit = submissionOpenUntil(attempt, exam);
  const timedOut = reason === 'timeout' || now > limit || now > attempt.endsAt + (exam.graceSeconds ?? 0) * 1000;
  const effectiveNow = Math.min(now, limit);

  attempt.status = 'submitted';
  attempt.submittedAt = timedOut ? attempt.endsAt : effectiveNow;
  attempt.reason = timedOut ? 'timeout' : reason === 'grace' ? 'grace' : reason;
  attempt.result = buildResult(attempt, exam, attempt.reason, now);
  persistAttempts();

  appendAudit(timedOut ? 'EXAM_EXPIRED' : 'EXAM_SUBMITTED', {
    actorId: attempt.userId,
    examId: exam.id,
    attemptId: attempt.id,
    detail: { reason: attempt.reason, percentage: attempt.result?.percentage ?? null },
  });

  return attempt;
}

/* سوئیپ انقضا — هر درخواست مرتبط با Attempt هم پیش از هر کاری صدا می‌زند */
function sweepExpiredAttempts(now = nowMs()) {
  let changed = false;
  for (const attempt of store.attempts) {
    if (attempt.status !== 'in_progress') continue;
    const exam = getExamById(attempt.examId);
    if (!exam) continue;
    if (now > submissionOpenUntil(attempt, exam)) {
      finalizeAttempt(attempt, exam, 'timeout', now);
      changed = true;
    }
  }
  if (changed) persistAttempts();
}

function activeAttemptOf(identityId) {
  return (
    store.attempts
      .filter((attempt) => attempt.userId === identityId && attempt.status === 'in_progress')
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  );
}

/* ────────────────────────── تصحیح و نتیجه (فقط سرور) ────────────────────────── */

function gradeAttempt(attempt, exam) {
  const map = questionMap();
  let correct = 0;
  let wrong = 0;

  for (const [questionId, answer] of Object.entries(attempt.answers ?? {})) {
    const question = map.get(questionId);
    if (!question || !answer || answer.selected == null) continue;
    if (answer.selected === question.correctAnswer) correct += 1;
    else wrong += 1;
  }

  const total = attempt.questionIds.length;
  const answered = Object.values(attempt.answers ?? {}).filter((answer) => answer && answer.selected != null).length;
  const unanswered = total - answered;
  const negative = exam.rules.negativeMarking ?? 0;
  const score = correct + wrong * negative;
  const percentage = Math.max(0, Math.min(100, Math.round((score / Math.max(total, 1)) * 1000) / 10));

  const subjectMap = new Map();
  for (const questionId of attempt.questionIds) {
    const question = map.get(questionId);
    if (!question) continue;
    const entry = subjectMap.get(question.subject) ?? { subject: question.subject, correct: 0, wrong: 0, unanswered: 0, total: 0 };
    entry.total += 1;
    const answer = (attempt.answers ?? {})[questionId];
    if (!answer || answer.selected == null) entry.unanswered += 1;
    else if (answer.selected === question.correctAnswer) entry.correct += 1;
    else entry.wrong += 1;
    subjectMap.set(question.subject, entry);
  }
  const subjects = [...subjectMap.values()]
    .map((entry) => ({ ...entry, percent: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0 }))
    .sort((a, b) => b.percent - a.percent);

  return { correct, wrong, unanswered, total, score, percentage, subjects, negative };
}

function buildResult(attempt, exam, reason, now = nowMs()) {
  const grade = gradeAttempt(attempt, exam);
  const { scores, meta, synthetic } = scoreDistribution(exam, now);
  const participants = scores.length;

  const better = scores.filter((value) => value > grade.percentage).length;
  const rank = better + 1;
  const percentile = Math.max(0, Math.round(((participants - rank) / participants) * 100));
  const teraz = Math.round(4200 + grade.percentage * 53); /* فرمول دموی تراز — در نسخهٔ رسمی policy جداگانه دارد */

  const timeSpent = Math.min(
    Math.round(((attempt.submittedAt ?? now) - attempt.startedAt) / 1000),
    (exam.duration ?? 60) * 60,
  );

  return {
    attemptId: attempt.id,
    examId: exam.id,
    examSlug: exam.slug,
    examTitle: exam.title,
    examType: exam.type,
    submittedAt: attempt.submittedAt,
    reason, // user | timeout | auto | grace
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
      synthetic,
    },
    subjects: grade.subjects,
  };
}

/* ────────────────────────── وضعیت کاربر برای آزمون ────────────────────────── */

function computeUserState(identity, exam, now = nowMs()) {
  const { phase, uiStatus } = examPhase(exam, now);
  /* مهمان (بدون سشن) هم می‌تواند فهرست/جزئیات را ببیند؛ هویت null یعنی هیچ
     Attempt و ثبت‌نامی ندارد — می‌بیند، اما شرکت نمی‌کند. */
  const userId = identity?.id ?? null;
  const attempts = attemptForExam(userId, exam.id);
  const registered = Boolean(userId && exam.registrations?.[userId]);
  const active = attempts.find((attempt) => attempt.status === 'in_progress') ?? null;
  const completed = attempts.filter((attempt) => attempt.status !== 'in_progress');
  const lastCompleted = completed[0] ?? null;
  const resultReady =
    (phase === 'RESULTS' || phase === 'AVAILABLE') && Boolean(lastCompleted);

  const withinLateWindow =
    exam.lateRegistration && now < (exam.registrationDeadline ?? 0) && (phase === 'SCHEDULED' || phase === 'LIVE');

  return {
    status: uiStatus,
    phase,
    registered,
    registeredAt: (userId && exam.registrations?.[userId]) ?? null,
    canRegister: !registered && !exam.alwaysAvailable
      && (uiStatus === 'REGISTRATION_OPEN' || withinLateWindow),
    canCancelRegistration: registered && uiStatus === 'REGISTRATION_OPEN',
    attemptsUsed: attempts.length,
    attemptLimit: exam.rules.attemptLimit,
    canStart:
      phase === 'AVAILABLE'
        ? attempts.length < exam.rules.attemptLimit
        : phase === 'LIVE' && (registered || exam.type === 'quiz') && attempts.length < exam.rules.attemptLimit,
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

function publicExam(exam) {
  const { seedSource, registrations, ...safe } = exam;
  void seedSource;
  void registrations; /* فهرست ثبت‌نامی هرگز به کلاینت نمی‌رود */
  return safe;
}

function statusMetaOf(uiStatus) {
  const META = {
    UPCOMING: { label: 'در انتظار برگزاری', accent: '#8a8a8a' },
    REGISTRATION_OPEN: { label: 'ثبت‌نام فعال', accent: '#61D192' },
    REGISTRATION_CLOSED: { label: 'ثبت‌نام بسته', accent: '#e0b45c' },
    LIVE: { label: 'در حال برگزاری', accent: '#e26d6d' },
    FINISHED: { label: 'پایان یافته', accent: '#8a8a8a' },
    RESULTS_AVAILABLE: { label: 'کارنامه آماده', accent: '#937fcd' },
    AVAILABLE: { label: 'آماده شروع', accent: '#61D192' },
    CANCELLED: { label: 'لغو شده', accent: '#e26d6d' },
  };
  return META[uiStatus] ?? META.UPCOMING;
}

export function examSummaryFor(identity, exam, now = nowMs()) {
  const bankCount = questionsOfVersion(exam).length;
  const userState = computeUserState(identity, exam, now);
  return {
    ...publicExam(exam),
    ...userState,
    statusMeta: statusMetaOf(userState.status),
    id: exam.id,
    slug: exam.slug,
    bankCount,
    effectiveQuestionCount: bankCount || exam.questionCount,
  };
}

export function listExamsFor(identity, now = nowMs()) {
  return store.exams.list.map((exam) => examSummaryFor(identity, exam, now));
}

export function examBySlug(slug) {
  return getExamBySlugOrId(slug);
}

export function examDetailFor(identity, slug, now = nowMs()) {
  const exam = getExamBySlugOrId(slug);
  if (!exam) return null;
  return {
    ...examSummaryFor(identity, exam, now),
    userState: computeUserState(identity, exam, now),
  };
}

/* ────────────────────────── seed دموی کاربر تازه ────────────────────────── */

function ensureUserSeed(identity, now = nowMs()) {
  /* کاربر ناشناس (آزمونک مهمان) دادهٔ دموی کارنامه نمی‌گیرد */
  if (!identity.id || identity.anonymous || store.exams.seededUsers[identity.id]) return;
  store.exams.seededUsers[identity.id] = true;

  const biochem = getExamById('exam-biochem-past-01');
  const physio = getExamById('exam-physio-live-01');

  if (biochem) {
    const ids = questionsOfVersion(biochem).map((question) => question.id);
    const demoPicks = { 'q-bio-01': 1, 'q-bio-02': 1, 'q-bio-03': 0, 'q-bio-04': 2, 'q-bio-06': 2 };
    const answers = {};
    ids.forEach((questionId, index) => {
      if (demoPicks[questionId] !== undefined) {
        answers[questionId] = {
          selected: demoPicks[questionId],
          timeSpent: 90 + index * 55,
          answeredAt: biochem.startTime + (index + 1) * 210000,
          changes: 1,
        };
      }
    });
    const attempt = {
      id: `att-seed-${hashSeed(String(identity.id)).toString(36)}`,
      userId: identity.id,
      examId: biochem.id,
      examSlug: biochem.slug,
      examVersion: biochem.currentVersion ?? 1,
      startedAt: biochem.startTime,
      endsAt: biochem.endTime,
      submittedAt: biochem.endTime - 6 * 60000,
      status: 'submitted',
      reason: 'user',
      questionIds: ids,
      answers,
      marked: ['q-bio-05'],
      demo: true,
    };
    attempt.result = buildResult(attempt, biochem, 'user', now);
    store.attempts.push(attempt);
  }

  if (physio && !physio.registrations?.[identity.id]) {
    physio.registrations = physio.registrations ?? {};
    physio.registrations[identity.id] = now - 24 * 60 * 60 * 1000;
  }

  persistExams();
  persistAttempts();
}

/* ────────────────────────── عملیات ثبت‌نام ────────────────────────── */

export function registerFor(identity, slug, now = nowMs()) {
  const exam = getExamBySlugOrId(slug);
  if (!exam) return { error: 'exam-not-found' };

  const { phase, uiStatus } = examPhase(exam, now);
  const withinLateWindow = exam.lateRegistration && now < (exam.registrationDeadline ?? 0)
    && (phase === 'SCHEDULED' || phase === 'LIVE');

  if (uiStatus !== 'REGISTRATION_OPEN' && !withinLateWindow && phase !== 'AVAILABLE') {
    return { error: 'registration-closed' };
  }

  exam.registrations = exam.registrations ?? {};
  if (!exam.registrations[identity.id]) {
    exam.registrations[identity.id] = now;
    persistExams();
    appendAudit('EXAM_REGISTERED', { actorId: identity.id, examId: exam.id, detail: { slug: exam.slug } });
  }
  return { ok: true, registeredAt: exam.registrations[identity.id] };
}

export function cancelRegistrationFor(identity, slug, now = nowMs()) {
  const exam = getExamBySlugOrId(slug);
  if (!exam) return { error: 'exam-not-found' };
  const { uiStatus } = examPhase(exam, now);
  if (uiStatus !== 'REGISTRATION_OPEN') return { error: 'registration-closed' };

  if (exam.registrations?.[identity.id]) {
    delete exam.registrations[identity.id];
    persistExams();
    appendAudit('EXAM_REGISTRATION_CANCELLED', { actorId: identity.id, examId: exam.id, detail: { slug: exam.slug } });
  }
  return { ok: true };
}

/* ────────────────────────── موتور Attempt ────────────────────────── */

export function startAttempt(identity, slug, now = nowMs()) {
  sweepExpiredAttempts(now);
  const exam = getExamBySlugOrId(slug);
  if (!exam) return { error: 'exam-not-found' };
  ensureUserSeed(identity, now);

  const { phase } = examPhase(exam, now);
  const registered = Boolean(exam.registrations?.[identity.id]);

  if (phase === 'LIVE' && !registered && exam.type !== 'quiz') return { error: 'not-registered' };
  if (phase !== 'LIVE' && phase !== 'AVAILABLE') return { error: 'exam-not-open' };

  const attempts = attemptForExam(identity.id, exam.id);
  if (attempts.length >= exam.rules.attemptLimit) return { error: 'attempt-limit-reached' };

  /* دوبارکلیک/دو درخواست همزمان: همان Attempt باز قبلی برگردد، دومی ساخته نمی‌شود */
  const existing = attempts.find((attempt) => attempt.status === 'in_progress');
  if (existing) return { attempt: publicAttempt(existing), resumed: true };

  const bank = questionsOfVersion(exam);
  if (!bank.length) return { error: 'questions-not-published' };

  const attempt = {
    id: `att-${randomBytes(16).toString('hex')}`, /* غیرترتیبی — غیرقابل حدس */
    userId: identity.id,
    examId: exam.id,
    examSlug: exam.slug,
    examVersion: exam.currentVersion ?? 1, /* snapshot نسخه — PHASE 6 */
    startedAt: now,
    endsAt: exam.rules.deadlineMode === 'per_attempt' ? now + exam.duration * 60000 : exam.endTime,
    submittedAt: null,
    status: 'in_progress',
    questionIds: bank.map((question) => question.id),
    answers: {},
    deliveredAt: {},
    marked: [],
  };
  store.attempts.push(attempt);
  persistAttempts();

  appendAudit('ATTEMPT_CREATED', {
    actorId: identity.id,
    examId: exam.id,
    attemptId: attempt.id,
    detail: { examVersion: attempt.examVersion, endsAt: attempt.endsAt },
  });

  return { attempt: publicAttempt(attempt) };
}

export function getAttemptFor(identity, attemptId, now = nowMs()) {
  sweepExpiredAttempts(now);
  const attempt = findAttempt(identity.id, attemptId);
  if (!attempt) return { error: 'attempt-not-found' };
  return { attempt: publicAttempt(attempt) };
}

export function getActiveAttemptFor(identity, now = nowMs()) {
  sweepExpiredAttempts(now);
  const active = activeAttemptOf(identity.id);
  return { attempt: active ? publicAttempt(active) : null };
}

/*
 * تحویل سؤال — تنها مسیر خروج سؤال از سرور.
 * شرط: Attempt متعلق به کاربر، در جریان، و سؤال از snapshot همان Attempt.
 * هر تحویل در deliveredAt ثبت می‌شود؛ پاسخِ سؤالِ تحویل‌نشده پذیرفته نمی‌شود.
 */
export function questionsForAttempt(identity, attemptId, now = nowMs()) {
  sweepExpiredAttempts(now);
  const attempt = findAttempt(identity.id, attemptId);
  if (!attempt) return { error: 'attempt-not-found' };
  if (attempt.status !== 'in_progress') return { error: 'attempt-closed' };

  const exam = getExamById(attempt.examId);
  if (!exam) return { error: 'exam-not-found' };

  const map = questionMap();
  const firstDelivery = Object.keys(attempt.deliveredAt ?? {}).length === 0;

  const questions = attempt.questionIds.map((questionId) => {
    const question = map.get(questionId);
    if (!question) return null;
    attempt.deliveredAt = attempt.deliveredAt ?? {};
    if (!attempt.deliveredAt[questionId]) attempt.deliveredAt[questionId] = now;
    return sanitizeQuestion(question);
  }).filter(Boolean);

  persistAttempts();
  if (firstDelivery) {
    appendAudit('QUESTION_DELIVERED', {
      actorId: identity.id,
      examId: attempt.examId,
      attemptId: attempt.id,
      detail: { count: questions.length, version: attempt.examVersion },
    });
  }

  return { attempt: publicAttempt(attempt), questions };
}

/*
 * ثبت پاسخ (delta) — idempotent و mergeable؛ چند Tab/دستگاه نتیجهٔ دترمنیستیک
 * دارد. مقدار null یعنی لغو پاسخ. هر ورودی خارج از snapshot Attempt رد می‌شود.
 */
export function recordAnswerDelta(identity, attemptId, delta, now = nowMs()) {
  sweepExpiredAttempts(now);
  const attempt = findAttempt(identity.id, attemptId);
  if (!attempt) return { error: 'attempt-not-found' };

  const exam = getExamById(attempt.examId);
  if (!exam) return { error: 'exam-not-found' };

  if (attempt.status !== 'in_progress') return { error: 'attempt-closed' };
  if (now > attempt.endsAt) return { error: 'time-over' }; /* grace فقط برای submit است */

  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) return { error: 'invalid-payload' };
  const entries = Object.entries(delta).slice(0, 60); /* سقف اندازهٔ هر push */
  if (!entries.length) return { attempt: publicAttempt(attempt) };

  const ids = new Set(attempt.questionIds);
  const map = questionMap();
  let applied = 0;

  for (const [questionId, value] of entries) {
    if (!ids.has(questionId)) return { error: 'question-not-in-attempt' };
    if (value === null) {
      delete attempt.answers[questionId];
      applied += 1;
      continue;
    }
    const selected = Number(value?.selected ?? value);
    if (!Number.isInteger(selected) || selected < 0 || selected > 3) return { error: 'invalid-answer' };
    const question = map.get(questionId);
    if (question && selected >= question.options.length) return { error: 'invalid-answer' };

    const previous = attempt.answers[questionId];
    attempt.answers[questionId] = {
      selected,
      answeredAt: now,
      changes: (previous?.changes ?? 0) + 1,
    };
    /* پاسخ یعنی تحویل — حافظهٔ دفاعی در صورتی که fetch سؤال از دست رفته باشد */
    attempt.deliveredAt = attempt.deliveredAt ?? {};
    if (!attempt.deliveredAt[questionId]) attempt.deliveredAt[questionId] = now;
    applied += 1;
  }

  persistAttempts();
  if (applied) {
    appendAudit('ANSWER_RECORDED', {
      actorId: identity.id,
      examId: attempt.examId,
      attemptId: attempt.id,
      detail: { applied },
    });
  }

  return { attempt: publicAttempt(attempt) };
}

/* وضعیت غیرامنیتی UI — فقط وقتی Attempt در جریان است اعمال می‌شود */
export function saveAttemptProgressFor(identity, attemptId, patch, now = nowMs()) {
  sweepExpiredAttempts(now);
  const attempt = findAttempt(identity.id, attemptId);
  if (!attempt) return { error: 'attempt-not-found' };
  if (attempt.status !== 'in_progress') return { attempt: publicAttempt(attempt) };

  if (Array.isArray(patch?.marked)) {
    const ids = new Set(attempt.questionIds);
    attempt.marked = patch.marked.filter((questionId) => ids.has(questionId));
  }
  if (Number.isInteger(patch?.currentIndex)) {
    attempt.currentIndex = Math.max(0, Math.min(attempt.questionIds.length - 1, patch.currentIndex));
  }
  if (typeof patch?.subjectTab === 'string' && patch.subjectTab.length <= 64) {
    attempt.subjectTab = patch.subjectTab;
  }
  /* فلگ نمایشی «خروج آگاهانه» — Resume خودکار بعد از Refresh فقط وقتی ست نیست */
  if (patch?.exitedAt === null || typeof patch?.exitedAt === 'number') {
    attempt.exitedAt = patch.exitedAt;
  }
  persistAttempts();
  return { attempt: publicAttempt(attempt) };
}

/*
 * Submit نهایی — idempotent: فراخوانی دوم همان نتیجهٔ اول را برمی‌گرداند و
 * نمرهٔ جدیدی محاسبه نمی‌شود. پنجرهٔ مجاز: تا endsAt + graceSeconds.
 */
export function submitAttemptFor(identity, attemptId, { reason = 'user' } = {}, now = nowMs()) {
  sweepExpiredAttempts(now);
  const attempt = findAttempt(identity.id, attemptId);
  if (!attempt) return { error: 'attempt-not-found' };

  const exam = getExamById(attempt.examId);
  if (!exam) return { error: 'exam-not-found' };

  if (attempt.status !== 'in_progress') {
    return { attempt: publicAttempt(attempt), result: attempt.result, reward: rewardOf(attempt.result, exam), idempotent: true };
  }
  if (now > submissionOpenUntil(attempt, exam)) {
    finalizeAttempt(attempt, exam, 'timeout', now);
    return { attempt: publicAttempt(attempt), result: attempt.result, reward: rewardOf(attempt.result, exam), expired: true };
  }

  const withinGrace = now > attempt.endsAt;
  finalizeAttempt(attempt, exam, withinGrace ? 'grace' : sanitizeReason(reason), now);

  return { attempt: publicAttempt(attempt), result: attempt.result, reward: rewardOf(attempt.result, exam) };
}

function sanitizeReason(reason) {
  return ['user', 'timeout', 'auto', 'grace'].includes(reason) ? reason : 'user';
}

/* ────────────────────────── کارنامه، مرور، رتبه ────────────────────────── */

function releaseGate(exam, now = nowMs()) {
  /* آزمون همیشه‌در‌دسترس کارنامهٔ فوری دارد؛ بقیه تا resultReleaseAt پردازشی‌اند */
  if (exam.alwaysAvailable || !exam.resultReleaseAt) return { open: true };
  if (now >= exam.resultReleaseAt) return { open: true };
  return { open: false, releaseAt: exam.resultReleaseAt };
}

export function resultFor(identity, slug, now = nowMs()) {
  sweepExpiredAttempts(now);
  const exam = getExamBySlugOrId(slug);
  if (!exam) return { error: 'exam-not-found' };

  const completed = attemptForExam(identity.id, exam.id).filter((attempt) => attempt.status !== 'in_progress');
  if (!completed.length) return { state: 'not_participated', exam: publicExam(exam) };

  const gate = releaseGate(exam, now);
  if (!gate.open) return { state: 'processing', exam: publicExam(exam), releaseAt: gate.releaseAt };

  const last = completed[0];
  const examCurrent = getExamById(last.examId);
  if (!last.result && examCurrent) {
    /* Attempt بدون نتیجه (مثلاً کرش بین submit و persist) — دترمنیستیک بازمحاسبه می‌شود */
    last.result = buildResult(last, examCurrent, last.reason ?? 'user', now);
    persistAttempts();
  }

  return { state: 'ready', exam: publicExam(exam), result: last.result, attempt: publicAttempt(last) };
}

export function reviewFor(identity, slug, now = nowMs()) {
  sweepExpiredAttempts(now);
  const exam = getExamBySlugOrId(slug);
  if (!exam) return { error: 'exam-not-found' };

  const completed = attemptForExam(identity.id, exam.id).filter((attempt) => attempt.status !== 'in_progress');
  if (!completed.length) return { error: 'review-not-allowed' };

  const gate = releaseGate(exam, now);
  if (!gate.open) return { error: 'review-not-released', releaseAt: gate.releaseAt };

  const attempt = completed[0];
  const map = questionMap();
  const questions = attempt.questionIds
    .map((questionId) => {
      const question = map.get(questionId);
      if (!question) return null;
      return { ...question, userAnswer: attempt.answers?.[questionId] ?? null };
    })
    .filter(Boolean);

  return { exam: publicExam(exam), attempt: publicAttempt(attempt), questions };
}

export function rankingFor(identity, slug, now = nowMs()) {
  sweepExpiredAttempts(now);
  const exam = getExamBySlugOrId(slug);
  if (!exam) return { error: 'exam-not-found' };

  const completed = attemptForExam(identity.id, exam.id).find((attempt) => attempt.status !== 'in_progress');
  const { scores } = scoreDistribution(exam, now);

  const mine = completed?.result?.percentage ?? null;
  const rank = mine === null ? null : scores.filter((value) => value > mine).length + 1;
  const median = scores[Math.floor(scores.length / 2)];
  const average = Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10;

  return {
    participantsCount: scores.length,
    topPercent: Math.round(scores[0] ?? 0),
    medianPercent: Math.round(median ?? 0),
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
}

/* پاداش لیگ — همان قرارداد سرویس قبلی؛ سرور مرجع است */
export function rewardOf(result, exam) {
  if (!result || !exam) return null;
  const base = exam.type === 'quiz' ? 5 : 10;
  const bonus = Math.round(result.percentage / 10);
  return { hearts: base + bonus, base, bonus };
}

/* ────────────────────────── گزارش ایراد سؤال ────────────────────────── */

export function fileQuestionReport(identity, questionId, payload, now = nowMs()) {
  if (!questionId || typeof questionId !== 'string' || questionId.length > 64) return { error: 'question-required' };
  const reason = typeof payload?.reason === 'string' ? payload.reason.trim() : '';
  if (!reason || reason.length > 64) return { error: 'reason-required' };

  const report = {
    id: `rep-${randomBytes(8).toString('hex')}`,
    userId: identity.id,
    questionId,
    examId: typeof payload?.examId === 'string' ? payload.examId.slice(0, 64) : null,
    attemptId: typeof payload?.attemptId === 'string' ? payload.attemptId.slice(0, 64) : null,
    reason: reason.slice(0, 64),
    note: String(payload?.note ?? '').slice(0, 500),
    createdAt: now,
    status: 'open',
  };
  store.reports.push(report);
  persistReports();

  appendAudit('QUESTION_REPORTED', {
    actorId: identity.id,
    examId: report.examId,
    attemptId: report.attemptId,
    detail: { questionId, reason: report.reason },
  });
  return { report };
}

/* خواندن/مدیریت گزارش‌های ایراد سؤال برای بخش بازخورد پنل مدیریت */
export function listQuestionReports() {
  return store.reports.map((report) => ({ ...report }));
}

export function setQuestionReportStatus(id, status) {
  const report = store.reports.find((row) => row.id === id);
  if (!report) return null;
  report.status = status === 'resolved' ? 'resolved' : 'open';
  persistReports();
  return { ...report };
}

export function removeQuestionReport(id) {
  const index = store.reports.findIndex((row) => row.id === id);
  if (index === -1) return false;
  store.reports.splice(index, 1);
  persistReports();
  return true;
}

/* ────────────────────────── Audit Log (append-only + hash chain) ────────────────────────── */

function appendAudit(action, { actorId = null, examId = null, attemptId = null, detail = null } = {}) {
  const audit = store.audit;
  const event = {
    seq: audit.seq + 1,
    ts: Date.now(),
    actorId,
    action,
    examId,
    attemptId,
    detail,
  };

  const canonical = JSON.stringify({ ...event, prevHash: audit.head });
  event.prevHash = audit.head;
  event.hash = createHash('sha256').update(canonical).digest('hex');

  audit.events.push(event);
  audit.seq = event.seq;
  audit.head = event.hash;

  /* چرخش فایل وقتی بزرگ شد — زنجیرهٔ آرشیو با head قبلی ادامه می‌یابد */
  if (audit.events.length >= AUDIT_ROTATE_LIMIT) {
    const archivePath = FILES.audit.replace(/\.json$/, `-${event.seq}.json`);
    writeJsonAtomic(archivePath, { seq: audit.seq, head: audit.head, events: audit.events });
    audit.events = [];
  }
  persistAudit();
}

/* صحت زنجیره — تغییر بعدی هر رویداد قابل تشخیص است (tamper-evident) */
export function verifyAuditChain() {
  const audit = loadStore().audit;
  let prevHash = '0'.repeat(64);
  for (const event of audit.events) {
    const { hash, ...rest } = event;
    const expected = createHash('sha256').update(JSON.stringify({ ...rest, prevHash })).digest('hex');
    if (event.prevHash !== prevHash || hash !== expected) {
      return { valid: false, brokenAt: event.seq };
    }
    prevHash = hash;
  }
  return { valid: true, head: audit.head, seq: audit.seq };
}

/* ────────────────────────── ابزار تست ────────────────────────── */

export function __examTestHooks() {
  return {
    getStore: () => store,
    getExamById,
    getExamBySlugOrId,
    files: FILES,
    nowMs,
    persistExams,
    /* لنگر دوبارهٔ زمانی یک آزمون seed برای تست‌های قطعی (استقلال از ساعت واقعی) */
    reanchorExam(examId, now = Date.now()) {
      const exam = getExamById(examId);
      const anchored = buildSeedExams(now).find((seed) => seed.id === examId);
      if (exam && anchored) {
        Object.assign(exam, anchored);
        persistExams();
      }
      return exam;
    },
  };
}
