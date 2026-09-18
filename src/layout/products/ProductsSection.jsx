import { getProducts, getProductsOutro } from '../../services/products/productsService';
import ProductCard from './ProductCard';
import ProductOutro from './ProductOutro';
import ProductPanels from './ProductPanels';
import ProductShowcase from './ProductShowcase';

/*
 * ── بدنهٔ صفحهٔ محصولات (مسیر مستقل `#products`) ──
 *
 * این فایل فقط «ریتم» را می‌سازد؛ هیچ متن و هیچ مسیری اینجا نیست. ترتیبِ ثابت:
 *
 *   نمای ورق‌خورِ دوره‌ها → کادرهای چرخانِ بانک تست → ردیف دو‌تایی →
 *   بخشِ بزرگ میانی → ردیف فشرده → اکوسیستم
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
  const panels = products.find((product) => product.layout === 'panels') ?? null;
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

      {panels ? <ProductPanels product={panels} onOpen={onOpenProduct} /> : null}

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
