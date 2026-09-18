import { useRef } from 'react';

import ProductVisual from './ProductVisual';
import { ProductArrow, useStageIndex } from './productsShared';

/*
 * ── نمای بزرگِ تمام‌عرض (محصولِ شاخص) ──
 *
 * پیش‌نمایشِ سمت راست هنگام اسکرول در جای خود می‌چسبد و خانوادهٔ دوره‌ها مثل
 * برگه‌های پشت‌سرهم ورق می‌خورند. بعد از آخرین برگه، مرحله ثابت می‌ماند و
 * اسکرول صفحه بدون گیر ادامه پیدا می‌کند. فقط وقتی مرحله عوض شود state تغییر می‌کند؛
 * حرکت پیوستهٔ اسکرول وارد رندرهای متعدد React نمی‌شود.
 */

export default function ProductShowcase({ product, onOpen }) {
  const rootRef = useRef(null);
  const sheetCount = product.sheets?.length ?? 1;
  const stage = useStageIndex(rootRef, sheetCount);

  return (
    <article
      className={`ps-showcase ps-accent-${product.accent}`}
      ref={rootRef}
      style={{ '--ps-sheet-count': sheetCount }}
      data-reveal
    >
      <div className="ps-showcase__copy">
        <p className="ps-eyebrow">{product.eyebrow}</p>

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
