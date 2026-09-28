/*
 * نماهای تقویم شمسی: سالانه، ماهانه، هفتگی، روزانه.
 *
 * یک فایل چون هر چهار نما یک داده می‌خورند و رنگ/چیپ رویداد باید یکی باشد؛
 * جداکردنشان به چهار فایل، همان منطق را چهار بار تکرار می‌کرد.
 *
 * جابه‌جایی با کشیدن و رهاکردن با DnD بومی HTML5 انجام می‌شود (بدون وابستگی).
 * در نمای ماه، خانهٔ روز و در نمای هفته/روز، ستون روز هدف رهاکردن است؛ در نمای
 * هفته/روز ساعت هم از محل رهاکردن حساب می‌شود.
 */

import { useMemo, useState } from 'react';

import { IconCalendar, IconClock, IconPlus } from '../../../adminIcons';
import {
  JALALI_MONTHS, JALALI_WEEKDAYS, JALALI_WEEKDAYS_SHORT, buildMonthGrid, faTime, isoDate,
  jalaliLabel, jalaliParts, jalaliWeekday, minutesOf, timeOf, toFa, weekDays,
} from '../../../../../services/planning/jalali';
import { EVENT_TYPES, PRIORITIES, colorOf, labelOf, toneOf } from '../../../../../services/planning/planningTypes';
import { Dot, Pill, Tip } from '../../planningKit';

const HOUR_HEIGHT = 54;

export const eventTone = (event) => colorOf(EVENT_TYPES, event.type, 'accent');

export function EventChip({ event, onOpen, compact = false }) {
  const tone = eventTone(event);
  return (
    <button
      type="button"
      className={`pl-chip pl-chip--${tone} ${compact ? 'pl-chip--compact' : ''}`.trim()}
      draggable
      onDragStart={(dragEvent) => {
        dragEvent.dataTransfer.setData('text/plain', event.id);
        dragEvent.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(clickEvent) => { clickEvent.stopPropagation(); onOpen?.(event); }}
      title={`${event.title} · ${faTime(event.start)}`}
    >
      {!event.allDay ? <span className="pl-chip__time">{faTime(event.start)}</span> : null}
      <span className="pl-chip__title">{event.title}</span>
    </button>
  );
}

/* ───────────────────────────── نمای سالانه ───────────────────────────── */

export function YearView({ jy, events, holidays, onSelectDay, onSelectMonth }) {
  const byDate = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    });
    return map;
  }, [events]);

  const holidayMap = useMemo(() => new Map(holidays.map((item) => [item.date, item])), [holidays]);
  const todayIso = isoDate(new Date());

  return (
    <div className="pl-year">
      {JALALI_MONTHS.map((month, index) => {
        const jm = index + 1;
        const grid = buildMonthGrid(jy, jm);
        return (
          <section key={month} className="pl-year__month">
            <header className="pl-year__head">
              <button type="button" className="pl-linkbtn" onClick={() => onSelectMonth?.(jm)}>{month}</button>
            </header>

            <div className="pl-year__dow">
              {JALALI_WEEKDAYS_SHORT.map((day) => <span key={day}>{day}</span>)}
            </div>

            <div className="pl-year__grid">
              {grid.map((cell) => {
                const list = byDate.get(cell.iso) ?? [];
                const holiday = holidayMap.get(cell.iso);
                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={[
                      'pl-year__cell',
                      cell.inMonth ? '' : 'is-out',
                      cell.isFriday || holiday ? 'is-holiday' : '',
                      cell.isToday ? 'is-today' : '',
                      list.length ? 'has-events' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => onSelectDay?.(cell.iso)}
                    title={holiday ? holiday.title : `${toFa(cell.jd)} ${month}`}
                  >
                    <span>{toFa(cell.jd)}</span>
                    {list.length ? <span className="pl-year__dots">{[0, 1, 2].slice(0, Math.min(3, list.length)).map((dot) => (
                      <i key={dot} style={{ background: `var(--pl-tone-${eventTone(list[dot])})` }} />
                    ))}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── نمای ماهانه ───────────────────────────── */

export function MonthView({
  jy, jm, events, holidays, onSelectDay, onOpenEvent, onQuickCreate, onMoveEvent,
}) {
  const [dragOver, setDragOver] = useState('');

  const grid = useMemo(() => buildMonthGrid(jy, jm), [jy, jm]);
  const holidayMap = useMemo(() => new Map(holidays.map((item) => [item.date, item])), [holidays]);

  const byDate = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    });
    map.forEach((list) => list.sort((a, b) => minutesOf(a.start) - minutesOf(b.start)));
    return map;
  }, [events]);

  const handleDrop = (cell, dropEvent) => {
    dropEvent.preventDefault();
    setDragOver('');
    const id = dropEvent.dataTransfer.getData('text/plain');
    if (id) onMoveEvent?.(id, { date: cell.iso });
  };

  return (
    <div className="pl-month">
      <div className="pl-month__dow">
        {JALALI_WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="pl-month__grid">
        {grid.map((cell) => {
          const list = byDate.get(cell.iso) ?? [];
          const holiday = holidayMap.get(cell.iso);
          const visible = list.slice(0, 3);
          const rest = list.length - visible.length;

          return (
            <div
              key={cell.key}
              className={[
                'pl-month__cell',
                cell.inMonth ? '' : 'is-out',
                cell.isFriday || holiday ? 'is-holiday' : '',
                cell.isToday ? 'is-today' : '',
                dragOver === cell.iso ? 'is-drop' : '',
              ].filter(Boolean).join(' ')}
              onDragOver={(dragEvent) => { dragEvent.preventDefault(); setDragOver(cell.iso); }}
              onDragLeave={() => setDragOver((current) => (current === cell.iso ? '' : current))}
              onDrop={(dropEvent) => handleDrop(cell, dropEvent)}
            >
              <header className="pl-month__cellhead">
                <button type="button" className="pl-month__daynum" onClick={() => onSelectDay?.(cell.iso)}>
                  {toFa(cell.jd)}
                </button>
                {holiday ? <span className="pl-month__holiday" title={holiday.title}>{holiday.title}</span> : null}
                <Tip text="رویداد تازه">
                  <button
                    type="button"
                    className="pl-month__add"
                    aria-label="رویداد تازه"
                    onClick={() => onQuickCreate?.(cell.iso)}
                  >
                    <IconPlus width={13} height={13} />
                  </button>
                </Tip>
              </header>

              <div className="pl-month__events">
                {visible.map((event) => <EventChip key={event.id} event={event} onOpen={onOpenEvent} compact />)}
                {rest > 0 ? (
                  <button type="button" className="pl-month__more" onClick={() => onSelectDay?.(cell.iso)}>
                    {toFa(rest)} رویداد دیگر
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────── نمای هفتگی و روزانه ───────────────────────────── */

function useHourRange(workingHours) {
  return useMemo(() => {
    const from = Math.floor(minutesOf(workingHours?.from ?? '08:00') / 60);
    const to = Math.ceil(minutesOf(workingHours?.to ?? '20:00') / 60);
    const hours = [];
    for (let hour = from; hour < to; hour += 1) hours.push(hour);
    return { from, hours };
  }, [workingHours]);
}

function DayColumn({
  date, events, holiday, isToday, hourFrom, hours, onOpenEvent, onQuickCreate, onMoveEvent,
}) {
  const [dragOver, setDragOver] = useState(false);

  const allDay = events.filter((event) => event.allDay);
  const timed = events.filter((event) => !event.allDay);
  const iso = isoDate(date);

  const handleDrop = (dropEvent) => {
    dropEvent.preventDefault();
    setDragOver(false);
    const id = dropEvent.dataTransfer.getData('text/plain');
    if (!id) return;

    const rect = dropEvent.currentTarget.getBoundingClientRect();
    const offset = dropEvent.clientY - rect.top;
    const minutes = hourFrom * 60 + Math.max(0, Math.round((offset / HOUR_HEIGHT) * 60 / 15) * 15);
    onMoveEvent?.(id, { date: iso, start: timeOf(Math.min(minutes, 23 * 60 + 45)) });
  };

  return (
    <div className="pl-daycol">
      <header className={`pl-daycol__head ${isToday ? 'is-today' : ''}`}>
        <strong>{JALALI_WEEKDAYS[jalaliWeekday(date)]}</strong>
        <span>{jalaliLabel(date, { short: true })}</span>
        {holiday ? <em title={holiday.title}>{holiday.title}</em> : null}
      </header>

      <div className="pl-daycol__allday">
        {allDay.map((event) => <EventChip key={event.id} event={event} onOpen={onOpenEvent} />)}
      </div>

      <div
        className={`pl-daycol__slots ${dragOver ? 'is-drop' : ''}`.trim()}
        onDragOver={(dragEvent) => { dragEvent.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {hours.map((hour) => (
          <div
            key={hour}
            className="pl-daycol__slot"
            style={{ height: HOUR_HEIGHT }}
            onDoubleClick={() => onQuickCreate?.(iso, timeOf(hour * 60))}
          >
            <button
              type="button"
              className="pl-daycol__slotadd"
              aria-label={`رویداد تازه ساعت ${toFa(hour)}`}
              onClick={() => onQuickCreate?.(iso, timeOf(hour * 60))}
            >
              <IconPlus width={12} height={12} />
            </button>
          </div>
        ))}

        {timed.map((event) => {
          const start = minutesOf(event.start);
          const end = Math.max(start + 15, minutesOf(event.end || event.start));
          const top = ((start - hourFrom * 60) / 60) * HOUR_HEIGHT;
          const height = Math.max(24, ((end - start) / 60) * HOUR_HEIGHT - 3);
          const tone = eventTone(event);

          return (
            <button
              key={event.id}
              type="button"
              className={`pl-block pl-block--${tone}`}
              style={{ top, height }}
              draggable
              onDragStart={(dragEvent) => {
                dragEvent.dataTransfer.setData('text/plain', event.id);
                dragEvent.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onOpenEvent?.(event)}
              title={`${event.title} · ${faTime(event.start)} تا ${faTime(event.end)}`}
            >
              <span className="pl-block__title">{event.title}</span>
              <span className="pl-block__time">{faTime(event.start)} – {faTime(event.end)}</span>
              {event.location ? <span className="pl-block__where">{event.location}</span> : null}
            </button>
          );
        })}

        {isToday ? <NowLine hourFrom={hourFrom} /> : null}
      </div>
    </div>
  );
}

function NowLine({ hourFrom }) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = ((minutes - hourFrom * 60) / 60) * HOUR_HEIGHT;
  if (top < 0) return null;
  return (
    <div className="pl-nowline" style={{ top }} aria-hidden="true">
      <span>{toFa(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}</span>
    </div>
  );
}

export function WeekView({
  date, events, holidays, onOpenEvent, onQuickCreate, onMoveEvent, workingHours,
}) {
  const days = useMemo(() => weekDays(date), [date]);
  const { from, hours } = useHourRange(workingHours);
  const holidayMap = useMemo(() => new Map(holidays.map((item) => [item.date, item])), [holidays]);
  const todayIso = isoDate(new Date());

  const byDate = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    });
    map.forEach((list) => list.sort((a, b) => minutesOf(a.start) - minutesOf(b.start)));
    return map;
  }, [events]);

  return (
    <div className="pl-week">
      <div className="pl-week__hourshead" />
      <div className="pl-week__dayheads">
        {days.map((day) => {
          const iso = isoDate(day);
          return (
            <div key={iso} className={`pl-week__dayhead ${iso === todayIso ? 'is-today' : ''}`}>
              <strong>{JALALI_WEEKDAYS[jalaliWeekday(day)]}</strong>
              <span>{toFa(jalaliParts(day).jd)} {JALALI_MONTHS[jalaliParts(day).jm - 1]}</span>
            </div>
          );
        })}
      </div>

      <div className="pl-week__alldaylabel">تمام‌روز</div>
      <div className="pl-week__allday">
        {days.map((day) => {
          const iso = isoDate(day);
          return (
            <div key={iso} className="pl-week__alldaycell">
              {(byDate.get(iso) ?? []).filter((event) => event.allDay).map((event) => (
                <EventChip key={event.id} event={event} onOpen={onOpenEvent} />
              ))}
            </div>
          );
        })}
      </div>

      <div className="pl-week__hourlabels">
        {hours.map((hour) => (
          <span key={hour} className="pl-week__hourlabel" style={{ height: HOUR_HEIGHT }}>{toFa(`${String(hour).padStart(2, '0')}:۰۰`)}</span>
        ))}
      </div>

      <div className="pl-week__cols">
        {days.map((day) => {
          const iso = isoDate(day);
          return (
            <DayColumn
              key={iso}
              date={day}
              events={byDate.get(iso) ?? []}
              holiday={holidayMap.get(iso)}
              isToday={iso === todayIso}
              hourFrom={from}
              hours={hours}
              onOpenEvent={onOpenEvent}
              onQuickCreate={onQuickCreate}
              onMoveEvent={onMoveEvent}
            />
          );
        })}
      </div>
    </div>
  );
}

export function DayView({
  date, events, holidays, onOpenEvent, onQuickCreate, onMoveEvent, workingHours,
}) {
  const { from, hours } = useHourRange(workingHours);
  const iso = isoDate(date);
  const holiday = holidays.find((item) => item.date === iso);
  const todayIso = isoDate(new Date());

  const dayEvents = useMemo(
    () => events.filter((event) => event.date === iso).sort((a, b) => minutesOf(a.start) - minutesOf(b.start)),
    [events, iso],
  );

  const summary = useMemo(() => {
    const types = new Map();
    dayEvents.forEach((event) => {
      types.set(event.type, (types.get(event.type) ?? 0) + 1);
    });
    return Array.from(types.entries());
  }, [dayEvents]);

  return (
    <div className="pl-day">
      <aside className="pl-day__side">
        <div className="pl-day__date">
          <strong>{JALALI_WEEKDAYS[jalaliWeekday(date)]}</strong>
          <span>{jalaliLabel(date)}</span>
          {holiday ? <Pill tone="danger">{holiday.title}</Pill> : null}
        </div>

        <div className="pl-day__count">
          <b>{toFa(dayEvents.length)}</b>
          <span>رویداد در این روز</span>
        </div>

        <ul className="pl-day__types">
          {summary.map(([type, count]) => (
            <li key={type}>
              <Dot tone={colorOf(EVENT_TYPES, type)} />
              <span>{labelOf(EVENT_TYPES, type)}</span>
              <b>{toFa(count)}</b>
            </li>
          ))}
        </ul>

        <button type="button" className="pl-btn pl-btn--ghost pl-btn--sm" onClick={() => onQuickCreate?.(iso, '09:00')}>
          <IconPlus width={14} height={14} />
          رویداد تازه
        </button>
      </aside>

      <div className="pl-day__main">
        <div className="pl-day__slots">
          {hours.map((hour) => (
            <div key={hour} className="pl-day__slot" style={{ height: HOUR_HEIGHT }}>
              <span className="pl-day__hour">{toFa(`${String(hour).padStart(2, '0')}:۰۰`)}</span>
              <div className="pl-day__slotbody" />
            </div>
          ))}

          {dayEvents.filter((event) => !event.allDay).map((event) => {
            const start = minutesOf(event.start);
            const end = Math.max(start + 15, minutesOf(event.end || event.start));
            const top = ((start - from * 60) / 60) * HOUR_HEIGHT;
            const height = Math.max(26, ((end - start) / 60) * HOUR_HEIGHT - 4);
            const tone = eventTone(event);

            return (
              <button
                key={event.id}
                type="button"
                className={`pl-block pl-block--${tone} pl-block--wide`}
                style={{ top, height }}
                onClick={() => onOpenEvent?.(event)}
              >
                <span className="pl-block__title">{event.title}</span>
                <span className="pl-block__time">{faTime(event.start)} – {faTime(event.end)}</span>
                {event.location ? <span className="pl-block__where">{event.location}</span> : null}
                <span className="pl-block__meta">
                  <Pill tone={toneOf(PRIORITIES, event.priority)} soft={false}>{labelOf(PRIORITIES, event.priority)}</Pill>
                </span>
              </button>
            );
          })}

          {iso === todayIso ? <NowLine hourFrom={from} /> : null}
        </div>

        {dayEvents.some((event) => event.allDay) ? (
          <div className="pl-day__allday">
            <span className="pl-day__alldaylabel"><IconCalendar width={14} height={14} /> تمام‌روز</span>
            {dayEvents.filter((event) => event.allDay).map((event) => (
              <EventChip key={event.id} event={event} onOpen={onOpenEvent} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* نوار خلاصهٔ زیر تقویم — برای هر نمای فعال */
export function CalendarSummary({ events, date }) {
  const stats = useMemo(() => {
    const todayIso = isoDate(new Date());
    return {
      total: events.length,
      today: events.filter((event) => event.date === todayIso).length,
      upcoming: events.filter((event) => event.date > todayIso).length,
      allDay: events.filter((event) => event.allDay).length,
    };
  }, [events]);

  return (
    <div className="pl-calstats">
      <span><b>{toFa(stats.total)}</b> رویداد در بازه</span>
      <span><b>{toFa(stats.today)}</b> امروز</span>
      <span><b>{toFa(stats.upcoming)}</b> پیش‌رو</span>
      <span><b>{toFa(stats.allDay)}</b> تمام‌روز</span>
      <span className="pl-calstats__date">
        <IconClock width={14} height={14} />
        {jalaliLabel(date)}
      </span>
    </div>
  );
}
