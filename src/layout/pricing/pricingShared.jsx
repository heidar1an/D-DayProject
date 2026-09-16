import { useCallback, useEffect, useRef, useState } from 'react';

import { formatNumberFa } from '../../services/pricing/pricingService';

/*
 * ابزارهای مشترک لایهٔ تعرفه.
 * همه چیز این‌جا «بی‌حالت» و کم‌هزینه است: هیچ کتابخانهٔ اضافه‌ای، هیچ انیمیشن
 * جاوااسکریپتی سنگین — فقط transform و opacity.
 */

/*
 * عدد متحرک — تغییر قیمت نباید پرشی باشد.
 * از مقدار نمایش‌داده‌شدهٔ فعلی به مقدار تازه با easing ملایم می‌رود و اگر
 * وسط راه مقدار عوض شود، از همان نقطه ادامه می‌دهد (بدون پرش به عقب).
 * با prefers-reduced-motion فقط مقدار نهایی نشان داده می‌شود.
 */
export function AnimatedNumber({ value, format = formatNumberFa, duration = 460, className }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const frameRef = useRef(0);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    const from = displayRef.current;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || from === value) {
      displayRef.current = value;
      setDisplay(value);
      return undefined;
    }

    const startedAt = performance.now();

    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      /* easeOutCubic — سریع شروع می‌شود و نرم می‌نشیند */
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(from + (value - from) * eased);

      displayRef.current = next;
      setDisplay(next);

      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}

/* آیا حرکت‌های اشاره‌گر مجاز است؟ (تم روشن/تیره نقشی ندارد، فقط ورودی و حرکت) */
function pointerEffectsAllowed() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;

  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    window.matchMedia('(pointer: fine)').matches
  );
}

/*
 * ردیابی اشاره‌گر روی سطح کارت.
 * دو چیز را با CSS variable می‌نویسد: موقعیت نور (`--pr-mx/--pr-my`) و تیلت
 * بسیار جزئی (`--pr-tilt-x/--pr-tilt-y`، حداکثر حدود یک درجه).
 * نوشتن با requestAnimationFrame گِرد می‌شود تا در هر فریم حداکثر یک بار
 * استایل بنویسیم — بدون این، pointermove در کارت‌های زیاد می‌تواند layout
 * thrashing بسازد.
 */
export function useSurfacePointer({ maxTilt = 1.1 } = {}) {
  const ref = useRef(null);
  const frameRef = useRef(0);
  const pendingRef = useRef(null);

  const commit = useCallback(() => {
    frameRef.current = 0;

    const element = ref.current;
    const point = pendingRef.current;
    if (!element || !point) return;

    element.style.setProperty('--pr-mx', `${point.x}%`);
    element.style.setProperty('--pr-my', `${point.y}%`);
    element.style.setProperty('--pr-tilt-x', `${point.tiltX.toFixed(2)}deg`);
    element.style.setProperty('--pr-tilt-y', `${point.tiltY.toFixed(2)}deg`);
  }, []);

  const onPointerMove = useCallback(
    (event) => {
      if (event.pointerType !== 'mouse' || !pointerEffectsAllowed()) return;

      const element = ref.current;
      if (!element) return;

      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const x = ((event.clientX - bounds.left) / bounds.width) * 100;
      const y = ((event.clientY - bounds.top) / bounds.height) * 100;

      pendingRef.current = {
        x,
        y,
        tiltX: ((y - 50) / 50) * maxTilt * -1,
        tiltY: ((x - 50) / 50) * maxTilt,
      };

      if (!frameRef.current) frameRef.current = requestAnimationFrame(commit);
    },
    [commit, maxTilt],
  );

  const resetPointer = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    element.style.removeProperty('--pr-mx');
    element.style.removeProperty('--pr-my');
    element.style.removeProperty('--pr-tilt-x');
    element.style.removeProperty('--pr-tilt-y');
  }, []);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
  }, []);

  return { ref, onPointerMove, onPointerLeave: resetPointer };
}

/* ── آیکون‌های خطی بسیار ساده (SVG درون‌خطی، بدون کتابخانه) ── */

export function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.2 8.4 6.4 11.6 12.8 4.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MinusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 8h8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PartialIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.6 2.4" />
    </svg>
  );
}

export function ArrowStartIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M11.6 4.4 5.6 10l6 5.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
