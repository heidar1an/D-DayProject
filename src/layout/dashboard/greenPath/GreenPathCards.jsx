import {
  ArrowIcon,
  CalendarIcon,
  CheckIcon,
  SectionHeader,
  SparkIcon,
  TargetIcon,
  TASK_TYPE_LABELS,
  courseAccent,
  formatDate,
  formatMinutes,
  resourceLabel,
  toFa,
} from './greenPathShared';

export function ResourceAction({ resource, onOpen }) {
  if (!resource) return null;
  return (
    <button type="button" className="gp-resource" style={{ '--gp-resource-accent': resource.accent }} onClick={() => onOpen?.(resource)} title={`باز کردن ${resource.title}`}>
      <span className="gp-resource__dot" aria-hidden="true" />
      <span>{resourceLabel(resource.type)}</span>
      <ArrowIcon className="gp-icon gp-icon--small" />
    </button>
  );
}

export function TaskCard({ task, resources = [], onComplete, onFocus, onOpenResource, onReschedule, compact = false }) {
  const isCompleted = task.state === 'completed';
  const reason = Array.isArray(task.reason) ? task.reason[0] : task.reason;
  return (
    <article className={`gp-task ${isCompleted ? 'is-completed' : ''} ${compact ? 'gp-task--compact' : ''}`} style={{ '--gp-course-accent': task.sourceAccent ?? courseAccent(task.courseId), '--gp-task-course-accent': courseAccent(task.courseId) }}>
      <div className="gp-task__rail" aria-hidden="true" />
      <div className="gp-task__main">
        <div className="gp-task__topline">
          <span className="gp-task__type">{TASK_TYPE_LABELS[task.type] ?? task.type}</span>
          <span className="gp-task__source">{task.sourceLabel ?? 'مسیر سبز'}</span>
          <span className="gp-task__duration">{formatMinutes(task.durationMinutes)}</span>
        </div>
        <h3>{task.title}</h3>
        {!compact && <p className="gp-task__reason">{reason ?? 'برای ادامه مسیر امروز پیشنهاد شده است.'}</p>}
        {!compact && (
          <div className="gp-task__meta">
            <span><CalendarIcon className="gp-icon gp-icon--small" /> {formatDate(task.plannedDate, { short: true })}</span>
            <span>اولویت {toFa(Math.round(task.priorityScore))}</span>
            {task.deadline && <span>ددلاین {formatDate(task.deadline, { short: true })}</span>}
          </div>
        )}
        {!compact && resources.length > 0 && (
          <div className="gp-task__resources" aria-label="منابع فعالیت">
            {resources.slice(0, 4).map((resource) => <ResourceAction key={resource.id} resource={resource} onOpen={onOpenResource} />)}
          </div>
        )}
      </div>
      <div className="gp-task__actions">
        {!isCompleted ? (
          <button type="button" className="gp-task__complete" onClick={() => onComplete?.(task)}><CheckIcon className="gp-icon" /> انجام شد</button>
        ) : (
          <span className="gp-task__done"><CheckIcon className="gp-icon" /> ثبت شد</span>
        )}
        {!compact && !isCompleted && (
          <div className="gp-task__secondary">
            <button type="button" onClick={() => onFocus?.(task)}>تمرکز</button>
            <button type="button" onClick={() => onReschedule?.(task)}>فردا</button>
          </div>
        )}
      </div>
    </article>
  );
}

export function CourseProgressCard({ course, onOpen }) {
  return (
    <button type="button" className="gp-course-card" style={{ '--gp-course-accent': courseAccent(course.courseId) }} onClick={() => onOpen?.(course.courseId)}>
      <span className="gp-course-card__head">
        <span className="gp-course-card__dot" aria-hidden="true" />
        <strong>{course.title}</strong>
        <ArrowIcon className="gp-icon gp-icon--small" />
      </span>
      <span className="gp-course-card__numbers"><span>{toFa(course.completedTopics)} / {toFa(course.topicCount)} مبحث</span><span>{course.accuracy === null ? '—' : `${toFa(Math.round(course.accuracy))}٪ دقت`}</span></span>
      <span className="gp-progress"><span style={{ width: `${course.coverage}%` }} /></span>
      <span className="gp-course-card__footer"><span>پوشش {toFa(Math.round(course.coverage))}٪</span><span>تسلط {toFa(Math.round(course.mastery))}٪</span></span>
    </button>
  );
}

export function Timeline({ phases = [], milestones = [], onOpenPhase }) {
  const visible = milestones.filter((milestone) => milestone.status !== 'completed').slice(0, 8);
  return (
    <section className="gp-panel gp-timeline-panel">
      <SectionHeader eyebrow="ROADMAP" title="نقشه راه ترم" description="هر نقطه یک تصمیم برنامه‌ریزی‌شده است، نه یک تزئین بصری." />
      <div className="gp-timeline" role="list" aria-label="خط زمانی مسیر">
        {phases.map((phase) => (
          <button type="button" key={phase.id} className={`gp-timeline__phase ${phase.status === 'active' ? 'is-active' : ''} ${phase.status === 'completed' ? 'is-completed' : ''}`} onClick={() => onOpenPhase?.(phase.phaseId)}>
            <span className="gp-timeline__node" aria-hidden="true" />
            <span className="gp-timeline__body"><strong>{phase.label}</strong><small>{phase.startDate} — {phase.endDate}</small><em>{phase.description}</em></span>
          </button>
        ))}
      </div>
      {visible.length > 0 && (
        <div className="gp-milestones" aria-label="نقاط عطف آینده">
          {visible.map((milestone) => (
            <div className="gp-milestone" key={milestone.id}>
              <span className={`gp-milestone__mark gp-milestone__mark--${milestone.type}`} aria-hidden="true"><TargetIcon className="gp-icon gp-icon--small" /></span>
              <span><strong>{milestone.title}</strong><small>{formatDate(milestone.date, { short: true })}</small></span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function DeadlineCard({ item, readiness }) {
  const entry = readiness?.find((candidate) => candidate.examId === item.examId);
  return (
    <article className={`gp-deadline gp-deadline--${entry?.risk ?? 'neutral'}`}>
      <div className="gp-deadline__icon"><CalendarIcon /></div>
      <div className="gp-deadline__body"><strong>{item.title}</strong><span>{formatDate(item.date)}</span>{entry && <small>آمادگی {toFa(Math.round(entry.readiness))}٪ · پوشش {toFa(Math.round(entry.coverage))}٪</small>}</div>
      {entry && <span className="gp-deadline__days">{entry.daysRemaining < 0 ? 'گذشته' : `${toFa(entry.daysRemaining)} روز`}</span>}
    </article>
  );
}

export function RiskCard({ risk }) {
  return (
    <article className={`gp-risk gp-risk--${risk.severity}`}>
      <div className="gp-risk__head"><span className="gp-risk__signal" aria-hidden="true" /><span>{risk.type}</span><strong>{risk.title}</strong></div>
      <p>{risk.reason}</p>
      <small>{risk.action}</small>
    </article>
  );
}

export function RecommendationCard({ recommendation }) {
  return (
    <article className={`gp-recommendation gp-recommendation--${recommendation.priority}`}>
      <span className="gp-recommendation__icon" aria-hidden="true"><SparkIcon /></span>
      <div><strong>{recommendation.title}</strong><p>{recommendation.reason}</p><small>گام بعدی: {recommendation.action}</small></div>
    </article>
  );
}

export function MiniMetric({ label, value, note, tone = 'green' }) {
  return <div className={`gp-mini-metric gp-mini-metric--${tone}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}
