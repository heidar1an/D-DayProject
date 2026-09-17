/*
 * Facade سرویس مسیر سبز — تنها API مورد استفادهٔ UI.
 *
 * تعویض Mock Repository با API Repository در آینده با setGreenPathRepository انجام
 * می‌شود؛ امضای توابع UI و شکل Entityها ثابت می‌ماند.
 */
import { DEFAULT_PLANNING_CONFIG, TASK_STATES } from './greenPathConfig';
import { createGreenPathMockRepository } from './greenPathRepository';
import { previewReschedule } from './schedulingEngine';

let repository = createGreenPathMockRepository();

const resolveUserId = (userRef) => String(typeof userRef === 'string' ? userRef : userRef?.id ?? userRef?.phone ?? 'guest');

export function setGreenPathRepository(nextRepository) {
  if (!nextRepository || typeof nextRepository.getSnapshot !== 'function') throw new Error('INVALID_GREEN_PATH_REPOSITORY');
  repository = nextRepository;
  return repository;
}

export function getGreenPathRepository() {
  return repository;
}

export async function fetchGreenPathBundle(userRef, options = {}) {
  return repository.getSnapshot(userRef, options);
}

export async function recalculateGreenPath(userRef, options = {}) {
  trackGreenPathEvent('plan_recalculated', { userId: resolveUserId(userRef), reason: options.reason ?? 'manual' });
  return repository.getSnapshot(userRef, { ...options, recalculated: true });
}

export async function saveAcademicProfile(userRef, patch) {
  await repository.saveProfile(userRef, patch);
  trackGreenPathEvent('academic_profile_updated', { userId: resolveUserId(userRef), fields: Object.keys(patch ?? {}) });
  return repository.getSnapshot(userRef);
}

export async function saveGreenPathGoals(userRef, goals) {
  await repository.saveGoals(userRef, goals);
  trackGreenPathEvent('goal_updated', { userId: resolveUserId(userRef), goalCount: goals?.length ?? 0 });
  return repository.getSnapshot(userRef);
}

export async function completeGreenPathOnboarding(userRef, payload) {
  if (typeof repository.completeOnboarding === 'function') await repository.completeOnboarding(userRef, payload);
  else {
    await repository.saveProfile(userRef, payload.profilePatch ?? {});
    await repository.saveGoals(userRef, payload.goals ?? []);
    if (payload.deadline) await repository.addDeadline(userRef, payload.deadline);
  }
  trackGreenPathEvent('onboarding_completed', { userId: resolveUserId(userRef), goalCount: payload.goals?.length ?? 0 });
  return repository.getSnapshot(userRef);
}

export async function completeGreenPathTask(userRef, task, feedback = {}) {
  if (!task?.id) throw new Error('TASK_ID_REQUIRED');
  const actualMinutes = Number(feedback.actualMinutes ?? task.durationMinutes);
  const patch = {
    state: TASK_STATES.COMPLETED,
    actualMinutes: Number.isFinite(actualMinutes) ? Math.max(0, actualMinutes) : task.durationMinutes,
    confidence: feedback.confidence ?? null,
    difficulty: feedback.difficulty ?? null,
    completedAt: new Date().toISOString(),
  };
  await repository.patchTask(userRef, task, patch);
  await repository.saveStudySession(userRef, {
    id: `study:${task.id}:${Date.now()}`,
    taskId: task.id,
    topicId: task.topicId,
    startedAt: feedback.startedAt ?? Date.now() - patch.actualMinutes * 60000,
    endedAt: Date.now(),
    actualMinutes: patch.actualMinutes,
    source: 'green-path',
  });
  trackGreenPathEvent('task_completed', { userId: resolveUserId(userRef), taskId: task.id, actualMinutes: patch.actualMinutes });
  return repository.getSnapshot(userRef);
}

export async function updateGreenPathTask(userRef, task, patch) {
  if (!task?.id) throw new Error('TASK_ID_REQUIRED');
  await repository.patchTask(userRef, task, patch);
  trackGreenPathEvent('task_updated', { userId: resolveUserId(userRef), taskId: task.id, state: patch?.state ?? null });
  return repository.getSnapshot(userRef);
}

export async function previewGreenPathReschedule(snapshot, taskId, newDate) {
  return previewReschedule({
    tasks: snapshot?.roadmap?.tasks ?? [],
    taskId,
    newDate,
    profile: snapshot?.academicProfile,
    config: DEFAULT_PLANNING_CONFIG,
    deadlines: snapshot?.deadlines ?? [],
  });
}

export async function rescheduleGreenPathTask(userRef, snapshot, taskId, newDate) {
  const preview = await previewGreenPathReschedule(snapshot, taskId, newDate);
  if (!preview.canMove) return { preview, snapshot };
  const task = snapshot.roadmap.tasks.find((item) => item.id === taskId);
  await repository.patchTask(userRef, task, {
    plannedDate: preview.newDate,
    state: TASK_STATES.RESCHEDULED,
    rescheduledFrom: task.plannedDate,
  });
  trackGreenPathEvent('task_rescheduled', { userId: resolveUserId(userRef), taskId, from: task.plannedDate, to: preview.newDate });
  return { preview, snapshot: await repository.getSnapshot(userRef) };
}

export async function saveGreenPathStudySession(userRef, session) {
  await repository.saveStudySession(userRef, session);
  trackGreenPathEvent('study_session_completed', { userId: resolveUserId(userRef), taskId: session?.taskId ?? null });
  return repository.getSnapshot(userRef);
}

export async function addGreenPathDeadline(userRef, deadline) {
  await repository.addDeadline(userRef, deadline);
  trackGreenPathEvent('deadline_added', { userId: resolveUserId(userRef), deadlineId: deadline?.id ?? null });
  return repository.getSnapshot(userRef);
}

export async function setGreenPathRecoveryMode(userRef, mode) {
  await repository.setRecoveryMode(userRef, mode);
  trackGreenPathEvent('recovery_started', { userId: resolveUserId(userRef), mode });
  return repository.getSnapshot(userRef);
}

export function getCourseRoadmap(snapshot, courseId) {
  const course = snapshot?.curriculumGraph?.courses?.find((entry) => entry.id === courseId) ?? snapshot?.courses?.find((entry) => entry.courseId === courseId) ?? null;
  const topics = snapshot?.curriculumGraph?.topics?.filter((topic) => topic.courseId === courseId) ?? [];
  const topicIds = new Set(topics.map((topic) => topic.id));
  const topicPerformance = snapshot?.topicPerformance?.filter((entry) => topicIds.has(entry.topicId)) ?? [];
  const tasks = snapshot?.roadmap?.tasks?.filter((task) => task.courseId === courseId) ?? [];
  const progress = snapshot?.courses?.find((entry) => entry.courseId === courseId) ?? null;
  return { course, topics, topicPerformance, tasks, progress };
}

export function getTaskResources(snapshot, taskId) {
  const task = snapshot?.roadmap?.tasks?.find((item) => item.id === taskId);
  if (!task) return [];
  const ids = new Set(task.resourceIds ?? []);
  return (snapshot.resources ?? []).filter((resource) => ids.has(resource.id));
}

export function trackGreenPathEvent(name, payload = {}) {
  if (typeof console !== 'undefined' && console.debug) console.debug(`[green-path:track] ${name}`, payload);
}

export const GreenPathService = {
  fetchGreenPathBundle,
  recalculateGreenPath,
  saveAcademicProfile,
  saveGreenPathGoals,
  completeGreenPathOnboarding,
  completeGreenPathTask,
  updateGreenPathTask,
  previewGreenPathReschedule,
  rescheduleGreenPathTask,
  saveGreenPathStudySession,
  addGreenPathDeadline,
  setGreenPathRecoveryMode,
  getCourseRoadmap,
  getTaskResources,
  trackGreenPathEvent,
};

export default GreenPathService;
