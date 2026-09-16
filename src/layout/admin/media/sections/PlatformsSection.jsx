/*
 * پلتفرم‌ها — کدام بسترها فعال‌اند و چه قابلیتی دارند.
 *
 * دو دستهٔ پلتفرم وجود دارد و UI هم همین را صادقانه نشان می‌دهد:
 *   • آداپتور دارد (بله، تلگرام، ایتا، اینستاگرام) ⇒ انتشار و خواندن سنجه از API.
 *   • آداپتور ندارد (یوتیوب، آپارات، لینکدین، …) ⇒ فقط ثبت دستی اطلاعات.
 * پلتفرمی که آداپتور ندارد هرگز «متصل» نشان داده نمی‌شود.
 */

import { useMemo, useState } from 'react';

import { mediaCenter } from '../../../../services/admin/adminService';
import { Button, ConfirmDialog, Field, Input, Modal, Textarea, Toggle, useToast } from '../../adminShared';
import { IconBroadcast, IconEdit, IconLink, IconPlus, IconTrash } from '../../adminIcons';
import {
  ConnectionPill, Empty, ErrorBlock, Kpi, Panel, Pill, SectionTitle, SkeletonCards,
  faDate, fmt, labelOf, relativeTime, toFa, useLoader,
} from '../mediaKit';

const ACCENT = {
  instagram: '#c98bd0', telegram: '#5b8cc7', bale: '#61d192', eitaa: '#e0b45c',
  youtube: '#e26d6d', aparat: '#ab8e7c', linkedin: '#5b8cc7', x: '#9a9a9a',
  rubika: '#937fcd', whatsapp: '#61d192', pinterest: '#e26d6d', website: '#8a8a8a',
  podcast: '#937fcd', newsletter: '#e0b45c',
};

const FAMILY_LABELS = {
  messenger: 'پیام‌رسان',
  social: 'شبکهٔ اجتماعی',
  video: 'ویدئو',
  professional: 'حرفه‌ای',
  web: 'وب',
  audio: 'صدا',
  email: 'ایمیل',
};

const emptyForm = (platform) => ({
  platform: platform?.id ?? '',
  label: platform?.label ?? '',
  description: platform?.description ?? '',
  logo: '',
  managerId: '',
  startedAt: '',
  notes: '',
  isActive: true,
});

export default function PlatformsSection({ config, admin, refresh, openTab }) {
  const notify = useToast();
  const { data, loading, error, reload } = useLoader(() => mediaCenter.platforms(), []);

  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const platforms = data?.platforms ?? [];
  const registered = useMemo(() => new Set(platforms.map((row) => row.id)), [platforms]);
  const available = useMemo(
    () => (config.platforms ?? []).filter((row) => !registered.has(row.id)),
    [config.platforms, registered],
  );

  const catalogOf = (id) => (config.platforms ?? []).find((row) => row.id === id);

  const totals = useMemo(() => ({
    adapters: platforms.filter((row) => row.adapter).length,
    manual: platforms.filter((row) => !row.adapter).length,
    accounts: platforms.reduce((sum, row) => sum + (row.accountCount ?? 0), 0),
    connected: platforms.reduce((sum, row) => sum + (row.connectedAccounts ?? 0), 0),
  }), [platforms]);

  const save = async () => {
    if (!dialog) return;
    setBusy(true);
    try {
      await mediaCenter.savePlatform({
        platform: dialog.form.platform,
        label: dialog.form.label,
        description: dialog.form.description,
        logo: dialog.form.logo,
        managerId: dialog.form.managerId || null,
        startedAt: dialog.form.startedAt || null,
        notes: dialog.form.notes,
        isActive: dialog.form.isActive,
      });
      notify(dialog.isNew ? 'پلتفرم ثبت شد' : 'تغییرات ذخیره شد');
      setDialog(null);
      reload();
      refresh?.();
    } catch (err) {
      notify(err?.message ?? 'ذخیره نشد');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await mediaCenter.removePlatform(pendingDelete.id);
      notify('پلتفرم حذف شد');
      setPendingDelete(null);
      reload();
      refresh?.();
    } catch (err) {
      notify(err?.message ?? 'حذف نشد');
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <ErrorBlock error={error} onRetry={reload} />;
  if (loading && !data) return <SkeletonCards count={6} />;

  return (
    <>
      <SectionTitle
        title="پلتفرم‌ها"
        hint={`${toFa(totals.adapters)} پلتفرم با آداپتور API · ${toFa(totals.manual)} پلتفرم با ثبت دستی`}
      />

      <div className="mc-kpis">
        <Kpi label="پلتفرم با آداپتور API" value={totals.adapters} hint="انتشار و سنجه از خود پلتفرم" />
        <Kpi label="پلتفرم با ثبت دستی" value={totals.manual} hint="بدون آداپتور — داده دستی وارد می‌شود" />
        <Kpi label="اکانت ثبت‌شده" value={totals.accounts} onClick={() => openTab('accounts')} />
        <Kpi
          label="اکانت با کلید فعال"
          value={totals.connected}
          hint={totals.accounts ? 'اعتبار آمادهٔ تماس با API' : 'اکانتی ثبت نشده'}
          onClick={() => openTab('accounts')}
        />
      </div>

      {/* ─── کارت پلتفرم‌های ثبت‌شده ─── */}
      {platforms.length ? (
        <div className="mc-platforms">
          {platforms.map((row) => {
            const catalog = catalogOf(row.id) ?? {};
            const capabilities = row.capabilities ?? {};
            return (
              <article
                className={`mc-platform ${row.isActive ? '' : 'is-off'}`}
                key={row.id}
                style={{ '--mc-accent': ACCENT[row.id] ?? '#937fcd' }}
              >
                <div className="mc-platform__head">
                  <span className="mc-platform__logo">
                    {row.logo ? <img src={row.logo} alt="" /> : (row.label ?? row.id).slice(0, 2)}
                  </span>
                  <span className="mc-platform__name">
                    <strong>{row.label}</strong>
                    <small>
                      {FAMILY_LABELS[row.family] ?? row.family}
                      {row.startedAt ? ` · از ${faDate(row.startedAt)}` : ''}
                    </small>
                  </span>
                  {row.isActive ? <Pill tone="ok" dot>فعال</Pill> : <Pill tone="muted" dot>غیرفعال</Pill>}
                </div>

                <ConnectionPill account={{ adapter: row.adapter, tokenSource: row.configured ? 'account' : 'none', hasToken: row.configured, lastSyncStatus: null }} />

                <div className="mc-platform__stats">
                  <div className="mc-platform__stat">
                    <strong>{fmt(row.accountCount)}</strong>
                    <span>اکانت</span>
                  </div>
                  <div className="mc-platform__stat">
                    <strong>{row.followers ? fmt(row.followers, { compact: true }) : '—'}</strong>
                    <span>دنبال‌کننده</span>
                  </div>
                  <div className="mc-platform__stat">
                    <strong>{fmt(row.contentCount)}</strong>
                    <span>محتوا</span>
                  </div>
                </div>

                <div className="mc-row" style={{ gap: '0.3rem', flexWrap: 'wrap' }}>
                  {capabilities.publish ? <Pill tone="accent">انتشار</Pill> : null}
                  {capabilities.metrics ? <Pill tone="blue">سنجه</Pill> : null}
                  {capabilities.comments ? <Pill tone="blue">کامنت</Pill> : null}
                  {capabilities.messages ? <Pill tone="blue">پیام</Pill> : null}
                  {!row.adapter ? <Pill tone="muted">بدون آداپتور</Pill> : null}
                </div>

                {row.description ? <p className="mc-muted">{row.description}</p> : null}

                <div className="mc-platform__foot">
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ isNew: false, form: {
                    platform: row.id,
                    label: row.label ?? '',
                    description: row.description ?? '',
                    logo: row.logo ?? '',
                    managerId: row.managerId ?? '',
                    startedAt: row.startedAt ?? '',
                    notes: row.notes ?? '',
                    isActive: row.isActive,
                  } })}>
                    <IconEdit width={14} height={14} />
                    ویرایش
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openTab('accounts', { action: 'create', platform: row.id })}>
                    <IconPlus width={14} height={14} />
                    اکانت
                  </Button>
                  {catalog.docsUrl ? (
                    <a className="mc-quick__btn" href={catalog.docsUrl} target="_blank" rel="noreferrer">
                      <IconLink width={14} height={14} />
                      مستندات API
                    </a>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => setPendingDelete(row)}>
                    <IconTrash width={14} height={14} />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Panel title="پلتفرمی ثبت نشده">
          <Empty
            title="هنوز هیچ پلتفرمی اضافه نشده"
            description="از فهرست زیر پلتفرمی را انتخاب کنید. پلتفرم‌های دارای آداپتور (بله، تلگرام، ایتا، اینستاگرام) می‌توانند مستقیم از API منتشر کنند."
          />
        </Panel>
      )}

      {/* ─── افزودن پلتفرم از کاتالوگ ─── */}
      <Panel
        title="افزودن پلتفرم"
        description="کاتالوگ کامل بسترها. افزودن پلتفرم تازه هیچ تغییر معماری لازم ندارد؛ فقط رکورد ساخته می‌شود."
      >
        {available.length ? (
          <div className="mc-chips">
            {available.map((row) => (
              <button
                key={row.id}
                type="button"
                className="mc-chip"
                onClick={() => setDialog({ isNew: true, form: emptyForm(row) })}
              >
                <IconPlus width={13} height={13} />
                {row.label}
                {row.adapter ? <span className="mc-pill mc-pill--accent">API</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="mc-muted">همهٔ پلتفرم‌های کاتالوگ ثبت شده‌اند.</p>
        )}
      </Panel>

      {/* ─── راهنمای کلید API ─── */}
      <Panel
        title="کلیدهای API"
        description="توکن هر پلتفرم روی «اکانت» ثبت می‌شود، نه اینجا — چون یک پلتفرم می‌تواند چند اکانت داشته باشد."
      >
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead>
              <tr>
                <th>پلتفرم</th>
                <th>نوع API</th>
                <th>کلید لازم</th>
                <th>متغیر محیطی جایگزین</th>
                <th>مستندات</th>
              </tr>
            </thead>
            <tbody>
              {(config.platforms ?? []).map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.label}</strong>
                    <small>{FAMILY_LABELS[row.family] ?? row.family}</small>
                  </td>
                  <td>{row.adapter ? <Pill tone="accent">{row.apiKind ?? 'REST'}</Pill> : <Pill tone="muted">ندارد</Pill>}</td>
                  <td>
                    {row.adapter ? (
                      <>
                        {row.tokenLabel ?? 'توکن'}
                        {row.needsAppKeys ? <small>{row.appIdLabel} + {row.appSecretLabel}</small> : null}
                      </>
                    ) : <span className="mc-muted">—</span>}
                  </td>
                  <td><span className="mc-mono">{row.tokenEnv ?? '—'}</span></td>
                  <td>
                    {row.docsUrl ? <a href={row.docsUrl} target="_blank" rel="noreferrer">مستندات</a> : <span className="mc-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ─── گفت‌وگوی ویرایش/افزودن ─── */}
      <Modal
        open={Boolean(dialog)}
        title={dialog?.isNew ? 'افزودن پلتفرم' : `ویرایش ${dialog?.form?.label ?? ''}`}
        subtitle={dialog?.isNew ? catalogOf(dialog?.form?.platform)?.description : undefined}
        onClose={() => setDialog(null)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>انصراف</Button>
            <Button onClick={save} loading={busy}>ذخیره</Button>
          </>
        )}
      >
        {dialog ? (
          <div className="mc-form">
            <Field label="پلتفرم">
              <Input value={dialog.form.label} onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, label: event.target.value } }))} />
            </Field>

            <Field label="تاریخ شروع فعالیت">
              <Input
                type="date"
                value={dialog.form.startedAt ?? ''}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, startedAt: event.target.value } }))}
              />
            </Field>

            <div className="mc-form__full">
              <Field label="توضیح" hint="برای تیم رسانه — این متن جای دیگری نمایش داده نمی‌شود.">
                <Textarea
                  rows={2}
                  value={dialog.form.description}
                  onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, description: event.target.value } }))}
                />
              </Field>
            </div>

            <Field label="نشانی لوگو" hint="اختیاری — خالی بگذارید تا حرف اول نام نمایش داده شود.">
              <Input
                dir="ltr"
                value={dialog.form.logo}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, logo: event.target.value } }))}
                placeholder="/uploads/logo.png"
              />
            </Field>

            <Field label="مسئول پلتفرم" hint="شناسهٔ عضو تیم رسانه">
              <Input
                value={dialog.form.managerId}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, managerId: event.target.value } }))}
              />
            </Field>

            <div className="mc-form__full">
              <Field label="یادداشت">
                <Textarea
                  rows={2}
                  value={dialog.form.notes}
                  onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, notes: event.target.value } }))}
                />
              </Field>
            </div>

            <div className="mc-form__full">
              <Toggle
                checked={dialog.form.isActive}
                onChange={(value) => setDialog((row) => ({ ...row, form: { ...row.form, isActive: value } }))}
                label="فعال باشد"
                hint="پلتفرم غیرفعال در فهرست‌های انتخاب محتوا نمی‌آید."
              />
            </div>

            {dialog.isNew && !catalogOf(dialog.form.platform)?.adapter ? (
              <div className="mc-form__full">
                <div className="mc-demo">
                  <IconBroadcast width={15} height={15} />
                  <span>
                    برای این پلتفرم آداپتور API وجود ندارد؛ اطلاعات به‌صورت دستی ثبت می‌شود و
                    دکمهٔ «انتشار» برایش نمایش داده نمی‌شود.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف پلتفرم"
        message={`پلتفرم «${pendingDelete?.label ?? ''}» از فهرست حذف شود؟ اگر اکانتی روی آن باشد، حذف انجام نمی‌شود.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
