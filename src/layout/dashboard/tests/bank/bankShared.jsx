/*
 * قطعات مشترک لایهٔ «بانک تست علوم پایه».
 * اعداد فارسی از لایهٔ لیگ reused می‌شوند؛ آیکن‌ها و نشان‌ها هم‌زبان لایه‌های
 * هماهنگ/بین‌الملل‌اند ولی مستقل تعریف شده‌اند تا هر لایه CSS/JS خودش را داشته باشد.
 */
import { useEffect } from 'react';
import { toFa, faNum } from '../../league/leagueShared';
import { DIFFICULTIES, QUESTION_TYPES, SOURCES } from '../../../../services/testBank/testBankService';

export { toFa, faNum };
export { DIFFICULTIES, QUESTION_TYPES, SOURCES };

/* ── آیکن‌های خطی لایهٔ بانک تست ── */
const iconPaths = {
  back: <path d="M9 5l7 7-7 7" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  timer: (
    <>
      <path d="M9 2.5h6" />
      <circle cx="12" cy="13.5" r="8" />
      <path d="M12 10v3.5l2.4 1.6" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4.5" />
      <path d="M6 5c4-2 8 2 12 0v8c-4 2-8-2-12 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m14 6-6 6 6 6" />,
  play: <path d="M8 5.5v13l10-6.5z" />,
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </>
  ),
  spark: <path d="M12 2.5c.6 4.8 2.2 6.4 7 7-4.8.6-6.4 2.2-7 7-.6-4.8-2.2-6.4-7-7 4.8-.6 6.4-2.2 7-7z" />,
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5V5.5M20 18v3H6.5" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M7 9.5h6M7 13.5h10" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  heart: (
    <path d="M12 20.5c-.35 0-.7-.13-.97-.37C9.6 18.9 3.5 13.9 3.5 9.5 3.5 6.7 5.6 4.5 8.2 4.5c1.5 0 2.9.75 3.8 1.95.9-1.2 2.3-1.95 3.8-1.95 2.6 0 4.7 2.2 4.7 5 0 4.4-6.1 9.4-7.53 10.63-.27.24-.62.37-.97.37z" />
  ),
  heartFilled: (
    <path
      d="M12 20.5c-.35 0-.7-.13-.97-.37C9.6 18.9 3.5 13.9 3.5 9.5 3.5 6.7 5.6 4.5 8.2 4.5c1.5 0 2.9.75 3.8 1.95.9-1.2 2.3-1.95 3.8-1.95 2.6 0 4.7 2.2 4.7 5 0 4.4-6.1 9.4-7.53 10.63-.27.24-.62.37-.97.37z"
      fill="currentColor"
      stroke="none"
    />
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4h-4" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  shuffle: (
    <>
      <path d="M3 6h3.5c5.5 0 8.5 12 14 12" />
      <path d="M3 18h3.5c2.2 0 3.9-2.3 5.2-4.9M14.6 8.4C15.9 6.5 17.4 6 18.5 6" />
      <path d="m17 3.5 3 2.5-3 2.5M17 15.5l3 2.5-3 2.5" />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  bolt: <path d="M13 3 5.5 13.5H11L10.5 21 18 10.5h-5.5z" />,
  layers: (
    <>
      <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 1 2.34 5.66" />
      <path d="M4 20v-4.5h4.5" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15M9.5 6V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V6" />
      <path d="M6.5 6.5 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20v-1a6.5 6.5 0 0 1 13 0v1" />
      <path d="M16 5.4a3.5 3.5 0 0 1 0 6.2M18.5 20v-1a6.4 6.4 0 0 0-2.5-4.9" />
    </>
  ),
};

export function Icon({ name, className = 'h-[18px] w-[18px]', strokeWidth = 1.9, style }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name] ?? iconPaths.spark}
    </svg>
  );
}

/* ── نشان سطح سختی — هم‌شکل لایهٔ هماهنگ ── */
export function DifficultyBadge({ difficulty, className = '' }) {
  const meta = DIFFICULTIES[difficulty] ?? DIFFICULTIES.medium;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${className}`}
      style={{ background: `${meta.accent}14`, color: meta.accent }}
      title={`سطح: ${meta.label}`}
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map((dot) => (
          <span
            key={dot}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dot <= meta.dots ? meta.accent : 'currentColor', opacity: dot <= meta.dots ? 1 : 0.2 }}
          />
        ))}
      </span>
      {meta.label}
    </span>
  );
}

export function TypeBadge({ type, className = '' }) {
  const meta = QUESTION_TYPES[type];
  if (!meta) return null;
  return <span className={`tb-badge tb-badge--plain ${className}`}>{meta.label}</span>;
}

export function SourceBadge({ source, className = '' }) {
  const meta = SOURCES[source];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] ${className}`}
      style={{ background: `${meta.accent}12`, color: meta.accent }}
    >
      {meta.label}
    </span>
  );
}

/* ── اسکلت لودینگ ── */
export function Skeleton({ className = '' }) {
  return <span className={`tb-sk block ${className}`} aria-hidden="true" />;
}

export function EmptyState({ icon = 'search', title, note, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-[#8a8a8a]">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <strong className="mt-1 [font-family:'Doran',Tahoma,sans-serif]">{title}</strong>
      {note && <p className="max-w-sm text-sm leading-6 text-[#8a8a8a]">{note}</p>}
      {action}
    </div>
  );
}

/* ── زمان‌ها ── */
export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return toFa(`${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
  return toFa(`${minutes}:${String(seconds).padStart(2, '0')}`);
}

const dateFmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' });
export const formatFullDate = (ts) => dateFmt.format(new Date(ts));

export function formatAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${toFa(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toFa(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${toFa(days)} روز پیش`;
  return formatFullDate(ts);
}

/* ── مودال پایه لایه ── */
export function Modal({ open, onClose, title, children, width = 'min(28rem, 100%)' }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => event.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="tb-fade fixed inset-0 z-[95] grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="tb-pop rounded-[1.8rem] border border-white/10 bg-[#222225] p-6" style={{ width }} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ── شکل‌های سؤال (Figure Registry) — SVG سبک خطی هم‌رنگ داشبورد ── */

function Axis({ x0 = 34, y0 = 150, width = 268, height = 120, xLabel, yLabel }) {
  return (
    <g stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeLinecap="round">
      <line x1={x0} y1={y0} x2={x0 + width} y2={y0} />
      <line x1={x0} y1={y0} x2={x0} y2={y0 - height} />
      {xLabel && (
        <text x={x0 + width} y={y0 + 14} fill="#8a8a8a" fontSize="10" textAnchor="end" stroke="none">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={x0 - 8} y={y0 - height - 6} fill="#8a8a8a" fontSize="10" textAnchor="start" stroke="none">
          {yLabel}
        </text>
      )}
    </g>
  );
}

const FIGURES = {
  /* پتانسیل عمل میوکارد (A) در برابر گره SA (B) */
  'cardiac-ap': () => (
    <svg viewBox="0 0 320 180" role="img" aria-label="نمودار پتانسیل عمل سلول میوکاردی و سلول گرهی">
      <Axis xLabel="زمان" yLabel="mV" />
      {/* A — میوکارد بطنی: صعود تند، فلات، ریپولاریزاسیون */}
      <path
        d="M44 150 C50 149 54 148 58 146 L66 42 C68 36 72 36 76 42 C82 52 86 56 96 58 C118 62 132 60 142 62 L156 116 C160 132 168 140 180 146 L200 150"
        fill="none"
        stroke="#61D192"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* B — گره SA: شیب خودکار فاز ۴ و صعود آهسته */}
      <path
        d="M44 138 C56 136 68 132 80 126 C94 119 104 110 116 96 C128 82 138 68 152 52 C160 43 172 38 186 42 C200 47 210 62 220 84 C228 102 240 122 258 136 L276 146"
        fill="none"
        stroke="#937fcd"
        strokeWidth="2.4"
        strokeDasharray="none"
        strokeLinecap="round"
      />
      <text x="210" y="34" fill="#61D192" fontSize="11" fontWeight="700">A — میوکارد بطنی</text>
      <text x="52" y="60" fill="#c9bdf0" fontSize="11" fontWeight="700">B — گره SA</text>
    </svg>
  ),

  /* منحنی تفکیک اکسی‌هموگلوبین — نرمال و انتقال به راست */
  'o2-curve': () => (
    <svg viewBox="0 0 320 180" role="img" aria-label="منحنی تفکیک اکسی‌هموگلوبین">
      <Axis xLabel="PO₂ (mmHg)" yLabel="اشباع %" />
      {/* هاشور Vmax/2 و P50 */}
      <line x1="84" y1="150" x2="84" y2="90" stroke="#e0b45c" strokeWidth="1.2" strokeDasharray="4 3" />
      <line x1="124" y1="150" x2="124" y2="90" stroke="#e0b45c" strokeWidth="1.2" strokeDasharray="4 3" />
      <line x1="34" y1="90" x2="124" y2="90" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 3" />
      <text x="80" y="163" fill="#e0b45c" fontSize="10" textAnchor="middle">P50</text>
      <text x="128" y="163" fill="#e0b45c" fontSize="10" textAnchor="middle">P50′</text>
      {/* منحنی نرمال */}
      <path
        d="M34 148 C60 146 76 136 88 112 C98 92 104 62 116 44 C124 34 134 32 144 32 L190 32"
        fill="none"
        stroke="#61D192"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* منحنی انتقال‌یافته به راست */}
      <path
        d="M34 149 C68 148 92 140 108 120 C122 102 130 74 146 52 C156 40 168 36 180 36 L216 36"
        fill="none"
        stroke="#ef9196"
        strokeWidth="2.4"
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
      <text x="196" y="26" fill="#61D192" fontSize="10.5" fontWeight="700">سالم</text>
      <text x="222" y="46" fill="#ef9196" fontSize="10.5" fontWeight="700">تب (به راست)</text>
    </svg>
  ),

  /* سینتیک میکائیلیس-منتن با نشانگر Km و Vmax */
  'enzyme-kinetics': () => (
    <svg viewBox="0 0 320 180" role="img" aria-label="منحنی سرعت سوبسترای آنزیم و Km">
      <Axis xLabel="[S]" yLabel="v" />
      {/* خط Vmax مجانب */}
      <line x1="34" y1="36" x2="302" y2="36" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="3 3" />
      <text x="60" y="30" fill="#8a8a8a" fontSize="10">Vmax</text>
      <line x1="34" y1="93" x2="118" y2="93" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="3 3" />
      <text x="46" y="88" fill="#8a8a8a" fontSize="10">½Vmax</text>
      {/* منحنی */}
      <path
        d="M34 150 C44 122 54 104 66 92 C82 76 98 66 118 60 C142 52 170 44 202 41 C230 38 260 37 292 36.5"
        fill="none"
        stroke="#61D192"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Km روی محور X */}
      <line x1="118" y1="150" x2="118" y2="93" stroke="#e0b45c" strokeWidth="1.2" strokeDasharray="4 3" />
      <circle cx="118" cy="93" r="3.4" fill="#e0b45c" />
      <text x="118" y="163" fill="#e0b45c" fontSize="10.5" textAnchor="middle" fontWeight="700">Km</text>
    </svg>
  ),
};

export function QuestionFigure({ name }) {
  const renderer = FIGURES[name];
  if (!renderer) return null;
  return (
    <figure className="mt-5 overflow-hidden rounded-2xl border border-white/8 bg-[#1d1d20] p-4">
      <div className="mx-auto w-full max-w-md">{renderer()}</div>
      <figcaption className="mt-2 text-center text-[11px] text-[#777]">شکل سؤال</figcaption>
    </figure>
  );
}

/* ── گزینهٔ سؤال — حالت‌های Default/Hover/Selected/Correct/Wrong/Disabled ── */
export function OptionButton({ option, index, state = 'idle', onSelect, disabled }) {
  const skin =
    state === 'correct'
      ? 'border-[#61D192]/50 bg-[#61D192]/[0.09] text-[#eaf6ef]'
      : state === 'wrong'
        ? 'border-[#e26d6d]/50 bg-[#e26d6d]/[0.08] text-[#f3e2e2]'
        : state === 'selected'
          ? 'border-[#937fcd]/70 bg-[#937fcd]/[0.12] text-white'
          : state === 'muted'
            ? 'border-white/6 bg-white/[0.015] text-[#8a8a8a]'
            : 'border-white/8 bg-[#2a2a2a] text-[#d9d9d9] hover:border-white/20 hover:bg-[#303030]';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`tb-option flex w-full items-start gap-3 text-right ${skin}`}
      aria-pressed={state === 'selected' || state === 'correct' || state === 'wrong'}
    >
      <span
        className={`tb-option__index ${state === 'correct' ? 'is-correct' : state === 'wrong' ? 'is-wrong' : state === 'selected' ? 'is-selected' : ''}`}
        aria-hidden="true"
      >
        {toFa(['A', 'B', 'C', 'D'][index] ?? index + 1)}
      </span>
      <span className="min-w-0 flex-1 text-[14.5px] leading-7">{option}</span>
      {state === 'correct' && <Icon name="check" className="mt-1.5 h-4.5 w-4.5 shrink-0 text-[#61D192]" />}
      {state === 'wrong' && <Icon name="x" className="mt-1.5 h-4.5 w-4.5 shrink-0 text-[#ef9196]" />}
    </button>
  );
}
