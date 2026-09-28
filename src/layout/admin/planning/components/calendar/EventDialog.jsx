/*
 * پنجرهٔ ساخت و ویرایش رویداد تقویم.
 *
 * یک فرم برای هر دو کار؛ اگر `event` بدهید ویرایش می‌شود و اگر ندهید، مقدار
 * پیش‌فرض (تاریخ و ساعت کلیک‌شده) در فیلدها می‌نشیند.
 */

import { useEffect, useState } from 'react';

import { Button, ConfirmDialog, Field, Input, Modal, Select, Textarea, Toggle, useToast } from '../../../adminShared';
import { EVENT_TYPES, PRIORITIES, TASK_STATUSES, isOpenStatus } from '../../../../../services/planning/planningTypes';
import { planning } from '../../../../../services/planning/planningService';
import { isoDate } from '../../../../../services/planning/jalali';
import JalaliDatePicker from './JalaliDatePicker';

const EMPTY = {
  title: '',
  description: '',
  type: 'meeting',
  date: '',
  start: '09:00',
  end: '10:00',
  allDay: false,
  projectId: '',
  ownerId: '',
  priority: 'medium',
  status: 'issued',
  location: '',
};

export default function EventDialog({
  open, event, defaults, projects = [], users = [], onClose, onSaved,
}) {
  const notify = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (event) {
      setForm({
        ...EMPTY,
        ...event,
        projectId: event.projectId ?? '',
        ownerId: event.ownerId ?? '',
      });
    } else {
      setForm({
        ...EMPTY,
        date: defaults?.date ?? isoDate(new Date()),
        start: defaults?.start ?? '09:00',
        end: defaults?.end ?? '10:00',
        ownerId: users[0]?.id ?? '',
      });
    }
    setErrors({});
  }, [open, event, defaults, users]);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const payload = { ...form, projectId: form.projectId || null };
      const saved = event
        ? await planning.calendar.update(event.id, payload)
        : await planning.calendar.create(payload);
      notify(event ? 'رویداد به‌روزرسانی شد' : 'رویداد ساخته شد');
      onSaved?.(saved);
      onClose?.();
    } catch (error) {
      setErrors(error.fields ?? {});
      notify(error.message ?? 'ذخیرهٔ رویداد ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await planning.calendar.remove(event.id);
      notify('رویداد حذف شد');
      setConfirmDelete(false);
      onSaved?.(null);
      onClose?.();
    } catch (error) {
      notify(error.message ?? 'حذف ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const done = form.status === 'done';

  return (
    <>
      <Modal
        open={open}
        size="lg"
        title={event ? 'ویرایش رویداد' : 'رویداد تازه'}
        subtitle={event ? 'تغییرات در تقویم و نمای کلی بازتاب داده می‌شود' : 'رویداد در تقویم شمسی ثبت می‌شود'}
        onClose={busy ? undefined : onClose}
        footer={(
          <>
            {event ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} disabled={busy}>
                حذف
              </Button>
            ) : null}
            <span className="pl-spacer" />
            <Button variant="ghost" onClick={onClose} disabled={busy}>انصراف</Button>
            <Button onClick={submit} loading={busy}>{event ? 'ذخیرهٔ تغییرات' : 'ساخت رویداد'}</Button>
          </>
        )}
      >
        <div className="pl-form">
          <Field label="عنوان رویداد" required error={errors.title}>
            <Input value={form.title} onChange={(event_) => set({ title: event_.target.value })} placeholder="مثلاً جلسهٔ هفتگی واحد" />
          </Field>

          <div className="pl-form__row">
            <Field label="نوع رویداد">
              <Select
                value={form.type}
                onChange={(event_) => set({ type: event_.target.value })}
                options={EVENT_TYPES.map((type) => ({ value: type.value, label: type.label }))}
              />
            </Field>

            <Field label="اولویت">
              <Select
                value={form.priority}
                onChange={(event_) => set({ priority: event_.target.value })}
                options={PRIORITIES.map((priority) => ({ value: priority.value, label: priority.label }))}
              />
            </Field>

            <Field label="وضعیت">
              <Select
                value={form.status}
                onChange={(event_) => set({ status: event_.target.value })}
                options={TASK_STATUSES.filter((status) => isOpenStatus(status.value) || status.value === 'done')
                  .map((status) => ({ value: status.value, label: status.label }))}
              />
            </Field>
          </div>

          <div className="pl-form__row">
            <Field label="تاریخ" required error={errors.date}>
              <JalaliDatePicker value={form.date} onChange={(iso) => set({ date: iso })} allowClear={false} />
            </Field>

            <Field label="پروژه / بخش">
              <Select
                value={form.projectId}
                onChange={(event_) => set({ projectId: event_.target.value })}
                options={[{ value: '', label: 'بدون پروژه' }, ...projects.map((project) => ({ value: project.id, label: project.title }))]}
              />
            </Field>

            <Field label="مسئول">
              <Select
                value={form.ownerId}
                onChange={(event_) => set({ ownerId: event_.target.value })}
                options={[{ value: '', label: 'انتخاب کنید' }, ...users.map((user) => ({ value: user.id, label: `${user.name} — ${user.role}` }))]}
              />
            </Field>
          </div>

          <Toggle
            checked={form.allDay}
            onChange={(checked) => set({ allDay: checked })}
            label="رویداد تمام‌روز"
            hint="در این حالت ساعت شروع و پایان در تقویم نمایش داده نمی‌شود"
          />

          {!form.allDay ? (
            <div className="pl-form__row">
              <Field label="ساعت شروع">
                <Input type="time" value={form.start} onChange={(event_) => set({ start: event_.target.value })} />
              </Field>
              <Field label="ساعت پایان">
                <Input type="time" value={form.end} onChange={(event_) => set({ end: event_.target.value })} />
              </Field>
              <Field label="محل برگزاری">
                <Input value={form.location} onChange={(event_) => set({ location: event_.target.value })} placeholder="اتاق جلسه یا آنلاین" />
              </Field>
            </div>
          ) : (
            <Field label="محل برگزاری">
              <Input value={form.location} onChange={(event_) => set({ location: event_.target.value })} placeholder="اتاق جلسه یا آنلاین" />
            </Field>
          )}

          <Field label="توضیحات">
            <Textarea rows={3} value={form.description} onChange={(event_) => set({ description: event_.target.value })} placeholder="دستور جلسه، نکته‌ها یا پیوست‌های لازم…" />
          </Field>

          {done ? (
            <p className="pl-hint">این رویداد در وضعیت «تکمیل‌شده» است و در فهرست رویدادهای پیش‌رو نمای کلی نمی‌آید.</p>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف رویداد"
        message={`رویداد «${form.title}» برای همیشه از تقویم حذف می‌شود. این کار برگشت‌پذیر نیست.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
