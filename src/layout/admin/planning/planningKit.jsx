/*
 * اجزای مشترک ماژول «برنامه‌ریزی و مدیریت».
 *
 * همان قرارداد `analyticsKit` و `mediaKit`: یک فایل ابزار که همهٔ بخش‌های ماژول
 * از آن تغذیه می‌کنند تا کارت، نشان، نمودار و خروجی گرفتن در کل ماژول یک‌دست
 * باشد. هیچ کامپوننتی اینجا داده واکشی نمی‌کند.
 *
 * رنگ‌ها فقط از توکن‌های تم می‌آیند (`--ad-*` که خودش به `--purple-bright` و… وصل
 * است) تا در تم روشن و تیره هر دو درست دیده شوند.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { IconClose, IconDownload } from '../adminIcons';
import { faNumber, toFa } from '../../../services/planning/jalali';

/* ───────────────────────────── رنگ ───────────────────────────── */

export const TONE_VAR = {
  muted: 'var(--ad-muted)',
  blue: 'var(--ad-blue)',
  accent: 'var(--ad-accent)',
  gold: 'var(--ad-gold)',
  green: 'var(--ad-green)',
  danger: 'var(--ad-red)',
  copper: 'var(--ad-copper)',
};

export const toneVar = (key) => TONE_VAR[key] ?? TONE_VAR.muted;

/* ───────────────────────────── پوسته‌ها ───────────────────────────── */

export function Panel({ title, description, actions, children, className = '', flush = false, id }) {
  return (
    <section className={`pl-panel ${className}`.trim()} id={id}>
      {title || actions ? (
        <header className="pl-panel__head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="pl-panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`pl-panel__body ${flush ? 'pl-panel__body--flush' : ''}`.trim()}>{children}</div>
    </section>
  );
}

export function SectionHero({ eyebrow, title, description, actions }) {
  return (
    <header className="pl-hero">
      <div>
        <span className="pl-hero__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="pl-hero__actions">{actions}</div> : null}
    </header>
  );
}

export function Toolbar({ children, className = '' }) {
  return <div className={`pl-toolbar ${className}`.trim()}>{children}</div>;
}

export function ToolbarSpacer() {
  return <span className="pl-toolbar__spacer" />;
}

export function Fieldset({ label, children, className = '' }) {
  return (
    <div className={`pl-fieldset ${className}`.trim()}>
      <span className="pl-fieldset__label">{label}</span>
      {children}
    </div>
  );
}

/* ───────────────────────────── نشان و برچسب ───────────────────────────── */

export function Pill({ tone = 'muted', children, soft = true, title }) {
  return (
    <span
      className={`pl-pill pl-pill--${tone} ${soft ? 'pl-pill--soft' : ''}`.trim()}
      title={title}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = 'muted', size = 8 }) {
  return <span className="pl-dot" style={{ background: toneVar(tone), width: size, height: size }} aria-hidden="true" />;
}

/*
 * راهنمای شناور — برای دکمه‌های آیکونی.
 * با CSS ساخته شده (نه `title` بومی) تا با تم هم‌خوان و روی موبایل هم خوانا باشد.
 */
export function Tip({ text, children, side = 'top' }) {
  return (
    <span className={`pl-tip pl-tip--${side}`} data-tip={text}>
      {children}
    </span>
  );
}

export function ToolButton({ label, tone = 'neutral', onClick, disabled = false, children, tipSide = 'top' }) {
  return (
    <Tip text={label} side={tipSide}>
      <button
        type="button"
        className={`pl-iconbtn pl-iconbtn--${tone}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        {children}
      </button>
    </Tip>
  );
}

/* ───────────────────────────── شاخص و نمودار ───────────────────────────── */

export function Kpi({ label, value, unit, hint, delta, tone = 'accent', icon: Icon, onClick, footer }) {
  const DeltaTag = delta === undefined || delta === null ? null : (
    <span className={`pl-kpi__delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : 'is-flat'}`}>
      {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {toFa(Math.abs(Number(delta)).toFixed(1))}٪
    </span>
  );

  const Element = onClick ? 'button' : 'div';

  return (
    <Element
      type={onClick ? 'button' : undefined}
      className={`pl-kpi pl-kpi--${tone} ${onClick ? 'is-clickable' : ''}`.trim()}
      onClick={onClick}
    >
      <div className="pl-kpi__head">
        {Icon ? <span className="pl-kpi__icon" aria-hidden="true"><Icon width={16} height={16} /></span> : null}
        <span className="pl-kpi__label">{label}</span>
        {DeltaTag}
      </div>
      <div className="pl-kpi__value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {hint ? <p className="pl-kpi__hint">{hint}</p> : null}
      {footer}
    </Element>
  );
}

export function Meter({ value, max = 100, tone = 'accent', label, showValue = true, compact = false }) {
  const percent = max ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  return (
    <div className={`pl-meter ${compact ? 'pl-meter--compact' : ''}`.trim()}>
      {label || showValue ? (
        <div className="pl-meter__head">
          {label ? <span>{label}</span> : <span />}
          {showValue ? <b>{toFa(Math.round(percent))}٪</b> : null}
        </div>
      ) : null}
      <div className="pl-meter__track">
        <span className="pl-meter__fill" style={{ width: `${percent}%`, background: toneVar(tone) }} />
      </div>
    </div>
  );
}

export function Bar({ value, max, tone = 'accent', label, valueLabel }) {
  const percent = max ? Math.min(100, Math.abs(value / max) * 100) : 0;
  return (
    <div className="pl-bar">
      <span className="pl-bar__label">{label}</span>
      <span className="pl-bar__track"><span className="pl-bar__fill" style={{ width: `${percent}%`, background: toneVar(tone) }} /></span>
      <span className="pl-bar__value">{valueLabel ?? faNumber(value)}</span>
    </div>
  );
}

/* نمودار میله‌ای گروهی — SVG خالص، بدون کتابخانه */
export function BarChart({ data, series, height = 190, format = faNumber, emptyLabel = 'داده‌ای برای نمایش نیست' }) {
  const [hover, setHover] = useState(null);

  if (!data?.length) return <div className="pl-chart__empty">{emptyLabel}</div>;

  const width = Math.max(520, data.length * 68);
  const padding = { top: 16, right: 12, bottom: 30, left: 12 };
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...data.flatMap((row) => series.map((item) => Number(row[item.key]) || 0)));
  const groupW = (width - padding.left - padding.right) / data.length;
  const barW = Math.min(20, (groupW - 10) / series.length);

  return (
    <div className="pl-chart" dir="ltr">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="نمودار میله‌ای">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = padding.top + plotH * (1 - step);
          return <line key={step} x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="pl-chart__grid" />;
        })}

        {data.map((row, index) => {
          const groupX = padding.left + index * groupW;
          return (
            <g key={row.label ?? index}>
              {series.map((item, seriesIndex) => {
                const raw = Number(row[item.key]) || 0;
                const barH = Math.max(raw === 0 ? 0 : 2, (Math.abs(raw) / max) * plotH);
                const x = groupX + groupW / 2 - (series.length * barW) / 2 + seriesIndex * barW;
                const y = padding.top + plotH - barH;
                const isHover = hover === `${index}-${seriesIndex}`;
                return (
                  <rect
                    key={item.key}
                    x={x}
                    y={y}
                    width={barW - 2}
                    height={barH}
                    rx="3"
                    fill={toneVar(item.color)}
                    opacity={hover && !isHover ? 0.45 : 0.92}
                    onMouseEnter={() => setHover(`${index}-${seriesIndex}`)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <title>{`${row.label} · ${item.label}: ${format(raw)}`}</title>
                  </rect>
                );
              })}
              <text x={groupX + groupW / 2} y={height - 10} className="pl-chart__tick" textAnchor="middle">
                {row.short ?? row.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="pl-legend">
        {series.map((item) => (
          <span key={item.key} className="pl-legend__item">
            <Dot tone={item.color} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* نمودار خطی با ناحیهٔ سایه — برای روند درآمد/سود */
export function LineChart({ data, series, height = 200, format = faNumber, emptyLabel = 'داده‌ای برای نمایش نیست' }) {
  const [hover, setHover] = useState(null);

  if (!data?.length) return <div className="pl-chart__empty">{emptyLabel}</div>;

  const width = Math.max(520, data.length * 62);
  const padding = { top: 18, right: 14, bottom: 30, left: 14 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...data.flatMap((row) => series.map((item) => Number(row[item.key]) || 0)));
  const stepX = data.length > 1 ? plotW / (data.length - 1) : plotW;

  const point = (row, index, key) => ({
    x: padding.left + index * stepX,
    y: padding.top + plotH - ((Number(row[key]) || 0) / max) * plotH,
  });

  return (
    <div className="pl-chart" dir="ltr">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="نمودار روند">
        {[0, 0.5, 1].map((step) => {
          const y = padding.top + plotH * (1 - step);
          return <line key={step} x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="pl-chart__grid" />;
        })}

        {series.map((item) => {
          const points = data.map((row, index) => point(row, index, item.key));
          const path = points.map((p, index) => `${index ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
          const area = `${path} L${points[points.length - 1].x.toFixed(1)},${(padding.top + plotH).toFixed(1)} L${points[0].x.toFixed(1)},${(padding.top + plotH).toFixed(1)} Z`;

          return (
            <g key={item.key}>
              <path d={area} fill={toneVar(item.color)} opacity="0.12" />
              <path d={path} fill="none" stroke={toneVar(item.color)} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, index) => (
                <circle
                  key={index}
                  cx={p.x}
                  cy={p.y}
                  r={hover === index ? 4.6 : 3}
                  fill={toneVar(item.color)}
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>{`${data[index].label} · ${item.label}: ${format(Number(data[index][item.key]) || 0)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {data.map((row, index) => (
          <text key={row.label ?? index} x={padding.left + index * stepX} y={height - 10} className="pl-chart__tick" textAnchor="middle">
            {row.short ?? row.label}
          </text>
        ))}
      </svg>

      <div className="pl-legend">
        {series.map((item) => (
          <span key={item.key} className="pl-legend__item">
            <Dot tone={item.color} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* نمودار حلقه‌ای — توزیع وضعیت تسک‌ها و سهم هزینه‌ها */
export function Donut({ slices, size = 148, thickness = 18, centerLabel, centerValue }) {
  const total = slices.reduce((sum, slice) => sum + (Number(slice.value) || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="pl-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="نمودار حلقه‌ای">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ad-surface-3)" strokeWidth={thickness} />
          {total > 0 && slices.map((slice) => {
            const share = (Number(slice.value) || 0) / total;
            const dash = share * circumference;
            const element = (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={toneVar(slice.color)}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              >
                <title>{`${slice.label}: ${faNumber(slice.value)}`}</title>
              </circle>
            );
            offset += dash;
            return element;
          })}
        </g>
      </svg>

      <div className="pl-donut__center">
        <b>{centerValue ?? faNumber(total)}</b>
        <span>{centerLabel ?? 'مجموع'}</span>
      </div>
    </div>
  );
}

export function Legend({ items }) {
  const total = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  return (
    <ul className="pl-legendlist">
      {items.map((item) => (
        <li key={item.label}>
          <Dot tone={item.color} />
          <span className="pl-legendlist__label">{item.label}</span>
          <span className="pl-legendlist__value">{faNumber(item.value)}</span>
          <span className="pl-legendlist__share">{total ? toFa(Math.round((item.value / total) * 100)) : '۰'}٪</span>
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────────── حالت‌ها ───────────────────────────── */

export function Empty({ title, description, action }) {
  return (
    <div className="pl-empty">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="pl-empty__action">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ rows = 4, height = 44 }) {
  return (
    <div className="pl-skeleton" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <span key={index} style={{ height }} />
      ))}
    </div>
  );
}

export function InlineError({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="pl-inline-error" role="alert">
      <div>
        <strong>دریافت داده ناموفق بود</strong>
        <p>{error.message ?? 'خطای نامشخص'}</p>
      </div>
      {onRetry ? <button type="button" className="pl-linkbtn" onClick={onRetry}>تلاش دوباره</button> : null}
    </div>
  );
}

/* ───────────────────────────── خروجی گرفتن ───────────────────────────── */

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/*
 * خروجی CSV — با BOM و بدون تبدیل ارقام.
 * ارقام عمداً لاتین می‌مانند تا اکسل آن‌ها را عدد ببیند و بتواند جمع بزند؛
 * نمایش فارسی در رابط کاربری است، نه در فایل خروجی.
 */
export function exportCsv(name, columns, rows) {
  if (!rows?.length) return false;

  const head = columns.map((column) => column.label).join(',');
  const body = rows.map((row) => columns.map((column) => {
    const value = typeof column.value === 'function' ? column.value(row) : row[column.key];
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\n');

  downloadFile(`tapesh-${name}-${stamp()}.csv`, `\uFEFF${head}\n${body}`, 'text/csv;charset=utf-8');
  return true;
}

/* خروجی اکسل — قالب HTML با پسوند .xls؛ اکسل آن را بومی باز می‌کند و کتابخانه لازم نیست */
export function exportExcel(name, columns, rows, title = '') {
  if (!rows?.length) return false;

  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = rows.map((row) => `<tr>${columns.map((column) => {
    const value = typeof column.value === 'function' ? column.value(row) : row[column.key];
    return `<td>${escapeHtml(value)}</td>`;
  }).join('')}</tr>`).join('');

  const html = `<html dir="rtl"><head><meta charset="utf-8"></head><body>
    <h3>${escapeHtml(title || name)}</h3>
    <table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`;

  downloadFile(`tapesh-${name}-${stamp()}.xls`, html, 'application/vnd.ms-excel');
  return true;
}

export function ExportMenu({ disabled, onExport }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div className="pl-export" ref={ref}>
      <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" disabled={disabled} onClick={() => setOpen((value) => !value)}>
        <IconDownload width={15} height={15} />
        خروجی
      </button>
      {open ? (
        <div className="pl-export__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onExport('csv'); }}>CSV</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onExport('excel'); }}>Excel</button>
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── پنجرهٔ سبک ───────────────────────────── */

export function Drawer({ open, title, subtitle, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pl-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="pl-drawer__scrim" aria-label="بستن" onClick={onClose} />
      <aside className="pl-drawer__panel" style={{ width }}>
        <header className="pl-drawer__head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="pl-iconbtn" onClick={onClose} aria-label="بستن">
            <IconClose width={16} height={16} />
          </button>
        </header>
        <div className="pl-drawer__body">{children}</div>
        {footer ? <footer className="pl-drawer__foot">{footer}</footer> : null}
      </aside>
    </div>
  );
}

/* ───────────────────────────── هوک‌های کمکی ───────────────────────────── */

/* فهرست را با یک تابع کلید به نقشه تبدیل می‌کند (برای نمایش نام‌ها) */
export function useIndex(list, key = 'id') {
  return useMemo(() => {
    const map = new Map();
    (list ?? []).forEach((item) => map.set(item[key], item));
    return map;
  }, [list, key]);
}

/* کپی ملایم متن در کلیپ‌بورد با بازخورد */
export function useCopy() {
  const [copied, setCopied] = useState('');

  const copy = async (text, id = 'x') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setCopied('');
    }
  };

  return { copied, copy };
}

/* ارقام فارسی برای نمایش در فیلدهای عددی */
export const fa = toFa;
