/*
 * سرویس «آزمون‌های بین‌الملل» — قرارداد API به شکل واقعی طراحی شده؛ پیاده‌سازی فعلی
 * Mock است و وضعیت کاربر در localStorage (کلید tapesh:intl:v1:<userId>) ذخیره می‌شود.
 * با اتصال Backend کافی است بدنهٔ هر تابع به fetch تبدیل شود؛ امضای خروجی عوض نمی‌شود.
 *
 * قراردادهای آینده (مطابق سند معماری داده):
 *   GET  /api/intl/exams                          → fetchExams()
 *   GET  /api/intl/exams/:id                      → fetchExam(id)
 *   GET  /api/intl/questions?exam=&section=&...   → fetchQuestions(filter)
 *   GET  /api/intl/overview                       → fetchOverview()      (UserPerformance)
 *   GET  /api/intl/mistakes                       → fetchMistakes()
 *   GET  /api/intl/review/due                     → fetchDueReview()     (ReviewItem)
 *   POST /api/intl/bookmarks/:qid | DELETE        → toggleBookmark()
 *   POST /api/intl/collections | DELETE /:id      → createCollection()/deleteCollection()
 *   POST /api/intl/collections/:id/questions      → addToCollection()
 *   POST /api/intl/attempts                       → startAttempt()       (ExamAttempt)
 *   POST /api/intl/attempts/:id/answers           → recordAnswer()       (AttemptQuestion)
 *   POST /api/intl/attempts/:id/submit            → submitAttempt()
 *   GET  /api/intl/teach-me/:qid                  → requestTeachMe()     (AIExplanationRequest)
 *
 * اصل امنیتی: در بک‌اند واقعی correctAnswer و optionExplanations نباید در Payload اولیهٔ
 * سؤال برگردند؛ اعتبارسنجی پاسخ سمت سرور انجام می‌شود. این Mock تمام محتوا را در کلاینت
 * دارد اما مقایسهٔ پاسخ فقط از طریق recordAnswer انجام می‌شود تا در جایگزینی با API،
 * هیچ UIای به ساختار ناامن وابسته نشود.
 */

import { EXAMS, QUESTIONS, SUBJECTS } from './mockData';

const STATE_KEY_PREFIX = 'tapesh:intl:v1:';
const LATENCY_MS = 420;

/* فاصلهٔ مرور فاصله‌دار (روز) — الگوریتم در آینده قابل تعویض است و UI به آن وابسته نیست */
const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const respond = async (build) => {
  await delay(LATENCY_MS + Math.random() * 220);
  return build();
};

/* ────────────────────────── وضعیت کاربر (USER STATE) ────────────────────────── */

const EMPTY_STATE = {
  bookmarks: [],
  collections: [],
  notes: {},
  questionStates: {},
  attempts: [],
};

function stateKey(userId) {
  return `${STATE_KEY_PREFIX}${userId ?? 'guest'}`;
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
  window.localStorage.setItem(stateKey(userId), JSON.stringify(state));
  return state;
}

function mutateState(userId, mutator) {
  const state = loadState(userId);
  mutator(state);
  saveState(userId, state);
  return state;
}

const getQuestion = (questionId) => QUESTIONS.find((item) => item.id === questionId) ?? null;
const getExam = (examId) => EXAMS.find((item) => item.id === examId) ?? null;
const getSubject = (subjectId) => SUBJECTS.find((item) => item.id === subjectId) ?? null;

const questionStateOf = (state, questionId) =>
  state.questionStates[questionId] ?? {
    questionId,
    attempts: 0,
    correctCount: 0,
    incorrectCount: 0,
    lastAnswer: null,
    lastResult: null,
    lastAttemptedAt: null,
    nextReviewAt: null,
    reviewStage: 0,
  };

/* ────────────────────────── محتوا (CONTENT) ────────────────────────── */

/* GET /api/intl/exams */
export function fetchExams() {
  return respond(() =>
    EXAMS.map((exam) => {
      const questions = QUESTIONS.filter((item) => item.examId === exam.id);
      return {
        ...exam,
        questionCount: questions.length,
        topics: [...new Set(questions.map((item) => item.topic.fa))].slice(0, 4),
        sectionCounts: exam.sections.map((section) => ({
          ...section,
          questionCount: questions.filter((item) => item.sectionId === section.id).length,
        })),
      };
    }),
  );
}

/* GET /api/intl/exams/:id */
export function fetchExam(examId) {
  return respond(() => {
    const exam = getExam(examId);
    if (!exam) throw new Error('exam-not-found');
    const questions = QUESTIONS.filter((item) => item.examId === examId);
    return {
      ...exam,
      questionCount: questions.length,
      topics: [...new Set(questions.map((item) => item.topic.fa))],
      sectionCounts: exam.sections.map((section) => ({
        ...section,
        questionCount: questions.filter((item) => item.sectionId === section.id).length,
      })),
    };
  });
}

/* GET /api/intl/questions — filter: examId, sectionId, difficulty, subjectId, ids */
export function fetchQuestions(filter = {}) {
  return respond(() =>
    QUESTIONS.filter((question) => {
      if (filter.examId && question.examId !== filter.examId) return false;
      if (filter.sectionId && question.sectionId !== filter.sectionId) return false;
      if (filter.subjectId && question.subjectId !== filter.subjectId) return false;
      if (filter.difficulty && question.difficulty !== filter.difficulty) return false;
      if (filter.ids && !filter.ids.includes(question.id)) return false;
      return true;
    }).map((question, index) => ({ ...question, bankOrder: index + 1 })),
  );
}

/* ────────────────────────── نمای کلی (OVERVIEW / PERFORMANCE) ────────────────────────── */

function computeStats(state) {
  const states = Object.values(state.questionStates);
  const answered = states.filter((item) => item.attempts > 0);
  const totalAnswers = answered.reduce((sum, item) => sum + item.correctCount + item.incorrectCount, 0);
  const correctAnswers = answered.reduce((sum, item) => sum + item.correctCount, 0);
  const now = Date.now();
  const dueQuestions = states.filter(
    (item) => item.nextReviewAt && item.nextReviewAt <= now && item.lastResult !== 'correct-locked',
  );
  const weakSubjectMap = new Map();
  for (const item of answered) {
    const question = getQuestion(item.questionId);
    if (!question || item.incorrectCount === 0) continue;
    const entry = weakSubjectMap.get(question.subjectId) ?? { subjectId: question.subjectId, count: 0 };
    entry.count += item.incorrectCount;
    weakSubjectMap.set(question.subjectId, entry);
  }
  const weakTopics = [...weakSubjectMap.values()]
    .map((entry) => ({
      ...entry,
      subject: getSubject(entry.subjectId),
      questionIds: answered
        .filter((item) => {
          const question = getQuestion(item.questionId);
          return question?.subjectId === entry.subjectId && item.incorrectCount > 0;
        })
        .map((item) => item.questionId),
    }))
    .sort((a, b) => b.count - a.count);

  const mistakeQuestions = answered
    .filter((item) => item.incorrectCount > 0)
    .sort((a, b) => b.incorrectCount - a.incorrectCount || b.lastAttemptedAt - a.lastAttemptedAt)
    .map((item) => ({
      question: getQuestion(item.questionId),
      state: item,
      repeated: item.incorrectCount > 1,
    }))
    .filter((entry) => entry.question);

  return {
    solvedQuestions: answered.length,
    totalAnswers,
    correctAnswers,
    accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
    bookmarked: state.bookmarks.length,
    collections: state.collections.length,
    dueReview: dueQuestions.length,
    dueQuestionIds: dueQuestions.map((item) => item.questionId),
    mistakes: mistakeQuestions,
    weakTopics,
    mistakesCount: mistakeQuestions.length,
  };
}

function computeAchievements(state, stats) {
  const bestStreak = state.attempts.reduce((max, attempt) => Math.max(max, attempt.bestStreak ?? 0), 0);
  const usmleAnswers = Object.values(state.questionStates).reduce((sum, item) => {
    const question = getQuestion(item.questionId);
    return question?.examId === 'usmle' ? sum + item.correctCount + item.incorrectCount : sum;
  }, 0);
  const recovered = Object.values(state.questionStates).filter(
    (item) => item.incorrectCount > 0 && item.lastResult === 'correct',
  ).length;

  return [
    { id: 'first-10', title: '۱۰ سؤال اول', description: 'اولین ۱۰ سؤال بین‌المللی‌ات را حل کن', icon: 'target', value: stats.totalAnswers, goal: 10 },
    { id: 'perfect-10', title: 'ده متوالی صحیح', description: '۱۰ پاسخ صحیح پشت سر هم در یک آزمون', icon: 'flame', value: bestStreak, goal: 10 },
    { id: 'usmle-explorer', title: 'کاوشگر USMLE', description: '۵۰ پاسخ در سؤال‌های USMLE', icon: 'compass', value: usmleAnswers, goal: 50 },
    { id: 'error-hunter', title: 'شکارچی اشتباه', description: '۵۰ اشتباه قبلی را دوباره درست جواب بده', icon: 'shield', value: recovered, goal: 50 },
  ].map((item) => ({ ...item, unlocked: item.value >= item.goal }));
}

/* GET /api/intl/overview */
export function fetchOverview(userId) {
  return respond(() => {
    const state = loadState(userId);
    const stats = computeStats(state);
    const inProgress = state.attempts
      .filter((attempt) => attempt.status === 'in_progress')
      .sort((a, b) => b.startedAt - a.startedAt)[0];

    return {
      stats,
      achievements: computeAchievements(state, stats),
      /* وضعیت هر سؤال برای نمایش در بانک سؤال (صحیح/غلط/جدید + گلچین) */
      states: Object.fromEntries(
        Object.entries(state.questionStates).map(([questionId, questionState]) => [
          questionId,
          {
            lastResult: questionState.lastResult,
            attempts: questionState.attempts,
            bookmarked: state.bookmarks.includes(questionId),
          },
        ]),
      ),
      inProgress: inProgress
        ? {
            id: inProgress.id,
            title: inProgress.title,
            answeredCount: Object.keys(inProgress.answers ?? {}).length,
            totalQuestions: inProgress.questionIds.length,
            percent: Math.round((Object.keys(inProgress.answers ?? {}).length / inProgress.questionIds.length) * 100),
          }
        : null,
      examProgress: EXAMS.map((exam) => {
        const examQuestions = QUESTIONS.filter((item) => item.examId === exam.id);
        const touched = examQuestions.filter((item) => state.questionStates[item.id]?.attempts > 0).length;
        return {
          examId: exam.id,
          shortName: exam.shortName,
          accent: exam.accent,
          solved: touched,
          total: examQuestions.length,
          percent: examQuestions.length ? Math.round((touched / examQuestions.length) * 100) : 0,
        };
      }),
    };
  });
}

/* GET /api/intl/collections */
export function fetchCollections(userId) {
  return respond(() => {
    const state = loadState(userId);
    return state.collections.map((collection) => ({
      ...collection,
      questions: collection.questionIds.map(getQuestion).filter(Boolean),
    }));
  });
}

export function fetchBookmarkedQuestions(userId) {
  return respond(() => {
    const state = loadState(userId);
    return state.bookmarks.map(getQuestion).filter(Boolean);
  });
}

/* GET /api/intl/mistakes */
export function fetchMistakes(userId) {
  return respond(() => {
    const state = loadState(userId);
    const stats = computeStats(state);
    return { items: stats.mistakes, weakTopics: stats.weakTopics };
  });
}

/* GET /api/intl/review/due */
export function fetchDueReview(userId) {
  return respond(() => {
    const state = loadState(userId);
    const stats = computeStats(state);
    return stats.dueQuestionIds.map(getQuestion).filter(Boolean);
  });
}

/* GET /api/intl/attempts/:id */
export function fetchAttempt(userId, attemptId) {
  return respond(() => {
    const state = loadState(userId);
    const attempt = state.attempts.find((item) => item.id === attemptId);
    if (!attempt) throw new Error('attempt-not-found');
    return attempt;
  });
}

/* ────────────────────────── عملیات وضعیت کاربر ────────────────────────── */

/* POST/DELETE /api/intl/bookmarks/:qid — «گلچین» */
export function toggleBookmark(userId, questionId) {
  const state = mutateState(userId, (draft) => {
    const index = draft.bookmarks.indexOf(questionId);
    if (index === -1) draft.bookmarks.push(questionId);
    else draft.bookmarks.splice(index, 1);
  });
  trackEvent(state.bookmarks.includes(questionId) ? 'question_bookmarked' : 'question_unbookmarked', { questionId });
  return respond(() => state.bookmarks.includes(questionId));
}

/* POST /api/intl/collections */
export function createCollection(userId, { name, description = '' }) {
  const collection = {
    id: `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    description: description.trim(),
    questionIds: [],
    createdAt: Date.now(),
  };
  mutateState(userId, (draft) => {
    draft.collections.push(collection);
  });
  trackEvent('collection_created', { collectionId: collection.id });
  return respond(() => collection);
}

/* DELETE /api/intl/collections/:id */
export function deleteCollection(userId, collectionId) {
  return respond(() => {
    mutateState(userId, (draft) => {
      draft.collections = draft.collections.filter((item) => item.id !== collectionId);
    });
    return true;
  });
}

/* POST /api/intl/collections/:id/questions */
export function addToCollection(userId, collectionId, questionId, note = '') {
  return respond(() => {
    mutateState(userId, (draft) => {
      const collection = draft.collections.find((item) => item.id === collectionId);
      if (!collection) return;
      if (!collection.questionIds.includes(questionId)) collection.questionIds.push(questionId);
      if (note.trim()) draft.notes[questionId] = { content: note.trim(), updatedAt: Date.now() };
    });
    trackEvent('question_added_to_collection', { collectionId, questionId });
    return true;
  });
}

/* DELETE /api/intl/collections/:id/questions/:qid */
export function removeFromCollection(userId, collectionId, questionId) {
  return respond(() => {
    mutateState(userId, (draft) => {
      const collection = draft.collections.find((item) => item.id === collectionId);
      if (collection) collection.questionIds = collection.questionIds.filter((id) => id !== questionId);
    });
    return true;
  });
}

/* ────────────────────────── Attempt (ASSESSMENT) ────────────────────────── */

function shuffleArray(items, shouldShuffle) {
  if (!shouldShuffle) return [...items];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/*
 * POST /api/intl/attempts
 * config: { title, source, mode, questionIds, durationMinutes, shuffleQuestions }
 * Attempt مستقل و Immutable-after-submit است (اصل ۴۰ سند معماری).
 */
export function startAttempt(userId, config) {
  return respond(() => {
    const questionIds = shuffleArray(config.questionIds, config.shuffleQuestions).slice(
      0,
      config.questionCount ?? config.questionIds.length,
    );
    if (questionIds.length === 0) throw new Error('no-questions');

    const attempt = {
      id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      userId: userId ?? 'guest',
      title: config.title,
      source: config.source, // exam | collection | bookmarks | mistakes | review | custom
      mode: config.mode ?? 'practice',
      questionIds,
      answers: {},
      currentIndex: 0,
      startedAt: Date.now(),
      submittedAt: null,
      status: 'in_progress',
      durationMinutes: config.durationMinutes ?? null,
      bestStreak: 0,
    };

    mutateState(userId, (draft) => {
      /* فقط یک Attempt در جریان برای هر منبع: Attemptهای قبلی حل‌نشده رها شده در نظر گرفته می‌شوند */
      draft.attempts.push(attempt);
    });
    trackEvent('exam_started', { attemptId: attempt.id, source: attempt.source });
    return attempt;
  });
}

/* PUT /api/intl/attempts/:id — ذخیرهٔ پیشرفت برای Resume */
export function saveAttemptProgress(userId, attempt) {
  mutateState(userId, (draft) => {
    const index = draft.attempts.findIndex((item) => item.id === attempt.id);
    if (index !== -1) draft.attempts[index] = { ...attempt };
  });
}

/*
 * POST /api/intl/attempts/:id/answers
 * هر پاسخ، AttemptQuestion همان لحظهٔ Attempt را می‌سازد و UserQuestionState را
 * جداگانه به‌روز می‌کند (جدایی Attempt از State).
 */
export function recordAnswer(userId, attempt, question, selectedAnswer, timeSpentMs) {
  const isCorrect = selectedAnswer === question.correctAnswer;

  mutateState(userId, (draft) => {
    const stored = draft.attempts.find((item) => item.id === attempt.id);
    if (stored) {
      stored.answers = {
        ...stored.answers,
        [question.id]: {
          selectedAnswer,
          isCorrect,
          timeSpent: Math.round(timeSpentMs / 1000),
          answeredAt: Date.now(),
        },
      };
      const answers = Object.values(stored.answers);
      let streak = 0;
      for (const answer of answers) {
        streak = answer.isCorrect ? streak + 1 : 0;
      }
      stored.bestStreak = Math.max(stored.bestStreak ?? 0, streak);
    }

    const questionState = questionStateOf(draft, question.id);
    questionState.attempts += 1;
    questionState.lastAnswer = selectedAnswer;
    questionState.lastResult = isCorrect ? 'correct' : 'incorrect';
    questionState.lastAttemptedAt = Date.now();
    if (isCorrect) questionState.correctCount += 1;
    else questionState.incorrectCount += 1;

    /* فاصلهٔ مرور فاصله‌دار: صحیح مرحله بعد، غلط بازگشت به مرحلهٔ اول */
    const stage = isCorrect ? Math.min(questionState.reviewStage + 1, REVIEW_INTERVALS.length - 1) : 0;
    questionState.reviewStage = stage;
    questionState.nextReviewAt = Date.now() + REVIEW_INTERVALS[stage] * 86400000;
    draft.questionStates[question.id] = questionState;
  });

  trackEvent(isCorrect ? 'answer_submitted' : 'answer_submitted', { questionId: question.id, isCorrect });
  return respond(() => isCorrect);
}

/* POST /api/intl/attempts/:id/submit → نتیجهٔ کامل Attempt */
export function submitAttempt(userId, attemptId) {
  return respond(() => {
    const state = loadState(userId);
    const attempt = state.attempts.find((item) => item.id === attemptId);
    if (!attempt) throw new Error('attempt-not-found');

    const answeredEntries = Object.entries(attempt.answers ?? {});
    const correct = answeredEntries.filter(([, answer]) => answer.isCorrect).length;
    const incorrect = answeredEntries.length - correct;
    const skipped = attempt.questionIds.length - answeredEntries.length;
    const totalTime = answeredEntries.reduce((sum, [, answer]) => sum + (answer.timeSpent ?? 0), 0);
    const totalAnswered = answeredEntries.length;

    /* تحلیل موضوعی از روی Attempt خود کاربر، نه از Question (اصل Snapshot) */
    const topicMap = new Map();
    for (const [questionId, answer] of answeredEntries) {
      const question = getQuestion(questionId);
      if (!question) continue;
      const entry = topicMap.get(question.subjectId) ?? { subjectId: question.subjectId, correct: 0, total: 0 };
      entry.total += 1;
      if (answer.isCorrect) entry.correct += 1;
      topicMap.set(question.subjectId, entry);
    }
    const topics = [...topicMap.values()]
      .map((entry) => ({
        ...entry,
        subject: getSubject(entry.subjectId),
        accuracy: Math.round((entry.correct / entry.total) * 100),
      }))
      .sort((a, b) => b.accuracy - a.accuracy);

    const submitted = {
      ...attempt,
      status: 'completed',
      submittedAt: Date.now(),
      result: {
        totalQuestions: attempt.questionIds.length,
        answered: totalAnswered,
        correct,
        incorrect,
        skipped,
        percentage: totalAnswered ? Math.round((correct / totalAnswered) * 100) : 0,
        totalTime,
        topics,
      },
    };

    mutateState(userId, (draft) => {
      const index = draft.attempts.findIndex((item) => item.id === attemptId);
      if (index !== -1) draft.attempts[index] = submitted;
    });
    trackEvent('exam_completed', { attemptId, percentage: submitted.result.percentage });
    return submitted;
  });
}

/* ────────────────────────── آزمون‌ساز (CUSTOM EXAM) ────────────────────────── */

/*
 * POST /api/intl/custom-exams/preview — تخمین مخزن سؤال برای Builder.
 * sources: { collectionIds: [], useBookmarks, useMistakes, examIds: [], difficulties: [] }
 */
export function fetchQuestionPool(userId, sources, { difficulties = [], examId = null } = {}) {
  const state = loadState(userId);
  const ids = new Set();

  for (const collectionId of sources.collectionIds ?? []) {
    const collection = state.collections.find((item) => item.id === collectionId);
    collection?.questionIds.forEach((id) => ids.add(id));
  }
  if (sources.useBookmarks) state.bookmarks.forEach((id) => ids.add(id));
  if (sources.useMistakes) {
    for (const [questionId, questionState] of Object.entries(state.questionStates)) {
      if (questionState.incorrectCount > 0) ids.add(questionId);
    }
  }
  for (const sourceExamId of sources.examIds ?? []) {
    QUESTIONS.filter((question) => question.examId === sourceExamId).forEach((question) => ids.add(question.id));
  }

  let pool = [...ids].map(getQuestion).filter(Boolean);
  if (examId) pool = pool.filter((question) => question.examId === examId);
  if (difficulties.length > 0) pool = pool.filter((question) => difficulties.includes(question.difficulty));
  return pool;
}

/* ────────────────────────── «این سؤال را یادم بده» (لایهٔ AI-ready) ────────────────────────── */

/*
 * GET /api/intl/teach-me/:qid — Mini Lesson.
 * الان درس از فیلدهای ساختاریافتهٔ خود سؤال ساخته می‌شود؛ در آینده همین امضا به
 * AIExplanationRequest (requestType: 'teach') وصل می‌شود و خروجی AI همین قالب را پر می‌کند.
 * AI هرگز جایگزین Explanation رسمی نمی‌شود — فقط لایهٔ آموزشی اضافه است.
 */
export function requestTeachMe(question) {
  return respond(() => ({
    coreConcept: question.keyLearningPoints?.[0] ?? question.explanation.fa,
    whatToLearn: `از این سؤال باید بدانی که «${question.topic.fa}» در ${getSubject(question.subjectId)?.nameFa ?? 'این مبحث'} چطور به نتیجهٔ بالینی ترجمه می‌شود.`,
    commonMistake: question.commonMistake ?? 'شتاب در انتخاب گزینه بدون رد کردن افتراق‌های خطرناک.',
    examRelevance: question.examTip ?? 'این الگو در آزمون‌های بین‌المللی پرتکرار است.',
    topic: question.topic,
  }));
}

/* ────────────────────────── Analytics stub ────────────────────────── */
/* POST /api/intl/events — رویدادهای سند معماری بخش ۴۱ */
export function trackEvent(name, payload = {}) {
  if (typeof console !== 'undefined' && console.debug) {
    console.debug(`[intl:track] ${name}`, payload);
  }
}
