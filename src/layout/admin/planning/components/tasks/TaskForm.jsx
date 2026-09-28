/*
 * فرم ساخت و ویرایش تسک.
 *
 * فیلدها همان‌هایی هستند که مدل `Task` تعریف کرده؛ اعتبارسنجی سمت سرویس انجام
 * می‌شود و خطاهای فیلدی برگشتی مستقیم زیر همان فیلد می‌نشیند.
 */

import { useEffect, useState } from 'react';

import { Button, ConfirmDialog, Field, Input, Modal, Select, Textarea, useToast } from '../../../adminShared';
import { PRIORITIES, TASK_STATUSES } from '../../../../../services/planning/planningTypes';
import { planning } from '../../../../../services/planning/planningService';
import { isoDate } from '../../../../../services/planning/jalali';
import JalaliDatePicker from '../calendar/JalaliDatePicker';

const EMPTY = {
  title: '',
  description: '',
  projectId: '',
  unitId: '',
  ownerId: '',
  recipientIds: [],
  startDate: '',
  dueDate: '',
  priority: 'medium',
  status: 'draft',
  progress: 0,
  tags: '',
};

export default function TaskForm({
  open, task, defaults, projects = [], users = [], units = [], onClose, onSaved,
}) {
  const notify = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        ...EMPTY,
        ...task,
        projectId: task.projectId ?? '',
        unitId: task.unitId ?? '',
        tags: (task.tags ?? []).join('، '),
      });
    } else {
      setForm({
        ...EMPTY,
        startDate: isoDate(new Date()),
        dueDate: isoDate(new Date(Date.now() + 7 * 86_400_000)),
        ownerId: defaults?.ownerId ?? users[0]?.id ?? '',
        projectId: defaults?.projectId ?? '',
        status: defaults?.status ?? 'draft',
      });
    }
    setErrors({});
  }, [open, task, defaults, users]);

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const payload = {
        ...form,
        projectId: form.projectId || null,
        tags: String(form.tags ?? '').split(/[،,]/).map((tag) => tag.trim()).filter(Boolean),
        progress: Number(form.progress) || 0,
      };
      const saved = task
        ? await planning.tasks.update(task.id, payload)
        : await planning.tasks.create(payload);
      notify(task ? 'تسک به‌روزرسانی شد' : 'تسک ساخته شد');
      onSaved?.(saved);
      onClose?.();
    } catch (error) {
      setErrors(error.fields ?? {});
      notify(error.message ?? 'ذخیرهٔ تسک ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await planning.tasks.remove(task.id);
      notify('تسک حذف شد');
      setConfirmDelete(false);
      onSaved?.(null);
      onClose?.();
    } catch (error) {
      notify(error.message ?? 'حذف ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleRecipient = (id) => {
    setForm((current) => ({
      ...current,
      recipientIds: current.recipientIds.includes(id)
        ? current.recipientIds.filter((item) => item !== id)
        : [...current.recipientIds, id],
    }));
  };

  return (
    <>
      <Modal
        open={open}
        size="lg"
        title={task ? `ویرایش تسک ${task.code}` : 'تسک تازه'}
        subtitle="تسک در فهرست، برد کانبان، تقویم و جدول مدیریتی نمایش داده می‌شود"
        onClose={busy ? undefined : onClose}
        footer={(
          <>
            {task ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} disabled={busy}>حذف</Button>
            ) : null}
            <span className="pl-spacer" />
            <Button variant="ghost" onClick={onClose} disabled={busy}>انصراف</Button>
            <Button onClick={submit} loading={busy}>{task ? 'ذخیرهٔ تغییرات' : 'ساخت تسک'}</Button>
          </>
        )}
      >
        <div className="pl-form">
          <Field label="عنوان تسک" required error={errors.title}>
            <Input value={form.title} onChange={(event) => set({ title: event.target.value })} placeholder="مثلاً بازبینی فصل قلب" />
          </Field>

          <Field label="توضیحات">
            <Textarea rows={3} value={form.description} onChange={(event) => set({ description: event.target.value })} placeholder="شرح کار، معیار پذیرش و نکته‌های اجرایی…" />
          </Field>

          <div className="pl-form__row">
            <Field label="پروژه یا بخش">
              <Select
                value={form.projectId}
                onChange={(event) => {
                  const project = projects.find((item) => item.id === event.target.value);
                  set({ projectId: event.target.value, unitId: project?.unitId ?? form.unitId });
                }}
                options={[{ value: '', label: 'بدون پروژه' }, ...projects.map((project) => ({ value: project.id, label: project.title }))]}
              />
            </Field>

            <Field label="واحد سازمانی">
              <Select
                value={form.unitId}
                onChange={(event) => set({ unitId: event.target.value })}
                options={[{ value: '', label: 'انتخاب کنید' }, ...units.map((unit) => ({ value: unit.id, label: unit.name }))]}
              />
            </Field>

            <Field label="مسئول اصلی" required error={errors.ownerId}>
              <Select
                value={form.ownerId}
                onChange={(event) => {
                  const user = users.find((item) => item.id === event.target.value);
                  set({ ownerId: event.target.value, unitId: form.unitId || user?.unitId || '' });
                }}
                options={[{ value: '', label: 'انتخاب کنید' }, ...users.map((user) => ({ value: user.id, label: `${user.name} — ${user.role}` }))]}
              />
            </Field>
          </div>

          <div className="pl-form__row">
            <Field label="تاریخ شروع">
              <JalaliDatePicker value={form.startDate} onChange={(iso) => set({ startDate: iso })} allowClear={false} />
            </Field>

            <Field label="تاریخ سررسید" required error={errors.dueDate}>
              <JalaliDatePicker value={form.dueDate} onChange={(iso) => set({ dueDate: iso })} allowClear={false} />
            </Field>

            <Field label="اولویت">
              <Select
                value={form.priority}
                onChange={(event) => set({ priority: event.target.value })}
                options={PRIORITIES.map((priority) => ({ value: priority.value, label: priority.label }))}
              />
            </Field>

            <Field label="وضعیت">
              <Select
                value={form.status}
                onChange={(event) => set({ status: event.target.value })}
                options={TASK_STATUSES.map((status) => ({ value: status.value, label: status.label }))}
              />
            </Field>
          </div>

          <Field label="درصد پیشرفت" hint="با رسیدن به ۱۰۰٪، وضعیت خودکار «تکمیل‌شده» می‌شود">
            <div className="pl-range">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={form.progress}
                onChange={(event) => set({ progress: Number(event.target.value) })}
              />
              <b>{form.progress}٪</b>
            </div>
          </Field>

          <Field label="برچسب‌ها" hint="با ویرگول جدا کنید">
            <Input value={form.tags} onChange={(event) => set({ tags: event.target.value })} placeholder="تألیف، بازبینی، فوری" />
          </Field>

          <Field label="دریافت‌کنندگان" hint="افرادی که در جریان این تسک قرار می‌گیرند">
            <div className="pl-checklist">
              {users.map((user) => (
                <label key={user.id} className={`pl-checklist__row ${form.recipientIds.includes(user.id) ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.recipientIds.includes(user.id)}
                    onChange={() => toggleRecipient(user.id)}
                  />
                  <span>{user.name}</span>
                  <small>{user.role}</small>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف تسک"
        message={`تسک «${task?.title ?? ''}» همراه ابلاغ‌ها و یادآوری‌های مرتبطش حذف می‌شود. این کار برگشت‌پذیر نیست.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
