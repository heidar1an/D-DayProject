import { getProducts } from '../../services/pricing/pricingService';

/*
 * ── معرفی محصولات، پیش از تعرفه‌ها ──
 *
 * چرا این بخش وجود دارد: کاربر نباید بدون دانستن «چه چیزی می‌خرد» سراغ قیمت
 * برود. پس اول محصولات با یک ریتم تصویری معرفی می‌شوند و بعد تعرفه‌ها می‌آیند.
 *
 * انیمیشن‌ها تماماً CSS هستند و با کلاس `is-visible` روی خودِ بخش راه می‌افتند
 * (همان مکانیزم `data-reveal` سایت). ترتیب ورود با `--pr-i` تنظیم می‌شود:
 *   ۱. خط ریل از بالا به پایین کشیده می‌شود
 *   ۲. هر ردیف با تأخیر کوتاه بالا می‌آید
 *   ۳. نشانهٔ گرافیکی هر محصول خودش را «می‌کشد» (pathLength + dashoffset)
 * هیچ شنوندهٔ اسکرول و هیچ حلقهٔ جاوااسکریپتی در کار نیست.
 */

/* نشانه‌های انتزاعی — زبان بصری داده، نه تصویر آماده و نه آیکون پزشکی کلیشه‌ای */
const MARKS = {
  layers: (
    <svg className="pr-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path className="pr-mark__line" pathLength="1" d="M6 16 24 8l18 8-18 8z" />
      <path className="pr-mark__line" pathLength="1" d="M6 26 24 34l18-8" />
      <path className="pr-mark__line" pathLength="1" d="M6 34 24 42l18-8" />
    </svg>
  ),
  grid: (
    <svg className="pr-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path className="pr-mark__line" pathLength="1" d="M12 12h6v6h-6zM24 12h6v6h-6zM36 12h6v6h-6zM12 24h6v6h-6zM24 24h6v6h-6zM36 24h6v6h-6zM12 36h6v6h-6zM24 36h6v6h-6z" />
      <path className="pr-mark__line" pathLength="1" d="M18 15h6M30 15h6M18 27h6M30 27h6" />
    </svg>
  ),
  pulse: (
    <svg className="pr-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path className="pr-mark__line" pathLength="1" d="M4 26h9l4-11 6 22 5-16 4 5h12" />
      <circle className="pr-mark__dot" cx="42" cy="26" r="2.6" />
    </svg>
  ),
  chart: (
    <svg className="pr-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path className="pr-mark__line" pathLength="1" d="M8 40V22M20 40V14M32 40V28M44 40V10" />
      <path className="pr-mark__line" pathLength="1" d="M8 30 20 20l12 6 12-14" />
    </svg>
  ),
};

function ProductMark({ mark }) {
  return <span className="pr-product__mark">{MARKS[mark] ?? MARKS.layers}</span>;
}

export default function ProductShowcase({ onSeePlans }) {
  const products = getProducts();

  return (
    <section className="pr-products section-shell" data-reveal aria-labelledby="pr-products-title">
      <header className="pr-products__head">
        <span className="pr-eyebrow pr-eyebrow--quiet">قبل از قیمت، محصول</span>
        <h2 className="pr-section-title" id="pr-products-title">
          با تپش چه چیزی به دست می‌آوری
        </h2>
        <p className="pr-section-lead">
          چهار ستون اصلی تپش که تعرفه‌ها فقط سطح دسترسی به آن‌ها را تعیین می‌کنند.
        </p>
      </header>

      <div className="pr-products__track">
        <span className="pr-products__rail" aria-hidden="true" />

        <ol className="pr-products__list">
          {products.map((product, index) => (
            <li
              className={`pr-product pr-product--${product.accent}`}
              key={product.id}
              style={{ '--pr-i': index }}
            >
              <span className="pr-product__marker" aria-hidden="true" />

              <span className="pr-product__index" aria-hidden="true">
                {product.index}
              </span>

              <div className="pr-product__body">
                <h3 className="pr-product__title">{product.title}</h3>
                <p className="pr-product__description">{product.description}</p>
                <ul className="pr-product__chips">
                  {product.capabilities.map((capability) => (
                    <li className="pr-product__chip" key={capability}>
                      {capability}
                    </li>
                  ))}
                </ul>
              </div>

              <ProductMark mark={product.mark} />
            </li>
          ))}
        </ol>
      </div>

      <p className="pr-products__bridge">
        پوشش هر محصول در پلن‌ها متفاوت است.{' '}
        <a className="pr-products__bridge-link" href="#pr-plans" onClick={onSeePlans}>
          مقایسهٔ پلن‌ها را ببین
        </a>
      </p>
    </section>
  );
}
