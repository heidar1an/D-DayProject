import { COURSE_COLORS, RESOURCE_LABELS, TASK_TYPES, toFa } from '../../../services/greenPath/greenPathConfig';

export { toFa };

export const PERSIAN_DATE = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric' });
export const PERSIAN_SHORT_DATE = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
export const PERSIAN_WEEKDAY = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long' });

export const formatDate = (value, { short = false } = {}) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : (short ? PERSIAN_SHORT_DATE : PERSIAN_DATE).format(date);
};

export const formatWeekday = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? '' : PERSIAN_WEEKDAY.format(date);
};

export const formatMinutes = (value) => {
  const minutes = Math.max(0, Number(value) || 0);
  if (minutes < 60) return `${toFa(minutes)} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${toFa(hours)} ساعت و ${toFa(rest)} دقیقه` : `${toFa(hours)} ساعت`;
};

export const formatClock = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  return `${toFa(String(Math.floor(total / 60)).padStart(2, '0'))}:${toFa(String(total % 60).padStart(2, '0'))}`;
};

export const TASK_TYPE_LABELS = {
  [TASK_TYPES.LEARN]: 'یادگیری',
  [TASK_TYPES.REVIEW]: 'مرور',
  [TASK_TYPES.PRACTICE]: 'تست آموزشی',
  [TASK_TYPES.TEST]: 'تست زمان‌دار',
  [TASK_TYPES.ANALYZE]: 'تحلیل تست',
  [TASK_TYPES.READ_REFERENCE]: 'رفرنس',
  [TASK_TYPES.WIKI_REVIEW]: 'ویکی',
  [TASK_TYPES.KNOWLEDGE_LINK]: 'شبکه دانش',
  [TASK_TYPES.FLASHCARD_REVIEW]: 'فلش‌کارت',
  [TASK_TYPES.MOCK_EXAM]: 'آزمون',
  [TASK_TYPES.BUFFER]: 'بافر',
};

export const courseAccent = (courseId) => COURSE_COLORS[courseId] ?? 'var(--green-ink)';
export const resourceLabel = (type) => RESOURCE_LABELS[type] ?? type;

export function ArrowIcon({ direction = 'left', className = 'gp-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === 'right' ? <path d="m14 5-7 7 7 7M8 12h12" /> : <path d="m10 5 7 7-7 7M4 12h12" />}
    </svg>
  );
}

export function CheckIcon({ className = 'gp-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  );
}

export function SparkIcon({ className = 'gp-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
      <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </svg>
  );
}

export function CalendarIcon({ className = 'gp-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function TargetIcon({ className = 'gp-icon' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="m16.5 7.5 4-4M17.5 3.5h3v3" />
    </svg>
  );
}

export function ProgressRing({ value = 0, size = 116, label = 'پیشرفت', tone = 'green' }) {
  const normalized = Math.min(100, Math.max(0, Number(value) || 0));
  const radius = 47;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - normalized / 100);
  return (
    <div className={`gp-ring gp-ring--${tone}`} style={{ '--gp-ring-size': `${size}px` }}>
      <svg viewBox="0 0 110 110" aria-label={`${label} ${toFa(Math.round(normalized))} درصد`} role="img">
        <circle className="gp-ring__track" cx="55" cy="55" r={radius} />
        <circle className="gp-ring__value" cx="55" cy="55" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span className="gp-ring__text">
        <strong>{toFa(Math.round(normalized))}٪</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

export function StatusPill({ status }) {
  const meta = {
    'on-track': { label: 'On Track', className: 'is-on-track' },
    'at-risk': { label: 'At Risk', className: 'is-at-risk' },
    behind: { label: 'Behind Schedule', className: 'is-behind' },
    ahead: { label: 'Ahead of Schedule', className: 'is-ahead' },
  }[status] ?? { label: 'در حال تحلیل', className: 'is-neutral' };
  return <span className={`gp-status ${meta.className}`}><i aria-hidden="true" />{meta.label}</span>;
}

export function SectionHeader({ eyebrow, title, description, action = null }) {
  return (
    <header className="gp-section-header">
      <div>
        {eyebrow && <span className="gp-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ title = 'داده‌ای برای نمایش نیست', description = 'با ثبت اولین فعالیت، این بخش زنده می‌شود.', action = null }) {
  return (
    <div className="gp-empty">
      <span className="gp-empty__mark" aria-hidden="true"><SparkIcon /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="gp-loading" aria-label="در حال ساخت مسیر">
      <span className="gp-skeleton gp-skeleton--hero" />
      <div className="gp-loading__grid"><span className="gp-skeleton" /><span className="gp-skeleton" /><span className="gp-skeleton gp-skeleton--wide" /></div>
    </div>
  );
}
