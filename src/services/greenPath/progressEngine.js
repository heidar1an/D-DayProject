/*
 * موتور پیشرفت و Mastery مسیر سبز.
 *
 * اصل مهم: Mastery با تعداد Taskهای انجام‌شده یکی نیست. پوشش، دقت تست، مرور،
 * تازگی فعالیت و اطمینان کاربر با هم دیده می‌شوند و دادهٔ ناموجود null می‌ماند.
 */
import { DEFAULT_PLANNING_CONFIG } from './greenPathConfig';
import { curriculumNormalize } from './curriculumEngine';

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const daysBetween = (from, to) => Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 86400000);

const topicMatchesAttempt = (topic, attempt) => {
  const path = (attempt.topicPath ?? []).map(curriculumNormalize);
  const wanted = topic.path.map(curriculumNormalize);
  if (!path.length || !wanted.length) return false;
  return wanted.every((part) => path.some((candidate) => candidate === part || candidate.includes(part) || part.includes(candidate)));
};

const defaultTopicPerformance = (topic) => ({
  entityType: 'TopicPerformance',
  topicId: topic.id,
  courseId: topic.courseId,
  completion: 0,
  accuracy: null,
  attemptCount: 0,
  correctCount: 0,
  errorCount: 0,
  reviewCount: 0,
  confidence: null,
  lastStudyAt: null,
  lastReviewAt: null,
  retentionEstimate: null,
  mastery: 0,
});

/* توجه: هم‌نامی با تابع صادرشدهٔ پایین‌تر ممنوع است — دو اعلان تابع هم‌نام در
   سطح ماژول خطای سینتکسی ESM می‌دهد و کل درخت React را خالی می‌کند. */
function buildTopicPerformanceForTopic(topic, attempts, taskPatches, now) {
  const matched = attempts.filter((attempt) => topicMatchesAttempt(topic, attempt));
  const answered = matched.filter((attempt) => attempt.correct !== null && attempt.correct !== undefined);
  const correctCount = answered.filter((attempt) => attempt.correct === true).length;
  const accuracy = answered.length ? round((correctCount / answered.length) * 100, 1) : null;
  const taskEntries = Object.entries(taskPatches ?? {}).filter(([, patch]) => patch.topicId === topic.id);
  const learningTasks = taskEntries.filter(([, patch]) => patch.type === 'LEARN' || patch.type === 'PRACTICE' || patch.type === 'TEST');
  const completedTasks = learningTasks.filter(([, patch]) => patch.state === 'completed').length;
  const completion = learningTasks.length ? clamp((completedTasks / learningTasks.length) * 100) : 0;
  const reviewCount = taskEntries.filter(([, patch]) => patch.type === 'REVIEW' && patch.state === 'completed').length;
  const lastAttemptAt = matched.map((attempt) => attempt.timestamp).filter(Boolean).sort().pop() ?? null;
  const lastStudyAt = taskEntries
    .map(([, patch]) => patch.completedAt ?? patch.updatedAt ?? null)
    .filter(Boolean)
    .sort()
    .pop() ?? null;
  const confidenceValues = taskEntries.map(([, patch]) => Number(patch.confidence)).filter(Number.isFinite);
  const confidence = confidenceValues.length ? round((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) * 20, 1) : null;
  const recency = lastStudyAt ? clamp(100 - daysBetween(lastStudyAt, now) * 8) : 0;
  const testScore = accuracy ?? 0;
  const reviewScore = clamp(reviewCount * 25);
  const confidenceScore = confidence ?? 50;
  const mastery = round(
    clamp(completion * 0.25 + testScore * 0.35 + reviewScore * 0.15 + recency * 0.15 + confidenceScore * 0.1),
  );

  return {
    ...defaultTopicPerformance(topic),
    completion: round(completion),
    accuracy,
    attemptCount: matched.length,
    correctCount,
    errorCount: answered.length - correctCount,
    reviewCount,
    confidence,
    lastStudyAt,
    lastReviewAt: reviewCount ? lastStudyAt : null,
    retentionEstimate: mastery ? round(clamp(mastery * 0.92 + recency * 0.08)) : null,
    mastery,
  };
}

export function buildTopicPerformance({ graph, attempts = [], taskPatches = {}, now = new Date().toISOString() }) {
  return graph.topics.map((topic) => buildTopicPerformanceForTopic(topic, attempts, taskPatches, now));
}

const weightedAverage = (entries, valueOf, weightOf = () => 1) => {
  const usable = entries.filter((entry) => Number.isFinite(valueOf(entry)));
  const totalWeight = usable.reduce((sum, entry) => sum + Math.max(0, weightOf(entry)), 0);
  return totalWeight ? usable.reduce((sum, entry) => sum + valueOf(entry) * weightOf(entry), 0) / totalWeight : null;
};

export function buildCourseProgress({ graph, topicPerformance }) {
  const performanceById = new Map(topicPerformance.map((entry) => [entry.topicId, entry]));
  return graph.courses.map((course) => {
    const topics = course.topicIds.map((topicId) => graph.topicById.get(topicId)).filter(Boolean);
    const entries = topics.map((topic) => performanceById.get(topic.id)).filter(Boolean);
    const weightOf = (entry) => graph.topicById.get(entry.topicId)?.weight ?? 1;
    return {
      entityType: 'CourseProgress',
      courseId: course.id,
      title: course.title,
      topicCount: topics.length,
      completedTopics: entries.filter((entry) => entry.completion >= 80).length,
      coverage: round(weightedAverage(entries, (entry) => entry.completion, weightOf) ?? 0),
      mastery: round(weightedAverage(entries, (entry) => entry.mastery, weightOf) ?? 0),
      accuracy: weightedAverage(entries, (entry) => entry.accuracy, weightOf),
      testing: round(weightedAverage(entries, (entry) => entry.attemptCount ? clamp(entry.attemptCount * 12) : 0, weightOf) ?? 0),
      reviewCount: entries.reduce((sum, entry) => sum + entry.reviewCount, 0),
      weakTopics: entries.filter((entry) => entry.mastery < 45 || (entry.accuracy !== null && entry.accuracy < 50)).map((entry) => entry.topicId),
    };
  });
}

const courseIdFromLabel = (label, graph) => {
  const wanted = curriculumNormalize(label);
  return graph.courses.find((course) => {
    const title = curriculumNormalize(course.title);
    return title === wanted || title.includes(wanted) || wanted.includes(title);
  })?.id ?? null;
};

export function buildExamReadiness({ exams = [], graph, topicPerformance, now = new Date().toISOString(), config = DEFAULT_PLANNING_CONFIG }) {
  const performanceByCourse = new Map(buildCourseProgress({ graph, topicPerformance }).map((entry) => [entry.courseId, entry]));
  const performanceByTopic = new Map(topicPerformance.map((entry) => [entry.topicId, entry]));

  return exams.map((exam) => {
    const examCourseIds = [...new Set((exam.topics ?? []).map((label) => courseIdFromLabel(label, graph)).filter(Boolean))];
    const relevantTopics = topicPerformance.filter((entry) => examCourseIds.includes(entry.courseId));
    const coverage = relevantTopics.length
      ? round((relevantTopics.filter((entry) => entry.completion >= 60).length / relevantTopics.length) * 100)
      : round(weightedAverage(examCourseIds.map((id) => performanceByCourse.get(id)).filter(Boolean), (entry) => entry.coverage) ?? 0);
    const accuracy = weightedAverage(relevantTopics, (entry) => entry.accuracy);
    const revision = relevantTopics.length ? round((relevantTopics.filter((entry) => entry.reviewCount > 0).length / relevantTopics.length) * 100) : 0;
    const volume = relevantTopics.length ? round((relevantTopics.reduce((sum, entry) => sum + entry.attemptCount, 0) / (relevantTopics.length * 4)) * 100) : 0;
    const readiness = round(
      coverage * config.readinessWeights.coverage +
        (accuracy ?? 0) * config.readinessWeights.accuracy +
        revision * config.readinessWeights.revision +
        clamp(volume) * config.readinessWeights.volume,
    );
    const daysRemaining = Math.ceil(daysBetween(now, exam.date));

    return {
      entityType: 'ExamReadiness',
      examId: exam.id,
      title: exam.title,
      date: exam.date,
      daysRemaining,
      coverage,
      accuracy,
      revision,
      practiceVolume: volume,
      readiness,
      risk: daysRemaining <= 7 && readiness < 65 ? 'high' : daysRemaining <= 14 && readiness < 70 ? 'medium' : 'low',
      riskAreas: relevantTopics.filter((entry) => entry.mastery < 45 || (entry.accuracy !== null && entry.accuracy < 50)).slice(0, 4).map((entry) => entry.topicId),
    };
  });
}

export function buildOverallProgress({ courseProgress, topicPerformance, roadmap = null }) {
  const coverage = weightedAverage(courseProgress, (entry) => entry.coverage, (entry) => entry.topicCount) ?? 0;
  const mastery = weightedAverage(courseProgress, (entry) => entry.mastery, (entry) => entry.topicCount) ?? 0;
  const testedTopics = topicPerformance.filter((entry) => entry.attemptCount > 0).length;
  const reviewCount = topicPerformance.reduce((sum, entry) => sum + entry.reviewCount, 0);
  const taskProgress = roadmap?.tasks?.length
    ? (roadmap.tasks.filter((task) => task.state === 'completed').length / roadmap.tasks.length) * 100
    : 0;

  return {
    entityType: 'ProgressSummary',
    coverage: round(coverage),
    mastery: round(mastery),
    testedTopics,
    reviewCount,
    taskCompletion: round(taskProgress),
    overall: round(coverage * 0.35 + mastery * 0.4 + taskProgress * 0.25),
  };
}

export function buildRiskSignals({ courseProgress, topicPerformance, examReadiness, backlogMinutes = 0, now = new Date().toISOString() }) {
  const risks = [];
  courseProgress
    .filter((course) => course.coverage < 35 || course.mastery < 40)
    .slice(0, 4)
    .forEach((course) => {
      risks.push({
        id: `course-risk:${course.courseId}`,
        type: 'Academic Risk',
        severity: course.coverage < 20 ? 'high' : 'medium',
        title: course.title,
        reason: `پوشش ${round(course.coverage)}٪ و تسلط ${round(course.mastery)}٪ است.` ,
        action: 'یک مبحث با اولویت بالا را از برنامه امروز شروع کن.',
      });
    });

  examReadiness
    .filter((exam) => exam.risk !== 'low')
    .slice(0, 3)
    .forEach((exam) => {
      risks.push({
        id: `exam-risk:${exam.examId}`,
        type: 'Exam Risk',
        severity: exam.risk,
        title: exam.title,
        reason: `${exam.daysRemaining} روز تا آزمون و آمادگی ${exam.readiness}٪ باقی مانده است.`,
        action: 'مباحث ضعیف آزمون را در برنامه این هفته جلو بیاور.',
      });
    });

  if (backlogMinutes > 0) {
    risks.push({
      id: 'backlog-risk',
      type: 'Backlog Risk',
      severity: backlogMinutes > 240 ? 'high' : 'medium',
      title: 'عقب‌افتادگی برنامه',
      reason: `${backlogMinutes} دقیقه فعالیت انجام‌نشده باقی مانده است.`,
      action: 'از Recovery Plan متعادل استفاده کن؛ همه را به فردا منتقل نکن.',
    });
  }

  topicPerformance
    .filter((entry) => entry.accuracy !== null && entry.accuracy < 50)
    .slice(0, 4)
    .forEach((entry) => {
      risks.push({
        id: `weak-topic:${entry.topicId}`,
        type: 'Weak Topic Risk',
        severity: entry.accuracy < 35 ? 'high' : 'medium',
        title: entry.topicId,
        reason: `دقت اخیر ${entry.accuracy}٪ در ${entry.attemptCount} تلاش ثبت شده است.`,
        action: 'مرور درسنامه، ویکی و تست آموزشی را قبل از تست زمان‌دار انجام بده.',
      });
    });

  return risks.slice(0, 8);
}

export const progressClamp = clamp;
export const progressRound = round;
