import { ProductArrow } from './productsShared';
import EcosystemVisual from './visuals/EcosystemVisual';

/*
 * ── فراخوان پایانی بخش ──
 *
 * آخرین چیزی که کاربر از این بخش می‌بیند: نمودارِ یکپارچهٔ محصولات + یک دکمه.
 */

export default function ProductOutro({ outro, onOpen }) {
  return (
    <div className="ps-outro" data-reveal>
      <div className="ps-outro__copy">
        <h3 className="ps-outro__title">{outro.heading}</h3>
        <p className="ps-outro__text">{outro.text}</p>

        <a
          className="ps-cta ps-cta--solid"
          href={outro.href}
          onClick={(event) => onOpen(event, outro.href)}
        >
          <span>{outro.cta}</span>
          <ProductArrow />
        </a>
      </div>

      <div className="ps-outro__visual">
        <EcosystemVisual />
      </div>
    </div>
  );
}
