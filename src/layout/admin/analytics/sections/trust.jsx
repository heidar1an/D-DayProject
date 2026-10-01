/*
 * بخش‌های «سئو»، «امنیت»، «درآمد» و «هشدارها».
 *
 * دو بخش اول کاملاً روی دادهٔ واقعی پروژه کار می‌کنند (بازرسی درون‌صفحه‌ای محتوا
 * و بازرسی امنیتی سرور). بخش درآمد صادقانه اعلام می‌کند که درگاه پرداخت وصل
 * نیست و هیچ عددی نشان نمی‌دهد. بخش هشدارها قواعد پایش را مدیریت می‌کند.
 */

import { useState } from 'react';

import {
  DataTable, Donut, HBarList, KpiCard, MiniStat, NeedsConnection, Notice, Panel,
  ScoreCard, SectionHero, SeverityBadge, StatusPill, formatPercent, formatValue,
  faNumber, toFa,
} from '../analyticsKit';

const INVERTED = new Set(['issues', 'suspiciousIps', 'failed', 'unauthorized', 'rateLimit', 'position']);

/* ─────────────────────────── سئو ─────────────────────────── */

export function SeoSection({ data }) {
  const health = data.health ?? [];
  const keywords = data.keywords ?? {};
  const organicPages = data.organicPages ?? {};
  const technical = data.technical ?? {};

  const issues = health.filter((item) => item.count > 0);

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="سئو"
        title="آیا در گوگل پیدا می‌شویم؟"
        description="بازرسی درون‌صفحه‌ای روی محتوای واقعی CMS انجام می‌شود. دادهٔ کلیک و رتبه نیازمند اتصال Google Search Console است."
      />

      <div className="an-split an-split--narrow">
        <Panel title="امتیاز سلامت سئو" description="بر پایهٔ بازرسی واقعی محتوا">
          <ScoreCard
            score={data.kpis?.find((kpi) => kpi.key === 'seoScore')?.value ?? 0}
            label="از ۱۰۰"
            tone={(data.kpis?.find((kpi) => kpi.key === 'seoScore')?.value ?? 0) >= 80 ? 'good' : 'warn'}
            caption={`${toFa(issues.length)} مشکل در ${toFa(data.contentAudit?.length ?? 0)} محتوا`}
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

      <Panel
        title="مشکلات یافت‌شده"
        description="هر مورد از بازرسی خودکار عنوان، توضیح متا، طول محتوا، لینک داخلی و تصویر به‌دست آمده"
        tone={issues.some((item) => item.severity === 'high') ? 'warn' : undefined}
      >
        {issues.length ? (
          <ul className="an-seo-issues">
            {issues.map((item) => (
              <li key={item.code} className={`is-${item.severity}`}>
                <div className="an-seo-issues__head">
                  <SeverityBadge severity={item.severity} />
                  <strong>{item.label}</strong>
                  <span className="an-seo-issues__count">{faNumber(item.count)} مورد</span>
                </div>
                <p className="an-muted">{item.hint}</p>
                {item.items?.length ? (
                  <ul className="an-plain an-plain--tight">
                    {item.items.slice(0, 6).map((entry, index) => (
                      <li key={index}>
                        <span className="an-path">{entry.title ?? entry.slug ?? String(entry)}</span>
                      </li>
                    ))}
                    {item.items.length > 6 ? <li className="an-muted">و {faNumber(item.items.length - 6)} مورد دیگر…</li> : null}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Notice tone="good">هیچ مشکل سئویی در محتوای فعلی پیدا نشد.</Notice>
        )}
      </Panel>

      <Panel title="بازرسی محتوا" description="وضعیت سئوی هر صفحه — عنوان، توضیح، طول متن و لینک داخلی">
        <DataTable
          rows={data.contentAudit ?? []}
          initialSort={{ key: 'wordCount', dir: 'asc' }}
          columns={[
            { key: 'title', label: 'عنوان', render: (row) => <span className="an-path" title={row.title}>{row.title}</span> },
            { key: 'kind', label: 'نوع', render: (row) => ({ article: 'مقاله', page: 'صفحه' }[row.kind] ?? row.kind) },
            {
              key: 'titleLength',
              label: 'طول عنوان',
              align: 'end',
              render: (row) => (
                <span className={row.titleLength === 0 ? 'an-bad' : row.titleLength > 60 ? 'an-warn' : ''}>
                  {row.titleLength === 0 ? 'ندارد' : toFa(row.titleLength)}
                </span>
              ),
            },
            {
              key: 'descriptionLength',
              label: 'توضیح متا',
              align: 'end',
              render: (row) => (
                <span className={row.descriptionLength === 0 ? 'an-bad' : row.descriptionLength > 160 ? 'an-warn' : ''}>
                  {row.descriptionLength === 0 ? 'ندارد' : toFa(row.descriptionLength)}
                </span>
              ),
            },
            {
              key: 'wordCount',
              label: 'تعداد کلمه',
              align: 'end',
              render: (row) => (
                <span className={row.wordCount < 300 ? 'an-warn' : ''}>{faNumber(row.wordCount)}</span>
              ),
            },
            {
              key: 'internalLinks',
              label: 'لینک داخلی',
              align: 'end',
              render: (row) => (
                <span className={row.internalLinks === 0 ? 'an-bad' : ''}>{faNumber(row.internalLinks)}</span>
              ),
            },
            { key: 'views', label: 'بازدید', align: 'end' },
          ]}
        />
      </Panel>

      <div className="an-split">
        <Panel title="بررسی فنی سئو">
          {technical.connected ? (
            <p className="an-muted">بررسی فنی فعال است.</p>
          ) : (
            <>
              <ul className="an-checks an-checks--plain">
                {(technical.checks ?? []).map((check) => (
                  <li key={check.label} className={`is-${check.status}`}>
                    <span className="an-checks__dot" aria-hidden="true" />
                    <strong>{check.label}</strong>
                    <span className="an-checks__detail">{check.hint}</span>
                    <span className="an-checks__state">{check.status === 'unknown' ? 'نامشخص' : check.status}</span>
                  </li>
                ))}
              </ul>
              <NeedsConnection compact title="بررسی فنی نیازمند Crawl است" note={technical.note} />
            </>
          )}
        </Panel>

        <Panel title="کلمات کلیدی">
          {keywords.connected ? (
            <DataTable
              rows={keywords.top ?? []}
              columns={[
                { key: 'query', label: 'کلمه' },
                { key: 'clicks', label: 'کلیک', align: 'end' },
                { key: 'impressions', label: 'نمایش', align: 'end' },
                { key: 'ctr', label: 'CTR', align: 'end', render: (row) => formatPercent(row.ctr) },
                { key: 'position', label: 'رتبه', align: 'end', render: (row) => formatValue(row.position, 1) },
              ]}
            />
          ) : (
            <NeedsConnection
              title="دادهٔ کلمات کلیدی در دسترس نیست"
              requires={data.requires?.searchConsole}
              note={keywords.note}
            />
          )}
        </Panel>
      </div>

      <Panel title="عملکرد ارگانیک صفحات">
        {organicPages.connected ? (
          <DataTable
            rows={organicPages.topClicks ?? []}
            columns={[
              { key: 'page', label: 'صفحه' },
              { key: 'clicks', label: 'کلیک', align: 'end' },
              { key: 'impressions', label: 'نمایش', align: 'end' },
            ]}
          />
        ) : (
          <NeedsConnection
            title="عملکرد ارگانیک هر صفحه در دسترس نیست"
            requires={data.requires?.searchConsole}
            note={organicPages.note}
          />
        )}
      </Panel>
    </div>
  );
}

/* ─────────────────────────── امنیت ─────────────────────────── */

export function SecuritySection({ data }) {
  const headers = data.headers ?? [];
  const hardening = data.hardening ?? [];
  const rateLimit = data.rateLimit ?? {};
  const audit = data.audit ?? {};

  const missingHeaders = headers.filter((header) => header.status === 'missing');
  const conditionalHeaders = headers.filter((header) => header.status === 'conditional');

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="امنیت"
        title="آیا پلتفرم و دادهٔ دانشجویان امن است؟"
        description={data.note}
      />

      <div className="an-split an-split--narrow">
        <Panel title="وضعیت کنترل‌های قابل‌بررسی" description="امتیاز کلی امنیت محاسبه نمی‌شود تا دادهٔ ناقص به‌صورت نمرهٔ قطعی نمایش داده نشود.">
          <div className="an-kpi-grid an-kpi-grid--tight">
            <MiniStat label="فعال" value={faNumber(data.scoreBreakdown?.active ?? 0)} tone="good" />
            <MiniStat label="شرطی با محیط" value={faNumber(data.scoreBreakdown?.conditional ?? 0)} tone={conditionalHeaders.length ? 'warn' : 'neutral'} />
            <MiniStat label="غایب" value={faNumber(data.scoreBreakdown?.missing ?? 0)} tone={missingHeaders.length ? 'critical' : 'good'} />
          </div>
          <Notice tone="info">این شمارش فقط وضعیت چند کنترل شناخته‌شده را نشان می‌دهد؛ جایگزین ممیزی امنیتی یا اثبات «امنیت ۱۰۰٪» نیست.</Notice>
        </Panel>

        <Panel title="سنجه‌های امنیتی" className="an-span-2">
          <div className="an-kpi-grid">
            {(data.kpis ?? []).map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} invert={INVERTED.has(kpi.key)} compact />
            ))}
          </div>
        </Panel>
      </div>

      <div className="an-split">
        <Panel title="هدرهای امنیتی HTTP" description="وضعیت واقعی پاسخ‌های API">
          <ul className="an-checks an-checks--plain">
            {headers.map((header) => (
              <li key={header.key} className={header.status === 'active' ? 'is-healthy' : 'is-warn'}>
                <span className="an-checks__dot" aria-hidden="true" />
                <strong>{header.label}</strong>
                <span className="an-checks__detail">{header.value ?? header.hint}</span>
                <span className="an-checks__state">{{ active: 'فعال', conditional: 'مشروط', missing: 'غایب' }[header.status] ?? 'نامشخص'}</span>
              </li>
            ))}
          </ul>
          {missingHeaders.length ? (
            <Notice tone="warn">
              {toFa(missingHeaders.length)} هدر امنیتی تنظیم نشده است: {missingHeaders.map((header) => header.label).join('، ')}.
              این هدرها در محیط پروداکشن باید روی وب‌سرور (nginx/CDN) تنظیم شوند.
            </Notice>
          ) : null}
        </Panel>

        <Panel title="سخت‌سازی" description="کنترل‌های امنیتی پیاده‌شده در کد">
          <ul className="an-checks an-checks--plain">
            {hardening.map((item) => (
                <li key={item.label} className={item.status === 'active' ? 'is-healthy' : 'is-warn'}>
                  <span className="an-checks__dot" aria-hidden="true" />
                  <strong>{item.label}</strong>
                  <span className="an-checks__state">{{ active: 'فعال', conditional: 'مشروط', missing: 'ندارد' }[item.status] ?? 'نامشخص'}</span>
                </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="an-split an-split--thirds">
        <Panel title="محدودیت نرخ" description={`حد ${faNumber(rateLimit.limit ?? 0)} درخواست در ${toFa(rateLimit.windowSeconds ?? 0)} ثانیه`}>
          <div className="an-kpi-grid an-kpi-grid--tight">
            <MiniStat label="نقض ثبت‌شده" value={faNumber(rateLimit.violations ?? 0)} tone={rateLimit.violations ? 'warn' : 'good'} />
          </div>
          <HBarList
            rows={(rateLimit.topIps ?? []).map((item) => ({ key: item.ip, label: item.ip, value: item.count }))}
            emptyLabel="هیچ IP از حد مجاز عبور نکرده"
          />
        </Panel>

        <Panel title="IPهای دارای تلاش ناموفق" description="تکرار خطای ورود فقط نیازمند بررسی است؛ این گزارش IP را مسدود نمی‌کند.">
          <HBarList
            rows={(data.suspicious ?? []).map((item) => ({
              key: item.ip,
              label: `${item.ip}${item.reviewRecommended ? ' (نیازمند بررسی)' : ''}`,
              value: item.count,
              color: item.reviewRecommended ? 'var(--ad-red)' : 'var(--ad-gold)',
            }))}
            emptyLabel="تلاش ناموفقی در audit log ثبت نشده"
          />
        </Panel>

        <Panel title="خلاصهٔ گزارش رویداد" description="فعالیت‌های حساس پنل">
          <div className="an-kpi-grid an-kpi-grid--tight">
            <MiniStat label="کل رکورد" value={faNumber(audit.total ?? 0)} />
            <MiniStat label="ورود ناموفق" value={faNumber((data.failedLogins ?? []).length)} tone={(data.failedLogins ?? []).length ? 'warn' : 'good'} />
          </div>
        </Panel>
      </div>

      <Panel title="ورودهای ناموفق" description="تلاش‌های ناموفق ورود به پنل مدیریت" tone={data.failedLogins?.length ? 'warn' : undefined}>
        <DataTable
          rows={data.failedLogins ?? []}
          initialSort={{ key: 'createdAt', dir: 'desc' }}
          columns={[
            { key: 'entityLabel', label: 'نام کاربری تلاش‌شده' },
            { key: 'ip', label: 'IP' },
            {
              key: 'metadata',
              label: 'دلیل',
              render: (row) => ({ 'invalid-credentials': 'رمز نادرست', locked: 'قفل موقت' }[row.metadata?.reason] ?? row.metadata?.reason ?? '—'),
            },
            { key: 'createdAt', label: 'زمان', render: (row) => toFa(new Date(row.createdAt).toLocaleString('fa-IR')) },
          ]}
          emptyLabel="ورود ناموفقی ثبت نشده است"
        />
      </Panel>

      <Panel title="گزارش رویدادهای پنل" description="چه کسی چه تغییری داده است">
        <DataTable
          rows={audit.entries ?? []}
          initialSort={{ key: 'createdAt', dir: 'desc' }}
          columns={[
            { key: 'user', label: 'کاربر' },
            { key: 'action', label: 'عملیات' },
            { key: 'resource', label: 'منبع' },
            { key: 'result', label: 'نتیجه', render: (row) => (row.result === 'success' ? 'موفق' : 'ناموفق') },
            { key: 'ip', label: 'IP' },
            { key: 'createdAt', label: 'زمان', render: (row) => toFa(new Date(row.createdAt).toLocaleString('fa-IR')) },
          ]}
          emptyLabel="رکوردی ثبت نشده"
        />
      </Panel>
    </div>
  );
}

/* ─────────────────────────── درآمد ─────────────────────────── */

export function RevenueSection({ data }) {
  if (!data.connected) {
    return (
      <div className="an-section">
        <SectionHero
          eyebrow="درآمد"
          title="درآمد"
          description="این بخش تا اتصال درگاه پرداخت هیچ عددی نشان نمی‌دهد."
        />

        <NeedsConnection
          title="سیستم پرداخت وصل نیست"
          requires={data.requires}
          note={data.note}
          items={data.willShow}
        />

        <Panel title="سنجه‌هایی که پس از اتصال فعال می‌شوند" description="ساختار آماده است؛ فقط منبع داده لازم است">
          <div className="an-kpi-grid">
            {(data.kpis ?? []).map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} compact />
            ))}
          </div>
        </Panel>

        <Panel title="وضعیت دادهٔ خرید">
          <div className="an-kpi-grid an-kpi-grid--tight">
            <MiniStat
              label="رویداد خرید ثبت‌شده"
              value={faNumber(data.purchaseEventsSeen ?? 0)}
              tone={data.purchaseEventsSeen ? 'good' : 'neutral'}
              hint="رویداد purchase از سمت سایت"
            />
          </div>
          <Notice tone="info">
            اگر رویداد <code>purchase</code> از سایت ارسال شود، شمارش خریدها فعال می‌شود؛ اما مبلغ،
            مالیات، بازگشت وجه و روش پرداخت فقط از درگاه پرداخت قابل خواندن است.
          </Notice>
        </Panel>
      </div>
    );
  }

  return (
    <div className="an-section">
      <SectionHero eyebrow="درآمد" title="درآمد و فروش" />

      <div className="an-kpi-grid">
        {(data.kpis ?? []).map((kpi) => <KpiCard key={kpi.key} kpi={kpi} />)}
      </div>

      <Panel title="فروش به تفکیک محصول">
        <DataTable
          rows={data.byProduct ?? []}
          columns={[
            { key: 'label', label: 'محصول' },
            { key: 'revenue', label: 'درآمد', align: 'end' },
            { key: 'purchases', label: 'خرید', align: 'end' },
          ]}
        />
      </Panel>

      <div className="an-split">
        <Panel title="روش پرداخت">
          <Donut
            slices={(data.byPaymentMethod ?? []).map((item) => ({ key: item.key, label: item.label ?? item.key, value: item.count ?? item.revenue }))}
            centerLabel="خرید"
          />
        </Panel>
        <Panel title="پلن‌ها">
          <HBarList rows={(data.byPlan ?? []).map((item) => ({ key: item.key, label: item.label ?? item.key, value: item.revenue ?? item.count }))} />
        </Panel>
      </div>
    </div>
  );
}

/* ─────────────────────────── هشدارها ─────────────────────────── */

const EMPTY_DRAFT = {
  name: '', metric: 'page_views', comparator: 'below', threshold: 0,
  severity: 'high', enabled: true, channel: 'panel', windowHours: 24,
};

export function AlertsSection({ data, onSave, onDelete, busy }) {
  const [draft, setDraft] = useState(null);
  const metrics = data.metrics ?? [];
  const alerts = data.alerts ?? [];
  const notifications = data.notifications ?? {};

  const metricById = Object.fromEntries(metrics.map((metric) => [metric.id, metric]));

  const submit = async (event) => {
    event.preventDefault();
    if (!draft) return;

    const payload = {
      ...draft,
      threshold: Number(draft.threshold) || 0,
      windowHours: Number(draft.windowHours) || 24,
    };

    const done = await onSave(payload, draft.id ?? null);
    if (done) setDraft(null);
  };

  return (
    <div className="an-section">
      <SectionHero
        eyebrow="هشدارها"
        title="اگر چیزی خراب شد، زود بفهمیم"
        description="قواعد پایش روی سنجه‌های واقعی سنجیده می‌شوند. ارسال به ایمیل و تلگرام نیازمند اتصال کانال است."
        actions={(
          <button type="button" className="an-btn an-btn--primary" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            هشدار جدید
          </button>
        )}
      />

      <div className="an-kpi-grid an-kpi-grid--tight">
        <MiniStat label="هشدار فعال" value={faNumber(data.active ?? 0)} tone="good" />
        <MiniStat label="در وضعیت هشدار" value={faNumber(data.triggered ?? 0)} tone={data.triggered ? 'critical' : 'neutral'} />
        <MiniStat label="سنجهٔ بدون داده" value={faNumber(data.unavailable ?? 0)} tone="warn" hint="سنجه‌هایی که منبع داده‌شان وصل نیست" />
      </div>

      {draft ? (
        <Panel title={draft.id ? 'ویرایش هشدار' : 'هشدار جدید'} className="an-form-panel">
          <form className="an-form" onSubmit={submit}>
            <label className="an-field">
              <span>نام هشدار</span>
              <input
                type="text"
                value={draft.name}
                required
                maxLength={80}
                placeholder="مثلاً: افت شدید بازدید"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>

            <label className="an-field">
              <span>سنجه</span>
              <select value={draft.metric} onChange={(event) => setDraft({ ...draft, metric: event.target.value })}>
                {metrics.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.label}{metric.available ? '' : ' (منبع داده وصل نیست)'}
                  </option>
                ))}
              </select>
            </label>

            <label className="an-field">
              <span>شرط</span>
              <select value={draft.comparator} onChange={(event) => setDraft({ ...draft, comparator: event.target.value })}>
                <option value="above">بیشتر از</option>
                <option value="below">کمتر از</option>
              </select>
            </label>

            <label className="an-field">
              <span>آستانه {metricById[draft.metric]?.unit ? `(${metricById[draft.metric].unit})` : ''}</span>
              <input
                type="number"
                step="any"
                value={draft.threshold}
                required
                onChange={(event) => setDraft({ ...draft, threshold: event.target.value })}
              />
            </label>

            <label className="an-field">
              <span>شدت</span>
              <select value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value })}>
                <option value="critical">بحرانی</option>
                <option value="high">بالا</option>
                <option value="medium">متوسط</option>
                <option value="low">پایین</option>
              </select>
            </label>

            <label className="an-field">
              <span>بازهٔ سنجش (ساعت)</span>
              <input
                type="number"
                min="1"
                max="720"
                value={draft.windowHours}
                onChange={(event) => setDraft({ ...draft, windowHours: event.target.value })}
              />
            </label>

            <label className="an-field">
              <span>کانال اطلاع‌رسانی</span>
              <select value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value })}>
                {(notifications.channels ?? [{ id: 'panel', label: 'پنل مدیریت', connected: true }]).map((channel) => (
                  <option key={channel.id} value={channel.id} disabled={!channel.connected}>
                    {channel.label}{channel.connected ? '' : ' — وصل نیست'}
                  </option>
                ))}
              </select>
            </label>

            <label className="an-field an-field--check">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              />
              <span>فعال باشد</span>
            </label>

            <div className="an-form__actions">
              <button type="submit" className="an-btn an-btn--primary" disabled={busy}>
                {busy ? 'در حال ذخیره…' : draft.id ? 'ذخیرهٔ تغییرات' : 'ساخت هشدار'}
              </button>
              <button type="button" className="an-btn" onClick={() => setDraft(null)}>انصراف</button>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel title="قواعد پایش" description="هر قاعده در هر بازخوانی روی مقدار واقعی سنجه سنجیده می‌شود">
        {alerts.length ? (
          <ul className="an-alerts">
            {alerts.map((alert) => (
              <li key={alert.id} className={`an-alert ${alert.triggered ? 'is-triggered' : ''} ${alert.enabled ? '' : 'is-off'}`}>
                <div className="an-alert__head">
                  <SeverityBadge severity={alert.severity} />
                  <strong>{alert.name}</strong>
                  {alert.isDefault ? <span className="an-alert__default">پیش‌فرض</span> : null}
                  {alert.triggered ? <span className="an-alert__flag">در وضعیت هشدار</span> : null}
                  <span className="an-alert__spacer" />
                  <StatusPill status={alert.enabled ? 'good' : 'neutral'} label={alert.enabled ? 'فعال' : 'خاموش'} />
                </div>

                <p className="an-alert__rule">
                  اگر <b>{alert.metricLabel}</b> {alert.comparator === 'above' ? 'بیشتر از' : 'کمتر از'}{' '}
                  <b>{faNumber(alert.threshold)}{alert.unit}</b> شود
                  {alert.windowHours ? ` (در ${toFa(alert.windowHours)} ساعت)` : ''} هشدار بده.
                </p>

                <div className="an-alert__state">
                  <span>مقدار فعلی: <b>{alert.available ? `${formatValue(alert.currentValue)}${alert.unit}` : '—'}</b></span>
                  {alert.trend !== null && alert.trend !== undefined ? (
                    <span>روند: <b>{toFa(Number(alert.trend).toFixed(1))}٪</b></span>
                  ) : null}
                  <span className="an-muted">{alert.description}</span>
                </div>

                {!alert.available ? (
                  <Notice tone="info">
                    منبع دادهٔ این سنجه وصل نیست{alert.requires ? ` — نیازمند ${alert.requires}` : ''}؛ تا آن زمان هشدار ارزیابی نمی‌شود.
                  </Notice>
                ) : null}

                <div className="an-alert__actions">
                  <button
                    type="button"
                    className="an-linkbtn"
                    onClick={() => setDraft({
                      id: alert.id,
                      name: alert.name,
                      metric: alert.metric,
                      comparator: alert.comparator,
                      threshold: alert.threshold,
                      severity: alert.severity,
                      enabled: alert.enabled,
                      channel: alert.channel,
                      windowHours: alert.windowHours,
                    })}
                  >
                    ویرایش
                  </button>
                  <button
                    type="button"
                    className="an-linkbtn"
                    disabled={busy}
                    onClick={() => onSave({ ...alert, enabled: !alert.enabled }, alert.id)}
                  >
                    {alert.enabled ? 'خاموش کن' : 'روشن کن'}
                  </button>
                  <button type="button" className="an-linkbtn an-linkbtn--danger" disabled={busy} onClick={() => onDelete(alert.id)}>
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="an-muted">هیچ هشداری تعریف نشده است.</p>
        )}
      </Panel>

      <Panel title="کانال‌های اطلاع‌رسانی">
        <ul className="an-channels">
          {(notifications.channels ?? []).map((channel) => (
            <li key={channel.id} className={channel.connected ? 'is-on' : 'is-off'}>
              <span className="an-sources__dot" aria-hidden="true" />
              <strong>{channel.label}</strong>
              <span className="an-sources__state">{channel.connected ? 'وصل' : 'وصل نیست'}</span>
              {channel.requires ? <code className="an-needs__key">{channel.requires}</code> : null}
            </li>
          ))}
        </ul>
        {!notifications.connected ? (
          <NeedsConnection
            compact
            title="ارسال خودکار هشدار به بیرون پنل ممکن نیست"
            requires={notifications.requires}
            note="بدون این اتصال، هشدارها فقط داخل پنل دیده می‌شوند. ایمیل و تلگرام به‌محض تنظیم متغیرهای محیطی فعال می‌شوند."
          />
        ) : null}
      </Panel>
    </div>
  );
}
