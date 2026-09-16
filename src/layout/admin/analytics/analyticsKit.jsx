/*
 * اجزای مشترک مرکز تحلیل تپش.
 *
 * همهٔ ۱۶ بخش از اینجا تغذیه می‌شوند تا زبان بصری یکسان بماند: کارت سنجه،
 * نشان وضعیت، پنل «نیازمند اتصال»، جدول داده و خروجی گرفتن.
 *
 * دو قاعدهٔ سخت که در کل این لایه رعایت می‌شود:
 *   1. هیچ عددی ساخته نمی‌شود. اگر منبع داده وصل نباشد، `NeedsConnection`
 *      نمایش داده می‌شود — نه نمودار تزئینی و نه عدد تخمینی.
 *   2. سنجهٔ بدون مقدار (`available: false` یا `value: null`) با «—» نشان داده
 *      می‌شود، نه با صفر؛ چون صفر یک ادعای غلط است.
 */

import { useMemo, useState } from 'react';

import { toFa, faNumber } from '../adminShared';
import { Sparkline, Gauge } from './analyticsCharts';

export { toFa, faNumber };

/* ─────────────────────────── وضعیت ─────────────────────────── */

const STATUS_LABELS = {
  good: 'خوب',
  warn: 'نیازمند توجه',
  critical: 'بحرانی',
  neutral: 'بدون مبنا',
  healthy: 'سالم',
  degraded: 'کاهش عملکرد',
  down: 'قطع',
  unknown: 'نامشخص',
};

const STATUS_TONES = {
  good: 'good', healthy: 'good',
  warn: 'warn', degraded: 'warn',
  critical: 'critical', down: 'critical',
  neutral: 'neutral', unknown: 'neutral',
};

export const statusTone = (status) => STATUS_TONES[status] ?? 'neutral';
export const statusLabel = (status) => STATUS_LABELS[status] ?? status ?? '—';

/* نقطهٔ وضعیت — سبز/زرد/قرمز مطابق قرارداد پروژه */
export function StatusDot({ status = 'neutral', title }) {
  return <i className={`an-dot an-dot--${statusTone(status)}`} title={title ?? statusLabel(status)} aria-hidden="true" />;
}

export function StatusPill({ status = 'neutral', label }) {
  return (
    <span className={`an-pill an-pill--${statusTone(status)}`}>
      <StatusDot status={status} />
      {label ?? statusLabel(status)}
    </span>
  );
}

const SEVERITY_LABELS = { critical: 'بحرانی', high: 'بالا', medium: 'متوسط', low: 'پایین' };
export const severityLabel = (severity) => SEVERITY_LABELS[severity] ?? severity ?? '—';

export function SeverityBadge({ severity }) {
  return <span className={`an-sev an-sev--${severity ?? 'low'}`}>{severityLabel(severity)}</span>;
}

/* ─────────────────────────── تغییر نسبت به بازهٔ قبل ─────────────────────────── */

/*
 * `delta` درصد تغییر است. `null` یعنی مبنای مقایسه وجود ندارد (بازهٔ قبل خالی
 * بوده) — در آن حالت «—» نشان می‌دهیم نه «۰٪»، چون مقایسه بی‌معناست.
 */
export function DeltaBadge({ delta, direction, status, unit = '٪', invert = false }) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) {
    return <span className="an-delta an-delta--none">— بدون مبنا</span>;
  }

  const rising = direction === 'up';
  const flat = direction === 'flat' || Math.abs(delta) < 0.05;

  /* برای سنجه‌های «کمتر بهتر است» (نرخ پرش، خطا) رنگ برعکس می‌شود */
  const tone = flat
    ? 'neutral'
    : (rising !== invert ? 'good' : 'warn');

  return (
    <span className={`an-delta an-delta--${tone}`}>
      <span aria-hidden="true">{flat ? '→' : rising ? '▲' : '▼'}</span>
      {toFa(Math.abs(delta).toFixed(1))}{unit}
    </span>
  );
}

/* ─────────────────────────── کارت سنجه (KPI) ─────────────────────────── */

/*
 * یک سنجه با: مقدار، واحد، تغییر نسبت به بازهٔ قبل، وضعیت، نمودار جرقه و
 * توضیح روش محاسبه (Tooltip). سنجهٔ ناموجود به‌جای عدد، دلیل نبودنش را
 * نشان می‌دهد.
 */
export function KpiCard({ kpi, spark, invert = false, onDrill, compact = false }) {
  const unavailable = kpi.available === false || kpi.value === null || kpi.value === undefined;

  return (
    <article className={`an-kpi an-kpi--${statusTone(kpi.status)} ${compact ? 'is-compact' : ''}`}>
      <header className="an-kpi__head">
        <span className="an-kpi__label" title={kpi.hint}>{kpi.label}</span>
        {!unavailable ? <StatusDot status={kpi.status} /> : <span className="an-kpi__na">ناموجود</span>}
      </header>

      <div className="an-kpi__body">
        <strong className="an-kpi__value">
          {unavailable ? '—' : formatValue(kpi.value)}
          {!unavailable && kpi.unit ? <small>{kpi.unit}</small> : null}
        </strong>
        {spark?.length > 1 ? <Sparkline values={spark} /> : null}
      </div>

      <footer className="an-kpi__foot">
        {unavailable ? (
          <span className="an-muted an-kpi__reason">{kpi.hint || 'دادهٔ این سنجه در دسترس نیست'}</span>
        ) : (
          <>
            <DeltaBadge delta={kpi.delta} direction={kpi.direction} status={kpi.status} invert={invert} />
            <span className="an-kpi__prev">قبل: {formatValue(kpi.previous)}</span>
          </>
        )}
        {onDrill ? (
          <button type="button" className="an-linkbtn" onClick={onDrill}>جزئیات</button>
        ) : null}
      </footer>

      {kpi.hint && !unavailable ? <span className="an-kpi__hint">{kpi.hint}</span> : null}
    </article>
  );
}

/* قالب‌بندی عدد: اعشار فقط وقتی لازم است */
export function formatValue(value, digits = null) {
  if (value === null || value === undefined || value === '') return '—';
  if (!Number.isFinite(Number(value))) return String(value);

  const number = Number(value);
  if (digits !== null) return toFa(number.toFixed(digits));

  if (Number.isInteger(number)) return faNumber(number);
  if (Math.abs(number) >= 100) return toFa(number.toFixed(0));
  return toFa(number.toFixed(1));
}

export const formatPercent = (value, digits = 1) =>
  (value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : `${toFa(Number(value).toFixed(digits))}٪`);

export const formatDuration = (seconds) => {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return '—';
  const total = Math.round(Number(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) return `${toFa(minutes)}:${toFa(String(rest).padStart(2, '0'))} دقیقه`;
  const hours = Math.floor(minutes / 60);
  return `${toFa(hours)} ساعت و ${toFa(minutes % 60)} دقیقه`;
};

export const formatBytes = (bytes) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '—';
  if (size < 1024) return `${toFa(size)} بایت`;
  if (size < 1048576) return `${toFa((size / 1024).toFixed(0))} کیلوبایت`;
  if (size < 1073741824) return `${toFa((size / 1048576).toFixed(1))} مگابایت`;
  return `${toFa((size / 1073741824).toFixed(2))} گیگابایت`;
};

/* ─────────────────────────── پنل و سرتیتر ─────────────────────────── */

export function Panel({ title, description, actions, children, className = '', tone }) {
  return (
    <section className={`an-panel ${tone ? `an-panel--${tone}` : ''} ${className}`}>
      {title || actions ? (
        <header className="an-panel__head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="an-panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="an-panel__body">{children}</div>
    </section>
  );
}

/* سرتیتر بخش — همان الگوی هیروهای پروژه: خط کوچک + خط بزرگ */
export function SectionHero({ eyebrow, title, description, actions }) {
  return (
    <header className="an-hero">
      <div>
        <span className="an-hero__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="an-hero__actions">{actions}</div> : null}
    </header>
  );
}

/*
 * پنل «نیازمند اتصال» — قلب صداقت این پنل.
 * هر جا داده از یک سرویس بیرونی می‌آید و آن سرویس وصل نیست، این کادر با
 * نام دقیق متغیرهای محیطی لازم نمایش داده می‌شود. هیچ نمودار تزئینی جایش نمی‌آید.
 */
export function NeedsConnection({ title, requires, note, items, compact = false }) {
  const keys = Array.isArray(requires)
    ? requires
    : String(requires ?? '').split(/[+,·|]/).map((part) => part.trim()).filter(Boolean);

  return (
    <div className={`an-needs ${compact ? 'is-compact' : ''}`} role="note">
      <div className="an-needs__icon" aria-hidden="true">⚙</div>
      <div className="an-needs__body">
        <strong>{title ?? 'این بخش نیازمند اتصال است'}</strong>
        {note ? <p>{note}</p> : null}
        {keys.length ? (
          <p className="an-needs__keys">
            برای فعال‌شدن، این متغیرها را در فایل <code>.env</code> تنظیم کنید:
            {keys.map((key) => <code key={key} className="an-needs__key">{key}</code>)}
          </p>
        ) : null}
        {items?.length ? (
          <ul className="an-needs__list">
            {items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/* پیام اطلاعاتی/هشدار داخل بخش */
export function Notice({ tone = 'info', children }) {
  return <p className={`an-notice an-notice--${tone}`}>{children}</p>;
}

/* ─────────────────────────── جدول داده ─────────────────────────── */

/*
 * جدول سادهٔ سبک پنل. ستون‌ها: { key, label, align, width, render(row) }.
 * مرتب‌سازی سمت کلاینت است چون داده از قبل تجمیع شده و حجمش کوچک است.
 */
export function DataTable({ columns = [], rows = [], emptyLabel = 'داده‌ای ثبت نشده', sortable = true, initialSort = null }) {
  const [sort, setSort] = useState(initialSort);

  const sorted = useMemo(() => {
    if (!sort?.key) return rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return rows;

    const value = column.sortValue ?? ((row) => row[column.key]);
    return [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left === right) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), 'fa');
      return sort.dir === 'asc' ? result : -result;
    });
  }, [rows, sort, columns]);

  if (!rows.length) return <p className="an-muted">{emptyLabel}</p>;

  return (
    <div className="an-tablewrap">
      <table className="an-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={column.width ? { width: column.width } : undefined} className={column.align ? `is-${column.align}` : ''}>
                {sortable && column.sortValue !== false ? (
                  <button
                    type="button"
                    className={`an-th ${sort?.key === column.key ? 'is-active' : ''}`}
                    onClick={() => setSort((current) => (
                      current?.key === column.key
                        ? { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
                        : { key: column.key, dir: 'desc' }
                    ))}
                  >
                    {column.label}
                    <span aria-hidden="true">{sort?.key === column.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                ) : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={row.id ?? row.key ?? index}>
              {columns.map((column) => (
                <td key={column.key} className={column.align ? `is-${column.align}` : ''}>
                  {column.render ? column.render(row) : formatCell(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const formatCell = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return formatValue(value);
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (typeof value === 'object') return '—';
  return toFa(String(value));
};

/* ─────────────────────────── خروجی گرفتن ─────────────────────────── */

/*
 * دادهٔ بخش را به «جدول‌های تخت» تبدیل می‌کند تا بتوان از هر بخش خروجی گرفت
 * بدون نوشتن کد اختصاصی برای هرکدام.
 *
 * قاعده: هر آرایه‌ای از اشیای تخت (بدون شیء تودرتو) یک جدول است. مسیر کلیدها
 * نام جدول می‌شود، مثلاً «pages.top» یا «kpis».
 */
export function collectTables(data, { maxDepth = 4, maxTables = 24 } = {}) {
  const tables = [];

  const isFlat = (item) => item
    && typeof item === 'object'
    && !Array.isArray(item)
    && Object.values(item).every((value) => value === null || typeof value !== 'object');

  const walk = (value, path, depth) => {
    if (depth > maxDepth || tables.length >= maxTables) return;

    if (Array.isArray(value)) {
      if (!value.length) return;
      if (value.every(isFlat)) {
        tables.push({ name: path || 'داده', rows: value });
        return;
      }
      value.slice(0, 30).forEach((item, index) => walk(item, `${path}[${index + 1}]`, depth + 1));
      return;
    }

    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, child]) => {
        walk(child, path ? `${path}.${key}` : key, depth + 1);
      });
    }
  };

  walk(data, '', 0);
  return tables;
}

const SCALAR_LABELS = {
  key: 'کلید', label: 'عنوان', value: 'مقدار', previous: 'بازهٔ قبل', delta: 'تغییر',
  direction: 'جهت', status: 'وضعیت', unit: 'واحد', count: 'تعداد', share: 'سهم',
  path: 'مسیر', title: 'عنوان', name: 'نام', message: 'پیام', severity: 'شدت',
  views: 'بازدید', sessions: 'نشست', users: 'کاربران', signups: 'ثبت‌نام',
  conversion: 'تبدیل', conversionRate: 'نرخ تبدیل', avgSeconds: 'میانگین ثانیه',
  p75: 'صدک ۷۵', samples: 'نمونه', average: 'میانگین', total: 'مجموع',
  critical: 'بحرانی', high: 'بالا', medium: 'متوسط', low: 'پایین',
  connected: 'وصل', enabled: 'فعال', threshold: 'آستانه', metric: 'سنجه',
  createdAt: 'تاریخ ایجاد', updatedAt: 'آخرین ویرایش', lastSeen: 'آخرین بازدید',
  firstSeen: 'اولین وقوع', lastSeenAt: 'آخرین وقوع', count_occurrences: 'تعداد وقوع',
  priority: 'اولویت', impact: 'اثر', cause: 'علت', action: 'اقدام پیشنهادی',
  confidence: 'اطمینان', category: 'دسته', statement: 'گزارش', evidence: 'شواهد',
  metricLabel: 'سنجه', currentValue: 'مقدار فعلی', trend: 'روند', description: 'توضیح',
  uses: 'استفاده', seconds: 'ثانیه', errors: 'خطا', errorRate: 'نرخ خطا',
  wordCount: 'تعداد کلمه', kind: 'نوع', slug: 'نشانی', categoryLabel: 'دسته',
  pages: 'صفحات', entries: 'ورود', exits: 'خروج', bounceRate: 'نرخ پرش',
};

const humanizeKey = (key) => SCALAR_LABELS[key] ?? toFa(String(key).replace(/[_-]/g, ' '));

/* یک جدول → متن CSV با BOM تا اکسل فارسی را درست بخواند */
function tableToCsv(table) {
  const keys = [...new Set(table.rows.flatMap((row) => Object.keys(row)))];
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [
    `# ${table.name}`,
    keys.map(humanizeKey).join(','),
    ...table.rows.map((row) => keys.map((key) => escape(row[key])).join(',')),
  ];
  return lines.join('\n');
}

export function downloadFile(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* خروجی CSV — چند جدول پشت‌سرهم با یک خط خالی */
export function exportCsv(sectionLabel, data, rangeLabel = '') {
  const tables = collectTables(data);
  if (!tables.length) return false;

  const header = `بخش: ${sectionLabel}${rangeLabel ? ` | بازه: ${rangeLabel}` : ''} | تاریخ: ${new Date().toISOString()}`;
  const body = tables.map(tableToCsv).join('\n\n');
  downloadFile(`tapesh-analytics-${sectionLabel}-${stamp()}.csv`, `\uFEFF${header}\n\n${body}`);
  return true;
}

/*
 * خروجی اکسل — قالب HTML با پسوند .xls. اکسل آن را بومی باز می‌کند، فارسی
 * درست نمایش داده می‌شود و هیچ کتابخانه‌ای لازم نیست.
 */
export function exportExcel(sectionLabel, data, rangeLabel = '') {
  const tables = collectTables(data);
  if (!tables.length) return false;

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const sheets = tables.map((table) => {
    const keys = [...new Set(table.rows.flatMap((row) => Object.keys(row)))];
    const head = keys.map((key) => `<th>${esc(humanizeKey(key))}</th>`).join('');
    const body = table.rows.map((row) => `<tr>${keys.map((key) => {
      const value = row[key];
      return `<td>${esc(typeof value === 'object' ? '' : value)}</td>`;
    }).join('')}</tr>`).join('');

    return `<h3>${esc(table.name)}</h3><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }).join('<br/>');

  const html = `<html dir="rtl"><head><meta charset="utf-8" />
    <style>body{font-family:Tahoma,sans-serif;direction:rtl}h1{font-size:15px}h3{font-size:13px;color:#555}
    table{border-collapse:collapse;font-size:12px}th,td{border:1px solid #999;padding:4px 8px;text-align:right}
    th{background:#eee}</style></head><body>
    <h1>تپش — ${esc(sectionLabel)}${rangeLabel ? ` — ${esc(rangeLabel)}` : ''}</h1>
    ${sheets}</body></html>`;

  downloadFile(`tapesh-analytics-${sectionLabel}-${stamp()}.xls`, html, 'application/vnd.ms-excel;charset=utf-8');
  return true;
}

/*
 * خروجی PDF — از موتور چاپ مرورگر استفاده می‌شود (بدون کتابخانه). پنجرهٔ چاپ
 * با همان جدول‌ها باز می‌شود و کاربر می‌تواند «ذخیره به‌عنوان PDF» بزند.
 */
export function exportPdf(sectionLabel, data, rangeLabel = '') {
  const tables = collectTables(data);
  if (!tables.length) return false;

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const blocks = tables.map((table) => {
    const keys = [...new Set(table.rows.flatMap((row) => Object.keys(row)))];
    const head = keys.map((key) => `<th>${esc(humanizeKey(key))}</th>`).join('');
    const body = table.rows.map((row) => `<tr>${keys.map((key) => {
      const value = row[key];
      return `<td>${esc(typeof value === 'object' ? '' : value)}</td>`;
    }).join('')}</tr>`).join('');
    return `<section><h2>${esc(table.name)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
  }).join('');

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return false;

  win.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8" />
    <title>تپش — ${esc(sectionLabel)}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      body { font-family: Tahoma, sans-serif; direction: rtl; color: #222; }
      h1 { font-size: 17px; border-bottom: 2px solid #937fcd; padding-bottom: 8px; }
      h2 { font-size: 13px; margin-top: 18px; color: #555; }
      .meta { color: #777; font-size: 11px; margin-bottom: 14px; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; margin-top: 6px; }
      th, td { border: 1px solid #bbb; padding: 4px 7px; text-align: right; }
      th { background: #f0eef7; }
      tr { page-break-inside: avoid; }
    </style></head><body>
    <h1>تپش — ${esc(sectionLabel)}</h1>
    <p class="meta">${rangeLabel ? `بازه: ${esc(rangeLabel)} — ` : ''}تاریخ گزارش: ${esc(new Date().toLocaleString('fa-IR'))}</p>
    ${blocks}
    </body></html>`);

  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 350);
  return true;
}

const stamp = () => new Date().toISOString().slice(0, 10);

/* ─────────────────────────── ریزسنج کمکی ─────────────────────────── */

/* یک عدد + برچسب، برای ردیف‌های خلاصه */
export function MiniStat({ label, value, tone = 'neutral', hint }) {
  return (
    <div className={`an-mini an-mini--${tone}`} title={hint}>
      <span className="an-mini__label">{label}</span>
      <strong className="an-mini__value">{value}</strong>
    </div>
  );
}

export function ScoreCard({ score, label, tone = 'good', caption }) {
  return (
    <div className="an-score">
      <Gauge value={score} label={label} tone={tone} />
      {caption ? <p className="an-score__caption">{caption}</p> : null}
    </div>
  );
}

export { Gauge, Sparkline, LineChart, BarChart, Donut, Heatmap, Funnel, HBarList, colorAt } from './analyticsCharts';
