import { useRef } from 'react';

import ProductVisual from './ProductVisual';
import { ProductArrow, useScrollProgressVar } from './productsShared';

/*
 * ── نمای بزرگِ تمام‌عرض (محصولِ شاخص) ──
 *
 * پیش‌نمایش هنگام ورود به دید بالا می‌آید و با اسکرول، لایه‌های داخلی‌اش با
 * سرعت‌های کمی متفاوت جابه‌جا می‌شوند (پارالاکس). عددِ پیشروی روی متغیر
 * `--ps-progress` نوشته می‌شود و فقط CSS آن را می‌خواند؛ هیچ رندرِ دوباره‌ای
 * هنگام اسکرول رخ نمی‌دهد.
 */

export default function ProductShowcase({ product, onOpen }) {
  const rootRef = useRef(null);
  useScrollProgressVar(rootRef);

  return (
    <article className={`ps-showcase ps-accent-${product.accent}`} ref={rootRef} data-reveal>
      <div className="ps-showcase__copy">
        <p className="ps-eyebrow">
          <span className="ps-eyebrow__index">{product.index}</span>
          {product.eyebrow}
        </p>

        <h3 className="ps-showcase__title">{product.title}</h3>
        <p className="ps-subtitle">{product.subtitle}</p>
        <p className="ps-text">{product.description}</p>

        <a
          className="ps-cta ps-cta--solid"
          href={product.href}
          onClick={(event) => onOpen(event, product.href)}
        >
          <span>{product.cta}</span>
          <ProductArrow />
        </a>
      </div>

      <div className="ps-showcase__visual">
        <ProductVisual product={product} />
      </div>
    </article>
  );
}
