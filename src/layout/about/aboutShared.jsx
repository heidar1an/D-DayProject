import { useEffect, useRef, useState } from 'react';

import { toFa } from '../../services/pricing/pricingService';

export { toFa };

/*
 * ── ابزارهای مشترک لایهٔ «دربارهٔ تپش» ──
 *
 * چرا این فایل جدا است: همهٔ صحنه‌های این صفحه یک نیازِ مشترک دارند —
 * «پیشرویِ المان در اسکرول» — و اگر هر بخش شنوندهٔ خودش را وصل کند، شش
 * شنونده روی یک رویداد می‌نشیند. پس یک شنوندهٔ مشترک داریم و هر صحنه فقط
 * یک تابعِ اندازه‌گیری ثبت می‌کند.
 *
 * سه قرارداد:
 *   ۱. حرکتِ پیوسته هیچ‌وقت state نیست؛ روی متغیر CSS (`--ab-p`) نوشته می‌شود
 *      تا هر فریمِ اسکرول باعث رندرِ دوبارهٔ ری‌اکت نشود.
 *   ۲. چیزی که فقط «فعال/غیرفعال» است (کدام مرحله)، تنها هنگام تغییرِ مقدار
 *      state را عوض می‌کند.
 *   ۳. هیچ انیمیشنی بدون گارد `prefers-reduced-motion` اجرا نمی‌شود.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event) => setReduced(event.matches);

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/* ══════════════════════════════════════════════════════════════════════════
 * شنوندهٔ اسکرولِ مشترک
 * ══════════════════════════════════════════════════════════════════════════ */

const sceneListeners = new Set();
let sceneFrame = 0;

function flushScenes() {
  sceneFrame = 0;
  sceneListeners.forEach((measure) => measure());
}

function onSceneScroll() {
  if (!sceneFrame) sceneFrame = requestAnimationFrame(flushScenes);
}

/**
 * یک تابعِ اندازه‌گیری را به شنوندهٔ مشترک وصل می‌کند.
 * چرا `passive`: هیچ‌وقت `preventDefault` نمی‌کنیم، پس مرورگر می‌تواند اسکرول
 * را بدون انتظار برای جاوااسکریپت جلو ببرد.
 */
function subscribeScene(measure) {
  if (typeof window === 'undefined') return () => {};

  sceneListeners.add(measure);

  if (sceneListeners.size === 1) {
    window.addEventListener('scroll', onSceneScroll, { passive: true });
    window.addEventListener('resize', onSceneScroll);
  }

  /* اندازه‌گیریِ اولیه — تا پیش از اولین اسکرول، صحنه در حالتِ درست باشد */
  measure();

  return () => {
    sceneListeners.delete(measure);

    if (sceneListeners.size === 0) {
      window.removeEventListener('scroll', onSceneScroll);
      window.removeEventListener('resize', onSceneScroll);

      if (sceneFrame) {
        cancelAnimationFrame(sceneFrame);
        sceneFrame = 0;
      }
    }
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/**
 * پیشرویِ یک المان در اسکرول.
 *   sticky → ۰ وقتی بالای المان به بالای ویوپورت می‌رسد، ۱ وقتی پایینش به
 *            پایینِ ویوپورت می‌رسد (برای صحنه‌های چسبان).
 *   enter  → ۰ هنگام ورود از پایینِ صفحه، ۱ هنگام خروج از بالا (برای بخش‌های
 *            معمولی که فقط می‌خواهند با دیدن، زنده شوند).
 */
function progressOf(node, mode) {
  const rect = node.getBoundingClientRect();
  const viewport = window.innerHeight || 1;

  if (mode === 'enter') {
    return clamp01((viewport - rect.top) / (rect.height + viewport));
  }

  const travel = rect.height - viewport;
  if (travel <= 0) return rect.top <= 0 ? 1 : 0;

  return clamp01(-rect.top / travel);
}

/**
 * پیشروی را روی `--ab-p` همان المان می‌نویسد و — اگر `stages` داده شود —
 * اندیسِ مرحلهٔ فعال را برمی‌گرداند. هیچ رندرِ دوباره‌ای هنگام اسکرول رخ
 * نمی‌دهد مگر اینکه مرحله عوض شود.
 */
export function useScene(ref, { mode = 'sticky', stages = 0, stageMode = 'segments' } = {}) {
  const [stage, setStage] = useState(0);

  useEffect(
    () =>
      subscribeScene(() => {
        const node = ref.current;
        if (!node) return;

        const raw = progressOf(node, mode);
        node.style.setProperty('--ab-p', raw.toFixed(4));

        if (stages > 1) {
          /*
           * صحنه‌های روایی به «بازه»‌ها تقسیم می‌شوند، اما چرخه یک نقطهٔ شروع
           * و یک نقطهٔ پایان دارد. در حالت endpoints هر دو سرِ مسیر دقیقاً به
           * یک مرحلهٔ قابل‌مشاهده وصل می‌شوند و آخرین مرحله با نشانگر جا نمی‌ماند.
           */
          const scaled = stageMode === 'endpoints' ? raw * (stages - 1) : raw * stages;
          const next = Math.min(
            stages - 1,
            Math.max(0, stageMode === 'endpoints' ? Math.round(scaled) : Math.floor(scaled)),
          );
          setStage((current) => (current === next ? current : next));
        }
      }),
    [ref, mode, stages, stageMode],
  );

  return stage;
}

/* آیا المان در دید است؟ برای ورودِ پله‌ایِ متن‌ها و ترسیمِ خطوط */
export function useInView(ref, { threshold = 0.2, once = true } = {}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setInView(false);
          }
        });
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold, once]);

  return inView;
}

/**
 * جابه‌جاییِ بسیار اندکِ یک لایه با اشاره‌گر — فقط عمق می‌سازد.
 * مقدار روی `--ab-mx` و `--ab-my` (بازهٔ ‎-۱ تا ۱) نوشته می‌شود و CSS تصمیم
 * می‌گیرد چند پیکسل جابه‌جا شود. در کاهشِ حرکت غیرفعال است.
 */
export function usePointerParallax(ref) {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;

    if (!node || reduced || typeof window === 'undefined') return undefined;
    if (!window.matchMedia('(hover: hover)').matches) return undefined;

    let frame = 0;
    let x = 0;
    let y = 0;

    const write = () => {
      frame = 0;
      node.style.setProperty('--ab-mx', x.toFixed(3));
      node.style.setProperty('--ab-my', y.toFixed(3));
    };

    const onMove = (event) => {
      const rect = node.getBoundingClientRect();
      x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (!frame) frame = requestAnimationFrame(write);
    };

    const onLeave = () => {
      x = 0;
      y = 0;
      if (!frame) frame = requestAnimationFrame(write);
    };

    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    };
  }, [ref, reduced]);
}

/*
 * چیدمانِ قطبیِ گره‌ها روی چند حلقه.
 *
 * چرا مختصات در داده نیست: با کم و زیاد شدنِ گره‌ها، زاویه‌ها باید دوباره
 * پخش شوند وگرنه یک گره روی گرهٔ دیگر می‌نشیند. این تابع از `groups` می‌خواند
 * (چند گره روی هر حلقه) و خروجی‌اش هم برای SVG (درصد) و هم برای HTML مناسب است.
 */
export function ringLayout(items, groups = [5, 6], radii = [26, 41], options = {}) {
  const { startAngle = -Math.PI / 2, twist = 0 } = options;

  /* تخصیصِ حلقه از پیش ساخته می‌شود تا گرهٔ اضافه هم بی‌جا نماند */
  const assignment = [];
  groups.forEach((count, ring) => {
    for (let index = 0; index < count; index += 1) assignment.push(ring);
  });

  const lastRing = Math.max(0, groups.length - 1);

  return items.map((item, index) => {
    const ring = assignment[index] ?? lastRing;
    const seen = groups.slice(0, ring).reduce((sum, count) => sum + count, 0);
    const position = index - seen;
    const angle = startAngle + (position / groups[ring]) * Math.PI * 2 + twist * ring;
    const radius = radii[ring] ?? radii[radii.length - 1];

    return {
      ...item,
      ring,
      position,
      angle,
      radius,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
    };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * اجزای کوچکِ مشترک
 * ══════════════════════════════════════════════════════════════════════════ */

/*
 * یک خطِ متن را به واژه‌ها می‌شکند تا ورودشان پله‌ای باشد.
 * چرا: در فارسی شکستنِ کلمه به حرف معنا ندارد؛ واحدِ طبیعیِ ریتم، واژه است.
 */
export function SplitLine({ text, className = '' }) {
  const words = String(text).split(' ');

  return (
    <span className={className}>
      {words.map((word, index) => (
        <span className="ab-word" key={`${word}-${index}`} style={{ '--ab-i': index }}>
          {word}
        </span>
      ))}
    </span>
  );
}

/* پیکانِ رو به جلو — در رابطِ راست‌به‌چپ «بعدی» یعنی به چپ */
export function AboutArrow() {
  return (
    <span className="ab-arrow" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M14.5 5 8 12l6.5 7" />
      </svg>
    </span>
  );
}
