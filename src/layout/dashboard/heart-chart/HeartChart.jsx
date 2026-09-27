import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAsyncData } from '../league/useAsyncData';
import { fetchHeartSeries } from '../../../services/hearts/heartStatsService';
import './heartChart.css';

const faNum = new Intl.NumberFormat('fa-IR');

const RANGE_NOUNS = {
  daily: 'روزانه',
  weekly: 'هفتگی',
  monthly: 'ماهانه',
  yearly: 'سالانه',
};

/* هندسهٔ نمودار — svg، میله‌ها، ستون‌های hover و تولتیپ همگی از همین پدینگ می‌خوانند.
   (پدینگ سمت راست جای برچسب‌های محور عمودی است؛ چون چیدمان RTL است، محور عددی راست می‌نشیند.) */
const PAD = { top: 26, right: 46, bottom: 34, left: 10 };

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value) => Math.round(value * 100) / 100;

/* پله‌های خوش‌خوان برای محور عمودی */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/*
 * محور عمودی داینامیک (به سبک نمودار هفتگی دولینگو).
 * قبلاً محور با ضریب ۱٫۰۶ و گرد کردن درشتی محاسبه می‌شد که برای مقدار ۵۲ سقف ۱۰۰ می‌داد
 * و بالای نمودار نصف ارتفاع خالی می‌ماند. الان:
 *   headroom = بلندترین مقدار + ۶٪ هوا
 *   step     = نزدیک‌ترین پلهٔ خوش‌خوان به headroom / targetTicks
 *   yMax     = اولین مضرب step که از headroom بزرگ‌تر است
 * نتیجه: بلندترین میله ۸۰ تا ۹۵ درصد ارتفاع ناحیهٔ ترسیم را پر می‌کند و
 * تعداد خطوط راهنما هم به‌جای عدد ثابت، از خود داده می‌آید.
 */
function niceAxis(maxValue, targetTicks = 5) {
  if (!(maxValue > 0)) return { yMax: 10, step: 5, ticks: 2 };

  const headroom = maxValue * 1.06;
  const rough = headroom / targetTicks;
  const exp = 10 ** Math.floor(Math.log10(rough));
  const n = rough / exp;
  /* پله زیر ۱ برای شمارش قلب بی‌معنی است (اعداد اعشاری روی محور) */
  const step = Math.max(1, (NICE_STEPS.find((v) => n <= v) ?? 10) * exp);
  const yMax = Math.ceil(headroom / step) * step;

  return { yMax, step, ticks: Math.max(1, Math.round(yMax / step)) };
}

/* برچسب محور: عدد صحیح بدون اعشار، وگرنه یک رقم اعشار */
const formatAxisValue = (value) =>
  faNum.format(Number.isInteger(value) ? value : Math.round(value * 10) / 10);

/* میله با گوشه‌های گرد فقط در سمت بالا */
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

/*
 * مسیر منحنی نرم (Catmull-Rom → بزیه) برای حالت خطی.
 * کنترل‌پوینت‌ها داخل ناحیهٔ ترسیم کلمپ می‌شوند تا منحنی روی قله‌های تیز
 * از بالا/پایین نزند بیرون (اورشوت صفر هم نداریم).
 */
function smoothLinePath(coords, top, bottom) {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M${round(coords[0].x)},${round(coords[0].y)}`;

  const tension = 0.18;
  let d = `M${round(coords[0].x)},${round(coords[0].y)}`;

  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = clamp(p1.y + (p2.y - p0.y) * tension, top, bottom);
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = clamp(p2.y - (p3.y - p1.y) * tension, top, bottom);

    d += ` C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(p2.x)},${round(p2.y)}`;
  }

  return d;
}

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

function PercentDelta({ current, previous }) {
  if (previous <= 0 || current <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  return (
    <span className={`heart-chart__tooltip-delta ${up ? 'is-up' : 'is-down'}`}>
      {up ? '▲' : '▼'} {faNum.format(Math.abs(pct))}٪ نسبت به پیشین
    </span>
  );
}

function ChartSkeleton() {
  return (
    <div className="heart-chart__skeleton" aria-hidden="true">
      <span style={{ '--h': '0%' }} />
    </div>
  );
}

/*
 * نمودار قلب — دو حالت نمایش:
 *   bar  → میله‌های گرد با گرادیان و ضربان «امروز»
 *   line → خط منحنی نرم + ناحیهٔ گرادیانی + نقاط داده
 * هر دو حالت از یک هندسه و یک لایهٔ ستون‌های hover تغذیه می‌کنند.
 */
function HeartChartPlot({ data, mode }) {
  const [plotRef, size] = useElementSize();
  const [hover, setHover] = useState(null);
  const gradientId = useId();
  const gradientTodayId = useId();
  const areaId = useId();

  const { points, summary } = data;
  const count = points.length;
  const isLine = mode === 'line';

  const clearHover = useCallback(() => setHover(null), []);

  const geometry = useMemo(() => {
    if (size.width < 80 || size.height < 80) return null;
    const plotW = size.width - PAD.left - PAD.right;
    const plotH = size.height - PAD.top - PAD.bottom;
    const baseline = PAD.top + plotH;
    const maxValue = Math.max(...points.map((p) => p.hearts), 1);
    const axis = niceAxis(maxValue);
    const yMax = axis.yMax;
    const slot = plotW / count;
    const barW = clamp(slot * 0.52, 12, 32);
    /* مرکز هر ستون و ارتفاع هر مقدار — تنها منبع حقیقت برای svg و لایهٔ hover */
    const centerX = (index) => PAD.left + slot * index + slot / 2;
    const topY = (hearts) => baseline - (hearts / yMax) * plotH;
    return { plotW, plotH, baseline, yMax, axis, slot, barW, centerX, topY };
  }, [size, points, count]);

  const hovered = hover != null && geometry ? points[hover] : null;

  if (!geometry) {
    return (
      <div className="heart-chart__plot" ref={plotRef} onMouseLeave={clearHover}>
        <ChartSkeleton />
      </div>
    );
  }

  const { plotW, plotH, baseline, yMax, axis, slot, barW, centerX, topY } = geometry;
  const avgY = baseline - (summary.avg / yMax) * plotH;
  const avgValue = Math.round(summary.avg);

  const coords = points.map((point, index) => ({ x: centerX(index), y: topY(point.hearts) }));
  const linePath = isLine ? smoothLinePath(coords, PAD.top, baseline) : '';
  const areaPath = isLine && coords.length
    ? `${linePath} L${round(coords[coords.length - 1].x)},${baseline} L${round(coords[0].x)},${baseline} Z`
    : '';

  return (
    <div
      className={`heart-chart__plot ${isLine ? 'is-line' : 'is-bar'} ${hover != null ? 'is-hovering' : ''}`}
      ref={plotRef}
      onMouseLeave={clearHover}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) clearHover();
      }}
    >
      <span className="heart-chart__total" dir="rtl">کل قلب‌ها: {faNum.format(data.allTimeTotal)}</span>
      <svg
        className="heart-chart__svg"
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff9a8d" />
            <stop offset="55%" stopColor="#ff6969" />
            <stop offset="100%" stopColor="#d84f63" />
          </linearGradient>
          <linearGradient id={gradientTodayId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffc2ae" />
            <stop offset="55%" stopColor="#ff7f76" />
            <stop offset="100%" stopColor="#e25a6b" />
          </linearGradient>
          <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6969" stopOpacity="0.3" />
            <stop offset="62%" stopColor="#ff6969" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ff6969" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* خطوط راهنمای افقی + برچسب محور عمودی (سمت راست، RTL) — تعداد خطوط داینامیک است */}
        {Array.from({ length: axis.ticks + 1 }, (_, g) => {
          const value = axis.yMax - axis.step * g;
          const y = PAD.top + (plotH / axis.ticks) * g;
          return (
            <g key={g}>
              <line
                className={`heart-chart__grid ${g === axis.ticks ? 'heart-chart__grid--base' : ''}`}
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y}
                y2={y}
              />
              <text className="heart-chart__ylabel" x={size.width - 8} y={y + 3.5} textAnchor="end">
                {formatAxisValue(value)}
              </text>
            </g>
          );
        })}

        {isLine ? (
          <g className="heart-chart__line">
            <path className="heart-chart__line-area" d={areaPath} fill={`url(#${areaId})`} />

            {hover != null && (
              <line
                className="heart-chart__guide"
                x1={coords[hover].x}
                x2={coords[hover].x}
                y1={PAD.top}
                y2={baseline}
              />
            )}

            <path className="heart-chart__line-stroke" d={linePath} pathLength="1" />

            {coords.map((coord, index) => {
              const point = points[index];
              const isHover = hover === index;
              return (
                <g key={point.id} className={`heart-chart__dot-wrap ${isHover ? 'is-hover' : ''}`} style={{ '--i': index }}>
                  {isHover && <circle className="heart-chart__dot-halo" cx={coord.x} cy={coord.y} r="9" />}
                  <circle
                    className={`heart-chart__dot ${point.isCurrent ? 'is-current' : ''} ${isHover ? 'is-hover' : ''}`}
                    cx={coord.x}
                    cy={coord.y}
                    r={point.isCurrent ? 4.4 : 3.1}
                  />
                  {point.isCurrent && (
                    <>
                      <circle className="heart-chart__pulse-ring" cx={coord.x} cy={coord.y} r="4" />
                      <circle className="heart-chart__pulse-dot" cx={coord.x} cy={coord.y} r="3" />
                    </>
                  )}
                </g>
              );
            })}
          </g>
        ) : (
          points.map((point, index) => {
            const x = PAD.left + slot * index + (slot - barW) / 2;
            const height = (point.hearts / yMax) * plotH;
            const y = baseline - height;
            const isEmpty = point.hearts === 0;

            return (
              <g
                key={point.id}
                className={`heart-chart__bar ${point.isCurrent ? 'is-current' : ''} ${isEmpty ? 'is-empty' : ''} ${
                  hover === index ? 'is-hover' : ''
                }`}
                style={{ '--i': index }}
              >
                {!isEmpty && (
                  <path
                    d={topRoundedBar(x, y, barW, Math.max(height, 4), Math.min(8, barW / 2))}
                    fill={`url(#${point.isCurrent ? gradientTodayId : gradientId})`}
                  />
                )}
                {isEmpty && <rect className="heart-chart__ghost" x={x} y={baseline - 3} width={barW} height={3} rx={1.5} />}
                {point.isCurrent && (
                  <>
                    <circle className="heart-chart__pulse-ring" cx={x + barW / 2} cy={y - 11} r="4" />
                    <circle className="heart-chart__pulse-dot" cx={x + barW / 2} cy={y - 11} r="3" />
                  </>
                )}
              </g>
            );
          })
        )}

        {/*
          خط میانگین دوره — بعد از میله‌ها رسم می‌شود تا خط روی میله‌ها بنشیند، نه زیر آن‌ها.
          عدد میانگین در یک چیپ HTML (پایین‌تر، روی همین لایه) نمایش داده می‌شود.
        */}
        {summary.avg > 0 && avgY > PAD.top + 10 && (
          <g className="heart-chart__avg">
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={avgY}
              y2={avgY}
              strokeDasharray="3 7"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* برچسب‌های محور افقی */}
        {points.map((point, index) => {
          const cx = centerX(index);
          return (
            <text
              key={point.id}
              className={`heart-chart__xlabel ${point.isCurrent ? 'is-current' : ''}`}
              x={cx}
              y={point.label.bottom ? size.height - 20 : size.height - 12}
              style={{ '--i': index }}
            >
              {point.label.top}
            </text>
          );
        })}
        {points.some((p) => p.label.bottom) &&
          points.map((point, index) =>
            point.label.bottom ? (
              <text
                key={`${point.id}-sub`}
                className="heart-chart__xlabel heart-chart__xlabel--sub"
                x={centerX(index)}
                y={size.height - 6}
                style={{ '--i': index }}
              >
                {point.label.bottom}
              </text>
            ) : null,
          )}
      </svg>

      {/* چیپ میانگین — روی ناحیهٔ ترسیم شناور است تا عددش هیچ‌وقت زیر میله گم نشود */}
      {summary.avg > 0 && avgY > PAD.top + 10 && (
        <span className="heart-chart__avg-chip" style={{ top: `${round(avgY)}px` }}>
          میانگین {faNum.format(avgValue)}
        </span>
      )}

      {/*
        ستون‌های شفاف hover/focus.
        چپ و عرض هر ستون از همان هندسهٔ svg می‌آید (PAD.left + slot*i) تا هاله،
        تولتیپ و میله دقیقاً روی یک ستون بیفتند — نه یک ستون جلوتر/عقب‌تر.
        ارتفاع کامل ناحیهٔ ترسیم می‌ماند تا گرفتن ستون با ماوس راحت باشد.
      */}
      <div
        className="heart-chart__overlay"
        role="list"
        aria-label={`داده‌های نمودار ${RANGE_NOUNS[data.range]}`}
        style={{ '--chart-pad-bottom': `${PAD.bottom}px` }}
      >
        {points.map((point, index) => (
          <div
            key={point.id}
            role="listitem"
            tabIndex={0}
            className={`heart-chart__column ${hover === index ? 'is-hover' : ''}`}
            style={{ left: `${round(PAD.left + slot * index)}px`, width: `${round(slot)}px` }}
            aria-label={`${point.title}: ${faNum.format(point.hearts)} قلب`}
            onMouseEnter={() => setHover(index)}
            onFocus={() => setHover(index)}
          />
        ))}
      </div>

      {/* تولتیپ — مرکز افقی‌اش همان مرکز ستونِ هاورشده است */}
      {hovered && (
        <div
          key={hovered.id}
          className="heart-chart__tooltip"
          style={{
            left: clamp(centerX(hover), 84, size.width - 84),
            bottom: clamp(topY(hovered.hearts) + 14, 0, size.height - 88),
          }}
        >
          <span className="heart-chart__tooltip-title">
            {hovered.title}
            {hovered.isCurrent && <em>در جریان</em>}
          </span>
          <strong className="heart-chart__tooltip-value">
            {faNum.format(hovered.hearts)} <i>قلب</i>
          </strong>
          <PercentDelta current={hovered.hearts} previous={hover > 0 ? points[hover - 1].hearts : 0} />
        </div>
      )}
    </div>
  );
}

function ChartInsights({ data }) {
  const { points, summary } = data;
  const noun = RANGE_NOUNS[data.range];

  return (
    <footer className="heart-chart__insights">
      <span className="heart-chart__insight heart-chart__insight--total">
        کل قلب‌های کسب‌شده <b>{faNum.format(data.allTimeTotal)}</b>
      </span>
      <span className="heart-chart__insight">
        مجموع دوره <b>{faNum.format(summary.total)}</b> قلب
      </span>
      <span className="heart-chart__insight">
        میانگین {noun} <b>{faNum.format(Math.round(summary.avg))}</b> قلب
      </span>
      {summary.best && summary.best.value > 0 && (
        <span className="heart-chart__insight heart-chart__insight--best">
          بهترین: <b>{faNum.format(summary.best.value)}</b> قلب
          {summary.best.insight ? ` — ${summary.best.insight}` : ''}
        </span>
      )}
      <span className="heart-chart__insight heart-chart__insight--muted">
        {faNum.format(points.length)} {noun === 'روزانه' ? 'روز' : noun === 'هفتگی' ? 'هفته' : noun === 'ماهانه' ? 'ماه' : 'سال'} اخیر
      </span>
    </footer>
  );
}

/*
 * پوستهٔ نمودار — هم داده را می‌گیرد، هم گذار بین «میله‌ای» و «خطی» را مدیریت می‌کند:
 * حالت فعلی اول با یک فید نرم بیرون می‌رود (۱۹۰ms)، بعد حالت جدید mount می‌شود و
 * انیمیشن ورود خودش (رشد میله‌ها / رسم خط) را اجرا می‌کند.
 * با prefers-reduced-motion این گذار حذف و حالت مستقیم عوض می‌شود.
 */
export default function HeartChart({ range = 'daily', mode = 'bar' }) {
  const { data, loading, error, retry } = useAsyncData(() => fetchHeartSeries({ range }), [range]);
  const [renderMode, setRenderMode] = useState(mode);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    window.addEventListener('tapesh:hearts:changed', retry);
    return () => window.removeEventListener('tapesh:hearts:changed', retry);
  }, [retry]);

  useEffect(() => {
    if (mode === renderMode) return undefined;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      setRenderMode(mode);
      return undefined;
    }

    setIsSwitching(true);
    const timer = window.setTimeout(() => {
      setRenderMode(mode);
      setIsSwitching(false);
    }, 190);

    return () => window.clearTimeout(timer);
  }, [mode, renderMode]);

  if (error) {
    return (
      <div className="heart-chart">
        <div className="heart-chart__error">
          <p>دریافت آمار قلب ناموفق بود.</p>
          <button type="button" onClick={retry}>
            تلاش دوباره
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="heart-chart" aria-busy={loading}>
      {loading || !data ? (
        <div className="heart-chart__plot">
          <ChartSkeleton />
        </div>
      ) : data.summary.total === 0 ? (
        <div className="heart-chart__plot flex items-center justify-center text-sm text-[var(--faint)]">
          <span className="heart-chart__total" dir="rtl">کل قلب‌ها: {faNum.format(data.allTimeTotal)}</span>
          در این بازه قلبی ثبت نشده است.
        </div>
      ) : (
        <div className={`heart-chart__stage ${isSwitching ? 'is-switching' : ''}`}>
          {/* کلید مرکب: با تغییر بازه یا حالت، ورود پله‌ای نمودار دوباره اجرا می‌شود */}
          <HeartChartPlot key={`${range}-${renderMode}`} data={data} mode={renderMode} />
        </div>
      )}
      {loading || !data ? <div className="heart-chart__insights heart-chart__insights--loading" /> : <ChartInsights data={data} />}
    </div>
  );
}
