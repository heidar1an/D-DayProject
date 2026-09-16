/*
 * قطعات مشترک UI «آزمون‌ساز شخصی» — هم‌زبان لایهٔ بانک تست (Icon، اعداد فارسی،
 * اسکلت) تا دو لایه یکدست بمانند؛ اینجا فقط چیزهای مخصوص سازنده تعریف می‌شود.
 */
import { Icon, toFa, faNum } from '../bank/bankShared';
import { DIFFICULTY_LABELS, STATUS_LABELS } from '../../../../services/examBuilder/presets';

export { Icon, toFa, faNum, DIFFICULTY_LABELS, STATUS_LABELS };

/* ── چیپ انتخاب چندگانه ── */
export function Chip({ active, onClick, children, accent = '#61D192', className = '', disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`ex-check !py-2 ${className}`}
      style={
        active
          ? { borderColor: `${accent}80`, background: `${accent}1a`, color: 'var(--white)' }
          : undefined
      }
    >
      <span className="ex-check__box" aria-hidden="true">
        {active && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

/* ── کارت بخش تنظیمات ── */
export function SectionCard({ icon, accent = '#61D192', title, hint, children, className = '' }) {
  return (
    <section className={`rounded-[2rem] border border-white/8 bg-[var(--surface)] p-5 md:p-6 ${className}`} aria-label={title}>
      <header className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl" style={{ background: `${accent}14`, color: accent }}>
          <Icon name={icon} className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">{title}</h3>
          {hint && <p className="mt-0.5 text-[11px] text-[var(--faint)]">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/* ── استپر مراحل ── */
export const WIZARD_STEPS = [
  { id: 'purpose', label: 'هدف آزمون' },
  { id: 'scope', label: 'درس و مبحث' },
  { id: 'settings', label: 'تنظیم آزمون' },
  { id: 'blueprint', label: 'Blueprint' },
  { id: 'review', label: 'مرور و شروع' },
];

export function Stepper({ current, maxReached, onStepClick }) {
  return (
    <nav className="ex-stepper rounded-[1.75rem] border border-white/8 bg-[var(--surface)] px-3 py-3" aria-label="مراحل ساخت آزمون">
      {WIZARD_STEPS.map((step, index) => {
        const state = index === current ? 'is-active' : index < current ? 'is-done' : '';
        const clickable = index <= maxReached;
        return (
          <button
            key={step.id}
            type="button"
            className={`ex-step ${state}`}
            aria-current={index === current ? 'step' : undefined}
            aria-label={`مرحلهٔ ${toFa(index + 1)}: ${step.label}`}
            disabled={!clickable}
            onClick={() => clickable && onStepClick(index)}
          >
            <span className="ex-step__dot" aria-hidden="true">
              {index < current ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} /> : toFa(index + 1)}
            </span>
            <span className="ex-step__label">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ── نوار ناوبری ویزارد (قبلی/بعدی) ── */
export function WizardNav({ onBack, onNext, nextLabel = 'مرحلهٔ بعد', nextDisabled = false, nextHint, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-white/8 bg-[var(--surface)] px-4 py-3.5">
      <button
        type="button"
        onClick={onBack}
        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/6 px-4 py-2.5 text-sm text-[var(--muted)] transition-colors hover:bg-white/12 hover:text-white"
      >
        <Icon name="chevron" className="h-4 w-4 rotate-90" />
        مرحلهٔ قبل
      </button>
      <div className="flex items-center gap-3">
        {children}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          title={nextDisabled ? nextHint : undefined}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--green-vivid)] px-6 py-2.5 text-sm font-bold text-[#12271a] transition-all hover:-translate-y-0.5 hover:bg-[var(--green-vivid)] disabled:cursor-default disabled:translate-y-0 disabled:bg-white/8 disabled:text-[var(--faint)]"
        >
          {nextLabel}
          <Icon name="chevron" className="h-4 w-4 -rotate-90" />
        </button>
      </div>
    </div>
  );
}

/* ── ترجمهٔ هشدارهای موتور به متن فارسی ── */
export function warningText(warning, subjectName) {
  switch (warning.code) {
    case 'no-match':
      return 'با این تنظیمات هیچ تستی پیدا نشد؛ دامنهٔ درس/مبحث یا فیلترها را بازتر کن.';
    case 'status-empty':
      return `در دامنهٔ فعلی، تست ${STATUS_LABELS[warning.status] ?? ''}ی وجود ندارد.`;
    case 'pool-smaller':
      return `برای این ترکیب فقط ${faNum(warning.available)} تست موجود است (${faNum(warning.requested)} درخواست کرده‌ای) — تعداد کاهش یافت.`;
    case 'quota-clamped':
      return `سهمیهٔ «${STATUS_LABELS[warning.status] ?? warning.status}» دقیقاً تأمین نشد؛ فقط ${faNum(warning.available)} تست در دسترس است (درخواست: ${faNum(warning.requested)}).`;
    case 'difficulty-adjusted':
      return `توزیع سطح سختی دقیقاً قابل رعایت نبود؛ ${faNum(warning.moved)} تست بین سطوح جابه‌جا شد تا آزمون کامل شود.`;
    case 'subject-short':
      return `در ${subjectName ?? 'این درس'} فقط ${faNum(warning.available)} تست موجود بود (${faNum(warning.requested)} سهمش بود).`;
    default:
      return 'یک بخش از تنظیمات دقیقاً رعایت نشد؛ جزئیات را در Blueprint ببین.';
  }
}

/* ── سطر آماری کوچک (موجودی/حل‌شده/دقت) ── */
export function StatLine({ label, value, accent = '#61D192' }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10.5px] text-[var(--muted)]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} aria-hidden="true" />
      {label}
      <strong className="text-[var(--muted)]" style={{ color: accent }}>{value}</strong>
    </span>
  );
}
