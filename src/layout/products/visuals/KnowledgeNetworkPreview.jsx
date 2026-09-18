import { ProductArrow } from '../productsShared';

/*
 * پیش‌نمایش تصویری شبکهٔ دانش.
 *
 * تصویر مرجع خودش حرف می‌زند، پس هیچ لایهٔ تزئینی رویش نمی‌نشیند: نه پردهٔ
 * گرادیانی، نه دایرهٔ چرخان، نه پس‌زمینهٔ قاب. متنِ توضیح کنارش می‌ماند تا
 * روایتِ «اتصال» خوانده شود.
 */

export default function KnowledgeNetworkPreview({ product }) {
  return (
    <div className="ps-network-image">
      <div className="ps-network-image__photo">
        <img src={product.cover} alt="شبکهٔ دانش تپش" loading="lazy" decoding="async" />
      </div>

      <div className="ps-network-image__copy">
        <span className="ps-network-image__badge">نقشهٔ زندهٔ دانش</span>
        <h4 className="ps-network-image__title">هر مفهوم، یک مسیر تازه</h4>
        <p className="ps-network-image__text">
          از درس و مقاله تا تست؛ ارتباط‌ها را ببین و از یک موضوع به موضوع بعدی برو.
        </p>
        <span className="ps-network-image__link">
          کشف ارتباط‌ها
          <ProductArrow />
        </span>
      </div>
    </div>
  );
}
