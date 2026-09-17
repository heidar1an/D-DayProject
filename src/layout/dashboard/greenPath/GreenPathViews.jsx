import {
  ArrowIcon,
  CalendarIcon,
  EmptyState,
  ProgressRing,
  SectionHeader,
  StatusPill,
  TargetIcon,
  formatDate,
  formatMinutes,
  formatWeekday,
  toFa,
} from './greenPathShared';
import {
  CourseProgressCard,
  DeadlineCard,
  MiniMetric,
  RecommendationCard,
  ResourceAction,
  RiskCard,
  TaskCard,
  Timeline,
} from './GreenPathCards';

export function GreenPathOverview({ snapshot, onOpenOnboarding, onOpenCourse, onOpenTask, onComplete, onFocus, onOpenResource, onReschedule, onOpenPhase }) {
  const activePhase = snapshot.roadmap.phases.find((phase) => phase.status === 'active') ?? snapshot.roadmap.phases[0];
  const nextMilestone = snapshot.roadmap.milestones.find((milestone) => milestone.status !== 'completed' && new Date(milestone.date) >= new Date());
  const todayTasks = snapshot.dailyPlan.tasks ?? [];
  const upcomingDeadlines = snapshot.deadlines.filter((deadline) => !deadline.completed && new Date(deadline.date) >= new Date()).slice(0, 4);
  const examReadiness = snapshot.examReadiness.filter((exam) => exam.daysRemaining >= 0).slice(0, 3);
  const taskResources = (task) => (snapshot.resources ?? []).filter((resource) => (task.resourceIds ?? []).includes(resource.id));

  return (
    <div className="gp-view gp-overview">
      <section className="gp-hero">
        <div className="gp-hero__copy">
          <span className="gp-eyebrow">PERSONAL ACADEMIC OPERATING SYSTEM</span>
          <h1>مسیر تو تا مقصد</h1>
          <p>مسیر سبز وضعیت امروزت را با هدف، ظرفیت، عملکرد و ددلاین‌های واقعی ترکیب می‌کند تا بدانی قدم بعدی دقیقاً چیست.</p>
          <div className="gp-hero__actions"><button type="button" className="gp-button gp-button--primary" onClick={() => onOpenTask?.(todayTasks[0])} disabled={!todayTasks[0]}>شروع فعالیت بعدی <ArrowIcon /></button><button type="button" className="gp-button gp-button--ghost" onClick={onOpenOnboarding}>تنظیم مسیر</button></div>
        </div>
        <div className="gp-hero__position"><ProgressRing value={snapshot.progress.overall} label="پیشرفت مسیر" size={148} tone="green" /><div><StatusPill status={snapshot.status.code} /><strong>هفته {toFa(snapshot.academicProfile.currentWeek)} از {toFa(snapshot.academicProfile.totalWeeks)}</strong><span>{activePhase?.label ?? 'در حال تحلیل'}</span></div></div>
      </section>

      <section className="gp-overview-grid gp-overview-grid--metrics" aria-label="خلاصه وضعیت مسیر">
        <MiniMetric label="پوشش مباحث" value={`${toFa(snapshot.progress.coverage)}٪`} note="وزن‌دار بر اساس Topic" tone="blue" />
        <MiniMetric label="تسلط واقعی" value={`${toFa(snapshot.progress.mastery)}٪`} note="Completion ≠ Mastery" tone="purple" />
        <MiniMetric label="ظرفیت این هفته" value={formatMinutes(snapshot.weeklyPlan.plannedMinutes)} note={`${toFa(snapshot.roadmap.capacity.utilization)}٪ از ظرفیت مؤثر`} tone="green" />
        <MiniMetric label="مرورهای ثبت‌شده" value={toFa(snapshot.progress.reviewCount)} note="بازخورد وارد موتور شد" tone="gold" />
      </section>

      <section className="gp-panel gp-today-panel">
        <SectionHeader eyebrow="TODAY" title="امروز چه کار کنم؟" description={snapshot.status.reason} action={<span className="gp-date-chip"><CalendarIcon className="gp-icon gp-icon--small" /> {formatDate(snapshot.dailyPlan.date)}</span>} />
        <div className="gp-today-panel__goal"><TargetIcon className="gp-icon" /><span><strong>هدف امروز</strong><small>{activePhase?.description ?? 'یک گام واقعی در مسیرت بردار.'}</small></span></div>
        {todayTasks.length ? <div className="gp-task-list">{todayTasks.map((task) => <TaskCard key={task.id} task={task} resources={taskResources(task)} onComplete={onComplete} onFocus={onFocus} onOpenResource={onOpenResource} onReschedule={onReschedule} />)}</div> : <EmptyState title="برای امروز فعالیتی ثبت نشده" description="با تنظیم ظرفیت یا تولید دوبارهٔ نقشه راه، برنامه روزت ساخته می‌شود." action={<button type="button" className="gp-button gp-button--ghost" onClick={onOpenOnboarding}>تنظیم ظرفیت</button>} />}
      </section>

      <Timeline phases={snapshot.roadmap.phases} milestones={snapshot.roadmap.milestones} onOpenPhase={onOpenPhase} />

      <div className="gp-two-column">
        <section className="gp-panel"><SectionHeader eyebrow="COURSES" title="وضعیت درس‌ها" description="اولویت هر درس از مبحث، عملکرد و ددلاین ساخته شده است." /><div className="gp-course-grid">{snapshot.courses.slice(0, 8).map((course) => <CourseProgressCard key={course.courseId} course={course} onOpen={onOpenCourse} />)}</div></section>
        <section className="gp-panel"><SectionHeader eyebrow="UPCOMING" title="نقاط مهم بعدی" description="ددلاین‌ها روی همان Timeline برنامه اثر می‌گذارند." /><div className="gp-deadline-list">{upcomingDeadlines.length ? upcomingDeadlines.map((item) => <DeadlineCard key={item.id} item={item} readiness={examReadiness} />) : <EmptyState title="ددلاین آینده‌ای ثبت نشده" description="امتحان یا هدف شخصی‌ات را اضافه کن." />}</div></section>
      </div>

      <div className="gp-two-column">
        <section className="gp-panel"><SectionHeader eyebrow="RISK" title="کجا ممکن است عقب بیفتی؟" description="ریسک‌ها با دلیل و اقدام بعدی نمایش داده می‌شوند." /><div className="gp-risk-list">{snapshot.risks.length ? snapshot.risks.slice(0, 4).map((risk) => <RiskCard key={risk.id} risk={risk} />) : <EmptyState title="ریسک مهمی پیدا نشد" description="با ثبت تست و فعالیت، تحلیل دقیق‌تر می‌شود." />}</div></section>
        <section className="gp-panel"><SectionHeader eyebrow="NEXT BEST ACTION" title="پیشنهادهای هوشمند" description="قانون‌محور، توضیح‌پذیر و متصل به منابع تپش." /><div className="gp-recommendation-list">{snapshot.recommendations.length ? snapshot.recommendations.slice(0, 4).map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} />) : <EmptyState title="پیشنهاد تازه‌ای نداریم" description="اولین فعالیت را انجام بده تا چرخه بازخورد شروع شود." />}</div></section>
      </div>
    </div>
  );
}

export function GreenPathCourseView({ courseRoadmap, onBack, onComplete, onFocus, onOpenResource, onReschedule }) {
  if (!courseRoadmap?.course) return <EmptyState title="درس پیدا نشد" description="این درس دیگر در Curriculum Graph موجود نیست." action={<button type="button" className="gp-button gp-button--ghost" onClick={onBack}>بازگشت</button>} />;
  const performanceById = new Map(courseRoadmap.topicPerformance.map((entry) => [entry.topicId, entry]));
  const resourcesByTask = (task) => courseRoadmap.resources?.filter((resource) => (task.resourceIds ?? []).includes(resource.id)) ?? [];
  return (
    <div className="gp-view gp-course-view">
      <section className="gp-subhero"><button type="button" className="gp-back-button" onClick={onBack}><ArrowIcon direction="right" /> بازگشت به مسیر</button><span className="gp-eyebrow">COURSE ROADMAP</span><h1>{courseRoadmap.course.title}</h1><p>این صفحه نشان می‌دهد برای این درس چه چیزی انجام شده، چه چیزی ضعیف است و قدم بعدی چیست.</p><div className="gp-subhero__stats"><ProgressRing value={courseRoadmap.progress?.coverage ?? 0} label="پوشش" size={104} tone="blue" /><div><strong>{toFa(courseRoadmap.progress?.topicCount ?? courseRoadmap.topics.length)} مبحث</strong><span>{toFa(courseRoadmap.progress?.completedTopics ?? 0)} مبحث تثبیت‌شده</span><span>تسلط {toFa(Math.round(courseRoadmap.progress?.mastery ?? 0))}٪</span></div></div></section>
      <section className="gp-panel"><SectionHeader eyebrow="CURRICULUM GRAPH" title="مباحث و وابستگی‌ها" description="ترتیب مبحث‌ها از گراف Curriculum می‌آید؛ پیش‌نیازها نادیده گرفته نمی‌شوند." /><div className="gp-topic-list">{courseRoadmap.topics.map((topic) => { const performance = performanceById.get(topic.id); return <div className="gp-topic-row" key={topic.id}><span className="gp-topic-row__index">{toFa(topic.order + 1)}</span><div className="gp-topic-row__body"><strong>{topic.title}</strong><small>{topic.path.join(' › ')} · {topic.prerequisiteTopicIds.length ? `${toFa(topic.prerequisiteTopicIds.length)} پیش‌نیاز` : 'بدون پیش‌نیاز'}</small><div className="gp-progress"><span style={{ width: `${performance?.completion ?? 0}%` }} /></div></div><div className="gp-topic-row__meta"><span>{toFa(Math.round(performance?.mastery ?? 0))}٪ تسلط</span><small>{performance?.accuracy === null || performance?.accuracy === undefined ? 'بدون داده تست' : `${toFa(Math.round(performance.accuracy))}٪ دقت`}</small></div></div>; })}</div></section>
      <section className="gp-panel"><SectionHeader eyebrow="NEXT ACTIONS" title="کارهای این درس" description="هر Task به منبع واقعی تپش وصل است." /><div className="gp-task-list">{courseRoadmap.tasks.length ? courseRoadmap.tasks.map((task) => <TaskCard key={task.id} task={task} resources={resourcesByTask(task)} onComplete={onComplete} onFocus={onFocus} onOpenResource={onOpenResource} onReschedule={onReschedule} />) : <EmptyState title="برای این درس Taskی ساخته نشده" description="این درس در افق فعلی اولویت کافی نداشته یا ظرفیت تکمیل شده است." />}</div></section>
    </div>
  );
}

export function GreenPathWeekView({ snapshot, onComplete, onFocus, onOpenResource, onReschedule, onOpenRecovery, onOpenDay }) {
  const byDate = snapshot.roadmap.byDate.filter((day) => day.tasks.length > 0).slice(0, 7);
  const taskResources = (task) => (snapshot.resources ?? []).filter((resource) => (task.resourceIds ?? []).includes(resource.id));
  return (
    <div className="gp-view gp-week-view">
      <section className="gp-subhero"><span className="gp-eyebrow">WEEKLY PLAN</span><h1>برنامه این هفته</h1><p>برنامه از ظرفیت واقعی تو ساخته شده و Buffer آن برای تغییرات پیش‌بینی‌نشده حفظ می‌شود.</p><div className="gp-week-summary"><span><strong>{formatMinutes(snapshot.weeklyPlan.plannedMinutes)}</strong><small>برنامه‌ریزی‌شده</small></span><span><strong>{toFa(snapshot.roadmap.capacity.utilization)}٪</strong><small>استفاده از ظرفیت</small></span><span><strong>{toFa(snapshot.adaptation.backlogMinutes)}</strong><small>دقیقه عقب‌افتاده</small></span><button type="button" className="gp-button gp-button--ghost" onClick={onOpenRecovery}>مدیریت جبران</button></div></section>
      <section className="gp-panel"><SectionHeader eyebrow="WEEKLY FLOW" title="روز به روز" description="اگر یک روز تغییر کرد، اثر آن در برنامه بعدی محاسبه می‌شود." /><div className="gp-week-list">{byDate.map((day) => <section className="gp-day" key={day.date}><header><button type="button" onClick={() => onOpenDay?.(day.date)}><strong>{formatWeekday(day.date)}</strong><span>{formatDate(day.date)}</span></button><small>{formatMinutes(day.plannedMinutes)} · {toFa(day.utilization)}٪ ظرفیت</small></header><div className="gp-task-list">{day.tasks.map((task) => <TaskCard key={task.id} task={task} resources={taskResources(task)} onComplete={onComplete} onFocus={onFocus} onOpenResource={onOpenResource} onReschedule={onReschedule} compact />)}</div></section>)}</div></section>
    </div>
  );
}

export function RecoveryPanel({ recovery, mode, onModeChange, onRecalculate }) {
  return <section className="gp-panel gp-recovery"><SectionHeader eyebrow="RECOVERY ENGINE" title="جبران بدون خراب‌کردن مسیر" description={recovery.reason} /><div className="gp-recovery__stats"><MiniMetric label="عقب‌افتادگی" value={formatMinutes(recovery.backlogMinutes)} tone="red" /><MiniMetric label="جبران برنامه‌ریزی‌شده" value={formatMinutes(recovery.plannedRecoveryMinutes)} tone="gold" /><MiniMetric label="باقی‌مانده" value={formatMinutes(recovery.remainingMinutes)} tone="blue" /></div><div className="gp-recovery__modes">{['conservative', 'balanced', 'aggressive'].map((item) => <button key={item} type="button" className={mode === item ? 'is-active' : ''} onClick={() => onModeChange(item)}><strong>{item === 'conservative' ? 'کم‌فشار' : item === 'balanced' ? 'متعادل' : 'سریع'}</strong><small>{item === 'conservative' ? 'حفظ انرژی و مرور' : item === 'balanced' ? 'تعادل ظرفیت و جبران' : 'فشرده‌تر، با فشار بیشتر'}</small></button>)}</div><button type="button" className="gp-button gp-button--primary" onClick={onRecalculate}>بازمحاسبه Recovery Plan <ArrowIcon /></button></section>;
}

export function FocusMode({ task, resources, onComplete, onOpenResource, onClose }) {
  if (!task) return null;
  return <div className="gp-focus-backdrop" role="presentation"><section className="gp-focus" role="dialog" aria-modal="true" aria-labelledby="gp-focus-title"><button type="button" className="gp-focus__close" onClick={onClose} aria-label="بستن حالت تمرکز">×</button><span className="gp-eyebrow">FOCUS MODE</span><h2 id="gp-focus-title">{task.title}</h2><p>{Array.isArray(task.reason) ? task.reason[0] : task.reason}</p><div className="gp-focus__timer"><strong>{formatMinutes(task.durationMinutes)}</strong><span>زمان هدف</span></div><div className="gp-focus__resources">{resources.map((resource) => <ResourceAction key={resource.id} resource={resource} onOpen={onOpenResource} />)}</div><button type="button" className="gp-button gp-button--primary" onClick={() => { onComplete(task); onClose(); }}><TargetIcon /> ثبت پایان فعالیت</button></section></div>;
}
