/* ── زبان بصری مشترک «شبکه دانش» ──
   واحد‌های کوچک قابل‌استفاده در همهٔ نماها: گلیف نوع نود، چیپ درس، نشان وضعیت،
   اسکلت‌ها و حالت‌های خالی/خطا. هیچ منطق شبکه‌ای اینجا نیست — فقط نمایش. */

import { NODE_TYPES } from '../../../services/knowledge/graphData';
import { courseById } from '../../../services/knowledge/graphData';
import { STATUS_META } from '../../../services/knowledge/knowledgeService';

/* ─────────────────────────── گلیف انواع نود ───────────────────────────
   هر نوع نود یک نشان هندسی مینیمال دارد؛ ظریف و بدون شلوغی. */
const GLYPH_PATHS = {
  disease: <path d="M6 1.5 10 4v4L6 10.5 2 8V4z" />,
  concept: <path d="M6 1.5 7.4 4.6 10.5 6 7.4 7.4 6 10.5 4.6 7.4 1.5 6 4.6 4.6z" />,
  anatomy: <path d="M6 2 10.5 10h-9z" />,
  process: (
    <>
      <path d="M10 6a4 4 0 1 1-1.2-2.8" />
      <path d="M10 1.5V4H7.5" />
    </>
  ),
  pathway: <path d="M1.5 8.5 4 4l2.5 4L9 3.5l1.5 3" />,
  drug: (
    <>
      <rect x="1.5" y="3.5" width="9" height="5" rx="2.5" />
      <line x1="6" y1="3.5" x2="6" y2="8.5" />
    </>
  ),
  cell: (
    <>
      <circle cx="6" cy="6" r="4.2" />
      <circle cx="6" cy="6" r="1.4" />
    </>
  ),
  molecule: (
    <>
      <circle cx="4" cy="6" r="2.6" />
      <circle cx="8.6" cy="6" r="2.6" />
    </>
  ),
  microorganism: <path d="M6 1.5v9M2 3.5l8 5M10 3.5l-8 5" />,
  finding: <path d="M1.5 6h2.2l1.2-3 2.2 6 1.2-3h2.2" />,
  labTest: (
    <>
      <path d="M4 1.5v6a2 2 0 0 0 4 0v-6" />
      <line x1="4" y1="4.5" x2="8" y2="4.5" />
    </>
  ),
};

export function NodeGlyph({ type, size = 12 }) {
  const path = GLYPH_PATHS[type] ?? GLYPH_PATHS.concept;
  return (
    <svg
      className="kn-glyph"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

/* ─────────────────────────── چیپ درس ─────────────────────────── */
export function CourseChip({ courseId, active = true, compact = false }) {
  const course = courseById(courseId);
  if (!course) return null;
  return (
    <span
      className={`kn-chip ${active ? '' : 'kn-chip--off'} ${compact ? 'kn-chip--compact' : ''}`}
      style={{ '--accent': course.accent }}
    >
      <i aria-hidden="true" />
      {course.label}
    </span>
  );
}

/* ─────────────────────────── نشان نوع نود ─────────────────────────── */
export function TypeBadge({ type }) {
  const meta = NODE_TYPES[type] ?? { label: type };
  return (
    <span className="kn-type-badge">
      <NodeGlyph type={type} size={11} />
      {meta.label}
    </span>
  );
}

/* ─────────────────────────── اهمیت (۱-۵) ─────────────────────────── */
export function ImportanceDots({ value }) {
  return (
    <span className="kn-importance" title={`اهمیت ${value} از ۵`} aria-label={`اهمیت ${value} از ۵`}>
      {[1, 2, 3, 4, 5].map((dot) => (
        <i key={dot} className={dot <= value ? 'is-on' : ''} aria-hidden="true" />
      ))}
    </span>
  );
}

/* ─────────────────────────── وضعیت مطالعه ─────────────────────────── */
export function StatusBadge({ status, withLabel = true }) {
  const meta = STATUS_META[status] ?? STATUS_META.unstarted;
  return (
    <span className="kn-status" style={{ '--accent': meta.accent }}>
      <i aria-hidden="true" />
      {withLabel ? meta.label : null}
    </span>
  );
}

/* انتخابگر وضعیت — در پنل جزئیات و صفحهٔ موضوع */
export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([id, meta]) => ({ id, ...meta }));

/* ─────────────────────────── دکمه‌ها و کروم ─────────────────────────── */
export function KnButton({ children, icon, variant = '', ...rest }) {
  return (
    <button type="button" className={`kn-button ${variant}`} {...rest}>
      {icon ? <span className="kn-button__icon" aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

export function KnBackButton({ children, onClick }) {
  return (
    <button type="button" className="kn-back" onClick={onClick}>
      <span aria-hidden="true">→</span>
      {children}
    </button>
  );
}

/* ─────────────────────────── اسکلت‌ها ─────────────────────────── */
export function GraphSkeleton() {
  return (
    <div className="kn-skeleton kn-skeleton--graph" role="status" aria-label="در حال بارگذاری شبکه دانش">
      <div className="kn-skeleton__pulse">
        {[18, 34, 26, 46, 22, 38, 30].map((left, index) => (
          <span
            key={index}
            style={{ left: `${left}%`, top: `${12 + ((index * 13) % 70)}%`, animationDelay: `${index * 140}ms` }}
          />
        ))}
      </div>
      <p>در حال ترسیم نقشهٔ دانش…</p>
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="kn-skeleton kn-skeleton--panel" role="status" aria-label="در حال بارگذاری جزئیات">
      {[90, 60, 100, 45, 78].map((width, index) => (
        <span key={index} style={{ width: `${width}%`, animationDelay: `${index * 110}ms` }} />
      ))}
    </div>
  );
}

/* ─────────────────────────── حالت‌های خالی و خطا ─────────────────────────── */
export function EmptyState({ title, description, icon = '◦', action }) {
  return (
    <div className="kn-empty">
      <span className="kn-empty__icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'خطا در بارگذاری', description, onRetry }) {
  return (
    <div className="kn-empty kn-empty--error" role="alert">
      <span className="kn-empty__icon" aria-hidden="true">⚠</span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {onRetry ? (
        <KnButton variant="kn-button--accent" onClick={onRetry}>
          تلاش مجدد
        </KnButton>
      ) : null}
    </div>
  );
}

/* شمارندهٔ فارسی برای چیپ‌های عدددار */
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const faCount = (value) =>
  String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
