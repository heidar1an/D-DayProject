/* موتور اولویت‌دهی Task و Topic.
 * هر امتیاز همراه با دلیل ساخته می‌شود تا تصمیم برنامه‌ریز برای کاربر قابل توضیح بماند. */
import { DEFAULT_PLANNING_CONFIG, GOAL_PROFILES } from './greenPathConfig';
import { progressClamp, progressRound } from './progressEngine';

const daysUntil = (date, now) => Math.ceil((new Date(date).getTime() - new Date(now).getTime()) / 86400000);

const courseHasExam = (courseId, exams, graph) =>
  exams.some((exam) => (exam.courseIds ?? []).includes(courseId) || (exam.topicIds ?? []).some((topicId) => graph.topicById.get(topicId)?.courseId === courseId));

const nearestDeadline = (topic, deadlines = []) =>
  deadlines
    .filter((deadline) => !deadline.completed && (!deadline.topicIds?.length || deadline.topicIds.includes(topic.id)))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;

const examWeightFor = (topic, exams = [], graph, now) => {
  const matching = exams.filter((exam) => {
    if (exam.topicIds?.includes(topic.id)) return true;
    if (exam.courseIds?.includes(topic.courseId)) return true;
    return (exam.topics ?? []).some((label) => String(label).includes(graph.courseById.get(topic.courseId)?.title ?? '___'));
  });
  if (!matching.length) return 0.25;
  const highest = Math.max(...matching.map((exam) => {
    const days = Math.max(1, daysUntil(exam.date, now));
    return progressClamp((exam.importance ?? 0.7) * 100 + Math.max(0, 30 - days) * 1.5, 0, 100);
  }));
  return highest / 100;
};

export function calculateTopicPriority({
  topic,
  performance,
  graph,
  goals = [],
  exams = [],
  deadlines = [],
  now = new Date().toISOString(),
  config = DEFAULT_PLANNING_CONFIG,
}) {
  const weights = config.priorityWeights;
  const mastery = performance?.mastery ?? 0;
  const weakness = progressClamp(100 - mastery) / 100;
  const accuracyWeakness = performance?.accuracy === null || performance?.accuracy === undefined
    ? 0.65
    : progressClamp(100 - performance.accuracy) / 100;
  const weaknessScore = weakness * 0.65 + accuracyWeakness * 0.35;
  const deadline = nearestDeadline(topic, deadlines);
  const relevantExam = exams.find((exam) => exam.topicIds?.includes(topic.id) || exam.courseIds?.includes(topic.courseId));
  const urgentDate = deadline?.date ?? relevantExam?.date ?? null;
  const days = urgentDate ? Math.max(0, daysUntil(urgentDate, now)) : null;
  const urgency = days === null ? 0.28 : progressClamp(100 - days * 4.5) / 100;
  const examWeight = examWeightFor(topic, exams, graph, now);
  const goalRelevance = goals.reduce((sum, goal) => {
    const profile = GOAL_PROFILES[goal.kind] ?? GOAL_PROFILES.balanced;
    const basicScience = goal.kind.includes('basic') ? profile.relevance.basicSciences : profile.relevance.basicSciences * 0.7;
    const courseSignal = courseHasExam(topic.courseId, exams, graph) ? profile.relevance.exam : profile.relevance.semester;
    return sum + (goal.weight ?? 0) * ((basicScience + courseSignal) / 2);
  }, 0);
  const dependents = graph.topics.filter((candidate) => candidate.prerequisiteTopicIds.includes(topic.id));
  const unresolvedDependents = dependents.filter((candidate) => (candidate.mastery ?? 0) < 60).length;
  const dependency = progressClamp(unresolvedDependents * 22 + topic.importance * 5) / 100;
  const historicalError = performance?.attemptCount ? progressClamp((performance.errorCount / performance.attemptCount) * 100) / 100 : 0.5;
  const importance = progressClamp(topic.importance * 20) / 100;

  const score = progressRound(
    100 * (
      importance * weights.importance +
      urgency * weights.urgency +
      weaknessScore * weights.weakness +
      examWeight * weights.examWeight +
      Math.min(1, goalRelevance) * weights.goalRelevance +
      dependency * weights.dependency +
      historicalError * weights.historicalError
    ),
    1,
  );

  const reasons = [];
  if (weaknessScore >= 0.55) reasons.push(`تسلط فعلی ${progressRound(mastery)}٪ است`);
  if (accuracyWeakness >= 0.5 && performance?.accuracy !== null && performance?.accuracy !== undefined) reasons.push(`دقت تست ${progressRound(performance.accuracy)}٪ ثبت شده`);
  if (days !== null && days <= 14) reasons.push(`${days} روز تا نزدیک‌ترین ددلاین/آزمون مانده`);
  if (topic.importance >= 4) reasons.push('اهمیت محتوایی و آزمونی بالاست');
  if (unresolvedDependents > 0) reasons.push(`${unresolvedDependents} مبحث بعدی به این پیش‌نیاز وابسته است`);
  if (!reasons.length) reasons.push('برای حفظ ریتم هفتگی در صف برنامه قرار گرفته است');

  return {
    topicId: topic.id,
    score,
    factors: {
      importance: progressRound(importance * 100),
      urgency: progressRound(urgency * 100),
      weakness: progressRound(weaknessScore * 100),
      examWeight: progressRound(examWeight * 100),
      goalRelevance: progressRound(Math.min(1, goalRelevance) * 100),
      dependency: progressRound(dependency * 100),
      historicalError: progressRound(historicalError * 100),
    },
    reasons,
    nearestDeadline: urgentDate,
  };
}

export function buildPriorityQueue({ graph, topicPerformance, goals, exams, deadlines, now, config }) {
  const performanceById = new Map(topicPerformance.map((entry) => [entry.topicId, entry]));
  return graph.topics
    .map((topic) => ({
      topic,
      priority: calculateTopicPriority({
        topic,
        performance: performanceById.get(topic.id),
        graph,
        goals,
        exams,
        deadlines,
        now,
        config,
      }),
    }))
    .sort((a, b) => b.priority.score - a.priority.score || a.topic.order - b.topic.order);
}
