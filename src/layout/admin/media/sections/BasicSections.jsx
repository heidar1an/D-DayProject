/*
 * بخش‌های پشتیبان مرکز رسانه.
 *
 * این فایل عمداً اجزای تکرارشوندهٔ کم‌حجم را کنار هم نگه می‌دارد: هر تب هنوز
 * کامپوننت مستقل دارد، اما جدول/فرم‌های ساده باعث ساختن ده‌ها لایهٔ تقریباً
 * یکسان نمی‌شوند. منبع همهٔ داده‌ها `mediaCenter` است و حالت خالی/خطا حفظ می‌شود.
 */

import { useMemo, useState } from 'react';

import { mediaCenter } from '../../../../services/admin/adminService';
import {
  Button, ConfirmDialog, Field, Input, Modal, Select, Textarea, Toggle, useToast,
} from '../../adminShared';
import { IconArchive, IconCheck, IconEdit, IconPlus, IconRefresh, IconSend, IconTrash, IconWarning } from '../../adminIcons';
import {
  BarList, DataTable, DebouncedInput, Donut, Empty, ErrorBlock, Funnel, Kpi, Panel,
  Pill, SectionTitle, SkeletonCards, STATUS_LABEL, STATUS_TONE, clockTime, faDate,
  faFileSize, fmt, labelOf, maskKey, pct, relativeTime, toFa, useLoader, exportReport,
} from '../mediaKit';

const tone = (config, id) => STATUS_TONE(config?.contentStatuses ?? [], id);
const label = (config, rows, id) => labelOf(config?.[rows] ?? [], id);
const errorOrLoading = (state) => state.error && !state.data;

/* ───────────────────────── صف انتشار ───────────────────────── */

export function QueueSection({ config, refresh }) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoader(() => mediaCenter.queue(), [refresh]);

  const runQueue = async () => {
    setBusy(true);
    try {
      const result = await mediaCenter.runQueue(10);
      notify(`صف اجرا شد: ${toFa(result.processed ?? 0)} مورد پردازش شد`);
      reload();
      refresh?.();
    } catch (err) { notify(err?.message ?? 'اجرای صف انجام نشد'); }
    finally { setBusy(false); }
  };

  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />;
  if (loading && !data) return <SkeletonCards count={4} />;

  return (
    <>
      <SectionTitle title="صف انتشار" hint="اجرای صف دستی است؛ هیچ انتشار خودکاری بدون اطلاع مدیر انجام نمی‌شود." />
      <div className="mc-kpis">
        <Kpi label="آمادهٔ ارسال" value={data?.due ?? null} />
        <Kpi label="زمان‌بندی‌شده" value={data?.scheduled ?? null} />
        <Kpi label="در حال انتشار" value={data?.publishing ?? null} />
        <Kpi label="ناموفق" value={data?.failed ?? null} />
      </div>
      <Panel
        title="اجرای دستی صف"
        description="موتور انتشار فقط محتواهای رسیده به زمان خود را برمی‌دارد. بدون توکن، dry-run ثبت می‌شود و درخواست شبکه‌ای ارسال نمی‌شود."
        actions={<Button onClick={runQueue} loading={busy}><IconSend width={15} height={15} /> اجرای صف</Button>}
      >
        <DataTable
          head={['عنوان', 'پلتفرم / اکانت', 'زمان', 'وضعیت', 'آخرین نتیجه', 'اقدام']}
          empty={<Empty title="صف انتشار خالی است" description="محتوای تأییدشده را زمان‌بندی کنید تا اینجا بیاید." />}
        >
          {(data?.items ?? []).map((row) => (
            <tr key={row.id}>
              <td><strong>{row.title}</strong><small>{label(config, 'contentTypes', row.contentType)}</small></td>
              <td>{row.platformLabel}<small>{row.accountName || '—'}</small></td>
              <td>{row.scheduledAt ? <><span>{faDate(row.scheduledAt)}</span><small>{clockTime(row.scheduledAt)} · {relativeTime(row.scheduledAt)}</small></> : '—'}</td>
              <td><Pill tone={tone(config, row.status)} dot>{STATUS_LABEL(config.contentStatuses, row.status)}</Pill></td>
              <td>{row.publishResult?.message || row.publishResult?.error || <span className="mc-muted">—</span>}</td>
              <td>
                {row.status === 'failed' ? <Button variant="ghost" size="sm" onClick={async () => { try { await mediaCenter.retryContent(row.id); notify('برای تلاش دوباره آماده شد'); reload(); } catch (err) { notify(err.message); } }}>تلاش دوباره</Button> : null}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </>
  );
}

/* ───────────────────────── کمپین‌ها ───────────────────────── */

const campaignForm = (row = {}) => ({
  name: row.name ?? '', description: row.description ?? '', goal: row.goal ?? '', status: row.status ?? 'draft',
  startAt: row.startAt ?? '', endAt: row.endAt ?? '', budget: row.budget ?? '', ownerId: row.ownerId ?? '',
  platformIds: row.platformIds ?? [], tagIds: row.tagIds ?? [],
});

export function CampaignsSection({ config, range, openTab }) {
  const notify = useToast();
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoader(() => mediaCenter.campaigns({}), []);
  const team = useLoader(() => mediaCenter.team({}), []);
  const campaigns = data?.campaigns ?? data ?? [];

  const save = async () => {
    setBusy(true);
    try {
      if (dialog.id) await mediaCenter.updateCampaign(dialog.id, dialog.form);
      else await mediaCenter.createCampaign(dialog.form);
      notify('کمپین ذخیره شد'); setDialog(null); reload();
    } catch (err) { notify(err?.message ?? 'ذخیره نشد'); }
    finally { setBusy(false); }
  };

  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />;
  if (loading && !data) return <SkeletonCards count={4} />;

  return (
    <>
      <SectionTitle title="کمپین‌ها" hint="هدف، زمان، بودجه، پلتفرم‌ها و نتیجهٔ هر کمپین در یکجا" />
      <div className="mc-kpis">
        <Kpi label="کل کمپین‌ها" value={campaigns.length} />
        <Kpi label="فعال" value={campaigns.filter((r) => r.status === 'active').length} />
        <Kpi label="Reach کمپین‌ها" value={campaigns.reduce((s, r) => s + (r.metrics?.reach || 0), 0) || null} format="compact" />
        <Kpi label="تبدیل" value={campaigns.reduce((s, r) => s + (r.metrics?.conversions || 0), 0) || null} />
      </div>
      <Panel title="فهرست کمپین‌ها" actions={<Button onClick={() => setDialog({ id: null, form: campaignForm() })}><IconPlus width={14} height={14} /> کمپین جدید</Button>} flush>
        <DataTable head={['کمپین', 'وضعیت', 'بازه', 'محتوا', 'Reach', 'تعامل', 'کلیک', 'تبدیل', 'اقدام']} empty={<Empty title="کمپینی ثبت نشده" description="کمپین نخست را بسازید و محتواهایش را به آن وصل کنید." />}>
          {campaigns.map((row) => (
            <tr key={row.id}>
              <td><strong>{row.name}</strong><small>{row.goal || 'بدون هدف مشخص'}</small></td>
              <td><Pill tone={STATUS_TONE(config.campaignStatuses ?? [], row.status)} dot>{label({ campaignStatuses: config.campaignStatuses }, 'campaignStatuses', row.status)}</Pill></td>
              <td>{row.startAt ? `${faDate(row.startAt)} تا ${faDate(row.endAt)}` : '—'}</td>
              <td>{fmt(row.metrics?.contentCount)}</td><td>{fmt(row.metrics?.reach, { compact: true })}</td><td>{fmt(row.metrics?.engagement, { compact: true })}</td><td>{fmt(row.metrics?.clicks)}</td><td>{fmt(row.metrics?.conversions)}</td>
              <td><Button variant="ghost" size="sm" onClick={() => setDialog({ id: row.id, form: campaignForm(row) })}><IconEdit width={14} height={14} /></Button></td>
            </tr>
          ))}
        </DataTable>
      </Panel>
      <Modal open={Boolean(dialog)} title={dialog?.id ? 'ویرایش کمپین' : 'کمپین جدید'} onClose={() => setDialog(null)} footer={<><Button variant="ghost" onClick={() => setDialog(null)}>انصراف</Button><Button onClick={save} loading={busy}>ذخیره</Button></>}>
        {dialog ? <div className="mc-form">
          <Field label="نام کمپین" required><Input value={dialog.form.name} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, name: e.target.value } }))} /></Field>
          <Field label="هدف"><Input value={dialog.form.goal} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, goal: e.target.value } }))} placeholder="افزایش ثبت‌نام دوره" /></Field>
          <Field label="وضعیت"><Select value={dialog.form.status} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, status: e.target.value } }))} options={(config.campaignStatuses ?? []).map((r) => ({ value: r.id, label: r.label }))} /></Field>
          <Field label="مسئول"><Select value={dialog.form.ownerId} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, ownerId: e.target.value } }))} options={[{ value: '', label: 'تعیین نشده' }, ...(team.data?.members ?? []).map((r) => ({ value: r.id, label: r.name }))]} /></Field>
          <Field label="از"><Input type="date" value={dialog.form.startAt?.slice(0, 10) ?? ''} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, startAt: e.target.value } }))} /></Field>
          <Field label="تا"><Input type="date" value={dialog.form.endAt?.slice(0, 10) ?? ''} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, endAt: e.target.value } }))} /></Field>
          <Field label="بودجه"><Input dir="ltr" type="number" value={dialog.form.budget} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, budget: e.target.value } }))} /></Field>
          <div className="mc-form__full"><Field label="توضیح"><Textarea rows={3} value={dialog.form.description} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, description: e.target.value } }))} /></Field></div>
        </div> : null}
      </Modal>
    </>
  );
}

/* ───────────────────────── کتابخانه ───────────────────────── */

export function LibrarySection() {
  const notify = useToast();
  const [filters, setFilters] = useState({ search: '', kind: 'all', archived: 'active', page: 1 });
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoader(() => mediaCenter.assets(filters), [filters.search, filters.kind, filters.archived, filters.page]);

  const archive = async (row) => {
    setBusy(true); try { await mediaCenter.archiveAsset(row.id, !row.isArchived); notify(row.isArchived ? 'از آرشیو خارج شد' : 'آرشیو شد'); reload(); } catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />;
  if (loading && !data) return <SkeletonCards count={5} />;
  const items = data?.items ?? [];

  return (
    <>
      <SectionTitle title="کتابخانهٔ رسانه" hint={`${toFa(data?.total ?? 0)} فایل · پیگیری محل استفاده در محتوا`} />
      <div className="mc-kpis"><Kpi label="فایل‌ها" value={data?.total ?? null} /><Kpi label="حجم کل" value={data?.totalBytes ?? null} hint={faFileSize(data?.totalBytes)} /><Kpi label="پوشه‌ها" value={data?.folders?.length ?? null} /></div>
      <Panel title="فایل‌ها" actions={<Button variant="ghost" size="sm" onClick={() => notify('آپلود از مسیر کتابخانهٔ موجود پنل انجام می‌شود')}>آپلود فایل</Button>} flush>
        <div className="mc-filters"><DebouncedInput value={filters.search} onChange={(value) => setFilters((f) => ({ ...f, search: value, page: 1 }))} placeholder="نام فایل، برچسب یا توضیح…" /><Select value={filters.kind} onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))} options={[{ value: 'all', label: 'همهٔ انواع' }, ...(data?.byKind ? Object.keys(data.byKind).map((id) => ({ value: id, label: id })) : [])]} /><Select value={filters.archived} onChange={(e) => setFilters((f) => ({ ...f, archived: e.target.value }))} options={[{ value: 'active', label: 'فعال' }, { value: 'archived', label: 'آرشیو' }, { value: 'all', label: 'همه' }]} /></div>
        {items.length ? <div className="mc-assets" style={{ padding: '0.8rem' }}>{items.map((row) => <article className={`mc-asset ${row.isArchived ? 'is-archived' : ''}`} key={row.id}><div className="mc-asset__thumb">{row.kind === 'image' && row.url ? <img src={row.url} alt={row.altText || row.originalName} /> : <span>{row.kind}</span>}</div><div className="mc-asset__body"><strong>{row.originalName || row.filename}</strong><span className="mc-asset__meta">{row.kind} · {faFileSize(row.size)} · استفاده: {fmt(row.usageCount)}</span><span className="mc-asset__meta">{row.usedIn?.[0]?.title ?? 'در محتوایی استفاده نشده'}</span></div><div className="mc-asset__actions"><Button variant="ghost" size="sm" onClick={() => archive(row)} loading={busy}>{row.isArchived ? 'برگردان' : 'آرشیو'}</Button></div></article>)}</div> : <Empty title="فایلی پیدا نشد" description="فایل‌های آپلودشده از کتابخانهٔ رسانه و محتوای قبلی اینجا دیده می‌شوند." />}
      </Panel>
    </>
  );
}

/* ───────────────────────── تیم ───────────────────────── */

export function TeamSection({ config }) {
  const notify = useToast(); const [dialog, setDialog] = useState(null); const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoader(() => mediaCenter.team({}), []); const members = data?.team ?? data ?? [];
  const save = async () => { setBusy(true); try { if (dialog.id) await mediaCenter.updateMember(dialog.id, dialog.form); else await mediaCenter.addMember(dialog.form); notify('عضو تیم ذخیره شد'); setDialog(null); reload(); } catch (err) { notify(err.message); } finally { setBusy(false); } };
  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />; if (loading && !data) return <SkeletonCards count={4} />;
  return <><SectionTitle title="تیم رسانه" hint="نقش‌ها و دسترسی‌های تخصصی مرکز رسانه" /><Panel title="اعضای تیم" actions={<Button onClick={() => setDialog({ id: null, form: { name: '', role: 'writer', responsibility: '', email: '', phone: '', isActive: true } })}><IconPlus width={14} height={14} /> عضو جدید</Button>}><div className="mc-team-grid">{members.map((row) => <article className="mc-member" key={row.id}><span className="mc-member__avatar">{row.avatar ? <img src={row.avatar} alt="" /> : row.name?.slice(0, 1)}</span><span className="mc-member__main"><strong>{row.name}</strong><small>{row.roleLabel} · {row.responsibility || '—'}</small></span><span className="mc-member__stats"><span className="mc-member__stat"><strong>{fmt(row.metrics?.contentCount)}</strong><span>محتوا</span></span><span className="mc-member__stat"><strong>{fmt(row.metrics?.publishedCount)}</strong><span>انتشار</span></span></span><Button variant="ghost" size="sm" onClick={() => setDialog({ id: row.id, form: { name: row.name, role: row.role, responsibility: row.responsibility ?? '', email: row.email ?? '', phone: row.phone ?? '', isActive: row.isActive } })}><IconEdit width={14} height={14} /></Button></article>)}</div></Panel><Panel title="نقش‌ها و محدودهٔ دسترسی"><DataTable head={['نقش', 'دامنهٔ دسترسی', 'اعضای فعال']} empty={<Empty title="نقشی تعریف نشده" />}>{(config.mediaRoles ?? []).map((role) => <tr key={role.id}><td><strong>{role.label}</strong></td><td><div className="mc-chips">{role.scope.map((s) => <Pill tone="neutral" key={s}>{s}</Pill>)}</div></td><td>{fmt(members.filter((m) => m.role === role.id && m.isActive).length)}</td></tr>)}</DataTable></Panel><Modal open={Boolean(dialog)} title={dialog?.id ? 'ویرایش عضو' : 'عضو جدید'} onClose={() => setDialog(null)} footer={<><Button variant="ghost" onClick={() => setDialog(null)}>انصراف</Button><Button onClick={save} loading={busy}>ذخیره</Button></>}>{dialog ? <div className="mc-form"><Field label="نام" required><Input value={dialog.form.name} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, name: e.target.value } }))} /></Field><Field label="نقش"><Select value={dialog.form.role} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, role: e.target.value } }))} options={(config.mediaRoles ?? []).map((r) => ({ value: r.id, label: r.label }))} /></Field><Field label="مسئولیت"><Input value={dialog.form.responsibility} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, responsibility: e.target.value } }))} /></Field><Field label="ایمیل"><Input dir="ltr" value={dialog.form.email} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, email: e.target.value } }))} /></Field><Field label="تلفن"><Input dir="ltr" value={dialog.form.phone} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, phone: e.target.value } }))} /></Field></div> : null}</Modal></>;
}

/* ───────────────────────── اینباکس ───────────────────────── */

export function InboxSection() {
  const notify = useToast(); const [selected, setSelected] = useState(null); const [status, setStatus] = useState('all'); const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoader(() => mediaCenter.inbox({ status }), [status]); const rows = data?.items ?? [];
  const updateStatus = async (id, next) => { setBusy(true); try { await mediaCenter.setInboxStatus(id, next); notify('وضعیت به‌روز شد'); reload(); } catch (err) { notify(err.message); } finally { setBusy(false); } };
  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />; if (loading && !data) return <SkeletonCards count={4} />;
  const active = selected ? rows.find((r) => r.id === selected) : rows[0];
  return <><SectionTitle title="اینباکس اجتماعی" hint="کامنت‌ها، پیام‌ها و منشن‌های نیازمند پاسخ" /><div className="mc-kpis"><Kpi label="کل" value={data?.counts?.total ?? null} /><Kpi label="خوانده‌نشده" value={data?.counts?.unread ?? null} /><Kpi label="در انتظار" value={data?.counts?.pending ?? null} /><Kpi label="مهم" value={data?.counts?.important ?? null} /></div><div className="mc-inbox"><Panel title="پیام‌ها" flush actions={<Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'all', label: 'همهٔ وضعیت‌ها' }, ...(Array.isArray(data?.statuses) ? data.statuses : [])]} />}><div className="mc-inbox__list">{rows.map((row) => <button type="button" className={`mc-inbox__item ${row.id === active?.id ? 'is-active' : ''} ${row.status === 'unread' ? 'is-unread' : ''}`} key={row.id} onClick={() => setSelected(row.id)}><span className="mc-inbox__avatar">{row.authorName?.slice(0, 1)}</span><span className="mc-inbox__body"><strong>{row.authorName} <small>{row.platformLabel}</small></strong><p>{row.text}</p></span><span className="mc-inbox__meta"><small>{relativeTime(row.at)}</small><Pill tone={row.status === 'unread' ? 'warn' : 'muted'}>{row.status}</Pill></span></button>)}{!rows.length ? <Empty title="اینباکس خالی است" description="وقتی اتصال پیام/کامنت یک پلتفرم فراهم باشد، ورودی‌ها اینجا می‌آیند." /> : null}</div></Panel><Panel title={active ? active.authorName : 'یک پیام را انتخاب کنید'} description={active ? `${active.platformLabel} · ${faDate(active.at)}` : ''}>{active ? <div className="mc-thread"><div className="mc-thread__msg"><div className="mc-thread__meta"><span>{active.authorHandle}</span><span>{relativeTime(active.at)}</span></div>{active.text}</div><div className="mc-row"><Button size="sm" onClick={() => updateStatus(active.id, 'answered')} loading={busy}><IconCheck width={14} height={14} /> پاسخ داده شد</Button><Button variant="ghost" size="sm" onClick={() => updateStatus(active.id, 'important')}>مهم</Button><Button variant="ghost" size="sm" onClick={() => updateStatus(active.id, 'ignored')}>نادیده گرفتن</Button></div><p className="mc-muted">ارسال پاسخ فقط وقتی فعال می‌شود که آداپتور پیام پلتفرم متصل باشد.</p></div> : <Empty title="پیامی انتخاب نشده" />}</Panel></div></>;
}

/* ───────────────────────── شنود ───────────────────────── */

export function ListeningSection() {
  const notify = useToast(); const [dialog, setDialog] = useState(null); const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoader(() => mediaCenter.mentions({}), []); const summary = useLoader(() => mediaCenter.listeningSummary(), []); const rows = data?.mentions ?? data ?? [];
  const save = async () => { setBusy(true); try { if (dialog.id) await mediaCenter.updateMention(dialog.id, dialog.form); else await mediaCenter.addMention(dialog.form); notify('کلیدواژه ثبت شد'); setDialog(null); reload(); } catch (err) { notify(err.message); } finally { setBusy(false); } };
  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />; if (loading && !data) return <SkeletonCards count={4} />;
  return <><SectionTitle title="رصد نام و کلیدواژه" hint="ردیابی نام تپش، محصولات و موضوع‌ها در ورودی‌های ثبت‌شده" /><div className="mc-kpis"><Kpi label="اشاره‌ها" value={summary.data?.total ?? null} /><Kpi label="باز" value={summary.data?.open ?? null} /><Kpi label="Reach قابل‌محاسبه" value={summary.data?.byPlatform?.reduce((s, r) => s + (r.reach || 0), 0) || null} format="compact" /><Kpi label="کلیدواژه‌های فعال" value={summary.data?.keywords?.length ?? null} /></div><Panel title="کلیدواژه‌ها" actions={<Button onClick={() => setDialog({ id: null, form: { keywordLabel: '', platform: 'all', sentiment: 'unknown', handled: false } })}><IconPlus width={14} height={14} /> کلیدواژه جدید</Button>}><div className="mc-tagcloud">{(summary.data?.keywords ?? []).map((row) => <span className="mc-tag" key={row.id}><b>{row.label}</b><small>{fmt(row.count)} اشاره</small></span>)}</div></Panel><Panel title="آخرین اشاره‌ها" flush><DataTable head={['کلیدواژه', 'پلتفرم', 'نویسنده', 'متن', 'احساس', 'زمان']} empty={<Empty title="اشاره‌ای ثبت نشده" description="بدون منبع شنود متصل، عدد یا اشارهٔ ساختگی نشان داده نمی‌شود." />}>{rows.map((row) => <tr key={row.id}><td>{row.keywordLabel}</td><td>{row.platformLabel}</td><td>{row.authorName}</td><td>{row.text}</td><td><Pill tone={row.sentiment === 'positive' ? 'ok' : row.sentiment === 'negative' ? 'danger' : 'neutral'}>{row.sentiment}</Pill></td><td>{relativeTime(row.at)}</td></tr>)}</DataTable></Panel><Modal open={Boolean(dialog)} title="کلیدواژهٔ تازه" onClose={() => setDialog(null)} footer={<><Button variant="ghost" onClick={() => setDialog(null)}>انصراف</Button><Button onClick={save} loading={busy}>ذخیره</Button></>}>{dialog ? <div className="mc-form"><Field label="عبارت" required><Input value={dialog.form.keywordLabel} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, keywordLabel: e.target.value } }))} /></Field><Field label="پلتفرم"><Input value={dialog.form.platform} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, platform: e.target.value } }))} placeholder="all یا instagram" /></Field></div> : null}</Modal></>;
}

/* ───────────────────────── تحلیل و هشتگ ───────────────────────── */

export function AnalyticsSection({ config, range }) {
  const { data, loading, error, reload } = useLoader(() => mediaCenter.analytics({ range: range.range, from: range.from, to: range.to }), [range.range, range.from, range.to]);
  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />; if (loading && !data) return <SkeletonCards count={6} />;
  const platformRows = (data?.platforms ?? []).map((row) => ({ key: row.platform, label: labelOf(config.platforms, row.platform), value: row.reach, display: row.hasReach ? fmt(row.reach, { compact: true }) : '—' }));
  return <><SectionTitle title="تحلیل رسانه" hint={data?.range?.label ?? ''} /><div className="mc-kpis"><Kpi label="پلتفرم‌ها" value={data?.platforms?.length ?? null} /><Kpi label="Reach" value={data?.platforms?.reduce((s, r) => s + (r.reach || 0), 0) || null} format="compact" /><Kpi label="تعامل" value={data?.platforms?.reduce((s, r) => s + (r.engagement || 0), 0) || null} format="compact" /><Kpi label="نرخ تعامل" value={data?.platforms?.length ? data.platforms.reduce((s, r) => s + (r.engagementRate || 0), 0) / data.platforms.length : null} format="percent" /></div><div className="mc-grid mc-grid--2"><Panel title="مقایسهٔ پلتفرم‌ها"><BarList rows={platformRows} /></Panel><Panel title="انواع محتوا"><BarList rows={(data?.contentTypes ?? []).map((r) => ({ key: r.contentType, label: labelOf(config.contentTypes, r.contentType), value: r.reach, display: `${fmt(r.reach, { compact: true })} · ${pct(r.engagementRate)}` }))} color="#61d192" /></Panel></div><Panel title="عملکرد اکانت‌ها" flush><DataTable head={['اکانت', 'پلتفرم', 'دنبال‌کننده', 'Reach', 'Impressions', 'تعامل', 'نرخ تعامل', 'ثبت‌نام', 'خرید']} empty={<Empty title="سنجه‌ای موجود نیست" description="اکانت‌ها را به API وصل کنید یا سنجهٔ معتبر ثبت کنید." />}>{(data?.perAccount ?? []).map((row) => <tr key={row.accountId}><td>{row.accountName}</td><td>{row.platformLabel}</td><td>{fmt(row.followers)}</td><td>{fmt(row.reach)}</td><td>{fmt(row.impressions)}</td><td>{fmt(row.engagement)}</td><td>{pct(row.engagementRate)}</td><td>{fmt(row.signups)}</td><td>{fmt(row.purchases)}</td></tr>)}</DataTable></Panel></>;
}

export function TagsSection({ config }) {
  const notify = useToast(); const [dialog, setDialog] = useState(null); const [busy, setBusy] = useState(false); const { data, loading, error, reload } = useLoader(() => mediaCenter.tags({}), []); const rows = data?.tags ?? data ?? [];
  const save = async () => { setBusy(true); try { if (dialog.id) await mediaCenter.updateTag(dialog.id, dialog.form); else await mediaCenter.addTag(dialog.form); notify('برچسب ذخیره شد'); setDialog(null); reload(); } catch (err) { notify(err.message); } finally { setBusy(false); } };
  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />; if (loading && !data) return <SkeletonCards count={4} />;
  return <><SectionTitle title="هشتگ و موضوع" hint="مصرف، Reach، تعامل و کلیک هر برچسب" /><Panel title="برچسب‌ها" actions={<Button onClick={() => setDialog({ id: null, form: { label: '', kind: 'hashtag', slug: '', color: '' } })}><IconPlus width={14} height={14} /> برچسب جدید</Button>} flush><DataTable head={['برچسب', 'نوع', 'استفاده', 'محتوای منتشرشده', 'Reach', 'تعامل', 'کلیک', 'نرخ تعامل', 'اقدام']} empty={<Empty title="برچسبی ثبت نشده" />}>{rows.map((row) => <tr key={row.id}><td><strong>{row.label}</strong><small>{row.slug}</small></td><td>{label({ tagKinds: config.tagKinds }, 'tagKinds', row.kind)}</td><td>{fmt(row.usageCount)}</td><td>{fmt(row.publishedCount)}</td><td>{fmt(row.reach, { compact: true })}</td><td>{fmt(row.engagement, { compact: true })}</td><td>{fmt(row.clicks)}</td><td>{pct(row.engagementRate)}</td><td><Button variant="ghost" size="sm" onClick={() => setDialog({ id: row.id, form: { label: row.label, kind: row.kind, slug: row.slug, color: row.color ?? '', description: row.description ?? '' } })}><IconEdit width={14} height={14} /></Button></td></tr>)}</DataTable></Panel><Modal open={Boolean(dialog)} title={dialog?.id ? 'ویرایش برچسب' : 'برچسب جدید'} onClose={() => setDialog(null)} footer={<><Button variant="ghost" onClick={() => setDialog(null)}>انصراف</Button><Button onClick={save} loading={busy}>ذخیره</Button></>}>{dialog ? <div className="mc-form"><Field label="عنوان" required><Input value={dialog.form.label} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, label: e.target.value } }))} /></Field><Field label="نوع"><Select value={dialog.form.kind} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, kind: e.target.value } }))} options={(config.tagKinds ?? []).map((r) => ({ value: r.id, label: r.label }))} /></Field><Field label="Slug"><Input dir="ltr" value={dialog.form.slug} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, slug: e.target.value } }))} /></Field><Field label="رنگ"><Input dir="ltr" value={dialog.form.color} onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, color: e.target.value } }))} placeholder="#937fcd" /></Field></div> : null}</Modal></>;
}

/* ───────────────────────── UTM ───────────────────────── */

export function UtmSection() {
  const notify = useToast(); const [form, setForm] = useState({ baseUrl: 'https://tapesh.ir', source: 'instagram', medium: 'social', campaign: '', content: '', term: '', label: '' }); const [preview, setPreview] = useState(''); const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoader(() => mediaCenter.utmLinks({}), []); const links = data?.links ?? data ?? [];
  const build = async () => { setBusy(true); try { const result = await mediaCenter.previewUtm(form); setPreview(result.url); } catch (err) { notify(err.message); } finally { setBusy(false); } };
  const save = async () => { setBusy(true); try { await mediaCenter.addUtm({ ...form, url: preview }); notify('لینک UTM ذخیره شد'); reload(); } catch (err) { notify(err.message); } finally { setBusy(false); } };
  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />; if (loading && !data) return <SkeletonCards count={3} />;
  return <><SectionTitle title="مدیریت UTM" hint="ساخت لینک قابل ردیابی و قیف ورود رسانه به سایت" /><div className="mc-composer"><Panel title="ساخت لینک"><div className="mc-form"><Field label="آدرس پایه" required><Input dir="ltr" value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} /></Field><Field label="Source"><Input dir="ltr" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} /></Field><Field label="Medium"><Input dir="ltr" value={form.medium} onChange={(e) => setForm((f) => ({ ...f, medium: e.target.value }))} /></Field><Field label="Campaign"><Input dir="ltr" value={form.campaign} onChange={(e) => setForm((f) => ({ ...f, campaign: e.target.value }))} /></Field><Field label="Content"><Input dir="ltr" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} /></Field><Field label="Term"><Input dir="ltr" value={form.term} onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))} /></Field><div className="mc-form__full"><Field label="عنوان داخلی"><Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} /></Field></div></div><div className="mc-row" style={{ marginTop: '0.8rem' }}><Button onClick={build} loading={busy}>ساخت پیش‌نمایش</Button><Button variant="ghost" onClick={save} disabled={!preview} loading={busy}>ذخیرهٔ لینک</Button></div>{preview ? <p className="mc-mono" style={{ marginTop: '0.8rem', whiteSpace: 'normal', wordBreak: 'break-all' }}>{preview}</p> : null}</Panel><Panel title="قیف UTM"><Funnel funnel={{ steps: [{ id: 'clicks', label: 'کلیک', value: links.reduce((s, r) => s + (r.clicks || 0), 0) || null }, { id: 'visits', label: 'بازدید سایت', value: links.reduce((s, r) => s + (r.visits || 0), 0) || null }, { id: 'signups', label: 'ثبت‌نام', value: links.reduce((s, r) => s + (r.signups || 0), 0) || null }, { id: 'purchases', label: 'خرید', value: links.reduce((s, r) => s + (r.purchases || 0), 0) || null }] }} /></Panel></div><Panel title="لینک‌های ذخیره‌شده" flush><DataTable head={['عنوان', 'پلتفرم / منبع', 'آدرس', 'کلیک', 'بازدید', 'ثبت‌نام', 'خرید']} empty={<Empty title="لینکی ذخیره نشده" />}>{links.map((row) => <tr key={row.id}><td>{row.label || '—'}</td><td><span className="mc-mono">{row.source}</span><small>{row.medium}</small></td><td><span className="mc-mono">{row.url}</span></td><td>{fmt(row.clicks)}</td><td>{fmt(row.visits)}</td><td>{fmt(row.signups)}</td><td>{fmt(row.purchases)}</td></tr>)}</DataTable></Panel></>;
}

/* ───────────────────────── گزارش‌ها ───────────────────────── */

export function ReportsSection({ range }) {
  const [kind, setKind] = useState('platform'); const [report, setReport] = useState(null); const [loading, setLoading] = useState(false); const notify = useToast();
  const load = async () => { setLoading(true); try { setReport(await mediaCenter.report({ kind, range: range.range, from: range.from, to: range.to })); } catch (err) { notify(err.message); } finally { setLoading(false); } };
  return <><SectionTitle title="گزارش‌ها" hint="گزارش روزانه، کمپین، پلتفرم، محتوا و تیم — با خروجی CSV / Excel / PDF" /><Panel title="ساخت گزارش"><div className="mc-row"><Select value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: 'platform', label: 'پلتفرم' }, { value: 'account', label: 'اکانت' }, { value: 'content', label: 'محتوا' }, { value: 'campaign', label: 'کمپین' }, { value: 'team', label: 'تیم' }]} /><Button onClick={load} loading={loading}>ساخت گزارش</Button></div></Panel>{report ? <ReportPreview report={report} /> : <Panel title="پیش‌نمایش گزارش"><Empty title="گزارشی ساخته نشده" description="نوع گزارش را انتخاب و روی «ساخت گزارش» بزنید." /></Panel>}</>;
}

export function ReportPreview({ report }) {
  const notify = useToast();
  const exportReport = async (format) => { try { const { exportReport: exporter } = await import('../mediaKit'); exporter(format, report); } catch (err) { notify(err.message); } };
  return <Panel title={report.title} description={report.range?.label} actions={<div className="mc-row"><Button variant="ghost" size="sm" onClick={() => exportReport('csv')}>CSV</Button><Button variant="ghost" size="sm" onClick={() => exportReport('excel')}>Excel</Button><Button variant="ghost" size="sm" onClick={() => exportReport('pdf')}>PDF</Button></div>}><div className="mc-summary-grid">{(report.summary ?? []).map((row) => <div className="mc-summary-cell" key={row.label}><span>{row.label}</span><strong>{fmt(row.value)}</strong></div>)}</div><div className="mc-report-preview" style={{ marginTop: '0.8rem' }}><table><thead><tr>{(report.columns ?? []).map((col) => <th key={col}>{col}</th>)}</tr></thead><tbody>{(report.rows ?? []).slice(0, 50).map((row, index) => <tr key={index}>{row.map((cell, i) => <td key={i}>{cell ?? '—'}</td>)}</tr>)}</tbody></table></div></Panel>;
}

/* ───────────────────────── اعلان‌ها، رویدادها، تنظیمات ───────────────────────── */

export function NotificationsSection() {
  const notify = useToast(); const { data, loading, error, reload } = useLoader(() => mediaCenter.notifications({}), []); const rows = data?.items ?? [];
  const mark = async (id, patch) => { try { await mediaCenter.setNotification(id, patch); reload(); } catch (err) { notify(err.message); } };
  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />; if (loading && !data) return <SkeletonCards count={4} />;
  return <><SectionTitle title="مرکز اعلان‌ها" hint="تأیید، خطای انتشار، زمان نزدیک، پایان کمپین و هم‌گام‌سازی کهنه" /><Panel title="اعلان‌ها" actions={<Button variant="ghost" onClick={async () => { await mediaCenter.markAllRead(); notify('همه خوانده شد'); reload(); }}>خواندن همه</Button>} flush>{rows.length ? rows.map((row) => <div className={`mc-notif ${row.isRead ? 'is-read' : ''}`} key={row.id}><span className="mc-notif__icon"><IconWarning width={16} height={16} /></span><span className="mc-notif__body"><strong>{row.title}</strong><p>{row.body}</p><small className="mc-muted">{relativeTime(row.at)}</small></span><span className="mc-notif__actions"><Pill tone={row.level === 'critical' ? 'danger' : row.level === 'warning' ? 'warn' : 'neutral'}>{row.level}</Pill>{!row.isRead ? <Button variant="ghost" size="sm" onClick={() => mark(row.id, { isRead: true })}>خواندم</Button> : null}</span></div>) : <Empty title="اعلانی نیست" description="اعلان‌های واقعی از وضعیت محتوا و اتصال‌ها ساخته می‌شوند." />}</Panel></>;
}

export function AuditSection() {
  const [search, setSearch] = useState(''); const { data, loading, error, reload } = useLoader(() => mediaCenter.audit({ search }), [search]);
  if (errorOrLoading({ data, error })) return <ErrorBlock error={error} onRetry={reload} />; if (loading && !data) return <SkeletonCards count={4} />;
  return <><SectionTitle title="گزارش رویدادها" hint="چه کسی، چه زمانی، چه کاری، روی چه موجودیتی" /><Panel title="لاگ مرکز رسانه" flush><DataTable head={['زمان', 'کاربر', 'عملیات', 'موجودیت', 'جزئیات', 'IP']} empty={<Empty title="رویدادی ثبت نشده" />}>{(data?.items ?? []).map((row) => <tr key={row.id}><td>{faDate(row.at)}<small>{clockTime(row.at)}</small></td><td>{row.adminName || row.adminId}</td><td>{row.action}</td><td>{row.entityType}<small>{row.entityLabel}</small></td><td><span className="mc-mono">{row.metadata ? JSON.stringify(row.metadata) : '—'}</span></td><td><span className="mc-mono">{row.ip || '—'}</span></td></tr>)}</DataTable></Panel></>;
}

export function SettingsSection({ config, refresh }) {
  const notify = useToast(); const [busy, setBusy] = useState(false);
  return <><SectionTitle title="تنظیمات مرکز رسانه" hint="وضعیت دادهٔ نمونه، حالت dry-run و قراردادهای اتصال" /><div className="mc-grid mc-grid--2"><Panel title="وضعیت داده"><div className="mc-summary-grid"><div className="mc-summary-cell"><span>دادهٔ نمونه</span><strong>{config.demo ? 'فعال' : 'خاموش'}</strong></div><div className="mc-summary-cell"><span>حالت سراسری</span><strong>{config.forcedDryRun ? 'dry-run' : 'واقعی'}</strong></div><div className="mc-summary-cell"><span>پلتفرم‌ها</span><strong>{fmt(config.platforms?.length)}</strong></div></div><p className="mc-muted" style={{ lineHeight: 1.9 }}>اعداد بدون منبع اتصال داده نمی‌شوند. پاک‌کردن دادهٔ نمونه فقط رکوردهایی را حذف می‌کند که برچسب seed دارند.</p><div className="mc-row"><Button variant="ghost" onClick={async () => { setBusy(true); try { await mediaCenter.seedDemo(); notify('دادهٔ نمونه بارگذاری شد'); refresh?.(); } catch (err) { notify(err.message); } finally { setBusy(false); } }} loading={busy}>بارگذاری دوبارهٔ دمو</Button></div></Panel><Panel title="قرارداد اتصال"><DataTable head={['پلتفرم', 'آداپتور', 'قابلیت‌ها', 'متغیر توکن']} empty={<Empty title="پلتفرمی ثبت نشده" />}>{(config.platforms ?? []).map((row) => <tr key={row.id}><td>{row.label}</td><td>{row.adapter ? <Pill tone="accent">فعال</Pill> : <Pill tone="muted">ثبت دستی</Pill>}</td><td><div className="mc-chips">{Object.entries(row.capabilities ?? {}).filter(([, enabled]) => enabled).map(([key]) => <Pill tone="neutral" key={key}>{key}</Pill>)}</div></td><td><span className="mc-mono">{row.tokenEnv || '—'}</span></td></tr>)}</DataTable></Panel></div></>;
}

/* ───────────────────────── exportهای نام‌دار برای فایل‌های نازک ───────────────────────── */
export { CampaignsSection as defaultCampaigns, LibrarySection as defaultLibrary, TeamSection as defaultTeam, InboxSection as defaultInbox, ListeningSection as defaultListening, AnalyticsSection as defaultAnalytics, TagsSection as defaultTags, UtmSection as defaultUtm, ReportsSection as defaultReports, NotificationsSection as defaultNotifications, AuditSection as defaultAudit, SettingsSection as defaultSettings };
