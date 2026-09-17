import { useMemo, useState } from 'react';
import { buildCalendarMonth, calendarSourceSummary, eventsForDate } from '../../../services/greenPath/calendarEngine';
import { ArrowIcon, CalendarIcon, SectionHeader, formatDate, formatMinutes, toFa } from './greenPathShared';

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const addMonths = (value, amount) => {
  const date = new Date(value);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date;
};
const monthKey = (value) => new Date(value).toISOString().slice(0, 7);
const monthLabel = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', year: 'numeric' });
function EventChip({ event, onSelect }) {
  return (
    <button type="button" className={`gp-calendar__event gp-calendar__event--${event.kind}`} style={{ '--gp-event-accent': event.accent }} onClick={() => onSelect?.(event)} title={event.title}>
      <i aria-hidden="true" />
      <span>{event.title}</span>
    </button>
  );
}

function EventDetails({ date, events, onClose }) {
  return (
    <aside className="gp-calendar__details" aria-label={`فعالیت‌های ${formatDate(date)}`}>
      <header><div><span className="gp-eyebrow">SELECTED DAY</span><h3>{formatDate(date)}</h3></div><button type="button" onClick={onClose} aria-label="بستن جزئیات">×</button></header>
      {events.length ? <div className="gp-calendar__detail-list">{events.map((event) => <article key={event.id} className="gp-calendar__detail" style={{ '--gp-event-accent': event.accent }}><div className="gp-calendar__detail-head"><span><i aria-hidden="true" />{event.sourceLabel}</span><small>{event.kind === 'task' ? formatMinutes(event.durationMinutes) : event.kind === 'exam' ? 'آزمون' : event.kind === 'deadline' ? 'ددلاین' : 'نقطه عطف'}</small></div><strong>{event.title}</strong>{event.state && <small>{event.state === 'completed' ? 'انجام‌شده' : event.state === 'planned' ? 'برنامه‌ریزی‌شده' : event.state}</small>}</article>)}</div> : <p className="gp-calendar__no-events">در این روز فعالیتی از مسیر سبز ثبت نشده است.</p>}
    </aside>
  );
}

export default function GreenPathCalendar({ snapshot, month, selectedDate, sourceFilter = 'all', onMonthChange, onSelectDate, onSourceChange, onOpenEvent }) {
  const [localMonth, setLocalMonth] = useState(() => month ? new Date(`${month}-01T00:00:00.000Z`) : new Date());
  const activeMonth = month ? new Date(`${month}-01T00:00:00.000Z`) : localMonth;
  const events = useMemo(() => {
    const all = snapshot?.calendarEvents ?? [];
    return sourceFilter === 'all' ? all : all.filter((event) => event.sourceId === sourceFilter);
  }, [snapshot?.calendarEvents, sourceFilter]);
  const calendar = useMemo(() => buildCalendarMonth({ month: activeMonth, events }), [activeMonth, events]);
  const sourceSummary = useMemo(() => calendarSourceSummary(snapshot?.calendarEvents ?? []), [snapshot?.calendarEvents]);
  const selectedEvents = selectedDate ? eventsForDate(snapshot?.calendarEvents ?? [], selectedDate) : [];

  const moveMonth = (amount) => {
    const next = addMonths(activeMonth, amount);
    const key = monthKey(next);
    setLocalMonth(next);
    onMonthChange?.(key);
  };

  return (
    <div className="gp-view gp-calendar-view">
      <section className="gp-calendar-shell">
        <header className="gp-calendar-shell__header"><div><span className="gp-eyebrow">ECOSYSTEM CALENDAR</span><h1>تقویم مسیر سبز</h1><p>همهٔ Taskها، آزمون‌ها، ددلاین‌ها و نقاط عطف مسیر در یک تقویم واحد؛ رنگ هر کارت از بخش اصلی تپش می‌آید.</p></div><div className="gp-calendar-shell__tools"><button type="button" className="gp-calendar__today" onClick={() => { const today = new Date(); const key = monthKey(today); setLocalMonth(today); onMonthChange?.(key); onSelectDate?.(today.toISOString().slice(0, 10)); }}>امروز</button><button type="button" aria-label="ماه قبل" onClick={() => moveMonth(-1)}><ArrowIcon direction="right" /></button><button type="button" aria-label="ماه بعد" onClick={() => moveMonth(1)}><ArrowIcon /></button></div></header>
        <div className="gp-calendar__month-label"><CalendarIcon className="gp-icon" /><strong>{monthLabel.format(activeMonth)}</strong><span>{toFa(calendar.days.filter((day) => day.inMonth && day.events.length).length)} روز دارای فعالیت</span></div>

        <div className="gp-calendar__source-filter" role="group" aria-label="فیلتر بخش‌های تقویم"><button type="button" className={sourceFilter === 'all' ? 'is-active' : ''} onClick={() => onSourceChange?.('all')}>همه <small>{toFa((snapshot?.calendarEvents ?? []).length)}</small></button>{sourceSummary.slice(0, 8).map((entry) => <button type="button" key={entry.sourceId} className={sourceFilter === entry.sourceId ? 'is-active' : ''} style={{ '--gp-filter-accent': entry.accent }} onClick={() => onSourceChange?.(entry.sourceId)}><i aria-hidden="true" />{entry.label}<small>{toFa(entry.count)}</small></button>)}</div>

        <div className="gp-calendar__layout"><div className="gp-calendar__grid" role="grid" aria-label="تقویم ماهانه"><div className="gp-calendar__weekdays">{WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div><div className="gp-calendar__days">{calendar.days.map((day) => { const dayEvents = day.events; const isSelected = selectedDate === day.date; return <button type="button" role="gridcell" key={day.date} className={`gp-calendar__day ${day.inMonth ? '' : 'is-outside'} ${day.isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`} onClick={() => onSelectDate?.(day.date)}><span className="gp-calendar__day-number">{toFa(day.day)}</span><span className="gp-calendar__day-events">{dayEvents.slice(0, 3).map((event) => <EventChip key={event.id} event={event} onSelect={(item) => { onSelectDate?.(day.date); onOpenEvent?.(item); }} />)}{dayEvents.length > 3 && <em>+{toFa(dayEvents.length - 3)} مورد دیگر</em>}</span></button>; })}</div></div>{selectedDate && <EventDetails date={selectedDate} events={selectedEvents} onClose={() => onSelectDate?.(null)} />}</div>
      </section>
    </div>
  );
}
