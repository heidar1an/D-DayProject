/*
 * انتشار در کانال‌های پیام‌رسان — از پنل مدیریت به کانال‌های واقعی (شروع با بله).
 *
 * سه کارت، سه کار:
 *   ۱) «ارسال پیام»  — انتخاب کانال، انتخاب محتوا (مقاله / رسانه / متن آزاد)،
 *      پیش‌نمایش دقیق، و ارسال.
 *   ۲) «کانال‌ها»    — افزودن و ویرایش کانال، ثبت توکن ربات، تست اتصال.
 *   ۳) «تاریخچه»     — هر تلاش ارسال با نتیجهٔ واقعی.
 *
 * قاعدهٔ ثابت این بخش: **بدون توکن هیچ درخواستی به بیرون نمی‌رود.** به‌جایش
 * «ارسال آزمایشی» ثبت می‌شود و همان درخواستی که می‌رفت در تاریخچه می‌ماند؛ پس
 * کل مسیر بدون هیچ اعتباری قابل ساختن و دیدن است.
 *
 * پیش‌نمایش از سرور می‌آید، نه از کلاینت: همان تابعی که پیام‌ها را می‌شکند
 * (`planBaleMessages`) هم پیش‌نمایش را می‌سازد و هم ارسال را — پس آنچه می‌بینی
 * دقیقاً همان چیزی است که فرستاده می‌شود.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { publishing as publishingApi } from '../../../services/admin/adminService';
import MediaPicker from '../MediaPicker';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingBlock,
  Modal, Pagination, Select, TableWrap, Textarea, Toggle, faDateTime, relativeTime, toFa,
  useAsync, useToast,
} from '../adminShared';
import {
  IconCheck, IconClose, IconEdit, IconEye, IconEyeOff, IconImage, IconPlus, IconPulse, IconRefresh,
  IconSend, IconTrash,
} from '../adminIcons';

const EMPTY_CHANNEL = {
  platform: 'bale', name: '', chatId: '', isActive: true, disableNotification: false, note: '',
  /* توکن و وضعیت نمایشش فقط در فرم زندگی می‌کنند؛ هرگز از سرور نمی‌آیند */
  token: '', tokenVisible: false,
};

const STATUS_TONE = { sent: 'published', failed: 'danger', 'dry-run': 'draft' };

function statusLabel(config, value) {
  return config?.statuses?.find((row) => row.value === value)?.label ?? value ?? '—';
}

/* متن پیشنهادی از یک مقاله — قابل ویرایش قبل از ارسال */
function articleText(article, siteUrl) {
  const parts = [article.title];
  if (article.excerpt) parts.push(article.excerpt);
  if (siteUrl && article.slug) parts.push(`${siteUrl}/#articles/${article.slug}`);
  return parts.join('\n\n');
}

/* ───────────────────────────── کارت ارسال ───────────────────────────── */

function ComposeCard({ channels, targets, config, admin, onSent }) {
  const notify = useToast();
  const [selected, setSelected] = useState([]);
  const [sourceId, setSourceId] = useState('custom');
  const [text, setText] = useState('');
  const [media, setMedia] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const can = (permission) => admin.permissions?.includes(permission);
  const activeChannels = useMemo(() => channels.filter((channel) => channel.isActive), [channels]);

  /* کانال‌های آماده (توکن دارند) پیش‌فرض انتخاب می‌شوند تا یک کلیک کافی باشد */
  useEffect(() => {
    setSelected((current) => {
      const stillThere = current.filter((id) => channels.some((channel) => channel.id === id));
      if (stillThere.length) return stillThere;
      return activeChannels.filter((channel) => channel.hasToken).map((channel) => channel.id);
    });
  }, [channels, activeChannels]);

  const sourceOptions = useMemo(() => [
    { value: 'custom', label: 'متن آزاد' },
    { value: 'media', label: 'از کتابخانهٔ رسانه' },
    ...targets.articles.map((article) => ({ value: `article:${article.id}`, label: `مقاله — ${article.title}` })),
  ], [targets.articles]);

  const applySource = (value) => {
    setSourceId(value);
    setResult(null);

    if (value === 'custom') return;
    if (value === 'media') { setPickerOpen(true); return; }

    const article = targets.articles.find((row) => `article:${row.id}` === value);
    if (!article) return;

    setText(articleText(article, config?.siteUrl ?? ''));
    if (article.cover) setMedia({ url: article.cover, filename: '', mimeType: '' });
    else setMedia(null);
  };

  /* پیش‌نمایش سرور — با تأخیر کوتاه تا با هر کلید تایپ درخواست نرود */
  const previewKey = JSON.stringify({ text, url: media?.url ?? null, sourceId });

  useEffect(() => {
    if (!text.trim() && !media?.url) { setPreview(null); return undefined; }

    let alive = true;
    const timer = window.setTimeout(() => {
      publishingApi.preview({
        text,
        media,
        source: sourceId === 'custom' ? { type: 'custom' } : { type: sourceId.split(':')[0], id: sourceId.split(':')[1] ?? null },
      })
        .then((data) => { if (alive) setPreview(data); })
        .catch(() => { if (alive) setPreview(null); });
    }, 350);

    return () => { alive = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const toggleChannel = (id) => {
    setResult(null);
    setSelected((current) => (current.includes(id) ? current.filter((row) => row !== id) : [...current, id]));
  };

  const send = async (dryRun) => {
    if (!selected.length) { notify('حداقل یک کانال انتخاب کنید', 'error'); return; }
    if (!text.trim() && !media?.url) { notify('متن پیام یا یک فایل لازم است', 'error'); return; }

    setSending(true);
    setResult(null);
    try {
      const data = await publishingApi.send({
        channelIds: selected,
        dryRun,
        content: {
          text,
          media,
          source: sourceId === 'custom'
            ? { type: 'custom' }
            : { type: sourceId.split(':')[0], id: sourceId.split(':')[1] ?? null },
        },
      });

      setResult(data);
      if (data.sent) notify(`${toFa(data.sent)} کانال با موفقیت ارسال شد`);
      else if (data.dryRun) notify('ارسال آزمایشی ثبت شد — هیچ پیامی به بیرون نرفت');
      else notify('ارسال ناموفق بود؛ جزئیات را در نتیجه ببینید', 'error');

      onSent?.();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const readyCount = activeChannels.filter((channel) => channel.hasToken).length;

  return (
    <Card
      title="ارسال پیام"
      description="محتوا را انتخاب یا بنویسید، کانال‌ها را تیک بزنید و ارسال کنید."
      actions={config?.forcedDryRun ? <Badge tone="draft">حالت آزمایشی سراسری روشن است</Badge> : null}
    >
      {!channels.length ? (
        <EmptyState
          title="هنوز کانالی ثبت نشده است"
          description="اول در کارت «کانال‌ها» یک کانال بله بسازید و توکن ربات را ثبت کنید."
        />
      ) : null}

      {channels.length ? (
        <>
          <div className="ad-pub-targets">
            {channels.map((channel) => (
              <label
                key={channel.id}
                className={`ad-pub-chip ${selected.includes(channel.id) ? 'is-on' : ''} ${channel.isActive ? '' : 'is-off'}`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(channel.id)}
                  disabled={!channel.isActive}
                  onChange={() => toggleChannel(channel.id)}
                />
                <span className="ad-pub-chip__name">
                  {selected.includes(channel.id) ? <IconCheck width={14} height={14} /> : null}
                  {channel.name}
                </span>
                <small>
                  {channel.platformLabel} · {channel.hasToken ? channel.tokenHint : 'بدون توکن'}
                  {channel.isActive ? '' : ' · غیرفعال'}
                </small>
              </label>
            ))}
          </div>

          {readyCount === 0 ? (
            <p className="ad-pub-hint">
              هیچ کانالی توکن ندارد؛ ارسال در حالت آزمایشی ثبت می‌شود و پیامی به بیرون نمی‌رود.
            </p>
          ) : null}

          <div className="ad-grid2">
            <Field label="منبع محتوا" hint="انتخاب مقاله، متن و تصویر شاخص را پر می‌کند">
              <Select
                options={sourceOptions}
                value={sourceId}
                onChange={(event) => applySource(event.target.value)}
              />
            </Field>

            <Field label="فایل همراه" hint="تصویر یا PDF — اختیاری">
              <span className="ad-inputicon">
                <Input
                  value={media?.filename || media?.url || ''}
                  dir="ltr"
                  readOnly
                  placeholder="فایلی انتخاب نشده"
                />
                {media ? (
                  <button type="button" className="ad-inputicon__toggle" onClick={() => setMedia(null)}>
                    <IconClose width={14} height={14} /> حذف
                  </button>
                ) : (
                  <button type="button" className="ad-inputicon__toggle" onClick={() => setPickerOpen(true)}>
                    <IconImage width={14} height={14} /> انتخاب
                  </button>
                )}
              </span>
            </Field>
          </div>

          <Field
            label="متن پیام"
            hint={`${toFa(text.length)} نویسه${media?.url ? ' — با فایل، متن کوتاه‌تر از ۱۰۰۰ نویسه به‌عنوان کپشن می‌رود' : ''}`}
          >
            <Textarea
              rows={6}
              value={text}
              onChange={(event) => { setText(event.target.value); setResult(null); }}
              placeholder="متن پیامی که در کانال منتشر می‌شود…"
            />
          </Field>

          <div className="ad-pub-preview">
            <header>
              <IconSend width={15} height={15} />
              <strong>پیش‌نمایش</strong>
              <span>همین پیام‌ها فرستاده می‌شوند</span>
            </header>

            {preview?.steps?.length ? (
              <ol className="ad-pub-preview__steps">
                {preview.steps.map((step, index) => (
                  <li key={`${step.method}-${index}`}>
                    <span className="ad-pub-preview__badge">{step.label}</span>
                    {step.hasMedia ? <span className="ad-pub-preview__media">همراه با فایل</span> : null}
                    <p>{step.text || <em className="ad-muted">بدون متن</em>}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="ad-muted">برای دیدن پیش‌نمایش، متن بنویسید یا فایل انتخاب کنید.</p>
            )}
          </div>

          {result ? (
            <div className="ad-pub-result">
              <header>
                <strong>نتیجهٔ ارسال</strong>
                <span>
                  {toFa(result.sent)} موفق · {toFa(result.failed)} ناموفق · {toFa(result.dryRun)} آزمایشی
                </span>
              </header>
              <ul>
                {result.results.map((row) => (
                  <li key={row.channelId} className={`ad-pub-result__row is-${row.status}`}>
                    <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>{statusLabel(config, row.status)}</Badge>
                    <strong>{row.channelName}</strong>
                    <span className="ad-pub-result__detail">
                      {row.status === 'sent' ? `${toFa(row.messages?.length ?? 0)} پیام فرستاده شد`
                        : row.status === 'dry-run' ? row.reason
                          : row.error}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {can('publishing.send') ? (
            <div className="ad-pub-actions">
              <Button variant="ghost" onClick={() => send(true)} loading={sending} disabled={sending}>
                ارسال آزمایشی
              </Button>
              <Button onClick={() => send(false)} loading={sending} disabled={sending || readyCount === 0}>
                <IconSend width={16} height={16} />
                ارسال به {toFa(selected.length)} کانال
              </Button>
            </div>
          ) : (
            <p className="ad-pub-hint">برای ارسال، دسترسی «publishing.send» لازم است.</p>
          )}
        </>
      ) : null}

      <MediaPicker
        open={pickerOpen}
        accept="image/*,application/pdf"
        onClose={() => setPickerOpen(false)}
        onSelect={(item) => setMedia({ url: item.url, filename: item.filename, mimeType: item.mimeType })}
      />
    </Card>
  );
}

/* ───────────────────────────── کارت کانال‌ها ───────────────────────────── */

function ChannelsCard({ channels, config, admin, onChanged }) {
  const notify = useToast();
  const [dialog, setDialog] = useState(null);
  const [tokenFor, setTokenFor] = useState(null);
  const [tokenValue, setTokenValue] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [testing, setTesting] = useState(null);
  const [busy, setBusy] = useState(false);
  /* نتیجهٔ تست پیش از ذخیره — فقط برای مودال جاری */
  const [testState, setTestState] = useState({ loading: false, result: null });

  const can = (permission) => admin.permissions?.includes(permission);
  const platforms = config?.platforms ?? [];
  const platformOf = (id) => platforms.find((row) => row.id === id) ?? platforms[0];

  const setField = (key, value) => setDialog((current) => ({ ...current, form: { ...current.form, [key]: value } }));

  const openDialog = (mode, form) => {
    setTestState({ loading: false, result: null });
    setDialog({ mode, form });
  };

  /*
   * تست اعتبار پیش از ذخیره. کانال هنوز ساخته نشده، پس توکن و شناسه از خود فرم
   * می‌آیند. اگر کاربر چیزی در فرم عوض کند، نتیجهٔ تست قبلی پاک می‌شود تا نتیجهٔ
   * کهنه گمراهش نکند.
   */
  const runDraftTest = async () => {
    if (!dialog) return;

    setTestState({ loading: true, result: null });
    try {
      const result = await publishingApi.testCredentials({
        platform: dialog.form.platform,
        token: dialog.form.token,
        chatId: dialog.form.chatId,
      });
      setTestState({ loading: false, result });
    } catch (error) {
      setTestState({
        loading: false,
        result: { ok: false, complete: false, checks: [{ id: 'request', label: 'درخواست', ok: false, message: error.message }] },
      });
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const { token, tokenVisible, ...payload } = dialog.form;

      const saved = dialog.mode === 'create'
        ? await publishingApi.createChannel(payload)
        : await publishingApi.updateChannel(payload.id, payload);

      notify(dialog.mode === 'create' ? 'کانال ثبت شد' : 'کانال به‌روزرسانی شد');

      /* توکن در همان جریان ساخت کانال ذخیره می‌شود — بدون مرحلهٔ جدا */
      const channelId = saved.channel?.id ?? payload.id;
      if (token.trim() && channelId) {
        await publishingApi.setToken(channelId, token.trim());
        notify('توکن ربات ذخیره شد');
      }

      setDialog(null);
      setTestState({ loading: false, result: null });
      onChanged();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveToken = async () => {
    setBusy(true);
    try {
      const data = await publishingApi.setToken(tokenFor.id, tokenValue.trim());
      notify(data.hasToken ? 'توکن ذخیره شد' : 'توکن پاک شد');
      setTokenFor(null);
      setTokenValue('');
      onChanged();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const runTest = async (channel) => {
    setTesting(channel.id);
    try {
      const data = await publishingApi.testChannel(channel.id);
      const failed = (data.checks ?? []).find((check) => check.ok === false);
      if (data.complete) notify(`اتصال سالم است — ${data.checks?.[0]?.message ?? ''}`);
      else notify(failed?.message ?? 'توکن درست است ولی دسترسی به کانال تأیید نشد', 'error');
      onChanged();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setTesting(null);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await publishingApi.removeChannel(pendingDelete.id);
      notify('کانال حذف شد');
      setPendingDelete(null);
      onChanged();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (channel) => {
    try {
      await publishingApi.updateChannel(channel.id, { ...channel, isActive: !channel.isActive });
      notify(channel.isActive ? 'کانال غیرفعال شد' : 'کانال فعال شد');
      onChanged();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  return (
    <Card
      title="کانال‌ها"
      description="هر کانال یک ربات و یک شناسه دارد. توکن فقط روی سرور ذخیره می‌شود و هرگز به مرورگر برنمی‌گردد."
      actions={can('publishing.channels.manage') ? (
        <Button onClick={() => openDialog('create', { ...EMPTY_CHANNEL })}>
          <IconPlus width={16} height={16} />
          کانال جدید
        </Button>
      ) : null}
    >
      <TableWrap
        head={['نام', 'شناسهٔ کانال', 'توکن ربات', 'وضعیت', 'آخرین ارسال', '']}
        empty={channels.length === 0 ? (
          <EmptyState
            title="کانالی ثبت نشده است"
            description="یک کانال بله بساز، توکن ربات را بگذار و همان‌جا تست کن — همه در یک مودال."
            action={can('publishing.channels.manage') ? (
              <Button onClick={() => openDialog('create', { ...EMPTY_CHANNEL })}>
                <IconPlus width={16} height={16} />
                ساخت اولین کانال
              </Button>
            ) : null}
          />
        ) : null}
      >
        {channels.map((channel) => (
          <tr key={channel.id}>
            <td>
              <strong>{channel.name}</strong>
              <small className="ad-sub">{channel.platformLabel}</small>
            </td>
            <td><span className="ad-mono" dir="ltr">{channel.chatId}</span></td>
            <td>
              {channel.hasToken ? (
                <>
                  <Badge tone="published">ثبت شده</Badge>
                  <small className="ad-sub" dir="ltr">
                    {channel.tokenHint}
                    {channel.tokenSource === 'env' ? ` · از ${channel.tokenEnv}` : ''}
                  </small>
                </>
              ) : (
                <>
                  <Badge tone="draft">ثبت نشده</Badge>
                  {channel.tokenEnv ? <small className="ad-sub" dir="ltr">{channel.tokenEnv}</small> : null}
                </>
              )}
            </td>
            <td>
              {channel.isActive ? <Badge tone="published">فعال</Badge> : <Badge tone="draft">غیرفعال</Badge>}
              {channel.lastError ? <small className="ad-sub ad-sub--danger">{channel.lastError}</small> : null}
            </td>
            <td>
              {channel.lastSentAt ? (
                <>
                  <span>{relativeTime(channel.lastSentAt)}</span>
                  <small className="ad-sub">
                    {statusLabel(config, channel.lastStatus)}
                    {` · ${toFa(channel.sentCount)} موفق`}
                  </small>
                </>
              ) : <span className="ad-muted">—</span>}
            </td>
            <td>
              <div className="ad-rowactions">
                {can('publishing.send') ? (
                  <Button variant="ghost" size="sm" loading={testing === channel.id} onClick={() => runTest(channel)}>
                    تست اتصال
                  </Button>
                ) : null}
                {can('publishing.channels.manage') ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setTokenFor(channel); setTokenValue(''); }}
                    >
                      {channel.hasToken ? 'تغییر توکن' : 'ثبت توکن'}
                    </Button>
                    <IconButton label="ویرایش" onClick={() => openDialog('edit', { ...channel, token: '', tokenVisible: false })}>
                      <IconEdit width={16} height={16} />
                    </IconButton>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(channel)}>
                      {channel.isActive ? 'غیرفعال' : 'فعال'}
                    </Button>
                    <IconButton label="حذف" tone="danger" onClick={() => setPendingDelete(channel)}>
                      <IconTrash width={16} height={16} />
                    </IconButton>
                  </>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </TableWrap>

      <Modal
        open={Boolean(dialog)}
        title={dialog?.mode === 'create' ? 'کانال جدید' : 'ویرایش کانال'}
        subtitle={platformOf(dialog?.form.platform)?.description}
        onClose={() => setDialog(null)}
        size="lg"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>انصراف</Button>
            <Button onClick={submit} loading={busy}>
              {dialog?.form.token?.trim() && !testState.result?.complete ? 'ذخیره (تست‌نشده)' : 'ذخیره'}
            </Button>
          </>
        )}
      >
        {dialog ? (
          <div className="ad-pub-form">
            {/* راهنمای گام‌به‌گام — از خود پلتفرم می‌آید تا با پلتفرم تازه کهنه نشود */}
            {platformOf(dialog.form.platform)?.setupSteps?.length ? (
              <details className="ad-pub-guide" open={dialog.mode === 'create' && !dialog.form.token}>
                <summary>چطور ربات و کانال را آماده کنم؟</summary>
                <ol>
                  {platformOf(dialog.form.platform).setupSteps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
                {platformOf(dialog.form.platform)?.botFatherUrl ? (
                  <a
                    className="ad-pub-guide__link"
                    href={platformOf(dialog.form.platform).botFatherUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    باز کردن BotFather در بله
                  </a>
                ) : null}
              </details>
            ) : null}

            <div className="ad-grid2">
              <Field label="پلتفرم" required>
                <Select
                  options={platforms.map((row) => ({ value: row.id, label: row.label }))}
                  value={dialog.form.platform}
                  onChange={(event) => { setField('platform', event.target.value); setTestState({ loading: false, result: null }); }}
                />
              </Field>

              <Field label="نام کانال" required hint="فقط برای خودت — در پنل نمایش داده می‌شود">
                <Input value={dialog.form.name} onChange={(event) => setField('name', event.target.value)} />
              </Field>

              <div className="ad-grid2__full">
                <Field label="شناسهٔ کانال (chat_id)" required hint={platformOf(dialog.form.platform)?.chatIdHint}>
                  <Input
                    dir="ltr"
                    value={dialog.form.chatId}
                    onChange={(event) => { setField('chatId', event.target.value); setTestState({ loading: false, result: null }); }}
                    placeholder="@tapesh_channel"
                  />
                </Field>
              </div>

              <div className="ad-grid2__full">
                <Field
                  label={platformOf(dialog.form.platform)?.tokenLabel ?? 'توکن ربات'}
                  required={dialog.mode === 'create'}
                  hint={dialog.mode === 'edit' && dialog.form.hasToken
                    ? `الان توکنی ثبت شده (${dialog.form.tokenHint}). برای تغییر پر کن؛ خالی بگذار تا دست‌نخورده بماند.`
                    : platformOf(dialog.form.platform)?.tokenHint}
                >
                  <span className="ad-inputicon">
                    <Input
                      dir="ltr"
                      type={dialog.form.tokenVisible ? 'text' : 'password'}
                      autoComplete="off"
                      spellCheck={false}
                      value={dialog.form.token}
                      onChange={(event) => { setField('token', event.target.value); setTestState({ loading: false, result: null }); }}
                      placeholder={dialog.mode === 'edit' && dialog.form.hasToken ? dialog.form.tokenHint : '123456789:ABC…'}
                    />
                    <button
                      type="button"
                      className="ad-inputicon__toggle"
                      onClick={() => setField('tokenVisible', !dialog.form.tokenVisible)}
                      aria-label={dialog.form.tokenVisible ? 'مخفی کردن توکن' : 'نمایش توکن'}
                    >
                      {dialog.form.tokenVisible ? <IconEyeOff width={14} height={14} /> : <IconEye width={14} height={14} />}
                      {dialog.form.tokenVisible ? 'مخفی' : 'نمایش'}
                    </button>
                  </span>
                </Field>
              </div>

              {/* تست پیش از ذخیره — هم توکن، هم دسترسی ربات به کانال */}
              <div className="ad-grid2__full">
                <div className="ad-pub-testbar">
                  <Button
                    variant="ghost"
                    onClick={runDraftTest}
                    loading={testState.loading}
                    disabled={testState.loading || !dialog.form.token.trim()}
                  >
                    <IconPulse width={15} height={15} />
                    تست اتصال
                  </Button>
                  <span className="ad-pub-hint">
                    قبل از ذخیره بررسی می‌کند که توکن درست است و ربات به این کانال دسترسی دارد.
                  </span>
                </div>

                {testState.result ? (
                  <>
                    <div className={`ad-pub-verdict ${testState.result.complete ? 'is-ok' : 'is-warn'}`}>
                      {testState.result.complete
                        ? 'آمادهٔ ارسال است — توکن و دسترسی کانال تأیید شد'
                        : testState.result.ok
                          ? 'توکن درست است، ولی دسترسی به کانال تأیید نشد'
                          : 'اتصال برقرار نشد'}
                    </div>

                    <ul className="ad-pub-checks">
                      {(testState.result.checks ?? []).map((check) => (
                        <li
                          key={check.id}
                          className={`ad-pub-check ${check.ok === true ? 'is-ok' : check.ok === false ? 'is-bad' : 'is-skip'}`}
                        >
                          <span className="ad-pub-check__icon" aria-hidden="true">
                            {check.ok === true ? <IconCheck width={13} height={13} /> : check.ok === false ? <IconClose width={13} height={13} /> : '—'}
                          </span>
                          <span className="ad-pub-check__label">{check.label}</span>
                          <span className="ad-pub-check__msg">{check.message}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>

              <div className="ad-grid2__full">
                <Field label="یادداشت">
                  <Input value={dialog.form.note} onChange={(event) => setField('note', event.target.value)} />
                </Field>
              </div>

              <div className="ad-grid2__full">
                <Toggle
                  checked={dialog.form.isActive}
                  onChange={(value) => setField('isActive', value)}
                  label="فعال باشد"
                  hint="کانال غیرفعال در فهرست ارسال تیک‌خورده نمی‌شود."
                />
              </div>

              <div className="ad-grid2__full">
                <Toggle
                  checked={dialog.form.disableNotification}
                  onChange={(value) => setField('disableNotification', value)}
                  label="بدون اعلان ارسال شود"
                  hint="برای پست‌های غیرفوری؛ اعضای کانال اعلان نمی‌گیرند."
                />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(tokenFor)}
        title={`توکن ربات — ${tokenFor?.name ?? ''}`}
        subtitle={platformOf(tokenFor?.platform)?.tokenHint}
        onClose={() => setTokenFor(null)}
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setTokenFor(null)}>انصراف</Button>
            <Button onClick={saveToken} loading={busy}>ذخیره</Button>
          </>
        )}
      >
        <Field
          label="توکن"
          hint="خالی بگذارید و ذخیره کنید تا توکن ثبت‌شده پاک شود. توکن فقط در سرور ذخیره می‌شود."
        >
          <Input
            dir="ltr"
            type="password"
            autoComplete="off"
            value={tokenValue}
            onChange={(event) => setTokenValue(event.target.value)}
            placeholder={tokenFor?.hasToken ? tokenFor.tokenHint : '123456789:ABC…'}
          />
        </Field>
        <p className="ad-pub-hint">
          پس از ذخیره، توکن هرگز نمایش داده نمی‌شود؛ فقط ۴ نویسهٔ آخر برای تشخیص.
        </p>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="حذف کانال"
        message={`کانال «${pendingDelete?.name ?? ''}» و توکن ثبت‌شده‌اش حذف شود؟ تاریخچهٔ ارسال باقی می‌ماند.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Card>
  );
}

/* ──────────────────────────── کارت تاریخچه ──────────────────────────── */

function LogCard({ channels, config, refreshKey }) {
  const [status, setStatus] = useState('all');
  const [channelId, setChannelId] = useState('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  const { data, loading, error, reload } = useAsync(
    () => publishingApi.log({ status, channelId, page, perPage: 10 }),
    [status, channelId, page, refreshKey],
  );

  const rows = data?.items ?? [];

  const channelOptions = [
    { value: 'all', label: 'همهٔ کانال‌ها' },
    ...channels.map((channel) => ({ value: channel.id, label: channel.name })),
  ];

  return (
    <Card
      title="تاریخچهٔ ارسال"
      description="هر تلاش ارسال — موفق، ناموفق یا آزمایشی — با همان درخواستی که رفت."
      actions={<Button variant="ghost" size="sm" onClick={reload}><IconRefresh width={15} height={15} />تازه‌سازی</Button>}
    >
      <div className="ad-toolbar">
        <Select
          options={[{ value: 'all', label: 'همهٔ وضعیت‌ها' }, ...(config?.statuses ?? [])]}
          value={status}
          onChange={(event) => { setStatus(event.target.value); setPage(1); }}
        />
        <Select
          options={channelOptions}
          value={channelId}
          onChange={(event) => { setChannelId(event.target.value); setPage(1); }}
        />
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingBlock label="در حال خواندن تاریخچه…" rows={4} /> : null}

      {data ? (
        <>
          <TableWrap
            head={['زمان', 'کانال', 'وضعیت', 'محتوا', '']}
            empty={rows.length === 0 ? <EmptyState title="هنوز ارسالی ثبت نشده است" /> : null}
          >
            {rows.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span>{faDateTime(entry.at)}</span>
                  <small className="ad-sub">{relativeTime(entry.at)}</small>
                </td>
                <td>
                  <strong>{entry.channelName}</strong>
                  <small className="ad-sub">{entry.platformLabel}</small>
                </td>
                <td>
                  <Badge tone={STATUS_TONE[entry.status] ?? 'neutral'}>{statusLabel(config, entry.status)}</Badge>
                  {entry.error ? <small className="ad-sub ad-sub--danger">{entry.error}</small> : null}
                  {entry.status === 'dry-run' && entry.reason ? <small className="ad-sub">{entry.reason}</small> : null}
                </td>
                <td>
                  {entry.contentPreview
                    ? <span className="ad-pub-preview-text">{entry.contentPreview.slice(0, 60)}{entry.contentPreview.length > 60 ? '…' : ''}</span>
                    : <span className="ad-muted">فقط فایل</span>}
                </td>
                <td>
                  <Button variant="ghost" size="sm" onClick={() => setOpen(entry)}>جزئیات</Button>
                </td>
              </tr>
            ))}
          </TableWrap>

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            perPage={data.perPage}
            onPageChange={setPage}
          />
        </>
      ) : null}

      <Modal
        open={Boolean(open)}
        title="جزئیات ارسال"
        subtitle={open ? `${open.channelName} · ${faDateTime(open.at)}` : ''}
        onClose={() => setOpen(null)}
        size="sm"
        footer={<Button variant="ghost" onClick={() => setOpen(null)}>بستن</Button>}
      >
        {open ? (
          <dl className="ad-pub-detail">
            <dt>وضعیت</dt>
            <dd><Badge tone={STATUS_TONE[open.status] ?? 'neutral'}>{statusLabel(config, open.status)}</Badge></dd>

            <dt>منبع توکن</dt>
            <dd>{open.tokenSource === 'channel' ? 'توکن ثبت‌شدهٔ کانال' : open.tokenSource === 'env' ? 'متغیر محیطی' : 'ندارد'}</dd>

            <dt>کاربر</dt>
            <dd>{open.adminName || '—'}</dd>

            <dt>پیام‌های برنامه‌ریزی‌شده</dt>
            <dd>
              <ul className="ad-pub-detail__steps">
                {(open.request?.steps ?? []).map((step, index) => (
                  <li key={`${step.method}-${index}`}>
                    <span className="ad-pub-preview__badge">{step.label}</span>
                    <span className="ad-muted">
                      {step.method}
                      {` · ${toFa(step.textLength)} نویسه`}
                      {step.hasMedia ? ` · ${step.mediaFilename ?? 'فایل'}` : ''}
                    </span>
                  </li>
                ))}
                {open.request?.steps?.length ? null : <li className="ad-muted">—</li>}
              </ul>
            </dd>

            {open.messages?.length ? (
              <>
                <dt>شناسهٔ پیام‌های ارسالی</dt>
                <dd><span className="ad-mono" dir="ltr">{open.messages.map((row) => row.messageId ?? '—').join(', ')}</span></dd>
              </>
            ) : null}

            {open.error ? (
              <>
                <dt>خطا</dt>
                <dd className="ad-sub--danger">{open.error}{open.errorCode ? ` (${open.errorCode})` : ''}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </Modal>
    </Card>
  );
}

/* ───────────────────────────── صفحهٔ اصلی ───────────────────────────── */

export default function AdminPublishing({ admin }) {
  const [refreshKey, setRefreshKey] = useState(0);

  /* یک کلید = یک بار تازه‌سازی همهٔ کارت‌ها (کانال‌ها، آمار و تاریخچه) */
  const { data, loading, error } = useAsync(() => publishingApi.channels(), [refreshKey]);
  const targets = useAsync(() => publishingApi.targets(), []);

  const channels = data?.channels ?? [];
  const config = data?.config ?? null;
  const stats = data?.stats ?? null;

  const refresh = useCallback(() => setRefreshKey((current) => current + 1), []);

  if (loading && !data) return <LoadingBlock label="در حال خواندن کانال‌ها…" rows={4} />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  return (
    <div className="ad-stack">
      {config?.forcedDryRun ? (
        <div className="ad-pub-notice">
          <strong>حالت آزمایشی سراسری روشن است</strong>
          <p>
            متغیر محیطی <span className="ad-mono">PUBLISH_DRY_RUN=1</span> تنظیم شده است؛ هیچ پیامی
            واقعاً فرستاده نمی‌شود و همهٔ تلاش‌ها به‌عنوان «آزمایشی» ثبت می‌شوند.
          </p>
        </div>
      ) : null}

      {stats ? (
        <div className="ad-pub-stats">
          <div className="ad-pub-stat">
            <strong>{toFa(stats.channels)}</strong>
            <span>کانال ثبت‌شده</span>
          </div>
          <div className="ad-pub-stat">
            <strong>{toFa(stats.readyChannels)}</strong>
            <span>آمادهٔ ارسال</span>
          </div>
          <div className="ad-pub-stat">
            <strong>{toFa(stats.sent)}</strong>
            <span>ارسال موفق</span>
          </div>
          <div className="ad-pub-stat">
            <strong>{toFa(stats.failed)}</strong>
            <span>ارسال ناموفق</span>
          </div>
          <div className="ad-pub-stat">
            <strong>{toFa(stats.dryRun)}</strong>
            <span>آزمایشی</span>
          </div>
        </div>
      ) : null}

      <ComposeCard
        channels={channels}
        targets={targets.data ?? { articles: [], media: [] }}
        config={config}
        admin={admin}
        onSent={refresh}
      />

      <ChannelsCard channels={channels} config={config} admin={admin} onChanged={refresh} />

      <LogCard channels={channels} config={config} refreshKey={refreshKey} />
    </div>
  );
}
