import { useMemo, useState } from 'react';
import { GOAL_PROFILES } from '../../../services/greenPath/greenPathConfig';
import { ArrowIcon, CalendarIcon, SectionHeader, TargetIcon, toFa } from './greenPathShared';

const goalOptions = Object.values(GOAL_PROFILES);
const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const normalizeDigits = (value) => String(value ?? '').replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));

export default function GreenPathOnboarding({ profile, goals, onBack, onSave, required = false }) {
  const toDateInput = (value, fallback) => {
    const date = value ? new Date(value) : new Date(fallback);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };
  const defaultStart = new Date();
  const defaultEnd = new Date(defaultStart.getTime() + 365 * 86400000);
  const [form, setForm] = useState({
    university: profile?.university ?? '',
    degree: profile?.degree ?? 'پزشکی',
    semester: profile?.semester ?? 4,
    currentWeek: profile?.currentWeek ?? 1,
    totalWeeks: profile?.totalWeeks ?? 52,
    planStart: toDateInput(profile?.planStart, defaultStart),
    planEnd: toDateInput(profile?.planEnd, defaultEnd),
    startingLevel: profile?.startingLevel ?? 'partial',
    defaultDailyMinutes: profile?.defaultDailyMinutes ?? 180,
  });
  const [studyDays, setStudyDays] = useState(() => Object.entries(profile?.capacityByWeekday ?? {}).filter(([, minutes]) => Number(minutes) > 0).map(([day]) => Number(day)));
  const activeStudyDays = studyDays.length ? studyDays : [0, 1, 2, 3, 4];
  const [selectedKinds, setSelectedKinds] = useState(() => goals?.map((goal) => goal.kind) ?? ['semester-excellence']);
  const [deadlineTitle, setDeadlineTitle] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const selectedGoals = useMemo(() => selectedKinds.map((kind, index) => {
    const existing = goals?.find((goal) => goal.kind === kind);
    const weights = selectedKinds.length === 1 ? [1] : selectedKinds.length === 2 ? [0.7, 0.3] : [0.6, 0.25, 0.15];
    const profileGoal = GOAL_PROFILES[kind];
    return {
      ...(existing ?? { id: `goal:${kind}` }),
      entityType: 'Goal',
      kind,
      title: profileGoal.title,
      weight: weights[index] ?? 0.1,
      priority: index + 1,
      targets: existing?.targets ?? [],
    };
  }), [goals, selectedKinds]);

  const toggleGoal = (kind) => {
    setSelectedKinds((current) => current.includes(kind) ? current.filter((item) => item !== kind) : current.length < 3 ? [...current, kind] : current);
  };

  const save = (event) => {
    event.preventDefault();
    onSave?.({
      profilePatch: {
        ...form,
        semester: Number(normalizeDigits(form.semester)),
        currentWeek: Number(normalizeDigits(form.currentWeek)),
        totalWeeks: Number(normalizeDigits(form.totalWeeks)),
        planStart: new Date(`${form.planStart}T12:00:00.000Z`).toISOString(),
        planEnd: new Date(`${form.planEnd}T12:00:00.000Z`).toISOString(),
        startingLevel: form.startingLevel,
        defaultDailyMinutes: Number(normalizeDigits(form.defaultDailyMinutes)),
        capacityByWeekday: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, activeStudyDays.includes(day) ? Number(normalizeDigits(form.defaultDailyMinutes)) : 0])),
      },
      goals: selectedGoals,
      deadline: deadlineTitle && deadlineDate ? { title: deadlineTitle, date: new Date(`${deadlineDate}T12:00:00.000Z`).toISOString(), type: 'personal', importance: 0.8, completed: false } : null,
    });
  };

  return (
    <div className="gp-view gp-onboarding">
      <section className="gp-subhero">{!required && <button type="button" className="gp-back-button" onClick={onBack}><ArrowIcon direction="right" /> بازگشت به مسیر</button>}<span className="gp-eyebrow">SETUP YOUR PATH</span><h1>{required ? 'قبل از شروع، مسیرت را تعریف کن' : 'مسیر را با واقعیت خودت تنظیم کن'}</h1><p>{required ? 'برای ساختن برنامهٔ یک‌ساله و تقویم شخصی، ابتدا اطلاعات تحصیلی، هدف‌ها، ظرفیت و ددلاین‌هایت را وارد کن.' : 'لازم نیست از روز اول ترم شروع کرده باشی؛ هفته فعلی، هدف، زمان واقعی و ددلاین‌ها نقطه شروع موتور هستند.'}</p></section>
      <form className="gp-setup-form" onSubmit={save}>
        <section className="gp-panel"><SectionHeader eyebrow="ACADEMIC PROFILE" title="اکنون کجای مسیر هستی؟" description="این داده‌ها برای ساخت Roadmap و ظرفیت روزانه استفاده می‌شوند." /><div className="gp-form-grid"><label><span>دانشگاه</span><input value={form.university} onChange={(event) => setForm((current) => ({ ...current, university: event.target.value }))} placeholder="مثلاً دانشگاه علوم پزشکی تهران" /></label><label><span>رشته</span><input value={form.degree} onChange={(event) => setForm((current) => ({ ...current, degree: event.target.value }))} /></label><label><span>ترم</span><input inputMode="numeric" value={form.semester} onChange={(event) => setForm((current) => ({ ...current, semester: event.target.value }))} /></label><label><span>هفته فعلی ترم</span><input inputMode="numeric" min="1" value={form.currentWeek} onChange={(event) => setForm((current) => ({ ...current, currentWeek: event.target.value }))} /></label><label><span>مدت افق برنامه (هفته)</span><input inputMode="numeric" min="1" value={form.totalWeeks} onChange={(event) => setForm((current) => ({ ...current, totalWeeks: event.target.value }))} /></label><label><span>آغاز برنامه یک‌ساله</span><input type="date" value={form.planStart} onChange={(event) => setForm((current) => ({ ...current, planStart: event.target.value }))} /></label><label><span>پایان برنامه یک‌ساله</span><input type="date" value={form.planEnd} onChange={(event) => setForm((current) => ({ ...current, planEnd: event.target.value }))} /></label><label><span>سطح شروع</span><select value={form.startingLevel} onChange={(event) => setForm((current) => ({ ...current, startingLevel: event.target.value }))}><option value="new">از صفر</option><option value="partial">مطالعه پراکنده</option><option value="advanced">پایه نسبتاً قوی</option></select></label><label><span>ظرفیت معمول روزانه (دقیقه)</span><input inputMode="numeric" min="30" value={form.defaultDailyMinutes} onChange={(event) => setForm((current) => ({ ...current, defaultDailyMinutes: event.target.value }))} /></label></div><div className="gp-study-days"><span>روزهای معمول مطالعه</span><div>{WEEKDAYS.map((weekday, index) => <button type="button" key={weekday} className={activeStudyDays.includes(index) ? 'is-active' : ''} onClick={() => setStudyDays((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])}>{weekday}</button>)}</div></div></section>

        <section className="gp-panel"><SectionHeader eyebrow="GOALS" title="مقصد اصلی و فرعی را انتخاب کن" description="وزن هدف‌ها در Priority Engine وارد می‌شود؛ حداکثر سه هدف برای جلوگیری از Overload." /><div className="gp-goal-grid">{goalOptions.map((goal) => { const active = selectedKinds.includes(goal.id); return <button type="button" key={goal.id} className={`gp-goal-option ${active ? 'is-active' : ''}`} onClick={() => toggleGoal(goal.id)} aria-pressed={active}><span className="gp-goal-option__icon"><TargetIcon /></span><span><strong>{goal.title}</strong><small>{goal.description}</small></span><i aria-hidden="true">{active ? '✓' : '+'}</i></button>; })}</div><div className="gp-selected-goals" aria-label="اولویت هدف‌ها">{selectedGoals.map((goal, index) => <span key={goal.id}><b>{toFa(index + 1)}</b>{goal.title} · {toFa(Math.round(goal.weight * 100))}٪</span>)}</div></section>

        <section className="gp-panel"><SectionHeader eyebrow="DEADLINE" title="یک نقطه مهم اضافه کن" description="می‌تواند امتحان دانشگاه، آزمون هماهنگ یا یک هدف شخصی باشد." /><div className="gp-deadline-form"><label><span>عنوان</span><input value={deadlineTitle} onChange={(event) => setDeadlineTitle(event.target.value)} placeholder="مثلاً امتحان فیزیولوژی" /></label><label><span>تاریخ</span><span className="gp-date-input"><CalendarIcon className="gp-icon gp-icon--small" /><input type="date" value={deadlineDate} onChange={(event) => setDeadlineDate(event.target.value)} /></span></label></div></section>

        <footer className="gp-setup-actions">{!required && <button type="button" className="gp-button gp-button--ghost" onClick={onBack}>انصراف</button>}<button type="submit" className="gp-button gp-button--primary">{required ? 'ساختن مسیر شخصی' : 'ساختن دوباره مسیر'} <ArrowIcon /></button></footer>
      </form>
    </div>
  );
}
