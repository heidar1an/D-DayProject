/*
 * بخش «تسک‌ها» — فهرست، برد کانبان، جدول مدیریتی و تقویم.
 *
 * چهار نما روی یک داده: فیلتر و مرتب‌سازی مشترک است و فقط شکل نمایش عوض می‌شود.
 * نمای تقویم تسک‌ها را به شکل رویداد می‌کشد (تاریخ سررسید) تا کاربر بدهی‌های
 * زمانی را در بستر تقویم ببیند، بدون آنکه رکورد تسک تبدیل به رویداد شود.
 */

import { useCallback, useMemo, useState } from 'react';

import {
  Button, ConfirmDialog, EmptyState, LoadingBlock, Pagination, SearchInput, useAsync, useToast,
} from '../../adminShared';
import {
  IconFilter, IconKanban, IconList, IconPlus, IconTable, IconCalendar,
} from '../../adminIcons';
import { planning } from '../../../../services/planning/planningService';
import { PRIORITIES, TASK_STATUSES, labelOf, priorityRank, toneOf } from '../../../../services/planning/planningTypes';
import { isoDate, jalaliLabel, toFa, todayJalali } from '../../../../services/planning/jalali';
import {
  ExportMenu, Fieldset, Meter, Panel, Pill, Toolbar, ToolbarSpacer, exportCsv, exportExcel,
} from '../planningKit';
import TaskBoard from '../components/tasks/TaskBoard';
import TaskTable from '../components/tasks/TaskTable';
import TaskDetail from '../components/tasks/TaskDetail';
import TaskForm from '../components/tasks/TaskForm';
import AssignDialog from '../components/AssignDialog';
import { MonthView } from '../components/calendar/CalendarViews';

const VIEWS = [
  { key: 'list', label: 'فهرست', icon: IconList },
  { key: 'board', label: 'برد کانبان', icon: IconKanban },
  { key: 'table', label: 'جدول مدیریتی', icon: IconTable },
  { key: 'calendar', label: 'تقویم', icon: IconCalendar },
];

const EMPTY_FILTERS = {
  search: '', projectId: '', ownerId: '', unitId: '', status: '', priority: '', tag: '', overdue: false, dueToday: false,
};

const PER_PAGE = 12;

export default function TasksSection() {
  const notify = useToast();

  const [view, setView] = useState('list');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('due');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ open: false, task: null });
  const [assignTask, setAssignTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => todayJalali());

  const { data: projects } = useAsync(() => planning.org.projects(), []);
  const { data: users } = useAsync(() => planning.org.users(), []);
  const { data: units } = useAsync(() => planning.org.units(), []);

  const params = useMemo(() => ({
    ...filters,
    projectId: filters.projectId || undefined,
    ownerId: filters.ownerId || undefined,
    unitId: filters.unitId || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    tag: filters.tag || undefined,
    overdue: filters.overdue || undefined,
    dueToday: filters.dueToday || undefined,
    sort,
    page,
    perPage: view === 'list' || view === 'table' ? PER_PAGE : 0,
  }), [filters, sort, page, view]);

  const loader = useCallback(() => planning.tasks.list(params), [params]);
  const { data, loading, error, reload } = useAsync(loader, [loader]);

  const items = data?.items ?? [];

  const tagOptions = useMemo(
    () => Array.from(new Set(items.flatMap((task) => task.tags ?? []))).sort(),
    [items],
  );

  const patchFilter = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const applyStatus = async (id, status) => {
    try {
      await planning.tasks.setStatus(id, status);
      notify('وضعیت تسک تغییر کرد');
      reload();
    } catch (changeError) {
      notify(changeError.message ?? 'تغییر وضعیت ناموفق بود', 'error');
    }
  };

  const removeTask = async () => {
    setBusy(true);
    try {
      await planning.tasks.remove(deleteTarget.id);
      notify('تسک حذف شد');
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) setSelected(null);
      reload();
    } catch (removeError) {
      notify(removeError.message ?? 'حذف ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { label: 'کد', value: (row) => row.code },
    { label: 'عنوان', value: (row) => row.title },
    { label: 'پروژه', value: (row) => projects?.find((project) => project.id === row.projectId)?.title ?? '' },
    { label: 'مسئول', value: (row) => users?.find((user) => user.id === row.ownerId)?.name ?? '' },
    { label: 'سررسید', value: (row) => row.dueDate },
    { label: 'اولویت', value: (row) => labelOf(PRIORITIES, row.priority) },
    { label: 'وضعیت', value: (row) => labelOf(TASK_STATUSES, row.status) },
    { label: 'پیشرفت', value: (row) => row.progress },
  ];

  const handleExport = (format) => {
    const ok = format === 'csv'
      ? exportCsv('tasks', columns, items)
      : exportExcel('tasks', columns, items, 'فهرست تسک‌ها');
    notify(ok ? `خروجی ${format.toUpperCase()} آماده شد` : 'داده‌ای برای خروجی نیست');
  };

  /* تسک → رویداد، فقط برای نمایش در نمای تقویم */
  const taskEvents = useMemo(() => items.map((task) => ({
    id: task.id,
    title: task.title,
    type: 'deadline',
    date: task.dueDate,
    start: '09:00',
    end: '09:30',
    allDay: true,
    projectId: task.projectId,
    ownerId: task.ownerId,
    priority: task.priority,
    status: task.status,
    location: '',
    source: task,
  })), [items]);

  const activeFilterCount = Object.values(filters).filter((value) => value && value !== '').length;
  const overdueCount = items.filter((task) => task.dueDate < isoDate(new Date()) && !['done', 'canceled'].includes(task.status)).length;

  const openTask = (task) => setSelected(task);

  return (
    <div className="pl-stack">
      <Toolbar>
        <div className="pl-views">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`pl-view ${view === item.key ? 'is-active' : ''}`}
                onClick={() => { setView(item.key); setPage(1); }}
              >
                <Icon width={14} height={14} />
                {item.label}
              </button>
            );
          })}
        </div>

        <ToolbarSpacer />

        <SearchInput value={filters.search} onChange={(value) => patchFilter({ search: value })} placeholder="جست‌وجوی تسک…" />

        <Button variant="ghost" size="sm" onClick={() => setShowFilters((state) => !state)}>
          <IconFilter width={15} height={15} />
          فیلتر
          {activeFilterCount ? <span className="pl-badge-count">{toFa(activeFilterCount)}</span> : null}
        </Button>

        <ExportMenu disabled={!items.length} onExport={handleExport} />

        <Button size="sm" onClick={() => setForm({ open: true, task: null })}>
          <IconPlus width={15} height={15} />
          تسک تازه
        </Button>
      </Toolbar>

      {showFilters ? (
        <Panel className="pl-filters" title="فیلتر و مرتب‌سازی" description="فیلترها روی همهٔ نماها اعمال می‌شوند">
          <div className="pl-filtergrid">
            <Fieldset label="پروژه">
              <select className="pl-select" value={filters.projectId} onChange={(event) => patchFilter({ projectId: event.target.value })}>
                <option value="">همهٔ پروژه‌ها</option>
                {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="مسئول">
              <select className="pl-select" value={filters.ownerId} onChange={(event) => patchFilter({ ownerId: event.target.value })}>
                <option value="">همهٔ مسئولان</option>
                {(users ?? []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="واحد">
              <select className="pl-select" value={filters.unitId} onChange={(event) => patchFilter({ unitId: event.target.value })}>
                <option value="">همهٔ واحدها</option>
                {(units ?? []).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="وضعیت">
              <select className="pl-select" value={filters.status} onChange={(event) => patchFilter({ status: event.target.value })}>
                <option value="">همهٔ وضعیت‌ها</option>
                {TASK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="اولویت">
              <select className="pl-select" value={filters.priority} onChange={(event) => patchFilter({ priority: event.target.value })}>
                <option value="">همهٔ اولویت‌ها</option>
                {PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="برچسب">
              <select className="pl-select" value={filters.tag} onChange={(event) => patchFilter({ tag: event.target.value })}>
                <option value="">همهٔ برچسب‌ها</option>
                {tagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="مرتب‌سازی">
              <select className="pl-select" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="due">نزدیک‌ترین سررسید</option>
                <option value="priority">بالاترین اولویت</option>
                <option value="progress">بیشترین پیشرفت</option>
                <option value="created">تازه‌ترین</option>
              </select>
            </Fieldset>
          </div>

          <div className="pl-filtergrid__foot">
            <div className="pl-inline">
              <button
                type="button"
                className={`pl-togglechip ${filters.overdue ? 'is-on' : ''}`}
                onClick={() => patchFilter({ overdue: !filters.overdue })}
              >
                فقط عقب‌افتاده‌ها {overdueCount ? `(${toFa(overdueCount)})` : ''}
              </button>
              <button
                type="button"
                className={`pl-togglechip ${filters.dueToday ? 'is-on' : ''}`}
                onClick={() => patchFilter({ dueToday: !filters.dueToday })}
              >
                فقط سررسید امروز
              </button>
            </div>
            <button type="button" className="pl-linkbtn" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>
              پاک کردن فیلترها
            </button>
          </div>
        </Panel>
      ) : null}

      {error ? (
        <div className="pl-inline-error" role="alert">
          <div>
            <strong>فهرست تسک‌ها خوانده نشد</strong>
            <p>{error.message}</p>
          </div>
          <button type="button" className="pl-linkbtn" onClick={() => reload()}>تلاش دوباره</button>
        </div>
      ) : null}

      {loading && !data ? <LoadingBlock label="در حال خواندن تسک‌ها…" rows={5} /> : null}

      {data && items.length === 0 ? (
        <EmptyState
          title="تسکی با این فیلترها پیدا نشد"
          description="فیلترها را ساده‌تر کنید یا تسک تازه بسازید."
          action={<Button size="sm" onClick={() => setForm({ open: true, task: null })}>تسک تازه</Button>}
        />
      ) : null}

      {data && items.length > 0 && view === 'list' ? (
        <div className="pl-tasklist">
          {items.map((task) => {
            const owner = users?.find((user) => user.id === task.ownerId);
            const project = projects?.find((item) => item.id === task.projectId);
            const overdue = task.dueDate < isoDate(new Date()) && !['done', 'canceled'].includes(task.status);

            return (
              <article key={task.id} className={`pl-taskrow pl-taskrow--${task.priority} ${overdue ? 'is-overdue' : ''}`}>
                <div className="pl-taskrow__main">
                  <div className="pl-taskrow__top">
                    <code className="pl-mono">{task.code}</code>
                    <button type="button" className="pl-link pl-taskrow__title" onClick={() => openTask(task)}>{task.title}</button>
                    <Pill tone={toneOf(PRIORITIES, task.priority)}>{labelOf(PRIORITIES, task.priority)}</Pill>
                    <Pill tone={toneOf(TASK_STATUSES, task.status)}>{labelOf(TASK_STATUSES, task.status)}</Pill>
                    {overdue ? <Pill tone="danger" soft={false}>عقب‌افتاده</Pill> : null}
                  </div>
                  <p className="pl-taskrow__desc">{task.description || 'بدون توضیح'}</p>
                  <div className="pl-taskrow__meta">
                    <span>{project?.title ?? 'بدون پروژه'}</span>
                    <span>مسئول: {owner?.name ?? '—'}</span>
                    <span>سررسید: {jalaliLabel(task.dueDate, { short: true })}</span>
                    {(task.tags ?? []).map((tag) => <span key={tag} className="pl-tag">{tag}</span>)}
                  </div>
                </div>

                <div className="pl-taskrow__side">
                  <Meter value={task.progress} tone={task.status === 'done' ? 'green' : 'accent'} label="پیشرفت" />
                  <div className="pl-taskrow__actions">
                    <Button variant="ghost" size="sm" onClick={() => openTask(task)}>جزئیات</Button>
                    <Button variant="ghost" size="sm" onClick={() => setForm({ open: true, task })}>ویرایش</Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {data && items.length > 0 && view === 'board' ? (
        <TaskBoard
          tasks={[...items].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))}
          projects={projects ?? []}
          users={users ?? []}
          onOpen={openTask}
          onEdit={(task) => setForm({ open: true, task })}
          onStatusChange={applyStatus}
        />
      ) : null}

      {data && items.length > 0 && view === 'table' ? (
        <TaskTable
          tasks={items}
          projects={projects ?? []}
          users={users ?? []}
          sort={sort}
          onSort={(key) => setSort(key)}
          onOpen={openTask}
          onEdit={(task) => setForm({ open: true, task })}
          onAssign={(task) => setAssignTask(task)}
          onDelete={(task) => setDeleteTarget(task)}
        />
      ) : null}

      {data && items.length > 0 && view === 'calendar' ? (
        <>
          <div className="pl-calnav pl-calnav--standalone">
            <button
              type="button"
              className="pl-iconbtn"
              aria-label="ماه قبل"
              onClick={() => setMonthCursor((state) => {
                const total = state.jy * 12 + (state.jm - 1) - 1;
                return { jy: Math.floor(total / 12), jm: (total % 12) + 1 };
              })}
            >
              ‹
            </button>
            <strong>{toFa(`${monthCursor.jy}`)} — ماه {toFa(monthCursor.jm)}</strong>
            <button
              type="button"
              className="pl-iconbtn"
              aria-label="ماه بعد"
              onClick={() => setMonthCursor((state) => {
                const total = state.jy * 12 + (state.jm - 1) + 1;
                return { jy: Math.floor(total / 12), jm: (total % 12) + 1 };
              })}
            >
              ›
            </button>
          </div>

          <MonthView
            jy={monthCursor.jy}
            jm={monthCursor.jm}
            events={taskEvents}
            holidays={[]}
            onSelectDay={(iso) => notify(`تسک‌های سررسید ${jalaliLabel(iso)}: ${toFa(items.filter((task) => task.dueDate === iso).length)} مورد`)}
            onOpenEvent={(event) => event.source && openTask(event.source)}
            onQuickCreate={() => setForm({ open: true, task: null })}
            onMoveEvent={() => notify('تغییر سررسید از نمای تقویم انجام نمی‌شود؛ از فرم ویرایش تسک استفاده کنید', 'error')}
          />
        </>
      ) : null}

      {data && (view === 'list' || view === 'table') ? (
        <Pagination
          page={data.page}
          pages={data.pages}
          total={data.total}
          perPage={data.perPage}
          onPageChange={setPage}
        />
      ) : null}

      <TaskDetail
        task={selected}
        projects={projects ?? []}
        users={users ?? []}
        onClose={() => setSelected(null)}
        onChanged={(fresh) => { setSelected(fresh); reload(); }}
        onEdit={(task) => { setSelected(null); setForm({ open: true, task }); }}
        onAssign={(task) => { setSelected(null); setAssignTask(task); }}
      />

      <TaskForm
        open={form.open}
        task={form.task}
        projects={projects ?? []}
        users={users ?? []}
        units={units ?? []}
        onClose={() => setForm({ open: false, task: null })}
        onSaved={() => { reload(); }}
      />

      <AssignDialog
        open={Boolean(assignTask)}
        task={assignTask}
        tasks={items}
        units={units ?? []}
        users={users ?? []}
        onClose={() => setAssignTask(null)}
        onSaved={reload}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف تسک"
        message={`تسک «${deleteTarget?.title ?? ''}» همراه ابلاغ‌ها و یادآوری‌هایش حذف می‌شود. این کار برگشت‌پذیر نیست.`}
        confirmLabel="حذف کن"
        busy={busy}
        onConfirm={removeTask}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
