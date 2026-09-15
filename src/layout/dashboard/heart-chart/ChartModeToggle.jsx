import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LineIcon } from './chartIcons';

/*
 * سوییچ حالت نمایش نمودار قلب — دو حالت «میله‌ای» و «خطی».
 * هم‌خانوادهٔ دراپ‌داون بازه در هدر می‌نشیند؛ همان پالت آبی #132943 / #5b8cc7.
 *
 * نشانگر فعال یک قرصِ شناور است که با تغییر حالت بین دو دکمه سُر می‌خورد
 * (left/width با transition)؛ موقعیتش از خود دکمه‌ها اندازه‌گیری می‌شود تا با
 * عرض متفاوت برچسب‌ها («میله‌ای» و «خطی») هم دقیق بماند.
 * کیبورد: هر دکمه یک toggle مستقل با aria-pressed است (Tab بین دو حالت می‌چرخد).
 */

const MODES = [
  { id: 'bar', label: 'میله‌ای', icon: 'bars' },
  { id: 'line', label: 'خطی', icon: 'line' },
];

export default function ChartModeToggle({ value, onChange }) {
  const groupRef = useRef(null);
  const btnRefs = useRef([]);
  const [pill, setPill] = useState(null);

  const measure = useCallback(() => {
    const index = MODES.findIndex((mode) => mode.id === value);
    const el = btnRefs.current[index];
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);

  useLayoutEffect(() => {
    measure();
    /* بعد از لود فونت، عرض برچسب‌ها عوض می‌شود؛ نشانگر باید دوباره اندازه بگیرد */
    document.fonts?.ready.then(measure);

    const observer = new ResizeObserver(measure);
    if (groupRef.current) observer.observe(groupRef.current);

    return () => observer.disconnect();
  }, [measure]);

  /* اگر برای لحظه‌ای برچسب‌ها مخفی شوند (عرض کم)، نشانگر هم پنهان می‌ماند */
  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  return (
    <div className="chart-mode" role="group" aria-label="حالت نمایش نمودار" ref={groupRef}>
      {pill && (
        <span
          className="chart-mode__pill"
          style={{ left: `${pill.left}px`, width: `${pill.width}px` }}
          aria-hidden="true"
        />
      )}

      {MODES.map((mode, index) => {
        const isActive = mode.id === value;
        return (
          <button
            key={mode.id}
            ref={(el) => {
              btnRefs.current[index] = el;
            }}
            type="button"
            className={`chart-mode__btn ${isActive ? 'is-active' : ''}`}
            aria-pressed={isActive}
            title={`نمودار ${mode.label}`}
            onClick={() => {
              if (!isActive) onChange(mode.id);
            }}
          >
            <LineIcon name={mode.icon} size={15} />
            <span className="chart-mode__label">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
