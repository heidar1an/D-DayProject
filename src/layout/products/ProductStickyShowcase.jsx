import { useRef } from 'react';

import ProductVisual from './ProductVisual';
import { ProductArrow, toFa, useStageIndex } from './productsShared';

/*
 * ── نمای چسبان ──
 *
 * چیدمان: پیش‌نمایش می‌چسبد و فهرستِ ویژگی‌ها از کنارش رد می‌شود. هنگام اسکرول،
 * ویژگیِ فعال عوض می‌شود و پیش‌نمایش همان مرحله را نشان می‌دهد
 * (سؤال ← پاسخ ← تحلیل ← روند).
 *
 * در موبایل و در `prefers-reduced-motion` چسبندگی خاموش است: بلوک به یک فهرستِ
 * ساده تبدیل می‌شود و همهٔ ویژگی‌ها با هم دیده می‌شوند، پس چیزی پشتِ اسکرول
 * پنهان نمی‌ماند.
 */

export default function ProductStickyShowcase({ product, onOpen }) {
  const rootRef = useRef(null);
  const features = product.features ?? [];
  const stage = useStageIndex(rootRef, features.length);
  const active = features[stage];

  return (
    <article className={`ps-sticky ps-accent-${product.accent}`} ref={rootRef} data-reveal>
      <div className="ps-sticky__grid">
        <div className="ps-sticky__visual">
          <div className="ps-sticky__visual-inner">
            <ProductVisual product={product} stage={active?.stage ?? 'question'} />
          </div>
        </div>

        <div className="ps-sticky__copy">
          <p className="ps-eyebrow">
            <span className="ps-eyebrow__index">{product.index}</span>
            {product.eyebrow}
          </p>

          <h3 className="ps-sticky__title">{product.title}</h3>
          <p className="ps-subtitle">{product.subtitle}</p>

          <ol className="ps-sticky__features">
            {features.map((feature, index) => (
              <li
                className={`ps-sticky__feature ${index === stage ? 'is-active' : ''}`}
                key={feature.id}
              >
                <span className="ps-sticky__feature-head">
                  <span className="ps-sticky__feature-index">{toFa(index + 1)}</span>
                  <span className="ps-sticky__feature-label">{feature.label}</span>
                </span>
                <p className="ps-sticky__feature-text">{feature.text}</p>
              </li>
            ))}
          </ol>

          <a
            className="ps-cta ps-cta--solid"
            href={product.href}
            onClick={(event) => onOpen(event, product.href)}
          >
            <span>{product.cta}</span>
            <ProductArrow />
          </a>
        </div>
      </div>
    </article>
  );
}
