/* موتور زمان‌بندی ظرفیت‌محور مسیر سبز.
 * برنامه ۱۰۰٪ ظرفیت را پر نمی‌کند و هر جابه‌جایی قبل از اعمال، ظرفیت، ددلاین و
 * وابستگی را بررسی می‌کند. */
import { DEFAULT_PLANNING_CONFIG, TASK_STATES } from './greenPathConfig';

const DAY_MS = 86400000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const dateKeyOf = (value) => new Date(value).toISOString().slice(0, 10);
export const dateFromKey = (key) => new Date(`${key}T00:00:00.000Z`);
export const addDays = (value, amount) => new Date(new Date(value).getTime() + amount * DAY_MS);

export function buildCapacityMap({ profile, startDate, horizonDays = DEFAULT_PLANNING_CONFIG.horizonDays, config = DEFAULT_PLANNING_CONFIG }) {
  const capacityByWeekday = profile?.capacityByWeekday ?? { 0: 180, 1: 180, 2: 240, 3: 180, 4: 240, 5: 120, 6: 90 };
  const map = new Map();
  for (let index = 0; index < horizonDays; index += 1) {
    const date = addDays(startDate, index);
    const weekday = date.getUTCDay();
    const raw = Number(capacityByWeekday[weekday] ?? profile?.defaultDailyMinutes ?? 180);
    const effective = Math.max(0, Math.floor(raw * (1 - config.bufferRatio)));
    map.set(dateKeyOf(date), {
      date: dateKeyOf(date),
      weekday,
      rawMinutes: raw,
      plannedMinutes: 0,
      effectiveMinutes: effective,
      bufferMinutes: raw - effective,
      taskIds: [],
    });
  }
  return map;
}

const taskSort = (a, b) => b.priorityScore - a.priorityScore || new Date(a.dueDate ?? '2999-01-01') - new Date(b.dueDate ?? '2999-01-01');

function earliestAvailableDate({ candidate, capacityMap, topicDates, nowKey }) {
  const dependencyDates = (candidate.dependsOnTopicIds ?? []).map((id) => topicDates.get(id)).filter(Boolean);
  const dependencyDate = dependencyDates.length ? dependencyDates.sort().pop() : nowKey;
  const start = dateFromKey(dependencyDate) > dateFromKey(nowKey) ? addDays(dependencyDate, 1) : dateFromKey(nowKey);

  for (let index = 0; index < capacityMap.size; index += 1) {
    const key = dateKeyOf(addDays(start, index));
    const capacity = capacityMap.get(key);
    if (!capacity) continue;
    if (candidate.dueDate && key > dateKeyOf(candidate.dueDate)) break;
    if (capacity.plannedMinutes + candidate.durationMinutes <= capacity.effectiveMinutes) return key;
  }
  return null;
}

function makeTask(candidate, date, capacity, patch = {}) {
  const plannedStart = 9 * 60 + capacity.plannedMinutes;
  return {
    id: candidate.id,
    entityType: 'Task',
    type: candidate.type,
    sourceId: candidate.sourceId ?? null,
    sourceLabel: candidate.sourceLabel ?? candidate.type,
    sourceAccent: candidate.sourceAccent ?? 'var(--green-ink)',
    state: patch.state ?? TASK_STATES.PLANNED,
    title: candidate.title,
    courseId: candidate.courseId,
    topicId: candidate.topicId,
    topicTitle: candidate.topicTitle,
    phaseId: candidate.phaseId,
    plannedDate: patch.plannedDate ?? date,
    plannedStartMinute: patch.plannedStartMinute ?? plannedStart,
    durationMinutes: candidate.durationMinutes,
    priorityScore: candidate.priorityScore,
    priorityFactors: candidate.priorityFactors,
    deadline: candidate.dueDate ?? null,
    dependsOn: candidate.dependsOnTopicIds ?? [],
    resourceIds: candidate.resourceIds ?? [],
    reason: candidate.reason,
    metadata: candidate.metadata ?? {},
    actualMinutes: patch.actualMinutes ?? null,
    confidence: patch.confidence ?? null,
    difficulty: patch.difficulty ?? null,
    completedAt: patch.completedAt ?? null,
    createdAt: candidate.createdAt,
    updatedAt: new Date().toISOString(),
    rescheduledFrom: patch.rescheduledFrom ?? null,
  };
}

export function scheduleCandidates({
  candidates = [],
  profile,
  startDate = new Date(),
  horizonDays = DEFAULT_PLANNING_CONFIG.horizonDays,
  taskPatches = {},
  config = DEFAULT_PLANNING_CONFIG,
}) {
  const capacityMap = buildCapacityMap({ profile, startDate, horizonDays, config });
  const nowKey = dateKeyOf(startDate);
  const topicDates = new Map();
  const tasks = [];
  const unscheduled = [];

  [...candidates].sort(taskSort).forEach((candidate) => {
    const patch = taskPatches[candidate.id] ?? {};
    const requestedDate = patch.plannedDate ? dateKeyOf(patch.plannedDate) : null;
    let date = requestedDate && capacityMap.has(requestedDate) ? requestedDate : earliestAvailableDate({ candidate, capacityMap, topicDates, nowKey });

    if (!date) {
      unscheduled.push({ ...candidate, reason: [...(candidate.reason ?? []), 'ظرفیت این بازه برای این فعالیت کافی نبود'] });
      return;
    }

    const capacity = capacityMap.get(date);
    if (capacity.plannedMinutes + candidate.durationMinutes > capacity.effectiveMinutes) {
      const fallback = earliestAvailableDate({ candidate, capacityMap, topicDates, nowKey });
      if (fallback) date = fallback;
      else {
        unscheduled.push({ ...candidate, reason: [...(candidate.reason ?? []), 'تعارض ظرفیت'] });
        return;
      }
    }

    const finalCapacity = capacityMap.get(date);
    const patchWithState = requestedDate && requestedDate !== candidate.defaultDate
      ? { ...patch, state: patch.state ?? TASK_STATES.RESCHEDULED, rescheduledFrom: candidate.defaultDate }
      : patch;
    const task = makeTask(candidate, date, finalCapacity, patchWithState);
    finalCapacity.plannedMinutes += task.durationMinutes;
    finalCapacity.taskIds.push(task.id);
    tasks.push(task);

    if (!topicDates.has(candidate.topicId) || date < topicDates.get(candidate.topicId)) topicDates.set(candidate.topicId, date);
  });

  const byDate = [...capacityMap.values()]
    .map((entry) => ({
      ...entry,
      utilization: entry.effectiveMinutes ? Math.round((entry.plannedMinutes / entry.effectiveMinutes) * 100) : 0,
      tasks: tasks.filter((task) => task.plannedDate === entry.date).sort((a, b) => a.plannedStartMinute - b.plannedStartMinute),
    }))
    .filter((entry) => entry.tasks.length || entry.date === nowKey);

  const scheduledMinutes = tasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  const capacityMinutes = [...capacityMap.values()].reduce((sum, entry) => sum + entry.effectiveMinutes, 0);

  return {
    tasks: tasks.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.plannedStartMinute - b.plannedStartMinute),
    byDate,
    unscheduled,
    capacity: {
      totalMinutes: capacityMinutes,
      scheduledMinutes,
      remainingMinutes: Math.max(0, capacityMinutes - scheduledMinutes),
      utilization: capacityMinutes ? Math.round((scheduledMinutes / capacityMinutes) * 100) : 0,
      bufferRatio: config.bufferRatio,
    },
  };
}

export function detectScheduleConflicts(tasks = [], events = []) {
  const conflicts = [];
  const grouped = new Map();
  tasks.forEach((task) => {
    const key = task.plannedDate;
    const list = grouped.get(key) ?? [];
    list.push(task);
    grouped.set(key, list);
  });

  grouped.forEach((list, date) => {
    const sorted = [...list].sort((a, b) => a.plannedStartMinute - b.plannedStartMinute);
    sorted.forEach((task, index) => {
      const end = task.plannedStartMinute + task.durationMinutes;
      const next = sorted[index + 1];
      if (next && end > next.plannedStartMinute) {
        conflicts.push({ type: 'capacity', date, taskIds: [task.id, next.id], message: 'دو فعالیت روی هم افتاده‌اند.' });
      }
      events.filter((event) => event.date === date && event.startMinute !== null).forEach((event) => {
        const eventEnd = event.startMinute + (event.durationMinutes ?? 0);
        if (task.plannedStartMinute < eventEnd && end > event.startMinute) {
          conflicts.push({ type: event.type ?? 'calendar', date, taskIds: [task.id], eventId: event.id, message: `تعارض با ${event.title}` });
        }
      });
    });
  });

  return conflicts;
}

export function previewReschedule({ tasks = [], taskId, newDate, profile, config = DEFAULT_PLANNING_CONFIG, deadlines = [] }) {
  const target = tasks.find((task) => task.id === taskId);
  if (!target) return { canMove: false, reason: 'فعالیت پیدا نشد', conflicts: [] };
  const key = dateKeyOf(newDate);
  const capacityMap = buildCapacityMap({ profile, startDate: new Date(), horizonDays: config.horizonDays, config });
  const day = capacityMap.get(key);
  const occupied = tasks.filter((task) => task.id !== taskId && task.plannedDate === key).reduce((sum, task) => sum + task.durationMinutes, 0);
  const deadline = target.deadline && key > dateKeyOf(target.deadline);
  const dependencyConflict = (target.dependsOn ?? []).some((topicId) => {
    const dependencyTask = tasks.find((task) => task.topicId === topicId);
    return dependencyTask && dependencyTask.plannedDate >= key;
  });
  const conflicts = [];
  if (!day) conflicts.push({ type: 'range', message: 'این تاریخ داخل افق برنامه نیست.' });
  if (day && occupied + target.durationMinutes > day.effectiveMinutes) conflicts.push({ type: 'capacity', message: 'ظرفیت مؤثر این روز کافی نیست.' });
  if (deadline) conflicts.push({ type: 'deadline', message: 'این جابه‌جایی از ددلاین فعالیت عبور می‌کند.' });
  if (dependencyConflict) conflicts.push({ type: 'dependency', message: 'یکی از پیش‌نیازها بعد از این فعالیت قرار می‌گیرد.' });

  const backlogImpact = key === target.plannedDate ? 0 : target.durationMinutes;
  const remainingTasks = tasks.filter((task) => task.id !== taskId && task.plannedDate === target.plannedDate);
  return {
    canMove: conflicts.length === 0,
    target,
    newDate: key,
    conflicts,
    impact: {
      backlogMinutes: backlogImpact,
      compressedReviewMinutes: target.type === 'REVIEW' && conflicts.length === 0 ? target.durationMinutes : 0,
      affectedDeadline: deadline ? target.deadline : null,
      displacedTaskIds: remainingTasks.filter((task) => task.plannedStartMinute >= target.plannedStartMinute).map((task) => task.id),
    },
  };
}

export const taskMinutes = (tasks) => tasks.reduce((sum, task) => sum + task.durationMinutes, 0);
export const dateKey = dateKeyOf;
