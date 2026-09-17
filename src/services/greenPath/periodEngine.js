/*
 * لایهٔ برنامه‌ریزی چندمقیاسی مسیر سبز.
 *
 * YearPlan تصمیم‌های بزرگ را نگه می‌دارد؛ MonthPlan و WeekPlan همان تصمیم را
 * به بازه‌های قابل‌مشاهده خرد می‌کنند. Taskهای جزئی فقط برای افق کوتاه ساخته
 * می‌شوند تا برنامهٔ یک‌ساله با عددسازی و پرکردن مصنوعی تقویم اشتباه نشود.
 */
import { PHASE_META } from './greenPathConfig';

const DAY_MS = 86400000;
const addDays = (value, amount) => new Date(new Date(value).getTime() + amount * DAY_MS);
const addMonths = (value, amount) => {
  const date = new Date(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
};
const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
const overlap = (startA, endA, startB, endB) => new Date(startA) <= new Date(endB) && new Date(endA) >= new Date(startB);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 10) / 10;

const monthFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', year: 'numeric' });
const shortMonthFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' });

const primaryTarget = (goals = [], metric) => {
  const targets = goals.flatMap((goal) => goal.targets ?? []).filter((target) => target.metric === metric && Number.isFinite(target.target));
  return targets.length ? Math.max(...targets.map((target) => target.target)) : null;
};

function phaseForRange(phases, start, end) {
  return phases.filter((phase) => overlap(start, end, phase.startDate, phase.endDate)).map((phase) => phase.phaseId);
}

function phaseLabel(phaseIds) {
  return phaseIds.map((phaseId) => PHASE_META[phaseId]?.label ?? phaseId).join('، ') || 'تنظیم و پایش';
}

function aggregateForRange({ tasks, milestones, exams, start, end }) {
  const scopedTasks = tasks.filter((task) => task.plannedDate >= dateKey(start) && task.plannedDate <= dateKey(end));
  const scopedMilestones = milestones.filter((milestone) => overlap(start, end, milestone.date, milestone.date));
  const scopedExams = exams.filter((exam) => overlap(start, end, exam.date, exam.date));
  const minutes = scopedTasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  const sourceCounts = scopedTasks.reduce((map, task) => {
    map[task.sourceId ?? task.type] = (map[task.sourceId ?? task.type] ?? 0) + 1;
    return map;
  }, {});
  return { tasks: scopedTasks, milestones: scopedMilestones, exams: scopedExams, plannedMinutes: minutes, taskCount: scopedTasks.length, sourceCounts };
}

function buildWeeks({ profile, phases, tasks, milestones, exams, goals, now }) {
  const start = new Date(profile.planStart ?? now);
  const end = new Date(profile.planEnd ?? addDays(start, 364));
  const totalWeeks = Math.max(1, Math.ceil((end - start) / (7 * DAY_MS)));
  const coverageTarget = primaryTarget(goals, 'coverage');
  return Array.from({ length: totalWeeks }, (_, index) => {
    const weekStart = addDays(start, index * 7);
    const weekEnd = new Date(Math.min(end.getTime(), addDays(weekStart, 6).getTime()));
    const phaseIds = phaseForRange(phases, weekStart, weekEnd);
    const aggregate = aggregateForRange({ tasks, milestones, exams, start: weekStart, end: weekEnd });
    const current = overlap(now, now, weekStart, weekEnd);
    const completed = weekEnd < new Date(now);
    const targetProgress = coverageTarget === null ? null : round(clamp(((index + 1) / totalWeeks) * coverageTarget, 0, coverageTarget));
    return {
      entityType: 'WeekPlan',
      id: `week:${dateKey(weekStart)}`,
      index: index + 1,
      startDate: dateKey(weekStart),
      endDate: dateKey(weekEnd),
      phaseIds,
      phaseLabel: phaseLabel(phaseIds),
      taskCount: aggregate.taskCount,
      plannedMinutes: aggregate.plannedMinutes,
      sourceCounts: aggregate.sourceCounts,
      milestoneIds: aggregate.milestones.map((milestone) => milestone.id),
      examIds: aggregate.exams.map((exam) => exam.id),
      targetCoverage: targetProgress,
      status: current ? 'current' : completed ? 'completed' : 'upcoming',
    };
  });
}

function buildMonths({ profile, phases, tasks, milestones, exams, goals, now }) {
  const start = new Date(profile.planStart ?? now);
  const end = new Date(profile.planEnd ?? addDays(start, 364));
  const totalMonths = Math.max(1, Math.min(12, Math.ceil((end - start) / (31 * DAY_MS))));
  const coverageTarget = primaryTarget(goals, 'coverage');
  return Array.from({ length: totalMonths }, (_, index) => {
    /* ماه‌ها از تاریخ شروع واقعی جلو می‌روند؛ شروع میان‌ماه باعث گم‌شدن نیمهٔ آخر سال نمی‌شود. */
    const monthStart = addMonths(start, index);
    const monthEnd = new Date(Math.min(end.getTime(), addDays(addMonths(start, index + 1), -1).getTime()));
    const phaseIds = phaseForRange(phases, monthStart, monthEnd);
    const aggregate = aggregateForRange({ tasks, milestones, exams, start: monthStart, end: monthEnd });
    const current = overlap(now, now, monthStart, monthEnd);
    const completed = monthEnd < new Date(now);
    const targetProgress = coverageTarget === null ? null : round(clamp(((index + 1) / Math.min(12, totalMonths)) * coverageTarget, 0, coverageTarget));
    const weeks = buildWeeks({ profile: { planStart: monthStart, planEnd: monthEnd }, phases, tasks, milestones, exams, goals, now });
    return {
      entityType: 'MonthPlan',
      id: `month:${dateKey(monthStart)}`,
      index: index + 1,
      startDate: dateKey(monthStart),
      endDate: dateKey(monthEnd),
      label: monthFormatter.format(monthStart),
      shortLabel: shortMonthFormatter.format(monthStart),
      phaseIds,
      phaseLabel: phaseLabel(phaseIds),
      focus: PHASE_META[phaseIds[0]]?.description ?? 'پیشروی بر اساس اولویت‌های واقعی مسیر.',
      taskCount: aggregate.taskCount,
      plannedMinutes: aggregate.plannedMinutes,
      sourceCounts: aggregate.sourceCounts,
      milestoneIds: aggregate.milestones.map((milestone) => milestone.id),
      examIds: aggregate.exams.map((exam) => exam.id),
      targetCoverage: targetProgress,
      status: current ? 'current' : completed ? 'completed' : 'upcoming',
      weeks,
    };
  });
}

export function buildYearPlan({ profile, goals = [], phases = [], tasks = [], milestones = [], exams = [], now = new Date().toISOString() }) {
  const start = new Date(profile.planStart ?? now);
  const end = new Date(profile.planEnd ?? addDays(start, 364));
  const months = buildMonths({ profile, phases, tasks, milestones, exams, goals, now });
  const weeks = buildWeeks({ profile, phases, tasks, milestones, exams, goals, now });
  const annualAggregate = aggregateForRange({ tasks, milestones, exams, start, end });
  return {
    entityType: 'YearPlan',
    id: `year:${dateKey(start)}`,
    startDate: dateKey(start),
    endDate: dateKey(end),
    label: `${monthFormatter.format(start)} تا ${monthFormatter.format(end)}`,
    horizonDays: Math.ceil((end - start) / DAY_MS) + 1,
    goalIds: goals.map((goal) => goal.id),
    phaseIds: phases.map((phase) => phase.phaseId),
    monthCount: months.length,
    weekCount: weeks.length,
    taskCount: annualAggregate.taskCount,
    plannedMinutes: annualAggregate.plannedMinutes,
    milestoneIds: annualAggregate.milestones.map((milestone) => milestone.id),
    examIds: annualAggregate.exams.map((exam) => exam.id),
    months,
    weeks,
  };
}

export function getMonthPlan(yearPlan, monthId) {
  return yearPlan?.months?.find((month) => month.id === monthId) ?? yearPlan?.months?.[0] ?? null;
}

export const periodDateKey = dateKey;
