/* حلقهٔ بازخورد مسیر سبز: وضعیت واقعی را از برنامهٔ اولیه جدا می‌کند و
 * برای Recalculate توضیح قابل‌فهم می‌سازد. */
import { TASK_STATES } from './greenPathConfig';
import { backlogFromTasks } from './recoveryEngine';

const round = (value) => Math.round(value * 10) / 10;

export function assessAdaptation({ tasks = [], studySessions = [], now = new Date().toISOString() }) {
  const relevant = tasks.filter((task) => task.plannedDate <= now.slice(0, 10));
  const completed = relevant.filter((task) => task.state === TASK_STATES.COMPLETED);
  const plannedMinutes = relevant.reduce((sum, task) => sum + task.durationMinutes, 0);
  const actualMinutes = completed.reduce((sum, task) => sum + (task.actualMinutes ?? task.durationMinutes), 0) + studySessions
    .filter((session) => session.startedAt >= new Date(now).getTime() - 7 * 86400000)
    .reduce((sum, session) => sum + (session.actualMinutes ?? 0), 0);
  const completionRate = relevant.length ? round((completed.length / relevant.length) * 100) : null;
  const loadRatio = plannedMinutes ? round((actualMinutes / plannedMinutes) * 100) : null;
  const backlogMinutes = backlogFromTasks(tasks, new Date(now));
  const status = completionRate === null
    ? 'insufficient-data'
    : completionRate >= 85
      ? 'ahead'
      : completionRate >= 65
        ? 'on-track'
        : completionRate >= 45
          ? 'at-risk'
          : 'behind';

  return {
    entityType: 'AdaptiveAssessment',
    asOf: now,
    status,
    completionRate,
    plannedMinutes,
    actualMinutes,
    loadRatio,
    backlogMinutes,
    completedCount: completed.length,
    dueCount: relevant.length,
    shouldRecalculate: status === 'at-risk' || status === 'behind' || backlogMinutes > 0,
    explanation: status === 'ahead'
      ? 'نرخ تکمیل از برنامه جلوتر است؛ ظرفیت اضافه برای مرور عمیق یا استراحت حفظ می‌شود.'
      : status === 'on-track'
        ? 'ریتم اجرا با برنامه هم‌خوان است؛ اولویت‌های فعلی حفظ می‌شوند.'
        : status === 'insufficient-data'
          ? 'برای تصمیم تطبیقی هنوز دادهٔ کافی از فعالیت‌های امروز وجود ندارد.'
          : `به دلیل تکمیل ${completionRate ?? 0}٪ از فعالیت‌های سررسیدشده، برنامه باید دوباره محاسبه شود.`,
  };
}

export function buildAdaptiveTaskHints({ tasks = [], topicPerformance = [], assessment }) {
  const hints = [];
  if (!assessment) return hints;
  if (assessment.status === 'behind') {
    hints.push({ id: 'adaptive:reduce-low-priority', action: 'defer-low-priority', reason: 'فعالیت‌های کم‌اولویت باید از ظرفیت این هفته خارج شوند.' });
  }
  if (assessment.status === 'at-risk') {
    hints.push({ id: 'adaptive:protect-review', action: 'protect-review', reason: 'مرورهای نزدیک به ددلاین حذف نشوند.' });
  }

  topicPerformance
    .filter((entry) => entry.accuracy !== null && entry.accuracy < 50)
    .slice(0, 3)
    .forEach((entry) => {
      hints.push({
        id: `adaptive:weak:${entry.topicId}`,
        action: 'error-driven-cycle',
        topicId: entry.topicId,
        reason: 'دقت پایین، چرخهٔ درسنامه → ویکی → تست آموزشی → بازآزمایی را فعال می‌کند.',
      });
    });

  return hints;
}

export function applyAdaptiveTaskOrder(tasks = [], assessment, topicPerformance = []) {
  const weakIds = new Set(topicPerformance.filter((entry) => entry.accuracy !== null && entry.accuracy < 50).map((entry) => entry.topicId));
  return [...tasks].sort((a, b) => {
    const aWeak = weakIds.has(a.topicId) ? 1 : 0;
    const bWeak = weakIds.has(b.topicId) ? 1 : 0;
    const aReview = a.type === 'REVIEW' ? 1 : 0;
    const bReview = b.type === 'REVIEW' ? 1 : 0;
    if (assessment?.status === 'behind' && aReview !== bReview) return bReview - aReview;
    if (aWeak !== bWeak) return bWeak - aWeak;
    return b.priorityScore - a.priorityScore;
  });
}
