/* Calendar projection مسیر سبز.
 * یک Event entity مشترک برای Task، Exam، Deadline، Milestone و Session؛ UI فقط
 * projection را می‌خواند و با sourceId تفکیک بصری بخش‌ها را نگه می‌دارد. */
import { GREEN_PATH_SECTIONS } from './greenPathConfig';
import { periodDateKey } from './periodEngine';

const DAY_MS = 86400000;
const addDays = (value, amount) => new Date(new Date(value).getTime() + amount * DAY_MS);
const dateKey = periodDateKey;
const monthStart = (value) => { const date = new Date(value); date.setUTCDate(1); return date; };
const monthEnd = (value) => new Date(Date.UTC(new Date(value).getUTCFullYear(), new Date(value).getUTCMonth() + 1, 0));
const sourceMeta = (sourceId) => GREEN_PATH_SECTIONS[sourceId] ?? GREEN_PATH_SECTIONS.milestone;

const event = ({ id, date, title, sourceId, kind, durationMinutes = 0, startMinute = null, state = null, entityId = null, metadata = {} }) => {
  const section = sourceMeta(sourceId);
  return {
    id,
    entityType: 'CalendarEvent',
    date: dateKey(date),
    title,
    sourceId: section.id,
    sourceLabel: section.label,
    sourceShortLabel: section.shortLabel,
    sourceGroup: section.group,
    accent: section.accent,
    kind,
    durationMinutes,
    startMinute,
    state,
    entityId,
    metadata,
  };
};

export function buildCalendarEvents({ roadmap, deadlines = [], exams = [], milestones = [], studySessions = [], recovery = null }) {
  const events = [];
  (roadmap?.tasks ?? []).forEach((task) => events.push(event({
    id: `calendar:task:${task.id}`,
    date: task.plannedDate,
    title: task.title,
    sourceId: task.sourceId ?? 'course-micro',
    kind: 'task',
    durationMinutes: task.durationMinutes,
    startMinute: task.plannedStartMinute,
    state: task.state,
    entityId: task.id,
    metadata: { topicId: task.topicId, phaseId: task.phaseId, reason: task.reason },
  })));
  deadlines.forEach((deadline) => events.push(event({
    id: `calendar:deadline:${deadline.id}`,
    date: deadline.date,
    title: deadline.title,
    sourceId: 'deadline',
    kind: 'deadline',
    state: deadline.completed ? 'completed' : 'planned',
    entityId: deadline.id,
    metadata: { importance: deadline.importance, examId: deadline.examId },
  })));
  exams.forEach((exam) => events.push(event({
    id: `calendar:exam:${exam.id}`,
    date: exam.date,
    title: exam.title,
    sourceId: exam.type === 'national' || exam.type === 'mock' ? 'coordinated-exam' : 'test-bank',
    kind: 'exam',
    durationMinutes: exam.durationMinutes ?? 0,
    state: exam.status,
    entityId: exam.id,
    metadata: { topicIds: exam.topicIds, courseIds: exam.courseIds, type: exam.type },
  })));
  milestones.forEach((milestone) => events.push(event({
    id: `calendar:milestone:${milestone.id}`,
    date: milestone.date,
    title: milestone.title,
    sourceId: milestone.type === 'exam' ? 'coordinated-exam' : 'milestone',
    kind: 'milestone',
    state: milestone.status,
    entityId: milestone.id,
    metadata: { phaseId: milestone.phaseId },
  })));
  (recovery?.tasks ?? []).forEach((task) => events.push(event({
    id: `calendar:recovery:${task.id}`,
    date: task.plannedDate,
    title: task.title,
    sourceId: task.type === 'REVIEW' ? 'course-comprehensive' : 'analytics',
    kind: 'recovery',
    durationMinutes: task.durationMinutes,
    state: 'planned',
    entityId: task.id,
    metadata: { reason: task.reason },
  })));
  studySessions.forEach((session) => events.push(event({
    id: `calendar:session:${session.id}`,
    date: session.startedAt,
    title: session.title ?? 'جلسهٔ مطالعه ثبت‌شده',
    sourceId: session.sourceId ?? 'analytics',
    kind: 'session',
    durationMinutes: session.actualMinutes ?? 0,
    state: 'completed',
    entityId: session.id,
    metadata: { taskId: session.taskId, topicId: session.topicId },
  })));
  return events.sort((a, b) => a.date.localeCompare(b.date) || (a.startMinute ?? 9999) - (b.startMinute ?? 9999));
}

export function buildCalendarMonth({ month, events = [], weekStartsOn = 6 }) {
  const anchor = monthStart(month);
  const firstWeekday = anchor.getUTCDay();
  const leading = (firstWeekday - weekStartsOn + 7) % 7;
  const firstCell = addDays(anchor, -leading);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstCell, index);
    const key = dateKey(date);
    return {
      date: key,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === anchor.getUTCMonth(),
      isToday: key === dateKey(new Date()),
      events: events.filter((entry) => entry.date === key),
    };
  });
  return { month: dateKey(anchor), days };
}

export function eventsForDate(events, date) {
  return events.filter((entry) => entry.date === date);
}

export function calendarSourceSummary(events = []) {
  return [...events.reduce((map, entry) => {
    const current = map.get(entry.sourceId) ?? { sourceId: entry.sourceId, label: entry.sourceLabel, accent: entry.accent, count: 0 };
    current.count += 1;
    map.set(entry.sourceId, current);
    return map;
  }, new Map()).values()].sort((a, b) => b.count - a.count);
}

export const calendarMonthStart = monthStart;
export const calendarMonthEnd = monthEnd;
