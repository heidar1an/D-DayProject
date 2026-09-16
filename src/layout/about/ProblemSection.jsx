import { useRef } from 'react';

import { getAboutProblem } from '../../services/about/aboutService';
import { useScene } from './aboutShared';

/*
 * ── بخش «مسئله» ──
 *
 * اینجا کارت نداریم. پنج مرحله (تیتر + چهار جمله) در یک صحنهٔ چسبان پشتِ سرِ
 * هم می‌آیند: هر جمله وقتی نوبتش است در مرکز می‌نشیند و بعد عقب می‌رود.
 *
 * چرا `--ab-stages` روی داده است و نه در CSS: مرحله‌ها از همان آرایهٔ متن‌ها
 * شمرده می‌شوند، پس اگر جمله‌ای اضافه یا کم شود، ارتفاعِ بخش خودش درست
 * می‌شود و کسی یادش نمی‌رود عددِ جادویی را عوض کند.
 */

export default function ProblemSection() {
  const data = getAboutProblem();
  const rootRef = useRef(null);
  const stages = data.lines.length + 1;
  const stage = useScene(rootRef, { mode: 'sticky', stages });

  return (
    <section
      className="ab-problem"
      ref={rootRef}
      style={{ '--ab-stages': stages }}
      aria-labelledby="ab-problem-title"
    >
      <div className="ab-problem__stage">
        <span className="ab-problem__rail" aria-hidden="true">
          <span className="ab-problem__rail-fill" />
        </span>

        <p className="ab-eyebrow ab-problem__eyebrow">{data.eyebrow}</p>

        <h2
          className={`ab-problem__title ${stage === 0 ? 'is-active' : 'is-past'}`}
          id="ab-problem-title"
        >
          {data.title}
        </h2>

        <div className="ab-problem__lines">
          {data.lines.map((line, index) => {
            const order = index + 1;

            return (
              <p
                className={`ab-problem__line ${stage === order ? 'is-active' : ''} ${
                  stage > order ? 'is-past' : ''
                }`}
                key={line}
                style={{ '--ab-i': index }}
              >
                {line}
              </p>
            );
          })}

          <p className={`ab-problem__closing ${stage === stages - 1 ? 'is-active' : ''}`}>
            {data.closing}
          </p>
        </div>
      </div>
    </section>
  );
}
