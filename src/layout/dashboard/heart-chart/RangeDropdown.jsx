import { useEffect, useRef, useState } from 'react';

const OPTIONS = [
  { id: 'daily', label: 'روزانه' },
  { id: 'weekly', label: 'هفتگی' },
  { id: 'monthly', label: 'ماهانه' },
  { id: 'yearly', label: 'سالانه' },
];

/*
 * دراپ‌داون انتخاب بازهٔ نمودار قلب — هم‌شکل دکمهٔ قبلی (.dashboard__chart-period).
 * کیبورد: باز/بسته با Enter و Space، جابه‌جایی با Arrowها، خروج با Escape.
 */
export default function RangeDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const selectedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    /* فوکوس اولیه روی گزینهٔ انتخاب‌شده تا ناوبری کیبورد از همان‌جا شروع شود */
    selectedRef.current?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const select = (id) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (id !== value) onChange(id);
  };

  const onMenuKeyDown = (event) => {
    const currentIndex = OPTIONS.findIndex((option) => option.id === value);
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step) {
      event.preventDefault();
      const next = OPTIONS[(currentIndex + step + OPTIONS.length) % OPTIONS.length];
      onChange(next.id);
      /* بعد از تغییر، فوکوس روی گزینهٔ جدید می‌ماند تا ادامهٔ پیمایش روان باشد */
      requestAnimationFrame(() => selectedRef.current?.focus());
    }
  };

  const selectedLabel = OPTIONS.find((option) => option.id === value)?.label ?? 'روزانه';

  return (
    <div className="heart-range" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className="dashboard__chart-period heart-range__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`بازهٔ نمودار: ${selectedLabel}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        {selectedLabel}
        <span className={`dashboard__chart-period-arrow heart-range__arrow ${open ? 'is-open' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <ul className="heart-range__menu" role="listbox" aria-label="انتخاب بازهٔ نمودار" onKeyDown={onMenuKeyDown}>
          {OPTIONS.map((option) => {
            const isSelected = option.id === value;
            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  ref={isSelected ? selectedRef : null}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={`heart-range__item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => select(option.id)}
                >
                  <span className="heart-range__check" aria-hidden="true">
                    {isSelected ? '✓' : ''}
                  </span>
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
