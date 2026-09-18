import { useState } from 'react';

import { ProductArrow } from './productsShared';

/*
 * ── نمای چرخانِ بانک تست ──
 *
 * چهار کادر یک محصول‌اند: بانک تست، آنالیز شخصی، آزمون‌های هماهنگ و آزمون‌های
 * بین‌الملل. گزینه‌ها در یک ردیفِ هم‌اندازه می‌مانند و فقط محتوای کادرِ فعال
 * با کلیک کاربر عوض می‌شود؛ هیچ چرخش خودکاری وجود ندارد.
 */

function AnalysisVisual({ panel }) {
  return (
    <div className="ps-panel__analysis" aria-label="نمودار آنالیز عملکرد">
      <div className="ps-panel__stats">
        {panel.stats.map((stat) => (
          <span className="ps-panel__stat" key={stat.label}>
            <b>{stat.value}</b>
            <small>{stat.label}</small>
          </span>
        ))}
      </div>

      <div className="ps-panel__bars" aria-hidden="true">
        {panel.bars.map((height, index) => (
          <i key={index} style={{ '--ps-bar': `${height}%`, '--ps-i': index }} />
        ))}
      </div>
    </div>
  );
}

function CoordinatedVisual({ panel }) {
  return (
    <div className="ps-panel__coordinated" aria-label="خلاصهٔ آزمون هماهنگ">
      <span className="ps-panel__pulse" aria-hidden="true" />
      <div className="ps-panel__stats ps-panel__stats--wide">
        {panel.stats.map((stat) => (
          <span className="ps-panel__stat" key={stat.label}>
            <b>{stat.value}</b>
            <small>{stat.label}</small>
          </span>
        ))}
      </div>
      <span className="ps-panel__status">آزمون جامع علوم پایه · آمادهٔ شروع</span>
    </div>
  );
}

function InternationalVisual({ panel }) {
  return (
    <div className="ps-panel__international" aria-label="آزمون‌های بین‌الملل">
      <div className="ps-panel__exam-chips">
        {panel.exams.map((exam, index) => (
          <span key={exam} style={{ '--ps-i': index }}>
            {exam}
          </span>
        ))}
      </div>
      <div className="ps-panel__stats ps-panel__stats--wide">
        {panel.stats.map((stat) => (
          <span className="ps-panel__stat" key={stat.label}>
            <b>{stat.value}</b>
            <small>{stat.label}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function PanelVisual({ panel }) {
  if (panel.visual === 'image') {
    return (
      <div className="ps-panel__image">
        <img src={panel.cover} alt="پیش‌نمایش بانک تست علوم پایه" />
        <span className="ps-panel__image-shine" aria-hidden="true" />
      </div>
    );
  }

  if (panel.visual === 'analysis') return <AnalysisVisual panel={panel} />;
  if (panel.visual === 'coordinated') return <CoordinatedVisual panel={panel} />;
  if (panel.visual === 'international') return <InternationalVisual panel={panel} />;

  return null;
}

export default function ProductPanels({ product, onOpen }) {
  const panels = product.panels ?? [];
  const [activeIndex, setActiveIndex] = useState(0);

  if (panels.length === 0) return null;

  const active = panels[activeIndex] ?? panels[0];

  return (
    <article className={`ps-panels ps-accent-${product.accent}`} data-reveal>
      <div className="ps-panels__head">
        <div className="ps-panels__copy">
          <p className="ps-eyebrow">{product.eyebrow}</p>
          <h3 className="ps-panels__title">{product.title}</h3>
          <p className="ps-subtitle">{product.subtitle}</p>
          <p className="ps-text">{product.description}</p>

          <a
            className="ps-cta ps-cta--solid"
            href={product.href}
            onClick={(event) => onOpen?.(event, product.href)}
          >
            <span>{product.cta}</span>
            <ProductArrow />
          </a>
        </div>

        <div className="ps-panels__tabs" role="tablist" aria-label="بخش‌های بانک تست">
          {panels.map((panel, index) => (
            <button
              className={`ps-panels__tab ${index === activeIndex ? 'is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-controls={`ps-panel-${panel.id}`}
              key={panel.id}
              onClick={() => setActiveIndex(index)}
            >
              <span>{panel.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ps-panels__stage" aria-live="polite">
        <article
          className={`ps-panel ps-accent-${active.accent}`}
          id={`ps-panel-${active.id}`}
          key={active.id}
          role="tabpanel"
          aria-label={active.title}
        >
          <div className="ps-panel__copy">
            <span className="ps-panel__eyebrow">{active.label}</span>
            <h4 className="ps-panel__title">{active.title}</h4>
            <p className="ps-panel__text">{active.text}</p>
            <a
              className="ps-panel__link"
              href={active.href}
              onClick={(event) => onOpen?.(event, active.href)}
            >
              <span>رفتن به {active.label}</span>
              <ProductArrow />
            </a>
          </div>
          <div className="ps-panel__visual">
            <PanelVisual panel={active} />
          </div>
        </article>
      </div>
    </article>
  );
}
