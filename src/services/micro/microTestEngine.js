/*
 * موتور انتخاب تست میکرودرسنامه — پل «درسنامه ↔ بانک تست تپش».
 *
 * قرارداد: همهٔ سؤال‌ها از بانک تست (src/services/testBank) می‌آیند؛ هیچ سؤالی در
 * این فایل یا درسنامه تعریف نمی‌شود. گره اتصال سؤال به درسنامه دو لایه دارد:
 *   ۱) conceptIds — فیلد اختصاصی بانک برای گره‌زنی سؤال به مفاهیم میکرودرسنامه
 *   ۲) topicPath — تطبیق مسیر مبحث سؤال با حوزهٔ درس (unit.testBank.topicPaths)
 *
 * امتیازدهی انتخاب، همة عوامل درخواستی را می‌سنجد:
 *   ارتباط با صفحه‌های تازه مطالعه‌شده، اهمیت مفهوم، دشواری تطبیقی، سابقهٔ عملکرد
 *   (تقویت مفاهیم ضعیف)، جریمهٔ دیده‌شده‌های خیلی تازه (cooldown)، تنوع مفهومی و
 *   جلوگیری از تکرارِ پشت‌سرهمِ سؤال‌های مشابه.
 *
 * با اتصال Backend همین امضاها سمت سرور اجرا می‌شوند؛ UI فقط از این API مصرف می‌کند.
 */

import { QUESTIONS } from '../testBank/testBankService';

const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2, very_hard: 3 };
const RANK_TO_DIFFICULTY = ['easy', 'medium', 'hard', 'very_hard'];

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_SEEN_DAYS = 3; // cooldown سؤال‌های دیده‌شدهٔ خیلی تازه
const MAX_PER_CONCEPT = 1; // تنوع: حداکثر یک سؤال از هر مفهوم در یک انتخاب (مگر اجبار)

export const difficultyRank = (difficulty) => DIFFICULTY_RANK[difficulty] ?? 1;

export const difficultyLabel = (difficulty) =>
  ({ easy: 'آسان', medium: 'متوسط', hard: 'سخت', very_hard: 'بسیار سخت' })[difficulty] ?? 'متوسط';

/* ────────────────────────── استخر (pool) ────────────────────────── */

/* سؤال‌های مرتبط با حوزهٔ درس: تطبیق topicPath با unit.testBank + مفهوم‌های واحد */
export function questionPoolOf(unit, concepts) {
  const subjectId = unit.testBank?.subjectId ?? unit.subjectId;
  const topicPaths = unit.testBank?.topicPaths ?? [];
  const relatedTopicPaths = unit.testBank?.relatedTopicPaths ?? [];
  const topicSet = new Set([...topicPaths, ...relatedTopicPaths].map((path) => path.join(' › ')));
  const conceptIds = new Set(concepts.map((concept) => concept.id));

  return QUESTIONS.filter((question) => {
    if (subjectId && question.subject !== subjectId) return false;
    if (topicSet.has(question.topicPath.join(' › '))) return true;
    return (question.conceptIds ?? []).some((conceptId) => conceptIds.has(conceptId));
  });
}

/* مفهوم‌های هدف انتخاب: مفهوم‌های صفحه‌های scope + مفهوم‌های ضعیف کاربر */
function targetConceptIds(scopePageIds, pageConcepts, weakConceptIds) {
  const targets = new Map(); // conceptId → وزن ارتباط
  for (const pageId of scopePageIds) {
    for (const conceptId of pageConcepts.get(pageId) ?? []) {
      targets.set(conceptId, Math.max(targets.get(conceptId) ?? 0, 3));
    }
  }
  for (const conceptId of weakConceptIds ?? []) {
    targets.set(conceptId, Math.max(targets.get(conceptId) ?? 0, 2));
  }
  return targets;
}

/* ────────────────────────── امتیاز سؤال ────────────────────────── */

function scoreQuestion(question, context) {
  const {
    targets,
    conceptImportance,
    targetDifficultyRank,
    answers,
    pickCount,
    now,
  } = context;

  const answer = answers[question.id];
  const questionConcepts = question.conceptIds ?? [];
  let score = 1;

  /* ۱) ارتباط با مفهوم‌های هدف (صفحه‌های تازه مطالعه‌شده) */
  let relevance = 0;
  for (const conceptId of questionConcepts) {
    relevance = Math.max(relevance, targets.get(conceptId) ?? 0);
  }
  if (relevance === 0 && questionConcepts.length) score -= 2.5;
  score += relevance;

  /* ۲) اهمیت آموزشی مفهوم و تگ‌های بانک */
  const importance = Math.max(0, ...questionConcepts.map((id) => conceptImportance.get(id) ?? 0));
  score += importance * 0.35;
  if (question.tags?.includes('منتخب')) score += 1.2;
  if (question.tags?.includes('پرتکرار')) score += 0.9;

  /* ۳) فاصلهٔ دشواری از هدف تطبیقی */
  score -= Math.abs(difficultyRank(question.difficulty) - targetDifficultyRank) * 1.4;

  /* ۴-۶) سابقهٔ عملکرد کاربر: مفهومِ اشتباه‌شده تقویت، سؤال اشتباه‌شده تقویت */
  if (answer) {
    if (answer.wrong > 0) score += Math.min(2.5, answer.wrong * 1.2);
    if (answer.lastCorrect === true && answer.correct > 0 && answer.wrong === 0) score -= 0.8;
    score -= Math.min(1.5, (answer.attempts - 1) * 0.75); // تکرار بی‌دلیل همان سؤال

    /* ۷) فاصلهٔ زمانی از آخرین مشاهده (cooldown) */
    const sinceDays = answer.lastAnsweredAt ? (now - answer.lastAnsweredAt) / DAY_MS : Infinity;
    if (sinceDays < RECENT_SEEN_DAYS) score -= 3.5 * (1 - sinceDays / RECENT_SEEN_DAYS);
    else if (sinceDays >= 7) score += 1; // سؤال «کهن‌شده» برای مرور فاصله‌دار مناسب است
  } else {
    score += 0.8; // مواجههٔ تازه با سؤال، ارزش دارد
  }

  /* ۸) تنوع: در یک انتخاب، سؤال دوم از یک مفهوم جریمه می‌شود */
  const diversityPenalty = questionConcepts.reduce(
    (penalty, conceptId) => penalty + (context.pickedConcepts.get(conceptId) ?? 0) * 2.5,
    0,
  );
  score -= diversityPenalty;

  /* کیفیت جامعه (آمار سؤال) — سؤال‌های خیلی آسان برای جامعه، ارزش تمرینی کمتری برای مرور دارند */
  if (question.stats?.correctPercent >= 88) score -= 0.5;

  return {
    question,
    score,
    concepts: questionConcepts.length ? questionConcepts : ['general'],
  };
}

/* ────────────────────────── انتخاب اصلی ────────────────────────── */

/*
 * انتخاب تست برای یک checkpoint.
 *   unit        — واحد جاری (testBank + concepts)
 *   checkpoint  — تعریف checkpoint (scopePages, questionCount)
 *   progress    — وضعیت پیشرفت کاربر از microProgressService
 *   pageConcepts— Map(pageId → conceptId[]) از سرویس محتوا
 */
export function pickCheckpointQuestions(unit, checkpoint, progress, pageConcepts, { randomize = true } = {}) {
  const unitState = progress.units?.[unit.id] ?? {};
  const answers = unitState.answers ?? {};
  const weakConceptIds = (unitState.weakConcepts ?? []).map((concept) => concept.id);
  const targets = targetConceptIds(checkpoint.scopePages, pageConcepts, weakConceptIds);
  const conceptImportance = new Map(unit.concepts.map((concept) => [concept.id, concept.importance ?? 3]));
  const pool = questionPoolOf(unit, unit.concepts);
  const now = Date.now();

  const context = {
    targets,
    conceptImportance,
    targetDifficultyRank: difficultyRank(unitState.difficulty ?? 'medium'),
    answers,
    now,
    pickedConcepts: new Map(),
  };

  const scored = pool
    .map((question) => scoreQuestion(question, context))
    .sort((a, b) => b.score - a.score || (randomize ? Math.random() - 0.5 : 0));

  const picked = [];
  const count = Math.min(checkpoint.questionCount ?? 3, scored.length);
  /* حلقهٔ دوم: اگر با قانون تنوع (یک سؤال به ازای هر مفهوم) به تعداد نرسیدیم،
     سؤال‌های باقی‌مانده را با کمترین جریمهٔ تکرار برمی‌داریم — تنوع مطلق نیست. */
  for (const pass of [0, 1]) {
    for (const entry of scored) {
      if (picked.length >= count) break;
      if (picked.includes(entry)) continue;
      const perConcept = pass === 0
        ? entry.concepts.some((conceptId) => (context.pickedConcepts.get(conceptId) ?? 0) >= MAX_PER_CONCEPT)
        : false;
      if (perConcept) continue;
      /* قانون «تست مشابه پشت سر هم تکرار نشود»: مفهوم سؤال جدید با قبلی یکسان نباشد */
      const last = picked[picked.length - 1];
      if (last && entry.concepts.every((conceptId) => last.concepts.includes(conceptId))) continue;
      picked.push(entry);
      for (const conceptId of entry.concepts) {
        context.pickedConcepts.set(conceptId, (context.pickedConcepts.get(conceptId) ?? 0) + 1);
      }
    }
    if (picked.length >= count) break;
  }

  return picked.map((entry) => entry.question);
}

/*
 * آزمون جمع‌بندی — Mini Assessment پایان واحد.
 * اولویت: سؤال‌هایی که در checkpointها دیده نشده‌اند؛ سپس کم‌تکرارترین‌ها.
 * حوزه: کل مفهوم‌های واحد + مباحث مرتبط (relatedTopicPaths).
 */
export function pickFinalAssessment(unit, progress, pageConcepts, { count = 10 } = {}) {
  const unitState = progress.units?.[unit.id] ?? {};
  const answers = unitState.answers ?? {};
  const now = Date.now();
  const conceptImportance = new Map(unit.concepts.map((concept) => [concept.id, concept.importance ?? 3]));
  const allConceptIds = new Set(unit.concepts.map((concept) => concept.id));
  const targets = new Map([...allConceptIds].map((id) => [id, 2]));

  const pool = questionPoolOf(unit, unit.concepts);
  const context = {
    targets,
    conceptImportance,
    targetDifficultyRank: Math.max(1, difficultyRank(unitState.difficulty ?? 'medium')),
    answers,
    now,
    pickedConcepts: new Map(),
  };

  const scored = pool
    .map((question) => {
      const entry = scoreQuestion(question, context);
      /* در آزمون جمع‌بندی، سؤال‌های دیده‌نشده امتیاز ویژه می‌گیرند تا «نسخهٔ کپی checkpoint» نشود */
      if (!answers[question.id]) entry.score += 2.2;
      return entry;
    })
    .sort((a, b) => b.score - a.score || Math.random() - 0.5);

  const picked = [];
  const target = Math.min(count, scored.length);
  for (const pass of [0, 1]) {
    for (const entry of scored) {
      if (picked.length >= target) break;
      if (picked.includes(entry)) continue;
      const perConcept = pass === 0
        ? entry.concepts.some((conceptId) => (context.pickedConcepts.get(conceptId) ?? 0) >= 1)
        : false;
      if (perConcept) continue;
      picked.push(entry);
      for (const conceptId of entry.concepts) {
        context.pickedConcepts.set(conceptId, (context.pickedConcepts.get(conceptId) ?? 0) + 1);
      }
    }
    if (picked.length >= target) break;
  }

  return picked.map((entry) => entry.question);
}

/* ────────────────────────── دشواری تطبیقی ────────────────────────── */

/*
 * بروزرسانی دشواری هدف بعد از هر checkpoint.
 * دو پاسخ درست متوالی → یک پله سخت‌تر؛ دو اشتباه متوالی → یک پله آسان‌تر.
 * خروجی: { difficulty, lastResults } — در وضعیت واحد ذخیره می‌شود.
 */
export function nextDifficulty(previous, results) {
  const streaks = [...(previous.lastResults ?? []), ...results].slice(-4);
  const rank = difficultyRank(previous.difficulty ?? 'medium');
  const lastTwo = streaks.slice(-2);

  let nextRank = rank;
  if (lastTwo.length === 2 && lastTwo.every((item) => item.correct)) nextRank = Math.min(3, rank + 1);
  else if (lastTwo.length === 2 && lastTwo.every((item) => !item.correct)) nextRank = Math.max(0, rank - 1);

  return {
    difficulty: RANK_TO_DIFFICULTY[nextRank],
    lastResults: streaks,
  };
}

/* ────────────────────────── تصحیح و بازخورد ────────────────────────── */

/*
 * تصحیح یک پاسخ و ساخت ساختار کامل بازخورد.
 * خروجی، همهٔ اجزای درخواستی نمایش جواب است: پاسخ کاربر، پاسخ درست، توضیح،
 * «چرا بقیه غلط‌اند»، مفهوم مرتبط و صفحهٔ مرتبط برای مرور.
 */
export function evaluateAnswer(question, selectedAnswer, { responseTime = 0 } = {}) {
  const correct = selectedAnswer === question.correctAnswer;
  return {
    questionId: question.id,
    selectedAnswer,
    correctAnswer: question.correctAnswer,
    correct,
    responseTime,
    answeredAt: Date.now(),
    explanation: question.explanation ?? null,
    figure: question.figure ?? null,
    conceptIds: question.conceptIds ?? [],
  };
}

export default {
  questionPoolOf,
  pickCheckpointQuestions,
  pickFinalAssessment,
  nextDifficulty,
  evaluateAnswer,
  difficultyLabel,
  difficultyRank,
};
