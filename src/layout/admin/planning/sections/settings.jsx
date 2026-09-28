/*
 * بخش «تنظیمات برنامه‌ریزی».
 *
 * سه دسته: تنظیمات نمایش و کاری ماژول، کاربر جاری و سطح دسترسی (فقط خواندنی،
 * از نشست پنل می‌آید) و مدیریت دادهٔ ماژول (حجم اشغال‌شده، تازه‌سازی کاربران از
 * API واقعی، پاک‌کردن دادهٔ محتوایی).
 *
 * ساختار سازمانی، پروژه‌ها و کاربران از مخازن واقعی پروژه می‌آیند؛ «پاک‌کردن
 * داده» فقط محتوای ثبت‌شده (تسک، رویداد، ابلاغ، یادآوری، تراکنش، SOP) را حذف
 * می‌کند تا ماژول بی‌ساختار نشود.
 */

import { useState } from 'react';

import {
  Button, ConfirmDialog, Field, Input, Toggle, faFileSize, useAsync, useToast,
} from '../../adminShared';
import { IconRefresh, IconShield, IconSliders, IconUserCheck } from '../../adminIcons';
import { planning, getViewer, storageAvailable } from '../../../../services/planning/planningService';
import { ORG_LEVELS, labelOf } from '../../../../services/planning/planningTypes';
import { toFa } from '../../../../services/planning/jalali';
import { Panel, Pill } from '../planningKit';
import { JalaliMonthSelect } from '../components/calendar/JalaliDatePicker';

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const VIEW_OPTIONS = [
  { value: 'year', label: 'سالانه' },
  { value: 'month', label: 'ماهانه' },
  { value: 'week', label: 'هفتگی' },
  { value: 'day', label: 'روزانه' },
];

export default function PlanningSettingsSection() {
  const notify = useToast();
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: settings, reload } = useAsync(() => planning.settings.get(), []);
  const { data: usage, reload: reloadUsage } = useAsync(() => planning.settings.usage(), []);
  const { data: units, reload: reloadUnits } = useAsync(() => planning.org.units(), []);
  const { data: users, reload: reloadUsers } = useAsync(() => planning.org.users(), []);

  const viewer = getViewer();
  const counts = usage?.counts ?? {};

  const save = async (patch) => {
    await planning.settings.save(patch);
    reload();
    notify('تنظیمات ذخیره شد');
  };

  const toggleWorkday = (day) => {
    const current = settings?.workingDays ?? [];
    save({ workingDays: current.includes(day) ? current.filter((item) => item !== day) : [...current, day] });
  };

  /* خواندن دوبارهٔ کاربران از `GET /api/admin/users` */
  const refreshUsers = async () => {
    setBusy(true);
    try {
      await planning.org.refreshUsers();
      reloadUsers();
      reloadUnits();
      reloadUsage();
      notify('فهرست کاربران از سرور تازه شد');
    } catch (error) {
      notify(error.message ?? 'تازه‌سازی کاربران ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const clearData = async () => {
    setBusy(true);
    try {
      await planning.settings.clear();
      notify('دادهٔ ماژول پاک شد');
      setClearOpen(false);
      reloadUsage();
    } finally {
      setBusy(false);
    }
  };

  if (!settings) return <div className="pl-boot">در حال خواندن تنظیمات…</div>;

  return (
    <div className="pl-stack">
      <Panel title="نمایش و رفتار تقویم" description="این تنظیمات روی نمای تقویم و بردهای کاری اثر می‌گذارد">
        <div className="pl-form">
          <div className="pl-form__row">
            <Field label="نمای پیش‌فرض تقویم">
              <select className="pl-select" value={settings.defaultView} onChange={(event) => save({ defaultView: event.target.value })}>
                {VIEW_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>

            <Field label="آغاز سال مالی" hint="مبنای گزارش‌های مالی">
              <JalaliMonthSelect value={settings.fiscalYearStart} onChange={(month) => month && save({ fiscalYearStart: month })} />
            </Field>

            <Field label="مهلت اضافه برای عقب‌افتاده" hint="تعداد روزی که پیش از «عقب‌افتاده» شمردن نادیده گرفته می‌شود">
              <Input
                type="number"
                min="0"
                max="10"
                value={settings.overdueGraceDays}
                onChange={(event) => save({ overdueGraceDays: Number(event.target.value) })}
              />
            </Field>
          </div>

          <Field label="روزهای کاری هفته" hint="در نمای هفتگی همین روزها برجسته می‌شوند">
            <div className="pl-chips">
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`pl-togglechip ${(settings.workingDays ?? []).includes(day) ? 'is-on' : ''}`}
                  onClick={() => toggleWorkday(day)}
                >
                  {day}
                </button>
              ))}
            </div>
          </Field>

          <div className="pl-form__row">
            <Field label="ساعت شروع روز کاری">
              <Input type="time" value={settings.workingHours?.from ?? '08:00'} onChange={(event) => save({ workingHours: { ...settings.workingHours, from: event.target.value } })} />
            </Field>
            <Field label="ساعت پایان روز کاری" hint="نمای هفتگی و روزانه همین بازه را نشان می‌دهند">
              <Input type="time" value={settings.workingHours?.to ?? '20:00'} onChange={(event) => save({ workingHours: { ...settings.workingHours, to: event.target.value } })} />
            </Field>
          </div>

          <div className="pl-settings">
            <Toggle checked={settings.showHolidays} onChange={(value) => save({ showHolidays: value })} label="نمایش تعطیلات رسمی" hint="روزهای تعطیل در تقویم با رنگ متفاوت دیده می‌شوند" />
            <Toggle checked={settings.showWeekNumbers} onChange={(value) => save({ showWeekNumbers: value })} label="نمایش شمارهٔ هفته" hint="در نمای ماهانه و هفتگی" />
            <Toggle checked={settings.compactCards} onChange={(value) => save({ compactCards: value })} label="کارت‌های فشرده" hint="در فهرست‌های طولانی، ارتفاع هر ردیف کمتر می‌شود" />
          </div>
        </div>
      </Panel>

      <Panel title="کاربر جاری و سطح دسترسی" description="سطح دسترسی از نقش و مجوزهای نشست پنل استنتاج می‌شود و از این‌جا تغییر نمی‌کند">
        <div className="pl-viewerbox">
          <span className="pl-avatar" aria-hidden="true">{(viewer.name || '؟').slice(0, 1)}</span>
          <div>
            <strong>{viewer.name}</strong>
            <span className="pl-muted">{viewer.role}</span>
          </div>
          <Pill tone="info" soft={false}>{labelOf(ORG_LEVELS, viewer.level)}</Pill>
          <Pill tone="neutral">{units?.find((unit) => unit.id === viewer.unitId)?.name ?? 'بدون واحد'}</Pill>
        </div>

        <ul className="pl-permlist">
          <li><IconShield width={15} height={15} /> <span>مدیر کل</span><b>دسترسی به همهٔ تسک‌ها، ابلاغ‌ها و اسناد همهٔ واحدها</b></li>
          <li><IconShield width={15} height={15} /> <span>مدیر واحد</span><b>تسک‌های واحد خود و واحدهای زیرمجموعه</b></li>
          <li><IconShield width={15} height={15} /> <span>مسئول بخش</span><b>تسک‌های بخش خود و ابلاغ‌های دریافتی</b></li>
          <li><IconShield width={15} height={15} /> <span>عضو تیم</span><b>فقط تسک‌هایی که مسئول یا دریافت‌کنندهٔ آن است</b></li>
        </ul>

        <p className="pl-hint">
          کاربران از مخزن رسمی پنل خوانده می‌شوند (<code className="pl-mono">GET /api/admin/users</code>) و واحد هر نفر از
          فضای‌نام مجوزهایش استنتاج می‌شود. برای تغییر سطح دسترسی هر نفر، از بخش «کاربران» پنل عمل کنید.
        </p>
      </Panel>

      <Panel title="مدیریت داده" description="دادهٔ ماژول در حافظهٔ مرورگر می‌ماند تا با رفرش از بین نرود">
        <div className="pl-kpi-grid pl-kpi-grid--tight">
          <div className="pl-mini"><span className="pl-mini__label">حجم دادهٔ ذخیره‌شده</span><b className="pl-mini__value">{faFileSize(usage?.bytes ?? 0)}</b></div>
          <div className={`pl-mini ${usage?.persistent ? 'pl-mini--good' : 'pl-mini--critical'}`}>
            <span className="pl-mini__label">ذخیره‌سازی پایدار</span>
            <b className="pl-mini__value">{usage?.persistent ? 'فعال' : 'غیرفعال'}</b>
          </div>
          <div className="pl-mini"><span className="pl-mini__label">واحدهای سازمانی</span><b className="pl-mini__value">{toFa((units ?? []).length)}</b></div>
          <div className="pl-mini"><span className="pl-mini__label">کاربران</span><b className="pl-mini__value">{toFa((users ?? []).length)}</b></div>
          <div className="pl-mini"><span className="pl-mini__label">تسک‌ها</span><b className="pl-mini__value">{toFa(counts.tasks ?? 0)}</b></div>
          <div className="pl-mini"><span className="pl-mini__label">رویدادها</span><b className="pl-mini__value">{toFa(counts.events ?? 0)}</b></div>
          <div className="pl-mini"><span className="pl-mini__label">تراکنش‌های مالی</span><b className="pl-mini__value">{toFa(counts.transactions ?? 0)}</b></div>
          <div className="pl-mini"><span className="pl-mini__label">SOPها</span><b className="pl-mini__value">{toFa(counts.sops ?? 0)}</b></div>
        </div>

        {!storageAvailable() ? (
          <p className="pl-hint pl-hint--warn">
            مرورگر اجازهٔ ذخیره‌سازی پایدار نمی‌دهد (حالت ناشناس یا مسدود بودن کوکی). ماژول کار می‌کند ولی
            تغییرات پس از بستن مرورگر از بین می‌رود.
          </p>
        ) : null}

        <div className="pl-settings__actions">
          <Button variant="ghost" size="sm" onClick={() => { reload(); reloadUsage(); notify('تازه‌سازی شد'); }}>
            <IconSliders width={15} height={15} />
            تازه‌سازی وضعیت
          </Button>
          <Button variant="ghost" size="sm" loading={busy} onClick={refreshUsers}>
            <IconUserCheck width={15} height={15} />
            خواندن دوبارهٔ کاربران از سرور
          </Button>
          <Button variant="danger" size="sm" onClick={() => setClearOpen(true)}>
            <IconRefresh width={15} height={15} />
            پاک‌کردن دادهٔ ماژول
          </Button>
        </div>

        <p className="pl-hint">
          پاک‌کردن، فقط محتوای ثبت‌شده را حذف می‌کند: تسک‌ها، رویدادها، ابلاغ‌ها، یادآوری‌ها، اعلان‌ها، تراکنش‌های مالی و SOPها.
          ساختار واقعی پروژه (واحدها، پروژه‌ها، تعطیلات رسمی) و تنظیمات دست‌نخورده می‌ماند.
        </p>
      </Panel>

      <ConfirmDialog
        open={clearOpen}
        title="پاک‌کردن دادهٔ ماژول"
        message="همهٔ تسک‌ها، رویدادها، ابلاغ‌ها، یادآوری‌ها، تراکنش‌های مالی و SOPهای ثبت‌شده حذف می‌شوند. این کار برگشت‌پذیر نیست."
        confirmLabel="پاک کن"
        busy={busy}
        onConfirm={clearData}
        onCancel={() => setClearOpen(false)}
      />
    </div>
  );
}
