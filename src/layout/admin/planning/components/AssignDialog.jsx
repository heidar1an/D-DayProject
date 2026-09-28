/*
 * پنجرهٔ ابلاغ تسک به بخش‌ها، واحدها و افراد پایین‌رده.
 *
 * همین پنجره هم از بخش «تسک‌ها» باز می‌شود (روی یک تسک مشخص) و هم از بخش
 * «ابلاغ‌ها» (با انتخاب تسک). سطح دسترسی، مهلت، الزام گزارش و کانال اعلان در
 * همین‌جا تعیین می‌شود و همهٔ این‌ها در تاریخچهٔ فعالیت ثبت می‌شوند.
 */

import { useEffect, useMemo, useState } from 'react';

import { Button, Field, Input, Modal, Select, Textarea, Toggle, useToast } from '../../adminShared';
import { ACCESS_LEVELS, ORG_LEVELS, REPORT_CYCLES, labelOf } from '../../../../services/planning/planningTypes';
import { planning } from '../../../../services/planning/planningService';
import { isoDate } from '../../../../services/planning/jalali';
import JalaliDatePicker from './calendar/JalaliDatePicker';
import { Pill } from '../planningKit';

export default function AssignDialog({
  open, task, tasks = [], units = [], users = [], onClose, onSaved,
}) {
  const notify = useToast();

  const [form, setForm] = useState({
    taskId: '',
    recipientIds: [],
    unitIds: [],
    accessLevel: 'view',
    dueDate: '',
    requireReport: true,
    reportCycle: 'weekly',
    notifyInApp: true,
    notifyEmail: false,
    note: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      taskId: task?.id ?? tasks[0]?.id ?? '',
      recipientIds: task?.recipientIds ?? [],
      unitIds: task?.unitId ? [task.unitId] : [],
      accessLevel: 'view',
      dueDate: task?.dueDate ?? isoDate(new Date(Date.now() + 7 * 86_400_000)),
      requireReport: true,
      reportCycle: 'weekly',
      notifyInApp: true,
      notifyEmail: false,
      note: '',
    });
    setErrors({});
  }, [open, task, tasks]);

  const selectedTask = useMemo(
    () => tasks.find((item) => item.id === form.taskId) ?? task ?? null,
    [tasks, form.taskId, task],
  );

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const toggle = (key, id) => setForm((current) => ({
    ...current,
    [key]: current[key].includes(id)
      ? current[key].filter((item) => item !== id)
      : [...current[key], id],
  }));

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      await planning.assignments.issue(form);
      notify('تسک ابلاغ شد');
      onSaved?.();
      onClose?.();
    } catch (error) {
      setErrors(error.fields ?? {});
      notify(error.message ?? 'ابلاغ ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const recipientCount = form.recipientIds.length + form.unitIds.length;

  return (
    <Modal
      open={open}
      size="lg"
      title="ابلاغ تسک"
      subtitle="گیرندگان، سطح دسترسی و مهلت انجام را تعیین کنید"
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <span className="pl-muted">{recipientCount ? `${recipientCount} گیرنده انتخاب شده` : 'گیرنده‌ای انتخاب نشده'}</span>
          <span className="pl-spacer" />
          <Button variant="ghost" onClick={onClose} disabled={busy}>انصراف</Button>
          <Button onClick={submit} loading={busy} disabled={!form.taskId}>ابلاغ کن</Button>
        </>
      )}
    >
      <div className="pl-form">
        <Field label="تسک" required error={errors.taskId}>
          {task ? (
            <div className="pl-readonly">
              <code className="pl-mono">{task.code}</code>
              <strong>{task.title}</strong>
              <Pill tone="neutral">{task.unitId ? units.find((unit) => unit.id === task.unitId)?.name ?? 'بدون واحد' : 'بدون واحد'}</Pill>
            </div>
          ) : (
            <Select
              value={form.taskId}
              onChange={(event) => {
                const next = tasks.find((item) => item.id === event.target.value);
                set({ taskId: event.target.value, dueDate: next?.dueDate ?? form.dueDate });
              }}
              options={tasks.map((item) => ({ value: item.id, label: `${item.code} — ${item.title}` }))}
            />
          )}
        </Field>

        <div className="pl-assign__grid">
          <Field label="افراد دریافت‌کننده" error={errors.recipientIds}>
            <div className="pl-checklist">
              {users.map((user) => (
                <label key={user.id} className={`pl-checklist__row ${form.recipientIds.includes(user.id) ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={form.recipientIds.includes(user.id)} onChange={() => toggle('recipientIds', user.id)} />
                  <span>{user.name}</span>
                  <small>{labelOf(ORG_LEVELS, user.level)}</small>
                </label>
              ))}
            </div>
          </Field>

          <Field label="واحدهای دریافت‌کننده">
            <div className="pl-checklist">
              {units.map((unit) => (
                <label key={unit.id} className={`pl-checklist__row ${form.unitIds.includes(unit.id) ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={form.unitIds.includes(unit.id)} onChange={() => toggle('unitIds', unit.id)} />
                  <span>{unit.name}</span>
                  <small>{labelOf(ORG_LEVELS, unit.level)}</small>
                </label>
              ))}
            </div>
          </Field>
        </div>

        <div className="pl-form__row">
          <Field label="سطح دسترسی">
            <Select
              value={form.accessLevel}
              onChange={(event) => set({ accessLevel: event.target.value })}
              options={ACCESS_LEVELS.map((level) => ({ value: level.value, label: level.label }))}
            />
          </Field>

          <Field label="مهلت انجام">
            <JalaliDatePicker value={form.dueDate} onChange={(iso) => set({ dueDate: iso })} allowClear={false} />
          </Field>

          <Field label="دورهٔ گزارش" hint="در صورت الزام به گزارش پیشرفت">
            <Select
              value={form.reportCycle}
              onChange={(event) => set({ reportCycle: event.target.value })}
              options={REPORT_CYCLES.map((cycle) => ({ value: cycle.value, label: cycle.label }))}
            />
          </Field>
        </div>

        <div className="pl-assign__toggles">
          <Toggle
            checked={form.requireReport}
            onChange={(checked) => set({ requireReport: checked })}
            label="الزام به گزارش پیشرفت"
            hint="گیرنده باید در بازهٔ تعیین‌شده پیشرفت را ثبت کند"
          />
          <Toggle
            checked={form.notifyInApp}
            onChange={(checked) => set({ notifyInApp: checked })}
            label="اعلان داخلی پنل"
            hint="اعلان در زنگ بالای ماژول نمایش داده می‌شود"
          />
          <Toggle
            checked={form.notifyEmail}
            onChange={(checked) => set({ notifyEmail: checked })}
            label="اعلان ایمیلی"
            hint="فقط اگر ارسال ایمیل در تنظیمات پنل فعال باشد"
          />
        </div>

        <Field label="یادداشت ابلاغ">
          <Textarea rows={3} value={form.note} onChange={(event) => set({ note: event.target.value })} placeholder="انتظار شما از گیرنده، نکته‌های اجرایی یا معیار پذیرش…" />
        </Field>

        {selectedTask ? (
          <p className="pl-hint">
            وضعیت کنونی تسک: <b>{selectedTask.status}</b> — پس از ابلاغ، تسک پیش‌نویس خودکار به «ابلاغ‌شده» می‌رود.
          </p>
        ) : null}

        <Field label="زمان و ابلاغ‌کننده" hint="این دو مقدار خودکار ثبت می‌شوند و در تاریخچه می‌مانند">
          <Input value={new Date().toLocaleString('fa-IR')} readOnly dir="rtl" />
        </Field>
      </div>
    </Modal>
  );
}
