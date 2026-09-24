import { useCallback, useEffect, useMemo, useState } from 'react';
import { LAYER_IDS, useLayerRoute } from '../dashboardRoute';
import { addDays } from '../../../services/greenPath/schedulingEngine';
import {
  completeGreenPathOnboarding,
  completeGreenPathTask,
  fetchGreenPathBundle,
  getCourseRoadmap,
  getTaskResources,
  rescheduleGreenPathTask,
  setGreenPathRecoveryMode,
} from '../../../services/greenPath/greenPathService';
import { LoadingState, SparkIcon } from './greenPathShared';
import GreenPathCalendar from './GreenPathCalendar';
import GreenPathOnboarding from './GreenPathOnboarding';
import { FocusMode, GreenPathCourseView, GreenPathOverview, GreenPathWeekView, RecoveryPanel } from './GreenPathViews';
import { GreenPathDayView, GreenPathMonthView, GreenPathYearView } from './GreenPathPeriodViews';
import './greenPath.css';

const GREEN_PATH_VIEW = {
  mode: 'overview',
  courseId: null,
  phaseId: null,
  monthId: null,
  weekId: null,
  day: null,
  calendarMonth: null,
  selectedDate: null,
  sourceFilter: 'all',
};
const GREEN_PATH_MODES = ['overview', 'year', 'month', 'week', 'day', 'calendar', 'course', 'setup', 'recovery'];
const screenOf = (view) => {
  if (view?.mode === 'course') return `course:${view.courseId ?? 'unknown'}`;
  if (view?.mode === 'month') return `month:${view.monthId ?? 'unknown'}`;
  if (view?.mode === 'week') return `week:${view.weekId ?? 'unknown'}`;
  if (view?.mode === 'day') return `day:${view.day ?? 'unknown'}`;
  if (view?.mode === 'calendar') return `calendar:${view.calendarMonth ?? 'current'}`;
  return view?.mode ?? 'overview';
};

export default function GreenPathLayer({ userData, onBack }) {
  const [view, , patchView] = useLayerRoute(LAYER_IDS.greenPath, GREEN_PATH_VIEW, { screenOf });
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [focusTask, setFocusTask] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchGreenPathBundle(userData);
      setSnapshot(next);
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, [userData]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const go = useCallback((mode, payload = {}) => {
    if (!GREEN_PATH_MODES.includes(mode)) return;
    patchView({
      mode,
      courseId: payload.courseId ?? null,
      phaseId: payload.phaseId ?? null,
      monthId: payload.monthId ?? null,
      weekId: payload.weekId ?? null,
      day: payload.day ?? null,
      calendarMonth: payload.calendarMonth ?? null,
      selectedDate: payload.selectedDate ?? null,
      sourceFilter: payload.sourceFilter ?? 'all',
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [patchView]);

  const goOverview = useCallback(() => go('overview'), [go]);

  const handleComplete = useCallback(async (task) => {
    if (!task || busy) return;
    setBusy(true);
    try {
      const next = await completeGreenPathTask(userData, task);
      setSnapshot(next);
      setToast({ tone: 'success', message: `فعالیت «${task.topicTitle}» ثبت شد؛ بازخورد آن وارد برنامه بعدی شد.` });
    } catch {
      setToast({ tone: 'error', message: 'ثبت فعالیت انجام نشد؛ دوباره تلاش کن.' });
    } finally {
      setBusy(false);
    }
  }, [busy, userData]);

  const handleReschedule = useCallback(async (task) => {
    if (!snapshot || busy) return;
    const nextDate = addDays(new Date(`${task.plannedDate}T00:00:00.000Z`), 1).toISOString();
    setBusy(true);
    try {
      const result = await rescheduleGreenPathTask(userData, snapshot, task.id, nextDate);
      if (!result.preview.canMove) {
        setToast({ tone: 'warning', message: result.preview.conflicts.map((item) => item.message).join(' ') || 'این جابه‌جایی با برنامه سازگار نیست.' });
      } else {
        setSnapshot(result.snapshot);
        const minutes = result.preview.impact.compressedReviewMinutes;
        setToast({ tone: 'success', message: minutes ? `فعالیت به فردا منتقل شد؛ ${minutes} دقیقه از مرور فیزیولوژی فشرده می‌شود.` : 'فعالیت به فردا منتقل شد و برنامه آینده دوباره محاسبه شد.' });
      }
    } catch {
      setToast({ tone: 'error', message: 'محاسبه اثر جابه‌جایی انجام نشد.' });
    } finally {
      setBusy(false);
    }
  }, [busy, snapshot, userData]);

  const handleResource = useCallback((resource) => {
    if (!resource?.route) return;
    window.location.hash = resource.route;
  }, []);

  const handleSetupSave = useCallback(async ({ profilePatch, goals, deadline }) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await completeGreenPathOnboarding(userData, { profilePatch, goals, deadline });
      setSnapshot(next);
      goOverview();
      setToast({ tone: 'success', message: 'مسیر با وضعیت، هدف و ظرفیت جدید دوباره ساخته شد.' });
    } catch {
      setToast({ tone: 'error', message: 'ذخیره تنظیمات مسیر انجام نشد.' });
    } finally {
      setBusy(false);
    }
  }, [busy, goOverview, userData]);

  const handleRecoveryMode = useCallback(async (mode) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await setGreenPathRecoveryMode(userData, mode);
      setSnapshot(next);
      setToast({ tone: 'success', message: 'حالت Recovery به‌روزرسانی شد.' });
    } catch {
      setToast({ tone: 'error', message: 'حالت Recovery ذخیره نشد.' });
    } finally {
      setBusy(false);
    }
  }, [busy, userData]);

  const openTask = useCallback((task) => {
    if (!task) return;
    setFocusTask(task);
  }, []);

  const activeCourse = useMemo(() => {
    if (!snapshot || view.mode !== 'course') return null;
    const roadmap = getCourseRoadmap(snapshot, view.courseId);
    return { ...roadmap, resources: snapshot.resources.filter((resource) => roadmap.topics.some((topic) => topic.id === resource.topicId)) };
  }, [snapshot, view.mode, view.courseId]);

  const currentMonth = snapshot?.yearPlan?.months?.find((month) => month.status === 'current') ?? snapshot?.yearPlan?.months?.[0] ?? null;
  const currentWeek = snapshot?.yearPlan?.weeks?.find((week) => week.status === 'current') ?? snapshot?.yearPlan?.weeks?.[0] ?? null;
  const selectedDay = view.day ?? view.selectedDate ?? snapshot?.dailyPlan?.date;
  const effectiveMode = snapshot?.needsOnboarding ? 'setup' : view.mode;
  const activeMonth = snapshot?.yearPlan?.months?.find((month) => month.id === view.monthId) ?? currentMonth;
  const activeWeek = snapshot?.yearPlan?.weeks?.find((week) => week.id === view.weekId) ?? currentWeek;

  const handleLayerBack = () => {
    if (snapshot.needsOnboarding) return;
    if (view.mode === 'overview') onBack?.();
    else if (view.mode === 'year') goOverview();
    else if (view.mode === 'month') go('year');
    else if (view.mode === 'week') go('month', { monthId: activeMonth?.id });
    else if (view.mode === 'day') go('week', { weekId: activeWeek?.id });
    else if (view.mode === 'calendar') goOverview();
    else goOverview();
  };

  if (loading && !snapshot) return <section className="gp-layer" dir="rtl"><LoadingState /></section>;
  if (error && !snapshot) return <section className="gp-layer" dir="rtl"><div className="gp-error"><SparkIcon /><h2>ساخت مسیر ممکن نشد</h2><p>منبعی از اکوسیستم تپش پاسخ نداد؛ خود مسیر خراب نشده است.</p><button type="button" className="gp-button gp-button--primary" onClick={load}>تلاش دوباره</button></div></section>;
  if (!snapshot) return null;

  return (
    <section className="gp-layer" dir="rtl" aria-label="مسیر سبز — موتور هدایت مسیر تحصیلی">
      {snapshot.needsOnboarding ? (
        <header className="gp-layer__header gp-layer__header--back-only">
          <button type="button" className="gp-layer__back gp-layer__back--course" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
            بازگشت به دوره‌ها
          </button>
        </header>
      ) : (
      <header className="gp-layer__header">
        <div className="gp-layer__brand"><span className="gp-layer__mark"><SparkIcon /></span><span><strong>مسیر سبز</strong><small>{snapshot.academicProfile.university} · ترم {snapshot.academicProfile.semester}</small></span></div>
        <nav className="gp-layer__nav" aria-label="بخش‌های مسیر سبز">
          <button type="button" className={effectiveMode === 'overview' ? 'is-active' : ''} onClick={goOverview} disabled={snapshot.needsOnboarding}>نمای کلی</button>
          <button type="button" className={effectiveMode === 'year' ? 'is-active' : ''} onClick={() => go('year')} disabled={snapshot.needsOnboarding}>سال</button>
          <button type="button" className={effectiveMode === 'month' ? 'is-active' : ''} onClick={() => go('month', { monthId: currentMonth?.id })} disabled={snapshot.needsOnboarding}>ماه</button>
          <button type="button" className={effectiveMode === 'week' ? 'is-active' : ''} onClick={() => go('week', { weekId: currentWeek?.id })} disabled={snapshot.needsOnboarding}>هفته</button>
          <button type="button" className={effectiveMode === 'calendar' ? 'is-active' : ''} onClick={() => go('calendar', { calendarMonth: currentMonth?.startDate?.slice(0, 7) })} disabled={snapshot.needsOnboarding}>تقویم</button>
          <button type="button" className={effectiveMode === 'recovery' ? 'is-active' : ''} onClick={() => go('recovery')} disabled={snapshot.needsOnboarding}>جبران</button>
          <button type="button" className={effectiveMode === 'setup' ? 'is-active' : ''} onClick={() => go('setup')}>تنظیم مسیر</button>
        </nav>
        <button type="button" className="gp-layer__back" onClick={handleLayerBack}>{view.mode === 'overview' ? 'بستن مسیر' : 'بازگشت'} <span aria-hidden="true">×</span></button>
      </header>
      )}

      {effectiveMode === 'overview' && <GreenPathOverview snapshot={snapshot} onOpenOnboarding={() => go('setup')} onOpenCourse={(courseId) => go('course', { courseId })} onOpenTask={openTask} onComplete={handleComplete} onFocus={openTask} onOpenResource={handleResource} onReschedule={handleReschedule} onOpenPhase={(phaseId) => { setToast({ tone: 'info', message: snapshot.roadmap.phases.find((phase) => phase.phaseId === phaseId)?.description ?? 'این مرحله بخشی از Roadmap فعلی است.' }); }} />}
      {effectiveMode === 'year' && <GreenPathYearView snapshot={snapshot} onOpenMonth={(monthId) => go('month', { monthId })} onOpenCalendar={() => go('calendar', { calendarMonth: currentMonth?.startDate?.slice(0, 7) })} />}
      {effectiveMode === 'month' && <GreenPathMonthView monthPlan={activeMonth} onBack={() => go('year')} onOpenWeek={(weekId) => go('week', { weekId, monthId: activeMonth?.id })} onOpenCalendar={() => go('calendar', { calendarMonth: activeMonth?.startDate?.slice(0, 7) })} onComplete={handleComplete} onFocus={openTask} onOpenResource={handleResource} onReschedule={handleReschedule} />}
      {effectiveMode === 'week' && <GreenPathWeekView snapshot={snapshot} onComplete={handleComplete} onFocus={openTask} onOpenResource={handleResource} onReschedule={handleReschedule} onOpenRecovery={() => go('recovery')} onOpenDay={(day) => go('day', { day, weekId: activeWeek?.id })} />}
      {effectiveMode === 'day' && <GreenPathDayView snapshot={snapshot} date={selectedDay} onBack={() => go('week', { weekId: activeWeek?.id })} onComplete={handleComplete} onFocus={openTask} onOpenResource={handleResource} onReschedule={handleReschedule} />}
      {effectiveMode === 'calendar' && <GreenPathCalendar snapshot={snapshot} month={view.calendarMonth ?? currentMonth?.startDate?.slice(0, 7)} selectedDate={view.selectedDate} sourceFilter={view.sourceFilter} onMonthChange={(calendarMonth) => patchView({ calendarMonth })} onSelectDate={(selectedDate) => patchView({ selectedDate })} onSourceChange={(sourceFilter) => patchView({ sourceFilter })} onOpenEvent={(event) => { if (event.kind === 'task') setFocusTask(snapshot.roadmap.tasks.find((task) => task.id === event.entityId) ?? null); }} />}
      {effectiveMode === 'course' && <GreenPathCourseView courseRoadmap={activeCourse} onBack={goOverview} onComplete={handleComplete} onFocus={openTask} onOpenResource={handleResource} onReschedule={handleReschedule} />}
      {effectiveMode === 'setup' && <GreenPathOnboarding required={snapshot.needsOnboarding} profile={snapshot.academicProfile} goals={snapshot.goals} onBack={snapshot.needsOnboarding ? undefined : goOverview} onSave={handleSetupSave} />}
      {effectiveMode === 'recovery' && <div className="gp-view"><RecoveryPanel recovery={snapshot.recovery} mode={snapshot.recovery.mode} onModeChange={handleRecoveryMode} onRecalculate={() => load()} /></div>}

      {busy && <span className="gp-layer__busy" role="status">در حال بازتنظیم مسیر…</span>}
      {toast && <div className={`gp-toast gp-toast--${toast.tone}`} role="status">{toast.message}</div>}
      <FocusMode task={focusTask} resources={focusTask ? getTaskResources(snapshot, focusTask.id) : []} onComplete={handleComplete} onOpenResource={handleResource} onClose={() => setFocusTask(null)} />
    </section>
  );
}

export { GREEN_PATH_VIEW };
