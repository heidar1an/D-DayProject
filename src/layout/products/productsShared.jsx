import { useEffect, useRef, useState } from 'react';

import { toFa } from '../../services/pricing/pricingService';

export { toFa };

/*
 * ── ابزارهای مشترک بخش محصولات ──
 *
 * سه قرارداد در این فایل رعایت شده:
 *   ۱. هیچ انیمیشنی بدون گارد `prefers-reduced-motion` اجرا نمی‌شود.
 *   ۲. حرکتِ پیوسته (پارالاکس) به‌جای state، مستقیم روی متغیر CSS نوشته
 *      می‌شود تا هر فریمِ اسکرول باعث رندر دوبارهٔ ری‌اکت نشود.
 *   ۳. چیزی که فقط باید «فعال/غیرفعال» باشد (کدام ویژگیِ نمای چسبان)، تنها
 *      هنگام تغییر مقدار state را عوض می‌کند.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event) => setReduced(event.matches);

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/* پیشرویِ یک بخش در اسکرول: ۰ در لحظهٔ ورودِ بالای المان، ۱ در لحظهٔ خروجِ پایین */
function progressOf(node) {
  const rect = node.getBoundingClientRect();
  const travel = rect.height - window.innerHeight;

  if (travel <= 0) return rect.top <= 0 ? 1 : 0;

  return Math.min(1, Math.max(0, -rect.top / travel));
}

/*
 * یک شنوندهٔ اسکرول مشترک — هر فریم یک‌بار، غیرفعال هنگام کاهش حرکت.
 * چرا `passive`: هیچ‌وقت preventDefault نمی‌کنیم، پس مرورگر می‌تواند اسکرول را
 * بدون انتظار برای جاوااسکریپت جلو ببرد.
 */
function subscribeScroll(node, onFrame) {
  if (!node || typeof window === 'undefined') return () => {};
  if (prefersReducedMotion()) return () => {};

  let frame = 0;

  const measure = () => {
    frame = 0;
    onFrame();
  };

  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };

  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  return () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

/* پیشروی را روی `--ps-progress`ِ همان المان می‌نویسد — بدون رندر دوباره */
export function useScrollProgressVar(ref) {
  useEffect(
    () =>
      subscribeScroll(ref.current, () => {
        const node = ref.current;
        if (node) node.style.setProperty('--ps-progress', String(progressOf(node)));
      }),
    [ref],
  );
}

/* اندیسِ مرحلهٔ فعال در نمای چسبان — فقط هنگام تغییر state را برمی‌گرداند */
export function useStageIndex(ref, count) {
  const [index, setIndex] = useState(0);

  useEffect(
    () =>
      subscribeScroll(ref.current, () => {
        const node = ref.current;
        if (!node) return;

        const next = Math.min(count - 1, Math.max(0, Math.floor(progressOf(node) * count)));
        setIndex((current) => (current === next ? current : next));
      }),
    [ref, count],
  );

  return index;
}

/* آیا المان در دید است؟ برای روشن‌کردنِ شمارندهٔ زندهٔ آزمون هماهنگ */
export function useInView(ref, threshold = 0.25) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setInView(entry.isIntersecting));
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return inView;
}

/* پیکانِ رو به جلو — در رابطِ راست‌به‌چپ «بعدی» یعنی به چپ */
export function ProductArrow() {
  return (
    <span className="ps-arrow" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M14.5 5 8 12l6.5 7" />
      </svg>
    </span>
  );
}

/* واحدِ امتیاز تپش */
export function HeartGlyph() {
  return (
    <span className="ps-heart" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7-2.4c0 5-7 9.4-7 9.4z" />
      </svg>
    </span>
  );
}
