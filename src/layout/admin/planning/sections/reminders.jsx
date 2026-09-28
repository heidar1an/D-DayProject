/*
 * بخش «یادآوری» — یادآوری‌ها، اعلان‌ها و تسک‌های عقب‌افتاده.
 *
 * سه چیز در یک صفحه: تعریف یادآوری (زمان، تکرار، غیرفعال‌سازی)، مرکز اعلان
 * (خوانده/نخوانده، فیلتر نوع و اهمیت) و فهرست تسک‌های عقب‌افتاده. تنظیمات شخصی
 * یادآوری هم همین‌جا هست چون کاربر معمولاً بعد از دیدن اعلان‌ها سراغش می‌رود.
 */

import { useCallback, useMemo, useState } from 'react';

import {
  Button, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, Select, Textarea, Toggle, useAsync, useToast,
} from '../../adminShared';
import {
  IconBell, IconCheck, IconClock, IconPlus, IconTrash, IconWarning,
} from '../../adminIcons';
import { planning } from '../../../../services/planning/planningService';
import {
  NOTIFICATION_KINDS, OFFSET_PRESETS, PRIORITIES, RECURRENCES, labelOf, toneOf,
} from '../../../../services/planning/planningTypes';
import { isoDate, jalaliLabel, relativeFa, toFa } from '../../../../services/planning/jalali';
import { Panel, Pill, Toolbar, ToolbarSpacer } from '../planningKit';

const TARGET_TYPES = [
  { value: 'task', label: 'تسک' },
  { value: 'event', label: 'رویداد' },
  { value: 'deadline', label: 'سررسید' },
  { value: 'sop', label: 'SOP' },
];

const EMPTY_REMINDER = {
  title: '', body: '', targetType: 'task', targetId: '', offsetMinutes: 1440,
  recurrence: 'none', priority: 'medium', enabled: true,
};

export default function RemindersSection({ onRefreshUnread }) {
  const notify = useToast();

  const [tab, setTab] = useState('reminders');
  const [notifFilters, setNotifFilters] = useState({ kind: '', priority: '', unreadOnly: false });
  const [form, setForm] = useState({ open: false, reminder: null });
  const [draft, setDraft] = useState(EMPTY_REMINDER);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(null);

  const remindersLoader = useCallback(() => planning.reminders.list({}), []);
  const { data: reminders, loading: remindersLoading, reload: reloadReminders } = useAsync(remindersLoader, [remindersLoader]);

  const notificationsLoader = useCallback(
    () => planning.reminders.notifications({
      kind: notifFilters.kind || undefined,
      priority: notifFilters.priority || undefined,
      unreadOnly: notifFilters.unreadOnly || undefined,
    }),
    [notifFilters],
  );
  const { data: notifications, loading: notifLoading, reload: reloadNotifications } = useAsync(notificationsLoader, [notificationsLoader]);

  const { data: settings, reload: reloadSettings } = useAsync(() => planning.reminders.settings(), []);
  const { data: tasks } = useAsync(() => planning.tasks.list({ perPage: 0 }), []);

  const activeSettings = settingsDraft ?? settings;

  const unread = useMemo(() => (notifications ?? []).filter((row) => !row.read).length, [notifications]);
  const overdue = useMemo(
    () => (tasks?.items ?? []).filter((task) => task.dueDate < isoDate(new Date()) && !['done', 'canceled'].includes(task.status)),
    [tasks],
  );
  const dueToday = useMemo(() => (tasks?.items ?? []).filter((task) => task.dueDate === isoDate(new Date())), [tasks]);

  const openForm = (reminder) => {
    setDraft(reminder ? { ...reminder } : { ...EMPTY_REMINDER });
    setForm({ open: true, reminder });
  };

  const save = async () => {
    setBusy(true);
    try {
      if (form.reminder) await planning.reminders.update(form.reminder.id, draft);
      else await planning.reminders.create(draft);
      notify(form.reminder ? 'یادآوری به‌روزرسانی شد' : 'یادآوری ساخته شد');
      setForm({ open: false, reminder: null });
      reloadReminders();
      onRefreshUnread?.();
    } catch (error) {
      notify(error.message ?? 'ذخیرهٔ یادآوری ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (reminder) => {
    await planning.reminders.toggle(reminder.id, !reminder.enabled);
    notify(reminder.enabled ? 'یادآوری غیرفعال شد' : 'یادآوری فعال شد');
    reloadReminders();
  };

  const remove = async () => {
    setBusy(true);
    try {
      await planning.reminders.remove(deleteTarget.id);
      notify('یادآوری حذف شد');
      setDeleteTarget(null);
      reloadReminders();
    } finally {
      setBusy(false);
    }
  };

  const markRead = async (id) => {
    await planning.reminders.markRead(id);
    reloadNotifications();
    onRefreshUnread?.();
  };

  const markAllRead = async () => {
    await planning.reminders.markAllRead();
    reloadNotifications();
    onRefreshUnread?.();
    notify('همهٔ اعلان‌ها خوانده‌شده شدند');
  };

  const saveSettings = async (patch) => {
    const next = { ...activeSettings, ...patch };
    setSettingsDraft(next);
    await planning.reminders.saveSettings(patch);
    reloadSettings();
    notify('تنظیمات یادآوری ذخیره شد');
  };

  const offsetLabel = (minutes) => {
    const preset = OFFSET_PRESETS.find((item) => item.value === Number(minutes));
    if (preset) return preset.label;
    if (Number(minutes) % 1440 === 0) return `${toFa(Number(minutes) / 1440)} روز قبل`;
    if (Number(minutes) % 60 === 0) return `${toFa(Number(minutes) / 60)} ساعت قبل`;
    return `${toFa(minutes)} دقیقه قبل`;
  };

  return (
    <div className="pl-stack">
      <Toolbar>
        <div className="pl-views">
          <button type="button" className={`pl-view ${tab === 'reminders' ? 'is-active' : ''}`} onClick={() => setTab('reminders')}>
            <IconBell width={14} height={14} />
            یادآوری‌ها
          </button>
          <button type="button" className={`pl-view ${tab === 'inbox' ? 'is-active' : ''}`} onClick={() => setTab('inbox')}>
            <IconWarning width={14} height={14} />
            اعلان‌ها
            {unread ? <span className="pl-badge-count">{toFa(unread)}</span> : null}
          </button>
          <button type="button" className={`pl-view ${tab === 'late' ? 'is-active' : ''}`} onClick={() => setTab('late')}>
            <IconClock width={14} height={14} />
            عقب‌افتاده‌ها
            {overdue.length ? <span className="pl-badge-count pl-badge-count--danger">{toFa(overdue.length)}</span> : null}
          </button>
        </div>

        <ToolbarSpacer />

        {tab === 'inbox' ? (
          <>
            <select className="pl-select pl-select--sm" value={notifFilters.kind} onChange={(event) => setNotifFilters((state) => ({ ...state, kind: event.target.value }))} aria-label="نوع اعلان">
              <option value="">همهٔ نوع‌ها</option>
              {NOTIFICATION_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
            <select className="pl-select pl-select--sm" value={notifFilters.priority} onChange={(event) => setNotifFilters((state) => ({ ...state, priority: event.target.value }))} aria-label="اهمیت">
              <option value="">همهٔ اهمیت‌ها</option>
              {PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
            </select>
            <button
              type="button"
              className={`pl-togglechip ${notifFilters.unreadOnly ? 'is-on' : ''}`}
              onClick={() => setNotifFilters((state) => ({ ...state, unreadOnly: !state.unreadOnly }))}
            >
              فقط خوانده‌نشده
            </button>
            <Button variant="ghost" size="sm" onClick={markAllRead} disabled={!unread}>خواندن همه</Button>
          </>
        ) : null}

        {tab === 'reminders' ? (
          <Button size="sm" onClick={() => openForm(null)}>
            <IconPlus width={15} height={15} />
            یادآوری تازه
          </Button>
        ) : null}
      </Toolbar>

      {tab === 'reminders' ? (
        <>
          <div className="pl-kpi-grid pl-kpi-grid--tight">
            <div className="pl-mini"><span className="pl-mini__label">یادآوری‌های فعال</span><b className="pl-mini__value">{toFa((reminders ?? []).filter((row) => row.enabled).length)}</b></div>
            <div className="pl-mini"><span className="pl-mini__label">تکرارشونده</span><b className="pl-mini__value">{toFa((reminders ?? []).filter((row) => row.recurrence !== 'none').length)}</b></div>
            <div className="pl-mini"><span className="pl-mini__label">غیرفعال</span><b className="pl-mini__value">{toFa((reminders ?? []).filter((row) => !row.enabled).length)}</b></div>
            <div className="pl-mini pl-mini--warn"><span className="pl-mini__label">سررسید امروز</span><b className="pl-mini__value">{toFa(dueToday.length)}</b></div>
          </div>

          {remindersLoading && !reminders ? <LoadingBlock label="در حال خواندن یادآوری‌ها…" rows={4} /> : null}

          {reminders && reminders.length === 0 ? (
            <EmptyState
              title="یادآوری‌ای ثبت نشده"
              description="برای تسک‌ها و سررسیدها یادآوری بسازید تا از قلم نیفتند."
              action={<Button size="sm" onClick={() => openForm(null)}>یادآوری تازه</Button>}
            />
          ) : null}

          {reminders && reminders.length > 0 ? (
            <div className="pl-remlist">
              {reminders.map((reminder) => {
                const target = (tasks?.items ?? []).find((task) => task.id === reminder.targetId);
                return (
                  <article key={reminder.id} className={`pl-remrow ${reminder.enabled ? '' : 'is-off'}`}>
                    <div className="pl-remrow__main">
                      <header>
                        <strong>{reminder.title}</strong>
                        <Pill tone={toneOf(PRIORITIES, reminder.priority)}>{labelOf(PRIORITIES, reminder.priority)}</Pill>
                        {reminder.recurrence !== 'none' ? <Pill tone="info">{labelOf(RECURRENCES, reminder.recurrence)}</Pill> : null}
                        {!reminder.enabled ? <Pill tone="neutral" soft={false}>غیرفعال</Pill> : null}
                      </header>

                      {reminder.body ? <p>{reminder.body}</p> : null}

                      <div className="pl-remrow__meta">
                        <span>مقصد: {labelOf(TARGET_TYPES, reminder.targetType)}</span>
                        {target ? <span>تسک: {target.title} ({jalaliLabel(target.dueDate, { short: true })})</span> : null}
                        <span>زمان: {offsetLabel(reminder.offsetMinutes)}</span>
                        <span>ساخت: {relativeFa(reminder.createdAt)}</span>
                      </div>
                    </div>

                    <div className="pl-remrow__side">
                      <Toggle checked={reminder.enabled} onChange={() => toggle(reminder)} label="" />
                      <Button variant="ghost" size="sm" onClick={() => openForm(reminder)}>ویرایش</Button>
                      <button
                        type="button"
                        className="pl-iconbtn pl-iconbtn--sm pl-iconbtn--danger"
                        onClick={() => setDeleteTarget(reminder)}
                        aria-label="حذف یادآوری"
                      >
                        <IconTrash width={14} height={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {activeSettings ? (
            <Panel title="تنظیمات شخصی یادآوری" description="این تنظیمات فقط روی حساب شما اعمال می‌شود">
              <div className="pl-settings">
                <Toggle checked={activeSettings.inApp} onChange={(value) => saveSettings({ inApp: value })} label="اعلان داخل پنل" hint="نمایش در زنگ اعلان‌ها و مرکز اعلان" />
                <Toggle checked={activeSettings.email} onChange={(value) => saveSettings({ email: value })} label="اعلان ایمیلی" hint="در صورت فعال بودن سرویس ایمیل پنل" />
                <Toggle checked={activeSettings.dailyDigest} onChange={(value) => saveSettings({ dailyDigest: value })} label="خلاصهٔ روزانه" hint="یک پیام تجمیعی از یادآوری‌های همان روز" />

                <div className="pl-settings__row">
                  <Field label="ساعت ارسال خلاصهٔ روزانه">
                    <Input
                      type="time"
                      value={activeSettings.digestTime}
                      disabled={!activeSettings.dailyDigest}
                      onChange={(event) => saveSettings({ digestTime: event.target.value })}
                    />
                  </Field>

                  <Field label="زمان پیش‌فرض یادآوری">
                    <Select
                      value={activeSettings.defaultOffset}
                      onChange={(event) => saveSettings({ defaultOffset: Number(event.target.value) })}
                      options={OFFSET_PRESETS.map((preset) => ({ value: preset.value, label: preset.label }))}
                    />
                  </Field>
                </div>

                <Toggle checked={activeSettings.quietHours} onChange={(value) => saveSettings({ quietHours: value })} label="ساعات سکوت" hint="در این بازه اعلان نمایش داده نمی‌شود" />

                <div className="pl-settings__row">
                  <Field label="از ساعت">
                    <Input type="time" value={activeSettings.quietFrom} disabled={!activeSettings.quietHours} onChange={(event) => saveSettings({ quietFrom: event.target.value })} />
                  </Field>
                  <Field label="تا ساعت">
                    <Input type="time" value={activeSettings.quietTo} disabled={!activeSettings.quietHours} onChange={(event) => saveSettings({ quietTo: event.target.value })} />
                  </Field>
                </div>

                <Field label="نوع‌های بی‌صدا" hint="اعلان‌های این نوع‌ها نمایش داده نمی‌شوند">
                  <div className="pl-chips">
                    {NOTIFICATION_KINDS.map((kind) => {
                      const on = (activeSettings.mutedKinds ?? []).includes(kind.value);
                      return (
                        <button
                          key={kind.value}
                          type="button"
                          className={`pl-togglechip ${on ? 'is-on' : ''}`}
                          onClick={() => saveSettings({
                            mutedKinds: on
                              ? activeSettings.mutedKinds.filter((item) => item !== kind.value)
                              : [...(activeSettings.mutedKinds ?? []), kind.value],
                          })}
                        >
                          {kind.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}

      {tab === 'inbox' ? (
        <>
          {notifLoading && !notifications ? <LoadingBlock label="در حال خواندن اعلان‌ها…" rows={4} /> : null}

          {notifications && notifications.length === 0 ? (
            <EmptyState title="اعلانی نیست" description="با فیلترهای دیگر امتحان کنید یا فیلترها را بردارید." />
          ) : null}

          {notifications && notifications.length > 0 ? (
            <ul className="pl-notiflist">
              {notifications.map((item) => (
                <li key={item.id} className={`pl-notifrow ${item.read ? 'is-read' : ''}`}>
                  <span className={`pl-notifrow__icon pl-notifrow__icon--${toneOf(NOTIFICATION_KINDS, item.kind)}`} aria-hidden="true">
                    <IconBell width={15} height={15} />
                  </span>

                  <div className="pl-notifrow__body">
                    <header>
                      <strong>{item.title}</strong>
                      <Pill tone={toneOf(NOTIFICATION_KINDS, item.kind)}>{labelOf(NOTIFICATION_KINDS, item.kind, 'اعلان')}</Pill>
                      <Pill tone={toneOf(PRIORITIES, item.priority)} soft={false}>{labelOf(PRIORITIES, item.priority)}</Pill>
                      <span className="pl-muted">{relativeFa(item.at)}</span>
                    </header>
                    {item.body ? <p>{item.body}</p> : null}
                  </div>

                  {!item.read && !item.auto ? (
                    <Button variant="ghost" size="sm" onClick={() => markRead(item.id)}>
                      <IconCheck width={14} height={14} />
                      خوانده شد
                    </Button>
                  ) : (
                    <span className="pl-muted">{item.read ? 'خوانده‌شده' : 'خودکار'}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {tab === 'late' ? (
        <>
          {overdue.length === 0 ? (
            <EmptyState title="تسک عقب‌افتاده‌ای نیست" description="همهٔ تسک‌های باز در مهلت خود هستند." />
          ) : (
            <Panel title={`تسک‌های عقب‌افتاده (${toFa(overdue.length)})`} description="سررسید این تسک‌ها گذشته و هنوز باز هستند">
              <ul className="pl-latelist">
                {overdue.map((task) => (
                  <li key={task.id}>
                    <Pill tone="danger" soft={false}>{labelOf(PRIORITIES, task.priority)}</Pill>
                    <code className="pl-mono">{task.code}</code>
                    <strong>{task.title}</strong>
                    <span className="pl-muted">سررسید {jalaliLabel(task.dueDate)} — {relativeFa(task.dueDate)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      ) : null}

      <Modal
        open={form.open}
        title={form.reminder ? 'ویرایش یادآوری' : 'یادآوری تازه'}
        subtitle="می‌توانید چند یادآوری برای یک تسک بسازید؛ هر کدام زمان خودش را دارد"
        onClose={() => setForm({ open: false, reminder: null })}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setForm({ open: false, reminder: null })}>انصراف</Button>
            <Button onClick={save} loading={busy} disabled={!draft.title.trim()}>ذخیره</Button>
          </>
        )}
      >
        <div className="pl-form">
          <Field label="عنوان یادآوری" required>
            <Input value={draft.title} onChange={(event) => setDraft((state) => ({ ...state, title: event.target.value }))} placeholder="مثلاً یادآوری مهلت فصل فارماکولوژی" />
          </Field>

          <Field label="متن اعلان">
            <Textarea rows={2} value={draft.body} onChange={(event) => setDraft((state) => ({ ...state, body: event.target.value }))} placeholder="این متن در اعلان نمایش داده می‌شود" />
          </Field>

          <div className="pl-form__row">
            <Field label="مقصد یادآوری">
              <Select
                value={draft.targetType}
                onChange={(event) => setDraft((state) => ({ ...state, targetType: event.target.value }))}
                options={TARGET_TYPES}
              />
            </Field>

            <Field label="تسک مرتبط" hint="برای مقصدهای غیرتسکی لازم نیست">
              <Select
                value={draft.targetId}
                onChange={(event) => setDraft((state) => ({ ...state, targetId: event.target.value }))}
                options={[{ value: '', label: 'بدون تسک مشخص' }, ...(tasks?.items ?? []).map((task) => ({ value: task.id, label: `${task.code} — ${task.title}` }))]}
              />
            </Field>
          </div>

          <div className="pl-form__row">
            <Field label="زمان یادآوری">
              <Select
                value={draft.offsetMinutes}
                onChange={(event) => setDraft((state) => ({ ...state, offsetMinutes: Number(event.target.value) }))}
                options={OFFSET_PRESETS.map((preset) => ({ value: preset.value, label: preset.label }))}
              />
            </Field>

            <Field label="تکرار">
              <Select
                value={draft.recurrence}
                onChange={(event) => setDraft((state) => ({ ...state, recurrence: event.target.value }))}
                options={RECURRENCES}
              />
            </Field>

            <Field label="اهمیت">
              <Select
                value={draft.priority}
                onChange={(event) => setDraft((state) => ({ ...state, priority: event.target.value }))}
                options={PRIORITIES.map((priority) => ({ value: priority.value, label: priority.label }))}
              />
            </Field>
          </div>

          <Toggle
            checked={draft.enabled}
            onChange={(value) => setDraft((state) => ({ ...state, enabled: value }))}
            label="یادآوری فعال باشد"
            hint="یادآوری غیرفعال در فهرست می‌ماند ولی اعلان نمی‌دهد"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف یادآوری"
        message={`یادآوری «${deleteTarget?.title ?? ''}» حذف می‌شود. این کار برگشت‌پذیر نیست.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
