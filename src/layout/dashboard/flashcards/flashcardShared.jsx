/*
 * قطعات مشترک لایهٔ فلش‌کارت.
 * ابزارهای عمومی (اعداد فارسی، اسکلت، نوار پیشرفت، EmptyState) از leagueShared استفاده مجدد
 * می‌شوند تا یک زبان بصری در کل داشبورد بماند؛ اینجا فقط اجزای اختصاصی فلش‌کارت است.
 */
import { useEffect } from 'react';
import { EmptyState, Icon as LeagueIcon, ProgressBar, Skeleton, faNum, toFa } from '../league/leagueShared';
import { STATE_LABELS } from '../../../services/flashcards/spacedRepetition';

export { EmptyState, ProgressBar, Skeleton, faNum, toFa };

/* رنگ هر حالت یادگیری — از پالت فعلی تپش، بدون رنگ جدید */
export const STATE_STYLES = {
  new: { color: 'var(--blue-ink)', bg: 'rgba(91,140,199,0.12)' },
  learning: { color: 'var(--gold-ink)', bg: 'rgba(224,180,92,0.12)' },
  review: { color: 'var(--purple-ink)', bg: 'rgba(147,127,205,0.14)' },
  relearning: { color: 'var(--red-ink)', bg: 'rgba(239,145,150,0.12)' },
  mastered: { color: 'var(--green-ink)', bg: 'rgba(119,183,135,0.13)' },
  suspended: { color: 'var(--faint)', bg: 'rgb(var(--ink-rgb) / 0.12)' },
  archived: { color: 'var(--faint)', bg: 'rgb(var(--ink-rgb) / 0.12)' },
};

/* آیکن‌های اختصاصی فلش‌کارت */
const fcIconPaths = {
  cards: (
    <>
      <rect x="3" y="7" width="13" height="14" rx="2.5" />
      <path d="M8 3.5h10.5A2.5 2.5 0 0 1 21 6v10.5" />
    </>
  ),
  layers: <path d="m12 3 9 5-9 5-9-5zM3.8 12.5 12 17l8.2-4.5M3.8 16.5 12 21l8.2-4.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  edit: <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 6.5l3 3" />,
  star: <path d="m12 3 2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 17.2l-5.8 3.6 1.6-6.6-5.2-4.4 6.8-.5z" />,
  'star-filled': <path fill="currentColor" stroke="none" d="m12 3 2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 17.2l-5.8 3.6 1.6-6.6-5.2-4.4 6.8-.5z" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" />,
  archive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5" />
      <path d="M5.5 9v9A1.5 1.5 0 0 0 7 19.5h10a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4" />
    </>
  ),
  trash: <path d="M4.5 6.5h15M9.5 6V4.5A1 1 0 0 1 10.5 3.5h3a1 1 0 0 1 1 1V6M6.5 6.5l1 13h9l1-13M10 10.5v5M14 10.5v5" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8 13.9 5h2.8l.7 2.7 2.4 1.4-.7 2.8.7 2.8-2.4 1.4-.7 2.7h-2.8L12 21.2 10.1 19H7.3l-.7-2.7-2.4-1.4.7-2.8-.7-2.8 2.4-1.4L7.3 5h2.8z" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="M11 19l-7-7 7-7M4 12h16" />,
  tag: (
    <>
      <path d="M3.5 12.5v-7a2 2 0 0 1 2-2h7L21 12l-8.5 8.5z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m4.5 18 5-5 3.5 3.5L16 13l3.5 4" />
    </>
  ),
  zap: <path d="M13 3 5 13.5h5L10 21l8-10.5h-5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  flame: <path d="M12 22c4 0 7-2.8 7-6.8 0-3.1-1.9-5.3-3.4-7-.4-.4-1-.2-1.1.3-.2 1.1-.7 2.3-1.5 3-.1-2.3-1.3-5.4-3.6-7-.4-.3-.9 0-.9.4 0 2-1 3.4-2 4.7C5.5 11 5 12.9 5 15.2 5 19.2 8 22 12 22z" />,
  library: <path d="M4 5v15M8 5v15M12.5 5.5 17 20M20 6.5 16 20" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </>
  ),
  redo: <path d="M20 8v6h-6M20 13a8 8 0 1 0-2.3 6" />,
  question: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.3A2.5 2.5 0 0 1 14.5 10c0 1.7-2.5 2-2.5 3.5M12 17h.01" />
    </>
  ),
};

export function Icon({ name, className = 'h-[18px] w-[18px]', strokeWidth = 1.9, style }) {
  if (LeagueIcon && fcIconPaths[name] == null) {
    /* آیکن‌های مشترک (flame، clock و…) از بانک لیگ — بدون تکرار */
    const leagueNames = ['flame', 'clock', 'calendar', 'warn', 'spark', 'book', 'brain', 'check', 'up', 'users', 'target', 'star'];
    if (leagueNames.includes(name)) {
      return <LeagueIcon name={name} className={className} strokeWidth={strokeWidth} style={style} />;
    }
  }
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
      {fcIconPaths[name] ?? fcIconPaths.cards}
    </svg>
  );
}

/* نشان حالت یادگیری — رنگ + متن (رنگ هرگز تنها حامل معنا نیست) */
export function StateChip({ state, className = '' }) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.new;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${className}`}
      style={{ background: style.bg, color: style.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.color }} />
      {STATE_LABELS[state] ?? state}
    </span>
  );
}

/* حلقهٔ تسلط مینیمال — SVG سبک، بدون کتابخانه */
export function MasteryRing({ value = 0, size = 56, stroke = 5, color = '#5b8cc7', label }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`تسلط ${toFa(clamped)} درصد`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--wash-rgb) / 0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 700ms ease' }}
        />
      </svg>
      <span className="absolute text-center [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ fontSize: size * 0.24 }}>
        {toFa(clamped)}
        <span className="block text-[9px] text-[var(--faint)]" style={{ fontSize: size * 0.15 }}>{label ?? '٪'}</span>
      </span>
    </span>
  );
}

/* مودال پایه — Escape می‌بندد، کلیک روی پس‌زمینه می‌بندد، فوکوس‌پذیر */
export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="بستن" className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className={`fc-modal relative max-h-[88vh] w-full overflow-y-auto rounded-[2rem] border border-white/10 bg-[var(--surface)] p-6 shadow-[0_32px_80px_-24px_rgb(var(--shadow-rgb) / 0.9)] md:p-8 ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <header className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg [font-family:'Doran','Vazir',Tahoma,sans-serif]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl bg-white/5 text-[var(--muted)] transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/* نمایش بدنهٔ کارت با رندر Cloze */
export function renderCloze(text, { revealed = false, highlight = false } = {}) {
  if (!text) return null;
  const parts = [];
  const regex = /\{\{c(\d+)::(.*?)\}\}/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, match.index), key: `t${key}` });
    key += 1;
    if (revealed) {
      parts.push({ type: 'cloze-open', value: match[2], key: `c${key}` });
    } else {
      parts.push({ type: 'cloze-hidden', value: `جای خالی ${toFa(match[1])}`, key: `h${key}` });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex), key: `t${key}` });

  return parts.map((part) => {
    if (part.type === 'text') return <span key={part.key}>{part.value}</span>;
    if (part.type === 'cloze-open') {
      return (
        <mark key={part.key} className="fc-cloze fc-cloze--open">
          {part.value}
        </mark>
      );
    }
    return (
      <mark key={part.key} className="fc-cloze fc-cloze--hidden">
        {part.value}
      </mark>
    );
  });
}

/* برچسب کوچک اطلاعاتی */
export function InfoChip({ icon, children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs text-[var(--muted)] ${className}`}>
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}
