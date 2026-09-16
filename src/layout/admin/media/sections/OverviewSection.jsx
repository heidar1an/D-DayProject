/*
 * نمای کلی مرکز رسانه.
 *
 * این صفحه پاسخ یک سؤال است: «الان وضعیت رسانهٔ تپش چطور است؟» پس فقط سنجه‌هایی
 * می‌آید که از دادهٔ واقعی محاسبه می‌شوند. اگر اکانتی به API وصل نباشد، سنجهٔ
 * آن با «—» و توضیح علت نشان داده می‌شود؛ هیچ عدد تخمینی ساخته نمی‌شود.
 */

import { useMemo } from 'react';

import { mediaCenter } from '../../../../services/admin/adminService';
import { IconClock, IconPulse, IconWarning } from '../../adminIcons';
import {
  AreaChart, BarList, Delta, Donut, Empty, ErrorBlock, Funnel, Kpi, Panel, Pill,
  SectionTitle, SkeletonCards, clockTime, fmt, labelOf, pct, relativeTime, toFa, useLoader,
} from '../mediaKit';

/* رنگ ثابت هر پلتفرم — از خود کاتالوگ سرور می‌آید */
const ACCENT = {
  instagram: '#c98bd0',
  telegram: '#5b8cc7',
  bale: '#61d192',
  eitaa: '#e0b45c',
  youtube: '#e26d6d',
  aparat: '#ab8e7c',
  linkedin: '#5b8cc7',
  x: '#9a9a9a',
  rubika: '#937fcd',
  whatsapp: '#61d192',
  pinterest: '#e26d6d',
  website: '#8a8a8a',
  podcast: '#937fcd',
  newsletter: '#e0b45c',
};

const accentOf = (platform) => ACCENT[platform] ?? '#937fcd';

export default function OverviewSection({ config, range, openTab }) {
  const params = { range: range.range, from: range.from, to: range.to };
  const { data, loading, error, reload } = useLoader(
    () => mediaCenter.overview(params),
    [range.range, range.from, range.to],
  );

  const labels = useMemo(
    () => (data?.series?.daily ?? []).map((row) => row.date.slice(5)),
    [data],
  );

  const reachSeries = useMemo(
    () => [
      { key: 'reach', label: 'Reach', color: 'var(--purple-ink)', values: (data?.series?.daily ?? []).map((row) => row.reach ?? 0) },
    ],
    [data],
  );

  const engagementSeries = useMemo(
    () => [
      { key: 'engagement', label: 'Engagement', color: 'var(--green-ink)', values: (data?.series?.daily ?? []).map((row) => row.engagement ?? 0) },
    ],
    [data],
  );

  const publishSeries = useMemo(
    () => [
      { key: 'published', label: 'منتشرشده', color: 'var(--purple-ink)', values: (data?.series?.contentTimeline ?? []).map((row) => row.published ?? 0) },
    ],
    [data],
  );

  if (error && !data) return <ErrorBlock error={error} onRetry={reload} />;
  if (loading && !data) return <SkeletonCards count={8} />;
  if (!data) return null;

  const platformRows = (data.platforms ?? []).map((row) => ({
    key: row.platform,
    label: labelOf(config.platforms, row.platform),
    value: row.reach,
    display: row.hasReach ? fmt(row.reach, { compact: true }) : '—',
    color: accentOf(row.platform),
  }));

  const typeRows = (data.contentTypes ?? []).map((row) => ({
    key: row.contentType,
    label: labelOf(config.contentTypes, row.contentType),
    value: row.reach,
    display: `${fmt(row.reach, { compact: true })} · ${pct(row.engagementRate)} تعامل`,
  }));

  const tagRows = (data.tags ?? []).filter((row) => row.publishedCount > 0).slice(0, 8);

  const followersByPlatform = (data.platforms ?? [])
    .filter((row) => row.hasFollowers && row.followers > 0)
    .map((row) => ({
      key: row.platform,
      label: labelOf(config.platforms, row.platform),
      value: row.followers,
      color: accentOf(row.platform),
    }));

  const accountCount = data.kpis.find((row) => row.key === 'accounts')?.value ?? null;
  const activePlatforms = data.kpis.find((row) => row.key === 'platforms')?.value ?? null;
  const totalPlatforms = (config.platforms ?? []).length;

  return (
    <>
      {/* ─── سنجه‌های کلیدی ─── */}
      <SectionTitle
        title="سنجه‌های کلیدی"
        hint={`${data.range.label} — مقایسه با بازهٔ پیش از آن`}
      />

      <div className="mc-kpis">
        <Kpi
          label="دنبال‌کننده"
          value={data.kpis.find((row) => row.key === 'followers')?.value}
          delta={data.growth.followers}
          hint={data.growth.followersBefore !== null
            ? `بازهٔ قبل: ${fmt(data.growth.followersBefore)}`
            : 'مبنای مقایسه موجود نیست'}
          spark={(data.series.daily ?? []).map((row) => row.followers ?? 0)}
        />
        <Kpi
          label="Reach"
          value={data.kpis.find((row) => row.key === 'reach')?.value}
          delta={data.growth.reach}
          spark={(data.series.daily ?? []).map((row) => row.reach ?? 0)}
        />
        <Kpi
          label="Engagement"
          value={data.kpis.find((row) => row.key === 'engagement')?.value}
          delta={data.growth.engagement}
          spark={(data.series.daily ?? []).map((row) => row.engagement ?? 0)}
        />
        <Kpi
          label="بازدید"
          value={data.kpis.find((row) => row.key === 'views')?.value}
          delta={data.growth.views}
          spark={(data.series.daily ?? []).map((row) => row.views ?? 0)}
        />
        <Kpi
          label="نرخ تعامل"
          value={data.kpis.find((row) => row.key === 'engagementRate')?.value}
          format="percent"
          hint="تعامل ÷ Reach"
        />
        <Kpi
          label="پلتفرم فعال"
          value={activePlatforms}
          hint={`از ${toFa(totalPlatforms)} پلتفرم ثبت‌شده`}
          onClick={() => openTab('platforms')}
        />
        <Kpi
          label="کانال و صفحهٔ فعال"
          value={accountCount}
          hint="اکانت‌های رسانه"
          onClick={() => openTab('accounts')}
        />
        <Kpi
          label="منتشرشدهٔ امروز"
          value={data.contentStats.publishedToday}
          hint={`${toFa(data.contentStats.published)} در بازه`}
          onClick={() => openTab('content')}
        />
        <Kpi
          label="در انتظار تأیید"
          value={data.contentStats.pending}
          hint="گردش کار تأیید"
          onClick={() => openTab('content')}
        />
        <Kpi
          label="زمان‌بندی‌شده"
          value={data.contentStats.scheduled}
          hint="در صف انتشار"
          onClick={() => openTab('queue')}
        />
        <Kpi
          label="انتشار ناموفق"
          value={data.contentStats.failed}
          hint={data.contentStats.failed ? 'نیازمند تلاش دوباره' : 'موردی نیست'}
          onClick={() => openTab('queue')}
        />
        <Kpi
          label="ورودی سایت از شبکه‌ها"
          value={data.kpis.find((row) => row.key === 'socialVisits')?.value}
          hint="از لینک‌های UTM و سنجهٔ اکانت‌ها"
        />
        <Kpi
          label="ثبت‌نام از شبکه‌ها"
          value={data.kpis.find((row) => row.key === 'socialSignups')?.value}
        />
        <Kpi
          label="نرخ تبدیل رسانه به سایت"
          value={data.kpis.find((row) => row.key === 'conversionRate')?.value}
          format="percent"
          hint="ورود به سایت ÷ کلیک"
        />
      </div>

      {/* ─── روند ─── */}
      <div className="mc-grid mc-grid--2">
        <Panel
          title="روند Reach و Engagement"
          description={`روزانه، ${data.range.label}`}
          actions={(
            <span className="mc-legend">
              <span><i style={{ background: 'var(--purple-bright)' }} />Reach</span>
              <span><i style={{ background: 'var(--green-vivid)' }} />Engagement</span>
            </span>
          )}
        >
          <AreaChart labels={labels} series={reachSeries} height={150} />
          <div style={{ marginTop: '0.6rem' }}>
            <AreaChart labels={labels} series={engagementSeries} height={110} showLabels={false} />
          </div>
        </Panel>

        <Panel title="انتشار در بازه" description="تعداد محتوای منتشرشده در هر روز">
          <AreaChart labels={labels} series={publishSeries} height={160} />
        </Panel>
      </div>

      {/* ─── مقایسهٔ پلتفرم‌ها ─── */}
      <div className="mc-grid mc-grid--2">
        <Panel
          title="مقایسهٔ پلتفرم‌ها"
          description="بر اساس Reach — بزرگ‌ترین و کم‌تعامل‌ترین پلتفرم مشخص می‌شود"
          actions={data.platformComparison.reachLeader ? (
            <Pill tone="accent">
              بیشترین Reach: {labelOf(config.platforms, data.platformComparison.reachLeader.platform)}
            </Pill>
          ) : null}
        >
          <BarList rows={platformRows} />
          <div className="mc-legend" style={{ marginTop: '0.7rem' }}>
            {data.platformComparison.engagementLeader ? (
              <span>بیشترین تعامل: <strong>{labelOf(config.platforms, data.platformComparison.engagementLeader.platform)}</strong></span>
            ) : null}
            {data.accountsWithoutMetrics ? (
              <span className="mc-muted">{toFa(data.accountsWithoutMetrics)} اکانت سنجه‌ای ثبت نکرده است.</span>
            ) : null}
          </div>
        </Panel>

        <Panel title="سهم دنبال‌کنندگان" description="کدام پلتفرم مخاطب را نگه داشته است">
          <Donut rows={followersByPlatform} caption="دنبال‌کننده" />
        </Panel>
      </div>

      {/* ─── بهترین و ضعیف‌ترین محتوا ─── */}
      <div className="mc-grid mc-grid--2">
        <Panel
          title="بهترین محتوا"
          description={data.rankedSample
            ? `از میان ${toFa(data.rankedSample)} محتوای دارای سنجه در این بازه`
            : 'در این بازه محتوای دارای سنجه‌ای ثبت نشده است'}
          actions={<Pill tone="ok" dot>بالاترین امتیاز</Pill>}
        >
          {data.best ? (
            <div className="mc-summary-grid">
              <div className="mc-summary-cell" style={{ gridColumn: '1 / -1' }}>
                <span>{labelOf(config.platforms, data.best.platform)} · {labelOf(config.contentTypes, data.best.contentType)}</span>
                <strong style={{ fontSize: '0.88rem', lineHeight: 1.7 }}>{data.best.title}</strong>
              </div>
              <div className="mc-summary-cell"><span>Reach</span><strong>{fmt(data.best.metrics?.reach)}</strong></div>
              <div className="mc-summary-cell"><span>Engagement</span><strong>{fmt(data.best.metrics?.engagement)}</strong></div>
              <div className="mc-summary-cell"><span>کلیک</span><strong>{fmt(data.best.metrics?.clicks)}</strong></div>
              <div className="mc-summary-cell"><span>امتیاز</span><strong>{fmt(data.best.score)}</strong></div>
            </div>
          ) : <Empty title="محتوایی برای رتبه‌بندی نیست" description="با ثبت سنجه برای محتواهای منتشرشده، این کارت پر می‌شود." />}
        </Panel>

        <Panel
          title="ضعیف‌ترین محتوا"
          description="برای بررسی الگوی محتوای کم‌بازده"
          actions={<Pill tone="warn" dot>پایین‌ترین امتیاز</Pill>}
        >
          {data.worst ? (
            <div className="mc-summary-grid">
              <div className="mc-summary-cell" style={{ gridColumn: '1 / -1' }}>
                <span>{labelOf(config.platforms, data.worst.platform)} · {labelOf(config.contentTypes, data.worst.contentType)}</span>
                <strong style={{ fontSize: '0.88rem', lineHeight: 1.7 }}>{data.worst.title}</strong>
              </div>
              <div className="mc-summary-cell"><span>Reach</span><strong>{fmt(data.worst.metrics?.reach)}</strong></div>
              <div className="mc-summary-cell"><span>Engagement</span><strong>{fmt(data.worst.metrics?.engagement)}</strong></div>
              <div className="mc-summary-cell"><span>کلیک</span><strong>{fmt(data.worst.metrics?.clicks)}</strong></div>
              <div className="mc-summary-cell"><span>امتیاز</span><strong>{fmt(data.worst.score)}</strong></div>
            </div>
          ) : <Empty title="محتوایی برای رتبه‌بندی نیست" description="با ثبت سنجه برای محتواهای منتشرشده، این کارت پر می‌شود." />}

          {data.averageEngagementScore !== null ? (
            <p className="mc-muted" style={{ marginTop: '0.6rem' }}>
              میانگین امتیاز تعامل در این بازه: <strong>{fmt(data.averageEngagementScore)}</strong>
            </p>
          ) : null}
        </Panel>
      </div>

      {/* ─── انواع محتوا، قیف و صف ─── */}
      <div className="mc-grid mc-grid--2">
        <Panel title="انواع محتوا" description="کدام قالب بیشترین دسترسی را می‌سازد">
          <BarList rows={typeRows} color="var(--blue-ink)" />
        </Panel>

        <Panel
          title="قیف رسانه تا سایت"
          description="از کلیک روی لینک تا ثبت‌نام و خرید"
          actions={<Pill tone="blue">نرخ تبدیل مرحله‌ای</Pill>}
        >
          <Funnel funnel={data.funnel} />
          <p className="mc-muted" style={{ marginTop: '0.7rem', lineHeight: 1.9 }}>
            منبع: لینک‌های UTM ساخته‌شده و سنجهٔ <span className="mc-mono">websiteClicks</span> اکانت‌ها.
            اگر اکانتی سنجهٔ سایت ثبت نکند، سهمش در این قیف نمی‌آید.
          </p>
        </Panel>
      </div>

      <div className="mc-grid mc-grid--2">
        <Panel
          title="هشتگ و موضوع"
          description="بر اساس Reach محتوای منتشرشده"
          actions={<button type="button" className="mc-quick__btn" onClick={() => openTab('tags')}>همهٔ موضوع‌ها</button>}
        >
          {tagRows.length ? (
            <div className="mc-tagcloud">
              {tagRows.map((row) => (
                <span className="mc-tag" key={row.id}>
                  <b>{row.label}</b>
                  <small>{fmt(row.reach, { compact: true })} Reach</small>
                </span>
              ))}
            </div>
          ) : (
            <Empty
              title="هنوز هشتگی به محتوا وصل نشده"
              description="وقتی محتوایی با هشتگ منتشر و سنجه‌اش ثبت شود، عملکرد موضوع‌ها اینجا دیده می‌شود."
            />
          )}
        </Panel>

        <Panel
          title="صف انتشار"
          description="آنچه همین حالا در انتظار ارسال است"
          actions={<button type="button" className="mc-quick__btn" onClick={() => openTab('queue')}>مدیریت صف</button>}
        >
          <div className="mc-summary-grid">
            <div className="mc-summary-cell"><span>آمادهٔ ارسال</span><strong>{fmt(data.queue.due)}</strong></div>
            <div className="mc-summary-cell"><span>زمان‌بندی‌شده</span><strong>{fmt(data.queue.scheduled)}</strong></div>
            <div className="mc-summary-cell"><span>در حال ارسال</span><strong>{fmt(data.queue.publishing)}</strong></div>
            <div className="mc-summary-cell"><span>ناموفق</span><strong>{fmt(data.queue.failed)}</strong></div>
          </div>

          <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {(data.queue.items ?? []).slice(0, 5).map((row) => (
              <div className="mc-row mc-row--between" key={row.id}>
                <span className="mc-row" style={{ gap: '0.4rem', minWidth: 0 }}>
                  <IconClock width={14} height={14} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</span>
                </span>
                <span className="mc-row" style={{ gap: '0.4rem' }}>
                  <span className="mc-muted">{labelOf(config.platforms, row.platform)}</span>
                  <Pill tone={row.status === 'failed' ? 'danger' : row.status === 'publishing' ? 'blue' : 'warn'}>
                    {row.scheduledAt ? `${clockTime(row.scheduledAt)} — ${relativeTime(row.scheduledAt)}` : row.status}
                  </Pill>
                </span>
              </div>
            ))}
            {!data.queue.items?.length ? (
              <p className="mc-muted">صف خالی است.</p>
            ) : null}
          </div>
        </Panel>
      </div>

      {/* ─── تذکر صادقانه ─── */}
      {data.accountsWithoutMetrics ? (
        <div className="mc-demo">
          <IconWarning width={16} height={16} />
          <span>
            {toFa(data.accountsWithoutMetrics)} اکانت هیچ سنجه‌ای ثبت نکرده است. تا وقتی سنجه‌ای ثبت
            نشود، سهم آن اکانت در نمودارها و مقایسه‌ها «—» می‌ماند و صفر شمرده نمی‌شود.
          </span>
          <span className="mc-demo__spacer" />
          <button type="button" className="mc-quick__btn" onClick={() => openTab('accounts')}>
            <IconPulse width={14} height={14} />
            رفتن به اکانت‌ها
          </button>
        </div>
      ) : null}
    </>
  );
}
