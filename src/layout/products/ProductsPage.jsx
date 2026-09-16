import {
  getProducts,
  getProductsIntro,
  getProductsOutro,
} from '../../services/products/productsService';
import ProductIntro from './ProductIntro';
import ProductsSection from './ProductsSection';
import { ProductArrow, toFa } from './productsShared';
import './products.css';

/*
 * ── صفحهٔ مستقل محصولات (مسیر `#products`) ──
 *
 * چرا صفحهٔ جدا و نه یک بخش در صفحهٔ اصلی: محصولات «کاتالوگِ تصمیم» هستند،
 * نه یک بلوکِ معرفی. جدا بودن سه چیز می‌دهد — لینک‌پذیری مستقل (هدر، فوتر،
 * CTAهای صفحهٔ اصلی همگی به همین‌جا می‌آیند)، فضای کافی برای پیش‌نمایشِ هر
 * محصول، و این‌که صفحهٔ اصلی دوباره روایتِ خودش را داشته باشد.
 *
 * ترتیب لایه‌های صفحه:
 *   ۱. سرآغاز (تیترِ صفحه + سه واقعیتِ برگرفته از خودِ داده)
 *   ۲. بدنهٔ محصولات (`ProductsSection` — ریتم از `layout` هر محصول می‌آید)
 *   ۳. فراخوان پایانی (ورود به داشبورد یا ثبت‌نام)
 *
 * قاعدهٔ پروژه رعایت شده است: هیچ متن و عددی اینجا نوشته نشده (همه از
 * `productsService`)، مقصدِ هر محصول یک لایهٔ واقعیِ داشبورد است، CSS همین
 * لایه صاحبش است و همهٔ حرکت‌ها گارد `prefers-reduced-motion` دارند.
 */

export default function ProductsPage({ hasAccount = false, onOpenProduct, onStart }) {
  const products = getProducts();
  const intro = getProductsIntro();
  const outro = getProductsOutro();

  /* حوزه‌ها از خودِ داده شمرده می‌شوند؛ عددی از بیرون وارد نمی‌شود */
  const fields = [...new Set(products.map((product) => product.eyebrow))];

  return (
    <main className="ps-page" id="products-page">
      {/* ── لایهٔ اول: سرآغاز صفحه ── */}
      <section
        className="ps-hero section-shell"
        data-reveal="hero"
        aria-labelledby="products-title"
      >
        <span className="ps-hero__glow" aria-hidden="true" />

        <ProductIntro intro={intro} as="h1" />

        <dl className="ps-hero__facts">
          <div className="ps-fact">
            <dt>ابزارها</dt>
            <dd>{toFa(products.length)}</dd>
          </div>
          <div className="ps-fact">
            <dt>حوزه‌ها</dt>
            <dd>{toFa(fields.length)}</dd>
          </div>
          <div className="ps-fact">
            <dt>مقصد هر محصول</dt>
            <dd>داخل داشبورد تپش</dd>
          </div>
        </dl>
      </section>

      {/* ── لایهٔ دوم: بدنهٔ محصولات ── */}
      <ProductsSection onOpenProduct={onOpenProduct} />

      {/* ── لایهٔ سوم: فراخوان پایانی ── */}
      <section
        className="ps-final section-shell"
        data-reveal
        aria-labelledby="ps-final-title"
      >
        <div className="ps-final__panel">
          <div className="ps-final__copy">
            <h2 className="ps-final__title" id="ps-final-title">
              {outro.heading}
            </h2>
            <p className="ps-final__text">{outro.text}</p>
          </div>

          <div className="ps-final__actions">
            <a
              className="ps-cta ps-cta--solid"
              href={hasAccount ? '#dashboard' : '#auth'}
              onClick={onStart}
            >
              <span>{hasAccount ? 'رفتن به داشبورد' : 'ورود به تپش'}</span>
              <ProductArrow />
            </a>
            <a className="ps-final__secondary" href="#pricing">
              دیدن تعرفه‌ها
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
