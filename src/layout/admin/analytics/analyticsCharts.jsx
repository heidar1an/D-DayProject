/*
 * کیت نمودار مرکز تحلیل — SVG خالص، بدون هیچ کتابخانهٔ نمودار.
 *
 * چرا دست‌ساز؟ پروژه تا امروز هیچ وابستگی نموداری نداشته و اضافه‌کردن یکی
 * (recharts/chart.js) هم حجم باندل را بالا می‌برد و هم زبان بصری پنل را عوض
 * می‌کند. اینجا فقط همان چیزی ساخته شده که لازم است، با همان توکن‌های رنگ.
 *
 * همهٔ نمودارها:
 *   - با ResizeObserver روی عرض واقعی ظرف رسم می‌شوند تا متن تار نشود؛
 *   - Tooltip تعاملی دارند (بدون کتابخانه)؛
 *   - عدد فارسی و جداکنندهٔ هزارگان را از `analyticsKit` می‌گیرند؛
 *   - در نبود داده، حالت خالی نشان می‌دهند نه محور خالی.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { faNumber, toFa } from './analyticsKit';

/* پالت نمودار — همان رنگ‌های برند، با ترتیب ثابت تا معنی سری‌ها عوض نشود */
export const SERIES_COLORS = ['#937fcd', '#61d192', '#5b8cc7', '#e0b45c', '#ef9196', '#ab8e7c'];

export const colorAt = (index) => SERIES_COLORS[index % SERIES_COLORS.length];

/* ─────────────────────────── اندازه‌گیری ظرف ─────────────────────────── */

function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const measure = () => setWidth(node.clientWidth);
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/* ─────────────────────────── قالب چارت + Tooltip ─────────────────────────── */

/*
 * قالب مشترک: ظرف نسبی + لایهٔ Tooltip مطلق. هر نمودار محتوای SVG خودش را
 * به‌عنوان تابع فرزند می‌سازد تا اندازهٔ واقعی را داشته باشد.
 */
export function ChartFrame({
  height = 220, empty = false, emptyLabel = 'داده‌ای برای نمایش نیست', tooltip, children, className = '',
}) {
  const [ref, width] = useElementWidth();

  return (
    <div className={`an-chart ${className}`} ref={ref} style={{ minHeight: empty ? 120 : height }}>
      {empty ? (
        <div className="an-chart__empty">{emptyLabel}</div>
      ) : width > 0 ? (
        <>
          {children({ width, height })}
          {tooltip ? (
            <div
              className={`an-tip ${tooltip.flip ? 'is-flip' : ''}`}
              style={{ left: tooltip.x, top: tooltip.y }}
              role="status"
            >
              {tooltip.content}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* Tooltip مشترک: موقعیت نسبت به ظرف، با محدودسازی تا از کادر بیرون نزند */
function useTooltip() {
  const [tip, setTip] = useState(null);

  const show = useCallback((event, content, { offsetX = 14, offsetY = -12 } = {}) => {
    const host = event.currentTarget?.ownerSVGElement?.parentElement ?? event.currentTarget?.parentElement;
    if (!host) return;

    const box = host.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;

    /* اگر به لبهٔ راست نزدیک شد، Tooltip به سمت چپ باز می‌شود */
    const flip = x > box.width - 170;
    setTip({ x: Math.max(6, x + (flip ? -offsetX - 150 : offsetX)), y: Math.max(6, y + offsetY), flip, content });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  return { tip, show, hide };
}

const TipRow = ({ color, label, value }) => (
  <span className="an-tip__row">
    {color ? <i style={{ background: color }} aria-hidden="true" /> : null}
    <span>{label}</span>
    <strong>{value}</strong>
  </span>
);

/* ─────────────────────────── نمودار خطی / ناحیه‌ای ─────────────────────────── */

/*
 * چند سری روی یک محور. مقادیر `null` شکاف می‌سازند (نه صفر) تا دادهٔ ناموجود
 * به‌شکل سقوط نمایش داده نشود.
 */
export function LineChart({
  labels = [], series = [], height = 230, area = true, unit = '', valueFormat,
}) {
  const { tip, show, hide } = useTooltip();
  const [active, setActive] = useState(null);

  const format = valueFormat ?? ((value) => faNumber(Math.round(value)));

  const flat = series.flatMap((item) => item.values).filter((value) => Number.isFinite(value));
  const empty = !labels.length || !flat.length;

  const max = flat.length ? Math.max(...flat) : 0;
  const top = max > 0 ? max * 1.15 : 1;

  return (
    <ChartFrame
      height={height}
      empty={empty}
      emptyLabel="برای این بازه رویدادی ثبت نشده است"
      tooltip={tip}
      className="an-chart--line"
    >
      {({ width }) => {
        const padX = 44;
        const padTop = 14;
        const padBottom = 26;
        const innerW = Math.max(10, width - padX - 12);
        const innerH = Math.max(10, height - padTop - padBottom);

        const xAt = (index) => padX + (labels.length === 1 ? innerW / 2 : (index / (labels.length - 1)) * innerW);
        const yAt = (value) => padTop + innerH - (Math.max(0, value) / top) * innerH;

        const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ ratio, value: top * ratio }));

        const onMove = (event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - box.left - padX) / innerW;
          const index = Math.max(0, Math.min(labels.length - 1, Math.round(ratio * (labels.length - 1))));
          setActive(index);

          show(event, (
            <>
              <b className="an-tip__head">{labels[index]}</b>
              {series.map((item, seriesIndex) => (
                <TipRow
                  key={item.key ?? seriesIndex}
                  color={item.color ?? colorAt(seriesIndex)}
                  label={item.label}
                  value={Number.isFinite(item.values[index]) ? `${format(item.values[index])}${unit}` : '—'}
                />
              ))}
            </>
          ));
        };

        return (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`نمودار خطی ${series.map((item) => item.label).join('، ')}`}
            onMouseMove={onMove}
            onMouseLeave={() => { setActive(null); hide(); }}
          >
            {/* خطوط راهنما */}
            {ticks.map((tick) => (
              <g key={tick.ratio}>
                <line
                  x1={padX} x2={padX + innerW} y1={yAt(tick.value)} y2={yAt(tick.value)}
                  stroke="var(--ad-border)" strokeWidth="1" strokeDasharray={tick.ratio === 0 ? '0' : '3 4'}
                />
                <text x={padX - 8} y={yAt(tick.value) + 4} textAnchor="end" className="an-chart__axis">
                  {format(tick.value)}
                </text>
              </g>
            ))}

            {/* برچسب محور افقی — حداکثر ۷ برچسب تا شلوغ نشود */}
            {labels.map((label, index) => {
              const step = Math.max(1, Math.ceil(labels.length / 7));
              if (index % step !== 0 && index !== labels.length - 1) return null;
              return (
                <text key={label + index} x={xAt(index)} y={height - 8} textAnchor="middle" className="an-chart__axis">
                  {toFa(label)}
                </text>
              );
            })}

            {/* راهنمای عمودی نقطهٔ فعال */}
            {active !== null ? (
              <line
                x1={xAt(active)} x2={xAt(active)} y1={padTop} y2={padTop + innerH}
                stroke="var(--ad-accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7"
              />
            ) : null}

            {series.map((item, seriesIndex) => {
              const color = item.color ?? colorAt(seriesIndex);
              const points = item.values.map((value, index) => (
                Number.isFinite(value) ? { x: xAt(index), y: yAt(value) } : null
              ));

              /* سری را به قطعه‌های پیوسته می‌شکنیم تا شکاف‌ها خط نکشند */
              const segments = [];
              let current = [];
              points.forEach((point) => {
                if (point) current.push(point);
                else if (current.length) { segments.push(current); current = []; }
              });
              if (current.length) segments.push(current);

              const line = segments
                .map((segment) => segment.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' '))
                .join(' ');

              const areaPath = area && segments.length
                ? segments
                  .filter((segment) => segment.length > 1)
                  .map((segment) => `M${segment[0].x} ${padTop + innerH} `
                    + segment.map((point) => `L${point.x} ${point.y}`).join(' ')
                    + ` L${segment[segment.length - 1].x} ${padTop + innerH} Z`)
                  .join(' ')
                : null;

              return (
                <g key={item.key ?? seriesIndex}>
                  {areaPath ? (
                    <path d={areaPath} fill={color} opacity="0.13" stroke="none" />
                  ) : null}
                  <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                  {points.map((point, index) => (point && index === active ? (
                    <circle key={index} cx={point.x} cy={point.y} r="4" fill={color} stroke="var(--ad-surface)" strokeWidth="2" />
                  ) : null))}
                </g>
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

/* ─────────────────────────── نمودار میله‌ای ─────────────────────────── */

export function BarChart({ data = [], height = 220, color, unit = '', valueFormat }) {
  const { tip, show, hide } = useTooltip();
  const [active, setActive] = useState(null);
  const format = valueFormat ?? ((value) => faNumber(Math.round(value)));

  const values = data.map((item) => Number(item.value) || 0);
  const max = values.length ? Math.max(...values) : 0;
  const empty = !data.length || max === 0;

  return (
    <ChartFrame
      height={height}
      empty={empty}
      emptyLabel="داده‌ای برای این بازه نیست"
      tooltip={tip}
      className="an-chart--bar"
    >
      {({ width }) => {
        const padX = 44;
        const padTop = 14;
        const padBottom = 26;
        const innerW = Math.max(10, width - padX - 12);
        const innerH = Math.max(10, height - padTop - padBottom);
        const slot = innerW / data.length;
        const barW = Math.max(3, Math.min(38, slot * 0.62));

        return (
          <svg width={width} height={height} role="img" aria-label="نمودار میله‌ای">
            {[0, 0.5, 1].map((ratio) => {
              const value = max * ratio;
              const y = padTop + innerH - ratio * innerH;
              return (
                <g key={ratio}>
                  <line x1={padX} x2={padX + innerW} y1={y} y2={y} stroke="var(--ad-border)" strokeDasharray={ratio === 0 ? '0' : '3 4'} />
                  <text x={padX - 8} y={y + 4} textAnchor="end" className="an-chart__axis">{format(value)}</text>
                </g>
              );
            })}

            {data.map((item, index) => {
              const value = Number(item.value) || 0;
              const barH = max > 0 ? (value / max) * innerH : 0;
              const x = padX + index * slot + (slot - barW) / 2;
              const y = padTop + innerH - barH;

              return (
                <g key={item.key ?? item.label ?? index}>
                  {/* ناحیهٔ شفاف بزرگ‌تر برای راحتی Hover */}
                  <rect
                    x={padX + index * slot} y={padTop} width={slot} height={innerH} fill="transparent"
                    onMouseEnter={(event) => {
                      setActive(index);
                      show(event, (
                        <>
                          <b className="an-tip__head">{item.label}</b>
                          <TipRow color={item.color ?? color ?? 'var(--ad-accent)'} label="مقدار" value={`${format(value)}${unit}`} />
                          {item.extra ? <TipRow label={item.extraLabel ?? ''} value={item.extra} /> : null}
                        </>
                      ));
                    }}
                    onMouseLeave={() => { setActive(null); hide(); }}
                  />
                  <rect
                    x={x} y={y} width={barW} height={Math.max(barH, value > 0 ? 2 : 0)} rx={Math.min(5, barW / 2)}
                    fill={item.color ?? color ?? 'var(--ad-accent)'}
                    opacity={active === null || active === index ? 1 : 0.5}
                    pointerEvents="none"
                  />
                </g>
              );
            })}

            {data.map((item, index) => {
              const step = Math.max(1, Math.ceil(data.length / 8));
              if (index % step !== 0 && index !== data.length - 1) return null;
              return (
                <text key={`l-${index}`} x={padX + index * slot + slot / 2} y={height - 8} textAnchor="middle" className="an-chart__axis">
                  {toFa(item.label)}
                </text>
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

/* ─────────────────────────── نمودار دونات ─────────────────────────── */

export function Donut({ slices = [], size = 190, thickness = 26, centerLabel = '', centerValue = '' }) {
  const { tip, show, hide } = useTooltip();

  const total = slices.reduce((sum, slice) => sum + (Number(slice.value) || 0), 0);
  const empty = !slices.length || total <= 0;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = slices.map((slice, index) => {
    const value = Number(slice.value) || 0;
    const share = total > 0 ? value / total : 0;
    const arc = {
      ...slice,
      color: slice.color ?? colorAt(index),
      share,
      dash: share * circumference,
      offset,
    };
    offset += share * circumference;
    return arc;
  });

  return (
    <ChartFrame height={size} empty={empty} emptyLabel="سهمی برای نمایش نیست" tooltip={tip} className="an-chart--donut">
      {() => (
        <div className="an-donut">
          <svg width={size} height={size} role="img" aria-label="نمودار دونات">
            <g transform={`translate(${size / 2} ${size / 2}) rotate(-90)`}>
              <circle r={radius} fill="none" stroke="var(--ad-surface-3)" strokeWidth={thickness} />
              {arcs.map((arc, index) => (
                <circle
                  key={arc.key ?? index}
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
                  strokeDashoffset={-arc.offset}
                  strokeLinecap="butt"
                  onMouseEnter={(event) => show(event, (
                    <>
                      <b className="an-tip__head">{arc.label}</b>
                      <TipRow color={arc.color} label="مقدار" value={faNumber(arc.value)} />
                      <TipRow label="سهم" value={`${toFa(arc.share.toFixed(1))}٪`} />
                    </>
                  ))}
                  onMouseLeave={hide}
                />
              ))}
            </g>
            <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="an-donut__value">{centerValue || faNumber(total)}</text>
            <text x={size / 2} y={size / 2 + 18} textAnchor="middle" className="an-donut__label">{centerLabel}</text>
          </svg>

          <ul className="an-legend">
            {arcs.map((arc, index) => (
              <li key={arc.key ?? index}>
                <i style={{ background: arc.color }} aria-hidden="true" />
                <span className="an-legend__label">{arc.label}</span>
                <span className="an-legend__value">{faNumber(arc.value)}</span>
                <span className="an-legend__share">{toFa(arc.share.toFixed(1))}٪</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartFrame>
  );
}

/* ─────────────────────────── جرقه (Sparkline) ─────────────────────────── */

export function Sparkline({ values = [], color = 'var(--ad-accent)', width = 96, height = 30 }) {
  const flat = values.filter((value) => Number.isFinite(value));
  if (flat.length < 2) return <span className="an-spark an-spark--empty">—</span>;

  const max = Math.max(...flat);
  const min = Math.min(...flat);
  const span = max - min || 1;
  const step = width / (flat.length - 1);

  const path = flat
    .map((value, index) => `${index ? 'L' : 'M'}${(index * step).toFixed(1)} ${(height - 3 - ((value - min) / span) * (height - 6)).toFixed(1)}`)
    .join(' ');

  return (
    <svg className="an-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="روند">
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─────────────────────────── نقشهٔ حرارتی روز×ساعت ─────────────────────────── */

export function Heatmap({ cells = [], weekdays = [], max = 0, height = 200 }) {
  const { tip, show, hide } = useTooltip();

  const byKey = useMemo(() => {
    const map = new Map();
    cells.forEach((cell) => map.set(`${cell.day}-${cell.hour}`, cell.value));
    return map;
  }, [cells]);

  const peak = max || Math.max(1, ...cells.map((cell) => Number(cell.value) || 0));
  const empty = !cells.length || peak <= 0;

  const hourTicks = [0, 6, 12, 18, 23];

  return (
    <ChartFrame height={height} empty={empty} emptyLabel="الگوی ساعتی در این بازه ثبت نشده" tooltip={tip} className="an-chart--heat">
      {({ width }) => {
        const labelW = 46;
        const innerW = Math.max(10, width - labelW - 8);
        const rowH = Math.max(10, (height - 22) / 7);
        const colW = innerW / 24;

        return (
          <svg width={width} height={height} role="img" aria-label="نقشهٔ حرارتی فعالیت در ساعات هفته">
            {Array.from({ length: 7 }).map((_, day) => (
              <g key={day}>
                <text x={labelW - 8} y={day * rowH + rowH / 2 + 4} textAnchor="end" className="an-chart__axis">
                  {weekdays[day] ?? toFa(day + 1)}
                </text>
                {Array.from({ length: 24 }).map((__, hour) => {
                  const value = byKey.get(`${day}-${hour}`) ?? 0;
                  const intensity = peak > 0 ? value / peak : 0;
                  return (
                    <rect
                      key={hour}
                      x={labelW + hour * colW}
                      y={day * rowH}
                      width={Math.max(2, colW - 2)}
                      height={Math.max(4, rowH - 2)}
                      rx="2.5"
                      fill={value > 0 ? 'var(--ad-accent)' : 'var(--ad-surface-3)'}
                      opacity={value > 0 ? 0.18 + intensity * 0.82 : 0.5}
                      onMouseEnter={(event) => show(event, (
                        <>
                          <b className="an-tip__head">{weekdays[day] ?? ''} — ساعت {toFa(hour)}</b>
                          <TipRow color="var(--ad-accent)" label="رویداد" value={faNumber(value)} />
                        </>
                      ))}
                      onMouseLeave={hide}
                    />
                  );
                })}
              </g>
            ))}

            {hourTicks.map((hour) => (
              <text
                key={hour}
                x={labelW + hour * colW + colW / 2}
                y={height - 6}
                textAnchor="middle"
                className="an-chart__axis"
              >
                {toFa(hour)}
              </text>
            ))}
          </svg>
        );
      }}
    </ChartFrame>
  );
}

/* ─────────────────────────── قیف تبدیل ─────────────────────────── */

export function Funnel({ steps = [] }) {
  const first = steps[0]?.value ?? 0;
  const empty = !steps.length || first <= 0;

  if (empty) {
    return <div className="an-chart__empty an-chart__empty--plain">داده‌ای برای قیف تبدیل نیست</div>;
  }

  return (
    <ol className="an-funnel">
      {steps.map((step, index) => {
        const share = first > 0 ? (step.value / first) * 100 : 0;
        return (
          <li key={step.key ?? index} className="an-funnel__step">
            <div className="an-funnel__head">
              <span className="an-funnel__label">{step.label}</span>
              <span className="an-funnel__value">{faNumber(step.value)}</span>
            </div>
            <div className="an-funnel__track">
              <span
                className="an-funnel__fill"
                style={{ width: `${Math.max(2, share)}%`, background: colorAt(index) }}
              />
            </div>
            <div className="an-funnel__meta">
              <span>{toFa(share.toFixed(1))}٪ از شروع</span>
              {step.passRate !== null && step.passRate !== undefined && index > 0 ? (
                <span className={step.passRate < 50 ? 'is-warn' : ''}>
                  عبور از مرحلهٔ قبل: {toFa(step.passRate.toFixed(1))}٪
                </span>
              ) : null}
              {step.dropRate ? <span className="is-bad">ریزش: {toFa(step.dropRate.toFixed(1))}٪</span> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────────────────────── گیج امتیاز ─────────────────────────── */

export function Gauge({ value = 0, max = 100, label = '', tone = 'good', size = 150 }) {
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const radius = (size - 22) / 2;
  const circumference = Math.PI * radius; /* نیم‌دایره */
  const stroke = { good: 'var(--ad-green)', warn: 'var(--ad-gold)', critical: 'var(--ad-red)', neutral: 'var(--ad-muted)' }[tone] ?? 'var(--ad-accent)';

  return (
    <div className="an-gauge">
      <svg width={size} height={size / 2 + 26} role="img" aria-label={`${label}: ${value} از ${max}`}>
        <g transform={`translate(${size / 2} ${size / 2 + 4})`}>
          <path
            d={`M${-radius} 0 A${radius} ${radius} 0 0 1 ${radius} 0`}
            fill="none" stroke="var(--ad-surface-3)" strokeWidth="13" strokeLinecap="round"
          />
          <path
            d={`M${-radius} 0 A${radius} ${radius} 0 0 1 ${radius} 0`}
            fill="none" stroke={stroke} strokeWidth="13" strokeLinecap="round"
            strokeDasharray={`${ratio * circumference} ${circumference}`}
          />
        </g>
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" className="an-gauge__value">{toFa(Math.round(value))}</text>
      </svg>
      {label ? <span className="an-gauge__label">{label}</span> : null}
    </div>
  );
}

/* ─────────────────────────── فهرست میله‌ای افقی ─────────────────────────── */

/*
 * برای رتبه‌بندی‌ها (پربازدیدترین صفحات، کانال‌ها، خطاهای پرتکرار) میلهٔ افقی
 * خواناتر از نمودار است و فضای کمتری می‌گیرد.
 */
export function HBarList({ rows = [], valueFormat, emptyLabel = 'موردی ثبت نشده', maxRows = 8 }) {
  const visible = rows.slice(0, maxRows);
  if (!visible.length) return <p className="an-muted">{emptyLabel}</p>;

  const format = valueFormat ?? ((value) => faNumber(value));
  const max = Math.max(...visible.map((row) => Number(row.value) || 0), 1);

  return (
    <ul className="an-hbar">
      {visible.map((row, index) => (
        <li key={row.key ?? row.label ?? index}>
          <span className="an-hbar__label" title={row.label}>{row.label}</span>
          <span className="an-hbar__track">
            <span
              className="an-hbar__fill"
              style={{ width: `${((Number(row.value) || 0) / max) * 100}%`, background: row.color ?? colorAt(index) }}
            />
          </span>
          <span className="an-hbar__value">{format(row.value)}</span>
        </li>
      ))}
    </ul>
  );
}
