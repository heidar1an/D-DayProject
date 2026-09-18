import ProductVisual from './ProductVisual';
import { ProductArrow } from './productsShared';

/*
 * ── کارت محصول ──
 *
 * یک کامپوننت برای سه نقش، چون تفاوت‌شان فقط در چیدمان است:
 *   duo     → ستونی، پیش‌نمایشِ بلند
 *   feature → پهن، متن و پیش‌نمایش کنار هم
 *   compact → ستونی و کوتاه
 * پس به‌جای سه کامپوننتِ هم‌شکل، `layout` از داده می‌آید و CSS تفاوت را می‌سازد.
 */

export default function ProductCard({ product, onOpen }) {
  const extraClass = product.heroStyle ? ` ps-card--${product.heroStyle}` : '';

  return (
    <article className={`ps-card ps-card--${product.layout}${extraClass} ps-accent-${product.accent}`} data-reveal>
      <div className="ps-card__copy">
        <p className="ps-eyebrow">{product.eyebrow}</p>

        <h3 className="ps-card__title">{product.title}</h3>
        <p className="ps-card__subtitle">{product.subtitle}</p>
        <p className="ps-text">{product.description}</p>

        <a className="ps-cta" href={product.href} onClick={(event) => onOpen(event, product.href)}>
          <span>{product.cta}</span>
          <ProductArrow />
        </a>
      </div>

      <div className="ps-card__visual">
        <ProductVisual product={product} />
      </div>
    </article>
  );
}
