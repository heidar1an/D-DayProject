import { useRef } from 'react';

import { getAboutWhy } from '../../services/about/aboutService';
import { useInView, usePointerParallax } from './aboutShared';

/*
 * ── «پس تپش برای چه ساخته شد؟» — از پراکندگی تا فهم ──
 *
 * سؤالِ این بخش دربارهٔ دلیلِ ساختنِ تپش است، نه فهرستِ درس‌ها. بنابراین میدان
 * به‌جای شبکه‌ای از نام‌های نامرتبط، سه ورودیِ واقعیِ یادگیری را نشان می‌دهد که
 * به یک خروجی می‌رسند: فهمی که بتوان از آن استفاده کرد. خط‌ها با ورود به دید
 * شکل می‌گیرند، حلقه‌ها آرام می‌چرخند و هر ورودی با ضربانِ کوتاه زنده می‌ماند.
 */

const WIRES = [
  { id: 'source-top', d: 'M 18 22 C 30 26 39 40 50 50' },
  { id: 'source-middle', d: 'M 12 50 C 28 50 38 50 50 50' },
  { id: 'source-bottom', d: 'M 18 78 C 30 74 39 60 50 50' },
];

const SOURCE_LAYOUT = [
  { left: '17%', top: '22%' },
  { left: '11%', top: '50%' },
  { left: '17%', top: '78%' },
];

export default function KnowledgeNetwork() {
  const data = getAboutWhy();
  const fieldRef = useRef(null);
  const inView = useInView(fieldRef, { threshold: 0.25 });

  usePointerParallax(fieldRef);

  return (
    <section className="ab-why section-shell" id="ab-why" aria-labelledby="ab-why-title">
      <div className="ab-why__copy">
        <p className="ab-eyebrow">{data.eyebrow}</p>
        <h2 className="ab-title" id="ab-why-title">
          {data.title}
        </h2>
        <p className="ab-lead">{data.lead}</p>
      </div>

      <div
        className={`ab-why-flow ${inView ? 'is-in' : ''}`}
        ref={fieldRef}
        role="img"
        aria-label={data.visualLabel}
      >
        <span className="ab-why-flow__orbit ab-why-flow__orbit--outer" aria-hidden="true" />
        <span className="ab-why-flow__orbit ab-why-flow__orbit--inner" aria-hidden="true" />

        <svg className="ab-why-flow__wires" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          {WIRES.map((wire, index) => (
            <path
              className="ab-why-flow__wire"
              d={wire.d}
              key={wire.id}
              pathLength="1"
              style={{ '--ab-i': index }}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <div className="ab-why-flow__sources" aria-hidden="true">
          {data.inputs.map((label, index) => {
            const position = SOURCE_LAYOUT[index % SOURCE_LAYOUT.length];

            return (
              <span
                className="ab-why-flow__source"
                key={label}
                style={{ ...position, '--ab-i': index }}
              >
                <span className="ab-why-flow__source-card">
                  <span className="ab-why-flow__source-dot" />
                  <span>{label}</span>
                </span>
              </span>
            );
          })}
        </div>

        <div className="ab-why-flow__core">
          <span className="ab-why-flow__core-title">{data.output}</span>
          <span className="ab-why-flow__core-caption">{data.center}</span>
        </div>
      </div>
    </section>
  );
}
