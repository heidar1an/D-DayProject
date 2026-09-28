/*
 * بخش «گزارش‌ها» — تصویر تجمیعی از عملکرد واحدها.
 *
 * این بخش دادهٔ تازه تولید نمی‌کند؛ همان سرویس‌های تسک، ابلاغ، مالی و SOP را
 * می‌خواند و در چند جدول و نمودار مدیریتی کنار هم می‌گذارد. خروجی CSV/Excel از
 * همان جدول‌های همین صفحه گرفته می‌شود.
 */

import { useMemo, useState } from 'react';

import { EmptyState, useAsync, useToast } from '../../adminShared';
import { IconReport } from '../../adminIcons';
import { planning } from '../../../../services/planning/planningService';
import {
  ASSIGNMENT_STATES, SOP_STATUSES, labelOf,
} from '../../../../services/planning/planningTypes';
import {
  faCompact, faNumber, faPercent, isoDate, relativeFa, toFa, todayJalali,
} from '../../../../services/planning/jalali';
import {
  Bar, BarChart, Donut, ExportMenu, Legend, Panel, Pill,
  Toolbar, ToolbarSpacer, exportCsv, exportExcel,
} from '../planningKit';

export default function ReportsSection() {
  const notify = useToast();
  const [jy, setJy] = useState(() => todayJalali().jy);

  const { data: units } = useAsync(() => planning.org.units(), []);
  const { data: users } = useAsync(() => planning.org.users(), []);
  const { data: projects } = useAsync(() => planning.org.projects(), []);
  const { data: tasks } = useAsync(() => planning.tasks.list({ perPage: 0 }), []);
  const { data: assignments } = useAsync(() => planning.assignments.list({}), []);
  const { data: sops } = useAsync(() => planning.sop.list({}), []);
  const { data: finance } = useAsync(() => planning.finance.series({ jy }), [jy]);
  const { data: stats } = useAsync(() => planning.tasks.stats(), []);
  const { data: activity } = useAsync(() => planning.activity.list({ limit: 20 }), []);

  const taskRows = tasks?.items ?? [];
  const todayIso = isoDate(new Date());

  /* ── عملکرد هر واحد ── */
  const unitRows = useMemo(() => (units ?? []).map((unit) => {
    const rows = taskRows.filter((task) => task.unitId === unit.id);
    const done = rows.filter((task) => task.status === 'done').length;
    const overdue = rows.filter((task) => task.dueDate < todayIso && !['done', 'canceled'].includes(task.status)).length;
    const progress = rows.length ? Math.round(rows.reduce((sum, task) => sum + (task.progress ?? 0), 0) / rows.length) : 0;
    const head = (users ?? []).find((user) => user.id === unit.headId);

    return {
      unit,
      head,
      total: rows.length,
      open: rows.filter((task) => !['done', 'canceled'].includes(task.status)).length,
      done,
      overdue,
      progress,
      completion: rows.length ? Math.round((done / rows.length) * 100) : 0,
    };
  }).sort((a, b) => b.total - a.total), [units, taskRows, users, todayIso]);

  /* ── عملکرد مسئولان ── */
  const ownerRows = useMemo(() => (users ?? []).map((user) => {
    const rows = taskRows.filter((task) => task.ownerId === user.id);
    const done = rows.filter((task) => task.status === 'done').length;
    const overdue = rows.filter((task) => task.dueDate < todayIso && !['done', 'canceled'].includes(task.status)).length;
    return {
      user,
      total: rows.length,
      done,
      overdue,
      progress: rows.length ? Math.round(rows.reduce((sum, task) => sum + (task.progress ?? 0), 0) / rows.length) : 0,
    };
  }).filter((row) => row.total > 0).sort((a, b) => b.total - a.total), [users, taskRows, todayIso]);

  /* ── وضعیت ابلاغ‌ها ── */
  const assignmentSlices = useMemo(
    () => ASSIGNMENT_STATES.map((state) => ({
      label: state.label,
      value: (assignments ?? []).filter((row) => row.state === state.value).length,
      color: state.value === 'accepted' ? 'green'
        : state.value === 'returned' ? 'gold'
          : state.value === 'rejected' ? 'danger'
            : state.value === 'seen' ? 'blue' : 'muted',
    })),
    [assignments],
  );

  /* ── وضعیت SOPها ── */
  const sopSlices = useMemo(
    () => SOP_STATUSES.map((status) => ({
      label: status.label,
      value: (sops ?? []).filter((row) => row.status === status.value).length,
      color: status.value === 'approved' ? 'green'
        : status.value === 'review' ? 'gold'
          : status.value === 'obsolete' ? 'danger' : 'muted',
    })),
    [sops],
  );

  const months = finance?.months ?? [];
  const chartData = useMemo(
    () => months.map((row) => ({ ...row, expenses: row.direct + row.indirect })),
    [months],
  );

  const columns = [
    { label: 'واحد', value: (row) => row.unit.name },
    { label: 'مسئول واحد', value: (row) => row.head?.name ?? '' },
    { label: 'کل تسک', value: (row) => row.total },
    { label: 'باز', value: (row) => row.open },
    { label: 'تکمیل‌شده', value: (row) => row.done },
    { label: 'عقب‌افتاده', value: (row) => row.overdue },
    { label: 'میانگین پیشرفت', value: (row) => row.progress },
    { label: 'نرخ تکمیل', value: (row) => row.completion },
  ];

  const financeColumns = [
    { label: 'ماه', value: (row) => row.label },
    { label: 'پول ورودی', value: (row) => row.income },
    { label: 'هزینهٔ مستقیم', value: (row) => row.direct },
    { label: 'هزینهٔ غیرمستقیم', value: (row) => row.indirect },
    { label: 'سود ناخالص', value: (row) => row.gross },
    { label: 'سود خالص', value: (row) => row.net },
    { label: 'تعداد تراکنش', value: (row) => row.count },
  ];

  const exportUnit = (format) => {
    const ok = format === 'csv'
      ? exportCsv('unit-report', columns, unitRows)
      : exportExcel('unit-report', columns, unitRows, 'گزارش عملکرد واحدها');
    notify(ok ? `خروجی ${format.toUpperCase()} آماده شد` : 'داده‌ای برای خروجی نیست');
  };

  const exportFinance = (format) => {
    const ok = format === 'csv'
      ? exportCsv('finance-report', financeColumns, months)
      : exportExcel('finance-report', financeColumns, months, `گزارش مالی سال ${jy}`);
    notify(ok ? `خروجی ${format.toUpperCase()} آماده شد` : 'داده‌ای برای خروجی نیست');
  };

  const noData = !taskRows.length && !months.length && !(sops ?? []).length;

  return (
    <div className="pl-stack">
      <Toolbar>
        <span className="pl-toolbar__hint">
          <IconReport width={15} height={15} />
          گزارش تجمیعی عملکرد — همهٔ اعداد از دادهٔ جاری ماژول محاسبه می‌شوند
        </span>
        <ToolbarSpacer />
        <ExportMenu disabled={!unitRows.length} onExport={exportUnit} />
      </Toolbar>

      {noData ? (
        <EmptyState title="داده‌ای برای گزارش نیست" description="با ثبت تسک، ابلاغ و تراکنش، گزارش‌ها پر می‌شوند." />
      ) : null}

      {/* ── خلاصهٔ سنجه‌ها ── */}
      <div className="pl-kpi-grid pl-kpi-grid--tight">
        <div className="pl-mini"><span className="pl-mini__label">کل تسک‌ها</span><b className="pl-mini__value">{faNumber(stats?.total)}</b></div>
        <div className="pl-mini pl-mini--warn"><span className="pl-mini__label">باز</span><b className="pl-mini__value">{faNumber(stats?.open)}</b></div>
        <div className="pl-mini pl-mini--critical"><span className="pl-mini__label">عقب‌افتاده</span><b className="pl-mini__value">{faNumber(stats?.overdue)}</b></div>
        <div className="pl-mini pl-mini--good"><span className="pl-mini__label">تکمیل‌شده</span><b className="pl-mini__value">{faNumber(stats?.done)}</b></div>
        <div className="pl-mini"><span className="pl-mini__label">میانگین پیشرفت</span><b className="pl-mini__value">{toFa(stats?.averageProgress ?? 0)}٪</b></div>
        <div className="pl-mini"><span className="pl-mini__label">ابلاغ‌های پذیرفته‌شده</span><b className="pl-mini__value">{toFa((assignments ?? []).filter((row) => row.state === 'accepted').length)}</b></div>
        <div className="pl-mini"><span className="pl-mini__label">SOP تأییدشده</span><b className="pl-mini__value">{toFa((sops ?? []).filter((row) => row.status === 'approved').length)}</b></div>
      </div>

      {/* ── توزیع‌ها ── */}
      <div className="pl-chartgrid pl-chartgrid--split">
        <Panel title="توزیع وضعیت تسک‌ها" description="در سطح دسترسی شما">
          <div className="pl-splitview">
            <Donut
              size={156}
              slices={(stats?.byStatus ?? []).map((status) => ({ label: status.label, value: status.count, color: status.color }))}
              centerLabel="تسک"
              centerValue={faNumber(stats?.total)}
            />
            <Legend items={(stats?.byStatus ?? []).map((status) => ({ label: status.label, value: status.count, color: status.color }))} />
          </div>
        </Panel>

        <Panel title="توزیع اولویت تسک‌ها" description="تمرکز بار کاری بر اولویت‌های بالا">
          <div className="pl-bars">
            {(stats?.byPriority ?? []).map((priority) => (
              <Bar
                key={priority.value}
                label={priority.label}
                value={priority.count}
                max={Math.max(1, ...(stats?.byPriority ?? []).map((item) => item.count))}
                tone={priority.color}
                valueLabel={toFa(priority.count)}
              />
            ))}
          </div>
        </Panel>
      </div>

      <div className="pl-chartgrid pl-chartgrid--split">
        <Panel title="وضعیت ابلاغ‌ها" description="چرخهٔ ارسال تا پذیرش">
          <div className="pl-splitview">
            <Donut
              size={156}
              slices={assignmentSlices}
              centerLabel="ابلاغ"
              centerValue={toFa((assignments ?? []).length)}
            />
            <Legend items={assignmentSlices} />
          </div>
        </Panel>

        <Panel title="وضعیت SOPها" description="اسناد تأییدشده، در بررسی و منسوخ">
          <div className="pl-splitview">
            <Donut
              size={156}
              slices={sopSlices}
              centerLabel="سند"
              centerValue={toFa((sops ?? []).length)}
            />
            <Legend items={sopSlices} />
          </div>
        </Panel>
      </div>

      {/* ── مالی ── */}
      <Panel
        title={`گزارش مالی سال ${toFa(jy)}`}
        description="پول ورودی، هزینه‌ها و سود در ماه‌های سال شمسی"
        actions={(
          <>
            <select className="pl-select pl-select--sm" value={jy} onChange={(event) => setJy(Number(event.target.value))} aria-label="سال">
              {Array.from({ length: 5 }, (_, index) => todayJalali().jy - index).map((year) => (
                <option key={year} value={year}>{toFa(year)}</option>
              ))}
            </select>
            <ExportMenu disabled={!months.length} onExport={exportFinance} />
          </>
        )}
      >
        <BarChart
          data={chartData}
          height={230}
          format={faCompact}
          series={[
            { key: 'income', label: 'پول ورودی', color: 'green' },
            { key: 'gross', label: 'سود ناخالص', color: 'accent' },
            { key: 'net', label: 'سود خالص', color: 'blue' },
          ]}
        />

        <div className="pl-tablewrap pl-tablewrap--mt">
          <table className="pl-table pl-table--slim">
            <thead>
              <tr>{financeColumns.map((column) => <th key={column.label}>{column.label}</th>)}</tr>
            </thead>
            <tbody>
              {months.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{faCompact(row.income)}</td>
                  <td>{faCompact(row.direct)}</td>
                  <td>{faCompact(row.indirect)}</td>
                  <td>{faCompact(row.gross)}</td>
                  <td className={row.net < 0 ? 'is-danger' : 'is-positive'}>{faCompact(row.net)}</td>
                  <td>{toFa(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── عملکرد واحدها ── */}
      <Panel title="عملکرد واحدها" description="تعداد تسک، نرخ تکمیل و بدهی زمانی هر واحد">
        {unitRows.length === 0 ? (
          <p className="pl-muted">واحدی برای گزارش وجود ندارد.</p>
        ) : (
          <div className="pl-tablewrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>واحد</th>
                  <th>مسئول</th>
                  <th>کل</th>
                  <th>باز</th>
                  <th>تکمیل</th>
                  <th>عقب‌افتاده</th>
                  <th>میانگین پیشرفت</th>
                  <th>نرخ تکمیل</th>
                </tr>
              </thead>
              <tbody>
                {unitRows.map((row) => (
                  <tr key={row.unit.id}>
                    <td>{row.unit.name}</td>
                    <td>{row.head?.name ?? '—'}</td>
                    <td>{toFa(row.total)}</td>
                    <td>{toFa(row.open)}</td>
                    <td className="is-positive">{toFa(row.done)}</td>
                    <td className={row.overdue ? 'is-danger' : ''}>{toFa(row.overdue)}</td>
                    <td>{toFa(row.progress)}٪</td>
                    <td>{toFa(row.completion)}٪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="pl-chartgrid pl-chartgrid--split">
        <Panel title="بار کاری مسئولان" description="تعداد تسک‌های هر مسئول و میانگین پیشرفت">
          {ownerRows.length === 0 ? <p className="pl-muted">داده‌ای نیست.</p> : (
            <ul className="pl-ownerlist">
              {ownerRows.map((row) => (
                <li key={row.user.id}>
                  <span className="pl-avatar pl-avatar--sm">{row.user.avatar}</span>
                  <div className="pl-ownerlist__body">
                    <div className="pl-ownerlist__head">
                      <strong>{row.user.name}</strong>
                      <span className="pl-muted">{toFa(row.total)} تسک · {toFa(row.done)} تکمیل</span>
                    </div>
                    <Bar
                      label=""
                      value={row.progress}
                      max={100}
                      tone={row.overdue ? 'danger' : 'accent'}
                      valueLabel={`${toFa(row.progress)}٪`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="فعالیت‌های اخیر" description="آخرین رخدادهای ثبت‌شده در ماژول">
          {(activity ?? []).length === 0 ? <p className="pl-muted">فعالیتی ثبت نشده است.</p> : (
            <ol className="pl-timeline pl-timeline--compact">
              {(activity ?? []).map((row) => (
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

      {/* ── پروژه‌ها ── */}
      <Panel title="خلاصهٔ پروژه‌ها" description="تعداد تسک و سهم تسک‌های تکمیل‌شدهٔ هر پروژه">
        <div className="pl-tablewrap">
          <table className="pl-table pl-table--slim">
            <thead>
              <tr><th>پروژه</th><th>واحد</th><th>تسک</th><th>تکمیل‌شده</th><th>عقب‌افتاده</th><th>وضعیت پروژه</th></tr>
            </thead>
            <tbody>
              {(projects ?? []).map((project) => {
                const rows = taskRows.filter((task) => task.projectId === project.id);
                const done = rows.filter((task) => task.status === 'done').length;
                const overdue = rows.filter((task) => task.dueDate < todayIso && !['done', 'canceled'].includes(task.status)).length;
                return (
                  <tr key={project.id}>
                    <td>{project.title}</td>
                    <td>{(units ?? []).find((unit) => unit.id === project.unitId)?.name ?? '—'}</td>
                    <td>{toFa(rows.length)}</td>
                    <td className="is-positive">{toFa(done)}</td>
                    <td className={overdue ? 'is-danger' : ''}>{toFa(overdue)}</td>
                    <td>
                      <Pill tone={project.status === 'active' ? 'ok' : project.status === 'paused' ? 'warn' : 'neutral'}>
                        {project.status === 'active' ? 'فعال' : project.status === 'paused' ? 'متوقف' : 'بسته'}
                      </Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="شاخص‌های کلیدی" description="خلاصهٔ یک‌خطی برای گزارش‌دهی سریع">
        <ul className="pl-kvlist">
          <li><span>نرخ تکمیل کل تسک‌ها</span><b>{faPercent(stats?.total ? (stats.done / stats.total) * 100 : 0)}</b></li>
          <li><span>سهم تسک‌های عقب‌افتاده</span><b>{faPercent(stats?.total ? (stats.overdue / stats.total) * 100 : 0)}</b></li>
          <li><span>نرخ پذیرش ابلاغ‌ها</span><b>{faPercent((assignments ?? []).length ? ((assignments ?? []).filter((row) => row.state === 'accepted').length / assignments.length) * 100 : 0)}</b></li>
          <li><span>سهم SOPهای تأییدشده</span><b>{faPercent((sops ?? []).length ? ((sops ?? []).filter((row) => row.status === 'approved').length / sops.length) * 100 : 0)}</b></li>
          <li><span>میانگین پیشرفت کل</span><b>{toFa(stats?.averageProgress ?? 0)}٪</b></li>
        </ul>
      </Panel>
    </div>
  );
}
