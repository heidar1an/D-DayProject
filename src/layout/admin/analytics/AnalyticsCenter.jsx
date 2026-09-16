/*
 * مرکز تحلیل تپش — پوستهٔ اصلی.
 *
 * یک پوسته، ۱۶ بخش. هر بخش یک Endpoint مستقل با مجوز مستقل دارد و این پوسته
 * فقط تب‌های مجاز را می‌سازد تا درخواست بی‌دلیل ۴۰۳ نخورد.
 *
 * بازهٔ زمانی، منبع حقیقت مشترک همهٔ بخش‌هاست و در آدرس هم می‌نشیند
 * (`#admin/analytics/traffic`) تا رفرش و Back/Forward همان تب را نگه دارند.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAsync, useToast, Spinner, Button } from '../adminShared';
import { ANALYTICS_RANGES, ANALYTICS_SECTIONS, analytics } from '../../../services/admin/adminService';
import {
  NeedsConnection, Panel, exportCsv, exportExcel, exportPdf, toFa, faNumber,
} from './analyticsKit';
import { OverviewSection, AiSection } from './sections/overview';
import { TrafficSection, UsersSection, MarketingSection } from './sections/audience';
import { EducationSection, ProductsSection, ContentSection } from './sections/learning';
import { PerformanceSection, SystemSection, ErrorsSection, RealtimeSection } from './sections/operations';
import { SeoSection, SecuritySection, RevenueSection, AlertsSection } from './sections/trust';

/* نگاشت بخش → کامپوننت */
const SECTION_VIEWS = {
  overview: OverviewSection,
  traffic: TrafficSection,
  users: UsersSection,
  education: EducationSection,
  seo: SeoSection,
  performance: PerformanceSection,
  security: SecuritySection,
  revenue: RevenueSection,
  products: ProductsSection,
  content: ContentSection,
  marketing: MarketingSection,
  system: SystemSection,
  errors: ErrorsSection,
  realtime: RealtimeSection,
  alerts: AlertsSection,
  ai: AiSection,
};

/*
 * «جزئیات» هر سنجه در نمای کلی به کدام بخش می‌رود.
 * این همان Drill-down است: از عدد کلی به بخش تخصصی.
 */
const KPI_DRILLDOWN = {
  pageViews: 'traffic', sessions: 'traffic', activeUsers: 'traffic', avgDuration: 'traffic',
  bounceRate: 'traffic', dau: 'traffic', wau: 'traffic', mau: 'traffic',
  newUsers: 'users', signups: 'users', visitorToSignup: 'users',
  tests: 'education', answered: 'education', flashcards: 'education',
  publishedContent: 'content',
  revenue: 'revenue', purchases: 'revenue', averageOrderValue: 'revenue', purchaseConversion: 'revenue',
  errors: 'errors', jsErrors: 'errors',
  lcp: 'performance', inp: 'performance', cls: 'performance',
};

const REALTIME_INTERVAL_MS = 10_000;

/* برچسب بازه برای خروجی و توضیح زیر سرتیتر */
function rangeLabel(range, from, to) {
  if (range === 'custom' && from) {
    const format = (value) => toFa(new Date(value).toLocaleDateString('fa-IR'));
    return to ? `${format(from)} تا ${format(to)}` : `از ${format(from)}`;
  }
  return ANALYTICS_RANGES.find((item) => item.key === range)?.label ?? range;
}

export default function AnalyticsCenter({ admin, tab, onTabChange }) {
  const notify = useToast();

  const can = useCallback(
    (permission) => !permission || admin.permissions?.includes(permission),
    [admin.permissions],
  );

  /* فقط بخش‌هایی که کاربر مجوزشان را دارد ساخته می‌شوند */
  const tabs = useMemo(
    () => ANALYTICS_SECTIONS.filter((section) => can(section.permission)),
    [can],
  );

  const allowedKeys = useMemo(() => new Set(tabs.map((section) => section.key)), [tabs]);

  const activeTab = allowedKeys.has(tab) ? tab : tabs[0]?.key ?? null;

  /*
   * اگر تبِ آدرس مجاز نباشد (یا آدرس تب نداشته باشد)، تب واقعی در آدرس نوشته
   * می‌شود تا لینک با چیزی که کاربر می‌بیند یکی بماند.
   */
  useEffect(() => {
    if (activeTab && tab !== activeTab) onTabChange(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tab]);

  const [range, setRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const params = useMemo(() => (
    range === 'custom'
      ? { range, from: customFrom || undefined, to: customTo || undefined }
      : { range }
  ), [range, customFrom, customTo]);

  /* بازهٔ سفارشی تا وقتی هر دو تاریخ نیامده‌اند معنا ندارد */
  const customReady = range !== 'custom' || Boolean(customFrom);

  const { data, loading, error, reload, setData } = useAsync(
    () => (activeTab && customReady ? analytics.section(activeTab, params) : Promise.resolve(null)),
    [activeTab, params, customReady],
  );

  /* وضعیت منابع داده — یک‌بار خوانده می‌شود */
  const { data: sourcesData } = useAsync(() => analytics.sources(), []);
  const sources = sourcesData?.sources ?? [];
  const disconnected = sources.filter((source) => !source.connected);

  /* ── به‌روزرسانی خودکار بخش «لحظه‌ای» ── */
  const refreshRealtime = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await analytics.section('realtime', params);
      setData(next);
    } catch {
      /* شکست یک Poll نباید چیزی را خراب کند */
    } finally {
      setRefreshing(false);
    }
  }, [params, setData]);

  useEffect(() => {
    if (activeTab !== 'realtime') return undefined;
    const timer = window.setInterval(refreshRealtime, REALTIME_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeTab, refreshRealtime]);

  /* ── خروجی گرفتن ── */
  const handleExport = async (format) => {
    setBusy(true);
    try {
      const payload = await analytics.export(activeTab, params);
      const label = ANALYTICS_SECTIONS.find((section) => section.key === activeTab)?.label ?? activeTab;
      const caption = rangeLabel(range, customFrom, customTo);

      const ok = format === 'csv'
        ? exportCsv(label, payload.data, caption)
        : format === 'excel'
          ? exportExcel(label, payload.data, caption)
          : exportPdf(label, payload.data, caption);

      notify(ok ? `خروجی ${format.toUpperCase()} آماده شد` : 'داده‌ای برای خروجی وجود ندارد');
    } catch (exportError) {
      notify(exportError.message || 'خروجی گرفتن ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  /* ── مدیریت هشدارها ── */
  const saveAlert = async (payload, id) => {
    setBusy(true);
    try {
      if (id) await analytics.alerts.update(id, payload);
      else await analytics.alerts.create(payload);
      notify(id ? 'هشدار به‌روزرسانی شد' : 'هشدار ساخته شد');
      await reload();
      return true;
    } catch (alertError) {
      notify(alertError.message || 'ذخیرهٔ هشدار ناموفق بود');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const deleteAlert = async (id) => {
    setBusy(true);
    try {
      await analytics.alerts.remove(id);
      notify('هشدار حذف شد');
      await reload();
    } catch (alertError) {
      notify(alertError.message || 'حذف هشدار ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  /* ── Drill-down از سنجه به بخش ── */
  const drill = (kpiKey) => {
    const target = KPI_DRILLDOWN[kpiKey];
    if (target && allowedKeys.has(target)) onTabChange(target);
  };

  const SectionView = activeTab ? SECTION_VIEWS[activeTab] : null;
  const activeLabel = ANALYTICS_SECTIONS.find((section) => section.key === activeTab)?.label ?? '';

  return (
    <div className="an-root">
      {/* ── نوار کنترل ── */}
      <div className="an-toolbar">
        <nav className="an-tabs" aria-label="بخش‌های مرکز تحلیل">
          {tabs.map((section) => (
            <button
              key={section.key}
              type="button"
              className={`an-tab ${section.key === activeTab ? 'is-active' : ''}`}
              onClick={() => onTabChange(section.key)}
              aria-current={section.key === activeTab ? 'page' : undefined}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="an-toolbar__controls">
          <div className="an-ranges" role="group" aria-label="بازهٔ زمانی">
            {ANALYTICS_RANGES.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`an-range ${range === option.key ? 'is-active' : ''}`}
                onClick={() => setRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {range === 'custom' ? (
            <div className="an-dates">
              <label>
                <span>از</span>
                <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
              </label>
              <label>
                <span>تا</span>
                <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
              </label>
            </div>
          ) : null}

          <div className="an-toolbar__actions">
            <Button variant="ghost" size="sm" onClick={() => reload()} loading={loading && Boolean(data)}>
              به‌روزرسانی
            </Button>

            {can('analytics.export') ? (
              <div className="an-export">
                <span>خروجی:</span>
                <button type="button" className="an-linkbtn" disabled={busy || !data} onClick={() => handleExport('csv')}>CSV</button>
                <button type="button" className="an-linkbtn" disabled={busy || !data} onClick={() => handleExport('excel')}>Excel</button>
                <button type="button" className="an-linkbtn" disabled={busy || !data} onClick={() => handleExport('pdf')}>PDF</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── نوار وضعیت داده ── */}
      <div className="an-statusbar">
        <span className="an-statusbar__item">
          بخش: <b>{activeLabel}</b>
        </span>
        <span className="an-statusbar__item">
          بازه: <b>{rangeLabel(range, customFrom, customTo)}</b>
          {data?.range?.days ? ` (${toFa(data.range.days)} روز)` : ''}
        </span>
        {data?.range?.previous ? (
          <span className="an-statusbar__item an-muted">
            مقایسه با {toFa(new Date(data.range.previous.start).toLocaleDateString('fa-IR'))}
            {' '}تا {toFa(new Date(data.range.previous.end).toLocaleDateString('fa-IR'))}
          </span>
        ) : null}
        <span className="an-statusbar__spacer" />
        <span className="an-statusbar__item">
          <span className={`an-sources__dot ${disconnected.length ? 'is-partial' : ''}`} aria-hidden="true" />
          {faNumber(sources.length - disconnected.length)} منبع وصل
          {disconnected.length ? ` · ${faNumber(disconnected.length)} بدون اتصال` : ''}
        </span>
      </div>

      {/* ── بدنه ── */}
      {!customReady ? (
        <div className="an-boot">برای بازهٔ سفارشی، تاریخ شروع را انتخاب کنید.</div>
      ) : loading && !data ? (
        <div className="an-boot"><Spinner /> در حال محاسبهٔ تحلیل…</div>
      ) : error ? (
        <div className="an-error-box" role="alert">
          <strong>دریافت دادهٔ این بخش ناموفق بود</strong>
          <p>{error.message}</p>
          <Button variant="ghost" size="sm" onClick={() => reload()}>تلاش دوباره</Button>
        </div>
      ) : data?.data && SectionView ? (
        <>
          <SectionView
            data={data.data}
            range={data.range}
            onDrill={drill}
            onRefresh={refreshRealtime}
            refreshing={refreshing}
            onSave={saveAlert}
            onDelete={deleteAlert}
            busy={busy}
          />

          {/* منبع داده‌های وصل‌نشده، یک‌بار در پایین هر بخش یادآوری می‌شود */}
          {disconnected.length ? (
            <Panel title="منابع دادهٔ وصل‌نشده" description="با تنظیم متغیرهای محیطی، بخش‌های وابسته خودکار پر می‌شوند">
              <ul className="an-sources">
                {disconnected.map((source) => (
                  <li key={source.id} className="is-off">
                    <span className="an-sources__dot" aria-hidden="true" />
                    <span className="an-sources__label">{source.label}</span>
                    <span className="an-sources__detail">{source.detail}</span>
                    <span className="an-sources__state">وصل نیست</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </>
      ) : (
        <NeedsConnection
          title="این بخش در دسترس نیست"
          note="برای مشاهدهٔ این بخش به مجوز مناسب نیاز دارید یا داده‌ای برای این بازه وجود ندارد."
        />
      )}
    </div>
  );
}
