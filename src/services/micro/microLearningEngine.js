/*
 * موتور یادگیری میکرودرسنامه — حالت مفهوم‌ها، پیشرفت واقعی و چرخهٔ مرور.
 *
 * این فایل توابع خالص (بدون React و بدون I/O) است؛ ورودی‌ها دادهٔ درس + وضعیت
 * ذخیره‌شدهٔ کاربر است و خروجی‌ها state مشتق‌شده. سرویس پیشرفت (microProgressService)
 * این توابع را برای نمایش و تصمیم‌گیری مصرف می‌کند.
 *
 * ── Learning State مفهوم‌ها ──
 *   UNSEEN        هنوز در هیچ صفحه‌ای دیده نشده
 *   SEEN          خوانده شده ولی هنوز تستی از آن پاسخ نشده
 *   LEARNING      تست دارد ولی عملکرد هنوز تثبیت نشده
 *   PRACTICING    عملکرد پایدار (دقت ≥ ۶۰٪) ولی هنوز مسلط نیست
 *   MASTERED      چند بار موفق و با فاصلهٔ زمانی (روزهای متفاوت)
 *   NEEDS_REVIEW  چند خطای متوالی یا دقت پایین — اولویت مرور
 *
 * ── پیشرفت ترکیبی ──
 *   Content Progress  (صفحه‌های تکمیل‌شده)
 * + Assessment Progress (سؤال‌های checkpoint که حداقل یک‌بار درست پاسخ شده‌اند)
 * + Mastery Progress  (میانگین وضعیت مفهوم‌ها + اعتماد کاربر)
 * = Mastery Score واحد
 */

export const LEARNING_STATES = {
  UNSEEN: { label: 'شروع‌نشده', accent: 'var(--ghost)' },
  SEEN: { label: 'خوانده‌شده', accent: 'var(--blue-bright)' },
  LEARNING: { label: 'در حال یادگیری', accent: 'var(--gold)' },
  PRACTICING: { label: 'در حال تمرین', accent: 'var(--purple-bright)' },
  MASTERED: { label: 'مسلط', accent: 'var(--green-bright)' },
  NEEDS_REVIEW: { label: 'نیاز به مرور', accent: 'var(--red)' },
};

/* امتیاز تسلط هر حالت — پایهٔ Mastery Progress */
const STATE_MASTERY = {
  UNSEEN: 0,
  SEEN: 35,
  LEARNING: 52,
  PRACTICING: 72,
  MASTERED: 94,
  NEEDS_REVIEW: 28,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ────────────────────────── آمار سؤال‌های هر مفهوم ────────────────────────── */

/* سؤال‌های پاسخ‌شدهٔ مرتبط با هر مفهوم — از answers وضعیت واحد */
function conceptMetricsOf(concept, answers, questionConceptMap) {
  const metrics = { attempts: 0, correct: 0, wrong: 0, lastCorrect: null, lastAnsweredAt: 0, correctDays: new Set() };
  for (const questionId of questionConceptMap.get(concept) ?? []) {
    const answer = answers[questionId];
    if (!answer) continue;
    metrics.attempts += answer.attempts ?? 1;
    metrics.correct += answer.correct ?? 0;
    metrics.wrong += answer.wrong ?? 0;
    metrics.lastCorrect = answer.lastCorrect;
    if (answer.lastAnsweredAt > metrics.lastAnsweredAt) metrics.lastAnsweredAt = answer.lastAnsweredAt;
    if (answer.correctAts) {
      for (const at of answer.correctAts) metrics.correctDays.add(new Date(at).toDateString());
    }
  }
  return metrics;
}

/* نگاشت سؤال → مفهوم‌ها: از خود رکورد بانک (conceptIds) یا نگاشت صفحه‌ها */
function buildQuestionConceptMap(unit, pageConcepts, poolQuestions) {
  const map = new Map();
  for (const question of poolQuestions) {
    const ids = question.conceptIds?.length
      ? question.conceptIds
      : [...pageConcepts.entries()]
          .filter(([pageId]) => unit.pages.some((page) => page.id === pageId))
          .map(([, conceptIds]) => conceptIds)
          .flat();
    map.set(question.id, [...new Set(ids)]);
  }
  return map;
}

/* ────────────────────────── حالت مفهوم‌ها ────────────────────────── */

/*
 * حالت یادگیری هر مفهوم + امتیاز تسلط آن.
 * questionConceptMap را بیرون می‌سازیم تا در هر رندر دوباره ساخته نشود.
 */
export function computeConceptStates(unit, progress, pageConcepts, poolQuestions) {
  const unitState = progress.units?.[unit.id] ?? {};
  const answers = unitState.answers ?? {};
  const pagesRead = new Set(
    Object.entries(unitState.pages ?? {})
      .filter(([, state]) => state?.status === 'completed')
      .map(([pageId]) => pageId),
  );
  const now = Date.now();
  const questionConceptMap = buildQuestionConceptMap(unit, pageConcepts, poolQuestions);

  return unit.concepts.map((concept) => {
    const metrics = conceptMetricsOf(concept.id, answers, questionConceptMap);
    const relatedPageIds = pageConcepts.get(concept.id) ?? [];
    const readCount = relatedPageIds.filter((pageId) => pagesRead.has(pageId)).length;
    const accuracy = metrics.attempts ? Math.round((metrics.correct / metrics.attempts) * 100) : 0;

    let state = 'UNSEEN';
    if (metrics.attempts > 0) {
      const consecutiveWrong = (metrics.lastCorrect === false) && (metrics.wrong >= 2);
      if (consecutiveWrong || (metrics.attempts >= 2 && accuracy < 40)) state = 'NEEDS_REVIEW';
      else if (metrics.correct >= 3 && metrics.correctDays.size >= 2) state = 'MASTERED';
      else if (metrics.correct >= 2 && accuracy >= 60) state = 'PRACTICING';
      else state = 'LEARNING';
    } else if (readCount > 0) {
      state = 'SEEN';
    }

    const recentMistake = metrics.lastCorrect === false && (now - metrics.lastAnsweredAt) < 7 * DAY_MS;

    return {
      id: concept.id,
      title: concept.title,
      importance: concept.importance ?? 3,
      examFrequency: concept.examFrequency ?? 'medium',
      relatedPageIds,
      crossCourse: concept.crossCourse ?? [],
      attempts: metrics.attempts,
      correct: metrics.correct,
      wrong: metrics.wrong,
      accuracy,
      state,
      mastery: STATE_MASTERY[state],
      /* مفهوم «اولویت مرور»: خطای اخیر + اهمیت بالا — پایهٔ پیشنهادهای چرخهٔ مرور */
      needsReview: state === 'NEEDS_REVIEW' || (recentMistake && state !== 'MASTERED'),
    };
  });
}

/* صفحه‌های مرور پیشنهادی: مفهوم‌های نیاز به مرور → صفحهٔ مرتبط (اولین صفحهٔ خوانده‌شده) */
export function reviewTargets(conceptStates) {
  return conceptStates
    .filter((concept) => concept.needsReview)
    .map((concept) => ({
      conceptId: concept.id,
      title: concept.title,
      pageId: concept.relatedPageIds[0] ?? null,
      accuracy: concept.accuracy,
      attempts: concept.attempts,
    }));
}

/* ────────────────────────── پیشرفت ترکیبی ────────────────────────── */

/*
 * پیشرفت واقعی یک واحد — هر سه مؤلفه از دادهٔ واقعی کاربر.
 * خروجی: { content, assessment, mastery, overall, totals }
 */
export function computeUnitProgress(unit, progress, pageConcepts, poolQuestions) {
  const unitState = progress.units?.[unit.id] ?? {};
  const pages = unitState.pages ?? {};
  const total = unit.pages.length;
  const completed = unit.pages.filter((page) => pages[page.id]?.status === 'completed').length;
  const content = total ? Math.round((completed / total) * 100) : 0;

  /* assessment: سؤال‌های checkpoint که حداقل یک‌بار درست پاسخ شده‌اند */
  const conceptStates = computeConceptStates(unit, progress, pageConcepts, poolQuestions);
  const checkpointQuestionIds = new Set();
  for (const checkpointState of Object.values(unitState.checkpoints ?? {})) {
    for (const attempt of checkpointState.attempts ?? []) checkpointQuestionIds.add(attempt.questionId);
  }

  const assessmentAnswers = unitState.answers ?? {};
  let checkpointCorrect = 0;
  checkpointQuestionIds.forEach((questionId) => {
    if ((assessmentAnswers[questionId]?.correct ?? 0) > 0) checkpointCorrect += 1;
  });
  const assessment = checkpointQuestionIds.size
    ? Math.round((checkpointCorrect / checkpointQuestionIds.size) * 100)
    : 0;

  /* mastery: میانگین امتیاز مفهوم‌ها + تأثیر اعتماد کاربر در صفحه‌های مهم */
  const masteryBase = conceptStates.length
    ? Math.round(conceptStates.reduce((sum, concept) => sum + concept.mastery, 0) / conceptStates.length)
    : 0;
  const confidenceValues = unit.pages
    .map((page) => pages[page.id]?.confidence)
    .filter(Boolean);
  const confidence = confidenceValues.length
    ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) * 20
    : null;
  const mastery = clamp(Math.round(masteryBase * 0.85 + (confidence ?? masteryBase) * 0.15), 0, 100);

  const overall = clamp(Math.round(content * 0.3 + assessment * 0.4 + mastery * 0.3), 0, 100);

  return {
    content,
    assessment,
    mastery,
    overall,
    completed,
    total,
    checkpointCorrect,
    checkpointTotal: checkpointQuestionIds.size,
    conceptStates,
    weakConcepts: reviewTargets(conceptStates),
  };
}

/* پیشرفت کل درس (میانگین واحد‌ها) — برای نوار «درس: x٪» */
export function computeCourseProgress(course, progress, pageConceptsOfUnit, poolOfUnit) {
  const units = course.chapters.map((chapter) => chapter.units).flat();
  if (!units.length) return { overall: 0, content: 0, assessment: 0, mastery: 0 };
  const summaries = units.map((unit) =>
    computeUnitProgress(unit, progress, pageConceptsOfUnit(unit), poolOfUnit(unit)),
  );
  const avg = (key) => Math.round(summaries.reduce((sum, item) => sum + item[key], 0) / summaries.length);
  return { overall: avg('overall'), content: avg('content'), assessment: avg('assessment'), mastery: avg('mastery') };
}

/* ────────────────────────── تحلیل پایان واحد ────────────────────────── */

/*
 * کارنامهٔ پایان میکرودرسنامه: آمار مطالعه + مفهوم‌های قوی/ضعیف + پیشنهاد مرور.
 */
export function buildCompletionSummary(unit, progress, pageConcepts, poolQuestions, { startedAt }) {
  const unitState = progress.units?.[unit.id] ?? {};
  const pages = unitState.pages ?? {};
  const answers = unitState.answers ?? {};
  const conceptStates = computeConceptStates(unit, progress, pageConcepts, poolQuestions);
  const progressData = computeUnitProgress(unit, progress, pageConcepts, poolQuestions);

  const answeredIds = Object.keys(answers);
  const attemptsTotal = answeredIds.reduce((sum, id) => sum + (answers[id].attempts ?? 1), 0);
  const correctTotal = answeredIds.reduce((sum, id) => sum + (answers[id].correct ?? 0), 0);
  const accuracy = attemptsTotal ? Math.round((correctTotal / attemptsTotal) * 100) : 0;

  const readingSeconds = unit.pages.reduce(
    (sum, page) => sum + (pages[page.id]?.readingTimeSec ?? 0),
    0,
  );
  const studySeconds = startedAt
    ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
    : 0;

  return {
    ...progressData,
    pagesCompleted: unit.pages.filter((page) => pages[page.id]?.status === 'completed').length,
    timeSpentSec: Math.max(readingSeconds, studySeconds),
    questionsAnswered: attemptsTotal,
    accuracy,
    masteredConcepts: conceptStates.filter((concept) => concept.state === 'MASTERED' || concept.state === 'PRACTICING'),
    weakConcepts: reviewTargets(conceptStates),
    checkpointsDone: Object.values(unitState.checkpoints ?? {}).filter((item) => item.completed).length,
    confidenceFlag:
      confidenceAnalysis(conceptStates, accuracy) ?? null,
  };
}

/*
 * تشخیص ناسازگاری اعتماد-عملکرد (کنفیدنس بالا + دقت پایین، و برعکس) —
 * دادهٔ کلیدی تحلیل یادگیری که در پایان واحد گزارش می‌شود.
 */
function confidenceAnalysis(conceptStates, accuracy) {
  const confidenceValues = conceptStates.filter((concept) => concept.attempts > 0);
  if (!confidenceValues.length) return null;
  const avgConfidence = Math.round(
    (confidenceValues.reduce((sum, concept) => sum + STATE_MASTERY[concept.state], 0) / confidenceValues.length),
  );
  if (avgConfidence >= 60 && accuracy < 50) {
    return { type: 'overconfident', message: 'اعتمادت بالاتر از عملکرد تست‌هایت است؛ احتمالاً مفاهیم را «آشنا» می‌بینی نه «مسلط». برای تثبیت، بازیابی بدون متن را جدی بگیر.' };
  }
  if (avgConfidence < 45 && accuracy >= 70) {
    return { type: 'underconfident', message: 'عملکرد تست‌هایت خوب است ولی اعتمادت پایین مانده؛ داده‌ها می‌گویند از آنچه فکر می‌کنی قوی‌تری.' };
  }
  return null;
}

export default {
  LEARNING_STATES,
  computeConceptStates,
  reviewTargets,
  computeUnitProgress,
  computeCourseProgress,
  buildCompletionSummary,
};
