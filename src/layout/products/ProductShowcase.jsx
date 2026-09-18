import { useRef } from 'react';

import ProductVisual from './ProductVisual';
import { ProductArrow, useStageIndex } from './productsShared';

/*
 * ── نمای بزرگِ تمام‌عرض (محصولِ شاخص) ──
 *
 * پیش‌نمایش هنگام ورود به دید بالا می‌آید و خانوادهٔ دوره‌ها با اسکرول، مثل
 * برگه‌های پشت‌سرهم ورق می‌خورند. فقط وقتی مرحله عوض شود state تغییر می‌کند؛
 * حرکت پیوستهٔ اسکرول وارد رندرهای متعدد React نمی‌شود.
 */

export default function ProductShowcase({ product, onOpen }) {
  const rootRef = useRef(null);
  const stage = useStageIndex(rootRef, product.sheets?.length ?? 1);

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
        <ProductVisual product={product} stage={stage} />
      </div>
    </article>
  );
}
