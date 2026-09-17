/* قلب برنامه‌ریزی: تبدیل وضعیت تحصیلی، هدف، گراف و ددلاین به Roadmap و Candidate Task. */
import { DEFAULT_PLANNING_CONFIG, GOAL_PROFILES, GREEN_PATH_SECTIONS, PHASE_META, SECTION_BY_TASK_TYPE, TASK_TYPES } from './greenPathConfig';
import { buildPriorityQueue } from './priorityEngine';
import { scheduleCandidates } from './schedulingEngine';
import { buildResourcesForTopic } from './resourceEngine';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value) => Math.round(value * 10) / 10;
const addDays = (value, days) => new Date(new Date(value).getTime() + days * 86400000);
const dateKey = (value) => new Date(value).toISOString().slice(0, 10);

const nearestDeadline = (topic, deadlines = [], exams = []) => {
  const topicDeadlines = deadlines.filter((deadline) => !deadline.completed && (!deadline.topicIds?.length || deadline.topicIds.includes(topic.id)));
  const topicExams = exams.filter((exam) => (exam.topicIds ?? []).includes(topic.id) || (exam.courseIds ?? []).includes(topic.courseId));
  return [...topicDeadlines, ...topicExams].sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;
};

function activePhaseId({ currentWeek, totalWeeks, phaseOrder }) {
  const ratio = totalWeeks ? clamp(currentWeek / totalWeeks, 0, 1) : 0;
  const index = Math.min(phaseOrder.length - 1, Math.floor(ratio * phaseOrder.length));
  return phaseOrder[index] ?? phaseOrder[0] ?? 'foundation';
}

function buildPhases({ profile, goals, now, deadlines, exams }) {
  const selected = goals
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .map((goal) => GOAL_PROFILES[goal.kind] ?? GOAL_PROFILES.balanced);
  const order = [...new Set(selected.flatMap((goal) => goal.phaseOrder))];
  const totalWeeks = Math.max(1, profile.totalWeeks ?? 14);
  const currentWeek = clamp(profile.currentWeek ?? 1, 1, totalWeeks);
  const remainingWeeks = Math.max(1, totalWeeks - currentWeek + 1);
  const allocation = order.map((phaseId, index) => {
    const share = index === order.length - 1 ? 1 / Math.max(1, order.length) : (1 / Math.max(1, order.length)) * (index === 0 ? 1.2 : 0.9);
    return { phaseId, weeks: Math.max(1, Math.round(remainingWeeks * share)) };
  });
  const phaseWeeksTotal = allocation.reduce((sum, item) => sum + item.weeks, 0);
  let cursorWeek = currentWeek;

  return allocation.map(({ phaseId, weeks }, index) => {
    const meta = PHASE_META[phaseId] ?? PHASE_META.foundation;
    const startWeek = cursorWeek;
    const endWeek = index === allocation.length - 1 ? totalWeeks : Math.min(totalWeeks, cursorWeek + Math.max(1, Math.round((weeks / phaseWeeksTotal) * remainingWeeks)) - 1);
    cursorWeek = endWeek + 1;
    const relatedExam = exams
      .filter((exam) => new Date(exam.date) >= new Date(now))
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;
    return {
      id: `phase:${phaseId}`,
      entityType: 'RoadmapPhase',
      phaseId,
      title: meta.title,
      label: meta.label,
      description: meta.description,
      order: index,
      status: currentWeek >= startWeek && currentWeek <= endWeek ? 'active' : currentWeek > endWeek ? 'completed' : 'upcoming',
      startWeek,
      endWeek,
      startDate: dateKey(addDays(now, Math.max(0, (startWeek - currentWeek) * 7))),
      endDate: dateKey(addDays(now, Math.max(0, (endWeek - currentWeek + 1) * 7 - 1))),
      nextExamId: relatedExam?.id ?? null,
      deadlineIds: deadlines.filter((deadline) => new Date(deadline.date) >= new Date(now)).slice(0, 3).map((deadline) => deadline.id),
    };
  });
}

function taskTemplate({ type, topic, course, priority, phase, resourceIds, dependencyTopicIds, dueDate, sequence, now, taskMix }) {
  const baseDuration = {
    [TASK_TYPES.LEARN]: topic.estimatedMinutes,
    [TASK_TYPES.REVIEW]: 18,
    [TASK_TYPES.PRACTICE]: Math.max(20, Math.min(45, topic.questionCount * 4 || 25)),
    [TASK_TYPES.TEST]: Math.max(18, Math.min(40, topic.questionCount * 3 || 20)),
    [TASK_TYPES.ANALYZE]: 18,
    [TASK_TYPES.READ_REFERENCE]: 24,
    [TASK_TYPES.WIKI_REVIEW]: 12,
    [TASK_TYPES.KNOWLEDGE_LINK]: 15,
  }[type] ?? 15;

  const typeLabel = {
    [TASK_TYPES.LEARN]: 'یادگیری',
    [TASK_TYPES.REVIEW]: 'مرور',
    [TASK_TYPES.PRACTICE]: 'تست آموزشی',
    [TASK_TYPES.TEST]: 'تست زمان‌دار',
    [TASK_TYPES.ANALYZE]: 'تحلیل تست',
    [TASK_TYPES.READ_REFERENCE]: 'مطالعه رفرنس',
    [TASK_TYPES.WIKI_REVIEW]: 'مرور ویکی',
    [TASK_TYPES.KNOWLEDGE_LINK]: 'اتصال شبکه دانش',
  }[type] ?? type;
  const resourceFor = (wantedType) => resourceIds.find((id) => id.includes(`:${wantedType}:`));

  return {
    id: `gp-task:${topic.id}:${type.toLowerCase()}:${sequence}`,
    type,
    sourceId: SECTION_BY_TASK_TYPE[type] ?? 'course-micro',
    sourceLabel: GREEN_PATH_SECTIONS[SECTION_BY_TASK_TYPE[type] ?? 'course-micro']?.label ?? typeLabel,
    sourceAccent: GREEN_PATH_SECTIONS[SECTION_BY_TASK_TYPE[type] ?? 'course-micro']?.accent ?? 'var(--green-ink)',
    title: `${typeLabel} ${course.title} — ${topic.title}`, 
    courseId: course.id,
    topicId: topic.id,
    topicTitle: topic.title,
    phaseId: phase.phaseId,
    durationMinutes: Math.max(12, Math.round(baseDuration)),
    priorityScore: round(priority.score * (0.75 + (taskMix[type] ?? 0.1))),
    priorityFactors: priority.factors,
    dueDate,
    dependsOnTopicIds: dependencyTopicIds,
    resourceIds: type === TASK_TYPES.READ_REFERENCE
      ? [resourceFor('reference')].filter(Boolean)
      : type === TASK_TYPES.WIKI_REVIEW
        ? [resourceFor('wiki')].filter(Boolean)
        : type === TASK_TYPES.KNOWLEDGE_LINK
          ? [resourceFor('knowledge_network')].filter(Boolean)
          : type === TASK_TYPES.PRACTICE || type === TASK_TYPES.TEST
            ? [resourceFor('question_bank')].filter(Boolean)
            : [resourceFor('micro_lesson'), resourceFor('comprehensive_lesson')].filter(Boolean),
    reason: [
      ...priority.reasons,
      type === TASK_TYPES.READ_REFERENCE ? 'اهمیت یا دشواری این مبحث مطالعه عمیق را توجیه می‌کند.' : null,
      type === TASK_TYPES.KNOWLEDGE_LINK ? 'این اتصال فقط به‌دلیل ارزش واقعی بین‌درسی پیشنهاد شده است.' : null,
    ].filter(Boolean),
    metadata: {
      action: type,
      timeBudget: baseDuration,
      explainability: priority,
    },
    defaultDate: dateKey(now),
    createdAt: now,
  };
}

function candidateTypesFor({ performance, topic, phaseId, knowledgeNodeId, profile }) {
  const mastery = performance?.mastery ?? 0;
  const accuracy = performance?.accuracy;
  const types = [];

  if (mastery < 45) types.push(TASK_TYPES.LEARN, TASK_TYPES.PRACTICE);
  else if (mastery < 72) types.push(TASK_TYPES.REVIEW, TASK_TYPES.PRACTICE);
  else types.push(TASK_TYPES.REVIEW);

  if (phaseId === 'foundation' || phaseId === 'recovery') types.unshift(TASK_TYPES.LEARN);
  if (phaseId === 'testing' || phaseId === 'final-review') types.push(TASK_TYPES.TEST, TASK_TYPES.ANALYZE);
  if (accuracy !== null && accuracy !== undefined && accuracy < 50) types.push(TASK_TYPES.WIKI_REVIEW, TASK_TYPES.READ_REFERENCE, TASK_TYPES.TEST);
  if (knowledgeNodeId && phaseId === 'integration') types.push(TASK_TYPES.KNOWLEDGE_LINK);

  const limit = profile?.currentWeek >= 9 ? 4 : 3;
  return [...new Set(types)].slice(0, limit);
}

function buildCandidates({ graph, priorityQueue, topicPerformance, resources, phases, goals, profile, deadlines, exams, now, config }) {
  const performanceById = new Map(topicPerformance.map((entry) => [entry.topicId, entry]));
  const resourceByTopic = new Map();
  resources.forEach((resource) => {
    const list = resourceByTopic.get(resource.topicId) ?? [];
    list.push(resource);
    resourceByTopic.set(resource.topicId, list);
  });
  const activePhase = phases.find((phase) => phase.status === 'active') ?? phases[0];
  const mainGoal = GOAL_PROFILES[goals[0]?.kind] ?? GOAL_PROFILES.balanced;
  const candidates = [];

  priorityQueue.slice(0, 18).forEach(({ topic, priority }, topicIndex) => {
    const course = graph.courseById.get(topic.courseId);
    if (!course) return;
    const phase = phases.find((candidate) => candidate.phaseId === (topicIndex < 6 ? activePhase.phaseId : phases[Math.min(phases.length - 1, Math.floor(topicIndex / 6))]?.phaseId)) ?? activePhase;
    const deadline = nearestDeadline(topic, deadlines, exams);
    const topicResources = resourceByTopic.get(topic.id) ?? [];
    const types = candidateTypesFor({
      performance: performanceById.get(topic.id),
      topic,
      phaseId: phase.phaseId,
      knowledgeNodeId: topic.knowledgeNodeId,
      profile,
    });
    types.forEach((type, actionIndex) => {
      const candidate = taskTemplate({
        type,
        topic,
        course,
        priority,
        phase,
        resourceIds: topicResources.map((resource) => resource.id),
        dependencyTopicIds: topic.prerequisiteTopicIds,
        dueDate: deadline?.date ?? dateKey(addDays(now, Math.min(config.horizonDays - 1, 14 + topicIndex))),
        sequence: actionIndex,
        now,
        taskMix: mainGoal.taskMix,
      });
      candidates.push(candidate);
    });
  });

  return candidates;
}

export function buildRoadmapModel({
  profile,
  goals,
  graph,
  topicPerformance,
  exams = [],
  deadlines = [],
  taskPatches = {},
  resources = [],
  now = new Date().toISOString(),
  config = DEFAULT_PLANNING_CONFIG,
}) {
  const phases = buildPhases({ profile, goals: [...goals], now, deadlines, exams });
  const priorityQueue = buildPriorityQueue({ graph, topicPerformance, goals, exams, deadlines, now, config });
  const candidates = buildCandidates({ graph, priorityQueue, topicPerformance, resources, phases, goals, profile, deadlines, exams, now, config });
  const schedule = scheduleCandidates({
    candidates,
    profile,
    startDate: new Date(now),
    horizonDays: config.horizonDays,
    taskPatches,
    config,
  });
  const milestones = buildMilestones({ profile, phases, exams, deadlines, now });

  return {
    entityType: 'Roadmap',
    id: `roadmap:${profile.userId}:${dateKey(now)}`,
    horizon: { start: dateKey(now), days: config.horizonDays, end: dateKey(addDays(now, config.horizonDays - 1)) },
    currentWeek: profile.currentWeek,
    totalWeeks: profile.totalWeeks,
    phases,
    milestones,
    priorityQueue,
    candidates,
    tasks: schedule.tasks,
    byDate: schedule.byDate,
    capacity: schedule.capacity,
    unscheduled: schedule.unscheduled,
    createdAt: now,
    updatedAt: now,
  };
}

function buildMilestones({ profile, phases, exams, deadlines, now }) {
  const planEnd = profile.planEnd ?? profile.semesterEnd;
  const list = [
    {
      id: 'milestone:semester-start',
      entityType: 'Milestone',
      title: 'شروع یا بازتنظیم مسیر',
      date: profile.semesterStart,
      type: 'semester',
      status: new Date(now) >= new Date(profile.semesterStart) ? 'completed' : 'upcoming',
    },
    {
      id: 'milestone:mid-coverage',
      entityType: 'Milestone',
      title: 'تکمیل ۵۰٪ مباحث ترم',
      date: dateKey(addDays(now, Math.max(7, Math.round((new Date(planEnd) - new Date(now)) / 86400000 / 2)))),
      type: 'coverage',
      status: 'upcoming',
    },
    {
      id: 'milestone:semester-end',
      entityType: 'Milestone',
      title: 'پایان ترم',
      date: planEnd,
      type: 'semester',
      status: 'upcoming',
    },
  ];
  exams.forEach((exam) => list.push({ id: `milestone:exam:${exam.id}`, entityType: 'Milestone', title: exam.title, date: exam.date, type: 'exam', examId: exam.id, status: 'upcoming' }));
  deadlines.forEach((deadline) => list.push({ id: `milestone:deadline:${deadline.id}`, entityType: 'Milestone', title: deadline.title, date: deadline.date, type: 'deadline', deadlineId: deadline.id, status: deadline.completed ? 'completed' : 'upcoming' }));
  return list.sort((a, b) => new Date(a.date) - new Date(b.date)).map((item, index) => ({ ...item, order: index, phaseId: phases.find((phase) => new Date(item.date) >= new Date(phase.startDate) && new Date(item.date) <= new Date(phase.endDate))?.phaseId ?? null }));
}

export const roadmapPhaseMeta = PHASE_META;
