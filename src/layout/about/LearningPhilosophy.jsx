import { useRef } from 'react';

import { getAboutPhilosophy } from '../../services/about/aboutService';
import { toFa, useScene } from './aboutShared';

/*
 * ── «ما یادگیری را این‌طور می‌بینیم» — روایتِ پله‌ای ──
 *
 * برخلافِ بخشِ مسئله (که فقط تایپوگرافی بود)، اینجا صحنه دوپاره است: یک سو
 * واژهٔ خیلی بزرگ، سوی دیگر اندیس و توضیح. ریتمِ صفحه عمداً با بخشِ قبل فرق
 * می‌کند تا حسِ «تکرارِ یک الگو» پیش نیاید.
 *
 * هر مرحله یک قوسِ خودش را دارد: قوسِ فعال همان مرحله است که پررنگ می‌شود،
 * پس حرکتِ بین مراحل روی یک خطِ پیوسته می‌افتد، نه روی چهار المانِ جدا.
 */

/* قوسی در بالای مرکز — فقط نشانهٔ مرحله، بدون هیچ معنای عددی */
function arcPath(index) {
  const radius = 46 + index * 17;
  const start = (208 * Math.PI) / 180;
  const end = (332 * Math.PI) / 180;

  const x1 = 100 + Math.cos(start) * radius;
  const y1 = 100 + Math.sin(start) * radius;
  const x2 = 100 + Math.cos(end) * radius;
  const y2 = 100 + Math.sin(end) * radius;

  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export default function LearningPhilosophy() {
  const data = getAboutPhilosophy();
  const rootRef = useRef(null);
  const stage = useScene(rootRef, { mode: 'sticky', stages: data.stages.length });

  return (
    <section
      className="ab-philosophy"
      ref={rootRef}
      style={{ '--ab-stages': data.stages.length }}
      aria-labelledby="ab-philosophy-title"
    >
      <div className="ab-philosophy__stage">
        <header className="ab-philosophy__head">
          <p className="ab-eyebrow">{data.eyebrow}</p>
          <h2 className="ab-title" id="ab-philosophy-title">
            {data.title}
          </h2>
        </header>

        <div className="ab-philosophy__body">
          <div className="ab-philosophy__words">
            <svg
              className="ab-philosophy__arcs"
              viewBox="0 0 200 200"
              aria-hidden="true"
              focusable="false"
            >
              {data.stages.map((item, index) => (
                <path
                  d={arcPath(index)}
                  key={`arc-${item.id}`}
                  pathLength="1"
                  className={`ab-philosophy__arc ${index === stage ? 'is-active' : ''} ${
                    index < stage ? 'is-past' : ''
                  }`}
                  style={{ '--ab-i': index }}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {data.stages.map((item, index) => (
              <span
                className={`ab-philosophy__word ${index === stage ? 'is-active' : ''} ${
                  index < stage ? 'is-past' : ''
                }`}
                key={item.id}
                aria-hidden={index !== stage}
              >
                {item.word}
              </span>
            ))}
          </div>

          <div className="ab-philosophy__meta">
            {data.stages.map((item, index) => (
              <div
                className={`ab-philosophy__note ${index === stage ? 'is-active' : ''}`}
                key={`note-${item.id}`}
              >
                <span className="ab-philosophy__index">{toFa(index + 1)}</span>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <ol className="ab-philosophy__ticks" aria-hidden="true">
          {data.stages.map((item, index) => (
            <li className={index === stage ? 'is-active' : ''} key={`tick-${item.id}`}>
              {item.word}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
