import { useMemo, useRef } from 'react';

import { getAboutCycle } from '../../services/about/aboutService';
import { ringLayout, useInView, useScene } from './aboutShared';

/*
 * ── محصولات به عنوان یک چرخه ──
 *
 * مرکزِ این بخش «یادگیرنده» است، نه محصول. هفت مرحله دورِ آن می‌چرخند و با
 * اسکرول، نشانگر روی همان مسیر می‌رود؛ هر مرحله ابزارهایی را که در آن نقش
 * دارند نشان می‌دهد. idea ساده است: هیچ ابزاری انتهای مسیر نیست — هر کدام
 * ورودیِ مرحلهٔ بعدی‌اند.
 *
 * کمانِ پیشروی با `pathLength="1"` ساخته شده: کلِ دایره طولِ ۱ دارد، پس
 * `stroke-dashoffset: calc(1 - var(--ab-p))` دقیقاً همان مقداری را پر می‌کند
 * که کاربر اسکرول کرده — بدون یک خط جاوااسکریپت در هر فریم.
 */

/* دایرهٔ کامل روی مرکزِ (۵۰٬۵۰) با شعاع ۴۰ — دو کمانِ پشتِ سرِ هم */
const FULL_CIRCLE = 'M 50 10 A 40 40 0 1 1 50 90 A 40 40 0 1 1 50 10';

export default function EcosystemVisualization() {
  const data = getAboutCycle();
  const rootRef = useRef(null);
  const fieldRef = useRef(null);

  const stage = useScene(rootRef, {
    mode: 'sticky',
    stages: data.phases.length,
    stageMode: 'endpoints',
  });
  const inView = useInView(fieldRef, { threshold: 0.25 });

  const phases = useMemo(
    () => ringLayout(data.phases, [data.phases.length], [40]),
    [data.phases],
  );

  const active = data.phases[stage] ?? data.phases[0];

  return (
    <section
      className="ab-cycle"
      ref={rootRef}
      style={{ '--ab-stages': data.phases.length }}
      aria-labelledby="ab-cycle-title"
    >
      <div className="ab-cycle__stage">
        <header className="ab-cycle__head section-shell">
          <p className="ab-eyebrow">{data.eyebrow}</p>
          <h2 className="ab-title" id="ab-cycle-title">
            {data.title}
          </h2>
        </header>

        <div className="ab-cycle__body section-shell">
          <div className={`ab-cycle__field ${inView ? 'is-in' : ''}`} ref={fieldRef}>
            <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <circle
                className="ab-cycle__ring"
                cx="50"
                cy="50"
                r="40"
                vectorEffect="non-scaling-stroke"
              />
              {/*
                کمانِ پیشروی: همان دایره، اما به صورت `path` با `pathLength="1"`
                تا `stroke-dashoffset` دقیقاً همان قدری را پر کند که کاربر
                اسکرول کرده است.
              */}
              <path
                className="ab-cycle__arc"
                d={FULL_CIRCLE}
                pathLength="1"
                vectorEffect="non-scaling-stroke"
              />
              <g className="ab-cycle__pointer">
                <line x1="50" y1="50" x2="50" y2="8" vectorEffect="non-scaling-stroke" />
                <circle className="ab-cycle__marker" cx="50" cy="8" r="2.4" />
              </g>
            </svg>

            <p className="ab-cycle__center">{data.center}</p>

            {phases.map((phase, index) => (
              <span
                className={`ab-cycle__phase ${index === stage ? 'is-active' : ''}`}
                key={phase.id}
                style={{ left: `${phase.x}%`, top: `${phase.y}%`, '--ab-i': index }}
              >
                {phase.label}
              </span>
            ))}
          </div>

          <div className="ab-cycle__panel">
            <p className="ab-cycle__panel-label" key={`label-${active.id}`}>
              {active.label}
            </p>

            <ul className="ab-cycle__products" key={`products-${active.id}`}>
              {active.products.map((product) => (
                <li key={product}>{product}</li>
              ))}
            </ul>

            <p className="ab-cycle__note">
              هر مرحله به مرحلهٔ بعد ختم می‌شود؛ چرخه، مجموعه‌ای از ابزارهای جدا
              نیست.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
