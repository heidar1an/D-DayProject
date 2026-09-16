/*
 * بخش «نمای کلی» و «تحلیلگر هوشمند».
 *
 * نمای کلی باید در کمتر از ۳۰ ثانیه وضعیت تپش را بفهماند: یک جملهٔ خلاصه،
 * سنجه‌های کلیدی با تغییر، روند، و کارهایی که به توجه نیاز دارند.
 */

import { useMemo, useState } from 'react';

import {
  KpiCard, LineChart, MiniStat, NeedsConnection, Notice,
  Panel, SectionHero, SeverityBadge, StatusPill, DataTable, toFa, faNumber,
  formatPercent,
} from '../analyticsKit';

/* سنجه‌های کلیدی و نگاشتشان به سری روزانه — فقط جایی جرقه می‌کشیم که سری واقعی هست */
const OVERVIEW_GROUPS = [
  {
    title: 'رشد و ترافیک',
    keys: ['activeUsers', 'newUsers', 'pageViews', 'sessions', 'avgDuration', 'bounceRate'],
  },
  {
    title: 'قیف تبدیل و تعامل',
    keys: ['signups', 'visitorToSignup', 'dau', 'wau', 'mau'],
  },
  {
    title: 'درآمد',
    keys: ['revenue', 'purchases', 'averageOrderValue', 'purchaseConversion'],
    note: 'درگاه پرداخت وصل نیست؛ این سنجه‌ها تا اتصال درگاه خالی می‌مانند.',
  },
  {
    title: 'آموزش و محتوا',
    keys: ['publishedContent', 'tests', 'answered', 'flashcards'],
  },
];

const SPARK_FIELDS = {
  pageViews: 'pageViews',
  sessions: 'sessions',
  activeUsers: 'visitors',
  newUsers: 'newUsers',
  signups: 'signups',
  avgDuration: 'avgDurationSeconds',
  bounceRate: 'bounceRate',
  tests: 'tests',
};

/* سنجه‌هایی که «کمتر بهتر است» — رنگ تغییر برعکس می‌شود */
const INVERTED = new Set(['bounceRate', 'churn', 'failed', 'errors', 'apiP95']);

const TREND_OPTIONS = [
  { key: 'pageViews', label: 'بازدید صفحات' },
  { key: 'visitors', label: 'بازدیدکنندهٔ یکتا' },
  { key: 'sessions', label: 'نشست' },
  { key: 'signups', label: 'ثبت‌نام' },
  { key: 'tests', label: 'تست' },
  { key: 'errors', label: 'خطا' },
];

export function OverviewSection({ data, onDrill }) {
  const [trendKeys, setTrendKeys] = useState(['pageViews', 'visitors']);

  const kpiByKey = useMemo(
    () => Object.fromEntries((data.kpis ?? []).map((kpi) => [kpi.key, kpi])),
    [data.kpis],
  );

  const series = data.series ?? [];
  const labels = series.map((point) => point.label);

  const trendSeries = trendKeys
    .map((key, index) => ({
      key,
      label: TREND_OPTIONS.find((option) => option.key === key)?.label ?? key,
      values: series.map((point) => point[key] ?? null),
      color: ['#937fcd', '#61d192', '#5b8cc7', '#e0b45c', '#ef9196', '#ab8e7c'][index % 6],
    }))
    .filter((item) => item.values.some((value) => value !== null));

  const summary = data.summary ?? {};
  const issues = data.issues ?? [];
  const quality = data.dataQuality ?? {};

  const toggleTrend = (key) => setTrendKeys((current) => (
    current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
  ));

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="نمای کلی"
        title={summary.headline ?? 'وضعیت تپش'}
        description={`بازهٔ ${toFa(data.range?.days ?? 0)} روز — همهٔ اعداد از رویدادهای واقعی سایت و دادهٔ داخلی پروژه محاسبه شده‌اند.`}
        actions={<StatusPill status={summary.overall ?? 'neutral'} label={`وضعیت کلی: ${summary.overall === 'good' ? 'خوب' : summary.overall === 'warn' ? 'نیازمند توجه' : 'بحرانی'}`} />}
      />

      {/* ── خلاصهٔ مدیریتی ── */}
      <Panel title="خلاصهٔ مدیریتی" description="آنچه همین حالا باید بدانید" className="an-summary">
        <div className="an-summary__grid">
          <ul className="an-summary__lines">
            {(summary.lines ?? []).map((line, index) => (
              <li key={index} className={`is-${line.tone}`}>
                <span aria-hidden="true">{line.tone === 'good' ? '▲' : line.tone === 'bad' ? '▼' : '•'}</span>
                {line.text}
              </li>
            ))}
            {!(summary.lines ?? []).length ? <li className="is-muted">در این بازه تغییر معناداری ثبت نشده است.</li> : null}
          </ul>

          <div className="an-summary__counts">
            <MiniStat label="رشد" value={faNumber(summary.counts?.grown ?? 0)} tone="good" />
            <MiniStat label="کاهش" value={faNumber(summary.counts?.fallen ?? 0)} tone="warn" />
            <MiniStat label="بحرانی" value={faNumber(summary.counts?.critical ?? 0)} tone="critical" />
            <MiniStat label="نیازمند توجه" value={faNumber(summary.counts?.attention ?? 0)} tone="warn" />
          </div>
        </div>

        <div className="an-summary__metrics">
          <div>
            <span className="an-muted">رشد ارگانیک (نیازمند Search Console)</span>
            <strong>{summary.metrics?.organicGrowth === null ? '—' : formatPercent(summary.metrics?.organicGrowth)}</strong>
          </div>
          <div>
            <span className="an-muted">رشد درآمد (نیازمند درگاه پرداخت)</span>
            <strong>{summary.metrics?.revenueGrowth === null ? '—' : formatPercent(summary.metrics?.revenueGrowth)}</strong>
          </div>
          <div>
            <span className="an-muted">تعامل آموزشی</span>
            <strong>{formatPercent(summary.metrics?.testEngagement)}</strong>
          </div>
        </div>
      </Panel>

      {/* ── کارهایی که به توجه نیاز دارند ── */}
      {issues.length ? (
        <Panel
          title="نیازمند توجه"
          description="مسائلی که تحلیلگر از دادهٔ واقعی بیرون کشیده است"
          tone={issues.some((issue) => issue.severity === 'critical') ? 'critical' : 'warn'}
        >
          <ul className="an-issues">
            {issues.map((issue) => (
              <li key={issue.id} className={`an-issue an-issue--${issue.severity}`}>
                <div className="an-issue__head">
                  <SeverityBadge severity={issue.severity} />
                  <strong>{issue.title}</strong>
                </div>
                <p className="an-issue__evidence">{issue.evidence}</p>
                <dl className="an-issue__meta">
                  <div><dt>علت احتمالی</dt><dd>{issue.cause}</dd></div>
                  <div><dt>اثر</dt><dd>{issue.impact}</dd></div>
                  <div><dt>اقدام</dt><dd>{issue.action}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <Notice tone="good">در این بازه مسئلهٔ بحرانی‌ای پیدا نشد.</Notice>
      )}

      {/* ── سنجه‌های کلیدی ── */}
      {OVERVIEW_GROUPS.map((group) => {
        const kpis = group.keys.map((key) => kpiByKey[key]).filter(Boolean);
        if (!kpis.length) return null;

        return (
          <Panel key={group.title} title={group.title} description={group.note}>
            <div className="an-kpi-grid">
              {kpis.map((kpi) => (
                <KpiCard
                  key={kpi.key}
                  kpi={kpi}
                  invert={INVERTED.has(kpi.key)}
                  spark={SPARK_FIELDS[kpi.key] ? series.map((point) => point[SPARK_FIELDS[kpi.key]]) : null}
                  onDrill={onDrill ? () => onDrill(kpi.key) : null}
                />
              ))}
            </div>
          </Panel>
        );
      })}

      {/* ── روند ── */}
      <Panel
        title="روند روزانه"
        description="برای مقایسهٔ سنجه‌ها، هرکدام را روشن یا خاموش کنید"
        actions={(
          <div className="an-chips">
            {TREND_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`an-chip ${trendKeys.includes(option.key) ? 'is-on' : ''}`}
                onClick={() => toggleTrend(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      >
        <LineChart labels={labels} series={trendSeries} height={280} />
      </Panel>

      {/* ── کیفیت داده ── */}
      <Panel title="کیفیت داده" description="چرا ممکن است عددی کمتر از انتظار به‌نظر برسد">
        <div className="an-kpi-grid an-kpi-grid--tight">
          <MiniStat label="رویداد ثبت‌شده" value={faNumber(quality.events ?? 0)} hint="تلمتری مرورگر کاربران" />
          <MiniStat label="نشست" value={faNumber(quality.sessions ?? 0)} />
          <MiniStat label="کاربر سایت" value={faNumber(quality.users ?? 0)} hint="users.json" />
          <MiniStat label="رکورد گزارش رویداد" value={faNumber(quality.auditEntries ?? 0)} hint="activity.json" />
        </div>
        {quality.note ? <Notice tone="warn">{quality.note}</Notice> : null}
        <p className="an-muted">
          {quality.level === 'ok'
            ? 'حجم داده برای تحلیل معنادار کافی است.'
            : 'حجم داده کم است؛ نتیجه‌ها را با احتیاط تفسیر کنید.'}
          {quality.since ? ` قدیمی‌ترین رویداد: ${toFa(new Date(quality.since).toLocaleDateString('fa-IR'))}.` : ''}
        </p>
      </Panel>

      {/* ── وضعیت منابع داده ── */}
      <Panel title="منابع داده" description="شفافیت کامل: کدام منبع وصل است و کدام نه">
        <ul className="an-sources">
          {(data.sources ?? []).map((source) => (
            <li key={source.id} className={source.connected ? 'is-on' : 'is-off'}>
              <span className="an-sources__dot" aria-hidden="true" />
              <span className="an-sources__label">{source.label}</span>
              <span className="an-sources__detail">{source.detail}</span>
              <span className="an-sources__state">{source.connected ? 'وصل' : 'وصل نیست'}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

/* ─────────────────────────── تحلیلگر هوشمند ─────────────────────────── */

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

export function AiSection({ data }) {
  const findings = data.findings ?? [];
  const counts = data.counts ?? {};
  const engine = data.engine ?? {};
  const trends = data.trends ?? [];
  const anomalies = data.anomalies ?? [];

  const [filter, setFilter] = useState('all');

  const visible = useMemo(
    () => (filter === 'all' ? findings : findings.filter((finding) => finding.priority === filter)),
    [findings, filter],
  );

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="تحلیلگر هوشمند"
        title="چه اتفاقی افتاده، چرا، و چه باید کرد"
        description="این تحلیل روی دادهٔ واقعی سایت انجام می‌شود: تشخیص ناهنجاری با امتیاز Z، تشخیص روند با رگرسیون خطی، ریشه‌یابی از تفاضل منابع، و پیش‌بینی با فاصلهٔ اطمینان."
      />

      <Panel title="موتور تحلیل" description={engine.note}>
        <div className="an-kpi-grid an-kpi-grid--tight">
          {PRIORITY_ORDER.map((priority) => (
            <MiniStat
              key={priority}
              label={priority === 'critical' ? 'بحرانی' : priority === 'high' ? 'بالا' : priority === 'medium' ? 'متوسط' : 'پایین'}
              value={faNumber(counts[priority] ?? 0)}
              tone={priority === 'critical' ? 'critical' : priority === 'high' ? 'warn' : 'neutral'}
            />
          ))}
        </div>
        <p className="an-muted">
          نوع موتور: <code>{engine.kind ?? '—'}</code>
        </p>
        {engine.llm && !engine.llm.connected ? (
          <NeedsConnection
            compact
            title="روایت متنی با مدل زبانی وصل نیست"
            requires={engine.llm.requires}
            note={engine.llm.note}
          />
        ) : null}
      </Panel>

      <Panel
        title="یافته‌ها و اقدام‌های پیشنهادی"
        description="به ترتیب اولویت — هر یافته با شواهد عددی"
        actions={(
          <div className="an-chips">
            {['all', ...PRIORITY_ORDER].map((priority) => (
              <button
                key={priority}
                type="button"
                className={`an-chip ${filter === priority ? 'is-on' : ''}`}
                onClick={() => setFilter(priority)}
              >
                {priority === 'all' ? 'همه' : priority === 'critical' ? 'بحرانی' : priority === 'high' ? 'بالا' : priority === 'medium' ? 'متوسط' : 'پایین'}
                {priority !== 'all' ? ` (${toFa(counts[priority] ?? 0)})` : ''}
              </button>
            ))}
          </div>
        )}
      >
        {visible.length ? (
          <ul className="an-findings">
            {visible.map((finding) => (
              <li key={finding.id} className={`an-finding an-finding--${finding.priority}`}>
                <div className="an-finding__head">
                  <SeverityBadge severity={finding.priority} />
                  <strong>{finding.title}</strong>
                  <span className="an-finding__confidence">اطمینان: {finding.confidence}</span>
                </div>

                <p className="an-finding__statement">{finding.statement}</p>

                {finding.evidence?.length ? (
                  <ul className="an-finding__evidence">
                    {finding.evidence.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                ) : null}

                <dl className="an-finding__meta">
                  {finding.cause ? <div><dt>چرا</dt><dd>{finding.cause}</dd></div> : null}
                  {finding.impact ? <div><dt>اثر</dt><dd>{finding.impact}</dd></div> : null}
                  {finding.action ? <div><dt>اقدام</dt><dd>{finding.action}</dd></div> : null}
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="an-muted">در این سطح اولویت یافته‌ای وجود ندارد.</p>
        )}
      </Panel>

      <div className="an-split">
        <Panel title="روند سنجه‌ها" description="شیب خط رگرسیون و قدرت برازش (R²)">
          <DataTable
            rows={trends}
            initialSort={{ key: 'total', dir: 'desc' }}
            columns={[
              { key: 'label', label: 'سنجه' },
              { key: 'total', label: 'مجموع', align: 'end' },
              {
                key: 'direction',
                label: 'جهت',
                render: (row) => (
                  <span className={`an-trend an-trend--${row.direction}`}>
                    {row.direction === 'up' ? '▲ صعودی' : row.direction === 'down' ? '▼ نزولی' : '→ ثابت'}
                  </span>
                ),
              },
              {
                key: 'strength',
                label: 'قدرت',
                render: (row) => ({
                  strong: 'قوی', moderate: 'متوسط', weak: 'ضعیف',
                }[row.strength] ?? row.strength),
              },
              { key: 'r2', label: 'R²', align: 'end', render: (row) => toFa(Number(row.r2 ?? 0).toFixed(2)) },
            ]}
          />
        </Panel>

        <Panel title="ناهنجاری‌ها" description="روزهایی که از الگوی عادی فاصلهٔ معنادار داشتند">
          {anomalies.length ? (
            <DataTable
              rows={anomalies}
              sortable={false}
              columns={[
                { key: 'key', label: 'روز' },
                { key: 'value', label: 'مقدار', align: 'end' },
                { key: 'z', label: 'امتیاز Z', align: 'end', render: (row) => toFa(Number(row.z ?? 0).toFixed(2)) },
                {
                  key: 'direction',
                  label: 'نوع',
                  render: (row) => (
                    <span className={`an-trend an-trend--${row.direction === 'spike' ? 'up' : 'down'}`}>
                      {row.direction === 'spike' ? 'جهش' : 'افت'}
                    </span>
                  ),
                },
              ]}
            />
          ) : (
            <p className="an-muted">الگوی روزانه در این بازه پایدار بوده است.</p>
          )}
        </Panel>
      </div>

      {data.rootCause ? (
        <Panel
          title="ریشه‌یابی افت ترافیک"
          description={`بازدید نیمهٔ دوم بازه ${toFa(Math.abs(Number(data.rootCause.trafficChange ?? 0)).toFixed(1))}٪ کمتر از نیمهٔ اول است.`}
          tone="warn"
        >
          {data.rootCause.causes?.length ? (
            <ul className="an-plain an-plain--tight">
              {data.rootCause.causes.map((cause, index) => <li key={index}>{cause}</li>)}
            </ul>
          ) : (
            <p className="an-muted">علت با دادهٔ موجود قطعی نشد.</p>
          )}

          <div className="an-split">
            <div>
              <h4 className="an-subhead">منابع ضعیف‌شده</h4>
              <DataTable
                rows={data.rootCause.sources ?? []}
                sortable={false}
                columns={[
                  { key: 'label', label: 'منبع' },
                  { key: 'before', label: 'نیمهٔ اول', align: 'end' },
                  { key: 'after', label: 'نیمهٔ دوم', align: 'end' },
                  {
                    key: 'delta',
                    label: 'تغییر',
                    align: 'end',
                    render: (row) => (
                      <span className="an-trend an-trend--down">{toFa(Number(row.delta ?? 0).toFixed(1))}٪</span>
                    ),
                  },
                ]}
                emptyLabel="منبعی با افت معنادار پیدا نشد"
              />
            </div>

            <div>
              <h4 className="an-subhead">صفحه و خطاها</h4>
              <ul className="an-kv">
                {data.rootCause.page ? (
                  <>
                    <li><span>ضعیف‌ترین صفحه</span><strong className="an-path">{data.rootCause.page.path}</strong></li>
                    <li><span>بازدید نیمهٔ اول → دوم</span><strong>{faNumber(data.rootCause.page.before)} → {faNumber(data.rootCause.page.after)}</strong></li>
                  </>
                ) : null}
                <li>
                  <span>خطاها (نیمهٔ اول → دوم)</span>
                  <strong>{faNumber(data.rootCause.errors?.early ?? 0)} → {faNumber(data.rootCause.errors?.late ?? 0)}</strong>
                </li>
                <li>
                  <span>تغییر کل ترافیک</span>
                  <strong className="an-bad">{toFa(Number(data.rootCause.trafficChange ?? 0).toFixed(1))}٪</strong>
                </li>
              </ul>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
