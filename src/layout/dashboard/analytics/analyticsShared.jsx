/*
 * قطعات مشترک لایهٔ «تحلیل عملکرد».
 * اعداد فارسی از leagueShared reused می‌شود؛ چارت‌ها SVG سبک و وابسته به هیچ
 * کتابخانه‌ای نیستند تا با سبک خطی داشبورد یکی باشند. هر نمودار Label متنی و
 * aria دارد تا اطلاعات فقط با رنگ منتقل نشود (دسترس‌پذیری).
 */
import { useEffect, useState } from 'react';
import { toFa, faNum } from '../league/leagueShared';
import { MASTERY_STATUSES, ERROR_TYPES, PERFORMANCE_WEIGHTS } from '../../../services/analytics/analyticsEngine';
import { DIFFICULTIES } from '../../../services/testBank/testBankService';

export { toFa, faNum };

/* ── قالب‌بندی زمان و درصد ── */
export function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${faNum(seconds)} ثانیه`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest
    ? `${toFa(minutes)}:${toFa(String(rest).padStart(2, '0'))} دقیقه`
    : `${faNum(minutes)} دقیقه`;
}

export const formatPercent = (value) => (value === null || value === undefined ? '—' : `${faNum(Math.round(value))}٪`);

export const formatSigned = (value) =>
  value === null || value === undefined || value === 0
    ? null
    : `${value > 0 ? '+' : '−'}${faNum(Math.abs(Math.round(value * 10) / 10))}`;

const dateFmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' });
export const formatFullDate = (ts) => (ts ? dateFmt.format(new Date(ts)) : '—');
export const formatShortDate = (ts) => (ts ? shortDateFmt.format(new Date(ts)) : '—');

/* ── آیکن‌های خطی لایهٔ تحلیل ── */
const iconPaths = {
  back: <path d="M9 5l7 7-7 7" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
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
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </>
  ),
  trendUp: (
    <>
      <path d="m3.5 17 5.5-5.5 4 4L20.5 8" />
      <path d="M15 8h5.5v5.5" />
    </>
  ),
  trendDown: (
    <>
      <path d="m3.5 8 5.5 5.5 4-4 7.5 7" />
      <path d="M20.5 11v5.5H15" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
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
  bolt: <path d="M13 3 5.5 13.5H11L10.5 21 18 10.5h-5.5z" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m14 6-6 6 6 6" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
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
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4h-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  puzzle: (
    <>
      <path d="M9.5 4.5a2 2 0 1 1 4 0V6H16a1.5 1.5 0 0 1 1.5 1.5V10h1.5a2 2 0 1 1 0 4H17.5v4.5a1.5 1.5 0 0 1-1.5 1.5h-2.5v-1.5a2 2 0 1 0-4 0V20H6a1.5 1.5 0 0 1-1.5-1.5V14H6a2 2 0 1 0 0-4H4.5V7.5A1.5 1.5 0 0 1 6 6h3.5z" />
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

export function Skeleton({ className = '' }) {
  return <span className={`an-sk block ${className}`} aria-hidden="true" />;
}

export function EmptyState({ icon = 'chart', title, note, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-[#8a8a8a]">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <strong className="mt-1 [font-family:'Doran',Tahoma,sans-serif]">{title}</strong>
      {note && <p className="max-w-md text-sm leading-6 text-[#8a8a8a]">{note}</p>}
      {action}
    </div>
  );
}

/* ── نشان تسلط مبحث ── */
export function MasteryBadge({ mastery, compact = false }) {
  const meta = MASTERY_STATUSES[mastery?.status] ?? MASTERY_STATUSES.NEEDS_DATA;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap"
      style={{ background: `${meta.accent}14`, color: meta.accent }}
      title={mastery?.score !== null && mastery?.score !== undefined ? `امتیاز تسلط: ${faNum(Math.round(mastery.score))} از ۱۰۰` : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.accent }} aria-hidden="true" />
      {compact && meta.label.length > 12 ? meta.label.split(' ')[0] : meta.label}
    </span>
  );
}

/* ── جهت روند — آیکن + عدد، نه فقط رنگ ── */
export function TrendArrow({ direction, delta, className = '' }) {
  if (!direction) {
    return <span className={`inline-flex items-center gap-1 text-[11px] text-[#777] ${className}`}>نمونهٔ کافی نیست</span>;
  }
  const up = direction === 'up';
  const flat = direction === 'flat';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${className}`}
      style={{ color: flat ? '#9a9a9a' : up ? '#61D192' : '#e26d6d' }}
    >
      <Icon name={flat ? 'trendUp' : up ? 'trendUp' : 'trendDown'} className="h-3.5 w-3.5" />
      {flat ? 'بدون تغییر' : `${up ? '+' : '−'}${faNum(Math.abs(delta ?? 0))}`}
    </span>
  );
}

/* ── دلتای KPI نسبت به دورهٔ قبل ── */
export function DeltaPill({ delta, goodDirection = 'up', suffix = '' }) {
  if (delta === null || delta === undefined || delta === 0) {
    return <span className="text-[11px] text-[#777]">بدون تغییر نسبت به دورهٔ قبل</span>;
  }
  const improved = goodDirection === 'up' ? delta > 0 : delta < 0;
  const color = improved ? '#61D192' : '#e26d6d';
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${color}14`, color }}>
      <Icon name={delta > 0 ? 'trendUp' : 'trendDown'} className="h-3 w-3" />
      {`${delta > 0 ? '+' : '−'}${faNum(Math.abs(Math.round(delta * 10) / 10))}${suffix}`}
      <span className="font-normal text-[#999]">نسبت به دورهٔ قبل</span>
    </span>
  );
}

/* ── نشان سختی ── */
export function DifficultyBadge({ difficulty, className = '' }) {
  const meta = DIFFICULTIES[difficulty];
  if (!meta) return null;
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

export const difficultyLabel = (difficulty) => DIFFICULTIES[difficulty]?.label ?? difficulty;
export const errorTypeLabel = (type) => ERROR_TYPES[type]?.label ?? 'ثبت‌نشده';

/* ── کارت پایهٔ بخش ── */
export function Card({ title, icon, hint, action, children, className = '', ariaLabel }) {
  return (
    <section className={`rounded-[2rem] border border-white/8 bg-[#242426] p-5 md:p-6 ${className}`} aria-label={ariaLabel ?? title}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-bold [font-family:'Doran',Tahoma,sans-serif]">
              {icon && <Icon name={icon} className="h-4.5 w-4.5 text-[#61D192]" />}
              {title}
            </h2>
            {hint && <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* ── نوار افقی (مقیاس درصدی) ── */
export function BarRow({ label, value, max = 100, accent = '#61D192', right, hint, onClick, subLabel }) {
  const width = Math.max(2, Math.min(100, (value ?? 0) / max * 100));
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-right ${onClick ? 'an-row-click cursor-pointer rounded-2xl p-2 -m-2 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[#61D192]' : ''}`}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 font-semibold" style={{ color: accent }}>{right ?? (value !== null && value !== undefined ? `${faNum(Math.round(value))}٪` : '—')}</span>
      </div>
      <div className="an-bar" role="img" aria-label={hint ?? `${label}: ${value !== null && value !== undefined ? faNum(Math.round(value)) : 'بدون داده'}`}>
        <span className="an-bar__fill" style={{ width: `${width}%`, background: accent }} />
      </div>
      {subLabel && <p className="mt-1 text-[11px] text-[#777]">{subLabel}</p>}
    </Tag>
  );
}

/* ── حلقهٔ امتیاز ── */
export function RingScore({ score, size = 132, stroke = 11, accent = '#61D192', label, sub }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score ?? 0));
  const offset = circumference * (1 - progress / 100);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="an-ring -rotate-90" role="img" aria-label={`${label ?? 'امتیاز'}: ${faNum(Math.round(progress))} از ۱۰۰`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <strong className="block text-2xl font-extrabold [font-family:'Doran',Tahoma,sans-serif]" style={{ color: accent }}>
          {score === null || score === undefined ? '—' : faNum(Math.round(score))}
        </strong>
        {label && <span className="text-[11px] text-[#999]">{label}</span>}
        {sub && <span className="block text-[10px] text-[#777]">{sub}</span>}
      </div>
    </div>
  );
}

/* ── نمودار خطی روند (X: زمان، Y: metric) ── */
export function TrendChart({ points, accent = '#61D192', height = 190, ariaLabel, yMax = 100, markerEvents = [], emptyNote }) {
  const width = 640;
  const padX = 14;
  const padTop = 16;
  const padBottom = 26;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const valid = points.filter((point) => point.value !== null && point.value !== undefined);

  if (valid.length < 2) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-10 text-sm text-[#777]" style={{ height }}>
        {emptyNote ?? 'دادهٔ کافی برای رسم این نمودار نیست'}
      </div>
    );
  }

  const step = innerW / (points.length - 1);
  const xOf = (index) => padX + index * step;
  const yOf = (value) => padTop + innerH * (1 - Math.max(0, Math.min(yMax, value)) / yMax);

  /* خط شکسته: از نقاط null عبور نمی‌کند */
  const segments = [];
  let current = [];
  points.forEach((point, index) => {
    if (point.value === null || point.value === undefined) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ x: xOf(index), y: yOf(point.value) });
    }
  });
  if (current.length) segments.push(current);

  const lastValidIndex = valid.length ? points.map((p) => p.value != null).lastIndexOf(true) : null;
  const lastPoint = lastValidIndex >= 0 ? { x: xOf(lastValidIndex), y: yOf(points[lastValidIndex].value) } : null;

  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {/* خطوط راهنمای افقی */}
        {[0, 0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padX}
            x2={width - padX}
            y1={padTop + innerH * ratio}
            y2={padTop + innerH * ratio}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        ))}
        {/* نشانگرهای آزمون */}
        {markerEvents.map((event) => (
          <g key={event.id}>
            <line x1={xOf(event.dayIndex)} x2={xOf(event.dayIndex)} y1={padTop - 4} y2={height - padBottom} stroke="rgba(224,180,92,0.4)" strokeWidth="1.2" strokeDasharray="3 3" />
            <circle cx={xOf(event.dayIndex)} cy={padTop - 4} r="3" fill="#e0b45c" />
          </g>
        ))}
        {segments.map((segment, index) => (
          <polyline
            key={index}
            points={segment.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={accent}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {lastPoint && <circle cx={lastPoint.x} cy={lastPoint.y} r="3.6" fill={accent} stroke="#1b1b1e" strokeWidth="2" />}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[10px] text-[#777]" dir="rtl">
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor(points.length / 2)]?.label}</span>
        <span>امروز</span>
      </div>
    </div>
  );
}

/* ── ستون‌های عمودی (توزیع) ── */
export function ColumnChart({ columns, height = 160, ariaLabel }) {
  const max = Math.max(...columns.map((column) => column.value ?? 0), 1);
  return (
    <div className="flex items-end justify-around gap-2" role="img" aria-label={ariaLabel} style={{ height }}>
      {columns.map((column) => {
        const ratio = (column.value ?? 0) / max;
        return (
          <div key={column.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold" style={{ color: column.accent }}>
              {column.value === null ? '—' : (column.display ?? faNum(Math.round(column.value)))}
            </span>
            <div className="w-full max-w-12 rounded-t-lg bg-white/[0.05]" style={{ height: Math.max(4, ratio * (height - 52)) }}>
              <div className="an-bar__fill h-full rounded-t-lg" style={{ width: '100%', background: column.accent, height: `${ratio * 100}%` }} />
            </div>
            <span className="max-w-full truncate text-center text-[10.5px] leading-4 text-[#999]">{column.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── دونات سهمی‌ها ── */
export function DonutChart({ segments, size = 150, stroke = 20, centerLabel, centerSub, ariaLabel }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let consumed = 0;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={ariaLabel}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {total > 0 &&
          segments.map((segment) => {
            const fraction = segment.value / total;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const offset = -consumed * circumference;
            consumed += fraction;
            return (
              <circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.accent}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            );
          })}
      </svg>
      <div className="absolute text-center">
        <strong className="block text-xl font-extrabold [font-family:'Doran',Tahoma,sans-serif]">{centerLabel}</strong>
        {centerSub && <span className="text-[10px] text-[#888]">{centerSub}</span>}
      </div>
    </div>
  );
}

/* ── کارت Insight ── */
const SEVERITY_META = {
  warning: { icon: 'alert', accent: '#e26d6d', label: 'مهم' },
  notice: { icon: 'info', accent: '#e0b45c', label: 'قابل توجه' },
  positive: { icon: 'check', accent: '#61D192', label: 'نقطهٔ قوت' },
};

export function InsightCard({ insight, onAction }) {
  const meta = SEVERITY_META[insight.severity] ?? SEVERITY_META.notice;
  return (
    <article
      className="rounded-2xl border p-4"
      style={{ borderColor: `${meta.accent}30`, background: `${meta.accent}08` }}
      aria-label={`بینش: ${insight.title}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ background: `${meta.accent}18`, color: meta.accent }}>
          <Icon name={meta.icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-bold" style={{ color: meta.accent }}>
            {insight.title}
          </h3>
          <p className="mt-1 text-[12.5px] leading-6 text-[#c9c9c9]">{insight.description}</p>
          {insight.evidence && (
            <p className="an-evidence mt-2 text-[11px] text-[#8a8a8a]">
              <span className="an-evidence__tag">مستند</span>
              {insight.evidence}
            </p>
          )}
          {(insight.action || onAction) && (
            <button
              type="button"
              onClick={() => onAction?.(insight)}
              className="mt-2.5 cursor-pointer rounded-xl bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-semibold text-[#ddd] transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-[#61D192]"
            >
              {insight.action ?? 'مشاهده'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── کارت پیشنهاد (اقدام بعدی) ── */
export function RecommendationCard({ recommendation, onRun }) {
  return (
    <article className="an-rec flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#2a2a2d] p-4" aria-label={`پیشنهاد: ${recommendation.title}`}>
      <div className="min-w-0">
        <h3 className="text-[13.5px] font-bold text-[#eaf6ef]">{recommendation.title}</h3>
        <p className="mt-1 text-[12px] leading-6 text-[#9a9a9a]">{recommendation.description}</p>
      </div>
      <button
        type="button"
        onClick={() => onRun?.(recommendation)}
        className="shrink-0 cursor-pointer rounded-xl bg-[#61D192] px-3.5 py-2 text-[12px] font-bold text-[#12271a] transition-colors hover:bg-[#5ac187] focus-visible:outline-2 focus-visible:outline-white"
      >
        {recommendation.actionLabel}
      </button>
    </article>
  );
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
      className="an-fade fixed inset-0 z-[95] grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="an-pop rounded-[1.8rem] border border-white/10 bg-[#222225] p-6" style={{ width }} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ── چیپ فیلتر فعال ── */
export function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`an-chip ${active ? 'an-chip--on' : ''}`}
    >
      {children}
    </button>
  );
}

/* یادداشت وزن‌های امتیاز عملکرد — برای توضیح شفاف UI */
export const PERFORMANCE_WEIGHT_LABELS = {
  accuracy: 'دقت',
  consistency: 'ثبات',
  speed: 'سرعت',
  difficulty: 'سطح دشواری',
  recency: 'روند اخیر',
};
export { PERFORMANCE_WEIGHTS };
