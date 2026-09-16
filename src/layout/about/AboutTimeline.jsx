import { useRef } from 'react';

import { getAboutMeta, getAboutTimeline } from '../../services/about/aboutService';
import { toFa, useScene } from './aboutShared';

/*
 * ── داستان شکل‌گیری ──
 *
 * عمداً Timelineِ کلاسیک (خط + کارت) نیست: عنوان سمتِ راست می‌چسبد و مراحل از
 * کنارش رد می‌شوند؛ هر مرحله که از مرکزِ دید رد شود فعال می‌شود و شمارندهٔ
 * بالای عنوان همان را نشان می‌دهد.
 *
 * ⚠️ هیچ تاریخ و عددی اینجا ساخته نشده است. تاریخچهٔ تپش در پروژه دادهٔ واقعی
 * ندارد؛ پس مراحل فقط «عنوان و نقش» دارند و تا وقتی `historyConfirmed` در
 * `aboutService` درست نشود، یادداشتِ شفاف پای بخش می‌ماند.
 */

export default function AboutTimeline() {
  const data = getAboutTimeline();
  const meta = getAboutMeta();
  const rootRef = useRef(null);
  const stage = useScene(rootRef, { mode: 'sticky', stages: data.steps.length });

  return (
    <section className="ab-timeline" ref={rootRef} aria-labelledby="ab-timeline-title">
      <div className="ab-timeline__inner section-shell">
        <header className="ab-timeline__head">
          <p className="ab-eyebrow">{data.eyebrow}</p>
          <h2 className="ab-title" id="ab-timeline-title">
            {data.title}
          </h2>
          <p className="ab-lead">{data.lead}</p>

          <p className="ab-timeline__counter" aria-hidden="true">
            <span>{toFa(stage + 1)}</span>
            <span className="ab-timeline__counter-sep">/</span>
            <span>{toFa(data.steps.length)}</span>
          </p>
        </header>

        <div className="ab-timeline__track">
          <span className="ab-timeline__rail" aria-hidden="true">
            <span className="ab-timeline__rail-fill" />
          </span>

          <ol className="ab-timeline__steps">
            {data.steps.map((step, index) => (
              <li
                className={`ab-timeline__step ${index === stage ? 'is-active' : ''} ${
                  index < stage ? 'is-past' : ''
                }`}
                key={step.id}
              >
                <span className="ab-timeline__index">{toFa(index + 1)}</span>
                <h3 className="ab-timeline__label">{step.label}</h3>
                <p className="ab-timeline__text">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {!meta.historyConfirmed && <p className="ab-footnote">{meta.historyNote}</p>}
    </section>
  );
}
