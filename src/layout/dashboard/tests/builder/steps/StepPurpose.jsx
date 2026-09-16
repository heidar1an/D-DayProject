/*
 * Step 1 — هدف آزمون: هر هدف یک Preset واقعی از تنظیمات اعمال می‌کند؛ کاربر بعداً
 * همه‌چیز را در مرحله‌های بعد می‌تواند تغییر دهد (preset نقطهٔ شروع است، نه قفس).
 */
import { PURPOSES } from '../../../../../services/examBuilder/presets';
import { Icon, SectionCard, toFa } from '../builderShared';

export default function StepPurpose({ draft, update, catalog }) {
  const applyPurpose = (purpose) => {
    const patch = purpose.apply() ?? {};
    /* هدف ضعف‌محور: اگر پروفایل عملکردی هست، درس‌های ضعیف پیشنهاد می‌شوند */
    if (purpose.id === 'weakness' && catalog?.weakTopics?.length) {
      const weakSubjects = [...new Set(catalog.weakTopics.map((entry) => entry.subjectId))].slice(0, 2);
      patch.subjectIds = weakSubjects;
    }
    update({ purpose: purpose.id, ...patch });
  };

  return (
    <div className="ex-enter space-y-4">
      <SectionCard icon="target" accent="#61D192" title="برای چه چیزی آزمون می‌سازی؟" hint="هدف تو، تنظیمات اولیه را هوشمندانه می‌چیند — و همه‌اش بعداً قابل تغییر است.">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {PURPOSES.map((purpose) => {
            const active = draft.purpose === purpose.id;
            return (
              <button
                key={purpose.id}
                type="button"
                onClick={() => applyPurpose(purpose)}
                aria-pressed={active}
                className={`group flex cursor-pointer flex-col items-start gap-2.5 rounded-[1.4rem] border p-4 text-right transition-all hover:-translate-y-0.5 ${
                  active ? 'border-[#61D192]/60 bg-[#61D192]/[0.07]' : 'border-white/8 bg-white/[0.02] hover:border-white/20'
                }`}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-2xl"
                  style={{ background: `${purpose.accent}14`, color: purpose.accent }}
                >
                  <Icon name={purpose.icon} className="h-5 w-5" />
                </span>
                <span>
                  <strong className="block text-[13px] [font-family:'Doran','Vazir',Tahoma,sans-serif]">{purpose.label}</strong>
                  <span className="mt-0.5 block text-[11px] leading-5 text-[var(--faint)]">{purpose.description}</span>
                </span>
                {active && (
                  <span className="flex items-center gap-1 text-[10.5px] text-[var(--green-ink)]">
                    <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                    انتخاب شد
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* پیش‌نمایش پروفایل ضعف برای هدف «رفع نقاط ضعف» */}
        {draft.purpose === 'weakness' && catalog?.weakTopics?.length > 0 && (
          <div className="ex-enter mt-4 rounded-2xl border border-[#e26d6d]/25 bg-[#e26d6d]/[0.06] p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--red-ink)]">
              <Icon name="chart" className="h-3.5 w-3.5" />
              بر اساس عملکردت، این مباحث ضعیف‌اند:
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {catalog.weakTopics.slice(0, 6).map((entry) => (
                <span key={entry.path} className="rounded-full bg-white/6 px-3 py-1.5 text-[11px] text-[var(--muted)]">
                  {entry.subtopic ? `${entry.topic} › ${entry.subtopic}` : entry.topic}
                  <strong className="ms-1.5 text-[var(--red-ink)]">{toFa(entry.accuracy)}٪</strong>
                </span>
              ))}
            </div>
          </div>
        )}
        {draft.purpose === 'weakness' && catalog && !catalog.hasPerformance && (
          <p className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[11.5px] leading-6 text-[var(--faint)]">
            هنوز عملکرد ثبت‌شده‌ای نداری — بعد از چند تست، تپش نقاط ضعفت را می‌شناسد و همین هدف دقیق‌تر پیشنهاد می‌شود.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
