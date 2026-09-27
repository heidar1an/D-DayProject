/*
 * قطعات مشترک لایهٔ «تحلیل عملکرد».
 * اعداد فارسی از leagueShared reused می‌شود؛ چارت‌ها SVG سبک و وابسته به هیچ
 * کتابخانه‌ای نیستند تا با سبک خطی داشبورد یکی باشند. هر نمودار Label متنی و
 * aria دارد تا اطلاعات فقط با رنگ منتقل نشود (دسترس‌پذیری).
 */
import { useEffect, useId, useRef, useState } from 'react';
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
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-8 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-white/5 text-[var(--faint)]">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <strong className="mt-1 text-[13.5px] [font-family:'Doran','Vazir',Tahoma,sans-serif]">{title}</strong>
      {note && <p className="max-w-md text-[12.5px] leading-6 text-[var(--faint)]">{note}</p>}
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
    return <span className={`inline-flex items-center gap-1 text-[11px] text-[var(--faint)] ${className}`}>نمونهٔ کافی نیست</span>;
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
    return <span className="text-[11px] text-[var(--faint)]">بدون تغییر نسبت به دورهٔ قبل</span>;
  }
  const improved = goodDirection === 'up' ? delta > 0 : delta < 0;
  const color = improved ? '#61D192' : '#e26d6d';
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${color}14`, color }}>
      <Icon name={delta > 0 ? 'trendUp' : 'trendDown'} className="h-3 w-3" />
      {`${delta > 0 ? '+' : '−'}${faNum(Math.abs(Math.round(delta * 10) / 10))}${suffix}`}
      <span className="font-normal text-[var(--faint)]">نسبت به دورهٔ قبل</span>
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
    <section className={`rounded-3xl border border-white/8 bg-[var(--surface)] p-4 md:p-[18px] ${className}`} aria-label={ariaLabel ?? title}>
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-[14.5px] font-bold [font-family:'Doran','Vazir',Tahoma,sans-serif]">
              {icon && <Icon name={icon} className="h-4 w-4 text-[var(--green-ink)]" />}
              {title}
            </h2>
            {hint && <p className="mt-1 max-w-3xl text-[11.5px] leading-5 text-[var(--faint)]">{hint}</p>}
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
      className={`w-full text-right ${onClick ? 'an-row-click cursor-pointer rounded-2xl p-2 -m-2 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--green-vivid)]' : ''}`}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 font-semibold" style={{ color: accent }}>{right ?? (value !== null && value !== undefined ? `${faNum(Math.round(value))}٪` : '—')}</span>
      </div>
      <div className="an-bar" role="img" aria-label={hint ?? `${label}: ${value !== null && value !== undefined ? faNum(Math.round(value)) : 'بدون داده'}`}>
        <span className="an-bar__fill" style={{ width: `${width}%`, background: accent }} />
      </div>
      {subLabel && <p className="mt-1 text-[11px] text-[var(--faint)]">{subLabel}</p>}
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--wash-rgb) / 0.07)" strokeWidth={stroke} />
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
        <strong className="block text-2xl font-extrabold [font-family:'Doran','Vazir',Tahoma,sans-serif]" style={{ color: accent }}>
          {score === null || score === undefined ? '—' : faNum(Math.round(score))}
        </strong>
        {label && <span className="text-[11px] text-[var(--faint)]">{label}</span>}
        {sub && <span className="block text-[10px] text-[var(--faint)]">{sub}</span>}
      </div>
    </div>
  );
}

/* ── هندسهٔ مشترک نمودارها — هم‌زبان نمودار داشبورد (heart-chart) ── */
const CHART_PAD = { top: 26, right: 46, bottom: 30, left: 10 };
const clampNum = (value, min, max) => Math.min(Math.max(value, min), max);
const round2 = (value) => Math.round(value * 100) / 100;

/* پله‌های خوش‌خوان برای محور عمودی */
const CHART_NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function niceCeil(value) {
  if (!value || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  return (CHART_NICE_STEPS.find((step) => normalized <= step) ?? 10) * magnitude;
}

/* میله با گوشه‌های گرد فقط در سمت بالا — همان ریاضی heart-chart */
function topRoundedBar(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  if (rr <= 0) return `M${x},${y} H${x + w} V${y + h} H${x} Z`;
  return [
    `M${x},${y + h}`,
    `V${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `H${x + w - rr}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}

/* منحنی نرم (Catmull-Rom → بزیه) با کنترل‌پوینت کلمپ‌شده — همان ریاضی heart-chart */
function smoothLinePath(coords, top, bottom) {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M${round2(coords[0].x)},${round2(coords[0].y)}`;
  const tension = 0.18;
  let d = `M${round2(coords[0].x)},${round2(coords[0].y)}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = clampNum(p1.y + (p2.y - p0.y) * tension, top, bottom);
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = clampNum(p2.y - (p3.y - p1.y) * tension, top, bottom);
    d += ` C${round2(c1x)},${round2(c1y)} ${round2(c2x)},${round2(c2y)} ${round2(p2.x)},${round2(p2.y)}`;
  }
  return d;
}

/* اندازهٔ واقعی پلات با ResizeObserver — svg با پیکسل واقعی ساخته می‌شود، بدون کشیدگی */
function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

/* ── نمودار خطی روند (X: زمان، Y: سنجه) — هم‌زبان نمودار داشبورد ── */
/*
 * زبان بصری heart-chart: محور عمودی راست (RTL)، منحنی نرم با ناحیهٔ گرادیانی،
 * خط‌چین میانگین با چیپ شناور، ستون‌های hover با هاله و تولتیپ کارتی،
 * ضربان روی آخرین روزِ دارای داده و نشانگر طلایی آزمون‌ها.
 */
export function TrendChart({
  points,
  accent = '#61D192',
  height = 216,
  ariaLabel,
  yMax = 100,
  yMin = 0,
  markerEvents = [],
  emptyNote,
  valueFormat,
  unit = '',
}) {
  const [plotRef, size] = useElementSize();
  const [hover, setHover] = useState(null);
  const areaId = useId();

  /*
   * height='auto' → ارتفاع نمودار از کادرِ کنارش می‌آید (مثلاً ستون کادرهای خلاصه)
   * تا دو ستون هم‌قد شوند؛ کف ۲۱۶ پیکسل تا در ستون تک‌نفره لاغر نشود.
   */
  const autoHeight = height === 'auto';
  const boxHeight = autoHeight ? Math.max(size.height || 0, 216) : height;

  const format = valueFormat ?? ((value) => `${faNum(Math.round(value))}${unit}`);
  const valid = points.filter((point) => point.value !== null && point.value !== undefined);

  if (valid.length < 2) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-10 text-sm text-[var(--faint)]" style={{ height }}>
        {emptyNote ?? 'دادهٔ کافی برای رسم این نمودار نیست'}
      </div>
    );
  }

  const width = size.width;
  if (width < 80) {
    return <div ref={plotRef} className="an-chart__plot" style={{ height }} aria-label={ariaLabel} />;
  }

  const pad = CHART_PAD;
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = boxHeight - pad.top - pad.bottom;
  const baseline = pad.top + plotH;
  const span = Math.max(1, yMax - yMin);
  const slot = plotW / points.length;
  const centerX = (index) => pad.left + slot * index + slot / 2;
  const topY = (value) => baseline - ((clampNum(value, yMin, yMax) - yMin) / span) * plotH;

  const coords = [];
  points.forEach((point, index) => {
    if (point.value !== null && point.value !== undefined) coords.push({ x: centerX(index), y: topY(point.value), point, index });
  });

  const linePath = smoothLinePath(coords, pad.top, baseline);
  const areaPath = coords.length > 1 ? `${linePath} L${round2(coords[coords.length - 1].x)},${baseline} L${round2(coords[0].x)},${baseline} Z` : '';

  const average = valid.reduce((total, point) => total + point.value, 0) / valid.length;
  const avgY = topY(average);
  const showAvg = avgY > pad.top + 10;

  const lastIndex = points.map((point) => point.value != null).lastIndexOf(true);
  const current = lastIndex >= 0 ? { x: centerX(lastIndex), y: topY(points[lastIndex].value) } : null;

  const hovered = hover !== null ? points[hover] : null;
  const hoveredHasValue = hovered && hovered.value !== null && hovered.value !== undefined;
  const tooltipBottom = hoveredHasValue
    ? clampNum(topY(hovered.value) + 14, 0, boxHeight - 88)
    : clampNum(boxHeight * 0.42, 0, boxHeight - 88);

  return (
    <div
      ref={plotRef}
      className={`an-chart__plot ${hover !== null ? 'is-hovering' : ''}`}
      style={{
        height: autoHeight ? undefined : boxHeight,
        minHeight: autoHeight ? 216 : undefined,
        '--an-accent': accent,
        '--an-accent-soft': `${accent}2b`,
        '--an-pad-bottom': `${pad.bottom}px`,
      }}
      role="img"
      aria-label={ariaLabel}
      onMouseLeave={() => setHover(null)}
    >
      <svg className="an-chart__svg" width={width} height={boxHeight} viewBox={`0 0 ${width} ${boxHeight}`} aria-hidden="true">
        <defs>
          <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
            <stop offset="62%" stopColor={accent} stopOpacity="0.08" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* خطوط راهنما + محور عمودی سمت راست — هم‌چینش heart-chart */}
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = yMax - (span / 4) * tick;
          const y = pad.top + (plotH / 4) * tick;
          return (
            <g key={`tick-${tick}`}>
              <line className={`an-chart__grid ${tick === 4 ? 'an-chart__grid--base' : ''}`} x1={pad.left} x2={pad.left + plotW} y1={y} y2={y} />
              <text className="an-chart__ylabel" x={width - 8} y={y + 3.5} textAnchor="end">
                {faNum(Math.round(value))}
              </text>
            </g>
          );
        })}

        {/* نشانگر آزمون‌های بازه */}
        {markerEvents.map((event) => (
          <g key={event.id}>
            <line x1={centerX(event.dayIndex)} x2={centerX(event.dayIndex)} y1={pad.top - 6} y2={baseline} stroke="rgba(224,180,92,0.42)" strokeWidth="1.2" strokeDasharray="3 3">
              <title>{event.title}</title>
            </line>
            <circle cx={centerX(event.dayIndex)} cy={pad.top - 8} r="3.2" fill="var(--gold-ink)">
              <title>{event.title}</title>
            </circle>
          </g>
        ))}

        {/* ناحیهٔ گرادیانی زیر منحنی */}
        {areaPath && <path d={areaPath} fill={`url(#${areaId})`} />}

        {/* خط راهنمای hover */}
        {hover !== null && hoveredHasValue && (
          <line className="an-chart__guide" x1={centerX(hover)} x2={centerX(hover)} y1={pad.top} y2={baseline} />
        )}

        {/* منحنی نرم روند */}
        <path className="an-chart__line-stroke" d={linePath} pathLength="1" />

        {/* نقاط داده */}
        {coords.map((coord, dotIndex) => (
          <g key={`dot-${coord.point.key ?? coord.index}`} className={`an-chart__dot-wrap ${hover === coord.index ? 'is-hover' : ''}`} style={{ '--i': dotIndex }}>
            {hover === coord.index && <circle cx={coord.x} cy={coord.y} r="9" fill={`${accent}24`} />}
            <circle
              className={`an-chart__dot ${coord.index === lastIndex ? 'is-current' : ''} ${hover === coord.index ? 'is-hover' : ''}`}
              cx={coord.x}
              cy={coord.y}
              r={points.length > 45 ? 2 : 3.1}
            />
          </g>
        ))}

        {/* ضربان آخرین روزِ دارای داده */}
        {current && (
          <g>
            <circle className="an-chart__pulse-ring" cx={current.x} cy={current.y} r="4" />
            <circle className="an-chart__pulse-dot" cx={current.x} cy={current.y} r="3" />
          </g>
        )}

        {/* خط‌چین میانگین بازه */}
        {showAvg && (
          <g className="an-chart__avg">
            <line x1={pad.left} x2={pad.left + plotW} y1={avgY} y2={avgY} strokeDasharray="3 7" strokeLinecap="round" />
          </g>
        )}
      </svg>

      {/* چیپ میانگین — شناور روی ناحیهٔ ترسیم */}
      {showAvg && (
        <span className="an-chart__avg-chip" style={{ top: `${round2(avgY)}px` }}>
          میانگین {format(average)}
        </span>
      )}

      {/* ستون‌های hover — چپ و عرض از همان هندسهٔ svg */}
      <div className="an-chart__overlay">
        {points.map((point, index) => (
          <div
            key={`col-${point.key ?? index}`}
            className={`an-chart__column ${hover === index ? 'is-hover' : ''}`}
            style={{ left: `${round2(pad.left + slot * index)}px`, width: `${round2(slot)}px` }}
            aria-hidden="true"
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </div>

      {/* تولتیپ روز انتخاب‌شده */}
      {hovered && (
        <div className="an-chart__tooltip" style={{ left: `${clampNum(centerX(hover), 84, width - 84)}px`, bottom: `${tooltipBottom}px` }}>
          <span className="an-chart__tooltip-title">{hovered.fullLabel ?? hovered.label}</span>
          <strong className="an-chart__tooltip-value">{hoveredHasValue ? format(hovered.value) : 'بدون داده'}</strong>
          <span className="an-chart__tooltip-sub">{faNum(hovered.count ?? 0)} تست در این روز</span>
        </div>
      )}

      {/* برچسب‌های محور افقی — داخل پلات، هم‌چینش heart-chart */}
      <div className="pointer-events-none absolute bottom-1 flex items-start justify-between text-[10px] text-[var(--faint)]" dir="ltr" style={{ left: pad.left, right: pad.right + 8 }}>
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor((points.length - 1) / 2)]?.label}</span>
        <span>{points[points.length - 1]?.isToday ? 'امروز' : points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* ── ستون‌های عمودی (توزیع) — هم‌زبان حالت میله‌ای heart-chart ── */
export function ColumnChart({ columns, height = 160, ariaLabel }) {
  const [plotRef, size] = useElementSize();
  const [hover, setHover] = useState(null);
  const gradientId = useId();

  const width = size.width;
  const values = columns.map((column) => column.value ?? 0);
  const max = Math.max(...values, 1);
  const yMax = max > 100 ? niceCeil(max * 1.06) : 100;

  if (columns.length === 0) return null;

  if (width < 80) {
    return <div ref={plotRef} className="an-chart__plot" style={{ height }} aria-label={ariaLabel} />;
  }

  const pad = CHART_PAD;
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const baseline = pad.top + plotH;
  const slot = plotW / columns.length;
  const barW = clampNum(slot * 0.52, 12, 32);
  const centerX = (index) => pad.left + slot * index + slot / 2;
  const topY = (value) => baseline - ((value ?? 0) / yMax) * plotH;

  const accents = [...new Set(columns.map((column) => column.accent))];
  const hovered = hover !== null ? columns[hover] : null;

  return (
    <div
      ref={plotRef}
      className={`an-chart__plot ${hover !== null ? 'is-hovering' : ''}`}
      style={{ height, '--an-pad-bottom': `${pad.bottom}px` }}
      role="img"
      aria-label={ariaLabel}
      onMouseLeave={() => setHover(null)}
    >
      <svg className="an-chart__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <defs>
          {accents.map((accent) => (
            <linearGradient key={accent} id={`${gradientId}-${accent.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.55" />
            </linearGradient>
          ))}
        </defs>

        {/* خطوط راهنما + محور عمودی سمت راست */}
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = yMax - (yMax / 4) * tick;
          const y = pad.top + (plotH / 4) * tick;
          return (
            <g key={`tick-${tick}`}>
              <line className={`an-chart__grid ${tick === 4 ? 'an-chart__grid--base' : ''}`} x1={pad.left} x2={pad.left + plotW} y1={y} y2={y} />
              <text className="an-chart__ylabel" x={width - 8} y={y + 3.5} textAnchor="end">
                {faNum(Math.round(value))}
              </text>
            </g>
          );
        })}

        {/* میله‌های گرد گرادیانی + شبح مقدار خالی */}
        {columns.map((column, index) => {
          const x = pad.left + slot * index + (slot - barW) / 2;
          const value = column.value ?? 0;
          const barHeight = value > 0 ? Math.max(4, (value / yMax) * plotH) : 0;
          const y = baseline - barHeight;
          return (
            <g key={column.key} className={`an-chart__bar ${hover === index ? 'is-hover' : ''}`} style={{ '--i': index }}>
              {value > 0 && <path d={topRoundedBar(x, y, barW, barHeight, Math.min(8, barW / 2))} fill={`url(#${gradientId}-${column.accent.slice(1)})`} />}
              {!value && <rect className="an-chart__ghost" x={x} y={baseline - 3} width={barW} height={3} rx={1.5} />}
            </g>
          );
        })}

        {/* مقدار بالای میله + برچسب پایین — بیرون از گروه میله تا با scaleY کج نشوند */}
        {columns.map((column, index) => (
          <g key={`label-${column.key}`}>
            <text className="an-chart__ylabel" x={centerX(index)} y={topY(column.value) - 8} textAnchor="middle" style={{ fill: column.value ? column.accent : 'var(--faint)', fontWeight: 600 }}>
              {column.value === null ? '—' : (column.display ?? faNum(Math.round(column.value)))}
            </text>
            <text className="an-chart__ylabel" x={centerX(index)} y={height - 10} textAnchor="middle">
              {column.label}
            </text>
          </g>
        ))}
      </svg>

      {/* ستون‌های hover */}
      <div className="an-chart__overlay">
        {columns.map((column, index) => (
          <div
            key={`col-${column.key}`}
            className={`an-chart__column ${hover === index ? 'is-hover' : ''}`}
            style={{ left: `${round2(pad.left + slot * index)}px`, width: `${round2(slot)}px` }}
            aria-hidden="true"
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </div>

      {/* تولتیپ ستون */}
      {hovered && (
        <div className="an-chart__tooltip" style={{ left: `${clampNum(centerX(hover), 84, Math.max(168, width - 84))}px`, bottom: `${clampNum(topY(hovered.value) + 14, 0, height - 88)}px` }}>
          <span className="an-chart__tooltip-title">{hovered.label}</span>
          <strong className="an-chart__tooltip-value">{hovered.value === null ? '—' : (hovered.display ?? faNum(Math.round(hovered.value)))}</strong>
        </div>
      )}
    </div>
  );
}

/* ── دونات سهمی‌ها ── */
export function DonutChart({ segments, size = 150, stroke = 20, centerLabel, centerSub, ariaLabel, compact = false }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let consumed = 0;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={ariaLabel}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--wash-rgb) / 0.06)" strokeWidth={stroke} />
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
        <strong className={`block font-extrabold [font-family:'Doran','Vazir',Tahoma,sans-serif] ${compact ? 'text-base' : 'text-xl'}`}>{centerLabel}</strong>
        {centerSub && <span className={`block ${compact ? 'text-[9px]' : 'text-[10px]'} text-[var(--faint)]`}>{centerSub}</span>}
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
          <p className="mt-1 text-[12.5px] leading-6 text-[var(--muted)]">{insight.description}</p>
          {insight.evidence && (
            <p className="an-evidence mt-2 text-[11px] text-[var(--faint)]">
              <span className="an-evidence__tag">مستند</span>
              {insight.evidence}
            </p>
          )}
          {(insight.action || onAction) && (
            <button
              type="button"
              onClick={() => onAction?.(insight)}
              className="mt-2.5 cursor-pointer rounded-xl bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--muted)] transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-[var(--green-vivid)]"
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
    <article className="an-rec flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[var(--surface-soft)] p-4" aria-label={`پیشنهاد: ${recommendation.title}`}>
      <div className="min-w-0">
        <h3 className="text-[13.5px] font-bold text-[var(--white)]">{recommendation.title}</h3>
        <p className="mt-1 text-[12px] leading-6 text-[var(--faint)]">{recommendation.description}</p>
      </div>
      <button
        type="button"
        onClick={() => onRun?.(recommendation)}
        className="shrink-0 cursor-pointer rounded-xl bg-[var(--green-vivid)] px-3.5 py-2 text-[12px] font-bold text-[#12271a] transition-colors hover:bg-[var(--green-bright)] focus-visible:outline-2 focus-visible:outline-white"
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
      <div className="an-pop rounded-[1.8rem] border border-white/10 bg-[var(--surface)] p-6" style={{ width }} onClick={(event) => event.stopPropagation()}>
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
