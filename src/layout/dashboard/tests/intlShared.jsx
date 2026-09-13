/*
 * قطعات مشترک لایهٔ «آزمون‌های بین‌الملل».
 * ابزارهای عدد فارسی از لایهٔ لیگ reused می‌شوند تا کل داشبورد یک رفتار داشته باشد؛
 * آیکن‌ها و نشان‌های اختصاصی این بخش (سختی، زبان، نمونهٔ آموزشی، گلیف آزمون) اینجا تعریف شده‌اند.
 */
import { toFa, faNum } from '../league/leagueShared';

export { toFa, faNum };

/* ── آیکن‌های خطی این لایه ── */
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
  heart: (
    <path d="M12 20.5c-.3 0-.7-.12-.95-.36C9.9 19.1 4.2 14.6 4.2 10.4 4.2 7.9 6.1 6 8.5 6c1.3 0 2.7.7 3.5 1.9C12.8 6.7 14.2 6 15.5 6c2.4 0 4.3 1.9 4.3 4.4 0 4.2-5.7 8.7-6.85 9.74-.25.24-.65.36-.95.36z" />
  ),
  flag: (
    <>
      <path d="M6 21V4.5" />
      <path d="M6 5c4-2 8 2 12 0v8c-4 2-8-2-12 0" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8z" />
      <path d="m4.5 12.5 7.5 4 7.5-4" />
      <path d="m4.5 16.5 7.5 4 7.5-4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  play: <path d="M8 5.5v13l10-6.5z" />,
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </>
  ),
  spark: <path d="M12 2.5c.6 4.8 2.2 6.4 7 7-4.8.6-6.4 2.2-7 7-.6-4.8-2.2-6.4-7-7 4.8-.6 6.4-2.2 7-7z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  shield: <path d="M12 3 5 5.8v5.4c0 4.4 3 8 7 9.8 4-1.8 7-5.4 7-9.8V5.8z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  flame: <path d="M12 22c4 0 7-2.8 7-6.8 0-3.1-1.9-5.3-3.4-7-.4-.4-1-.2-1.1.3-.2 1.1-.7 2.3-1.5 3-.1-2.3-1.3-5.4-3.6-7-.4-.3-.9 0-.9.4 0 2-1 3.4-2 4.7C5.5 11 5 12.9 5 15.2 5 19.2 8 22 12 22z" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 3.5V8h-4.5" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  alert: (
    <>
      <path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5V5.5M20 18v3H6.5" />
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
  trash: (
    <>
      <path d="M4.5 6.5h15M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7" />
      <path d="M6.5 6.5 7.5 20a1.5 1.5 0 0 0 1.5 1.4h6A1.5 1.5 0 0 0 16.5 20l1-13.5" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  language: (
    <>
      <path d="M3.5 6h9M8 3.5v2.5M10 6c-.8 4-3.4 7.2-6.5 9M6 9.5c1.4 2.8 3.8 4.9 6.5 5.9" />
      <path d="m13 20.5 4-9.5 4 9.5M14.4 17.5h5.2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  up: <path d="M12 19V5m-6 6 6-6 6 6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 4 5.2 4 8.5s-1.4 6.1-4 8.5c-2.6-2.4-4-5.2-4-8.5s1.4-6.1 4-8.5z" />
    </>
  ),
  warn: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5M12 16h.01" />
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

/* ── گلیف انتزاعی هر آزمون (بدون پرچم و کلیشه) ── */
export function ExamGlyph({ glyph, accent, className = 'h-7 w-7' }) {
  const art = {
    shield: <path d="M12 3.5 5.5 6v5.2c0 4 2.7 7.3 6.5 9 3.8-1.7 6.5-5 6.5-9V6z M9 12l2.2 2.2L15.5 9.7" />,
    arch: (
      <>
        <path d="M5 18a7 7 0 0 1 14 0" />
        <path d="M3 18h18M9.5 18a2.5 2.5 0 0 1 5 0" />
      </>
    ),
    delta: (
      <>
        <path d="m12 4 8 15H4z" />
        <path d="M12 9.5 16 17.5H8z" opacity="0.5" />
      </>
    ),
    orbit: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-24 12 12)" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.6 2.4 4 5.2 4 8.5s-1.4 6.1-4 8.5c-2.6-2.4-4-5.2-4-8.5s1.4-6.1 4-8.5z" />
      </>
    ),
  }[glyph];

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={{ color: accent }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {art}
    </svg>
  );
}

/* ── نشان سطح سختی: برچسب + نقطه‌ها + رنگ (نه فقط رنگ) ── */
const DIFFICULTY_META = {
  easy: { label: 'آسان', dots: 1, accent: '#77b787' },
  medium: { label: 'متوسط', dots: 2, accent: '#e0b45c' },
  hard: { label: 'سخت', dots: 3, accent: '#ef9196' },
  very_hard: { label: 'بسیار سخت', dots: 4, accent: '#e26d6d' },
};

export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'very_hard'];

export function DifficultyBadge({ difficulty, className = '' }) {
  const meta = DIFFICULTY_META[difficulty] ?? DIFFICULTY_META.medium;
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

export const difficultyLabel = (difficulty) => DIFFICULTY_META[difficulty]?.label ?? 'متوسط';

/* ── برچسب «نمونه سؤال آموزشی» — جلوگیری از سوءبرداشت کاربر ── */
export function SampleTag({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-white/6 px-2 py-0.5 text-[10px] text-[#9a9a9a] ${className}`}
      title="سؤال‌های این بخش نمونهٔ آموزشی تالیفی تپش هستند، نه سؤال رسمی آزمون"
    >
      <Icon name="spark" className="h-3 w-3" />
      نمونه سؤال آموزشی
    </span>
  );
}

/* ── کنترل تغییر زبان سؤال: انگلیسی | فارسی | دو زبانه ── */
export const LANG_MODES = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'fa', label: 'فارسی', short: 'فا' },
  { id: 'dual', label: 'دو زبانه', short: 'EN+فا' },
];

export function LanguageToggle({ value, onChange, className = '' }) {
  return (
    <div className={`flex rounded-full bg-black/50 p-1 ${className}`} role="group" aria-label="زبان سؤال">
      {LANG_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          aria-pressed={value === mode.id}
          onClick={() => onChange(mode.id)}
          className={`cursor-pointer rounded-full px-3 py-1.5 text-xs transition-colors [font-family:'Doran',Tahoma,sans-serif] ${
            value === mode.id ? 'bg-[#937fcd] text-white' : 'text-[#aaa] hover:text-white'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

/* ── اسکلت لودینگ (هم‌شکل اسکلت لیگ، با کلاس اختصاصی این لایه) ── */
export function Skeleton({ className = '' }) {
  return <span className={`intl-sk block ${className}`} aria-hidden="true" />;
}

export function EmptyState({ icon = 'spark', title, note, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-[#8a8a8a]">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <strong className="mt-1 [font-family:'Doran',Tahoma,sans-serif]">{title}</strong>
      {note && <p className="max-w-sm text-sm leading-6 text-[#8a8a8a]">{note}</p>}
      {action}
    </div>
  );
}

/* ── نمایش متن سؤال با توجه به حالت زبان ──
 * en → فقط انگلیسی، fa → فقط فارسی، dual → دوتایی (اسپلیت در دسکتاپ، پشت‌سرهم در موبایل) */
export function BilingualText({ en, fa, mode, as: Tag = 'p', className = '', split = false }) {
  if (mode === 'fa') {
    return <Tag className={className}>{fa}</Tag>;
  }
  if (mode === 'en') {
    return (
      <Tag className={className} dir="ltr">
        {en}
      </Tag>
    );
  }
  return (
    <Tag className={`${className} itl-dual-wrap ${split ? 'itl-dual-split' : ''}`}>
      <span className="itl-dual" dir="ltr">
        {en}
      </span>
      <span className="itl-dual">{fa}</span>
    </Tag>
  );
}

/* ── زمان به شکل mm:ss فارسی ── */
export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return toFa(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
}
