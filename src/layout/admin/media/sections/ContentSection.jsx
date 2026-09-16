/*
 * مدیریت محتوا — فهرست، تختهٔ گردش کار، سازنده و تحلیل هر محتوا.
 *
 * سه نما روی یک دادهٔ واحد:
 *   • «فهرست» — جدول با فیلتر و صفحه‌بندی، برای کار روزمره.
 *   • «گردش کار» — تختهٔ کشیدنی بین وضعیت‌ها؛ فقط گذارهای مجاز سرور را می‌پذیرد.
 *   • «سازنده» — فرم + پیش‌نمایش سمت سرور.
 *
 * هر اقدام (تأیید، درخواست اصلاح، انتشار، تلاش دوباره) نتیجهٔ سرور را نشان
 * می‌دهد؛ خطا بی‌صدا رد نمی‌شود.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { mediaCenter } from '../../../../services/admin/adminService';
import { Button, ConfirmDialog, Field, Input, Modal, Textarea, useToast } from '../../adminShared';
import { IconEdit, IconPlus, IconTrash, IconWarning } from '../../adminIcons';
import ContentComposer from '../ContentComposer';
import {
  DataTable, DebouncedInput, Empty, ErrorBlock, Kpi, Panel, Picker, Pill,
  SectionTitle, SkeletonCards, STATUS_LABEL, STATUS_TONE, clockTime, faDate, fmt,
  labelOf, pct, ratio, relativeTime, toFa, useLoader,
} from '../mediaKit';

/* ستون‌های تختهٔ گردش کار — همان وضعیت‌های پرامپت */
const BOARD = ['draft', 'review', 'approved', 'scheduled', 'published', 'failed'];

const WORKFLOW_ACTIONS = {
  draft: [{ id: 'submit', label: 'ارسال برای بررسی' }],
  review: [
    { id: 'approve', label: 'تأیید' },
    { id: 'revision', label: 'درخواست اصلاح', tone: 'danger' },
  ],
  approved: [{ id: 'schedule', label: 'زمان‌بندی' }],
  scheduled: [{ id: 'publish', label: 'انتشار' }, { id: 'draft', label: 'بازگشت به پیش‌نویس' }],
  failed: [{ id: 'retry', label: 'تلاش دوباره' }],
  published: [{ id: 'archive', label: 'آرشیو' }],
  cancelled: [{ id: 'draft', label: 'بازگشت به پیش‌نویس' }],
  archived: [{ id: 'draft', label: 'بازگشت به پیش‌نویس' }],
};

export default function ContentSection({ config, admin, refresh, intent, clearIntent, openTab }) {
  const notify = useToast();

  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [campaignId, setCampaignId] = useState('all');
  const [contentType, setContentType] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [composing, setComposing] = useState(false);
  const [analyticsFor, setAnalyticsFor] = useState(null);
  const [scheduleFor, setScheduleFor] = useState(null);
  const [revisionFor, setRevisionFor] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dropCol, setDropCol] = useState(null);

  /* ─── داده‌های پشتیبان ─── */
  const accounts = useLoader(() => mediaCenter.accounts({}), []);
  const campaigns = useLoader(() => mediaCenter.campaigns({}), []);
  const tags = useLoader(() => mediaCenter.tags({}), []);
  const team = useLoader(() => mediaCenter.team({}), []);

  const list = useLoader(
    () => mediaCenter.contents({ status, platform, campaignId, contentType, search, page, perPage: 20 }),
    [status, platform, campaignId, contentType, search, page],
  );

  const board = useLoader(
    () => mediaCenter.contents({ status: 'all', platform, search, page: 1, perPage: 200 }),
    [platform, search, view],
  );

  /*
   * اقدام‌های سریع («ساخت محتوا») و جست‌وجوی مرکزی از اینجا کنترل می‌شوند.
   * در effect انجام می‌شود تا تغییر state والد در رندر فرزند رخ ندهد.
   */
  useEffect(() => {
    if (!intent?.action) return;

    if (intent.action === 'compose') {
      setEditing(null);
      setComposing(true);
      setView('compose');
    } else if (intent.action === 'open' && intent.id) {
      setEditing({ id: intent.id });
      setComposing(true);
      setView('compose');
    }

    clearIntent?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.nonce]);

  const reloadAll = useCallback(() => {
    list.reload();
    board.reload();
  }, [list, board]);

  const rows = list.data?.items ?? [];
  const boardRows = board.data?.items ?? [];

  const grouped = useMemo(() => {
    const map = new Map();
    BOARD.forEach((id) => map.set(id, []));
    boardRows.forEach((row) => {
      if (!map.has(row.status)) map.set(row.status, []);
      map.get(row.status).push(row);
    });
    return map;
  }, [boardRows]);

  /* ─── اقدام‌ها ─── */

  const run = async (action, row, payload) => {
    setBusy(true);
    try {
      if (action === 'submit') await mediaCenter.submitContent(row.id, {});
      else if (action === 'approve') await mediaCenter.approveContent(row.id, 'تأیید شد');
      else if (action === 'revision') await mediaCenter.requestRevision(row.id, payload);
      else if (action === 'schedule') await mediaCenter.scheduleContent(row.id, payload.scheduledAt, 'زمان‌بندی شد');
      else if (action === 'publish') {
        const result = await mediaCenter.publishContent(row.id, false);
        const outcome = result?.result ?? result;
        if (outcome?.dryRun) notify('آزمایشی ثبت شد — کلید API موجود نیست، درخواستی به بیرون نرفت');
        else if (outcome?.ok === false) notify(outcome?.message ?? 'انتشار ناموفق بود');
        else notify('منتشر شد');
      } else if (action === 'retry') await mediaCenter.retryContent(row.id);
      else if (action === 'archive') await mediaCenter.setContentStatus(row.id, 'archived');
      else if (action === 'draft') await mediaCenter.setContentStatus(row.id, 'draft');
      else if (action === 'status') await mediaCenter.setContentStatus(row.id, payload.status, payload.note);

      if (!['publish'].includes(action)) notify('انجام شد');
      setRevisionFor(null);
      setScheduleFor(null);
      reloadAll();
      refresh?.();
    } catch (err) {
      notify(err?.message ?? 'انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await mediaCenter.removeContent(pendingDelete.id);
      notify('محتوا حذف شد');
      setPendingDelete(null);
      reloadAll();
      refresh?.();
    } catch (err) {
      notify(err?.message ?? 'حذف نشد');
    } finally {
      setBusy(false);
    }
  };

  /* ─── کشیدن روی تخته ─── */

  const dropOn = async (nextStatus) => {
    setDropCol(null);
    if (!dragId) return;
    const row = boardRows.find((item) => item.id === dragId);
    setDragId(null);
    if (!row || row.status === nextStatus) return;

    setBusy(true);
    try {
      await mediaCenter.setContentStatus(row.id, nextStatus, 'جابه‌جایی روی تختهٔ گردش کار');
      notify('وضعیت تغییر کرد');
      reloadAll();
    } catch (err) {
      notify(err?.message ?? 'این گذار مجاز نیست');
    } finally {
      setBusy(false);
    }
  };

  if (list.error && !list.data && view !== 'compose') return <ErrorBlock error={list.error} onRetry={list.reload} />;

  /* ─── سازنده ─── */
  if (view === 'compose') {
    return (
      <>
        <ContentComposer
          config={config}
          accounts={accounts.data?.accounts ?? []}
          campaigns={campaigns.data?.campaigns ?? []}
          tags={tags.data?.tags ?? []}
          team={team.data?.team ?? []}
          admin={admin}
          content={editing?.id ? (list.data?.items ?? []).find((row) => row.id === editing.id) ?? null : null}
          onClose={() => { setComposing(false); setEditing(null); setView('list'); }}
          onSaved={(saved, kind) => {
            notify(kind === 'published' ? 'انتشار انجام شد' : kind === 'scheduled' ? 'زمان‌بندی شد' : 'ذخیره شد');
            setComposing(false);
            setEditing(null);
            setView('list');
            reloadAll();
            refresh?.();
          }}
        />
        {editing?.id ? <ContentAnalytics contentId={editing.id} config={config} /> : null}
      </>
    );
  }

  return (
    <>
      <SectionTitle title="مدیریت محتوا" hint="فهرست، گردش کار تأیید و انتشار" />

      <div className="mc-kpis">
        <Kpi label="کل محتوا" value={list.data?.total ?? null} hint="با فیلترهای فعلی" />
        <Kpi label="در انتظار بررسی" value={grouped.get('review')?.length ?? null} onClick={() => { setStatus('review'); setView('list'); }} />
        <Kpi label="تأییدشده" value={grouped.get('approved')?.length ?? null} />
        <Kpi label="زمان‌بندی‌شده" value={grouped.get('scheduled')?.length ?? null} onClick={() => openTab('queue')} />
        <Kpi label="منتشرشده" value={grouped.get('published')?.length ?? null} />
        <Kpi
          label="ناموفق"
          value={grouped.get('failed')?.length ?? null}
          hint={grouped.get('failed')?.length ? 'نیازمند تلاش دوباره' : 'موردی نیست'}
        />
      </div>

      <Panel
        title="محتواها"
        description={`${toFa(list.data?.total ?? 0)} مورد`}
        actions={(
          <>
            <div className="mc-cal__view">
              <button type="button" className={`mc-range ${view === 'list' ? 'is-active' : ''}`} onClick={() => setView('list')}>فهرست</button>
              <button type="button" className={`mc-range ${view === 'board' ? 'is-active' : ''}`} onClick={() => setView('board')}>گردش کار</button>
            </div>
            <Button size="sm" onClick={() => { setEditing(null); setComposing(true); setView('compose'); }}>
              <IconPlus width={14} height={14} />
              محتوای جدید
            </Button>
          </>
        )}
        flush
      >
        <div className="mc-filters">
          <DebouncedInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="جست‌وجو در عنوان و متن…" />
          <Picker value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={config.contentStatuses} allLabel="همهٔ وضعیت‌ها" />
          <Picker value={platform} onChange={(value) => { setPlatform(value); setPage(1); }} options={config.platforms} allLabel="همهٔ پلتفرم‌ها" />
          <Picker value={contentType} onChange={(value) => { setContentType(value); setPage(1); }} options={config.contentTypes} allLabel="همهٔ انواع" />
          <Picker value={campaignId} onChange={(value) => { setCampaignId(value); setPage(1); }} options={campaigns.data?.campaigns ?? []} allLabel="همهٔ کمپین‌ها" />
        </div>

        {/* ─── فهرست ─── */}
        {view === 'list' ? (
          list.loading && !list.data ? <SkeletonCards count={4} /> : (
            <>
              <DataTable
                head={['عنوان', 'پلتفرم / اکانت', 'نوع', 'وضعیت', 'زمان', 'تعامل', 'اقدام']}
                empty={<Empty title="محتوایی پیدا نشد" description="فیلترها را بازتر کنید یا محتوای تازه بسازید." />}
              >
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.title}</strong>
                      <small>{row.campaignName || 'بدون کمپین'}</small>
                    </td>
                    <td>
                      {row.platformLabel}
                      <small>{row.accountName || '—'}</small>
                    </td>
                    <td>{labelOf(config.contentTypes, row.contentType)}</td>
                    <td>
                      <Pill tone={STATUS_TONE(config.contentStatuses, row.status)} dot>
                        {STATUS_LABEL(config.contentStatuses, row.status)}
                      </Pill>
                      {row.rejection ? <small className="mc-muted">اصلاح خواسته شده</small> : null}
                    </td>
                    <td>
                      {row.scheduledAt ? (
                        <>
                          <span>{faDate(row.scheduledAt)}</span>
                          <small>{clockTime(row.scheduledAt)} — {relativeTime(row.scheduledAt)}</small>
                        </>
                      ) : row.publishedAt ? (
                        <>
                          <span>{faDate(row.publishedAt)}</span>
                          <small>{relativeTime(row.publishedAt)}</small>
                        </>
                      ) : <span className="mc-muted">—</span>}
                    </td>
                    <td className="mc-table__num">
                      {row.engagementRate === null || row.engagementRate === undefined
                        ? <span className="mc-muted">—</span>
                        : <>
                          <span>{pct(row.engagementRate)}</span>
                          <small>Reach {fmt(row.metrics?.reach, { compact: true })}</small>
                        </>}
                    </td>
                    <td>
                      <div className="mc-table__actions">
                        {(WORKFLOW_ACTIONS[row.status] ?? []).slice(0, 1).map((action) => (
                          <Button
                            key={action.id}
                            variant="ghost"
                            size="sm"
                            loading={busy}
                            onClick={() => {
                              if (action.id === 'revision') setRevisionFor(row);
                              else if (action.id === 'schedule') setScheduleFor(row);
                              else run(action.id, row, {});
                            }}
                          >
                            {action.label}
                          </Button>
                        ))}
                        <Button variant="ghost" size="sm" onClick={() => setAnalyticsFor(row.id)} title="تحلیل این محتوا">
                          تحلیل
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(row); setComposing(true); setView('compose'); }}>
                          <IconEdit width={14} height={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setPendingDelete(row)}>
                          <IconTrash width={14} height={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>

              {list.data?.pages > 1 ? (
                <div className="mc-row mc-row--between" style={{ padding: '0.8rem 1rem' }}>
                  <span className="mc-muted">
                    صفحهٔ {toFa(list.data.page)} از {toFa(list.data.pages)}
                  </span>
                  <span className="mc-row" style={{ gap: '0.35rem' }}>
                    <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>قبلی</Button>
                    <Button variant="ghost" size="sm" disabled={page >= list.data.pages} onClick={() => setPage((value) => value + 1)}>بعدی</Button>
                  </span>
                </div>
              ) : null}
            </>
          )
        ) : null}

        {/* ─── تختهٔ گردش کار ─── */}
        {view === 'board' ? (
          <div className="mc-kanban" style={{ padding: '0.8rem' }}>
            {BOARD.map((column) => {
              const columnRows = grouped.get(column) ?? [];
              return (
                <div
                  className={`mc-kanban__col ${dropCol === column ? 'is-drop' : ''}`}
                  key={column}
                  onDragOver={(event) => { event.preventDefault(); setDropCol(column); }}
                  onDragLeave={() => setDropCol((current) => (current === column ? null : current))}
                  onDrop={() => dropOn(column)}
                >
                  <div className="mc-kanban__head">
                    <span>{STATUS_LABEL(config.contentStatuses, column)}</span>
                    <span>{toFa(columnRows.length)}</span>
                  </div>

                  {columnRows.map((row) => (
                    <article
                      className={`mc-kanban__card ${dragId === row.id ? 'is-dragging' : ''}`}
                      key={row.id}
                      draggable
                      onDragStart={() => setDragId(row.id)}
                      onDragEnd={() => { setDragId(null); setDropCol(null); }}
                      onClick={() => { setEditing(row); setComposing(true); setView('compose'); }}
                    >
                      <strong>{row.title}</strong>
                      <small>{row.platformLabel} · {labelOf(config.contentTypes, row.contentType)}</small>
                      <div className="mc-row" style={{ gap: '0.3rem' }}>
                        {row.scheduledAt ? <Pill tone="blue">{faDate(row.scheduledAt)}</Pill> : null}
                        {row.engagementRate !== null && row.engagementRate !== undefined ? <Pill tone="ok">{pct(row.engagementRate)}</Pill> : null}
                        {row.rejection ? <Pill tone="danger">اصلاح</Pill> : null}
                      </div>
                    </article>
                  ))}

                  {!columnRows.length ? <p className="mc-muted" style={{ fontSize: '0.7rem' }}>خالی</p> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </Panel>

      {/* ─── تحلیل محتوای انتخابی ─── */}
      <Modal
        open={Boolean(analyticsFor)}
        title="تحلیل محتوا"
        subtitle="مقایسه با میانگین محتواهای مشابه همان پلتفرم و نوع"
        onClose={() => setAnalyticsFor(null)}
        size="lg"
        footer={<Button onClick={() => setAnalyticsFor(null)}>بستن</Button>}
      >
        {analyticsFor ? <ContentAnalytics contentId={analyticsFor} config={config} embedded /> : null}
      </Modal>

      {/* ─── درخواست اصلاح ─── */}
      <Modal
        open={Boolean(revisionFor)}
        title="درخواست اصلاح"
        onClose={() => setRevisionFor(null)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setRevisionFor(null)}>انصراف</Button>
            <Button onClick={() => run('revision', revisionFor, revisionFor.__form ?? { reason: 'نیاز به اصلاح', comment: '' })} loading={busy}>
              ثبت درخواست
            </Button>
          </>
        )}
      >
        {revisionFor ? (
          <div className="mc-form">
            <Field label="دلیل" required>
              <Input
                value={revisionFor.__form?.reason ?? ''}
                onChange={(event) => setRevisionFor((row) => ({ ...row, __form: { ...(row.__form ?? {}), reason: event.target.value } }))}
                placeholder="مثلاً: متن با لحن برند نمی‌خواند"
              />
            </Field>
            <div className="mc-form__full">
              <Field label="توضیح">
                <Textarea
                  rows={3}
                  value={revisionFor.__form?.comment ?? ''}
                  onChange={(event) => setRevisionFor((row) => ({ ...row, __form: { ...(row.__form ?? {}), comment: event.target.value } }))}
                />
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ─── زمان‌بندی ─── */}
      <Modal
        open={Boolean(scheduleFor)}
        title="زمان‌بندی انتشار"
        subtitle={scheduleFor?.title}
        onClose={() => setScheduleFor(null)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setScheduleFor(null)}>انصراف</Button>
            <Button
              onClick={() => run('schedule', scheduleFor, { scheduledAt: new Date(scheduleFor.__form?.at ?? Date.now()).toISOString() })}
              loading={busy}
            >
              زمان‌بندی
            </Button>
          </>
        )}
      >
        {scheduleFor ? (
          <Field label="تاریخ و ساعت" required hint="موتور زمان‌بند در تب «صف انتشار» قابل اجرای دستی است.">
            <Input
              type="datetime-local"
              value={scheduleFor.__form?.at ?? ''}
              onChange={(event) => setScheduleFor((row) => ({ ...row, __form: { ...(row.__form ?? {}), at: event.target.value } }))}
            />
          </Field>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف محتوا"
        message={`محتوا «${pendingDelete?.title ?? ''}» حذف شود؟ تاریخچهٔ گردش کار هم پاک می‌شود.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

/* ───────────────────────── تحلیل یک محتوا ───────────────────────── */

/*
 * «این محتوا ۲.۴ برابر میانگین Reach محتواهای مشابه گرفت» — این جمله فقط وقتی
 * نمایش داده می‌شود که واقعاً محتوای مشابهی برای مقایسه وجود داشته باشد.
 * در غیر این صورت صریح می‌گوید مبنای مقایسه نیست.
 */
function ContentAnalytics({ contentId, config, embedded = false }) {
  const { data, loading, error, reload } = useLoader(
    () => mediaCenter.contentAnalytics(contentId),
    [contentId],
  );

  if (error) return <ErrorBlock error={error} onRetry={reload} />;
  if (loading && !data) return <SkeletonCards count={3} />;
  if (!data) return null;

  const { content, peers } = data;
  const metrics = content.metrics ?? {};

  const body = (
    <>
      <div className="mc-summary-grid">
        <div className="mc-summary-cell"><span>Reach</span><strong>{fmt(metrics.reach)}</strong></div>
        <div className="mc-summary-cell"><span>Impressions</span><strong>{fmt(metrics.impressions)}</strong></div>
        <div className="mc-summary-cell"><span>بازدید</span><strong>{fmt(metrics.views)}</strong></div>
        <div className="mc-summary-cell"><span>پسندیدن</span><strong>{fmt(metrics.likes)}</strong></div>
        <div className="mc-summary-cell"><span>نظر</span><strong>{fmt(metrics.comments)}</strong></div>
        <div className="mc-summary-cell"><span>اشتراک</span><strong>{fmt(metrics.shares)}</strong></div>
        <div className="mc-summary-cell"><span>ذخیره</span><strong>{fmt(metrics.saves)}</strong></div>
        <div className="mc-summary-cell"><span>کلیک</span><strong>{fmt(metrics.clicks)}</strong></div>
        <div className="mc-summary-cell"><span>نرخ تعامل</span><strong>{pct(content.engagementRate)}</strong></div>
        <div className="mc-summary-cell"><span>دنبال‌کنندهٔ جدید</span><strong>{fmt(metrics.followersGained)}</strong></div>
        <div className="mc-summary-cell"><span>ورود به سایت</span><strong>{fmt(metrics.websiteClicks)}</strong></div>
        <div className="mc-summary-cell"><span>تبدیل</span><strong>{fmt(metrics.conversions)}</strong></div>
      </div>

      <div style={{ marginTop: '0.9rem' }}>
        <div className="mc-section-title">
          <h3 style={{ fontSize: '0.86rem' }}>مقایسه با محتواهای مشابه</h3>
          <span>
            {peers.comparable
              ? `${toFa(peers.peers)} محتوای مشابه`
              : 'مبنای مقایسه موجود نیست'}
          </span>
        </div>

        {peers.comparable ? (
          <div className="mc-compare">
            <div className="mc-compare__row">
              <span className="mc-compare__name">این محتوا</span>
              <span className="mc-compare__cell"><small>Reach</small>{fmt(metrics.reach, { compact: true })}</span>
              <span className="mc-compare__cell"><small>تعامل</small>{fmt(metrics.engagement, { compact: true })}</span>
              <span className="mc-compare__cell"><small>نرخ</small>{pct(content.engagementRate)}</span>
              <span className="mc-compare__cell"><small>کلیک</small>{fmt(metrics.clicks)}</span>
            </div>
            <div className="mc-compare__row">
              <span className="mc-compare__name">میانگین مشابه‌ها</span>
              <span className="mc-compare__cell"><small>Reach</small>{fmt(peers.peerAverageReach, { compact: true })}</span>
              <span className="mc-compare__cell"><small>تعامل</small>—</span>
              <span className="mc-compare__cell"><small>نرخ</small>—</span>
              <span className="mc-compare__cell"><small>کلیک</small>—</span>
            </div>
            <p className="mc-muted" style={{ lineHeight: 1.95 }}>
              این محتوا {ratio(peers.reachRatio)} میانگین Reach مشابه‌ها را گرفت
              {peers.engagementRatio !== null ? ` و ${ratio(peers.engagementRatio)} میانگین تعامل داشت` : ''}.
            </p>
          </div>
        ) : (
          <p className="mc-muted" style={{ lineHeight: 1.95 }}>
            برای اینکه بگوییم «این محتوا بهتر یا بدتر از مشابه‌ها بود»، باید محتوای دیگری با همان
            پلتفرم و همان نوع و دارای سنجه وجود داشته باشد. الان چنین موردی نیست، پس عددی ساخته نمی‌شود.
          </p>
        )}
      </div>

      <div style={{ marginTop: '0.9rem' }}>
        <div className="mc-section-title"><h3 style={{ fontSize: '0.86rem' }}>تاریخچهٔ گردش کار</h3></div>
        <ul className="mc-steps">
          {(content.history ?? []).slice().reverse().map((row, index) => (
            <li key={`${row.at}-${index}`}>
              <span className="mc-steps__badge">
                {row.to ? (config.contentStatuses.find((s) => s.id === row.to)?.label ?? row.to) : row.action}
              </span>
              <span>
                <p>{row.note || row.action}</p>
                <p className="mc-muted">{row.byName} — {faDate(row.at)} {clockTime(row.at)}</p>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {content.publishResult?.error ? (
        <p className="mc-pill mc-pill--danger" style={{ marginTop: '0.7rem', whiteSpace: 'normal' }}>
          <IconWarning width={14} height={14} />
          خطای آخرین انتشار: {content.publishResult.error}
        </p>
      ) : null}
    </>
  );

  if (embedded) return body;

  return (
    <Panel title={`تحلیل — ${content.title}`} description={`${content.platformLabel} · ${labelOf(config.contentTypes, content.contentType)}`}>
      {body}
    </Panel>
  );
}
