/*
 * بخش «تقویم» — تقویم سالانهٔ شمسی با چهار نما.
 *
 * دادهٔ سال یک‌بار خوانده می‌شود و فیلترها روی همان مجموعه اعمال می‌شوند؛ حجم
 * رویدادهای یک سال در پنل کوچک است و این کار رفت‌وبرگشت بی‌دلیل به لایهٔ داده
 * را حذف می‌کند.
 *
 * جابه‌جایی با کشیدن و رهاکردن به سرویس می‌رود و انتقال به تاریخ گذشته در همان
 * لایه رد می‌شود؛ خطا با پیام روشن به کاربر نشان داده می‌شود.
 */

import { useCallback, useMemo, useState } from 'react';

import { Button, EmptyState, Spinner, useAsync, useToast } from '../../adminShared';
import { IconCalendar, IconChevron, IconClose, IconFilter, IconPlus } from '../../adminIcons';
import { planning } from '../../../../services/planning/planningService';
import {
  EVENT_TYPES, PRIORITIES, TASK_STATUSES, labelOf,
} from '../../../../services/planning/planningTypes';
import {
  JALALI_MONTHS, addDays, faTime, isoDate, jalaliLabel, jalaliMonthLength, jalaliParts,
  jalaliToIso, parseISODate, shiftJalaliMonth, toFa, weekDays,
} from '../../../../services/planning/jalali';
import {
  ExportMenu, Fieldset, Panel, Pill, Toolbar, ToolbarSpacer, exportCsv, exportExcel,
} from '../planningKit';
import { CalendarSummary, DayView, MonthView, WeekView, YearView, eventTone } from '../components/calendar/CalendarViews';
import JalaliDatePicker, { JalaliMonthSelect, JalaliYearSelect } from '../components/calendar/JalaliDatePicker';
import EventDialog from '../components/calendar/EventDialog';

const VIEWS = [
  { key: 'year', label: 'سالانه' },
  { key: 'month', label: 'ماهانه' },
  { key: 'week', label: 'هفتگی' },
  { key: 'day', label: 'روزانه' },
];

const EMPTY_FILTERS = {
  projectId: '', ownerId: '', status: '', type: '', priority: '', search: '',
};

export default function CalendarSection({ onNotify }) {
  const notify = useToast();

  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [dialog, setDialog] = useState({ open: false, event: null, defaults: null });
  const [dayPanel, setDayPanel] = useState('');

  const parts = jalaliParts(anchor);
  const jy = parts.jy;
  const jm = parts.jm;

  const range = useMemo(() => ({
    from: jalaliToIso(jy, 1, 1),
    to: jalaliToIso(jy, 12, jalaliMonthLength(jy, 12)),
  }), [jy]);

  const eventsLoader = useCallback(
    () => planning.calendar.list({ from: range.from, to: range.to, projectId: filters.projectId || undefined, ownerId: filters.ownerId || undefined, status: filters.status || undefined, type: filters.type || undefined, priority: filters.priority || undefined }),
    [range.from, range.to, filters],
  );

  const { data: events, loading, error, reload } = useAsync(eventsLoader, [eventsLoader]);
  const { data: holidays } = useAsync(() => planning.calendar.holidays(jy), [jy]);
  const { data: projects } = useAsync(() => planning.org.projects(), []);
  const { data: users } = useAsync(() => planning.org.users(), []);
  const { data: settings } = useAsync(() => planning.settings.get(), []);

  const rows = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return (events ?? []).filter((event) => (
      !needle || `${event.title} ${event.description} ${event.location}`.toLowerCase().includes(needle)
    ));
  }, [events, filters.search]);

  const holidayRows = holidays ?? [];

  /* ── ناوبری ── */
  const step = (direction) => {
    if (view === 'year') {
      setAnchor(new Date(anchor.getFullYear() + direction, anchor.getMonth(), 1));
    } else if (view === 'month') {
      const next = shiftJalaliMonth(jy, jm, direction);
      const day = Math.min(parts.jd, jalaliMonthLength(next.jy, next.jm));
      setAnchor(parseISODate(jalaliToIso(next.jy, next.jm, day)));
    } else {
      setAnchor(addDays(anchor, view === 'week' ? direction * 7 : direction));
    }
  };

  const title = view === 'year'
    ? `سال ${toFa(jy)}`
    : view === 'month'
      ? `${JALALI_MONTHS[jm - 1]} ${toFa(jy)}`
      : view === 'week'
        ? `هفتهٔ ${jalaliLabel(weekDays(anchor)[0], { short: true })} تا ${jalaliLabel(weekDays(anchor)[6], { short: true })}`
        : jalaliLabel(anchor);

  const goToday = () => setAnchor(new Date());

  /* ── عملیات ── */
  const openCreate = (date, start) => {
    setDayPanel('');
    setDialog({ open: true, event: null, defaults: { date, start } });
  };

  const openEdit = (event) => {
    setDayPanel('');
    setDialog({ open: true, event, defaults: null });
  };

  const moveEvent = async (id, payload) => {
    try {
      await planning.calendar.move(id, payload);
      notify('رویداد جابه‌جا شد');
      reload();
    } catch (moveError) {
      notify(moveError.message ?? 'جابه‌جایی ناموفق بود', 'error');
    }
  };

  const afterSave = () => {
    reload();
    onNotify?.();
  };

  const columns = [
    { label: 'عنوان', value: (row) => row.title },
    { label: 'نوع', value: (row) => labelOf(EVENT_TYPES, row.type) },
    { label: 'تاریخ', value: (row) => jalaliLabel(row.date) },
    { label: 'شروع', value: (row) => row.start },
    { label: 'پایان', value: (row) => row.end },
    { label: 'اولویت', value: (row) => labelOf(PRIORITIES, row.priority) },
    { label: 'وضعیت', value: (row) => labelOf(TASK_STATUSES, row.status) },
    { label: 'محل', value: (row) => row.location },
  ];

  const handleExport = (format) => {
    const ok = format === 'csv'
      ? exportCsv('calendar', columns, rows)
      : exportExcel('calendar', columns, rows, `تقویم ${title}`);
    notify(ok ? `خروجی ${format.toUpperCase()} آماده شد` : 'داده‌ای برای خروجی نیست');
  };

  const dayEvents = useMemo(
    () => rows.filter((event) => event.date === dayPanel).sort((a, b) => a.start.localeCompare(b.start)),
    [rows, dayPanel],
  );

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="pl-stack">
      <Toolbar className="pl-calbar">
        <div className="pl-views">
          {VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`pl-view ${view === item.key ? 'is-active' : ''}`}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="pl-calnav">
          <button type="button" className="pl-iconbtn" onClick={() => step(-1)} aria-label="بازهٔ قبل">
            <IconChevron width={16} height={16} />
          </button>
          <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={goToday}>امروز</button>
          <button
            type="button"
            className="pl-iconbtn"
            onClick={() => step(1)}
            aria-label="بازهٔ بعد"
            style={{ transform: 'rotate(180deg)' }}
          >
            <IconChevron width={16} height={16} />
          </button>
          <strong className="pl-calnav__title">{title}</strong>
        </div>

        <ToolbarSpacer />

        {view === 'year' ? (
          <JalaliYearSelect value={jy} onChange={(year) => setAnchor(parseISODate(jalaliToIso(year, jm, Math.min(parts.jd, 29))))} />
        ) : null}

        <Button variant="ghost" size="sm" onClick={() => setShowFilters((state) => !state)}>
          <IconFilter width={15} height={15} />
          فیلتر
          {activeFilterCount ? <span className="pl-badge-count">{toFa(activeFilterCount)}</span> : null}
        </Button>

        <ExportMenu disabled={!rows.length} onExport={handleExport} />

        <Button size="sm" onClick={() => openCreate(isoDate(anchor))}>
          <IconPlus width={15} height={15} />
          رویداد تازه
        </Button>
      </Toolbar>

      {showFilters ? (
        <Panel className="pl-filters" title="فیلتر تقویم" description="فیلترها روی رویدادهای همان سال اعمال می‌شوند">
          <div className="pl-filtergrid">
            <Fieldset label="پروژه">
              <select className="pl-select" value={filters.projectId} onChange={(event) => setFilters((state) => ({ ...state, projectId: event.target.value }))}>
                <option value="">همهٔ پروژه‌ها</option>
                {(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="مسئول">
              <select className="pl-select" value={filters.ownerId} onChange={(event) => setFilters((state) => ({ ...state, ownerId: event.target.value }))}>
                <option value="">همهٔ مسئولان</option>
                {(users ?? []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="وضعیت">
              <select className="pl-select" value={filters.status} onChange={(event) => setFilters((state) => ({ ...state, status: event.target.value }))}>
                <option value="">همهٔ وضعیت‌ها</option>
                {TASK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="نوع رویداد">
              <select className="pl-select" value={filters.type} onChange={(event) => setFilters((state) => ({ ...state, type: event.target.value }))}>
                <option value="">همهٔ نوع‌ها</option>
                {EVENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="اولویت">
              <select className="pl-select" value={filters.priority} onChange={(event) => setFilters((state) => ({ ...state, priority: event.target.value }))}>
                <option value="">همهٔ اولویت‌ها</option>
                {PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
              </select>
            </Fieldset>

            <Fieldset label="جست‌وجو">
              <input
                className="pl-input"
                value={filters.search}
                placeholder="عنوان، توضیح یا محل"
                onChange={(event) => setFilters((state) => ({ ...state, search: event.target.value }))}
              />
            </Fieldset>

            <Fieldset label="پرش سریع">
              <JalaliDatePicker value={isoDate(anchor)} onChange={(iso) => iso && setAnchor(parseISODate(iso))} />
            </Fieldset>
          </div>

          <div className="pl-filtergrid__foot">
            <button type="button" className="pl-linkbtn" onClick={() => setFilters(EMPTY_FILTERS)}>پاک کردن فیلترها</button>
            {view === 'month' || view === 'year' ? (
              <div className="pl-inline">
                <JalaliMonthSelect value={view === 'month' ? jm : null} onChange={(month) => month && setAnchor(parseISODate(jalaliToIso(jy, month, 1)))} />
              </div>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <div className="pl-legend">
        {EVENT_TYPES.map((type) => (
          <span key={type.value} className="pl-legend__item">
            <i className={`pl-legend__swatch pl-chip--${type.color}`} />
            {type.label}
          </span>
        ))}
        {settings?.showHolidays ? (
          <span className="pl-legend__item pl-legend__item--holiday">
            <i className="pl-legend__swatch pl-legend__swatch--holiday" />
            تعطیل رسمی
          </span>
        ) : null}
      </div>

      <div className="pl-calwrap">
        {loading && !events ? (
          <div className="pl-boot"><Spinner /> در حال خواندن تقویم…</div>
        ) : error ? (
          <div className="pl-inline-error" role="alert">
            <div>
              <strong>تقویم خوانده نشد</strong>
              <p>{error.message}</p>
            </div>
            <button type="button" className="pl-linkbtn" onClick={() => reload()}>تلاش دوباره</button>
          </div>
        ) : rows.length === 0 && !events?.length ? (
          <EmptyState
            title="رویدادی ثبت نشده"
            description="با دکمهٔ «رویداد تازه» نخستین رویداد این بازه را بسازید."
            action={<Button size="sm" onClick={() => openCreate(isoDate(anchor))}>رویداد تازه</Button>}
          />
        ) : view === 'year' ? (
          <YearView
            jy={jy}
            events={rows}
            holidays={holidayRows}
            onSelectDay={(iso) => { setAnchor(parseISODate(iso)); setView('day'); }}
            onSelectMonth={(month) => { setAnchor(parseISODate(jalaliToIso(jy, month, 1))); setView('month'); }}
          />
        ) : view === 'month' ? (
          <MonthView
            jy={jy}
            jm={jm}
            events={rows}
            holidays={holidayRows}
            onSelectDay={(iso) => setDayPanel(iso)}
            onOpenEvent={openEdit}
            onQuickCreate={openCreate}
            onMoveEvent={moveEvent}
          />
        ) : view === 'week' ? (
          <WeekView
            date={anchor}
            events={rows}
            holidays={holidayRows}
            workingHours={settings?.workingHours}
            onOpenEvent={openEdit}
            onQuickCreate={openCreate}
            onMoveEvent={moveEvent}
          />
        ) : (
          <DayView
            date={anchor}
            events={rows}
            holidays={holidayRows}
            workingHours={settings?.workingHours}
            onOpenEvent={openEdit}
            onQuickCreate={openCreate}
            onMoveEvent={moveEvent}
          />
        )}
      </div>

      <CalendarSummary events={rows} date={anchor} />

      {dayPanel ? (
        <Panel
          title={`برنامه‌های ${jalaliLabel(dayPanel)}`}
          description="رویدادهای این روز؛ برای ویرایش روی هرکدام بزنید"
          actions={(
            <>
              <Button size="sm" onClick={() => openCreate(dayPanel, '09:00')}>
                <IconPlus width={14} height={14} />
                رویداد تازه
              </Button>
              <button type="button" className="pl-iconbtn" onClick={() => setDayPanel('')} aria-label="بستن">
                <IconClose width={15} height={15} />
              </button>
            </>
          )}
        >
          {dayEvents.length === 0 ? (
            <EmptyState title="این روز خالی است" description="رویدادی برای این روز ثبت نشده." />
          ) : (
            <ul className="pl-daylist">
              {dayEvents.map((event) => (
                <li key={event.id} className={`pl-daylist__item pl-chip--${eventTone(event)}`}>
                  <button type="button" onClick={() => openEdit(event)}>
                    <span className="pl-daylist__time">
                      <IconCalendar width={14} height={14} />
                      {event.allDay ? 'تمام‌روز' : `${faTime(event.start)} – ${faTime(event.end)}`}
                    </span>
                    <span className="pl-daylist__title">{event.title}</span>
                    <span className="pl-daylist__meta">
                      <Pill tone={eventTone(event)} soft={false}>{labelOf(EVENT_TYPES, event.type)}</Pill>
                      <Pill tone={event.priority === 'critical' ? 'danger' : 'neutral'}>{labelOf(PRIORITIES, event.priority)}</Pill>
                      {event.location ? <span className="pl-muted">{event.location}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      <EventDialog
        open={dialog.open}
        event={dialog.event}
        defaults={dialog.defaults}
        projects={projects ?? []}
        users={users ?? []}
        onClose={() => setDialog({ open: false, event: null, defaults: null })}
        onSaved={afterSave}
      />
    </div>
  );
}
