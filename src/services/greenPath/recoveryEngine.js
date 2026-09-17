/* موتور Recovery Plan.
 * جبران با ظرفیت محدود توزیع می‌شود؛ هیچ‌گاه کل Backlog به فردا پرتاب نمی‌شود. */
import { DEFAULT_PLANNING_CONFIG, RECOVERY_MODES, TASK_TYPES } from './greenPathConfig';
import { addDays, dateKey } from './schedulingEngine';

export function backlogFromTasks(tasks = [], now = new Date()) {
  return tasks
    .filter((task) => ['skipped', 'expired', 'failed'].includes(task.state) || (task.plannedDate < dateKey(now) && task.state !== 'completed'))
    .reduce((sum, task) => sum + task.durationMinutes, 0);
}

export function buildRecoveryPlan({
  tasks = [],
  profile,
  now = new Date(),
  mode = 'balanced',
  config = DEFAULT_PLANNING_CONFIG,
}) {
  const selected = RECOVERY_MODES[mode] ?? RECOVERY_MODES.balanced;
  const backlog = backlogFromTasks(tasks, now);
  const dailyCapacity = profile?.defaultDailyMinutes ?? 180;
  const maxExtraPerDay = Math.floor(dailyCapacity * Math.min(config.maxRecoveryRatio, selected.maxExtraRatio));
  const pending = tasks.filter((task) => task.state !== 'completed' && task.plannedDate >= dateKey(now)).sort((a, b) => b.priorityScore - a.priorityScore);
  const recoveryTasks = [];
  let remaining = backlog;

  for (let dayIndex = 0; dayIndex < 14 && remaining > 0; dayIndex += 1) {
    const date = dateKey(addDays(now, dayIndex + 1));
    const extraMinutes = Math.min(maxExtraPerDay, remaining);
    if (extraMinutes <= 0) continue;
    const anchor = pending[dayIndex % Math.max(1, pending.length)] ?? null;
    recoveryTasks.push({
      id: `recovery:${date}:${dayIndex}`,
      entityType: 'RecoveryTask',
      type: anchor?.type === TASK_TYPES.REVIEW && selected.preserveReview ? TASK_TYPES.REVIEW : TASK_TYPES.BUFFER,
      title: anchor ? `جبران ${anchor.topicTitle}` : 'جبران فعالیت‌های عقب‌افتاده',
      topicId: anchor?.topicId ?? null,
      plannedDate: date,
      durationMinutes: extraMinutes,
      sourceTaskId: anchor?.id ?? null,
      reason: selected.preserveReview
        ? 'جبران با حفظ مرورهای نزدیک و ظرفیت کنترل‌شده توزیع شده است.'
        : 'حالت سریع بخشی از مرور کم‌ریسک را برای جمع‌کردن عقب‌افتادگی فشرده می‌کند.',
    });
    remaining -= extraMinutes;
  }

  return {
    entityType: 'RecoveryPlan',
    mode,
    modeLabel: selected.label,
    status: backlog === 0 ? 'not-needed' : remaining === 0 ? 'planned' : 'capacity-limited',
    backlogMinutes: backlog,
    plannedRecoveryMinutes: recoveryTasks.reduce((sum, task) => sum + task.durationMinutes, 0),
    remainingMinutes: remaining,
    tasks: recoveryTasks,
    reason: backlog === 0
      ? 'در حال حاضر فعالیت عقب‌افتاده‌ای ثبت نشده است.'
      : `${backlog} دقیقه عقب‌افتادگی با سقف ${maxExtraPerDay} دقیقه اضافه در روز توزیع شد.`,
  };
}
