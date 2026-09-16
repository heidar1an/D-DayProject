/*
 * اجزای مشترک مرکز رسانه و فضای مجازی — پیشوند `mc-`.
 *
 * این کیت *مستقل* است و از لایهٔ تحلیل (`analyticsKit`) چیزی وارد نمی‌کند؛ دو
 * لایه باید جدا بمانند تا تغییر یکی دیگری را نشکند. اما دو قاعدهٔ سخت پروژه
 * عیناً همین‌جا رعایت می‌شود:
 *
 *   1. هیچ عددی ساخته نمی‌شود. اگر سنجه‌ای موجود نباشد `null` می‌ماند و «—»
 *      نمایش داده می‌شود — نه صفر. صفر یک ادعای غلط است.
 *   2. هر بخش سه حالت دارد: بارگذاری (اسکلت)، خالی (توضیح + اقدام) و خطا
 *      (پیام + تلاش دوباره). هیچ‌کدام به‌عنوان «صفر» جا زده نمی‌شوند.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { toFa, faNumber, faDate, faDateTime, relativeTime, faFileSize } from '../adminShared';

export { toFa, faNumber, faDate, faDateTime, relativeTime, faFileSize };

/* ─────────────────────────── قالب‌بندی ─────────────────────────── */

/*
 * قالب‌بندی عدد. `null` هرگز صفر نمی‌شود.
 * `unit` برای پسوندهایی مثل «٪» یا «نفر» است.
 */
export function fmt(value, { digits = null, unit = '', compact = false } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);

  let text;
  if (compact && Math.abs(number) >= 1000) {
    const units = [
      { limit: 1e9, suffix: 'میلیارد' },
      { limit: 1e6, suffix: 'میلیون' },
      { limit: 1e3, suffix: 'هزار' },
    ];
    const found = units.find((row) => Math.abs(number) >= row.limit);
    text = `${toFa((number / found.limit).toFixed(Math.abs(number / found.limit) >= 100 ? 0 : 1))} ${found.suffix}`;
  } else if (digits !== null) {
    text = toFa(number.toFixed(digits));
  } else if (Number.isInteger(number)) {
    text = faNumber(number);
  } else {
    text = toFa(number.toFixed(Math.abs(number) >= 100 ? 0 : 1));
  }

  return unit ? `${text} ${unit}` : text;
}

export const pct = (value, digits = 1) => (
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? '—'
    : `${toFa(Number(value).toFixed(digits))}٪`
);

/* درصد با علامت — برای نمایش «۲.۴ برابر میانگین» */
export const ratio = (value) => (
  value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : `${toFa(Number(value).toFixed(1))}×`
);

export function shortDate(iso) {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return toFa(new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(date));
  } catch {
    return '—';
  }
}

export function clockTime(iso) {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return toFa(new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(date));
  } catch {
    return '—';
  }
}

/* `YYYY-MM-DD` محلی — بدون inUTC شدن تاریخ */
export const dayStamp = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const parseDay = (stamp) => {
  const [y, m, d] = String(stamp ?? '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/* ─────────────────────────── نمودارها ─────────────────────────── */

const linePath = (values, width, height, pad) => {
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values.map((value, index) => {
    const x = pad + index * step;
    const y = height - pad - ((value / max) * (height - pad * 2));
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
};

/*
 * نمودار ناحیه‌ای ساده — SVG خالص، بدون کتابخانه.
 * `series` آرایه‌ای از `{ key, label, color, values }` است.
 * اگر هیچ داده‌ای نباشد، پیام «بدون داده» نشان داده می‌شود — نه محور خالی.
 */
export function AreaChart({ labels = [], series = [], height = 168, showLabels = true }) {
  const width = 640;
  const pad = 18;
  const hasData = series.some((row) => row.values.some((value) => Number(value) > 0));

  if (!hasData) {
    return <p className="mc-chart__empty">برای این بازه داده‌ای ثبت نشده است.</p>;
  }

  return (
    <div className="mc-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="نمودار روند">
        <defs>
          <linearGradient id="mcAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(147, 127, 205, 0.35)" />
            <stop offset="100%" stopColor="rgba(147, 127, 205, 0)" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            className="mc-chart__grid"
            x1={pad}
            x2={width - pad}
            y1={pad + ratio * (height - pad * 2)}
            y2={pad + ratio * (height - pad * 2)}
          />
        ))}

        {series.map((row) => (
          <path
            key={`area-${row.key}`}
            className="mc-chart__area"
            d={`${linePath(row.values, width, height, pad)} L${width - pad},${height - pad} L${pad},${height - pad} Z`}
            fill={row.fill ?? 'url(#mcAreaFill)'}
            opacity={row.opacity ?? 1}
          />
        ))}

        {series.map((row) => (
          <path
            key={`line-${row.key}`}
            className="mc-chart__line"
            d={linePath(row.values, width, height, pad)}
            stroke={row.color ?? '#937fcd'}
          />
        ))}

        {showLabels && labels.length ? (
          <>
            <text className="mc-chart__label" x={pad} y={height - 4}>{labels[0]}</text>
            <text className="mc-chart__label" x={width - pad} y={height - 4} textAnchor="end">
              {labels[labels.length - 1]}
            </text>
          </>
        ) : null}
      </svg>
    </div>
  );
}

/* جرقهٔ کوچک داخل کارت سنجه */
export function Sparkline({ values = [], color = '#937fcd' }) {
  if (!values.length || !values.some((value) => Number(value) > 0)) {
    return <svg className="mc-spark" viewBox="0 0 100 26" aria-hidden="true" />;
  }
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(24 - (value / max) * 22).toFixed(1)}`).join(' ');
  return (
    <svg className="mc-spark" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} stroke={color} />
    </svg>
  );
}

/* میله‌های افقی — مقایسهٔ پلتفرم‌ها، انواع محتوا، هشتگ‌ها */
export function BarList({ rows = [], color = '#937fcd', formatter = (value) => fmt(value, { compact: true }) }) {
  const max = Math.max(...rows.map((row) => Number(row.value) || 0), 1);

  if (!rows.length) return <p className="mc-chart__empty">موردی برای مقایسه نیست.</p>;

  return (
    <div className="mc-bars">
      {rows.map((row) => (
        <div key={row.key ?? row.label}>
          <div className="mc-bar__head">
            <span>{row.label}</span>
            <span className="mc-muted">{row.display ?? formatter(row.value)}</span>
          </div>
          <div className="mc-bar__track">
            <div
              className="mc-bar__fill"
              style={{ width: `${((Number(row.value) || 0) / max) * 100}%`, background: row.color ?? color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* دونات — سهم پلتفرم‌ها از یک سنجه */
export function Donut({ rows = [], caption = 'کل', centerValue = null }) {
  const total = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  if (!total) return <p className="mc-chart__empty">داده‌ای برای نمایش سهم‌ها نیست.</p>;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="mc-donut">
      <svg viewBox="0 0 132 132" role="img" aria-label="سهم پلتفرم‌ها">
        <g transform="rotate(-90 66 66)">
          {rows.map((row) => {
            const fraction = (Number(row.value) || 0) / total;
            const dash = fraction * circumference;
            const element = (
              <circle
                key={row.key ?? row.label}
                cx="66"
                cy="66"
                r={radius}
                fill="none"
                stroke={row.color ?? '#937fcd'}
                strokeWidth="13"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return element;
          })}
        </g>
        <text className="mc-donut__value" x="66" y="62" textAnchor="middle">
          {centerValue ?? fmt(total, { compact: true })}
        </text>
        <text className="mc-donut__caption" x="66" y="78" textAnchor="middle">{caption}</text>
      </svg>

      <div className="mc-legend" style={{ flexDirection: 'column', gap: '0.35rem' }}>
        {rows.map((row) => (
          <span key={row.key ?? row.label}>
            <i style={{ background: row.color ?? '#937fcd' }} />
            {row.label} — {fmt(row.value, { compact: true })} ({pct(((Number(row.value) || 0) / total) * 100, 0)})
          </span>
        ))}
      </div>
    </div>
  );
}

/* قیف تبدیل — کلیک → بازدید سایت → ثبت‌نام → خرید */
export function Funnel({ funnel }) {
  if (!funnel?.steps?.length) return <p className="mc-chart__empty">دادهٔ قیف موجود نیست.</p>;

  const rates = {
    visits: funnel.visitRate,
    signups: funnel.signupRate,
    purchases: funnel.purchaseRate,
  };

  return (
    <div className="mc-funnel">
      {funnel.steps.map((step, index) => (
        <div className="mc-funnel__step" key={step.id}>
          <span className="mc-funnel__label">
            {index > 0 ? <span className="mc-muted">↳ </span> : null}
            {step.label}
          </span>
          <span className="mc-funnel__value">{fmt(step.value)}</span>
          <span className="mc-funnel__rate">{index === 0 ? '۱۰۰٪' : pct(rates[step.id])}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── نشان‌ها ─────────────────────────── */

export function Pill({ tone = 'neutral', children, dot = false }) {
  return (
    <span className={`mc-pill mc-pill--${tone}`}>
      {dot ? <i className={`mc-dot mc-dot--${tone}`} /> : null}
      {children}
    </span>
  );
}

export function Delta({ value, digits = 1, suffix = '٪' }) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return <span className="mc-delta mc-delta--none">بدون مبنای مقایسه</span>;
  }

  const number = Number(value);
  const direction = Math.abs(number) < 0.05 ? 'flat' : number > 0 ? 'up' : 'down';
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '■';

  return (
    <span className={`mc-delta mc-delta--${direction}`}>
      {arrow} {toFa(Math.abs(number).toFixed(digits))}{suffix}
    </span>
  );
}

/* کارت سنجه — اگر مقدار نداشت، «—» با توضیح علت */
export function Kpi({ label, value, hint, format = 'number', delta = null, deltaDigits = 1, spark = null, onClick }) {
  const isEmpty = value === null || value === undefined;

  let rendered;
  if (isEmpty) rendered = '—';
  else if (format === 'percent') rendered = pct(value);
  else if (format === 'compact') rendered = fmt(value, { compact: true });
  else if (format === 'seconds') rendered = `${toFa(Number(value).toFixed(0))} ثانیه`;
  else rendered = fmt(value);

  const interactive = typeof onClick === 'function';

  return (
    <article
      className={`mc-kpi ${interactive ? 'is-clickable' : ''}`}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (event) => { if (event.key === 'Enter') onClick(); } : undefined}
    >
      <span className="mc-kpi__label">{label}</span>
      <span className={`mc-kpi__value ${isEmpty ? 'is-empty' : ''}`}>{rendered}</span>
      {delta !== null && delta !== undefined ? <Delta value={delta} digits={deltaDigits} /> : null}
      {spark ? <Sparkline values={spark} /> : null}
      {hint ? <span className="mc-kpi__hint">{hint}</span> : null}
    </article>
  );
}

/* ─────────────────────────── پوسته ─────────────────────────── */

export function Panel({ title, description, actions, children, flush = false, footer = null }) {
  return (
    <section className="mc-panel">
      {title || actions ? (
        <header className="mc-panel__head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="mc-panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`mc-panel__body ${flush ? 'mc-panel__body--flush' : ''}`}>{children}</div>
      {footer ? <div className="mc-panel__foot">{footer}</div> : null}
    </section>
  );
}

export function SectionTitle({ title, hint }) {
  return (
    <div className="mc-section-title">
      <h3>{title}</h3>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}

/* ─────────────────────────── سه حالت پایه ─────────────────────────── */

export function SkeletonCards({ count = 4 }) {
  return (
    <div className="mc-skeleton-row">
      {Array.from({ length: count }, (_, index) => <div className="mc-skeleton" key={index} />)}
    </div>
  );
}

export function Empty({ title, description, action = null }) {
  return (
    <div className="mc-empty">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }) {
  return (
    <div className="mc-empty">
      <strong>بارگذاری انجام نشد</strong>
      <p>{error?.message ?? 'خطای نامشخص'}</p>
      {onRetry ? <button type="button" className="ad-btn ad-btn--ghost" onClick={onRetry}>تلاش دوباره</button> : null}
    </div>
  );
}

/*
 * `useLoader` — همان `useAsync` پروژه ولی با نگه‌داشتن مقدار قبلی در زمان
 * بارگذاری مجدد (تا جدول/نمودار نلرزد). وابستگی‌ها با `JSON.stringify`
 * مقایسه می‌شوند تا آرایه/شیء تازه هر رندر باعث حلقهٔ fetch نشود.
 */
export function useLoader(loader, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: immediate });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(deps);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!immediate) return undefined;
    let active = true;

    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.resolve()
      .then(loader)
      .then((data) => { if (active && alive.current) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (active && alive.current) setState((current) => ({ data: current.data, error, loading: false })); });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = () => setTick((value) => value + 1);

  return { ...state, reload, setData: (data) => setState((current) => ({ ...current, data })) };
}

/* ─────────────────────────── کنترل‌ها ─────────────────────────── */

/* انتخاب بازه — با پشتیبانی از بازهٔ دلخواه */
export function RangePicker({ ranges = [], value, from, to, onChange }) {
  const custom = value === 'custom';

  return (
    <div className="mc-row" style={{ gap: '0.5rem' }}>
      <div className="mc-ranges">
        {ranges.map((row) => (
          <button
            key={row.key}
            type="button"
            className={`mc-range ${value === row.key ? 'is-active' : ''}`}
            onClick={() => onChange({ range: row.key, from: null, to: null })}
          >
            {row.label}
          </button>
        ))}
        <button
          type="button"
          className={`mc-range ${custom ? 'is-active' : ''}`}
          onClick={() => onChange({ range: 'custom', from: from ?? dayStamp(addDays(new Date(), -29)), to: to ?? dayStamp(new Date()) })}
        >
          دلخواه
        </button>
      </div>

      {custom ? (
        <div className="mc-dates">
          <label>
            از
            <input type="date" value={from ?? ''} onChange={(event) => onChange({ range: 'custom', from: event.target.value, to })} />
          </label>
          <label>
            تا
            <input type="date" value={to ?? ''} onChange={(event) => onChange({ range: 'custom', from, to: event.target.value })} />
          </label>
        </div>
      ) : null}
    </div>
  );
}

/*
 * نوار جستجوی مرکزی روی همهٔ موجودیت‌ها.
 * جست‌وجو با تأخیر انجام می‌شود تا با هر حرف یک درخواست نرود.
 */
export function CentralSearch({ onSearch, onPick, placeholder = 'جست‌وجوی محتوا، کمپین، اکانت، تیم، فایل، هشتگ…' }) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    const text = term.trim();
    if (text.length < 2) { setResult(null); setBusy(false); return undefined; }

    let active = true;
    setBusy(true);
    const timer = setTimeout(() => {
      Promise.resolve()
        .then(() => onSearch(text))
        .then((data) => { if (active) { setResult(data); setBusy(false); setOpen(true); } })
        .catch(() => { if (active) { setResult(null); setBusy(false); } });
    }, 320);

    return () => { active = false; clearTimeout(timer); };
  }, [term, onSearch]);

  useEffect(() => {
    const close = (event) => { if (box.current && !box.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const groups = result?.groups ?? [];

  return (
    <div className="mc-searchbox" ref={box}>
      <input
        className="ad-input"
        value={term}
        placeholder={placeholder}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={() => { if (result) setOpen(true); }}
      />

      {open && term.trim().length >= 2 ? (
        <div className="mc-searchbox__results">
          {busy ? <div className="mc-searchbox__group"><span>در حال جست‌وجو…</span></div> : null}

          {!busy && !groups.length ? (
            <div className="mc-searchbox__group"><span>چیزی پیدا نشد.</span></div>
          ) : null}

          {groups.map((group) => (
            <div className="mc-searchbox__group" key={group.id}>
              <span>{group.label} ({toFa(group.items.length)})</span>
              {group.items.map((item) => (
                <button
                  type="button"
                  className="mc-searchbox__item"
                  key={`${group.id}-${item.id}`}
                  onClick={() => { setOpen(false); setTerm(''); onPick(item); }}
                >
                  {item.title}
                  <small>{item.subtitle}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* جدول ساده — سرستون‌ها + سطرها */
export function DataTable({ head = [], children, empty = null }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  if (!hasRows && empty) return empty;

  return (
    <div className="mc-table-wrap">
      <table className="mc-table">
        <thead>
          <tr>{head.map((cell) => <th key={String(cell)}>{cell}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* انتخاب‌گر ساده روی گزینه‌های `{id,label}` */
export function Picker({ value, onChange, options = [], allLabel = 'همه' }) {
  return (
    <select className="ad-input ad-input--select" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="all">{allLabel}</option>
      {options.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
    </select>
  );
}

/* ورودی متن با تأخیر — برای فیلترهای جست‌وجو */
export function DebouncedInput({ value, onChange, placeholder, delay = 320, className = 'ad-input' }) {
  const [local, setLocal] = useState(value ?? '');
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const timer = setTimeout(() => onChange(local), delay);
    return () => clearTimeout(timer);
  }, [local, delay, onChange]);

  useEffect(() => { setLocal(value ?? ''); }, [value]);

  return (
    <input className={className} value={local} placeholder={placeholder} onChange={(event) => setLocal(event.target.value)} />
  );
}

/* ─────────────────────────── خروجی گرفتن ─────────────────────────── */

const downloadFile = (filename, content, mime = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/*
 * خروجی گزارش. `report` همان چیزی است که `buildReport` برمی‌گرداند:
 * `{ title, range, summary, columns, rows }` — پس ستون‌ها و سطرها مستقیم
 * از سرور می‌آیند و کلاینت چیزی از خودش اضافه نمی‌کند.
 */
export function exportReport(format, report) {
  if (!report?.columns?.length) return false;

  const title = report.title ?? 'گزارش';
  const rangeLabel = report.range?.label ?? '';
  const numeric = new Set(report.numericColumns ?? []);

  if (format === 'csv') {
    const lines = [
      `# ${title}${rangeLabel ? ` | بازه: ${rangeLabel}` : ''}`,
      `# تاریخ تولید: ${report.generatedAt ?? new Date().toISOString()}`,
      '',
      `# خلاصه`,
      ...(report.summary ?? []).map((row) => `${csvCell(row.label)},${csvCell(row.value)}`),
      '',
      `# داده`,
      report.columns.map(csvCell).join(','),
      ...report.rows.map((row) => row.map(csvCell).join(',')),
    ];
    downloadFile(`tapesh-media-${title}-${stamp()}.csv`, `\uFEFF${lines.join('\n')}`);
    return true;
  }

  const escape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (format === 'excel') {
    const head = report.columns.map((cell) => `<th>${escape(cell)}</th>`).join('');
    const body = report.rows.map((row) => `<tr>${row.map((cell, index) => (
      `<td style="text-align:${numeric.has(index) ? 'center' : 'right'}">${escape(cell)}</td>`
    )).join('')}</tr>`).join('');

    const summary = (report.summary ?? [])
      .map((row) => `<tr><td>${escape(row.label)}</td><td>${escape(row.value)}</td></tr>`).join('');

    const html = `<html dir="rtl"><head><meta charset="utf-8" />
      <style>body{font-family:Tahoma,sans-serif;direction:rtl}
      h1{font-size:15px}h3{font-size:13px;color:#555}
      table{border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #999;padding:4px 8px;text-align:right}
      th{background:#eee}</style></head><body>
      <h1>تپش — ${escape(title)}${rangeLabel ? ` — ${escape(rangeLabel)}` : ''}</h1>
      <h3>خلاصه</h3><table border="1"><tbody>${summary}</tbody></table>
      <h3>داده</h3><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </body></html>`;

    downloadFile(`tapesh-media-${title}-${stamp()}.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
    return true;
  }

  /* PDF از موتور چاپ مرورگر — بدون هیچ کتابخانه‌ای */
  const head = report.columns.map((cell) => `<th>${escape(cell)}</th>`).join('');
  const body = report.rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('');
  const summary = (report.summary ?? []).map((row) => `<li>${escape(row.label)}: <b>${escape(row.value)}</b></li>`).join('');

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.inset = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8" /><title>${escape(title)}</title>
    <style>
      @page { size: A4 landscape; margin: 14mm; }
      body { font-family: Tahoma, sans-serif; direction: rtl; color: #111; }
      h1 { font-size: 16px; margin: 0 0 4px; }
      .meta { color: #666; font-size: 11px; margin-bottom: 14px; }
      ul { padding-inline-start: 18px; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; }
      th, td { border: 1px solid #999; padding: 5px 7px; text-align: right; }
      th { background: #eee; }
      tr { page-break-inside: avoid; }
    </style></head><body>
    <h1>تپش — ${escape(title)}</h1>
    <div class="meta">${rangeLabel ? `بازه: ${escape(rangeLabel)} — ` : ''}تاریخ تولید: ${escape(faDateTime(report.generatedAt ?? new Date().toISOString()))}</div>
    <ul>${summary}</ul>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
  doc.close();

  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => document.body.removeChild(frame), 1500);
  return true;
}

/* ─────────────────────────── نگاشت‌های مشترک ─────────────────────────── */

export const STATUS_TONE = (statuses, id) => statuses.find((row) => row.id === id)?.tone ?? 'neutral';
export const STATUS_LABEL = (statuses, id) => statuses.find((row) => row.id === id)?.label ?? id ?? '—';
export const labelOf = (rows, id) => rows.find((row) => row.id === id)?.label ?? id ?? '—';

/* وضعیت اتصال اکانت — سه حالت صادقانه، بدون «متصل» الکی */
export function ConnectionPill({ account }) {
  if (!account.adapter) {
    return <Pill tone="muted" dot>پلتفرم بدون آداپتور — ثبت دستی</Pill>;
  }
  if (account.tokenSource === 'none' && !account.hasToken) {
    return <Pill tone="warn" dot>کلید API ثبت نشده</Pill>;
  }
  if (account.lastSyncStatus === 'error') {
    return <Pill tone="danger" dot>خطای هم‌گام‌سازی</Pill>;
  }
  return <Pill tone="ok" dot>اتصال برقرار — {account.tokenSource === 'channel' ? 'از کانال انتشار' : account.tokenSource === 'env' ? 'از متغیر محیطی' : 'کلید ذخیره‌شده'}</Pill>;
}

/* کلید را هرگز کامل نشان نده */
export const maskKey = (hint, has) => (has ? (hint || '••••••••') : '—');

/* محاسبهٔ «کدام حالت خالی» — کمک به تصمیم‌گیری UI */
export function useStableOptions(rows, mapper) {
  return useMemo(() => (rows ?? []).map(mapper), [rows, mapper]);
}
