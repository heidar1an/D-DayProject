import { getProducts, getProductsOutro } from '../../services/products/productsService';
import ProductCard from './ProductCard';
import ProductOutro from './ProductOutro';
import ProductShowcase from './ProductShowcase';
import ProductStickyShowcase from './ProductStickyShowcase';

/*
 * ── بدنهٔ صفحهٔ محصولات (مسیر مستقل `#products`) ──
 *
 * این فایل فقط «ریتم» را می‌سازد؛ هیچ متن و هیچ مسیری اینجا نیست. ترتیبِ ثابت:
 *
 *   نمای بزرگ → نمای چسبان → ردیف دو‌تایی → بخشِ بزرگ میانی →
 *   ردیف فشرده → اکوسیستم + فراخوان پایانی
 *
 * هر محصول از داده می‌آید و با `layout` خودش سر جایش می‌نشیند؛ پس اضافه‌کردن
 * محصولِ تازه فقط یک شیء در `productsService` است و این فایل دست‌نخورده می‌ماند.
 *
 * تیترِ بخش (`products-title`) در سرآغازِ صفحه است، نه اینجا — چون صفحهٔ مستقل
 * یک `h1` دارد و این بدنه زیر همان عنوان می‌نشیند.
 */

export default function ProductsSection({ onOpenProduct }) {
  const outro = getProductsOutro();
  const products = getProducts();

  const showcase = products.find((product) => product.layout === 'showcase') ?? null;
  const sticky = products.find((product) => product.layout === 'sticky') ?? null;
  const feature = products.find((product) => product.layout === 'feature') ?? null;
  const duo = products.filter((product) => product.layout === 'duo');
  const compact = products.filter((product) => product.layout === 'compact');

  return (
    <section
      className="ps-section section-shell"
      id="products-list"
      aria-labelledby="products-title"
    >
      {showcase ? <ProductShowcase product={showcase} onOpen={onOpenProduct} /> : null}

      {sticky ? <ProductStickyShowcase product={sticky} onOpen={onOpenProduct} /> : null}

      {duo.length > 0 ? (
        <div className="ps-row ps-row--duo">
          {duo.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={onOpenProduct} />
          ))}
        </div>
      ) : null}

      {feature ? <ProductCard product={feature} onOpen={onOpenProduct} /> : null}

      {compact.length > 0 ? (
        <div className="ps-row ps-row--compact">
          {compact.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={onOpenProduct} />
          ))}
        </div>
      ) : null}

      <ProductOutro outro={outro} onOpen={onOpenProduct} />
    </section>
  );
}
