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

/* هندسهٔ نمودار — هم svg و هم ستون‌های hover از این پدینگ استفاده می‌کنند */
const PAD = { top: 26, right: 46, bottom: 34, left: 10 };

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/* گرد کردن محور عمودی به عدد خوش‌خوان (۸۷ → ۱۰۰) */
function niceCeil(value) {
  if (value <= 0) return 10;
  const exp = 10 ** Math.floor(Math.log10(value));
  const n = value / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * exp;
}

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
      {[42, 68, 30, 84, 56, 74, 38, 92, 60, 48, 78, 34].map((height, index) => (
        <span key={index} style={{ '--h': `${height}%`, '--i': index }} />
      ))}
    </div>
  );
}

function HeartBarChart({ data }) {
  const [plotRef, size] = useElementSize();
  const [hover, setHover] = useState(null);
  const gradientId = useId();
  const gradientTodayId = useId();

  const { points, summary } = data;
  const count = points.length;

  const clearHover = useCallback(() => setHover(null), []);

  const geometry = useMemo(() => {
    if (size.width < 80 || size.height < 80) return null;
    const plotW = size.width - PAD.left - PAD.right;
    const plotH = size.height - PAD.top - PAD.bottom;
    const baseline = PAD.top + plotH;
    const maxValue = Math.max(...points.map((p) => p.hearts), 1);
    const yMax = niceCeil(maxValue * 1.06);
    const slot = plotW / count;
    const barW = clamp(slot * 0.52, 12, 32);
    return { plotW, plotH, baseline, yMax, slot, barW };
  }, [size, points, count]);

  const hovered = hover != null && geometry ? points[hover] : null;

  if (!geometry) {
    return (
      <div className="heart-chart__plot" ref={plotRef} onMouseLeave={clearHover}>
        <ChartSkeleton />
      </div>
    );
  }

  const { plotW, plotH, baseline, yMax, slot, barW } = geometry;
  const gridCount = 4;
  const avgY = baseline - (summary.avg / yMax) * plotH;
  const avgValue = Math.round(summary.avg);

  const barTop = (hearts) => baseline - (hearts / yMax) * plotH;

  return (
    <div
      className={`heart-chart__plot ${hover != null ? 'is-hovering' : ''}`}
      ref={plotRef}
      onMouseLeave={clearHover}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) clearHover();
      }}
    >
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
        </defs>

        {/* خطوط راهنمای افقی + برچسب محور عمودی (سمت راست، RTL) */}
        {Array.from({ length: gridCount + 1 }, (_, g) => {
          const value = Math.round((yMax / gridCount) * (gridCount - g));
          const y = PAD.top + (plotH / gridCount) * g;
          return (
            <g key={value}>
              <line
                className={`heart-chart__grid ${g === gridCount ? 'heart-chart__grid--base' : ''}`}
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y}
                y2={y}
              />
              <text className="heart-chart__ylabel" x={size.width - 8} y={y + 3.5} textAnchor="end">
                {faNum.format(value)}
              </text>
            </g>
          );
        })}

        {/* خط میانگین دوره */}
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
            <text className="heart-chart__avg-label" x={PAD.left + 2} y={avgY - 6}>
              میانگین {faNum.format(avgValue)}
            </text>
          </g>
        )}

        {/* میله‌ها */}
        {points.map((point, index) => {
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
                <path d={topRoundedBar(x, y, barW, Math.max(height, 4), Math.min(8, barW / 2))} fill={`url(#${point.isCurrent ? gradientTodayId : gradientId})`} />
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
        })}

        {/* برچسب‌های محور افقی */}
        {points.map((point, index) => {
          const cx = PAD.left + slot * index + slot / 2;
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
                x={PAD.left + slot * index + slot / 2}
                y={size.height - 6}
                style={{ '--i': index }}
              >
                {point.label.bottom}
              </text>
            ) : null,
          )}
      </svg>

      {/* ستون‌های شفاف hover/focus — جهت LTR تا با ترتیب svg هم‌راستا بماند */}
      <div className="heart-chart__overlay" role="list" aria-label={`داده‌های نمودار ${RANGE_NOUNS[data.range]}`}>
        {points.map((point, index) => (
          <div
            key={point.id}
            role="listitem"
            tabIndex={0}
            className={`heart-chart__column ${hover === index ? 'is-hover' : ''}`}
            aria-label={`${point.title}: ${faNum.format(point.hearts)} قلب`}
            onMouseEnter={() => setHover(index)}
            onFocus={() => setHover(index)}
          />
        ))}
      </div>

      {/* تولتیپ */}
      {hovered && (
        <div
          key={hovered.id}
          className="heart-chart__tooltip"
          style={{
            left: clamp(PAD.left + slot * hover + slot / 2, 84, size.width - 84),
            bottom: clamp(baseline - (hovered.hearts / yMax) * plotH + 14, 0, size.height - 88),
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

export default function HeartChart({ range = 'daily' }) {
  const { data, loading, error, retry } = useAsyncData(() => fetchHeartSeries({ range }), [range]);

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
      ) : (
        <HeartBarChart key={range} data={data} />
      )}
      {loading || !data ? <div className="heart-chart__insights heart-chart__insights--loading" /> : <ChartInsights data={data} />}
    </div>
  );
}
