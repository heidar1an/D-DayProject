import { useRef } from 'react';

import { getAboutHero } from '../../services/about/aboutService';
import { SplitLine, useScene } from './aboutShared';

/*
 * ── آغاز: تپش را معرفی نمی‌کنیم، حسش می‌کنیم ──
 *
 * دو جمله، یک جا. جملهٔ اول با اسکرول عقب می‌رود و جملهٔ دوم جایش را می‌گیرد؛
 * جابه‌جایی نه با state که با `--ab-p` انجام می‌شود (هر فریم فقط یک متغیرِ CSS
 * عوض می‌شود). عنصرِ انتزاعیِ پس‌زمینه نه قلب است، نه نوار ECG — فقط حلقه‌هایی
 * است که با همان پیشروی می‌چرخند و بزرگ می‌شوند.
 */

/* حلقه‌ها و نشانه‌های میدان — اعدادِ هندسی‌اند، نه دادهٔ محصول */
const RINGS = [92, 148, 204, 260];
const TICKS = Array.from({ length: 36 }, (_, index) => index * 10);

function PulseField() {
  return (
    <div className="ab-pulse" aria-hidden="true">
      <svg viewBox="0 0 600 600" focusable="false">
        <g className="ab-pulse__spin">
          {RINGS.map((radius, index) => (
            <g
              className={`ab-pulse__ring ab-pulse__ring--${index}`}
              key={`ring-${radius}`}
              style={{ '--ab-i': index }}
            >
              <circle
                cx="300"
                cy="300"
                r={radius}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}

          {TICKS.map((angle) => (
            <line
              x1={300 + Math.cos((angle * Math.PI) / 180) * 272}
              y1={300 + Math.sin((angle * Math.PI) / 180) * 272}
              x2={300 + Math.cos((angle * Math.PI) / 180) * 284}
              y2={300 + Math.sin((angle * Math.PI) / 180) * 284}
              key={`tick-${angle}`}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* سه گره روی حلقهٔ دوم — فقط برای حسِ «جریان» */}
          {[0, 140, 250].map((angle, index) => (
            <circle
              cx={300 + Math.cos((angle * Math.PI) / 180) * 148}
              cy={300 + Math.sin((angle * Math.PI) / 180) * 148}
              r="4.5"
              key={`node-${angle}`}
              className="ab-pulse__node"
              style={{ '--ab-i': index }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

export default function AboutHero() {
  const hero = getAboutHero();
  const rootRef = useRef(null);

  useScene(rootRef, { mode: 'sticky' });

  return (
    <section className="ab-hero" ref={rootRef} aria-labelledby="ab-hero-line">
      <div className="ab-hero__stage">
        <PulseField />

        <div className="ab-hero__first">
          <p className="ab-eyebrow">{hero.eyebrow}</p>
          <h1 className="ab-hero__line" id="ab-hero-line">
            <SplitLine text={hero.line} />
          </h1>
          <p className="ab-hero__sub">{hero.sub}</p>
        </div>

        <div className="ab-hero__second">
          <p className="ab-hero__second-top">{hero.secondTop}</p>
          <p className="ab-hero__second-bottom">{hero.secondBottom}</p>
        </div>

        <span className="ab-hero__hint" aria-hidden="true">
          {hero.scrollHint}
        </span>
      </div>
    </section>
  );
}
