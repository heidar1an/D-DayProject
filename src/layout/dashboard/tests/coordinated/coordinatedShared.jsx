/*
 * قطعات مشترک لایهٔ «آزمون‌های هماهنگ تپش».
 * اعداد فارسی از لایهٔ لیگ reused می‌شوند تا کل داشبورد یک رفتار داشته باشد؛
 * تاریخ‌ها با تقویم شمسی سیستم (Intl fa-IR) نمایش داده می‌شوند.
 */
import { useEffect, useState } from 'react';
import { toFa, faNum } from '../../league/leagueShared';
import { STATUS_META, TYPE_META, getServerTime } from '../../../../services/coordinatedExams/coordinatedExamService';

export { toFa, faNum };
export { STATUS_META, TYPE_META };

/* ── آیکن‌های خطی این لایه (مکمل آیکن‌های لیگ/بین‌الملل) ── */
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
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20v-1a6.5 6.5 0 0 1 13 0v1" />
      <path d="M16 5.4a3.5 3.5 0 0 1 0 6.2M18.5 20v-1a6.4 6.4 0 0 0-2.5-4.9" />
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
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  up: <path d="M12 19V5m-6 6 6-6 6 6" />,
  play: <path d="M8 5.5v13l10-6.5z" />,
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="14.5" r="5.5" />
      <path d="m8.5 9.5-2.7-6M15.5 9.5l2.7-6M12 12.4l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="currentColor" stroke="none" />
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
  warn: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5M12 16h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  shield: <path d="M12 3.5 5.5 6v5.2c0 4 2.7 7.3 6.5 9 3.8-1.7 6.5-5 6.5-9V6z" />,
  logout: (
    <>
      <path d="M14 4.5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-4" />
      <path d="M10 8.5 6.5 12l3.5 3.5M6.5 12H15" />
    </>
  ),
  wifi: (
    <>
      <path d="M4 9.5a12 12 0 0 1 16 0" />
      <path d="M7 13a8 8 0 0 1 10 0" />
      <path d="M10 16.2a4 4 0 0 1 4 0" />
      <path d="M12 19.5h.01" />
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

/* ── نشان وضعیت آزمون — رنگ ملایم روی زمینهٔ tint ── */
export function StatusBadge({ status, meta, size = 'md', className = '' }) {
  const data = meta ?? STATUS_META[status] ?? STATUS_META.UPCOMING;
  return (
    <span
      className={`exm-badge ${size === 'sm' ? 'exm-badge--sm' : ''} ${className}`}
      style={{ background: `${data.accent}16`, color: data.accent, borderColor: `${data.accent}38` }}
    >
      {status === 'LIVE' && <span className="exm-badge__dot" style={{ background: data.accent }} />}
      {data.label}
    </span>
  );
}

export function TypeBadge({ type, className = '' }) {
  const data = TYPE_META[type] ?? { label: 'آزمون', accent: '#8a8a8a' };
  return (
    <span
      className={`exm-badge exm-badge--plain ${className}`}
      style={{ background: 'rgba(255,255,255,0.05)', color: '#c9c9c9' }}
    >
      {data.label}
    </span>
  );
}

/* ── تاریخ شمسی ── */
const dateFmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' });
const weekdayFmt = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' });
const timeFmt = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('fa-IR', { month: 'long' });

export const formatFullDate = (ts) => dateFmt.format(new Date(ts));
export const formatShortDate = (ts) => shortDateFmt.format(new Date(ts));
export const formatWeekday = (ts) => weekdayFmt.format(new Date(ts));
export const formatTime = (ts) => timeFmt.format(new Date(ts));
export const formatMonth = (ts) => monthFmt.format(new Date(ts));

export const formatSchedule = (startTime, endTime) =>
  `${formatWeekday(startTime)} ${formatShortDate(startTime)} — ساعت ${formatTime(startTime)}`;

export function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  if (minutes < 60) return `${toFa(minutes)} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${toFa(hours)} ساعت و ${toFa(rest)} دقیقه` : `${toFa(hours)} ساعت`;
}

export function formatElapsed(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return toFa(`${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
  return toFa(`${minutes}:${String(seconds).padStart(2, '0')}`);
}

/* ── Countdown زنده بر مبنای زمان «سرور» ── */
function splitRemaining(targetTs) {
  const diff = Math.max(0, Math.floor((targetTs - getServerTime()) / 1000));
  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
    done: diff <= 0,
  };
}

export function useCountdown(targetTs) {
  const [state, setState] = useState(() => splitRemaining(targetTs));

  useEffect(() => {
    setState(splitRemaining(targetTs));
    const timer = window.setInterval(() => setState(splitRemaining(targetTs)), 1000);
    return () => window.clearInterval(timer);
  }, [targetTs]);

  return state;
}

export function ExamCountdown({ targetTs, compact = false, className = '' }) {
  const { days, hours, minutes, seconds, done } = useCountdown(targetTs);

  if (done) {
    return (
      <span className={`exm-countdown exm-countdown--done ${className}`} role="timer">
        زمان شروع فرا رسیده است
      </span>
    );
  }

  const cells = [
    { value: days, label: 'روز' },
    { value: hours, label: 'ساعت' },
    { value: minutes, label: 'دقیقه' },
    { value: seconds, label: 'ثانیه' },
  ];

  return (
    <div className={`exm-countdown ${compact ? 'exm-countdown--compact' : ''} ${className}`} role="timer" aria-label="شمارش معکوس تا شروع آزمون">
      {cells.map((cell, index) => (
        <div className="exm-countdown__cell" key={cell.label}>
          <strong>{toFa(String(cell.value).padStart(2, '0'))}</strong>
          <span>{cell.label}</span>
          {index < cells.length - 1 && <i className="exm-countdown__sep" aria-hidden="true">:</i>}
        </div>
      ))}
    </div>
  );
}

/* ── اسکلت لودینگ (هم‌شکل بقیهٔ لایه‌ها) ── */
export function Skeleton({ className = '' }) {
  return <span className={`exm-sk block ${className}`} aria-hidden="true" />;
}

export function EmptyState({ icon = 'calendar', title, note, action }) {
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

/* ── نشان سطح سختی ── */
const DIFFICULTY_META = {
  easy: { label: 'آسان', dots: 1, accent: '#77b787' },
  medium: { label: 'متوسط', dots: 2, accent: '#e0b45c' },
  hard: { label: 'سخت', dots: 3, accent: '#ef9196' },
  very_hard: { label: 'بسیار سخت', dots: 4, accent: '#e26d6d' },
};

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
