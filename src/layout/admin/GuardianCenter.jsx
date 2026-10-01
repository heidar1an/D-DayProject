import { useCallback, useEffect, useRef, useState } from 'react';

import { getGuardianStatus } from '../../services/admin/adminService';
import { IconRefresh, IconShield, IconWarning } from './adminIcons';
import './guardian.css';

const REFRESH_MS = 20_000;
const faNumber = (value) => new Intl.NumberFormat('fa-IR').format(Number(value) || 0);
const faPercent = (value) => (value == null ? 'اندازه‌گیری نشده' : `${faNumber(value)}٪`);
const faDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
};
const statusLabels = { critical: 'بحرانی', warning: 'نیازمند بررسی', observing: 'در حال پایش' };
const severityLabels = { critical: 'بحرانی', warning: 'هشدار' };
const controlLabels = { active: 'فعال', conditional: 'مشروط', missing: 'غایب', unknown: 'نامشخص' };

function MetricCard({ label, value, detail, tone = 'neutral' }) {
  return (
    <article className={`tg-metric tg-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function EmptyState({ children }) {
  return <p className="tg-empty">{children}</p>;
}

export default function GuardianCenter() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestController = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;

    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const next = await getGuardianStatus({ signal: controller.signal });
      if (requestController.current !== controller) return;
      setReport(next);
      setLastUpdated(Date.now());
      setError(null);
    } catch (requestError) {
      if (requestController.current !== controller || requestError?.name === 'AbortError') return;
      setError(requestError);
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh({ quiet: true }), REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      requestController.current?.abort();
      requestController.current = null;
    };
  }, [refresh]);

  const status = report?.status ?? 'observing';
  const traffic = report?.traffic ?? {};
  const system = report?.system ?? {};
  const alerts = report?.alerts ?? [];
  const windowLabel = traffic.windowSecondsObserved
    ? `${faNumber(traffic.windowSecondsObserved)} ثانیه دادهٔ مشاهده‌شده از سقف ${faNumber(traffic.windowSecondsConfigured)} ثانیه`
    : 'هنوز داده‌ای در پنجره ثبت نشده است';

  if (loading && !report) {
    return <div className="tg-loading" role="status" aria-busy="true">در حال خواندن وضعیت محلی Guardian…</div>;
  }

  return (
    <section className="tg-root" aria-label="Tapesh Guardian">
      <div className={`tg-status tg-status--${status}`}>
        <span className="tg-status__icon" aria-hidden="true"><IconShield width={22} height={22} /></span>
        <div className="tg-status__copy">
          <strong>وضعیت: {statusLabels[status] ?? 'نامشخص'}</strong>
          <span>{report?.scope?.requestSource ?? 'منبع سنجه نامشخص'}</span>
        </div>
        <div className="tg-status__actions">
          <span className="tg-updated">آخرین بررسی: {lastUpdated ? faDateTime(lastUpdated) : '—'}</span>
          <button type="button" className="tg-refresh" onClick={() => refresh()} disabled={refreshing}>
            <IconRefresh width={16} height={16} />
            {refreshing ? 'در حال بررسی…' : 'بررسی دوباره'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="tg-error" role="alert">
          <strong>گزارش Guardian دریافت نشد.</strong>
          <span>{error.message}</span>
          <button type="button" onClick={() => refresh()}>تلاش دوباره</button>
        </div>
      ) : null}

      <div className="tg-metrics-grid">
        <MetricCard label="درخواست‌های نمونه" value={faNumber(traffic.requestCount)} detail={windowLabel} />
        <MetricCard label="خطاهای ۵xx" value={faNumber(traffic.serverErrorCount)} tone={traffic.serverErrorCount ? 'warning' : 'neutral'} detail="فقط نمونهٔ همین پروسه" />
        <MetricCard label="ورود ناموفق" value={faNumber(traffic.authFailures)} tone={traffic.authFailures ? 'warning' : 'neutral'} detail={traffic.authScope ?? 'منبع نامشخص'} />
        <MetricCard label="محدودیت ورود" value={faNumber(traffic.authRateLimited)} detail="پاسخ‌های ۴۲۹ در مسیرهای ورود" />
        <MetricCard label="بار CPU نسبی" value={faPercent(system.cpuLoadPercent)} detail="load average نسبت به تعداد هسته‌ها؛ نه CPU profiling" />
        <MetricCard label="حافظهٔ فرایند" value={system.processRssBytes == null ? 'اندازه‌گیری نشده' : `${faNumber(Math.round(system.processRssBytes / 1048576))} مگابایت`} detail="RSS همین پروسه" />
      </div>

      <div className="tg-columns">
        <section className="tg-panel">
          <div className="tg-panel__heading">
            <div><h2>هشدارهای فعلی</h2><p>قواعد قطعی؛ بدون اقدام خودکار</p></div>
            <span className={`tg-count ${alerts.length ? 'is-alert' : ''}`}>{faNumber(alerts.length)}</span>
          </div>
          {alerts.length ? (
            <ul className="tg-alert-list">
              {alerts.map((item) => (
                <li key={item.id} className={`tg-alert tg-alert--${item.severity}`}>
                  <IconWarning width={17} height={17} />
                  <div><strong>{item.title}</strong><p>{item.detail}</p></div>
                  <span>{severityLabels[item.severity] ?? 'اطلاع'}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState>در نمونهٔ مشاهده‌شده قاعده‌ای فعال نشده؛ این به معنی تضمین نبود حمله نیست.</EmptyState>}
        </section>

        <section className="tg-panel">
          <div className="tg-panel__heading"><div><h2>آمادگی و تمامیت مشاهده‌شده</h2><p>بررسی‌های همین سرور</p></div></div>
          <ul className="tg-check-list">
            {(report?.readiness?.checks ?? []).map((check) => (
              <li key={check.name} className={check.ok ? 'is-ok' : 'is-fail'}>
                <span className="tg-check-dot" aria-hidden="true" />
                <strong>{check.name}</strong><small>{check.detail}</small>
                <span>{check.ok ? 'آماده' : 'ناموفق'}</span>
              </li>
            ))}
            <li className={report?.storage?.corruptObserved ? 'is-fail' : 'is-ok'}>
              <span className="tg-check-dot" aria-hidden="true" />
              <strong>خرابی JSON مشاهده‌شده</strong>
              <small>{report?.storage?.scope}</small>
              <span>{faNumber(report?.storage?.corruptObserved)} مورد</span>
            </li>
          </ul>
          {report?.storage?.files?.length ? <p className="tg-file-list">فایل‌های گزارش‌شده: {report.storage.files.join('، ')}</p> : null}
        </section>
      </div>

      <div className="tg-columns">
        <section className="tg-panel">
          <div className="tg-panel__heading"><div><h2>هدرهای امنیتی</h2><p>وضعیت پیکربندی، نه آزمون خارجی دامنه</p></div></div>
          <ul className="tg-check-list">
            {(report?.securityHeaders ?? []).map((item) => (
              <li key={item.key} className={item.status === 'active' ? 'is-ok' : 'is-warn'}>
                <span className="tg-check-dot" aria-hidden="true" />
                <strong>{item.label}</strong>
                <small>{item.value ?? 'وابسته به محیط/HTTPS'}</small>
                <span>{controlLabels[item.status] ?? 'نامشخص'}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="tg-panel">
          <div className="tg-panel__heading"><div><h2>مسیرهای پرتکرار</h2><p>{windowLabel}</p></div></div>
          {traffic.topPaths?.length ? (
            <ul className="tg-path-list">
              {traffic.topPaths.map((item) => (
                <li key={item.path}><code dir="ltr">{item.path}</code><span>{faNumber(item.count)}</span><small>{faNumber(item.errors)} خطا</small></li>
              ))}
            </ul>
          ) : <EmptyState>در این پروسه هنوز نمونه‌ای ثبت نشده است.</EmptyState>}
        </section>
      </div>

      <section className="tg-panel">
        <div className="tg-panel__heading"><div><h2>خطاهای اخیر</h2><p>مسیرها پاک‌سازی شده‌اند؛ IP، User-Agent و بدنه نمایش داده نمی‌شوند.</p></div></div>
        {traffic.recentErrors?.length ? (
          <div className="tg-table-wrap">
            <table className="tg-table">
              <thead><tr><th>زمان</th><th>روش</th><th>مسیر</th><th>وضعیت</th></tr></thead>
              <tbody>
                {traffic.recentErrors.map((item, index) => (
                  <tr key={`${item.t}-${item.path}-${index}`}>
                    <td>{faDateTime(item.t)}</td><td>{item.method}</td><td><code dir="ltr">{item.path}</code></td><td>{faNumber(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState>خطایی در نمونهٔ اخیر ثبت نشده است.</EmptyState>}
      </section>

      <section className="tg-limitations">
        <h2>مرزهای فاز اول</h2>
        <ul>
          <li>شمارنده‌ها فقط در حافظهٔ همین پروسه‌اند؛ با restart پاک می‌شوند و baseline هفت‌روزه ندارند.</li>
          <li>در Vite/preview ممکن است فقط ترافیک API پنل در دسترس باشد؛ در production منبع اصلی middleware سرور است.</li>
          <li>تمامیت JSON فقط خرابی‌ای را می‌بیند که پروسه هنگام خواندن/نوشتن مشاهده کرده؛ اسکن hash فایل‌های سورس/آپلود انجام نمی‌شود.</li>
          <li>رخدادها پایدار نیستند؛ مانیتور بیرونی، GeoIP، بستن IP، ابطال نشست و rollback خودکار فعال نیستند.</li>
        </ul>
      </section>
    </section>
  );
}
