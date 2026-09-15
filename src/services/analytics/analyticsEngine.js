/*
 * Analytics Engine — موتور تحلیل تست‌های تپش.
 *
 * اصل جدایی منطق از UI: همهٔ محاسبات این سیستم (دقت، امتیاز عملکرد، ثبات، تسلط،
 * تحلیل خطا/زمان/اطمینان، نقشهٔ ضعف، تشخیص یادگیری، Insight و پیشنهاد) در همین
 * فایل به‌صورت توابع Pure و Testable پیاده شده‌اند. نه localStorage می‌خوانند، نه
 * DOM دارند و نه به React وابسته‌اند؛ ورودی همیشه آرایهٔ Attempt «تغذیه‌شده» است:
 *
 *   Attempt = {
 *     id, questionId, sessionId, examId, mode: 'practice' | 'exam',
 *     selected, correct: boolean | null (null = بی‌پاسخ),
 *     timeSpent (ثانیه), confidence: 'high' | 'medium' | 'low' | null,
 *     errorType: string | null, timestamp,
 *     // تغذیه‌شده از بانک سؤال (سرویس این کار را انجام می‌دهد):
 *     subject, subjectName, subjectAccent, topicPath, difficulty, type, expectedTime
 *   }
 *
 * قاعدهٔ صداقت داده: هر جا نمونهٔ کافی نیست، خروجی «کافی نیست» برمی‌گردد؛
 * هیچ Insight بدون Evidence تولید نمی‌شود.
 */

/* ────────────────────────── پیکربندی ────────────────────────── */

/*
 * وزن‌های امتیاز عملکرد — عمداً در یک ثابت جدا و قابل‌تنظیم؛ محصول این وزن‌ها با
 * اجزای ۰ تا ۱۰۰، امتیاز نهایی ۰ تا ۱۰۰ را می‌سازد.
 */
export const PERFORMANCE_WEIGHTS = {
  accuracy: 0.42, // دقت کلی
  consistency: 0.16, // ثبات بین سشن‌ها
  speed: 0.14, // سرعت نسبت به زمان متعارف سؤال
  difficulty: 0.18, // دقت وزن‌شده با سختی سؤال‌ها
  recency: 0.1, // روند اخیر نسبت به قبل
};

/* دشواری عددی برای وزن‌دهی؛ هم‌سو با DIFFICULTIES بانک تست */
export const DIFFICULTY_WEIGHTS = { easy: 0.75, medium: 1, hard: 1.35, very_hard: 1.7 };

/* آستانه‌های نمونه‌گیری — زیر این حجم‌ها نتیجه «قطعی» اعلام نمی‌شود */
export const SAMPLE_THRESHOLDS = {
  masteryAttempts: 4, // حداقل تلاش برای تشخیص تسلط مبحث
  insightAttempts: 12, // حداقل تلاش برای صدور Insight
  confidenceCoverage: 0.4, // حداقل نسبت دادهٔ اطمینان برای تحلیل اطمینان
  patternAttempts: 20, // حداقل تلاش برای الگوی رفتاری
};

export const MASTERY_STATUSES = {
  MASTERED: { label: 'تسلط یافته', accent: '#61D192' },
  STRONG: { label: 'قوی', accent: '#937fcd' },
  LEARNING: { label: 'در حال یادگیری', accent: '#e0b45c' },
  WEAK: { label: 'نیازمند تقویت', accent: '#e26d6d' },
  NEEDS_DATA: { label: 'دادهٔ کافی نیست', accent: '#8a8a8a' },
};

export const ERROR_TYPES = {
  KNOWLEDGE_GAP: { label: 'خلأ دانشی', hint: 'مبحث از پایه نیازمند مطالعه است' },
  CONCEPTUAL_ERROR: { label: 'خطای مفهومی', hint: 'مفهوم اشتباه فهمیده یا تثبیت نشده است' },
  CARELESS_MISTAKE: { label: 'بی‌دقتی', hint: 'بلد بودی اما تند پاسخ دادی' },
  MISREADING: { label: 'بد خواندن صورت سؤال', hint: 'صورت سؤال کامل خوانده نشد' },
  TIME_PRESSURE: { label: 'فشار زمان', hint: 'زمان آزمون کافی نبود' },
  CALCULATION_ERROR: { label: 'خطای محاسبه', hint: 'مسیر درست، محاسبه غلط' },
  MEMORY_FAILURE: { label: 'یاد‌آوری ناموفق', hint: 'خوانده‌ای ولی در لحظهٔ تست یادت نیامد' },
  UNCERTAIN_GUESS: { label: 'حدس', hint: 'بدون اطمینان گزینه انتخاب شد' },
  OTHER: { label: 'سایر', hint: 'دلیل دیگری داشته است' },
  UNMARKED: { label: 'ثبت‌نشده', hint: 'احتمالاً نیازمند بررسی' },
};

/* ────────────────────────── ابزارهای آماری ────────────────────────── */

export const sum = (values) => values.reduce((total, value) => total + value, 0);
export const mean = (values) => (values.length ? sum(values) / values.length : 0);

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function stdDev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : null);
const round1 = (value) => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* میانگین وزنی: Σ(w·x)/Σw */
const weightedMean = (pairs) => {
  const weightTotal = sum(pairs.map(([, weight]) => weight));
  return weightTotal > 0 ? sum(pairs.map(([value, weight]) => value * weight)) / weightTotal : 0;
};

/* تقسیم تاریخ به روز شمسی‌پذیر (YYYY-MM-DD میلادی محلی — کافی است) */
export const dayKey = (timestamp) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/* ────────────────────────── محاسبات پایه ────────────────────────── */

/*
 * دقت — accuracy روی «پاسخ‌داده‌شده‌ها» است (درست+غلط)؛ نسبت درست به کل
 * (شامل بی‌پاسخ) هم به‌عنوان completion برگردانده می‌شود تا دو مفهوم قاتی نشوند.
 */
export function calculateAccuracy(attempts) {
  const answered = attempts.filter((attempt) => attempt.correct !== null && attempt.correct !== undefined);
  const correct = answered.filter((attempt) => attempt.correct === true);
  const wrong = answered.filter((attempt) => attempt.correct === false);
  const unanswered = attempts.length - answered.length;
  return {
    total: attempts.length,
    answered: answered.length,
    correct: correct.length,
    wrong: wrong.length,
    unanswered,
    accuracy: answered.length ? round1((correct.length / answered.length) * 100) : null,
    completion: attempts.length ? round1((answered.length / attempts.length) * 100) : null,
  };
}

/*
 * ثبات — انحراف معیار دقتِ بین سشن‌ها (هر سشن ≥۳ پاسخ). خروجی cv استاندارد شده و
 * امتیاز ۰–۱۰۰ که در PERFORMANCE_WEIGHTS استفاده می‌شود.
 */
export function calculateConsistency(attempts) {
  const bySession = new Map();
  for (const attempt of attempts) {
    if (attempt.correct === null || attempt.correct === undefined) continue;
    const entry = bySession.get(attempt.sessionId) ?? { correct: 0, answered: 0, ts: attempt.timestamp };
    entry.correct += attempt.correct ? 1 : 0;
    entry.answered += 1;
    entry.ts = Math.max(entry.ts, attempt.timestamp);
    bySession.set(attempt.sessionId, entry);
  }
  const sessionAccuracies = [...bySession.values()]
    .filter((entry) => entry.answered >= 3)
    .sort((a, b) => a.ts - b.ts)
    .map((entry) => (entry.correct / entry.answered) * 100);

  if (sessionAccuracies.length < 3) {
    return { score: null, cv: null, label: 'دادهٔ کافی نیست', series: sessionAccuracies, sessions: sessionAccuracies.length };
  }
  const avg = mean(sessionAccuracies);
  const cv = avg > 0 ? stdDev(sessionAccuracies) / avg : 0;
  /* سشن‌های کوتاه ذاتاً نویز دارند؛ آستانه‌ها با همین واقعیت کالیبره شده‌اند */
  const score = round1(clamp(100 - cv * 210, 0, 100));
  const label = cv < 0.13 ? 'ثابت' : cv < 0.22 ? 'نسبتاً ثابت' : cv < 0.32 ? 'نوسان‌دار' : 'پرنوسان';
  return { score, cv: round1(cv * 100) / 100, label, series: sessionAccuracies, sessions: sessionAccuracies.length };
}

/*
 * سرعت — نسبت زمان مصرفی به زمان متعارف سؤال (expectedTime از آمار بانک).
 * score=۱۰۰ یعنی هم‌سرعتِ متعارف؛ کندی و تُندبی‌قرارِ خطاخیز جریمه می‌شوند.
 */
export function calculateSpeed(attempts) {
  const withExpected = attempts.filter(
    (attempt) => attempt.expectedTime && attempt.timeSpent > 0 && attempt.correct !== null && attempt.correct !== undefined,
  );
  if (!withExpected.length) return { score: null, medianRatio: null, samples: 0 };
  const ratios = withExpected.map((attempt) => attempt.timeSpent / attempt.expectedTime);
  const medianRatio = median(ratios);
  /* زیر ۱ → سریع‌تر از متعارف (سقف امتیاز نمی‌شکند)، بالای ۱ → افت خطی تا ۳ برابر */
  const speedScore = medianRatio <= 1 ? 100 - Math.max(0, 0.6 - medianRatio) * 40 : clamp(100 - (medianRatio - 1) * 60, 0, 100);
  return { score: round1(speedScore), medianRatio: round1(medianRatio * 10) / 10, samples: withExpected.length };
}

/*
 * دقت وزن‌شده با سختی — پاسخ درست به سؤال سخت‌تر سنگین‌تر است؛ این عدد با
 * accuracy ساده مقایسه می‌شود تا «سطح دشواری سؤال‌های زده‌شده» شفاف بماند.
 */
export function calculateDifficultyPerformance(attempts) {
  const answered = attempts.filter((attempt) => attempt.correct !== null && attempt.correct !== undefined);
  if (!answered.length) return { score: null, weightedAccuracy: null, avgDifficulty: null, samples: 0 };
  const pairs = answered.map((attempt) => [attempt.correct ? 100 : 0, DIFFICULTY_WEIGHTS[attempt.difficulty] ?? 1]);
  const weightedAccuracy = weightedMean(pairs);
  const avgDifficulty = mean(answered.map((attempt) => DIFFICULTY_WEIGHTS[attempt.difficulty] ?? 1));
  /* نرمال‌سازی سختی میانگین (۰.۷۵–۱.۷) به ۰–۱۰۰ برای جزء امتیاز کلی */
  const difficultyScore = clamp(((avgDifficulty - 0.75) / (1.7 - 0.75)) * 100, 0, 100) * 0.35 + weightedAccuracy * 0.65;
  return {
    score: round1(difficultyScore),
    weightedAccuracy: round1(weightedAccuracy),
    avgDifficulty: round1(avgDifficulty * 100) / 100,
    samples: answered.length,
  };
}

/*
 * روند اخیر — مقایسهٔ نیمهٔ دوم بازهٔ اخیر با نیمهٔ اول (روی دقت وزن‌شده).
 * خروجی ۰–۱۰۰ حول ۵۰: بالای ۵۵ روند رشد، زیر ۴۵ افت.
 */
export function calculateRecency(attempts) {
  const answered = attempts
    .filter((attempt) => attempt.correct !== null && attempt.correct !== undefined)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (answered.length < SAMPLE_THRESHOLDS.insightAttempts) return { score: null, delta: null, samples: answered.length };
  const midpoint = Math.floor(answered.length / 2);
  const firstHalf = calculateDifficultyPerformance(answered.slice(0, midpoint)).weightedAccuracy;
  const secondHalf = calculateDifficultyPerformance(answered.slice(midpoint)).weightedAccuracy;
  const delta = secondHalf - firstHalf;
  return { score: round1(clamp(50 + delta * 1.8, 0, 100)), delta: round1(delta), samples: answered.length };
}

/*
 * امتیاز عملکرد — ترکیب configurable پنج جزء. هر جزء مستقل قابل‌محاسبه است تا
 * UI بتواند اجزا را هم کنار عدد نهایی نشان دهد.
 */
export function calculatePerformanceScore(attempts, { weights = PERFORMANCE_WEIGHTS } = {}) {
  const accuracy = calculateAccuracy(attempts);
  const consistency = calculateConsistency(attempts);
  const speed = calculateSpeed(attempts);
  const difficulty = calculateDifficultyPerformance(attempts);
  const recency = calculateRecency(attempts);

  /* سشن اول کاربر: ثبات/روند هنوز معنا ندارد — وزن‌شان به دقت منتقل می‌شود */
  const effectiveWeights = { ...weights };
  const renormalize = (droppedKeys) => {
    const freed = sum(droppedKeys.map((key) => effectiveWeights[key] ?? 0));
    droppedKeys.forEach((key) => {
      effectiveWeights[key] = 0;
    });
    effectiveWeights.accuracy += freed;
  };
  if (consistency.score === null) renormalize(['consistency']);
  if (recency.score === null) renormalize(['recency']);

  const parts = {
    accuracy: { score: accuracy.accuracy ?? 0, weight: effectiveWeights.accuracy },
    consistency: { score: consistency.score ?? 0, weight: effectiveWeights.consistency },
    speed: { score: speed.score ?? 0, weight: effectiveWeights.speed },
    difficulty: { score: difficulty.score ?? 0, weight: effectiveWeights.difficulty },
    recency: { score: recency.score ?? 0, weight: effectiveWeights.recency },
  };
  const score = weightedMean(Object.values(parts).map((part) => [part.score, part.weight]));
  return {
    score: round1(clamp(score, 0, 100)),
    parts,
    sufficientData: attempts.length >= SAMPLE_THRESHOLDS.insightAttempts,
    note: 'این امتیاز ترکیبی از دقت، ثبات، سرعت و سطح دشواری تست‌هاست.',
  };
}

/* ────────────────────────── تجمیع سلسله‌مراتبی ────────────────────────── */

/* تجمیع در سطح درس */
export function aggregateBySubject(attempts) {
  const map = new Map();
  for (const attempt of attempts) {
    const entry =
      map.get(attempt.subject) ??
      {
        subjectId: attempt.subject,
        name: attempt.subjectName,
        accent: attempt.subjectAccent,
        attempts: [],
      };
    entry.attempts.push(attempt);
    map.set(attempt.subject, entry);
  }
  return [...map.values()].map((entry) => {
    const accuracy = calculateAccuracy(entry.attempts);
    const times = entry.attempts.filter((a) => a.timeSpent > 0).map((a) => a.timeSpent);
    const difficulty = calculateDifficultyPerformance(entry.attempts);
    const trend = calculateTopicTrend(entry.attempts);
    const questionIds = [...new Set(entry.attempts.map((attempt) => attempt.questionId))];
    return {
      ...entry,
      questionCount: questionIds.length,
      accuracy: accuracy.accuracy,
      ...pickCounts(accuracy),
      averageTime: times.length ? Math.round(mean(times)) : null,
      difficulty: difficulty.avgDifficulty,
      trend,
      mastery: calculateMastery(entry.attempts),
    };
  });
}

/* تجمیع در سطح مبحث (topicPath کامل: 'مبحث › زیرمبحث') */
export function aggregateByTopic(attempts) {
  const map = new Map();
  for (const attempt of attempts) {
    const key = attempt.topicPath.join(' › ');
    const entry = map.get(key) ?? { key, subjectId: attempt.subject, subjectName: attempt.subjectName, accent: attempt.subjectAccent, topic: attempt.topicPath[0], subtopic: attempt.topicPath[1] ?? null, attempts: [] };
    entry.attempts.push(attempt);
    map.set(key, entry);
  }
  return [...map.values()]
    .map((entry) => {
      const accuracy = calculateAccuracy(entry.attempts);
      const times = entry.attempts.filter((a) => a.timeSpent > 0).map((a) => a.timeSpent);
      const questionIds = [...new Set(entry.attempts.map((attempt) => attempt.questionId))];
      return {
        ...entry,
        questionCount: questionIds.length,
        accuracy: accuracy.accuracy,
        ...pickCounts(accuracy),
        averageTime: times.length ? Math.round(mean(times)) : null,
        difficulty: calculateDifficultyPerformance(entry.attempts).avgDifficulty,
        trend: calculateTopicTrend(entry.attempts),
        mastery: calculateMastery(entry.attempts),
        lastAttemptAt: Math.max(...entry.attempts.map((attempt) => attempt.timestamp)),
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'fa') || a.topic.localeCompare(b.topic, 'fa'));
}

/* تجمیع در سطح سؤال — پایهٔ Question Analytics و خط زمانی تلاش‌ها */
export function aggregateByQuestion(attempts) {
  const map = new Map();
  for (const attempt of attempts) {
    const entry = map.get(attempt.questionId) ?? { questionId: attempt.questionId, attempts: [] };
    entry.attempts.push(attempt);
    map.set(attempt.questionId, entry);
  }
  return [...map.values()]
    .map((entry) => {
      const sorted = [...entry.attempts].sort((a, b) => a.timestamp - b.timestamp);
      const accuracy = calculateAccuracy(sorted);
      const times = sorted.filter((a) => a.timeSpent > 0).map((a) => a.timeSpent);
      const last = sorted[sorted.length - 1];
      return {
        questionId: entry.questionId,
        subject: last.subject,
        subjectName: last.subjectName,
        subjectAccent: last.subjectAccent,
        topicPath: last.topicPath,
        difficulty: last.difficulty,
        type: last.type,
        attemptCount: sorted.length,
        ...pickCounts(accuracy),
        accuracy: accuracy.accuracy,
        averageTime: times.length ? Math.round(mean(times)) : null,
        timeline: sorted, // Attempt به ترتیب زمان — برای QuestionAttemptTimeline
        lastAttemptAt: last.timestamp,
        lastCorrect: last.correct,
        errorTypes: [...new Set(sorted.filter((a) => !a.correct && a.errorType).map((a) => a.errorType))],
        /* مفهوم در حال تثبیت: آخرین دو تلاش درست، بعد از خطا */
        consolidating: sorted.length >= 3 && sorted.slice(-2).every((a) => a.correct === true) && sorted.slice(0, -2).some((a) => a.correct === false),
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'fa') || a.questionId.localeCompare(b.questionId));
}

const pickCounts = (accuracy) => ({
  attemptCount: accuracy.total,
  correctCount: accuracy.correct,
  wrongCount: accuracy.wrong,
  unansweredCount: accuracy.unanswered,
});

/*
 * روند مبحث — دقت نیمهٔ اخیر نسبت به نیمهٔ اول تلاش‌های همان مبحث.
 * مقدار: 'up' | 'down' | 'flat' | null (نمونهٔ کافی نیست)
 */
export function calculateTopicTrend(attempts, { minSamples = 8 } = {}) {
  const answered = attempts
    .filter((attempt) => attempt.correct !== null && attempt.correct !== undefined)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (answered.length < minSamples) return { direction: null, delta: null };
  const midpoint = Math.floor(answered.length / 2);
  const first = pct(answered.slice(0, midpoint).filter((a) => a.correct).length, midpoint);
  const secondPart = answered.slice(midpoint);
  const second = pct(secondPart.filter((a) => a.correct).length, secondPart.length);
  if (first === null || second === null) return { direction: null, delta: null };
  const delta = round1(second - first);
  const direction = delta >= 5 ? 'up' : delta <= -5 ? 'down' : 'flat';
  return { direction, delta };
}

/*
 * تسلط — صرفاً درصد نیست؛ ترکیب دقت وزن‌شده با سختی + حجم تلاش + تازگی +
 * عملکرد مکرر (روند). خروجی یکی از MASTERY_STATUSES است.
 */
export function calculateMastery(attempts) {
  const difficultyPerf = calculateDifficultyPerformance(attempts);
  const accuracy = difficultyPerf.weightedAccuracy;
  const volume = attempts.filter((a) => a.correct !== null && a.correct !== undefined).length;
  if (volume < SAMPLE_THRESHOLDS.masteryAttempts || accuracy === null) {
    return { status: 'NEEDS_DATA', score: null, accuracy, volume };
  }
  const trend = calculateTopicTrend(attempts, { minSamples: SAMPLE_THRESHOLDS.masteryAttempts * 2 });
  const lastAttemptAt = Math.max(...attempts.map((attempt) => attempt.timestamp));
  const daysSince = (Date.now() - lastAttemptAt) / 86400000;
  /* جریمهٔ کهنگی: مبحثی که ۴۵ روز تست نخورده کمی از اعتبارش می‌کاهد */
  const recencyFactor = clamp(1 - Math.max(0, daysSince - 45) / 90, 0.75, 1);
  const trendBonus = trend.direction === 'up' ? 4 : trend.direction === 'down' ? -4 : 0;
  const score = round1(clamp(accuracy * recencyFactor + trendBonus, 0, 100));

  let status;
  if (score >= 82 && volume >= 8) status = 'MASTERED';
  else if (score >= 70) status = 'STRONG';
  else if (score >= 55) status = 'LEARNING';
  else status = 'WEAK';
  return { status, score, accuracy, volume, trend, lastAttemptAt };
}

/* ────────────────────────── تحلیل خطا ────────────────────────── */

/*
 * Wrong ≠ Wrong — توزیع نوع خطا. تلاش‌های بدون برچسب «ثبت‌نشده» می‌مانند و در UI
 * به‌عنوان «احتمالاً نیازمند بررسی» نشان داده می‌شوند؛ حدس زده نمی‌شود.
 * خطای بی‌دقتیِ «استنباط‌شده» فقط آمار جانبی است (غلطِ زیر ۱۰ ثانیه) و جای برچسب
 * کاربر را نمی‌گیرد.
 */
export function analyzeErrors(attempts) {
  const wrong = attempts.filter((attempt) => attempt.correct === false);
  const distribution = new Map();
  for (const attempt of wrong) {
    const key = attempt.errorType ?? 'UNMARKED';
    distribution.set(key, (distribution.get(key) ?? 0) + 1);
  }
  const fastWrong = wrong.filter((attempt) => attempt.timeSpent > 0 && attempt.timeSpent < 10);
  const slowWrong = wrong.filter((attempt) => attempt.expectedTime && attempt.timeSpent > attempt.expectedTime * 2);
  return {
    totalWrong: wrong.length,
    distribution: [...distribution.entries()]
      .map(([type, count]) => ({
        type,
        label: ERROR_TYPES[type]?.label ?? type,
        count,
        share: wrong.length ? round1((count / wrong.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count),
    inferred: {
      /* آمار جانبی برای نمایش «میل به پاسخ تند» — نه تشخیص قطعی */
      fastWrong: fastWrong.length,
      fastWrongShare: wrong.length ? round1((fastWrong.length / wrong.length) * 100) : 0,
      slowWrong: slowWrong.length,
    },
    knowledgeShare:
      wrong.length && distribution.get('KNOWLEDGE_GAP')
        ? round1(((distribution.get('KNOWLEDGE_GAP') ?? 0) / wrong.length) * 100)
        : 0,
  };
}

/* ────────────────────────── تحلیل اطمینان ────────────────────────── */

/*
 * ماتریس اطمینان×صحت — چهار خانه:
 * مطمئن+درست (دانش محکم) | مطمئن+غلط (مفهوم‌سازی خطرناک) |
 * نامطمئن+درست (دانش شکننده) | نامطمئن+غلط (خلأ دانشی)
 * فقط روی داده‌ای که confidence دارد؛ پوشش کم از حد آستانه → sufficient=false.
 */
export function analyzeConfidence(attempts) {
  const withConfidence = attempts.filter(
    (attempt) => attempt.confidence && attempt.correct !== null && attempt.correct !== undefined,
  );
  const coverage = attempts.length ? withConfidence.length / attempts.length : 0;
  const cell = (confidenceSet, correct) =>
    withConfidence.filter((attempt) => confidenceSet.includes(attempt.confidence) && attempt.correct === correct).length;

  const confidentCorrect = cell(['high'], true);
  const confidentWrong = cell(['high'], false);
  const uncertainCorrect = cell(['low'], true);
  const uncertainWrong = cell(['low'], false);
  const mediumCorrect = cell(['medium'], true);
  const mediumWrong = cell(['medium'], false);

  const confidentTotal = confidentCorrect + confidentWrong;
  const calibration = confidentTotal ? round1((confidentCorrect / confidentTotal) * 100) : null;

  return {
    coverage: round1(coverage * 100),
    sufficient: coverage >= SAMPLE_THRESHOLDS.confidenceCoverage && withConfidence.length >= 10,
    quadrants: {
      confidentCorrect,
      confidentWrong,
      uncertainCorrect,
      uncertainWrong,
      mediumCorrect,
      mediumWrong,
    },
    calibration,
    /* مفهوم‌سازی خطرناک متمرکز روی یک مبحث؟ */
    dangerousByTopic: topTopicFor(withConfidence.filter((attempt) => attempt.confidence === 'high' && attempt.correct === false)),
    fragileByTopic: topTopicFor(withConfidence.filter((attempt) => attempt.confidence === 'low' && attempt.correct === true)),
  };
}

function topTopicFor(attempts) {
  if (attempts.length < 3) return null;
  const counts = new Map();
  for (const attempt of attempts) {
    const key = attempt.topicPath.join(' › ');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [topic, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { topic, count, share: round1((count / attempts.length) * 100) };
}

/* ────────────────────────── تحلیل زمان ────────────────────────── */

const TIME_BUCKETS = [
  { key: 'fast', label: 'زیر ۱۵ ثانیه', min: 0, max: 15, accent: '#61D192' },
  { key: 'normal', label: '۱۵ تا ۴۵ ثانیه', min: 15, max: 45, accent: '#937fcd' },
  { key: 'slow', label: '۴۵ تا ۹۰ ثانیه', min: 45, max: 90, accent: '#e0b45c' },
  { key: 'very-slow', label: 'بیش از ۹۰ ثانیه', min: 90, max: Infinity, accent: '#e26d6d' },
];

export function analyzeTime(attempts) {
  const timed = attempts.filter((attempt) => attempt.timeSpent > 0 && attempt.correct !== null && attempt.correct !== undefined);
  if (!timed.length) {
    return { sufficient: false, average: null, medianTime: null, fastest: null, slowest: null, byBucket: [], byDifficulty: [] };
  }
  const times = timed.map((attempt) => attempt.timeSpent);

  const byBucket = TIME_BUCKETS.map((bucket) => {
    const items = timed.filter((attempt) => attempt.timeSpent >= bucket.min && attempt.timeSpent < bucket.max);
    const accuracy = calculateAccuracy(items);
    return {
      ...bucket,
      count: items.length,
      accuracy: accuracy.accuracy,
    };
  }).filter((bucket) => bucket.count > 0);

  const byDifficulty = ['easy', 'medium', 'hard', 'very_hard'].map((difficulty) => {
    const items = timed.filter((attempt) => attempt.difficulty === difficulty);
    return {
      difficulty,
      count: items.length,
      averageTime: items.length ? Math.round(mean(items.map((a) => a.timeSpent))) : null,
      accuracy: calculateAccuracy(items).accuracy,
    };
  }).filter((entry) => entry.count > 0);

  /* تند و کندِ نامعمول — قابل کلیک در UI */
  const rushed = timed
    .filter((attempt) => attempt.timeSpent < 10 && attempt.correct === false)
    .sort((a, b) => a.timeSpent - b.timeSpent);
  const overtime = timed
    .filter((attempt) => attempt.expectedTime && attempt.timeSpent > attempt.expectedTime * 2.2)
    .sort((a, b) => b.timeSpent - a.timeSpent);

  return {
    sufficient: timed.length >= 10,
    average: Math.round(mean(times)),
    medianTime: Math.round(median(times)),
    fastest: Math.min(...times),
    slowest: Math.max(...times),
    byBucket,
    byDifficulty,
    rushed: rushed.slice(0, 30),
    overtime: overtime.slice(0, 30),
  };
}

/* ────────────────────────── تحلیل دشواری ────────────────────────── */

export function analyzeDifficulty(attempts) {
  const rows = ['easy', 'medium', 'hard', 'very_hard'].map((difficulty) => {
    const items = attempts.filter((attempt) => attempt.difficulty === difficulty);
    const accuracy = calculateAccuracy(items);
    const times = items.filter((a) => a.timeSpent > 0).map((a) => a.timeSpent);
    return {
      difficulty,
      count: items.length,
      accuracy: accuracy.accuracy,
      averageTime: times.length ? Math.round(mean(times)) : null,
      ...pickCounts(accuracy),
    };
  }).filter((row) => row.count > 0);

  if (rows.length < 2) return { sufficient: false, rows, gap: null };
  const acc = (difficulty) => rows.find((row) => row.difficulty === difficulty)?.accuracy;
  const easy = acc('easy') ?? acc('medium');
  const hard = acc('hard') ?? acc('very_hard');
  const gap = easy !== undefined && hard !== undefined ? round1(easy - hard) : null;
  return { sufficient: true, rows, gap };
}

/* ────────────────────────── تحلیل بی‌پاسخ‌ها ────────────────────────── */

/*
 * تفکیک Not Attempted (اصلاً باز نشده — انتهای زمان‌خورده) و Skipped
 * (دیده شده ولی رد شده). در دادهٔ فعلی «دیدن» با marked یا زمانِ بسیار کم
 * قابل تقریب است؛ بدون این نشانه‌ها صادقانه «نامشخص» می‌ماند.
 */
export function analyzeUnanswered(attempts) {
  const unanswered = attempts.filter((attempt) => attempt.correct === null || attempt.correct === undefined);
  const isSkipped = (attempt) => attempt.skipped === true || (attempt.timeSpent > 0 && attempt.timeSpent < 5);
  const skipped = unanswered.filter(isSkipped);
  const notAttempted = unanswered.filter((attempt) => !isSkipped(attempt));
  const byTopic = new Map();
  for (const attempt of unanswered) {
    const key = attempt.topicPath.join(' › ');
    byTopic.set(key, (byTopic.get(key) ?? 0) + 1);
  }
  const examUnanswered = unanswered.filter((attempt) => attempt.mode === 'exam');
  return {
    total: unanswered.length,
    share: attempts.length ? round1((unanswered.length / attempts.length) * 100) : 0,
    skipped: skipped.length,
    notAttempted: notAttempted.length,
    inExams: examUnanswered.length,
    topTopics: [...byTopic.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic, count]) => ({ topic, count })),
    attempts: unanswered.slice(-40),
  };
}

/* ────────────────────────── نقشهٔ نقاط ضعف ────────────────────────── */

/*
 * اولویت = کمبود دقت × وزن حجم × وزن اهمیت (سختی متعارف مبحث).
 * خروجی سه سطل: فوری / مرور / مناسب — باEvidence برای هر مبحث.
 */
export function detectWeakTopics(topicAggregates) {
  const scored = topicAggregates
    .filter((topic) => topic.mastery.status !== 'NEEDS_DATA')
    .map((topic) => {
      const volumeWeight = clamp(Math.log2(1 + topic.attemptCount) / 5, 0.3, 1);
      const importanceWeight = clamp((topic.difficulty ?? 1) / 1.4, 0.6, 1.2);
      const deficit = 100 - (topic.mastery.score ?? topic.accuracy ?? 0);
      const priority = round1(deficit * volumeWeight * importanceWeight);
      const accuracy = topic.accuracy ?? 100;
      let bucket;
      if ((topic.mastery.status === 'WEAK' && priority >= 12) || priority >= 26) bucket = 'critical';
      else if (accuracy < 72 || topic.trend.direction === 'down' || topic.mastery.status === 'LEARNING') bucket = 'review';
      else bucket = 'ok';
      return { ...topic, priority, bucket };
    })
    .sort((a, b) => b.priority - a.priority);

  return {
    critical: scored.filter((topic) => topic.bucket === 'critical'),
    review: scored.filter((topic) => topic.bucket === 'review'),
    ok: scored.filter((topic) => topic.bucket === 'ok'),
    all: scored,
    biggestDrop: scored.find((topic) => topic.trend.direction === 'down') ?? null,
  };
}

/* ────────────────────────── تمرین در برابر آزمون ────────────────────────── */

export function comparePracticeVsExam(attempts) {
  const practice = attempts.filter((attempt) => attempt.mode === 'practice');
  const exam = attempts.filter((attempt) => attempt.mode === 'exam');
  const practiceStats = calculateAccuracy(practice);
  const examStats = calculateAccuracy(exam);
  const practiceTime = mean(practice.filter((a) => a.timeSpent > 0).map((a) => a.timeSpent));
  const examTime = mean(exam.filter((a) => a.timeSpent > 0).map((a) => a.timeSpent));
  const practiceConfidence = confidenceRate(practice);
  const examConfidence = confidenceRate(exam);
  const drop = practiceStats.accuracy !== null && examStats.accuracy !== null ? round1(practiceStats.accuracy - examStats.accuracy) : null;

  return {
    practice: {
      ...practiceStats,
      averageTime: practiceTime ? Math.round(practiceTime) : null,
      confidence: practiceConfidence,
      difficulty: calculateDifficultyPerformance(practice).avgDifficulty,
      performance: calculatePerformanceScore(practice).score,
      sessions: new Set(practice.map((attempt) => attempt.sessionId)).size,
    },
    exam: {
      ...examStats,
      averageTime: examTime ? Math.round(examTime) : null,
      confidence: examConfidence,
      difficulty: calculateDifficultyPerformance(exam).avgDifficulty,
      performance: calculatePerformanceScore(exam).score,
      sessions: new Set(exam.map((attempt) => attempt.sessionId)).size,
      timePressure: examStats.unanswered > 0 ? round1((examStats.unanswered / Math.max(examStats.total, 1)) * 100) : 0,
    },
    accuracyDrop: drop,
    sufficient: practiceStats.answered >= 10 && examStats.answered >= 10,
  };
}

const confidenceRate = (attempts) => {
  const withConfidence = attempts.filter((attempt) => attempt.confidence === 'high');
  const answered = attempts.filter((attempt) => attempt.confidence && attempt.correct !== null);
  return answered.length ? round1((withConfidence.length / answered.length) * 100) : null;
};

/* ────────────────────────── مقایسهٔ دوره‌ها ────────────────────────── */

/*
 * مقایسهٔ بازهٔ فعلی با دورهٔ قبلی هم‌طول — روند رشد، نه فشار روانی؛
 * «بهتر/بدتر» برای هر سنجه از جهت منطقی آن سنجه محاسبه می‌شود.
 */
export function comparePeriods(currentAttempts, previousAttempts) {
  const current = summarizePeriod(currentAttempts);
  const previous = summarizePeriod(previousAttempts);
  const delta = (key, transform = (value) => value) =>
    current[key] !== null && previous[key] !== null ? round1(transform(current[key]) - transform(previous[key])) : null;

  return {
    current,
    previous,
    metrics: [
      {
        key: 'accuracy',
        label: 'دقت پاسخ‌گویی',
        delta: delta('accuracy'),
        goodDirection: 'up',
        format: 'percent',
      },
      {
        key: 'averageTime',
        label: 'میانگین زمان هر تست',
        delta: delta('averageTime'),
        goodDirection: 'down',
        format: 'seconds',
      },
      {
        key: 'unanswered',
        label: 'بی‌پاسخ‌ها',
        delta: delta('unanswered'),
        goodDirection: 'down',
        format: 'count',
      },
      {
        key: 'attemptCount',
        label: 'تعداد تست',
        delta: delta('attemptCount'),
        goodDirection: 'up',
        format: 'count',
      },
    ],
  };
}

function summarizePeriod(attempts) {
  const accuracy = calculateAccuracy(attempts);
  const times = attempts.filter((a) => a.timeSpent > 0).map((a) => a.timeSpent);
  return {
    attemptCount: attempts.length,
    correct: accuracy.correct,
    wrong: accuracy.wrong,
    unanswered: accuracy.unanswered,
    accuracy: accuracy.accuracy,
    averageTime: times.length ? Math.round(mean(times)) : null,
    performance: attempts.length ? calculatePerformanceScore(attempts).score : null,
  };
}

/* ────────────────────────── سری زمانی روزانه ────────────────────────── */

/* شروع امروز (۰۰:۰۰ محلی) — مبنای مشترک همهٔ بازه‌های روزانه تا مرز روزها ثابت بماند */
export const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/*
 * سری روزانه برای نمودار روند — دقیقاً یک نقطه برای هر روزِ بازه، از قدیمی‌ترین
 * روز تا **خودِ امروز**. روزهای بدون فعالیت هم با مقدار خالی حاضرند تا «دوره‌های
 * بدون فعالیت» در نمودار دیده شوند.
 *
 * نکتهٔ حساس: مبنای روزها نیمه‌شب محلی است، نه پایان امروز. اگر مبنا پایان روز
 * باشد، برچسبِ نیمروز به روز بعد می‌افتد و کل سری یک روز جابه‌جا می‌شود و امروز
 * از نمودار می‌افتد (باگی که قبلاً همین‌جا بود).
 *
 * امتیاز عملکرد هر روز با پنجرهٔ غلتان هفت‌روزهٔ واقعی حساب می‌شود (نه «۱۴۰ تلاش
 * آخر»)؛ اگر دادهٔ هفت روز کمتر از حد نمونه باشد، پنجره تا سقف ۲۸ روز عقب می‌رود
 * تا خط امتیاز هم به تغییرات اخیر واکنش بدهد و هم بی‌داده نماند.
 */
export function buildDailySeries(attempts, { days = 90 } = {}) {
  const dayMs = 86400000;
  const todayStart = startOfToday();
  const rangeStart = todayStart - (days - 1) * dayMs;
  const rangeEnd = todayStart + dayMs; /* ابتدای فردا — کران بازِ بالای بازه */

  const byDay = new Map();
  for (const attempt of attempts) {
    if (attempt.timestamp < rangeStart || attempt.timestamp >= rangeEnd) continue;
    const key = dayKey(attempt.timestamp);
    const entry = byDay.get(key) ?? { key, attempts: [] };
    entry.attempts.push(attempt);
    byDay.set(key, entry);
  }

  const dayLabelFmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'short' });
  const fullLabelFmt = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
  const series = [];
  for (let index = 0; index < days; index += 1) {
    const dayStart = rangeStart + index * dayMs;
    const ts = dayStart + 12 * 3600000; /* نیمروز — نمایندهٔ همان روز برای کلید و برچسب */
    const key = dayKey(ts);
    const entry = byDay.get(key);
    const accuracy = entry ? calculateAccuracy(entry.attempts) : { total: 0, correct: 0, wrong: 0, unanswered: 0, accuracy: null };
    const times = entry ? entry.attempts.filter((attempt) => attempt.timeSpent > 0).map((attempt) => attempt.timeSpent) : [];
    series.push({
      key,
      ts,
      dayStart,
      isToday: dayStart === todayStart,
      label: dayLabelFmt.format(new Date(ts)),
      fullLabel: fullLabelFmt.format(new Date(ts)),
      count: accuracy.total,
      correct: accuracy.correct,
      wrong: accuracy.wrong,
      unanswered: accuracy.unanswered,
      accuracy: accuracy.accuracy,
      averageTime: times.length ? Math.round(mean(times)) : null,
    });
  }

  /* امتیاز عملکرد — پنجرهٔ غلتان ۷ روزه با عقب‌نشینی کنترل‌شده تا ۲۸ روز */
  const PERF_WINDOW_DAYS = 7;
  const PERF_LOOKBACK_DAYS = 28;
  const MIN_SAMPLES = 5;
  const sorted = [...attempts].sort((a, b) => a.timestamp - b.timestamp);
  let cursor = 0;
  for (const point of series) {
    const dayEnd = point.dayStart + dayMs;
    while (cursor < sorted.length && sorted[cursor].timestamp < dayEnd) cursor += 1;
    const before = sorted.slice(0, cursor);
    const windowStart = point.dayStart - (PERF_WINDOW_DAYS - 1) * dayMs;
    let windowAttempts = before.filter((attempt) => attempt.timestamp >= windowStart);
    if (windowAttempts.length < MIN_SAMPLES) {
      const lookbackStart = point.dayStart - (PERF_LOOKBACK_DAYS - 1) * dayMs;
      windowAttempts = before.filter((attempt) => attempt.timestamp >= lookbackStart);
    }
    point.performanceScore = windowAttempts.length >= MIN_SAMPLES ? calculatePerformanceScore(windowAttempts).score : null;
  }
  return series;
}

/* ────────────────────────── آزمون‌ها ────────────────────────── */

/*
 * تحلیل هر آزمون — از سشن‌های exam + Attemptهای آن‌ها.
 * score با نمرهٔ منفی سشن محاسبه می‌شود (همان قرارداد submitSession بانک).
 */
export function aggregateExams(examSessions, attempts) {
  const attemptsBySession = new Map();
  for (const attempt of attempts) {
    const list = attemptsBySession.get(attempt.sessionId) ?? [];
    list.push(attempt);
    attemptsBySession.set(attempt.sessionId, list);
  }
  return examSessions
    .map((session) => {
      const items = attemptsBySession.get(session.id) ?? [];
      const accuracy = calculateAccuracy(items);
      const times = items.filter((a) => a.timeSpent > 0).map((a) => a.timeSpent);
      const negative = session.negativeMarking ?? 0;
      const score = Math.max(0, accuracy.correct + accuracy.wrong * negative);
      /* آزمونی که در بازهٔ فیلتر هیچ تلاشی ندارد، درصد ندارد — نه صفر درصد */
      const percentage = items.length ? round1((score / items.length) * 100) : null;
      return {
        examId: session.id,
        session,
        title: session.title,
        subtitle: session.subtitle ?? '',
        submittedAt: session.submittedAt,
        durationMinutes: session.durationMinutes ?? null,
        negativeMarking: negative,
        examKind: session.examKind ?? null,
        total: items.length,
        ...pickCounts(accuracy),
        accuracy: accuracy.accuracy,
        percentage,
        averageTime: times.length ? Math.round(mean(times)) : null,
        difficulty: calculateDifficultyPerformance(items).avgDifficulty,
        performance: percentage,
        rank: session.rank ?? null,
        percentile: session.percentile ?? null,
        timedOut: session.timedOut ?? false,
        items,
      };
    })
    .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
}

/* ────────────────────────── الگوهای رفتاری ────────────────────────── */

/*
 * تشخیص الگو فقط با Evidence و حداقل نمونه؛ هر الگو sampleSize دارد تا UI
 * بتواند «دادهٔ کافی نیست» را صادقانه نشان دهد.
 */
export function detectPatterns(attempts) {
  const patterns = [];
  const answered = attempts.filter((attempt) => attempt.correct !== null && attempt.correct !== undefined);
  if (answered.length < SAMPLE_THRESHOLDS.patternAttempts) return patterns;

  /* ۱) افت سرعت در ساعات پایانی شب */
  const byHourBucket = {
    morning: answered.filter((a) => a.timestamp && new Date(a.timestamp).getHours() >= 6 && new Date(a.timestamp).getHours() < 12),
    evening: answered.filter((a) => a.timestamp && new Date(a.timestamp).getHours() >= 17 && new Date(a.timestamp).getHours() < 24),
  };
  for (const [bucket, items] of Object.entries(byHourBucket)) {
    if (items.length < 15) continue;
    const other = answered.filter((attempt) => !items.includes(attempt));
    if (other.length < 15) continue;
    const bucketAccuracy = calculateAccuracy(items).accuracy;
    const otherAccuracy = calculateAccuracy(other).accuracy;
    if (bucketAccuracy !== null && otherAccuracy !== null && otherAccuracy - bucketAccuracy >= 8) {
      patterns.push({
        id: `pattern-time-${bucket}`,
        type: 'TIME_OF_DAY',
        title: bucket === 'evening' ? 'در تست‌های پایانی روز، دقتت افت می‌کند' : 'دقت صبح‌های تو پایین‌تر است',
        description: `دقت تو در این بازهٔ ساعتی ${round1(bucketAccuracy)}٪ است؛ در سایر ساعات ${round1(otherAccuracy)}٪.`,
        evidence: `${items.length} تست در این بازهٔ ساعتی مقابل ${other.length} تست در سایر ساعات.`,
        sampleSize: items.length,
      });
      break;
    }
  }

  /* ۲) زمان بیشتر صرفِ سؤالات محاسباتی */
  const calculation = answered.filter((a) => a.type === 'calculation');
  const others = answered.filter((a) => a.type !== 'calculation');
  if (calculation.length >= 6 && others.length >= 10) {
    const calcTime = mean(calculation.map((a) => a.timeSpent || 0));
    const otherTime = mean(others.map((a) => a.timeSpent || 0));
    if (otherTime > 0 && calcTime / otherTime >= 1.5) {
      patterns.push({
        id: 'pattern-calculation-time',
        type: 'QUESTION_TYPE',
        title: 'در تست‌های محاسباتی زمان بیشتری صرف می‌کنی',
        description: `میانگین زمان تو در تست محاسباتی ${Math.round(calcTime)} ثانیه است؛ در بقیه ${Math.round(otherTime)} ثانیه.`,
        evidence: `${calculation.length} تست محاسباتی و ${others.length} تست غیرمحاسباتی.`,
        sampleSize: calculation.length,
      });
    }
  }

  /* ۳) مبحثِ «مطمئن اما غلط» — مفهوم‌سازی خطرناک متمرکز */
  const confidence = analyzeConfidence(attempts);
  if (confidence.sufficient && confidence.dangerousByTopic && confidence.dangerousByTopic.count >= 4) {
    patterns.push({
      id: 'pattern-overconfidence',
      type: 'OVERCONFIDENCE',
      title: `در «${confidence.dangerousByTopic.topic}» اطمینان بالاست اما دقت پایین`,
      description: 'پاسخ‌های مطمئنِ غلط در این مبحث متمرکز شده‌اند؛ نشانهٔ مفهومی که باید دوباره ساخته شود.',
      evidence: `${confidence.dangerousByTopic.count} پاسخ مطمئنِ غلط (${confidence.dangerousByTopic.share}٪ کل پاسخ‌های مطمئنِ غلط).`,
      sampleSize: confidence.dangerousByTopic.count,
      relatedTopic: confidence.dangerousByTopic.topic,
    });
  }

  return patterns;
}

/* ────────────────────────── Insight Engine ────────────────────────── */

/*
 * تولید Insight از مدل تحلیلی — هر Insight دارای Evidence و Action است؛
 * هیچ متن ثابتی بدون پشتوانهٔ داده صادر نمی‌شود.
 */
export function generateInsights(model) {
  const insights = [];
  const { attempts, subjects, topics, weakness, practiceVsExam, errors, time, difficulty, confidence, unanswered, consistency, recency } = model;
  const fa = (value) => Math.round(value);

  /* ۱) مبحث ضعیف اول */
  const worst = weakness.critical[0] ?? weakness.review[0] ?? null;
  if (worst && worst.attemptCount >= SAMPLE_THRESHOLDS.insightAttempts) {
    insights.push({
      id: 'weak-topic-top',
      type: 'WEAK_TOPIC',
      severity: worst.bucket === 'critical' ? 'warning' : 'notice',
      title: `«${worst.key}» در اولویت مرور است`,
      description: `دقت تو در این مبحث ${fa(worst.accuracy ?? 0)}٪ است؛ پایین‌تر از میانگین عملکرد خودت.`,
      evidence: `دقت در ${worst.attemptCount} تلاش اخیر: ${fa(worst.accuracy ?? 0)}٪ (${worst.wrongCount} پاسخ غلط).`,
      action: 'مرور درسنامه + ۱۵ تست هدفمند',
      relatedTopic: worst.key,
      relatedQuestions: worst.attempts.filter((a) => a.correct === false).slice(-6).map((a) => a.questionId),
    });
  }

  /* ۲) افت آزمونی نسبت به تمرینی */
  if (practiceVsExam.sufficient && practiceVsExam.accuracyDrop !== null && practiceVsExam.accuracyDrop >= 8) {
    insights.push({
      id: 'exam-drop',
      type: 'EXAM_DROP',
      severity: 'warning',
      title: 'عملکرد آزمونی‌ات از تمرینی‌ات پایین‌تر است',
      description: `دقت تو در تمرین‌ها ${fa(practiceVsExam.practice.accuracy)}٪ است اما در آزمون‌ها به ${fa(practiceVsExam.exam.accuracy)}٪ کاهش پیدا می‌کند.`,
      evidence: `${practiceVsExam.practice.answered} پاسخ تمرینی مقابل ${practiceVsExam.exam.answered} پاسخ آزمونی.`,
      action: 'تمرین در شرایط آزمون (تایمر + بدون وقفه)',
    });
  }

  /* ۳) تندیِ خطاخیز */
  if (errors.inferred.fastWrong >= 5) {
    insights.push({
      id: 'fast-wrong',
      type: 'CARELESS_SPEED',
      severity: 'notice',
      title: `${fa(errors.inferred.fastWrong)} تستِ تندِ غلط داری`,
      description: `این پاسخ‌ها زیر ۱۰ ثانیه داده شده‌اند؛ ${fa(errors.inferred.fastWrongShare)}٪ غلط‌هایت این الگو را دارند. احتمالاً بخشی از آن‌ها بی‌دقتی است.`,
      evidence: `زیر ۱۰ ثانیه پاسخ داده و غلط: ${fa(errors.inferred.fastWrong)} مورد.`,
      action: 'تمرین زمان‌دار با بازخورد فوری',
    });
  }

  /* ۴) افت در سخت‌ها */
  if (difficulty.sufficient && difficulty.gap !== null && difficulty.gap >= 20) {
    const easyRow = difficulty.rows.find((row) => row.difficulty === 'easy') ?? difficulty.rows[0];
    const hardRow = difficulty.rows.find((row) => row.difficulty === 'hard') ?? difficulty.rows[difficulty.rows.length - 1];
    insights.push({
      id: 'difficulty-gap',
      type: 'DIFFICULTY_DROP',
      severity: 'notice',
      title: 'در تست‌های سخت افت محسوسی داری',
      description: `عملکردت در تست‌های ${easyRow ? 'آسان‌تر' : ''} خوب است (${fa(easyRow?.accuracy ?? 0)}٪)، اما در سخت‌ها به ${fa(hardRow?.accuracy ?? 0)}٪ می‌رسد.`,
      evidence: `اختلاف دقت آسان تا سخت: ${fa(difficulty.gap)} واحد درصد.`,
      action: 'تمرین سطح سخت به‌صورت پله‌ای',
    });
  }

  /* ۵) مفهوم‌سازی خطرناک */
  if (confidence.sufficient && confidence.quadrants.confidentWrong >= 5) {
    insights.push({
      id: 'confident-wrong',
      type: 'DANGEROUS_MISCONCEPTION',
      severity: 'warning',
      title: 'چند مفهومِ «مطمئن اما غلط» داری',
      description: `${fa(confidence.quadrants.confidentWrong)} بار با اطمینان بالا پاسخ غلط داده‌ای؛ این الگو معمولاً نشانهٔ مفهوم اشتباه تثبیت‌شده است، نه ندانستن.`,
      evidence: `کالیبراسیون اطمینان: ${fa(confidence.calibration ?? 0)}٪ از پاسخ‌های مطمئن درست بوده‌اند.`,
      action: 'مرور تحلیل تشریحی این سؤال‌ها',
    });
  }

  /* ۶) بی‌پاسخ آزمونی */
  if (unanswered.inExams >= 6) {
    insights.push({
      id: 'exam-unanswered',
      type: 'TIME_PRESSURE',
      severity: 'notice',
      title: `${fa(unanswered.inExams)} سؤال آزمونی بی‌پاسخ مانده`,
      description: 'بی‌پاسخ‌های آزمون معمولاً نشانهٔ مدیریت زمان‌اند، نه ندانستن؛ زمان صرفِ سؤال‌های سخت این را تشدید می‌کند.',
      evidence: `${fa(unanswered.inExams)} بی‌پاسخ در آزمون‌ها (${fa(unanswered.share)}٪ کل تلاش‌ها).`,
      action: 'آزمونک زمان‌دار کوتاه',
    });
  }

  /* ۷) روند رشد */
  if (recency && recency.score !== null && recency.delta !== null && recency.delta >= 4) {
    insights.push({
      id: 'improving',
      type: 'IMPROVING',
      severity: 'positive',
      title: 'روند تو صعودی است',
      description: `دقت وزن‌شدهٔ نیمهٔ اخیر بازه، ${fa(recency.delta)} واحد بهتر از نیمهٔ اول است.`,
      evidence: `${fa(recency.samples)} پاسخ در این بازه تحلیل شد.`,
      action: 'همین ریتم را نگه دار',
    });
  }

  /* ۸) نوسان */
  if (consistency.score !== null && consistency.cv !== null && consistency.cv >= 0.32) {
    insights.push({
      id: 'inconsistent',
      type: 'INCONSISTENCY',
      severity: 'notice',
      title: 'عملکردت بین سشن‌ها نوسان دارد',
      description: `دقت سشن‌هایت بین مقادیر متفاوتی جابه‌جا می‌شود؛ ثبات، خودش یک مهارت آزمونی است.`,
      evidence: `ضریب تغییرپذیری دقت بین ${fa(consistency.sessions)} سشن: ${fa(consistency.cv * 100)}٪.`,
      action: 'تمرین منظم روزانه با حجم ثابت',
    });
  }

  /* ۹) بیشترین افت مبحثی */
  if (weakness.biggestDrop && weakness.biggestDrop.attemptCount >= SAMPLE_THRESHOLDS.insightAttempts) {
    insights.push({
      id: 'topic-drop',
      type: 'TOPIC_DECLINE',
      severity: 'warning',
      title: `بیشترین افت عملکردت مربوط به «${weakness.biggestDrop.key}» است`,
      description: `دقت این مبحث در نیمهٔ اخیر ${fa(weakness.biggestDrop.trend.delta)} واحد افت کرده است.`,
      evidence: `${weakness.biggestDrop.attemptCount} تلاش در این مبحث تحلیل شد.`,
      action: 'مرور این مبحث در اولویت است',
      relatedTopic: weakness.biggestDrop.key,
    });
  }

  /* ۱۰) کندی بیش از حد */
  if (time.sufficient && time.overtime.length >= 8) {
    insights.push({
      id: 'overtime',
      type: 'TIME_SINK',
      severity: 'notice',
      title: `${fa(time.overtime.length)} تست بیش از دو برابر زمان متعارف وقت گرفته`,
      description: 'زمان زیاد لزوماً به پاسخ درست نمی‌رسد؛ سؤال‌های زمان‌گیر باید در آزمون شناسایی و کنار گذاشته شوند.',
      evidence: `میانهٔ زمان تو ${fa(time.medianTime)} ثانیه است؛ کندترین‌ها تا ${fa(time.slowest)} ثانیه.`,
      action: 'تمرین تصمیم‌گیری زمان‌دار',
    });
  }

  const severityRank = { warning: 0, notice: 1, positive: 2 };
  return insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

/* ────────────────────────── تشخیص یادگیری ────────────────────────── */

export function diagnoseLearning(model) {
  const { topics, weakness, recency } = model;
  const measurable = topics.filter((topic) => topic.mastery.status !== 'NEEDS_DATA');

  const strongAreas = measurable
    .filter((topic) => topic.mastery.status === 'MASTERED' || topic.mastery.status === 'STRONG')
    .sort((a, b) => (b.mastery.score ?? 0) - (a.mastery.score ?? 0))
    .slice(0, 3);

  const weakAreas = weakness.critical.slice(0, 3);

  const atRiskAreas = measurable
    .filter((topic) => topic.trend.direction === 'down' && (topic.mastery.score ?? 100) < 75)
    .sort((a, b) => (a.trend.delta ?? 0) - (b.trend.delta ?? 0))
    .slice(0, 3);

  const needsReview = measurable
    .filter((topic) => topic.mastery.status === 'LEARNING' && topic.attemptCount >= 8)
    .sort((a, b) => (a.mastery.score ?? 0) - (b.mastery.score ?? 0))
    .slice(0, 3);

  const improvingAreas = measurable
    .filter((topic) => topic.trend.direction === 'up')
    .sort((a, b) => (b.trend.delta ?? 0) - (a.trend.delta ?? 0))
    .slice(0, 3);

  return {
    strongAreas,
    weakAreas,
    atRiskAreas,
    needsReview,
    improvingAreas,
    overallTrend: recency?.delta !== null && recency?.delta !== undefined ? (recency.delta >= 3 ? 'up' : recency.delta <= -3 ? 'down' : 'flat') : null,
  };
}

/* ────────────────────────── پیشنهادها ────────────────────────── */

/*
 * خروجی قابل‌اتصال به بقیهٔ تپش: هر پیشنهاد target و payload دارد تا بعداً
 * مستقیم به بانک تست/درسنامه/فلش‌کارت/آزمون‌ساز لینک شود.
 */
export function generateRecommendations(model) {
  const { weakness, errors, confidence, unanswered, practiceVsExam, difficulty, diagnosis } = model;
  const recommendations = [];

  /* ۱) مبحث ضعیف → مرور درسنامه */
  const worst = weakness.critical[0] ?? weakness.review[0] ?? null;
  if (worst) {
    recommendations.push({
      id: 'rec-review-lesson',
      type: 'REVIEW_LESSON',
      priority: 1,
      title: `مرور درسنامهٔ «${worst.key}»`,
      description: `دقت ${Math.round(worst.accuracy ?? 0)}٪ در ${worst.attemptCount} تلاش — پایین‌تر از میانگین خودت.`,
      actionLabel: 'شروع مرور',
      target: 'lesson',
      payload: { subjectId: worst.subjectId, topicPath: worst.key.split(' › ') },
    });
  }

  /* ۲) مبحث کم‌دقت → ۱۵ تست هدفمند */
  const lowAccuracy = weakness.all.find((topic) => (topic.accuracy ?? 100) < 65 && topic.attemptCount >= 8 && topic !== worst);
  if (lowAccuracy) {
    recommendations.push({
      id: 'rec-practice-15',
      type: 'PRACTICE_SET',
      priority: 2,
      title: `۱۵ تست از «${lowAccuracy.key}»`,
      description: 'حجم تمرین این مبحث هنوز برای تثبیت کافی نیست؛ یک ست کوتاه با بازخورد فوری.',
      actionLabel: 'شروع تمرین',
      target: 'practice',
      payload: { subjectId: lowAccuracy.subjectId, topicPath: lowAccuracy.key.split(' › '), count: 15 },
    });
  }

  /* ۳) خلأ دانشی → مطالعه مبحث */
  const knowledgeGap = errors.distribution.find((entry) => entry.type === 'KNOWLEDGE_GAP' && entry.share >= 25);
  if (knowledgeGap) {
    recommendations.push({
      id: 'rec-study-gap',
      type: 'STUDY_LESSON',
      priority: 2,
      title: 'مطالعهٔ مبحثِ دارای خلأ دانشی',
      description: `${knowledgeGap.share}٪ خطاهای ثبت‌شده‌ات از نوع «خلأ دانشی» است؛ این‌ها با تمرین حل نمی‌شوند، با مطالعه حل می‌شوند.`,
      actionLabel: 'مشاهده درسنامه',
      target: 'lesson',
      payload: {},
    });
  }

  /* ۴) خطای یادآوری → فلش‌کارت */
  const memoryFailure = errors.distribution.find((entry) => entry.type === 'MEMORY_FAILURE' && entry.count >= 3);
  if (memoryFailure) {
    recommendations.push({
      id: 'rec-flashcards',
      type: 'FLASHCARDS',
      priority: 3,
      title: 'مرور با فلش‌کارت',
      description: `${memoryFailure.count} خطای «یادآوری ناموفق» ثبت شده؛ مرور فاصله‌دار برای اطلاعات حافظه‌محور بهترین پاسخ است.`,
      actionLabel: 'باز کردن فلش‌کارت',
      target: 'flashcards',
      payload: {},
    });
  }

  /* ۵) بی‌دقتی → تمرین زمان‌دار */
  if (errors.inferred.fastWrong >= 5) {
    recommendations.push({
      id: 'rec-timed',
      type: 'TIMED_PRACTICE',
      priority: 2,
      title: 'تمرین زمان‌دار برای مهار بی‌دقتی',
      description: `${errors.inferred.fastWrong} پاسخ غلط زیر ۱۰ ثانیه؛ تمرین با تایمر ملایم ریتم تصمیم‌گیری را اصلاح می‌کند.`,
      actionLabel: 'شروع تمرین زمان‌دار',
      target: 'practice',
      payload: { timed: true },
    });
  }

  /* ۶) فشار زمان → آزمونک کوتاه */
  if (unanswered.inExams >= 5 || (practiceVsExam.exam.timePressure ?? 0) >= 8) {
    recommendations.push({
      id: 'rec-mini-exam',
      type: 'MINI_EXAM',
      priority: 2,
      title: 'آزمونک زمان‌دار کوتاه (۲۰ دقیقه)',
      description: 'برای تقویت مدیریت زمان آزمون؛ اول سؤال‌های مطمئن، بعد برگشت به زمان‌گیرها.',
      actionLabel: 'ساخت آزمونک',
      target: 'exam-builder',
      payload: { count: 10, durationMinutes: 20 },
    });
  }

  /* ۷) ضعف در سخت‌ها → تمرین پیشرفته */
  if (difficulty.sufficient && difficulty.gap !== null && difficulty.gap >= 22) {
    recommendations.push({
      id: 'rec-advanced',
      type: 'ADVANCED_PRACTICE',
      priority: 3,
      title: 'تمرین سطح سخت پله‌ای',
      description: `اختلاف دقت آسان تا سختت ${Math.round(difficulty.gap)} واحد است؛ سطح سختی را پله‌پله بالا ببر.`,
      actionLabel: 'تمرین سخت',
      target: 'practice',
      payload: { difficulties: ['hard', 'very_hard'] },
    });
  }

  /* ۸) نقطهٔ قوت → حفظ ریتم */
  if (diagnosis.strongAreas.length) {
    recommendations.push({
      id: 'rec-keep-strong',
      type: 'MAINTAIN_STRENGTH',
      priority: 4,
      title: `«${diagnosis.strongAreas[0].key}» را تازه نگه دار`,
      description: 'این مبحث قوی‌ترین نقطهٔ توست؛ هفته‌ای یک ست کوتاه برای حفظ تازگی کافی است.',
      actionLabel: 'تمرین کوتاه',
      target: 'practice',
      payload: { subjectId: diagnosis.strongAreas[0].subjectId, count: 8 },
    });
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}

/* ────────────────────────── مدل کامل ────────────────────────── */

/*
 * buildAnalyticsModel — یک‌جا کل زنجیرهٔ DATA→ANALYSIS→DIAGNOSIS را می‌سازد؛
 * سرویس این را صدا می‌زند و UI فقط مصرف می‌کند.
 */
export function buildAnalyticsModel(attempts) {
  const accuracy = calculateAccuracy(attempts);
  const performance = calculatePerformanceScore(attempts);
  const consistency = calculateConsistency(attempts);
  const recency = calculateRecency(attempts);
  const subjects = aggregateBySubject(attempts);
  const topics = aggregateByTopic(attempts);
  const weakness = detectWeakTopics(topics);
  const errors = analyzeErrors(attempts);
  const time = analyzeTime(attempts);
  const difficulty = analyzeDifficulty(attempts);
  const confidence = analyzeConfidence(attempts);
  const unanswered = analyzeUnanswered(attempts);
  const practiceVsExam = comparePracticeVsExam(attempts);
  const patterns = detectPatterns(attempts);

  const model = {
    attempts,
    accuracy,
    performance,
    consistency,
    recency,
    subjects,
    topics,
    weakness,
    errors,
    time,
    difficulty,
    confidence,
    unanswered,
    practiceVsExam,
    patterns,
  };

  const insights = generateInsights(model);
  const diagnosis = diagnoseLearning(model);
  const recommendations = generateRecommendations({ ...model, diagnosis });

  return { ...model, insights, diagnosis, recommendations };
}
