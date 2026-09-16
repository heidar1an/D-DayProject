/*
 * بخش‌های «ترافیک»، «کاربران» و «بازاریابی».
 *
 * این سه بخش به یک پرسش پاسخ می‌دهند: چه کسی می‌آید، از کجا، چه می‌کند و
 * چقدر می‌ماند. هر عدد از تلمتری مرورگر یا دادهٔ داخلی پروژه می‌آید.
 */

import { useMemo, useState } from 'react';

import {
  DataTable, Donut, Funnel, HBarList, Heatmap, KpiCard, LineChart,
  MiniStat, NeedsConnection, Notice, Panel, SectionHero, formatDuration,
  formatPercent, faNumber, toFa,
} from '../analyticsKit';

const SPARK_FIELDS = {
  pageViews: 'pageViews',
  visitors: 'visitors',
  sessions: 'sessions',
  newUsers: 'newUsers',
  returningUsers: 'returning',
  avgDuration: 'avgDurationSeconds',
  bounceRate: 'bounceRate',
  tests: 'tests',
  newUsersInRange: 'newUsers',
  activeUsers: 'visitors',
  returning: 'returning',
};

const INVERTED = new Set(['bounceRate', 'churn', 'exitRate']);

const TREND_OPTIONS = [
  { key: 'pageViews', label: 'بازدید' },
  { key: 'visitors', label: 'بازدیدکننده' },
  { key: 'sessions', label: 'نشست' },
  { key: 'bounceRate', label: 'نرخ پرش' },
];

/* جدول مشترک صفحات — همان ستون‌ها در همهٔ فهرست‌های ترافیک */
const pageColumns = ({ showConversions = true } = {}) => [
  {
    key: 'path',
    label: 'مسیر',
    render: (row) => <span className="an-path" title={row.path}>{row.path}</span>,
  },
  { key: 'views', label: 'بازدید', align: 'end' },
  { key: 'sessions', label: 'نشست', align: 'end' },
  {
    key: 'avgSeconds',
    label: 'میانگین زمان',
    align: 'end',
    render: (row) => formatDuration(row.avgSeconds),
  },
  ...(showConversions ? [
    {
      key: 'conversionRate',
      label: 'نرخ تبدیل',
      align: 'end',
      render: (row) => formatPercent(row.conversionRate),
    },
  ] : []),
];

/* ─────────────────────────── ترافیک ─────────────────────────── */

export function TrafficSection({ data }) {
  const series = data.series ?? [];
  const labels = series.map((point) => point.label);
  const [trendKeys, setTrendKeys] = useState(['pageViews', 'visitors']);

  const trendSeries = trendKeys.map((key, index) => ({
    key,
    label: TREND_OPTIONS.find((option) => option.key === key)?.label ?? key,
    values: series.map((point) => point[key] ?? null),
    color: ['#937fcd', '#61d192', '#5b8cc7', '#e0b45c'][index % 4],
  }));

  const devices = data.devices ?? [];
  const sources = data.sources ?? [];
  const pages = data.pages ?? {};

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="ترافیک"
        title="از کجا می‌آیند و کجا می‌روند"
        description="بازدید، منابع ورود، دستگاه‌ها و رفتار صفحات — همه از رویدادهای واقعی مرورگر."
      />

      <div className="an-kpi-grid">
        {(data.kpis ?? []).map((kpi) => (
          <KpiCard
            key={kpi.key}
            kpi={kpi}
            invert={INVERTED.has(kpi.key)}
            spark={SPARK_FIELDS[kpi.key] ? series.map((point) => point[SPARK_FIELDS[kpi.key]]) : null}
          />
        ))}
      </div>

      <Panel
        title="روند ترافیک"
        actions={(
          <div className="an-chips">
            {TREND_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`an-chip ${trendKeys.includes(option.key) ? 'is-on' : ''}`}
                onClick={() => setTrendKeys((current) => (
                  current.includes(option.key) ? current.filter((item) => item !== option.key) : [...current, option.key]
                ))}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      >
        <LineChart labels={labels} series={trendSeries} height={270} />
      </Panel>

      <div className="an-split an-split--thirds">
        <Panel title="منابع ورود" description="بر پایهٔ Referrer و UTM">
          <Donut
            slices={sources.map((source) => ({ key: source.key, label: source.label, value: source.count }))}
            centerLabel="نشست"
          />
        </Panel>

        <Panel title="دستگاه" description="از User-Agent واقعی">
          <Donut
            slices={devices.map((device) => ({ key: device.key, label: device.label ?? device.key, value: device.count }))}
            centerLabel="بازدیدکننده"
          />
        </Panel>

        <Panel title="مرورگر و سیستم‌عامل">
          <HBarList
            rows={[...(data.browsers ?? []), ...(data.systems ?? [])].map((item) => ({
              key: item.key, label: item.key, value: item.count,
            }))}
            maxRows={8}
          />
        </Panel>
      </div>

      <Panel title="پربازدیدترین صفحات" description="با نرخ تبدیل هر صفحه">
        <DataTable rows={pages.top ?? []} columns={pageColumns()} initialSort={{ key: 'views', dir: 'desc' }} />
      </Panel>

      <div className="an-split">
        <Panel title="صفحات ورود (Landing)" description="اولین صفحهٔ نشست">
          <DataTable rows={pages.landing ?? []} columns={pageColumns({ showConversions: false })} initialSort={{ key: 'views', dir: 'desc' }} />
        </Panel>
        <Panel title="صفحات خروج (Exit)" description="جایی که کاربران می‌روند">
          <DataTable rows={pages.topExit ?? []} columns={pageColumns({ showConversions: false })} initialSort={{ key: 'exits', dir: 'desc' }} />
        </Panel>
      </div>

      <div className="an-split">
        <Panel title="بهترین نرخ تبدیل" description="کمترین بازدید، بیشترین تبدیل">
          <DataTable rows={pages.topConversion ?? []} columns={pageColumns()} initialSort={{ key: 'conversionRate', dir: 'desc' }} />
        </Panel>
        <Panel title="ضعیف‌ترین صفحات" description="بازدید بدون تعامل">
          <DataTable rows={pages.low ?? []} columns={pageColumns()} initialSort={{ key: 'views', dir: 'asc' }} />
        </Panel>
      </div>

      {(pages.declining ?? []).length ? (
        <Panel title="صفحات در افت" description="کاهش معنادار بازدید نسبت به بازهٔ قبل" tone="warn">
          <DataTable
            rows={pages.declining}
            sortable={false}
            columns={[
              { key: 'path', label: 'مسیر', render: (row) => <span className="an-path">{row.path}</span> },
              { key: 'before', label: 'بازهٔ قبل', align: 'end' },
              { key: 'after', label: 'بازهٔ جاری', align: 'end' },
              {
                key: 'delta',
                label: 'تغییر',
                align: 'end',
                render: (row) => <span className="an-trend an-trend--down">{toFa(Number(row.delta ?? 0).toFixed(1))}٪</span>,
              },
            ]}
          />
        </Panel>
      ) : null}

      <Panel title="موقعیت جغرافیایی">
        {data.geo?.connected ? (
          <DataTable rows={data.geo.countries ?? []} columns={[{ key: 'key', label: 'کشور' }, { key: 'count', label: 'تعداد', align: 'end' }]} />
        ) : (
          <NeedsConnection
            title="تحلیل جغرافیایی در دسترس نیست"
            requires={data.geo?.requires}
            note={data.geo?.note}
          />
        )}
      </Panel>
    </div>
  );
}

/* ─────────────────────────── کاربران ─────────────────────────── */

export function UsersSection({ data }) {
  const series = data.series ?? [];
  const cohorts = data.cohorts ?? [];
  const weeks = data.cohortWeeks ?? 0;
  const heatmap = data.heatmap ?? {};
  const demographics = data.demographics ?? {};

  const entryRows = useMemo(
    () => (data.entryPages ?? []).map((row) => ({ ...row, key: row.path })),
    [data.entryPages],
  );

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="کاربران"
        title="چه کسی می‌ماند و چه کسی می‌رود"
        description="رشد، ماندگاری، قیف ثبت‌نام و مشخصات جمعیتی دانشجویان — دادهٔ شخصی پوشانده شده است."
      />

      <div className="an-kpi-grid">
        {(data.kpis ?? []).map((kpi) => (
          <KpiCard
            key={kpi.key}
            kpi={kpi}
            invert={INVERTED.has(kpi.key)}
            spark={SPARK_FIELDS[kpi.key] ? series.map((point) => point[SPARK_FIELDS[kpi.key]]) : null}
          />
        ))}
      </div>

      <Panel title="قیف تبدیل" description="از بازدید تا تکمیل پروفایل — ریزش هر مرحله مشخص است">
        <Funnel steps={data.funnel ?? []} />
      </Panel>

      <div className="an-split">
        <Panel title="ماندگاری گروهی (Cohort)" description={`گروه‌های ثبت‌نام، تا ${toFa(weeks)} هفته`}>
          {cohorts.length ? (
            <div className="an-tablewrap">
              <table className="an-table an-table--cohort">
                <thead>
                  <tr>
                    <th>گروه</th>
                    <th className="is-end">اندازه</th>
                    {Array.from({ length: weeks }).map((_, week) => (
                      <th key={week} className="is-end">ه{toFa(week + 1)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort) => (
                    <tr key={cohort.key}>
                      <td>{toFa(cohort.label)}</td>
                      <td className="is-end">{faNumber(cohort.size)}</td>
                      {Array.from({ length: weeks }).map((_, week) => {
                        const value = cohort.retention?.[week];
                        const intensity = Number.isFinite(value) ? Math.min(1, value / 100) : 0;
                        return (
                          <td
                            key={week}
                            className="is-end an-cohort-cell"
                            style={Number.isFinite(value) ? { background: `rgba(147,127,205,${0.1 + intensity * 0.6})` } : undefined}
                          >
                            {Number.isFinite(value) ? `${toFa(Number(value).toFixed(0))}٪` : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="an-muted">برای ساخت گروه‌های ماندگاری، به ثبت‌نام در چند هفتهٔ متوالی نیاز است.</p>
          )}
        </Panel>

        <Panel title="الگوی فعالیت" description="روز و ساعت واقعی استفاده">
          <Heatmap cells={heatmap.cells ?? []} weekdays={heatmap.weekdays ?? []} max={heatmap.max ?? 0} />
        </Panel>
      </div>

      <div className="an-split an-split--thirds">
        <Panel title="دانشگاه‌ها">
          <HBarList
            rows={(demographics.universities ?? []).map((item) => ({ key: item.key, label: item.key, value: item.count }))}
            emptyLabel="دانشگاهی در پروفایل‌ها ثبت نشده"
          />
        </Panel>
        <Panel title="ترم تحصیلی">
          <HBarList
            rows={(demographics.terms ?? []).map((item) => ({ key: item.key, label: `ترم ${item.key}`, value: item.count }))}
            emptyLabel="ترمی ثبت نشده"
          />
        </Panel>
        <Panel title="انگیزهٔ انتخاب تپش">
          <HBarList
            rows={(demographics.motivations ?? []).map((item) => ({ key: item.key, label: item.key, value: item.count }))}
            emptyLabel="انگیزه‌ای ثبت نشده"
          />
        </Panel>
      </div>

      <Panel title="صفحات ورود و خروج">
        <div className="an-kpi-grid an-kpi-grid--tight">
          <MiniStat label="تکمیل پروفایل" value={formatPercent(demographics.profileCompletion)} />
          <MiniStat label="کل کاربران سایت" value={faNumber((data.userList ?? []).length)} hint="users.json" />
        </div>
        <div className="an-split">
          <HBarList
            rows={entryRows.map((row) => ({ key: row.key, label: row.path, value: row.count }))}
            emptyLabel="صفحهٔ ورودی ثبت نشده"
          />
          <HBarList
            rows={(data.exitPages ?? []).map((row) => ({ key: row.path, label: row.path, value: row.count }))}
            emptyLabel="صفحهٔ خروجی ثبت نشده"
          />
        </div>
      </Panel>

      <Panel
        title="کاربران"
        description={data.privacy}
        tone="warn"
      >
        <DataTable
          rows={data.userList ?? []}
          initialSort={{ key: 'createdAt', dir: 'desc' }}
          columns={[
            { key: 'displayName', label: 'کاربر', render: (row) => <span className="an-path">{row.displayName || '—'}</span> },
            { key: 'university', label: 'دانشگاه' },
            { key: 'term', label: 'ترم' },
            {
              key: 'profileComplete',
              label: 'پروفایل',
              render: (row) => (row.profileComplete ? 'کامل' : 'ناقص'),
            },
            {
              key: 'hasAvatar',
              label: 'تصویر',
              render: (row) => (row.hasAvatar ? 'دارد' : '—'),
            },
            {
              key: 'createdAt',
              label: 'تاریخ عضویت',
              render: (row) => toFa(new Date(row.createdAt).toLocaleDateString('fa-IR')),
            },
            {
              key: 'lastSeen',
              label: 'آخرین بازدید',
              render: (row) => (row.lastSeen ? toFa(new Date(row.lastSeen).toLocaleDateString('fa-IR')) : '—'),
            },
          ]}
        />
        <Notice tone="warn">
          شمارهٔ تماس و ایمیل هرگز به‌صورت کامل نمایش داده نمی‌شود. برای دیدن دادهٔ کامل، مجوز
          {' '}<code>analytics.users.read</code> کافی نیست و باید از بخش «کاربران و نقش‌ها» اقدام کنید.
        </Notice>
      </Panel>
    </div>
  );
}

/* ─────────────────────────── بازاریابی ─────────────────────────── */

export function MarketingSection({ data }) {
  const campaigns = data.campaigns ?? {};
  const channels = data.channels ?? [];
  const questions = data.questions ?? {};
  const totals = data.totals ?? {};

  const channelRows = channels.map((channel) => ({
    key: channel.key,
    label: channel.label,
    sessions: channel.sessions,
    signups: channel.signups,
    purchases: channel.purchases,
    conversion: channel.conversion,
    share: channel.share,
  }));

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="بازاریابی"
        title="کدام کانال واقعاً کاربر می‌آورد"
        description="کانال‌ها از Referrer و پارامترهای UTM واقعی ساخته می‌شوند؛ هزینهٔ تبلیغات نیازمند اتصال درگاه پرداخت است."
      />

      <Panel title="جمع کل" description="در بازهٔ انتخابی">
        <div className="an-kpi-grid an-kpi-grid--tight">
          <MiniStat label="نشست" value={faNumber(totals.sessions ?? 0)} />
          <MiniStat label="ثبت‌نام" value={faNumber(totals.signups ?? 0)} />
          <MiniStat label="خرید" value={totals.purchases === null || totals.purchases === undefined ? '—' : faNumber(totals.purchases)} />
          <MiniStat label="نشست ردیابی‌شده" value={faNumber(totals.trackedSessions ?? 0)} hint="دارای Referrer یا UTM" />
        </div>
      </Panel>

      <Panel title="کانال‌های جذب" description="مرتب‌شده بر پایهٔ نشست">
        <DataTable
          rows={channelRows}
          initialSort={{ key: 'sessions', dir: 'desc' }}
          columns={[
            { key: 'label', label: 'کانال' },
            { key: 'sessions', label: 'نشست', align: 'end' },
            { key: 'share', label: 'سهم', align: 'end', render: (row) => formatPercent(row.share) },
            { key: 'signups', label: 'ثبت‌نام', align: 'end' },
            { key: 'conversion', label: 'نرخ تبدیل', align: 'end', render: (row) => formatPercent(row.conversion) },
          ]}
        />
      </Panel>

      <Panel title="کمپین‌ها" description={campaigns.note}>
        {campaigns.utmTracked ? (
          <DataTable
            rows={campaigns.rows ?? []}
            initialSort={{ key: 'sessions', dir: 'desc' }}
            columns={[
              { key: 'campaign', label: 'کمپین' },
              { key: 'sourceLabel', label: 'منبع' },
              { key: 'medium', label: 'واسطه' },
              { key: 'sessions', label: 'نشست', align: 'end' },
              { key: 'signups', label: 'ثبت‌نام', align: 'end' },
              { key: 'conversion', label: 'نرخ تبدیل', align: 'end', render: (row) => formatPercent(row.conversion) },
            ]}
          />
        ) : (
          <Notice tone="info">
            هنوز بازدیدی با پارامتر UTM ثبت نشده است. برای دیدن عملکرد کمپین‌ها، لینک‌های تبلیغاتی را با
            {' '}<code>?utm_source=…&utm_medium=…&utm_campaign=…</code> منتشر کنید.
          </Notice>
        )}
      </Panel>

      <div className="an-split">
        <Panel title="پرکارترین کانال" description="بیشترین نشست">
          {questions.mostUsers ? (
            <div className="an-kpi-grid an-kpi-grid--tight">
              <MiniStat label={questions.mostUsers.label} value={`${faNumber(questions.mostUsers.sessions)} نشست`} />
              <MiniStat label="نرخ تبدیل" value={formatPercent(questions.mostUsers.conversion)} tone="good" />
            </div>
          ) : <p className="an-muted">داده‌ای نیست</p>}
        </Panel>

        <Panel title="منابع معرفی اعلام‌شده" description="آنچه کاربران خودشان گفته‌اند">
          <HBarList
            rows={(data.declaredSources ?? []).map((item) => ({ key: item.key, label: item.key, value: item.count }))}
            emptyLabel="منبعی اعلام نشده"
          />
        </Panel>
      </div>

      <Panel title="هزینهٔ تبلیغات و CAC / ROAS">
        {data.ads?.connected ? (
          <p className="an-muted">دادهٔ هزینه در دسترس است.</p>
        ) : (
          <NeedsConnection
            title="محاسبهٔ هزینهٔ جذب مشتری ممکن نیست"
            requires={data.ads?.requires}
            note={data.ads?.note}
            items={[
              'CAC (هزینهٔ جذب هر مشتری) = کل هزینهٔ کمپین ÷ تعداد خرید',
              'ROAS (بازگشت هزینهٔ تبلیغ) = درآمد کمپین ÷ هزینهٔ کمپین',
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
