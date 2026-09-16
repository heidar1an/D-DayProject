/*
 * بخش‌های «عملکرد فنی»، «سلامت سیستم»، «خطاها» و «لحظه‌ای».
 *
 * این چهار بخش وضعیت فنی واقعی را نشان می‌دهند: Core Web Vitals از مرورگر
 * کاربران، سنجه‌های HTTP از خود سرور، منابع سیستم از `node:os`، و خطاهای
 * واقعی ثبت‌شده. هیچ‌کدام تخمینی نیست.
 */

import { useState } from 'react';

import {
  BarChart, DataTable, Donut, Gauge, HBarList, KpiCard, MiniStat, NeedsConnection,
  Notice, Panel, ScoreCard, SectionHero, StatusPill, formatBytes, formatDuration,
  formatPercent, formatValue, faNumber, toFa,
} from '../analyticsKit';

const SPARK_FIELDS = { apiResponse: 'api', apiP95: 'api' };
const INVERTED = new Set(['lcp', 'inp', 'cls', 'fcp', 'ttfb', 'apiResponse', 'apiP95', 'failed', 'frontendErrors', 'backendErrors']);

const STATUS_LABELS = { healthy: 'سالم', warn: 'هشدار', critical: 'بحرانی', degraded: 'کاهش عملکرد', down: 'قطع', unknown: 'نامشخص' };

/* ─────────────────────────── عملکرد فنی ─────────────────────────── */

export function PerformanceSection({ data }) {
  const vitals = data.coreWebVitals ?? [];
  const api = data.api ?? {};
  const minutes = api.minutes ?? [];

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="عملکرد فنی"
        title="سرعت واقعی برای کاربر واقعی"
        description="Core Web Vitals از اندازه‌گیری واقعی مرورگر کاربران می‌آید (نه آزمایشگاه)، و سنجه‌های API از خود همین سرور."
      />

      <div className="an-split an-split--narrow">
        <Panel title="امتیاز عملکرد" description="میانگین وضعیت سنجه‌های واقعی">
          <ScoreCard
            score={data.score ?? 0}
            label="از ۱۰۰"
            tone={data.score >= 90 ? 'good' : data.score >= 50 ? 'warn' : 'critical'}
            caption={vitals.length ? `${toFa(vitals.length)} سنجهٔ اندازه‌گیری‌شده` : 'هنوز سنجه‌ای ثبت نشده'}
          />
        </Panel>

        <Panel title="سنجه‌های کلیدی" className="an-span-2">
          <div className="an-kpi-grid">
            {(data.kpis ?? []).map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} invert={INVERTED.has(kpi.key)} compact />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Core Web Vitals" description="صدک ۷۵ اندازه‌گیری‌های واقعی — آستانهٔ گوگل مبنای وضعیت است">
        {vitals.length ? (
          <div className="an-vitals">
            {vitals.map((vital) => {
              const ratio = vital.poor > 0 ? Math.min(1, vital.p75 / vital.poor) : 0;
              const unit = vital.metric === 'CLS' ? '' : 'ms';
              return (
                <article key={vital.metric} className={`an-vital an-vital--${vital.status}`}>
                  <header>
                    <strong>{vital.label}</strong>
                    <StatusPill status={vital.status} />
                  </header>
                  <p className="an-vital__value">
                    {formatValue(vital.p75, vital.metric === 'CLS' ? 3 : 0)}
                    {unit ? <small>{unit}</small> : null}
                  </p>
                  <div className="an-vital__track">
                    <span style={{ width: `${Math.max(3, ratio * 100)}%` }} />
                  </div>
                  <footer>
                    <span>{vital.hint}</span>
                    <span className="an-muted">
                      {faNumber(vital.samples)} نمونه · میانگین {formatValue(vital.average, 0)}{unit}
                    </span>
                  </footer>
                  <p className="an-vital__thresholds">
                    خوب ≤ {faNumber(vital.good)}{unit} · ضعیف &gt; {faNumber(vital.poor)}{unit}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <Notice tone="info">
            هنوز اندازه‌گیری Core Web Vitals ثبت نشده است. این سنجه‌ها از مرورگر بازدیدکنندگان
            واقعی سایت جمع می‌شوند و با اولین بازدیدها پر می‌شوند.
          </Notice>
        )}
      </Panel>

      <Panel title="پاسخ‌دهی API" description={`${faNumber(api.total ?? 0)} درخواست اندازه‌گیری‌شده در بازه`}>
        <div className="an-kpi-grid an-kpi-grid--tight">
          <MiniStat label="میانگین" value={api.averageMs === null ? '—' : `${faNumber(Math.round(api.averageMs))} ms`} />
          <MiniStat label="صدک ۵۰" value={api.p50Ms === null ? '—' : `${faNumber(Math.round(api.p50Ms))} ms`} />
          <MiniStat label="صدک ۹۵" value={api.p95Ms === null ? '—' : `${faNumber(Math.round(api.p95Ms))} ms`} tone="warn" />
          <MiniStat label="صدک ۹۹" value={api.p99Ms === null ? '—' : `${faNumber(Math.round(api.p99Ms))} ms`} tone="critical" />
          <MiniStat label="نرخ خطا" value={formatPercent(api.errorRate)} tone={api.errorRate >= 5 ? 'critical' : 'good'} />
        </div>

        {minutes.length ? (
          <BarChart
            data={minutes.slice(-30).map((minute) => ({ key: minute.key, label: minute.key, value: minute.count }))}
            height={180}
            unit=" درخواست"
          />
        ) : null}

        <div className="an-split">
          <div>
            <h4 className="an-subhead">کندترین مسیرها</h4>
            <DataTable
              rows={api.slowest ?? []}
              columns={[
                { key: 'path', label: 'مسیر', render: (row) => <span className="an-path">{row.path}</span> },
                { key: 'count', label: 'تعداد', align: 'end' },
                { key: 'averageMs', label: 'میانگین', align: 'end', render: (row) => `${faNumber(Math.round(row.averageMs ?? 0))} ms` },
                { key: 'maxMs', label: 'بیشینه', align: 'end', render: (row) => `${faNumber(Math.round(row.maxMs ?? 0))} ms` },
              ]}
              initialSort={{ key: 'averageMs', dir: 'desc' }}
              emptyLabel="درخواستی ثبت نشده"
            />
          </div>
          <div>
            <h4 className="an-subhead">مسیرهای خطادار</h4>
            <DataTable
              rows={api.failing ?? []}
              columns={[
                { key: 'path', label: 'مسیر', render: (row) => <span className="an-path">{row.path}</span> },
                { key: 'count', label: 'تعداد', align: 'end' },
                { key: 'errors', label: 'خطا', align: 'end' },
                { key: 'errorRate', label: 'نرخ', align: 'end', render: (row) => formatPercent(row.errorRate) },
              ]}
              initialSort={{ key: 'errors', dir: 'desc' }}
              emptyLabel="خطایی ثبت نشده"
            />
          </div>
        </div>
      </Panel>

      <div className="an-split">
        <Panel title="کندترین صفحات" description="از سنجه‌های واقعی مرورگر">
          <DataTable
            rows={data.slowPages ?? []}
            columns={[
              { key: 'path', label: 'مسیر', render: (row) => <span className="an-path">{row.path}</span> },
              { key: 'samples', label: 'نمونه', align: 'end' },
              { key: 'avgMs', label: 'میانگین', align: 'end', render: (row) => `${faNumber(Math.round(row.avgMs ?? 0))} ms` },
              { key: 'worstMs', label: 'بدترین', align: 'end', render: (row) => `${faNumber(Math.round(row.worstMs ?? 0))} ms` },
            ]}
            initialSort={{ key: 'avgMs', dir: 'desc' }}
            emptyLabel="سنجه‌ای ثبت نشده"
          />
        </Panel>

        <Panel title="توزیع کد وضعیت">
          {Object.keys(api.byStatus ?? {}).length ? (
            <Donut
              slices={Object.entries(api.byStatus).map(([key, value]) => ({
                key,
                label: key,
                value,
                color: key.startsWith('2') ? '#61d192' : key.startsWith('3') ? '#5b8cc7' : key.startsWith('4') ? '#e0b45c' : '#ef9196',
              }))}
              centerLabel="درخواست"
            />
          ) : (
            <p className="an-muted">درخواستی در بازه ثبت نشده است.</p>
          )}
        </Panel>
      </div>

      <Panel title="امتیاز Lighthouse / PageSpeed">
        {data.lighthouse?.connected ? (
          <p className="an-muted">دادهٔ PageSpeed در دسترس است.</p>
        ) : (
          <NeedsConnection
            title="آزمون آزمایشگاهی سرعت وصل نیست"
            requires={data.lighthouse?.requires}
            note={data.lighthouse?.note}
          />
        )}
      </Panel>
    </div>
  );
}

/* ─────────────────────────── سلامت سیستم ─────────────────────────── */

export function SystemSection({ data }) {
  const system = data.system ?? {};
  const cpu = system.cpu ?? {};
  const memory = system.memory ?? {};
  const disk = system.disk ?? {};
  const database = system.database ?? {};
  const requests = data.requests ?? {};
  const sessions = data.sessions ?? {};

  const checks = data.checks ?? [];

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="سلامت سیستم"
        title="آیا سرور و داده سالم است؟"
        description="همهٔ این سنجه‌ها از فرایند همین سرور و فایل‌های واقعی پروژه خوانده می‌شوند."
        actions={<StatusPill status={data.overall ?? 'neutral'} label={STATUS_LABELS[data.overall] ?? data.overall} />}
      />

      <div className="an-split an-split--narrow">
        <Panel title="امتیاز سلامت">
          <ScoreCard
            score={data.score ?? 0}
            label="از ۱۰۰"
            tone={data.score >= 90 ? 'good' : data.score >= 70 ? 'warn' : 'critical'}
            caption={`${toFa(checks.filter((check) => check.status === 'healthy').length)} از ${toFa(checks.length)} بررسی سالم`}
          />
        </Panel>

        <Panel title="بررسی‌ها" className="an-span-2">
          <ul className="an-checks">
            {checks.map((check) => (
              <li key={check.key} className={`is-${check.status}`}>
                <span className="an-checks__dot" aria-hidden="true" />
                <strong>{check.label}</strong>
                <span className="an-checks__detail">{check.detail}</span>
                <span className="an-checks__state">{STATUS_LABELS[check.status] ?? check.status}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="an-split an-split--thirds">
        <Panel title="پردازنده">
          <Gauge value={cpu.usedPercent ?? 0} max={100} label={`${toFa(cpu.cores ?? 0)} هسته — ${cpu.model ?? ''}`} tone={cpu.usedPercent >= 85 ? 'critical' : cpu.usedPercent >= 60 ? 'warn' : 'good'} />
          <ul className="an-kv">
            <li><span>بار ۱ دقیقه</span><strong>{toFa(Number(cpu.load1 ?? 0).toFixed(2))}</strong></li>
            <li><span>بار ۵ دقیقه</span><strong>{toFa(Number(cpu.load5 ?? 0).toFixed(2))}</strong></li>
            <li><span>بار ۱۵ دقیقه</span><strong>{toFa(Number(cpu.load15 ?? 0).toFixed(2))}</strong></li>
          </ul>
        </Panel>

        <Panel title="حافظه">
          <Gauge
            value={memory.processUsedPercent ?? 0}
            max={100}
            label={`فرایند سرور: ${formatBytes(memory.processRssBytes)}`}
            tone={memory.processRssBytes >= 3 * 1073741824 ? 'critical' : memory.processRssBytes >= 1.5 * 1073741824 ? 'warn' : 'good'}
          />
          <ul className="an-kv">
            <li><span>حافظهٔ کل سیستم</span><strong>{formatBytes(memory.totalBytes)}</strong></li>
            <li><span>درصد مصرف کل سیستم</span><strong>{formatPercent(memory.usedPercent, 0)}</strong></li>
            <li><span>Heap فرایند</span><strong>{formatBytes(memory.processHeapBytes)}</strong></li>
          </ul>
          {memory.note ? <p className="an-muted an-note">{memory.note}</p> : null}
        </Panel>

        <Panel title="دیسک و پایگاه داده">
          {disk.total ? (
            <Gauge value={disk.usedPercent ?? 0} max={100} label={`از ${formatBytes(disk.total)}`} tone={disk.usedPercent >= 90 ? 'critical' : disk.usedPercent >= 75 ? 'warn' : 'good'} />
          ) : (
            <p className="an-muted">سنجهٔ دیسک در این محیط در دسترس نیست.</p>
          )}
          <ul className="an-kv">
            <li><span>حجم پایگاه داده</span><strong>{formatBytes(database.sizeBytes)}</strong></li>
            <li><span>حجم روی دیسک</span><strong>{formatBytes(database.sizeOnDiskBytes)}</strong></li>
            <li><span>فایل‌های آپلودی</span><strong>{formatBytes(database.uploadsBytes)}</strong></li>
            <li><span>مسیر</span><strong><code>{database.directory ?? '—'}</code></strong></li>
          </ul>
        </Panel>
      </div>

      <div className="an-split">
        <Panel title="سرور">
          <ul className="an-kv">
            <li><span>وضعیت</span><strong>{STATUS_LABELS[system.server?.status] ?? (data.overall === 'healthy' ? 'سالم' : 'فعال')}</strong></li>
            <li><span>مدت فعالیت</span><strong>{formatDuration(system.server?.uptimeSeconds)}</strong></li>
            <li><span>نسخهٔ Node</span><strong>{system.server?.node ?? '—'}</strong></li>
            <li><span>سیستم‌عامل</span><strong>{system.server?.platform ?? '—'}</strong></li>
            <li><span>محیط اجرا</span><strong>{system.server?.environment ?? '—'}</strong></li>
            <li><span>شناسهٔ فرایند</span><strong>{toFa(system.server?.pid ?? '—')}</strong></li>
          </ul>
        </Panel>

        <Panel title="نشست‌های پنل" description="نشست‌های فعال ورود به پنل مدیریت">
          <div className="an-kpi-grid an-kpi-grid--tight">
            <MiniStat label="نشست فعال" value={faNumber(sessions.active ?? 0)} />
            <MiniStat label="در آستانهٔ انقضا" value={faNumber(sessions.expiringSoon ?? 0)} tone="warn" />
          </div>
          <ul className="an-kv">
            <li><span>قدیمی‌ترین نشست</span><strong>{sessions.oldest ? toFa(new Date(sessions.oldest).toLocaleString('fa-IR')) : '—'}</strong></li>
            <li><span>مجموعه‌های داده</span><strong>{faNumber((database.collections ?? []).length)}</strong></li>
          </ul>
        </Panel>
      </div>

      <Panel title="درخواست‌های HTTP" description="شمارندهٔ زندهٔ همین سرور">
        <div className="an-kpi-grid an-kpi-grid--tight">
          <MiniStat label="کل درخواست" value={faNumber(requests.total ?? 0)} />
          <MiniStat label="درخواست در دقیقه" value={faNumber(requests.rpm ?? 0)} />
          <MiniStat label="نرخ خطا" value={formatPercent(requests.errorRate)} tone={requests.errorRate >= 5 ? 'critical' : 'good'} />
          <MiniStat label="صدک ۹۵" value={requests.p95Ms === null ? '—' : `${faNumber(Math.round(requests.p95Ms))} ms`} />
        </div>
        {(requests.minutes ?? []).length ? (
          <BarChart
            data={requests.minutes.slice(-30).map((minute) => ({ key: minute.key, label: minute.key, value: minute.count }))}
            height={170}
            unit=" درخواست"
          />
        ) : null}
      </Panel>

      <Panel title="مانیتورینگ بیرونی">
        {data.monitoring?.connected ? (
          <p className="an-muted">سرویس مانیتورینگ وصل است.</p>
        ) : (
          <NeedsConnection
            title="اتصال به سرویس مانیتورینگ برقرار نیست"
            requires={data.monitoring?.requires}
            note={data.monitoring?.note}
            items={[
              'بدون این اتصال، هشدارها فقط داخل پنل نمایش داده می‌شوند و به ایمیل/تلگرام نمی‌روند.',
            ]}
          />
        )}
      </Panel>
    </div>
  );
}

/* ─────────────────────────── خطاها ─────────────────────────── */

export function ErrorsSection({ data }) {
  const [expanded, setExpanded] = useState(null);
  const groups = data.groups ?? [];

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="خطاها"
        title="چه چیزی می‌شکند"
        description="خطاهای واقعی جاوااسکریپت مرورگر کاربران و خطاهای ثبت‌شدهٔ سرور — گروه‌بندی‌شده بر پایهٔ پیام."
      />

      <div className="an-kpi-grid">
        {(data.kpis ?? []).map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} invert={INVERTED.has(kpi.key)} compact />
        ))}
      </div>

      <div className="an-split">
        <Panel title="گروه‌های خطا" description={data.note} className="an-span-2">
          {groups.length ? (
            <ul className="an-errors">
              {groups.map((group) => (
                <li key={group.key} className={`an-error ${group.status >= 80 ? 'is-critical' : group.status >= 50 ? 'is-warn' : ''}`}>
                  <button
                    type="button"
                    className="an-error__head"
                    onClick={() => setExpanded((current) => (current === group.key ? null : group.key))}
                    aria-expanded={expanded === group.key}
                  >
                    <span className="an-error__count">{faNumber(group.count)}</span>
                    <span className="an-error__msg" title={group.message}>{group.message}</span>
                    <span className="an-error__type">{group.type === 'js_error' ? 'Frontend' : 'API'}</span>
                    <span className="an-error__users">{faNumber(group.userCount)} کاربر</span>
                    <span aria-hidden="true">{expanded === group.key ? '▲' : '▼'}</span>
                  </button>

                  {expanded === group.key ? (
                    <div className="an-error__body">
                      <dl className="an-error__meta">
                        <div><dt>اولین وقوع</dt><dd>{toFa(new Date(group.firstSeen).toLocaleString('fa-IR'))}</dd></div>
                        <div><dt>آخرین وقوع</dt><dd>{toFa(new Date(group.lastSeen).toLocaleString('fa-IR'))}</dd></div>
                        <div><dt>مسیرها</dt><dd>{group.paths?.length ? group.paths.join('، ') : '—'}</dd></div>
                        <div><dt>مرورگرها</dt><dd>{group.browsers?.length ? group.browsers.join('، ') : '—'}</dd></div>
                        <div><dt>سیستم‌عامل</dt><dd>{group.systems?.length ? group.systems.join('، ') : '—'}</dd></div>
                        <div><dt>وضعیت</dt><dd>{group.resolved ? 'رسیدگی‌شده' : 'باز'}</dd></div>
                      </dl>
                      {group.stack ? <pre className="an-error__stack">{group.stack}</pre> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Notice tone="good">در این بازه هیچ خطایی ثبت نشده است.</Notice>
          )}
        </Panel>

        <Panel title="توزیع کد وضعیت">
          {Object.keys(data.statusDistribution ?? {}).length ? (
            <Donut
              slices={Object.entries(data.statusDistribution).map(([key, value]) => ({
                key,
                label: key,
                value,
                color: key.startsWith('4') ? '#e0b45c' : '#ef9196',
              }))}
              centerLabel="خطا"
              size={170}
            />
          ) : (
            <p className="an-muted">خطایی با کد وضعیت ثبت نشده است.</p>
          )}
        </Panel>
      </div>

      {(data.serverErrors ?? []).length ? (
        <Panel title="خطاهای سرور" description="خطاهای ثبت‌شده در پردازش درخواست‌ها" tone="critical">
          <DataTable
            rows={data.serverErrors}
            columns={[
              { key: 'path', label: 'مسیر', render: (row) => <span className="an-path">{row.path}</span> },
              { key: 'status', label: 'کد', align: 'end' },
              { key: 'message', label: 'پیام' },
              { key: 'count', label: 'تعداد', align: 'end' },
              { key: 'lastSeen', label: 'آخرین', render: (row) => toFa(new Date(row.lastSeen).toLocaleString('fa-IR')) },
            ]}
            initialSort={{ key: 'count', dir: 'desc' }}
          />
        </Panel>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── لحظه‌ای ─────────────────────────── */

export function RealtimeSection({ data, onRefresh, refreshing }) {
  const requests = data.requests ?? {};
  const server = data.server ?? {};
  const transport = data.transport ?? {};

  const TYPE_LABELS = {
    page_view: 'بازدید صفحه', session_start: 'شروع نشست', signup: 'ثبت‌نام', login: 'ورود',
    logout: 'خروج', article_read: 'مطالعهٔ مقاله', lesson_view: 'مشاهدهٔ درس', wiki_view: 'مشاهدهٔ ویکی',
    test_start: 'شروع تست', test_submit: 'ارسال تست', flashcard_review: 'مرور فلش‌کارت',
    feature_use: 'استفاده از قابلیت', search: 'جست‌وجو', cwv: 'سنجهٔ سرعت',
    js_error: 'خطای Frontend', api_error: 'خطای API', purchase: 'خرید',
  };

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="لحظه‌ای"
        title="همین حالا چه اتفاقی می‌افتد"
        description={transport.note}
        actions={(
          <button type="button" className="an-btn" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'به‌روزرسانی…' : 'به‌روزرسانی'}
          </button>
        )}
      />

      <Panel title={`کاربران آنلاین (${toFa(data.windowSeconds ?? 0)} ثانیهٔ اخیر)`}>
        <div className="an-live">
          <div className="an-live__big">
            <strong>{faNumber(data.onlineUsers ?? 0)}</strong>
            <span>کاربر آنلاین</span>
          </div>
          <div className="an-live__stats">
            <MiniStat label="نشست فعال" value={faNumber(data.onlineSessions ?? 0)} />
            <MiniStat label="ثبت‌نام" value={faNumber(data.signups ?? 0)} tone="good" />
            <MiniStat label="تست در جریان" value={faNumber(data.testsInProgress ?? 0)} />
            <MiniStat label="تست تکمیل‌شده" value={faNumber(data.testsCompleted ?? 0)} />
            <MiniStat label="خطا" value={faNumber(data.errors ?? 0)} tone={data.errors ? 'critical' : 'neutral'} />
            <MiniStat label="خرید" value={faNumber(data.purchases ?? 0)} />
          </div>
        </div>
        <p className="an-muted">
          آخرین به‌روزرسانی: {toFa(new Date(data.generatedAt ?? Date.now()).toLocaleTimeString('fa-IR'))} ·
          {' '}{transport.mode === 'polling' ? `به‌روزرسانی خودکار هر ${toFa(transport.intervalSeconds ?? 0)} ثانیه` : ''}
        </p>
      </Panel>

      <div className="an-split an-split--thirds">
        <Panel title="سرور">
          <div className="an-kpi-grid an-kpi-grid--tight">
            <MiniStat label="وضعیت" value={STATUS_LABELS[server.status] ?? '—'} tone={server.status === 'healthy' ? 'good' : 'warn'} />
            <MiniStat label="پردازنده" value={formatPercent(server.cpuPercent, 0)} tone={server.cpuPercent >= 85 ? 'critical' : 'good'} />
            <MiniStat label="حافظهٔ فرایند" value={server.processRssMb ? `${faNumber(server.processRssMb)} MB` : '—'} />
            <MiniStat label="فعالیت" value={formatDuration(server.uptimeSeconds)} />
          </div>
        </Panel>

        <Panel title="درخواست‌ها">
          <div className="an-kpi-grid an-kpi-grid--tight">
            <MiniStat label="در دقیقه" value={faNumber(requests.rpm ?? 0)} />
            <MiniStat label="دقیقهٔ گذشته" value={faNumber(requests.lastMinute ?? 0)} />
            <MiniStat label="خطای دقیقهٔ گذشته" value={faNumber(requests.errorsLastMinute ?? 0)} tone={requests.errorsLastMinute ? 'critical' : 'neutral'} />
            <MiniStat label="نرخ خطا" value={formatPercent(requests.errorRate)} />
          </div>
        </Panel>

        <Panel title="صفحات فعال">
          <HBarList
            rows={(data.pages ?? []).map((page) => ({ key: page.path, label: page.path, value: page.count }))}
            emptyLabel="صفحهٔ فعالی نیست"
          />
        </Panel>
      </div>

      <Panel title="جریان زندهٔ رویدادها" description="آخرین رویدادهای ثبت‌شدهٔ سایت">
        {data.feed?.length ? (
          <ul className="an-feed">
            {data.feed.map((event) => (
              <li key={event.id} className={event.type === 'js_error' ? 'is-error' : ''}>
                <span className="an-feed__time">{toFa(new Date(event.ts).toLocaleTimeString('fa-IR'))}</span>
                <span className="an-feed__type">{TYPE_LABELS[event.type] ?? event.type}</span>
                <span className="an-feed__path an-path">{event.path}</span>
                <span className="an-feed__meta">{event.device ?? '—'} · {event.source ?? '—'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Notice tone="info">
            هنوز رویدادی ثبت نشده است. با بازدید کاربران از سایت، این فهرست زنده پر می‌شود.
          </Notice>
        )}
      </Panel>
    </div>
  );
}
