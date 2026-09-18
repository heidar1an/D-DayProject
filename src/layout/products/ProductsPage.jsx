import { getProductsIntro } from '../../services/products/productsService';
import ProductIntro from './ProductIntro';
import ProductsSection from './ProductsSection';
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
 *   ۱. سرآغاز (هم‌زبان با هدرِ «درسنامه جامع علوم پایه»)
 *   ۲. بدنهٔ محصولات (`ProductsSection` — ریتم از `layout` هر محصول می‌آید)
 *
 * کادرِ فراخوانِ جداگانهٔ پایین صفحه عمداً اینجا نیست؛ صفحه با نمودارِ متحرکِ
 * اکوسیستم داخل `ProductOutro` تمام می‌شود.
 *
 * قاعدهٔ پروژه رعایت شده است: متن‌های صفحه از `productsService` می‌آیند، مقصدِ
 * هر محصول یک لایهٔ واقعیِ داشبورد است و همهٔ حرکت‌ها گارد کاهش حرکت دارند.
 */

export default function ProductsPage({ onOpenProduct }) {
  const intro = getProductsIntro();

  return (
    <main className="ps-page" id="products-page">
      {/* ── سرآغاز صفحه: بدون هاله و بدون کادرهای آماری ── */}
      <section
        className="ps-hero section-shell"
        data-reveal="hero"
        aria-labelledby="products-title"
      >
        <ProductIntro intro={intro} as="h1" />
      </section>

      {/* ── بدنهٔ محصولات ── */}
      <ProductsSection onOpenProduct={onOpenProduct} />
    </main>
  );
}
