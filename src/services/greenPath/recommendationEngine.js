/* پیشنهادهای داده‌محور مسیر سبز؛ خروجی همیشه همراه با reason و action است. */
import { TASK_TYPES } from './greenPathConfig';

export function buildRecommendations({ graph, topicPerformance = [], courseProgress = [], examReadiness = [], tasks = [], adaptation = null }) {
  const recommendations = [];
  const topicTitle = (topicId) => graph.topicById.get(topicId)?.title ?? topicId;

  topicPerformance
    .filter((entry) => entry.accuracy !== null && entry.accuracy < 50)
    .sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100))
    .slice(0, 3)
    .forEach((entry) => {
      recommendations.push({
        id: `recommendation:weak:${entry.topicId}`,
        type: 'error-driven',
        priority: 'high',
        title: `چرخهٔ جبران برای ${topicTitle(entry.topicId)}`,
        reason: `در ${entry.attemptCount} تلاش، دقت ${entry.accuracy}٪ ثبت شده است.`,
        action: 'مرور درسنامه → ویکی تپش → ۱۰ تست آموزشی → بازآزمایی',
        topicId: entry.topicId,
      });
    });

  examReadiness
    .filter((exam) => exam.daysRemaining >= 0 && exam.daysRemaining <= 14 && exam.readiness < 70)
    .slice(0, 2)
    .forEach((exam) => {
      recommendations.push({
        id: `recommendation:exam:${exam.examId}`,
        type: 'deadline',
        priority: exam.daysRemaining <= 7 ? 'high' : 'medium',
        title: `آمادگی برای ${exam.title}`,
        reason: `${exam.daysRemaining} روز مانده و پوشش فعلی ${exam.coverage}٪ است.`,
        action: 'مباحث پرریسک را جلو بیاور و تست زمان‌دار را حذف نکن.',
        examId: exam.examId,
      });
    });

  const underusedCourse = [...courseProgress].sort((a, b) => a.coverage - b.coverage)[0];
  if (underusedCourse && underusedCourse.coverage < 45) {
    recommendations.push({
      id: `recommendation:course:${underusedCourse.courseId}`,
      type: 'coverage',
      priority: 'medium',
      title: `یک گام کوچک در ${underusedCourse.title}`,
      reason: `پوشش این درس ${underusedCourse.coverage}٪ است و ظرفیت آن هنوز پایین‌تر از مسیر ترم است.`,
      action: 'امروز یک Micro Lesson کوتاه را قبل از تست انتخاب کن.',
      courseId: underusedCourse.courseId,
    });
  }

  const todayTasks = tasks.filter((task) => task.plannedDate === new Date().toISOString().slice(0, 10) && task.state !== 'completed');
  const todayMinutes = todayTasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  if (todayMinutes > 300) {
    recommendations.push({
      id: 'recommendation:capacity',
      type: 'capacity',
      priority: 'high',
      title: 'برنامه امروز فشرده است',
      reason: `${todayMinutes} دقیقه فعالیت برای امروز چیده شده؛ بخشی از ظرفیت باید Buffer بماند.`,
      action: 'یک فعالیت کم‌اولویت را به اولین ظرفیت آزاد منتقل کن.',
    });
  }

  if (adaptation?.status === 'behind' || adaptation?.status === 'at-risk') {
    recommendations.push({
      id: 'recommendation:adaptive',
      type: 'adaptive',
      priority: 'high',
      title: 'برنامه نیاز به بازتنظیم دارد',
      reason: adaptation.explanation,
      action: 'Recovery متعادل را فعال کن و مرورهای نزدیک را نگه دار.',
    });
  }

  const hasTest = tasks.some((task) => task.type === TASK_TYPES.TEST);
  if (!hasTest) {
    recommendations.push({
      id: 'recommendation:testing',
      type: 'testing',
      priority: 'medium',
      title: 'تست را وارد چرخه کن',
      reason: 'در افق فعلی Task زمان‌دار کافی برای سنجش انتقال یادگیری وجود ندارد.',
      action: 'بعد از مطالعه اولین مبحث، تست آموزشی و تحلیل را اجرا کن.',
    });
  }

  return recommendations.slice(0, 6);
}
