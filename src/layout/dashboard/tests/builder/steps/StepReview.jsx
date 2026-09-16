/*
 * Step 5 — «مرور و شروع»: خلاصهٔ نهایی آزمون (نام، تعداد، زمان، درس‌ها، مباحث،
 * سطح) به‌همراه Blueprint و اکشن‌های ذخیره/ساخت. همان plan مرحلهٔ قبل اجرا می‌شود —
 * چیزی که کاربر دیده همان چیزی است که ساخته می‌شود.
 */
import BlueprintCard from '../BlueprintCard';
import { DIFFICULTY_LABELS, Icon, toFa } from '../builderShared';

export default function StepReview({ draft, update, plan, planBusy, subjects, onSave, onStart, busy, savedNote }) {
  const subjectNames = draft.subjectIds.map((id) => subjects?.find((subject) => subject.id === id)?.name).filter(Boolean);
  const levelText =
    draft.difficulty.mode === 'single'
      ? DIFFICULTY_LABELS[draft.difficulty.level]
      : `ترکیبی (${toFa(draft.difficulty.distribution.easy)} آسان / ${toFa(draft.difficulty.distribution.medium)} متوسط / ${toFa(draft.difficulty.distribution.hard)} سخت)`;

  const summary = [
    { icon: 'grid', label: `${toFa(plan?.target ?? draft.questionCount)} سؤال` },
    {
      icon: 'clock',
      label:
        draft.durationMode === 'custom' && draft.durationMinutes
          ? `${toFa(draft.durationMinutes)} دقیقه`
          : draft.durationMode === 'none'
            ? 'بدون محدودیت زمان'
            : plan?.suggestedDuration
              ? `${toFa(plan.suggestedDuration)} دقیقه (پیشنهادی)`
              : 'زمان پیشنهادی',
    },
    { icon: 'book', label: subjectNames.length ? subjectNames.join('، ') : 'همهٔ دروس' },
    { icon: 'layers', label: draft.topicPaths.length ? `${toFa(draft.topicPaths.length)} مبحث انتخابی` : 'کل مباحث' },
    { icon: 'chart', label: `سطح ${levelText}` },
  ];

  return (
    <div className="ex-enter space-y-4">
      {/* خلاصهٔ آزمون */}
      <section className="rounded-[2rem] border border-[#61D192]/25 bg-[#61D192]/[0.05] p-5 md:p-6" aria-label="خلاصهٔ آزمون">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">{draft.title || 'آزمون شخصی من'}</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {summary.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-[11px] text-[var(--muted)]">
                  <Icon name={item.icon} className="h-3.5 w-3.5 text-[var(--green-ink)]" />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="w-full sm:w-64">
            <label htmlFor="exam-title" className="mb-1.5 block text-[11px] text-[var(--faint)]">
              نام آزمون
            </label>
            <input
              id="exam-title"
              type="text"
              value={draft.title}
              onChange={(event) => update({ title: event.target.value })}
              placeholder="مثلاً: آزمون فیزیولوژی قلب"
              className="w-full rounded-xl border border-white/10 bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--ghost)] focus:border-[#61D192]/50 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <BlueprintCard plan={plan} subjects={subjects} config={draft} />

      {savedNote && (
        <p className="flex items-center gap-2 rounded-2xl border border-[#61D192]/30 bg-[#61D192]/[0.07] px-4 py-3 text-[12.5px] text-[var(--green-ink)]" role="status">
          <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
          {savedNote}
        </p>
      )}

      {/* اکشن‌های نهایی */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 pb-2">
        <button
          type="button"
          onClick={onStart}
          disabled={planBusy || !plan?.target}
          className="flex cursor-pointer items-center gap-2 rounded-2xl bg-[var(--green-vivid)] px-8 py-3.5 text-sm font-bold text-[#12271a] transition-all hover:-translate-y-0.5 hover:bg-[var(--green-vivid)] disabled:cursor-default disabled:translate-y-0 disabled:bg-white/8 disabled:text-[var(--faint)]"
        >
          <Icon name="play" className="h-4 w-4" />
          {busy ? 'در حال ساخت…' : 'ساخت و شروع آزمون'}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={planBusy || !plan?.target || busy}
          className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-6 py-3.5 text-sm transition-colors hover:bg-white/12 disabled:opacity-40"
        >
          <Icon name="card" className="h-4 w-4" />
          ذخیره برای بعد
        </button>
      </div>
      <p className="text-center text-[11px] text-[var(--ghost)]">
        آزمون ذخیره‌شده در «آزمون‌های من» می‌ماند و می‌توانی چند بار رویش تلاش کنی.
      </p>
    </div>
  );
}
