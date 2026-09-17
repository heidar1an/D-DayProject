import { useState } from 'react';

import { getAboutLearners } from '../../services/about/aboutService';
import { toFa } from './aboutShared';

/*
 * ── «تپش برای چه کسی ساخته شده؟» ──
 *
 * تمرکز روی «یادگیرنده» است، نه مشتری. پس به‌جای پنج کارت، پنج صدا: هر سناریو
 * یک جملهٔ اول‌شخص دارد. جملهٔ فعال در یک پانلِ بزرگ نشسته و با انتخابِ هر
 * سناریو عوض می‌شود (کلیدِ ری‌اکت عوض می‌شود تا انیمیشنِ ورود دوباره اجرا شود).
 *
 * در موبایل پانلِ بزرگ کنار می‌رود و همان جمله‌ها زیرِ هر سناریو دیده
 * می‌شوند — چون تعاملِ «هاور» با انگشت معنا ندارد.
 */

export default function LearnerSection() {
  const data = getAboutLearners();
  const [activeId, setActiveId] = useState(data.scenarios[0].id);
  const active = data.scenarios.find((item) => item.id === activeId) ?? data.scenarios[0];
  const activeIndex = Math.max(0, data.scenarios.findIndex((item) => item.id === active.id));

  return (
    <section className="ab-learners section-shell" aria-labelledby="ab-learners-title">
      <header className="ab-learners__head">
        <p className="ab-eyebrow">{data.eyebrow}</p>
        <h2 className="ab-title" id="ab-learners-title">
          {data.title}
        </h2>
        <p className="ab-lead">{data.lead}</p>
      </header>

      <div className="ab-learners__body">
        <div className="ab-learners__voice" key={active.id} aria-live="polite">
          <div className="ab-learners__voice-head">
            <span className="ab-learners__voice-index">
              {toFa(activeIndex + 1)} <span aria-hidden="true">/</span> {toFa(data.scenarios.length)}
            </span>
            <span className="ab-learners__voice-label">صدای یادگیرنده</span>
          </div>
          <p className="ab-learners__quote">{active.voice}</p>
          <p className="ab-learners__answer">{active.answer}</p>
          <span className="ab-learners__voice-line" aria-hidden="true" />
        </div>

        <ul className="ab-learners__list">
          {data.scenarios.map((scenario) => (
            <li key={scenario.id}>
              <button
                className={`ab-learners__item ${scenario.id === activeId ? 'is-active' : ''}`}
                type="button"
                aria-pressed={scenario.id === activeId}
                onMouseEnter={() => setActiveId(scenario.id)}
                onFocus={() => setActiveId(scenario.id)}
                onClick={() => setActiveId(scenario.id)}
              >
                <span className="ab-learners__item-label">{scenario.label}</span>
                <span className="ab-learners__item-voice">{scenario.voice}</span>
                <span className="ab-learners__item-answer">{scenario.answer}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
