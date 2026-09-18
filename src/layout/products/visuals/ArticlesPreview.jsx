import { getArticlePreview } from '../../../services/products/productsService';
import { ProductArrow, toFa } from '../productsShared';

/*
 * ── مقالات تپش ──
 *
 * این پیش‌نمایش جای کادرِ جست‌وجوی ویکی را گرفته است: سمتِ کناریِ کارتِ ویکی
 * حالا مقالاتِ واقعیِ تپش را نشان می‌دهد. داده از سرویس مقالات می‌آید (نه
 * فهرستِ ساختگی) و هر ردیف یک لینکِ واقعی به همان مقاله است
 * (`#articles/<slug>`)، پس چیزی تزئینی نیست.
 */

export default function ArticlesPreview() {
  const articles = getArticlePreview();

  if (articles.length === 0) return null;

  return (
    <div className="ps-articles">
      <p className="ps-articles__head">
        <span className="ps-articles__label">مقالات تپش</span>
        <span className="ps-articles__count">{toFa(articles.length)} مقالهٔ تازه</span>
      </p>

      <ul className="ps-articles__list">
        {articles.map((article, index) => (
          <li key={article.id} style={{ '--ps-i': index }}>
            <a className="ps-articles__item" href={`#articles/${article.slug}`}>
              <span className="ps-articles__title">{article.title}</span>

              <span className="ps-articles__meta">
                <span className="ps-articles__category">{article.category}</span>
                <span className="ps-articles__time">{toFa(article.readingTime)} دقیقه</span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <a className="ps-articles__all" href="#articles">
        <span>همهٔ مقالات تپش</span>
        <ProductArrow />
      </a>
    </div>
  );
}
