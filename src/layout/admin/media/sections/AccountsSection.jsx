/*
 * اکانت‌ها و کانال‌ها — درخت «پلتفرم → اکانت → محتوا».
 *
 * مهم‌ترین نکتهٔ این صفحه: کلید API اینجا ثبت می‌شود و **هرگز** به کلاینت
 * برنمی‌گردد. آنچه می‌بینید فقط وضعیت است: آیا کلیدی ثبت شده، از کجا می‌آید
 * (خود اکانت / متغیر محیطی / کانال انتشار) و ۴ نویسهٔ آخرش.
 *
 * تست اعتبار پیش از ذخیره انجام می‌شود و دو چیز را جدا بررسی می‌کند: درستی
 * توکن، و دسترسی ربات به کانال — چون این دو خطای متفاوت‌اند.
 */

import { useEffect, useMemo, useState } from 'react';

import { mediaCenter } from '../../../../services/admin/adminService';
import {
  Button, ConfirmDialog, Field, Input, Modal, Select, Textarea, Toggle, useToast,
} from '../../adminShared';
import {
  IconBroadcast, IconCheck, IconClose, IconEdit, IconLink, IconPlus, IconPulse,
  IconRefresh, IconTrash, IconUpload,
} from '../../adminIcons';
import {
  ConnectionPill, DataTable, Empty, ErrorBlock, Kpi, Panel, Picker, Pill, SectionTitle,
  SkeletonCards, faDate, fmt, labelOf, relativeTime, toFa, useLoader,
} from '../mediaKit';

const KIND_LABEL = {
  channel: 'کانال',
  page: 'صفحه',
  profile: 'پروفایل',
  group: 'گروه',
  account: 'اکانت',
  board: 'برد',
  feed: 'فید',
};

const emptyForm = (platform = 'bale') => ({
  platform,
  name: '',
  handle: '',
  url: '',
  externalId: '',
  internalId: '',
  kind: 'channel',
  isActive: true,
  avatar: '',
  description: '',
  managerId: '',
  startedAt: '',
  followers: '',
});

/* یک بررسی اعتبار — سه حالت: تأیید، رد، و «انجام نشد» */
function CheckList({ checks = [] }) {
  if (!checks.length) return null;
  return (
    <ul className="ad-pub-checks">
      {checks.map((check) => (
        <li
          key={check.id}
          className={`ad-pub-check ${check.ok === true ? 'is-ok' : check.ok === false ? 'is-bad' : 'is-skip'}`}
        >
          <span className="ad-pub-check__icon" aria-hidden="true">
            {check.ok === true ? <IconCheck width={13} height={13} />
              : check.ok === false ? <IconClose width={13} height={13} /> : '—'}
          </span>
          <span className="ad-pub-check__label">{check.label}</span>
          <span className="ad-pub-check__msg">{check.message}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AccountsSection({ config, admin, refresh, intent, clearIntent, openTab }) {
  const notify = useToast();

  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null);
  const [credentialFor, setCredentialFor] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [expanded, setExpanded] = useState({});

  /*
   * «افزودن پلتفرم» از تب پلتفرم‌ها یا اقدام سریع، فرم را از پیش باز می‌کند.
   * این کار در effect انجام می‌شود نه در رندر — چون `clearIntent` روی کامپوننت
   * والد اثر می‌گذارد و تغییر state والد در رندر فرزند خطاست.
   */
  useEffect(() => {
    if (intent?.action !== 'create') return;
    setDialog({ isNew: true, form: emptyForm(intent.platform ?? 'bale') });
    clearIntent?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.nonce, intent?.action, intent?.platform]);

  const { data, loading, error, reload } = useLoader(
    () => mediaCenter.accounts({ platform, search }),
    [platform, search],
  );

  const accounts = data?.accounts ?? [];

  const grouped = useMemo(() => {
    const map = new Map();
    accounts.forEach((row) => {
      if (!map.has(row.platform)) map.set(row.platform, []);
      map.get(row.platform).push(row);
    });
    return [...map.entries()].map(([id, rows]) => ({
      platform: id,
      label: labelOf(config.platforms, id),
      rows,
      adapter: rows[0]?.adapter === true,
    }));
  }, [accounts, config.platforms]);

  const totals = useMemo(() => ({
    accounts: accounts.length,
    connected: accounts.filter((row) => row.tokenSource !== 'none' || row.hasToken).length,
    manual: accounts.filter((row) => !row.adapter).length,
    withContent: 0,
  }), [accounts]);

  const catalogOf = (id) => (config.platforms ?? []).find((row) => row.id === id);

  /* ─── ذخیره ─── */

  const save = async () => {
    if (!dialog) return;
    setBusy(true);
    try {
      const payload = {
        platform: dialog.form.platform,
        name: dialog.form.name,
        handle: dialog.form.handle,
        url: dialog.form.url,
        externalId: dialog.form.externalId,
        internalId: dialog.form.internalId,
        kind: dialog.form.kind,
        isActive: dialog.form.isActive,
        avatar: dialog.form.avatar,
        description: dialog.form.description,
        managerId: dialog.form.managerId || null,
        startedAt: dialog.form.startedAt || null,
        audience: { followers: dialog.form.followers === '' ? null : Number(dialog.form.followers) },
      };

      if (dialog.isNew) await mediaCenter.createAccount(payload);
      else await mediaCenter.updateAccount(dialog.id, payload);

      notify(dialog.isNew ? 'اکانت ثبت شد' : 'تغییرات ذخیره شد');
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
      await mediaCenter.removeAccount(pendingDelete.id);
      notify('اکانت حذف شد');
      setPendingDelete(null);
      reload();
      refresh?.();
    } catch (err) {
      notify(err?.message ?? 'حذف نشد');
    } finally {
      setBusy(false);
    }
  };

  /* ─── کلید API ─── */

  const saveCredentials = async () => {
    if (!credentialFor) return;
    setBusy(true);
    try {
      await mediaCenter.setCredentials(credentialFor.id, {
        token: credentialFor.token,
        appId: credentialFor.appId,
        appSecret: credentialFor.appSecret,
      });
      notify(credentialFor.token ? 'کلید ذخیره شد' : 'کلید ثبت‌شده پاک شد');
      setCredentialFor(null);
      setTestResult(null);
      reload();
      refresh?.();
    } catch (err) {
      notify(err?.message ?? 'ذخیره نشد');
    } finally {
      setBusy(false);
    }
  };

  const runDraftTest = async () => {
    if (!credentialFor) return;
    setBusy(true);
    setTestResult(null);
    try {
      const result = await mediaCenter.testCredentials({
        platform: credentialFor.platform,
        token: credentialFor.token,
        externalId: credentialFor.externalId,
        appId: credentialFor.appId,
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, complete: false, checks: [{ id: 'network', label: 'درخواست', ok: false, message: err?.message ?? 'انجام نشد' }] });
    } finally {
      setBusy(false);
    }
  };

  const runTest = async (account) => {
    setBusy(true);
    setTestResult(null);
    try {
      const result = await mediaCenter.testAccount(account.id);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, complete: false, checks: [{ id: 'network', label: 'درخواست', ok: false, message: err?.message ?? 'انجام نشد' }] });
    } finally {
      setBusy(false);
    }
  };

  const runSync = async (account) => {
    setBusy(true);
    try {
      const result = await mediaCenter.syncAccount(account.id);
      notify(result?.message ?? 'هم‌گام‌سازی انجام شد');
      reload();
    } catch (err) {
      notify(err?.message ?? 'هم‌گام‌سازی انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    try {
      const result = await mediaCenter.importChannels();
      const count = Number(result?.created ?? 0);
      notify(count ? `${toFa(count)} کانال انتشار به اکانت‌ها اضافه شد` : 'کانال تازه‌ای برای افزودن نبود');
      reload();
      refresh?.();
    } catch (err) {
      notify(err?.message ?? 'افزودن انجام نشد');
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <ErrorBlock error={error} onRetry={reload} />;
  if (loading && !data) return <SkeletonCards count={4} />;

  return (
    <>
      <SectionTitle
        title="اکانت‌ها و کانال‌ها"
        hint={`${toFa(grouped.length)} پلتفرم · ${toFa(accounts.length)} اکانت`}
      />

      <div className="mc-kpis">
        <Kpi label="اکانت ثبت‌شده" value={totals.accounts} />
        <Kpi
          label="اکانت با کلید فعال"
          value={totals.connected}
          hint={totals.accounts ? `${toFa(totals.connected)} از ${toFa(totals.accounts)}` : 'اکانتی ثبت نشده'}
        />
        <Kpi label="اکانت با ثبت دستی" value={totals.manual} hint="پلتفرم بدون آداپتور API" />
      </div>

      <Panel
        title="فهرست اکانت‌ها"
        description="اکانت‌ها بر اساس پلتفرم گروه‌بندی شده‌اند؛ محتوای هر اکانت از تب «مدیریت محتوا» قابل دیدن است."
        actions={(
          <>
            <Picker value={platform} onChange={setPlatform} options={config.platforms} allLabel="همهٔ پلتفرم‌ها" />
            <Input
              className="ad-input"
              value={search}
              placeholder="جست‌وجوی نام یا شناسه…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button variant="ghost" size="sm" onClick={runImport} loading={busy} title="کانال‌هایی که در بخش «انتشار در کانال‌ها» ثبت شده‌اند">
              <IconUpload width={14} height={14} />
              افزودن از کانال‌های انتشار
            </Button>
            <Button size="sm" onClick={() => setDialog({ isNew: true, form: emptyForm(platform === 'all' ? 'bale' : platform) })}>
              <IconPlus width={14} height={14} />
              اکانت جدید
            </Button>
          </>
        )}
        flush
      >
        {!accounts.length ? (
          <Empty
            title="اکانتی ثبت نشده"
            description="اگر کانالی در بخش «انتشار در کانال‌ها» ثبت کرده‌اید، با دکمهٔ «افزودن از کانال‌های انتشار» همین‌جا ظاهر می‌شود؛ نیازی به وارد کردن دوبارهٔ توکن نیست."
          />
        ) : (
          <div className="mc-accounts" style={{ padding: '0.8rem' }}>
            {grouped.map((group) => (
              <div className="mc-account-group" key={group.platform}>
                <div className="mc-account-group__head">
                  <IconBroadcast width={16} height={16} />
                  <strong>{group.label}</strong>
                  <small>
                    {toFa(group.rows.length)} اکانت
                    {group.adapter ? ' · دارای آداپتور API' : ' · ثبت دستی'}
                  </small>
                  <span style={{ marginInlineStart: 'auto' }}>
                    <button
                      type="button"
                      className="mc-quick__btn"
                      onClick={() => setExpanded((row) => ({ ...row, [group.platform]: !row[group.platform] }))}
                    >
                      {expanded[group.platform] ? 'بستن' : 'نمایش'}
                    </button>
                  </span>
                </div>

                {(expanded[group.platform] !== false) && group.rows.map((account) => (
                  <div className={`mc-account ${account.isActive ? '' : 'is-off'}`} key={account.id}>
                    <span className="mc-account__avatar">
                      {account.avatar ? <img src={account.avatar} alt="" /> : account.name.slice(0, 1)}
                    </span>

                    <span className="mc-account__main">
                      <strong>{account.name}</strong>
                      <small>
                        {KIND_LABEL[account.kind] ?? account.kind}
                        {account.handle ? ` · ${account.handle}` : ''}
                        {account.internalId ? ` · ${account.internalId}` : ''}
                      </small>
                    </span>

                    <div className="mc-account__stats">
                      <div className="mc-account__stat">
                        <strong>{fmt(account.audience?.followers, { compact: true })}</strong>
                        <span>دنبال‌کننده</span>
                      </div>
                      <div className="mc-account__stat">
                        <strong>{fmt(account.metrics?.reach, { compact: true })}</strong>
                        <span>Reach</span>
                      </div>
                      <div className="mc-account__stat">
                        <strong>{fmt(account.metrics?.engagement, { compact: true })}</strong>
                        <span>تعامل</span>
                      </div>
                    </div>

                    <div className="mc-account__actions">
                      <ConnectionPill account={account} />
                      {account.adapter ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setCredentialFor({ ...account, token: '', appId: '', appSecret: '' }); setTestResult(null); }}>
                            کلید API
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => runTest(account)} loading={busy}>
                            <IconPulse width={14} height={14} />
                            تست
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => runSync(account)} loading={busy}>
                            <IconRefresh width={14} height={14} />
                            هم‌گام‌سازی
                          </Button>
                        </>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => setDialog({ isNew: false, id: account.id, form: {
                        platform: account.platform,
                        name: account.name,
                        handle: account.handle ?? '',
                        url: account.url ?? '',
                        externalId: account.externalId ?? '',
                        internalId: account.internalId ?? '',
                        kind: account.kind ?? 'channel',
                        isActive: account.isActive,
                        avatar: account.avatar ?? '',
                        description: account.description ?? '',
                        managerId: account.managerId ?? '',
                        startedAt: account.startedAt ?? '',
                        followers: account.audience?.followers ?? '',
                      } })}>
                        <IconEdit width={14} height={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPendingDelete(account)}>
                        <IconTrash width={14} height={14} />
                      </Button>
                    </div>

                    {account.lastSyncAt || account.lastSyncMessage ? (
                      <p className="mc-muted" style={{ flexBasis: '100%' }}>
                        آخرین هم‌گام‌سازی: {account.lastSyncAt ? `${relativeTime(account.lastSyncAt)} (${faDate(account.lastSyncAt)})` : '—'}
                        {account.lastSyncMessage ? ` — ${account.lastSyncMessage}` : ''}
                        {account.publishChannelId ? ' · متصل به کانال انتشار' : ''}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ─── وضعیت اعتبارها ─── */}
      <Panel title="وضعیت کلیدها" description="توکن هرگز نمایش داده نمی‌شود؛ فقط منبع و ۴ نویسهٔ آخر" flush>
        <DataTable
          head={['اکانت', 'پلتفرم', 'منبع کلید', 'کلید', 'کلیدهای اپلیکیشن', 'آخرین هم‌گام‌سازی']}
          empty={<Empty title="اکانتی برای نمایش نیست" />}
        >
          {accounts.map((account) => (
            <tr key={account.id}>
              <td>
                <strong>{account.name}</strong>
                <small>{account.externalId || '—'}</small>
              </td>
              <td>{account.platformLabel}</td>
              <td>
                {account.tokenSource === 'account' ? <Pill tone="ok" dot>روی خود اکانت</Pill>
                  : account.tokenSource === 'env' ? <Pill tone="blue" dot>متغیر محیطی</Pill>
                    : account.tokenSource === 'channel' ? <Pill tone="accent" dot>کانال انتشار</Pill>
                      : <Pill tone="muted" dot>ثبت نشده</Pill>}
                {account.tokenEnv ? <small className="mc-mono">{account.tokenEnv}</small> : null}
              </td>
              <td>
                <span className="mc-mono">
                  {account.hasToken ? (account.tokenHint || '••••••••') : '—'}
                </span>
              </td>
              <td>
                {account.needsAppKeys ? (
                  account.hasAppKeys
                    ? <span className="mc-mono">{account.appIdHint || '••••'}</span>
                    : <Pill tone="warn" dot>ثبت نشده</Pill>
                ) : <span className="mc-muted">لازم نیست</span>}
              </td>
              <td>
                {account.lastSyncAt ? (
                  <>
                    <span>{relativeTime(account.lastSyncAt)}</span>
                    <small>{account.lastSyncStatus === 'error' ? 'خطا' : account.lastSyncStatus === 'manual' ? 'ثبت دستی' : 'موفق'}</small>
                  </>
                ) : <span className="mc-muted">—</span>}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {/* ─── گفت‌وگوی اکانت ─── */}
      <Modal
        open={Boolean(dialog)}
        title={dialog?.isNew ? 'اکانت جدید' : 'ویرایش اکانت'}
        subtitle={dialog ? catalogOf(dialog.form.platform)?.description : undefined}
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
            <Field label="پلتفرم" required>
              <Select
                value={dialog.form.platform}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, platform: event.target.value } }))}
                options={(config.platforms ?? []).map((row) => ({ value: row.id, label: row.adapter ? `${row.label} — API` : row.label }))}
              />
            </Field>

            <Field label="نام اکانت" required hint="همان‌طور که در پلتفرم دیده می‌شود">
              <Input
                value={dialog.form.name}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, name: event.target.value } }))}
              />
            </Field>

            <Field label="نوع">
              <Select
                value={dialog.form.kind}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, kind: event.target.value } }))}
                options={(config.accountKinds ?? []).map((row) => ({ value: row.id, label: row.label }))}
              />
            </Field>

            <Field label="شناسهٔ کاربری" hint="مثل @tapesh">
              <Input
                dir="ltr"
                value={dialog.form.handle}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, handle: event.target.value } }))}
              />
            </Field>

            <Field
              label={catalogOf(dialog.form.platform)?.targetLabel ?? 'شناسهٔ مقصد'}
              hint={catalogOf(dialog.form.platform)?.targetHint ?? 'شناسه‌ای که پیام به آن فرستاده می‌شود'}
            >
              <Input
                dir="ltr"
                value={dialog.form.externalId}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, externalId: event.target.value } }))}
              />
            </Field>

            <Field label="شناسهٔ داخلی" hint="برای ارجاع داخلی تیم — اختیاری">
              <Input
                dir="ltr"
                value={dialog.form.internalId}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, internalId: event.target.value } }))}
              />
            </Field>

            <Field label="نشانی">
              <Input
                dir="ltr"
                value={dialog.form.url}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, url: event.target.value } }))}
              />
            </Field>

            <Field label="دنبال‌کننده" hint="اگر API عدد ندهد، همین مقدار دستی استفاده می‌شود">
              <Input
                dir="ltr"
                type="number"
                value={dialog.form.followers}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, followers: event.target.value } }))}
              />
            </Field>

            <Field label="تاریخ شروع فعالیت">
              <Input
                type="date"
                value={dialog.form.startedAt ?? ''}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, startedAt: event.target.value } }))}
              />
            </Field>

            <Field label="مسئول اکانت" hint="شناسهٔ عضو تیم رسانه">
              <Input
                value={dialog.form.managerId}
                onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, managerId: event.target.value } }))}
              />
            </Field>

            <div className="mc-form__full">
              <Field label="توضیح">
                <Textarea
                  rows={2}
                  value={dialog.form.description}
                  onChange={(event) => setDialog((row) => ({ ...row, form: { ...row.form, description: event.target.value } }))}
                />
              </Field>
            </div>

            <div className="mc-form__full">
              <Toggle
                checked={dialog.form.isActive}
                onChange={(value) => setDialog((row) => ({ ...row, form: { ...row.form, isActive: value } }))}
                label="فعال باشد"
                hint="اکانت غیرفعال در فهرست انتخاب هنگام ساخت محتوا نمی‌آید."
              />
            </div>

            {!catalogOf(dialog.form.platform)?.adapter ? (
              <div className="mc-form__full">
                <div className="mc-demo">
                  <IconLink width={15} height={15} />
                  <span>این پلتفرم آداپتور API ندارد. اطلاعات دستی ثبت می‌شود و دکمهٔ انتشار برایش نمایش داده نمی‌شود.</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* ─── گفت‌وگوی کلید API ─── */}
      <Modal
        open={Boolean(credentialFor)}
        title={`کلید API — ${credentialFor?.name ?? ''}`}
        subtitle={catalogOf(credentialFor?.platform)?.tokenHint}
        onClose={() => { setCredentialFor(null); setTestResult(null); }}
        footer={(
          <>
            <Button variant="ghost" onClick={() => { setCredentialFor(null); setTestResult(null); }}>انصراف</Button>
            <Button variant="ghost" onClick={runDraftTest} loading={busy} disabled={!credentialFor?.token}>
              <IconPulse width={14} height={14} />
              تست اتصال
            </Button>
            <Button onClick={saveCredentials} loading={busy}>ذخیره</Button>
          </>
        )}
      >
        {credentialFor ? (
          <div className="mc-form">
            <div className="mc-form__full">
              <Field
                label={catalogOf(credentialFor.platform)?.tokenLabel ?? 'توکن'}
                hint={credentialFor.hasToken
                  ? `الان کلیدی ثبت شده (${credentialFor.tokenHint}). خالی بگذارید تا دست‌نخورده بماند؛ برای پاک‌کردن، خالی بگذارید و ذخیره کنید.`
                  : catalogOf(credentialFor.platform)?.tokenHint}
              >
                <Input
                  dir="ltr"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={credentialFor.token}
                  placeholder={credentialFor.hasToken ? credentialFor.tokenHint : '123456789:ABC…'}
                  onChange={(event) => { setCredentialFor((row) => ({ ...row, token: event.target.value })); setTestResult(null); }}
                />
              </Field>
            </div>

            {catalogOf(credentialFor.platform)?.needsAppKeys ? (
              <>
                <Field label={catalogOf(credentialFor.platform)?.appIdLabel ?? 'App ID'}>
                  <Input
                    dir="ltr"
                    value={credentialFor.appId}
                    placeholder={credentialFor.appIdHint || ''}
                    onChange={(event) => { setCredentialFor((row) => ({ ...row, appId: event.target.value })); setTestResult(null); }}
                  />
                </Field>
                <Field label={catalogOf(credentialFor.platform)?.appSecretLabel ?? 'App Secret'}>
                  <Input
                    dir="ltr"
                    type="password"
                    autoComplete="off"
                    value={credentialFor.appSecret}
                    onChange={(event) => { setCredentialFor((row) => ({ ...row, appSecret: event.target.value })); setTestResult(null); }}
                  />
                </Field>
              </>
            ) : null}

            {testResult ? (
              <div className="mc-form__full">
                <div className={`ad-pub-verdict ${testResult.complete ? 'is-ok' : 'is-warn'}`}>
                  {testResult.complete
                    ? 'آمادهٔ کار است — توکن و دسترسی تأیید شد'
                    : testResult.ok
                      ? 'توکن درست است، ولی دسترسی کامل تأیید نشد'
                      : 'اتصال برقرار نشد'}
                </div>
                <CheckList checks={testResult.checks} />
              </div>
            ) : null}

            <div className="mc-form__full">
              <p className="mc-muted">
                کلید فقط روی سرور ذخیره می‌شود (فایل با دسترسی محدود) و هرگز در پاسخ API برنمی‌گردد.
                {catalogOf(credentialFor.platform)?.setupSteps?.length ? ' مراحل ساخت کلید:' : ''}
              </p>
              {catalogOf(credentialFor.platform)?.setupSteps?.length ? (
                <ol className="mc-muted" style={{ paddingInlineStart: '1.1rem', lineHeight: 2 }}>
                  {catalogOf(credentialFor.platform).setupSteps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ─── نتیجهٔ تست اکانت ─── */}
      <Modal
        open={Boolean(testResult) && !credentialFor}
        title="نتیجهٔ تست اتصال"
        onClose={() => setTestResult(null)}
        footer={<Button onClick={() => setTestResult(null)}>بستن</Button>}
      >
        {testResult ? (
          <>
            <div className={`ad-pub-verdict ${testResult.complete ? 'is-ok' : 'is-warn'}`}>
              {testResult.complete ? 'اتصال سالم است' : 'اتصال کامل تأیید نشد'}
            </div>
            <CheckList checks={testResult.checks} />
            {testResult.bot || testResult.chat ? (
              <div className="mc-summary-grid" style={{ marginTop: '0.7rem' }}>
                {testResult.bot ? (
                  <div className="mc-summary-cell"><span>ربات</span><strong>{testResult.bot.name ?? testResult.bot.username ?? '—'}</strong></div>
                ) : null}
                {testResult.chat ? (
                  <div className="mc-summary-cell"><span>مقصد</span><strong>{testResult.chat.title ?? testResult.chat.username ?? '—'}</strong></div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف اکانت"
        message={`اکانت «${pendingDelete?.name ?? ''}» حذف شود؟ اگر محتوایی روی آن باشد، حذف انجام نمی‌شود. کلید ذخیره‌شده هم پاک می‌شود.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
