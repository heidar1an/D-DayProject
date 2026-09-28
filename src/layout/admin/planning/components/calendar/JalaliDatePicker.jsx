/*
 * انتخابگر تاریخ شمسی.
 *
 * `<input type="date">` بومی مرورگر تقویم میلادی نشان می‌دهد و برای پنل فارسی
 * بی‌فایده است؛ این کامپوننت یک ورودی متنی + تقویم کوچک شناور است که مقدار را
 * همچنان میلادی ISO (`YYYY-MM-DD`) نگه می‌دارد تا با لایهٔ داده یکی بماند.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { IconCalendar, IconChevron, IconClose } from '../../../adminIcons';
import {
  JALALI_MONTHS, JALALI_WEEKDAYS_SHORT, buildMonthGrid, isoDate, jalaliLabel,
  jalaliParts, jalaliToIso, shiftJalaliMonth, toFa, todayJalali,
} from '../../../../../services/planning/jalali';

export default function JalaliDatePicker({
  value, onChange, placeholder = 'انتخاب تاریخ', disabled = false, allowClear = true, id,
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const parts = jalaliParts(value) ?? todayJalali();
    return { jy: parts.jy, jm: parts.jm };
  });

  const wrapRef = useRef(null);

  useEffect(() => {
    const parts = jalaliParts(value);
    if (parts) setCursor({ jy: parts.jy, jm: parts.jm });
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const grid = useMemo(() => buildMonthGrid(cursor.jy, cursor.jm), [cursor.jy, cursor.jm]);
  const todayIso = isoDate(new Date());

  const pick = (iso) => {
    onChange?.(iso);
    setOpen(false);
  };

  return (
    <div className="pl-datepicker" ref={wrapRef}>
      <button
        type="button"
        id={id}
        className={`pl-datepicker__input ${value ? '' : 'is-empty'}`.trim()}
        onClick={() => !disabled && setOpen((state) => !state)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <IconCalendar width={15} height={15} />
        <span>{value ? jalaliLabel(value) : placeholder}</span>
        {allowClear && value && !disabled ? (
          <span
            className="pl-datepicker__clear"
            role="button"
            tabIndex={-1}
            aria-label="پاک کردن تاریخ"
            onClick={(event) => { event.stopPropagation(); onChange?.(''); }}
          >
            <IconClose width={13} height={13} />
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="pl-datepicker__pop" role="dialog" aria-label="تقویم">
          <header className="pl-datepicker__head">
            <button
              type="button"
              className="pl-iconbtn"
              aria-label="ماه قبل"
              onClick={() => setCursor((state) => shiftJalaliMonth(state.jy, state.jm, -1))}
            >
              <IconChevron width={15} height={15} />
            </button>
            <strong>{toFa(`${JALALI_MONTHS[cursor.jm - 1]} ${cursor.jy}`)}</strong>
            <button
              type="button"
              className="pl-iconbtn"
              aria-label="ماه بعد"
              onClick={() => setCursor((state) => shiftJalaliMonth(state.jy, state.jm, 1))}
              style={{ transform: 'rotate(180deg)' }}
            >
              <IconChevron width={15} height={15} />
            </button>
          </header>

          <div className="pl-datepicker__dow">
            {JALALI_WEEKDAYS_SHORT.map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className="pl-datepicker__grid">
            {grid.map((cell) => (
              <button
                key={cell.key}
                type="button"
                className={[
                  'pl-datepicker__cell',
                  cell.inMonth ? '' : 'is-out',
                  cell.isFriday ? 'is-holiday' : '',
                  cell.iso === value ? 'is-selected' : '',
                  cell.iso === todayIso ? 'is-today' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => pick(cell.iso)}
              >
                {toFa(cell.jd)}
              </button>
            ))}
          </div>

          <footer className="pl-datepicker__foot">
            <button type="button" className="pl-linkbtn" onClick={() => pick(todayIso)}>امروز</button>
            <button
              type="button"
              className="pl-linkbtn"
              onClick={() => setCursor({ jy: todayJalali().jy, jm: todayJalali().jm })}
            >
              ماه جاری
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}

/* انتخابگر سال شمسی — فهرست سال‌های اطراف سال جاری */
export function JalaliYearSelect({ value, onChange, years = 6, id }) {
  const current = Number(value) || todayJalali().jy;
  const options = useMemo(
    () => Array.from({ length: years * 2 + 1 }, (_, index) => current - years + index).filter((year) => year > 1300),
    [current, years],
  );

  return (
    <select
      id={id}
      className="pl-select"
      value={current}
      onChange={(event) => onChange?.(Number(event.target.value))}
      aria-label="سال شمسی"
    >
      {options.map((year) => (
        <option key={year} value={year}>{toFa(year)}</option>
      ))}
    </select>
  );
}

/* انتخابگر ماه شمسی */
export function JalaliMonthSelect({ value, onChange, id }) {
  return (
    <select
      id={id}
      className="pl-select"
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value ? Number(event.target.value) : null)}
      aria-label="ماه شمسی"
    >
      <option value="">همهٔ ماه‌ها</option>
      {JALALI_MONTHS.map((month, index) => (
        <option key={month} value={index + 1}>{month}</option>
      ))}
    </select>
  );
}

/* جفت «از تاریخ تا تاریخ» — پرکاربرد در فیلترها */
export function DateRangeFields({ from, to, onChange, labels = ['از تاریخ', 'تا تاریخ'] }) {
  return (
    <>
      <label className="pl-inline-field">
        <span>{labels[0]}</span>
        <JalaliDatePicker value={from} onChange={(iso) => onChange?.({ from: iso, to })} />
      </label>
      <label className="pl-inline-field">
        <span>{labels[1]}</span>
        <JalaliDatePicker value={to} onChange={(iso) => onChange?.({ from, to: iso })} />
      </label>
    </>
  );
}

export { jalaliToIso };
