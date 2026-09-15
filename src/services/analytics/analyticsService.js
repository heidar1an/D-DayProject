/*
 * AnalyticsService — لایهٔ سرویس «تحلیل عملکرد تست‌ها».
 *
 * پیاده‌سازی فعلی Mock است اما قرارداد آن API-ready طراحی شده؛ با اتصال Backend
 * فقط بدنهٔ توابع به fetch تبدیل می‌شود و نه امضا عوض می‌شود و نه شکل Entityها:
 *
 *   GET /api/analytics/overview?days=&mode=&subject=    → fetchAnalyticsOverview()
 *   GET /api/analytics/trend                            → fetchPerformanceTrend()
 *   GET /api/analytics/subjects                         → fetchSubjectAnalytics()
 *   GET /api/analytics/topics?subject=                  → fetchTopicAnalytics()
 *   GET /api/analytics/questions                        → fetchQuestionAnalytics()
 *   GET /api/analytics/exams                            → fetchExamAnalytics()
 *   GET /api/analytics/exams/:id                        → fetchExamDetail()
 *   GET /api/analytics/behavior                         → fetchBehaviorAnalytics()
 *   GET /api/analytics/diagnosis                        → fetchDiagnosis()
 *   GET /api/analytics/summary/week                     → fetchWeeklySummary()
 *
 * منبع داده فعلی: تاریخچهٔ Mock قطعی (per-user) + سشن‌های واقعی بانک تست تپش
 * (testBankService) که در لحظهٔ خواندن به Attempt تبدیل و ادغام می‌شوند؛ یعنی
 * تست‌هایی که کاربر همین الان در بانک می‌زند هم در تحلیل دیده می‌شوند.
 */
import { QUESTIONS, SUBJECTS, questionById } from '../testBank/mockData';
import { fetchSubmittedSessions } from '../testBank/testBankService';
import { generateMockHistory } from './mockData';
import {
  aggregateExams,
  buildAnalyticsModel,
  buildDailySeries,
  comparePeriods,
  aggregateByQuestion,
  startOfToday,
} from './analyticsEngine';

const STATE_KEY_PREFIX = 'tapesh:analytics:v1:';
const LATENCY_MS = 260;
const HISTORY_DAYS = 84;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const respond = async (build) => {
  await delay(LATENCY_MS + Math.random() * 160);
  return build();
};

/* ────────────────────────── فیلترها ────────────────────────── */

export const TIME_RANGES = [
  { key: '7d', label: '۷ روز اخیر', days: 7 },
  { key: '30d', label: '۳۰ روز اخیر', days: 30 },
  { key: '90d', label: '۳ ماه اخیر', days: 90 },
  { key: 'all', label: 'تمام زمان', days: null },
];

export const MODE_FILTERS = [
  { key: 'all', label: 'همهٔ تست‌ها' },
  { key: 'practice', label: 'تمرینی' },
  { key: 'exam', label: 'آزمون' },
];

export const EMPTY_FILTERS = {
  range: '30d',
  mode: 'all',
  subjectIds: [],
  topicPath: null, // 'مبحث › زیرمبحث'
};

export function normalizeFilters(filters = {}) {
  const merged = { ...EMPTY_FILTERS, ...filters };
  return {
    range: TIME_RANGES.some((range) => range.key === merged.range) ? merged.range : '30d',
    mode: MODE_FILTERS.some((mode) => mode.key === merged.mode) ? merged.mode : 'all',
    subjectIds: [...(merged.subjectIds ?? [])],
    topicPath: merged.topicPath ?? null,
  };
}

export const rangeDays = (rangeKey) => TIME_RANGES.find((range) => range.key === rangeKey)?.days ?? null;

/* ────────────────────────── وضعیت (Mock Backend) ────────────────────────── */

const resolveUserKey = (userRef) => {
  if (typeof userRef === 'string') return userRef || 'guest';
  const identity = userRef?.id ?? userRef?.phone;
  return identity ? String(identity) : 'guest';
};

const stateKey = (userId) => `${STATE_KEY_PREFIX}${resolveUserKey(userId)}`;

/* تاریخچهٔ Mock — قطعی per-user و کش‌شده؛ رفتار معادل یک Backend */
function loadMockHistory(userId) {
  if (typeof window === 'undefined') return generateMockHistory(userId);
  try {
    const cached = JSON.parse(window.localStorage.getItem(stateKey(userId)) || 'null');
    if (cached?.attempts?.length) return cached;
  } catch {
    /* کش خراب → تولید دوباره */
  }
  const fresh = generateMockHistory(userId);
  try {
    window.localStorage.setItem(stateKey(userId), JSON.stringify(fresh));
  } catch {
    /* پر بودن localStorage تحلیل را نمی‌شکند */
  }
  return fresh;
}

/* بازتولید تاریخچهٔ نمونه (توسعه/دمو) */
export function resetMockHistory(userId) {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(stateKey(userId));
  }
  return loadMockHistory(userId);
}

/* ────────────────────────── تغذیهٔ متادیتای سؤال ────────────────────────── */

const subjectMeta = new Map(SUBJECTS.map((subject) => [subject.id, subject]));

function enrichAttempt(attempt) {
  const question = questionById(attempt.questionId);
  if (!question) return null;
  const subject = subjectMeta.get(question.subject);
  return {
    ...attempt,
    subject: question.subject,
    subjectName: subject?.name ?? question.subject,
    subjectAccent: subject?.accent ?? '#9aa5b1',
    topicPath: question.topicPath,
    difficulty: question.difficulty,
    type: question.type,
    year: question.year,
    source: question.source,
    expectedTime: question.stats?.avgTimeSec ?? null,
    stem: question.stem, /* برای پیش‌نمایش در تحلیل سؤال */
  };
}

/* سشن واقعی بانک تست → رکورد سشن + Attemptهای استاندارد تحلیل */
function mapLiveSession(session) {
  const mode = session.mode === 'exam' ? 'exam' : 'practice';
  const mapped = {
    id: session.id,
    mode,
    title: session.title,
    subtitle: session.subtitle ?? '',
    startedAt: session.startedAt,
    submittedAt: session.submittedAt,
    durationMinutes: session.endsAt ? Math.round((session.endsAt - session.startedAt) / 60000) : null,
    status: session.status,
    negativeMarking: session.negativeMarking ?? 0,
    examKind: session.blueprint?.kind === 'year' ? 'official' : session.blueprint?.examId ? 'personal' : mode === 'exam' ? 'personal' : null,
    timedOut: session.result?.reason === 'timeout',
    rank: null,
    percentile: null,
    source: 'live',
  };
  const attempts = (session.questionIds ?? [])
    .map((questionId, order) => {
      const question = questionById(questionId);
      if (!question) return null;
      const answer = session.answers?.[questionId] ?? null;
      const correct = answer ? answer.selected === question.correctAnswer : null;
      return {
        id: `live-${session.id}-${questionId}-${order}`,
        questionId,
        sessionId: session.id,
        examId: mode === 'exam' ? session.id : null,
        mode,
        selected: answer?.selected ?? null,
        correct,
        timeSpent: answer?.timeSpent ?? 0,
        confidence: null, /* بانک فعلی اطمینان ثبت نمی‌کند — تحلیل صادقانه می‌ماند */
        errorType: null,
        skipped: false,
        timestamp: answer?.answeredAt ?? session.submittedAt ?? session.startedAt,
      };
    })
    .filter(Boolean);
  return { session: mapped, attempts };
}

/* بارگذاری کل دادهٔ Attempt کاربر: Mock + واقعی، تغذیه‌شده و مرتب */
export function loadAttemptHistory(userId) {
  const mock = loadMockHistory(userId);
  let records = [
    ...mock.sessions.map((session) => ({ session, attempts: mock.attempts.filter((attempt) => attempt.sessionId === session.id) })),
  ];
  try {
    const live = fetchSubmittedSessions ? fetchSubmittedSessions(userId) : [];
    records = [...records, ...live.map(mapLiveSession)];
  } catch {
    /* اگر بانک واقعی در دسترس نبود، تحلیل روی تاریخچهٔ نمونه ادامه می‌یابد */
  }

  const sessions = records.map((record) => record.session).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const attempts = records
    .flatMap((record) => record.attempts)
    .map(enrichAttempt)
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
  return { sessions, attempts };
}

/* ────────────────────────── اعمال فیلتر ────────────────────────── */

/*
 * مرز بازه‌ها روی «شروع روز» بسته می‌شود نه روی ساعت جاری؛ وگرنه روز اولِ بازه
 * فقط بخشی از دادهٔ آن روز را می‌دید و با سری روزانهٔ نمودار روند ناهم‌تراز می‌شد.
 */
function applyFilters(attempts, filters) {
  const f = normalizeFilters(filters);
  const days = rangeDays(f.range);
  const cutoff = days ? startOfToday() - (days - 1) * 86400000 : null;
  return attempts.filter((attempt) => {
    if (cutoff && attempt.timestamp < cutoff) return false;
    if (f.mode !== 'all' && attempt.mode !== f.mode) return false;
    if (f.subjectIds.length && !f.subjectIds.includes(attempt.subject)) return false;
    if (f.topicPath) {
      const wanted = f.topicPath.split(' › ');
      const matches = wanted.every((part, index) => attempt.topicPath[index] === part);
      if (!matches) return false;
    }
    return true;
  });
}

/* بازهٔ قبلی هم‌طول — برای دلتای KPIها */
function previousPeriodAttempts(attempts, filters) {
  const f = normalizeFilters(filters);
  const days = rangeDays(f.range);
  const filterShape = (list) =>
    list.filter((attempt) => {
      if (f.mode !== 'all' && attempt.mode !== f.mode) return false;
      if (f.subjectIds.length && !f.subjectIds.includes(attempt.subject)) return false;
      if (f.topicPath) {
        const wanted = f.topicPath.split(' › ');
        if (!wanted.every((part, index) => attempt.topicPath[index] === part)) return false;
      }
      return true;
    });
  if (!days) {
    /* تمام زمان → نیمهٔ اول تاریخ، مقایسه با نیمهٔ دوم */
    const shape = filterShape(attempts);
    return shape.slice(0, Math.floor(shape.length / 2));
  }
  const currentCutoff = startOfToday() - (days - 1) * 86400000;
  const previousCutoff = currentCutoff - days * 86400000;
  return filterShape(attempts).filter((attempt) => attempt.timestamp < currentCutoff && attempt.timestamp >= previousCutoff);
}

const dayKeyOf = (ts) => {
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/* ────────────────────────── API: نمای کلی ────────────────────────── */

/*
 * KPIهای اصلی + دلتای هر کدام نسبت به دورهٔ قبلی هم‌طول + امتیاز عملکرد و ثبات
 * و مقایسهٔ تمرین/آزمون — دادهٔ بخش Overview صفحه.
 */
export function fetchAnalyticsOverview(userId, filters = {}) {
  return respond(() => {
    const { attempts: allAttempts, sessions } = loadAttemptHistory(userId);
    const filtered = applyFilters(allAttempts, filters);
    const previous = previousPeriodAttempts(allAttempts, filters);
    const model = buildAnalyticsModel(filtered);
    const comparison = comparePeriods(filtered, previous);

    return {
      filters: normalizeFilters(filters),
      dataStatus: classifyDataVolume(filtered.length),
      kpis: {
        totalAttempts: filtered.length,
        totalQuestions: new Set(filtered.map((attempt) => attempt.questionId)).size,
        accuracy: model.accuracy.accuracy,
        averageTime: model.time.average,
        correct: model.accuracy.correct,
        wrong: model.accuracy.wrong,
        unanswered: model.accuracy.unanswered,
        completedExams: sessions.filter((session) => session.mode === 'exam' && (filtered.some((attempt) => attempt.sessionId === session.id))).length,
      },
      comparison,
      performance: model.performance,
      consistency: model.consistency,
      practiceVsExam: model.practiceVsExam,
    };
  });
}

/* آستانه‌های حجم داده — Empty State هوشمند */
function classifyDataVolume(count) {
  if (count === 0) return { level: 'empty', hint: 'هنوز داده‌ای برای تحلیل وجود ندارد.' };
  if (count < 12) return { level: 'sparse', hint: 'برای تحلیل دقیق‌تر، تست‌های بیشتری حل کن؛ تحلیل‌های این صفحه هنوز اولیه‌اند.' };
  if (count < 40) return { level: 'partial', hint: 'داده در حال جمع‌شدن است؛ هرچه تست بیشتر بزنی، تشخیص‌ها دقیق‌تر می‌شوند.' };
  return { level: 'ok', hint: null };
}

/* ────────────────────────── API: روند عملکرد ────────────────────────── */

export function fetchPerformanceTrend(userId, filters = {}) {
  return respond(() => {
    const { attempts, sessions } = loadAttemptHistory(userId);
    const f = normalizeFilters(filters);
    const days = rangeDays(f.range) ?? HISTORY_DAYS;
    const filtered = applyFilters(attempts, filters);
    const series = buildDailySeries(filtered, { days });
    /* نقاط مهم: آزمون‌های داخل بازه — هم‌مرز با سری روزانه */
    const cutoff = startOfToday() - (days - 1) * 86400000;
    const examEvents = sessions
      .filter((session) => session.mode === 'exam' && (session.submittedAt ?? 0) >= cutoff)
      .map((session) => {
        const point = series.find((entry) => entry.key === dayKeyOf(session.submittedAt));
        return {
          id: session.id,
          title: session.title,
          submittedAt: session.submittedAt,
          dayIndex: point ? series.indexOf(point) : null,
          percentile: session.percentile,
        };
      })
      .filter((event) => event.dayIndex !== null);
    return { filters: f, series, examEvents, days };
  });
}

/* ────────────────────────── API: درس‌ها / مباحث / سؤالات ────────────────────────── */

export function fetchSubjectAnalytics(userId, filters = {}) {
  return respond(() => {
    const { attempts } = loadAttemptHistory(userId);
    const filtered = applyFilters(attempts, filters);
    const model = buildAnalyticsModel(filtered);
    return { filters: normalizeFilters(filters), subjects: model.subjects, weakness: model.weakness };
  });
}

export function fetchTopicAnalytics(userId, filters = {}, { subjectId = null } = {}) {
  return respond(() => {
    const { attempts } = loadAttemptHistory(userId);
    const effective = subjectId ? { ...filters, subjectIds: [subjectId] } : filters;
    const filtered = applyFilters(attempts, effective);
    const model = buildAnalyticsModel(filtered);
    return { filters: normalizeFilters(effective), subjectId, topics: model.topics, weakness: model.weakness };
  });
}

export function fetchQuestionAnalytics(userId, filters = {}) {
  return respond(() => {
    const { attempts } = loadAttemptHistory(userId);
    const filtered = applyFilters(attempts, filters);
    return { filters: normalizeFilters(filters), questions: aggregateByQuestion(filtered) };
  });
}

/* ────────────────────────── API: آزمون‌ها ────────────────────────── */

export function fetchExamAnalytics(userId) {
  return respond(() => {
    const { attempts, sessions } = loadAttemptHistory(userId);
    const examSessions = sessions.filter((session) => session.mode === 'exam');
    return { exams: aggregateExams(examSessions, attempts) };
  });
}

export function fetchExamDetail(userId, examId) {
  return respond(() => {
    const { attempts, sessions } = loadAttemptHistory(userId);
    const examSessions = sessions.filter((session) => session.mode === 'exam');
    const exams = aggregateExams(examSessions, attempts);
    const exam = exams.find((entry) => entry.examId === examId) ?? null;
    if (!exam) throw new Error('exam-not-found');
    const model = buildAnalyticsModel(exam.items);
    return { exam, difficulty: model.difficulty, errors: model.errors, time: model.time, questions: aggregateByQuestion(exam.items) };
  });
}

/* ────────────────────────── API: رفتار (خطا/زمان/اطمینان/بی‌پاسخ/دشواری) ────────────────────────── */

export function fetchBehaviorAnalytics(userId, filters = {}) {
  return respond(() => {
    const { attempts } = loadAttemptHistory(userId);
    const filtered = applyFilters(attempts, filters);
    const model = buildAnalyticsModel(filtered);
    return {
      filters: normalizeFilters(filters),
      errors: model.errors,
      time: model.time,
      difficulty: model.difficulty,
      confidence: model.confidence,
      unanswered: model.unanswered,
      patterns: model.patterns,
      questionPool: QUESTIONS.length,
    };
  });
}

/* ────────────────────────── API: تشخیص و پیشنهاد ────────────────────────── */

export function fetchDiagnosis(userId, filters = {}) {
  return respond(() => {
    const { attempts } = loadAttemptHistory(userId);
    const filtered = applyFilters(attempts, filters);
    const model = buildAnalyticsModel(filtered);
    return {
      filters: normalizeFilters(filters),
      dataStatus: classifyDataVolume(filtered.length),
      insights: model.insights,
      patterns: model.patterns,
      diagnosis: model.diagnosis,
      recommendations: model.recommendations,
      performance: model.performance,
      recency: model.recency,
    };
  });
}

/* ────────────────────────── API: باندل کامل صفحهٔ اصلی ────────────────────────── */

/*
 * صفحهٔ اصلی همهٔ بخش‌ها را یک‌جا می‌خواهد؛ در Backend واقعی این endpoint
 * به‌صورت aggregated سمت سرور محاسبه می‌شود. اینجا همان توابع بالا را
 * بدون تأخیر اضافه دوباره صدا می‌زند.
 */
export function fetchAnalyticsBundle(userId, filters = {}) {
  return respond(() => {
    const { attempts, sessions } = loadAttemptHistory(userId);
    const filtered = applyFilters(attempts, filters);
    const previous = previousPeriodAttempts(attempts, filters);
    const model = buildAnalyticsModel(filtered);
    const f = normalizeFilters(filters);
    const days = rangeDays(f.range) ?? HISTORY_DAYS;
    const cutoff = startOfToday() - (days - 1) * 86400000;

    const examSessions = sessions.filter((session) => session.mode === 'exam');
    return {
      filters: f,
      dataStatus: classifyDataVolume(filtered.length),
      kpis: {
        totalAttempts: filtered.length,
        totalQuestions: new Set(filtered.map((attempt) => attempt.questionId)).size,
        accuracy: model.accuracy.accuracy,
        averageTime: model.time.average,
        correct: model.accuracy.correct,
        wrong: model.accuracy.wrong,
        unanswered: model.accuracy.unanswered,
        completedExams: examSessions.filter((session) => filtered.some((attempt) => attempt.sessionId === session.id)).length,
      },
      comparison: comparePeriods(filtered, previous),
      performance: model.performance,
      consistency: model.consistency,
      practiceVsExam: model.practiceVsExam,
      trend: {
        series: buildDailySeries(filtered, { days }),
        examEvents: examSessions
          .filter((session) => (session.submittedAt ?? 0) >= cutoff)
          .map((session) => ({ id: session.id, title: session.title, submittedAt: session.submittedAt, dayKey: dayKeyOf(session.submittedAt) })),
      },
      subjects: model.subjects,
      topics: model.topics,
      weakness: model.weakness,
      errors: model.errors,
      time: model.time,
      difficulty: model.difficulty,
      confidence: model.confidence,
      unanswered: model.unanswered,
      patterns: model.patterns,
      insights: model.insights,
      diagnosis: model.diagnosis,
      recommendations: model.recommendations,
      exams: aggregateExams(examSessions, filtered).filter((exam) => exam.total > 0).slice(0, 6),
      recency: model.recency,
    };
  });
}

/* ────────────────────────── API: خلاصهٔ هفتگی (کارت داشبورد) ────────────────────────── */

export function fetchWeeklySummary(userId) {
  return respond(() => {
    const { attempts } = loadAttemptHistory(userId);
    const weekAgo = Date.now() - 7 * 86400000;
    const monthAgo = Date.now() - 30 * 86400000;
    const week = attempts.filter((attempt) => attempt.timestamp >= weekAgo);
    const model = buildAnalyticsModel(week);
    const previousWeek = attempts.filter((attempt) => attempt.timestamp >= weekAgo - 7 * 86400000 && attempt.timestamp < weekAgo);
    const previousAnswered = previousWeek.filter((a) => a.correct !== null);
    const previousAccuracy = previousAnswered.length
      ? (previousWeek.filter((a) => a.correct === true).length / previousAnswered.length) * 100
      : null;
    /* هفتهٔ کوتاه برای نقشهٔ ضعف کافی نیست؛ پیشنهاد از پنجرهٔ ۳۰ روزه می‌آید */
    const monthModel = buildAnalyticsModel(attempts.filter((attempt) => attempt.timestamp >= monthAgo));
    const worst = monthModel.weakness.critical[0] ?? monthModel.weakness.review[0] ?? null;
    return {
      attemptCount: week.length,
      accuracy: model.accuracy.accuracy,
      accuracyDelta:
        previousAccuracy !== null && model.accuracy.accuracy !== null ? Math.round((model.accuracy.accuracy - previousAccuracy) * 10) / 10 : null,
      reviewCount: monthModel.weakness.critical.length + monthModel.weakness.review.length,
      suggestion: worst
        ? { topic: worst.key, subjectId: worst.subjectId, count: Math.min(15, Math.max(8, Math.round(worst.attemptCount / 3))) }
        : null,
    };
  });
}
