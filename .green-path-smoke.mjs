import {
  buildCurriculumGraph,
  calculateTopicPriority,
  fetchGreenPathBundle,
  detectScheduleConflicts,
  previewGreenPathReschedule,
} from './src/services/greenPath/index.js';

const now = new Date('2026-09-17T08:00:00.000Z');
const graph = buildCurriculumGraph({ now: now.toISOString() });
if (!graph.courses.length || !graph.topics.length || !graph.edges.length) throw new Error('curriculum graph incomplete');
const snapshot = await fetchGreenPathBundle({ id: 'smoke-user', profile: { university: 'Test', term: 4 } }, { now });
if (!snapshot.roadmap.tasks.length) throw new Error('roadmap has no tasks');
if (!snapshot.dailyPlan || !snapshot.weeklyPlan) throw new Error('plans missing');
const priority = calculateTopicPriority({ topic: graph.topics[0], performance: snapshot.topicPerformance[0], graph, goals: snapshot.goals, exams: snapshot.exams, deadlines: snapshot.deadlines, now: now.toISOString() });
if (!Number.isFinite(priority.score) || !priority.reasons.length) throw new Error('priority not explainable');
const conflicts = detectScheduleConflicts(snapshot.roadmap.tasks, []);
if (!Array.isArray(conflicts)) throw new Error('conflicts missing');
const firstTask = snapshot.roadmap.tasks[0];
const preview = await previewGreenPathReschedule(snapshot, firstTask.id, `${firstTask.plannedDate}T00:00:00.000Z`);
if (!preview || typeof preview.canMove !== 'boolean') throw new Error('reschedule preview missing');
console.log(JSON.stringify({ courses: graph.courses.length, topics: graph.topics.length, edges: graph.edges.length, tasks: snapshot.roadmap.tasks.length, today: snapshot.dailyPlan.tasks.length, status: snapshot.status.code, priority: priority.score, conflicts: conflicts.length, preview: preview.canMove }));
