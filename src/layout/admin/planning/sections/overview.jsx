/*
 * نمای کلی ماژول برنامه‌ریزی.
 *
 * یک صفحه، یک واکشی: `overview.summary` همهٔ چیزهایی را که مدیر هر صبح لازم دارد
 * یک‌جا می‌آورد (تسک امروز، عقب‌افتاده، رویداد نزدیک، ابلاغ منتظر اقدام، یادآوری
 * امروز، خلاصهٔ مالی و فعالیت‌های اخیر). هر کارت به بخش تخصصی خودش لینک می‌شود.
 */

import { useCallback } from 'react';

import { Button, LoadingBlock, useAsync } from '../../adminShared';
import {
  IconBell, IconCalendar, IconCheck, IconClock, IconCoins, IconSend, IconTrendUp, IconWarning,
} from '../../adminIcons';
import { planning } from '../../../../services/planning/planningService';
import {
  ASSIGNMENT_STATES, EVENT_TYPES, PRIORITIES, RECURRENCES, labelOf, toneOf,
} from '../../../../services/planning/planningTypes';
import {
  faCompact, faPercent, faTime, faToman, isoDate, jalaliLabel, relativeFa, toFa,
} from '../../../../services/planning/jalali';
import { Donut, Kpi, Legend, Panel, Pill, SectionHero } from '../planningKit';

export default function OverviewSection({ admin, onNavigate }) {
  const loader = useCallback(() => planning.overview.summary(), []);
  const { data, loading, error, reload } = useAsync(loader, []);

  if (loading && !data) return <LoadingBlock label="در حال آماده‌سازی نمای کلی…" rows={6} />;

  if (error) {
    return (
      <div className="pl-stack">
        <div className="pl-inline-error" role="alert">
          <div><strong>نمای کلی خوانده نشد</strong><p>{error.message}</p></div>
          <button type="button" className="pl-linkbtn" onClick={() => reload()}>تلاش دوباره</button>
        </div>
      </div>
    );
  }

  const financial = data?.financial ?? {};
  const compare = data?.financialCompare ?? {};
  const delta = compare.delta ?? {};

  const statusSlices = (data?.stats?.byStatus ?? [])
    .filter((status) => status.count > 0)
    .map((status) => ({ label: status.label, value: status.count, color: status.color }));

  return (
    <div className="pl-stack">
      <SectionHero
        eyebrow={jalaliLabel(isoDate(new Date()))}
        title={`سلام ${admin?.name ?? ''}`}
        description="تصویر امروز تپش: کارهای در جریان، رویدادهای نزدیک و وضعیت مالی"
        actions={(
          <>
            <Button variant="ghost" size="sm" onClick={() => reload()}>به‌روزرسانی</Button>
            <Button size="sm" onClick={() => onNavigate?.('tasks')}>مدیریت تسک‌ها</Button>
          </>
        )}
      />

      {/* ── خلاصهٔ مالی ── */}
      <div className="pl-kpi-grid">
        <Kpi
          label="مجموع پول ورودی (سال جاری)"
          value={faToman(financial.inflow, { unit: false })}
          unit="تومان"
          tone="green"
          icon={IconCoins}
          delta={delta.inflow}
          hint={`مقایسه با ${compare.label ?? 'سال قبل'}`}
          onClick={() => onNavigate?.('finance')}
        />
        <Kpi
          label="سود ناخالص"
          value={faToman(financial.grossProfit, { unit: false })}
          unit="تومان"
          tone="accent"
          icon={IconTrendUp}
          delta={delta.grossProfit}
          onClick={() => onNavigate?.('finance')}
        />
        <Kpi
          label="سود خالص"
          value={faToman(financial.netProfit, { unit: false })}
          unit="تومان"
          tone={financial.netProfit >= 0 ? 'blue' : 'danger'}
          delta={delta.netProfit}
          hint={`حاشیهٔ سود ${faPercent(financial.margin)}`}
          onClick={() => onNavigate?.('finance')}
        />
        <Kpi
          label="مجموع هزینه‌ها"
          value={faToman(financial.expenses, { unit: false })}
          unit="تومان"
          tone="gold"
          delta={delta.expenses}
          hint={`میانگین درآمد ماهانه ${faCompact(financial.monthlyAverage)} تومان`}
          onClick={() => onNavigate?.('finance')}
        />
      </div>

      <div className="pl-kpi-grid pl-kpi-grid--tight">
        <div className="pl-mini"><span className="pl-mini__label">تسک‌های امروز</span><b className="pl-mini__value">{toFa((data?.todayTasks ?? []).length)}</b></div>
        <div className="pl-mini pl-mini--critical"><span className="pl-mini__label">عقب‌افتاده</span><b className="pl-mini__value">{toFa((data?.overdue ?? []).length)}</b></div>
        <div className="pl-mini pl-mini--warn"><span className="pl-mini__label">ابلاغ منتظر اقدام</span><b className="pl-mini__value">{toFa((data?.pendingAssignments ?? []).length)}</b></div>
        <div className="pl-mini"><span className="pl-mini__label">یادآوری‌های امروز</span><b className="pl-mini__value">{toFa((data?.reminders ?? []).length)}</b></div>
        <div className="pl-mini"><span className="pl-mini__label">اعلان خوانده‌نشده</span><b className="pl-mini__value">{toFa((data?.notifications ?? []).length)}</b></div>
      </div>

      <div className="pl-chartgrid pl-chartgrid--split">
        {/* ── تسک‌های امروز ── */}
        <Panel
          title="تسک‌های امروز"
          description="کارهایی که سررسیدشان امروز است"
          actions={<button type="button" className="pl-linkbtn" onClick={() => onNavigate?.('tasks')}>همهٔ تسک‌ها</button>}
        >
          {(data?.todayTasks ?? []).length === 0 ? (
            <p className="pl-muted"><IconCheck width={15} height={15} /> امروز تسکی با سررسید امروز ندارید.</p>
          ) : (
            <ul className="pl-compactlist">
              {data.todayTasks.map((task) => (
                <li key={task.id}>
                  <Pill tone={toneOf(PRIORITIES, task.priority)} soft={false}>{labelOf(PRIORITIES, task.priority)}</Pill>
                  <div>
                    <strong>{task.title}</strong>
                    <span className="pl-muted">{task.owner?.name ?? '—'} · پیشرفت {toFa(task.progress)}٪</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ── تسک‌های عقب‌افتاده ── */}
        <Panel
          title="تسک‌های عقب‌افتاده"
          description="سررسید گذشته و هنوز باز"
          actions={<button type="button" className="pl-linkbtn" onClick={() => onNavigate?.('reminders')}>پیگیری</button>}
        >
          {(data?.overdue ?? []).length === 0 ? (
            <p className="pl-muted"><IconCheck width={15} height={15} /> تسک عقب‌افتاده‌ای نیست.</p>
          ) : (
            <ul className="pl-compactlist pl-compactlist--danger">
              {data.overdue.map((task) => (
                <li key={task.id}>
                  <span className="pl-overdue-days">
                    <IconWarning width={14} height={14} />
                    {relativeFa(task.dueDate)}
                  </span>
                  <div>
                    <strong>{task.title}</strong>
                    <span className="pl-muted">{task.owner?.name ?? '—'} · سررسید {jalaliLabel(task.dueDate, { short: true })}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="pl-chartgrid pl-chartgrid--split">
        {/* ── رویدادهای نزدیک ── */}
        <Panel
          title="رویدادهای نزدیک"
          description="شش رویداد نخست پیش‌رو"
          actions={<button type="button" className="pl-linkbtn" onClick={() => onNavigate?.('calendar')}>تقویم</button>}
        >
          {(data?.events ?? []).length === 0 ? (
            <p className="pl-muted"><IconCalendar width={15} height={15} /> رویدادی پیش‌رو نیست.</p>
          ) : (
            <ul className="pl-eventlist">
              {data.events.map((event) => (
                <li key={event.id} className={`pl-eventlist__item pl-chip--${event.type}`}>
                  <span className="pl-eventlist__date">
                    <b>{toFa(jalaliLabel(event.date, { short: true }).split(' ')[0])}</b>
                    <small>{jalaliLabel(event.date, { short: true }).split(' ').slice(1).join(' ')}</small>
                  </span>
                  <div>
                    <strong>{event.title}</strong>
                    <span className="pl-muted">
                      {labelOf(EVENT_TYPES, event.type)} · {event.allDay ? 'تمام‌روز' : `${faTime(event.start)} – ${faTime(event.end)}`}
                      {event.location ? ` · ${event.location}` : ''}
                    </span>
                  </div>
                  <span className="pl-muted">{relativeFa(`${event.date}T${event.start}:00`)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ── ابلاغ‌های منتظر اقدام ── */}
        <Panel
          title="ابلاغ‌های منتظر اقدام"
          description="ابلاغ‌هایی که هنوز پذیرفته نشده‌اند"
          actions={<button type="button" className="pl-linkbtn" onClick={() => onNavigate?.('assignments')}>ابلاغ‌ها</button>}
        >
          {(data?.pendingAssignments ?? []).length === 0 ? (
            <p className="pl-muted"><IconSend width={15} height={15} /> ابلاغ منتظر اقدامی نیست.</p>
          ) : (
            <ul className="pl-compactlist">
              {data.pendingAssignments.map((row) => (
                <li key={row.id}>
                  <Pill tone={toneOf(ASSIGNMENT_STATES, row.state)} soft={false}>{labelOf(ASSIGNMENT_STATES, row.state)}</Pill>
                  <div>
                    <strong>{row.task?.title ?? 'تسک حذف‌شده'}</strong>
                    <span className="pl-muted">
                      {row.recipients.map((user) => user.name).join('، ') || 'بدون گیرنده'}
                      {row.recipientUnits.length ? ` · ${row.recipientUnits.map((unit) => unit.name).join('، ')}` : ''}
                      {' · مهلت '}
                      {jalaliLabel(row.dueDate, { short: true })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="pl-chartgrid pl-chartgrid--split">
        {/* ── یادآوری‌های امروز ── */}
        <Panel
          title="یادآوری‌های امروز"
          description="یادآوری‌های فعال شما که امروز باید توجه بگیرند"
          actions={<button type="button" className="pl-linkbtn" onClick={() => onNavigate?.('reminders')}>یادآوری‌ها</button>}
        >
          {(data?.reminders ?? []).length === 0 ? (
            <p className="pl-muted"><IconBell width={15} height={15} /> یادآوری فعالی برای امروز نیست.</p>
          ) : (
            <ul className="pl-compactlist">
              {data.reminders.map((reminder) => (
                <li key={reminder.id}>
                  <Pill tone={toneOf(PRIORITIES, reminder.priority)} soft={false}>{labelOf(PRIORITIES, reminder.priority)}</Pill>
                  <div>
                    <strong>{reminder.title}</strong>
                    <span className="pl-muted">
                      {labelOf(RECURRENCES, reminder.recurrence)}
                      {reminder.body ? ` · ${reminder.body}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ── نمودار وضعیت تسک‌ها ── */}
        <Panel
          title="وضعیت تسک‌ها"
          description="توزیع تسک‌ها بر اساس وضعیت در سطح دسترسی شما"
          actions={<button type="button" className="pl-linkbtn" onClick={() => onNavigate?.('reports')}>گزارش‌ها</button>}
        >
          {statusSlices.length === 0 ? (
            <p className="pl-muted">تسکی برای نمایش نیست.</p>
          ) : (
            <div className="pl-splitview">
              <Donut size={150} slices={statusSlices} centerLabel="تسک" centerValue={toFa(data?.stats?.total ?? 0)} />
              <Legend items={statusSlices} />
            </div>
          )}

          <div className="pl-overview__foot">
            <span><IconClock width={14} height={14} /> میانگین پیشرفت: <b>{toFa(data?.stats?.averageProgress ?? 0)}٪</b></span>
            <span>تسک‌های باز: <b>{toFa(data?.stats?.open ?? 0)}</b></span>
          </div>
        </Panel>
      </div>

      {/* ── فعالیت‌های اخیر ── */}
      <Panel title="فعالیت‌های اخیر" description="آخرین رخدادهای ثبت‌شده در ماژول برنامه‌ریزی">
        {(data?.feed ?? []).length === 0 ? (
          <p className="pl-muted">فعالیتی ثبت نشده است.</p>
        ) : (
          <ol className="pl-timeline">
            {data.feed.map((row) => (
              <li key={row.id}>
                <span className="pl-timeline__dot" aria-hidden="true" />
                <div>
                  <strong>{row.action}</strong>
                  <p>{row.targetTitle || row.detail}</p>
                  <span className="pl-muted">{row.actor?.name ?? 'کاربر'} · {relativeFa(row.at)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
